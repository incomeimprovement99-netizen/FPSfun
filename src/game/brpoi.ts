// Buildings you can go inside, for the battle royale's places.
//
// Outskirts' POIs were solid boxes: `box(12, 5, 10, ...)` is a building you
// can only stand ON. Every fight was therefore outdoors, on open sand, which
// is what "a complete pile of dogshit... much less open space... actual POIs
// and not just blocks spread around" was about.
//
// These make shells instead: walls with doorways and windows, a floor per
// storey with a hole for the stairs, stairs you can walk up (steps under the
// 0.56 m the movement allows), balconies, and a roof to fight on. The
// collision is axis-aligned boxes, so a room is four wall runs with gaps in
// them rather than one solid; a doorway is the gap between two runs.
//
// Heights, from src/config/movement.json: a stand is 1.83 m, a step 0.56 m, a
// jump 1.42 m, a mantle 2.03 m. So: a 3.4 m storey clears a standing player
// and a jump; stairs rise 0.42 m a step; a 1.2 m sill is vaultable and a
// 2.4 m container is a climb.
import * as THREE from "three";

/** what a POI builder hands these helpers: the box maker from br.ts (POI-local coordinates) */
export interface PoiCtx {
  box: (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, isSolid?: boolean) => THREE.Mesh;
  root: THREE.Group;
  /** a rideable zipline between two POI-local points */
  zip: (a: THREE.Vector3, b: THREE.Vector3, floorA: number, floorB: number) => void;
  mats: {
    wall: THREE.Material;
    floor: THREE.Material;
    trim: THREE.Material;
    crate: THREE.Material;
    steel: THREE.Material;
  };
}

/** a wall's openings: where a doorway or window sits along it, POI-local */
export type Side = "n" | "s" | "e" | "w";

export interface BuildingOpts {
  x: number;
  z: number;
  /** footprint, metres */
  w: number;
  d: number;
  storeys?: number;
  /** floor to floor, metres (3.4 clears a stand and a jump) */
  storeyH?: number;
  /** sides with a ground-floor doorway */
  doors?: Side[];
  /** sides with windows on every storey: a 1.2 m sill you can shoot over and vault */
  windows?: Side[];
  /** a stair run from the ground to the top, inside */
  stairs?: boolean;
  /** a balcony round the top storey */
  balcony?: boolean;
  /** a lip round the roof, to crouch behind */
  parapet?: boolean;
  /** wall thickness */
  t?: number;
}

const DOOR_W = 2.4;
const DOOR_H = 2.6;
const SILL = 1.1;
const WIN_TOP = 2.4;

/**
 * A building with an inside. Returns the roof height and the interior floor
 * heights, so a caller can put loot on them.
 */
