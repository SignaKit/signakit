package com.signakit.flags;

import com.signakit.flags.hasher.Hasher;
import org.junit.jupiter.api.Test;

import java.util.stream.IntStream;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Locked-in known-vector tests. Vectors generated from the reference TypeScript
 * hasher in {@code packages/flags-node/src/hasher.ts}. If these break we have
 * diverged from the other SDKs and bucket placement will differ across platforms
 * for the same user.
 */
class HasherTest {

    // -------------------------------------------------------------------------
    // Cross-platform vectors (must match flags-node, flags-python, flags-php,
    // flags-flutter, flags-golang)
    // -------------------------------------------------------------------------

    @Test
    void crossPlatformVectors_hashToBucket() {
        assertEquals(148,  Hasher.hashToBucket("salt1",    "user-1"));
        assertEquals(6905, Hasher.hashToBucket("salt1",    "user-2"));
        assertEquals(7424, Hasher.hashToBucket("flag-abc", "user-123"));
        assertEquals(4973, Hasher.hashToBucket("",         "x"));
        assertEquals(7566, Hasher.hashToBucket("hello",    "world"));
    }

    @Test
    void crossPlatformVectors_namespacedHelpers() {
        assertEquals(8406, Hasher.hashForTraffic("flag-abc",   "user-123"));
        assertEquals(2804, Hasher.hashForVariation("flag-abc", "user-123"));
        assertEquals(6466, Hasher.hashForDefault("flag-abc",   "user-123"));
    }

    // -------------------------------------------------------------------------
    // Raw Murmur3_32 vectors — verify exact hash output and bucket derivation.
    // Expected values pre-computed from the reference TypeScript implementation
    // (packages/flags-node/src/hasher.ts). Any change here means cross-SDK
    // bucketing will diverge for live experiments.
    // -------------------------------------------------------------------------

    @Test
    void rawMurmur3_knownVectors() {
        assertMurmur("",             "",        723937430L,  7430);
        assertMurmur("a",            "b",       2722392131L, 2131);
        assertMurmur("flag-1",       "user-123",1828635123L, 5123);
        assertMurmur("salt",         "user-1",  284266604L,  6604);
        assertMurmur("salt",         "user-2",  4225422170L, 2170);
        assertMurmur("salt",         "user-3",  1711596482L, 6482);
        assertMurmur("my-flag-salt", "alice",   2680087070L, 7070);
        assertMurmur("my-flag-salt", "bob",     197736267L,  6267);
        assertMurmur("x",            "y",       1402315819L, 5819);
        assertMurmur("abcd",         "wxyz",    91575904L,   5904);
    }

    private static void assertMurmur(String salt, String userId, long wantHash, int wantBucket) {
        String key = salt + ":" + userId;
        assertEquals(wantHash,   Hasher.murmur3_32(key),
                "murmur3_32(\"" + key + "\")");
        assertEquals(wantBucket, Hasher.hashToBucket(salt, userId),
                "hashToBucket(\"" + salt + "\", \"" + userId + "\")");
    }

    @Test
    void additionalNamespacedHelperVectors() {
        assertEquals(6509, Hasher.hashForTraffic("flag-1",   "user-123"));
        assertEquals(8299, Hasher.hashForVariation("flag-1", "user-123"));
        assertEquals(5572, Hasher.hashForDefault("flag-1",   "user-123"));
        assertEquals(9411, Hasher.hashForTraffic("salt",     "alice"));
        assertEquals(1218, Hasher.hashForVariation("salt",   "alice"));
        assertEquals(5830, Hasher.hashForDefault("salt",     "alice"));
    }

    // -------------------------------------------------------------------------
    // Range bounds
    // -------------------------------------------------------------------------

    @Test
    void bucketsAreInRange() {
        for (int i = 0; i < 500; i++) {
            int b = Hasher.hashToBucket("salt", "user-" + i);
            assertTrue(b >= 0 && b <= 9999, "bucket out of range: " + b);
        }
    }

    @Test
    void allNamespacedHelpersInRange() {
        int traffic   = Hasher.hashForTraffic("test-salt",   "user-xyz");
        int variation = Hasher.hashForVariation("test-salt", "user-xyz");
        int def       = Hasher.hashForDefault("test-salt",   "user-xyz");
        assertTrue(traffic   >= 0 && traffic   <= 9999);
        assertTrue(variation >= 0 && variation <= 9999);
        assertTrue(def       >= 0 && def       <= 9999);
    }

    // -------------------------------------------------------------------------
    // Determinism
    // -------------------------------------------------------------------------

    @Test
    void hashToBucketIsDeterministic() {
        assertEquals(Hasher.hashToBucket("flag-salt", "user-abc"),
                     Hasher.hashToBucket("flag-salt", "user-abc"));
    }

    @Test
    void namespacedHelpersAreDeterministic() {
        assertEquals(Hasher.hashForTraffic("s",   "u"), Hasher.hashForTraffic("s",   "u"));
        assertEquals(Hasher.hashForVariation("s", "u"), Hasher.hashForVariation("s", "u"));
        assertEquals(Hasher.hashForDefault("s",   "u"), Hasher.hashForDefault("s",   "u"));
    }

    // -------------------------------------------------------------------------
    // Distinctness
    // -------------------------------------------------------------------------

    @Test
    void differentUsersDifferentBuckets() {
        long distinct = IntStream.rangeClosed(1, 5)
                .map(i -> Hasher.hashToBucket("same-salt", "user-" + i))
                .distinct()
                .count();
        assertTrue(distinct >= 2, "expected distinct buckets for different user IDs");
    }

    @Test
    void differentSaltsDifferentBuckets() {
        assertNotEquals(Hasher.hashToBucket("salt-a", "user-1"),
                        Hasher.hashToBucket("salt-b", "user-1"));
    }

    // -------------------------------------------------------------------------
    // Edge cases
    // -------------------------------------------------------------------------

    @Test
    void handlesEmptyStrings() {
        int b = Hasher.hashToBucket("", "");
        assertTrue(b >= 0 && b <= 9999);
    }

    @Test
    void handlesLongStrings() {
        String salt   = "a".repeat(1000);
        String userId = "b".repeat(1000);
        int b = Hasher.hashToBucket(salt, userId);
        assertTrue(b >= 0 && b <= 9999);
    }

    // -------------------------------------------------------------------------
    // Namespace independence
    // -------------------------------------------------------------------------

    @Test
    void namespacesAreIndependent() {
        int traffic   = Hasher.hashForTraffic("checkout-salt",   "user-namespace-test");
        int variation = Hasher.hashForVariation("checkout-salt", "user-namespace-test");
        int def       = Hasher.hashForDefault("checkout-salt",   "user-namespace-test");
        long distinct = Stream.of(traffic, variation, def).distinct().count();
        assertTrue(distinct >= 2,
                "expected at least 2 distinct namespace buckets: traffic=" + traffic
                + " variation=" + variation + " default=" + def);
    }
}
