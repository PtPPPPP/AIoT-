import { Badge, Switch } from '../components/Status';
import { deviceLabels, policyDescriptions } from '../simulator/policy';
import { ActuatorStates, ControlMode, DeviceStateKey, Reading, SimulatorState } from '../types';
import { formatReading } from '../utils/greenhouse';

type ControlProps = {
  reading: Reading;
  actuators: ActuatorStates;
  controlMode: ControlMode;
  setControlMode: (mode: ControlMode) => void;
  toggleManualTarget: (key: DeviceStateKey) => void;
  runtime: SimulatorState['runtime'];
};

export function Control({ reading, actuators, controlMode, setControlMode, toggleManualTarget, runtime }: ControlProps) {
  const autoMode = controlMode === 'auto';
  return (
    <div className="page-grid">
      <section className="panel split-panel">
        <div>
          <h2>控制模式</h2>
          <p>自动模式使用统一策略；手动模式修改“目标状态”，“实际状态”仍受设备在线情况约束。</p>
        </div>
        <div className="mode-control">
          <span>{autoMode ? '自动控制' : '手动控制'}</span>
          <Switch label="切换自动与手动控制" checked={autoMode} onChange={() => setControlMode(autoMode ? 'manual' : 'auto')} disabled={runtime.mode === 'external' && runtime.controlChannelStatus === 'unconfigured'} />
        </div>
      </section>

      <section className="control-grid">
        {(Object.keys(actuators) as DeviceStateKey[]).map((key) => {
          const state = actuators[key];
          return (
            <div className={`control-card ${state.commandStatus === 'blocked' ? 'blocked-card' : ''}`} key={key}>
              <div>
                <h3>{deviceLabels[key]}</h3>
                <p>{controlHint(key, reading)}</p>
              </div>
              <Switch label={`设置${deviceLabels[key]}目标状态`} checked={state.target} onChange={() => toggleManualTarget(key)} disabled={autoMode || runtime.mode === 'external' && runtime.controlChannelStatus !== 'connected'} />
              <div className="control-statuses">
                <Badge tone={state.target ? 'blue' : 'muted'}>目标：{state.target ? '开启' : '关闭'}</Badge>
                <Badge tone={state.actual ? 'good' : state.commandStatus === 'blocked' ? 'danger' : 'muted'}>实际：{state.actual ? '运行中' : '已停止'}</Badge>
                <Badge tone={state.executionStatus === 'succeeded' ? 'good' : 'warn'}>命令：{state.executionStatus}</Badge>
              </div>
              {state.blockedReason && <p className="blocked-reason">{state.blockedReason}</p>}
            </div>
          );
        })}
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <h2>统一自动控制策略</h2>
            <p>页面文案和控制引擎共用同一份配置；启停回差用于避免在单一阈值附近频繁开关。</p>
          </div>
          <Badge tone={autoMode ? 'good' : 'warn'}>{autoMode ? '策略生效中' : '手动接管'}</Badge>
        </div>
        <div className="rule-grid">
          {policyDescriptions.map((item) => (
            <div className="rule-card" key={item.key}>
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
  if (key === 'waterPump') return `当前土壤湿度 ${formatReading(reading.soilMoisture, '%')}。`;
  if (key === 'fan') return `当前温度 ${formatReading(reading.temperature, '°C')}，CO₂ ${formatReading(reading.co2, ' ppm')}。`;
  if (key === 'growLight') return `当前光照 ${formatReading(reading.light, ' lux')}，弱光时补光。`;
  return `当前光照 ${formatReading(reading.light, ' lux')}，强光时遮阳。`;
}
