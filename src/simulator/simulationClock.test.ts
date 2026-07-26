import { IntervalScheduler, SimulationClock } from './simulationClock';

function createScheduler(): { scheduler: IntervalScheduler; trigger: () => void; activeCount: () => number } {
  const handlers = new Map<number, () => void>();
  let id = 0;
  return {
    scheduler: {
      setInterval: (handler) => {
        id += 1;
        handlers.set(id, handler);
        return id as unknown as ReturnType<typeof setInterval>;
      },
      clearInterval: (timer) => handlers.delete(timer as unknown as number),
    },
    trigger: () => handlers.forEach((handler) => handler()),
    activeCount: () => handlers.size,
  };
}

describe('simulation clock', () => {
  it('pauses automatic advancement, resumes once, and supports one manual step', () => {
    const fake = createScheduler();
    let steps = 0;
    const clock = new SimulationClock(() => { steps += 1; }, 2_600, fake.scheduler);

    clock.start();
    clock.start();
    expect(fake.activeCount()).toBe(1);
    fake.trigger();
    expect(steps).toBe(1);

    clock.pause();
    fake.trigger();
    expect(steps).toBe(1);
    clock.step();
    expect(steps).toBe(2);

    clock.start();
    fake.trigger();
    expect(steps).toBe(3);
    clock.dispose();
    expect(fake.activeCount()).toBe(0);
  });
});
