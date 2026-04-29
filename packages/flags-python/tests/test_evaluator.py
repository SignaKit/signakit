"""Evaluator tests — mirrors the canonical test suite shared across all SDKs."""

from __future__ import annotations

from signakit_flags.evaluator import evaluate_all_flags, evaluate_flag
from signakit_flags.types import (
    AllowlistEntry,
    AudienceCondition,
    ConfigFlag,
    ConfigRule,
    ConfigRuleAudience,
    FlagVariable,
    ProjectConfig,
    Variation,
    VariationAllocation,
    VariationAllocationRange,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _alloc(*pairs: tuple[str, int, int]) -> VariationAllocation:
    """Build a VariationAllocation from (variation, start, end) tuples."""
    return VariationAllocation(
        ranges=[VariationAllocationRange(variation=v, start=s, end=e) for v, s, e in pairs]
    )


def _full(variation: str) -> VariationAllocation:
    return _alloc((variation, 0, 9999))


def make_flag(key: str, **overrides: object) -> ConfigFlag:
    """Build a minimal valid ConfigFlag. Defaults: active, running, all users → 'on'."""
    defaults: dict[str, object] = {
        "id": f"flag_{key}",
        "key": key,
        "status": "active",
        "running": True,
        "salt": f"{key}-salt",
        "variations": [Variation(key="off"), Variation(key="on")],
        "allocation": _full("on"),
        "rules": None,
        "variables": None,
    }
    defaults.update(overrides)
    return ConfigFlag(**defaults)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# Status / running checks
# ---------------------------------------------------------------------------


def test_archived_returns_none() -> None:
    flag = make_flag("archived", status="archived")
    assert evaluate_flag(flag, "user-1") is None


def test_not_running_returns_off_disabled() -> None:
    flag = make_flag("disabled", running=False)
    result = evaluate_flag(flag, "user-1")
    assert result is not None
    assert result.variation_key == "off"
    assert result.enabled is False
    assert result.rule_key is None
    assert result.rule_type is None


# ---------------------------------------------------------------------------
# Allowlist
# ---------------------------------------------------------------------------


def test_allowlist_returns_listed_variation() -> None:
    rule = ConfigRule(
        rule_key="rule-qa",
        rule_type="targeted",
        traffic_percentage=0.0,
        variation_allocation=_full("on"),
        allowlist=[
            AllowlistEntry(user_id="qa-user", variation="on"),
            AllowlistEntry(user_id="qa-off-user", variation="off"),
        ],
    )
    flag = make_flag("allowlist", allocation=_full("off"), rules=[rule])

    result = evaluate_flag(flag, "qa-user")
    assert result is not None
    assert result.variation_key == "on"
    assert result.enabled is True
    assert result.rule_key == "rule-qa"
    assert result.rule_type == "targeted"


def test_allowlist_off_variation_returns_enabled_false() -> None:
    rule = ConfigRule(
        rule_key="rule-qa",
        rule_type="targeted",
        traffic_percentage=0.0,
        variation_allocation=_full("on"),
        allowlist=[AllowlistEntry(user_id="qa-off-user", variation="off")],
    )
    flag = make_flag("allowlist", allocation=_full("off"), rules=[rule])

    result = evaluate_flag(flag, "qa-off-user")
    assert result is not None
    assert result.variation_key == "off"
    assert result.enabled is False
    assert result.rule_key == "rule-qa"


def test_non_allowlisted_user_falls_through_to_default() -> None:
    rule = ConfigRule(
        rule_key="rule-qa",
        rule_type="targeted",
        traffic_percentage=0.0,
        variation_allocation=_full("on"),
        allowlist=[AllowlistEntry(user_id="qa-user", variation="on")],
    )
    flag = make_flag("allowlist", allocation=_full("off"), rules=[rule])

    # trafficPercentage=0 → no traffic match; default allocation returns 'off'
    result = evaluate_flag(flag, "random-user")
    assert result is not None
    assert result.variation_key == "off"
    assert result.rule_key is None


# ---------------------------------------------------------------------------
# Traffic allocation
# ---------------------------------------------------------------------------


def test_places_all_users_in_traffic_when_percentage_is_100() -> None:
    rule = ConfigRule(
        rule_key="rule-all",
        rule_type="ab-test",
        traffic_percentage=100.0,
        variation_allocation=_full("on"),
    )
    flag = make_flag("full-traffic", rules=[rule])

    result = evaluate_flag(flag, "any-user")
    assert result is not None
    assert result.variation_key == "on"
    assert result.rule_key == "rule-all"


def test_places_no_users_in_traffic_when_percentage_is_0() -> None:
    rule = ConfigRule(
        rule_key="rule-none",
        rule_type="ab-test",
        traffic_percentage=0.0,
        variation_allocation=_full("on"),
    )
    flag = make_flag("zero-traffic", allocation=_full("off"), rules=[rule])

    result = evaluate_flag(flag, "any-user")
    assert result is not None
    assert result.variation_key == "off"
    assert result.rule_key is None


# ---------------------------------------------------------------------------
# Audience targeting
# ---------------------------------------------------------------------------


def test_matches_rule_for_user_whose_attributes_satisfy_the_audience() -> None:
    rule = ConfigRule(
        rule_key="rule-premium",
        rule_type="ab-test",
        audience_match_type="any",
        audiences=[
            ConfigRuleAudience(
                conditions=[AudienceCondition(attribute="plan", operator="equals", value="premium")]
            )
        ],
        traffic_percentage=100.0,
        variation_allocation=_full("on"),
    )
    flag = make_flag("targeted", allocation=_full("off"), rules=[rule])

    result = evaluate_flag(flag, "premium-user", {"plan": "premium"})
    assert result is not None
    assert result.variation_key == "on"
    assert result.rule_key == "rule-premium"


def test_falls_through_to_default_for_user_who_does_not_match_audience() -> None:
    rule = ConfigRule(
        rule_key="rule-premium",
        rule_type="ab-test",
        audience_match_type="any",
        audiences=[
            ConfigRuleAudience(
                conditions=[AudienceCondition(attribute="plan", operator="equals", value="premium")]
            )
        ],
        traffic_percentage=100.0,
        variation_allocation=_full("on"),
    )
    flag = make_flag("targeted", allocation=_full("off"), rules=[rule])

    result = evaluate_flag(flag, "free-user", {"plan": "free"})
    assert result is not None
    assert result.variation_key == "off"
    assert result.rule_key is None


def test_falls_through_to_default_when_user_has_no_attributes() -> None:
    rule = ConfigRule(
        rule_key="rule-premium",
        rule_type="ab-test",
        audience_match_type="any",
        audiences=[
            ConfigRuleAudience(
                conditions=[AudienceCondition(attribute="plan", operator="equals", value="premium")]
            )
        ],
        traffic_percentage=100.0,
        variation_allocation=_full("on"),
    )
    flag = make_flag("targeted", allocation=_full("off"), rules=[rule])

    result = evaluate_flag(flag, "attr-less-user")
    assert result is not None
    assert result.variation_key == "off"
    assert result.rule_key is None


# ---------------------------------------------------------------------------
# Default allocation
# ---------------------------------------------------------------------------


def test_uses_default_allocation_when_no_rules_exist() -> None:
    flag = make_flag("no-rules", allocation=_full("on"))

    result = evaluate_flag(flag, "user-1")
    assert result is not None
    assert result.variation_key == "on"
    assert result.enabled is True
    assert result.rule_key is None
    assert result.rule_type is None


def test_returns_off_fallback_when_default_allocation_ranges_are_empty() -> None:
    flag = make_flag("empty-alloc", allocation=VariationAllocation(ranges=[]))

    result = evaluate_flag(flag, "user-1")
    assert result is not None
    assert result.variation_key == "off"
    assert result.enabled is False


# ---------------------------------------------------------------------------
# Variable resolution
# ---------------------------------------------------------------------------


def test_returns_all_default_variables_for_variation_with_no_overrides() -> None:
    flag = ConfigFlag(
        id="flag_vars",
        key="vars-flag",
        status="active",
        running=True,
        salt="vars-salt",
        variations=[
            Variation(key="off"),
            Variation(key="v1"),  # inherits all defaults
            Variation(key="v2", variables={"color": "blue", "count": 5}),
        ],
        variables=[
            FlagVariable(key="color", type="string", default_value="red"),
            FlagVariable(key="count", type="number", default_value=1),
            FlagVariable(key="enabled", type="boolean", default_value=True),
        ],
        allocation=_full("v1"),
    )

    result = evaluate_flag(flag, "user-1")
    assert result is not None
    assert result.variation_key == "v1"
    assert result.variables == {"color": "red", "count": 1, "enabled": True}


def test_merges_variation_overrides_with_flag_level_defaults() -> None:
    flag = ConfigFlag(
        id="flag_vars",
        key="vars-flag",
        status="active",
        running=True,
        salt="vars-salt",
        variations=[
            Variation(key="off"),
            Variation(key="v2", variables={"color": "blue", "count": 5}),
        ],
        variables=[
            FlagVariable(key="color", type="string", default_value="red"),
            FlagVariable(key="count", type="number", default_value=1),
            FlagVariable(key="enabled", type="boolean", default_value=True),
        ],
        allocation=_full("v2"),
    )

    result = evaluate_flag(flag, "user-1")
    assert result is not None
    assert result.variation_key == "v2"
    # color and count come from variation overrides; enabled comes from default
    assert result.variables == {"color": "blue", "count": 5, "enabled": True}


def test_returns_empty_variables_when_flag_has_none_defined() -> None:
    flag = make_flag("no-vars", allocation=_full("on"))

    result = evaluate_flag(flag, "user-1")
    assert result is not None
    assert result.variables == {}


# ---------------------------------------------------------------------------
# Determinism
# ---------------------------------------------------------------------------


def test_always_assigns_the_same_variation_to_the_same_user() -> None:
    flag = make_flag(
        "determinism",
        allocation=_alloc(("off", 0, 4999), ("on", 5000, 9999)),
    )
    results = [evaluate_flag(flag, "user-stable") for _ in range(10)]
    variation_keys = {r.variation_key for r in results if r is not None}
    # All 10 evaluations must produce the same variation
    assert len(variation_keys) == 1


# ---------------------------------------------------------------------------
# evaluate_all_flags
# ---------------------------------------------------------------------------


def _make_config(*flags: ConfigFlag) -> ProjectConfig:
    return ProjectConfig(
        project_id="p1",
        environment_key="development",
        sdk_key="sk_dev_org1_p1_xxx",
        version=1,
        flags=list(flags),
        generated_at="2024-01-01T00:00:00.000Z",
    )


def test_evaluate_all_flags_returns_decisions_for_non_archived_flags() -> None:
    config = _make_config(
        make_flag("active-a"),
        make_flag("active-b"),
        make_flag("archived-c", status="archived"),
    )

    decisions = evaluate_all_flags(config, "user-1")
    assert len(decisions) == 2
    assert "active-a" in decisions
    assert "active-b" in decisions
    assert "archived-c" not in decisions


def test_evaluate_all_flags_includes_flag_key_on_each_decision() -> None:
    config = _make_config(make_flag("active-a"), make_flag("active-b"))

    decisions = evaluate_all_flags(config, "user-1")
    assert decisions["active-a"].flag_key == "active-a"
    assert decisions["active-b"].flag_key == "active-b"
