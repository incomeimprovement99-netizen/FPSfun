// The halls inside the centre's podiums (Phase 24.4; city.json halls, city.ts podiumBody and HALLS): a floor to fight on
// at street level, as the metro is below it. Run with the real movement over the real city: through every door from the
// street and back out, along every podium's roof over its hall; the bots' graph into every hall; cover inside; and the
// halls' loot of their own, drawn last, the field's loot never on a hall's floor.
//
// Run: GAME=speedkills npx tsx tools/checks/sk-halls.ts
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
const { buildCityMap, HALLS, KIT_SITES } = await import("../../src/game/city");
const { Player } = await import("../../src/game/player");
const { BR_X, BR_Z } = await import("../../src/game/br");
const { RANGE_SOLIDS } = await import("../../src/game/range");
const { HALL_FLOORS } = await import("../../src/game/floors");
const cityCfg = (await import("../../src/config/city.json")).default;
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
/** a sprint (SpeedKills always sprints) from `from` toward `to`, standing at height y: where it ended, its lowest, whether it climbed */
function walk(from: { x: number; z: number }, y: number, to: { x: number; z: number }, seconds: number): { x: number; y: number; z: number; low: number; climbed: boolean; onGround: boolean } {
  const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
  p.extraMoves = true;
  p.autoClimb = true;
  p.sprintMode = "auto";
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
    if ((p.pos.x - from.x) * (to.x - from.x) + (p.pos.z - from.z) * (to.z - from.z) >= len * len) break;
  }
  return { x: p.pos.x, y: p.pos.y, z: p.pos.z, low, climbed, onGround: p.onGround };
}
const H = cityCfg.halls;
const inside = (h: (typeof HALLS)[number], x: number, z: number) => x > h.minX && x < h.maxX && z > h.minZ && z < h.maxZ;

console.log(`\nThe podium halls (game: ${GAME})`);
check("this runs with SpeedKills' movement", GAME === "speedkills");
const centre = KIT_SITES.podia.filter((p) => !p.spire && Math.abs((p.x0 + p.x1) / 2) < 100 && Math.abs((p.z0 + p.z1) / 2) < 100);
check("every podium of the centre's but the Spire's is a hall", HALLS.length === centre.length && HALLS.length >= 8, `${HALLS.length} halls, ${centre.length} podiums`);
check("the loot and the bots know every one (floors.ts HALL_FLOORS, KIT_SITES halls)", HALL_FLOORS.length === HALLS.length && KIT_SITES.halls.length === HALLS.length);

