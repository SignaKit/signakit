import 'types.dart';

/// Immutable result of evaluating a single flag for a user.
///
/// Mirrors `SignaKitDecision` from `packages/flags-node/src/types.ts`.
class Decision {
  const Decision({
    required this.flagKey,
    required this.variationKey,
    required this.enabled,
    required this.ruleKey,
    required this.ruleType,
    required this.variables,
  });

  final String flagKey;
  final String variationKey;
  final bool enabled;

  /// The rule key that produced this decision, or `null` for default/disabled paths.
  final String? ruleKey;

  /// The rule type that produced this decision, or `null` for default/disabled paths.
  final RuleType? ruleType;

  /// Resolved variable values for the matched variation.
  final Map<String, VariableValue> variables;

  Decision copyWith({
    String? flagKey,
    String? variationKey,
    bool? enabled,
    String? ruleKey,
    RuleType? ruleType,
    Map<String, VariableValue>? variables,
  }) {
    return Decision(
      flagKey: flagKey ?? this.flagKey,
      variationKey: variationKey ?? this.variationKey,
      enabled: enabled ?? this.enabled,
      ruleKey: ruleKey ?? this.ruleKey,
      ruleType: ruleType ?? this.ruleType,
      variables: variables ?? this.variables,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! Decision) return false;
    if (flagKey != other.flagKey ||
        variationKey != other.variationKey ||
        enabled != other.enabled ||
        ruleKey != other.ruleKey ||
        ruleType != other.ruleType) {
      return false;
    }
    if (variables.length != other.variables.length) return false;
    for (final entry in variables.entries) {
      if (other.variables[entry.key] != entry.value) return false;
    }
    return true;
  }

  @override
  int get hashCode => Object.hash(
        flagKey,
        variationKey,
        enabled,
        ruleKey,
        ruleType,
        Object.hashAllUnordered(variables.entries.map((e) => Object.hash(e.key, e.value))),
      );

  @override
  String toString() =>
      'Decision(flagKey: $flagKey, variationKey: $variationKey, enabled: $enabled, '
      'ruleKey: $ruleKey, ruleType: ${ruleType?.value}, variables: $variables)';
}

/// Map of flag keys to decisions.
typedef Decisions = Map<String, Decision>;
