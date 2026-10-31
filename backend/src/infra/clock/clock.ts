/**
 * ARCHITECTURE.md §7 — the one source of "now". Take it once per operation and pass
 * the value along, so every rule in that operation sees the same instant.
 */
export abstract class Clock {
  abstract now(): Date;
}

export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}

/** For tests: frozen until moved with set() or advance(). */
export class FixedClock extends Clock {
  private current: Date;

  constructor(now: Date | string) {
    super();
    this.current = new Date(now);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(now: Date | string): void {
    this.current = new Date(now);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
