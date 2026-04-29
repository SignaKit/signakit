<?php

declare(strict_types=1);

namespace SignaKit\FlagsLaravel\Tests;

use PHPUnit\Framework\TestCase;
use SignaKit\FlagsLaravel\SignaKitManager;
use SignaKit\FlagsPhp\Contracts\HttpClientInterface;
use SignaKit\FlagsPhp\SignaKitClient;
use SignaKit\FlagsPhp\SignaKitUserContext;

final class SignaKitManagerTest extends TestCase
{
    // -------------------------------------------------------------------------
    // forUser()
    // -------------------------------------------------------------------------

    public function test_forUser_returns_a_SignaKitUserContext(): void
    {
        $manager = new SignaKitManager($this->buildInitializedClient());

        $ctx = $manager->forUser('user-42');

        $this->assertInstanceOf(SignaKitUserContext::class, $ctx);
    }

    public function test_forUser_defaults_to_empty_attributes(): void
    {
        $manager = new SignaKitManager($this->buildInitializedClient());

        // Should not throw — empty attributes are valid
        $ctx = $manager->forUser('user-1');

        $this->assertInstanceOf(SignaKitUserContext::class, $ctx);
    }

    public function test_forUser_passes_attributes_to_user_context(): void
    {
        $flag = [
            'id'         => 'flag_targeted',
            'key'        => 'targeted',
            'status'     => 'active',
            'running'    => true,
            'salt'       => 'targeted-salt',
            'variations' => [['key' => 'off'], ['key' => 'on']],
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
        ];

        $client  = $this->buildInitializedClient([$flag]);
        $manager = new SignaKitManager($client);

        $premiumCtx = $manager->forUser('user-1', ['plan' => 'premium']);
        $freeCtx    = $manager->forUser('user-2', ['plan' => 'free']);

        $this->assertSame('on',  $premiumCtx->decide('targeted')?->variationKey);
        $this->assertSame('off', $freeCtx->decide('targeted')?->variationKey);
    }

    public function test_forUser_returns_distinct_context_per_call(): void
    {
        $manager = new SignaKitManager($this->buildInitializedClient());

        $ctx1 = $manager->forUser('user-1');
        $ctx2 = $manager->forUser('user-2');

        $this->assertNotSame($ctx1, $ctx2);
    }

    // -------------------------------------------------------------------------
    // Helper
    // -------------------------------------------------------------------------

    private function buildInitializedClient(array $flags = []): SignaKitClient
    {
        $stub = new class($flags) implements HttpClientInterface {
            public function __construct(private readonly array $flags) {}

            public function get(string $url, array $headers = []): array
            {
                return [
                    'status'  => 200,
                    'body'    => json_encode([
                        'projectId'      => 'proj1',
                        'environmentKey' => 'development',
                        'sdkKey'         => 'sk_dev_org1_proj1_abc',
                        'version'        => 1,
                        'flags'          => $this->flags,
                    ]),
                    'headers' => [],
                ];
            }

            public function post(string $url, array $headers = [], string $body = ''): void {}
        };

        $client = new SignaKitClient('sk_dev_org1_proj1_abc', $stub);
        $client->initialize();

        return $client;
    }
}
