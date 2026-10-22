"""Deterministic software-test data only; never written to the hardware partition."""
from .common import iso, stamp

BASE = stamp('2026-10-20T00:00:00.000Z')
ZONE = 'software-test-zone'
EXPECTED = {'rangeSeconds': 600, 'validSeconds': 360, 'unknownSeconds': 240, 'coverage': 0.6,
            'timeWeightedMean': 13740 / 360, 'targetInSeconds': 150, 'targetOutSeconds': 210, 'longestOutSeconds': 210}


def load_fixture(store):
    if store.contexts('simulation', ZONE):
        return  # Loading twice is idempotent, and never changes existing historical versions.
    store.context('simulation', {'zoneId': ZONE, 'effectiveAt': iso(BASE), 'batchId': 'SOFTWARE-TEST-ONLY', 'crop': '测试作物（非农艺建议）',
                                'stage': '测试阶段', 'notes': '确定性测试数据，不是现场数据', 'targetBasis': '仅用于软件计算核对，非农艺标准',
                                'targets': {'soilMoisture': {'low': 40, 'high': 50, 'unit': '%', 'confirmed': True}},
                                'analysis': {'maxGapSeconds': 120, 'preWindowSeconds': 60, 'postWindowSeconds': 300, 'responseDelta': 5},
                                'analysisBasis': '测试窗口与 5 个百分点增量仅用于软件分支验证', 'soilSensorId': 'test-soil'})
    store.context('simulation', {'zoneId': ZONE, 'effectiveAt': iso(BASE + 600000), 'batchId': 'SOFTWARE-TEST-ONLY', 'crop': '测试作物（非农艺建议）',
                                'stage': '测试下一阶段', 'notes': '600 秒后配置变更；不回写历史', 'targets': {}, 'analysis': {}})
    sequences = {
        'soilMoisture': [(0, 30), (60, 32), (180, 38), (240, 42), (300, 44), (360, None), (420, 46), (480, 44)],
        'temperature': [(0, 25), (90, 26), (210, 27), (300, 26), (450, 25)],
        'light': [(0, 10000), (120, 12000), (240, 15000), (480, 18000)],
    }
    units = {'soilMoisture': '%', 'temperature': '°C', 'light': 'lux'}
    for metric, values in sequences.items():
        for sequence, (second, value) in enumerate(values):
            at = iso(BASE + second * 1000)
            packet = {'schemaVersion': 1, 'eventId': 'test:' + metric + ':' + str(second), 'sequence': sequence, 'source': 'simulation', 'sourceKind': 'simulation',
                      'gatewayId': 'software-test-fixture', 'deviceId': 'test-' + metric, 'channelId': metric, 'sensorId': 'test-soil' if metric == 'soilMoisture' else 'test-' + metric,
                      'key': metric, 'unit': units[metric], 'value': value, 'quality': 'good' if value is not None else 'invalid', 'valid': value is not None,
                      'capturedAt': at, 'receivedAt': at}
            store.sample(packet, ZONE, received_at=BASE + second * 1000)
    events = [
        (50, 'feedback', {'actual': False}), (60, 'command', {'commandId': 'test-irrigation-1', 'target': True, 'status': 'succeeded', 'source': 'auto-policy', 'reason': '确定性测试请求；不证明灌溉成功'}),
        (90, 'feedback', {'actual': True}), (120, 'feedback', {'actual': True}), (150, 'feedback', {'actual': True}),
        (175, 'command', {'commandId': 'test-stop-1', 'target': False, 'status': 'acknowledged', 'source': 'auto-policy'}), (180, 'feedback', {'actual': False}),
        (200, 'command', {'commandId': 'test-fan', 'device': 'fan', 'target': True, 'status': 'succeeded', 'source': 'manual', 'reason': '测试通风干预'}),
        (220, 'manual', {'operation': 'calibration', 'note': '测试：土壤传感器校准／移动，观察窗口存在干预', 'source': 'manual', 'irrigationId': 'test-irrigation-1'}),
        (260, 'alarm', {'reason': '测试环境报警标记', 'title': '测试报警', 'source': 'simulation'}),
        (510, 'command', {'commandId': 'test-irrigation-2', 'target': True, 'status': 'succeeded', 'source': 'manual', 'reason': '测试：网关成功但无运行反馈'}),
    ]
    for second, kind, fields in events:
        event = {'id': 'fixture:' + kind + ':' + str(second), 'zoneId': ZONE, 'kind': kind, 'observedAt': iso(BASE + second * 1000), 'receivedAt': iso(BASE + second * 1000),
                 'device': 'waterPump' if kind in ('feedback', 'command') else None, 'source': 'simulation', **fields}
        if kind == 'feedback':
            event.update(feedbackLevel='simulation', precisionMs=30000, timeBasis='polling')
        store.event('simulation', event)
