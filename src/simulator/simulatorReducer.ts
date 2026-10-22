import {
  initialActuators,
  initialAlarms,
  initialDevices,
  initialReading,
  initialSensorStates,
  initialTargets,
} from '../data/mockData';
import {
  DemoScenarioId,
  DeviceStateKey,
  RecognitionResult,
  PresentationScenarioId,
  SimulatorState,
  AiReview,
  ControlRecord,
  DataOrigin,
} from '../types';
import { acknowledgeAlarm, applyRecognitionAlarm } from './alarmEngine';
import { applySimulationResults, decideAutomaticTargets, planActuatorTargets } from './controlEngine';
import { runtimeConfig, isExternalConfigured } from '../config/runtimeConfig';
import { edgeNodeConfig, aiProviderLabel, effectiveAiProvider } from '../config/edgeNodeConfig';
import { emptyEfficiencyCounters, updateEfficiencyCounters } from './metricsEngine';
import { simulateReading } from './readingSimulator';
import { createPresentationState, preparePresentationFrame } from './presentationScenarios';
import { randomSequence } from './random';
import { reconcileEvidence, recordSimulationTransition } from './stateEvidence';
import { controlAvailable, deviceKeys, inputs, sensorKeys } from '../utils/runtimeStatus';

function withLog(state: SimulatorState, type: string, target: string, now: string, result: 'succeeded' | 'failed' | 'rejected' = 'succeeded'): SimulatorState {
  const entry = { id: `${type}:${now}`, at: now, simulationStep: state.presentation.step, type, source: 'user' as const, target, before: '未保存操作前快照', after: JSON.stringify({ controlMode: state.controlMode, targets: Object.fromEntries(deviceKeys.map(k => [k, state.actuators[k].target])), execution: Object.fromEntries(deviceKeys.map(k => [k, state.actuators[k].executionStatus])) }), result };
  return { ...state, operationLog: [...state.operationLog, entry].slice(-200) };
}

export type SimulatorAction =
  | { type: 'expire-data'; now: string; staleAfterMs: number }
  | { type: 'arm-control'; armed: boolean }
  | { type: 'handle-alarm'; id: string; note: string; completed: boolean; now: string }
  | { type: 'review-ai'; review: AiReview }
  | { type: 'control-command-start'; record: ControlRecord }
  | { type: 'tick'; now: string; randomValues: number[] }
  | { type: 'set-control-mode'; mode: SimulatorState['controlMode']; now: string }
  | { type: 'toggle-manual-target'; key: DeviceStateKey; now: string }
  | { type: 'toggle-device-online'; id: string; now: string }
  | { type: 'acknowledge-alarm'; id: string }
  | { type: 'set-demo-scenario'; scenario: DemoScenarioId }
  | { type: 'recognition-completed'; result: RecognitionResult; now: string }
  | { type: 'advance-presentation'; now: string }
  | { type: 'set-presentation-run-status'; status: 'running' | 'paused' }
  | { type: 'select-presentation-scenario'; scenarioId: PresentationScenarioId; seed: string; now: string }
  | { type: 'reset-presentation-scenario'; now: string }
  | { type: 'set-presentation-seed'; seed: string; now: string }
  | { type: 'import-snapshot'; state: SimulatorState; now: string }
  | { type: 'debate-reset'; now: string }
  | { type: 'reset'; now: string }
  | { type: 'control-command-result'; key: DeviceStateKey; target: boolean; actual?: boolean; status: SimulatorState['actuators'][DeviceStateKey]['executionStatus']; error?: string; now?: string; commandId?: string }
  | { type: 'set-channel-status'; channel: 'data' | 'control'; status: SimulatorState['runtime']['dataChannelStatus'] }
  | { type: 'set-runtime'; runtime: SimulatorState['runtime'] }
  | { type: 'external-sync-status'; status: SimulatorState['runtime']['externalInitialSyncStatus']; now?: string; error?: string }
  | { type: 'external-sync-actuators'; actuators: Array<{ key: DeviceStateKey; actual?: boolean; target?: boolean; online: boolean; updatedAt: string; feedbackLevel?: 'physical' | 'output' | 'gateway'; sourceKind?: DataOrigin }>; now: string }
  | { type: 'ingest-sensor-packet'; key: keyof SimulatorState['sensors']; value: number | null; quality: SimulatorState['sensors'][keyof SimulatorState['sensors']]['quality']; capturedAt: string; sourceId: string; receivedAt?: string; sourceKind?: DataOrigin; source?: string };

