package com.signakit.flags.audience;

import com.signakit.flags.config.ConfigModels.AudienceCondition;
import com.signakit.flags.config.ConfigModels.AudienceMatchType;
import com.signakit.flags.config.ConfigModels.ConfigRuleAudience;

import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Operator + audience match-type evaluation. Mirrors
 * {@code packages/flags-node/src/audience-matcher.ts}.
 */
public final class AudienceMatcher {
    private AudienceMatcher() {}

    public static boolean matchesCondition(AudienceCondition condition, Map<String, Object> attributes) {
        if (attributes == null) return false;
        Object userValue = attributes.get(condition.attribute);
        if (userValue == null) return false;

        String operator = condition.operator;
        Object value = condition.value;

        return switch (operator) {
            case "equals" -> Objects.equals(userValue, value);
            case "not_equals" -> !Objects.equals(userValue, value);
            case "greater_than" -> compareNumbers(userValue, value, c -> c > 0);
            case "less_than" -> compareNumbers(userValue, value, c -> c < 0);
            case "greater_than_or_equals" -> compareNumbers(userValue, value, c -> c >= 0);
            case "less_than_or_equals" -> compareNumbers(userValue, value, c -> c <= 0);
            case "in" -> value instanceof List<?> list && list.contains(userValue);
            case "not_in" -> !(value instanceof List<?> list) || !list.contains(userValue);
            case "contains" -> containsOp(userValue, value);
            case "not_contains" -> notContainsOp(userValue, value);
            default -> {
                System.err.println("[SignaKit] Unknown operator: " + operator);
                yield false;
            }
        };
    }

    private interface IntPred {
        boolean test(int v);
    }

    private static boolean compareNumbers(Object a, Object b, IntPred pred) {
        if (a instanceof Number na && b instanceof Number nb) {
            int cmp = Double.compare(na.doubleValue(), nb.doubleValue());
            return pred.test(cmp);
        }
        return false;
    }

    private static boolean containsOp(Object userValue, Object value) {
        if (userValue instanceof String s && value instanceof String v) {
            return s.contains(v);
        }
        if (userValue instanceof List<?> list && value instanceof String v) {
            return list.contains(v);
        }
        return false;
    }

    private static boolean notContainsOp(Object userValue, Object value) {
        if (userValue instanceof String s && value instanceof String v) {
            return !s.contains(v);
        }
        if (userValue instanceof List<?> list && value instanceof String v) {
            return !list.contains(v);
        }
        return true;
    }

    public static boolean matchesAudience(ConfigRuleAudience audience, Map<String, Object> attributes) {
        if (audience.conditions == null || audience.conditions.isEmpty()) return true;
        for (AudienceCondition c : audience.conditions) {
            if (!matchesCondition(c, attributes)) return false;
        }
        return true;
    }

    public static boolean matchesAudiences(
            List<ConfigRuleAudience> audiences,
            AudienceMatchType matchType,
            Map<String, Object> attributes) {
        if (audiences == null || audiences.isEmpty()) return true;
        if (matchType == AudienceMatchType.ANY) {
            for (ConfigRuleAudience a : audiences) {
                if (matchesAudience(a, attributes)) return true;
            }
            return false;
        }
        // Default ALL semantics
        for (ConfigRuleAudience a : audiences) {
            if (!matchesAudience(a, attributes)) return false;
        }
        return true;
    }
}
