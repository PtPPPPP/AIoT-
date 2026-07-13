import { Cpu, Droplets, Fan, Lightbulb, ShieldAlert, SunMedium, Thermometer, Wind } from '../components/Icons';
import { EnvironmentTrend, LightCo2Trend } from '../components/Charts';
import { MetricCard } from '../components/MetricCard';
import { Badge } from '../components/Status';
import { DeviceStates, Reading } from '../types';
import { deviceLabels, sensorRisk } from '../utils/greenhouse';

type DashboardProps = {
  reading: Reading;
  history: Reading[];
  deviceStates: DeviceStates;
  stats: {
    unhandled: number;
    irrigationCount: number;
    waterSaving: number;
    energySaving: number;
    onlineRate: number;
  };
};

export function Dashboard({ reading, history, deviceStates, stats }: DashboardProps) {
  return (
    <div className="page-grid">
      <section className="hero-panel">
        <div>
          <h2>温室 A 区实时运行</h2>
          <p>用模拟数据展示多传感器采集、AI 判断、设备执行和反馈优化的闭环。</p>
        </div>
        <div className="closed-loop">
          {['数据采集', 'AI分析', '自动执行', '反馈优化'].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <div className="metric-grid">
        <MetricCard label="温度" value={reading.temperature.toString()} unit="°C" hint="风扇联动降温" risk={sensorRisk('temperature', reading.temperature)} />
        <MetricCard label="空气湿度" value={reading.humidity.toString()} unit="%" hint="保持棚内蒸腾平衡" risk={sensorRisk('humidity', reading.humidity)} />
        <MetricCard label="光照强度" value={reading.light.toLocaleString()} unit="lux" hint="补光与遮阳联动" risk={sensorRisk('light', reading.light)} />
        <MetricCard label="土壤湿度" value={reading.soilMoisture.toString()} unit="%" hint="低于阈值自动滴灌" risk={sensorRisk('soilMoisture', reading.soilMoisture)} trend="down" />
        <MetricCard label="CO₂浓度" value={reading.co2.toString()} unit="ppm" hint="通风策略输入" risk={sensorRisk('co2', reading.co2)} />
        <MetricCard label="节水率" value={stats.waterSaving.toString()} unit="%" hint="按需滴灌估算" />
        <MetricCard label="节能率" value={stats.energySaving.toString()} unit="%" hint="补光和风扇按需运行" />
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
            {Object.entries(deviceStates).map(([key, active]) => (
              <div className="device-state" key={key}>
                <span className={`device-icon ${active ? 'active' : ''}`}>
                  {key === 'waterPump' && <Droplets size={24} />}
                  {key === 'fan' && <Fan size={24} />}
                  {key === 'growLight' && <Lightbulb size={24} />}
                  {key === 'shade' && <SunMedium size={24} />}
                </span>
                <strong>{deviceLabels[key as keyof DeviceStates]}</strong>
                <Badge tone={active ? 'good' : 'muted'}>{active ? '运行中' : '已关闭'}</Badge>
              </div>
            ))}
          </div>
          <div className="summary-strip">
            <div><ShieldAlert size={18} />异常报警 <strong>{stats.unhandled}</strong></div>
            <div><Cpu size={18} />在线率 <strong>{stats.onlineRate}%</strong></div>
            <div><Wind size={18} />闭环策略 <strong>自动</strong></div>
            <div><Thermometer size={18} />刷新时间 <strong>{reading.time}</strong></div>
          </div>
        </section>
      </div>

      <LightCo2Trend data={history} />
    </div>
  );
}
