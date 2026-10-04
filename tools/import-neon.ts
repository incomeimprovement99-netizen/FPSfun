// Daelonik's Neon City bundle made into what the city draws (Phase 28, docs/PHASE_28_PLAN_THE_CENTRE_FROM_NEON_CITY.md).
//
// The four packages (the core and its three expansions, which build only on the core's models and materials) are read
// as one pack, "neon", with tools/import-city.ts's reader: Unity's YAML prefabs rebuilt from their FBX models, their
// materials (613 of the 636 on Unity's Standard shader) read into glTF's, their textures made KTX2.
//
// Modes (NEON=<mode>):
//   gallery    contact sheets of the prefabs (below)
//   catalogue  every City Builder prefab measured: its size, triangles, parts and materials, to
//              C:\Users\jwilb\Downloads\speedkills-paid\neon\catalogue.json (the planning step's inventory)
//
// Only local tools touch the files, and nothing here uploads them anywhere.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { padOff, padStandOff } from "../src/game/padsolve";
import { streets, StreetField, fieldSurface, ringSlab, type Pt } from "./neon-streets";
import { bandAlong, fillTo, flatAt, inside, sdPoly, skinRegion, skirtAlong, standing, storeySlab, type Grid } from "./neon-base";
import { backFaces, boxInto, coplanar, cutOut, escapes, settle, stairCore, type Box3 } from "./neon-tower";
import { wellFlight, type Flight } from "./neon-well";
import { MOVE } from "../src/game/movement";
import { bake, districtSolids, IMPORT_STATS, Models, mul, Pack, readMaterial, Resolver, Textures, writePack, type Baked, type CityImportHelpers, type Draw, type M4 } from "./import-city";
import { BasisPool } from "./basis-pool";

const ROOT = join(import.meta.dirname, "..");
const PAID = process.env.PAID_DIR ?? "C:/Users/jwilb/Downloads/speedkills-paid";
const EXTRACT = join(PAID, "neon", "extract");
const PACKAGES = ["scifi-neon-city", "scifi-neon-buildings", "scifi-neon-high-city", "scifi-neon-underground"];

function fbx2gltf(): string {
  const dir = join(ROOT, "node_modules", "fbx2gltf", "bin", process.platform === "win32" ? "Windows_NT" : process.platform === "darwin" ? "Darwin" : "Linux");
  const exe = readdirSync(dir).find((f) => /^FBX2glTF/i.test(f));
  if (!exe) throw new Error(`no FBX2glTF in ${dir}`);
  return join(dir, exe);
}

/** the four packages' files as one map, project path to bytes (each is unpacked already: a tar of guid folders) */
function files(): Map<string, string> {
  const out = new Map<string, string>();
  for (const name of PACKAGES) {
    const dir = join(EXTRACT, name);
    if (!existsSync(dir)) throw new Error(`${dir} not unpacked`);
    for (const guid of readdirSync(dir)) {
      const pn = join(dir, guid, "pathname");
      const asset = join(dir, guid, "asset");
      if (existsSync(pn) && existsSync(asset)) out.set(readFileSync(pn, "utf8").split(/\r?\n/)[0].trim(), asset);
    }
  }
  return out;
}

export const helpers: CityImportHelpers = {
  root: ROOT,
  paid: PAID,
  out: join(ROOT, "public", "models", "paid"),
  unpack: () => files(),
  // the bundle's pictures are PNG, EXR, JPG, TIF and three TGA the city does not use
  readTga: () => {
    throw new Error("TGA not read for Neon City");
  },
  fbx2gltf,
};

export function neonPack(): { pack: Pack; res: Resolver; models: Models } {
  const pack = new Pack("neon", files());
  pack.unityScale = true;
  const models = new Models(helpers, join(PAID, "conv", "neon"));
  return { pack, res: new Resolver(pack, models), models };
}

/** the City Builder prefabs (and the props they place from SciFi Prop Elements), by project path */
export function builderPrefabs(pack: Pack): string[] {
  return [...pack.pathFile.keys()].filter((p) => p.endsWith(".prefab") && (p.includes("/City Builder/") || p.includes("/SciFi Prop Elements/"))).sort();
}

