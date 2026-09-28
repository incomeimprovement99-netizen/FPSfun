// The city bundle made into what the city draws (docs/CITY_BUNDLE_IMPLEMENTATION.md section 7).
//
// IL.ranch's five cyberpunk packs are Unity packages: a kit's real pieces are its prefabs, each
// assembling several meshes from its FBX files (a shop front is 17 to 39 of them), so each prefab
// in src/config/citykit.json is rebuilt from its Unity YAML and baked into one piece: its finest
// level of detail, merged by material, in the prefab's own space. A pack's pieces go into one GLB
// with their textures inside it, twice: at `sizes.hi` for the medium and high graphics presets and
// at `sizes.lo` for low. What each piece measures (its bounds and triangles) is written back into
// citykit.json's `measured`, because the city places the kit by those numbers and CLAUDE.md wants
// every number about a model measured off it.
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
const IMPORT_STATS = { unplacedOverrides: 0, unresolved: new Map<string, number>(), unreadable: new Map<string, number>() };

export interface CityImportHelpers {
  root: string;
  paid: string;
  out: string;
  unpack(pkg: string, name: string): Map<string, string>;
  readTga(file: string): { data: Buffer; width: number; height: number; channels: 3 | 4 };
  fbx2gltf(): string;
}

type Vec3 = [number, number, number];
type Quat = [number, number, number, number];
type M4 = number[];

const MASK = 0x7fffffffffffffffn;
const ROOT_T = -8679921383154817045n; // a model prefab's root Transform
const ROOT_G = 919132149155446097n; // a model prefab's root GameObject
const LOD_N = /lod\s*_?[1-9]/i;
const I4: M4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const num = (v: unknown, d = 0): number => (v === undefined || v === null ? d : typeof v === "bigint" ? Number(v) : Number(v));
const big = (v: unknown): bigint | null => (v === undefined || v === null ? null : typeof v === "bigint" ? v : BigInt(Math.trunc(Number(v))));

