<?php

declare(strict_types=1);

namespace SignaKit\FlagsPhp;

use SignaKit\FlagsPhp\Contracts\HttpClientInterface;
use SignaKit\FlagsPhp\Types\Decision;
use SignaKit\FlagsPhp\Types\ProjectConfig;

/**
 * Represents a user within a SignaKit evaluation session.
 *
 * Provides flag evaluation and event tracking scoped to a single user.
 */
final class SignaKitUserContext
{
    private const EVENTS_URL = 'https://60amq9ozsf.execute-api.us-east-2.amazonaws.com/v1/flag-events';

    public function __construct(
        private readonly string $userId,
        /** @var array<string, mixed> */
        private readonly array $attributes,
        private readonly ProjectConfig $config,
        private readonly HttpClientInterface $httpClient,
        private readonly string $sdkKey,
    ) {}

    /**
     * Evaluate a single feature flag for this user.
     *
     * @throws \RuntimeException if the client is not initialized
     */
    public function decide(string $flagKey): ?Decision
    {
        $flag = $this->findFlag($flagKey);

        if ($flag === null) {
            return null;
        }

        return Evaluator::evaluateFlag($flag, $this->userId, $this->attributes);
    }

    /**
     * Evaluate all non-archived feature flags for this user.
     *
     * @return array<string, Decision> Map of flagKey → Decision
     */
    public function decideAll(): array
    {
        return Evaluator::evaluateAllFlags($this->config, $this->userId, $this->attributes);
    }

    /**
     * Track a conversion or custom event for this user.
     * Events are sent fire-and-forget; any HTTP errors are logged with error_log().
     */
    public function trackEvent(string $eventKey, ?float $value = null): void
    {
        $event = [
            'type'      => 'conversion',
            'eventKey'  => $eventKey,
            'userId'    => $this->userId,
            'timestamp' => (int) (microtime(as_float: true) * 1000),
        ];

        if ($value !== null) {
            $event['value'] = $value;
        }

        $body    = json_encode(['events' => [$event]], JSON_THROW_ON_ERROR);
        $headers = [
            'Content-Type' => 'application/json',
            'X-SDK-Key'    => $this->sdkKey,
        ];

        try {
            $this->httpClient->post(self::EVENTS_URL, $headers, $body);
        } catch (\Throwable $e) {
            error_log("[SignaKit] Failed to send event '{$eventKey}': " . $e->getMessage());
        }
    }

    /**
     * Send an $exposure event (internal SDK use) after a flag is evaluated.
     * Fire-and-forget — exceptions are silently logged.
     *
     * Pass `$ruleType` (e.g. from `Decision::$ruleType`) so this method can
     * skip exposures for `'targeted'` rules — those are simple feature-flag
     * rollouts with no experiment to attribute.
     */
    public function sendExposure(
        string $flagKey,
        string $variationKey,
        ?string $ruleKey,
        ?string $ruleType = null,
    ): void {
        if ($ruleType === 'targeted') {
            return;
        }

        $event = [
            'type'         => '$exposure',
            'flagKey'      => $flagKey,
            'variationKey' => $variationKey,
            'ruleKey'      => $ruleKey,
            'userId'       => $this->userId,
            'timestamp'    => (int) (microtime(as_float: true) * 1000),
        ];

        $body    = json_encode(['events' => [$event]], JSON_THROW_ON_ERROR);
        $headers = [
            'Content-Type' => 'application/json',
            'X-SDK-Key'    => $this->sdkKey,
        ];

        try {
            $this->httpClient->post(self::EVENTS_URL, $headers, $body);
        } catch (\Throwable $e) {
            error_log("[SignaKit] Failed to send exposure for '{$flagKey}': " . $e->getMessage());
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * @return array<string, mixed>|null
     */
    private function findFlag(string $flagKey): ?array
    {
        foreach ($this->config->flags as $flag) {
            if ((string) ($flag['key'] ?? '') === $flagKey) {
                return $flag;
            }
        }

        return null;
    }
}
