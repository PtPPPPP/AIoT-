import { render, screen } from '@testing-library/react';
import { AiRecognition } from './AiRecognition';

describe('AI recognition page', () => {
  it('always labels the current adapter as demo mode', () => {
    render(
      <AiRecognition
        aiStage="idle"
        aiResult={null}
        aiError={null}
        scenario="healthy"
        runtime={{
          mode: 'simulation',
          edgeNodeType: 'local-pc',
          edgeNodeName: '本地 Windows 边缘节点',
          dataChannelStatus: 'connected',
          controlChannelStatus: 'connected',
          dataSourceLabel: '本地模拟器',
          controlSourceLabel: '模拟设备通道',
          aiProvider: 'simulation',
          aiSourceLabel: '模拟推理',
          externalInitialSyncStatus: 'ready',
          controlArmed: true,
        }}
        setScenario={() => undefined}
        runRecognition={async () => undefined}
      />,
    );
    expect(screen.getAllByText('模拟推理')).toHaveLength(2);
    expect(screen.getByText(/当前使用离线模拟推理/)).toBeDefined();
  });

  it('shows an honest unconfigured state for disabled external AI', () => {
    render(
      <AiRecognition
        aiStage="idle"
        aiResult={null}
        aiError={null}
        scenario="healthy"
        runtime={{
          mode: 'external',
          edgeNodeType: 'local-pc',
          edgeNodeName: '本地 Windows 边缘节点',
          dataChannelStatus: 'unconfigured',
          controlChannelStatus: 'unconfigured',
          dataSourceLabel: '边缘网关未配置',
          controlSourceLabel: '边缘网关未配置',
          aiProvider: 'disabled',
          aiSourceLabel: '未启用',
          externalInitialSyncStatus: 'idle',
          controlArmed: false,
        }}
        setScenario={() => undefined}
        runRecognition={async () => undefined}
      />,
    );
    expect(screen.getAllByText('AI 推理服务未配置')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'AI 推理服务未配置' }).hasAttribute('disabled')).toBe(true);
  });
});
