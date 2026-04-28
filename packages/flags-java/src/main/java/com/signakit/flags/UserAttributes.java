package com.signakit.flags;

import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Typed wrapper around the loose attribute map carried by a user context.
 *
 * <p>Values may be {@link String}, {@link Number}, {@link Boolean}, or
 * {@link java.util.List List&lt;String&gt;}. Use {@link #USER_AGENT_KEY} for
 * the bot-detection user-agent attribute.
 */
public final class UserAttributes {
    public static final String USER_AGENT_KEY = "$userAgent";

    private final Map<String, Object> data;

    private UserAttributes(Map<String, Object> data) {
        this.data = data;
    }

    public static UserAttributes empty() {
        return new UserAttributes(new LinkedHashMap<>());
    }

    public static UserAttributes of(Map<String, Object> data) {
        return new UserAttributes(new LinkedHashMap<>(data == null ? Map.of() : data));
    }

    public Map<String, Object> asMap() {
        return Collections.unmodifiableMap(data);
    }

    public Object get(String key) {
        return data.get(key);
    }

    public String userAgent() {
        Object v = data.get(USER_AGENT_KEY);
        return v instanceof String s ? s : null;
    }

    /**
     * Returns a copy of the underlying attributes with the {@code $userAgent}
     * key stripped out. Used internally for evaluation/exposure payloads.
     */
    public Map<String, Object> withoutUserAgent() {
        Map<String, Object> copy = new LinkedHashMap<>(data);
        copy.remove(USER_AGENT_KEY);
        return copy;
    }

    public boolean isEmpty() {
        return data.isEmpty();
    }

    public Map<String, Object> mutableCopy() {
        return new HashMap<>(data);
    }
}
