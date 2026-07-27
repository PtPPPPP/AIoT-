import { SensorKey, SensorQuality } from '../../types';
import { GatewayControlResponse, GatewaySensorPacket, gatewaySchemaVersion } from './contracts';

const sensorKeys: SensorKey[] = ['temperature', 'humidity', 'light', 'soilMoisture', 'co2'];
const qualities: SensorQuality[] = ['good', 'stale', 'offline', 'invalid', 'error'];
const statuses: GatewayControlResponse['status'][] = ['pending', 'sent', 'acknowledged', 'succeeded', 'failed', 'timed_out', 'rejected', 'cancelled'];
const record = (value: unknown): Record<string, unknown> | null => typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const timestamp = (value: unknown): value is string => text(value) && Number.isFinite(Date.parse(value));
const finiteOrNull = (value: unknown): value is number | null => value === null || (typeof value === 'number' && Number.isFinite(value));

export function parseGatewaySensorPacket(value: unknown): GatewaySensorPacket | null {
  const item = record(value); if (!item || item.schemaVersion !== gatewaySchemaVersion || !sensorKeys.includes(item.key as SensorKey) || !finiteOrNull(item.value) || !qualities.includes(item.quality as SensorQuality)) return null;
  if (!text(item.eventId) || !Number.isInteger(item.sequence) || !text(item.source) || !text(item.gatewayId) || !text(item.deviceId) || !text(item.channelId) || !text(item.sensorId) || !text(item.unit) || !timestamp(item.capturedAt) || !timestamp(item.receivedAt) || typeof item.valid !== 'boolean') return null;
  if ((item.quality === 'good') !== item.valid || (item.valid && item.value === null)) return null;
  if (item.rawValue !== undefined && (typeof item.rawValue !== 'number' || !Number.isFinite(item.rawValue))) return null;
  return item as GatewaySensorPacket;
}

export function parseGatewayControlResponse(value: unknown): GatewayControlResponse | null {
  const item = record(value); if (!item || item.schemaVersion !== gatewaySchemaVersion || !text(item.commandId) || !text(item.idempotencyKey) || !statuses.includes(item.status as GatewayControlResponse['status']) || typeof item.target !== 'boolean' || typeof item.actual !== 'boolean') return null;
  return item as GatewayControlResponse;
}
