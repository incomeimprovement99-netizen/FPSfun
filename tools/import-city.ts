// The bought Unity packs made into what the game draws: the machinery tools/import-neon.ts (the Neon City) and
// tools/tutorial-dress.ts build on. A pack's real pieces are its prefabs, each assembling several meshes from its FBX
// files, so a prefab is rebuilt from its Unity YAML and baked: its finest level of detail, merged by material, in the
// prefab's own space, written into a GLB with its textures inside it (writePack). It began as the ILranch city's import
// (docs/CITY_BUNDLE_IMPLEMENTATION.md section 7); that city went on 2026-10-09 and its own import (citykit.json,
// citydistricts.json, the demo streets cut into buildings and facades) in Milestone 663.
//
// The rules below were each found by rebuilding the packs' demo scenes and looking at them
// (the plan's section 7): leave any one out and the pieces come out wrong.
// - 3ds Max leaves a 100x scale on the group above each mesh, and Unity bakes that group's turn
//   and scale into the mesh on import, where the glTF keeps them on the nodes: bake the node chain.
// - A prefab holds its LOD1 beside its LOD0 and Unity shows one at a time: take LOD0.
// - Unity is left-handed: mirror X on positions, take (x, -y, -z, w) for rotations.
// - Newer Unity hashes a model's mesh IDs and lists none in the .meta: the prefab's object name is
//   the mesh name. Nested fileIDs are 64-bit and combine by XOR, so they are BigInts here.
// - A prefab that places a model sets its renderer's materials by override, naming the renderer by an ID
//   newer Unity hashes and this cannot compute: the override goes to the model's only mesh, or to the one
//   whose material slots number what it sets. Dropped, High City's wall rows came out untextured grey.
//
// Only local tools touch the files, and nothing here uploads them anywhere.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import sharp from "sharp";
import YAML from "yaml";
import { initializeCanvas, readPsd } from "ag-psd";
import { BasisPool, type BasisKind } from "./basis-pool";

/** what the import could not place, reported at its end */
export const IMPORT_STATS = { unplacedOverrides: 0, unresolved: new Map<string, number>(), unreadable: new Map<string, number>(), unmatchedMeshes: new Map<string, number>() };

export interface CityImportHelpers {
  root: string;
  paid: string;
  out: string;
  unpack(pkg: string, name: string): Map<string, string>;
  readTga(file: string): { data: Buffer; width: number; height: number; channels: 3 | 4 };
  fbx2gltf(): string;
}

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type M4 = number[];

const MASK = 0x7fffffffffffffffn;
const ROOT_T = -8679921383154817045n; // a model prefab's root Transform
const ROOT_G = 919132149155446097n; // a model prefab's root GameObject
const LOD_N = /lod\s*_?[1-9]/i;
const I4: M4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const num = (v: unknown, d = 0): number => (v === undefined || v === null ? d : typeof v === "bigint" ? Number(v) : Number(v));
const big = (v: unknown): bigint | null => (v === undefined || v === null ? null : typeof v === "bigint" ? v : BigInt(Math.trunc(Number(v))));

