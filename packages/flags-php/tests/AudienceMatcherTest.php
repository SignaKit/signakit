<?php

declare(strict_types=1);

namespace SignaKit\FlagsPhp\Tests;

use PHPUnit\Framework\TestCase;
use SignaKit\FlagsPhp\AudienceMatcher;

final class AudienceMatcherTest extends TestCase
{
    // -------------------------------------------------------------------------
    // matchesCondition — equals / not_equals
    // -------------------------------------------------------------------------

    public function test_equals_matches_identical_string_values(): void
    {
        $cond = ['attribute' => 'plan', 'operator' => 'equals', 'value' => 'premium'];
        $this->assertTrue(AudienceMatcher::matchesCondition($cond, ['plan' => 'premium']));
    }

    public function test_equals_rejects_different_string_values(): void
    {
        $cond = ['attribute' => 'plan', 'operator' => 'equals', 'value' => 'premium'];
        $this->assertFalse(AudienceMatcher::matchesCondition($cond, ['plan' => 'free']));
    }

    public function test_equals_matches_boolean_values(): void
    {
        $cond = ['attribute' => 'verified', 'operator' => 'equals', 'value' => true];
        $this->assertTrue(AudienceMatcher::matchesCondition($cond, ['verified' => true]));
        $this->assertFalse(AudienceMatcher::matchesCondition($cond, ['verified' => false]));
    }

    public function test_not_equals_matches_when_values_differ(): void
    {
        $cond = ['attribute' => 'plan', 'operator' => 'not_equals', 'value' => 'premium'];
        $this->assertTrue(AudienceMatcher::matchesCondition($cond, ['plan' => 'free']));
        $this->assertFalse(AudienceMatcher::matchesCondition($cond, ['plan' => 'premium']));
    }

    public function test_returns_false_when_attribute_is_missing(): void
    {
        $cond = ['attribute' => 'plan', 'operator' => 'equals', 'value' => 'premium'];
        $this->assertFalse(AudienceMatcher::matchesCondition($cond, []));
    }

    // -------------------------------------------------------------------------
    // matchesCondition — numeric comparisons
    // -------------------------------------------------------------------------

    public function test_greater_than_true_when_user_value_exceeds_threshold(): void
    {
        $cond = ['attribute' => 'age', 'operator' => 'greater_than', 'value' => 18];
        $this->assertTrue(AudienceMatcher::matchesCondition($cond, ['age' => 25]));
        $this->assertFalse(AudienceMatcher::matchesCondition($cond, ['age' => 18]));
        $this->assertFalse(AudienceMatcher::matchesCondition($cond, ['age' => 10]));
    }

    public function test_less_than_true_when_user_value_is_below_threshold(): void
    {
        $cond = ['attribute' => 'age', 'operator' => 'less_than', 'value' => 18];
        $this->assertTrue(AudienceMatcher::matchesCondition($cond, ['age' => 10]));
        $this->assertFalse(AudienceMatcher::matchesCondition($cond, ['age' => 18]));
        $this->assertFalse(AudienceMatcher::matchesCondition($cond, ['age' => 25]));
    }

    public function test_greater_than_or_equals_inclusive(): void
    {
        $cond = ['attribute' => 'age', 'operator' => 'greater_than_or_equals', 'value' => 18];
        $this->assertTrue(AudienceMatcher::matchesCondition($cond, ['age' => 18]));
        $this->assertFalse(AudienceMatcher::matchesCondition($cond, ['age' => 17]));
    }

    public function test_less_than_or_equals_inclusive(): void
    {
        $cond = ['attribute' => 'age', 'operator' => 'less_than_or_equals', 'value' => 18];
        $this->assertTrue(AudienceMatcher::matchesCondition($cond, ['age' => 18]));
        $this->assertFalse(AudienceMatcher::matchesCondition($cond, ['age' => 19]));
    }

    public function test_numeric_operators_return_false_on_non_numeric_attribute_values(): void
    {
        $cond = ['attribute' => 'age', 'operator' => 'greater_than', 'value' => 18];
        $this->assertFalse(AudienceMatcher::matchesCondition($cond, ['age' => 'twenty-five']));
    }

    // -------------------------------------------------------------------------
    // matchesCondition — in / not_in
    // -------------------------------------------------------------------------

    public function test_in_true_when_user_value_is_in_the_list(): void
    {
        $cond = ['attribute' => 'country', 'operator' => 'in', 'value' => ['US', 'CA', 'GB']];
        $this->assertTrue(AudienceMatcher::matchesCondition($cond, ['country' => 'US']));
        $this->assertFalse(AudienceMatcher::matchesCondition($cond, ['country' => 'DE']));
    }

