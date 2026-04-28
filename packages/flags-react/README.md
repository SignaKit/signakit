# @signakit/flags-react

Official React SDK for [SignaKit](https://signakit.io) Feature Flags — a context provider, hook, and gate component built on top of `@signakit/flags-browser`.

## Installation

```bash
npm install @signakit/flags-react @signakit/flags-browser
```

## Quick Start

Wrap your application with `SignaKitProvider`, then use `useFlag` or `FlagGate` anywhere in the tree.

```tsx
// main.tsx
import { SignaKitProvider } from '@signakit/flags-react'
import App from './App'

export default function Root() {
  return (
    <SignaKitProvider
      sdkKey="sk_prod_abc123_1234_xxxx"
      userId="user-123"
      attributes={{ plan: 'premium', country: 'US' }}
      loadingFallback={<div>Loading…</div>}
    >
      <App />
    </SignaKitProvider>
  )
}
```

Use `useFlag` to evaluate a flag in any component:

```tsx
// CheckoutButton.tsx
import { useFlag } from '@signakit/flags-react'

export function CheckoutButton() {
  const { enabled, loading } = useFlag('new-checkout')

  if (loading) return null

  return enabled ? <NewCheckoutButton /> : <LegacyCheckoutButton />
}
```

Or use `FlagGate` for a declarative alternative:

```tsx
// CheckoutPage.tsx
import { FlagGate } from '@signakit/flags-react'

export function CheckoutPage() {
  return (
    <FlagGate flag="new-checkout" fallback={<LegacyCheckout />}>
      <NewCheckout />
    </FlagGate>
  )
}
```

## API Reference

### `SignaKitProvider`

Initialises the SignaKit client and makes flag evaluation available to the component tree.

```tsx
<SignaKitProvider
  sdkKey="sk_prod_abc123_1234_xxxx"
  userId="user-123"
  attributes={{ plan: 'premium', country: 'US' }}
  loadingFallback={<Spinner />}
>
  <App />
</SignaKitProvider>
```

| Prop | Type | Required | Description |
|---|---|---|---|
| `sdkKey` | `string` | Yes | Your environment SDK key from the SignaKit dashboard |
| `userId` | `string` | Yes | Stable identifier for the current user |
| `attributes` | `UserAttributes` | No | Additional user attributes used for targeting rules |
| `children` | `React.ReactNode` | Yes | Your application tree |
| `loadingFallback` | `React.ReactNode` | No | Rendered while the client initialises; defaults to `null` |

**Behaviour notes:**

- The client is initialised once per `sdkKey`. If `userId` or `attributes` change after mount, the user context is updated without reinitialising the client.
- Initialisation is asynchronous. `loadingFallback` is shown until the client is ready, then replaced with `children`.
- If initialisation fails, the provider **fails open** — `children` still render and all flags return `off` rather than crashing your app.

---

### `useFlag(flagKey)`

Evaluates a single feature flag for the current user.

```typescript
const { enabled, variationKey, ruleKey, loading } = useFlag('new-checkout')
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `flagKey` | `string` | The flag key as defined in the SignaKit dashboard |

**Return value:**

```typescript
interface UseFlagResult {
  enabled: boolean       // true when the flag is on for this user
  variationKey: string   // e.g. 'control', 'treatment', 'off'
  ruleKey: string | null // the rule that matched, or null
  loading: boolean       // true while the client is initialising
}
```

While the client is initialising, the hook returns `{ enabled: false, variationKey: 'off', ruleKey: null, loading: true }`.

> `useFlag` must be called inside a `<SignaKitProvider>`. It will throw if used outside one.

---

### `FlagGate`

Conditionally renders content based on whether a flag is enabled. A declarative alternative to `useFlag`.

```tsx
<FlagGate flag="new-checkout" fallback={<OldCheckout />}>
  <NewCheckout />
</FlagGate>
```

| Prop | Type | Required | Description |
|---|---|---|---|
| `flag` | `string` | Yes | The flag key to evaluate |
| `children` | `React.ReactNode` | Yes | Rendered when the flag is enabled |
| `fallback` | `React.ReactNode` | No | Rendered when the flag is disabled or loading; defaults to `null` |

During loading, `FlagGate` renders `fallback` (or nothing). Once the client is ready, it switches to `children` if the flag is on.

## Loading & Error States

**During initialisation:**

The `loading` field from `useFlag` is `true` and `FlagGate` shows its `fallback` until the client has fetched flag configuration. Use `loadingFallback` on `SignaKitProvider` to show a spinner or skeleton at the app level instead of handling loading per-component.

```tsx
<SignaKitProvider sdkKey="..." userId="..." loadingFallback={<AppSkeleton />}>
  <App />
</SignaKitProvider>
```

**If initialisation fails:**

The provider **fails open**. Your app renders normally and every flag evaluation returns `{ enabled: false, variationKey: 'off' }`. No error is thrown into your component tree — feature flags failing should never take down your app.

## TypeScript

All types are included in the package. Import them directly:

```typescript
import {
  SignaKitProvider,
  useFlag,
  FlagGate,
  type SignaKitProviderProps,
  type UseFlagResult,
  type FlagGateProps,
} from '@signakit/flags-react'

import type { UserAttributes } from '@signakit/flags-browser'
```

## Requirements

- React 18 or later
- `@signakit/flags-browser` 0.1.0 or later (peer dependency)

## License

MIT
