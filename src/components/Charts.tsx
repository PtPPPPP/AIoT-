import { Reading, SensorKey } from '../types';

type Series = {
  key: SensorKey;
  label: string;
  color: string;
};

const width = 800;
const height = 250;
const padding = 34;

export function EnvironmentTrend({ data }: { data: Reading[] }) {
  return (
    <ChartPanel
      title="实时环境趋势"
      description="模拟传感器每 2.6 秒生成一次单帧快照"
      data={data}
      series={[
        { key: 'temperature', label: '温度 °C', color: '#0ea5e9' },
        { key: 'soilMoisture', label: '土壤湿度 %', color: '#22c55e' },
        { key: 'humidity', label: '空气湿度 %', color: '#6366f1' },
      ]}
    />
  );
}

export function LightCo2Trend({ data }: { data: Reading[] }) {
  return (
    <ChartPanel
      title="光照与 CO₂ 趋势"
      description="离线数据会显示为曲线中断，不会以 0 充当实时值"
      data={data}
      series={[
        { key: 'light', label: '光照 lux', color: '#eab308' },
        { key: 'co2', label: 'CO₂ ppm', color: '#14b8a6' },
      ]}
    />
  );
}

function ChartPanel({ title, description, data, series }: { title: string; description: string; data: Reading[]; series: Series[] }) {
  return (
    <div className="chart-panel">
      <div className="section-title"><div><h2>{title}</h2><p>{description}</p></div></div>
      <div className="chart-legend">
        {series.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>)}
      </div>
      <svg className="native-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        {[0, 1, 2, 3, 4].map((line) => {
          const y = padding + ((height - padding * 2) / 4) * line;
          return <line key={line} x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e7eef6" strokeDasharray="4 4" />;
        })}
        {series.map((item) => (
          <g key={item.key}>
            {toSegments(data, item.key).map((points, index) => (
              <polyline key={index} points={points} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </g>
        ))}
        <text x={padding} y={height - 8} className="chart-axis-label">{data[0]?.time ?? ''}</text>
        <text x={width - padding} y={height - 8} textAnchor="end" className="chart-axis-label">{data[data.length - 1]?.time ?? ''}</text>
      </svg>
    </div>
  );
}

function toSegments(data: Reading[], key: SensorKey) {
  const values = data.map((item) => item[key]).filter((value): value is number => value !== null);
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const segments: string[] = [];
  let current: string[] = [];

  data.forEach((item, index) => {
    const value = item[key];
    if (value === null) {
      if (current.length > 1) segments.push(current.join(' '));
      current = [];
      return;
    }
    const x = padding + (index / Math.max(1, data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    current.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  if (current.length > 1) segments.push(current.join(' '));
  return segments;
}
