package com.signakit.flags;

import com.signakit.flags.audience.AudienceMatcher;
import com.signakit.flags.config.ConfigModels.AudienceCondition;
import com.signakit.flags.config.ConfigModels.AudienceMatchType;
import com.signakit.flags.config.ConfigModels.ConfigRuleAudience;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AudienceMatcherTest {

    private static AudienceCondition cond(String attr, String op, Object val) {
        AudienceCondition c = new AudienceCondition();
        c.attribute = attr;
        c.operator = op;
        c.value = val;
        return c;
    }

    private static ConfigRuleAudience aud(AudienceCondition... conditions) {
        ConfigRuleAudience a = new ConfigRuleAudience();
        a.conditions = List.of(conditions);
        return a;
    }

    @Test
    void equals_notEquals() {
        Map<String, Object> attrs = Map.of("plan", "premium");
        assertTrue(AudienceMatcher.matchesCondition(cond("plan", "equals", "premium"), attrs));
        assertFalse(AudienceMatcher.matchesCondition(cond("plan", "equals", "free"), attrs));
        assertTrue(AudienceMatcher.matchesCondition(cond("plan", "not_equals", "free"), attrs));
        assertFalse(AudienceMatcher.matchesCondition(cond("plan", "not_equals", "premium"), attrs));
    }

    @Test
    void numericComparisons() {
        Map<String, Object> attrs = Map.of("age", 30);
        assertTrue(AudienceMatcher.matchesCondition(cond("age", "greater_than", 18), attrs));
        assertFalse(AudienceMatcher.matchesCondition(cond("age", "greater_than", 30), attrs));
        assertTrue(AudienceMatcher.matchesCondition(cond("age", "greater_than_or_equals", 30), attrs));
        assertTrue(AudienceMatcher.matchesCondition(cond("age", "less_than", 50), attrs));
        assertTrue(AudienceMatcher.matchesCondition(cond("age", "less_than_or_equals", 30), attrs));
    }

    @Test
    void inAndNotIn() {
        Map<String, Object> attrs = Map.of("country", "US");
        assertTrue(AudienceMatcher.matchesCondition(cond("country", "in", List.of("US", "CA")), attrs));
        assertFalse(AudienceMatcher.matchesCondition(cond("country", "in", List.of("FR", "DE")), attrs));
        assertTrue(AudienceMatcher.matchesCondition(cond("country", "not_in", List.of("FR", "DE")), attrs));
    }

    @Test
    void containsString_andArray() {
        assertTrue(AudienceMatcher.matchesCondition(
                cond("email", "contains", "@signakit.com"),
                Map.of("email", "rob@signakit.com")));
        assertTrue(AudienceMatcher.matchesCondition(
                cond("tags", "contains", "beta"),
                Map.of("tags", List.of("alpha", "beta"))));
        assertFalse(AudienceMatcher.matchesCondition(
                cond("tags", "contains", "missing"),
                Map.of("tags", List.of("alpha", "beta"))));
    }

    @Test
    void notContains() {
        assertTrue(AudienceMatcher.matchesCondition(
                cond("email", "not_contains", "@evil.com"),
                Map.of("email", "rob@signakit.com")));
        assertFalse(AudienceMatcher.matchesCondition(
                cond("email", "not_contains", "signakit"),
                Map.of("email", "rob@signakit.com")));
    }

    @Test
    void missingAttribute_doesNotMatch() {
        assertFalse(AudienceMatcher.matchesCondition(cond("plan", "equals", "premium"), Map.of()));
    }

    @Test
    void emptyAudiences_matchAll() {
        assertTrue(AudienceMatcher.matchesAudiences(null, AudienceMatchType.ALL, Map.of()));
        assertTrue(AudienceMatcher.matchesAudiences(List.of(), AudienceMatchType.ANY, Map.of()));
    }

    @Test
    void any_vs_all() {
        ConfigRuleAudience premium = aud(cond("plan", "equals", "premium"));
        ConfigRuleAudience us = aud(cond("country", "equals", "US"));
        Map<String, Object> attrs = Map.of("plan", "premium", "country", "FR");

        assertTrue(AudienceMatcher.matchesAudiences(List.of(premium, us), AudienceMatchType.ANY, attrs));
        assertFalse(AudienceMatcher.matchesAudiences(List.of(premium, us), AudienceMatchType.ALL, attrs));
    }
}
