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
} from '../types';
import { acknowledgeAlarm, applyRecognitionAlarm, collectSystemAlarmConditions, reconcileSystemAlarms } from './alarmEngine';
import { applySimulationResults, decideAutomaticTargets, planActuatorTargets } from './controlEngine';
import { runtimeConfig, isExternalConfigured } from '../config/runtimeConfig';
import { edgeNodeConfig, aiProviderLabel, effectiveAiProvider } from '../config/edgeNodeConfig';
import { emptyEfficiencyCounters, updateEfficiencyCounters } from './metricsEngine';
import { simulateReading } from './readingSimulator';
import { createPresentationState, preparePresentationFrame } from './presentationScenarios';
import { randomSequence } from './random';

function withLog(state: SimulatorState, type: string, target: string, now: string, result: 'succeeded' | 'failed' | 'rejected' = 'succeeded'): SimulatorState {
  const entry = { id: `${type}:${now}`, at: now, simulationStep: state.presentation.step, type, source: 'user' as const, target, before: '已记录前态', after: '已记录后态', result };
  return { ...state, operationLog: [...state.operationLog, entry].slice(-200) };
}

export type SimulatorAction =
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
  | { type: 'control-command-result'; key: DeviceStateKey; target: boolean; actual?: boolean; status: SimulatorState['actuators'][DeviceStateKey]['executionStatus']; error?: string }
  | { type: 'set-channel-status'; channel: 'data' | 'control'; status: SimulatorState['runtime']['dataChannelStatus'] }
  | { type: 'set-runtime'; runtime: SimulatorState['runtime'] }
  | { type: 'external-sync-status'; status: SimulatorState['runtime']['externalInitialSyncStatus']; now?: string }
  | { type: 'external-sync-actuators'; actuators: Array<{ key: DeviceStateKey; actual?: boolean; target?: boolean; online: boolean; updatedAt: string }>; now: string }
  | { type: 'ingest-sensor-packet'; key: keyof SimulatorState['sensors']; value: number | null; quality: SimulatorState['sensors'][keyof SimulatorState['sensors']]['quality']; capturedAt: string; sourceId: string };

function seedHistory(now: string) {
  const base = new Date(now);
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(base.getTime() - (13 - index) * 30 * 60_000);
    return {
      ...initialReading,
      time: date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      capturedAt: date.toISOString(),
      temperature: Number((25.5 + Math.sin(index / 2) * 2.7 + index * 0.12).toFixed(1)),
      humidity: Math.round(67 - index * 0.8 + Math.cos(index) * 2),
      light: Math.round(12_000 + index * 1_300 + Math.sin(index) * 1_900),
      soilMoisture: Math.round(47 - index * 0.7 + Math.sin(index / 1.7) * 2),
      co2: Math.round(690 + index * 18 + Math.cos(index) * 25),
    };
  });
}

export function createInitialSimulatorState(now: string): SimulatorState {
  const devices = initialDevices.map((device) => ({ ...device, updatedAt: now }));
  const sensors = Object.fromEntries(Object.entries(initialSensorStates).map(([key, sensor]) => [key, { ...sensor, lastUpdatedAt: now }])) as SimulatorState['sensors'];
  const initialAiProvider = effectiveAiProvider(runtimeConfig.mode, edgeNodeConfig);
  return {
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
    demoScenario: 'healthy',
    presentation: createPresentationState(),
    runtime: {
      mode: runtimeConfig.mode,
      edgeNodeType: edgeNodeConfig.type,
      edgeNodeName: edgeNodeConfig.displayName,
      dataChannelStatus: runtimeConfig.mode === 'external' && !isExternalConfigured(runtimeConfig) ? 'unconfigured' : 'disconnected',
      controlChannelStatus: runtimeConfig.mode === 'external' && !isExternalConfigured(runtimeConfig) ? 'unconfigured' : 'disconnected',
      dataSourceLabel: runtimeConfig.mode === 'external' ? (isExternalConfigured(runtimeConfig) ? '边缘网关' : '边缘网关未配置') : runtimeConfig.mode === 'playback' ? '本地回放' : '本地模拟器',
      controlSourceLabel: runtimeConfig.mode === 'external' ? (isExternalConfigured(runtimeConfig) ? '边缘网关控制通道' : '边缘网关未配置') : runtimeConfig.mode === 'playback' ? '回放控制禁用' : '模拟设备通道',
      aiProvider: initialAiProvider,
      aiSourceLabel: aiProviderLabel(initialAiProvider),
      externalInitialSyncStatus: runtimeConfig.mode === 'external' ? 'idle' : 'ready', controlArmed: runtimeConfig.mode === 'simulation',
    },
    operationLog: [],
    lastUpdatedAt: now,
  };
}

