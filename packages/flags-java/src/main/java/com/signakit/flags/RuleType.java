package com.signakit.flags;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Rule types supported by the SignaKit configuration. The wire value matches
 * the strings emitted by the dashboard's config service.
 */
public enum RuleType {
    AB_TEST("ab-test"),
    MULTI_ARMED_BANDIT("multi-armed-bandit"),
    TARGETED("targeted");

    private final String wire;

    RuleType(String wire) {
        this.wire = wire;
    }

    @JsonValue
    public String wire() {
        return wire;
    }

    @JsonCreator
    public static RuleType fromWire(String value) {
        if (value == null) return null;
        for (RuleType rt : values()) {
            if (rt.wire.equals(value)) return rt;
        }
        throw new IllegalArgumentException("Unknown rule type: " + value);
    }
}
