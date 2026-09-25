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
import { DOORWAYS } from "./doors";
import * as THREE from "three";

/**
 * A piece of the building kit put on a building (kitdress.ts): which piece,
 * where, turned how, stretched how. The buildings are collision boxes and
 * stay that way; these are what makes one read as a building rather than a
 * box. Nothing here collides with anything.
 */
export interface Dressing {
  /** the kit piece, public/models/kit/city/<piece>.gltf */
  piece: string;
  x: number;
  y: number;
  z: number;
  /** radians about y: the piece's own -z is turned to face out of the wall */
  yaw: number;
  /** stretch along the wall, and up it */
  sx: number;
  sy: number;
}
/** every building's dressing, map-local like DOORWAYS, drawn once the kit is in */
export const DRESSING: Dressing[] = [];

/** the turn that points a kit piece's own -z along (dx, dz), out of a wall */
const faceOut = (dx: number, dz: number): number => Math.atan2(-dx, -dz);

/**
 * Dress a building's outline with the kit: a cornice along each roofline, a
 * column up each corner with a cap, a frame on each doorway, and an AC unit
 * or two on the roof. The kit is laid out in two
 * metre modules; a side is split into as many as fit and each is stretched a
 * little to close the gap, so a wall of any length ends on a whole piece.
 */
function dressBuilding(o: BuildingOpts, t: number, base: number, storeys: number, h: number, roof: number, doors: Side[]): void {
  const w = o.w;
  const d = o.d;
  const sides: Array<{ side: Side; len: number; out: [number, number]; at: (v: number) => [number, number] }> = [
    { side: "s", len: w, out: [0, 1], at: (v) => [o.x + v, o.z + d / 2 + t / 2] },
    { side: "n", len: w, out: [0, -1], at: (v) => [o.x - v, o.z - d / 2 - t / 2] },
    { side: "e", len: d, out: [1, 0], at: (v) => [o.x + w / 2 + t / 2, o.z - v] },
    { side: "w", len: d, out: [-1, 0], at: (v) => [o.x - w / 2 - t / 2, o.z + v] },
  ];
  for (const s of sides) {
    const yaw = faceOut(s.out[0], s.out[1]);
    const n = Math.max(1, Math.round(s.len / 2));
    const sx = s.len / (2 * n);
    for (let i = 0; i < n; i++) {
      const v = -s.len / 2 + (i + 0.5) * (s.len / n);
      const [x, z] = s.at(v);
      // The cornice: a metre deep under the roof's edge, standing out from
      // the wall. The metal one is 30 triangles against the moulded trim's
      // 112, and there are a thousand of them round the map's rooflines; with
      // the moulded one and a brick band at every floor line the dressing
      // was 521k triangles, two and a half maps (tools/checks/render-budget.ts).
      DRESSING.push({ piece: "Cornice_Metal_Center", x, y: roof - 1, z, yaw, sx, sy: 1 });
    }
    // a frame on the ground floor's doorway, if this side has one, and a
    // bollard either side of it a step out: a doorway reads as a way in
    if (doors.includes(s.side) && !o.openGround) {
      const [x, z] = s.at(0);
      DRESSING.push({ piece: "DoorFrame_Trim", x, y: base, z, yaw, sx: DOOR_FRAME_SX, sy: DOOR_FRAME_SY });
      for (const v of [-BOLLARD_SPREAD, BOLLARD_SPREAD]) {
        const [bx, bz] = s.at(v);
        DRESSING.push({ piece: "Prop_Bollard", x: bx + s.out[0] * BOLLARD_OUT, y: base, z: bz + s.out[1] * BOLLARD_OUT, yaw, sx: 1, sy: 1 });
      }
    }
  }
  // a column up each corner, a storey at a time, capped at the roof
  for (const [cx, cz] of [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ] as const) {
    const x = o.x + cx * (w / 2 + t / 2);
    const z = o.z + cz * (d / 2 + t / 2);
    // the column's own corner is its -x, -z: turned to face out of this corner
    const yaw = faceOut(cx, cz) - Math.PI / 4;
    for (let k = 0; k < storeys; k++) DRESSING.push({ piece: k === 0 ? "Brick_CornerColumn_Bottom" : "Brick_CornerColumn_Center", x, y: base + k * h, z, yaw, sx: 1, sy: h / 3 });
    DRESSING.push({ piece: "Brick_CornerColumn_CapShort", x, y: roof - 2.8, z, yaw, sx: 1, sy: 1 });
  }
  // an AC unit or two on the roof, clear of the stair side (east) and the edges
  const seed = Math.abs(Math.round(o.x * 13 + o.z * 7));
  const units = w * d > 90 ? 2 : 1;
  for (let k = 0; k < units; k++) {
    const fx = ((seed * (k + 3)) % 100) / 100;
    const fz = ((seed * (k + 7)) % 100) / 100;
    DRESSING.push({ piece: "Prop_ACUnit", x: o.x - w / 2 + 1 + fx * Math.max(0.5, w / 2 - 2), y: roof, z: o.z - d / 2 + 1.2 + fz * Math.max(0.5, d - 2.4), yaw: (seed % 4) * (Math.PI / 2), sx: 1, sy: 1 });
  }
}

