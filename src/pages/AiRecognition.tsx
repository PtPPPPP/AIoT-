import { useEffect, useState } from 'react';
import type React from 'react';
import { BrainCircuit, CheckCircle2, Loader2, Upload } from '../components/Icons';
import { Badge } from '../components/Status';
import { demoScenarios } from '../data/mockData';
import { AiReview, DemoScenarioId, RecognitionResult, SimulatorState } from '../types';

type AiRecognitionProps = {
  reviews?: AiReview[];
  onReview?: (decision: AiReview['decision'], note: string) => void;
  aiStage: 'idle' | 'analyzing' | 'done' | 'error';
  aiResult: RecognitionResult | null;
  aiError: string | null;
  scenario: DemoScenarioId;
  runtime: SimulatorState['runtime'];
  setScenario: (scenario: DemoScenarioId) => void;
  runRecognition: (file: File, scenario: DemoScenarioId) => Promise<void>;
};

const demoPngBytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='), (character) => character.charCodeAt(0));

export function AiRecognition({ aiStage, aiResult, aiError, scenario, runtime, setScenario, runRecognition, reviews = [], onReview }: AiRecognitionProps) {
  const [reviewNote, setReviewNote] = useState('');
  const [decision, setDecision] = useState<AiReview['decision']>('confirmed');
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
        {aiStage === 'error' && <div className="empty-state error-state" role="alert"><h3>AI 推理未完成</h3><p>{aiError}</p><p>请检查图片格式、清晰度与拍摄对象；无法判断时重新拍摄并现场复查，服务失败时核对网关连接后再试。</p></div>}

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
                <Badge tone={aiResult.severity === 'critical' ? 'danger' : aiResult.severity === 'warning' ? 'warn' : 'good'}>{{ info: '提示', warning: '警告', critical: '严重' }[aiResult.severity]}</Badge>
                <Badge tone="blue">{aiResult.mode === 'demo' ? '演示适配器' : '远程推理'}</Badge>
              </div>
              <strong>识别处理建议</strong>
              <ul>{aiResult.recommendations.map((item) => <li key={item}>{item}</li>)}</ul>
              <details><summary>推理详情</summary><p>文件指纹 {aiResult.contentFingerprint} · 处理耗时 {aiResult.processingTimeMs} ms</p></details>
              <h3>人工复核与复查</h3><p>复核只记录判断，不触发设备命令。演示结果仍保留演示来源。</p>
              <form onSubmit={e => { e.preventDefault(); if (reviewNote.trim()) { onReview?.(decision, reviewNote); setReviewNote(''); } }}>
                <label>复核结论<select aria-label="复核结论" value={decision} onChange={e => setDecision(e.target.value as AiReview['decision'])}><option value="confirmed">人工确认</option><option value="corrected">人工纠正</option><option value="recheck">无法判断，待复查</option></select></label>
                <label>复核备注<textarea aria-label="复核备注" required maxLength={2000} value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="填写现场依据、纠正结果或复查计划" /></label>
                <button className="text-button" disabled={!onReview || !reviewNote.trim()}>保存复核记录</button>
              </form>

            </div>
          </div>
        )}
        <details open={reviews.length > 0}><summary>本机复核历史（{reviews.length}）</summary>
          {reviews.length ? [...reviews].reverse().map((r, i) => <div className="history-entry" key={i}><p>{new Date(r.at).toLocaleString('zh-CN')} · {r.mode === 'demo' ? '演示结果' : '远程推理'} · {r.label}</p><p>{{ confirmed: '已确认', corrected: '已纠正', recheck: '待复查' }[r.decision]}：{r.note}</p><details><summary>关联图片详情</summary>{r.fingerprint}</details></div>) : <p>暂无人工复核记录。</p>}
        </details>
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
