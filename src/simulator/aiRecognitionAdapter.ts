import { DemoScenarioId, RecognitionAdapter, RecognitionResult } from '../types';

const maxImageBytes = 5 * 1024 * 1024;
const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export type ImageDecoder = (file: File) => Promise<void>;

const defaultDecoder: ImageDecoder = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    resolve();
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('图片无法解码，请更换有效的 JPG、PNG、WebP 或 GIF 图片。'));
  };
  image.src = url;
});

function fingerprint(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let hash = 2_166_136_261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function readFileBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => reader.result instanceof ArrayBuffer
      ? resolve(reader.result)
      : reject(new Error('图片读取失败。'));
    reader.onerror = () => reject(new Error('图片读取失败。'));
    reader.readAsArrayBuffer(file);
  });
}

const scenarioResults: Record<DemoScenarioId, Omit<RecognitionResult, 'mode' | 'confidence' | 'processingTimeMs' | 'contentFingerprint'>> = {
  healthy: {
    label: '健康叶片演示场景',
    severity: 'info',
    description: '此结果由人工选定的演示场景产生，仅用于展示后续建议和系统流程。',
    recommendations: ['维持当前通风和灌溉策略', '继续记录叶片变化', '真实生产中应由模型和人工复核'],
  },
  'early-risk': {
    label: '早期病斑演示场景',
    severity: 'warning',
    description: '此结果由人工选定的演示场景产生，用于演示风险报警和处理建议。',
    recommendations: ['人工复核叶片正反面', '降低叶面连续潮湿时间', '增加通风并记录扩散情况'],
  },
  'severe-risk': {
    label: '严重病害演示场景',
    severity: 'critical',
    description: '此结果由人工选定的演示场景产生，用于展示高风险处置流程。',
    recommendations: ['立即隔离并标记可疑植株', '由专业人员确认病因', '复核环境、通风和灌溉记录'],
  },
};

export class DemoRecognitionAdapter implements RecognitionAdapter {
  constructor(private readonly decodeImage: ImageDecoder = defaultDecoder) {}

  async recognize(file: File, scenario: DemoScenarioId): Promise<RecognitionResult> {
    const startedAt = performance.now();
    if (!acceptedImageTypes.has(file.type)) {
      throw new Error('仅支持 JPG、PNG、WebP 或 GIF 图片，非图片文件已拒绝。');
    }
    if (file.size === 0) throw new Error('图片文件为空，无法进行演示识别。');
    if (file.size > maxImageBytes) throw new Error('图片超过 5 MB，请压缩后重试。');

    await this.decodeImage(file);
    const contentFingerprint = fingerprint(await readFileBuffer(file));
    return {
      mode: 'demo',
      confidence: null,
      processingTimeMs: Math.max(1, Math.round(performance.now() - startedAt)),
      contentFingerprint,
      ...scenarioResults[scenario],
    };
  }
}

export class RemoteRecognitionAdapter implements RecognitionAdapter {
  async recognize(file: File, scenario: DemoScenarioId): Promise<RecognitionResult> {
    void file;
    void scenario;
    throw new Error('远程推理接口尚未配置，当前项目未运行真实 YOLO 或 YieldNet 模型。');
  }
}