function trs(t: Vec3, q: Quat, s: Vec3): M4 {
  const [x, y, z, w] = q;
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [
    (1 - 2 * (yy + zz)) * s[0], 2 * (xy + wz) * s[0], 2 * (xz - wy) * s[0], 0,
    2 * (xy - wz) * s[1], (1 - 2 * (xx + zz)) * s[1], 2 * (yz + wx) * s[1], 0,
    2 * (xz + wy) * s[2], 2 * (yz - wx) * s[2], (1 - 2 * (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}
function mul(a: M4, b: M4): M4 {
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

// ---------------------------------------------------------------- a pack's Unity side
class Pack {
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
interface RawPrim { pos: Float32Array; nrm: Float32Array | null; uv: Float32Array | null; idx: Uint32Array; material: string }
interface RawModel { meshes: Array<{ name: string; prims: RawPrim[] }>; nodes: Array<{ name: string; mesh: number | null; t: Vec3; r: Quat; s: Vec3; kids: number[]; parent: number | null }>; roots: number[] }

class Models {
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
    if (src && /\.fbx$/i.test(p)) {
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
    }
    this.cache.set(key, model);
    return model;
  }
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
function meshIndex(pack: Pack, model: RawModel, guid: string, fid: bigint | null, goName: string): number | null {
  const want = (fid !== null && pack.meshNames(guid).get(fid)) || goName;
  let i = model.meshes.findIndex((m) => m.name === want);
  if (i >= 0) return i;
  const n = model.nodes.find((x) => x.name === want && x.mesh !== null);
  if (n) return n.mesh;
  return model.meshes.length === 1 ? 0 : null;
}

// ---------------------------------------------------------------- a prefab, rebuilt
interface Draw { model: RawModel; mesh: number; pre: M4 | null; mats: Array<string | null> | null; modelGuid: string; on: boolean; go: bigint | null }
class TNode {
  t: Vec3 = [0, 0, 0];
  r: Quat = [0, 0, 0, 1];
  s: Vec3 = [1, 1, 1];
  kids: TNode[] = [];
  draws: Draw[] = [];
  active = true;
  parent: TNode | null = null;
  constructor(public name = "") {}
}
const u2tPos = (p: any): Vec3 => [-num(p?.x), num(p?.y), num(p?.z)];
const u2tRot = (q: any): Quat => [num(q?.x), -num(q?.y), -num(q?.z), num(q?.w, 1)];

class Resolver {
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
        if (mi === null) continue;
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
  flatten(guid: string): Array<{ d: Draw; m: M4 }> {
    const { roots } = this.instantiate(guid);
    const out: Array<{ d: Draw; m: M4 }> = [];
    const walk = (n: TNode, pm: M4): void => {
      if (!n.active || LOD_N.test(n.name)) return;
      const m = mul(pm, trs(n.t, n.r, n.s));
      for (const d of n.draws) if (d.on) out.push({ d, m: d.pre ? mul(m, d.pre) : m });
      for (const k of n.kids) walk(k, m);
    };
    for (const r of roots) walk(r, I4);
    return out;
  }
}

// ---------------------------------------------------------------- materials and textures
interface MatInfo {
  name: string;
  map: string | null; normal: string | null; emissive: string | null; metalGloss: string | null; occlusion: string | null;
  color: [number, number, number, number]; emission: [number, number, number] | null;
  metal: number; smooth: number; normalScale: number;
  /** URP's specular workflow (_WorkflowMode 0): metalGloss is then its specular map, colour in RGB, smoothness in A */
  specular: boolean;
  mode: "OPAQUE" | "MASK" | "BLEND"; cutoff: number; doubleSided: boolean;
  tiling: [number, number, number, number];
}
function readMaterial(pack: Pack, guid: string): MatInfo | null {
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
    const surface = flt(["_Surface"], 0);
    const mode = flt(["_Mode"], 0);
    const clip = flt(["_AlphaClip"], 0) === 1 || /_ALPHATEST_ON/.test(kw) || mode === 1;
    const cull = flt(["_Cull", "_CullMode"], 2);
    return {
      name: String(d.m_Name ?? guid),
      map: base?.guid ?? null,
      normal: tex(["_BumpMap", "_NormalMap"])?.guid ?? null,
      emissive: emitting ? emissiveTex?.guid ?? null : null,
      // (the specular workflow's map in the same place: Glass City's machinery is drawn with it, and without it every
      // pipe read as smoothness 1 and mirrored the sky, white)
      metalGloss: (flt(["_WorkflowMode"], 1) === 0 ? tex(["_SpecGlossMap"]) : tex(["_MetallicGlossMap", "_MaskMap"]))?.guid ?? null,
      specular: flt(["_WorkflowMode"], 1) === 0,
      occlusion: tex(["_OcclusionMap"])?.guid ?? null,
      color: [srgbToLinear(num(c.r, 1)), srgbToLinear(num(c.g, 1)), srgbToLinear(num(c.b, 1)), num(c.a, 1)],
      emission: emitting && e ? [num(e.r), num(e.g), num(e.b)] : emitting ? [1, 1, 1] : null,
      metal: flt(["_Metallic"], 0),
      smooth: flt(["_Smoothness", "_Glossiness"], 0.5),
      normalScale: flt(["_BumpScale"], 1),
      mode: surface === 1 || mode === 2 || mode === 3 ? "BLEND" : clip ? "MASK" : "OPAQUE",
      cutoff: flt(["_Cutoff"], 0.5),
      doubleSided: cull === 0,
      tiling: base ? [base.scale[0], base.scale[1], base.offset[0], base.offset[1]] : [1, 1, 0, 0],
    };
  }
  return null;
}

initializeCanvas(() => ({ width: 1, height: 1, getContext: () => ({ createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) }) }) as any);

class Textures {
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
  /** the packed occlusion, roughness and metal (orm) as KTX2 */
  ormKtx2(pack: Pack, mi: MatInfo, size: number): Promise<Uint8Array | null> {
    const key = `${pack.name}/${mi.metalGloss}/${mi.occlusion}/${size}/${mi.smooth}/${mi.metal}/orm`;
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
    if (!mi.metalGloss && !mi.occlusion) return null;
    const mg = mi.metalGloss ? await this.decode(pack, mi.metalGloss) : null;
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
      rgb[i * 3 + 2] = a ? (mi.specular ? Math.round(Math.min(1, Math.max(0, ((a[i * 4] + a[i * 4 + 1] + a[i * 4 + 2]) / 765 - 0.2) / 0.5)) * 255) : a[i * 4]) : Math.round(mi.metal * 255);
    }
    return { rgb, w, h };
  }
}

// ---------------------------------------------------------------- a demo street cut into its buildings (Phase 24.2)
/**
 * The packs have no whole-building prefab: their buildings exist only as their artists assembled them in the demo
 * streets, hundreds of placed pieces each. This finds them. Every placed part's world bounds and triangles; the heavy
 * ones (walls, not cables, lamps or litter) rasterised onto a ground grid of `cell` metres, a cell solid when its parts'
 * triangles over it are many and they rise above the street; connected solid cells are a building, the streets and
 * squares between them the gaps. Each building then takes every part whose middle stands over it, cables and litter
 * included, so it comes out whole with what hangs on it. The street's height is where the most ground-level geometry is.
 */
function cutBuildings(draws: Array<{ d: Draw; m: M4 }>, cell = 2): Array<{ draws: Array<{ d: Draw; m: M4 }>; footprint: [number, number, number, number]; street: number }> {
  type Part = { i: number; min: Vec3; max: Vec3; tris: number };
  const parts: Part[] = [];
  draws.forEach(({ d, m }, i) => {
    const mesh = d.model.meshes[d.mesh];
    if (!mesh) return;
    const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
    let tris = 0;
    for (const prim of mesh.prims) {
      tris += prim.idx ? prim.idx.length / 3 : prim.pos.length / 9;
      for (let k = 0; k < prim.pos.length; k += 3) {
        const x = prim.pos[k], y = prim.pos[k + 1], z = prim.pos[k + 2];
        const w: Vec3 = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
        for (let a = 0; a < 3; a++) {
          if (w[a] < min[a]) min[a] = w[a];
          if (w[a] > max[a]) max[a] = w[a];
        }
      }
    }
    if (Number.isFinite(min[0])) parts.push({ i, min, max, tris });
  });
  // the street's height: the lowest level most parts stand on
  const feet = new Map<number, number>();
  for (const p of parts) feet.set(Math.round(p.min[1]), (feet.get(Math.round(p.min[1])) ?? 0) + 1);
  const street = [...feet].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  // a wall part: tall enough to be a storey's, not a long thin run (a cable, a rail), standing on or above the street
  const isWall = (p: Part) => {
    const w = p.max[0] - p.min[0], h = p.max[1] - p.min[1], d = p.max[2] - p.min[2];
    // (a pole, a lamp, a hanging sign is narrow both ways; a module of wall is wide one way at least)
    return h >= 2.5 && Math.max(w, d) >= 1.5 && Math.min(w, d) <= 6 && Math.max(w, d) <= 30 && p.min[1] > street - 3;
  };
  const key = (cx: number, cz: number) => cx * 100003 + cz;
  // a cell is a building's where wall parts stack there: three and more, over six metres of height and more (a walkway
  // or a sign over the street is one or two parts, at one height)
  const stack = new Map<number, { n: number; lo: number; hi: number }>();
  for (const p of parts.filter(isWall)) {
    const [x0, x1, z0, z1] = [Math.floor(p.min[0] / cell), Math.floor(p.max[0] / cell), Math.floor(p.min[2] / cell), Math.floor(p.max[2] / cell)];
    for (let cx = x0; cx <= x1; cx++)
      for (let cz = z0; cz <= z1; cz++) {
        const s = stack.get(key(cx, cz)) ?? { n: 0, lo: Infinity, hi: -Infinity };
        s.n++;
        s.lo = Math.min(s.lo, p.min[1]);
        s.hi = Math.max(s.hi, p.max[1]);
        stack.set(key(cx, cz), s);
      }
  }
  const solid = new Map<number, number>();
  for (const [k, s] of stack) if (s.n >= 3 && s.hi - s.lo >= 6) solid.set(k, s.n);
  if (process.env.CUT_DEBUG) {
    const ks = [...stack.keys()].map((k) => [Math.round(k / 100003), k - Math.round(k / 100003) * 100003]);
    const [x0, x1, z0, z1] = [Math.min(...ks.map((q) => q[0])), Math.max(...ks.map((q) => q[0])), Math.min(...ks.map((q) => q[1])), Math.max(...ks.map((q) => q[1]))];
    const rows: string[] = [];
    for (let cz = z0; cz <= z1; cz++) {
      let r = "";
      for (let cx = x0; cx <= x1; cx++) {
        const s = stack.get(key(cx, cz));
        r += !s ? " " : solid.has(key(cx, cz)) ? (s.hi - s.lo > 20 ? "#" : "+") : ".";
      }
      rows.push(r);
    }
    console.log(`cut grid (x ${x0 * cell}..${x1 * cell}, z ${z0 * cell}..${z1 * cell}, street ${street}):` + String.fromCharCode(10) + rows.join(String.fromCharCode(10)));
  }
  // connected solid cells (4-connected), each a building's footprint
  const seen = new Set<number>();
  const blobs: Array<{ cells: Array<[number, number]> }> = [];
  for (const k of solid.keys()) {
    if (seen.has(k)) continue;
    const cx0 = Math.round(k / 100003), cz0 = k - cx0 * 100003;
    const cells: Array<[number, number]> = [];
    const todo: Array<[number, number]> = [[cx0, cz0]];
    seen.add(k);
    while (todo.length) {
      const [cx, cz] = todo.pop()!;
      cells.push([cx, cz]);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = key(cx + dx, cz + dz);
        if (solid.has(n) && !seen.has(n)) (seen.add(n), todo.push([cx + dx, cz + dz]));
      }
    }
    if (cells.length >= 12) blobs.push({ cells });
  }
  // every part to the building its middle stands over (within a cell of it)
  const owner = new Map<number, number>();
  blobs.forEach((bl, bi) => bl.cells.forEach(([cx, cz]) => owner.set(key(cx, cz), bi)));
  const out = blobs.map((bl) => {
    const xs = bl.cells.map((c) => c[0]), zs = bl.cells.map((c) => c[1]);
    return { draws: [] as Array<{ d: Draw; m: M4 }>, footprint: [Math.min(...xs) * cell, (Math.max(...xs) + 1) * cell, Math.min(...zs) * cell, (Math.max(...zs) + 1) * cell] as [number, number, number, number], street };
  });
  for (const p of parts) {
    const cx = Math.floor(((p.min[0] + p.max[0]) / 2) / cell), cz = Math.floor(((p.min[2] + p.max[2]) / 2) / cell);
    let b2: number | undefined;
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if ((b2 = owner.get(key(cx + dx, cz + dz))) !== undefined) break;
    if (b2 !== undefined) out[b2].draws.push(draws[p.i]);
  }
  return out.filter((o) => o.draws.length >= 10);
}

/**
 * A demo street's walls as facade strips (Phase 24.2). The demo streets are film sets, built only on the sides the
 * camera sees, so their buildings cannot be lifted whole; their faces can, and a face is what the packs' artists composed:
 * wall modules with balconies, fire escapes, pipes, AC units and signs on them. So: the wall modules (wide one way, thin
 * the other, a storey tall and more), each's facing from its triangles' normals and its back plane; modules sharing a
 * facing and a plane (to the metre) are one wall, runs along it where they meet; everything that stands in front of a run
 * (up to `reach` metres out) hangs on it; each run cut into strips of about `width` metres at module edges. A strip is
 * returned in its own frame: x along the wall from its left as you face it, y up from its foot, z out of the wall.
 */
function cutFacades(draws: Array<{ d: Draw; m: M4 }>, width = 14, reach = 4): Array<{ draws: Array<{ d: Draw; m: M4 }>; width: number; height: number; wall: number; from: string }> {
  type Part = { i: number; min: Vec3; max: Vec3; n: [number, number]; area: number; sn: [number, number] };
  const parts: Part[] = [];
  draws.forEach(({ d, m }, i) => {
    const mesh = d.model.meshes[d.mesh];
    if (!mesh) return;
    const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
    let nx = 0, nz = 0, area = 0;
    // the way its surfaces face, signed, from the model's own normals: a module's front has most of its detail
    const { n: nm } = normalMat(m);
    let snx = 0, snz = 0;
    const w = (pos: Float32Array, k: number): Vec3 => {
      const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
      return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
    };
    for (const prim of mesh.prims) {
      if (prim.nrm)
        for (let k = 0; k < prim.nrm.length; k += 3) {
          const a = prim.nrm[k], bb = prim.nrm[k + 1], c = prim.nrm[k + 2];
          snx += nm[0] * a + nm[1] * bb + nm[2] * c;
          snz += nm[6] * a + nm[7] * bb + nm[8] * c;
        }
      for (let k = 0; k < prim.pos.length / 3; k++) {
        const v = w(prim.pos, k);
        for (let a = 0; a < 3; a++) {
          if (v[a] < min[a]) min[a] = v[a];
          if (v[a] > max[a]) max[a] = v[a];
        }
      }
      for (let t = 0; t + 2 < prim.idx.length; t += 3) {
        const A = w(prim.pos, prim.idx[t]), B = w(prim.pos, prim.idx[t + 1]), C = w(prim.pos, prim.idx[t + 2]);
        const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
        // (the mirror in the node chain flips winding; the sign is taken from the part's extent below instead)
        const cx = uy * vz - uz * vy, cz = ux * vy - uy * vx, cy = uz * vx - ux * vz;
        const len = Math.hypot(cx, cy, cz);
        area += len / 2;
        nx += Math.abs(cx) / 2;
        nz += Math.abs(cz) / 2;
      }
    }
    if (Number.isFinite(min[0])) parts.push({ i, min, max, n: [nx, nz], area, sn: [snx, snz] });
  });
  const feet = new Map<number, number>();
  for (const p of parts) feet.set(Math.round(p.min[1]), (feet.get(Math.round(p.min[1])) ?? 0) + 1);
  const street = [...feet].sort((a, c) => c[1] - a[1])[0]?.[0] ?? 0;
  // a wall module: a storey tall and more, wide along one axis, thin across it, its faces mostly across (its facing)
  const walls: Array<{ p: Part; axis: 0 | 2; plane: number }> = [];
  for (const p of parts) {
    const sx = p.max[0] - p.min[0], sy = p.max[1] - p.min[1], sz = p.max[2] - p.min[2];
    if (sy < 2.5) continue;
    if (sx >= 2 && sz <= 1.8 && p.n[1] > p.n[0]) walls.push({ p, axis: 2, plane: 0 });
    else if (sz >= 2 && sx <= 1.8 && p.n[0] > p.n[1]) walls.push({ p, axis: 0, plane: 0 });
  }
  // which side of a wall is the street's: the side with less wall mass within 12 m (a building's inside is its walls)
  const massAt = (axis: 0 | 2, c: number, a0: number, a1: number, y0: number, y1: number) =>
    walls.filter((q) => q.axis === axis && q.p.min[1] < y1 && q.p.max[1] > y0 && q.p.max[axis === 0 ? 2 : 0] > a0 && q.p.min[axis === 0 ? 2 : 0] < a1 && Math.abs((q.p.min[axis] + q.p.max[axis]) / 2 - c) < 12).length;
  type Wall = { axis: 0 | 2; dir: 1 | -1; plane: number; parts: Part[] };
  const groups = new Map<string, Wall>();
  for (const q of walls) {
    const along = q.axis === 0 ? 2 : 0;
    const mid = (q.p.min[q.axis] + q.p.max[q.axis]) / 2;
    // facing: its normals' sum across the wall; where they cancel, the side with less wall mass is the street's
    const sn = q.axis === 0 ? q.p.sn[0] : q.p.sn[1];
    const inFront = massAt(q.axis, mid + 6, q.p.min[along], q.p.max[along], q.p.min[1], q.p.max[1]);
    const behind = massAt(q.axis, mid - 6, q.p.min[along], q.p.max[along], q.p.min[1], q.p.max[1]);
    const dir: 1 | -1 = Math.abs(sn) > 1 ? (sn > 0 ? 1 : -1) : inFront <= behind ? 1 : -1;
    // the wall's plane: its back, the side away from the street
    const plane = dir > 0 ? q.p.min[q.axis] : q.p.max[q.axis];
    const k = `${q.axis}:${dir}:${Math.round(plane)}`;
    const g = groups.get(k) ?? { axis: q.axis, dir, plane, parts: [] };
    g.parts.push(q.p);
    groups.set(k, g);
  }
  const used = new Set<number>();
  const out: Array<{ draws: Array<{ d: Draw; m: M4 }>; width: number; height: number; wall: number; from: string }> = [];
  for (const g of [...groups.values()].sort((p, q) => q.parts.length - p.parts.length)) {
    const along = g.axis === 0 ? 2 : 0;
    const plane = g.parts.reduce((a, p) => a + (g.dir > 0 ? p.min[g.axis] : p.max[g.axis]), 0) / g.parts.length;
    // runs along the wall where its modules meet
    const spans = g.parts.map((p) => [p.min[along], p.max[along]] as [number, number]).sort((p, q) => p[0] - q[0]);
    const runs: Array<[number, number]> = [];
    for (const s of spans) {
      const r = runs[runs.length - 1];
      if (r && s[0] <= r[1] + 1.5) r[1] = Math.max(r[1], s[1]);
      else runs.push([s[0], s[1]]);
    }
    for (const [r0, r1] of runs) {
      if (r1 - r0 < 6) continue;
      // cut at module edges near every `width` metres
      const edges = [...new Set(g.parts.flatMap((p) => [p.min[along], p.max[along]]).filter((e) => e > r0 + 1 && e < r1 - 1))].sort((p, q) => p - q);
      const cuts = [r0];
      while (r1 - cuts[cuts.length - 1] > width * 1.5) {
        const want = cuts[cuts.length - 1] + width;
        const e = edges.reduce((best, x) => (Math.abs(x - want) < Math.abs(best - want) ? x : best), want);
        cuts.push(e > cuts[cuts.length - 1] + 4 ? e : want);
      }
      cuts.push(r1);
      for (let c = 0; c + 1 < cuts.length; c++) {
        const [a0, a1] = [cuts[c], cuts[c + 1]];
        // what stands on this stretch of wall: its modules and everything in front of it within reach
        const mine = parts.filter((p) => {
          if (used.has(p.i)) return false;
          const ac = (p.min[along] + p.max[along]) / 2;
          if (ac < a0 || ac >= a1) return false;
          const front = g.dir > 0 ? p.max[g.axis] - plane : plane - p.min[g.axis];
          const back = g.dir > 0 ? p.min[g.axis] - plane : plane - p.max[g.axis];
          return back > -0.6 && front < reach + 0.6;
        });
        const wallParts = mine.filter((p) => g.parts.includes(p));
        if (wallParts.length < 3) continue;
        const y0 = Math.min(...wallParts.map((p) => p.min[1]));
        const y1 = Math.max(...mine.map((p) => p.max[1]));
        const wallArea = wallParts.reduce((a, p) => a + (p.max[along] - p.min[along]) * (p.max[1] - p.min[1]), 0);
        const cover = wallArea / Math.max(1, (a1 - a0) * (y1 - y0));
        if (y1 - y0 < 8 || cover < 0.45) continue;
        for (const p of mine) used.add(p.i);
        // the strip's frame: its left edge (as you face the wall), its foot, the plane; z out of the wall
        const s = g.dir;
        let T: M4;
        if (g.axis === 2) {
          // facing +z (dir 1): x along +x from a0; facing -z: x along -x from a1, z flipped
          T = s > 0 ? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -a0, -y0, -plane, 1] : [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, a1, -y0, plane, 1];
        } else {
          // facing +x: x along -z from a1 (the left as you face +x is +z... ) and z = world x
          T = s > 0 ? [0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, a1, -y0, -plane, 1] : [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, -a0, -y0, plane, 1];
        }
        out.push({ draws: mine.map((p) => ({ d: draws[p.i].d, m: mul(T, draws[p.i].m) })), width: a1 - a0, height: y1 - y0, wall: cover, from: `${g.axis === 0 ? "x" : "z"}${s > 0 ? "+" : "-"} ${plane.toFixed(1)} ${a0.toFixed(1)}..${a1.toFixed(1)} y ${(y0 - street).toFixed(1)}` });
      }
    }
  }
  return out;
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
function districtSolids(draws: Array<{ d: Draw; m: M4 }>, o: { cell: number; stick: number; floor: number; merge: number; thin: number; minTop: number; fill?: { walkway: [number, number]; top: number; half: number; body: number; plan: number[][]; seeds: number[][]; streets?: number[][] } }): number[][] {
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
        // any other, its building to the fill's top
        else fills.set(k, [[o.floor, Math.max(F.top, ...tops)]]);
      }
    for (const [k, spans] of fills) cellSpans.set(k, spans);
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
  const out: number[][] = [];
  for (const [sk, set] of bySpan) {
    const [y0, y1] = sk.split(",").map(Number);
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
      out.push([i * C, (i1 + 1) * C, j * C, (j1 + 1) * C, y0, y1]);
    }
  }
  return out;
}