/** the bollards by a doorway: how far either side of its middle, and how far out from the wall, metres */
const BOLLARD_SPREAD = 1.9;
const BOLLARD_OUT = 1.1;

/** the kit's door frame is two metres by three: stretched to go round our 2.4 m by 2.6 m doorway */
const DOOR_FRAME_SX = 1.35;
const DOOR_FRAME_SY = 1;

/** a box maker in POI-local coordinates: size, then where its base sits */
export type BoxMaker = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, isSolid?: boolean) => THREE.Mesh;

/** what a POI builder hands these helpers: the box makers from br.ts (POI-local coordinates) */
export interface PoiCtx {
  /** a bevelled box: for small things, crates, posts and trim, where the chamfer is seen */
  box: BoxMaker;
  /**
   * A plain box, 12 triangles to the bevel's 300: for walls, floors, steps
   * and anything else big. The bevel costs the same at any size, and on a
   * 13 m wall nobody sees it.
   */
  slab: BoxMaker;
  root: THREE.Group;
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
  /**
   * Where the ground floor stands, metres (0 is the sand). A shell on a
   * terrace stands on the terrace's top, since nothing can be dug below 0.
   */
  y?: number;
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
  /**
   * Stairs from the ground to the top storey, inside, up the east side. A
   * flight fills one storey and the next starts at the other end of the
   * building, so nothing is ever built over a step. With two or more flights
   * (three storeys, or a roof stair on two) the treads share the building's
   * depth and you walk round from one flight to the next beside them: that
   * wants `w` of 5 m or more and `d` of 8.5 m or more at a 4 m storey (8 at
   * 3.6, 7.5 at 3.4), or the treads are too shallow for the bots. 12 m deep
   * gives a tread you would call a stair.
   */
  stairs?: boolean;
  /** one more flight, up through a hole in the roof: the roof is somewhere to walk to (implies stairs) */
  roofAccess?: boolean;
  /** the ground storey is an open hall on four corner columns rather than walled rooms */
  openGround?: boolean;
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
/** the stair hole's width across the building: the flight's 2.6 m and a margin */
const HOLE_W = 3.2;
/**
 * The least distance from the end wall to where a flight's third step
 * starts. A body gets onto a flight from a spot clear of the end wall behind
 * it and of the third step, which is a wall seen from the floor. The bots'
 * walk (and tools/e2e.ts's flood of it) only stands on a half-metre grid, so
 * that stretch has to be more than half a metre long, or whether the flight
 * can be climbed at all depends on where the building happens to sit. Deep
 * treads leave room for it anyway; shallow ones push the flight's foot away
 * from the wall.
 */
const FOOT = 1.33;
/**
 * The shallowest tread the bots can climb. Under a quarter of a metre one
 * half-metre move can cross three steps, more than a step and a step's lag,
 * and nothing walking that grid gets up it. Test shells flooded at 64
 * placements each agree: 0.25 m treads climbed at every one, 0.22 m at none.
 */
const MIN_TREAD = 0.25;

/**
 * A building with an inside. Returns the roof height and the interior floor
 * heights, so a caller can put loot on them.
 */
export function building(ctx: PoiCtx, o: BuildingOpts): { roof: number; floors: number[] } {
  const { box, slab, mats } = ctx;
  const w = o.w;
  const d = o.d;
  const t = o.t ?? 0.4;
  const base = o.y ?? 0;
  const storeys = o.storeys ?? 1;
  const h = o.storeyH ?? 3.4;
  const doors = o.doors ?? ["s"];
  const windows = o.windows ?? [];
  const floors: number[] = [];
  const inner = { w: w - t * 2, d: d - t * 2 };
  // Anything 2 m or more across is a slab: a building is dozens of pieces and
  // the bevel is 300 triangles each whatever its size. A mullion keeps it.
  const piece: BoxMaker = (bw, bh, bd, x, y, z, mat) => (Math.max(bw, bh, bd) >= 2 ? slab : box)(bw, bh, bd, x, y, z, mat);

  /**
   * One side's wall for one storey, with a doorway gap on the ground floor
   * and window gaps above. A gap is made by leaving the middle out: two runs
   * with a lintel over them.
   */
  const wall = (side: Side, y: number, storey: number): void => {
    const horizontal = side === "n" || side === "s";
    const len = horizontal ? w : d;
    const along = (v: number): [number, number] => (horizontal ? [o.x + v, o.z + (side === "n" ? -d / 2 : d / 2)] : [o.x + (side === "w" ? -w / 2 : w / 2), o.z + v]);
    const put = (from: number, to: number, bottom: number, top: number): void => {
      const mid = (from + to) / 2;
      const [bx, bz] = along(mid);
      const size = Math.abs(to - from);
      if (size < 0.05 || top - bottom < 0.05) return;
      piece(horizontal ? size : t, top - bottom, horizontal ? t : size, bx, bottom, bz, mats.wall);
    };
    const hasDoor = storey === 0 && doors.includes(side);
    const hasWindow = windows.includes(side) && (storey > 0 || !hasDoor);
    const half = len / 2;
    if (hasDoor) {
      // the doorway, for its door (doors.ts)
      const [dx, dz] = along(0);
      DOORWAYS.push({ x: dx, z: dz, y, side, t, w: DOOR_W, h: DOOR_H });
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

  // The stairs are worked out before the floors, because each floor's hole
  // is cut to fit the flight that comes up through it.
  //
  // This fixes two things that made every building of three storeys or more
  // a dead end for the bots. Every flight used to sit at the same x and z, so
  // storey 1's steps were built straight over storey 0's: at a 3.4 m storey
  // the headroom over the fourth step was 1.7 m, under the 1.83 m a body
  // needs, and the climb stopped there. And the hole was always 4.2 m long
  // however long the flight was, so a 3.6 m storey's 5.6 m flight ran its top
  // steps in under the slab: the North Yard warehouse's first floor could not
  // be walked to at all. Now each flight starts at the opposite end from the
  // one below it, and each hole is as long as its flight.
  const flights = o.stairs || o.roofAccess ? storeys - 1 + (o.roofAccess ? 1 : 0) : 0;
  const steps = Math.max(2, Math.round(h / 0.42));
  const rise = h / steps;
  // The tread that fits when a flight's first step sits `lead` from the end
  // wall. One flight may use the whole depth. Two or more share it: each
  // flight's hole runs 0.3 m past its top step, and the floor between that
  // and the next flight's top is where you step off one and walk round to
  // the foot of the other.
  const fit = (lead: number): number => Math.min(0.62, flights > 1 ? (inner.d - 0.8 - 2 * lead) / (2 * steps) : (inner.d - 0.6 - lead) / steps);
  let lead = 0.6;
  let run = fit(lead);
  if (FOOT - 1.5 * run > lead) {
    // shallow treads: solve lead = FOOT - 1.5 run and run = fit(lead) together
    run = Math.min(0.62, flights > 1 ? (inner.d - 0.8 - 2 * FOOT) / (2 * steps - 3) : (inner.d - 0.6 - FOOT) / (steps - 1.5));
    lead = FOOT - 1.5 * run;
  }
  const holeD = Math.min(inner.d - 0.6, lead + steps * run + 0.3);
  /** which end a flight climbs from: +1 starts at the south wall and climbs north, -1 the reverse */
  const endOf = (s: number): 1 | -1 => (s % 2 === 0 ? 1 : -1);
  // Neither of these stops the build: the building still stands, it is just
  // somewhere the bots cannot go, and this says so where someone will see it.
  if (flights > 0 && run < MIN_TREAD) {
    console.warn(`building at (${o.x}, ${o.z}): its ${run.toFixed(2)} m stair treads are too shallow for the bots to climb; it needs to be deeper than ${d} m`);
  }
  if (flights > 1 && w < 5) {
    console.warn(`building at (${o.x}, ${o.z}): at ${w} m wide there is no floor beside the stairs to walk round from one flight to the next`);
  }

  for (let s = 0; s < storeys; s++) {
    const y = base + s * h;
    if (s === 0 && o.openGround) {
      // an open hall: four corner columns carry the storeys above
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) piece(1.4, h, 1.4, o.x + sx * (w / 2 - 0.7), y, o.z + sz * (d / 2 - 0.7), mats.wall);
    } else {
      for (const side of ["n", "s", "e", "w"] as Side[]) wall(side, y, s);
    }
    // the floor over this storey: the next storey's floor, or the roof
    const top = y + h;
    if (s < flights) {
      // a hole down the east side at the end this storey's flight climbs to
      const end = endOf(s);
      slab(inner.w - HOLE_W, 0.3, inner.d, o.x - HOLE_W / 2, top - 0.3, o.z, mats.floor);
      slab(HOLE_W, 0.3, inner.d - holeD, o.x + inner.w / 2 - HOLE_W / 2, top - 0.3, o.z - (end * holeD) / 2, mats.floor);
    } else {
      slab(inner.w, 0.3, inner.d, o.x, top - 0.3, o.z, mats.floor);
    }
    if (s < storeys - 1) floors.push(top);
  }
  const roof = base + storeys * h;

  // the stairs: a flight up the east side of each storey, steps the movement can walk
  for (let s = 0; s < flights; s++) {
    const end = endOf(s);
    const y = base + s * h;
    for (let i = 0; i < steps; i++) {
      const z = o.z + end * (inner.d / 2 - lead - i * run);
      slab(2.6, rise * (i + 1), run, o.x + w / 2 - t - 1.5, y, z, mats.floor);
    }
  }

  if (o.balcony) {
    const y = roof - h;
    for (const [dx, dz, bw, bd] of [
      [0, d / 2 + 0.8, w + 1.6, 1.6],
      [0, -d / 2 - 0.8, w + 1.6, 1.6],
    ] as const) {
      slab(bw, 0.3, bd, o.x + dx, y - 0.3, o.z + dz, mats.floor);
      slab(bw, 0.9, 0.2, o.x + dx, y, o.z + dz + (dz > 0 ? bd / 2 : -bd / 2), mats.trim);
    }
  }

  dressBuilding(o, t, base, storeys, h, roof, doors);

  if (o.parapet ?? true) {
    for (const [bw, bd, dx, dz] of [
      [w, 0.3, 0, -d / 2 + 0.15],
      [w, 0.3, 0, d / 2 - 0.15],
      [0.3, d, -w / 2 + 0.15, 0],
      [0.3, d, w / 2 - 0.15, 0],
    ] as const) piece(bw, 0.9, bd, o.x + dx, roof, o.z + dz, mats.trim);
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
 * Where a jump tower's ramp goes: the face of the pad it runs along, and the
 * way it runs down to its foot along that face.
 */
export type RampSide = { face: "e" | "w"; foot: "n" | "s" } | { face: "n" | "s"; foot: "e" | "w" };

/**
 * A jump tower: a mast with a pad on top, a ramp up to it, and a zipline off
 * it. Hyper Scape's lesson, and Apex's balloons: a place should have a way
 * OUT that is not running across open ground.
 *
 * It used to be a 13 to 15 m mast with a crate stair that stopped at 5.4 m
 * in 1.35 m steps, so nobody could stand on the pad and its zipline could
 * only be ridden toward it, never away. The pad is 6 m now and a ramp of
 * half-metre tiers climbs to it, which a bot can walk as well as a player.
 *
 * It does not hang its own rope. It returns where the rope is tied and the
 * pad's top, and br.ts's rotation network ties every rope on the map in one
 * table, since where a rope comes down is a place built later in the file.
 */
export function jumpTower(ctx: PoiCtx, x: number, z: number, ramp: RampSide, height = 6): { anchor: THREE.Vector3; floor: number } {
  const { box, slab, mats } = ctx;
  box(2.4, height, 2.4, x, 0, z, mats.steel);
  slab(4, 0.4, 4, x, height, z, mats.trim);
  // The ramp: tiers a metre deep rising at most 0.5 m each, all standing on
  // the ground, flush against one face of the pad. Its top tier is level with
  // the mast's head, 0.4 m under the pad, at the pad's far end; each tier
  // below it is a tread nearer the foot.
  const n = Math.ceil(height / 0.5);
  const rise = height / n;
  const tread = 1;
  const alongZ = ramp.face === "e" || ramp.face === "w";
  // the ramp's middle line, off the pad's middle: the pad's half-width and the ramp's
  const out = (ramp.face === "e" || ramp.face === "s" ? 1 : -1) * (2 + 1.8);
  const down = ramp.foot === "s" || ramp.foot === "e" ? 1 : -1;
  for (let i = 0; i < n; i++) {
    // along the face, off the pad's middle: tier n - 1 is the pad's far end
    const at = down * ((n - 1 - i) * tread - (2 - tread / 2));
    if (alongZ) slab(3.6, rise * (i + 1), tread, x + out, 0, z + at, mats.floor);
    else slab(tread, rise * (i + 1), 3.6, x + at, 0, z + out, mats.floor);
  }
  // The rope is 1.8 m over the pad. Your hands are 2.13 m over your feet and
  // reach 2.41 m, so it is in reach from the pad; and hanging from it your
  // feet are within a step of the pad's top, so the pad does not knock you
  // off the moment you set off, which a rope 1.2 m over it would.
  return { anchor: new THREE.Vector3(x, height + 2.2, z), floor: height + 0.4 };
}

/**
 * A low wall to break a sightline: cover you can shoot over crouched and
 * vault standing. `y` is the ground it stands on, for a wall along a berm's
 * crest. Two metres or more long it is a slab, as a building's walls are.
 */
export function coverWall(ctx: PoiCtx, x: number, z: number, w: number, d: number, y = 0): void {
  (Math.max(w, d) >= 2 ? ctx.slab : ctx.box)(w, 1.2, d, x, y, z, ctx.mats.wall);
}
