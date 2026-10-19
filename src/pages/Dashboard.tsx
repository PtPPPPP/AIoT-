import { useState } from 'react';
import { EnvironmentTrend, LightCo2Trend } from '../components/Charts';
import { MetricCard } from '../components/MetricCard';
import { PresentationConsole } from '../components/PresentationConsole';
import { DemoGuide } from '../components/DemoGuide';
import { ActuatorFeedback } from '../components/ActuatorFeedback';
import { HistoryReview } from '../components/HistoryReview';
import { RuntimeStatus } from '../components/RuntimeStatus';
import { useGreenhouseSimulator } from '../hooks/useGreenhouseSimulator';
import { PageKey } from '../types';
import { deviceLabels, sensorLabels } from '../simulator/policy';
import { formatReading, sensorRisk } from '../utils/greenhouse';
import { alarmStatusLabels, conclusion, controlReason, deviceKeys, duration, nextCheck, originLabels, qualityLabels, sensorKeys } from '../utils/runtimeStatus';

type DashboardProps = { model: ReturnType<typeof useGreenhouseSimulator>; onNavigate: (page: PageKey, focus?: string) => void };
export function Dashboard({ model: m, onNavigate }: DashboardProps) {
  const [view, setView] = useState<'run' | 'demo'>('run');
  const [historyOpen, setHistoryOpen] = useState(false);
  const state = conclusion(m);
  const pending = m.alarms.filter(a => a.status !== 'resolved');
  const units = { temperature: '°C', humidity: '%', light: 'lux', soilMoisture: '%', co2: 'ppm' };
  return <div className="page-grid">
    <section className="hero-panel">
      <div><p>温室运行总览 · {m.runtime.mode === 'simulation' ? '仿真结论' : m.runtime.mode === 'playback' ? '回放结论' : '当前证据'}</p><h2>{state}</h2>
        <p>{state === '数据不足' ? '部分采样或反馈不可用，先恢复可信数据再判断运行状况。' : state === '需要人工介入' ? '请检查下方异常与命令结果，现场核实后记录处理。' : state === '自动处理中' ? '关联设备有处置目标或运行反馈；异常仍需等待有效数据恢复。' : '当前有效采样与已知反馈中没有未恢复报警。'}</p>
        <RuntimeStatus runtime={m.runtime} sensors={m.sensors} />
      </div>
      <div className="view-switch" aria-label="展示视图">
        <button className={view === 'run' ? 'primary-button' : 'text-button'} onClick={() => setView('run')}>运行视图</button>
        <button className={view === 'demo' ? 'primary-button' : 'text-button'} onClick={() => setView('demo')}>演示视图</button>
        <small>仅改变展示，不改变通信和设备状态</small>
      </div>
    </section>
    <section className="panel" aria-label="待处理异常">
      <div className="section-title"><div><h2>待处理异常</h2><p>确认表示已知晓；人工处理记录与数据恢复分别追踪。</p></div><span>{pending.length} 项</span></div>
      {!pending.length && <p>{state === '数据不足' ? '暂无已记录报警，当前数据不足以排除异常。' : '暂无未恢复报警。'}</p>}
      <div className="task-grid">{pending.slice(0, 6).map(a => <article className="task-card" key={a.id}>
        <strong>{a.title}</strong><span>{a.context?.location ?? '位置待核实'} · 已持续 {duration(a.firstTriggeredAt, m.observedAt)}</span>
        <p>{a.description}</p><span>{alarmStatusLabels[a.status]}</span>
        <p>当前处置目标：{a.context?.deviceKeys.length ? a.context.deviceKeys.map(k => deviceLabels[k] + '目标' + (m.actuators[k].target ? '开启' : '关闭')).join('；') : '没有关联自动动作证据'}</p>
        <small>{nextCheck(a)}</small>
        <button className="text-button" onClick={() => onNavigate('alerts', a.id)}>查看报警与处理</button>
      </article>)}</div>
      {pending.length > 6 && <button className="text-button" onClick={() => onNavigate('alerts')}>查看全部异常</button>}
    </section>
    <section className="panel" aria-label="关键设备">
      <h2>关键设备与执行反馈</h2>
      <div className="control-grid">{deviceKeys.map(k => <article className="control-card" key={k}>
        <h3>{deviceLabels[k]}</h3><ActuatorFeedback state={m.actuators[k]} />
        <details><summary>控制原因与有效阈值</summary><p>{controlReason(k, m.controlMode, m.reading, m.sensors)}</p></details>
        <button className="text-button" onClick={() => onNavigate('control', k)}>查看设备与控制记录</button>
      </article>)}</div>
    </section>
    {view === 'demo' && <details className="panel" open><summary>答辩场景控制台</summary>
      <PresentationConsole presentation={m.presentation} onSelectScenario={m.selectPresentationScenario} onPause={m.pausePresentation} onResume={m.resumePresentation} onStep={m.stepPresentation} onReset={m.resetPresentationScenario} onRegenerateSeed={m.regeneratePresentationSeed} onCopySeed={m.copyPresentationSeed} onExportSnapshot={m.exportSnapshot} onImportSnapshot={m.importSnapshot} onExportOperationLog={m.exportOperationLog} onDebateReset={m.debateReset} isDebateResetting={m.isDebateResetting} runtimeMode={m.runtime.mode} />
      <DemoGuide />
    </details>}
    <section className="panel"><h2>环境指标与统计口径</h2><div className="metric-grid">
      {sensorKeys.map(k => <MetricCard key={k} label={sensorLabels[k]} risk={sensorRisk(k, m.sensors[k].quality === 'good' ? m.reading[k] : null)} value={formatReading(m.sensors[k].quality === 'good' ? m.reading[k] : null)} unit={m.reading[k] === null ? '' : units[k]} hint={originLabels[m.sensors[k].sourceKind ?? 'unknown'] + ' · ' + qualityLabels[m.sensors[k].quality]} />)}
      <MetricCard label="今日记录的灌溉启动" value={m.runtime.mode === 'simulation' ? String(m.stats.irrigationCount) : '数据不足'} unit={m.runtime.mode === 'simulation' ? '次' : ''} hint="按本机本地日期统计已记录的停止→运行变化；不是用水量。外部反馈层级与连续性不足，暂不计量。" />
      <MetricCard label="累计模拟灌溉时长" value={m.runtime.mode === 'simulation' ? m.efficiency.actualWaterSeconds.toFixed(1) : '数据不足'} unit={m.runtime.mode === 'simulation' ? '秒' : ''} hint="模拟周期累计，不是现场实测时长；实际用水量未知。" />
      <MetricCard label="演示策略节水率" value={m.stats.waterSaving === null ? '数据不足' : String(m.stats.waterSaving)} unit={m.stats.waterSaving === null ? '' : '%'} hint={m.stats.explanation} />
    </div><button className="text-button" onClick={() => onNavigate('environment')}>查看采集时间与最后有效值</button></section>
    {!m.history.length ? <section className="panel"><p>尚无采样历史，未生成模拟数据填充图表。</p></section> : <><EnvironmentTrend data={m.history} /><LightCo2Trend data={m.history} /></>}
    <section className="panel"><button className="text-button" aria-expanded={historyOpen} onClick={() => setHistoryOpen(!historyOpen)}>历史复盘与时间范围查询</button></section>
    {historyOpen && <HistoryReview history={m.history} records={m.controlRecords} alarms={m.alarms} />}
  </div>;
}
