import { DeviceStateKey, SensorKey } from '../../types';

export type AnalogInputMapping = { logicalKey: SensorKey; deviceId: string; model: 'WISE-4012'; channelType: 'analog-input' | 'unassigned'; channelIndex?: number; rawRange?: [number, number]; engineeringRange?: [number, number]; unit: string; scale?: number; offset?: number; enabled: boolean };
export type DigitalOutputMapping = { logicalDevice: DeviceStateKey; deviceId: string; model: 'ADAM-6050'; outputChannel?: number; activeHigh: boolean; feedbackInputChannel?: number; interlockGroup?: string; safeState: boolean; enabled: boolean; extendChannel?: number; retractChannel?: number };
export type DigitalInputMapping = { logicalInput: 'waterPumpRunning' | 'fanRunning' | 'shadeExtendedLimit' | 'shadeRetractedLimit' | 'lowWaterLevel' | 'emergencyStop' | 'deviceFault'; deviceId: string; model: 'ADAM-6050'; inputChannel?: number; enabled: boolean };
