package signakit

import "github.com/signakit/flags-golang/internal/types"

// Environment is the deployment environment.
type Environment = types.Environment

// Environment values.
const (
	EnvironmentDevelopment = types.EnvironmentDevelopment
	EnvironmentProduction  = types.EnvironmentProduction
)

// RuleType identifies the kind of rule that produced a decision.
type RuleType = types.RuleType

// RuleType values.
const (
	RuleTypeABTest           = types.RuleTypeABTest
	RuleTypeMultiArmedBandit = types.RuleTypeMultiArmedBandit
	RuleTypeTargeted         = types.RuleTypeTargeted
)

// AudienceMatchType determines how multiple audiences combine.
type AudienceMatchType = types.AudienceMatchType

// AudienceMatchType values.
const (
	AudienceMatchAny = types.AudienceMatchAny
	AudienceMatchAll = types.AudienceMatchAll
)

// FlagStatus marks whether a flag is active or archived.
type FlagStatus = types.FlagStatus

// FlagStatus values.
const (
	FlagStatusActive   = types.FlagStatusActive
	FlagStatusArchived = types.FlagStatusArchived
)

// ConditionOperator is the comparison operator used in audience conditions.
type ConditionOperator = types.ConditionOperator

// ConditionOperator values.
const (
	OpEquals             = types.OpEquals
	OpNotEquals          = types.OpNotEquals
	OpGreaterThan        = types.OpGreaterThan
	OpLessThan           = types.OpLessThan
	OpGreaterThanOrEqual = types.OpGreaterThanOrEqual
	OpLessThanOrEqual    = types.OpLessThanOrEqual
	OpIn                 = types.OpIn
	OpNotIn              = types.OpNotIn
	OpContains           = types.OpContains
	OpNotContains        = types.OpNotContains
)

// UserAttributes is the set of attributes used for audience targeting and event
// enrichment. Values may be string, float64, bool, []string, or []any. The
// special key "$userAgent" is consumed by bot detection and stripped before
// targeting.
type UserAttributes = types.UserAttributes

// FlagVariable describes a flag-level variable definition.
type FlagVariable = types.FlagVariable

// Variation is a single named variation in a flag.
type Variation = types.Variation

// VariationAllocationRange defines a [Start, End] (inclusive) bucket range
// mapped to a variation key.
type VariationAllocationRange = types.VariationAllocationRange

// VariationAllocation holds a list of inclusive bucket ranges.
type VariationAllocation = types.VariationAllocation

// AudienceCondition is a single targeting condition.
type AudienceCondition = types.AudienceCondition

// ConfigRuleAudience is a group of conditions ANDed together.
type ConfigRuleAudience = types.ConfigRuleAudience

// AllowlistEntry pins a userId to a specific variation.
type AllowlistEntry = types.AllowlistEntry

// ConfigRule describes a single targeting rule on a flag.
type ConfigRule = types.ConfigRule

// ConfigFlag is a single flag in the project config.
type ConfigFlag = types.ConfigFlag

// ProjectConfig is the JSON document fetched from the CDN.
type ProjectConfig = types.ProjectConfig
