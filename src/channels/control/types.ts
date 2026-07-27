import { ChannelStatus, DeviceStateKey, PresentationScenarioId } from '../../types';

export type ControlCommandStatus = 'pending' | 'sent' | 'acknowledged' | 'succeeded' | 'failed' | 'timed_out' | 'rejected' | 'cancelled';
export type ControlCommand = {
  id: string; device: DeviceStateKey; target: boolean; source: 'auto-policy' | 'manual';
  createdAt: string; sentAt?: string; timeoutAt: string; scenario: PresentationScenarioId; idempotencyKey: string;
};
export type ControlResult = { command: ControlCommand; status: ControlCommandStatus; actual?: boolean; error?: string };
export interface DeviceControlChannel {
  connect(): Promise<void>; disconnect(): Promise<void>; getStatus(): ChannelStatus; subscribeStatus(listener: (status: ChannelStatus) => void): () => void; execute(command: ControlCommand, deviceOnline?: boolean): Promise<ControlResult>;
}
