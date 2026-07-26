import { Reading, RiskLevel, SensorKey } from '../types';
import { greenhousePolicy } from '../simulator/policy';

export function sensorRisk(key: SensorKey, value: Reading[SensorKey]): RiskLevel {
  if (value === null) return '不可用';
  if (key === 'temperature') return value > greenhousePolicy.alarmThresholds.highTemperature ? '高风险' : value > greenhousePolicy.fanStartTemperature ? '中风险' : '正常';
  if (key === 'humidity') return value < 45 || value > 82 ? '中风险' : '正常';
  if (key === 'light') {
    if (value < greenhousePolicy.alarmThresholds.lowLight || value > 36_000) return '中风险';
    if (value < greenhousePolicy.growLightStartThreshold || value > greenhousePolicy.shadeStartThreshold) return '关注';
    return '正常';
  }
  if (key === 'soilMoisture') return value < greenhousePolicy.soilMoistureWarningThreshold ? '高风险' : value < greenhousePolicy.irrigationStartThreshold ? '中风险' : '正常';
  if (key === 'co2') return value > greenhousePolicy.alarmThresholds.highCo2 ? '高风险' : value > greenhousePolicy.fanStartCo2 ? '中风险' : '正常';
  return '正常';
}

export function formatReading(value: number | null, unit = '') {
  return value === null ? '暂无数据' : `${value.toLocaleString()}${unit}`;
}

export function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString('zh-CN', { hour12: false });
}
