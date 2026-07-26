import { presentationScenarios } from '../simulator/presentationScenarios';
import { PresentationState } from '../types';
import { Badge } from './Status';

type PresentationConsoleProps = {
  presentation: PresentationState;
  onSelectScenario: (id: PresentationState['scenarioId']) => void;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
  onReset: () => void;
  onRegenerateSeed: () => void;
  onCopySeed: () => Promise<void>;
  onExportSnapshot?: () => void;
  onImportSnapshot?: (file: File) => Promise<void>;
  onExportOperationLog?: () => void;
  onDebateReset?: () => void;
  isDebateResetting?: boolean;
};

export function PresentationConsole({
  presentation,
  onSelectScenario,
  onPause,
  onResume,
  onStep,
  onReset,
  onRegenerateSeed,
  onCopySeed,
  onExportSnapshot,
  onImportSnapshot,
  onExportOperationLog,
  onDebateReset,
  isDebateResetting = false,
}: PresentationConsoleProps) {
  const current = presentationScenarios.find((scenario) => scenario.id === presentation.scenarioId)!;
  const faultLabel = presentation.fault === 'none'
    ? '无故障注入'
    : presentation.fault === 'soil-sensor-offline' ? '土壤传感器离线注入' : '水泵离线故障注入';

  return (
    <section className="panel presentation-console" aria-label="答辩场景控制台">
      <div className="section-title">
        <div>
          <h2>答辩场景控制台</h2>
          <p>场景数据由模拟器统一生成；手动控制仍在“智能控制”页面执行，故障注入由当前场景集中管理。</p>
        </div>
        <Badge tone={presentation.runStatus === 'running' ? 'good' : 'warn'}>{presentation.runStatus === 'running' ? '模拟运行中' : '模拟已暂停'}</Badge>
      </div>

      <div className="presentation-summary">
        <div><span>当前场景</span><strong>{current.name}</strong></div>
        <div><span>当前阶段</span><strong>{presentation.stage}</strong></div>
        <div><span>模拟步数</span><strong>{presentation.step}</strong></div>
        <div><span>故障注入</span><strong>{faultLabel}</strong></div>
      </div>

      <div className="scenario-buttons" aria-label="预设答辩场景">
        {presentationScenarios.map((scenario) => (
          <button
            type="button"
            key={scenario.id}
            className={`scenario-button ${presentation.scenarioId === scenario.id ? 'active' : ''}`}
            disabled={isDebateResetting || presentation.scenarioId === scenario.id}
            onClick={() => onSelectScenario(scenario.id)}
          >
            <strong>{scenario.name}</strong>
            <small>{scenario.description}</small>
          </button>
        ))}
      </div>

      <div className="presentation-actions">
        <button type="button" className="text-button" onClick={onPause} disabled={isDebateResetting || presentation.runStatus === 'paused'}>暂停模拟</button>
        <button type="button" className="text-button" onClick={onResume} disabled={isDebateResetting || presentation.runStatus === 'running'}>继续模拟</button>
        <button type="button" className="text-button" onClick={onStep} disabled={isDebateResetting}>单步推进</button>
        <button type="button" className="text-button" onClick={onReset} disabled={isDebateResetting}>重置当前场景</button>
        <button type="button" className="reset-button debate-reset" onClick={onDebateReset} disabled={!onDebateReset || isDebateResetting}>{isDebateResetting ? '正在复位…' : '答辩复位'}</button>
      </div>

      <div className="seed-control">
        <span>随机种子</span>
        <code>{presentation.seed}</code>
        <button type="button" className="text-button" onClick={() => void onCopySeed()}>复制种子</button>
        <button type="button" className="text-button" onClick={onRegenerateSeed}>生成新种子</button>
      </div>
      <div className="presentation-actions">
        <button type="button" className="text-button" onClick={onExportSnapshot} disabled={!onExportSnapshot}>导出演示快照</button>
        <label className="text-button">导入演示快照<input aria-label="导入演示快照" type="file" accept="application/json,.json" hidden disabled={!onImportSnapshot} onChange={(event) => { const file = event.target.files?.[0]; if (file && onImportSnapshot) void onImportSnapshot(file); event.currentTarget.value = ''; }} /></label>
        <button type="button" className="text-button" onClick={onExportOperationLog} disabled={!onExportOperationLog}>导出操作记录</button>
      </div>
    </section>
  );
}
