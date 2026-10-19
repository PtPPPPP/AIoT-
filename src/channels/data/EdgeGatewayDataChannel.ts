import { RuntimeConfig } from '../../config/runtimeConfig';
import { ChannelStatus, DataOrigin, DeviceStateKey } from '../../types';
import { parseGatewaySensorPacket } from '../gateway/validation';
import { SensorDataChannel, SensorPacket } from './types';

export type ExternalActuatorSnapshot = { logicalDevice: DeviceStateKey; actual?: boolean; target?: boolean; online: boolean; updatedAt: string; feedbackLevel?: 'physical' | 'output' | 'gateway'; sourceKind?: DataOrigin };

export class EdgeGatewayDataChannel implements SensorDataChannel {
  private status: ChannelStatus = 'unconfigured';
  private listeners = new Set<(packet: SensorPacket) => void>();
  private actuatorListeners = new Set<(items: ExternalActuatorSnapshot[]) => void>();
  private statusListeners = new Set<(status: ChannelStatus) => void>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly latestPackets = new Map<string, SensorPacket>();
  private controllers = new Set<AbortController>();
  private pollInFlight = false;
  private generation = 0;
  private running = false;

  constructor(private readonly config: RuntimeConfig, private readonly fetcher: typeof fetch = (...args) => globalThis.fetch(...args)) {}
  getStatus() { return this.status; }
  subscribeStatus(listener: (status: ChannelStatus) => void) { this.statusListeners.add(listener); return () => this.statusListeners.delete(listener); }
  subscribe(listener: (packet: SensorPacket) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  subscribeActuators(listener: (items: ExternalActuatorSnapshot[]) => void) { this.actuatorListeners.add(listener); return () => this.actuatorListeners.delete(listener); }
  async connect() {
    if (this.running) return;
    if (!this.config.edgeApiBaseUrl) { this.setStatus('unconfigured'); return; }
    this.running = true;
    const generation = this.generation;
    this.setStatus('connecting');
    await this.poll();
    if (this.running && generation === this.generation) this.timer = setInterval(() => { void this.poll(); }, this.config.pollIntervalMs);
  }
  async disconnect() {
    this.running = false; this.generation += 1;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.controllers.forEach(c => c.abort()); this.controllers.clear();
    this.setStatus('disconnected');
  }
  async synchronizeInitialState(): Promise<ExternalActuatorSnapshot[]> {
    if (!this.config.edgeApiBaseUrl) throw new Error('边缘网关未配置');
    this.setStatus('connecting');
    try {
      const health = await this.fetchJson('/api/v1/health');
      if (!isHealth(health)) throw new Error('网关健康检查响应无效');
      if (health.status === 'offline') throw new Error('网关离线');
      const raw = await this.fetchJson('/api/v1/actuators');
      if (!validActuators(raw)) throw new Error('执行器状态响应无效');
      this.setStatus(health.status === 'ok' ? 'connected' : 'degraded');
      return raw;
    } catch (error) { this.setStatus('failed'); throw error; }
  }
  private async poll() {
    if (!this.config.edgeApiBaseUrl || this.pollInFlight) return;
    this.pollInFlight = true;
    const generation = this.generation;
    try {
      const results = await Promise.allSettled([this.fetchJson('/api/v1/sensors/latest'), this.fetchJson('/api/v1/actuators')]);
      if (!this.running || generation !== this.generation) return;
      const sensorResult = results[0]; const actuatorResult = results[1];
      let accepted = 0; const healthyKeys = new Set<string>();
      if (sensorResult.status === 'fulfilled' && Array.isArray(sensorResult.value)) {
        for (const raw of sensorResult.value) {
          const packet = parseGatewaySensorPacket(raw);
          if (!packet) continue;
          const previous = this.latestPackets.get(packet.key);
          if (previous && Date.parse(previous.capturedAt) > Date.parse(packet.capturedAt)) continue;
          accepted += 1;
          const age = Date.now() - Date.parse(packet.capturedAt);
          const quality = age < -30_000 ? 'invalid' : packet.quality === 'good' && age > this.config.staleAfterMs ? 'stale' : packet.quality;
          const sourceKind = packet.sourceKind ?? (packet.source === 'simulation' ? 'simulation' : packet.source === 'playback' ? 'playback' : 'unknown');
          const translated: SensorPacket = { ...packet, quality, valid: quality === 'good', sourceKind, simulated: sourceKind === 'simulation' };
          this.latestPackets.set(packet.key, translated);
          if (quality === 'good') healthyKeys.add(packet.key);
          this.listeners.forEach(listener => listener(translated));
        }
      }
      this.latestPackets.forEach(packet => {
        if (packet.quality === 'good' && Date.now() - Date.parse(packet.capturedAt) > this.config.staleAfterMs) {
          const stale: SensorPacket = { ...packet, quality: 'stale', valid: false };
          this.latestPackets.set(packet.key, stale); this.listeners.forEach(listener => listener(stale));
        }
      });
      const actuatorsValid = actuatorResult.status === 'fulfilled' && validActuators(actuatorResult.value);
      if (actuatorsValid && actuatorResult.status === 'fulfilled') this.actuatorListeners.forEach(listener => listener(actuatorResult.value as ExternalActuatorSnapshot[]));
      this.setStatus(!accepted ? 'failed' : !healthyKeys.size ? 'stale' : healthyKeys.size < 5 || !actuatorsValid ? 'partial-offline' : 'connected');
    } finally { this.pollInFlight = false; }
  }
  private async fetchJson(path: string): Promise<unknown> {
    const controller = new AbortController(); this.controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    try {
      const response = await this.fetcher(this.config.edgeApiBaseUrl + path, { signal: controller.signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.json() as unknown;
    } finally { clearTimeout(timeout); this.controllers.delete(controller); }
  }
  private setStatus(status: ChannelStatus) { this.status = status; this.statusListeners.forEach(listener => listener(status)); }
}
function isHealth(value: unknown): value is { status: 'ok' | 'degraded' | 'offline' } { return typeof value === 'object' && value !== null && (value as { schemaVersion?: unknown }).schemaVersion === 1 && ['ok', 'degraded', 'offline'].includes((value as { status?: unknown }).status as string); }
function validActuators(value: unknown): value is ExternalActuatorSnapshot[] { return Array.isArray(value) && value.every(isActuator) && new Set(value.map(v => v.logicalDevice)).size === value.length; }
function isActuator(value: unknown): value is ExternalActuatorSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return ['waterPump', 'fan', 'growLight', 'shade'].includes(item.logicalDevice as string) && typeof item.online === 'boolean' && typeof item.updatedAt === 'string' && Number.isFinite(Date.parse(item.updatedAt)) && Date.parse(item.updatedAt) <= Date.now() + 30_000 && (item.actual === undefined || typeof item.actual === 'boolean') && (item.target === undefined || typeof item.target === 'boolean') && (item.feedbackLevel === undefined || ['physical', 'output', 'gateway'].includes(String(item.feedbackLevel))) && (item.sourceKind === undefined || ['hardware', 'simulation', 'playback', 'unknown'].includes(String(item.sourceKind)));
}
