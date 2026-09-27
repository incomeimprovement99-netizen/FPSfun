// The centre's canyons, measured off the built city (Phase 21, the brief's 4.4): every pair of towers in THE SPIRE
// sector facing each other across 2.5 to 6 m, with the width, how far the faces overlap, and the lower roof, so
// the layout places its chimneys in canyons the city already has. Read against src/config/reach.json: a chimney
// climbs where the width is at most 4.25 m, best near 3.0 m.
//
// Run: GAME=speedkills npx tsx tools/centre-canyons.ts
import * as THREE from "three";

const g = globalThis as unknown as Record<string, unknown>;
const anyProxy = (): unknown =>
  new Proxy(function () {}, {
    get: (_t, k) => (k === "measureText" ? () => ({ width: 10 }) : k === Symbol.toPrimitive ? () => 0 : k === "width" || k === "height" ? 64 : anyProxy()),
    set: () => true,
    apply: () => anyProxy(),
  });
const fakeEl = (): unknown => ({ width: 64, height: 64, style: {}, getContext: () => anyProxy(), addEventListener() {}, removeEventListener() {}, set src(_v: string) {} });
g.document = { createElement: () => fakeEl(), createElementNS: () => fakeEl() };
const warn = console.warn;
console.warn = () => undefined;
const { buildCityMap } = await import("../src/game/city");
const { RANGE_SOLIDS } = await import("../src/game/range");
const { BR_X, BR_Z } = await import("../src/game/br");
buildCityMap(new THREE.Scene());
console.warn = warn;

// the towers: tall tops, a real footprint, their middle in the centre sector (map-local |x|, |z| under 100)
const towers = RANGE_SOLIDS.filter((s) => s.top > 16 && s.maxX - s.minX >= 8 && s.maxZ - s.minZ >= 8 && Math.abs((s.minX + s.maxX) / 2 - BR_X) < 100 && Math.abs((s.minZ + s.maxZ) / 2 - BR_Z) < 100);
const rows: string[] = [];
const seen = new Set<string>();
for (const a of towers) {
  for (const b of towers) {
    if (a === b) continue;
    const key = [a, b].map((s) => `${s.minX},${s.minZ}`).sort().join("|");
    if (seen.has(key)) continue;
    // facing across x (a east face to b west face) or across z
    for (const axis of ["x", "z"] as const) {
      const gap = axis === "x" ? b.minX - a.maxX : b.minZ - a.maxZ;
      if (gap < 2.5 || gap > 6) continue;
      const lo = axis === "x" ? Math.max(a.minZ, b.minZ) : Math.max(a.minX, b.minX);
      const hi = axis === "x" ? Math.min(a.maxZ, b.maxZ) : Math.min(a.maxX, b.maxX);
      if (hi - lo < 10) continue;
      seen.add(key);
      const lower = Math.min(a.top, b.top);
      const mid = axis === "x" ? `x ${(a.maxX - BR_X).toFixed(1)} to ${(b.minX - BR_X).toFixed(1)}, z ${(lo - BR_Z).toFixed(1)} to ${(hi - BR_Z).toFixed(1)}` : `z ${(a.maxZ - BR_Z).toFixed(1)} to ${(b.minZ - BR_Z).toFixed(1)}, x ${(lo - BR_X).toFixed(1)} to ${(hi - BR_X).toFixed(1)}`;
      const use = gap <= 3.5 ? "chimney (nominal)" : gap <= 4.25 ? "chimney (hard)" : "too wide for the chain";
      rows.push(`${gap.toFixed(2)} m wide, ${(hi - lo).toFixed(1)} m long, walls to ${lower.toFixed(1)} m | ${mid} (map-local) | ${use}`);
    }
  }
}
rows.sort();
console.log(`${towers.length} towers in the centre; ${rows.length} canyons 2.5 to 6 m wide and 10 m long or more:`);
for (const r of rows) console.log(`  ${r}`);
