// The chimneys, climbed in the built city (Phase 21, docs/PHASE_21_LAYOUT.md): in each of the four, a player
// sprinting in at its near end, jumping beside one wall and kicking across into each wall run in turn, reaches its
// landing a storey up without touching the ground; the owner's chain, proven where it stands rather than in a test
// box. Driven frame by frame through the real controller with SpeedKills' movement over the real city's solids.
//
// It needs the game named: GAME=speedkills npx tsx tools/checks/sk-chimneys.ts (verify runs it that way).
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
const { buildCityMap, CHIMNEYS } = await import("../../src/game/city");
const { Player } = await import("../../src/game/player");
const { MOVE } = await import("../../src/game/movement");
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

console.log(`\nThe chimneys, climbed in the city (game: ${GAME})`);
check("this runs with SpeedKills' movement", GAME === "speedkills");
check("the city has its four chimneys", CHIMNEYS.length === 4, CHIMNEYS.map((c) => c.name).join(", "));

const DT = 1 / 144;
/** in at the near end (z1) running to the far (z0, down -z), a jump after `runUp` s, a kick a quarter second into each wall run */
function climb(c: (typeof CHIMNEYS)[number], runUp: number, kicks = true): { landed: boolean; best: number; ground: boolean } {
  const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
  p.extraMoves = true;
  p.autoClimb = true;
  p.sprintMode = "auto";
  p.teleport(c.x - c.innerW / 2 + MOVE.radius + 0.05, c.base, c.z1 - 0.5, 0);
  const s = new Script();
  s.down.add("forward");
  let t = 1000;
  let clock = 0;
  let jumped = false;
  let runSince = -1;
  let kicked = false;
  let best = 0;
  let ground = false;
  // the chain alone: a climb up the end wall reaches the landing too (SpeedKills' climb catches a ledge 5.1 m up),
  // so a climb means the chain did not do it
  let climbed = false;
  for (let i = 0; i < 8 / DT; i++) {
    t += DT;
    clock += DT;
    if (!jumped && clock >= runUp && p.onGround) {
      s.taps.add("jump");
      jumped = true;
    }
    if (p.onWall) {
      if (runSince < 0) runSince = clock;
      if (kicks && !kicked && clock - runSince > 0.25) {
        s.taps.add("jump");
        kicked = true;
      }
    } else if (runSince >= 0) {
      runSince = -1;
      kicked = false;
    }
    p.update(DT, t, s, 0, 1, false);
    s.taps.clear();
    best = Math.max(best, p.pos.y);
    if (p.climbing) climbed = true;
    if (jumped && p.onGround && p.pos.y < c.base + 0.3 && clock > runUp + 0.3) ground = true;
    // on the landing: standing at its height, over its span at the far end
    if (p.onGround && p.pos.y > c.landing - 0.25 && p.pos.z < c.z0 + 2.5 && p.pos.z > c.z0 - 1) return { landed: !climbed, best, ground };
    if (ground) break;
  }
  return { landed: false, best, ground };
}

for (const c of CHIMNEYS) {
  // the run-up that works: a little sprint in, the few timings a player would try
  let got = { landed: false, best: 0, ground: false };
  let used = 0;
  for (const runUp of [0.3, 0.45, 0.6, 0.8]) {
    got = climb(c, runUp);
    used = runUp;
    if (got.landed) break;
  }
  check(`${c.name}: the chain climbs from its floor (${c.base.toFixed(1)} m) to its landing, ${(c.landing - c.base).toFixed(1)} m up, by wall runs and kicks alone (no climb, no touch of the floor)`, got.landed, got.landed ? `a ${used} s run-up` : `highest ${got.best.toFixed(2)} m${got.ground ? ", then the ground" : ""}`);
  // and the kicks are what does it: the same runs with no kick do not get there clean
  const plain = [0.3, 0.45, 0.6, 0.8].map((r) => climb(c, r, false));
  check(`${c.name}: and without the kicks it does not`, plain.every((x) => !x.landed), `highest ${Math.max(...plain.map((x) => x.best)).toFixed(2)} m`);
}

console.log(fails === 0 ? "\nSK CHIMNEYS PASS" : `\nSK CHIMNEYS FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
