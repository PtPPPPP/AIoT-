import json
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from edge_data.__main__ import ProcessLock, restore
from edge_data.analysis import event_markers, report
from edge_data.collector import Collector
from edge_data.common import Config, day_bounds, iso, now_ms
from edge_data.fixtures import BASE, EXPECTED, ZONE, load_fixture
from edge_data.irrigation import irrigations, reconstruct
from edge_data.server import Application, downsample, make_server
from edge_data.store import Store


def packet(second=0, value=30, origin='hardware', metric='soilMoisture', **extra):
    return {'schemaVersion': 1, 'eventId': 'evt-' + str(second), 'sequence': second, 'gatewayId': 'test', 'deviceId': 'test-device',
            'channelId': metric, 'sensorId': 'soil', 'source': 'gateway', 'sourceKind': origin, 'key': metric, 'value': value,
            'unit': '%' if metric == 'soilMoisture' else '°C', 'quality': 'good', 'valid': True, 'capturedAt': iso(BASE + second * 1000), 'receivedAt': iso(BASE + second * 1000), **extra}


class DataTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.store = Store(self.root / 'data')

    def tearDown(self):
        self.directory.cleanup()

    def insert(self, second=0, value=30, **kwargs):
        return self.store.sample(packet(second, value, **kwargs), ZONE, received_at=BASE + second * 1000)

    def stat(self, start=BASE, end=BASE + 600000):
        return next(m for m in report(self.store, 'hardware', ZONE, start, end, 120, 'Asia/Shanghai')['metrics'] if m['metric'] == 'soilMoisture')

    def test_deduplication_and_out_of_order(self):
        self.assertEqual(self.insert(120, 36), 'inserted')
        self.assertEqual(self.insert(0, 30), 'inserted')
        self.assertEqual(self.insert(120, 36), 'duplicate')
        changed_envelope = packet(120, 36, eventId='different-transport-id')
        self.assertEqual(self.store.sample(changed_envelope, ZONE, BASE + 999000), 'duplicate')
        self.assertEqual(self.store.summary('hardware')['sampleCount'], 2)
        self.assertEqual([s['value'] for s in self.store.samples('hardware', ZONE, BASE, BASE + 200000)], [30, 36])

    def test_conflicting_duplicate_excluded_without_overwrite(self):
        self.insert()
        self.assertEqual(self.insert(value=99), 'conflict')
        stored = self.store.samples('hardware', ZONE, BASE, BASE)[0]
        self.assertEqual(stored['value'], 30)
        self.assertEqual(stored['quality'], 'invalid')
        self.assertEqual(self.store.summary('hardware')['conflictCount'], 1)

    def test_invalid_stale_units_and_calibration_are_explicit(self):
        self.store.sample(packet(0, 30, rawValue=12.5, calibratedValue=30, calibrationVersion='provided-v1'), ZONE, BASE + 60000)
        self.insert(60, 31, unit='V')
        rows = self.store.samples('hardware', ZONE, BASE, BASE + 60000)
        self.assertEqual([s['quality'] for s in rows], ['stale', 'invalid'])
        self.assertEqual(rows[0]['rawValue'], 12.5)
        self.assertEqual(rows[0]['calibrationVersion'], 'provided-v1')
        self.assertNotIn('calibrationVersion', rows[1])
        self.assertIsNone(self.stat()['timeWeightedMean'])

    def test_missing_source_quarantined_and_partitions_separate(self):
        item = packet(); item.pop('sourceKind')
        self.store.sample(item, ZONE, BASE)
        self.insert(10, 31, origin='simulation'); self.insert(20, 32, origin='playback')
        self.assertEqual(self.store.summary('hardware')['sampleCount'], 0)
        for kind in ('simulation', 'playback', 'unknown'):
            self.assertEqual(self.store.summary(kind)['sampleCount'], 1)

    def test_explicit_historical_playback_preserves_original_quality_in_its_partition(self):
        self.store.sample(packet(0, 30, origin='playback'), ZONE, now_ms())
        self.store.sample(packet(60, 32, origin='playback'), ZONE, now_ms())
        result = next(m for m in report(self.store, 'playback', ZONE, BASE, BASE + 60000, 120, 'UTC')['metrics'] if m['metric'] == 'soilMoisture')
        self.assertEqual(result['validSeconds'], 60)
        self.assertAlmostEqual(result['timeWeightedMean'], 31)
        self.assertEqual(self.store.summary('hardware')['sampleCount'], 0)

    def test_irregular_weighted_mean_no_counting_samples_as_time(self):
        self.insert(0, 10); self.insert(60, 20); self.insert(180, 40)
        result = self.stat(BASE, BASE + 180000)
        self.assertAlmostEqual(result['timeWeightedMean'], 25)
        self.assertEqual(result['validSeconds'], 180)
        self.assertIsNone(result['targetInSeconds'])

    def test_long_gap_and_invalid_samples_break_time(self):
        self.insert(0, 30); self.insert(60, 32)
        self.insert(90, None, quality='invalid', valid=False)
        self.insert(120, 34); self.insert(300, 50)
        result = self.stat()
        self.assertEqual(result['validSeconds'], 60)
        self.assertEqual(result['unknownSeconds'], 540)
        self.assertEqual(result['longestOutSeconds'], None)

    def test_wrong_unit_sample_is_a_barrier_in_the_same_sensor_sequence(self):
        self.insert(0, 30); self.insert(30, 1, unit='V'); self.insert(60, 32)
        result = self.stat(BASE, BASE + 60000)
        self.assertEqual(result['validSeconds'], 0)
        self.assertEqual(result['unit'], '%')

    def test_conflicting_simulation_source_does_not_enter_hardware_statistics(self):
        self.insert(0, 30, source='simulation', sourceKind='hardware')
        self.assertEqual(self.store.summary('hardware')['sampleCount'], 0)
        quarantined = self.store.samples('unknown', ZONE, BASE, BASE)[0]
        self.assertEqual(quarantined['quality'], 'invalid')

    def test_timezone_day_boundary_and_clipped_integral(self):
        start, end = day_bounds('2026-10-20', 'Asia/Shanghai')
        self.assertEqual(iso(start), '2026-10-19T16:00:00.000Z')
        self.assertEqual(end - start, 86400000)
        self.insert(0, 10); self.insert(120, 30)
        result = self.stat(BASE + 30000, BASE + 90000)
        self.assertAlmostEqual(result['timeWeightedMean'], 20)
        self.assertEqual(result['validSeconds'], 60)

    def test_context_changes_split_target_time_not_retroactive(self):
        self.insert(0, 40); self.insert(120, 40)
        base_context = {'zoneId': ZONE, 'effectiveAt': iso(BASE), 'crop': 'test-only', 'batchId': 'test', 'stage': 'test', 'targetBasis': 'software-only', 'targets': {'soilMoisture': {'low': 35, 'high': 45, 'unit': '%', 'confirmed': True}}}
        self.store.context('hardware', base_context)
        self.store.context('hardware', {**base_context, 'effectiveAt': iso(BASE + 60000), 'targets': {'soilMoisture': {'low': 45, 'high': 50, 'unit': '%', 'confirmed': True}}})
        result = self.stat(BASE, BASE + 120000)
        self.assertEqual(result['targetInSeconds'], 60)
        self.assertEqual(result['targetOutSeconds'], 60)
        self.assertEqual(len(result['targetVersions']), 2)

    def test_async_metrics_are_separate_series(self):
        self.insert(0, 30); self.insert(60, 32)
        self.insert(30, 20, metric='temperature')
        self.insert(90, 22, metric='temperature')
        result = report(self.store, 'hardware', ZONE, BASE, BASE + 120000, 120, 'UTC')
        self.assertEqual({m['metric']: m['validSeconds'] for m in result['metrics'] if m['sampleCount']}, {'soilMoisture': 60, 'temperature': 60})

    def test_missing_agronomic_context_never_inherits_demo_policy(self):
        with self.assertRaisesRegex(ValueError, '批次'):
            self.store.context('hardware', {'zoneId': ZONE, 'effectiveAt': iso(BASE), 'targets': {'soilMoisture': {'low': 36, 'high': 45, 'unit': '%', 'confirmed': True}}})
        self.insert(); self.insert(60, 31)
        self.assertIsNone(self.stat()['targetOutSeconds'])

    def test_fixture_matches_hand_calculation(self):
        load_fixture(self.store); load_fixture(self.store)
        result = next(m for m in report(self.store, 'simulation', ZONE, BASE, BASE + 600000, 120, 'Asia/Shanghai')['metrics'] if m['metric'] == 'soilMoisture')
        for key, expected in EXPECTED.items():
            if key != 'rangeSeconds':
                self.assertAlmostEqual(result[key], expected, places=7)
        self.assertEqual(self.store.summary('simulation')['sampleCount'], 17)
        self.assertEqual(self.store.summary('hardware')['sampleCount'], 0)

    def test_irrigation_observation_incomplete_and_confounded(self):
        load_fixture(self.store)
        items = irrigations(self.store, 'simulation', ZONE, BASE, BASE + 600000, BASE + 650000, 120)['items']
        pending, closed = items
        self.assertEqual(pending['outcome'], '观察中')
        self.assertIsNone(pending['startedAt'])
        self.assertFalse(pending['physicalStartObserved'])
        self.assertEqual(closed['supportedRunSeconds'], 60)
        self.assertEqual(closed['durationBoundsSeconds'], {'minimum': 60, 'maximum': 130})
        self.assertEqual(closed['outcome'], '无法判断')
        self.assertEqual(len(closed['interventions']), 2)
        self.assertIsNotNone(closed['responseAt'])
        self.assertFalse(closed['physicalStopObserved'])
        self.assertEqual(closed['targetReturnAt'], iso(BASE + 240000))

    def test_success_without_feedback_never_proves_irrigation(self):
        events = [{'id': 'command', 'kind': 'command', 'zoneId': ZONE, 'device': 'waterPump', 'commandId': 'cmd', 'target': True, 'status': 'succeeded', 'observedAt': iso(BASE)}]
        result = reconstruct(events, 120)[0]
        self.assertIsNone(result['startedAt']); self.assertIsNone(result['stoppedAt'])

    def test_service_gap_does_not_mean_stopped(self):
        events = [{'id': 'run', 'kind': 'feedback', 'zoneId': ZONE, 'device': 'waterPump', 'actual': True, 'feedbackLevel': 'physical', 'observedAt': iso(BASE)},
                  {'id': 'restart', 'kind': 'collector-gap', 'zoneId': '*', 'observedAt': iso(BASE + 60000)}]
        result = reconstruct(events, 120)[0]
        self.assertIsNone(result['stoppedAt']); self.assertTrue(result['hasGap'])

    def response_case(self, response=False, observing=False):
        self.store.context('hardware', {'zoneId': ZONE, 'effectiveAt': iso(BASE), 'analysis': {'maxGapSeconds': 120, 'preWindowSeconds': 60, 'postWindowSeconds': 120, 'responseDelta': 5}, 'analysisBasis': 'software-test-only'})
        for second, value in [(0, 30), (60, 30), (180, 32 if response else 30), (240, 40 if response else 30), (300, 42 if response else 30)]:
            self.insert(second, value)
        for second, actual in [(50, False), (90, True), (120, True), (150, True), (180, False)]:
            self.store.event('hardware', {'id': 'fb:' + str(second), 'kind': 'feedback', 'device': 'waterPump', 'zoneId': ZONE, 'actual': actual, 'feedbackLevel': 'physical', 'precisionMs': 30000, 'observedAt': iso(BASE + second * 1000)})
        self.store.event('hardware', {'id': 'request', 'kind': 'command', 'zoneId': ZONE, 'device': 'waterPump', 'commandId': 'response-case', 'target': True, 'status': 'acknowledged', 'source': 'auto-policy', 'observedAt': iso(BASE + 60000)})
        return irrigations(self.store, 'hardware', ZONE, BASE, BASE + 300000, BASE + (240000 if observing else 400000), 120)['items'][0]

    def test_no_response_is_only_a_check_suggestion_not_a_fault_diagnosis(self):
        result = self.response_case()
        self.assertEqual(result['outcome'], '未观察到配置预期响应，建议人工核查')
        self.assertIsNone(result['targetReturnAt'])
        self.assertNotIn('故障', result['outcome'])

    def test_observed_response_and_delay_need_sufficient_data(self):
        result = self.response_case(response=True)
        self.assertEqual(result['outcome'], '已观察到配置判据对应的湿度变化（不证明因果）')
        self.assertEqual(result['responseAt'], iso(BASE + 240000))
        self.assertEqual(result['responseDelaySeconds'], 60)
        self.assertAlmostEqual(result['moistureDelta'], 8.5)

    def test_unfinished_observation_cannot_be_marked_success(self):
        result = self.response_case(response=True, observing=True)
        self.assertEqual(result['outcome'], '观察中')

    def test_feedback_level_cannot_be_upgraded_from_output_to_physical(self):
        events = [{'id': 'run', 'kind': 'feedback', 'zoneId': ZONE, 'device': 'waterPump', 'actual': True, 'feedbackLevel': 'output', 'observedAt': iso(BASE)},
                  {'id': 'stop', 'kind': 'feedback', 'zoneId': ZONE, 'device': 'waterPump', 'actual': False, 'feedbackLevel': 'physical', 'observedAt': iso(BASE + 60000)}]
        result = reconstruct(events, 120)[0]
        self.assertEqual(result['startFeedbackLevel'], 'output')
        self.assertEqual(result['stopFeedbackLevel'], 'physical')
        self.assertTrue(result['hasGap'])

    def test_independent_collector_thread_survives_browser_absence_and_restart(self):
        server_calls = []
        ready = threading.Event()
        def read(path):
            server_calls.append(path)
            at = now_ms()
            if path.endswith('/latest'):
                if server_calls.count(path) >= 3:
                    ready.set()
                return [packet(capturedAt=iso(at), receivedAt=iso(at))]
            return [{'logicalDevice': 'waterPump', 'online': True, 'actual': True, 'feedbackLevel': 'physical', 'sourceKind': 'hardware', 'updatedAt': iso(at)}]
        config = Config(collector_mode='external', gateway_base_url='http://mock.invalid', poll_seconds=0.1, sensor_zones={'soil': ZONE}, device_zones={'waterPump': ZONE}).validate()
        collector = Collector(self.store, config, read)
        collector.start()
        try:
            self.assertTrue(ready.wait(3))
        finally:
            collector.stop()
        count = Store(self.root / 'data').summary('hardware')['sampleCount']
        self.assertGreaterEqual(count, 3)
        self.assertTrue(all(path in ('/api/v1/sensors/latest', '/api/v1/actuators') for path in server_calls))
        new_reader = Collector(Store(self.root / 'data'), config, read)
        new_reader.start(); new_reader.stop()
        events = irrigations(self.store, 'hardware', ZONE, BASE, now_ms(), now_ms(), 120)['items']
        self.assertTrue(events)
        self.assertTrue(events[0]['hasGap'])
        self.assertIsNone(events[0]['stoppedAt'])

    def test_restarts_backup_and_restore_preserve_history_and_origin(self):
        load_fixture(self.store)
        reopened = Store(self.root / 'data')
        self.assertEqual(reopened.summary('simulation')['sampleCount'], 17)
        target = self.root / 'backup.sqlite3'
        reopened.backup('simulation', target)
        restore(target, self.root / 'restored', 'simulation')
        restored = Store(self.root / 'restored')
        self.assertEqual(restored.summary('simulation')['sampleCount'], 17)
        self.assertEqual(len(restored.contexts('simulation', ZONE)), 2)
        with self.assertRaises(ValueError):
            restore(target, self.root / 'wrong', 'hardware')
        with self.assertRaises(ValueError):
            restore(target, self.root / 'restored', 'simulation')

    def test_retention_preserves_context_versions_and_backup(self):
        load_fixture(self.store)
        backup = self.root / 'snapshot.sqlite3'
        self.store.backup('simulation', backup)
        self.store.purge(BASE + 300000)
        self.assertEqual(len(self.store.contexts('simulation', ZONE)), 2)
        self.assertLess(self.store.summary('simulation')['sampleCount'], 17)
        self.assertTrue(backup.exists())

    def test_single_collector_process_lock(self):
        lock = ProcessLock(self.root / 'data')
        try:
            with self.assertRaises(ValueError):
                ProcessLock(self.root / 'data')
        finally:
            lock.close()
        ProcessLock(self.root / 'data').close()

    def test_collector_only_gets_and_continues_without_browser(self):
        current = now_ms()
        config = Config(collector_mode='external', gateway_base_url='http://mock.invalid', sensor_zones={'soil': ZONE}, device_zones={'waterPump': ZONE}).validate()
        calls = []
        def read(path):
            calls.append(path)
            if path.endswith('/latest'):
                return [packet(capturedAt=iso(current), receivedAt=iso(current))]
            return [{'logicalDevice': 'waterPump', 'online': True, 'actual': True, 'sourceKind': 'hardware', 'feedbackLevel': 'output', 'updatedAt': iso(current)}]
        collector = Collector(self.store, config, read)
        collector.collect_once(current); collector.collect_once(current + 1000)
        self.assertEqual(calls, ['/api/v1/sensors/latest', '/api/v1/actuators'] * 2)
        self.assertEqual(self.store.summary('hardware')['sampleCount'], 1)
        self.assertEqual(collector.snapshot()[2][0]['feedbackLevel'], 'output')
        # A reopened reader uses durable identity and cannot double count the same observation.
        Collector(Store(self.root / 'data'), config, read).collect_once(current + 2000)
        self.assertEqual(self.store.summary('hardware')['sampleCount'], 1)

    def test_bad_units_not_reported_good_in_cached_gateway_facade(self):
        current = now_ms()
        reader = lambda path: [packet(unit='V', capturedAt=iso(current), receivedAt=iso(current))] if path.endswith('/latest') else []
        collector = Collector(self.store, Config(collector_mode='external', gateway_base_url='http://mock.invalid').validate(), reader)
        collector.collect_once(current)
        cached = collector.snapshot()[1][0]
        self.assertEqual(cached['quality'], 'invalid'); self.assertFalse(cached['valid'])

    def test_downsample_keeps_extrema_and_invalid_points(self):
        samples = [{'id': str(i), 'sensorId': 's', 'key': 'temperature', 'unit': '°C', 'capturedAt': iso(BASE + i * 1000), 'quality': 'invalid' if i == 55 else 'good', 'value': 999 if i == 42 else i % 3} for i in range(100)]
        retained = downsample(samples, 16)
        self.assertIn('42', {s['id'] for s in retained}); self.assertIn('55', {s['id'] for s in retained})

    def test_event_markers_keep_transition_boundaries_not_every_poll(self):
        events = [{'id': str(i), 'kind': 'feedback', 'zoneId': ZONE, 'device': 'waterPump', 'observedAt': iso(BASE + i * 1000), 'actual': 2 <= i <= 8, 'feedbackLevel': 'physical'} for i in range(12)]
        markers = event_markers(events)
        self.assertEqual([e['id'] for e in markers], ['0', '1', '2', '8', '9', '11'])

    def test_api_queries_and_method_boundaries(self):
        load_fixture(self.store)
        app = Application(Config(data_dir=str(self.root / 'data')), self.store)
        server = make_server(app, 0)
        worker = threading.Thread(target=server.serve_forever, daemon=True); worker.start()
        base = 'http://127.0.0.1:' + str(server.server_port)
        try:
            with urlopen(base + '/api/data/report?dataset=simulation&zone=' + ZONE + '&from=' + iso(BASE) + '&to=' + iso(BASE + 600000)) as response:
                value = json.load(response)
                self.assertEqual(value['sampleCount'], 17)
            with urlopen(base + '/api/data/history?dataset=hardware&zone=' + ZONE + '&date=2026-10-20') as response:
                self.assertEqual(json.load(response)['items'], [])
            for path in ('/api/v1/control/commands', '/api/data/unknown'):
                with self.assertRaises(HTTPError) as failure:
                    urlopen(Request(base + path, data=b'{}', headers={'Content-Type': 'application/json'}, method='POST'))
                self.assertEqual(failure.exception.code, 404)
                failure.exception.close()
            with self.assertRaises(HTTPError) as failure:
                urlopen(Request(base + '/api/data/notes', data=b'{}', headers={'Content-Type': 'application/json', 'Origin': 'https://untrusted.invalid'}, method='POST'))
            self.assertEqual(failure.exception.code, 403)
            failure.exception.close()
        finally:
            server.shutdown(); server.server_close(); worker.join()


if __name__ == '__main__':
    unittest.main()
