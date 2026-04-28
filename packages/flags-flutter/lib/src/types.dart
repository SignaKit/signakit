/// SignaKit Feature Flags SDK types.
///
/// Mirrors `packages/flags-node/src/types.ts`.

/// Environment derived from the SDK key.
enum Environment {
  development,
  production;

  String get value => switch (this) {
        Environment.development => 'development',
        Environment.production => 'production',
      };
}

/// Rule type that produced a decision.
///
/// `'targeted'` rules are simple feature-flag rollouts — the SDK skips
/// `$exposure` events for them since there is no experiment to attribute.
enum RuleType {
  abTest,
  multiArmedBandit,
  targeted;

  String get value => switch (this) {
        RuleType.abTest => 'ab-test',
        RuleType.multiArmedBandit => 'multi-armed-bandit',
        RuleType.targeted => 'targeted',
      };

  static RuleType? fromString(String? value) {
    return switch (value) {
      'ab-test' => RuleType.abTest,
      'multi-armed-bandit' => RuleType.multiArmedBandit,
      'targeted' => RuleType.targeted,
      _ => null,
    };
  }
}

/// Audience match type: 'any' (OR) or 'all' (AND).
enum AudienceMatchType {
  any,
  all;

  static AudienceMatchType? fromString(String? value) {
    return switch (value) {
      'any' => AudienceMatchType.any,
      'all' => AudienceMatchType.all,
      _ => null,
    };
  }
}

/// Flag status.
enum FlagStatus {
  active,
  archived;

  static FlagStatus fromString(String? value) {
    return value == 'archived' ? FlagStatus.archived : FlagStatus.active;
  }
}

/// User attributes used for audience targeting.
///
/// The special key `\$userAgent` is used for bot detection — when a bot is
/// detected, all flags return `'off'` and events are skipped. The
/// `\$userAgent` attribute is stripped before targeting evaluation.
typedef UserAttributes = Map<String, Object?>;

/// Variable value type. `String`, `num`, `bool`, or `Map<String, Object?>` (json).
typedef VariableValue = Object;

/// Flag-level variable definition with default value.
class FlagVariable {
  const FlagVariable({
    required this.key,
    required this.type,
    required this.defaultValue,
  });

  final String key;

  /// One of: 'string', 'number', 'boolean', 'json'.
  final String type;
  final VariableValue defaultValue;

  factory FlagVariable.fromJson(Map<String, Object?> json) {
    return FlagVariable(
      key: json['key']! as String,
      type: json['type']! as String,
      defaultValue: json['defaultValue']! as VariableValue,
    );
  }
}

/// Variation definition.
class Variation {
  const Variation({required this.key, this.variables});

  final String key;
  final Map<String, VariableValue>? variables;

  factory Variation.fromJson(Map<String, Object?> json) {
    final rawVars = json['variables'] as Map<String, Object?>?;
    return Variation(
      key: json['key']! as String,
      variables: rawVars == null
          ? null
          : rawVars.map(
              (k, v) => MapEntry(k, v! as VariableValue),
            ),
    );
  }
}

/// One range within a variation allocation.
class VariationAllocationRange {
  const VariationAllocationRange({
    required this.variation,
    required this.start,
    required this.end,
  });

  final String variation;
  final int start;
  final int end;

  factory VariationAllocationRange.fromJson(Map<String, Object?> json) {
    return VariationAllocationRange(
      variation: json['variation']! as String,
      start: (json['start']! as num).toInt(),
      end: (json['end']! as num).toInt(),
    );
  }
}

/// Allocation = list of bucket ranges.
class VariationAllocation {
  const VariationAllocation({required this.ranges});

  final List<VariationAllocationRange> ranges;

  factory VariationAllocation.fromJson(Map<String, Object?> json) {
    final ranges = (json['ranges'] as List<Object?>? ?? const <Object?>[])
        .map((r) => VariationAllocationRange.fromJson(r! as Map<String, Object?>))
        .toList(growable: false);
    return VariationAllocation(ranges: ranges);
  }
}

/// One audience condition.
class AudienceCondition {
  const AudienceCondition({
    required this.attribute,
    required this.operator,
    required this.value,
  });

  final String attribute;

  /// One of:
  /// 'equals', 'not_equals', 'greater_than', 'less_than',
  /// 'greater_than_or_equals', 'less_than_or_equals',
  /// 'in', 'not_in', 'contains', 'not_contains'.
  final String operator;

  /// `String`, `num`, `bool`, or `List<String>`.
  final Object? value;

  factory AudienceCondition.fromJson(Map<String, Object?> json) {
    return AudienceCondition(
      attribute: json['attribute']! as String,
      operator: json['operator']! as String,
      value: json['value'],
    );
  }
}

/// Audience = group of conditions, all must match (AND).
class ConfigRuleAudience {
  const ConfigRuleAudience({required this.conditions});

  final List<AudienceCondition> conditions;

  factory ConfigRuleAudience.fromJson(Map<String, Object?> json) {
    final conds = (json['conditions'] as List<Object?>? ?? const <Object?>[])
        .map((c) => AudienceCondition.fromJson(c! as Map<String, Object?>))
        .toList(growable: false);
    return ConfigRuleAudience(conditions: conds);
  }
}

/// Allowlist override — user gets a fixed variation.
class AllowlistEntry {
  const AllowlistEntry({required this.userId, required this.variation});

  final String userId;
  final String variation;

