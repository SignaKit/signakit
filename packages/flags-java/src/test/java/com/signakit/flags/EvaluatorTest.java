package com.signakit.flags;

import com.signakit.flags.config.ConfigModels;
import com.signakit.flags.config.ConfigModels.AllowlistEntry;
import com.signakit.flags.config.ConfigModels.AudienceCondition;
import com.signakit.flags.config.ConfigModels.AudienceMatchType;
import com.signakit.flags.config.ConfigModels.ConfigFlag;
import com.signakit.flags.config.ConfigModels.ConfigRule;
import com.signakit.flags.config.ConfigModels.ConfigRuleAudience;
import com.signakit.flags.config.ConfigModels.FlagStatus;
import com.signakit.flags.config.ConfigModels.FlagVariable;
import com.signakit.flags.config.ConfigModels.Variation;
import com.signakit.flags.config.ConfigModels.VariationAllocation;
import com.signakit.flags.config.ConfigModels.VariationAllocationRange;
import com.signakit.flags.evaluator.Evaluator;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class EvaluatorTest {

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private static VariationAllocationRange range(String variation, int start, int end) {
        VariationAllocationRange r = new VariationAllocationRange();
        r.variation = variation;
        r.start = start;
        r.end = end;
        return r;
    }

    private static VariationAllocation alloc(VariationAllocationRange... ranges) {
        VariationAllocation a = new VariationAllocation();
        a.ranges = List.of(ranges);
        return a;
    }

    private static VariationAllocation fullAlloc(String variation) {
        return alloc(range(variation, 0, 9999));
    }

    private static Variation variation(String key) {
        Variation v = new Variation();
        v.key = key;
        return v;
    }

    private static Variation variationWithVars(String key, Map<String, Object> vars) {
        Variation v = new Variation();
        v.key = key;
        v.variables = vars;
        return v;
    }

    private static FlagVariable flagVar(String key, String type, Object defaultValue) {
        FlagVariable fv = new FlagVariable();
        fv.key = key;
        fv.type = type;
        fv.defaultValue = defaultValue;
        return fv;
    }

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

    private static ConfigFlag makeFlag(String key) {
        ConfigFlag f = new ConfigFlag();
        f.id = "flag_" + key;
        f.key = key;
        f.salt = key + "-salt";
        f.status = FlagStatus.ACTIVE;
        f.running = true;
        f.variations = List.of(variation("off"), variation("on"));
        f.allocation = fullAlloc("on");
        return f;
    }

    private static ConfigModels.ProjectConfig makeConfig(ConfigFlag... flags) {
        ConfigModels.ProjectConfig cfg = new ConfigModels.ProjectConfig();
        cfg.projectId = "p1";
        cfg.environmentKey = ConfigModels.Environment.DEVELOPMENT;
        cfg.sdkKey = "sk_dev_org1_p1_xxx";
        cfg.version = 1;
        cfg.flags = List.of(flags);
        cfg.generatedAt = "2024-01-01T00:00:00.000Z";
        return cfg;
    }

    // -------------------------------------------------------------------------
    // Status / running checks
    // -------------------------------------------------------------------------

    @Test
    void archivedFlagReturnsNull() {
        ConfigFlag flag = makeFlag("archived");
        flag.status = FlagStatus.ARCHIVED;
        assertNull(Evaluator.evaluateFlag(flag, "user-1", null));
    }

    @Test
    void notRunningReturnsOffDisabled() {
        ConfigFlag flag = makeFlag("disabled");
        flag.running = false;
        Decision d = Evaluator.evaluateFlag(flag, "user-1", null);
        assertNotNull(d);
        assertEquals("off", d.variationKey());
        assertFalse(d.enabled());
        assertNull(d.ruleKey());
        assertNull(d.ruleType());
    }

    // -------------------------------------------------------------------------
    // Allowlist
    // -------------------------------------------------------------------------

    @Test
    void allowlistReturnsListedVariation() {
        ConfigFlag flag = makeFlag("allowlist");
        flag.allocation = fullAlloc("off");
        ConfigRule rule = new ConfigRule();
        rule.ruleKey = "rule-qa";
        rule.ruleType = RuleType.TARGETED;
        AllowlistEntry e1 = new AllowlistEntry(); e1.userId = "qa-user";     e1.variation = "on";
        AllowlistEntry e2 = new AllowlistEntry(); e2.userId = "qa-off-user"; e2.variation = "off";
        rule.allowlist = List.of(e1, e2);
        rule.variationAllocation = fullAlloc("on");
        flag.rules = List.of(rule);

        Decision d = Evaluator.evaluateFlag(flag, "qa-user", null);
        assertNotNull(d);
        assertEquals("on", d.variationKey());
        assertTrue(d.enabled());
        assertEquals("rule-qa", d.ruleKey());
        assertEquals(RuleType.TARGETED, d.ruleType());
    }

    @Test
    void allowlistOffVariationReturnsEnabledFalse() {
        ConfigFlag flag = makeFlag("allowlist");
        flag.allocation = fullAlloc("off");
        ConfigRule rule = new ConfigRule();
        rule.ruleKey = "rule-qa";
        rule.ruleType = RuleType.TARGETED;
        AllowlistEntry e = new AllowlistEntry(); e.userId = "qa-off-user"; e.variation = "off";
        rule.allowlist = List.of(e);
        rule.variationAllocation = fullAlloc("on");
        flag.rules = List.of(rule);

        Decision d = Evaluator.evaluateFlag(flag, "qa-off-user", null);
        assertNotNull(d);
        assertEquals("off", d.variationKey());
        assertFalse(d.enabled());
        assertEquals("rule-qa", d.ruleKey());
    }

    @Test
    void nonAllowlistedUserFallsThroughToDefault() {
        ConfigFlag flag = makeFlag("allowlist");
        flag.allocation = fullAlloc("off");
        ConfigRule rule = new ConfigRule();
        rule.ruleKey = "rule-qa";
        rule.ruleType = RuleType.TARGETED;
        AllowlistEntry e = new AllowlistEntry(); e.userId = "qa-user"; e.variation = "on";
        rule.allowlist = List.of(e);
        rule.variationAllocation = fullAlloc("on");
        flag.rules = List.of(rule);

        Decision d = Evaluator.evaluateFlag(flag, "random-user", null);
        assertNotNull(d);
        assertEquals("off", d.variationKey());
        assertNull(d.ruleKey());
    }

    // -------------------------------------------------------------------------
    // Traffic allocation
    // -------------------------------------------------------------------------

    @Test
    void placesAllUsersInTrafficWhenPercentageIs100() {
        ConfigFlag flag = makeFlag("full-traffic");
        ConfigRule rule = new ConfigRule();
        rule.ruleKey = "rule-all";
        rule.ruleType = RuleType.AB_TEST;
        rule.trafficPercentage = 100;
        rule.variationAllocation = fullAlloc("on");
        flag.rules = List.of(rule);

        Decision d = Evaluator.evaluateFlag(flag, "any-user", null);
        assertNotNull(d);
        assertEquals("on", d.variationKey());
        assertEquals("rule-all", d.ruleKey());
    }

    @Test
    void placesNoUsersInTrafficWhenPercentageIs0() {
        ConfigFlag flag = makeFlag("zero-traffic");
        flag.allocation = fullAlloc("off");
        ConfigRule rule = new ConfigRule();
        rule.ruleKey = "rule-none";
        rule.ruleType = RuleType.AB_TEST;
        rule.trafficPercentage = 0;
        rule.variationAllocation = fullAlloc("on");
        flag.rules = List.of(rule);

        Decision d = Evaluator.evaluateFlag(flag, "any-user", null);
        assertNotNull(d);
        assertEquals("off", d.variationKey());
        assertNull(d.ruleKey());
    }

    // -------------------------------------------------------------------------
    // Audience targeting
    // -------------------------------------------------------------------------

    @Test
    void matchesRuleForUserWhoseAttributesSatisfyAudience() {
        ConfigFlag flag = makeFlag("targeted");
        flag.allocation = fullAlloc("off");
        ConfigRule rule = new ConfigRule();
        rule.ruleKey = "rule-premium";
        rule.ruleType = RuleType.AB_TEST;
        rule.audienceMatchType = AudienceMatchType.ANY;
        rule.audiences = List.of(aud(cond("plan", "equals", "premium")));
        rule.trafficPercentage = 100;
        rule.variationAllocation = fullAlloc("on");
        flag.rules = List.of(rule);

        Decision d = Evaluator.evaluateFlag(flag, "premium-user", Map.of("plan", "premium"));
        assertNotNull(d);
        assertEquals("on", d.variationKey());
        assertEquals("rule-premium", d.ruleKey());
    }

    @Test
    void fallsThroughToDefaultForUserWhoDoesNotMatchAudience() {
        ConfigFlag flag = makeFlag("targeted");
        flag.allocation = fullAlloc("off");
        ConfigRule rule = new ConfigRule();
        rule.ruleKey = "rule-premium";
        rule.ruleType = RuleType.AB_TEST;
        rule.audienceMatchType = AudienceMatchType.ANY;
        rule.audiences = List.of(aud(cond("plan", "equals", "premium")));
        rule.trafficPercentage = 100;
        rule.variationAllocation = fullAlloc("on");
        flag.rules = List.of(rule);

        Decision d = Evaluator.evaluateFlag(flag, "free-user", Map.of("plan", "free"));
        assertNotNull(d);
        assertEquals("off", d.variationKey());
        assertNull(d.ruleKey());
    }

    @Test
    void fallsThroughToDefaultWhenUserHasNoAttributes() {
        ConfigFlag flag = makeFlag("targeted");
        flag.allocation = fullAlloc("off");
        ConfigRule rule = new ConfigRule();
        rule.ruleKey = "rule-premium";
        rule.ruleType = RuleType.AB_TEST;
        rule.audienceMatchType = AudienceMatchType.ANY;
        rule.audiences = List.of(aud(cond("plan", "equals", "premium")));
        rule.trafficPercentage = 100;
        rule.variationAllocation = fullAlloc("on");
        flag.rules = List.of(rule);

        Decision d = Evaluator.evaluateFlag(flag, "attr-less-user", null);
        assertNotNull(d);
        assertEquals("off", d.variationKey());
        assertNull(d.ruleKey());
    }

    // -------------------------------------------------------------------------
    // Default allocation
    // -------------------------------------------------------------------------

    @Test
    void usesDefaultAllocationWhenNoRulesExist() {
        ConfigFlag flag = makeFlag("no-rules");

        Decision d = Evaluator.evaluateFlag(flag, "user-1", null);
        assertNotNull(d);
        assertEquals("on", d.variationKey());
        assertTrue(d.enabled());
        assertNull(d.ruleKey());
        assertNull(d.ruleType());
    }

    @Test
    void returnsOffFallbackWhenDefaultAllocationRangesAreEmpty() {
        ConfigFlag flag = makeFlag("empty-alloc");
        flag.allocation = alloc();

        Decision d = Evaluator.evaluateFlag(flag, "user-1", null);
        assertNotNull(d);
        assertEquals("off", d.variationKey());
        assertFalse(d.enabled());
    }

    // -------------------------------------------------------------------------
    // Variable resolution
    // -------------------------------------------------------------------------

    @Test
    void returnsAllDefaultVariablesForVariationWithNoOverrides() {
        ConfigFlag flag = new ConfigFlag();
        flag.id = "flag_vars";
        flag.key = "vars-flag";
        flag.status = FlagStatus.ACTIVE;
        flag.running = true;
        flag.salt = "vars-salt";
        flag.variations = List.of(variation("off"), variation("v1"));
        flag.variables = List.of(
                flagVar("color",   "string",  "red"),
                flagVar("count",   "number",  1.0),
                flagVar("enabled", "boolean", true));
        flag.allocation = fullAlloc("v1");

        Decision d = Evaluator.evaluateFlag(flag, "user-1", null);
        assertNotNull(d);
        assertEquals("v1", d.variationKey());
        assertEquals("red", d.variables().get("color"));
        assertEquals(1.0,   d.variables().get("count"));
        assertEquals(true,  d.variables().get("enabled"));
    }

    @Test
    void mergesVariationOverridesWithFlagLevelDefaults() {
        ConfigFlag flag = new ConfigFlag();
        flag.id = "flag_vars";
        flag.key = "vars-flag";
        flag.status = FlagStatus.ACTIVE;
        flag.running = true;
        flag.salt = "vars-salt";
        flag.variations = List.of(
                variation("off"),
                variationWithVars("v2", Map.of("color", "blue", "count", 5.0)));
        flag.variables = List.of(
                flagVar("color",   "string",  "red"),
                flagVar("count",   "number",  1.0),
                flagVar("enabled", "boolean", true));
        flag.allocation = fullAlloc("v2");

        Decision d = Evaluator.evaluateFlag(flag, "user-1", null);
        assertNotNull(d);
        assertEquals("v2", d.variationKey());
        // color and count come from variation overrides; enabled comes from default.
        assertEquals("blue", d.variables().get("color"));
        assertEquals(5.0,    d.variables().get("count"));
        assertEquals(true,   d.variables().get("enabled"));
    }

    @Test
    void returnsEmptyVariablesWhenFlagHasNoneDefined() {
        ConfigFlag flag = makeFlag("no-vars");

        Decision d = Evaluator.evaluateFlag(flag, "user-1", null);
        assertNotNull(d);
        assertTrue(d.variables().isEmpty());
    }

    // -------------------------------------------------------------------------
    // Determinism
    // -------------------------------------------------------------------------

    @Test
    void alwaysAssignsSameVariationToSameUser() {
        ConfigFlag flag = makeFlag("determinism");
        flag.allocation = alloc(range("off", 0, 4999), range("on", 5000, 9999));

        String firstKey = null;
        for (int i = 0; i < 10; i++) {
            Decision d = Evaluator.evaluateFlag(flag, "user-stable", null);
            assertNotNull(d);
            if (firstKey == null) {
                firstKey = d.variationKey();
            } else {
                assertEquals(firstKey, d.variationKey(),
                        "non-deterministic: iteration " + i + " returned " + d.variationKey());
            }
        }
    }

    // -------------------------------------------------------------------------
    // evaluateAllFlags
    // -------------------------------------------------------------------------

    @Test
    void evaluateAllReturnsDecisionsForNonArchivedFlags() {
        ConfigFlag archivedFlag = makeFlag("archived-c");
        archivedFlag.status = FlagStatus.ARCHIVED;
        ConfigModels.ProjectConfig cfg = makeConfig(
                makeFlag("active-a"), makeFlag("active-b"), archivedFlag);

        Map<String, Decision> decisions = Evaluator.evaluateAllFlags(cfg, "user-1", null);
        assertEquals(2, decisions.size());
        assertTrue(decisions.containsKey("active-a"));
        assertTrue(decisions.containsKey("active-b"));
        assertFalse(decisions.containsKey("archived-c"));
    }

    @Test
    void evaluateAllIncludesFlagKeyOnEachDecision() {
        ConfigModels.ProjectConfig cfg = makeConfig(makeFlag("active-a"), makeFlag("active-b"));

        Map<String, Decision> decisions = Evaluator.evaluateAllFlags(cfg, "user-1", null);
        assertTrue(decisions.containsKey("active-a"));
        assertEquals("active-a", decisions.get("active-a").flagKey());
        assertTrue(decisions.containsKey("active-b"));
        assertEquals("active-b", decisions.get("active-b").flagKey());
    }
}
