<?php

declare(strict_types=1);

namespace SignaKit\FlagsLaravel;

use Illuminate\Support\ServiceProvider;
use SignaKit\FlagsPhp\SignaKitClient;

final class SignaKitServiceProvider extends ServiceProvider
{
    /**
     * Register package services into the container.
     */
    public function register(): void
    {
        $this->mergeConfigFrom(
            __DIR__ . '/../config/signakit.php',
            'signakit'
        );

        $this->app->singleton(SignaKitClient::class, function (): SignaKitClient {
            $sdkKey = config('signakit.sdk_key');

            if (empty($sdkKey)) {
                throw new \RuntimeException(
                    'SignaKit SDK key is not configured. ' .
                    'Set SIGNAKIT_SDK_KEY in your .env file and ensure the value is a valid SDK key ' .
                    '(e.g. sk_prod_orgId_projectId_random). ' .
                    'You can find your SDK key in the SignaKit dashboard under Project Settings.'
                );
            }

            $client = new SignaKitClient($sdkKey);
            $client->initialize();

            return $client;
        });

        // Alias so the Facade and string-based resolution both work
        $this->app->alias(SignaKitClient::class, 'signakit');

        $this->app->bind(SignaKitManager::class, function (): SignaKitManager {
            return new SignaKitManager($this->app->make(SignaKitClient::class));
        });
    }

    /**
     * Bootstrap package services.
     */
    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__ . '/../config/signakit.php' => config_path('signakit.php'),
            ], 'signakit-config');
        }
    }
}
