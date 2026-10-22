import { useEffect, useState } from 'react';
import { DataOrigin, RuntimeMode } from '../types';
import * as api from '../analysis/api';
import { ChartData, DataEvent, EnvironmentReport, Health, Irrigation, PlantContext, Sample } from '../analysis/types';
import { samplePoints } from '../analysis/chartMath';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { PlantContextEditor } from '../components/PlantContextEditor';
import { sensorLabels, deviceLabels } from '../simulator/policy';
import { originLabels, qualityLabels } from '../utils/runtimeStatus';

const fmt = (value: number | null | undefined, digits = 2) => value === null || value === undefined ? '无法计算' : value.toFixed(digits);
const secs = (value: number | null | undefined) => value === null || value === undefined ? '未配置／无法判断' : fmt(value, 1) + ' 秒';
function dateAt(at: string, timezone: string) { const p = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(at)); return ['year', 'month', 'day'].map(k => p.find(v => v.type === k)!.value).join('-'); }

export function DataAnalysis({ mode }: { mode: RuntimeMode }) {
  const [dataset, setDataset] = useState<DataOrigin>(mode === 'external' ? 'hardware' : mode === 'playback' ? 'playback' : 'simulation');
  const [zone, setZone] = useState('unassigned'); const [zones, setZones] = useState<string[]>([]);
  const [date, setDate] = useState(dateAt(new Date().toISOString(), 'Asia/Shanghai')); const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [revision, setRevision] = useState(0);
  const [service, setService] = useState<Health | null>(null); const [report, setReport] = useState<EnvironmentReport | null>(null);
  const [chart, setChart] = useState<ChartData | null>(null); const [irrigations, setIrrigations] = useState<Irrigation[]>([]); const [totalEvents, setTotalEvents] = useState(0);
  const [detail, setDetail] = useState<Irrigation | null>(null);
  const [selected, setSelected] = useState<string | null>(null); const [selectedMarker, setSelectedMarker] = useState<DataEvent | null>(null);
  const [raw, setRaw] = useState<Sample[]>([]); const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const [ready, setReady] = useState(false);
  const timezone = service?.timezone ?? 'Asia/Shanghai';
  const time = (value: string | null | undefined) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false, timeZone: timezone }) : '未取得／未配置';
  const offset = timezone === 'UTC' ? 'Z' : '+08:00';
  const query: api.Query = { dataset, zone, ...(custom ? { from: from ? from + ':00' + offset : undefined, to: to ? to + ':00' + offset : undefined } : { date }) };
  useEffect(() => {
    setReady(false); setReport(null); setChart(null); setIrrigations([]); setRaw([]);
    if (!api.dataServiceUrl) return;
    const controller = new AbortController();
    void Promise.all([api.health(controller.signal), api.zones(dataset, controller.signal)]).then(([status, result]) => {
      if (controller.signal.aborted) return;
      setService(status); setZones(result.items); setZone(current => result.items.includes(current) ? current : result.items[0] ?? 'unassigned'); setReady(true); setError('');
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '数据服务不可用'); });
    return () => controller.abort();
  }, [dataset, revision]);
  useEffect(() => {
    if (!ready || custom && (!from || !to)) return;
    const controller = new AbortController(); setLoading(true); setError(''); setReport(null); setChart(null); setIrrigations([]); setRaw([]); setSelectedMarker(null);
    const q: api.Query = { dataset, zone, ...(custom ? { from: from + ':00' + offset, to: to + ':00' + offset } : { date }) };
    void Promise.all([api.environmentReport(q, controller.signal), api.chart(q, controller.signal), api.irrigationList(q, controller.signal), api.rawHistory(q, 0, controller.signal)]).then(([r, c, events, history]) => {
      if (controller.signal.aborted) return;
      setReport(r); setChart(c); setIrrigations(events.items); setTotalEvents(events.total); setRaw(history.items); setNextOffset(history.nextOffset);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '分析查询失败'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [dataset, zone, date, custom, from, to, offset, ready, revision]);
  useEffect(() => {
    if (!selected || !ready) { setDetail(null); return; }
    const controller = new AbortController(); setDetail(null);
    const q: api.Query = { dataset, zone, ...(custom ? { from: from + ':00' + offset, to: to + ':00' + offset } : { date }) };
    void api.irrigationDetail(q, selected, controller.signal).then(result => { if (!controller.signal.aborted) setDetail(result.items[0] ?? null); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '灌溉详情查询失败'); });
    return () => controller.abort();
  }, [selected, ready, dataset, zone, custom, from, to, offset, date, revision]);
  const groups = new Map<string, Sample[]>();
  for (const sample of chart?.items ?? []) { const key = sample.key + ':' + sample.sensorId; groups.set(key, [...(groups.get(key) ?? []), sample]); }
  const focusMarker = (event: DataEvent) => { setSelectedMarker(event); const found = irrigations.find(e => [...e.timeline, ...e.interventions, ...e.notes].some(item => item.id === event.id) || e.id === event.commandId || e.aliases.includes(event.id)); if (found) setSelected(found.id); };
  return <div className="page-grid analysis-page">
    <section className="panel"><h2>数据分析 · 环境日报与灌溉复盘</h2><p>持续采集 → 可信存储 → 环境分析 → 效果复盘 → 人工核查。分析只提供证据，不调整阈值或下发控制。</p>
      {!api.dataServiceUrl ? <p className="notice warn">数据服务未配置。现有监测与演示继续可用；独立历史与分析不可用，不使用浏览器示例数据补齐。请按数据服务文档启动并配置 VITE_DATA_SERVICE_URL。</p> : <>
        <p>采集状态：{service?.collector.state === 'connected' ? '采集通信正常' : service?.collector.state === 'unconfigured' ? '采集源未配置' : service?.collector.state === 'degraded' ? '部分采集失败' : '等待或采集失败'} · 保留 {service?.retentionDays ?? '—'} 天 · 统计时区 {timezone}</p>
        <p>{service?.collector.error} · 硬件分区表示上游声明来自硬件，不等于现场效果已验证。</p>
        <div className="analysis-filters">
          <label>分析数据分区<select aria-label="分析数据分区" value={dataset} onChange={e => { setSelected(null); setDataset(e.target.value as DataOrigin); }}><option value="simulation">仿真／软件测试数据</option><option value="hardware">硬件上报数据（待现场核验）</option><option value="playback">回放数据</option><option value="unknown">来源待核实（隔离）</option></select></label>
          <label>分析区域<select aria-label="分析区域" value={zone} onChange={e => { setZone(e.target.value); setSelected(null); }}>{!zones.includes('unassigned') && <option value="unassigned">未配置区域</option>}{zones.map(id => <option key={id} value={id}>{id === 'unassigned' ? '未配置区域' : id}</option>)}</select></label>
          <label>统计日期（{timezone}）<input aria-label="统计日期" type="date" value={date} disabled={custom} onChange={e => { setDate(e.target.value); setSelected(null); }} /></label>
          <label><input type="checkbox" checked={custom} onChange={e => setCustom(e.target.checked)} />自定义时间范围</label>
          {custom && <><label>开始（{timezone}）<input aria-label="分析开始时间" type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} /></label><label>结束（{timezone}）<input aria-label="分析结束时间" type="datetime-local" value={to} onChange={e => setTo(e.target.value)} /></label></>}
          <button className="text-button" onClick={() => setRevision(r => r + 1)}>刷新分析</button>
          {service?.datasets[dataset].latestAt && <button className="text-button" onClick={() => { setCustom(false); setDate(dateAt(service.datasets[dataset].latestAt!, timezone)); }}>定位最新采样日</button>}
        </div>
        {dataset === 'simulation' && <p className="notice warn">此分区是仿真／确定性软件测试数据，不能用于证明现场效果；与答辩场景的浏览器快照不是同一个采集过程。</p>}
      </>}
      {error && <p className="notice danger" role="alert">{error}</p>}{loading && <p role="status">正在查询原始记录与统计…</p>}
    </section>
    {report && <>
      <section className="panel"><h2>环境日报</h2><p>{time(report.from)} — {time(report.to)}（{timezone}）；范围内 {report.sampleCount} 条采样。当前日只统计至服务当前时间，不把未来时段算成缺失。</p>
        <div className="analysis-stat-grid">{report.metrics.map((m, i) => <article className="analysis-stat" key={m.metric + ':' + m.sensorId + ':' + i}>
          <h3>{sensorLabels[m.metric]}（{m.unit}）</h3><span>{m.sensorId ?? '传感器未配置'} · {originLabels[dataset]}</span>
          <p>时间加权平均 <strong>{fmt(m.timeWeightedMean)}</strong> · 最小 {fmt(m.minimum?.value)} · 最大 {fmt(m.maximum?.value)}</p>
          <p>有效覆盖率 <strong>{fmt(m.coverage * 100, 1)}%</strong> · 有效 {secs(m.validSeconds)} / 分母 {secs(m.denominatorSeconds)}</p>
          <p>目标内 {secs(m.targetInSeconds)} · 超限 {secs(m.targetOutSeconds)} · 最长连续超限 {secs(m.longestOutSeconds)}</p>
          <p>目标判断未知 {secs(m.targetUnknownSeconds)}（包含缺失和未确认目标）；数据缺失 {secs(m.unknownSeconds)}</p>
          <p>{m.reason ?? '目标按当时生效的已确认配置版本判断。'}</p>
          <details><summary>口径、覆盖率和原始依据</summary><p>{report.method}</p><p>采样 {m.sampleCount} 条，有效 {m.validSampleCount} 条。最小时间 {time(m.minimum?.at)}，最大时间 {time(m.maximum?.at)}。</p><p>最后相邻观测变化速率 {fmt(m.changeRatePerHour)} {m.unit}/小时；{time(m.rateFrom)} — {time(m.rateTo)}。</p><p>目标版本 {m.targetVersions.join('，') || '未配置'}；服务技术连接上限 {report.maxGapSeconds} 秒，历史版本可覆盖该值。</p>{m.missingPeriods.map(p => <p key={p.from}>缺失 {time(p.from)} — {time(p.to)}：{secs(p.seconds)}</p>)}<a href="#analysis-raw">查看原始记录</a></details>
        </article>)}</div>
      </section>
      <section className="panel"><h2>灌溉事件列表</h2><p>本范围关联 {totalEvents} 次，最多展示 100 次。相邻连续运行反馈合并为一次事件；收到停止反馈前保持未闭合。没有流量计，不推算用水量。</p>
        {!irrigations.length && <p>没有已记录的灌溉事件；不能据此证明现场没有发生灌溉。</p>}
        <div className="task-grid">{irrigations.map(e => <article className="task-card" key={e.id}><strong>{time(e.requestedAt ?? e.startedAt)}</strong><span>批次：{e.batchId ?? '未配置'}</span><span>{e.evidenceState}</span><p>{e.outcome}</p><span>运行反馈：{level(e.startFeedbackLevel)} · 停止反馈：{level(e.stopFeedbackLevel)}</span><button className="text-button" onClick={() => setSelected(e.id)}>查看本次灌溉效果</button></article>)}</div>
      </section>
      {detail && <IrrigationDetail key={detail.id} event={detail} time={time} timezone={timezone} contexts={report.contexts} maxGap={report.maxGapSeconds} />}
      <section className="panel"><h2>真实时间轴复盘</h2><p>每个传感器按自身采样序列绘制；未采该指标的其他记录不打断它的曲线。点击控制、反馈、报警或人工标记查看前后证据。</p><p>{chart?.downsampled ? '图表已降采样，保留桶内极值、无效点和事件附近记录；上方统计仍基于全部原始记录。' : '图表使用范围内已存储的原始采样。'} 原始 {chart?.rawCount ?? 0} 条。</p>
        {chart?.eventsTruncated && <p>事件标记超过 2000 条，请缩小范围查看完整标记。</p>}
        {selectedMarker && <div className="notice"><strong>{time(selectedMarker.observedAt)} · {eventText(selectedMarker)}</strong><p>前后环境见同一时间轴，控制与反馈详情如下。{detail ? '已关联到对应灌溉详情。' : '未找到可关联的灌溉，不能推断因果。'}</p><details><summary>事件原始证据</summary><pre className="analysis-json">{JSON.stringify(selectedMarker, null, 2)}</pre></details></div>}
      </section>
      {[...groups.entries()].map(([key, samples]) => <TimeSeriesChart key={key} title={sensorLabels[samples[0].key] + ' · ' + samples[0].sensorId} points={samplePoints(samples)} unit={{ temperature: '°C', humidity: '%', soilMoisture: '%', light: 'lux', co2: 'ppm' }[samples[0].key]} from={chart!.from} to={chart!.to} maxGapSeconds={chart!.maxGapSeconds} gapVersions={chart!.contexts.map(c => ({ effectiveAt: c.effectiveAt, seconds: c.analysis.maxGapSeconds ?? chart!.maxGapSeconds }))} timezone={timezone} events={chart!.events} onEvent={focusMarker} />)}
      <section className="panel" id="analysis-raw"><h2>原始采样记录（含质量与来源）</h2><p>分页查询，每页 100 条；不以图表降采样结果代替原始证据。</p><div className="history-list">{raw.map(s => <details key={s.id}><summary>{time(s.capturedAt)} · {sensorLabels[s.key]} {s.value ?? '无有效值'} {s.unit} · {qualityLabels[s.quality]} · {originLabels[s.sourceKind]}</summary><pre className="analysis-json">{JSON.stringify(s, null, 2)}</pre></details>)}</div>
        {nextOffset !== null && <button className="text-button" onClick={async () => { try { const next = await api.rawHistory(query, nextOffset); setRaw(current => [...current, ...next.items]); setNextOffset(next.nextOffset); } catch (cause) { setError(cause instanceof Error ? cause.message : '原始记录查询失败'); } }}>加载下一页原始记录</button>}
      </section>
      <ManualNote key={dataset + ':' + zone + ':' + (detail?.id ?? '')} dataset={dataset} zone={zone} eventId={detail?.id} timezone={timezone} onSaved={() => setRevision(r => r + 1)} />
      <PlantContextEditor key={dataset + ':' + zone} dataset={dataset} zone={zone} contexts={report.contexts} timezone={timezone} onSaved={() => setRevision(r => r + 1)} />
    </>}
  </div>;
}

