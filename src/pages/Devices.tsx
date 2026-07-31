import { Battery, Camera, Cpu, RadioTower, ToggleLeft } from '../components/Icons';
import { Badge, Switch } from '../components/Status';
import { ActuatorStates, Device, SimulatorState } from '../types';
import { formatTimestamp } from '../utils/greenhouse';
import { edgeNodeTypeLabel } from '../config/edgeNodeConfig';

export function Devices({
  devices,
  actuators,
  toggleDeviceOnline,
  runtime,
}: {
  devices: Device[];
  actuators: ActuatorStates;
  toggleDeviceOnline: (id: string) => void;
  runtime: SimulatorState['runtime'];
}) {
  return (
    <div className="page-grid">
      <section className="panel">
        <p>运行模式：{runtime.mode === 'simulation' ? '答辩演示' : runtime.mode} · 边缘节点：{runtime.edgeNodeName}（{edgeNodeTypeLabel(runtime.edgeNodeType)}）· 数据来源：{runtime.dataSourceLabel}（{runtime.dataChannelStatus}）· 控制通道：{runtime.controlSourceLabel}（{runtime.controlChannelStatus}）· AI 来源：{runtime.aiSourceLabel}</p>
        <div className="section-title">
          <div>
            <h2>IoT 设备演示管理</h2>
            <p>离线会真实阻断本地模拟数据或控制执行，恢复在线后下一帧自动恢复业务流。</p>
          </div>
          <Badge tone="blue">{runtime.mode === 'simulation' ? '可模拟在线/离线' : '外部状态由边缘网关上报'}</Badge>
        </div>

        <div className="device-list">
          {devices.map((device) => {
            const actuator = device.actuatorKey ? actuators[device.actuatorKey] : null;
            return (
              <div className={`device-row ${device.online ? '' : 'device-offline-row'}`} key={device.id}>
                <div className="device-main">
                  <span className={`device-kind ${device.online ? 'online' : 'offline'}`}>{iconFor(device.kind)}</span>
                  <div><strong>{device.name}</strong><span>{device.id} · {device.location}</span></div>
                </div>
                <div className="device-meta">
                  <Badge tone={device.online ? 'good' : 'danger'}>{device.online ? '在线' : '离线'}</Badge>
                  {device.battery !== undefined && <span><Battery size={16} />{device.battery}%</span>}
                  {actuator && <span><ToggleLeft size={16} />目标 {actuator.target ? '开' : '关'} / 实际 {actuator.actual ? '运行' : '停止'}</span>}
                  <span>{device.online ? `状态更新 ${formatTimestamp(device.updatedAt)}` : '数据/控制已中断'}</span>
                  <Switch label={`切换${device.name}在线状态`} checked={device.online} onChange={() => toggleDeviceOnline(device.id)} disabled={runtime.mode !== 'simulation'} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function iconFor(kind: Device['kind']) {
  if (kind === 'camera') return <Camera size={20} />;
  if (kind === 'gateway') return <RadioTower size={20} />;
  return <Cpu size={20} />;
}
