import { readingPoints, timeSegments, xForTime } from './chartMath';
import { Reading } from '../types';

const base = Date.parse('2026-10-20T00:00:00Z');
const reading = (seconds: number, key: 'temperature' | 'soilMoisture', value: number | null): Reading => ({ time: '', capturedAt: new Date(base + seconds * 1000).toISOString(), temperature: null, soilMoisture: null, humidity: null, co2: null, light: null, sampleKey: key, [key]: value });
describe('真实时间轴与异步采样', () => {
  it('另一指标的稀疏记录不打断当前指标', () => {
    const points = readingPoints([reading(0, 'soilMoisture', 30), reading(30, 'temperature', 25), reading(60, 'soilMoisture', 32)], 'soilMoisture', '%');
    expect(points).toHaveLength(2);
    expect(timeSegments(points, 120000)).toHaveLength(1);
  });
  it('本指标无效采样与长缺口都打断，横轴间距按时间而非记录序号', () => {
    const points = readingPoints([reading(0, 'soilMoisture', 30), reading(30, 'soilMoisture', null), reading(60, 'soilMoisture', 32), reading(300, 'soilMoisture', 40)], 'soilMoisture', '%');
    expect(timeSegments(points, 120000).map(s => s.length)).toEqual([1, 1, 1]);
    expect(xForTime(new Date(base + 30000).toISOString(), base, base + 300000)).toBe(132);
  });
  it('图表遵守生效版本的连接间隔，不跨越历史配置变化', () => {
    const points = readingPoints([reading(0, 'soilMoisture', 30), reading(90, 'soilMoisture', 35)], 'soilMoisture', '%');
    expect(timeSegments(points, 120000, [{ effectiveAt: new Date(base + 30000).toISOString(), seconds: 60 }])).toHaveLength(2);
  });
  it('来源变化不连接成同一条连续曲线', () => {
    const points = readingPoints([reading(0, 'soilMoisture', 30), reading(60, 'soilMoisture', 32)], 'soilMoisture', '%');
    points[0].sourceKind = 'simulation'; points[1].sourceKind = 'hardware';
    expect(timeSegments(points, 120000)).toHaveLength(2);
  });
});
