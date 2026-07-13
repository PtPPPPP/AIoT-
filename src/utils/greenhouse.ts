import { Alarm, DeviceStateKey, DeviceStates, Reading, RiskLevel } from '../types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const jitter = (value: number, spread: number) => value + (Math.random() - 0.5) * spread;

export function nextReading(current: Reading, devices: DeviceStates): Reading {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const daylight = Math.max(0.35, Math.sin((minutes - 360) / 720 * Math.PI));

  return {
    time: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    temperature: Number(clamp(jitter(current.temperature + (devices.fan ? -0.18 : 0.12), 1.1), 21, 36).toFixed(1)),
    humidity: Number(clamp(jitter(current.humidity + (devices.fan ? -0.25 : 0.15), 1.8), 42, 86).toFixed(0)),
    light: Number(clamp(jitter(9000 + daylight * 23000 + (devices.growLight ? 6500 : 0) - (devices.shade ? 9000 : 0), 2200), 4200, 42000).toFixed(0)),
    soilMoisture: Number(clamp(jitter(current.soilMoisture + (devices.waterPump ? 1.6 : -0.35), 1.2), 24, 72).toFixed(0)),
    co2: Number(clamp(jitter(current.co2 + (devices.fan ? -8 : 6), 26), 430, 1250).toFixed(0)),
  };
}

export function decideAutoDevices(reading: Reading): DeviceStates {
  return {
    waterPump: reading.soilMoisture < 40,
    fan: reading.temperature > 30.5 || reading.co2 > 980,
    growLight: reading.light < 12000,
    shade: reading.light > 33000,
  };
}

export function sensorRisk(key: keyof Omit<Reading, 'time'>, value: number): RiskLevel {
  if (key === 'temperature') return value > 33 ? '高风险' : value > 30.5 ? '中风险' : '正常';
  if (key === 'humidity') return value < 45 || value > 82 ? '中风险' : '正常';
  if (key === 'light') return value < 9000 || value > 36000 ? '中风险' : value < 12000 || value > 33000 ? '关注' : '正常';
  if (key === 'soilMoisture') return value < 32 ? '高风险' : value < 40 ? '中风险' : '正常';
  if (key === 'co2') return value > 1100 ? '高风险' : value > 980 ? '中风险' : '正常';
  return '正常';
}

export function newAlarmsFromReading(reading: Reading): Alarm[] {
  const now = reading.time;
  const alarms: Alarm[] = [];

  if (reading.soilMoisture < 34) {
    alarms.push(makeAlarm(now, '土壤缺水', 'SEN-S-03', '高风险', `土壤湿度降至 ${reading.soilMoisture}%，水泵应立即开启。`));
  }
  if (reading.temperature > 32.5) {
    alarms.push(makeAlarm(now, '温度过高', 'SEN-T-01', '中风险', `棚内温度 ${reading.temperature}°C，建议排风降温。`));
  }
  if (reading.light < 9500) {
    alarms.push(makeAlarm(now, '光照不足', 'SEN-L-02', '关注', `光照仅 ${reading.light} lux，建议补光。`));
  }
  if (reading.co2 > 1120) {
    alarms.push(makeAlarm(now, 'CO₂偏高', 'SEN-C-04', '中风险', `CO₂浓度 ${reading.co2} ppm，建议通风。`));
  }

  return alarms;
}

function makeAlarm(time: string, type: string, source: string, level: Alarm['level'], message: string): Alarm {
  return {
    id: `${Date.now()}-${type}-${Math.random().toString(16).slice(2)}`,
    time,
    type,
    source,
    level,
    message,
    handled: false,
  };
}

export const deviceLabels: Record<DeviceStateKey, string> = {
  waterPump: '滴灌水泵',
  fan: '排风风扇',
  growLight: 'LED补光灯',
  shade: '遮阳设备',
};
