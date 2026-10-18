// D16: the only place in src/ that reads the system clock. Everything else asks a Clock.

export interface Clock {
  /** UTC epoch milliseconds. */
  now(): number;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};

/**
 * A clock that starts at `startMs` and runs at `rate`× real time. Practice mode (D16) drives the
 * real live screen with one of these.
 */
export class SimulatedClock implements Clock {
  private readonly realStart: number;
  constructor(
    private readonly startMs: number,
    private readonly rate = 1,
    private readonly source: Clock = systemClock,
  ) {
    this.realStart = source.now();
  }
  now(): number {
    return this.startMs + (this.source.now() - this.realStart) * this.rate;
  }
}

/** A clock that only moves when told to. For tests. */
export class FixedClock implements Clock {
  constructor(private t: number) {}
  now(): number {
    return this.t;
  }
  set(t: number): void {
    this.t = t;
  }
  advance(ms: number): void {
    this.t += ms;
  }
}
