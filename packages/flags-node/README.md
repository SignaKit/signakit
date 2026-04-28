# @signakit/flags-node

Official Node.js SDK for SignaKit Feature Flags. Fetches flag configurations from CloudFront/S3 and evaluates all flags locally for a user.

## Installation

```bash
npm install @signakit/flags-node
```

## Environment Variables

Set SDK key in your environment:

```bash
SIGNAKIT_SDK_KEY=sk_dev_abc123xyz_1234_abcdef123456
```

## Quick Start

### Usage in Next.js (Server-Side)

```typescript
// lib/signakit/getFlags.ts
'use server'

import { cookies, headers } from 'next/headers'
import { createInstance, type SignaKitDecisions, type SignaKitUserContext } from '@signakit/flags-node'

interface Props {
  slug: string
}

interface FlagsResult {
  userContext: SignaKitUserContext
  decisions: SignaKitDecisions
}

export async function getFlags({ slug }: Props): Promise<FlagsResult | null> {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const visitorId = cookieStore.get('visitor_id')?.value

  if (!visitorId) {
    console.error('Missing visitor ID')
    return null
  }

  const client = createInstance({
    sdkKey: process.env.SIGNAKIT_SDK_KEY!,
  })

  if (!client) {
    console.error('SignaKit client not created')
    return null
  }

  const { success, reason } = await client.onReady()
  if (!success) {
    console.error('SignaKit client not ready:', reason)
    return null
  }

  const userContext = client.createUserContext(visitorId, {
    slug,
    $userAgent: headerStore.get('user-agent') ?? undefined,
  })

  if (!userContext) {
    console.error('User context could not be created')
    return null
  }

  const decisions = userContext.decideAll()

  return { userContext, decisions }
}
```

```typescript
// app/page.tsx
import { getFlags } from '@/lib/signakit/getFlags'

export default async function Home() {
  const flags = await getFlags({ slug: '/home/' })

  return (
    <main>
      {flags?.decisions['new-homepage']?.variationKey === 'treatment' ? (
        <NewHomepage />
      ) : (
        <DefaultHomepage />
      )}
    </main>
  )
}
```

### Tracking Conversion Events

To track events for experiment analysis, use `userContext.trackEvent()`. Events are sent immediately to the events API.

```typescript
// app/page.tsx
import { getFlags } from '@/lib/signakit/getFlags'

export default async function Home() {
  const flags = await getFlags({ slug: '/home/' })

  // Track page view event
  if (flags?.userContext) {
    await flags.userContext.trackEvent('page_view')
  }

  return (
    <main>
      {flags?.decisions['new-homepage']?.variationKey === 'treatment' ? (
        <NewHomepage />
      ) : (
        <DefaultHomepage />
      )}
    </main>
  )
}
```

```typescript
// Track event with value (e.g., revenue)
await userContext.trackEvent('purchase', { value: 99.99 })

// Track event with metadata
await userContext.trackEvent('form_submit', {
  metadata: { formId: 'contact-form' }
})
```

### Bot Detection

The SDK can automatically detect bot traffic and exclude it from A/B tests. Pass the `$userAgent` attribute to enable bot detection:

```typescript
const userContext = client.createUserContext(visitorId, {
  slug,
  $userAgent: request.headers.get('user-agent') ?? undefined,
})
```

When a bot is detected:
- All flags return `{ variationKey: 'off', enabled: false }` (excluded from experiments)
- Events are silently skipped (not sent to the API)

This ensures bots don't skew your experiment results or inflate event counts.

You can also use the `isBot` utility directly:

```typescript
import { isBot } from '@signakit/flags-node'

if (isBot(userAgent)) {
  // Handle bot traffic differently
}
```

## API Reference

### `createInstance(config)`

Creates a new SignaKit Feature Flags client instance.

```typescript
const client = createInstance({
  sdkKey: 'sk_dev_abc123xyz_1234_abcdef123456',
})
```

**Parameters:**
- `config.sdkKey` (required): Your SDK key from the SignaKit dashboard

**Returns:** `SignaKitClient | null`

### `client.onReady()`

Waits for the client to fetch the initial configuration.

```typescript
const { success, reason } = await client.onReady()
```

**Returns:** `Promise<{ success: boolean, reason?: string }>`

### `client.createUserContext(userId, attributes)`

