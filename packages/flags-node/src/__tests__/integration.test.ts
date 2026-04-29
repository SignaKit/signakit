/**
 * Integration tests — "real app" simulation.
 *
 * These tests exercise the SDK exactly as an application developer would:
 * - Import only from the public API (index.ts)
 * - Create one client at startup, re-use it per request
 * - Create a new user context per incoming request
 * - No access to internal modules
 *
 * fetch is mocked to return a realistic config and accept events,
 * simulating the CloudFront CDN and the SignaKit events API.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createInstance } from '../index'
import type { SignaKitClient } from '../index'
import { mockConfig, MOCK_SDK_KEY } from './fixtures/config'

// Shared mock for all integration tests
const mockFetch = vi.fn().mockImplementation(async (url: string) => {
  if (typeof url === 'string' && url.includes('cloudfront.net')) {
    return new Response(JSON.stringify(mockConfig), {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json', etag: '"integration-etag"' }),
    })
  }
  // Events API — always accept
  return new Response(JSON.stringify({ received: true }), { status: 200 })
})

// Simulates one-time application startup: create client and wait for config to load.
let client: SignaKitClient

beforeAll(async () => {
  vi.stubGlobal('fetch', mockFetch)
  const instance = createInstance({ sdkKey: MOCK_SDK_KEY })
  expect(instance).not.toBeNull()
  client = instance!
  const { success } = await client.onReady()
  expect(success).toBe(true)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

// --- Request handling ---

describe('per-request flag evaluation', () => {
  it('premium user enters the A/B test and receives a deterministic variation', () => {
    // Simulates: GET /checkout, user = { id: 'user-premium-1', plan: 'premium' }
    const ctx = client.createUserContext('user-premium-1', { plan: 'premium' })!
    const decision = ctx.decide('new-checkout-flow')

    expect(decision).not.toBeNull()
    expect(decision!.ruleType).toBe('ab-test')
    expect(['control', 'treatment']).toContain(decision!.variationKey)
  })

  it('free user does not enter the premium A/B test rule', () => {
    // Simulates: GET /checkout, user = { id: 'user-free-1', plan: 'free' }
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

// --- Consistency across requests ---

describe('deterministic bucketing across requests', () => {
  it('same user always gets the same variation on repeated requests', () => {
    const userId = 'user-consistency-check'
    const attributes = { plan: 'premium' }

    // Simulate 10 separate requests from the same user
    const variations = Array.from({ length: 10 }, () => {
      const ctx = client.createUserContext(userId, attributes)!
      return ctx.decide('new-checkout-flow')!.variationKey
    })

    const unique = new Set(variations)
    expect(unique.size).toBe(1) // exactly one variation, always
  })

  it('different users get independently bucketed results', () => {
    const results = ['alice', 'bob', 'charlie', 'dave', 'eve'].map((id) => {
      const ctx = client.createUserContext(id)!
      return ctx.decide('new-checkout-flow')!.variationKey
    })
    // Not all users should get the exact same variation (probabilistic, but reliable)
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
    // dark-mode is 100% targeted rollout — a real user should get 'on'
    expect(ctx.decide('dark-mode')!.variationKey).toBe('on')
  })
})

// --- Variable access ---

describe('flag variables', () => {
  it('v2 variation returns correct variable overrides', () => {
    // feature-with-vars has all users in v2 via default allocation
    const ctx = client.createUserContext('user-vars')!
    const decision = ctx.decide('feature-with-vars')!
    expect(decision.variationKey).toBe('v2')
    expect(decision.variables['color']).toBe('blue') // override
    expect(decision.variables['count']).toBe(5) // override
    expect(decision.variables['enabled']).toBe(true) // default (not overridden)
  })
})

// --- Conversion tracking ---

describe('conversion tracking', () => {
  it('tracks a purchase event with value and attaches flag decisions as context', async () => {
    mockFetch.mockClear()

    // Simulate: user views the checkout, then completes a purchase
    const ctx = client.createUserContext('user-buyer', { plan: 'premium' })!
    ctx.decide('new-checkout-flow') // flags checked at start of the flow
    await ctx.trackEvent('purchase', { value: 99.99, metadata: { plan: 'pro' } })

    // decide() fires an async exposure event before trackEvent sends the purchase — find by eventKey
    type EventPayload = { eventKey: string; value: number; decisions: Record<string, string>; metadata: Record<string, unknown> }
    const eventsCalls = mockFetch.mock.calls.filter(([url]: [string]) =>
      url.includes('execute-api')
    )
    expect(eventsCalls.length).toBeGreaterThan(0)

    const allEvents = eventsCalls.flatMap(([, options]: [string, RequestInit]) => {
      const body = JSON.parse(options.body as string) as { events: EventPayload[] }
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

    const eventsCalls = mockFetch.mock.calls.filter(([url]: [string]) =>
      url.includes('execute-api')
    )
    expect(eventsCalls.length).toBe(0)
  })

  it('targeted rule decisions do not fire exposure events', async () => {
    // Wait for any pending microtasks from previous tests
    await new Promise((resolve) => setTimeout(resolve, 10))
    mockFetch.mockClear()

    const ctx = client.createUserContext('user-targeted')!
    ctx.decide('dark-mode') // targeted rule — should NOT fire an exposure event

    // Flush pending microtasks (exposure events are fire-and-forget)
    await new Promise((resolve) => setTimeout(resolve, 10))

    const exposureCalls = mockFetch.mock.calls.filter(([url]: [string]) =>
      url.includes('execute-api')
    )
    expect(exposureCalls.length).toBe(0)
  })

  it('ab-test decisions fire an exposure event asynchronously', async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    mockFetch.mockClear()

    const ctx = client.createUserContext('user-abtest', { plan: 'premium' })!
    ctx.decide('new-checkout-flow') // ab-test rule — SHOULD fire an exposure event

    // Flush pending microtasks
    await new Promise((resolve) => setTimeout(resolve, 10))

    const exposureCalls = mockFetch.mock.calls.filter(([url]: [string]) =>
      url.includes('execute-api')
    )
    expect(exposureCalls.length).toBeGreaterThan(0)

    const body = JSON.parse(
      (exposureCalls[0] as [string, RequestInit])[1].body as string
    ) as { events: Array<{ eventKey: string }> }
    expect(body.events[0]!.eventKey).toBe('$exposure')
  })
})
