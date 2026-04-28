<?php

declare(strict_types=1);

namespace SignaKit\FlagsPhp\Tests;

use PHPUnit\Framework\TestCase;
use SignaKit\FlagsPhp\AudienceMatcher;

/**
 * @covers \SignaKit\FlagsPhp\AudienceMatcher
 */
final class AudienceMatcherTest extends TestCase
{
    // -------------------------------------------------------------------------
    // matchesCondition — individual operators
    // -------------------------------------------------------------------------

    public function testEqualsOperator(): void
    {
        $this->assertTrue(AudienceMatcher::matchesCondition(
            ['attribute' => 'plan', 'operator' => 'equals', 'value' => 'premium'],
            ['plan' => 'premium'],
        ));
        $this->assertFalse(AudienceMatcher::matchesCondition(
            ['attribute' => 'plan', 'operator' => 'equals', 'value' => 'premium'],
            ['plan' => 'free'],
        ));
    }

    public function testNotEqualsOperator(): void
    {
        $this->assertTrue(AudienceMatcher::matchesCondition(
            ['attribute' => 'plan', 'operator' => 'not_equals', 'value' => 'free'],
            ['plan' => 'premium'],
        ));
        $this->assertFalse(AudienceMatcher::matchesCondition(
            ['attribute' => 'plan', 'operator' => 'not_equals', 'value' => 'free'],
            ['plan' => 'free'],
        ));
    }

    public function testGreaterThanOperator(): void
    {
        $this->assertTrue(AudienceMatcher::matchesCondition(
            ['attribute' => 'age', 'operator' => 'greater_than', 'value' => 18],
            ['age' => 25],
        ));
        $this->assertFalse(AudienceMatcher::matchesCondition(
            ['attribute' => 'age', 'operator' => 'greater_than', 'value' => 18],
            ['age' => 18],
        ));
        $this->assertFalse(AudienceMatcher::matchesCondition(
            ['attribute' => 'age', 'operator' => 'greater_than', 'value' => 18],
            ['age' => 10],
        ));
    }

    public function testLessThanOperator(): void
    {
        $this->assertTrue(AudienceMatcher::matchesCondition(
            ['attribute' => 'age', 'operator' => 'less_than', 'value' => 18],
            ['age' => 10],
        ));
        $this->assertFalse(AudienceMatcher::matchesCondition(
            ['attribute' => 'age', 'operator' => 'less_than', 'value' => 18],
            ['age' => 18],
        ));
    }

    public function testGreaterThanOrEqualsOperator(): void
    {
        $this->assertTrue(AudienceMatcher::matchesCondition(
            ['attribute' => 'score', 'operator' => 'greater_than_or_equals', 'value' => 100],
            ['score' => 100],
        ));
        $this->assertTrue(AudienceMatcher::matchesCondition(
            ['attribute' => 'score', 'operator' => 'greater_than_or_equals', 'value' => 100],
            ['score' => 200],
        ));
        $this->assertFalse(AudienceMatcher::matchesCondition(
            ['attribute' => 'score', 'operator' => 'greater_than_or_equals', 'value' => 100],
            ['score' => 99],
        ));
    }

    public function testLessThanOrEqualsOperator(): void
    {
        $this->assertTrue(AudienceMatcher::matchesCondition(
            ['attribute' => 'score', 'operator' => 'less_than_or_equals', 'value' => 100],
            ['score' => 100],
        ));
        $this->assertTrue(AudienceMatcher::matchesCondition(
            ['attribute' => 'score', 'operator' => 'less_than_or_equals', 'value' => 100],
            ['score' => 50],
        ));
        $this->assertFalse(AudienceMatcher::matchesCondition(
            ['attribute' => 'score', 'operator' => 'less_than_or_equals', 'value' => 100],
            ['score' => 101],
        ));
    }

