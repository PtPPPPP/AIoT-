import { acknowledgeAlarm, reconcileSystemAlarms } from './alarmEngine';

const condition = {
  type: 'sensor-offline',
  sourceId: 'SEN-S-03',
  level: 'warning' as const,
  title: '传感器离线',
  description: '测试',
};

describe('alarm lifecycle', () => {
  it('deduplicates a continuous condition and increments its occurrence count', () => {
    const first = reconcileSystemAlarms([], [condition], '2026-01-01T10:00:00.000Z');
    const second = reconcileSystemAlarms(first, [condition], '2026-01-01T10:00:02.600Z');
    expect(second).toHaveLength(1);
    expect(second[0].occurrenceCount).toBe(2);
  });

  it('preserves acknowledgement while the condition continues and resolves after recovery', () => {
    const active = reconcileSystemAlarms([], [condition], '2026-01-01T10:00:00.000Z');
    const acknowledged = acknowledgeAlarm(active, active[0].id);
    const continued = reconcileSystemAlarms(acknowledged, [condition], '2026-01-01T10:00:02.600Z');
    expect(continued[0].status).toBe('acknowledged');
    const resolved = reconcileSystemAlarms(continued, [], '2026-01-01T10:00:05.200Z');
    expect(resolved[0].status).toBe('resolved');
    expect(resolved[0].resolvedAt).toBeDefined();
  });
});
