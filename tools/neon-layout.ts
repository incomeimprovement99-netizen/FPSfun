// The map made of Daelonik's Neon City (Phase 28, docs/PHASE_28_PLAN_THE_CENTRE_FROM_NEON_CITY.md): where every piece
// goes, from the plan's rules and the pieces' measured bounds (tools/import-neon.ts NEON=catalogue), written to
// src/config/neonmap.json for the bake (NEON=bake) and the game (src/game/neonmap.ts). A piece is placed by its measured
// footprint, never its pivot: High City's towers hang 26 m under theirs, and the realistic buildings' pivots are at a
// corner of their basement.
//
// Map-local metres, x east and z south, the ground at y 0, the map to 152 either way (world.json cut, neonmap.json game.sectors). Every number
// that shapes the map is in the config's `rules`, read here; this file only applies them.
//
// Run: npx tsx tools/neon-layout.ts   (needs the catalogue: NEON=catalogue npx tsx tools/import-neon.ts)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { streets, StreetField, contours, along, type Pt, type Street } from "./neon-streets";
import { stairCore } from "./neon-tower";
import { measure, wellFlight, type Flight } from "./neon-well";
import { MOVE } from "../src/game/movement";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const CFG_FILE = join(ROOT, "src", "config", "neonmap.json");
const PAID = process.env.PAID_DIR ?? "C:/Users/jwilb/Downloads/speedkills-paid";
type Row = { path: string; size: number[] | null; min: number[] | null; max: number[] | null; tris: number; materials?: string[] };
const catalogue: Row[] = JSON.parse(readFileSync(join(PAID, "neon", "catalogue.json"), "utf8"));
const cfg = JSON.parse(readFileSync(CFG_FILE, "utf8"));
const R = cfg.rules;

/** a prefab by the end of its path (unique in the bundle's City Builder), its measured row */
const byName = new Map<string, Row>();
for (const r of catalogue) {
  if (!r.size) continue;
  const short = r.path.split("City Builder/")[1] ?? r.path;
  byName.set(short, r);
}
function piece(name: string): { key: string; row: Row } {
  const hits = [...byName.entries()].filter(([k]) => k === name || k.endsWith(`/${name}`) || k.endsWith(`/${name}.prefab`));
  if (hits.length !== 1) throw new Error(`piece ${name}: ${hits.length} matches${hits.length ? ` (${hits.map(([k]) => k).join(", ")})` : ""}`);
  return { key: hits[0][0], row: hits[0][1] };
}

/** a placement: the prefab, its pivot (x, y, z), its turn about y in degrees, how it collides, a material over all its parts */
type Place = [string, number, number, number, number, "g" | "s" | "o", (string | null)?, string[]?];
const chunks = new Map<string, { sector: string; place: Place[] }>();
const add = (chunk: string, sector: string, p: Place) => {
  // (never a piece the map must not show, rules.banned: the pack's letter sign Neon008 spells "free sex" in Korean, and
  // stood in the street and as the south deck's 14 m landmark until Milestone 571)
  if ((R.banned?.pieces as string[] | undefined)?.some((b) => p[0].endsWith(`/${b}`))) throw new Error(`${p[0]}: in rules.banned`);
  const c = chunks.get(chunk) ?? chunks.set(chunk, { sector, place: [] }).get(chunk)!;
  c.place.push(p);
};

/** a piece's footprint once turned by `yaw` (90 degree steps), relative to its pivot: [x0, x1, z0, z1] */
function turned(row: Row, yaw: number): [number, number, number, number] {
  const [x0, , z0] = row.min!;
  const [x1, , z1] = row.max!;
  const t = (((yaw % 360) + 360) % 360) / 90;
  // three.js's turn about y (column-major, as the bake applies it): x' = c x + s z, z' = -s x + c z
  const corners = [
    [x0, z0],
    [x1, z0],
    [x0, z1],
    [x1, z1],
  ].map(([x, z]) => {
    const a = (t * Math.PI) / 2;
    const c = Math.round(Math.cos(a));
    const s = Math.round(Math.sin(a));
    return [c * x + s * z, -s * x + c * z];
  });
  return [Math.min(...corners.map((q) => q[0])), Math.max(...corners.map((q) => q[0])), Math.min(...corners.map((q) => q[1])), Math.max(...corners.map((q) => q[1]))];
}

/** a turn about y as the bake applies it (x' = c x + s z, z' = -s x + c z), any angle */
/** a player's step (movement.json stepHeight, in hammer units: an inch each), metres */
const MOVE_STEP = JSON.parse(readFileSync(join(ROOT, "src", "config", "movement.json"), "utf8")).stepHeight * 0.0254;
const rotY = (yaw: number, x: number, z: number): Pt => {
  const a = (yaw * Math.PI) / 180;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  return [c * x + s * z, -s * x + c * z];
};
/** the turn that points a piece's own +z along (dx, dz) */
const yawToward = (dx: number, dz: number) => (Math.atan2(dx, dz) * 180) / Math.PI;
/** an oriented box on the ground: its middle, its own x and z axes on the map, their half lengths */
type OBox = { c: Pt; u: Pt; v: Pt; hu: number; hv: number; top: number };
/**
 * place a piece at any turn, the middle of its own footprint at (cx, cz), its base at y; the oriented box it covers
 */
function placeTurned(chunk: string, name: string, cx: number, cz: number, yaw: number, mode: Place[5], y = 0, mat?: string, scale = 1): OBox {
  const { key, row } = piece(name);
  const [mx, mz] = [((row.min![0] + row.max![0]) / 2) * scale, ((row.min![2] + row.max![2]) / 2) * scale];
  const [ox, oz] = rotY(yaw, mx, mz);
  const head = [key, +(cx - ox).toFixed(3), +y.toFixed(3), +(cz - oz).toFixed(3), +yaw.toFixed(2), mode];
  add(chunk, "c", (scale !== 1 ? [...head, mat ?? null, null, scale] : mat ? [...head, mat] : head) as unknown as Place);
  return { c: [cx, cz], u: rotY(yaw, 1, 0), v: rotY(yaw, 0, 1), hu: (row.size![0] / 2) * scale, hv: (row.size![2] / 2) * scale, top: y + row.max![1] * scale };
}
/**
 * a one-sided piece (rules.dress.twoFaced: the pack's tall poster board is posters on one face, an empty frame from
 * behind round what collides as a solid box) with a drawn twin turned about on the same footprint, a face to each side
 */
function placeFaced(chunk: string, name: string, cx: number, cz: number, yaw: number, mode: Place[5], y = 0): OBox {
  const b = placeTurned(chunk, name, cx, cz, yaw, mode, y);
  if (((R.dress.twoFaced ?? []) as string[]).includes(name)) placeTurned(chunk, name, cx, cz, yaw + 180, "g", y);
  return b;
}
/**
 * the street's tall cover dressed (rules.dress.board): the pack's poster sheet on each face of the concrete panel just
 * placed, `up` over its foot and `gap` off each face, drawn only. The panel's own thin side is its z
 */
function dressBoard(chunk: string, name: string, x: number, z: number, yaw: number, foot: number): void {
  const B = R.dress.board as { piece: string; up: number; gap: number } | undefined;
  if (!B) return;
  const wall = piece(name).row, sheet = piece(B.piece).row;
  const d = wall.size![2] / 2 + sheet.size![2] / 2 + B.gap;
  const [nx, nz] = rotY(yaw, 0, 1);
  const y = foot + B.up - sheet.min![1];
  placeTurned(chunk, B.piece, x + nx * d, z + nz * d, yaw, "g", y);
  placeTurned(chunk, B.piece, x - nx * d, z - nz * d, yaw + 180, "g", y);
}
/** whether two oriented boxes, each grown by `gap`, overlap (separating axes) */
function overlaps(a: OBox, b: OBox, gap: number): boolean {
  for (const ax of [a.u, a.v, b.u, b.v]) {
    const proj = (o: OBox) => (o.hu + gap / 2) * Math.abs(o.u[0] * ax[0] + o.u[1] * ax[1]) + (o.hv + gap / 2) * Math.abs(o.v[0] * ax[0] + o.v[1] * ax[1]);
    const d = Math.abs((a.c[0] - b.c[0]) * ax[0] + (a.c[1] - b.c[1]) * ax[1]);
    if (d > proj(a) + proj(b)) return false;
  }
  return true;
}
/** points round an oriented box's edge, every metre */
const rim = (o: OBox): Pt[] => {
  const out: Pt[] = [];
  for (const [su, sv, du, dv, n] of [[-1, -1, 1, 0, o.hu * 2], [1, -1, 0, 1, o.hv * 2], [1, 1, -1, 0, o.hu * 2], [-1, 1, 0, -1, o.hv * 2]] as const)
    for (let t = 0; t <= n + 1e-6; t += 1) {
      const a = su * o.hu + du * t, b = sv * o.hv + dv * t;
      out.push([o.c[0] + o.u[0] * a + o.v[0] * b, o.c[1] + o.u[1] * a + o.v[1] * b]);
    }
  return out;
};
const boxOf = (r: number[]): OBox => ({ c: [(r[0] + r[1]) / 2, (r[2] + r[3]) / 2], u: [1, 0], v: [0, 1], hu: (r[1] - r[0]) / 2, hv: (r[3] - r[2]) / 2, top: 0 });

// The last bake's collision (src/config/neon/neonmap.solids.json), as the passes that read it see it: without the street
// walls the last run laid (rules.low.walls, laid last), whose boxes the bake lists beside the rest (`laid`). Each such
// pass then decides as it did before the walls stood, and the walls pass lays them again on the same ground, so the run
// after a bake lays the city the run before it laid. Told apart by what they are, not where they stand: a wall's
// footprint, grown by a margin, took in a corner block's fire escape beside it, and the wall moved at every bake
const SOLIDS_FILE = join(ROOT, "src", "config", "neon", "neonmap.solids.json");
let LAST_SOLIDS: number[][] | undefined;
function lastSolids(): number[][] {
  if (LAST_SOLIDS) return LAST_SOLIDS;
  const file: { solids: number[][]; laid?: number[][] } = existsSync(SOLIDS_FILE) ? JSON.parse(readFileSync(SOLIDS_FILE, "utf8")) : { solids: [] };
  const laid = file.laid ?? [];
  return (LAST_SOLIDS = laid.length ? file.solids.filter((_, i) => !laid.some(([a, b]) => i >= a && i < b)) : file.solids);
}

/**
 * place a piece so its turned footprint's middle is at (cx, cz) and its base (its measured bottom, or `base`) at y; with
 * `snap`, its pivot moved onto the nearest of that grid's lines and its middle with it
 */
function placeAt(chunk: string, sector: string, name: string, cx: number, cz: number, yaw: number, mode: Place[5], o: { y?: number; bottom?: boolean; mat?: string; without?: string[]; snap?: number } = {}): { x0: number; x1: number; z0: number; z1: number; top: number; px: number; pz: number } {
  const { key, row } = piece(name);
  const [fx0, fx1, fz0, fz1] = turned(row, yaw);
  let px = cx - (fx0 + fx1) / 2;
  let pz = cz - (fz0 + fz1) / 2;
  if (o.snap) {
    [px, pz] = [Math.round(px / o.snap) * o.snap, Math.round(pz / o.snap) * o.snap];
    [cx, cz] = [px + (fx0 + fx1) / 2, pz + (fz0 + fz1) / 2];
  }
  // by default the piece's own zero is the ground (a building's ground floor, whatever lies under it); `bottom` puts its
  // lowest point there instead (High City's towers, whose zero is their roof)
  const py = (o.y ?? 0) - (o.bottom ? row.min![1] : 0);
  add(chunk, sector, [key, +px.toFixed(3), +py.toFixed(3), +pz.toFixed(3), yaw, mode, ...(o.mat || o.without ? [o.mat ?? null] : []), ...(o.without ? [o.without] : [])] as Place);
  return { x0: cx - (fx1 - fx0) / 2, x1: cx + (fx1 - fx0) / 2, z0: cz - (fz1 - fz0) / 2, z1: cz + (fz1 - fz0) / 2, top: py + row.max![1], px, pz };
}

/** a seeded random (mulberry32): the same map every run */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = seeded(R.seed);

const sectorAt = (x: number, z: number): string => {
  const c = R.centre;
  const col = x < -c ? "w" : x > c ? "e" : "";
  const row = z < -c ? "n" : z > c ? "s" : "";
  return row + col || "c";
};

// ---------------------------------------------------------------- the ground and the streets
// The centre's streets curve (rules.streets.curves, tools/neon-streets.ts): the Loop round the tower and eight streets
// out from four forks on it in an S to the edge road, where the outer districts' straight roads go on. Their surface is
// baked from the same curves (tools/import-neon.ts): the ground's tiles under them are pavement. Outside the centre
// (the ring road and past it) the straight roads stay, their tiles the road's
const T = R.tile;
const CV = R.streets.curves;
const STREETS: Street[] = streets(CV);
const SF = new StreetField(STREETS);
/** how far outside the centre's roads a point is (negative: on one), with the junctions' rounded corners */
const onRoad = (x: number, z: number, except?: Street) => SF.surface(x, z, CV.round, except);
const inBand = (v: number, a: number, b: number) => v > a - 1e-6 && v < b + 1e-6;
const road = (x: number, z: number): boolean => {
  if (Math.max(Math.abs(x), Math.abs(z)) < CV.inside) return false;
  const C = R.streets.centres as number[];
  const hw = R.streets.road / 2;
  if (C.some((c) => inBand(x, c - hw, c + hw) || inBand(z, c - hw, c + hw))) return true;
  const [r0, r1] = R.ring;
  const inRingX = Math.abs(x) >= r0 && Math.abs(x) <= r1 && Math.abs(z) <= r1;
  const inRingZ = Math.abs(z) >= r0 && Math.abs(z) <= r1 && Math.abs(x) <= r1;
  return inRingX || inRingZ;
};
/** a street's unit normal at point i, and which side of it is the corner block's (away from the axes) */
const normalAt = (s: Street, i: number): Pt => [-s.tan[i][1], s.tan[i][0]];
/** the footprints the ground is left out under (a building's own floor is its ground there, and its basement goes down) */
const noGround: Array<[number, number, number, number]> = [];

// ---------------------------------------------------------------- the middle block: the tallest building
{
  const M = R.middle;
  // The tower's floors (rules.tower): its main body's tall empty middle (14 to 38 m: its floors stop at 14 and start again
  // at 38.5, nothing between) cleared from inside its shell, and a stair core cut up its middle from the lobby's floor to
  // under its roof, the pack's floors and walls it passes through clipped to the core's box (tools/neon-tower.ts). The
  // bake builds the core and the main body's floors from 14 to 35 m, a 3 m storey each as its facade has them
  const T = R.tower;
  const C = T?.core;
  // (and the pack's floor tiles of its first 3 m storey, which reach out under its shell to its faces)
  // (and the lobby's arch that stood a metre before the core's west door: its post and its round top; the cut goes
  // `cutPast` beyond the core's faces sideways, so a face lying on one, a lobby pillar's, goes with it, and not down, so
  // the lobby's floor under the core stays)
  // (and the way from the base's roof onto the tower's terrace at 10.5 m and in through its glass waist: the terrace's
  // curb, 0.75 m, a wall to a walk, left out in front of each of the waist's two doors, and the doors themselves, shut)
  // (and the building's own triangles cut out over each express rope where it passes them, rules.tower.express `cut`, 2 cm past
  // the hole each way: the collision's columns take a face on a grid line into both columns beside it, and cut on the hole's
  // own lines the crown's deck kept a half-metre strip of each hole shut. Up to the penthouse the ropes pass none)
  const EX = T?.express as { at: number[][]; from: number; to: number; hole: number; hang: number; over: number; colour: string; cut?: number[] } | undefined;
  const ropeCuts = EX?.cut ? EX.at.map(([ex, ez]) => `*|${[ex - EX.hole / 2 - 0.02, ex + EX.hole / 2 + 0.02, EX.cut![0], EX.cut![1], ez - EX.hole / 2 - 0.02, ez + EX.hole / 2 + 0.02].join(",")}`) : [];
  const without = T ? [...(T.lobbyArch as string[]), ...((T.terraceWay ?? []) as string[]), `*#${T.strip.join(",")}`, `*#${T.floorStrip.join(",")}~FloorBasic00`, `*|${[C.box[0] - C.cutPast, C.box[1] + C.cutPast, C.storeys[0], C.top, C.box[2] - C.cutPast, C.box[3] + C.cutPast].join(",")}`, ...ropeCuts] : [];
  const b = placeAt("c-middle", "c", M.building, 0, 0, M.yaw, "o", T ? { without } : {});
  noGround.push([b.x0, b.x1, b.z0, b.z1]);
  cfg.tallest = { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, top: +b.top.toFixed(2), foot: +piece(M.building).row.min![1].toFixed(2) };
  if (T) {
    if (M.yaw !== 0) throw new Error("the tower's floors are laid in its own frame, unturned");
    // (the prefab's frame onto the map: its pivot, the building unturned)
    const [px, pz] = [b.px, b.pz];
    const on = (x: number, z: number): Pt => [+(x + px).toFixed(3), +(z + pz).toFixed(3)];
    const doors = (C.storeys as number[]).map((h) => (C.doors[String(h)] ?? C.doors.default) as string[]);
    // (the bake's measure of the floors, kept until it measures them again)
    const measured = cfg.tower?.measured;
    cfg.tower = {
      ...(measured ? { measured } : {}),
      pivot: [px, pz],
      shaft: T.shaft,
      square: [...on(T.square[0], T.square[2]), ...on(T.square[1], T.square[3])],
      seed: on(T.seed[0], T.seed[1]),
      cell: T.cell,
      close: T.close,
      seal: T.seal,
      reach: T.reach,
      slab: T.slab,
      tuck: T.tuck,
      mats: T.mats,
      scale: T.scale,
      backs: T.backs,
      ...(T.backsUp ? { backsUp: T.backsUp } : {}),
      backWear: T.backWear,
      coplanar: T.coplanar,
      core: { box: [...on(C.box[0], C.box[2]), ...on(C.box[1], C.box[3])], storeys: C.storeys, top: C.top, wall: C.wall, landing: C.landing, divider: C.divider, tread: C.tread, riser: C.riser, stepDepth: C.stepDepth, slab: C.slab, door: C.door, doors, mats: C.mats, scale: C.scale },
      ...(T.sky ? { sky: T.sky } : {}),
      ...(T.lid ? { lid: T.lid } : {}),
      ...(T.levels ? { levels: T.levels } : {}),
      ...(EX ? { express: { at: EX.at.map(([ex, ez]) => on(ex, ez)), from: EX.from, to: EX.to, hole: EX.hole } } : {}),
    };
    // the express ropes for the game (src/game/neonmap.ts draws them as it draws the glass lifts' and rides them the same)
    if (EX) cfg.express = EX.at.map(([ex, ez]) => { const [x, z] = on(ex, ez); return { rope: [[x, +(EX.from + EX.hang).toFixed(3), z], [x, +(EX.to + EX.over).toFixed(3), z]], floor: EX.from, colour: EX.colour }; });
    // a low barrier round each rope's hole at each floor it passes and on the crown (rules.tower.express `rail`): too high to
    // step over, so a body walking the floor is not dropped down the shaft, and low enough that a rider put forward off the
    // rope's top (3.7 m on, rising 0.7 m) or jumping off at a level clears it; each side `off` from the rope, its inner face
    // past the hole's own grid line so its collision does not close the hole
    const RL = (EX as unknown as { rail?: { piece: string; off: number; at: number[] } } | undefined)?.rail;
    if (EX && RL) {
      const row = piece(RL.piece).row;
      const [long, thick] = [Math.max(row.size![0], row.size![2]), Math.min(row.size![0], row.size![2])];
      // (the piece's own long axis: turned so it runs along the side)
      const alongZ = row.size![2] >= row.size![0];
      const d = RL.off + thick / 2;
      for (const [ex, ez] of EX.at) {
        const [x, z] = on(ex, ez);
        for (const y of RL.at)
          for (const k of [-0.5, 0.5]) {
            placeTurned("c-tower", RL.piece, x - d, z + k * long, alongZ ? 0 : 90, "o", y);
            placeTurned("c-tower", RL.piece, x + d, z + k * long, alongZ ? 0 : 90, "o", y);
            placeTurned("c-tower", RL.piece, x + k * long, z - d, alongZ ? 90 : 0, "o", y);
            placeTurned("c-tower", RL.piece, x + k * long, z + d, alongZ ? 90 : 0, "o", y);
          }
      }
    }
    // (as x0, x1, z0, z1 on the map)
    const [ax, az, bx, bz] = cfg.tower.core.box;
    cfg.tower.core.box = [ax, bx, az, bz];
    const [sx0, sz0, sx1, sz1] = cfg.tower.square;
    cfg.tower.square = [sx0, sx1, sz0, sz1];
    // the core's way up for a body, storey by storey (walked by the checks), from the same geometry the bake builds
    cfg.tower.core.route = stairCore(cfg.tower.core, C.scale).route.map((q) => q.map((v) => +v.toFixed(2)));
    // Each of the main body's floors laid out (rules.tower.floors; the owner, 2026-09-30: "many floors of big rooms and
    // staircases and some walls partitioning the floor off, differs each floor. Some should have no or little walls,
    // some should have a lot of walls"). The core stands in the middle of a ring 7.5 m wide; the partitions run from the
    // core's corners out to the faces (`lines`: its own x 5 and 12.5 north and south, 7.5 m each, and its own z 5 and 10
    // west and east, 5 m from the core to each face's groove), and `extra` ones part the corner rooms. A plan names which
    // lines stand and how each is opened: `door` a 2.5 m doorway in it, `gate` the pack's wide gate, `wall` closed.
    // Every floor strewn with its `cover` and lit, none of it within reach of the core's doors
    // the slits beside the north and south faces' grooves closed (rules.tower.slots): a body's width of sky showed
    // through between the window wall's end and the groove at every storey, measured by the bake's seal (a ray out of
    // each); the pack's half-metre wall stood in each, a storey at a time
    for (const h of T.shaft as number[]) for (const [sx, sz] of T.slots.at as number[][]) placeTurned("c-tower", T.slots.piece, sx + px, sz + pz, 0, "o", h - 0.02);
    const F = T.floors;
    // (a storey's ceiling: the slab under the storey over it, or a slab of its own as high, the lid over the sky floors and
    // each level's ceiling, rules.tower.lid and levels: with the core carried on up past it the storey over the 45.5 m floor
    // is the stair's 48.5, and its doors and lamps measured from that stood 10 cm short of the lid)
    const lid = T.lid as { at: number; slab: number } | undefined;
    const levelsT = (T.levels ?? []) as Array<{ floor: { at: number }; ceiling: { at: number; slab: number } }>;
    const ownCeilings = [...(lid ? [lid] : []), ...levelsT.map((q) => q.ceiling)];
    const ceilingOf = (h: number): number => {
      // (a level's own ceiling first, the penthouse's two storeys up)
      const lv = levelsT.find((q) => q.floor.at === h);
      if (lv) return lv.ceiling.at - lv.ceiling.slab;
      const S = C.storeys as number[];
      const next = S[S.indexOf(h) + 1];
      const own = ownCeilings.find((q) => q.at > h && (next === undefined || q.at <= next + 0.1));
      return own ? own.at - own.slab : next - T.slab;
    };
    // (the floors numbered up from the first laid out: the new floors 1 to 8, the sky floors over them 9 to 11, the levels 12 to 14)
    const numbered = Object.keys(F.at).map(Number).sort((a, b) => a - b);
    const rnd3 = seeded(F.seed);
    const pick3 = <Q,>(a: Q[]): Q => a[Math.floor(rnd3() * a.length)];
    const lines = F.lines as Record<string, number[]>;
    let tWalls = 0, tProps = 0, tLamps = 0;
    const wayLog: string[] = [];
    for (const [hs, P] of Object.entries(F.at as Record<string, { plan: string; cover: number; pieces?: string[]; mat?: string; lampMat?: string }>)) {
      const h = Number(hs);
      const plan = F.plans[P.plan] as Record<string, string>;
      const placed: OBox[] = [];
      // (the partitions as a body meets them: each piece, and the width open through it, a doorway's or a gate's)
      const bars: Array<{ o: OBox; open: number; pad: number }> = [];
      // (the walls' and the gates' collision column; a doorway and its half-metre wall beside it as drawn, the way a body
      // was walked through every one of them)
      const padOf = (name: string) => (name === F.frame?.door || name === F.frame?.fill ? 0 : (F.way as { column: number }).column);
      const FW = F.way as { cell: number; door: number; gate: number; column: number; corner: number };
      // the core and the way out of each of its doors, kept clear
      const [cx0, cx1, cz0, cz1] = C.box;
      const keepT: OBox[] = [boxOf([cx0 + px - 0.3, cx1 + px + 0.3, cz0 + pz - 0.3, cz1 + pz + 0.3])];
      const ds = (C.doors[hs] ?? C.doors.default) as string[];
      const dz = (cz0 + cz1) / 2, dx = cx0 + C.wall + C.landing / 2;
      if (ds.includes("w")) keepT.push(boxOf([cx0 + px - 3, cx0 + px, dz + pz - 1.5, dz + pz + 1.5]));
      if (ds.includes("n")) keepT.push(boxOf([dx + px - 1.5, dx + px + 1.5, cz0 + pz - 3, cz0 + pz]));
      if (ds.includes("s")) keepT.push(boxOf([dx + px - 1.5, dx + px + 1.5, cz1 + pz, cz1 + pz + 3]));
      // (and the express ropes on every floor they pass or start from, their holes and `clear` round them: the way on and off)
      if (EX && h >= EX.from && h <= EX.to) for (const [ex, ez] of EX.at) keepT.push(boxOf([ex + px - EX.hole / 2 - F.clear, ex + px + EX.hole / 2 + F.clear, ez + pz - EX.hole / 2 - F.clear, ez + pz + EX.hole / 2 + F.clear]));
      // the partitions: a line from a to b (its own metres), opened as the plan says
      for (const [name, how] of Object.entries(plan)) {
        const [ax, az, bx, bz] = lines[name] ?? F.extra[name];
        const L = Math.hypot(bx - ax, bz - az);
        const n = Math.round(L / 2.5);
        const d: Pt = [(bx - ax) / L, (bz - az) / L];
        const yaw = Math.abs(d[0]) > 0.5 ? 0 : 90;
        // (a line's doorway and its gate at its core end: at the face end the grooves, the slits' walls and the round
        // corners crowded each one to less than a body's way through)
        const door = how === "door" ? n - 1 : -1;
        const gate = how === "gate" ? n - 2 : -1;
        // (a doorway and a gate in their own frames, rules.tower.floors.frame; the fourth review: "partitions look like
        // stage flats short of the ceiling", a 2.5 m gap open to the ceiling. The pack's door and gate are 3 m tall with
        // their heads at 2.9 m, over these storeys' 2.5 m ceilings: each down until its top is 2 cm into the slab over
        // it, its foot inside the floor's, so its head shows, and never with its foot over the floor (the halls at 35 m
        // are a 3.5 m storey, and there it stands as the walls do); its faces in the floor's own wall, its steel frame
        // as it is)
        // (the door `scale`d a hundredth: the collision's columns take a face on a grid line into both columns beside
        // it, and with its jambs' inner faces on the quarter-metre lines 0.95 m of its 1.5 m opening was open, a body
        // 0.81 m; scaled, each face stands 7.5 mm off the line in its jamb's own column, its ends a centimetre into the
        // walls beside it)
        const FR = F.frame as { door: string; fill: string; faces: string[]; scale: number } | undefined;
        const ceiling = ceilingOf(h);
        const sunk = (name: string, k = 1) => Math.min(h - 0.02, ceiling + 0.02 - piece(name).row.size![1] * k);
        const framed = (name: string): string | undefined => {
          if (!FR || !P.mat) return P.mat;
          const has = new Set(piece(name).row.materials ?? []);
          return FR.faces.filter((f) => has.has(f)).map((f) => `${f}=${P.mat}`).join(";") || P.mat;
        };
        let k = 0;
        while (k < n) {
          if (k === door) {
            if (FR) {
              // (the door 2 m wide, the slot's last half-metre at the core's corner a wall)
              const at = (u: number): Pt => [ax + d[0] * u + px, az + d[1] * u + pz];
              const [fx, fz] = at(k * 2.5 + 1);
              const db = placeTurned("c-tower", FR.door, fx, fz, yaw, "o", sunk(FR.door, FR.scale), framed(FR.door), FR.scale);
              placed.push(db);
              bars.push({ o: db, open: FW.door, pad: padOf(FR.door) });
              // (and the way through it kept clear of cover `clear` metres either side, as the core's doors are: on the
              // 45.5 m floor a crate a door's width inside the east room's door walled the room off)
              keepT.push({ c: [fx, fz], u: [d[0], d[1]], v: [-d[1], d[0]], hu: 1, hv: F.clear, top: 0 });
              const [wx, wz] = at(k * 2.5 + 2.25);
              const fb = placeTurned("c-tower", FR.fill, wx, wz, yaw, "o", h - 0.02, P.mat);
              placed.push(fb);
              bars.push({ o: fb, open: 0, pad: padOf(FR.fill) });
              tWalls += 2;
            }
            k++;
            continue;
          }
          // (a 5 m piece over this slot and the next, but where the next begins the gate: a 2.5 m one first)
          const two = k === gate || (k + 1 < n && k + 1 !== door && k + 1 !== gate);
          const piece5 = k === gate ? F.gate : F.walls["5"];
          const len = two ? 5 : 2.5;
          const c: Pt = [ax + d[0] * (k * 2.5 + len / 2) + px, az + d[1] * (k * 2.5 + len / 2) + pz];
          // (2 cm into the floor, its top 2 cm inside the slab over it: neither face shares a plane with a floor)
          // (in the floor's own wall material, rules.tower.floors.at[h].mat: the floors looked alike)
          const isGate = k === gate && !!FR;
          const wb = placeTurned("c-tower", two ? piece5 : F.walls["2.5"], c[0], c[1], yaw, "o", isGate ? sunk(F.gate) : h - 0.02, isGate ? framed(F.gate) : P.mat);
          placed.push(wb);
          bars.push({ o: wb, open: isGate ? FW.gate : 0, pad: padOf(two ? piece5 : F.walls["2.5"]) });
          if (isGate) keepT.push({ c, u: [d[0], d[1]], v: [-d[1], d[0]], hu: 2.5, hv: F.clear, top: 0 });
          tWalls++;
          k += two ? 2 : 1;
        }
      }
      // (the lamps keep off the partitions: on the rooms and maze floors a lamp hung in a wall)
      const wallBoxes = placed.slice();
      // the floor's number beside each of its core doors (rules.tower.floors.digits): the pack's lit digit, flat on the
      // core's outside face, `beside` the door's edge toward the core's far end and `up` over the floor
      const DG = F.digits as { piece: string; first: number; up: number; beside: number; off: number; mat?: string; big?: { scale: number; up: number; beside: number; off: number } } | undefined;
      if (DG && numbered.includes(h)) {
        const num = String(DG.first + numbered.indexOf(h));
        const dw = C.door[0];
        const doorsHere = ds;
        // (a number of two figures, 10 and 11, is two of the pack's signs side by side: it has signs for 0 to 9 alone. A
        // sign's plate is its height square, its bracket out past it on its own +z to the whole of its depth (a metre and
        // 1.21 m, measured off the model); two stand a plate and a bracket apart, the bracket between them, from the same
        // gap off the door's edge as one sign, and smaller where the wall to the core's corner is short for two: the west
        // door's 1.7 m)
        const one = piece(`${DG.piece}${num[0]}.prefab`).row;
        const [plate, pitch] = [one.size![1], one.size![2]];
        const row = (k: number, beside: number, room: number) => {
          const gap = beside - (plate * k) / 2;
          const s = num.length === 1 ? k : Math.min(k, (room - gap - 0.05) / (num.length * pitch));
          return [...num].map((_, i) => ({ a: gap + (plate * s) / 2 + i * pitch * s, s }));
        };
        // (the w door's middle on z, the n and s doors' on x, as neon-tower.ts cuts them)
        // (in `mat`: the plate black under the lit digit, the fourth review's "high-contrast numerals")
        // (read from outside the core, left to right: beside the w and s doors the first figure is the one by the door,
        // beside the n door the far one)
        if (doorsHere.includes("w")) for (const [i, q] of row(1, DG.beside, cz1 - (dz + dw / 2)).entries()) placeTurned("c-tower", `${DG.piece}${num[i]}.prefab`, cx0 + px - DG.off, dz + pz + dw / 2 + q.a, 0, "g", h + DG.up, DG.mat, q.s === 1 ? undefined : q.s);
        // (beside the north and south doors `big`: `scale` times the pack's digit, its middle `beside` the door's edge,
        // `off` the wall, `up` over the floor)
        const B = DG.big ?? { scale: 1, up: DG.up, beside: DG.beside, off: DG.off };
        const big = row(B.scale, B.beside, cx1 - (dx + dw / 2));
        if (doorsHere.includes("n")) for (const [i, q] of big.entries()) placeTurned("c-tower", `${DG.piece}${num[num.length - 1 - i]}.prefab`, dx + px + dw / 2 + q.a, cz0 + pz - B.off, 90, "g", h + B.up, DG.mat, q.s);
        if (doorsHere.includes("s")) for (const [i, q] of big.entries()) placeTurned("c-tower", `${DG.piece}${num[i]}.prefab`, dx + px + dw / 2 + q.a, cz1 + pz + B.off, 90, "g", h + B.up, DG.mat, q.s);
      }
      // inside the floor: the main body's inner faces, its round corners and the grooves down each face
      const [qx0, qx1, qz0, qz1] = F.inner;
      const inFloor = (x: number, z: number, m: number) => {
        if (x < qx0 + m || x > qx1 - m || z < qz0 + m || z > qz1 - m) return false;
        for (const [gx, gz, r] of F.grooves as number[][]) if (Math.hypot(x - gx, z - gz) < r + m) return false;
        for (const [ox, oz, r] of F.corners as number[][]) if ((x - ox) * Math.sign(ox - (qx0 + qx1) / 2) > 0 && (z - oz) * Math.sign(oz - (qz0 + qz1) / 2) > 0 && Math.hypot(x - ox, z - oz) > r - m) return false;
        return true;
      };
      // The way round the floor (rules.tower.floors.way): on a grid of `cell` metres, every spot of it a body's radius
      // off the faces and their grooves (each partition runs out to a groove, whose facade shuts its end), the core and the
      // partitions, through their doorways and gates, reached from the core's doors; a piece of cover that would leave
      // more of it unreached than a dead corner is not laid. Kept off the walls and the doorways, the cover still walled
      // rooms off: on the bunkers floor two crates in its east room, 5 m across with its one door at an end, left half of
      // it unreached (the walk check's map of the floor)
      const R0 = MOVE.radius;
      const [wn, wm] = [Math.ceil((qx1 - qx0) / FW.cell), Math.ceil((qz1 - qz0) / FW.cell)];
      const wxz = (k: number): Pt => [qx0 + ((k % wn) + 0.5) * FW.cell, qz0 + (Math.floor(k / wn) + 0.5) * FW.cell];
      // (a body's radius off a piece and a collision column more: its boxes are built in columns and stand up to one past
      // its drawn bounds; with only the bounds counted, a vending machine and the wall beside its room's door, the way
      // between them open by the bounds and shut by the columns, walled the bunkers floor's east room off)
      const hits = (q: OBox, x: number, z: number, open = 0, pad = 0) => {
        const [ex, ez] = [x + px - q.c[0], z + pz - q.c[1]];
        const [a, b] = [ex * q.u[0] + ez * q.u[1], ex * q.v[0] + ez * q.v[1]];
        if (Math.hypot(Math.max(Math.abs(a) - q.hu, 0), Math.max(Math.abs(b) - q.hv, 0)) > R0 + pad) return false;
        return !(open > 0 && Math.abs(a) < open / 2 - R0);
      };
      const free = new Uint8Array(wn * wm);
      for (let k = 0; k < free.length; k++) {
        const [x, z] = wxz(k);
        const inCore = x > cx0 - R0 && x < cx1 + R0 && z > cz0 - R0 && z < cz1 + R0;
        free[k] = inFloor(x, z, R0) && !inCore && !bars.some((q) => hits(q.o, x, z, q.open, q.pad)) ? 1 : 0;
      }
      const seeds = ds.map((s) => (s === "w" ? [cx0 - R0 - FW.cell, dz] : s === "n" ? [dx, cz0 - R0 - FW.cell] : [dx, cz1 + R0 + FW.cell])).map(([x, z]) => Math.floor((z - qz0) / FW.cell) * wn + Math.floor((x - qx0) / FW.cell)).filter((k) => free[k]);
      if (!seeds.length) throw new Error(`the tower's ${h} m floor: no way out of the core's doors onto it`);
      // (how much of the floor is unreached with the cells in `shut` taken)
      const lost = (shut: Uint8Array) => {
        const seen = new Uint8Array(free.length);
        const todo = seeds.filter((k) => !shut[k]);
        for (const k of todo) seen[k] = 1;
        let n = todo.length;
        while (todo.length) {
          const k = todo.pop()!;
          const [i, j] = [k % wn, Math.floor(k / wn)];
          for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
            const q = b * wn + a;
            if (a < 0 || a >= wn || b < 0 || b >= wm || seen[q] || !free[q] || shut[q]) continue;
            seen[q] = 1;
            n++;
            todo.push(q);
          }
        }
        let all = 0;
        for (let k = 0; k < free.length; k++) if (free[k] && !shut[k]) all++;
        return all - n;
      };
      let shut = new Uint8Array(free.length);
      let unreached = lost(shut);
      const wayAll = free.reduce((a, v) => a + v, 0);
      wayLog.push(`${h} m ${(wayAll * FW.cell * FW.cell).toFixed(0)} m2${unreached ? ` (${(unreached * FW.cell * FW.cell).toFixed(1)} out of reach before its cover)` : ""}`);
      const names = (P.pieces ?? F.cover) as string[];
      for (let t = 0, got = 0; t < P.cover * 40 && got < P.cover; t++) {
        const name = pick3(names);
        const row = piece(name).row;
        const [lx, lz] = [qx0 + rnd3() * (qx1 - qx0), qz0 + rnd3() * (qz1 - qz0)];
        const yaw = Math.floor(rnd3() * 4) * 90 + (row.size![0] < 1.2 && row.size![2] < 1.2 ? rnd3() * 40 - 20 : 0);
        const o: OBox = { c: [lx + px, lz + pz], u: rotY(yaw, 1, 0), v: rotY(yaw, 0, 1), hu: row.size![0] / 2, hv: row.size![2] / 2, top: 0 };
        const reach = Math.hypot(o.hu, o.hv);
        if (!inFloor(lx, lz, reach + 0.3) || keepT.some((q) => overlaps(o, q, 0.3)) || placed.some((q) => overlaps(o, q, F.apart))) continue;
        const next = shut.slice();
        for (let k = 0; k < free.length; k++) if (free[k] && !next[k] && hits(o, ...wxz(k), 0, FW.column)) next[k] = 1;
        // (a dead corner behind it, `corner` square metres, is let be: refused outright, a crate a body's width off a
        // wall's end cost the maze floors half their cover)
        const u = lost(next);
        if ((u - unreached) * FW.cell * FW.cell > FW.corner) continue;
        [shut, unreached] = [next, u];
        placeTurned("c-tower", name, lx + px, lz + pz, yaw, "o", h - row.min![1]);
        placed.push(o);
        tProps++;
        got++;
      }
      // the pack's ceiling lamp on a grid under the floor over it, none over the core
      const lamp = piece(F.lamp.piece).row;
      for (let lx = qx0 + F.lamp.every / 2; lx < qx1; lx += F.lamp.every)
        for (let lz = qz0 + F.lamp.every / 2; lz < qz1; lz += F.lamp.every) {
          // (the fitting is 3.1 m long and the grid's lines fall on the partitions' (both are on the 2.5 m grid): where it
          // crosses one it is moved a metre and a half aside, along or across, or turned a quarter, and skipped only if
          // nothing fits; on the maze floors every spot crossed one)
          const fits = [0, 1.5, -1.5].flatMap((dx) => [0, 1.5, -1.5].flatMap((dz) => [0, 90].map((yaw) => ({ dx, dz, yaw })))).find(({ dx, dz, yaw }) => {
            const lampBox: OBox = { c: [lx + dx + px, lz + dz + pz], u: rotY(yaw, 1, 0), v: rotY(yaw, 0, 1), hu: lamp.size![0] / 2, hv: lamp.size![2] / 2, top: 0 };
            return inFloor(lx + dx, lz + dz, 0.8) && !overlaps(lampBox, keepT[0], 0.2) && !wallBoxes.some((q) => overlaps(lampBox, q, 0.1));
          });
          if (!fits) continue;
          // (under the floor's own ceiling: the halls at 35 m are a 3.5 m storey, and lamps hung for a 3 m one floated half a
          // metre under theirs; their light in the floor's `lampMat` where it names one, THE VAULT's gold)
          placeTurned("c-tower", F.lamp.piece, lx + fits.dx + px, lz + fits.dz + pz, fits.yaw, "g", ceilingOf(h) - F.lamp.under - lamp.max![1], P.lampMat);
          tLamps++;
        }
    }
    console.log(`the tower's floors: ${tWalls} lengths of wall, ${tProps} pieces of cover, ${tLamps} lamps`);
    console.log(`the tower's floors' way round each, kept whole by the cover: ${wayLog.join("; ")}`);
  }
}

