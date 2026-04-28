/// Deterministic hashing for consistent user bucketing.
///
/// Port of `packages/flags-node/src/hasher.ts`. This implementation MUST
/// produce the same bucket numbers as the Node, Browser, PHP, and other
/// SDKs for the same `salt:userId` input — that's how cross-SDK
/// consistency is guaranteed.
library;

import 'constants.dart';

const int _mask32 = 0xFFFFFFFF;

/// 32-bit unsigned multiplication (matches `Math.imul` semantics in JS).
int _mul32(int a, int b) {
  // Multiplying two 32-bit values can overflow 53-bit JS doubles, but Dart
  // ints are 64-bit on native — and on web they wrap mod 2^32 via this mask.
  final aLow = a & 0xFFFF;
  final aHigh = (a >> 16) & 0xFFFF;
  final bLow = b & 0xFFFF;
  final bHigh = (b >> 16) & 0xFFFF;
  // Only the low 32 bits of (a * b); high*high overflow is discarded.
  final low = aLow * bLow;
  final mid = ((aLow * bHigh) + (aHigh * bLow)) & 0xFFFF;
  return (low + (mid << 16)) & _mask32;
}

int _rotl32(int x, int r) {
  return ((x << r) | (x >> (32 - r))) & _mask32;
}

/// MurmurHash3 32-bit. Matches the JS reference byte-for-byte.
///
/// Operates on UTF-16 code units of [key] (same as JS `charCodeAt`).
int murmur3_32(String key, [int seed = 0]) {
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  const r1 = 15;
  const r2 = 13;
  const m = 5;
  const n = 0xe6546b64;

  int hash = seed & _mask32;
  final units = key.codeUnits;
  final len = units.length;
  final blocks = len ~/ 4;

  // Process 4-byte blocks.
  for (int i = 0; i < blocks; i++) {
    int k = (units[i * 4] & 0xff) |
        ((units[i * 4 + 1] & 0xff) << 8) |
        ((units[i * 4 + 2] & 0xff) << 16) |
        ((units[i * 4 + 3] & 0xff) << 24);

    k = _mul32(k, c1);
    k = _rotl32(k, r1);
    k = _mul32(k, c2);

    hash ^= k;
    hash = _rotl32(hash, r2);
    hash = (_mul32(hash, m) + n) & _mask32;
  }

  // Tail.
  int k = 0;
  final tailIndex = blocks * 4;
  final remaining = len & 3;

  if (remaining >= 3) {
    k ^= (units[tailIndex + 2] & 0xff) << 16;
  }
  if (remaining >= 2) {
    k ^= (units[tailIndex + 1] & 0xff) << 8;
  }
  if (remaining >= 1) {
    k ^= units[tailIndex] & 0xff;
    k = _mul32(k, c1);
    k = _rotl32(k, r1);
    k = _mul32(k, c2);
    hash ^= k;
  }

  // Finalization mix.
  hash ^= len;
  hash ^= (hash >> 16) & _mask32;
  hash = _mul32(hash, 0x85ebca6b);
  hash ^= (hash >> 13) & _mask32;
  hash = _mul32(hash, 0xc2b2ae35);
  hash ^= (hash >> 16) & _mask32;

  return hash & _mask32;
}

/// Hash a user into a bucket [0, kBucketSpace).
int hashToBucket(String salt, String userId) {
  final key = '$salt:$userId';
  final hash = murmur3_32(key);
  return hash % kBucketSpace;
}

/// Traffic-allocation bucket (independent namespace).
int hashForTraffic(String salt, String userId) =>
    hashToBucket('$salt:traffic', userId);

/// Variation-allocation bucket (independent namespace).
int hashForVariation(String salt, String userId) =>
    hashToBucket('$salt:variation', userId);

/// Default-allocation bucket (independent namespace).
int hashForDefault(String salt, String userId) =>
    hashToBucket('$salt:default', userId);
