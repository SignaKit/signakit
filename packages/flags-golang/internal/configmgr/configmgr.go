// Package configmgr fetches and caches the project flag config from CDN.
//
// Implements ETag-based conditional GETs (If-None-Match → 304 returns cached
// config) and is safe for concurrent use via a sync.RWMutex.
package configmgr

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/signakit/flags-golang/internal/types"
)

const defaultCDNURL = "https://d30l2rkped5b4m.cloudfront.net"

// Options configure a Manager.
type Options struct {
	OrgID       string
	ProjectID   string
	Environment types.Environment
	// BaseURL overrides the CDN base (useful for tests). Defaults to
	// types.SignaKitCDNURL.
	BaseURL string
	// HTTPClient overrides the HTTP client. Defaults to one with a 10s timeout.
	HTTPClient *http.Client
}

// Manager owns the cached project config and refresh logic.
type Manager struct {
	opts   Options
	client *http.Client

	mu     sync.RWMutex
	config *types.ProjectConfig
	etag   string
}

// New constructs a Manager. It does not perform any I/O.
func New(opts Options) *Manager {
	if opts.BaseURL == "" {
		opts.BaseURL = defaultCDNURL
	}
	client := opts.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	return &Manager{opts: opts, client: client}
}

// URL returns the fully-qualified config URL.
func (m *Manager) URL() string {
	base := strings.TrimRight(m.opts.BaseURL, "/")
	return fmt.Sprintf("%s/configs/%s/%s/%s/latest.json",
		base, m.opts.OrgID, m.opts.ProjectID, m.opts.Environment)
}

// Fetch downloads the config (or returns the cached one on 304). Safe for
// concurrent callers.
func (m *Manager) Fetch(ctx context.Context) (*types.ProjectConfig, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, m.URL(), nil)
	if err != nil {
		return nil, fmt.Errorf("signakit: build config request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	m.mu.RLock()
	etag := m.etag
	cached := m.config
	m.mu.RUnlock()

	if etag != "" {
		req.Header.Set("If-None-Match", etag)
	}

	resp, err := m.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("signakit: fetch config: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusNotModified && cached != nil {
		return cached, nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("signakit: fetch config: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("signakit: read config body: %w", err)
	}
	var cfg types.ProjectConfig
	if err := json.Unmarshal(body, &cfg); err != nil {
		return nil, fmt.Errorf("signakit: parse config: %w", err)
	}

	newEtag := resp.Header.Get("ETag")

	m.mu.Lock()
	m.config = &cfg
	if newEtag != "" {
		m.etag = newEtag
	}
	m.mu.Unlock()

	return &cfg, nil
}

// Get returns the most recently fetched config, or nil if Fetch has never
// completed successfully.
func (m *Manager) Get() *types.ProjectConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.config
}

// ParseSDKKey extracts orgId, projectId, and environment from an SDK key.
//
// SDK key format: sk_{env}_{orgId}_{projectId}_{random}
//   - env: "dev" → development, "prod" → production
func ParseSDKKey(sdkKey string) (orgID, projectID string, env types.Environment, err error) {
	parts := strings.Split(sdkKey, "_")
	if len(parts) < 5 || parts[0] != "sk" {
		err = errors.New("signakit: invalid SDK key format, expected sk_{env}_{orgId}_{projectId}_{random}")
		return
	}
	envShort, orgID, projectID := parts[1], parts[2], parts[3]
	if envShort == "" || orgID == "" || projectID == "" {
		err = errors.New("signakit: invalid SDK key: missing env/orgId/projectId")
		return
	}
	switch envShort {
	case "dev":
		env = types.EnvironmentDevelopment
	case "prod":
		env = types.EnvironmentProduction
	default:
		err = fmt.Errorf("signakit: invalid SDK key environment %q (expected dev or prod)", envShort)
		return
	}
	return
}
