export type EdgeNodeType =
  | 'local-pc'
  | 'industrial-pc'
  | 'jetson'
  | 'remote-server'
  | 'unconfigured';

export type AiInferenceProvider = 'simulation' | 'edge-gateway' | 'disabled';

export type EdgeNodeConfig = {
  type: EdgeNodeType;
  displayName: string;
  gatewayBaseUrl?: string;
  aiInferenceEnabled: boolean;
  aiProvider: AiInferenceProvider;
  description?: string;
  warnings: string[];
};

export type EdgeNodeEnv = {
  VITE_EDGE_NODE_TYPE?: string;
  VITE_EDGE_NODE_NAME?: string;
  VITE_EDGE_API_BASE_URL?: string;
  VITE_EDGE_AI_PROVIDER?: string;
  VITE_EDGE_AI_ENABLED?: string;
};

const edgeNodeTypes: EdgeNodeType[] = [
  'local-pc',
  'industrial-pc',
  'jetson',
  'remote-server',
  'unconfigured',
];
const aiProviders: AiInferenceProvider[] = ['simulation', 'edge-gateway', 'disabled'];
const defaultNames: Record<EdgeNodeType, string> = {
  'local-pc': '本地 Windows 边缘节点',
  'industrial-pc': '工业计算机边缘节点',
  jetson: 'Jetson 边缘节点',
  'remote-server': '远程服务器节点',
  unconfigured: '边缘计算节点未配置',
};

function readGatewayUrl(value: string | undefined, warnings: string[]) {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    return url.toString().replace(/\/$/, '');
  } catch {
    warnings.push('VITE_EDGE_API_BASE_URL 不是合法的 HTTP(S) URL，已忽略。');
    return undefined;
  }
}

function readEnabled(value: string | undefined, warnings: string[]) {
  if (value === undefined || value === '') return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  warnings.push('VITE_EDGE_AI_ENABLED 无效，已安全关闭 AI 推理。');
  return false;
}

export function createEdgeNodeConfig(env: EdgeNodeEnv = import.meta.env): EdgeNodeConfig {
  const warnings: string[] = [];
  const requestedType = env.VITE_EDGE_NODE_TYPE;
  const type = requestedType === undefined
    ? 'local-pc'
    : edgeNodeTypes.includes(requestedType as EdgeNodeType)
      ? requestedType as EdgeNodeType
      : 'unconfigured';
  if (requestedType !== undefined && type === 'unconfigured' && requestedType !== 'unconfigured') {
    warnings.push('VITE_EDGE_NODE_TYPE 无效，已使用 unconfigured。');
  }

  const requestedProvider = env.VITE_EDGE_AI_PROVIDER;
  const aiProvider = requestedProvider === undefined
    ? 'simulation'
    : aiProviders.includes(requestedProvider as AiInferenceProvider)
      ? requestedProvider as AiInferenceProvider
      : 'disabled';
  if (requestedProvider !== undefined && aiProvider === 'disabled' && requestedProvider !== 'disabled') {
    warnings.push('VITE_EDGE_AI_PROVIDER 无效，已安全关闭 AI 推理。');
  }

  const displayName = env.VITE_EDGE_NODE_NAME?.trim() || defaultNames[type];
  const gatewayBaseUrl = readGatewayUrl(env.VITE_EDGE_API_BASE_URL, warnings);
  const aiInferenceEnabled = aiProvider !== 'disabled' && readEnabled(env.VITE_EDGE_AI_ENABLED, warnings);

  return {
    type,
    displayName,
    gatewayBaseUrl,
    aiInferenceEnabled,
    aiProvider,
    description: type === 'local-pc'
      ? '当前原型阶段的参考边缘计算节点，可替换为其他兼容平台。'
      : undefined,
    warnings,
  };
}

export function edgeNodeTypeLabel(type: EdgeNodeType) {
  const labels: Record<EdgeNodeType, string> = {
    'local-pc': '本地计算机',
    'industrial-pc': '工业计算机',
    jetson: 'Jetson',
    'remote-server': '远程服务器',
    unconfigured: '未配置',
  };
  return labels[type];
}

export function aiProviderLabel(provider: AiInferenceProvider) {
  const labels: Record<AiInferenceProvider, string> = {
    simulation: '模拟推理',
    'edge-gateway': '边缘网关',
    disabled: '未启用',
  };
  return labels[provider];
}

export function effectiveAiProvider(
  runtimeMode: 'simulation' | 'external' | 'playback',
  config: EdgeNodeConfig,
): AiInferenceProvider {
  if (runtimeMode !== 'external') return 'simulation';
  if (!config.aiInferenceEnabled || config.aiProvider === 'disabled') return 'disabled';
  if (config.aiProvider === 'edge-gateway' && !config.gatewayBaseUrl) return 'disabled';
  return config.aiProvider;
}

export const edgeNodeConfig = createEdgeNodeConfig();
