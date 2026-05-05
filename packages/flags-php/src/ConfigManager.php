<?php

declare(strict_types=1);

namespace SignaKit\FlagsPhp;

use RuntimeException;
use SignaKit\FlagsPhp\Contracts\HttpClientInterface;
use SignaKit\FlagsPhp\Types\ProjectConfig;

/**
 * Manages fetching and in-memory caching of the project config JSON from CloudFront.
 *
 * Retries up to 3 times with exponential back-off (1 s / 2 s / 4 s).
 * Stores the ETag from the last response and sends `If-None-Match` on subsequent
 * fetches; a 304 Not Modified response reuses the cached config.
 */
final class ConfigManager
{
    private const CONFIG_BASE_URL = 'https://d30l2rkped5b4m.cloudfront.net/configs';
    private const MAX_RETRIES     = 3;

    /** @var array{env: string, orgId: string, projectId: string, random: string} */
    private readonly array $parsedKey;

    private ?ProjectConfig $cachedConfig = null;

    /** Unix timestamp (float) of the last successful fetch, or 0.0 if never fetched. */
    private float $lastFetchedAt = 0.0;

    public function __construct(
        private readonly string $sdkKey,
        private readonly HttpClientInterface $httpClient,
    ) {
        $this->parsedKey = self::parseSdkKey($sdkKey);
    }

    /**
     * Fetch (or refresh) the project config from the CDN.
     * Blocks until a valid response is received or all retries are exhausted.
     *
     * @throws RuntimeException when the config cannot be fetched after all retries
     */
    public function fetchConfig(): ProjectConfig
    {
        $url = $this->buildConfigUrl();

        $headers = ['Accept' => 'application/json'];

        // ETag-based conditional request
        if ($this->cachedConfig?->etag !== null) {
            $headers['If-None-Match'] = $this->cachedConfig->etag;
        }

        $lastException = null;
        $delay         = 1;

        for ($attempt = 1; $attempt <= self::MAX_RETRIES; $attempt++) {
            try {
                $response = $this->httpClient->get($url, $headers);
                $status   = (int) $response['status'];

                // 304 Not Modified — cached config is still current
                if ($status === 304 && $this->cachedConfig !== null) {
                    $this->lastFetchedAt = microtime(as_float: true);
                    return $this->cachedConfig;
                }

                if ($status !== 200) {
                    throw new RuntimeException("Config fetch returned HTTP {$status}");
                }

                /** @var array<string, string> $responseHeaders */
                $responseHeaders = $response['headers'];
                $etag            = $responseHeaders['etag'] ?? null;

                /** @var array<string, mixed>|null $data */
                $data = json_decode($response['body'], associative: true);

                if (!is_array($data)) {
                    throw new RuntimeException('Config response is not valid JSON');
                }

                $this->cachedConfig  = ProjectConfig::fromArray($data, $etag);
                $this->lastFetchedAt = microtime(as_float: true);

                return $this->cachedConfig;
            } catch (RuntimeException $e) {
                $lastException = $e;

                if ($attempt < self::MAX_RETRIES) {
                    sleep($delay);
                    $delay *= 2;
                }
            }
        }

        throw new RuntimeException(
            "Failed to fetch config after " . self::MAX_RETRIES . " attempts: " . ($lastException?->getMessage() ?? 'unknown error'),
            0,
            $lastException,
        );
    }

    /**
     * Return true when the cached config is older than $maxAgeSeconds.
     * Always returns false when $maxAgeSeconds is 0 (polling disabled).
     */
    public function isStale(int $maxAgeSeconds): bool
    {
        if ($maxAgeSeconds <= 0 || $this->lastFetchedAt === 0.0) {
            return false;
        }

        return (microtime(as_float: true) - $this->lastFetchedAt) >= $maxAgeSeconds;
    }

    /**
     * Return the currently cached config without making a network request.
     *
     * @throws RuntimeException when initialize() has not been called yet
     */
    public function getConfig(): ProjectConfig
    {
        if ($this->cachedConfig === null) {
            throw new RuntimeException('SignaKit client has not been initialized. Call initialize() first.');
        }

        return $this->cachedConfig;
    }

    /**
     * Parse an SDK key into its constituent parts.
     *
     * Format: sk_{env}_{orgId}_{projectId}_{random}
     *
     * @return array{env: string, orgId: string, projectId: string, random: string}
     * @throws RuntimeException on malformed key
     */
    public static function parseSdkKey(string $sdkKey): array
    {
        $parts = explode('_', $sdkKey);

        if (count($parts) < 5) {
            throw new RuntimeException(
                "Invalid SDK key format. Expected: sk_{env}_{orgId}_{projectId}_{random}"
            );
        }

        if ($parts[0] !== 'sk') {
            throw new RuntimeException("SDK key must start with 'sk_'");
        }

        $env       = $parts[1];
        $orgId     = $parts[2];
        $projectId = $parts[3];
        $random    = $parts[4];

        if (!in_array($env, ['prod', 'dev'], strict: true)) {
            throw new RuntimeException("SDK key env must be 'prod' or 'dev', got: '{$env}'");
        }

        if ($orgId === '' || $projectId === '' || $random === '') {
            throw new RuntimeException('SDK key contains empty segments');
        }

        return compact('env', 'orgId', 'projectId', 'random');
    }

    /** Return the parsed env segment ('prod' or 'dev'). */
    public function getEnv(): string
    {
        return $this->parsedKey['env'];
    }

    /** Return the parsed orgId segment. */
    public function getOrgId(): string
    {
        return $this->parsedKey['orgId'];
    }

    /** Return the parsed projectId segment. */
    public function getProjectId(): string
    {
        return $this->parsedKey['projectId'];
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private function buildConfigUrl(): string
    {
        $env       = $this->parsedKey['env'];
        $orgId     = $this->parsedKey['orgId'];
        $projectId = $this->parsedKey['projectId'];

        $environment = $env === 'prod' ? 'production' : 'development';

        return self::CONFIG_BASE_URL . "/{$orgId}/{$projectId}/{$environment}/latest.json";
    }
}
