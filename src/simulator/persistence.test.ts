import { createInitialSimulatorState } from './simulatorReducer';
import { restoreState, saveState, serializeState } from './persistence';

describe('versioned persistence', () => {
  it('restores control mode, targets and acknowledged alarms', () => {
    const initial = createInitialSimulatorState('2026-01-01T10:00:00.000Z');
    initial.controlMode = 'manual';
    initial.manualTargets.waterPump = true;
    initial.alarms[0].status = 'acknowledged';
    const restored = restoreState(createInitialSimulatorState('2026-01-02T10:00:00.000Z'), serializeState(initial));
    expect(restored.controlMode).toBe('manual');
    expect(restored.manualTargets.waterPump).toBe(true);
    expect(restored.alarms[0].status).toBe('acknowledged');
  });

  it('ignores corrupted or old data without throwing', () => {
    const initial = createInitialSimulatorState('2026-01-01T10:00:00.000Z');
    expect(restoreState(initial, '{bad json')).toBe(initial);
    expect(restoreState(initial, JSON.stringify({ version: 0 }))).toBe(initial);
    expect(restoreState(initial, JSON.stringify({ version: 1, controlMode: 'auto', manualTargets: {}, deviceOnline: {}, alarms: [], demoScenario: 'healthy', efficiency: {}, recentState: {} }))).toBe(initial);
  });

  it('reports storage write failure', () => {
    const storage = { setItem: () => { throw new Error('quota'); } };
    expect(saveState(storage, createInitialSimulatorState('2026-01-01T10:00:00.000Z'))).toBe(false);
  });
});
