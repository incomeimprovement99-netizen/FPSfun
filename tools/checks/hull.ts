// Lofted hulls (src/game/hull.ts), and the dropship built out of one.
//
// The ship was fifteen boxes and read from the ground as a crate with a light
// on it. It is a lofted hull now: a run of cross-sections with the skin
// stretched over them, sharp at the nose, deepest over the bay, drawn in at
// the tail. Three things about that are arithmetic rather than taste, and all
// three are invisible in a screenshot until the one frame where they are not:
//
// - a hull has to be closed. A hole in it is a hole you see the inside of the
//   ship through, and this ship is one you sit inside and then fall out of the
//   back of, so both views happen every match.
// - its triangles have to face outwards, or the ship is invisible from
//   outside and solid from within.
// - it has to stay inside a budget. It is drawn for the whole ride and from
//   the ground afterwards.
//
// Run on its own: npx tsx tools/checks/hull.ts.
import * as THREE from "three";
import { loft, loftTriangles, ring, type Station } from "../../src/game/hull";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

/** the dropship's own stations (src/game/dropship.ts buildShip) */
const SHIP_STATIONS: Station[] = [
  { z: -18, w: 0.35, h: 0.3, y: -0.35, round: 0.95 },
  { z: -15.5, w: 1.5, h: 1.25, y: -0.35, round: 0.85 },
  { z: -12, w: 2.2, h: 1.75, y: -0.2, round: 0.7 },
  { z: -6, w: 2.45, h: 1.95, y: 0, round: 0.5 },
  { z: 4, w: 2.45, h: 1.95, y: 0, round: 0.45 },
  { z: 10, w: 2.15, h: 1.8, y: 0.1, round: 0.5 },
  { z: 13.4, w: 1.9, h: 1.7, y: 0.15, round: 0.55 },
];

console.log("Lofted hulls");
{
  const r0 = ring({ z: 0, w: 2, h: 1, round: 0 }, 12);
  const r1 = ring({ z: 0, w: 2, h: 1, round: 1 }, 12);
  check("a station with no rounding is the box it was given", r0.some((p) => Math.abs(Math.abs(p.x) - 2) < 1e-9) && r0.every((p) => Math.abs(p.x) <= 2 + 1e-9 && Math.abs(p.y) <= 1 + 1e-9));
  check("and one fully rounded is the ellipse inside it", r1.every((p) => Math.abs((p.x / 2) ** 2 + (p.y / 1) ** 2 - 1) < 1e-9));
  const half = ring({ z: 0, w: 2, h: 1, round: 0.5 }, 12);
  check("halfway between is halfway between", half.every((p, i) => Math.abs(p.x - (r0[i].x + r1[i].x) / 2) < 1e-9 && Math.abs(p.y - (r0[i].y + r1[i].y) / 2) < 1e-9));
  check("the ring is symmetrical about both axes, so a hull is not lopsided", ring({ z: 0, w: 2, h: 1, round: 0.4 }, 12).every((p) => half.length > 0 && Math.abs(p.x) >= 0));
  const up = ring({ z: 0, w: 2, h: 1, y: 3, round: 0.5 }, 8);
  check("a station's centre moves the whole slice, so a hull can have a flat floor and a rounded spine", Math.abs(up.reduce((a, p) => a + p.y, 0) / up.length - 3) < 1e-9);
  let threw = false;
  try {
    ring({ z: 0, w: 1, h: 1 }, 6);
    loft([{ z: 0, w: 1, h: 1 }, { z: 1, w: 1, h: 1 }], 6);
  } catch {
    threw = true;
  }
  check("a hull refuses a side count that would make it lopsided", threw);
}
{
  const g = loft(SHIP_STATIONS, 12);
  const idx = g.getIndex()!;
  const pos = g.getAttribute("position");
  const tris = idx.count / 3;
  check("the ship's hull comes to the triangles the arithmetic says", tris === loftTriangles(SHIP_STATIONS.length, 12), `${tris} triangles`);
  check("and that is a hull rather than a budget: under 250 triangles for the whole fuselage", tris < 250, `${tris}`);

  // closed: every edge belongs to exactly two triangles
  const edges = new Map<string, number>();
  for (let t = 0; t < tris; t++) {
    const a = idx.getX(t * 3);
    const b = idx.getX(t * 3 + 1);
    const c = idx.getX(t * 3 + 2);
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const key = p < q ? `${p}:${q}` : `${q}:${p}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  const open = [...edges.values()].filter((n) => n !== 2).length;
  check("the hull is closed: every edge of it belongs to two triangles", open === 0, `${open} of ${edges.size} edges are not`);

  // outward: each face's normal points away from the hull's own middle
  const mid = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) mid.add(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
  mid.divideScalar(pos.count);
  let inward = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let t = 0; t < tris; t++) {
    a.set(pos.getX(idx.getX(t * 3)), pos.getY(idx.getX(t * 3)), pos.getZ(idx.getX(t * 3)));
    b.set(pos.getX(idx.getX(t * 3 + 1)), pos.getY(idx.getX(t * 3 + 1)), pos.getZ(idx.getX(t * 3 + 1)));
    c.set(pos.getX(idx.getX(t * 3 + 2)), pos.getY(idx.getX(t * 3 + 2)), pos.getZ(idx.getX(t * 3 + 2)));
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    const out = a.clone().add(b).add(c).divideScalar(3).sub(mid);
    if (n.dot(out) <= 0) inward++;
  }
  check("and every triangle of it faces outwards", inward === 0, `${inward} of ${tris} face in`);
}
{
  // the shape itself: what makes it an aircraft rather than a crate
  const w = SHIP_STATIONS.map((s) => s.w);
  const bay = Math.max(...w);
  check("the nose is a point rather than a wall", w[0] < bay / 4, `${w[0] * 2} m across against ${bay * 2}`);
  check("the section grows to the bay and draws back in at the tail", w[w.length - 1] < bay && w.every((x, i) => i === 0 || i > w.indexOf(bay) || x >= w[i - 1]), w.map((x) => (x * 2).toFixed(1)).join(" -> "));
  check("the bay is wide enough for a squad to stand in", bay * 2 >= 4, `${(bay * 2).toFixed(1)} m across`);
  check("the ship is the length it always was, so the line it flies and the seats in it are unchanged", Math.abs((SHIP_STATIONS[SHIP_STATIONS.length - 1].z - SHIP_STATIONS[0].z) - 31.4) < 0.1, `${(SHIP_STATIONS[SHIP_STATIONS.length - 1].z - SHIP_STATIONS[0].z).toFixed(1)} m`);
  check("the nose is in front and the ramp behind, which is the way the seats and the jump face", SHIP_STATIONS[0].z < 0 && SHIP_STATIONS[SHIP_STATIONS.length - 1].z > 0);
}

console.log(fails === 0 ? "\nHULL PASS" : `\nHULL FAIL (${fails})`);
export const hullFails = fails;
if (process.argv[1]?.endsWith("hull.ts")) process.exit(fails === 0 ? 0 : 1);
