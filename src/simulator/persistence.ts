import { Alarm, ControlMode, DemoScenarioId, DeviceTargets, EfficiencyCounters, PresentationState, SimulatorState } from '../types';

export const persistenceKey = 'aiot-greenhouse-demo-state';
export const persistenceVersion = 2;
export function storageKey(mode: SimulatorState['runtime']['mode']) { return mode === 'simulation' ? persistenceKey : persistenceKey + ':' + mode; }

type PersistedState = {
  version: 2;
  mode?: SimulatorState['runtime']['mode'];
  evidence?: Pick<SimulatorState, 'history' | 'controlRecords' | 'irrigationStarts' | 'aiReviews' | 'operationLog'>;
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
    && typeof alarm.occurrenceCount === 'number'
    && Number.isFinite(Date.parse(alarm.firstTriggeredAt ?? '')) && Number.isFinite(Date.parse(alarm.lastTriggeredAt ?? ''))
    && typeof alarm.title === 'string' && typeof alarm.description === 'string'
    && (alarm.handlingRecords === undefined || Array.isArray(alarm.handlingRecords) && alarm.handlingRecords.length <= 30 && alarm.handlingRecords.every(r => r && Number.isFinite(Date.parse(r.at)) && typeof r.note === 'string' && typeof r.completed === 'boolean'))
    && (alarm.context === undefined || typeof alarm.context.location === 'string' && Array.isArray(alarm.context.deviceKeys) && alarm.context.deviceKeys.every(k => ['waterPump', 'fan', 'growLight', 'shade'].includes(k)) && Array.isArray(alarm.context.actions) && alarm.context.actions.every(a => typeof a === 'string'));
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
      && typeof sensor.lastValue === 'number' && Number.isFinite(sensor.lastValue) && typeof sensor.lastUpdatedAt === 'string' && ['good', 'stale', 'offline', 'invalid', 'error'].includes(String(sensor.quality));
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
    mode: state.runtime.mode,
    evidence: { history: state.history.slice(-500), controlRecords: state.controlRecords, irrigationStarts: state.irrigationStarts, aiReviews: state.aiReviews, operationLog: state.operationLog },
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
    if (parsed.version !== persistenceVersion || (parsed.mode ?? 'simulation') !== initial.runtime.mode) return initial;
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

    const evidence = parsed.evidence && validEvidence(parsed.evidence) ? parsed.evidence : {};
    if (initial.runtime.mode !== 'simulation') return {
      ...initial, ...evidence, alarms: parsed.alarms,
      sensors: Object.fromEntries(Object.entries(parsed.recentState.sensors).map(([key, sensor]) => [key, { ...sensor, quality: sensor.quality === 'good' ? 'stale' : sensor.quality }])) as SimulatorState['sensors'],
      actuators: Object.fromEntries(Object.entries(initial.actuators).map(([key, a]) => [key, { ...a, actual: parsed.recentState!.actuators[key as keyof typeof initial.actuators].actual, actualKnown: parsed.recentState!.actuators[key as keyof typeof initial.actuators].actualKnown === true, actualUpdatedAt: parsed.recentState!.actuators[key as keyof typeof initial.actuators].actualUpdatedAt, feedbackLevel: parsed.recentState!.actuators[key as keyof typeof initial.actuators].feedbackLevel }])) as SimulatorState['actuators'],
    };
    return {
      ...initial, ...evidence,
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
      sensors: Object.fromEntries(Object.entries(parsed.recentState.sensors).map(([key, sensor]) => [key, { ...sensor, sourceKind: 'simulation' }])) as SimulatorState['sensors'],
      actuators: Object.fromEntries(Object.entries(parsed.recentState.actuators).map(([key, actuator]) => [key, { ...actuator, actualKnown: actuator.actualKnown ?? true, sourceKind: 'simulation', feedbackLevel: 'simulation' }])) as SimulatorState['actuators'],
      lastUpdatedAt: parsed.recentState.lastUpdatedAt,
    };
  } catch {
    return initial;
  }
}

export function saveState(storage: Pick<Storage, 'setItem'>, state: SimulatorState): boolean {
  try {
    storage.setItem(storageKey(state.runtime.mode), serializeState(state));
    return true;
  } catch {
    return false;
  }
}

export function validEvidence(value: unknown): value is NonNullable<PersistedState['evidence']> {
  if (!value || typeof value !== 'object') return false;
  const item = value as NonNullable<PersistedState['evidence']>;
  const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
  return Array.isArray(item.history) && item.history.length <= 500 && item.history.every(r => r && date(r.capturedAt) && typeof r.time === 'string' && ['temperature', 'humidity', 'light', 'soilMoisture', 'co2'].every(k => isFiniteNumberOrNull(r[k as keyof typeof r])))
    && Array.isArray(item.controlRecords) && item.controlRecords.length <= 500 && item.controlRecords.every(r => r && typeof r.id === 'string' && date(r.at) && ['waterPump', 'fan', 'growLight', 'shade'].includes(r.device) && typeof r.target === 'boolean' && typeof r.reason === 'string' && ['pending', 'sent', 'acknowledged', 'succeeded', 'failed', 'timed_out', 'rejected', 'cancelled'].includes(r.status) && (r.actual === undefined || typeof r.actual === 'boolean'))
    && Array.isArray(item.irrigationStarts) && item.irrigationStarts.length <= 1000 && item.irrigationStarts.every(date)
    && Array.isArray(item.aiReviews) && item.aiReviews.length <= 100 && item.aiReviews.every(r => r && date(r.at) && typeof r.fingerprint === 'string' && typeof r.label === 'string' && typeof r.note === 'string' && ['demo', 'remote'].includes(r.mode) && ['confirmed', 'corrected', 'recheck'].includes(r.decision))
    && Array.isArray(item.operationLog) && item.operationLog.length <= 200 && item.operationLog.every(r => r && typeof r.id === 'string' && date(r.at));
}
