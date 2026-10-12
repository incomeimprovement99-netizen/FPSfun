// Trim a glTF binary (.glb) to the animations you name, dropping everything
// only the others used: how the motion-captured mannequin (Quaternius's
// Universal Animation Library, CC0) goes into public/models/ at a fraction of
// its size. Meshes, skins, materials and images are kept as they are.
//
//   npx tsx tools/trim-glb.ts <in.glb> <out.glb> [--no-mesh | --skeleton] Clip_A Clip_B ...
//
// --no-mesh keeps only the skeleton's nodes and the animations (a file of
// clips for a skeleton another file already brings). --skeleton keeps its skin
// as well, its joints and nothing else, so a loader reads its nodes as bones
// (three marks a node a bone by a skin's joints, not by a mesh) with no body
// to draw: the rig the clips are carried over from (retarget.ts rigOf).
//
// A bone a clip holds still keeps two keys, its first and its last, rather
// than one a frame: the library keys every bone's position, rotation and
// scale every frame, and most of them never move (every scale, all but the
// hips' and a few others' positions, two rotations in five), which was three
// quarters of the files. The value held is the first key's, and a channel
// counts as still when no key strays from it by more than HOLD_EPS. The keys
// all go in one buffer view, each array once however many channels share it
// (every held scale is the same two keys): a view per array was a third of
// what was left.
import { readFileSync, writeFileSync } from "node:fs";

/** how far a key may stray from the first and its channel still count as held: a hundred-thousandth of a unit (a thousandth of a degree in a rotation) */
export const HOLD_EPS = 1e-5;

interface Gltf {
  asset: unknown;
  scene?: number;
  scenes?: Array<{ nodes?: number[] }>;
  nodes?: Array<{ name?: string; mesh?: number; skin?: number; children?: number[] }>;
  meshes?: Array<{ primitives: Array<{ attributes: Record<string, number>; indices?: number; targets?: Array<Record<string, number>>; material?: number }> }>;
  skins?: Array<{ inverseBindMatrices?: number; joints: number[]; skeleton?: number }>;
  animations?: Array<{ name?: string; samplers: Array<{ input: number; output: number; interpolation?: string }>; channels: unknown[] }>;
  accessors?: Array<{ bufferView?: number; byteOffset?: number; componentType?: number; count?: number; type?: string; min?: number[]; max?: number[] }>;
  bufferViews?: Array<{ buffer: number; byteOffset?: number; byteLength: number; byteStride?: number; target?: number }>;
  buffers?: Array<{ byteLength: number }>;
  images?: Array<{ bufferView?: number }>;
  materials?: unknown[];
  textures?: unknown[];
  samplers?: unknown[];
  [k: string]: unknown;
}

