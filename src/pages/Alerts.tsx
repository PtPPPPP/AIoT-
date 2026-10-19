import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from '../components/Icons';
import { Badge } from '../components/Status';
import { ActuatorFeedback } from '../components/ActuatorFeedback';
import { alarmDeviceKeys, alarmStatusLabels, duration, executionLabels, levelLabels, localDay, nextCheck } from '../utils/runtimeStatus';
import { deviceLabels } from '../simulator/policy';
import { ActuatorStates, Alarm, ControlRecord, Device, PageKey, PresentationState } from '../types';
import { exportCsv } from '../utils/exportFile';
import { formatTimestamp } from '../utils/greenhouse';

type AlertsProps = { alarms: Alarm[]; acknowledgeAlarm: (id: string) => void; presentation: PresentationState; devices?: Device[]; actuators?: ActuatorStates; records?: ControlRecord[]; handleAlarm?: (id: string, note: string, completed: boolean) => void; selectedId?: string; onNavigate?: (page: PageKey, focus?: string) => void };
const statusLabel = alarmStatusLabels;

export function Alerts({ alarms, acknowledgeAlarm, presentation, devices = [], actuators, records = [], handleAlarm, selectedId, onNavigate }: AlertsProps) {
  const [selected, setSelected] = useState(selectedId);
  useEffect(() => { if (selected) document.querySelector('#alarm-detail')?.scrollIntoView?.({ block: 'start' }); }, [selected]);
  const [level, setLevel] = useState(''); const [status, setStatus] = useState(''); const [source, setSource] = useState(''); const [keyword, setKeyword] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const filtered = useMemo(() => alarms.filter((alarm) => (
    (!level || alarm.level === level) && (!status || alarm.status === status) && (!source || alarm.sourceId === source)
    && (!keyword || `${alarm.title}${alarm.description}${alarm.type}`.toLowerCase().includes(keyword.toLowerCase()))
    && (!from || localDay(alarm.lastTriggeredAt) >= from) && (!to || localDay(alarm.lastTriggeredAt) <= to)
  )), [alarms, from, keyword, level, source, status, to]);
  const exportRows = (items: Alarm[]) => {
    if (!items.length) return;
    exportCsv(`温室报警-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`, ['报警 ID', '发生时间', '解除时间', '持续时长', '报警级别', '报警类型', '来源', '设备或传感器', '报警内容', '当前状态', '场景', '模拟步数', '处理结果'], items.map((alarm) => [alarm.id, alarm.firstTriggeredAt, alarm.resolvedAt ?? '', alarm.resolvedAt ? Math.max(0, new Date(alarm.resolvedAt).getTime() - new Date(alarm.firstTriggeredAt).getTime()) / 1000 : '', alarm.level, alarm.type, alarm.source ?? 'simulation', alarm.sourceId, alarm.description, statusLabel[alarm.status], alarm.scenario ?? presentation.scenarioId, alarm.simulationStep ?? presentation.step, alarm.handlingRecords?.map(r => r.at + ' ' + r.note + (r.completed ? '（人工处理完成）' : '')).join('；') ?? '无人工处理记录']));
  };
  const unresolved = alarms.filter((alarm) => alarm.status !== 'resolved').length;
  const detail = alarms.find(a => a.id === selected);
  return <div className="page-grid"><section className="panel">
    <div className="section-title"><div><h2>报警生命周期</h2><p>可按时间、等级、状态、来源和关键词筛选；导出使用 UTF-8 BOM，Excel 可直接识别中文。</p></div><Badge tone={unresolved > 0 ? 'warn' : 'good'}>未解决 {unresolved}</Badge></div>
    <div className="presentation-actions" aria-label="报警筛选">
      <input aria-label="关键词" placeholder="关键词" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      <select aria-label="报警级别" value={level} onChange={(e) => setLevel(e.target.value)}><option value="">全部级别</option><option value="info">提示</option><option value="warning">警告</option><option value="critical">严重</option></select>
      <select aria-label="报警状态" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">全部状态</option><option value="active">未确认</option><option value="acknowledged">已确认</option><option value="resolved">已恢复</option></select>
      <select aria-label="设备或传感器" value={source} onChange={(e) => setSource(e.target.value)}><option value="">全部设备或传感器</option>{[...new Set(alarms.map((alarm) => alarm.sourceId))].map((id) => <option key={id} value={id}>{devices.find(d => d.id === id || d.reportedId === id)?.name ?? '采样来源'} · {alarms.find(a => a.sourceId === id)?.title}</option>)}</select>
      <input aria-label="开始日期" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><input aria-label="结束日期" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      <button type="button" className="text-button" onClick={() => { setLevel(''); setStatus(''); setSource(''); setKeyword(''); setFrom(''); setTo(''); }}>清空筛选</button>
      <button type="button" className="text-button" disabled={!filtered.length} onClick={() => exportRows(filtered)}>导出当前 {filtered.length} 条</button><button type="button" className="text-button" disabled={!alarms.length} onClick={() => exportRows(alarms)}>导出全部</button>
    </div>
    {!filtered.length ? <p className="empty-state">没有符合条件的报警记录。</p> : <div className="table alarm-table responsive-table"><div className="table-row table-head"><span>最后触发</span><span>报警</span><span>来源</span><span>等级</span><span>说明</span><span>状态</span></div>{filtered.map((alarm) => <div className={`table-row ${alarm.status === 'resolved' ? 'handled' : 'row-alert'}`} key={alarm.id}><span data-label="最后触发">{formatTimestamp(alarm.lastTriggeredAt)}</span><strong data-label="报警"><button className="text-button" onClick={() => setSelected(alarm.id)}>{alarm.title}</button><small className="occurrence-count">累计 {alarm.occurrenceCount} 次</small></strong><span data-label="来源">{alarm.source === 'external' ? '外部上报' : '仿真'} · {devices.find(d => d.id === alarm.sourceId || d.reportedId === alarm.sourceId)?.name ?? '位置待核实'}</span><span data-label="等级"><Badge tone={alarm.level === 'critical' ? 'danger' : alarm.level === 'warning' ? 'warn' : 'blue'}>{levelLabels[alarm.level]}</Badge></span><span data-label="说明">{alarm.description}</span><span data-label="状态">{alarm.status === 'active' ? <button type="button" className="text-button" onClick={() => acknowledgeAlarm(alarm.id)}><CheckCircle2 size={16} /> 确认报警</button> : <Badge tone={alarm.status === 'resolved' ? 'good' : 'blue'}>{statusLabel[alarm.status]}</Badge>}</span></div>)}</div>}
  </section>
    {detail && <AlarmDetail key={detail.id} alarm={detail} devices={devices} actuators={actuators} records={records} handleAlarm={handleAlarm} onNavigate={onNavigate} />}
  </div>;
}

