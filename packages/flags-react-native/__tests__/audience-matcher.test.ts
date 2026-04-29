import { matchesCondition, matchesAudience, matchesAudiences } from '../src/audience-matcher'
import type { AudienceCondition, ConfigRuleAudience } from '../src/types'

// --- matchesCondition ---

describe('matchesCondition — equals / not_equals', () => {
  it('equals: matches identical string values', () => {
    const cond: AudienceCondition = { attribute: 'plan', operator: 'equals', value: 'premium' }
    expect(matchesCondition(cond, { plan: 'premium' })).toBe(true)
  })

  it('equals: rejects different string values', () => {
    const cond: AudienceCondition = { attribute: 'plan', operator: 'equals', value: 'premium' }
    expect(matchesCondition(cond, { plan: 'free' })).toBe(false)
  })

  it('equals: matches boolean values', () => {
    const cond: AudienceCondition = { attribute: 'verified', operator: 'equals', value: true }
    expect(matchesCondition(cond, { verified: true })).toBe(true)
    expect(matchesCondition(cond, { verified: false })).toBe(false)
  })

  it('not_equals: matches when values differ', () => {
    const cond: AudienceCondition = { attribute: 'plan', operator: 'not_equals', value: 'premium' }
    expect(matchesCondition(cond, { plan: 'free' })).toBe(true)
    expect(matchesCondition(cond, { plan: 'premium' })).toBe(false)
  })

  it('returns false when attribute is missing', () => {
    const cond: AudienceCondition = { attribute: 'plan', operator: 'equals', value: 'premium' }
    expect(matchesCondition(cond, {})).toBe(false)
    expect(matchesCondition(cond, undefined)).toBe(false)
  })
})

describe('matchesCondition — numeric comparisons', () => {
  const age = (op: AudienceCondition['operator'], value: number): AudienceCondition => ({
    attribute: 'age',
    operator: op,
    value,
  })

  it('greater_than: true when user value exceeds threshold', () => {
    expect(matchesCondition(age('greater_than', 18), { age: 25 })).toBe(true)
    expect(matchesCondition(age('greater_than', 18), { age: 18 })).toBe(false)
    expect(matchesCondition(age('greater_than', 18), { age: 10 })).toBe(false)
  })

  it('less_than: true when user value is below threshold', () => {
    expect(matchesCondition(age('less_than', 18), { age: 10 })).toBe(true)
    expect(matchesCondition(age('less_than', 18), { age: 18 })).toBe(false)
    expect(matchesCondition(age('less_than', 18), { age: 25 })).toBe(false)
  })

  it('greater_than_or_equals: inclusive upper bound', () => {
    expect(matchesCondition(age('greater_than_or_equals', 18), { age: 18 })).toBe(true)
    expect(matchesCondition(age('greater_than_or_equals', 18), { age: 17 })).toBe(false)
  })

  it('less_than_or_equals: inclusive lower bound', () => {
    expect(matchesCondition(age('less_than_or_equals', 18), { age: 18 })).toBe(true)
    expect(matchesCondition(age('less_than_or_equals', 18), { age: 19 })).toBe(false)
  })

  it('numeric operators return false on string attribute values', () => {
    expect(matchesCondition(age('greater_than', 18), { age: '25' as unknown as number })).toBe(
      false
    )
  })
})

describe('matchesCondition — in / not_in', () => {
  it('in: true when user value is in the list', () => {
    const cond: AudienceCondition = {
      attribute: 'country',
      operator: 'in',
      value: ['US', 'CA', 'GB'],
    }
    expect(matchesCondition(cond, { country: 'US' })).toBe(true)
    expect(matchesCondition(cond, { country: 'DE' })).toBe(false)
  })

  it('in: false when value is not an array', () => {
    const cond: AudienceCondition = {
      attribute: 'country',
      operator: 'in',
      value: 'US' as unknown as string[],
    }
    expect(matchesCondition(cond, { country: 'US' })).toBe(false)
  })

  it('not_in: true when user value is absent from the list', () => {
    const cond: AudienceCondition = {
      attribute: 'country',
      operator: 'not_in',
      value: ['US', 'CA'],
    }
    expect(matchesCondition(cond, { country: 'DE' })).toBe(true)
    expect(matchesCondition(cond, { country: 'US' })).toBe(false)
  })

  it('not_in: returns true when value is not an array (vacuously true)', () => {
    const cond: AudienceCondition = {
      attribute: 'country',
      operator: 'not_in',
      value: 'US' as unknown as string[],
    }
    expect(matchesCondition(cond, { country: 'US' })).toBe(true)
  })
})

