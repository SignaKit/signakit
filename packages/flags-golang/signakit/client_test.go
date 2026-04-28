package signakit

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
)

// makeServers spins up a CDN server returning the given config and an events
// server that captures POST bodies.
func makeServers(t *testing.T, cfg ProjectConfig) (cdn *httptest.Server, events *httptest.Server, capturedEvents *[]Event, mu *sync.Mutex) {
	t.Helper()

	cdn = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(cfg)
	}))

	captured := make([]Event, 0)
	mu = &sync.Mutex{}
	events = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var payload struct {
			Events []Event `json:"events"`
		}
		if err := json.Unmarshal(body, &payload); err != nil {
			t.Errorf("event server: bad json: %v", err)
		}
		mu.Lock()
		captured = append(captured, payload.Events...)
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))

	return cdn, events, &captured, mu
}

func newTestClient(t *testing.T, cfg ProjectConfig) (*Client, *[]Event, *sync.Mutex, func()) {
	t.Helper()
	cdn, events, captured, mu := makeServers(t, cfg)
	c, err := NewClient(context.Background(), "sk_dev_org_proj_random",
		WithCDNBaseURL(cdn.URL),
		WithEventsURL(events.URL),
		WithSyncEventDispatch(),
	)
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	cleanup := func() {
		cdn.Close()
		events.Close()
	}
	return c, captured, mu, cleanup
}

func ptrRuleType(rt RuleType) *RuleType { return &rt }

func TestClientDecideTargetedSkipsExposure(t *testing.T) {
	t.Parallel()

	cfg := ProjectConfig{
		ProjectID:      "proj",
		EnvironmentKey: EnvironmentDevelopment,
		SDKKey:         "sk",
		Version:        1,
		Flags: []ConfigFlag{{
			ID:      "1",
			Key:     "rollout-flag",
			Salt:    "s1",
			Status:  FlagStatusActive,
			Running: true,
			Variations: []Variation{
				{Key: "on"},
				{Key: "off"},
			},
			Allocation: VariationAllocation{
				Ranges: []VariationAllocationRange{{Variation: "off", Start: 0, End: 9999}},
			},
			Rules: []ConfigRule{{
				RuleKey:           "targeted-1",
				RuleType:          RuleTypeTargeted,
				TrafficPercentage: 100,
				VariationAllocation: VariationAllocation{
					Ranges: []VariationAllocationRange{{Variation: "on", Start: 0, End: 9999}},
				},
			}},
		}},
	}

	client, captured, mu, cleanup := newTestClient(t, cfg)
	defer cleanup()

	uc := client.CreateUserContext("user-1", nil)
	d := uc.Decide("rollout-flag")
	if d == nil || d.VariationKey != "on" {
		t.Fatalf("expected variation=on, got %+v", d)
	}
	if d.RuleType == nil || *d.RuleType != RuleTypeTargeted {
		t.Fatalf("expected targeted ruleType, got %+v", d.RuleType)
	}

	mu.Lock()
	defer mu.Unlock()
	for _, e := range *captured {
		if e.EventKey == "$exposure" {
			t.Errorf("expected NO $exposure event for targeted decision, got: %+v", e)
		}
	}
}

