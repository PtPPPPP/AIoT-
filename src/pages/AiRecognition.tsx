import { useEffect, useState } from 'react';
import type React from 'react';
import { BrainCircuit, CheckCircle2, Loader2, Upload } from '../components/Icons';
import { Badge } from '../components/Status';
import { demoScenarios } from '../data/mockData';
import { DemoScenarioId, RecognitionResult, SimulatorState } from '../types';

type AiRecognitionProps = {
  aiStage: 'idle' | 'analyzing' | 'done' | 'error';
  aiResult: RecognitionResult | null;
  aiError: string | null;
  scenario: DemoScenarioId;
  runtime: SimulatorState['runtime'];
  setScenario: (scenario: DemoScenarioId) => void;
  runRecognition: (file: File, scenario: DemoScenarioId) => Promise<void>;
};

const demoPngBytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='), (character) => character.charCodeAt(0));

export function AiRecognition({ aiStage, aiResult, aiError, scenario, runtime, setScenario, runRecognition }: AiRecognitionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isSimulation = runtime.aiProvider === 'simulation';
  const isDisabled = runtime.aiProvider === 'disabled';

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const analyze = () => {
    if (!isSimulation && !file) return Promise.resolve();
    const input = file ?? new File([demoPngBytes], 'demo-input.png', { type: 'image/png' });
    return runRecognition(input, scenario);
  };

  return (
    <div className="ai-layout">
      <section className="panel ai-picker">
        <div className="section-title">
          <div>
            <h2>可替换 AI 推理通道</h2>
            <p>{isSimulation
              ? '当前使用离线模拟推理。结果由明确的人工演示场景生成，不根据文件名猜测病害。'
              : isDisabled
                ? 'AI 推理服务未配置；页面不会伪装生成模型结果。'
                : '当前调用项目自定义边缘网关 AI 接口；是否可用以实际响应为准。'}</p>
          </div>
          <Badge tone={isSimulation ? 'warn' : isDisabled ? 'muted' : 'blue'}>{runtime.aiSourceLabel}</Badge>
        </div>

        {isSimulation && <div className="sample-grid">
          {demoScenarios.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`sample-card ${scenario === item.id ? 'active' : ''}`}
              onClick={() => setScenario(item.id)}
            >
              <span style={{ background: item.image }} />
              <strong>{item.name}</strong>
              <small>{item.description}</small>
            </button>
          ))}
        </div>}

        <label className="upload-box">
          <Upload size={22} />
          <span>{file?.name ?? (isSimulation ? '可选：上传图片以校验文件和显示预览（最大 5 MB）' : '请选择要提交给边缘网关推理的图片')}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        {previewUrl && <img className="image-preview" src={previewUrl} alt="待校验的用户上传图片预览" />}

        <button type="button" className="primary-button" onClick={analyze} disabled={aiStage === 'analyzing' || isDisabled || (!isSimulation && !file)}>
          {aiStage === 'analyzing' ? '推理处理中…' : isSimulation ? '运行模拟识别' : isDisabled ? 'AI 推理服务未配置' : '提交边缘网关推理'}
        </button>
      </section>

      <section className="panel">
        <div className="ai-flow">
          <FlowStep icon={<Upload size={18} />} title="校验与解码" active={aiStage !== 'idle'} />
          <FlowStep icon={aiStage === 'analyzing' ? <Loader2 className="spin" size={18} /> : <BrainCircuit size={18} />} title={runtime.aiSourceLabel} active={aiStage === 'analyzing' || aiStage === 'done'} />
          <FlowStep icon={<CheckCircle2 size={18} />} title="生成建议" active={aiStage === 'done'} />
        </div>

        {aiStage === 'idle' && <EmptyState title={isSimulation ? '选择演示场景' : isDisabled ? 'AI 推理服务未配置' : '上传待识别图片'} text={isSimulation ? '上传图片仅用于格式校验、内容指纹和预览；场景结果不是模型判断。' : isDisabled ? '请显式配置边缘网关地址、提供者和启用开关后再试。' : '结果只用于识别、报警和建议，不会直接控制执行器。'} />}
        {aiStage === 'analyzing' && <EmptyState loading title="推理处理中" text={isSimulation ? '正在校验图片、生成稳定指纹并运行所选演示场景。' : '正在等待已配置的边缘网关 AI 服务返回。'} />}
        {aiStage === 'error' && <div className="empty-state error-state" role="alert"><h3>AI 推理未完成</h3><p>{aiError}</p></div>}

        {aiResult && (
          <div className="ai-result">
            <div className="result-score">
              <span>{aiResult.mode === 'demo' ? '演示' : '网关'}</span>
              <small>置信度：{aiResult.confidence === null ? '不提供' : `${Math.round(aiResult.confidence * 100)}%`}</small>
            </div>
            <div className="result-detail">
              <h3>{aiResult.label}</h3>
              <p>{aiResult.description}</p>
              <div className="result-tags">
                <Badge tone={aiResult.severity === 'critical' ? 'danger' : aiResult.severity === 'warning' ? 'warn' : 'good'}>{aiResult.severity}</Badge>
                <Badge tone="blue">{aiResult.mode === 'demo' ? '演示适配器' : '远程推理'}</Badge>
              </div>
              <strong>识别处理建议</strong>
              <ul>{aiResult.recommendations.map((item) => <li key={item}>{item}</li>)}</ul>
              <p className="result-meta">文件指纹 {aiResult.contentFingerprint} · 处理耗时 {aiResult.processingTimeMs} ms</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyState({ title, text, loading = false }: { title: string; text: string; loading?: boolean }) {
  return (
    <div className="empty-state">
      {loading ? <Loader2 className="spin" size={44} /> : <BrainCircuit size={42} />}
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function FlowStep({ icon, title, active }: { icon: React.ReactNode; title: string; active: boolean }) {
  return <div className={`flow-step ${active ? 'active' : ''}`}>{icon}<span>{title}</span></div>;
}
