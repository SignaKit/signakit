package signakit

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/signakit/flags-golang/internal/configmgr"
	"github.com/signakit/flags-golang/internal/evaluator"
)

// ClientOption configures a Client at construction time.
type ClientOption func(*clientConfig)

type clientConfig struct {
	httpClient    *http.Client
	logger        *slog.Logger
	cdnBaseURL    string
	eventsURL     string
	asyncDispatch bool
}

// WithHTTPClient overrides the *http.Client used for both config fetches and
// event posts. Default: timeout 10s.
func WithHTTPClient(c *http.Client) ClientOption {
	return func(cc *clientConfig) { cc.httpClient = c }
}

// WithLogger sets the slog.Logger. Default: slog.Default().
func WithLogger(l *slog.Logger) ClientOption {
	return func(cc *clientConfig) { cc.logger = l }
}

// WithCDNBaseURL overrides the CDN base URL (mainly for tests).
func WithCDNBaseURL(u string) ClientOption {
	return func(cc *clientConfig) { cc.cdnBaseURL = u }
}

// WithEventsURL overrides the events ingestion URL (mainly for tests).
func WithEventsURL(u string) ClientOption {
	return func(cc *clientConfig) { cc.eventsURL = u }
}

// WithSyncEventDispatch makes TrackEvent / exposure posts synchronous instead
// of fire-and-forget goroutines. Useful in tests.
func WithSyncEventDispatch() ClientOption {
	return func(cc *clientConfig) { cc.asyncDispatch = false }
}

// Client is a SignaKit feature-flag client. It is safe for concurrent use.
type Client struct {
	sdkKey        string
	configMgr     *configmgr.Manager
	httpClient    *http.Client
	logger        *slog.Logger
	eventsURL     string
	asyncDispatch bool
}

// NewClient constructs a Client and synchronously fetches the initial config.
// Returns an error if the SDK key is malformed or the initial fetch fails.
func NewClient(ctx context.Context, sdkKey string, opts ...ClientOption) (*Client, error) {
	if sdkKey == "" {
		return nil, errors.New("signakit: sdkKey is required")
	}

	cc := &clientConfig{
		httpClient:    &http.Client{Timeout: 10 * time.Second},
		logger:        slog.Default(),
		cdnBaseURL:    SignaKitCDNURL,
		eventsURL:     SignaKitEventsURL,
		asyncDispatch: true,
	}
	for _, opt := range opts {
		opt(cc)
	}

	orgID, projectID, env, err := configmgr.ParseSDKKey(sdkKey)
	if err != nil {
		return nil, err
	}

	mgr := configmgr.New(configmgr.Options{
		OrgID:       orgID,
		ProjectID:   projectID,
		Environment: env,
		BaseURL:     cc.cdnBaseURL,
		HTTPClient:  cc.httpClient,
	})

	if _, err := mgr.Fetch(ctx); err != nil {
		return nil, err
	}

	return &Client{
		sdkKey:        sdkKey,
		configMgr:     mgr,
		httpClient:    cc.httpClient,
		logger:        cc.logger,
		eventsURL:     cc.eventsURL,
		asyncDispatch: cc.asyncDispatch,
	}, nil
}

// Refresh re-fetches the project config (using ETag/304 if applicable).
func (c *Client) Refresh(ctx context.Context) error {
	_, err := c.configMgr.Fetch(ctx)
	return err
}

// Config returns the currently cached project config (nil if not yet fetched).
func (c *Client) Config() *ProjectConfig {
	return c.configMgr.Get()
}

// CreateUserContext creates a UserContext for evaluating flags as a specific
// user. Pass nil attributes if none are needed.
func (c *Client) CreateUserContext(userID string, attrs UserAttributes) *UserContext {
	uc := &UserContext{
		client:     c,
		userID:     userID,
		attributes: UserAttributes{},
	}
	// Detect bot from $userAgent and strip the attribute (not used for targeting).
	if attrs != nil {
		if uaRaw, ok := attrs["$userAgent"]; ok {
			if ua, ok := uaRaw.(string); ok {
				uc.isBot = isBotUA(ua)
			}
		}
		for k, v := range attrs {
			if k == "$userAgent" {
				continue
			}
			uc.attributes[k] = v
		}
	}
	return uc
}

// evaluateFlag evaluates a single flag. Returns nil if the flag is missing or
// archived.
func (c *Client) evaluateFlag(flagKey, userID string, attrs UserAttributes) *Decision {
	cfg := c.configMgr.Get()
	if cfg == nil {
		c.logger.Error("signakit: no config available")
		return nil
	}
	for i := range cfg.Flags {
		if cfg.Flags[i].Key == flagKey {
			return evaluator.EvaluateFlag(cfg.Flags[i], userID, attrs)
		}
	}
	c.logger.Warn("signakit: flag not found", "flagKey", flagKey)
	return nil
}

func (c *Client) evaluateAllFlags(userID string, attrs UserAttributes) Decisions {
	cfg := c.configMgr.Get()
	if cfg == nil {
		c.logger.Error("signakit: no config available")
		return Decisions{}
	}
	return evaluator.EvaluateAll(cfg, userID, attrs)
}

// botDecisions returns "off" decisions for every active flag.
func (c *Client) botDecisions() Decisions {
	cfg := c.configMgr.Get()
	if cfg == nil {
		return Decisions{}
	}
	out := make(Decisions, len(cfg.Flags))
	for _, f := range cfg.Flags {
		if f.Status == FlagStatusArchived {
			continue
		}
		out[f.Key] = Decision{
			FlagKey:      f.Key,
			VariationKey: "off",
			Enabled:      false,
			RuleKey:      nil,
			RuleType:     nil,
			Variables:    map[string]any{},
		}
	}
	return out
}

// sendEvent POSTs an event to the ingestion API. Errors are logged.
func (c *Client) sendEvent(ctx context.Context, event Event) {
	body, err := json.Marshal(map[string]any{"events": []Event{event}})
	if err != nil {
		c.logger.Error("signakit: marshal event", "err", err)
		return
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.eventsURL, bytes.NewReader(body))
	if err != nil {
		c.logger.Error("signakit: build event request", "err", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-SDK-Key", c.sdkKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		c.logger.Error("signakit: send event", "err", err)
		return
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		c.logger.Error("signakit: event api error", "status", resp.Status)
	}
}

// dispatchEvent fires the event either synchronously or in a goroutine,
// depending on client configuration.
func (c *Client) dispatchEvent(event Event) {
	if !c.asyncDispatch {
		// Synchronous path (tests). Use a fresh background context so the
		// caller's context cancellation doesn't kill in-flight events.
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		c.sendEvent(ctx, event)
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		c.sendEvent(ctx, event)
	}()
}

// truncate returns s shortened to at most max characters.
func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

// nowRFC3339 returns the current time in RFC3339 format.
func nowRFC3339() string {
	return time.Now().UTC().Format(time.RFC3339)
}