// ---------------------------------------------------------------- the high city: the four axis blocks
// Each block one of High City's islands, its inner face at `face` from the middle, on the Loop's outer pavement
const islands: number[][] = [];
{
  const H = R.high;
  const [a, b] = R.blocks.inner; // the axis blocks' span across (-27.5 to 27.5)
  for (const dir of ["n", "s", "w", "e"] as const) {
    const spec = H[dir];
    const along = dir === "n" || dir === "s";
    const sgn = dir === "n" || dir === "w" ? -1 : 1;
    const mid = sgn * (H.face + spec.depth / 2);
    // (each in its own colour, `looks`: its frames tinted and its neon trims lit in it, the fourth review: "the four High
    // City blocks are the same clover-shaped glass tower copied four times")
    const r = placeAt(`c-${dir}`, "c", spec.piece, along ? (a + b) / 2 : mid, along ? mid : (a + b) / 2, spec.yaw, "s", { bottom: true, mat: spec.looks });
    islands.push([r.x0, r.x1, r.z0, r.z1]);
  }
}

// High City's fire escapes (rules.high.fire; the master plan's item 7: balconies do not fit the round lobes of the south
// and east blocks, 13 m apart, so the pack's exterior stairs go up their flat faces): the corner blocks' flights
// (rules.low.fire's piece, its wall side at its own x 0, 5 m along its -z) stacked from the street to the deck, `flights`
// of them `top` / `flights` apart (the pack stacks them 3 m apart; 26 m in nine puts the lowest stair's foot on the
// pavement, each stair's foot 0.11 m under the next landing, a step), on the outer face where the deck's edge has no
// parapet and nothing stands in the street. Its back on the face's outermost point across its length at every flight's
// height, measured off the last bake, so no flight cuts into the glass
const highFires: Array<{ block: string; at: number[]; yaw: number; roof: number; rise: number; flights: number }> = [];
{
  const HF = R.high.fire as { top: number; flights: number; reach: number } & Record<string, { along: number }> | undefined;
  if (HF) {
    const fp = piece(R.low.fire.piece);
    const boxes = lastSolids();
    const rise = HF.top / HF.flights;
    for (const dir of ["n", "s", "w", "e"] as const) {
      const q = HF[dir];
      if (!q) continue;
      // (outward from the island's outer face; its own +x turned to it, its own z along the face)
      const out: Pt = dir === "n" ? [0, -1] : dir === "s" ? [0, 1] : dir === "w" ? [-1, 0] : [1, 0];
      const yaw = (Math.atan2(-out[1], out[0]) * 180) / Math.PI;
      const alongDir = rotY(yaw, 0, 1);
      const far = R.high.face + R.high[dir].depth + HF.reach;
      // (the face's outermost point: from `reach` past the island's outer side straight in, at each flight's height and
      // every half metre of its length; not the last layout's own flights, which the last bake measured: each box wholly
      // in their band, from their back 2.75 m out, is theirs. Counted, the face came out at their front, 2.55 m out)
      const prev = ((cfg.highFires ?? []) as Array<{ block: string; at: number[] }>).find((f) => f.block === dir);
      const prevN = prev ? (out[0] ? out[0] * prev.at[0] : out[1] * prev.at[1]) : undefined;
      const theirs = (lo: number, hi: number) => prevN !== undefined && lo >= prevN - 0.05 && hi <= prevN + 2.75;
      let face = -Infinity;
      for (let k = 0; k < HF.flights; k++)
        for (let t = -fp.row.size![2]; t <= 1e-6; t += 0.5) {
          const y = HF.top - k * rise + 0.5;
          const ox = out[0] ? out[0] * far : q.along + alongDir[0] * t;
          const oz = out[1] ? out[1] * far : q.along + alongDir[1] * t;
          let best = Infinity;
          for (const [x0, x1, z0, z1, y0, y1] of boxes) {
            const [c, lo, hi] = out[0] ? [oz, z0, z1] : [ox, x0, x1];
            if (y0 > y || y1 < y || c < lo - 1e-6 || c > hi + 1e-6) continue;
            // (its extent along the way out, as the band measures it)
            const [n0, n1] = out[0] ? (out[0] > 0 ? [x0, x1] : [-x1, -x0]) : out[1] > 0 ? [z0, z1] : [-z1, -z0];
            if (theirs(n0, n1)) continue;
            const d = out[0] ? out[0] * ox - (out[0] > 0 ? x1 : -x0) : out[1] * oz - (out[1] > 0 ? z1 : -z0);
            if (d >= 0 && d < best) best = d;
          }
          if (best > HF.reach + R.high[dir].depth) throw new Error(`High City's ${dir} fire escape: no face at ${t} along, ${y.toFixed(1)} m`);
          face = Math.max(face, far - best);
        }
      const at: Pt = out[0] ? [out[0] * face, q.along] : [q.along, out[1] * face];
      for (let k = 0; k < HF.flights; k++) add(`c-${dir}`, "c", [fp.key, +at[0].toFixed(3), +(HF.top - k * rise).toFixed(3), +at[1].toFixed(3), +yaw.toFixed(2), "o"] as Place);
      highFires.push({ block: dir, at: [+at[0].toFixed(3), +at[1].toFixed(3)], yaw: +yaw.toFixed(2), roof: HF.top, rise: +rise.toFixed(4), flights: HF.flights });
    }
    cfg.highFires = highFires;
    console.log(`High City's fire escapes: ${highFires.map((f) => `${f.block} at ${f.at.join(", ")}, ${f.flights} flights`).join("; ")}`);
  }
}

// ---------------------------------------------------------------- the low city: the four corner blocks
// Each corner block lies between two of the curved streets and the edge road. Its rooms building (rules.low.rooms, the
// realistic building with its floors and stairs) toward its outer corner, and along both its streets a row of the low
// buildings (and out toward the edge road the tall ones), each turned to face its street where it stands, so the fronts
// follow the curves.
// A building is kept only clear of every road by the pavement, of the edge road, the islands and the others; under the
// High City bridges (rules.bridges.paths) only one that tops out under them
const rooms: number[][] = [];
const fires: Array<{ block: string; at: number[]; yaw: number; roof: number; rise: number; flights: number }> = [];
const yards: Array<{ block: string; inside: number[]; y: number }> = [];
const walkIns: Array<{ chunk: string; piece: string; at: number[]; yaw: number; door: number[] }> = [];
/** each corner block's light (rules.low.beam): where it rises from */
const beams: Array<{ chunk: string; block: string; x: number; y: number; z: number }> = [];
{
  const L = R.low;
  const placed: OBox[] = [];
  const fireAt: Array<{ chunk: string; block: string; px: number; pz: number; fy: number; beside: OBox }> = [];
  const fireBoxes: OBox[] = [];
  const bridgeLines = (R.bridges.paths as number[][][]).flatMap((p) => p.slice(1).map((q, i) => [p[i], q]));
  const nearBridge = (q: Pt) => bridgeLines.some(([a, b]) => {
    const [ax, az, bx, bz] = [a[0], a[1], b[0], b[1]];
    const l2 = (bx - ax) ** 2 + (bz - az) ** 2;
    const u = Math.max(0, Math.min(1, ((q[0] - ax) * (bx - ax) + (q[1] - az) * (bz - az)) / l2));
    return Math.hypot(q[0] - ax - (bx - ax) * u, q[1] - az - (bz - az) * u) < L.bridgeClear;
  });
  /** a box standing where it may: off every road by the pavement, inside the edge road's, clear of the rest */
  const why = new Map<string, number>();
  const fits = (o: OBox): boolean => {
    const r = rim(o);
    const k = !r.every(([x, z]) => onRoad(x, z) >= CV.pave) ? "road" : !r.every(([x, z]) => Math.max(Math.abs(x), Math.abs(z)) <= L.edge) ? "edge" : islands.some((q) => overlaps(o, boxOf(q), L.gap)) ? "island" : placed.some((q) => overlaps(o, q, L.gap)) ? "placed" : o.top > L.underBridge && r.some(nearBridge) ? "bridge" : "ok";
    why.set(k, (why.get(k) ?? 0) + 1);
    return k === "ok";
  };
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const chunk = `c-${sz < 0 ? "n" : "s"}${sx < 0 ? "w" : "e"}`;
    const rp = piece(L.rooms.piece).row;
    // (the Well's block, rules.well, keeps the rooms building's room while the fronts are placed round it, so the rest
    // stand as they did, and the Well stands there instead)
    const well = R.well && R.well.block === `${sx},${sz}`;
    const [cx, cz, fy] = [sx * L.rooms.at, sz * L.rooms.at, L.rooms.face[`${sx},${sz}`]];
    const [fx0, fx1, fz0, fz1] = turned(rp, fy);
    const rr = well ? { x0: cx - (fx1 - fx0) / 2, x1: cx + (fx1 - fx0) / 2, z0: cz - (fz1 - fz0) / 2, z1: cz + (fz1 - fz0) / 2 } : placeAt(chunk, "c", L.rooms.piece, cx, cz, fy, "o", { snap: L.rooms.snap });
    if (!well) rooms.push([rr.x0, rr.x1, rr.z0, rr.z1].map((v) => +v.toFixed(3)));
    placed.push(boxOf([rr.x0, rr.x1, rr.z0, rr.z1]));
    // its fire escape (rules.low.fire), stood once the block is built (below)
    if (!well && L.fire && "px" in rr) fireAt.push({ chunk, block: `${sx},${sz}`, px: rr.px, pz: rr.pz, fy, beside: placed[placed.length - 1] });
    // and a walled yard on its roof (rules.low.yard): the pack's yard, its walls on the one part of the roof where a 5 m
    // yard's stand wholly on open roof, its own floor left out (the roof is its floor, in the same plane)
    if (!well && L.yard && "px" in rr) {
      const Y = L.yard;
      const yp = piece(Y.piece);
      const [ox, oz] = rotY(fy, Y.at[0], Y.at[1]);
      add(chunk, "c", [yp.key, +(rr.px + ox).toFixed(3), Y.y, +(rr.pz + oz).toFixed(3), fy + Y.at[2], "o", null, Y.without] as Place);
      // (its inside, for tools/checks/sk-neon.ts to reach from the fire escape)
      const corners = [[-4.5, -4.5], [-0.5, 0]].map(([x, z]) => rotY(fy + Y.at[2], x, z)).map(([x, z]) => [rr.px + ox + x, rr.pz + oz + z]);
      yards.push({ block: `${sx},${sz}`, inside: [Math.min(corners[0][0], corners[1][0]), Math.max(corners[0][0], corners[1][0]), Math.min(corners[0][1], corners[1][1]), Math.max(corners[0][1], corners[1][1])].map((v) => +v.toFixed(3)), y: Y.y });
      beams.push({ chunk, block: `${sx},${sz}`, x: (corners[0][0] + corners[1][0]) / 2, y: Y.y, z: (corners[0][1] + corners[1][1]) / 2 });
    }
    if (rp.size![1] > L.underBridge) throw new Error(`${L.rooms.piece} is ${rp.size![1]} m tall, over the bridges`);
    // the wedge where the block's two streets leave their fork: one building out along the bisector, facing the
    // junction on the diagonal (a flatiron's corner), as near the fork as it clears both streets' pavements
    const fork = [sx * CV.loop.r * Math.SQRT1_2, sz * CV.loop.r * Math.SQRT1_2];
    const b: Pt = [sx * Math.SQRT1_2, sz * Math.SQRT1_2];
    const yaw = yawToward(-b[0], -b[1]);
    let wedge = "";
    for (let dist = L.wedge.from; dist <= L.wedge.to && !wedge; dist += 0.5)
      for (const name of [...L.low].sort(() => rnd() - 0.5)) {
        const row = piece(name).row;
        const c: Pt = [fork[0] + b[0] * (dist + row.size![2] / 2), fork[1] + b[1] * (dist + row.size![2] / 2)];
        const o: OBox = { c, u: rotY(yaw, 1, 0), v: rotY(yaw, 0, 1), hu: row.size![0] / 2, hv: row.size![2] / 2, top: row.max![1] };
        if (!fits(o)) continue;
        placed.push(placeTurned(chunk, name, c[0], c[1], yaw, "s"));
        wedge = name;
        break;
      }
    if (!wedge) throw new Error(`no building fits the ${chunk} wedge`);
  }
  // the fronts along the streets: each street's corner side, from its fork out to the edge road
  let fronts = 0;
  for (const st of STREETS.filter((q) => !q.closed)) {
    // (where the next front may begin, metres along the street: each building's middle half its width on from there)
    let freeAt = L.front.from;
    const length = (st.pts.length - 1) * 0.5;
    while (freeAt < length) {
      let done = false;
      const probe = st.pts[Math.min(st.pts.length - 1, Math.round(freeAt / 0.5))];
      // (the tall ones too, out toward the edge road, for the skyline)
      const pool = Math.max(Math.abs(probe[0]), Math.abs(probe[1])) > L.front.tallPast ? [...L.low, ...L.tall] : L.low;
      for (const name of [...pool].sort(() => rnd() - 0.5)) {
        const row = piece(name).row;
        const [w, d] = [row.size![0], row.size![2]];
        const i = Math.round((freeAt + w / 2) / 0.5);
        if (i >= st.pts.length) continue;
        const [x, z] = st.pts[i];
        const n = normalAt(st, i);
        // (the corner block's side: the one away from the axis the street runs beside)
        const side = Math.abs(x) > Math.abs(z) ? Math.sign(n[1] * Math.sign(z)) : Math.sign(n[0] * Math.sign(x));
        const out: Pt = [n[0] * side, n[1] * side];
        const chunk = `c-${z < 0 ? "n" : "s"}${x < 0 ? "w" : "e"}`;
        // its own +z, its front, toward the street; set back as little as its ends clear the kerb (a bend's inside
        // comes nearer at a straight front's ends than at its middle)
        // (and failing that squared to the grid, as the edge road is: out at a street's end the curve's tilt put a
        // building's corner over the edge road's pavement)
        const turned = yawToward(-out[0], -out[1]);
        for (const yaw of [turned, Math.round(turned / 90) * 90])
        for (let extra = 0; extra <= L.front.slide && !done; extra += 0.5) {
          const back = st.half + CV.pave + L.front.setback + extra + d / 2;
          const c: Pt = [x + out[0] * back, z + out[1] * back];
          const o: OBox = { c, u: rotY(yaw, 1, 0), v: rotY(yaw, 0, 1), hu: w / 2, hv: d / 2, top: row.max![1] };
          if (!fits(o)) continue;
          placed.push(placeTurned(chunk, name, c[0], c[1], yaw, "s"));
          fronts++;
          freeAt += w + L.front.gap[0] + rnd() * (L.front.gap[1] - L.front.gap[0]);
          done = true;
        }
        if (done) break;
      }
      if (!done) freeAt += 1;
    }
  }
  // each rooms building's fire escape (rules.low.fire): the pack's flights stacked as the pack's own street scenes stack
  // them, up a stretch of its walls clear from over the street to over its parapet, the top landing level with its roof
  // (the roof was a climb no one could make). The first of its measured spots (`at`) whose room no building of the
  // block stands in: chosen once the block is built, not kept from the others as they were placed, where it turned a
  // building away and every seeded choice after it (cars, signs) came out different
  for (const { chunk, block, px, pz, fy, beside } of fireAt) {
    const F = L.fire!;
    const fp = piece(F.piece);
    const at = (x: number, z: number): Pt => {
      const [ox, oz] = rotY(fy, x, z);
      return [px + ox, pz + oz];
    };
    const spot = (F.at as number[][]).find(([ax, az, turn]) => {
      const [fx0, fx1, fz0, fz1] = turned(fp.row, turn);
      const box: OBox = { c: at(ax + (fx0 + fx1) / 2, az + (fz0 + fz1) / 2), u: rotY(fy, 1, 0), v: rotY(fy, 0, 1), hu: (fx1 - fx0) / 2, hv: (fz1 - fz0) / 2, top: F.roof + fp.row.max![1] };
      return !placed.some((q) => q !== beside && overlaps(box, q, 0));
    });
    if (!spot) throw new Error(`no room for the ${chunk} rooms building's fire escape at any of rules.low.fire.at`);
    {
      const [fx0, fx1, fz0, fz1] = turned(fp.row, spot[2]);
      fireBoxes.push({ c: at(spot[0] + (fx0 + fx1) / 2, spot[1] + (fz0 + fz1) / 2), u: rotY(fy, 1, 0), v: rotY(fy, 0, 1), hu: (fx1 - fx0) / 2, hv: (fz1 - fz0) / 2, top: F.roof + fp.row.max![1] });
    }
    const [wx, wz] = at(spot[0], spot[1]);
    for (let k = 0; k < F.flights; k++) add(chunk, "c", [fp.key, +wx.toFixed(3), F.roof - k * F.rise, +wz.toFixed(3), fy + spot[2], "o"] as Place);
    fires.push({ block, at: [+wx.toFixed(3), +wz.toFixed(3)], yaw: fy + spot[2], roof: F.roof, rise: F.rise, flights: F.flights });
    console.log(`the ${chunk} rooms building's fire escape at its spot ${F.at.indexOf(spot) + 1} of ${F.at.length}`);
  }
  // The walk-in buildings (rules.low.walkIn, the master plan's shop fronts along the curves): each of the street fronts'
  // `swap` shells (a shell, solid to its top) swapped, once the block is built, for one of the pack's realistic
  // buildings, `pieces` in turn, with rooms, stairs and floors inside: on the shell's front line and middle, its door
  // side (`face` degrees from its own +z) to the street, its collision its own triangles. The shell's footprint holds
  // it whole, so nothing else moves; mixed into the fronts' pool instead, none fitted along a curve and every seeded
  // choice after it came out different
  const WI = L.walkIn as { swap: string; pieces: string[]; face: number } | undefined;
  if (WI) {
    let n = 0;
    for (const [chunk, ch] of chunks) {
      if (!/^c-[ns][ew]$/.test(chunk)) continue;
      ch.place.forEach((p, i) => {
        if (!p[0].endsWith(`/${WI.swap}`)) return;
        const sh = piece(WI.swap).row;
        const name = WI.pieces[n++ % WI.pieces.length];
        const wr = piece(name);
        const t = p[4];
        // the shell's front's middle on the map, and the way to the street
        const [fx, fz] = rotY(t, (sh.min![0] + sh.max![0]) / 2, sh.max![2]);
        const out = rotY(t, 0, 1);
        const yaw = t + WI.face;
        const [w0, w1] = [wr.row.min!, wr.row.max!];
        // (its depth from the street: its own extent along the side turned to it)
        const depth = Math.abs(WI.face) === 90 ? w1[0] - w0[0] : w1[2] - w0[2];
        const c: Pt = [p[1] + fx - out[0] * (depth / 2), p[3] + fz - out[1] * (depth / 2)];
        const [mx, mz] = rotY(yaw, (w0[0] + w1[0]) / 2, (w0[2] + w1[2]) / 2);
        ch.place[i] = [wr.key, +(c[0] - mx).toFixed(3), 0, +(c[1] - mz).toFixed(3), +yaw.toFixed(2), "o"] as Place;
        walkIns.push({ chunk, piece: name, at: [+c[0].toFixed(3), +c[1].toFixed(3)], yaw: +yaw.toFixed(2), door: [+(p[1] + fx + out[0] * 2).toFixed(3), +(p[3] + fz + out[1] * 2).toFixed(3)] });
      });
    }
    console.log(`walk-in buildings: ${walkIns.length} for the ${WI.swap} shells`);
  }
  // Each corner block's own things (the master plan's), a set at a time, each set placed after the last so it keeps
  // off it: NOODLE ROW's street food stalls (rules.low.stalls) and MARKET's (rules.low.market). Each on the block's own
  // ground where a building may stand (off every road by the pavement, inside the edge road, clear of the buildings,
  // the islands and the fire escape's room by the gap, out past the Loop's pavement and the High City islands), `near`
  // the street (its distance beyond the pavement, in metres), the nearest first, `apart` metres from each other, its
  // footprint grown by `grow` for what stands round it; turned so its own side `face` (degrees from its own +z) is to
  // its nearest road (down the road distance's slope), and its `extras` (pieces at x, y, z in its own metres) with it.
  // The pavement is 2.5 m, so none stands on it
  type DressSet = { name: string; block: string; pieces: string[]; count: number; apart: number; near: number[]; face: number; grow?: number; extras: Array<{ piece: string; at: number[]; mode: "g" | "s" | "o" }>; save?: string };
  const SL = L.stalls as { block: string; pieces: string[]; count: number; apart: number; lantern: string; lanterns: number[][] } | undefined;
  const sets: DressSet[] = [
    // (a stall's counter is its own +x, measured by photographing it from all four sides: its z faces are panels)
    ...(SL ? [{ name: "NOODLE ROW", block: SL.block, pieces: SL.pieces, count: SL.count, apart: SL.apart, near: [1, 6], face: 90, extras: SL.lanterns.map((at) => ({ piece: SL.lantern, at, mode: "g" as const })), save: "stalls" }] : []),
    ...((L.market as DressSet[] | undefined) ?? []),
  ];
  const saved: Record<string, Array<{ at: number[]; yaw: number; piece: string }>> = {};
  for (const D of sets) {
    const [bx, bz] = D.block.split(",").map(Number);
    const chunk = `c-${bz < 0 ? "n" : "s"}${bx < 0 ? "w" : "e"}`;
    const row0 = piece(D.pieces[0]).row;
    const cands: Array<{ c: Pt; yaw: number; d: number }> = [];
    for (let x = 8; x <= L.edge; x += 1)
      for (let z = 8; z <= L.edge; z += 1) {
        const [cx, cz] = [bx * x, bz * z];
        // (the block's own ground: out past the Loop's pavement, and past the High City islands either side of the axes)
        if (Math.hypot(cx, cz) < CV.loop.r + CV.road / 2 + CV.pave + 1 || Math.min(x, z) < R.blocks.inner[1]) continue;
        const d = onRoad(cx, cz);
        if (d < CV.pave + D.near[0] || d > CV.pave + D.near[1]) continue;
        const gx = onRoad(cx + 0.5, cz) - onRoad(cx - 0.5, cz), gz = onRoad(cx, cz + 0.5) - onRoad(cx, cz - 0.5);
        const yaw = yawToward(-gx, -gz) - D.face;
        const o: OBox = { c: [cx, cz], u: rotY(yaw, 1, 0), v: rotY(yaw, 0, 1), hu: row0.size![0] / 2 + (D.grow ?? 0), hv: row0.size![2] / 2 + (D.grow ?? 0), top: row0.max![1] };
        if (!fits(o) || fireBoxes.some((q) => overlaps(o, q, L.gap))) continue;
        cands.push({ c: [cx, cz], yaw, d });
      }
    cands.sort((a, b) => a.d - b.d);
    const chosen: typeof cands = [];
    for (const q of cands) if (chosen.length < D.count && chosen.every((r) => Math.hypot(r.c[0] - q.c[0], r.c[1] - q.c[1]) >= D.apart)) chosen.push(q);
    if (chosen.length < D.count) throw new Error(`room for only ${chosen.length} of ${D.name}'s ${D.count} ${D.pieces[0]}`);
    chosen.forEach((q, i) => {
      const name = D.pieces[i % D.pieces.length];
      const { row } = piece(name);
      const box = placeTurned(chunk, name, q.c[0], q.c[1], q.yaw, "o");
      placed.push({ ...box, hu: box.hu + (D.grow ?? 0), hv: box.hv + (D.grow ?? 0) });
      // (its pivot, as placeTurned puts it, for its extras in its own metres)
      const [ox, oz] = rotY(q.yaw, (row.min![0] + row.max![0]) / 2, (row.min![2] + row.max![2]) / 2);
      const [px, pz] = [q.c[0] - ox, q.c[1] - oz];
      for (const e of D.extras) {
        const [wx, wz] = rotY(q.yaw, e.at[0], e.at[2]);
        add(chunk, "c", [piece(e.piece).key, +(px + wx).toFixed(3), e.at[1], +(pz + wz).toFixed(3), +q.yaw.toFixed(2), e.mode] as Place);
      }
      if (D.save) (saved[D.save] ??= []).push({ at: [+q.c[0].toFixed(3), +q.c[1].toFixed(3)], yaw: +q.yaw.toFixed(2), piece: name });
    });
    console.log(`${D.name}: ${chosen.length} ${D.pieces[0]}, of ${cands.length} spots`);
  }
  for (const [k, v] of Object.entries(saved)) cfg[k] = v;
  cfg.rooms = rooms;
  // (each fire escape where it stands, for tools/checks/sk-neon.ts to climb)
  cfg.fires = fires;
  cfg.walkIns = walkIns;
  cfg.yards = yards;
  console.log(`corner blocks: ${fronts} buildings along the curves and a building in each wedge (${JSON.stringify(Object.fromEntries(why))} tried)`);
}