function seedHistory(now: string) {
  const base = new Date(now);
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(base.getTime() - (13 - index) * 30 * 60_000);
    return {
      ...initialReading,
      time: date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      capturedAt: date.toISOString(),
      origins: Object.fromEntries(sensorKeys.map(k => [k, 'simulation' as const])),
      temperature: Number((25.5 + Math.sin(index / 2) * 2.7 + index * 0.12).toFixed(1)),
      humidity: Math.round(67 - index * 0.8 + Math.cos(index) * 2),
      light: Math.round(12_000 + index * 1_300 + Math.sin(index) * 1_900),
      soilMoisture: Math.round(47 - index * 0.7 + Math.sin(index / 1.7) * 2),
      co2: Math.round(690 + index * 18 + Math.cos(index) * 25),
    };
  });
}

export function createInitialSimulatorState(now: string, mode = runtimeConfig.mode): SimulatorState {
  const devices = initialDevices.map((device) => ({ ...device, updatedAt: now }));
  const sensors = Object.fromEntries(Object.entries(initialSensorStates).map(([key, sensor]) => [key, { ...sensor, lastUpdatedAt: now }])) as SimulatorState['sensors'];
  const initialAiProvider = effectiveAiProvider(mode, edgeNodeConfig);
  const state: SimulatorState = {
    reading: { ...initialReading, capturedAt: now },
    history: seedHistory(now),
    sensors,
    devices,
    actuators: structuredClone(initialActuators),
    manualTargets: { ...initialTargets },
    controlMode: 'auto',
    alarms: structuredClone(initialAlarms),
    efficiency: { ...emptyEfficiencyCounters },
    irrigationCount: 0,
    irrigationStarts: [], controlRecords: [], aiReviews: [],
    demoScenario: 'healthy',
    presentation: createPresentationState(),
    runtime: {
      mode: mode,
      edgeNodeType: edgeNodeConfig.type,
      edgeNodeName: edgeNodeConfig.displayName,
      dataChannelStatus: mode === 'external' && !isExternalConfigured(runtimeConfig) ? 'unconfigured' : 'disconnected',
      controlChannelStatus: mode === 'external' && !isExternalConfigured(runtimeConfig) ? 'unconfigured' : 'disconnected',
      dataSourceLabel: mode === 'external' ? (isExternalConfigured(runtimeConfig) ? '边缘网关' : '边缘网关未配置') : mode === 'playback' ? '本地回放' : '本地模拟器',
      controlSourceLabel: mode === 'external' ? (isExternalConfigured(runtimeConfig) ? '边缘网关控制通道' : '边缘网关未配置') : mode === 'playback' ? '回放控制禁用' : '模拟设备通道',
      aiProvider: initialAiProvider,
      aiSourceLabel: aiProviderLabel(initialAiProvider),
      externalInitialSyncStatus: mode === 'external' ? 'idle' : 'ready', controlArmed: mode === 'simulation',
    },
    operationLog: [],
    lastUpdatedAt: now,
  };
  if (mode !== 'simulation') {
    state.history = []; state.alarms = [];
    for (const key of sensorKeys) {
      state.reading[key] = null;
      state.sensors[key] = { ...state.sensors[key], quality: 'invalid', lastUpdatedAt: '', capturedAt: undefined, sourceKind: mode === 'playback' ? 'playback' : 'unknown' };
    }
    state.devices = state.devices.map(d => ({ ...d, online: false, statusKnown: false, battery: undefined, updatedAt: '', sourceKind: mode === 'playback' ? 'playback' : 'unknown' }));
    state.actuators = Object.fromEntries(Object.entries(state.actuators).map(([key, a]) => [key, { ...a, actualKnown: false, executionStatus: 'cancelled', sourceKind: 'unknown' }])) as SimulatorState['actuators'];
  } else {
    state.sensors = Object.fromEntries(Object.entries(state.sensors).map(([key, s]) => [key, { ...s, sourceKind: 'simulation', capturedAt: now, receivedAt: now }])) as SimulatorState['sensors'];
    state.devices = state.devices.map(d => ({ ...d, statusKnown: true, sourceKind: 'simulation' }));
    state.actuators = Object.fromEntries(Object.entries(state.actuators).map(([key, a]) => [key, { ...a, actualUpdatedAt: now, feedbackLevel: 'simulation', sourceKind: 'simulation' }])) as SimulatorState['actuators'];
  }
  return state;
}

