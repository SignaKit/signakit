<?php

declare(strict_types=1);

namespace SignaKit\FlagsPhp;

use RuntimeException;
use SignaKit\FlagsPhp\Contracts\HttpClientInterface;
use SignaKit\FlagsPhp\Http\CurlHttpClient;
use SignaKit\FlagsPhp\Http\GuzzleHttpClient;

/**
 * Entry point for the SignaKit Feature Flags PHP SDK.
 *
 * Usage:
 *
 * ```php
 * $client = new SignaKitClient('sk_prod_orgId_projectId_random');
 * $client->initialize();
 *
 * $ctx      = $client->createUserContext('user-123', ['plan' => 'premium']);
 * $decision = $ctx->decide('my-flag');
 * ```
 */
final class SignaKitClient
{
    private readonly HttpClientInterface $httpClient;
    private readonly ConfigManager $configManager;
    private bool $initialized = false;

    /**
     * @param string                  $sdkKey          SDK key (sk_{env}_{orgId}_{projectId}_{random})
     * @param HttpClientInterface|null $httpClient      Optional HTTP client override
     * @param int                     $refreshInterval Seconds between config re-fetches for long-running
     *                                                 processes (Swoole, RoadRunner, queue workers).
     *                                                 Set to 0 to disable. Default: 30 seconds.
     *                                                 In PHP-FPM this is a no-op — config is always
     *                                                 fetched fresh on each process start.
     */
    public function __construct(
        private readonly string $sdkKey,
        ?HttpClientInterface $httpClient = null,
        private readonly int $refreshInterval = 30,
    ) {
        $this->httpClient    = $httpClient ?? self::resolveDefaultHttpClient();
        $this->configManager = new ConfigManager($this->sdkKey, $this->httpClient);
    }

    /**
     * Fetch the project config from the CDN.
     * This method must be called before creating any user contexts.
     *
     * Blocks until config is fetched or throws after exhausting retries.
     *
     * @throws RuntimeException on unrecoverable HTTP or parse failure
     */
    public function initialize(): void
    {
        $this->configManager->fetchConfig();
        $this->initialized = true;
    }

    /**
     * Alias for initialize() — mirrors the "onReady" pattern common in SDK APIs.
     *
     * @throws RuntimeException on failure
     */
    public function onReady(): void
    {
        $this->initialize();
    }

    /**
     * Create a user evaluation context.
     *
     * For long-running processes (Swoole, RoadRunner, queue workers) this method
     * transparently re-fetches the config when it is older than $refreshInterval.
     * In PHP-FPM this check is always a no-op because each request starts a fresh
     * process with no cached config.
     *
     * @param array<string, mixed> $attributes  Key-value user attributes for audience matching
     * @throws RuntimeException when called before initialize()
     */
    public function createUserContext(
        string $userId,
        array $attributes = [],
    ): SignaKitUserContext {
        if (!$this->initialized) {
            throw new RuntimeException(
                'SignaKit client must be initialized before creating user contexts. Call initialize() first.'
            );
        }

        // Auto-refresh stale config in long-running processes — silent on error
        // so a temporary CDN blip never blocks flag evaluation.
        if ($this->configManager->isStale($this->refreshInterval)) {
            try {
                $this->configManager->fetchConfig();
            } catch (RuntimeException) {
                // Keep serving stale config rather than breaking the app
            }
        }

        return new SignaKitUserContext(
            userId:     $userId,
            attributes: $attributes,
            config:     $this->configManager->getConfig(),
            httpClient: $this->httpClient,
            sdkKey:     $this->sdkKey,
        );
    }

    /**
     * Refresh the cached config from the CDN.
     * Uses ETag-based conditional requests to avoid re-downloading unchanged configs.
     *
     * @throws RuntimeException on failure
     */
    public function refreshConfig(): void
    {
        $this->configManager->fetchConfig();
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Use GuzzleHttpClient when Guzzle is installed, otherwise fall back to cURL.
     */
    private static function resolveDefaultHttpClient(): HttpClientInterface
    {
        if (class_exists(\GuzzleHttp\Client::class)) {
            return new GuzzleHttpClient();
        }

        return new CurlHttpClient();
    }
}
