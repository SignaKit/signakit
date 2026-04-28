/**
 * Audience matching logic for evaluating user attributes against audience conditions.
 */

import type {
  AudienceCondition,
  ConfigRuleAudience,
  AudienceMatchType,
  UserAttributes,
} from './types'

export function matchesCondition(
  condition: AudienceCondition,
  attributes: UserAttributes | undefined
): boolean {
  if (!attributes) return false

  const userValue = attributes[condition.attribute]
  if (userValue === undefined) return false

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
      if (Array.isArray(value)) {
        return (value as unknown[]).includes(userValue)
      }
      return false

    case 'not_in':
      if (Array.isArray(value)) {
        return !(value as unknown[]).includes(userValue)
      }
      return true

    case 'contains':
      if (typeof userValue === 'string' && typeof value === 'string') {
        return userValue.includes(value)
      }
      if (Array.isArray(userValue) && typeof value === 'string') {
        return userValue.includes(value)
      }
      return false

    case 'not_contains':
      if (typeof userValue === 'string' && typeof value === 'string') {
        return !userValue.includes(value)
      }
      if (Array.isArray(userValue) && typeof value === 'string') {
        return !userValue.includes(value)
      }
      return true

    default:
      console.warn(`[SignaKit] Unknown operator: ${operator}`)
      return false
  }
}

export function matchesAudience(
  audience: ConfigRuleAudience,
  attributes: UserAttributes | undefined
): boolean {
  return audience.conditions.every((condition) => matchesCondition(condition, attributes))
}

export function matchesAudiences(
  audiences: ConfigRuleAudience[] | undefined,
  matchType: AudienceMatchType | undefined,
  attributes: UserAttributes | undefined
): boolean {
  if (!audiences || audiences.length === 0) return true

  if (matchType === 'any') {
    return audiences.some((audience) => matchesAudience(audience, attributes))
  }
  return audiences.every((audience) => matchesAudience(audience, attributes))
}
