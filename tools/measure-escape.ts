// Where a fire escape piece's landing and stair are, measured off the baked model (public/models/paid/city), so the
// solids city.ts gives a fire escape stand where its picture does (CLAUDE.md: measure, do not guess). Local only: it
// reads the bought files, which are never in git.
//
// For each piece: its vertices in the piece's own frame, with its measured bounds' minimum at 0; the heights where the
// vertices crowd (the landing's grating is the densest band), and, band by band up the stair, where along the piece's
// width and out from its wall the stair's vertices lie.
//
// Run: npx tsx tools/measure-escape.ts high "fire ladder a tile" "fire ladder b tile" ...
import { NodeIO } from "@gltf-transform/core";
import type { Node } from "@gltf-transform/core";
import * as THREE from "three";

const [pack, ...names] = process.argv.slice(2);
const doc = await new NodeIO().read(`public/models/paid/city/${pack}-v1.glb`);
const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
const idOf = (n: Node): string => String((n.getExtras() as { id?: string }).id ?? n.getName());

function points(root: Node): number[][] {
  const out: number[][] = [];
  const walk = (n: Node, parent: THREE.Matrix4): void => {
    const m = parent.clone().multiply(new THREE.Matrix4().fromArray(n.getMatrix()));
    const mesh = n.getMesh();
    if (mesh)
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        const v = [0, 0, 0];
        const w = new THREE.Vector3();
        for (let i = 0; i < pos.getCount(); i++) {
          pos.getElement(i, v);
          w.fromArray(v).applyMatrix4(m);
          out.push([w.x, w.y, w.z]);
        }
      }
    for (const c of n.listChildren()) walk(c, m);
  };
  // the piece's own placement in the pack is its standing frame's origin, as the importer measured it
  walk(root, new THREE.Matrix4());
  return out;
}

for (const name of names) {
  const node = scene.listChildren().find((n) => idOf(n).toLowerCase().endsWith("/" + name.toLowerCase()) || idOf(n).toLowerCase() === name.toLowerCase());
  if (!node) {
    console.log(`${name}: not in ${pack}`);
    continue;
  }
  const p = points(node);
  const min = [0, 1, 2].map((k) => Math.min(...p.map((q) => q[k])));
  const max = [0, 1, 2].map((k) => Math.max(...p.map((q) => q[k])));
  const q = p.map((v) => v.map((c, k) => c - min[k]));
  const size = max.map((v, k) => v - min[k]);
  console.log(`\n${idOf(node)}: ${q.length} vertices, ${size.map((v) => v.toFixed(2)).join(" x ")} (x along, y up, z out)`);
  // the heights where the vertices crowd
  const bins = new Map<number, number>();
  for (const v of q) bins.set(Math.floor(v[1] / 0.1), (bins.get(Math.floor(v[1] / 0.1)) ?? 0) + 1);
  const dense = [...bins].sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log("  densest heights:", dense.map(([b, n]) => `${(b * 0.1).toFixed(1)}-${(b * 0.1 + 0.1).toFixed(1)} m (${n})`).join(", "));
  // finely round the densest band: the landing's grating, its top surface
  const [top] = dense[0];
  const fine = new Map<number, number>();
  for (const v of q) if (v[1] > top * 0.1 - 0.3 && v[1] < top * 0.1 + 0.4) fine.set(Math.round(v[1] / 0.02), (fine.get(Math.round(v[1] / 0.02)) ?? 0) + 1);
  console.log("  round it:", [...fine].sort((a, b) => a[0] - b[0]).map(([b, n]) => `${(b * 0.02).toFixed(2)}:${n}`).join(" "));
  // the stair (the outer lane, under the landing): its vertices' heights, where treads crowd, and x against y
  const lane = q.filter((v) => v[2] > 0.75 && v[2] < 1.6 && v[1] < 3.7);
  const treads = new Map<number, number>();
  for (const v of lane) treads.set(Math.round(v[1] / 0.05), (treads.get(Math.round(v[1] / 0.05)) ?? 0) + 1);
  console.log("  stair heights:", [...treads].sort((a, b) => a[0] - b[0]).filter(([, n]) => n >= 6).map(([b, n]) => `${(b * 0.05).toFixed(2)}:${n}`).join(" "));
  // the stair's line: in each quarter metre up, how far along its vertices reach (its low and high ends)
  const line: string[] = [];
  for (let y = 0; y < 4; y += 0.25) {
    const b = lane.filter((v) => v[1] >= y && v[1] < y + 0.25).map((v) => v[0]);
    if (b.length) line.push(`${y.toFixed(2)}:${Math.min(...b).toFixed(2)}-${Math.max(...b).toFixed(2)}`);
  }
  console.log("  stair line (y: x..x):", line.join(" "));
  // the landing's outer lane at the grating: which stretches of x have vertices (the hole has only its frame)
  const grate = q.filter((v) => v[1] > 3.8 && v[1] < 4.05 && v[2] > 0.85 && v[2] < 1.5);
  const cols = new Map<number, number>();
  for (const v of grate) cols.set(Math.floor(v[0] / 0.1), (cols.get(Math.floor(v[0] / 0.1)) ?? 0) + 1);
  console.log("  landing's outer lane by x (0.1 m):", Array.from({ length: Math.ceil(size[0] / 0.1) }, (_, i) => cols.get(i) ?? 0).join(","));
  const inner = q.filter((v) => v[1] > 3.8 && v[1] < 4.05 && v[2] < 0.75);
  const icols = new Map<number, number>();
  for (const v of inner) icols.set(Math.floor(v[0] / 0.1), (icols.get(Math.floor(v[0] / 0.1)) ?? 0) + 1);
  console.log("  landing's inner lane by x (0.1 m):", Array.from({ length: Math.ceil(size[0] / 0.1) }, (_, i) => icols.get(i) ?? 0).join(","));
  const zs = q.filter((v) => v[1] > 3.8 && v[1] < 4.05).map((v) => v[2]);
  const zb = new Map<number, number>();
  for (const z of zs) zb.set(Math.floor(z / 0.1), (zb.get(Math.floor(z / 0.1)) ?? 0) + 1);
  console.log("  landing by z (0.1 m):", [...zb].sort((a, b) => a[0] - b[0]).map(([b, n]) => `${(b * 0.1).toFixed(1)}:${n}`).join(" "));
  // band by band: the extent of what is there along x and out along z
  for (let y = 0; y < size[1]; y += 0.5) {
    const band = q.filter((v) => v[1] >= y && v[1] < y + 0.5);
    if (!band.length) continue;
    const xs = band.map((v) => v[0]).sort((a, b) => a - b);
    const zs = band.map((v) => v[2]).sort((a, b) => a - b);
    const pct = (a: number[], f: number) => a[Math.min(a.length - 1, Math.floor(f * a.length))];
    console.log(`  y ${y.toFixed(1)}-${(y + 0.5).toFixed(1)}: ${String(band.length).padStart(5)} v, x ${pct(xs, 0.05).toFixed(2)}..${pct(xs, 0.95).toFixed(2)} (full ${xs[0].toFixed(2)}..${xs[xs.length - 1].toFixed(2)}), z ${pct(zs, 0.05).toFixed(2)}..${pct(zs, 0.95).toFixed(2)}`);
  }
}
