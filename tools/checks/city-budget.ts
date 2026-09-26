// What the SpeedKills city costs to draw, held to a budget as the legacy map
// is (render-budget.ts). The city is built in node, as SpeedKills builds it,
// and counted before and after the static merge: meshes (each one a draw
// call, before the merge), triangles, and the lights, which a forward
// renderer pays for on every lit pixel.
//
// The numbers are today's with room over them, so an accident that doubles
// the city (a building laid out twice, a neon strip per window instead of per
// band) fails here rather than in a frame. The frame itself is measured on the
// GPU by `BENCH_SPOT=skmatch npm run bench` (tools/bench.ts).
//
// It needs the game named: GAME=speedkills npx tsx tools/checks/city-budget.ts
// (verify runs it that way).
import * as THREE from "three";

const g = globalThis as unknown as Record<string, unknown>;
const hadDocument = "document" in g;
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
const { IS_SK } = await import("../../src/game/game");
const { buildCityMap } = await import("../../src/game/city");
const { mergeStatic } = await import("../../src/game/staticmerge");
const scene = new THREE.Scene();
const map = buildCityMap(scene);
console.warn = warn;
if (!hadDocument) delete g.document;

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

/** every mesh under an object, the triangles they hold, and the lights */
function count(root: THREE.Object3D): { meshes: number; tris: number; lights: number } {
  let meshes = 0;
  let tris = 0;
  let lights = 0;
  root.traverse((o) => {
    if ((o as THREE.Light).isLight) lights++;
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    meshes++;
    const g2 = m.geometry;
    const n = g2.index ? g2.index.count : (g2.getAttribute("position")?.count ?? 0);
    tris += (n / 3) * ((m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1);
  });
  return { meshes, tris, lights };
}

/**
 * Measured 2026-09-26: 14,852 meshes, 212 once merged, 180k triangles, no
 * lights. The budget is that with about a third over it. Then, with the
 * mid-rise ring's buildings entered by their stairs (Milestone 212): 12,771
 * meshes, 321 once merged, 201k triangles. The merged count rose because
 * a sector's buildings now use more of the facade materials, and the merge
 * makes one mesh a sector a material (a sector dissolves on its own); the
 * limit on it is that with a quarter over.
 */
const BUDGET = { meshesBefore: 20_000, meshesAfter: 400, tris: 240_000, lights: 8 };
console.log("What the SpeedKills city costs to draw");
check("this is SpeedKills (the city is its map)", IS_SK);
{
  const before = count(map.root);
  const side = new THREE.Group();
  scene.add(side);
  const report = mergeStatic(scene, [map.root], [side]);
  const a = count(map.root);
  const b = count(side);
  const after = { meshes: a.meshes + b.meshes, tris: a.tris + b.tris };
  const B = BUDGET;
  check("the city is built of thousands of static pieces", before.meshes > 1000 && before.meshes < B.meshesBefore, `${before.meshes} meshes`);
  check("and is under its mesh budget once they are merged", after.meshes < B.meshesAfter, `${before.meshes} -> ${after.meshes}, ${report.meshes - report.after} merged away`);
  check("the merge takes them down, not up", after.meshes < before.meshes / 3, `${before.meshes} -> ${after.meshes}`);
  check("and under its triangle budget", after.tris < B.tris, `${Math.round(after.tris / 1000)}k triangles`);
  check("few real lights: the neon glows by its material, not by a light each", before.lights <= B.lights, `${before.lights} lights`);
}

console.log(fails === 0 ? "\nCITY BUDGET PASS" : `\nCITY BUDGET FAIL (${fails})`);
export const cityBudgetFails = fails;
if (process.argv[1]?.endsWith("city-budget.ts")) process.exit(fails === 0 ? 0 : 1);
