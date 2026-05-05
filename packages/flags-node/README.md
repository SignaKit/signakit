# @signakit/flags-node

Official Node.js SDK for SignaKit Feature Flags. Fetches flag configurations from CloudFront/S3 and evaluates all flags locally — no network call on the hot `decide()` path.

## Installation

```bash
npm install @signakit/flags-node
```

## Quick Start

### 1. Create a module-level singleton

Create the client **once** so it is shared across all requests in the same process. The config fetch kicks off immediately on module load.

```typescript
// lib/signakit.ts
import { createInstance } from '@signakit/flags-node'

const client = createInstance({
  sdkKey: process.env.SIGNAKIT_SDK_KEY!,
})

export const signakit = client
// Kick off the config fetch immediately — await this before evaluating flags
export const signakitReady = client?.onReady()
```

> **Never call `createInstance` inside a request handler or route.** Every call creates a new instance that re-fetches config, bypasses deduplication, and adds latency. Create the singleton once at module level.

### 2. Evaluate a flag

```typescript
import { signakit, signakitReady } from '@/lib/signakit'

export async function getCheckoutVariant(visitorId: string) {
  await signakitReady

  const userCtx = signakit?.createUserContext(visitorId)
  const decision = userCtx?.decide('checkout-redesign')

  return decision?.variationKey === 'treatment' ? 'v2' : 'legacy'
}
```

### 3. Track a conversion

```typescript
const userCtx = signakit?.createUserContext(visitorId)
await userCtx?.trackEvent('purchase_completed', { value: 99.99 })
```

## Next.js App Router

Evaluate flags in server components and pass results as props to client components.

```typescript
// lib/signakit.ts
import { createInstance } from '@signakit/flags-node'

const client = createInstance({ sdkKey: process.env.SIGNAKIT_SDK_KEY! })

export const signakit = client
export const signakitReady = client?.onReady()
```

```typescript
// app/checkout/page.tsx
import { signakit, signakitReady } from '@/lib/signakit'
import { cookies } from 'next/headers'

export default async function CheckoutPage() {
  await signakitReady

  const cookieStore = await cookies()
  const visitorId = cookieStore.get('visitor_id')?.value ?? 'anonymous'

  const userCtx = signakit?.createUserContext(visitorId)
  const checkout = userCtx?.decide('checkout-redesign')

  return checkout?.variationKey === 'treatment' ? <CheckoutV2 /> : <LegacyCheckout />
}
```

