import { useEffect, useRef, useState } from 'react';
import { SimulatorState } from '../types';
import { auditEvents, dataServiceUrl } from '../analysis/api';
import { DataEvent } from '../analysis/types';

/** Best-effort browser audit bridge; the gateway's read-only event feed is required for complete unattended command history. */
export function useDataAudit(state: SimulatorState) {
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(new Map<string, DataEvent>()); const saved = useRef(new Set<string>());
  const sending = useRef(false);
  useEffect(() => {
    if (!dataServiceUrl || state.runtime.mode === 'playback') return;
    const add = (event: DataEvent) => { const key = event.sourceKind + ':' + event.id; if (!saved.current.has(key)) pending.current.set(key, event); };
    for (const r of state.controlRecords) {
      const sourceKind = r.sourceKind ?? (state.runtime.mode === 'simulation' ? 'simulation' : 'unknown');
      const source = r.source ?? (state.runtime.mode === 'simulation' ? 'simulation' : 'unknown');
      add({ id: r.id + ':command:' + r.status, commandId: r.id, kind: 'command', device: r.device, target: r.target, status: r.status,
        source, sourceKind, zoneId: 'unassigned', observedAt: r.completedAt ?? r.at, reason: r.reason,
        strategyVersion: r.strategyVersion, timeBasis: r.completedAt ? 'browser-receipt' : 'command-created-time' });
      if (r.actual !== undefined) add({ id: r.id + ':feedback:' + r.status, commandId: r.id, kind: 'feedback', device: r.device, actual: r.actual,
        feedbackLevel: r.feedbackLevel ?? 'gateway', source, sourceKind, zoneId: 'unassigned', observedAt: r.completedAt ?? r.at, precisionMs: 0, timeBasis: 'browser-receipt' });
    }
    for (const alarm of state.alarms) {
      const sensor = Object.values(state.sensors).find(s => s.sourceId === alarm.sourceId);
      const sourceKind = alarm.source === 'simulation' || state.runtime.mode === 'simulation' ? 'simulation' : sensor?.sourceKind ?? 'unknown';
      add({ id: alarm.id + ':' + alarm.status + ':' + alarm.firstTriggeredAt + ':' + alarm.lastTriggeredAt, kind: 'alarm', zoneId: 'unassigned', sourceKind,
        observedAt: alarm.resolvedAt ?? alarm.lastTriggeredAt, title: alarm.title, reason: alarm.description, timeBasis: 'alarm-snapshot' });
      for (const [i, note] of (alarm.handlingRecords ?? []).entries()) add({ id: alarm.id + ':note:' + i + ':' + note.at, kind: 'manual', operation: 'inspection', note: note.note, source: 'manual', sourceKind, zoneId: 'unassigned', observedAt: note.at });
    }
  }, [state.controlRecords, state.alarms, state.sensors, state.runtime.mode]);
  useEffect(() => {
    if (!dataServiceUrl) return;
    let cancelled = false;
    const flush = async () => {
      if (sending.current || !pending.current.size) return;
      sending.current = true;
      try {
        const entries = [...pending.current.entries()].slice(0, 100); const origin = entries[0][1].sourceKind ?? 'unknown';
        const batch = entries.filter(([, event]) => event.sourceKind === origin);
        await auditEvents(origin, batch.map(([, event]) => event));
        for (const [key] of batch) { pending.current.delete(key); saved.current.add(key); }
        if (!cancelled) setError(null);
      } catch { if (!cancelled) setError('独立数据服务审计记录尚未保存，将在页面运行期间重试；关闭页面可能丢失未保存事件。监测与原有控制通道保持独立。'); }
      finally { sending.current = false; }
    };
    const timer = setInterval(() => { void flush(); }, 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);
  return error;
}
