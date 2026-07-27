import { RuntimeConfig } from '../../config/runtimeConfig';
import { ChannelStatus } from '../../types';
import { gatewaySchemaVersion, GatewayControlRequest } from '../gateway/contracts';
import { parseGatewayControlResponse } from '../gateway/validation';
import { ControlCommand, ControlResult, DeviceControlChannel } from './types';

export class EdgeGatewayControlChannel implements DeviceControlChannel {
  private status: ChannelStatus = 'unconfigured';
  private readonly results = new Map<string, Promise<ControlResult>>();
  constructor(private readonly config: RuntimeConfig, private readonly fetcher: typeof fetch = fetch) {}
  getStatus() { return this.status; }
  async connect() { this.status = this.config.edgeApiBaseUrl ? 'connected' : 'unconfigured'; }
  async disconnect() { this.status = 'disconnected'; }
  execute(command: ControlCommand): Promise<ControlResult> {
    const existing = this.results.get(command.idempotencyKey); if (existing) return existing;
    const result = this.send(command); this.results.set(command.idempotencyKey, result); return result;
  }
  private async send(command: ControlCommand): Promise<ControlResult> {
    if (!this.config.edgeApiBaseUrl) return { command, status: 'rejected', actual: false, error: '边缘网关未配置' };
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    const request: GatewayControlRequest = { schemaVersion: gatewaySchemaVersion, commandId: command.id, idempotencyKey: command.idempotencyKey, device: command.device, target: command.target, source: command.source, createdAt: command.createdAt, timeoutAt: command.timeoutAt };
    try {
      this.status = 'connecting';
      const response = await this.fetcher(`${this.config.edgeApiBaseUrl}/api/v1/control/commands`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal: controller.signal });
      if (!response.ok) return { command, status: 'failed', actual: false, error: `网关返回 HTTP ${response.status}` };
      const parsed = parseGatewayControlResponse(await response.json());
      if (!parsed || parsed.commandId !== command.id || parsed.idempotencyKey !== command.idempotencyKey) return { command, status: 'failed', actual: false, error: '网关控制响应格式无效' };
      this.status = 'connected'; return { command, status: parsed.status, actual: parsed.actual, error: parsed.error };
    } catch { return { command, status: controller.signal.aborted ? 'timed_out' : 'failed', actual: false, error: controller.signal.aborted ? '控制命令超时' : '边缘网关请求失败' }; }
    finally { clearTimeout(timeout); }
  }
}
