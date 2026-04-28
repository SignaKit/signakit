"""Hasher parity tests — reference values produced by the JS SDK."""

from __future__ import annotations

import pytest

from signakit_flags.hasher import (
    hash_for_default,
    hash_for_traffic,
    hash_for_variation,
    hash_to_bucket,
    murmur3_32,
)


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
def test_hash_to_bucket_matches_js_reference(
    salt: str, user_id: str, expected_raw: int, expected_bucket: int
) -> None:
    assert murmur3_32(f"{salt}:{user_id}") == expected_raw
    assert hash_to_bucket(salt, user_id) == expected_bucket


def test_namespaced_hashes_match_js_reference() -> None:
    # flag-1 / user-123
    assert hash_for_traffic("flag-1", "user-123") == 6509
    assert hash_for_variation("flag-1", "user-123") == 8299
    assert hash_for_default("flag-1", "user-123") == 5572
    # salt / alice
    assert hash_for_traffic("salt", "alice") == 9411
    assert hash_for_variation("salt", "alice") == 1218
    assert hash_for_default("salt", "alice") == 5830


def test_buckets_in_range() -> None:
    for i in range(500):
        b = hash_to_bucket("salt", f"user-{i}")
        assert 0 <= b < 10000


def test_determinism() -> None:
    assert hash_to_bucket("s", "u") == hash_to_bucket("s", "u")
    assert hash_for_traffic("s", "u") == hash_for_traffic("s", "u")
