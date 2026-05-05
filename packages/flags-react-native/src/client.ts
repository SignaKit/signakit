/**
 * SignaKit Feature Flags React Native SDK Client
 *
 * Patterned after `@signakit/flags-browser`, with these RN-specific changes:
 *  - No bot detection (mobile apps aren't crawled by web bots).
 *  - No `sessionStorage`; exposure dedup uses an in-memory `Map` that resets
 *    on app cold start (the natural mobile "session" boundary).
 *  - No `navigator.sendBeacon`; events are POSTed via `fetch` (always
 *    available in Hermes/RN runtimes).
 *  - Optional `AsyncStorage` persistence for the last good config so the app
 *    boots offline-tolerant. Gated behind `persistConfig: true`.
 */

import type {
  SignaKitClientConfig,
  OnReadyResult,
  UserAttributes,
  SignaKitDecision,
  SignaKitDecisions,
  SignaKitEvent,
  AsyncStorageLike,
} from './types'
import { AppState, type AppStateStatus } from 'react-native'
import { ConfigManager, parseSdkKey } from './config-manager'
import { evaluateFlag, evaluateAllFlags } from './evaluator'
import { SignaKitUserContext } from './user-context'
import { SIGNAKIT_EVENTS_URL, DEFAULT_POLLING_INTERVAL } from './constants'

/**
 * Best-effort require of `@react-native-async-storage/async-storage`.
 * Returns `null` if the optional peer is not installed.
 */
function tryLoadAsyncStorage(): AsyncStorageLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-async-storage/async-storage')
    const candidate = (mod && (mod.default ?? mod)) as AsyncStorageLike | undefined
    if (
      candidate &&
      typeof candidate.getItem === 'function' &&
      typeof candidate.setItem === 'function'
    ) {
      return candidate
    }
    return null
  } catch {
    return null
  }
}

export class SignaKitClient {
  private configManager: ConfigManager
  readonly sdkKey: string
  private readyPromise: Promise<OnReadyResult>
  private isReady = false
  private pollingInterval: number
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null
  /**
   * In-memory exposure dedup map. Keyed by `${flagKey}:${userId}`.
   * Reset on cold start, which is the right semantic for a mobile "session".
   */
  private exposed: Map<string, true> = new Map()

  constructor(config: SignaKitClientConfig) {
    if (!config.sdkKey) {
      throw new Error('[SignaKit] sdkKey is required')
    }

    this.sdkKey = config.sdkKey
    this.pollingInterval = config.pollingInterval ?? DEFAULT_POLLING_INTERVAL

    const { orgId, projectId, environment } = parseSdkKey(config.sdkKey)

    const storage = config.persistConfig ? tryLoadAsyncStorage() : null

    this.configManager = new ConfigManager({
      orgId,
      projectId,
      environment,
      storage,
    })

    this.readyPromise = this.initialize()
  }

  private async initialize(): Promise<OnReadyResult> {
    // Try a cached config first when persistence is enabled.
    let fromCache = false
    const cached = await this.configManager.loadFromCache()
    if (cached) {
      this.isReady = true
      fromCache = true
    }

    try {
      await this.configManager.fetchConfig()
      this.isReady = true

      if (this.pollingInterval > 0) {
        this.configManager.startPolling(this.pollingInterval)
        // Pause polling when backgrounded, resume when foregrounded
        this.appStateSubscription = AppState.addEventListener(
          'change',
          this.handleAppStateChange
        )
      }

      return { success: true, fromCache: false }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error'
      // If we already have a cached config we can serve, treat as success.
      if (fromCache) {
        return { success: true, fromCache: true, reason }
      }
      return { success: false, reason }
    }
  }

  private handleAppStateChange = (state: AppStateStatus): void => {
    if (state === 'active') {
      this.configManager.startPolling(this.pollingInterval)
    } else {
      this.configManager.stopPolling()
    }
  }

  /**
   * Stop polling and release the AppState subscription.
   * Call this when the client is no longer needed (e.g. in tests).
   */
  destroy(): void {
    this.configManager.stopPolling()
    this.appStateSubscription?.remove()
    this.appStateSubscription = null
  }

  async onReady(): Promise<OnReadyResult> {
    return this.readyPromise
  }

  createUserContext(userId: string, attributes: UserAttributes = {}): SignaKitUserContext | null {
    if (!this.isReady) {
      console.error('[SignaKit] SignaKitClient is not ready. Call onReady() first.')
      return null
    }
    return new SignaKitUserContext(this, userId, attributes)
  }

  _evaluateFlag(
    flagKey: string,
    userId: string,
    attributes: UserAttributes
  ): SignaKitDecision | null {
    const config = this.configManager.getConfig()
    if (!config) {
      console.error('[SignaKit] No config available')
      return null
    }

    const flag = config.flags.find((f) => f.key === flagKey)
    if (!flag) {
      console.warn(`[SignaKit] Flag not found: ${flagKey}`)
      return null
    }

    const result = evaluateFlag(flag, userId, attributes)
    if (!result) {
      return null
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

  _evaluateAllFlags(userId: string, attributes: UserAttributes): SignaKitDecisions {
    const config = this.configManager.getConfig()
    if (!config) {
      console.error('[SignaKit] No config available')
      return {}
    }
    return evaluateAllFlags(config, userId, attributes)
  }

  /** Internal: check whether an exposure event has already been sent this session. */
  _hasExposed(dedupKey: string): boolean {
    return this.exposed.has(dedupKey)
  }

  /** Internal: mark an exposure event as sent for this session. */
  _markExposed(dedupKey: string): void {
    this.exposed.set(dedupKey, true)
  }

  /**
   * Send an event to the SignaKit events API.
   * Plain `fetch` — `navigator.sendBeacon` does not exist in React Native.
   */
  async _sendEvent(event: SignaKitEvent): Promise<void> {
    const url = SIGNAKIT_EVENTS_URL
    const body = JSON.stringify({ events: [event] })
    const headers = { 'Content-Type': 'application/json', 'X-SDK-Key': this.sdkKey }

    try {
      const response = await fetch(url, { method: 'POST', headers, body })
      if (!response.ok) {
        console.error(`[SignaKit] Failed to send event: ${response.status}`)
      }
    } catch (error) {
      console.error('[SignaKit] Failed to send event:', error)
    }
  }
}

/**
 * Create a new SignaKit Feature Flags React Native client instance.
 */
export function createInstance(config: SignaKitClientConfig): SignaKitClient | null {
  try {
    return new SignaKitClient(config)
  } catch (error) {
    console.error('[SignaKit] Failed to create SignaKitClient:', error)
    return null
  }
}
