import { RuntimeStatus } from '../components/RuntimeStatus';
import { originLabels } from '../utils/runtimeStatus';
import { MetricCard } from '../components/MetricCard';
import { Badge } from '../components/Status';
import { greenhousePolicy } from '../simulator/policy';
import { Reading, SensorKey, SensorStates, SimulatorState } from '../types';
import { formatReading, formatTimestamp, sensorRisk } from '../utils/greenhouse';

const rows: Array<{ key: SensorKey; label: string; unit: string; normal: string }> = [
  { key: 'temperature', label: '温度', unit: '°C', normal: `21-${greenhousePolicy.fanStartTemperature}°C` },
  { key: 'humidity', label: '空气湿度', unit: '%', normal: '45-82%' },
  { key: 'light', label: '光照强度', unit: 'lux', normal: `${greenhousePolicy.growLightStartThreshold.toLocaleString()}-${greenhousePolicy.shadeStartThreshold.toLocaleString()} lux` },
  { key: 'soilMoisture', label: '土壤湿度', unit: '%', normal: `${greenhousePolicy.irrigationStartThreshold}-${greenhousePolicy.irrigationStopThreshold}% 为回差区间` },
  { key: 'co2', label: 'CO₂浓度', unit: 'ppm', normal: `430-${greenhousePolicy.fanStartCo2} ppm` },
];

export function Environment({ reading, sensors, runtime }: { reading: Reading; sensors: SensorStates; runtime: SimulatorState['runtime'] }) {
  return (
    <div className="page-grid">
      <RuntimeStatus runtime={runtime} sensors={sensors} />
      <div className="metric-grid compact">
        {rows.map((row) => {
          const value = reading[row.key];
          const sensor = sensors[row.key];
          return (
            <MetricCard
              key={row.key}
              label={row.label}
              value={formatReading(value)}
              unit={value === null ? '' : row.unit}
              hint={originLabels[sensor.sourceKind ?? 'unknown'] + ' · ' + (sensor.quality === 'good' ? `正常/策略范围 ${row.normal}` : `${qualityLabel(sensor.quality)}，最后更新 ${formatTimestamp(sensor.lastUpdatedAt)}`)}
              risk={sensorRisk(row.key, value)}
            />
          );
        })}
      </div>

      <section className="panel">
        <div className="section-title">
          <div>
            <h2>环境采样与可信度</h2>
            <p>离线传感器会中断数据流，页面保留最后有效值和更新时间，不再冒充实时数据。</p>
          </div>
          <Badge tone="blue">最后快照 {reading.time}</Badge>
        </div>
        <div className="table responsive-table">
          <div className="table-row table-head">
            <span>传感器</span><span>指标</span><span>当前值</span><span>范围</span><span>状态</span>
          </div>
          {rows.map((row) => {
            const value = reading[row.key];
            const sensor = sensors[row.key];
            const risk = sensorRisk(row.key, value);
            return (
              <div className={`table-row ${risk !== '正常' ? 'row-alert' : ''}`} key={row.key}>
                <span data-label="传感器"><span>{originLabels[sensor.sourceKind ?? 'unknown']}</span><details><summary>采样详情</summary><p>来源标识：{sensor.sourceId} · {sensor.source ?? (runtime.mode === 'simulation' ? '本地模拟器' : '未知')}</p><p>采集：{sensor.capturedAt ? formatTimestamp(sensor.capturedAt) : '尚无采样'}</p><p>接收：{sensor.receivedAt ? formatTimestamp(sensor.receivedAt) : '未知'}</p><p>最后有效：{sensor.lastUpdatedAt ? formatTimestamp(sensor.lastUpdatedAt) : '无'}；{sensor.lastUpdatedAt ? sensor.lastValue : '无有效值'}</p></details></span>
                <span data-label="指标">{row.label}</span>
                <strong data-label="当前值">{value === null ? '不可用' : `${value.toLocaleString()} ${row.unit}`}</strong>
                <span data-label="范围">{row.normal}</span>
                <span data-label="状态"><Badge tone={sensor.quality === 'good' ? (risk === '正常' ? 'good' : 'warn') : 'danger'}>{sensor.quality === 'good' ? risk : qualityLabel(sensor.quality)}</Badge></span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function qualityLabel(quality: SensorStates[SensorKey]['quality']) {
  return ({ stale: '旧数据', offline: '离线', invalid: '无效数据', error: '故障数据', good: '正常数据' })[quality];
}
