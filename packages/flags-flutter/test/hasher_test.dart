import 'package:flutter_test/flutter_test.dart';
import 'package:signakit_flags/src/hasher.dart';

void main() {
  group('murmur3_32 known vectors (cross-SDK parity)', () {
    // Locked-in vectors captured from the reference TS implementation
    // (packages/flags-node/src/hasher.ts). If any of these change, live
    // experiments will re-bucket users across SDKs.
    final vectors = <Map<String, Object>>[
      {'key': '', 'hash': 0, 'bucket': 0},
      {'key': 'a', 'hash': 1009084850, 'bucket': 4850},
      {'key': 'hello', 'hash': 613153351, 'bucket': 3351},
      {'key': 'salt:user-123', 'hash': 2051974123, 'bucket': 4123},
      {
        'key': 'flag-salt:traffic:user-abc',
        'hash': 3671728962,
        'bucket': 8962
      },
      {
        'key': 'my-flag-salt:variation:user-42',
        'hash': 1829801020,
        'bucket': 1020
      },
      {'key': 'xyz:default:bob', 'hash': 307562710, 'bucket': 2710},
    ];

    for (final v in vectors) {
      test('hash(${v['key']}) == ${v['hash']}', () {
        final key = v['key']! as String;
        final got = murmur3_32(key);
        expect(got, equals(v['hash']));
        expect(got % 10000, equals(v['bucket']));
      });
    }
  });

  test('namespaces produce distinct buckets', () {
    final t = hashForTraffic('salt', 'user-1');
    final variation = hashForVariation('salt', 'user-1');
    final d = hashForDefault('salt', 'user-1');
    expect(
      t == variation && variation == d,
      isFalse,
      reason: 'expected distinct namespace buckets',
    );
  });

  test('hashToBucket is deterministic and within range', () {
    for (var i = 0; i < 100; i++) {
      final b = hashToBucket('flag-x', 'user-y');
      expect(b, equals(hashToBucket('flag-x', 'user-y')));
      expect(b, greaterThanOrEqualTo(0));
      expect(b, lessThan(10000));
    }
  });
}
