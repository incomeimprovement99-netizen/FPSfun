// SpeedKills' reach, measured with the real movement (Phase 21, the brief's 4.2): every distance the centre's
// chains are built from comes out of this, driven frame by frame through src/game/player.ts with SpeedKills'
// movement on, so the layout follows when the movement changes (A15 doubled the sprint; A17 will change gravity).
// Nothing here is typed in by eye; each number is what the controller did.
//
// Measured:
//   the sprint, and the time to reach it;
//   a ground jump from a sprint: its apex and its flat carry;
//   the double jump: the timing that carries furthest, its apex and carry;
//   a slide jump's carry;
//   the wall run: metres along a wall and the height it keeps, from a sprint jump beside it;
//   the zig-zag: two parallel walls, kicking from one to the other (a jump during a wall run), for corridor widths
//   2.5 to 6 m: how many crossings hold before the chain drops, and the height won or lost a crossing;
//   the superglide off the tutorial's ledge (tutorial.json superglide): the least a superglide carries past it from
//   every approach, and the furthest every approach without one gets (Milestone 633).
//
// WRITE=1 writes src/config/reach.json (generated; the centre's modules read it).
// Run: GAME=speedkills npx tsx tools/checks/reach.ts
import { writeFileSync } from "node:fs";
import { Player, type MoveInput } from "../../src/game/player";
import type { Action } from "../../src/game/input";
import { RANGE_SOLIDS } from "../../src/game/range";
import { ZIPLINES } from "../../src/game/traversal";
import { EXTRA, HU, MOVE } from "../../src/game/movement";
import { GAME } from "../../src/game/game";
import tutorial from "../../src/config/tutorial.json";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

class Script implements MoveInput {
  down = new Set<Action>();
  private taps = new Set<Action>();
  private pressed = new Set<Action>();
  held(a: Action): boolean {
    return this.down.has(a) || this.taps.has(a);
  }
  pressedNow(a: Action): boolean {
    return this.pressed.has(a) || this.taps.has(a);
  }
  hold(a: Action): void {
    if (!this.down.has(a)) this.pressed.add(a);
    this.down.add(a);
  }
  release(a: Action): void {
    this.down.delete(a);
  }
  tap(a: Action): void {
    this.taps.add(a);
  }
  endFrame(): void {
    this.pressed.clear();
    this.taps.clear();
  }
}

type Box = { minX: number; maxX: number; minZ: number; maxZ: number; top: number; base?: number };
const DT = 1 / 144;

class Sim {
  p = new Player({ minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 });
  in = new Script();
  t = 1000;
  constructor(solids: Box[] = []) {
    RANGE_SOLIDS.length = 0;
    for (const s of solids) RANGE_SOLIDS.push({ ...s, base: s.base ?? 0 });
    ZIPLINES.length = 0;
    this.p.extraMoves = true;
    this.p.autoClimb = true;
    this.p.sprintMode = "auto";
  }
  step(each?: () => void): void {
    each?.();
    this.t += DT;
    this.p.update(DT, this.t, this.in, 0, 1, false);
    this.in.endFrame();
  }
  run(seconds: number, each?: () => void): void {
    for (let i = 0; i < Math.round(seconds / DT); i++) this.step(each);
  }
}

console.log(`\nSpeedKills' reach, measured (game: ${GAME})`);
check("this runs with SpeedKills' movement", GAME === "speedkills");
const r3 = (x: number) => Math.round(x * 1000) / 1000;

// 1. the sprint
const sprint = (() => {
  const s = new Sim();
  s.p.teleport(0, 0, 0, 0);
  s.in.hold("forward");
  let at = -1;
  let i = 0;
  s.run(4, () => {
    if (at < 0 && s.p.speed >= MOVE.sprintSpeed * 0.995) at = i * DT;
    i++;
  });
  return { speed: r3(s.p.speed), reachedIn: r3(at) };
})();

