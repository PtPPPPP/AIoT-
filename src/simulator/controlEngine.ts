import {
  ActuatorStates,
  ControlMode,
  Device,
  DeviceStateKey,
  DeviceTargets,
  Reading,
  SensorStates,
} from '../types';
import { greenhousePolicy } from './policy';

export type ControlDecision = {
  targets: DeviceTargets;
  blockedReasons: Partial<Record<DeviceStateKey, string>>;
};

function hysteresis(value: number, start: number, stop: number, previous: boolean, startsBelow: boolean) {
  if (startsBelow) {
    if (value < start) return true;
    if (value > stop) return false;
  } else {
    if (value > start) return true;
    if (value < stop) return false;
  }
  return previous;
}

export function decideAutomaticTargets(
  reading: Reading,
  sensors: SensorStates,
  previous: DeviceTargets,
): ControlDecision {
  const targets = { ...previous };
  const blockedReasons: ControlDecision['blockedReasons'] = {};

  if (sensors.soilMoisture.quality === 'good' && reading.soilMoisture !== null) {
    targets.waterPump = hysteresis(
      reading.soilMoisture,
      greenhousePolicy.irrigationStartThreshold,
      greenhousePolicy.irrigationStopThreshold,
      previous.waterPump,
      true,
    );
  } else {
    blockedReasons.waterPump = '土壤湿度数据不可用，未下发新指令';
  }

  const fanDataReady = sensors.temperature.quality === 'good' && sensors.co2.quality === 'good'
    && reading.temperature !== null && reading.co2 !== null;
  if (fanDataReady) {
    const shouldStart = reading.temperature! > greenhousePolicy.fanStartTemperature || reading.co2! > greenhousePolicy.fanStartCo2;
    const shouldStop = reading.temperature! < greenhousePolicy.fanStopTemperature && reading.co2! < greenhousePolicy.fanStopCo2;
    targets.fan = shouldStart ? true : shouldStop ? false : previous.fan;
  } else {
    blockedReasons.fan = '温度或 CO₂ 数据不可用，未下发新指令';
  }

  if (sensors.light.quality === 'good' && reading.light !== null) {
    targets.growLight = hysteresis(
      reading.light,
      greenhousePolicy.growLightStartThreshold,
      greenhousePolicy.growLightStopThreshold,
      previous.growLight,
      true,
    );
    targets.shade = hysteresis(
      reading.light,
      greenhousePolicy.shadeStartThreshold,
      greenhousePolicy.shadeStopThreshold,
      previous.shade,
      false,
    );
  } else {
    blockedReasons.growLight = '光照数据不可用，未下发新指令';
    blockedReasons.shade = '光照数据不可用，未下发新指令';
  }

  return { targets, blockedReasons };
}

/** 只计算期望状态；实际状态只能由控制通道返回的结果更新。 */
export function planActuatorTargets(
  mode: ControlMode,
  automatic: ControlDecision,
  manualTargets: DeviceTargets,
  previous: ActuatorStates,
): ActuatorStates {
  const next = { ...previous };
  for (const key of Object.keys(previous) as DeviceStateKey[]) {
    const target = mode === 'auto' ? automatic.targets[key] : manualTargets[key];
    const sensorBlock = mode === 'auto' ? automatic.blockedReasons[key] : undefined;
    next[key] = {
      ...previous[key],
      target: sensorBlock ? previous[key].target : target,
      commandStatus: sensorBlock ? 'blocked' : previous[key].target === target && previous[key].commandStatus !== 'blocked' ? previous[key].commandStatus : 'applied',
      executionStatus: sensorBlock ? 'cancelled' : previous[key].target === target && previous[key].commandStatus !== 'blocked' ? previous[key].executionStatus : 'pending',
      ...(sensorBlock ? { blockedReason: sensorBlock } : {}),
    };
  }

  return next;
}

/** 模拟器的确定性执行回执；外部模式绝不调用此函数。 */
export function applySimulationResults(planned: ActuatorStates, devices: Device[]): ActuatorStates {
  const next = { ...planned };
  for (const key of Object.keys(planned) as DeviceStateKey[]) {
    const online = devices.some((device) => device.actuatorKey === key && device.online);
    const blocked = planned[key].commandStatus === 'blocked';
    next[key] = { ...planned[key], actual: online && !blocked ? planned[key].target : false, executionStatus: blocked ? planned[key].executionStatus : online ? 'succeeded' : 'rejected', commandStatus: blocked || !online ? 'blocked' : 'applied', ...(!online ? { blockedReason: '执行器离线，控制指令未执行' } : {}) };
  }
  return next;
}
