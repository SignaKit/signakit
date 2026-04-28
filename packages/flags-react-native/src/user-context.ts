/**
 * SignaKitUserContext — represents a user for flag evaluation in a
 * React Native runtime. Auto-fires `$exposure` events for non-targeted
 * decisions, deduplicated per app session via an in-memory Map.
 */

import {
  MAX_EVENT_KEY_LENGTH,
  MAX_USER_ID_LENGTH,
  MAX_METADATA_SIZE_BYTES,
  MAX_ATTRIBUTES_COUNT,
  MAX_ATTRIBUTE_KEY_LENGTH,
  MAX_ATTRIBUTE_VALUE_LENGTH,
} from './constants'
import type {
  SignaKitDecision,
  SignaKitDecisions,
  SignaKitEvent,
  TrackEventOptions,
  UserAttributes,
} from './types'
import type { SignaKitClient } from './client'

/**
 * Sanitize attributes to enforce size limits.
 */
export function sanitizeAttributes(
  attributes: UserAttributes | undefined
): UserAttributes | undefined {
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
      sanitized[sanitizedKey] = (value as string[])
        .slice(0, 100)
        .map((v) => v.slice(0, MAX_ATTRIBUTE_VALUE_LENGTH))
    } else {
      sanitized[sanitizedKey] = value
    }
  }

  return sanitized
}

export class SignaKitUserContext {
  private client: SignaKitClient
  private cachedDecisions: Record<string, string> | null = null
  readonly userId: string
  readonly attributes: UserAttributes

  constructor(client: SignaKitClient, userId: string, attributes: UserAttributes = {}) {
    this.client = client
    this.userId = userId
    // Strip $userAgent — kept for parity with browser SDK but not used for
    // any runtime detection in React Native.
    const { $userAgent: _ignored, ...rest } = attributes
    void _ignored
    this.attributes = rest
  }

  /**
   * Fire-and-forget exposure tracking for non-targeted decisions.
   * Deduplicated per app session via the client's in-memory Map.
   */
  private _trackExposure(decision: SignaKitDecision): void {
    // Targeted rules are simple feature-flag rollouts — no experiment to
    // attribute, so skip exposure entirely.
    if (decision.ruleType === 'targeted') return

    const dedupKey = `${decision.flagKey}:${this.userId}`
    if (this.client._hasExposed(dedupKey)) return

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

    const sanitizedAttrs = sanitizeAttributes(this.attributes)
    if (sanitizedAttrs) {
      event.attributes = sanitizedAttrs
    }

    // Mark as sent before firing (prevent re-entry).
    this.client._markExposed(dedupKey)

    this.client._sendEvent(event).catch(() => {
      // Silently ignore - exposure tracking should not break the app.
    })
  }

  /**
   * Evaluate a single flag for this user.
   */
  decide(flagKey: string): SignaKitDecision | null {
    const decision = this.client._evaluateFlag(flagKey, this.userId, this.attributes)

    if (decision) {
      if (!this.cachedDecisions) {
        this.cachedDecisions = {}
      }
      this.cachedDecisions[flagKey] = decision.variationKey
      this._trackExposure(decision)
    }

    return decision
  }

  /**
   * Evaluate all flags for this user.
   */
  decideAll(): SignaKitDecisions {
    const decisions = this.client._evaluateAllFlags(this.userId, this.attributes)

    this.cachedDecisions = {}
    for (const [flagKey, decision] of Object.entries(decisions)) {
      this.cachedDecisions[flagKey] = decision.variationKey
      this._trackExposure(decision)
    }

    return decisions
  }

  /**
   * Track a conversion event for this user.
   */
  async trackEvent(eventKey: string, options: TrackEventOptions = {}): Promise<void> {
    const sanitizedEventKey = eventKey.slice(0, MAX_EVENT_KEY_LENGTH)
    const sanitizedUserId = this.userId.slice(0, MAX_USER_ID_LENGTH)

    const event: SignaKitEvent = {
      eventKey: sanitizedEventKey,
      userId: sanitizedUserId,
      timestamp: new Date().toISOString(),
    }

    const sanitizedAttrs = sanitizeAttributes(this.attributes)
    if (sanitizedAttrs) {
      event.attributes = sanitizedAttrs
    }

    if (this.cachedDecisions && Object.keys(this.cachedDecisions).length > 0) {
      event.decisions = this.cachedDecisions
    }

    if (options.value !== undefined) {
      event.value = options.value
    }

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
