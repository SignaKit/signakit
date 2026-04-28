"""SignaKit Flags async-first client."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from .config_manager import ConfigManager, parse_sdk_key
from .constants import SIGNAKIT_EVENTS_URL
from .evaluator import evaluate_all_flags, evaluate_flag
from .types import (
    Decision,
    Decisions,
    OnReadyResult,
    UserAttributes,
)
from .user_context import SignaKitUserContext

_logger = logging.getLogger(__name__)


class SignaKitClient:
    """Feature-flag client.

    Usage::

        client = SignaKitClient(sdk_key="sk_dev_org_proj_xxxx")
        ready = await client.on_ready()
        if not ready.success:
            ...
        ctx = client.create_user_context("user-123", {"plan": "premium"})
        decision = ctx.decide("new-checkout-flow")
    """

    def __init__(
        self,
        sdk_key: str,
        *,
        config_manager: ConfigManager | None = None,
        events_url: str = SIGNAKIT_EVENTS_URL,
        async_client: httpx.AsyncClient | None = None,
        sync_client: httpx.Client | None = None,
    ) -> None:
        if not sdk_key:
            raise ValueError("[SignaKit] sdk_key is required")

        self._sdk_key = sdk_key
        self._events_url = events_url
        self._async_client = async_client
        self._sync_client = sync_client
        self._is_ready = False

        if config_manager is not None:
            self._config_manager = config_manager
        else:
            parsed = parse_sdk_key(sdk_key)
            self._config_manager = ConfigManager(
                org_id=parsed.org_id,
                project_id=parsed.project_id,
                environment=parsed.environment,
                async_client=async_client,
                sync_client=sync_client,
            )

    # ---- lifecycle ---------------------------------------------------------

    async def on_ready(self) -> OnReadyResult:
        """Fetch the config and mark the client ready."""
        try:
            await self._config_manager.fetch_config()
            self._is_ready = True
            return OnReadyResult(success=True)
        except Exception as exc:  # noqa: BLE001 — surface as reason
            return OnReadyResult(success=False, reason=str(exc))

    def on_ready_sync(self) -> OnReadyResult:
        """Synchronous variant of :meth:`on_ready`."""
        try:
            self._config_manager.fetch_config_sync()
            self._is_ready = True
            return OnReadyResult(success=True)
        except Exception as exc:  # noqa: BLE001
            return OnReadyResult(success=False, reason=str(exc))

    @property
    def is_ready(self) -> bool:
        return self._is_ready

    def create_user_context(
        self, user_id: str, attributes: UserAttributes | None = None
    ) -> SignaKitUserContext | None:
        """Create a user context, or ``None`` if the client isn't ready."""
        if not self._is_ready:
            _logger.error(
                "[SignaKit] SignaKitClient is not ready. Call on_ready() first."
            )
            return None
        return SignaKitUserContext(self, user_id, attributes)

    # ---- internal: evaluation ---------------------------------------------

    def _evaluate_flag(
        self, flag_key: str, user_id: str, attributes: UserAttributes
    ) -> Decision | None:
        config = self._config_manager.get_config()
        if config is None:
            _logger.error("[SignaKit] No config available")
            return None

        flag = next((f for f in config.flags if f.key == flag_key), None)
        if flag is None:
            _logger.warning("[SignaKit] Flag not found: %s", flag_key)
            return None

        result = evaluate_flag(flag, user_id, attributes)
        if result is None:
            return None

        return Decision(
            flag_key=flag.key,
            variation_key=result.variation_key,
            enabled=result.enabled,
            rule_key=result.rule_key,
            rule_type=result.rule_type,
            variables=result.variables,
        )

    def _evaluate_all_flags(
        self, user_id: str, attributes: UserAttributes
    ) -> Decisions:
        config = self._config_manager.get_config()
        if config is None:
            _logger.error("[SignaKit] No config available")
            return {}
        return evaluate_all_flags(config, user_id, attributes)

    def _get_bot_decisions(self) -> Decisions:
        config = self._config_manager.get_config()
        if config is None:
            return {}
        return {
            flag.key: Decision(
                flag_key=flag.key,
                variation_key="off",
                enabled=False,
                rule_key=None,
                rule_type=None,
                variables={},
            )
            for flag in config.flags
            if flag.status != "archived"
        }

    # ---- internal: events --------------------------------------------------

    def _event_headers(self) -> dict[str, str]:
        return {"Content-Type": "application/json", "X-SDK-Key": self._sdk_key}

    async def _send_event(self, event: dict[str, Any]) -> None:
        body = {"events": [event]}
        try:
            if self._async_client is not None:
                response = await self._async_client.post(
                    self._events_url, json=body, headers=self._event_headers()
                )
            else:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        self._events_url, json=body, headers=self._event_headers()
                    )
            if response.status_code >= 400:
                _logger.error(
                    "[SignaKit] Failed to send event: %s %s",
                    response.status_code,
                    response.reason_phrase,
                )
        except Exception:  # noqa: BLE001 — never break the app
            _logger.exception("[SignaKit] Failed to send event")

    def _send_event_sync(self, event: dict[str, Any]) -> None:
        body = {"events": [event]}
        try:
            if self._sync_client is not None:
                response = self._sync_client.post(
                    self._events_url, json=body, headers=self._event_headers()
                )
            else:
                with httpx.Client() as client:
                    response = client.post(
                        self._events_url, json=body, headers=self._event_headers()
                    )
            if response.status_code >= 400:
                _logger.error(
                    "[SignaKit] Failed to send event: %s %s",
                    response.status_code,
                    response.reason_phrase,
                )
        except Exception:  # noqa: BLE001
            _logger.exception("[SignaKit] Failed to send event")


def create_instance(sdk_key: str) -> SignaKitClient | None:
    """Create a :class:`SignaKitClient`. Returns ``None`` on failure."""
    try:
        return SignaKitClient(sdk_key=sdk_key)
    except Exception:  # noqa: BLE001
        _logger.exception("[SignaKit] Failed to create SignaKitClient")
        return None
