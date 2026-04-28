package com.signakit.flags;

import com.signakit.flags.hasher.Hasher;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Locked-in known-vector tests. Vectors generated from the reference
 * TypeScript hasher in {@code packages/flags-node/src/hasher.ts} via
 * {@code scripts/gen-vectors.js}. If these break we have diverged from the
 * Node SDK and bucket placement will differ across SDKs for the same user.
 */
class HasherTest {

    @Test
    void murmur3_matchesReferenceVectors() {
        assertEquals(423220888L, Hasher.murmur3_32("abc:user-1"));
        assertEquals(1040599059L, Hasher.murmur3_32("abc:user-2"));
        assertEquals(2680087070L, Hasher.murmur3_32("my-flag-salt:alice"));
        assertEquals(197736267L, Hasher.murmur3_32("my-flag-salt:bob"));
        assertEquals(1402315819L, Hasher.murmur3_32("x:y"));
        assertEquals(157399362L, Hasher.murmur3_32(":abc"));
        assertEquals(4029070510L, Hasher.murmur3_32("a:abcd"));
    }

    @Test
    void hashToBucket_matchesReferenceVectors() {
        assertEquals(888, Hasher.hashToBucket("abc", "user-1"));
        assertEquals(9059, Hasher.hashToBucket("abc", "user-2"));
        assertEquals(7070, Hasher.hashToBucket("my-flag-salt", "alice"));
        assertEquals(6267, Hasher.hashToBucket("my-flag-salt", "bob"));
        assertEquals(5819, Hasher.hashToBucket("x", "y"));
        assertEquals(9362, Hasher.hashToBucket("", "abc"));
        assertEquals(510, Hasher.hashToBucket("a", "abcd"));
    }

    @Test
    void namespacedBuckets_matchReference() {
        assertEquals(6589, Hasher.hashForTraffic("my-flag-salt", "user-1"));
        assertEquals(19, Hasher.hashForVariation("my-flag-salt", "user-1"));
        assertEquals(5916, Hasher.hashForDefault("my-flag-salt", "user-1"));
    }

    @Test
    void buckets_areInRange() {
        for (int i = 0; i < 1000; i++) {
            int b = Hasher.hashToBucket("salt", "user-" + i);
            assertEquals(true, b >= 0 && b < Constants.BUCKET_SPACE);
        }
    }
}
