<?php

declare(strict_types=1);

namespace SignaKit\FlagsPhp\Tests;

use PHPUnit\Framework\TestCase;
use RuntimeException;
use SignaKit\FlagsPhp\ConfigManager;
use SignaKit\FlagsPhp\Contracts\HttpClientInterface;

/**
 * @covers \SignaKit\FlagsPhp\ConfigManager
 */
final class ConfigManagerTest extends TestCase
{
    // -------------------------------------------------------------------------
    // parseSdkKey — happy path
    // -------------------------------------------------------------------------

    public function testParseSdkKeyProdSuccess(): void
    {
        $result = ConfigManager::parseSdkKey('sk_prod_abc123_456_xxxxxxxxxxxx');

        $this->assertSame('prod',         $result['env']);
        $this->assertSame('abc123',       $result['orgId']);
        $this->assertSame('456',          $result['projectId']);
        $this->assertSame('xxxxxxxxxxxx', $result['random']);
    }

    public function testParseSdkKeyDevSuccess(): void
    {
        $result = ConfigManager::parseSdkKey('sk_dev_myOrg_789_aabbccddeeff');

        $this->assertSame('dev',          $result['env']);
        $this->assertSame('myOrg',        $result['orgId']);
        $this->assertSame('789',          $result['projectId']);
        $this->assertSame('aabbccddeeff', $result['random']);
    }

    // -------------------------------------------------------------------------
    // parseSdkKey — error cases
    // -------------------------------------------------------------------------

    public function testParseSdkKeyThrowsOnTooFewParts(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/Invalid SDK key format/');

        ConfigManager::parseSdkKey('sk_prod_abc123_456');
    }

    public function testParseSdkKeyThrowsOnWrongPrefix(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches("/must start with 'sk_'/");

        ConfigManager::parseSdkKey('bad_prod_abc123_456_xxxx');
    }

    public function testParseSdkKeyThrowsOnInvalidEnv(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches("/env must be 'prod' or 'dev'/");

        ConfigManager::parseSdkKey('sk_staging_abc123_456_xxxx');
    }

    public function testParseSdkKeyThrowsOnEmptySegment(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/empty segments/');

        ConfigManager::parseSdkKey('sk_prod__456_xxxx');
    }

    // -------------------------------------------------------------------------
    // fetchConfig — successful 200 response
    // -------------------------------------------------------------------------

    public function testFetchConfigSuccess(): void
    {
        $configData = [
            'projectId'      => '456',
            'environmentKey' => 'production',
            'sdkKey'         => 'sk_prod_abc123_456_xxxx',
            'version'        => 1,
            'flags'          => [],
        ];

        $httpClient = $this->createMock(HttpClientInterface::class);
        $httpClient
            ->expects($this->once())
            ->method('get')
            ->willReturn([
                'status'  => 200,
                'body'    => json_encode($configData, JSON_THROW_ON_ERROR),
                'headers' => ['etag' => '"abc"'],
            ]);

        $manager = new ConfigManager('sk_prod_abc123_456_xxxx', $httpClient);
        $config  = $manager->fetchConfig();

        $this->assertSame('456',        $config->projectId);
        $this->assertSame('production', $config->environmentKey);
        $this->assertSame('"abc"',      $config->etag);
    }

    // -------------------------------------------------------------------------
    // fetchConfig — ETag / 304 Not Modified
    // -------------------------------------------------------------------------

    public function testFetchConfigUsesCachedConfigOn304(): void
    {
        $configData = [
            'projectId'      => '456',
            'environmentKey' => 'production',
            'sdkKey'         => 'sk_prod_abc123_456_xxxx',
            'version'        => 1,
            'flags'          => [],
        ];

        $httpClient = $this->createMock(HttpClientInterface::class);
        $httpClient
            ->expects($this->exactly(2))
            ->method('get')
            ->willReturnOnConsecutiveCalls(
                // First call → 200 with ETag
                [
                    'status'  => 200,
                    'body'    => json_encode($configData, JSON_THROW_ON_ERROR),
                    'headers' => ['etag' => '"v1"'],
                ],
                // Second call → 304 Not Modified
                [
                    'status'  => 304,
                    'body'    => '',
                    'headers' => [],
                ],
            );

        $manager = new ConfigManager('sk_prod_abc123_456_xxxx', $httpClient);

        $first  = $manager->fetchConfig();
        $second = $manager->fetchConfig();

        $this->assertSame($first->projectId, $second->projectId);
        $this->assertSame('"v1"', $second->etag);
    }

    // -------------------------------------------------------------------------
    // fetchConfig — retry logic
    // -------------------------------------------------------------------------

    public function testFetchConfigRetriesOnFailureAndSucceeds(): void
    {
        $configData = [
            'projectId'      => '456',
            'environmentKey' => 'production',
            'sdkKey'         => 'sk_prod_abc123_456_xxxx',
            'version'        => 1,
            'flags'          => [],
        ];

        $httpClient = $this->createMock(HttpClientInterface::class);
        $httpClient
            ->expects($this->exactly(2))
            ->method('get')
            ->willReturnOnConsecutiveCalls(
                ['status' => 500, 'body' => '', 'headers' => []],
                ['status' => 200, 'body' => json_encode($configData, JSON_THROW_ON_ERROR), 'headers' => []],
            );

        // Override sleep to avoid real delays
        $manager = new class ('sk_prod_abc123_456_xxxx', $httpClient) extends ConfigManager {
        };

        $config = $manager->fetchConfig();
        $this->assertSame('456', $config->projectId);
    }

    public function testFetchConfigThrowsAfterExhaustingRetries(): void
    {
        $httpClient = $this->createMock(HttpClientInterface::class);
        $httpClient
            ->method('get')
            ->willReturn(['status' => 503, 'body' => '', 'headers' => []]);

        $manager = new ConfigManager('sk_prod_abc123_456_xxxx', $httpClient);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/Failed to fetch config after/');

        $manager->fetchConfig();
    }

    // -------------------------------------------------------------------------
    // getConfig — throws before initialization
    // -------------------------------------------------------------------------

    public function testGetConfigThrowsBeforeInitialization(): void
    {
        $httpClient = $this->createMock(HttpClientInterface::class);
        $manager    = new ConfigManager('sk_prod_abc123_456_xxxx', $httpClient);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/not been initialized/');

        $manager->getConfig();
    }

    // -------------------------------------------------------------------------
    // URL construction helpers
    // -------------------------------------------------------------------------

    public function testGetEnvReturnsProd(): void
    {
        $httpClient = $this->createMock(HttpClientInterface::class);
        $manager    = new ConfigManager('sk_prod_abc123_456_xxxx', $httpClient);

        $this->assertSame('prod', $manager->getEnv());
    }

    public function testGetEnvReturnsDev(): void
    {
        $httpClient = $this->createMock(HttpClientInterface::class);
        $manager    = new ConfigManager('sk_dev_abc123_456_xxxx', $httpClient);

        $this->assertSame('dev', $manager->getEnv());
    }

    public function testGetOrgIdAndProjectId(): void
    {
        $httpClient = $this->createMock(HttpClientInterface::class);
        $manager    = new ConfigManager('sk_prod_myOrg_789_xxxx', $httpClient);

        $this->assertSame('myOrg', $manager->getOrgId());
        $this->assertSame('789',   $manager->getProjectId());
    }
}