// the respawn beacons (game.beacons): one a side of the centre, half way along a street out of it
cfg.game.beacons = (R.streets.beacons as string[]).map((id) => {
  const st = STREETS.find((q) => q.id === id)!;
  const p = st.pts[Math.floor(st.pts.length / 2)];
  return [+p[0].toFixed(2), +p[1].toFixed(2)];
});

// the ground itself, less the building footprints that keep their own floor
/** the tiles left out, a footprint's: the hole in the ground its basement stands in */
const holes: Array<[number, number, number, number]> = [];
for (let x = -R.extent; x < R.extent; x += T)
  for (let z = -R.extent; z < R.extent; z += T) {
    const cx = x + T / 2;
    const cz = z + T / 2;
    if (noGround.some(([x0, x1, z0, z1]) => x >= x0 - 1e-6 && x + T <= x1 + 1e-6 && z >= z0 - 1e-6 && z + T <= z1 + 1e-6)) {
      holes.push([x, x + T, z, z + T]);
      continue;
    }
    const sector = sectorAt(cx, cz);
    const chunk = sector === "c" ? "c-ground" : `ground-${sector}`;
    // (the base is 10 m square from its pivot toward -z: placed by its middle)
    placeAt(chunk, sector, R.ground.tile, cx, cz, 0, "g", road(cx, cz) ? { mat: R.ground.road } : {});
  }
// The court's wall is one-sided, its face toward `faces` in its own frame (measured off its triangles): turned so the face
// looks back into the court or the hall. Turned 90 degrees at a time, its +x goes to -z, -x, +z (tools/import-neon.ts place)
const turns = ["+x", "-z", "-x", "+z"];
const yawFacing = (dir: string) => ((turns.indexOf(dir) - turns.indexOf(R.court.faces) + 4) % 4) * 90;
/** the ground's 10 m tiles over a rectangle (map-local) taken up and laid again in the pack's smaller tile of the same
 * material, but for the rectangle itself: an opening in the street (the tiles are mapped by the metre, 0.1 of their
 * texture a metre whatever their size, so the small ones join the big ones seamlessly) */
const openGround = (ox0: number, ox1: number, oz0: number, oz1: number): void => {
  const g = chunks.get("c-ground")!;
  const big = piece(R.ground.tile);
  const small = piece(R.court.entrance.patch);
  const st = small.row.size![0];
  const keep: Place[] = [];
  const laid: Place[] = [];
  for (const q of g.place) {
    const [key, px, , pz] = q;
    // (a tile's pivot is its corner at the least x and the most z, the big ones' and the small ones' alike)
    const [tx0, tx1, tz0, tz1] = [px, px + T, pz - T, pz];
    if (key !== big.key || tx1 <= ox0 || tx0 >= ox1 || tz1 <= oz0 || tz0 >= oz1) {
      keep.push(q);
      continue;
    }
    const mat = q[6] ?? big.row.materials![0];
    for (let x = tx0; x < tx1 - 1e-6; x += st)
      for (let z = tz0; z < tz1 - 1e-6; z += st) {
        if (x >= ox0 - 1e-6 && x + st <= ox1 + 1e-6 && z >= oz0 - 1e-6 && z + st <= oz1 + 1e-6) continue;
        laid.push([small.key, +x.toFixed(3), 0, +(z + st).toFixed(3), 0, "g", mat]);
      }
  }
  g.place = [...keep, ...laid];
};

/** the side rooms of the court's halls (a shop corridor's shop), map-local [x0, x1, z0, z1] on the court's floor */
const hallRooms: number[][] = [];

// the court the tallest building stands in: the hole its footprint leaves in the ground floored at its foot (its basement,
// 7 m down) with the same tiles, a hair under the basement's own floor so its floor draws where it has one, and walled
// round with the pack's concrete city walls, as tall as the hole is deep (rules.court). Without it the hole showed the
// sky through the world, and the game's floor, the street's, held a body up over it on nothing
if (holes.length) {
  const C = R.court;
  const [x0, x1, z0, z1] = [Math.min(...holes.map((h) => h[0])), Math.max(...holes.map((h) => h[1])), Math.min(...holes.map((h) => h[2])), Math.max(...holes.map((h) => h[3]))];
  const foot = cfg.tallest.foot;
  for (const [hx0, , hz0] of holes) placeAt("c-court", "c", R.ground.tile, hx0 + T / 2, hz0 + T / 2, 0, "g", { y: foot - C.under });
  const wall = piece(C.wall).row;
  const len = wall.size![2];
  const thick = wall.size![0];
  if (Math.abs(wall.size![1] + foot) > 0.05) throw new Error(`the court's wall is ${wall.size![1]} m, the hole ${-foot} m deep`);
  // (the way down to the station, rules.underground.link, leaves the court as a hall does: by a door, along one of the
  // pack's corridors on the court's floor; its far end is open, onto the ramp)
  const L0 = R.underground?.link;
  const hallList = [...C.halls, ...(L0 ? [{ ...L0.door, pieces: [L0.passage], open: true }] : [])] as Array<{ side: "n" | "s" | "w" | "e"; at: number; pieces: string[]; entrance?: boolean; open?: boolean }>;
  /** a side's wall segment from `a` left out: a hall's door */
  const door = (side: string, a: number) => hallList.some((h) => h.side === side && Math.abs(h.at - a) < 1e-6);
  // along x at z0 and z1, along z at x0 and x1, each wall just outside the hole, its face on the hole's edge
  for (let x = x0; x < x1 - 1e-6; x += len) {
    if (!door("n", x)) placeAt("c-court", "c", C.wall, x + len / 2, z0 - thick / 2, yawFacing("+z"), "o", { y: foot });
    if (!door("s", x)) placeAt("c-court", "c", C.wall, x + len / 2, z1 + thick / 2, yawFacing("-z"), "o", { y: foot });
  }
  for (let z = z0; z < z1 - 1e-6; z += len) {
    if (!door("w", z)) placeAt("c-court", "c", C.wall, x0 - thick / 2, z + len / 2, yawFacing("+x"), "o", { y: foot });
    if (!door("e", z)) placeAt("c-court", "c", C.wall, x1 + thick / 2, z + len / 2, yawFacing("-x"), "o", { y: foot });
  }
  // A post in each corner (rules.court.post). The wall is a raised panel whose face steps back its whole thickness at
  // both ends (read off its mesh), so where two meet at a corner there was a slot as tall as the court, the haze and
  // the sky through it. The pack's half-metre room wall stood on end outside the corner fills it, in rows to the
  // street, the last lapping the one under it a hair further out, its top a hair under the plaza's tiles
  {
    const P = C.post;
    const post = piece(P.piece).row;
    const [pw, ph] = [post.size![0], post.size![1]];
    // (the piece runs back 0.5 m along x and z from its pivot: each corner's pivot puts it just outside the hole)
    for (const [px, pz, ox, oz] of [[x0, z0, -1, -1], [x1 + pw, z0, 1, -1], [x0, z1 + pw, -1, 1], [x1 + pw, z1 + pw, 1, 1]]) {
      let y = foot;
      for (; y + ph <= -P.under + 1e-6; y += ph) add("c-court", "c", [piece(P.piece).key, px, +y.toFixed(3), pz, 0, "o"] as Place);
      if (y < -P.under - 1e-6) add("c-court", "c", [piece(P.piece).key, +(px + ox * P.hair).toFixed(3), +(-P.under - ph).toFixed(3), +(pz + oz * P.hair).toFixed(3), 0, "o"] as Place);
    }
  }
  // The halls: the pack's metro corridors off the court through its doors, out under the plaza on the court's floor,
  // floored with the pack's tiles and closed at their far end with the court's wall (a corridor is open at both ends and
  // has no floor of its own). Each one's rectangle, for the game to lower its floor in and lay the street's slab over
  const halls: Array<{ x0: number; x1: number; z0: number; z1: number; slab: number[]; route?: number[][]; open?: boolean }> = [];
  /** the turn that points a piece's own -z (an entrance's landing) the way given */
  const yawLanding = (dir: string) => ({ "-z": 0, "-x": 90, "+z": 180, "+x": 270 })[dir]!;
  for (const h of hallList) {
    const alongX = h.side === "w" || h.side === "e";
    const out = h.side === "n" || h.side === "w" ? -1 : 1;
    const start = { n: z0, s: z1, w: x0, e: x1 }[h.side];
    const across = h.at + len / 2;
    /** a spot `d` metres out from the court's edge on the hall's middle line */
    const spot = (d: number): [number, number] => (alongX ? [start + out * d, across] : [across, start + out * d]);
    // Each piece by its pivot: the pack's corridors all run along their own z from their pivot back, their corridor
    // across their own x from 0 to the door's width; a shop corridor's side room stands out beyond that (its own x under
    // 0, or over the width), a room off the hall with its floor lowered and the street's slab over it too
    let d = 0;
    for (const name of h.pieces) {
      const row = piece(name).row;
      if (row.min![0] > 0.05 || row.max![0] < len - 0.05) throw new Error(`hall piece ${name} runs ${row.min![0]} to ${row.max![0]} across, not its corridor 0 to ${len} m`);
      // (to the half metre the pack builds on: the market's runs 10.05, and its last 5 cm under the end wall laid a floor
      // tile beyond the hall)
      const run = Math.round(-row.min![2] * 2) / 2;
      const [a, b] = [start + out * d, start + out * (d + run)].sort((p, q) => p - q);
      // (it runs from its pivot back along its own z: the pivot at the hall's far end on the map's axis, whichever way
      // the hall goes; turned a quarter, its own x runs back along the map's z from it: x' = z, z' = -x)
      const [px, pz] = alongX ? [b, h.at + len] : [h.at, b];
      add("c-court", "c", [piece(name).key, +px.toFixed(3), foot, +pz.toFixed(3), alongX ? 90 : 0, "o"] as Place);
      for (const [lo, hi] of [[row.min![0], 0], [len, row.max![0]]]) {
        if (hi - lo < 0.5) continue;
        const [c0, c1] = alongX ? [pz - hi, pz - lo] : [px + lo, px + hi];
        hallRooms.push((alongX ? [a, b, c0, c1] : [c0, c1, a, b]).map((v) => +v.toFixed(3)));
      }
      d += run;
    }
    const back = (out > 0 ? "-" : "+") + (alongX ? "x" : "z");
    /** the rectangle from `d0` to `d1` out along the hall, map-local [x0, x1, z0, z1] */
    const rect = (d0: number, d1: number): number[] => {
      const [a, b] = [start + out * d0, start + out * d1].sort((p, q) => p - q);
      return alongX ? [a, b, h.at, h.at + len] : [h.at, h.at + len, a, b];
    };
    // The street's entrance at its far end (rules.court.entrance): the pack's metro kiosk, its landing toward the court
    // over the hall's corridor, which is its bottom's walls and roof, and its two flights down from the street in a well
    // walled with the court's wall; the street opened over the well (and only there: the kiosk stands on the rest)
    const E = C.entrance;
    const kiosk = h.entrance ? piece(E.piece).row : null;
    const slabTo = d;
    let route: number[][] | undefined;
    if (kiosk) {
      if (Math.abs(d - (0 - kiosk.min![2])) > 0.05) throw new Error(`hall ${h.side}: its corridor is ${d} m, the entrance's landing ${-kiosk.min![2]} m`);
      const k = placeAt("c-court", "c", E.piece, ...spot(kiosk.size![2] / 2), yawLanding(back), "o", { without: E.without });
      // its way through for a body, in the kiosk's own metres (rules.court.entrance.route), onto the map: turned as the
      // bake turns it (x' = c x + s z, z' = -s x + c z) and moved to its pivot
      const a = (yawLanding(back) * Math.PI) / 180;
      const [c, s] = [Math.cos(a), Math.sin(a)];
      route = (E.route as number[][]).map(([lx, lz, y]) => [+(k.px + c * lx + s * lz).toFixed(2), +(k.pz - s * lx + c * lz).toFixed(2), y]);
      const [w0, w1] = [d + E.well[0], d + E.well[1]];
      const sides: Array<[number, string]> = [
        [h.at - thick / 2, "+" + (alongX ? "z" : "x")],
        [h.at + len + thick / 2, "-" + (alongX ? "z" : "x")],
      ];
      for (let a = w0; a < w1 - 1e-6; a += len)
        for (const [c, face] of sides) {
          const along = start + out * (a + len / 2);
          placeAt("c-court", "c", C.wall, alongX ? along : c, alongX ? c : along, yawFacing(face), "o", { y: foot });
        }
      d = w1;
      openGround(...(rect(slabTo, w1) as [number, number, number, number]));
    }
    const tile = piece(C.hallTile).row.size![0];
    for (let t = 0; t < d - 1e-6; t += tile) placeAt("c-court", "c", C.hallTile, ...spot(t + tile / 2), 0, "g", { y: foot - C.under });
    // (its end wall looks back down the hall, toward the court; none where it goes on, down to the station)
    if (!h.open) placeAt("c-court", "c", C.wall, ...spot(d + thick / 2), yawFacing(back), "o", { y: foot });
    const [hx0, hx1, hz0, hz1] = rect(0, h.open ? d : d + thick);
    halls.push({ x0: hx0, x1: hx1, z0: hz0, z1: hz1, slab: rect(0, slabTo), ...(route ? { route } : {}), ...(h.open ? { open: true } : {}) });
  }
  cfg.court = { x0, x1, z0, z1, y: foot, halls };
}

// ---------------------------------------------------------------- the underground: Centre Station (rules.underground)
// The pack's metro station under the south street, put together as the pack's own demo scene (NeonUnderground00) puts
// its -10 m station: platform modules in a row along the street, the tunnel portal at the west end and the buffer stop
// at the east, the tunnel running on west, the train standing at the platform, and the glass-roofed hall on the plaza
// behind it, its arcade at the street and its stairs down to a marble room at the platform's level, facing the
// platform's open back (the arches in every platform module's back wall). Each piece where the demo has it from the
// station's pivot (the platform's back at its floor), measured off the scene (tools/.scratch/scenepieces.ts)
{
  const U = R.underground;
  const S = U.station;
  /** a piece by its pivot, not its footprint's middle: these pieces fit each other by their pivots, as in the scene */
  const pivot = (chunk: string, name: string, x: number, y: number, z: number, yaw: number, without?: string[]): void => {
    add(chunk, "c", [piece(name).key, +x.toFixed(3), +y.toFixed(3), +z.toFixed(3), yaw, "o", ...(without ? [null, without] : [])] as Place);
  };
  const [sx, sy, sz] = [S.x, S.platform, S.back];
  const mid = piece(S.pieces.mid).row;
  const len = mid.size![0];
  // the tunnel portal's end, then the platform's modules, then the buffer stop's end
  pivot("c-station", S.pieces.mouth, sx, sy, sz, 0);
  for (let k = 0; k < S.modules; k++) pivot("c-station", S.pieces.mid, sx + S.mouthLength + len * k, sy, sz, 0);
  const east = sx + S.mouthLength + len * S.modules;
  pivot("c-station", S.pieces.end, east, sy, sz, 0);
  // the train at the platform, its front end into the buffer stop's module as the demo's is (its rails 8 m out from the
  // platform's back, its wheels a metre under the platform's floor)
  pivot("c-station", S.train.piece, east + S.train.front, sy + S.train.down, sz + S.train.out, 0);
  // the brick tunnel on west from the mouth, its rails in line with the station's (theirs 3 m from its edge, the station's
  // 8 m from its back: `firstAt`), to its end, closed there with the court's wall
  const T = S.tunnel;
  let tx = sx + T.firstAt[0];
  pivot("c-station", T.first, tx, sy, sz + T.firstAt[1], 0);
  const seg = piece(T.segment).row.size![0];
  while (tx - seg > T.to + 1e-6) {
    tx -= seg;
    pivot("c-station", T.segment, tx, sy, sz + T.firstAt[1], 0);
  }
  const tunnelEnd = tx - seg;
  const tRow = piece(T.segment).row;
  const [tz0, tz1] = [sz + T.firstAt[1] + tRow.min![2], sz + T.firstAt[1] + tRow.max![2]];
  // (the court's wall is 7 m, the tunnel 9: a second row over the first, its top at the tunnel's)
  const endWall = piece(R.court.wall).row;
  const [wallLen, wallThick, wallTall] = [endWall.size![2], endWall.size![0], endWall.size![1]];
  for (const wy of [sy + tRow.min![1], sy + tRow.max![1] - wallTall])
    for (let z = tz0; z < tz1 - 1e-6; z += wallLen) placeAt("c-station", "c", R.court.wall, tunnelEnd - wallThick / 2, z + wallLen / 2, yawFacing("+x"), "o", { y: wy });
  // the glass-roofed hall on the plaza behind the platform, its marble room at the platform's floor
  const H = U.hall;
  const hallRow = piece(H.piece).row;
  const [hx, hz] = [sx + H.at[0], sz + H.at[1]];
  pivot("c-station", H.piece, hx, 0, hz, 0);
  const hallRect: [number, number, number, number] = [hx + hallRow.min![0], hx + hallRow.max![0], hz + hallRow.min![2], hz + hallRow.max![2]];
  openGround(...hallRect);
  // The concourse on east of it behind the platform, so every arch in the platform's back opens onto a room: the pack's
  // marble hall modules on the hall's line to `to`. Its north side and the marble room's are arches the demo opens onto
  // corridors: here, where there are none, each is closed with the pack's hall cap, the plain one (the others' doorways
  // look out on nothing, the sky and the city through the ground), as are the two ends and the platform's west end
  const Q = U.concourse;
  const qRow = piece(Q.piece).row;
  const qLen = qRow.size![0];
  let qx = hallRect[1];
  while (qx + qLen <= sx + Q.to + 1e-6) {
    pivot("c-station", Q.piece, qx + qLen, sy, hz, 0);
    qx += qLen;
  }
  const capRow = piece(Q.cap).row;
  const capLen = capRow.size![0];
  // (a cap turned 180 degrees covers x from its pivot to 5 m on, z from its pivot to 1 m on: the north side's outside).
  // Laid on the court's own 5 m lines, where the marble room's arches are (its first pair 5.5 to 9.5 m, measured off the
  // hall's parts), so the way down from the court (rules.underground.link) comes in through one bay: there the cap is
  // the pack's open one, its framed gate, and no machine stands in front of it
  const L = U.link;
  const bay = L ? [L.door.at, L.door.at + capLen] : null;
  for (let x = Math.floor(hallRect[0] / capLen) * capLen; x < qx - 1e-6; x += capLen) {
    const cx = Math.min(x, qx - capLen);
    pivot("c-station", bay && Math.abs(cx - bay[0]) < 1e-6 ? L.gate : Q.cap, cx, sy, hz + Q.capAt, 180);
  }
  // (turned -90: x from its pivot to 1 m on, z 5 m up to its pivot; turned 90: x 1 m up to its pivot, z 5 m on)
  // (the east end's second cap the pack's gate when the Well's corridor leaves by it, rules.well.corridor: the first
  // then moved down a cap's width, the two overlapped by 2 m and the plain one stood across the gate)
  const wellGate = R.well?.corridor ? R.well.corridor.gate : null;
  for (const z of [hallRect[2] + capLen, hallRect[3]]) {
    const gate = wellGate && z === hallRect[3];
    pivot("c-station", gate ? wellGate : Q.cap, qx, sy, wellGate && z !== hallRect[3] ? hallRect[3] - capLen : z, -90);
    pivot("c-station", Q.cap, hallRect[0], sy, z - capLen, 90);
  }
  pivot("c-station", Q.cap, sx + piece(S.pieces.mouth).row.min![0], sy, sz, 90);
  // its ceiling: the pack's floor slabs laid over it, their plaster underside down (the marble modules are open to the
  // sky: in the demo they stand under the floors round them)
  const ceil = piece(Q.ceiling).row;
  for (let x = hallRect[1]; x < qx - 1e-6; x += ceil.size![0]) pivot("c-station", Q.ceiling, x + ceil.max![0] - ceil.min![0], sy + qRow.max![1] + (ceil.max![1] - ceil.min![1]), hallRect[2] - ceil.min![2], 0);
  const concourseRect = [hallRect[1], qx + capRow.size![2], hz + Q.capAt, hallRect[3]];
  // its north wall lined with the pack's ticket and vending machines, as the demo's concourses are, their backs to the
  // wall and their fronts to the platform (turned -90 degrees their own +x, their front, faces +z)
  const M = Q.machines;
  for (let x = hallRect[0] + M.from; x < qx - M.from; x += M.every) {
    const name = M.pieces[Math.floor(rnd() * M.pieces.length)];
    if (bay && x > bay[0] - M.clear && x < bay[1] + M.clear) continue;
    const row = piece(name).row;
    pivot("c-station", name, x, sy, hallRect[2] - row.min![0], -90);
  }
  // The way down from the court (rules.underground.link). From the open end of its corridor on the court's floor the
  // pack's terrain ramp, which climbs exactly what the court's floor stands over the station's (3 m in 5, its corners
  // read off its mesh: the pack's stairs and escalators all climb 3.5), down to the gate in the station's north side.
  // Its room is walled in the pack's plain room wall, 3 m a row from the station's floor to the street, its plaster
  // side in, and roofed with the pack's floor slab a hair under the plaza. Each of these was seen leaking first:
  // - the court's own wall is a raised panel, its face stepping back 0.32 m at both ends (read off its mesh), and two
  //   of them at a right angle left a 0.45 m opening at the corner, the sky through it: the room wall is a plain box;
  // - the rows do not come out even at the street (3 m rows, a room 7 to 10 m high), so the top row laps the one under
  //   it, a hair in front so the two are never drawn in one plane (behind, it left a slit along the roof);
  // - the corridor's side walls are open at their ends and its vault stands clear of a square room's corners, so a
  //   jamb stands before each wall's end and the wall hangs from the roof to the jambs' tops: the corridor's arch is
  //   a doorway from this side
  let linkRect: number[] | null = null;
  if (L) {
    const link = (cfg.court.halls as Array<{ x0: number; x1: number; z0: number; z1: number; open?: boolean }>).find((h) => h.open)!;
    const [ramp, wall, slab, jamb, gate] = [piece(L.ramp).row, piece(L.wall).row, piece(L.ceiling).row, piece(L.jamb).row, piece(L.gate).row];
    const [top, gateZ] = [link.z1, hz + Q.capAt];
    const [run, rise] = [ramp.size![2], ramp.size![1]];
    const [wl, wh, wt] = [wall.size![0], wall.size![1], wall.size![2]];
    if (Math.abs(top + run - gateZ) > 0.01 || Math.abs(cfg.court.y - rise - sy) > 0.01 || Math.abs(ramp.size![0] - (link.x1 - link.x0)) > 0.01 || Math.abs(wl - run) > 0.01)
      throw new Error(`the way down: its ramp runs ${run} m and climbs ${rise} m, its wall is ${wl} m, and there are ${(gateZ - top).toFixed(2)} m from the corridor's end to the gate and ${(cfg.court.y - sy).toFixed(2)} m to go down`);
    // (turned half round: its own high edge, z 0, at the corridor's end, its low edge at the gate)
    pivot("c-station", L.ramp, link.x0, sy, top, 180);
    /** the rows of wall from `from` up to the street: whole rows, then one more under the street lapping the last, put
     * a hair in front of it */
    const rows = (from: number, put: (y: number, hair: number) => void) => {
      let y = from;
      for (; y + wh <= 1e-6; y += wh) put(y, 0);
      if (y < -1e-6) put(-wh, L.hair);
    };
    // its sides: a wall turned a quarter runs from its pivot along z, its plaster side (its own z 0) toward the ramp
    rows(sy, (y, h) => pivot("c-station", L.wall, link.x0 + h, y, top, 90));
    rows(sy, (y, h) => pivot("c-station", L.wall, link.x1 - h, y, gateZ, 270));
    // over the gate, from the cap's top
    rows(sy + gate.max![1], (y, h) => pivot("c-station", L.wall, link.x0, y, gateZ - h, 180));
    // at the corridor's end: the jambs, and from their tops up
    for (const jx of [link.x0 + jamb.size![0], link.x1]) pivot("c-station", L.jamb, jx, cfg.court.y, top + jamb.size![2], 0);
    rows(cfg.court.y + jamb.size![1], (y, h) => pivot("c-station", L.wall, link.x1, y, top + wt + h, 0));
    pivot("c-station", L.ceiling, link.x1, -L.under, top + slab.size![2], 0);
    // (its floor lowered on under the gate to the hall's own)
    linkRect = [link.x0, link.x1, top, hallRect[2]].map((v) => +v.toFixed(3));
  }
  // where the world's floor is lowered (floors.ts): the station and its tunnel to their track bed, the hall to its marble
  // floor; the street laid over the station and the tunnel as a slab to walk on (the hall stands on its own floors)
  const stationRect = [sx + piece(S.pieces.mouth).row.min![0], east + piece(S.pieces.end).row.max![0], sz, sz + Math.max(mid.max![2], piece(S.pieces.end).row.max![2])];
  // (the tunnel's up to the station's, so the floor is lowered all the way along the track)
  const tunnelRect = [tunnelEnd - wallThick, stationRect[0], tz0, tz1];
  cfg.underground = {
    floors: [
      { rect: stationRect.map((v) => +v.toFixed(3)), y: sy + mid.min![1] },
      { rect: tunnelRect.map((v) => +v.toFixed(3)), y: sy + tRow.min![1] },
      { rect: hallRect.map((v) => +v.toFixed(3)), y: sy },
      { rect: concourseRect.map((v) => +v.toFixed(3)), y: sy },
      ...(linkRect ? [{ rect: linkRect, y: sy, ramp: true }] : []),
      ...hallRooms.map((r) => ({ rect: r, y: cfg.court.y, room: true })),
    ],
    slabs: [stationRect, tunnelRect, concourseRect, ...(linkRect ? [linkRect] : []), ...hallRooms].map((r) => r.map((v) => +v.toFixed(3))),
  };
}

