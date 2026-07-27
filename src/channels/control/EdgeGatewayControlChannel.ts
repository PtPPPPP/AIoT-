import { RuntimeConfig } from '../../config/runtimeConfig';
import { ChannelStatus } from '../../types';
import { gatewaySchemaVersion, GatewayControlRequest } from '../gateway/contracts';
import { parseGatewayControlResponse } from '../gateway/validation';
import { ControlCommand, ControlResult, DeviceControlChannel } from './types';

export class EdgeGatewayControlChannel implements DeviceControlChannel {
  private status: ChannelStatus = 'unconfigured';
  private readonly results = new Map<string, Promise<ControlResult>>();
  private statusListeners = new Set<(status: ChannelStatus) => void>();
  constructor(private readonly config: RuntimeConfig, private readonly fetcher: typeof fetch = fetch) {}
  getStatus() { return this.status; }
  async connect() { this.setStatus(this.config.edgeApiBaseUrl ? 'connecting' : 'unconfigured'); }
  async disconnect() { this.setStatus('disconnected'); }
  execute(command: ControlCommand): Promise<ControlResult> {
    const existing = this.results.get(command.idempotencyKey); if (existing) return existing;
    const result = this.send(command).finally(() => this.results.delete(command.idempotencyKey)); this.results.set(command.idempotencyKey, result); return result;
  }
  subscribeStatus(listener: (status: ChannelStatus) => void) { this.statusListeners.add(listener); return () => this.statusListeners.delete(listener); }
  markReady(status: ChannelStatus) { this.setStatus(status); }
  private async send(command: ControlCommand): Promise<ControlResult> {
    if (!this.config.edgeApiBaseUrl) return { command, status: 'rejected', error: '边缘网关未配置' };
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    const request: GatewayControlRequest = { schemaVersion: gatewaySchemaVersion, commandId: command.id, idempotencyKey: command.idempotencyKey, device: command.device, target: command.target, source: command.source, createdAt: command.createdAt, timeoutAt: command.timeoutAt };
    try {
      this.setStatus('connecting');
      const response = await this.fetcher(`${this.config.edgeApiBaseUrl}/api/v1/control/commands`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal: controller.signal });
      if (!response.ok) return { command, status: 'failed', error: `网关返回 HTTP ${response.status}` };
      const parsed = parseGatewayControlResponse(await response.json());
      if (!parsed || parsed.commandId !== command.id || parsed.idempotencyKey !== command.idempotencyKey) return { command, status: 'failed', error: '网关控制响应格式无效' };
      this.setStatus('connected'); return { command, status: parsed.status, actual: parsed.actual, error: parsed.error };
    } catch { this.setStatus('failed'); return { command, status: controller.signal.aborted ? 'timed_out' : 'failed', error: controller.signal.aborted ? '控制命令超时' : '边缘网关请求失败' }; }
    finally { clearTimeout(timeout); }
  }
  private setStatus(status: ChannelStatus) { this.status = status; this.statusListeners.forEach((listener) => listener(status)); }
}
