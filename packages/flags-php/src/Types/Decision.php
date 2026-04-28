<?php

declare(strict_types=1);

namespace SignaKit\FlagsPhp\Types;

/**
 * Represents the result of a flag evaluation for a specific user.
 */
final readonly class Decision
{
    public function __construct(
        /** The flag key that was evaluated */
        public string $flagKey,
        /** The variation key assigned to the user, or 'off' if the flag is not running */
        public string $variationKey,
        /** Whether the flag is considered enabled (false only when flag is stopped) */
        public bool $enabled,
        /** The rule key that matched, or null if default allocation was used */
        public ?string $ruleKey,
        /**
         * The rule type that produced this decision: 'ab-test', 'multi-armed-bandit',
         * or 'targeted'. Null when the default allocation matched or the flag was
         * disabled. Targeted rules are simple feature-flag rollouts and should
         * not fire $exposure events.
         */
        public ?string $ruleType = null,
    ) {}
}
