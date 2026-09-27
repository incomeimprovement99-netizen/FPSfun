// The metro under SpeedKills' centre (city.json metro, city.ts METRO): the one place in the city below the street.
// Its floor is the world's there (range.ts floorAt), so everything that stands, falls or lands has to stop on it and
// not at the street's height, and nothing standing on the street over it may drop through. Run with the real movement
// over the real city: down every stair from the street and back up, the length of every side of the loop at a sprint,
// the street over it, a fall down a stairwell.
//
// Run: GAME=speedkills npx tsx tools/checks/sk-metro.ts
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
const { buildCityMap, METRO } = await import("../../src/game/city");
const { Player } = await import("../../src/game/player");
const { floorAt } = await import("../../src/game/floors");
const { BR_X, BR_Z } = await import("../../src/game/br");
const { ProjectileSystem } = await import("../../src/game/projectile");
const { resolveWeapon } = await import("../../src/game/weapons");
const { throwPath } = await import("../../src/game/throwables");
const { botGroundAt } = await import("../../src/game/botbody");
const { surfaceUnder } = await import("../../src/game/dropship");
const { RANGE_SOLIDS } = await import("../../src/game/range");
const map = buildCityMap(new THREE.Scene());
console.warn = warn;
if (!hadDocument) delete g.document;

type Action = import("../../src/game/input").Action;
let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
class Script {
  down = new Set<Action>();
  taps = new Set<Action>();
  held = (a: Action): boolean => this.down.has(a) || this.taps.has(a);
  pressedNow = (a: Action): boolean => this.taps.has(a);
}
const DT = 1 / 144;
const yawTo = (dx: number, dz: number): number => (Math.atan2(-dx, -dz) * 180) / Math.PI;
function body(): InstanceType<typeof Player> {
  const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
  p.extraMoves = true;
  p.autoClimb = true;
  p.sprintMode = "auto";
  return p;
}
/** a walk (a sprint in SpeedKills, forward held) from `from` toward `to`, standing at height y; where it ended, and whether it climbed */
function walk(from: { x: number; z: number }, y: number, to: { x: number; z: number }, seconds: number): { x: number; y: number; z: number; low: number; climbed: boolean; onGround: boolean } {
  const p = body();
  p.teleport(from.x, y, from.z, yawTo(to.x - from.x, to.z - from.z));
  const s = new Script();
  s.down.add("forward");
  let t = 1000;
  let low = Infinity;
  let climbed = false;
  const len = Math.hypot(to.x - from.x, to.z - from.z);
  for (let i = 0; i < seconds / DT; i++) {
    t += DT;
    p.update(DT, t, s, 0, 1, false);
    low = Math.min(low, p.pos.y);
    if (p.climbing || p.stance === "mantle") climbed = true;
    // past the end: stop there
    if ((p.pos.x - from.x) * (to.x - from.x) + (p.pos.z - from.z) * (to.z - from.z) >= len * len) break;
  }
  return { x: p.pos.x, y: p.pos.y, z: p.pos.z, low, climbed, onGround: p.onGround };
}

console.log(`\nThe metro under the centre (game: ${GAME})`);
check("this runs with SpeedKills' movement", GAME === "speedkills");
check("the loop has its four sides and its stairs, two to a side", METRO.sides.length === 4 && METRO.stairs.length === 8, `${METRO.sides.length} sides, ${METRO.stairs.length} stairs`);
const mids = METRO.sides.map((s) => ({ x: (s.minX + s.maxX) / 2, z: (s.minZ + s.maxZ) / 2 }));
check(
  "the world's floor is the metro's under every side, and the street's just outside it",
  METRO.floor < -4 && mids.every((m) => floorAt(m.x, m.z) === METRO.floor) && METRO.sides.every((s) => floorAt(s.maxX + 1, s.maxZ + 1) === 0 || floorAt(s.maxX + 1, s.maxZ + 1) === METRO.floor),
  `${METRO.floor} m`,
);

