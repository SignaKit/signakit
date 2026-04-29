"""Hasher tests — cross-platform vectors and behavioural properties.

Cross-platform vectors below were pre-computed by running the same MurmurHash3
algorithm in the JS SDK. Any change to these values means server- and
client-side bucketing will disagree.
"""

from __future__ import annotations

import pytest

from signakit_flags.hasher import (
    hash_for_default,
    hash_for_traffic,
    hash_for_variation,
    hash_to_bucket,
    murmur3_32,
)


# ---------------------------------------------------------------------------
# Cross-platform hash vectors (must match flags-node and flags-browser)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "salt,user_id,expected",
    [
        ("salt1", "user-1", 148),
        ("salt1", "user-2", 6905),
        ("flag-abc", "user-123", 7424),
        ("", "x", 4973),
        ("hello", "world", 7566),
    ],
)
def test_hash_to_bucket_canonical_cross_platform_vectors(
    salt: str, user_id: str, expected: int
) -> None:
    assert hash_to_bucket(salt, user_id) == expected


def test_namespaced_helpers_canonical_cross_platform_values() -> None:
    assert hash_for_traffic("flag-abc", "user-123") == 8406
    assert hash_for_variation("flag-abc", "user-123") == 2804
    assert hash_for_default("flag-abc", "user-123") == 6466


# ---------------------------------------------------------------------------
# Python-specific raw-hash vectors (additionally verify murmur3_32 output)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "salt,user_id,expected_raw,expected_bucket",
    [
        ("", "", 723937430, 7430),
        ("a", "b", 2722392131, 2131),
        ("flag-1", "user-123", 1828635123, 5123),
        ("salt", "user-1", 284266604, 6604),
        ("salt", "user-2", 4225422170, 2170),
        ("salt", "user-3", 1711596482, 6482),
        ("my-flag-salt", "alice", 2680087070, 7070),
        ("my-flag-salt", "bob", 197736267, 6267),
        ("x", "y", 1402315819, 5819),
        ("abcd", "wxyz", 91575904, 5904),
    ],
)
def test_hash_to_bucket_python_raw_vectors(
    salt: str, user_id: str, expected_raw: int, expected_bucket: int
) -> None:
    assert murmur3_32(f"{salt}:{user_id}") == expected_raw
    assert hash_to_bucket(salt, user_id) == expected_bucket


def test_namespaced_helpers_python_vectors() -> None:
    assert hash_for_traffic("flag-1", "user-123") == 6509
    assert hash_for_variation("flag-1", "user-123") == 8299
    assert hash_for_default("flag-1", "user-123") == 5572
    assert hash_for_traffic("salt", "alice") == 9411
    assert hash_for_variation("salt", "alice") == 1218
    assert hash_for_default("salt", "alice") == 5830


# ---------------------------------------------------------------------------
# Range bounds
# ---------------------------------------------------------------------------


def test_hash_to_bucket_returns_value_within_0_to_9999() -> None:
    result = hash_to_bucket("my-salt", "user-123")
    assert 0 <= result <= 9999


def test_all_namespaced_helpers_return_value_within_0_to_9999() -> None:
    for fn in (hash_for_traffic, hash_for_variation, hash_for_default):
        result = fn("test-salt", "user-xyz")
        assert 0 <= result <= 9999


def test_buckets_in_range_over_many_users() -> None:
    for i in range(500):
        b = hash_to_bucket("salt", f"user-{i}")
        assert 0 <= b <= 9999


# ---------------------------------------------------------------------------
# Determinism
# ---------------------------------------------------------------------------


def test_hash_to_bucket_is_deterministic() -> None:
    assert hash_to_bucket("flag-salt", "user-abc") == hash_to_bucket("flag-salt", "user-abc")


def test_each_namespaced_helper_is_deterministic() -> None:
    for fn in (hash_for_traffic, hash_for_variation, hash_for_default):
        assert fn("determinism-salt", "user-det") == fn("determinism-salt", "user-det")


# ---------------------------------------------------------------------------
# Distinctness
# ---------------------------------------------------------------------------


def test_produces_different_buckets_for_different_user_ids() -> None:
    buckets = {hash_to_bucket("same-salt", f"user-{i}") for i in range(1, 6)}
    # With 5 distinct users in a 10 000-bucket space, collisions are extremely unlikely
    assert len(buckets) > 1


def test_produces_different_buckets_for_different_salts() -> None:
    a = hash_to_bucket("salt-a", "user-1")
    b = hash_to_bucket("salt-b", "user-1")
    assert a != b


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


def test_handles_empty_strings_without_raising() -> None:
    result = hash_to_bucket("", "")
    assert 0 <= result <= 9999


def test_handles_long_strings_without_raising() -> None:
    result = hash_to_bucket("a" * 1000, "b" * 1000)
    assert 0 <= result <= 9999


# ---------------------------------------------------------------------------
# Namespace independence
# ---------------------------------------------------------------------------


def test_traffic_variation_and_default_namespaces_produce_independent_buckets() -> None:
    traffic = hash_for_traffic("checkout-salt", "user-namespace-test")
    variation = hash_for_variation("checkout-salt", "user-namespace-test")
    default = hash_for_default("checkout-salt", "user-namespace-test")
    # At least two of the three should differ — ensures namespace separation works
    assert len({traffic, variation, default}) > 1
