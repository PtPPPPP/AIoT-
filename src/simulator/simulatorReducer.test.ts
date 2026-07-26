import { advanceSimulator, createInitialSimulatorState, simulatorReducer } from './simulatorReducer';

const now = '2026-01-01T10:00:00.000Z';
const next = '2026-01-01T10:00:02.600Z';

describe('simulator snapshot', () => {
  it('publishes the latest reading and matching actuator state in one frame', () => {
    const state = createInitialSimulatorState(now);
    state.reading.soilMoisture = 35;
    state.sensors.soilMoisture.lastValue = 35;
    const updated = advanceSimulator(state, next, [0.5, 0.5, 0.5, 0.5, 0.5]);
    expect(updated.reading.soilMoisture).toBeLessThan(36);
    expect(updated.actuators.waterPump.target).toBe(true);
    expect(updated.actuators.waterPump.actual).toBe(true);
  });

  it('does not mutate the previous snapshot', () => {
    const state = createInitialSimulatorState(now);
    const before = structuredClone(state);
    advanceSimulator(state, next, [0.5, 0.5, 0.5, 0.5, 0.5]);
    expect(state).toEqual(before);
  });

  it('stops offline sensor data and blocks dependent automatic control', () => {
    const state = createInitialSimulatorState(now);
    const offline = simulatorReducer(state, { type: 'toggle-device-online', id: 'SEN-S-03', now: next });
    expect(offline.reading.soilMoisture).toBeNull();
    const ticked = advanceSimulator(offline, '2026-01-01T10:00:05.200Z', [0.5, 0.5, 0.5, 0.5, 0.5]);
    expect(ticked.reading.soilMoisture).toBeNull();
    expect(ticked.actuators.waterPump.commandStatus).toBe('blocked');
  });

  it('does not report an offline actuator as running and recovers when online', () => {
    let state = createInitialSimulatorState(now);
    state = simulatorReducer(state, { type: 'set-control-mode', mode: 'manual', now });
    state = simulatorReducer(state, { type: 'toggle-manual-target', key: 'waterPump', now });
    expect(state.actuators.waterPump.actual).toBe(true);
    state = simulatorReducer(state, { type: 'toggle-device-online', id: 'ACT-P-01', now: next });
    expect(state.actuators.waterPump.target).toBe(true);
    expect(state.actuators.waterPump.actual).toBe(false);
    expect(state.alarms.some((alarm) => alarm.type === 'control-failure' && alarm.status === 'active')).toBe(true);
    state = simulatorReducer(state, { type: 'toggle-device-online', id: 'ACT-P-01', now: '2026-01-01T10:00:05.200Z' });
    expect(state.actuators.waterPump.actual).toBe(true);
  });

  it('restores sensor data after the device comes back online', () => {
    let state = createInitialSimulatorState(now);
    state = simulatorReducer(state, { type: 'toggle-device-online', id: 'SEN-S-03', now: next });
    expect(state.reading.soilMoisture).toBeNull();
    state = simulatorReducer(state, { type: 'toggle-device-online', id: 'SEN-S-03', now: '2026-01-01T10:00:05.200Z' });
    state = advanceSimulator(state, '2026-01-01T10:00:07.800Z', [0.5, 0.5, 0.5, 0.5, 0.5]);
    expect(state.sensors.soilMoisture.status).toBe('live');
    expect(state.reading.soilMoisture).not.toBeNull();
  });

  it('returns to the paused fixed-seed debate baseline without keeping active alarms', () => {
    let state = createInitialSimulatorState('2026-01-01T09:00:00.000Z');
    state = simulatorReducer(state, { type: 'select-presentation-scenario', scenarioId: 'water-pump-failure', seed: 'OTHER', now: '2026-01-01T09:01:00.000Z' });
    state = simulatorReducer(state, { type: 'advance-presentation', now: '2026-01-01T09:02:00.000Z' });
    const reset = simulatorReducer(state, { type: 'debate-reset', now: '2026-01-01T09:03:00.000Z' });
    expect(reset.presentation).toMatchObject({ scenarioId: 'normal', runStatus: 'paused', step: 0, seed: 'GREENHOUSE-2026', fault: 'none' });
    expect(reset.devices.every((device) => device.online)).toBe(true);
    expect(reset.actuators.waterPump).toMatchObject({ target: false, actual: false });
    expect(reset.alarms.every((alarm) => alarm.status === 'resolved')).toBe(true);
  });
});
