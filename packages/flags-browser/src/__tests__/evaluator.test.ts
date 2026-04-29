import { describe, it, expect } from 'vitest'
import { evaluateFlag, evaluateAllFlags } from '../evaluator'
import type { ConfigFlag, ProjectConfig } from '../types'

function makeFlag(overrides: Partial<ConfigFlag> & Pick<ConfigFlag, 'key'>): ConfigFlag {
  return {
    id: `flag_${overrides.key}`,
    status: 'active',
    running: true,
    salt: `${overrides.key}-salt`,
    variations: [{ key: 'off' }, { key: 'on' }],
    allocation: { ranges: [{ variation: 'on', start: 0, end: 9999 }] },
    ...overrides,
  }
}

// --- Status / running checks ---

describe('evaluateFlag — archived and disabled states', () => {
  it('returns null for archived flags (excluded from results)', () => {
    const flag = makeFlag({ key: 'archived', status: 'archived' })
    expect(evaluateFlag(flag, 'user-1')).toBeNull()
  })

  it('returns off decision for flags with running=false', () => {
    const flag = makeFlag({ key: 'disabled', running: false })
    const result = evaluateFlag(flag, 'user-1')
    expect(result).not.toBeNull()
    expect(result!.variationKey).toBe('off')
    expect(result!.enabled).toBe(false)
    expect(result!.ruleKey).toBeNull()
    expect(result!.ruleType).toBeNull()
  })
})

// --- Allowlist ---

describe('evaluateFlag — allowlist', () => {
  const flag = makeFlag({
    key: 'allowlist',
    allocation: { ranges: [{ variation: 'off', start: 0, end: 9999 }] },
    rules: [
      {
        ruleKey: 'rule-qa',
        ruleType: 'targeted',
        trafficPercentage: 0,
        variationAllocation: { ranges: [{ variation: 'on', start: 0, end: 9999 }] },
        allowlist: [
          { userId: 'qa-user', variation: 'on' },
          { userId: 'qa-off-user', variation: 'off' },
        ],
      },
    ],
  })

  it('returns the allowlisted variation for a listed user', () => {
    const result = evaluateFlag(flag, 'qa-user')
    expect(result!.variationKey).toBe('on')
    expect(result!.enabled).toBe(true)
    expect(result!.ruleKey).toBe('rule-qa')
    expect(result!.ruleType).toBe('targeted')
  })

  it("returns the allowlisted 'off' variation when explicitly set", () => {
    const result = evaluateFlag(flag, 'qa-off-user')
    expect(result!.variationKey).toBe('off')
    expect(result!.enabled).toBe(false)
  })

  it('falls through to default allocation for non-allowlisted users', () => {
    const result = evaluateFlag(flag, 'random-user')
    expect(result!.variationKey).toBe('off')
    expect(result!.ruleKey).toBeNull()
  })
})

// --- Traffic allocation ---

describe('evaluateFlag — traffic allocation', () => {
  it('places all users in traffic when trafficPercentage=100', () => {
    const flag = makeFlag({
      key: 'full-traffic',
      rules: [
        {
          ruleKey: 'rule-all',
          ruleType: 'ab-test',
          trafficPercentage: 100,
          variationAllocation: { ranges: [{ variation: 'on', start: 0, end: 9999 }] },
        },
      ],
    })
    const result = evaluateFlag(flag, 'any-user')
    expect(result!.variationKey).toBe('on')
    expect(result!.ruleKey).toBe('rule-all')
  })

  it('places no users in traffic when trafficPercentage=0', () => {
    const flag = makeFlag({
      key: 'zero-traffic',
      allocation: { ranges: [{ variation: 'off', start: 0, end: 9999 }] },
      rules: [
        {
          ruleKey: 'rule-none',
          ruleType: 'ab-test',
          trafficPercentage: 0,
          variationAllocation: { ranges: [{ variation: 'on', start: 0, end: 9999 }] },
        },
      ],
    })
    const result = evaluateFlag(flag, 'any-user')
    expect(result!.variationKey).toBe('off')
    expect(result!.ruleKey).toBeNull()
  })
})

// --- Audience matching ---

describe('evaluateFlag — audience targeting', () => {
  const flag = makeFlag({
    key: 'targeted',
    allocation: { ranges: [{ variation: 'off', start: 0, end: 9999 }] },
    rules: [
      {
        ruleKey: 'rule-premium',
        ruleType: 'ab-test',
        audienceMatchType: 'any',
        audiences: [
          { conditions: [{ attribute: 'plan', operator: 'equals', value: 'premium' }] },
        ],
        trafficPercentage: 100,
        variationAllocation: { ranges: [{ variation: 'on', start: 0, end: 9999 }] },
      },
    ],
  })

  it('matches the rule for a user whose attributes satisfy the audience', () => {
    const result = evaluateFlag(flag, 'premium-user', { plan: 'premium' })
    expect(result!.variationKey).toBe('on')
    expect(result!.ruleKey).toBe('rule-premium')
  })

  it('falls through to default for a user who does not match the audience', () => {
    const result = evaluateFlag(flag, 'free-user', { plan: 'free' })
    expect(result!.variationKey).toBe('off')
    expect(result!.ruleKey).toBeNull()
  })

  it('falls through to default when user has no attributes', () => {
    const result = evaluateFlag(flag, 'attr-less-user')
    expect(result!.variationKey).toBe('off')
    expect(result!.ruleKey).toBeNull()
  })
})

