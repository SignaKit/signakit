# signakit_flags

Official Flutter SDK for [SignaKit](https://signakit.com) Feature Flags & A/B Testing.

- Local evaluation — flag config is fetched once from CloudFront and cached.
- Deterministic bucketing — same `userId` always sees the same variation, across every SignaKit SDK (Node, Browser, PHP, Laravel, React, Flutter).
- Built-in bot detection — bots get the `off` variation and skip event tracking.
- Idiomatic Flutter — `SignaKitProvider` + `FlagBuilder` for widget-tree integration.

## Install

```yaml
dependencies:
  signakit_flags: ^0.1.0
```

```bash
flutter pub get
```

## Quick start

```dart
import 'package:flutter/material.dart';
import 'package:signakit_flags/signakit_flags.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return SignaKitProvider(
      sdkKey: 'sk_dev_yourOrg_yourProj_xxxxx',
      userId: 'user-123',
      attributes: const {
        'plan': 'pro',
        'country': 'US',
      },
      loadingFallback: const Center(child: CircularProgressIndicator()),
      child: MaterialApp(
        title: 'My App',
        home: const HomeScreen(),
      ),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Home')),
      body: FlagBuilder(
        flagKey: 'new-checkout-flow',
        builder: (context, flag) {
          if (flag.loading) {
            return const Center(child: CircularProgressIndicator());
          }
          return Center(
            child: Text(
              flag.enabled ? 'New checkout!' : 'Old checkout',
            ),
          );
        },
      ),
    );
  }
}
```

## Track conversion events

```dart
final ctx = SignaKitProvider.of(context).userContext;
await ctx?.trackEvent('purchase', value: 99.99, metadata: {'sku': 'A1'});
```

## Direct client usage (no widgets)

```dart
final client = createInstance(const SignaKitClientConfig(sdkKey: 'sk_...'));
final ready = await client?.onReady();
if (ready?.success ?? false) {
  final ctx = client!.createUserContext('user-123');
  final decision = ctx?.decide('new-checkout-flow');
  print(decision?.variationKey);
}
```

## Behavior notes

- `decide()` automatically fires a `$exposure` event (fire-and-forget) for the matched decision, **except** when `decision.ruleType == RuleType.targeted`. Targeted rollouts are simple feature flags with no experiment to attribute, so exposures would be noise.
- Bots (detected from the optional `$userAgent` attribute) always receive `'off'` and never emit events.
- `decideAll()` evaluates every flag in the project and fires one exposure per non-targeted flag.

## License

MIT
