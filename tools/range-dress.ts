// The firing range as a street of the Neon City (docs/PLAN_RANGE_NEON.md; the owner, 2026-10-18: "redo the range so
// that nothing is the old UI anymore, its all built off the city. It shouldn't be big though ... it should just be like
// a section on the map already and then have our range stuff setup for it"). The range keeps its own colliders
// (src/game/range.ts); what is drawn over them is the bundle's road, sidewalks and facades, its street lights and its
// English signs, from src/config/rangedress.json, into a file of its own as the tutorial's is (tools/tutorial-dress.ts):
// the range is the first thing a player loads, so it is small, not the city's 155 MB.
//
// Run: NEON=none GAME=speedkills npx tsx tools/range-dress.ts (NEON=none keeps tools/import-neon.ts's own modes from
// running when it is imported). Only local tools touch the bought files, and nothing here uploads them.
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { helpers, neonPack } from "./import-neon";
import { bake, IMPORT_STATS, mul, readMaterial, Textures, writePack, type Baked, type Draw, type M4, type MatInfo } from "./import-city";
import { BasisPool } from "./basis-pool";
import dress from "../src/config/rangedress.json";

const ROOT = join(import.meta.dirname, "..");
const PAID = process.env.PAID_DIR ?? "C:/Users/jwilb/Downloads/speedkills-paid";
const { pack, res } = neonPack();
const guidOf = new Map<string, string>();
for (const [g, p] of pack.guidPath) guidOf.set(p, g);
const pathOf = new Map<string, string>();
for (const p of pack.pathFile.keys()) {
  const k = p.split("City Builder/")[1];
  if (k) pathOf.set(k, p);
}
const mats = new Map<string, MatInfo | null>();
const catalogue = JSON.parse(readFileSync(join(PAID, "neon", "catalogue.json"), "utf8")) as Array<{ path: string; materials: string[] }>;
const banned = (JSON.parse(readFileSync(join(ROOT, "src", "config", "neonmap.json"), "utf8")).rules.banned?.pieces ?? []) as string[];

/** a material of the bundle by its name, read */
function material(name: string): string {
  const g = pack.matFor(name);
  if (!g) throw new Error(`no material ${name} in the bundle`);
  if (!mats.has(g)) mats.set(g, readMaterial(pack, g));
  return g;
}

/** metres a texture repeat covers, as the bundle's own pieces wear the material (tools/tutorial-dress.ts metresPerRepeat) */
const repeatOf = new Map<string, number>();
function metresPerRepeat(name: string): number {
  const hit = repeatOf.get(name);
  if (hit) return hit;
  const g = material(name);
  const ratios: number[] = [];
  for (const row of catalogue.filter((r) => r.materials.includes(name)).slice(0, 8)) {
    const p = pathOf.get(row.path.split("City Builder/")[1] ?? row.path);
    if (!p) continue;
    const b = bake(pack, res, row.path, guidOf.get(p)!, mats);
    const gr = b?.groups.get(g);
    if (!gr) continue;
    for (let t = 0; t < gr.idx.length; t += 3)
      for (const [a, c] of [
        [gr.idx[t], gr.idx[t + 1]],
        [gr.idx[t + 1], gr.idx[t + 2]],
      ]) {
        const len = Math.hypot(gr.pos[a * 3] - gr.pos[c * 3], gr.pos[a * 3 + 1] - gr.pos[c * 3 + 1], gr.pos[a * 3 + 2] - gr.pos[c * 3 + 2]);
        const uv = Math.hypot(gr.uv[a * 2] - gr.uv[c * 2], gr.uv[a * 2 + 1] - gr.uv[c * 2 + 1]);
        if (len > 0.05 && uv > 1e-3) ratios.push(len / uv);
      }
  }
  if (!ratios.length) throw new Error(`no piece wears ${name}: no scale to measure`);
  ratios.sort((x, y) => x - y);
  const m = ratios[Math.floor(ratios.length / 2)];
  repeatOf.set(name, m);
  return m;
}

