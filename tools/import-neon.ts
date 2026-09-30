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
  for (const [id, chunk] of Object.entries<{ sector: string; place: Array<[string, number, number, number, number, string, (string | null)?, string[]?]> }>(cfg.chunks)) {
    const all = groups.get(groupOf(id)) ?? groups.set(groupOf(id), []).get(groupOf(id))!;
    for (const [key, x, y, z, yaw, how, mat, without] of chunk.place) {
      const W = place(x, y, z, yaw);
      const matGuid = mat ? pack.matFor(mat) : null;
      if (mat && !matGuid) throw new Error(`no material ${mat}`);
      // (a placement may leave named parts of its prefab out: neonmap.json's rules say which and why)
      // An entry is a model's file name (every part drawn from it) or "name@x,y,z", the one part of it whose middle is
      // within half a metre of there in the prefab's own metres (the pack's plain walls are one model in many places)
      const leftOut = (w: string, d: Draw, m: M4): boolean => {
        const [name, at] = w.split("@");
        if (basename(pack.guidPath.get(d.modelGuid) ?? "") !== name) return false;
        if (!at) return true;
        const mid = partMiddle(d, m);
        return at.split(",").map(Number).every((v, i) => Math.abs(v - mid[i]) < 0.5);
      };
      const kept = without ? draws(key).filter(({ d, m }) => !without.some((w) => leftOut(w, d, m))) : draws(key);
      for (const w of without ?? []) if (!draws(key).some(({ d, m }) => leftOut(w, d, m))) throw new Error(`${key}: no ${w} to leave out`);
      const mine = kept.map(({ d, m }) => ({ d: matGuid ? { ...d, mats: d.model.meshes[d.mesh].prims.map(() => matGuid) } : d, m: mul(W, m) }));
      all.push(...mine);
      if (how === "o") ((cfg.rules.fine.pieces as string[]).some((f) => key.endsWith(`/${f}`)) ? openFine : open).push(...mine);
      else if (how === "s") solidBoxes.push(...columnSolids(mine, C.cell, C.stick, cfg.rules.shell));
      placed++;
    }
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
  if (!TAG) writeFileSync(cfgFile, JSON.stringify({ ...now, baked: cfg.baked, pads: cfg.pads }, null, 1) + "\n");
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
  const inner = rules.streets.centres[1];
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
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const q of d.model.meshes[d.mesh].prims)
    for (let k = 0; k < q.pos.length; k += 3)
      for (let a = 0; a < 3; a++) {
        const v = m[a] * q.pos[k] + m[4 + a] * q.pos[k + 1] + m[8 + a] * q.pos[k + 2] + m[12 + a];
        lo[a] = Math.min(lo[a], v);
        hi[a] = Math.max(hi[a], v);
      }
  return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
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
