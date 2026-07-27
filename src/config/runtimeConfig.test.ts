import { createRuntimeConfig } from './runtimeConfig';

describe('runtime config', () => {
  it('defaults to the offline-safe simulation mode', () => expect(createRuntimeConfig({}).mode).toBe('simulation'));
  it('keeps external mode explicitly unconfigured without an API URL', () => expect(createRuntimeConfig({ VITE_RUNTIME_MODE: 'external' }).edgeApiBaseUrl).toBeUndefined());
  it('uses safe defaults for invalid numeric values', () => {
    const config = createRuntimeConfig({ VITE_EDGE_POLL_INTERVAL_MS: '-1', VITE_EDGE_REQUEST_TIMEOUT_MS: 'NaN' });
    expect(config).toMatchObject({ pollIntervalMs: 1000, requestTimeoutMs: 3000 });
    expect(config.warnings).toHaveLength(2);
  });
});
