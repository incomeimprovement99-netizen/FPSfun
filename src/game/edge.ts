// SpeedKills' edge (Phase 20 A4). The owner found the city's edge vague: it
// showed on the minimap but not in the world, and the body just stopped. Now
// a lit fence stands on it (city.ts), a body can go city.json edge.margin
// metres past it, and out there a countdown runs: step back in and it stops,
// stay and the death is OUT OF BOUNDS. There was a red laser down on whoever
// stayed, and a red ring on the ground round them, on every screen; the owner
// took it out (2026-09-28: a red circle kept being seen round enemies, and
// this was the one thing in the game that drew one on a figure).
//
// The clock is the page's game time, the one the player's own movement runs
// on: on a slow page both stretch together, so nobody dies for a walk their
// own frames made slow.
import cityCfg from "../config/city.json";
import { BR_BOUNDS } from "./br";
import type { Bounds } from "./player";

export const EDGE = cityCfg.edge;
/** the wall a landed body stops at: the city and the margin round it */
export const EDGE_BOUNDS: Bounds = {
  minX: BR_BOUNDS.minX - EDGE.margin,
  maxX: BR_BOUNDS.maxX + EDGE.margin,
  minZ: BR_BOUNDS.minZ - EDGE.margin,
  maxZ: BR_BOUNDS.maxZ + EDGE.margin,
};
export const pastEdge = (x: number, z: number): boolean => x < BR_BOUNDS.minX || x > BR_BOUNDS.maxX || z < BR_BOUNDS.minZ || z > BR_BOUNDS.maxZ;

export type EdgeEvent = "out" | "tick" | "back" | "dead";

/** one player's time past the edge: what happens as the seconds go (main.ts edgeFrame) */
export class EdgeWatch {
  since: number | null = null;
  struckAt: number | null = null;
  private said = 0;

  step(now: number, out: boolean): EdgeEvent | null {
    // (dead: nothing more)
    if (this.struckAt !== null) return null;
    if (!out) {
      if (this.since === null) return null;
      this.since = null;
      return "back";
    }
    if (this.since === null) {
      this.since = now;
      this.said = 0;
      return "out";
    }
    const t = now - this.since;
    if (t >= EDGE.countdown) {
      this.struckAt = now;
      return "dead";
    }
    if (Math.floor(t) > this.said) {
      this.said = Math.floor(t);
      return "tick";
    }
    return null;
  }

  /** seconds left before the death, or null while inside (or already dead) */
  left(now: number): number | null {
    return this.since === null || this.struckAt !== null ? null : Math.max(0, EDGE.countdown - (now - this.since));
  }

  reset(): void {
    this.since = null;
    this.struckAt = null;
    this.said = 0;
  }
}
