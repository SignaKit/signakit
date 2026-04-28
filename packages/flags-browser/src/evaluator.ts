/**
 * Flag evaluation logic.
 *
 * Evaluates a single flag or all flags for a given user context,
 * returning the variation key(s) the user should see.
 */

import type {
  ConfigFlag,
  ProjectConfig,
  VariationAllocation,
  RuleType,
  SignaKitDecision,
  SignaKitDecisions,
  UserAttributes,
  VariableValue,
} from './types'
import { hashForTraffic, hashForVariation, hashForDefault } from './hasher'
import { matchesAudiences } from './audience-matcher'
import { BUCKET_SPACE } from './constants'

/**
 * Find the variation for a given bucket within allocation ranges.
 *
 * @param allocation - The variation allocation with ranges
 * @param bucket - The bucket number (0-9999)
 * @returns The variation key or null if no range matches
 */
function findVariationInRanges(allocation: VariationAllocation, bucket: number): string | null {
  for (const range of allocation.ranges) {
    // Range is inclusive of both start and end
    if (bucket >= range.start && bucket <= range.end) {
      return range.variation
    }
  }
  return null
}

export interface EvaluationResult {
  variationKey: string
  enabled: boolean
  ruleKey: string | null
  /** The rule type that produced this decision, or null for default/disabled paths. */
  ruleType: RuleType | null
  variables: Record<string, VariableValue>
}

/**
 * Resolve variable values for a variation by merging flag-level defaults
 * with any variation-specific overrides.
 */
function resolveVariables(flag: ConfigFlag, variationKey: string): Record<string, VariableValue> {
  if (!flag.variables || flag.variables.length === 0) return {}

  const variation = flag.variations.find((v) => v.key === variationKey)
  const overrides = variation?.variables ?? {}

  const resolved: Record<string, VariableValue> = {}
  for (const def of flag.variables) {
    const override = overrides[def.key]
    resolved[def.key] = override !== undefined ? override : def.defaultValue
  }
  return resolved
}

/**
 * Evaluate a single flag for a user.
 *
 * Algorithm:
 * 1. If archived, skip (return null - flag won't appear in results)
 * 2. If not running, return disabled decision
 * 3. Evaluate rules in order:
 *    a. Check allowlist - if userId matches, return that variation immediately
 *    b. Check audience match (any/all logic)
 *    c. Check traffic allocation (bucket < trafficPercentage * 100)
 *    d. Get variation from allocation ranges
 * 4. No rules match → use default allocation
 *
 * @param flag - The flag configuration
 * @param userId - The user's unique identifier
 * @param attributes - Optional user attributes for targeting
 * @returns The evaluation result or null if archived
 */
export function evaluateFlag(
  flag: ConfigFlag,
  userId: string,
  attributes?: UserAttributes
): EvaluationResult | null {
  // 1. If archived, skip this flag entirely
  if (flag.status === 'archived') {
    return null
  }

  // 2. If not running, return disabled decision with 'off' variation
  if (!flag.running) {
    return {
      variationKey: 'off',
      enabled: false,
      ruleKey: null,
      ruleType: null,
      variables: resolveVariables(flag, 'off'),
    }
  }

  // 3. Evaluate rules in order (first matching rule wins)
  const rules = flag.rules || []
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]
    if (!rule) continue

    // 3a. Check allowlist first - if userId is in allowlist, return that variation immediately
    if (rule.allowlist && rule.allowlist.length > 0) {
      const allowlistEntry = rule.allowlist.find((entry) => entry.userId === userId)
      if (allowlistEntry) {
        return {
          variationKey: allowlistEntry.variation,
          enabled: allowlistEntry.variation !== 'off',
          ruleKey: rule.ruleKey,
          ruleType: rule.ruleType,
          variables: resolveVariables(flag, allowlistEntry.variation),
        }
      }
    }

    // 3b. Check if user matches the rule's audiences
    if (matchesAudiences(rule.audiences, rule.audienceMatchType, attributes)) {
      // Calculate traffic bucket for this rule
      const trafficBucket = hashForTraffic(flag.salt, userId)

      // trafficPercentage is 0-100, so multiply by 100 to get bucket threshold (0-10000)
      // e.g., 50% traffic = 5000 threshold (buckets 0-4999 are in traffic)
      const trafficThreshold = Math.floor((rule.trafficPercentage / 100) * BUCKET_SPACE)

      // If user is in traffic for this rule
      if (trafficBucket < trafficThreshold) {
        // Get variation bucket
        const variationBucket = hashForVariation(flag.salt, userId)
        const variation = findVariationInRanges(rule.variationAllocation, variationBucket)

        if (variation) {
          return {
            variationKey: variation,
            enabled: variation !== 'off',
            ruleKey: rule.ruleKey,
            ruleType: rule.ruleType,
            variables: resolveVariables(flag, variation),
          }
        }
      }
    }
  }

  // 4. No rules matched - use default allocation
  const defaultBucket = hashForDefault(flag.salt, userId)
  const defaultVariation = findVariationInRanges(flag.allocation, defaultBucket)

  if (defaultVariation) {
    return {
      variationKey: defaultVariation,
      enabled: defaultVariation !== 'off',
      ruleKey: null,
      ruleType: null,
      variables: resolveVariables(flag, defaultVariation),
    }
  }

  // Fallback to disabled if no allocation matched
  return {
    variationKey: 'off',
    enabled: false,
    ruleKey: null,
    ruleType: null,
    variables: resolveVariables(flag, 'off'),
  }
}

/**
 * Evaluate all flags in a config for a user.
 *
 * @param config - The project configuration with all flags
 * @param userId - The user's unique identifier
 * @param attributes - Optional user attributes for targeting
 * @returns Map of flag keys to decisions
 */
export function evaluateAllFlags(
  config: ProjectConfig,
  userId: string,
  attributes?: UserAttributes
): SignaKitDecisions {
  const decisions: SignaKitDecisions = {}

  for (const flag of config.flags) {
    const result = evaluateFlag(flag, userId, attributes)

    // Only include non-null results (excludes archived flags)
    if (result !== null) {
      const decision: SignaKitDecision = {
        flagKey: flag.key,
        variationKey: result.variationKey,
        enabled: result.enabled,
        ruleKey: result.ruleKey,
        ruleType: result.ruleType,
        variables: result.variables,
      }
      decisions[flag.key] = decision
    }
  }

  return decisions
}
