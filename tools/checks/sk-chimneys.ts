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
function climb(c: (typeof CHIMNEYS)[number], runUp: number, kicks = true, legs = 1): { landed: boolean; best: number; ground: boolean } {
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
  let leg = 1;
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
    if (leg === 1 && p.onGround && p.pos.y > c.landing - 0.25 && p.pos.z < c.z0 + 2.5 && p.pos.z > c.z0 - 1) {
      if (legs === 1 || climbed) return { landed: !climbed, best, ground };
      // the second leg: the turn on the landing (the owner's tap-strafe 180), and the chain back up the other way
      leg = 2;
      p.yaw += 180;
      jumped = false;
      clock = 0;
      runSince = -1;
      kicked = false;
      continue;
    }
    if (leg === 2 && p.onGround && p.pos.y > c.top - 0.25 && p.pos.z > c.z1 - 2.5) return { landed: !climbed, best, ground };
    // fallen off the landing in the second leg: back below it
    if (leg === 2 && p.onGround && p.pos.y < c.landing - 0.5) return { landed: false, best, ground: true };
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
  // the second leg, from the landing back up to the top at the near end
  let two = { landed: false, best: 0, ground: false };
  for (const runUp of [0.3, 0.45, 0.6, 0.8]) {
    two = climb(c, runUp, true, 2);
    if (two.landed) break;
  }
  check(`${c.name}: and turning on the landing, the chain climbs on to the top, ${(c.top - c.base).toFixed(1)} m up`, two.landed, two.landed ? "" : `highest ${two.best.toFixed(2)} m`);
  // and the kicks are what does it: the same runs with no kick do not get there clean
  const plain = [0.3, 0.45, 0.6, 0.8].map((r) => climb(c, r, false));
  check(`${c.name}: and without the kicks it does not`, plain.every((x) => !x.landed), `highest ${Math.max(...plain.map((x) => x.best)).toFixed(2)} m`);
}

// The stack (city.json chimneys legs, exit): every leg from standing on its landing to the next, the far end and the
// near end in turn, to the summit; and at each exit, a mantle off its landing into the room beside it, and from the
// room back out onto the landing (the owner's route 3: a window pad into the lobby, out onto the stack, up to the Sky
// Park). A climb is allowed only at an exit: the legs are the chain's.
/** one leg from standing at an end (`fromFar`) at height fromY to the landing `to`, a jump after runUp, a kick a quarter second into each wall run */
function leg(c: (typeof CHIMNEYS)[number], fromY: number, fromFar: boolean, to: { y: number; far: boolean }, runUp: number): { ok: boolean; best: number } {
  const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
  p.extraMoves = true;
  p.autoClimb = true;
  p.sprintMode = "auto";
  p.teleport(c.x - c.innerW / 2 + MOVE.radius + 0.05, fromY, fromFar ? c.z0 + 0.6 : c.z1 - 0.6, fromFar ? 180 : 0);
  const s = new Script();
  s.down.add("forward");
  let t = 1000;
  let clock = 0;
  let jumped = false;
  let runSince = -1;
  let kicked = false;
  let best = 0;
  let climbed = false;
  for (let i = 0; i < 6 / DT; i++) {
    t += DT;
    clock += DT;
    if (!jumped && clock >= runUp && p.onGround) {
      s.taps.add("jump");
      jumped = true;
    }
    if (p.onWall) {
      if (runSince < 0) runSince = clock;
      if (!kicked && clock - runSince > 0.25) {
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
    const atEnd = to.far ? p.pos.z < c.z0 + 2.5 : p.pos.z > c.z1 - 2.5;
    if (p.onGround && Math.abs(p.pos.y - to.y) < 0.25 && atEnd) return { ok: !climbed, best };
    if (jumped && p.onGround && p.pos.y < fromY - 0.3) return { ok: false, best };
  }
  return { ok: false, best };
}
/** from (x, y, z) facing along x toward `dir`, forward held (while `hold` says so) and a jump after a step: where it stood at the end */
function step(x: number, y: number, z: number, dir: number, jump: boolean, hold: (px: number) => boolean = () => true): { y: number; x: number } {
  const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
  p.extraMoves = true;
  p.autoClimb = true;
  p.sprintMode = "auto";
  p.teleport(x, y, z, dir > 0 ? -90 : 90);
  const s = new Script();
  s.down.add("forward");
  let t = 1000;
  for (let i = 0; i < 2.5 / DT; i++) {
    t += DT;
    if (jump && i === Math.round(0.1 / DT)) s.taps.add("jump");
    if (!hold(p.pos.x)) s.down.delete("forward");
    p.update(DT, t, s, 0, 1, false);
    s.taps.clear();
    // through: stop there, a couple of metres past the chimney's wall
    if (Math.abs(p.pos.x - x) > 3.2 && p.onGround) break;
  }
  return { y: p.pos.y, x: p.pos.x };
}
for (const c of CHIMNEYS) {
  const legs: string[] = [];
  let fromY = c.base;
  let fromFar = false;
  for (const q of c.platforms) {
    let r = { ok: false, best: 0 };
    for (const runUp of [0.2, 0.3, 0.45, 0.6, 0.8]) {
      r = leg(c, fromY, fromFar, q, runUp);
      if (r.ok) break;
    }
    if (!r.ok) legs.push(`${q.y.toFixed(1)}: highest ${r.best.toFixed(1)}`);
    fromY = q.y;
    fromFar = q.far;
  }
  check(`${c.name}: the stack, every one of its ${c.platforms.length} legs from its landing to the next, to the summit at ${c.summit.toFixed(1)} m`, c.platforms.length >= 10 && legs.length === 0, legs.join("; ") || "all");
  const lobby = c.exits.filter((e) => e.y < 40);
  const park = c.exits.filter((e) => e.y > 60);
  const into = c.exits.map((e) => ({ e, r: step(c.x, e.from + 0.01, e.z, e.side, true) }));
  check(
    `${c.name}: from the landing under each exit (${c.exits.length}), a jump and a mantle into the room beside it, the Sky Lobby's (${lobby.length}) and the Sky Park's (${park.length})`,
    lobby.length === 2 && park.length === 2 && into.every(({ e, r }) => Math.abs(r.y - e.y) < 0.1 && (r.x - c.x) * e.side > c.innerW / 2 + 1),
    into.map(({ e, r }) => `${e.y.toFixed(0)} m ${e.side < 0 ? "west" : "east"}: ${r.y.toFixed(2)}`).join(", "),
  );
  // from standing in the room's window, a push forward and let go: a run out of the room carries across the chimney
  // at a sprint into the room opposite, the canyon's jump (sk-lobbies proves it), so the way onto the stack is to the
  // window and off it (a quarter second's push; from 0.15 s it lands)
  let clock = 0;
  const out = c.exits.map((e) => {
    clock = 0;
    return { e, r: step(c.x + e.side * (c.innerW / 2 + 1.4), e.y + 0.01, e.z, -e.side, false, () => (clock += DT) < 0.25) };
  });
  check(
    `${c.name}: and from each room a step out through its window drops onto the landing, the way onto the stack`,
    out.every(({ e, r }) => Math.abs(r.y - e.from) < 0.1),
    out.map(({ e, r }) => `${e.y.toFixed(0)} m: ${r.y.toFixed(2)}`).join(", "),
  );
}

console.log(fails === 0 ? "\nSK CHIMNEYS PASS" : `\nSK CHIMNEYS FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
