import { matchesCondition, matchesAudiences } from '../src/audience-matcher'
import type { AudienceCondition, ConfigRuleAudience } from '../src/types'

const cond = (
  attribute: string,
  operator: AudienceCondition['operator'],
  value: AudienceCondition['value']
): AudienceCondition => ({ attribute, operator, value })

describe('matchesCondition — operators', () => {
  test('equals / not_equals on strings', () => {
    expect(matchesCondition(cond('plan', 'equals', 'pro'), { plan: 'pro' })).toBe(true)
    expect(matchesCondition(cond('plan', 'equals', 'pro'), { plan: 'free' })).toBe(false)
    expect(matchesCondition(cond('plan', 'not_equals', 'pro'), { plan: 'free' })).toBe(true)
  })

  test('numeric comparisons', () => {
    const attrs = { age: 25 }
    expect(matchesCondition(cond('age', 'greater_than', 18), attrs)).toBe(true)
    expect(matchesCondition(cond('age', 'less_than', 30), attrs)).toBe(true)
    expect(matchesCondition(cond('age', 'greater_than_or_equals', 25), attrs)).toBe(true)
    expect(matchesCondition(cond('age', 'less_than_or_equals', 24), attrs)).toBe(false)
    // type mismatch returns false
    expect(matchesCondition(cond('age', 'greater_than', 18), { age: 'old' })).toBe(false)
  })

  test('in / not_in', () => {
    expect(matchesCondition(cond('country', 'in', ['US', 'CA']), { country: 'US' })).toBe(true)
    expect(matchesCondition(cond('country', 'in', ['US', 'CA']), { country: 'UK' })).toBe(false)
    expect(matchesCondition(cond('country', 'not_in', ['US']), { country: 'UK' })).toBe(true)
  })

  test('contains / not_contains on strings and arrays', () => {
    expect(matchesCondition(cond('name', 'contains', 'foo'), { name: 'foobar' })).toBe(true)
    expect(matchesCondition(cond('name', 'not_contains', 'foo'), { name: 'bar' })).toBe(true)
    expect(matchesCondition(cond('tags', 'contains', 'beta'), { tags: ['alpha', 'beta'] })).toBe(
      true
    )
  })

  test('missing attribute never matches (except not_in / not_contains semantics already require attribute)', () => {
    expect(matchesCondition(cond('plan', 'equals', 'pro'), {})).toBe(false)
  })
})

describe('matchesAudiences — any vs all', () => {
  const aud = (...conditions: AudienceCondition[]): ConfigRuleAudience => ({ conditions })

  test('no audiences matches everyone', () => {
    expect(matchesAudiences(undefined, undefined, {})).toBe(true)
    expect(matchesAudiences([], 'all', {})).toBe(true)
  })

  test("'all' requires every audience to match", () => {
    const audiences = [
      aud(cond('plan', 'equals', 'pro')),
      aud(cond('country', 'equals', 'US')),
    ]
    expect(matchesAudiences(audiences, 'all', { plan: 'pro', country: 'US' })).toBe(true)
    expect(matchesAudiences(audiences, 'all', { plan: 'pro', country: 'UK' })).toBe(false)
  })

  test("'any' requires at least one audience to match", () => {
    const audiences = [
      aud(cond('plan', 'equals', 'pro')),
      aud(cond('country', 'equals', 'US')),
    ]
    expect(matchesAudiences(audiences, 'any', { plan: 'free', country: 'US' })).toBe(true)
    expect(matchesAudiences(audiences, 'any', { plan: 'free', country: 'UK' })).toBe(false)
  })
})
