// Package types holds the shared data types used by both the public signakit
// package and the internal implementation packages. Keeping types here breaks
// the import cycle that would otherwise arise because signakit imports the
// internal packages, which need to reference the same types.
package types

// Environment is the deployment environment.
type Environment string

// Environment values.
const (
	EnvironmentDevelopment Environment = "development"
	EnvironmentProduction  Environment = "production"
)

// RuleType identifies the kind of rule that produced a decision.
type RuleType string

// RuleType values.
const (
	RuleTypeABTest           RuleType = "ab-test"
	RuleTypeMultiArmedBandit RuleType = "multi-armed-bandit"
	RuleTypeTargeted         RuleType = "targeted"
)

// AudienceMatchType determines how multiple audiences combine.
type AudienceMatchType string

// AudienceMatchType values.
const (
	AudienceMatchAny AudienceMatchType = "any"
	AudienceMatchAll AudienceMatchType = "all"
)

// FlagStatus marks whether a flag is active or archived.
type FlagStatus string

// FlagStatus values.
const (
	FlagStatusActive   FlagStatus = "active"
	FlagStatusArchived FlagStatus = "archived"
)

// ConditionOperator is the comparison operator used in audience conditions.
type ConditionOperator string

// ConditionOperator values.
const (
	OpEquals             ConditionOperator = "equals"
	OpNotEquals          ConditionOperator = "not_equals"
	OpGreaterThan        ConditionOperator = "greater_than"
	OpLessThan           ConditionOperator = "less_than"
	OpGreaterThanOrEqual ConditionOperator = "greater_than_or_equals"
	OpLessThanOrEqual    ConditionOperator = "less_than_or_equals"
	OpIn                 ConditionOperator = "in"
	OpNotIn              ConditionOperator = "not_in"
	OpContains           ConditionOperator = "contains"
	OpNotContains        ConditionOperator = "not_contains"
)

// UserAttributes is the set of attributes used for audience targeting and event
// enrichment. Values may be string, float64, bool, []string, or []any. The
// special key "$userAgent" is consumed by bot detection and stripped before
// targeting.
type UserAttributes map[string]any

// FlagVariable describes a flag-level variable definition.
type FlagVariable struct {
	Key          string `json:"key"`
	Type         string `json:"type"` // "string" | "number" | "boolean" | "json"
	DefaultValue any    `json:"defaultValue"`
}

// Variation is a single named variation in a flag.
type Variation struct {
	Key       string         `json:"key"`
	Variables map[string]any `json:"variables,omitempty"`
}

// VariationAllocationRange defines a [Start, End] (inclusive) bucket range
// mapped to a variation key.
type VariationAllocationRange struct {
	Variation string `json:"variation"`
	Start     int    `json:"start"`
	End       int    `json:"end"`
}

// VariationAllocation holds a list of inclusive bucket ranges.
type VariationAllocation struct {
	Ranges []VariationAllocationRange `json:"ranges"`
}

// AudienceCondition is a single targeting condition.
type AudienceCondition struct {
	Attribute string            `json:"attribute"`
	Operator  ConditionOperator `json:"operator"`
	Value     any               `json:"value"`
}

// ConfigRuleAudience is a group of conditions ANDed together.
type ConfigRuleAudience struct {
	Conditions []AudienceCondition `json:"conditions"`
}

// AllowlistEntry pins a userId to a specific variation.
type AllowlistEntry struct {
	UserID    string `json:"userId"`
	Variation string `json:"variation"`
}

// ConfigRule describes a single targeting rule on a flag.
type ConfigRule struct {
	RuleKey             string               `json:"ruleKey"`
	RuleType            RuleType             `json:"ruleType"`
	AudienceMatchType   AudienceMatchType    `json:"audienceMatchType,omitempty"`
	Audiences           []ConfigRuleAudience `json:"audiences,omitempty"`
	TrafficPercentage   float64              `json:"trafficPercentage"`
	VariationAllocation VariationAllocation  `json:"variationAllocation"`
	Allowlist           []AllowlistEntry     `json:"allowlist,omitempty"`
	EventKeys           []string             `json:"eventKeys,omitempty"`
	PrimaryEventKey     string               `json:"primaryEventKey,omitempty"`
}

// ConfigFlag is a single flag in the project config.
type ConfigFlag struct {
	ID         string              `json:"id"`
	Key        string              `json:"key"`
	Variations []Variation         `json:"variations"`
	Variables  []FlagVariable      `json:"variables,omitempty"`
	Allocation VariationAllocation `json:"allocation"`
	Salt       string              `json:"salt"`
	Status     FlagStatus          `json:"status"`
	Running    bool                `json:"running"`
	Rules      []ConfigRule        `json:"rules,omitempty"`
}

// ProjectConfig is the JSON document fetched from the CDN.
type ProjectConfig struct {
	ProjectID      string       `json:"projectId"`
	EnvironmentKey Environment  `json:"environmentKey"`
	SDKKey         string       `json:"sdkKey"`
	Version        int          `json:"version"`
	Flags          []ConfigFlag `json:"flags"`
	GeneratedAt    string       `json:"generatedAt"`
}

// Decision is the result of evaluating a single flag for a user.
type Decision struct {
	FlagKey      string         `json:"flagKey"`
	VariationKey string         `json:"variationKey"`
	Enabled      bool           `json:"enabled"`
	RuleKey      *string        `json:"ruleKey"`
	RuleType     *RuleType      `json:"ruleType"`
	Variables    map[string]any `json:"variables"`
}

// Decisions is a flagKey -> Decision map.
type Decisions map[string]Decision

// Event is the wire shape posted to the events API.
type Event struct {
	EventKey   string            `json:"eventKey"`
	UserID     string            `json:"userId"`
	Timestamp  string            `json:"timestamp"`
	Attributes UserAttributes    `json:"attributes,omitempty"`
	Decisions  map[string]string `json:"decisions,omitempty"`
	Value      *float64          `json:"value,omitempty"`
	Metadata   map[string]any    `json:"metadata,omitempty"`
}
