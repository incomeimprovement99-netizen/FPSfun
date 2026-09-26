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
const { buildCityMap, ROOF_ROUTES, CONCOURSE, HIGHWAY } = await import("../../src/game/city");
const { botWalk, botGroundAt } = await import("../../src/game/botbody");
const { MOVE } = await import("../../src/game/movement");
const { navTree } = await import("../../src/game/navgraph");
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

// The streets (Phase 19 step 9 parks cars in them, solid): every link of the graph between two street-level
// nodes walked, each way, with a bot's rules. A car across one is a bot pressed against it all match.
{
  const blocked: string[] = [];
  let legs = 0;
  map.nodes.forEach((a, i) => {
    if ((a.y ?? 0) > 0.5) return;
    for (const j of a.links) {
      const b = map.nodes[j];
      if (j < i || (b.y ?? 0) > 0.5) continue;
      legs++;
      for (const [p, q] of [
        [a, b],
        [b, a],
      ]) {
        const w = walk(p.x, p.z, p.y ?? 0, q.x, q.z);
        if (!w.ok) blocked.push(`${i}-${j}: blocked at ${w.at}`);
      }
    }
  });
  check("a bot walks every street link of the graph, both ways", legs > 50 && blocked.length === 0, blocked.length ? `${blocked.length}: ${blocked.slice(0, 3).join("; ")}` : `${legs} links`);
}

// The concourse on the bots' graph (Phase 19 step 11): from a street crossing, a way along the graph's links
// to the Spire's podium, every link on it walked both ways with a bot's rules
{
  const from = map.nodes.findIndex((n) => (n.y ?? 0) < 0.5 && n.links.length >= 3);
  const prev = new Map<number, number>([[from, -1]]);
  const queue = [from];
  while (queue.length) {
    const i = queue.shift()!;
    for (const j of map.nodes[i].links) {
      if (prev.has(j)) continue;
      prev.set(j, i);
      queue.push(j);
    }
  }
  const reached = CONCOURSE.spire.find((i) => prev.has(i));
  const path: number[] = [];
  for (let i = reached ?? -1; i >= 0; i = prev.get(i) ?? -1) path.unshift(i);
  const bad: string[] = [];
  for (let k = 1; k < path.length; k++) {
    const a = map.nodes[path[k - 1]];
    const b = map.nodes[path[k]];
    const w = walk(a.x, a.z, a.y ?? 0, b.x, b.z);
    if (!w.ok || Math.abs(w.y - (b.y ?? 0)) > 0.6) bad.push(`${path[k - 1]}-${path[k]}: ${w.ok ? `arrived at ${w.y.toFixed(2)}` : `blocked at ${w.at}`}`);
  }
  check(
    "a bot's graph reaches the Spire's podium from the street, by a public stair and the bridges, every link walked",
    CONCOURSE.spire.length === 4 && reached !== undefined && bad.length === 0,
    reached === undefined ? "no way there" : bad.length ? bad.slice(0, 3).join("; ") : `${path.length - 1} links, up to ${map.nodes[reached].y?.toFixed(2)} m`,
  );
}

// The centre's jump pads on the graph (Phase 19 step 11): each thrown as a bot is thrown (bots.ts jumpPad:
// straight up, across once above the edge, the movement's gravity), landing on the roof its node says
{
  let n = 0;
  const bad: string[] = [];
  map.nodes.forEach((a, i) => {
    if (!a.pad) return;
    n++;
    const to = map.nodes[a.pad.to];
    const pos = { x: a.x, y: a.y ?? 0, z: a.z };
    const vel = { x: 0, y: a.pad.up, z: 0 };
    let carry: { vx: number; vz: number; over: number } | null = { vx: a.pad.dx, vz: a.pad.dz, over: a.pad.over };
    const dt = 1 / 60;
    for (let t = 0; t < 12; t += dt) {
      if (carry && pos.y >= carry.over) {
        vel.x = carry.vx;
        vel.z = carry.vz;
        carry = null;
      }
      pos.x += vel.x * dt;
      pos.y += vel.y * dt;
      pos.z += vel.z * dt;
      vel.y -= MOVE.gravity * dt;
      const ground = botGroundAt(pos.x, pos.z, pos.y);
      if (vel.y < 0 && pos.y <= ground) {
        pos.y = ground;
        break;
      }
    }
    if (Math.abs(pos.y - (to.y ?? 0)) > 0.3 || Math.hypot(pos.x - to.x, pos.z - to.z) > 3) bad.push(`pad ${i}: came down at ${pos.y.toFixed(2)} m, ${Math.hypot(pos.x - to.x, pos.z - to.z).toFixed(1)} m off, for ${(to.y ?? 0).toFixed(2)}`);
  });
  check("every jump pad on the bots' graph throws a bot onto the roof it leads to", n >= 8 && bad.length === 0, bad.length ? bad.slice(0, 3).join("; ") : `${n} pads`);
  // and the capture zone on the Spire: the plan from a street crossing to the node nearest its middle goes up it
  const t = navTree(map.nodes, map.pois.find((p) => p.id === "c")!.x, map.pois.find((p) => p.id === "c")!.z);
  const from = map.nodes.findIndex((m) => (m.y ?? 0) < 0.5 && m.links.length >= 3);
  let at = from;
  let pads = 0;
  for (let k = 0; k < 200 && at >= 0 && at !== t.target; k++) {
    const next = t.toward[at];
    if (next < 0) break;
    if (map.nodes[at].pad?.to === next) pads++;
    at = next;
  }
  const top = map.nodes[t.target];
  check("a bot's way to a capture zone on the Spire goes up its tiers by the pads", at === t.target && pads >= 2 && (top.y ?? 0) > 40, `${pads} pads, to ${(top.y ?? 0).toFixed(1)} m`);
}

// The rooftop highway (Phase 19 step 7): walked all the way round its loop, corner to corner, on its deck
{
  const legs: string[] = [];
  for (let k = 0; k < HIGHWAY.length; k++) {
    const a = HIGHWAY[k];
    const b = HIGHWAY[(k + 1) % HIGHWAY.length];
    const w = walk(a.x, a.z, a.y, b.x, b.z);
    if (!w.ok || Math.abs(w.y - b.y) > 0.3) legs.push(`side ${k}: ${w.ok ? `arrived at ${w.y.toFixed(2)}` : `blocked at ${w.at}`}`);
  }
  check("the rooftop highway is walked all the way round, corner to corner, on its deck", HIGHWAY.length === 4 && legs.length === 0, legs.length ? legs.join("; ") : `4 sides at ${HIGHWAY[0]?.y} m`);
}

console.log(fails === 0 ? "\nSK ROOFS PASS" : `\nSK ROOFS FAIL (${fails})`);
export const skRoofsFails = fails;
if (process.argv[1]?.endsWith("sk-roofs.ts")) process.exit(fails === 0 ? 0 : 1);
