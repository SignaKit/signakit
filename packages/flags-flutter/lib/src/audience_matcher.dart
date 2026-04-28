/// Audience matching logic.
///
/// Mirrors `packages/flags-node/src/audience-matcher.ts`.
library;

import 'types.dart';

/// Evaluate a single condition against user attributes.
bool matchesCondition(AudienceCondition condition, UserAttributes? attributes) {
  if (attributes == null) return false;

  final userValue = attributes[condition.attribute];
  if (userValue == null) return false;

  final value = condition.value;

  switch (condition.operator) {
    case 'equals':
      return userValue == value;
    case 'not_equals':
      return userValue != value;
    case 'greater_than':
      if (userValue is num && value is num) return userValue > value;
      return false;
    case 'less_than':
      if (userValue is num && value is num) return userValue < value;
      return false;
    case 'greater_than_or_equals':
      if (userValue is num && value is num) return userValue >= value;
      return false;
    case 'less_than_or_equals':
      if (userValue is num && value is num) return userValue <= value;
      return false;
    case 'in':
      if (value is List) return value.contains(userValue);
      return false;
    case 'not_in':
      if (value is List) return !value.contains(userValue);
      return true;
    case 'contains':
      if (userValue is String && value is String) {
        return userValue.contains(value);
      }
      if (userValue is List && value is String) {
        return userValue.contains(value);
      }
      return false;
    case 'not_contains':
      if (userValue is String && value is String) {
        return !userValue.contains(value);
      }
      if (userValue is List && value is String) {
        return !userValue.contains(value);
      }
      return true;
    default:
      return false;
  }
}

/// An audience matches if ALL of its conditions match.
bool matchesAudience(ConfigRuleAudience audience, UserAttributes? attributes) {
  return audience.conditions.every((c) => matchesCondition(c, attributes));
}

/// Multi-audience match. Empty audiences match all users.
bool matchesAudiences(
  List<ConfigRuleAudience>? audiences,
  AudienceMatchType? matchType,
  UserAttributes? attributes,
) {
  if (audiences == null || audiences.isEmpty) return true;

  if (matchType == AudienceMatchType.any) {
    return audiences.any((a) => matchesAudience(a, attributes));
  }
  // 'all' (default — AND)
  return audiences.every((a) => matchesAudience(a, attributes));
}
