"""Type definitions for the SignaKit Flags Python SDK."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, TypeAlias

# ---- Public scalar / value types --------------------------------------------

Environment: TypeAlias = Literal["development", "production"]
RuleType: TypeAlias = Literal["ab-test", "multi-armed-bandit", "targeted"]
AudienceMatchType: TypeAlias = Literal["any", "all"]
FlagStatus: TypeAlias = Literal["active", "archived"]
ConditionOperator: TypeAlias = Literal[
    "equals",
    "not_equals",
    "greater_than",
    "less_than",
    "greater_than_or_equals",
    "less_than_or_equals",
    "in",
    "not_in",
    "contains",
    "not_contains",
]

#: A variable value — string, number, bool, or a JSON object.
VariableValue: TypeAlias = str | int | float | bool | dict[str, Any]

#: User attribute value — supports the special ``$userAgent`` key for bot
#: detection. Mirrors ``UserAttributes`` from the Node.js SDK.
AttributeValue: TypeAlias = str | int | float | bool | list[str]
UserAttributes: TypeAlias = dict[str, AttributeValue]


# ---- Public decision dataclass ---------------------------------------------


@dataclass(frozen=True, slots=True)
class Decision:
    """The result of evaluating a feature flag for a user.

    Attributes:
        flag_key: Key of the evaluated flag.
        variation_key: Variation the user was bucketed into (``"off"`` if
            disabled or not in traffic).
        enabled: ``True`` when the variation is anything other than ``"off"``.
        rule_key: The rule that produced this decision, or ``None`` when the
            default allocation was used or the flag was disabled.
        rule_type: Type of the rule (``"ab-test"``, ``"multi-armed-bandit"``,
            ``"targeted"``) or ``None`` for default/disabled paths.
        variables: Resolved variable values for the chosen variation.
    """

    flag_key: str
    variation_key: str
    enabled: bool
    rule_key: str | None
    rule_type: RuleType | None
    variables: dict[str, VariableValue] = field(default_factory=dict)


Decisions: TypeAlias = dict[str, Decision]


# ---- Configuration dataclasses (parsed from CDN JSON) ----------------------


@dataclass(frozen=True, slots=True)
class FlagVariable:
    key: str
    type: Literal["string", "number", "boolean", "json"]
    default_value: VariableValue


@dataclass(frozen=True, slots=True)
class Variation:
    key: str
    variables: dict[str, VariableValue] | None = None


@dataclass(frozen=True, slots=True)
class VariationAllocationRange:
    variation: str
    start: int
    end: int


@dataclass(frozen=True, slots=True)
class VariationAllocation:
    ranges: list[VariationAllocationRange]


@dataclass(frozen=True, slots=True)
class AudienceCondition:
    attribute: str
    operator: ConditionOperator
    value: str | int | float | bool | list[str]


@dataclass(frozen=True, slots=True)
class ConfigRuleAudience:
    conditions: list[AudienceCondition]


@dataclass(frozen=True, slots=True)
class AllowlistEntry:
    user_id: str
    variation: str


@dataclass(frozen=True, slots=True)
class ConfigRule:
    rule_key: str
    rule_type: RuleType
    traffic_percentage: float
    variation_allocation: VariationAllocation
    audience_match_type: AudienceMatchType | None = None
    audiences: list[ConfigRuleAudience] | None = None
    allowlist: list[AllowlistEntry] | None = None
    event_keys: list[str] | None = None
    primary_event_key: str | None = None


@dataclass(frozen=True, slots=True)
class ConfigFlag:
    id: str
    key: str
    variations: list[Variation]
    allocation: VariationAllocation
    salt: str
    status: FlagStatus
    running: bool
    variables: list[FlagVariable] | None = None
    rules: list[ConfigRule] | None = None


@dataclass(frozen=True, slots=True)
class ProjectConfig:
    project_id: str
    environment_key: Environment
    sdk_key: str
    version: int
    flags: list[ConfigFlag]
    generated_at: str


# ---- Ready / event types ---------------------------------------------------


@dataclass(frozen=True, slots=True)
class OnReadyResult:
    success: bool
    reason: str | None = None


@dataclass(slots=True)
class TrackEventOptions:
    value: float | None = None
    metadata: dict[str, Any] | None = None
