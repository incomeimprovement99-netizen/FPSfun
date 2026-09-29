// The fire escapes up the centre's towers (city.json fireEscape, city.ts FIRE_ESCAPES) and up the districts' walkway
// fronts (citydistricts.json escapes): the plan's ladders you can fight on. Every one climbed with the real movement over the real city: from the promenade up its drop ladder to the
// first landing, flight by flight to the top landing without a climb or a jump, and up the wall from there onto the
// roof. And each is where it may be: on a High City or Kyber tower, clear of every pad's column, every window of an
// open storey and every door.
//
// Run: GAME=speedkills npx tsx tools/checks/sk-escapes.ts
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
const { buildCityMap, FIRE_ESCAPES, KIT_SITES } = await import("../../src/game/city");
const { Player } = await import("../../src/game/player");
const { BR_X, BR_Z } = await import("../../src/game/br");
const cityCfg = (await import("../../src/config/city.json")).default;
const kitCfg = (await import("../../src/config/citykit.json")).default;
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

/** push into the wall, facing it, a jump off the ground once there (a climb starts in the air), until standing still at
 * `y` or better, or `seconds` pass: the height reached */
function climbTo(p: InstanceType<typeof Player>, s: Script, wall: number, y: number, seconds: number, clock: { t: number }): number {
  s.down.clear();
  s.down.add("forward");
  let still = 0;
  let jumped = false;
  for (let i = 0; i < seconds / DT; i++) {
    p.yaw = wall;
    if (!jumped && i > 0.25 / DT && p.onGround) {
      s.taps.add("jump");
      jumped = true;
    }
    clock.t += DT;
    p.update(DT, clock.t, s, 0, 1, false);
    s.taps.clear();
    if (p.onGround && p.pos.y > y - 0.1 && !p.climbing && p.stance !== "mantle") {
      // over the edge: let go, or a walkway narrower than a stride is crossed and fallen off its far side
      s.down.clear();
      if (++still > 20) break;
    } else still = 0;
  }
  return p.pos.y;
}
/** steer from waypoint to waypoint: how many were reached, and whether it had to climb or jump on the way */
function walk(p: InstanceType<typeof Player>, s: Script, way: Array<{ x: number; z: number; y: number }>, clock: { t: number }): { reached: number; climbed: boolean } {
  s.down.clear();
  s.down.add("forward");
  let at = 0;
  let climbed = false;
  for (let i = 0; i < 150 / DT && at < way.length; i++) {
    const wp = way[at];
    const dx = wp.x - p.pos.x;
    const dz = wp.z - p.pos.z;
    if (Math.hypot(dx, dz) < 0.3 && Math.abs(p.pos.y - wp.y) < 0.6) {
      at++;
      continue;
    }
    p.yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI;
    clock.t += DT;
    p.update(DT, clock.t, s, 0, 1, false);
    if (p.climbing || p.stance === "mantle") climbed = true;
  }
  return { reached: at, climbed };
}

console.log(`\nThe fire escapes (game: ${GAME})`);
check("this runs with SpeedKills' movement", GAME === "speedkills");
check("a storey of the bought pieces is the city's storey (their landings measured 4.00 m apart)", Math.abs(kitCfg.dress.escapes.stair.landing - cityCfg.storey) < 0.05, `${kitCfg.dress.escapes.stair.landing} and ${cityCfg.storey}`);
const fams = new Set(FIRE_ESCAPES.map((e) => e.family));
check("fire escapes up the centre's High City and Kyber towers and the districts' walkways, the packs' own and only theirs", FIRE_ESCAPES.length >= 6 && [...fams].every((f) => f === "high" || f === "kyber") && fams.size === 2, `${FIRE_ESCAPES.length}: ${[...fams].join(", ")}`);
check("the kit knows every one", KIT_SITES.escapes.length === FIRE_ESCAPES.length);

// where each is: clear of every pad's column, every window of an open storey, every door
{
  const Fe = cityCfg.fireEscape;
  const bad: string[] = [];
  for (const e of FIRE_ESCAPES) {
    const b = e.box;
    const tag = `${((b.minX + b.maxX) / 2 - BR_X).toFixed(0)},${((b.minZ + b.maxZ) / 2 - BR_Z).toFixed(0)}`;
    if (map.pads.some((p) => p.x > b.minX - Fe.clear.pad && p.x < b.maxX + Fe.clear.pad && p.z > b.minZ - Fe.clear.pad && p.z < b.maxZ + Fe.clear.pad)) bad.push(`${tag}: a pad`);
    // (between its foot and its roof, as the city places them: a podium hall's door in the street below is not in its way)
    if (KIT_SITES.doors.some((q) => !q.escape && q.x1 + BR_X > b.minX && q.x0 + BR_X < b.maxX && q.z1 + BR_Z > b.minZ && q.z0 + BR_Z < b.maxZ && q.y1 > e.outside.y && q.y0 < e.roof)) bad.push(`${tag}: a door`);
    // a window: the room's face's window, along the face from its middle, the lobby's width wide
    for (const r of KIT_SITES.rooms) {
      for (const [k, nx, nz] of [["n", 0, -1], ["s", 0, 1], ["w", -1, 0], ["e", 1, 0]] as const) {
        const o = r.at[k];
        const wx = nx === 0 ? r.x + o : r.x + (nx * r.w) / 2;
        const wz = nx === 0 ? r.z + (nz * r.d) / 2 : r.z + o;
        const half = cityCfg.skyLobby.width / 2;
        const hit = nx === 0 ? wx + half > b.minX - BR_X && wx - half < b.maxX - BR_X && Math.abs(wz - (nz > 0 ? b.minZ - BR_Z : b.maxZ - BR_Z)) < 0.1 : wz + half > b.minZ - BR_Z && wz - half < b.maxZ - BR_Z && Math.abs(wx - (nx > 0 ? b.minX - BR_X : b.maxX - BR_X)) < 0.1;
        if (hit) bad.push(`${tag}: a window at ${r.y.toFixed(0)} m`);
      }
    }
  }
  check("every one clear of a pad's column, a door (a stair core's, the drop's) and every window of an open storey", bad.length === 0, bad.slice(0, 4).join("; ") || "all clear");
}

