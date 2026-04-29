import 'package:flutter_test/flutter_test.dart';
import 'package:signakit_flags/src/hasher.dart';

void main() {
  // ---------------------------------------------------------------------------
  // Cross-platform hash vectors (must match flags-node, flags-python, flags-php)
  // ---------------------------------------------------------------------------

  group('hashToBucket canonical cross-platform vectors', () {
    final vectors = <(String, String, int)>[
      ('salt1', 'user-1', 148),
      ('salt1', 'user-2', 6905),
      ('flag-abc', 'user-123', 7424),
      ('', 'x', 4973),
      ('hello', 'world', 7566),
    ];

    for (final (salt, userId, expected) in vectors) {
      test('hashToBucket($salt, $userId) == $expected', () {
        expect(hashToBucket(salt, userId), equals(expected));
      });
    }
  });

  test('namespaced helpers match expected cross-platform values', () {
    expect(hashForTraffic('flag-abc', 'user-123'), equals(8406));
    expect(hashForVariation('flag-abc', 'user-123'), equals(2804));
    expect(hashForDefault('flag-abc', 'user-123'), equals(6466));
  });

  // ---------------------------------------------------------------------------
  // Raw murmur3_32 vectors (additionally verify murmur3_32 output)
  // ---------------------------------------------------------------------------

  group('murmur3_32 raw vectors', () {
    final vectors = <(String, String, int, int)>[
      ('', '', 723937430, 7430),
      ('a', 'b', 2722392131, 2131),
      ('flag-1', 'user-123', 1828635123, 5123),
      ('salt', 'user-1', 284266604, 6604),
      ('salt', 'user-2', 4225422170, 2170),
      ('salt', 'user-3', 1711596482, 6482),
      ('my-flag-salt', 'alice', 2680087070, 7070),
      ('my-flag-salt', 'bob', 197736267, 6267),
      ('x', 'y', 1402315819, 5819),
      ('abcd', 'wxyz', 91575904, 5904),
    ];

    for (final (salt, userId, expectedRaw, expectedBucket) in vectors) {
      test('murmur3_32($salt:$userId) == $expectedRaw, bucket == $expectedBucket', () {
        expect(murmur3_32('$salt:$userId'), equals(expectedRaw));
        expect(hashToBucket(salt, userId), equals(expectedBucket));
      });
    }
  });

  test('namespaced helper dart vectors', () {
    expect(hashForTraffic('flag-1', 'user-123'), equals(6509));
    expect(hashForVariation('flag-1', 'user-123'), equals(8299));
    expect(hashForDefault('flag-1', 'user-123'), equals(5572));
    expect(hashForTraffic('salt', 'alice'), equals(9411));
    expect(hashForVariation('salt', 'alice'), equals(1218));
    expect(hashForDefault('salt', 'alice'), equals(5830));
  });

  // ---------------------------------------------------------------------------
  // Range bounds
  // ---------------------------------------------------------------------------

  test('hashToBucket returns value within 0 to 9999', () {
    final result = hashToBucket('my-salt', 'user-123');
    expect(result, greaterThanOrEqualTo(0));
    expect(result, lessThanOrEqualTo(9999));
  });

  test('all namespaced helpers return value within 0 to 9999', () {
    for (final fn in <int Function(String, String)>[hashForTraffic, hashForVariation, hashForDefault]) {
      final result = fn('test-salt', 'user-xyz');
      expect(result, greaterThanOrEqualTo(0));
      expect(result, lessThanOrEqualTo(9999));
    }
  });

  test('buckets in range over many users', () {
    for (var i = 0; i < 500; i++) {
      final b = hashToBucket('salt', 'user-$i');
      expect(b, greaterThanOrEqualTo(0));
      expect(b, lessThanOrEqualTo(9999));
    }
  });

  // ---------------------------------------------------------------------------
  // Determinism
  // ---------------------------------------------------------------------------

  test('hashToBucket is deterministic', () {
    expect(hashToBucket('flag-salt', 'user-abc'), equals(hashToBucket('flag-salt', 'user-abc')));
  });

  test('each namespaced helper is deterministic', () {
    for (final fn in <int Function(String, String)>[hashForTraffic, hashForVariation, hashForDefault]) {
      expect(fn('determinism-salt', 'user-det'), equals(fn('determinism-salt', 'user-det')));
    }
  });

  // ---------------------------------------------------------------------------
  // Distinctness
  // ---------------------------------------------------------------------------

  test('produces different buckets for different user IDs', () {
    final buckets = {for (var i = 1; i <= 5; i++) hashToBucket('same-salt', 'user-$i')};
    expect(buckets.length, greaterThan(1));
  });

  test('produces different buckets for different salts', () {
    final a = hashToBucket('salt-a', 'user-1');
    final b = hashToBucket('salt-b', 'user-1');
    expect(a, isNot(equals(b)));
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  test('handles empty strings without raising', () {
    final result = hashToBucket('', '');
    expect(result, greaterThanOrEqualTo(0));
    expect(result, lessThanOrEqualTo(9999));
  });

  test('handles long strings without raising', () {
    final result = hashToBucket('a' * 1000, 'b' * 1000);
    expect(result, greaterThanOrEqualTo(0));
    expect(result, lessThanOrEqualTo(9999));
  });

  // ---------------------------------------------------------------------------
  // Namespace independence
  // ---------------------------------------------------------------------------

  test('traffic, variation, and default namespaces produce independent buckets', () {
    final traffic = hashForTraffic('checkout-salt', 'user-namespace-test');
    final variation = hashForVariation('checkout-salt', 'user-namespace-test');
    final def = hashForDefault('checkout-salt', 'user-namespace-test');
    expect({traffic, variation, def}.length, greaterThan(1));
  });
}
