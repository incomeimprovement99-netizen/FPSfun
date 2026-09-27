// The stairs up through the centre's towers (city.json stairCore, city.ts STAIR_CORES): the plan's way up with no pad
// and no ability. Every core walked with the real movement over the real city, from the promenade in through its door,
// up every flight, turning on every landing, to the deck it tops out on, never climbing and never jumping; and the
// rooms of the open floors it passes (skyLobby floors) are where it says.
//
// Run: GAME=speedkills npx tsx tools/checks/sk-stairs.ts
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
const { buildCityMap, STAIR_CORES, KIT_SITES } = await import("../../src/game/city");
const { Player } = await import("../../src/game/player");
const { BR_X, BR_Z } = await import("../../src/game/br");
buildCityMap(new THREE.Scene());
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

/** a walk from outside the core's door along its way, steering at each waypoint in turn: how far it got, and whether it had to climb */
function walkUp(c: (typeof STAIR_CORES)[number]): { reached: number; y: number; climbed: boolean } {
  const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
  p.extraMoves = true;
  p.autoClimb = true;
  p.sprintMode = "hold";
  p.teleport(c.outside.x, c.outside.y + 0.01, c.outside.z, 0);
  const s = new Script();
  s.down.add("forward");
  let t = 1000;
  let at = 0;
  let climbed = false;
  for (let i = 0; i < 90 / DT && at < c.way.length; i++) {
    const wp = c.way[at];
    const dx = wp.x - p.pos.x;
    const dz = wp.z - p.pos.z;
    if (Math.hypot(dx, dz) < 0.35 && Math.abs(p.pos.y - wp.y) < 0.6) {
      at++;
      continue;
    }
    p.yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI;
    t += DT;
    p.update(DT, t, s, 0, 1, false);
    if (p.climbing || p.stance === "mantle") climbed = true;
  }
  return { reached: at, y: p.pos.y, climbed };
}

console.log(`\nThe stairs up through the towers (game: ${GAME})`);
check("this runs with SpeedKills' movement", GAME === "speedkills");
const lobbies = KIT_SITES.towers.filter((t) => t.lobby !== undefined);
check(
  "a stair core in every lobby tower but those whose two end faces both stand over a canyon, most of them",
  STAIR_CORES.length >= Math.ceil(lobbies.length * 0.6),
  `${STAIR_CORES.length} of ${lobbies.length} towers`,
);
const floors = lobbies.flatMap((t) => t.floors ?? []);
check("the open floors: every lobby tower open just over the concourse and just under the lobby too", floors.length === lobbies.length * 2, `${floors.length} rooms`);
const walks = STAIR_CORES.map((c) => ({ c, r: walkUp(c) }));
const bad = walks.filter(({ c, r }) => r.reached < c.way.length || Math.abs(r.y - c.top) > 0.15 || r.climbed);
check(
  `every core walked from the promenade to its top deck, the lobby at 32 m or the Sky Park at 64, flight by flight, no climb and no jump (${walks.filter((w) => w.c.top > 60).length} to the Sky Park)`,
  STAIR_CORES.length > 0 && bad.length === 0,
  bad.map(({ c, r }) => `${(c.outside.x - BR_X).toFixed(0)},${(c.outside.z - BR_Z).toFixed(0)}: waypoint ${r.reached} of ${c.way.length} at ${r.y.toFixed(2)} m${r.climbed ? ", climbed" : ""}`).slice(0, 5).join("; ") || "all",
);
console.log(fails === 0 ? "\nSK STAIRS PASS" : `\nSK STAIRS FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
