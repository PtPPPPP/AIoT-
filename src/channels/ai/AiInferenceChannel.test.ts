import { EdgeGatewayAiInferenceChannel } from './AiInferenceChannel';

const encodedImage = async () => ({ dataUrl: 'data:image/png;base64,AA==', fingerprint: '1234abcd' });

describe('edge gateway AI inference channel', () => {
  it('maps a validated response without controlling devices', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      schemaVersion: 1,
      requestId: 'request-1',
      provider: 'edge-gateway',
      status: 'succeeded',
      detections: [{ label: '早期叶斑', confidence: 0.88 }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const channel = new EdgeGatewayAiInferenceChannel(
      'http://127.0.0.1:8080',
      3_000,
      fetcher,
      encodedImage,
      () => 'request-1',
    );
    const result = await channel.recognize(new File(['image'], 'leaf.png', { type: 'image/png' }), 'healthy');
    expect(result).toMatchObject({ mode: 'remote', label: '早期叶斑', confidence: 0.88 });
    expect(result.recommendations).toContain('控制动作仍由确定性规则和人工确认决定');
    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/api/v1/ai/infer',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rejects a mismatched request id', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      schemaVersion: 1,
      requestId: 'other-request',
      provider: 'edge-gateway',
      status: 'succeeded',
      detections: [],
    })));
    const channel = new EdgeGatewayAiInferenceChannel(
      'http://127.0.0.1:8080',
      3_000,
      fetcher,
      encodedImage,
      () => 'request-1',
    );
    await expect(channel.recognize(new File(['image'], 'leaf.png', { type: 'image/png' }), 'healthy')).rejects.toThrow('requestId');
  });

  it('reports a failed inference response', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      schemaVersion: 1,
      requestId: 'request-1',
      provider: 'edge-gateway',
      status: 'failed',
      detections: [],
      error: 'model unavailable',
    })));
    const channel = new EdgeGatewayAiInferenceChannel(
      'http://127.0.0.1:8080',
      3_000,
      fetcher,
      encodedImage,
      () => 'request-1',
    );
    await expect(channel.recognize(new File(['image'], 'leaf.png', { type: 'image/png' }), 'healthy')).rejects.toThrow('model unavailable');
  });

  it('rejects invalid JSON from the gateway', async () => {
    const fetcher = vi.fn(async () => new Response('{invalid'));
    const channel = new EdgeGatewayAiInferenceChannel(
      'http://127.0.0.1:8080',
      3_000,
      fetcher,
      encodedImage,
      () => 'request-1',
    );
    await expect(channel.recognize(new File(['image'], 'leaf.png', { type: 'image/png' }), 'healthy')).rejects.toThrow('不是有效 JSON');
  });
});
