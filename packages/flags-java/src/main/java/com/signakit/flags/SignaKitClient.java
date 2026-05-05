package com.signakit.flags;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.signakit.flags.config.ConfigManager;
import com.signakit.flags.config.ConfigModels;
import com.signakit.flags.evaluator.Evaluator;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Top-level SDK entry point. Mirrors the public surface of
 * {@code packages/flags-node/src/client.ts}.
 */
public class SignaKitClient implements AutoCloseable {

    private final String sdkKey;
    private final ConfigManager configManager;
    private final HttpClient httpClient;
    private final ObjectMapper mapper;
    private final Duration pollingInterval;
    private final ScheduledExecutorService scheduler;
    private volatile boolean ready;

    public SignaKitClient(SignaKitClientConfig config) {
        Objects.requireNonNull(config, "config");
        if (config.sdkKey() == null || config.sdkKey().isEmpty()) {
            throw new IllegalArgumentException("[SignaKit] sdkKey is required");
        }
        this.sdkKey = config.sdkKey();
        this.httpClient = config.httpClient() != null
                ? config.httpClient()
                : HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        this.mapper = new ObjectMapper();
        this.pollingInterval = config.pollingInterval() != null
                ? config.pollingInterval()
                : Duration.ofSeconds(Constants.DEFAULT_POLLING_INTERVAL_SECONDS);

        ConfigManager.ParsedSdkKey parsed = ConfigManager.parseSdkKey(sdkKey);
        this.configManager = new ConfigManager(
                parsed.orgId(), parsed.projectId(), parsed.environment(), this.httpClient, this.mapper);

        // Daemon thread: never prevents JVM shutdown
        this.scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "signakit-polling");
            t.setDaemon(true);
            return t;
        });
    }

    /** Test/internal seam: build a client wired to a pre-built ConfigManager. Polling disabled. */
    SignaKitClient(String sdkKey, ConfigManager configManager, HttpClient httpClient) {
        this.sdkKey = sdkKey;
        this.configManager = configManager;
        this.httpClient = httpClient;
        this.mapper = new ObjectMapper();
        this.pollingInterval = Duration.ZERO;
        this.scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "signakit-polling");
            t.setDaemon(true);
            return t;
        });
    }

    /**
     * Synchronously fetch the config and start background polling.
     * Returns {@code true} on success, {@code false} if the fetch fails.
     */
    public boolean onReady() {
        try {
            configManager.fetchConfig();
            ready = true;
            startPolling();
            return true;
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            System.err.println("[SignaKit] onReady failed: " + e.getMessage());
            return false;
        }
    }

    private void startPolling() {
        if (pollingInterval.isZero() || pollingInterval.isNegative()) return;
        long intervalMs = pollingInterval.toMillis();
        scheduler.scheduleAtFixedRate(() -> {
            try {
                configManager.fetchConfig();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (Exception e) {
                // Polling errors are silent — stale config is better than a crash
            }
        }, intervalMs, intervalMs, TimeUnit.MILLISECONDS);
    }

    /**
     * Stop the background polling thread.
     * Implements {@link AutoCloseable} so clients can be used in try-with-resources.
     */
    @Override
    public void close() {
        scheduler.shutdownNow();
    }

    public CompletableFuture<Boolean> onReadyAsync() {
        return CompletableFuture.supplyAsync(this::onReady);
    }

    /**
     * Create a user context. Returns {@code null} if the client has not been made
     * ready yet via {@link #onReady()}.
     */
    public SignaKitUserContext createUserContext(String userId, UserAttributes attributes) {
        if (!ready) {
            System.err.println("[SignaKit] SignaKitClient is not ready. Call onReady() first.");
            return null;
        }
        return new SignaKitUserContext(this, userId, attributes == null ? UserAttributes.empty() : attributes);
    }

    public SignaKitUserContext createUserContext(String userId) {
        return createUserContext(userId, UserAttributes.empty());
    }

    // ---------------------------------------------------------------------
    // Internal API used by SignaKitUserContext
    // ---------------------------------------------------------------------

    Decision evaluateFlag(String flagKey, String userId, Map<String, Object> attributes) {
        ConfigModels.ProjectConfig config = configManager.getConfig();
        if (config == null) {
            System.err.println("[SignaKit] No config available");
            return null;
        }
        if (config.flags == null) return null;
        for (ConfigModels.ConfigFlag flag : config.flags) {
            if (flagKey.equals(flag.key)) {
                return Evaluator.evaluateFlag(flag, userId, attributes);
            }
        }
        System.err.println("[SignaKit] Flag not found: " + flagKey);
        return null;
    }

    Map<String, Decision> evaluateAllFlags(String userId, Map<String, Object> attributes) {
        ConfigModels.ProjectConfig config = configManager.getConfig();
        if (config == null) return Map.of();
        return Evaluator.evaluateAllFlags(config, userId, attributes);
    }

    Map<String, Decision> getBotDecisions() {
        ConfigModels.ProjectConfig config = configManager.getConfig();
        if (config == null || config.flags == null) return Map.of();
        Map<String, Decision> out = new LinkedHashMap<>();
        for (ConfigModels.ConfigFlag flag : config.flags) {
            if (flag.status != ConfigModels.FlagStatus.ARCHIVED) {
                out.put(flag.key, new Decision(flag.key, "off", false, null, null, Map.of()));
            }
        }
        return out;
    }

    /**
     * POST a single event to the events endpoint as
     * {@code {"events": [event]}}. Best-effort: errors are logged.
     */
    CompletableFuture<Void> sendEvent(Map<String, Object> event) {
        return CompletableFuture.runAsync(() -> {
            try {
                Map<String, Object> body = Map.of("events", java.util.List.of(event));
                String json = mapper.writeValueAsString(body);

                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create(Constants.SIGNAKIT_EVENTS_URL))
                        .timeout(Duration.ofSeconds(10))
                        .header("Content-Type", "application/json")
                        .header("X-SDK-Key", sdkKey)
                        .POST(HttpRequest.BodyPublishers.ofString(json))
                        .build();

                HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
                if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                    System.err.println("[SignaKit] Failed to send event: HTTP " + resp.statusCode());
                }
            } catch (IOException e) {
                System.err.println("[SignaKit] Failed to send event: " + e.getMessage());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });
    }

    String sdkKey() {
        return sdkKey;
    }

    /** Mark the client as ready. Used in tests when wiring a pre-loaded config. */
    void markReady() {
        this.ready = true;
    }
}