// ---------------------------------------------------------------- the base: the tower's wide lower floors (rules.base)
// The owner, 2026-09-30: "I want the building to be big and wide on the first x amount of floors, it can be more narrow
// the higher it goes, only using the assets we have". A block round the tower's foot as wide as the plaza allows short of
// the Sky Ring and its stairs, its corners cut, three storeys of the tower's own 3.5 m (0, 3.5 and 7: the tower's lower
// block's storeys, so its floors run on into the tower's) and a roof at 10.5 where the tower's lower block ends; faced
// with the tower's own window wall a 5 m bay at a time, the pack's wide gate for its doors and its plain pillar at each
// corner. Its slabs are baked (tools/neon-base.ts) from its outline in to whatever already stands there. The metro's
// kiosks and the station's glass hall stand inside it: the floor over each one's raised middle is left open, an atrium
// railed round, and the bridges from its first floor's corner doors out to the Sky Ring meet the ring where its inner
// fence is left open
const baseBridges: Pt[] = [];
/** each bridge's door (its middle on the base's face) and its far end on the Sky Ring */
const baseBridgeAxes: Array<[Pt, Pt]> = [];
{
  const B = R.base;
  const [hx, hz] = B.half;
  const [kx, kz] = B.corner;
  // the outline, the outer faces' corners, round from the north face's west end (x east, z south); each side's name
  const O: Pt[] = [[-hx + kx, -hz], [hx - kx, -hz], [hx, -hz + kz], [hx, hz - kz], [hx - kx, hz], [-hx + kx, hz], [-hx, hz - kz], [-hx, -hz + kz]];
  const sideName = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
  for (const [x, z] of O) if (Math.hypot(x, z) > R.skyring.r0 - 1) throw new Error(`the base's corner (${x}, ${z}) is within a metre of the Sky Ring`);
  const sides = O.map((a, k) => {
    const b = O[(k + 1) % O.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const d: Pt = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    let n: Pt = [-d[1], d[0]];
    if (n[0] * -(a[0] + b[0]) + n[1] * -(a[1] + b[1]) < 0) n = [-n[0], -n[1]];
    // its bays: as many of the wall's 5 m as fit, the rest in the plain 1 m wall, the whole centred on the side
    const bays = Math.floor(L / B.bay + 1e-6);
    const plains = Math.round(L - bays * B.bay);
    return { a, b, L, d, n, name: sideName[k], bays, plains, off: (L - bays * B.bay - plains) / 2 };
  });
  type Side = (typeof sides)[number];
  const at = (s: Side, t: number, inward: number): Pt => [s.a[0] + s.d[0] * t + s.n[0] * inward, s.a[1] + s.d[1] * t + s.n[1] * inward];
  const thick = -piece(B.wall).row.min![2];
  const levels = [...(B.storeys as number[])];
  const colonnade = (B.colonnade ?? []) as number[];
  /** a colonnade's bays that are doors, by storey and side: set once what stands inside is known */
  const doorBays = new Map<string, number[]>();
  /** a side's doors on a storey: a colonnade's bays that lead in (every one till they are known), else the ones `gates` names */
  const gatesOf = (h: number, s: Side): number[] => (colonnade.includes(h) ? (doorBays.get(`${h}:${s.name}`) ?? [...Array(s.bays).keys()]) : ((B.gates[String(h)] ?? {})[s.name] ?? []));
  const holes = new Map<number, Pt[][]>(levels.map((h) => [h, []]));
  holes.set(B.roof, []);
  const adds = new Map<number, Pt[][]>();
  const rails: Array<[Pt, Pt, number]> = [];
  let walls = 0;
  for (const h of levels) {
    for (const s of sides) {
      // (a wall's own +z looks into the building: the tower's window walls are turned so, measured off the tower)
      const yaw = yawToward(s.n[0], s.n[1]);
      // a colonnade's pillar flush with the face at each joint inside the run: its ends are a corner's pillar or the plain wall
      if (colonnade.includes(h))
        for (let k = 1; k < s.bays; k++) {
          const [cx, cz] = at(s, s.off + k * B.bay, piece(B.pillar).row.size![2] / 2);
          placeTurned("c-base", B.pillar, cx, cz, yaw, "o", h);
          walls++;
        }
      else
        for (let k = 0; k < s.bays; k++) {
          const [cx, cz] = at(s, s.off + (k + 0.5) * B.bay, thick / 2);
          placeTurned("c-base", gatesOf(h, s).includes(k) ? B.gate : B.wall, cx, cz, yaw, "o", h);
          walls++;
        }
      for (let k = 0; k < s.plains; k++) {
        const [cx, cz] = at(s, s.off + s.bays * B.bay + k + 0.5, thick / 2);
        placeTurned("c-base", B.plain, cx, cz, yaw, "o", h);
      }
    }
    // a pillar at each corner over the joint, turned to its bisector
    O.forEach((p, k) => {
      const [n0, n1] = [sides[(k + O.length - 1) % O.length].n, sides[k].n];
      const m: Pt = [n0[0] + n1[0], n0[1] + n1[1]];
      const ml = Math.hypot(m[0], m[1]);
      placeTurned("c-base", B.pillar, p[0] + (m[0] / ml) * 0.6, p[1] + (m[1] / ml) * 0.6, yawToward(m[0], m[1]), "o", h);
    });
  }
  // the roof's edge railed, a fence's width in from the outer face
  for (const s of sides) rails.push([at(s, 0, B.rail.inset), at(s, s.L, B.rail.inset), B.roof]);
  // the stairs between the storeys: the pack's double flight, its well the hole in the floor above, railed but where its
  // upper flight arrives (its own +z edge, `arrive` its own x: measured off its parts)
  const st = piece(B.stairs.piece).row;
  const stairs: Array<{ at: number; foot: Pt; top: Pt; route: number[][] }> = [];
  for (const [hs, list] of Object.entries(B.stairs.at as Record<string, number[][]>)) {
    const h = Number(hs);
    const up = h + 3.5;
    if (!levels.includes(up) && up !== B.roof) throw new Error(`stairs at ${h} lead to no storey`);
    if (up - (h + B.stairs.rise) > MOVE_STEP) throw new Error(`the base's stair climbs ${B.stairs.rise} m of ${up - h}`);
    for (const [x, z, yaw] of list) {
      const box = placeTurned("c-base", B.stairs.piece, x, z, yaw, "o", h);
      // own (x, z) of the stair onto the map, by its footprint's middle
      const [mx, mz] = [(st.min![0] + st.max![0]) / 2, (st.min![2] + st.max![2]) / 2];
      const own = (ox: number, oz: number): Pt => [x + box.u[0] * (ox - mx) + box.v[0] * (oz - mz), z + box.u[1] * (ox - mx) + box.v[1] * (oz - mz)];
      const [x0, x1, z0, z1] = [st.min![0], st.max![0], st.min![2], st.max![2]];
      holes.get(up)!.push([own(x0, z0), own(x1, z0), own(x1, z1), own(x0, z1)]);
      // (the rail stands back from the flight's sides by `clear`: flush with them it left a body's square no way off)
      const [a0, a1] = [B.stairs.arrive[0] - B.stairs.clear, B.stairs.arrive[1] + B.stairs.clear];
      const o = 0.05;
      rails.push([own(x0 - o, z0 - o), own(x1 + o, z0 - o), up], [own(x1 + o, z0 - o), own(x1 + o, z1 + o), up], [own(x0 - o, z1 + o), own(x0 - o, z0 - o), up]);
      rails.push([own(x1 + o, z1 + o), own(a1, z1 + o), up], [own(a0, z1 + o), own(x0 - o, z1 + o), up]);
      // its way up for a body (rules.base.stairs.route, its own metres and height over its foot) onto the map
      const route = (B.stairs.route as number[][]).map(([ox, oz, oy]) => [...own(ox, oz), h + oy]);
      stairs.push({ at: h, foot: own(1, z1 + 1), top: own(B.stairs.route.at(-1)[0], B.stairs.route.at(-1)[1]), route });
    }
  }
  // the atria: over each kiosk's and the glass hall's raised middle (its own x0, x1, z0, z1, measured off its parts: what
  // tops out over 3 m), on the first floor, railed round
  let atria = 0;
  for (const [name, [ax0, ax1, az0, az1]] of Object.entries(B.atria as Record<string, number[]>)) {
    const key = piece(name).key;
    for (const c of chunks.values())
      for (const q of c.place) {
        if (q[0] !== key) continue;
        const a = (q[4] * Math.PI) / 180;
        const [co, si] = [Math.cos(a), Math.sin(a)];
        const w = (lx: number, lz: number): Pt => [q[1] + co * lx + si * lz, q[3] - si * lx + co * lz];
        const m = B.atriumMargin;
        const ring = [w(ax0 - m, az0 - m), w(ax1 + m, az0 - m), w(ax1 + m, az1 + m), w(ax0 - m, az1 + m)];
        holes.get(levels[1])!.push(ring);
        ring.forEach((p, k) => rails.push([p, ring[(k + 1) % 4], levels[1]]));
        atria++;
      }
  }
  // the bridges from the first floor's corner doors to the Sky Ring: from the door's middle straight out to the ring's
  // inner edge, a slab of the base's floor, railed both sides
  for (const s of sides.filter((q) => q.name.length === 2)) {
    for (const k of gatesOf(levels[1], s)) {
      const mid = at(s, s.off + (k + 0.5) * B.bay, 0);
      const out: Pt = [-s.n[0], -s.n[1]];
      // how far out along `out` the ring's inner edge is (and 2 cm on, under the ring's own edge)
      const pb = mid[0] * out[0] + mid[1] * out[1];
      const t = -pb + Math.sqrt(pb * pb - (mid[0] * mid[0] + mid[1] * mid[1]) + R.skyring.r0 * R.skyring.r0) + 0.02;
      const w2 = B.bridge.width / 2;
      const p0: Pt = [mid[0] - s.d[0] * w2, mid[1] - s.d[1] * w2];
      const p1: Pt = [mid[0] + s.d[0] * w2, mid[1] + s.d[1] * w2];
      const far = (p: Pt): Pt => [p[0] + out[0] * t, p[1] + out[1] * t];
      (adds.get(levels[1]) ?? adds.set(levels[1], []).get(levels[1])!).push([p0, p1, far(p1), far(p0)]);
      const o = 0.1;
      const i0: Pt = [p0[0] + s.d[0] * o, p0[1] + s.d[1] * o];
      const i1: Pt = [p1[0] - s.d[0] * o, p1[1] - s.d[1] * o];
      rails.push([i0, far(i0), levels[1]], [i1, far(i1), levels[1]]);
      baseBridges.push(far(mid));
      baseBridgeAxes.push([mid, far(mid)]);
    }
  }
  // the base's insides (rules.base.inside), a plan a storey and each storey different (the owner, 2026-09-30: "some should
  // have no or little walls, some should have a lot of walls ... if they don't have cover to fight in then they die from
  // the outskirts all the time"): the ground floor the most open (the owner, 2026-10-02: "the first floor should be the most
  // open and wide"), a hall behind a colonnade open to the plaza all round, a pillar every 10 m and only low cover, where it
  // was a concourse walled by shop units; the first floor offices, two rows of rooms a side either side of a corridor, a
  // doorway each; the second floor a warehouse hall of pillars and the pack's racks in aisles; the roof the pack's cooling
  // boxes. Rooms are on a 2.5 m grid from the north face's straight run, in the pack's plain 3 m wall (the storeys are the
  // tower's 3.5 m, its slab 0.5: floor to ceiling); every storey's open floor strewn with the pack's crates, barrels and
  // furniture as cover, none within reach of a stair, an atrium, a door or another piece
  {
    const I = B.inside;
    let rnd2 = seeded(I.seed);
    const pick = <T,>(a: T[]): T => a[Math.floor(rnd2() * a.length)];
    const rect = cfg.tallest as { x0: number; x1: number; z0: number; z1: number };
    const box = (x0: number, x1: number, z0: number, z1: number): OBox => boxOf([Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1)]);
    // what each storey keeps clear: the stairs' ways on and off, the atria and the kiosks and the glass hall under them,
    // the doors in the faces and the bridges' doors
    const keep = new Map<number, OBox[]>([...levels, B.roof].map((h) => [h, []]));
    const C2 = I.clear;
    const grow = (o: OBox, g: number): OBox => ({ ...o, hu: o.hu + g, hv: o.hv + g });
    for (const [hs, list] of Object.entries(B.stairs.at as Record<string, number[][]>)) {
      const h = Number(hs);
      for (const [x, z, yaw] of list) {
        const u = rotY(yaw, 1, 0), v = rotY(yaw, 0, 1);
        const [hu, hv] = [st.size![0] / 2, st.size![2] / 2];
        // the stair and its way on at the foot (its own +z side), and on the floor above its well and the way off it
        const o: OBox = { c: [x + v[0] * (C2.stair / 2), z + v[1] * (C2.stair / 2)], u, v, hu: hu + 0.6, hv: hv + C2.stair / 2 + 0.6, top: 0 };
        keep.get(h)!.push(o);
        keep.get(h + 3.5)!.push(o);
      }
    }
    for (const ring of holes.get(levels[1])!) {
      const xs = ring.map((p) => p[0]), zs = ring.map((p) => p[1]);
      const o = grow(box(Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)), C2.atrium);
      keep.get(levels[1])!.push(o);
    }
    for (const [name] of Object.entries(B.atria as Record<string, number[]>)) {
      const row = piece(name).row;
      const key = piece(name).key;
      for (const c of chunks.values())
        for (const q of c.place) {
          if (q[0] !== key) continue;
          const a = (q[4] * Math.PI) / 180;
          const w = (lx: number, lz: number): Pt => [q[1] + Math.cos(a) * lx + Math.sin(a) * lz, q[3] - Math.sin(a) * lx + Math.cos(a) * lz];
          const cs = [w(row.min![0], row.min![2]), w(row.max![0], row.max![2])];
          keep.get(levels[0])!.push(grow(box(cs[0][0], cs[1][0], cs[0][1], cs[1][1]), 1.5));
        }
    }
    // the metro entrances' ways in across the ground floor, a metre either side (open, a bench fell across one's door)
    for (const hall of cfg.court.halls as Array<{ route?: number[][] }>)
      for (let k = 1; k < (hall.route?.length ?? 0); k++) {
        const [a, b] = [hall.route![k - 1], hall.route![k]];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 1e-6 || Math.abs(a[2] - levels[0]) > 0.5 || Math.abs(b[2] - levels[0]) > 0.5) continue;
        const u: Pt = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
        keep.get(levels[0])!.push({ c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], u, v: [-u[1], u[0]], hu: L / 2 + C2.atrium, hv: C2.atrium, top: 0 });
      }
    // (a shop's back may be a door in the face: the doors keep only the cover, the pillars and a room's walls off)
    const doors = new Map<number, OBox[]>([...levels, B.roof].map((h) => [h, []]));
    const doorsAt = doors;
    for (const h of levels)
      for (const s of sides)
        for (const k of gatesOf(h, s)) {
          const p = at(s, s.off + (k + 0.5) * B.bay, thick + C2.gate / 2);
          const o: OBox = { c: p, u: s.d, v: s.n, hu: B.bay / 2, hv: C2.gate / 2, top: 0 };
          // (a colonnade's bay is a door only where its way in, between its pillars, is clear of what stands inside: the
          // kiosks, the glass hall and the stairs back onto some, open but leading nowhere)
          if (colonnade.includes(h)) {
            if (keep.get(h)!.some((q) => overlaps({ ...o, hu: (B.bay - piece(B.pillar).row.size![0]) / 2 }, q, 0))) continue;
            (doorBays.get(`${h}:${s.name}`) ?? doorBays.set(`${h}:${s.name}`, []).get(`${h}:${s.name}`)!).push(k);
          }
          doors.get(h)!.push(o);
        }
    // (a side with no bay leading in has none, not every one)
    for (const h of colonnade) for (const s of sides) if (!doorBays.has(`${h}:${s.name}`)) doorBays.set(`${h}:${s.name}`, []);
    // the windows (rules.windows) in each walled storey's window walls, along x or z: a window opens only onto room, so
    // the cover and a room's furniture stand `room` metres off each (the bake measures them: these are its spans, the
    // pack's opening 4.86 m centred in its 5 m bay, parted alike)
    const windowKeep = new Map<number, OBox[]>(levels.map((h) => [h, []]));
    const WR = R.windows;
    if (WR)
      for (const h of levels.filter((y) => !colonnade.includes(y)))
        for (const s of sides) {
          if (Math.abs(s.d[0]) < 0.99 && Math.abs(s.d[1]) < 0.99) continue;
          const n = Math.max(1, Math.round((B.bay - 0.14) / WR.per));
          const total = n * WR.width + (n - 1) * WR.gap;
          for (let k = 0; k < s.bays; k++) {
            if (gatesOf(h, s).includes(k)) continue;
            for (let i = 0; i < n; i++) {
              const off = -total / 2 + i * (WR.width + WR.gap) + WR.width / 2;
              windowKeep.get(h)!.push({ c: at(s, s.off + (k + 0.5) * B.bay + off, thick + WR.room / 2), u: s.d, v: s.n, hu: WR.width / 2, hv: WR.room / 2, top: 0 });
            }
          }
        }
    const clearOf = (o: OBox, h: number, g = 0, door = true) => !keep.get(h)!.some((k) => overlaps(o, k, g)) && !(door && doors.get(h)!.some((k) => overlaps(o, k, g)));
    const inTower = (o: OBox, g: number) => overlaps(o, box(rect.x0, rect.x1, rect.z0, rect.z1), g);
    const inside = (p: Pt, inset: number) => O.every((a, k) => {
      const s = sides[k];
      return (p[0] - a[0]) * s.n[0] + (p[1] - a[1]) * s.n[1] > inset;
    });
    // the centre's spine of pads (rules.pads.spine) on the roof: where each from the plaza lands, the spot and run-up of
    // the one up to the top, and where the way down lands, all clear of the roof's cover (the bake measures them exactly)
    const SP = R.pads.spine;
    for (const q of (SP?.up ?? []) as Array<{ at: number[]; to: number[]; floor: number; land: number }>) {
      const u: Pt = [q.to[0], q.to[1]];
      // (its line into the outline from the plaza, or into the tallest building's footprint from the roof)
      const into = (p: Pt) => (q.floor === levels[0] ? inside(p, 0) : p[0] > rect.x0 && p[0] < rect.x1 && p[1] > rect.z0 && p[1] < rect.z1);
      let t = 0;
      while (t < 40 && !into([q.at[0] + u[0] * t, q.at[1] + u[1] * t])) t += 0.1;
      const f: Pt = [q.at[0] + u[0] * t, q.at[1] + u[1] * t];
      const c: Pt = q.floor === levels[0] ? [f[0] + u[0] * q.land, f[1] + u[1] * q.land] : [f[0] - u[0] * 2.5, f[1] - u[1] * 2.5];
      keep.get(B.roof)!.push({ c, u, v: [-u[1], u[0]], hu: 2.5, hv: 2, top: 0 });
    }
    for (const q of (SP?.down ?? []) as Array<{ land: number[] }>) keep.get(B.roof)!.push({ c: [q.land[0], q.land[1]], u: [1, 0], v: [0, 1], hu: 2, hv: 2, top: 0 });
    const placed = new Map<number, OBox[]>([...levels, B.roof].map((h) => [h, []]));
    let nWalls = 0, nProps = 0, nRooms = 0, nLamps = 0;
    /** a wall along a grid line from a to b (axis-aligned), its door slots (2.5 m each from a) left open */
    const wallLine = (h: number, a: Pt, b: Pt, doors: number[], wide = -1) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.round(L / I.grid);
      const d: Pt = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
      const yaw = Math.abs(d[0]) > 0.5 ? 0 : 90;
      let k = 0;
      while (k < n) {
        if (doors.includes(k)) { k++; continue; }
        // (none of a room's wall across the way in from a door in the face)
        const cut: Pt = [a[0] + d[0] * (k + 0.5) * I.grid, a[1] + d[1] * (k + 0.5) * I.grid];
        if (doorsAt.get(h)!.some((q) => overlaps({ c: cut, u: d, v: [-d[1], d[0]], hu: I.grid / 2, hv: 0.25, top: 0 }, q, 0.1))) { k++; continue; }
        // the pack's wide gate over two slots where asked, else a 5 m wall over two free slots, else a 2.5 m
        const two = k + 1 < n && !doors.includes(k + 1);
        const name = k === wide && two ? I.wide : two ? I.walls["5"] : I.walls["2.5"];
        const len = two ? 2 * I.grid : I.grid;
        const c: Pt = [a[0] + d[0] * (k * I.grid + len / 2), a[1] + d[1] * (k * I.grid + len / 2)];
        const o = placeTurned("c-base", name, c[0], c[1], yaw, "o", h);
        placed.get(h)!.push(o);
        nWalls++;
        k += two ? 2 : 1;
      }
    };
    /** a row of rooms along the north or south face's straight run, from the face `z0` to `z1`, doors toward `z1` */
    const roomRow = (h: number, z0: number, z1: number, widths: number[], shop: boolean, backDoor: number, sideDoor: number) => {
      const [xa, xb] = [O[0][0], O[1][0]];
      let x = xa;
      let open = true;
      const rooms: Array<[number, number, number, number]> = [];
      while (x < xb - 2.4) {
        // the plan's width at random, or the widest of the others that fits here (a room steps round what is in its way)
        const first = pick(widths);
        const w = [first, ...[...new Set(widths)].filter((q) => q !== first).sort((a, b) => b - a)]
          .map((q) => Math.min(q, xb - x))
          .find((q) => q > 4.9 && clearOf(box(x, x + q, z0, z1), h, 0.2, false) && !inTower(box(x, x + q, z0, z1), 0.3));
        if (w === undefined) {
          x += I.grid;
          open = true;
          continue;
        }
        const slots = Math.round(w / I.grid);
        const depth = Math.round(Math.abs(z1 - z0) / I.grid);
        // its side walls (the first of a run's left one too, a doorway through to its neighbour now and then), its front
        // with a doorway, a shop's the wide gate
        if (open) wallLine(h, [x, z0], [x, z1], []);
        wallLine(h, [x + w, z0], [x + w, z1], rnd2() < sideDoor && x + w < xb - 4.9 ? [Math.floor(rnd2() * Math.max(1, depth - 1))] : []);
        if (shop) wallLine(h, [x, z1], [x + w, z1], [], Math.floor(rnd2() * (slots - 1)));
        else wallLine(h, [x, z1], [x + w, z1], [1 + Math.floor(rnd2() * Math.max(1, slots - 2))]);
        if (backDoor >= 0 && rnd2() < backDoor) wallLine(h, [x, z0], [x + w, z0], [Math.floor(rnd2() * slots)]);
        rooms.push([x, x + w, z0, z1]);
        nRooms++;
        x += w;
        open = false;
      }
      return rooms;
    };
    /** pieces strewn over a storey's open floor (or a room's), `count` tries' worth of the ones that fit */
    const strew = (h: number, names: string[], count: number, within?: [number, number, number, number]) => {
      for (let t = 0, got = 0; t < count * 30 && got < count; t++) {
        const name = pick(names);
        const row = piece(name).row;
        const p: Pt = within ? [within[0] + 1 + rnd2() * (within[1] - within[0] - 2), within[2] + 1 + rnd2() * (within[3] - within[2] - 2)] : [O[7][0] + rnd2() * (O[2][0] - O[7][0]), O[0][1] + rnd2() * (O[4][1] - O[0][1])];
        const yaw = Math.floor(rnd2() * 4) * 90 + (row.size![0] < 1.2 && row.size![2] < 1.2 ? rnd2() * 40 - 20 : 0);
        const o: OBox = { c: p, u: rotY(yaw, 1, 0), v: rotY(yaw, 0, 1), hu: row.size![0] / 2, hv: row.size![2] / 2, top: 0 };
        if (!inside(p, 1.4) || inTower(o, 0.6) || !clearOf(o, h, 0.4) || (windowKeep.get(h) ?? []).some((q) => overlaps(o, q, 0.2)) || placed.get(h)!.some((q) => overlaps(o, q, C2.apart))) continue;
        placeTurned("c-base", name, p[0], p[1], yaw, "o", h - row.min![1]);
        placed.get(h)!.push(o);
        nProps++;
        got++;
      }
    };
    /** the plain pillar on a grid over the open floor */
    const pillars = (h: number, every: number) => {
      for (let x = O[7][0] + every / 2; x < O[2][0]; x += every)
        for (let z = O[0][1] + every / 2; z < O[4][1]; z += every) {
          const o = placeTurnedBox(x, z);
          if (!inside([x, z], 2) || inTower(o, 1) || !clearOf(o, h, 0.6) || placed.get(h)!.some((q) => overlaps(o, q, 1.5))) continue;
          placeTurned("c-base", I.pillar, x, z, 0, "o", h);
          placed.get(h)!.push(o);
        }
    };
    const placeTurnedBox = (x: number, z: number): OBox => ({ c: [x, z], u: [1, 0], v: [0, 1], hu: 0.5, hv: 0.5, top: 0 });
    const zIn = O[0][1] + thick;
    const zOut = O[4][1] - thick;
    for (const [hs, P] of Object.entries(I.storeys as Record<string, { plan: string; rows?: number[]; corridor?: number; widths?: number[]; back?: number; side?: number; pillars?: number; aisles?: { piece: string; run: number; every: number }; cover: { count: number; pieces: string[] }; inRooms?: { pieces: string[]; each: number } }>)) {
      const h = Number(hs);
      // (each storey its own draw: one seed for them all meant a change to one storey's plan re-rolled every other)
      rnd2 = seeded(I.seed * 1000 + Math.round(h * 10));
      const rooms: Array<[number, number, number, number]> = [];
      if (P.plan === "shops" || P.plan === "offices") {
        const [dA, dB] = [P.rows![0], P.rows![1] ?? 0];
        const cor = P.corridor ?? 0;
        // the north face's rows (from the face south) and the south face's (from the face north)
        for (const [face, sgn] of [[zIn, 1], [zOut, -1]] as const) {
          rooms.push(...roomRow(h, face, face + sgn * dA, P.widths!, P.plan === "shops", -1, P.side ?? 0));
          if (dB) {
            const b0 = face + sgn * (dA + cor);
            const b1 = sgn > 0 ? Math.min(b0 + dB, rect.z0 - 0.6) : Math.max(b0 - dB, rect.z1 + 0.6);
            rooms.push(...roomRow(h, b1, b0, P.widths!, false, P.back ?? -1, P.side ?? 0));
          }
        }
      }
      if (P.pillars) pillars(h, P.pillars);
      if (P.aisles) {
        // racks end to end in runs along x, a run every `every` m down each band, gaps where they do not fit
        const A = P.aisles;
        const row = piece(A.piece).row;
        for (const [z0, z1] of [[zIn + 2.5, rect.z0 - 2], [rect.z1 + 2, zOut - 2.5]])
          for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z += A.every)
            for (let x = O[0][0] + 1; x + A.run * row.size![0] < O[1][0]; x += A.run * row.size![0] + 3) {
              const o = box(x, x + A.run * row.size![0], z - 0.4, z + 0.4);
              if (!clearOf(o, h, 0.5) || inTower(o, 1) || placed.get(h)!.some((q) => overlaps(o, q, 1.2))) continue;
              for (let k = 0; k < A.run; k++) placeTurned("c-base", A.piece, x + (k + 0.5) * row.size![0], z, 0, "o", h);
              placed.get(h)!.push(o);
              nProps += A.run;
            }
      }
      if (P.inRooms) for (const r of rooms) strew(h, P.inRooms.pieces, P.inRooms.each, r);
      strew(h, P.cover.pieces, P.cover.count);
      // the pack's ceiling lamp on a grid under the storey's ceiling (the storey above's slab), none over a hole
      if (h + 3.5 <= B.roof) {
        const lamp = piece(I.lamps.piece).row;
        for (let x = O[7][0] + I.lamps.every / 2; x < O[2][0]; x += I.lamps.every)
          for (let z = O[0][1] + I.lamps.every / 2; z < O[4][1]; z += I.lamps.every) {
            const o: OBox = { c: [x, z], u: [1, 0], v: [0, 1], hu: lamp.size![0] / 2, hv: lamp.size![2] / 2, top: 0 };
            if (!inside([x, z], 1.5) || inTower(o, 0.5) || keep.get(h + 3.5)!.some((k) => overlaps(o, k, 0.5))) continue;
            placeTurned("c-base", I.lamps.piece, x, z, 0, "g", h + 3.5 - B.slab - I.lamps.under - lamp.max![1]);
            nLamps++;
          }
      }
    }
    console.log(`the base's insides: ${nRooms} rooms, ${nWalls} lengths of wall, ${nProps} pieces of cover, ${nLamps} lamps`);
  }
  // every rail a run of the fence's lengths along it, the last one short where the run does not come out even
  const long = piece(B.rail.long).row.max![0];
  const short = piece(B.rail.short).row.max![0];
  let fences = 0;
  for (const [a, b, y] of rails) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const d: Pt = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    const yaw = +((Math.atan2(-d[1], d[0]) * 180) / Math.PI).toFixed(2);
    let u = 0;
    while (u < L - 0.3) {
      const name = L - u >= long - 0.2 ? B.rail.long : B.rail.short;
      add("c-base", "c", [piece(name).key, +(a[0] + d[0] * u).toFixed(3), y, +(a[1] + d[1] * u).toFixed(3), yaw, "o"] as Place);
      u += name === B.rail.long ? long : short;
      fences++;
    }
  }
  const r2 = (p: Pt) => p.map((v) => +v.toFixed(3));
  cfg.base = {
    outline: O,
    levels: [...levels, B.roof].map((y) => ({ y, holes: (holes.get(y) ?? []).map((h) => h.map(r2)), adds: (adds.get(y) ?? []).map((h) => h.map(r2)), ...(y === levels[0] ? { court: true } : {}) })),
    slab: B.slab,
    tuck: B.tuck,
    cell: B.cell,
    mats: B.mats,
    scale: B.scale,
    mask: B.mask,
    stairs: stairs.map((q) => ({ at: q.at, foot: r2(q.foot), top: r2(q.top), route: q.route.map((v) => v.map((w) => +w.toFixed(2))) })),
    // each door in the faces: a metre outside it and three in, on its storey
    gates: levels.flatMap((h) => sides.flatMap((s) => gatesOf(h, s).map((k) => ({ at: h, out: r2(at(s, s.off + (k + 0.5) * B.bay, -1)), in: r2(at(s, s.off + (k + 0.5) * B.bay, 3)) })))),
    bridges: baseBridges.map(r2),
    bridgeAxes: baseBridgeAxes.map(([a, b]) => [r2(a), r2(b)]),
  };
  console.log(`the base: ${walls} bays of wall, ${stairs.length} stairs, ${atria} atria, ${baseBridges.length} bridges to the Sky Ring, ${fences} lengths of rail`);
}

// The Well (rules.well, the master plan's phase 5): in the south-east block's outer corner, where its rooms building
// stood, the pack's "inverted building" stacked as the pack's own underground scene stacks it (NeonUnderground00): its
// ground ring at the street round a light-well, and a gallery of shops round the well every 3.5 m down. The street's
// tiles taken up over the well, its bottom floored with the pack's tile; underground, the world's floor lowered under
// the whole stack to its bottom, and the street's slab laid over it round the well (rules.underground's floors and
// slabs), so a body stands on each gallery and on the street over it, and falls down the well
{
  const W = R.well;
  if (W) {
    const [ox, oz] = W.at;
    const levels = W.levels as Array<{ piece: string; x: number; y: number; z: number }>;
    // the stairs (rules.well.flights, tools/neon-well.ts): each from the floor at `from` (the street over the first gallery)
    // down to the one at `to`, its top end at (x, z) from `at`; the floor above it cut for a head, in the piece's own frame
    const F = W.flights;
    const cuts = new Map<number, string[]>();
    const flights = (F.list as Array<{ x: number; z: number; dir: number; from: number; to: number }>).map((q) => {
      const f: Flight = { x: ox + q.x, z: oz + q.z, dir: q.dir, low: levels[q.to].y, high: levels[q.from].y, width: F.width };
      // (from the street, its slot as long as the street's tiles are taken up for it: whole tiles)
      if (f.high === 0) {
        const st = piece(R.court.entrance.patch).row.size![0];
        f.slot = Math.ceil(measure(f, F.spec).cut / st - 1e-6) * st;
      }
      const { cut } = wellFlight(f, F.spec, F.scale);
      // (cut from the floor above and from the gallery under it, whose ceiling is its own pieces' tops)
      for (const k of [q.from]) {
        const lv = levels[k];
        const [px, pz] = [ox + lv.x, oz + lv.z];
        const own = [cut[0] - px, cut[1] - px, cut[4] - lv.y, cut[5] - lv.y, cut[2] - pz, cut[3] - pz].map((v) => +v.toFixed(3));
        (cuts.get(k) ?? cuts.set(k, []).get(k)!).push(`*|${own.join(",")}`);
      }
      return { ...f, n: measure(f, F.spec).n, cut: cut.map((v) => +v.toFixed(3)), route: wellFlight(f, F.spec, F.scale).route.map((r) => r.map((v) => +v.toFixed(3))) };
    });
    // the corridor from the station's concourse to the lowest gallery (rules.well.corridor): the pack's low metro corridor,
    // east from the concourse's gated end along its south part, round the pack's corner, south to the gallery's north
    // shops, in through the shop door there (left out); its pieces 5 m each, the last of each leg cut to fit, exactly
    const CO = W.corridor;
    if (CO) {
      const lowest = levels.length - 1;
      (cuts.get(lowest) ?? cuts.set(lowest, []).get(lowest)!).push(CO.door);
    }
    levels.forEach((lv, k) => add("c-well", "c", [piece(lv.piece).key, +(ox + lv.x).toFixed(3), lv.y, +(oz + lv.z).toFixed(3), 0, "o", ...(cuts.has(k) ? [null, cuts.get(k)!] : [])] as Place));
    const corridor: number[][] = [];
    if (CO) {
      const y = Math.min(...levels.map((q) => q.y));
      const [z0, z1] = CO.z as number[];
      const len = piece(CO.straight[0]).row.size![0];
      // east, yaw 0: a piece covers x from its pivot to `len` on, z `len` up to its pivot
      let n = 0;
      for (let x = CO.from; x < CO.turn - 1e-6; x += len, n++) {
        const over = x + len - CO.turn;
        const px = over > 0 ? CO.turn - len : x;
        add("c-well", "c", [piece(CO.straight[n % CO.straight.length]).key, +px.toFixed(3), y, z1, 0, "o", ...(over > 1e-6 ? [null, [`*|-0.1,${(x - px).toFixed(3)},-1,5,-5.1,0.1`]] : [])] as Place);
      }
      // the corner, turned 90: open west and south; covers x `len` up to its pivot, z `len` up to it
      const ex = CO.turn + len;
      add("c-well", "c", [piece(CO.corner).key, +ex.toFixed(3), y, z1, 90, "o"] as Place);
      // south, turned 90: a piece covers x `len` up to its pivot, z `len` up to it; the last cut off at the gallery's edge
      const to = oz + CO.to;
      for (let z = z1; z < to - 1e-6; z += len, n++) {
        const over = z + len - to;
        add("c-well", "c", [piece(CO.straight[n % CO.straight.length]).key, +ex.toFixed(3), y, +(z + len).toFixed(3), 90, "o", ...(over > 1e-6 ? [null, [`*|-0.1,${over.toFixed(3)},-1,5,-5.1,0.1`]] : [])] as Place);
      }
      corridor.push([CO.from, ex, z0, z1], [CO.turn, ex, z1, to]);
    }
    const hole = [ox + W.hole[0], ox + W.hole[1], oz + W.hole[2], oz + W.hole[3]];
    // (the street's tiles taken up over the whole of the ground ring, which is paved itself round its openings, and over
    // the stairwell down from the street to the first gallery, on the tiles' grid round its slot)
    openGround(ox + W.ground[0], ox + W.ground[1], oz + W.ground[2], oz + W.ground[3]);
    const st = piece(R.court.entrance.patch).row.size![0];
    const streetSlots = flights.filter((f) => f.high === 0).map((f) => [Math.floor(f.cut[0] / st + 1e-6) * st, Math.ceil(f.cut[1] / st - 1e-6) * st, Math.floor(f.cut[2] / st + 1e-6) * st, Math.ceil(f.cut[3] / st - 1e-6) * st]);
    for (const q of streetSlots) openGround(q[0], q[1], q[2], q[3]);
    // the well's bottom: the pack's floor tile across it, its top `sink` under the lowest gallery's floor (the gallery's
    // own floor reaches into the well at its corners, and in one plane the two fought for the same pixels)
    const tile = piece(W.bottom.piece).row;
    const bottom = Math.min(...(W.levels as Array<{ y: number }>).map((q) => q.y));
    for (let x = hole[0]; x < hole[1] - 1e-6; x += tile.size![0])
      for (let z = hole[2]; z < hole[3] - 1e-6; z += tile.size![2]) placeAt("c-well", "c", W.bottom.piece, x + tile.size![0] / 2, z + tile.size![2] / 2, 0, "o", { y: bottom - W.bottom.sink - tile.max![1] });
    // the stack's whole footprint underground (its galleries reach past its ring at the street)
    const foot = [ox + W.under[0], ox + W.under[1], oz + W.under[2], oz + W.under[3]].map((v) => +v.toFixed(3));
    const ug = cfg.underground as { floors: Array<{ rect: number[]; y: number; well?: boolean }>; slabs: number[][] };
    ug.floors = ug.floors.filter((f) => !f.well);
    ug.floors.push({ rect: foot, y: bottom, well: true });
    // (the corridor's, as the station's own: the world's floor lowered under it, the street's slab over it)
    for (const r of corridor) ug.floors.push({ rect: r.map((v) => +v.toFixed(3)), y: bottom });
    const r3 = (v: number) => +v.toFixed(3);
    const ring = [[foot[0], hole[0], foot[2], foot[3]], [hole[1], foot[1], foot[2], foot[3]], [hole[0], hole[1], foot[2], hole[2]], [hole[0], hole[1], hole[3], foot[3]]].map((q) => q.map(r3));
    ug.slabs = ug.slabs.filter((q) => !(cfg.well?.slabs ?? []).some((w: number[]) => w.every((v, i) => Math.abs(v - q[i]) < 1e-3)));
    // (less the stairwell's slots: each slab rectangle split round each)
    const less = (rs: number[][], h: number[]): number[][] => rs.flatMap(([a0, a1, b0, b1]) => {
      if (h[1] <= a0 || h[0] >= a1 || h[3] <= b0 || h[2] >= b1) return [[a0, a1, b0, b1]];
      const out: number[][] = [];
      if (h[0] > a0) out.push([a0, h[0], b0, b1]);
      if (h[1] < a1) out.push([h[1], a1, b0, b1]);
      const [c0, c1] = [Math.max(a0, h[0]), Math.min(a1, h[1])];
      if (h[2] > b0) out.push([c0, c1, b0, h[2]]);
      if (h[3] < b1) out.push([c0, c1, h[3], b1]);
      return out;
    });
    const slabs = [...streetSlots.reduce((rs, h) => less(rs, h), ring), ...corridor].map((q) => q.map(r3));
    ug.slabs.push(...slabs);
    // the rope up the well, a vertical zipline as the glass lifts' are: from a body's hang over the bottom to where the
    // feet hang `clear` of the ground ring's railing round the opening, so the top of the ride puts a rider over it and
    // onto the street (rules.well.rope)
    const hang = JSON.parse(readFileSync(join(ROOT, "src", "config", "movement.json"), "utf8")).ziplineHang * 0.0254;
    const [rx, rz] = [+(ox + W.rope.at[0]).toFixed(3), +(oz + W.rope.at[1]).toFixed(3)];
    const ropes = [{ rope: [[rx, +(bottom + hang + R.lifts.under).toFixed(3), rz], [rx, +(W.rope.clear + hang).toFixed(3), rz]], floor: bottom, colour: W.rope.colour, onto: W.rope.onto, out: W.rope.out }];
    // (the bake's measure of its seal kept until it measures again)
    cfg.well = { ...(cfg.well?.measured ? { measured: cfg.well.measured } : {}), at: W.at, hole: hole.map(r3), foot, bottom, levels: (W.levels as Array<{ y: number }>).map((q) => q.y), slabs, ropes, flights, flightSpec: F.spec, flightMats: F.mats, flightScale: F.scale, corridor, back: W.back };
    // its block's light (rules.low.beam, below): up the light-well from its bottom
    beams.push({ chunk: `c-${W.block.split(",")[1] === "-1" ? "n" : "s"}${W.block.split(",")[0] === "-1" ? "w" : "e"}`, block: W.block, x: (hole[0] + hole[1]) / 2, y: bottom, z: (hole[2] + hole[3]) / 2 });
    console.log(`the Well: ${W.levels.length} levels to ${bottom} m, its well ${(hole[1] - hole[0]).toFixed(1)} by ${(hole[3] - hole[2]).toFixed(1)} m`);
  }
}

