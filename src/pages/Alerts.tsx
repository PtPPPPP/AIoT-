import { useMemo, useState } from 'react';
import { CheckCircle2 } from '../components/Icons';
import { Badge } from '../components/Status';
import { Alarm, PresentationState } from '../types';
import { exportCsv } from '../utils/exportFile';
import { formatTimestamp } from '../utils/greenhouse';

type AlertsProps = { alarms: Alarm[]; acknowledgeAlarm: (id: string) => void; presentation: PresentationState };
const statusLabel = { active: '未确认', acknowledged: '已确认', resolved: '已恢复' };

export function Alerts({ alarms, acknowledgeAlarm, presentation }: AlertsProps) {
  const [level, setLevel] = useState(''); const [status, setStatus] = useState(''); const [source, setSource] = useState(''); const [keyword, setKeyword] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const filtered = useMemo(() => alarms.filter((alarm) => (
    (!level || alarm.level === level) && (!status || alarm.status === status) && (!source || alarm.sourceId === source)
    && (!keyword || `${alarm.title}${alarm.description}${alarm.type}`.toLowerCase().includes(keyword.toLowerCase()))
    && (!from || alarm.lastTriggeredAt >= new Date(from).toISOString()) && (!to || alarm.lastTriggeredAt <= new Date(`${to}T23:59:59`).toISOString())
  )), [alarms, from, keyword, level, source, status, to]);
  const exportRows = (items: Alarm[]) => {
    if (!items.length) return;
    exportCsv(`温室报警-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`, ['报警 ID', '发生时间', '解除时间', '持续时长', '报警级别', '报警类型', '来源', '设备或传感器', '报警内容', '当前状态', '场景', '模拟步数', '处理结果'], items.map((alarm) => [alarm.id, alarm.firstTriggeredAt, alarm.resolvedAt ?? '', alarm.resolvedAt ? Math.max(0, new Date(alarm.resolvedAt).getTime() - new Date(alarm.firstTriggeredAt).getTime()) / 1000 : '', alarm.level, alarm.type, alarm.source ?? 'simulation', alarm.sourceId, alarm.description, statusLabel[alarm.status], alarm.scenario ?? presentation.scenarioId, alarm.simulationStep ?? presentation.step, alarm.handlingResult ?? '自动处理']));
  };
  const unresolved = alarms.filter((alarm) => alarm.status !== 'resolved').length;
  return <section className="panel">
    <div className="section-title"><div><h2>报警生命周期</h2><p>可按时间、等级、状态、来源和关键词筛选；导出使用 UTF-8 BOM，Excel 可直接识别中文。</p></div><Badge tone={unresolved > 0 ? 'warn' : 'good'}>未解决 {unresolved}</Badge></div>
    <div className="presentation-actions" aria-label="报警筛选">
      <input aria-label="关键词" placeholder="关键词" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      <select aria-label="报警级别" value={level} onChange={(e) => setLevel(e.target.value)}><option value="">全部级别</option><option value="info">info</option><option value="warning">warning</option><option value="critical">critical</option></select>
      <select aria-label="报警状态" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">全部状态</option><option value="active">未确认</option><option value="acknowledged">已确认</option><option value="resolved">已恢复</option></select>
      <select aria-label="设备或传感器" value={source} onChange={(e) => setSource(e.target.value)}><option value="">全部设备或传感器</option>{[...new Set(alarms.map((alarm) => alarm.sourceId))].map((id) => <option key={id}>{id}</option>)}</select>
      <input aria-label="开始日期" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><input aria-label="结束日期" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      <button type="button" className="text-button" onClick={() => { setLevel(''); setStatus(''); setSource(''); setKeyword(''); setFrom(''); setTo(''); }}>清空筛选</button>
      <button type="button" className="text-button" disabled={!filtered.length} onClick={() => exportRows(filtered)}>导出当前 {filtered.length} 条</button><button type="button" className="text-button" disabled={!alarms.length} onClick={() => exportRows(alarms)}>导出全部</button>
    </div>
    {!filtered.length ? <p className="empty-state">没有符合条件的报警记录。</p> : <div className="table alarm-table responsive-table"><div className="table-row table-head"><span>最后触发</span><span>报警</span><span>来源</span><span>等级</span><span>说明</span><span>状态</span></div>{filtered.map((alarm) => <div className={`table-row ${alarm.status === 'resolved' ? 'handled' : 'row-alert'}`} key={alarm.id}><span data-label="最后触发">{formatTimestamp(alarm.lastTriggeredAt)}</span><strong data-label="报警">{alarm.title}<small className="occurrence-count">累计 {alarm.occurrenceCount} 次</small></strong><span data-label="来源">{alarm.sourceId}</span><span data-label="等级"><Badge tone={alarm.level === 'critical' ? 'danger' : alarm.level === 'warning' ? 'warn' : 'blue'}>{alarm.level}</Badge></span><span data-label="说明">{alarm.description}</span><span data-label="状态">{alarm.status === 'active' ? <button type="button" className="text-button" onClick={() => acknowledgeAlarm(alarm.id)}><CheckCircle2 size={16} /> 确认报警</button> : <Badge tone={alarm.status === 'resolved' ? 'good' : 'blue'}>{statusLabel[alarm.status]}</Badge>}</span></div>)}</div>}
  </section>;
}
