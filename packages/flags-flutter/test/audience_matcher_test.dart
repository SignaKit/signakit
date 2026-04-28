import 'package:flutter_test/flutter_test.dart';
import 'package:signakit_flags/src/audience_matcher.dart';
import 'package:signakit_flags/src/types.dart';

ConfigRuleAudience _audience(List<AudienceCondition> conds) =>
    ConfigRuleAudience(conditions: conds);

AudienceCondition _cond(String attr, String op, Object? value) =>
    AudienceCondition(attribute: attr, operator: op, value: value);

void main() {
  group('matchesCondition operators', () {
    test('equals / not_equals', () {
      final attrs = <String, Object?>{'plan': 'pro'};
      expect(matchesCondition(_cond('plan', 'equals', 'pro'), attrs), isTrue);
      expect(matchesCondition(_cond('plan', 'equals', 'free'), attrs), isFalse);
      expect(matchesCondition(_cond('plan', 'not_equals', 'free'), attrs), isTrue);
    });

    test('numeric comparisons', () {
      final attrs = <String, Object?>{'age': 25};
      expect(matchesCondition(_cond('age', 'greater_than', 18), attrs), isTrue);
      expect(matchesCondition(_cond('age', 'less_than', 18), attrs), isFalse);
      expect(matchesCondition(_cond('age', 'greater_than_or_equals', 25), attrs), isTrue);
      expect(matchesCondition(_cond('age', 'less_than_or_equals', 24), attrs), isFalse);
    });

    test('numeric ops on non-numbers return false', () {
      final attrs = <String, Object?>{'name': 'alice'};
      expect(matchesCondition(_cond('name', 'greater_than', 18), attrs), isFalse);
    });

    test('in / not_in', () {
      final attrs = <String, Object?>{'country': 'US'};
      expect(
        matchesCondition(
          _cond('country', 'in', <String>['US', 'CA']),
          attrs,
        ),
        isTrue,
      );
      expect(
        matchesCondition(
          _cond('country', 'not_in', <String>['UK', 'DE']),
          attrs,
        ),
        isTrue,
      );
    });

    test('contains / not_contains on strings', () {
      final attrs = <String, Object?>{'email': 'a@example.com'};
      expect(matchesCondition(_cond('email', 'contains', 'example'), attrs), isTrue);
      expect(matchesCondition(_cond('email', 'not_contains', 'foo'), attrs), isTrue);
    });

    test('contains on string array', () {
      final attrs = <String, Object?>{
        'tags': <String>['beta', 'admin'],
      };
      expect(matchesCondition(_cond('tags', 'contains', 'beta'), attrs), isTrue);
      expect(matchesCondition(_cond('tags', 'not_contains', 'foo'), attrs), isTrue);
    });

    test('missing attribute → false (and not_in/not_contains → true via early return)', () {
      final attrs = <String, Object?>{'other': 'x'};
      expect(matchesCondition(_cond('plan', 'equals', 'pro'), attrs), isFalse);
    });
  });

  group('matchesAudiences', () {
    test('empty/null audiences → match all', () {
      expect(matchesAudiences(null, null, <String, Object?>{}), isTrue);
      expect(
        matchesAudiences(<ConfigRuleAudience>[], AudienceMatchType.any, <String, Object?>{}),
        isTrue,
      );
    });

    test('all = AND, any = OR', () {
      final a = _audience(<AudienceCondition>[_cond('plan', 'equals', 'pro')]);
      final b = _audience(<AudienceCondition>[_cond('country', 'equals', 'US')]);

      // pro + US satisfies both
      final attrs = <String, Object?>{'plan': 'pro', 'country': 'US'};
      expect(matchesAudiences(<ConfigRuleAudience>[a, b], AudienceMatchType.all, attrs), isTrue);

      // pro + DE satisfies only `a`
      final partial = <String, Object?>{'plan': 'pro', 'country': 'DE'};
      expect(matchesAudiences(<ConfigRuleAudience>[a, b], AudienceMatchType.all, partial), isFalse);
      expect(matchesAudiences(<ConfigRuleAudience>[a, b], AudienceMatchType.any, partial), isTrue);
    });
  });
}
