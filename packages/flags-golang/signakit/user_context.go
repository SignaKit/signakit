package signakit

import (
	"encoding/json"

	"github.com/signakit/flags-golang/internal/botua"
)

// isBotUA is a thin wrapper so client.go does not need to import the internal
// package directly.
func isBotUA(ua string) bool { return botua.IsBot(ua) }

// UserContext represents a single user being evaluated against the flag set.
// Not safe for concurrent use; create one per request/user.
type UserContext struct {
	client          *Client
	userID          string
	attributes      UserAttributes
	cachedDecisions map[string]string
	isBot           bool
}

// UserID returns the user identifier this context was created with.
func (u *UserContext) UserID() string { return u.userID }

// Attributes returns a copy-free view of the user's attributes (with the
// $userAgent key already stripped).
func (u *UserContext) Attributes() UserAttributes { return u.attributes }

// Decide evaluates a single flag for the user and returns the resulting
// Decision. If the flag is missing or archived, it returns nil.
//
// As a side effect, an "$exposure" event is dispatched (fire-and-forget by
// default) unless the decision came from a "targeted" rule.
func (u *UserContext) Decide(flagKey string) *Decision {
	if u.isBot {
		return &Decision{
			FlagKey:      flagKey,
			VariationKey: "off",
			Enabled:      false,
			RuleKey:      nil,
			RuleType:     nil,
			Variables:    map[string]any{},
		}
	}

	d := u.client.evaluateFlag(flagKey, u.userID, u.attributes)
	if d == nil {
		return nil
	}

	if u.cachedDecisions == nil {
		u.cachedDecisions = map[string]string{}
	}
	u.cachedDecisions[flagKey] = d.VariationKey

	u.trackExposure(*d)
	return d
}

// DecideAll evaluates every active flag for the user, returning a map of
// flagKey → Decision. Archived flags are omitted.
//
// Exposure events are dispatched for each non-targeted decision.
func (u *UserContext) DecideAll() Decisions {
	if u.isBot {
		return u.client.botDecisions()
	}

	decisions := u.client.evaluateAllFlags(u.userID, u.attributes)
	if u.cachedDecisions == nil {
		u.cachedDecisions = make(map[string]string, len(decisions))
	}
	for k, d := range decisions {
		u.cachedDecisions[k] = d.VariationKey
		u.trackExposure(d)
	}
	return decisions
}

// trackExposure dispatches an "$exposure" event, skipping decisions that came
// from a "targeted" rule (those are simple feature-flag rollouts and produce
// only noise on the exposures pipeline).
func (u *UserContext) trackExposure(d Decision) {
	if d.RuleType != nil && *d.RuleType == RuleTypeTargeted {
		return
	}
	event := Event{
		EventKey:  "$exposure",
		UserID:    truncate(u.userID, MaxUserIDLength),
		Timestamp: nowRFC3339(),
		Decisions: map[string]string{d.FlagKey: d.VariationKey},
		Metadata: map[string]any{
			"flagKey":      d.FlagKey,
			"variationKey": d.VariationKey,
			"ruleKey":      d.RuleKey, // *string serialises as null when nil
		},
	}
	if attrs := sanitizeAttributes(u.attributes); attrs != nil {
		event.Attributes = attrs
	}
	u.client.dispatchEvent(event)
}

// EventOption configures a TrackEvent call.
type EventOption func(*eventOptions)

type eventOptions struct {
	value    *float64
	metadata map[string]any
}

// WithValue attaches a numeric value (e.g. revenue) to the event.
func WithValue(v float64) EventOption {
	return func(o *eventOptions) { o.value = &v }
}

// WithMetadata attaches arbitrary metadata to the event. The map is dropped
// (with a logged warning) if it serialises to more than MaxMetadataSizeBytes.
func WithMetadata(m map[string]any) EventOption {
	return func(o *eventOptions) { o.metadata = m }
}

// TrackEvent records a conversion event for the user.
//
// For bots, this is a no-op. The event is dispatched fire-and-forget by
// default (see WithSyncEventDispatch for tests).
func (u *UserContext) TrackEvent(eventKey string, opts ...EventOption) {
	if u.isBot {
		return
	}

	cfg := &eventOptions{}
	for _, opt := range opts {
		opt(cfg)
	}

	event := Event{
		EventKey:  truncate(eventKey, MaxEventKeyLength),
		UserID:    truncate(u.userID, MaxUserIDLength),
		Timestamp: nowRFC3339(),
	}
	if attrs := sanitizeAttributes(u.attributes); attrs != nil {
		event.Attributes = attrs
	}
	if len(u.cachedDecisions) > 0 {
		event.Decisions = u.cachedDecisions
	}
	if cfg.value != nil {
		event.Value = cfg.value
	}
	if cfg.metadata != nil {
		raw, err := json.Marshal(cfg.metadata)
		switch {
		case err != nil:
			u.client.logger.Warn("signakit: metadata marshal failed; dropping", "err", err)
		case len(raw) > MaxMetadataSizeBytes:
			u.client.logger.Warn("signakit: metadata exceeds limit; dropping",
				"limit", MaxMetadataSizeBytes, "size", len(raw))
		default:
			event.Metadata = cfg.metadata
		}
	}

	u.client.dispatchEvent(event)
}

// sanitizeAttributes truncates keys/values and caps the total attribute count
// to match the limits defined in constants.go.
func sanitizeAttributes(attrs UserAttributes) UserAttributes {
	if len(attrs) == 0 {
		return nil
	}
	out := make(UserAttributes, len(attrs))
	count := 0
	for k, v := range attrs {
		if count >= MaxAttributesCount {
			break
		}
		count++
		key := truncate(k, MaxAttributeKeyLength)
		switch val := v.(type) {
		case nil:
			continue
		case string:
			out[key] = truncate(val, MaxAttributeValueLength)
		case []string:
			limit := len(val)
			if limit > 100 {
				limit = 100
			}
			truncated := make([]string, limit)
			for i := 0; i < limit; i++ {
				truncated[i] = truncate(val[i], MaxAttributeValueLength)
			}
			out[key] = truncated
		default:
			out[key] = val
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}
