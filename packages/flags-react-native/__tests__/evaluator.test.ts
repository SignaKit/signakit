import { evaluateFlag, evaluateAllFlags } from '../src/evaluator'
import type { ConfigFlag, ProjectConfig } from '../src/types'

function makeFlag(overrides: Partial<ConfigFlag> = {}): ConfigFlag {
  return {
    id: 'f1',
    key: 'flag-1',
    salt: 'salt1',
    status: 'active',
    running: true,
    variations: [{ key: 'on' }, { key: 'off' }],
    allocation: { ranges: [{ variation: 'on', start: 0, end: 9999 }] },
    ...overrides,
  }
}

describe('evaluator', () => {
  test('archived flags return null', () => {
    const flag = makeFlag({ status: 'archived' })
    expect(evaluateFlag(flag, 'u1')).toBeNull()
  })

  test('non-running flags return off / disabled', () => {
    const flag = makeFlag({ running: false })
    const result = evaluateFlag(flag, 'u1')
    expect(result).toEqual({
      variationKey: 'off',
      enabled: false,
      ruleKey: null,
      ruleType: null,
      variables: {},
    })
  })

  test('default allocation returns the only variation when 100% on', () => {
    const flag = makeFlag()
    const result = evaluateFlag(flag, 'user-1')
    expect(result?.variationKey).toBe('on')
    expect(result?.enabled).toBe(true)
    expect(result?.ruleKey).toBeNull()
    expect(result?.ruleType).toBeNull()
  })

  test('allowlist short-circuits to assigned variation', () => {
    const flag = makeFlag({
      rules: [
        {
          ruleKey: 'r1',
          ruleType: 'targeted',
          trafficPercentage: 0,
          variationAllocation: { ranges: [{ variation: 'on', start: 0, end: 9999 }] },
          allowlist: [{ userId: 'special', variation: 'on' }],
        },
      ],
    })
    const result = evaluateFlag(flag, 'special')
    expect(result?.variationKey).toBe('on')
    expect(result?.ruleKey).toBe('r1')
    expect(result?.ruleType).toBe('targeted')
  })

  test('rule with audiences and 100% traffic assigns ab-test variation', () => {
    const flag = makeFlag({
      rules: [
        {
          ruleKey: 'r-ab',
          ruleType: 'ab-test',
          audienceMatchType: 'all',
          audiences: [
            { conditions: [{ attribute: 'plan', operator: 'equals', value: 'pro' }] },
          ],
          trafficPercentage: 100,
          variationAllocation: {
            ranges: [
              { variation: 'on', start: 0, end: 4999 },
              { variation: 'off', start: 5000, end: 9999 },
            ],
          },
        },
      ],
    })
    const result = evaluateFlag(flag, 'user-1', { plan: 'pro' })
    expect(result?.ruleKey).toBe('r-ab')
    expect(result?.ruleType).toBe('ab-test')
    expect(['on', 'off']).toContain(result?.variationKey)
  })

  test('user not in audience falls through to default allocation (no rule attribution)', () => {
    const flag = makeFlag({
      rules: [
        {
          ruleKey: 'r-ab',
          ruleType: 'ab-test',
          audienceMatchType: 'all',
          audiences: [
            { conditions: [{ attribute: 'plan', operator: 'equals', value: 'pro' }] },
          ],
          trafficPercentage: 100,
          variationAllocation: {
            ranges: [{ variation: 'on', start: 0, end: 9999 }],
          },
        },
      ],
    })
    const result = evaluateFlag(flag, 'user-1', { plan: 'free' })
    expect(result?.ruleKey).toBeNull()
    expect(result?.ruleType).toBeNull()
  })

  test('evaluateAllFlags excludes archived flags', () => {
    const config: ProjectConfig = {
      projectId: 'p',
      environmentKey: 'production',
      sdkKey: 'sk_prod_o_1_x',
      version: 1,
      generatedAt: new Date().toISOString(),
      flags: [
        makeFlag({ key: 'a' }),
        makeFlag({ key: 'b', status: 'archived' }),
      ],
    }
    const decisions = evaluateAllFlags(config, 'u1')
    expect(Object.keys(decisions).sort()).toEqual(['a'])
  })

  test('variables resolve to flag-level defaults plus variation overrides', () => {
    const flag = makeFlag({
      variations: [
        { key: 'on', variables: { color: 'blue' } },
        { key: 'off' },
      ],
      variables: [
        { key: 'color', type: 'string', defaultValue: 'red' },
        { key: 'size', type: 'number', defaultValue: 12 },
      ],
    })
    const result = evaluateFlag(flag, 'user-1')
    expect(result?.variables).toEqual({ color: 'blue', size: 12 })
  })
})
