import { advancePresentation, createInitialSimulatorState, simulatorReducer } from './simulatorReducer';

const now = '2026-01-01T10:00:00.000Z';
const tick = (state: ReturnType<typeof createInitialSimulatorState>, step: number) => (
  advancePresentation(state, new Date(Date.parse(now) + step * 2_600).toISOString())
);

function selectScenario(scenarioId: 'normal' | 'soil-drought' | 'high-heat-co2' | 'sensor-offline' | 'water-pump-failure', seed = 'DEMO-SEED') {
  return simulatorReducer(createInitialSimulatorState(now), {
    type: 'select-presentation-scenario', scenarioId, seed, now,
  });
}

describe('presentation scenarios', () => {
  it('replays the same normal scenario for the same seed and changes for a different seed', () => {
    const first = tick(selectScenario('normal', 'SAME'), 1);
    const second = tick(selectScenario('normal', 'SAME'), 1);
    const different = tick(selectScenario('normal', 'DIFFERENT'), 1);
    expect(first.reading).toEqual(second.reading);
    expect(first.reading).not.toEqual(different.reading);
  });

  it('drives the soil drought to irrigation and then resolves it', () => {
    let state = tick(selectScenario('soil-drought'), 1);
    expect(state.actuators.waterPump.actual).toBe(true);
    expect(state.alarms.some((alarm) => alarm.type === 'environment-soil-moisture' && alarm.status === 'active')).toBe(true);
    for (let index = 2; index <= 4; index += 1) state = tick(state, index);
    expect(state.actuators.waterPump.actual).toBe(false);
    expect(state.alarms.some((alarm) => alarm.type === 'environment-soil-moisture' && alarm.status === 'resolved')).toBe(true);
  });

  it('drives high temperature and CO₂ to ventilation and recovery', () => {
    let state = tick(selectScenario('high-heat-co2'), 1);
    expect(state.actuators.fan.actual).toBe(true);
    expect(state.alarms.some((alarm) => alarm.type === 'environment-temperature' && alarm.status === 'active')).toBe(true);
    for (let index = 2; index <= 4; index += 1) state = tick(state, index);
    expect(state.actuators.fan.actual).toBe(false);
    expect(state.alarms.some((alarm) => alarm.type === 'environment-temperature' && alarm.status === 'resolved')).toBe(true);
  });

  it('removes offline sensor values from automatic control and restores them later', () => {
    let state = tick(selectScenario('sensor-offline'), 1);
    expect(state.reading.soilMoisture).toBeNull();
    expect(state.actuators.waterPump.commandStatus).toBe('blocked');
    for (let index = 2; index <= 4; index += 1) state = tick(state, index);
    expect(state.reading.soilMoisture).not.toBeNull();
    expect(state.sensors.soilMoisture.status).toBe('live');
  });

  it('does not report failed water-pump control as successful and recovers after the injected fault', () => {
    let state = tick(selectScenario('water-pump-failure'), 1);
    expect(state.actuators.waterPump.target).toBe(true);
    expect(state.actuators.waterPump.actual).toBe(false);
    expect(state.alarms.some((alarm) => alarm.type === 'control-failure' && alarm.status === 'active')).toBe(true);
    for (let index = 2; index <= 4; index += 1) state = tick(state, index);
    expect(state.actuators.waterPump.actual).toBe(true);
  });

  it('resets the selected scenario to its first step with the same seed', () => {
    let state = tick(selectScenario('soil-drought', 'RESET-ME'), 1);
    state = simulatorReducer(state, { type: 'reset-presentation-scenario', now });
    expect(state.presentation).toMatchObject({ scenarioId: 'soil-drought', seed: 'RESET-ME', step: 0 });
  });
});