// The glass lifts (rules.lifts, the master plan's phase 4): from the Sky Ring to each High City island's roof, beside
// its inner jump pad. A footbridge, the pack's, from the ring's outer edge out across the Loop, straight along the pad's
// line `side` metres to one side of it, onto one of High City's floating decks with the pack's glass lift car on it
// (its roof, lamp and door left out: the bridge is its way in, and a rope rises out of it). The rope, a vertical
// zipline, from the car's floor to over the island's fence; at its top a walk of `decks` floating decks at the islands'
// bridges' height from beside the rope over the fence, and the pack's small stair at its end down to the roof, as
// High City's bridges end. Placed where the island's face is flat for the car's width (measured, rules.lifts.at)
const liftRing: Pt[] = [];
const lifts: Array<{ id: string; rope: number[][]; floor: number; ring: number[]; car: number[]; out: number[]; land: number[]; foot: number[]; colour: string }> = [];
{
  const L = R.lifts;
  const SR = R.skyring;
  const B = R.bridges;
  // (the platform and the landing are High City's floating deck, measured for its bridges: its deck at its own zero)
  if (piece(L.platform).key !== piece(B.straight.piece).key || piece(L.landing).key !== piece(B.straight.piece).key) throw new Error("the lifts' decks are not the bridges' floating deck, whose deck height is measured");
  const hang = JSON.parse(readFileSync(join(ROOT, "src", "config", "movement.json"), "utf8")).ziplineHang * 0.0254;
  const [bridge, platform, landing, stair] = [piece(L.bridge).row, piece(L.platform).row, piece(L.landing).row, piece(L.stairs).row];
  for (const q of (cfg.pads ?? []) as Array<{ id: string; face: number[]; out: number[] }>) {
    const at = L.at[q.id];
    if (!at) continue;
    // the pad's own frame: u toward the middle, v to one side; the walk out from the ring along w
    const u: Pt = [q.out[0], q.out[1]];
    const v: Pt = [-u[1], u[0]];
    const w: Pt = [-u[0], -u[1]];
    const line: Pt = [q.face[0] + v[0] * at.side, q.face[1] + v[1] * at.side];
    // where the line meets the ring's outer edge (|line + u t| = r1, the near crossing)
    const b2 = 2 * (line[0] * u[0] + line[1] * u[1]), c2 = line[0] * line[0] + line[1] * line[1] - SR.r1 * SR.r1;
    const t = (-b2 - Math.sqrt(b2 * b2 - 4 * c2)) / 2;
    const ring: Pt = [line[0] + u[0] * t, line[1] + u[1] * t];
    // along w from `onRing` on the ring: the bridge, then the platform, the car and the rope in its middle
    const along = (k: number): Pt => [ring[0] + w[0] * k, ring[1] + w[1] * k];
    const [b0, len, plat] = [-L.onRing, bridge.size![0], platform.size![0]];
    const car = along(b0 + len + plat / 2);
    // (each piece's own +x along w: x' = c x + s z, z' = -s x + c z, so (c, -s) = w)
    const yaw = +((Math.atan2(-w[1], w[0]) * 180) / Math.PI).toFixed(2);
    placeTurned("c-lifts", L.bridge, ...along(b0 + len / 2), yaw, "o", L.deck - bridge.min![1]);
    placeTurned("c-lifts", L.platform, ...car, yaw, "o", L.deck - B.straight.deck);
    placeAt("c-lifts", "c", L.car.piece, car[0], car[1], yaw, "o", { y: L.deck, without: L.car.without });
    // the rope: from a body's hang over the car's floor to the hang over the landing's, `over` above it
    const [rx, rz] = [+car[0].toFixed(3), +car[1].toFixed(3)];
    const rope = [[rx, +(L.deck + hang + L.under).toFixed(3), rz], [rx, +(B.deck + hang + L.over).toFixed(3), rz]];
    // the landing: decks along w from `gap` past the rope, at the bridges' height, and the stair down at its end
    const from = plat / 2 + L.gap;
    for (let k = 0; k < at.decks; k++) placeTurned("c-lifts", L.landing, ...along(b0 + len + from + landing.size![0] * (k + 0.5)), yaw, "o", B.deck - B.straight.deck);
    const end = along(b0 + len + from + landing.size![0] * at.decks);
    // (the stair climbs along its own `up`, toward the landing: -w; its top edge at the landing's end)
    const up = B.stairs.up as number[];
    const syaw = [0, 90, 180, 270].find((y) => {
      const [x2, z2] = rotY(y, up[0], up[1]);
      return Math.abs(x2 + w[0]) < 1e-6 && Math.abs(z2 + w[1]) < 1e-6;
    })!;
    const tMid: Pt = [up[0] ? (up[0] > 0 ? stair.max![0] : stair.min![0]) : (stair.min![0] + stair.max![0]) / 2, up[1] ? (up[1] > 0 ? stair.max![2] : stair.min![2]) : (stair.min![2] + stair.max![2]) / 2];
    const [ox, oz] = rotY(syaw, tMid[0], tMid[1]);
    add("c-lifts", "c", [piece(L.stairs).key, +(end[0] - ox).toFixed(3), +(B.roof - stair.min![1]).toFixed(3), +(end[1] - oz).toFixed(3), syaw, "o"] as Place);
    const runs = Math.max(stair.size![0], stair.size![2]);
    const foot = along(b0 + len + from + landing.size![0] * at.decks + runs + 0.5);
    liftRing.push(ring);
    lifts.push({ id: q.id, rope, floor: L.deck, ring: ring.map((x) => +x.toFixed(3)), car: car.map((x) => +x.toFixed(3)), out: w, land: along(b0 + len + from + 1).map((x) => +x.toFixed(3)), foot: foot.map((x) => +x.toFixed(3)), colour: L.colours[q.id] });
  }
  cfg.lifts = lifts;
  console.log(`the glass lifts: ${lifts.length}, ropes ${lifts.map((q) => `${q.id} ${(q.rope[1][1] - q.rope[0][1]).toFixed(1)} m`).join(", ")}`);
}

// The Sky Ring (rules.skyring): the walkway storey, a ring of the pack's floor slab round the tower's plaza at the
// height of a building's first floor, its deck baked as a true circle (tools/import-neon.ts). Here its fences, the
// pack's elegant glass one along both edges, a length along each chord; and its stairs, the pack's double flight up from
// the plaza on each axis, their top at the ring's inner edge, the fence left open where each arrives
const skyStairs: Pt[] = [];
{
  const SR = R.skyring;
  const fence = piece(SR.fence.piece).row;
  const flen = fence.max![0];
  const stair = piece(SR.stairs.piece).row;
  if (Math.abs(SR.deck - SR.stairs.rise) > MOVE_STEP) throw new Error(`the stair climbs ${SR.stairs.rise} m to a deck at ${SR.deck}`);
  // the stairs: own +z (the side its upper flight tops out on) out toward the ring, its pivot on the inner edge
  const exits: Pt[] = [];
  for (const deg of SR.stairs.at as number[]) {
    const u: Pt = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
    const yaw = yawToward(u[0], u[1]);
    add("c-skyring", "c", [piece(SR.stairs.piece).key, +(u[0] * SR.r0).toFixed(3), 0, +(u[1] * SR.r0).toFixed(3), +yaw.toFixed(2), "o"] as Place);
    const [ex, ez] = rotY(yaw, SR.stairs.exit[0], SR.stairs.exit[1]);
    exits.push([u[0] * SR.r0 + ex, u[1] * SR.r0 + ez]);
    skyStairs.push([u[0] * (SR.r0 - stair.size![2] / 2), u[1] * (SR.r0 - stair.size![2] / 2)]);
  }
  let fences = 0;
  for (const [r, open] of [[SR.r0 + SR.fence.inset, true], [SR.r1 - SR.fence.inset, false]] as const) {
    const n = Math.ceil((2 * Math.PI * r) / (flen - 0.05));
    for (let k = 0; k < n; k++) {
      const [a, b] = [(k / n) * 2 * Math.PI, ((k + 1) / n) * 2 * Math.PI];
      const pa: Pt = [Math.cos(a) * r, Math.sin(a) * r];
      const pb: Pt = [Math.cos(b) * r, Math.sin(b) * r];
      const mid: Pt = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
      if (open && [...exits, ...baseBridges].some((e) => Math.hypot(e[0] - mid[0], e[1] - mid[1]) < SR.fence.gap)) continue;
      // (and the outer edge where each glass lift's bridge leaves it)
      if (!open && liftRing.some((e) => Math.hypot(e[0] - mid[0], e[1] - mid[1]) < SR.fence.gap)) continue;
      const d: Pt = [pb[0] - pa[0], pb[1] - pa[1]];
      // (its own x along the chord from its pivot)
      add("c-skyring", "c", [piece(SR.fence.piece).key, +pa[0].toFixed(3), SR.deck, +pa[1].toFixed(3), +((Math.atan2(-d[1], d[0]) * 180) / Math.PI).toFixed(2), "o"] as Place);
      fences++;
    }
  }
  cfg.skyring = { r0: SR.r0, r1: SR.r1, deck: SR.deck, stairs: skyStairs.map((q) => q.map((v) => +v.toFixed(2))), exits: exits.map((q) => q.map((v) => +v.toFixed(2))) };
  console.log(`the Sky Ring: ${fences} lengths of fence, ${exits.length} stairs`);
}

// The bots' street graph, modelled (src/game/neonmap.ts builds it): its nodes every `graph.step` metres from
// `cut.half - graph.margin` (world.json, game.graph), each joined to its eight neighbours where a body walks between them,
// on the ground the last bake's collision leaves open (a box over a body's height and 2.5 m tall or more is a building or a
// wall; the street's own cars, vans, blocks and crates are lower, and come from this run instead), a body's
// `perches_clear.walk` round every piece added so far. A piece that would leave the ground in more separate pieces than it
// found it is passed over, and a node a piece stands on is no street node (the game finds the piece's top there and makes
// it a raised one). The median's block and a car in the kerb lane cut two of the south-west street's nodes off; a crate
// stack laid after the median, with a model of its own that never saw it, cut the same two. One model, shared by every
// piece the streets get, in the order they go down
function streetGraph() {
  const GG = cfg.game.graph as { step: number; margin: number };
  const WORLD = JSON.parse(readFileSync(join(ROOT, "src", "config", "world.json"), "utf8")) as { cut: { half: number } };
  const lim = WORLD.cut.half - GG.margin;
  // (a body round each piece, and `graphPad` more: the bake builds the collision in half-metre columns, so a piece's
  // boxes stand up to half a cell past its mesh, and links the model left open the game found shut)
  const body = (R.perches_clear.walk as number) + (R.dress.graphPad as number);
  const SB = lastSolids();
  // (and every lower box of it a body cannot step onto, from a step's height to under a standing body's (movement.json),
  // but those of the last layout's own low street pieces, laid again by this run and added as they go: every chunk's
  // pieces that stand under 4 m on a footprint under 8 m, each grown half a metre. A platform 0.6 m high beside MARKET's
  // kerb, a step too high for a bot, was no wall to the model, and a crate stack shut two street nodes in against it)
  const STAND = JSON.parse(readFileSync(join(ROOT, "src", "config", "movement.json"), "utf8")).standHeight * 0.0254;
  // (not the chunks laid last, the street walls, the climbs and the street cover: the bake lists their boxes in `laid`
  // and lastSolids leaves them out already, and their footprints took a parked car's boxes beside them out by turns)
  const laidLast = [R.low.walls?.chunk, R.blocks?.climbs?.chunk, R.dress?.cover?.chunk].filter(Boolean) as string[];
  const lowOld: OBox[] = Object.entries((cfg.chunks ?? {}) as Record<string, { place: Place[] }>).flatMap(([k, ch]) => (laidLast.includes(k) ? [] : ch.place)).flatMap((q) => {
    const r = byName.get(q[0]);
    if (!r?.size || q[2] > 1 || q[2] + r.max![1] > 4 || r.size[1] < MOVE_STEP || Math.max(r.size[0], r.size[2]) > 8) return [];
    const [ox, oz] = rotY(q[4], (r.min![0] + r.max![0]) / 2, (r.min![2] + r.max![2]) / 2);
    return [{ c: [q[1] + ox, q[3] + oz] as Pt, u: rotY(q[4], 1, 0), v: rotY(q[4], 0, 1), hu: r.size[0] / 2 + 0.5, hv: r.size[2] / 2 + 0.5, top: 0 }];
  });
  const ofOld = (b: number[]) => {
    const [x, z] = [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2];
    return lowOld.some((o) => Math.abs((x - o.c[0]) * o.u[0] + (z - o.c[1]) * o.u[1]) < o.hu && Math.abs((x - o.c[0]) * o.v[0] + (z - o.c[1]) * o.v[1]) < o.hv);
  };
  const SG = new Map<string, number[][]>();
  const W = R.perches_clear.walk as number;
  for (const b of SB) {
    const tall = b[4] <= 1.9 && b[5] >= 0.3 && b[5] - b[4] >= 2.5;
    if (!tall && !(b[5] > MOVE_STEP && b[4] < STAND && b[5] - b[4] > 0.05 && !ofOld(b))) continue;
    for (let i = Math.floor((b[0] - W) / 2); i <= Math.floor((b[1] + W) / 2); i++) for (let j = Math.floor((b[2] - W) / 2); j <= Math.floor((b[3] + W) / 2); j++) (SG.get(`${i},${j}`) ?? SG.set(`${i},${j}`, []).get(`${i},${j}`)!).push(b);
  }
  // (each box a body's half-width proud, `perches_clear.walk`: the game walks a body from node to node, and a diagonal
  // that slipped 0.35 m past a building's corner was a link to the model and none to the game)
  const walled = (x: number, z: number) => (SG.get(`${Math.floor(x / 2)},${Math.floor(z / 2)}`) ?? []).some((b) => x >= b[0] - W && x <= b[1] + W && z >= b[2] - W && z <= b[3] + W);
  const gn: Pt[] = [];
  // (all the bots' grid, the edge road's and the plain districts' past it among them: a piece on the edge road cuts nodes
  // standing past the centre)
  for (let x = -lim; x <= lim + 1e-6; x += GG.step) for (let z = -lim; z <= lim + 1e-6; z += GG.step) if (!walled(x, z)) gn.push([x, z]);
  const gi = new Map(gn.map((q, i) => [`${q[0]},${q[1]}`, i]));
  const gl: Array<[number, number]> = [];
  for (const [i, [x, z]] of gn.entries())
    for (const [dx, dz] of [[GG.step, 0], [0, GG.step], [GG.step, GG.step], [GG.step, -GG.step]]) {
      const j = gi.get(`${x + dx},${z + dz}`);
      if (j === undefined) continue;
      let ok = true;
      for (let t = 0; t <= 1 && ok; t += 0.02) if (walled(x + dx * t, z + dz * t)) ok = false;
      if (ok) gl.push([i, j]);
    }
  const hits = (o: OBox, a: Pt, b: Pt) => {
    for (let t = 0; t <= 1; t += 0.02) {
      const [px, pz] = [a[0] + (b[0] - a[0]) * t - o.c[0], a[1] + (b[1] - a[1]) * t - o.c[1]];
      if (Math.abs(px * o.u[0] + pz * o.u[1]) < o.hu + body && Math.abs(px * o.v[0] + pz * o.v[1]) < o.hv + body) return true;
    }
    return false;
  };
  const cut = new Set<number>();
  const gone = new Set<number>();
  const covers = (o: OBox) => gn.flatMap((q, i) => {
    const [px, pz] = [q[0] - o.c[0], q[1] - o.c[1]];
    return !gone.has(i) && Math.abs(px * o.u[0] + pz * o.u[1]) < o.hu && Math.abs(px * o.v[0] + pz * o.v[1]) < o.hv ? [i] : [];
  });
  const cutBy = (o: OBox) => gl.flatMap(([i, j], k) => (!cut.has(k) && hits(o, gn[i], gn[j]) ? [k] : []));
  const piecesOf = (extra: number[], under: number[]) => {
    const up = gn.map((_, i) => i);
    const find = (i: number): number => (up[i] === i ? i : (up[i] = find(up[i])));
    const out = new Set([...gone, ...under]);
    let n = gn.length - out.size;
    const skip = new Set(extra);
    gl.forEach(([i, j], k) => {
      if (cut.has(k) || skip.has(k) || out.has(i) || out.has(j)) return;
      const [a, b] = [find(i), find(j)];
      if (a !== b) (up[a] = b), n--;
    });
    return n;
  };
  let pieces = piecesOf([], []);
  const held: OBox[] = [];
  return {
    /** a piece down on the street: its links cut, the nodes it stands on gone */
    add(o: OBox) {
      for (const i of covers(o)) gone.add(i);
      for (const k of cutBy(o)) cut.add(k);
      pieces = piecesOf([], []);
      held.push(o);
    },
    /** every piece added, in order (the street cover measures the street with this run's pieces, not the last bake's) */
    held,
    /** whether this piece would leave the street in more pieces */
    splits: (o: OBox) => piecesOf(cutBy(o), covers(o)) > pieces,
    /**
     * whether this piece would stand across any link, cut or not, of a street node the model has off the main network,
     * or on such a node: the model's guess at a link is wrong both ways, and a pair it took for cut off was joined in
     * the game by a link it held cut, which a kiosk then stood across
     */
    strands: (o: OBox) => {
      const up = gn.map((_, i) => i);
      const find = (i: number): number => (up[i] === i ? i : (up[i] = find(up[i])));
      gl.forEach(([i, j], k) => {
        if (!cut.has(k) && !gone.has(i) && !gone.has(j)) up[find(i)] = find(j);
      });
      const size = new Map<number, number>();
      gn.forEach((_, i) => !gone.has(i) && size.set(find(i), (size.get(find(i)) ?? 0) + 1));
      const main = [...size].sort((a, b) => b[1] - a[1])[0]?.[0];
      const off = (i: number) => !gone.has(i) && find(i) !== main;
      return gl.some(([i, j]) => (off(i) || off(j)) && hits(o, gn[i], gn[j])) || gn.some((q, i) => {
        const [px, pz] = [q[0] - o.c[0], q[1] - o.c[1]];
        return off(i) && Math.abs(px * o.u[0] + pz * o.u[1]) < o.hu && Math.abs(px * o.v[0] + pz * o.v[1]) < o.hv;
      });
    },
    /** (a debugging aid) the links the model holds from the node at (x, z), and whether that node is still a street node */
    linksAt: (x: number, z: number) => {
      const i = gi.get(`${x},${z}`);
      if (i === undefined) return "no node";
      if (gone.has(i)) return "gone";
      return gl.flatMap(([a, b], k) => (cut.has(k) || gone.has(a) || gone.has(b) || (a !== i && b !== i) ? [] : [gn[a === i ? b : a].join(",")])).join(" ") || "no links";
    },
  };
}
let STREET_GRAPH: ReturnType<typeof streetGraph> | undefined;

// The centre's streets dressed with the pack's own (rules.dress): its street lamps along both kerbs, cars parked in the
// lanes by the kerbs (crouching cover in the street), and cars flying over the streets (the store's pictures have them,
// out of reach and so with no collision), all turned along the curves. Clear of the junctions, the jump pads and the
// metro's kiosks
{
  const D = R.dress;
  let carCount = 0;
  // (the bots' street graph modelled from the start, streetGraph above, fed every lamp and car as it goes down: a van
  // that would cut the street a car parks instead. Two vans in MARKET's kerb lane, when every second car became one, cut
  // two street nodes off between them, the block's buildings and the median)
  const SG = streetGraph();
  STREET_GRAPH = SG;
  // (and each lamp where it stands, its side and its normal out of the road, for NOODLE ROW's lanterns)
  const lampsAt: Array<{ st: string; side: number; i: number; at: Pt; n: Pt }> = [];
  const pads = ((cfg.pads ?? []) as Array<{ pad: number[] }>).map((q) => q.pad);
  const kiosks = ((cfg.court?.halls ?? []) as Array<{ route?: number[][]; x0: number; x1: number; z0: number; z1: number }>).filter((h) => h.route);
  const clear = (x: number, z: number, r: number, st: Street): boolean =>
    onRoad(x, z, st) > D.crossing + r &&
    !(Math.hypot(x, z) > R.skyring.r0 - r - 1 && Math.hypot(x, z) < R.skyring.r1 + r + 1 && r < 2) &&
    !skyStairs.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < r + 5) &&
    Math.max(Math.abs(x), Math.abs(z)) < CV.inside - 3 &&
    !pads.some(([px, pz]) => Math.hypot(px - x, pz - z) < r + D.padClear) &&
    // (nor under a glass lift's footbridge or by its car: a street lamp's head stood across the bridge at a head's height)
    !lifts.some((q) => {
      const [ax, az, bx, bz] = [q.ring[0], q.ring[1], q.car[0], q.car[1]];
      const l2 = (bx - ax) ** 2 + (bz - az) ** 2;
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2));
      return Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t) < r + R.lifts.clear;
    }) &&
    !kiosks.some((h) => x > h.x0 - r && x < h.x1 + r && z > h.z0 - r && z < h.z1 + r);
  for (const st of STREETS)
    for (const side of [-1, 1]) {
      // the lamps on the pavement, `inset` in from the kerb, their arms across it
      for (let i = Math.round(D.lamp.every / 2 / 0.5); i < st.pts.length; i += Math.round(D.lamp.every / 0.5)) {
        const n = normalAt(st, i);
        const [x, z] = [st.pts[i][0] + n[0] * side * (st.half + D.lamp.inset), st.pts[i][1] + n[1] * side * (st.half + D.lamp.inset)];
        if (!clear(x, z, 1, st) || onRoad(x, z) < D.lamp.inset - 0.1) continue;
        // (only its post stands in a body's way, in the middle of its two arms: they are 5 m up)
        const lamp = placeTurned("c-dress", D.lamp.piece, x, z, yawToward(n[0], n[1]), "o");
        SG.add({ ...lamp, hu: 0.2, hv: 0.2 });
        lampsAt.push({ st: st.id, side, i, at: [x, z], n: [n[0] * side, n[1] * side] });
      }
      // the cars in the lane by the kerb, a seeded gap apart
      for (let u = 6 + rnd() * D.cars.gap[1]; u < st.pts.length * 0.5 - 6; u += D.cars.gap[0] + rnd() * (D.cars.gap[1] - D.cars.gap[0])) {
        if (rnd() > D.cars.chance) continue;
        const i = Math.round(u / 0.5);
        const n = normalAt(st, i);
        const t = st.tan[i];
        const [x, z] = [st.pts[i][0] + n[0] * side * (st.half - D.cars.lane), st.pts[i][1] + n[1] * side * (st.half - D.cars.lane)];
        if (!clear(x, z, 3, st)) continue;
        const pick = D.cars.pieces[Math.floor(rnd() * D.cars.pieces.length)];
        // (every `vans.every`-th car a hover van, 2.4 m high: whole cover where a parked car is half)
        const van = D.cars.vans && ++carCount % D.cars.vans.every === 0 ? D.cars.vans.pieces[carCount % D.cars.vans.pieces.length] : null;
        const yaw = yawToward(t[0], t[1]) + (rnd() < 0.5 ? 0 : 180);
        const vr = van ? piece(van).row : null;
        const name = van && vr && !SG.splits({ c: [x, z], u: rotY(yaw, 1, 0), v: rotY(yaw, 0, 1), hu: vr.size![0] / 2, hv: vr.size![2] / 2, top: vr.size![1] }) ? van : pick;
        SG.add(placeTurned("c-dress", name, x, z, yaw, "o", -piece(name).row.min![1]));
      }
    }
  // a broken median down every street (rules.dress.median; the second review: "street cover is a lamp post and a kiosk",
  // cover every 8 to 12 m): the pack's 5 m concrete block, 1.2 m high (chest cover, and a jump or a grab to cross), every
  // `every` metres down the road's middle, turned along it, clear of the junctions, the pads, the Sky Ring's stairs and
  // the lifts as the cars are; the gaps between keep the street one network
  const MD = D.median as { piece: string; every: number; offset: number; keep: number; tall?: { piece: string; every: number } } | undefined;
  const medians: Array<{ at: number[]; yaw: number; piece?: string; half?: number[] }> = [];
  if (MD) {
    // (and none within `keep` metres of THE CENTRE's spawns and zones, the 1v1 on the Loop (src/config/centre.json, world
    // space, round its middle): they stand on the Loop's own line, and a block laid on a spawn held its bot fast)
    // (round the map's middle: THE CENTRE's x and z are the Neon map's own middle, and its bearings and distances are from it)
    const CEN = JSON.parse(readFileSync(join(ROOT, "src", "config", "centre.json"), "utf8")) as { spawnR: number; spawns: number[]; zone: { bearing: number; r: number }; zones: number[] };
    const onBearing = (b: number, r: number): Pt => [Math.sin((b * Math.PI) / 180) * r, Math.cos((b * Math.PI) / 180) * r];
    const kept: Pt[] = [...CEN.spawns.map((b) => onBearing(b, CEN.spawnR)), onBearing(CEN.zone.bearing, CEN.zone.r), ...CEN.zones.map((b) => onBearing(b, CEN.zone.r))];
    // (and never a block that cuts the bots' street graph: the model above, fed every lamp and car so far)
    let passed = 0;
    for (const st of STREETS)
      for (let i = Math.round(MD.offset / 0.5); i < st.pts.length; i += Math.round(MD.every / 0.5)) {
        const [x, z] = st.pts[i];
        // (every `tall.every`-th of them a tall piece, over a standing eye: the third review saw street sightlines past
        // 60 m, and a block 1.2 m high stops none)
        const name = MD.tall && medians.length % MD.tall.every === MD.tall.every - 1 ? MD.tall.piece : MD.piece;
        const pr = piece(name).row;
        const plen = Math.max(pr.size![0], pr.size![2]);
        if (!clear(x, z, plen / 2, st) || kept.some(([kx, kz]) => Math.hypot(kx - x, kz - z) < plen / 2 + MD.keep)) continue;
        const t = st.tan[i];
        const yaw = yawToward(t[0], t[1]) + (pr.size![2] >= pr.size![0] ? 0 : 90);
        const o: OBox = { c: [x, z], u: rotY(yaw, 1, 0), v: rotY(yaw, 0, 1), hu: pr.size![0] / 2, hv: pr.size![2] / 2, top: pr.size![1] };
        if (SG.splits(o)) {
          passed++;
          continue;
        }
        SG.add(o);
        placeFaced("c-dress", name, x, z, yaw, "o", -pr.min![1]);
        if (name === MD.tall?.piece) dressBoard("c-dress", name, x, z, yaw, 0);
        medians.push({ at: [+x.toFixed(3), +z.toFixed(3)], yaw: +yaw.toFixed(2), ...(name !== MD.piece ? { piece: name, half: [+(pr.size![0] / 2).toFixed(3), +(pr.size![2] / 2).toFixed(3)] } : {}) });
      }
    console.log(`the streets' median: ${passed} blocks passed over where they would cut the bots' street graph`);
    cfg.medians = medians;
    console.log(`the streets' median: ${medians.length} blocks`);
  }
  // NOODLE ROW's lantern canopy (rules.low.lanterns; the second review: the corner blocks interchangeable at street
  // level): along its `streets` where they run beside the block (`beside`, metres out along each street's own axis), a
  // cable from each lamp's head over the road to the head of the lamp across, and on to the next pair's in an X, the pack's
  // Chinese lanterns hung from each every `every` metres, `height` up; drawn only, over the road, so nothing below moves
  const LN = R.low.lanterns as { block: string; streets: string[]; beside: number[]; cable: string; lanterns: string[]; height: number; every: number; head: number } | undefined;
  if (LN) {
    const [bx, bz] = LN.block.split(",").map(Number);
    const chunk = `c-${bz < 0 ? "n" : "s"}${bx < 0 ? "w" : "e"}`;
    const cable = piece(LN.cable).row;
    const clen = Math.max(cable.size![0], cable.size![2]);
    let hung = 0, cables = 0;
    const string = (a: Pt, b: Pt) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      placeTurned(chunk, LN.cable, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, yawToward(b[0] - a[0], b[1] - a[1]), "g", LN.height, undefined, L / clen);
      cables++;
      for (let t = LN.every / 2; t < L; t += LN.every) {
        placeTurned(chunk, LN.lanterns[hung % LN.lanterns.length], a[0] + ((b[0] - a[0]) * t) / L, a[1] + ((b[1] - a[1]) * t) / L, 0, "g", LN.height);
        hung++;
      }
    };
    for (const id of LN.streets) {
      const mine = lampsAt.filter((q) => q.st === id && (() => { const v = id.endsWith("n") || id.endsWith("s") ? Math.abs(q.at[1]) : Math.abs(q.at[0]); return v > LN.beside[0] && v < LN.beside[1]; })());
      // (each lamp's head over the road: `head` metres from its post toward the road)
      const head = (q: (typeof mine)[number]): Pt => [q.at[0] - q.n[0] * LN.head, q.at[1] - q.n[1] * LN.head];
      const byI = new Map<number, Record<number, (typeof mine)[number]>>();
      for (const q of mine) (byI.get(q.i) ?? byI.set(q.i, {}).get(q.i)!)[q.side] = q;
      const pairs = [...byI.entries()].filter(([, sides]) => sides[-1] && sides[1]).sort((a, b) => a[0] - b[0]);
      pairs.forEach(([, sides], k) => {
        string(head(sides[-1]), head(sides[1]));
        const next = pairs[k + 1]?.[1];
        if (next) {
          string(head(sides[-1]), head(next[1]));
          string(head(sides[1]), head(next[-1]));
        }
      });
    }
    cfg.lanterns = { cables, lanterns: hung };
    console.log(`${LN.block}'s lantern canopy: ${cables} cables, ${hung} lanterns`);
  }
  // the edge road's parked cars (rules.dress.edge; the third review: "streets end on flat plain and the boundary fence"):
  // its four straight sides, cars by both kerbs a seeded gap apart (every `vans.every`-th a hover van) as on the curves,
  // none within `junction` metres of a street joining it or of a corner, nor by a jump pad as the curves' cars are not
  // (one parked on the north deck's outer pad moved the pad 20 m at the bake), and never where they would cut the bots'
  // graph.
  // No median: the bots' graph has one row of nodes down its middle, the boundary's fence beyond, and every block there
  // cut it
  const ED = D.edge as { junction: number; seed: number } | undefined;
  if (ED) {
    const rndE = seeded(ED.seed);
    const mid = (R.ring[0] + R.ring[1]) / 2, half = (R.ring[1] - R.ring[0]) / 2;
    const ends: Pt[] = (CV.spokes as Array<{ to: Pt }>).map((q) => q.to);
    let edgeCars = 0;
    for (const [a, b] of [[[-mid, -mid], [mid, -mid]], [[mid, -mid], [mid, mid]], [[mid, mid], [-mid, mid]], [[-mid, mid], [-mid, -mid]]] as Array<[Pt, Pt]>) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const tan: Pt = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
      const nrm: Pt = [-tan[1], tan[0]];
      const at = (u: number): Pt => [a[0] + tan[0] * u, a[1] + tan[1] * u];
      const free = (q: Pt, r: number) => ends.every((e) => Math.hypot(e[0] - q[0], e[1] - q[1]) > ED.junction + r) && Math.hypot(q[0] - a[0], q[1] - a[1]) > ED.junction + half && Math.hypot(q[0] - b[0], q[1] - b[1]) > ED.junction + half;
      for (const side of [-1, 1])
        for (let u = 6 + rndE() * D.cars.gap[1]; u < L - 6; u += D.cars.gap[0] + rndE() * (D.cars.gap[1] - D.cars.gap[0])) {
          if (rndE() > D.cars.chance) continue;
          const c0 = at(u);
          const q: Pt = [c0[0] + nrm[0] * side * (half - D.cars.lane), c0[1] + nrm[1] * side * (half - D.cars.lane)];
          if (!free(q, 3) || pads.some(([px, pz]) => Math.hypot(px - q[0], pz - q[1]) < 3 + D.padClear)) continue;
          const pick = D.cars.pieces[Math.floor(rndE() * D.cars.pieces.length)];
          const name = D.cars.vans && ++carCount % D.cars.vans.every === 0 ? D.cars.vans.pieces[carCount % D.cars.vans.pieces.length] : pick;
          const crow = piece(name).row;
          const yaw = yawToward(tan[0], tan[1]) + (rndE() < 0.5 ? 0 : 180);
          const o: OBox = { c: q, u: rotY(yaw, 1, 0), v: rotY(yaw, 0, 1), hu: crow.size![0] / 2, hv: crow.size![2] / 2, top: crow.size![1] };
          if (STREET_GRAPH?.splits(o)) continue;
          STREET_GRAPH?.add(o);
          placeTurned("c-dress", name, q[0], q[1], yaw, "o", -crow.min![1]);
          edgeCars++;
        }
    }
    console.log(`the edge road: ${edgeCars} parked cars`);
  }
  // the flying cars, over the streets out of reach
  for (let k = 0; k < D.flying.count; k++) {
    const st = STREETS[Math.floor(rnd() * STREETS.length)];
    const i = Math.floor(rnd() * st.pts.length);
    const n = normalAt(st, i);
    const off = (rnd() - 0.5) * st.half;
    const y = D.flying.height[0] + rnd() * (D.flying.height[1] - D.flying.height[0]);
    const t = st.tan[i];
    placeTurned("c-dress", D.flying.pieces[Math.floor(rnd() * D.flying.pieces.length)], st.pts[i][0] + n[0] * off, st.pts[i][1] + n[1] * off, yawToward(t[0], t[1]) + (rnd() < 0.5 ? 0 : 180), "g", y);
  }
}

