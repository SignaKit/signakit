/// User context for evaluating flags.
///
/// Mirrors `SignaKitUserContext` from `packages/flags-node/src/client.ts`.
library;

import 'dart:convert';

import 'bot_patterns.dart';
import 'client.dart';
import 'constants.dart';
import 'decision.dart';
import 'types.dart';

UserAttributes? _sanitizeAttributes(UserAttributes? attributes) {
  if (attributes == null || attributes.isEmpty) return null;

  final out = <String, Object?>{};
  final keys = attributes.keys.take(kMaxAttributesCount);

  for (final key in keys) {
    final sKey = key.length > kMaxAttributeKeyLength
        ? key.substring(0, kMaxAttributeKeyLength)
        : key;
    final value = attributes[key];

    if (value == null) continue;
    if (value is String) {
      out[sKey] = value.length > kMaxAttributeValueLength
          ? value.substring(0, kMaxAttributeValueLength)
          : value;
    } else if (value is List) {
      // Limit list size to 100, truncate string values.
      final limited = value.take(100).map((v) {
        if (v is String && v.length > kMaxAttributeValueLength) {
          return v.substring(0, kMaxAttributeValueLength);
        }
        return v;
      }).toList(growable: false);
      out[sKey] = limited;
    } else {
      out[sKey] = value;
    }
  }

  return out;
}

String _truncate(String value, int max) {
  if (value.length <= max) return value;
  return value.substring(0, max);
}

class SignaKitUserContext {
  SignaKitUserContext({
    required SignaKitClient client,
    required this.userId,
    UserAttributes attributes = const <String, Object?>{},
  })  : _client = client,
        _isBot = isBot(attributes[r'$userAgent'] as String?),
        // Strip $userAgent — not used for targeting.
        attributes = Map<String, Object?>.from(attributes)..remove(r'$userAgent');

  final SignaKitClient _client;
  final String userId;
  final UserAttributes attributes;
  final bool _isBot;

  /// Cached variation keys (flagKey → variationKey) for event attribution.
  Map<String, String>? _cachedDecisions;

  /// Fire-and-forget exposure tracking.
  ///
  /// Skipped for `'targeted'` rules — those are simple feature-flag rollouts
  /// with no experiment to attribute, so exposures would just be noise.
  void _trackExposure(Decision decision) {
    if (decision.ruleType == RuleType.targeted) return;

    final event = SignaKitEvent(
      eventKey: r'$exposure',
      userId: _truncate(userId, kMaxUserIdLength),
      timestamp: DateTime.now().toUtc().toIso8601String(),
      decisions: <String, String>{decision.flagKey: decision.variationKey},
      metadata: <String, Object?>{
        'flagKey': decision.flagKey,
        'variationKey': decision.variationKey,
        'ruleKey': decision.ruleKey,
      },
      attributes: _sanitizeAttributes(attributes),
    );

    // Fire-and-forget: errors are silently ignored.
    // ignore: discarded_futures
    _client.sendEventInternal(event).catchError((Object _) {});
  }

  /// Evaluate a single flag for this user.
  ///
  /// Returns `null` if the flag is not found or archived.
  Decision? decide(String flagKey) {
    if (_isBot) {
      return Decision(
        flagKey: flagKey,
        variationKey: 'off',
        enabled: false,
        ruleKey: null,
        ruleType: null,
        variables: const <String, VariableValue>{},
      );
    }

    final decision = _client.evaluateFlagInternal(flagKey, userId, attributes);
    if (decision != null) {
      (_cachedDecisions ??= <String, String>{})[flagKey] = decision.variationKey;
      _trackExposure(decision);
    }
    return decision;
  }

  /// Evaluate all flags for this user.
  Decisions decideAll() {
    if (_isBot) return _client.getBotDecisionsInternal();

    final decisions = _client.evaluateAllFlagsInternal(userId, attributes);

    final cache = <String, String>{};
    for (final entry in decisions.entries) {
      cache[entry.key] = entry.value.variationKey;
      _trackExposure(entry.value);
    }
    _cachedDecisions = cache;
    return decisions;
  }

  /// Track a conversion event for this user.
  Future<void> trackEvent(
    String eventKey, {
    num? value,
    Map<String, Object?>? metadata,
  }) async {
    if (_isBot) return;

    final sEventKey = _truncate(eventKey, kMaxEventKeyLength);
    final sUserId = _truncate(userId, kMaxUserIdLength);

    Map<String, Object?>? acceptedMetadata;
    if (metadata != null) {
      final encoded = jsonEncode(metadata);
      if (encoded.length <= kMaxMetadataSizeBytes) {
        acceptedMetadata = metadata;
      }
      // else: silently dropped (mirrors TS warn-and-drop)
    }

    final event = SignaKitEvent(
      eventKey: sEventKey,
      userId: sUserId,
      timestamp: DateTime.now().toUtc().toIso8601String(),
      attributes: _sanitizeAttributes(attributes),
      decisions: (_cachedDecisions != null && _cachedDecisions!.isNotEmpty)
          ? Map<String, String>.from(_cachedDecisions!)
          : null,
      value: value,
      metadata: acceptedMetadata,
    );

    await _client.sendEventInternal(event);
  }
}
