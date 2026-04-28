/**
 * @signakit/flags-node
 *
 * Official Node.js SDK for SignaKit Feature Flags.
 * Fetches flag configurations from CloudFront/S3 and evaluates flags locally.
 */

// Main entry point
export { createInstance, SignaKitClient, SignaKitUserContext } from './client'

// Utilities
export { isBot } from './ua/bot-patterns'

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
} from './types'
