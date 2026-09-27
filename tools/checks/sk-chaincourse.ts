// THE CHAIN, proven (Phase 21 4.6, src/game/courses/chain.ts): the real controller with SpeedKills' movement, driven
// frame by frame through the course's own colliders (course.ts courseColliders, the geometry the game draws). Each gap
// is landed CLEAN (on the far deck, never climbing, never below the fall line) with its move, and not with the move
// below it, which is what makes it that gap and not an easier one; the chimney is climbed by kicks alone to its landing
// and, after the turn, on to its top; and the top's way off, over the wall's cap onto the zip's deck, is open.
//
// It needs the game named: GAME=speedkills npx tsx tools/checks/sk-chaincourse.ts (verify runs it that way).
import { Player, type MoveInput } from "../../src/game/player";
import type { Action } from "../../src/game/input";
import { RANGE_SOLIDS } from "../../src/game/range";
import { ZIPLINES } from "../../src/game/traversal";
import { MOVE } from "../../src/game/movement";
import { GAME } from "../../src/game/game";
import { courseColliders } from "../../src/game/course";
import { CHAIN_COURSE, CHIMNEY, DECK, DOUBLE, FALL_Y, GAPS, RUN, WALLGAP, WALL_X, EXIT, EXIT_ZIP, type GapRoom } from "../../src/game/courses/chain";
import reach from "../../src/config/reach.json";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

class Script implements MoveInput {
  down = new Set<Action>();
  taps = new Set<Action>();
  held = (a: Action): boolean => this.down.has(a) || this.taps.has(a);
  pressedNow = (a: Action): boolean => this.taps.has(a);
}

const DT = 1 / 144;
const { solids, zips } = courseColliders(CHAIN_COURSE);
RANGE_SOLIDS.length = 0;
for (const s of solids) RANGE_SOLIDS.push({ ...s });
ZIPLINES.length = 0;
for (const [a, b] of zips) ZIPLINES.push({ a, b });

/** facing +z, the way the course runs (reach.ts: yaw 0 runs -z) */
const AHEAD = 180;

function player(x: number, y: number, z: number, yaw = AHEAD): Player {
  const p = new Player({ minX: -500, maxX: 500, minZ: -500, maxZ: 500 });
  p.extraMoves = true;
  p.autoClimb = true;
  p.sprintMode = "auto";
  p.teleport(x, y, z, yaw);
  return p;
}

console.log(`\nTHE CHAIN, proven on its own geometry (game: ${GAME})`);
check("this runs with SpeedKills' movement", GAME === "speedkills");
console.log(`        gaps from reach.json: run ${GAPS.run} m, double ${GAPS.double} m, wall ${GAPS.wall} m`);

/**
 * One gap room: from the back of its take-off deck, sprinting ahead, a jump at the edge, and with `dj` a double jump
 * at the measured moment, or with `kick` a kick off the wall at the measured moment. At `x` across. Clean: on the far
 * deck, never climbing, never under the fall line over the pit.
 */
function crossing(r: GapRoom, x: number, o: { jump: boolean; dj?: boolean; kick?: boolean }): { clean: boolean; z: number } {
  const p = player(x, DECK, r.a0 + 0.5);
  const s = new Script();
  s.down.add("forward");
  let t = 1000;
  let clock = 0;
  let jumpedAt = -1;
  let runSince = -1;
  let kicked = false;
  let fell = false;
  for (let i = 0; i < 8 / DT; i++) {
    t += DT;
    clock += DT;
    if (o.jump && jumpedAt < 0 && p.onGround && p.pos.z > r.a1 - 0.8) {
      s.taps.add("jump");
      jumpedAt = clock;
    }
    if (o.dj && jumpedAt > 0 && Math.abs(clock - jumpedAt - reach.doubleJump.at) < DT / 2) s.taps.add("jump");
    if (p.onWall && runSince < 0) runSince = clock;
    if (o.kick && !kicked && runSince >= 0 && p.onWall && clock - runSince >= reach.wallKick.at) {
      s.taps.add("jump");
      kicked = true;
    }
    p.update(DT, t, s, 0, 1, false);
    s.taps.clear();
    if (p.climbing || (p.pos.z > r.a1 && p.pos.z < r.b0 && p.pos.y < FALL_Y)) fell = true;
    if (fell) break;
    if (p.onGround && p.pos.z > r.b0 && p.pos.y > DECK - 0.05) return { clean: true, z: p.pos.z };
  }
  return { clean: false, z: p.pos.z };
}

