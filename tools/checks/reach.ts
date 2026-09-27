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
//   2.5 to 6 m: how many crossings hold before the chain drops, and the height won or lost a crossing.
//
// WRITE=1 writes src/config/reach.json (generated; the centre's modules read it).
// Run: GAME=speedkills npx tsx tools/checks/reach.ts
import { writeFileSync } from "node:fs";
import { Player, type MoveInput } from "../../src/game/player";
import type { Action } from "../../src/game/input";
import { RANGE_SOLIDS } from "../../src/game/range";
import { ZIPLINES } from "../../src/game/traversal";
import { HU, MOVE } from "../../src/game/movement";
import { GAME } from "../../src/game/game";

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

// 5. the wall run: a long wall on the left (x -0.7), a sprint beside it, a jump; how far along and how high it holds
const wallRun = (() => {
  // (beside it, at the body's radius and a hand's width: the run takes a wall within the climb's reach)
  const s = new Sim([{ minX: -10, maxX: -0.7, minZ: -200, maxZ: 10, top: 12 }]);
  s.p.teleport(-0.7 + MOVE.radius + 0.05, 0, 0, 0);
  s.in.hold("forward");
  s.run(2.2);
  s.in.tap("jump");
  let started = -1;
  let startZ = 0;
  let startY = 0;
  let endZ = 0;
  let endY = 0;
  let t = 0;
  for (let i = 0; i < 4 / DT; i++) {
    s.step();
    t += DT;
    if (s.p.onWall && started < 0) {
      started = t;
      startZ = s.p.pos.z;
      startY = s.p.pos.y;
    }
    if (started >= 0 && !s.p.onWall) {
      endZ = s.p.pos.z;
      endY = s.p.pos.y;
      break;
    }
  }
  return { along: r3(startZ - endZ), seconds: r3(t - started), heightChange: r3(endY - startY), started: started >= 0 };
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
console.log(`        wall run: ${wallRun.along} m along the wall in ${wallRun.seconds} s, height ${wallRun.heightChange} m`);
for (const z of widths) console.log(`        zig-zag ${z.width.toFixed(2)} m: ${z.crossings} crossings, ${z.perCrossing} m a crossing, ${z.along} m along`);

check("the sprint is SpeedKills' (movement.speedkills.json sprintSpeed)", Math.abs(sprint.speed - MOVE.sprintSpeed) < 0.05, `${sprint.speed} m/s`);
check("a double jump carries further than a single one", dj.carry > jump.carry, `${dj.carry} against ${jump.carry} m`);
check("a sprint jump beside a wall starts a wall run", wallRun.started);
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
check("and a corridor too wide for the chain (5.0 m) does not hold three", wide.crossings < 3, `${wide.crossings} crossings`);

if (process.env.WRITE) {
  const out = {
    _note: `Generated by tools/checks/reach.ts (WRITE=1) from SpeedKills' movement: every distance the centre's chains are built from, measured with the real controller, metres and seconds. Rerun it when the movement changes (A17). Game ${GAME}, hu ${HU}.`,
    sprint,
    jump,
    doubleJump: dj,
    slideJump: slide,
    wallRun,
    zigzag: widths,
  };
  writeFileSync("src/config/reach.json", JSON.stringify(out, null, 2) + "\n");
  console.log("        wrote src/config/reach.json");
}

console.log(fails === 0 ? "\nREACH PASS" : `\nREACH FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
