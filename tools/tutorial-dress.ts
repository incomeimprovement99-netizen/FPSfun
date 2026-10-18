// The tutorial dressed in the Neon City bundle (Milestone 634, docs/PLAN_TUTORIAL.md): the owner, 2026-10-17, "build it
// out of the neon city map bundle we have built our whole BR on". Its rooms keep the measured boxes the course collides
// with (src/game/courses/tutorial.ts); what is drawn over them is the bundle's own materials, each tiled at the scale
// the bundle's own pieces wear it (measured off them here, never typed), and the bundle's own pieces set about the
// rooms (src/config/tutorialdress.json). It is a file of its own, not the city's: the city's is 155 MB, and a new
// player's first click is the tutorial.
//
// Modes (DRESS=<mode>):
//   swatch   every candidate material on a 2 m cube at its measured scale, into
//            public/models/paid/neon/gallery/tutorial-swatch.glb for tools/neongallery.html (?sheet=tutorial-swatch)
//   bake     the tutorial's rooms and pieces, into public/models/paid/neon/tutorial-v<version>.glb (the page's
//            src/game/tutorialdress.ts loads it)
//
// Run: NEON=none GAME=speedkills DRESS=bake npx tsx tools/tutorial-dress.ts (NEON=none keeps tools/import-neon.ts's own
// modes from running when it is imported). Only local tools touch the bought files, and nothing here uploads them.
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { helpers, neonPack } from "./import-neon";
import { bake, IMPORT_STATS, mul, readMaterial, Textures, writePack, type Baked, type Draw, type M4, type MatInfo } from "./import-city";
import { BasisPool } from "./basis-pool";
import { courseColliders } from "../src/game/course";
import { TUTORIAL_COURSE, OUT, BACK, TURN_Z, MANTLE, WALLRUN, DASH, GLIDE } from "../src/game/courses/tutorial";
import tcfg from "../src/config/tutorial.json";
import dress from "../src/config/tutorialdress.json";

const ROOT = join(import.meta.dirname, "..");
const PAID = process.env.PAID_DIR ?? "C:/Users/jwilb/Downloads/speedkills-paid";
const mode = process.env.DRESS ?? "bake";
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

/** a material of the bundle by its name, read */
function material(name: string): string {
  const g = pack.matFor(name);
  if (!g) throw new Error(`no material ${name} in the bundle`);
  if (!mats.has(g)) mats.set(g, readMaterial(pack, g));
  return g;
}

/**
 * Metres a texture repeat covers, as the bundle's own pieces wear the material: up to eight pieces that use it baked
 * where they stand, and over their triangles' edges in that material, the median of the edge's length over its length
 * in the texture's coordinates (the material's own tiling is in those, bake() puts it there)
 */
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

