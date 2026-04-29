/**
 * Exposure POST behavior tests.
 *
 * Verifies the hard requirement: when `decision.ruleType === 'targeted'`,
 * the SDK MUST NOT fire a `$exposure` event.
 */

import { SignaKitClient } from '../src/client'
import { SIGNAKIT_EVENTS_URL } from '../src/constants'
import type { ProjectConfig } from '../src/types'

function makeConfig(): ProjectConfig {
  return {
    projectId: '1',
    environmentKey: 'production',
    sdkKey: 'sk_prod_org_1_xyz',
    version: 1,
    generatedAt: new Date().toISOString(),
    flags: [
      // Targeted rule: should NOT fire exposure.
      {
        id: 'tf',
        key: 'targeted-flag',
        salt: 's-targeted',
        status: 'active',
        running: true,
        variations: [{ key: 'on' }, { key: 'off' }],
        allocation: { ranges: [{ variation: 'off', start: 0, end: 9999 }] },
        rules: [
          {
            ruleKey: 'r-tgt',
            ruleType: 'targeted',
            trafficPercentage: 100,
            variationAllocation: { ranges: [{ variation: 'on', start: 0, end: 9999 }] },
          },
        ],
      },
      // A/B test rule: SHOULD fire exposure.
      {
        id: 'af',
        key: 'ab-flag',
        salt: 's-ab',
        status: 'active',
        running: true,
        variations: [{ key: 'on' }, { key: 'off' }],
        allocation: { ranges: [{ variation: 'off', start: 0, end: 9999 }] },
        rules: [
          {
            ruleKey: 'r-ab',
            ruleType: 'ab-test',
            trafficPercentage: 100,
            variationAllocation: { ranges: [{ variation: 'on', start: 0, end: 9999 }] },
          },
        ],
      },
    ],
  }
}

type FetchCall = { url: string; method: string; body: unknown }

function installFetchMock(configFetchUrlMatcher: (url: string) => boolean): {
  calls: FetchCall[]
  restore: () => void
} {
  const calls: FetchCall[] = []
  const original = (global as unknown as { fetch?: typeof fetch }).fetch
  const config = makeConfig()

  const mock = jest.fn(async (url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase()
    let parsedBody: unknown = undefined
    if (init?.body && typeof init.body === 'string') {
      try {
        parsedBody = JSON.parse(init.body)
      } catch {
        parsedBody = init.body
      }
    }
    calls.push({ url, method, body: parsedBody })

    // Config CDN GET
    if (configFetchUrlMatcher(url)) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: (_h: string) => null },
        json: async () => config,
      } as unknown as Response
    }

    // Events POST
    if (url === SIGNAKIT_EVENTS_URL) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: (_h: string) => null },
        json: async () => ({}),
      } as unknown as Response
    }

    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: (_h: string) => null },
      json: async () => ({}),
    } as unknown as Response
  })
  ;(global as unknown as { fetch: unknown }).fetch = mock as unknown as typeof fetch

  return {
    calls,
    restore: () => {
      ;(global as unknown as { fetch?: typeof fetch }).fetch = original
    },
  }
}

describe('exposure tracking', () => {
  let calls: FetchCall[]
  let restore: () => void

  beforeEach(() => {
    const m = installFetchMock((u) => u.includes('/configs/'))
    calls = m.calls
    restore = m.restore
  })

  afterEach(() => {
    restore()
  })

  test('targeted-rule decisions do NOT fire $exposure', async () => {
    const client = new SignaKitClient({ sdkKey: 'sk_prod_org_1_xyz' })
    const ready = await client.onReady()
    expect(ready.success).toBe(true)

    const ctx = client.createUserContext('user-1')
    const decision = ctx?.decide('targeted-flag')
    expect(decision?.ruleType).toBe('targeted')
    expect(decision?.variationKey).toBe('on')

    // Allow microtasks to drain so any (incorrect) fire-and-forget fetch
    // would have been recorded.
    await Promise.resolve()
    await Promise.resolve()

    const exposurePosts = calls.filter(
      (c) => c.url === SIGNAKIT_EVENTS_URL && c.method === 'POST'
    )
    expect(exposurePosts).toHaveLength(0)
  })

  test('ab-test decisions DO fire a $exposure POST', async () => {
    const client = new SignaKitClient({ sdkKey: 'sk_prod_org_1_xyz' })
    await client.onReady()

    const ctx = client.createUserContext('user-1')
    const decision = ctx?.decide('ab-flag')
    expect(decision?.ruleType).toBe('ab-test')

    // Wait for the fire-and-forget fetch to actually be invoked.
    await new Promise((r) => setTimeout(r, 0))

    const exposurePosts = calls.filter(
      (c) => c.url === SIGNAKIT_EVENTS_URL && c.method === 'POST'
    )
    expect(exposurePosts).toHaveLength(1)
    const body = exposurePosts[0]!.body as { events: Array<{ eventKey: string; metadata: { flagKey: string; ruleKey: string } }> }
    expect(body.events[0]!.eventKey).toBe('$exposure')
    expect(body.events[0]!.metadata.flagKey).toBe('ab-flag')
    expect(body.events[0]!.metadata.ruleKey).toBe('r-ab')
  })

  test('exposure dedupes per session (same flag + same user)', async () => {
    const client = new SignaKitClient({ sdkKey: 'sk_prod_org_1_xyz' })
    await client.onReady()

    const ctx = client.createUserContext('user-1')
    ctx?.decide('ab-flag')
    ctx?.decide('ab-flag')
    ctx?.decide('ab-flag')

    await new Promise((r) => setTimeout(r, 0))

    const exposurePosts = calls.filter(
      (c) => c.url === SIGNAKIT_EVENTS_URL && c.method === 'POST'
    )
    expect(exposurePosts).toHaveLength(1)
  })
})