describe('matchesCondition — contains / not_contains', () => {
  it('contains: true when string includes substring', () => {
    const cond: AudienceCondition = { attribute: 'email', operator: 'contains', value: '@acme' }
    expect(matchesCondition(cond, { email: 'bob@acme.com' })).toBe(true)
    expect(matchesCondition(cond, { email: 'bob@gmail.com' })).toBe(false)
  })

  it('contains: true when string array includes the value', () => {
    const cond: AudienceCondition = { attribute: 'tags', operator: 'contains', value: 'beta' }
    expect(matchesCondition(cond, { tags: ['alpha', 'beta', 'gamma'] })).toBe(true)
    expect(matchesCondition(cond, { tags: ['alpha', 'gamma'] })).toBe(false)
  })

  it('not_contains: true when string does not include substring', () => {
    const cond: AudienceCondition = {
      attribute: 'email',
      operator: 'not_contains',
      value: '@acme',
    }
    expect(matchesCondition(cond, { email: 'bob@gmail.com' })).toBe(true)
    expect(matchesCondition(cond, { email: 'bob@acme.com' })).toBe(false)
  })

  it('not_contains: true when array does not include value', () => {
    const cond: AudienceCondition = { attribute: 'tags', operator: 'not_contains', value: 'beta' }
    expect(matchesCondition(cond, { tags: ['alpha', 'gamma'] })).toBe(true)
    expect(matchesCondition(cond, { tags: ['alpha', 'beta'] })).toBe(false)
  })

  it('not_contains: returns true when types do not match (vacuously true)', () => {
    const cond: AudienceCondition = {
      attribute: 'score',
      operator: 'not_contains',
      value: 'high',
    }
    // score is a number, not a string or array — vacuously true
    expect(matchesCondition(cond, { score: 42 })).toBe(true)
  })
})

// --- matchesAudience ---

describe('matchesAudience', () => {
  it('returns true when all conditions match (AND logic)', () => {
    const audience: ConfigRuleAudience = {
      conditions: [
        { attribute: 'plan', operator: 'equals', value: 'premium' },
        { attribute: 'age', operator: 'greater_than_or_equals', value: 18 },
      ],
    }
    expect(matchesAudience(audience, { plan: 'premium', age: 25 })).toBe(true)
  })

  it('returns false when any condition fails', () => {
    const audience: ConfigRuleAudience = {
      conditions: [
        { attribute: 'plan', operator: 'equals', value: 'premium' },
        { attribute: 'age', operator: 'greater_than_or_equals', value: 18 },
      ],
    }
    expect(matchesAudience(audience, { plan: 'premium', age: 16 })).toBe(false)
  })

  it('returns true for an audience with no conditions', () => {
    const audience: ConfigRuleAudience = { conditions: [] }
    expect(matchesAudience(audience, {})).toBe(true)
  })
})

// --- matchesAudiences ---

describe('matchesAudiences', () => {
  it('returns true when audiences are undefined or empty (matches all users)', () => {
    expect(matchesAudiences(undefined, 'any', {})).toBe(true)
    expect(matchesAudiences([], 'any', {})).toBe(true)
  })

  it('any: returns true when at least one audience matches (OR logic)', () => {
    const audiences: ConfigRuleAudience[] = [
      { conditions: [{ attribute: 'plan', operator: 'equals', value: 'premium' }] },
      { conditions: [{ attribute: 'plan', operator: 'equals', value: 'enterprise' }] },
    ]
    expect(matchesAudiences(audiences, 'any', { plan: 'premium' })).toBe(true)
    expect(matchesAudiences(audiences, 'any', { plan: 'free' })).toBe(false)
  })

  it('all: returns true only when every audience matches (AND logic)', () => {
    const audiences: ConfigRuleAudience[] = [
      { conditions: [{ attribute: 'plan', operator: 'equals', value: 'premium' }] },
      { conditions: [{ attribute: 'verified', operator: 'equals', value: true }] },
    ]
    expect(matchesAudiences(audiences, 'all', { plan: 'premium', verified: true })).toBe(true)
    expect(matchesAudiences(audiences, 'all', { plan: 'premium', verified: false })).toBe(false)
  })

  it('defaults to ALL logic when matchType is undefined', () => {
    const audiences: ConfigRuleAudience[] = [
      { conditions: [{ attribute: 'plan', operator: 'equals', value: 'premium' }] },
      { conditions: [{ attribute: 'verified', operator: 'equals', value: true }] },
    ]
    expect(matchesAudiences(audiences, undefined, { plan: 'premium', verified: true })).toBe(true)
    expect(matchesAudiences(audiences, undefined, { plan: 'premium', verified: false })).toBe(false)
  })
})
