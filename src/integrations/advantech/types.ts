import { DeviceStateKey, SensorKey } from '../../types';

export type Wise4012InputChannel = 0 | 1 | 2 | 3;
export type Adam6050OutputChannel = 0 | 1 | 2 | 3 | 4 | 5;
export type Adam6050InputChannel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type AnalogInputMapping = { logicalKey: SensorKey; deviceId: string; model: 'WISE-4012'; channelType: 'analog-input' | 'unassigned'; channelIndex?: Wise4012InputChannel; rawRange?: [number, number]; engineeringRange?: [number, number]; unit: string; scale?: number; offset?: number; enabled: boolean };
export type DigitalOutputMapping = { logicalDevice: DeviceStateKey; deviceId: string; model: 'ADAM-6050'; outputChannel?: Adam6050OutputChannel; activeHigh: boolean; feedbackInputChannel?: Adam6050InputChannel; interlockGroup?: string; safeState: boolean; enabled: boolean; extendChannel?: Adam6050OutputChannel; retractChannel?: Adam6050OutputChannel };
export type DigitalInputMapping = { logicalInput: 'waterPumpRunning' | 'fanRunning' | 'shadeExtendedLimit' | 'shadeRetractedLimit' | 'lowWaterLevel' | 'emergencyStop' | 'deviceFault'; deviceId: string; model: 'ADAM-6050'; inputChannel?: Adam6050InputChannel; enabled: boolean };