export function trs(t: Vec3, q: Quat, s: Vec3): M4 {
  const [x, y, z, w] = q;
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [
    (1 - 2 * (yy + zz)) * s[0], 2 * (xy + wz) * s[0], 2 * (xz - wy) * s[0], 0,
    2 * (xy - wz) * s[1], (1 - 2 * (xx + zz)) * s[1], 2 * (yz + wx) * s[1], 0,
    2 * (xz + wy) * s[2], 2 * (yz - wx) * s[2], (1 - 2 * (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}
export function mul(a: M4, b: M4): M4 {
  const o = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
/** the inverse transpose of a matrix's 3x3, for normals, and its determinant (a mirror flips winding) */
function normalMat(m: M4): { n: number[]; det: number } {
  const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], i = m[10];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C || 1e-12;
  // inverse transpose = cofactor matrix / det, laid out so n * [x,y,z] multiplies rows
  const n = [A, B, C, -(b * i - c * h), a * i - c * g, -(a * h - b * g), b * f - c * e, -(a * f - c * d), a * e - b * d].map((v) => v / det);
  return { n, det };
}
const srgbToLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

// ---------------------------------------------------------------- Unity's IDs for a model's own objects
// Newer Unity names a model's objects (its meshes, its renderers, their GameObjects) by a hash, not a table in the
// .meta: the file ID of the index-th object of a class with a name is xxHash64 of "Type:<class>-><name><index>" (UTF-8,
// seed 0), read as a signed number, for a Mesh. Found against Kyber's prefabs, which reference a model's meshes by it
// ("metro tonnel tile.prefab": Shape021's mesh is 2009449214765265626); by name alone a renderer called "Box06056 (1)"
// found no mesh and drew nothing (Kyber's ladders). A model's GameObjects and renderers are hashed some other way, not
// yet known (tried: the same with their names, paths from the model's root, other class names), so a prefab's
// material overrides on a model of several meshes are still matched by their slots and names.
const U64 = (1n << 64n) - 1n;
const XP1 = 11400714785074694791n, XP2 = 14029467366897019727n, XP3 = 1609587929392839161n, XP4 = 9650029242287828579n, XP5 = 2870177450012600261n;
const xrot = (x: bigint, k: number): bigint => ((x << BigInt(k)) | (x >> BigInt(64 - k))) & U64;
const xmul = (a: bigint, b: bigint): bigint => (a * b) & U64;
const xround = (acc: bigint, v: bigint): bigint => xmul(xrot((acc + xmul(v, XP2)) & U64, 31), XP1);
const xmerge = (acc: bigint, v: bigint): bigint => (xmul(acc ^ xround(0n, v), XP1) + XP4) & U64;
function xxh64(bytes: Uint8Array): bigint {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = bytes.length;
  let p = 0;
  let h: bigint;
  if (len >= 32) {
    let v1 = (XP1 + XP2) & U64, v2 = XP2, v3 = 0n, v4 = (0n - XP1) & U64;
    for (; p + 32 <= len; p += 32) {
      v1 = xround(v1, dv.getBigUint64(p, true));
      v2 = xround(v2, dv.getBigUint64(p + 8, true));
      v3 = xround(v3, dv.getBigUint64(p + 16, true));
      v4 = xround(v4, dv.getBigUint64(p + 24, true));
    }
    h = (xrot(v1, 1) + xrot(v2, 7) + xrot(v3, 12) + xrot(v4, 18)) & U64;
    h = xmerge(xmerge(xmerge(xmerge(h, v1), v2), v3), v4);
  } else h = XP5;
  h = (h + BigInt(len)) & U64;
  for (; p + 8 <= len; p += 8) {
    h ^= xround(0n, dv.getBigUint64(p, true));
    h = (xmul(xrot(h, 27), XP1) + XP4) & U64;
  }
  if (p + 4 <= len) {
    h ^= xmul(BigInt(dv.getUint32(p, true)), XP1);
    h = (xmul(xrot(h, 23), XP2) + XP3) & U64;
    p += 4;
  }
  for (; p < len; p++) {
    h ^= xmul(BigInt(bytes[p]), XP5);
    h = xmul(xrot(h, 11), XP1);
  }
  h ^= h >> 33n;
  h = xmul(h, XP2);
  h ^= h >> 29n;
  h = xmul(h, XP3);
  h ^= h >> 32n;
  return h;
}
const unityId = (cls: string, name: string, index: number): bigint => {
  const h = xxh64(new Uint8Array(Buffer.from(`Type:${cls}->${name}${index}`, "utf8")));
  return h >= 1n << 63n ? h - (1n << 64n) : h;
};

// ---------------------------------------------------------------- a pack's Unity side
export class Pack {
  readonly guidPath = new Map<string, string>();
  readonly pathFile = new Map<string, string>();
  private parsed = new Map<string, Map<bigint, { cls: number; stripped: boolean; data: any }>>();
  private metaNames = new Map<string, Map<bigint, string>>();
  readonly matByName = new Map<string, string>();
  /** the same, by the name with its spaces and punctuation gone: an FBX's "detz2" is the pack's "detz 2.mat" */
  readonly matByNorm = new Map<string, string>();
  /** a material by an FBX's own name for it: exact, else with spaces and punctuation ignored */
  matFor(name: string): string | null {
    return this.matByName.get(name.toLowerCase()) ?? this.matByNorm.get(name.toLowerCase().replace(/[^a-z0-9]/g, "")) ?? null;
  }
  private byTexture = new Map<string, string | null>();
  /**
   * Unity's "By Base Texture Name" (an FBX importer's materialName: 0): the model wears the pack's material named after
   * the texture its FBX material uses, found the way Unity does, by name. The textures' names are read straight out of
   * the FBX's bytes, the first that names a material of the pack taken. High City's "fill build 08" calls for "Material
   * #3020", whose texture is "fill build 1.psd", so it wears "fill build 1.mat"; without this its backdrop building came
   * out a plain grey slab in the gaps between the corner district's faces.
   */
  matByTexture(modelGuid: string): string | null {
    if (this.byTexture.has(modelGuid)) return this.byTexture.get(modelGuid)!;
    let found: string | null = null;
    const f = this.file(modelGuid);
    const meta = f ? join(dirname(f), "asset.meta") : "";
    if (f && existsSync(f) && existsSync(meta) && /materialName:\s*0\b/.test(readFileSync(meta, "utf8"))) {
      for (const m of readFileSync(f).toString("latin1").matchAll(/([A-Za-z0-9 _#-][A-Za-z0-9 _#.-]{0,79})\.(psd|png|tga|jpe?g|tiff?)\b/gi)) {
        found = this.matFor(m[1].trim());
        if (found) break;
      }
    }
    this.byTexture.set(modelGuid, found);
    return found;
  }

  /**
   * Whether the models' import scale (Unity's Scale Factor, `globalScale` in an FBX's .meta) is applied: Unity bakes it
   * into the mesh and its node positions. ILranch's packs all import at 1; Daelonik's Neon City imports most of its shared
   * models at 10 (and some at 0.1, 8 or 200), and without it their parts came out a tenth their size, the buildings a
   * cloud of specks (Phase 28.1)
   */
  unityScale = false;
  constructor(readonly name: string, files: Map<string, string>) {
    for (const [p, f] of files) {
      const guid = basename(dirname(f));
      this.guidPath.set(guid, p);
      this.pathFile.set(p, f);
      if (p.toLowerCase().endsWith(".mat")) {
        this.matByName.set(basename(p, extname(p)).toLowerCase(), guid);
        this.matByNorm.set(basename(p, extname(p)).toLowerCase().replace(/[^a-z0-9]/g, ""), guid);
      }
    }
  }
  file(guid: string): string | undefined {
    const p = this.guidPath.get(guid);
    return p ? this.pathFile.get(p) : undefined;
  }
  parse(guid: string): Map<bigint, { cls: number; stripped: boolean; data: any }> {
    const hit = this.parsed.get(guid);
    if (hit) return hit;
    const objs = new Map<bigint, { cls: number; stripped: boolean; data: any }>();
    const f = this.file(guid);
    if (f && existsSync(f)) {
      const text = readFileSync(f, "utf8");
      // split keeps the captured header fields: [before, cls, fileID, stripped, body, cls, ...]
      const parts = text.split(/^--- !u!(\d+) &(-?\d+)( stripped)?[^\n]*$/m);
      for (let i = 1; i + 3 < parts.length + 1; i += 4) {
        let d: any;
        try {
          d = YAML.parse(parts[i + 3] ?? "", { intAsBigInt: true, uniqueKeys: false, strict: false, logLevel: "silent" });
        } catch {
          continue;
        }
        if (!d || typeof d !== "object") continue;
        const k = Object.keys(d)[0];
        objs.set(BigInt(parts[i + 1]), { cls: +parts[i], stripped: !!parts[i + 2], data: d[k] ?? {} });
      }
    }
    this.parsed.set(guid, objs);
    return objs;
  }
  /** a model's mesh names by fileID, where its .meta lists them (older imports) */
  meshNames(guid: string): Map<bigint, string> {
    const hit = this.metaNames.get(guid);
    if (hit) return hit;
    const out = new Map<bigint, string>();
    const f = this.file(guid);
    if (f && existsSync(f + ".meta")) {
      const t = readFileSync(f + ".meta", "utf8");
      for (const m of t.matchAll(/- first:\s*\n\s+43: (-?\d+)\s*\n\s+second: ([^\n]+)/g)) out.set(BigInt(m[1]), m[2].trim());
      for (const m of t.matchAll(/^\s+(43\d{5}): ([^\n]+)$/gm)) out.set(BigInt(m[1]), m[2].trim());
    }
    this.metaNames.set(guid, out);
    return out;
  }
  /** a model's own material remap in its .meta: FBX material name to .mat guid */
  materialRemap(guid: string): Map<string, string> {
    const out = new Map<string, string>();
    const f = this.file(guid);
    if (f && existsSync(f + ".meta")) {
      const t = readFileSync(f + ".meta", "utf8");
      for (const m of t.matchAll(/type: UnityEngine:Material\s*\n\s+assembly: [^\n]*\n\s+name: ([^\n]+)\n\s+second: \{fileID: \d+, guid: ([0-9a-f]+)/g)) out.set(m[1].trim(), m[2]);
    }
    return out;
  }
}

// ---------------------------------------------------------------- the models, as glTF
export interface RawPrim { pos: Float32Array; nrm: Float32Array | null; uv: Float32Array | null; idx: Uint32Array; material: string }
export interface RawModel { meshes: Array<{ name: string; prims: RawPrim[] }>; nodes: Array<{ name: string; mesh: number | null; t: Vec3; r: Quat; s: Vec3; kids: number[]; parent: number | null }>; roots: number[] }

export class Models {
  private cache = new Map<string, RawModel | null>();
  constructor(private h: CityImportHelpers, private dir: string) {
    mkdirSync(dir, { recursive: true });
  }
  get(pack: Pack, guid: string): RawModel | null {
    const key = pack.name + "/" + guid;
    if (this.cache.has(key)) return this.cache.get(key)!;
    const src = pack.file(guid);
    const p = pack.guidPath.get(guid) ?? "";
    let model: RawModel | null = null;
    // (the pack's basic floors and walls are ProBuilder's OBJ exports: read as they are, their faces keeping their materials)
    if (src && /\.obj$/i.test(p)) model = readObj(readFileSync(src, "utf8"));
    else if (src && /\.fbx$/i.test(p)) {
      const out = join(this.dir, pack.name, guid);
      mkdirSync(dirname(out), { recursive: true });
      if (!existsSync(out + ".glb")) {
        const tmp = out + ".fbx";
        writeFileSync(tmp, readFileSync(src));
        try {
          execFileSync(this.h.fbx2gltf(), ["-b", "--pbr-metallic-roughness", "-i", tmp, "-o", out], { stdio: "ignore" });
        } catch {
          /* a model FBX2glTF cannot read is left out, and the pieces that need it say so */
        }
      }
      if (existsSync(out + ".glb")) model = readGlb(out + ".glb");
      if (model && pack.unityScale && existsSync(src + ".meta")) {
        const gs = Number(/globalScale: ([-\d.e]+)/.exec(readFileSync(src + ".meta", "utf8"))?.[1] ?? 1);
        if (gs !== 1 && Number.isFinite(gs)) {
          for (const m of model.meshes) for (const q of m.prims) for (let k = 0; k < q.pos.length; k++) q.pos[k] *= gs;
          for (const n of model.nodes) n.t = n.t.map((v) => v * gs) as Vec3;
        }
      }
    }
    this.cache.set(key, model);
    return model;
  }
}

/**
 * An OBJ's geometry, as FBX2glTF would have written it: each object a mesh (a node of its own at the origin), its faces
 * split by material and fanned into triangles, V flipped to glTF's. Its coordinates are taken as they are: ProBuilder
 * writes them right-handed (x flipped from Unity's) and Unity flips them back on import, the same round trip an FBX
 * makes, so they are already in the frame the FBX models are read in. (FBX2glTF reads an OBJ too, but as centimetres,
 * and with every face in one material.)
 */
function readObj(text: string): RawModel {
  const v: number[][] = [];
  const vt: number[][] = [];
  const vn: number[][] = [];
  const meshes: RawModel["meshes"] = [];
  type Part = { pos: number[]; nrm: number[]; uv: number[]; idx: number[]; seen: Map<string, number> };
  let mesh: { name: string; byMat: Map<string, Part> } | null = null;
  let mat = "";
  const flush = () => {
    if (!mesh) return;
    const prims = [...mesh.byMat].filter(([, q]) => q.idx.length).map(([m, q]): RawPrim => ({ pos: Float32Array.from(q.pos), nrm: Float32Array.from(q.nrm), uv: Float32Array.from(q.uv), idx: Uint32Array.from(q.idx), material: m }));
    if (prims.length) meshes.push({ name: mesh.name, prims });
  };
  const start = (name: string) => {
    flush();
    mesh = { name, byMat: new Map() };
  };
  for (const line of text.split("\n")) {
    const t = line.trim().split(/\s+/);
    const k = t[0];
    if (k === "v") v.push(t.slice(1, 4).map(Number));
    else if (k === "vt") vt.push(t.slice(1, 3).map(Number));
    else if (k === "vn") vn.push(t.slice(1, 4).map(Number));
    else if (k === "o") start(t.slice(1).join(" "));
    else if (k === "usemtl") mat = t.slice(1).join(" ");
    else if (k === "f") {
      if (!mesh) start("");
      const byMat = mesh!.byMat;
      const q = byMat.get(mat) ?? byMat.set(mat, { pos: [], nrm: [], uv: [], idx: [], seen: new Map() }).get(mat)!;
      const corner = (s: string): number => {
        const hit = q.seen.get(s);
        if (hit !== undefined) return hit;
        const [a, b, c] = s.split("/");
        const at = (list: number[][], i: string | undefined) => (i ? list[Number(i) < 0 ? list.length + Number(i) : Number(i) - 1] : undefined);
        const P = at(v, a) ?? [0, 0, 0];
        const T = at(vt, b) ?? [0, 0];
        const N = at(vn, c) ?? [0, 1, 0];
        const n = q.pos.length / 3;
        q.pos.push(P[0], P[1], P[2]);
        q.uv.push(T[0], 1 - T[1]);
        q.nrm.push(N[0], N[1], N[2]);
        q.seen.set(s, n);
        return n;
      };
      const ids = t.slice(1).map(corner);
      for (let i = 1; i + 1 < ids.length; i++) q.idx.push(ids[0], ids[i], ids[i + 1]);
    }
  }
  flush();
  const nodes = meshes.map((m, i) => ({ name: m.name, mesh: i, t: [0, 0, 0] as Vec3, r: [0, 0, 0, 1] as Quat, s: [1, 1, 1] as Vec3, kids: [] as number[], parent: null as number | null }));
  return { meshes, nodes, roots: nodes.map((_, i) => i) };
}

/** a GLB's geometry and node tree, read directly: the importer needs raw arrays, not a scene */
function readGlb(file: string): RawModel {
  const b = readFileSync(file);
  const jlen = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + jlen).toString("utf8"));
  const binStart = 20 + jlen + 8;
  const bin = b.subarray(binStart);
  const COMP: Record<number, number> = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 };
  const SIZE: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const read = (ai: number): { data: number[] | Float32Array | Uint32Array; n: number } => {
    const a = j.accessors[ai];
    const bv = j.bufferViews[a.bufferView];
    const comps = SIZE[a.type];
    const cs = COMP[a.componentType];
    const stride = bv.byteStride || comps * cs;
    const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const out = a.componentType === 5126 ? new Float32Array(a.count * comps) : new Uint32Array(a.count * comps);
    for (let i = 0; i < a.count; i++)
      for (let c = 0; c < comps; c++) {
        const o = base + i * stride + c * cs;
        out[i * comps + c] = a.componentType === 5126 ? bin.readFloatLE(o) : a.componentType === 5125 ? bin.readUInt32LE(o) : a.componentType === 5123 ? bin.readUInt16LE(o) : bin.readUInt8(o);
      }
    return { data: out, n: a.count };
  };
  const meshes = (j.meshes ?? []).map((m: any) => ({
    name: m.name ?? "",
    prims: m.primitives.map((p: any): RawPrim => {
      const pos = read(p.attributes.POSITION).data as Float32Array;
      const nrm = p.attributes.NORMAL !== undefined ? (read(p.attributes.NORMAL).data as Float32Array) : null;
      const uv = p.attributes.TEXCOORD_0 !== undefined ? (read(p.attributes.TEXCOORD_0).data as Float32Array) : null;
      const idx = p.indices !== undefined ? Uint32Array.from(read(p.indices).data as Uint32Array) : Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
      return { pos, nrm, uv, idx, material: p.material !== undefined ? (j.materials[p.material].name ?? "") : "" };
    }),
  }));
  const nodes = (j.nodes ?? []).map((n: any) => ({ name: n.name ?? "", mesh: n.mesh ?? null, t: n.translation ?? [0, 0, 0], r: n.rotation ?? [0, 0, 0, 1], s: n.scale ?? [1, 1, 1], kids: n.children ?? [], parent: null as number | null }));
  nodes.forEach((n: any, i: number) => n.kids.forEach((k: number) => (nodes[k].parent = i)));
  return { meshes, nodes, roots: j.scenes?.[j.scene ?? 0]?.nodes ?? [] };
}

/**
 * The scale a model's node chain gives one mesh: Unity bakes the chain's scale (3ds Max's 100x on the group) into
 * the mesh on import, but keeps each node's turn on the prefab's own GameObject, where the prefab already carries it
 * (a street door's parts are turned -90 degrees about X in both). So only the scales multiply in here.
 */
function preOf(model: RawModel, meshIdx: number): M4 {
  const i = model.nodes.findIndex((n) => n.mesh === meshIdx);
  if (i < 0) return I4;
  const s: Vec3 = [...model.nodes[i].s] as Vec3;
  let k = model.nodes[i].parent;
  while (k !== null) {
    for (let c = 0; c < 3; c++) s[c] *= model.nodes[k].s[c];
    k = model.nodes[k].parent;
  }
  return trs([0, 0, 0], [0, 0, 0, 1], s);
}
const meshIds = new WeakMap<RawModel, Map<bigint, number>>();
function meshIndex(pack: Pack, model: RawModel, guid: string, fid: bigint | null, goName: string): number | null {
  // by Unity's own ID for the mesh (unityId), where it is one: a renderer named "Box06056 (1)" drew nothing by name
  if (fid !== null) {
    let byId = meshIds.get(model);
    if (!byId) {
      const map = new Map<bigint, number>();
      const seen = new Map<string, number>();
      model.meshes.forEach((m, i) => {
        const k = seen.get(m.name) ?? 0;
        seen.set(m.name, k + 1);
        map.set(unityId("Mesh", m.name, k), i);
      });
      const seenN = new Map<string, number>();
      for (const n of model.nodes) {
        if (n.mesh === null) continue;
        const k = seenN.get(n.name) ?? 0;
        seenN.set(n.name, k + 1);
        const id = unityId("Mesh", n.name, k);
        if (!map.has(id)) map.set(id, n.mesh);
      }
      meshIds.set(model, map);
      byId = map;
    }
    const hit = byId.get(fid);
    if (hit !== undefined) return hit;
  }
  const want = (fid !== null && pack.meshNames(guid).get(fid)) || goName;
  let i = model.meshes.findIndex((m) => m.name === want);
  if (i >= 0) return i;
  const n = model.nodes.find((x) => x.name === want && x.mesh !== null);
  if (n) return n.mesh;
  return model.meshes.length === 1 ? 0 : null;
}

// ---------------------------------------------------------------- a prefab, rebuilt
export interface Draw { model: RawModel; mesh: number; pre: M4 | null; mats: Array<string | null> | null; modelGuid: string; on: boolean; go: bigint | null }
class TNode {
  t: Vec3 = [0, 0, 0];
  r: Quat = [0, 0, 0, 1];
  s: Vec3 = [1, 1, 1];
  kids: TNode[] = [];
  draws: Draw[] = [];
  active = true;
  parent: TNode | null = null;
  /** the prefab (guid) this node is the root of an instance of, for PREFAB_REPORT */
  src: string | null = null;
  constructor(public name = "") {}
}
const u2tPos = (p: any): Vec3 => [-num(p?.x), num(p?.y), num(p?.z)];
const u2tRot = (q: any): Quat => [num(q?.x), -num(q?.y), -num(q?.z), num(q?.w, 1)];

export class Resolver {
  constructor(private pack: Pack, private models: Models) {}

  private instantiateModel(guid: string): { roots: TNode[]; ids: Map<string, TNode> } {
    const root = new TNode(basename(this.pack.guidPath.get(guid) ?? guid));
    const ids = new Map<string, TNode>([[String(ROOT_T), root], [String(ROOT_G), root]]);
    const model = this.models.get(this.pack, guid);
    if (!model) return { roots: [root], ids };
    const remap = this.pack.materialRemap(guid);
    const top = new Set<number>();
    for (const r of model.roots) {
      top.add(r);
      for (const k of model.nodes[r].kids) top.add(k);
    }
    const build = (i: number): TNode => {
      const n = model.nodes[i];
      const tn = new TNode(n.name);
      // a model's top object becomes the prefab's origin in Unity, so its place in the old 3ds Max
      // scene (hundreds of metres out, and in centimetres FBX2glTF left unconverted) is dropped
      tn.t = top.has(i) ? [0, 0, 0] : ([...n.t] as Vec3);
      tn.r = [...n.r] as Quat; tn.s = [...n.s] as Vec3;
      if (n.mesh !== null) {
        const mats = model.meshes[n.mesh].prims.map((p) => remap.get(p.material) ?? this.pack.matFor(p.material));
        tn.draws.push({ model, mesh: n.mesh, pre: null, mats, modelGuid: guid, on: true, go: null });
      }
      for (const k of n.kids) {
        const c = build(k);
        c.parent = tn;
        tn.kids.push(c);
      }
      return tn;
    };
    for (const i of model.roots) {
      const c = build(i);
      c.parent = root;
      root.kids.push(c);
    }
    return { roots: [root], ids };
  }

  instantiate(guid: string, depth = 0): { roots: TNode[]; ids: Map<string, TNode> } {
    const p = this.pack.guidPath.get(guid) ?? "";
    if (/\.(fbx|obj|blend)$/i.test(p)) return this.instantiateModel(guid);
    if (depth > 12) return { roots: [], ids: new Map() };
    const objs = this.pack.parse(guid);
    const ids = new Map<string, TNode>();
    const parentOf: Array<[TNode, bigint]> = [];
    for (const [fid, o] of objs) {
      if ((o.cls === 4 || o.cls === 224) && !o.stripped) {
        const n = new TNode();
        n.t = u2tPos(o.data.m_LocalPosition);
        n.r = u2tRot(o.data.m_LocalRotation ?? { w: 1 });
        const sc = o.data.m_LocalScale ?? { x: 1, y: 1, z: 1 };
        n.s = [num(sc.x, 1), num(sc.y, 1), num(sc.z, 1)];
        ids.set(String(fid), n);
        const go = big(o.data.m_GameObject?.fileID);
        if (go) ids.set(String(go), n);
        parentOf.push([n, big(o.data.m_Father?.fileID) ?? 0n]);
      }
    }
    for (const [fid, o] of objs) {
      if (o.cls === 1) {
        const n = ids.get(String(fid));
        if (n) {
          n.name = String(o.data.m_Name ?? "");
          n.active = num(o.data.m_IsActive, 1) !== 0;
        }
      }
    }
    for (const [fid, o] of objs) {
      if (o.cls !== 1001) continue;
      const src = o.data.m_SourcePrefab?.guid;
      if (!src) continue;
      const mod = o.data.m_Modification ?? {};
      const sub = this.instantiate(String(src), depth + 1);
      for (const r of sub.roots) r.src ??= String(src);
      // A model's own objects (its renderers) have IDs newer Unity hashes from their names, which this cannot compute,
      // so an override of a renderer's materials found no node and was dropped: High City's wall rows lost their walls
      // (Phase 22, the owner's "our buildings look nothing like the assets"). Such an override goes to the model's only
      // mesh; with several, to the one whose material slots number what the override sets, when just one does.
      const meshNodes: TNode[] = [];
      const collect = (n: TNode): void => {
        if (n.draws.length) meshNodes.push(n);
        for (const k of n.kids) collect(k);
      };
      for (const r of sub.roots) collect(r);
      const slots = new Map<string, number>();
      // each target's materials by slot, their names from the pack's .mat files
      const setBy = new Map<string, Map<number, string>>();
      for (const m of mod.m_Modifications ?? []) {
        const path = String(m.propertyPath ?? "");
        const t = big(m.target?.fileID);
        if (t !== null && !sub.ids.has(String(t)) && path.startsWith("m_Materials.Array.data[")) {
          const k = +path.match(/\[(\d+)\]/)![1];
          slots.set(String(t), Math.max(slots.get(String(t)) ?? 0, k + 1));
          const g = m.objectReference?.guid;
          if (g) {
            const byK = setBy.get(String(t)) ?? new Map<number, string>();
            byK.set(k, basename(this.pack.guidPath.get(String(g)) ?? "", ".mat"));
            setBy.set(String(t), byK);
          }
        }
      }
      const byTarget = new Map<string, TNode>();
      const primsOf = (q: TNode) => q.draws[0]?.model.meshes[q.draws[0].mesh]?.prims ?? [];
      const open: string[] = [];
      for (const [t, n] of slots) {
        const fit = meshNodes.length === 1 ? meshNodes : meshNodes.filter((q) => q.draws.some((d) => d.model.meshes[d.mesh]?.prims.length === n));
        if (fit.length === 1) byTarget.set(t, fit[0]);
        else open.push(t);
      }
      // Where the slot counts do not decide (a car's body, glass and lamps each one or two slots), by the names: the
      // materials an override sets against the model's own names for its slots (High City's "car 1 glass" on a mesh
      // whose slot the FBX calls "glass"), each target to the mesh it matches best, one mesh a target; then, if one
      // target and one mesh with room for it are left, those two
      if (open.length) {
        const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 || /\d/.test(w)));
        const sim = (a: string, b: string) => {
          const A = words(a);
          const B = words(b);
          let n = 0;
          for (const w of A) if (B.has(w)) n++;
          return n / Math.max(1, Math.min(A.size, B.size));
        };
        const used = new Set<TNode>(byTarget.values());
        const pairs: Array<{ t: string; q: TNode; s: number }> = [];
        for (const t of open) {
          const want = setBy.get(t) ?? new Map<number, string>();
          for (const q of meshNodes) {
            const prims = primsOf(q);
            if (prims.length < (slots.get(t) ?? 1)) continue;
            let s = 0;
            for (const [k, name] of want) s += sim(prims[k]?.material ?? "", name);
            if (s > 0) pairs.push({ t, q, s: s + (prims.length === slots.get(t) ? 0.25 : 0) });
          }
        }
        pairs.sort((p, q) => q.s - p.s);
        for (const p of pairs) {
          if (byTarget.has(p.t) || used.has(p.q)) continue;
          byTarget.set(p.t, p.q);
          used.add(p.q);
        }
        const left = open.filter((t) => !byTarget.has(t));
        const free = meshNodes.filter((q) => !used.has(q));
        if (left.length === 1) {
          const room = free.filter((q) => primsOf(q).length >= (slots.get(left[0]) ?? 1));
          if (room.length === 1) byTarget.set(left[0], room[0]);
        }
        for (const t of open) if (!byTarget.has(t)) IMPORT_STATS.unplacedOverrides++;
      }
      for (const m of mod.m_Modifications ?? []) {
        const tgt = big(m.target?.fileID);
        const node = tgt !== null ? (sub.ids.get(String(tgt)) ?? byTarget.get(String(tgt))) : undefined;
        if (!node) continue;
        const path = String(m.propertyPath ?? "");
        const ref = m.objectReference ?? {};
        const v = m.value;
        if (path.startsWith("m_LocalPosition.")) {
          const i = "xyz".indexOf(path.slice(-1));
          node.t[i] = i === 0 ? -num(v) : num(v);
        } else if (path.startsWith("m_LocalRotation.")) {
          const i = "xyzw".indexOf(path.slice(-1));
          node.r[i] = i === 1 || i === 2 ? -num(v) : num(v);
        } else if (path.startsWith("m_LocalScale.")) {
          node.s["xyz".indexOf(path.slice(-1))] = num(v, 1);
        } else if (path === "m_IsActive") node.active = num(v, 1) !== 0;
        else if (path === "m_Name") node.name = String(v ?? "");
        else if (path.startsWith("m_Materials.Array.data[") && ref.guid) {
          const k = +path.match(/\[(\d+)\]/)![1];
          for (const d of node.draws) {
            const mats = (d.mats = [...(d.mats ?? [])]);
            while (mats.length <= k) mats.push(null);
            mats[k] = String(ref.guid);
          }
        } else if (path === "m_Enabled") for (const d of node.draws) d.on = num(v, 1) !== 0;
      }
      for (const [sfid, node] of sub.ids) {
        const s = BigInt(sfid);
        ids.set(String((fid ^ s) & MASK), node);
        ids.set(String(fid ^ s), node);
      }
      const tp = big(mod.m_TransformParent?.fileID) ?? 0n;
      for (const r of sub.roots) parentOf.push([r, tp]);
    }
    for (const [fid, o] of objs) {
      if (!o.stripped) continue;
      const src = big(o.data.m_CorrespondingSourceObject?.fileID);
      const pi = big(o.data.m_PrefabInstance?.fileID);
      if (src === null || pi === null) continue;
      const n = ids.get(String((pi ^ src) & MASK)) ?? ids.get(String(pi ^ src));
      if (n) ids.set(String(fid), n);
    }
    // this file's own meshes and renderers
    for (const [, o] of objs) {
      if ((o.cls === 33 || o.cls === 137) && !o.stripped) {
        const go = big(o.data.m_GameObject?.fileID);
        const node = go !== null ? ids.get(String(go)) : undefined;
        const mref = o.data.m_Mesh ?? {};
        if (!node || !mref.guid) continue;
        const mg = String(mref.guid);
        const model = this.models.get(this.pack, mg);
        if (!model) continue;
        const mi = meshIndex(this.pack, model, mg, big(mref.fileID), node.name);
        if (mi === null) {
          // (a renderer whose mesh is not found by name draws nothing: counted, so it does not go unseen)
          const k = `${basename(this.pack.guidPath.get(mg) ?? mg)} : ${node.name}`;
          IMPORT_STATS.unmatchedMeshes.set(k, (IMPORT_STATS.unmatchedMeshes.get(k) ?? 0) + 1);
          if (process.env.MESH_DEBUG && k.includes(process.env.MESH_DEBUG)) console.log("mesh not found", k, "model meshes:", model.meshes.map((m) => `${m.name}(${m.prims.length})`).join(", "), "nodes:", model.nodes.filter((x) => x.mesh !== null).map((x) => x.name).join(", "));
          continue;
        }
        const d: Draw = { model, mesh: mi, pre: preOf(model, mi), mats: null, modelGuid: mg, on: true, go };
        if (o.cls === 137) d.mats = (o.data.m_Materials ?? []).map((m: any) => (m?.guid ? String(m.guid) : null));
        node.draws.push(d);
      }
    }
    for (const [, o] of objs) {
      if (o.cls !== 23 || o.stripped) continue;
      const go = big(o.data.m_GameObject?.fileID);
      const node = go !== null ? ids.get(String(go)) : undefined;
      if (!node) continue;
      const mats = (o.data.m_Materials ?? []).map((m: any) => (m?.guid ? String(m.guid) : null));
      for (const d of node.draws) if (d.go === go) {
        d.mats = mats;
        d.on = num(o.data.m_Enabled, 1) !== 0;
      }
    }
    const roots: TNode[] = [];
    for (const [n, pf] of parentOf) {
      const p = pf ? ids.get(String(pf)) : undefined;
      if (p && p !== n) {
        n.parent = p;
        p.kids.push(n);
      } else roots.push(n);
    }
    return { roots, ids };
  }

  /** every mesh a prefab draws at LOD0, with its matrix in the prefab's space */
  flatten(guid: string): Array<{ d: Draw; m: M4; from: string[] }> {
    const { roots } = this.instantiate(guid);
    const out: Array<{ d: Draw; m: M4; from: string[] }> = [];
    // (`from`: the prefabs whose instances hold the part, outermost first, for PREFAB_REPORT)
    const walk = (n: TNode, pm: M4, from: string[]): void => {
      if (!n.active || LOD_N.test(n.name)) return;
      const m = mul(pm, trs(n.t, n.r, n.s));
      const f = n.src ? [...from, n.src] : from;
      for (const d of n.draws) if (d.on) out.push({ d, m: d.pre ? mul(m, d.pre) : m, from: f });
      for (const k of n.kids) walk(k, m, f);
    };
    for (const r of roots) walk(r, I4, []);
    return out;
  }
}

// ---------------------------------------------------------------- materials and textures
export interface MatInfo {
  name: string;
  map: string | null; normal: string | null; emissive: string | null; metalGloss: string | null; occlusion: string | null;
  color: [number, number, number, number]; emission: [number, number, number] | null;
  metal: number; smooth: number; normalScale: number;
  /** URP's specular workflow (_WorkflowMode 0): metalGloss is then its specular map, colour in RGB, smoothness in A */
  specular: boolean;
  mode: "OPAQUE" | "MASK" | "BLEND"; cutoff: number; doubleSided: boolean;
  tiling: [number, number, number, number];
  /**
   * Unity's Standard shader's detail maps (_DetailAlbedoMap x2, _DetailNormalMap, _DetailMask), each at the detail's own
   * tiling: Daelonik's Neon City keeps the real surface there on a third of its materials (its asphalt's _MainTex is a
   * noise, its colour the detail's), so read alone the city came out plain white. The game multiplies them in
   * (neonmap.ts); `detailTiling` is the detail's scale and offset in Unity's UV space, as `tiling` is the main's
   */
  detail: string | null; detailNormal: string | null; detailMask: string | null; detailNormalScale: number;
  detailTiling: [number, number, number, number];
  /** Built-in Standard's smoothness in the colour map's alpha (_SMOOTHNESS_TEXTURE_ALBEDO_CHANNEL_A), scaled by `smooth` */
  smoothFromAlbedo: boolean;
  /**
   * Unity's built-in particle shaders (Particles/Standard Unlit, fileID 211, and Surface, 210), which Neon City draws its
   * light beams, glows and grille decals with: `unlit` for the Unlit one, `additive` for their _Mode 4 (added to what is
   * behind, no depth written). Read as Standard, the pads' light beams came out solid white columns
   */
  unlit: boolean; additive: boolean;
}
export function readMaterial(pack: Pack, guid: string): MatInfo | null {
  const objs = pack.parse(guid);
  for (const [, o] of objs) {
    if (o.cls !== 21) continue;
    const d = o.data;
    const props = d.m_SavedProperties ?? {};
    const tex = (keys: string[]): { guid: string; scale: [number, number]; offset: [number, number] } | null => {
      for (const k of keys)
        for (const e of props.m_TexEnvs ?? []) {
          const v = e?.[k];
          if (v?.m_Texture?.guid && pack.file(String(v.m_Texture.guid)))
            return { guid: String(v.m_Texture.guid), scale: [num(v.m_Scale?.x, 1), num(v.m_Scale?.y, 1)], offset: [num(v.m_Offset?.x), num(v.m_Offset?.y)] };
        }
      return null;
    };
    const flt = (keys: string[], dflt: number): number => {
      for (const k of keys) for (const e of props.m_Floats ?? []) if (e && k in e) return num(e[k]);
      return dflt;
    };
    const col = (keys: string[]): any => {
      for (const k of keys) for (const e of props.m_Colors ?? []) if (e && k in e) return e[k];
      return null;
    };
    const kw = [String(d.m_ShaderKeywords ?? ""), ...(d.m_ValidKeywords ?? []).map(String)].join(" ");
    // standard names first; a custom shader's albedo is found by its property's name
    let base = tex(["_BaseMap", "_MainTex", "_BaseColorMap"]);
    if (!base) {
      const k = (props.m_TexEnvs ?? []).map((e: any) => Object.keys(e ?? {})[0]).find((n: string) => /albedo|diffuse|color|main/i.test(n ?? ""));
      if (k) base = tex([k]);
    }
    const c = col(["_BaseColor", "_Color"]) ?? { r: 1, g: 1, b: 1, a: 1 };
    const e = col(["_EmissionColor", "_EmissiveColor"]);
    const emissiveTex = tex(["_EmissionMap", "_EmissiveColorMap"]);
    const emitting = /_EMISSION/.test(kw) || !!emissiveTex;
    const detail = tex(["_DetailAlbedoMap"]);
    const detailNormal = tex(["_DetailNormalMap"]);
    // Built-in Standard's smoothness: the gloss map's alpha (or the colour map's) times _GlossMapScale, else _Glossiness;
    // URP's Lit, the ILranch packs', has _Smoothness for both
    const glossMap = flt(["_WorkflowMode"], 1) === 0 ? tex(["_SpecGlossMap"]) : tex(["_MetallicGlossMap", "_MaskMap"]);
    const fromAlbedo = /_SMOOTHNESS_TEXTURE_ALBEDO_CHANNEL_A/.test(kw);
    const hasUrp = (props.m_Floats ?? []).some((e: any) => e && "_Smoothness" in e);
    const smooth = hasUrp ? flt(["_Smoothness"], 0.5) : glossMap || fromAlbedo ? flt(["_GlossMapScale"], 1) : flt(["_Glossiness"], 0.5);
    const surface = flt(["_Surface"], 0);
    const mode = flt(["_Mode"], 0);
    const clip = flt(["_AlphaClip"], 0) === 1 || /_ALPHATEST_ON/.test(kw) || mode === 1;
    // a built-in shader's guid is Unity's extra resources' (all zeros but an f); the particles' _Mode runs opaque 0,
    // cutout 1, fade 2, transparent 3, additive 4 (Standard's stops at 3)
    const shader = d.m_Shader ?? {};
    const builtin = /^0{16}f0{15}$/.test(String(shader.guid ?? ""));
    const particles = builtin && (num(shader.fileID) === 210 || num(shader.fileID) === 211);
    const cull = flt(["_Cull", "_CullMode"], 2);
    return {
      name: String(d.m_Name ?? guid),
      map: base?.guid ?? null,
      normal: tex(["_BumpMap", "_NormalMap"])?.guid ?? null,
      emissive: emitting ? emissiveTex?.guid ?? null : null,
      // (the specular workflow's map in the same place: Glass City's machinery is drawn with it, and without it every
      // pipe read as smoothness 1 and mirrored the sky, white)
      metalGloss: glossMap?.guid ?? null,
      specular: flt(["_WorkflowMode"], 1) === 0,
      occlusion: tex(["_OcclusionMap"])?.guid ?? null,
      color: [srgbToLinear(num(c.r, 1)), srgbToLinear(num(c.g, 1)), srgbToLinear(num(c.b, 1)), num(c.a, 1)],
      emission: emitting && e ? [num(e.r), num(e.g), num(e.b)] : emitting ? [1, 1, 1] : null,
      metal: flt(["_Metallic"], 0),
      smooth,
      normalScale: flt(["_BumpScale"], 1),
      mode: surface === 1 || mode === 2 || mode === 3 || (particles && mode >= 4) ? "BLEND" : clip ? "MASK" : "OPAQUE",
      cutoff: flt(["_Cutoff"], 0.5),
      doubleSided: cull === 0,
      tiling: base ? [base.scale[0], base.scale[1], base.offset[0], base.offset[1]] : [1, 1, 0, 0],
      detail: detail?.guid ?? null,
      detailNormal: detailNormal?.guid ?? null,
      detailMask: tex(["_DetailMask"])?.guid ?? null,
      detailNormalScale: flt(["_DetailNormalMapScale"], 1),
      detailTiling: detail ? [detail.scale[0], detail.scale[1], detail.offset[0], detail.offset[1]] : detailNormal ? [detailNormal.scale[0], detailNormal.scale[1], detailNormal.offset[0], detailNormal.offset[1]] : [1, 1, 0, 0],
      smoothFromAlbedo: fromAlbedo && !glossMap,
      unlit: builtin && num(shader.fileID) === 211,
      additive: particles && mode === 4,
    };
  }
  return null;
}

initializeCanvas(() => ({ width: 1, height: 1, getContext: () => ({ createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) }) }) as any);

export class Textures {
  private raw = new Map<string, { data: Buffer; width: number; height: number; channels: 3 | 4 } | null>();
  private out = new Map<string, Buffer | null>();
  constructor(private h: CityImportHelpers) {}
  /** a texture's pixels at full size, whatever its file type */
  private async decode(pack: Pack, guid: string): Promise<{ data: Buffer; width: number; height: number; channels: 3 | 4 } | null> {
    const key = pack.name + guid;
    if (this.raw.has(key)) return this.raw.get(key)!;
    const f = pack.file(guid);
    const p = (pack.guidPath.get(guid) ?? "").toLowerCase();
    let r: { data: Buffer; width: number; height: number; channels: 3 | 4 } | null = null;
    try {
      if (!f) r = null;
      else if (p.endsWith(".tga")) r = this.h.readTga(f);
      else if (p.endsWith(".psd")) {
        const psd = readPsd(readFileSync(f), { useImageData: true, skipLayerImageData: true, skipThumbnail: true });
        if (psd.imageData) r = { data: Buffer.from(psd.imageData.data.buffer), width: psd.width, height: psd.height, channels: 4 };
      } else {
        const { data, info } = await sharp(f, { limitInputPixels: false }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        r = { data, width: info.width, height: info.height, channels: 4 };
      }
    } catch {
      r = null;
    }
    // keep the last few only: a pack's source textures are gigabytes raw
    if (this.raw.size > 6) this.raw.delete(this.raw.keys().next().value!);
    this.raw.set(key, r);
    return r;
  }
  private fit(w: number, h: number, size: number): [number, number] {
    // in whole blocks of 4: Basis's ETC1S and UASTC work in 4 by 4 blocks, and three.js warns on any other size
    const k = Math.min(1, size / Math.max(w, h));
    return [Math.max(4, Math.round((w * k) / 4) * 4), Math.max(4, Math.round((h * k) / 4) * 4)];
  }
  /** the pool that turns pictures into KTX2 (set by city() before any pack is written) */
  pool: BasisPool | null = null;
  private ktx = new Map<string, Promise<Uint8Array | null>>();
  /** a texture as KTX2 at `size` (the longest side, never past the source's), GPU-compressed: a promise, cached */
  ktx2(pack: Pack, guid: string, size: number, kind: BasisKind): Promise<Uint8Array | null> {
    const key = `${pack.name}/${guid}/${size}/${kind}`;
    if (!this.ktx.has(key))
      this.ktx.set(
        key,
        (async () => {
          const t = await this.decode(pack, guid);
          if (!t) return null;
          const [w, h] = this.fit(t.width, t.height, size);
          const rgba = await sharp(t.data, { raw: { width: t.width, height: t.height, channels: t.channels } }).resize(w, h, { kernel: "lanczos3" }).ensureAlpha().raw().toBuffer();
          return this.pool!.encode(rgba, w, h, kind);
        })(),
      );
    return this.ktx.get(key)!;
  }
  /**
   * a texture as one layer of a texture array (writePack's batches): exactly `size` square whatever its own shape (a UV
   * from 0 to 1 does not see the stretch), and opaque, so every layer of an array comes out of the transcoder in one GPU
   * format (Basis gives a picture with any alpha in it an alpha slice, and three.js transcodes those to another format)
   */
  layerKtx2(pack: Pack, guid: string, size: number, kind: BasisKind): Promise<Uint8Array | null> {
    const key = `${pack.name}/${guid}/${size}/${kind}/layer`;
    if (!this.ktx.has(key))
      this.ktx.set(
        key,
        (async () => {
          const t = await this.decode(pack, guid);
          if (!t) return null;
          const rgba = await sharp(t.data, { raw: { width: t.width, height: t.height, channels: t.channels } }).resize(size, size, { kernel: "lanczos3", fit: "fill" }).removeAlpha().ensureAlpha().raw().toBuffer();
          return this.pool!.encode(rgba, size, size, kind);
        })(),
      );
    return this.ktx.get(key)!;
  }
  /** what tells two materials' packed occlusion, roughness and metal apart (ormKtx2's cache key) */
  ormKey(pack: Pack, mi: MatInfo, size: number): string {
    return `${pack.name}/${mi.metalGloss}/${mi.smoothFromAlbedo ? mi.map : ""}/${mi.occlusion}/${size}/${mi.smooth}/${mi.metal}/orm`;
  }
  /** the packed occlusion, roughness and metal as a layer of a texture array: `size` square; null where it has none */
  ormLayerKtx2(pack: Pack, mi: MatInfo, size: number): Promise<Uint8Array | null> {
    const key = `${this.ormKey(pack, mi, size)}/layer`;
    if (!this.ktx.has(key))
      this.ktx.set(
        key,
        (async () => {
          const px = await this.ormPixels(pack, mi, size);
          if (!px) return null;
          const rgba = await sharp(px.rgb, { raw: { width: px.w, height: px.h, channels: 3 } }).resize(size, size, { fit: "fill" }).ensureAlpha().raw().toBuffer();
          return this.pool!.encode(rgba, size, size, "data");
        })(),
      );
    return this.ktx.get(key)!;
  }
  /** one colour all over, `size` square: an array's neutral layer, read by a material with no picture of that kind */
  solidKtx2(rgb: [number, number, number], size: number, kind: BasisKind): Promise<Uint8Array | null> {
    const key = `solid/${rgb.join(",")}/${size}/${kind}`;
    if (!this.ktx.has(key)) {
      const rgba = Buffer.alloc(size * size * 4);
      for (let i = 0; i < size * size; i++) rgba.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
      this.ktx.set(key, this.pool!.encode(rgba, size, size, kind));
    }
    return this.ktx.get(key)!;
  }
  /** the packed occlusion, roughness and metal (orm) as KTX2 */
  ormKtx2(pack: Pack, mi: MatInfo, size: number): Promise<Uint8Array | null> {
    const key = this.ormKey(pack, mi, size);
    if (!this.ktx.has(key))
      this.ktx.set(
        key,
        (async () => {
          const px = await this.ormPixels(pack, mi, size);
          if (!px) return null;
          const rgba = await sharp(px.rgb, { raw: { width: px.w, height: px.h, channels: 3 } }).ensureAlpha().raw().toBuffer();
          return this.pool!.encode(rgba, px.w, px.h, "data");
        })(),
      );
    return this.ktx.get(key)!;
  }
  async webp(pack: Pack, guid: string, size: number, kind: "color" | "normal" | "emissive"): Promise<Buffer | null> {
    const key = `${pack.name}/${guid}/${size}/${kind}`;
    if (this.out.has(key)) return this.out.get(key)!;
    const t = await this.decode(pack, guid);
    let b: Buffer | null = null;
    if (t) {
      const [w, h] = this.fit(t.width, t.height, size);
      b = await sharp(t.data, { raw: { width: t.width, height: t.height, channels: t.channels } })
        .resize(w, h, { kernel: "lanczos3" })
        .webp({ quality: kind === "normal" ? 90 : 82, effort: 4 })
        .toBuffer();
    }
    this.out.set(key, b);
    return b;
  }
  /** Unity's metal/smoothness (R metal, A smoothness) and occlusion as glTF's packed occlusion, roughness, metal */
  async orm(pack: Pack, mi: MatInfo, size: number): Promise<Buffer | null> {
    if (!mi.metalGloss && !mi.occlusion) return null;
    const key = `${pack.name}/${mi.metalGloss}/${mi.occlusion}/${size}/${mi.smooth}/orm`;
    if (this.out.has(key)) return this.out.get(key)!;
    const px = await this.ormPixels(pack, mi, size);
    const b = px ? await sharp(px.rgb, { raw: { width: px.w, height: px.h, channels: 3 } }).webp({ quality: 85 }).toBuffer() : null;
    this.out.set(key, b);
    return b;
  }
  /** Unity's metal and smoothness and its occlusion, packed as glTF's occlusion, roughness and metal, raw RGB */
  private async ormPixels(pack: Pack, mi: MatInfo, size: number): Promise<{ rgb: Buffer; w: number; h: number } | null> {
    const glossFrom = mi.metalGloss ?? (mi.smoothFromAlbedo ? mi.map : null);
    if (!glossFrom && !mi.occlusion) return null;
    const mg = glossFrom ? await this.decode(pack, glossFrom) : null;
    const oc = mi.occlusion ? await this.decode(pack, mi.occlusion) : null;
    const ref = mg ?? oc;
    if (!ref) return null;
    const [w, h] = this.fit(ref.width, ref.height, size);
    const px = async (t: typeof mg): Promise<Buffer | null> =>
      t ? sharp(t.data, { raw: { width: t.width, height: t.height, channels: t.channels } }).resize(w, h).ensureAlpha().raw().toBuffer() : null;
    const a = await px(mg);
    const o = await px(oc);
    const rgb = Buffer.alloc(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      rgb[i * 3] = o ? o[i * 4] : 255;
      const smooth = a ? (a[i * 4 + 3] / 255) * mi.smooth : mi.smooth;
      rgb[i * 3 + 1] = Math.round((1 - smooth) * 255);
      // a specular map's colour is not metalness: a dielectric's is dark (about 0.04); bright means metal
      rgb[i * 3 + 2] = a && mi.metalGloss ? (mi.specular ? Math.round(Math.min(1, Math.max(0, ((a[i * 4] + a[i * 4 + 1] + a[i * 4 + 2]) / 765 - 0.2) / 0.5)) * 255) : a[i * 4]) : Math.round(mi.metal * 255);
    }
    return { rgb, w, h };
  }
}

/**
 * A district's collision from its own triangles (Phase 25): the pack scene is a film set of faces, never boxes, so the
 * game's boxes are made from what it draws. Over a grid of `cell` metres each triangle is clipped to every cell it crosses
 * and fills that cell over the heights it spans there; a cell's spans closer than `merge` join; a span under `thin` deep
 * (a walkway, a step) is made that deep downward, so a body never falls through it; nothing under `floor` (the city's
 * street is the floor there) and no span topping out under `minTop` (the street's scraps). A part that is a stick, its
 * middle size under `stick` (a cable, a wire, a pole), fills nothing: they are what a player expects to pass. Cells with
 * the same spans are joined into rectangles, one box a span. Boxes [x0, x1, z0, z1, y0, y1], in the draws' own metres.
 */
export function districtSolids(draws: Array<{ d: Draw; m: M4 }>, o: { cell: number; stick: number; floor: number; merge: number; thin: number; minTop: number; fill?: { walkway: [number, number]; top: number; open: number; half: number; body: number; plan: number[][]; seeds: number[][]; streets?: number[][]; backs?: { storey: number; storeys: [number, number] } } }): { solids: number[][]; covers: number[][]; caps: number[][]; backs: number[][]; fronts: number[][] } {
  const C = o.cell;
  const OFF = 100000;
  const key = (i: number, j: number) => (i + OFF) * 1000003 + (j + OFF);
  const spans = new Map<number, number[]>();
  type V = [number, number, number];
  /** a polygon kept on one side of the plane `axis` = v */
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
  for (const { d, m } of draws) {
    const mesh = d.model.meshes[d.mesh];
    if (!mesh) continue;
    const w = (x: number, y: number, z: number): V => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
    const pts: V[][] = mesh.prims.map((p) => {
      const out: V[] = [];
      for (let k = 0; k < p.pos.length; k += 3) out.push(w(p.pos[k], p.pos[k + 1], p.pos[k + 2]));
      return out;
    });
    const lo: V = [Infinity, Infinity, Infinity];
    const hi: V = [-Infinity, -Infinity, -Infinity];
    for (const list of pts)
      for (const q of list)
        for (let a = 0; a < 3; a++) {
          lo[a] = Math.min(lo[a], q[a]);
          hi[a] = Math.max(hi[a], q[a]);
        }
    const size = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]].sort((p, q) => p - q);
    if (size[1] < o.stick || hi[1] < o.floor) continue;
    mesh.prims.forEach((p, pi) => {
      const list = pts[pi];
      for (let t = 0; t + 2 < p.idx.length; t += 3) {
        const tri: V[] = [list[p.idx[t]], list[p.idx[t + 1]], list[p.idx[t + 2]]];
        const x0 = Math.min(tri[0][0], tri[1][0], tri[2][0]);
        const x1 = Math.max(tri[0][0], tri[1][0], tri[2][0]);
        const z0 = Math.min(tri[0][2], tri[1][2], tri[2][2]);
        const z1 = Math.max(tri[0][2], tri[1][2], tri[2][2]);
        if (Math.max(tri[0][1], tri[1][1], tri[2][1]) < o.floor) continue;
        for (let i = Math.floor(x0 / C); i <= Math.floor(x1 / C); i++)
          for (let j = Math.floor(z0 / C); j <= Math.floor(z1 / C); j++) {
            let poly = clip(tri, 0, i * C, true);
            if (poly.length) poly = clip(poly, 0, (i + 1) * C, false);
            if (poly.length) poly = clip(poly, 2, j * C, true);
            if (poly.length) poly = clip(poly, 2, (j + 1) * C, false);
            if (!poly.length) continue;
            let y0 = Infinity;
            let y1 = -Infinity;
            for (const q of poly) {
              y0 = Math.min(y0, q[1]);
              y1 = Math.max(y1, q[1]);
            }
            if (y1 < o.floor) continue;
            const k = key(i, j);
            const s = spans.get(k) ?? spans.set(k, []).get(k)!;
            s.push(Math.max(o.floor, y0), y1);
          }
      }
    });
  }
  // each cell's spans joined
  const cellSpans = new Map<number, Array<[number, number]>>();
  for (const [k, flat] of spans) {
    const list: Array<[number, number]> = [];
    for (let i = 0; i < flat.length; i += 2) list.push([flat[i], flat[i + 1]]);
    list.sort((p, q) => p[0] - q[0]);
    const joined: Array<[number, number]> = [];
    for (const s of list) {
      const last = joined[joined.length - 1];
      if (last && s[0] <= last[1] + o.merge) last[1] = Math.max(last[1], s[1]);
      else joined.push([s[0], s[1]]);
    }
    cellSpans.set(k, joined.filter(([, b]) => b >= o.minTop));
  }
  // The film set is faces: behind them, at the street, nothing. A walkway's cell is solid down to the street (it stands on
  // its building, and bounds the canyon); then the street reachable on foot from the canyons' seeds, a flood over cells
  // with nothing at a body's height; every cell of the district's plan it does not reach is its buildings, solid to
  // `fill.top`, so nobody walks behind a face and sees through it
  /** the cells filled as a building's inside, and the height each was filled to: city drawn (covers and caps) */
  const filled = new Map<number, number>();
  /** the film set's backs closed (the open ground that meets ground you stand on), each cell's height: city draws them */
  const backs = new Map<number, number>();
  /** their edges that face where you stand, a cell long each: [line, along, axis, out, stand, height] */
  const edges: number[][] = [];
  if (o.fill) {
    const F = o.fill;
    for (const [k, list] of cellSpans) {
      const walk = list.find(([, b]) => b >= F.walkway[0] && b <= F.walkway[1]);
      // What stands on a floor reaches down to it: a crate's or a car's top alone in a cell (its sides fall in the cells
      // round it) hovered a hand over the walkway, a ledge a bot walked into and a player caught his feet on
      const base = walk ? walk[1] : 0;
      const standing = list.filter(([a, b]) => b > base + 0.05 && a < base + F.body);
      const top = Math.max(walk ? walk[1] : -Infinity, ...standing.map(([, b]) => b));
      const rest = list.filter(([a, b]) => b > base + 0.05 && a >= base + F.body);
      if (walk || standing.length) cellSpans.set(k, [[o.floor, top], ...rest]);
    }
    const passable = (i: number, j: number) => !(cellSpans.get(key(i, j)) ?? []).some(([a, b]) => a < 1.9 && b > 0.35);
    const inPlan = (x: number, z: number) => {
      if (Math.abs(x) > F.half || Math.abs(z) > F.half) return false;
      let n = false;
      for (let i = 0, j = F.plan.length - 1; i < F.plan.length; j = i++) {
        const [xi, zi] = F.plan[i];
        const [xj, zj] = F.plan[j];
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) n = !n;
      }
      return n;
    };
    // the canyons' floors only: at an arm's end, before its walkways begin, the flood would run out behind the faces
    const onStreet = (x: number, z: number) => !F.streets || F.streets.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
    const reached = new Set<number>();
    const todo: Array<[number, number]> = F.seeds.map(([x, z]) => [Math.floor(x / C), Math.floor(z / C)] as [number, number]).filter(([i, j]) => passable(i, j));
    for (const [i, j] of todo) reached.add(key(i, j));
    while (todo.length) {
      const [i, j] = todo.pop()!;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const [a, b] = [i + di, j + dj];
        const k = key(a, b);
        if (reached.has(k) || !inPlan((a + 0.5) * C, (b + 0.5) * C) || !onStreet((a + 0.5) * C, (b + 0.5) * C) || !passable(a, b)) continue;
        reached.add(k);
        todo.push([a, b]);
      }
    }
    const xs = F.plan.map((p) => p[0]);
    const zs = F.plan.map((p) => p[1]);
    const walkTop = (k: number): number | null => (cellSpans.get(k) ?? []).find(([, b]) => b >= F.walkway[0] && b <= F.walkway[1])?.[1] ?? null;
    const fills = new Map<number, Array<[number, number]>>();
    const building = new Map<number, number>();
    const cellOf = new Map<number, [number, number]>();
    for (let i = Math.floor(Math.min(...xs) / C); i <= Math.floor(Math.max(...xs) / C); i++)
      for (let j = Math.floor(Math.min(...zs) / C); j <= Math.floor(Math.max(...zs) / C); j++) {
        const k = key(i, j);
        if (reached.has(k) || !inPlan((i + 0.5) * C, (j + 0.5) * C)) continue;
        const list = cellSpans.get(k) ?? [];
        // a walkway's cell keeps its walkway
        if (walkTop(k) !== null) continue;
        const tops = list.map(([, b]) => b);
        // one with walkway on two sides and more is on the walkway: what stands there (a lamp post, a sign's foot) to
        // its own top, or a gap in the deck filled to the walkway's; filled to the building's top, a lamp post was a
        // pillar 40 m high a bot walked into and a shot stopped at
        const beside = [key(i + 1, j), key(i - 1, j), key(i, j + 1), key(i, j - 1)].map(walkTop).filter((t): t is number => t !== null);
        if (beside.length >= 2) fills.set(k, [[o.floor, Math.max(...beside, ...tops)]]);
        // any other is its building's, filled to its height below
        else {
          building.set(k, tops.length ? Math.max(...tops) : -Infinity);
          cellOf.set(k, [i, j]);
        }
      }
    // A building's cells filled to its own height: a cell with something drawn in it to the top of what is drawn, and
    // one with nothing (the film set's hollow inside) to the height of the nearest cells that have, spread cell by cell
    // from them. Filled to a fixed 40 m, every lower building and empty lot had an invisible floor over it that a glide
    // or a roof nearby landed you on (the owner, 2026-09-28: "i was able to glitch into the corner map area"); city
    // draws the hollow cells (covers and caps below), so what you stand on up there is drawn
    const height = new Map<number, number>();
    for (const [k, own] of building) if (own > -Infinity) height.set(k, own);
    for (let front = [...height.keys()]; front.length; ) {
      const next: number[] = [];
      for (const k of front) {
        const [i, j] = cellOf.get(k)!;
        for (const n of [key(i + 1, j), key(i - 1, j), key(i, j + 1), key(i, j - 1)]) {
          if (!building.has(n) || height.has(n)) continue;
          height.set(n, height.get(k)!);
          next.push(n);
        }
      }
      front = next;
    }
    // A hollow cell joined through hollow cells to the plan's edge is not a building's inside but the scene's open
    // ground round its buildings: drawn over, it was a dark wall in front of the brick buildings at the corner's edge.
    // It stays undrawn and solid far over anything you reach (`open`), so there is no floor to land on up there
    const outside = (i: number, j: number) => !inPlan((i + 0.5) * C, (j + 0.5) * C);
    const open = new Set<number>();
    const todo2: number[] = [];
    for (const [k, [i, j]] of cellOf)
      if (building.get(k) === -Infinity && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => outside(i + di, j + dj))) {
        open.add(k);
        todo2.push(k);
      }
    while (todo2.length) {
      const [i, j] = cellOf.get(todo2.pop()!)!;
      for (const n of [key(i + 1, j), key(i - 1, j), key(i, j + 1), key(i, j - 1)])
        if (building.get(n) === -Infinity && !open.has(n)) {
          open.add(n);
          todo2.push(n);
        }
    }
    // The open ground that meets ground you stand on (the city's street round the plan, a canyon's floor, a walkway) is
    // not left undrawn: there it was an invisible wall the street seemed to go on through (four lots at the corner's arms'
    // ends, Phase 26.4). Each such piece of it is the film set's back closed: solid to the median height of the
    // buildings round it, whole storeys down, drawn by city (`backs`), and each run of its edge facing where you stand
    // given to the kit to dress (`fronts`). A piece that meets nothing you stand on stays undrawn at `open`
    const inPoly = (x: number, z: number) => {
      let n = false;
      for (let i = 0, j = F.plan.length - 1; i < F.plan.length; j = i++) {
        const [xi, zi] = F.plan[i];
        const [xj, zj] = F.plan[j];
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) n = !n;
      }
      return n;
    };
    /** what stands in cell (i, j) for someone on foot: the street (the canyons' floor, or the city's round the plan
     * within the map) at 0, a walkway at its top, or nothing to stand on (null) */
    const standAt = (i: number, j: number): number | null => {
      const k = key(i, j);
      if (reached.has(k)) return 0;
      const [x, z] = [(i + 0.5) * C, (j + 0.5) * C];
      if (Math.abs(x) > F.half || Math.abs(z) > F.half) return null;
      if (!inPoly(x, z)) return 0;
      return walkTop(k);
    };
    const B = F.backs;
    const backOf = new Map<number, number>();
    if (B) {
      const seen = new Set<number>();
      for (const start of open) {
        if (seen.has(start)) continue;
        const piece = [start];
        seen.add(start);
        let meets = false;
        const round: number[] = [];
        for (let q = 0; q < piece.length; q++) {
          const [i, j] = cellOf.get(piece[q])!;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const n = key(i + di, j + dj);
            if (open.has(n)) {
              if (!seen.has(n)) {
                seen.add(n);
                piece.push(n);
              }
            } else if (standAt(i + di, j + dj) !== null) meets = true;
            else if (building.has(n) && height.has(n)) round.push(height.get(n)!);
          }
        }
        if (!meets) continue;
        round.sort((p, q) => p - q);
        const median = round.length ? round[Math.floor(round.length / 2)] : B.storeys[0] * B.storey;
        const h = Math.max(B.storeys[0], Math.min(B.storeys[1], Math.floor(median / B.storey))) * B.storey;
        for (const k of piece) backOf.set(k, h);
      }
      for (const k of backOf.keys()) open.delete(k);
    }
    for (const k of building.keys()) {
      const h = open.has(k) ? F.open : (backOf.get(k) ?? height.get(k) ?? F.top);
      fills.set(k, [[o.floor, h]]);
      if (building.get(k) === -Infinity && !open.has(k) && !backOf.has(k)) filled.set(k, Math.round(h * 20) / 20);
    }
    for (const [k, spans] of fills) cellSpans.set(k, spans);
    // the backs' cells, and their edges that face where you stand, each edge one cell long: [the line it is on, where
    // along it, the way it faces (0 along x at a z, 1 along z at an x), out (1 or -1), the height you stand at there, the
    // back's height]
    for (const [k, h] of backOf) {
      const [i, j] = cellOf.get(k)!;
      backs.set(k, h);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (backOf.has(key(i + di, j + dj))) continue;
        const at = standAt(i + di, j + dj);
        if (at === null) continue;
        // (a walkway's top varies by centimetres: its lowest, so one front runs the walkway's length)
        const lvl = at > 1 ? F.walkway[0] : 0;
        // a face across x (di) runs along z at the line x = the cell's edge, one across z along x
        edges.push(di !== 0 ? [(di > 0 ? i + 1 : i) * C, j * C, 1, di, lvl, h] : [(dj > 0 ? j + 1 : j) * C, i * C, 0, dj, lvl, h]);
      }
    }
  }
  // the thin made deep enough to stand on, rounded to 5 cm, and grouped by span
  const bySpan = new Map<string, Set<number>>();
  for (const [k, joined] of cellSpans) {
    for (const [a, b] of joined) {
      if (b < o.minTop) continue;
      const y0 = Math.round((b - a < o.thin ? b - o.thin : a) * 20) / 20;
      const y1 = Math.round(b * 20) / 20;
      const sk = `${y0},${y1}`;
      (bySpan.get(sk) ?? bySpan.set(sk, new Set()).get(sk)!).add(k);
    }
  }
  // cells of one span into rectangles, greedily: along i as far as it goes, then down j while the whole row is there
  const rects = (groups: Map<string, Set<number>>, emit: (x0: number, x1: number, z0: number, z1: number, v: number[]) => void): void => {
    for (const [sk, set] of groups) {
      const v = sk.split(",").map(Number);
      const cellsOf = [...set].map((k) => [Math.floor(k / 1000003) - OFF, (k % 1000003) - OFF]).sort((p, q) => p[1] - q[1] || p[0] - q[0]);
      for (const [i, j] of cellsOf) {
        if (!set.has(key(i, j))) continue;
        let i1 = i;
        while (set.has(key(i1 + 1, j))) i1++;
        let j1 = j;
        for (;;) {
          let row = true;
          for (let ii = i; ii <= i1 && row; ii++) if (!set.has(key(ii, j1 + 1))) row = false;
          if (!row) break;
          j1++;
        }
        for (let ii = i; ii <= i1; ii++) for (let jj = j; jj <= j1; jj++) set.delete(key(ii, jj));
        emit(i * C, (i1 + 1) * C, j * C, (j1 + 1) * C, v);
      }
    }
  };
  const solids: number[][] = [];
  rects(bySpan, (x0, x1, z0, z1, [y0, y1]) => solids.push([x0, x1, z0, z1, y0, y1]));
  // What city draws of the buildings' hollow insides, so the film set is closed: `covers`, dark blocks over the hollow
  // cells a cell back from anything drawn (a block over a cell with a face in it stood in front of the face: the brick
  // buildings at the corner's edge were hidden behind one), and `caps`, a roof over the hollow cells beside what is
  // drawn, each [x0, x1, z0, z1, top]
  const inner = new Map<string, Set<number>>();
  const edge = new Map<string, Set<number>>();
  for (const [k, h] of filled) {
    const i = Math.floor(k / 1000003) - OFF;
    const j = (k % 1000003) - OFF;
    const within = [key(i + 1, j), key(i - 1, j), key(i, j + 1), key(i, j - 1)].every((n) => filled.has(n));
    const g = within ? inner : edge;
    (g.get(String(h)) ?? g.set(String(h), new Set()).get(String(h))!).add(k);
  }
  const covers: number[][] = [];
  const caps: number[][] = [];
  rects(inner, (x0, x1, z0, z1, [h]) => covers.push([x0, x1, z0, z1, h]));
  rects(edge, (x0, x1, z0, z1, [h]) => caps.push([x0, x1, z0, z1, h]));
  // the backs as boxes [x0, x1, z0, z1, top], and their fronts as runs of edges on one line facing one way, at one
  // height you stand at and one back's height, joined where they meet: [x0, z0, x1, z1, nx, nz, stand, top]
  const backGroups = new Map<string, Set<number>>();
  for (const [k, h] of backs) (backGroups.get(String(h)) ?? backGroups.set(String(h), new Set()).get(String(h))!).add(k);
  const backBoxes: number[][] = [];
  rects(backGroups, (x0, x1, z0, z1, [h]) => backBoxes.push([x0, x1, z0, z1, h]));
  const fronts: number[][] = [];
  const byLine = new Map<string, number[]>();
  for (const [line, along, axis, out, stand, h] of edges) {
    const lk = `${line},${axis},${out},${stand},${h}`;
    (byLine.get(lk) ?? byLine.set(lk, []).get(lk)!).push(along);
  }
  for (const [lk, list] of byLine) {
    const [line, axis, out, stand, h] = lk.split(",").map(Number);
    list.sort((p, q) => p - q);
    let a = list[0];
    let b = a + C;
    const flush = () => fronts.push(axis === 1 ? [line, a, line, b, out, 0, stand, h] : [a, line, b, line, 0, out, stand, h]);
    for (const v of list.slice(1)) {
      if (Math.abs(v - b) < 1e-6) b = v + C;
      else {
        flush();
        a = v;
        b = v + C;
      }
    }
    flush();
  }
  return { solids, covers, caps, backs: backBoxes, fronts };
}

