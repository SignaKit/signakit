/**
 * Flag evaluation logic.
 *
 * Mirrors `@signakit/flags-node`'s evaluator so server- and client-side
 * decisions agree for the same userId / attributes / config.
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

function findVariationInRanges(allocation: VariationAllocation, bucket: number): string | null {
  for (const range of allocation.ranges) {
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
  ruleType: RuleType | null
  variables: Record<string, VariableValue>
}

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

export function evaluateFlag(
  flag: ConfigFlag,
  userId: string,
  attributes?: UserAttributes
): EvaluationResult | null {
  if (flag.status === 'archived') {
    return null
  }

  if (!flag.running) {
    return {
      variationKey: 'off',
      enabled: false,
      ruleKey: null,
      ruleType: null,
      variables: resolveVariables(flag, 'off'),
    }
  }

  const rules = flag.rules || []
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]
    if (!rule) continue

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

    if (matchesAudiences(rule.audiences, rule.audienceMatchType, attributes)) {
      const trafficBucket = hashForTraffic(flag.salt, userId)
      const trafficThreshold = Math.floor((rule.trafficPercentage / 100) * BUCKET_SPACE)

      if (trafficBucket < trafficThreshold) {
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

  return {
    variationKey: 'off',
    enabled: false,
    ruleKey: null,
    ruleType: null,
    variables: resolveVariables(flag, 'off'),
  }
}

export function evaluateAllFlags(
  config: ProjectConfig,
  userId: string,
  attributes?: UserAttributes
): SignaKitDecisions {
  const decisions: SignaKitDecisions = {}

  for (const flag of config.flags) {
    const result = evaluateFlag(flag, userId, attributes)
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
