"""Audience matcher tests."""

from __future__ import annotations

from signakit_flags.audience_matcher import (
    matches_audience,
    matches_audiences,
    matches_condition,
)
from signakit_flags.types import AudienceCondition, ConfigRuleAudience


def cond(attr: str, op: str, value: object) -> AudienceCondition:
    return AudienceCondition(attribute=attr, operator=op, value=value)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# matchesCondition — equals / not_equals
# ---------------------------------------------------------------------------


def test_equals_matches_identical_string_values() -> None:
    assert matches_condition(cond("plan", "equals", "premium"), {"plan": "premium"})


def test_equals_rejects_different_string_values() -> None:
    assert not matches_condition(cond("plan", "equals", "premium"), {"plan": "free"})


def test_equals_matches_boolean_values() -> None:
    assert matches_condition(cond("verified", "equals", True), {"verified": True})
    assert not matches_condition(cond("verified", "equals", True), {"verified": False})


def test_not_equals_matches_when_values_differ() -> None:
    assert matches_condition(cond("plan", "not_equals", "premium"), {"plan": "free"})
    assert not matches_condition(cond("plan", "not_equals", "premium"), {"plan": "premium"})


def test_returns_false_when_attribute_is_missing() -> None:
    assert not matches_condition(cond("plan", "equals", "premium"), {})
    assert not matches_condition(cond("plan", "equals", "premium"), None)


# ---------------------------------------------------------------------------
# matchesCondition — numeric comparisons
# ---------------------------------------------------------------------------


def test_greater_than_true_when_user_value_exceeds_threshold() -> None:
    c = cond("age", "greater_than", 18)
    assert matches_condition(c, {"age": 25})
    assert not matches_condition(c, {"age": 18})
    assert not matches_condition(c, {"age": 10})


def test_less_than_true_when_user_value_is_below_threshold() -> None:
    c = cond("age", "less_than", 18)
    assert matches_condition(c, {"age": 10})
    assert not matches_condition(c, {"age": 18})
    assert not matches_condition(c, {"age": 25})


def test_greater_than_or_equals_inclusive() -> None:
    c = cond("age", "greater_than_or_equals", 18)
    assert matches_condition(c, {"age": 18})
    assert not matches_condition(c, {"age": 17})


def test_less_than_or_equals_inclusive() -> None:
    c = cond("age", "less_than_or_equals", 18)
    assert matches_condition(c, {"age": 18})
    assert not matches_condition(c, {"age": 19})


def test_numeric_operators_return_false_on_string_attribute_values() -> None:
    # type mismatch (string where number expected) → False
    assert not matches_condition(cond("age", "greater_than", 18), {"age": "25"})  # type: ignore[dict-item]


# ---------------------------------------------------------------------------
# matchesCondition — in / not_in
# ---------------------------------------------------------------------------


def test_in_true_when_user_value_is_in_the_list() -> None:
    c = cond("country", "in", ["US", "CA", "GB"])
    assert matches_condition(c, {"country": "US"})
    assert not matches_condition(c, {"country": "DE"})


def test_in_false_when_value_is_not_a_list() -> None:
    c = cond("country", "in", "US")  # type: ignore[arg-type]
    assert not matches_condition(c, {"country": "US"})


def test_not_in_true_when_user_value_is_absent_from_the_list() -> None:
    c = cond("country", "not_in", ["US", "CA"])
    assert matches_condition(c, {"country": "DE"})
    assert not matches_condition(c, {"country": "US"})


def test_not_in_true_when_value_is_not_a_list_vacuously() -> None:
    # Python: non-list value → vacuously True (mirrors JS SDK behaviour)
    c = cond("country", "not_in", "US")  # type: ignore[arg-type]
    assert matches_condition(c, {"country": "US"})


# ---------------------------------------------------------------------------
# matchesCondition — contains / not_contains
# ---------------------------------------------------------------------------


