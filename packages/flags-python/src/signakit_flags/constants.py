"""Constants for the SignaKit Flags Python SDK."""

from __future__ import annotations

SIGNAKIT_CDN_URL: str = "https://d30l2rkped5b4m.cloudfront.net"
SIGNAKIT_EVENTS_URL: str = (
    "https://60amq9ozsf.execute-api.us-east-2.amazonaws.com/v1/flag-events"
)

#: Bucket space for hashing — 0–9999 gives 0.01% granularity.
DEFAULT_POLLING_INTERVAL: float = 30.0  # seconds

BUCKET_SPACE: int = 10000

# Event validation limits — kept in sync with packages/flags-node/src/constants.ts
MAX_EVENT_KEY_LENGTH: int = 100
MAX_USER_ID_LENGTH: int = 256
MAX_METADATA_SIZE_BYTES: int = 5000
MAX_ATTRIBUTES_COUNT: int = 50
MAX_ATTRIBUTE_KEY_LENGTH: int = 100
MAX_ATTRIBUTE_VALUE_LENGTH: int = 1000
