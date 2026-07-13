import { useState } from 'react';
import type React from 'react';
import { BrainCircuit, CheckCircle2, Loader2, Upload } from '../components/Icons';
import { aiSamples } from '../data/mockData';
import { AiResult } from '../types';
import { Badge } from '../components/Status';

type AiRecognitionProps = {
  aiStage: 'idle' | 'analyzing' | 'done';
  aiResult: AiResult | null;
  runAiAnalysis: (sampleName: string) => void;
};

export function AiRecognition({ aiStage, aiResult, runAiAnalysis }: AiRecognitionProps) {
  const [selected, setSelected] = useState(aiSamples[0]);
  const [fileName, setFileName] = useState('');

  return (
    <div className="ai-layout">
      <section className="panel ai-picker">
        <div className="section-title">
          <div>
            <h2>AI作物识别</h2>
            <p>当前阶段使用模拟模型结果，演示分析流程和建议生成。</p>
          </div>
        </div>

        <div className="sample-grid">
          {aiSamples.map((sample) => (
            <button
              key={sample.id}
              className={`sample-card ${selected.id === sample.id ? 'active' : ''}`}
              onClick={() => setSelected(sample)}
            >
              <span style={{ background: sample.image }} />
              <strong>{sample.name}</strong>
            </button>
          ))}
        </div>

        <label className="upload-box">
          <Upload size={22} />
          <span>{fileName || '上传作物图片用于演示'}</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setFileName(event.target.files?.[0]?.name ?? '')}
          />
        </label>

        <button className="primary-button" onClick={() => runAiAnalysis(fileName || selected.name)}>
          开始AI分析
        </button>
      </section>

      <section className="panel">
        <div className="ai-flow">
          <FlowStep icon={<Upload size={18} />} title="读取图像" active={aiStage !== 'idle'} />
          <FlowStep icon={aiStage === 'analyzing' ? <Loader2 className="spin" size={18} /> : <BrainCircuit size={18} />} title="AI分析中" active={aiStage === 'analyzing' || aiStage === 'done'} />
          <FlowStep icon={<CheckCircle2 size={18} />} title="生成建议" active={aiStage === 'done'} />
        </div>

        {aiStage === 'idle' && (
          <div className="empty-state">
            <BrainCircuit size={42} />
            <h3>选择图片后启动识别</h3>
            <p>结果会展示作物长势、叶片健康度、疑似病害、风险等级和处理建议。</p>
          </div>
        )}

        {aiStage === 'analyzing' && (
          <div className="empty-state">
            <Loader2 className="spin" size={44} />
            <h3>AI分析中</h3>
            <p>正在模拟 YieldNet 视觉识别、叶片健康评分和病害风险判断。</p>
          </div>
        )}

        {aiResult && (
          <div className="ai-result">
            <div className="result-score">
              <span>{aiResult.health}</span>
              <small>叶片健康度</small>
            </div>
            <div className="result-detail">
              <h3>{aiResult.crop}</h3>
              <p>{aiResult.growth}</p>
              <div className="result-tags">
                <Badge tone={aiResult.risk === '中风险' || aiResult.risk === '高风险' ? 'warn' : 'good'}>{aiResult.risk}</Badge>
                <Badge tone="blue">{aiResult.disease}</Badge>
              </div>
              <strong>处理建议</strong>
              <p>{aiResult.suggestion}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function FlowStep({ icon, title, active }: { icon: React.ReactNode; title: string; active: boolean }) {
  return (
    <div className={`flow-step ${active ? 'active' : ''}`}>
      {icon}
      <span>{title}</span>
    </div>
  );
}
