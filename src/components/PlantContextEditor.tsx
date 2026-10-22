import { useState } from 'react';
import { DataOrigin, SensorKey } from '../types';
import { PlantContext, TargetRange } from '../analysis/types';
import { saveContext } from '../analysis/api';
import { sensorLabels } from '../simulator/policy';
import { sensorKeys } from '../utils/runtimeStatus';

export function PlantContextEditor({ dataset, zone, contexts, timezone, onSaved }: { dataset: DataOrigin; zone: string; contexts: PlantContext[]; timezone: string; onSaved: () => void }) {
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const units = { temperature: '°C', humidity: '%', soilMoisture: '%', light: 'lux', co2: 'ppm' };
  const localIso = (s: string) => s.length === 16 ? s + ':00' + (timezone === 'UTC' ? 'Z' : '+08:00') : s + (timezone === 'UTC' ? 'Z' : '+08:00');
  return <details className="panel"><summary>区域、种植批次与分析配置（按生效时间保存）</summary>
    <p>当前区域：{zone === 'unassigned' ? '未配置区域' : zone}。作物、阶段和目标没有默认值；控制页面的演示阈值不会自动成为农艺标准。新版本不会覆盖旧版本。</p>
    {contexts.map(c => <details key={c.version}><summary>{new Date(c.effectiveAt).toLocaleString('zh-CN', { timeZone: timezone })} 生效 · {c.crop ?? '作物未配置'} / {c.stage ?? '阶段未配置'}</summary><pre className="analysis-json">{JSON.stringify(c, null, 2)}</pre></details>)}
    <form className="analysis-form" onSubmit={async e => {
      e.preventDefault(); const form = e.currentTarget; const data = new FormData(form);
      setError(''); setSaving(true);
      try {
        const targets: Partial<Record<SensorKey, TargetRange>> = {};
        for (const key of sensorKeys) {
          const low = String(data.get(key + 'Low') ?? ''); const high = String(data.get(key + 'High') ?? '');
          if (low || high) {
            if (!low || !high || !data.get('confirmed')) throw new Error('填写目标上下界并显式确认依据后才可保存目标。');
            targets[key] = { low: Number(low), high: Number(high), unit: units[key], confirmed: true };
          }
        }
        const optional = (key: string) => String(data.get(key) ?? '').trim() || null;
        const optionalNumber = (key: string) => optional(key) === null ? null : Number(data.get(key));
        await saveContext(dataset, { zoneId: String(data.get('zoneId')), effectiveAt: localIso(String(data.get('effectiveAt'))), batchId: optional('batchId'), crop: optional('crop'), variety: optional('variety'), stage: optional('stage'), substrate: optional('substrate'), plantedAt: optional('plantedAt') ? localIso(String(data.get('plantedAt'))) : null, notes: optional('notes'), soilSensorId: optional('soilSensorId'), targets,
          targetBasis: optional('targetBasis') ?? undefined, analysisBasis: optional('analysisBasis') ?? undefined,
          analysis: { maxGapSeconds: optionalNumber('maxGapSeconds'), preWindowSeconds: optionalNumber('preWindowSeconds'), postWindowSeconds: optionalNumber('postWindowSeconds'), responseDelta: optionalNumber('responseDelta') } });
        form.reset(); onSaved();
      } catch (cause) { setError(cause instanceof Error ? cause.message : '配置保存失败'); }
      finally { setSaving(false); }
    }}>
      <div className="analysis-form-grid">
        <label>区域标识<input name="zoneId" defaultValue={zone === 'unassigned' ? '' : zone} required placeholder="未配置" /></label>
        <label>生效时间（{timezone}）<input name="effectiveAt" type="datetime-local" required /></label>
        {([['batchId', '种植批次'], ['crop', '作物'], ['variety', '品种'], ['stage', '生长阶段'], ['substrate', '基质'], ['soilSensorId', '复盘土壤传感器标识']] as const).map(([name, label]) => <label key={name}>{label}<input name={name} placeholder="未配置" maxLength={2000} /></label>)}
        <label>种植时间（{timezone}）<input name="plantedAt" type="datetime-local" /></label>
      </div>
      <h3>已确认的目标区间</h3><p>没有配置时只展示描述统计，不判断达标。目标需要对应作物、阶段、批次和版本。</p>
      <div className="analysis-form-grid">{sensorKeys.map(key => <label key={key}>{sensorLabels[key]}（{units[key]}）<div className="range-inputs"><input aria-label={sensorLabels[key] + '目标下界'} name={key + 'Low'} type="number" step="any" placeholder="下界未配置" /><input aria-label={sensorLabels[key] + '目标上界'} name={key + 'High'} type="number" step="any" placeholder="上界未配置" /></div></label>)}</div>
      <label>目标依据<input name="targetBasis" placeholder="填写已确认依据，不能以演示阈值代替" /></label>
      <label><input name="confirmed" type="checkbox" />确认所填目标适用于本批次、作物和阶段</label>
      <h3>技术分析参数</h3><p>未配置灌溉窗口与响应判据时，不输出效果结论。连接间隔的服务默认值只是技术断线门槛；响应增量单位为湿度百分点。</p>
      <div className="analysis-form-grid">{([['maxGapSeconds', '最大可连接采样间隔（秒）'], ['preWindowSeconds', '灌溉前窗口（秒）'], ['postWindowSeconds', '灌溉后窗口（秒）'], ['responseDelta', '响应增量（百分点）']] as const).map(([name, label]) => <label key={name}>{label}<input name={name} type="number" min="0.01" step="any" placeholder="未配置" /></label>)}</div>
      <label>窗口与响应判定依据<input name="analysisBasis" placeholder="填写分析目的与参数依据" /></label>
      <label>备注<textarea name="notes" maxLength={2000} /></label>
      {error && <p role="alert">{error}</p>}<button className="primary-button" disabled={saving}>{saving ? '保存中…' : '保存新的生效版本'}</button>
    </form>
  </details>;
}
