package audience_test

import (
	"testing"

	"github.com/signakit/flags-golang/internal/audience"
	"github.com/signakit/flags-golang/signakit"
)

func cond(attr string, op signakit.ConditionOperator, value any) signakit.AudienceCondition {
	return signakit.AudienceCondition{Attribute: attr, Operator: op, Value: value}
}

func audienceOf(conds ...signakit.AudienceCondition) signakit.ConfigRuleAudience {
	return signakit.ConfigRuleAudience{Conditions: conds}
}

func check(t *testing.T, got, want bool) {
	t.Helper()
	if got != want {
		t.Errorf("got %v, want %v", got, want)
	}
}

// ---------------------------------------------------------------------------
// matchesCondition — equals / not_equals
// ---------------------------------------------------------------------------

func TestEqualsMatchesIdenticalStringValues(t *testing.T) {
	t.Parallel()
	check(t, audience.MatchesCondition(cond("plan", signakit.OpEquals, "premium"), signakit.UserAttributes{"plan": "premium"}), true)
}

func TestEqualsRejectsDifferentStringValues(t *testing.T) {
	t.Parallel()
	check(t, audience.MatchesCondition(cond("plan", signakit.OpEquals, "premium"), signakit.UserAttributes{"plan": "free"}), false)
}

func TestEqualsMatchesBooleanValues(t *testing.T) {
	t.Parallel()
	check(t, audience.MatchesCondition(cond("verified", signakit.OpEquals, true), signakit.UserAttributes{"verified": true}), true)
	check(t, audience.MatchesCondition(cond("verified", signakit.OpEquals, true), signakit.UserAttributes{"verified": false}), false)
}

func TestNotEqualsMatchesWhenValuesDiffer(t *testing.T) {
	t.Parallel()
	check(t, audience.MatchesCondition(cond("plan", signakit.OpNotEquals, "premium"), signakit.UserAttributes{"plan": "free"}), true)
	check(t, audience.MatchesCondition(cond("plan", signakit.OpNotEquals, "premium"), signakit.UserAttributes{"plan": "premium"}), false)
}

func TestReturnsFalseWhenAttributeIsMissing(t *testing.T) {
	t.Parallel()
	check(t, audience.MatchesCondition(cond("plan", signakit.OpEquals, "premium"), signakit.UserAttributes{}), false)
	check(t, audience.MatchesCondition(cond("plan", signakit.OpEquals, "premium"), nil), false)
}

// ---------------------------------------------------------------------------
// matchesCondition — numeric comparisons
// ---------------------------------------------------------------------------

func TestGreaterThanTrueWhenUserValueExceedsThreshold(t *testing.T) {
	t.Parallel()
	c := cond("age", signakit.OpGreaterThan, float64(18))
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"age": float64(25)}), true)
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"age": float64(18)}), false)
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"age": float64(10)}), false)
}

func TestLessThanTrueWhenUserValueIsBelowThreshold(t *testing.T) {
	t.Parallel()
	c := cond("age", signakit.OpLessThan, float64(18))
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"age": float64(10)}), true)
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"age": float64(18)}), false)
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"age": float64(25)}), false)
}

func TestGreaterThanOrEqualInclusive(t *testing.T) {
	t.Parallel()
	c := cond("age", signakit.OpGreaterThanOrEqual, float64(18))
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"age": float64(18)}), true)
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"age": float64(17)}), false)
}

func TestLessThanOrEqualInclusive(t *testing.T) {
	t.Parallel()
	c := cond("age", signakit.OpLessThanOrEqual, float64(18))
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"age": float64(18)}), true)
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"age": float64(19)}), false)
}

func TestNumericOperatorsReturnFalseOnStringAttributeValues(t *testing.T) {
	t.Parallel()
	check(t, audience.MatchesCondition(cond("age", signakit.OpGreaterThan, float64(18)), signakit.UserAttributes{"age": "25"}), false)
}

// ---------------------------------------------------------------------------
// matchesCondition — in / not_in
// ---------------------------------------------------------------------------

func TestInTrueWhenUserValueIsInTheList(t *testing.T) {
	t.Parallel()
	c := cond("country", signakit.OpIn, []any{"US", "CA", "GB"})
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"country": "US"}), true)
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"country": "DE"}), false)
}

func TestInFalseWhenValueIsNotAList(t *testing.T) {
	t.Parallel()
	c := cond("country", signakit.OpIn, "US")
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"country": "US"}), false)
}

func TestNotInTrueWhenUserValueIsAbsentFromList(t *testing.T) {
	t.Parallel()
	c := cond("country", signakit.OpNotIn, []any{"US", "CA"})
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"country": "DE"}), true)
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"country": "US"}), false)
}

func TestNotInTrueWhenValueIsNotAListVacuously(t *testing.T) {
	// Go: non-list value → vacuously true (mirrors JS/Python SDK behaviour)
	t.Parallel()
	c := cond("country", signakit.OpNotIn, "US")
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"country": "US"}), true)
}

// ---------------------------------------------------------------------------
// matchesCondition — contains / not_contains
// ---------------------------------------------------------------------------

func TestContainsTrueWhenStringIncludesSubstring(t *testing.T) {
	t.Parallel()
	c := cond("email", signakit.OpContains, "@acme")
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"email": "bob@acme.com"}), true)
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"email": "bob@gmail.com"}), false)
}

