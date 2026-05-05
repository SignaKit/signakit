/**
 * SignaKit Feature Flags SDK Client
 *
 * Follows Optimizely's SDK patterns:
 * - createInstance({ sdkKey }) to create the client
 * - onReady() to wait for initialization
 * - createUserContext(userId, attributes) to create a user context
 * - userContext.decide(flagKey) to get a single flag decision
 * - userContext.decideAll() to get all flag decisions
 * - userContext.trackEvent(eventKey) to track conversion events
 */

import type {
  SignaKitClientConfig,
  OnReadyResult,
  UserAttributes,
  SignaKitDecision,
  SignaKitDecisions,
  SignaKitEvent,
  TrackEventOptions,
} from './types'
import { ConfigManager, parseSdkKey } from './config-manager'
import { evaluateFlag, evaluateAllFlags } from './evaluator'
import { isBot } from './ua/bot-patterns'
import {
  SIGNAKIT_EVENTS_URL,
  DEFAULT_POLLING_INTERVAL,
  MAX_EVENT_KEY_LENGTH,
  MAX_USER_ID_LENGTH,
  MAX_METADATA_SIZE_BYTES,
  MAX_ATTRIBUTES_COUNT,
  MAX_ATTRIBUTE_KEY_LENGTH,
  MAX_ATTRIBUTE_VALUE_LENGTH,
} from './constants'

/**
 * Sanitize attributes to enforce size limits.
 * Truncates keys/values and limits total attribute count.
 */
function sanitizeAttributes(attributes: UserAttributes | undefined): UserAttributes | undefined {
  if (!attributes || Object.keys(attributes).length === 0) {
    return undefined
  }

  const sanitized: UserAttributes = {}
  const keys = Object.keys(attributes).slice(0, MAX_ATTRIBUTES_COUNT)

  for (const key of keys) {
    const sanitizedKey = key.slice(0, MAX_ATTRIBUTE_KEY_LENGTH)
    const value = attributes[key]

    if (value === undefined) {
      continue
    } else if (typeof value === 'string') {
      sanitized[sanitizedKey] = value.slice(0, MAX_ATTRIBUTE_VALUE_LENGTH)
    } else if (Array.isArray(value)) {
      // Limit string array values to reasonable size
      sanitized[sanitizedKey] = (value as string[])
        .slice(0, 100)
        .map((v) => v.slice(0, MAX_ATTRIBUTE_VALUE_LENGTH))
    } else {
      sanitized[sanitizedKey] = value
    }
  }

  return sanitized
}

/**
 * User Context - represents a user for flag evaluation.
 * Created via SignaKitClient.createUserContext()
 */
export class SignaKitUserContext {
  private client: SignaKitClient
  private cachedDecisions: Record<string, string> | null = null
  private _isBot: boolean
  readonly userId: string
  readonly attributes: UserAttributes

  constructor(client: SignaKitClient, userId: string, attributes: UserAttributes = {}) {
    this.client = client
    this.userId = userId
    // Detect bot based on $userAgent attribute
    this._isBot = isBot(attributes.$userAgent)
    // Remove $userAgent from attributes (not needed for targeting)
    const { $userAgent: _, ...rest } = attributes
    this.attributes = rest
  }

  /**
   * Track an exposure event for a flag decision (fire-and-forget).
   * Called internally when decide() or decideAll() is invoked.
   *
   * Skipped for `targeted` rules — those are simple feature-flag rollouts
   * with no experiment to attribute, so exposures would just be noise.
   */
  private _trackExposure(decision: SignaKitDecision): void {
    if (decision.ruleType === 'targeted') return
    const event: SignaKitEvent = {
      eventKey: '$exposure',
      userId: this.userId.slice(0, MAX_USER_ID_LENGTH),
      timestamp: new Date().toISOString(),
      decisions: { [decision.flagKey]: decision.variationKey },
      metadata: {
        flagKey: decision.flagKey,
        variationKey: decision.variationKey,
        ruleKey: decision.ruleKey,
      },
    }

    // Include sanitized attributes if present
    const sanitizedAttrs = sanitizeAttributes(this.attributes)
    if (sanitizedAttrs) {
      event.attributes = sanitizedAttrs
    }

    const send = () => this.client._sendEvent(event).catch(() => {})
    if (this.client._scheduler) {
      try {
        this.client._scheduler(send)
      } catch {
        // after() throws in Edge Runtime (middleware) — fall back to fire-and-forget
        send()
      }
    } else {
      send()
    }
  }

