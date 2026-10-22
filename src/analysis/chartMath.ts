import { DataOrigin, Reading, SensorKey } from '../types';
import { Sample } from './types';

export type TimePoint = { id: string; at: string; value: number | null; quality: string; unit: string; sourceKind?: DataOrigin };
export function readingPoints(data: Reading[], key: SensorKey, unit: string): TimePoint[] {
  return data.filter(r => !r.sampleKey || r.sampleKey === key).map((r, i) => ({ id: `${key}:${r.capturedAt}:${i}`, at: r.capturedAt, value: r[key], quality: r[key] === null ? 'invalid' : 'good', unit, sourceKind: r.origins?.[key] }));
}
export function samplePoints(samples: Sample[]) { return samples.map(s => ({ id: s.id, at: s.capturedAt, value: s.value, quality: s.quality, unit: s.unit, sourceKind: s.sourceKind })); }
export function timeSegments(points: TimePoint[], gapMs: number, versions: Array<{ effectiveAt: string; seconds: number }> = []) {
  const ordered = [...points].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const gapAt = (at: number) => {
    const effective = versions.filter(v => Date.parse(v.effectiveAt) <= at).sort((a, b) => Date.parse(b.effectiveAt) - Date.parse(a.effectiveAt))[0];
    return effective ? effective.seconds * 1000 : gapMs;
  };
  const segments: TimePoint[][] = []; let current: TimePoint[] = [];
  for (const point of ordered) {
    const last = current[current.length - 1];
    if (point.quality !== 'good' || point.value === null || !Number.isFinite(point.value) || !Number.isFinite(Date.parse(point.at))) {
      if (current.length) segments.push(current); current = []; continue;
    }
    const intervalLimit = last ? Math.min(gapAt(Date.parse(last.at)), gapAt(Date.parse(point.at)), ...versions.filter(v => Date.parse(v.effectiveAt) > Date.parse(last.at) && Date.parse(v.effectiveAt) < Date.parse(point.at)).map(v => v.seconds * 1000)) : gapMs;
    if (last && (Date.parse(point.at) - Date.parse(last.at) > intervalLimit || point.unit !== last.unit || point.sourceKind !== last.sourceKind)) {
      segments.push(current); current = [];
    }
    current.push(point);
  }
  if (current.length) segments.push(current);
  return segments;
}
export function xForTime(at: string, start: number, end: number, left = 62, width = 700) { return left + (Date.parse(at) - start) / Math.max(1, end - start) * width; }
