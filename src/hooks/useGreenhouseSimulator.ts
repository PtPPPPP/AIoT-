import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { DemoRecognitionAdapter } from '../simulator/aiRecognitionAdapter';
import { calculateEfficiencyMetrics } from '../simulator/metricsEngine';
import { persistenceKey, restoreState, saveState } from '../simulator/persistence';
import { simulationIntervalMs } from '../simulator/policy';
import { createInitialSimulatorState, simulatorReducer } from '../simulator/simulatorReducer';
import { createSeed } from '../simulator/random';
import { SimulationClock } from '../simulator/simulationClock';
import { createRuntimeChannels, RuntimeChannels } from '../channels/createRuntimeChannels';
import { SensorPacket } from '../channels/data/types';
import { exportDemoSnapshot, parseDemoSnapshot } from '../snapshots/demoSnapshot';
import { downloadText, exportCsv } from '../utils/exportFile';
import { DemoScenarioId, DeviceStateKey, PresentationScenarioId, RecognitionResult } from '../types';

const recognitionAdapter = new DemoRecognitionAdapter();

function initializeState() {
  const initial = createInitialSimulatorState(new Date().toISOString());
  try {
    return restoreState(initial, window.localStorage.getItem(persistenceKey));
  } catch {
    return initial;
  }
}