  /**
   * Evaluate a single flag for this user.
   *
   * @param flagKey - The key of the flag to evaluate
   * @returns The decision for the flag, or null if flag not found/archived
   *
   * @example
   * ```typescript
   * const decision = userContext.decide('new-checkout-flow')
   *
   * if (decision?.enabled) {
   *   // Show new checkout
   * }
   *
   * // Or check specific variation
   * if (decision?.variationKey === 'treatment') {
   *   // Show treatment variation
   * }
   * ```
   */
  decide(flagKey: string): SignaKitDecision | null {
    // Bots always get 'off' variation (excluded from A/B tests)
    // Also skip exposure tracking for bots
    if (this._isBot) {
      return {
        flagKey,
        variationKey: 'off',
        enabled: false,
        ruleKey: null,
        ruleType: null,
        variables: {},
      }
    }

    const decision = this.client._evaluateFlag(flagKey, this.userId, this.attributes)

    // Cache decision for event attribution
    if (decision) {
      if (!this.cachedDecisions) {
        this.cachedDecisions = {}
      }
      this.cachedDecisions[flagKey] = decision.variationKey

      // Fire exposure event (fire-and-forget)
      this._trackExposure(decision)
    }

    return decision
  }

  /**
   * Evaluate all flags for this user.
   *
   * @returns Map of flag keys to decisions
   */
  decideAll(): SignaKitDecisions {
    // Bots get 'off' for all flags (excluded from A/B tests)
    // Also skip exposure tracking for bots
    if (this._isBot) {
      return this.client._getBotDecisions()
    }

    const decisions = this.client._evaluateAllFlags(this.userId, this.attributes)

    // Cache decisions for event attribution and fire exposure events
    this.cachedDecisions = {}
    for (const [flagKey, decision] of Object.entries(decisions)) {
      this.cachedDecisions[flagKey] = decision.variationKey

      // Fire exposure event for each flag (fire-and-forget)
      this._trackExposure(decision)
    }

    return decisions
  }

  /**
   * Track a conversion event for this user.
   * Sends the event immediately to the events API.
   *
   * @param eventKey - The event key (e.g., 'purchase', 'signup')
   * @param options - Optional event value and metadata
   *
   * @example
   * ```typescript
   * // Simple event
   * await userContext.trackEvent('signup')
   *
   * // Event with value (e.g., revenue)
   * await userContext.trackEvent('purchase', { value: 99.99 })
   *
   * // Event with metadata
   * await userContext.trackEvent('form_submit', {
   *   metadata: { formId: 'contact-form' }
   * })
   * ```
   */
  async trackEvent(eventKey: string, options: TrackEventOptions = {}): Promise<void> {
    // Silently skip events from bots
    if (this._isBot) {
      return
    }

    // Validate and truncate eventKey
    const sanitizedEventKey = eventKey.slice(0, MAX_EVENT_KEY_LENGTH)

    // Validate and truncate userId
    const sanitizedUserId = this.userId.slice(0, MAX_USER_ID_LENGTH)

    const event: SignaKitEvent = {
      eventKey: sanitizedEventKey,
      userId: sanitizedUserId,
      timestamp: new Date().toISOString(),
    }

    // Include sanitized attributes if present
    const sanitizedAttrs = sanitizeAttributes(this.attributes)
    if (sanitizedAttrs) {
      event.attributes = sanitizedAttrs
    }

    // Include cached decisions for experiment attribution
    if (this.cachedDecisions && Object.keys(this.cachedDecisions).length > 0) {
      event.decisions = this.cachedDecisions
    }

    // Include optional value
    if (options.value !== undefined) {
      event.value = options.value
    }

    // Include metadata if within size limit
    if (options.metadata) {
      const metadataStr = JSON.stringify(options.metadata)
      if (metadataStr.length <= MAX_METADATA_SIZE_BYTES) {
        event.metadata = options.metadata
      } else {
        console.warn(
          `[SignaKit] metadata exceeds ${MAX_METADATA_SIZE_BYTES} bytes (${metadataStr.length}), dropping`
        )
      }
    }

    await this.client._sendEvent(event)
  }
}

/**
 * SignaKit Feature Flags Client
 */
export class SignaKitClient {
  private configManager: ConfigManager
  private sdkKey: string
  private readyPromise: Promise<OnReadyResult>
  private isReady = false
  private pollingInterval: number
  _scheduler: ((callback: () => void | Promise<void>) => void) | undefined

  constructor(config: SignaKitClientConfig) {
    if (!config.sdkKey) {
      throw new Error('[SignaKit] sdkKey is required')
    }

    this.sdkKey = config.sdkKey
    this.pollingInterval = config.pollingInterval ?? DEFAULT_POLLING_INTERVAL
    this._scheduler = config.scheduler

    // Parse SDK key to get org ID, project ID, and environment
    const { orgId, projectId, environment } = parseSdkKey(config.sdkKey)

    this.configManager = new ConfigManager({
      orgId,
      projectId,
      environment,
    })

    // Start fetching config immediately
    this.readyPromise = this.initialize()
  }

