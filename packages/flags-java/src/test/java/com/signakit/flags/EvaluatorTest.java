package com.signakit.flags;

import com.signakit.flags.config.ConfigModels;
import com.signakit.flags.config.ConfigModels.AllowlistEntry;
import com.signakit.flags.config.ConfigModels.ConfigFlag;
import com.signakit.flags.config.ConfigModels.ConfigRule;
import com.signakit.flags.config.ConfigModels.FlagStatus;
import com.signakit.flags.config.ConfigModels.Variation;
import com.signakit.flags.config.ConfigModels.VariationAllocation;
import com.signakit.flags.config.ConfigModels.VariationAllocationRange;
import com.signakit.flags.evaluator.Evaluator;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EvaluatorTest {

    private static VariationAllocationRange range(String var, int start, int end) {
        VariationAllocationRange r = new VariationAllocationRange();
        r.variation = var;
        r.start = start;
        r.end = end;
        return r;
    }

    private static VariationAllocation alloc(VariationAllocationRange... ranges) {
        VariationAllocation a = new VariationAllocation();
        a.ranges = List.of(ranges);
        return a;
    }

    private static Variation variation(String key) {
        Variation v = new Variation();
        v.key = key;
        return v;
    }

    private static ConfigFlag baseFlag() {
        ConfigFlag f = new ConfigFlag();
        f.id = "f1";
        f.key = "my-flag";
        f.salt = "my-flag-salt";
        f.status = FlagStatus.ACTIVE;
        f.running = true;
        f.variations = List.of(variation("control"), variation("treatment"), variation("off"));
        f.allocation = alloc(range("control", 0, 9999));
        return f;
    }

    @Test
    void archivedReturnsNull() {
        ConfigFlag flag = baseFlag();
        flag.status = FlagStatus.ARCHIVED;
        assertNull(Evaluator.evaluateFlag(flag, "user-1", Map.of()));
    }

    @Test
    void notRunningReturnsOff() {
        ConfigFlag flag = baseFlag();
        flag.running = false;
        Decision d = Evaluator.evaluateFlag(flag, "user-1", Map.of());
        assertNotNull(d);
        assertEquals("off", d.variationKey());
        assertFalse(d.enabled());
        assertNull(d.ruleType());
    }

    @Test
    void allowlistShortCircuits() {
        ConfigFlag flag = baseFlag();
        ConfigRule rule = new ConfigRule();
        rule.ruleKey = "qa";
        rule.ruleType = RuleType.TARGETED;
        rule.trafficPercentage = 0; // would fail traffic, but allowlist wins
        rule.variationAllocation = alloc(range("treatment", 0, 9999));
        AllowlistEntry e = new AllowlistEntry();
        e.userId = "alice";
        e.variation = "treatment";
        rule.allowlist = List.of(e);
        flag.rules = List.of(rule);

        Decision d = Evaluator.evaluateFlag(flag, "alice", Map.of());
        assertEquals("treatment", d.variationKey());
        assertTrue(d.enabled());
        assertEquals(RuleType.TARGETED, d.ruleType());
        assertEquals("qa", d.ruleKey());
    }

    @Test
    void defaultAllocation_whenNoRules() {
        ConfigFlag flag = baseFlag();
        Decision d = Evaluator.evaluateFlag(flag, "alice", Map.of());
        assertEquals("control", d.variationKey());
        assertTrue(d.enabled());
        assertNull(d.ruleKey());
        assertNull(d.ruleType());
    }

    @Test
    void trafficPercentageZero_skipsRuleAndUsesDefault() {
        ConfigFlag flag = baseFlag();
        ConfigRule rule = new ConfigRule();
        rule.ruleKey = "exp1";
        rule.ruleType = RuleType.AB_TEST;
        rule.trafficPercentage = 0;
        rule.variationAllocation = alloc(range("treatment", 0, 9999));
        flag.rules = List.of(rule);

        Decision d = Evaluator.evaluateFlag(flag, "alice", Map.of());
        assertEquals("control", d.variationKey()); // fell through to default
        assertNull(d.ruleKey());
    }

    @Test
    void trafficPercentage100_putsUserInRule() {
        ConfigFlag flag = baseFlag();
        ConfigRule rule = new ConfigRule();
        rule.ruleKey = "exp1";
        rule.ruleType = RuleType.AB_TEST;
        rule.trafficPercentage = 100;
        rule.variationAllocation = alloc(range("treatment", 0, 9999));
        flag.rules = List.of(rule);

        Decision d = Evaluator.evaluateFlag(flag, "alice", Map.of());
        assertEquals("treatment", d.variationKey());
        assertEquals("exp1", d.ruleKey());
        assertEquals(RuleType.AB_TEST, d.ruleType());
    }

    @Test
    void evaluateAllSkipsArchived() {
        ConfigFlag flag1 = baseFlag();
        ConfigFlag flag2 = baseFlag();
        flag2.key = "flag-2";
        flag2.status = FlagStatus.ARCHIVED;

        ConfigModels.ProjectConfig cfg = new ConfigModels.ProjectConfig();
        cfg.flags = List.of(flag1, flag2);
        Map<String, Decision> all = Evaluator.evaluateAllFlags(cfg, "alice", Map.of());
        assertEquals(1, all.size());
        assertTrue(all.containsKey("my-flag"));
    }
}
