package com.signakit.flags.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.signakit.flags.Constants;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Fetches and caches a project's config JSON from CloudFront.
 *
 * <p>Uses ETag / {@code If-None-Match} for conditional requests; on a 304 the
 * cached config is returned. Thread-safe via {@link AtomicReference}.
 */
public class ConfigManager {

    public record ParsedSdkKey(String orgId, String projectId, ConfigModels.Environment environment) {}

    /**
     * Parse an SDK key of the form {@code sk_{env}_{orgId}_{projectId}_{random}}.
     * {@code dev} maps to {@code development}, {@code prod} to {@code production}.
     */
    public static ParsedSdkKey parseSdkKey(String sdkKey) {
        Objects.requireNonNull(sdkKey, "sdkKey");
        String[] parts = sdkKey.split("_");
        if (parts.length < 5 || !"sk".equals(parts[0])) {
            throw new IllegalArgumentException(
                    "[SignaKit] Invalid SDK key format. Expected: sk_{env}_{orgId}_{projectId}_{random}, got: "
                            + sdkKey);
        }
        String envShort = parts[1];
        String orgId = parts[2];
        String projectId = parts[3];
        if (envShort == null || envShort.isEmpty() || orgId == null || orgId.isEmpty()
                || projectId == null || projectId.isEmpty()) {
            throw new IllegalArgumentException(
                    "[SignaKit] Invalid SDK key format. Could not extract environment, orgId, or projectId.");
        }
        ConfigModels.Environment environment = switch (envShort) {
            case "dev" -> ConfigModels.Environment.DEVELOPMENT;
            case "prod" -> ConfigModels.Environment.PRODUCTION;
            default -> throw new IllegalArgumentException(
                    "[SignaKit] Invalid SDK key environment. Expected 'dev' or 'prod', got: " + envShort);
        };
        return new ParsedSdkKey(orgId, projectId, environment);
    }

    private final String orgId;
    private final String projectId;
    private final ConfigModels.Environment environment;
    private final HttpClient httpClient;
    private final ObjectMapper mapper;

    private final AtomicReference<ConfigModels.ProjectConfig> config = new AtomicReference<>(null);
    private final AtomicReference<String> etag = new AtomicReference<>(null);

    public ConfigManager(String orgId, String projectId, ConfigModels.Environment environment) {
        this(orgId, projectId, environment, defaultHttpClient(), new ObjectMapper());
    }

    public ConfigManager(
            String orgId,
            String projectId,
            ConfigModels.Environment environment,
            HttpClient httpClient,
            ObjectMapper mapper) {
        this.orgId = Objects.requireNonNull(orgId);
        this.projectId = Objects.requireNonNull(projectId);
        this.environment = Objects.requireNonNull(environment);
        this.httpClient = Objects.requireNonNull(httpClient);
        this.mapper = Objects.requireNonNull(mapper);
    }

    private static HttpClient defaultHttpClient() {
        return HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    String getConfigUrl() {
        String base = Constants.SIGNAKIT_CDN_URL.replaceAll("/+$", "");
        return base + "/configs/" + orgId + "/" + projectId + "/" + environment.wire() + "/latest.json";
    }

    /**
     * Fetch the latest config. On a 304 response the cached config is returned.
     */
    public ConfigModels.ProjectConfig fetchConfig() throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(getConfigUrl()))
                .timeout(Duration.ofSeconds(15))
                .header("Accept", "application/json")
                .GET();

        String currentEtag = etag.get();
        if (currentEtag != null) {
            builder.header("If-None-Match", currentEtag);
        }

        HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        int status = response.statusCode();

        ConfigModels.ProjectConfig cached = config.get();
        if (status == 304 && cached != null) {
            return cached;
        }

        if (status < 200 || status >= 300) {
            throw new IOException("[SignaKit] Failed to fetch config: HTTP " + status);
        }

        response.headers().firstValue("etag").ifPresent(etag::set);

        ConfigModels.ProjectConfig parsed = mapper.readValue(response.body(), ConfigModels.ProjectConfig.class);
        config.set(parsed);
        return parsed;
    }

    public ConfigModels.ProjectConfig getConfig() {
        return config.get();
    }
}
