// Package hasher implements deterministic MurmurHash3 32-bit bucketing.
//
// This implementation is a faithful port of packages/flags-node/src/hasher.ts.
// For ASCII inputs (the only inputs the SDK ever feeds it: salts, namespaces,
// and userIds) it produces byte-for-byte identical bucket numbers as the
// Node.js, browser, and PHP SDKs. Any divergence here would cause users to be
// allocated to different variations across language boundaries.
package hasher

// BucketSpace mirrors signakit.BucketSpace; duplicated here to keep the
// internal package free of cycles.
const BucketSpace = 10000

// Murmur3_32 returns the 32-bit MurmurHash3 of key with the given seed.
//
// Constants and mixing match Austin Appleby's reference and the TypeScript
// SDK's port (c1=0xcc9e2d51, c2=0x1b873593, fmix with 0x85ebca6b / 0xc2b2ae35).
// Like the TS version it consumes the low byte of each rune (charCodeAt & 0xff)
// — for ASCII strings this is identical to []byte(s).
func Murmur3_32(key string, seed uint32) uint32 {
	const (
		c1 uint32 = 0xcc9e2d51
		c2 uint32 = 0x1b873593
		r1        = 15
		r2        = 13
		m  uint32 = 5
		n  uint32 = 0xe6546b64
	)

	hash := seed
	// We hash the low-byte of each character, matching `key.charCodeAt(i) & 0xff`.
	// For pure ASCII this equals []byte(key); for non-ASCII it matches the TS
	// SDK's (lossy) behavior, ensuring cross-SDK agreement.
	b := make([]byte, len(key))
	for i := 0; i < len(key); i++ {
		b[i] = key[i] & 0xff
	}
	length := len(b)
	blocks := length / 4

	for i := 0; i < blocks; i++ {
		k := uint32(b[i*4]) |
			uint32(b[i*4+1])<<8 |
			uint32(b[i*4+2])<<16 |
			uint32(b[i*4+3])<<24

		k *= c1
		k = (k << r1) | (k >> (32 - r1))
		k *= c2

		hash ^= k
		hash = (hash << r2) | (hash >> (32 - r2))
		hash = hash*m + n
	}

	// Tail
	var k uint32
	tailIndex := blocks * 4
	switch length & 3 {
	case 3:
		k ^= uint32(b[tailIndex+2]) << 16
		fallthrough
	case 2:
		k ^= uint32(b[tailIndex+1]) << 8
		fallthrough
	case 1:
		k ^= uint32(b[tailIndex])
		k *= c1
		k = (k << r1) | (k >> (32 - r1))
		k *= c2
		hash ^= k
	}

	// Finalization
	hash ^= uint32(length)
	hash ^= hash >> 16
	hash *= 0x85ebca6b
	hash ^= hash >> 13
	hash *= 0xc2b2ae35
	hash ^= hash >> 16

	return hash
}

// HashToBucket hashes salt+":"+userId into the [0, BucketSpace) range.
func HashToBucket(salt, userID string) int {
	key := salt + ":" + userID
	return int(Murmur3_32(key, 0) % BucketSpace)
}

// HashForTraffic returns the user's bucket in the traffic namespace.
func HashForTraffic(salt, userID string) int {
	return HashToBucket(salt+":traffic", userID)
}

// HashForVariation returns the user's bucket in the variation namespace.
func HashForVariation(salt, userID string) int {
	return HashToBucket(salt+":variation", userID)
}

// HashForDefault returns the user's bucket in the default-allocation namespace.
func HashForDefault(salt, userID string) int {
	return HashToBucket(salt+":default", userID)
}