def test_contains_true_when_string_includes_substring() -> None:
    c = cond("email", "contains", "@acme")
    assert matches_condition(c, {"email": "bob@acme.com"})
    assert not matches_condition(c, {"email": "bob@gmail.com"})


def test_contains_true_when_string_array_includes_value() -> None:
    c = cond("tags", "contains", "beta")
    assert matches_condition(c, {"tags": ["alpha", "beta", "gamma"]})  # type: ignore[dict-item]
    assert not matches_condition(c, {"tags": ["alpha", "gamma"]})  # type: ignore[dict-item]


def test_not_contains_true_when_string_does_not_include_substring() -> None:
    c = cond("email", "not_contains", "@acme")
    assert matches_condition(c, {"email": "bob@gmail.com"})
    assert not matches_condition(c, {"email": "bob@acme.com"})


def test_not_contains_true_when_array_does_not_include_value() -> None:
    c = cond("tags", "not_contains", "beta")
    assert matches_condition(c, {"tags": ["alpha", "gamma"]})  # type: ignore[dict-item]
    assert not matches_condition(c, {"tags": ["alpha", "beta"]})  # type: ignore[dict-item]


def test_not_contains_true_when_types_do_not_match_vacuously() -> None:
    # Python: numeric attribute with string needle → vacuously True (mirrors JS SDK)
    c = cond("score", "not_contains", "high")
    assert matches_condition(c, {"score": 42})  # type: ignore[dict-item]


# ---------------------------------------------------------------------------
# matches_audience
# ---------------------------------------------------------------------------


def test_matches_audience_returns_true_when_all_conditions_match() -> None:
    audience = ConfigRuleAudience(
        conditions=[
            cond("plan", "equals", "premium"),
            cond("age", "greater_than_or_equals", 18),
        ]
    )
    assert matches_audience(audience, {"plan": "premium", "age": 25})


def test_matches_audience_returns_false_when_any_condition_fails() -> None:
    audience = ConfigRuleAudience(
        conditions=[
            cond("plan", "equals", "premium"),
            cond("age", "greater_than_or_equals", 18),
        ]
    )
    assert not matches_audience(audience, {"plan": "premium", "age": 16})


def test_matches_audience_returns_true_for_empty_conditions() -> None:
    audience = ConfigRuleAudience(conditions=[])
    assert matches_audience(audience, {})


# ---------------------------------------------------------------------------
# matches_audiences
# ---------------------------------------------------------------------------


def test_matches_audiences_returns_true_when_audiences_are_none_or_empty() -> None:
    assert matches_audiences(None, "any", {})
    assert matches_audiences([], "any", {})
    assert matches_audiences([], "all", {"plan": "premium"})


def test_any_returns_true_when_at_least_one_audience_matches() -> None:
    audiences = [
        ConfigRuleAudience(conditions=[cond("plan", "equals", "premium")]),
        ConfigRuleAudience(conditions=[cond("plan", "equals", "enterprise")]),
    ]
    assert matches_audiences(audiences, "any", {"plan": "premium"})
    assert not matches_audiences(audiences, "any", {"plan": "free"})


def test_all_returns_true_only_when_every_audience_matches() -> None:
    audiences = [
        ConfigRuleAudience(conditions=[cond("plan", "equals", "premium")]),
        ConfigRuleAudience(conditions=[cond("verified", "equals", True)]),
    ]
    assert matches_audiences(audiences, "all", {"plan": "premium", "verified": True})
    assert not matches_audiences(audiences, "all", {"plan": "premium", "verified": False})


def test_defaults_to_all_logic_when_match_type_is_none() -> None:
    audiences = [
        ConfigRuleAudience(conditions=[cond("plan", "equals", "premium")]),
        ConfigRuleAudience(conditions=[cond("verified", "equals", True)]),
    ]
    assert matches_audiences(audiences, None, {"plan": "premium", "verified": True})
    assert not matches_audiences(audiences, None, {"plan": "premium", "verified": False})
