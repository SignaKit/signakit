package com.signakit.flags;

import com.signakit.flags.config.ConfigManager;
import com.signakit.flags.config.ConfigModels;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ConfigManagerTest {

    @Test
    void parseSdkKey_dev() {
        ConfigManager.ParsedSdkKey p = ConfigManager.parseSdkKey("sk_dev_org123_proj456_random");
        assertEquals("org123", p.orgId());
        assertEquals("proj456", p.projectId());
        assertEquals(ConfigModels.Environment.DEVELOPMENT, p.environment());
    }

    @Test
    void parseSdkKey_prod() {
        ConfigManager.ParsedSdkKey p = ConfigManager.parseSdkKey("sk_prod_org_proj_xyz");
        assertEquals(ConfigModels.Environment.PRODUCTION, p.environment());
    }

    @Test
    void parseSdkKey_invalidPrefix() {
        assertThrows(IllegalArgumentException.class,
                () -> ConfigManager.parseSdkKey("xx_dev_org_proj_random"));
    }

    @Test
    void parseSdkKey_invalidEnv() {
        assertThrows(IllegalArgumentException.class,
                () -> ConfigManager.parseSdkKey("sk_staging_org_proj_random"));
    }

    @Test
    void parseSdkKey_tooShort() {
        assertThrows(IllegalArgumentException.class,
                () -> ConfigManager.parseSdkKey("sk_dev_org_proj"));
    }
}
