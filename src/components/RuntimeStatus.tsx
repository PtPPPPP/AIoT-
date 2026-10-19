import { SensorStates, SimulatorState } from '../types';
import { channelLabels, controlAvailable, dataSummary, modeLabels } from '../utils/runtimeStatus';

export function RuntimeStatus({ runtime, sensors }: { runtime: SimulatorState['runtime']; sensors: SensorStates }) {
  return <div className="runtime-status" aria-label="统一运行状态">
    <span className="status-pill blue">运行模式：{modeLabels[runtime.mode]}</span>
    <span className="status-pill muted">数据：{dataSummary(sensors)}</span>
    <span className="status-pill muted">网关：{runtime.mode === 'external' ? channelLabels[runtime.dataChannelStatus] : '未使用外部网关'}</span>
    <span className={`status-pill ${controlAvailable(runtime) ? 'blue' : 'warn'}`}>控制：{controlAvailable(runtime) ? runtime.mode === 'simulation' ? '模拟设备通道' : '本次会话已授权' : runtime.mode === 'playback' ? '回放禁用' : '监测中，未授权或不可用'}</span>
    {runtime.mode === 'external' && <span className="status-pill muted">配置为外部接入不代表硬件在线</span>}
    <details><summary>连接详情</summary><p>数据通道：{channelLabels[runtime.dataChannelStatus]} · 控制通道：{channelLabels[runtime.controlChannelStatus]}</p><p>上次健康同步：{runtime.lastHealthCheckAt ? new Date(runtime.lastHealthCheckAt).toLocaleString('zh-CN') : '尚未成功'} · 最近有效数据：{runtime.lastValidDataAt ? new Date(runtime.lastValidDataAt).toLocaleString('zh-CN') : '暂无'}</p>{runtime.lastError && <p>连接错误：{runtime.lastError}</p>}</details>
  </div>;
}