export function advanceSimulator(state: SimulatorState, now: string, randomValues: number[]): SimulatorState {
  const simulated = simulateReading(state.reading, state.sensors, state.devices, state.actuators, now, randomValues);
  const previousTargets = Object.fromEntries(Object.entries(state.actuators).map(([key, value]) => [key, value.target])) as SimulatorState['manualTargets'];
  const automatic = decideAutomaticTargets(simulated.reading, simulated.sensors, previousTargets);
  const planned = planActuatorTargets(state.controlMode, automatic, state.manualTargets, state.actuators);
  const actuators = state.runtime.mode === 'simulation' ? applySimulationResults(planned, state.devices) : planned;
  const alarms = reconcileSystemAlarms(
    state.alarms,
    collectSystemAlarmConditions(simulated.reading, simulated.sensors, state.devices, actuators),
    now,
  );
  return {
    ...state,
    reading: simulated.reading,
    sensors: simulated.sensors,
    actuators,
    alarms,
    history: [...state.history.slice(-23), simulated.reading],
    efficiency: updateEfficiencyCounters(state.efficiency, simulated.reading, actuators),
    irrigationCount: state.irrigationCount + (!state.actuators.waterPump.actual && actuators.waterPump.actual ? 1 : 0),
    lastUpdatedAt: now,
  };
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
  const planned = planActuatorTargets(state.controlMode, automatic, state.manualTargets, state.actuators);
  const actuators = state.runtime.mode === 'simulation' ? applySimulationResults(planned, state.devices) : planned;
  const alarms = reconcileSystemAlarms(
    state.alarms,
    collectSystemAlarmConditions(state.reading, state.sensors, state.devices, actuators),
    now,
  );
  return { ...state, actuators, alarms, lastUpdatedAt: now };
}

export function simulatorReducer(state: SimulatorState, action: SimulatorAction): SimulatorState {
  switch (action.type) {
    case 'tick':
      return advanceSimulator(state, action.now, action.randomValues);
    case 'set-control-mode':
      return withLog(recalculateControl({ ...state, controlMode: action.mode }, action.now), '控制模式切换', action.mode, action.now);
    case 'toggle-manual-target': {
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
      if (state.runtime.mode !== 'simulation') return state;
      return { ...action.state, operationLog: [...action.state.operationLog, { id: `snapshot-import:${action.now}`, at: action.now, simulationStep: action.state.presentation.step, type: '快照导入', source: 'user' as const, target: '演示快照', before: '当前状态', after: '已恢复快照状态', result: 'succeeded' as const }].slice(-200) };
    case 'debate-reset': {
      if (state.runtime.mode !== 'simulation') return state;
      const fresh = createScenarioState('normal', 'GREENHOUSE-2026', action.now, 'paused');
      const historicalAlarms = state.alarms.filter((alarm) => alarm.status === 'resolved');
      return withLog({ ...fresh, alarms: historicalAlarms, operationLog: state.operationLog }, '答辩复位', '统一答辩起点', action.now);
    }
    case 'reset':
      return createInitialSimulatorState(action.now);
    case 'set-runtime':
      return { ...state, runtime: action.runtime };
    case 'set-channel-status':
      return { ...state, runtime: action.channel === 'data' ? { ...state.runtime, dataChannelStatus: action.status } : { ...state.runtime, controlChannelStatus: action.status } };
    case 'ingest-sensor-packet': {
      const sensor = { ...state.sensors[action.key], sourceId: action.sourceId, quality: action.quality, status: action.quality === 'offline' ? 'offline' : 'live', lastUpdatedAt: action.capturedAt, ...(action.value === null ? {} : { lastValue: action.value }) };
      const updated = { ...state, sensors: { ...state.sensors, [action.key]: sensor }, reading: { ...state.reading, [action.key]: action.value, capturedAt: action.capturedAt, time: new Date(action.capturedAt).toLocaleTimeString('zh-CN') }, lastUpdatedAt: action.capturedAt, runtime: { ...state.runtime, lastValidDataAt: action.quality === 'good' && action.value !== null ? action.capturedAt : state.runtime.lastValidDataAt } };
      return updated.runtime.mode === 'external' ? recalculateControl(updated, action.capturedAt) : updated;
    }
    case 'control-command-result': {
      const previous = state.actuators[action.key];
      const failed = ['failed', 'timed_out', 'rejected', 'cancelled'].includes(action.status);
      const actuator = { ...previous, target: action.target, actual: action.actual === undefined ? previous.actual : action.actual, actualKnown: action.actual === undefined ? previous.actualKnown : true, commandStatus: failed ? 'blocked' as const : 'applied' as const, executionStatus: action.status, ...(action.error ? { blockedReason: action.error } : {}) };
      return { ...state, actuators: { ...state.actuators, [action.key]: actuator } };
    }
    case 'external-sync-status':
      return { ...state, runtime: { ...state.runtime, externalInitialSyncStatus: action.status, controlArmed: action.status === 'ready', ...(action.now ? { lastHealthCheckAt: action.now } : {}) } };
    case 'external-sync-actuators': {
      const actuators = { ...state.actuators }; const devices = state.devices.map((device) => {
        const snapshot = action.actuators.find((item) => item.key === device.actuatorKey);
        if (!snapshot || !device.actuatorKey) return device;
        actuators[device.actuatorKey] = { ...actuators[device.actuatorKey], target: snapshot.target ?? actuators[device.actuatorKey].target, actual: snapshot.actual ?? actuators[device.actuatorKey].actual, actualKnown: snapshot.actual !== undefined, executionStatus: 'succeeded' };
        return { ...device, online: snapshot.online, updatedAt: snapshot.updatedAt };
      });
      return { ...state, devices, actuators };
    }
  }
}
