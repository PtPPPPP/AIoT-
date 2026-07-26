import {
  ActuatorStates,
  ControlMode,
  Device,
  DeviceStateKey,
  DeviceTargets,
  Reading,
  SensorStates,
} from '../types';
import { actuatorDeviceIds, greenhousePolicy } from './policy';
import { SimulationControlChannel } from '../channels/control/SimulationControlChannel';

const simulationControlChannel = new SimulationControlChannel();

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

export function applyControlDecision(
  mode: ControlMode,
  automatic: ControlDecision,
  manualTargets: DeviceTargets,
  devices: Device[],
  previous: ActuatorStates,
): ActuatorStates {
  const next = {} as ActuatorStates;
  const keys = Object.keys(actuatorDeviceIds) as DeviceStateKey[];

  for (const key of keys) {
    const target = mode === 'auto' ? automatic.targets[key] : manualTargets[key];
    const deviceOnline = devices.some((device) => device.id === actuatorDeviceIds[key] && device.online);
    const sensorBlock = mode === 'auto' ? automatic.blockedReasons[key] : undefined;
    const blockedReason = !deviceOnline ? '执行器离线，控制指令未执行' : sensorBlock;
    const command = simulationControlChannel.executeNow({
      id: `${key}:${Date.now()}`, device: key, target, source: mode === 'auto' ? 'auto-policy' : 'manual',
      createdAt: new Date().toISOString(), timeoutAt: new Date(Date.now() + 3_000).toISOString(), scenario: 'normal', idempotencyKey: `${key}:${target}:${mode}`,
    }, deviceOnline);

    next[key] = {
      target: sensorBlock ? previous[key].target : target,
      actual: deviceOnline && !sensorBlock ? command.actual : deviceOnline ? previous[key].actual : false,
      commandStatus: blockedReason ? 'blocked' : 'applied',
      executionStatus: blockedReason ? (sensorBlock ? 'cancelled' : command.status) : command.status,
      ...(blockedReason ? { blockedReason } : {}),
    };
  }

  return next;
}
