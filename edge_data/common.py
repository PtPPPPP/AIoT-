"""UTC storage, explicit statistical timezone, and configuration validation."""
import json
import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

DATASETS = ('hardware', 'simulation', 'playback', 'unknown')
METRICS = {'temperature': '°C', 'humidity': '%', 'soilMoisture': '%', 'light': 'lux', 'co2': 'ppm'}
QUALITIES = ('good', 'stale', 'offline', 'invalid', 'error')
DEVICES = ('waterPump', 'fan', 'growLight', 'shade')


def now_ms():
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def stamp(value):
    if not isinstance(value, str):
        raise ValueError('时间必须包含 ISO 8601 时区')
    try:
        date = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if date.tzinfo is None:
            raise ValueError()
        return int(date.timestamp() * 1000)
    except (ValueError, OverflowError) as error:
        raise ValueError('无效时间或缺少时区') from error


def iso(value):
    return datetime.fromtimestamp(value / 1000, timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def statistical_timezone(name):
    # Modern Chinese civil time; no tzdata package needed on Windows.
    if name not in ('UTC', 'Asia/Shanghai'):
        raise ValueError('统计时区仅支持 UTC 或 Asia/Shanghai')
    return timezone.utc if name == 'UTC' else timezone(timedelta(hours=8))


def day_bounds(day, zone):
    start = datetime.strptime(day, '%Y-%m-%d').replace(tzinfo=statistical_timezone(zone))
    return int(start.timestamp() * 1000), int((start + timedelta(days=1)).timestamp() * 1000)


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def text(value, name, allow_empty=False):
    if not isinstance(value, str) or len(value) > 2000 or (not allow_empty and not value.strip()):
        raise ValueError(name + ' 必须是非空文本（最多 2000 字符）')
    return value.strip()


def dataset(value):
    if value not in DATASETS:
        raise ValueError('未知数据分区')
    return value


def packet_origin(packet):
    declared = packet.get('sourceKind')
    source = packet.get('source')
    inferred = source if source in ('simulation', 'playback') else 'unknown'
    kind = dataset(declared if declared is not None else inferred)
    return 'unknown' if inferred != 'unknown' and kind != inferred else kind


@dataclass
class Config:
    data_dir: str = 'var/edge-data'
    port: int = 8090
    collector_mode: str = 'disabled'
    gateway_base_url: str | None = None
    control_events_path: str | None = None
    poll_seconds: float = 5
    request_timeout_seconds: float = 3
    stale_after_seconds: float = 30
    max_gap_seconds: float = 120
    retention_days: int = 90
    timezone: str = 'Asia/Shanghai'
    sensor_zones: dict = field(default_factory=dict)
    device_zones: dict = field(default_factory=dict)
    allowed_origins: list = field(default_factory=lambda: ['http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://localhost:5173'])

    def validate(self):
        statistical_timezone(self.timezone)
        if self.collector_mode not in ('disabled', 'external', 'simulation'):
            raise ValueError('collector_mode 无效')
        if not isinstance(self.port, int) or not 1024 <= self.port <= 65535:
            raise ValueError('port 无效')
        for name, low, high in [('poll_seconds', 0.1, 3600), ('request_timeout_seconds', 0.1, 60), ('stale_after_seconds', 1, 3600), ('max_gap_seconds', 1, 3600), ('retention_days', 1, 3650)]:
            if not finite(getattr(self, name)) or not low <= getattr(self, name) <= high:
                raise ValueError(name + ' 超出允许范围')
        if self.gateway_base_url:
            url = urlparse(self.gateway_base_url)
            if url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password or url.query or url.fragment:
                raise ValueError('网关 URL 无效；本地配置不得内嵌凭据')
            self.gateway_base_url = self.gateway_base_url.rstrip('/')
        if self.control_events_path and (not self.control_events_path.startswith('/api/') or '?' in self.control_events_path or '..' in self.control_events_path):
            raise ValueError('只读事件接口必须是明确的 /api/ 路径')
        for mapping in (self.sensor_zones, self.device_zones):
            if not isinstance(mapping, dict) or not all(isinstance(k, str) and isinstance(v, str) and v for k, v in mapping.items()):
                raise ValueError('区域映射无效')
        if not isinstance(self.allowed_origins, list) or not all(isinstance(v, str) and urlparse(v).scheme in ('http', 'https') for v in self.allowed_origins):
            raise ValueError('allowed_origins 无效')
        return self

    @classmethod
    def load(cls, path=None):
        value = json.loads(Path(path).read_text(encoding='utf-8-sig')) if path else {}
        return cls(**value).validate()