    public function test_in_false_when_value_is_not_an_array(): void
    {
        $cond = ['attribute' => 'country', 'operator' => 'in', 'value' => 'US'];
        $this->assertFalse(AudienceMatcher::matchesCondition($cond, ['country' => 'US']));
    }

    public function test_not_in_true_when_user_value_is_absent_from_the_list(): void
    {
        $cond = ['attribute' => 'country', 'operator' => 'not_in', 'value' => ['US', 'CA']];
        $this->assertTrue(AudienceMatcher::matchesCondition($cond, ['country' => 'DE']));
        $this->assertFalse(AudienceMatcher::matchesCondition($cond, ['country' => 'US']));
    }

    public function test_not_in_false_when_value_is_not_an_array(): void
    {
        // PHP: is_array($expected) guard makes this false (not vacuously true like JS)
        $cond = ['attribute' => 'country', 'operator' => 'not_in', 'value' => 'US'];
        $this->assertFalse(AudienceMatcher::matchesCondition($cond, ['country' => 'US']));
    }

    // -------------------------------------------------------------------------
    // matchesCondition — contains / not_contains
    // -------------------------------------------------------------------------

    public function test_contains_true_when_string_includes_substring(): void
    {
        $cond = ['attribute' => 'email', 'operator' => 'contains', 'value' => '@acme'];
        $this->assertTrue(AudienceMatcher::matchesCondition($cond, ['email' => 'bob@acme.com']));
        $this->assertFalse(AudienceMatcher::matchesCondition($cond, ['email' => 'bob@gmail.com']));
    }

    public function test_not_contains_true_when_string_does_not_include_substring(): void
    {
        $cond = ['attribute' => 'email', 'operator' => 'not_contains', 'value' => '@acme'];
        $this->assertTrue(AudienceMatcher::matchesCondition($cond, ['email' => 'bob@gmail.com']));
        $this->assertFalse(AudienceMatcher::matchesCondition($cond, ['email' => 'bob@acme.com']));
    }

    public function test_not_contains_false_when_types_do_not_match(): void
    {
        // PHP: is_string($actual) && is_string($expected) guard — non-string attribute returns false
        $cond = ['attribute' => 'score', 'operator' => 'not_contains', 'value' => 'high'];
        $this->assertFalse(AudienceMatcher::matchesCondition($cond, ['score' => 42]));
    }

    // -------------------------------------------------------------------------
    // matchesAudiences
    // -------------------------------------------------------------------------

    public function test_returns_true_for_empty_audiences(): void
    {
        $this->assertTrue(AudienceMatcher::matchesAudiences([], 'any', []));
        $this->assertTrue(AudienceMatcher::matchesAudiences([], 'all', []));
    }

    public function test_any_returns_true_when_at_least_one_audience_matches(): void
    {
        $audiences = [
            ['conditions' => [['attribute' => 'plan', 'operator' => 'equals', 'value' => 'premium']]],
            ['conditions' => [['attribute' => 'plan', 'operator' => 'equals', 'value' => 'enterprise']]],
        ];
        $this->assertTrue(AudienceMatcher::matchesAudiences($audiences, 'any', ['plan' => 'premium']));
        $this->assertFalse(AudienceMatcher::matchesAudiences($audiences, 'any', ['plan' => 'free']));
    }

    public function test_all_returns_true_only_when_every_audience_matches(): void
    {
        $audiences = [
            ['conditions' => [['attribute' => 'plan', 'operator' => 'equals', 'value' => 'premium']]],
            ['conditions' => [['attribute' => 'verified', 'operator' => 'equals', 'value' => true]]],
        ];
        $this->assertTrue(AudienceMatcher::matchesAudiences($audiences, 'all', ['plan' => 'premium', 'verified' => true]));
        $this->assertFalse(AudienceMatcher::matchesAudiences($audiences, 'all', ['plan' => 'premium', 'verified' => false]));
    }

    public function test_all_conditions_in_a_single_audience_must_pass(): void
    {
        $audiences = [
            [
                'conditions' => [
                    ['attribute' => 'plan', 'operator' => 'equals', 'value' => 'premium'],
                    ['attribute' => 'age', 'operator' => 'greater_than_or_equals', 'value' => 18],
                ],
            ],
        ];
        $this->assertTrue(AudienceMatcher::matchesAudiences($audiences, 'any', ['plan' => 'premium', 'age' => 25]));
        $this->assertFalse(AudienceMatcher::matchesAudiences($audiences, 'any', ['plan' => 'premium', 'age' => 16]));
    }
}
