package evaluator_test

import (
	"testing"

	"github.com/signakit/flags-golang/internal/evaluator"
	"github.com/signakit/flags-golang/signakit"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func fullAlloc(variation string) signakit.VariationAllocation {
	return signakit.VariationAllocation{
		Ranges: []signakit.VariationAllocationRange{
			{Variation: variation, Start: 0, End: 9999},
		},
	}
}

func rangeAlloc(pairs ...any) signakit.VariationAllocation {
	var ranges []signakit.VariationAllocationRange
	for i := 0; i < len(pairs); i += 3 {
		ranges = append(ranges, signakit.VariationAllocationRange{
			Variation: pairs[i].(string),
			Start:     pairs[i+1].(int),
			End:       pairs[i+2].(int),
		})
	}
	return signakit.VariationAllocation{Ranges: ranges}
}

func makeFlag(key string) signakit.ConfigFlag {
	return signakit.ConfigFlag{
		ID:      "flag_" + key,
		Key:     key,
		Status:  signakit.FlagStatusActive,
		Running: true,
		Salt:    key + "-salt",
		Variations: []signakit.Variation{
			{Key: "off"},
			{Key: "on"},
		},
		Allocation: fullAlloc("on"),
	}
}

func makeConfig(flags ...signakit.ConfigFlag) signakit.ProjectConfig {
	return signakit.ProjectConfig{
		ProjectID:      "p1",
		EnvironmentKey: signakit.EnvironmentDevelopment,
		SDKKey:         "sk_dev_org1_p1_xxx",
		Version:        1,
		Flags:          flags,
		GeneratedAt:    "2024-01-01T00:00:00.000Z",
	}
}

// ---------------------------------------------------------------------------
// Status / running checks
// ---------------------------------------------------------------------------

func TestArchivedReturnsNil(t *testing.T) {
	t.Parallel()
	flag := makeFlag("archived")
	flag.Status = signakit.FlagStatusArchived
	if d := evaluator.EvaluateFlag(flag, "user-1", nil); d != nil {
		t.Errorf("expected nil for archived flag, got %+v", d)
	}
}

func TestNotRunningReturnsOffDisabled(t *testing.T) {
	t.Parallel()
	flag := makeFlag("disabled")
	flag.Running = false
	d := evaluator.EvaluateFlag(flag, "user-1", nil)
	if d == nil || d.VariationKey != "off" || d.Enabled {
		t.Errorf("expected disabled off decision, got %+v", d)
	}
	if d.RuleKey != nil || d.RuleType != nil {
		t.Errorf("expected nil rule fields for not-running flag")
	}
}

// ---------------------------------------------------------------------------
// Allowlist
// ---------------------------------------------------------------------------

func TestAllowlistReturnsListedVariation(t *testing.T) {
	t.Parallel()
	flag := makeFlag("allowlist")
	flag.Allocation = fullAlloc("off")
	flag.Rules = []signakit.ConfigRule{{
		RuleKey:  "rule-qa",
		RuleType: signakit.RuleTypeTargeted,
		Allowlist: []signakit.AllowlistEntry{
			{UserID: "qa-user", Variation: "on"},
			{UserID: "qa-off-user", Variation: "off"},
		},
		VariationAllocation: fullAlloc("on"),
	}}

	d := evaluator.EvaluateFlag(flag, "qa-user", nil)
	if d == nil || d.VariationKey != "on" || !d.Enabled {
		t.Errorf("expected enabled on via allowlist, got %+v", d)
	}
	if d.RuleKey == nil || *d.RuleKey != "rule-qa" {
		t.Errorf("expected rule-qa, got %+v", d.RuleKey)
	}
	if d.RuleType == nil || *d.RuleType != signakit.RuleTypeTargeted {
		t.Errorf("expected targeted ruleType, got %+v", d.RuleType)
	}
}

func TestAllowlistOffVariationReturnsEnabledFalse(t *testing.T) {
	t.Parallel()
	flag := makeFlag("allowlist")
	flag.Allocation = fullAlloc("off")
	flag.Rules = []signakit.ConfigRule{{
		RuleKey:             "rule-qa",
		RuleType:            signakit.RuleTypeTargeted,
		Allowlist:           []signakit.AllowlistEntry{{UserID: "qa-off-user", Variation: "off"}},
		VariationAllocation: fullAlloc("on"),
	}}

	d := evaluator.EvaluateFlag(flag, "qa-off-user", nil)
	if d == nil || d.VariationKey != "off" || d.Enabled {
		t.Errorf("expected disabled off decision, got %+v", d)
	}
	if d.RuleKey == nil || *d.RuleKey != "rule-qa" {
		t.Errorf("expected rule-qa, got %+v", d.RuleKey)
	}
}

func TestNonAllowlistedUserFallsThroughToDefault(t *testing.T) {
	t.Parallel()
	flag := makeFlag("allowlist")
	flag.Allocation = fullAlloc("off")
	flag.Rules = []signakit.ConfigRule{{
		RuleKey:             "rule-qa",
		RuleType:            signakit.RuleTypeTargeted,
		Allowlist:           []signakit.AllowlistEntry{{UserID: "qa-user", Variation: "on"}},
		VariationAllocation: fullAlloc("on"),
	}}

	d := evaluator.EvaluateFlag(flag, "random-user", nil)
	if d == nil || d.VariationKey != "off" || d.RuleKey != nil {
		t.Errorf("expected default off decision, got %+v", d)
	}
}

// ---------------------------------------------------------------------------
// Traffic allocation
// ---------------------------------------------------------------------------

func TestPlacesAllUsersInTrafficWhenPercentageIs100(t *testing.T) {
	t.Parallel()
	flag := makeFlag("full-traffic")
	flag.Rules = []signakit.ConfigRule{{
		RuleKey:             "rule-all",
		RuleType:            signakit.RuleTypeABTest,
		TrafficPercentage:   100,
		VariationAllocation: fullAlloc("on"),
	}}

	d := evaluator.EvaluateFlag(flag, "any-user", nil)
	if d == nil || d.VariationKey != "on" {
		t.Errorf("expected on via rule, got %+v", d)
	}
	if d.RuleKey == nil || *d.RuleKey != "rule-all" {
		t.Errorf("expected rule-all, got %+v", d.RuleKey)
	}
}

func TestPlacesNoUsersInTrafficWhenPercentageIs0(t *testing.T) {
	t.Parallel()
	flag := makeFlag("zero-traffic")
	flag.Allocation = fullAlloc("off")
	flag.Rules = []signakit.ConfigRule{{
		RuleKey:             "rule-none",
		RuleType:            signakit.RuleTypeABTest,
		TrafficPercentage:   0,
		VariationAllocation: fullAlloc("on"),
	}}

	d := evaluator.EvaluateFlag(flag, "any-user", nil)
	if d == nil || d.VariationKey != "off" || d.RuleKey != nil {
		t.Errorf("expected default off decision, got %+v", d)
	}
}

// ---------------------------------------------------------------------------
// Audience targeting
// ---------------------------------------------------------------------------

func TestMatchesRuleForUserWhoseAttributesSatisfyAudience(t *testing.T) {
	t.Parallel()
	flag := makeFlag("targeted")
	flag.Allocation = fullAlloc("off")
	flag.Rules = []signakit.ConfigRule{{
		RuleKey:           "rule-premium",
		RuleType:          signakit.RuleTypeABTest,
		AudienceMatchType: signakit.AudienceMatchAny,
		Audiences: []signakit.ConfigRuleAudience{{
			Conditions: []signakit.AudienceCondition{
				{Attribute: "plan", Operator: signakit.OpEquals, Value: "premium"},
			},
		}},
		TrafficPercentage:   100,
		VariationAllocation: fullAlloc("on"),
	}}

	d := evaluator.EvaluateFlag(flag, "premium-user", signakit.UserAttributes{"plan": "premium"})
	if d == nil || d.VariationKey != "on" {
		t.Errorf("expected on via rule, got %+v", d)
	}
	if d.RuleKey == nil || *d.RuleKey != "rule-premium" {
		t.Errorf("expected rule-premium, got %+v", d.RuleKey)
	}
}

func TestFallsThroughToDefaultForUserWhoDoesNotMatchAudience(t *testing.T) {
	t.Parallel()
	flag := makeFlag("targeted")
	flag.Allocation = fullAlloc("off")
	flag.Rules = []signakit.ConfigRule{{
		RuleKey:           "rule-premium",
		RuleType:          signakit.RuleTypeABTest,
		AudienceMatchType: signakit.AudienceMatchAny,
		Audiences: []signakit.ConfigRuleAudience{{
			Conditions: []signakit.AudienceCondition{
				{Attribute: "plan", Operator: signakit.OpEquals, Value: "premium"},
			},
		}},
		TrafficPercentage:   100,
		VariationAllocation: fullAlloc("on"),
	}}

	d := evaluator.EvaluateFlag(flag, "free-user", signakit.UserAttributes{"plan": "free"})
	if d == nil || d.VariationKey != "off" || d.RuleKey != nil {
		t.Errorf("expected default off decision, got %+v", d)
	}
}

func TestFallsThroughToDefaultWhenUserHasNoAttributes(t *testing.T) {
	t.Parallel()
	flag := makeFlag("targeted")
	flag.Allocation = fullAlloc("off")
	flag.Rules = []signakit.ConfigRule{{
		RuleKey:           "rule-premium",
		RuleType:          signakit.RuleTypeABTest,
		AudienceMatchType: signakit.AudienceMatchAny,
		Audiences: []signakit.ConfigRuleAudience{{
			Conditions: []signakit.AudienceCondition{
				{Attribute: "plan", Operator: signakit.OpEquals, Value: "premium"},
			},
		}},
		TrafficPercentage:   100,
		VariationAllocation: fullAlloc("on"),
	}}

	d := evaluator.EvaluateFlag(flag, "attr-less-user", nil)
	if d == nil || d.VariationKey != "off" || d.RuleKey != nil {
		t.Errorf("expected default off decision, got %+v", d)
	}
}

// ---------------------------------------------------------------------------
// Default allocation
// ---------------------------------------------------------------------------

func TestUsesDefaultAllocationWhenNoRulesExist(t *testing.T) {
	t.Parallel()
	flag := makeFlag("no-rules")

	d := evaluator.EvaluateFlag(flag, "user-1", nil)
	if d == nil || d.VariationKey != "on" || !d.Enabled {
		t.Errorf("expected enabled on via default, got %+v", d)
	}
	if d.RuleKey != nil || d.RuleType != nil {
		t.Errorf("expected nil rule fields for default allocation")
	}
}

func TestReturnsOffFallbackWhenDefaultAllocationRangesAreEmpty(t *testing.T) {
	t.Parallel()
	flag := makeFlag("empty-alloc")
	flag.Allocation = signakit.VariationAllocation{Ranges: []signakit.VariationAllocationRange{}}

	d := evaluator.EvaluateFlag(flag, "user-1", nil)
	if d == nil || d.VariationKey != "off" || d.Enabled {
		t.Errorf("expected disabled off fallback, got %+v", d)
	}
}

// ---------------------------------------------------------------------------
// Variable resolution
// ---------------------------------------------------------------------------

func TestReturnsAllDefaultVariablesForVariationWithNoOverrides(t *testing.T) {
	t.Parallel()
	flag := signakit.ConfigFlag{
		ID:      "flag_vars",
		Key:     "vars-flag",
		Status:  signakit.FlagStatusActive,
		Running: true,
		Salt:    "vars-salt",
		Variations: []signakit.Variation{
			{Key: "off"},
			{Key: "v1"}, // inherits all defaults
			{Key: "v2", Variables: map[string]any{"color": "blue", "count": float64(5)}},
		},
		Variables: []signakit.FlagVariable{
			{Key: "color", Type: "string", DefaultValue: "red"},
			{Key: "count", Type: "number", DefaultValue: float64(1)},
			{Key: "enabled", Type: "boolean", DefaultValue: true},
		},
		Allocation: fullAlloc("v1"),
	}

	d := evaluator.EvaluateFlag(flag, "user-1", nil)
	if d == nil || d.VariationKey != "v1" {
		t.Fatalf("expected v1, got %+v", d)
	}
	if d.Variables["color"] != "red" || d.Variables["count"] != float64(1) || d.Variables["enabled"] != true {
		t.Errorf("unexpected variables: %v", d.Variables)
	}
}

func TestMergesVariationOverridesWithFlagLevelDefaults(t *testing.T) {
	t.Parallel()
	flag := signakit.ConfigFlag{
		ID:      "flag_vars",
		Key:     "vars-flag",
		Status:  signakit.FlagStatusActive,
		Running: true,
		Salt:    "vars-salt",
		Variations: []signakit.Variation{
			{Key: "off"},
			{Key: "v2", Variables: map[string]any{"color": "blue", "count": float64(5)}},
		},
		Variables: []signakit.FlagVariable{
			{Key: "color", Type: "string", DefaultValue: "red"},
			{Key: "count", Type: "number", DefaultValue: float64(1)},
			{Key: "enabled", Type: "boolean", DefaultValue: true},
		},
		Allocation: fullAlloc("v2"),
	}

	d := evaluator.EvaluateFlag(flag, "user-1", nil)
	if d == nil || d.VariationKey != "v2" {
		t.Fatalf("expected v2, got %+v", d)
	}
	// color and count come from variation overrides; enabled comes from default.
	if d.Variables["color"] != "blue" || d.Variables["count"] != float64(5) || d.Variables["enabled"] != true {
		t.Errorf("unexpected variables: %v", d.Variables)
	}
}

func TestReturnsEmptyVariablesWhenFlagHasNoneDefined(t *testing.T) {
	t.Parallel()
	flag := makeFlag("no-vars")

	d := evaluator.EvaluateFlag(flag, "user-1", nil)
	if d == nil {
		t.Fatal("nil decision")
	}
	if len(d.Variables) != 0 {
		t.Errorf("expected empty variables, got %v", d.Variables)
	}
}

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

func TestAlwaysAssignsSameVariationToSameUser(t *testing.T) {
	t.Parallel()
	flag := makeFlag("determinism")
	flag.Allocation = rangeAlloc("off", 0, 4999, "on", 5000, 9999)

	var firstKey string
	for range 10 {
		d := evaluator.EvaluateFlag(flag, "user-stable", nil)
		if d == nil {
			t.Fatal("nil decision")
		}
		if firstKey == "" {
			firstKey = d.VariationKey
		} else if d.VariationKey != firstKey {
			t.Errorf("non-deterministic: got %q after %q", d.VariationKey, firstKey)
		}
	}
}

// ---------------------------------------------------------------------------
// EvaluateAll
// ---------------------------------------------------------------------------

func TestEvaluateAllReturnsDecisionsForNonArchivedFlags(t *testing.T) {
	t.Parallel()
	archivedFlag := makeFlag("archived-c")
	archivedFlag.Status = signakit.FlagStatusArchived
	cfg := makeConfig(makeFlag("active-a"), makeFlag("active-b"), archivedFlag)

	decisions := evaluator.EvaluateAll(&cfg, "user-1", nil)
	if len(decisions) != 2 {
		t.Errorf("expected 2 decisions, got %d", len(decisions))
	}
	if _, ok := decisions["active-a"]; !ok {
		t.Error("missing active-a")
	}
	if _, ok := decisions["active-b"]; !ok {
		t.Error("missing active-b")
	}
	if _, ok := decisions["archived-c"]; ok {
		t.Error("archived-c should not be present")
	}
}

func TestEvaluateAllIncludesFlagKeyOnEachDecision(t *testing.T) {
	t.Parallel()
	cfg := makeConfig(makeFlag("active-a"), makeFlag("active-b"))

	decisions := evaluator.EvaluateAll(&cfg, "user-1", nil)
	if d, ok := decisions["active-a"]; !ok || d.FlagKey != "active-a" {
		t.Errorf("active-a: expected FlagKey=active-a, got %+v", d)
	}
	if d, ok := decisions["active-b"]; !ok || d.FlagKey != "active-b" {
		t.Errorf("active-b: expected FlagKey=active-b, got %+v", d)
	}
}
