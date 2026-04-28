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
];