export function advanceSimulator(state: SimulatorState, now: string, randomValues: number[]): SimulatorState {
  if (state.runtime.mode !== 'simulation') return state;
  const simulated = simulateReading(state.reading, state.sensors, state.devices, state.actuators, now, randomValues);
  const previousTargets = Object.fromEntries(Object.entries(state.actuators).map(([key, value]) => [key, value.target])) as SimulatorState['manualTargets'];
  const automatic = decideAutomaticTargets(simulated.reading, simulated.sensors, previousTargets);
  const planned = planActuatorTargets(state.controlMode, automatic, state.manualTargets, state.actuators);
  const actuators = state.runtime.mode === 'simulation' ? applySimulationResults(planned, state.devices) : planned;
  const alarms = state.alarms;
  return recordSimulationTransition(state, reconcileEvidence({
    ...state,
    reading: simulated.reading,
    sensors: simulated.sensors,
    actuators,
    alarms,
    history: [...state.history.slice(-499), simulated.reading],
    efficiency: updateEfficiencyCounters(state.efficiency, simulated.reading, actuators),
    irrigationCount: state.irrigationCount + (!state.actuators.waterPump.actual && actuators.waterPump.actual ? 1 : 0),
    lastUpdatedAt: now,
  }, now), now);
}

export function advancePresentation(state: SimulatorState, now: string): SimulatorState {
  if (state.runtime.mode !== 'simulation') return state;
  const prepared = preparePresentationFrame(state, now);
  const random = randomSequence(prepared.presentation.randomState, 5);
  const advanced = advanceSimulator(prepared, now, random.values);
  return {
    ...advanced,
    presentation: {
      ...advanced.presentation,
      step: prepared.presentation.step + 1,
      randomState: random.nextState,
    },
  };
}

function createScenarioState(
  scenarioId: PresentationScenarioId,
  seed: string,
  now: string,
  runStatus: SimulatorState['presentation']['runStatus'] = 'running',
): SimulatorState {
  return {
    ...createInitialSimulatorState(now),
    presentation: createPresentationState(scenarioId, seed, runStatus),
  };
}

function recalculateControl(state: SimulatorState, now: string): SimulatorState {
  const previousTargets = Object.fromEntries(Object.entries(state.actuators).map(([key, value]) => [key, value.target])) as SimulatorState['manualTargets'];
  const automatic = decideAutomaticTargets(state.reading, state.sensors, previousTargets);
  if (state.runtime.mode === 'external') for (const key of deviceKeys) {
    if (inputs[key].some(k => state.sensors[k].sourceKind !== 'hardware')) automatic.blockedReasons[key] = '输入包含仿真、回放或未核实来源，禁止用于外部自动控制';
  }
  const planned = planActuatorTargets(state.controlMode, automatic, state.manualTargets, state.actuators, state.runtime.mode === 'external');
  const actuators = state.runtime.mode === 'simulation' ? applySimulationResults(planned, state.devices) : planned;
  const alarms = state.alarms;
  return recordSimulationTransition(state, reconcileEvidence({ ...state, actuators, alarms, lastUpdatedAt: now }, now), now);
}