export const mode = process.env.NEON ?? "catalogue";
if (mode === "catalogue") {
  const { pack, res } = neonPack();
  const list = builderPrefabs(pack);
  const guidOf = new Map<string, string>();
  for (const [g, p] of pack.guidPath) guidOf.set(p, g);
  const mats = new Map();
  const rows: Array<Record<string, unknown>> = [];
  let i = 0;
  for (const p of list) {
    const g = guidOf.get(p)!;
    const draws = res.flatten(g);
    const bk = bake(pack, res, p, g, mats, draws);
    const nested = new Set(draws.flatMap((d) => d.from)).size;
    const models = new Set(draws.map((d) => basename(pack.guidPath.get(d.d.modelGuid) ?? "?")));
    rows.push({
      path: p.replace(/^Assets\/_DLNK\//, ""),
      parts: draws.length,
      nested,
      models: models.size,
      tris: bk?.tris ?? 0,
      size: bk ? bk.max.map((v, k) => +(v - bk.min[k]).toFixed(2)) : null,
      min: bk ? bk.min.map((v) => +v.toFixed(2)) : null,
      max: bk ? bk.max.map((v) => +v.toFixed(2)) : null,
      materials: bk ? [...bk.groups.values()].map((q) => (q.mat ? basename(pack.guidPath.get(q.mat) ?? q.mat, ".mat") : "none")) : [],
    });
    if (++i % 100 === 0) console.log(`${i} of ${list.length}`);
  }
  const out = join(PAID, "neon", "catalogue.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(rows, null, 0));
  console.log(`${rows.length} prefabs catalogued to ${out}`);
  console.log(`unresolved materials: ${IMPORT_STATS.unresolved.size}, unreadable: ${IMPORT_STATS.unreadable.size}, unmatched meshes: ${IMPORT_STATS.unmatchedMeshes.size}`);
  const top = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} (${Math.round(v)})`).join("; ");
  if (IMPORT_STATS.unmatchedMeshes.size) console.log("unmatched meshes:", top(IMPORT_STATS.unmatchedMeshes));
  if (IMPORT_STATS.unresolved.size) console.log("unresolved:", top(IMPORT_STATS.unresolved));
}

// NEON=gallery: the prefabs whose path holds GALLERY (a folder), GALLERY_PER to a sheet, baked with small textures into
// public/models/paid/neon/gallery/<sheet>.glb for tools/neongallery.html's contact sheets
if (mode === "gallery") {
  const { pack, res } = neonPack();
  const want = process.env.GALLERY ?? "";
  const per = Number(process.env.GALLERY_PER ?? 24);
  const name = process.env.GALLERY_NAME ?? (want.split("/").filter(Boolean).pop() ?? "all").replace(/[^A-Za-z0-9]+/g, "-").toLowerCase();
  const not = process.env.GALLERY_NOT;
  const list = builderPrefabs(pack).filter((p) => p.includes(want) && !(not && p.includes(not)));
  const guidOf = new Map<string, string>();
  for (const [g, p] of pack.guidPath) guidOf.set(p, g);
  const tex = new Textures(helpers);
  const pool = await BasisPool.start(PAID);
  tex.pool = pool;
  const mats = new Map();
  const outDir = join(helpers.out, "neon", "gallery");
  const sheets: string[] = [];
  for (let s0 = 0; s0 < list.length; s0 += per) {
    const baked: Baked[] = [];
    for (const p of list.slice(s0, s0 + per)) {
      const b = bake(pack, res, p.replace(/^Assets\/_DLNK\//, ""), guidOf.get(p)!, mats);
      if (b) baked.push(b);
    }
    const sheet = `${name}-${String(s0 / per + 1).padStart(2, "0")}`;
    const size = await writePack(helpers, pack, baked, mats, tex, Number(process.env.GALLERY_TEX ?? 256), 128, new Set(baked.map((b) => b.id)), join(outDir, `${sheet}.glb`), true);
    sheets.push(sheet);
    console.log(`${sheet}: ${baked.length} pieces, ${(size / 1e6).toFixed(1)} MB`);
  }
  await pool.stop();
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(sheets));
}

// NEON=scene: one of the pack's demo scenes (NEON_SCENE, its file name, NeonScene00 by default) whole, into
// public/models/paid/city/neon-<name>-scene.glb, for tools/sceneview.html to set beside the store's pictures
if (mode === "scene") {
  const { pack, res } = neonPack();
  const want = process.env.NEON_SCENE ?? "NeonScene00";
  const path = [...pack.pathFile.keys()].find((p) => p.endsWith(`/${want}.unity`));
  if (!path) throw new Error(`no scene ${want}`);
  const guid = [...pack.guidPath].find(([, p]) => p === path)![0];
  const tex = new Textures(helpers);
  const pool = await BasisPool.start(PAID);
  tex.pool = pool;
  const mats = new Map();
  const b = bake(pack, res, `neon/${want}`, guid, mats);
  if (!b) throw new Error("the scene baked nothing");
  const file = join(helpers.out, "city", `neon-${want.toLowerCase()}-scene.glb`);
  const size = await writePack(helpers, pack, [b], mats, tex, Number(process.env.NEON_TEX ?? 1024), 512, new Set([b.id]), file, true);
  await pool.stop();
  console.log(`${want}: ${b.tris} triangles, ${(size / 1e6).toFixed(1)} MB, bounds ${b.min.map((v) => v.toFixed(0))} to ${b.max.map((v) => v.toFixed(0))}`);
  console.log(`unresolved materials: ${IMPORT_STATS.unresolved.size}, unmatched meshes: ${IMPORT_STATS.unmatchedMeshes.size}`);
}

// NEON=bake: the map (src/config/neonmap.json chunks, tools/neon-layout.ts) baked, each chunk one mesh of the pack's
// materials, into public/models/paid/neon/neonmap-v<version>-<size>.glb at each of NEON_SIZES (lo 512, hi 1024,
// max 2048, their normal maps half; `preview` 256, for looking at a layout), and its collision off the same triangles
// into src/config/neon/neonmap.solids.json: a room's floors, walls and stairs as their own spans (o), a building with no
// rooms solid to its own top a cell at a time with its hollow middle filled (s), the ground and what lies flat on it
// none (g: the world's floor is the street)
if (mode === "bake") {
  const cfgFile = join(ROOT, "src", "config", "neonmap.json");
  const cfg = JSON.parse(readFileSync(cfgFile, "utf8"));
  const { pack, res } = neonPack();
  const guidOf = new Map<string, string>();
  for (const [g, p] of pack.guidPath) guidOf.set(p, g);
  const pathOf = new Map<string, string>();
  for (const p of pack.pathFile.keys()) {
    const k = p.split("City Builder/")[1];
    if (k) pathOf.set(k, p);
  }
  const flat = new Map<string, Array<{ d: Draw; m: M4 }>>();
  const draws = (key: string) => {
    let f = flat.get(key);
    if (!f) {
      const p = pathOf.get(key);
      if (!p) throw new Error(`no prefab ${key}`);
      f = res.flatten(guidOf.get(p)!).map(({ d, m }) => ({ d, m }));
      flat.set(key, f);
    }
    return f;
  };
  const place = (x: number, y: number, z: number, yaw: number): M4 => {
    const a = (yaw * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // column-major: turned about y (as three.js's rotation.y), then moved
    return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, x, y, z, 1];
  };
  const C = JSON.parse(readFileSync(join(ROOT, "src", "config", "citydistricts.json"), "utf8")).collision;
  const mats = new Map();
  const baked: Baked[] = [];
  const open: Array<{ d: Draw; m: M4 }> = [];
  /** the rooms whose collision is measured at the finer cell (rules.fine): an entrance's escalators, 2 m wide with their
   * glass sides, left no room for a body between sides widened to half a metre each */
  const openFine: Array<{ d: Draw; m: M4 }> = [];
  /** the pieces that collide as their own faces (rules.fine.exact), each where it stands */
  const EXACT = (cfg.rules.fine as { exact?: { pieces: string[]; parts: Record<string, "floor" | "flight" | "rail">; plate: number; slice: number; room: number[] } }).exact;
  const exactAt: Array<{ x: number; y: number; z: number; yaw: number }> = [];
  const exactBoxes: number[][] = [];
  /** a triangle's own bounds in each `cell` square of the map it crosses, [x0, x1, z0, z1, y0, y1] */
  const sliced = (tri: number[][], cell: number): number[][] => {
    const clip = (poly: number[][], axis: number, v: number, above: boolean): number[][] => {
      const out: number[][] = [];
      for (let i = 0; i < poly.length; i++) {
        const [a, b] = [poly[i], poly[(i + 1) % poly.length]];
        const [ina, inb] = [above ? a[axis] >= v : a[axis] <= v, above ? b[axis] >= v : b[axis] <= v];
        if (ina) out.push(a);
        if (ina !== inb) {
          const t = (v - a[axis]) / (b[axis] - a[axis]);
          out.push([0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * t));
        }
      }
      return out;
    };
    const out: number[][] = [];
    const [xs, zs] = [tri.map((p) => p[0]), tri.map((p) => p[2])];
    for (let i = Math.floor(Math.min(...xs) / cell); i <= Math.floor(Math.max(...xs) / cell); i++)
      for (let j = Math.floor(Math.min(...zs) / cell); j <= Math.floor(Math.max(...zs) / cell); j++) {
        let poly = clip(tri, 0, i * cell, true);
        if (poly.length) poly = clip(poly, 0, (i + 1) * cell, false);
        if (poly.length) poly = clip(poly, 2, j * cell, true);
        if (poly.length) poly = clip(poly, 2, (j + 1) * cell, false);
        if (poly.length < 3) continue;
        const b = [0, 2, 1].flatMap((k) => [Math.min(...poly.map((p) => p[k])), Math.max(...poly.map((p) => p[k]))]);
        out.push(b);
      }
    return out;
  };
  const solidBoxes: number[][] = [];
  // (the boxes of what the layout lays last, the street walls and the High City's climbs (rules.low.walls,
  // rules.blocks.climbs): where they lie in the collision, written beside it, so the next layout's passes leave out
  // exactly these and see the rest as they never stood)
  const LAID = [cfg.rules.low.walls, (cfg.rules.blocks as { climbs?: unknown }).climbs].map((q) => (q as { chunk?: string } | undefined)?.chunk).filter(Boolean);
  const laid: number[][] = [];
  /** every draw that collides (placed "o" or "s"): what a window may open onto, not the hanging lamps and signs ("g") */
  const collidingDraws: Array<{ d: Draw; m: M4 }> = [];
  let placed = 0;
  // the chunks named by rules.bake.merge baked as one, a mesh a material (the centre's: its pieces share the pack's
  // materials, and baked a chunk at a time it drew 920 calls in the street, 440 as one, 2.3 ms a frame on Competitive).
  // NEON_TAG names the file, so a bake of another grouping loads beside this one (?neontag=) and writes nothing else
  const TAG = process.env.NEON_TAG ?? "";
  const groupOf = (id: string) => (id.startsWith(cfg.rules.bake.merge) ? cfg.rules.bake.as : id);
  const groups = new Map<string, Array<{ d: Draw; m: M4 }>>();
  // what already stands where the base's floors go (cfg.base.mask's chunks: the tower, the court, the station's kiosks)
  const baseMask = new Set<string>(cfg.base?.mask ?? []);
  const standingDraws: Array<{ d: Draw; m: M4 }> = [];
  // the tower as drawn (its back faces too), for the measure of whether its floors can be seen through
  const towerDrawn: Array<{ d: Draw; m: M4 }> = [];
  // the windows (rules.windows; the owner, 2026-10-02: "the windows in the large tower ... actual windows that are open
  // and that we can just go right on through ... regular sized windows, like it would have to be a well placed sniper
  // shot"): in the zones it names, each window wall's glass left out and its one wide opening parted by piers into windows
  // `width` metres wide and `gap` apart, centred, one for each `per` metres of opening; the piers drawn, and colliding as
  // boxes, and each window cut out of the cells' collision exactly (on half-metre cells a 1.25 m window came out anywhere
  // from 0.25 to 1.25 m, and a body is 0.82). Only walls along x or z: a window is cut out of the boxes as a box
  const WIN = cfg.rules.windows as { models: string[]; glass: string[]; width: number; gap: number; per: number; thick: number; carve: number; sliver: number; scale: number; clear: number; room: number; pierMats: string[]; zones: Array<{ chunk: string; y: number[]; square?: boolean }> } | undefined;
  /** each opened window wall: its opening's near end (x, z) at the glass's plane, its way along and its normal (unit, on x
   * or z), its length, sill and head, its chunk, the piers' material (the wall's own) and the windows' spans along it */
  const windowWalls: Array<{ p0: number[]; U: number[]; N: number[]; L: number; base: number; sill: number; head: number; chunk: string; mat: string; spans: number[][]; glass: { d: Draw; m: M4 } }> = [];
  const openWindows = (id: string, list: Array<{ d: Draw; m: M4 }>): Array<{ d: Draw; m: M4 }> => {
    const zones = WIN?.zones.filter((z) => z.chunk === id) ?? [];
    if (!WIN || !zones.length) return list;
    return list.map(({ d, m }) => {
      if (!WIN.models.includes(basename(pack.guidPath.get(d.modelGuid) ?? ""))) return { d, m };
      const prims = d.model.meshes[d.mesh].prims;
      const matOf = (i: number): string => d.mats?.[i] ?? pack.matFor(prims[i].material) ?? "";
      const gi = prims.findIndex((_, i) => WIN.glass.includes(basename(pack.guidPath.get(matOf(i)) ?? "").replace(/\.mat$/, "")));
      if (gi < 0) return { d, m };
      const q = prims[gi];
      const pts: number[][] = [];
      for (let k = 0; k < q.pos.length; k += 3) pts.push([0, 1, 2].map((a) => m[a] * q.pos[k] + m[4 + a] * q.pos[k + 1] + m[8 + a] * q.pos[k + 2] + m[12 + a]));
      const sill = Math.min(...pts.map((p) => p[1])), head = Math.max(...pts.map((p) => p[1]));
      const [mx, mz] = [0, 2].map((a) => pts.reduce((sum, p) => sum + p[a], 0) / pts.length);
      const SQ = cfg.tower?.square as number[] | undefined;
      if (!zones.some((z) => sill >= z.y[0] && sill <= z.y[1] && (!z.square || (SQ && mx > SQ[0] && mx < SQ[1] && mz > SQ[2] && mz < SQ[3])))) return { d, m };
      // (its way along between its two farthest corners, snapped to x or z: the pane's own thickness tilts it a degree)
      let [a, b, far] = [pts[0], pts[0], -1];
      for (const p of pts) for (const r of pts) if (Math.hypot(p[0] - r[0], p[2] - r[2]) > far) [a, b, far] = [p, r, Math.hypot(p[0] - r[0], p[2] - r[2])];
      const [ux, uz] = [(b[0] - a[0]) / far, (b[2] - a[2]) / far];
      if (Math.abs(ux) < 0.99 && Math.abs(uz) < 0.99) return { d, m };
      const U = Math.abs(ux) > Math.abs(uz) ? [Math.sign(ux), 0] : [0, Math.sign(uz)];
      const N = [-U[1], U[0]];
      const ts = pts.map((p) => p[0] * U[0] + p[2] * U[1]);
      const c = pts.reduce((sum, p) => sum + p[0] * N[0] + p[2] * N[1], 0) / pts.length;
      const [t0, t1] = [Math.min(...ts), Math.max(...ts)];
      const L = t1 - t0;
      const n = Math.max(1, Math.round(L / WIN.per));
      const s0 = (L - n * WIN.width - (n - 1) * WIN.gap) / 2;
      const spans = [...Array(n).keys()].map((k) => [s0 + k * (WIN.width + WIN.gap), s0 + k * (WIN.width + WIN.gap) + WIN.width]);
      // (the piers in the wall's own face: the first of `pierMats` it wears, else its biggest part; its biggest in the
      // tower is its black plastic, and the piers drew as black slabs)
      const named = prims.map((_, i) => basename(pack.guidPath.get(matOf(i)) ?? "").replace(/\.mat$/, ""));
      const liked = WIN.pierMats.map((n) => named.indexOf(n)).find((i) => i >= 0 && i !== gi);
      const bi = liked ?? prims.map((p, i) => ({ i, n: i === gi ? -1 : p.idx.length })).sort((x, y) => y.n - x.n)[0].i;
      // (the wall's foot, its floor: its lowest corner)
      let base = Infinity;
      for (const r of prims) for (let k = 0; k < r.pos.length; k += 3) base = Math.min(base, m[1] * r.pos[k] + m[5] * r.pos[k + 1] + m[9] * r.pos[k + 2] + m[13]);
      const glassModel = { meshes: [{ name: d.model.meshes[d.mesh].name, prims: [q] }], nodes: [], roots: [] } as unknown as Draw["model"];
      const glass = { d: { ...d, model: glassModel, mesh: 0, pre: null, mats: d.mats ? [d.mats[gi]] : d.mats }, m };
      windowWalls.push({ p0: [U[0] * t0 + N[0] * c, U[1] * t0 + N[1] * c], U, N, L, base, sill, head, chunk: id, mat: matOf(bi), spans, glass });
      const keep = prims.map((_, i) => i).filter((i) => i !== gi);
      const model = { meshes: [{ name: d.model.meshes[d.mesh].name, prims: keep.map((i) => prims[i]) }], nodes: [], roots: [] } as unknown as Draw["model"];
      return { d: { ...d, model, mesh: 0, pre: null, mats: d.mats ? keep.map((i) => d.mats![i]) : d.mats }, m };
    });
  };
  // (each placed draw's chunk, for naming what the bake's measures find)
  const chunkOf = new WeakMap<object, string>();
  // a placement's material may be derived: "Base|#rrggbb|k" is the pack's Base with its emission the colour at k times
  // its unit (MOTEL HILL's beam in pink: the pack has no plain pink light, and its pink ad light's panel texture, tiled
  // 92 m up a beam, drew nearly black against the sky); "Base*#rrggbb" is Base with its own colour times the colour,
  // its textures kept (the tower floors' walls in the pack's grey panels, each floor its colour: the pack's coloured
  // plastics are a noise texture under a flat colour, "flat colour with a speckle", the centre's third review)
  const derivedMat = (spec: string): string | null => {
    if (spec.includes("*#")) {
      const guid = `derived:${spec}`;
      if (mats.has(guid)) return guid;
      const [base, hex] = spec.split("*");
      const bg = pack.matFor(base);
      const info = bg ? readMaterial(pack, bg) : null;
      if (!info) throw new Error(`no material ${base} to derive ${spec} from`);
      const n = parseInt(hex.replace("#", ""), 16);
      const tint = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
      mats.set(guid, { ...info, name: spec.replace(/[*#]/g, "_"), color: [info.color[0] * tint[0], info.color[1] * tint[1], info.color[2] * tint[2], info.color[3]] });
      return guid;
    }
    if (!spec.includes("|")) return null;
    const guid = `derived:${spec}`;
    if (mats.has(guid)) return guid;
    const [base, hex, k] = spec.split("|");
    const bg = pack.matFor(base);
    const info = bg ? readMaterial(pack, bg) : null;
    if (!info) throw new Error(`no material ${base} to derive ${spec} from`);
    const n = parseInt(hex.replace("#", ""), 16);
    const at = Number(k || 1);
    mats.set(guid, { ...info, name: spec.replace(/[|#]/g, "_"), emission: [(((n >> 16) & 255) / 255) * at, (((n >> 8) & 255) / 255) * at, ((n & 255) / 255) * at], emissive: null });
    return guid;
  };
  for (const [id, chunk] of Object.entries<{ sector: string; place: Array<[string, number, number, number, number, string, (string | null)?, (string[] | null)?, number?]> }>(cfg.chunks)) {
    const all = groups.get(groupOf(id)) ?? groups.set(groupOf(id), []).get(groupOf(id))!;
    for (const [key, x, y, z, yaw, how, mat, without, scale] of chunk.place) {
      // (a placement may be scaled about its pivot, its ninth field: the corner blocks' signs, 2.5 to 4 m in the pack,
      // read from the street at three times that)
      const W = scale ? mul(place(x, y, z, yaw), [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, 1]) : place(x, y, z, yaw);
      // (a placement's material: one over all its parts, or "Name=Spec;Name2=Spec2", each part in the pack's material
      // Name worn in Spec instead and the rest as they are: the High City's blocks each in its own colour)
      const remap = mat && mat.includes("=") ? new Map(mat.split(";").map((p) => p.split("=") as [string, string])) : null;
      const matGuid = mat && !remap ? (derivedMat(mat) ?? pack.matFor(mat)) : null;
      if (mat && !remap && !matGuid) throw new Error(`no material ${mat}`);
      const named = new Map<string, string>();
      const used = new Set<string>();
      const remapped = (g: string | null): string | null => {
        if (!g) return g;
        let name = named.get(g);
        if (name === undefined) named.set(g, (name = readMaterial(pack, g)?.name ?? ""));
        const to = remap!.get(name);
        if (!to) return g;
        used.add(name);
        const tg = derivedMat(to) ?? pack.matFor(to);
        if (!tg) throw new Error(`no material ${to} for ${name}`);
        return tg;
      };
      // (a placement may leave named parts of its prefab out: neonmap.json's rules say which and why)
      // An entry is a model's file name (every part drawn from it) or "name@x,y,z", the one part of it whose middle is
      // within half a metre of there in the prefab's own metres (the pack's plain walls are one model in many places), or
      // "*#x0,x1,y0,y1,z0,z1", every part lying wholly inside that box in the prefab's own metres (a building's interior
      // cleared from inside its shell: the walls and floors that reach under the shell are not wholly inside and stay), or
      // "*|x0,x1,y0,y1,z0,z1", that box cut out of every part it reaches, the part's triangles clipped to it exactly (the
      // tower's stair core through its floors: tools/neon-tower.ts cutOut)
      const cuts = (without ?? []).filter((w) => w.startsWith("*|")).map((w) => w.slice(2).split(",").map(Number) as Box3);
      const reaches = (b: Box3, d: Draw, m: M4) => {
        const [lo, hi] = partBounds(d, m);
        return hi[0] > b[0] && lo[0] < b[1] && hi[1] > b[2] && lo[1] < b[3] && hi[2] > b[4] && lo[2] < b[5];
      };
      const leftOut = (w: string, d: Draw, m: M4): boolean => {
        if (w.startsWith("*|")) return false;
        if (w.startsWith("*#")) {
          // ("*#box~Name": only the parts whose model's file name begins with Name)
          const [spec, only] = w.slice(2).split("~");
          if (only && !basename(pack.guidPath.get(d.modelGuid) ?? "").startsWith(only)) return false;
          const [x0, x1, y0, y1, z0, z1] = spec.split(",").map(Number);
          const [lo, hi] = partBounds(d, m);
          return lo[0] >= x0 && hi[0] <= x1 && lo[1] >= y0 && hi[1] <= y1 && lo[2] >= z0 && hi[2] <= z1;
        }
        const [name, at] = w.split("@");
        if (basename(pack.guidPath.get(d.modelGuid) ?? "") !== name) return false;
        if (!at) return true;
        const mid = partMiddle(d, m);
        return at.split(",").map(Number).every((v, i) => Math.abs(v - mid[i]) < 0.5);
      };
      const kept = without ? draws(key).filter(({ d, m }) => !without.some((w) => leftOut(w, d, m))) : draws(key);
      for (const w of without ?? []) if (!w.startsWith("*|") && !draws(key).some(({ d, m }) => leftOut(w, d, m))) throw new Error(`${key}: no ${w} to leave out`);
      for (const b of cuts) if (!draws(key).some(({ d, m }) => reaches(b, d, m))) throw new Error(`${key}: nothing to cut at ${b.join(",")}`);
      // a part a cut reaches, drawn again in the prefab's own metres with the cut's box taken out of it
      const cutPart = (d: Draw, m: M4): { d: Draw; m: M4 } => {
        const prims = d.model.meshes[d.mesh].prims.map((q) => {
          const pos = new Float32Array(q.pos.length);
          const nrm = q.nrm ? new Float32Array(q.nrm.length) : null;
          for (let k = 0; k < q.pos.length; k += 3)
            for (let a = 0; a < 3; a++) {
              pos[k + a] = m[a] * q.pos[k] + m[4 + a] * q.pos[k + 1] + m[8 + a] * q.pos[k + 2] + m[12 + a];
              if (nrm && q.nrm) nrm[k + a] = m[a] * q.nrm[k] + m[4 + a] * q.nrm[k + 1] + m[8 + a] * q.nrm[k + 2];
            }
          let part = { pos: Array.from(pos), nrm: nrm ? Array.from(nrm) : null, uv: q.uv ? Array.from(q.uv) : null, idx: Array.from(q.idx) } as { pos: number[]; nrm: number[] | null; uv: number[] | null; idx: number[] };
          for (const b of cuts) if (reaches(b, d, m)) part = cutOut(part.pos, part.nrm, part.uv, part.idx, b);
          return { pos: new Float32Array(part.pos), nrm: part.nrm ? new Float32Array(part.nrm) : null, uv: part.uv ? new Float32Array(part.uv) : null, idx: new Uint32Array(part.idx), material: q.material };
        });
        const model = { meshes: [{ name: d.model.meshes[d.mesh].name, prims }], nodes: [], roots: [] } as unknown as Draw["model"];
        return { d: { ...d, model, mesh: 0, pre: null }, m: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] };
      };
      const shaped = cuts.length ? kept.map(({ d, m }) => (cuts.some((b) => reaches(b, d, m)) ? cutPart(d, m) : { d, m })) : kept;
      const mine = shaped.map(({ d, m }) => ({ d: matGuid ? { ...d, mats: d.model.meshes[d.mesh].prims.map(() => matGuid) } : remap && d.mats ? { ...d, mats: d.mats.map(remapped) } : d, m: mul(W, m) }));
      for (const name of remap?.keys() ?? []) if (!used.has(name)) throw new Error(`${key}: no ${name} to wear another material`);
      // the tower's one-sided shell pieces (rules.tower.backs) drawn from inside too, their triangles turned over: from
      // inside its floors the pack's "fake" walls, faced only toward the street, showed the sky through the building.
      // Worn inside as backWear says: the pack's own materials there are mostly metals, which show only what they
      // reflect, and inside, with nothing lit to reflect, they drew black; glass (backWear.keep) stays glass
      if (id === "c-middle" && cfg.tower?.backs)
        for (const { d, m } of mine) {
          if (!(cfg.tower.backs as string[]).includes(basename(pack.guidPath.get(d.modelGuid) ?? ""))) continue;
          // (only the main body's own shell: the side core's round glass corners are seen from outside alone)
          const [lo, hi] = partBounds(d, m);
          const [qx0, qx1, qz0, qz1] = cfg.tower.square as number[];
          if ((lo[0] + hi[0]) / 2 < qx0 - 0.1 || (lo[0] + hi[0]) / 2 > qx1 + 0.1 || (lo[2] + hi[2]) / 2 < qz0 - 0.1 || (lo[2] + hi[2]) / 2 > qz1 + 0.1) continue;
          const BW = cfg.tower.backWear as { mat: string; scale: number; keep: string[]; upright: number };
          const wear = pack.matFor(BW.mat);
          if (!wear) throw new Error(`no material ${BW.mat}`);
          const mats: string[] = [];
          const prims = d.model.meshes[d.mesh].prims.map((q, i) => {
            // (on the map: the turn-over keeps the upright faces, and maps the wear by the metre)
            const pos = new Float32Array(q.pos.length);
            const nrm = q.nrm ? new Float32Array(q.nrm.length) : null;
            for (let k = 0; k < q.pos.length; k += 3) {
              for (let a = 0; a < 3; a++) {
                pos[k + a] = m[a] * q.pos[k] + m[4 + a] * q.pos[k + 1] + m[8 + a] * q.pos[k + 2] + m[12 + a];
                if (nrm && q.nrm) nrm[k + a] = m[a] * q.nrm[k] + m[4 + a] * q.nrm[k + 1] + m[8 + a] * q.nrm[k + 2];
              }
              if (nrm) {
                const l = Math.hypot(nrm[k], nrm[k + 1], nrm[k + 2]) || 1;
                for (let a = 0; a < 3; a++) nrm[k + a] /= l;
              }
            }
            const own = d.mats?.[i] ?? pack.matFor(q.material);
            const glass = BW.keep.includes(basename(pack.guidPath.get(own ?? "") ?? "").replace(/\.mat$/, ""));
            mats.push(glass && own ? own : wear);
            const b = backFaces(pos, nrm, q.uv, q.idx, BW.upright, glass ? null : BW.scale);
            return { pos: new Float32Array(b.pos), nrm: new Float32Array(b.nrm), uv: new Float32Array(b.uv), idx: new Uint32Array(b.idx), material: q.material };
          });
          const I: M4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
          const back = { d: { ...d, mats, model: { meshes: [{ name: "back", prims }], nodes: [], roots: [] } as unknown as Draw["model"], mesh: 0, pre: null }, m: I };
          all.push(back);
          towerDrawn.push(back);
        }
      // (drawn and colliding with its windows open; the floors' flood still meets the glass, or it ran out through them)
      const drawn = openWindows(id, mine);
      for (const q of drawn) chunkOf.set(q, id);
      all.push(...drawn);
      if (baseMask.has(id)) standingDraws.push(...mine);
      // (and the pieces closing its shell's slits: the partitions and cover inside are left out, so a gap is not hidden)
      if (id === "c-middle" || (id === "c-tower" && cfg.rules.tower?.slots && key.endsWith(`/${cfg.rules.tower.slots.piece}`))) towerDrawn.push(...drawn);
      if (how === "o" && EXACT?.pieces.some((f) => key.endsWith(`/${f}`))) {
        // the pack's fire escape (rules.fine.exact) collides as its own faces, not cells: its walkway beside the wall is
        // 1.09 m and its stair 1.08 m between stringer and handrail for a body 0.81 m across, and the next flight
        // stands 3 m over each; in cells of a quarter or an eighth of a metre a side lost part of a cell, the beam
        // under each landing and the risers of the flight above reached down to a head, and a body coming down stopped
        // short, put out over the railing or mantled up onto the flight above, by how the stack lay on the grid. Its
        // parts by `parts` (their model's mesh): a floor's faces up as plates `plate` deep (a landing from a fall is
        // swept from the feet before to the feet after, so a plate is not fallen through); a flight's faces up so, and
        // its sides (faces turned across the flight, its own x) as walls, its risers none (a riser's box came down to
        // a head on the flight under it); a rail's faces all as walls; the rest (its braces) none
        exactAt.push({ x, y, z, yaw });
        const a = (yaw * Math.PI) / 180;
        const [c, s] = [Math.cos(a), Math.sin(a)];
        for (const { d, m } of mine) {
          const mode = EXACT.parts[String(d.mesh)];
          if (!mode) continue;
          const up: number[][] = [];
          // (a part's wall slices in one square joined: a rail's tube is many faces, each sliced alike)
          const walls = new Map<string, number[]>();
          for (const q of d.model.meshes[d.mesh].prims) {
            const V = (k: number) => [0, 1, 2].map((i) => m[i] * q.pos[k * 3] + m[4 + i] * q.pos[k * 3 + 1] + m[8 + i] * q.pos[k * 3 + 2] + m[12 + i]);
            for (let k = 0; k + 2 < q.idx.length; k += 3) {
              const [A, B, D] = [V(q.idx[k]), V(q.idx[k + 1]), V(q.idx[k + 2])];
              const n = [(B[1] - A[1]) * (D[2] - A[2]) - (B[2] - A[2]) * (D[1] - A[1]), (B[2] - A[2]) * (D[0] - A[0]) - (B[0] - A[0]) * (D[2] - A[2]), (B[0] - A[0]) * (D[1] - A[1]) - (B[1] - A[1]) * (D[0] - A[0])];
              const L = Math.hypot(n[0], n[1], n[2]);
              if (L < 1e-9) continue;
              const [x0, x1, y1, z0, z1] = [Math.min(A[0], B[0], D[0]), Math.max(A[0], B[0], D[0]), Math.max(A[1], B[1], D[1]), Math.min(A[2], B[2], D[2]), Math.max(A[2], B[2], D[2])];
              // (its normal across the flight: the world's turned back into the piece's own x)
              const across = Math.abs(c * n[0] - s * n[2]) / L;
              // (a wall a slice at a time along the map's x and z, `slice` long, each its face's own bounds there: one
              // box for a sloped stringer or handrail stood from its foot to its top along all its length, across the
              // landing over its top)
              if (mode === "rail" || (mode === "flight" && across > 0.7))
                for (const b of sliced([A, B, D], EXACT.slice)) {
                  const key = `${Math.floor((b[0] + b[1]) / 2 / EXACT.slice)},${Math.floor((b[2] + b[3]) / 2 / EXACT.slice)}`;
                  const w = walls.get(key);
                  if (!w) walls.set(key, b);
                  else for (let i = 0; i < 6; i++) w[i] = i % 2 ? Math.max(w[i], b[i]) : Math.min(w[i], b[i]);
                }
              // (faces up level only: the flight's underside is one plane at 45 degrees, 0.71 up, and as a plate it
              // roofed the whole flight at a head's height)
              else if (n[1] / L > 0.9) up.push([x0, x1, z0, z1, y1 - EXACT.plate, y1, (A[0] + B[0] + D[0]) / 3, (A[2] + B[2] + D[2]) / 3]);
            }
          }
          // (a floor's faces up only where nothing of it lies over them: its beams' flanges face up under its deck,
          // and as plates they put the beam back over a head on the flight under it)
          for (const f of up)
            if (!up.some((g) => g[5] > f[5] + 0.01 && g[5] < f[5] + 0.6 && f[6] >= g[0] && f[6] <= g[1] && f[7] >= g[2] && f[7] <= g[3])) exactBoxes.push(f.slice(0, 6));
          exactBoxes.push(...walls.values());
        }
      } else if (how === "o") ((cfg.rules.fine.pieces as string[]).some((f) => key.endsWith(`/${f}`)) ? openFine : open).push(...drawn);
      else if (how === "s") {
        const boxes = columnSolids(mine, C.cell, C.stick, cfg.rules.shell);
        if (LAID.includes(id) && boxes.length) laid.push([solidBoxes.length, solidBoxes.length + boxes.length]);
        solidBoxes.push(...boxes);
      }
      if (how === "o" || how === "s") collidingDraws.push(...drawn);
      placed++;
    }
  }
  // the windows' piers (rules.windows): drawn in their wall's own material, `thick` deep about the glass's plane, their
  // fronts, backs and the ends a window has beside it (their tops and bottoms meet the frame), and colliding as boxes;
  // each window, from its sill to its head and `carve` either side of the plane, cut out of the cells' collision once it
  // is made. Written to `windows` for the checks, each with the way out of its building
  const windowBoxes: number[][] = [];
  const windowCuts: number[][] = [];
  cfg.windows = [];
  if (WIN && windowWalls.length) {
    // a window opens only onto something: a body's breadth of level rays, at three heights, `clear` metres out of it and
    // `room` metres into its building, meeting nothing drawn (on the tower's east side its windows looked into the east
    // block, and in the base some backed onto a stair); one that meets something is pier, and a wall none of whose windows
    // opens keeps its glass
    const CELL = 2;
    const want = new Set<string>();
    const cellOf = (x: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    for (const w of windowWalls)
      for (let t = -1; t <= w.L + 1; t += CELL / 2)
        for (let o = -WIN.room - 1; o <= WIN.clear + 1; o += CELL / 2) want.add(cellOf(w.p0[0] + w.U[0] * t + w.N[0] * o, w.p0[1] + w.U[1] * t + w.N[1] * o));
    // (of what collides: a ceiling lamp hanging just inside a window, at a standing head's height, is not what a window
    // opens onto, and it shut eleven of the tower's)
    const nearTris = new Map<string, Array<[number[], number[], number[]]>>();
    for (const { d, m } of collidingDraws)
        for (const q of d.model.meshes[d.mesh].prims) {
          const V = (i: number) => [0, 1, 2].map((a) => m[a] * q.pos[i * 3] + m[4 + a] * q.pos[i * 3 + 1] + m[8 + a] * q.pos[i * 3 + 2] + m[12 + a]);
          for (let k = 0; k + 2 < q.idx.length; k += 3) {
            const t = [V(q.idx[k]), V(q.idx[k + 1]), V(q.idx[k + 2])] as [number[], number[], number[]];
            const [x0, x1] = [Math.min(t[0][0], t[1][0], t[2][0]), Math.max(t[0][0], t[1][0], t[2][0])];
            const [z0, z1] = [Math.min(t[0][2], t[1][2], t[2][2]), Math.max(t[0][2], t[1][2], t[2][2])];
            for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++)
              for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
                const c = `${i},${j}`;
                if (want.has(c)) (nearTris.get(c) ?? nearTris.set(c, []).get(c)!).push(t);
              }
          }
        }
    /** whether a level segment from (x, y, z) along (dx, dz) for `len` metres meets a drawn triangle (either face) */
    const meets = (x: number, y: number, z: number, dx: number, dz: number, len: number): boolean => {
      const seen = new Set<object>();
      for (let s0 = 0; s0 <= len + CELL; s0 += CELL / 2) {
        for (const t of nearTris.get(cellOf(x + dx * Math.min(s0, len), z + dz * Math.min(s0, len))) ?? []) {
          if (seen.has(t)) continue;
          seen.add(t);
          const [a, b, c] = t;
          const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
          const pv = [-dz * e2[1], dz * e2[0] - dx * e2[2], dx * e2[1]];
          const det = e1[0] * pv[0] + e1[1] * pv[1] + e1[2] * pv[2];
          if (Math.abs(det) < 1e-12) continue;
          const tv = [x - a[0], y - a[1], z - a[2]];
          const u = (tv[0] * pv[0] + tv[1] * pv[1] + tv[2] * pv[2]) / det;
          if (u < 0 || u > 1) continue;
          const qv = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]];
          const v = (dx * qv[0] + dz * qv[2]) / det;
          if (v < 0 || u + v > 1) continue;
          const dist = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) / det;
          if (dist > 0 && dist < len) return true;
        }
      }
      return false;
    };
    let shut = 0;
    for (const w of windowWalls) {
      const SQ = cfg.tower?.square as number[] | undefined;
      const mid = w.chunk === "c-middle" && SQ ? [(SQ[0] + SQ[1]) / 2, (SQ[2] + SQ[3]) / 2] : [0, 0];
      const cx = w.p0[0] + w.U[0] * (w.L / 2), cz = w.p0[1] + w.U[1] * (w.L / 2);
      const sign = (cx - mid[0]) * w.N[0] + (cz - mid[1]) * w.N[1] > 0 ? 1 : -1;
      const out = [w.N[0] * sign, w.N[1] * sign];
      const opens = w.spans.filter(([t0, t1]) => {
        // (in, from just over the sill: a stair well's rail 0.75 m in at waist height left a window no way in; and
        // turned a quarter right and left too: a partition meeting the face behind a window lay along the straight rays,
        // which passed inside its thickness and met no face of it)
        for (const lat of [-0.4, 0, 0.4])
          for (const up of [0.3, 0.8, 1.3, 1.9])
            for (const turn of [0, 0.44, -0.44]) {
              const t = (t0 + t1) / 2 + lat;
              const [x, z] = [w.p0[0] + w.U[0] * t, w.p0[1] + w.U[1] * t];
              const y = w.sill + up;
              const [c, sn] = [Math.cos(turn), Math.sin(turn)];
              const [ox, oz] = [out[0] * c - out[1] * sn, out[0] * sn + out[1] * c];
              if (up > 0.5 && meets(x + out[0] * 0.3, y, z + out[1] * 0.3, ox, oz, WIN.clear)) return false;
              if (meets(x - out[0] * 0.3, y, z - out[1] * 0.3, -ox, -oz, WIN.room)) return false;
            }
        return true;
      });
      shut += w.spans.length - opens.length;
      w.spans = opens;
      if (!opens.length) {
        const g = groups.get(groupOf(w.chunk))!;
        g.push(w.glass);
        chunkOf.set(w.glass, w.chunk);
        if (w.chunk === "c-middle") towerDrawn.push(w.glass);
        open.push(w.glass);
      }
    }
    console.log(`windows: ${shut} left shut, opening onto something within ${WIN.clear} m out or ${WIN.room} m in`);
    const piers = new Map<string, { pos: number[]; nrm: number[]; uv: number[]; idx: number[]; chunk: string; mat: string }>();
    for (const w of windowWalls) {
      if (!w.spans.length) continue;
      const P = (t: number, o: number, y: number) => [w.p0[0] + w.U[0] * t + w.N[0] * o, y, w.p0[1] + w.U[1] * t + w.N[1] * o];
      const box = (t0: number, t1: number, o0: number, o1: number, y0: number, y1: number) => {
        const [a, b] = [P(t0, o0, y0), P(t1, o1, y1)];
        return [Math.min(a[0], b[0]), Math.max(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[2], b[2]), y0, y1];
      };
      const key = `${w.chunk}|${w.mat}`;
      const g = piers.get(key) ?? piers.set(key, { pos: [], nrm: [], uv: [], idx: [], chunk: w.chunk, mat: w.mat }).get(key)!;
      /** a face's four corners, counter-clockwise seen from its front, `n` its normal, mapped by the metre along and up */
      const face = (c: number[][], n: number[], along: number[]) => {
        const base = g.pos.length / 3;
        for (const [k, q] of c.entries()) {
          g.pos.push(...q);
          g.nrm.push(...n);
          g.uv.push(along[k] * WIN.scale, q[1] * WIN.scale);
        }
        g.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      };
      const T = WIN.thick / 2;
      const [y0, y1] = [w.sill, w.head];
      const U3 = [w.U[0], 0, w.U[1]], N3 = [w.N[0], 0, w.N[1]];
      const edges = [0, ...w.spans.flat(), w.L];
      for (let k = 0; k + 1 < edges.length; k += 2) {
        const [t0, t1] = [edges[k], edges[k + 1]];
        if (t1 - t0 < 1e-3) continue;
        windowBoxes.push(box(t0, t1, -T, T, y0, y1));
        face([P(t0, T, y0), P(t1, T, y0), P(t1, T, y1), P(t0, T, y1)], N3, [t0, t1, t1, t0]);
        face([P(t1, -T, y0), P(t0, -T, y0), P(t0, -T, y1), P(t1, -T, y1)], N3.map((v) => -v), [t1, t0, t0, t1]);
        if (t0 > 1e-3) face([P(t0, -T, y0), P(t0, T, y0), P(t0, T, y1), P(t0, -T, y1)], U3.map((v) => -v), [-T, T, T, -T]);
        if (t1 < w.L - 1e-3) face([P(t1, T, y0), P(t1, -T, y0), P(t1, -T, y1), P(t1, T, y1)], U3, [T, -T, -T, T]);
      }
      // (the way out: away from the middle of the tower's square, or of the base)
      const SQ = cfg.tower?.square as number[] | undefined;
      const mid = w.chunk === "c-middle" && SQ ? [(SQ[0] + SQ[1]) / 2, (SQ[2] + SQ[3]) / 2] : [0, 0];
      for (const [t0, t1] of w.spans) {
        // (from the floor up: the cells under a sill reached half a metre into the room, a 0.44 m step where a standing
        // head met the ceiling, 2.2 m over the tower's floors, and was pushed off it; the sill stands as its own box,
        // the wall's depth)
        windowCuts.push(box(t0, t1, -WIN.carve, WIN.carve, w.base + 0.05, y1));
        windowBoxes.push(box(t0, t1, -T, T, w.base, y0));
        const c = P((t0 + t1) / 2, 0, (y0 + y1) / 2);
        const sign = (c[0] - mid[0]) * w.N[0] + (c[2] - mid[1]) * w.N[1] > 0 ? 1 : -1;
        (cfg.windows as unknown[]).push({ at: c.map((v) => +v.toFixed(3)), out: [w.N[0] * sign, w.N[1] * sign], wide: +(t1 - t0).toFixed(3), sill: +y0.toFixed(3), high: +(y1 - y0).toFixed(3), chunk: w.chunk });
      }
    }
    for (const g of piers.values()) {
      const model = { meshes: [{ name: "window piers", prims: [{ pos: new Float32Array(g.pos), nrm: new Float32Array(g.nrm), uv: new Float32Array(g.uv), idx: new Uint32Array(g.idx), material: "pier" }] }], nodes: [], roots: [] } as unknown as Draw["model"];
      const dm = { d: { model, mesh: 0, pre: null, mats: [g.mat], modelGuid: "", on: true, go: null } as Draw, m: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as M4 };
      chunkOf.set(dm, g.chunk);
      (groups.get(groupOf(g.chunk)) ?? groups.set(groupOf(g.chunk), []).get(groupOf(g.chunk))!).push(dm);
      if (g.chunk === "c-middle") towerDrawn.push(dm);
    }
    const by = (c: string) => (cfg.windows as Array<{ chunk: string }>).filter((q) => q.chunk === c).length;
    console.log(`windows: ${cfg.windows.length} opened in ${windowWalls.length} walls (the tower ${by("c-middle")}, the base ${by("c-base")}), ${windowBoxes.length} piers`);
  }
  // the Sky Ring (rules.skyring): the walkway storey round the tower's plaza, a true circle of the pack's floor slab
  // (its paving on top, its brick edges, its plaster underside, as FloorBasic00 wears them), too round for the pack's
  // straight slabs to follow without a gap at every joint; walked on, so measured for the collision like any room
  const SR = cfg.rules.skyring;
  if (SR) {
    const parts = ringSlab(SR.r0, SR.r1, SR.deck, SR.thick, SR.segments, SR.scale);
    const prims = (["top", "edge", "under"] as const).map((k) => ({ pos: new Float32Array(parts[k].pos), nrm: new Float32Array(parts[k].nrm), uv: new Float32Array(parts[k].uv), idx: new Uint32Array(parts[k].idx), material: SR.mats[k] }));
    const mats = prims.map((p) => {
      const g = pack.matFor(p.material);
      if (!g) throw new Error(`no material ${p.material}`);
      return g;
    });
    const model = { meshes: [{ name: "skyring", prims }], nodes: [], roots: [] } as unknown as Draw["model"];
    const d: Draw = { model, mesh: 0, pre: null, mats, modelGuid: "", on: true, go: null };
    const I: M4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    (groups.get(groupOf("c-skyring")) ?? groups.set(groupOf("c-skyring"), []).get(groupOf("c-skyring"))!).push({ d, m: I });
    // (at the finer cell: at the half metre its inner edge stood over the last tread of each stair up to it)
    openFine.push({ d, m: I });
    console.log(`the Sky Ring: ${prims.reduce((a, p) => a + p.idx.length / 3, 0)} triangles`);
  }
  // the base's floors (cfg.base, tools/neon-base.ts): each storey's slab from the base's outline (on the ground storey,
  // the court's opening, the plaza's tiles being the floor elsewhere) in to what already stands there, measured off its
  // triangles, less the stairs' wells and the atria; walked on, so measured for the collision at the finer cell
  const BS = cfg.base;
  if (BS) {
    const tris = function* (): Generator<[number[], number[], number[]]> {
      for (const { d, m } of standingDraws)
        for (const q of d.model.meshes[d.mesh].prims) {
          const V = (i: number) => [0, 1, 2].map((a) => m[a] * q.pos[i * 3] + m[4 + a] * q.pos[i * 3 + 1] + m[8 + a] * q.pos[i * 3 + 2] + m[12 + a]);
          for (let k = 0; k + 2 < q.idx.length; k += 3) yield [V(q.idx[k]), V(q.idx[k + 1]), V(q.idx[k + 2])];
        }
    };
    const pts: Pt[] = [...BS.outline, ...BS.levels.flatMap((l: { adds: Pt[][] }) => l.adds.flat())];
    const cell = BS.cell;
    const gx0 = Math.floor(Math.min(...pts.map((p) => p[0])) / cell) * cell - cell, gz0 = Math.floor(Math.min(...pts.map((p) => p[1])) / cell) * cell - cell;
    const g: Grid = { x0: gx0, z0: gz0, cell, nx: Math.ceil((Math.max(...pts.map((p) => p[0])) - gx0) / cell) + 2, nz: Math.ceil((Math.max(...pts.map((p) => p[1])) - gz0) / cell) + 2 };
    const court = cfg.court as { x0: number; x1: number; z0: number; z1: number };
    const courtRing: Pt[] = [[court.x0, court.z0], [court.x1, court.z0], [court.x1, court.z1], [court.x0, court.z1]];
    let tri = 0;
    for (const L of BS.levels as Array<{ y: number; holes: Pt[][]; adds: Pt[][]; court?: boolean }>) {
      // (what stands in a body's height over the floor and the floor's own depth under it)
      const stood = standing(g, tris(), L.y - BS.slab - 0.05, L.y + 2);
      const region = L.court ? (x: number, z: number) => sdPoly(courtRing, x, z) : (x: number, z: number) => Math.min(sdPoly(BS.outline, x, z), ...L.adds.map((a) => sdPoly(a, x, z)));
      // (nor across the tower's stair core: its cut leaves nothing standing in its box, which the base's floor would fill)
      const core: Pt[][] = cfg.tower ? [((b) => [[b[0], b[2]], [b[1], b[2]], [b[1], b[3]], [b[0], b[3]]] as Pt[])(cfg.tower.core.box)] : [];
      const parts = storeySlab(g, region, [...L.holes, ...core], stood, L.y - BS.tuck, BS.slab, BS.scale);
      const prims = (["top", "edge", "under"] as const).map((k) => ({ pos: new Float32Array(parts[k].pos), nrm: new Float32Array(parts[k].nrm), uv: new Float32Array(parts[k].uv), idx: new Uint32Array(parts[k].idx), material: BS.mats[k] }));
      const mats = prims.map((p) => {
        const mg = pack.matFor(p.material);
        if (!mg) throw new Error(`no material ${p.material}`);
        return mg;
      });
      const model = { meshes: [{ name: `base-${L.y}`, prims }], nodes: [], roots: [] } as unknown as Draw["model"];
      const d: Draw = { model, mesh: 0, pre: null, mats, modelGuid: "", on: true, go: null };
      const I: M4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      (groups.get(groupOf("c-base")) ?? groups.set(groupOf("c-base"), []).get(groupOf("c-base"))!).push({ d, m: I });
      openFine.push({ d, m: I });
      tri += prims.reduce((a, p) => a + p.idx.length / 3, 0);
    }
    console.log(`the base's floors: ${BS.levels.length} storeys, ${tri} triangles`);
  }
  // the tower's floors (cfg.tower, tools/neon-tower.ts): its stair core, walls and landings and steps; and the main
  // body's floors from 14 to 35 m, each the inside of its shell at that storey (measured off the shell's triangles, a
  // flood from a seed inside, so its round corners and the grooves down each face come out as they stand), less the core
  const TW = cfg.tower;
  if (TW) {
    const I: M4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const push = (name: string, parts: Array<{ part: { pos: number[]; nrm: number[]; uv: number[]; idx: number[] }; mat: string }>) => {
      const prims = parts.filter((q) => q.part.idx.length).map((q) => ({ pos: new Float32Array(q.part.pos), nrm: new Float32Array(q.part.nrm), uv: new Float32Array(q.part.uv), idx: new Uint32Array(q.part.idx), material: q.mat }));
      const mats = prims.map((p) => {
        const mg = derivedMat(p.material) ?? pack.matFor(p.material);
        if (!mg) throw new Error(`no material ${p.material}`);
        return mg;
      });
      const model = { meshes: [{ name, prims }], nodes: [], roots: [] } as unknown as Draw["model"];
      const d: Draw = { model, mesh: 0, pre: null, mats, modelGuid: "", on: true, go: null };
      (groups.get(groupOf("c-middle")) ?? groups.set(groupOf("c-middle"), []).get(groupOf("c-middle"))!).push({ d, m: I });
      openFine.push({ d, m: I });
      return prims.reduce((a, p) => a + p.idx.length / 3, 0);
    };
    const C2 = TW.core;
    const core = stairCore({ ...C2, box: C2.box }, C2.scale);
    let tri = push("tower-core", [{ part: core.walls, mat: C2.mats.wall }, { part: core.landings, mat: TW.mats.top }, { part: core.steps, mat: C2.mats.step }]);
    // the Well's stairs (cfg.well.flights, tools/neon-well.ts): each flight's treads and its walls, and its slot's parapet
    const WF = cfg.well as { flights?: Flight[]; flightSpec: Parameters<typeof wellFlight>[1]; flightScale: { step: number; wall: number }; flightMats: { step: string; wall: string } } | undefined;
    for (const f of WF?.flights ?? []) {
      const w = wellFlight(f, WF!.flightSpec, WF!.flightScale);
      tri += push("well-flight", [{ part: w.steps, mat: WF!.flightMats.step }, { part: w.walls, mat: WF!.flightMats.wall }]);
    }
    // the Well's back (cfg.well.back): a wall round the stack's footprint underground, from under its bottom to under
    // the street. The pack's galleries stood among its other buildings in the pack's own scene, and through the gaps in
    // their shopfronts here one looked out on nothing; the corridor's way through it left open, a lintel over it
    const WK = cfg.well as { foot: number[]; bottom: number; corridor?: number[][]; back?: { thick: number; under: number; top: number; door: number; mat: string; scale: number } } | undefined;
    if (WK?.back) {
      const B2 = WK.back;
      const bp = { pos: [] as number[], uv: [] as number[], nrm: [] as number[], idx: [] as number[] };
      const [x0, x1, z0, z1] = WK.foot;
      const [t, yb, yt] = [B2.thick, WK.bottom - B2.under, B2.top];
      boxInto(bp, x0 - t, x0, yb, yt, z0 - t, z1 + t, B2.scale);
      boxInto(bp, x1, x1 + t, yb, yt, z0 - t, z1 + t, B2.scale);
      boxInto(bp, x0, x1, yb, yt, z1, z1 + t, B2.scale);
      const door = WK.corridor?.[1];
      if (door) {
        boxInto(bp, x0, door[0], yb, yt, z0 - t, z0, B2.scale);
        boxInto(bp, door[1], x1, yb, yt, z0 - t, z0, B2.scale);
        boxInto(bp, door[0], door[1], WK.bottom + B2.door, yt, z0 - t, z0, B2.scale);
      } else boxInto(bp, x0, x1, yb, yt, z0 - t, z0, B2.scale);
      tri += push("well-back", [{ part: bp, mat: B2.mat }]);
    }
    // the main body's floors: the tower's own triangles at each storey are its shell (its middle is cleared from 14 m)
    const towerTris = function* (): Generator<[number[], number[], number[]]> {
      for (const { d, m } of standingDraws)
        for (const q of d.model.meshes[d.mesh].prims) {
          const V = (i: number) => [0, 1, 2].map((a) => m[a] * q.pos[i * 3] + m[4 + a] * q.pos[i * 3 + 1] + m[8 + a] * q.pos[i * 3 + 2] + m[12 + a]);
          for (let k = 0; k + 2 < q.idx.length; k += 3) yield [V(q.idx[k]), V(q.idx[k + 1]), V(q.idx[k + 2])];
        }
    };
    const [sx0, sx1, sz0, sz1] = TW.square;
    const cell = TW.cell;
    const g: Grid = { x0: sx0 - 1, z0: sz0 - 1, cell, nx: Math.ceil((sx1 - sx0 + 2) / cell), nz: Math.ceil((sz1 - sz0 + 2) / cell) };
    const [cx0, cx1, cz0, cz1] = C2.box;
    const coreHole: Pt[] = [[cx0, cz0], [cx1, cz0], [cx1, cz1], [cx0, cz1]];
    const areas: number[] = [];
    const holes: number[] = [];
    const bands: Array<{ at: number; length: number }> = [];
    // (the tower as drawn and the core's walls, triangle by triangle on the map, for the seal's rays)
    const drawnTris: Array<[number[], number[], number[]]> = [];
    for (const { d, m } of towerDrawn)
      for (const q of d.model.meshes[d.mesh].prims) {
        const V = (i: number) => [0, 1, 2].map((a) => m[a] * q.pos[i * 3] + m[4 + a] * q.pos[i * 3 + 1] + m[8 + a] * q.pos[i * 3 + 2] + m[12 + a]);
        for (let k = 0; k + 2 < q.idx.length; k += 3) drawnTris.push([V(q.idx[k]), V(q.idx[k + 1]), V(q.idx[k + 2])]);
      }
    for (let k = 0; k + 2 < core.walls.idx.length; k += 3) drawnTris.push([0, 1, 2].map((j) => core.walls.pos.slice(core.walls.idx[k + j] * 3, core.walls.idx[k + j] * 3 + 3)) as [number[], number[], number[]]);
    const seal: Array<{ at: number; rays: number; out: number[][]; windows: number; gaps: number }> = [];
    for (const h of TW.shaft as number[]) {
      // (what stands on this floor, from just over it: the glass round the storey under 14 m tops out at 13.5)
      const stood = standing(g, towerTris(), h + 0.05, h + 2);
      const inn0 = inside(g, stood, TW.seed, TW.close, TW.reach);
      // (and out to the building's skin at the slab's own height, `fill` metres in from the open air: at standing height
      // the window frames and piers stand in from the skin, and a slab stopped at them left pockets behind them, a ragged
      // crack along the floor and the ceiling with the sky and the street through it, round every floor of the tower; the
      // cracks left open are measured as the skin's inside less the slab and what stands at its height)
      // (the skin: the wall under the windows' sills, `skin` metres over the floor, whole round the facade; at the slab's
      // own height the skin is open where the pack's floors met it, and the air flooded in through those very cracks)
      const TF = cfg.rules.tower as { fill: number; skin: number[]; skirt: number };
      const atSlab = standing(g, towerTris(), h - TW.slab, h + 0.05);
      const skin = standing(g, towerTris(), h + TF.skin[0], h + TF.skin[1]);
      const inCore = (x: number, z: number) => x > cx0 - 0.3 && x < cx1 + 0.3 && z > cz0 - 0.3 && z < cz1 + 0.3;
      // (not over a floor or ledge the pack already has at the slab's top: the two fought in one plane)
      const ledge = flatAt(g, towerTris(), h, 0.003);
      const filled = fillTo(g, inn0.cells, skin, Math.round(TF.fill / cell), inCore, TF.fill > 0, skin, ledge);
      const left = fillTo(g, filled.cells, skin, Math.max(2, Math.round(TF.fill / cell)), inCore, false, atSlab);
      const inn = { cells: filled.cells, n: filled.cells.reduce((a, v) => a + v, 0) };
      holes.push(+left.holes.toFixed(2));
      areas.push(inn.n * cell * cell);
      // (a corner of the grid is in the floor when any cell round it is)
      const region = (x: number, z: number) => {
        const i = Math.round((x - g.x0) / cell), j = Math.round((z - g.z0) / cell);
        const c = (a: number, b: number) => a >= 0 && a < g.nx && b >= 0 && b < g.nz && inn.cells[b * g.nx + a] === 1;
        return c(i - 1, j - 1) || c(i, j - 1) || c(i - 1, j) || c(i, j) ? -cell / 2 : cell / 2;
      };
      const parts = storeySlab(g, region, [coreHole], null, h, TW.slab, TW.scale);
      // is it sealed: from points a few metres apart over its floor, out of the core, a fan of rays at eye height each
      // meeting a face turned toward it (tools/neon-tower.ts escapes)
      const pts: number[][] = [];
      for (let j = 0; j < g.nz; j += Math.round(TW.seal.every / cell))
        for (let i = 0; i < g.nx; i += Math.round(TW.seal.every / cell)) {
          const [x, z] = [g.x0 + (i + 0.5) * cell, g.z0 + (j + 0.5) * cell];
          if (inn.cells[j * g.nx + i] && sdPoly(coreHole, x, z) > 1 && region(x - 1, z) < 0 && region(x + 1, z) < 0 && region(x, z - 1) < 0 && region(x, z + 1) < 0) pts.push([x, z]);
        }
      const e = escapes(drawnTris, pts, h + TW.seal.eye, TW.seal.rays, TW.seal.far);
      // (a ray out through a window is the window: only one out through anything else is a gap)
      const eye = h + TW.seal.eye;
      const wins = (cfg.windows as Array<{ at: number[]; out: number[]; wide: number; sill: number; high: number }>).filter((q) => eye > q.sill && eye < q.sill + q.high);
      const through = (o: number[]) => {
        const t = (o[2] * Math.PI) / 180;
        const [dx, dz] = [Math.cos(t), Math.sin(t)];
        return wins.some((q) => {
          const dn = dx * q.out[0] + dz * q.out[1];
          if (Math.abs(dn) < 1e-6) return false;
          const k = ((q.at[0] - o[0]) * q.out[0] + (q.at[2] - o[1]) * q.out[1]) / dn;
          if (k <= 0 || k > TW.seal.far) return false;
          const [hx, hz] = [o[0] + dx * k, o[1] + dz * k];
          return Math.abs((hx - q.at[0]) * q.out[1] - (hz - q.at[2]) * q.out[0]) <= q.wide / 2;
        });
      };
      const gaps = e.out.filter((o) => !through(o));
      seal.push({ at: h, rays: e.rays, out: gaps.slice(0, 12), windows: e.out.length - gaps.length, gaps: gaps.length });
      // (each floor's own tiles on top, rules.tower.floors.at[h].floorMat, where it names them)
      const own = (cfg.rules.tower.floors.at as Record<string, { floorMat?: string }>)[String(h)]?.floorMat;
      // (and a skirt along its outer edge up to under the sills, `skirt` metres: the facade's panels stop short of the
      // floor, and the city showed through the slit at its foot)
      const skirt = skirtAlong(g, region, h, TF.skirt, TW.scale);
      // THE VAULT from outside (rules.tower.vaultBand; the second review: "mark THE VAULT from outside"): a band of gold
      // light round the facade's skin at the slab line of each floor in `at`, the vault storey's floor and the one over
      // it, `out` proud of the skin and `high` tall up to `top` over the floor, so the storey reads from the plaza, the
      // decks and the air
      const VB = cfg.rules.tower.vaultBand as { at: number[]; out: number; high: number; top: number; mat: string } | undefined;
      if (VB && VB.at.includes(h)) {
        const band = bandAlong(g, skinRegion(g, skin), h + VB.top - VB.high, h + VB.top, VB.out, TW.scale);
        tri += push(`vault-band-${h}`, [{ part: band.part, mat: VB.mat }]);
        bands.push({ at: h, length: +band.length.toFixed(1) });
      }
      tri += push(`tower-${h}`, [...(["top", "edge", "under"] as const).map((k) => ({ part: parts[k], mat: k === "top" && own ? own : TW.mats[k] })), { part: skirt, mat: TW.mats.edge }]);
    }
    // (the main body is 22.5 by 20.5 m outside its shell: a floor much bigger got out through a gap in it)
    if (areas.some((a) => a > (sx1 - sx0) * (sz1 - sz0))) throw new Error(`a tower floor came out bigger than the tower: ${areas.map((a) => a.toFixed(0)).join(", ")} m2`);
    console.log(`the tower's floors' cracks along the facade left open: ${holes.map((m, k) => `${TW.shaft[k]} m ${m} m2`).join(", ")}`);
    if (bands.length) console.log(`THE VAULT's gold bands: ${bands.map((b) => `${b.at} m ${b.length} m long`).join(", ")}`);
    cfg.tower.measured = { floors: areas.map((a) => +a.toFixed(1)), holes, bands, seal: seal.map((q) => ({ at: q.at, rays: q.rays, out: q.gaps, windows: q.windows, where: q.out })) };
    console.log(`the tower's floors sealed but for their windows: ${seal.map((q) => `${q.at} m ${q.gaps} of ${q.rays} rays out elsewhere, ${q.windows} through the windows`).join("; ")}`);
    console.log(`the tower's floors: its core and ${TW.shaft.length} floors (${areas.map((a) => a.toFixed(0)).join(", ")} m2), ${tri} triangles`);
    // over the base and the tower, a face-up triangle in the same plane as another material's, which the eye sees as a
    // sawtooth of the two showing through by turns: the pack's own walls topped flush by its floor strips, the court's
    // tiles on the plaza's ground. Settled (tools/neon-tower.ts settle): the one wholly over the material with more of
    // the plane there is left out, each draw so cut drawn again on the map without it
    const xs = (cfg.base?.outline ?? [[sx0, sz0], [sx1, sz1]]).map((q: number[]) => q[0]), zs = (cfg.base?.outline ?? [[sx0, sz0], [sx1, sz1]]).map((q: number[]) => q[1]);
    const box = [Math.min(...xs) - 1, Math.max(...xs) + 1, Math.min(...zs) - 1, Math.max(...zs) + 1];
    const refs: Array<{ list: Array<{ d: Draw; m: M4 }>; at: number; prim: number; tri: number }> = [];
    const flatOnes = function* (): Generator<{ p: number[][]; mat: string; key: number }> {
      for (const list of groups.values())
        for (const [at, { d, m }] of list.entries())
          for (const [i, q] of d.model.meshes[d.mesh].prims.entries()) {
            const V = (k: number) => [0, 1, 2].map((a) => m[a] * q.pos[k * 3] + m[4 + a] * q.pos[k * 3 + 1] + m[8 + a] * q.pos[k * 3 + 2] + m[12 + a]);
            const mat = d.mats?.[i] ?? q.material;
            for (let k = 0; k + 2 < q.idx.length; k += 3) {
              const p = [V(q.idx[k]), V(q.idx[k + 1]), V(q.idx[k + 2])];
              if (Math.max(p[0][1], p[1][1], p[2][1]) - Math.min(p[0][1], p[1][1], p[2][1]) > 0.001) continue;
              refs.push({ list, at, prim: i, tri: k / 3 });
              yield { p, mat, key: refs.length - 1 };
            }
          }
    };
    // (over the Well's footprint too, rules.well: its galleries' floors and its bottom's tiles meet in one plane)
    const boxes = [box, ...(cfg.well?.foot ? [cfg.well.foot as number[]] : [])];
    const dropped = new Set<number>();
    for (const b of boxes) for (const k of settle(flatOnes(), b, TW.coplanar.cell)) dropped.add(k);
    const byDraw = new Map<string, { list: Array<{ d: Draw; m: M4 }>; at: number; tris: Map<number, Set<number>> }>();
    const lists = [...groups.values()];
    for (const key of dropped) {
      const r = refs[key];
      const id = `${lists.indexOf(r.list)}:${r.at}`;
      const e = byDraw.get(id) ?? byDraw.set(id, { list: r.list, at: r.at, tris: new Map() }).get(id)!;
      (e.tris.get(r.prim) ?? e.tris.set(r.prim, new Set()).get(r.prim)!).add(r.tri);
    }
    for (const { list, at, tris } of byDraw.values()) {
      const { d, m } = list[at];
      const prims = d.model.meshes[d.mesh].prims.map((q, i) => {
        const pos = new Float32Array(q.pos.length);
        const nrm = q.nrm ? new Float32Array(q.nrm.length) : null;
        for (let k = 0; k < q.pos.length; k += 3)
          for (let a = 0; a < 3; a++) {
            pos[k + a] = m[a] * q.pos[k] + m[4 + a] * q.pos[k + 1] + m[8 + a] * q.pos[k + 2] + m[12 + a];
            if (nrm && q.nrm) nrm[k + a] = m[a] * q.nrm[k] + m[4 + a] * q.nrm[k + 1] + m[8 + a] * q.nrm[k + 2];
          }
        const out = tris.get(i);
        const idx = out ? Array.from(q.idx).filter((_, k) => !out.has(Math.floor(k / 3))) : Array.from(q.idx);
        return { pos, nrm, uv: q.uv ? new Float32Array(q.uv) : null, idx: new Uint32Array(idx), material: q.material };
      });
      const again = { d: { ...d, model: { meshes: [{ name: d.model.meshes[d.mesh].name, prims }], nodes: [], roots: [] } as unknown as Draw["model"], mesh: 0, pre: null }, m: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as M4 };
      chunkOf.set(again, chunkOf.get(list[at]) ?? "made");
      list[at] = again;
    }
    console.log(`face up in another's plane, settled: ${dropped.size} triangles left out of ${byDraw.size} draws`);
    const flat = function* (): Generator<{ p: number[][]; mat: string; who: string }> {
      for (const list of groups.values())
        for (const dm of list)
          for (const [i, q] of dm.d.model.meshes[dm.d.mesh].prims.entries()) {
            const { d, m } = dm;
            const V = (k: number) => [0, 1, 2].map((a) => m[a] * q.pos[k * 3] + m[4 + a] * q.pos[k * 3 + 1] + m[8 + a] * q.pos[k * 3 + 2] + m[12 + a]);
            const mat = d.mats?.[i] ?? q.material;
            const who = `${chunkOf.get(dm) ?? "made"}: ${basename(pack.guidPath.get(d.modelGuid) ?? "") || d.model.meshes[d.mesh].name}`;
            for (let k = 0; k + 2 < q.idx.length; k += 3) yield { p: [V(q.idx[k]), V(q.idx[k + 1]), V(q.idx[k + 2])], mat, who };
          }
    };
    const fights = boxes.flatMap((b) => coplanar(flat(), b, TW.coplanar.cell)).sort((p, q) => q.m2 - p.m2);
    // (each material by its name: the pack's are known to the bake by their guids)
    const named = fights.slice(0, 16).map((q) => ({ ...q, mats: q.mats.map((g) => g.replace(/^[^ ]+/, (k) => basename(pack.guidPath.get(k) ?? k).replace(/\.mat$/, ""))) }));
    cfg.tower.measured.coplanar = named;
    // the Well sealed (cfg.well): from every metre of each gallery's floor with a body's room over it, a fan of level rays
    // at eye height each meeting a drawn face turned toward it (tools/neon-tower.ts escapes). The pack's galleries stood
    // among its other buildings in the pack's own scene: a gap in their shopfronts here looks out on nothing, the sky's
    // colour through the ground, and the collision cannot see it (a stair's low wall, laid on cells, filled it there)
    const WS = cfg.well as { foot: number[]; hole: number[]; levels: number[]; bottom: number; measured?: unknown } | undefined;
    if (WS) {
      const [wx0, wx1, wz0, wz1] = WS.foot;
      const all: Array<[number[], number[], number[]]> = [];
      for (const list of groups.values())
        for (const { d, m } of list)
          for (const q of d.model.meshes[d.mesh].prims) {
            const V = (k: number) => [0, 1, 2].map((a) => m[a] * q.pos[k * 3] + m[4 + a] * q.pos[k * 3 + 1] + m[8 + a] * q.pos[k * 3 + 2] + m[12 + a]);
            for (let k = 0; k + 2 < q.idx.length; k += 3) {
              const t = [V(q.idx[k]), V(q.idx[k + 1]), V(q.idx[k + 2])] as [number[], number[], number[]];
              if (Math.max(t[0][0], t[1][0], t[2][0]) < wx0 - 60 || Math.min(t[0][0], t[1][0], t[2][0]) > wx1 + 60 || Math.max(t[0][2], t[1][2], t[2][2]) < wz0 - 60 || Math.min(t[0][2], t[1][2], t[2][2]) > wz1 + 60) continue;
              if (Math.min(t[0][1], t[1][1], t[2][1]) > 2 || Math.max(t[0][1], t[1][1], t[2][1]) < WS.bottom - 1) continue;
              all.push(t);
            }
          }
      const cell = 0.5;
      const gw: Grid = { x0: wx0, z0: wz0, cell, nx: Math.ceil((wx1 - wx0) / cell), nz: Math.ceil((wz1 - wz0) / cell) };
      const seal: Array<{ at: number; points: number; rays: number; out: number; where: number[][] }> = [];
      for (const y of WS.levels.slice(1)) {
        // its floor here: a face-up triangle at its height over the point
        const floors = all.filter(([a, b, c]) => Math.abs(a[1] - y) < 0.06 && Math.abs(b[1] - y) < 0.06 && Math.abs(c[1] - y) < 0.06 && (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) > 1e-9);
        const under = (x: number, z: number) => floors.some(([a, b, c]) => {
          const side = (q: number[], r: number[]) => (q[0] - x) * (r[2] - z) - (r[0] - x) * (q[2] - z);
          const [s1, s2, s3] = [side(a, b), side(b, c), side(c, a)];
          return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
        });
        const stood = standing(gw, all, y + 0.3, y + 1.8);
        const clear = (x: number, z: number) => {
          const [i, j] = [Math.floor((x - gw.x0) / cell), Math.floor((z - gw.z0) / cell)];
          for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) if (a >= 0 && a < gw.nx && b >= 0 && b < gw.nz && stood[b * gw.nx + a]) return false;
          return true;
        };
        const pts: number[][] = [];
        for (let x = wx0 + 0.5; x < wx1; x += 1) for (let z = wz0 + 0.5; z < wz1; z += 1) if (under(x, z) && clear(x, z)) pts.push([x, z]);
        const e = escapes(all, pts, y + 1.6, 24, 60);
        seal.push({ at: y, points: pts.length, rays: e.rays, out: e.out.length, where: e.out.slice(0, 16) });
      }
      (cfg.well as { measured?: unknown }).measured = { seal };
      console.log(`the Well sealed: ${seal.map((q) => `${q.at} m ${q.out} of ${q.rays} rays out from ${q.points} points`).join("; ")}`);
    }
    console.log(`drawn face up over another in the same plane: ${named.length ? named.slice(0, 10).map((q) => `${q.m2} m2 at ${q.y} m in ${q.patches}, most at (${q.at.join(", ")}), ${q.mats.join(" over ")}`).join("; ") : "none"}`);
  }
  // the rooms, stairs and what stands in the open: their own spans, as a district's are (no fill: these pieces are whole)
  // (below the street kept: the tallest building stands in a pit to its basement, 7 m down, whose floors the districts'
  // street-scrap rule, nothing topping out under 0.35 m, threw away; rules.below)
  const { solids: coarse } = districtSolids(open, { cell: C.cell, stick: C.stick, floor: cfg.rules.below.floor, merge: C.merge, thin: C.thin, minTop: cfg.rules.below.minTop });
  const { solids: fine } = openFine.length ? districtSolids(openFine, { cell: cfg.rules.fine.cell, stick: C.stick, floor: cfg.rules.below.floor, merge: C.merge, thin: C.thin, minTop: cfg.rules.below.minTop }) : { solids: [] };
  if (exactBoxes.length) console.log(`${exactAt.length} pieces colliding as their own faces: ${exactBoxes.length} collision boxes`);
  // (and each flight's room its own, rules.fine.exact.room, in its own metres x0, x1, y0, y1, z0, z1 from its wall side
  // out: the rest's collision reaching into it cut back to the wall's plane. A wall's sills and pipes stand out of it
  // under 0.12 m, and at the quarter metre filled a cell, 0.25 m into a walkway 1.09 m wide, where a body 0.81 m across
  // then did not pass; what is drawn is as it was, and a body there is 0.41 m off the wall at least)
  let trimmed = 0;
  const cutBack = (list: number[][]): number[][] => {
    if (!EXACT?.room) return list;
    const [rx0, rx1, ry0, ry1, rz0, rz1] = EXACT.room;
    const out: number[][] = [];
    for (const b of list) {
      let keep = true;
      for (const q of exactAt) {
        const a = (q.yaw * Math.PI) / 180;
        const [c, s] = [Math.round(Math.cos(a)), Math.round(Math.sin(a))];
        // the box's corners in the flight's own metres (it turns by quarter turns only)
        const xs: number[] = [], zs: number[] = [];
        for (const wx of [b[0], b[1]]) for (const wz of [b[2], b[3]]) {
          const [dx, dz] = [wx - q.x, wz - q.z];
          xs.push(c * dx - s * dz);
          zs.push(s * dx + c * dz);
        }
        const [lx0, lx1, lz0, lz1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
        if (lx1 <= rx0 + 1e-6 || lx0 >= rx1 || lz1 <= rz0 || lz0 >= rz1 || b[5] <= q.y + ry0 || b[4] >= q.y + ry1) continue;
        trimmed++;
        if (lx0 >= rx0 - 1e-6) { keep = false; break; }
        // back to the wall's plane: its own x from lx0 to rx0, turned back to the map's
        const back = (lx: number, lz: number) => [q.x + c * lx + s * lz, q.z - s * lx + c * lz];
        const [p0, p1] = [back(lx0, lz0), back(rx0, lz1)];
        b[0] = Math.min(p0[0], p1[0]); b[1] = Math.max(p0[0], p1[0]); b[2] = Math.min(p0[1], p1[1]); b[3] = Math.max(p0[1], p1[1]);
      }
      if (keep) out.push(b);
    }
    return out;
  };
  // (the windows cut out of the cells' boxes exactly: a box a window reaches split round it, up to six)
  let carved = 0;
  const carve = (list: number[][]): number[][] => {
    let out = list;
    for (const k of windowCuts) {
      const next: number[][] = [];
      for (const b of out) {
        if (b[1] <= k[0] || b[0] >= k[1] || b[3] <= k[2] || b[2] >= k[3] || b[5] <= k[4] || b[4] >= k[5]) {
          next.push(b);
          continue;
        }
        carved++;
        const [x0, x1, z0, z1] = [Math.max(b[0], k[0]), Math.min(b[1], k[1]), Math.max(b[2], k[2]), Math.min(b[3], k[3])];
        // (a sliver left at the cut's edge, a cell reaching a hair past it, is the wall's own spill: none thinner than
        // `sliver`, or a window's own width of plane stood half a metre behind it, as solid to a shot as glass)
        const S0 = WIN?.sliver ?? 0;
        if (k[0] - b[0] > S0) next.push([b[0], k[0], b[2], b[3], b[4], b[5]]);
        if (b[1] - k[1] > S0) next.push([k[1], b[1], b[2], b[3], b[4], b[5]]);
        if (k[2] - b[2] > S0) next.push([x0, x1, b[2], k[2], b[4], b[5]]);
        if (b[3] - k[3] > S0) next.push([x0, x1, k[3], b[3], b[4], b[5]]);
        if (b[4] < k[4]) next.push([x0, x1, z0, z1, b[4], k[4]]);
        if (b[5] > k[5]) next.push([x0, x1, z0, z1, k[5], b[5]]);
      }
      out = next;
    }
    return out;
  };
  const solids = [...cutBack(carve(coarse)), ...cutBack(carve(fine)), ...exactBoxes, ...windowBoxes];
  if (carved) console.log(`the windows cut out of ${carved} collision boxes`);
  if (trimmed) console.log(`${trimmed} collision boxes of the rest cut back out of the fire escapes' rooms`);
  const all = [...solids, ...solidBoxes];
  mkdirSync(join(ROOT, "src", "config", "neon"), { recursive: true });
  if (!TAG) writeFileSync(
    join(ROOT, "src", "config", "neon", "neonmap.solids.json"),
    JSON.stringify({ _note: "The collision of the Neon City map (src/config/neonmap.json), written by tools/import-neon.ts NEON=bake off the placed pieces' own triangles, never typed: boxes [x0, x1, z0, z1, y0, y1], map-local metres; `laid`, the street walls' boxes (rules.low.walls), each run of them [first, past the last] in `solids`.", version: cfg.version, laid: laid.map(([a, b]) => [a + solids.length, b + solids.length]), solids: all.map((q) => q.map((v) => +v.toFixed(2))) }) + "\n",
  );
  // the centre's curved streets (rules.streets.curves, tools/neon-streets.ts): their surface in the pack's asphalt over the
  // pavement tiles, traced from the same curves the layout laid their kerbs by. Mapped a tenth of the texture a metre,
  // as the ground's tiles are (their 10 m spans 0 to 1), so it matches the edge road's asphalt where the two meet
  {
    const CV = cfg.rules.streets.curves;
    const SF = new StreetField(streets(CV));
    const inside = CV.inside;
    const value = (x: number, z: number) => Math.max(SF.surface(x, z, CV.round), Math.max(Math.abs(x), Math.abs(z)) - inside);
    const { pos, idx } = fieldSurface(value, -inside, inside, -inside, inside, CV.surface.cell, CV.surface.y);
    const uv = new Float32Array((pos.length / 3) * 2);
    for (let k = 0; k < pos.length / 3; k++) [uv[k * 2], uv[k * 2 + 1]] = [pos[k * 3] / 10, pos[k * 3 + 2] / 10];
    const nrm = new Float32Array(pos.length);
    for (let k = 0; k < pos.length / 3; k++) nrm[k * 3 + 1] = 1;
    const matGuid = pack.matFor(cfg.rules.ground.road);
    if (!matGuid) throw new Error(`no material ${cfg.rules.ground.road}`);
    const model = { meshes: [{ name: "streets", prims: [{ pos: new Float32Array(pos), nrm, uv, idx: new Uint32Array(idx), material: cfg.rules.ground.road }] }], nodes: [], roots: [] } as unknown as Draw["model"];
    const d: Draw = { model, mesh: 0, pre: null, mats: [matGuid], modelGuid: "", on: true, go: null };
    (groups.get(groupOf("c-streets")) ?? groups.set(groupOf("c-streets"), []).get(groupOf("c-streets"))!).push({ d, m: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] });
    console.log(`streets: ${idx.length / 3} triangles of surface`);
  }
  // the jump pads, found in the collision just made (rules.pads), and the pack's plate and beam of light where each stands
  cfg.pads = findPads(all, cfg.rules);
  const padDraws: Array<{ d: Draw; m: M4 }> = [];
  // (a pad's beam `beamScale` of the pack's 92 m: at full height a dozen of them crowded the sky and the four block
  // beams, which say where you are, were lost among them; a third marks the pad from across the plaza)
  const shortBeam = (m: M4): M4 => mul([1, 0, 0, 0, 0, cfg.rules.pads.beamScale ?? 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], m);
  for (const q of cfg.pads) for (const key of [cfg.rules.pads.plate, cfg.rules.pads.beam]) padDraws.push(...draws(key).map(({ d, m }) => ({ d, m: mul(place(q.pad[0], q.floor, q.pad[1], 0), key === cfg.rules.pads.beam ? shortBeam(m) : m) })));
  // the centre's spine (rules.pads.spine), measured the same way: the plate under each and a beam over it, white up, red down
  cfg.spine = spinePads(all, cfg.rules);
  for (const [list, beam] of [[cfg.spine.up, cfg.rules.pads.spine.beam], [cfg.spine.down, cfg.rules.pads.spine.downBeam], [cfg.spine.across, cfg.rules.pads.spine.beam]] as const)
    for (const q of list as Array<{ pad: number[]; floor: number }>) for (const key of [cfg.rules.pads.plate, beam]) padDraws.push(...draws(key).map(({ d, m }) => ({ d, m: mul(place(q.pad[0], q.floor, q.pad[1], 0), key === beam ? shortBeam(m) : m) })));
  (groups.get(groupOf("c-pads")) ?? groups.set(groupOf("c-pads"), []).get(groupOf("c-pads"))!).push(...padDraws);
  for (const [id, all] of groups) {
    const b = bake(pack, res, `neon/${id}`, "", mats, all);
    if (b) baked.push(b);
    console.log(`${id}: ${b?.tris ?? 0} triangles`);
  }
  console.log(`pads: ${cfg.pads.map((q: { id: string; roof: number }) => `${q.id} to ${q.roof.toFixed(1)} m`).join(", ")}`);
  console.log(`the spine: ${cfg.spine.up.map((q: { id: string; floor: number; roof: number }) => `${q.id} ${q.floor} to ${q.roof} m`).join(", ")}; down ${cfg.spine.down.map((q: { id: string; floor: number; landY: number }) => `${q.id} ${q.floor} to ${q.landY} m`).join(", ")}; across ${cfg.spine.across.map((q: { id: string; floor: number; landY: number }) => `${q.id} ${q.floor} to ${q.landY} m`).join(", ")}`);
  const tris = baked.reduce((a, b) => a + b.tris, 0);
  console.log(`${placed} placements, ${tris} triangles, ${all.length} collision boxes (${solids.length} from rooms and props, ${solidBoxes.length} from solid buildings)`);
  const SIZES: Record<string, [number, number]> = { preview: [256, 128], lo: [512, 256], hi: [1024, 512], max: [2048, 1024] };
  const tex = new Textures(helpers);
  const pool = await BasisPool.start(PAID);
  tex.pool = pool;
  const outDir = join(helpers.out, "neon");
  const sizes: Record<string, number> = {};
  for (const s of (process.env.NEON_SIZES ?? "preview").split(",")) {
    const [size, normal] = SIZES[s];
    const file = join(outDir, `neonmap-v${cfg.version}-${s}${TAG}.glb`);
    const bytes = await writePack(helpers, pack, baked, mats, tex, size, normal, new Set(baked.map((b) => b.id)), file, true);
    sizes[s] = +(bytes / 1e6).toFixed(1);
    console.log(`${file}: ${(bytes / 1e6).toFixed(1)} MB`);
  }
  await pool.stop();
  cfg.baked = { triangles: tris, boxes: all.length, chunks: Object.fromEntries(baked.map((b) => [b.id.replace("neon/", ""), { tris: b.tris, min: b.min.map((v) => +v.toFixed(2)), max: b.max.map((v) => +v.toFixed(2)) }])), mb: { ...(cfg.baked?.mb ?? {}), ...sizes } };
  // only what the bake measured goes back, into the file as it is now: a bake takes minutes, and writing back the copy
  // read at its start threw away the game's sites, added to the file while one ran
  const now = JSON.parse(readFileSync(cfgFile, "utf8"));
  if (!TAG) writeFileSync(cfgFile, JSON.stringify({ ...now, baked: cfg.baked, pads: cfg.pads, spine: cfg.spine, windows: cfg.windows, ...(cfg.tower ? { tower: { ...now.tower, measured: cfg.tower.measured } } : {}), ...(cfg.well?.measured ? { well: { ...now.well, measured: cfg.well.measured } } : {}) }, null, 1) + "\n");
  console.log(`unresolved materials: ${IMPORT_STATS.unresolved.size}, unmatched meshes: ${IMPORT_STATS.unmatchedMeshes.size}`);
}

