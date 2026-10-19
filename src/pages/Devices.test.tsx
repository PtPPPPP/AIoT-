import { fireEvent, render, screen, within } from '@testing-library/react';
import { Devices } from './Devices';
import { createInitialSimulatorState } from '../simulator/simulatorReducer';

describe('硬件清单与业务仿真分离', () => {
  it('展示三款现有硬件和通道缺口，硬件清单不提供虚构的在线开关', () => {
    const state = createInitialSimulatorState('2026-01-01T09:00:00.000Z');
    const toggle = vi.fn();
    render(<Devices devices={state.devices} actuators={state.actuators} runtime={state.runtime} toggleDeviceOnline={toggle} />);
    const hardware = within(screen.getByRole('region', { name: '现有硬件与接入规划' }));
    expect(hardware.getAllByText('已持有')).toHaveLength(3);
    expect(hardware.getByRole('heading', { name: /WISE-4012 ·/ })).toBeTruthy();
    expect(hardware.getByRole('heading', { name: /ADAM-6050 ·/ })).toBeTruthy();
    expect(hardware.getByRole('heading', { name: /EKI-2525 ·/ })).toBeTruthy();
    expect(hardware.queryByRole('switch')).toBeNull();
    expect(hardware.getByText(/未分配 · .*4 路已占用/)).toBeTruthy();
    expect(screen.queryByText('LoRa/4G网关')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: '切换土壤湿度传感器在线状态' }));
    expect(toggle).toHaveBeenCalledWith('SEN-S-03');
  });

  it('外部模式禁用仿真开关，硬件持有状态仍保持独立', () => {
    const state = createInitialSimulatorState('2026-01-01T09:00:00.000Z');
    const toggle = vi.fn();
    render(<Devices devices={state.devices} actuators={state.actuators} runtime={{ ...state.runtime, mode: 'external' }} toggleDeviceOnline={toggle} />);
    const control = screen.getByRole('switch', { name: '切换土壤湿度传感器在线状态' });
    expect((control as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(control);
    expect(toggle).not.toHaveBeenCalled();
    expect(screen.getAllByText('已持有')).toHaveLength(3);
  });
});