See the full [Next.js App Router guide](https://docs.signakit.com/flags/guides/nextjs-app-router) for middleware, server actions, and conversion tracking patterns.

## Bot Detection

Pass `$userAgent` as an attribute to enable automatic bot filtering. Detected bots receive `enabled: false` / `variationKey: 'off'` for every flag, and no exposure events are fired.

```typescript
const userCtx = signakit?.createUserContext(visitorId, {
  $userAgent: request.headers['user-agent'] ?? undefined,
  plan: 'pro',
})
```

You can also use the `isBot` utility directly:

```typescript
import { isBot } from '@signakit/flags-node'

if (isBot(userAgent)) {
  // Handle bot traffic differently
}
```

## API Reference

### `createInstance(config)`

Creates a new SignaKit client. Starts fetching config immediately.

```typescript
const client = createInstance({
  sdkKey: process.env.SIGNAKIT_SDK_KEY!,
  pollingInterval: 30_000, // optional, default 30 000 ms
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `sdkKey` | `string` | required | Your SignaKit SDK key (`sk_dev_…` or `sk_prod_…`) |
| `pollingInterval` | `number` | `30000` | How often (ms) to re-fetch config. Uses ETags — a no-op poll is a lightweight conditional GET. Set to `0` to disable polling. |

**Returns:** `SignaKitClient | null` — `null` if the SDK key is missing or malformed.

---

### `client.onReady()`

Resolves once the initial config fetch completes.

```typescript
const { success, reason } = await client.onReady()

if (!success) {
  console.error('SignaKit failed to load config:', reason)
  // Flags return null — treat as control/off state
}
```

**Returns:** `Promise<{ success: boolean; reason?: string }>`

Always await `onReady()` before calling `createUserContext()`. If you skip it, `createUserContext()` returns `null` and logs a warning.

---

### `client.createUserContext(userId, attributes?)`

Creates a user context for flag evaluation. One context per request is the recommended pattern.

```typescript
const userCtx = client.createUserContext('user-123', {
  plan: 'premium',
  country: 'US',
  $userAgent: request.headers['user-agent'] ?? undefined,
})
```

| Parameter | Type | Description |
|---|---|---|
| `userId` | `string` | Stable unique identifier. The same ID always produces the same variation for a given config. |
| `attributes` | `UserAttributes` | Key-value pairs for audience targeting. Supported value types: `string`, `number`, `boolean`, `string[]`. Pass `$userAgent` to enable bot detection. |

**Returns:** `SignaKitUserContext | null` — `null` if the client is not yet ready.

---

### `client.destroy()`

Stops the background polling loop and releases resources. Call this in tests or when the client is no longer needed.

```typescript
client.destroy()
```

---

### `userContext.decide(flagKey)`

Evaluates a single flag for this user. Fires an `$exposure` event automatically (fire-and-forget) for A/B test and multi-armed-bandit rules.

```typescript
const decision = userCtx?.decide('new-checkout-flow')

// Feature flag gate
if (decision?.enabled) {
  // Show new checkout
}

// A/B test variation branch
if (decision?.variationKey === 'treatment') {
  // Show treatment
}
```

**Returns:** `SignaKitDecision | null` — `null` when the flag is not found, archived, or the user matches no rule.

#### `SignaKitDecision`

```typescript
interface SignaKitDecision {
  flagKey: string                                         // The flag key evaluated
  variationKey: string                                    // Assigned variation: 'control', 'treatment', 'off', or a custom key
  enabled: boolean                                        // true when the flag is on for this user
  ruleKey: string | null                                  // The targeting rule that matched, or null for default allocation
  ruleType: 'ab-test' | 'multi-armed-bandit' | 'targeted' | null  // Rule type, or null for default/disabled
  variables: Record<string, string | number | boolean | Record<string, unknown>>  // Resolved variable values
}
```

Always null-check or use optional chaining — a `null` result means the flag is off/unrecognised and should be treated as the control state.

---

### `userContext.decideAll()`

Evaluates all flags for this user. Fires an `$exposure` event for each flag (fire-and-forget).

```typescript
const decisions = userCtx?.decideAll()
// decisions: Record<string, SignaKitDecision>

const showNewNav = decisions?.['redesigned-nav']?.enabled ?? false
```

**Returns:** `SignaKitDecisions` (`Record<string, SignaKitDecision>`)

Use `decide('specific-flag')` in preference to `decideAll()` when only one flag is needed — `decideAll()` fires an exposure event for every flag the user is bucketed into.

---

### `userContext.trackEvent(eventKey, options?)`

Tracks a conversion event. Events are sent immediately and include the user's current flag decisions for experiment attribution.

```typescript
// Simple event
await userCtx?.trackEvent('signup')

// Event with revenue value
await userCtx?.trackEvent('purchase_completed', { value: 99.99 })

// Event with metadata
await userCtx?.trackEvent('form_submit', {
  metadata: { formId: 'contact-form' },
})
```

| Parameter | Type | Description |
|---|---|---|
| `eventKey` | `string` | The event key as defined in the SignaKit dashboard |
| `options.value` | `number` | Optional numeric value (e.g. revenue amount) |
| `options.metadata` | `Record<string, unknown>` | Optional metadata (max 4 KB serialised) |

**Returns:** `Promise<void>` — never throws. Errors are logged internally and do not affect the response path. Events from detected bots are silently dropped.

---

## TypeScript

The SDK is written in TypeScript and ships full type definitions.

```typescript
import {
  createInstance,
  isBot,
  type SignaKitClientConfig,
  type OnReadyResult,
  type UserAttributes,
  type SignaKitDecision,
  type SignaKitDecisions,
  type SignaKitEvent,
  type TrackEventOptions,
  type VariableValue,
  type FlagVariable,
} from '@signakit/flags-node'
```

## How It Works

1. **Config fetch** — On `createInstance()`, the SDK immediately fetches a JSON config (flag definitions, rules, audience conditions) from the SignaKit CDN via CloudFront/S3.
2. **Local evaluation** — All `decide()` / `decideAll()` calls are pure in-memory operations. No network call per evaluation.
3. **Background polling** — The config is re-fetched on the configured `pollingInterval` (default 30 s) using conditional GETs (`If-None-Match`). A 304 Not Modified response costs minimal bandwidth and CPU.
4. **Consistent bucketing** — MurmurHash3 on `userId + flagSalt` deterministically assigns a variation. The same user ID always gets the same variation for the same config version.
5. **Automatic exposure tracking** — `decide()` fires a fire-and-forget `$exposure` event for A/B test and multi-armed-bandit rules. `targeted` rollout rules are excluded — they have no experiment to attribute.
6. **Event attribution** — `trackEvent()` automatically includes the user's current flag decisions so conversion events are correctly attributed to the active experiment arms.

## Contributing

Bug reports and pull requests are welcome. See [CONTRIBUTING.md](https://github.com/SignaKit/signakit/blob/main/CONTRIBUTING.md) for development setup, test conventions, and PR guidelines.

## License

MIT
