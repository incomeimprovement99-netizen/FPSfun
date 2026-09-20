// The field's scenery: the rocks that carry the cover's colliders, the dead
// scrub that carries none, and the cliff faces along the map's edge
// (src/game/br.ts, drawn by props.ts placeInstanced as one instanced mesh per
// mesh of each model).
//
// Builds the real map in node, as bot-walk.ts does. What has to hold: every
// rock has the box it fills (its collider is that box, so movement is the
// same whether or not the scans are in), a boxed shape is drawn for each until
// they are, nothing of the scrub stands on a road or in a place, and the
// faces are along the four edges.
//
// Run on its own: npx tsx tools/checks/scenery.ts.
import * as THREE from "three";

const g = globalThis as unknown as Record<string, unknown>;
const hadDocument = "document" in g;
// anything asked of it answers with more of itself: a canvas, its context, an image
const anyProxy = (): unknown =>
  new Proxy(function () {}, {
    get: (_t, k) => (k === "measureText" ? () => ({ width: 10 }) : k === Symbol.toPrimitive ? () => 0 : k === "width" || k === "height" ? 64 : anyProxy()),
    set: () => true,
    apply: () => anyProxy(),
  });
const fakeEl = (): unknown => ({ width: 64, height: 64, style: {}, getContext: () => anyProxy(), addEventListener() {}, removeEventListener() {}, set src(_v: string) {} });
if (!hadDocument) g.document = { createElement: () => fakeEl(), createElementNS: () => fakeEl() };
const warn = console.warn;
console.warn = () => undefined;
const { buildBrMap } = await import("../../src/game/br");
const map = buildBrMap(new THREE.Scene());
console.warn = warn;
if (!hadDocument) delete g.document;

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("The field's rock, scrub and cliffs");
{
  const sc = map.scenery;
  check("every rock of the field's cover has a place and the box it fills", sc.rocks.length >= 30 && sc.rocks.every((r) => r.fit.w > 0.5 && r.fit.h > 0.5 && r.fit.d > 0.5 && Number.isFinite(r.x) && Number.isFinite(r.z)), `${sc.rocks.length} rocks`);
  check("and a boxed shape drawn for each, to stand in until the scans are in", sc.boxed.length === sc.rocks.length && sc.boxed.every((m) => m.isMesh), `${sc.boxed.length} boxed`);
  check("the dead scrub is scattered over the field, in its three kinds, and carries no collider", sc.scrub.length >= 30 && new Set(sc.scrub.map((s) => s.kind)).size === 3, `${sc.scrub.length} pieces: ${[...new Set(sc.scrub.map((s) => s.kind))].join(", ")}`);
  check("no scrub stands on a road or inside a place", sc.scrub.every((s) => { const x = s.x; const z = s.z; const onRoad = (Math.abs(x) < 9 && Math.abs(z) < 172) || (Math.abs(z) < 9 && Math.abs(x) < 172); const nearPoi = [[0, 0, 50], [0, -165, 38], [0, 165, 38], [165, 0, 38], [-165, 0, 38]].some(([px, pz, r]) => Math.hypot(x - px, z - pz) < r); return !onRoad && !nearPoi; }));
  check("the cliff faces stand along the four edges of the map, facing in", sc.cliffs.length >= 40 && sc.cliffs.every((c) => Math.abs(Math.abs(c.x) - 200) < 8 || Math.abs(Math.abs(c.z) - 200) < 8), `${sc.cliffs.length} faces`);
  const kinds = sc.scrub.reduce<Record<string, number>>((a, s) => ({ ...a, [s.kind]: (a[s.kind] ?? 0) + 1 }), {});
  console.log(`  --  the first scrub stands at ${sc.scrub[0] ? `${sc.scrub[0].x.toFixed(0)}, ${sc.scrub[0].z.toFixed(0)}` : "nowhere"} (${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(", ")})`);
}

console.log(fails === 0 ? "\nSCENERY PASS" : `\nSCENERY FAIL (${fails})`);
export const sceneryFails = fails;
if (process.argv[1]?.endsWith("scenery.ts")) process.exit(fails === 0 ? 0 : 1);
