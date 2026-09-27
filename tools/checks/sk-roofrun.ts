// SpeedKills' roofs as a way across the city (docs/PHASE_20_PLAN.md A17). Hyper Scape was a city crossed by its
// roofs; this is what fails if a change to the movement (gravity above all, which moves every gap) or to the city
// breaks that flow.
//
// The roofs are the city's exposed tops, 6 m up and more and 8 m across. From each, toward every roof it faces
// across a gap, a player sprints from 10 m back, jumps at the edge and double jumps at the top of the arc, driven
// frame by frame through the real controller over the real city's solids. A jump that lands on the far roof,
// without the feet touching the street, is an edge of the roofs' network. Held: how many roofs the best roof
// reaches that way, and the widest gap crossed.
//
// It needs the game named: GAME=speedkills npx tsx tools/checks/sk-roofrun.ts (verify runs it that way).
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
const { GAME } = await import("../../src/game/game");
const { buildCityMap } = await import("../../src/game/city");
const { RANGE_SOLIDS } = await import("../../src/game/range");
const { Player } = await import("../../src/game/player");
const { BR_X, BR_Z, BR_HALF } = await import("../../src/game/br");
buildCityMap(new THREE.Scene());
console.warn = warn;
if (!hadDocument) delete g.document;

type Action = import("../../src/game/input").Action;

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log(`\nSpeedKills' roofs, run (game: ${GAME})`);
check("this runs with SpeedKills' numbers", GAME === "speedkills");

/** the highest top at or under y + 0.3 at (x, z): what a foot there stands on */
function groundAt(x: number, z: number, y: number): number {
  let top = 0;
  for (const s of RANGE_SOLIDS) if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ && s.top <= y + 0.3 && s.top > top) top = s.top;
  return top;
}

// the roofs: big tops with nothing over their middle
type Roof = { minX: number; maxX: number; minZ: number; maxZ: number; top: number };
const roofs: Roof[] = [];
for (const s of RANGE_SOLIDS) {
  if (s.top < 6 || s.maxX - s.minX < 8 || s.maxZ - s.minZ < 8) continue;
  const cx = (s.minX + s.maxX) / 2;
  const cz = (s.minZ + s.maxZ) / 2;
  if (Math.abs(cx - BR_X) > BR_HALF || Math.abs(cz - BR_Z) > BR_HALF) continue;
  if (groundAt(cx, cz, 1000) > s.top + 0.3) continue;
  if (roofs.some((r) => r.top === s.top && r.minX === s.minX && r.minZ === s.minZ)) continue;
  roofs.push({ minX: s.minX, maxX: s.maxX, minZ: s.minZ, maxZ: s.maxZ, top: s.top });
}

class Script {
  down = new Set<Action>();
  taps = new Set<Action>();
  held = (a: Action): boolean => this.down.has(a) || this.taps.has(a);
  pressedNow = (a: Action): boolean => this.taps.has(a);
}

const DT = 1 / 90;
const inside = (r: Roof, x: number, z: number, m = 0): boolean => x >= r.minX - m && x <= r.maxX + m && z >= r.minZ - m && z <= r.maxZ + m;
/** from roof a to roof b along (dx, dz) through (x, z) on a: did the feet land on b without touching the street */
function jump(a: Roof, b: Roof, x: number, z: number, dx: number, dz: number): boolean {
  const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
  p.extraMoves = true;
  p.autoClimb = true;
  p.sprintMode = "auto";
  p.teleport(x, a.top, z, Math.atan2(-dx, -dz) * (180 / Math.PI));
  const s = new Script();
  s.down.add("forward");
  let t = 1000;
  let jumped = false;
  let doubled = false;
  for (let i = 0; i < 6 / DT; i++) {
    t += DT;
    if (p.onGround && !jumped && inside(a, p.pos.x, p.pos.z) && groundAt(p.pos.x + dx * 1.5, p.pos.z + dz * 1.5, p.pos.y) < p.pos.y - 1) {
      s.taps.add("jump");
      jumped = true;
    } else if (jumped && !doubled && !p.onGround && p.vel.y < 0.5 && !p.climbing) {
      s.taps.add("jump");
      doubled = true;
    }
    p.update(DT, t, s, 0, 1, false);
    s.taps.clear();
    if (p.onGround && p.pos.y < 0.5) return false;
    if (jumped && p.onGround && !p.climbing && Math.abs(p.pos.y - b.top) < 0.6 && inside(b, p.pos.x, p.pos.z)) return true;
  }
  return false;
}

