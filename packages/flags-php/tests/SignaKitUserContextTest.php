<?php

declare(strict_types=1);

namespace SignaKit\FlagsPhp\Tests;

use PHPUnit\Framework\TestCase;
use SignaKit\FlagsPhp\Contracts\HttpClientInterface;
use SignaKit\FlagsPhp\SignaKitUserContext;
use SignaKit\FlagsPhp\Types\ProjectConfig;

final class SignaKitUserContextTest extends TestCase
{
    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function makeConfig(array $flags = []): ProjectConfig
    {
        return new ProjectConfig(
            projectId:      'proj1',
            environmentKey: 'development',
            sdkKey:         'sk_dev_org1_proj1_abc',
            version:        1,
            flags:          $flags,
        );
    }

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

    private function makeHttpClient(?array &$lastPost = null): HttpClientInterface
    {
        return new class($lastPost) implements HttpClientInterface {
            public function __construct(private ?array &$lastPost) {}

            public function get(string $url, array $headers = []): array
            {
                return ['status' => 200, 'body' => '{}', 'headers' => []];
            }

            public function post(string $url, array $headers = [], string $body = ''): void
            {
                $this->lastPost = ['url' => $url, 'headers' => $headers, 'body' => $body];
            }
        };
    }

    private function makeContext(
        string $userId = 'user-1',
        array $attributes = [],
        array $flags = [],
        ?array &$lastPost = null,
    ): SignaKitUserContext {
        return new SignaKitUserContext(
            userId:     $userId,
            attributes: $attributes,
            config:     $this->makeConfig($flags),
            httpClient: $this->makeHttpClient($lastPost),
            sdkKey:     'sk_dev_org1_proj1_abc',
        );
    }

    // -------------------------------------------------------------------------
    // decide()
    // -------------------------------------------------------------------------

    public function test_decide_returns_decision_for_a_known_flag(): void
    {
        $ctx    = $this->makeContext(flags: [$this->makeFlag('my-flag')]);
        $result = $ctx->decide('my-flag');

        $this->assertNotNull($result);
        $this->assertSame('my-flag', $result->flagKey);
        $this->assertSame('on', $result->variationKey);
    }

    public function test_decide_returns_null_for_unknown_flag(): void
    {
        $ctx = $this->makeContext();
        $this->assertNull($ctx->decide('unknown-flag'));
    }

    public function test_decide_passes_attributes_to_evaluator(): void
    {
        $flag = $this->makeFlag('targeted', [
            'allocation' => ['ranges' => [['variation' => 'off', 'start' => 0, 'end' => 9999]]],
            'rules'      => [
                [
                    'ruleKey'             => 'premium-rule',
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

        $ctx = $this->makeContext(attributes: ['plan' => 'premium'], flags: [$flag]);
        $this->assertSame('on', $ctx->decide('targeted')?->variationKey);

        $ctx2 = $this->makeContext(attributes: ['plan' => 'free'], flags: [$flag]);
        $this->assertSame('off', $ctx2->decide('targeted')?->variationKey);
    }

    // -------------------------------------------------------------------------
    // decideAll()
    // -------------------------------------------------------------------------

    public function test_decideAll_returns_map_of_all_non_archived_flags(): void
    {
        $flags = [
            $this->makeFlag('flag-a'),
            $this->makeFlag('flag-b'),
            $this->makeFlag('archived', ['status' => 'archived']),
        ];

        $ctx       = $this->makeContext(flags: $flags);
        $decisions = $ctx->decideAll();

        $this->assertCount(2, $decisions);
        $this->assertArrayHasKey('flag-a', $decisions);
        $this->assertArrayHasKey('flag-b', $decisions);
        $this->assertArrayNotHasKey('archived', $decisions);
    }

    // -------------------------------------------------------------------------
    // trackEvent()
    // -------------------------------------------------------------------------

    public function test_trackEvent_posts_a_conversion_event(): void
    {
        $lastPost = null;
        $ctx      = $this->makeContext(userId: 'user-42', lastPost: $lastPost);
        $ctx->trackEvent('checkout_complete');

        $this->assertNotNull($lastPost);
        $payload = json_decode($lastPost['body'], associative: true);
        $event   = $payload['events'][0];

        $this->assertSame('conversion', $event['type']);
        $this->assertSame('checkout_complete', $event['eventKey']);
        $this->assertSame('user-42', $event['userId']);
        $this->assertArrayHasKey('timestamp', $event);
    }

    public function test_trackEvent_includes_value_when_provided(): void
    {
        $lastPost = null;
        $ctx      = $this->makeContext(lastPost: $lastPost);
        $ctx->trackEvent('purchase', 49.99);

        $payload = json_decode($lastPost['body'], associative: true);
        $this->assertSame(49.99, $payload['events'][0]['value']);
    }

    public function test_trackEvent_omits_value_when_not_provided(): void
    {
        $lastPost = null;
        $ctx      = $this->makeContext(lastPost: $lastPost);
        $ctx->trackEvent('page_view');

        $payload = json_decode($lastPost['body'], associative: true);
        $this->assertArrayNotHasKey('value', $payload['events'][0]);
    }

    public function test_trackEvent_sends_correct_sdk_key_header(): void
    {
        $lastPost = null;
        $ctx      = $this->makeContext(lastPost: $lastPost);
        $ctx->trackEvent('any-event');

        $this->assertSame('sk_dev_org1_proj1_abc', $lastPost['headers']['X-SDK-Key']);
    }

    // -------------------------------------------------------------------------
    // sendExposure()
    // -------------------------------------------------------------------------

    public function test_sendExposure_posts_an_exposure_event(): void
    {
        $lastPost = null;
        $ctx      = $this->makeContext(userId: 'user-99', lastPost: $lastPost);
        $ctx->sendExposure('my-flag', 'on', 'rule-abc', 'ab-test');

        $this->assertNotNull($lastPost);
        $payload = json_decode($lastPost['body'], associative: true);
        $event   = $payload['events'][0];

        $this->assertSame('$exposure', $event['type']);
        $this->assertSame('my-flag', $event['flagKey']);
        $this->assertSame('on', $event['variationKey']);
        $this->assertSame('rule-abc', $event['ruleKey']);
        $this->assertSame('user-99', $event['userId']);
    }

    public function test_sendExposure_skips_targeted_rule_type(): void
    {
        $lastPost = null;
        $ctx      = $this->makeContext(lastPost: $lastPost);
        $ctx->sendExposure('my-flag', 'on', 'rule-abc', 'targeted');

        // No HTTP call should have been made
        $this->assertNull($lastPost);
    }

    public function test_sendExposure_fires_when_ruleType_is_null(): void
    {
        $lastPost = null;
        $ctx      = $this->makeContext(lastPost: $lastPost);
        $ctx->sendExposure('my-flag', 'on', null, null);

        $this->assertNotNull($lastPost);
    }

    public function test_sendExposure_silently_swallows_http_errors(): void
    {
        $failingClient = new class implements HttpClientInterface {
            public function get(string $url, array $headers = []): array
            {
                return ['status' => 200, 'body' => '{}', 'headers' => []];
            }

            public function post(string $url, array $headers = [], string $body = ''): void
            {
                throw new \RuntimeException('Network failure');
            }
        };

        $ctx = new SignaKitUserContext(
            userId:     'user-1',
            attributes: [],
            config:     $this->makeConfig(),
            httpClient: $failingClient,
            sdkKey:     'sk_dev_org1_proj1_abc',
        );

        // Should not throw
        $ctx->sendExposure('my-flag', 'on', 'rule-abc', 'ab-test');
        $this->assertTrue(true);
    }
}
