"""Evaluator tests covering archived, off, allowlist, audience, traffic, default."""

from __future__ import annotations

from signakit_flags.evaluator import evaluate_all_flags, evaluate_flag
from signakit_flags.types import (
    AllowlistEntry,
    AudienceCondition,
    ConfigFlag,
    ConfigRule,
    ConfigRuleAudience,
    ProjectConfig,
    Variation,
    VariationAllocation,
    VariationAllocationRange,
)


def _full_treatment_alloc() -> VariationAllocation:
    """All buckets → ``treatment``."""
    return VariationAllocation(
        ranges=[VariationAllocationRange(variation="treatment", start=0, end=9999)]
    )


def _full_off_alloc() -> VariationAllocation:
    return VariationAllocation(
        ranges=[VariationAllocationRange(variation="off", start=0, end=9999)]
    )


def _flag(
    *,
    status: str = "active",
    running: bool = True,
    rules: list[ConfigRule] | None = None,
    allocation: VariationAllocation | None = None,
) -> ConfigFlag:
    return ConfigFlag(
        id="f1",
        key="my-flag",
        variations=[
            Variation(key="off"),
            Variation(key="treatment"),
            Variation(key="control"),
        ],
        allocation=allocation or _full_treatment_alloc(),
        salt="my-flag-salt",
        status=status,  # type: ignore[arg-type]
        running=running,
        rules=rules,
    )


def test_archived_returns_none() -> None:
    flag = _flag(status="archived")
    assert evaluate_flag(flag, "alice") is None


def test_not_running_returns_off_disabled() -> None:
    flag = _flag(running=False)
    res = evaluate_flag(flag, "alice")
    assert res is not None
    assert res.variation_key == "off"
    assert res.enabled is False
    assert res.rule_key is None
    assert res.rule_type is None


def test_allowlist_short_circuits() -> None:
    rule = ConfigRule(
        rule_key="r1",
        rule_type="ab-test",
        traffic_percentage=0.0,  # zero traffic — but allowlist should win
        variation_allocation=_full_treatment_alloc(),
        allowlist=[AllowlistEntry(user_id="alice", variation="control")],
    )
    flag = _flag(rules=[rule])
    res = evaluate_flag(flag, "alice")
    assert res is not None
    assert res.variation_key == "control"
    assert res.rule_key == "r1"
    assert res.rule_type == "ab-test"


def test_audience_mismatch_falls_through_to_default() -> None:
    rule = ConfigRule(
        rule_key="r1",
        rule_type="ab-test",
        traffic_percentage=100.0,
        variation_allocation=_full_treatment_alloc(),
        audience_match_type="all",
        audiences=[
            ConfigRuleAudience(
                conditions=[
                    AudienceCondition(attribute="plan", operator="equals", value="premium")
                ]
            )
        ],
    )
    flag = _flag(rules=[rule], allocation=_full_off_alloc())
    res = evaluate_flag(flag, "alice", {"plan": "free"})
    assert res is not None
    assert res.variation_key == "off"
    assert res.rule_key is None  # default allocation


def test_audience_match_uses_rule_allocation() -> None:
    rule = ConfigRule(
        rule_key="r1",
        rule_type="ab-test",
        traffic_percentage=100.0,
        variation_allocation=_full_treatment_alloc(),
        audience_match_type="all",
        audiences=[
            ConfigRuleAudience(
                conditions=[
                    AudienceCondition(attribute="plan", operator="equals", value="premium")
                ]
            )
        ],
    )
    flag = _flag(rules=[rule])
    res = evaluate_flag(flag, "alice", {"plan": "premium"})
    assert res is not None
    assert res.variation_key == "treatment"
    assert res.rule_key == "r1"
    assert res.rule_type == "ab-test"


def test_zero_traffic_falls_through_to_default() -> None:
    rule = ConfigRule(
        rule_key="r1",
        rule_type="ab-test",
        traffic_percentage=0.0,
        variation_allocation=_full_treatment_alloc(),
    )
    flag = _flag(rules=[rule], allocation=_full_off_alloc())
    res = evaluate_flag(flag, "alice")
    assert res is not None
    assert res.variation_key == "off"
    assert res.rule_key is None


def test_default_allocation_when_no_rules() -> None:
    flag = _flag(allocation=_full_treatment_alloc())
    res = evaluate_flag(flag, "alice")
    assert res is not None
    assert res.variation_key == "treatment"
    assert res.rule_key is None
    assert res.rule_type is None


def test_evaluate_all_flags_excludes_archived() -> None:
    flag_a = _flag()
    flag_b = ConfigFlag(
        id="f2",
        key="archived-flag",
        variations=[Variation(key="off")],
        allocation=_full_off_alloc(),
        salt="x",
        status="archived",
        running=True,
    )
    config = ProjectConfig(
        project_id="p",
        environment_key="development",
        sdk_key="sk_dev_o_p_x",
        version=1,
        flags=[flag_a, flag_b],
        generated_at="2026-01-01T00:00:00Z",
    )
    decisions = evaluate_all_flags(config, "alice")
    assert "my-flag" in decisions
    assert "archived-flag" not in decisions