// every facing pair across a gap of 2 to 40 m, overlapping by 4 m and more where they face
const edges = new Map<number, Set<number>>();
let tried = 0;
let widest = 0;
const t0 = performance.now();
for (let i = 0; i < roofs.length; i++) {
  for (let j = 0; j < roofs.length; j++) {
    if (i === j) continue;
    const a = roofs[i];
    const b = roofs[j];
    for (const [axis, dir] of [["x", 1], ["x", -1], ["z", 1], ["z", -1]] as const) {
      const gap = axis === "x" ? (dir > 0 ? b.minX - a.maxX : a.minX - b.maxX) : dir > 0 ? b.minZ - a.maxZ : a.minZ - b.maxZ;
      if (gap < 2 || gap > 40) continue;
      const lo = axis === "x" ? Math.max(a.minZ, b.minZ) : Math.max(a.minX, b.minX);
      const hi = axis === "x" ? Math.min(a.maxZ, b.maxZ) : Math.min(a.maxX, b.maxX);
      if (hi - lo < 4) continue;
      const mid = (lo + hi) / 2;
      const back = Math.min(10, (axis === "x" ? a.maxX - a.minX : a.maxZ - a.minZ) - 1);
      const x = axis === "x" ? (dir > 0 ? a.maxX - back : a.minX + back) : mid;
      const z = axis === "z" ? (dir > 0 ? a.maxZ - back : a.minZ + back) : mid;
      tried++;
      if (jump(a, b, x, z, axis === "x" ? dir : 0, axis === "z" ? dir : 0)) {
        if (!edges.has(i)) edges.set(i, new Set());
        edges.get(i)!.add(j);
        widest = Math.max(widest, gap);
      }
    }
  }
}
const secs = (performance.now() - t0) / 1000;

// from each roof, every roof reachable by jumps alone
let best = 0;
let bestFrom = -1;
for (let i = 0; i < roofs.length; i++) {
  const seen = new Set([i]);
  const todo = [i];
  while (todo.length) for (const j of edges.get(todo.pop()!) ?? []) if (!seen.has(j)) (seen.add(j), todo.push(j));
  if (seen.size > best) (best = seen.size, bestFrom = i);
}
const jumps = [...edges.values()].reduce((n, s) => n + s.size, 0);
const f = roofs[bestFrom];
console.log(`        ${roofs.length} roofs; ${tried} facing gaps tried, ${jumps} crossed, in ${secs.toFixed(1)} s`);
// Held at what the city and the movement give today (Phase 20 A15's sprint, 2026-09-26: 147 crossings, 9 roofs from
// the best), a tenth under, so a change that breaks the flow fails; a deliberate change (A17's footage numbers)
// moves these with its reason. The first pass's 275 hu/s sprint crossed 99 and reached 7, and fails both.
check("the gaps a sprint and a double jump cross: 130 and more of the facing gaps", jumps >= 130, `${jumps} of ${tried}`);
check("the roofs join up: from the best roof, 8 and more are reached by jumps alone, never touching the street", best >= 8, `${best} roofs from the one at (${f ? ((f.minX + f.maxX) / 2).toFixed(0) : "?"}, ${f ? ((f.minZ + f.maxZ) / 2).toFixed(0) : "?"}), ${f?.top.toFixed(1)} m up`);
check("and a street's width is crossed roof to roof (14 m)", widest >= 14, `widest gap crossed ${widest.toFixed(1)} m`);

console.log(fails === 0 ? "\nSK ROOF RUN PASS" : `\nSK ROOF RUN FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
