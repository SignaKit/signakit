"""Audience matching for evaluating user attributes against rule conditions."""

from __future__ import annotations

import logging

from .types import (
    AudienceCondition,
    AudienceMatchType,
    ConfigRuleAudience,
    UserAttributes,
)

_logger = logging.getLogger(__name__)


def matches_condition(
    condition: AudienceCondition, attributes: UserAttributes | None
) -> bool:
    """Return ``True`` if a single condition matches the given attributes."""
    if attributes is None:
        return False

    if condition.attribute not in attributes:
        return False

    user_value = attributes[condition.attribute]
    op = condition.operator
    value = condition.value

    # Treat bool specially: in Python, bool is a subclass of int, so we must
    # avoid accidentally matching it under numeric comparisons.
    if op == "equals":
        return user_value == value
    if op == "not_equals":
        return user_value != value

    if op in ("greater_than", "less_than", "greater_than_or_equals", "less_than_or_equals"):
        if (
            isinstance(user_value, (int, float))
            and not isinstance(user_value, bool)
            and isinstance(value, (int, float))
            and not isinstance(value, bool)
        ):
            if op == "greater_than":
                return user_value > value
            if op == "less_than":
                return user_value < value
            if op == "greater_than_or_equals":
                return user_value >= value
            return user_value <= value
        return False

    if op == "in":
        if isinstance(value, list):
            return user_value in value
        return False

    if op == "not_in":
        if isinstance(value, list):
            return user_value not in value
        return True

    if op == "contains":
        if isinstance(user_value, str) and isinstance(value, str):
            return value in user_value
        if isinstance(user_value, list) and isinstance(value, str):
            return value in user_value
        return False

    if op == "not_contains":
        if isinstance(user_value, str) and isinstance(value, str):
            return value not in user_value
        if isinstance(user_value, list) and isinstance(value, str):
            return value not in user_value
        return True

    _logger.warning("[SignaKit] Unknown operator: %s", op)
    return False


def matches_audience(
    audience: ConfigRuleAudience, attributes: UserAttributes | None
) -> bool:
    """All conditions must match for an audience to match."""
    return all(matches_condition(c, attributes) for c in audience.conditions)


def matches_audiences(
    audiences: list[ConfigRuleAudience] | None,
    match_type: AudienceMatchType | None,
    attributes: UserAttributes | None,
) -> bool:
    """Evaluate multiple audiences with ``any``/``all`` semantics.

    No audiences ⇒ rule matches all users (parity with the JS SDK).
    """
    if not audiences:
        return True

    if match_type == "any":
        return any(matches_audience(a, attributes) for a in audiences)
    return all(matches_audience(a, attributes) for a in audiences)
