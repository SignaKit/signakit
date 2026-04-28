<?php

declare(strict_types=1);

namespace SignaKit\FlagsPhp\Tests;

use PHPUnit\Framework\TestCase;
use SignaKit\FlagsPhp\Evaluator;
use SignaKit\FlagsPhp\Hasher;
use SignaKit\FlagsPhp\Types\ProjectConfig;

/**
 * @covers \SignaKit\FlagsPhp\Evaluator
 */
final class EvaluatorTest extends TestCase
{
    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private function makeFlag(array $overrides = []): array
    {
        return array_merge([
            'id'         => 'flag-uuid',
            'key'        => 'test-flag',
            'status'     => 'active',
            'running'    => true,
            'salt'       => 'test-salt',
            'variations' => [['key' => 'control'], ['key' => 'treatment']],
            'allocation' => [
                'ranges' => [
                    ['variation' => 'control',   'start' => 0,    'end' => 4999],
                    ['variation' => 'treatment', 'start' => 5000, 'end' => 9999],
                ],
            ],
            'rules' => [],
        ], $overrides);
    }

    // -------------------------------------------------------------------------
    // Archived flag
    // -------------------------------------------------------------------------

    public function testArchivedFlagReturnsNull(): void
    {
        $flag   = $this->makeFlag(['status' => 'archived']);
        $result = Evaluator::evaluateFlag($flag, 'user-1');

        $this->assertNull($result);
    }

    // -------------------------------------------------------------------------
    // Stopped flag
    // -------------------------------------------------------------------------

    public function testStoppedFlagReturnsOff(): void
    {
        $flag   = $this->makeFlag(['running' => false]);
        $result = Evaluator::evaluateFlag($flag, 'user-1');

        $this->assertNotNull($result);
        $this->assertSame('off',      $result->variationKey);
        $this->assertFalse($result->enabled);
        $this->assertNull($result->ruleKey);
    }

    // -------------------------------------------------------------------------
    // Allowlist override
    // -------------------------------------------------------------------------

    public function testAllowlistOverrideBypassesTraffic(): void
    {
        $flag = $this->makeFlag([
            'rules' => [
                [
                    'ruleKey'             => 'rule-0',
                    'ruleType'            => 'ab-test',
                    'trafficPercentage'   => 0,    // 0% traffic — no one would normally be bucketed
                    'variationAllocation' => ['ranges' => []],
                    'audiences'           => [],
                    'audienceMatchType'   => 'any',
                    'allowlist'           => [['userId' => 'allowed-user', 'variation' => 'treatment']],
                ],
            ],
        ]);

        $result = Evaluator::evaluateFlag($flag, 'allowed-user');

        $this->assertNotNull($result);
        $this->assertSame('treatment', $result->variationKey);
        $this->assertTrue($result->enabled);
        $this->assertSame('rule-0', $result->ruleKey);
    }

    public function testAllowlistDoesNotMatchOtherUsers(): void
    {
        $flag = $this->makeFlag([
            'rules' => [
                [
                    'ruleKey'             => 'rule-0',
                    'ruleType'            => 'ab-test',
                    'trafficPercentage'   => 100,
                    'variationAllocation' => [
                        'ranges' => [
                            ['variation' => 'control', 'start' => 0, 'end' => 9999],
                        ],
                    ],
                    'audiences'           => [],
                    'audienceMatchType'   => 'any',
                    'allowlist'           => [['userId' => 'special-user', 'variation' => 'treatment']],
                ],
            ],
        ]);

        $result = Evaluator::evaluateFlag($flag, 'normal-user');

        $this->assertNotNull($result);
        // 'normal-user' should go through traffic and get 'control' (not treatment from allowlist)
        $this->assertSame('control', $result->variationKey);
    }

    // -------------------------------------------------------------------------
    // Audience matching
    // -------------------------------------------------------------------------

    public function testAudienceFilterExcludesNonMatchingUser(): void
    {
        $flag = $this->makeFlag([
            'rules' => [
                [
                    'ruleKey'             => 'rule-premium',
                    'ruleType'            => 'ab-test',
                    'trafficPercentage'   => 100,
                    'variationAllocation' => [
                        'ranges' => [['variation' => 'treatment', 'start' => 0, 'end' => 9999]],
                    ],
                    'audiences'           => [
                        ['conditions' => [['attribute' => 'plan', 'operator' => 'equals', 'value' => 'premium']]],
                    ],
                    'audienceMatchType'   => 'any',
                    'allowlist'           => [],
                ],
            ],
        ]);

        // free-plan user should not match the rule → falls to default allocation
        $result = Evaluator::evaluateFlag($flag, 'free-user', ['plan' => 'free']);
        $this->assertNotNull($result);
        $this->assertNull($result->ruleKey); // used default allocation
    }

