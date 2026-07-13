import { controlRules } from '../data/mockData';
import { DeviceStateKey, DeviceStates, Reading } from '../types';
import { deviceLabels } from '../utils/greenhouse';
import { Badge, Switch } from '../components/Status';

type ControlProps = {
  reading: Reading;
  deviceStates: DeviceStates;
  autoMode: boolean;
  setAutoMode: (value: boolean) => void;
  toggleDevice: (key: DeviceStateKey) => void;
};

export function Control({ reading, deviceStates, autoMode, setAutoMode, toggleDevice }: ControlProps) {
  return (
    <div className="page-grid">
      <section className="panel split-panel">
        <div>
          <h2>控制模式</h2>
          <p>自动模式会按阈值执行；手动模式可直接切换设备。</p>
        </div>
        <div className="mode-control">
          <span>{autoMode ? '自动控制' : '手动控制'}</span>
          <Switch checked={autoMode} onChange={() => setAutoMode(!autoMode)} />
        </div>
      </section>

      <section className="control-grid">
        {(Object.keys(deviceStates) as DeviceStateKey[]).map((key) => (
          <div className="control-card" key={key}>
            <div>
              <h3>{deviceLabels[key]}</h3>
              <p>{controlHint(key, reading)}</p>
            </div>
            <Switch checked={deviceStates[key]} onChange={() => toggleDevice(key)} disabled={autoMode} />
            <Badge tone={deviceStates[key] ? 'good' : 'muted'}>{deviceStates[key] ? '运行中' : '已关闭'}</Badge>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <h2>自动控制逻辑</h2>
            <p>答辩时可用这里说明“数据采集 - 策略判断 - 设备执行”</p>
          </div>
          <Badge tone={autoMode ? 'good' : 'warn'}>{autoMode ? '策略生效中' : '手动接管'}</Badge>
        </div>
        <div className="rule-grid">
          {controlRules.map((item) => (
            <div className="rule-card" key={item.rule}>
              <strong>{item.rule}</strong>
              <span>{item.action}</span>
              <p>{item.target}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function controlHint(key: DeviceStateKey, reading: Reading) {
  if (key === 'waterPump') return `当前土壤湿度 ${reading.soilMoisture}%，低湿时自动滴灌。`;
  if (key === 'fan') return `当前温度 ${reading.temperature}°C，CO₂ ${reading.co2} ppm。`;
  if (key === 'growLight') return `当前光照 ${reading.light.toLocaleString()} lux，弱光时补光。`;
  return `强光时自动遮阳，降低叶片灼伤和水分蒸发。`;
}
