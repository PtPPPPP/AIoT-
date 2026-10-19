import { ChannelStatus, DataOrigin, SensorKey, SensorQuality } from '../../types';

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
  sourceKind?: DataOrigin;
  error?: string;
};

export interface SensorDataChannel {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): ChannelStatus;
  subscribeStatus(listener: (status: ChannelStatus) => void): () => void;
  subscribe(listener: (packet: SensorPacket) => void): () => void;
}
