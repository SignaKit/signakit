import { describe, it, expect } from 'vitest'
import { hashToBucket, hashForTraffic, hashForVariation, hashForDefault } from '../hasher'

const BUCKET_MAX = 9999

describe('hashToBucket', () => {
  it('returns a value within [0, 9999]', () => {
    const result = hashToBucket('my-salt', 'user-123')
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(BUCKET_MAX)
  })

  it('is deterministic — same inputs always produce same output', () => {
    const a = hashToBucket('flag-salt', 'user-abc')
    const b = hashToBucket('flag-salt', 'user-abc')
    expect(a).toBe(b)
  })

  it('produces different buckets for different user IDs', () => {
    const buckets = new Set(
      ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'].map((id) =>
        hashToBucket('same-salt', id)
      )
    )
    // With 5 distinct users hashed to a 10000-bucket space, collisions are extremely unlikely
    expect(buckets.size).toBeGreaterThan(1)
  })

  it('produces different buckets for different salts with the same user ID', () => {
    const a = hashToBucket('salt-a', 'user-1')
    const b = hashToBucket('salt-b', 'user-1')
    // Different salts should almost never produce the same bucket
    expect(a).not.toBe(b)
  })

  it('handles empty strings without throwing', () => {
    expect(() => hashToBucket('', '')).not.toThrow()
    const result = hashToBucket('', '')
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(BUCKET_MAX)
  })

  it('handles long strings without throwing', () => {
    const longSalt = 'a'.repeat(1000)
    const longUserId = 'b'.repeat(1000)
    expect(() => hashToBucket(longSalt, longUserId)).not.toThrow()
    const result = hashToBucket(longSalt, longUserId)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(BUCKET_MAX)
  })
})

describe('hashForTraffic / hashForVariation / hashForDefault', () => {
  it('each returns a value within [0, 9999]', () => {
    const salt = 'test-salt'
    const userId = 'user-xyz'
    expect(hashForTraffic(salt, userId)).toBeGreaterThanOrEqual(0)
    expect(hashForTraffic(salt, userId)).toBeLessThanOrEqual(BUCKET_MAX)
    expect(hashForVariation(salt, userId)).toBeGreaterThanOrEqual(0)
    expect(hashForVariation(salt, userId)).toBeLessThanOrEqual(BUCKET_MAX)
    expect(hashForDefault(salt, userId)).toBeGreaterThanOrEqual(0)
    expect(hashForDefault(salt, userId)).toBeLessThanOrEqual(BUCKET_MAX)
  })

  it('traffic, variation, and default namespaces produce independent buckets', () => {
    // Using the same salt+userId, the three functions should produce different results
    // (not guaranteed in theory, but with MurmurHash3 it holds for any reasonable input)
    const traffic = hashForTraffic('checkout-salt', 'user-namespace-test')
    const variation = hashForVariation('checkout-salt', 'user-namespace-test')
    const fallback = hashForDefault('checkout-salt', 'user-namespace-test')
    // At least two of the three should differ (ensures namespace separation works)
    const unique = new Set([traffic, variation, fallback])
    expect(unique.size).toBeGreaterThan(1)
  })

  it('each function is deterministic', () => {
    const salt = 'determinism-salt'
    const userId = 'user-det'
    expect(hashForTraffic(salt, userId)).toBe(hashForTraffic(salt, userId))
    expect(hashForVariation(salt, userId)).toBe(hashForVariation(salt, userId))
    expect(hashForDefault(salt, userId)).toBe(hashForDefault(salt, userId))
  })
})
