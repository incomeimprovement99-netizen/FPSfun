// The textures the centre's placed pieces use, counted off the baked packs, and what they would cost the card decoded to
// RGBA with mips: the measurement that turned "2K on High" into GPU-compressed textures (Phase 23.1). Local only.
//
// Run: GAME=speedkills npx tsx tools/kit-texmem.ts
import * as THREE from "three";
import sharp from "sharp";
import { kitFile, kitIO } from "./kit-glb";
const g = globalThis as unknown as Record<string, unknown>;
const anyProxy = (): unknown => new Proxy(function () {}, { get: (_t, k) => (k === "measureText" ? () => ({ width: 10 }) : k === Symbol.toPrimitive ? () => 0 : k === "width" || k === "height" ? 64 : anyProxy()), set: () => true, apply: () => anyProxy() });
const fakeEl = (): unknown => ({ width: 64, height: 64, style: {}, getContext: () => anyProxy(), addEventListener() {}, removeEventListener() {}, set src(_v: string) {} });
g.document = { createElement: () => fakeEl(), createElementNS: () => fakeEl() };
console.warn = () => undefined;
const { buildCityMap } = await import("../src/game/city");
const { cityKitPlaces, cityKitTraffic } = await import("../src/game/citydress");
const map = buildCityMap(new THREE.Scene());
const used = new Set([...cityKitPlaces(map.pads, false).map((p) => p.piece), ...cityKitTraffic().map((c) => c.piece)]);
const io = kitIO();
let usedPx = 0, allPx = 0, usedN = 0, allN = 0, bytes = 0;
for (const pack of ["cyber", "cyberfp", "glass", "high", "kyber"]) {
  const doc = await io.read(kitFile(pack));
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const usedTex = new Set<unknown>();
  for (const top of scene.listChildren()) {
    const id = String((top.getExtras() as { id?: string }).id ?? top.getName());
    if (!used.has(id)) continue;
    const walk = (n: typeof top): void => {
      for (const prim of n.getMesh()?.listPrimitives() ?? []) {
        const m = prim.getMaterial();
        if (m) for (const t of [m.getBaseColorTexture(), m.getNormalTexture(), m.getEmissiveTexture(), m.getMetallicRoughnessTexture(), m.getOcclusionTexture()]) if (t) usedTex.add(t);
      }
      for (const c of n.listChildren()) walk(c);
    };
    walk(top);
  }
  for (const t of doc.getRoot().listTextures()) {
    const img = t.getImage();
    if (!img) continue;
    const meta = await sharp(Buffer.from(img)).metadata();
    const px = (meta.width ?? 0) * (meta.height ?? 0);
    allPx += px; allN++;
    bytes += img.byteLength;
    if (usedTex.has(t)) { usedPx += px; usedN++; }
  }
}
const mb = (px: number) => ((px * 4 * 4) / 3 / 1e6).toFixed(0);
console.log(`at 1K (v2 hi): ${allN} textures in the packs, ${usedN} used by placed pieces`);
console.log(`graphics memory, decoded with mips: used ${mb(usedPx)} MB, all ${mb(allPx)} MB; download ${(bytes / 1e6).toFixed(0)} MB`);
console.log(`at 2K, 4x: used about ${mb(usedPx * 4)} MB, all ${mb(allPx * 4)} MB`);
