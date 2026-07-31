import { parseAiInferenceResponse } from './validation';

const validResponse = {
  schemaVersion: 1,
  requestId: 'request-1',
  provider: 'edge-gateway',
  status: 'succeeded',
  detections: [{
    label: 'leaf-spot',
    confidence: 0.91,
    boundingBox: { x: 10, y: 20, width: 30, height: 40 },
  }],
  completedAt: '2026-07-31T00:00:00.000Z',
};

describe('AI inference response validation', () => {
  it('accepts a valid response', () => {
    expect(parseAiInferenceResponse(validResponse)).toEqual(validResponse);
  });

  it.each([
    ['schema version', { ...validResponse, schemaVersion: 2 }],
    ['confidence', { ...validResponse, detections: [{ label: 'leaf-spot', confidence: 1.1 }] }],
    ['bounding box', { ...validResponse, detections: [{ label: 'leaf-spot', confidence: 0.9, boundingBox: { x: 0, y: 0, width: 0, height: 20 } }] }],
    ['JSON shape', 'not-an-object'],
  ])('rejects an invalid %s', (_name, payload) => {
    expect(parseAiInferenceResponse(payload)).toBeNull();
  });

  it('accepts an explicit failed response', () => {
    expect(parseAiInferenceResponse({
      ...validResponse,
      status: 'failed',
      detections: [],
      error: 'model unavailable',
    })?.status).toBe('failed');
  });
});