// down every stair and back up, walking: no climb, no fall
const down = METRO.stairs.map((st) => ({ st, r: walk(st.top, 0.01, st.foot, 6) }));
check(
  `down every stair (${METRO.stairs.length}) from the street onto the tunnel's floor, a walk, no climb`,
  down.every(({ r }) => r.onGround && Math.abs(r.y - METRO.floor) < 0.1 && !r.climbed),
  down.filter(({ r }) => !(r.onGround && Math.abs(r.y - METRO.floor) < 0.1 && !r.climbed)).map(({ st, r }) => `${(st.top.x - BR_X).toFixed(0)},${(st.top.z - BR_Z).toFixed(0)}: ended at ${r.y.toFixed(2)} m${r.climbed ? ", climbed" : ""}`).join("; ") || "all",
);
const up = METRO.stairs.map((st) => ({ st, r: walk(st.foot, METRO.floor + 0.01, st.top, 6) }));
check(
  "and up every one from the floor onto the street",
  up.every(({ r }) => r.onGround && Math.abs(r.y) < 0.1 && !r.climbed && Math.abs(r.low - METRO.floor) < 0.1),
  up.filter(({ r }) => !(r.onGround && Math.abs(r.y) < 0.1 && !r.climbed && Math.abs(r.low - METRO.floor) < 0.1)).map(({ st, r }) => `${(st.foot.x - BR_X).toFixed(0)},${(st.foot.z - BR_Z).toFixed(0)}: ended at ${r.y.toFixed(2)} m, lowest ${r.low.toFixed(2)}${r.climbed ? ", climbed" : ""}`).join("; ") || "all",
);

// the length of every side at a sprint, down its track, never leaving the floor
const runs = METRO.sides.map((s) => {
  const line = s.alongX ? (s.minZ + s.maxZ) / 2 + 0.5 * Math.sign((s.minZ + s.maxZ) / 2 - BR_Z) : (s.minX + s.maxX) / 2 + 0.5 * Math.sign((s.minX + s.maxX) / 2 - BR_X);
  const a = s.alongX ? { x: s.minX + 2, z: line } : { x: line, z: s.minZ + 2 };
  const b = s.alongX ? { x: s.maxX - 2, z: line } : { x: line, z: s.maxZ - 2 };
  const r = walk(a, METRO.floor + 0.01, b, 12);
  return { s, len: Math.hypot(b.x - a.x, b.z - a.z), got: Math.hypot(r.x - a.x, r.z - a.z), r };
});
check(
  "the length of every side of the loop at a sprint, on the tunnel's floor all the way",
  runs.every((q) => q.got >= q.len - 0.5 && Math.abs(q.r.low - METRO.floor) < 0.1),
  runs.map((q) => `${q.got.toFixed(0)} of ${q.len.toFixed(0)} m, lowest ${q.r.low.toFixed(2)}`).join("; "),
);

// the street over it holds: a walk across it stays on the street
const over = METRO.sides.map((s) => {
  const m = { x: (s.minX + s.maxX) / 2 + (s.alongX ? 3 : 0), z: (s.minZ + s.maxZ) / 2 + (s.alongX ? 0 : 3) };
  const a = s.alongX ? { x: m.x, z: s.minZ - 3 } : { x: s.minX - 3, z: m.z };
  const b = s.alongX ? { x: m.x, z: s.maxZ + 3 } : { x: s.maxX + 3, z: m.z };
  return walk(a, 0.19, b, 4);
});
check("the street over every side holds a walk across it", over.every((r) => r.low > -0.05), over.map((r) => r.low.toFixed(2)).join(", "));

// a fall down a stairwell from its side lands on the stair or the floor, never under it
const falls = METRO.stairs.map((st) => {
  const p = body();
  const cx = (st.x0 + st.x1) / 2;
  const cz = (st.z0 + st.z1) / 2;
  p.teleport(cx, 3, cz, 0);
  const s = new Script();
  let t = 1000;
  for (let i = 0; i < 3 / DT; i++) {
    t += DT;
    p.update(DT, t, s, 0, 1, false);
  }
  return p.pos.y;
});
check("dropped into every stairwell, a body lands on its stair, above the floor and under the street", falls.every((y) => y >= METRO.floor - 0.05 && y < -0.3), falls.map((y) => y.toFixed(2)).join(", "));

