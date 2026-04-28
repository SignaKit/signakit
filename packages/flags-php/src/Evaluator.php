<?php

declare(strict_types=1);

namespace SignaKit\FlagsPhp;

use SignaKit\FlagsPhp\Types\Decision;
use SignaKit\FlagsPhp\Types\ProjectConfig;

/**
 * Stateless flag evaluator.
 * Implements the two-stage bucketing algorithm (traffic + variation hashes).
 */
final class Evaluator
{
    /**
     * Evaluate a single flag for a given user.
     *
     * @param array<string, mixed> $flag           Raw flag data from config
     * @param string               $userId
     * @param array<string, mixed> $userAttributes
     * @return Decision|null  null when the flag is archived (should be skipped entirely)
     */
    public static function evaluateFlag(
        array $flag,
        string $userId,
        array $userAttributes = [],
    ): ?Decision {
        $flagKey = (string) ($flag['key']    ?? '');
        $status  = (string) ($flag['status'] ?? '');
        $running = (bool)   ($flag['running'] ?? false);
        $salt    = (string) ($flag['salt']   ?? $flagKey);

        // 1. Archived flags are silently skipped
        if ($status === 'archived') {
            return null;
        }

        // 2. Stopped flag → return 'off'
        if (!$running) {
            return new Decision(
                flagKey:      $flagKey,
                variationKey: 'off',
                enabled:      false,
                ruleKey:      null,
                ruleType:     null,
            );
        }

        // 3. Evaluate rules in order
        /** @var array<int, array<string, mixed>> $rules */
        $rules = (array) ($flag['rules'] ?? []);

        foreach ($rules as $rule) {
            $ruleKey       = (string) ($rule['ruleKey']          ?? '');
            $ruleType      = isset($rule['ruleType']) ? (string) $rule['ruleType'] : null;
            $trafficPct    = (float)  ($rule['trafficPercentage'] ?? 0);
            $matchType     = (string) ($rule['audienceMatchType'] ?? 'any');

            // 3a. Allowlist check (immediate return, bypasses traffic)
            /** @var array<int, array<string, mixed>> $allowlist */
            $allowlist = (array) ($rule['allowlist'] ?? []);
            foreach ($allowlist as $entry) {
                if ((string) ($entry['userId'] ?? '') === $userId) {
                    return new Decision(
                        flagKey:      $flagKey,
                        variationKey: (string) ($entry['variation'] ?? ''),
                        enabled:      true,
                        ruleKey:      $ruleKey,
                        ruleType:     $ruleType,
                    );
                }
            }

            // 3b. Audience check
            /** @var array<int, array<string, mixed>> $audiences */
            $audiences = (array) ($rule['audiences'] ?? []);
            if (!AudienceMatcher::matchesAudiences($audiences, $matchType, $userAttributes)) {
                continue;
            }

            // 3c. Traffic bucket check
            $trafficBucket = Hasher::hashForTraffic($salt, $userId);
            if ($trafficBucket >= (int) ($trafficPct * 100)) {
                continue;
            }

            // 3d. Variation allocation
            $variationBucket = Hasher::hashForVariation($salt, $userId);

            /** @var array<string, mixed> $variationAllocation */
            $variationAllocation = (array) ($rule['variationAllocation'] ?? []);
            $variationKey        = self::resolveVariation($variationAllocation, $variationBucket);

            if ($variationKey === null) {
                continue;
            }

            return new Decision(
                flagKey:      $flagKey,
                variationKey: $variationKey,
                enabled:      true,
                ruleKey:      $ruleKey,
                ruleType:     $ruleType,
            );
        }

        // 4. Default allocation
        $defaultBucket = Hasher::hashForDefault($salt, $userId);

        /** @var array<string, mixed> $allocation */
        $allocation   = (array) ($flag['allocation'] ?? []);
        $variationKey = self::resolveVariation($allocation, $defaultBucket);

        if ($variationKey === null) {
            return null;
        }

        return new Decision(
            flagKey:      $flagKey,
            variationKey: $variationKey,
            enabled:      true,
            ruleKey:      null,
            ruleType:     null,
        );
    }

    /**
     * Evaluate all flags and return a map of flagKey → Decision.
     * Archived flags are omitted.
     *
     * @param array<string, mixed> $userAttributes
     * @return array<string, Decision>
     */
    public static function evaluateAllFlags(
        ProjectConfig $config,
        string $userId,
        array $userAttributes = [],
    ): array {
        $decisions = [];

        foreach ($config->flags as $flag) {
            $decision = self::evaluateFlag($flag, $userId, $userAttributes);
            if ($decision !== null) {
                $decisions[$decision->flagKey] = $decision;
            }
        }

        return $decisions;
    }

    /**
     * Resolve a variation key from an allocation's ranges for a given bucket.
     *
     * @param array<string, mixed> $allocation  e.g. ['ranges' => [['variation' => 'control', 'start' => 0, 'end' => 4999]]]
     */
    private static function resolveVariation(array $allocation, int $bucket): ?string
    {
        /** @var array<int, array<string, mixed>> $ranges */
        $ranges = (array) ($allocation['ranges'] ?? []);

        foreach ($ranges as $range) {
            $start = (int) ($range['start'] ?? 0);
            $end   = (int) ($range['end']   ?? 0);

            if ($bucket >= $start && $bucket <= $end) {
                return (string) ($range['variation'] ?? '');
            }
        }

        return null;
    }
}
