import { ActuatorStates, Alarm, AlarmLevel, Device, Reading, RecognitionResult, SensorStates } from '../types';
import { actuatorDeviceIds, deviceLabels, greenhousePolicy, sensorLabels } from './policy';

export type AlarmCondition = {
  type: string;
  sourceId: string;
  level: AlarmLevel;
  title: string;
  description: string;
};

const alarmId = (condition: Pick<AlarmCondition, 'type' | 'sourceId'>) => `${condition.type}:${condition.sourceId}`;

export function collectSystemAlarmConditions(
  reading: Reading,
  sensors: SensorStates,
  devices: Device[],
  actuators: ActuatorStates,
): AlarmCondition[] {
  const conditions: AlarmCondition[] = [];

  for (const device of devices.filter((item) => !item.online)) {
    conditions.push({
      type: device.kind === 'sensor' ? 'sensor-offline' : device.kind === 'actuator' ? 'actuator-offline' : 'device-offline',
      sourceId: device.id,
      level: device.kind === 'gateway' ? 'critical' : 'warning',
      title: `${device.name}离线`,
      description: `${device.location}的${device.name}已中断，系统不会将其视为正常实时设备。`,
    });
  }

  for (const [key, sensor] of Object.entries(sensors) as Array<[keyof SensorStates, SensorStates[keyof SensorStates]]>) {
    if (sensor.status === 'offline') continue;
    const value = reading[key];
    if (value === null) continue;
    if (key === 'soilMoisture' && value < greenhousePolicy.soilMoistureWarningThreshold) {
      conditions.push({ type: 'environment-soil-moisture', sourceId: sensor.sourceId, level: 'critical', title: '土壤湿度过低', description: `土壤湿度为 ${value}%，低于 ${greenhousePolicy.soilMoistureWarningThreshold}% 告警阈值。` });
    }
    if (key === 'temperature' && value > greenhousePolicy.alarmThresholds.highTemperature) {
      conditions.push({ type: 'environment-temperature', sourceId: sensor.sourceId, level: 'warning', title: '棚内温度过高', description: `温度为 ${value}°C，超过 ${greenhousePolicy.alarmThresholds.highTemperature}°C 告警阈值。` });
    }
    if (key === 'light' && value < greenhousePolicy.alarmThresholds.lowLight) {
      conditions.push({ type: 'environment-light', sourceId: sensor.sourceId, level: 'info', title: '光照不足', description: `光照为 ${value.toLocaleString()} lux，低于 ${greenhousePolicy.alarmThresholds.lowLight.toLocaleString()} lux 告警阈值。` });
    }
    if (key === 'co2' && value > greenhousePolicy.alarmThresholds.highCo2) {
      conditions.push({ type: 'environment-co2', sourceId: sensor.sourceId, level: 'warning', title: 'CO₂浓度过高', description: `CO₂ 为 ${value} ppm，超过 ${greenhousePolicy.alarmThresholds.highCo2} ppm 告警阈值。` });
    }
  }

  for (const [key, state] of Object.entries(actuators) as Array<[keyof ActuatorStates, ActuatorStates[keyof ActuatorStates]]>) {
    if (state.target && !state.actual) {
      conditions.push({
        type: 'control-failure',
        sourceId: actuatorDeviceIds[key],
        level: key === 'waterPump' ? 'critical' : 'warning',
        title: `${deviceLabels[key]}控制失败`,
        description: state.blockedReason ?? `目标状态为开启，但${deviceLabels[key]}未实际运行。`,
      });
    }
  }

  return conditions;
}

export function reconcileSystemAlarms(current: Alarm[], conditions: AlarmCondition[], now: string): Alarm[] {
  const activeIds = new Set(conditions.map(alarmId));
  const systemTypes = new Set([
    'sensor-offline', 'actuator-offline', 'device-offline', 'control-failure',
    'environment-soil-moisture', 'environment-temperature', 'environment-light', 'environment-co2',
  ]);
  const byId = new Map(current.map((alarm) => [alarm.id, alarm]));

  for (const condition of conditions) {
    const id = alarmId(condition);
    const existing = byId.get(id);
    if (existing && existing.status !== 'resolved') {
      byId.set(id, {
        ...existing,
        level: condition.level,
        title: condition.title,
        description: condition.description,
        lastTriggeredAt: now,
        occurrenceCount: existing.occurrenceCount + 1,
      });
    } else {
      byId.set(id, {
        id,
        ...condition,
        status: 'active',
        firstTriggeredAt: now,
        lastTriggeredAt: now,
        occurrenceCount: (existing?.occurrenceCount ?? 0) + 1,
      });
    }
  }

  for (const [id, alarm] of byId) {
    if (systemTypes.has(alarm.type) && !activeIds.has(id) && alarm.status !== 'resolved') {
      byId.set(id, { ...alarm, status: 'resolved', resolvedAt: now });
    }
  }

  return [...byId.values()].sort((left, right) => right.lastTriggeredAt.localeCompare(left.lastTriggeredAt)).slice(0, 40);
}

export function acknowledgeAlarm(alarms: Alarm[], id: string): Alarm[] {
  return alarms.map((alarm) => alarm.id === id && alarm.status === 'active'
    ? { ...alarm, status: 'acknowledged' }
    : alarm);
}

export function applyRecognitionAlarm(alarms: Alarm[], result: RecognitionResult, now: string): Alarm[] {
  const id = 'ai-recognition-risk:CAM-AI-01';
  const existing = alarms.find((alarm) => alarm.id === id);
  if (result.severity === 'info') {
    return alarms.map((alarm) => alarm.id === id && alarm.status !== 'resolved'
      ? { ...alarm, status: 'resolved', resolvedAt: now }
      : alarm);
  }
  const alarm: Alarm = {
    id,
    type: 'ai-recognition-risk',
    sourceId: 'CAM-AI-01',
    level: result.severity,
    title: '演示识别场景风险',
    description: `当前为演示场景：${result.label}。${result.description}`,
    status: existing?.status === 'acknowledged' ? 'acknowledged' : 'active',
    firstTriggeredAt: existing?.firstTriggeredAt ?? now,
    lastTriggeredAt: now,
    occurrenceCount: (existing?.occurrenceCount ?? 0) + 1,
  };
  return [alarm, ...alarms.filter((item) => item.id !== id)].slice(0, 40);
}

export function unavailableSensorDescription(key: keyof SensorStates, sensors: SensorStates) {
  const sensor = sensors[key];
  return `${sensorLabels[key]}数据不可用，最后有效值 ${sensor.lastValue}，更新于 ${sensor.lastUpdatedAt}`;
}
