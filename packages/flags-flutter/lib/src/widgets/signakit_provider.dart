import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../client.dart';
import '../types.dart';
import '../user_context.dart';

/// State exposed to descendants via [SignaKitProvider].
@immutable
class SignaKitContextValue {
  const SignaKitContextValue({
    required this.userContext,
    required this.loading,
  });

  final SignaKitUserContext? userContext;
  final bool loading;

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is SignaKitContextValue &&
        other.userContext == userContext &&
        other.loading == loading;
  }

  @override
  int get hashCode => Object.hash(userContext, loading);
}

/// A `ChangeNotifier` that owns the [SignaKitClient] lifecycle.
class _SignaKitController extends ChangeNotifier {
  _SignaKitController({
    required this.sdkKey,
    required this.userId,
    required this.attributes,
  }) {
    _initialize();
  }

  final String sdkKey;
  String userId;
  UserAttributes attributes;

  SignaKitClient? _client;
  SignaKitContextValue _value = const SignaKitContextValue(
    userContext: null,
    loading: true,
  );
  SignaKitContextValue get value => _value;

  bool _disposed = false;

  Future<void> _initialize() async {
    final client = createInstance(SignaKitClientConfig(sdkKey: sdkKey));
    if (_disposed) {
      client?.close();
      return;
    }
    if (client == null) {
      _set(const SignaKitContextValue(userContext: null, loading: false));
      return;
    }

    final result = await client.onReady();
    if (_disposed) {
      client.close();
      return;
    }
    if (!result.success) {
      // Fail open: render children without a userContext.
      _set(const SignaKitContextValue(userContext: null, loading: false));
      return;
    }

    _client = client;
    final ctx = client.createUserContext(userId, attributes: attributes);
    _set(SignaKitContextValue(userContext: ctx, loading: false));
  }

  /// Recreate the user context when [userId] or [attributes] change.
  void updateUser({required String userId, required UserAttributes attributes}) {
    this.userId = userId;
    this.attributes = attributes;
    final client = _client;
    if (client == null) return;
    final ctx = client.createUserContext(userId, attributes: attributes);
    _set(SignaKitContextValue(userContext: ctx, loading: false));
  }

  void _set(SignaKitContextValue v) {
    if (_value == v) return;
    _value = v;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _client?.close();
    super.dispose();
  }
}

class _SignaKitScope extends InheritedNotifier<_SignaKitController> {
  const _SignaKitScope({
    required _SignaKitController super.notifier,
    required super.child,
  });
}

/// Provides a [SignaKitUserContext] to descendant widgets.
///
/// Use [FlagBuilder] (or [SignaKitProvider.maybeOf]) to read flag decisions
/// from any descendant.
///
/// ```dart
/// SignaKitProvider(
///   sdkKey: 'sk_dev_org_proj_xxx',
///   userId: 'user-123',
///   child: MaterialApp(home: HomeScreen()),
/// )
/// ```
class SignaKitProvider extends StatefulWidget {
  const SignaKitProvider({
    super.key,
    required this.sdkKey,
    required this.userId,
    required this.child,
    this.attributes = const <String, Object?>{},
    this.loadingFallback,
  });

  final String sdkKey;
  final String userId;
  final UserAttributes attributes;
  final Widget child;

  /// Rendered while the client is initializing. Defaults to [child]
  /// (fail-open). Pass a `CircularProgressIndicator` to gate UI on init.
  final Widget? loadingFallback;

  /// Read the [SignaKitContextValue] from the nearest [SignaKitProvider].
  ///
  /// Throws if no provider is found.
  static SignaKitContextValue of(BuildContext context) {
    final value = maybeOf(context);
    if (value == null) {
      throw FlutterError(
        '[SignaKit] SignaKitProvider.of() called with no SignaKitProvider in scope.',
      );
    }
    return value;
  }

  /// Read the [SignaKitContextValue], or `null` if no provider is in scope.
  static SignaKitContextValue? maybeOf(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<_SignaKitScope>();
    return scope?.notifier?.value;
  }

  @override
  State<SignaKitProvider> createState() => _SignaKitProviderState();
}

class _SignaKitProviderState extends State<SignaKitProvider> {
  late _SignaKitController _controller;

  @override
  void initState() {
    super.initState();
    _controller = _SignaKitController(
      sdkKey: widget.sdkKey,
      userId: widget.userId,
      attributes: widget.attributes,
    );
  }

  @override
  void didUpdateWidget(SignaKitProvider oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.sdkKey != widget.sdkKey) {
      // SDK key changed → start over with a fresh controller.
      _controller.dispose();
      _controller = _SignaKitController(
        sdkKey: widget.sdkKey,
        userId: widget.userId,
        attributes: widget.attributes,
      );
      return;
    }
    if (oldWidget.userId != widget.userId ||
        !mapEquals(oldWidget.attributes, widget.attributes)) {
      _controller.updateUser(
        userId: widget.userId,
        attributes: widget.attributes,
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _SignaKitScope(
      notifier: _controller,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          final value = _controller.value;
          if (value.loading && widget.loadingFallback != null) {
            return widget.loadingFallback!;
          }
          return widget.child;
        },
      ),
    );
  }
}
