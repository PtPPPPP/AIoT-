import { AnalogInputMapping, DigitalInputMapping, DigitalOutputMapping } from './types';

/** 仅为禁用的规划示例。通道从 0 开始编号，量程、有效电平与安全状态须按最终接线确认。 */
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
  { logicalInput: 'waterPumpRunning', deviceId: 'ADAM-6050-01', model: 'ADAM-6050', inputChannel: 0, enabled: false },
  { logicalInput: 'fanRunning', deviceId: 'ADAM-6050-01', model: 'ADAM-6050', inputChannel: 1, enabled: false },
  { logicalInput: 'shadeExtendedLimit', deviceId: 'ADAM-6050-01', model: 'ADAM-6050', inputChannel: 2, enabled: false },
  { logicalInput: 'shadeRetractedLimit', deviceId: 'ADAM-6050-01', model: 'ADAM-6050', inputChannel: 3, enabled: false },
  { logicalInput: 'lowWaterLevel', deviceId: 'ADAM-6050-01', model: 'ADAM-6050', inputChannel: 4, enabled: false },
  { logicalInput: 'emergencyStop', deviceId: 'ADAM-6050-01', model: 'ADAM-6050', inputChannel: 5, enabled: false },
  { logicalInput: 'deviceFault', deviceId: 'ADAM-6050-01', model: 'ADAM-6050', inputChannel: 6, enabled: false },
];