    public function testAudienceFilterIncludesMatchingUser(): void
    {
        $flag = $this->makeFlag([
            'rules' => [
                [
                    'ruleKey'             => 'rule-premium',
                    'ruleType'            => 'ab-test',
                    'trafficPercentage'   => 100,
                    'variationAllocation' => [
                        'ranges' => [['variation' => 'treatment', 'start' => 0, 'end' => 9999]],
                    ],
                    'audiences'           => [
                        ['conditions' => [['attribute' => 'plan', 'operator' => 'equals', 'value' => 'premium']]],
                    ],
                    'audienceMatchType'   => 'any',
                    'allowlist'           => [],
                ],
            ],
        ]);

        $result = Evaluator::evaluateFlag($flag, 'premium-user', ['plan' => 'premium']);
        $this->assertNotNull($result);
        $this->assertSame('rule-premium', $result->ruleKey);
        $this->assertSame('treatment', $result->variationKey);
    }

    // -------------------------------------------------------------------------
    // Traffic allocation
    // -------------------------------------------------------------------------

    public function testZeroPercentTrafficExcludesAllUsers(): void
    {
        $flag = $this->makeFlag([
            'rules' => [
                [
                    'ruleKey'             => 'rule-0',
                    'ruleType'            => 'ab-test',
                    'trafficPercentage'   => 0,
                    'variationAllocation' => ['ranges' => [['variation' => 'treatment', 'start' => 0, 'end' => 9999]]],
                    'audiences'           => [],
                    'audienceMatchType'   => 'any',
                    'allowlist'           => [],
                ],
            ],
        ]);

        // With 0% traffic no one enters the rule; check with several users
        foreach (['user-a', 'user-b', 'user-c'] as $userId) {
            $result = Evaluator::evaluateFlag($flag, $userId);
            $this->assertNotNull($result);
            $this->assertNull($result->ruleKey, "User {$userId} should fall to default, not rule-0");
        }
    }

    // -------------------------------------------------------------------------
    // Default allocation
    // -------------------------------------------------------------------------

    public function testDefaultAllocationUsedWhenNoRulesMatch(): void
    {
        $flag   = $this->makeFlag(['rules' => []]);
        $result = Evaluator::evaluateFlag($flag, 'user-default');

        $this->assertNotNull($result);
        $this->assertNull($result->ruleKey);
        $this->assertTrue($result->enabled);
        $this->assertContains($result->variationKey, ['control', 'treatment']);
    }

    public function testDefaultAllocationIsDeterministic(): void
    {
        $flag    = $this->makeFlag(['rules' => []]);
        $result1 = Evaluator::evaluateFlag($flag, 'consistent-user');
        $result2 = Evaluator::evaluateFlag($flag, 'consistent-user');

        $this->assertNotNull($result1);
        $this->assertNotNull($result2);
        $this->assertSame($result1->variationKey, $result2->variationKey);
    }

    // -------------------------------------------------------------------------
    // evaluateAllFlags
    // -------------------------------------------------------------------------

    public function testEvaluateAllFlagsOmitsArchivedFlags(): void
    {
        $config = new ProjectConfig(
            projectId:      '123',
            environmentKey: 'production',
            sdkKey:         'sk_prod_org_123_xxxx',
            version:        1,
            flags:          [
                $this->makeFlag(['key' => 'active-flag', 'status' => 'active']),
                $this->makeFlag(['key' => 'archived-flag', 'status' => 'archived']),
            ],
        );

        $decisions = Evaluator::evaluateAllFlags($config, 'user-1');

        $this->assertArrayHasKey('active-flag', $decisions);
        $this->assertArrayNotHasKey('archived-flag', $decisions);
    }

    public function testEvaluateAllFlagsReturnsMappedByFlagKey(): void
    {
        $config = new ProjectConfig(
            projectId:      '123',
            environmentKey: 'production',
            sdkKey:         'sk_prod_org_123_xxxx',
            version:        1,
            flags:          [
                $this->makeFlag(['key' => 'flag-one']),
                $this->makeFlag(['key' => 'flag-two']),
            ],
        );

        $decisions = Evaluator::evaluateAllFlags($config, 'user-1');

        $this->assertArrayHasKey('flag-one', $decisions);
        $this->assertArrayHasKey('flag-two', $decisions);
        $this->assertSame('flag-one', $decisions['flag-one']->flagKey);
        $this->assertSame('flag-two', $decisions['flag-two']->flagKey);
    }
}
