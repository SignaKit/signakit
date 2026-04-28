"""User context tests — covers targeted-rule exposure skipping and bot handling."""

from __future__ import annotations

from typing import Any

import pytest

from signakit_flags.client import SignaKitClient
from signakit_flags.config_manager import ConfigManager
from signakit_flags.types import (
    ConfigFlag,
    ConfigRule,
    ProjectConfig,
    Variation,
    VariationAllocation,
    VariationAllocationRange,
)
from signakit_flags.user_context import SignaKitUserContext


class _StubConfigManager(ConfigManager):
    """ConfigManager subclass that skips network and serves a static config."""

    def __init__(self, config: ProjectConfig) -> None:
        super().__init__(org_id="o", project_id="p", environment="development")
        self._config = config

    async def fetch_config(self) -> ProjectConfig:
        assert self._config is not None
        return self._config

    def fetch_config_sync(self) -> ProjectConfig:
        assert self._config is not None
        return self._config


def _all_treatment() -> VariationAllocation:
    return VariationAllocation(
        ranges=[VariationAllocationRange(variation="treatment", start=0, end=9999)]
    )


def _make_client(
    *, rule_type: str = "ab-test", with_rule: bool = True
) -> SignaKitClient:
    rules: list[ConfigRule] | None = None
    if with_rule:
        rules = [
            ConfigRule(
                rule_key="r1",
                rule_type=rule_type,  # type: ignore[arg-type]
                traffic_percentage=100.0,
                variation_allocation=_all_treatment(),
            )
        ]
    flag = ConfigFlag(
        id="f1",
        key="my-flag",
        variations=[Variation(key="off"), Variation(key="treatment")],
        allocation=_all_treatment(),
        salt="my-flag-salt",
        status="active",
        running=True,
        rules=rules,
    )
    config = ProjectConfig(
        project_id="p",
        environment_key="development",
        sdk_key="sk_dev_org_proj_xxxx",
        version=1,
        flags=[flag],
        generated_at="2026-01-01T00:00:00Z",
    )
    client = SignaKitClient(
        sdk_key="sk_dev_org_proj_xxxx",
        config_manager=_StubConfigManager(config),
    )
    ready = client.on_ready_sync()
    assert ready.success, ready.reason
    return client


def test_targeted_rule_skips_exposure(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _make_client(rule_type="targeted")
    sent: list[dict[str, Any]] = []

    async def fake_send(event: dict[str, Any]) -> None:
        sent.append(event)

    def fake_send_sync(event: dict[str, Any]) -> None:
        sent.append(event)

    monkeypatch.setattr(client, "_send_event", fake_send)
    monkeypatch.setattr(client, "_send_event_sync", fake_send_sync)

    ctx = client.create_user_context("alice")
    assert ctx is not None
    decision = ctx.decide("my-flag")
    assert decision is not None
    assert decision.rule_type == "targeted"
    assert decision.variation_key == "treatment"
    assert sent == [], "targeted-rule decisions must not produce exposure events"


def test_ab_test_rule_fires_exposure(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _make_client(rule_type="ab-test")
    sent: list[dict[str, Any]] = []

    def fake_send_sync(event: dict[str, Any]) -> None:
        sent.append(event)

    # Force the sync path (no running loop in the test) for deterministic capture.
    monkeypatch.setattr(client, "_send_event_sync", fake_send_sync)

    ctx = client.create_user_context("alice")
    assert ctx is not None
    decision = ctx.decide("my-flag")
    assert decision is not None
    assert decision.rule_type == "ab-test"
    assert len(sent) == 1
    event = sent[0]
    assert event["eventKey"] == "$exposure"
    assert event["userId"] == "alice"
    assert event["decisions"] == {"my-flag": "treatment"}
    assert event["metadata"]["flagKey"] == "my-flag"
    assert event["metadata"]["variationKey"] == "treatment"
    assert event["metadata"]["ruleKey"] == "r1"


def test_default_allocation_fires_exposure(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _make_client(with_rule=False)
    sent: list[dict[str, Any]] = []
    monkeypatch.setattr(client, "_send_event_sync", lambda e: sent.append(e))

    ctx = client.create_user_context("alice")
    assert ctx is not None
    decision = ctx.decide("my-flag")
    assert decision is not None
    assert decision.rule_type is None  # default allocation
    assert decision.rule_key is None
    assert len(sent) == 1  # default-allocation decisions still produce exposure


def test_bot_returns_off_and_skips_exposure(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _make_client(rule_type="ab-test")
    sent: list[dict[str, Any]] = []
    monkeypatch.setattr(client, "_send_event_sync", lambda e: sent.append(e))

    ctx = client.create_user_context(
        "alice", attributes={"$userAgent": "Mozilla/5.0 (compatible; Googlebot/2.1)"}
    )
    assert ctx is not None
    decision = ctx.decide("my-flag")
    assert decision is not None
    assert decision.variation_key == "off"
    assert decision.enabled is False
    assert sent == []

    decisions = ctx.decide_all()
    assert decisions["my-flag"].variation_key == "off"
    assert sent == []


def test_user_agent_stripped_from_attributes() -> None:
    client = _make_client(with_rule=False)
    ctx = client.create_user_context(
        "alice", attributes={"$userAgent": "real-user-agent", "plan": "premium"}
    )
    assert ctx is not None
    assert "$userAgent" not in ctx.attributes
    assert ctx.attributes["plan"] == "premium"


@pytest.mark.asyncio
async def test_track_event_sends_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _make_client(with_rule=False)
    sent: list[dict[str, Any]] = []

    async def fake_send(event: dict[str, Any]) -> None:
        sent.append(event)

    monkeypatch.setattr(client, "_send_event", fake_send)

    ctx = SignaKitUserContext(client, "alice", attributes={"plan": "premium"})
    ctx._cached_decisions["my-flag"] = "treatment"
    await ctx.track_event("purchase", value=99.99, metadata={"sku": "abc"})

    assert len(sent) == 1
    event = sent[0]
    assert event["eventKey"] == "purchase"
    assert event["userId"] == "alice"
    assert event["value"] == 99.99
    assert event["metadata"] == {"sku": "abc"}
    assert event["decisions"] == {"my-flag": "treatment"}
    assert event["attributes"] == {"plan": "premium"}


@pytest.mark.asyncio
async def test_track_event_skipped_for_bots(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _make_client(with_rule=False)
    sent: list[dict[str, Any]] = []

    async def fake_send(event: dict[str, Any]) -> None:
        sent.append(event)

    monkeypatch.setattr(client, "_send_event", fake_send)

    ctx = SignaKitUserContext(
        client, "bot-1", attributes={"$userAgent": "Googlebot/2.1"}
    )
    await ctx.track_event("purchase")
    assert sent == []
