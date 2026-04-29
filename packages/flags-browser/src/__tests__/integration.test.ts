/**
 * Integration tests — "real browser app" simulation.
 *
 * These tests exercise the SDK exactly as a browser application developer would:
 * - Import only from the public API (index.ts)
 * - Create one client at startup, re-use it per page load
 * - Create a new user context per page
 * - No access to internal modules
 *
 * fetch is mocked to simulate the CloudFront CDN and SignaKit events API.
 * navigator.sendBeacon is disabled so events fall back to fetch for easy inspection.
 * sessionStorage is cleared between tests to reset exposure deduplication state.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { createInstance } from '../index'
import type { SignaKitClient } from '../index'
import { mockConfig, MOCK_SDK_KEY } from './fixtures/config'

const mockFetch = vi.fn().mockImplementation(async (url: string) => {
  if (typeof url === 'string' && url.includes('cloudfront.net')) {
    return new Response(JSON.stringify(mockConfig), {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json', etag: '"integration-etag"' }),
    })
  }
  return new Response(JSON.stringify({ received: true }), { status: 200 })
})

let client: SignaKitClient

beforeAll(async () => {
  // Disable sendBeacon so events use fetch and can be inspected
  Object.defineProperty(navigator, 'sendBeacon', {
    value: undefined,
    configurable: true,
    writable: true,
  })
  vi.stubGlobal('fetch', mockFetch)
  const instance = createInstance({ sdkKey: MOCK_SDK_KEY })
  expect(instance).not.toBeNull()
  client = instance!
  const { success } = await client.onReady()
  expect(success).toBe(true)
})

beforeEach(() => {
  sessionStorage.clear()
})

afterAll(() => {
  vi.unstubAllGlobals()
})

// --- Per-page flag evaluation ---

describe('per-page flag evaluation', () => {
  it('premium user enters the A/B test and receives a deterministic variation', () => {
    const ctx = client.createUserContext('user-premium-1', { plan: 'premium' })!
    const decision = ctx.decide('new-checkout-flow')

    expect(decision).not.toBeNull()
    expect(decision!.ruleType).toBe('ab-test')
    expect(['control', 'treatment']).toContain(decision!.variationKey)
  })

  it('free user does not enter the premium A/B test rule', () => {
    const ctx = client.createUserContext('user-free-1', { plan: 'free' })!
    const decision = ctx.decide('new-checkout-flow')

    expect(decision!.ruleKey).toBeNull()
    expect(decision!.ruleType).toBeNull()
  })

  it('dark-mode targeted rollout is on for every user', () => {
    const userIds = ['user-a', 'user-b', 'user-c', 'user-d']
    for (const userId of userIds) {
      const ctx = client.createUserContext(userId)!
      const decision = ctx.decide('dark-mode')
      expect(decision!.variationKey).toBe('on')
      expect(decision!.ruleType).toBe('targeted')
    }
  })

  it('allowlisted QA user always gets their pinned variation', () => {
    const ctx = client.createUserContext('qa-user-1')!
    expect(ctx.decide('allowlist-feature')!.variationKey).toBe('on')
  })

  it('disabled flag always returns off regardless of user attributes', () => {
    const users = [
      client.createUserContext('user-a', { plan: 'premium' }),
      client.createUserContext('user-b', { plan: 'free' }),
    ]
    for (const ctx of users) {
      expect(ctx!.decide('disabled-flag')!.variationKey).toBe('off')
      expect(ctx!.decide('disabled-flag')!.enabled).toBe(false)
    }
  })

  it('archived flag is excluded from decideAll results', () => {
    const ctx = client.createUserContext('user-1')!
    const decisions = ctx.decideAll()
    expect(decisions['archived-flag']).toBeUndefined()
  })
})

// --- Consistency across page loads ---

describe('deterministic bucketing across page loads', () => {
  it('same user always gets the same variation on repeated page loads', () => {
    const userId = 'user-consistency-check'
    const attributes = { plan: 'premium' }

    const variations = Array.from({ length: 10 }, () => {
      sessionStorage.clear() // simulate a new page load
      const ctx = client.createUserContext(userId, attributes)!
      return ctx.decide('new-checkout-flow')!.variationKey
    })

    const unique = new Set(variations)
    expect(unique.size).toBe(1)
  })

  it('different users get independently bucketed results', () => {
    const results = ['alice', 'bob', 'charlie', 'dave', 'eve'].map((id) => {
      const ctx = client.createUserContext(id)!
      return ctx.decide('new-checkout-flow')!.variationKey
    })
    expect(new Set(results).size).toBeGreaterThan(1)
  })
})

// --- Bot exclusion ---

describe('bot exclusion', () => {
  const botUserAgents = [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'python-requests/2.28.0',
    'curl/7.88.1',
  ]

  it.each(botUserAgents)('bot user-agent "%s" gets off for all flags', (ua) => {
    const ctx = client.createUserContext('crawler', { $userAgent: ua })!
    const decisions = ctx.decideAll()
    for (const d of Object.values(decisions)) {
      expect(d.variationKey).toBe('off')
      expect(d.enabled).toBe(false)
    }
  })

  it('real user with similar-looking UA is not treated as a bot', () => {
    const ctx = client.createUserContext('real-user', {
      $userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })!
    expect(ctx.decide('dark-mode')!.variationKey).toBe('on')
  })
})

// --- Variable access ---

describe('flag variables', () => {
  it('v2 variation returns correct variable overrides', () => {
    const ctx = client.createUserContext('user-vars')!
    const decision = ctx.decide('feature-with-vars')!
    expect(decision.variationKey).toBe('v2')
    expect(decision.variables['color']).toBe('blue')
    expect(decision.variables['count']).toBe(5)
    expect(decision.variables['enabled']).toBe(true)
  })
})

// --- Conversion tracking ---

describe('conversion tracking', () => {
  it('tracks a purchase event with value and attaches flag decisions as context', async () => {
    mockFetch.mockClear()

    const ctx = client.createUserContext('user-buyer', { plan: 'premium' })!
    ctx.decide('new-checkout-flow')
    await ctx.trackEvent('purchase', { value: 99.99, metadata: { plan: 'pro' } })

    type EventPayload = { eventKey: string; value: number; decisions: Record<string, string>; metadata: Record<string, unknown> }
    const eventsCalls = mockFetch.mock.calls.filter(([url]) =>
      url.includes('execute-api')
    )
    expect(eventsCalls.length).toBeGreaterThan(0)

    const allEvents = eventsCalls.flatMap(([, options]) => {
      const body = JSON.parse((options as RequestInit).body as string) as { events: EventPayload[] }
      return body.events
    })
    const purchaseEvent = allEvents.find((e) => e.eventKey === 'purchase')
    expect(purchaseEvent).toBeDefined()
    expect(purchaseEvent!.value).toBe(99.99)
    expect(purchaseEvent!.decisions?.['new-checkout-flow']).toBeDefined()
    expect(purchaseEvent!.metadata).toEqual({ plan: 'pro' })
  })

  it('bot users do not generate any tracking events', async () => {
    mockFetch.mockClear()

    const botCtx = client.createUserContext('scraper', {
      $userAgent: 'AhrefsBot/7.0; +http://ahrefs.com/robot/',
    })!
    botCtx.decideAll()
    await botCtx.trackEvent('purchase', { value: 200 })

    const eventsCalls = mockFetch.mock.calls.filter(([url]) =>
      url.includes('execute-api')
    )
    expect(eventsCalls.length).toBe(0)
  })

  it('targeted rule decisions do not fire exposure events', async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    mockFetch.mockClear()

    const ctx = client.createUserContext('user-targeted')!
    ctx.decide('dark-mode') // targeted rule — should NOT fire an exposure

    await new Promise((resolve) => setTimeout(resolve, 10))

    const exposureCalls = mockFetch.mock.calls.filter(([url]) =>
      url.includes('execute-api')
    )
    expect(exposureCalls.length).toBe(0)
  })

  it('ab-test decisions fire an exposure event asynchronously', async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    mockFetch.mockClear()

    const ctx = client.createUserContext('user-abtest', { plan: 'premium' })!
    ctx.decide('new-checkout-flow') // ab-test rule — SHOULD fire an exposure

    await new Promise((resolve) => setTimeout(resolve, 10))

    const exposureCalls = mockFetch.mock.calls.filter(([url]) =>
      url.includes('execute-api')
    )
    expect(exposureCalls.length).toBeGreaterThan(0)

    const body = JSON.parse(
      (exposureCalls[0] as [string, RequestInit])[1].body as string
    ) as { events: Array<{ eventKey: string }> }
    expect(body.events[0]!.eventKey).toBe('$exposure')
  })

  it('second decide for the same user/flag does not fire a duplicate exposure', async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    mockFetch.mockClear()

    const ctx = client.createUserContext('user-dedup-int', { plan: 'premium' })!
    ctx.decide('new-checkout-flow')
    await new Promise((resolve) => setTimeout(resolve, 10))

    const firstCount = mockFetch.mock.calls.filter(([url]) =>
      url.includes('execute-api')
    ).length
    mockFetch.mockClear()

    ctx.decide('new-checkout-flow') // same flag, same session
    await new Promise((resolve) => setTimeout(resolve, 10))

    const secondCount = mockFetch.mock.calls.filter(([url]) =>
      url.includes('execute-api')
    ).length

    expect(firstCount).toBeGreaterThan(0)
    expect(secondCount).toBe(0) // deduplicated by sessionStorage
  })
})