// --- Default allocation ---

describe('evaluateFlag — default allocation (no rules match)', () => {
  it('uses default allocation when no rules exist', () => {
    const flag = makeFlag({
      key: 'no-rules',
      allocation: { ranges: [{ variation: 'on', start: 0, end: 9999 }] },
    })
    const result = evaluateFlag(flag, 'user-1')
    expect(result!.variationKey).toBe('on')
    expect(result!.enabled).toBe(true)
    expect(result!.ruleKey).toBeNull()
    expect(result!.ruleType).toBeNull()
  })

  it('returns off fallback when default allocation ranges are empty', () => {
    const flag = makeFlag({
      key: 'empty-alloc',
      allocation: { ranges: [] },
    })
    const result = evaluateFlag(flag, 'user-1')
    expect(result!.variationKey).toBe('off')
    expect(result!.enabled).toBe(false)
  })
})

// --- Variable resolution ---

describe('evaluateFlag — variable resolution', () => {
  const flag: ConfigFlag = {
    id: 'flag_vars',
    key: 'vars-flag',
    status: 'active',
    running: true,
    salt: 'vars-salt',
    variations: [
      { key: 'off' },
      { key: 'v1' },
      { key: 'v2', variables: { color: 'blue', count: 5 } },
    ],
    variables: [
      { key: 'color', type: 'string', defaultValue: 'red' },
      { key: 'count', type: 'number', defaultValue: 1 },
      { key: 'enabled', type: 'boolean', defaultValue: true },
    ],
    allocation: { ranges: [] },
  }

  it('returns all-default variables for a variation with no overrides', () => {
    const flagV1 = { ...flag, allocation: { ranges: [{ variation: 'v1', start: 0, end: 9999 }] } }
    const result = evaluateFlag(flagV1, 'user-1')
    expect(result!.variationKey).toBe('v1')
    expect(result!.variables).toEqual({ color: 'red', count: 1, enabled: true })
  })

  it('merges variation overrides with flag-level defaults', () => {
    const flagV2 = { ...flag, allocation: { ranges: [{ variation: 'v2', start: 0, end: 9999 }] } }
    const result = evaluateFlag(flagV2, 'user-1')
    expect(result!.variationKey).toBe('v2')
    expect(result!.variables).toEqual({ color: 'blue', count: 5, enabled: true })
  })

  it('returns empty variables object when flag has no variables defined', () => {
    const noVarFlag = makeFlag({
      key: 'no-vars',
      allocation: { ranges: [{ variation: 'on', start: 0, end: 9999 }] },
    })
    const result = evaluateFlag(noVarFlag, 'user-1')
    expect(result!.variables).toEqual({})
  })
})

// --- Determinism ---

describe('evaluateFlag — deterministic bucketing', () => {
  it('always assigns the same variation to the same user', () => {
    const flag = makeFlag({
      key: 'determinism',
      allocation: {
        ranges: [
          { variation: 'off', start: 0, end: 4999 },
          { variation: 'on', start: 5000, end: 9999 },
        ],
      },
    })
    const results = Array.from({ length: 10 }, () => evaluateFlag(flag, 'user-stable'))
    const variations = results.map((r) => r!.variationKey)
    expect(new Set(variations).size).toBe(1)
  })
})

// --- evaluateAllFlags ---

describe('evaluateAllFlags', () => {
  const config: ProjectConfig = {
    projectId: 'p1',
    environmentKey: 'development',
    sdkKey: 'sk_dev_org1_p1_xxx',
    version: 1,
    generatedAt: '2024-01-01T00:00:00.000Z',
    flags: [
      makeFlag({ key: 'active-a' }),
      makeFlag({ key: 'active-b' }),
      makeFlag({ key: 'archived-c', status: 'archived' }),
    ],
  }

  it('returns decisions for all non-archived flags', () => {
    const decisions = evaluateAllFlags(config, 'user-1')
    expect(Object.keys(decisions)).toHaveLength(2)
    expect(decisions['active-a']).toBeDefined()
    expect(decisions['active-b']).toBeDefined()
    expect(decisions['archived-c']).toBeUndefined()
  })

  it('includes flagKey on each decision', () => {
    const decisions = evaluateAllFlags(config, 'user-1')
    expect(decisions['active-a']!.flagKey).toBe('active-a')
    expect(decisions['active-b']!.flagKey).toBe('active-b')
  })
})
