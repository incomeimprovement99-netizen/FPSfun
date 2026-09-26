// A bot's body against the world: the floor it stands on and what stops it.
// bots.ts moves every bot by these, city.ts tests a way onto the graph with
// them before it adds it, and tools/checks/sk-roofs.ts walks the roofs' routes
// with them, so all three hold one rule. (Its own module: city.ts cannot take
// bots.ts, which reaches most of the game.)
import { solidsIn } from "./solidgrid";
import { MOVE } from "./movement";
import type { Solid } from "./range";

const RADIUS = MOVE.radius;
/** the solids near a body, filled per query (solidsIn's scratch list) */
const NEAR: Solid[] = [];

/** the floor a bot at height `y` stands on at (x, z): the highest top under its body it can step up onto */
export function botGroundAt(x: number, z: number, y: number): number {
  let best = 0;
  for (const s of solidsIn(x - RADIUS, x + RADIUS, z - RADIUS, z + RADIUS, NEAR)) {
    if (x + RADIUS > s.minX && x - RADIUS < s.maxX && z + RADIUS > s.minZ && z - RADIUS < s.maxZ) {
      if (s.top <= y + MOVE.stepHeight + 1e-4 && s.top > best) best = s.top;
    }
  }
  return best;
}

/** a bot's body at (x, z), standing at height `y`, would overlap something it cannot step onto */
export function botBlocked(x: number, z: number, y: number): boolean {
  for (const s of solidsIn(x - RADIUS, x + RADIUS, z - RADIUS, z + RADIUS, NEAR)) {
    if (x + RADIUS > s.minX && x - RADIUS < s.maxX && z + RADIUS > s.minZ && z - RADIUS < s.maxZ) {
      if (s.top > y + MOVE.stepHeight + 1e-4 && s.base < y + MOVE.standHeight - 1e-4) return true;
    }
  }
  return false;
}

/**
 * A straight walk from (ax, az) at height y0 to (bx, bz) in 10 cm steps, by
 * the rules above: whether it got there, and at what height it ended.
 */
export function botWalk(ax: number, az: number, y0: number, bx: number, bz: number): { ok: boolean; y: number; x: number; z: number } {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(len / 0.1));
  let y = y0;
  for (let k = 1; k <= n; k++) {
    const x = ax + ((bx - ax) * k) / n;
    const z = az + ((bz - az) * k) / n;
    if (botBlocked(x, z, y)) return { ok: false, y, x, z };
    y = botGroundAt(x, z, y);
  }
  return { ok: true, y, x: bx, z: bz };
}
