import { createRuntimeChannels } from './createRuntimeChannels';

describe('runtime channel factory', () => {
  it('creates simulation channels by default', () => expect(createRuntimeChannels({ mode: 'simulation', dataTransport: 'http-polling', pollIntervalMs: 1000, requestTimeoutMs: 3000, staleAfterMs: 5000, warnings: [] }).dataSourceLabel).toBe('本地模拟器'));
  it('keeps runtime mode independent from edge node type', () => {
    const channels = createRuntimeChannels(
      { mode: 'simulation', dataTransport: 'http-polling', pollIntervalMs: 1000, requestTimeoutMs: 3000, staleAfterMs: 5000, warnings: [] },
      { type: 'industrial-pc', displayName: '测试工业计算机', aiInferenceEnabled: false, aiProvider: 'disabled', warnings: [] },
    );
    expect(channels.mode).toBe('simulation');
    expect(channels.edgeNode.type).toBe('industrial-pc');
    expect(channels.aiInferenceChannel.source).toBe('simulation');
  });
  it('marks an external channel without URL as unconfigured', async () => {
    const channels = createRuntimeChannels({ mode: 'external', dataTransport: 'http-polling', pollIntervalMs: 1000, requestTimeoutMs: 3000, staleAfterMs: 5000, warnings: [] });
    await channels.dataChannel.connect();
    expect(channels.dataChannel.getStatus()).toBe('unconfigured');
  });
  it('does not enable edge AI when external mode lacks a gateway URL', () => {
    const channels = createRuntimeChannels(
      { mode: 'external', dataTransport: 'http-polling', pollIntervalMs: 1000, requestTimeoutMs: 3000, staleAfterMs: 5000, warnings: [] },
      { type: 'local-pc', displayName: '本地节点', aiInferenceEnabled: true, aiProvider: 'edge-gateway', warnings: [] },
    );
    expect(channels.aiInferenceChannel.source).toBe('disabled');
  });
  it('does not enable simulation AI in external mode unless explicitly enabled', () => {
    const channels = createRuntimeChannels(
      { mode: 'external', dataTransport: 'http-polling', pollIntervalMs: 1000, requestTimeoutMs: 3000, staleAfterMs: 5000, warnings: [] },
      { type: 'local-pc', displayName: '本地节点', aiInferenceEnabled: false, aiProvider: 'simulation', warnings: [] },
    );
    expect(channels.aiInferenceChannel.source).toBe('disabled');
  });
});
