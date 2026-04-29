<?php

declare(strict_types=1);

namespace SignaKit\FlagsPhp\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use SignaKit\FlagsPhp\ConfigManager;
use SignaKit\FlagsPhp\Contracts\HttpClientInterface;

final class ConfigManagerTest extends TestCase
{
    // -------------------------------------------------------------------------
    // parseSdkKey — valid keys
    // -------------------------------------------------------------------------

    public static function validSdkKeyProvider(): array
    {
        return [
            'prod key'         => ['sk_prod_org1_proj1_abc123', 'prod', 'org1',  'proj1'],
            'dev key'          => ['sk_dev_org1_proj1_abc123',  'dev',  'org1',  'proj1'],
            'long random part' => ['sk_dev_myorg_myproj_verylongrandomstring', 'dev', 'myorg', 'myproj'],
        ];
    }

    #[DataProvider('validSdkKeyProvider')]
    public function test_parseSdkKey_parses_valid_keys(
        string $sdkKey,
        string $expectedEnv,
        string $expectedOrgId,
        string $expectedProjectId,
    ): void {
        $parsed = ConfigManager::parseSdkKey($sdkKey);

        $this->assertSame($expectedEnv, $parsed['env']);
        $this->assertSame($expectedOrgId, $parsed['orgId']);
        $this->assertSame($expectedProjectId, $parsed['projectId']);
    }

    // -------------------------------------------------------------------------
    // parseSdkKey — invalid keys
    // -------------------------------------------------------------------------

    public static function invalidSdkKeyProvider(): array
    {
        return [
            'too few segments' => ['sk_dev_org1'],
            'wrong prefix'     => ['token_dev_org1_proj1_abc'],
            'invalid env'      => ['sk_staging_org1_proj1_abc'],
            'empty orgId'      => ['sk_dev__proj1_abc'],
            'empty projectId'  => ['sk_dev_org1__abc'],
            'empty random'     => ['sk_dev_org1_proj1_'],
        ];
    }

    #[DataProvider('invalidSdkKeyProvider')]
    public function test_parseSdkKey_throws_on_invalid_keys(string $sdkKey): void
    {
        $this->expectException(RuntimeException::class);
        ConfigManager::parseSdkKey($sdkKey);
    }

    // -------------------------------------------------------------------------
    // fetchConfig — HTTP interactions
    // -------------------------------------------------------------------------

    private function makeStaticHttpClient(array $response): HttpClientInterface
    {
        return new class($response) implements HttpClientInterface {
            public function __construct(private readonly array $response) {}

            public function get(string $url, array $headers = []): array
            {
                return $this->response;
            }

            public function post(string $url, array $headers = [], string $body = ''): void {}
        };
    }

    public function test_fetchConfig_parses_200_response_into_project_config(): void
    {
        $payload = [
            'projectId'      => 'proj1',
            'environmentKey' => 'development',
            'sdkKey'         => 'sk_dev_org1_proj1_abc',
            'version'        => 2,
            'flags'          => [],
        ];

        $httpClient = $this->makeStaticHttpClient([
            'status'  => 200,
            'body'    => json_encode($payload),
            'headers' => ['etag' => '"abc123"'],
        ]);

        $manager = new ConfigManager('sk_dev_org1_proj1_abc', $httpClient);
        $config  = $manager->fetchConfig();

        $this->assertSame('proj1', $config->projectId);
        $this->assertSame('development', $config->environmentKey);
        $this->assertSame(2, $config->version);
        $this->assertSame('"abc123"', $config->etag);
    }

    public function test_fetchConfig_reuses_cached_config_on_304(): void
    {
        $payload = [
            'projectId'      => 'proj1',
            'environmentKey' => 'development',
            'sdkKey'         => 'sk_dev_org1_proj1_abc',
            'version'        => 1,
            'flags'          => [],
        ];

        // Use stdClass so the anonymous class can mutate state without a reference parameter
        $spy        = new \stdClass();
        $spy->calls = 0;

        $httpClient = new class($payload, $spy) implements HttpClientInterface {
            public function __construct(
                private readonly array $payload,
                private readonly \stdClass $spy,
            ) {}

            public function get(string $url, array $headers = []): array
            {
                $this->spy->calls++;

                if ($this->spy->calls === 1) {
                    return ['status' => 200, 'body' => json_encode($this->payload), 'headers' => ['etag' => '"v1"']];
                }

                return ['status' => 304, 'body' => '', 'headers' => []];
            }

            public function post(string $url, array $headers = [], string $body = ''): void {}
        };

        $manager = new ConfigManager('sk_dev_org1_proj1_abc', $httpClient);
        $first   = $manager->fetchConfig();
        $second  = $manager->fetchConfig();

        $this->assertSame($first, $second);
        $this->assertSame(2, $spy->calls);
    }

    public function test_fetchConfig_throws_after_exhausting_retries(): void
    {
        $httpClient = $this->makeStaticHttpClient([
            'status'  => 503,
            'body'    => '',
            'headers' => [],
        ]);

        $manager = new ConfigManager('sk_dev_org1_proj1_abc', $httpClient);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/Failed to fetch config after/');

        // ConfigManager retries 3× with 1 s + 2 s back-off, so this test takes ~3 s.
        $manager->fetchConfig();
    }

    public function test_getConfig_throws_before_fetchConfig_is_called(): void
    {
        $httpClient = $this->makeStaticHttpClient(['status' => 200, 'body' => '{}', 'headers' => []]);
        $manager    = new ConfigManager('sk_dev_org1_proj1_abc', $httpClient);

        $this->expectException(RuntimeException::class);
        $manager->getConfig();
    }
}
