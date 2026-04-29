import 'package:flutter_test/flutter_test.dart';
import 'package:signakit_flags/src/evaluator.dart';
import 'package:signakit_flags/src/types.dart';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

VariationAllocation _alloc(List<(String, int, int)> ranges) {
  return VariationAllocation(
    ranges: ranges
        .map((r) => VariationAllocationRange(variation: r.$1, start: r.$2, end: r.$3))
        .toList(),
  );
}

VariationAllocation _full(String variation) => _alloc([(variation, 0, 9999)]);

ConfigFlag makeFlag(
  String key, {
  FlagStatus status = FlagStatus.active,
  bool running = true,
  VariationAllocation? allocation,
  List<ConfigRule>? rules,
  List<FlagVariable>? variables,
}) {
  return ConfigFlag(
    id: 'flag_$key',
    key: key,
    status: status,
    running: running,
    salt: '$key-salt',
    variations: const [Variation(key: 'off'), Variation(key: 'on')],
    allocation: allocation ?? _full('on'),
    rules: rules,
    variables: variables,
  );
}

ProjectConfig _makeConfig(List<ConfigFlag> flags) {
  return ProjectConfig(
    projectId: 'p1',
    environmentKey: Environment.development,
    sdkKey: 'sk_dev_org1_p1_xxx',
    version: 1,
    flags: flags,
    generatedAt: '2024-01-01T00:00:00.000Z',
  );
}

