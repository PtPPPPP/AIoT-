import { parseGatewayControlResponse, parseGatewaySensorPacket } from './validation';

const packet = { schemaVersion: 1, eventId: 'evt-1', sequence: 1, source: 'gateway', gatewayId: 'gw-1', deviceId: 'wise-1', channelId: 'AI0', sensorId: 'soil-1', key: 'soilMoisture', value: 35, unit: '%', capturedAt: '2026-01-01T10:00:00.000Z', receivedAt: '2026-01-01T10:00:01.000Z', quality: 'good', valid: true };
describe('gateway DTO validation', () => {
  it('accepts a valid sensor packet', () => expect(parseGatewaySensorPacket(packet)?.eventId).toBe('evt-1'));
  it.each([{ ...packet, key: 'unknown' }, { ...packet, value: Infinity }, { ...packet, capturedAt: 'bad' }, { ...packet, quality: 'unknown' }, { ...packet, schemaVersion: undefined }])('rejects invalid sensor data', (value) => expect(parseGatewaySensorPacket(value)).toBeNull());
  it('rejects a response whose command identity is unavailable to the caller', () => expect(parseGatewayControlResponse({ schemaVersion: 1, idempotencyKey: 'key', status: 'succeeded', target: true, actual: true })).toBeNull());
});
