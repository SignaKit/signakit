export const SIGNAKIT_CDN_URL = 'https://d30l2rkped5b4m.cloudfront.net'

export const DEFAULT_POLLING_INTERVAL = 30_000 // ms

export const SIGNAKIT_EVENTS_URL =
  'https://60amq9ozsf.execute-api.us-east-2.amazonaws.com/v1/flag-events'

export const BUCKET_SPACE = 10000 // 0-9999 for 0.01% granularity

// Event validation limits
export const MAX_EVENT_KEY_LENGTH = 100
export const MAX_USER_ID_LENGTH = 256
export const MAX_METADATA_SIZE_BYTES = 5000
export const MAX_ATTRIBUTES_COUNT = 50
export const MAX_ATTRIBUTE_KEY_LENGTH = 100
export const MAX_ATTRIBUTE_VALUE_LENGTH = 1000