func TestContainsTrueWhenStringArrayIncludesValue(t *testing.T) {
	t.Parallel()
	c := cond("tags", signakit.OpContains, "beta")
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"tags": []string{"alpha", "beta", "gamma"}}), true)
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"tags": []string{"alpha", "gamma"}}), false)
}

func TestNotContainsTrueWhenStringDoesNotIncludeSubstring(t *testing.T) {
	t.Parallel()
	c := cond("email", signakit.OpNotContains, "@acme")
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"email": "bob@gmail.com"}), true)
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"email": "bob@acme.com"}), false)
}

func TestNotContainsTrueWhenArrayDoesNotIncludeValue(t *testing.T) {
	t.Parallel()
	c := cond("tags", signakit.OpNotContains, "beta")
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"tags": []string{"alpha", "gamma"}}), true)
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"tags": []string{"alpha", "beta"}}), false)
}

func TestNotContainsTrueWhenTypesDoNotMatchVacuously(t *testing.T) {
	// Go: numeric attribute with string needle → vacuously true (mirrors JS/Python SDK)
	t.Parallel()
	c := cond("score", signakit.OpNotContains, "high")
	check(t, audience.MatchesCondition(c, signakit.UserAttributes{"score": float64(42)}), true)
}

// ---------------------------------------------------------------------------
// matchesAudience (via MatchesAudiences with single element)
// ---------------------------------------------------------------------------

func TestMatchesAudienceReturnsTrueWhenAllConditionsMatch(t *testing.T) {
	t.Parallel()
	a := audienceOf(
		cond("plan", signakit.OpEquals, "premium"),
		cond("age", signakit.OpGreaterThanOrEqual, float64(18)),
	)
	check(t, audience.MatchesAudiences(
		[]signakit.ConfigRuleAudience{a},
		signakit.AudienceMatchAll,
		signakit.UserAttributes{"plan": "premium", "age": float64(25)},
	), true)
}

func TestMatchesAudienceReturnsFalseWhenAnyConditionFails(t *testing.T) {
	t.Parallel()
	a := audienceOf(
		cond("plan", signakit.OpEquals, "premium"),
		cond("age", signakit.OpGreaterThanOrEqual, float64(18)),
	)
	check(t, audience.MatchesAudiences(
		[]signakit.ConfigRuleAudience{a},
		signakit.AudienceMatchAll,
		signakit.UserAttributes{"plan": "premium", "age": float64(16)},
	), false)
}

func TestMatchesAudienceReturnsTrueForEmptyConditions(t *testing.T) {
	t.Parallel()
	a := audienceOf()
	check(t, audience.MatchesAudiences(
		[]signakit.ConfigRuleAudience{a},
		signakit.AudienceMatchAll,
		signakit.UserAttributes{},
	), true)
}

// ---------------------------------------------------------------------------
// matchesAudiences
// ---------------------------------------------------------------------------

func TestMatchesAudiencesReturnsTrueWhenNilOrEmpty(t *testing.T) {
	t.Parallel()
	check(t, audience.MatchesAudiences(nil, signakit.AudienceMatchAny, signakit.UserAttributes{}), true)
	check(t, audience.MatchesAudiences([]signakit.ConfigRuleAudience{}, signakit.AudienceMatchAny, signakit.UserAttributes{"plan": "premium"}), true)
	check(t, audience.MatchesAudiences([]signakit.ConfigRuleAudience{}, signakit.AudienceMatchAll, signakit.UserAttributes{"plan": "premium"}), true)
}

func TestAnyReturnsTrueWhenAtLeastOneAudienceMatches(t *testing.T) {
	t.Parallel()
	audiences := []signakit.ConfigRuleAudience{
		audienceOf(cond("plan", signakit.OpEquals, "premium")),
		audienceOf(cond("plan", signakit.OpEquals, "enterprise")),
	}
	check(t, audience.MatchesAudiences(audiences, signakit.AudienceMatchAny, signakit.UserAttributes{"plan": "premium"}), true)
	check(t, audience.MatchesAudiences(audiences, signakit.AudienceMatchAny, signakit.UserAttributes{"plan": "free"}), false)
}

func TestAllReturnsTrueOnlyWhenEveryAudienceMatches(t *testing.T) {
	t.Parallel()
	audiences := []signakit.ConfigRuleAudience{
		audienceOf(cond("plan", signakit.OpEquals, "premium")),
		audienceOf(cond("verified", signakit.OpEquals, true)),
	}
	check(t, audience.MatchesAudiences(audiences, signakit.AudienceMatchAll, signakit.UserAttributes{"plan": "premium", "verified": true}), true)
	check(t, audience.MatchesAudiences(audiences, signakit.AudienceMatchAll, signakit.UserAttributes{"plan": "premium", "verified": false}), false)
}

func TestDefaultsToAllLogicWhenMatchTypeIsEmpty(t *testing.T) {
	// Empty AudienceMatchType string falls through to the "all" (AND) default.
	t.Parallel()
	audiences := []signakit.ConfigRuleAudience{
		audienceOf(cond("plan", signakit.OpEquals, "premium")),
		audienceOf(cond("verified", signakit.OpEquals, true)),
	}
	check(t, audience.MatchesAudiences(audiences, "", signakit.UserAttributes{"plan": "premium", "verified": true}), true)
	check(t, audience.MatchesAudiences(audiences, "", signakit.UserAttributes{"plan": "premium", "verified": false}), false)
}
