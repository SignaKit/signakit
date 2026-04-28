# signakit/flags-php

Official PHP 8.1+ SDK for [SignaKit Feature Flags](https://signakit.io).

- Framework-agnostic — works with Laravel, Symfony, WordPress, or plain PHP
- Evaluates flags **locally** (no network call per evaluation)
- MurmurHash3 bucketing for deterministic, consistent assignments
- ETag-based config caching to minimize CDN traffic
- Fire-and-forget event tracking

## Installation

```bash
composer require signakit/flags-php
```

Guzzle is recommended but optional — the SDK falls back to cURL automatically:

```bash
composer require guzzlehttp/guzzle
```

## Quick Start

### Plain PHP

```php
<?php

require 'vendor/autoload.php';

use SignaKit\FlagsPhp\SignaKitClient;

$client = new SignaKitClient('sk_prod_abc123_1234_xxxxxxxxxxxx');
$client->initialize(); // fetches config from CDN, throws on failure

$ctx      = $client->createUserContext('user-123', ['plan' => 'premium', 'country' => 'US']);
$decision = $ctx->decide('new-checkout');

if ($decision?->enabled && $decision->variationKey === 'treatment') {
    // show new checkout
} else {
    // show control
}

// Track a conversion
$ctx->trackEvent('purchase', value: 99.99);
```

### Laravel

```php
// AppServiceProvider::register()
$this->app->singleton(SignaKitClient::class, function () {
    $client = new SignaKitClient(config('services.signakit.sdk_key'));
    $client->initialize();
    return $client;
});

// In a controller / middleware
public function show(Request $request, SignaKitClient $flags): Response
{
    $ctx      = $flags->createUserContext($request->user()->id, [
        'plan'    => $request->user()->plan,
        'country' => $request->header('CF-IPCountry', 'US'),
    ]);
    $decision = $ctx->decide('new-checkout');

    return view('checkout', ['variant' => $decision?->variationKey ?? 'control']);
}
```

### WordPress

```php
// functions.php or a plugin bootstrap file
add_action('init', function () {
    $client = new \SignaKit\FlagsPhp\SignaKitClient(defined('SIGNAKIT_SDK_KEY') ? SIGNAKIT_SDK_KEY : '');
    $client->initialize();
    $GLOBALS['signakit'] = $client;
});

// In a template
$ctx      = $GLOBALS['signakit']->createUserContext(get_current_user_id(), ['plan' => 'free']);
$decision = $ctx->decide('new-header');

if ($decision?->variationKey === 'treatment') {
    get_template_part('partials/header-new');
} else {
    get_template_part('partials/header');
}
```

## API Reference

### `SignaKitClient`

```php
new SignaKitClient(string $sdkKey, ?HttpClientInterface $httpClient = null)
```

| Method | Description |
|--------|-------------|
| `initialize(): void` | Fetch config from CDN. Retries 3× with exponential back-off. Throws on failure. |
| `onReady(): void` | Alias for `initialize()`. |
| `createUserContext(string $userId, array $attributes = []): SignaKitUserContext` | Create an evaluation context for a user. |
| `refreshConfig(): void` | Re-fetch config (ETag-aware). Call periodically to pick up flag changes. |

### `SignaKitUserContext`

```php
$ctx = $client->createUserContext('user-123', ['plan' => 'premium']);
```

| Method | Description |
|--------|-------------|
| `decide(string $flagKey): ?Decision` | Evaluate a single flag. Returns `null` if the flag does not exist or is archived. |
| `decideAll(): array<string, Decision>` | Evaluate every active flag. Returns a map of `flagKey → Decision`. |
| `trackEvent(string $eventKey, ?float $value = null): void` | Fire a conversion event. |

### `Decision`

```php
readonly class Decision {
    public string  $flagKey;
    public string  $variationKey; // 'off' when flag is stopped
    public bool    $enabled;      // false only when flag is stopped
    public ?string $ruleKey;      // null when default allocation was used
}
```

### Custom HTTP Client

Implement `HttpClientInterface` to plug in your own transport:

```php
use SignaKit\FlagsPhp\Contracts\HttpClientInterface;

final class MyHttpClient implements HttpClientInterface
{
    public function get(string $url, array $headers = []): array { /* ... */ }
    public function post(string $url, array $headers = [], string $body = ''): void { /* ... */ }
}

$client = new SignaKitClient('sk_prod_...', httpClient: new MyHttpClient());
```

## How It Works

1. **Config delivery** — On `initialize()` the SDK fetches a JSON config from CloudFront (`d30l2rkped5b4m.cloudfront.net`). The config contains all flag definitions, rules, and allocation ranges. Subsequent calls send an `If-None-Match` ETag header so unchanged configs are never re-downloaded.

2. **Local evaluation** — All `decide()` calls run entirely in memory, with no network round-trip. The two-stage MurmurHash3 bucketing algorithm guarantees deterministic, consistent assignments: the same user always gets the same variation for a given flag configuration.

3. **Event tracking** — `trackEvent()` and internal `$exposure` events are POSTed to an API Gateway endpoint asynchronously. Failures are logged with `error_log()` and never throw.

## SDK Key Format

```
sk_{env}_{orgId}_{projectId}_{random}
```

- `env` — `prod` (production) or `dev` (development)
- `orgId` — alphanumeric organisation ID
- `projectId` — numeric project ID
- `random` — 12-character hex suffix

## Requirements

- PHP 8.1+
- `ext-curl` (for the built-in cURL client) or `guzzlehttp/guzzle ^7.0`

## License

MIT
