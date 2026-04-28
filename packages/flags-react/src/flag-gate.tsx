import React from 'react'
import { useFlag } from './use-flag'

export interface FlagGateProps {
  flag: string
  children: React.ReactNode
  /** Rendered when the flag is disabled or still loading. Defaults to null. */
  fallback?: React.ReactNode
}

export function FlagGate({ flag, children, fallback = null }: FlagGateProps) {
  const { enabled } = useFlag(flag)
  return <>{enabled ? children : fallback}</>
}
