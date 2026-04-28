/// Verifies exposure-event behavior, especially that `'targeted'` rules
/// SKIP `$exposure` events. This is a hard cross-SDK requirement.
library;

import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:signakit_flags/signakit_flags.dart';

const String _testSdkKey = 'sk_dev_org123_proj456_random';

Map<String, Object?> _flagJson({
  required String key,
  required List<Map<String, Object?>> rules,
  required List<Map<String, Object?>> defaultRanges,
}) {
  return <String, Object?>{
    'id': '1',
    'key': key,
    'salt': 'salt-$key',
    'status': 'active',
    'running': true,
    'variations': <Map<String, Object?>>[
      <String, Object?>{'key': 'control'},
      <String, Object?>{'key': 'treatment'},
      <String, Object?>{'key': 'off'},
    ],
    'allocation': <String, Object?>{'ranges': defaultRanges},
    'rules': rules,
  };
}

Map<String, Object?> _ruleJson({
  required String key,
  required String type,
  required int trafficPercentage,
  required String variation,
}) {
  return <String, Object?>{
    'ruleKey': key,
    'ruleType': type,
    'trafficPercentage': trafficPercentage,
    'variationAllocation': <String, Object?>{
      'ranges': <Map<String, Object?>>[
        <String, Object?>{'variation': variation, 'start': 0, 'end': 9999},
      ],
    },
  };
}

Map<String, Object?> _projectConfig(List<Map<String, Object?>> flags) {
  return <String, Object?>{
    'projectId': 'proj456',
    'environmentKey': 'development',
    'sdkKey': _testSdkKey,
    'version': 1,
    'flags': flags,
    'generatedAt': '2025-01-01T00:00:00Z',
  };
}

/// Tracks all event POSTs.
class _RecordingMock {
  final List<Map<String, Object?>> events = <Map<String, Object?>>[];
  final List<http.Request> requests = <http.Request>[];

  http.Client client(Map<String, Object?> config) {
    return MockClient((http.Request request) async {
      requests.add(request);

      if (request.method == 'GET' &&
          request.url.path.endsWith('/latest.json')) {
        return http.Response(
          jsonEncode(config),
          200,
          headers: <String, String>{
            'content-type': 'application/json',
            'etag': '"v1"',
          },
        );
      }

      if (request.method == 'POST' &&
          request.url.toString().contains('flag-events')) {
        final body = jsonDecode(request.body) as Map<String, Object?>;
        final list = (body['events']! as List<Object?>);
        for (final e in list) {
          events.add(e! as Map<String, Object?>);
        }
        return http.Response('{}', 200);
      }

      return http.Response('not found', 404);
    });
  }
}

void main() {
  group('exposure events', () {
    test('targeted rule does NOT fire \$exposure', () async {
      final mock = _RecordingMock();
      final config = _projectConfig(<Map<String, Object?>>[
        _flagJson(
          key: 'targeted-flag',
          rules: <Map<String, Object?>>[
            _ruleJson(
              key: 'rollout',
              type: 'targeted',
              trafficPercentage: 100,
              variation: 'treatment',
            ),
          ],
          defaultRanges: <Map<String, Object?>>[
            <String, Object?>{
              'variation': 'control',
              'start': 0,
              'end': 9999,
            },
          ],
        ),
      ]);

      final client = SignaKitClient(SignaKitClientConfig(
        sdkKey: _testSdkKey,
        httpClient: mock.client(config),
      ));
      final ready = await client.onReady();
      expect(ready.success, isTrue);

      final ctx = client.createUserContext('user-123');
      expect(ctx, isNotNull);

      final decision = ctx!.decide('targeted-flag');
      expect(decision, isNotNull);
      expect(decision!.ruleType, equals(RuleType.targeted));
      expect(decision.variationKey, equals('treatment'));

      // Yield to let any scheduled futures run.
      await Future<void>.delayed(const Duration(milliseconds: 50));

      // No exposure event should have been posted.
      final exposureEvents = mock.events
          .where((e) => e['eventKey'] == r'$exposure')
          .toList(growable: false);
      expect(
        exposureEvents,
        isEmpty,
        reason: 'targeted rules must skip \$exposure tracking',
      );

      client.close();
    });

    test('ab-test rule DOES fire \$exposure', () async {
      final mock = _RecordingMock();
      final config = _projectConfig(<Map<String, Object?>>[
        _flagJson(
          key: 'ab-flag',
          rules: <Map<String, Object?>>[
            _ruleJson(
              key: 'experiment',
              type: 'ab-test',
              trafficPercentage: 100,
              variation: 'treatment',
            ),
          ],
          defaultRanges: <Map<String, Object?>>[
            <String, Object?>{
              'variation': 'control',
              'start': 0,
              'end': 9999,
            },
          ],
        ),
      ]);

      final client = SignaKitClient(SignaKitClientConfig(
        sdkKey: _testSdkKey,
        httpClient: mock.client(config),
      ));
      await client.onReady();

      final ctx = client.createUserContext('user-abc');
      final d = ctx!.decide('ab-flag');
      expect(d!.ruleType, equals(RuleType.abTest));

      await Future<void>.delayed(const Duration(milliseconds: 50));

      final exposures =
          mock.events.where((e) => e['eventKey'] == r'$exposure').toList();
      expect(exposures, hasLength(1));
      final exp = exposures.first;
      expect(exp['userId'], equals('user-abc'));
      final decisions = exp['decisions']! as Map<String, Object?>;
      expect(decisions['ab-flag'], equals('treatment'));
      final metadata = exp['metadata']! as Map<String, Object?>;
      expect(metadata['flagKey'], equals('ab-flag'));
      expect(metadata['ruleKey'], equals('experiment'));

      client.close();
    });

    test('bot user agent → off, no events', () async {
      final mock = _RecordingMock();
      final config = _projectConfig(<Map<String, Object?>>[
        _flagJson(
          key: 'ab-flag',
          rules: <Map<String, Object?>>[
            _ruleJson(
              key: 'experiment',
              type: 'ab-test',
              trafficPercentage: 100,
              variation: 'treatment',
            ),
          ],
          defaultRanges: <Map<String, Object?>>[
            <String, Object?>{'variation': 'control', 'start': 0, 'end': 9999},
          ],
        ),
      ]);

      final client = SignaKitClient(SignaKitClientConfig(
        sdkKey: _testSdkKey,
        httpClient: mock.client(config),
      ));
      await client.onReady();

      final ctx = client.createUserContext(
        'bot-user',
        attributes: <String, Object?>{
          r'$userAgent':
              'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        },
      );

      final d = ctx!.decide('ab-flag');
      expect(d!.variationKey, equals('off'));
      expect(d.enabled, isFalse);

      await ctx.trackEvent('purchase', value: 9.99);
      await Future<void>.delayed(const Duration(milliseconds: 50));

      expect(mock.events, isEmpty);
      client.close();
    });

    test('parseSdkKey handles dev/prod', () {
      // Smoke test that the SDK key parses through the public client.
      final mock = _RecordingMock();
      final config = _projectConfig(const <Map<String, Object?>>[]);

      final c1 = SignaKitClient(SignaKitClientConfig(
        sdkKey: 'sk_prod_org_proj_random',
        httpClient: mock.client(config),
      ));
      expect(c1, isNotNull);

      expect(
        () => SignaKitClient(SignaKitClientConfig(
          sdkKey: 'invalid',
          httpClient: mock.client(config),
        )),
        throwsArgumentError,
      );

      c1.close();
    });
  });
}
