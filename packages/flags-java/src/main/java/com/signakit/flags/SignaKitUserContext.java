package com.signakit.flags;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.signakit.flags.ua.BotDetector;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Per-user evaluation handle. Created via
 * {@link SignaKitClient#createUserContext(String, UserAttributes)}.
 *
 * <p>{@link #decide(String)} fires a {@code $exposure} event asynchronously,
 * but skips it for {@link RuleType#TARGETED} rules (simple feature-flag
 * rollouts have nothing to attribute).
 */
public class SignaKitUserContext {

    private static final ObjectMapper METADATA_MAPPER = new ObjectMapper();

    private final SignaKitClient client;
    private final String userId;
    private final Map<String, Object> attributes; // already stripped of $userAgent
    private final boolean isBot;
    private Map<String, String> cachedDecisions;

    SignaKitUserContext(SignaKitClient client, String userId, UserAttributes raw) {
        this.client = client;
        this.userId = userId;
        this.isBot = BotDetector.isBot(raw.userAgent());
        this.attributes = raw.withoutUserAgent();
    }

    public String userId() {
        return userId;
    }

    public Map<String, Object> attributes() {
        return Map.copyOf(attributes);
    }

    /**
     * Evaluate a single flag for this user. Returns {@code null} if the flag
     * is missing or archived. Bots always receive a disabled "off" decision
     * and no exposure event is fired.
     */
    public Decision decide(String flagKey) {
        if (isBot) {
            return new Decision(flagKey, "off", false, null, null, Map.of());
        }

        Decision decision = client.evaluateFlag(flagKey, userId, attributes);
        if (decision != null) {
            if (cachedDecisions == null) cachedDecisions = new LinkedHashMap<>();
            cachedDecisions.put(flagKey, decision.variationKey());
            trackExposure(decision);
        }
        return decision;
    }

    /** Evaluate every non-archived flag for this user. */
    public Map<String, Decision> decideAll() {
        if (isBot) {
            return client.getBotDecisions();
        }
        Map<String, Decision> decisions = client.evaluateAllFlags(userId, attributes);
        cachedDecisions = new LinkedHashMap<>();
        for (Map.Entry<String, Decision> e : decisions.entrySet()) {
            cachedDecisions.put(e.getKey(), e.getValue().variationKey());
            trackExposure(e.getValue());
        }
        return decisions;
    }

    public CompletableFuture<Void> trackEvent(String eventKey) {
        return trackEvent(eventKey, TrackEventOptions.empty());
    }

    /** Send a conversion event. Bots are silently ignored. */
    public CompletableFuture<Void> trackEvent(String eventKey, TrackEventOptions options) {
        if (isBot) return CompletableFuture.completedFuture(null);

        String sanitizedEventKey = truncate(eventKey, Constants.MAX_EVENT_KEY_LENGTH);
        String sanitizedUserId = truncate(userId, Constants.MAX_USER_ID_LENGTH);

        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventKey", sanitizedEventKey);
        event.put("userId", sanitizedUserId);
        event.put("timestamp", Instant.now().toString());

        Map<String, Object> sanitizedAttrs = sanitizeAttributes(attributes);
        if (sanitizedAttrs != null) event.put("attributes", sanitizedAttrs);

        if (cachedDecisions != null && !cachedDecisions.isEmpty()) {
            event.put("decisions", new LinkedHashMap<>(cachedDecisions));
        }

        if (options != null && options.value() != null) {
            event.put("value", options.value());
        }

        if (options != null && options.metadata() != null) {
            try {
                String json = METADATA_MAPPER.writeValueAsString(options.metadata());
                if (json.length() <= Constants.MAX_METADATA_SIZE_BYTES) {
                    event.put("metadata", options.metadata());
                } else {
                    System.err.println(
                            "[SignaKit] metadata exceeds " + Constants.MAX_METADATA_SIZE_BYTES
                                    + " bytes (" + json.length() + "), dropping");
                }
            } catch (Exception ignored) {
                // dropped
            }
        }

        return client.sendEvent(event);
    }

    // ---------------------------------------------------------------------
    // internals
    // ---------------------------------------------------------------------

    void trackExposure(Decision decision) {
        // Skip exposure entirely for `targeted` rules — feature-flag rollouts
        // are not experiments, so there is nothing to attribute.
        if (decision.ruleType() == RuleType.TARGETED) return;

        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventKey", "$exposure");
        event.put("userId", truncate(userId, Constants.MAX_USER_ID_LENGTH));
        event.put("timestamp", Instant.now().toString());

        Map<String, String> decisionMap = new LinkedHashMap<>();
        decisionMap.put(decision.flagKey(), decision.variationKey());
        event.put("decisions", decisionMap);

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("flagKey", decision.flagKey());
        meta.put("variationKey", decision.variationKey());
        meta.put("ruleKey", decision.ruleKey());
        event.put("metadata", meta);

        Map<String, Object> sanitized = sanitizeAttributes(attributes);
        if (sanitized != null) event.put("attributes", sanitized);

        // fire-and-forget
        client.sendEvent(event);
    }

    static Map<String, Object> sanitizeAttributes(Map<String, Object> attributes) {
        if (attributes == null || attributes.isEmpty()) return null;
        Map<String, Object> out = new LinkedHashMap<>();
        int count = 0;
        for (Map.Entry<String, Object> e : attributes.entrySet()) {
            if (count >= Constants.MAX_ATTRIBUTES_COUNT) break;
            Object v = e.getValue();
            if (v == null) continue;
            String key = truncate(e.getKey(), Constants.MAX_ATTRIBUTE_KEY_LENGTH);
            if (v instanceof String s) {
                out.put(key, truncate(s, Constants.MAX_ATTRIBUTE_VALUE_LENGTH));
            } else if (v instanceof List<?> list) {
                int max = Math.min(100, list.size());
                java.util.List<Object> trimmed = new java.util.ArrayList<>(max);
                for (int i = 0; i < max; i++) {
                    Object item = list.get(i);
                    trimmed.add(item instanceof String si ? truncate(si, Constants.MAX_ATTRIBUTE_VALUE_LENGTH) : item);
                }
                out.put(key, trimmed);
            } else {
                out.put(key, v);
            }
            count++;
        }
        return out.isEmpty() ? null : out;
    }

    static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
