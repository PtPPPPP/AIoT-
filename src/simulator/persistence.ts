import { Alarm, ControlMode, DemoScenarioId, DeviceTargets, EfficiencyCounters, PresentationState, SimulatorState } from '../types';

export const persistenceKey = 'aiot-greenhouse-demo-state';
export const persistenceVersion = 2;

type PersistedState = {
  version: 2;
  savedAt: string;
  controlMode: ControlMode;
  manualTargets: DeviceTargets;
  deviceOnline: Record<string, boolean>;
  alarms: Alarm[];
  demoScenario: DemoScenarioId;
  efficiency: EfficiencyCounters;
  irrigationCount: number;
  presentation: PresentationState;
  recentState: Pick<SimulatorState, 'reading' | 'sensors' | 'actuators' | 'lastUpdatedAt'>;
};

const isPresentation = (value: unknown): value is PresentationState => {
  if (typeof value !== 'object' || value === null) return false;
  const presentation = value as Partial<PresentationState>;
  return ['normal', 'soil-drought', 'high-heat-co2', 'sensor-offline', 'water-pump-failure'].includes(presentation.scenarioId ?? '')
    && ['running', 'paused'].includes(presentation.runStatus ?? '')
    && typeof presentation.step === 'number' && Number.isInteger(presentation.step) && presentation.step >= 0
    && typeof presentation.seed === 'string' && presentation.seed.length > 0
    && typeof presentation.randomState === 'number' && Number.isFinite(presentation.randomState)
    && typeof presentation.stage === 'string'
    && ['none', 'soil-sensor-offline', 'water-pump-offline'].includes(presentation.fault ?? '');
};

const isBooleanRecord = (value: unknown): value is Record<string, boolean> => (
  typeof value === 'object' && value !== null
  && Object.values(value).every((item) => typeof item === 'boolean')
);

const isTargets = (value: unknown): value is DeviceTargets => {
  if (!isBooleanRecord(value)) return false;
  return ['waterPump', 'fan', 'growLight', 'shade'].every((key) => typeof value[key] === 'boolean');
};

const isAlarm = (value: unknown): value is Alarm => {
  if (typeof value !== 'object' || value === null) return false;
  const alarm = value as Partial<Alarm>;
  return typeof alarm.id === 'string'
    && typeof alarm.type === 'string'
    && typeof alarm.sourceId === 'string'
    && ['info', 'warning', 'critical'].includes(alarm.level ?? '')
    && ['active', 'acknowledged', 'resolved'].includes(alarm.status ?? '')
    && typeof alarm.occurrenceCount === 'number';
};

const isFiniteNumberOrNull = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value));

const isRecentState = (value: unknown): value is PersistedState['recentState'] => {
  if (typeof value !== 'object' || value === null) return false;
  const recent = value as Partial<PersistedState['recentState']>;
  const reading = recent.reading as Record<string, unknown> | undefined;
  const sensors = recent.sensors as Record<string, unknown> | undefined;
  const actuators = recent.actuators as Record<string, unknown> | undefined;
  if (!reading || !sensors || !actuators || typeof recent.lastUpdatedAt !== 'string') return false;
  if (typeof reading.time !== 'string' || typeof reading.capturedAt !== 'string') return false;
  if (!['temperature', 'humidity', 'light', 'soilMoisture', 'co2'].every((key) => isFiniteNumberOrNull(reading[key]))) return false;
  if (!['temperature', 'humidity', 'light', 'soilMoisture', 'co2'].every((key) => {
    const sensor = sensors[key] as Record<string, unknown> | undefined;
    return sensor && typeof sensor.sourceId === 'string' && ['live', 'offline'].includes(String(sensor.status))
      && typeof sensor.lastValue === 'number' && typeof sensor.lastUpdatedAt === 'string';
  })) return false;
  return ['waterPump', 'fan', 'growLight', 'shade'].every((key) => {
    const actuator = actuators[key] as Record<string, unknown> | undefined;
    return actuator && typeof actuator.target === 'boolean' && typeof actuator.actual === 'boolean'
      && ['applied', 'blocked'].includes(String(actuator.commandStatus));
  });
};

export function serializeState(state: SimulatorState): string {
  const payload: PersistedState = {
    version: persistenceVersion,
    savedAt: new Date().toISOString(),
    controlMode: state.controlMode,
    manualTargets: state.manualTargets,
    deviceOnline: Object.fromEntries(state.devices.map((device) => [device.id, device.online])),
    alarms: state.alarms,
    demoScenario: state.demoScenario,
    efficiency: state.efficiency,
    irrigationCount: state.irrigationCount,
    presentation: state.presentation,
    recentState: {
      reading: state.reading,
      sensors: state.sensors,
      actuators: state.actuators,
      lastUpdatedAt: state.lastUpdatedAt,
    },
  };
  return JSON.stringify(payload);
}

export function restoreState(initial: SimulatorState, raw: string | null): SimulatorState {
  if (!raw) return initial;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (parsed.version !== persistenceVersion) return initial;
    if (parsed.controlMode !== 'auto' && parsed.controlMode !== 'manual') return initial;
    if (!isTargets(parsed.manualTargets) || !isBooleanRecord(parsed.deviceOnline)) return initial;
    if (!Array.isArray(parsed.alarms) || !parsed.alarms.every(isAlarm)) return initial;
    if (!['healthy', 'early-risk', 'severe-risk'].includes(parsed.demoScenario ?? '')) return initial;
    if (!isRecentState(parsed.recentState)) return initial;
    if (!isPresentation(parsed.presentation)) return initial;
    if (!parsed.efficiency || typeof parsed.efficiency.sampleCount !== 'number'
      || typeof parsed.efficiency.baselineWaterSeconds !== 'number'
      || typeof parsed.efficiency.actualWaterSeconds !== 'number'
      || typeof parsed.efficiency.baselineEnergyWh !== 'number'
      || typeof parsed.efficiency.actualEnergyWh !== 'number') return initial;

    return {
      ...initial,
      controlMode: parsed.controlMode,
      manualTargets: parsed.manualTargets,
      devices: initial.devices.map((device) => ({
        ...device,
        online: parsed.deviceOnline?.[device.id] ?? device.online,
      })),
      alarms: parsed.alarms,
      demoScenario: parsed.demoScenario!,
      efficiency: parsed.efficiency,
      irrigationCount: typeof parsed.irrigationCount === 'number' ? parsed.irrigationCount : 0,
      presentation: parsed.presentation,
      reading: parsed.recentState.reading,
      sensors: parsed.recentState.sensors,
      actuators: parsed.recentState.actuators,
      lastUpdatedAt: parsed.recentState.lastUpdatedAt,
    };
  } catch {
    return initial;
  }
}

export function saveState(storage: Pick<Storage, 'setItem'>, state: SimulatorState): boolean {
  try {
    storage.setItem(persistenceKey, serializeState(state));
    return true;
  } catch {
    return false;
  }
}
