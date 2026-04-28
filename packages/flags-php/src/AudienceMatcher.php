<?php

declare(strict_types=1);

namespace SignaKit\FlagsPhp;

/**
 * Evaluates audience conditions against a user's attributes.
 */
final class AudienceMatcher
{
    /**
     * @param array<int, array<string, mixed>>  $audiences       Audience definitions from the rule
     * @param string                            $matchType       'any' (OR) or 'all' (AND)
     * @param array<string, mixed>              $userAttributes  Caller-supplied user attributes
     */
    public static function matchesAudiences(
        array $audiences,
        string $matchType,
        array $userAttributes,
    ): bool {
        // No audiences defined → matches all users
        if (count($audiences) === 0) {
            return true;
        }

        foreach ($audiences as $audience) {
            /** @var array<int, array<string, mixed>> $conditions */
            $conditions     = (array) ($audience['conditions'] ?? []);
            $audienceMatch  = self::evaluateConditions($conditions, $userAttributes);

            if ($matchType === 'any' && $audienceMatch) {
                return true;
            }

            if ($matchType === 'all' && !$audienceMatch) {
                return false;
            }
        }

        // 'any' with no match → false; 'all' with all match → true
        return $matchType === 'all';
    }

    /**
     * All conditions in a single audience must pass (AND within an audience).
     *
     * @param array<int, array<string, mixed>> $conditions
     * @param array<string, mixed>             $userAttributes
     */
    private static function evaluateConditions(array $conditions, array $userAttributes): bool
    {
        foreach ($conditions as $condition) {
            if (!self::matchesCondition($condition, $userAttributes)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Evaluate a single condition against the user's attributes.
     *
     * @param array<string, mixed> $condition
     * @param array<string, mixed> $userAttributes
     */
    public static function matchesCondition(array $condition, array $userAttributes): bool
    {
        $attribute = (string) ($condition['attribute'] ?? '');
        $operator  = (string) ($condition['operator']  ?? '');
        $expected  = $condition['value'] ?? null;

        if (!array_key_exists($attribute, $userAttributes)) {
            return false;
        }

        $actual = $userAttributes[$attribute];

        return match ($operator) {
            'equals'                  => $actual == $expected,
            'not_equals'              => $actual != $expected,
            'greater_than'            => is_numeric($actual) && is_numeric($expected) && (float) $actual >  (float) $expected,
            'less_than'               => is_numeric($actual) && is_numeric($expected) && (float) $actual <  (float) $expected,
            'greater_than_or_equals'  => is_numeric($actual) && is_numeric($expected) && (float) $actual >= (float) $expected,
            'less_than_or_equals'     => is_numeric($actual) && is_numeric($expected) && (float) $actual <= (float) $expected,
            'in'                      => is_array($expected) && in_array($actual, $expected, strict: false),
            'not_in'                  => is_array($expected) && !in_array($actual, $expected, strict: false),
            'contains'                => is_string($actual) && is_string($expected) && str_contains($actual, $expected),
            'not_contains'            => is_string($actual) && is_string($expected) && !str_contains($actual, $expected),
            default                   => false,
        };
    }
}
