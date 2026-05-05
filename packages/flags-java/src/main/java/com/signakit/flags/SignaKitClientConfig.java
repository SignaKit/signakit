package com.signakit.flags;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Objects;

/**
 * Configuration for the {@link SignaKitClient}. Required: {@code sdkKey} of
 * format {@code sk_{env}_{orgId}_{projectId}_{random}}.
 */
public final class SignaKitClientConfig {
    private final String sdkKey;
    private final HttpClient httpClient;
    private final Duration pollingInterval;

    private SignaKitClientConfig(Builder b) {
        this.sdkKey = Objects.requireNonNull(b.sdkKey, "sdkKey is required");
        this.httpClient = b.httpClient;
        this.pollingInterval = b.pollingInterval;
    }

    public String sdkKey() {
        return sdkKey;
    }

    /** Optional override (chiefly for tests). */
    public HttpClient httpClient() {
        return httpClient;
    }

    /**
     * How often to re-fetch the flag config from the CDN.
     * Uses ETags so a no-op poll is a lightweight conditional GET.
     * Set to {@link Duration#ZERO} to disable polling.
     * Default: 30 seconds.
     */
    public Duration pollingInterval() {
        return pollingInterval;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static SignaKitClientConfig of(String sdkKey) {
        return builder().sdkKey(sdkKey).build();
    }

    public static final class Builder {
        private String sdkKey;
        private HttpClient httpClient;
        private Duration pollingInterval =
                Duration.ofSeconds(Constants.DEFAULT_POLLING_INTERVAL_SECONDS);

        public Builder sdkKey(String sdkKey) {
            this.sdkKey = sdkKey;
            return this;
        }

        public Builder httpClient(HttpClient httpClient) {
            this.httpClient = httpClient;
            return this;
        }

        /** Set to {@link Duration#ZERO} to disable background polling. */
        public Builder pollingInterval(Duration pollingInterval) {
            this.pollingInterval = Objects.requireNonNull(pollingInterval);
            return this;
        }

        public SignaKitClientConfig build() {
            return new SignaKitClientConfig(this);
        }
    }
}