  /**
   * Initialize the client by fetching the config, then start the polling loop.
   */
  private async initialize(): Promise<OnReadyResult> {
    try {
      await this.configManager.fetchConfig()
      this.isReady = true
      if (this.pollingInterval > 0) {
        this.configManager.startPolling(this.pollingInterval)
      }
      return { success: true }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, reason }
    }
  }

  /**
   * Stop the background polling loop and release resources.
   * Call this when the client is no longer needed (e.g. in tests).
   */
  destroy(): void {
    this.configManager.stopPolling()
  }

  /**
   * Wait for the client to be ready.
   * Returns { success: true } if ready, or { success: false, reason } if failed.
   */
  async onReady(): Promise<OnReadyResult> {
    return this.readyPromise
  }

  /**
   * Create a user context for evaluating flags.
   *
   * @param userId - Unique identifier for the user (used for bucketing)
   * @param attributes - Optional attributes for audience targeting
   * @returns SignaKitUserContext instance or null if client not ready
   */
  createUserContext(userId: string, attributes: UserAttributes = {}): SignaKitUserContext | null {
    if (!this.isReady) {
      console.error('[SignaKit] SignaKitClient is not ready. Call onReady() first.')
      return null
    }

    return new SignaKitUserContext(this, userId, attributes)
  }

  /**
   * Internal method to evaluate a single flag.
   * Called by SignaKitUserContext.decide()
   */
  _evaluateFlag(flagKey: string, userId: string, attributes: UserAttributes): SignaKitDecision | null {
    const config = this.configManager.getConfig()
    if (!config) {
      console.error('[SignaKit] No config available')
      return null
    }

    // Find the flag by key
    const flag = config.flags.find((f) => f.key === flagKey)
    if (!flag) {
      console.warn(`[SignaKit] Flag not found: ${flagKey}`)
      return null
    }

    // Evaluate the flag
    const result = evaluateFlag(flag, userId, attributes)
    if (!result) {
      return null // Flag is archived
    }

    return {
      flagKey: flag.key,
      variationKey: result.variationKey,
      enabled: result.enabled,
      ruleKey: result.ruleKey,
      ruleType: result.ruleType,
      variables: result.variables,
    }
  }

  /**
   * Internal method to evaluate all flags.
   * Called by SignaKitUserContext.decideAll()
   */
  _evaluateAllFlags(userId: string, attributes: UserAttributes): SignaKitDecisions {
    const config = this.configManager.getConfig()
    if (!config) {
      console.error('[SignaKit] No config available')
      return {}
    }

    return evaluateAllFlags(config, userId, attributes)
  }

  /**
   * Internal method to get "off" decisions for all flags.
   * Used for bot traffic to exclude them from A/B tests.
   */
  _getBotDecisions(): SignaKitDecisions {
    const config = this.configManager.getConfig()
    if (!config) {
      return {}
    }

    const decisions: SignaKitDecisions = {}
    for (const flag of config.flags) {
      if (flag.status !== 'archived') {
        decisions[flag.key] = {
          flagKey: flag.key,
          variationKey: 'off',
          enabled: false,
          ruleKey: null,
          ruleType: null,
          variables: {},
        }
      }
    }
    return decisions
  }

  /**
   * Internal method to send an event to the API.
   * Called by SignaKitUserContext.trackEvent()
   */
  async _sendEvent(event: SignaKitEvent): Promise<void> {
    try {
      const response = await fetch(SIGNAKIT_EVENTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SDK-Key': `${this.sdkKey}`,
        },
        body: JSON.stringify({ events: [event] }),
      })

      if (!response.ok) {
        console.error(`[SignaKit] Failed to send event: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      // AbortError is expected in dev (Turbopack request cleanup) and when
      // fire-and-forget exposure sends outlive the request context.
      if (error instanceof Error && error.name === 'AbortError') return
      console.error('[SignaKit] Failed to send event:', error)
    }
  }
}

/**
 * Create a new SignaKit Feature Flags client instance.
 *
 * @param config - Client configuration with sdkKey
 * @returns SignaKitClient instance or null if creation fails
 *
 * @example
 * ```typescript
 * const client = createInstance({
 *   sdkKey: process.env.SIGNAKIT_SDK_KEY!,
 * })
 *
 * if (!client) {
 *   console.error('Failed to create client')
 *   return
 * }
 *
 * const { success, reason } = await client.onReady()
 * if (!success) {
 *   console.error('Client not ready:', reason)
 *   return
 * }
 *
 * const userContext = client.createUserContext('user-123', { plan: 'premium' })
 * const decisions = userContext?.decideAll()
 *
 * // Track an event
 * await userContext?.trackEvent('signup')
 * ```
 */
export function createInstance(config: SignaKitClientConfig): SignaKitClient | null {
  try {
    return new SignaKitClient(config)
  } catch (error) {
    console.error('[SignaKit] Failed to create SignaKitClient:', error)
    return null
  }
}
