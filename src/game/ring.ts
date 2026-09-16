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
    private readonly rng: () => number = Math.random,
    /** what the late circles lean toward; pass [] for a ring that ignores the map */
    private readonly attractors: readonly Attractor[] = RING_ATTRACTORS
  ) {
    this.current = { ...start };
    this.from = { ...start };
    this.next = this.pick(start, 0);
    this.timeLeft = RING_PHASES[0].wait;
  }

  /**
   * Where `phase` closes to: a circle of its radius wholly inside `inside`
   * and wholly inside the map, at a random offset. From cfg.cover.fromPhase
   * on it is the best of several draws, best meaning nearest an attractor,
   * because the last rounds belong on the places and the roadside cover
   * rather than on open sand.
   */
  private pick(inside: Circle, phase: number): Circle {
    const r = RING_PHASES[phase].radius;
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

  /** one candidate: a random offset inside `inside`, pulled back inside the map */
  private draw(inside: Circle, r: number): Circle {
    const room = Math.max(0, inside.r - r);
    const a = this.rng() * Math.PI * 2;
    // sqrt for an even spread over the area, not bunched at the centre
    const d = room * Math.sqrt(this.rng());
    let cx = inside.cx + Math.cos(a) * d;
    let cz = inside.cz + Math.sin(a) * d;
    // The map is a square, so the whole circle fits when each axis fits on its
    // own. Clamping toward the map's middle can only move the centre closer to
    // `inside`'s centre, which sits in the same box whenever the ring we close
    // from is itself inside the map, so the nesting survives the clamp.
    const reach = Math.max(0, cfg.bounds.half - r);
    cx = Math.min(cfg.bounds.centerX + reach, Math.max(cfg.bounds.centerX - reach, cx));
    cz = Math.min(cfg.bounds.centerZ + reach, Math.max(cfg.bounds.centerZ - reach, cz));
    // The opening circle is wider than the map on purpose, so that nobody is
    // outside it at the drop, and it is the one circle the clamp above can
    // push a centre away from. Pull it back down the line when that happens.
    const off = Math.hypot(cx - inside.cx, cz - inside.cz);
    if (off > room) {
      const k = room / off;
      cx = inside.cx + (cx - inside.cx) * k;
      cz = inside.cz + (cz - inside.cz) * k;
    }
    return { cx, cz, r };
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
            Object.assign(this.next, this.pick(this.current, this.phase));
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