const mid = 0;
const byWall = WALL_X + MOVE.radius + 0.05;
const r1 = crossing(RUN, mid, { jump: true });
const r1no = crossing(RUN, mid, { jump: false });
check(`run gap (${GAPS.run} m): a sprint jump lands clean on the far deck, and running off without one falls in`, r1.clean && !r1no.clean, `landed z ${r1.z.toFixed(1)}`);
const r2 = crossing(DOUBLE, mid, { jump: true, dj: true });
const r2no = crossing(DOUBLE, mid, { jump: true });
check(`double gap (${GAPS.double} m): the double jump lands clean, and one jump falls in`, r2.clean && !r2no.clean, `one jump reached z ${r2no.z.toFixed(1)} of ${DOUBLE.b0}`);
const r3 = crossing(WALLGAP, byWall, { jump: true, kick: true });
const r3run = crossing(WALLGAP, byWall, { jump: true });
const r3dj = crossing(WALLGAP, mid, { jump: true, dj: true });
check(
  `wall gap (${GAPS.wall} m): a wall run along the lit wall and its kick lands clean; the run alone and a double jump in the open both fall in`,
  r3.clean && !r3run.clean && !r3dj.clean,
  `the run alone reached z ${r3run.z.toFixed(1)}, a double jump ${r3dj.z.toFixed(1)}, of ${WALLGAP.b0}`,
);

/** the chimney: in at its mouth beside its right wall running +z, a jump after `runUp` s, a kick a quarter second into each wall run; `legs` 2 turns on the landing and climbs on to the top */
function climb(runUp: number, kicks: boolean, legs: 1 | 2): { up: boolean; best: number } {
  const C = CHIMNEY;
  const p = player(C.x - C.innerW / 2 + MOVE.radius + 0.05, 0, C.z0 - 2.5);
  const s = new Script();
  s.down.add("forward");
  let t = 1000;
  let clock = 0;
  let jumped = false;
  let runSince = -1;
  let kicked = false;
  let climbed = false;
  let leg = 1;
  let best = 0;
  for (let i = 0; i < 10 / DT; i++) {
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
    // the chain alone: a climb up an end wall would reach the landing too
    if (p.climbing) climbed = true;
    if (leg === 1 && p.onGround && p.pos.y > C.landing - 0.25 && p.pos.z > C.z1 - 2.5) {
      if (legs === 1 || climbed) return { up: !climbed, best };
      leg = 2;
      p.yaw += 180;
      jumped = false;
      clock = 0;
      runSince = -1;
      kicked = false;
      continue;
    }
    if (leg === 2 && p.onGround && p.pos.y > C.top - 0.25 && p.pos.z < C.z0 + 2.5) return { up: !climbed, best };
    if (jumped && p.onGround && p.pos.y < (leg === 1 ? 0.3 : C.landing - 0.5) && clock > 0.4) break;
  }
  return { up: false, best };
}
const tries = [0.3, 0.45, 0.6, 0.8];
const leg1 = tries.map((r) => climb(r, true, 1));
check(`chimney: kicks alone climb from the floor to the landing, ${CHIMNEY.landing} m up`, leg1.some((x) => x.up), `highest ${Math.max(...leg1.map((x) => x.best)).toFixed(2)} m`);
const leg2 = tries.map((r) => climb(r, true, 2));
check(`and turning on it, on to the top, ${CHIMNEY.top} m up`, leg2.some((x) => x.up), `highest ${Math.max(...leg2.map((x) => x.best)).toFixed(2)} m`);
const plain = tries.map((r) => climb(r, false, 1));
check("and without the kicks it does not", plain.every((x) => !x.up), `highest ${Math.max(...plain.map((x) => x.best)).toFixed(2)} m`);

// off the top: from the top's middle, a hop to the left over the wall's cap onto the zip's deck, and the zip within reach
{
  const C = CHIMNEY;
  const p = player(C.x, C.top, C.z0 + 1, -90);
  const s = new Script();
  s.down.add("forward");
  let t = 1000;
  s.taps.add("jump");
  let on = false;
  for (let i = 0; i < 3 / DT; i++) {
    t += DT;
    p.update(DT, t, s, 0, 1, false);
    s.taps.clear();
    // on the deck itself, past the wall (its cap is 0.4 m higher, and standing there is not off the top)
    if (p.onGround && Math.abs(p.pos.y - C.top) < 0.1 && p.pos.x > EXIT.x0 + 0.5) {
      on = true;
      break;
    }
  }
  const reachUp = EXIT_ZIP.a.y - C.top;
  check("off the top: a hop over the wall's cap lands on the zip's deck, and the zip hangs within reach over it", on && reachUp > 1.6 && reachUp < 3, `at x ${p.pos.x.toFixed(1)} y ${p.pos.y.toFixed(2)}, the zip ${reachUp.toFixed(1)} m over the deck`);
}

console.log(fails === 0 ? "\nSK CHAIN COURSE PASS" : `\nSK CHAIN COURSE FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
