import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Alerts } from './Alerts';
import { createInitialSimulatorState } from '../simulator/simulatorReducer';

describe('报警中心筛选', () => {
  it('按等级筛选并可清空', () => {
    const state = createInitialSimulatorState('2026-01-01T09:00:00.000Z');
    const alarms = [{ ...state.alarms[0], level: 'critical' as const, title: '水泵故障' }, { ...state.alarms[0], id: 'other', level: 'info' as const, title: '光照不足' }];
    render(<Alerts alarms={alarms} acknowledgeAlarm={vi.fn()} presentation={state.presentation} />);
    fireEvent.change(screen.getByLabelText('报警级别'), { target: { value: 'critical' } });
    expect(screen.getByText('水泵故障')).toBeTruthy();
    expect(screen.queryByText('光照不足')).toBeNull();
    fireEvent.click(screen.getByText('清空筛选'));
    expect(screen.getByText('光照不足')).toBeTruthy();
  });
});
