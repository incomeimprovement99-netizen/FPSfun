// What the world costs to draw, held to a budget (docs/PLAN_LOD_DRAW_DISTANCE.md
// step B), and how far each preset draws (step E).
//
// The map is built in node, as bot-walk.ts builds it, and counted: meshes,
// triangles, and the merge that takes thousands of little static meshes down
// to hundreds. The numbers below are today's with room over them, so an
// accident that doubles the map (it has happened: the whole thing was drawn
// twice until Milestone 100) fails here rather than in a frame.
//
// The draw distance is arithmetic, so it is checked exactly: each preset's
// fog ends where it draws, the near end keeps its proportion, and the camera's
// far plane sits beyond the fog, because anything clipped in clear air is the
// pop this was written to end.
//
// Run on its own: npx tsx tools/checks/render-budget.ts.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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
const { buildBrMap } = await import("../../src/game/br");
const { mergeStatic } = await import("../../src/game/staticmerge");
const { PRESETS, drawRange, sceneryFar } = await import("../../src/game/quality");
const scene = new THREE.Scene();
const map = buildBrMap(scene);
console.warn = warn;
if (!hadDocument) delete g.document;

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

/** every mesh under an object, and the triangles they hold */
function count(root: THREE.Object3D): { meshes: number; tris: number } {
  let meshes = 0;
  let tris = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    meshes++;
    const g2 = m.geometry;
    const n = g2.index ? g2.index.count : (g2.getAttribute("position")?.count ?? 0);
    tris += (n / 3) * ((m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1);
  });
  return { meshes, tris };
}

console.log("What the world costs to draw");
{
  const before = count(map.root);
  const side = new THREE.Group();
  scene.add(side);
  const report = mergeStatic(scene, [map.root], [side]);
  const merged = report.meshes - report.after;
  // the merge moves what it made into the side it was given, so both are counted
  const a = count(map.root);
  const b = count(side);
  const after = { meshes: a.meshes + b.meshes, tris: a.tris + b.tris };
  check("the battle royale's map is built out of thousands of little static meshes", before.meshes < 4600, `${before.meshes} meshes`);
  check("and is under its mesh budget once they are merged", after.meshes < 190, `${before.meshes} meshes -> ${after.meshes}, ${merged} of them merged away`);
  check("and under its triangle budget", after.tris < 330_000, `${Math.round(after.tris / 1000)}k triangles`);
  // the merge is the thing that has broken before: every static mesh went in twice
  check("the merge takes thousands of little meshes down to hundreds, not up", after.meshes < before.meshes / 3, `${before.meshes} -> ${after.meshes}`);
}
{
  // what the field's scenery costs if every cell of it were drawn at once
  const sc = map.scenery;
  // the kit dressed onto the buildings (brpoi.ts DRESSING, kitdress.ts): drawn
  // instanced, one mesh per kind of piece, so what it costs is the count of kinds
  const { DRESSING } = await import("../../src/game/brpoi");
  const kinds = new Set(DRESSING.map((x) => x.piece)).size;
  // what the dressing adds to a frame's triangles, each kind's count times its own (measured off the files)
  let dressTris = 0;
  const perKind = new Map<string, number>();
  for (const x of DRESSING) perKind.set(x.piece, (perKind.get(x.piece) ?? 0) + 1);
  for (const [piece, n] of perKind) {
    const path = resolve(process.cwd(), `public/models/kit/city/${piece}.gltf`);
    if (!existsSync(path)) continue;
    const g = JSON.parse(readFileSync(path, "utf8"));
    const tris = (g.meshes as Array<{ primitives: Array<{ indices?: number }> }>).reduce((t, m) => t + m.primitives.reduce((u, pr) => u + (pr.indices !== undefined ? g.accessors[pr.indices].count / 3 : 0), 0), 0);
    dressTris += tris * n;
  }
  check("and all of it together costs less than the map itself", dressTris < 200_000, `${Math.round(dressTris / 1000)}k triangles: ${[...perKind].map(([k, n]) => `${k} x${n}`).join(", ")}`);
  check("the buildings are dressed from the kit: hundreds of pieces in a handful of kinds", DRESSING.length > 200 && DRESSING.length < 4000 && kinds <= 12, `${DRESSING.length} pieces, ${kinds} kinds`);
  check("the field's scenery is a few hundred copies, not thousands", sc.rocks.length + sc.scrub.length + sc.cliffs.length < 400, `${sc.rocks.length} rocks, ${sc.scrub.length} scrub, ${sc.cliffs.length} faces`);
}
{
  const br = { near: 140, far: 680 };
  const range = { near: 55, far: 290 };
  const comp = drawRange(br, PRESETS.competitive);
  const high = drawRange(br, PRESETS.high);
  check("Competitive draws least and High most", PRESETS.competitive.drawDistance < PRESETS.balanced.drawDistance && PRESETS.balanced.drawDistance < PRESETS.high.drawDistance, `${PRESETS.competitive.drawDistance}, ${PRESETS.balanced.drawDistance}, ${PRESETS.high.drawDistance} m`);
  check("the fog ends where the preset stops drawing", comp.far === PRESETS.competitive.drawDistance && high.far === Math.min(br.far, PRESETS.high.drawDistance), `${comp.far} m and ${high.far} m`);
  check("the near end of the fog keeps its proportion, so the fall-off is the same shape", Math.abs(comp.near / comp.far - br.near / br.far) < 1e-9, `${comp.near.toFixed(0)} m`);
  check("the camera's far plane is beyond the fog's end, so nothing is cut off in clear air", comp.camFar > comp.far && high.camFar > high.far, `${comp.camFar} m and ${high.camFar} m`);
  const r = drawRange(range, PRESETS.competitive);
  check("a region whose fog is shorter than the preset draws keeps its own fog", r.far === range.far && r.near === range.near, `${r.near} to ${r.far} m`);
  // the draw distance has to reach something that is actually culled by it, or
  // it is only fog: the map is merged into meshes that span the whole of it
  const rock = (p: typeof PRESETS.high): number => sceneryFar(170, p);
  check("the field's scenery is drawn further on the presets that draw further", rock(PRESETS.competitive) < rock(PRESETS.balanced) && rock(PRESETS.balanced) < rock(PRESETS.high), `a rock's scan to ${rock(PRESETS.competitive)}, ${rock(PRESETS.balanced)} and ${rock(PRESETS.high)} m`);
  check("and on Balanced it is the distance it was tuned at", rock(PRESETS.balanced) === 170, `${rock(PRESETS.balanced)} m`);
}

console.log(fails === 0 ? "\nRENDER BUDGET PASS" : `\nRENDER BUDGET FAIL (${fails})`);
export const renderBudgetFails = fails;
if (process.argv[1]?.endsWith("render-budget.ts")) process.exit(fails === 0 ? 0 : 1);
