/// Flag evaluation logic.
///
/// Mirrors `packages/flags-node/src/evaluator.ts`.
library;

import 'audience_matcher.dart';
import 'constants.dart';
import 'decision.dart';
import 'hasher.dart';
import 'types.dart';

String? _findVariationInRanges(VariationAllocation allocation, int bucket) {
  for (final range in allocation.ranges) {
    if (bucket >= range.start && bucket <= range.end) {
      return range.variation;
    }
  }
  return null;
}

Map<String, VariableValue> _resolveVariables(ConfigFlag flag, String variationKey) {
  final defs = flag.variables;
  if (defs == null || defs.isEmpty) return const <String, VariableValue>{};

  final variation = flag.variations.cast<Variation?>().firstWhere(
        (v) => v?.key == variationKey,
        orElse: () => null,
      );
  final overrides = variation?.variables ?? const <String, VariableValue>{};

  final resolved = <String, VariableValue>{};
  for (final def in defs) {
    final override = overrides[def.key];
    resolved[def.key] = override ?? def.defaultValue;
  }
  return resolved;
}

/// Evaluate a single flag for a user.
///
/// Returns `null` if the flag is archived.
Decision? evaluateFlag(
  ConfigFlag flag,
  String userId,
  UserAttributes? attributes,
) {
  // 1. Archived → skip entirely.
  if (flag.status == FlagStatus.archived) return null;

  // 2. Not running → off, disabled.
  if (!flag.running) {
    return Decision(
      flagKey: flag.key,
      variationKey: 'off',
      enabled: false,
      ruleKey: null,
      ruleType: null,
      variables: _resolveVariables(flag, 'off'),
    );
  }

  // 3. Evaluate rules in order.
  final rules = flag.rules ?? const <ConfigRule>[];
  for (final rule in rules) {
    // 3a. Allowlist takes precedence — match wins immediately.
    final allowlist = rule.allowlist;
    if (allowlist != null && allowlist.isNotEmpty) {
      for (final entry in allowlist) {
        if (entry.userId == userId) {
          return Decision(
            flagKey: flag.key,
            variationKey: entry.variation,
            enabled: entry.variation != 'off',
            ruleKey: rule.ruleKey,
            ruleType: rule.ruleType,
            variables: _resolveVariables(flag, entry.variation),
          );
        }
      }
    }

    // 3b. Audience match.
    if (matchesAudiences(rule.audiences, rule.audienceMatchType, attributes)) {
      final trafficBucket = hashForTraffic(flag.salt, userId);
      final trafficThreshold =
          ((rule.trafficPercentage / 100) * kBucketSpace).floor();

      if (trafficBucket < trafficThreshold) {
        final variationBucket = hashForVariation(flag.salt, userId);
        final variation =
            _findVariationInRanges(rule.variationAllocation, variationBucket);
        if (variation != null) {
          return Decision(
            flagKey: flag.key,
            variationKey: variation,
            enabled: variation != 'off',
            ruleKey: rule.ruleKey,
            ruleType: rule.ruleType,
            variables: _resolveVariables(flag, variation),
          );
        }
      }
    }
  }

  // 4. Default allocation.
  final defaultBucket = hashForDefault(flag.salt, userId);
  final defaultVariation = _findVariationInRanges(flag.allocation, defaultBucket);

  if (defaultVariation != null) {
    return Decision(
      flagKey: flag.key,
      variationKey: defaultVariation,
      enabled: defaultVariation != 'off',
      ruleKey: null,
      ruleType: null,
      variables: _resolveVariables(flag, defaultVariation),
    );
  }

  // Fallback to off.
  return Decision(
    flagKey: flag.key,
    variationKey: 'off',
    enabled: false,
    ruleKey: null,
    ruleType: null,
    variables: _resolveVariables(flag, 'off'),
  );
}

/// Evaluate every flag in [config] for the user.
Decisions evaluateAllFlags(
  ProjectConfig config,
  String userId,
  UserAttributes? attributes,
) {
  final out = <String, Decision>{};
  for (final flag in config.flags) {
    final result = evaluateFlag(flag, userId, attributes);
    if (result != null) out[flag.key] = result;
  }
  return out;
}
