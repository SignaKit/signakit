package com.signakit.flags;

import java.util.Map;

/** Optional event payload extras for {@link SignaKitUserContext#trackEvent}. */
public final class TrackEventOptions {
    private final Double value;
    private final Map<String, Object> metadata;

    private TrackEventOptions(Builder b) {
        this.value = b.value;
        this.metadata = b.metadata;
    }

    public Double value() {
        return value;
    }

    public Map<String, Object> metadata() {
        return metadata;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static TrackEventOptions empty() {
        return builder().build();
    }

    public static final class Builder {
        private Double value;
        private Map<String, Object> metadata;

        public Builder value(double value) {
            this.value = value;
            return this;
        }

        public Builder metadata(Map<String, Object> metadata) {
            this.metadata = metadata;
            return this;
        }

        public TrackEventOptions build() {
            return new TrackEventOptions(this);
        }
    }
}
