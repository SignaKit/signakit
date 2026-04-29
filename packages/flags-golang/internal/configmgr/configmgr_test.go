package configmgr_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/signakit/flags-golang/internal/configmgr"
	"github.com/signakit/flags-golang/signakit"
)

func TestParseSDKKey(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name      string
		key       string
		wantEnv   signakit.Environment
		wantOrg   string
		wantProj  string
		wantError bool
	}{
		{"dev", "sk_dev_org123_proj456_random", signakit.EnvironmentDevelopment, "org123", "proj456", false},
		{"prod", "sk_prod_o_p_r", signakit.EnvironmentProduction, "o", "p", false},
		{"too few parts", "sk_dev_org_proj", "", "", "", true},
		{"missing prefix", "xx_dev_org_proj_r", "", "", "", true},
		{"bad env", "sk_staging_org_proj_r", "", "", "", true},
	}
	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			org, proj, env, err := configmgr.ParseSDKKey(tc.key)
			if tc.wantError {
				if err == nil {
					t.Errorf("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if org != tc.wantOrg || proj != tc.wantProj || env != tc.wantEnv {
				t.Errorf("got (%s,%s,%s), want (%s,%s,%s)", org, proj, env, tc.wantOrg, tc.wantProj, tc.wantEnv)
			}
		})
	}
}

func TestManagerFetchAnd304(t *testing.T) {
	t.Parallel()

	hits := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		if r.Header.Get("If-None-Match") == `"v1"` {
			w.WriteHeader(http.StatusNotModified)
			return
		}
		w.Header().Set("ETag", `"v1"`)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"projectId":"p","environmentKey":"development","sdkKey":"sk","version":1,"flags":[],"generatedAt":"now"}`))
	}))
	defer server.Close()

	m := configmgr.New(configmgr.Options{
		OrgID: "org", ProjectID: "proj",
		Environment: signakit.EnvironmentDevelopment,
		BaseURL:     server.URL,
	})

	cfg, err := m.Fetch(context.Background())
	if err != nil {
		t.Fatalf("first fetch: %v", err)
	}
	if cfg.ProjectID != "p" {
		t.Errorf("got projectId=%s", cfg.ProjectID)
	}

	// Second call should hit 304 and return cached config.
	cfg2, err := m.Fetch(context.Background())
	if err != nil {
		t.Fatalf("second fetch: %v", err)
	}
	if cfg2 != cfg {
		// Same pointer because ETag hit returned cache.
		t.Errorf("expected same cached pointer on 304")
	}
	if hits != 2 {
		t.Errorf("expected 2 server hits, got %d", hits)
	}
}