// High City's roofs joined (rules.bridges): the pack's floating bridge decks from one island's roof to the next, over
// the street crossing between them, a rooftop circuit round the tower (the High City trailer has its roofs joined so).
// Each path a line of 5 m cells: straights along its legs and the pack's corner where it turns, turned so its open
// sides face both legs (their own decks are at different heights in their own frames, measured: the straight's at 0, the
// corner's at 1 m). The islands are round-lobed and fenced all round with the pack's crystal fence, and a 5 m deck
// always crosses a lobe's arc on a slant: the arc left out opened the roof's edge beside the bridge, and kept stood
// across the way. So nothing of an island is cut. The decks ride at the fence's top, where a bridge crosses the fence
// it is inside the deck's own 2 m body and the island's edge stays closed, and each end runs on into its island and
// steps down to the roof by the pack's small stair (its ramp climbs 0.5 m of the 0.9: the deck is a step over its top)
{
  const B = R.bridges;
  const [straight, corner, stair] = [piece(B.straight.piece).row, piece(B.corner.piece).row, piece(B.stairs.piece).row];
  const cell = straight.size![0];
  /** a piece's turn about y as the bake turns it: its own (x, z) onto the map's */
  const rot = (yaw: number, x: number, z: number): [number, number] => {
    const a = (yaw * Math.PI) / 180;
    const [c, s] = [Math.round(Math.cos(a)), Math.round(Math.sin(a))];
    return [c * x + s * z, -s * x + c * z];
  };
  const same = (p: number[], q: number[]) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6;
  const put = (name: string, y: number, yaw: number, [cx, cz]: number[], mid: [number, number]) => {
    const [ox, oz] = rot(yaw, ...mid);
    add("c-bridges", "c", [piece(name).key, +(cx - ox).toFixed(3), +y.toFixed(3), +(cz - oz).toFixed(3), yaw, "o"] as Place);
  };
  // (the straight's middle in its own frame: it runs along its own x from its pivot; the corner's, back along its -x)
  const sMid: [number, number] = [(straight.min![0] + straight.max![0]) / 2, (straight.min![2] + straight.max![2]) / 2];
  const cMid: [number, number] = [(corner.min![0] + corner.max![0]) / 2, (corner.min![2] + corner.max![2]) / 2];
  // the stair's top edge in its own frame: the middle of its side toward `up`, the way it climbs
  const up = B.stairs.up as number[];
  const tMid: [number, number] = [
    up[0] ? (up[0] > 0 ? stair.max![0] : stair.min![0]) : (stair.min![0] + stair.max![0]) / 2,
    up[1] ? (up[1] > 0 ? stair.max![2] : stair.min![2]) : (stair.min![2] + stair.max![2]) / 2,
  ];
  if (B.deck < B.fence + 0.02) throw new Error(`the decks at ${B.deck} m do not clear the islands' fence, ${B.fence} m`);
  // (the stair's ramp tops out under its cheeks: its climb is measured, rules.bridges.stairs.rise, not its bounds)
  if (B.deck - B.roof - B.stairs.rise > B.stairs.step) throw new Error(`the stair climbs ${B.stairs.rise} m and the deck is ${(B.deck - B.roof).toFixed(2)} m over the roof: a step of more than ${B.stairs.step} m at its top`);
  let decks = 0;
  for (const path of B.paths as number[][][]) {
    for (let i = 0; i + 1 < path.length; i++) {
      const [a, b] = [path[i], path[i + 1]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      const yaw = Math.abs(d[0]) > 0.5 ? 0 : 90;
      const from = i === 0 ? cell / 2 : cell;
      const to = i + 2 === path.length ? len - cell / 2 : len - cell;
      for (let t = from; t <= to + 1e-6; t += cell) (put(B.straight.piece, B.deck - B.straight.deck, yaw, [a[0] + d[0] * t, a[1] + d[1] * t], sMid), decks++);
      // the corner at the far end of every leg but the last, its open sides toward this leg and the next
      if (i + 2 < path.length) {
        const c = path[i + 2];
        const len2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
        const on = [(c[0] - b[0]) / len2, (c[1] - b[1]) / len2];
        const cyaw = [0, 90, 180, 270].find((y) => {
          const opens = [rot(y, 1, 0), rot(y, 0, 1)];
          return opens.some((o) => same(o, [-d[0], -d[1]])) && opens.some((o) => same(o, on));
        })!;
        put(B.corner.piece, B.deck - B.corner.deck, cyaw, b, cMid);
        decks++;
      }
    }
    // a stair at each end, on the roof, climbing toward the deck, its top edge at the deck's end
    for (const [e, n] of [[path[0], path[1]], [path[path.length - 1], path[path.length - 2]]]) {
      const l = Math.hypot(n[0] - e[0], n[1] - e[1]);
      const toward = [(n[0] - e[0]) / l, (n[1] - e[1]) / l];
      const syaw = [0, 90, 180, 270].find((y) => same(rot(y, up[0], up[1]), toward))!;
      put(B.stairs.piece, B.roof - stair.min![1], syaw, e, tMid);
    }
  }
  console.log(`bridges: ${decks} decks on ${B.paths.length} paths, a stair at each of their ${B.paths.length * 2} ends`);
}

// The fronts along the centre's streets and its ring hung with the pack's neon signs (rules.signs): found in the last
// bake's collision (src/config/neon/neonmap.solids.json; a sign changes no building's): from the pavement, at a sign's
// height, straight at the block to the first front within `reach`, kept where the front is flat across the sign's width
// and `apart` from the last on that side. A sign is lit on one side only, its own +z (from behind its letters read
// mirrored in bare metal), so it hangs with that side to the street; it collides with nothing
{
  const S = R.signs;
  const boxes = lastSolids();
  /** how far from (x, z) along the unit (dx, dz) the first box standing across height y is, within `reach` */
  const faceAt = (x: number, z: number, dx: number, dz: number, y: number): number => {
    let best = Infinity;
    for (const [x0, x1, z0, z1, y0, y1] of boxes) {
      if (y0 > y || y1 < y) continue;
      let t0 = 0, t1 = S.reach + 1;
      for (const [o, d, lo, hi] of [[x, dx, x0, x1], [z, dz, z0, z1]]) {
        if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) t0 = Infinity; continue; }
        let [a, b] = [(lo - o) / d, (hi - o) / d];
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, b);
      }
      if (t0 <= t1 && t0 < best) best = t0;
    }
    return best;
  };
  // each street's two sides, and the ring road's inner side as four straight lines
  const lines: Array<{ st: Street; sides: number[] }> = STREETS.map((st) => ({ st, sides: [-1, 1] }));
  const rc = (R.ring[0] + R.ring[1]) / 2, rh = (R.ring[1] - R.ring[0]) / 2, e = R.ring[0];
  for (const [a, b] of [[[-e, -rc], [e, -rc]], [[rc, -e], [rc, e]], [[e, rc], [-e, rc]], [[-rc, e], [-rc, -e]]] as Array<[Pt, Pt]>) {
    const pts: Pt[] = [];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = 0; t <= L; t += 0.5) pts.push([a[0] + ((b[0] - a[0]) * t) / L, a[1] + ((b[1] - a[1]) * t) / L]);
    const tan: Pt = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    const st: Street = { id: "ring", closed: false, pts, tan: pts.map(() => tan), half: rh };
    // (the side toward the middle)
    const n = normalAt(st, 0);
    lines.push({ st, sides: [Math.sign(-(n[0] * a[0] + n[1] * a[1])) || 1] });
  }
  let hung = 0;
  const signsAt: Array<{ piece: string; at: Pt }> = [];
  for (const { st, sides } of lines)
    for (const side of sides) {
      let lastU = -Infinity;
      for (let i = 4; i < st.pts.length - 4; i += Math.round(S.step / 0.5)) {
        const u = i * 0.5;
        if (u - lastU < S.apart || rnd() > S.chance) continue;
        const n = normalAt(st, i);
        const dir: Pt = [n[0] * side, n[1] * side];
        const q: Pt = [st.pts[i][0] + dir[0] * (st.half + 1), st.pts[i][1] + dir[1] * (st.half + 1)];
        if (onRoad(q[0], q[1]) < 0.5 && st.id !== "ring") continue;
        // (not a corner block's own sign, so MOTEL is MOTEL HILL's alone, and never one `twin` metres or nearer to the
        // same sign: drawn at random from the pack's fifteen, the second review saw one in four places. One draw a sign,
        // stepped on through the rest where it is too near its twin)
        const own = new Set(Object.values((R.low.identity?.signs ?? {}) as Record<string, { piece: string }>).map((q) => q.piece));
        const pool = (S.pieces as string[]).filter((p) => !own.has(p.split("/").pop()!));
        const k0 = Math.floor(rnd() * pool.length);
        // (the front's point the sign would hang on, to measure it against the others' faces; no sign where every one
        // left has its twin near)
        const fq: Pt = [q[0] + dir[0] * faceAt(q[0], q[1], dir[0], dir[1], S.height[0]), q[1] + dir[1] * faceAt(q[0], q[1], dir[0], dir[1], S.height[0])];
        let name = "";
        for (let d = 0; d < pool.length && !name; d++) {
          const cand = pool[(k0 + d) % pool.length];
          if (!signsAt.some((o) => o.piece === cand && Math.hypot(o.at[0] - fq[0], o.at[1] - fq[1]) < (S.twin ?? 0))) name = cand;
        }
        if (!name) continue;
        const row = piece(name).row;
        const w = row.size![0];
        const y = S.height[0] + rnd() * (S.height[1] - S.height[0]);
        const d = faceAt(q[0], q[1], dir[0], dir[1], y);
        if (d > S.reach) continue;
        // flat across its width: the front as near at each end as in the middle
        const t = st.tan[i];
        const ends = [-w / 2, w / 2].map((o) => faceAt(q[0] + t[0] * o, q[1] + t[1] * o, dir[0], dir[1], y));
        if (ends.some((f) => Math.abs(f - d) > S.flat)) continue;
        // hung with its +z toward the street, the middle of its back on the front
        const yaw = yawToward(-dir[0], -dir[1]);
        const [bx, bz] = rotY(yaw, (row.min![0] + row.max![0]) / 2, row.min![2]);
        const f: Pt = [q[0] + dir[0] * d, q[1] + dir[1] * d];
        add("c-signs", "c", [piece(name).key, +(f[0] - bx).toFixed(3), +(y - (row.min![1] + row.max![1]) / 2).toFixed(3), +(f[1] - bz).toFixed(3), +yaw.toFixed(2), "g"] as Place);
        signsAt.push({ piece: name, at: [f[0], f[1]] });
        lastU = u;
        hung++;
      }
    }
  console.log(`signs: ${hung} hung on the fronts`);
}

// High City's signs (rules.high.signs; the master plan's item 7, "a sign seen from the street" on each block): one of the
// pack's neon signs `scale` times its size on each island's face to the Loop, `up` over the street, hung on the face at
// `at` along it, where the face is flat across the sign's width (measured off the last bake: the faces between the lobes
// stand at 59.5 m, the pads launch up the lobes and the glass lifts ride the flats beside them). The deck's own edge has
// no room for one, its pad, lift, zip and bridges' clearances taking all of it. Drawn only: it hangs out of reach
{
  const HS = R.high.signs as { up: number; flat: number; reach: number } & Record<string, { piece: string; scale: number; at: number; flat?: number }> | undefined;
  if (HS) {
    const boxes = lastSolids();
    const faceAt = (x: number, z: number, dx: number, dz: number, y: number): number => {
      let best = Infinity;
      for (const [x0, x1, z0, z1, y0, y1] of boxes) {
        if (y0 > y || y1 < y) continue;
        let t0 = 0, t1 = HS.reach;
        for (const [o, d, lo, hi] of [[x, dx, x0, x1], [z, dz, z0, z1]]) {
          if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) t0 = Infinity; continue; }
          let [a, b] = [(lo - o) / d, (hi - o) / d];
          if (a > b) [a, b] = [b, a];
          t0 = Math.max(t0, a);
          t1 = Math.min(t1, b);
        }
        if (t0 <= t1 && t0 < best) best = t0;
      }
      return best;
    };
    const out: Array<{ block: string; at: number[]; yaw: number; piece: string; w: number; h: number }> = [];
    for (const dir of ["n", "s", "w", "e"] as const) {
      const q = HS[dir];
      if (!q) continue;
      // (toward the island from the Loop, and along its face)
      const inward: Pt = dir === "n" ? [0, -1] : dir === "s" ? [0, 1] : dir === "w" ? [-1, 0] : [1, 0];
      const along: Pt = [Math.abs(inward[1]), Math.abs(inward[0])];
      const from = R.high.face - HS.reach / 2;
      const o: Pt = [along[0] * q.at + inward[0] * from, along[1] * q.at + inward[1] * from];
      const { key, row } = piece(q.piece);
      const [w, h] = [row.size![0] * q.scale, row.size![1] * q.scale];
      const d = faceAt(o[0], o[1], inward[0], inward[1], HS.up);
      const ends = [-w / 2, w / 2].flatMap((e) => [HS.up - h / 2, HS.up + h / 2].map((y) => faceAt(o[0] + along[0] * e, o[1] + along[1] * e, inward[0], inward[1], y)));
      if (!Number.isFinite(d) || ends.some((f) => Math.abs(f - d) > (q.flat ?? HS.flat))) throw new Error(`High City's ${dir} sign: the face is not flat across it at ${q.at} (${d.toFixed(2)}; ${ends.map((f) => f.toFixed(2)).join(", ")})`);
      // (hung with its lit +z to the Loop, the middle of its back on the face, its middle `up` high)
      const yaw = yawToward(-inward[0], -inward[1]);
      const [bx, bz] = rotY(yaw, ((row.min![0] + row.max![0]) / 2) * q.scale, row.min![2] * q.scale);
      const f: Pt = [o[0] + inward[0] * d, o[1] + inward[1] * d];
      const y = HS.up - ((row.min![1] + row.max![1]) / 2) * q.scale;
      add(`c-${dir}`, "c", [key, +(f[0] - bx).toFixed(3), +y.toFixed(3), +(f[1] - bz).toFixed(3), +yaw.toFixed(2), "g", null, null, q.scale] as unknown as Place);
      out.push({ block: dir, at: [+f[0].toFixed(2), HS.up, +f[1].toFixed(2)], yaw: +yaw.toFixed(2), piece: q.piece, w: +w.toFixed(2), h: +h.toFixed(2) });
    }
    cfg.highSigns = out;
    console.log(`High City's signs: ${out.map((q) => `${q.block} ${q.piece.replace(".prefab", "")} ${q.w} by ${q.h} m`).join(", ")}`);
  }
}

// The kerbs along the roads' edges and the dashed lines down their middles. In the centre the edge is traced where the
// curved roads' surface ends (its rounded junctions too), a kerb every piece's length, its body on the pavement side;
// outside it, along the outer districts' straight roads as before
{
  const K = R.streets.kerb;
  const edge = R.extent;
  const chunkAt = (x: number, z: number) => (sectorAt(x, z) === "c" ? "c-ground" : `ground-${sectorAt(x, z)}`);
  const kerb = piece(K.piece).row;
  const klen = kerb.size![2];
  const pads = ((cfg.pads ?? []) as Array<{ pad: number[] }>).map((q) => q.pad);
  const inside = CV.inside;
  let kerbs = 0;
  for (const c of contours((x, z) => onRoad(x, z), -inside, inside, -inside, inside, CV.trace))
    for (const { p, t } of along(c.pts, c.closed, klen)) {
      if (Math.max(Math.abs(p[0]), Math.abs(p[1])) > inside - 1 || pads.some(([px, pz]) => Math.hypot(px - p[0], pz - p[1]) < 2)) continue;
      // the way into the road: across the edge toward where the surface is
      const e = 0.3;
      const n: Pt = [-t[1], t[0]];
      const toRoad: Pt = onRoad(p[0] + n[0] * e, p[1] + n[1] * e) < onRoad(p[0] - n[0] * e, p[1] - n[1] * e) ? n : [-n[0], -n[1]];
      // (its own +x, the edge its pivot is on, toward the road: its body on the pavement)
      const yaw = (Math.atan2(-toRoad[1], toRoad[0]) * 180) / Math.PI;
      add("c-ground", "c", [piece(K.piece).key, +p[0].toFixed(3), 0, +p[1].toFixed(3), +yaw.toFixed(2), "g"] as Place);
      kerbs++;
    }
  // (outside the centre: the straight roads' kerbs as they were)
  const C = R.streets.centres as number[];
  const hw = R.streets.road / 2;
  for (const c of C)
    for (const side of [-1, 1]) {
      const at = c + side * hw;
      for (let u = -edge + K.every / 2; u < edge; u += K.every) {
        if (Math.abs(u) < R.ring[0]) continue;
        if (!road(at + side * 0.5, u)) placeAt(chunkAt(at, u), sectorAt(at, u), K.piece, at, u, 0, "g");
        if (!road(u, at + side * 0.5)) placeAt(chunkAt(u, at), sectorAt(u, at), K.piece, u, at, 90, "g");
      }
    }
  // the centre lines: a dash every `every` metres down each curved street, none in a junction
  const line = piece(R.streets.line.piece).row;
  const dash = line.size![0];
  let dashes = 0;
  for (const st of STREETS)
    for (const { p, t } of along(st.pts, st.closed, R.streets.line.every)) {
      if (onRoad(p[0], p[1], st) < 2 || Math.max(Math.abs(p[0]), Math.abs(p[1])) > inside - dash / 2) continue;
      // (its own x along the street, from its pivot back: the pivot half a dash on from its middle)
      // (on the baked surface, not under it)
      add("c-ground", "c", [piece(R.streets.line.piece).key, +(p[0] + (t[0] * dash) / 2).toFixed(3), CV.surface.y + 0.01, +(p[1] + (t[1] * dash) / 2).toFixed(3), +((Math.atan2(-t[1], t[0]) * 180) / Math.PI).toFixed(2), "g"] as Place);
      dashes++;
    }
  const [r0, r1] = R.ring;
  const crossing = (u: number) => C.some((q) => Math.abs(u - q) < hw + 1) || (Math.abs(u) > r0 - 1 && Math.abs(u) < r1 + 1);
  for (const c of C)
    for (let u = -edge + R.streets.line.every / 2; u < edge; u += R.streets.line.every) {
      if (crossing(u) || Math.abs(u) < r0) continue;
      placeAt(chunkAt(c, u), sectorAt(c, u), R.streets.line.piece, c, u, 90, "g");
      placeAt(chunkAt(u, c), sectorAt(u, c), R.streets.line.piece, u, c, 0, "g");
    }
  console.log(`streets: ${STREETS.length} curved (${STREETS.map((q) => `${q.id} ${(q.pts.length * 0.5).toFixed(0)} m`).join(", ")}), ${kerbs} kerbs and ${dashes} dashes along them`);
}

