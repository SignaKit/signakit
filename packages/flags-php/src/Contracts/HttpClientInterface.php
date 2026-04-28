<?php

declare(strict_types=1);

namespace SignaKit\FlagsPhp\Contracts;

/**
 * Abstraction over HTTP transport layer.
 * Implement this interface to provide a custom HTTP client.
 */
interface HttpClientInterface
{
    /**
     * Perform a GET request and return an associative result array.
     *
     * @param  string               $url     Full URL to request
     * @param  array<string, string> $headers Request headers
     * @return array{status: int, body: string, headers: array<string, string>}
     */
    public function get(string $url, array $headers = []): array;

    /**
     * Perform a fire-and-forget POST request (exceptions are swallowed by the caller).
     *
     * @param  string               $url     Full URL to post to
     * @param  array<string, string> $headers Request headers
     * @param  string               $body    Raw request body
     */
    public function post(string $url, array $headers = [], string $body = ''): void;
}
