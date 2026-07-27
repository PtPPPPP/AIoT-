import { DeviceStateKey, SensorKey, SensorQuality } from '../../types';

export const gatewaySchemaVersion = 1 as const;
export type GatewayStatus = 'ok' | 'degraded' | 'offline';
export type GatewayDeviceStatus = { deviceId: string; model: string; online: boolean; lastSeenAt: string; error?: string };
export type GatewayHealth = { schemaVersion: 1; gatewayId: string; status: GatewayStatus; timestamp: string; softwareVersion: string; devices: GatewayDeviceStatus[] };
export type GatewaySensorPacket = { schemaVersion: 1; eventId: string; sequence: number; source: string; gatewayId: string; deviceId: string; channelId: string; sensorId: string; key: SensorKey; value: number | null; rawValue?: number; unit: string; capturedAt: string; receivedAt: string; quality: SensorQuality; valid: boolean; error?: string };
export type GatewayControlRequest = { schemaVersion: 1; commandId: string; idempotencyKey: string; device: DeviceStateKey; target: boolean; source: 'auto-policy' | 'manual'; createdAt: string; timeoutAt: string; expectedPreviousState?: boolean; reason?: string };
export type GatewayControlResponse = { schemaVersion: 1; commandId: string; idempotencyKey: string; status: 'pending' | 'sent' | 'acknowledged' | 'succeeded' | 'failed' | 'timed_out' | 'rejected' | 'cancelled'; target: boolean; actual: boolean; acknowledgedAt?: string; completedAt?: string; errorCode?: string; error?: string };
export type WebSocketEventEnvelope = { schemaVersion: 1; type: 'sensor.packet' | 'device.status' | 'actuator.state' | 'control.result' | 'gateway.status' | 'heartbeat'; timestamp: string; payload: unknown };