// what else stands, flies or lands down there: a bot's feet, a round, a grenade, a drop
const side = METRO.sides[0];
const along = side.alongX;
const mid = { x: (side.minX + side.maxX) / 2, z: (side.minZ + side.maxZ) / 2 };
const lane = along ? { x: mid.x - 30, z: mid.z + 0.5 * Math.sign(mid.z - BR_Z) } : { x: mid.x + 0.5 * Math.sign(mid.x - BR_X), z: mid.z - 30 };
check(
  "a bot stands on the tunnel's floor, and on the street over it",
  Math.abs(botGroundAt(lane.x, lane.z, METRO.floor + 0.01) - METRO.floor) < 0.01 && Math.abs(botGroundAt(lane.x, lane.z, 0.3)) < 0.01,
  `${botGroundAt(lane.x, lane.z, METRO.floor + 0.01)} and ${botGroundAt(lane.x, lane.z, 0.3)}`,
);
check("what a drop lands on over it is the street, and down in it the floor", Math.abs(surfaceUnder(lane.x, lane.z, 50)) < 0.01 && Math.abs(surfaceUnder(lane.x, lane.z, METRO.floor + 1) - METRO.floor) < 0.01);
{
  const ps = new ProjectileSystem(new THREE.Scene(), [], [], 0);
  const w = resolveWeapon("r97", 2);
  const dir = along ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const from = new THREE.Vector3(lane.x, METRO.floor + 1.5, lane.z);
  ps.fire(from, dir, w);
  let hit: THREE.Vector3 | null = null;
  for (let i = 0; i < 120 && !hit; i++) ps.update(1 / 120, 10 + i / 120, (e) => (hit ??= e.point.clone()));
  const flew = hit ? (hit as THREE.Vector3).distanceTo(from) : Infinity;
  check("a round fired down the tunnel flies down it, 20 m and more, not stopped at the street's height", flew >= 20, `${Number.isFinite(flew) ? flew.toFixed(1) : "never"} m`);
}
{
  const from = new THREE.Vector3(lane.x, METRO.floor + 1.5, lane.z);
  const vel = along ? new THREE.Vector3(9, 3, 0) : new THREE.Vector3(0, 3, 9);
  const path = throwPath(from, vel);
  const end = path[path.length - 1];
  check("a grenade thrown down the tunnel flies and lands on its floor", path.length > 5 && end.distanceTo(from) > 4 && Math.abs(end.y - METRO.floor) < 0.3, `${path.length} steps, ${end.distanceTo(from).toFixed(1)} m, ends at ${end.y.toFixed(2)} m`);
}
// loot of its own down there, drawn after everything and on its own stream: the loot above is the same item for item
// with the metro and without it (putting the tunnel's floor in the field's own spots moved every item after them)
{
  const { LootField } = await import("../../src/game/loot");
  const { FLOORS } = await import("../../src/game/floors");
  const bounds = { minX: BR_X - 250, maxX: BR_X + 250, minZ: BR_Z - 250, maxZ: BR_Z + 250 };
  const places = map.pois.map((p: { x: number; z: number }) => ({ x: p.x, z: p.z, radius: 30 }));
  const field = new LootField(null);
  const above = (seed: number): { up: string[]; down: number } => {
    field.generate(seed, places, bounds);
    const all = [...field.drops.values()];
    return { up: all.filter((d) => d.pos.y > -1).map((d) => `${d.item.kind}:${d.item.id}@${d.pos.x.toFixed(2)},${d.pos.y.toFixed(2)},${d.pos.z.toFixed(2)}`), down: all.filter((d) => d.pos.y < METRO.floor + 1).length };
  };
  const seeds = [7, 42, 1234];
  const withMetro = seeds.map(above);
  const saved = FLOORS.splice(0, FLOORS.length);
  const without = seeds.map(above);
  FLOORS.push(...saved);
  check(
    "the metro has loot of its own on its floor, and the loot above is the same item for item with the metro and without it",
    withMetro.every((m) => m.down >= 8) && withMetro.every((m, i) => m.up.join("|") === without[i].up.join("|")),
    withMetro.map((m, i) => `seed ${seeds[i]}: ${m.down} down there, ${m.up.length} above${m.up.join("|") === without[i].up.join("|") ? "" : " (moved)"}`).join("; "),
  );
}

// the decay takes what stands above the street; the street's slab over the metro, and the metro, are under it
check("the street's slab and the metro are under the street, where the decay never reaches", RANGE_SOLIDS.filter((q) => q.top <= 0.001 && q.base < 0).length >= 8);

console.log(fails === 0 ? "\nSK METRO PASS" : `\nSK METRO FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