/** a sprint to full speed, then `act` from there; returns the jump's apex over the ground and where it lands */
function flight(act: (s: Sim, t: number) => void, seconds = 3): { apex: number; carry: number } {
  const s = new Sim();
  s.p.teleport(0, 0, 0, 0);
  s.in.hold("forward");
  s.run(2.2);
  const z0 = s.p.pos.z;
  let apex = 0;
  let left = false;
  let t = 0;
  let carry = 0;
  for (let i = 0; i < seconds / DT; i++) {
    s.step(() => act(s, t));
    t += DT;
    apex = Math.max(apex, s.p.pos.y);
    if (!s.p.onGround) left = true;
    if (left && s.p.onGround) {
      carry = z0 - s.p.pos.z;
      break;
    }
  }
  return { apex: r3(apex), carry: r3(carry) };
}

// 2. a ground jump from a sprint
const jump = flight((s, t) => {
  if (t === 0) s.in.tap("jump");
});

// 3. the double jump: every timing from 0.05 to 1.2 s after the jump, the furthest kept
let dj = { at: 0, apex: 0, carry: 0 };
for (let at = 0.05; at <= 1.2; at += 0.025) {
  const f = flight((s, t) => {
    if (t === 0) s.in.tap("jump");
    if (Math.abs(t - at) < DT / 2) s.in.tap("jump");
  });
  if (f.carry > dj.carry) dj = { at: r3(at), ...f };
}

// 4. a slide jump: crouch into a slide at full sprint, jump a quarter second in
const slide = flight((s, t) => {
  if (t === 0) s.in.hold("crouch");
  if (Math.abs(t - 0.25) < DT / 2) {
    s.in.release("crouch");
    s.in.tap("jump");
  }
});

// 5. the wall run (Milestone 530, and Milestone 630's limit): a long wall on the left (x -0.7), a sprint beside it, a
// jump; held along it to just before its last `sink` seconds (its speed and height then), then held on to its end (when
// it ends, and whether that wall takes you again before the ground); and in a run of its own, let go a second in (how
// long it coasts before it ends)
const hSpeed = (s: Sim): number => Math.hypot(s.p.vel.x, s.p.vel.z);
const WR = EXTRA.wallRun;
const HOLD_FOR = r3(WR.duration - WR.sink - 0.1);
const wallRun = (() => {
  // (beside it, at the body's radius and a hand's width: the run takes a wall within the climb's reach)
  const s = new Sim([{ minX: -10, maxX: -0.7, minZ: -400, maxZ: 10, top: 12 }]);
  s.p.teleport(-0.7 + MOVE.radius + 0.05, 0, 0, 0);
  s.in.hold("forward");
  s.run(2.2);
  s.in.tap("jump");
  let started = -1;
  let startZ = 0;
  let startY = 0;
  let startSpeed = 0;
  let topY = -Infinity;
  let t = 0;
  for (let i = 0; i < 6 / DT; i++) {
    s.step();
    t += DT;
    if (s.p.onWall && started < 0) {
      started = t;
      startZ = s.p.pos.z;
      startY = s.p.pos.y;
      startSpeed = hSpeed(s);
    }
    if (started >= 0) topY = Math.max(topY, s.p.pos.y);
    if (started >= 0 && t - started >= HOLD_FOR) break;
  }
  const held = s.p.onWall;
  const endSpeed = hSpeed(s);
  const along = startZ - s.p.pos.z;
  const endY = s.p.pos.y;
  // held on, still pushing along it: when it ends, and whether the same wall takes you again before the ground
  let endedAt = -1;
  let retaken = false;
  for (let i = 0; i < 4 / DT && !s.p.onGround; i++) {
    s.step();
    t += DT;
    if (endedAt < 0 && !s.p.onWall) endedAt = t - started;
    else if (endedAt >= 0 && s.p.onWall) retaken = true;
  }
  // and in a run of its own, let go a second in: it coasts down to its minimum and ends
  const c = new Sim([{ minX: -10, maxX: -0.7, minZ: -400, maxZ: 10, top: 12 }]);
  c.p.teleport(-0.7 + MOVE.radius + 0.05, 0, 0, 0);
  c.in.hold("forward");
  c.run(2.2);
  c.in.tap("jump");
  let since = -1;
  let ct = 0;
  for (let i = 0; i < 4 / DT && (since < 0 || ct - since < 1); i++) {
    c.step();
    ct += DT;
    if (c.p.onWall && since < 0) since = ct;
  }
  c.in.release("forward");
  let coast = 0;
  for (let i = 0; i < 6 / DT && c.p.onWall; i++) {
    c.step();
    coast += DT;
  }
  // and one begun 8 m up, so its sink never reaches the ground: the limit itself
  const h = new Sim([{ minX: -10, maxX: -0.7, minZ: -400, maxZ: 10, top: 20 }]);
  h.p.teleport(-0.7 + MOVE.radius + 0.05, 8, 0, 0);
  h.p.vel.z = -MOVE.sprintSpeed;
  h.in.hold("forward");
  let hs = -1;
  let ht = 0;
  let endedHigh = -1;
  for (let i = 0; i < 5 / DT && endedHigh < 0; i++) {
    h.step();
    ht += DT;
    if (h.p.onWall && hs < 0) hs = ht;
    else if (hs >= 0 && !h.p.onWall) endedHigh = ht - hs;
  }
  return { started: started >= 0, held, seconds: HOLD_FOR, endedHigh: r3(endedHigh), along: r3(along), startSpeed: r3(startSpeed), endSpeed: r3(endSpeed), heightChange: r3(endY - startY), rise: r3(topY - startY), sinkAfterTop: r3(topY - endY), endedAt: r3(endedAt), retaken, coast: r3(coast) };
})();