function level(value: string | null) { return value ? ({ physical: '物理反馈上报', output: '输出通道回读', gateway: '网关状态', simulation: '模拟反馈' }[value] ?? '未知层级') : '未取得'; }
function eventText(e: DataEvent) { return `${e.device ? deviceLabels[e.device] : ''} · ${{ command: '命令记录', feedback: '反馈记录', alarm: '报警', manual: '人工操作', 'collector-gap': '采集中断' }[e.kind]} · ${e.reason ?? e.note ?? e.title ?? ''}`; }
function IrrigationDetail({ event: e, time, timezone, contexts, maxGap }: { event: Irrigation; time: (at: string | null | undefined) => string; timezone: string; contexts: PlantContext[]; maxGap: number }) {
  const soilSensors = [...new Set(e.samples.filter(s => s.key === 'soilMoisture' && (!e.context?.soilSensorId || s.sensorId === e.context.soilSensorId)).map(s => s.sensorId))];
  return <section className="panel" aria-label="单次灌溉效果详情"><h2>单次灌溉效果详情</h2><p>区域 {e.zoneId} · 批次 {e.batchId ?? '未配置'} · 作物 {e.context?.crop ?? '未配置'} · 阶段 {e.context?.stage ?? '未配置'} · 配置版本 {e.context?.version ?? '未配置'}</p>
    <p><strong>{e.evidenceState} · {e.outcome}</strong></p><p>请求 {time(e.requestedAt)}；运行反馈 {time(e.startedAt)}（{level(e.startFeedbackLevel)}）；停止反馈 {time(e.stoppedAt)}（{level(e.stopFeedbackLevel)}）。</p>
    <p>反馈连续支持的运行时长下界：{secs(e.supportedRunSeconds)}。起止时长界限：{e.durationBoundsSeconds ? secs(e.durationBoundsSeconds.minimum) + ' — ' + secs(e.durationBoundsSeconds.maximum) : '不确定'}；轮询起止时间是观测界限，不能当作精确动作时刻。{e.hasGap ? '中间反馈不连续。' : ''}</p>
    <details><summary>运行时长、起止界限与精度依据</summary><p>可能开始：{time(e.startBounds?.earliest)} — {time(e.startBounds?.latest)}；可能停止：{time(e.stopBounds?.earliest)} — {time(e.stopBounds?.latest)}。缺少一侧界限时不填写精确时长；各反馈的 precisionMs 和 timeBasis 可在事件标记与时间线查看。</p></details>
    <p>灌溉前加权湿度 {fmt(e.before?.timeWeightedMean)}%；近期变化 {fmt(e.before?.changeRatePerHour)} 百分点/小时；前覆盖率 {fmt((e.before?.coverage ?? 0) * 100, 1)}%。</p>
    <p>灌溉后加权湿度 {fmt(e.after?.timeWeightedMean)}%；前后均值差 {fmt(e.moistureDelta)} 百分点；后覆盖率 {fmt((e.after?.coverage ?? 0) * 100, 1)}%。</p>
    <p>首次观察到配置增量响应 {time(e.responseAt)}，相对停止反馈延迟 {secs(e.responseDelaySeconds)}；首次采样观察到目标内 {time(e.targetReturnAt)}，目标版本 {e.targetReturnVersion ?? '未配置／未恢复'}。</p>
    <p>观察窗口结束 {time(e.observationUntil)}。{e.responseMethod}</p>
    <ul>{e.limitations.map(reason => <li key={reason}>{reason}</li>)}</ul><p>未观察到响应只能提示核查，不据此诊断缺水、泵故障或堵塞；不计算实际用水量或实测节水率。</p>
    <details><summary>命令、反馈与人工干预时间线（{e.timeline.length}）</summary>{e.timeline.map(item => <div className="history-entry" key={item.id}><p>{time(item.observedAt)} · {eventText(item)} · {item.status ?? ''} · {item.feedbackLevel ? level(item.feedbackLevel) : ''}{item.actual === true ? '／运行' : item.actual === false ? '／停止' : ''}</p>{item.observationCount && <p>连续同状态反馈合并 {item.observationCount} 次，自 {time(item.firstObservedAt)}；原始事件仍保存在数据库。</p>}<pre className="analysis-json">{JSON.stringify(item, null, 2)}</pre></div>)}</details>
    {soilSensors.map(sensor => <TimeSeriesChart key={sensor} title={'本次事件前后土壤湿度 · ' + sensor} points={samplePoints(e.samples.filter(s => s.key === 'soilMoisture' && s.sensorId === sensor))} unit="%" from={e.windowFrom} to={e.windowTo} maxGapSeconds={maxGap} gapVersions={contexts.map(c => ({ effectiveAt: c.effectiveAt, seconds: c.analysis.maxGapSeconds ?? maxGap }))} timezone={timezone} events={e.relatedEvents} />)}
    <details><summary>事件前后原始采样（{e.samples.length}）</summary><div className="history-list">{e.samples.map(s => <details key={s.id}><summary>{time(s.capturedAt)} · {sensorLabels[s.key]} {s.value ?? '无有效值'} {s.unit} · {qualityLabels[s.quality]}</summary><pre className="analysis-json">{JSON.stringify(s, null, 2)}</pre></details>)}</div></details>
    {e.relatedEventsTruncated && <p>关联事件标记超过 2000 条，部分未绘制；请缩小分析窗口查询原始事件。</p>}
    <details open={e.interventions.length > 0}><summary>其他操作与人工核查（{e.interventions.length} 项干预、{e.notes.length} 条备注）</summary>{[...e.interventions, ...e.notes.filter(n => !e.interventions.some(i => i.id === n.id))].map(item => <p key={item.id}>{time(item.observedAt)} · {eventText(item)}</p>)}</details>
  </section>;
}
function ManualNote({ dataset, zone, eventId, timezone, onSaved }: { dataset: DataOrigin; zone: string; eventId?: string; timezone: string; onSaved: () => void }) {
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  return <section className="panel"><h2>人工核查与其他操作</h2><p>{eventId ? '关联所选灌溉事件：' + eventId : '记录当前区域的人工操作，按时间关联重叠观察窗口。'} 没有账号体系，不指定操作人员身份。</p><form onSubmit={async e => {
    e.preventDefault(); const form = e.currentTarget; const data = new FormData(form); setError(''); setSaving(true);
    try { await api.saveNote(dataset, { zoneId: zone, irrigationId: eventId, observedAt: String(data.get('at')) + ':00' + (timezone === 'UTC' ? 'Z' : '+08:00'), operation: String(data.get('operation')), note: String(data.get('note')) }); form.reset(); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '备注保存失败'); } finally { setSaving(false); }
  }}><div className="analysis-form-grid"><label>操作发生时间（{timezone}）<input name="at" aria-label="人工操作发生时间" type="datetime-local" required /></label><label>操作类型<select name="operation" aria-label="人工操作类型"><option value="inspection">人工核查</option><option value="hand-watering">人工浇水</option><option value="maintenance">传感器维护</option><option value="moved">传感器移动</option><option value="calibration">传感器校准</option></select></label></div><label>核查／操作备注<textarea name="note" aria-label="分析核查备注" required maxLength={2000} /></label>{error && <p role="alert">{error}</p>}<button className="primary-button" disabled={saving}>{saving ? '保存中…' : '保存分析核查备注'}</button></form></section>;
}
