/**
 * Deterministic hashing for consistent user bucketing.
 *
 * Uses MurmurHash3 (32-bit) for fast, uniform hash distribution.
 * The same userId + salt combination always produces the same bucket.
 *
 * IMPORTANT: This is a faithful port of `@signakit/flags-node`'s hasher and
 * MUST produce identical bucket numbers for the same `salt:userId` so that
 * server- and client-side evaluation agree.
 */

import { BUCKET_SPACE } from './constants'

/**
 * MurmurHash3 32-bit implementation
 * Based on the original algorithm by Austin Appleby
 */
function murmur3_32(key: string, seed: number = 0): number {
  const c1 = 0xcc9e2d51
  const c2 = 0x1b873593
  const r1 = 15
  const r2 = 13
  const m = 5
  const n = 0xe6546b64

  let hash = seed >>> 0
  const len = key.length
  const blocks = Math.floor(len / 4)

  for (let i = 0; i < blocks; i++) {
    let k =
      (key.charCodeAt(i * 4) & 0xff) |
      ((key.charCodeAt(i * 4 + 1) & 0xff) << 8) |
      ((key.charCodeAt(i * 4 + 2) & 0xff) << 16) |
      ((key.charCodeAt(i * 4 + 3) & 0xff) << 24)

    k = Math.imul(k, c1)
    k = (k << r1) | (k >>> (32 - r1))
    k = Math.imul(k, c2)

    hash ^= k
    hash = (hash << r2) | (hash >>> (32 - r2))
    hash = Math.imul(hash, m) + n
  }

  let k = 0
  const tailIndex = blocks * 4

  switch (len & 3) {
    case 3:
      k ^= (key.charCodeAt(tailIndex + 2) & 0xff) << 16
    // falls through
    case 2:
      k ^= (key.charCodeAt(tailIndex + 1) & 0xff) << 8
    // falls through
    case 1:
      k ^= key.charCodeAt(tailIndex) & 0xff
      k = Math.imul(k, c1)
      k = (k << r1) | (k >>> (32 - r1))
      k = Math.imul(k, c2)
      hash ^= k
  }

  // Finalization
  hash ^= len
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0xc2b2ae35)
  hash ^= hash >>> 16

  return hash >>> 0
}

/** Hash a user into a bucket (0-9999). */
export function hashToBucket(salt: string, userId: string): number {
  const key = `${salt}:${userId}`
  const hash = murmur3_32(key)
  return hash % BUCKET_SPACE
}

export function hashForTraffic(salt: string, userId: string): number {
  return hashToBucket(`${salt}:traffic`, userId)
}

export function hashForVariation(salt: string, userId: string): number {
  return hashToBucket(`${salt}:variation`, userId)
}

export function hashForDefault(salt: string, userId: string): number {
  return hashToBucket(`${salt}:default`, userId)
}
