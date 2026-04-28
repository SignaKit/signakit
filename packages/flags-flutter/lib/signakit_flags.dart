/// Official Flutter SDK for SignaKit Feature Flags.
///
/// Fetches flag configurations from CloudFront/S3 and evaluates flags
/// locally with deterministic bucketing. Cross-SDK consistent (Node,
/// Browser, PHP, Laravel, React, Flutter).
library signakit_flags;

// Core API
export 'src/client.dart' show SignaKitClient, SignaKitClientConfig, createInstance;
export 'src/user_context.dart' show SignaKitUserContext;
export 'src/decision.dart' show Decision, Decisions;
export 'src/types.dart'
    show
        Environment,
        RuleType,
        AudienceMatchType,
        FlagStatus,
        UserAttributes,
        VariableValue,
        OnReadyResult,
        SignaKitEvent,
        TrackEventOptions,
        ProjectConfig,
        ConfigFlag,
        ConfigRule,
        ConfigRuleAudience,
        AudienceCondition,
        AllowlistEntry,
        Variation,
        VariationAllocation,
        VariationAllocationRange,
        FlagVariable;

// Utilities
export 'src/bot_patterns.dart' show isBot;

// Flutter widgets
export 'src/widgets/signakit_provider.dart'
    show SignaKitProvider, SignaKitContextValue;
export 'src/widgets/flag_builder.dart' show FlagBuilder, FlagSnapshot;