// climbed, every one: the ladder, the flights, the wall to the roof
const results = FIRE_ESCAPES.map((e) => {
  const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
  p.extraMoves = true;
  p.autoClimb = true;
  p.sprintMode = "hold";
  const s = new Script();
  const clock = { t: 1000 };
  p.teleport(e.outside.x, e.outside.y + 0.01, e.outside.z, e.wall);
  const ladder = climbTo(p, s, e.wall, e.landing, 8, clock);
  const onLanding = Math.abs(ladder - e.landing) < 0.15;
  const w = onLanding ? walk(p, s, e.way, clock) : { reached: 0, climbed: false };
  const flights = onLanding && w.reached === e.way.length;
  let roof = p.pos.y;
  if (flights) {
    const toClimb = walk(p, s, [e.climb], clock);
    roof = toClimb.reached ? climbTo(p, s, e.wall, e.roof, 10, clock) : p.pos.y;
  }
  // over the roof: past the face, into the tower, at its height or on what stands on it (a parapet, a plant room)
  const ix = -Math.sin((e.wall * Math.PI) / 180);
  const iz = -Math.cos((e.wall * Math.PI) / 180);
  const inside = (p.pos.x - e.climb.x) * ix + (p.pos.z - e.climb.z) * iz > 0.6;
  return { e, ladder, onLanding, reached: w.reached, climbed: w.climbed, flights, roof, top: flights && inside && roof > e.roof - 0.2 && roof < e.roof + 3 };
});
const tag = (e: (typeof FIRE_ESCAPES)[number]) => `${((e.box.minX + e.box.maxX) / 2 - BR_X).toFixed(0)},${((e.box.minZ + e.box.maxZ) / 2 - BR_Z).toFixed(0)}`;
const noLadder = results.filter((r) => !r.onLanding);
check("up every drop ladder from the promenade onto the first landing, a storey up", noLadder.length === 0, noLadder.map((r) => `${tag(r.e)} at ${r.ladder.toFixed(2)} of ${r.e.landing.toFixed(2)}`).slice(0, 4).join("; ") || `${results.length} of ${results.length}`);
const noFlights = results.filter((r) => r.onLanding && (!r.flights || r.climbed));
check(
  "up every flight to the top landing, walked: no climb and no jump",
  noFlights.length === 0 && results.every((r) => r.flights),
  noFlights.map((r) => `${tag(r.e)}: waypoint ${r.reached} of ${r.e.way.length}${r.climbed ? ", climbed" : ""}`).slice(0, 4).join("; ") || `${results.filter((r) => r.flights).length} escapes, ${results.reduce((a, r) => a + r.e.way.length, 0)} waypoints`,
);
const noRoof = results.filter((r) => r.flights && !r.top);
check("and from every top landing up the wall onto the roof (or what stands on it at its edge)", noRoof.length === 0 && results.every((r) => r.top), noRoof.map((r) => `${tag(r.e)} at ${r.roof.toFixed(2)} of ${r.e.roof.toFixed(2)}`).slice(0, 4).join("; ") || `${results.filter((r) => r.top).length} roofs`);
// the doorways: from the landing in front of each into its room and back, a walk each way
{
  const doors = FIRE_ESCAPES.flatMap((e) => e.doors.map((d) => ({ e, d })));
  const stuck: string[] = [];
  for (const { e, d } of doors) {
    for (const [from, to] of [
      [d.out, d.in],
      [d.in, d.out],
    ] as const) {
      const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
      p.extraMoves = true;
      p.autoClimb = true;
      const s = new Script();
      p.teleport(from.x, from.y + 0.01, from.z, 0);
      const w = walk(p, s, [to], { t: 1000 });
      if (!w.reached || w.climbed) stuck.push(`${tag(e)} at ${from.y.toFixed(0)} m${w.climbed ? ", climbed" : ""}`);
    }
  }
  const rooms = new Set(KIT_SITES.rooms.map((r) => `${r.x},${r.z}`));
  check(
    "a doorway from a landing into every open storey an escape passes (the room clear behind it), walked in and out",
    doors.length > 0 && stuck.length === 0,
    stuck.slice(0, 4).join("; ") || `${doors.length} doors on ${FIRE_ESCAPES.filter((e) => e.doors.length).length} escapes, ${rooms.size} towers with rooms`,
  );
}
console.log(fails === 0 ? "\nSK ESCAPES PASS" : `\nSK ESCAPES FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
