package signakit

// Decision is the result of evaluating a single flag for a user.
type Decision struct {
	FlagKey      string         `json:"flagKey"`
	VariationKey string         `json:"variationKey"`
	Enabled      bool           `json:"enabled"`
	RuleKey      *string        `json:"ruleKey"`
	// RuleType is nil when the default allocation was used or the flag was
	// disabled; otherwise it carries the rule's type.
	RuleType  *RuleType      `json:"ruleType"`
	Variables map[string]any `json:"variables"`
}

// Decisions is a flagKey -> Decision map (matches flags-node SignaKitDecisions).
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
