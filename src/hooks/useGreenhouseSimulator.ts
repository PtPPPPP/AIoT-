import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { calculateEfficiencyMetrics } from '../simulator/metricsEngine';
import { storageKey, restoreState, saveState } from '../simulator/persistence';
import { simulationIntervalMs } from '../simulator/policy';
import { createInitialSimulatorState, simulatorReducer } from '../simulator/simulatorReducer';
import { createSeed } from '../simulator/random';
import { SimulationClock } from '../simulator/simulationClock';
import { createRuntimeChannels, RuntimeChannels } from '../channels/createRuntimeChannels';
import { SensorPacket } from '../channels/data/types';
import { EdgeGatewayDataChannel } from '../channels/data/EdgeGatewayDataChannel';
import { EdgeGatewayControlChannel } from '../channels/control/EdgeGatewayControlChannel';
import { exportDemoSnapshot, parseDemoSnapshot } from '../snapshots/demoSnapshot';
import { downloadText, exportCsv } from '../utils/exportFile';
import { runtimeConfig } from '../config/runtimeConfig';
import { controlAvailable, controlReason, localDay } from '../utils/runtimeStatus';
import { DemoScenarioId, DeviceStateKey, PresentationScenarioId, RecognitionResult } from '../types';

function initializeState() {
  const initial = createInitialSimulatorState(new Date().toISOString());
  try {
    return restoreState(initial, window.localStorage.getItem(storageKey(initial.runtime.mode)));
  } catch {
    return initial;
  }
}

