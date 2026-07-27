import { RuntimeConfig } from '../../config/runtimeConfig';
import { ChannelStatus } from '../../types';
import { parseGatewaySensorPacket } from '../gateway/validation';
import { SensorDataChannel, SensorPacket } from './types';

type FetchLike = typeof fetch;
export class EdgeGatewayDataChannel implements SensorDataChannel {
  private status: ChannelStatus = 'unconfigured';
  private listeners = new Set<(packet: SensorPacket) => void>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastPacketAt = 0;
  private readonly latestPackets = new Map<string, SensorPacket>();
  private controller: AbortController | undefined;

  constructor(private readonly config: RuntimeConfig, private readonly fetcher: FetchLike = fetch) {}
  getStatus() { return this.status; }
  subscribe(listener: (packet: SensorPacket) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  async connect() {
    if (this.timer) return;
    if (!this.config.edgeApiBaseUrl) { this.status = 'unconfigured'; return; }
    this.status = 'connecting';
    await this.poll();
    this.timer = setInterval(() => { void this.poll(); }, this.config.pollIntervalMs);
  }
  async disconnect() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined; this.controller?.abort(); this.controller = undefined; this.status = 'disconnected';
  }
  private async poll() {
    if (!this.config.edgeApiBaseUrl) return;
    this.controller?.abort();
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
      this.status = accepted ? 'connected' : 'failed';
      if (this.lastPacketAt && Date.now() - this.lastPacketAt > this.config.staleAfterMs) {
        this.status = 'stale';
        this.latestPackets.forEach((packet) => this.listeners.forEach((listener) => listener({ ...packet, quality: 'stale', valid: false, error: '数据超过新鲜度时限' })));
      }
    } catch { if (!controller.signal.aborted) this.status = 'failed'; }
    finally { clearTimeout(timeout); if (this.controller === controller) this.controller = undefined; }
  }
}