// a hall: open from its floor to its ceiling but for its columns and counters, the ceiling a hall's height up, the roof
// over it where the podium's top was
{
  const bad: string[] = [];
  for (const h of HALLS) {
    const pod = KIT_SITES.podia.find((p) => p.x0 + BR_X < h.minX && p.x1 + BR_X > h.maxX && p.z0 + BR_Z < h.minZ && p.z1 + BR_Z > h.maxZ);
    const cover = [...h.columns, ...h.counters];
    // a grid of points over the floor, each either in a piece of cover or with nothing over it up to the ceiling
    for (let i = 1; i < 10; i++)
      for (let j = 1; j < 10; j++) {
        const x = h.minX + ((h.maxX - h.minX) * i) / 10;
        const z = h.minZ + ((h.maxZ - h.minZ) * j) / 10;
        if (cover.some((q) => x > q.minX - 0.05 && x < q.maxX + 0.05 && z > q.minZ - 0.05 && z < q.maxZ + 0.05)) continue;
        const over = RANGE_SOLIDS.filter((s) => x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ && s.top > h.y0 + 0.05 && s.base < h.y1 - 0.05);
        if (over.length) bad.push(`${h.key} at ${(x - BR_X).toFixed(0)},${(z - BR_Z).toFixed(0)}: a solid ${over[0].base.toFixed(1)} to ${over[0].top.toFixed(1)} m`);
      }
    const mid = { x: (h.minX + h.maxX) / 2, z: (h.minZ + h.maxZ) / 2 };
    // the roof: what stands between the ceiling and the podium's top (a tower over the hall stands on it, from the top up)
    const roof = Math.max(...RANGE_SOLIDS.filter((s) => mid.x > s.minX && mid.x < s.maxX && mid.z > s.minZ && mid.z < s.maxZ && s.base >= h.y1 - 0.05 && s.top <= (pod?.top ?? 0) + 0.01).map((s) => s.top));
    if (!pod || Math.abs(roof - pod.top) > 0.01) bad.push(`${h.key}: its roof at ${roof.toFixed(2)} m, the podium's top ${pod?.top.toFixed(2)}`);
    if (h.y1 - h.y0 < 7) bad.push(`${h.key}: ${(h.y1 - h.y0).toFixed(1)} m high`);
  }
  check("each open from its floor to its ceiling (7 m and more) but for its cover, under a roof at the podium's top", bad.length === 0, bad.slice(0, 3).join("; ") || `${HALLS.length} halls`);
}
check(
  "cover inside every one: columns and waist-high counters",
  HALLS.every((h) => h.columns.length >= 8 && h.counters.length >= 3),
  HALLS.map((h) => `${h.key}: ${h.columns.length} columns, ${h.counters.length} counters`).join("; "),
);
check(
  "doors off every face of every hall, a body wide and more, under the shop canopies",
  HALLS.every((h) => ["n", "s", "w", "e"].every((k) => KIT_SITES.halls.find((q) => q.x0 + BR_X === h.minX && q.z0 + BR_Z === h.minZ)?.doors.some((d) => d.face === k))) && HALLS.every((h) => h.doors.every((d) => d.w >= 2.5 && d.top - h.y0 >= 3 && d.top <= cityCfg.kerb + cityCfg.streetLife.canopyAt)),
  `${HALLS.reduce((a, h) => a + h.doors.length, 0)} doors`,
);
check(
  "no door in a pad's way",
  HALLS.every((h) => h.doors.every((d) => !map.pads.some((p) => Math.hypot(p.x - (d.x + d.nx * 1.5), p.z - (d.z + d.nz * 1.5)) < H.door.pad + d.w / 2))),
);

// through every door, in from the street and back out: a sprint, on the floor, no climb
{
  const bad: string[] = [];
  let n = 0;
  for (const h of HALLS)
    for (const d of h.doors) {
      n++;
      const out = { x: d.x + d.nx * 3, z: d.z + d.nz * 3 };
      const inn = { x: d.x - d.nx * (H.wall + 3), z: d.z - d.nz * (H.wall + 3) };
      const a = walk(out, cityCfg.kerb + 0.01, inn, 3);
      const tag = `${h.key} door at ${(d.x - BR_X).toFixed(0)},${(d.z - BR_Z).toFixed(0)}`;
      if (!inside(h, a.x, a.z) || !a.onGround || Math.abs(a.y - h.y0) > 0.1 || a.climbed) bad.push(`${tag}: in, ended at ${(a.x - BR_X).toFixed(1)},${(a.z - BR_Z).toFixed(1)}, ${a.y.toFixed(2)} m${a.climbed ? ", climbed" : ""}`);
      const b = walk(inn, h.y0 + 0.01, out, 3);
      if (inside(h, b.x, b.z) || !b.onGround || b.climbed) bad.push(`${tag}: out, ended at ${(b.x - BR_X).toFixed(1)},${(b.z - BR_Z).toFixed(1)}${b.climbed ? ", climbed" : ""}`);
    }
  check(`through every door (${n}) from the street into the hall and back out, a sprint, no climb`, bad.length === 0, bad.slice(0, 3).join("; ") || "all");
}
// the roof over each hall holds: along every podium's promenade, its edges, at its top all the way
{
  const bad: string[] = [];
  for (const h of HALLS) {
    const pod = KIT_SITES.podia.find((p) => p.x0 + BR_X < h.minX && p.x1 + BR_X > h.maxX && p.z0 + BR_Z < h.minZ && p.z1 + BR_Z > h.maxZ)!;
    const e = cityCfg.concourse.promenade / 2;
    const corners = [
      { x: pod.x0 + e + BR_X, z: pod.z0 + e + BR_Z },
      { x: pod.x1 - e + BR_X, z: pod.z0 + e + BR_Z },
      { x: pod.x1 - e + BR_X, z: pod.z1 - e + BR_Z },
      { x: pod.x0 + e + BR_X, z: pod.z1 - e + BR_Z },
    ];
    for (let k = 0; k < 4; k++) {
      const r = walk(corners[k], pod.top + 0.01, corners[(k + 1) % 4], 8);
      if (r.low < pod.top - 0.1) bad.push(`${h.key}: fell to ${r.low.toFixed(2)} m on its ${"nesw"[k]} edge`);
    }
  }
  check("along every podium's promenade over its hall, on its roof all the way", bad.length === 0, bad.slice(0, 3).join("; ") || `${HALLS.length * 4} edges`);
}

