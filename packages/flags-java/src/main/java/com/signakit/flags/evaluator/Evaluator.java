package com.signakit.flags.evaluator;

import com.signakit.flags.Constants;
import com.signakit.flags.Decision;
import com.signakit.flags.audience.AudienceMatcher;
import com.signakit.flags.config.ConfigModels.AllowlistEntry;
import com.signakit.flags.config.ConfigModels.ConfigFlag;
import com.signakit.flags.config.ConfigModels.ConfigRule;
import com.signakit.flags.config.ConfigModels.FlagStatus;
import com.signakit.flags.config.ConfigModels.FlagVariable;
import com.signakit.flags.config.ConfigModels.ProjectConfig;
import com.signakit.flags.config.ConfigModels.Variation;
import com.signakit.flags.config.ConfigModels.VariationAllocation;
import com.signakit.flags.config.ConfigModels.VariationAllocationRange;
import com.signakit.flags.hasher.Hasher;

import java.util.LinkedHashMap;
import java.util.Map;

/** Evaluates a single flag (or all flags) for a given user. */
public final class Evaluator {
    private Evaluator() {}

    private static String findVariationInRanges(VariationAllocation allocation, int bucket) {
        if (allocation == null || allocation.ranges == null) return null;
        for (VariationAllocationRange r : allocation.ranges) {
            if (bucket >= r.start && bucket <= r.end) return r.variation;
        }
        return null;
    }

    private static Map<String, Object> resolveVariables(ConfigFlag flag, String variationKey) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (flag.variables == null || flag.variables.isEmpty()) return out;
        Map<String, Object> overrides = Map.of();
        if (flag.variations != null) {
            for (Variation v : flag.variations) {
                if (variationKey.equals(v.key) && v.variables != null) {
                    overrides = v.variables;
                    break;
                }
            }
        }
        for (FlagVariable def : flag.variables) {
            Object override = overrides.get(def.key);
            out.put(def.key, override != null ? override : def.defaultValue);
        }
        return out;
    }

    /**
     * Evaluate a single flag. Returns {@code null} when the flag is archived.
     */
    public static Decision evaluateFlag(ConfigFlag flag, String userId, Map<String, Object> attributes) {
        if (flag.status == FlagStatus.ARCHIVED) return null;

        if (!flag.running) {
            return new Decision(
                    flag.key, "off", false, null, null, resolveVariables(flag, "off"));
        }

        if (flag.rules != null) {
            for (ConfigRule rule : flag.rules) {
                if (rule == null) continue;

                // Allowlist
                if (rule.allowlist != null && !rule.allowlist.isEmpty()) {
                    for (AllowlistEntry entry : rule.allowlist) {
                        if (userId.equals(entry.userId)) {
                            String variation = entry.variation;
                            return new Decision(
                                    flag.key,
                                    variation,
                                    !"off".equals(variation),
                                    rule.ruleKey,
                                    rule.ruleType,
                                    resolveVariables(flag, variation));
                        }
                    }
                }

                if (!AudienceMatcher.matchesAudiences(rule.audiences, rule.audienceMatchType, attributes)) {
                    continue;
                }

                int trafficBucket = Hasher.hashForTraffic(flag.salt, userId);
                int trafficThreshold = (int) Math.floor((rule.trafficPercentage / 100.0) * Constants.BUCKET_SPACE);
                if (trafficBucket >= trafficThreshold) continue;

                int variationBucket = Hasher.hashForVariation(flag.salt, userId);
                String variation = findVariationInRanges(rule.variationAllocation, variationBucket);
                if (variation != null) {
                    return new Decision(
                            flag.key,
                            variation,
                            !"off".equals(variation),
                            rule.ruleKey,
                            rule.ruleType,
                            resolveVariables(flag, variation));
                }
            }
        }

        // Default allocation
        int defaultBucket = Hasher.hashForDefault(flag.salt, userId);
        String defaultVariation = findVariationInRanges(flag.allocation, defaultBucket);
        if (defaultVariation != null) {
            return new Decision(
                    flag.key,
                    defaultVariation,
                    !"off".equals(defaultVariation),
                    null,
                    null,
                    resolveVariables(flag, defaultVariation));
        }

        return new Decision(flag.key, "off", false, null, null, resolveVariables(flag, "off"));
    }

    public static Map<String, Decision> evaluateAllFlags(
            ProjectConfig config, String userId, Map<String, Object> attributes) {
        Map<String, Decision> out = new LinkedHashMap<>();
        if (config.flags == null) return out;
        for (ConfigFlag flag : config.flags) {
            Decision d = evaluateFlag(flag, userId, attributes);
            if (d != null) out.put(flag.key, d);
        }
        return out;
    }
}
