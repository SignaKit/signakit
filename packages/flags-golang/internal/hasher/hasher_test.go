package hasher

import (
	"fmt"
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// Cross-platform vectors (must match flags-node, flags-python, flags-php, flags-flutter)
// ---------------------------------------------------------------------------

func TestHashToBucketCrossplatformVectors(t *testing.T) {
	t.Parallel()
	tests := []struct {
		salt   string
		userID string
		want   int
	}{
		{"salt1", "user-1", 148},
		{"salt1", "user-2", 6905},
		{"flag-abc", "user-123", 7424},
		{"", "x", 4973},
		{"hello", "world", 7566},
	}
	for _, tc := range tests {
		tc := tc
		t.Run(tc.salt+"/"+tc.userID, func(t *testing.T) {
			t.Parallel()
			if got := HashToBucket(tc.salt, tc.userID); got != tc.want {
				t.Errorf("HashToBucket(%q, %q) = %d, want %d", tc.salt, tc.userID, got, tc.want)
			}
		})
	}
}

func TestNamespacedHelpersCrossplatformValues(t *testing.T) {
	t.Parallel()
	if got := HashForTraffic("flag-abc", "user-123"); got != 8406 {
		t.Errorf("HashForTraffic = %d, want 8406", got)
	}
	if got := HashForVariation("flag-abc", "user-123"); got != 2804 {
		t.Errorf("HashForVariation = %d, want 2804", got)
	}
	if got := HashForDefault("flag-abc", "user-123"); got != 6466 {
		t.Errorf("HashForDefault = %d, want 6466", got)
	}
}

// ---------------------------------------------------------------------------
// Raw Murmur3_32 vectors (additionally verify Murmur3_32 output)
//
// Expected values were pre-computed using the reference TypeScript implementation
// (packages/flags-node/src/hasher.ts). Any change here means cross-SDK bucketing
// will diverge for live experiments.
// ---------------------------------------------------------------------------

func TestMurmur3_32_KnownVectors(t *testing.T) {
	t.Parallel()
	tests := []struct {
		salt    string
		userID  string
		rawHash uint32
		bucket  int
	}{
		{"", "", 723937430, 7430},
		{"a", "b", 2722392131, 2131},
		{"flag-1", "user-123", 1828635123, 5123},
		{"salt", "user-1", 284266604, 6604},
		{"salt", "user-2", 4225422170, 2170},
		{"salt", "user-3", 1711596482, 6482},
		{"my-flag-salt", "alice", 2680087070, 7070},
		{"my-flag-salt", "bob", 197736267, 6267},
		{"x", "y", 1402315819, 5819},
		{"abcd", "wxyz", 91575904, 5904},
	}
	for _, tc := range tests {
		tc := tc
		t.Run(tc.salt+":"+tc.userID, func(t *testing.T) {
			t.Parallel()
			key := tc.salt + ":" + tc.userID
			if got := Murmur3_32(key, 0); got != tc.rawHash {
				t.Errorf("Murmur3_32(%q) = %d, want %d", key, got, tc.rawHash)
			}
			if got := HashToBucket(tc.salt, tc.userID); got != tc.bucket {
				t.Errorf("HashToBucket(%q, %q) = %d, want %d", tc.salt, tc.userID, got, tc.bucket)
			}
		})
	}
}

func TestNamespacedHelpersAdditionalVectors(t *testing.T) {
	t.Parallel()
	cases := []struct {
		fn     func(string, string) int
		salt   string
		userID string
		want   int
	}{
		{HashForTraffic, "flag-1", "user-123", 6509},
		{HashForVariation, "flag-1", "user-123", 8299},
		{HashForDefault, "flag-1", "user-123", 5572},
		{HashForTraffic, "salt", "alice", 9411},
		{HashForVariation, "salt", "alice", 1218},
		{HashForDefault, "salt", "alice", 5830},
	}
	for _, tc := range cases {
		if got := tc.fn(tc.salt, tc.userID); got != tc.want {
			t.Errorf("helper(%q, %q) = %d, want %d", tc.salt, tc.userID, got, tc.want)
		}
	}
}

// ---------------------------------------------------------------------------
// Range bounds
// ---------------------------------------------------------------------------

func TestHashToBucketRange(t *testing.T) {
	t.Parallel()
	b := HashToBucket("my-salt", "user-123")
	if b < 0 || b > 9999 {
		t.Errorf("HashToBucket out of range: %d", b)
	}
}

func TestAllNamespacedHelpersRange(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name string
		fn   func(string, string) int
	}{
		{"traffic", HashForTraffic},
		{"variation", HashForVariation},
		{"default", HashForDefault},
	} {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			b := tc.fn("test-salt", "user-xyz")
			if b < 0 || b > 9999 {
				t.Errorf("%s out of range: %d", tc.name, b)
			}
		})
	}
}

