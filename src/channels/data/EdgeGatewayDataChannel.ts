import { RuntimeConfig } from '../../config/runtimeConfig';
import { ChannelStatus } from '../../types';
import { parseGatewaySensorPacket } from '../gateway/validation';
import { SensorDataChannel, SensorPacket } from './types';

export type ExternalActuatorSnapshot = { logicalDevice: 'waterPump' | 'fan' | 'growLight' | 'shade'; actual?: boolean; target?: boolean; online: boolean; updatedAt: string };

type FetchLike = typeof fetch;
export class EdgeGatewayDataChannel implements SensorDataChannel {
  private status: ChannelStatus = 'unconfigured';
  private listeners = new Set<(packet: SensorPacket) => void>();
  private statusListeners = new Set<(status: ChannelStatus) => void>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastPacketAt = 0;
  private readonly latestPackets = new Map<string, SensorPacket>();
  private controller: AbortController | undefined;
  private pollInFlight = false;

  constructor(private readonly config: RuntimeConfig, private readonly fetcher: FetchLike = fetch) {}
  getStatus() { return this.status; }
  subscribeStatus(listener: (status: ChannelStatus) => void) { this.statusListeners.add(listener); return () => this.statusListeners.delete(listener); }
  subscribe(listener: (packet: SensorPacket) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  async connect() {
    if (this.timer) return;
    if (!this.config.edgeApiBaseUrl) { this.setStatus('unconfigured'); return; }
    this.setStatus('connecting');
    await this.poll();
    this.timer = setInterval(() => { void this.poll(); }, this.config.pollIntervalMs);
  }
  async disconnect() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined; this.controller?.abort(); this.controller = undefined; this.setStatus('disconnected');
  }
  async synchronizeInitialState(): Promise<ExternalActuatorSnapshot[]> {
    if (!this.config.edgeApiBaseUrl) throw new Error('边缘网关未配置');
    this.setStatus('connecting');
    const health = await this.fetchJson('/api/v1/health');
    if (!isHealth(health)) throw new Error('网关健康检查响应无效');
    this.setStatus(health.status === 'ok' ? 'connected' : health.status === 'degraded' ? 'degraded' : 'failed');
    if (health.status === 'offline') throw new Error('网关离线');
    const raw = await this.fetchJson('/api/v1/actuators');
    if (!Array.isArray(raw) || !raw.every(isActuator)) throw new Error('执行器状态响应无效');
    return raw;
  }
  private async poll() {
    if (!this.config.edgeApiBaseUrl || this.pollInFlight) return;
    this.pollInFlight = true;
    const controller = new AbortController(); this.controller = controller;
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    try {
      const response = await this.fetcher(`${this.config.edgeApiBaseUrl}/api/v1/sensors/latest`, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload: unknown = await response.json();
      const packets = Array.isArray(payload) ? payload : [];
      let accepted = 0;
      for (const raw of packets) {
        const packet = parseGatewaySensorPacket(raw);
        if (!packet) continue;
        accepted += 1; this.lastPacketAt = Date.now();
        const translated = { ...packet, simulated: false };
        this.latestPackets.set(packet.sensorId, translated);
        this.listeners.forEach((listener) => listener(translated));
      }
      this.setStatus(accepted ? 'connected' : 'failed');
      if (this.lastPacketAt && Date.now() - this.lastPacketAt > this.config.staleAfterMs) {
        this.setStatus('stale');
        this.latestPackets.forEach((packet) => this.listeners.forEach((listener) => listener({ ...packet, quality: 'stale', valid: false, error: '数据超过新鲜度时限' })));
      }
    } catch { if (!controller.signal.aborted) this.setStatus('failed'); }
    finally { clearTimeout(timeout); if (this.controller === controller) this.controller = undefined; this.pollInFlight = false; }
  }
  private async fetchJson(path: string): Promise<unknown> {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    try { const response = await this.fetcher(`${this.config.edgeApiBaseUrl}${path}`, { signal: controller.signal }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return await response.json() as unknown; }
    finally { clearTimeout(timeout); }
  }
  private setStatus(status: ChannelStatus) { this.status = status; this.statusListeners.forEach((listener) => listener(status)); }
}

function isHealth(value: unknown): value is { status: 'ok' | 'degraded' | 'offline' } { return typeof value === 'object' && value !== null && (value as { schemaVersion?: unknown }).schemaVersion === 1 && ['ok', 'degraded', 'offline'].includes((value as { status?: unknown }).status as string); }
function isActuator(value: unknown): value is ExternalActuatorSnapshot { if (typeof value !== 'object' || value === null) return false; const item = value as Record<string, unknown>; return ['waterPump', 'fan', 'growLight', 'shade'].includes(item.logicalDevice as string) && typeof item.online === 'boolean' && typeof item.updatedAt === 'string' && Number.isFinite(Date.parse(item.updatedAt)) && (item.actual === undefined || typeof item.actual === 'boolean') && (item.target === undefined || typeof item.target === 'boolean'); }
