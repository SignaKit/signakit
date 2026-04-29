import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createInstance, SignaKitClient } from '../client'
import { mockConfig, MOCK_SDK_KEY } from './fixtures/config'

// Builds a fetch mock that handles both the CDN config URL and the events API URL.
function makeMockFetch(configResponse?: Response) {
  return vi.fn().mockImplementation(async (url: string) => {
    if (typeof url === 'string' && url.includes('cloudfront.net')) {
      return (
        configResponse ??
        new Response(JSON.stringify(mockConfig), {
          status: 200,
          headers: new Headers({ 'content-type': 'application/json', etag: '"v1"' }),
        })
      )
    }
    // Events API
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  })
}

describe('createInstance', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeMockFetch())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('returns a SignaKitClient for a valid SDK key', () => {
    const client = createInstance({ sdkKey: MOCK_SDK_KEY })
    expect(client).toBeInstanceOf(SignaKitClient)
  })

  it('returns null for an empty SDK key', () => {
    const client = createInstance({ sdkKey: '' })
    expect(client).toBeNull()
  })

  it('returns null for a malformed SDK key', () => {
    const client = createInstance({ sdkKey: 'not-valid' })
    expect(client).toBeNull()
  })
})

describe('onReady', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    sessionStorage.clear()
  })

  it('resolves { success: true } when config is fetched successfully', async () => {
    vi.stubGlobal('fetch', makeMockFetch())
    const client = createInstance({ sdkKey: MOCK_SDK_KEY })!
    const result = await client.onReady()
    expect(result.success).toBe(true)
  })

  it('resolves { success: false, reason } when all retries fail', async () => {
    vi.useFakeTimers()
    const failFetch = vi.fn()
      .mockRejectedValueOnce(new Error('CDN unavailable'))
      .mockRejectedValueOnce(new Error('CDN unavailable'))
      .mockRejectedValueOnce(new Error('CDN unavailable'))
      .mockRejectedValueOnce(new Error('CDN unavailable'))
    vi.stubGlobal('fetch', failFetch)
    const client = createInstance({ sdkKey: MOCK_SDK_KEY })!
    // The client's initialize() starts immediately; attach a handler to onReady() before
    // advancing timers so its rejection is never briefly unhandled.
    const readyPromise = client.onReady()
    void readyPromise.catch(() => {}) // suppress unhandled during timer advancement
    await vi.runAllTimersAsync()
    const result = await readyPromise
    expect(result.success).toBe(false)
    expect(result.reason).toContain('CDN unavailable')
  })
})

describe('createUserContext', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('returns null when client is not ready', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    const client = createInstance({ sdkKey: MOCK_SDK_KEY })!
    const ctx = client.createUserContext('user-1')
    expect(ctx).toBeNull()
  })

  it('returns a user context after the client is ready', async () => {
    vi.stubGlobal('fetch', makeMockFetch())
    const client = createInstance({ sdkKey: MOCK_SDK_KEY })!
    await client.onReady()
    const ctx = client.createUserContext('user-1')
    expect(ctx).not.toBeNull()
    expect(ctx!.userId).toBe('user-1')
  })
})

// --- decide ---