// ---------------------------------------------------------------- baking and writing
interface Baked { id: string; groups: Map<string, { mat: string | null; pos: number[]; nrm: number[]; uv: number[]; idx: number[] }>; tris: number; min: Vec3; max: Vec3; faces: Record<string, number>; depths: Record<string, Map<number, number>> }

function bake(pack: Pack, res: Resolver, id: string, guid: string, mats: Map<string, MatInfo | null>, given?: Array<{ d: Draw; m: M4 }>, simplify = 0): Baked | null {
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
  // A demo street's strip was modelled for a camera a few metres off: its cables, pipes, railings and round parts carry
  // four to ten times the triangles of the walls they hang on (Kyber's heaviest, 157 a square metre). Simplified to
  // `simplify` metres of error, the edges of every part and every seam in its UVs held where they are, so the walls, their
  // windows and the textures' joins do not move and only the dense round things lose what a player cannot see.
  if (simplify && SIMPLIFIER) {
    tris = 0;
    for (const g of groups.values()) {
      const pos = new Float32Array(g.pos);
      const scale = SIMPLIFIER.getScale(pos, 3) || 1;
      const [out] = SIMPLIFIER.simplify(new Uint32Array(g.idx), pos, 3, 0, simplify / scale, ["LockBorder"]);
      // the vertices no triangle uses any more left out of the file
      const remap = new Map<number, number>();
      const [p0, n0, u0] = [g.pos, g.nrm, g.uv];
      g.pos = [];
      g.nrm = [];
      g.uv = [];
      g.idx = Array.from(out, (v) => {
        let k = remap.get(v);
        if (k === undefined) {
          k = remap.size;
          remap.set(v, k);
          g.pos.push(p0[v * 3], p0[v * 3 + 1], p0[v * 3 + 2]);
          g.nrm.push(n0[v * 3], n0[v * 3 + 1], n0[v * 3 + 2]);
          g.uv.push(u0[v * 2], u0[v * 2 + 1]);
        }
        return k;
      });
      tris += g.idx.length / 3;
    }
  }
  return { id, groups, tris, min, max, faces, depths };
}
/** meshoptimizer's simplifier, loaded once the import starts (city()) */
let SIMPLIFIER: { getScale: (p: Float32Array, stride: number) => number; simplify: (i: Uint32Array, p: Float32Array, stride: number, target: number, error: number, flags?: "LockBorder"[]) => [Uint32Array, number] } | null = null;

