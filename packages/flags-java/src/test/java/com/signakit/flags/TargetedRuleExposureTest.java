package com.signakit.flags;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.signakit.flags.config.ConfigManager;
import com.signakit.flags.config.ConfigModels;
import com.signakit.flags.config.ConfigModels.ConfigFlag;
import com.signakit.flags.config.ConfigModels.ConfigRule;
import com.signakit.flags.config.ConfigModels.FlagStatus;
import com.signakit.flags.config.ConfigModels.Variation;
import com.signakit.flags.config.ConfigModels.VariationAllocation;
import com.signakit.flags.config.ConfigModels.VariationAllocationRange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Hard requirement: when {@link Decision#ruleType()} is {@link RuleType#TARGETED},
 * the SDK MUST NOT fire a {@code $exposure} event. Targeted rules are simple
 * feature-flag rollouts — there is no experiment to attribute.
 */
class TargetedRuleExposureTest {

    private HttpClient httpClient;
    private SignaKitClient client;
    private AtomicInteger sendCount;

    @BeforeEach
    void setUp() throws Exception {
        httpClient = mock(HttpClient.class);
        @SuppressWarnings("unchecked")
        HttpResponse<String> okResponse = (HttpResponse<String>) mock(HttpResponse.class);
        when(okResponse.statusCode()).thenReturn(200);
        sendCount = new AtomicInteger();
        when(httpClient.send(any(HttpRequest.class), any())).thenAnswer(inv -> {
            sendCount.incrementAndGet();
            return okResponse;
        });

        ConfigManager cm = new ConfigManager(
                "org1", "proj1", ConfigModels.Environment.DEVELOPMENT, httpClient, new ObjectMapper());
        // Inject a config directly into the manager via reflection-free path: build
        // through the SignaKitClient internal constructor.
        client = new SignaKitClient("sk_dev_org1_proj1_xxxx", cm, httpClient);
        client.markReady();

        // Bootstrap the config field via fetchConfig isn't trivial without a real
        // server; instead we set it through a helper method below.
        injectConfig(cm, buildConfig());
    }

    private static void injectConfig(ConfigManager cm, ConfigModels.ProjectConfig cfg) throws Exception {
        var f = ConfigManager.class.getDeclaredField("config");
        f.setAccessible(true);
        @SuppressWarnings("unchecked")
        java.util.concurrent.atomic.AtomicReference<ConfigModels.ProjectConfig> ref =
                (java.util.concurrent.atomic.AtomicReference<ConfigModels.ProjectConfig>) f.get(cm);
        ref.set(cfg);
    }

    private static ConfigModels.ProjectConfig buildConfig() {
        ConfigFlag targetedFlag = new ConfigFlag();
        targetedFlag.id = "f-targeted";
        targetedFlag.key = "targeted-flag";
        targetedFlag.salt = "targeted-flag";
        targetedFlag.status = FlagStatus.ACTIVE;
        targetedFlag.running = true;
        Variation v1 = new Variation();
        v1.key = "treatment";
        Variation v2 = new Variation();
        v2.key = "off";
        targetedFlag.variations = List.of(v1, v2);
        VariationAllocationRange defRange = new VariationAllocationRange();
        defRange.variation = "off";
        defRange.start = 0;
        defRange.end = 9999;
        VariationAllocation defAlloc = new VariationAllocation();
        defAlloc.ranges = List.of(defRange);
        targetedFlag.allocation = defAlloc;

        ConfigRule rule = new ConfigRule();
        rule.ruleKey = "rollout";
        rule.ruleType = RuleType.TARGETED;
        rule.trafficPercentage = 100;
        VariationAllocationRange r2 = new VariationAllocationRange();
        r2.variation = "treatment";
        r2.start = 0;
        r2.end = 9999;
        VariationAllocation a = new VariationAllocation();
        a.ranges = List.of(r2);
        rule.variationAllocation = a;
        targetedFlag.rules = List.of(rule);

        ConfigFlag abFlag = new ConfigFlag();
        abFlag.id = "f-ab";
        abFlag.key = "ab-flag";
        abFlag.salt = "ab-flag";
        abFlag.status = FlagStatus.ACTIVE;
        abFlag.running = true;
        abFlag.variations = List.of(v1, v2);
        abFlag.allocation = defAlloc;
        ConfigRule abRule = new ConfigRule();
        abRule.ruleKey = "exp1";
        abRule.ruleType = RuleType.AB_TEST;
        abRule.trafficPercentage = 100;
        abRule.variationAllocation = a;
        abFlag.rules = List.of(abRule);

        ConfigModels.ProjectConfig cfg = new ConfigModels.ProjectConfig();
        cfg.flags = List.of(targetedFlag, abFlag);
        return cfg;
    }

    @Test
    void targetedRule_skipsExposure_abTestFiresExposure()
            throws IOException, InterruptedException, ExecutionException, TimeoutException {
        SignaKitUserContext ctx = client.createUserContext("user-1");
        Decision targeted = ctx.decide("targeted-flag");
        assertEquals(RuleType.TARGETED, targeted.ruleType());
        assertEquals("treatment", targeted.variationKey());

        Decision ab = ctx.decide("ab-flag");
        assertEquals(RuleType.AB_TEST, ab.ruleType());

        // Wait briefly for fire-and-forget exposure to complete.
        Thread.sleep(200);

        // Exactly one exposure call: the AB test. Targeted skipped.
        verify(httpClient, times(1)).send(any(HttpRequest.class), any());
        assertEquals(1, sendCount.get());
    }

    @Test
    void trackEvent_alwaysSends_evenWithTargetedDecisionsCached() throws Exception {
        SignaKitUserContext ctx = client.createUserContext("user-1");
        ctx.decide("targeted-flag"); // cached but no exposure

        ctx.trackEvent("signup").get(2, TimeUnit.SECONDS);
        // Only the explicit trackEvent call hit the wire.
        assertEquals(1, sendCount.get());
    }
}
