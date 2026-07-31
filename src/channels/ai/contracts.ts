export const aiInferenceSchemaVersion = 1 as const;

export type AiInferenceRequest = {
  schemaVersion: 1;
  requestId: string;
  image?: string;
  imageReference?: string;
  capturedAt: string;
};

export type AiDetection = {
  label: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type AiInferenceResponse = {
  schemaVersion: 1;
  requestId: string;
  provider: string;
  status: 'succeeded' | 'failed' | 'rejected';
  detections: AiDetection[];
  completedAt?: string;
  error?: string;
};
