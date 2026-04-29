<?php

declare(strict_types=1);

namespace SignaKit\FlagsLaravel\Tests;

use Orchestra\Testbench\TestCase;
use RuntimeException;
use SignaKit\FlagsLaravel\SignaKitManager;
use SignaKit\FlagsLaravel\SignaKitServiceProvider;
use SignaKit\FlagsPhp\Contracts\HttpClientInterface;
use SignaKit\FlagsPhp\SignaKitClient;

final class SignaKitServiceProviderTest extends TestCase
{
    // -------------------------------------------------------------------------
    // Orchestra Testbench wiring
    // -------------------------------------------------------------------------

    protected function getPackageProviders($app): array
    {
        return [SignaKitServiceProvider::class];
    }

    // -------------------------------------------------------------------------
    // Config
    // -------------------------------------------------------------------------

    public function test_package_config_is_merged_under_signakit_key(): void
    {
        // The service provider calls mergeConfigFrom(), so the key must exist
        $this->assertTrue($this->app['config']->has('signakit'));
        $this->assertTrue($this->app['config']->has('signakit.sdk_key'));
    }

    // -------------------------------------------------------------------------
    // Singleton registration
    // -------------------------------------------------------------------------

    public function test_throws_runtime_exception_when_sdk_key_is_empty(): void
    {
        $this->app['config']->set('signakit.sdk_key', null);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/SDK key is not configured/');

        $this->app->make(SignaKitClient::class);
    }

    public function test_throws_runtime_exception_when_sdk_key_is_blank_string(): void
    {
        $this->app['config']->set('signakit.sdk_key', '');

        $this->expectException(RuntimeException::class);
        $this->app->make(SignaKitClient::class);
    }

    public function test_signakit_alias_resolves_to_same_instance_as_client_class(): void
    {
        // Override the singleton to avoid a real HTTP call
        $this->app->singleton(SignaKitClient::class, fn () => $this->buildStubClient());

        $client  = $this->app->make(SignaKitClient::class);
        $aliased = $this->app->make('signakit');

        $this->assertSame($client, $aliased);
    }

    public function test_signakit_client_is_a_singleton(): void
    {
        $this->app->singleton(SignaKitClient::class, fn () => $this->buildStubClient());

        $a = $this->app->make(SignaKitClient::class);
        $b = $this->app->make(SignaKitClient::class);

        $this->assertSame($a, $b);
    }

    // -------------------------------------------------------------------------
    // Manager binding
    // -------------------------------------------------------------------------

    public function test_manager_is_bound_in_container(): void
    {
        $this->app->singleton(SignaKitClient::class, fn () => $this->buildStubClient());

        $manager = $this->app->make(SignaKitManager::class);

        $this->assertInstanceOf(SignaKitManager::class, $manager);
    }

    // -------------------------------------------------------------------------
    // Helper
    // -------------------------------------------------------------------------

    private function buildStubClient(): SignaKitClient
    {
        $stub = new class implements HttpClientInterface {
            public function get(string $url, array $headers = []): array
            {
                return [
                    'status'  => 200,
                    'body'    => json_encode([
                        'projectId'      => 'proj1',
                        'environmentKey' => 'development',
                        'sdkKey'         => 'sk_dev_org1_proj1_abc',
                        'version'        => 1,
                        'flags'          => [],
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