// 5a. a kick keeps your speed and adds its boost: a run along a wall, a kick a second in looking along it
const kickSpeed = (() => {
  const s = new Sim([{ minX: -10, maxX: -0.7, minZ: -400, maxZ: 10, top: 12 }]);
  s.p.teleport(-0.7 + MOVE.radius + 0.05, 0, 0, 0);
  s.in.hold("forward");
  s.run(2.2);
  s.in.tap("jump");
  let since = -1;
  let t = 0;
  let before = 0;
  for (let i = 0; i < 4 / DT; i++) {
    s.step();
    t += DT;
    if (s.p.onWall && since < 0) since = t;
    if (since >= 0 && t - since >= 1) {
      before = hSpeed(s);
      s.in.tap("jump");
      s.step();
      break;
    }
  }
  return { before: r3(before), after: r3(hSpeed(s)), off: !s.p.onWall };
})();

// 5b. the wall run's kick: a sprint jump beside a long wall, and a jump off it (a kick) `kickAt` s into the run; the
// kick throws you off the wall and on, so it carries further than the run alone. Swept for the best moment.
function wallKick(kickAt: number | null): number {
  const s = new Sim([{ minX: -10, maxX: -0.7, minZ: -200, maxZ: 10, top: 14 }]);
  s.p.teleport(-0.7 + MOVE.radius + 0.05, 0, 0, 0);
  s.in.hold("forward");
  s.run(2.2);
  const z0 = s.p.pos.z;
  s.in.tap("jump");
  let runSince = -1;
  let t = 0;
  let kicked = false;
  for (let i = 0; i < 6 / DT; i++) {
    s.step(() => {
      if (kickAt !== null && !kicked && runSince >= 0 && s.p.onWall && t - runSince >= kickAt) {
        s.in.tap("jump");
        kicked = true;
      }
    });
    t += DT;
    if (s.p.onWall && runSince < 0) runSince = t;
    if (s.p.onGround && t > 0.2) break;
  }
  return r3(z0 - s.p.pos.z);
}
const kick = (() => {
  let best = { at: 0, carry: 0 };
  for (let k = 0.5; k <= 1.5001; k += 0.05) {
    const c = wallKick(r3(k));
    if (c > best.carry) best = { at: r3(k), carry: c };
  }
  return { ...best, runAlone: wallKick(null) };
})();

