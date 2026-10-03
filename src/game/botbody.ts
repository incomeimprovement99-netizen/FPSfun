// A bot's body against the world: the floor it stands on and what stops it.
// bots.ts moves every bot by these, city.ts tests a way onto the graph with
// them before it adds it, and tools/checks/sk-roofs.ts walks the roofs' routes
// with them, so all three hold one rule. (Its own module: city.ts cannot take
// bots.ts, which reaches most of the game.)
import { solidsIn } from "./solidgrid";
import { MOVE } from "./movement";
import type { Solid } from "./range";
import { floorAt } from "./floors";

const RADIUS = MOVE.radius;
/** the solids near a body, filled per query (solidsIn's scratch list) */
const NEAR: Solid[] = [];

/** the floor a bot at height `y` stands on at (x, z): the highest top under its body it can step up onto */
export function botGroundAt(x: number, z: number, y: number): number {
  // the world's own floor: the street's, or the metro's under it (floors.ts)
  let best = floorAt(x, z);
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

/** the boxes along a walk, found once for it (botWalk) */
const ALONG: Solid[] = [];

/**
 * A straight walk from (ax, az) at height y0 to (bx, bz) in 10 cm steps, by
 * the rules above: whether it got there, and at what height it ended.
 *
 * The boxes are found once for the whole way, every box a body anywhere on it could touch, and each step tests them in
 * one pass for both rules (blocked, else the ground it steps onto): the same boxes and the same answer as botBlocked and
 * botGroundAt a step. A step at a time, the grid was asked twice every 10 cm and handed back each 8 m cell's every box,
 * and the Neon City's graph (neonmap.ts), tens of thousands of walks, held the page's start 9 s (a CPU profile,
 * 2026-10-02).
 */
export function botWalk(ax: number, az: number, y0: number, bx: number, bz: number): { ok: boolean; y: number; x: number; z: number } {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(len / 0.1));
  const minX = Math.min(ax, bx) - RADIUS;
  const maxX = Math.max(ax, bx) + RADIUS;
  const minZ = Math.min(az, bz) - RADIUS;
  const maxZ = Math.max(az, bz) + RADIUS;
  let m = 0;
  for (const s of solidsIn(minX, maxX, minZ, maxZ, NEAR)) if (maxX > s.minX && minX < s.maxX && maxZ > s.minZ && minZ < s.maxZ) ALONG[m++] = s;
  ALONG.length = m;
  let y = y0;
  for (let k = 1; k <= n; k++) {
    const x = ax + ((bx - ax) * k) / n;
    const z = az + ((bz - az) * k) / n;
    const climb = y + MOVE.stepHeight + 1e-4;
    const head = y + MOVE.standHeight - 1e-4;
    let ground = floorAt(x, z);
    for (let i = 0; i < m; i++) {
      const s = ALONG[i];
      if (x + RADIUS > s.minX && x - RADIUS < s.maxX && z + RADIUS > s.minZ && z - RADIUS < s.maxZ) {
        if (s.top > climb) {
          if (s.base < head) return { ok: false, y, x, z };
        } else if (s.top > ground) ground = s.top;
      }
    }
    y = ground;
  }
  return { ok: true, y, x: bx, z: bz };
}
