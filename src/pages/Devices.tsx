import { useEffect } from 'react';
import { RuntimeStatus } from '../components/RuntimeStatus';
import { ActuatorFeedback } from '../components/ActuatorFeedback';
import { originLabels } from '../utils/runtimeStatus';
import { Battery, Camera, Cpu, RadioTower } from '../components/Icons';
import { Badge, Switch } from '../components/Status';
import { ActuatorStates, Device, SensorStates, SimulatorState } from '../types';
import { formatTimestamp } from '../utils/greenhouse';
import { HardwareOverview } from '../components/HardwareOverview';

export function Devices({
  devices,
  actuators,
  toggleDeviceOnline,
  runtime, sensors, focus,
}: {
  devices: Device[];
  actuators: ActuatorStates;
  toggleDeviceOnline: (id: string) => void;
  runtime: SimulatorState['runtime'];
  sensors?: SensorStates;
  focus?: string;
}) {
  useEffect(() => { if (focus) document.querySelector('[data-focused="true"]')?.scrollIntoView?.({ block: 'center' }); }, [focus]);
  return (
    <div className="page-grid">
      <HardwareOverview showMappings />
      <section className="panel">
        {sensors && <RuntimeStatus runtime={runtime} sensors={sensors} />}
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
              <div className={`device-row ${device.online ? '' : 'device-offline-row'}`} key={device.id} data-focused={focus === device.id || focus === device.actuatorKey}>
                <div className="device-main">
                  <span className={`device-kind ${device.online ? 'online' : 'offline'}`}>{iconFor(device.kind)}</span>
                  <div><strong>{device.name}</strong><span>{device.location}{runtime.mode === 'external' ? '（配置位置，未现场核实）' : ''}</span><details><summary>设备标识</summary>{device.reportedId ?? device.id}</details></div>
                </div>
                <div className="device-meta">
                  <Badge tone={device.online ? 'good' : 'danger'}>{device.statusKnown === false ? '状态未知／过期' : device.online ? '在线' : '离线'}</Badge>
                  {runtime.mode === 'simulation' && device.battery !== undefined && <span><Battery size={16} />{device.battery}%</span>}
                  <span>{originLabels[device.sourceKind ?? 'unknown']}</span>
                  {actuator && <ActuatorFeedback state={actuator} />}
                  <span>{device.updatedAt ? '状态更新 ' + formatTimestamp(device.updatedAt) : '无状态采样'}</span>
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
