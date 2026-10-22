import { DataOrigin } from '../types';
import { sensorKeys } from '../utils/runtimeStatus';
import { ChartData, DataEvent, EnvironmentReport, Health, Irrigation, PlantContext, Sample, SeriesStats } from './types';
import { dataServiceUrl } from '../config/dataServiceConfig';
export { dataServiceUrl } from '../config/dataServiceConfig';
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const string = (v: unknown): v is string => typeof v === 'string';
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const nullable = (v: unknown) => v === null || finite(v);
const date = (v: unknown) => string(v) && Number.isFinite(Date.parse(v));
const origin = (v: unknown) => ['hardware', 'simulation', 'playback', 'unknown'].includes(String(v));
const strings = (v: unknown) => Array.isArray(v) && v.every(string);
export function isSample(v: unknown): v is Sample {
  return object(v) && ['id', 'zoneId', 'sensorId', 'gatewayId', 'source', 'unit'].every(k => string(v[k])) && sensorKeys.includes(v.key as Sample['key'])
    && nullable(v.value) && origin(v.sourceKind) && ['good', 'invalid', 'stale', 'offline', 'error'].includes(String(v.quality))
    && date(v.capturedAt) && date(v.receivedAt) && strings(v.validationNotes);
}
export function isEvent(v: unknown): v is DataEvent {
  return object(v) && string(v.id) && string(v.zoneId) && date(v.observedAt) && ['command', 'feedback', 'alarm', 'manual', 'collector-gap'].includes(String(v.kind));
}
export function isContext(v: unknown): v is PlantContext {
  return object(v) && string(v.version) && string(v.zoneId) && date(v.effectiveAt) && object(v.analysis) && object(v.targets)
    && Object.values(v.targets).every(t => object(t) && finite(t.low) && finite(t.high) && string(t.unit) && typeof t.confirmed === 'boolean');
}
export function isStats(v: unknown): v is SeriesStats {
  return object(v) && sensorKeys.includes(v.metric as Sample['key']) && (v.sensorId === null || string(v.sensorId)) && string(v.unit)
    && finite(v.coverage) && finite(v.denominatorSeconds) && finite(v.validSeconds) && finite(v.unknownSeconds)
    && nullable(v.timeWeightedMean) && nullable(v.targetInSeconds) && nullable(v.targetOutSeconds) && nullable(v.longestOutSeconds)
    && Array.isArray(v.missingPeriods) && v.missingPeriods.every(p => object(p) && date(p.from) && date(p.to) && finite(p.seconds)) && strings(v.targetVersions)
    && [v.minimum, v.maximum].every(p => p === null || object(p) && finite(p.value) && date(p.at));
}
export const isReport = (v: unknown): v is EnvironmentReport => object(v) && origin(v.dataset) && string(v.zoneId) && date(v.from) && date(v.to) && string(v.timezone) && string(v.method) && finite(v.sampleCount) && Array.isArray(v.metrics) && v.metrics.every(isStats) && Array.isArray(v.contexts) && v.contexts.every(isContext);
export const isChart = (v: unknown): v is ChartData => object(v) && finite(v.rawCount) && finite(v.maxGapSeconds) && date(v.from) && date(v.to) && Array.isArray(v.items) && v.items.every(isSample) && Array.isArray(v.events) && v.events.every(isEvent) && Array.isArray(v.contexts) && v.contexts.every(isContext);
export function isIrrigation(v: unknown): v is Irrigation {
  return object(v) && string(v.id) && string(v.zoneId) && string(v.outcome) && string(v.evidenceState) && strings(v.aliases) && strings(v.limitations)
    && nullable(v.moistureDelta) && finite(v.supportedRunSeconds) && [v.before, v.after].every(s => s === null || isStats(s))
    && [v.samples].every(s => Array.isArray(s) && s.every(isSample)) && [v.timeline, v.notes, v.interventions, v.relatedEvents].every(es => Array.isArray(es) && es.every(isEvent))
    && (v.context === null || isContext(v.context)) && date(v.windowFrom) && date(v.windowTo);
}
const isHealth = (v: unknown): v is Health => object(v) && v.schemaVersion === 1 && string(v.timezone) && date(v.serverTime) && object(v.collector) && string(v.collector.state) && object(v.datasets) && ['hardware', 'simulation', 'playback', 'unknown'].every(k => { const d = (v.datasets as Record<string, unknown>)[k]; return object(d) && finite(d.sampleCount) && finite(d.eventCount) && (d.latestAt === null || date(d.latestAt)); });

async function request<T>(path: string, validate: (v: unknown) => v is T, signal?: AbortSignal, body?: unknown): Promise<T> {
  if (!dataServiceUrl) throw new Error('数据服务未配置；请设置 VITE_DATA_SERVICE_URL。离线包保持无网络分析状态。');
  const controller = new AbortController();
  const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 15000);
  try {
    const response = await fetch(dataServiceUrl + path, { signal: controller.signal, ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
    const value: unknown = await response.json();
    if (!response.ok) throw new Error(object(value) && string(value.error) ? value.error : '数据服务请求失败');
    if (!validate(value)) throw new Error('数据服务响应结构无效，未采用替代数据');
    return value;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
export type Query = { dataset: DataOrigin; zone: string; date?: string; from?: string; to?: string };
export function queryString(query: Query) { return new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined) as [string, string][]).toString(); }
export const health = (signal?: AbortSignal) => request('/api/data/health', isHealth, signal);
export const zones = (kind: DataOrigin, signal?: AbortSignal) => request('/api/data/zones?dataset=' + kind, (v): v is { items: string[] } => object(v) && strings(v.items), signal);
export const environmentReport = (q: Query, signal?: AbortSignal) => request('/api/data/report?' + queryString(q), isReport, signal);
export const chart = (q: Query, signal?: AbortSignal) => request('/api/data/chart?' + queryString(q), isChart, signal);
export const irrigationList = (q: Query, signal?: AbortSignal) => request('/api/data/irrigations?' + queryString(q), (v): v is { items: Irrigation[]; total: number } => object(v) && finite(v.total) && Array.isArray(v.items) && v.items.every(isIrrigation), signal);
export const irrigationDetail = (q: Query, id: string, signal?: AbortSignal) => request('/api/data/irrigations/' + encodeURIComponent(id) + '?' + queryString(q), (v): v is { items: Irrigation[]; total: number } => object(v) && finite(v.total) && Array.isArray(v.items) && v.items.every(isIrrigation), signal);
export const rawHistory = (q: Query, offset = 0, signal?: AbortSignal) => request('/api/data/history?' + queryString(q) + '&limit=100&offset=' + offset, (v): v is { items: Sample[]; nextOffset: number | null } => object(v) && Array.isArray(v.items) && v.items.every(isSample) && nullable(v.nextOffset), signal);
export const contexts = (kind: DataOrigin, zone: string, signal?: AbortSignal) => request('/api/data/contexts?' + queryString({ dataset: kind, zone }), (v): v is { items: PlantContext[] } => object(v) && Array.isArray(v.items) && v.items.every(isContext), signal);
export const saveContext = (kind: DataOrigin, context: Omit<PlantContext, 'version'>) => request('/api/data/contexts', isContext, undefined, { dataset: kind, context });
export const saveNote = (kind: DataOrigin, note: Omit<DataEvent, 'id' | 'kind' | 'source'>) => request('/api/data/notes', isEvent, undefined, { dataset: kind, note });
export const auditEvents = (kind: DataOrigin, events: DataEvent[]) => request('/api/data/events', (v): v is { accepted: number } => object(v) && finite(v.accepted), undefined, { dataset: kind, events });