export function simulatorReducer(state: SimulatorState, action: SimulatorAction): SimulatorState {
  switch (action.type) {
    case 'tick':
      return advanceSimulator(state, action.now, action.randomValues);
    case 'set-control-mode':
      if (!controlAvailable(state.runtime)) return state;
      return withLog(recalculateControl({ ...state, controlMode: action.mode, manualTargets: action.mode === 'manual' ? Object.fromEntries(deviceKeys.map(k => [k, state.actuators[k].target])) as SimulatorState['manualTargets'] : state.manualTargets }, action.now), '控制模式切换', action.mode, action.now);
    case 'toggle-manual-target': {
      if (!controlAvailable(state.runtime) || state.controlMode !== 'manual') return state;
      const manualTargets = { ...state.manualTargets, [action.key]: !state.manualTargets[action.key] };
      return withLog(recalculateControl({ ...state, manualTargets }, action.now), '手动设备控制', action.key, action.now);
    }
    case 'toggle-device-online': {
      if (state.runtime.mode !== 'simulation') return state;
      const devices = state.devices.map((device) => device.id === action.id
        ? { ...device, online: !device.online, updatedAt: action.now }
        : device);
      const sensors = structuredClone(state.sensors);
      const reading = { ...state.reading };
      const changed = devices.find((device) => device.id === action.id);
      if (changed?.sensorKeys) {
        for (const key of changed.sensorKeys) {
          sensors[key] = { ...sensors[key], status: changed.online ? 'live' : 'offline', quality: changed.online ? 'good' : 'offline' };
          if (!changed.online) reading[key] = null;
        }
      }
      return withLog(recalculateControl({ ...state, devices, sensors, reading }, action.now), '设备在线状态切换', changed?.name ?? action.id, action.now);
    }
    case 'acknowledge-alarm':
      return { ...state, alarms: acknowledgeAlarm(state.alarms, action.id) };
    case 'set-demo-scenario':
      return { ...state, demoScenario: action.scenario };
    case 'recognition-completed':
      return { ...state, alarms: applyRecognitionAlarm(state.alarms, action.result, action.now) };
    case 'advance-presentation':
      return advancePresentation(state, action.now);
    case 'set-presentation-run-status':
      if (state.runtime.mode !== 'simulation') return state;
      return withLog({ ...state, presentation: { ...state.presentation, runStatus: action.status } }, action.status === 'paused' ? '暂停' : '继续', '模拟器', state.lastUpdatedAt);
    case 'select-presentation-scenario':
      if (state.runtime.mode !== 'simulation') return state;
      return withLog(createScenarioState(action.scenarioId, action.seed, action.now), '场景切换', action.scenarioId, action.now);
    case 'reset-presentation-scenario':
      if (state.runtime.mode !== 'simulation') return state;
      return withLog(createScenarioState(state.presentation.scenarioId, state.presentation.seed, action.now, state.presentation.runStatus), '场景重置', state.presentation.scenarioId, action.now);
    case 'set-presentation-seed':
      if (state.runtime.mode !== 'simulation') return state;
      return withLog(createScenarioState(state.presentation.scenarioId, action.seed, action.now, state.presentation.runStatus), '随机种子更新', action.seed, action.now);
    case 'import-snapshot':
      if (state.runtime.mode !== 'simulation' || action.state.runtime.mode !== 'simulation') return state;
      return { ...action.state, operationLog: [...action.state.operationLog, { id: `snapshot-import:${action.now}`, at: action.now, simulationStep: action.state.presentation.step, type: '快照导入', source: 'user' as const, target: '演示快照', before: '当前状态', after: '已恢复快照状态', result: 'succeeded' as const }].slice(-200) };
    case 'debate-reset': {
      if (state.runtime.mode !== 'simulation') return state;
      const fresh = createScenarioState('normal', 'GREENHOUSE-2026', action.now, 'paused');
      const historicalAlarms = state.alarms.filter((alarm) => alarm.status === 'resolved');
      return withLog({ ...fresh, alarms: historicalAlarms, operationLog: state.operationLog }, '答辩复位', '统一答辩起点', action.now);
    }
    case 'reset':
      if (state.runtime.mode !== 'simulation') return state;
      return createInitialSimulatorState(action.now);
    case 'set-runtime':
      return { ...(state.runtime.mode === action.runtime.mode ? state : createInitialSimulatorState(state.lastUpdatedAt, action.runtime.mode)), runtime: action.runtime };
    case 'set-channel-status':
      return { ...state, runtime: { ...state.runtime, ...(action.channel === 'data' ? { dataChannelStatus: action.status } : { controlChannelStatus: action.status }), ...(state.runtime.mode === 'external' && ['failed', 'disconnected', 'stale', 'partial-offline'].includes(action.status) ? { controlArmed: false } : {}) } };
    case 'ingest-sensor-packet': {
      if (state.runtime.mode !== 'external') return state;
      const previous = state.sensors[action.key];
      if (previous.capturedAt && Date.parse(action.capturedAt) < Date.parse(previous.capturedAt)) return state;
      const good = action.quality === 'good' && action.value !== null;
      const sensor = { ...previous, sourceId: action.sourceId, source: action.source, sourceKind: action.sourceKind ?? 'unknown' as const, quality: action.quality, status: action.quality === 'offline' ? 'offline' as const : 'live' as const, capturedAt: action.capturedAt, receivedAt: action.receivedAt, ...(good ? { lastValue: action.value!, lastUpdatedAt: action.capturedAt } : {}) };
      const reading = { ...state.reading, [action.key]: good ? action.value : null, capturedAt: action.capturedAt, time: new Date(action.capturedAt).toLocaleTimeString('zh-CN') };
      const history = previous.capturedAt === action.capturedAt ? state.history : [...state.history, { ...reading, ...Object.fromEntries(sensorKeys.map(k => [k, k === action.key && good ? action.value : null])), origins: { [action.key]: sensor.sourceKind }, sampleKey: action.key }].slice(-500);
      const updated = { ...state, history, devices: state.devices.map(d => d.sensorKeys?.includes(action.key) ? { ...d, online: action.quality !== 'offline', statusKnown: true, reportedId: action.sourceId, sourceKind: sensor.sourceKind, updatedAt: action.capturedAt } : d), sensors: { ...state.sensors, [action.key]: sensor }, reading, lastUpdatedAt: action.receivedAt ?? action.capturedAt, runtime: { ...state.runtime, lastValidDataAt: good ? action.capturedAt : state.runtime.lastValidDataAt } };
      return recalculateControl(updated, action.receivedAt ?? action.capturedAt);
    }
    case 'control-command-start':
      return { ...state, controlRecords: [...state.controlRecords, action.record].slice(-500), actuators: { ...state.actuators, [action.record.device]: { ...state.actuators[action.record.device], commandId: action.record.id, executionStatus: 'sent' } } };
    case 'control-command-result': {
      const previous = state.actuators[action.key];
      const now = action.now ?? state.lastUpdatedAt;
      const failed = ['failed', 'timed_out', 'rejected', 'cancelled'].includes(action.status);
      const records = state.controlRecords.map(r => r.id === action.commandId ? { ...r, status: action.status, actual: action.actual, error: action.error, completedAt: now, feedbackLevel: 'gateway' as const } : r);
      // Older replies stay in the audit history; they cannot overwrite a newer target.
      if (action.commandId && (previous.commandId !== action.commandId || previous.target !== action.target)) return { ...state, controlRecords: records };
      const actuator = { ...previous, actual: action.actual ?? previous.actual, actualKnown: action.actual === undefined ? previous.actualKnown : true, ...(action.actual === undefined ? {} : { actualUpdatedAt: now, feedbackLevel: 'gateway' as const }), target: action.target, commandStatus: failed ? 'blocked' as const : 'applied' as const, executionStatus: action.status, blockedReason: action.error };
      return reconcileEvidence({ ...state, controlRecords: records, actuators: { ...state.actuators, [action.key]: actuator } }, now);
    }
    case 'handle-alarm':
      if (!action.note.trim()) return state;
      return { ...state, alarms: state.alarms.map(a => a.id === action.id ? { ...a, handlingRecords: [...(a.handlingRecords ?? []), { at: action.now, note: action.note.trim().slice(0, 2000), completed: action.completed }].slice(-30) } : a) };
    case 'review-ai':
      return { ...state, aiReviews: [...state.aiReviews, action.review].slice(-100) };
    case 'arm-control':
      return { ...state, runtime: { ...state.runtime, controlArmed: action.armed && state.runtime.mode !== 'playback' && (state.runtime.mode === 'simulation' || state.runtime.externalInitialSyncStatus === 'ready' && state.runtime.dataChannelStatus === 'connected') } };
    case 'expire-data': {
      if (state.runtime.mode !== 'external') return state;
      let changed = false;
      const sensors = { ...state.sensors }; const reading = { ...state.reading };
      for (const key of sensorKeys) {
        const sensor = sensors[key];
        if (sensor.quality === 'good' && Date.parse(action.now) - Date.parse(sensor.capturedAt ?? sensor.lastUpdatedAt) > action.staleAfterMs) {
          sensors[key] = { ...sensor, quality: 'stale' }; reading[key] = null; changed = true;
        }
      }
      const timedOut = state.controlRecords.filter(r => ['sent', 'acknowledged', 'pending'].includes(r.status) && Date.parse(action.now) - Date.parse(r.at) > runtimeConfig.requestTimeoutMs);
      const actuators = { ...state.actuators };
      for (const record of timedOut) if (actuators[record.device].commandId === record.id) {
        actuators[record.device] = { ...actuators[record.device], executionStatus: 'timed_out', commandStatus: 'blocked', blockedReason: '未在等待时限内取得最终回执，实际动作需现场核实' };
        changed = true;
      }
      const controlRecords = state.controlRecords.map(r => timedOut.includes(r) ? { ...r, status: 'timed_out' as const, completedAt: action.now } : r);
      const devices = state.devices.map(d => d.statusKnown && Date.parse(action.now) - Date.parse(d.updatedAt) > action.staleAfterMs ? { ...d, statusKnown: false } : d);
      if (!changed && devices.every((d, i) => d === state.devices[i])) return state;
      return recalculateControl({ ...state, sensors, reading, devices, actuators, controlRecords }, action.now);
    }
    case 'external-sync-status':
      return { ...state, runtime: { ...state.runtime, externalInitialSyncStatus: action.status, lastError: action.error, controlArmed: action.status === 'ready' ? state.runtime.controlArmed : false, ...(action.now ? { lastHealthCheckAt: action.now } : {}) } };
    case 'external-sync-actuators': {
      const actuators = { ...state.actuators };
      const devices = state.devices.map(device => {
        const snapshot = action.actuators.find(item => item.key === device.actuatorKey);
        if (!snapshot || !device.actuatorKey) return device;
        const previous = actuators[device.actuatorKey];
        if (previous.actualUpdatedAt && Date.parse(snapshot.updatedAt) < Date.parse(previous.actualUpdatedAt)) return device;
        actuators[device.actuatorKey] = { ...previous, target: state.runtime.externalInitialSyncStatus === 'syncing_actuators' ? snapshot.target ?? previous.target : previous.target, actual: snapshot.actual ?? previous.actual, actualKnown: snapshot.actual !== undefined || previous.actualKnown, ...(snapshot.actual === undefined ? {} : { actualUpdatedAt: snapshot.updatedAt }), feedbackLevel: snapshot.feedbackLevel ?? 'gateway', sourceKind: snapshot.sourceKind ?? 'unknown' };
        return { ...device, online: snapshot.online, statusKnown: true, sourceKind: snapshot.sourceKind ?? 'unknown' as const, updatedAt: snapshot.updatedAt };
      });
      return reconcileEvidence({ ...state, devices, actuators }, action.now);
    }
  }
}