// 6. the zig-zag: walls at x = +-w/2, from a wall run on the left, a kick across a quarter second into each run
function zigzag(w: number): { crossings: number; perCrossing: number; along: number } {
  const half = w / 2;
  const s = new Sim([
    { minX: -half - 5, maxX: -half, minZ: -400, maxZ: 10, top: 60 },
    { minX: half, maxX: half + 5, minZ: -400, maxZ: 10, top: 60 },
  ]);
  s.p.teleport(-half + MOVE.radius + 0.05, 0, 0, 0);
  s.in.hold("forward");
  s.run(2.2);
  s.in.tap("jump");
  let crossings = 0;
  let side = 0;
  let runSince = -1;
  let t = 0;
  let firstY = NaN;
  let lastY = NaN;
  const z0 = s.p.pos.z;
  for (let i = 0; i < 12 / DT; i++) {
    s.step(() => {
      if (s.p.onWall && runSince >= 0 && t - runSince > 0.25) {
        s.in.tap("jump");
        runSince = -2;
      }
    });
    t += DT;
    if (s.p.onGround) break;
    if (s.p.onWall && runSince === -1) runSince = t;
    if (s.p.onWall && runSince === -2) runSince = t;
    const now = s.p.pos.x < 0 ? -1 : 1;
    if (s.p.onWall && now !== side) {
      if (side !== 0) crossings++;
      side = now;
      if (Number.isNaN(firstY)) firstY = s.p.pos.y;
      lastY = s.p.pos.y;
      runSince = t;
    }
  }
  return { crossings, perCrossing: crossings ? r3((lastY - firstY) / crossings) : 0, along: r3(z0 - s.p.pos.z) };
}
const widths: Array<{ width: number; crossings: number; perCrossing: number; along: number }> = [];
for (let w = 2.5; w <= 6.001; w += 0.25) widths.push({ width: r3(w), ...zigzag(w) });

console.log(`        sprint ${sprint.speed.toFixed(2)} m/s, reached in ${sprint.reachedIn.toFixed(2)} s`);
console.log(`        jump from a sprint: apex ${jump.apex} m, carry ${jump.carry} m`);
console.log(`        double jump at ${dj.at} s: apex ${dj.apex} m, carry ${dj.carry} m`);
console.log(`        slide jump: apex ${slide.apex} m, carry ${slide.carry} m`);
console.log(`        wall run: held ${wallRun.seconds} s, ${wallRun.along} m along, ${wallRun.startSpeed} to ${wallRun.endSpeed} m/s, rose ${wallRun.rise} m and sank ${wallRun.sinkAfterTop} m after; held on, it ended at ${wallRun.endedAt} s; let go, it coasts ${wallRun.coast} s`);
console.log(`        a kick a second into a run: ${kickSpeed.before} to ${kickSpeed.after} m/s`);
console.log(`        the wall run's kick at ${kick.at} s into the run: carry ${kick.carry} m (the run alone ${kick.runAlone} m)`);
for (const z of widths) console.log(`        zig-zag ${z.width.toFixed(2)} m: ${z.crossings} crossings, ${z.perCrossing} m a crossing, ${z.along} m along`);

