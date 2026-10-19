import { useState } from 'react';
import { Alarm, ControlRecord, DeviceStateKey, Reading } from '../types';
import { deviceLabels, sensorLabels } from '../simulator/policy';
import { executionLabels, levelLabels, originLabels, localDay, sensorKeys } from '../utils/runtimeStatus';
import { formatTimestamp } from '../utils/greenhouse';

export function HistoryReview({ history, records, alarms, focusDevice }: { history: Reading[]; records: ControlRecord[]; alarms: Alarm[]; focusDevice?: DeviceStateKey }) {
  const [from, setFrom] = useState(localDay(new Date().toISOString()));
  const [to, setTo] = useState(localDay(new Date().toISOString()));
  const [device, setDevice] = useState(focusDevice ?? '');
  const valid = !from || !to || from <= to;
  const inRange = (at: string) => valid && (!from || localDay(at) >= from) && (!to || localDay(at) <= to);
  const rows = [
    ...history.filter(r => !device && inRange(r.capturedAt)).map(r => ({ at: r.capturedAt, text: `环境采样：${sensorKeys.filter(k => r[k] !== null).map(k => `${sensorLabels[k]} ${r[k]}（${originLabels[r.origins?.[k] ?? 'unknown']}）`).join('，')}` })),
    ...records.filter(r => (!device || r.device === device) && inRange(r.at)).map(r => ({ at: r.at, text: `${deviceLabels[r.device]}：目标${r.target ? '开启' : '关闭'}；${executionLabels[r.status]}；${r.actual === undefined ? '无反馈' : `网关/模拟反馈${r.actual ? '运行' : '停止'}`}；${r.reason}${r.error ? `；${r.error}` : ''}` })),
    ...alarms.filter(a => (!device || a.context?.deviceKeys.includes(device as DeviceStateKey)) && inRange(a.lastTriggeredAt)).map(a => ({ at: a.lastTriggeredAt, text: `报警：${a.title}（${levelLabels[a.level]}）；${a.description}` })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return <section className="panel" id="control-history" aria-label="历史复盘">
    <h2>历史复盘与控制记录</h2>
    <p>本机有限记录：最多 500 条环境采样、500 条控制记录、40 条报警。清理浏览器会丢失；未接后端历史查询，缺失时段不补造。采样来源以环境详情为准。</p>
    <div className="presentation-actions">
      <label>起始日期<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label>结束日期<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      <label>关联设备<select value={device} onChange={e => setDevice(e.target.value)}><option value="">全部采样与动作</option>{Object.entries(deviceLabels).map(([k, v]) => <option value={k} key={k}>{v}</option>)}</select></label>
    </div>
    {!valid && <p role="alert">结束日期不能早于起始日期。</p>}
    <p>匹配 {rows.length} 条，按最新时间显示前 100 条。全部时间使用浏览器本地时区。</p>
    <div className="history-list">{rows.slice(0, 100).map((r, i) => <div className="history-entry" key={`${r.at}:${i}`}><time>{formatTimestamp(r.at)}</time><p>{r.text}</p></div>)}</div>
    {!rows.length && <p className="empty-state">此范围没有本机记录，不能据此推断没有异常或动作。</p>}
  </section>;
}
