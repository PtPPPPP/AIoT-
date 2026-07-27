import { EdgeGatewayDataChannel } from './EdgeGatewayDataChannel';

const config = { mode: 'external' as const, edgeApiBaseUrl: 'http://gateway.local', dataTransport: 'http-polling' as const, pollIntervalMs: 60_000, requestTimeoutMs: 3000, staleAfterMs: 5000, warnings: [] };
const packet = { schemaVersion: 1, eventId: 'evt-1', sequence: 1, source: 'gateway', gatewayId: 'gw', deviceId: 'wise', channelId: 'AI0', sensorId: 'soil', key: 'soilMoisture', value: 35, unit: '%', capturedAt: '2026-01-01T10:00:00.000Z', receivedAt: '2026-01-01T10:00:01.000Z', quality: 'good', valid: true };
describe('edge gateway data channel', () => {
  it('validates and publishes polled packets, then disconnects cleanly', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([packet]), { status: 200 }));
    const channel = new EdgeGatewayDataChannel(config, fetcher);
    const received: string[] = []; const unsubscribe = channel.subscribe((item) => received.push(item.sensorId));
    await channel.connect(); unsubscribe(); await channel.disconnect();
    expect(received).toEqual(['soil']); expect(channel.getStatus()).toBe('disconnected');
  });
});
