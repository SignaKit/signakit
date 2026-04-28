/**
 * SignaKit Feature Flags SDK Types
 */

// Client configuration

export interface SignaKitClientConfig {
  /**
   * The SDK key that identifies the org, project, and environment.
   * Format: sk_{env}_{orgId}_{projectId}_{random}
   */
  sdkKey: string
}

// Ready result

export interface OnReadyResult {
  success: boolean
  reason?: string
}

// User context types

export interface UserAttributes {
  /** Optional user-agent for bot detection. If bot, flags return 'off' and events are skipped. */
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

// Config types matching the server-side config JSON

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
  /** Optional - omitted in config when no audiences selected (rule matches all users) */
  audienceMatchType?: AudienceMatchType
  /** Optional - omitted in config when no audiences selected (rule matches all users) */
  audiences?: ConfigRuleAudience[]
  trafficPercentage: number
  variationAllocation: VariationAllocation
  /** Optional - omitted in config when empty */
  allowlist?: AllowlistEntry[]
  /** Optional - event keys for conversion tracking */
  eventKeys?: string[]
  /** Optional - primary event key for the rule */
  primaryEventKey?: string
}

export interface ConfigFlag {
  id: string
  key: string
  variations: Variation[]
  /** Optional - omitted in config when no variables defined */
  variables?: FlagVariable[]
  allocation: VariationAllocation
  salt: string
  status: FlagStatus
  running: boolean
  /** Optional - omitted in config when no rules exist */
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
  /** The event key (e.g., 'purchase', 'signup') */
  eventKey: string
  /** User ID for attribution */
  userId: string
  /** ISO timestamp when event occurred */
  timestamp: string
  /** User attributes at time of event */
  attributes?: UserAttributes
  /** Flag decisions active at time of event (for experiment attribution) */
  decisions?: Record<string, string>
  /** Optional event value (e.g., revenue amount) */
  value?: number
  /** Optional metadata */
  metadata?: Record<string, unknown>
}

export interface TrackEventOptions {
  /** Optional event value (e.g., revenue amount) */
  value?: number
  /** Optional metadata */
  metadata?: Record<string, unknown>
}
