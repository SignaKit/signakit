<?php

declare(strict_types=1);

namespace SignaKit\FlagsLaravel\Tests;

use PHPUnit\Framework\TestCase;
use SignaKit\FlagsLaravel\Facades\SignaKit;

final class SignaKitFacadeTest extends TestCase
{
    public function test_facade_accessor_returns_signakit_binding_key(): void
    {
        $method = new \ReflectionMethod(SignaKit::class, 'getFacadeAccessor');
        $method->setAccessible(true);

        $this->assertSame('signakit', $method->invoke(null));
    }
}