// ---------------------------------------------------------------- baking and writing
export interface Baked { id: string; groups: Map<string, { mat: string | null; pos: number[]; nrm: number[]; uv: number[]; idx: number[] }>; tris: number; min: Vec3; max: Vec3; faces: Record<string, number>; depths: Record<string, Map<number, number>> }

export function bake(pack: Pack, res: Resolver, id: string, guid: string, mats: Map<string, MatInfo | null>, given?: Array<{ d: Draw; m: M4 }>): Baked | null {
  const draws = given ?? res.flatten(guid);
  if (!draws.length) return null;
  const groups = new Map<string, { mat: string | null; pos: number[]; nrm: number[]; uv: number[]; idx: number[] }>();
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  const faces: Record<string, number> = { px: 0, nx: 0, py: 0, ny: 0, pz: 0, nz: 0 };
  // for each way a face can look, its area by where it stands along that way (10 cm steps): a thick facade module's
  // wall is the plane most of its front area stands on, behind the frames and cornices that stand out of it
  const depths: Record<string, Map<number, number>> = { px: new Map(), nx: new Map(), pz: new Map(), nz: new Map() };
  let tris = 0;
  for (const { d, m } of draws) {
    const mesh = d.model.meshes[d.mesh];
    if (!mesh) continue;
    const { n, det } = normalMat(m);
    mesh.prims.forEach((prim, pi) => {
      let mg = (d.mats ?? [])[pi] ?? (d.mats ?? [])[0] ?? null;
      if (!mg && prim.material) mg = pack.matFor(prim.material);
      // else the material named for the model, its level of detail and side left off: High City's flying car engines
      // ("fly engine L lod0.FBX", its part calling for "cars detz", which no material is) wear "fly engine.mat", and
      // only the first of a model's slots, since the others (its glass, its lights) are what the name is not
      if (!mg && pi === 0) mg = pack.matFor(basename(pack.guidPath.get(d.modelGuid) ?? "", extname(pack.guidPath.get(d.modelGuid) ?? "")).replace(/\s+lod\d+$/i, "").replace(/\s+[lr]$/i, ""));
      // else as Unity names a model's materials by their texture, where its importer says so; and a material the scene
      // takes from inside the model itself (High City's "fill build 09", placed with the FBX's own) is Unity's made from
      // that same texture
      if (mg && /\.fbx$/i.test(pack.guidPath.get(mg) ?? "")) mg = pack.matByTexture(mg);
      if (!mg) mg = pack.matByTexture(d.modelGuid);
      if (!mg) {
        const k = `${basename(pack.guidPath.get(d.modelGuid) ?? "?")} : ${prim.material || "(none)"}`;
        IMPORT_STATS.unresolved.set(k, (IMPORT_STATS.unresolved.get(k) ?? 0) + prim.idx.length / 3);
      }
      if (mg && !mats.has(mg)) mats.set(mg, readMaterial(pack, mg));
      const mi = mg ? mats.get(mg) ?? null : null;
      // (a material found but not read comes out in the grey stand-in as surely as one not found)
      if (mg && !mi) {
        const k = `${basename(pack.guidPath.get(mg) ?? mg)} (for ${basename(pack.guidPath.get(d.modelGuid) ?? "?")})`;
        IMPORT_STATS.unreadable.set(k, (IMPORT_STATS.unreadable.get(k) ?? 0) + prim.idx.length / 3);
      }
      const key = mg ?? "none:" + prim.material;
      if (!groups.has(key)) groups.set(key, { mat: mg, pos: [], nrm: [], uv: [], idx: [] });
      const g = groups.get(key)!;
      const base = g.pos.length / 3;
      const vc = prim.pos.length / 3;
      const [su, sv, ou, ov] = mi?.tiling ?? [1, 1, 0, 0];
      for (let i = 0; i < vc; i++) {
        const x = prim.pos[i * 3], y = prim.pos[i * 3 + 1], z = prim.pos[i * 3 + 2];
        const wx = m[0] * x + m[4] * y + m[8] * z + m[12], wy = m[1] * x + m[5] * y + m[9] * z + m[13], wz = m[2] * x + m[6] * y + m[10] * z + m[14];
        g.pos.push(wx, wy, wz);
        if (wx < min[0]) min[0] = wx; if (wy < min[1]) min[1] = wy; if (wz < min[2]) min[2] = wz;
        if (wx > max[0]) max[0] = wx; if (wy > max[1]) max[1] = wy; if (wz > max[2]) max[2] = wz;
        if (prim.nrm) {
          const a = prim.nrm[i * 3], b = prim.nrm[i * 3 + 1], c = prim.nrm[i * 3 + 2];
          let nx = n[0] * a + n[1] * b + n[2] * c, ny = n[3] * a + n[4] * b + n[5] * c, nz = n[6] * a + n[7] * b + n[8] * c;
          const l = Math.hypot(nx, ny, nz) || 1;
          nx /= l; ny /= l; nz /= l;
          g.nrm.push(nx, ny, nz);
        } else g.nrm.push(0, 1, 0);
        if (prim.uv) {
          // Unity tiles in its own UV space (v up); the glTF's v runs down
          const u = prim.uv[i * 2], vg = prim.uv[i * 2 + 1];
          g.uv.push(u * su + ou, 1 - ((1 - vg) * sv + ov));
        } else g.uv.push(0, 0);
      }
      for (let t = 0; t < prim.idx.length; t += 3) {
        const a = prim.idx[t] + base, b = prim.idx[t + 1] + base, c = prim.idx[t + 2] + base;
        if (det < 0) g.idx.push(a, c, b);
        else g.idx.push(a, b, c);
        // which way the piece's surface faces, by area: a wall's front is the side it shows most
        const p = g.pos;
        const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2];
        const vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
        let cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
        if (det < 0) { cx = -cx; cy = -cy; cz = -cz; }
        const ax = Math.abs(cx), ay = Math.abs(cy), az = Math.abs(cz);
        const area = Math.hypot(cx, cy, cz) / 2;
        const at = (k: number) => (p[a * 3 + k] + p[b * 3 + k] + p[c * 3 + k]) / 3;
        const bin = (dir: string, v: number) => depths[dir].set(Math.round(v * 10), (depths[dir].get(Math.round(v * 10)) ?? 0) + area);
        if (ax >= ay && ax >= az) {
          faces[cx > 0 ? "px" : "nx"] += area;
          bin(cx > 0 ? "px" : "nx", at(0));
        } else if (ay >= az) faces[cy > 0 ? "py" : "ny"] += area;
        else {
          faces[cz > 0 ? "pz" : "nz"] += area;
          bin(cz > 0 ? "pz" : "nz", at(2));
        }
      }
      tris += prim.idx.length / 3;
    });
  }
  if (!Number.isFinite(min[0])) return null;
  return { id, groups, tris, min, max, faces, depths };
}

