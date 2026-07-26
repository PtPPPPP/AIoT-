import { Cpu, Droplets, Fan, Lightbulb, ShieldAlert, SunMedium, Thermometer, Wind } from '../components/Icons';
import { EnvironmentTrend, LightCo2Trend } from '../components/Charts';
import { MetricCard } from '../components/MetricCard';
import { Badge } from '../components/Status';
import { PresentationConsole } from '../components/PresentationConsole';
import { DemoGuide } from '../components/DemoGuide';
import { ActuatorStates, PresentationState, Reading, SensorStates } from '../types';
import { deviceLabels, greenhousePolicy } from '../simulator/policy';
import { formatReading, sensorRisk } from '../utils/greenhouse';

type DashboardProps = {
  reading: Reading;
  history: Reading[];
  sensors: SensorStates;
  actuators: ActuatorStates;
  stats: {
    unresolved: number;
    irrigationCount: number;
    waterSaving: number | null;
    energySaving: number | null;
    onlineRate: number;
    explanation: string;
  };
  presentation: PresentationState;
  onSelectPresentationScenario: (id: PresentationState['scenarioId']) => void;
  onPausePresentation: () => void;
  onResumePresentation: () => void;
  onStepPresentation: () => void;
  onResetPresentation: () => void;
  onRegeneratePresentationSeed: () => void;
  onCopyPresentationSeed: () => Promise<void>;
  onExportSnapshot: () => void;
  onImportSnapshot: (file: File) => Promise<void>;
  onExportOperationLog: () => void;
  onDebateReset: () => void;
  isDebateResetting: boolean;
};

export function Dashboard({
  reading,
  history,
  sensors,
  actuators,
  stats,
  presentation,
  onSelectPresentationScenario,
  onPausePresentation,
  onResumePresentation,
  onStepPresentation,
  onResetPresentation,
  onRegeneratePresentationSeed,
  onCopyPresentationSeed,
  onExportSnapshot,
  onImportSnapshot,
  onExportOperationLog,
  onDebateReset,
  isDebateResetting,
}: DashboardProps) {
  return (
    <div className="page-grid">
      <section className="hero-panel">
        <div>
          <h2>温室 A 区实时运行</h2>
          <p>当前为前端演示模式：模拟传感器、可解释策略和设备执行闭环，未连接真实硬件。</p>
        </div>
        <div className="closed-loop">
          {['数据采集', 'AI分析', '自动执行', '反馈优化'].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <PresentationConsole
        presentation={presentation}
        onSelectScenario={onSelectPresentationScenario}
        onPause={onPausePresentation}
        onResume={onResumePresentation}
        onStep={onStepPresentation}
        onReset={onResetPresentation}
        onRegenerateSeed={onRegeneratePresentationSeed}
        onCopySeed={onCopyPresentationSeed}
        onExportSnapshot={onExportSnapshot}
        onImportSnapshot={onImportSnapshot}
        onExportOperationLog={onExportOperationLog}
        onDebateReset={onDebateReset}
        isDebateResetting={isDebateResetting}
      />
      <DemoGuide />

      <div className="metric-grid">
        <MetricCard label="温度" value={formatReading(reading.temperature)} unit={reading.temperature === null ? '' : '°C'} hint={sensors.temperature.status === 'live' ? '风扇联动降温' : '传感器离线'} risk={sensorRisk('temperature', reading.temperature)} />
        <MetricCard label="空气湿度" value={formatReading(reading.humidity)} unit={reading.humidity === null ? '' : '%'} hint={sensors.humidity.status === 'live' ? '保持棚内蒸腾平衡' : '传感器离线'} risk={sensorRisk('humidity', reading.humidity)} />
        <MetricCard label="光照强度" value={formatReading(reading.light)} unit={reading.light === null ? '' : 'lux'} hint={sensors.light.status === 'live' ? '补光与遮阳联动' : '传感器离线'} risk={sensorRisk('light', reading.light)} />
        <MetricCard label="土壤湿度" value={formatReading(reading.soilMoisture)} unit={reading.soilMoisture === null ? '' : '%'} hint={`低于 ${greenhousePolicy.irrigationStartThreshold}% 启动，高于 ${greenhousePolicy.irrigationStopThreshold}% 停止`} risk={sensorRisk('soilMoisture', reading.soilMoisture)} trend="down" />
        <MetricCard label="CO₂浓度" value={formatReading(reading.co2)} unit={reading.co2 === null ? '' : 'ppm'} hint={sensors.co2.status === 'live' ? '通风策略输入' : '传感器离线'} risk={sensorRisk('co2', reading.co2)} />
        <MetricCard label="策略估算节水率" value={stats.waterSaving === null ? '数据不足' : stats.waterSaving.toString()} unit={stats.waterSaving === null ? '' : '%'} hint={stats.explanation} />
        <MetricCard label="演示节能率" value={stats.energySaving === null ? '数据不足' : stats.energySaving.toString()} unit={stats.energySaving === null ? '' : '%'} hint={stats.explanation} />
        <MetricCard label="今日灌溉" value={stats.irrigationCount.toString()} unit="次" hint="由土壤湿度触发" />
      </div>

      <div className="dashboard-columns">
        <EnvironmentTrend data={history} />
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>执行设备状态</h2>
              <p>自动控制策略正在根据实时数据调整设备</p>
            </div>
          </div>
          <div className="device-state-grid">
            {Object.entries(actuators).map(([key, state]) => (
              <div className="device-state" key={key}>
                <span className={`device-icon ${state.actual ? 'active' : ''} ${state.commandStatus === 'blocked' ? 'blocked' : ''}`}>
                  {key === 'waterPump' && <Droplets size={24} />}
                  {key === 'fan' && <Fan size={24} />}
                  {key === 'growLight' && <Lightbulb size={24} />}
                  {key === 'shade' && <SunMedium size={24} />}
                </span>
                <strong>{deviceLabels[key as keyof ActuatorStates]}</strong>
                <span className="state-pair">目标：{state.target ? '开启' : '关闭'} · 实际：{state.actual ? '运行' : '停止'}</span>
                <Badge tone={state.commandStatus === 'blocked' ? 'danger' : state.actual ? 'good' : 'muted'}>{state.commandStatus === 'blocked' ? '控制阻断' : state.actual ? '运行中' : '已关闭'}</Badge>
                {state.blockedReason && <small className="blocked-reason">{state.blockedReason}</small>}
              </div>
            ))}
          </div>
          <div className="summary-strip">
            <div><ShieldAlert size={18} />未解决报警 <strong>{stats.unresolved}</strong></div>
            <div><Cpu size={18} />在线率 <strong>{stats.onlineRate}%</strong></div>
            <div><Wind size={18} />数据性质 <strong>本地模拟器</strong></div>
            <div><Thermometer size={18} />刷新时间 <strong>{reading.time}</strong></div>
          </div>
        </section>
      </div>

      <LightCo2Trend data={history} />
    </div>
  );
}
