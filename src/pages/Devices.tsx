import { Battery, Camera, Cpu, RadioTower, ToggleLeft } from '../components/Icons';
import { Badge, Switch } from '../components/Status';
import { Device } from '../types';

export function Devices({ devices, toggleDeviceOnline }: { devices: Device[]; toggleDeviceOnline: (id: string) => void }) {
  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>IoT 设备管理</h2>
            <p>展示传感器、摄像头、执行器和网关的联网状态。</p>
          </div>
          <Badge tone="blue">可模拟在线/离线</Badge>
        </div>

        <div className="device-list">
          {devices.map((device) => (
            <div className="device-row" key={device.id}>
              <div className="device-main">
                <span className={`device-kind ${device.online ? 'online' : 'offline'}`}>
                  {iconFor(device.kind)}
                </span>
                <div>
                  <strong>{device.name}</strong>
                  <span>{device.id} · {device.location}</span>
                </div>
              </div>
              <div className="device-meta">
                <Badge tone={device.online ? 'good' : 'danger'}>{device.online ? '在线' : '离线'}</Badge>
                <span><Battery size={16} />{device.battery ?? 100}%</span>
                <span><ToggleLeft size={16} />{device.running ? '运行中' : '待机'}</span>
                <span>{device.updatedAt}</span>
                <Switch checked={device.online} onChange={() => toggleDeviceOnline(device.id)} />
              </div>
            </div>
          ))}
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