Creates a user context for evaluating flags.

```typescript
const userContext = client.createUserContext('user-123', {
  plan: 'premium',
  country: 'US',
  $userAgent: request.headers.get('user-agent') ?? undefined,
})
```

**Parameters:**
- `userId` (required): Unique identifier for the user (used for consistent bucketing)
- `attributes` (optional): User attributes for audience targeting
- `$userAgent` (optional): User-agent string for bot detection. If a bot is detected, flags return `off` and events are skipped.

**Returns:** `SignaKitUserContext | null`

### `userContext.decide(flagKey)`

Evaluates a single flag for the user and returns the decision.

```typescript
const decision = userContext.decide('new-checkout-flow')

if (decision?.enabled) {
  // Show new checkout flow
}

// Or check specific variation
if (decision?.variationKey === 'treatment') {
  // Show treatment variation
}
```

**Parameters:**
- `flagKey` (required): The key of the flag to evaluate

**Returns:** `SignaKitDecision | null` - The decision object, or `null` if flag not found/archived

### `userContext.decideAll()`

Evaluates all flags for the user and returns decisions.

```typescript
const decisions = userContext.decideAll()
```

**Returns:** `SignaKitDecisions` - Map of flag keys to decision objects

### Decision Object

```typescript
interface SignaKitDecision {
  flagKey: string      // The flag key
  variationKey: string // The variation key ('control', 'treatment', 'off', etc.)
  enabled: boolean     // Whether the flag is enabled for this user
  ruleKey: string | null // Which rule matched, if any
}
```

### `userContext.trackEvent(eventKey, options?)`

Tracks a conversion event for the user. Sends immediately to the events API.

```typescript
// Simple event
await userContext.trackEvent('signup')

// Event with value
await userContext.trackEvent('purchase', { value: 99.99 })

// Event with metadata
await userContext.trackEvent('form_submit', { metadata: { formId: 'contact' } })
```

**Parameters:**
- `eventKey` (required): The event key (e.g., 'purchase', 'signup')
- `options.value` (optional): Numeric value (e.g., revenue amount)
- `options.metadata` (optional): Additional event metadata

**Returns:** `Promise<void>`

Events automatically include:
- User ID and attributes
- Timestamp
- Active flag decisions (for experiment attribution)

## How It Works

1. **Config Fetching**: The SDK fetches a JSON configuration from CloudFront/S3 containing all flag definitions, rules, and audience conditions.

2. **Local Evaluation**: All flag evaluation happens locally. No network calls during `decide()` or `decideAll()`.

3. **Consistent Bucketing**: Uses MurmurHash3 for deterministic bucketing. The same user ID always gets the same variation.

4. **Rule Evaluation**: Rules are evaluated in priority order. First matching rule wins.

5. **Automatic Exposure Tracking**: When `decide()` or `decideAll()` is called, the SDK automatically fires `$exposure` events (fire-and-forget). This enables experiment analysis without manual tracking.

## Automatic Exposure Tracking

The SDK automatically tracks exposure events when flags are evaluated. This happens transparently when you call `decide()` or `decideAll()`.

### How It Works

- Each call to `decide(flagKey)` sends an `$exposure` event for that flag
- Each call to `decideAll()` sends an `$exposure` event for each flag
- Events are fire-and-forget (non-blocking, errors are silently ignored)
- Bots are excluded from exposure tracking (no events sent)

### Exposure Event Structure

```json
{
  "eventKey": "$exposure",
  "userId": "user-123",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "attributes": { "plan": "premium" },
  "decisions": { "checkout-redesign": "treatment" },
  "metadata": {
    "flagKey": "checkout-redesign",
    "variationKey": "treatment",
    "ruleKey": "rule-0"
  }
}
```

### Deduplication

The backend deduplicates exposure events within a 15-second window per user/flag/page combination. This means:
- Multiple `decide()` calls on the same page won't create duplicate exposures
- A user navigating to a new page will generate a new exposure event

### Why Automatic Tracking?

- **No manual instrumentation required**: Exposure data is captured automatically
- **Accurate experiment analysis**: Every flag evaluation is tracked
- **Non-blocking**: Fire-and-forget pattern ensures no impact on app performance

## TypeScript Support

The SDK is written in TypeScript and includes full type definitions.

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
} from '@signakit/flags-node'
```

## License

MIT