/** flat ground in the bundle's materials, laid by the world's axes at each material's measured scale */
class Ground {
  readonly groups: Baked["groups"] = new Map();
  rect(name: string, x0: number, z0: number, x1: number, z1: number, y = 0.006): void {
    const g = material(name);
    const rep = metresPerRepeat(name);
    let gr = this.groups.get(g);
    if (!gr) this.groups.set(g, (gr = { mat: g, pos: [], nrm: [], uv: [], idx: [] }));
    // in cells of at most 10 m, so a texture's coordinates stay small far from the middle
    for (let x = x0; x < x1 - 1e-6; x += 10)
      for (let z = z0; z < z1 - 1e-6; z += 10) {
        const [a, c, d, e] = [x, Math.min(x1, x + 10), z, Math.min(z1, z + 10)];
        const base = gr.pos.length / 3;
        for (const [px, pz] of [
          [a, d],
          [a, e],
          [c, e],
          [c, d],
        ]) {
          gr.pos.push(px, y, pz);
          gr.nrm.push(0, 1, 0);
          gr.uv.push(px / rep, 1 - pz / rep);
        }
        gr.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
  }
  /** a quad, corners round its front, its texture laid by the world's axes at the material's scale (a wall's up it) */
  quad(name: string, c: number[][], n: [number, number, number]): void {
    const g = material(name);
    const rep = metresPerRepeat(name);
    let gr = this.groups.get(g);
    if (!gr) this.groups.set(g, (gr = { mat: g, pos: [], nrm: [], uv: [], idx: [] }));
    const base = gr.pos.length / 3;
    const ax = Math.abs(n[0]) > 0.5 ? [2, 1] : Math.abs(n[1]) > 0.5 ? [0, 2] : [0, 1];
    for (const p of c) {
      gr.pos.push(p[0], p[1], p[2]);
      gr.nrm.push(...n);
      gr.uv.push(p[ax[0]] / rep, 1 - p[ax[1]] / rep);
    }
    gr.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  /**
   * A building block beside the street: its sides in `upper` over a `groundH` band of `ground` (shop fronts), its top in
   * `roof`. The faces are cut every 10 m along and up, so a texture's coordinates stay small
   */
  block(x0: number, z0: number, x1: number, z1: number, h: number, upper: string, ground: string, groundH: number, roof: string, base = 0): void {
    const cut = (a: number, c: number, at: number[] = []) => {
      const out = [a];
      for (let v = a + 10; v < c - 1e-6; v += 10) out.push(v);
      for (const v of at) if (v > a + 1e-3 && v < c - 1e-3) out.push(v);
      out.push(c);
      return [...new Set(out)].sort((p, q) => p - q);
    };
    // (a block from `base` up, over the gate wall, has no shop fronts)
    const ys = cut(base, h, base > 0 ? [] : [groundH]);
    // each face's corners round its front, counter-clockwise seen from outside (as tools/tutorial-dress.ts lays them: the
    // first bake had them the other way round, and every block was drawn inside out, black)
    const faces: Array<{ n: [number, number, number]; along: number[]; corners: (a: number, c: number, ya: number, yb: number) => number[][] }> = [
      { n: [1, 0, 0], along: cut(z0, z1), corners: (a, c, ya, yb) => [[x1, ya, a], [x1, yb, a], [x1, yb, c], [x1, ya, c]] },
      { n: [-1, 0, 0], along: cut(z0, z1), corners: (a, c, ya, yb) => [[x0, ya, c], [x0, yb, c], [x0, yb, a], [x0, ya, a]] },
      { n: [0, 0, 1], along: cut(x0, x1), corners: (a, c, ya, yb) => [[c, ya, z1], [c, yb, z1], [a, yb, z1], [a, ya, z1]] },
      { n: [0, 0, -1], along: cut(x0, x1), corners: (a, c, ya, yb) => [[a, ya, z0], [a, yb, z0], [c, yb, z0], [c, ya, z0]] },
    ];
    for (const f of faces)
      for (let i = 0; i + 1 < f.along.length; i++)
        for (let j = 0; j + 1 < ys.length; j++) {
          const [a, c, ya, yb] = [f.along[i], f.along[i + 1], ys[j], ys[j + 1]];
          const m = base === 0 && ya < groundH - 1e-3 ? ground : upper;
          this.quad(m, f.corners(a, c, ya, yb), f.n);
        }
    for (const x of cut(x0, x1).slice(0, -1).map((v, i) => [v, cut(x0, x1)[i + 1]]))
      for (const z of cut(z0, z1).slice(0, -1).map((v, i) => [v, cut(z0, z1)[i + 1]])) this.quad(roof, [[x[0], h, z[0]], [x[0], h, z[1]], [x[1], h, z[1]], [x[1], h, z[0]]], [0, 1, 0]);
  }
  baked(id: string): Baked {
    let tris = 0;
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (const g of this.groups.values()) {
      tris += g.idx.length / 3;
      for (let i = 0; i < g.pos.length; i += 3)
        for (let k = 0; k < 3; k++) {
          min[k] = Math.min(min[k], g.pos[i + k]);
          max[k] = Math.max(max[k], g.pos[i + k]);
        }
    }
    return { id, groups: this.groups, tris, min, max, faces: {}, depths: {} };
  }
}

/** a piece of the bundle where it stands: turned about y, then moved; refused if it is or holds a banned piece */
function placed(key: string, x: number, y: number, z: number, yaw: number): Array<{ d: Draw; m: M4 }> {
  const p = pathOf.get(key);
  if (!p) throw new Error(`no prefab ${key}`);
  const all = res.flatten(guidOf.get(p)!);
  const nested = all.flatMap(({ from }) => from.map((g) => pack.guidPath.get(g) ?? g)).filter((q) => banned.some((b) => q.endsWith(`/${b}`)));
  if (banned.some((b) => p.endsWith(`/${b}`)) || nested.length) throw new Error(`${key} is or holds a piece the map bans (neonmap.json rules.banned)`);
  const a = (yaw * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const at: M4 = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, x, y, z, 1];
  return all.map(({ d, m }) => ({ d, m: mul(at, m) }));
}

/** a piece's bounds as it is baked, for laying it against a wall */
const boundsOf = new Map<string, Baked>();
function bounds(key: string): Baked {
  let b = boundsOf.get(key);
  if (!b) {
    const p = pathOf.get(key);
    if (!p) throw new Error(`no prefab ${key}`);
    b = bake(pack, res, key, guidOf.get(p)!, mats) ?? undefined;
    if (!b) throw new Error(`${key} bakes nothing`);
    boundsOf.set(key, b);
  }
  return b;
}

/**
 * The range's walls by their inner face and the way they look into it (range.ts: the side walls' boxes at x plus and
 * minus 34, 1 m thick; the backstop at z -107.5, 1.5 m; the gate wall at z 8.5, 1 m), each as rangedress.json names it
 */
const WALLS = dress.walls as unknown as Record<string, { n: [number, number]; at: number }>;

/**
 * A piece against a wall: turned so its front (the pack's `front` axis, +z unless the row says otherwise) looks into the
 * range, the middle of its back on the wall's face at `along` (x for a wall across, z for a side wall) and `y` up
 */
function onWall(key: string, wall: string, along: number, y: number, front: "z" | "-z" | "x" | "-x" = "z", inset = 0, outside = false): Array<{ d: Draw; m: M4 }> {
  const w = WALLS[wall];
  if (!w) throw new Error(`no wall ${wall}`);
  const b = bounds(key);
  const [nx, nz] = w.n;
  // the yaw that turns the piece's front axis onto the wall's normal
  const local = front === "z" ? 0 : front === "-z" ? 180 : front === "x" ? 90 : -90;
  const yaw = (Math.atan2(nx, nz) * 180) / Math.PI - local;
  const [c, s] = [Math.cos((yaw * Math.PI) / 180), Math.sin((yaw * Math.PI) / 180)];
  // the middle of the back face, at the bottom, in the piece's own frame; outside the range, the front face's instead, so
  // the piece stands beyond the wall with its front on the wall's face (a building along the street)
  const mx = (b.min[0] + b.max[0]) / 2;
  const mz = (b.min[2] + b.max[2]) / 2;
  const back = (outside ? { z: [mx, b.min[1], b.max[2]], "-z": [mx, b.min[1], b.min[2]], x: [b.max[0], b.min[1], mz], "-x": [b.min[0], b.min[1], mz] } : { z: [mx, b.min[1], b.min[2]], "-z": [mx, b.min[1], b.max[2]], x: [b.min[0], b.min[1], mz], "-x": [b.max[0], b.min[1], mz] })[front];
  const turned = [c * back[0] + s * back[2], back[1], -s * back[0] + c * back[2]];
  // the face, `inset` metres out into the range from it
  const face = w.at + (nx !== 0 ? nx : nz) * inset;
  const target = nx !== 0 ? [face, y, along] : [along, y, face];
  return placed(key, target[0] - turned[0], target[1] - turned[1], target[2] - turned[2], yaw);
}

const tex = new Textures(helpers);
const pool = await BasisPool.start(PAID);
tex.pool = pool;

// DRESS=swatch: each candidate material on a 6 m block's faces at its measured scale, for tools/neongallery.html
// (?sheet=range-swatch) to choose the street's walls from
if (process.env.DRESS === "swatch") {
  const out: Baked[] = [];
  for (const name of (dress as unknown as { candidates: string[] }).candidates) {
    try {
      metresPerRepeat(name);
    } catch (e) {
      console.log(`   ${(e as Error).message}`);
      continue;
    }
    const gnd = new Ground();
    const S = 6;
    // three faces of a block: its front, its side and its top, each a quad
    for (const [n, q] of [
      [[0, 0, 1], [[0, 0, S], [S, 0, S], [S, S, S], [0, S, S]]],
      [[1, 0, 0], [[S, 0, S], [S, 0, 0], [S, S, 0], [S, S, S]]],
    ] as Array<[number[], number[][]]>) {
      const g = material(name);
      const rep = metresPerRepeat(name);
      let gr = gnd.groups.get(g);
      if (!gr) gnd.groups.set(g, (gr = { mat: g, pos: [], nrm: [], uv: [], idx: [] }));
      const base = gr.pos.length / 3;
      const ax = Math.abs(n[0]) > 0.5 ? [2, 1] : [0, 1];
      for (const pt of q) {
        gr.pos.push(...pt);
        gr.nrm.push(...n);
        gr.uv.push(pt[ax[0]] / rep, 1 - pt[ax[1]] / rep);
      }
      gr.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    out.push(gnd.baked(`${name} (${metresPerRepeat(name).toFixed(2)} m)`));
  }
  const file = join(helpers.out, "neon", "gallery", "range-swatch.glb");
  const size = await writePack(helpers, pack, out, mats, tex, 512, 256, new Set(out.map((b) => b.id)), file, true);
  console.log(`${out.length} swatches, ${(size / 1e6).toFixed(1)} MB: ${file}`);
  await pool.stop();
  process.exit(0);
}

const R = dress.roles as Record<string, string>;
const ground = new Ground();
for (const [role, x0, z0, x1, z1, y] of dress.ground as unknown as Array<[string, number, number, number, number, number?]>) ground.rect(R[role], x0, z0, x1, z1, y ?? 0.006);
const draws: Array<{ d: Draw; m: M4 }> = [];
// streets: buildings one after another along a wall from `from` to `to`, each its width along the wall, fronts on its face
type Street = { wall: string; from: number; to: number; front?: "z" | "-z" | "x" | "-x"; pieces: string[] };
for (const st of dress.streets as unknown as Street[]) {
  const dir = Math.sign(st.to - st.from);
  const front = st.front ?? "z";
  let a = st.from;
  for (let i = 0; ; i++) {
    const key = st.pieces[i % st.pieces.length];
    const b = bounds(key);
    const width = front === "z" || front === "-z" ? b.max[0] - b.min[0] : b.max[2] - b.min[2];
    if ((a + dir * width - st.to) * dir > 0.5) break;
    draws.push(...onWall(key, st.wall, a + (dir * width) / 2, 0, front, 0, true));
    a += dir * width;
  }
}
// single pieces: [piece, wall, along, up, front?] on a wall, or [piece, x, y, z, yaw] where they stand
for (const [key, a, b, c, d] of dress.pieces as unknown as Array<[string, string | number, number, number, (number | string)?]>)
  draws.push(...(typeof a === "string" ? onWall(key, a, b, c, (d as "z" | "-z" | "x" | "-x") ?? "z") : placed(key, a, b, c, (d as number) ?? 0)));

// the blocks either side of the street, across its far end and over the gate wall: [x0, z0, x1, z1, height, upper role]
const D = dress as unknown as { blockLook: { ground: string; groundH: number; roof: string }; blocks: Array<[number, number, number, number, number, string, number?]>; gateWall: Array<[number, number, number, number]>; gateZ: number };
const BL = D.blockLook;
for (const [x0, z0, x1, z1, h, up, base] of D.blocks) ground.block(x0, z0, x1, z1, h, R[up], R[BL.ground], BL.groundH, R[BL.roof], base ?? 0);
// the gate wall's face into the range, but its three gates (range.ts COURSE_GATES)
for (const [x0, x1, y0, y1] of D.gateWall) ground.quad(R.gateWall, [[x0, y0, D.gateZ], [x0, y1, D.gateZ], [x1, y1, D.gateZ], [x1, y0, D.gateZ]], [0, 0, -1]);
const g = ground.baked("range:ground");
const pieces = draws.length ? bake(pack, res, "range:pieces", "", mats, draws) : null;
const all = [g, ...(pieces ? [pieces] : [])];
const file = join(helpers.out, "neon", `range-v${dress.version}.glb`);
const size = await writePack(helpers, pack, all, mats, tex, dress.texture, dress.normal, new Set(all.map((b) => b.id)), file, true);
console.log(`the range dressed: ${g.tris} triangles of ground in ${g.groups.size} materials, ${pieces?.tris ?? 0} of pieces (${draws.length} draws), ${(size / 1e6).toFixed(2)} MB: ${file}`);
for (const [name, m] of repeatOf) console.log(`   ${name}: ${m.toFixed(2)} m a repeat`);
if (IMPORT_STATS.unresolved.size) console.log(`unresolved materials: ${[...IMPORT_STATS.unresolved.keys()].slice(0, 8).join("; ")}`);
await pool.stop();
