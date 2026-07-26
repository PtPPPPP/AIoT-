import { fireEvent, render, screen } from '@testing-library/react';
import { PresentationConsole } from './PresentationConsole';

const presentation = {
  scenarioId: 'normal' as const,
  runStatus: 'running' as const,
  step: 2,
  seed: 'DEMO-SEED',
  randomState: 42,
  stage: '稳定运行',
  fault: 'none' as const,
};

describe('presentation console', () => {
  it('exposes scenario, pause, step, reset and seed controls', () => {
    const onPause = vi.fn();
    const onStep = vi.fn();
    const onReset = vi.fn();
    const onSelectScenario = vi.fn();
    render(
      <PresentationConsole
        presentation={presentation}
        onSelectScenario={onSelectScenario}
        onPause={onPause}
        onResume={vi.fn()}
        onStep={onStep}
        onReset={onReset}
        onRegenerateSeed={vi.fn()}
        onCopySeed={async () => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '暂停模拟' }));
    fireEvent.click(screen.getByRole('button', { name: '单步推进' }));
    fireEvent.click(screen.getByRole('button', { name: '重置当前场景' }));
    fireEvent.click(screen.getByRole('button', { name: /土壤干旱/ }));
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onSelectScenario).toHaveBeenCalledWith('soil-drought');
    expect(screen.getByText('DEMO-SEED')).toBeTruthy();
  });
});
