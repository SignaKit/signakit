package signakit

import "github.com/signakit/flags-golang/internal/types"

// Decision is the result of evaluating a single flag for a user.
type Decision = types.Decision

// Decisions is a flagKey -> Decision map (matches flags-node SignaKitDecisions).
type Decisions = types.Decisions

// Event is the wire shape posted to the events API.
type Event = types.Event
