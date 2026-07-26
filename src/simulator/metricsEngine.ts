import { ActuatorStates, EfficiencyCounters, EfficiencyMetrics, Reading } from '../types';
import { simulationIntervalMs } from './policy';

const devicePowerWatts = {
  waterPump: 120,
  fan: 90,
  growLight: 150,
  shade: 40,
};

const secondsPerTick = simulationIntervalMs / 1_000;

export const emptyEfficiencyCounters: EfficiencyCounters = {
  sampleCount: 0,
  baselineWaterSeconds: 0,
  actualWaterSeconds: 0,
  baselineEnergyWh: 0,
  actualEnergyWh: 0,
};

export function updateEfficiencyCounters(
  current: EfficiencyCounters,
  reading: Reading,
  actuators: ActuatorStates,
): EfficiencyCounters {
  const baselineTargets = {
    waterPump: reading.soilMoisture !== null && reading.soilMoisture < 45,
    fan: reading.temperature !== null && reading.temperature > 28,
    growLight: reading.light !== null && reading.light < 16_000,
    shade: reading.light !== null && reading.light > 29_000,
  };
  const baselineEnergyWh = Object.entries(devicePowerWatts).reduce((sum, [key, watts]) => (
    sum + (baselineTargets[key as keyof typeof baselineTargets] ? watts * secondsPerTick / 3_600 : 0)
  ), 0);
  const actualEnergyWh = Object.entries(devicePowerWatts).reduce((sum, [key, watts]) => (
    sum + (actuators[key as keyof ActuatorStates].actual ? watts * secondsPerTick / 3_600 : 0)
  ), 0);

  return {
    sampleCount: current.sampleCount + 1,
    baselineWaterSeconds: current.baselineWaterSeconds + (baselineTargets.waterPump ? secondsPerTick : 0),
    actualWaterSeconds: current.actualWaterSeconds + (actuators.waterPump.actual ? secondsPerTick : 0),
    baselineEnergyWh: current.baselineEnergyWh + baselineEnergyWh,
    actualEnergyWh: current.actualEnergyWh + actualEnergyWh,
  };
}

function savingRate(baseline: number, actual: number) {
  if (baseline <= 0) return null;
  return Math.round(((baseline - actual) / baseline) * 100);
}

export function calculateEfficiencyMetrics(counters: EfficiencyCounters): EfficiencyMetrics {
  if (counters.sampleCount < 5) {
    return {
      waterSaving: null,
      energySaving: null,
      explanation: '至少需要 5 个模拟周期才显示策略估算，当前数据不足。',
    };
  }

  return {
    waterSaving: savingRate(counters.baselineWaterSeconds, counters.actualWaterSeconds),
    energySaving: savingRate(counters.baselineEnergyWh, counters.actualEnergyWh),
    explanation: '基于同期“宽松阈值基线”与当前回差控制策略的设备运行时长、模拟功率对比，不是现场计量数据。',
  };
}
