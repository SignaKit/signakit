<?php

declare(strict_types=1);

namespace SignaKit\FlagsPhp\Types;

/**
 * Represents a parsed project configuration fetched from the CDN.
 */
final readonly class ProjectConfig
{
    /**
     * @param array<int, array<string, mixed>> $flags Raw flag data from the config JSON
     */
    public function __construct(
        public string $projectId,
        public string $environmentKey,
        public string $sdkKey,
        public int $version,
        public array $flags,
        public ?string $etag = null,
    ) {}

    /**
     * @param array<string, mixed> $data Decoded JSON config array
     */
    public static function fromArray(array $data, ?string $etag = null): self
    {
        return new self(
            projectId: (string) ($data['projectId'] ?? ''),
            environmentKey: (string) ($data['environmentKey'] ?? ''),
            sdkKey: (string) ($data['sdkKey'] ?? ''),
            version: (int) ($data['version'] ?? 1),
            flags: (array) ($data['flags'] ?? []),
            etag: $etag,
        );
    }
}