/**
 * The jump pads onto the high city's roofs (neonmap.json rules.pads), found in the collision: for each axis block, from
 * the middle of the street before it and of the ring road behind it, a body-wide line toward the block, tried every
 * metre `across` either side of the block's middle. The first column at least `roofMin` high within `search` metres is
 * the face; it is kept where the roof behind it is level to `flat` for `flatDepth` metres (the landing), past no more
 * than a `rail` within `edge` metres of the face, and the pad's own spot, `padStandOff` out, is clear to the sky but for what lies on the
 * ground. Of the kept, the nearest the street, then the block's middle, and `landBonus` metres nearer where a bot walks
 * `landArea` square metres of the roof from where it lands. Map-local: the face's point, the way out of it
 * (toward the pad), the pad's spot, the floor it stands on, the roof
 */
function findPads(boxes: number[][], rules: any): Array<{ id: string; face: number[]; out: number[]; pad: number[]; floor: number; roof: number }> {
  const P = rules.pads;
  // the boxes a 4 m cell, so a query looks at its neighbours only
  const G = 4;
  const grid = new Map<string, number[][]>();
  for (const b of boxes)
    for (let i = Math.floor(b[0] / G); i <= Math.floor(b[1] / G); i++)
      for (let j = Math.floor(b[2] / G); j <= Math.floor(b[3] / G); j++) {
        const k = `${i},${j}`;
        const l = grid.get(k);
        if (l) l.push(b);
        else grid.set(k, [b]);
      }
  /** the boxes overlapping the square of half `h` round (x, z) */
  const under = (x: number, z: number, h: number): number[][] => {
    const seen = new Set<number[]>();
    for (let i = Math.floor((x - h) / G); i <= Math.floor((x + h) / G); i++)
      for (let j = Math.floor((z - h) / G); j <= Math.floor((z + h) / G); j++)
        for (const b of grid.get(`${i},${j}`) ?? []) if (b[0] < x + h && b[1] > x - h && b[2] < z + h && b[3] > z - h) seen.add(b);
    return [...seen];
  };
  const top = (x: number, z: number, h: number): number => under(x, z, h).reduce((a, b) => Math.max(a, b[5]), 0);
  const stand = padStandOff();
  /** the roof a body walks from (x, z) at `y`, in square metres: 0.5 m cells whose tops step no more than a bot's step */
  const walkedArea = (x: number, z: number, y: number): number => {
    const C = 0.5;
    const seen = new Set<string>();
    const todo: Array<[number, number, number]> = [[Math.round(x / C), Math.round(z / C), y]];
    seen.add(`${todo[0][0]},${todo[0][1]}`);
    while (todo.length && seen.size * C * C < P.landArea) {
      const [i, j, h] = todo.pop()!;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${i + di},${j + dj}`;
        if (seen.has(k)) continue;
        const t = top((i + di) * C, (j + dj) * C, C / 2);
        if (Math.abs(t - h) > MOVE.stepHeight) continue;
        seen.add(k);
        todo.push([i + di, j + dj, t]);
      }
    }
    return seen.size * C * C;
  };
  const found: Array<{ id: string; face: number[]; out: number[]; pad: number[]; floor: number; roof: number }> = [];
  const inner = rules.pads.inner;
  const ring = (rules.ring[0] + rules.ring[1]) / 2;
  for (const dir of ["n", "s", "w", "e"]) {
    // toward the block: n is -z, s +z, w -x, e +x
    const sign = dir === "n" || dir === "w" ? -1 : 1;
    const alongX = dir === "n" || dir === "s";
    for (const [side, from, into] of [["in", sign * inner, sign], ["out", sign * ring, -sign]] as const) {
      let best: { score: number; q: (typeof found)[number] } | null = null;
      for (let u = -P.across; u <= P.across; u += 1) {
        const at = (t: number): [number, number] => (alongX ? [u, from + into * t] : [from + into * t, u]);
        let hit = -1;
        for (let t = 0; t <= P.search; t += 0.05) {
          const [x, z] = at(t);
          if (under(x, z, P.body).some((b) => b[5] >= P.roofMin && b[4] < 2)) {
            hit = t + P.body;
            break;
          }
        }
        if (hit < 0) continue;
        // the landing behind the face: level, but for a rail at its edge
        const tops: number[] = [];
        for (let k = 0.5; k <= P.flatDepth; k += 0.5) tops.push(top(...at(hit + k), P.body));
        const roof = tops.slice(-4).sort((a, b) => a - b)[1];
        if (tops.some((y) => y > roof + P.rail) || tops.slice(Math.round(P.edge / 0.5)).some((y) => Math.abs(y - roof) > P.flat)) continue;
        // the landing's roof walked by a body stepping no higher than a bot steps (a raised deck 0.85 m up is a wall
        // to a bot, which never jumps): the more of it the better, so a bot thrown up has somewhere to go
        const walk = walkedArea(...at(hit + 3), roof);
        // the pad's spot: nothing over it but what lies on the ground
        const [px, pz] = at(hit - stand);
        const floor = top(px, pz, 1.4);
        if (floor > 0.5) continue;
        const face = at(hit);
        const out = alongX ? [0, -into] : [-into, 0];
        const score = hit + 0.15 * Math.abs(u) - (walk >= P.landArea ? P.landBonus : 0);
        if (!best || score < best.score) best = { score, q: { id: `${dir}-${side}`, face: face.map((v) => +v.toFixed(2)), out, pad: [px, pz].map((v) => +v.toFixed(2)), floor: +floor.toFixed(2), roof: +roof.toFixed(2) } };
      }
      if (best) found.push(best.q);
      else console.log(`no pad for ${dir}-${side}`);
    }
  }
  return found;
}

/**
 * The centre's spine of pads (neonmap.json rules.pads.spine), measured in the collision. Each `up` pad: from `at` along
 * `to` (a unit step) to the first column `face` metres high or more, a body wide (`body`), the face it throws you over;
 * its spot `padStandOff` out of it, nothing over it but its `floor`; it lands you `land` metres past the face on what is
 * there, level for a body, and the roof it is solved for is the highest it crosses on
 * the way in, so the throw clears a rim before the landing. Each `down` pad: at `pad` on the roof it stands on, thrown
 * off onto `land`, `hop` metres up first (padsolve.ts padOff, for the heights measured), the throw swept at every hundredth
 * of a second with a standing body's room, so it clears the parapet it goes over and every face on the way down
 */
function spinePads(boxes: number[][], rules: any) {
  const SP = rules.pads.spine;
  const B = rules.pads.body;
  const top = (x: number, z: number, h: number) => boxes.reduce((a, b) => (b[0] < x + h && b[1] > x - h && b[2] < z + h && b[3] > z - h ? Math.max(a, b[5]) : a), 0);
  const level = (x: number, z: number, y: number) => [-0.5, 0, 0.5].every((dx) => [-0.5, 0, 0.5].every((dz) => Math.abs(top(x + dx, z + dz, 0.05) - y) < 0.3));
  const stand = padStandOff();
  const up = (SP.up as Array<{ id: string; at: number[]; to: number[]; floor: number; face: number; land: number }>).map((q) => {
    const at = (t: number): [number, number] => [q.at[0] + q.to[0] * t, q.at[1] + q.to[1] * t];
    let hit = -1;
    for (let t = 0; t < 30 && hit < 0; t += 0.05) if (top(...at(t), B) >= q.face) hit = t + B;
    if (hit < 0) throw new Error(`spine pad ${q.id}: no face ${q.face} m high within 30 m of (${q.at.join(", ")})`);
    const face = at(hit);
    const pad = at(hit - stand);
    const floor = top(...pad, 1.4);
    if (Math.abs(floor - q.floor) > 0.3) throw new Error(`spine pad ${q.id}: something ${floor.toFixed(2)} m high over its spot (${pad.map((v) => v.toFixed(1)).join(", ")}), not its floor ${q.floor}`);
    const L = q.land;
    const land = at(hit + L);
    const ground = top(...land, MOVE.radius);
    if (!level(...land, ground)) throw new Error(`spine pad ${q.id}: its landing at (${land.map((v) => v.toFixed(1)).join(", ")}) is not level`);
    let roof = ground;
    // (from the face in: a rail at the roof's edge is crossed too, 1.2 m round the base's roof)
    for (let t = hit; t <= hit + L; t += 0.25) roof = Math.max(roof, top(...at(t), MOVE.radius));
    return { id: q.id, face: face.map((v) => +v.toFixed(2)), out: [-q.to[0], -q.to[1]], pad: pad.map((v) => +v.toFixed(2)), floor: +floor.toFixed(2), roof: +roof.toFixed(2), land: L, ground: +ground.toFixed(2) };
  });
  // (a way down `hop` metres up off its roof; a pad across `over` metres over its mark at the top of its throw)
  const thrown = (q: { id: string; pad: number[]; land: number[]; hop?: number; over?: number }) => {
    const floor = top(q.pad[0], q.pad[1], 0.3);
    const landY = top(q.land[0], q.land[1], MOVE.radius);
    if (!level(q.land[0], q.land[1], landY)) throw new Error(`spine pad ${q.id}: its landing at (${q.land.join(", ")}) is not level`);
    const hop = q.hop ?? Math.max(0, landY - floor) + (q.over ?? 2.5);
    const T = padOff(q.pad[0], q.pad[1], floor, q.land[0], q.land[1], landY, hop);
    const r = MOVE.radius;
    for (let t = 0.01; t < T.t - 0.02; t += 0.01) {
      const [x, y, z] = [q.pad[0] + T.dx * t, floor + T.up * t - (MOVE.gravity * t * t) / 2, q.pad[1] + T.dz * t];
      const hit = boxes.find((b) => b[0] < x + r && b[1] > x - r && b[2] < z + r && b[3] > z - r && b[4] < y + MOVE.standHeight && b[5] > y + 0.02);
      if (hit) throw new Error(`spine pad ${q.id}: its throw meets [${hit.join(", ")}] ${t.toFixed(2)} s out, at (${[x, y, z].map((v) => v.toFixed(2)).join(", ")})`);
    }
    return { id: q.id, pad: q.pad, floor: +floor.toFixed(2), land: q.land, landY: +landY.toFixed(2), hop: +hop.toFixed(2) };
  };
  const down = (SP.down as Array<{ id: string; pad: number[]; land: number[]; hop: number }>).map(thrown);
  const across = ((SP.across ?? []) as Array<{ id: string; pad: number[]; land: number[]; over: number }>).map(thrown);
  return { up, down, across };
}

/** the middle of a part's bounds, placed by `m` (column-major) */
function partMiddle(d: Draw, m: M4): [number, number, number] {
  const [lo, hi] = partBounds(d, m);
  return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
}

/** a part's bounds, placed by `m` (column-major): its least and most corner */
function partBounds(d: Draw, m: M4): [number[], number[]] {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const q of d.model.meshes[d.mesh].prims)
    for (let k = 0; k < q.pos.length; k += 3)
      for (let a = 0; a < 3; a++) {
        const v = m[a] * q.pos[k] + m[4 + a] * q.pos[k + 1] + m[8 + a] * q.pos[k + 2] + m[12 + a];
        lo[a] = Math.min(lo[a], v);
        hi[a] = Math.max(hi[a], v);
      }
  return [lo, hi];
}

/**
 * A building with no rooms (a decorative one, High City's towers) as solid a cell at a time: each `cell` metres of its
 * footprint from its lowest triangle there to its highest, its hollow middle (cells no triangle crosses, enclosed by
 * ones that do) filled to the height of the nearest filled cell; so no one stands inside a shell or on air in it. Its
 * sticks (a cable, an antenna, a part whose middle size is under `stick`) fill nothing. And what its ground floor's walls
 * close in (the cells crossed below `shell.band` over its foot, their gaps up to twice `shell.close` shut) solid from its
 * foot: High City's towers are shells with nothing inside, their roof slab over a hollow the street reached through the
 * glass fronts' gaps, and filled only where no triangle crossed, a body walked in under the roof and stood inside the
 * shell. Boxes [x0, x1, z0, z1, y0, y1]
 */
function columnSolids(draws: Array<{ d: Draw; m: M4 }>, cell: number, stick: number, shell: { band: number; close: number }): number[][] {
  const key = (i: number, j: number) => `${i},${j}`;
  const span = new Map<string, [number, number]>();
  /** the cells its ground floor's walls cross */
  const walls = new Set<string>();
  type V = [number, number, number];
  const clip = (poly: V[], axis: 0 | 2, v: number, above: boolean): V[] => {
    const out: V[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const ina = above ? a[axis] >= v : a[axis] <= v;
      const inb = above ? b[axis] >= v : b[axis] <= v;
      if (ina) out.push(a);
      if (ina !== inb) {
        const t = (v - a[axis]) / (b[axis] - a[axis]);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
      }
    }
    return out;
  };
  // its foot: the lowest any part of it comes
  let foot = Infinity;
  for (const { d, m } of draws) for (const p of d.model.meshes[d.mesh]?.prims ?? []) for (let k = 0; k < p.pos.length; k += 3) foot = Math.min(foot, m[1] * p.pos[k] + m[5] * p.pos[k + 1] + m[9] * p.pos[k + 2] + m[13]);
  for (const { d, m } of draws) {
    const mesh = d.model.meshes[d.mesh];
    if (!mesh) continue;
    const w = (x: number, y: number, z: number): V => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    const pts = mesh.prims.map((p) => {
      const out: V[] = [];
      for (let k = 0; k < p.pos.length; k += 3) {
        const q = w(p.pos[k], p.pos[k + 1], p.pos[k + 2]);
        out.push(q);
        for (let a = 0; a < 3; a++) {
          lo[a] = Math.min(lo[a], q[a]);
          hi[a] = Math.max(hi[a], q[a]);
        }
      }
      return out;
    });
    const size = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]].sort((p, q) => p - q);
    if (size[1] < stick) continue;
    mesh.prims.forEach((p, pi) => {
      const list = pts[pi];
      for (let t = 0; t + 2 < p.idx.length; t += 3) {
        const tri: V[] = [list[p.idx[t]], list[p.idx[t + 1]], list[p.idx[t + 2]]];
        const x0 = Math.min(tri[0][0], tri[1][0], tri[2][0]);
        const x1 = Math.max(tri[0][0], tri[1][0], tri[2][0]);
        const z0 = Math.min(tri[0][2], tri[1][2], tri[2][2]);
        const z1 = Math.max(tri[0][2], tri[1][2], tri[2][2]);
        for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++)
          for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) {
            let poly = clip(tri, 0, i * cell, true);
            if (poly.length) poly = clip(poly, 0, (i + 1) * cell, false);
            if (poly.length) poly = clip(poly, 2, j * cell, true);
            if (poly.length) poly = clip(poly, 2, (j + 1) * cell, false);
            if (!poly.length) continue;
            let y0 = Infinity;
            let y1 = -Infinity;
            for (const q of poly) {
              y0 = Math.min(y0, q[1]);
              y1 = Math.max(y1, q[1]);
            }
            const k = key(i, j);
            const s = span.get(k);
            span.set(k, s ? [Math.min(s[0], y0), Math.max(s[1], y1)] : [y0, y1]);
            if (y0 < foot + shell.band) walls.add(k);
          }
      }
    });
  }
  if (!span.size) return [];
  // the hollow middle: cells of the footprint's box no triangle crosses, not joined to the box's edge through others
  const cells = [...span.keys()].map((k) => k.split(",").map(Number));
  const i0 = Math.min(...cells.map((c) => c[0])) - 1;
  const i1 = Math.max(...cells.map((c) => c[0])) + 1;
  const j0 = Math.min(...cells.map((c) => c[1])) - 1;
  const j1 = Math.max(...cells.map((c) => c[1])) + 1;
  const outside = new Set<string>([key(i0, j0)]);
  const todo: Array<[number, number]> = [[i0, j0]];
  while (todo.length) {
    const [i, j] = todo.pop()!;
    for (const [a, b] of [
      [i + 1, j],
      [i - 1, j],
      [i, j + 1],
      [i, j - 1],
    ]) {
      if (a < i0 || a > i1 || b < j0 || b > j1) continue;
      const k = key(a, b);
      if (outside.has(k) || span.has(k)) continue;
      outside.add(k);
      todo.push([a, b]);
    }
  }
  const left = new Set<string>();
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (!span.has(key(i, j)) && !outside.has(key(i, j))) left.add(key(i, j));
  // what the ground floor's walls close in: the walls grown by `close` (a gap of twice that shut), the outside flooded
  // up to them and grown back by as much, and the rest, the walls and all they ring, solid from the foot
  const r = Math.round(shell.close / cell);
  const grown = new Set<string>();
  for (const k of walls) {
    const [i, j] = k.split(",").map(Number);
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) if (a * a + b * b <= r * r) grown.add(key(i + a, j + b));
  }
  const I0 = i0 - r - 1, I1 = i1 + r + 1, J0 = j0 - r - 1, J1 = j1 + r + 1;
  const far = new Set<string>([key(I0, J0)]);
  const flood: Array<[number, number]> = [[I0, J0]];
  while (flood.length) {
    const [i, j] = flood.pop()!;
    for (const [a, b] of [
      [i + 1, j],
      [i - 1, j],
      [i, j + 1],
      [i, j - 1],
    ]) {
      if (a < I0 || a > I1 || b < J0 || b > J1) continue;
      const k = key(a, b);
      if (far.has(k) || grown.has(k)) continue;
      far.add(k);
      flood.push([a, b]);
    }
  }
  const open = new Set<string>(far);
  for (const k of far) {
    const [i, j] = k.split(",").map(Number);
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) if (a * a + b * b <= r * r) open.add(key(i + a, j + b));
  }
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++) {
      const k = key(i, j);
      if (open.has(k) || walls.has(k)) continue;
      const s = span.get(k);
      if (s) s[0] = foot;
      else if (!left.has(k)) left.add(k);
    }
  // filled from the nearest filled cells, a ring at a time
  const around = (i: number, j: number) => [
    [i + 1, j],
    [i - 1, j],
    [i, j + 1],
    [i, j - 1],
  ];
  let front = [...left].map((k) => k.split(",").map(Number)).filter(([i, j]) => around(i, j).some(([a, b]) => span.has(key(a, b))));
  while (front.length) {
    const next: number[][] = [];
    const fills: Array<[string, [number, number]]> = [];
    for (const [i, j] of front) {
      const k = key(i, j);
      if (!left.has(k)) continue;
      const n = around(i, j)
        .map(([a, b]) => span.get(key(a, b)))
        .filter((q): q is [number, number] => !!q);
      if (!n.length) continue;
      fills.push([k, [open.has(k) ? Math.min(...n.map((q) => q[0])) : foot, Math.max(...n.map((q) => q[1]))]]);
    }
    for (const [k, s] of fills) {
      span.set(k, s);
      left.delete(k);
    }
    for (const [k] of fills) {
      const [i, j] = k.split(",").map(Number);
      for (const [a, b] of around(i, j)) if (left.has(key(a, b))) next.push([a, b]);
    }
    front = next;
  }
  // cells of one span into rectangles, greedily
  const groups = new Map<string, Set<string>>();
  for (const [k, [y0, y1]] of span) {
    const g = `${(Math.round(y0 * 20) / 20).toFixed(2)},${(Math.round(y1 * 20) / 20).toFixed(2)}`;
    (groups.get(g) ?? groups.set(g, new Set()).get(g)!).add(k);
  }
  const out: number[][] = [];
  for (const [g, set] of groups) {
    const [y0, y1] = g.split(",").map(Number);
    const list = [...set].map((k) => k.split(",").map(Number)).sort((p, q) => p[1] - q[1] || p[0] - q[0]);
    for (const [i, j] of list) {
      if (!set.has(key(i, j))) continue;
      let ie = i;
      while (set.has(key(ie + 1, j))) ie++;
      let je = j;
      for (;;) {
        let row = true;
        for (let a = i; a <= ie && row; a++) if (!set.has(key(a, je + 1))) row = false;
        if (!row) break;
        je++;
      }
      for (let a = i; a <= ie; a++) for (let b = j; b <= je; b++) set.delete(key(a, b));
      out.push([i * cell, (ie + 1) * cell, j * cell, (je + 1) * cell, y0, y1]);
    }
  }
  return out;
}