  factory AllowlistEntry.fromJson(Map<String, Object?> json) {
    return AllowlistEntry(
      userId: json['userId']! as String,
      variation: json['variation']! as String,
    );
  }
}

/// One rule in a flag.
class ConfigRule {
  const ConfigRule({
    required this.ruleKey,
    required this.ruleType,
    required this.trafficPercentage,
    required this.variationAllocation,
    this.audienceMatchType,
    this.audiences,
    this.allowlist,
  });

  final String ruleKey;
  final RuleType ruleType;
  final AudienceMatchType? audienceMatchType;
  final List<ConfigRuleAudience>? audiences;
  final num trafficPercentage;
  final VariationAllocation variationAllocation;
  final List<AllowlistEntry>? allowlist;

  factory ConfigRule.fromJson(Map<String, Object?> json) {
    final rawAudiences = json['audiences'] as List<Object?>?;
    final rawAllowlist = json['allowlist'] as List<Object?>?;

    return ConfigRule(
      ruleKey: json['ruleKey']! as String,
      ruleType: RuleType.fromString(json['ruleType'] as String?) ?? RuleType.targeted,
      audienceMatchType:
          AudienceMatchType.fromString(json['audienceMatchType'] as String?),
      audiences: rawAudiences
          ?.map((a) => ConfigRuleAudience.fromJson(a! as Map<String, Object?>))
          .toList(growable: false),
      trafficPercentage: (json['trafficPercentage'] as num?) ?? 0,
      variationAllocation: VariationAllocation.fromJson(
        json['variationAllocation']! as Map<String, Object?>,
      ),
      allowlist: rawAllowlist
          ?.map((e) => AllowlistEntry.fromJson(e! as Map<String, Object?>))
          .toList(growable: false),
    );
  }
}

/// One flag in the project config.
class ConfigFlag {
  const ConfigFlag({
    required this.id,
    required this.key,
    required this.variations,
    required this.allocation,
    required this.salt,
    required this.status,
    required this.running,
    this.variables,
    this.rules,
  });

  final String id;
  final String key;
  final List<Variation> variations;
  final List<FlagVariable>? variables;
  final VariationAllocation allocation;
  final String salt;
  final FlagStatus status;
  final bool running;
  final List<ConfigRule>? rules;

  factory ConfigFlag.fromJson(Map<String, Object?> json) {
    final rawVariables = json['variables'] as List<Object?>?;
    final rawRules = json['rules'] as List<Object?>?;

    return ConfigFlag(
      id: json['id']! as String,
      key: json['key']! as String,
      variations: (json['variations'] as List<Object?>? ?? const <Object?>[])
          .map((v) => Variation.fromJson(v! as Map<String, Object?>))
          .toList(growable: false),
      variables: rawVariables
          ?.map((v) => FlagVariable.fromJson(v! as Map<String, Object?>))
          .toList(growable: false),
      allocation: VariationAllocation.fromJson(
        json['allocation']! as Map<String, Object?>,
      ),
      salt: json['salt']! as String,
      status: FlagStatus.fromString(json['status'] as String?),
      running: (json['running'] as bool?) ?? false,
      rules: rawRules
          ?.map((r) => ConfigRule.fromJson(r! as Map<String, Object?>))
          .toList(growable: false),
    );
  }
}

/// The full project config fetched from the CDN.
class ProjectConfig {
  const ProjectConfig({
    required this.projectId,
    required this.environmentKey,
    required this.sdkKey,
    required this.version,
    required this.flags,
    required this.generatedAt,
  });

  final String projectId;
  final Environment environmentKey;
  final String sdkKey;
  final int version;
  final List<ConfigFlag> flags;
  final String generatedAt;

  factory ProjectConfig.fromJson(Map<String, Object?> json) {
    final envStr = json['environmentKey'] as String?;
    final env = envStr == 'production'
        ? Environment.production
        : Environment.development;
    return ProjectConfig(
      projectId: json['projectId']! as String,
      environmentKey: env,
      sdkKey: json['sdkKey']! as String,
      version: (json['version'] as num?)?.toInt() ?? 0,
      flags: (json['flags'] as List<Object?>? ?? const <Object?>[])
          .map((f) => ConfigFlag.fromJson(f! as Map<String, Object?>))
          .toList(growable: false),
      generatedAt: (json['generatedAt'] as String?) ?? '',
    );
  }
}

/// Result of `client.onReady()`.
class OnReadyResult {
  const OnReadyResult({required this.success, this.reason});

  final bool success;
  final String? reason;
}

/// A single tracking event sent to the events API.
class SignaKitEvent {
  const SignaKitEvent({
    required this.eventKey,
    required this.userId,
    required this.timestamp,
    this.attributes,
    this.decisions,
    this.value,
    this.metadata,
  });

  final String eventKey;
  final String userId;

  /// ISO 8601 UTC timestamp.
  final String timestamp;
  final UserAttributes? attributes;
  final Map<String, String>? decisions;
  final num? value;
  final Map<String, Object?>? metadata;

  Map<String, Object?> toJson() {
    final out = <String, Object?>{
      'eventKey': eventKey,
      'userId': userId,
      'timestamp': timestamp,
    };
    if (attributes != null) out['attributes'] = attributes;
    if (decisions != null) out['decisions'] = decisions;
    if (value != null) out['value'] = value;
    if (metadata != null) out['metadata'] = metadata;
    return out;
  }
}

/// Options for `userContext.trackEvent`.
class TrackEventOptions {
  const TrackEventOptions({this.value, this.metadata});

  final num? value;
  final Map<String, Object?>? metadata;
}
