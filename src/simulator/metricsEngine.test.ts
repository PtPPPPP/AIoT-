import { initialActuators, initialReading } from '../data/mockData';
import { calculateEfficiencyMetrics, emptyEfficiencyCounters, updateEfficiencyCounters } from './metricsEngine';

describe('efficiency metrics', () => {
  it('shows insufficient data before five samples', () => {
    expect(calculateEfficiencyMetrics(emptyEfficiencyCounters).waterSaving).toBeNull();
    expect(calculateEfficiencyMetrics(emptyEfficiencyCounters).explanation).toContain('数据不足');
  });

  it('derives rates from baseline and actual runtime instead of fixed percentages', () => {
    let counters = emptyEfficiencyCounters;
    const lowSoil = { ...initialReading, soilMoisture: 40 };
    for (let index = 0; index < 5; index += 1) {
      counters = updateEfficiencyCounters(counters, lowSoil, initialActuators);
    }
    const metrics = calculateEfficiencyMetrics(counters);
    expect(metrics.waterSaving).toBe(100);
    expect(metrics.explanation).toContain('模拟功率');
  });
});
