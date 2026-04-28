// Generate MurmurHash3 32-bit test vectors mirroring packages/flags-node/src/hasher.ts
// Usage: node scripts/gen-vectors.js
function murmur3_32(key, seed = 0) {
  const c1 = 0xcc9e2d51, c2 = 0x1b873593, r1 = 15, r2 = 13, m = 5, n = 0xe6546b64;
  let hash = seed >>> 0;
  const len = key.length;
  const blocks = Math.floor(len / 4);
  for (let i = 0; i < blocks; i++) {
    let k =
      (key.charCodeAt(i * 4) & 0xff) |
      ((key.charCodeAt(i * 4 + 1) & 0xff) << 8) |
      ((key.charCodeAt(i * 4 + 2) & 0xff) << 16) |
      ((key.charCodeAt(i * 4 + 3) & 0xff) << 24);
    k = Math.imul(k, c1);
    k = (k << r1) | (k >>> (32 - r1));
    k = Math.imul(k, c2);
    hash ^= k;
    hash = (hash << r2) | (hash >>> (32 - r2));
    hash = Math.imul(hash, m) + n;
  }
  let k = 0;
  const t = blocks * 4;
  switch (len & 3) {
    case 3: k ^= (key.charCodeAt(t + 2) & 0xff) << 16;
    case 2: k ^= (key.charCodeAt(t + 1) & 0xff) << 8;
    case 1:
      k ^= key.charCodeAt(t) & 0xff;
      k = Math.imul(k, c1);
      k = (k << r1) | (k >>> (32 - r1));
      k = Math.imul(k, c2);
      hash ^= k;
  }
  hash ^= len;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}
function bucket(salt, userId) { return murmur3_32(`${salt}:${userId}`) % 10000; }

const cases = [
  ['abc', 'user-1'],
  ['abc', 'user-2'],
  ['my-flag-salt', 'alice'],
  ['my-flag-salt', 'bob'],
  ['x', 'y'],
  ['', 'abc'],
  ['a', 'abcd'],
  ['my-flag-salt:traffic', 'user-1'],
  ['my-flag-salt:variation', 'user-1'],
  ['my-flag-salt:default', 'user-1'],
];
for (const [s, u] of cases) {
  console.log(JSON.stringify({ salt: s, user: u, hash: murmur3_32(`${s}:${u}`), bucket: bucket(s, u) }));
}
