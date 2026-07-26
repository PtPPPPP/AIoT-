import { ChannelStatus, SensorKey, SensorQuality } from '../../types';

export type SensorPacket = {
  source: string;
  capturedAt: string;
  receivedAt: string;
  sensorId: string;
  key: SensorKey;
  value: number | null;
  unit: string;
  quality: SensorQuality;
  valid: boolean;
  simulated: boolean;
  error?: string;
};

export interface SensorDataChannel {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): ChannelStatus;
  subscribe(listener: (packet: SensorPacket) => void): () => void;
}
