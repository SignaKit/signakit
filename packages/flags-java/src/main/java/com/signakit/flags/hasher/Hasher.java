package com.signakit.flags.hasher;

import com.signakit.flags.Constants;

/**
 * Deterministic MurmurHash3 (32-bit) bucketing.
 *
 * <p>Faithfully ports {@code packages/flags-node/src/hasher.ts}. The TypeScript
 * version operates on {@code String.charCodeAt} (UTF-16 code units, masked to
 * the low byte) — so we mirror that behavior exactly: each Java {@code char}
 * is treated as a 16-bit unit and {@code & 0xff}-masked when packed into the
 * 4-byte block. This keeps bucket numbers identical across SDKs for the same
 * {@code salt:userId} input.
 */
public final class Hasher {
    private Hasher() {}

    private static final int C1 = 0xcc9e2d51;
    private static final int C2 = 0x1b873593;
    private static final int R1 = 15;
    private static final int R2 = 13;
    private static final int M = 5;
    private static final int N = 0xe6546b64;

    /**
     * MurmurHash3 32-bit. Returns the hash as a {@code long} so the caller
     * can treat it as an unsigned 32-bit value when computing buckets.
     */
    public static long murmur3_32(String key, int seed) {
        int hash = seed;
        int len = key.length();
        int blocks = len / 4;

        for (int i = 0; i < blocks; i++) {
            int k =
                    (key.charAt(i * 4) & 0xff)
                            | ((key.charAt(i * 4 + 1) & 0xff) << 8)
                            | ((key.charAt(i * 4 + 2) & 0xff) << 16)
                            | ((key.charAt(i * 4 + 3) & 0xff) << 24);

            k = k * C1;
            k = Integer.rotateLeft(k, R1);
            k = k * C2;

            hash ^= k;
            hash = Integer.rotateLeft(hash, R2);
            hash = hash * M + N;
        }

        int k = 0;
        int tailIndex = blocks * 4;

        switch (len & 3) {
            case 3:
                k ^= (key.charAt(tailIndex + 2) & 0xff) << 16;
                // fallthrough
            case 2:
                k ^= (key.charAt(tailIndex + 1) & 0xff) << 8;
                // fallthrough
            case 1:
                k ^= key.charAt(tailIndex) & 0xff;
                k = k * C1;
                k = Integer.rotateLeft(k, R1);
                k = k * C2;
                hash ^= k;
                break;
            default:
                break;
        }

        hash ^= len;
        hash ^= hash >>> 16;
        hash = hash * 0x85ebca6b;
        hash ^= hash >>> 13;
        hash = hash * 0xc2b2ae35;
        hash ^= hash >>> 16;

        return hash & 0xFFFFFFFFL;
    }

    public static long murmur3_32(String key) {
        return murmur3_32(key, 0);
    }

    public static int hashToBucket(String salt, String userId) {
        long hash = murmur3_32(salt + ":" + userId);
        return (int) (hash % Constants.BUCKET_SPACE);
    }

    public static int hashForTraffic(String salt, String userId) {
        return hashToBucket(salt + ":traffic", userId);
    }

    public static int hashForVariation(String salt, String userId) {
        return hashToBucket(salt + ":variation", userId);
    }

    public static int hashForDefault(String salt, String userId) {
        return hashToBucket(salt + ":default", userId);
    }
}
