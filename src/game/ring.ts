// The ring: the circle that closes over a battle royale match.
//
// Apex's ring runs six rounds; each waits, then closes over a set time onto
// a smaller circle somewhere inside the current one, and standing outside
// costs a set damage every 1.5 s (3, 4, 10, 15, 20, 25 per tick). Ours are
// its damage numbers and its shape; the waits and closes are scaled to a map
// 440 m across instead of a kilometre and a half (docs/GAP_ANALYSIS.md 4).
// Every number lives in src/config/ring.json.
//
// Two things the circles owe the map. They stay wholly inside the battle
// royale's square, because a circle hanging over the edge herded players into
// sand they are hard-clamped out of, and the late ones lean toward the places
// and the roadside cover, because an end game on open ground is a flat plain
// shoot-out. The square and the cover points are config, not an import of
// br.ts: that module builds meshes the moment it loads.
//
// The whole chain of circles is drawn when the ring is made (`plan`), in the
// order the rounds would have drawn them one at a time, so the same random
// stream gives the same circles either way. Knowing the chain up front is
// what lets a Ring Console show the circle after next (ringconsole.ts), and
// a guest that makes a ring from the same seed knows the same chain.
//
// Pure logic, so tools/verify.ts can run a whole ring in a loop.
import cfg from "../config/ring.json";

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

export const RING_PHASES: readonly RingPhase[] = cfg.phases;
/** seconds between damage ticks outside */
export const RING_TICK = cfg.tick;

/** the square the ring lives in: the map's centre and half its side, world space */
export const RING_BOUNDS = cfg.bounds;

/** a place worth ending a match on, world space, with how hard it pulls */
export interface Attractor {
  x: number;
  z: number;
  w: number;
}

/** the map's places and roadside cover, config's map-local metres moved into world space */
export const RING_ATTRACTORS: readonly Attractor[] = cfg.attractors.map((a) => ({
  x: a.x + cfg.bounds.centerX,
  z: a.z + cfg.bounds.centerZ,
  w: a.w,
}));

export interface Circle {
  cx: number;
  cz: number;
  r: number;
}

export type RingState = "waiting" | "closing" | "closed";

export class Ring {
  /** which phase is live (0-based); this.phases.length once everything has closed */
  phase = 0;
  state: RingState = "waiting";
  /** the ring as it stands now */
  readonly current: Circle;
  /** where the live phase closes to */
  readonly next: Circle;
  /** every round's circle, worked out at the start: plan[p] is where round p closes to */
  readonly plan: readonly Circle[];
  /** seconds left in the wait, or in the close */
  timeLeft: number;
  private from: Circle;
  private tickAt = 0;

  constructor(
    start: Circle,
    private readonly rng: () => number = Math.random,
    /** what the late circles lean toward; pass [] for a ring that ignores the map */
    private readonly attractors: readonly Attractor[] = RING_ATTRACTORS,
    /** the rounds: their waits, closes, radii and damage (Resurgence runs a faster clock over the same circles) */
    private readonly phases: readonly RingPhase[] = RING_PHASES
  ) {
    this.current = { ...start };
    this.from = { ...start };
    const plan: Circle[] = [];
    let inside = start;
    for (let p = 0; p < this.phases.length; p++) {
      inside = this.pick(inside, p);
      plan.push(inside);
    }
    this.plan = plan;
    this.next = { ...plan[0] };
    this.timeLeft = this.phases[0].wait;
  }

