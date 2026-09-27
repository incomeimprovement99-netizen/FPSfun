/**
 * Where a frame's CPU time goes, by phase (docs/PHASE_20_PLAN.md A18). The game loop marks the end of each phase
 * with lap(), and a frame over the hitch line keeps its breakdown, so a hitch in a match says which part of the
 * loop it was in. A hitch whose loop time is small was outside the loop: the GPU, a garbage collection, the
 * browser.
 *
 * Off unless the page asks (?perf on the address, or __range.perf(true)): a normal frame pays one test a mark.
 */
export interface Hitch {
  /** the game clock at the frame, seconds */
  at: number;
  /** the frame's time in the loop, ms */
  ms: number;
  /** each phase's share of it, ms, in loop order */
  phases: Record<string, number>;
}

export class FramePhases {
  on = false;
  /** a frame whose loop time passes this keeps its breakdown (ms): the plan's hitch line */
  line = 50;
  readonly hitches: Hitch[] = [];
  private t0 = 0;
  private last = 0;
  private laps: Array<[string, number]> = [];
  private sums = new Map<string, number>();
  private frames = 0;

  start(): void {
    if (!this.on) return;
    this.t0 = this.last = performance.now();
    this.laps.length = 0;
  }

  /** the phase that ends here, named */
  lap(name: string): void {
    if (!this.on) return;
    const t = performance.now();
    this.laps.push([name, t - this.last]);
    this.last = t;
  }

  end(now: number): void {
    if (!this.on || this.t0 === 0) return;
    this.lap("rest");
    const ms = this.last - this.t0;
    this.frames++;
    for (const [n, v] of this.laps) this.sums.set(n, (this.sums.get(n) ?? 0) + v);
    // the list is kept short: a run of hitches is one cause, and a long page must not grow without end
    if (ms > this.line && this.hitches.length < 500) this.hitches.push({ at: now, ms, phases: Object.fromEntries(this.laps.map(([n, v]) => [n, Math.round(v * 100) / 100])) });
    this.t0 = 0;
  }

  /** each phase's mean over every frame since the last reset, ms */
  means(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [n, v] of this.sums) out[n] = Math.round((v / Math.max(1, this.frames)) * 1000) / 1000;
    return out;
  }

  reset(): void {
    this.hitches.length = 0;
    this.sums.clear();
    this.frames = 0;
  }
}
