<?php

declare(strict_types=1);

namespace SignaKit\FlagsPhp\Http;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use RuntimeException;
use SignaKit\FlagsPhp\Contracts\HttpClientInterface;

/**
 * HTTP client backed by Guzzle.
 * Preferred implementation when guzzlehttp/guzzle is installed.
 */
final class GuzzleHttpClient implements HttpClientInterface
{
    private readonly Client $client;

    public function __construct(?Client $client = null)
    {
        $this->client = $client ?? new Client([
            'connect_timeout' => 5,
            'timeout'         => 10,
        ]);
    }

    /**
     * @param  array<string, string> $headers
     * @return array{status: int, body: string, headers: array<string, string>}
     */
    public function get(string $url, array $headers = []): array
    {
        try {
            $response = $this->client->get($url, ['headers' => $headers]);

            /** @var array<string, list<string>> $rawHeaders */
            $rawHeaders = $response->getHeaders();
            $flat       = [];
            foreach ($rawHeaders as $name => $values) {
                $flat[strtolower($name)] = implode(', ', $values);
            }

            return [
                'status'  => $response->getStatusCode(),
                'body'    => (string) $response->getBody(),
                'headers' => $flat,
            ];
        } catch (GuzzleException $e) {
            throw new RuntimeException("Guzzle GET failed: {$e->getMessage()}", 0, $e);
        }
    }

    /**
     * @param array<string, string> $headers
     */
    public function post(string $url, array $headers = [], string $body = ''): void
    {
        try {
            $this->client->post($url, [
                'headers' => $headers,
                'body'    => $body,
            ]);
        } catch (GuzzleException) {
            // fire-and-forget — caller handles exception swallowing
        }
    }
}
