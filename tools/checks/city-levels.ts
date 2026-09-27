// How much of SpeedKills' city a player can stand on, by height: the city's
// collision boxes sampled on a 1 m grid, every top with head room counted,
// open or under a roof. The owner's aim is play above the street (Phase 21,
// docs/PHASE_21_PLAN_THE_VERTICAL_CENTRE.md section 1), and a picture of a
// skyline can look tall while nearly all the room to stand is on the street,
// which is what the first run of this found (58.7% at street level).
//
// In verify since Phase 21's massing (docs/CITY_BUNDLE_IMPLEMENTATION.md step 2): it holds THE SPIRE's standing room
// in each band a tenth under what the massing, the Sky Park, the chimney stacks and the drop measured, so a change that
// takes the centre's height away fails; and it prints the plan's targets (PHASE_21_PLAN 2.1) beside them, which the
// centre does not all meet yet (the 30 to 60 m band, and the street's share).
//
// Run: GAME=speedkills npx tsx tools/checks/city-levels.ts
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
const { IS_SK } = await import("../../src/game/game");
const { buildCityMap } = await import("../../src/game/city");
const { RANGE_SOLIDS } = await import("../../src/game/range");
const { BR_X, BR_Z } = await import("../../src/game/br");
const cityCfg = (await import("../../src/config/city.json")).default;
const before = RANGE_SOLIDS.length;
const map = buildCityMap(new THREE.Scene());
console.warn = warn;
map.doors.list.forEach((_d: unknown, i: number) => map.doors.set(i, true));
for (let k = 0; k < 120; k++) map.doors.update(1 / 30);

const HALF = 250;
const HEAD = 1.8;
const solids = RANGE_SOLIDS.slice(before).filter((s: any) => !s.door && s.maxX > BR_X - HALF && s.minX < BR_X + HALF && s.maxZ > BR_Z - HALF && s.minZ < BR_Z + HALF);
console.log(`SpeedKills=${IS_SK}; ${solids.length} city boxes`);

// bucket boxes into 8 m cells for the sampler
const CELL = 8;
const cells = new Map<string, any[]>();
for (const s of solids) {
  for (let cx = Math.floor(s.minX / CELL); cx <= Math.floor(s.maxX / CELL); cx++)
    for (let cz = Math.floor(s.minZ / CELL); cz <= Math.floor(s.maxZ / CELL); cz++) {
      const k = `${cx},${cz}`;
      (cells.get(k) ?? cells.set(k, []).get(k)!).push(s);
    }
}
const bands: Array<[string, number, number]> = [
  ["street, 0 to 1 m", -1, 1],
  ["low, 1 to 10 m (1 to 2 storeys)", 1, 10],
  ["mid, 10 to 30 m (3 to 7 storeys)", 10, 30],
  ["high, 30 to 60 m (8 to 15 storeys)", 30, 60],
  ["top, 60 to 100 m", 60, 100],
  ["crown, 100 m and up", 100, 1e9],
];
const open = bands.map(() => 0);
const covered = bands.map(() => 0);
const bySector = new Map<string, number[]>();
let maxTop = 0;
const sectorOf = (lx: number, lz: number): string => cityCfg.sectors.find((s: any) => lx >= s.minX && lx < s.maxX && lz >= s.minZ && lz < s.maxZ)?.name ?? "edge";
for (let lx = -HALF + 0.5; lx < HALF; lx += 1) {
  for (let lz = -HALF + 0.5; lz < HALF; lz += 1) {
    const x = BR_X + lx, z = BR_Z + lz;
    const here = (cells.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []).filter((s) => x >= s.minX && x < s.maxX && z >= s.minZ && z < s.maxZ);
    const tops = [0, ...here.map((s) => s.top)];
    const seen = new Set<number>();
    for (const t of tops) {
      const key = Math.round(t * 20);
      if (seen.has(key)) continue;
      seen.add(key);
      // standing room: nothing solid between this top and a head above it
      if (here.some((s) => s.base < t + HEAD && s.top > t + 0.05)) continue;
      const roof = here.some((s) => s.base >= t + HEAD);
      const b = bands.findIndex(([, lo, hi]) => t >= lo && t < hi);
      (roof ? covered : open)[b]++;
      if (t > maxTop) maxTop = t;
      const sec = sectorOf(lx, lz);
      const row = bySector.get(sec) ?? bySector.set(sec, bands.map(() => 0)).get(sec)!;
      row[b]++;
    }
  }
}
const total = [...open, ...covered].reduce((a, b) => a + b, 0);
console.log(`\nStanding room, m2 (1 m grid, ${HEAD} m head room), footprint ${2 * HALF} m square = ${(2 * HALF) ** 2} m2`);
bands.forEach(([name], i) => console.log(`${name.padEnd(38)} open ${String(open[i]).padStart(7)}  indoors ${String(covered[i]).padStart(7)}  ${(((open[i] + covered[i]) / total) * 100).toFixed(1)}%`));
console.log(`${"all".padEnd(38)} ${total} m2, ${(total / (2 * HALF) ** 2).toFixed(2)} x the footprint; highest standing top ${maxTop.toFixed(1)} m`);
const aboveStreet = total - open[0] - covered[0];
console.log(`above the street: ${aboveStreet} m2 = ${((aboveStreet / total) * 100).toFixed(1)}% of all standing room; indoors ${covered.reduce((a, b) => a + b, 0)} m2`);
console.log("\nBy sector (street / low / mid / high / top / crown, m2):");
for (const [sec, row] of [...bySector.entries()].sort()) console.log(`${sec.padEnd(14)} ${row.map((v) => String(v).padStart(7)).join(" ")}`);

// the centre, held: a tenth under what it measured on 2026-09-27 (with the open floors and the stair cores), and the
// plan's targets beside it
let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
const spire = bySector.get("THE SPIRE") ?? bands.map(() => 0);
const all = spire.reduce((a, b) => a + b, 0);
console.log("");
check("this is SpeedKills (the city is its map)", IS_SK);
check("the centre is the tallest part of the map: its highest standing top 120 m and more (the plan's 120)", maxTop >= 120, `${maxTop.toFixed(1)} m`);
// band, its index, what it measured, the plan's target
const held: Array<[string, number, number, number]> = [
  ["10 to 30 m", 2, 14920, 15000],
  ["30 to 60 m", 3, 9110, 20000],
];
for (const [name, i, was, target] of held) check(`the centre's room to stand ${name}: ${spire[i]} m2, held at a tenth under ${was} (the plan's target ${target})`, spire[i] >= Math.floor(was * 0.9), `${Math.round((spire[i] / target) * 100)}% of the target`);
// 60 m and up, held over the two bands together
const over60 = spire[4] + spire[5];
check(`and 60 m and up: ${over60} m2, held at a tenth under 15025 (the plan's targets 15000 to 100 m and 5000 over it)`, over60 >= Math.floor(15025 * 0.9), `${spire[4]} to 100 m, ${spire[5]} over`);
console.log(`        the street's share of the centre's room to stand: ${((spire[0] / all) * 100).toFixed(1)}% (the plan's target 20% or less)`);
console.log(fails ? `\nCITY LEVELS FAIL (${fails})` : "\nCITY LEVELS PASS");
process.exit(fails ? 1 : 0);
