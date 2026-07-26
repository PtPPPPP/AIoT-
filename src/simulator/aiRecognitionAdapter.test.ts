import { DemoRecognitionAdapter } from './aiRecognitionAdapter';

describe('demo recognition adapter', () => {
  it('rejects non-image files', async () => {
    const adapter = new DemoRecognitionAdapter(async () => undefined);
    await expect(adapter.recognize(new File(['text'], 'leaf.txt', { type: 'text/plain' }), 'healthy')).rejects.toThrow('仅支持');
  });

  it('reports image decode failure', async () => {
    const adapter = new DemoRecognitionAdapter(async () => { throw new Error('图片无法解码'); });
    await expect(adapter.recognize(new File(['broken'], 'leaf.png', { type: 'image/png' }), 'healthy')).rejects.toThrow('图片无法解码');
  });

  it('is deterministic for the same image bytes and does not infer from the filename', async () => {
    const adapter = new DemoRecognitionAdapter(async () => undefined);
    const first = await adapter.recognize(new File(['same-image'], '严重病斑.png', { type: 'image/png' }), 'healthy');
    const second = await adapter.recognize(new File(['same-image'], 'healthy.png', { type: 'image/png' }), 'healthy');
    expect(first.contentFingerprint).toBe(second.contentFingerprint);
    expect(first.label).toBe('健康叶片演示场景');
    expect(second.label).toBe(first.label);
    expect(first.mode).toBe('demo');
    expect(first.confidence).toBeNull();
  });
});
