# SignaKit Feature Flags — Laravel

Laravel service provider, facade, and manager for [SignaKit Feature Flags](https://signakit.io). Wraps `signakit/flags-php` to give you idiomatic Laravel auto-discovery, config publishing, container binding, and a clean facade.

---

## Requirements

- PHP 8.1+
- Laravel 10, 11, or 12

---

## Installation

```bash
composer require signakit/flags-laravel
```

Add your SDK key to `.env`:

```dotenv
SIGNAKIT_SDK_KEY=sk_prod_yourOrgId_yourProjectId_random
```

Laravel's package auto-discovery registers the service provider and facade automatically — no manual changes to `config/app.php` are needed.

---

## Configuration

The package ships with sensible defaults. If you need to customise the config file, publish it first:

```bash
php artisan vendor:publish --tag=signakit-config
```

This creates `config/signakit.php`:

```php
return [
    'sdk_key' => env('SIGNAKIT_SDK_KEY'),
];
```

---

## Quick Start

### 1. Facade in a controller

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\View\View;
use SignaKit\FlagsLaravel\Facades\SignaKit;

class CheckoutController extends Controller
{
    public function show(Request $request): View
    {
        $userContext = SignaKit::createUserContext(
            $request->user()->id,
            ['plan' => $request->user()->plan]
        );

        $decision = $userContext->decide('new-checkout');

        return view('checkout', [
            'useNewCheckout' => $decision->enabled,
        ]);
    }
}
```

### 2. Dependency injection

Type-hint `SignaKitClient` directly — the container resolves the singleton automatically:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\View\View;
use SignaKit\FlagsPhp\SignaKitClient;

class CheckoutController extends Controller
{
    public function __construct(
        private readonly SignaKitClient $signaKit,
    ) {}

    public function show(Request $request): View
    {
        $userContext = $this->signaKit->createUserContext(
            $request->user()->id,
            ['plan' => $request->user()->plan]
        );

        $decision = $userContext->decide('new-checkout');

        return view('checkout', [
            'useNewCheckout' => $decision->enabled,
        ]);
    }
}
```

Or inject `SignaKitManager` for the convenience `forUser()` shortcut:

```php
use SignaKit\FlagsLaravel\SignaKitManager;

class CheckoutController extends Controller
{
    public function __construct(
        private readonly SignaKitManager $flags,
    ) {}

    public function show(Request $request): View
    {
        $userContext = $this->flags->forUser(
            $request->user()->id,
            ['plan' => $request->user()->plan]
        );

        $decision = $userContext->decide('new-checkout');

        return view('checkout', ['useNewCheckout' => $decision->enabled]);
    }
}
```

### 3. Middleware pattern

Evaluate flags once per request and share results with all views — useful when multiple controllers or Blade partials need the same flag values:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\View;
use SignaKit\FlagsLaravel\Facades\SignaKit;
use Symfony\Component\HttpFoundation\Response;

class ShareFeatureFlags
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($user = $request->user()) {
            $userContext = SignaKit::createUserContext(
                $user->id,
                ['plan' => $user->plan, 'role' => $user->role]
            );

            $decisions = $userContext->decideAll();

            // Share all flag decisions with every view for this request
            View::share('flags', $decisions);
        }

        return $next($request);
    }
}
```

Register the middleware in `bootstrap/app.php` (Laravel 11+):

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->web(append: [
        \App\Http\Middleware\ShareFeatureFlags::class,
    ]);
})
```

---

## Blade Templates

Use the facade directly in Blade for simple one-off checks:

```blade
@php
    $userContext = \SignaKit\FlagsLaravel\Facades\SignaKit::createUserContext(
        auth()->id(),
        ['plan' => auth()->user()->plan]
    );
    $decision = $userContext->decide('new-checkout');
@endphp

@if ($decision->enabled)
    <x-new-checkout />
@else
    <x-legacy-checkout />
@endif
```

Or, if you are using the middleware pattern above, access the pre-resolved decisions via the shared `$flags` variable:

```blade
@if (isset($flags['new-checkout']) && $flags['new-checkout']->enabled)
    <x-new-checkout />
@else
    <x-legacy-checkout />
@endif
```

---

## API Reference

### `SignaKitClient`

Resolved from the container as a singleton. All methods are available via the `SignaKit` facade.

| Method | Description |
|--------|-------------|
| `createUserContext(string $userId, array $attributes = []): SignaKitUserContext` | Create a user context for flag evaluation and event tracking |

### `SignaKitUserContext`

Returned by `createUserContext()`.

| Method | Description |
|--------|-------------|
| `decide(string $flagKey): Decision` | Evaluate a single flag for this user |
| `decideAll(): array<string, Decision>` | Evaluate all flags for this user |
| `trackEvent(string $eventKey, array $properties = []): void` | Track a conversion or custom event |

### `Decision`

A readonly value object returned by `decide()`.

| Property | Type | Description |
|----------|------|-------------|
| `$flagKey` | `string` | The flag key that was evaluated |
| `$variationKey` | `string` | Assigned variation key, or `'off'` if the flag is stopped |
| `$enabled` | `bool` | `true` when the flag is running and the user is in an active variation |
| `$ruleKey` | `?string` | The targeting rule that matched, or `null` for default allocation |

### `SignaKitManager`

An optional helper bound in the container. Provides a `forUser()` shortcut:

| Method | Description |
|--------|-------------|
| `forUser(string $userId, array $attributes = []): SignaKitUserContext` | Resolves the client and creates a user context in one call |

---

## License

MIT