export function useGreenhouseSimulator() {
  const [state, dispatch] = useReducer(simulatorReducer, undefined, initializeState);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [aiStage, setAiStage] = useState<'idle' | 'analyzing' | 'done' | 'error'>('idle');
  const [aiResult, setAiResult] = useState<RecognitionResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isDebateResetting, setIsDebateResetting] = useState(false);
  const requestId = useRef(0);
  const clock = useRef<SimulationClock | null>(null);
  const channels = useRef<RuntimeChannels | null>(null);
  const sentTargets = useRef<Record<DeviceStateKey, boolean> | null>(null);

  if (clock.current === null) {
    clock.current = new SimulationClock(() => {
      dispatch({ type: 'advance-presentation', now: new Date().toISOString() });
    }, simulationIntervalMs);
  }
  if (channels.current === null) channels.current = createRuntimeChannels();

  useEffect(() => {
    const runtime = channels.current;
    if (!runtime) return;
    dispatch({ type: 'set-runtime', runtime: { mode: runtime.mode, dataChannelStatus: runtime.dataChannel.getStatus(), controlChannelStatus: runtime.controlChannel.getStatus(), dataSourceLabel: runtime.dataSourceLabel, controlSourceLabel: runtime.controlSourceLabel } });
    const unsubscribe = runtime.mode === 'simulation' ? () => undefined : runtime.dataChannel.subscribe((packet: SensorPacket) => {
      dispatch({ type: 'ingest-sensor-packet', key: packet.key, value: packet.value, quality: packet.quality, capturedAt: packet.capturedAt, sourceId: packet.sensorId });
    });
    void runtime.dataChannel.connect().finally(() => dispatch({ type: 'set-channel-status', channel: 'data', status: runtime.dataChannel.getStatus() }));
    void runtime.controlChannel.connect().finally(() => dispatch({ type: 'set-channel-status', channel: 'control', status: runtime.controlChannel.getStatus() }));
    return () => { unsubscribe(); void runtime.dataChannel.disconnect(); void runtime.controlChannel.disconnect(); };
  }, []);

  useEffect(() => {
    const dataChannel = channels.current?.dataChannel;
    if (!dataChannel || !('publish' in dataChannel) || typeof dataChannel.publish !== 'function') return;
    dataChannel.publish(state.reading, state.sensors, state.lastUpdatedAt);
  }, [state.lastUpdatedAt, state.reading, state.sensors]);

  useEffect(() => {
    const runtime = channels.current;
    if (!runtime || runtime.mode === 'playback') return;
    const previous = sentTargets.current;
    const current = Object.fromEntries(Object.entries(state.actuators).map(([key, actuator]) => [key, actuator.target])) as Record<DeviceStateKey, boolean>;
    sentTargets.current = current;
    for (const key of Object.keys(current) as DeviceStateKey[]) {
      if (previous?.[key] === current[key] || state.actuators[key].commandStatus === 'blocked') continue;
      const deviceOnline = state.devices.some((device) => device.actuatorKey === key && device.online);
      const command = { id: `${key}:${state.lastUpdatedAt}`, device: key, target: current[key], source: state.controlMode === 'auto' ? 'auto-policy' as const : 'manual' as const, createdAt: state.lastUpdatedAt, timeoutAt: new Date(new Date(state.lastUpdatedAt).getTime() + 3_000).toISOString(), scenario: state.presentation.scenarioId, idempotencyKey: `${key}:${current[key]}:${state.controlMode}:${state.lastUpdatedAt}` };
      if (!deviceOnline) { dispatch({ type: 'control-command-result', key, target: current[key], actual: state.actuators[key].actual, status: 'rejected', error: '执行器离线，控制指令未执行' }); continue; }
      void runtime.controlChannel.execute(command, deviceOnline).then((result) => dispatch({ type: 'control-command-result', key, target: current[key], actual: result.actual, status: result.status, ...(result.error ? { error: result.error } : {}) })).finally(() => dispatch({ type: 'set-channel-status', channel: 'control', status: runtime.controlChannel.getStatus() }));
    }
  }, [state.actuators, state.controlMode, state.devices, state.lastUpdatedAt, state.presentation.scenarioId]);

  useEffect(() => {
    if (state.presentation.runStatus === 'running') clock.current?.start();
    else clock.current?.pause();
  }, [state.presentation.runStatus]);

  useEffect(() => () => clock.current?.dispose(), []);

  useEffect(() => {
    const saved = saveState(window.localStorage, state);
    setPersistenceError(saved ? null : '本地保存失败，本次操作可能在刷新后丢失。');
  }, [state]);

  const stats = useMemo(() => {
    const unresolved = state.alarms.filter((alarm) => alarm.status !== 'resolved').length;
    const efficiency = calculateEfficiencyMetrics(state.efficiency);
    return {
      unresolved,
      irrigationCount: state.irrigationCount,
      onlineRate: Math.round((state.devices.filter((device) => device.online).length / state.devices.length) * 100),
      ...efficiency,
    };
  }, [state.alarms, state.devices, state.efficiency, state.irrigationCount]);

  const setControlMode = useCallback((mode: 'auto' | 'manual') => {
    dispatch({ type: 'set-control-mode', mode, now: new Date().toISOString() });
    setActionMessage(mode === 'auto' ? '已切换为自动控制。' : '已切换为手动控制。');
  }, []);

  const toggleManualTarget = useCallback((key: DeviceStateKey) => {
    dispatch({ type: 'toggle-manual-target', key, now: new Date().toISOString() });
    setActionMessage('手动目标状态已更新，请以“实际状态”为执行结果。');
  }, []);

  const toggleDeviceOnline = useCallback((id: string) => {
    dispatch({ type: 'toggle-device-online', id, now: new Date().toISOString() });
    setActionMessage('设备在线状态已更新，相关数据、控制和报警已同步重算。');
  }, []);

  const acknowledgeAlarm = useCallback((id: string) => {
    dispatch({ type: 'acknowledge-alarm', id });
    setActionMessage('报警已确认；如异常仍持续，状态会保留为“已确认”。');
  }, []);

  const setDemoScenario = useCallback((scenario: DemoScenarioId) => {
    dispatch({ type: 'set-demo-scenario', scenario });
  }, []);

  const pausePresentation = useCallback(() => {
    clock.current?.pause();
    dispatch({ type: 'set-presentation-run-status', status: 'paused' });
    setActionMessage('演示已暂停，环境、控制和报警将保持当前快照。');
  }, []);

  const resumePresentation = useCallback(() => {
    dispatch({ type: 'set-presentation-run-status', status: 'running' });
    setActionMessage('演示已继续，将按固定随机序列推进。');
  }, []);

  const stepPresentation = useCallback(() => {
    clock.current?.step();
    setActionMessage('已单步推进一个完整模拟周期。');
  }, []);

  const selectPresentationScenario = useCallback((scenarioId: PresentationScenarioId) => {
    dispatch({ type: 'select-presentation-scenario', scenarioId, seed: state.presentation.seed, now: new Date().toISOString() });
    setActionMessage('答辩场景已切换，旧场景状态已清理。');
  }, [state.presentation.seed]);

  const resetPresentationScenario = useCallback(() => {
    dispatch({ type: 'reset-presentation-scenario', now: new Date().toISOString() });
    setActionMessage('当前场景已按相同随机种子重置，可稳定复现。');
  }, []);

  const regeneratePresentationSeed = useCallback(() => {
    dispatch({ type: 'set-presentation-seed', seed: createSeed(), now: new Date().toISOString() });
    setActionMessage('已生成新随机种子，并从当前场景起点重新开始。');
  }, []);

  const copyPresentationSeed = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(state.presentation.seed);
      setActionMessage('随机种子已复制。');
    } catch {
      setActionMessage(`无法自动复制，请手动记录随机种子：${state.presentation.seed}`);
    }
  }, [state.presentation.seed]);

  const runRecognition = useCallback(async (file: File, scenario: DemoScenarioId) => {
    const currentRequest = ++requestId.current;
    setAiStage('analyzing');
    setAiResult(null);
    setAiError(null);
    try {
      const result = await recognitionAdapter.recognize(file, scenario);
      if (currentRequest !== requestId.current) return;
      setAiResult(result);
      setAiStage('done');
      dispatch({ type: 'recognition-completed', result, now: new Date().toISOString() });
      setActionMessage('演示识别已完成；结果来自人工选定场景，不是真实模型推理。');
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      setAiStage('error');
      setAiError(error instanceof Error ? error.message : '演示识别失败。');
    }
  }, []);

  const resetDemoData = useCallback(() => {
    if (!window.confirm('确定重置所有演示设置、报警和设备状态吗？此操作不可撤销。')) return false;
    try {
      window.localStorage.removeItem(persistenceKey);
    } catch {
      setPersistenceError('本地存储无法访问，应用已重置但刷新后可能无法保留。');
    }
    dispatch({ type: 'reset', now: new Date().toISOString() });
    setAiStage('idle');
    setAiResult(null);
    setAiError(null);
    setActionMessage('演示数据已重置。');
    return true;
  }, []);

  const debateReset = useCallback(() => {
    if (isDebateResetting || !window.confirm('确认答辩复位？将回到“正常运行”、固定种子和暂停状态；历史已恢复报警与操作记录会保留。')) return;
    setIsDebateResetting(true);
    clock.current?.pause();
    dispatch({ type: 'debate-reset', now: new Date().toISOString() });
    setAiStage('idle'); setAiResult(null); setAiError(null);
    setActionMessage('答辩复位完成：正常运行、暂停、固定种子、设备安全默认状态。');
    queueMicrotask(() => setIsDebateResetting(false));
  }, [isDebateResetting]);

  const exportSnapshot = useCallback(() => {
    downloadText(`温室演示快照-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, exportDemoSnapshot(state), 'application/json;charset=utf-8');
    setActionMessage('演示快照已导出。');
  }, [state]);

  const importSnapshot = useCallback(async (file: File) => {
    try {
      const snapshot = parseDemoSnapshot(await file.text());
      clock.current?.pause();
      dispatch({ type: 'import-snapshot', state: snapshot.state, now: new Date().toISOString() });
      setActionMessage('演示快照已导入，当前状态已一致恢复。');
    } catch (error) { setActionMessage(error instanceof Error ? `导入失败：${error.message}` : '导入失败，当前状态未改变。'); }
  }, []);

  const exportOperationLog = useCallback(() => {
    if (!state.operationLog.length) { setActionMessage('暂无可导出的操作记录。'); return; }
    exportCsv(`温室操作记录-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`, ['时间', '模拟步数', '操作类型', '操作来源', '目标对象', '操作前状态摘要', '操作后状态摘要', '执行结果', '错误码'], state.operationLog.map((entry) => [entry.at, entry.simulationStep, entry.type, entry.source, entry.target, entry.before, entry.after, entry.result, entry.errorCode ?? '']));
    setActionMessage('演示操作记录已导出。');
  }, [state.operationLog]);

  return {
    ...state,
    stats,
    aiStage,
    aiResult,
    aiError,
    persistenceError,
    actionMessage,
    setControlMode,
    toggleManualTarget,
    toggleDeviceOnline,
    acknowledgeAlarm,
    setDemoScenario,
    runRecognition,
    resetDemoData,
    pausePresentation,
    resumePresentation,
    stepPresentation,
    selectPresentationScenario,
    resetPresentationScenario,
    regeneratePresentationSeed,
    copyPresentationSeed,
    exportSnapshot,
    importSnapshot,
    exportOperationLog,
    debateReset,
    isDebateResetting,
  };
}
