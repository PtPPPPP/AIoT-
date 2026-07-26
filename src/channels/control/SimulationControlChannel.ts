import { ChannelStatus } from '../../types';
import { ControlCommand, ControlResult, DeviceControlChannel } from './types';

/** 模拟执行器通道。离线即明确拒绝，幂等键保证重复下发不会重复执行。 */
export class SimulationControlChannel implements DeviceControlChannel {
  private status: ChannelStatus = 'connected';
  private results = new Map<string, ControlResult>();
  async connect() { this.status = 'connected'; }
  async disconnect() { this.status = 'disconnected'; }
  getStatus() { return this.status; }
  async execute(command: ControlCommand, deviceOnline: boolean): Promise<ControlResult> {
    return this.executeNow(command, deviceOnline);
  }
  executeNow(command: ControlCommand, deviceOnline: boolean): ControlResult {
    const cached = this.results.get(command.idempotencyKey); if (cached) return cached;
    const result: ControlResult = deviceOnline ? { command: { ...command, sentAt: command.createdAt }, status: 'succeeded', actual: command.target } : { command, status: 'rejected', actual: false, error: '执行器离线，控制指令未执行' };
    this.results.set(command.idempotencyKey, result); return result;
  }
}
