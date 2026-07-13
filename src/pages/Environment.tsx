import { MetricCard } from '../components/MetricCard';
import { Badge } from '../components/Status';
import { Reading } from '../types';
import { sensorRisk } from '../utils/greenhouse';

const rows: Array<{ key: keyof Omit<Reading, 'time'>; label: string; unit: string; normal: string; source: string }> = [
  { key: 'temperature', label: '温度', unit: '°C', normal: '22-30°C', source: 'SEN-T-01' },
  { key: 'humidity', label: '空气湿度', unit: '%', normal: '45-82%', source: 'SEN-T-01' },
  { key: 'light', label: '光照强度', unit: 'lux', normal: '12000-33000 lux', source: 'SEN-L-02' },
  { key: 'soilMoisture', label: '土壤湿度', unit: '%', normal: '40-65%', source: 'SEN-S-03' },
  { key: 'co2', label: 'CO₂浓度', unit: 'ppm', normal: '430-980 ppm', source: 'SEN-C-04' },
];

export function Environment({ reading }: { reading: Reading }) {
  return (
    <div className="page-grid">
      <div className="metric-grid compact">
        {rows.map((row) => (
          <MetricCard
            key={row.key}
            label={row.label}
            value={Number(reading[row.key]).toLocaleString()}
            unit={row.unit}
            hint={`正常范围 ${row.normal}`}
            risk={sensorRisk(row.key, Number(reading[row.key]))}
          />
        ))}
      </div>

      <section className="panel">
        <div className="section-title">
          <div>
            <h2>多传感器实时数据</h2>
            <p>异常值会直接高亮，并参与自动控制判断</p>
          </div>
          <Badge tone="blue">最后刷新 {reading.time}</Badge>
        </div>
        <div className="table">
          <div className="table-row table-head">
            <span>传感器</span><span>指标</span><span>实时值</span><span>正常范围</span><span>状态</span>
          </div>
          {rows.map((row) => {
            const risk = sensorRisk(row.key, Number(reading[row.key]));
            return (
              <div className={`table-row ${risk !== '正常' ? 'row-alert' : ''}`} key={row.key}>
                <span>{row.source}</span>
                <span>{row.label}</span>
                <strong>{Number(reading[row.key]).toLocaleString()} {row.unit}</strong>
                <span>{row.normal}</span>
                <Badge tone={risk === '正常' ? 'good' : risk === '高风险' ? 'danger' : 'warn'}>{risk}</Badge>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
