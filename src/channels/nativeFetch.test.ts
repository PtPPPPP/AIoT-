import { EdgeGatewayDataChannel } from './data/EdgeGatewayDataChannel';
import { EdgeGatewayControlChannel } from './control/EdgeGatewayControlChannel';
import { EdgeGatewayAiInferenceChannel } from './ai/AiInferenceChannel';

afterEach(() => vi.unstubAllGlobals());
it('default clients call native fetch with its global receiver, never the channel instance', async () => {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async function(this: unknown, input: string | URL | Request, options?: RequestInit) {
    expect(this).toBe(globalThis);
    const url = String(input); calls.push(url);
    if (url.endsWith('/health')) return new Response(JSON.stringify({ schemaVersion: 1, status: 'ok' }));
    if (url.endsWith('/actuators')) return new Response('[]');
    const command = JSON.parse(options?.body as string) as Record<string, unknown>;
    if (url.endsWith('/ai/infer')) return new Response(JSON.stringify({ schemaVersion: 1, provider: 'edge-gateway', requestId: command.requestId, status: 'succeeded', detections: [] }));
    return new Response(JSON.stringify({ schemaVersion: 1, commandId: command.commandId, idempotencyKey: command.idempotencyKey, target: command.target, status: 'acknowledged' }));
  });
  const config = { mode: 'external' as const, edgeApiBaseUrl: 'http://mock.invalid', dataTransport: 'http-polling' as const, pollIntervalMs: 1000, requestTimeoutMs: 3000, staleAfterMs: 5000, warnings: [] };
  await expect(new EdgeGatewayDataChannel(config).synchronizeInitialState()).resolves.toEqual([]);
  await expect(new EdgeGatewayControlChannel(config).execute({ id: 'cmd', idempotencyKey: 'key', device: 'fan', target: true, source: 'manual', createdAt: new Date().toISOString(), timeoutAt: new Date().toISOString(), scenario: 'normal' })).resolves.toMatchObject({ status: 'acknowledged', actual: undefined });
  const ai = new EdgeGatewayAiInferenceChannel(config.edgeApiBaseUrl, 3000, undefined, async () => ({ dataUrl: 'data:image/png;base64,AA==', fingerprint: 'test' }));
  const result = await ai.recognize(new File(['x'], 'leaf.png', { type: 'image/png' }), 'healthy');
  expect(result.description).toContain('不能据此判定作物健康');
  expect(calls).toHaveLength(4);
});
