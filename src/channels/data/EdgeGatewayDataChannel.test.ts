import { EdgeGatewayDataChannel } from './EdgeGatewayDataChannel';

const config = { mode: 'external' as const, edgeApiBaseUrl: 'http://gateway.local', dataTransport: 'http-polling' as const, pollIntervalMs: 60_000, requestTimeoutMs: 3000, staleAfterMs: 5000, warnings: [] };
const packet = { schemaVersion: 1, eventId: 'evt-1', sequence: 1, source: 'gateway', gatewayId: 'gw', deviceId: 'wise', channelId: 'AI0', sensorId: 'soil', key: 'soilMoisture', value: 35, unit: '%', capturedAt: '2026-01-01T10:00:00.000Z', receivedAt: '2026-01-01T10:00:01.000Z', quality: 'good', valid: true };
describe('edge gateway data channel', () => {
  afterEach(() => vi.useRealTimers());
  it('validates and publishes polled packets, then disconnects cleanly', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([packet]), { status: 200 }));
    const channel = new EdgeGatewayDataChannel(config, fetcher);
    const received: string[] = []; const unsubscribe = channel.subscribe((item) => received.push(item.sensorId));
    await channel.connect(); unsubscribe(); await channel.disconnect();
    expect(received).toEqual(['soil']); expect(channel.getStatus()).toBe('disconnected');
  });
  it('repeated old good packets expire based on capture time, with mixed origins preserved', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(packet.capturedAt));
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => new Response(JSON.stringify(String(url).endsWith('/actuators') ? [] : [{ ...packet, sourceKind: 'simulation' }])));
    const channel = new EdgeGatewayDataChannel({ ...config, pollIntervalMs: 1000 }, fetcher);
    const received: Array<{ quality: string; sourceKind?: string }> = [];
    channel.subscribe(item => received.push(item));
    await channel.connect();
    expect(received[0]).toMatchObject({ quality: 'good', sourceKind: 'simulation' });
    await vi.advanceTimersByTimeAsync(6000);
    expect(received[received.length - 1].quality).toBe('stale');
    expect(channel.getStatus()).toBe('stale');
    await channel.disconnect();
  });
  it('network failures still expire individual cached data and do not manufacture an offline actuator state', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(packet.capturedAt));
    let fail = false;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => {
      if (fail) throw new Error('network');
      return new Response(JSON.stringify(String(url).endsWith('/actuators') ? [{ logicalDevice: 'fan', actual: true, online: true, updatedAt: packet.capturedAt, feedbackLevel: 'output' }] : [packet]));
    });
    const channel = new EdgeGatewayDataChannel({ ...config, pollIntervalMs: 1000 }, fetcher);
    const quality: string[] = []; const snapshots: boolean[] = [];
    channel.subscribe(item => quality.push(item.quality));
    channel.subscribeActuators(items => snapshots.push(items[0].actual!));
    await channel.connect(); fail = true;
    await vi.advanceTimersByTimeAsync(6000);
    expect(quality).toContain('stale');
    expect(snapshots).toEqual([true]);
    expect(channel.getStatus()).toBe('failed');
    await channel.disconnect();
  });
  it('only issues GET requests, validates partial actuator feedback, and does not create a control channel', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => new Response(JSON.stringify(String(url).endsWith('/actuators') ? [{ logicalDevice: 'fan', online: false, updatedAt: new Date().toISOString() }] : [])));
    const channel = new EdgeGatewayDataChannel(config, fetcher);
    const received: string[] = []; channel.subscribeActuators(items => received.push(items[0].logicalDevice));
    await channel.connect(); await channel.disconnect();
    expect(received).toEqual(['fan']);
    expect(fetcher.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
  });
});