/** geometry in the bundle's materials, as bake() makes it, for writePack */
class Surfaces {
  readonly groups: Baked["groups"] = new Map();
  /** a flat quad, corners in order round its front, its texture laid by the world's axes at the material's scale */
  quad(name: string, c: number[][], n: [number, number, number]): void {
    const g = material(name);
    const rep = metresPerRepeat(name);
    let gr = this.groups.get(g);
    if (!gr) this.groups.set(g, (gr = { mat: g, pos: [], nrm: [], uv: [], idx: [] }));
    const base = gr.pos.length / 3;
    // the two world axes in the face's plane: its texture runs along them, up the wall for a wall
    const ax = Math.abs(n[0]) > 0.5 ? [2, 1] : Math.abs(n[1]) > 0.5 ? [0, 2] : [0, 1];
    for (const p of c) {
      gr.pos.push(p[0], p[1], p[2]);
      gr.nrm.push(...n);
      gr.uv.push(p[ax[0]] / rep, 1 - p[ax[1]] / rep);
    }
    gr.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  /**
   * A box's faces, each the material `face` names for it (null: none), cut into cells of at most CELL metres on the
   * world's grid and each cell left out where `covered` says something stands over it: a wall's face is covered in some
   * places and not others (the block between the bays is 169 m long, a ledge stands against it here and there), and one
   * test for the whole face left the whole face out. The cells are cut at every other box's edges too (`edges`), so a
   * cell is wholly covered or wholly not: tested at its middle alone, a cell half behind a ledge was left out whole, and
   * the half above the ledge was a hole through to the next course (the owner's playtest, 2026-10-18: "see through walls /
   * areas / chunks"). A box's bottom is dressed where it stands off the floor (a lintel's underside, over every door).
   */
  box(b: { minX: number; maxX: number; base: number; top: number; minZ: number; maxZ: number }, face: (f: Face) => string | null, covered: (x: number, y: number, z: number) => boolean, edges: { x: number[]; y: number[]; z: number[] } = { x: [], y: [], z: [] }): void {
    const { minX: x0, maxX: x1, base: y0, top: y1, minZ: z0, maxZ: z1 } = b;
    const OUT = 0.02;
    const cuts = (a: number, c: number, more: number[]): number[] => {
      const out = [a];
      for (let v = Math.floor(a / CELL + 1) * CELL; v < c - 1e-6; v += CELL) out.push(v);
      for (const v of more) if (v > a + 1e-3 && v < c - 1e-3) out.push(v);
      out.push(c);
      out.sort((p, q) => p - q);
      return out.filter((v, i) => i === 0 || v - out[i - 1] > 1e-3);
    };
    const faces: Array<[Face, [number, number, number]]> = [
      ["top", [0, 1, 0]],
      ["bottom", [0, -1, 0]],
      ["px", [1, 0, 0]],
      ["nx", [-1, 0, 0]],
      ["pz", [0, 0, 1]],
      ["nz", [0, 0, -1]],
    ];
    for (const [f, n] of faces) {
      const m = face(f);
      if (!m) continue;
      if (f === "top" || f === "bottom") {
        // (a bottom only off the floor: on it, nothing sees it)
        if (f === "bottom" && y0 < 0.01) continue;
        const xs = cuts(x0, x1, edges.x);
        const zs = cuts(z0, z1, edges.z);
        for (let i = 0; i + 1 < xs.length; i++)
          for (let j = 0; j + 1 < zs.length; j++) {
            const [a, c, d, e] = [xs[i], xs[i + 1], zs[j], zs[j + 1]];
            if (f === "top") {
              if (covered((a + c) / 2, y1 + OUT, (d + e) / 2)) continue;
              this.quad(m, [[a, y1, d], [a, y1, e], [c, y1, e], [c, y1, d]], n);
            } else {
              if (covered((a + c) / 2, y0 - OUT, (d + e) / 2)) continue;
              this.quad(m, [[a, y0, d], [c, y0, d], [c, y0, e], [a, y0, e]], n);
            }
          }
        continue;
      }
      const ys = cuts(y0, y1, edges.y);
      const along = f === "px" || f === "nx" ? cuts(z0, z1, edges.z) : cuts(x0, x1, edges.x);
      for (let i = 0; i + 1 < along.length; i++)
        for (let j = 0; j + 1 < ys.length; j++) {
          const [a, c, ya, yb] = [along[i], along[i + 1], ys[j], ys[j + 1]];
          const my = (ya + yb) / 2;
          const ma = (a + c) / 2;
          if (f === "px" && !covered(x1 + OUT, my, ma)) this.quad(m, [[x1, ya, a], [x1, yb, a], [x1, yb, c], [x1, ya, c]], n);
          if (f === "nx" && !covered(x0 - OUT, my, ma)) this.quad(m, [[x0, ya, c], [x0, yb, c], [x0, yb, a], [x0, ya, a]], n);
          if (f === "pz" && !covered(ma, my, z1 + OUT)) this.quad(m, [[c, ya, z1], [c, yb, z1], [a, yb, z1], [a, ya, z1]], n);
          if (f === "nz" && !covered(ma, my, z0 - OUT)) this.quad(m, [[a, ya, z0], [a, yb, z0], [c, yb, z0], [c, ya, z0]], n);
        }
    }
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
type Face = "top" | "bottom" | "px" | "nx" | "pz" | "nz";
/** the cells a face is cut into, metres */
const CELL = 2.5;

/** a piece of the bundle where it stands: turned about y, then moved (column-major, as tools/import-neon.ts places) */
function placed(key: string, x: number, y: number, z: number, yaw: number): Array<{ d: Draw; m: M4 }> {
  const p = pathOf.get(key);
  if (!p) throw new Error(`no prefab ${key}`);
  const banned = (JSON.parse(readFileSync(join(ROOT, "src", "config", "neonmap.json"), "utf8")).rules.banned?.pieces ?? []) as string[];
  const all = res.flatten(guidOf.get(p)!);
  const nested = all.flatMap(({ from }) => from.map((g) => pack.guidPath.get(g) ?? g)).filter((q) => banned.some((b) => q.endsWith(`/${b}`)));
  if (banned.some((b) => p.endsWith(`/${b}`)) || nested.length) throw new Error(`${key} is or holds a piece the map bans (neonmap.json rules.banned)`);
  const a = (yaw * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const at: M4 = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, x, y, z, 1];
  return all.map(({ d, m }) => ({ d, m: mul(at, m) }));
}

/**
 * A piece on one of the course's walls, its back against the wall's face, its middle `at` along it, its bottom `y` up,
 * its front (the pack's +z) out into the room. The walls by their face and the way they look: x28 the right-hand bay's
 * outer wall (looking -x), x14 the block's face in that bay (+x), x-7 the middle bay's outer wall (+x), x7 the block's
 * face in it (-x), z194 the far wall (-z), z178 the block's end over the turn (+z)
 */
const WALLS: Record<string, { n: [number, number]; face: number }> = {
  x28: { n: [-1, 0], face: -OUT.x1 },
  x14: { n: [1, 0], face: OUT.x0 },
  "x-7": { n: [1, 0], face: BACK.x0 },
  x7: { n: [-1, 0], face: -BACK.x1 },
  z194: { n: [0, -1], face: -tcfg.farZ },
  z178: { n: [0, 1], face: TURN_Z },
};
const boundsOf = new Map<string, Baked>();
function onWall(key: string, wall: string, at: number, y: number): Array<{ d: Draw; m: M4 }> {
  const w = WALLS[wall];
  if (!w) throw new Error(`no wall ${wall}`);
  let b = boundsOf.get(key);
  if (!b) {
    const p = pathOf.get(key);
    if (!p) throw new Error(`no prefab ${key}`);
    b = bake(pack, res, key, guidOf.get(p)!, mats) ?? undefined;
    if (!b) throw new Error(`${key} bakes nothing`);
    boundsOf.set(key, b);
  }
  const [nx, nz] = w.n;
  // the turn that points the piece's +z along n; then the middle of its back, low edge (local x the middle, y and z the
  // least) put on the wall's face at `at` along it and `y` up
  const yaw = (Math.atan2(nx, nz) * 180) / Math.PI;
  const [c, s] = [Math.cos((yaw * Math.PI) / 180), Math.sin((yaw * Math.PI) / 180)];
  const [lx, ly, lz] = [(b.min[0] + b.max[0]) / 2, b.min[1], b.min[2]];
  const turned = [c * lx + s * lz, ly, -s * lx + c * lz];
  const off = w.face + 0.02;
  const target = nz === 0 ? [off / nx, y, at] : [at, y, off / nz];
  return placed(key, target[0] - turned[0], target[1] - turned[1], target[2] - turned[2], yaw);
}

const tex = new Textures(helpers);
const pool = await BasisPool.start(PAID);
tex.pool = pool;

if (mode === "swatch") {
  const out: Baked[] = [];
  const names = (dress as unknown as { candidates: string[] }).candidates;
  for (const name of names) {
    // (a material no piece wears at a measurable scale is left off the sheet, said so)
    try {
      metresPerRepeat(name);
    } catch (e) {
      console.log(`   ${(e as Error).message}`);
      continue;
    }
    const s = new Surfaces();
    s.box({ minX: 0, maxX: 2, base: 0, top: 2, minZ: 0, maxZ: 2 }, () => name, () => false);
    out.push(s.baked(`${name} (${metresPerRepeat(name).toFixed(2)} m)`));
  }
  const file = join(helpers.out, "neon", "gallery", "tutorial-swatch.glb");
  const size = await writePack(helpers, pack, out, mats, tex, 512, 256, new Set(out.map((b) => b.id)), file, true);
  console.log(`${out.length} swatches, ${(size / 1e6).toFixed(1)} MB: ${file}`);
}

if (mode === "bake") {
  const R = dress.roles;
  const WH = tcfg.wallH;
  const s = new Surfaces();
  const { solids } = courseColliders(TUTORIAL_COURSE);
  // each box's role: the slick glass, the walls to the roof, a slick ledge (a jump's), the climb's wall, a deck or step
  const roleOf = (b: (typeof solids)[number]) => {
    const thin = Math.min(b.maxX - b.minX, b.maxZ - b.minZ) <= 0.61;
    return b.slick && thin ? "glass" : b.top >= WH - 0.01 ? "wall" : b.slick ? "ledge" : b.top - b.base >= 5 ? "climb" : "block";
  };
  // what hides a point of a face: another box standing over it, but not the glass, which is seen through
  const solidBoxes = solids.filter((o) => roleOf(o) !== "glass");
  const covered = (self: object) => (x: number, y: number, z: number) => solidBoxes.some((o) => o !== self && x > o.minX + 1e-3 && x < o.maxX - 1e-3 && y > o.base + 1e-3 && y < o.top - 1e-3 && z > o.minZ + 1e-3 && z < o.maxZ - 1e-3);
  // every box's edges, to cut each face at: the ones within a metre of a face are all that can cover part of it
  const near = (b: (typeof solids)[number]) => solidBoxes.filter((o) => o !== b && o.minX < b.maxX + 1 && o.maxX > b.minX - 1 && o.minZ < b.maxZ + 1 && o.maxZ > b.minZ - 1 && o.base < b.top + 1 && o.top > b.base - 1);
  const edgesOf = (b: (typeof solids)[number]) => {
    const n = near(b);
    return { x: n.flatMap((o) => [o.minX, o.maxX]), y: n.flatMap((o) => [o.base, o.top]), z: n.flatMap((o) => [o.minZ, o.maxZ]) };
  };
  for (const b of solids) {
    const role = roleOf(b);
    s.box(
      b,
      (f) => {
        if (f === "top" && role === "wall") return null;
        if (role === "glass") return R.glass;
        if (role === "wall") return R.wall;
        if (f === "top") return role === "ledge" ? R.ledgeTop : R.blockTop;
        return role === "ledge" ? R.ledge : role === "climb" ? R.climb : R.block;
      },
      covered(b),
      edgesOf(b),
    );
  }
  // the ceiling, the Neon City's and solid, where the warehouse roof was (its skylights showed the sky: the owner's
  // playtest, 2026-10-18, "the ceiling should be the neon city style"), its lights the bundle's own ceiling panels
  {
    const y = WH - 0.01;
    const [x0, x1, z0, z1] = [BACK.x0 - 1, OUT.x1 + 1, 8, tcfg.farZ + 1];
    for (let x = x0; x < x1 - 1e-6; x += CELL)
      for (let z = z0; z < z1 - 1e-6; z += CELL) {
        const [a, c, d, e] = [x, Math.min(x1, x + CELL), z, Math.min(z1, z + CELL)];
        s.quad(R.ceiling, [[a, y, d], [c, y, d], [c, y, e], [a, y, e]], [0, -1, 0]);
      }
  }
  // the floor: both bays and the turn, but under the block between them; the pits' floors their own
  const pits = [MANTLE, WALLRUN, DASH].map((r) => ({ bay: r === DASH ? BACK : OUT, z0: Math.min(r.a1, r.b0), z1: Math.max(r.a1, r.b0) }));
  pits.push({ bay: BACK, z0: GLIDE.b0, z1: GLIDE.edge });
  const floorStrip = (x0: number, x1: number, z0: number, z1: number, m: string) => s.quad(m, [[x0, 0.005, z0], [x0, 0.005, z1], [x1, 0.005, z1], [x1, 0.005, z0]], [0, 1, 0]);
  for (const bay of [OUT, BACK]) {
    const cuts = pits.filter((p) => p.bay === bay).sort((a, b) => a.z0 - b.z0);
    let z = 9;
    for (const p of cuts) {
      floorStrip(bay.x0, bay.x1, z, p.z0, R.floor);
      floorStrip(bay.x0, bay.x1, p.z0, p.z1, R.pit);
      z = p.z1;
    }
    floorStrip(bay.x0, bay.x1, z, TURN_Z, R.floor);
  }
  floorStrip(BACK.x0, OUT.x1, TURN_Z, tcfg.farZ, R.floor);
  // [piece, wall, along, up] on a wall (onWall), or [piece, x, y, z, yaw] where it stands
  const list = dress.pieces as unknown as Array<[string, string | number, number, number, number?]>;
  const draws = list.flatMap(([key, a, b, c, d]) => (typeof a === "string" ? onWall(key, a, b, c) : placed(key, a, b, c, d ?? 0)));
  // the ceiling's lights: the bundle's panel light down the middle of each bay and across the turn, its top on the ceiling
  {
    const C = (dress as unknown as { ceilingLights: { piece: string; every: number } }).ceilingLights;
    const p = pathOf.get(C.piece);
    if (!p) throw new Error(`no prefab ${C.piece}`);
    const lb = bake(pack, res, C.piece, guidOf.get(p)!, mats);
    if (!lb) throw new Error(`${C.piece} bakes nothing`);
    const top = WH - lb.max[1] - 0.02;
    for (const bay of [OUT, BACK]) for (let z = 9 + C.every / 2; z < TURN_Z; z += C.every) draws.push(...placed(C.piece, (bay.x0 + bay.x1) / 2, top, z, 0));
    for (let x = BACK.x0 + 3; x < OUT.x1 - 2; x += C.every) draws.push(...placed(C.piece, x, top, (TURN_Z + tcfg.farZ) / 2, 90));
  }
  const rooms = s.baked("tutorial:rooms");
  const pieces = draws.length ? bake(pack, res, "tutorial:pieces", "", mats, draws) : null;
  const all = [rooms, ...(pieces ? [pieces] : [])];
  const file = join(helpers.out, "neon", `tutorial-v${dress.version}.glb`);
  const size = await writePack(helpers, pack, all, mats, tex, dress.texture, dress.normal, new Set(all.map((b) => b.id)), file, true);
  console.log(`the tutorial dressed: ${rooms.tris} triangles of rooms in ${rooms.groups.size} materials, ${pieces?.tris ?? 0} of pieces (${list.length} placed), ${(size / 1e6).toFixed(2)} MB: ${file}`);
  for (const [name, m] of repeatOf) console.log(`   ${name}: ${m.toFixed(2)} m a repeat`);
  if (IMPORT_STATS.unresolved.size) console.log(`unresolved materials: ${[...IMPORT_STATS.unresolved.keys()].slice(0, 8).join("; ")}`);
}

await pool.stop();
