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


def test_equals_and_not_equals() -> None:
    assert matches_condition(cond("plan", "equals", "premium"), {"plan": "premium"})
    assert not matches_condition(cond("plan", "equals", "premium"), {"plan": "free"})
    assert matches_condition(cond("plan", "not_equals", "free"), {"plan": "premium"})


def test_numeric_operators() -> None:
    attrs = {"age": 30}
    assert matches_condition(cond("age", "greater_than", 25), attrs)
    assert not matches_condition(cond("age", "greater_than", 35), attrs)
    assert matches_condition(cond("age", "greater_than_or_equals", 30), attrs)
    assert matches_condition(cond("age", "less_than", 31), attrs)
    assert matches_condition(cond("age", "less_than_or_equals", 30), attrs)
    # type mismatch returns False
    assert not matches_condition(cond("age", "greater_than", "25"), attrs)


def test_in_not_in() -> None:
    attrs = {"country": "US"}
    assert matches_condition(cond("country", "in", ["US", "CA"]), attrs)
    assert not matches_condition(cond("country", "in", ["UK", "FR"]), attrs)
    assert matches_condition(cond("country", "not_in", ["UK"]), attrs)


def test_contains_string_and_array() -> None:
    assert matches_condition(cond("email", "contains", "@example"), {"email": "a@example.com"})
    assert matches_condition(cond("tags", "contains", "beta"), {"tags": ["beta", "vip"]})
    assert matches_condition(cond("email", "not_contains", "z"), {"email": "a@example.com"})


def test_missing_attribute_does_not_match() -> None:
    assert not matches_condition(cond("plan", "equals", "premium"), {})
    assert not matches_condition(cond("plan", "equals", "premium"), None)


def test_audience_all_conditions_must_match() -> None:
    audience = ConfigRuleAudience(
        conditions=[
            cond("plan", "equals", "premium"),
            cond("country", "in", ["US"]),
        ]
    )
    assert matches_audience(audience, {"plan": "premium", "country": "US"})
    assert not matches_audience(audience, {"plan": "premium", "country": "UK"})


def test_audiences_any_all_and_empty() -> None:
    a1 = ConfigRuleAudience(conditions=[cond("plan", "equals", "premium")])
    a2 = ConfigRuleAudience(conditions=[cond("country", "equals", "US")])

    # any
    assert matches_audiences([a1, a2], "any", {"plan": "free", "country": "US"})
    assert not matches_audiences([a1, a2], "any", {"plan": "free", "country": "UK"})
    # all
    assert matches_audiences([a1, a2], "all", {"plan": "premium", "country": "US"})
    assert not matches_audiences([a1, a2], "all", {"plan": "premium", "country": "UK"})
    # empty audiences ⇒ matches everyone
    assert matches_audiences(None, "any", None)
    assert matches_audiences([], "all", {"plan": "premium"})
