<?php

declare(strict_types=1);

namespace SignaKit\FlagsPhp\Tests;

use PHPUnit\Framework\TestCase;
use SignaKit\FlagsPhp\Evaluator;
use SignaKit\FlagsPhp\Types\Decision;
use SignaKit\FlagsPhp\Types\ProjectConfig;

final class EvaluatorTest extends TestCase
{
    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Build a minimal valid flag array. Defaults: active, running, all users → 'on'.
     *
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private function makeFlag(string $key, array $overrides = []): array
    {
        return array_merge([
            'id'         => "flag_{$key}",
            'key'        => $key,
            'status'     => 'active',
            'running'    => true,
            'salt'       => "{$key}-salt",
            'variations' => [['key' => 'off'], ['key' => 'on']],
            'allocation' => ['ranges' => [['variation' => 'on', 'start' => 0, 'end' => 9999]]],
        ], $overrides);
    }

    // -------------------------------------------------------------------------
    // Status / running checks
    // -------------------------------------------------------------------------

    public function test_returns_null_for_archived_flags(): void
    {
        $flag = $this->makeFlag('archived', ['status' => 'archived']);
        $this->assertNull(Evaluator::evaluateFlag($flag, 'user-1'));
    }

    public function test_returns_off_decision_for_stopped_flags(): void
    {
        $flag   = $this->makeFlag('disabled', ['running' => false]);
        $result = Evaluator::evaluateFlag($flag, 'user-1');

        $this->assertNotNull($result);
        $this->assertSame('off', $result->variationKey);
        $this->assertFalse($result->enabled);
        $this->assertNull($result->ruleKey);
        $this->assertNull($result->ruleType);
    }

    // -------------------------------------------------------------------------
    // Allowlist
    // -------------------------------------------------------------------------

    public function test_returns_allowlisted_variation_for_a_listed_user(): void
    {
        $flag = $this->makeFlag('allowlist', [
            'allocation' => ['ranges' => [['variation' => 'off', 'start' => 0, 'end' => 9999]]],
            'rules'      => [
                [
                    'ruleKey'             => 'rule-qa',
                    'ruleType'            => 'targeted',
                    'trafficPercentage'   => 0,
                    'variationAllocation' => ['ranges' => [['variation' => 'on', 'start' => 0, 'end' => 9999]]],
                    'allowlist'           => [
                        ['userId' => 'qa-user',     'variation' => 'on'],
                        ['userId' => 'qa-off-user', 'variation' => 'off'],
                    ],
                ],
            ],
        ]);

        $result = Evaluator::evaluateFlag($flag, 'qa-user');
        $this->assertNotNull($result);
        $this->assertSame('on', $result->variationKey);
        $this->assertSame('rule-qa', $result->ruleKey);
        $this->assertSame('targeted', $result->ruleType);
    }

    public function test_returns_allowlisted_off_variation_when_explicitly_set(): void
    {
        $flag = $this->makeFlag('allowlist', [
            'allocation' => ['ranges' => [['variation' => 'off', 'start' => 0, 'end' => 9999]]],
            'rules'      => [
                [
                    'ruleKey'             => 'rule-qa',
                    'ruleType'            => 'targeted',
                    'trafficPercentage'   => 0,
                    'variationAllocation' => ['ranges' => [['variation' => 'on', 'start' => 0, 'end' => 9999]]],
                    'allowlist'           => [
                        ['userId' => 'qa-off-user', 'variation' => 'off'],
                    ],
                ],
            ],
        ]);

        $result = Evaluator::evaluateFlag($flag, 'qa-off-user');
        $this->assertNotNull($result);
        $this->assertSame('off', $result->variationKey);
        $this->assertSame('rule-qa', $result->ruleKey);
    }

