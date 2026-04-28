<?php

declare(strict_types=1);

namespace SignaKit\FlagsPhp\Http;

use RuntimeException;
use SignaKit\FlagsPhp\Contracts\HttpClientInterface;

/**
 * HTTP client backed by the cURL extension.
 * Used as the default fallback when Guzzle is not installed.
 */
final class CurlHttpClient implements HttpClientInterface
{
    private const CONNECT_TIMEOUT = 5;
    private const REQUEST_TIMEOUT = 10;

    /**
     * @param  array<string, string> $headers
     * @return array{status: int, body: string, headers: array<string, string>}
     */
    public function get(string $url, array $headers = []): array
    {
        $ch = curl_init();

        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => self::CONNECT_TIMEOUT,
            CURLOPT_TIMEOUT        => self::REQUEST_TIMEOUT,
            CURLOPT_HTTPHEADER     => $this->formatHeaders($headers),
            CURLOPT_HEADER         => true,
        ]);

        $response = curl_exec($ch);
        $errno    = curl_errno($ch);
        $error    = curl_error($ch);
        $status   = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);

        if ($errno !== 0 || $response === false) {
            throw new RuntimeException("cURL GET failed [{$errno}]: {$error}");
        }

        /** @var string $response */
        $rawHeaders = substr($response, 0, $headerSize);
        $body       = substr($response, $headerSize);

        return [
            'status'  => $status,
            'body'    => $body,
            'headers' => $this->parseResponseHeaders($rawHeaders),
        ];
    }

    /**
     * @param array<string, string> $headers
     */
    public function post(string $url, array $headers = [], string $body = ''): void
    {
        $ch = curl_init();

        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_CONNECTTIMEOUT => self::CONNECT_TIMEOUT,
            CURLOPT_TIMEOUT        => self::REQUEST_TIMEOUT,
            CURLOPT_HTTPHEADER     => $this->formatHeaders($headers),
        ]);

        curl_exec($ch);
        curl_close($ch);
    }

    /**
     * Convert associative headers array to cURL format.
     *
     * @param  array<string, string> $headers
     * @return list<string>
     */
    private function formatHeaders(array $headers): array
    {
        $formatted = [];
        foreach ($headers as $name => $value) {
            $formatted[] = "{$name}: {$value}";
        }
        return $formatted;
    }

    /**
     * Parse raw HTTP response headers into an associative array (lowercased keys).
     *
     * @return array<string, string>
     */
    private function parseResponseHeaders(string $rawHeaders): array
    {
        $parsed = [];
        $lines  = explode("\r\n", $rawHeaders);

        foreach ($lines as $line) {
            if (!str_contains($line, ':')) {
                continue;
            }
            [$name, $value]          = explode(':', $line, 2);
            $parsed[strtolower(trim($name))] = trim($value);
        }

        return $parsed;
    }
}
