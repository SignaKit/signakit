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

    // -------------------------------------------------------------------------
    // equals / not_equals
    // -------------------------------------------------------------------------

    @Test
    void equals_matchesIdenticalStringValues() {
        assertTrue(AudienceMatcher.matchesCondition(
                cond("plan", "equals", "premium"), Map.of("plan", "premium")));
    }

    @Test
    void equals_rejectsDifferentStringValues() {
        assertFalse(AudienceMatcher.matchesCondition(
                cond("plan", "equals", "premium"), Map.of("plan", "free")));
    }

    @Test
    void equals_matchesBooleanValues() {
        assertTrue(AudienceMatcher.matchesCondition(
                cond("verified", "equals", true), Map.of("verified", true)));
        assertFalse(AudienceMatcher.matchesCondition(
                cond("verified", "equals", true), Map.of("verified", false)));
    }

    @Test
    void notEquals_matchesWhenValuesDiffer() {
        assertTrue(AudienceMatcher.matchesCondition(
                cond("plan", "not_equals", "premium"), Map.of("plan", "free")));
        assertFalse(AudienceMatcher.matchesCondition(
                cond("plan", "not_equals", "premium"), Map.of("plan", "premium")));
    }

    @Test
    void returnsFalseWhenAttributeIsMissing() {
        assertFalse(AudienceMatcher.matchesCondition(
                cond("plan", "equals", "premium"), Map.of()));
        assertFalse(AudienceMatcher.matchesCondition(
                cond("plan", "equals", "premium"), null));
    }

    // -------------------------------------------------------------------------
    // Numeric comparisons
    // -------------------------------------------------------------------------

    @Test
    void greaterThan_trueWhenUserValueExceedsThreshold() {
        assertTrue(AudienceMatcher.matchesCondition(
                cond("age", "greater_than", 18), Map.of("age", 25)));
        assertFalse(AudienceMatcher.matchesCondition(
                cond("age", "greater_than", 18), Map.of("age", 18)));
        assertFalse(AudienceMatcher.matchesCondition(
                cond("age", "greater_than", 18), Map.of("age", 10)));
    }

    @Test
    void lessThan_trueWhenUserValueIsBelowThreshold() {
        assertTrue(AudienceMatcher.matchesCondition(
                cond("age", "less_than", 18), Map.of("age", 10)));
        assertFalse(AudienceMatcher.matchesCondition(
                cond("age", "less_than", 18), Map.of("age", 18)));
        assertFalse(AudienceMatcher.matchesCondition(
                cond("age", "less_than", 18), Map.of("age", 25)));
    }

    @Test
    void greaterThanOrEqual_inclusive() {
        assertTrue(AudienceMatcher.matchesCondition(
                cond("age", "greater_than_or_equals", 18), Map.of("age", 18)));
        assertFalse(AudienceMatcher.matchesCondition(
                cond("age", "greater_than_or_equals", 18), Map.of("age", 17)));
    }

    @Test
    void lessThanOrEqual_inclusive() {
        assertTrue(AudienceMatcher.matchesCondition(
                cond("age", "less_than_or_equals", 18), Map.of("age", 18)));
        assertFalse(AudienceMatcher.matchesCondition(
                cond("age", "less_than_or_equals", 18), Map.of("age", 19)));
    }

    @Test
    void numericOperators_returnFalseOnStringAttributeValues() {
        assertFalse(AudienceMatcher.matchesCondition(
                cond("age", "greater_than", 18), Map.of("age", "25")));
    }

    // -------------------------------------------------------------------------
    // in / not_in
    // -------------------------------------------------------------------------

    @Test
    void in_trueWhenUserValueIsInTheList() {
        assertTrue(AudienceMatcher.matchesCondition(
                cond("country", "in", List.of("US", "CA", "GB")), Map.of("country", "US")));
        assertFalse(AudienceMatcher.matchesCondition(
                cond("country", "in", List.of("US", "CA", "GB")), Map.of("country", "DE")));
    }

    @Test
    void in_falseWhenValueIsNotAList() {
        assertFalse(AudienceMatcher.matchesCondition(
                cond("country", "in", "US"), Map.of("country", "US")));
    }

    @Test
    void notIn_trueWhenUserValueIsAbsentFromList() {
        assertTrue(AudienceMatcher.matchesCondition(
                cond("country", "not_in", List.of("US", "CA")), Map.of("country", "DE")));
        assertFalse(AudienceMatcher.matchesCondition(
                cond("country", "not_in", List.of("US", "CA")), Map.of("country", "US")));
    }

    @Test
    void notIn_trueWhenValueIsNotAList() {
        // Java: non-list value → vacuously true (mirrors JS/Python/Go SDK behaviour)
        assertTrue(AudienceMatcher.matchesCondition(
                cond("country", "not_in", "US"), Map.of("country", "US")));
    }

    // -------------------------------------------------------------------------
    // contains / not_contains
    // -------------------------------------------------------------------------

    @Test
    void contains_trueWhenStringIncludesSubstring() {
        assertTrue(AudienceMatcher.matchesCondition(
                cond("email", "contains", "@acme"), Map.of("email", "bob@acme.com")));
        assertFalse(AudienceMatcher.matchesCondition(
                cond("email", "contains", "@acme"), Map.of("email", "bob@gmail.com")));
    }

    @Test
    void contains_trueWhenStringArrayIncludesValue() {
        assertTrue(AudienceMatcher.matchesCondition(
                cond("tags", "contains", "beta"),
                Map.of("tags", List.of("alpha", "beta", "gamma"))));
        assertFalse(AudienceMatcher.matchesCondition(
                cond("tags", "contains", "beta"),
                Map.of("tags", List.of("alpha", "gamma"))));
    }

    @Test
    void notContains_trueWhenStringDoesNotIncludeSubstring() {
        assertTrue(AudienceMatcher.matchesCondition(
                cond("email", "not_contains", "@acme"), Map.of("email", "bob@gmail.com")));
        assertFalse(AudienceMatcher.matchesCondition(
                cond("email", "not_contains", "@acme"), Map.of("email", "bob@acme.com")));
    }

    @Test
    void notContains_trueWhenArrayDoesNotIncludeValue() {
        assertTrue(AudienceMatcher.matchesCondition(
                cond("tags", "not_contains", "beta"),
                Map.of("tags", List.of("alpha", "gamma"))));
        assertFalse(AudienceMatcher.matchesCondition(
                cond("tags", "not_contains", "beta"),
                Map.of("tags", List.of("alpha", "beta"))));
    }

    @Test
    void notContains_trueWhenTypesDoNotMatch() {
        // Java: numeric attribute with string needle → vacuously true (mirrors JS/Python/Go SDK)
        assertTrue(AudienceMatcher.matchesCondition(
                cond("score", "not_contains", "high"), Map.of("score", 42.0)));
    }

    // -------------------------------------------------------------------------
    // matchesAudience (via single-element list to matchesAudiences)
    // -------------------------------------------------------------------------

    @Test
    void matchesAudience_trueWhenAllConditionsMatch() {
        ConfigRuleAudience a = aud(
                cond("plan", "equals", "premium"),
                cond("age", "greater_than_or_equals", 18));
        assertTrue(AudienceMatcher.matchesAudiences(
                List.of(a), AudienceMatchType.ALL,
                Map.of("plan", "premium", "age", 25)));
    }

    @Test
    void matchesAudience_falseWhenAnyConditionFails() {
        ConfigRuleAudience a = aud(
                cond("plan", "equals", "premium"),
                cond("age", "greater_than_or_equals", 18));
        assertFalse(AudienceMatcher.matchesAudiences(
                List.of(a), AudienceMatchType.ALL,
                Map.of("plan", "premium", "age", 16)));
    }

    @Test
    void matchesAudience_trueForEmptyConditions() {
        ConfigRuleAudience a = aud();
        assertTrue(AudienceMatcher.matchesAudiences(
                List.of(a), AudienceMatchType.ALL, Map.of()));
    }

    // -------------------------------------------------------------------------
    // matchesAudiences
    // -------------------------------------------------------------------------

    @Test
    void matchesAudiences_trueWhenNullOrEmpty() {
        assertTrue(AudienceMatcher.matchesAudiences(null,      AudienceMatchType.ANY, Map.of()));
        assertTrue(AudienceMatcher.matchesAudiences(List.of(), AudienceMatchType.ANY, Map.of("plan", "premium")));
        assertTrue(AudienceMatcher.matchesAudiences(List.of(), AudienceMatchType.ALL, Map.of("plan", "premium")));
    }

    @Test
    void any_trueWhenAtLeastOneAudienceMatches() {
        List<ConfigRuleAudience> audiences = List.of(
                aud(cond("plan", "equals", "premium")),
                aud(cond("plan", "equals", "enterprise")));
        assertTrue(AudienceMatcher.matchesAudiences(
                audiences, AudienceMatchType.ANY, Map.of("plan", "premium")));
        assertFalse(AudienceMatcher.matchesAudiences(
                audiences, AudienceMatchType.ANY, Map.of("plan", "free")));
    }

    @Test
    void all_trueOnlyWhenEveryAudienceMatches() {
        List<ConfigRuleAudience> audiences = List.of(
                aud(cond("plan", "equals", "premium")),
                aud(cond("verified", "equals", true)));
        assertTrue(AudienceMatcher.matchesAudiences(
                audiences, AudienceMatchType.ALL,
                Map.of("plan", "premium", "verified", true)));
        assertFalse(AudienceMatcher.matchesAudiences(
                audiences, AudienceMatchType.ALL,
                Map.of("plan", "premium", "verified", false)));
    }

    @Test
    void defaultsToAllLogicWhenMatchTypeIsNull() {
        // null AudienceMatchType falls through to the "all" (AND) default.
        List<ConfigRuleAudience> audiences = List.of(
                aud(cond("plan", "equals", "premium")),
                aud(cond("verified", "equals", true)));
        assertTrue(AudienceMatcher.matchesAudiences(
                audiences, null,
                Map.of("plan", "premium", "verified", true)));
        assertFalse(AudienceMatcher.matchesAudiences(
                audiences, null,
                Map.of("plan", "premium", "verified", false)));
    }
}
