# @signakit/flags-react-native

Official React Native / Expo SDK for [SignaKit](https://signakit.io) Feature Flags. Provides a context provider, hooks, and a low-level client for evaluating feature flags in React Native applications.

## Installation

```bash
npm install @signakit/flags-react-native
# or for Expo
npx expo install @signakit/flags-react-native
```

Optional — install AsyncStorage if you want offline-tolerant config caching:

```bash
npx expo install @react-native-async-storage/async-storage
```

## Quick Start (Expo)

Wrap your app with `SignaKitProvider`, then use `useFlag` anywhere in the tree.

```tsx
// App.tsx
import React from 'react'
import { SignaKitProvider } from '@signakit/flags-react-native'
import RootNavigator from './navigation/RootNavigator'

export default function App() {
  return (
    <SignaKitProvider
      sdkKey="sk_prod_abc123_1234_xxxx"
      userId="user-123"
      attributes={{ plan: 'premium', country: 'US' }}
      persistConfig
    >
      <RootNavigator />
    </SignaKitProvider>
  )
}
```

```tsx
// CheckoutScreen.tsx
import { Text, View } from 'react-native'
import { useFlag } from '@signakit/flags-react-native'

export function CheckoutScreen() {
  const { enabled, loading } = useFlag('new-checkout')

  if (loading) return null
  return enabled ? <NewCheckout /> : <LegacyCheckout />
}
```

## Tracking events

```tsx
import { useUserContext } from '@signakit/flags-react-native'

function PurchaseButton() {
  const userContext = useUserContext()

  const onPurchase = async () => {
    await userContext?.trackEvent('purchase', { value: 99.99 })
  }

  return <Button title="Buy" onPress={onPurchase} />
}
```

## Behavior notes

- **Exposure events** are auto-fired (fire-and-forget) when `decide` / `decideAll` returns a decision, except when `decision.ruleType === 'targeted'`. Targeted rules are simple feature-flag rollouts with no experiment to attribute.
- **Exposure dedup** is in-memory per app cold start (key: `flagKey:userId`). This matches mobile session semantics — re-launching the app starts a new session.
- **Config persistence** is optional. With `persistConfig`, the last good config is cached to AsyncStorage so the app can boot with stale-but-valid flags when the network is unavailable. `If-None-Match` is used for ETag-based 304s.
- **Bot detection** is not performed in React Native — mobile apps aren't crawled by web bots. The `$userAgent` attribute is accepted for parity but never auto-detected.
- **Fail open**: if the client fails to initialize, every `useFlag` returns `{ enabled: false, variationKey: 'off' }` and your app continues to render.

## Requirements

- React 18+
- React Native 0.74+ (Expo SDK 51+)
- Optional: `@react-native-async-storage/async-storage` for `persistConfig`

## License

MIT
