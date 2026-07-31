import { EdgeNodeConfig, effectiveAiProvider } from '../../config/edgeNodeConfig';
import { DemoRecognitionAdapter } from '../../simulator/aiRecognitionAdapter';
import {
  DemoScenarioId,
  RecognitionAdapter,
  RecognitionResult,
} from '../../types';
import {
  AiInferenceRequest,
  aiInferenceSchemaVersion,
} from './contracts';
import { parseAiInferenceResponse } from './validation';

export interface AiInferenceChannel extends RecognitionAdapter {
  readonly source: 'simulation' | 'edge-gateway' | 'disabled';
  readonly sourceLabel: string;
}

export class SimulationAiInferenceChannel implements AiInferenceChannel {
  readonly source = 'simulation' as const;
  readonly sourceLabel = '模拟推理';

  constructor(private readonly adapter: RecognitionAdapter = new DemoRecognitionAdapter()) {}

  recognize(file: File, scenario: DemoScenarioId) {
    return this.adapter.recognize(file, scenario);
  }
}

type EncodedImage = { dataUrl: string; fingerprint: string };
type ImageEncoder = (file: File) => Promise<EncodedImage>;

function fingerprint(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let hash = 2_166_136_261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function encodeImage(file: File): Promise<EncodedImage> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return {
    dataUrl: `data:${file.type};base64,${btoa(binary)}`,
    fingerprint: fingerprint(buffer),
  };
}

export class EdgeGatewayAiInferenceChannel implements AiInferenceChannel {
  readonly source = 'edge-gateway' as const;
  readonly sourceLabel = '边缘网关';

  constructor(
    private readonly baseUrl: string,
    private readonly requestTimeoutMs: number,
    private readonly fetcher: typeof fetch = fetch,
    private readonly imageEncoder: ImageEncoder = encodeImage,
    private readonly createRequestId: () => string = () => crypto.randomUUID(),
  ) {}

  async recognize(file: File, scenario: DemoScenarioId): Promise<RecognitionResult> {
    void scenario;
    const startedAt = performance.now();
    if (!file.type.startsWith('image/') || file.size === 0) {
      throw new Error('边缘 AI 推理只接受非空图片。');
    }
    const encoded = await this.imageEncoder(file);
    const requestId = this.createRequestId();
    const request: AiInferenceRequest = {
      schemaVersion: aiInferenceSchemaVersion,
      requestId,
      image: encoded.dataUrl,
      capturedAt: new Date().toISOString(),
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await this.fetcher(`${this.baseUrl}/api/v1/ai/infer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`AI 推理网关返回 HTTP ${response.status}`);
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error('AI 推理响应不是有效 JSON。');
      }
      const result = parseAiInferenceResponse(payload);
      if (!result || result.requestId !== requestId) throw new Error('AI 推理响应格式无效或 requestId 不匹配。');
      if (result.status !== 'succeeded') throw new Error(result.error ?? 'AI 推理未成功。');
      const primary = [...result.detections].sort((left, right) => right.confidence - left.confidence)[0];
      return {
        mode: 'remote',
        label: primary?.label ?? '未检测到目标',
        confidence: primary?.confidence ?? null,
        severity: 'info',
        description: primary
          ? `结果来自已配置的边缘网关推理服务，共返回 ${result.detections.length} 个检测项。`
          : '已配置的边缘网关推理服务未返回检测项。',
        recommendations: ['AI 结果仅用于识别、报警和建议', '控制动作仍由确定性规则和人工确认决定'],
        processingTimeMs: Math.max(1, Math.round(performance.now() - startedAt)),
        contentFingerprint: encoded.fingerprint,
      };
    } catch (error) {
      if (controller.signal.aborted) throw new Error('AI 推理请求超时。');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class DisabledAiInferenceChannel implements AiInferenceChannel {
  readonly source = 'disabled' as const;
  readonly sourceLabel = '未启用';

  constructor(private readonly reason = 'AI 推理服务未配置') {}

  async recognize(): Promise<RecognitionResult> {
    throw new Error(this.reason);
  }
}

export function createAiInferenceChannel(
  runtimeMode: 'simulation' | 'external' | 'playback',
  runtimeRequestTimeoutMs: number,
  config: EdgeNodeConfig,
): AiInferenceChannel {
  const provider = effectiveAiProvider(runtimeMode, config);
  if (provider === 'simulation') {
    return new SimulationAiInferenceChannel();
  }
  if (provider === 'disabled') {
    if (config.aiProvider === 'edge-gateway' && !config.gatewayBaseUrl) {
      return new DisabledAiInferenceChannel('AI 推理服务未配置：缺少边缘网关地址');
    }
    return new DisabledAiInferenceChannel('AI 推理服务未配置');
  }
  if (!config.gatewayBaseUrl) return new DisabledAiInferenceChannel('AI 推理服务未配置');
  return new EdgeGatewayAiInferenceChannel(config.gatewayBaseUrl, runtimeRequestTimeoutMs);
}