check("the sprint is SpeedKills' (movement.speedkills.json sprintSpeed)", Math.abs(sprint.speed - MOVE.sprintSpeed) < 0.05, `${sprint.speed} m/s`);
check("a double jump carries further than a single one", dj.carry > jump.carry, `${dj.carry} against ${jump.carry} m`);
check("a sprint jump beside a wall starts a wall run", wallRun.started);
// Milestone 530 (the owner, 2026-10-12, after EMPULSE): runs that keep their speed and do not sink; Milestone 630 (the
// owner, 2026-10-17: "stop wall running after like 3 seconds"): each lasts movement.json wallRun.duration, its last
// `sink` seconds no longer held up. Before 530 a run lasted 1.5 s while sinking at 45% of gravity; from 530 to 630 for
// ever
check(`and it holds while pushed along: still on the wall ${HOLD_FOR} s in`, wallRun.held, `${wallRun.along} m along`);
check("at the speed it came in with or more, never slowed", wallRun.endSpeed >= wallRun.startSpeed - 0.05, `${wallRun.startSpeed} to ${wallRun.endSpeed} m/s`);
check(`and it never sinks before its last ${WR.sink} s: no lower than the highest it rose to`, wallRun.sinkAfterTop < 0.02, `${wallRun.sinkAfterTop} m`);
check(`held on, it ends at ${WR.duration} s, the owner's limit (begun 8 m up)`, Math.abs(wallRun.endedHigh - WR.duration) < 0.05, `${wallRun.endedHigh} s`);
check(`and begun low, its last ${WR.sink} s drop it to the ground by then`, wallRun.endedAt > WR.duration - WR.sink - 0.05 && wallRun.endedAt <= WR.duration + 0.05, `${wallRun.endedAt} s`);
check("and the wall it ran out on does not take you again before the ground", !wallRun.retaken);
check("let go, it coasts off within a couple of seconds", wallRun.coast > 0.2 && wallRun.coast < 2.5, `${wallRun.coast} s`);
check("a kick keeps your speed and adds its boost (EMPULSE's burst)", kickSpeed.off && kickSpeed.after > kickSpeed.before + 1, `${kickSpeed.before} to ${kickSpeed.after} m/s`);
const best = widths.reduce((a, z) => (z.crossings > a.crossings || (z.crossings === a.crossings && z.perCrossing > a.perCrossing) ? z : a), widths[0]);
check("some corridor width holds a zig-zag of three crossings or more (the owner's chain)", best.crossings >= 3, `best ${best.width} m: ${best.crossings} crossings`);

// The chains (the brief's 4.3, docs/PHASE_21_LAYOUT.md): each module run through the controller at the geometry the
// layout gives it, landing CLEAN (on the far roof without a climb) with the move it is built for and not without it,
// which is what makes it that module and not an easier one. Clean, because the auto-climb catches a far roof's lip
// up to 5.1 m below: running off a roof clears 9.5 m by falling 4 m and climbing, and a jump alone clears 16 m, so a
// landing at all says nothing about which move a gap asks for, and the climb is the slow way.
/** roof to roof over a gap `g` m wide at 10 m up: a sprint, then at the edge `jump` (and `dj`, a double jump at 0.75 s); on the far roof without climbing */
function roofGap(g: number, jump: boolean, dj: boolean): boolean {
  const s = new Sim([
    { minX: -10, maxX: 10, minZ: -2, maxZ: 40, top: 10 },
    { minX: -10, maxX: 10, minZ: -120, maxZ: -2 - g, top: 10 },
  ]);
  s.p.teleport(0, 10, 35, 0);
  s.in.hold("forward");
  let jumpedAt = -1;
  let t = 0;
  let landed = false;
  let climbed = false;
  s.run(6, () => {
    t += DT;
    if (jump && jumpedAt < 0 && s.p.onGround && s.p.pos.z < -1.2 && s.p.pos.y > 9.9) {
      s.in.tap("jump");
      jumpedAt = t;
    }
    if (dj && jumpedAt > 0 && Math.abs(t - jumpedAt - dj_at) < DT / 2) s.in.tap("jump");
    if (s.p.climbing || s.p.pos.y < 9.4) climbed = true;
    if (s.p.onGround && s.p.pos.y > 9.5 && s.p.pos.z < -2 - g && !landed) landed = !climbed;
  });
  return landed;
}
const dj_at = dj.at;
const RUN_GAP = r3(jump.carry / 1.2);
const DOUBLE_GAP = r3((jump.carry * 1.1 + dj.carry * 0.9) / 2);
check(`a run gap (${RUN_GAP} m, a sprint jump with 20% to spare) is landed clean with a jump, and not by running off`, roofGap(RUN_GAP, true, false) && !roofGap(RUN_GAP, false, false));
check(`a double gap (${DOUBLE_GAP} m) is landed clean with the double jump, and not with the jump alone`, roofGap(DOUBLE_GAP, true, true) && !roofGap(DOUBLE_GAP, true, false));
const chimney = widths.find((z) => Math.abs(z.width - 3) < 1e-6)!;
const wide = widths.find((z) => Math.abs(z.width - 5) < 1e-6)!;
check("the 3.0 m chimney climbs a 4 m storey in three crossings (the owner's repeat, three times)", chimney.crossings >= 3 && chimney.perCrossing * 3 >= 4, `${chimney.perCrossing} m a crossing`);
// (a 5 m corridor did not hold three crossings while a run sank and lasted 1.5 s, and the chain was the 3 m chimney's
// alone; since Milestone 530 every corridor from 2.5 to 6 m holds a bounce up it, as EMPULSE's walls do)
check("and a wider corridor (5.0 m) holds a bounce up it too", wide.crossings >= 3 && wide.perCrossing > 0, `${wide.crossings} crossings, ${wide.perCrossing} m a crossing`);

