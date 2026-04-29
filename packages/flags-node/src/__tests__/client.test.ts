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
  })

  it('resolves { success: true } when config is fetched successfully', async () => {
    vi.stubGlobal('fetch', makeMockFetch())
    const client = createInstance({ sdkKey: MOCK_SDK_KEY })!
    const result = await client.onReady()
    expect(result.success).toBe(true)
  })

  it('resolves { success: false, reason } when fetch fails', async () => {
    const failFetch = vi.fn().mockRejectedValue(new Error('CDN unavailable'))
    vi.stubGlobal('fetch', failFetch)
    const client = createInstance({ sdkKey: MOCK_SDK_KEY })!
    const result = await client.onReady()
    expect(result.success).toBe(false)
    expect(result.reason).toContain('CDN unavailable')
  })

  it('resolves { success: false } on a non-2xx CDN response', async () => {
    const errorFetch = vi.fn().mockResolvedValue(new Response('Not Found', { status: 404, statusText: 'Not Found' }))
    vi.stubGlobal('fetch', errorFetch)
    const client = createInstance({ sdkKey: MOCK_SDK_KEY })!
    const result = await client.onReady()
    expect(result.success).toBe(false)
    expect(result.reason).toContain('404')
  })
})

describe('createUserContext', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when client is not ready', () => {
    // Do NOT await onReady — client is still initializing
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
  })

  it('returns a valid decision for a known flag', () => {
    const ctx = client.createUserContext('user-1')!
    const decision = ctx.decide('dark-mode')
    expect(decision).not.toBeNull()
    expect(decision!.flagKey).toBe('dark-mode')
    expect(decision!.variationKey).toBe('on') // targeted 100% rollout
    expect(decision!.enabled).toBe(true)
  })

  it('returns null for an unknown flag key', () => {
    const ctx = client.createUserContext('user-1')!
    const decision = ctx.decide('does-not-exist')
    expect(decision).toBeNull()
  })

  it('returns null for an archived flag', () => {
    const ctx = client.createUserContext('user-1')!
    const decision = ctx.decide('archived-flag')
    expect(decision).toBeNull()
  })

  it('returns off decision for a disabled flag', () => {
    const ctx = client.createUserContext('user-1')!
    const decision = ctx.decide('disabled-flag')
    expect(decision!.variationKey).toBe('off')
    expect(decision!.enabled).toBe(false)
  })

  it('returns all-off decisions for bots', () => {
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

  it('premium users enter the ab-test rule (not the default allocation)', () => {
    const ctx = client.createUserContext('user-premium', { plan: 'premium' })!
    const decision = ctx.decide('new-checkout-flow')
    // Premium rule forces into the ab-test — ruleType must be 'ab-test'
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
  })

  it('returns decisions for all non-archived flags', () => {
    const ctx = client.createUserContext('user-all')!
    const decisions = ctx.decideAll()
    // mockConfig has 6 flags but 1 is archived — 5 decisions expected
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
    mockFetch = makeMockFetch()
    vi.stubGlobal('fetch', mockFetch)
    client = createInstance({ sdkKey: MOCK_SDK_KEY })!
    await client.onReady()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function lastEventPayload() {
    const eventsCalls = mockFetch.mock.calls.filter(([url]: [string]) =>
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

  it('attaches the X-SDK-Key header to the event request', async () => {
    const ctx = client.createUserContext('user-header')!
    await ctx.trackEvent('signup')
    const eventsCalls = mockFetch.mock.calls.filter(([url]: [string]) =>
      url.includes('execute-api')
    )
    const headers = (eventsCalls[0] as [string, RequestInit])[1].headers as Record<string, string>
    expect(headers['X-SDK-Key']).toBe(MOCK_SDK_KEY)
  })

  it('includes cached flag decisions in the event payload', async () => {
    const ctx = client.createUserContext('user-attrib', { plan: 'premium' })!
    ctx.decide('dark-mode') // populates cachedDecisions
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
    const callsBefore = mockFetch.mock.calls.filter(([url]: [string]) =>
      url.includes('execute-api')
    ).length

    const botCtx = client.createUserContext('bot', {
      $userAgent: 'python-requests/2.28.0',
    })!
    await botCtx.trackEvent('purchase')

    const callsAfter = mockFetch.mock.calls.filter(([url]: [string]) =>
      url.includes('execute-api')
    ).length
    expect(callsAfter).toBe(callsBefore) // no new calls
  })

  it('drops metadata that exceeds 5000 bytes', async () => {
    const hugeMeta = { data: 'x'.repeat(6000) }
    const ctx = client.createUserContext('user-bigmeta')!
    await ctx.trackEvent('test', { metadata: hugeMeta })
    const event = lastEventPayload()!.events[0]!
    expect(event['metadata']).toBeUndefined()
  })
})

// --- Attribute sanitization ---

describe('attribute sanitization', () => {
  let client: SignaKitClient

  beforeEach(async () => {
    vi.stubGlobal('fetch', makeMockFetch())
    client = createInstance({ sdkKey: MOCK_SDK_KEY })!
    await client.onReady()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('$userAgent is stripped from user attributes (not sent to events API)', async () => {
    const mockFetch2 = makeMockFetch()
    vi.stubGlobal('fetch', mockFetch2)

    const ctx = client.createUserContext('user-ua', {
      $userAgent: 'Mozilla/5.0',
      plan: 'premium',
    })!
    await ctx.trackEvent('test')

    const eventsCalls = mockFetch2.mock.calls.filter(([url]: [string]) =>
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
