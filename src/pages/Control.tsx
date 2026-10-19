import { useEffect } from 'react';
import { Badge, Switch } from '../components/Status';
import { deviceLabels, policyDescriptions } from '../simulator/policy';
import { ActuatorStates, Alarm, ControlMode, ControlRecord, Device, DeviceStateKey, Reading, SensorStates, SimulatorState } from '../types';
import { controlAvailable, controlReason, deviceKeys } from '../utils/runtimeStatus';
import { ActuatorFeedback } from '../components/ActuatorFeedback';
import { RuntimeStatus } from '../components/RuntimeStatus';
import { HistoryReview } from '../components/HistoryReview';

type ControlProps = {
  devices: Device[]; reading: Reading; sensors: SensorStates; actuators: ActuatorStates; controlMode: ControlMode;
  setControlMode: (mode: ControlMode) => void; toggleManualTarget: (key: DeviceStateKey) => void;
  armControl: (armed: boolean) => void; runtime: SimulatorState['runtime'];
  controlRecords: ControlRecord[]; alarms: Alarm[]; history: Reading[]; focusDevice?: DeviceStateKey; focusRecords?: boolean;
};
export function Control({ devices, reading, sensors, actuators, controlMode, setControlMode, toggleManualTarget, runtime, armControl, controlRecords, history, alarms, focusDevice, focusRecords }: ControlProps) {
  useEffect(() => { if (focusDevice) document.querySelector(focusRecords ? '#control-history' : '[data-focused="true"]')?.scrollIntoView?.({ block: 'center' }); }, [focusDevice, focusRecords]);
  const autoMode = controlMode === 'auto';
  const available = controlAvailable(runtime);
  const switchMode = () => {
    if (runtime.mode === 'external' && !window.confirm('影响全部四个设备：切换自动将按当前有效指标重新计算目标；切换手动将保留当前目标直到你修改。可能向真实设备发送命令，确认继续？')) return;
    setControlMode(autoMode ? 'manual' : 'auto');
  };
  return <div className="page-grid">
    <RuntimeStatus runtime={runtime} sensors={sensors} />
    <section className="panel split-panel">
      <div><h2>控制模式：{autoMode ? '自动控制' : '手动控制'}</h2>
        <p>影响滴灌水泵、排风风扇、LED 补光灯和遮阳设备。自动模式按有效指标与回差规则重新计算目标；转手动时保留当前目标，逐台修改。命令成功不能替代现场动作反馈。</p>
        {runtime.mode === 'external' && <p>当前策略由浏览器计算；页面关闭后无法保证自动策略继续运行。边缘保护未验证。</p>}
      </div>
      <Switch label="切换自动与手动控制" checked={autoMode} onChange={switchMode} disabled={!available} />
    </section>
    {runtime.mode === 'external' && <section className="panel">
      <h2>本次会话控制授权</h2>
      <p>默认只监测。授权可能立即按当前目标发送真实控制命令；连接失败时不自动重试命令，刷新后需重新授权。停止授权只禁止新命令，不会关闭设备。</p>
      <button className="text-button" disabled={!runtime.controlArmed && (runtime.externalInitialSyncStatus !== 'ready' || runtime.dataChannelStatus !== 'connected')} onClick={() => {
        if (runtime.controlArmed) armControl(false);
        else if (window.confirm('授权本次浏览器会话向网关发送真实设备控制命令？请先现场确认联锁和反馈。')) armControl(true);
      }}>{runtime.controlArmed ? '停止本次控制授权' : '授权本次控制会话'}</button>
    </section>}
    <section className="control-grid">{deviceKeys.map(key => <article className="control-card" data-focused={focusDevice === key} key={key}>
      <h3>{deviceLabels[key]}</h3><ActuatorFeedback state={actuators[key]} />
      {devices.some(d => d.actuatorKey === key && (!d.online || d.statusKnown === false)) && <p className="blocked-reason">设备离线或在线状态待核实，不能发送新指令。</p>}
      <p>{controlReason(key, controlMode, reading, sensors)}</p>
      <Switch label={'设置' + deviceLabels[key] + '目标状态'} checked={actuators[key].target} onChange={() => toggleManualTarget(key)} disabled={autoMode || !available || !devices.some(d => d.actuatorKey === key && d.online && d.statusKnown !== false)} />
    </article>)}</section>
    <section className="panel"><h2>统一自动控制策略</h2><Badge tone={autoMode && available ? 'blue' : 'muted'}>{autoMode && available ? '策略计算中，以反馈为准' : '未授权或自动策略暂停'}</Badge>
      <div className="rule-grid">{policyDescriptions.map(item => <div className="rule-card" key={item.key}><strong>{item.rule}</strong><span>{item.action}</span><p>{item.target}</p></div>)}</div>
    </section>
    <section className="panel"><h2>边缘保护与有时限接管</h2>
      <p>当前协议未声明可靠的接管租约、最大连续运行时间、掉线保护和重启恢复能力，均标记为未验证。不能承诺到期自动恢复，也不支持设置倒计时接管。</p>
      <p>数据失效：阻止依赖该数据的新自动指令并保留最后目标与反馈。控制回执超时：标记超时，不能推断设备已停止。重连：只读取新状态，不自动重发失败命令。服务重启：需要网关报告新反馈，保护效果待边缘端实现与隔离验证。</p>
      <details><summary>待边缘服务实现的协议设计</summary><p>接管请求应包含设备范围、租约编号、服务端到期时间和按设备配置的到期策略；网关持久化并独立执行到期和重启恢复，返回保护能力与生效回执。未收到能力声明和回执前，前端不展示保护已生效。不得用统一关闭策略替代各设备联锁。</p></details>
    </section>
    <HistoryReview key={focusDevice ?? 'all'} history={history} records={controlRecords} alarms={alarms} focusDevice={focusDevice} />
  </div>;
}
