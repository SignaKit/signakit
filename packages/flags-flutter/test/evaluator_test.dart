import 'package:flutter_test/flutter_test.dart';
import 'package:signakit_flags/src/evaluator.dart';
import 'package:signakit_flags/src/types.dart';

ConfigFlag _makeFlag({
  bool running = true,
  FlagStatus status = FlagStatus.active,
  List<ConfigRule>? rules,
}) {
  return ConfigFlag(
    id: '1',
    key: 'test-flag',
    salt: 'salt-1',
    status: status,
    running: running,
    variations: const <Variation>[
      Variation(key: 'control'),
      Variation(key: 'treatment'),
      Variation(key: 'off'),
    ],
    allocation: const VariationAllocation(
      ranges: <VariationAllocationRange>[
        VariationAllocationRange(variation: 'control', start: 0, end: 4999),
        VariationAllocationRange(variation: 'treatment', start: 5000, end: 9999),
      ],
    ),
    rules: rules,
  );
}

void main() {
  group('evaluateFlag', () {
    test('archived flag returns null', () {
      final flag = _makeFlag(status: FlagStatus.archived);
      expect(evaluateFlag(flag, 'user-1', null), isNull);
    });

    test('non-running flag returns disabled off decision', () {
      final flag = _makeFlag(running: false);
      final d = evaluateFlag(flag, 'user-1', null);
      expect(d, isNotNull);
      expect(d!.variationKey, equals('off'));
      expect(d.enabled, isFalse);
      expect(d.ruleKey, isNull);
      expect(d.ruleType, isNull);
    });

    test('default allocation buckets user into a variation', () {
      final flag = _makeFlag();
      final d = evaluateFlag(flag, 'user-1', null);
      expect(d, isNotNull);
      expect(<String>['control', 'treatment'], contains(d!.variationKey));
      expect(d.ruleKey, isNull); // default allocation
    });

    test('allowlist short-circuits to fixed variation', () {
      final rule = ConfigRule(
        ruleKey: 'rule-1',
        ruleType: RuleType.targeted,
        trafficPercentage: 0,
        variationAllocation: const VariationAllocation(
          ranges: <VariationAllocationRange>[
            VariationAllocationRange(variation: 'treatment', start: 0, end: 9999),
          ],
        ),
        allowlist: const <AllowlistEntry>[
          AllowlistEntry(userId: 'vip', variation: 'treatment'),
        ],
      );
      final flag = _makeFlag(rules: <ConfigRule>[rule]);
      final d = evaluateFlag(flag, 'vip', null);
      expect(d!.variationKey, equals('treatment'));
      expect(d.ruleKey, equals('rule-1'));
      expect(d.ruleType, equals(RuleType.targeted));
    });

    test('rule with 100% traffic and matching audience routes via rule', () {
      final rule = ConfigRule(
        ruleKey: 'pro-users',
        ruleType: RuleType.abTest,
        audienceMatchType: AudienceMatchType.all,
        audiences: const <ConfigRuleAudience>[
          ConfigRuleAudience(
            conditions: <AudienceCondition>[
              AudienceCondition(attribute: 'plan', operator: 'equals', value: 'pro'),
            ],
          ),
        ],
        trafficPercentage: 100,
        variationAllocation: const VariationAllocation(
          ranges: <VariationAllocationRange>[
            VariationAllocationRange(variation: 'treatment', start: 0, end: 9999),
          ],
        ),
      );
      final flag = _makeFlag(rules: <ConfigRule>[rule]);
      final d = evaluateFlag(flag, 'user-x', <String, Object?>{'plan': 'pro'});
      expect(d!.variationKey, equals('treatment'));
      expect(d.ruleKey, equals('pro-users'));
      expect(d.ruleType, equals(RuleType.abTest));
    });

    test('rule with 0% traffic falls through to default', () {
      final rule = ConfigRule(
        ruleKey: 'rolled-out',
        ruleType: RuleType.targeted,
        trafficPercentage: 0,
        variationAllocation: const VariationAllocation(
          ranges: <VariationAllocationRange>[
            VariationAllocationRange(variation: 'treatment', start: 0, end: 9999),
          ],
        ),
      );
      final flag = _makeFlag(rules: <ConfigRule>[rule]);
      final d = evaluateFlag(flag, 'user-1', null);
      expect(d, isNotNull);
      expect(d!.ruleKey, isNull); // default path
    });
  });
}
