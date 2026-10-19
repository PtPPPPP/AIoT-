import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialSimulatorState, simulatorReducer } from './simulatorReducer';
import { restoreState, serializeState, storageKey } from './persistence';
import { conclusion, localDay } from '../utils/runtimeStatus';
import { parseDemoSnapshot, exportDemoSnapshot } from '../snapshots/demoSnapshot';

const now = '2026-10-19T08:00:00.000Z';
const later = '2026-10-19T08:00:10.000Z';
function ingest(state = createInitialSimulatorState(now, 'external'), quality: 'good' | 'invalid' | 'stale' = 'good', at = now, sourceKind: 'hardware' | 'simulation' = 'hardware') {
  return simulatorReducer(state, { type: 'ingest-sensor-packet', key: 'soilMoisture', value: quality === 'good' ? 30 : 999, quality, capturedAt: at, sourceId: 'real-soil', sourceKind });
}
afterEach(() => vi.useRealTimers());
describe('运行证据与安全边界', () => {
  it('外部初始化没有模拟历史、有效读数、已知设备状态或控制授权', () => {
    const state = createInitialSimulatorState(now, 'external');
    expect(state.history).toEqual([]);
    expect(state.alarms).toEqual([]);
    expect(state.reading.soilMoisture).toBeNull();
    expect(state.devices.every(d => d.statusKnown === false)).toBe(true);
    expect(Object.values(state.actuators).every(a => !a.actualKnown)).toBe(true);
    expect(state.runtime.controlArmed).toBe(false);
    expect(conclusion(state)).toBe('数据不足');
  });
  it('无效或过期采样保留最后有效值和时间，不参与控制或冒充新有效值', () => {
    const valid = ingest();
    const invalid = ingest(valid, 'invalid', later);
    expect(invalid.sensors.soilMoisture).toMatchObject({ lastValue: 30, lastUpdatedAt: now, capturedAt: later, quality: 'invalid' });
    expect(invalid.reading.soilMoisture).toBeNull();
    expect(invalid.actuators.waterPump.commandStatus).toBe('blocked');
  });
  it('采集失效后不会把仍未恢复的环境报警解除', () => {
    let state = ingest();
    const alarm = state.alarms.find(a => a.type === 'environment-soil-moisture')!;
    state = simulatorReducer(state, { type: 'acknowledge-alarm', id: alarm.id });
    state = simulatorReducer(state, { type: 'expire-data', now: later, staleAfterMs: 5000 });
    expect(state.reading.soilMoisture).toBeNull();
    expect(state.sensors.soilMoisture.lastUpdatedAt).toBe(now);
    expect(state.alarms.find(a => a.id === alarm.id)?.status).toBe('acknowledged');
  });
  it('确认和人工处理完成均不能替代数据恢复，记录可持久化', () => {
    let state = ingest(); const id = state.alarms.find(a => a.type === 'environment-soil-moisture')!.id;
    state = simulatorReducer(state, { type: 'acknowledge-alarm', id });
    state = simulatorReducer(state, { type: 'handle-alarm', id, note: '已检查，等待复测', completed: true, now: later });
    const restored = restoreState(createInitialSimulatorState(later, 'external'), serializeState(state));
    const alarm = restored.alarms.find(a => a.id === id)!;
    expect(alarm.status).toBe('acknowledged');
    expect(alarm.handlingRecords).toEqual([{ at: later, note: '已检查，等待复测', completed: true }]);
    expect(alarm.resolvedAt).toBeUndefined();
    expect(restored.sensors.soilMoisture).toMatchObject({ lastValue: 30, lastUpdatedAt: now, quality: 'stale' });
    expect(restored.reading.soilMoisture).toBeNull();
  });
  it('禁止仿真或未核实来源驱动外部自动控制，逐指标保留来源', () => {
    const state = ingest(undefined, 'good', now, 'simulation');
    expect(state.sensors.soilMoisture.sourceKind).toBe('simulation');
    expect(state.sensors.temperature.sourceKind).toBe('unknown');
    expect(state.actuators.waterPump.commandStatus).toBe('blocked');
    expect(state.actuators.waterPump.blockedReason).toContain('来源');
  });
  it('忽略倒序采样，不制造历史有效值', () => {
    const state = ingest(undefined, 'good', later);
    expect(ingest(state, 'good', now)).toBe(state);
    expect(state.history).toHaveLength(1);
    expect(state.history[0].temperature).toBeNull();
  });
  it('网关接受命令不代表实际动作，等待最终回执超时保留最后状态', () => {
    let state = createInitialSimulatorState(now, 'external');
    state.actuators.waterPump = { ...state.actuators.waterPump, actualKnown: true, actual: true, actualUpdatedAt: now };
    state = simulatorReducer(state, { type: 'control-command-start', record: { id: 'cmd', at: now, device: 'waterPump', target: false, status: 'sent', reason: '人工关闭' } });
    state = simulatorReducer(state, { type: 'control-command-result', key: 'waterPump', target: false, status: 'acknowledged', commandId: 'cmd', now });
    expect(state.actuators.waterPump.actual).toBe(true);
    state = simulatorReducer(state, { type: 'expire-data', now: later, staleAfterMs: 5000 });
    expect(state.actuators.waterPump).toMatchObject({ actualKnown: true, actual: true, actualUpdatedAt: now, executionStatus: 'timed_out' });
    expect(state.controlRecords[0].status).toBe('timed_out');
    expect(state.alarms.some(a => a.type === 'control-failure')).toBe(true);
  });
  it('旧命令回执不能覆盖更新的目标或命令状态', () => {
    let state = createInitialSimulatorState(now, 'external');
    state.actuators.fan = { ...state.actuators.fan, target: false, commandId: 'new' };
    state = simulatorReducer(state, { type: 'control-command-result', key: 'fan', target: true, actual: true, status: 'succeeded', commandId: 'old', now });
    expect(state.actuators.fan.target).toBe(false);
    expect(state.actuators.fan.actualKnown).toBe(false);
  });
  it('部分执行器反馈缺失时保持未知；通道或设备反馈不能伪造为物理反馈', () => {
    let state = createInitialSimulatorState(now, 'external');
    state = simulatorReducer(state, { type: 'external-sync-actuators', actuators: [{ key: 'fan', online: true, actual: true, feedbackLevel: 'output', updatedAt: now }], now });
    expect(state.actuators.fan.feedbackLevel).toBe('output');
    expect(state.actuators.waterPump.actualKnown).toBe(false);
    expect(state.devices.find(d => d.actuatorKey === 'waterPump')?.statusKnown).toBe(false);
  });
  it('重启不恢复控制授权，模拟与外部存储相互隔离', () => {
    const sim = createInitialSimulatorState(now, 'simulation');
    const external = createInitialSimulatorState(now, 'external');
    expect(restoreState(external, serializeState(sim))).toBe(external);
    expect(storageKey('external')).not.toBe(storageKey('simulation'));
    external.runtime.controlArmed = true;
    expect(restoreState(createInitialSimulatorState(later, 'external'), serializeState(external)).runtime.controlArmed).toBe(false);
  });
  it.each(['tick', 'reset', 'debate-reset', 'select-presentation-scenario', 'import-snapshot'] as const)('外部模式拒绝演示操作 %s', type => {
    const state = createInitialSimulatorState(now, 'external');
    const action = { type, now: later, randomValues: [0.5], scenarioId: 'normal' as const, seed: 'x', state: createInitialSimulatorState(now, 'simulation') };
    expect(simulatorReducer(state, action)).toBe(state);
  });
  it('禁止通过导入快照切换到真实通信模式', () => {
    expect(() => parseDemoSnapshot(exportDemoSnapshot(createInitialSimulatorState(now, 'external')))).toThrow('仿真状态');
  });
  it('回放初始化没有伪造样本，控制与仿真时钟均不执行', () => {
    const state = createInitialSimulatorState(now, 'playback');
    expect(state.history).toEqual([]);
    expect(state.sensors.soilMoisture.sourceKind).toBe('playback');
    expect(simulatorReducer(state, { type: 'set-control-mode', mode: 'manual', now })).toBe(state);
    expect(simulatorReducer(state, { type: 'advance-presentation', now })).toBe(state);
  });
  it('按本地日期统计启动，午夜前的累计次数不会进入次日', () => {
    const before = new Date(2026, 9, 18, 23, 59, 59).toISOString();
    const after = new Date(2026, 9, 19, 0, 0, 1).toISOString();
    let state = createInitialSimulatorState(before, 'simulation');
    state = simulatorReducer(state, { type: 'set-control-mode', mode: 'manual', now: before });
    state = simulatorReducer(state, { type: 'toggle-manual-target', key: 'waterPump', now: before });
    expect(state.irrigationStarts.filter(at => localDay(at) === localDay(before))).toHaveLength(1);
    expect(state.irrigationStarts.filter(at => localDay(at) === localDay(after))).toHaveLength(0);
    state = simulatorReducer(state, { type: 'toggle-manual-target', key: 'waterPump', now: after });
    state = simulatorReducer(state, { type: 'toggle-manual-target', key: 'waterPump', now: after });
    expect(state.irrigationStarts.filter(at => localDay(at) === localDay(after))).toHaveLength(1);
  });
});
