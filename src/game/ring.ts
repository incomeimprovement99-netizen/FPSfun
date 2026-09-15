// The ring: the circle that closes over a battle royale match.
//
// Apex's ring runs six rounds; each waits, then closes over a set time onto
// a smaller circle somewhere inside the current one, and standing outside
// costs a set damage every 1.5 s (3, 4, 10, 15, 20, 25 per tick). Ours are
// its damage numbers and its shape; the waits and closes are scaled to a map
// 440 m across instead of a kilometre and a half (docs/GAP_ANALYSIS.md 4).
//
// Pure logic, so tools/verify.ts can run a whole ring in a loop.

export interface RingPhase {
  /** seconds before this round starts closing */
  wait: number;
  /** seconds the close takes */
  close: number;
  /** the radius it closes to, metres */
  radius: number;
  /** damage per tick outside, while this round is the live one */
  damage: number;
}

export const RING_PHASES: readonly RingPhase[] = [
  { wait: 45, close: 60, radius: 140, damage: 3 },
  { wait: 50, close: 45, radius: 80, damage: 4 },
  { wait: 45, close: 35, radius: 45, damage: 10 },
  { wait: 40, close: 30, radius: 22, damage: 15 },
  { wait: 35, close: 25, radius: 10, damage: 20 },
  { wait: 30, close: 40, radius: 0, damage: 25 },
];
/** seconds between damage ticks outside */
export const RING_TICK = 1.5;

export interface Circle {
  cx: number;
  cz: number;
  r: number;
}

export type RingState = "waiting" | "closing" | "closed";

export class Ring {
  /** which phase is live (0-based); RING_PHASES.length once everything has closed */
  phase = 0;
  state: RingState = "waiting";
  /** the ring as it stands now */
  readonly current: Circle;
  /** where the live phase closes to */
  readonly next: Circle;
  /** seconds left in the wait, or in the close */
  timeLeft: number;
  private from: Circle;
  private tickAt = 0;

  constructor(
    start: Circle,
    /** where the next centre can go: inside the map, and inside the current ring */
    private readonly rng: () => number = Math.random
  ) {
    this.current = { ...start };
    this.from = { ...start };
    this.next = this.pick(start, RING_PHASES[0].radius);
    this.timeLeft = RING_PHASES[0].wait;
  }

  /** a circle of radius `r` wholly inside `inside`, at a random offset */
  private pick(inside: Circle, r: number): Circle {
    const room = Math.max(0, inside.r - r);
    const a = this.rng() * Math.PI * 2;
    // sqrt for an even spread over the area, not bunched at the centre
    const d = room * Math.sqrt(this.rng());
    return { cx: inside.cx + Math.cos(a) * d, cz: inside.cz + Math.sin(a) * d, r };
  }

  /** the live phase's damage per tick; the last phase's once everything has closed */
  get damage(): number {
    return RING_PHASES[Math.min(this.phase, RING_PHASES.length - 1)].damage;
  }

  get done(): boolean {
    return this.phase >= RING_PHASES.length;
  }

  outside(x: number, z: number): boolean {
    return Math.hypot(x - this.current.cx, z - this.current.cz) > this.current.r;
  }

  /**
   * Advance by dt seconds. Returns true when a damage tick is due for anyone
   * outside (every RING_TICK seconds, on the ring's own clock).
   */
  update(dt: number): boolean {
    if (!this.done) {
      this.timeLeft -= dt;
      if (this.state === "waiting" && this.timeLeft <= 0) {
        this.state = "closing";
        this.timeLeft += RING_PHASES[this.phase].close;
        this.from = { ...this.current };
      }
      if (this.state === "closing") {
        const p = RING_PHASES[this.phase];
        const k = Math.max(0, Math.min(1, 1 - this.timeLeft / p.close));
        this.current.cx = this.from.cx + (this.next.cx - this.from.cx) * k;
        this.current.cz = this.from.cz + (this.next.cz - this.from.cz) * k;
        this.current.r = this.from.r + (this.next.r - this.from.r) * k;
        if (this.timeLeft <= 0) {
          Object.assign(this.current, this.next);
          this.phase++;
          if (this.done) this.state = "closed";
          else {
            this.state = "waiting";
            this.timeLeft += RING_PHASES[this.phase].wait;
            Object.assign(this.next, this.pick(this.current, RING_PHASES[this.phase].radius));
          }
        }
      }
    }
    this.tickAt += dt;
    if (this.tickAt >= RING_TICK) {
      this.tickAt -= RING_TICK;
      return true;
    }
    return false;
  }
}
