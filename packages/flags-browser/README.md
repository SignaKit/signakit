# @signakit/flags-browser

Official browser JavaScript SDK for [SignaKit Feature Flags](https://signakit.com). Fetches flag configuration from the CDN once on initialization and evaluates all flags locally — no network calls on `decide()`.

## Installation

```bash
npm install @signakit/flags-browser
```

## Quick Start

```typescript
import { createInstance } from '@signakit/flags-browser'

const client = createInstance({
  sdkKey: process.env.SIGNAKIT_SDK_KEY,
})

if (!client) {
  console.error('Invalid SDK key')
} else {
  const { success, reason } = await client.onReady()

  if (!success) {
    console.error('Failed to load flags:', reason)
  } else {
    const userContext = client.createUserContext('user-123', {
      plan: 'premium',
      country: 'US',
    })

    if (userContext) {
      // Evaluate all flags for this user at once
      const decisions = userContext.decideAll()

      if (decisions['new-checkout']?.enabled) {
        // Show new checkout experience
      }

      // Track a conversion event
      await userContext.trackEvent('purchase', { value: 99.99 })
    }
  }
}
```

## API Reference

### `createInstance(config)`

Creates a new SignaKit client and begins fetching flag configuration in the background.

```typescript
const client = createInstance({ sdkKey: 'sk_prod_abc123_1234_xxxx' })
// Returns: SignaKitClient | null
```

Returns `null` if the SDK key is missing or malformed. The SDK key encodes the environment (`dev`/`prod`), org ID, and project ID — the client uses this to construct the correct CDN URL automatically.

---

### `client.onReady()`

Waits for the initial config fetch to complete. Call this before evaluating flags.

```typescript
const { success, reason } = await client.onReady()
// Returns: Promise<OnReadyResult>
// { success: boolean; reason?: string }
```

If the fetch fails after all retries, `success` is `false` and `reason` contains a description of the error.

---

### `client.createUserContext(userId, attributes?)`

Creates a user context for flag evaluation and event tracking.

```typescript
const userContext = client.createUserContext('user-123', {
  plan: 'premium',
  country: 'US',
})
// Returns: SignaKitUserContext | null
```

`userId` must be a non-empty string. `attributes` is an optional `Record<string, string | number | boolean>` used to match targeting rules. Returns `null` if `userId` is invalid.

---

### `userContext.decide(flagKey)`

Evaluates a single feature flag for the user.

```typescript
const decision = userContext.decide('new-checkout')
// Returns: SignaKitDecision | null
```

Returns `null` if the flag key does not exist. Automatically fires a `$exposure` event the first time a flag is evaluated per session.

---

### `userContext.decideAll()`

Evaluates all known flags for the user in one call.

```typescript
const decisions = userContext.decideAll()
// Returns: SignaKitDecisions  (Record<string, SignaKitDecision>)
```

Fires `$exposure` events for each flag, subject to per-session deduplication.

---

### `userContext.trackEvent(eventKey, attributes?)`

Tracks a conversion or custom event.

```typescript
await userContext.trackEvent('purchase', { value: 99.99 })
await userContext.trackEvent('signup')
```

`attributes` is optional. Events are sent via `navigator.sendBeacon` where available, with a `fetch` fallback for environments that do not support it.

---

### `SignaKitDecision`

```typescript
interface SignaKitDecision {
  flagKey: string
  variationKey: string   // e.g. 'control' | 'treatment' | 'off'
  enabled: boolean
  ruleKey: string | null
}
```

A `variationKey` of `'off'` and `enabled: false` means the user is not included in the experiment (either outside the traffic allocation or the flag is disabled).

---

## How It Works

1. **Config fetch** — On `createInstance`, the SDK fetches the flag configuration JSON from the SignaKit CDN. The request includes an `If-None-Match` header so subsequent fetches return `304 Not Modified` when nothing has changed, avoiding redundant data transfer.
2. **Retry with backoff** — If the initial fetch fails, the SDK retries up to 3 times with exponential backoff (1s, 2s, 4s) before resolving `onReady()` with `{ success: false }`.
3. **Local evaluation** — All flag decisions are made in-memory using MurmurHash3 bucketing. No network call is made during `decide()` or `decideAll()`.
4. **Exposure tracking** — When a flag is evaluated, a `$exposure` event is automatically fired. Exposures are deduplicated per flag per browser session using `sessionStorage`, so the event fires at most once per session per user.
5. **Event delivery** — Events are sent via `navigator.sendBeacon` (fire-and-forget, survives page unload). If `sendBeacon` is unavailable, the SDK falls back to `fetch`.

## Bot Detection

The browser SDK automatically inspects `navigator.userAgent` on every `decide()` call. No configuration is required.

When a bot is detected:

- All flag decisions return `{ variationKey: 'off', enabled: false, ... }`
- `$exposure` events and `trackEvent` calls are silently skipped — bots do not affect experiment data

The `isBot` utility is also exported for direct use:

```typescript
import { isBot } from '@signakit/flags-browser'

if (isBot(navigator.userAgent)) {
  // handle bot case
}
```

## TypeScript

Full type definitions are included. Import types alongside the client:

```typescript
import {
  createInstance,
  isBot,
  type SignaKitClientConfig,
  type SignaKitDecision,
  type SignaKitDecisions,
  type SignaKitEvent,
  type UserAttributes,
  type OnReadyResult,
  type TrackEventOptions,
} from '@signakit/flags-browser'
```

## License

MIT
