"""Flag evaluation logic, mirroring ``packages/flags-node/src/evaluator.ts``."""

from __future__ import annotations

from dataclasses import dataclass

from .audience_matcher import matches_audiences
from .constants import BUCKET_SPACE
from .hasher import hash_for_default, hash_for_traffic, hash_for_variation
from .types import (
    ConfigFlag,
    Decision,
    Decisions,
    ProjectConfig,
    RuleType,
    UserAttributes,
    VariableValue,
    VariationAllocation,
)


@dataclass(frozen=True, slots=True)
class EvaluationResult:
    variation_key: str
    enabled: bool
    rule_key: str | None
    rule_type: RuleType | None
    variables: dict[str, VariableValue]


def _find_variation_in_ranges(
    allocation: VariationAllocation, bucket: int
) -> str | None:
    """Range is inclusive of both ``start`` and ``end``."""
    for r in allocation.ranges:
        if r.start <= bucket <= r.end:
            return r.variation
    return None


def _resolve_variables(
    flag: ConfigFlag, variation_key: str
) -> dict[str, VariableValue]:
    """Merge flag-level defaults with variation-specific overrides."""
    if not flag.variables:
        return {}

    variation = next((v for v in flag.variations if v.key == variation_key), None)
    overrides = variation.variables if variation and variation.variables else {}

    resolved: dict[str, VariableValue] = {}
    for definition in flag.variables:
        if definition.key in overrides:
            resolved[definition.key] = overrides[definition.key]
        else:
            resolved[definition.key] = definition.default_value
    return resolved


def evaluate_flag(
    flag: ConfigFlag,
    user_id: str,
    attributes: UserAttributes | None = None,
) -> EvaluationResult | None:
    """Evaluate a single flag for a user.

    Returns ``None`` if the flag is archived (excluded from results).
    """
    # 1. Archived → skip
    if flag.status == "archived":
        return None

    # 2. Not running → disabled "off" decision
    if not flag.running:
        return EvaluationResult(
            variation_key="off",
            enabled=False,
            rule_key=None,
            rule_type=None,
            variables=_resolve_variables(flag, "off"),
        )

    # 3. Evaluate rules in order — first match wins
    for rule in flag.rules or []:
        # 3a. Allowlist check — exact userId match returns immediately
        if rule.allowlist:
            entry = next((e for e in rule.allowlist if e.user_id == user_id), None)
            if entry is not None:
                return EvaluationResult(
                    variation_key=entry.variation,
                    enabled=entry.variation != "off",
                    rule_key=rule.rule_key,
                    rule_type=rule.rule_type,
                    variables=_resolve_variables(flag, entry.variation),
                )

        # 3b. Audience match
        if not matches_audiences(rule.audiences, rule.audience_match_type, attributes):
            continue

        # 3c. Traffic allocation — trafficPercentage is 0-100
        traffic_bucket = hash_for_traffic(flag.salt, user_id)
        traffic_threshold = int((rule.traffic_percentage / 100) * BUCKET_SPACE)
        if traffic_bucket >= traffic_threshold:
            continue

        # 3d. Variation bucket via allocation ranges
        variation_bucket = hash_for_variation(flag.salt, user_id)
        variation = _find_variation_in_ranges(rule.variation_allocation, variation_bucket)
        if variation is None:
            continue

        return EvaluationResult(
            variation_key=variation,
            enabled=variation != "off",
            rule_key=rule.rule_key,
            rule_type=rule.rule_type,
            variables=_resolve_variables(flag, variation),
        )

    # 4. No rule matched → default allocation
    default_bucket = hash_for_default(flag.salt, user_id)
    default_variation = _find_variation_in_ranges(flag.allocation, default_bucket)

    if default_variation is not None:
        return EvaluationResult(
            variation_key=default_variation,
            enabled=default_variation != "off",
            rule_key=None,
            rule_type=None,
            variables=_resolve_variables(flag, default_variation),
        )

    # Fallback — shouldn't happen in well-formed configs
    return EvaluationResult(
        variation_key="off",
        enabled=False,
        rule_key=None,
        rule_type=None,
        variables=_resolve_variables(flag, "off"),
    )


def evaluate_all_flags(
    config: ProjectConfig,
    user_id: str,
    attributes: UserAttributes | None = None,
) -> Decisions:
    """Evaluate every non-archived flag in the config for the given user."""
    decisions: Decisions = {}
    for flag in config.flags:
        result = evaluate_flag(flag, user_id, attributes)
        if result is None:
            continue
        decisions[flag.key] = Decision(
            flag_key=flag.key,
            variation_key=result.variation_key,
            enabled=result.enabled,
            rule_key=result.rule_key,
            rule_type=result.rule_type,
            variables=result.variables,
        )
    return decisions
