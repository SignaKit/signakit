package hasher

import "testing"

// TestMurmur3_32_KnownVectors locks in cross-SDK compatibility.
//
// Expected values were captured by running the reference TypeScript
// implementation (packages/flags-node/src/hasher.ts). If any of these change,
// users will be re-bucketed across SDKs and live experiments will break.
func TestMurmur3_32_KnownVectors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		key      string
		seed     uint32
		hash     uint32
		bucket   int
	}{
		{"", 0, 0, 0},
		{"a", 0, 1009084850, 4850},
		{"hello", 0, 613153351, 3351},
		{"salt:user-123", 0, 2051974123, 4123},
		{"flag-salt:traffic:user-abc", 0, 3671728962, 8962},
		{"my-flag-salt:variation:user-42", 0, 1829801020, 1020},
		{"xyz:default:bob", 0, 307562710, 2710},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.key, func(t *testing.T) {
			t.Parallel()
			got := Murmur3_32(tc.key, tc.seed)
			if got != tc.hash {
				t.Errorf("Murmur3_32(%q) = %d, want %d", tc.key, got, tc.hash)
			}
			if int(got%BucketSpace) != tc.bucket {
				t.Errorf("bucket(%q) = %d, want %d", tc.key, got%BucketSpace, tc.bucket)
			}
		})
	}
}

func TestHashNamespaces(t *testing.T) {
	t.Parallel()
	// Sanity: namespaces produce different buckets for the same input.
	traffic := HashForTraffic("salt", "user-1")
	variation := HashForVariation("salt", "user-1")
	def := HashForDefault("salt", "user-1")
	if traffic == variation && variation == def {
		t.Errorf("expected distinct namespace buckets, got traffic=%d variation=%d default=%d", traffic, variation, def)
	}
	if traffic < 0 || traffic >= BucketSpace {
		t.Errorf("traffic bucket out of range: %d", traffic)
	}
}

func TestHashDeterministic(t *testing.T) {
	t.Parallel()
	for i := 0; i < 100; i++ {
		if HashToBucket("flag-x", "user-y") != HashToBucket("flag-x", "user-y") {
			t.Fatal("hash not deterministic")
		}
	}
}
