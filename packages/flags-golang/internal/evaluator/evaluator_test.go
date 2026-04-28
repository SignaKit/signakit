package evaluator

import (
	"testing"

	"github.com/signakit/flags-golang/signakit"
)

func makeFlag() signakit.ConfigFlag {
	return signakit.ConfigFlag{
		ID:      "1",
		Key:     "test-flag",
		Salt:    "salt-1",
		Status:  signakit.FlagStatusActive,
		Running: true,
		Variations: []signakit.Variation{
			{Key: "control"},
			{Key: "treatment"},
			{Key: "off"},
		},
		Allocation: signakit.VariationAllocation{
			Ranges: []signakit.VariationAllocationRange{
				{Variation: "control", Start: 0, End: 4999},
				{Variation: "treatment", Start: 5000, End: 9999},
			},
		},
	}
}

func TestEvaluateArchivedReturnsNil(t *testing.T) {
	t.Parallel()
	flag := makeFlag()
	flag.Status = signakit.FlagStatusArchived
	if d := EvaluateFlag(flag, "user-1", nil); d != nil {
		t.Errorf("expected nil for archived flag, got %+v", d)
	}
}

func TestEvaluateNotRunning(t *testing.T) {
	t.Parallel()
	flag := makeFlag()
	flag.Running = false
	d := EvaluateFlag(flag, "user-1", nil)
	if d == nil || d.VariationKey != "off" || d.Enabled {
		t.Errorf("expected disabled off decision, got %+v", d)
	}
	if d.RuleKey != nil || d.RuleType != nil {
		t.Errorf("expected nil rule fields for not-running flag")
	}
}

func TestEvaluateDefaultAllocation(t *testing.T) {
	t.Parallel()
	flag := makeFlag()
	d := EvaluateFlag(flag, "user-1", nil)
	if d == nil {
		t.Fatal("nil decision")
	}
	if d.VariationKey != "control" && d.VariationKey != "treatment" {
		t.Errorf("unexpected variation: %s", d.VariationKey)
	}
	if d.RuleKey != nil || d.RuleType != nil {
		t.Errorf("default-allocation decisions must have nil RuleKey/RuleType, got %+v / %+v", d.RuleKey, d.RuleType)
	}
}

func TestEvaluateAllowlistOverridesEverything(t *testing.T) {
	t.Parallel()
	flag := makeFlag()
	flag.Rules = []signakit.ConfigRule{{
		RuleKey:           "rule-1",
		RuleType:          signakit.RuleTypeABTest,
		TrafficPercentage: 0, // would otherwise exclude everyone
		Allowlist: []signakit.AllowlistEntry{
			{UserID: "vip", Variation: "treatment"},
		},
		VariationAllocation: signakit.VariationAllocation{
			Ranges: []signakit.VariationAllocationRange{
				{Variation: "treatment", Start: 0, End: 9999},
			},
		},
	}}
	d := EvaluateFlag(flag, "vip", nil)
	if d == nil || d.VariationKey != "treatment" {
		t.Fatalf("expected treatment via allowlist, got %+v", d)
	}
	if d.RuleKey == nil || *d.RuleKey != "rule-1" {
		t.Errorf("expected rule-1, got %+v", d.RuleKey)
	}
	if d.RuleType == nil || *d.RuleType != signakit.RuleTypeABTest {
		t.Errorf("expected ab-test ruleType, got %+v", d.RuleType)
	}
}

func TestEvaluateRuleZeroTrafficSkipped(t *testing.T) {
	t.Parallel()
	flag := makeFlag()
	flag.Rules = []signakit.ConfigRule{{
		RuleKey:           "rule-1",
		RuleType:          signakit.RuleTypeABTest,
		TrafficPercentage: 0,
		VariationAllocation: signakit.VariationAllocation{
			Ranges: []signakit.VariationAllocationRange{
				{Variation: "treatment", Start: 0, End: 9999},
			},
		},
	}}
	d := EvaluateFlag(flag, "user-1", nil)
	if d == nil || d.RuleKey != nil {
		t.Errorf("expected default-allocation decision (no rule), got %+v", d)
	}
}

func TestEvaluateAudienceFiltering(t *testing.T) {
	t.Parallel()
	flag := makeFlag()
	flag.Rules = []signakit.ConfigRule{{
		RuleKey:           "premium-rule",
		RuleType:          signakit.RuleTypeTargeted,
		TrafficPercentage: 100,
		AudienceMatchType: signakit.AudienceMatchAll,
		Audiences: []signakit.ConfigRuleAudience{{
			Conditions: []signakit.AudienceCondition{
				{Attribute: "plan", Operator: signakit.OpEquals, Value: "premium"},
			},
		}},
		VariationAllocation: signakit.VariationAllocation{
			Ranges: []signakit.VariationAllocationRange{
				{Variation: "treatment", Start: 0, End: 9999},
			},
		},
	}}

	// Premium user: matches rule.
	d := EvaluateFlag(flag, "u1", signakit.UserAttributes{"plan": "premium"})
	if d == nil || d.VariationKey != "treatment" {
		t.Errorf("expected treatment via rule, got %+v", d)
	}
	if d.RuleType == nil || *d.RuleType != signakit.RuleTypeTargeted {
		t.Errorf("expected targeted ruleType")
	}

	// Free user: skips rule, falls to default allocation.
	d2 := EvaluateFlag(flag, "u1", signakit.UserAttributes{"plan": "free"})
	if d2 == nil || d2.RuleKey != nil {
		t.Errorf("expected default-allocation decision, got %+v", d2)
	}
}

func TestEvaluateVariablesResolution(t *testing.T) {
	t.Parallel()
	flag := makeFlag()
	flag.Variables = []signakit.FlagVariable{
		{Key: "color", Type: "string", DefaultValue: "blue"},
		{Key: "max", Type: "number", DefaultValue: float64(10)},
	}
	flag.Variations = []signakit.Variation{
		{Key: "control", Variables: map[string]any{"color": "red"}},
		{Key: "treatment"},
		{Key: "off"},
	}

	// Force allocation to control.
	flag.Allocation = signakit.VariationAllocation{
		Ranges: []signakit.VariationAllocationRange{{Variation: "control", Start: 0, End: 9999}},
	}
	d := EvaluateFlag(flag, "u1", nil)
	if d == nil {
		t.Fatal("nil decision")
	}
	if d.Variables["color"] != "red" {
		t.Errorf("expected color=red override, got %v", d.Variables["color"])
	}
	if d.Variables["max"] != float64(10) {
		t.Errorf("expected max=10 default, got %v", d.Variables["max"])
	}
}
