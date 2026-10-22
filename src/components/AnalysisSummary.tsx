import { useEffect, useState } from 'react';
import { RuntimeMode } from '../types';
import { dataServiceUrl, environmentReport, health, irrigationList, zones } from '../analysis/api';

export function AnalysisSummary({ mode, onOpen }: { mode: RuntimeMode; onOpen: () => void }) {
  const [summary, setSummary] = useState('数据服务未配置，无法提供独立历史统计。');
  useEffect(() => {
    if (!dataServiceUrl) return;
    const controller = new AbortController(); const dataset = mode === 'external' ? 'hardware' : mode === 'playback' ? 'playback' : 'simulation';
    void (async () => {
      const [service, available] = await Promise.all([health(controller.signal), zones(dataset, controller.signal)]);
      if (!available.items.length) { setSummary('此数据分区尚无区域记录；日报与灌溉复盘数据不足。'); return; }
      const zone = available.items[0];
      const p = new Intl.DateTimeFormat('en-CA', { timeZone: service.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(service.serverTime));
      const date = ['year', 'month', 'day'].map(k => p.find(v => v.type === k)!.value).join('-');
      const q = { dataset, zone, date } as const;
      const [report, events] = await Promise.all([environmentReport(q, controller.signal), irrigationList(q, controller.signal)]);
      const coverage = report.metrics.filter(m => m.sampleCount).map(m => m.coverage);
      setSummary(`${mode === 'simulation' ? '仿真统计 · ' : ''}${zone} · ${date}（${service.timezone}）：${report.sampleCount} 条原始采样；${events.total} 次关联灌溉。${coverage.length ? '各采样序列有效覆盖率 ' + Math.min(...coverage).toFixed(2) + '～' + Math.max(...coverage).toFixed(2) + '；' : '有效覆盖数据不足；'}${events.items.filter(e => e.outcome === '无法判断' || e.outcome.includes('核查')).length} 次需核查或证据不足（最多统计所列 100 次）。`);
    })().catch(() => { if (!controller.signal.aborted) setSummary('数据服务不可用或查询失败；未使用浏览器演示记录替代独立日报。'); });
    return () => controller.abort();
  }, [mode]);
  return <section className="panel" aria-label="数据应用摘要"><h2>今天的数据能说明什么</h2><p>{summary}</p><button className="text-button" onClick={onOpen}>查看日报与灌溉证据</button></section>;
}
