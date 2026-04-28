<?php

declare(strict_types=1);

namespace SignaKit\FlagsLaravel\Facades;

use Illuminate\Support\Facades\Facade;
use SignaKit\FlagsPhp\SignaKitClient;
use SignaKit\FlagsPhp\SignaKitUserContext;

/**
 * @method static SignaKitUserContext createUserContext(string $userId, array $attributes = [])
 *
 * @see SignaKitClient
 */
final class SignaKit extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return 'signakit';
    }
}
