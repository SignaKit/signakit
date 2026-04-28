// Package signakit provides the public API for the SignaKit feature-flag SDK.
package signakit

// CDN and events endpoints.
const (
	// SignaKitCDNURL is the base URL for the public flag-config CDN.
	SignaKitCDNURL = "https://d30l2rkped5b4m.cloudfront.net"
	// SignaKitEventsURL is the events ingestion endpoint.
	SignaKitEventsURL = "https://60amq9ozsf.execute-api.us-east-2.amazonaws.com/v1/flag-events"
)

// Bucketing.
const (
	// BucketSpace is the size of the bucket space (0-9999) — 0.01% granularity.
	BucketSpace = 10000
)

// Event-payload sanitization limits.
const (
	MaxEventKeyLength       = 100
	MaxUserIDLength         = 256
	MaxMetadataSizeBytes    = 5000
	MaxAttributesCount      = 50
	MaxAttributeKeyLength   = 100
	MaxAttributeValueLength = 1000
)
