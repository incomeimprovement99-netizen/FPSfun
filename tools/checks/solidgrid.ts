// The collision grid (src/game/solidgrid.ts): every box a whole-list scan
// would find, the grid finds too. A grid that drops a box is a wall you can
// walk or shoot through, so this is checked against the brute force on the
// real battle royale map, with random rectangles and random rays, a door
// swung across a cell, and a box added and taken away (a hack's wall).
//
// Builds the real map in node, as bot-walk.ts does. Run on its own:
// npx tsx tools/checks/solidgrid.ts
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
const { RANGE_SOLIDS } = await import("../../src/game/range");
const { solidsIn, solidsAlong } = await import("../../src/game/solidgrid");
buildBrMap(new THREE.Scene());
console.warn = warn;

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

console.log("The collision grid");
{
  const n = RANGE_SOLIDS.length;
  check("the map is built: a real list to test against", n > 1000, `${n} boxes`);
  // rectangles: whatever overlaps, the grid hands back
  let missedRect = 0;
  let saved = 0;
  for (let i = 0; i < 3000; i++) {
    const x = -230 + rnd() * 460;
    const z = 270 + rnd() * 460;
    const r = 0.2 + rnd() * 6;
    const got = new Set(solidsIn(x - r, x + r, z - r, z + r));
    saved += n - got.size;
    for (const s of RANGE_SOLIDS) if (x + r > s.minX && x - r < s.maxX && z + r > s.minZ && z - r < s.maxZ && !got.has(s)) missedRect++;
  }
  check("3000 rectangles: every box that overlaps one is handed back", missedRect === 0, `${missedRect} missed`);
  check("and the grid leaves out most of the list", saved / 3000 > n * 0.9, `${Math.round(saved / 3000)} of ${n} left out a query`);
  // rays: every box a ray enters, the grid hands back (the same slab test the projectiles use)
  const enters = (p: THREE.Vector3, d: THREE.Vector3, len: number, s: (typeof RANGE_SOLIDS)[number]): boolean => {
    let t0 = 0;
    let t1 = len;
    for (const [o, v, lo, hi] of [
      [p.x, d.x, s.minX, s.maxX],
      [p.y, d.y, s.base, s.top],
      [p.z, d.z, s.minZ, s.maxZ],
    ] as const) {
      if (Math.abs(v) < 1e-9) {
        if (o < lo || o > hi) return false;
        continue;
      }
      let a = (lo - o) / v;
      let b = (hi - o) / v;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) return false;
    }
    return true;
  };
  let missedRay = 0;
  for (let i = 0; i < 1500; i++) {
    const p = new THREE.Vector3(-230 + rnd() * 460, rnd() * 30, 270 + rnd() * 460);
    const d = new THREE.Vector3(rnd() - 0.5, (rnd() - 0.5) * 0.4, rnd() - 0.5).normalize();
    const len = 5 + rnd() * 250;
    const got = new Set(solidsAlong(p, d, len));
    for (const s of RANGE_SOLIDS) if (enters(p, d, len, s) && !got.has(s)) missedRay++;
  }
  check("1500 rays up to 255 m: every box a ray enters is handed back", missedRay === 0, `${missedRay} missed`);
  // a door moves as it swings: wherever it goes, it is found
  const door = RANGE_SOLIDS.find((s) => s.door);
  if (door) {
    const was = { ...door };
    door.minX += 5;
    door.maxX += 5;
    const found = solidsIn(door.minX, door.maxX, door.minZ, door.maxZ).includes(door);
    Object.assign(door, was);
    check("a door swung five metres off its cell is still found", found);
  }
  // a box put up and taken down (a hack's wall): found, then gone
  const wall = { minX: 10, maxX: 12, minZ: 510, maxZ: 511, base: 0, top: 3 };
  RANGE_SOLIDS.push(wall);
  const up = solidsIn(9, 13, 509, 512).includes(wall);
  RANGE_SOLIDS.splice(RANGE_SOLIDS.indexOf(wall), 1);
  const down = !solidsIn(9, 13, 509, 512).includes(wall);
  check("a box added is found at once, and gone once it is taken away", up && down);
}

console.log(fails === 0 ? "\nSOLID GRID PASS" : `\nSOLID GRID FAIL (${fails})`);
export const solidGridFails = fails;
if (process.argv[1]?.endsWith("solidgrid.ts")) process.exit(fails === 0 ? 0 : 1);
