<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | SignaKit SDK Key
    |--------------------------------------------------------------------------
    |
    | Your SignaKit SDK key, found in the SignaKit dashboard. Set this via the
    | SIGNAKIT_SDK_KEY environment variable in your .env file.
    |
    | Example: sk_prod_abc123_42_xyzrandom
    |
    */
    'sdk_key' => env('SIGNAKIT_SDK_KEY'),

    /*
    |--------------------------------------------------------------------------
    | Config Refresh Interval
    |--------------------------------------------------------------------------
    |
    | Seconds between flag config re-fetches in long-running processes such as
    | Laravel Octane, Swoole, or RoadRunner. Uses ETags so a no-op poll is a
    | cheap conditional GET. Set to 0 to disable. Has no effect in PHP-FPM
    | because each request starts a fresh process with no cached config.
    |
    */
    'refresh_interval' => env('SIGNAKIT_REFRESH_INTERVAL', 30),
];
