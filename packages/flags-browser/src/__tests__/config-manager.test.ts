import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConfigManager, parseSdkKey } from '../config-manager'
import { mockConfig } from './fixtures/config'

// --- parseSdkKey ---

describe('parseSdkKey', () => {
  it('parses a valid dev key', () => {
    const result = parseSdkKey('sk_dev_org123_proj456_random789')
    expect(result.orgId).toBe('org123')
    expect(result.projectId).toBe('proj456')
    expect(result.environment).toBe('development')
  })

  it('parses a valid prod key', () => {
    const result = parseSdkKey('sk_prod_orgABC_projXYZ_suffix')
    expect(result.orgId).toBe('orgABC')
    expect(result.projectId).toBe('projXYZ')
    expect(result.environment).toBe('production')
  })

  it('throws on missing sk prefix', () => {
    expect(() => parseSdkKey('dev_org123_proj456_random')).toThrow(/Invalid SDK key format/)
  })

  it('throws when fewer than 5 underscore-separated parts', () => {
    expect(() => parseSdkKey('sk_dev_org123_proj456')).toThrow(/Invalid SDK key format/)
  })

  it('throws on unknown environment token', () => {
    expect(() => parseSdkKey('sk_stg_org123_proj456_random')).toThrow(
      /Invalid SDK key environment/
    )
  })

  it('throws on an empty string', () => {
    expect(() => parseSdkKey('')).toThrow(/Invalid SDK key format/)
  })
})

// --- ConfigManager ---

describe('ConfigManager', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  function makeManager() {
    return new ConfigManager({ orgId: 'org123', projectId: 'proj123', environment: 'development' })
  }

  function okResponse(etag?: string) {
    const headers = new Headers({ 'content-type': 'application/json' })
    if (etag) headers.set('etag', etag)
    return new Response(JSON.stringify(mockConfig), { status: 200, headers })
  }

  it('getConfig returns null before first fetch', () => {
    const manager = makeManager()
    expect(manager.getConfig()).toBeNull()
  })

  it('fetchConfig returns the parsed config on 200', async () => {
    mockFetch.mockResolvedValueOnce(okResponse())
    const manager = makeManager()
    const config = await manager.fetchConfig()
    expect(config.projectId).toBe(mockConfig.projectId)
    expect(manager.getConfig()).not.toBeNull()
  })

  it('constructs the correct CloudFront URL', async () => {
    mockFetch.mockResolvedValueOnce(okResponse())
    const manager = makeManager()
    await manager.fetchConfig()
    const [url] = mockFetch.mock.calls[0] as [string]
    expect(url).toContain('cloudfront.net')
    expect(url).toContain('/org123/')
    expect(url).toContain('/proj123/')
    expect(url).toContain('/development/')
    expect(url).toContain('latest.json')
  })

  it('stores ETag from the first response', async () => {
    mockFetch.mockResolvedValueOnce(okResponse('"etag-v1"'))
    const manager = makeManager()
    await manager.fetchConfig()

    mockFetch.mockResolvedValueOnce(new Response(null, { status: 304 }))
    await manager.fetchConfig()

    const secondCallHeaders = (mockFetch.mock.calls[1] as [string, RequestInit])[1]?.headers as
      | Record<string, string>
      | undefined
    expect(secondCallHeaders?.['If-None-Match']).toBe('"etag-v1"')
  })

  it('returns the cached config on a 304 Not Modified response', async () => {
    mockFetch.mockResolvedValueOnce(okResponse('"etag-v1"'))
    const manager = makeManager()
    await manager.fetchConfig()

    mockFetch.mockResolvedValueOnce(new Response(null, { status: 304 }))
    const config = await manager.fetchConfig()

    expect(config.projectId).toBe(mockConfig.projectId)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('does not send If-None-Match on the first request', async () => {
    mockFetch.mockResolvedValueOnce(okResponse())
    const manager = makeManager()
    await manager.fetchConfig()

    const firstCallHeaders = (mockFetch.mock.calls[0] as [string, RequestInit])[1]?.headers as
      | Record<string, string>
      | undefined
    expect(firstCallHeaders?.['If-None-Match']).toBeUndefined()
  })

  // --- Retry logic ---

  it('retries once on a transient failure and succeeds on the second attempt', async () => {
    vi.useFakeTimers()
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(okResponse())

    const manager = makeManager()
    const fetchPromise = manager.fetchConfig()
    await vi.runAllTimersAsync()

    const config = await fetchPromise
    expect(config.projectId).toBe(mockConfig.projectId)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws after all 4 attempts fail', async () => {
    vi.useFakeTimers()
    mockFetch
      .mockRejectedValueOnce(new Error('Persistent failure'))
      .mockRejectedValueOnce(new Error('Persistent failure'))
      .mockRejectedValueOnce(new Error('Persistent failure'))
      .mockRejectedValueOnce(new Error('Persistent failure'))

    const manager = makeManager()
    const fetchPromise = manager.fetchConfig()
    // Attach the rejection handler BEFORE advancing timers so the rejection is
    // never in an unhandled state when it fires during runAllTimersAsync.
    const assertion = expect(fetchPromise).rejects.toThrow('Persistent failure')
    await vi.runAllTimersAsync()
    await assertion
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })

  it('throws on non-2xx responses after retrying (e.g. 403 Forbidden)', async () => {
    vi.useFakeTimers()
    const forbidden = () => new Response('Forbidden', { status: 403, statusText: 'Forbidden' })
    mockFetch
      .mockResolvedValueOnce(forbidden())
      .mockResolvedValueOnce(forbidden())
      .mockResolvedValueOnce(forbidden())
      .mockResolvedValueOnce(forbidden())

    const manager = makeManager()
    const fetchPromise = manager.fetchConfig()
    // Attach before advancing so the rejection is immediately handled
    const assertion = expect(fetchPromise).rejects.toThrow('403')
    await vi.runAllTimersAsync()
    await assertion
  })
})
