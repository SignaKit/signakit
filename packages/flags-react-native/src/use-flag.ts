import { useEffect, useState } from 'react'
import { useSignaKitContext } from './provider'
import type { RuleType, SignaKitDecision, VariableValue } from './types'

export interface UseFlagResult {
  /** Whether the flag is enabled for this user */
  enabled: boolean
  /** The variation key ('on', 'off', 'variant_a', etc.) */
  variationKey: string
  /** Which rule matched, if any */
  ruleKey: string | null
  /** The rule type that produced this decision, or null for default/disabled paths. */
  ruleType: RuleType | null
  /** Resolved variable values for the matched variation */
  variables: Record<string, VariableValue>
  /** True while the client is initializing */
  loading: boolean
}

const LOADING_RESULT: UseFlagResult = {
  enabled: false,
  variationKey: 'off',
  ruleKey: null,
  ruleType: null,
  variables: {},
  loading: true,
}

const OFF_RESULT: UseFlagResult = {
  enabled: false,
  variationKey: 'off',
  ruleKey: null,
  ruleType: null,
  variables: {},
  loading: false,
}

function decisionToResult(decision: SignaKitDecision | null): UseFlagResult {
  if (!decision) return OFF_RESULT
  return {
    enabled: decision.enabled,
    variationKey: decision.variationKey,
    ruleKey: decision.ruleKey,
    ruleType: decision.ruleType,
    variables: decision.variables,
    loading: false,
  }
}

export function useFlag(flagKey: string): UseFlagResult {
  const { userContext, loading } = useSignaKitContext()

  const [result, setResult] = useState<UseFlagResult>(() => {
    if (loading || !userContext) return LOADING_RESULT
    return decisionToResult(userContext.decide(flagKey))
  })

  useEffect(() => {
    if (loading || !userContext) {
      setResult(LOADING_RESULT)
      return
    }
    const decision = userContext.decide(flagKey)
    setResult(decisionToResult(decision))
  }, [flagKey, userContext, loading])

  return result
}
