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
import { bake, IMPORT_STATS, Models, Pack, Resolver, Textures, writePack, type Baked, type CityImportHelpers } from "./import-city";
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
