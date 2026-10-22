import { useState } from 'react';
import { TimePoint, timeSegments, xForTime } from '../analysis/chartMath';
import { DataEvent } from '../analysis/types';
import { originLabels } from '../utils/runtimeStatus';

export function TimeSeriesChart({ title, points, unit, from, to, maxGapSeconds = 120, gapVersions = [], timezone, events = [], onEvent }: {
  title: string; points: TimePoint[]; unit: string; from?: string; to?: string; maxGapSeconds?: number; gapVersions?: Array<{ effectiveAt: string; seconds: number }>; timezone?: string; events?: DataEvent[]; onEvent?: (event: DataEvent) => void;
}) {
  const [selected, setSelected] = useState<TimePoint | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<DataEvent | null>(null);
  const formatTimestamp = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false, timeZone: timezone });
  const times = points.map(p => Date.parse(p.at)).filter(Number.isFinite);
  const start = from ? Date.parse(from) : Math.min(...times); const end = to ? Date.parse(to) : Math.max(...times);
  const values = points.filter(p => p.quality === 'good' && p.value !== null).map(p => p.value!);
  const minimum = values.length ? Math.min(...values) : 0; const maximum = values.length ? Math.max(...values) : 1;
  const margin = Math.max((maximum - minimum) * 0.12, 0.5); const lo = minimum - margin; const hi = maximum + margin;
  const y = (v: number) => 206 - (v - lo) / (hi - lo) * 166;
  const position = (p: TimePoint) => `${xForTime(p.at, start, end)},${y(p.value!)}`;
  const labels: Record<DataEvent['kind'], string> = { command: '控制命令', feedback: '设备反馈', alarm: '报警', manual: '人工操作', 'collector-gap': '采集中断' };
  return <section className="chart-panel time-chart" aria-label={title}>
    <h3>{title}（{unit}）</h3><p>独立数值轴；按真实时间绘制，不与其他量纲比较斜率。技术连接上限 {maxGapSeconds} 秒（可由历史配置覆盖）；无效采样和长缺口断开。时区：{timezone ?? '浏览器本地'}。</p>
    {!times.length || !values.length ? <p className="empty-state">没有该序列的有效历史数值，不能绘制趋势。</p> : <svg className="native-chart" viewBox="0 0 800 260" role="img" aria-label={title + '真实时间趋势'}>
      {[0, 1, 2, 3, 4].map(i => { const value = lo + (hi - lo) * i / 4; return <g key={i}><line x1="62" x2="762" y1={y(value)} y2={y(value)} stroke="#e2e8f0" /><text x="54" y={y(value) + 4} textAnchor="end" className="chart-axis-label">{value.toFixed(unit === 'ppm' || unit === 'lux' ? 0 : 1)}</text></g>; })}
      {timeSegments(points, maxGapSeconds * 1000, gapVersions).map((segment, i) => <polyline key={i} points={segment.map(position).join(' ')} fill="none" stroke="#07847b" strokeWidth="2" />)}
      {points.filter(p => p.quality === 'good' && p.value !== null).map(p => <circle key={p.id} cx={xForTime(p.at, start, end)} cy={y(p.value!)} r="3" fill="#07847b" tabIndex={0} role="button" aria-label={formatTimestamp(p.at) + ' ' + p.value + ' ' + unit} onClick={() => setSelected(p)} onFocus={() => setSelected(p)} onKeyDown={e => { if (e.key === 'Enter') setSelected(p); }}><title>{formatTimestamp(p.at)} · {p.value} {unit}</title></circle>)}
      {[0, 1, 2, 3, 4].map(i => <text key={i} x={62 + 700 * i / 4} y="252" textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'} className="chart-axis-label">{new Date(start + (end - start) * i / 4).toLocaleTimeString('zh-CN', { hour12: false, timeZone: timezone })}</text>)}
      {events.filter(e => Date.parse(e.observedAt) >= start && Date.parse(e.observedAt) <= end).map((e, i) => <g key={e.id} role="button" tabIndex={0} aria-label={labels[e.kind] + ' ' + formatTimestamp(e.observedAt)} onClick={() => { setSelectedEvent(e); onEvent?.(e); }} onKeyDown={key => { if (key.key === 'Enter') { setSelectedEvent(e); onEvent?.(e); } }}><line x1={xForTime(e.observedAt, start, end)} x2={xForTime(e.observedAt, start, end)} y1="32" y2="218" stroke={e.kind === 'manual' ? '#9333ea' : '#e49321'} strokeDasharray="3 4" opacity="0.5" /><circle cx={xForTime(e.observedAt, start, end)} cy={222 + (i % 2) * 8} r="4" fill={e.kind === 'manual' ? '#9333ea' : '#e49321'} /><title>{labels[e.kind]} · {formatTimestamp(e.observedAt)} · {e.reason ?? e.note ?? e.device ?? ''}</title></g>)}
    </svg>}
    {selected && <p role="status">{formatTimestamp(selected.at)} · {selected.value} {unit} · {originLabels[selected.sourceKind ?? 'unknown']}</p>}
    {selectedEvent && <details open><summary>所选事件证据：{labels[selectedEvent.kind]}</summary><pre className="analysis-json">{JSON.stringify(selectedEvent, null, 2)}</pre></details>}
    <small>时间范围：{Number.isFinite(start) ? formatTimestamp(new Date(start).toISOString()) : '无'} — {Number.isFinite(end) ? formatTimestamp(new Date(end).toISOString()) : '无'}；精确采样可点击圆点或查看原始记录。</small>
  </section>;
}