export function readGlb(path: string): { json: Gltf; bin: Buffer } {
  const b = readFileSync(path);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path}: not a .glb`);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jsonLen).toString("utf8")) as Gltf;
  const binStart = 20 + jsonLen;
  const binLen = b.readUInt32LE(binStart);
  const bin = b.subarray(binStart + 8, binStart + 8 + binLen);
  return { json, bin };
}

function writeGlb(path: string, json: Gltf, bin: Buffer): void {
  const pad = (n: number) => (4 - (n % 4)) % 4;
  let js = Buffer.from(JSON.stringify(json), "utf8");
  js = Buffer.concat([js, Buffer.alloc(pad(js.length), 0x20)]);
  const bn = Buffer.concat([bin, Buffer.alloc(pad(bin.length))]);
  const total = 12 + 8 + js.length + 8 + bn.length;
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(js.length, 0);
  jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(bn.length, 0);
  bh.writeUInt32LE(0x004e4942, 4);
  writeFileSync(path, Buffer.concat([head, jh, js, bh, bn]));
}

const WIDTH: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/** an accessor's floats, or null when it is not plain floats in a tight view (which this leaves alone) */
export function floatsOf(json: Gltf, bin: Buffer, i: number): Float32Array | null {
  const a = json.accessors![i];
  const w = WIDTH[a.type ?? ""];
  if (a.bufferView === undefined || a.componentType !== 5126 || !w) return null;
  const v = json.bufferViews![a.bufferView];
  if (v.byteStride && v.byteStride !== w * 4) return null;
  const at = bin.byteOffset + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return new Float32Array(bin.buffer.slice(at, at + a.count! * w * 4));
}

/** whether every key of an output stays within HOLD_EPS of the first */
export function held(values: Float32Array, width: number): boolean {
  for (let k = width; k < values.length; k++) if (Math.abs(values[k] - values[k % width]) > HOLD_EPS) return false;
  return true;
}

/**
 * The clips' keys packed: each held channel's sampler given two keys, the
 * clip's first and last times (so the clip keeps its length when three.js
 * splits it by bone) and the value of its first key, and every sampler's
 * times and values put in one new view on the end of the buffer, an array
 * stored once however many samplers use it. A sampler this cannot read as
 * plain floats keeps what it had.
 */
function packKeys(json: Gltf, bin: Buffer): { bin: Buffer; held: number; of: number } {
  const accessors = json.accessors!;
  const views = json.bufferViews!;
  const view = views.length;
  const parts: Buffer[] = [];
  let at = 0;
  const stored = new Map<string, number>();
  const store = (data: Float32Array, type: string, isTime: boolean): number => {
    const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    const key = `${type}:${bytes.toString("base64")}`;
    const had = stored.get(key);
    if (had !== undefined) return had;
    let lo = Infinity;
    let hi = -Infinity;
    if (isTime) for (const t of data) (lo = Math.min(lo, t)), (hi = Math.max(hi, t));
    accessors.push({ bufferView: view, byteOffset: at, componentType: 5126, count: data.length / WIDTH[type], type, ...(isTime ? { min: [lo], max: [hi] } : {}) });
    parts.push(bytes);
    at += bytes.length;
    stored.set(key, accessors.length - 1);
    return accessors.length - 1;
  };
  let nHeld = 0;
  let of = 0;
  for (const a of json.animations ?? [])
    for (const s of a.samplers) {
      of++;
      const times = floatsOf(json, bin, s.input);
      const out = floatsOf(json, bin, s.output);
      const type = accessors[s.output].type ?? "";
      const w = WIDTH[type];
      if (!times || !out || s.interpolation === "CUBICSPLINE" || out.length !== times.length * w) continue;
      if (times.length > 2 && held(out, w)) {
        const two = new Float32Array(2 * w);
        two.set(out.subarray(0, w), 0);
        two.set(out.subarray(0, w), w);
        s.input = store(new Float32Array([times[0], times[times.length - 1]]), "SCALAR", true);
        s.output = store(two, type, false);
        nHeld++;
      } else {
        s.input = store(times, "SCALAR", true);
        s.output = store(out, type, false);
      }
    }
  const pad = (4 - (bin.length % 4)) % 4;
  views.push({ buffer: 0, byteOffset: bin.length + pad, byteLength: at });
  return { bin: Buffer.concat([bin, Buffer.alloc(pad), ...parts]), held: nHeld, of };
}

function main(): void {
  const args = process.argv.slice(2);
  const skeleton = args.includes("--skeleton");
  const noMesh = skeleton || args.includes("--no-mesh");
  const [inPath, outPath, ...names] = args.filter((a) => a !== "--no-mesh" && a !== "--skeleton");
  if (!inPath || !outPath || !names.length) {
    console.error("usage: trim-glb <in.glb> <out.glb> [--no-mesh | --skeleton] Clip ...");
    process.exit(2);
  }
  const { json, bin } = readGlb(inPath);
  const all = json.animations ?? [];
  const missing = names.filter((n) => !all.some((a) => a.name === n));
  if (missing.length) {
    console.error(`not in ${inPath}: ${missing.join(", ")}`);
    process.exit(1);
  }
  json.animations = all.filter((a) => names.includes(a.name ?? ""));
  const still = packKeys(json, bin);
  const data = still.bin;
  if (noMesh) {
    // the nodes stay (the channels point at them by index); what hangs off them goes
    for (const n of json.nodes ?? []) {
      delete n.mesh;
      delete n.skin;
    }
    delete json.meshes;
    if (skeleton) for (const sk of json.skins ?? []) delete sk.inverseBindMatrices;
    else delete json.skins;
    delete json.materials;
    delete json.textures;
    delete json.images;
    delete json.samplers;
  }
  // the accessors still used, and the buffer views under them (and under images)
  const usedAcc = new Set<number>();
  for (const m of json.meshes ?? [])
    for (const p of m.primitives) {
      for (const a of Object.values(p.attributes)) usedAcc.add(a);
      if (p.indices !== undefined) usedAcc.add(p.indices);
      for (const t of p.targets ?? []) for (const a of Object.values(t)) usedAcc.add(a);
    }
  for (const s of json.skins ?? []) if (s.inverseBindMatrices !== undefined) usedAcc.add(s.inverseBindMatrices);
  for (const a of json.animations) for (const s of a.samplers) usedAcc.add(s.input).add(s.output);
  const accessors = json.accessors ?? [];
  const usedView = new Set<number>();
  for (const i of usedAcc) if (accessors[i].bufferView !== undefined) usedView.add(accessors[i].bufferView!);
  for (const im of json.images ?? []) if (im.bufferView !== undefined) usedView.add(im.bufferView);
  // new accessor and view indices, and one packed buffer
  const accMap = new Map<number, number>();
  const newAcc: NonNullable<Gltf["accessors"]> = [];
  [...usedAcc].sort((a, b) => a - b).forEach((i) => {
    accMap.set(i, newAcc.length);
    newAcc.push(accessors[i]);
  });
  const viewMap = new Map<number, number>();
  const newViews: NonNullable<Gltf["bufferViews"]> = [];
  const parts: Buffer[] = [];
  let offset = 0;
  [...usedView].sort((a, b) => a - b).forEach((i) => {
    const v = json.bufferViews![i];
    const start = v.byteOffset ?? 0;
    const bytes = data.subarray(start, start + v.byteLength);
    const padBy = (4 - (offset % 4)) % 4;
    if (padBy) {
      parts.push(Buffer.alloc(padBy));
      offset += padBy;
    }
    viewMap.set(i, newViews.length);
    newViews.push({ ...v, buffer: 0, byteOffset: offset });
    parts.push(bytes);
    offset += bytes.length;
  });
  for (const a of newAcc) if (a.bufferView !== undefined) a.bufferView = viewMap.get(a.bufferView);
  for (const im of json.images ?? []) if (im.bufferView !== undefined) im.bufferView = viewMap.get(im.bufferView);
  const remap = (i: number) => accMap.get(i)!;
  for (const m of json.meshes ?? [])
    for (const p of m.primitives) {
      for (const k of Object.keys(p.attributes)) p.attributes[k] = remap(p.attributes[k]);
      if (p.indices !== undefined) p.indices = remap(p.indices);
      for (const t of p.targets ?? []) for (const k of Object.keys(t)) t[k] = remap(t[k]);
    }
  for (const s of json.skins ?? []) if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = remap(s.inverseBindMatrices);
  for (const a of json.animations) for (const s of a.samplers) {
    s.input = remap(s.input);
    s.output = remap(s.output);
  }
  json.accessors = newAcc;
  json.bufferViews = newViews;
  const out = Buffer.concat(parts);
  json.buffers = [{ byteLength: out.length }];
  writeGlb(outPath, json, out);
  console.log(`${outPath}: ${json.animations.length} clips, ${still.held} of ${still.of} channels held still, ${(out.length / 1024).toFixed(0)} KB of data (from ${(bin.length / 1024).toFixed(0)} KB)`);
}

if (process.argv[1]?.endsWith("trim-glb.ts")) main();
