import { SimulatorState } from '../types';

export const snapshotVersion = 1;
export type DemoSnapshot = { snapshotVersion: 1; createdAt: string; state: SimulatorState };

const keys = ['temperature', 'humidity', 'light', 'soilMoisture', 'co2'];
const actuatorKeys = ['waterPump', 'fan', 'growLight', 'shade'];
const scenarioIds = ['normal', 'soil-drought', 'high-heat-co2', 'sensor-offline', 'water-pump-failure'];

export function exportDemoSnapshot(state: SimulatorState): string {
  return JSON.stringify({ snapshotVersion, createdAt: new Date().toISOString(), state } satisfies DemoSnapshot, null, 2);
}

/** 只接受本应用自己导出的有限结构，失败时由调用方保持当前状态。 */
export function parseDemoSnapshot(raw: string): DemoSnapshot {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('快照不是有效 JSON。'); }
  if (!parsed || typeof parsed !== 'object') throw new Error('快照必须是对象。');
  const value = parsed as Partial<DemoSnapshot>;
  if (value.snapshotVersion !== snapshotVersion) throw new Error('不支持的快照版本。');
  const state = value.state as Partial<SimulatorState> | undefined;
  if (!state || !state.reading || !state.sensors || !state.actuators || !state.presentation || !Array.isArray(state.alarms) || !Array.isArray(state.devices) || !Array.isArray(state.history)) throw new Error('快照缺少必要状态。');
  if (!scenarioIds.includes(state.presentation.scenarioId ?? '') || !['running', 'paused'].includes(state.presentation.runStatus ?? '')) throw new Error('快照场景无效。');
  if (!keys.every((key) => state.reading && (state.reading as Record<string, unknown>)[key] === null || typeof (state.reading as Record<string, unknown>)[key] === 'number')) throw new Error('快照读数无效。');
  if (!keys.every((key) => ['good', 'stale', 'offline', 'invalid', 'error'].includes((state.sensors as Record<string, { quality?: string }>)[key]?.quality ?? ''))) throw new Error('快照数据质量无效。');
  if (!actuatorKeys.every((key) => typeof (state.actuators as Record<string, { target?: unknown; actual?: unknown }>)[key]?.target === 'boolean' && typeof (state.actuators as Record<string, { target?: unknown; actual?: unknown }>)[key]?.actual === 'boolean')) throw new Error('快照设备状态无效。');
  if (!state.runtime || !['simulation', 'external', 'playback'].includes(state.runtime.mode ?? '')) throw new Error('快照运行模式无效。');
  return value as DemoSnapshot;
}