/**
 * One pack's pieces into a GLB: every texture GPU-compressed as KTX2 (KHR_texture_basisu), colours, glows and the packed
 * occlusion, roughness and metal at `size`, normal maps at `normalSize` (UASTC is four times ETC1S's bytes). Only the
 * pieces in `keep` are written: a GLB loads whole, and half the packs' textures were for pieces the centre never places.
 */
/**
 * Which baked pieces' opaque materials writePack batches (Milestone 657), and how big a batch's biggest array may be. A
 * batch is one primitive: its materials' pictures layers of texture arrays (colour, normal, packed occlusion, roughness
 * and metal, glow), each vertex its material's row in a table of their numbers. The game joins the layers into arrays
 * as the file loads (src/game/neonbatch.ts). Neon City's centre was 441 primitives, one a material, each spanning the
 * whole city, so all of them were drawn whichever way a camera looked: 420 draw calls a frame from the street
 */
export type BatchOpts = { ids: string[]; capMB: number; stats?: { batches: number[]; layers: Record<string, number[]>; left: number } };

export async function writePack(_h: CityImportHelpers, pack: Pack, allBaked: Baked[], mats: Map<string, MatInfo | null>, tex: Textures, size: number, normalSize: number, keep: Set<string>, file: string, meshopt = false, batch?: BatchOpts): Promise<number> {
  const { Document, NodeIO } = await import("@gltf-transform/core");
  const { KHRTextureBasisu } = await import("@gltf-transform/extensions");
  const baked = allBaked.filter((b) => keep.has(b.id));
  const doc = new Document();
  doc.createExtension(KHRTextureBasisu).setRequired(true);
  const buf = doc.createBuffer();
  const scene = doc.createScene(pack.name);
  const matCache = new Map<string, any>();
  const texCache = new Map<string, any>();
  const texture = async (g: string, kind: "color" | "normal" | "emissive"): Promise<any> => {
    const k = g + kind;
    if (texCache.has(k)) return texCache.get(k);
    const b = await tex.ktx2(pack, g, kind === "normal" ? normalSize : size, kind);
    const t = b ? doc.createTexture(basename(pack.guidPath.get(g) ?? g)).setImage(b).setMimeType("image/ktx2") : null;
    texCache.set(k, t);
    return t;
  };
  // every texture this pack's kept pieces need, started at once so the pool keeps every core busy
  const wanted = new Set<string>();
  for (const bk of baked) for (const [, gr] of bk.groups) if (gr.mat) wanted.add(gr.mat);
  await Promise.all(
    [...wanted].flatMap((g) => {
      const mi = mats.get(g);
      if (!mi) return [];
      return [
        mi.map ? tex.ktx2(pack, mi.map, size, "color") : null,
        mi.normal ? tex.ktx2(pack, mi.normal, normalSize, "normal") : null,
        mi.emission && mi.emissive ? tex.ktx2(pack, mi.emissive, size, "emissive") : null,
        tex.ormKtx2(pack, mi, size),
      ].filter(Boolean);
    }),
  );
  const detailLater: Array<{ m: any; dt: any; dn: any; dm: any; xf: number[]; normalScale: number }> = [];
  const material = async (g: string | null, fallbackName: string): Promise<any> => {
    const k = g ?? "none:" + fallbackName;
    if (matCache.has(k)) return matCache.get(k);
    const mi = g ? mats.get(g) ?? null : null;
    const m = doc.createMaterial(`${pack.name}/${mi?.name ?? fallbackName}`);
    if (mi) {
      m.setBaseColorFactor(mi.color).setMetallicFactor(mi.metalGloss ? 1 : mi.metal).setRoughnessFactor(mi.metalGloss ? 1 : 1 - mi.smooth);
      m.setAlphaMode(mi.mode).setAlphaCutoff(mi.cutoff).setDoubleSided(mi.doubleSided);
      if (mi.map) { const t = await texture(mi.map, "color"); if (t) m.setBaseColorTexture(t); }
      if (mi.normal) { const t = await texture(mi.normal, "normal"); if (t) m.setNormalTexture(t).setNormalScale(mi.normalScale); }
      const orm = await tex.ormKtx2(pack, mi, size);
      if (orm) {
        const t = doc.createTexture(`${mi.name} orm`).setImage(orm).setMimeType("image/ktx2");
        m.setMetallicRoughnessTexture(t);
        if (mi.occlusion) m.setOcclusionTexture(t);
        // the map carries the whole roughness and metalness (ormPixels writes the material's own values into it where
        // no gloss map does), so the factors are 1: left at 1 - smooth, Neon City's asphalt (smoothness 0.85 from its
        // colour's alpha) came out at roughness 0.148 squared, a mirror, and the road pale with the sky in it
        m.setMetallicFactor(1).setRoughnessFactor(1);
      }
      // the detail maps ride as textures the material's extras name by index (set once every texture is made, below):
      // the game multiplies them in as Unity's Standard shader does (neonmap.ts)
      if (mi.detail || mi.detailNormal) {
        const dt = mi.detail ? await texture(mi.detail, "color") : null;
        const dn = mi.detailNormal ? await texture(mi.detailNormal, "normal") : null;
        const dm = mi.detailMask ? doc.createTexture(`${mi.name} detail mask`).setImage((await tex.ktx2(pack, mi.detailMask, Math.min(size, 512), "data"))!).setMimeType("image/ktx2") : null;
        // the detail's UV from the stored one (the main's tiling baked in, v flipped to glTF's): u' = a u + b, v' = c v + d
        const [su, sv, ou, ov] = mi.tiling;
        const [dsu, dsv, dou, dov] = mi.detailTiling;
        if (su && sv) {
          const a = dsu / su, c = dsv / sv;
          const xf = [a, dou - ou * a, c, 1 - dov - (1 - ov) * c];
          detailLater.push({ m, dt, dn, dm, xf, normalScale: mi.detailNormalScale });
        }
      }
      if (mi.emission) {
        const peak = Math.max(...mi.emission, 1e-6);
        const f = mi.emission.map((v) => srgbToLinear(Math.min(v / Math.max(peak, 1), 1))) as Vec3;
        m.setEmissiveFactor(f);
        if (mi.emissive) { const t = await texture(mi.emissive, "emissive"); if (t) m.setEmissiveTexture(t); }
        // HDR emission past 1 comes back as a strength the game multiplies by (glTF extras reach material.userData)
        m.setExtras({ emissiveStrength: Math.max(1, peak) });
      }
      // the particle shaders' look rides in extras too: the game draws these unlit and added (detailmaps.ts applyUnityLooks)
      if (mi.unlit || mi.additive) m.setExtras({ ...(m.getExtras() ?? {}), unlit: mi.unlit, additive: mi.additive });
    } else m.setBaseColorFactor([0.55, 0.57, 0.6, 1]).setRoughnessFactor(0.8).setMetallicFactor(0);
    matCache.set(k, m);
    return m;
  };
  // (the batches' layers and the stand-in normal map each batch's material names, set once every texture is made)
  const batchLater: Array<{ m: any; layers: Record<string, any[]>; extras: Record<string, unknown> }> = [];
  /** the opaque, lit, detail-less materials a batch can draw (the rest keep a primitive each, as before) */
  const batchable = (g: { mat: string | null }): boolean => {
    const mi = g.mat ? mats.get(g.mat) : null;
    return !!mi && mi.mode === "OPAQUE" && !mi.unlit && !mi.additive && !mi.detail && !mi.detailNormal;
  };
  /** one batch's primitive: its materials' geometry merged, each vertex its material's row; its arrays' layers */
  const batchPrim = async (part: Array<{ mat: string | null; pos: number[]; nrm: number[]; uv: number[]; idx: number[] }>, k: number): Promise<any> => {
    // layer 0 of every array is neutral, read by a material with no picture of that kind (its factor alone then counts)
    const neutral = {
      color: await tex.solidKtx2([255, 255, 255], size, "color"),
      normal: await tex.solidKtx2([128, 128, 255], normalSize, "normal"),
      orm: await tex.solidKtx2([255, 255, 255], size, "data"),
      emissive: await tex.solidKtx2([255, 255, 255], size, "emissive"),
    } as Record<string, Uint8Array | null>;
    const layers: Record<string, any[]> = {};
    const seen = new Map<string, number>();
    for (const [kind, bytes] of Object.entries(neutral)) layers[kind] = [doc.createTexture(`batch ${k} ${kind} 0`).setImage(bytes!).setMimeType("image/ktx2")];
    const layer = async (kind: string, key: string | null, make: () => Promise<Uint8Array | null>): Promise<number> => {
      if (!key) return 0;
      if (seen.has(kind + key)) return seen.get(kind + key)!;
      const bytes = await make();
      const at = bytes ? layers[kind].push(doc.createTexture(`batch ${k} ${kind} ${layers[kind].length}`).setImage(bytes).setMimeType("image/ktx2")) - 1 : 0;
      seen.set(kind + key, at);
      return at;
    };
    const [pos, nrm, uv, idx, mid, table]: number[][] = [[], [], [], [], [], []];
    for (const [j, g] of part.entries()) {
      const mi = mats.get(g.mat!)!;
      const lc = await layer("color", mi.map, () => tex.layerKtx2(pack, mi.map!, size, "color"));
      const ln = await layer("normal", mi.normal, () => tex.layerKtx2(pack, mi.normal!, normalSize, "normal"));
      const lo = await layer("orm", tex.ormKey(pack, mi, size), () => tex.ormLayerKtx2(pack, mi, size));
      const le = mi.emission && mi.emissive ? await layer("emissive", mi.emissive, () => tex.layerKtx2(pack, mi.emissive!, size, "emissive")) : 0;
      // its numbers as its own material's were (material(), above): the factors 1 where the packed map carries them
      const [metal, rough] = lo ? [1, 1] : [mi.metalGloss ? 1 : mi.metal, mi.metalGloss ? 1 : 1 - mi.smooth];
      let glow = [0, 0, 0];
      if (mi.emission) {
        const peak = Math.max(...mi.emission, 1e-6);
        glow = mi.emission.map((v) => srgbToLinear(Math.min(v / Math.max(peak, 1), 1)) * Math.max(1, peak));
      }
      // a row: the colour; the glow and the normal's scale; roughness, metal, occlusion's strength; the four layers
      table.push(...mi.color, ...glow, ln ? mi.normalScale : 1, rough, metal, lo && mi.occlusion ? 1 : 0, 0, lc, ln, lo, le);
      const base = pos.length / 3;
      for (let i = 0; i < g.pos.length; i++) pos.push(g.pos[i]);
      for (let i = 0; i < g.nrm.length; i++) nrm.push(g.nrm[i]);
      for (let i = 0; i < g.uv.length; i++) uv.push(g.uv[i]);
      for (let i = 0; i < g.idx.length; i++) idx.push(g.idx[i] + base);
      for (let i = 0; i < g.pos.length / 3; i++) mid.push(j);
    }
    // (its material in the file: white, the factors 1, and a stand-in normal map, so the loader makes the game's material
    // with a normal map's tangent frame and its scale's sign as it does every other's; the game draws the rest)
    const stand = await tex.solidKtx2([128, 128, 255], 4, "normal");
    const m = doc.createMaterial(`${pack.name}/batch ${k}`).setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(1).setRoughnessFactor(1);
    m.setNormalTexture(doc.createTexture(`batch ${k} stand-in normal`).setImage(stand!).setMimeType("image/ktx2"));
    batchLater.push({ m, layers, extras: { k, rows: part.length, width: 4, table: table.map((v) => +v.toFixed(5)) } });
    if (batch!.stats) {
      batch!.stats.batches.push(part.length);
      for (const [kind, list] of Object.entries(layers)) (batch!.stats.layers[kind] ??= []).push(list.length);
    }
    const vcount = pos.length / 3;
    return doc
      .createPrimitive()
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(pos)).setBuffer(buf))
      .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(new Float32Array(nrm)).setBuffer(buf))
      .setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(new Float32Array(uv)).setBuffer(buf))
      .setAttribute("_MATID", doc.createAccessor().setType("SCALAR").setArray(new Float32Array(mid)).setBuffer(buf))
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(vcount < 65536 ? new Uint16Array(idx) : new Uint32Array(idx)).setBuffer(buf))
      .setMaterial(m);
  };
  for (const b of baked) {
    const mesh = doc.createMesh(b.id);
    // a batched piece's opaque materials in batches, as many to a batch as its biggest array (the colour's, mips and
    // all at a byte a pixel, BC7's) holds under `capMB` with its neutral layer, and never past 255 and that layer
    // (WebGL 2's least 256)
    const batched = batch?.ids.includes(b.id) ? [...b.groups.values()].filter(batchable).sort((p, q) => mats.get(p.mat!)!.name.localeCompare(mats.get(q.mat!)!.name)) : [];
    if (batched.length) {
      const per = Math.max(1, Math.min(255, Math.floor((batch!.capMB * 1e6) / ((size * size * 4) / 3)) - 1));
      for (let k = 0; k * per < batched.length; k++) mesh.addPrimitive(await batchPrim(batched.slice(k * per, (k + 1) * per), k));
      if (batch!.stats) batch!.stats.left = [...b.groups.values()].length - batched.length;
    }
    for (const [, g] of b.groups) {
      if (batched.includes(g)) continue;
      const vcount = g.pos.length / 3;
      const prim = doc
        .createPrimitive()
        .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(g.pos)).setBuffer(buf))
        .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(new Float32Array(g.nrm)).setBuffer(buf))
        .setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(new Float32Array(g.uv)).setBuffer(buf))
        .setIndices(doc.createAccessor().setType("SCALAR").setArray(vcount < 65536 ? new Uint16Array(g.idx) : new Uint32Array(g.idx)).setBuffer(buf))
        .setMaterial(await material(g.mat, `${b.id}#none`));
      mesh.addPrimitive(prim);
    }
    // three.js strips "/", "." and ":" from node names on load, so the id rides in extras (userData.id)
    scene.addChild(doc.createNode(b.id).setMesh(mesh).setExtras({ id: b.id }));
  }
  // the detail maps by their images' indexes, now every image is made (an image's index is its place in the file's list):
  // each held by a material no mesh uses, as a picture only a material's extras name gets no texture entry to load by
  {
    const list = doc.getRoot().listTextures();
    for (const q of detailLater) {
      if (!q.dt && !q.dn && !q.dm) continue;
      const holder = doc.createMaterial(`${q.m.getName()} detail`);
      if (q.dt) holder.setBaseColorTexture(q.dt);
      if (q.dn) holder.setNormalTexture(q.dn);
      if (q.dm) holder.setOcclusionTexture(q.dm);
      q.m.setExtras({ ...(q.m.getExtras() ?? {}), detail: { map: q.dt ? list.indexOf(q.dt) : -1, normal: q.dn ? list.indexOf(q.dn) : -1, mask: q.dm ? list.indexOf(q.dm) : -1, xf: q.xf.map((v) => +v.toFixed(5)), normalScale: q.normalScale } });
    }
  }
  // the batches' layers by their images' indexes, each held by a material no mesh uses as the detail maps are
  {
    const list = doc.getRoot().listTextures();
    const slots = ["setBaseColorTexture", "setNormalTexture", "setOcclusionTexture", "setEmissiveTexture", "setMetallicRoughnessTexture"];
    for (const q of batchLater) {
      const all = Object.values(q.layers).flat();
      for (let i = 0; i < all.length; i += slots.length) {
        const holder = doc.createMaterial(`${q.m.getName()} layers ${i / slots.length}`);
        all.slice(i, i + slots.length).forEach((t, s) => (holder as unknown as Record<string, (x: unknown) => void>)[slots[s]](t));
      }
      q.m.setExtras({ batch: { ...q.extras, layers: Object.fromEntries(Object.entries(q.layers).map(([kind, ts]) => [kind, ts.map((t) => list.indexOf(t))])) } });
    }
  }
  mkdirSync(dirname(file), { recursive: true });
  // the IO writes only the extensions registered with it: unregistered, the KTX2 images went out as plain ones
  if (!meshopt) {
    await new NodeIO().registerExtensions([KHRTextureBasisu]).write(file, doc);
    return statSync(file).size;
  }
  // Its geometry meshopt-compressed (EXT_meshopt_compression, the filter method: positions and texture coordinates as
  // they are, normals to 8 bits): a district's 601k triangles were 31 MB of its 51, the textures 20
  const { EXTMeshoptCompression } = await import("@gltf-transform/extensions");
  const { MeshoptEncoder } = await import("meshoptimizer");
  await MeshoptEncoder.ready;
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  await new NodeIO().registerExtensions([KHRTextureBasisu, EXTMeshoptCompression]).registerDependencies({ "meshopt.encoder": MeshoptEncoder }).write(file, doc);
  return statSync(file).size;
}
