/**
 * @signakit/flags-react-native
 *
 * Official React Native / Expo SDK for SignaKit Feature Flags.
 * Fetches flag configurations from CloudFront/S3 and evaluates flags locally.
 */

// Core client
export { createInstance, SignaKitClient } from './client'
export { SignaKitUserContext } from './user-context'

// React layer
export { SignaKitProvider, SignaKitContext, useSignaKitContext, useUserContext } from './provider'
export type { SignaKitProviderProps, SignaKitContextValue } from './provider'
export { useFlag } from './use-flag'
export type { UseFlagResult } from './use-flag'

// Types
export type {
  SignaKitClientConfig,
  OnReadyResult,
  UserAttributes,
  SignaKitDecision,
  SignaKitDecisions,
  SignaKitEvent,
  TrackEventOptions,
  VariableValue,
  FlagVariable,
  RuleType,
  Environment,
  AsyncStorageLike,
} from './types'
