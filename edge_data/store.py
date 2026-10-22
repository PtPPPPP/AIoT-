"""One SQLite file per provenance. No overwriting of raw or historical configuration."""
import hashlib
import json
import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path

from .common import DATASETS, DEVICES, METRICS, QUALITIES, dataset, finite, iso, now_ms, packet_origin, stamp, text


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False, separators=(',', ':'))


def identity(*values):
    return hashlib.sha256(encoded(values).encode()).hexdigest()[:32]


class Store:
    def __init__(self, root):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        for kind in DATASETS:
            with self.connection(kind) as db:
                version = db.execute('PRAGMA user_version').fetchone()[0]
                if version > 1:
                    raise ValueError('数据库版本高于本服务，禁止降级打开')
                if version == 0:
                    db.executescript('BEGIN IMMEDIATE;\n' + (Path(__file__).parent / 'migrations/001_initial.sql').read_text(encoding='utf-8') + '\nCOMMIT;')
                stored_kind = db.execute("SELECT value FROM metadata WHERE key='dataset'").fetchone()
                if stored_kind and stored_kind[0] != kind:
                    raise ValueError('数据库分区身份不匹配，拒绝打开')
                db.execute("INSERT OR IGNORE INTO metadata VALUES('dataset',?)", (kind,))

    @contextmanager
    def connection(self, kind):
        db = sqlite3.connect(self.root / (dataset(kind) + '.sqlite3'), timeout=10)
        try:
            db.row_factory = sqlite3.Row
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('PRAGMA synchronous=FULL')
            db.execute('PRAGMA foreign_keys=ON')
            with db:
                yield db
        finally:
            db.close()

    def sample(self, packet, zone='unassigned', received_at=None, stale_after_seconds=30):
        if not isinstance(packet, dict) or packet.get('schemaVersion') != 1:
            raise ValueError('采样 schemaVersion 无效')
        for name in ('eventId', 'gatewayId', 'deviceId', 'channelId', 'sensorId', 'source', 'unit'):
            text(packet.get(name), name)
        if not isinstance(packet.get('sequence'), int) or isinstance(packet['sequence'], bool) or packet['sequence'] < 0:
            raise ValueError('采样 sequence 必须是非负整数')
        metric = packet.get('key')
        if metric not in METRICS or packet.get('quality') not in QUALITIES:
            raise ValueError('指标或质量无效')
        value = packet.get('value')
        if value is not None and not finite(value):
            raise ValueError('采样必须是有限数值或 null')
        if not isinstance(packet.get('valid'), bool) or (packet['quality'] == 'good') != packet['valid'] or (packet['valid'] and value is None):
            raise ValueError('采样有效性声明不一致')
        captured, received = stamp(packet.get('capturedAt')), stamp(packet.get('receivedAt'))
        service_received = received_at if received_at is not None else now_ms()
        kind = packet_origin(packet)
        quality = packet['quality']
        reasons = []
        if packet.get('sourceKind') is not None and packet['sourceKind'] != kind:
            quality = 'invalid'; reasons.append('来源声明冲突，进入 unknown 隔离分区')
        if packet['unit'] != METRICS[metric]:
            quality = 'invalid'; reasons.append('单位与指标规范不一致，未做隐式换算')
        if captured > service_received + 30000 or received < captured - 30000:
            quality = 'invalid'; reasons.append('时间超前或接收时间与采集时间不一致')
        elif quality == 'good' and kind != 'playback' and service_received - captured > stale_after_seconds * 1000:
            quality = 'stale'; reasons.append('到达服务时已超过采样新鲜度时限')
        for name in ('rawValue', 'calibratedValue'):
            if name in packet and not finite(packet[name]):
                raise ValueError(name + ' 无效')
        if 'calibrationVersion' in packet:
            text(packet['calibrationVersion'], '校准版本')
        row_id = identity(packet['gatewayId'], packet['sensorId'], metric, captured)
        allowed_fields = ('schemaVersion', 'eventId', 'sequence', 'gatewayId', 'deviceId', 'channelId', 'sensorId', 'source', 'key', 'value', 'unit', 'capturedAt', 'receivedAt', 'quality', 'valid', 'rawValue', 'calibratedValue', 'calibrationVersion', 'error')
        result = {**{k: packet[k] for k in allowed_fields if k in packet}, 'id': row_id, 'zoneId': text(zone, '区域'), 'sourceKind': kind, 'quality': quality,
                  'originalQuality': packet['quality'], 'originalValid': packet['valid'], 'valid': quality == 'good',
                  'declaredSourceKind': packet.get('sourceKind'), 'validationNotes': reasons, 'serviceReceivedAt': iso(service_received)}
        with self.connection(kind) as db:
            old = db.execute('SELECT payload FROM samples WHERE id=?', (row_id,)).fetchone()
            if old:
                previous = json.loads(old[0])
                # Polling a previously persisted observation is not a new sample, and age alone is not a conflict.
                comparable = ('value', 'unit', 'rawValue', 'calibratedValue', 'calibrationVersion', 'quality', 'valid')
                raw_previous = {**previous, 'quality': previous.get('originalQuality', previous['quality']), 'valid': previous.get('originalValid', previous['valid'])}
                if any(raw_previous.get(k) != packet.get(k) for k in comparable):
                    result['quality'] = 'invalid'
                    db.execute('INSERT INTO conflicts(identity,received_ms,payload) VALUES(?,?,?)', (row_id, service_received, encoded(result)))
                    previous['quality'] = 'invalid'
                    previous['valid'] = False
                    previous['validationNotes'] = list(set(previous.get('validationNotes', []) + ['同一采样身份存在冲突，排除统计；原始冲突另存']))
                    db.execute('UPDATE samples SET quality=?,payload=? WHERE id=?', ('invalid', encoded(previous), row_id))
                    return 'conflict'
                return 'duplicate'
            db.execute('INSERT INTO samples VALUES(?,?,?,?,?,?,?,?,?,?,?)', (row_id, packet['gatewayId'], packet['sensorId'], zone, metric, packet['unit'], captured, received, quality, value, encoded(result)))
        return 'inserted'

    def event(self, kind, event):
        dataset(kind)
        if not isinstance(event, dict) or event.get('kind') not in ('command', 'feedback', 'alarm', 'manual', 'collector-gap'):
            raise ValueError('事件类型无效')
        event = dict(event)
        event['id'] = text(event.get('id'), '事件 ID')
        event['zoneId'] = text(event.get('zoneId', 'unassigned'), '区域')
        at = stamp(event.get('observedAt'))
        if event.get('device') is not None and event['device'] not in DEVICES:
            raise ValueError('逻辑设备无效')
        if event['kind'] in ('command', 'feedback') and event.get('device') not in DEVICES:
            raise ValueError('命令／反馈必须关联设备')
        if event['kind'] == 'command':
            text(event.get('commandId'), '命令 ID')
            if not isinstance(event.get('target'), bool) or event.get('status') not in ('pending', 'sent', 'acknowledged', 'succeeded', 'failed', 'timed_out', 'rejected', 'cancelled'):
                raise ValueError('命令目标或状态无效')
        if event['kind'] == 'feedback':
            if kind == 'hardware' and event.get('feedbackLevel') == 'simulation':
                raise ValueError('模拟反馈不得写入硬件分区')
            if event.get('actual') is not None and not isinstance(event['actual'], bool):
                raise ValueError('反馈状态无效')
            if event.get('feedbackLevel', 'gateway') not in ('physical', 'output', 'gateway', 'simulation'):
                raise ValueError('反馈层级无效')
            if not finite(event.get('precisionMs', 0)) or event.get('precisionMs', 0) < 0:
                raise ValueError('反馈时间精度无效')
        if event.get('source', 'unknown') not in ('auto-policy', 'manual', 'gateway', 'simulation', 'unknown'):
            raise ValueError('操作来源无效')
        if event['kind'] == 'manual':
            text(event.get('note'), '人工备注')
            if event.get('operation') not in ('inspection', 'hand-watering', 'maintenance', 'moved', 'calibration'):
                raise ValueError('人工操作类型无效')
        event['sourceKind'] = kind
        event.setdefault('receivedAt', iso(now_ms()))
        stamp(event['receivedAt'])
        with self.connection(kind) as db:
            old = db.execute('SELECT payload FROM events WHERE id=?', (event['id'],)).fetchone()
            if old:
                # Audit events are immutable. Clients must use a new ID for later statuses.
                previous = json.loads(old[0])
                if {k: v for k, v in previous.items() if k != 'receivedAt'} != {k: v for k, v in event.items() if k != 'receivedAt'}:
                    raise ValueError('事件 ID 冲突，不能覆盖原事件')
                return False
            db.execute('INSERT INTO events VALUES(?,?,?,?,?,?,?)', (event['id'], event['zoneId'], event.get('device'), event['kind'], event.get('commandId'), at, encoded(event)))
        return True

    def context(self, kind, value):
        value = dict(value)
        zone, at = text(value.get('zoneId'), '区域'), stamp(value.get('effectiveAt'))
        value['version'] = str(uuid.uuid4())
        value['recordedAt'] = iso(now_ms())
        value['zoneId'] = zone
        value['effectiveAt'] = iso(at)
        for key in ('batchId', 'crop', 'variety', 'stage', 'substrate', 'notes', 'soilSensorId', 'targetBasis', 'analysisBasis'):
            if value.get(key) is not None:
                value[key] = text(value[key], key, allow_empty=True) or None
        if value.get('plantedAt'):
            stamp(value['plantedAt'])
        targets = value.get('targets', {})
        if not isinstance(targets, dict):
            raise ValueError('目标区间无效')
        if targets and not all(value.get(k) for k in ('batchId', 'crop', 'stage', 'targetBasis')):
            raise ValueError('确认目标区间必须填写批次、作物、阶段和目标依据')
        for metric, target in targets.items():
            if metric not in METRICS or not isinstance(target, dict) or not finite(target.get('low')) or not finite(target.get('high')) or target['low'] >= target['high'] or target.get('unit') != METRICS[metric] or target.get('confirmed') is not True:
                raise ValueError('目标必须显式确认且包含匹配单位与有效上下界')
        settings = value.get('analysis', {})
        if not isinstance(settings, dict):
            raise ValueError('分析配置无效')
        for key, upper in [('maxGapSeconds', 3600), ('preWindowSeconds', 86400), ('postWindowSeconds', 86400), ('responseDelta', 100)]:
            if settings.get(key) is not None and (not finite(settings[key]) or not 0 < settings[key] <= upper):
                raise ValueError('分析参数超出范围：' + key)
        if any(settings.get(k) is not None for k in ('preWindowSeconds', 'postWindowSeconds', 'responseDelta')) and not value.get('analysisBasis'):
            raise ValueError('分析窗口与响应阈值必须说明依据')
        value['targets'] = targets
        value['analysis'] = settings
        with self.connection(kind) as db:
            db.execute('INSERT INTO contexts VALUES(?,?,?,?)', (value['version'], zone, at, encoded(value)))
        return value

    def contexts(self, kind, zone):
        with self.connection(kind) as db:
            return [json.loads(r[0]) for r in db.execute('SELECT payload FROM contexts WHERE zone_id=? ORDER BY effective_ms', (zone,))]

    def samples(self, kind, zone, start, end, metric=None, limit=None, offset=0):
        sql = 'SELECT payload FROM samples WHERE zone_id=? AND captured_ms>=? AND captured_ms<=?'
        args = [zone, start, end]
        if metric:
            sql += ' AND metric=?'; args.append(metric)
        sql += ' ORDER BY captured_ms,sensor_id,id'
        if limit is not None:
            sql += ' LIMIT ? OFFSET ?'; args += [limit, offset]
        with self.connection(kind) as db:
            return [json.loads(r[0]) for r in db.execute(sql, args)]

    def events(self, kind, zone=None, start=None, end=None, operational_only=False):
        sql = 'SELECT payload FROM events WHERE 1=1'; args = []
        for clause, value in [('zone_id=?', zone), ('observed_ms>=?', start), ('observed_ms<=?', end)]:
            if value is not None:
                sql += ' AND ' + clause; args.append(value)
        if operational_only:
            sql += " AND kind IN ('command','manual','alarm','collector-gap')"
        sql += ' ORDER BY observed_ms,id'
        with self.connection(kind) as db:
            return [json.loads(r[0]) for r in db.execute(sql, args)]

    def irrigation_events(self, kind, zone, end):
        with self.connection(kind) as db:
            for row in db.execute("SELECT payload FROM events WHERE zone_id IN (?, '*') AND observed_ms<=? AND (device='waterPump' OR kind='collector-gap') ORDER BY observed_ms,CASE kind WHEN 'command' THEN 0 ELSE 1 END,id", (zone, end)):
                yield json.loads(row[0])

    def sample_count(self, kind, zone, start, end):
        with self.connection(kind) as db:
            return db.execute('SELECT COUNT(*) FROM samples WHERE zone_id=? AND captured_ms>=? AND captured_ms<=?', (zone, start, end)).fetchone()[0]

    def sample_by_id(self, kind, sample_id):
        with self.connection(kind) as db:
            row = db.execute('SELECT payload FROM samples WHERE id=?', (sample_id,)).fetchone()
            return json.loads(row[0]) if row else None

    def zones(self, kind):
        with self.connection(kind) as db:
            return [r[0] for r in db.execute('SELECT zone_id FROM samples UNION SELECT zone_id FROM contexts UNION SELECT zone_id FROM events WHERE zone_id<>\'*\' ORDER BY zone_id')]

    def summary(self, kind):
        with self.connection(kind) as db:
            sample = db.execute('SELECT COUNT(*),MIN(captured_ms),MAX(captured_ms) FROM samples').fetchone()
            return {'sampleCount': sample[0], 'earliestAt': iso(sample[1]) if sample[1] is not None else None, 'latestAt': iso(sample[2]) if sample[2] is not None else None,
                    'eventCount': db.execute('SELECT COUNT(*) FROM events').fetchone()[0], 'conflictCount': db.execute('SELECT COUNT(*) FROM conflicts').fetchone()[0]}

    def purge(self, cutoff):
        # Keep contexts (small immutable history) so a retained sample never loses its effective configuration.
        for kind in DATASETS:
            with self.connection(kind) as db:
                db.execute('DELETE FROM samples WHERE captured_ms<?', (cutoff,))
                db.execute('DELETE FROM events WHERE observed_ms<?', (cutoff,))
                db.execute('DELETE FROM conflicts WHERE received_ms<?', (cutoff,))

    def backup(self, kind, target):
        path = Path(target)
        if path.exists():
            raise ValueError('备份目标已存在，禁止覆盖')
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection(kind) as source:
            destination = sqlite3.connect(path)
            try:
                source.backup(destination)
                if destination.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    raise ValueError('备份完整性检查失败')
            finally:
                destination.close()
        return str(path)
