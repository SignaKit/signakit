// Package evaluator implements the flag evaluation algorithm.
//
// Algorithm (mirrors packages/flags-node/src/evaluator.ts):
//  1. Archived flags return nil (omit from results).
//  2. Non-running flags return a disabled "off" decision.
//  3. For each rule in order:
//     a. Allowlist match by userId wins immediately.
//     b. Audience must match (any/all). If so, check traffic bucket
//        < trafficPercentage/100 * BucketSpace. If in traffic, pick
//        a variation from the rule's allocation ranges.
//  4. If no rule matched, fall back to the flag's default allocation.
//  5. If even that has no matching range, return disabled "off".
package evaluator

import (
	"github.com/signakit/flags-golang/internal/audience"
	"github.com/signakit/flags-golang/internal/hasher"
	"github.com/signakit/flags-golang/internal/types"
)

// EvaluateFlag evaluates a single flag for a user. Returns nil iff the flag is
// archived (the SDK omits archived flags from decideAll).
func EvaluateFlag(flag types.ConfigFlag, userID string, attrs types.UserAttributes) *types.Decision {
	if flag.Status == types.FlagStatusArchived {
		return nil
	}

	if !flag.Running {
		return offDecision(flag, nil, nil)
	}

	for _, rule := range flag.Rules {
		// 3a. Allowlist takes precedence over everything else in the rule.
		if entry := findAllowlistEntry(rule.Allowlist, userID); entry != nil {
			rt := rule.RuleType
			rk := rule.RuleKey
			return &types.Decision{
				FlagKey:      flag.Key,
				VariationKey: entry.Variation,
				Enabled:      entry.Variation != "off",
				RuleKey:      &rk,
				RuleType:     &rt,
				Variables:    resolveVariables(flag, entry.Variation),
			}
		}

		if !audience.MatchesAudiences(rule.Audiences, rule.AudienceMatchType, attrs) {
			continue
		}

		trafficBucket := hasher.HashForTraffic(flag.Salt, userID)
		// trafficPercentage is 0-100; threshold is bucket count.
		threshold := int((rule.TrafficPercentage / 100.0) * float64(hasher.BucketSpace))
		if trafficBucket >= threshold {
			continue
		}

		variationBucket := hasher.HashForVariation(flag.Salt, userID)
		variation, ok := findVariationInRanges(rule.VariationAllocation, variationBucket)
		if !ok {
			continue
		}

		rt := rule.RuleType
		rk := rule.RuleKey
		return &types.Decision{
			FlagKey:      flag.Key,
			VariationKey: variation,
			Enabled:      variation != "off",
			RuleKey:      &rk,
			RuleType:     &rt,
			Variables:    resolveVariables(flag, variation),
		}
	}

	// Default allocation.
	defaultBucket := hasher.HashForDefault(flag.Salt, userID)
	if variation, ok := findVariationInRanges(flag.Allocation, defaultBucket); ok {
		return &types.Decision{
			FlagKey:      flag.Key,
			VariationKey: variation,
			Enabled:      variation != "off",
			RuleKey:      nil,
			RuleType:     nil,
			Variables:    resolveVariables(flag, variation),
		}
	}

	return offDecision(flag, nil, nil)
}

// EvaluateAll evaluates every flag in cfg, omitting archived flags.
func EvaluateAll(cfg *types.ProjectConfig, userID string, attrs types.UserAttributes) types.Decisions {
	out := make(types.Decisions, len(cfg.Flags))
	for _, flag := range cfg.Flags {
		if d := EvaluateFlag(flag, userID, attrs); d != nil {
			out[flag.Key] = *d
		}
	}
	return out
}

func offDecision(flag types.ConfigFlag, ruleKey *string, ruleType *types.RuleType) *types.Decision {
	return &types.Decision{
		FlagKey:      flag.Key,
		VariationKey: "off",
		Enabled:      false,
		RuleKey:      ruleKey,
		RuleType:     ruleType,
		Variables:    resolveVariables(flag, "off"),
	}
}

func findAllowlistEntry(list []types.AllowlistEntry, userID string) *types.AllowlistEntry {
	for i := range list {
		if list[i].UserID == userID {
			return &list[i]
		}
	}
	return nil
}

func findVariationInRanges(alloc types.VariationAllocation, bucket int) (string, bool) {
	for _, r := range alloc.Ranges {
		if bucket >= r.Start && bucket <= r.End {
			return r.Variation, true
		}
	}
	return "", false
}

func resolveVariables(flag types.ConfigFlag, variationKey string) map[string]any {
	if len(flag.Variables) == 0 {
		return map[string]any{}
	}

	var overrides map[string]any
	for _, v := range flag.Variations {
		if v.Key == variationKey {
			overrides = v.Variables
			break
		}
	}

	out := make(map[string]any, len(flag.Variables))
	for _, def := range flag.Variables {
		if overrides != nil {
			if v, ok := overrides[def.Key]; ok {
				out[def.Key] = v
				continue
			}
		}
		out[def.Key] = def.DefaultValue
	}
	return out
}
