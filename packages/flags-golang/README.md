# @signakit/flags-golang

Official Go SDK for [SignaKit](https://signakit.io) feature flags, A/B tests,
and experimentation.

The SDK fetches your project config from the SignaKit CDN (with ETag-based
conditional refresh), evaluates flags locally, and posts exposure / conversion
events to the SignaKit events API.

It is a faithful port of `@signakit/flags-node` — bucket numbers are
byte-for-byte identical across Node, browser, PHP, and Go SDKs, so users see
the same variations everywhere.

## Install

```bash
go get github.com/signakit/flags-golang@latest
```

Requires Go 1.22+.

## Quick start

```go
package main

import (
    "context"
    "fmt"
    "log"

    "github.com/signakit/flags-golang/signakit"
)

func main() {
    ctx := context.Background()

    client, err := signakit.NewClient(ctx, "sk_prod_org123_proj456_random")
    if err != nil {
        log.Fatalf("signakit: %v", err)
    }

    user := client.CreateUserContext("user-42", signakit.UserAttributes{
        "plan":       "premium",
        "country":    "US",
        "$userAgent": "Mozilla/5.0 ...", // optional, used for bot detection
    })

    if d := user.Decide("new-checkout"); d != nil && d.Enabled {
        fmt.Println("show new checkout, variation:", d.VariationKey)
    }

    user.TrackEvent("purchase",
        signakit.WithValue(99.99),
        signakit.WithMetadata(map[string]any{"sku": "abc-123"}),
    )
}
```

## API

### `NewClient(ctx, sdkKey, opts...) (*Client, error)`

Synchronously fetches the initial project config. Returns an error if the SDK
key is malformed or the fetch fails.

Options:

| Option | Default | Notes |
|--------|---------|-------|
| `WithHTTPClient(*http.Client)` | 10s timeout | Used for both CDN and events |
| `WithLogger(*slog.Logger)` | `slog.Default()` | Structured logging |
| `WithCDNBaseURL(string)` | CloudFront prod | Override for tests |
| `WithEventsURL(string)` | Lambda prod | Override for tests |
| `WithSyncEventDispatch()` | async | Make events synchronous (tests) |

### `client.CreateUserContext(userID, attrs)`

Returns a `*UserContext`. Not safe for concurrent use — create one per
request/user.

If `attrs["$userAgent"]` matches a known bot pattern, all flags return `off`
disabled and events are dropped silently. The `$userAgent` attribute is
stripped before audience evaluation.

### `userContext.Decide(flagKey) *Decision`

Returns the user's decision for a single flag, or `nil` if the flag is missing
or archived. Fires an `$exposure` event in the background **except** when the
decision came from a `targeted` rule (no experiment to attribute).

### `userContext.DecideAll() Decisions`

Evaluates every active flag. Fires one `$exposure` event per non-targeted
decision.

### `userContext.TrackEvent(eventKey, opts...)`

Records a conversion event. Options:

- `WithValue(float64)` — numeric value, e.g. revenue
- `WithMetadata(map[string]any)` — dropped if larger than 5KB

## Cross-SDK compatibility

The hashing layer ports MurmurHash3 32-bit faithfully from
`packages/flags-node/src/hasher.ts` (constants `c1=0xcc9e2d51`,
`c2=0x1b873593`, finalization mix `0x85ebca6b` / `0xc2b2ae35`). For ASCII
inputs (the only inputs the SDK ever feeds it: salts, namespaces, user IDs)
bucket numbers are identical to Node, browser, and PHP SDKs.

## Layout

```
signakit/                  public API
├── client.go              Client, options, dispatch
├── user_context.go        UserContext, TrackEvent
├── decision.go, types.go  exported types
└── constants.go

internal/
├── hasher/                MurmurHash3 + bucket helpers
├── audience/              condition matcher
├── evaluator/             rule pipeline
├── configmgr/             ETag-based CDN fetcher
└── botua/                 user-agent bot detection
```
