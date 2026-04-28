import 'package:flutter/widgets.dart';

import '../decision.dart';
import '../types.dart';
import 'signakit_provider.dart';

/// Result returned by [FlagBuilder] / [FlagSnapshot].
@immutable
class FlagSnapshot {
  const FlagSnapshot({
    required this.enabled,
    required this.variationKey,
    required this.ruleKey,
    required this.ruleType,
    required this.variables,
    required this.loading,
  });

  /// Whether the flag is enabled for this user.
  final bool enabled;

  /// The variation key (`'on'`, `'off'`, `'variant_a'`, ...).
  final String variationKey;

  /// Which rule matched, if any.
  final String? ruleKey;

  /// The rule type that produced this decision.
  ///
  /// `null` for default/disabled paths. Useful for branching UI on
  /// `RuleType.targeted` (which fire no exposure events).
  final RuleType? ruleType;

  /// Resolved variable values for the matched variation.
  final Map<String, VariableValue> variables;

  /// True while the SignaKit client is initializing.
  final bool loading;

  static const FlagSnapshot loadingSnapshot = FlagSnapshot(
    enabled: false,
    variationKey: 'off',
    ruleKey: null,
    ruleType: null,
    variables: <String, VariableValue>{},
    loading: true,
  );

  static const FlagSnapshot off = FlagSnapshot(
    enabled: false,
    variationKey: 'off',
    ruleKey: null,
    ruleType: null,
    variables: <String, VariableValue>{},
    loading: false,
  );

  factory FlagSnapshot.fromDecision(Decision? decision) {
    if (decision == null) return off;
    return FlagSnapshot(
      enabled: decision.enabled,
      variationKey: decision.variationKey,
      ruleKey: decision.ruleKey,
      ruleType: decision.ruleType,
      variables: decision.variables,
      loading: false,
    );
  }
}

/// Builder that evaluates [flagKey] against the nearest [SignaKitProvider]
/// and rebuilds when the underlying user context changes.
///
/// Conceptually equivalent to React's `useFlag` hook.
///
/// ```dart
/// FlagBuilder(
///   flagKey: 'new-checkout',
///   builder: (context, flag) {
///     if (flag.loading) return const CircularProgressIndicator();
///     return flag.enabled ? const NewCheckout() : const OldCheckout();
///   },
/// )
/// ```
class FlagBuilder extends StatefulWidget {
  const FlagBuilder({
    super.key,
    required this.flagKey,
    required this.builder,
  });

  final String flagKey;
  final Widget Function(BuildContext context, FlagSnapshot snapshot) builder;

  @override
  State<FlagBuilder> createState() => _FlagBuilderState();
}

class _FlagBuilderState extends State<FlagBuilder> {
  @override
  Widget build(BuildContext context) {
    final ctxValue = SignaKitProvider.maybeOf(context);
    if (ctxValue == null) {
      throw FlutterError(
        '[SignaKit] FlagBuilder must be used inside a SignaKitProvider.',
      );
    }

    if (ctxValue.loading || ctxValue.userContext == null) {
      return widget.builder(context, FlagSnapshot.loadingSnapshot);
    }

    // decide() fires an exposure event (fire-and-forget) on each call.
    // Calling inside build matches the React `useFlag` behavior; the
    // server deduplicates exposure storms server-side.
    final decision = ctxValue.userContext!.decide(widget.flagKey);
    final snapshot = FlagSnapshot.fromDecision(decision);
    return widget.builder(context, snapshot);
  }
}
