package com.signakit.flags;

import java.net.http.HttpClient;
import java.util.Objects;

/**
 * Configuration for the {@link SignaKitClient}. Required: {@code sdkKey} of
 * format {@code sk_{env}_{orgId}_{projectId}_{random}}.
 */
public final class SignaKitClientConfig {
    private final String sdkKey;
    private final HttpClient httpClient;

    private SignaKitClientConfig(Builder b) {
        this.sdkKey = Objects.requireNonNull(b.sdkKey, "sdkKey is required");
        this.httpClient = b.httpClient;
    }

    public String sdkKey() {
        return sdkKey;
    }

    /** Optional override (chiefly for tests). */
    public HttpClient httpClient() {
        return httpClient;
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

        public Builder sdkKey(String sdkKey) {
            this.sdkKey = sdkKey;
            return this;
        }

        public Builder httpClient(HttpClient httpClient) {
            this.httpClient = httpClient;
            return this;
        }

        public SignaKitClientConfig build() {
            return new SignaKitClientConfig(this);
        }
    }
}
