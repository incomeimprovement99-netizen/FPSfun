// Trim a glTF binary (.glb) to the animations you name, dropping everything
// only the others used: how the motion-captured mannequin (Quaternius's
// Universal Animation Library, CC0) goes into public/models/ at a fraction of
// its size. Meshes, skins, materials and images are kept as they are.
//
//   npx tsx tools/trim-glb.ts <in.glb> <out.glb> [--no-mesh] Clip_A Clip_B ...
//
// --no-mesh keeps only the skeleton's nodes and the animations (a file of
// clips for a skeleton another file already brings).
import { readFileSync, writeFileSync } from "node:fs";

interface Gltf {
  asset: unknown;
  scene?: number;
  scenes?: Array<{ nodes?: number[] }>;
  nodes?: Array<{ name?: string; mesh?: number; skin?: number; children?: number[] }>;
  meshes?: Array<{ primitives: Array<{ attributes: Record<string, number>; indices?: number; targets?: Array<Record<string, number>>; material?: number }> }>;
  skins?: Array<{ inverseBindMatrices?: number; joints: number[]; skeleton?: number }>;
  animations?: Array<{ name?: string; samplers: Array<{ input: number; output: number }>; channels: unknown[] }>;
  accessors?: Array<{ bufferView?: number; byteOffset?: number }>;
  bufferViews?: Array<{ buffer: number; byteOffset?: number; byteLength: number; byteStride?: number; target?: number }>;
  buffers?: Array<{ byteLength: number }>;
  images?: Array<{ bufferView?: number }>;
  materials?: unknown[];
  textures?: unknown[];
  samplers?: unknown[];
  [k: string]: unknown;
}

function readGlb(path: string): { json: Gltf; bin: Buffer } {
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

function main(): void {
  const args = process.argv.slice(2);
  const noMesh = args.includes("--no-mesh");
  const [inPath, outPath, ...names] = args.filter((a) => a !== "--no-mesh");
  if (!inPath || !outPath || !names.length) {
    console.error("usage: trim-glb <in.glb> <out.glb> [--no-mesh] Clip ...");
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
  if (noMesh) {
    // the nodes stay (the channels point at them by index); what hangs off them goes
    for (const n of json.nodes ?? []) {
      delete n.mesh;
      delete n.skin;
    }
    delete json.meshes;
    delete json.skins;
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
    const bytes = bin.subarray(start, start + v.byteLength);
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
  console.log(`${outPath}: ${json.animations.length} clips, ${(out.length / 1024).toFixed(0)} KB of data (from ${(bin.length / 1024).toFixed(0)} KB)`);
}

main();
