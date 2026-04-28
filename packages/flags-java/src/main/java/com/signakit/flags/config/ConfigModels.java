package com.signakit.flags.config;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonValue;
import com.signakit.flags.RuleType;

import java.util.List;
import java.util.Map;

/** Plain-old config DTOs for Jackson. Kept separate so the public API stays clean. */
public final class ConfigModels {
    private ConfigModels() {}

    public enum Environment {
        DEVELOPMENT("development"),
        PRODUCTION("production");

        private final String wire;

        Environment(String wire) {
            this.wire = wire;
        }

        @JsonValue
        public String wire() {
            return wire;
        }

        @JsonCreator
        public static Environment fromWire(String value) {
            for (Environment e : values()) {
                if (e.wire.equals(value)) return e;
            }
            throw new IllegalArgumentException("Unknown environment: " + value);
        }
    }

    public enum AudienceMatchType {
        ANY("any"),
        ALL("all");

        private final String wire;

        AudienceMatchType(String wire) {
            this.wire = wire;
        }

        @JsonValue
        public String wire() {
            return wire;
        }

        @JsonCreator
        public static AudienceMatchType fromWire(String value) {
            if (value == null) return null;
            for (AudienceMatchType m : values()) {
                if (m.wire.equals(value)) return m;
            }
            throw new IllegalArgumentException("Unknown audience match type: " + value);
        }
    }

    public enum FlagStatus {
        ACTIVE("active"),
        ARCHIVED("archived");

        private final String wire;

        FlagStatus(String wire) {
            this.wire = wire;
        }

        @JsonValue
        public String wire() {
            return wire;
        }

        @JsonCreator
        public static FlagStatus fromWire(String value) {
            for (FlagStatus s : values()) {
                if (s.wire.equals(value)) return s;
            }
            throw new IllegalArgumentException("Unknown flag status: " + value);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Variation {
        public String key;
        public Map<String, Object> variables;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class FlagVariable {
        public String key;
        public String type; // string|number|boolean|json
        public Object defaultValue;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class VariationAllocationRange {
        public String variation;
        public int start;
        public int end;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class VariationAllocation {
        public List<VariationAllocationRange> ranges;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AudienceCondition {
        public String attribute;
        public String operator;
        public Object value; // String | Number | Boolean | List<String>
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ConfigRuleAudience {
        public List<AudienceCondition> conditions;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AllowlistEntry {
        public String userId;
        public String variation;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ConfigRule {
        public String ruleKey;
        public RuleType ruleType;
        public AudienceMatchType audienceMatchType;
        public List<ConfigRuleAudience> audiences;
        public double trafficPercentage;
        public VariationAllocation variationAllocation;
        public List<AllowlistEntry> allowlist;
        public List<String> eventKeys;
        public String primaryEventKey;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ConfigFlag {
        public String id;
        public String key;
        public List<Variation> variations;
        public List<FlagVariable> variables;
        public VariationAllocation allocation;
        public String salt;
        public FlagStatus status;
        public boolean running;
        public List<ConfigRule> rules;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ProjectConfig {
        public String projectId;
        public Environment environmentKey;
        public String sdkKey;
        public int version;
        public List<ConfigFlag> flags;
        public String generatedAt;
    }
}
