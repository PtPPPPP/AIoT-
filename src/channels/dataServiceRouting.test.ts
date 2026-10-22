import { createRuntimeConfig } from '../config/runtimeConfig';
import { createRuntimeChannels } from './createRuntimeChannels';
import { createEdgeNodeConfig } from '../config/edgeNodeConfig';
import { EdgeGatewayDataChannel } from './data/EdgeGatewayDataChannel';

afterEach(() => vi.unstubAllGlobals());
it('configured data service receives all telemetry reads while original control gateway stays separate', async () => {
  const urls: string[] = [];
  vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
    urls.push(url);
    if (url.endsWith('/health')) return new Response(JSON.stringify({ schemaVersion: 1, status: 'ok' }));
    if (url.endsWith('/actuators')) return new Response('[]');
    const command = JSON.parse(options!.body as string) as { commandId: string; idempotencyKey: string; target: boolean };
    return new Response(JSON.stringify({ schemaVersion: 1, ...command, status: 'acknowledged' }));
  });
  const config = createRuntimeConfig({ VITE_RUNTIME_MODE: 'external', VITE_EDGE_API_BASE_URL: 'http://control-mock.invalid', VITE_DATA_SERVICE_URL: 'http://history-mock.invalid' });
  const channels = createRuntimeChannels(config, createEdgeNodeConfig({ VITE_EDGE_AI_PROVIDER: 'disabled' }));
  expect(channels.dataChannel).toBeInstanceOf(EdgeGatewayDataChannel);
  await (channels.dataChannel as EdgeGatewayDataChannel).synchronizeInitialState();
  await channels.controlChannel.execute({ id: 'mock', idempotencyKey: 'mock', device: 'fan', target: false, source: 'manual', createdAt: new Date().toISOString(), timeoutAt: new Date().toISOString(), scenario: 'normal' });
  expect(urls).toEqual(['http://history-mock.invalid/api/v1/health', 'http://history-mock.invalid/api/v1/actuators', 'http://control-mock.invalid/api/v1/control/commands']);
});
