import { createEdgeNodeConfig } from './edgeNodeConfig';

describe('edge node config', () => {
  it('defaults to a local reference node without claiming a gateway connection', () => {
    expect(createEdgeNodeConfig({})).toMatchObject({
      type: 'local-pc',
      displayName: '本地 Windows 边缘节点',
      gatewayBaseUrl: undefined,
      aiInferenceEnabled: false,
      aiProvider: 'simulation',
    });
  });

  it('uses unconfigured for an invalid node type', () => {
    const config = createEdgeNodeConfig({ VITE_EDGE_NODE_TYPE: 'mic-board' });
    expect(config.type).toBe('unconfigured');
    expect(config.warnings).toContain('VITE_EDGE_NODE_TYPE 无效，已使用 unconfigured。');
  });

  it('keeps node type independent from gateway configuration', () => {
    const config = createEdgeNodeConfig({ VITE_EDGE_NODE_TYPE: 'local-pc' });
    expect(config.type).toBe('local-pc');
    expect(config.gatewayBaseUrl).toBeUndefined();
  });

  it('accepts an explicit edge gateway AI provider', () => {
    const config = createEdgeNodeConfig({
      VITE_EDGE_API_BASE_URL: 'http://127.0.0.1:8080/',
      VITE_EDGE_AI_PROVIDER: 'edge-gateway',
      VITE_EDGE_AI_ENABLED: 'true',
    });
    expect(config).toMatchObject({
      gatewayBaseUrl: 'http://127.0.0.1:8080',
      aiProvider: 'edge-gateway',
      aiInferenceEnabled: true,
    });
  });

  it('uses safe values for invalid AI configuration', () => {
    const config = createEdgeNodeConfig({
      VITE_EDGE_API_BASE_URL: 'file:///device',
      VITE_EDGE_AI_PROVIDER: 'unknown',
      VITE_EDGE_AI_ENABLED: 'yes',
    });
    expect(config).toMatchObject({
      gatewayBaseUrl: undefined,
      aiProvider: 'disabled',
      aiInferenceEnabled: false,
    });
    expect(config.warnings).toHaveLength(2);
  });
});