describe('SignaKitUserContext.decide', () => {
  let client: SignaKitClient

  beforeEach(async () => {
    vi.stubGlobal('fetch', makeMockFetch())
    client = createInstance({ sdkKey: MOCK_SDK_KEY })!
    await client.onReady()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('returns a valid decision for a known flag', () => {
    const ctx = client.createUserContext('user-1')!
    const decision = ctx.decide('dark-mode')
    expect(decision).not.toBeNull()
    expect(decision!.flagKey).toBe('dark-mode')
    expect(decision!.variationKey).toBe('on')
    expect(decision!.enabled).toBe(true)
  })

  it('returns null for an unknown flag key', () => {
    const ctx = client.createUserContext('user-1')!
    expect(ctx.decide('does-not-exist')).toBeNull()
  })

  it('returns null for an archived flag', () => {
    const ctx = client.createUserContext('user-1')!
    expect(ctx.decide('archived-flag')).toBeNull()
  })

  it('returns off decision for a disabled flag', () => {
    const ctx = client.createUserContext('user-1')!
    const decision = ctx.decide('disabled-flag')
    expect(decision!.variationKey).toBe('off')
    expect(decision!.enabled).toBe(false)
  })

  it('returns all-off decisions for bots (via $userAgent attribute)', () => {
    const botCtx = client.createUserContext('bot-1', {
      $userAgent: 'Googlebot/2.1 (+http://www.google.com/bot.html)',
    })!
    const decision = botCtx.decide('dark-mode')
    expect(decision!.variationKey).toBe('off')
    expect(decision!.enabled).toBe(false)
    expect(decision!.ruleKey).toBeNull()
  })

  it('returns consistent decisions for the same user across calls', () => {
    const ctx1 = client.createUserContext('determinism-user')!
    const ctx2 = client.createUserContext('determinism-user')!
    expect(ctx1.decide('new-checkout-flow')?.variationKey).toBe(
      ctx2.decide('new-checkout-flow')?.variationKey
    )
  })

  it('premium users enter the ab-test rule', () => {
    const ctx = client.createUserContext('user-premium', { plan: 'premium' })!
    const decision = ctx.decide('new-checkout-flow')
    expect(decision!.ruleType).toBe('ab-test')
    expect(decision!.ruleKey).toBe('rule-premium-ab')
    expect(['control', 'treatment']).toContain(decision!.variationKey)
  })

  it('non-premium users hit the default allocation (ruleKey is null)', () => {
    const ctx = client.createUserContext('user-free', { plan: 'free' })!
    const decision = ctx.decide('new-checkout-flow')
    expect(decision!.ruleKey).toBeNull()
    expect(decision!.ruleType).toBeNull()
  })
})

// --- decideAll ---

describe('SignaKitUserContext.decideAll', () => {
  let client: SignaKitClient

  beforeEach(async () => {
    vi.stubGlobal('fetch', makeMockFetch())
    client = createInstance({ sdkKey: MOCK_SDK_KEY })!
    await client.onReady()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('returns decisions for all non-archived flags', () => {
    const ctx = client.createUserContext('user-all')!
    const decisions = ctx.decideAll()
    expect(Object.keys(decisions)).toHaveLength(5)
    expect(decisions['archived-flag']).toBeUndefined()
  })

  it('returns all-off for every flag when the user is a bot', () => {
    const botCtx = client.createUserContext('crawler', {
      $userAgent: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    })!
    const decisions = botCtx.decideAll()
    for (const d of Object.values(decisions)) {
      expect(d.variationKey).toBe('off')
      expect(d.enabled).toBe(false)
    }
  })
})

// --- trackEvent ---

describe('SignaKitUserContext.trackEvent', () => {
  let mockFetch: ReturnType<typeof vi.fn>
  let client: SignaKitClient

  beforeEach(async () => {
    // Disable sendBeacon so events fall back to fetch (easier to inspect)
    Object.defineProperty(navigator, 'sendBeacon', {
      value: undefined,
      configurable: true,
      writable: true,
    })
    mockFetch = makeMockFetch()
    vi.stubGlobal('fetch', mockFetch)
    client = createInstance({ sdkKey: MOCK_SDK_KEY })!
    await client.onReady()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  function lastEventPayload() {
    const eventsCalls = mockFetch.mock.calls.filter(([url]) =>
      url.includes('execute-api')
    )
    const lastCall = eventsCalls[eventsCalls.length - 1] as [string, RequestInit] | undefined
    if (!lastCall) return null
    return JSON.parse(lastCall[1].body as string) as { events: Array<Record<string, unknown>> }
  }

  it('sends an event with the correct eventKey and userId', async () => {
    const ctx = client.createUserContext('user-track')!
    await ctx.trackEvent('purchase')
    const payload = lastEventPayload()
    expect(payload).not.toBeNull()
    const event = payload!.events[0]!
    expect(event['eventKey']).toBe('purchase')
    expect(event['userId']).toBe('user-track')
  })

  it('includes value and metadata when provided', async () => {
    const ctx = client.createUserContext('user-value')!
    await ctx.trackEvent('purchase', { value: 49.99, metadata: { productId: 'pro' } })
    const event = lastEventPayload()!.events[0]!
    expect(event['value']).toBe(49.99)
    expect(event['metadata']).toEqual({ productId: 'pro' })
  })

  it('includes cached flag decisions in the event payload', async () => {
    const ctx = client.createUserContext('user-attrib', { plan: 'premium' })!
    ctx.decide('dark-mode')
    await ctx.trackEvent('checkout')
    const event = lastEventPayload()!.events[0]!
    const decisions = event['decisions'] as Record<string, string>
    expect(decisions['dark-mode']).toBeDefined()
  })

  it('truncates eventKey to 100 characters', async () => {
    const longKey = 'a'.repeat(200)
    const ctx = client.createUserContext('user-trunc')!
    await ctx.trackEvent(longKey)
    const event = lastEventPayload()!.events[0]!
    expect((event['eventKey'] as string).length).toBe(100)
  })

  it('silently skips trackEvent for bot users', async () => {
    const callsBefore = mockFetch.mock.calls.filter(([url]) =>
      url.includes('execute-api')
    ).length

    const botCtx = client.createUserContext('bot', {
      $userAgent: 'python-requests/2.28.0',
    })!
    await botCtx.trackEvent('purchase')

    const callsAfter = mockFetch.mock.calls.filter(([url]) =>
      url.includes('execute-api')
    ).length
    expect(callsAfter).toBe(callsBefore)
  })

  it('drops metadata that exceeds 5000 bytes', async () => {
    const hugeMeta = { data: 'x'.repeat(6000) }
    const ctx = client.createUserContext('user-bigmeta')!
    await ctx.trackEvent('test', { metadata: hugeMeta })
    const event = lastEventPayload()!.events[0]!
    expect(event['metadata']).toBeUndefined()
  })
})

// --- sendBeacon ---

describe('sendBeacon delivery', () => {
  let mockFetch: ReturnType<typeof vi.fn>
  let client: SignaKitClient

  beforeEach(async () => {
    mockFetch = makeMockFetch()
    vi.stubGlobal('fetch', mockFetch)
    client = createInstance({ sdkKey: MOCK_SDK_KEY })!
    await client.onReady()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('uses navigator.sendBeacon when available and returns true', async () => {
    const mockBeacon = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'sendBeacon', {
      value: mockBeacon,
      configurable: true,
      writable: true,
    })

    const ctx = client.createUserContext('user-beacon')!
    await ctx.trackEvent('purchase')

    expect(mockBeacon).toHaveBeenCalledOnce()
    // With sendBeacon succeeding, fetch should not be called for the event
    const eventsCalls = mockFetch.mock.calls.filter(([url]) =>
      url.includes('execute-api')
    )
    expect(eventsCalls.length).toBe(0)
  })

  it('falls back to fetch when sendBeacon returns false', async () => {
    const mockBeacon = vi.fn().mockReturnValue(false)
    Object.defineProperty(navigator, 'sendBeacon', {
      value: mockBeacon,
      configurable: true,
      writable: true,
    })

    const ctx = client.createUserContext('user-beacon-fallback')!
    await ctx.trackEvent('purchase')

    expect(mockBeacon).toHaveBeenCalledOnce()
    const eventsCalls = mockFetch.mock.calls.filter(([url]) =>
      url.includes('execute-api')
    )
    expect(eventsCalls.length).toBeGreaterThan(0)
  })
})

// --- sessionStorage deduplication ---

describe('exposure deduplication via sessionStorage', () => {
  let mockFetch: ReturnType<typeof vi.fn>
  let client: SignaKitClient

  beforeEach(async () => {
    sessionStorage.clear()
    // Disable sendBeacon so exposure events use fetch (easier to count)
    Object.defineProperty(navigator, 'sendBeacon', {
      value: undefined,
      configurable: true,
      writable: true,
    })
    mockFetch = makeMockFetch()
    vi.stubGlobal('fetch', mockFetch)
    client = createInstance({ sdkKey: MOCK_SDK_KEY })!
    await client.onReady()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('only fires one exposure event per user/flag combination per session', async () => {
    const ctx = client.createUserContext('user-dedup', { plan: 'premium' })!

    // First decide — should fire an exposure
    ctx.decide('new-checkout-flow')
    await new Promise((resolve) => setTimeout(resolve, 10))

    const exposuresAfterFirst = mockFetch.mock.calls.filter(([url]) =>
      url.includes('execute-api')
    ).length

    mockFetch.mockClear()

    // Second decide for the same flag — deduplication should suppress the exposure
    ctx.decide('new-checkout-flow')
    await new Promise((resolve) => setTimeout(resolve, 10))

    const exposuresAfterSecond = mockFetch.mock.calls.filter(([url]) =>
      url.includes('execute-api')
    ).length

    expect(exposuresAfterFirst).toBeGreaterThan(0)
    expect(exposuresAfterSecond).toBe(0) // deduped
  })

  it('a different user does not share dedup state', async () => {
    const ctx1 = client.createUserContext('user-a', { plan: 'premium' })!
    const ctx2 = client.createUserContext('user-b', { plan: 'premium' })!

    ctx1.decide('new-checkout-flow')
    await new Promise((resolve) => setTimeout(resolve, 10))
    mockFetch.mockClear()

    // Different userId — should fire its own exposure
    ctx2.decide('new-checkout-flow')
    await new Promise((resolve) => setTimeout(resolve, 10))

    const exposures = mockFetch.mock.calls.filter(([url]) =>
      url.includes('execute-api')
    )
    expect(exposures.length).toBeGreaterThan(0)
  })
})

// --- Auto bot detection from navigator.userAgent ---

describe('auto bot detection from navigator.userAgent', () => {
  let client: SignaKitClient

  beforeEach(async () => {
    vi.stubGlobal('fetch', makeMockFetch())
    client = createInstance({ sdkKey: MOCK_SDK_KEY })!
    await client.onReady()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('detects bot from navigator.userAgent when no $userAgent attribute is provided', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      configurable: true,
      writable: true,
    })

    const ctx = client.createUserContext('crawler')!
    const decisions = ctx.decideAll()
    for (const d of Object.values(decisions)) {
      expect(d.variationKey).toBe('off')
      expect(d.enabled).toBe(false)
    }
  })

  it('$userAgent attribute overrides navigator.userAgent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      configurable: true,
      writable: true,
    })

    // Explicitly passing a real browser UA overrides the bot navigator.userAgent
    const ctx = client.createUserContext('real-user', {
      $userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })!
    expect(ctx.decide('dark-mode')!.variationKey).toBe('on')
  })
})

// --- Attribute sanitization ---

describe('attribute sanitization', () => {
  let client: SignaKitClient

  beforeEach(async () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      value: undefined,
      configurable: true,
      writable: true,
    })
    vi.stubGlobal('fetch', makeMockFetch())
    client = createInstance({ sdkKey: MOCK_SDK_KEY })!
    await client.onReady()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('$userAgent is stripped from user attributes (not sent to events API)', async () => {
    const mockFetch2 = makeMockFetch()
    vi.stubGlobal('fetch', mockFetch2)

    const ctx = client.createUserContext('user-ua', {
      $userAgent: 'Mozilla/5.0',
      plan: 'premium',
    })!
    await ctx.trackEvent('test')

    const eventsCalls = mockFetch2.mock.calls.filter(([url]) =>
      url.includes('execute-api')
    )
    const body = JSON.parse((eventsCalls[0] as [string, RequestInit])[1].body as string) as {
      events: Array<{ attributes?: Record<string, unknown> }>
    }
    const attrs = body.events[0]?.attributes
    expect(attrs?.['$userAgent']).toBeUndefined()
    expect(attrs?.['plan']).toBe('premium')
  })
})