/** a wall gap: roof to roof `g` m apart at 10 m up, a runnable wall along the gap's left side; a sprint, a jump at the edge, and with `kick` a kick off the wall at the measured best moment, or with `dj` a double jump and no wall */
function wallGap(g: number, kickOff: boolean, dj: boolean): boolean {
  const s = new Sim([
    { minX: -10, maxX: 10, minZ: -2, maxZ: 40, top: 10 },
    { minX: -10, maxX: 10, minZ: -120, maxZ: -2 - g, top: 10 },
    ...(dj ? [] : [{ minX: -14, maxX: -0.7, minZ: -2 - g, maxZ: 40, top: 22 }]),
  ]);
  s.p.teleport(-0.7 + MOVE.radius + 0.05, 10, 35, 0);
  s.in.hold("forward");
  let jumpedAt = -1;
  let runSince = -1;
  let kicked = false;
  let t = 0;
  let landed = false;
  let climbed = false;
  s.run(7, () => {
    t += DT;
    if (jumpedAt < 0 && s.p.onGround && s.p.pos.z < -1.2 && s.p.pos.y > 9.9) {
      s.in.tap("jump");
      jumpedAt = t;
    }
    if (dj && jumpedAt > 0 && Math.abs(t - jumpedAt - dj_at) < DT / 2) s.in.tap("jump");
    if (s.p.onWall && runSince < 0) runSince = t;
    if (kickOff && !kicked && runSince >= 0 && s.p.onWall && t - runSince >= kick.at) {
      s.in.tap("jump");
      kicked = true;
    }
    if (s.p.climbing || s.p.pos.y < 9.4) climbed = true;
    if (s.p.onGround && s.p.pos.y > 9.5 && s.p.pos.z < -2 - g && !landed) landed = !climbed;
  });
  return landed;
}
const WALL_GAP = r3((dj.carry * 1.1 + kick.carry * 0.9) / 2);
check(
  `a wall gap (${WALL_GAP} m, past the double jump by a tenth, inside the wall run's kick by a tenth) is landed clean with the wall run, with its kick or without, and not with a double jump`,
  wallGap(WALL_GAP, true, false) && wallGap(WALL_GAP, false, false) && !wallGap(WALL_GAP, false, true),
);

/**
 * The superglide off the tutorial's ledge (tutorial.json superglide): a sprint at the ledge from 25 m back, a jump at
 * `jumpAt` metres from its face and maybe a double jump `dj1` s after, then with `sg` the superglide (the mantle boost
 * held: the same speed as the one-frame input, and every approach makes it), or without one, off the top by running on
 * or (`hop`) a jump the moment you are on it; and maybe a double jump `dj2` s after leaving the top. How far past the
 * top's far edge the body gets before its feet are fallBelow under the ledge, which is where the course's pit takes you.
 */
