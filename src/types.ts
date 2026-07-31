import type { AiInferenceProvider, EdgeNodeType } from './config/edgeNodeConfig';

export type PageKey =
  | 'dashboard'
  | 'environment'
  | 'control'
  | 'ai'
  | 'alerts'
  | 'devices'
  | 'intro';

export type RiskLevel = '正常' | '关注' | '中风险' | '高风险' | '不可用';

export type SensorKey = 'temperature' | 'humidity' | 'light' | 'soilMoisture' | 'co2';

export type DeviceKind = 'sensor' | 'camera' | 'actuator' | 'gateway';

export type DeviceStateKey = 'waterPump' | 'fan' | 'growLight' | 'shade';

export type Device = {
  id: string;
  name: string;
  kind: DeviceKind;
  location: string;
  online: boolean;
  battery?: number;
  updatedAt: string;
  sensorKeys?: SensorKey[];
  actuatorKey?: DeviceStateKey;
};

export type Reading = {
  time: string;
  capturedAt: string;
  temperature: number | null;
  humidity: number | null;
  light: number | null;
  soilMoisture: number | null;
  co2: number | null;
};

export type SensorState = {
  sourceId: string;
  status: 'live' | 'offline';
  quality: SensorQuality;
  lastValue: number;
  lastUpdatedAt: string;
};

export type SensorQuality = 'good' | 'stale' | 'offline' | 'invalid' | 'error';
export type ChannelStatus = 'unconfigured' | 'connecting' | 'connected' | 'degraded' | 'disconnected' | 'failed' | 'stale' | 'partial-offline';
export type RuntimeMode = 'simulation' | 'external' | 'playback';

export type SensorStates = Record<SensorKey, SensorState>;

export type ActuatorState = {
  target: boolean;
  actual: boolean;
  actualKnown: boolean;
  commandStatus: 'applied' | 'blocked';
  executionStatus: 'pending' | 'sent' | 'acknowledged' | 'succeeded' | 'failed' | 'timed_out' | 'rejected' | 'cancelled';
  blockedReason?: string;
};

export type ActuatorStates = Record<DeviceStateKey, ActuatorState>;
export type DeviceTargets = Record<DeviceStateKey, boolean>;
export type ControlMode = 'auto' | 'manual';

export type AlarmLevel = 'info' | 'warning' | 'critical';
export type AlarmStatus = 'active' | 'acknowledged' | 'resolved';

export type Alarm = {
  id: string;
  type: string;
  sourceId: string;
  level: AlarmLevel;
  title: string;
  description: string;
  status: AlarmStatus;
  firstTriggeredAt: string;
  lastTriggeredAt: string;
  occurrenceCount: number;
  resolvedAt?: string;
  source?: 'simulation' | 'external';
  scenario?: PresentationScenarioId;
  simulationStep?: number;
  handlingResult?: string;
};

export type DemoScenarioId = 'healthy' | 'early-risk' | 'severe-risk';

export type PresentationScenarioId = 'normal' | 'soil-drought' | 'high-heat-co2' | 'sensor-offline' | 'water-pump-failure';
export type PresentationRunStatus = 'running' | 'paused';
export type PresentationFault = 'none' | 'soil-sensor-offline' | 'water-pump-offline';

export type PresentationState = {
  scenarioId: PresentationScenarioId;
  runStatus: PresentationRunStatus;
  step: number;
  seed: string;
  randomState: number;
  stage: string;
  fault: PresentationFault;
};

export type RecognitionResult = {
  mode: 'demo' | 'remote';
  label: string;
  confidence: number | null;
  severity: 'info' | 'warning' | 'critical';
  description: string;
  recommendations: string[];
  processingTimeMs: number;
  contentFingerprint: string;
};

export interface RecognitionAdapter {
  recognize(file: File, scenario: DemoScenarioId): Promise<RecognitionResult>;
}

export type EfficiencyCounters = {
  sampleCount: number;
  baselineWaterSeconds: number;
  actualWaterSeconds: number;
  baselineEnergyWh: number;
  actualEnergyWh: number;
};

export type EfficiencyMetrics = {
  waterSaving: number | null;
  energySaving: number | null;
  explanation: string;
};

export type SimulatorState = {
  reading: Reading;
  history: Reading[];
  sensors: SensorStates;
  devices: Device[];
  actuators: ActuatorStates;
  manualTargets: DeviceTargets;
  controlMode: ControlMode;
  alarms: Alarm[];
  efficiency: EfficiencyCounters;
  irrigationCount: number;
  demoScenario: DemoScenarioId;
  presentation: PresentationState;
  runtime: {
    mode: RuntimeMode;
    edgeNodeType: EdgeNodeType;
    edgeNodeName: string;
    dataChannelStatus: ChannelStatus;
    controlChannelStatus: ChannelStatus;
    dataSourceLabel: string;
    controlSourceLabel: string;
    aiProvider: AiInferenceProvider;
    aiSourceLabel: string;
    externalInitialSyncStatus: 'idle' | 'checking_health' | 'syncing_actuators' | 'ready' | 'failed';
    controlArmed: boolean;
    lastHealthCheckAt?: string;
    lastValidDataAt?: string;
  };
  operationLog: OperationLogEntry[];
  lastUpdatedAt: string;
};

export type OperationLogEntry = {
  id: string;
  at: string;
  simulationStep: number;
  type: string;
  source: 'user' | 'system';
  target: string;
  before: string;
  after: string;
  result: 'succeeded' | 'failed' | 'rejected';
  errorCode?: string;
};
