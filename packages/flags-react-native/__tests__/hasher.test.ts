import {
  hashToBucket,
  hashForTraffic,
  hashForVariation,
  hashForDefault,
} from '../src/hasher'

describe('hasher — known bucket vectors (must match flags-node)', () => {
  // Pre-computed by running the same algorithm in Node. If any of these
  // change, server- and client-side bucketing will disagree.
  test.each([
    ['salt1', 'user-1', 148],
    ['salt1', 'user-2', 6905],
    ['flag-abc', 'user-123', 7424],
    ['', 'x', 4973],
    ['hello', 'world', 7566],
  ])('hashToBucket(%j, %j) === %i', (salt, userId, expected) => {
    expect(hashToBucket(salt, userId)).toBe(expected)
  })

  test('namespaced helpers use {salt}:{ns}:{userId}', () => {
    expect(hashForTraffic('flag-abc', 'user-123')).toBe(8406)
    expect(hashForVariation('flag-abc', 'user-123')).toBe(2804)
    expect(hashForDefault('flag-abc', 'user-123')).toBe(6466)
  })

  test('buckets are within [0, 9999]', () => {
    for (let i = 0; i < 200; i++) {
      const b = hashToBucket('s', `user-${i}`)
      expect(b).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThan(10000)
    }
  })

  test('hashing is deterministic', () => {
    expect(hashToBucket('foo', 'bar')).toBe(hashToBucket('foo', 'bar'))
  })
})
