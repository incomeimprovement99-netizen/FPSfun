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
  for (const z of [hallRect[2] + capLen, hallRect[3]]) {
    pivot("c-station", Q.cap, qx, sy, z, -90);
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
