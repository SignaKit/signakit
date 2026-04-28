<?php

declare(strict_types=1);

namespace SignaKit\FlagsLaravel;

use SignaKit\FlagsPhp\SignaKitClient;
use SignaKit\FlagsPhp\SignaKitUserContext;

/**
 * Convenience wrapper that resolves the SignaKit client and provides
 * a fluent per-user context factory suitable for dependency injection.
 */
final class SignaKitManager
{
    public function __construct(
        private readonly SignaKitClient $client,
    ) {}

    /**
     * Create a user context for flag evaluation and event tracking.
     *
     * @param  string               $userId     Stable user identifier (e.g. database primary key or UUID)
     * @param  array<string, mixed> $attributes Targeting attributes (plan, role, country, etc.)
     */
    public function forUser(string $userId, array $attributes = []): SignaKitUserContext
    {
        return $this->client->createUserContext($userId, $attributes);
    }
}