    public function test_falls_through_to_default_allocation_for_non_allowlisted_users(): void
    {
        $flag = $this->makeFlag('allowlist', [
            'allocation' => ['ranges' => [['variation' => 'off', 'start' => 0, 'end' => 9999]]],
            'rules'      => [
                [
                    'ruleKey'             => 'rule-qa',
                    'ruleType'            => 'targeted',
                    'trafficPercentage'   => 0,
                    'variationAllocation' => ['ranges' => [['variation' => 'on', 'start' => 0, 'end' => 9999]]],
                    'allowlist'           => [
                        ['userId' => 'qa-user', 'variation' => 'on'],
                    ],
                ],
            ],
        ]);

        $result = Evaluator::evaluateFlag($flag, 'random-user');
        // trafficPercentage=0 → no rule match; default allocation returns 'off'
        $this->assertNotNull($result);
        $this->assertSame('off', $result->variationKey);
        $this->assertNull($result->ruleKey);
    }

    // -------------------------------------------------------------------------
    // Traffic allocation
    // -------------------------------------------------------------------------

    public function test_places_all_users_in_traffic_when_trafficPercentage_is_100(): void
    {
        $flag = $this->makeFlag('full-traffic', [
            'rules' => [
                [
                    'ruleKey'             => 'rule-all',
                    'ruleType'            => 'ab-test',
                    'trafficPercentage'   => 100,
                    'variationAllocation' => ['ranges' => [['variation' => 'on', 'start' => 0, 'end' => 9999]]],
                ],
            ],
        ]);

        $result = Evaluator::evaluateFlag($flag, 'any-user');
        $this->assertNotNull($result);
        $this->assertSame('on', $result->variationKey);
        $this->assertSame('rule-all', $result->ruleKey);
    }

    public function test_places_no_users_in_traffic_when_trafficPercentage_is_0(): void
    {
        $flag = $this->makeFlag('zero-traffic', [
            'allocation' => ['ranges' => [['variation' => 'off', 'start' => 0, 'end' => 9999]]],
            'rules'      => [
                [
                    'ruleKey'             => 'rule-none',
                    'ruleType'            => 'ab-test',
                    'trafficPercentage'   => 0,
                    'variationAllocation' => ['ranges' => [['variation' => 'on', 'start' => 0, 'end' => 9999]]],
                ],
            ],
        ]);

        $result = Evaluator::evaluateFlag($flag, 'any-user');
        // No traffic → falls through to default → 'off'
        $this->assertNotNull($result);
        $this->assertSame('off', $result->variationKey);
        $this->assertNull($result->ruleKey);
    }

    // -------------------------------------------------------------------------
    // Audience targeting
    // -------------------------------------------------------------------------

    public function test_matches_rule_for_user_whose_attributes_satisfy_the_audience(): void
    {
        $flag = $this->makeFlag('targeted', [
            'allocation' => ['ranges' => [['variation' => 'off', 'start' => 0, 'end' => 9999]]],
            'rules'      => [
                [
                    'ruleKey'             => 'rule-premium',
                    'ruleType'            => 'ab-test',
                    'audienceMatchType'   => 'any',
                    'audiences'           => [
                        ['conditions' => [['attribute' => 'plan', 'operator' => 'equals', 'value' => 'premium']]],
                    ],
                    'trafficPercentage'   => 100,
                    'variationAllocation' => ['ranges' => [['variation' => 'on', 'start' => 0, 'end' => 9999]]],
                ],
            ],
        ]);

        $result = Evaluator::evaluateFlag($flag, 'premium-user', ['plan' => 'premium']);
        $this->assertNotNull($result);
        $this->assertSame('on', $result->variationKey);
        $this->assertSame('rule-premium', $result->ruleKey);
    }

    public function test_falls_through_to_default_for_user_who_does_not_match_audience(): void
    {
        $flag = $this->makeFlag('targeted', [
            'allocation' => ['ranges' => [['variation' => 'off', 'start' => 0, 'end' => 9999]]],
            'rules'      => [
                [
                    'ruleKey'             => 'rule-premium',
                    'ruleType'            => 'ab-test',
                    'audienceMatchType'   => 'any',
                    'audiences'           => [
                        ['conditions' => [['attribute' => 'plan', 'operator' => 'equals', 'value' => 'premium']]],
                    ],
                    'trafficPercentage'   => 100,
                    'variationAllocation' => ['ranges' => [['variation' => 'on', 'start' => 0, 'end' => 9999]]],
                ],
            ],
        ]);

        $result = Evaluator::evaluateFlag($flag, 'free-user', ['plan' => 'free']);
        $this->assertNotNull($result);
        $this->assertSame('off', $result->variationKey);
        $this->assertNull($result->ruleKey);
    }