  /**
   * Where `phase` closes to: a circle of its radius wholly inside `inside`
   * and wholly inside the map, at a random offset. From cfg.cover.fromPhase
   * on it is the best of several draws, best meaning nearest an attractor,
   * because the last rounds belong on the places and the roadside cover
   * rather than on open sand.
   */
  private pick(inside: Circle, phase: number): Circle {
    const r = this.phases[phase].radius;
    let best = this.draw(inside, r);
    if (phase < cfg.cover.fromPhase || this.attractors.length === 0) return best;
    let bestScore = this.coverScore(best);
    for (let i = 1; i < cfg.cover.candidates; i++) {
      const c = this.draw(inside, r);
      const score = this.coverScore(c);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }

  /**
   * One candidate: a random offset inside `inside` that also lies wholly
   * within the map.
   *
   * It used to draw once and then CLAMP to the map's box, which sounds
   * harmless and is not: round one draws in a disc of radius 157 m and the
   * box it is clamped into is 80 m, so two thirds of the draws landed ON the
   * box. Measured over a hundred thousand rings, the first circle's edge sat
   * flush against the map edge in 58 per cent of matches and on one of four
   * identical corner points in another 9, which is the same first ring over
   * and over. The clamp also had to be undone by a pull-back to keep the
   * nesting, and that pull-back could push the circle back out over the edge.
   *
   * So it redraws instead. Acceptance is about a third, so the tries in the
   * config make a failure vanishingly unlikely, and the fallback walks the
   * offset in toward the previous ring's centre rather than sideways. That
   * centre is inside the map whenever the ring being closed from is, so the
   * walk always terminates somewhere legal and the nesting is exact by
   * construction instead of by argument.
   */
  private draw(inside: Circle, r: number): Circle {
    const room = Math.max(0, inside.r - r);
    const reach = Math.max(0, cfg.bounds.half - r);
    const fits = (cx: number, cz: number): boolean =>
      Math.abs(cx - cfg.bounds.centerX) <= reach + 1e-9 && Math.abs(cz - cfg.bounds.centerZ) <= reach + 1e-9;
    let a = 0;
    let d = 0;
    for (let i = 0; i < cfg.bounds.attempts; i++) {
      a = this.rng() * Math.PI * 2;
      // sqrt for an even spread over the area, not bunched at the centre
      d = room * Math.sqrt(this.rng());
      const cx = inside.cx + Math.cos(a) * d;
      const cz = inside.cz + Math.sin(a) * d;
      if (fits(cx, cz)) return { cx, cz, r };
    }
    // every try was outside: keep the last angle and walk the offset in
    for (let k = 9; k >= 0; k--) {
      const step = (d * k) / 10;
      const cx = inside.cx + Math.cos(a) * step;
      const cz = inside.cz + Math.sin(a) * step;
      if (fits(cx, cz) || k === 0) return { cx, cz, r };
    }
    return { cx: inside.cx, cz: inside.cz, r };
  }

  /**
   * How much cover a centre has: the strongest pull any one attractor has on
   * it, falling away by e every cfg.cover.falloff metres. The fall has to be
   * that steep, because on a gentle one a place two rings away outscored a
   * roadside wall underfoot and the ring drifted into the sand between them.
   */
  private coverScore(c: Circle): number {
    let best = 0;
    for (const a of this.attractors) {
      const d = Math.hypot(c.cx - a.x, c.cz - a.z);
      best = Math.max(best, a.w * Math.exp(-d / cfg.cover.falloff));
    }
    return best;
  }

  /**
   * The ring as a guest last saw it (host migration): its round, its state
   * and its clock. Where it stands follows from the plan, which every browser
   * draws alike from the seed: waiting, it is where the last round closed to;
   * closing, it is that far along from there to the next.
   */
  restore(v: { phase: number; state: RingState; timeLeft: number }, start: Circle): void {
    const n = this.phases.length;
    this.phase = Math.max(0, Math.min(n, Math.round(v.phase)));
    this.state = this.phase >= n ? "closed" : v.state === "closed" ? "waiting" : v.state;
    this.timeLeft = Math.max(0, v.timeLeft);
    this.from = { ...(this.phase > 0 ? this.plan[this.phase - 1] : start) };
    Object.assign(this.next, this.plan[Math.min(this.phase, n - 1)]);
    Object.assign(this.current, this.from);
    if (this.state === "closing") {
      const p = this.phases[this.phase];
      const k = Math.max(0, Math.min(1, 1 - this.timeLeft / p.close));
      this.current.cx = this.from.cx + (this.next.cx - this.from.cx) * k;
      this.current.cz = this.from.cz + (this.next.cz - this.from.cz) * k;
      this.current.r = this.from.r + (this.next.r - this.from.r) * k;
    }
  }

  /** the live phase's damage per tick; the last phase's once everything has closed */
  get damage(): number {
    return this.phases[Math.min(this.phase, this.phases.length - 1)].damage;
  }

  get done(): boolean {
    return this.phase >= this.phases.length;
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
        this.timeLeft += this.phases[this.phase].close;
        this.from = { ...this.current };
      }
      if (this.state === "closing") {
        const p = this.phases[this.phase];
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
            this.timeLeft += this.phases[this.phase].wait;
            Object.assign(this.next, this.plan[this.phase]);
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
