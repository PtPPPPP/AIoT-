import { ChannelStatus, SensorKey, SensorStates, Reading } from '../../types';
import { SensorDataChannel, SensorPacket } from './types';

const units: Record<SensorKey, string> = { temperature: '°C', humidity: '%', light: 'lux', soilMoisture: '%', co2: 'ppm' };

/** 本地模拟器适配器：仅转发已经生成的模拟快照，不伪造外部连接。 */
export class SimulationDataChannel implements SensorDataChannel {
  private status: ChannelStatus = 'disconnected';
  private listeners = new Set<(packet: SensorPacket) => void>();
  private statusListeners = new Set<(status: ChannelStatus) => void>();

  async connect() { this.setStatus('connected'); }
  async disconnect() { this.setStatus('disconnected'); }
  getStatus() { return this.status; }
  subscribeStatus(listener: (status: ChannelStatus) => void) { this.statusListeners.add(listener); return () => this.statusListeners.delete(listener); }
  subscribe(listener: (packet: SensorPacket) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private setStatus(status: ChannelStatus) { this.status = status; this.statusListeners.forEach((listener) => listener(status)); }
  publish(reading: Reading, sensors: SensorStates, receivedAt: string) {
    for (const key of Object.keys(sensors) as SensorKey[]) {
      const sensor = sensors[key];
      const packet: SensorPacket = {
        source: 'local-simulator', capturedAt: reading.capturedAt, receivedAt, sensorId: sensor.sourceId,
        key, value: reading[key], unit: units[key], quality: sensor.quality,
        valid: sensor.quality === 'good' && reading[key] !== null, simulated: true,
        ...(sensor.quality === 'offline' ? { error: '传感器离线' } : {}),
      };
      this.listeners.forEach((listener) => listener(packet));
    }
  }
}
