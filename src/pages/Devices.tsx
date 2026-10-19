import { Battery, Camera, Cpu, RadioTower, ToggleLeft } from '../components/Icons';
import { Badge, Switch } from '../components/Status';
import { ActuatorStates, Device, SimulatorState } from '../types';
import { formatTimestamp } from '../utils/greenhouse';
import { edgeNodeTypeLabel } from '../config/edgeNodeConfig';
import { HardwareOverview } from '../components/HardwareOverview';

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
      <HardwareOverview showMappings />
      <section className="panel">
        <p>运行模式：{runtime.mode === 'simulation' ? '答辩演示' : runtime.mode} · 边缘节点：{runtime.edgeNodeName}（{edgeNodeTypeLabel(runtime.edgeNodeType)}）· 数据来源：{runtime.dataSourceLabel}（{runtime.dataChannelStatus}）· 控制通道：{runtime.controlSourceLabel}（{runtime.controlChannelStatus}）· AI 来源：{runtime.aiSourceLabel}</p>
        <div className="section-title">
          <div>
            <h2>{runtime.mode === 'simulation' ? '仿真业务设备管理' : '网关业务设备状态'}</h2>
            <p>{runtime.mode === 'simulation' ? '以下传感器、摄像头、执行器和软件网关均为仿真对象，不代表已配齐或接线。传感器与执行器离线会阻断对应模拟数据或控制，软件网关开关仅演示自身状态。' : '设备在线状态由边缘网关提供，与上方已持有的硬件清单分别展示。'}</p>
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
                  <Badge tone={device.online ? 'good' : 'danger'}>{runtime.mode === 'simulation' ? '模拟' : ''}{device.online ? '在线' : '离线'}</Badge>
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
