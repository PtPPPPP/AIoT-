import { initialSensorStates, initialTargets } from '../data/mockData';
import { Reading } from '../types';
import { decideAutomaticTargets } from './controlEngine';
import { greenhousePolicy, policyDescriptions } from './policy';

const reading = (soilMoisture: number): Reading => ({
  time: '10:00:00',
  capturedAt: '2026-01-01T10:00:00.000Z',
  temperature: 28,
  humidity: 60,
  light: 18_000,
  soilMoisture,
  co2: 700,
});

describe('greenhouse policy and hysteresis', () => {
  it('uses one policy source for the displayed irrigation rule', () => {
    const irrigationRule = policyDescriptions.find((item) => item.key === 'waterPump');
    expect(irrigationRule?.rule).toContain(String(greenhousePolicy.irrigationStartThreshold));
    expect(irrigationRule?.target).toContain(String(greenhousePolicy.irrigationStopThreshold));
  });

  it('starts below the start threshold and stops above the stop threshold', () => {
    const started = decideAutomaticTargets(reading(35), initialSensorStates, initialTargets);
    expect(started.targets.waterPump).toBe(true);
    const retained = decideAutomaticTargets(reading(40), initialSensorStates, started.targets);
    expect(retained.targets.waterPump).toBe(true);
    const stopped = decideAutomaticTargets(reading(46), initialSensorStates, retained.targets);
    expect(stopped.targets.waterPump).toBe(false);
  });

  it('keeps the previous state on exact hysteresis boundaries', () => {
    expect(decideAutomaticTargets(reading(36), initialSensorStates, initialTargets).targets.waterPump).toBe(false);
    expect(decideAutomaticTargets(reading(45), initialSensorStates, { ...initialTargets, waterPump: true }).targets.waterPump).toBe(true);
  });
});