func TestClientDecideExperimentFiresExposure(t *testing.T) {
	t.Parallel()

	cfg := ProjectConfig{
		ProjectID:      "proj",
		EnvironmentKey: EnvironmentDevelopment,
		SDKKey:         "sk",
		Version:        1,
		Flags: []ConfigFlag{{
			ID:      "1",
			Key:     "exp-flag",
			Salt:    "s1",
			Status:  FlagStatusActive,
			Running: true,
			Variations: []Variation{
				{Key: "treatment"}, {Key: "control"}, {Key: "off"},
			},
			Allocation: VariationAllocation{
				Ranges: []VariationAllocationRange{
					{Variation: "control", Start: 0, End: 4999},
					{Variation: "treatment", Start: 5000, End: 9999},
				},
			},
			Rules: []ConfigRule{{
				RuleKey:           "exp-1",
				RuleType:          RuleTypeABTest,
				TrafficPercentage: 100,
				VariationAllocation: VariationAllocation{
					Ranges: []VariationAllocationRange{
						{Variation: "treatment", Start: 0, End: 9999},
					},
				},
			}},
		}},
	}

	client, captured, mu, cleanup := newTestClient(t, cfg)
	defer cleanup()

	uc := client.CreateUserContext("user-1", nil)
	d := uc.Decide("exp-flag")
	if d == nil {
		t.Fatal("nil decision")
	}

	mu.Lock()
	defer mu.Unlock()
	found := false
	for _, e := range *captured {
		if e.EventKey == "$exposure" {
			found = true
			if e.Metadata["flagKey"] != "exp-flag" {
				t.Errorf("metadata.flagKey=%v", e.Metadata["flagKey"])
			}
		}
	}
	if !found {
		t.Errorf("expected $exposure event for ab-test decision")
	}
}

func TestClientBotSkipsAll(t *testing.T) {
	t.Parallel()

	cfg := ProjectConfig{
		ProjectID:      "proj",
		EnvironmentKey: EnvironmentDevelopment,
		SDKKey:         "sk",
		Version:        1,
		Flags: []ConfigFlag{{
			ID: "1", Key: "f1", Salt: "s", Status: FlagStatusActive, Running: true,
			Variations: []Variation{{Key: "on"}, {Key: "off"}},
			Allocation: VariationAllocation{
				Ranges: []VariationAllocationRange{{Variation: "on", Start: 0, End: 9999}},
			},
		}},
	}

	client, captured, mu, cleanup := newTestClient(t, cfg)
	defer cleanup()

	uc := client.CreateUserContext("u", UserAttributes{
		"$userAgent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
	})
	d := uc.Decide("f1")
	if d == nil || d.Enabled {
		t.Errorf("expected disabled bot decision, got %+v", d)
	}
	if d.VariationKey != "off" {
		t.Errorf("expected off, got %s", d.VariationKey)
	}
	uc.TrackEvent("purchase", WithValue(99.99))

	mu.Lock()
	defer mu.Unlock()
	if len(*captured) != 0 {
		t.Errorf("expected zero events for bot, got %d", len(*captured))
	}
}

func TestClientTrackEventIncludesCachedDecisions(t *testing.T) {
	t.Parallel()

	cfg := ProjectConfig{
		ProjectID:      "proj",
		EnvironmentKey: EnvironmentDevelopment,
		SDKKey:         "sk",
		Version:        1,
		Flags: []ConfigFlag{{
			ID: "1", Key: "f1", Salt: "s", Status: FlagStatusActive, Running: true,
			Variations: []Variation{{Key: "on"}, {Key: "off"}},
			Allocation: VariationAllocation{
				Ranges: []VariationAllocationRange{{Variation: "on", Start: 0, End: 9999}},
			},
		}},
	}

	client, captured, mu, cleanup := newTestClient(t, cfg)
	defer cleanup()

	uc := client.CreateUserContext("u", nil)
	uc.Decide("f1")
	uc.TrackEvent("purchase", WithValue(42.0), WithMetadata(map[string]any{"sku": "abc"}))

	mu.Lock()
	defer mu.Unlock()
	var purchase *Event
	for i := range *captured {
		if (*captured)[i].EventKey == "purchase" {
			purchase = &(*captured)[i]
		}
	}
	if purchase == nil {
		t.Fatal("expected purchase event")
	}
	if purchase.Decisions["f1"] != "on" {
		t.Errorf("decisions=%+v", purchase.Decisions)
	}
	if purchase.Value == nil || *purchase.Value != 42.0 {
		t.Errorf("expected value=42, got %+v", purchase.Value)
	}
	if purchase.Metadata["sku"] != "abc" {
		t.Errorf("metadata=%+v", purchase.Metadata)
	}
}