// the zip lines (rules.low.zip, the master plan's "more ways up"): from each rooms building's roof yard to the deck of a
// High City island beside its block, the shortest rope that stands `over` metres above both ends and leaves a hanging
// body's room (movement.json ziplineHang under it, a body's radius round it) clear of the last bake's collision all
// along it, within `reach` metres; ridden as any zipline is, up or down (src/game/neonmap.ts draws it)
{
  const Z = R.low.zip as { over: number; reach: number; run: number; decks: Record<string, string[]>; colours: Record<string, string>; lookout?: { perch: string; decks: string[]; colour: string; over: number; inset: number; raised: number; apart: number; clear: number } } | undefined;
  if (Z && existsSync(SOLIDS_FILE)) {
    const S = lastSolids();
    const MV = JSON.parse(readFileSync(join(ROOT, "src", "config", "movement.json"), "utf8"));
    const [hang, rad] = [MV.ziplineHang * 0.0254, MV.radius * 0.0254];
    const B = R.blocks;
    const deck = (d: string): number[] => {
      const far = d === "n" || d === "w" ? [-B.outer[1], -B.outer[0]] : [B.outer[0], B.outer[1]];
      return d === "n" || d === "s" ? [B.inner[0], B.inner[1], far[0], far[1]] : [far[0], far[1], B.inner[0], B.inner[1]];
    };
    const topAt = (x: number, z: number) => {
      let t = -Infinity;
      for (const b of S) if (x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && b[5] >= 24 && b[5] <= 30 && b[5] > t) t = b[5];
      return t;
    };
    const clearRope = (a: number[], b: number[]) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      for (let d = 2; d < L - 2; d += 0.5) {
        const [x, y, z] = [0, 1, 2].map((k) => a[k] + ((b[k] - a[k]) * d) / L);
        for (const q of S) if (q[0] < x + rad && q[1] > x - rad && q[2] < z + rad && q[3] > z - rad && q[4] < y + 0.2 && q[5] > y - hang - 0.1) return false;
      }
      return true;
    };
    const zips: Array<{ block: string; a: number[]; b: number[]; colour: string }> = [];
    for (const y of yards) {
      if (!Z.decks[y.block]) continue;
      const b = [(y.inside[0] + y.inside[1]) / 2, y.y + Z.over, (y.inside[2] + y.inside[3]) / 2];
      let best: { a: number[]; L: number } | null = null;
      for (const d of Z.decks[y.block] ?? []) {
        const [x0, x1, z0, z1] = deck(d);
        for (let x = x0 + 1; x < x1; x += 1)
          for (let z = z0 + 1; z < z1; z += 1) {
            const top = topAt(x, z);
            if (top === -Infinity) continue;
            const a = [x, top + Z.over, z];
            const L = Math.hypot(a[0] - b[0], a[2] - b[2]);
            if (L > Z.reach || (best && L >= best.L)) continue;
            // (and roof on past its end for `run` metres: off a rope's top a rider is thrown on along it)
            const [ux, uz] = [(a[0] - b[0]) / L, (a[2] - b[2]) / L];
            let roofed = true;
            for (let k = 1; k <= Z.run && roofed; k += 1) if (topAt(x + ux * k, z + uz * k) < top - 1) roofed = false;
            if (!roofed || !clearRope(a, b)) continue;
            best = { a, L };
          }
      }
      if (!best) {
        console.log(`no clear zip line from the ${y.block} block's roof yard within ${Z.reach} m`);
        continue;
      }
      zips.push({ block: y.block, a: best.a.map((v) => +v.toFixed(3)), b: b.map((v) => +v.toFixed(3)), colour: Z.colours[y.block] });
    }
    // (and from the tower's lookout, `lookout`: the roof of its east block at 49 m, the perch of that name, reached only by
    // a pad, down to each High City deck named: the fourth review found no way between the two ("zip lines from the
    // lookout to the decks: there are none"). Its end on the deck is `a`, as the others' are, on flat floor (a rail's top
    // in the deck's heights dropped the first rider through to the street), and at the lookout `b`, on the lookout's side
    // facing the deck, `inset` in, `over` the highest of its roof under it: the roof is broken by raised parts and a
    // parapet `raised` over its floor, and a rider hangs 2.13 m under a rope, so one ended over the floor high enough to
    // clear them dropped off its end and was thrown 10 to 22 m, off the far side; ended over the parapet the rider touches
    // down at the end as on the decks. The shortest rope clear from its start on (of the roof under that end), with roof
    // on past each end)
    const LK = Z.lookout;
    const PCH = LK ? ((R.perches ?? []) as Array<{ name: string; y: number[]; box: number[] }>).find((q) => q.name === LK.perch) : undefined;
    if (LK && !PCH) throw new Error(`no perch ${LK.perch} for the lookout's zip lines`);
    if (LK && PCH) {
      const [lx0, lx1, lz0, lz1] = PCH.box;
      const roofAt = (x: number, z: number) => {
        let t = -Infinity;
        for (const q of S) if (x >= q[0] && x <= q[1] && z >= q[2] && z <= q[3] && q[5] >= PCH.y[0] - 0.3 && q[5] <= PCH.y[1] + LK.raised && q[5] > t) t = q[5];
        return t;
      };
      for (const d of LK.decks) {
        const [x0, x1, z0, z1] = deck(d);
        const side: number[][] = [];
        const n0 = LK.inset;
        for (let u = 1.5; u <= (d === "n" || d === "s" ? lx1 - lx0 : lz1 - lz0) - 1.5; u += 1)
          side.push(d === "n" ? [lx0 + u, lz0 + n0] : d === "s" ? [lx0 + u, lz1 - n0] : d === "e" ? [lx1 - n0, lz0 + u] : [lx0 + n0, lz0 + u]);
        const flat = (x: number, z: number, t: number) => [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]].every(([dx, dz]) => Math.abs(topAt(x + dx, z + dz) - t) < 0.05);
        const clearFrom = (b: number[], a: number[], roof: number) => {
          const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
          for (let t = 0.3; t < L - 2; t += 0.25) {
            const [x, y, z] = [0, 1, 2].map((k) => b[k] + ((a[k] - b[k]) * t) / L);
            for (const q of S) if (q[5] > roof + 0.05 && q[0] < x + rad && q[1] > x - rad && q[2] < z + rad && q[3] > z - rad && q[4] < y + 0.2 && q[5] > y - hang - 0.1) return false;
          }
          return true;
        };
        // (its deck end `apart` metres from every other way on or off the deck: a rider grabs the nearest rope in reach, and
        // ends on the inner edges facing the tower stood at the glass lifts' landings, so the lifts' riders went up to the
        // lookout instead of down to their cars)
        const ways: number[][] = [
          ...lifts.flatMap((q) => [q.land, [q.rope[1][0], q.rope[1][2]]]),
          ...((cfg.pads ?? []) as Array<{ face: number[]; pad: number[] }>).flatMap((q) => [q.face, q.pad]),
          ...((R.bridges?.paths ?? []) as number[][][]).flatMap((p) => [p[0], p[p.length - 1]]),
          ...zips.flatMap((q) => [[q.a[0], q.a[2]], [q.b[0], q.b[2]]]),
        ];
        const apart = (x: number, z: number) => ways.every((w) => Math.hypot(w[0] - x, w[1] - z) >= LK.apart);
        let best: { a: number[]; b: number[]; L: number } | null = null;
        for (const [bx, bz] of side) {
          const top = roofAt(bx, bz);
          if (top === -Infinity) continue;
          const b = [bx, top + LK.over, bz];
          const cand: Array<{ a: number[]; L: number }> = [];
          for (let x = x0 + 1; x < x1; x += 1)
            for (let z = z0 + 1; z < z1; z += 1) {
              const t2 = topAt(x, z);
              if (t2 === -Infinity || !flat(x, z, t2) || !apart(x, z)) continue;
              const L = Math.hypot(x - bx, z - bz);
              if (L <= Z.reach) cand.push({ a: [x, t2 + Z.over, z], L });
            }
          cand.sort((p, q) => p.L - q.L);
          for (const { a, L } of cand) {
            if (best && L >= best.L) break;
            // (roof on past both ends along the rope: a rider is thrown on off either)
            const [ux, uz] = [(a[0] - bx) / L, (a[2] - bz) / L];
            let roofed = true;
            for (let k = 1; k <= Z.run && roofed; k += 1) if (topAt(a[0] + ux * k, a[2] + uz * k) < a[1] - Z.over - 1 || roofAt(bx - ux * k, bz - uz * k) < top - 1) roofed = false;
            if (!roofed || !clearFrom(b, a, top)) continue;
            best = { a, b, L };
            break;
          }
        }
        if (!best) {
          console.log(`no clear zip line from the lookout to the ${d} deck within ${Z.reach} m`);
          continue;
        }
        zips.push({ block: `lookout-${d}`, a: best.a.map((v) => +v.toFixed(3)), b: best.b.map((v) => +v.toFixed(3)), colour: LK.colour });
      }
    }
    cfg.zips = zips;
    console.log(`zip lines: ${zips.map((q) => `${q.block} ${Math.hypot(q.a[0] - q.b[0], q.a[2] - q.b[2]).toFixed(1)} m`).join(", ")}`);
  }
}
// each corner block's own light (rules.low.beam, the master plan's colour a block): the pack's beam of light in the pack
// material of the block's colour, up from its rooms building's roof yard, or up the Well from its bottom, so where it
// is and where its own loot lies show from anywhere; drawn only, nothing to stand on
{
  const BM = R.low.beam as { piece: string; mats: Record<string, string> } | undefined;
  if (BM) {
    const bp = piece(BM.piece);
    for (const b of beams) add(b.chunk, "c", [bp.key, +b.x.toFixed(3), b.y, +b.z.toFixed(3), 0, "g", BM.mats[b.block]] as Place);
    cfg.beams = beams.map((b) => ({ block: b.block, at: [+b.x.toFixed(3), b.y, +b.z.toFixed(3)], mat: BM.mats[b.block] }));
  }
}
// cover on the high perches (rules.perches): the tower's crown at 109 m and its east block's lookout at 49 m, each reached
// by a pad, with a few of the pack's cooling units and crates to fight round (the owner, 2026-10-02: a high spot "a super
// superior spot" a squad can still take). On the last bake's collision: each piece's footprint level at the perch's
// height, `edge` metres off any drop, `apart` from the others and 3 m off where a pad lands
{
  const PR = R.perches as Array<{ name: string; y: number[]; box: number[]; count: number; pieces: string[]; edge: number; apart: number; seed: number; face?: string; near?: number }> | undefined;
  if (PR && existsSync(SOLIDS_FILE)) {
    const S = lastSolids();
    const G = 2;
    const grid = new Map<string, number[][]>();
    for (const b of S)
      for (let i = Math.floor(b[0] / G); i <= Math.floor(b[1] / G); i++)
        for (let j = Math.floor(b[2] / G); j <= Math.floor(b[3] / G); j++) (grid.get(`${i},${j}`) ?? grid.set(`${i},${j}`, []).get(`${i},${j}`)!).push(b);
    // (the roof and what is built on it, not the cover the layout before this stood on it, which the last bake measured:
    // a crate on the roof came out as one box with the roof under it, and counting it would move this layout's pieces;
    // under where one stood, by the last layout's own list (cfg.perches as it was: each piece's middle, its half-extents
    // and its height), a box no taller than that piece is the roof, over the piece's whole footprint (a 6 m billboard's
    // own posts, cleared only round its middle, made its spot uneven and moved it the next time). A beam at knee height
    // under the roof room is nowhere a piece stood, and counts)
    const stood = ((cfg.perches ?? []) as Array<{ at: number[][] }>).flatMap((q) => q.at.map(([x, , z, , hx, hz, h]) => [x, z, hx ?? 1.3, hz ?? 1.3, h ?? 2.2]));
    const topAt = (x: number, z: number, floor: number[]) =>
      (grid.get(`${Math.floor(x / G)},${Math.floor(z / G)}`) ?? []).reduce((t, b) => {
        if (!(x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3])) return t;
        const under = stood.some(([sx, sz, hx, hz, h]) => Math.abs(sx - x) < hx + 0.3 && Math.abs(sz - z) < hz + 0.3 && b[5] <= floor[1] + h + 0.3);
        const top = under ? Math.min(b[5], (floor[0] + floor[1]) / 2) : b[5];
        return top > t ? top : t;
      }, -Infinity);
    const anyTop = (x: number, z: number, h: number) => (grid.get(`${Math.floor(x / G)},${Math.floor(z / G)}`) ?? []).reduce((t, b) => (b[0] < x + h && b[1] > x - h && b[2] < z + h && b[3] > z - h && b[5] > t ? b[5] : t), -Infinity);
    // (where each pad lands on the perches, as the bake finds it: the first column `face` metres high along its line, a
    // body wide, and `land` metres past it; or the way down's own spot)
    const PC = R.perches_clear as { pad: number; lift: number; bridge: number; zip: number; walk: number; stairDoor: number; fire: number };
    const lands: Array<[number, number, number]> = [];
    for (const q of (R.pads.spine?.up ?? []) as Array<{ at: number[]; to: number[]; floor: number; face: number; land: number }>) {
      if (q.floor < 10) continue;
      let t = 0;
      while (t < 40 && anyTop(q.at[0] + q.to[0] * t, q.at[1] + q.to[1] * t, R.pads.body) < q.face) t += 0.05;
      lands.push([q.at[0] + q.to[0] * (t + R.pads.body + q.land), q.at[1] + q.to[1] * (t + R.pads.body + q.land), PC.pad]);
    }
    for (const q of (R.pads.spine?.down ?? []) as Array<{ pad: number[] }>) lands.push([q.pad[0], q.pad[1], PC.pad]);
    // (and on the High City decks: where their pads land, the lifts' landings, the bridges' ends and the zips' tops, each
    // its own clearance: a bridge's stair runs on from its end)
    for (const q of ((cfg.pads ?? []) as Array<{ face: number[]; out: number[] }>)) lands.push([q.face[0] - q.out[0] * 3, q.face[1] - q.out[1] * 3, PC.pad]);
    for (const q of lifts) lands.push([q.land[0], q.land[1], PC.lift]);
    for (const path of (R.bridges?.paths ?? []) as number[][][]) for (const e of [path[0], path[path.length - 1]]) lands.push([e[0], e[1], PC.bridge]);
    for (const q of ((cfg.zips ?? []) as Array<{ a: number[] }>)) lands.push([q.a[0], q.a[2], PC.zip]);
    // (and the lookout's zip lines' ends on it, a grab's room round each: a rider comes off one at speed and is carried
    // 8 to 14 m whatever stands there, and at the decks' 4 m three ends left the lookout one crate)
    for (const q of ((cfg.zips ?? []) as Array<{ block: string; b: number[] }>).filter((z) => z.block.startsWith("lookout"))) lands.push([q.b[0], q.b[2], (R.low.zip.lookout as { clear: number }).clear]);
    // (and on the crown the stair's doors out onto it: a crate laid before the stair came up stood before its west door)
    const TWc = cfg.tower as { core: { box: number[]; storeys: number[]; doors: string[][]; wall: number; landing: number } } | undefined;
    if (TWc) {
      const [cx0, cx1, cz0, cz1] = TWc.core.box;
      const dx = cx0 + TWc.core.wall + TWc.core.landing / 2;
      const out: Record<string, Pt> = { w: [cx0 - 0.5, (cz0 + cz1) / 2], n: [dx, cz0 - 0.5], s: [dx, cz1 + 0.5], e: [cx1 + 0.5, (cz0 + cz1) / 2] };
      for (const d of TWc.core.doors[TWc.core.storeys.length - 1] ?? []) lands.push([out[d][0], out[d][1], PC.stairDoor]);
    }
    // (and on the south and east decks where their fire escapes step on: off its top landing's middle, 2.5 m along it,
    // 1.5 m in over the deck's edge (its far end, where its stair comes up, meets the lobe's 0.85 m lip), `fire` round
    // it, a body's step off; the crown's doors' 2.5 m there moved a crate onto the east deck's crown)
    for (const f of highFires) {
      const a = (f.yaw * Math.PI) / 180;
      lands.push([f.at[0] + Math.cos(a) * -1.5 + Math.sin(a) * -2.5, f.at[1] - Math.sin(a) * -1.5 + Math.cos(a) * -2.5, PC.fire]);
    }
    const perches: Array<{ name: string; at: number[][] }> = [];
    const roofCounts: string[] = [];
    // (every perch's pieces so far: a deck's landmark keeps off its cover as its cover keeps off itself)
    const allPlaced: Array<{ c: Pt; r: number; hx: number; hz: number }> = [];
    for (const P of PR) {
      const rnd = seeded(P.seed);
      // (and never a piece that cuts its roof in two: the roof's level cells, a quarter metre each, less a body's width
      // `walk` round anything standing on them or off them, flooded with every piece laid so far; a piece that leaves
      // more pieces of roof than there were is passed over. A deck's cover at the gap between two lobes walled the south
      // deck's west lobe, its bridge's stair with it, off from the rest of the deck)
      const C4 = 0.25;
      const NI4 = Math.round((P.box[1] - P.box[0]) / C4) + 1, NJ4 = Math.round((P.box[3] - P.box[2]) / C4) + 1;
      const clear = new Uint8Array(NI4 * NJ4);
      {
        const lv = new Uint8Array(NI4 * NJ4);
        for (let i = 0; i < NI4; i++)
          for (let j = 0; j < NJ4; j++) {
            const t = topAt(P.box[0] + i * C4, P.box[2] + j * C4, P.y);
            lv[i * NJ4 + j] = t >= P.y[0] && t <= P.y[1] ? 1 : 0;
          }
        const k = Math.ceil(PC.walk / C4);
        for (let i = 0; i < NI4; i++)
          for (let j = 0; j < NJ4; j++) {
            if (!lv[i * NJ4 + j]) continue;
            let ok = true;
            for (let di = -k; di <= k && ok; di++)
              for (let dj = -k; dj <= k && ok; dj++) {
                if ((di * C4) ** 2 + (dj * C4) ** 2 > PC.walk ** 2) continue;
                const [a, b] = [i + di, j + dj];
                if (a >= 0 && b >= 0 && a < NI4 && b < NJ4 && !lv[a * NJ4 + b]) ok = false;
              }
            clear[i * NJ4 + j] = ok ? 1 : 0;
          }
      }
      /** how many pieces of this perch's roof a body walks, with these pieces standing on it (a speck under a square metre
       * is no piece) */
      const roofPieces = (laid: Array<{ c: Pt; hx: number; hz: number }>) => {
        const g = clear.slice();
        for (const q of laid) {
          const [i0, i1] = [Math.floor((q.c[0] - q.hx - PC.walk - P.box[0]) / C4), Math.ceil((q.c[0] + q.hx + PC.walk - P.box[0]) / C4)];
          const [j0, j1] = [Math.floor((q.c[1] - q.hz - PC.walk - P.box[2]) / C4), Math.ceil((q.c[1] + q.hz + PC.walk - P.box[2]) / C4)];
          for (let i = Math.max(0, i0); i <= Math.min(NI4 - 1, i1); i++) for (let j = Math.max(0, j0); j <= Math.min(NJ4 - 1, j1); j++) g[i * NJ4 + j] = 0;
        }
        let n = 0;
        const stack: number[] = [];
        for (let s0 = 0; s0 < g.length; s0++) {
          if (g[s0] !== 1) continue;
          let size = 0;
          g[s0] = 2;
          stack.push(s0);
          while (stack.length) {
            const c = stack.pop()!;
            size++;
            const [i, j] = [Math.floor(c / NJ4), c % NJ4];
            if (i > 0 && g[c - NJ4] === 1) (g[c - NJ4] = 2, stack.push(c - NJ4));
            if (i < NI4 - 1 && g[c + NJ4] === 1) (g[c + NJ4] = 2, stack.push(c + NJ4));
            if (j > 0 && g[c - 1] === 1) (g[c - 1] = 2, stack.push(c - 1));
            if (j < NJ4 - 1 && g[c + 1] === 1) (g[c + 1] = 2, stack.push(c + 1));
          }
          if (size * C4 * C4 >= 1) n++;
        }
        return n;
      };
      const inBox = (q: { c: Pt; hx: number; hz: number }) => q.c[0] + q.hx > P.box[0] && q.c[0] - q.hx < P.box[1] && q.c[1] + q.hz > P.box[2] && q.c[1] - q.hz < P.box[3];
      let pieces = roofPieces(allPlaced.filter(inBox));
      // (a piece stays where the last layout put it while its spot is still level roof, and only a lost one is drawn
      // afresh: the last bake's collision has the last layout's pieces in it, read back as roof only roughly, and a
      // reroll from it moved a piece a time)
      // (and one outside the perch's box, which has moved since, is drawn afresh too)
      const kept = (((cfg.perches ?? []) as Array<{ name: string; at: number[][] }>).find((q) => q.name === P.name)?.at ?? []).map(([x, , z, yaw]) => ({ x, z, yaw: yaw ?? 0 })).filter((q) => q.x >= P.box[0] && q.x <= P.box[1] && q.z >= P.box[2] && q.z <= P.box[3]);
      const spots: Pt[] = [];
      for (let x = P.box[0]; x <= P.box[1]; x += 0.5) for (let z = P.box[2]; z <= P.box[3]; z += 0.5) spots.push([x, z]);
      for (let i = spots.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [spots[i], spots[j]] = [spots[j], spots[i]];
      }
      const mine: Array<{ c: Pt; r: number; hx: number; hz: number }> = [];
      const at: number[][] = [];
      for (const cand of [...kept, ...spots.map(([x, z]) => ({ x, z, yaw: -1 }))]) {
        if (at.length >= P.count) break;
        const [x, z] = [cand.x, cand.z];
        const name = P.pieces[at.length % P.pieces.length];
        const row = piece(name).row;
        // (a piece that `face`s the middle turns its own +z there, to the nearest right angle so its footprint stays
        // square to the grid: the south deck's tall neon sign)
        const yaw = P.face === "middle" ? (((Math.round(yawToward(-x, -z) / 90) * 90) % 360) + 360) % 360 : cand.yaw >= 0 ? cand.yaw : rnd() < 0.5 ? 0 : 90;
        const [hx, hz] = yaw % 180 === 0 ? [row.size![0] / 2, row.size![2] / 2] : [row.size![2] / 2, row.size![0] / 2];
        const r = Math.hypot(hx, hz);
        // (level under the whole footprint, at the perch's height)
        const under = P.y;
        const y = topAt(x, z, under);
        if (y < P.y[0] || y > P.y[1]) continue;
        let ok = true;
        for (const fx of [-hx, 0, hx]) for (const fz of [-hz, 0, hz]) if (Math.abs(topAt(x + fx, z + fz, under) - y) > 0.05) ok = false;
        // (and no drop within `edge` of it: a piece by the roof's edge is a step off it)
        for (const fx of [-hx - P.edge, 0, hx + P.edge]) for (const fz of [-hz - P.edge, 0, hz + P.edge]) if (topAt(x + fx, z + fz, under) < y - 0.5) ok = false;
        if (!ok || lands.some((l) => Math.hypot(l[0] - x, l[1] - z) < l[2] + r) || mine.some((m) => Math.hypot(m.c[0] - x, m.c[1] - z) < P.apart + m.r + r) || allPlaced.some((m) => Math.hypot(m.c[0] - x, m.c[1] - z) < P.apart + m.r + r)) continue;
        // (a crown's pieces stand together, each within `near` of its first: a High City deck's crown is one thing seen from
        // across the city, a tank and its masts or a stand of trees, not its pieces strewn over the deck)
        if (P.near && mine.length && Math.hypot(mine[0].c[0] - x, mine[0].c[1] - z) > P.near + mine[0].r + r) continue;
        const after = roofPieces([...allPlaced.filter(inBox), ...mine, { c: [x, z], hx, hz }]);
        if (after > pieces) continue;
        pieces = after;
        placeTurned("c-dress", name, x, z, yaw, "o", y - row.min![1]);
        mine.push({ c: [x, z], r, hx, hz });
        at.push([+x.toFixed(2), +y.toFixed(2), +z.toFixed(2), yaw, +hx.toFixed(2), +hz.toFixed(2), +(row.max![1] - row.min![1]).toFixed(2)]);
      }
      allPlaced.push(...mine);
      perches.push({ name: P.name, at });
      roofCounts.push(`${P.name} ${pieces}`);
    }
    cfg.perches = perches;
    console.log(`the perches' cover: ${perches.map((q) => `${q.name} ${q.at.length}`).join(", ")}; the pieces of roof each leaves a body: ${roofCounts.join(", ")}`);
  }
}
// (a scaled placement carries its scale as a ninth field, past what Place names: the bake reads it, tools/import-neon.ts)
// each corner block's sign (rules.low.identity; the centre's first review: "NOODLE ROW, MARKET and THE WELL show nothing
// of their names"): one of the pack's neon signs `scale` times its size, standing on a roof of its block at `at`, `top`
// the roof's height, its lit face (its own +z) to the middle of the map (or `yaw`), so the block reads from the Loop,
// the plaza and the decks, `up` over the roof; solid, as a sign standing on a roof a player reaches is (drawn only, the
// second review walked through MOTEL HILL's in its yard)
{
  const ID = R.low.identity as { up: number; signs: Record<string, { piece: string; scale: number; at: number[]; top: number; yaw?: number }> } | undefined;
  if (ID) {
    const out: Array<{ block: string; at: number[]; yaw: number; piece: string; scale: number; w: number; h: number }> = [];
    for (const [block, q] of Object.entries(ID.signs)) {
      const [cx, cz] = q.at;
      const [bx, bz] = block.split(",").map(Number);
      const yaw = q.yaw ?? yawToward(-cx, -cz);
      const { key, row } = piece(q.piece);
      const chunk = `c-${bz < 0 ? "n" : "s"}${bx < 0 ? "w" : "e"}`;
      // (its pivot, so its footprint's middle stands at `at`: the pack's signs' pivots are off their middles)
      const [mx, mz] = rotY(yaw, ((row.min![0] + row.max![0]) / 2) * q.scale, ((row.min![2] + row.max![2]) / 2) * q.scale);
      const y = q.top + ID.up - row.min![1] * q.scale;
      add(chunk, "c", [key, +(cx - mx).toFixed(3), +y.toFixed(3), +(cz - mz).toFixed(3), +yaw.toFixed(2), "o", null, null, q.scale] as unknown as Place);
      out.push({ block, at: [cx, +(q.top + ID.up).toFixed(3), cz], yaw: +yaw.toFixed(2), piece: q.piece, scale: q.scale, w: +(row.size![0] * q.scale).toFixed(2), h: +(row.size![1] * q.scale).toFixed(2) });
    }
    cfg.identity = out;
    console.log(`the corner blocks' signs: ${out.map((q) => `${q.block} ${q.piece.replace(".prefab", "")} ${q.w} by ${q.h} m`).join(", ")}`);
  }
}
// street furniture (rules.dress.furniture; the centre's first review: "streets are wide, with only hover cars and lamps for
// cover"): along every street's pavements between the lamps, kiosks, planters, benches, bins and billboard panels, each
// on the pavement `inset` in from the kerb and turned to the road, clear of everything the lamps are clear of and of the
// lamps, the stalls, the crates, the walk-in doors and each other. Placed last, so nothing else in the layout moves
{
  const FU = R.dress.furniture as { every: number; offset: number; inset: number; chance: number; seed: number; apart: number; pieces: string[] } | undefined;
  if (FU) {
    const rndF = seeded(FU.seed);
    const pads = ((cfg.pads ?? []) as Array<{ pad: number[] }>).map((q) => q.pad);
    const kiosks = ((cfg.court?.halls ?? []) as Array<{ route?: number[][]; x0: number; x1: number; z0: number; z1: number }>).filter((h) => h.route);
    const lampKey = piece(R.dress.lamp.piece).key;
    const taken: Array<{ c: Pt; r: number }> = [];
    for (const ch of chunks.values()) for (const q of ch.place) if (q[0] === lampKey) taken.push({ c: [q[1], q[3]], r: 0.6 });
    for (const q of ((cfg.stalls ?? []) as Array<{ at: number[] }>)) taken.push({ c: [q.at[0], q.at[1]], r: 2.5 });
    for (const q of ((cfg.crates ?? []) as Array<{ at: number[] }>)) taken.push({ c: [q.at[0], q.at[1]], r: 1.5 });
    for (const q of ((cfg.walkIns ?? []) as Array<{ door: number[] }>)) taken.push({ c: [q.door[0], q.door[1]], r: 3 });
    const clearF = (x: number, z: number, r: number, st: Street, apart = FU.apart): boolean =>
      onRoad(x, z, st) > R.dress.crossing + r &&
      !(Math.hypot(x, z) > R.skyring.r0 - r - 1 && Math.hypot(x, z) < R.skyring.r1 + r + 1) &&
      !skyStairs.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < r + 5) &&
      Math.max(Math.abs(x), Math.abs(z)) < CV.inside - 3 &&
      !pads.some(([px, pz]) => Math.hypot(px - x, pz - z) < r + R.dress.padClear) &&
      !lifts.some((q) => {
        const [ax, az, bx, bz] = [q.ring[0], q.ring[1], q.car[0], q.car[1]];
        const l2 = (bx - ax) ** 2 + (bz - az) ** 2;
        const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2));
        return Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t) < r + R.lifts.clear;
      }) &&
      !kiosks.some((h) => x > h.x0 - r && x < h.x1 + r && z > h.z0 - r && z < h.z1 + r) &&
      !taken.some((q) => Math.hypot(q.c[0] - x, q.c[1] - z) < r + q.r + apart);
    const furniture: Array<{ at: number[]; yaw: number; piece: string }> = [];
    let k = 0;
    for (const st of STREETS)
      for (const side of [-1, 1])
        for (let i = Math.round(FU.offset / 0.5); i < st.pts.length; i += Math.round(FU.every / 0.5)) {
          if (rndF() > FU.chance) continue;
          const name = FU.pieces[k++ % FU.pieces.length];
          const row = piece(name).row;
          // (its depth across the pavement is its own z; it stands `inset` off the kerb, within the pavement)
          const depth = row.size![2];
          if (FU.inset + depth > CV.pave) continue;
          const n = normalAt(st, i);
          const off = st.half + FU.inset + depth / 2;
          const [x, z] = [st.pts[i][0] + n[0] * side * off, st.pts[i][1] + n[1] * side * off];
          const r = Math.hypot(row.size![0], depth) / 2;
          if (!clearF(x, z, r, st) || onRoad(x, z) < FU.inset + depth / 2 - 0.1) continue;
          // (turned to the road: its own +z toward the kerb)
          const yaw = yawToward(-n[0] * side, -n[1] * side);
          STREET_GRAPH?.add(placeTurned("c-dress", name, x, z, yaw, "o", -row.min![1]));
          taken.push({ c: [x, z], r });
          furniture.push({ at: [+x.toFixed(3), +z.toFixed(3)], yaw: +yaw.toFixed(2), piece: name });
        }
    cfg.furniture = furniture;
    // MARKET's crate stacks (rules.low.crateStacks; the second review: "18 no crates"): along its `streets` where they run
    // beside the block, every `every` metres on the block's pavement, two of the pack's crates side by side and one on
    // the first, a step from waist to head high, turned to the road and `inset` off the kerb, clear as the furniture is
    const CR = R.low.crateStacks as { block: string; streets: string[]; beside: number[]; every: number; inset: number; piece: string; apart: number; space: number } | undefined;
    if (CR) {
      const [bx, bz] = CR.block.split(",").map(Number);
      const chunk = `c-${bz < 0 ? "n" : "s"}${bx < 0 ? "w" : "e"}`;
      const cr = piece(CR.piece).row;
      const stacks: Array<{ at: number[]; yaw: number }> = [];
      for (const st of STREETS.filter((q) => CR.streets.includes(q.id)))
        for (let i = Math.round(CR.every / 2 / 0.5); i < st.pts.length; i += Math.round(CR.every / 0.5)) {
          const p0 = st.pts[i];
          const v = st.id.endsWith("n") || st.id.endsWith("s") ? Math.abs(p0[1]) : Math.abs(p0[0]);
          if (v < CR.beside[0] || v > CR.beside[1]) continue;
          const n0 = normalAt(st, i);
          // (the block's side of the street: toward its corner)
          const side = (bx * 73 - p0[0]) * n0[0] + (bz * 73 - p0[1]) * n0[1] > 0 ? 1 : -1;
          const n: Pt = [n0[0] * side, n0[1] * side];
          const depth = cr.size![2];
          const off = st.half + CR.inset + depth / 2;
          const [x, z] = [p0[0] + n[0] * off, p0[1] + n[1] * off];
          const r = Math.hypot(cr.size![0], depth / 2);
          // (`apart` off the furniture and lamps, nearer than the furniture keeps: they stand every 7.5 m along the
          // pavement, and at the furniture's 1.5 m a stack found room once; and `space` from the other stacks)
          if (!clearF(x, z, r, st, CR.apart) || onRoad(x, z) < CR.inset + depth / 2 - 0.1 || stacks.some((q) => Math.hypot(q.at[0] - x, q.at[1] - z) < CR.space)) continue;
          const t = st.tan[i];
          const yaw = yawToward(-n[0], -n[1]);
          const half = cr.size![0] / 2 + 0.02;
          const stackBox: OBox = { c: [x, z], u: rotY(yaw, 1, 0), v: rotY(yaw, 0, 1), hu: cr.size![0] + 0.02, hv: depth / 2, top: cr.size![1] * 2 };
          if (STREET_GRAPH?.splits(stackBox)) continue;
          STREET_GRAPH?.add(stackBox);
          placeTurned(chunk, CR.piece, x - t[0] * half, z - t[1] * half, yaw, "o", -cr.min![1]);
          placeTurned(chunk, CR.piece, x + t[0] * half, z + t[1] * half, yaw, "o", -cr.min![1]);
          placeTurned(chunk, CR.piece, x - t[0] * half, z - t[1] * half, yaw, "o", cr.size![1] - cr.min![1]);
          taken.push({ c: [x, z], r });
          stacks.push({ at: [+x.toFixed(3), +z.toFixed(3)], yaw: +yaw.toFixed(2) });
        }
      cfg.crateStacks = stacks;
      console.log(`${CR.block}'s crate stacks: ${stacks.length}`);
    }
    // THE WELL's ring of lamps (rules.low.wellRing; the second review: "no shaft visible from the rim"): the street's own
    // lamp every `every` metres round its shaft's open `edges`, `out` metres outside the hole, its two heads along the edge,
    // on the ground there (the last bake's collision: not where a building stands, its top over `ground`), off each rope's
    // top by `clear`, so the hole reads from the Loop and the ring, lit at night
    const WR = R.low.wellRing as { every: number; out: number; clear: number; ground: number; edges: string[] } | undefined;
    const WH = (cfg.well as { hole?: number[]; ropes?: Array<{ rope: number[][] }> } | undefined);
    if (WR && WH?.hole) {
      const SB = lastSolids();
      // (the ground: the highest top there under `ground`; a box over it wider than 1.5 m both ways is a building, and no
      // spot; a narrower one is a post, the lamp's own from the last bake among them (its column a metre square), and the
      // ground is its foot)
      const here = (x: number, z: number) => SB.filter((b) => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3]);
      const groundAt = (x: number, z: number) => {
        const bs = here(x, z);
        if (bs.some((b) => b[5] >= WR.ground && b[1] - b[0] > 1.5 && b[3] - b[2] > 1.5)) return Infinity;
        return bs.reduce((t, b) => {
          const g = b[5] < WR.ground ? b[5] : b[4] < WR.ground ? b[4] : -Infinity;
          return g > t ? g : t;
        }, -Infinity);
      };
      const [h0, h1, h2, h3] = WH.hole;
      const tops = (WH.ropes ?? []).map((q) => q.rope[1]);
      const spots: Array<{ at: Pt; yaw: number }> = [];
      const along = (a: Pt, b: Pt) => {
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let t = WR.every / 2; t < L; t += WR.every) spots.push({ at: [a[0] + ((b[0] - a[0]) * t) / L, a[1] + ((b[1] - a[1]) * t) / L], yaw: yawToward(b[0] - a[0], b[1] - a[1]) });
      };
      const o = WR.out;
      if (WR.edges.includes("n")) along([h0, h2 - o], [h1, h2 - o]);
      if (WR.edges.includes("s")) along([h0, h3 + o], [h1, h3 + o]);
      if (WR.edges.includes("e")) along([h1 + o, h2], [h1 + o, h3]);
      if (WR.edges.includes("w")) along([h0 - o, h2], [h0 - o, h3]);
      const ring: Array<{ at: number[] }> = [];
      for (const q of spots) {
        // (a lamp where the last layout put one keeps its height: its post, baked, covers the rim's box it stood on)
        const was = ((cfg.wellRing ?? []) as Array<{ at: number[] }>).find((w) => Math.hypot(w.at[0] - q.at[0], w.at[2] - q.at[1]) < 0.05);
        const y = was ? was.at[1] : groundAt(q.at[0], q.at[1]);
        if (!(y > -1 && y < WR.ground) || tops.some((t) => Math.hypot(t[0] - q.at[0], t[2] - q.at[1]) < WR.clear) || taken.some((m) => Math.hypot(m.c[0] - q.at[0], m.c[1] - q.at[1]) < m.r + 1)) continue;
        placeTurned("c-se", R.dress.lamp.piece, q.at[0], q.at[1], q.yaw, "o", y);
        ring.push({ at: [+q.at[0].toFixed(3), +y.toFixed(3), +q.at[1].toFixed(3)] });
      }
      cfg.wellRing = ring;
      console.log(`the Well's ring of lamps: ${ring.length}`);
    }
    console.log(`street furniture: ${furniture.length} pieces along the pavements`);
  }
}
/** the High City's climbs' balconies, laid before the street walls, which keep clear of them */
const CLIMB_BOXES: OBox[] = [];
// The High City's climbs (rules.blocks.climbs; the centre's third review: "nothing to climb on the facades between 10.5
// and 26.9 m", "facade traversal"): up a straight face of a block (`at`, a point on the face at street level, `along` it
// and `out` of it; measured off the collision at 10 m: only the north and west blocks' Loop faces run straight 20 m, the
// others' are round lobes a few metres across), the pack's round balcony from `first` metres up and every `every`
// metres, by turns `shift` metres either side along the face, its back `inset` off the face found at its height, until
// the deck's edge (its fence where one stands) is within `reach` of the last. Each a double jump and a grab from the end
// of the one under it, the next one's end a metre along. Clear by `clear` of the lifts' cars and landings, the pads and
// the street's signs, and of the bridges at the top, where a climber comes up onto the deck; laid before the street walls, which keep clear of it; solid (its own boxes, listed
// by the bake beside the rest as the walls' are), so nothing laid before it moves. A player climbs each,
// tools/checks/sk-neon.ts
{
  const CL = (R.blocks as { climbs?: { chunk: string; piece: string; without: string[]; first: number; every: number; shift: number; inset: number; reach: number; clear: number; at: Array<{ block: string; at: Pt; along: Pt; out: Pt; side?: number }> } }).climbs;
  if (CL) {
    const S = lastSolids();
    const G = 2;
    const grid = new Map<string, number[][]>();
    for (const b of S) for (let i = Math.floor(b[0] / G); i <= Math.floor(b[1] / G); i++) for (let j = Math.floor(b[2] / G); j <= Math.floor(b[3] / G); j++) (grid.get(`${i},${j}`) ?? grid.set(`${i},${j}`, []).get(`${i},${j}`)!).push(b);
    const inside = (x: number, z: number, y: number) => (grid.get(`${Math.floor(x / G)},${Math.floor(z / G)}`) ?? []).some((b) => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && b[4] < y && b[5] > y);
    const topAt = (x: number, z: number) => (grid.get(`${Math.floor(x / G)},${Math.floor(z / G)}`) ?? []).reduce((t, b) => (x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && b[5] > t && b[5] < 40 ? b[5] : t), -Infinity);
    const row = piece(CL.piece).row;
    // (what a balcony keeps clear of: each lift's car and landing, the pads, the signs, the bridges' lines)
    const spots: Pt[] = [...lifts.flatMap((q) => [q.car as Pt, q.land as Pt]), ...((cfg.pads ?? []) as Array<{ pad: Pt }>).map((q) => q.pad), ...(chunks.get("c-signs")?.place ?? []).map((q) => [q[1], q[3]] as Pt)];
    const bridgeLines = (R.bridges.paths as number[][][]).flatMap((p) => p.slice(1).map((q, i) => [p[i], q]));
    const climbs: Array<{ block: string; deck: number[]; balconies: Array<{ at: number[]; y: number; yaw: number; ends: number[][] }> }> = [];
    for (const A of CL.at) {
      const yaw = yawToward(-A.out[0], -A.out[1]);
      const balconies: Array<{ at: number[]; y: number; yaw: number; ends: number[][] }> = [];
      let deck: number[] = [];
      for (let k = 0, y = CL.first; k < 12; k++, y += CL.every) {
        // (the first `side` of `at` along the face, and by turns: the top one kept off where a bridge lands)
        const sh = (k % 2 ? -1 : 1) * (A.side ?? -1) * CL.shift;
        const p0: Pt = [A.at[0] + A.along[0] * sh, A.at[1] + A.along[1] * sh];
        // (the face at this height: in from 3 m out until the block stands)
        let f: Pt | null = null;
        for (let t = -3; t < 3 && !f; t += 0.05) if (inside(p0[0] - A.out[0] * t, p0[1] - A.out[1] * t, y + 0.5)) f = [p0[0] - A.out[0] * t, p0[1] - A.out[1] * t];
        if (!f) throw new Error(`the ${A.block} block's climb: no face at ${y} m`);
        const [px, pz] = [f[0] + A.out[0] * CL.inset, f[1] + A.out[1] * CL.inset];
        const [cx, cz] = rotY(yaw, (row.min![0] + row.max![0]) / 2, (row.min![2] + row.max![2]) / 2);
        const box: OBox = { c: [px + cx, pz + cz], u: rotY(yaw, 1, 0), v: rotY(yaw, 0, 1), hu: row.size![0] / 2, hv: row.size![2] / 2, top: y + 0.5 };
        const why = spots.some((q) => Math.hypot(q[0] - box.c[0], q[1] - box.c[1]) < row.size![0] / 2 + CL.clear + 1.5) ? "a lift, pad or sign" : y > R.bridges.deck - CL.reach && bridgeLines.some(([a, b]) => { const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2; const t = Math.max(0, Math.min(1, ((box.c[0] - a[0]) * (b[0] - a[0]) + (box.c[1] - a[1]) * (b[1] - a[1])) / l2)); return Math.hypot(box.c[0] - a[0] - (b[0] - a[0]) * t, box.c[1] - a[1] - (b[1] - a[1]) * t) < row.size![0] / 2 + R.low.bridgeClear; }) ? "a bridge" : "";
        if (why) throw new Error(`the ${A.block} block's climb: its ${y} m balcony against ${why}`);
        CLIMB_BOXES.push(box);
        // (its floor at y: the kerb round its edge left out (`without`), or the bake's solid shell stood a climber on the
        // kerb's top, half a metre over the floor drawn)
        add(CL.chunk, "c", [piece(CL.piece).key, +px.toFixed(3), +y.toFixed(3), +pz.toFixed(3), +yaw.toFixed(2), "s", null, CL.without] as Place);
        // (its two ends, a metre in from each, half its depth out: where a climber stands and jumps from)
        const ends = [-1, 1].map((e) => [+(box.c[0] + box.u[0] * e * (box.hu - 1)).toFixed(3), +(box.c[1] + box.u[1] * e * (box.hu - 1)).toFixed(3)]);
        balconies.push({ at: [+box.c[0].toFixed(3), +box.c[1].toFixed(3)], y, yaw: +yaw.toFixed(2), ends });
        // (the deck's edge over the face here: its top a metre in)
        const edge = topAt(f[0] - A.out[0], f[1] - A.out[1]);
        if (edge - y <= CL.reach) {
          deck = [+(f[0] - A.out[0] * 2).toFixed(3), +(f[1] - A.out[1] * 2).toFixed(3), +edge.toFixed(2)];
          break;
        }
      }
      climbs.push({ block: A.block, deck, balconies });
    }
    cfg.climbs = climbs;
    console.log(`the High City's climbs: ${climbs.map((c) => `${c.block} ${c.balconies.length} balconies to the deck at ${c.deck[2]} m`).join(", ")}`);
  }
}
// The street walls (rules.low.walls; the centre's third review: "streets are wide bare plains overlooked from 27 m", "no
// street sightline past 60 m but the Loop's"). On the last bake, from 90% of the open street ground a standing body could
// be seen past 60 m (tools/.scratch/sightlines.mts), and only 9 buildings stood along the eight curves, all on their
// corner sides: the sides toward the High City and the Loop's outer side stood open to the bridges' feet. Along both sides
// of every curve and the Loop's outer side, a row of the pack's low buildings (`pool`), each its front (its own +z) to the
// street, `setback` metres off the pavement and as little more as it needs (up to `slide`), `gap` metres apart and an
// alley `wide` metres every `alley` metres; on ground the last bake's collision leaves open (`clear` metres off it), clear
// of the pads, the lifts' footbridges, the Well, the zip lines' ropes (a hanging body's room under them) and the High
// City's climbs, of the bridges if taller than rules.low.underBridge, and never one that would cut the bots' street
// graph. Laid last with a seed of its own, so nothing else in the layout moves
// (their boxes kept for the street cover below, which measures the street with them in)
const STREET_WALL_BOXES: OBox[] = [];
{
  const W = R.low.walls as { chunk: string; pool: string[]; setback: number; slide: number; gap: number[]; alley: { every: number; wide: number }; from: number; clear: number; seed: number } | undefined;
  if (W) {
    const rndW = seeded(W.seed);
    const L = R.low;
    // (the collision from the street up past the tallest of the pool, a 2 m grid of it: a wall keeps `clear` metres off
    // every box under its own top, what stands over the street as well as in it; laid against the street's collision
    // alone, one stood up into a corner block's)
    const reach = Math.max(...W.pool.map((n) => piece(n).row.max![1])) + W.clear;
    const SG = new Map<string, number[][]>();
    for (const b of lastSolids()) {
      if (b[4] > reach || b[5] < 0.5) continue;
      for (let i = Math.floor(b[0] / 2); i <= Math.floor(b[1] / 2); i++) for (let j = Math.floor(b[2] / 2); j <= Math.floor(b[3] / 2); j++) (SG.get(`${i},${j}`) ?? SG.set(`${i},${j}`, []).get(`${i},${j}`)!).push(b);
    }
    const onSolid = (o: OBox) => {
      const r = Math.hypot(o.hu, o.hv) + W.clear;
      const seen = new Set<number[]>();
      for (let i = Math.floor((o.c[0] - r) / 2); i <= Math.floor((o.c[0] + r) / 2); i++)
        for (let j = Math.floor((o.c[1] - r) / 2); j <= Math.floor((o.c[1] + r) / 2); j++)
          for (const b of SG.get(`${i},${j}`) ?? []) {
            if (seen.has(b)) continue;
            seen.add(b);
            if (b[4] < o.top + W.clear && overlaps(o, boxOf(b), W.clear)) return true;
          }
      return false;
    };
    const seg = (q: Pt, a: number[], b: number[]) => {
      const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
      const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * (b[0] - a[0]) + (q[1] - a[1]) * (b[1] - a[1])) / l2));
      return Math.hypot(q[0] - a[0] - (b[0] - a[0]) * t, q[1] - a[1] - (b[1] - a[1]) * t);
    };
    const pads: Pt[] = [...((cfg.pads ?? []) as Array<{ pad: Pt }>).map((q) => q.pad), ...((cfg.spine?.up ?? []) as Array<{ pad: Pt }>).map((q) => q.pad)];
    const bridgeLines = (R.bridges.paths as number[][][]).flatMap((p) => p.slice(1).map((q, i) => [p[i], q]));
    const foot = (cfg.well?.foot ?? null) as number[] | null;
    const MV = JSON.parse(readFileSync(join(ROOT, "src", "config", "movement.json"), "utf8"));
    const under = MV.ziplineHang * 0.0254 + MV.radius * 0.0254 + W.clear;
    const ropes = ((cfg.zips ?? []) as Array<{ a: number[]; b: number[] }>).map((z) => Array.from({ length: 101 }, (_, k) => [z.a[0] + ((z.b[0] - z.a[0]) * k) / 100, z.a[1] + ((z.b[1] - z.a[1]) * k) / 100, z.a[2] + ((z.b[2] - z.a[2]) * k) / 100]));
    const walls: Array<{ piece: string; street: string; c: Pt; yaw: number; hu: number; hv: number; top: number }> = [];
    const boxes: OBox[] = [];
    const why = new Map<string, number>();
    const fitsW = (o: OBox): boolean => {
      const r = rim(o);
      const inside = (q: number[], m: number) => {
        const [px, pz] = [q[0] - o.c[0], q[q.length === 3 ? 2 : 1] - o.c[1]];
        return Math.abs(px * o.u[0] + pz * o.u[1]) < o.hu + m && Math.abs(px * o.v[0] + pz * o.v[1]) < o.hv + m;
      };
      const k = !r.every(([x, z]) => onRoad(x, z) >= CV.pave) ? "road"
        : !r.every(([x, z]) => Math.max(Math.abs(x), Math.abs(z)) <= L.edge) ? "edge"
        : boxes.some((q) => overlaps(o, q, L.gap)) ? "placed"
        : pads.some((q) => inside(q, W.clear + 2)) ? "pad"
        : lifts.some((q) => seg(o.c, q.ring, q.foot) < Math.hypot(o.hu, o.hv) + R.lifts.clear && r.some((p) => seg(p, q.ring, q.foot) < R.lifts.clear)) ? "lift"
        : foot && overlaps(o, boxOf(foot), W.clear * 2) ? "well"
        : CLIMB_BOXES.some((q) => q.top - 4 < o.top && overlaps(o, q, W.clear)) ? "climb"
        : ropes.some((rope) => rope.some((q) => inside(q, under) && q[1] - under < o.top)) ? "zip"
        : o.top > L.underBridge && bridgeLines.some(([a, b]) => r.some((p) => seg(p, a, b) < L.bridgeClear)) ? "bridge"
        : onSolid(o) ? "solid"
        : STREET_GRAPH?.splits(o) ? "graph"
        : "ok";
      why.set(k, (why.get(k) ?? 0) + 1);
      return k === "ok";
    };
    for (const st of STREETS)
      for (const side of st.closed ? [0] : [-1, 1]) {
        const length = (st.pts.length - (st.closed ? 0 : 1)) * 0.5;
        let freeAt = st.closed ? 0 : W.from;
        let alleyAt = freeAt;
        const at = (u: number) => (st.closed ? ((Math.round(u / 0.5) % st.pts.length) + st.pts.length) % st.pts.length : Math.round(u / 0.5));
        while (freeAt < length) {
          let done = false;
          for (const name of [...W.pool].sort(() => rndW() - 0.5)) {
            const row = piece(name).row;
            const [w, d] = [row.size![0], row.size![2]];
            if (!st.closed && freeAt + w > length) continue;
            const i = at(freeAt + w / 2);
            const [x, z] = st.pts[i];
            const n = normalAt(st, i);
            // (the Loop's outer side: away from the middle)
            const sd = st.closed ? Math.sign(n[0] * x + n[1] * z) : side;
            const out: Pt = [n[0] * sd, n[1] * sd];
            const turnedYaw = yawToward(-out[0], -out[1]);
            for (const yaw of [turnedYaw, Math.round(turnedYaw / 90) * 90]) {
              for (let extra = 0; extra <= W.slide && !done; extra += 0.5) {
                const back = st.half + CV.pave + W.setback + extra + d / 2;
                const c: Pt = [x + out[0] * back, z + out[1] * back];
                const o: OBox = { c, u: rotY(yaw, 1, 0), v: rotY(yaw, 0, 1), hu: w / 2, hv: d / 2, top: row.max![1] };
                if (!fitsW(o)) continue;
                const b = placeTurned(W.chunk, name, c[0], c[1], yaw, "s");
                boxes.push(b);
                STREET_WALL_BOXES.push(b);
                STREET_GRAPH?.add(b);
                walls.push({ piece: name, street: `${st.id}${st.closed ? "" : side < 0 ? "-l" : "-r"}`, c: [+c[0].toFixed(3), +c[1].toFixed(3)], yaw: +yaw.toFixed(2), hu: +(w / 2).toFixed(3), hv: +(d / 2).toFixed(3), top: +row.max![1].toFixed(2) });
                freeAt += w + W.gap[0] + rndW() * (W.gap[1] - W.gap[0]);
                // (an alley every `alley.every` metres: a way through to the block's yard behind)
                if (freeAt - alleyAt >= W.alley.every) (freeAt += W.alley.wide), (alleyAt = freeAt);
                done = true;
              }
              if (done) break;
            }
            if (done) break;
          }
          if (!done) freeAt += 1;
        }
      }
    cfg.streetWalls = walls;
    const by = new Map<string, number>();
    for (const q of walls) by.set(q.street, (by.get(q.street) ?? 0) + 1);
    const tris = walls.reduce((a, q) => a + piece(q.piece).row.tris, 0);
    console.log(`the street walls: ${walls.length} buildings, ${(tris / 1000).toFixed(0)}k triangles (${[...by].map(([k, v]) => `${k} ${v}`).join(", ")}; ${JSON.stringify(Object.fromEntries(why))} tried)`);
  }
}
// Cover down the streets (rules.dress.cover; the centre's fourth review: "cover every 8 to 12 m in the streets and
// plaza", its shots of the streets open with little in them). From every open point of the streets, a curve's or the
// Loop's road and pavements and the ring road from its inner pavement out, something a crouched body hides behind within
// `far` metres: anything standing from the ground (under 0.5 m) past 1 m. The point farthest from it takes a piece within
// `near` metres of it: one of `road` on a carriageway (every `tall.every`-th the tall board, over a standing eye), one of
// `pave` on a pavement, its long side along the street, `clear` metres off everything a body stands in so every way past
// it stays a body's width, clear of the pads, the lifts' footbridges, the Sky Ring's stairs, the metro's kiosks, the
// Well's stairwell, the walk-ins' doors and THE CENTRE's spawns, `headroom` metres under anything over it (a tall board
// stood 0.45 m under the Sky Ring's deck), and never one that cuts the bots' street graph or stands across a link of a
// node it has cut off already; then the
// next farthest, until every point has cover or no piece fits by it. Measured on the last bake's collision and the
// street walls above, and laid last (the bake lists its boxes in `laid`), so the next run measures the same streets
{
  const CO = (R.dress as { cover?: { chunk: string; far: number; near: number; clear: number; headroom: number; road: string[]; pave: string[]; tall: { piece: string; every: number }; most: number; seed: number } }).cover;
  if (CO) {
    const rndC = seeded(CO.seed);
    const L = R.low;
    const C = 0.5, H = R.ring[1] as number;
    const N = Math.round((2 * H) / C);
    const mid = (k: number): Pt => [-H + (Math.floor(k / N) + 0.5) * C, -H + ((k % N) + 0.5) * C];
    const body = new Uint8Array(N * N), cover = new Uint8Array(N * N);
    const floor = new Float32Array(N * N).fill(-Infinity);
    // (and the lowest thing over each cell, above a standing body)
    const STAND = JSON.parse(readFileSync(join(ROOT, "src", "config", "movement.json"), "utf8")).standHeight * 0.0254;
    const over = new Float32Array(N * N).fill(Infinity);
    // (the last layout's own street pieces, those the dress block lays again, under 4 m on a footprint under 8 m and each
    // grown half a metre, as the street graph leaves them out: their boxes are the last bake's, not this run's)
    const oldDress: OBox[] = (((cfg.chunks ?? {}) as Record<string, { place: Place[] }>)["c-dress"]?.place ?? []).flatMap((q) => {
      const r = byName.get(q[0]);
      if (!r?.size || q[2] > 1 || q[2] + r.max![1] > 4 || Math.max(r.size[0], r.size[2]) > 8) return [];
      const [ox, oz] = rotY(q[4], (r.min![0] + r.max![0]) / 2, (r.min![2] + r.max![2]) / 2);
      return [{ c: [q[1] + ox, q[3] + oz] as Pt, u: rotY(q[4], 1, 0), v: rotY(q[4], 0, 1), hu: r.size[0] / 2 + 0.5, hv: r.size[2] / 2 + 0.5, top: 0 }];
    });
    const ofOldDress = (b: number[]) => {
      if (b[5] <= 0.3 || b[5] > 4.5) return false;
      const [x, z] = [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2];
      return oldDress.some((o) => Math.abs((x - o.c[0]) * o.u[0] + (z - o.c[1]) * o.u[1]) < o.hu && Math.abs((x - o.c[0]) * o.v[0] + (z - o.c[1]) * o.v[1]) < o.hv);
    };
    for (const b of lastSolids()) {
      if (ofOldDress(b)) continue;
      if (b[4] >= STAND && b[4] < 12 && !(b[1] < -H || b[0] > H || b[3] < -H || b[2] > H))
        for (let i = Math.max(0, Math.floor((b[0] + H) / C)); i <= Math.min(N - 1, Math.floor((b[1] + H) / C)); i++)
          for (let j = Math.max(0, Math.floor((b[2] + H) / C)); j <= Math.min(N - 1, Math.floor((b[3] + H) / C)); j++) over[i * N + j] = Math.min(over[i * N + j], b[4]);
      if (b[5] < -0.5 || b[4] > 2.5 || b[1] < -H || b[0] > H || b[3] < -H || b[2] > H) continue;
      for (let i = Math.max(0, Math.floor((b[0] + H) / C)); i <= Math.min(N - 1, Math.floor((b[1] + H) / C)); i++)
        for (let j = Math.max(0, Math.floor((b[2] + H) / C)); j <= Math.min(N - 1, Math.floor((b[3] + H) / C)); j++) {
          const k = i * N + j;
          if (b[4] < 1.8 && b[5] > 0.3) body[k] = 1;
          if (b[4] < 0.5 && b[5] > 1) cover[k] = 1;
          if (b[5] <= 0.3 && b[5] > floor[k]) floor[k] = b[5];
        }
    }
    // (the cells an oriented box touches, grown by `grow`)
    const cellsOf = (o: OBox, grow = 0): number[] => {
      const r = Math.hypot(o.hu, o.hv) + grow + C;
      const out: number[] = [];
      for (let i = Math.max(0, Math.floor((o.c[0] - r + H) / C)); i <= Math.min(N - 1, Math.floor((o.c[0] + r + H) / C)); i++)
        for (let j = Math.max(0, Math.floor((o.c[1] - r + H) / C)); j <= Math.min(N - 1, Math.floor((o.c[1] + r + H) / C)); j++) {
          const [px, pz] = [-H + (i + 0.5) * C - o.c[0], -H + (j + 0.5) * C - o.c[1]];
          if (Math.abs(px * o.u[0] + pz * o.u[1]) <= o.hu + grow + C / 2 && Math.abs(px * o.v[0] + pz * o.v[1]) <= o.hv + grow + C / 2) out.push(i * N + j);
        }
      return out;
    };
    for (const o of STREET_WALL_BOXES) for (const k of cellsOf(o)) body[k] = cover[k] = 1;
    // (this run's street pieces as the street graph was given them, each its own height; the last bake's of them were
    // left out above, so a piece the dress block changes is measured where and as it now stands)
    for (const o of STREET_GRAPH?.held ?? []) for (const k of cellsOf(o)) (o.top > 0.3 && (body[k] = 1), o.top > 1 && (cover[k] = 1));
    const open = (k: number) => !body[k] && (floor[k] > -0.3 || !Number.isFinite(floor[k]));
    const street = new Uint8Array(N * N);
    for (let k = 0; k < N * N; k++) {
      const [x, z] = mid(k);
      if (onRoad(x, z) < CV.pave || Math.max(Math.abs(x), Math.abs(z)) >= L.edge) street[k] = 1;
    }
    // (each cell's distance to cover, two passes of a chamfer in cells)
    const D = new Float32Array(N * N);
    const field = () => {
      for (let k = 0; k < D.length; k++) D[k] = cover[k] ? 0 : 1e9;
      for (let i = 0; i < N; i++)
        for (let j = 0; j < N; j++) {
          const k = i * N + j;
          if (i > 0) D[k] = Math.min(D[k], D[k - N] + 1, j > 0 ? D[k - N - 1] + Math.SQRT2 : 1e9, j < N - 1 ? D[k - N + 1] + Math.SQRT2 : 1e9);
          if (j > 0) D[k] = Math.min(D[k], D[k - 1] + 1);
        }
      for (let i = N - 1; i >= 0; i--)
        for (let j = N - 1; j >= 0; j--) {
          const k = i * N + j;
          if (i < N - 1) D[k] = Math.min(D[k], D[k + N] + 1, j < N - 1 ? D[k + N + 1] + Math.SQRT2 : 1e9, j > 0 ? D[k + N - 1] + Math.SQRT2 : 1e9);
          if (j < N - 1) D[k] = Math.min(D[k], D[k + 1] + 1);
        }
    };
    const CEN = JSON.parse(readFileSync(join(ROOT, "src", "config", "centre.json"), "utf8")) as { spawnR: number; spawns: number[]; zone: { bearing: number; r: number }; zones: number[] };
    const onBearing = (b: number, r: number): Pt => [Math.sin((b * Math.PI) / 180) * r, Math.cos((b * Math.PI) / 180) * r];
    const kept: Pt[] = [...CEN.spawns.map((b) => onBearing(b, CEN.spawnR)), onBearing(CEN.zone.bearing, CEN.zone.r), ...CEN.zones.map((b) => onBearing(b, CEN.zone.r))];
    const pads: Pt[] = [...((cfg.pads ?? []) as Array<{ pad: Pt }>).map((q) => q.pad), ...((cfg.spine?.up ?? []) as Array<{ pad: Pt }>).map((q) => q.pad)];
    const kiosks = ((cfg.court?.halls ?? []) as Array<{ route?: number[][]; x0: number; x1: number; z0: number; z1: number }>).filter((h) => h.route);
    const foot = (cfg.well?.foot ?? null) as number[] | null;
    const seg = (q: Pt, a: number[], b: number[]) => {
      const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
      const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * (b[0] - a[0]) + (q[1] - a[1]) * (b[1] - a[1])) / l2));
      return Math.hypot(q[0] - a[0] - (b[0] - a[0]) * t, q[1] - a[1] - (b[1] - a[1]) * t);
    };
    const why = new Map<string, number>();
    const fits = (o: OBox): boolean => {
      const r = Math.hypot(o.hu, o.hv);
      const [x, z] = o.c;
      const k = !cellsOf(o).every((c) => street[c] && open(c)) ? "street"
        : cellsOf(o, CO.clear).some((c) => body[c]) ? "clear"
        : cellsOf(o).some((c) => over[c] < o.top + CO.headroom) ? "under"
        : pads.some(([px, pz]) => Math.hypot(px - x, pz - z) < r + R.dress.padClear) ? "pad"
        : lifts.some((q) => seg(o.c, q.ring, q.car) < r + R.lifts.clear) ? "lift"
        : skyStairs.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < r + 5) ? "stairs"
        : kiosks.some((h) => x > h.x0 - r && x < h.x1 + r && z > h.z0 - r && z < h.z1 + r) ? "kiosk"
        : foot && overlaps(o, boxOf(foot), CO.clear * 2) ? "well"
        : walkIns.some((q) => Math.hypot(q.door[0] - x, q.door[1] - z) < r + 3) ? "door"
        : kept.some(([kx, kz]) => Math.hypot(kx - x, kz - z) < r + R.dress.median.keep) ? "spawn"
        // (nor across a link of a node the model has off the main network: its guess at a link is wrong both ways, and a
        // kiosk it took to cut nothing shut two street nodes in at the bake)
        : STREET_GRAPH?.splits(o) || STREET_GRAPH?.strands(o) ? "graph"
        : "ok";
      why.set(k, (why.get(k) ?? 0) + 1);
      return k === "ok";
    };
    const placed: Array<{ piece: string; c: Pt; yaw: number; half?: number[] }> = [];
    const tried = new Uint8Array(N * N);
    let left = 0;
    for (let n = 0; n < CO.most; n++) {
      field();
      let best = -1;
      for (let k = 0; k < N * N; k++) if (street[k] && open(k) && !tried[k] && (best < 0 || D[k] > D[best])) best = k;
      if (best < 0 || D[best] * C <= CO.far) break;
      const [bx, bz] = mid(best);
      // the far point first, then rings round it out to `near`
      const spots: Pt[] = [[bx, bz]];
      for (let r = C; r <= CO.near + 1e-6; r += C) for (let a = 0; a < 16; a++) spots.push([bx + r * Math.sin((a * Math.PI) / 8), bz + r * Math.cos((a * Math.PI) / 8)]);
      let done = false;
      for (const [x, z] of spots) {
        const m = Math.max(Math.abs(x), Math.abs(z));
        const ns = SF.nearest(x, z, 20);
        // (the street's way here: along its curve or the Loop, or along the ring road's side)
        const ring = m >= L.edge && (!ns || ns.d > ns.street.half + CV.pave);
        const t: Pt = ring ? (Math.abs(x) > Math.abs(z) ? [0, 1] : [1, 0]) : ns ? ns.t : [1, 0];
        const carriage = onRoad(x, z) < 0 || m >= R.ring[0];
        const pool = carriage ? (placed.length % CO.tall.every === CO.tall.every - 1 ? [CO.tall.piece, ...CO.road] : [...CO.road].sort(() => rndC() - 0.5)) : [...CO.pave].sort(() => rndC() - 0.5);
        for (const name of pool) {
          const row = piece(name).row;
          const along = yawToward(t[0], t[1]) + (row.size![2] >= row.size![0] ? 0 : 90);
          for (const yaw of [along, along + 90]) {
            // (its height from its foot: a board's own zero is 1.97 m up it)
            const o: OBox = { c: [x, z], u: rotY(yaw, 1, 0), v: rotY(yaw, 0, 1), hu: row.size![0] / 2, hv: row.size![2] / 2, top: row.size![1] };
            if (!fits(o)) continue;
            // (solid, "s", as the street walls: the bake lists a solid placement's boxes in `laid`, an open one's it merges)
            const b = placeFaced(CO.chunk, name, x, z, yaw, "s", -row.min![1]);
            if (name === CO.tall.piece) dressBoard(CO.chunk, name, x, z, yaw, 0);
            STREET_GRAPH?.add(b);
            for (const c of cellsOf(b)) body[c] = cover[c] = 1;
            // (the tall boards with their half sizes, as the median's: the road check knows them by these)
            placed.push({ piece: name, c: [+x.toFixed(3), +z.toFixed(3)], yaw: +yaw.toFixed(2), ...(name === CO.tall.piece ? { half: [+(row.size![0] / 2).toFixed(3), +(row.size![2] / 2).toFixed(3)] } : {}) });
            done = true;
            break;
          }
          if (done) break;
        }
        if (done) break;
      }
      // (no piece fits by it: the far point and its square metre left)
      if (!done) for (const c of cellsOf({ c: [bx, bz], u: [1, 0], v: [0, 1], hu: 0.5, hv: 0.5, top: 0 })) tried[c] = 1;
    }
    field();
    let streetN = 0, farthest = 0;
    for (let k = 0; k < N * N; k++)
      if (street[k] && open(k)) {
        streetN++;
        if (D[k] * C > CO.far) left++;
        farthest = Math.max(farthest, D[k] * C);
      }
    cfg.streetCover = placed;
    const tris = placed.reduce((a, q) => a + piece(q.piece).row.tris, 0);
    console.log(`the street cover: ${placed.length} pieces, ${(tris / 1000).toFixed(0)}k triangles; ${((left / streetN) * 100).toFixed(1)}% of the open street over ${CO.far} m from cover, the farthest ${farthest.toFixed(1)} m (${JSON.stringify(Object.fromEntries(why))} tried)`);
  }
}
// the two 1v1 arenas (rules.arenas; the owner, 2026-10-09: "2 1v1 maps ... the 1v1 maps are supposed to be super
// basic"): small walled rooms of the bundle's own pieces, out past the city's square where nothing of the city stands,
// each a chunk of its own (not "c-", so the bake keeps it a node of its own: the page draws the one in play and none of
// the city, and neither of them in a battle royale). Every piece of cover is laid twice, the second turned half about the
// arena's middle, so neither end's spawn is the better one; what the game reads (where it is, its walls, its spawns and
// its points) is written to cfg.arenas
{
  type ArenaRule = {
    id: string;
    chunk: string;
    at: number[];
    half: number[];
    floor: { piece: string; size: number[] };
    walls: { piece: string; long: number; thick: number; rows: number[]; top: number; front?: number[]; windows?: { piece: string; row: number; sides: string[]; at: number[] } };
    roof?: { piece: string; size: number[]; y: number };
    lamps?: { piece: string; y: number; yaw: number; at: number[][] };
    signs?: Array<[string, number, number, number]>;
    pillars?: { piece: string; rows: number[]; at: number[][] };
    cover: Array<[string, number, number, number, number?]>;
    spawns: number[][];
    zones: number[][];
    clear: number;
    shadow: number;
  };
  const AR = R.arenas as { list: ArenaRule[] } | undefined;
  if (AR) {
    const out: Record<string, unknown> = {};
    for (const A of AR.list) {
      const [ax, az] = A.at;
      const [hx, hz] = A.half;
      const put = (name: string, x: number, z: number, yaw: number, mode: Place[5], y = 0) => placeAt(A.chunk, "arena", name, ax + x, az + z, ((yaw % 360) + 360) % 360, mode, { y });
      // the floor, tiled over the room (drawn only: the world's floor is the ground at 0 everywhere)
      const [fw, fd] = A.floor.size;
      for (let x = -hx + fw / 2; x < hx; x += fw) for (let z = -hz + fd / 2; z < hz; z += fd) put(A.floor.piece, x, z, 0, "g");
      // the walls, each side a row of panels centred on it and long enough to close the corners (a side's last panel
      // runs on past the corner, behind the next side's wall, where nobody stands)
      const W = A.walls;
      const sides: Array<{ id: string; c: number[]; along: "x" | "z"; len: number; inward: Pt }> = [
        { id: "n", c: [0, -hz - W.thick / 2], along: "x", len: 2 * (hx + W.thick), inward: [0, 1] },
        { id: "s", c: [0, hz + W.thick / 2], along: "x", len: 2 * (hx + W.thick), inward: [0, -1] },
        { id: "w", c: [-hx - W.thick / 2, 0], along: "z", len: 2 * hz, inward: [1, 0] },
        { id: "e", c: [hx + W.thick / 2, 0], along: "z", len: 2 * hz, inward: [-1, 0] },
      ];
      // (`front` the way the face wanted inside looks unturned, each side's panels turned so it looks into the room: the pack's
      // street wall is drawn from one side only, its panels concrete one side and plaster the other)
      const facing = (s: { inward: Pt }) => [0, 90, 180, 270].find((y) => {
        const [fx, fz] = rotY(y, W.front![0], W.front![1]);
        return fx * s.inward[0] + fz * s.inward[1] > 0.99;
      })!;
      // (the panel's own long axis: the pack's wall panels are long in x, its street wall long in z)
      const own = piece(W.piece).row.size!;
      // (and its rows reach the room's top: the page's checks read `top`)
      if (Math.abs(W.rows[W.rows.length - 1] + own[1] - W.top) > 0.05) throw new Error(`the ${A.id} arena's walls reach ${W.rows[W.rows.length - 1] + own[1]} m, not their top ${W.top}`);
      const longX = own[0] >= own[2];
      for (const s of sides) {
        const n = Math.ceil(s.len / W.long - 1e-6);
        for (let i = 0; i < n; i++) {
          const t = -((n - 1) * W.long) / 2 + i * W.long;
          const [x, z] = s.along === "x" ? [t, s.c[1]] : [s.c[0], t];
          const yaw = W.front ? facing(s) : (s.along === "x") === longX ? 0 : 90;
          W.rows.forEach((y, row) => {
            const win = W.windows && W.windows.row === row && W.windows.sides.includes(s.id) && W.windows.at.includes(i);
            put(win ? W.windows!.piece : W.piece, x, z, yaw, "o", y);
          });
        }
      }
      // the roof, tiled over the room as the floor is, its underside at `y`: a hall's ceiling
      if (A.roof) {
        const [rw, rd] = A.roof.size;
        const r = piece(A.roof.piece).row;
        for (let x = -hx + rw / 2; x < hx; x += rw) for (let z = -hz + rd / 2; z < hz; z += rd) put(A.roof.piece, x, z, 0, "o", A.roof.y - r.min![1]);
      }
      // the lamps (a hall's are the base's own ceiling lamp, so the page's fill lights stand under them: neonmap.ts
      // FILL) and the signs on the walls, turned to the middle
      if (A.lamps) for (const [x, z] of A.lamps.at) put(A.lamps.piece, x, z, A.lamps.yaw, "g", A.lamps.y);
      for (const [name, x, z, y] of A.signs ?? []) put(name, x, z, Math.round(yawToward(-x, -z) / 90) * 90, "g", y);
      // the cover and the pillars, each laid twice, the second half a turn about the middle
      const cover: Array<{ x0: number; x1: number; z0: number; z1: number; top: number }> = [];
      for (const [x, z] of A.pillars?.at ?? []) for (const k of [1, -1]) A.pillars!.rows.forEach((y) => cover.push(put(A.pillars!.piece, k * x, k * z, 0, "o", y)));
      for (const [name, x, z, yaw, y] of A.cover) for (const k of [1, -1]) cover.push(put(name, k * x, k * z, yaw + (k < 0 ? 180 : 0), "o", y ?? 0));
      // the spawns in opposite pairs, each facing the middle (a yaw of b faces back along the bearing b, arenas/centre.ts),
      // and none of them, nor the middle's circle, within `clear` of the cover
      const spawns = A.spawns.flatMap(([x, z]) => [[x, z], [-x, -z]]).map(([x, z]) => [ax + x, az + z, +((Math.atan2(x, z) * 180) / Math.PI).toFixed(1)]);
      const near = (x: number, z: number, r: number) => cover.find((b) => x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r);
      for (const [x, z] of [...spawns, [ax, az]]) {
        const r = x === ax && z === az ? A.clear + 3.5 : A.clear;
        const hit = near(x, z, r);
        if (hit) throw new Error(`the ${A.id} arena's ${x === ax && z === az ? "middle" : `spawn at ${(x - ax).toFixed(1)}, ${(z - az).toFixed(1)}`} is within ${r} m of its cover at x ${(hit.x0 - ax).toFixed(1)} to ${(hit.x1 - ax).toFixed(1)}, z ${(hit.z0 - az).toFixed(1)} to ${(hit.z1 - az).toFixed(1)}`);
      }
      out[A.id] = { chunk: A.chunk, at: A.at, half: A.half, roof: A.roof?.y ?? null, shadow: A.shadow, spawns, zones: A.zones.map(([x, z]) => [ax + x, az + z]) };
      console.log(`the ${A.id} arena at ${ax}, ${az}: ${2 * hx} by ${2 * hz} m, ${chunks.get(A.chunk)!.place.length} pieces, ${cover.length} of them cover, ${spawns.length} spawns`);
    }
    cfg.arenas = out;
  }
}
cfg.chunks = Object.fromEntries([...chunks].sort((a, b) => a[0].localeCompare(b[0])));
cfg.measured = { placements: [...chunks.values()].reduce((a, c) => a + c.place.length, 0), pieces: new Set([...chunks.values()].flatMap((c) => c.place.map((p) => p[0]))).size };
writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 1) + "\n");
const tris = [...chunks.values()].flatMap((c) => c.place).reduce((a, p) => a + (byName.get(p[0])?.tris ?? 0), 0);
console.log(`${cfg.measured.placements} placements of ${cfg.measured.pieces} pieces in ${chunks.size} chunks, ${(tris / 1e6).toFixed(2)}M triangles`);
for (const [k, c] of chunks) console.log(`  ${k}: ${c.place.length} placements, ${(c.place.reduce((a, p) => a + (byName.get(p[0])?.tris ?? 0), 0) / 1000).toFixed(0)}k triangles`);