// the bots: every hall's nodes linked and reached from the streets, through the doors
{
  const reach = new Set<number>([0]);
  const queue = [0];
  for (let q = 0; q < queue.length; q++)
    for (const j of map.nodes[queue[q]].links)
      if (!reach.has(j)) {
        reach.add(j);
        queue.push(j);
      }
  const hallNodes = map.nodes.map((n, i) => ({ n, i })).filter(({ n }) => n.hall);
  const lost = hallNodes.filter(({ i }) => !reach.has(i));
  check(
    "the bots' graph reaches every hall's nodes from the streets",
    hallNodes.length >= HALLS.length * 10 && lost.length === 0 && HALLS.every((h) => hallNodes.some(({ n }) => n.hall === h.key)),
    `${hallNodes.length} nodes in halls, ${lost.length} not reached`,
  );
}

// the loot: the halls' own, drawn last on a stream of their own; the field's never on a hall's floor
{
  const { LootField } = await import("../../src/game/loot");
  const lootCfg = (await import("../../src/config/loot.json")).default;
  const bounds = { minX: BR_X - 250, maxX: BR_X + 250, minZ: BR_Z - 250, maxZ: BR_Z + 250 };
  const places = map.pois.map((p: { x: number; z: number }) => ({ x: p.x, z: p.z, radius: 30 }));
  const field = new LootField(null);
  const run = (seed: number) => {
    field.generate(seed, places, bounds);
    return [...field.drops.values()].map((d) => ({ at: d.pos.clone(), key: `${d.item.kind}:${d.item.id}@${d.pos.x.toFixed(2)},${d.pos.y.toFixed(2)},${d.pos.z.toFixed(2)}` }));
  };
  const onFloor = (v: THREE.Vector3) => HALLS.some((h) => inside(h, v.x, v.z) && v.y < h.y0 + 1);
  const seeds = [7, 42, 1234];
  const withHalls = seeds.map(run);
  const per = lootCfg.halls.perHall;
  lootCfg.halls.perHall = 0;
  const fieldOnly = seeds.map(run);
  lootCfg.halls.perHall = per;
  check(
    "the field's own loot is never on a hall's floor",
    fieldOnly.every((items) => !items.some((d) => onFloor(d.at))),
    fieldOnly.map((items, i) => `seed ${seeds[i]}: ${items.filter((d) => onFloor(d.at)).length}`).join(", "),
  );
  check(
    "each hall has loot of its own, and the rest is the same item for item with it and without it",
    withHalls.every((items) => HALLS.every((h) => items.filter((d) => inside(h, d.at.x, d.at.z) && d.at.y < h.y0 + 1).length >= per)) &&
      withHalls.every((items, i) => items.filter((d) => !onFloor(d.at)).map((d) => d.key).join("|") === fieldOnly[i].map((d) => d.key).join("|")),
    withHalls.map((items, i) => `seed ${seeds[i]}: ${items.filter((d) => onFloor(d.at)).length} in the halls`).join("; "),
  );
}

console.log(fails === 0 ? "\nSK HALLS PASS" : `\nSK HALLS FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
