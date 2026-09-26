// The bots' way onto SpeedKills' roofs (city.ts ROOF_ROUTES, brpoi.ts building
// route), walked with a bot's own rules (bots.ts botGroundAt, botBlocked): from
// the street node each low tower hangs off, in at its door, up every flight,
// and out onto the roof. A route a bot cannot walk is a bot pressed against a
// wall for the rest of the match, which is what this is here to catch before a
// match does. The doors are opened first, as a bot opens one it walks into.
//
// It needs the game named: GAME=speedkills npx tsx tools/checks/sk-roofs.ts
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
const { buildCityMap, ROOF_ROUTES, CONCOURSE } = await import("../../src/game/city");
const { botWalk } = await import("../../src/game/botbody");
const cityCfg = (await import("../../src/config/city.json")).default;
const map = buildCityMap(new THREE.Scene());
console.warn = warn;
if (!hadDocument) delete g.document;

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

// every door open, and the doors' own motion run out, so their solids are where an open door's are
map.doors.list.forEach((_d, i) => map.doors.set(i, true));
for (let k = 0; k < 120; k++) map.doors.update(1 / 30);

/** a straight walk with a bot's rules (botbody.ts), said as where it stopped */
function walk(ax: number, az: number, y0: number, bx: number, bz: number): { ok: boolean; y: number; at: string } {
  const w = botWalk(ax, az, y0, bx, bz);
  return { ok: w.ok, y: w.y, at: `${w.x.toFixed(1)},${w.y.toFixed(2)},${w.z.toFixed(1)}` };
}

console.log("The bots' way onto the roofs");
check("this is SpeedKills (the city is its map)", IS_SK);
const low = ROOF_ROUTES.length;
check(`the low towers (up to ${cityCfg.botRoofs.maxStoreys} storeys) have their stairs on the graph, each hung off a street`, low >= 6 && ROOF_ROUTES.every((r) => r.street >= 0), `${low} towers, ${ROOF_ROUTES.filter((r) => r.street < 0).length} with no street in reach`);
let walked = 0;
const stuck: string[] = [];
for (const r of ROOF_ROUTES) {
  if (r.street < 0) continue;
  const chain = [r.street, ...r.nodes];
  let y = map.nodes[r.street].y ?? 0;
  let ok = true;
  for (let k = 1; k < chain.length && ok; k++) {
    const a = map.nodes[chain[k - 1]];
    const b = map.nodes[chain[k]];
    const w = walk(a.x, a.z, y, b.x, b.z);
    // there, and on the floor the node is on (a floor under or over it is a different place)
    if (!w.ok || Math.abs(w.y - (b.y ?? 0)) > 0.6) {
      ok = false;
      stuck.push(`tower ${ROOF_ROUTES.indexOf(r)}, leg ${k}: ${w.ok ? `arrived at ${w.y.toFixed(2)} m for a floor at ${(b.y ?? 0).toFixed(2)}` : `blocked at ${w.at}`}`);
    }
    y = w.y;
  }
  if (ok) walked++;
}
// which kind of leg: 1 along the street, 2 across it to the door, 3 through the door, then per flight: to its end wall, onto its foot, up it, off it
const kinds = new Map<string, number>();
for (const line of stuck) {
  const leg = Number(/leg (\d+)/.exec(line)?.[1] ?? 0);
  const kind = leg === 1 ? "along the street" : leg === 2 ? "to the door" : leg === 3 ? "through the door" : ["to the end wall", "onto the foot", "up the flight", "off the top step"][(leg - 4) % 4];
  kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
}
if (stuck.length) console.log(`  (stuck legs by kind: ${[...kinds].map(([k, n]) => `${k} ${n}`).join(", ")})`);
check("a bot walks every low tower's route from the street to its roof", stuck.length === 0 && walked > 0, stuck.length ? stuck.slice(0, 4).join("; ") : `${walked} routes, street to roof`);

// The centre's concourse (Phase 19 step 5): every core podium climbed by its public stair from the pavement,
// with a bot's rules, and every bridge crossed from one podium to the next. Without a pad or a gun.
{
  const up: string[] = [];
  for (const [n, s] of CONCOURSE.stairs.entries()) {
    let y = cityCfg.kerb;
    for (let k = 1; k < s.legs.length; k++) {
      const w = walk(s.legs[k - 1].x, s.legs[k - 1].z, y, s.legs[k].x, s.legs[k].z);
      y = w.y;
      if (!w.ok) {
        up.push(`stair ${n}, leg ${k}: blocked at ${w.at}`);
        break;
      }
    }
    if (Math.abs(y - s.top) > 0.3 && !up.some((u) => u.startsWith(`stair ${n},`))) up.push(`stair ${n}: ended at ${y.toFixed(2)} m for a podium at ${s.top.toFixed(2)}`);
  }
  check("every core podium is climbed by its public stair from the pavement, no pad", CONCOURSE.stairs.length >= 8 && up.length === 0, up.length ? up.slice(0, 3).join("; ") : `${CONCOURSE.stairs.length} stairs`);
  const cross: string[] = [];
  for (const [n, b] of CONCOURSE.bridges.entries()) {
    const w = walk(b.a.x, b.a.z, b.y, b.b.x, b.b.z);
    if (!w.ok || Math.abs(w.y - b.y) > 0.3) cross.push(`bridge ${n}: ${w.ok ? `arrived at ${w.y.toFixed(2)}` : `blocked at ${w.at}`}`);
  }
  check("and every bridge of the concourse crossed, podium to podium, at the one height", CONCOURSE.bridges.length >= 8 && cross.length === 0, cross.length ? cross.slice(0, 3).join("; ") : `${CONCOURSE.bridges.length} bridges`);
}

console.log(fails === 0 ? "\nSK ROOFS PASS" : `\nSK ROOFS FAIL (${fails})`);
export const skRoofsFails = fails;
if (process.argv[1]?.endsWith("sk-roofs.ts")) process.exit(fails === 0 ? 0 : 1);
