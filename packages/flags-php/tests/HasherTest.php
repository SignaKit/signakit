<?php

declare(strict_types=1);

namespace SignaKit\FlagsPhp\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use SignaKit\FlagsPhp\Hasher;

/**
 * Hasher tests — must stay in sync with flags-node and flags-browser.
 *
 * The cross-platform vectors below were pre-computed by running the same
 * MurmurHash3 algorithm in the JS SDK. Any change to these values means
 * server- and client-side bucketing will disagree.
 */
final class HasherTest extends TestCase
{
    // -------------------------------------------------------------------------
    // Cross-platform hash vectors
    // -------------------------------------------------------------------------

    public static function trafficVectorsProvider(): array
    {
        return [
            ['flag-abc', 'user-123', 8406],
        ];
    }

    #[DataProvider('trafficVectorsProvider')]
    public function test_hashForTraffic_cross_platform_vectors(string $salt, string $userId, int $expected): void
    {
        $this->assertSame($expected, Hasher::hashForTraffic($salt, $userId));
    }

    public function test_namespaced_helpers_match_expected_cross_platform_values(): void
    {
        $this->assertSame(8406, Hasher::hashForTraffic('flag-abc', 'user-123'));
        $this->assertSame(2804, Hasher::hashForVariation('flag-abc', 'user-123'));
        $this->assertSame(6466, Hasher::hashForDefault('flag-abc', 'user-123'));
    }

    // -------------------------------------------------------------------------
    // Range bounds
    // -------------------------------------------------------------------------

    public function test_hashForTraffic_returns_value_within_0_to_9999(): void
    {
        $result = Hasher::hashForTraffic('my-salt', 'user-123');
        $this->assertGreaterThanOrEqual(0, $result);
        $this->assertLessThanOrEqual(9999, $result);
    }

    public function test_hashForVariation_returns_value_within_0_to_9999(): void
    {
        $result = Hasher::hashForVariation('test-salt', 'user-xyz');
        $this->assertGreaterThanOrEqual(0, $result);
        $this->assertLessThanOrEqual(9999, $result);
    }

    public function test_hashForDefault_returns_value_within_0_to_9999(): void
    {
        $result = Hasher::hashForDefault('test-salt', 'user-xyz');
        $this->assertGreaterThanOrEqual(0, $result);
        $this->assertLessThanOrEqual(9999, $result);
    }

    // -------------------------------------------------------------------------
    // Determinism
    // -------------------------------------------------------------------------

    public function test_hashForTraffic_is_deterministic(): void
    {
        $a = Hasher::hashForTraffic('flag-salt', 'user-abc');
        $b = Hasher::hashForTraffic('flag-salt', 'user-abc');
        $this->assertSame($a, $b);
    }

    public function test_hashForVariation_is_deterministic(): void
    {
        $a = Hasher::hashForVariation('determinism-salt', 'user-det');
        $b = Hasher::hashForVariation('determinism-salt', 'user-det');
        $this->assertSame($a, $b);
    }

    public function test_hashForDefault_is_deterministic(): void
    {
        $a = Hasher::hashForDefault('determinism-salt', 'user-det');
        $b = Hasher::hashForDefault('determinism-salt', 'user-det');
        $this->assertSame($a, $b);
    }

    // -------------------------------------------------------------------------
    // Distinctness
    // -------------------------------------------------------------------------

    public function test_produces_different_buckets_for_different_user_ids(): void
    {
        $buckets = array_map(
            fn(string $id) => Hasher::hashForTraffic('same-salt', $id),
            ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'],
        );
        // With 5 distinct users hashed to a 10000-bucket space, collisions are extremely unlikely
        $this->assertGreaterThan(1, count(array_unique($buckets)));
    }

    public function test_produces_different_buckets_for_different_salts(): void
    {
        $a = Hasher::hashForTraffic('salt-a', 'user-1');
        $b = Hasher::hashForTraffic('salt-b', 'user-1');
        $this->assertNotSame($a, $b);
    }

    // -------------------------------------------------------------------------
    // Edge cases
    // -------------------------------------------------------------------------

    public function test_handles_empty_strings_without_throwing(): void
    {
        $result = Hasher::hashForTraffic('', '');
        $this->assertGreaterThanOrEqual(0, $result);
        $this->assertLessThanOrEqual(9999, $result);
    }

    public function test_handles_long_strings_without_throwing(): void
    {
        $longSalt   = str_repeat('a', 1000);
        $longUserId = str_repeat('b', 1000);
        $result     = Hasher::hashForTraffic($longSalt, $longUserId);
        $this->assertGreaterThanOrEqual(0, $result);
        $this->assertLessThanOrEqual(9999, $result);
    }

    // -------------------------------------------------------------------------
    // Namespace independence
    // -------------------------------------------------------------------------

    public function test_traffic_variation_and_default_namespaces_produce_independent_buckets(): void
    {
        $traffic   = Hasher::hashForTraffic('checkout-salt', 'user-namespace-test');
        $variation = Hasher::hashForVariation('checkout-salt', 'user-namespace-test');
        $default   = Hasher::hashForDefault('checkout-salt', 'user-namespace-test');

        // At least two of the three should differ (ensures namespace separation works)
        $unique = array_unique([$traffic, $variation, $default]);
        $this->assertGreaterThan(1, count($unique));
    }
}
