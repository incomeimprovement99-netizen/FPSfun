// What the city kit's draw calls are made of (Phase 22.4), measured off the baked packs (public/models/paid/city):
// for every piece a preset places, its meshes (one instanced draw each today) and the materials they use; and across
// all of them, how many distinct materials there are, the fewest draws the kit could take were every piece sharing a
// material drawn in one batch. Local only: it reads the bought files, which are never in git.
//
// Run: GAME=speedkills npx tsx tools/kit-drawcalls.ts [preset tier: 0 | 1 | 2]
import * as THREE from "three";
import { NodeIO } from "@gltf-transform/core";
import type { Node } from "@gltf-transform/core";
const g = globalThis as unknown as Record<string, unknown>;
const anyProxy = (): unknown =>
  new Proxy(function () {}, {
    get: (_t, k) => (k === "measureText" ? () => ({ width: 10 }) : k === Symbol.toPrimitive ? () => 0 : k === "width" || k === "height" ? 64 : anyProxy()),
    set: () => true,
    apply: () => anyProxy(),
  });
const fakeEl = (): unknown => ({ width: 64, height: 64, style: {}, getContext: () => anyProxy(), addEventListener() {}, removeEventListener() {}, set src(_v: string) {} });
g.document = { createElement: () => fakeEl(), createElementNS: () => fakeEl() };
console.warn = () => undefined;
const { buildCityMap } = await import("../src/game/city");
const { cityKitPlaces } = await import("../src/game/citydress");
const kit = (await import("../src/config/citykit.json")).default as unknown as { dress: { glow: Record<string, number> } };
const tier = Number(process.argv[2] ?? 1);
const map = buildCityMap(new THREE.Scene());
const places = cityKitPlaces(map.pads, tier === 0).filter((p) => p.tier <= tier);
const used = new Map<string, { n: number; kind: string }>();
for (const p of places) used.set(p.piece, { n: (used.get(p.piece)?.n ?? 0) + 1, kind: p.kind });

const io = new NodeIO();
const pieces = new Map<string, Array<{ material: string; tris: number }>>();
for (const pack of new Set([...used.keys()].map((k) => k.split("/")[0]))) {
  const doc = await io.read(`public/models/paid/city/${pack}-v1.glb`);
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const matId = new Map(doc.getRoot().listMaterials().map((m, i) => [m, `${pack}#${i}:${m.getName()}`]));
  for (const top of scene.listChildren()) {
    const id = String((top.getExtras() as { id?: string }).id ?? top.getName());
    if (!used.has(id)) continue;
    const meshes: Array<{ material: string; tris: number }> = [];
    const walk = (n: Node): void => {
      const mesh = n.getMesh();
      if (mesh)
        for (const prim of mesh.listPrimitives()) {
          const idx = prim.getIndices();
          const count = idx ? idx.getCount() : (prim.getAttribute("POSITION")?.getCount() ?? 0);
          const mat = prim.getMaterial();
          meshes.push({ material: mat ? matId.get(mat)! : `${pack}#none`, tris: count / 3 });
        }
      for (const c of n.listChildren()) walk(c);
    };
    walk(top);
    pieces.set(id, meshes);
  }
}
let draws = 0;
const mats = new Set<string>();
const perMat = new Map<string, { pieces: Set<string>; meshes: number }>();
for (const [id, meshes] of pieces) {
  // a glowing kind (billboards, posters, signs) draws its lit copy of the material: its own batch
  const glow = kit.dress.glow[used.get(id)!.kind] ? `:glow${kit.dress.glow[used.get(id)!.kind]}` : "";
  draws += meshes.length;
  for (const m of meshes) {
    const key = m.material + glow;
    mats.add(key);
    const e = perMat.get(key) ?? { pieces: new Set(), meshes: 0 };
    e.pieces.add(id);
    e.meshes++;
    perMat.set(key, e);
  }
}
const missing = [...used.keys()].filter((k) => !pieces.has(k));
console.log(`tier ${tier}: ${used.size} pieces placed (${missing.length} not found in the packs), ${places.length} placements`);
console.log(`draws today, one instanced mesh a piece's mesh: ${draws}`);
console.log(`distinct materials across them: ${mats.size} (the fewest draws a batch per material would take)`);
const worst = [...pieces].sort((a, b) => b[1].length - a[1].length).slice(0, 12);
console.log("\npieces with the most meshes:");
for (const [id, m] of worst) console.log(`  ${String(m.length).padStart(3)} meshes, ${new Set(m.map((x) => x.material)).size} materials  ${id}`);
console.log("\nmaterials shared by the most pieces:");
for (const [k, e] of [...perMat].sort((a, b) => b[1].meshes - a[1].meshes).slice(0, 12)) console.log(`  ${String(e.meshes).padStart(4)} meshes of ${String(e.pieces.size).padStart(3)} pieces  ${k}`);
