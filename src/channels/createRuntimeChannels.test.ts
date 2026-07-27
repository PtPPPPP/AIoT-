import { createRuntimeChannels } from './createRuntimeChannels';

describe('runtime channel factory', () => {
  it('creates simulation channels by default', () => expect(createRuntimeChannels({ mode: 'simulation', dataTransport: 'http-polling', pollIntervalMs: 1000, requestTimeoutMs: 3000, staleAfterMs: 5000, warnings: [] }).dataSourceLabel).toBe('本地模拟器'));
  it('marks an external channel without URL as unconfigured', async () => {
    const channels = createRuntimeChannels({ mode: 'external', dataTransport: 'http-polling', pollIntervalMs: 1000, requestTimeoutMs: 3000, staleAfterMs: 5000, warnings: [] });
    await channels.dataChannel.connect();
    expect(channels.dataChannel.getStatus()).toBe('unconfigured');
  });
});