    public function testInOperator(): void
    {
        $this->assertTrue(AudienceMatcher::matchesCondition(
            ['attribute' => 'country', 'operator' => 'in', 'value' => ['US', 'CA', 'GB']],
            ['country' => 'US'],
        ));
        $this->assertFalse(AudienceMatcher::matchesCondition(
            ['attribute' => 'country', 'operator' => 'in', 'value' => ['US', 'CA', 'GB']],
            ['country' => 'DE'],
        ));
    }

    public function testNotInOperator(): void
    {
        $this->assertTrue(AudienceMatcher::matchesCondition(
            ['attribute' => 'country', 'operator' => 'not_in', 'value' => ['US', 'CA']],
            ['country' => 'DE'],
        ));
        $this->assertFalse(AudienceMatcher::matchesCondition(
            ['attribute' => 'country', 'operator' => 'not_in', 'value' => ['US', 'CA']],
            ['country' => 'US'],
        ));
    }

    public function testContainsOperator(): void
    {
        $this->assertTrue(AudienceMatcher::matchesCondition(
            ['attribute' => 'email', 'operator' => 'contains', 'value' => '@example.com'],
            ['email' => 'alice@example.com'],
        ));
        $this->assertFalse(AudienceMatcher::matchesCondition(
            ['attribute' => 'email', 'operator' => 'contains', 'value' => '@example.com'],
            ['email' => 'alice@other.com'],
        ));
    }

    public function testNotContainsOperator(): void
    {
        $this->assertTrue(AudienceMatcher::matchesCondition(
            ['attribute' => 'email', 'operator' => 'not_contains', 'value' => '@banned.com'],
            ['email' => 'alice@example.com'],
        ));
        $this->assertFalse(AudienceMatcher::matchesCondition(
            ['attribute' => 'email', 'operator' => 'not_contains', 'value' => '@banned.com'],
            ['email' => 'spammer@banned.com'],
        ));
    }

    public function testMissingAttributeReturnsFalse(): void
    {
        $this->assertFalse(AudienceMatcher::matchesCondition(
            ['attribute' => 'plan', 'operator' => 'equals', 'value' => 'premium'],
            ['country' => 'US'],
        ));
    }

    public function testUnknownOperatorReturnsFalse(): void
    {
        $this->assertFalse(AudienceMatcher::matchesCondition(
            ['attribute' => 'plan', 'operator' => 'unknown_op', 'value' => 'premium'],
            ['plan' => 'premium'],
        ));
    }

    // -------------------------------------------------------------------------
    // matchesAudiences — any / all / empty
    // -------------------------------------------------------------------------

    public function testNoAudiencesMatchesAll(): void
    {
        $this->assertTrue(AudienceMatcher::matchesAudiences([], 'any', ['plan' => 'free']));
        $this->assertTrue(AudienceMatcher::matchesAudiences([], 'all', []));
    }

    public function testAnyMatchType(): void
    {
        $audiences = [
            ['conditions' => [['attribute' => 'plan', 'operator' => 'equals', 'value' => 'premium']]],
            ['conditions' => [['attribute' => 'country', 'operator' => 'equals', 'value' => 'US']]],
        ];

        // Matches first audience
        $this->assertTrue(AudienceMatcher::matchesAudiences($audiences, 'any', ['plan' => 'premium']));
        // Matches second audience
        $this->assertTrue(AudienceMatcher::matchesAudiences($audiences, 'any', ['country' => 'US']));
        // Matches neither
        $this->assertFalse(AudienceMatcher::matchesAudiences($audiences, 'any', ['plan' => 'free', 'country' => 'DE']));
    }

    public function testAllMatchType(): void
    {
        $audiences = [
            ['conditions' => [['attribute' => 'plan', 'operator' => 'equals', 'value' => 'premium']]],
            ['conditions' => [['attribute' => 'country', 'operator' => 'equals', 'value' => 'US']]],
        ];

        // Matches both audiences → true
        $this->assertTrue(AudienceMatcher::matchesAudiences($audiences, 'all', ['plan' => 'premium', 'country' => 'US']));
        // Matches only one → false
        $this->assertFalse(AudienceMatcher::matchesAudiences($audiences, 'all', ['plan' => 'premium', 'country' => 'DE']));
    }
}