export function useGreenhouseSimulator() {
  const [observedAt, setObservedAt] = useState(new Date().toISOString());
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
    dispatch({
      type: 'set-runtime',
      runtime: {
        mode: runtime.mode,
        edgeNodeType: runtime.edgeNode.type,
        edgeNodeName: runtime.edgeNode.displayName,
        dataChannelStatus: runtime.dataChannel.getStatus(),
        controlChannelStatus: runtime.controlChannel.getStatus(),
        dataSourceLabel: runtime.dataSourceLabel,
        controlSourceLabel: runtime.controlSourceLabel,
        aiProvider: runtime.aiInferenceChannel.source,
        aiSourceLabel: runtime.aiInferenceChannel.sourceLabel,
        externalInitialSyncStatus: runtime.mode === 'external' ? 'idle' : 'ready',
        controlArmed: runtime.mode === 'simulation',
      },
    });
    const unsubscribe = runtime.mode === 'simulation' ? () => undefined : runtime.dataChannel.subscribe((packet: SensorPacket) => {
      dispatch({ type: 'ingest-sensor-packet', key: packet.key, value: packet.value, quality: packet.quality, capturedAt: packet.capturedAt, sourceId: packet.sensorId, sourceKind: packet.sourceKind, source: packet.source, receivedAt: packet.receivedAt });
    });
    const onActuators = (items: import('../channels/data/EdgeGatewayDataChannel').ExternalActuatorSnapshot[]) => dispatch({ type: 'external-sync-actuators', actuators: items.map(item => ({ ...item, key: item.logicalDevice })), now: new Date().toISOString() });
    const unsubscribeActuators = runtime.dataChannel instanceof EdgeGatewayDataChannel ? runtime.dataChannel.subscribeActuators(onActuators) : () => undefined;
    const unsubscribeDataStatus = runtime.dataChannel.subscribeStatus((status) => dispatch({ type: 'set-channel-status', channel: 'data', status }));
    const unsubscribeControlStatus = runtime.controlChannel.subscribeStatus((status) => dispatch({ type: 'set-channel-status', channel: 'control', status }));
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const connect = async () => {
      if (runtime.mode === 'external' && runtime.dataChannel instanceof EdgeGatewayDataChannel && runtime.controlChannel instanceof EdgeGatewayControlChannel) {
        dispatch({ type: 'external-sync-status', status: 'checking_health' });
        try {
          const snapshots = await runtime.dataChannel.synchronizeInitialState(); if (cancelled) return;
          dispatch({ type: 'external-sync-status', status: 'syncing_actuators' });
          dispatch({ type: 'external-sync-actuators', actuators: snapshots.map((item) => ({ ...item, key: item.logicalDevice })), now: new Date().toISOString() });
          runtime.controlChannel.markReady(runtime.dataChannel.getStatus()); dispatch({ type: 'external-sync-status', status: 'ready', now: new Date().toISOString() });
          await runtime.dataChannel.connect();
        } catch (error) { if (!cancelled) { dispatch({ type: 'external-sync-status', status: 'failed', error: error instanceof Error ? error.message : '连接失败' }); retryTimer = setTimeout(() => { void connect(); }, 5000); } }
      } else { await runtime.dataChannel.connect(); await runtime.controlChannel.connect(); }
    };
    void connect();
    return () => { cancelled = true; clearTimeout(retryTimer); unsubscribeActuators(); unsubscribe(); unsubscribeDataStatus(); unsubscribeControlStatus(); void runtime.dataChannel.disconnect(); void runtime.controlChannel.disconnect(); };
  }, []);

  useEffect(() => {
    const dataChannel = channels.current?.dataChannel;
    if (!dataChannel || !('publish' in dataChannel) || typeof dataChannel.publish !== 'function') return;
    dataChannel.publish(state.reading, state.sensors, state.lastUpdatedAt);
  }, [state.lastUpdatedAt, state.reading, state.sensors]);

  useEffect(() => {
    const runtime = channels.current;
    if (!runtime || runtime.mode !== 'external') return;
    const previous = sentTargets.current;
    const current = Object.fromEntries(Object.entries(state.actuators).map(([key, actuator]) => [key, actuator.target])) as Record<DeviceStateKey, boolean>;
    sentTargets.current = current;
    if (!controlAvailable(state.runtime)) return;
    for (const key of Object.keys(current) as DeviceStateKey[]) {
      const actuator = state.actuators[key];
      if (previous?.[key] === current[key] || actuator.commandStatus === 'blocked') continue;
      if (runtime.mode === 'external' && (!actuator.actualKnown || actuator.actual === current[key] || !actuator.actualUpdatedAt || Date.now() - Date.parse(actuator.actualUpdatedAt) > runtimeConfig.staleAfterMs)) continue;
      const deviceOnline = state.devices.some(device => device.actuatorKey === key && device.online && device.statusKnown !== false);
      const now = new Date().toISOString();
      const command = { id: crypto.randomUUID(), device: key, target: current[key], source: state.controlMode === 'auto' ? 'auto-policy' as const : 'manual' as const, createdAt: now, timeoutAt: new Date(Date.parse(now) + runtimeConfig.requestTimeoutMs).toISOString(), scenario: state.presentation.scenarioId, idempotencyKey: crypto.randomUUID() };
      if (!deviceOnline) continue;
      dispatch({ type: 'control-command-start', record: { id: command.id, at: now, device: key, target: current[key], status: 'sent', reason: controlReason(key, state.controlMode, state.reading, state.sensors) } });
      void runtime.controlChannel.execute(command, deviceOnline).then(result => dispatch({ type: 'control-command-result', key, target: current[key], actual: result.actual, status: result.status, error: result.error, now: new Date().toISOString(), commandId: command.id })).finally(() => dispatch({ type: 'set-channel-status', channel: 'control', status: runtime.controlChannel.getStatus() }));
    }
  }, [state.actuators, state.controlMode, state.devices, state.presentation.scenarioId, state.runtime, state.reading, state.sensors]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().toISOString(); setObservedAt(now);
      dispatch({ type: 'expire-data', now, staleAfterMs: runtimeConfig.staleAfterMs });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (state.runtime.mode === 'simulation' && state.presentation.runStatus === 'running') clock.current?.start();
    else clock.current?.pause();
  }, [state.presentation.runStatus, state.runtime.mode]);

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
      irrigationCount: state.irrigationStarts.filter(at => localDay(at) === localDay(observedAt)).length,
      onlineRate: Math.round((state.devices.filter((device) => device.online && device.statusKnown !== false).length / state.devices.length) * 100),
      ...efficiency,
      ...(state.runtime.mode !== 'simulation' ? { waterSaving: null, energySaving: null, explanation: '无流量计、电表与可信基线；未计量节水节能。' } : {}),
    };
  }, [state.alarms, state.devices, state.efficiency, state.irrigationStarts, state.runtime.mode, observedAt]);

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
      const aiChannel = channels.current?.aiInferenceChannel;
      if (!aiChannel) throw new Error('AI 推理通道尚未初始化。');
      const result = await aiChannel.recognize(file, scenario);
      if (currentRequest !== requestId.current) return;
      setAiResult(result);
      setAiStage('done');
      dispatch({ type: 'recognition-completed', result, now: new Date().toISOString() });
      setActionMessage(result.mode === 'demo'
        ? '模拟识别已完成；结果来自人工选定场景，不是真实模型推理。'
        : '边缘网关 AI 推理已返回；结果仅用于识别、报警和建议。');
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      setAiStage('error');
      setAiError(error instanceof Error ? error.message : 'AI 推理失败。');
    }
  }, []);

  const resetDemoData = useCallback(() => {
    if (channels.current?.mode !== 'simulation') return false;
    if (!window.confirm('确定重置所有演示设置、报警和设备状态吗？此操作不可撤销。')) return false;
    try {
      window.localStorage.removeItem(storageKey('simulation'));
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
    if (channels.current?.mode !== 'simulation') return;
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
    if (channels.current?.mode !== 'simulation') { setActionMessage('外部接入与回放禁止导入演示快照。'); return; }
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
    observedAt,
    handleAlarm: (id: string, note: string, completed: boolean) => dispatch({ type: 'handle-alarm', id, note, completed, now: new Date().toISOString() }),
    reviewAi: (decision: 'confirmed' | 'corrected' | 'recheck', note: string) => {
      if (aiResult) dispatch({ type: 'review-ai', review: { at: new Date().toISOString(), fingerprint: aiResult.contentFingerprint, mode: aiResult.mode, label: aiResult.label, decision, note: note.trim().slice(0, 2000) } });
    },
    armControl: (armed: boolean) => dispatch({ type: 'arm-control', armed }),
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
