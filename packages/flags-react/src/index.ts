/**
 * @signakit/flags-react
 *
 * Official React SDK for SignaKit Feature Flags.
 * Thin wrapper around @signakit/flags-browser that provides React context,
 * hooks, and components for evaluating feature flags in React applications.
 */

// Provider + context
export { SignaKitProvider, SignaKitContext } from './provider'
export type { SignaKitProviderProps, SignaKitContextValue } from './provider'

// Hook
export { useFlag } from './use-flag'
export type { UseFlagResult } from './use-flag'

// Component
export { FlagGate } from './flag-gate'
export type { FlagGateProps } from './flag-gate'
