export type IntervalScheduler = {
  setInterval: (handler: () => void, timeout: number) => ReturnType<typeof setInterval>;
  clearInterval: (id: ReturnType<typeof setInterval>) => void;
};

/** Owns the only automatic simulation timer and supports deterministic manual stepping. */
export class SimulationClock {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly advance: () => void,
    private readonly intervalMs: number,
    private readonly scheduler: IntervalScheduler = globalThis,
  ) {}

  start() {
    if (this.intervalId !== null) return;
    this.intervalId = this.scheduler.setInterval(this.advance, this.intervalMs);
  }

  pause() {
    if (this.intervalId === null) return;
    this.scheduler.clearInterval(this.intervalId);
    this.intervalId = null;
  }

  step() {
    this.advance();
  }

  dispose() {
    this.pause();
  }

  get running() {
    return this.intervalId !== null;
  }
}
