import { AnalogInputMapping, DigitalInputMapping, DigitalOutputMapping } from './types';

/** 仅为项目规划示例。实际通道、输入类型、量程和换算关系必须根据最终接线及研华配置确认。 */
export const wise4012ExampleMappings: AnalogInputMapping[] = [
  { logicalKey: 'soilMoisture', deviceId: 'WISE-4012-01', model: 'WISE-4012', channelType: 'analog-input', channelIndex: 0, rawRange: [4, 20], engineeringRange: [0, 100], unit: '%', scale: 6.25, offset: -25, enabled: false },
  { logicalKey: 'temperature', deviceId: 'WISE-4012-01', model: 'WISE-4012', channelType: 'analog-input', channelIndex: 1, rawRange: [4, 20], engineeringRange: [-20, 60], unit: '°C', enabled: false },
  { logicalKey: 'humidity', deviceId: 'WISE-4012-01', model: 'WISE-4012', channelType: 'analog-input', channelIndex: 2, rawRange: [4, 20], engineeringRange: [0, 100], unit: '%', enabled: false },
  { logicalKey: 'co2', deviceId: 'WISE-4012-01', model: 'WISE-4012', channelType: 'analog-input', channelIndex: 3, rawRange: [4, 20], engineeringRange: [0, 2000], unit: 'ppm', enabled: false },
  { logicalKey: 'light', deviceId: 'WISE-4012-01', model: 'WISE-4012', channelType: 'unassigned', unit: 'lux', enabled: false },
];
export const adam6050OutputExampleMappings: DigitalOutputMapping[] = [
  { logicalDevice: 'waterPump', deviceId: 'ADAM-6050-01', model: 'ADAM-6050', outputChannel: 0, activeHigh: true, safeState: false, enabled: false },
  { logicalDevice: 'fan', deviceId: 'ADAM-6050-01', model: 'ADAM-6050', outputChannel: 1, activeHigh: true, safeState: false, enabled: false },
  { logicalDevice: 'growLight', deviceId: 'ADAM-6050-01', model: 'ADAM-6050', outputChannel: 2, activeHigh: true, safeState: false, enabled: false },
  { logicalDevice: 'shade', deviceId: 'ADAM-6050-01', model: 'ADAM-6050', activeHigh: true, safeState: false, enabled: false, extendChannel: 3, retractChannel: 4, interlockGroup: 'shade-motion' },
];
export const adam6050InputExampleMappings: DigitalInputMapping[] = [
  { logicalInput: 'waterPumpRunning', deviceId: 'ADAM-6050-01', model: 'ADAM-6050', enabled: false }, { logicalInput: 'fanRunning', deviceId: 'ADAM-6050-01', model: 'ADAM-6050', enabled: false }, { logicalInput: 'shadeExtendedLimit', deviceId: 'ADAM-6050-01', model: 'ADAM-6050', enabled: false }, { logicalInput: 'shadeRetractedLimit', deviceId: 'ADAM-6050-01', model: 'ADAM-6050', enabled: false }, { logicalInput: 'lowWaterLevel', deviceId: 'ADAM-6050-01', model: 'ADAM-6050', enabled: false }, { logicalInput: 'emergencyStop', deviceId: 'ADAM-6050-01', model: 'ADAM-6050', enabled: false }, { logicalInput: 'deviceFault', deviceId: 'ADAM-6050-01', model: 'ADAM-6050', enabled: false },
];