export function building(ctx: PoiCtx, o: BuildingOpts): { roof: number; floors: number[] } {
  const { box, mats } = ctx;
  const w = o.w;
  const d = o.d;
  const t = o.t ?? 0.4;
  const storeys = o.storeys ?? 1;
  const h = o.storeyH ?? 3.4;
  const doors = o.doors ?? ["s"];
  const windows = o.windows ?? [];
  const floors: number[] = [];

  /**
   * One side's wall for one storey, with a doorway gap on the ground floor
   * and window gaps above. A gap is made by leaving the middle out: two runs
   * with a lintel over them.
   */
  const wall = (side: Side, y: number, storey: number): void => {
    const horizontal = side === "n" || side === "s";
    const len = horizontal ? w : d;
    const along = (v: number): [number, number] => (horizontal ? [o.x + v, o.z + (side === "n" ? -d / 2 : d / 2)] : [o.x + (side === "w" ? -w / 2 : w / 2), o.z + v]);
    const put = (from: number, to: number, base: number, top: number): void => {
      const mid = (from + to) / 2;
      const [bx, bz] = along(mid);
      const size = Math.abs(to - from);
      if (size < 0.05 || top - base < 0.05) return;
      box(horizontal ? size : t, top - base, horizontal ? t : size, bx, base, bz, mats.wall);
    };
    const hasDoor = storey === 0 && doors.includes(side);
    const hasWindow = windows.includes(side) && (storey > 0 || !hasDoor);
    const half = len / 2;
    if (hasDoor) {
      put(-half, -DOOR_W / 2, y, y + h);
      put(DOOR_W / 2, half, y, y + h);
      // the lintel over the doorway
      put(-DOOR_W / 2, DOOR_W / 2, y + DOOR_H, y + h);
    } else if (hasWindow) {
      // a band of window: sill under, lintel over, a mullion in the middle
      put(-half, -half + 0.9, y, y + h);
      put(half - 0.9, half, y, y + h);
      put(-half + 0.9, half - 0.9, y, y + SILL);
      put(-half + 0.9, half - 0.9, y + WIN_TOP, y + h);
      put(-0.2, 0.2, y + SILL, y + WIN_TOP);
    } else {
      put(-half, half, y, y + h);
    }
  };

  for (let s = 0; s < storeys; s++) {
    const y = s * h;
    for (const side of ["n", "s", "e", "w"] as Side[]) wall(side, y, s);
    // the floor over this storey: the next storey's floor, or the roof
    const top = y + h;
    const inner = { w: w - t * 2, d: d - t * 2 };
    if (s < storeys - 1) {
      // a floor with a hole at one corner for the stairs
      const holeW = o.stairs ? 3.2 : 0;
      box(inner.w - holeW, 0.3, inner.d, o.x - holeW / 2, top - 0.3, o.z, mats.floor);
      if (holeW > 0) box(holeW, 0.3, inner.d - 4.2, o.x + inner.w / 2 - holeW / 2, top - 0.3, o.z - 2.1, mats.floor);
      floors.push(top);
    } else {
      box(inner.w, 0.3, inner.d, o.x, top - 0.3, o.z, mats.floor);
    }
  }
  const roof = storeys * h;

  // the stairs: a run up the east side of each storey, steps the movement can walk
  if (o.stairs) {
    const steps = Math.max(2, Math.round(h / 0.42));
    const rise = h / steps;
    const run = Math.min(0.62, (d - t * 2 - 1.2) / steps);
    for (let s = 0; s < storeys - 1; s++) {
      const y = s * h;
      for (let i = 0; i < steps; i++) {
        const z = o.z + d / 2 - t - 0.6 - i * run;
        box(2.6, rise * (i + 1), run, o.x + w / 2 - t - 1.5, y, z, mats.floor);
      }
    }
  }

  if (o.balcony) {
    const y = roof - h;
    for (const [dx, dz, bw, bd] of [
      [0, d / 2 + 0.8, w + 1.6, 1.6],
      [0, -d / 2 - 0.8, w + 1.6, 1.6],
    ] as const) {
      box(bw, 0.3, bd, o.x + dx, y - 0.3, o.z + dz, mats.floor);
      box(bw, 0.9, 0.2, o.x + dx, y, o.z + dz + (dz > 0 ? bd / 2 : -bd / 2), mats.trim);
    }
  }

  if (o.parapet ?? true) {
    for (const [bw, bd, dx, dz] of [
      [w, 0.3, 0, -d / 2 + 0.15],
      [w, 0.3, 0, d / 2 - 0.15],
      [0.3, d, -w / 2 + 0.15, 0],
      [0.3, d, w / 2 - 0.15, 0],
    ] as const) box(bw, 0.9, bd, o.x + dx, roof, o.z + dz, mats.trim);
  }

  return { roof, floors };
}

/** a stack of crates that climbs `to` metres, at (x, z): the way onto a roof without stairs */
export function crateStair(ctx: PoiCtx, x: number, z: number, to: number, dir: 1 | -1 = 1): void {
  const step = 1.35;
  const n = Math.max(1, Math.round(to / step));
  for (let i = 0; i < n; i++) ctx.box(1.6, step * (i + 1), 1.6, x, 0, z + dir * i * 1.7, ctx.mats.crate);
}

/**
 * A jump tower: a mast with a pad on top and a zipline off it, the way up
 * being a crate stair. Hyper Scape's lesson, and Apex's balloons: a place
 * should have a way OUT that is not running across open ground.
 */
export function jumpTower(ctx: PoiCtx, x: number, z: number, to: THREE.Vector3, height = 14): void {
  const { box, mats } = ctx;
  box(2.4, height, 2.4, x, 0, z, mats.steel);
  box(4, 0.4, 4, x, height, z, mats.trim);
  crateStair(ctx, x + 3.2, z - 2, Math.min(height - 2, 5.4));
  ctx.zip(new THREE.Vector3(x, height + 1.2, z), to, height, 0);
}

/** a low wall to break a sightline: cover you can shoot over crouched and vault standing */
export function coverWall(ctx: PoiCtx, x: number, z: number, w: number, d: number): void {
  ctx.box(w, 1.2, d, x, 0, z, ctx.mats.wall);
}
