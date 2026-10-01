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
import { padStandOff } from "../src/game/padsolve";
import { streets, StreetField, fieldSurface, ringSlab, type Pt } from "./neon-streets";
import { inside, sdPoly, standing, storeySlab, type Grid } from "./neon-base";
import { backFaces, coplanar, cutOut, escapes, settle, stairCore, type Box3 } from "./neon-tower";
import { wellFlight, type Flight } from "./neon-well";
import { MOVE } from "../src/game/movement";
import { bake, districtSolids, IMPORT_STATS, Models, mul, Pack, Resolver, Textures, writePack, type Baked, type CityImportHelpers, type Draw, type M4 } from "./import-city";
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
  const solidBoxes: number[][] = [];
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
  // (each placed draw's chunk, for naming what the bake's measures find)
  const chunkOf = new WeakMap<object, string>();
  for (const [id, chunk] of Object.entries<{ sector: string; place: Array<[string, number, number, number, number, string, (string | null)?, string[]?]> }>(cfg.chunks)) {
    const all = groups.get(groupOf(id)) ?? groups.set(groupOf(id), []).get(groupOf(id))!;
    for (const [key, x, y, z, yaw, how, mat, without] of chunk.place) {
      const W = place(x, y, z, yaw);
      const matGuid = mat ? pack.matFor(mat) : null;
      if (mat && !matGuid) throw new Error(`no material ${mat}`);
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
      const mine = shaped.map(({ d, m }) => ({ d: matGuid ? { ...d, mats: d.model.meshes[d.mesh].prims.map(() => matGuid) } : d, m: mul(W, m) }));
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
      for (const q of mine) chunkOf.set(q, id);
      all.push(...mine);
      if (baseMask.has(id)) standingDraws.push(...mine);
      // (and the pieces closing its shell's slits: the partitions and cover inside are left out, so a gap is not hidden)
      if (id === "c-middle" || (id === "c-tower" && cfg.rules.tower?.slots && key.endsWith(`/${cfg.rules.tower.slots.piece}`))) towerDrawn.push(...mine);
      if (how === "o") ((cfg.rules.fine.pieces as string[]).some((f) => key.endsWith(`/${f}`)) ? openFine : open).push(...mine);
      else if (how === "s") solidBoxes.push(...columnSolids(mine, C.cell, C.stick, cfg.rules.shell));
      placed++;
    }
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
        const mg = pack.matFor(p.material);
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
    // (the tower as drawn and the core's walls, triangle by triangle on the map, for the seal's rays)
    const drawnTris: Array<[number[], number[], number[]]> = [];
    for (const { d, m } of towerDrawn)
      for (const q of d.model.meshes[d.mesh].prims) {
        const V = (i: number) => [0, 1, 2].map((a) => m[a] * q.pos[i * 3] + m[4 + a] * q.pos[i * 3 + 1] + m[8 + a] * q.pos[i * 3 + 2] + m[12 + a]);
        for (let k = 0; k + 2 < q.idx.length; k += 3) drawnTris.push([V(q.idx[k]), V(q.idx[k + 1]), V(q.idx[k + 2])]);
      }
    for (let k = 0; k + 2 < core.walls.idx.length; k += 3) drawnTris.push([0, 1, 2].map((j) => core.walls.pos.slice(core.walls.idx[k + j] * 3, core.walls.idx[k + j] * 3 + 3)) as [number[], number[], number[]]);
    const seal: Array<{ at: number; rays: number; out: number[][] }> = [];
    for (const h of TW.shaft as number[]) {
      // (what stands on this floor, from just over it: the glass round the storey under 14 m tops out at 13.5)
      const stood = standing(g, towerTris(), h + 0.05, h + 2);
      const inn = inside(g, stood, TW.seed, TW.close, TW.reach);
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
      seal.push({ at: h, rays: e.rays, out: e.out.slice(0, 12) });
      tri += push(`tower-${h}`, (["top", "edge", "under"] as const).map((k) => ({ part: parts[k], mat: TW.mats[k] })));
    }
    // (the main body is 22.5 by 20.5 m outside its shell: a floor much bigger got out through a gap in it)
    if (areas.some((a) => a > (sx1 - sx0) * (sz1 - sz0))) throw new Error(`a tower floor came out bigger than the tower: ${areas.map((a) => a.toFixed(0)).join(", ")} m2`);
    cfg.tower.measured = { floors: areas.map((a) => +a.toFixed(1)), seal: seal.map((q) => ({ at: q.at, rays: q.rays, out: q.out.length, where: q.out })) };
    console.log(`the tower's floors sealed: ${seal.map((q) => `${q.at} m ${q.out.length} of ${q.rays} rays out`).join("; ")}`);
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
    console.log(`drawn face up over another in the same plane: ${named.length ? named.slice(0, 10).map((q) => `${q.m2} m2 at ${q.y} m in ${q.patches}, most at (${q.at.join(", ")}), ${q.mats.join(" over ")}`).join("; ") : "none"}`);
  }
  // the rooms, stairs and what stands in the open: their own spans, as a district's are (no fill: these pieces are whole)
  // (below the street kept: the tallest building stands in a pit to its basement, 7 m down, whose floors the districts'
  // street-scrap rule, nothing topping out under 0.35 m, threw away; rules.below)
  const { solids: coarse } = districtSolids(open, { cell: C.cell, stick: C.stick, floor: cfg.rules.below.floor, merge: C.merge, thin: C.thin, minTop: cfg.rules.below.minTop });
  const { solids: fine } = openFine.length ? districtSolids(openFine, { cell: cfg.rules.fine.cell, stick: C.stick, floor: cfg.rules.below.floor, merge: C.merge, thin: C.thin, minTop: cfg.rules.below.minTop }) : { solids: [] };
  const solids = [...coarse, ...fine];
  const all = [...solids, ...solidBoxes];
  mkdirSync(join(ROOT, "src", "config", "neon"), { recursive: true });
  if (!TAG) writeFileSync(
    join(ROOT, "src", "config", "neon", "neonmap.solids.json"),
    JSON.stringify({ _note: "The collision of the Neon City map (src/config/neonmap.json), written by tools/import-neon.ts NEON=bake off the placed pieces' own triangles, never typed: boxes [x0, x1, z0, z1, y0, y1], map-local metres.", version: cfg.version, solids: all.map((q) => q.map((v) => +v.toFixed(2))) }) + "\n",
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
  for (const q of cfg.pads) for (const key of [cfg.rules.pads.plate, cfg.rules.pads.beam]) padDraws.push(...draws(key).map(({ d, m }) => ({ d, m: mul(place(q.pad[0], q.floor, q.pad[1], 0), m) })));
  (groups.get(groupOf("c-pads")) ?? groups.set(groupOf("c-pads"), []).get(groupOf("c-pads"))!).push(...padDraws);
  for (const [id, all] of groups) {
    const b = bake(pack, res, `neon/${id}`, "", mats, all);
    if (b) baked.push(b);
    console.log(`${id}: ${b?.tris ?? 0} triangles`);
  }
  console.log(`pads: ${cfg.pads.map((q: { id: string; roof: number }) => `${q.id} to ${q.roof.toFixed(1)} m`).join(", ")}`);
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
  if (!TAG) writeFileSync(cfgFile, JSON.stringify({ ...now, baked: cfg.baked, pads: cfg.pads, ...(cfg.tower ? { tower: { ...now.tower, measured: cfg.tower.measured } } : {}) }, null, 1) + "\n");
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
