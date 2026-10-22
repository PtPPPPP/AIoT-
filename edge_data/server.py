"""Loopback-only JSON API. No endpoint proxies device control or changes policy."""
import json
import sqlite3
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlsplit

from .analysis import event_markers, report
from .collector import Collector
from .common import DATASETS, METRICS, dataset, day_bounds, iso, now_ms, stamp
from .irrigation import irrigations
from .store import Store


def downsample(samples, budget=1500):
    """Each sensor's buckets preserve extrema and invalid markers, never feed statistics."""
    if len(samples) <= budget:
        return samples
    from collections import defaultdict
    groups = defaultdict(list)
    for sample in samples:
        groups[(sample['sensorId'], sample['key'], sample['unit'])].append(sample)
    retained = {}
    each = max(16, budget // max(1, len(groups)))
    for items in groups.values():
        size = max(1, len(items) // max(1, each // 4))
        for offset in range(0, len(items), size):
            bucket = items[offset:offset + size]
            good = [s for s in bucket if s['quality'] == 'good' and s['value'] is not None]
            chosen = [bucket[0], bucket[-1]]
            if good:
                chosen += [min(good, key=lambda s: s['value']), max(good, key=lambda s: s['value'])]
            # Every invalid observation stays: losing it would falsely bridge a gap.
            chosen += [s for s in bucket if s['quality'] != 'good']
            for sample in chosen:
                retained[sample['id']] = sample
    return sorted(retained.values(), key=lambda s: (s['capturedAt'], s['id']))


class Application:
    def __init__(self, config, store=None, collector=None):
        self.config = config
        self.store = store or Store(config.data_dir)
        self.collector = collector or Collector(self.store, config)

    def query_range(self, query):
        if query.get('date'):
            start, end = day_bounds(query['date'], self.config.timezone)
        else:
            start, end = stamp(query.get('from')), stamp(query.get('to'))
        requested_end = end
        end = min(end, now_ms())
        if end <= start or end - start > 31 * 86400000:
            raise ValueError('查询必须是非未来、起止有序且不超过 31 天的范围')
        return start, end, requested_end

    def get(self, path, query):
        if path == '/api/data/health':
            status, _, _ = self.collector.snapshot()
            return {'schemaVersion': 1, 'service': 'greenhouse-data', 'collector': status, 'collectorMode': self.config.collector_mode,
                    'timezone': self.config.timezone, 'maxGapSeconds': self.config.max_gap_seconds, 'retentionDays': self.config.retention_days,
                    'datasets': {kind: self.store.summary(kind) for kind in DATASETS}, 'controlCapability': False,
                    'limits': {'maxQueryDays': 31, 'maxAnalysisSamples': 200000, 'chartBudget': 1500}, 'serverTime': iso(now_ms())}
        if path.startswith('/api/v1/'):
            status, packets, actuators = self.collector.snapshot()
            if path == '/api/v1/sensors/latest':
                return packets
            if path == '/api/v1/actuators':
                return actuators
            if path == '/api/v1/health':
                fresh = status['lastSuccessAt'] and now_ms() - stamp(status['lastSuccessAt']) <= self.config.stale_after_seconds * 1000
                return {'schemaVersion': 1, 'status': 'ok' if status['state'] == 'connected' and fresh else 'degraded' if packets else 'offline'}
            raise LookupError('数据服务不提供设备控制接口')
        kind = dataset(query.get('dataset', 'unknown'))
        zone = query.get('zone', 'unassigned')
        if path == '/api/data/zones':
            return {'items': self.store.zones(kind)}
        if path == '/api/data/contexts':
            return {'items': self.store.contexts(kind, zone)}
        start, end, requested_end = self.query_range(query)
        common = {'dataset': kind, 'zoneId': zone, 'from': iso(start), 'to': iso(end), 'requestedTo': iso(requested_end)}
        if path == '/api/data/history':
            limit = int(query.get('limit', 1000)); offset = int(query.get('offset', 0))
            if not 1 <= limit <= 5000 or not 0 <= offset <= 10000000:
                raise ValueError('分页参数无效')
            metric = query.get('metric')
            if metric is not None and metric not in METRICS:
                raise ValueError('指标无效')
            rows = self.store.samples(kind, zone, start, end, metric, limit + 1, offset)
            return {**common, 'items': rows[:limit], 'nextOffset': offset + limit if len(rows) > limit else None}
        if path == '/api/data/events':
            rows = self.store.events(kind, zone, start, end)
            return {**common, 'items': rows[:2000], 'total': len(rows), 'truncated': len(rows) > 2000}
        if path in ('/api/data/report', '/api/data/chart'):
            if self.store.sample_count(kind, zone, start - 3600000, end + 3600000) > 200000:
                raise ValueError('范围超过 200000 条原始采样，请缩小时间范围；未使用降采样替代统计')
            if path.endswith('/report'):
                return {**report(self.store, kind, zone, start, end, self.config.max_gap_seconds, self.config.timezone), 'requestedTo': iso(requested_end)}
            raw = self.store.samples(kind, zone, start, end)
            markers = event_markers(self.store.events(kind, zone, start, end))
            rows = downsample(raw)
            # Event-adjacent observations survive downsampling as well.
            retained = {s['id']: s for s in rows}
            from bisect import bisect_left
            times = [stamp(s['capturedAt']) for s in raw]
            for marker in markers[:2000]:
                position = bisect_left(times, stamp(marker['observedAt']))
                for sample in raw[max(0, position - 5):position + 6]:
                    retained[sample['id']] = sample
            return {**common, 'items': sorted(retained.values(), key=lambda s: (s['capturedAt'], s['id'])), 'rawCount': len(raw),
                    'downsampled': len(retained) < len(raw), 'events': markers[:2000], 'eventsTruncated': len(markers) > 2000,
                    'maxGapSeconds': self.config.max_gap_seconds, 'contexts': self.store.contexts(kind, zone)}
        if path == '/api/data/irrigations' or path.startswith('/api/data/irrigations/'):
            event_id = unquote(path[len('/api/data/irrigations/'):]) if path.startswith('/api/data/irrigations/') else None
            result = irrigations(self.store, kind, zone, start, end, now_ms(), self.config.max_gap_seconds, event_id)
            if event_id and not result['items']:
                raise LookupError('未找到对应分区和区域内的灌溉事件')
            return {**common, **result}
        raise LookupError('未找到接口')

    def post(self, path, value):
        if not isinstance(value, dict):
            raise ValueError('请求必须为 JSON 对象')
        kind = dataset(value.get('dataset', 'unknown'))
        if path == '/api/data/contexts':
            return self.store.context(kind, value['context'])
        if path == '/api/data/notes':
            note = value['note']
            if stamp(note.get('observedAt')) > now_ms() + 30000:
                raise ValueError('不能将未来计划记录为已发生的人工操作')
            event = {**note, 'id': str(uuid.uuid4()), 'kind': 'manual', 'source': 'manual', 'receivedAt': iso(now_ms())}
            self.store.event(kind, event)
            return event
        if path == '/api/data/events':
            events = value.get('events')
            if not isinstance(events, list) or len(events) > 100:
                raise ValueError('每批审计事件不得超过 100 条')
            if any(not isinstance(e, dict) or e.get('kind') not in ('command', 'feedback', 'alarm', 'manual') for e in events):
                raise ValueError('仅允许记录观测事件，不能发送设备命令')
            for event in events:
                if event.get('zoneId') == 'unassigned' and event.get('device') in self.config.device_zones:
                    event = {**event, 'zoneId': self.config.device_zones[event['device']]}
                self.store.event(kind, event)
            return {'accepted': len(events), 'meaning': '仅记录审计数据，没有设备控制能力'}
        raise LookupError('数据服务不提供此写入接口；不会转发控制命令')


def make_server(app, port=None):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def respond(self, status, value):
            payload = json.dumps(value, ensure_ascii=False, allow_nan=False).encode('utf-8')
            try:
                self.send_response(status)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(payload)))
                self.send_header('Cache-Control', 'no-store')
                self.send_header('X-Content-Type-Options', 'nosniff')
                origin = self.headers.get('Origin')
                if origin in app.config.allowed_origins:
                    self.send_header('Access-Control-Allow-Origin', origin)
                    self.send_header('Vary', 'Origin')
                    self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
                    self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                self.end_headers()
                self.wfile.write(payload)
            except (ConnectionError, BrokenPipeError):
                self.close_connection = True

        def do_OPTIONS(self):
            self.respond(200 if self.headers.get('Origin') in app.config.allowed_origins else 403, {})

        def dispatch(self, method):
            origin = self.headers.get('Origin')
            if origin and origin not in app.config.allowed_origins:
                return self.respond(403, {'error': 'Origin 未获允许'})
            try:
                parts = urlsplit(self.path)
                if method == 'GET':
                    query = parse_qs(parts.query)
                    if any(len(values) != 1 for values in query.values()):
                        raise ValueError('查询参数不得重复')
                    result = app.get(parts.path, {k: values[0] for k, values in query.items()})
                else:
                    length = int(self.headers.get('Content-Length', 0))
                    if self.headers.get_content_type() != 'application/json' or not 0 < length <= 2097152:
                        raise ValueError('仅接受不超过 2 MB 的 application/json')
                    result = app.post(parts.path, json.loads(self.rfile.read(length)))
                self.respond(200, result)
            except (ValueError, KeyError, TypeError, sqlite3.IntegrityError) as error:
                self.respond(400, {'error': str(error) if not isinstance(error, sqlite3.IntegrityError) else '记录冲突：相同生效时间已有版本，不允许覆盖'})
            except LookupError as error:
                self.respond(404, {'error': str(error)})
            except Exception:
                self.respond(500, {'error': '数据服务内部错误，请检查本机服务与数据库；未生成替代数据'})

        def do_GET(self):
            self.dispatch('GET')

        def do_POST(self):
            self.dispatch('POST')

    return ThreadingHTTPServer(('127.0.0.1', app.config.port if port is None else port), Handler)