const SG = tutorial.superglide;
function glide(o: { jumpAt: number; dj1: number | null; sg: boolean; hop: boolean; dj2: number | null }): { reach: number; glided: boolean } {
  const FACE = -30;
  const edge = FACE - SG.top;
  const s = new Sim([{ minX: -7, maxX: 7, minZ: edge, maxZ: FACE, top: SG.ledge }]);
  s.p.mantleBoost = o.sg;
  s.p.teleport(0, 0, FACE + 25, 0);
  s.in.hold("forward");
  let t = 0;
  let jumped = -1;
  let left = -1;
  let hopped = false;
  let mantled = false;
  let reach = -Infinity;
  for (let i = 0; i < 6 / DT; i++) {
    const m = s.p.mantling;
    if (m) mantled = true;
    s.step(() => {
      if (jumped < 0 && s.p.pos.z < FACE + o.jumpAt) {
        s.in.tap("jump");
        jumped = t;
      }
      // the approach's own double jump, before the ledge (one the instant after a superglide cuts its rise short)
      if (o.dj1 !== null && jumped > 0 && !mantled && Math.abs(t - jumped - o.dj1) < DT / 2) s.in.tap("jump");
      if (m && o.sg) s.in.hold("jump");
      if (o.hop && !hopped && !m && s.p.onGround && s.p.pos.y > SG.ledge - 0.05) {
        s.in.tap("jump");
        hopped = true;
      }
      if (o.dj2 !== null && left > 0 && Math.abs(t - left - o.dj2) < DT / 2) s.in.tap("jump");
    });
    t += DT;
    if (left < 0 && s.p.pos.z < edge && s.p.pos.y > SG.ledge - tutorial.fallBelow) {
      left = t;
      s.in.release("jump");
    }
    if (s.p.pos.y >= SG.ledge - tutorial.fallBelow) reach = Math.max(reach, edge - s.p.pos.z);
    if (s.p.pos.y < SG.ledge - tutorial.fallBelow && (left > 0 || t > 3)) break;
  }
  return { reach, glided: s.p.superglidedAt > 0 };
}
const superglide = (() => {
  const jumps = Array.from({ length: 18 }, (_, i) => 0.75 + i * 0.25);
  const dj1s = [null, 0.1, 0.3, 0.5];
  const dj2s = [null, ...Array.from({ length: 10 }, (_, i) => 0.1 + i * 0.1)];
  let carry = Infinity;
  let withDj = -Infinity;
  let without = -Infinity;
  let glided = 0;
  let tried = 0;
  for (const jumpAt of jumps) {
    for (const dj1 of dj1s) {
      tried++;
      const alone = glide({ jumpAt, dj1, sg: true, hop: false, dj2: null });
      if (alone.glided) {
        glided++;
        carry = Math.min(carry, alone.reach);
      }
      for (const dj2 of dj2s) {
        if (dj2 !== null) {
          const g = glide({ jumpAt, dj1, sg: true, hop: false, dj2 });
          if (g.glided) withDj = Math.max(withDj, g.reach);
        }
        for (const hop of [false, true]) without = Math.max(without, glide({ jumpAt, dj1, sg: false, hop, dj2 }).reach);
      }
    }
  }
  return { ledge: SG.ledge, top: SG.top, fallBelow: tutorial.fallBelow, carry: r3(carry), withDoubleJump: r3(withDj), without: r3(without), glided, of: tried };
})();
check(
  `the tutorial's ${SG.ledge} m ledge: every approach superglides, and the least a superglide carries past it (${superglide.carry} m) is past the furthest anything else gets (${superglide.without} m) by a fifth`,
  superglide.glided === superglide.of && superglide.carry > superglide.without * 1.2,
  `${superglide.glided} of ${superglide.of} superglided; with its double jump up to ${superglide.withDoubleJump} m`,
);

