import { describe, expect, it } from 'vitest';
import { createInitialSimulatorState } from '../simulator/simulatorReducer';
import { exportDemoSnapshot, parseDemoSnapshot } from './demoSnapshot';

describe('演示快照', () => {
  it('导出后可恢复同一暂停状态', () => {
    const state = createInitialSimulatorState('2026-01-01T09:00:00.000Z');
    state.presentation.runStatus = 'paused';
    const restored = parseDemoSnapshot(exportDemoSnapshot(state));
    expect(restored.state.presentation).toEqual(state.presentation);
    expect(restored.state.runtime.mode).toBe('simulation');
  });

  it('拒绝非法枚举且不返回部分状态', () => {
    const raw = exportDemoSnapshot(createInitialSimulatorState('2026-01-01T09:00:00.000Z'));
    expect(() => parseDemoSnapshot(raw.replace('"normal"', '"remote-mqtt"'))).toThrow('快照场景无效');
    expect(() => parseDemoSnapshot('{')).toThrow('快照不是有效 JSON');
  });

  it('拒绝缺少边缘节点配置的旧快照', () => {
    const exported = JSON.parse(exportDemoSnapshot(createInitialSimulatorState('2026-01-01T09:00:00.000Z'))) as Record<string, unknown>;
    exported.snapshotVersion = 1;
    expect(() => parseDemoSnapshot(JSON.stringify(exported))).toThrow('不支持的快照版本');
  });
});
