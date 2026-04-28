"""Config manager — fetches and caches the project config from CloudFront."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, cast

import httpx

from .constants import SIGNAKIT_CDN_URL
from .types import (
    AllowlistEntry,
    AudienceCondition,
    ConfigFlag,
    ConfigRule,
    ConfigRuleAudience,
    Environment,
    FlagVariable,
    ProjectConfig,
    Variation,
    VariationAllocation,
    VariationAllocationRange,
)

_logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class ParsedSdkKey:
    org_id: str
    project_id: str
    environment: Environment


def parse_sdk_key(sdk_key: str) -> ParsedSdkKey:
    """Parse an SDK key of the form ``sk_{env}_{orgId}_{projectId}_{random}``.

    Args:
        sdk_key: The SDK key string.

    Returns:
        Parsed components.

    Raises:
        ValueError: If the key shape or environment prefix is invalid.
    """
    parts = sdk_key.split("_")
    if len(parts) < 5 or parts[0] != "sk":
        raise ValueError(
            "[SignaKit] Invalid SDK key format. Expected: "
            f"sk_{{env}}_{{orgId}}_{{projectId}}_{{random}}, got: {sdk_key}"
        )

    env_short, org_id, project_id = parts[1], parts[2], parts[3]
    if not env_short or not org_id or not project_id:
        raise ValueError(
            "[SignaKit] Invalid SDK key format. Could not extract environment, "
            "orgId, or projectId."
        )

    if env_short == "dev":
        environment: Environment = "development"
    elif env_short == "prod":
        environment = "production"
    else:
        raise ValueError(
            f"[SignaKit] Invalid SDK key environment. Expected 'dev' or 'prod', got: {env_short}"
        )

    return ParsedSdkKey(org_id=org_id, project_id=project_id, environment=environment)


# ---- Raw JSON → typed dataclass parsing -----------------------------------


def _parse_allocation(raw: dict[str, Any]) -> VariationAllocation:
    ranges = [
        VariationAllocationRange(
            variation=str(r["variation"]),
            start=int(r["start"]),
            end=int(r["end"]),
        )
        for r in raw.get("ranges", [])
    ]
    return VariationAllocation(ranges=ranges)


def _parse_rule(raw: dict[str, Any]) -> ConfigRule:
    audiences: list[ConfigRuleAudience] | None = None
    if "audiences" in raw and raw["audiences"] is not None:
        audiences = [
            ConfigRuleAudience(
                conditions=[
                    AudienceCondition(
                        attribute=str(c["attribute"]),
                        operator=c["operator"],
                        value=c["value"],
                    )
                    for c in a.get("conditions", [])
                ]
            )
            for a in raw["audiences"]
        ]

    allowlist: list[AllowlistEntry] | None = None
    if raw.get("allowlist"):
        allowlist = [
            AllowlistEntry(user_id=str(e["userId"]), variation=str(e["variation"]))
            for e in raw["allowlist"]
        ]

    return ConfigRule(
        rule_key=str(raw["ruleKey"]),
        rule_type=raw["ruleType"],
        audience_match_type=raw.get("audienceMatchType"),
        audiences=audiences,
        traffic_percentage=float(raw["trafficPercentage"]),
        variation_allocation=_parse_allocation(raw["variationAllocation"]),
        allowlist=allowlist,
        event_keys=raw.get("eventKeys"),
        primary_event_key=raw.get("primaryEventKey"),
    )


def _parse_flag(raw: dict[str, Any]) -> ConfigFlag:
    variations = [
        Variation(key=str(v["key"]), variables=v.get("variables"))
        for v in raw.get("variations", [])
    ]
    variables: list[FlagVariable] | None = None
    if raw.get("variables"):
        variables = [
            FlagVariable(
                key=str(v["key"]),
                type=v["type"],
                default_value=v["defaultValue"],
            )
            for v in raw["variables"]
        ]
    rules: list[ConfigRule] | None = None
    if raw.get("rules"):
        rules = [_parse_rule(r) for r in raw["rules"]]

    return ConfigFlag(
        id=str(raw["id"]),
        key=str(raw["key"]),
        variations=variations,
        variables=variables,
        allocation=_parse_allocation(raw["allocation"]),
        salt=str(raw["salt"]),
        status=raw["status"],
        running=bool(raw["running"]),
        rules=rules,
    )


def parse_project_config(raw: dict[str, Any]) -> ProjectConfig:
    """Convert the raw CDN JSON payload into a typed :class:`ProjectConfig`."""
    return ProjectConfig(
        project_id=str(raw["projectId"]),
        environment_key=raw["environmentKey"],
        sdk_key=str(raw["sdkKey"]),
        version=int(raw["version"]),
        flags=[_parse_flag(f) for f in raw.get("flags", [])],
        generated_at=str(raw["generatedAt"]),
    )


class ConfigManager:
    """Fetches and caches the project config from CloudFront, with ETag support.

    Provides both an async and sync API — the underlying transport is
    :mod:`httpx`. Callers may inject a custom client (useful for tests).
    """

    def __init__(
        self,
        org_id: str,
        project_id: str,
        environment: Environment,
        *,
        cdn_url: str = SIGNAKIT_CDN_URL,
        async_client: httpx.AsyncClient | None = None,
        sync_client: httpx.Client | None = None,
    ) -> None:
        self._org_id = org_id
        self._project_id = project_id
        self._environment: Environment = environment
        self._cdn_url = cdn_url.rstrip("/")
        self._config: ProjectConfig | None = None
        self._etag: str | None = None
        self._async_client = async_client
        self._sync_client = sync_client

    @property
    def config_url(self) -> str:
        return (
            f"{self._cdn_url}/configs/{self._org_id}/{self._project_id}/"
            f"{self._environment}/latest.json"
        )

    def get_config(self) -> ProjectConfig | None:
        """Return the currently cached config, or ``None`` if not yet fetched."""
        return self._config

    def _request_headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        if self._etag is not None:
            headers["If-None-Match"] = self._etag
        return headers

    def _ingest_response(self, response: httpx.Response) -> ProjectConfig:
        if response.status_code == 304 and self._config is not None:
            return self._config

        if response.status_code >= 400:
            raise RuntimeError(
                f"[SignaKit] Failed to fetch config: {response.status_code} "
                f"{response.reason_phrase}"
            )

        new_etag = response.headers.get("etag")
        if new_etag:
            self._etag = new_etag

        raw = cast(dict[str, Any], response.json())
        self._config = parse_project_config(raw)
        return self._config

    async def fetch_config(self) -> ProjectConfig:
        """Async: fetch the config from CloudFront with ETag-based caching."""
        if self._async_client is not None:
            response = await self._async_client.get(
                self.config_url, headers=self._request_headers()
            )
        else:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self.config_url, headers=self._request_headers()
                )
        return self._ingest_response(response)

    def fetch_config_sync(self) -> ProjectConfig:
        """Sync: fetch the config from CloudFront with ETag-based caching."""
        if self._sync_client is not None:
            response = self._sync_client.get(
                self.config_url, headers=self._request_headers()
            )
        else:
            with httpx.Client() as client:
                response = client.get(
                    self.config_url, headers=self._request_headers()
                )
        return self._ingest_response(response)
