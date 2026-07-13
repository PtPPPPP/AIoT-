import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Reading } from '../types';

export function EnvironmentTrend({ data }: { data: Reading[] }) {
  return (
    <div className="chart-panel">
      <div className="section-title">
        <div>
          <h2>实时环境趋势</h2>
          <p>模拟传感器每 2.6 秒刷新一次</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={285}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7eef6" />
          <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={22} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="temperature" name="温度°C" stroke="#0ea5e9" strokeWidth={2.4} dot={false} />
          <Line type="monotone" dataKey="soilMoisture" name="土壤湿度%" stroke="#22c55e" strokeWidth={2.4} dot={false} />
          <Line type="monotone" dataKey="humidity" name="空气湿度%" stroke="#6366f1" strokeWidth={2.2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LightCo2Trend({ data }: { data: Reading[] }) {
  return (
    <div className="chart-panel">
      <div className="section-title">
        <div>
          <h2>光照与 CO₂</h2>
          <p>用于补光、遮阳和通风策略判断</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={255}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="lightFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#facc15" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#facc15" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7eef6" />
          <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={22} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Area type="monotone" dataKey="light" name="光照 lux" stroke="#eab308" fill="url(#lightFill)" strokeWidth={2} />
          <Line type="monotone" dataKey="co2" name="CO₂ ppm" stroke="#14b8a6" strokeWidth={2.2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
