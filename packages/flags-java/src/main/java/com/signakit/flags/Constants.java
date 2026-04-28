package com.signakit.flags;

/**
 * SDK-wide constants. Mirrors {@code packages/flags-node/src/constants.ts}.
 */
public final class Constants {
    private Constants() {}

    public static final String SIGNAKIT_CDN_URL = "https://d30l2rkped5b4m.cloudfront.net";
    public static final String SIGNAKIT_EVENTS_URL =
            "https://60amq9ozsf.execute-api.us-east-2.amazonaws.com/v1/flag-events";

    /** 0-9999, gives 0.01% bucketing granularity. */
    public static final int BUCKET_SPACE = 10000;

    public static final int MAX_EVENT_KEY_LENGTH = 100;
    public static final int MAX_USER_ID_LENGTH = 256;
    public static final int MAX_METADATA_SIZE_BYTES = 5000;
    public static final int MAX_ATTRIBUTES_COUNT = 50;
    public static final int MAX_ATTRIBUTE_KEY_LENGTH = 100;
    public static final int MAX_ATTRIBUTE_VALUE_LENGTH = 1000;
}