func TestBucketsInRangeOverManyUsers(t *testing.T) {
	t.Parallel()
	for i := range 500 {
		b := HashToBucket("salt", fmt.Sprintf("user-%d", i))
		if b < 0 || b > 9999 {
			t.Errorf("user-%d: bucket %d out of range", i, b)
		}
	}
}

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

func TestHashToBucketDeterministic(t *testing.T) {
	t.Parallel()
	if HashToBucket("flag-salt", "user-abc") != HashToBucket("flag-salt", "user-abc") {
		t.Error("HashToBucket is not deterministic")
	}
}

func TestEachNamespacedHelperDeterministic(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name string
		fn   func(string, string) int
	}{
		{"traffic", HashForTraffic},
		{"variation", HashForVariation},
		{"default", HashForDefault},
	} {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if tc.fn("determinism-salt", "user-det") != tc.fn("determinism-salt", "user-det") {
				t.Errorf("%s is not deterministic", tc.name)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Distinctness
// ---------------------------------------------------------------------------

func TestProducesDifferentBucketsForDifferentUserIDs(t *testing.T) {
	t.Parallel()
	seen := make(map[int]bool)
	for i := 1; i <= 5; i++ {
		seen[HashToBucket("same-salt", fmt.Sprintf("user-%d", i))] = true
	}
	if len(seen) < 2 {
		t.Errorf("expected distinct buckets for different user IDs, got %d unique", len(seen))
	}
}

func TestProducesDifferentBucketsForDifferentSalts(t *testing.T) {
	t.Parallel()
	a := HashToBucket("salt-a", "user-1")
	b := HashToBucket("salt-b", "user-1")
	if a == b {
		t.Errorf("expected different buckets for different salts, got %d", a)
	}
}

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

func TestHandlesEmptyStrings(t *testing.T) {
	t.Parallel()
	b := HashToBucket("", "")
	if b < 0 || b > 9999 {
		t.Errorf("empty strings: bucket %d out of range", b)
	}
}

func TestHandlesLongStrings(t *testing.T) {
	t.Parallel()
	b := HashToBucket(strings.Repeat("a", 1000), strings.Repeat("b", 1000))
	if b < 0 || b > 9999 {
		t.Errorf("long strings: bucket %d out of range", b)
	}
}

// ---------------------------------------------------------------------------
// Namespace independence
// ---------------------------------------------------------------------------

func TestTrafficVariationDefaultNamespacesIndependent(t *testing.T) {
	t.Parallel()
	traffic := HashForTraffic("checkout-salt", "user-namespace-test")
	variation := HashForVariation("checkout-salt", "user-namespace-test")
	def := HashForDefault("checkout-salt", "user-namespace-test")
	unique := map[int]bool{traffic: true, variation: true, def: true}
	if len(unique) < 2 {
		t.Errorf("expected at least 2 distinct namespace buckets, got traffic=%d variation=%d default=%d",
			traffic, variation, def)
	}
}
