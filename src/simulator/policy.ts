import { DeviceStateKey, SensorKey } from '../types';

export interface GreenhousePolicy {
  irrigationStartThreshold: number;
  irrigationStopThreshold: number;
  soilMoistureWarningThreshold: number;
  fanStartTemperature: number;
  fanStopTemperature: number;
  fanStartCo2: number;
  fanStopCo2: number;
  growLightStartThreshold: number;
  growLightStopThreshold: number;
  shadeStartThreshold: number;
  shadeStopThreshold: number;
  alarmThresholds: {
    highTemperature: number;
    lowLight: number;
    highCo2: number;
  };
}

export const greenhousePolicy: GreenhousePolicy = {
  irrigationStartThreshold: 36,
  irrigationStopThreshold: 45,
  soilMoistureWarningThreshold: 34,
  fanStartTemperature: 31,
  fanStopTemperature: 28.5,
  fanStartCo2: 980,
  fanStopCo2: 850,
  growLightStartThreshold: 12_000,
  growLightStopThreshold: 16_000,
  shadeStartThreshold: 33_000,
  shadeStopThreshold: 29_000,
  alarmThresholds: {
    highTemperature: 32.5,
    lowLight: 9_500,
    highCo2: 1_120,
  },
};

export const sensorLabels: Record<SensorKey, string> = {
  temperature: '温度',
  humidity: '空气湿度',
  light: '光照强度',
  soilMoisture: '土壤湿度',
  co2: 'CO₂浓度',
};

export const deviceLabels: Record<DeviceStateKey, string> = {
  waterPump: '滴灌水泵',
  fan: '排风风扇',
  growLight: 'LED补光灯',
  shade: '遮阳设备',
};

export const actuatorDeviceIds: Record<DeviceStateKey, string> = {
  waterPump: 'ACT-P-01',
  fan: 'ACT-F-02',
  growLight: 'ACT-L-03',
  shade: 'ACT-S-04',
};

export const simulationIntervalMs = 2_600;

export const policyDescriptions = [
  {
    key: 'waterPump' as const,
    rule: `土壤湿度低于 ${greenhousePolicy.irrigationStartThreshold}%`,
    action: '自动开启滴灌水泵',
    target: `补水至 ${greenhousePolicy.irrigationStopThreshold}% 后关闭，使用启停回差`,
  },
  {
    key: 'fan' as const,
    rule: `温度高于 ${greenhousePolicy.fanStartTemperature}°C 或 CO₂ 高于 ${greenhousePolicy.fanStartCo2} ppm`,
    action: '自动开启排风风扇',
    target: '两项数据回到停止阈值后关闭',
  },
  {
    key: 'growLight' as const,
    rule: `光照低于 ${greenhousePolicy.growLightStartThreshold.toLocaleString()} lux`,
    action: '自动开启 LED 补光灯',
    target: `光照恢复至 ${greenhousePolicy.growLightStopThreshold.toLocaleString()} lux 后关闭`,
  },
  {
    key: 'shade' as const,
    rule: `光照高于 ${greenhousePolicy.shadeStartThreshold.toLocaleString()} lux`,
    action: '自动放下遮阳设备',
    target: `光照降至 ${greenhousePolicy.shadeStopThreshold.toLocaleString()} lux 后收回`,
  },
];
