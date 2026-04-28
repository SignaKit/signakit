"""Deterministic hashing for consistent user bucketing.

Implements MurmurHash3 32-bit, byte-for-byte compatible with the JS SDK
(``packages/flags-node/src/hasher.ts``) and PHP SDK (``Hasher.php``) for
ASCII-safe inputs (which is the common case for ``salt:userId``).
"""

from __future__ import annotations

from .constants import BUCKET_SPACE

_C1 = 0xCC9E2D51
_C2 = 0x1B873593
_R1 = 15
_R2 = 13
_M = 5
_N = 0xE6546B64
_MASK32 = 0xFFFFFFFF


def _rotl32(x: int, r: int) -> int:
    """Rotate ``x`` left by ``r`` bits within a 32-bit unsigned word."""
    return ((x << r) | (x >> (32 - r))) & _MASK32


def _fmix32(h: int) -> int:
    """MurmurHash3 32-bit finalisation mix."""
    h ^= h >> 16
    h = (h * 0x85EBCA6B) & _MASK32
    h ^= h >> 13
    h = (h * 0xC2B2AE35) & _MASK32
    h ^= h >> 16
    return h & _MASK32


def murmur3_32(key: str, seed: int = 0) -> int:
    """Compute MurmurHash3 32-bit of ``key`` (UTF-8) with the given seed.

    Args:
        key: Input string (encoded as UTF-8 bytes for hashing).
        seed: 32-bit seed value (default 0).

    Returns:
        Unsigned 32-bit hash value (``0`` – ``4_294_967_295``).
    """
    data = key.encode("utf-8")
    length = len(data)
    nblocks = length // 4

    h1 = seed & _MASK32

    # ---- body: process 4-byte little-endian blocks ----
    for i in range(nblocks):
        offset = i * 4
        k1 = (
            data[offset]
            | (data[offset + 1] << 8)
            | (data[offset + 2] << 16)
            | (data[offset + 3] << 24)
        )

        k1 = (k1 * _C1) & _MASK32
        k1 = _rotl32(k1, _R1)
        k1 = (k1 * _C2) & _MASK32

        h1 ^= k1
        h1 = _rotl32(h1, _R2)
        h1 = ((h1 * _M) & _MASK32) + _N
        h1 &= _MASK32

    # ---- tail: 1–3 remaining bytes ----
    tail_index = nblocks * 4
    remain = length - tail_index
    k1 = 0

    if remain == 3:
        k1 ^= data[tail_index + 2] << 16
        k1 ^= data[tail_index + 1] << 8
        k1 ^= data[tail_index]
    elif remain == 2:
        k1 ^= data[tail_index + 1] << 8
        k1 ^= data[tail_index]
    elif remain == 1:
        k1 ^= data[tail_index]

    if remain > 0:
        k1 = (k1 * _C1) & _MASK32
        k1 = _rotl32(k1, _R1)
        k1 = (k1 * _C2) & _MASK32
        h1 ^= k1

    # ---- finalisation ----
    h1 ^= length
    h1 = _fmix32(h1)
    return h1


def hash_to_bucket(salt: str, user_id: str) -> int:
    """Hash ``salt:user_id`` into a bucket in ``[0, BUCKET_SPACE)``."""
    return murmur3_32(f"{salt}:{user_id}") % BUCKET_SPACE


def hash_for_traffic(salt: str, user_id: str) -> int:
    """Bucket for traffic allocation — uses the ``:traffic`` namespace."""
    return hash_to_bucket(f"{salt}:traffic", user_id)


def hash_for_variation(salt: str, user_id: str) -> int:
    """Bucket for variation allocation — uses the ``:variation`` namespace."""
    return hash_to_bucket(f"{salt}:variation", user_id)


def hash_for_default(salt: str, user_id: str) -> int:
    """Bucket for default allocation — uses the ``:default`` namespace."""
    return hash_to_bucket(f"{salt}:default", user_id)
