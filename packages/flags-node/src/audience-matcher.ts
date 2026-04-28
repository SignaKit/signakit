/**
 * Audience matching logic for evaluating user attributes against audience conditions.
 */

import type {
  AudienceCondition,
  ConfigRuleAudience,
  AudienceMatchType,
  UserAttributes,
} from './types'

/**
 * Evaluate a single condition against user attributes.
 *
 * @param condition - The condition to evaluate
 * @param attributes - The user's attributes
 * @returns true if the condition matches, false otherwise
 */
export function matchesCondition(
  condition: AudienceCondition,
  attributes: UserAttributes | undefined
): boolean {
  if (!attributes) {
    return false
  }

  const userValue = attributes[condition.attribute]

  // If the attribute is not present, the condition doesn't match
  if (userValue === undefined) {
    return false
  }

  const { operator, value } = condition

  switch (operator) {
    case 'equals':
      return userValue === value

    case 'not_equals':
      return userValue !== value

    case 'greater_than':
      if (typeof userValue === 'number' && typeof value === 'number') {
        return userValue > value
      }
      return false

    case 'less_than':
      if (typeof userValue === 'number' && typeof value === 'number') {
        return userValue < value
      }
      return false

    case 'greater_than_or_equals':
      if (typeof userValue === 'number' && typeof value === 'number') {
        return userValue >= value
      }
      return false

    case 'less_than_or_equals':
      if (typeof userValue === 'number' && typeof value === 'number') {
        return userValue <= value
      }
      return false

    case 'in':
      // Value is an array, check if userValue is in it
      if (Array.isArray(value)) {
        return (value as unknown[]).includes(userValue)
      }
      return false

    case 'not_in':
      // Value is an array, check if userValue is NOT in it
      if (Array.isArray(value)) {
        return !(value as unknown[]).includes(userValue)
      }
      return true

    case 'contains':
      // Check if string contains substring
      if (typeof userValue === 'string' && typeof value === 'string') {
        return userValue.includes(value)
      }
      // Check if array contains value
      if (Array.isArray(userValue) && typeof value === 'string') {
        return userValue.includes(value)
      }
      return false

    case 'not_contains':
      // Check if string does not contain substring
      if (typeof userValue === 'string' && typeof value === 'string') {
        return !userValue.includes(value)
      }
      // Check if array does not contain value
      if (Array.isArray(userValue) && typeof value === 'string') {
        return !userValue.includes(value)
      }
      return true

    default:
      // Unknown operator - log a warning and return false
      console.warn(`[SignaKit] Unknown operator: ${operator}`)
      return false
  }
}

/**
 * Evaluate a single audience against user attributes.
 * An audience matches if ALL of its conditions match.
 *
 * @param audience - The audience with its conditions
 * @param attributes - The user's attributes
 * @returns true if the audience matches, false otherwise
 */
export function matchesAudience(
  audience: ConfigRuleAudience,
  attributes: UserAttributes | undefined
): boolean {
  // All conditions must match for the audience to match
  return audience.conditions.every((condition) => matchesCondition(condition, attributes))
}

/**
 * Evaluate multiple audiences against user attributes based on match type.
 *
 * @param audiences - Array of audiences to evaluate
 * @param matchType - 'any' (OR logic) or 'all' (AND logic)
 * @param attributes - The user's attributes
 * @returns true if the audiences match according to matchType, false otherwise
 */
export function matchesAudiences(
  audiences: ConfigRuleAudience[] | undefined,
  matchType: AudienceMatchType | undefined,
  attributes: UserAttributes | undefined
): boolean {
  // If no audiences are specified, the rule matches all users
  if (!audiences || audiences.length === 0) {
    return true
  }

  if (matchType === 'any') {
    // ANY: At least one audience must match (OR logic)
    return audiences.some((audience) => matchesAudience(audience, attributes))
  } else {
    // ALL: Every audience must match (AND logic)
    return audiences.every((audience) => matchesAudience(audience, attributes))
  }
}
