# @signakit/flags-java

SignaKit Feature Flags SDK for Java (Java 17+).

Feature parity with `@signakit/flags-node`. Bucketing is byte-for-byte
compatible across SDKs — the same `userId` will land in the same variation
whether evaluated in Node, PHP, or Java.

## Installation

Maven:

```xml
<dependency>
  <groupId>com.signakit</groupId>
  <artifactId>flags-java</artifactId>
  <version>0.1.0</version>
</dependency>
```

## Usage

```java
import com.signakit.flags.*;

SignaKitClient client = new SignaKitClient(
        SignaKitClientConfig.of(System.getenv("SIGNAKIT_SDK_KEY")));

if (!client.onReady()) {
    throw new IllegalStateException("SignaKit failed to load config");
}

UserAttributes attrs = UserAttributes.of(java.util.Map.of(
        "plan", "premium",
        "country", "US",
        UserAttributes.USER_AGENT_KEY, "Mozilla/5.0 ..."));

SignaKitUserContext user = client.createUserContext("user-123", attrs);

Decision decision = user.decide("new-checkout-flow");
if (decision != null && decision.enabled()) {
    // show treatment
}

// Track a conversion (returns CompletableFuture<Void>)
user.trackEvent("purchase",
        TrackEventOptions.builder().value(99.99).build());
```

### Targeted rules and exposures

Decisions produced by **targeted** rules (simple feature-flag rollouts)
intentionally skip the `$exposure` event — there is no experiment to
attribute. A/B tests and multi-armed bandits fire exposures asynchronously.

### Bot traffic

Pass the request user-agent as `$userAgent`. Detected bots receive
`{ enabled: false, variationKey: "off" }` for every flag and produce no
events.

## Build

```bash
cd packages/flags-java
mvn -q test
```

## Algorithmic notes

- MurmurHash3 (32-bit) — direct port of `packages/flags-node/src/hasher.ts`,
  including the UTF-16-code-unit-then-`& 0xff` packing the JS implementation
  uses. Test vectors in `HasherTest` lock this in.
- Bucket space is 10000 (0.01% granularity).
- Hash namespaces: `{salt}:traffic`, `{salt}:variation`, `{salt}:default`.