    public function test_falls_through_to_default_when_user_has_no_attributes(): void
    {
        $flag = $this->makeFlag('targeted', [
            'allocation' => ['ranges' => [['variation' => 'off', 'start' => 0, 'end' => 9999]]],
            'rules'      => [
                [
                    'ruleKey'             => 'rule-premium',
                    'ruleType'            => 'ab-test',
                    'audienceMatchType'   => 'any',
                    'audiences'           => [
                        ['conditions' => [['attribute' => 'plan', 'operator' => 'equals', 'value' => 'premium']]],
                    ],
                    'trafficPercentage'   => 100,
                    'variationAllocation' => ['ranges' => [['variation' => 'on', 'start' => 0, 'end' => 9999]]],
                ],
            ],
        ]);

        $result = Evaluator::evaluateFlag($flag, 'attr-less-user');
        $this->assertNotNull($result);
        $this->assertSame('off', $result->variationKey);
        $this->assertNull($result->ruleKey);
    }

    // -------------------------------------------------------------------------
    // Default allocation
    // -------------------------------------------------------------------------

    public function test_uses_default_allocation_when_no_rules_exist(): void
    {
        $flag   = $this->makeFlag('no-rules', [
            'allocation' => ['ranges' => [['variation' => 'on', 'start' => 0, 'end' => 9999]]],
        ]);
        $result = Evaluator::evaluateFlag($flag, 'user-1');

        $this->assertNotNull($result);
        $this->assertSame('on', $result->variationKey);
        $this->assertNull($result->ruleKey);
        $this->assertNull($result->ruleType);
    }

    public function test_returns_null_when_default_allocation_ranges_are_empty(): void
    {
        // PHP: resolveVariation returns null → evaluateFlag returns null (no off fallback)
        $flag   = $this->makeFlag('empty-alloc', ['allocation' => ['ranges' => []]]);
        $result = Evaluator::evaluateFlag($flag, 'user-1');
        $this->assertNull($result);
    }

    // -------------------------------------------------------------------------
    // Determinism
    // -------------------------------------------------------------------------

    public function test_always_assigns_the_same_variation_to_the_same_user(): void
    {
        $flag = $this->makeFlag('determinism', [
            'allocation' => [
                'ranges' => [
                    ['variation' => 'off', 'start' => 0,    'end' => 4999],
                    ['variation' => 'on',  'start' => 5000, 'end' => 9999],
                ],
            ],
        ]);

        $variations = array_map(
            fn() => Evaluator::evaluateFlag($flag, 'user-stable')?->variationKey,
            range(0, 9),
        );

        $this->assertCount(1, array_unique(array_filter($variations)));
    }

    // -------------------------------------------------------------------------
    // evaluateAllFlags
    // -------------------------------------------------------------------------

    public function test_returns_decisions_for_all_non_archived_flags(): void
    {
        $config = new ProjectConfig(
            projectId:      'p1',
            environmentKey: 'development',
            sdkKey:         'sk_dev_org1_p1_xxx',
            version:        1,
            flags:          [
                $this->makeFlag('active-a'),
                $this->makeFlag('active-b'),
                $this->makeFlag('archived-c', ['status' => 'archived']),
            ],
        );

        $decisions = Evaluator::evaluateAllFlags($config, 'user-1');

        $this->assertCount(2, $decisions);
        $this->assertArrayHasKey('active-a', $decisions);
        $this->assertArrayHasKey('active-b', $decisions);
        $this->assertArrayNotHasKey('archived-c', $decisions);
    }

    public function test_includes_flagKey_on_each_decision(): void
    {
        $config = new ProjectConfig(
            projectId:      'p1',
            environmentKey: 'development',
            sdkKey:         'sk_dev_org1_p1_xxx',
            version:        1,
            flags:          [
                $this->makeFlag('active-a'),
                $this->makeFlag('active-b'),
            ],
        );

        $decisions = Evaluator::evaluateAllFlags($config, 'user-1');

        $this->assertSame('active-a', $decisions['active-a']->flagKey);
        $this->assertSame('active-b', $decisions['active-b']->flagKey);
    }
}
