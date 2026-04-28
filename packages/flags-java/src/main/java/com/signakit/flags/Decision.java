package com.signakit.flags;

import java.util.Map;
import java.util.Optional;

/**
 * A decision returned from {@link SignaKitUserContext#decide(String)}.
 *
 * <p>{@code ruleType} is nullable. {@link #ruleType()} returns the raw value
 * (possibly null), and {@link #ruleTypeOptional()} wraps it in an Optional.
 */
public record Decision(
        String flagKey,
        String variationKey,
        boolean enabled,
        String ruleKey,
        RuleType ruleType,
        Map<String, Object> variables) {

    public Optional<RuleType> ruleTypeOptional() {
        return Optional.ofNullable(ruleType);
    }
}
