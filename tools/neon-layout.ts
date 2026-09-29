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
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const CFG_FILE = join(ROOT, "src", "config", "neonmap.json");
const PAID = process.env.PAID_DIR ?? "C:/Users/jwilb/Downloads/speedkills-paid";
type Row = { path: string; size: number[] | null; min: number[] | null; max: number[] | null; tris: number };
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
type Place = [string, number, number, number, number, "g" | "s" | "o", string?];
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
function placeAt(chunk: string, sector: string, name: string, cx: number, cz: number, yaw: number, mode: Place[5], o: { y?: number; bottom?: boolean; mat?: string } = {}): { x0: number; x1: number; z0: number; z1: number; top: number } {
  const { key, row } = piece(name);
  const [fx0, fx1, fz0, fz1] = turned(row, yaw);
  const px = cx - (fx0 + fx1) / 2;
  const pz = cz - (fz0 + fz1) / 2;
  // by default the piece's own zero is the ground (a building's ground floor, whatever lies under it); `bottom` puts its
  // lowest point there instead (High City's towers, whose zero is their roof)
  const py = (o.y ?? 0) - (o.bottom ? row.min![1] : 0);
  add(chunk, sector, [key, +px.toFixed(3), +py.toFixed(3), +pz.toFixed(3), yaw, mode, ...(o.mat ? [o.mat] : [])] as Place);
  return { x0: cx - (fx1 - fx0) / 2, x1: cx + (fx1 - fx0) / 2, z0: cz - (fz1 - fz0) / 2, z1: cz + (fz1 - fz0) / 2, top: py + row.max![1] };
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
  cfg.tallest = { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, top: +b.top.toFixed(2) };
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
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        if (i === 1 && j === 1) continue; // the yard
        const cx = sx * (o0 + cell * (i + 0.5));
        const cz = sz * (o0 + cell * (j + 0.5));
        // facing out to the nearer street: toward the middle's street on the inner rows, the ring on the outer
        const faceX = i === 0 ? -sx : i === 2 ? sx : 0;
        const faceZ = j === 0 ? -sz : j === 2 ? sz : 0;
        const face = Math.abs(faceZ) >= Math.abs(faceX) ? (faceZ > 0 ? 0 : 180) : faceX > 0 ? 90 : 270;
        // a tall one on the block's inner corner, low ones round it
        const pool: string[] = i === 0 && j === 0 ? L.tall : L.low;
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
for (let x = -R.extent; x < R.extent; x += T)
  for (let z = -R.extent; z < R.extent; z += T) {
    const cx = x + T / 2;
    const cz = z + T / 2;
    if (noGround.some(([x0, x1, z0, z1]) => x >= x0 - 1e-6 && x + T <= x1 + 1e-6 && z >= z0 - 1e-6 && z + T <= z1 + 1e-6)) continue;
    const sector = sectorAt(cx, cz);
    const chunk = sector === "c" ? "c-ground" : `ground-${sector}`;
    // (the base is 10 m square from its pivot toward -z: placed by its middle)
    placeAt(chunk, sector, R.ground.tile, cx, cz, 0, "g", road(cx, cz) ? { mat: R.ground.road } : {});
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
