import { SimulatorState } from '../types';
import { collectSystemAlarmConditions, reconcileSystemAlarms } from './alarmEngine';
import { alarmDeviceKeys, controlReason, deviceKeys } from '../utils/runtimeStatus';

export function reconcileEvidence(state: SimulatorState, now: string): SimulatorState {
  const unknown = new Set(Object.values(state.sensors).filter(s => s.quality !== 'good').map(s => s.sourceId));
  state.devices.filter(d => d.statusKnown === false).forEach(d => unknown.add(d.id));
  const alarms = reconcileSystemAlarms(state.alarms, collectSystemAlarmConditions(state.reading, state.sensors, state.devices, state.actuators), now, unknown)
    .map(alarm => {
      if (alarm.context || alarm.status === 'resolved') return alarm;
      const keys = alarmDeviceKeys(alarm, state.devices);
      return { ...alarm, source: state.runtime.mode === 'external' ? 'external' as const : 'simulation' as const, context: {
        location: state.devices.find(d => d.id === alarm.sourceId || d.reportedId === alarm.sourceId)?.location ?? '位置未核实',
        deviceKeys: keys,
        actions: keys.map(k => controlReason(k, state.controlMode, state.reading, state.sensors)),
      } };
    });
  return { ...state, alarms };
}

export function recordSimulationTransition(before: SimulatorState, after: SimulatorState, now: string): SimulatorState {
  if (after.runtime.mode !== 'simulation') return after;
  const records = deviceKeys.filter(k => before.actuators[k].actual !== after.actuators[k].actual || before.actuators[k].target !== after.actuators[k].target || before.actuators[k].executionStatus !== after.actuators[k].executionStatus).map(key => ({
    id: `simulation:${key}:${now}`, at: now, device: key, target: after.actuators[key].target, actual: after.actuators[key].actual,
    status: after.actuators[key].executionStatus, reason: controlReason(key, after.controlMode, after.reading, after.sensors),
    error: after.actuators[key].blockedReason,
  }));
  const started = !before.actuators.waterPump.actual && after.actuators.waterPump.actual;
  return { ...after, controlRecords: [...(before.controlRecords ?? []), ...records].slice(-500),
    irrigationStarts: [...(before.irrigationStarts ?? []), ...(started ? [now] : [])].slice(-1000),
    irrigationCount: before.irrigationCount + (started ? 1 : 0),
    actuators: Object.fromEntries(deviceKeys.map(k => [k, { ...after.actuators[k], actualUpdatedAt: now, feedbackLevel: 'simulation', sourceKind: 'simulation' }])) as SimulatorState['actuators'],
  };
}
