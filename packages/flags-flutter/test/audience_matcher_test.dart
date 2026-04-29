import 'package:flutter_test/flutter_test.dart';
import 'package:signakit_flags/src/audience_matcher.dart';
import 'package:signakit_flags/src/types.dart';

AudienceCondition _cond(String attr, String op, Object? value) =>
    AudienceCondition(attribute: attr, operator: op, value: value);

void main() {
  // ---------------------------------------------------------------------------
  // matchesCondition — equals / not_equals
  // ---------------------------------------------------------------------------

  test('equals matches identical string values', () {
    expect(matchesCondition(_cond('plan', 'equals', 'premium'), {'plan': 'premium'}), isTrue);
  });

  test('equals rejects different string values', () {
    expect(matchesCondition(_cond('plan', 'equals', 'premium'), {'plan': 'free'}), isFalse);
  });

  test('equals matches boolean values', () {
    expect(matchesCondition(_cond('verified', 'equals', true), {'verified': true}), isTrue);
    expect(matchesCondition(_cond('verified', 'equals', true), {'verified': false}), isFalse);
  });

  test('not_equals matches when values differ', () {
    expect(matchesCondition(_cond('plan', 'not_equals', 'premium'), {'plan': 'free'}), isTrue);
    expect(matchesCondition(_cond('plan', 'not_equals', 'premium'), {'plan': 'premium'}), isFalse);
  });

  test('returns false when attribute is missing', () {
    expect(matchesCondition(_cond('plan', 'equals', 'premium'), {}), isFalse);
    expect(matchesCondition(_cond('plan', 'equals', 'premium'), null), isFalse);
  });

  // ---------------------------------------------------------------------------
  // matchesCondition — numeric comparisons
  // ---------------------------------------------------------------------------

  test('greater_than true when user value exceeds threshold', () {
    final c = _cond('age', 'greater_than', 18);
    expect(matchesCondition(c, {'age': 25}), isTrue);
    expect(matchesCondition(c, {'age': 18}), isFalse);
    expect(matchesCondition(c, {'age': 10}), isFalse);
  });

  test('less_than true when user value is below threshold', () {
    final c = _cond('age', 'less_than', 18);
    expect(matchesCondition(c, {'age': 10}), isTrue);
    expect(matchesCondition(c, {'age': 18}), isFalse);
    expect(matchesCondition(c, {'age': 25}), isFalse);
  });

  test('greater_than_or_equals inclusive', () {
    final c = _cond('age', 'greater_than_or_equals', 18);
    expect(matchesCondition(c, {'age': 18}), isTrue);
    expect(matchesCondition(c, {'age': 17}), isFalse);
  });

  test('less_than_or_equals inclusive', () {
    final c = _cond('age', 'less_than_or_equals', 18);
    expect(matchesCondition(c, {'age': 18}), isTrue);
    expect(matchesCondition(c, {'age': 19}), isFalse);
  });

  test('numeric operators return false on string attribute values', () {
    expect(matchesCondition(_cond('age', 'greater_than', 18), {'age': '25'}), isFalse);
  });

  // ---------------------------------------------------------------------------
  // matchesCondition — in / not_in
  // ---------------------------------------------------------------------------

  test('in true when user value is in the list', () {
    final c = _cond('country', 'in', <String>['US', 'CA', 'GB']);
    expect(matchesCondition(c, {'country': 'US'}), isTrue);
    expect(matchesCondition(c, {'country': 'DE'}), isFalse);
  });

  test('in false when value is not a list', () {
    final c = _cond('country', 'in', 'US');
    expect(matchesCondition(c, {'country': 'US'}), isFalse);
  });

  test('not_in true when user value is absent from the list', () {
    final c = _cond('country', 'not_in', <String>['US', 'CA']);
    expect(matchesCondition(c, {'country': 'DE'}), isTrue);
    expect(matchesCondition(c, {'country': 'US'}), isFalse);
  });

  test('not_in true when value is not a list (vacuously)', () {
    // Dart: non-list value → vacuously true (mirrors JS/Python SDK behaviour)
    final c = _cond('country', 'not_in', 'US');
    expect(matchesCondition(c, {'country': 'US'}), isTrue);
  });

  // ---------------------------------------------------------------------------
  // matchesCondition — contains / not_contains
  // ---------------------------------------------------------------------------

  test('contains true when string includes substring', () {
    final c = _cond('email', 'contains', '@acme');
    expect(matchesCondition(c, {'email': 'bob@acme.com'}), isTrue);
    expect(matchesCondition(c, {'email': 'bob@gmail.com'}), isFalse);
  });

  test('contains true when string array includes value', () {
    final c = _cond('tags', 'contains', 'beta');
    expect(matchesCondition(c, {'tags': <String>['alpha', 'beta', 'gamma']}), isTrue);
    expect(matchesCondition(c, {'tags': <String>['alpha', 'gamma']}), isFalse);
  });

  test('not_contains true when string does not include substring', () {
    final c = _cond('email', 'not_contains', '@acme');
    expect(matchesCondition(c, {'email': 'bob@gmail.com'}), isTrue);
    expect(matchesCondition(c, {'email': 'bob@acme.com'}), isFalse);
  });

  test('not_contains true when array does not include value', () {
    final c = _cond('tags', 'not_contains', 'beta');
    expect(matchesCondition(c, {'tags': <String>['alpha', 'gamma']}), isTrue);
    expect(matchesCondition(c, {'tags': <String>['alpha', 'beta']}), isFalse);
  });

  test('not_contains true when types do not match (vacuously)', () {
    // Dart: numeric attribute with string needle → vacuously true (mirrors JS/Python SDK)
    final c = _cond('score', 'not_contains', 'high');
    expect(matchesCondition(c, {'score': 42}), isTrue);
  });

  // ---------------------------------------------------------------------------
  // matchesAudience
  // ---------------------------------------------------------------------------

  test('matchesAudience returns true when all conditions match', () {
    final audience = ConfigRuleAudience(conditions: [
      _cond('plan', 'equals', 'premium'),
      _cond('age', 'greater_than_or_equals', 18),
    ]);
    expect(matchesAudience(audience, {'plan': 'premium', 'age': 25}), isTrue);
  });

  test('matchesAudience returns false when any condition fails', () {
    final audience = ConfigRuleAudience(conditions: [
      _cond('plan', 'equals', 'premium'),
      _cond('age', 'greater_than_or_equals', 18),
    ]);
    expect(matchesAudience(audience, {'plan': 'premium', 'age': 16}), isFalse);
  });

  test('matchesAudience returns true for empty conditions', () {
    final audience = ConfigRuleAudience(conditions: []);
    expect(matchesAudience(audience, {}), isTrue);
  });

  // ---------------------------------------------------------------------------
  // matchesAudiences
  // ---------------------------------------------------------------------------

  test('matchesAudiences returns true when audiences are null or empty', () {
    expect(matchesAudiences(null, AudienceMatchType.any, {}), isTrue);
    expect(matchesAudiences([], AudienceMatchType.any, {'plan': 'premium'}), isTrue);
    expect(matchesAudiences([], AudienceMatchType.all, {'plan': 'premium'}), isTrue);
  });

  test('any returns true when at least one audience matches', () {
    final audiences = [
      ConfigRuleAudience(conditions: [_cond('plan', 'equals', 'premium')]),
      ConfigRuleAudience(conditions: [_cond('plan', 'equals', 'enterprise')]),
    ];
    expect(matchesAudiences(audiences, AudienceMatchType.any, {'plan': 'premium'}), isTrue);
    expect(matchesAudiences(audiences, AudienceMatchType.any, {'plan': 'free'}), isFalse);
  });

  test('all returns true only when every audience matches', () {
    final audiences = [
      ConfigRuleAudience(conditions: [_cond('plan', 'equals', 'premium')]),
      ConfigRuleAudience(conditions: [_cond('verified', 'equals', true)]),
    ];
    expect(matchesAudiences(audiences, AudienceMatchType.all, {'plan': 'premium', 'verified': true}), isTrue);
    expect(matchesAudiences(audiences, AudienceMatchType.all, {'plan': 'premium', 'verified': false}), isFalse);
  });

  test('defaults to all logic when match type is null', () {
    final audiences = [
      ConfigRuleAudience(conditions: [_cond('plan', 'equals', 'premium')]),
      ConfigRuleAudience(conditions: [_cond('verified', 'equals', true)]),
    ];
    expect(matchesAudiences(audiences, null, {'plan': 'premium', 'verified': true}), isTrue);
    expect(matchesAudiences(audiences, null, {'plan': 'premium', 'verified': false}), isFalse);
  });
}
