import { Reading, SensorKey } from '../types';
import { readingPoints } from '../analysis/chartMath';
import { TimeSeriesChart } from './TimeSeriesChart';
import { sensorLabels } from '../simulator/policy';

function SeriesCharts({ data, keys }: { data: Reading[]; keys: SensorKey[] }) {
  const units = { temperature: '°C', humidity: '%', soilMoisture: '%', light: 'lux', co2: 'ppm' };
  return <>{keys.map(key => <TimeSeriesChart key={key} title={sensorLabels[key] + '趋势'} points={readingPoints(data, key, units[key])} unit={units[key]} />)}</>;
}
export function EnvironmentTrend({ data }: { data: Reading[] }) { return <SeriesCharts data={data} keys={['temperature', 'soilMoisture', 'humidity']} />; }
export function LightCo2Trend({ data }: { data: Reading[] }) { return <SeriesCharts data={data} keys={['light', 'co2']} />; }
