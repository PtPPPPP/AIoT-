import {
  AiDetection,
  AiInferenceResponse,
  aiInferenceSchemaVersion,
} from './contracts';

const responseStatuses: AiInferenceResponse['status'][] = ['succeeded', 'failed', 'rejected'];

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validTimestamp(value: unknown): value is string {
  return nonEmptyText(value) && Number.isFinite(Date.parse(value));
}

function responseStatus(value: unknown): value is AiInferenceResponse['status'] {
  return typeof value === 'string' && responseStatuses.includes(value as AiInferenceResponse['status']);
}

function parseBoundingBox(value: unknown): AiDetection['boundingBox'] | null {
  const item = record(value);
  if (!item) return null;
  const values = [item.x, item.y, item.width, item.height];
  if (!values.every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0)) {
    return null;
  }
  if (item.width === 0 || item.height === 0) return null;
  return {
    x: item.x as number,
    y: item.y as number,
    width: item.width as number,
    height: item.height as number,
  };
}

function parseDetection(value: unknown): AiDetection | null {
  const item = record(value);
  if (!item || !nonEmptyText(item.label)) return null;
  if (typeof item.confidence !== 'number' || !Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1) {
    return null;
  }
  const boundingBox = item.boundingBox === undefined ? undefined : parseBoundingBox(item.boundingBox);
  if (item.boundingBox !== undefined && !boundingBox) return null;
  return {
    label: item.label,
    confidence: item.confidence,
    ...(boundingBox ? { boundingBox } : {}),
  };
}

export function parseAiInferenceResponse(value: unknown): AiInferenceResponse | null {
  const item = record(value);
  if (
    !item
    || item.schemaVersion !== aiInferenceSchemaVersion
    || !nonEmptyText(item.requestId)
    || !nonEmptyText(item.provider)
    || !responseStatus(item.status)
    || !Array.isArray(item.detections)
  ) {
    return null;
  }
  const detections = item.detections.map(parseDetection);
  if (detections.some((detection) => detection === null)) return null;
  if (item.completedAt !== undefined && !validTimestamp(item.completedAt)) return null;
  if (item.error !== undefined && !nonEmptyText(item.error)) return null;
  if (item.status === 'succeeded' && item.error !== undefined) return null;
  if (item.status !== 'succeeded' && !nonEmptyText(item.error)) return null;
  return {
    schemaVersion: aiInferenceSchemaVersion,
    requestId: item.requestId,
    provider: item.provider,
    status: item.status,
    detections: detections as AiDetection[],
    ...(item.completedAt ? { completedAt: item.completedAt as string } : {}),
    ...(item.error ? { error: item.error as string } : {}),
  };
}