void main() {
  // ---------------------------------------------------------------------------
  // Status / running checks
  // ---------------------------------------------------------------------------

  test('archived returns null', () {
    final flag = makeFlag('archived', status: FlagStatus.archived);
    expect(evaluateFlag(flag, 'user-1', null), isNull);
  });

  test('not running returns off disabled', () {
    final flag = makeFlag('disabled', running: false);
    final result = evaluateFlag(flag, 'user-1', null);
    expect(result, isNotNull);
    expect(result!.variationKey, equals('off'));
    expect(result.enabled, isFalse);
    expect(result.ruleKey, isNull);
    expect(result.ruleType, isNull);
  });

  // ---------------------------------------------------------------------------
  // Allowlist
  // ---------------------------------------------------------------------------

  test('allowlist returns listed variation', () {
    final rule = ConfigRule(
      ruleKey: 'rule-qa',
      ruleType: RuleType.targeted,
      trafficPercentage: 0,
      variationAllocation: _full('on'),
      allowlist: const [
        AllowlistEntry(userId: 'qa-user', variation: 'on'),
        AllowlistEntry(userId: 'qa-off-user', variation: 'off'),
      ],
    );
    final flag = makeFlag('allowlist', allocation: _full('off'), rules: [rule]);

    final result = evaluateFlag(flag, 'qa-user', null);
    expect(result, isNotNull);
    expect(result!.variationKey, equals('on'));
    expect(result.enabled, isTrue);
    expect(result.ruleKey, equals('rule-qa'));
    expect(result.ruleType, equals(RuleType.targeted));
  });

  test('allowlist off variation returns enabled false', () {
    final rule = ConfigRule(
      ruleKey: 'rule-qa',
      ruleType: RuleType.targeted,
      trafficPercentage: 0,
      variationAllocation: _full('on'),
      allowlist: const [AllowlistEntry(userId: 'qa-off-user', variation: 'off')],
    );
    final flag = makeFlag('allowlist', allocation: _full('off'), rules: [rule]);

    final result = evaluateFlag(flag, 'qa-off-user', null);
    expect(result, isNotNull);
    expect(result!.variationKey, equals('off'));
    expect(result.enabled, isFalse);
    expect(result.ruleKey, equals('rule-qa'));
  });

  test('non-allowlisted user falls through to default', () {
    final rule = ConfigRule(
      ruleKey: 'rule-qa',
      ruleType: RuleType.targeted,
      trafficPercentage: 0,
      variationAllocation: _full('on'),
      allowlist: const [AllowlistEntry(userId: 'qa-user', variation: 'on')],
    );
    final flag = makeFlag('allowlist', allocation: _full('off'), rules: [rule]);

    final result = evaluateFlag(flag, 'random-user', null);
    expect(result, isNotNull);
    expect(result!.variationKey, equals('off'));
    expect(result.ruleKey, isNull);
  });

  // ---------------------------------------------------------------------------
  // Traffic allocation
  // ---------------------------------------------------------------------------

  test('places all users in traffic when percentage is 100', () {
    final rule = ConfigRule(
      ruleKey: 'rule-all',
      ruleType: RuleType.abTest,
      trafficPercentage: 100,
      variationAllocation: _full('on'),
    );
    final flag = makeFlag('full-traffic', rules: [rule]);

    final result = evaluateFlag(flag, 'any-user', null);
    expect(result, isNotNull);
    expect(result!.variationKey, equals('on'));
    expect(result.ruleKey, equals('rule-all'));
  });

  test('places no users in traffic when percentage is 0', () {
    final rule = ConfigRule(
      ruleKey: 'rule-none',
      ruleType: RuleType.abTest,
      trafficPercentage: 0,
      variationAllocation: _full('on'),
    );
    final flag = makeFlag('zero-traffic', allocation: _full('off'), rules: [rule]);

    final result = evaluateFlag(flag, 'any-user', null);
    expect(result, isNotNull);
    expect(result!.variationKey, equals('off'));
    expect(result.ruleKey, isNull);
  });

  // ---------------------------------------------------------------------------
  // Audience targeting
  // ---------------------------------------------------------------------------

  test('matches rule for user whose attributes satisfy the audience', () {
    final rule = ConfigRule(
      ruleKey: 'rule-premium',
      ruleType: RuleType.abTest,
      audienceMatchType: AudienceMatchType.any,
      audiences: const [
        ConfigRuleAudience(conditions: [
          AudienceCondition(attribute: 'plan', operator: 'equals', value: 'premium'),
        ]),
      ],
      trafficPercentage: 100,
      variationAllocation: _full('on'),
    );
    final flag = makeFlag('targeted', allocation: _full('off'), rules: [rule]);

    final result = evaluateFlag(flag, 'premium-user', {'plan': 'premium'});
    expect(result, isNotNull);
    expect(result!.variationKey, equals('on'));
    expect(result.ruleKey, equals('rule-premium'));
  });

  test('falls through to default for user who does not match audience', () {
    final rule = ConfigRule(
      ruleKey: 'rule-premium',
      ruleType: RuleType.abTest,
      audienceMatchType: AudienceMatchType.any,
      audiences: const [
        ConfigRuleAudience(conditions: [
          AudienceCondition(attribute: 'plan', operator: 'equals', value: 'premium'),
        ]),
      ],
      trafficPercentage: 100,
      variationAllocation: _full('on'),
    );
    final flag = makeFlag('targeted', allocation: _full('off'), rules: [rule]);

    final result = evaluateFlag(flag, 'free-user', {'plan': 'free'});
    expect(result, isNotNull);
    expect(result!.variationKey, equals('off'));
    expect(result.ruleKey, isNull);
  });

  test('falls through to default when user has no attributes', () {
    final rule = ConfigRule(
      ruleKey: 'rule-premium',
      ruleType: RuleType.abTest,
      audienceMatchType: AudienceMatchType.any,
      audiences: const [
        ConfigRuleAudience(conditions: [
          AudienceCondition(attribute: 'plan', operator: 'equals', value: 'premium'),
        ]),
      ],
      trafficPercentage: 100,
      variationAllocation: _full('on'),
    );
    final flag = makeFlag('targeted', allocation: _full('off'), rules: [rule]);

    final result = evaluateFlag(flag, 'attr-less-user', null);
    expect(result, isNotNull);
    expect(result!.variationKey, equals('off'));
    expect(result.ruleKey, isNull);
  });

  // ---------------------------------------------------------------------------
  // Default allocation
  // ---------------------------------------------------------------------------

  test('uses default allocation when no rules exist', () {
    final flag = makeFlag('no-rules', allocation: _full('on'));

    final result = evaluateFlag(flag, 'user-1', null);
    expect(result, isNotNull);
    expect(result!.variationKey, equals('on'));
    expect(result.enabled, isTrue);
    expect(result.ruleKey, isNull);
    expect(result.ruleType, isNull);
  });

  test('returns off fallback when default allocation ranges are empty', () {
    final flag = makeFlag('empty-alloc', allocation: const VariationAllocation(ranges: []));

    final result = evaluateFlag(flag, 'user-1', null);
    expect(result, isNotNull);
    expect(result!.variationKey, equals('off'));
    expect(result.enabled, isFalse);
  });

  // ---------------------------------------------------------------------------
  // Variable resolution
  // ---------------------------------------------------------------------------

  test('returns all default variables for variation with no overrides', () {
    final flag = ConfigFlag(
      id: 'flag_vars',
      key: 'vars-flag',
      status: FlagStatus.active,
      running: true,
      salt: 'vars-salt',
      variations: [
        const Variation(key: 'off'),
        const Variation(key: 'v1'), // inherits all defaults
        const Variation(key: 'v2', variables: {'color': 'blue', 'count': 5}),
      ],
      variables: const [
        FlagVariable(key: 'color', type: 'string', defaultValue: 'red'),
        FlagVariable(key: 'count', type: 'number', defaultValue: 1),
        FlagVariable(key: 'enabled', type: 'boolean', defaultValue: true),
      ],
      allocation: _full('v1'),
    );

    final result = evaluateFlag(flag, 'user-1', null);
    expect(result, isNotNull);
    expect(result!.variationKey, equals('v1'));
    expect(result.variables, equals({'color': 'red', 'count': 1, 'enabled': true}));
  });

  test('merges variation overrides with flag-level defaults', () {
    final flag = ConfigFlag(
      id: 'flag_vars',
      key: 'vars-flag',
      status: FlagStatus.active,
      running: true,
      salt: 'vars-salt',
      variations: [
        const Variation(key: 'off'),
        const Variation(key: 'v2', variables: {'color': 'blue', 'count': 5}),
      ],
      variables: const [
        FlagVariable(key: 'color', type: 'string', defaultValue: 'red'),
        FlagVariable(key: 'count', type: 'number', defaultValue: 1),
        FlagVariable(key: 'enabled', type: 'boolean', defaultValue: true),
      ],
      allocation: _full('v2'),
    );

    final result = evaluateFlag(flag, 'user-1', null);
    expect(result, isNotNull);
    expect(result!.variationKey, equals('v2'));
    // color and count come from variation overrides; enabled comes from default
    expect(result.variables, equals({'color': 'blue', 'count': 5, 'enabled': true}));
  });

  test('returns empty variables when flag has none defined', () {
    final flag = makeFlag('no-vars', allocation: _full('on'));

    final result = evaluateFlag(flag, 'user-1', null);
    expect(result, isNotNull);
    expect(result!.variables, isEmpty);
  });

  // ---------------------------------------------------------------------------
  // Determinism
  // ---------------------------------------------------------------------------

  test('always assigns the same variation to the same user', () {
    final flag = makeFlag(
      'determinism',
      allocation: _alloc([('off', 0, 4999), ('on', 5000, 9999)]),
    );
    final keys = List.generate(10, (_) => evaluateFlag(flag, 'user-stable', null)?.variationKey).toSet();
    expect(keys.length, equals(1));
  });

  // ---------------------------------------------------------------------------
  // evaluateAllFlags
  // ---------------------------------------------------------------------------

  test('evaluateAllFlags returns decisions for non-archived flags', () {
    final config = _makeConfig([
      makeFlag('active-a'),
      makeFlag('active-b'),
      makeFlag('archived-c', status: FlagStatus.archived),
    ]);

    final decisions = evaluateAllFlags(config, 'user-1', null);
    expect(decisions.length, equals(2));
    expect(decisions.containsKey('active-a'), isTrue);
    expect(decisions.containsKey('active-b'), isTrue);
    expect(decisions.containsKey('archived-c'), isFalse);
  });

  test('evaluateAllFlags includes flag key on each decision', () {
    final config = _makeConfig([makeFlag('active-a'), makeFlag('active-b')]);

    final decisions = evaluateAllFlags(config, 'user-1', null);
    expect(decisions['active-a']!.flagKey, equals('active-a'));
    expect(decisions['active-b']!.flagKey, equals('active-b'));
  });
}
