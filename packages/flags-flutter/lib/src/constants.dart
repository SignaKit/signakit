/// SignaKit SDK constants. Mirrors `packages/flags-node/src/constants.ts`.
const String kSignaKitCdnUrl = 'https://d30l2rkped5b4m.cloudfront.net';

const String kSignaKitEventsUrl =
    'https://60amq9ozsf.execute-api.us-east-2.amazonaws.com/v1/flag-events';

/// Bucket space (0-9999) for 0.01% granularity.
const int kBucketSpace = 10000;

// Event validation limits.
const int kMaxEventKeyLength = 100;
const int kMaxUserIdLength = 256;
const int kMaxMetadataSizeBytes = 5000;
const int kMaxAttributesCount = 50;
const int kMaxAttributeKeyLength = 100;
const int kMaxAttributeValueLength = 1000;
