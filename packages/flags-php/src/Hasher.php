<?php

declare(strict_types=1);

namespace SignaKit\FlagsPhp;

/**
 * MurmurHash3 32-bit implementation matching the JS SDK exactly.
 *
 * PHP integers are 64-bit on 64-bit platforms, so every multiplication is
 * masked with `& 0xFFFFFFFF` to simulate 32-bit unsigned overflow.
 * The final modulo uses fmod() to avoid integer overflow on very large hashes.
 */
final class Hasher
{
    private const BUCKETS = 10000;

    /**
     * Compute MurmurHash3 32-bit for a UTF-8 string with seed 0.
     *
     * @param string $key Input string
     * @return int Unsigned 32-bit hash value (0 – 4294967295)
     */
    public static function murmur3_32(string $key): int
    {
        $data   = $key;
        $length = strlen($data);
        $nblocks = (int) ($length / 4);

        $h1 = 0;

        $c1 = 0xcc9e2d51;
        $c2 = 0x1b873593;

        // ---- body: process 4-byte blocks ----
        for ($i = 0; $i < $nblocks; $i++) {
            $k1 = self::getInt32($data, $i * 4);

            $k1 = ($k1 * $c1) & 0xFFFFFFFF;
            $k1 = self::rotl32($k1, 15);
            $k1 = ($k1 * $c2) & 0xFFFFFFFF;

            $h1 ^= $k1;
            $h1 = self::rotl32($h1, 13);
            $h1 = (($h1 * 5) & 0xFFFFFFFF) + 0xe6546b64;
            $h1 &= 0xFFFFFFFF;
        }

        // ---- tail: remaining 1–3 bytes ----
        $tail   = $nblocks * 4;
        $remain = $length - $tail;
        $k1     = 0;

        switch ($remain) {
            case 3:
                $k1 ^= ord($data[$tail + 2]) << 16;
                // fall through
            case 2:
                $k1 ^= ord($data[$tail + 1]) << 8;
                // fall through
            case 1:
                $k1 ^= ord($data[$tail]);
                $k1  = ($k1 * $c1) & 0xFFFFFFFF;
                $k1  = self::rotl32($k1, 15);
                $k1  = ($k1 * $c2) & 0xFFFFFFFF;
                $h1 ^= $k1;
        }

        // ---- finalisation ----
        $h1 ^= $length;
        $h1  = self::fmix32($h1);

        return $h1;
    }

    /** Traffic-allocation hash: returns a bucket 0–9999 */
    public static function hashForTraffic(string $salt, string $userId): int
    {
        return (int) fmod(self::murmur3_32("{$salt}:traffic:{$userId}"), self::BUCKETS);
    }

    /** Variation-allocation hash: returns a bucket 0–9999 */
    public static function hashForVariation(string $salt, string $userId): int
    {
        return (int) fmod(self::murmur3_32("{$salt}:variation:{$userId}"), self::BUCKETS);
    }

    /** Default-allocation hash: returns a bucket 0–9999 */
    public static function hashForDefault(string $salt, string $userId): int
    {
        return (int) fmod(self::murmur3_32("{$salt}:default:{$userId}"), self::BUCKETS);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Read a little-endian 32-bit integer from the byte string.
     */
    private static function getInt32(string $data, int $offset): int
    {
        return (
            (ord($data[$offset])       )        |
            (ord($data[$offset + 1])    <<  8)   |
            (ord($data[$offset + 2])    << 16)   |
            (ord($data[$offset + 3])    << 24)
        ) & 0xFFFFFFFF;
    }

    /**
     * Rotate left 32-bit.
     */
    private static function rotl32(int $x, int $r): int
    {
        return (($x << $r) | ($x >> (32 - $r))) & 0xFFFFFFFF;
    }

    /**
     * MurmurHash3 32-bit finalisation mix (fmix32).
     */
    private static function fmix32(int $h): int
    {
        $h ^= ($h >> 16);
        $h  = ($h * 0x85ebca6b) & 0xFFFFFFFF;
        $h ^= ($h >> 13);
        $h  = ($h * 0xc2b2ae35) & 0xFFFFFFFF;
        $h ^= ($h >> 16);

        return $h & 0xFFFFFFFF;
    }
}
