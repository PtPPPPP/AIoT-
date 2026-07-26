import { ActuatorStates, Device, Reading, SensorKey, SensorStates } from '../types';

const sensorKeys: SensorKey[] = ['temperature', 'humidity', 'light', 'soilMoisture', 'co2'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const jitter = (value: number, spread: number, random: number) => value + (random - 0.5) * spread;

export function simulateReading(
  current: Reading,
  sensors: SensorStates,
  devices: Device[],
  actuators: ActuatorStates,
  now: string,
  randomValues: number[],
): { reading: Reading; sensors: SensorStates } {
  const date = new Date(now);
  const minutes = date.getHours() * 60 + date.getMinutes();
  const daylight = Math.max(0.35, Math.sin(((minutes - 360) / 720) * Math.PI));
  const previous = (key: SensorKey) => current[key] ?? sensors[key].lastValue;

  const candidates: Record<SensorKey, number> = {
    temperature: Number(clamp(jitter(previous('temperature') + (actuators.fan.actual ? -0.18 : 0.12), 1.1, randomValues[0] ?? 0.5), 21, 36).toFixed(1)),
    humidity: Number(clamp(jitter(previous('humidity') + (actuators.fan.actual ? -0.25 : 0.15), 1.8, randomValues[1] ?? 0.5), 42, 86).toFixed(0)),
    light: Number(clamp(jitter(9_000 + daylight * 23_000 + (actuators.growLight.actual ? 6_500 : 0) - (actuators.shade.actual ? 9_000 : 0), 2_200, randomValues[2] ?? 0.5), 4_200, 42_000).toFixed(0)),
    soilMoisture: Number(clamp(jitter(previous('soilMoisture') + (actuators.waterPump.actual ? 1.6 : -0.35), 1.2, randomValues[3] ?? 0.5), 24, 72).toFixed(0)),
    co2: Number(clamp(jitter(previous('co2') + (actuators.fan.actual ? -8 : 6), 26, randomValues[4] ?? 0.5), 430, 1_250).toFixed(0)),
  };

  const nextSensors = structuredClone(sensors);
  const values = {} as Record<SensorKey, number | null>;

  for (const key of sensorKeys) {
    const device = devices.find((item) => item.sensorKeys?.includes(key));
    if (!device?.online) {
      values[key] = null;
      nextSensors[key] = { ...nextSensors[key], status: 'offline', quality: 'offline' };
      continue;
    }

    values[key] = candidates[key];
    nextSensors[key] = {
      ...nextSensors[key],
      status: 'live',
      quality: 'good',
      lastValue: candidates[key],
      lastUpdatedAt: now,
    };
  }

  return {
    reading: {
      time: date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      capturedAt: now,
      ...values,
    },
    sensors: nextSensors,
  };
}