function AlarmDetail({ alarm, devices, actuators, records, handleAlarm, onNavigate }: { alarm: Alarm } & Pick<AlertsProps, 'devices' | 'actuators' | 'records' | 'handleAlarm' | 'onNavigate'>) {
  const [note, setNote] = useState('');
  const [completed, setCompleted] = useState(false);
  const keys = alarm.context?.deviceKeys ?? alarmDeviceKeys(alarm, devices ?? []);
  const related = (records ?? []).filter(r => keys.includes(r.device) && Date.parse(r.at) >= Date.parse(alarm.firstTriggeredAt) - 5000 && (!alarm.resolvedAt || Date.parse(r.at) <= Date.parse(alarm.resolvedAt)));
  return <section className="panel" aria-label="报警详情" id="alarm-detail">
    <h2>{alarm.title} · 处理详情</h2>
    <p>位置：{alarm.context?.location ?? devices?.find(d => d.id === alarm.sourceId || d.reportedId === alarm.sourceId)?.location ?? '位置待核实'} · 来源：{alarm.source === 'external' ? '外部上报' : '仿真'}</p>
    <p>首次发生 {formatTimestamp(alarm.firstTriggeredAt)} · 最近触发 {formatTimestamp(alarm.lastTriggeredAt)} · 持续 {duration(alarm.firstTriggeredAt, alarm.resolvedAt ?? new Date().toISOString())}</p>
    <p>触发依据：{alarm.description}</p>
    <p>异常状态：{alarmStatusLabels[alarm.status]} · 人工处理：{alarm.handlingRecords?.[alarm.handlingRecords.length - 1]?.completed && Date.parse(alarm.handlingRecords[alarm.handlingRecords.length - 1].at) >= Date.parse(alarm.firstTriggeredAt) ? '人工处理完成（不代表数据恢复）' : '待处理或待复查'}</p>
    <h3>关联设备当前状态</h3>
    <div className="control-grid">{keys.map(k => <article className="control-card" key={k}><strong>{deviceLabels[k]}</strong>{actuators && <ActuatorFeedback state={actuators[k]} />}
      <button className="text-button" onClick={() => onNavigate?.('devices', k)}>定位关联设备</button>
      <button className="text-button" onClick={() => onNavigate?.('control', k + ':records')}>查看关联控制记录</button>
    </article>)}</div>
    <h3>发生期间系统动作与执行结果</h3>
    {!related.length ? <p>没有记录到关联控制命令，不能断言已采取自动动作。</p> : related.map(r => <div className="history-entry" key={r.id}><p>{formatTimestamp(r.at)} · {deviceLabels[r.device]}目标{r.target ? '开' : '关'} · {executionLabels[r.status]}</p><p>{r.reason} {r.error}</p></div>)}
    <p>下一步：{nextCheck(alarm)}</p>
    <details><summary>触发时策略依据与协议详情</summary><p>报警标识 {alarm.id} · 来源标识 {alarm.sourceId} · 类型 {alarm.type}</p>{alarm.context?.actions.map((action, i) => <p key={i}>{action}</p>)}</details>
    <h3>人工处理记录</h3><p>无账号体系，仅记录本机时间与备注，不指定操作人员。确认报警、人工处理完成和数据恢复分别记录。</p>
    {(alarm.handlingRecords ?? []).map((r, i) => <div className="history-entry" key={i}><time>{formatTimestamp(r.at)}</time><p>{r.completed ? '人工处理完成' : '处理／复查备注'}：{r.note}</p></div>)}
    <form onSubmit={e => { e.preventDefault(); if (!note.trim()) return; handleAlarm?.(alarm.id, note, completed); setNote(''); setCompleted(false); }}>
      <label>处理备注<textarea aria-label="处理备注" maxLength={2000} required value={note} onChange={e => setNote(e.target.value)} placeholder="填写检查结果、处理动作和下一步复查计划" /></label>
      <label><input type="checkbox" checked={completed} onChange={e => setCompleted(e.target.checked)} />记录人工处理完成（不会将异常标记为恢复）</label>
      <button className="primary-button" disabled={!handleAlarm || !note.trim()}>保存处理记录</button>
    </form>
  </section>;
}
