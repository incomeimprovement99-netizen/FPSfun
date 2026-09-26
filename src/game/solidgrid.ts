// A grid over the world's collision boxes (range.ts RANGE_SOLIDS), so a
// movement step, a bullet or a bot's line of sight looks only at the boxes
// near it rather than at every box in the world.
//
// Every caller used to walk the whole list. That was fine for the range and
// Outskirts (a few thousand boxes); SpeedKills' city is towers of floors and
// windowed walls, several times that, and the cost went with every step,
// every round and every bot's look, every frame (docs/PHASE_18_PLAN_SPEEDKILLS.md
// 5.6, section 10's performance budget).
//
// The list stays the one truth: code everywhere pushes to it and splices it.
// The grid notices when it has changed (its length, and the boxes at its two
// ends) and builds itself again, which is a few milliseconds and happens when
// a map is built or a hack's wall goes up or comes down. Doors move as they
// open, and a box bigger than a city block would fill hundreds of cells, so
// both sit on a short list every query also looks at.
import type * as THREE from "three";
import { RANGE_SOLIDS, type Solid } from "./range";

/** metres a cell is on a side */
const CELL = 8;
/** a box wider than this (either way) goes on the always-checked list rather than into the cells */
const BIG = 96;

const cells = new Map<number, Solid[]>();
let always: Solid[] = [];
let builtLen = -1;
let builtFirst: Solid | undefined;
let builtLast: Solid | undefined;
/** a stamp per query, so a box in several cells is handed back once */
let stamp = 0;
const seen = new WeakMap<Solid, number>();

const key = (cx: number, cz: number): number => (cx + 32768) * 65536 + (cz + 32768);
const cellOf = (v: number): number => Math.floor(v / CELL);

function build(): void {
  cells.clear();
  always = [];
  for (const s of RANGE_SOLIDS) {
    if (s.door || s.maxX - s.minX > BIG || s.maxZ - s.minZ > BIG) {
      always.push(s);
      continue;
    }
    for (let cx = cellOf(s.minX); cx <= cellOf(s.maxX); cx++) {
      for (let cz = cellOf(s.minZ); cz <= cellOf(s.maxZ); cz++) {
        const k = key(cx, cz);
        let list = cells.get(k);
        if (!list) cells.set(k, (list = []));
        list.push(s);
      }
    }
  }
  builtLen = RANGE_SOLIDS.length;
  builtFirst = RANGE_SOLIDS[0];
  builtLast = RANGE_SOLIDS[RANGE_SOLIDS.length - 1];
}

/** the grid again if the list has changed since it was built */
function fresh(): void {
  const n = RANGE_SOLIDS.length;
  if (n !== builtLen || RANGE_SOLIDS[0] !== builtFirst || RANGE_SOLIDS[n - 1] !== builtLast) build();
}

/** build it again now, whatever it thinks (a caller that moved boxes in place, as the decay does) */
export function rebuildSolidGrid(): void {
  build();
}

/**
 * Every box that may overlap the rectangle on the ground, each once: the
 * boxes in the cells it touches and the always-checked ones. The caller still
 * tests each against its own shape; this only leaves out the ones too far away.
 */
export function solidsIn(minX: number, maxX: number, minZ: number, maxZ: number, out: Solid[] = []): Solid[] {
  fresh();
  out.length = 0;
  const q = ++stamp;
  for (const s of always) out.push(s);
  for (let cx = cellOf(minX); cx <= cellOf(maxX); cx++) {
    for (let cz = cellOf(minZ); cz <= cellOf(maxZ); cz++) {
      const list = cells.get(key(cx, cz));
      if (!list) continue;
      for (const s of list) {
        if (seen.get(s) === q) continue;
        seen.set(s, q);
        out.push(s);
      }
    }
  }
  return out;
}

/**
 * Every box that may lie along a ray from `p0` along `dir` for `len` metres,
 * each once: the cells the ray's shadow on the ground crosses, walked one cell
 * at a time (a 200 m round crosses about 25, where its bounding rectangle
 * could hold hundreds), and the always-checked boxes.
 */
export function solidsAlong(p0: THREE.Vector3, dir: THREE.Vector3, len: number, out: Solid[] = []): Solid[] {
  fresh();
  out.length = 0;
  const q = ++stamp;
  for (const s of always) out.push(s);
  const take = (cx: number, cz: number): void => {
    const list = cells.get(key(cx, cz));
    if (!list) return;
    for (const s of list) {
      if (seen.get(s) === q) continue;
      seen.set(s, q);
      out.push(s);
    }
  };
  let cx = cellOf(p0.x);
  let cz = cellOf(p0.z);
  const ex = cellOf(p0.x + dir.x * len);
  const ez = cellOf(p0.z + dir.z * len);
  const flat = Math.hypot(dir.x, dir.z);
  // straight up or down: the one column of cells
  if (flat * len < 1e-6) {
    take(cx, cz);
    return out;
  }
  // a grid walk (Amanatides and Woo), with the cells either side of the path
  // taken too so a box the ray grazes at a cell's corner is never missed
  const sx = Math.sign(dir.x);
  const sz = Math.sign(dir.z);
  const tdx = dir.x !== 0 ? Math.abs(CELL / dir.x) : Infinity;
  const tdz = dir.z !== 0 ? Math.abs(CELL / dir.z) : Infinity;
  let tx = dir.x !== 0 ? ((sx > 0 ? (cx + 1) * CELL - p0.x : p0.x - cx * CELL) / Math.abs(dir.x)) : Infinity;
  let tz = dir.z !== 0 ? ((sz > 0 ? (cz + 1) * CELL - p0.z : p0.z - cz * CELL) / Math.abs(dir.z)) : Infinity;
  for (let guard = 0; guard < 4096; guard++) {
    take(cx, cz);
    take(cx + 1, cz);
    take(cx - 1, cz);
    take(cx, cz + 1);
    take(cx, cz - 1);
    if (cx === ex && cz === ez) break;
    if (tx < tz) {
      if (tx > len) break;
      cx += sx;
      tx += tdx;
    } else {
      if (tz > len) break;
      cz += sz;
      tz += tdz;
    }
  }
  return out;
}