// 9. the figure others see on a wall and in the drop (Milestone 604): both were "air", a jump floating beside the wall
// or across the sky. A wall run is the wall's side of the way you run, not of the way you look (the body leans off the
// wall whichever way the head turns), and a skydive is its own until the ground.
const figureSeen = (() => {
  const run = (wallOnLeft: boolean) => {
    const s = new Sim([wallOnLeft ? { minX: -10, maxX: -0.7, minZ: -400, maxZ: 10, top: 12 } : { minX: 0.7, maxX: 10, minZ: -400, maxZ: 10, top: 12 }]);
    s.p.teleport(wallOnLeft ? -0.7 + MOVE.radius + 0.05 : 0.7 - MOVE.radius - 0.05, 0, 0, 0);
    s.in.hold("forward");
    s.run(2.2);
    s.in.tap("jump");
    for (let i = 0; i < 2 / DT && !s.p.onWall; i++) s.step();
    s.run(0.3);
    const on = s.p.onWall;
    const seen = s.p.figureStance;
    // looked back along it, the same frame: the wall's side of the view turns over, of the run it does not
    const view = Math.sign(s.p.wallSide);
    s.p.yaw += 180;
    return { on, seen, back: s.p.figureStance, viewTurned: view !== 0 && Math.sign(s.p.wallSide) === -view };
  };
  const left = run(true);
  const right = run(false);
  const d = new Sim();
  d.p.beginDrop(0, 300, 0, 0);
  d.step();
  const falling = d.p.figureStance;
  // and upright for its last moments (figure.json skydive.flare): laid on the air 3 s up, feet first 2 m up
  let early = "";
  let late = "";
  for (let i = 0; i < 40 / DT && !d.p.onGround; i++) {
    d.step();
    const secs = d.p.pos.y / Math.max(1, -d.p.vel.y);
    if (!early && secs < 3) early = d.p.figureStance;
    if (!late && d.p.pos.y < 2) late = d.p.figureStance;
  }
  return { left, right, falling, early, late, landed: d.p.onGround ? d.p.figureStance : "still falling" };
})();
check(
  "a figure running a wall is seen with the wall on the side of its run it is on (wallL, wallR), not as a jump",
  figureSeen.left.on && figureSeen.left.seen === "wallL" && figureSeen.right.on && figureSeen.right.seen === "wallR",
  `left ${JSON.stringify(figureSeen.left)}, right ${JSON.stringify(figureSeen.right)}`,
);
check("and looked back along the wall, the same: the run's side of it, not the view's", figureSeen.left.viewTurned && figureSeen.left.back === "wallL" && figureSeen.right.viewTurned && figureSeen.right.back === "wallR");
check(
  "a skydive is seen as one down to its last moments, upright feet first for those (figure.json skydive.flare), and standing on the ground",
  figureSeen.falling === "skydive" && figureSeen.early === "skydive" && figureSeen.late === "air" && figureSeen.landed === "stand",
  `${figureSeen.falling}, 3 s up ${figureSeen.early}, 2 m up ${figureSeen.late}, then ${figureSeen.landed}`,
);

if (process.env.WRITE) {
  const out = {
    _note: `Generated by tools/checks/reach.ts (WRITE=1) from SpeedKills' movement: every distance the centre's chains are built from, measured with the real controller, metres and seconds. Rerun it when the movement changes (A17). Game ${GAME}, hu ${HU}.`,
    sprint,
    jump,
    doubleJump: dj,
    slideJump: slide,
    wallRun,
    wallKick: { ...kick, speed: kickSpeed },
    zigzag: widths,
    superglide,
  };
  writeFileSync("src/config/reach.json", JSON.stringify(out, null, 2) + "\n");
  console.log("        wrote src/config/reach.json");
}

console.log(fails === 0 ? "\nREACH PASS" : `\nREACH FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
