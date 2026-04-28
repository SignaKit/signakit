/// SignaKit Feature Flags client for Flutter.
///
/// Mirrors `SignaKitClient` from `packages/flags-node/src/client.ts`.
library;

import 'dart:convert';

import 'package:http/http.dart' as http;

import 'config_manager.dart';
import 'constants.dart';
import 'decision.dart';
import 'evaluator.dart';
import 'types.dart';
import 'user_context.dart';

/// Configuration for [SignaKitClient].
class SignaKitClientConfig {
  const SignaKitClientConfig({
    required this.sdkKey,
    this.httpClient,
  });

  /// `sk_{env}_{orgId}_{projectId}_{random}`
  final String sdkKey;

  /// Optional injected HTTP client (used in tests).
  final http.Client? httpClient;
}

class SignaKitClient {
  SignaKitClient(SignaKitClientConfig config)
      : _sdkKey = config.sdkKey,
        _httpClient = config.httpClient ?? http.Client() {
    if (config.sdkKey.isEmpty) {
      throw ArgumentError('[SignaKit] sdkKey is required');
    }

    final parsed = parseSdkKey(config.sdkKey);
    _configManager = ConfigManager(
      orgId: parsed.orgId,
      projectId: parsed.projectId,
      environment: parsed.environment,
      httpClient: _httpClient,
    );

    _readyFuture = _initialize();
  }

  final String _sdkKey;
  final http.Client _httpClient;
  late final ConfigManager _configManager;
  late final Future<OnReadyResult> _readyFuture;
  bool _isReady = false;

  Future<OnReadyResult> _initialize() async {
    try {
      await _configManager.fetchConfig();
      _isReady = true;
      return const OnReadyResult(success: true);
    } catch (e) {
      return OnReadyResult(success: false, reason: e.toString());
    }
  }

  /// Wait for the client to finish fetching the config.
  Future<OnReadyResult> onReady() => _readyFuture;

  /// Create a user context for evaluating flags.
  ///
  /// Returns `null` if the client is not ready (call [onReady] first).
  SignaKitUserContext? createUserContext(
    String userId, {
    UserAttributes attributes = const <String, Object?>{},
  }) {
    if (!_isReady) return null;
    return SignaKitUserContext(
      client: this,
      userId: userId,
      attributes: attributes,
    );
  }

  /// Closes the underlying HTTP client. Call when the client is no longer needed.
  void close() {
    _configManager.close();
  }

  // --- Internal API used by SignaKitUserContext ---

  /// Internal: evaluate a single flag.
  Decision? evaluateFlagInternal(
    String flagKey,
    String userId,
    UserAttributes attributes,
  ) {
    final config = _configManager.getConfig();
    if (config == null) return null;

    final flag = config.flags.cast<ConfigFlag?>().firstWhere(
          (f) => f?.key == flagKey,
          orElse: () => null,
        );
    if (flag == null) return null;

    return evaluateFlag(flag, userId, attributes);
  }

  /// Internal: evaluate all flags.
  Decisions evaluateAllFlagsInternal(
    String userId,
    UserAttributes attributes,
  ) {
    final config = _configManager.getConfig();
    if (config == null) return <String, Decision>{};
    return evaluateAllFlags(config, userId, attributes);
  }

  /// Internal: bot fallback decisions.
  Decisions getBotDecisionsInternal() {
    final config = _configManager.getConfig();
    if (config == null) return <String, Decision>{};

    final out = <String, Decision>{};
    for (final flag in config.flags) {
      if (flag.status != FlagStatus.archived) {
        out[flag.key] = Decision(
          flagKey: flag.key,
          variationKey: 'off',
          enabled: false,
          ruleKey: null,
          ruleType: null,
          variables: const <String, VariableValue>{},
        );
      }
    }
    return out;
  }

  /// Internal: send an event to the events API.
  Future<void> sendEventInternal(SignaKitEvent event) async {
    try {
      final body = jsonEncode(<String, Object?>{
        'events': <Object?>[event.toJson()],
      });
      final response = await _httpClient.post(
        Uri.parse(kSignaKitEventsUrl),
        headers: <String, String>{
          'Content-Type': 'application/json',
          'X-SDK-Key': _sdkKey,
        },
        body: body,
      );
      // Non-2xx are silently ignored — never break the host app.
      if (response.statusCode < 200 || response.statusCode >= 300) {
        // ignore — fire-and-forget telemetry
      }
    } catch (_) {
      // ignore — fire-and-forget telemetry
    }
  }
}

/// Convenience constructor that returns `null` on failure.
SignaKitClient? createInstance(SignaKitClientConfig config) {
  try {
    return SignaKitClient(config);
  } catch (_) {
    return null;
  }
}