/**
 * One pack's pieces into a GLB: every texture GPU-compressed as KTX2 (KHR_texture_basisu), colours, glows and the packed
 * occlusion, roughness and metal at `size`, normal maps at `normalSize` (UASTC is four times ETC1S's bytes). Only the
 * pieces in `keep` are written: a GLB loads whole, and half the packs' textures were for pieces the centre never places.
 */
async function writePack(_h: CityImportHelpers, pack: Pack, allBaked: Baked[], mats: Map<string, MatInfo | null>, tex: Textures, size: number, normalSize: number, keep: Set<string>, file: string, meshopt = false): Promise<number> {
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
      }
      if (mi.emission) {
        const peak = Math.max(...mi.emission, 1e-6);
        const f = mi.emission.map((v) => srgbToLinear(Math.min(v / Math.max(peak, 1), 1))) as Vec3;
        m.setEmissiveFactor(f);
        if (mi.emissive) { const t = await texture(mi.emissive, "emissive"); if (t) m.setEmissiveTexture(t); }
        // HDR emission past 1 comes back as a strength the game multiplies by (glTF extras reach material.userData)
        m.setExtras({ emissiveStrength: Math.max(1, peak) });
      }
    } else m.setBaseColorFactor([0.55, 0.57, 0.6, 1]).setRoughnessFactor(0.8).setMetallicFactor(0);
    matCache.set(k, m);
    return m;
  };
  for (const b of baked) {
    const mesh = doc.createMesh(b.id);
    for (const [, g] of b.groups) {
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

export async function city(h: CityImportHelpers, packages: Map<string, string>): Promise<void> {
  const cfgFile = join(h.root, "src", "config", "citykit.json");
  const cfg = JSON.parse(readFileSync(cfgFile, "utf8"));
  const out = join(h.out, "city");
  const models = new Models(h, join(h.paid, "conv", "city"));
  const tex = new Textures(h);
  const measured: Record<string, number[]> = {};
  const faces: Record<string, string> = {};
  const planes: Record<string, number> = {};
  const report: string[] = [];
  const only = process.env.CITY_PACK;
  // the pieces the dressing names anywhere (citykit.json dress): the only ones written into the packs
  const keep = new Set<string>();
  const walkNames = (x: unknown): void => {
    if (typeof x === "string") keep.add(x);
    else if (Array.isArray(x)) x.forEach(walkNames);
    else if (x && typeof x === "object") Object.values(x).forEach(walkNames);
  };
  walkNames(cfg.dress);
  const keptAll: string[] = [];
  const facadeCat: Record<string, { width: number; height: number; wall: number; from: string }> = {};
  const fronts: Record<string, number> = {};
  tex.pool = await BasisPool.start(h.paid);
  {
    const { MeshoptSimplifier } = await import("meshoptimizer");
    await MeshoptSimplifier.ready;
    SIMPLIFIER = MeshoptSimplifier;
  }
  for (const [name, pkgName] of Object.entries<string>(cfg.packages)) {
    if (only && only !== name) continue;
    const pkg = packages.get(pkgName);
    if (!pkg) {
      report.push(`${name}: no ${pkgName} in the Unity downloads, skipped`);
      continue;
    }
    const pack = new Pack(name, h.unpack(pkg, name));
    const res = new Resolver(pack, models);
    const mats = new Map<string, MatInfo | null>();
    const baked: Baked[] = [];
    const missing: string[] = [];
    // CITY_FACADES=<a pack's scene path> cuts that demo street's walls into facade strips (cutFacades), each baked in
    // its own frame (x along the wall, y up, z out of it, the wall's plane at z 0), <pack>-facades.glb and .json (24.2)
    const facPath = process.env.CITY_FACADES;
    if (facPath) {
      const file = pack.pathFile.get(facPath);
      if (!file) continue;
      const strips = cutFacades(res.flatten(basename(dirname(file))));
      const bakedF: Baked[] = [];
      const cat: Array<Record<string, unknown>> = [];
      strips.forEach((s, i) => {
        const id = `${name}/facade ${String(i + 1).padStart(3, "0")}`;
        const bk = bake(pack, res, id, "", mats, s.draws);
        if (!bk) return;
        bakedF.push(bk);
        cat.push({ id, width: +s.width.toFixed(2), height: +s.height.toFixed(2), depth: +(bk.max[2]).toFixed(2), back: +(bk.min[2]).toFixed(2), wall: +s.wall.toFixed(2), tris: bk.tris, parts: s.draws.length, from: s.from });
      });
      const bytes = await writePack(h, pack, bakedF, mats, tex, cfg.sizes.hi, cfg.sizes.normal.hi, new Set(bakedF.map((x) => x.id)), join(out, `${name}-facades.glb`));
      writeFileSync(join(out, `${name}-facades.json`), JSON.stringify(cat, null, 1));
      report.push(`${name} facades: ${bakedF.length} strips, ${bakedF.reduce((a, x) => a + x.tris, 0)} tris, ${(bytes / 1e6).toFixed(1)} MB`);
      continue;
    }
    // CITY_BUILDINGS=<a pack's scene path> cuts that demo street into its buildings (cutBuildings) and bakes each as a
    // piece, <pack>-buildings.glb, with their measurements in <pack>-buildings.json (Phase 24.2)
    const buildPath = process.env.CITY_BUILDINGS;
    if (buildPath) {
      const file = pack.pathFile.get(buildPath);
      if (!file) continue;
      const cut = cutBuildings(res.flatten(basename(dirname(file))));
      const bakedB: Baked[] = [];
      const cat: Array<Record<string, unknown>> = [];
      cut.forEach((c, i) => {
        const id = `${name}/building ${String(i + 1).padStart(2, "0")}`;
        const bk = bake(pack, res, id, "", mats, c.draws);
        if (!bk) return;
        bakedB.push(bk);
        cat.push({ id, size: bk.max.map((v, k) => +(v - bk.min[k]).toFixed(2)), min: bk.min.map((v) => +v.toFixed(2)), tris: bk.tris, parts: c.draws.length, footprint: c.footprint, street: +c.street.toFixed(2) });
      });
      const bytes = await writePack(h, pack, bakedB, mats, tex, cfg.sizes.hi, cfg.sizes.normal.hi, new Set(bakedB.map((x) => x.id)), join(out, `${name}-buildings.glb`));
      writeFileSync(join(out, `${name}-buildings.json`), JSON.stringify(cat, null, 1));
      report.push(`${name} buildings: ${bakedB.length} cut, ${bakedB.reduce((a, x) => a + x.tris, 0)} tris, ${(bytes / 1e6).toFixed(1)} MB`);
      continue;
    }
    // CITY_DISTRICTS=1 bakes each district of this pack (src/config/citydistricts.json, Phase 25): its demo scene whole,
    // every part moved and turned into the map's own metres, the parts whose middle lands outside the district's corner
    // (or past its radius) left out, into <id>-v<version>.glb; the measurements go back into citydistricts.json
    if (process.env.CITY_DISTRICTS) {
      const dFile = join(h.root, "src", "config", "citydistricts.json");
      const dCfg = JSON.parse(readFileSync(dFile, "utf8"));
      for (const dist of dCfg.districts.filter((q: { pack: string }) => q.pack === name)) {
        const file = pack.pathFile.get(dist.scene);
        if (!file) {
          report.push(`${dist.id}: no ${dist.scene} in ${name}`);
          continue;
        }
        const [ox, oy, oz] = dist.origin;
        const [ax, ay, az] = dist.at;
        const c = Math.cos(dist.yaw), s = Math.sin(dist.yaw);
        // column-major: the scene point `origin` to `at`, turned `yaw` about y
        const T: M4 = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, ax - (c * ox + s * oz), ay - oy, az - (-s * ox + c * oz), 1];
        const kept: Array<{ d: Draw; m: M4 }> = [];
        let dropped = 0;
        for (const { d, m } of res.flatten(basename(dirname(file)))) {
          const mesh = d.model.meshes[d.mesh];
          if (!mesh) continue;
          const w = mul(T, m);
          // the part's middle, from its own bounds
          const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
          for (const prim of mesh.prims)
            for (let k = 0; k < prim.pos.length; k += 3)
              for (let a = 0; a < 3; a++) {
                lo[a] = Math.min(lo[a], prim.pos[k + a]);
                hi[a] = Math.max(hi[a], prim.pos[k + a]);
              }
          const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
          const x = w[0] * mid[0] + w[4] * mid[1] + w[8] * mid[2] + w[12];
          const z = w[2] * mid[0] + w[6] * mid[1] + w[10] * mid[2] + w[14];
          if (!dist.keep.some((k: { x0: number; z0: number }) => x >= k.x0 && z >= k.z0) || Math.hypot(x - ax, z - az) > dist.radius) {
            dropped++;
            continue;
          }
          kept.push({ d, m: w });
        }
        const bk = bake(pack, res, `${name}/district ${dist.id}`, "", mats, kept);
        if (!bk) continue;
        // and its collision, from the same triangles (districtSolids), into src/config/districts/<id>.solids.json: numbers
        // measured off the pack's geometry, which the game loads with or without the bought files (the checks run without)
        const solids = districtSolids(kept, { ...dCfg.collision, fill: dist.fill ? { ...dist.fill, plan: dist.hole } : undefined });
        mkdirSync(join(h.root, "src", "config", "districts"), { recursive: true });
        writeFileSync(
          join(h.root, "src", "config", "districts", `${dist.id}.solids.json`),
          JSON.stringify({ _note: `The collision of the district ${dist.id} (src/config/citydistricts.json), written by tools/import-city.ts CITY_DISTRICTS=1 off the pack scene's own triangles (districtSolids), never typed: boxes [x0, x1, z0, z1, y0, y1], map-local metres.`, solids: solids.map((q) => q.map((v) => +v.toFixed(2))) }) + "\n",
        );
        report.push(`${dist.id}: ${solids.length} solid boxes`);
        const bytes = await writePack(h, pack, [bk], mats, tex, cfg.sizes.hi, cfg.sizes.normal.hi, new Set([bk.id]), join(out, `${dist.id}-v${dCfg.version}.glb`), true);
        // and at the kit's lo size, for the presets that load the kit's lo files (Competitive): every preset loaded 51 MB
        const loBytes = await writePack(h, pack, [bk], mats, tex, cfg.sizes.lo, cfg.sizes.normal.lo, new Set([bk.id]), join(out, `${dist.id}-v${dCfg.version}-lo.glb`), true);
        dist.measured = { tris: bk.tris, parts: kept.length, dropped, min: bk.min.map((v) => +v.toFixed(2)), max: bk.max.map((v) => +v.toFixed(2)) };
        report.push(`${dist.id}: ${kept.length} parts (${dropped} left out), ${bk.tris} tris, ${(bytes / 1e6).toFixed(1)} MB, lo ${(loBytes / 1e6).toFixed(1)} MB`);
      }
      writeFileSync(dFile, JSON.stringify(dCfg, null, 2) + "\n");
      continue;
    }
    // CITY_SCENE=<a pack's scene path> bakes that whole scene, the pack's own demo street as its artist assembled it, into
    // <pack>-scene.glb (Phase 23: to set the packs' own composition beside ours), and nothing else of the pack
    const scenePath = process.env.CITY_SCENE;
    if (scenePath) {
      const file = pack.pathFile.get(scenePath);
      if (!file) continue;
      const sb = bake(pack, res, `${name}/scene`, basename(dirname(file)), mats);
      if (sb) {
        const bytes = await writePack(h, pack, [sb], mats, tex, cfg.sizes.hi, cfg.sizes.normal.hi, new Set([sb.id]), join(out, `${name}-scene.glb`));
        report.push(`${name} scene: ${sb.tris} tris, ${(bytes / 1e6).toFixed(1)} MB, ${sb.max.map((v, i) => (v - sb.min[i]).toFixed(0)).join(" x ")} m`);
      }
      continue;
    }
    // the pack's demo street cut into facade strips (cutFacades, citykit.json scenes), each a piece like any other,
    // "<pack>/facade NNN", written whatever the dressing names, with its measurements in `facades`
    const strips = new Map<string, Array<{ d: Draw; m: M4 }>>();
    const demoPath = (cfg.scenes ?? {})[name];
    const sceneFile = demoPath ? pack.pathFile.get(demoPath) : undefined;
    if (sceneFile)
      cutFacades(res.flatten(basename(dirname(sceneFile)))).forEach((s, i) => {
        const id = `${name}/facade ${String(i + 1).padStart(3, "0")}`;
        strips.set(id, s.draws);
        facadeCat[id] = { width: +s.width.toFixed(2), height: +s.height.toFixed(2), wall: +s.wall.toFixed(2), from: s.from };
        keep.add(id);
      });
    for (const rel of [...(cfg.pieces[name] ?? []), ...[...strips.keys()].map((id) => id.slice(name.length + 1))]) {
      const path = `${cfg.roots[name]}${rel}.prefab`;
      const file = pack.pathFile.get(path);
      const guid = file ? basename(dirname(file)) : null;
      const id = `${name}/${rel}`;
      const given = strips.get(id);
      const b = given ? bake(pack, res, id, "", mats, given, cfg.simplify?.strips ?? 0) : guid ? bake(pack, res, id, guid, mats) : null;
      if (!b) {
        missing.push(rel);
        continue;
      }
      baked.push(b);
      measured[id] = [...b.max.map((v, i) => +(v - b.min[i]).toFixed(3)), ...b.min.map((v) => +v.toFixed(3)), b.tris];
      // the horizontal side a piece shows most: which way a facade module faces
      const hz = (["px", "nx", "pz", "nz"] as const).reduce((a, k) => (b.faces[k] > b.faces[a] ? k : a), "pz" as "px" | "nx" | "pz" | "nz");
      faces[id] = hz;
      // the wall: the deepest plane holding a real share of the front's area (a quarter of the largest). The largest
      // alone is a thick module's pilasters, with its wall and its lit windows behind them (High City's wall1a: 15.6 m2
      // of pilaster 0.5 m back, 12.7 m2 of wall 0.9 m back, 11.8 m2 of window 1.1 to 1.2 m back)
      const bins = [...b.depths[hz].entries()];
      const most = Math.max(0, ...bins.map((e) => e[1]));
      const front = hz === "px" ? b.max[0] : hz === "nx" ? -b.min[0] : hz === "pz" ? b.max[2] : -b.min[2];
      const along = (k: number) => (hz[0] === "p" ? k / 10 : -k / 10);
      const deepest = bins.filter((e) => e[1] >= most * 0.25).reduce((a, e) => Math.min(a, along(e[0])), front);
      planes[id] = +Math.max(0, front - deepest).toFixed(2);
      // how much of its front-facing area stands within 0.3 m of its front: most of it for a room module (Kyber's and
      // Cyber City's window walls, a furnished room behind the glass), little for a relief module (High City's, frames
      // and cornices before a wall), so the dressing knows which it may set with its front on the building's face
      const totalArea = bins.reduce((a, e) => a + e[1], 0);
      const frontArea = bins.filter((e) => front - along(e[0]) <= 0.3).reduce((a, e) => a + e[1], 0);
      fronts[id] = totalArea > 0 ? +(frontArea / totalArea).toFixed(2) : 1;
      if (process.env.PLANE_DEBUG && id.includes(process.env.PLANE_DEBUG))
        console.log(id, hz, "front", front.toFixed(2), [...b.depths[hz].entries()].map(([k, a]) => [+(front - (hz[0] === "p" ? k / 10 : -k / 10)).toFixed(1), +a.toFixed(2)]).sort((x, y) => x[0] - y[0]).filter((r) => r[1] > 0.05).map((r) => r.join(":")).join(" "));
    }
    const v = cfg.version;
    const S = cfg.sizes;
    const kept = baked.filter((bk) => keep.has(bk.id)).map((bk) => bk.id);
    keptAll.push(...kept);
    const maxBytes = await writePack(h, pack, baked, mats, tex, S.max, S.normal.max, keep, join(out, `${name}-v${v}-max.glb`), true);
    const hiBytes = await writePack(h, pack, baked, mats, tex, S.hi, S.normal.hi, keep, join(out, `${name}-v${v}.glb`), true);
    // Competitive, the one preset on the -lo file, keeps its modules and never places a facade strip (citydress.ts): the
    // strips and their own materials were most of v5's -lo download (91 MB)
    const keepLo = new Set([...keep].filter((id) => !id.includes("/facade ")));
    const loBytes = await writePack(h, pack, baked, mats, tex, S.lo, S.normal.lo, keepLo, join(out, `${name}-v${v}-lo.glb`), true);
    const tris = baked.reduce((a, b) => a + b.tris, 0);
    report.push(`${name}: ${baked.length} pieces (${kept.length} written), ${tris} tris, ${mats.size} materials; max ${(maxBytes / 1e6).toFixed(1)} MB, hi ${(hiBytes / 1e6).toFixed(1)} MB, lo ${(loBytes / 1e6).toFixed(1)} MB${missing.length ? `; not found: ${missing.join(", ")}` : ""}`);
  }
  // the measured sizes go back into the config, as paid-weapons.ts does for the guns
  if (!only) {
    cfg.measured = measured;
    cfg.facing = faces;
    cfg.plane = planes;
    cfg.front = fronts;
    cfg.facades = facadeCat;
    cfg.baked = keptAll.sort();
    cfg._measured =
      "Written by npm run paid (tools/import-city.ts) off the baked pieces, never typed: each piece's size (w, h, d) and the minimum corner of its bounds in its own space (x, y, z), metres, then its triangles. `facing` is the horizontal side a piece shows most by area (px, nx, pz, nz): the way a facade module faces. `plane`: how far behind a piece's front its wall stands (metres), the plane most of its front area is on, so a thick module's frames and cornices stand out of the building and its wall sits on the building's face.";
    writeFileSync(cfgFile, JSON.stringify(cfg, null, 2) + "\n");
  }
  await tex.pool.stop();
  console.log("city bundle:\n  " + report.join("\n  "));
  if (IMPORT_STATS.unplacedOverrides) console.log(`  ${IMPORT_STATS.unplacedOverrides} material overrides on a model found no mesh to go to`);
  // the model parts that drew with no material: which model, its FBX's own material name, triangles
  if (IMPORT_STATS.unreadable.size)
    console.log(["  a material found but not read (material (for its model), triangles):", ...[...IMPORT_STATS.unreadable].sort((p, q) => q[1] - p[1]).slice(0, 25).map(([k, n]) => `    ${Math.round(n)}  ${k}`)].join(String.fromCharCode(10)));
  if (IMPORT_STATS.unresolved.size)
    console.log(["  no material resolved (model : its FBX material, triangles):", ...[...IMPORT_STATS.unresolved].sort((p, q) => q[1] - p[1]).slice(0, 25).map(([k, n]) => `    ${Math.round(n)}  ${k}`)].join(String.fromCharCode(10)));
}
