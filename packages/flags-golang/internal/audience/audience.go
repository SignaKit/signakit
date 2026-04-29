// Package audience evaluates user attributes against rule audience conditions.
//
// Behavior mirrors packages/flags-node/src/audience-matcher.ts. Type rules:
//   - equals/not_equals work on any comparable scalar.
//   - Numeric ops (>, <, >=, <=) require both sides to be numbers; otherwise false.
//   - in/not_in require value to be an array.
//   - contains/not_contains accept (string,string) or ([]string,string).
//
// Empty / nil audiences match all users.
package audience

import (
	"github.com/signakit/flags-golang/internal/types"
)

// MatchesAudiences returns true iff the user matches the rule's audience set
// according to matchType. Empty / nil audiences always match.
func MatchesAudiences(audiences []types.ConfigRuleAudience, matchType types.AudienceMatchType, attrs types.UserAttributes) bool {
	if len(audiences) == 0 {
		return true
	}
	if matchType == types.AudienceMatchAny {
		for _, a := range audiences {
			if matchesAudience(a, attrs) {
				return true
			}
		}
		return false
	}
	// Default: "all" (AND).
	for _, a := range audiences {
		if !matchesAudience(a, attrs) {
			return false
		}
	}
	return true
}

func matchesAudience(a types.ConfigRuleAudience, attrs types.UserAttributes) bool {
	for _, c := range a.Conditions {
		if !MatchesCondition(c, attrs) {
			return false
		}
	}
	return true
}

// MatchesCondition evaluates a single condition. Exported for testing.
func MatchesCondition(cond types.AudienceCondition, attrs types.UserAttributes) bool {
	if attrs == nil {
		return false
	}
	userValue, ok := attrs[cond.Attribute]
	if !ok || userValue == nil {
		return false
	}

	switch cond.Operator {
	case types.OpEquals:
		return scalarEquals(userValue, cond.Value)
	case types.OpNotEquals:
		return !scalarEquals(userValue, cond.Value)
	case types.OpGreaterThan:
		a, b, ok := bothNumbers(userValue, cond.Value)
		return ok && a > b
	case types.OpLessThan:
		a, b, ok := bothNumbers(userValue, cond.Value)
		return ok && a < b
	case types.OpGreaterThanOrEqual:
		a, b, ok := bothNumbers(userValue, cond.Value)
		return ok && a >= b
	case types.OpLessThanOrEqual:
		a, b, ok := bothNumbers(userValue, cond.Value)
		return ok && a <= b
	case types.OpIn:
		list, ok := toAnyList(cond.Value)
		if !ok {
			return false
		}
		for _, v := range list {
			if scalarEquals(userValue, v) {
				return true
			}
		}
		return false
	case types.OpNotIn:
		list, ok := toAnyList(cond.Value)
		if !ok {
			// TS returns true when value isn't an array.
			return true
		}
		for _, v := range list {
			if scalarEquals(userValue, v) {
				return false
			}
		}
		return true
	case types.OpContains:
		return contains(userValue, cond.Value)
	case types.OpNotContains:
		// TS returns true when types don't match.
		us, usOK := userValue.(string)
		vs, vsOK := cond.Value.(string)
		if usOK && vsOK {
			return !stringContains(us, vs)
		}
		if list, ok := toStringList(userValue); ok && vsOK {
			return !stringInList(list, vs)
		}
		return true
	default:
		return false
	}
}

// scalarEquals compares two scalars with JSON-friendly coercion: numbers are
// compared as float64 regardless of int/float origin.
func scalarEquals(a, b any) bool {
	if af, aok := toNumber(a); aok {
		if bf, bok := toNumber(b); bok {
			return af == bf
		}
	}
	return a == b
}

func bothNumbers(a, b any) (float64, float64, bool) {
	af, aok := toNumber(a)
	bf, bok := toNumber(b)
	if !aok || !bok {
		return 0, 0, false
	}
	return af, bf, true
}

func toNumber(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case float32:
		return float64(n), true
	case int:
		return float64(n), true
	case int32:
		return float64(n), true
	case int64:
		return float64(n), true
	case uint:
		return float64(n), true
	case uint32:
		return float64(n), true
	case uint64:
		return float64(n), true
	default:
		return 0, false
	}
}

func toAnyList(v any) ([]any, bool) {
	switch list := v.(type) {
	case []any:
		return list, true
	case []string:
		out := make([]any, len(list))
		for i, s := range list {
			out[i] = s
		}
		return out, true
	}
	return nil, false
}

func toStringList(v any) ([]string, bool) {
	switch list := v.(type) {
	case []string:
		return list, true
	case []any:
		out := make([]string, 0, len(list))
		for _, x := range list {
			s, ok := x.(string)
			if !ok {
				return nil, false
			}
			out = append(out, s)
		}
		return out, true
	}
	return nil, false
}

func contains(userValue, value any) bool {
	if us, ok := userValue.(string); ok {
		if vs, ok := value.(string); ok {
			return stringContains(us, vs)
		}
		return false
	}
	if list, ok := toStringList(userValue); ok {
		if vs, ok := value.(string); ok {
			return stringInList(list, vs)
		}
	}
	return false
}

func stringContains(s, sub string) bool {
	if sub == "" {
		return true
	}
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

func stringInList(list []string, target string) bool {
	for _, s := range list {
		if s == target {
			return true
		}
	}
	return false
}
