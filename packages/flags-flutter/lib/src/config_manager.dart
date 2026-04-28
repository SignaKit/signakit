/// Config Manager — fetches and caches the project config from CloudFront.
///
/// Mirrors `packages/flags-node/src/config-manager.ts`.
library;

import 'dart:convert';

import 'package:http/http.dart' as http;

import 'constants.dart';
import 'types.dart';

/// Parses an SDK key.
///
/// Format: `sk_{env}_{orgId}_{projectId}_{random}`
/// - `env`: `'dev'` → `Environment.development`; `'prod'` → `Environment.production`
class ParsedSdkKey {
  const ParsedSdkKey({
    required this.orgId,
    required this.projectId,
    required this.environment,
  });

  final String orgId;
  final String projectId;
  final Environment environment;
}

ParsedSdkKey parseSdkKey(String sdkKey) {
  final parts = sdkKey.split('_');

  if (parts.length < 5 || parts[0] != 'sk') {
    throw ArgumentError(
      '[SignaKit] Invalid SDK key format. Expected: sk_{env}_{orgId}_{projectId}_{random}, got: $sdkKey',
    );
  }

  final envShort = parts[1];
  final orgId = parts[2];
  final projectId = parts[3];

  if (envShort.isEmpty || orgId.isEmpty || projectId.isEmpty) {
    throw ArgumentError(
      '[SignaKit] Invalid SDK key format. Could not extract environment, orgId, or projectId.',
    );
  }

  final Environment environment;
  switch (envShort) {
    case 'dev':
      environment = Environment.development;
      break;
    case 'prod':
      environment = Environment.production;
      break;
    default:
      throw ArgumentError(
        "[SignaKit] Invalid SDK key environment. Expected 'dev' or 'prod', got: $envShort",
      );
  }

  return ParsedSdkKey(
    orgId: orgId,
    projectId: projectId,
    environment: environment,
  );
}

/// Fetches and caches the project config.
class ConfigManager {
  ConfigManager({
    required this.orgId,
    required this.projectId,
    required this.environment,
    http.Client? httpClient,
  }) : _httpClient = httpClient ?? http.Client();

  final String orgId;
  final String projectId;
  final Environment environment;
  final http.Client _httpClient;

  ProjectConfig? _config;
  String? _etag;

  String _getConfigUrl() {
    final base = kSignaKitCdnUrl.replaceAll(RegExp(r'/$'), '');
    return '$base/configs/$orgId/$projectId/${environment.value}/latest.json';
  }

  /// Fetch the config from CloudFront. Uses ETag / `If-None-Match`.
  ///
  /// Returns the cached config on `304 Not Modified`.
  Future<ProjectConfig> fetchConfig() async {
    final url = Uri.parse(_getConfigUrl());

    final headers = <String, String>{'Accept': 'application/json'};
    final etag = _etag;
    if (etag != null) headers['If-None-Match'] = etag;

    final response = await _httpClient.get(url, headers: headers);

    final cached = _config;
    if (response.statusCode == 304 && cached != null) {
      return cached;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(
        '[SignaKit] Failed to fetch config: ${response.statusCode} ${response.reasonPhrase ?? ''}',
      );
    }

    final newEtag = response.headers['etag'];
    if (newEtag != null) _etag = newEtag;

    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, Object?>) {
      throw StateError('[SignaKit] Invalid config response (not a JSON object)');
    }

    final config = ProjectConfig.fromJson(decoded);
    _config = config;
    return config;
  }

  /// Currently cached config, or `null` if not yet fetched.
  ProjectConfig? getConfig() => _config;

  /// Closes the underlying HTTP client.
  void close() {
    _httpClient.close();
  }
}
