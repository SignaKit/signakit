# @signakit/flags-python

Official Python SDK for [SignaKit](https://signakit.com) Feature Flags.

Fetches flag configurations from SignaKit's CloudFront CDN and evaluates them
locally with consistent bucketing across all SignaKit SDKs (Node.js, Browser,
React, PHP, Laravel, Python).

- **Async-first** — async/await with `httpx` (sync API also available)
- **Type-safe** — `mypy --strict` clean, fully type-annotated
- **Cross-language consistent** — MurmurHash3-based bucketing produces the same
  variation for the same `userId` in every SDK
- **Bot detection** — bots get the `off` variation and are excluded from events
- **Targeted-rule exposures skipped** — exposure events are only fired for
  experiments (A/B tests, multi-armed bandits), not for simple feature rollouts

## Installation

```bash
pip install signakit-flags
```

Requires Python 3.11+.

## Quick start

```python
import asyncio

from signakit_flags import SignaKitClient


async def main() -> None:
    client = SignaKitClient(sdk_key="sk_dev_orgId_projectId_random")

    ready = await client.on_ready()
    if not ready.success:
        print(f"SignaKit not ready: {ready.reason}")
        return

    user = client.create_user_context(
        user_id="user-123",
        attributes={"plan": "premium", "country": "US"},
    )
    if user is None:
        return

    decision = user.decide("new-checkout-flow")
    if decision and decision.enabled:
        # Show the new checkout flow
        ...

    # Track a conversion event with revenue
    await user.track_event("purchase", value=99.99, metadata={"sku": "abc"})


asyncio.run(main())
```

### Synchronous usage

```python
from signakit_flags import SignaKitClient

client = SignaKitClient(sdk_key="sk_prod_orgId_projectId_random")
ready = client.on_ready_sync()
if ready.success:
    user = client.create_user_context("user-123")
    decision = user.decide("new-checkout-flow") if user else None
```

## API surface

| Symbol | Description |
|---|---|
| `SignaKitClient(sdk_key=...)` | Create a client. Validates the key shape. |
| `await client.on_ready()` / `client.on_ready_sync()` | Fetch the config and mark the client ready. |
| `client.create_user_context(user_id, attributes)` | Build a per-user evaluator. |
| `ctx.decide(flag_key)` → `Decision \| None` | Evaluate a single flag. |
| `ctx.decide_all()` → `dict[str, Decision]` | Evaluate every non-archived flag. |
| `await ctx.track_event(event_key, value=..., metadata=...)` | Fire a conversion event. |
| `is_bot(user_agent)` | Standalone bot-UA detector. |
| `parse_sdk_key(key)` | Decode an SDK key into org/project/environment. |

## License

MIT
