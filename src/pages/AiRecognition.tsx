import { useEffect, useState } from 'react';
import type React from 'react';
import { BrainCircuit, CheckCircle2, Loader2, Upload } from '../components/Icons';
import { Badge } from '../components/Status';
import { demoScenarios } from '../data/mockData';
import { DemoScenarioId, RecognitionResult } from '../types';

type AiRecognitionProps = {
  aiStage: 'idle' | 'analyzing' | 'done' | 'error';
  aiResult: RecognitionResult | null;
  aiError: string | null;
  scenario: DemoScenarioId;
  setScenario: (scenario: DemoScenarioId) => void;
  runRecognition: (file: File, scenario: DemoScenarioId) => Promise<void>;
};

const demoPngBytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='), (character) => character.charCodeAt(0));

export function AiRecognition({ aiStage, aiResult, aiError, scenario, setScenario, runRecognition }: AiRecognitionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
    const input = file ?? new File([demoPngBytes], 'demo-input.png', { type: 'image/png' });
    return runRecognition(input, scenario);
  };

  return (
    <div className="ai-layout">
      <section className="panel ai-picker">
        <div className="section-title">
          <div>
            <h2>AI 演示识别适配器</h2>
            <p>当前未运行 YOLO 或 YieldNet。结果由明确的人工演示场景生成，不根据文件名猜测病害。</p>
          </div>
          <Badge tone="warn">演示识别模式</Badge>
        </div>

        <div className="sample-grid">
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
        </div>

        <label className="upload-box">
          <Upload size={22} />
          <span>{file?.name ?? '可选：上传图片以校验文件和显示预览（最大 5 MB）'}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        {previewUrl && <img className="image-preview" src={previewUrl} alt="待校验的用户上传图片预览" />}

        <button type="button" className="primary-button" onClick={analyze} disabled={aiStage === 'analyzing'}>
          {aiStage === 'analyzing' ? '演示处理中…' : '运行演示识别'}
        </button>
      </section>

      <section className="panel">
        <div className="ai-flow">
          <FlowStep icon={<Upload size={18} />} title="校验与解码" active={aiStage !== 'idle'} />
          <FlowStep icon={aiStage === 'analyzing' ? <Loader2 className="spin" size={18} /> : <BrainCircuit size={18} />} title="演示适配器" active={aiStage === 'analyzing' || aiStage === 'done'} />
          <FlowStep icon={<CheckCircle2 size={18} />} title="生成建议" active={aiStage === 'done'} />
        </div>

        {aiStage === 'idle' && <EmptyState title="选择演示场景" text="上传图片仅用于格式校验、内容指纹和预览；场景结果不是模型判断。" />}
        {aiStage === 'analyzing' && <EmptyState loading title="演示处理中" text="正在校验图片、生成稳定指纹并运行所选演示场景。" />}
        {aiStage === 'error' && <div className="empty-state error-state" role="alert"><h3>识别输入无效</h3><p>{aiError}</p></div>}

        {aiResult && (
          <div className="ai-result">
            <div className="result-score">
              <span>演示</span>
              <small>置信度：不提供</small>
            </div>
            <div className="result-detail">
              <h3>{aiResult.label}</h3>
              <p>{aiResult.description}</p>
              <div className="result-tags">
                <Badge tone={aiResult.severity === 'critical' ? 'danger' : aiResult.severity === 'warning' ? 'warn' : 'good'}>{aiResult.severity}</Badge>
                <Badge tone="blue">{aiResult.mode === 'demo' ? '演示适配器' : '远程推理'}</Badge>
              </div>
              <strong>演示处理建议</strong>
              <ul>{aiResult.recommendations.map((item) => <li key={item}>{item}</li>)}</ul>
              <p className="result-meta">文件指纹 {aiResult.contentFingerprint} · 本地处理 {aiResult.processingTimeMs} ms</p>
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
