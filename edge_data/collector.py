"""A single independently running reader. This module never sends control requests."""
import json
import math
import threading
from urllib.request import HTTPRedirectHandler, Request, build_opener

from .common import DATASETS, DEVICES, METRICS, iso, now_ms, packet_origin, stamp
from .store import identity


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('采集接口重定向已拒绝，请配置明确的只读网关地址')


class Collector:
    def __init__(self, store, config, reader=None):
        self.store, self.config = store, config
        self.reader = reader or self.read_json
        self.stop_event = threading.Event()
        self.lock = threading.Lock()
        self.thread = None
        self.packets, self.actuators = {}, []
        self.status = {'state': 'unconfigured', 'lastAttemptAt': None, 'lastSuccessAt': None, 'error': None, 'invalidPackets': 0}
        self.tick = 0
        self.last_purge = 0

    def read_json(self, path):
        # Fixed GET only, redirect rejection, bounded body, no browser or actuator dependency.
        request = Request(self.config.gateway_base_url + path, method='GET', headers={'Accept': 'application/json'})
        with build_opener(NoRedirect()).open(request, timeout=self.config.request_timeout_seconds) as response:
            body = response.read(4 * 1024 * 1024 + 1)
            if len(body) > 4 * 1024 * 1024:
                raise ValueError('网关响应超过 4 MB 上限')
            return json.loads(body)

    def start(self):
        for kind in (() if self.config.collector_mode == 'disabled' else ('simulation',) if self.config.collector_mode == 'simulation' else DATASETS):
            self.store.event(kind, {'id': 'collector-start:' + iso(now_ms()), 'kind': 'collector-gap', 'zoneId': '*', 'observedAt': iso(now_ms()),
                                    'source': 'unknown', 'reason': '采集服务启动／重启；未覆盖的时间不能假定设备停止或持续运行'})
        self.thread = threading.Thread(target=self.run, name='single-greenhouse-collector', daemon=True)
        self.thread.start()

    def run(self):
        while not self.stop_event.is_set():
            try:
                self.collect_once()
                at = now_ms()
                if at - self.last_purge > 3600000:
                    self.store.purge(at - self.config.retention_days * 86400000)
                    self.last_purge = at
            except Exception as error:
                with self.lock:
                    self.status.update(state='failed', error=type(error).__name__ + '：存储或采集处理失败，等待重试')
            self.stop_event.wait(self.config.poll_seconds)

    def stop(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=self.config.request_timeout_seconds * 3 + 2)

    def collect_once(self, at=None):
        at = now_ms() if at is None else at
        if self.config.collector_mode == 'disabled' or self.config.collector_mode == 'external' and not self.config.gateway_base_url:
            with self.lock:
                self.status.update(state='unconfigured', error='网关读取地址未配置；没有生成替代数据')
            return
        errors, accepted = [], 0
        with self.lock:
            self.status['lastAttemptAt'] = iso(at)
        if self.config.collector_mode == 'simulation':
            packets, actuators = self.simulation(at)
        else:
            packets = actuators = None
            try:
                packets = self.reader('/api/v1/sensors/latest')
                if not isinstance(packets, list):
                    raise ValueError('采样响应必须是数组')
            except Exception as error:  # Keep collector alive; diagnostics never include credentials/configuration.
                errors.append(type(error).__name__ + '：采样读取失败')
            try:
                actuators = self.reader('/api/v1/actuators')
                if not isinstance(actuators, list):
                    raise ValueError('执行器响应必须是数组')
            except Exception as error:
                errors.append(type(error).__name__ + '：执行器反馈读取失败')
        if isinstance(packets, list):
            for packet in packets:
                try:
                    zone = self.config.sensor_zones.get(packet.get('sensorId'), packet.get('zoneId') or 'unassigned')
                    self.store.sample(packet, zone, received_at=at, stale_after_seconds=self.config.stale_after_seconds)
                    kind = packet_origin(packet)
                    canonical = self.store.sample_by_id(kind, identity(packet['gatewayId'], packet['sensorId'], packet['key'], stamp(packet['capturedAt'])))
                    canonical['valid'] = canonical['quality'] == 'good'
                    key = (packet['sensorId'], packet['key'])
                    with self.lock:
                        previous = self.packets.get(key)
                        if previous is None or stamp(packet['capturedAt']) >= stamp(previous['capturedAt']):
                            self.packets[key] = canonical
                    accepted += 1
                except (ValueError, TypeError, KeyError, AttributeError):
                    with self.lock:
                        self.status['invalidPackets'] += 1
        clean_actuators = []
        if isinstance(actuators, list):
            for item in actuators:
                try:
                    device = item.get('logicalDevice')
                    if device not in DEVICES or not isinstance(item.get('online'), bool):
                        raise ValueError('执行器字段无效')
                    updated = stamp(item.get('updatedAt'))
                    if updated > at + 30000:
                        raise ValueError('执行器时间超前')
                    kind = item.get('sourceKind', 'unknown')
                    zone = self.config.device_zones.get(device, item.get('zoneId') or 'unassigned')
                    actual = item.get('actual') if item['online'] and at - updated <= self.config.stale_after_seconds * 1000 else None
                    feedback = {'id': identity('feedback', device, updated, actual, item.get('feedbackLevel', 'gateway')),
                                'kind': 'feedback', 'zoneId': zone, 'device': device, 'actual': actual,
                                'observedAt': item['updatedAt'], 'receivedAt': iso(at), 'source': 'simulation' if kind == 'simulation' else 'gateway',
                                'feedbackLevel': item.get('feedbackLevel', 'gateway'), 'precisionMs': self.config.poll_seconds * 1000,
                                'timeBasis': 'polling', 'online': item['online']}
                    self.store.event(kind, feedback)
                    clean_actuators.append(item)
                except (ValueError, TypeError, KeyError, AttributeError):
                    errors.append('无效执行器反馈已排除')
            with self.lock:
                # Missing feedback is not synthesized as a stop; its last timestamp remains visible.
                if clean_actuators:
                    self.actuators = clean_actuators
        if self.config.collector_mode == 'external' and self.config.control_events_path:
            try:
                events = self.reader(self.config.control_events_path)
                if not isinstance(events, list):
                    raise ValueError('事件响应必须是数组')
                for event in events:
                    self.store.event(event.get('sourceKind', 'unknown'), event)
            except Exception as error:
                errors.append(type(error).__name__ + '：只读事件接口读取失败')
        with self.lock:
            was_failed = self.status['state'] in ('failed', 'degraded')
            self.status.update(state='failed' if not accepted else 'degraded' if errors else 'connected', error='；'.join(errors) or None)
            if accepted and not errors:
                self.status['lastSuccessAt'] = iso(at)
        if errors or was_failed:
            for kind in (('simulation',) if self.config.collector_mode == 'simulation' else DATASETS):
                self.store.event(kind, {'id': identity('collector-gap', at), 'zoneId': '*', 'kind': 'collector-gap', 'observedAt': iso(at),
                                        'source': 'unknown', 'reason': '采集通信中断或重连，区间内设备动作不确定'})
        if at - self.last_purge > 3600000:
            self.store.purge(at - self.config.retention_days * 86400000)
            self.last_purge = at

    def snapshot(self):
        with self.lock:
            status, actuators, packets = dict(self.status), list(self.actuators), list(self.packets.values())
        now = now_ms()
        for i, packet in enumerate(packets):
            packet = dict(packet)
            if packet['quality'] == 'good' and now - stamp(packet['capturedAt']) > self.config.stale_after_seconds * 1000:
                packet.update(quality='stale', valid=False)
            packets[i] = packet
        return status, packets, actuators

    def simulation(self, at):
        self.tick += 1
        packets = []
        values = {'temperature': 26 + math.sin(self.tick / 12), 'humidity': 60, 'light': 18000, 'soilMoisture': 38 + math.sin(self.tick / 6) * 5, 'co2': 700}
        for metric, value in values.items():
            packets.append({'schemaVersion': 1, 'eventId': 'simulation:' + str(at) + ':' + metric, 'sequence': self.tick, 'gatewayId': 'isolated-simulator',
                            'deviceId': 'sim-' + metric, 'channelId': metric, 'sensorId': 'sim-' + metric, 'key': metric, 'unit': METRICS[metric],
                            'value': round(value, 2), 'source': 'simulation', 'sourceKind': 'simulation', 'quality': 'good', 'valid': True,
                            'capturedAt': iso(at), 'receivedAt': iso(at), 'zoneId': 'simulation-zone'})
        return packets, [{'logicalDevice': device, 'online': True, 'actual': self.tick % 24 in range(6, 10) if device == 'waterPump' else False,
                          'updatedAt': iso(at), 'feedbackLevel': 'simulation', 'sourceKind': 'simulation', 'zoneId': 'simulation-zone'} for device in DEVICES]
