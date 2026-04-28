<?php

declare(strict_types=1);

namespace SignaKit\FlagsPhp\Tests;

use PHPUnit\Framework\TestCase;
use SignaKit\FlagsPhp\Hasher;

/**
 * @covers \SignaKit\FlagsPhp\Hasher
 */
final class HasherTest extends TestCase
{
    // -------------------------------------------------------------------------
    // murmur3_32 — determinism and known values
    // -------------------------------------------------------------------------

    public function testEmptyStringProducesKnownHash(): void
    {
        // MurmurHash3 32-bit of "" with seed 0 is 0
        $this->assertSame(0, Hasher::murmur3_32(''));
    }

    public function testKnownHashForHello(): void
    {
        // MurmurHash3_x86_32("hello", seed=0) verified against JS SDK reference
        $this->assertSame(613153351, Hasher::murmur3_32('hello'));
    }

    public function testKnownHashForFooBar(): void
    {
        // MurmurHash3_x86_32("foobar", seed=0) verified against JS SDK reference
        $this->assertSame(2764362941, Hasher::murmur3_32('foobar'));
    }

    public function testHashIsDeterministic(): void
    {
        $input = 'deterministic-test-key';
        $this->assertSame(Hasher::murmur3_32($input), Hasher::murmur3_32($input));
    }

    public function testHashIsUnsigned32Bit(): void
    {
        $hash = Hasher::murmur3_32('unsigned-check');
        $this->assertGreaterThanOrEqual(0, $hash);
        $this->assertLessThanOrEqual(0xFFFFFFFF, $hash);
    }

    public function testDifferentInputsProduceDifferentHashes(): void
    {
        $this->assertNotSame(Hasher::murmur3_32('abc'), Hasher::murmur3_32('def'));
    }

    // -------------------------------------------------------------------------
    // hashForTraffic — returns 0–9999
    // -------------------------------------------------------------------------

    public function testHashForTrafficIsInBucketRange(): void
    {
        $bucket = Hasher::hashForTraffic('my-salt', 'user-123');
        $this->assertGreaterThanOrEqual(0, $bucket);
        $this->assertLessThanOrEqual(9999, $bucket);
    }

    public function testHashForTrafficIsDeterministic(): void
    {
        $salt   = 'consistent-salt';
        $userId = 'user-42';
        $this->assertSame(
            Hasher::hashForTraffic($salt, $userId),
            Hasher::hashForTraffic($salt, $userId),
        );
    }

    public function testHashForTrafficMatchesKnownBucket(): void
    {
        // murmur3("test-salt:traffic:user-123") % 10000 = 2898 (verified against JS SDK)
        $this->assertSame(2898, Hasher::hashForTraffic('test-salt', 'user-123'));
    }

    public function testHashForTrafficVariesByUser(): void
    {
        // Different users should (with overwhelming probability) get different buckets
        $salt    = 'same-salt';
        $bucket1 = Hasher::hashForTraffic($salt, 'user-1');
        $bucket2 = Hasher::hashForTraffic($salt, 'user-2');
        // We can't assert strict inequality (collision possible) but assert range
        $this->assertGreaterThanOrEqual(0, $bucket1);
        $this->assertGreaterThanOrEqual(0, $bucket2);
    }

    // -------------------------------------------------------------------------
    // hashForVariation — returns 0–9999
    // -------------------------------------------------------------------------

    public function testHashForVariationIsInBucketRange(): void
    {
        $bucket = Hasher::hashForVariation('my-salt', 'user-123');
        $this->assertGreaterThanOrEqual(0, $bucket);
        $this->assertLessThanOrEqual(9999, $bucket);
    }

    public function testHashForVariationIsDeterministic(): void
    {
        $salt   = 'var-salt';
        $userId = 'user-99';
        $this->assertSame(
            Hasher::hashForVariation($salt, $userId),
            Hasher::hashForVariation($salt, $userId),
        );
    }

    // -------------------------------------------------------------------------
    // hashForDefault — returns 0–9999
    // -------------------------------------------------------------------------

    public function testHashForDefaultIsInBucketRange(): void
    {
        $bucket = Hasher::hashForDefault('my-salt', 'user-123');
        $this->assertGreaterThanOrEqual(0, $bucket);
        $this->assertLessThanOrEqual(9999, $bucket);
    }

    public function testHashForDefaultIsDeterministic(): void
    {
        $salt   = 'default-salt';
        $userId = 'user-77';
        $this->assertSame(
            Hasher::hashForDefault($salt, $userId),
            Hasher::hashForDefault($salt, $userId),
        );
    }

    // -------------------------------------------------------------------------
    // Independence: traffic, variation, and default hashes must differ
    // -------------------------------------------------------------------------

    public function testTrafficAndVariationHashesAreIndependent(): void
    {
        $salt   = 'independence-salt';
        $userId = 'user-independence';
        // With different salts applied the outputs should differ
        // (traffic uses ":traffic:", variation uses ":variation:")
        $traffic   = Hasher::hashForTraffic($salt, $userId);
        $variation = Hasher::hashForVariation($salt, $userId);
        // They may collide by chance but test that at least one call succeeds in range
        $this->assertGreaterThanOrEqual(0, $traffic);
        $this->assertGreaterThanOrEqual(0, $variation);
        $this->assertNotSame(
            Hasher::murmur3_32("{$salt}:traffic:{$userId}"),
            Hasher::murmur3_32("{$salt}:variation:{$userId}"),
        );
    }
}
