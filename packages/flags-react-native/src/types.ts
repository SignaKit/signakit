/**
 * SignaKit Feature Flags React Native SDK Types
 */

// Client configuration

export interface SignaKitClientConfig {
  /**
   * The SDK key that identifies the org, project, and environment.
   * Format: sk_{env}_{orgId}_{projectId}_{random}
   */
  sdkKey: string
  /**
   * If true, the latest successfully fetched config is persisted to
   * AsyncStorage and re-used on cold start when the network is unavailable.
   * Requires `@react-native-async-storage/async-storage` to be installed.
   * Defaults to `false`.
   */
  persistConfig?: boolean
}

// Ready result

export interface OnReadyResult {
  success: boolean
  reason?: string
  /** True if the ready state was satisfied via the persisted AsyncStorage cache. */
  fromCache?: boolean
}

// User context types

export interface UserAttributes {
  /**
   * Optional user-agent attribute (kept for parity with the browser SDK).
   * React Native does not auto-detect a user agent; the SDK never sees a bot
   * unless the host application explicitly passes one.
   */
  $userAgent?: string
  [key: string]: string | number | boolean | string[] | undefined
}

// Variable types

export type VariableValue = string | number | boolean | Record<string, unknown>

export interface FlagVariable {
  key: string
  type: 'string' | 'number' | 'boolean' | 'json'
  defaultValue: VariableValue
}

// Decision types

export interface SignaKitDecision {
  flagKey: string
  variationKey: string
  enabled: boolean
  ruleKey: string | null
  /**
   * The rule type that produced this decision, if any.
   * `null` when the default allocation was used or the flag was disabled.
   * `'targeted'` rules are simple feature-flag rollouts — the SDK skips
   * `$exposure` events for them since there is no experiment to attribute.
   */
  ruleType: RuleType | null
  variables: Record<string, VariableValue>
}

export type SignaKitDecisions = Record<string, SignaKitDecision>

// Config types

export type Environment = 'development' | 'production'

export type RuleType = 'ab-test' | 'multi-armed-bandit' | 'targeted'

export type AudienceMatchType = 'any' | 'all'

export type FlagStatus = 'active' | 'archived'

export interface Variation {
  key: string
  variables?: Record<string, VariableValue>
}

export interface VariationAllocationRange {
  variation: string
  start: number
  end: number
}

export interface VariationAllocation {
  ranges: VariationAllocationRange[]
}

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equals'
  | 'less_than_or_equals'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'not_contains'

export interface AudienceCondition {
  attribute: string
  operator: ConditionOperator
  value: string | number | boolean | string[]
}

export interface ConfigRuleAudience {
  conditions: AudienceCondition[]
}

export interface AllowlistEntry {
  userId: string
  variation: string
}

export interface ConfigRule {
  ruleKey: string
  ruleType: RuleType
  audienceMatchType?: AudienceMatchType
  audiences?: ConfigRuleAudience[]
  trafficPercentage: number
  variationAllocation: VariationAllocation
  allowlist?: AllowlistEntry[]
  eventKeys?: string[]
  primaryEventKey?: string
}

export interface ConfigFlag {
  id: string
  key: string
  variations: Variation[]
  variables?: FlagVariable[]
  allocation: VariationAllocation
  salt: string
  status: FlagStatus
  running: boolean
  rules?: ConfigRule[]
}

export interface ProjectConfig {
  projectId: string
  environmentKey: Environment
  sdkKey: string
  version: number
  flags: ConfigFlag[]
  generatedAt: string
}

// Event tracking types

export interface SignaKitEvent {
  eventKey: string
  userId: string
  timestamp: string
  attributes?: UserAttributes
  decisions?: Record<string, string>
  value?: number
  metadata?: Record<string, unknown>
}

export interface TrackEventOptions {
  value?: number
  metadata?: Record<string, unknown>
}

/**
 * Minimal AsyncStorage interface used by the SDK. Compatible with
 * `@react-native-async-storage/async-storage`.
 */
export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}
