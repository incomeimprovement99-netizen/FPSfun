// Every piece the centre places (High, the most it draws), and whether each of its materials came through the import
// whole: a material with no texture of any kind is either a plain colour in the pack (Cyber City's black trim) or a
// fault, and the import once dropped every prefab's material overrides on its models' meshes that way (High City's
// wall rows drew untextured grey until Phase 22). Local only: it reads the baked packs, never in git.
//
// Run: GAME=speedkills npx tsx tools/kit-audit.ts
import * as THREE from "three";
import { NodeIO } from "@gltf-transform/core";
const g = globalThis as unknown as Record<string, unknown>;
const anyProxy = (): unknown => new Proxy(function () {}, { get: (_t, k) => (k === "measureText" ? () => ({ width: 10 }) : k === Symbol.toPrimitive ? () => 0 : k === "width" || k === "height" ? 64 : anyProxy()), set: () => true, apply: () => anyProxy() });
const fakeEl = (): unknown => ({ width: 64, height: 64, style: {}, getContext: () => anyProxy(), addEventListener() {}, removeEventListener() {}, set src(_v: string) {} });
g.document = { createElement: () => fakeEl(), createElementNS: () => fakeEl() };
console.warn = () => undefined;
const { buildCityMap } = await import("../src/game/city");
const { cityKitPlaces } = await import("../src/game/citydress");
const map = buildCityMap(new THREE.Scene());
const places = cityKitPlaces(map.pads, false);
const used = new Map<string, number>();
for (const p of places) used.set(p.piece, (used.get(p.piece) ?? 0) + 1);
const io = new NodeIO();
const bad: Array<{ id: string; n: number; mats: string[]; tris: number }> = [];
let piecesOk = 0;
for (const pack of new Set([...used.keys()].map((k) => k.split("/")[0]))) {
  const doc = await io.read(`public/models/paid/city/${pack}-v1.glb`);
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  for (const top of scene.listChildren()) {
    const id = String((top.getExtras() as { id?: string }).id ?? top.getName());
    if (!used.has(id)) continue;
    const missing: string[] = [];
    let tris = 0;
    const walk = (n: typeof top): void => {
      for (const prim of n.getMesh()?.listPrimitives() ?? []) {
        const m = prim.getMaterial();
        const count = (prim.getIndices()?.getCount() ?? prim.getAttribute("POSITION")?.getCount() ?? 0) / 3;
        if (!m || m.getName().endsWith("#none") || (!m.getBaseColorTexture() && !m.getEmissiveTexture())) {
          missing.push(m?.getName() ?? "(no material)");
          tris += count;
        }
      }
      for (const c of n.listChildren()) walk(c);
    };
    walk(top);
    if (missing.length) bad.push({ id, n: used.get(id)!, mats: [...new Set(missing)], tris });
    else piecesOk++;
  }
}
bad.sort((a, b) => b.n - a.n);
console.log(`${used.size} pieces placed; ${piecesOk} whole; ${bad.length} with a material that came through with no texture:`);
for (const b of bad) console.log(`  ${String(b.n).padStart(5)} placed  ${b.id}  (${b.mats.join(", ")}; ${Math.round(b.tris)} triangles untextured)`);
