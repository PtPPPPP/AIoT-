import { ActuatorState, Alarm, ChannelStatus, ControlMode, DataOrigin, Device, DeviceStateKey, Reading, SensorKey, SensorStates, SimulatorState } from '../types';
import { greenhousePolicy, policyDescriptions, sensorLabels } from '../simulator/policy';
import { runtimeConfig } from '../config/runtimeConfig';

export const modeLabels = { simulation: '答辩仿真', external: '外部接入', playback: '数据回放' };
export const qualityLabels = { good: '正常数据', stale: '数据过期', offline: '离线', invalid: '无效数据', error: '故障数据' };
export const originLabels: Record<DataOrigin, string> = { simulation: '仿真数据', hardware: '硬件上报（待现场核验）', playback: '回放数据', unknown: '来源待核实' };
export const channelLabels: Record<ChannelStatus, string> = { unconfigured: '未配置', connecting: '连接中', connected: '通信正常', degraded: '通信降级', disconnected: '已断开', failed: '通信失败', stale: '数据过期', 'partial-offline': '部分离线' };
export const executionLabels: Record<ActuatorState['executionStatus'], string> = { pending: '待发送', sent: '已发送，等待回执', acknowledged: '网关已接受', succeeded: '网关报告成功', failed: '执行失败', timed_out: '等待回执超时', rejected: '命令被拒绝', cancelled: '未下发或已取消' };
export const alarmStatusLabels = { active: '未确认', acknowledged: '已确认，异常未恢复', resolved: '数据已恢复' };
export const levelLabels = { info: '提示', warning: '警告', critical: '严重' };
export const sensorKeys: SensorKey[] = ['temperature', 'humidity', 'light', 'soilMoisture', 'co2'];
export const deviceKeys: DeviceStateKey[] = ['waterPump', 'fan', 'growLight', 'shade'];
export const inputs: Record<DeviceStateKey, SensorKey[]> = { waterPump: ['soilMoisture'], fan: ['temperature', 'co2'], growLight: ['light'], shade: ['light'] };
export function actualLabel(state: ActuatorState) { return !state.actualKnown ? '状态未知' : state.actual ? '运行' : '停止'; }
export function feedbackStale(state: ActuatorState, now = Date.now()) { return state.sourceKind !== 'simulation' && (!state.actualUpdatedAt || now - Date.parse(state.actualUpdatedAt) > runtimeConfig.staleAfterMs); }
export function feedbackLabel(state: ActuatorState) {
  return ({ physical: '物理反馈上报', output: '输出通道反馈，动作未确认', gateway: '网关状态，反馈层级未声明', simulation: '模拟执行回执' })[state.feedbackLevel ?? 'gateway'];
}
export function controlAvailable(runtime: SimulatorState['runtime']) {
  return runtime.mode !== 'playback' && runtime.controlArmed && (runtime.mode === 'simulation' || runtime.externalInitialSyncStatus === 'ready' && runtime.dataChannelStatus === 'connected' && runtime.controlChannelStatus === 'connected');
}
export function dataSummary(sensors: SensorStates) {
  return [...new Set(Object.values(sensors).map(s => originLabels[s.sourceKind ?? 'unknown']))].join(' / ');
}
export function controlReason(key: DeviceStateKey, mode: ControlMode, reading: Reading, sensors: SensorStates) {
  const values = inputs[key].map(k => `${sensorLabels[k]} ${sensors[k].quality === 'good' && reading[k] !== null ? reading[k] : '不可用'}（${qualityLabels[sensors[k].quality]}）`).join('、');
  const rule = policyDescriptions.find(p => p.key === key)!;
  return `${mode === 'manual' ? '人工目标，自动策略暂停' : '确定性规则；回差区间保持上一目标'}；${values}；${rule.rule}；${rule.target}${key === 'fan' ? `；停止条件：温度 < ${greenhousePolicy.fanStopTemperature}°C 且 CO₂ < ${greenhousePolicy.fanStopCo2} ppm` : ''}`;
}
export function alarmDeviceKeys(alarm: Alarm, devices: Device[]): DeviceStateKey[] {
  const direct = devices.find(d => d.id === alarm.sourceId || d.reportedId === alarm.sourceId)?.actuatorKey;
  if (direct) return [direct];
  if (alarm.type.includes('soil')) return ['waterPump'];
  if (alarm.type.includes('temperature') || alarm.type.includes('co2')) return ['fan'];
  if (alarm.type.includes('light')) return ['growLight', 'shade'];
  const keys = devices.find(d => d.id === alarm.sourceId || d.reportedId === alarm.sourceId)?.sensorKeys ?? [];
  return deviceKeys.filter(k => inputs[k].some(input => keys.includes(input)));
}
export function nextCheck(alarm: Alarm) {
  if (alarm.type.includes('control') || alarm.type.includes('actuator')) return '检查供电、驱动、联锁与现场动作；超时可能已执行，核对反馈后再决定是否重试。';
  if (alarm.type.includes('sensor') || alarm.type.includes('quality')) return '检查传感器供电和通信，等待新的有效采样；旧数据不能证明异常已恢复。';
  if (alarm.type.includes('ai')) return '现场复查作物与拍摄条件，在 AI 识别页记录确认或纠正。';
  return '核对现场环境和关联设备反馈；等待指标恢复，再记录人工检查结果。';
}
export function conclusion(state: Pick<SimulatorState, 'alarms' | 'sensors' | 'reading' | 'actuators' | 'runtime'>) {
  const failed = Object.values(state.actuators).some(a => ['failed', 'timed_out', 'rejected'].includes(a.executionStatus));
  if (failed) return '需要人工介入';
  if (sensorKeys.some(k => state.sensors[k].quality !== 'good' || state.reading[k] === null) || Object.values(state.actuators).some(a => !a.actualKnown || state.runtime.mode === 'external' && feedbackStale(a)) || state.runtime.mode === 'external' && state.runtime.dataChannelStatus !== 'connected') return '数据不足';
  const unresolved = state.alarms.filter(a => a.status !== 'resolved');
  if (unresolved.length) {
    const actionable = unresolved.every(a => (a.context?.deviceKeys.length ?? 0) > 0 && a.context!.deviceKeys.some(k => {
      const device = state.actuators[k];
      return device.target && (['pending', 'sent', 'acknowledged'].includes(device.executionStatus) || device.actualKnown && device.actual);
    }));
    return actionable && state.runtime.controlArmed ? '自动处理中' : '需要人工介入';
  }
  return '正常运行';
}
export function localDay(value: string) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function duration(from: string, to: string) { const seconds = Math.max(0, Math.floor((Date.parse(to) - Date.parse(from)) / 1000)); return Number.isFinite(seconds) ? seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds / 60)} 分钟` : '未知'; }
