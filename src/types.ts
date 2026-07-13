export type PageKey =
  | 'dashboard'
  | 'environment'
  | 'control'
  | 'ai'
  | 'alerts'
  | 'devices'
  | 'intro';

export type RiskLevel = '正常' | '关注' | '中风险' | '高风险';

export type DeviceKind = 'sensor' | 'camera' | 'actuator' | 'gateway';

export type Device = {
  id: string;
  name: string;
  kind: DeviceKind;
  location: string;
  online: boolean;
  battery?: number;
  running?: boolean;
  updatedAt: string;
};

export type DeviceStateKey = 'waterPump' | 'fan' | 'growLight' | 'shade';

export type DeviceStates = Record<DeviceStateKey, boolean>;

export type Reading = {
  time: string;
  temperature: number;
  humidity: number;
  light: number;
  soilMoisture: number;
  co2: number;
};

export type Alarm = {
  id: string;
  time: string;
  type: string;
  source: string;
  level: Exclude<RiskLevel, '正常'>;
  message: string;
  handled: boolean;
};

export type AiResult = {
  crop: string;
  growth: string;
  health: number;
  disease: string;
  risk: RiskLevel;
  suggestion: string;
};
