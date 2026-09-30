// The map made of Daelonik's Neon City (Phase 28, docs/PHASE_28_PLAN_THE_CENTRE_FROM_NEON_CITY.md): where every piece
// goes, from the plan's rules and the pieces' measured bounds (tools/import-neon.ts NEON=catalogue), written to
// src/config/neonmap.json for the bake (NEON=bake) and the game (src/game/neonmap.ts). A piece is placed by its measured
// footprint, never its pivot: High City's towers hang 26 m under theirs, and the realistic buildings' pivots are at a
// corner of their basement.
//
// Map-local metres, x east and z south, the ground at y 0, the map to 152 either way (city.json sectors). Every number
// that shapes the map is in the config's `rules`, read here; this file only applies them.
//
// Run: npx tsx tools/neon-layout.ts   (needs the catalogue: NEON=catalogue npx tsx tools/import-neon.ts)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

/** place a piece so its turned footprint's middle is at (cx, cz) and its base (its measured bottom, or `base`) at y */
function placeAt(chunk: string, sector: string, name: string, cx: number, cz: number, yaw: number, mode: Place[5], o: { y?: number; bottom?: boolean; mat?: string; without?: string[] } = {}): { x0: number; x1: number; z0: number; z1: number; top: number; px: number; pz: number } {
  const { key, row } = piece(name);
  const [fx0, fx1, fz0, fz1] = turned(row, yaw);
  const px = cx - (fx0 + fx1) / 2;
  const pz = cz - (fz0 + fz1) / 2;
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
// The road: the centre's two streets each way, out to the map's edge, and its ring; everything else the pack's pavement.
// Tiles on a 10 m grid, the carriageways' edges on it (rules: streets, ring)
const T = R.tile;
const inBand = (v: number, a: number, b: number) => v > a - 1e-6 && v < b + 1e-6;
const road = (x: number, z: number): boolean => {
  const C = R.streets.centres as number[];
  const hw = R.streets.road / 2;
  if (C.some((c) => inBand(x, c - hw, c + hw) || inBand(z, c - hw, c + hw))) return true;
  const [r0, r1] = R.ring;
  const inRingX = Math.abs(x) >= r0 && Math.abs(x) <= r1 && Math.abs(z) <= r1;
  const inRingZ = Math.abs(z) >= r0 && Math.abs(z) <= r1 && Math.abs(x) <= r1;
  return inRingX || inRingZ;
};
/** the footprints the ground is left out under (a building's own floor is its ground there, and its basement goes down) */
const noGround: Array<[number, number, number, number]> = [];

// ---------------------------------------------------------------- the middle block: the tallest building
{
  const M = R.middle;
  const b = placeAt("c-middle", "c", M.building, 0, 0, M.yaw, "o");
  noGround.push([b.x0, b.x1, b.z0, b.z1]);
  cfg.tallest = { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, top: +b.top.toFixed(2), foot: +piece(M.building).row.min![1].toFixed(2) };
}

// ---------------------------------------------------------------- the high city: the four axis blocks
{
  const H = R.high;
  const [a, b] = R.blocks.inner; // the axis blocks' span across (-27.5 to 27.5)
  const [o0, o1] = R.blocks.outer; // and their span out from the middle (42.5 to 87.5)
  for (const dir of ["n", "s", "w", "e"] as const) {
    const spec = H[dir];
    const along = dir === "n" || dir === "s";
    const sgn = dir === "n" || dir === "w" ? -1 : 1;
    // the big piece fronts the street toward the middle; its outer side the ring's, with a yard between
    const depth = spec.depth;
    const mid = sgn * (o0 + depth / 2);
    const cx = along ? (a + b) / 2 : mid;
    const cz = along ? mid : (a + b) / 2;
    placeAt(`c-${dir}`, "c", spec.piece, cx, cz, spec.yaw, "s", { bottom: true });
    // a row of the smaller towers along the ring's side
    let u = a + 1;
    let k = 0;
    while (u < b - 4) {
      const name = spec.row[k % spec.row.length];
      const { row } = piece(name);
      const [fx0, fx1, fz0, fz1] = turned(row, spec.rowYaw);
      const w = along ? fx1 - fx0 : fz1 - fz0;
      const d = along ? fz1 - fz0 : fx1 - fx0;
      if (u + w > b) break;
      const out = sgn * (o1 - d / 2);
      placeAt(`c-${dir}`, "c", name, along ? u + w / 2 : out, along ? out : u + w / 2, spec.rowYaw, "s", { bottom: true });
      u += w + H.gap;
      k++;
    }
  }
}

// ---------------------------------------------------------------- the low city: the four corner blocks
{
  const L = R.low;
  const [o0, o1] = R.blocks.outer;
  const cell = (o1 - o0) / 3;
  for (const [sx, sz, sector] of [
    [-1, -1, "c"],
    [1, -1, "c"],
    [-1, 1, "c"],
    [1, 1, "c"],
  ] as const) {
    const chunk = `c-${sz < 0 ? "n" : "s"}${sx < 0 ? "w" : "e"}`;
    let last = "";
    // The rooms to fight in (rules.low.rooms): a realistic building of the pack's, its floors, stairs and rooms its own
    // triangles, on the block's inner corner over the four cells there (the yard among them), turned to face the middle
    const rooms = L.rooms ? piece(L.rooms.piece).row : null;
    if (rooms) {
      const [fx0, fx1, fz0, fz1] = turned(rooms, L.rooms.face[`${sx},${sz}`]);
      if (fx1 - fx0 > 2 * cell || fz1 - fz0 > 2 * cell) throw new Error(`${L.rooms.piece} does not fit two cells`);
      placeAt(chunk, "c", L.rooms.piece, sx * (o0 + cell), sz * (o0 + cell), L.rooms.face[`${sx},${sz}`], "o");
    }
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        if (i === 1 && j === 1) continue; // the yard
        if (rooms && i < 2 && j < 2) continue;
        const cx = sx * (o0 + cell * (i + 0.5));
        const cz = sz * (o0 + cell * (j + 0.5));
        // facing out to the nearer street: toward the middle's street on the inner rows, the ring on the outer
        const faceX = i === 0 ? -sx : i === 2 ? sx : 0;
        const faceZ = j === 0 ? -sz : j === 2 ? sz : 0;
        const face = Math.abs(faceZ) >= Math.abs(faceX) ? (faceZ > 0 ? 0 : 180) : faceX > 0 ? 90 : 270;
        // a tall one on the block's inner corner, low ones round it; with the rooms there, on its outer corner, so the
        // block keeps a roof high over the streets
        const tallAt = rooms ? 2 : 0;
        const pool: string[] = i === tallAt && j === tallAt ? L.tall : L.low;
        let name = pool[Math.floor(rnd() * pool.length)];
        for (let tries = 0; name === last && tries < 5; tries++) name = pool[Math.floor(rnd() * pool.length)];
        last = name;
        const { row } = piece(name);
        const [fx0, fx1, fz0, fz1] = turned(row, face);
        if (fx1 - fx0 > cell + L.overhang || fz1 - fz0 > cell + L.overhang) throw new Error(`${name} does not fit a ${cell} m cell`);
        // (a realistic building has its rooms to walk: its own triangles; any other is solid to its top)
        placeAt(chunk, sector, name, cx, cz, face, name.startsWith("Neon Building ") ? "o" : "s");
      }
  }
}

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
  /** a side's wall segment from `a` left out: a hall's door */
  const door = (side: string, a: number) => (C.halls as Array<{ side: string; at: number }>).some((h) => h.side === side && Math.abs(h.at - a) < 1e-6);
  // The wall is one-sided, its face toward `faces` in its own frame (measured off its triangles): turned so the face looks
  // back into the court or the hall. Turned 90 degrees at a time, its +x goes to -z, -x, +z (tools/import-neon.ts place)
  const turns = ["+x", "-z", "-x", "+z"];
  const yawFacing = (dir: string) => ((turns.indexOf(dir) - turns.indexOf(C.faces) + 4) % 4) * 90;
  // along x at z0 and z1, along z at x0 and x1, each wall just outside the hole, its face on the hole's edge
  for (let x = x0; x < x1 - 1e-6; x += len) {
    if (!door("n", x)) placeAt("c-court", "c", C.wall, x + len / 2, z0 - thick / 2, yawFacing("+z"), "o", { y: foot });
    if (!door("s", x)) placeAt("c-court", "c", C.wall, x + len / 2, z1 + thick / 2, yawFacing("-z"), "o", { y: foot });
  }
  for (let z = z0; z < z1 - 1e-6; z += len) {
    if (!door("w", z)) placeAt("c-court", "c", C.wall, x0 - thick / 2, z + len / 2, yawFacing("+x"), "o", { y: foot });
    if (!door("e", z)) placeAt("c-court", "c", C.wall, x1 + thick / 2, z + len / 2, yawFacing("-x"), "o", { y: foot });
  }
  // The halls: the pack's metro corridors off the court through its doors, out under the plaza on the court's floor,
  // floored with the pack's tiles and closed at their far end with the court's wall (a corridor is open at both ends and
  // has no floor of its own). Each one's rectangle, for the game to lower its floor in and lay the street's slab over
  const halls: Array<{ x0: number; x1: number; z0: number; z1: number; slab: number[]; route?: number[][] }> = [];
  /** the ground's 10 m tiles over a rectangle (map-local) taken up and laid again in the pack's smaller tile of the same
   * material, but for the rectangle itself: an opening in the street (the tiles are mapped by the metre, 0.1 of their
   * texture a metre whatever their size, so the small ones join the big ones seamlessly) */
  const openGround = (ox0: number, ox1: number, oz0: number, oz1: number): void => {
    const g = chunks.get("c-ground")!;
    const big = piece(R.ground.tile);
    const small = piece(C.entrance.patch);
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
  /** the turn that points a piece's own -z (an entrance's landing) the way given */
  const yawLanding = (dir: string) => ({ "-z": 0, "-x": 90, "+z": 180, "+x": 270 })[dir]!;
  for (const h of C.halls as Array<{ side: "n" | "s" | "w" | "e"; at: number; pieces: string[]; entrance?: boolean }>) {
    const alongX = h.side === "w" || h.side === "e";
    const out = h.side === "n" || h.side === "w" ? -1 : 1;
    const start = { n: z0, s: z1, w: x0, e: x1 }[h.side];
    const across = h.at + len / 2;
    /** a spot `d` metres out from the court's edge on the hall's middle line */
    const spot = (d: number): [number, number] => (alongX ? [start + out * d, across] : [across, start + out * d]);
    let d = 0;
    for (const name of h.pieces) {
      const row = piece(name).row;
      if (Math.abs(row.size![0] - len) > 0.05) throw new Error(`hall piece ${name} is ${row.size![0]} m wide, the door ${len} m`);
      placeAt("c-court", "c", name, ...spot(d + row.size![2] / 2), alongX ? 90 : 0, "o", { y: foot });
      d += row.size![2];
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
    // (its end wall looks back down the hall, toward the court)
    placeAt("c-court", "c", C.wall, ...spot(d + thick / 2), yawFacing(back), "o", { y: foot });
    const [hx0, hx1, hz0, hz1] = rect(0, d + thick);
    halls.push({ x0: hx0, x1: hx1, z0: hz0, z1: hz1, slab: rect(0, slabTo), ...(route ? { route } : {}) });
  }
  cfg.court = { x0, x1, z0, z1, y: foot, halls };
}

// The centre's streets dressed with the pack's own (rules.dress): its street lamps along both kerbs, cars parked in the
// lanes by the kerbs (crouching cover in the street), and cars flying over the streets (the store's pictures have them,
// out of reach and so with no collision). Clear of the crossings, the ring road, the jump pads and the metro's kiosks
{
  const D = R.dress;
  const C = R.streets.centres as number[];
  const hw = R.streets.road / 2;
  const edge = R.centre;
  const pads = ((cfg.pads ?? []) as Array<{ pad: number[] }>).map((q) => q.pad);
  const kiosks = ((cfg.court?.halls ?? []) as Array<{ route?: number[][]; x0: number; x1: number; z0: number; z1: number }>).filter((h) => h.route);
  /** a spot along a street clear of what is there (map-local) */
  const nearRoad = (v: number) => C.some((c) => Math.abs(v - c) < hw + D.crossing);
  const clear = (x: number, z: number, r: number): boolean =>
    // not in a crossing (near a road each way), on a pad or by a kiosk
    !(nearRoad(x) && nearRoad(z)) &&
    !pads.some(([px, pz]) => Math.hypot(px - x, pz - z) < r + D.padClear) &&
    !kiosks.some((h) => x > h.x0 - r && x < h.x1 + r && z > h.z0 - r && z < h.z1 + r);
  for (const c of C)
    for (const along of ["x", "z"] as const)
      for (const side of [-1, 1]) {
        const kerb = c + side * hw;
        const at = (u: number, off: number): [number, number] => (along === "x" ? [u, kerb + off] : [kerb + off, u]);
        const yawAlong = along === "x" ? 90 : 0;
        // the lamps on the pavement, `inset` in from the kerb, their arms along it
        for (let u = -edge + D.lamp.every / 2; u < edge; u += D.lamp.every) {
          const [x, z] = at(u, side * D.lamp.inset);
          if (Math.abs(u) > R.ring[0] - 2 || !clear(x, z, 1)) continue;
          placeAt("c-dress", "c", D.lamp.piece, x, z, along === "x" ? 0 : 90, "o");
        }
        // the cars in the lane by the kerb, a seeded gap apart
        for (let u = -edge + 6 + rnd() * D.cars.gap[1]; u < edge - 6; u += D.cars.gap[0] + rnd() * (D.cars.gap[1] - D.cars.gap[0])) {
          if (rnd() > D.cars.chance) continue;
          const [x, z] = at(u, -side * D.cars.lane);
          if (Math.abs(u) > R.ring[0] - 4 || !clear(x, z, 3)) continue;
          const name = D.cars.pieces[Math.floor(rnd() * D.cars.pieces.length)];
          placeAt("c-dress", "c", name, x, z, yawAlong + (rnd() < 0.5 ? 0 : 180), "o", { bottom: true });
        }
      }
  // the flying cars, over the streets out of reach
  for (let i = 0; i < D.flying.count; i++) {
    const c = C[Math.floor(rnd() * C.length)];
    const u = -edge + 10 + rnd() * (2 * edge - 20);
    const along = rnd() < 0.5;
    const [x, z] = along ? [u, c + (rnd() - 0.5) * hw] : [c + (rnd() - 0.5) * hw, u];
    const y = D.flying.height[0] + rnd() * (D.flying.height[1] - D.flying.height[0]);
    placeAt("c-dress", "c", D.flying.pieces[Math.floor(rnd() * D.flying.pieces.length)], x, z, (along ? 90 : 0) + (rnd() < 0.5 ? 0 : 180), "g", { y });
  }
}

// The fronts along the centre's streets and its ring hung with the pack's neon signs (rules.signs): found in the last
// bake's collision (src/config/neon/neonmap.solids.json; a sign changes no building's): from the pavement, at a sign's
// height, straight at the block to the first front within `reach`, kept where the front is flat across the sign's width
// and `apart` from the last on that side. A sign is lit on one side only, its own +z (from behind its letters read
// mirrored in bare metal), so it hangs with that side to the street; it collides with nothing
{
  const S = R.signs;
  const solidsFile = join(ROOT, "src", "config", "neon", "neonmap.solids.json");
  const boxes: number[][] = existsSync(solidsFile) ? JSON.parse(readFileSync(solidsFile, "utf8")).solids : [];
  /** how far from (x, z) along (dx, dz) the first box standing across height y is, within `reach` */
  const faceAt = (x: number, z: number, dx: number, dz: number, y: number): number => {
    let best = Infinity;
    for (const [x0, x1, z0, z1, y0, y1] of boxes) {
      if (y0 > y || y1 < y) continue;
      // the ray's entry into the box's footprint (a slab test on the one axis it runs along)
      if (dx !== 0) {
        if (z < z0 || z > z1) continue;
        const t = dx > 0 ? x0 - x : x - x1;
        if (t >= 0 && t < best && (dx > 0 ? x1 > x : x0 < x)) best = t;
      } else {
        if (x < x0 || x > x1) continue;
        const t = dz > 0 ? z0 - z : z - z1;
        if (t >= 0 && t < best && (dz > 0 ? z1 > z : z0 < z)) best = t;
      }
    }
    return best;
  };
  const C = R.streets.centres as number[];
  const hw = R.streets.road / 2;
  // each street's two sides and the ring's inner one: the road's middle, its half width, the way to the block beyond
  const ringHalf = (R.ring[1] - R.ring[0]) / 2;
  const lines: Array<[number, number, number]> = [];
  for (const c of C) for (const side of [-1, 1]) lines.push([c, hw, side]);
  for (const r of [-1, 1]) lines.push([(r * (R.ring[0] + R.ring[1])) / 2, ringHalf, -r]);
  let hung = 0;
  for (const [c, half, side] of lines)
    for (const along of ["x", "z"] as const) {
      // the line on the pavement a metre past the kerb
      const at = c + side * (half + 1);
      let lastU = -Infinity;
      for (let u = -R.centre + 2; u < R.centre - 2; u += S.step) {
        if (u - lastU < S.apart || rnd() > S.chance) continue;
        const name = S.pieces[Math.floor(rnd() * S.pieces.length)];
        const row = piece(name).row;
        const w = row.size![0];
        const y = S.height[0] + rnd() * (S.height[1] - S.height[0]);
        const [x, z] = along === "x" ? [u, at] : [at, u];
        const [dx, dz] = along === "x" ? [0, side] : [side, 0];
        const d = faceAt(x, z, dx, dz, y);
        if (d > S.reach) continue;
        // flat across its width: the front as near at each end as in the middle
        const ends = [-w / 2, w / 2].map((o) => faceAt(along === "x" ? x + o : x, along === "x" ? z : z + o, dx, dz, y));
        if (ends.some((e) => Math.abs(e - d) > S.flat)) continue;
        // hung with its +z toward the street: its back, `row.min z` behind its pivot, on the front
        const [fx, fz] = [x + dx * (d + row.min![2]), z + dz * (d + row.min![2])];
        const yaw = along === "x" ? (side > 0 ? 180 : 0) : side > 0 ? 270 : 90;
        placeAt("c-signs", "c", name, fx, fz, yaw, "g", { y: y - (row.min![1] + row.max![1]) / 2 });
        lastU = u;
        hung++;
      }
    }
  console.log(`signs: ${hung} hung on the fronts`);
}

// the kerbs along each carriageway's edge where pavement meets it, and the dashed line down its middle
{
  const C = R.streets.centres as number[];
  const hw = R.streets.road / 2;
  const K = R.streets.kerb;
  const edge = R.extent;
  const chunkAt = (x: number, z: number) => (sectorAt(x, z) === "c" ? "c-ground" : `ground-${sectorAt(x, z)}`);
  for (const c of C)
    for (const side of [-1, 1]) {
      const at = c + side * hw;
      for (let u = -edge + K.every / 2; u < edge; u += K.every) {
        // the street along z at x = at, and the one along x at z = at: a kerb where the far side is pavement
        if (!road(at + side * 0.5, u)) placeAt(chunkAt(at, u), sectorAt(at, u), K.piece, at, u, 0, "g");
        if (!road(u, at + side * 0.5)) placeAt(chunkAt(u, at), sectorAt(u, at), K.piece, u, at, 90, "g");
      }
    }
  const [r0, r1] = R.ring;
  const crossing = (u: number) => C.some((q) => Math.abs(u - q) < hw + 1) || (Math.abs(u) > r0 - 1 && Math.abs(u) < r1 + 1);
  for (const c of C)
    for (let u = -edge + R.streets.line.every / 2; u < edge; u += R.streets.line.every) {
      if (crossing(u)) continue;
      placeAt(chunkAt(c, u), sectorAt(c, u), R.streets.line.piece, c, u, 90, "g");
      placeAt(chunkAt(u, c), sectorAt(u, c), R.streets.line.piece, u, c, 0, "g");
    }
}

cfg.chunks = Object.fromEntries([...chunks].sort((a, b) => a[0].localeCompare(b[0])));
cfg.measured = { placements: [...chunks.values()].reduce((a, c) => a + c.place.length, 0), pieces: new Set([...chunks.values()].flatMap((c) => c.place.map((p) => p[0]))).size };
writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 1) + "\n");
const tris = [...chunks.values()].flatMap((c) => c.place).reduce((a, p) => a + (byName.get(p[0])?.tris ?? 0), 0);
console.log(`${cfg.measured.placements} placements of ${cfg.measured.pieces} pieces in ${chunks.size} chunks, ${(tris / 1e6).toFixed(2)}M triangles`);
for (const [k, c] of chunks) console.log(`  ${k}: ${c.place.length} placements, ${(c.place.reduce((a, p) => a + (byName.get(p[0])?.tris ?? 0), 0) / 1000).toFixed(0)}k triangles`);
