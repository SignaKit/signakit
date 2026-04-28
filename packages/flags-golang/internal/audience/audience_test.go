package audience

import (
	"testing"

	"github.com/signakit/flags-golang/signakit"
)

func TestMatchesCondition(t *testing.T) {
	t.Parallel()

	attrs := signakit.UserAttributes{
		"plan":    "premium",
		"age":     float64(30),
		"country": "US",
		"tags":    []string{"vip", "early-adopter"},
	}

	tests := []struct {
		name string
		cond signakit.AudienceCondition
		want bool
	}{
		{"equals match", signakit.AudienceCondition{Attribute: "plan", Operator: signakit.OpEquals, Value: "premium"}, true},
		{"equals miss", signakit.AudienceCondition{Attribute: "plan", Operator: signakit.OpEquals, Value: "free"}, false},
		{"not_equals match", signakit.AudienceCondition{Attribute: "plan", Operator: signakit.OpNotEquals, Value: "free"}, true},
		{"gt", signakit.AudienceCondition{Attribute: "age", Operator: signakit.OpGreaterThan, Value: float64(18)}, true},
		{"lt", signakit.AudienceCondition{Attribute: "age", Operator: signakit.OpLessThan, Value: float64(18)}, false},
		{"gte equal", signakit.AudienceCondition{Attribute: "age", Operator: signakit.OpGreaterThanOrEqual, Value: float64(30)}, true},
		{"lte equal", signakit.AudienceCondition{Attribute: "age", Operator: signakit.OpLessThanOrEqual, Value: float64(30)}, true},
		{"in match", signakit.AudienceCondition{Attribute: "country", Operator: signakit.OpIn, Value: []any{"US", "CA"}}, true},
		{"in miss", signakit.AudienceCondition{Attribute: "country", Operator: signakit.OpIn, Value: []any{"FR", "DE"}}, false},
		{"not_in match", signakit.AudienceCondition{Attribute: "country", Operator: signakit.OpNotIn, Value: []any{"FR", "DE"}}, true},
		{"contains string", signakit.AudienceCondition{Attribute: "plan", Operator: signakit.OpContains, Value: "prem"}, true},
		{"contains array", signakit.AudienceCondition{Attribute: "tags", Operator: signakit.OpContains, Value: "vip"}, true},
		{"not_contains array", signakit.AudienceCondition{Attribute: "tags", Operator: signakit.OpNotContains, Value: "spammer"}, true},
		{"missing attr", signakit.AudienceCondition{Attribute: "missing", Operator: signakit.OpEquals, Value: "x"}, false},
		{"gt non-number", signakit.AudienceCondition{Attribute: "plan", Operator: signakit.OpGreaterThan, Value: float64(5)}, false},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := MatchesCondition(tc.cond, attrs)
			if got != tc.want {
				t.Errorf("got %v, want %v", got, tc.want)
			}
		})
	}
}

func TestMatchesAudiences(t *testing.T) {
	t.Parallel()

	attrs := signakit.UserAttributes{"plan": "premium", "age": float64(30)}

	premiumAudience := signakit.ConfigRuleAudience{
		Conditions: []signakit.AudienceCondition{
			{Attribute: "plan", Operator: signakit.OpEquals, Value: "premium"},
		},
	}
	youngAudience := signakit.ConfigRuleAudience{
		Conditions: []signakit.AudienceCondition{
			{Attribute: "age", Operator: signakit.OpLessThan, Value: float64(20)},
		},
	}

	if !MatchesAudiences(nil, signakit.AudienceMatchAll, attrs) {
		t.Error("nil audiences should match")
	}
	if !MatchesAudiences([]signakit.ConfigRuleAudience{premiumAudience}, signakit.AudienceMatchAll, attrs) {
		t.Error("premium audience should match")
	}
	if MatchesAudiences([]signakit.ConfigRuleAudience{premiumAudience, youngAudience}, signakit.AudienceMatchAll, attrs) {
		t.Error("ALL: should fail because age >= 20")
	}
	if !MatchesAudiences([]signakit.ConfigRuleAudience{premiumAudience, youngAudience}, signakit.AudienceMatchAny, attrs) {
		t.Error("ANY: should pass because plan==premium")
	}
}
