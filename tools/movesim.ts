// Movement simulation suite.
//
// Drives the real controller (src/game/player.ts) frame by frame with scripted
// key presses, and checks the result against Apex's documented numbers from
// the Apex Movement Wiki (apexmovement.tech) and the engine constants. Every
// test names the source of its expected value.
//
// Run on its own: npx tsx tools/movesim.ts. Also runs inside npm run verify.
import * as THREE from "three";
import squadCfg from "../src/config/squad.json";
import { Player, type MoveInput } from "../src/game/player";
import type { Action } from "../src/game/input";
import { RANGE_SOLIDS } from "../src/game/range";
import { ZIPLINES } from "../src/game/traversal";
import { HU, MOVE, jumpVelocityFor, slideFriction } from "../src/game/movement";
import { courseColliders } from "../src/game/course";
import { ADVANCED_COURSE, GLIDE, STRAFE, SUPERJUMP, DROP, ZIP } from "../src/game/courses/advanced";
import { SuperglideTrainer } from "../src/game/trainer";

let fails = 0;
const hu = (m: number) => m / HU;
function near(label: string, got: number, want: number, tol: number): void {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label} = ${got.toFixed(2)} (want ${want} +/- ${tol})`);
}
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

/** scripted input: hold, release, or tap (a one-frame press, like a scroll notch) */
class Script implements MoveInput {
  private down = new Set<Action>();
  private pressed = new Set<Action>();
  private taps = new Set<Action>();
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

const FPS = 144;
const DT = 1 / FPS;

class Sim {
  p = new Player({ minX: -500, maxX: 500, minZ: -500, maxZ: 500 });
  in = new Script();
  t = 1000;
  /** ADS fraction fed to the controller */
  ads = 0;
  constructor(
    solids: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; top: number; base?: number }> = [],
    zips: Array<[[number, number, number], [number, number, number]]> = []
  ) {
    RANGE_SOLIDS.length = 0;
    for (const s of solids) RANGE_SOLIDS.push({ ...s, base: s.base ?? 0 });
    ZIPLINES.length = 0;
    for (const [a, b] of zips) ZIPLINES.push({ a: new THREE.Vector3(...a), b: new THREE.Vector3(...b) });
  }
  /** advance n frames, calling `each` before every frame */
  run(seconds: number, each?: (frame: number) => void): void {
    const n = Math.round(seconds * FPS);
    for (let i = 0; i < n; i++) {
      each?.(i);
      this.t += DT;
      this.p.update(DT, this.t, this.in, this.ads, 1, false);
      this.in.endFrame();
    }
  }
  frame(each?: () => void): void {
    this.run(DT, each);
  }
  /** run until a condition holds or time runs out; returns seconds taken */
  until(cond: () => boolean, max = 5): number {
    const start = this.t;
    while (!cond() && this.t - start < max) this.frame();
    return this.t - start;
  }
  get speedHu(): number {
    return hu(this.p.speed);
  }
}

/** yaw that faces a direction on the ground plane (look = (-sin yaw, -cos yaw)) */
const yawFacing = (x: number, z: number) => (Math.atan2(-x, -z) * 180) / Math.PI;

// ------------------------------------------------------------------ ground
console.log("\nGround speeds (engine values, confirmed by the wiki)");
{
  const s = new Sim();
  s.in.hold("forward");
  s.run(2);
  near("walk, hu/s", s.speedHu, 173.5, 0.05);

  const r = new Sim();
  r.in.hold("forward");
  r.in.tap("sprint");
  r.run(3);
  near("sprint (one press, toggle), hu/s", r.speedHu, 260, 0.05);

  const c = new Sim();
  c.in.hold("forward");
  c.in.hold("crouch");
  c.run(2);
  near("crouch walk, hu/s", c.speedHu, 80, 0.05);

  const hsp = new Sim();
  hsp.p.holsterBoost = MOVE.holsterBoost;
  hsp.in.hold("forward");
  hsp.in.tap("sprint");
  hsp.run(3);
  near("holstered sprint, hu/s", hsp.speedHu, 299, 0.05);
  const hw = new Sim();
  hw.p.holsterBoost = MOVE.holsterBoost;
  hw.in.hold("forward");
  hw.run(2);
  near("holstered walk, hu/s", hw.speedHu, 199.5, 0.05);

  // Acceleration is the same whether crouch-walking or walking; only the top
  // speed differs. So both reach 80 hu/s in the same time.
  const tWalk = new Sim();
  tWalk.in.hold("forward");
  const a = tWalk.until(() => tWalk.speedHu >= 79.9);
  const tCrouch = new Sim();
  tCrouch.in.hold("forward");
  tCrouch.in.hold("crouch");
  const b = tCrouch.until(() => tCrouch.speedHu >= 79.9);
  near("crouch and walk reach 80 hu/s at the same time, s apart", Math.abs(a - b), 0, DT * 1.5);
}

console.log("\nCounter-strafe: brake and drive at once");
{
  const s = new Sim();
  s.in.hold("right");
  s.run(1.5);
  s.in.release("right");
  s.in.hold("left");
  const tMoving = s.until(() => s.p.vel.x < 0);
  const t120 = s.until(() => -s.p.vel.x >= 120 * HU) + tMoving;
  const tFull = s.until(() => -s.p.vel.x >= 173 * HU) + t120;
  near("full speed right to moving left, s", tMoving, 0.046, 0.01);
  // armed: the bands at half rate (the wiki: a weapon out halves acceleration)
  near("to 120 hu/s left, s", t120, 0.142, 0.012);
  near("to full walk speed left, s", tFull, 0.276, 0.015);
  // a 90 degree change (right to forward) kills the old sideways motion as fast
  const q = new Sim();
  q.in.hold("right");
  q.run(1.5);
  q.in.release("right");
  q.in.hold("forward");
  near("right to forward: sideways motion gone in, s", q.until(() => Math.abs(q.p.vel.x) < 0.01), 0.046, 0.01);
  const st = new Sim();
  st.in.hold("forward");
  near("standstill to 120 hu/s armed, s", st.until(() => st.speedHu >= 119.9), 0.096, 0.01);
  const sh = new Sim();
  sh.p.holsterBoost = MOVE.holsterBoost;
  sh.in.hold("forward");
  near("standstill to 120 hu/s holstered, s (the engine's 2500 hu/s2)", sh.until(() => sh.speedHu >= 119.9), 0.048, 0.01);
  // the wiki's own timings (Advanced Slide Tech): 0.35 s to 200 hu/s with a
  // weapon out, 0.12 s holstered, 0.45 s to 207
  const a200 = new Sim();
  a200.in.hold("forward");
  a200.in.tap("sprint");
  near("standing to 200 hu/s with a weapon out, s (wiki 0.35)", a200.until(() => a200.speedHu >= 200), 0.35, 0.06);
  near("and to 207, s (wiki 0.45)", a200.until(() => a200.speedHu >= 207) + 0.3, 0.45, 0.08);
  const h200 = new Sim();
  h200.p.holsterBoost = MOVE.holsterBoost;
  h200.in.hold("forward");
  h200.in.tap("sprint");
  near("standing to 200 hu/s holstered, s (wiki 0.12)", h200.until(() => h200.speedHu >= 200), 0.12, 0.03);

  // the same reversal at 30 and 60 fps must take the same time as at 144
  for (const fps of [30, 60]) {
    const p = new Player({ minX: -99, maxX: 99, minZ: -99, maxZ: 99 });
    RANGE_SOLIDS.length = 0;
    const sc = new Script();
    let t = 10;
    const step = () => {
      t += 1 / fps;
      p.update(1 / fps, t, sc, 0, 1, false);
      sc.endFrame();
    };
    sc.hold("right");
    for (let i = 0; i < fps * 1.5; i++) step();
    sc.release("right");
    sc.hold("left");
    let n = 0;
    while (-p.vel.x < 173 * HU && n < fps) {
      step();
      n++;
    }
    near(`reversal to full walk speed at ${fps} fps, s`, n / fps, 0.276, 1.5 / fps);
  }
}

console.log("\nSprint is PRESS by default (wiki: Sprint)");
{
  const s = new Sim();
  s.in.hold("forward");
  s.in.tap("sprint");
  s.run(3);
  s.in.release("forward");
  s.frame();
  s.in.hold("forward");
  s.run(2);
  near("letting go of forward ends the sprint, hu/s", s.speedHu, 173.5, 0.5);

  const b = new Sim();
  b.in.tap("sprint");
  b.run(2);
  b.in.hold("forward");
  b.run(3);
  near("a press 2 s before moving still sprints (3 s buffer)", b.speedHu, 260, 0.5);

  const x = new Sim();
  x.in.tap("sprint");
  x.run(3.3);
  x.in.hold("forward");
  x.run(3);
  near("a press 3.3 s before moving has expired", x.speedHu, 173.5, 0.5);

  const side = new Sim();
  side.in.hold("right");
  side.in.tap("sprint");
  side.run(3);
  near("no sprinting sideways", side.speedHu, 173.5, 0.5);
}

// -------------------------------------------------------------------- jump
console.log("\nJump and jump fatigue (wiki: Jump, Jump fatigue)");
const peakOf = (s: Sim) => {
  const y0 = s.p.pos.y;
  let peak = y0;
  s.until(() => {
    peak = Math.max(peak, s.p.pos.y);
    return s.p.onGround && s.p.vel.y === 0 && peak > y0 + 0.01;
  });
  return hu(peak - y0);
};
{
  const s = new Sim();
  s.in.tap("jump");
  near("jump height, hu", peakOf(s), 56, 0.6);

  // jump again the frame after landing: 30% height (16.8 hu; wiki measures 16.3)
  s.in.tap("jump");
  near("jump straight after landing, hu", peakOf(s), 16.8, 0.6);

  // after 0.75 s on the ground fatigue has decayed
  s.run(0.8);
  s.in.tap("jump");
  near("jump after 0.75 s, hu", peakOf(s), 56, 0.6);

  // Walking off a ledge turns the fatigue STATE off, so jumping on landing is
  // full height even though a jump happened just before (wiki: fatigue reset
  // with a ledge).
  const L = new Sim([{ minX: -5, maxX: 5, minZ: -5, maxZ: 0.3, top: 0.5 }]);
  L.p.pos.set(0, 0.5, -1);
  L.in.tap("jump");
  peakOf(L); // jump on the block, landing on it turns the timer on
  L.in.hold("forward");
  L.p.yaw = 180; // face +z, toward the edge
  L.until(() => !L.p.onGround);
  L.until(() => L.p.onGround);
  L.in.release("forward");
  L.in.tap("jump");
  near("jump on landing after walking off a ledge, hu", peakOf(L), 56, 0.6);

  // A teleport (a 1v1 respawn, the course's return) starts you fresh: teleported
  // mid-jump, the first jump at the spawn is full height, not fatigued.
  const T = new Sim();
  T.in.tap("jump");
  T.run(0.2);
  T.p.teleport(0, 0, 0, 0);
  T.until(() => T.p.onGround);
  T.run(0.2);
  T.in.tap("jump");
  near("first jump after a teleport taken mid-jump, hu", peakOf(T), 56, 0.6);
}

console.log("\nCoyote time (wiki: 0.2 s)");
{
  const mk = () => {
    const s = new Sim([{ minX: -5, maxX: 5, minZ: -5, maxZ: 0.3, top: 2 }]);
    s.p.pos.set(0, 2, 0);
    s.p.yaw = 180;
    s.in.hold("forward");
    s.until(() => !s.p.onGround);
    s.in.release("forward");
    return s;
  };
  const a = mk();
  a.run(0.15);
  a.in.tap("jump");
  a.frame();
  check("a jump 0.15 s after leaving the edge still fires", a.p.vel.y > 0);
  const b = mk();
  b.run(0.25);
  b.in.tap("jump");
  b.frame();
  check("a jump 0.25 s after leaving the edge does not", b.p.vel.y <= 0);
}

// ------------------------------------------------------------------- slide
console.log("\nSlide (wiki: Slide, Slide jump)");
const sprintTo = (s: Sim, seconds = 2.5) => {
  s.in.hold("forward");
  s.in.tap("sprint");
  s.run(seconds);
};
{
  const s = new Sim();
  sprintTo(s);
  s.in.hold("crouch");
  s.frame();
  // the boost lands on the slide's first frame, which then has one frame of
  // friction applied (fast, because 400 is above the 350 shed point)
  near("slide boost from a sprint, capped, hu/s", s.speedHu + (slideFriction(400 * HU) * DT) / HU, 400, 1);
  check("slide got its boost", s.p.sliding);

  // cooldown counts from the last slide ENTRY: slide, stand, slide again at
  // 1.5 s (no boost), then again at 2.5 s from the first but 1 s from the second
  const c = new Sim();
  sprintTo(c);
  c.in.hold("crouch");
  c.run(0.1);
  c.in.release("crouch");
  c.run(1.4);
  c.in.hold("crouch");
  c.frame();
  const v2 = c.speedHu;
  c.in.release("crouch");
  c.run(1.0);
  c.in.tap("sprint");
  c.run(0.2);
  const before = c.speedHu;
  c.in.hold("crouch");
  c.frame();
  check("a second slide inside 2 s gets no boost", v2 < 300, `${v2.toFixed(0)} hu/s`);
  check("the cooldown restarted on that unboosted entry", c.speedHu < before + 20, `${before.toFixed(0)} -> ${c.speedHu.toFixed(0)} hu/s`);

  // Slide jump: at 400 hu/s, jump immediately (under 0.24 s, above 350) is a
  // deadslide; wait 0.25 s and the speed carries.
  const d = new Sim();
  sprintTo(d);
  d.in.hold("crouch");
  d.frame();
  d.in.tap("jump");
  d.frame();
  check("an instant jump out of a 400 hu/s slide is a deadslide", d.speedHu <= 260.5, `${d.speedHu.toFixed(0)} hu/s`);
  const g = new Sim();
  sprintTo(g);
  g.in.hold("crouch");
  g.run(0.25);
  const vs = g.speedHu;
  g.in.tap("jump");
  g.frame();
  check("a jump 0.25 s into the slide keeps the slide speed", g.speedHu > 300 && Math.abs(g.speedHu - vs) < 10, `${vs.toFixed(0)} -> ${g.speedHu.toFixed(0)} hu/s`);
}

console.log("\nSlide on landing needs 90 hu/s AND 200 hu/s falling (wiki: Air vs Ground Slide)");
{
  // a walking jump lands at ~290 hu/s downward: slides
  const a = new Sim();
  a.in.hold("forward");
  a.run(1);
  a.in.tap("jump");
  a.frame();
  a.in.hold("crouch");
  a.until(() => a.p.onGround);
  check("walk jump, crouch held, slides on landing", a.p.sliding);

  // Walking off a ledge with crouch held. A 0.62 m drop (above the 0.56 m
  // step-down, so it really is a fall) lands at ~191 hu/s: no slide. A 1 m
  // drop lands at ~243: slides.
  // Crouch goes down AFTER leaving the ledge: held on the ledge, it would
  // crouch-walk you off at 80 hu/s, under the 90 needed. (This test used to
  // pass by accident: the player walked off before crouch was ever held.)
  const off = (drop: number) => {
    const b = new Sim([{ minX: -5, maxX: 5, minZ: -8, maxZ: 0.3, top: drop }]);
    b.p.pos.set(0, drop, -5);
    b.p.yaw = 180;
    b.in.hold("forward");
    b.until(() => !b.p.onGround);
    b.in.hold("crouch");
    b.until(() => b.p.onGround);
    return b;
  };
  const b = off(0.62);
  check("a 0.62 m drop does not slide", !b.p.sliding, `landed at ${hu(b.p.landingSpeed).toFixed(0)} hu/s`);
  const c = off(1.0);
  check("a 1 m drop does", c.p.sliding, `landed at ${hu(c.p.landingSpeed).toFixed(0)} hu/s`);
}

console.log("");
console.log("Jump height does not depend on framerate");
for (const fps of [30, 60, 144, 240]) {
  const p = new Player({ minX: -50, maxX: 50, minZ: -50, maxZ: 50 });
  RANGE_SOLIDS.length = 0;
  const sc = new Script();
  let t = 10;
  let peak = 0;
  sc.tap("jump");
  for (let i = 0; i < fps * 2; i++) {
    t += 1 / fps;
    p.update(1 / fps, t, sc, 0, 1, false);
    sc.endFrame();
    peak = Math.max(peak, p.pos.y);
  }
  // the sampled peak can only miss the true apex by the last frame's rise
  near(`jump apex at ${fps} fps, hu`, hu(peak), 56, (MOVE.gravity * (1 / fps) ** 2) / 2 / HU + 0.05);
}

// ------------------------------------------------------------------- lurch
console.log("\nLurch (wiki: Lurch Fundamentals)");
// The press lands `delay` seconds after the jump frame. Expected turn for a
// blend of fraction f toward a 90-degree direction is atan(f / (1 - f)).
const lurchAt = (delay: number, setup?: (s: Sim) => void) => {
  const s = new Sim();
  s.p.vel.set(0, 0, -MOVE.sprintSpeed); // moving forward (-z) at sprint speed
  setup?.(s);
  s.in.tap("jump");
  s.frame();
  s.run(delay - DT);
  const before = s.p.vel.clone();
  s.in.hold("right");
  s.frame();
  const after = s.p.vel.clone();
  const ang = (Math.atan2(after.x, -after.z) - Math.atan2(before.x, -before.z)) * (180 / Math.PI);
  return { ang, speed: Math.hypot(after.x, after.z) / Math.hypot(before.x, before.z) };
};
const expectTurn = (since: number) => {
  const fade = since <= 0.2 ? 1 : Math.max(0, 1 - (since - 0.2) / 0.2);
  const f = Math.min(0.7, 0.7 * fade);
  return (Math.atan2(f, 1 - f) * 180) / Math.PI;
};
{
  const a = lurchAt(0.1);
  near("right lurch at 0.1 s (full strength) turns, degrees", a.ang, expectTurn(0.1), 1);
  near("which is", a.ang, 66.8, 1);
  near("and keeps this share of speed", a.speed, 0.762, 0.02);
  const b = lurchAt(0.3);
  near("at 0.3 s (half strength), degrees", b.ang, expectTurn(0.3), 1);
  const c = lurchAt(0.45);
  near("after 0.4 s, no lurch, degrees", c.ang, 0, 1.0);

  const held = lurchAt(0.1, (s) => s.in.hold("right"));
  near("a direction held BEFORE the jump does not lurch, degrees", held.ang, 0, 1.0);

  // holding left and pressing right is a null lurch
  const nul = lurchAt(0.1, (s) => s.in.hold("left"));
  near("left held + right pressed: null lurch, degrees", nul.ang, 0, 1.0);

  // Tap-strafe: scroll forward every other frame while turning the view.
  const t = new Sim();
  t.p.vel.set(0, 0, -MOVE.sprintSpeed);
  t.in.tap("jump");
  t.frame();
  const v0 = Math.hypot(t.p.vel.x, t.p.vel.z);
  t.run(0.35, (i) => {
    t.p.yaw -= 90 / (0.35 * FPS); // turn right 90 degrees over 0.35 s
    if (i % 2 === 0) t.in.tap("forward");
  });
  const heading = (Math.atan2(t.p.vel.x, -t.p.vel.z) * 180) / Math.PI;
  const kept = Math.hypot(t.p.vel.x, t.p.vel.z) / v0;
  check("tap-strafe turns hard in the air", heading > 60, `${heading.toFixed(0)} degrees`);
  check("and keeps most of its speed", kept > 0.85, `${(kept * 100).toFixed(0)}%`);
}

// ------------------------------------------------------------------- climb
console.log("\nClimb (wiki: Climb Fundamentals, Climb Space)");
// a tall wall whose face is at x = 1.0, the player facing +x against it
const WALL = { minX: 1.0, maxX: 3.0, minZ: -5, maxZ: 5, top: 12 };
const faceWall = (s: Sim) => {
  s.p.pos.set(1.0 - MOVE.radius - 0.001, 0, 0);
  s.p.yaw = yawFacing(1, 0);
};
const climbPeak = (s: Sim) => {
  let peak = 0;
  let attachY = NaN;
  s.until(() => {
    if (s.p.climbing && Number.isNaN(attachY)) attachY = s.p.pos.y;
    peak = Math.max(peak, s.p.pos.y);
    return s.p.onGround && peak > 0.05;
  }, 6);
  return { peak: hu(peak), attach: hu(attachY) };
};
{
  // forward held from the start: attaches just after leaving the ground, so
  // the 100 hu attach offset is the limit, then the 28 hu end boost
  const a = new Sim([WALL]);
  faceWall(a);
  a.in.hold("forward");
  a.in.tap("jump");
  const r = climbPeak(a);
  near("low attach: peak above the attach point, hu", r.peak - r.attach, 128, 4);

  // jump first, press forward at the top of the jump: attaching high, the
  // 147 hu climb space is the limit instead, then the end boost
  const b = new Sim([WALL]);
  faceWall(b);
  b.in.tap("jump");
  b.run(0.38);
  b.in.hold("forward");
  const r2 = climbPeak(b);
  near("high attach: peak, hu (147 climb space + 28 end boost)", r2.peak, 175, 4);

  // 225 hu/s climb speed
  const c = new Sim([WALL]);
  faceWall(c);
  c.in.hold("forward");
  c.in.tap("jump");
  c.run(0.3);
  near("climb speed, hu/s", hu(c.p.vel.y), 225, 1);
  check("stance reads climb", c.p.stance === "climb");

  // facing: attach within 45.57 degrees of the wall normal, not beyond
  const f1 = new Sim([WALL]);
  faceWall(f1);
  f1.p.yaw = yawFacing(1, 0) + 44;
  f1.in.hold("forward");
  f1.in.tap("jump");
  f1.run(0.2);
  check("attaches looking 44 degrees off the wall", f1.p.climbing);
  const f2 = new Sim([WALL]);
  faceWall(f2);
  f2.p.yaw = yawFacing(1, 0) + 47;
  f2.in.hold("forward");
  f2.in.tap("jump");
  f2.run(0.2);
  check("does not attach looking 47 degrees off", !f2.p.climbing);

  // Climb zones (wiki: Climb Zones). Climbing up past 47 hu puts you in the
  // neutral zone: a jump there is a wall push, 258 hu/s out and no added
  // height, only the 225 hu/s you were climbing at carried through.
  const j = new Sim([WALL]);
  const techs: string[] = [];
  j.p.onTech = (name) => techs.push(name);
  faceWall(j);
  j.in.hold("forward");
  j.in.tap("jump");
  j.run(0.35);
  j.in.release("forward");
  const y0 = j.p.pos.y;
  j.in.tap("jump");
  j.frame();
  check("a jump from high on the wall is a wall push", techs.includes("WALL PUSH"), techs.join(","));
  near("wall push, speed away from the wall, hu/s", hu(-j.p.vel.x), 258, 1);
  let top = y0;
  j.until(() => {
    top = Math.max(top, j.p.pos.y);
    return j.p.vel.y < 0;
  });
  near("wall push height: only the carried 225 hu/s climb (225^2 / 2g), hu", hu(top - y0), (225 * 225) / 1500, 1);

  // Wallbounce: run at the wall, let go of forward, reach it at the top of a
  // jump, slip into the green zone and jump. Against the same approach
  // jumping as soon as you touch the wall (still in the neutral zone).
  const bounce = (waitForGreen: boolean) => {
    const s = new Sim([WALL]);
    const names: string[] = [];
    s.p.onTech = (name) => names.push(name);
    s.p.yaw = yawFacing(1, 0);
    s.p.pos.set(1.0 - MOVE.radius - 1.76, 0, 0);
    s.p.vel.set(173.5 * HU, 0, 0);
    s.in.tap("jump");
    s.frame();
    s.until(() => s.p.climbing, 1.5);
    const attach = hu(s.p.pos.y);
    if (waitForGreen) s.until(() => hu(s.p.pos.y) < 44, 1);
    const from = hu(s.p.pos.y);
    s.in.tap("jump");
    s.frame();
    const out = hu(-s.p.vel.x);
    const total = hu(s.p.vel.length());
    let peak = 0;
    s.until(() => {
      peak = Math.max(peak, hu(s.p.pos.y));
      return s.p.vel.y < 0 && s.p.pos.y < 0.2;
    }, 3);
    return { attach, from, peak, out, total, names };
  };
  const wb = bounce(true);
  const push = bounce(false);
  check("letting go of forward, you meet the wall high and slip down", wb.attach > 47, `attached at ${wb.attach.toFixed(0)} hu`);
  check("jumping in the green zone is a wallbounce", wb.names.includes("WALLBOUNCE"), wb.names.join(","));
  near("wallbounce, speed away from the wall, hu/s", wb.out, 258, 1);
  // the wiki's dismount table: 484 at the bottom of the green zone, 350 at the top
  check("a wallbounce leaves at 350 to 484 hu/s (wiki: wall bounce min and max)", wb.total >= 349 && wb.total <= 485, `${wb.total.toFixed(0)} hu/s from ${wb.from.toFixed(0)} hu up`);
  check("a wallbounce climbs clearly higher than jumping on contact", wb.peak - push.peak > 15, `bounce ${wb.peak.toFixed(0)} hu, on contact ${push.peak.toFixed(0)} hu from ${push.from.toFixed(0)}`);

  // The basic wallbounce as the wiki teaches it: sprint, crouch, slide JUMP,
  // let go of forward, hit the wall at the top of the jump, jump. The slide
  // jump's apex (44 hu) is inside the green zone; a plain sprint jump's (56)
  // is not, and gives a wall push.
  const basic = (slideJump: boolean) => {
    const s = new Sim([WALL]);
    const names: string[] = [];
    s.p.onTech = (name, detail) => names.push(`${name} ${detail}`);
    s.p.yaw = yawFacing(1, 0);
    // start far enough back to be at full sprint, jump 2.5 m from the wall
    // so the apex of the jump lands on it
    s.p.pos.set(1.0 - MOVE.radius - 12, 0, 0);
    sprintTo(s, 1.0);
    s.until(() => s.p.pos.x > 1.0 - MOVE.radius - 2.5, 3);
    if (slideJump) {
      // crouch stays held through the jump frame, as a player's does: letting
      // go on the same frame ends the slide before the jump resolves
      s.in.hold("crouch");
      s.frame();
      s.in.tap("jump");
      s.in.release("forward");
      s.frame();
      s.in.release("crouch");
    } else {
      s.in.tap("jump");
      s.in.release("forward");
      s.frame();
    }
    s.until(() => s.p.climbing, 1.5);
    const attach = hu(s.p.pos.y);
    s.frame();
    s.in.tap("jump");
    s.frame();
    return { attach, names, total: hu(s.p.vel.length()), climbed: attach > 0 };
  };
  const bs = basic(true);
  check("basic wallbounce: slide jump, W released, hit the wall, jump: WALLBOUNCE", bs.climbed && bs.names.some((n) => n.startsWith("WALLBOUNCE")), `attached at ${bs.attach.toFixed(0)} hu: ${bs.names.join(" | ")}`);
  check("and it leaves at the wiki's 350 to 484 hu/s", bs.total >= 349 && bs.total <= 485, `${bs.total.toFixed(0)} hu/s`);
  const bp = basic(false);
  check("the same off a plain sprint jump is a WALL PUSH (apex 56 hu, above the zone)", bp.climbed && bp.names.some((n) => n.startsWith("WALL PUSH")), `attached at ${bp.attach.toFixed(0)} hu: ${bp.names.join(" | ")}`);
  check("and the push line says how high you were and what to do", bp.names.some((n) => /too high: \d+ hu up.*Slide jump/.test(n)), bp.names.join(" | "));

  // Crouch kick: a mini-bounce with crouch on the same frame, 320 hu/s (wiki)
  const ck = new Sim([WALL]);
  const cknames: string[] = [];
  ck.p.onTech = (name) => cknames.push(name);
  faceWall(ck);
  ck.in.hold("forward");
  ck.in.tap("jump");
  ck.until(() => ck.p.climbing, 0.5);
  ck.in.release("forward");
  ck.in.tap("jump");
  ck.in.tap("crouch");
  ck.frame();
  check("jump and crouch on the same frame in the mini zone is a crouch kick", cknames.includes("CROUCH KICK"), cknames.join(","));
  near("crouch kick, speed away from the wall, hu/s", hu(-ck.p.vel.x), 245, 1);
  check("crouch kick, total speed at least the wiki's 320 hu/s", hu(ck.p.vel.length()) >= 319, `${hu(ck.p.vel.length()).toFixed(0)} hu/s`);

  // Wallskip: keep holding into the wall and the bounce gives height, no distance
  const ws = new Sim([WALL]);
  const wsnames: string[] = [];
  ws.p.onTech = (name) => wsnames.push(name);
  ws.p.yaw = yawFacing(1, 0);
  ws.p.pos.set(1.0 - MOVE.radius - 1.76, 0, 0);
  ws.p.vel.set(173.5 * HU, 0, 0);
  ws.in.tap("jump");
  ws.frame();
  ws.until(() => ws.p.climbing, 1.5);
  ws.until(() => hu(ws.p.pos.y) < 44, 1);
  ws.in.hold("forward");
  ws.in.tap("jump");
  ws.frame();
  check("wallskip: W held into the wall, still a WALLBOUNCE", wsnames.includes("WALLBOUNCE"), wsnames.join(","));
  near("but with no speed away from the wall, hu/s", hu(-ws.p.vel.x), 0, 6);
  check("and the height is still there", hu(ws.p.vel.y) > 230, `${hu(ws.p.vel.y).toFixed(0)} hu/s up`);

  // Mini-bounce: jump off within 19 hu of the baseline
  const mb = new Sim([WALL]);
  const mnames: string[] = [];
  mb.p.onTech = (name) => mnames.push(name);
  faceWall(mb);
  mb.in.hold("forward");
  mb.in.tap("jump");
  mb.until(() => mb.p.climbing, 0.5);
  mb.in.release("forward");
  mb.in.tap("jump");
  mb.frame();
  check("a jump in the bottom 19 hu is a mini-bounce", mnames.includes("MINI-BOUNCE"), mnames.join(","));
  near("mini-bounce, speed away from the wall, hu/s", hu(-mb.p.vel.x), 188, 1);

  // crouch detaches, and you cannot reattach above the old attach point
  const d = new Sim([WALL]);
  faceWall(d);
  d.in.hold("forward");
  d.in.tap("jump");
  d.run(0.2);
  d.in.tap("crouch");
  d.frame();
  check("crouch detaches", !d.p.climbing);
  d.run(0.05);
  check("no reattach above the previous attach point", !d.p.climbing || d.p.pos.y < 0.2);
}

// --------------------------------------------------------- mantle, superglide
console.log("\nMantle and superglide (wiki: Mantle, Superglide)");
{
  // A 2.5 m block ahead: a sprinting jump into it mantles at the apex.
  const BLOCK = { minX: 1.0, maxX: 4, minZ: -5, maxZ: 5, top: 2.5 };
  const approach = () => {
    const s = new Sim([BLOCK]);
    s.p.pos.set(-4, 0, 0);
    s.p.yaw = yawFacing(1, 0);
    sprintTo(s, 1.2);
    s.in.tap("jump");
    s.until(() => s.p.stance === "mantle" || s.p.climbing, 3);
    // a climb that turns into a mantle is fine too
    s.until(() => s.p.stance === "mantle", 2);
    return s;
  };
  const m = approach();
  check("jumping into a 2.5 m ledge ends in a mantle", m.p.stance === "mantle");

  // measure the mantle's length in frames, then superglide inside its last 0.15 s
  const probe = approach();
  let frames = 0;
  while (probe.p.stance === "mantle" && frames < 2000) {
    probe.frame();
    frames++;
  }
  const s2 = approach();
  const startedAt = s2.t;
  s2.run((frames - Math.round(0.1 * FPS)) * DT);
  s2.in.tap("jump");
  s2.frame();
  s2.in.tap("crouch");
  s2.frame();
  check("superglide fires in the last 0.15 s", s2.p.superglidedAt >= startedAt, s2.p.stance);

  // the trainer and the cue (trainer.ts): the same superglide scored, a late crouch called a miss
  {
    const tr = new SuperglideTrainer();
    const t1 = approach();
    t1.p.onTech = (n, d) => tr.onTech(n, d);
    check("the trainer's cue is shut early in the mantle", !tr.cue && t1.p.mantleInfo !== null);
    for (let i = 0; i < frames - Math.round(0.1 * FPS); i++) {
      t1.p.update(DT, (t1.t += DT), t1.in, 0, 1, false);
      tr.update(t1.t, t1.p, t1.in);
      t1.in.endFrame();
    }
    check("the cue is open inside the window", tr.cue, `${t1.p.mantleInfo?.remaining.toFixed(3)} s left`);
    t1.in.tap("jump");
    t1.p.update(DT, (t1.t += DT), t1.in, 0, 1, false);
    tr.update(t1.t, t1.p, t1.in);
    t1.in.endFrame();
    t1.in.tap("crouch");
    t1.p.update(DT, (t1.t += DT), t1.in, 0, 1, false);
    tr.update(t1.t, t1.p, t1.in);
    t1.in.endFrame();
    const h = tr.hud(t1.t);
    check("the trainer scores it a superglide, one frame apart", h?.result === "SUPERGLIDE" && h.frames === 1 && tr.tries.join() === "true", JSON.stringify(h && { r: h.result, f: h.frames }));
    const t2 = approach();
    t2.p.onTech = (n, d) => tr.onTech(n, d);
    for (let i = 0; i < frames - Math.round(0.1 * FPS); i++) {
      t2.p.update(DT, (t2.t += DT), t2.in, 0, 1, false);
      tr.update(t2.t, t2.p, t2.in);
      t2.in.endFrame();
    }
    t2.in.tap("jump");
    for (let i = 0; i < 4; i++) {
      if (i === 3) t2.in.tap("crouch");
      t2.p.update(DT, (t2.t += DT), t2.in, 0, 1, false);
      tr.update(t2.t, t2.p, t2.in);
      t2.in.endFrame();
    }
    t2.until(() => t2.p.stance !== "mantle", 1);
    tr.update(t2.t, t2.p, t2.in);
    const h2 = tr.hud(t2.t);
    check("a crouch 3 frames late is a miss, with the reason", h2?.result === "MISS" && /3 frames/.test(h2.reason) && tr.tries.join() === "true,false", JSON.stringify(h2 && { r: h2.result, why: h2.reason, tries: tr.tries }));
  }
  near("superglide speed out of a sprint, hu/s", s2.speedHu, 400, 3);

  // same frame jump and crouch: no superglide
  const s3 = approach();
  s3.run((frames - Math.round(0.1 * FPS)) * DT);
  s3.in.tap("jump");
  s3.in.tap("crouch");
  s3.frame();
  s3.frame();
  check("jump and crouch on the SAME frame is not a superglide", s3.speedHu < 300, `${s3.speedHu.toFixed(0)} hu/s`);

  // too early: 0.3 s before the end
  const s4 = approach();
  s4.run((frames - Math.round(0.3 * FPS)) * DT);
  s4.in.tap("jump");
  s4.frame();
  s4.in.tap("crouch");
  s4.frame();
  check("0.3 s before the end is too early", s4.p.stance === "mantle");

  // The misses say what to change. Each scenario names its own reason.
  const missOf = (drive: (s: Sim) => void): string => {
    const s = approach();
    const out: string[] = [];
    s.p.onTech = (name, detail) => out.push(`${name}: ${detail}`);
    drive(s);
    return out.find((t) => t.startsWith("SUPERGLIDE MISS")) ?? out.join(" | ");
  };
  const lateMiss = missOf((s) => {
    s.run((frames - Math.round(0.1 * FPS)) * DT);
    s.in.tap("jump");
    s.frame();
    s.frame();
    s.frame();
    s.in.tap("crouch");
    s.frame();
  });
  check("a crouch 3 frames after the jump is called out", /crouch 3 frames after jump/.test(lateMiss), lateMiss);
  const sameMiss = missOf((s) => {
    s.run((frames - Math.round(0.1 * FPS)) * DT);
    s.in.tap("jump");
    s.in.tap("crouch");
    s.frame();
  });
  check("jump and crouch on the same frame is called out", /same frame/.test(sameMiss), sameMiss);
  const earlyMiss = missOf((s) => {
    s.run((frames - Math.round(0.3 * FPS)) * DT);
    s.in.tap("jump");
    s.frame();
  });
  check("a jump 0.3 s early is called out with the time left", /jump early: 0\.(29|30|31) s/.test(earlyMiss), earlyMiss);
  const beforeMiss = missOf((s) => {
    s.run((frames - Math.round(0.05 * FPS)) * DT);
    s.in.tap("crouch");
    s.frame();
  });
  check("a crouch before any jump is called out", /crouch came before jump/.test(beforeMiss), beforeMiss);
}

console.log("\nWall attach misses say why (ours: the feed's diagnostics)");
{
  const WALL = { minX: 1.0, maxX: 2, minZ: -5, maxZ: 5, top: 10 };
  const attempt = (yawDeg: number, vx: number, drive?: (s: Sim) => void): string[] => {
    const s = new Sim([WALL]);
    const out: string[] = [];
    s.p.onTech = (name, detail) => out.push(`${name}: ${detail}`);
    // in the air beside the wall, no coyote time left
    s.p.teleport(1.0 - MOVE.radius - 0.02, 0.6, 0, yawDeg);
    s.p.vel.set(vx, 0, 0);
    drive?.(s);
    s.in.tap("jump");
    s.frame();
    return out;
  };
  // looking along the wall (+z), drifting into it: not facing it
  const away = attempt(180, 0.5);
  check("looking away from the wall: 'look at it' with the angle", away.some((t) => /NO WALL: look at it \(90 deg off/.test(t)), away.join(" | "));
  // facing it, no push and no speed toward it
  const still = attempt(yawFacing(1, 0), 0);
  check("facing it but not pushing: 'push into it'", still.some((t) => /NO WALL: push into it/.test(t)), still.join(" | "));
  // facing it and pushing: it attaches instead, no miss
  const ok = attempt(yawFacing(1, 0), 0.5);
  check("facing and moving into it: attaches, nothing to explain", !ok.some((t) => t.startsWith("NO WALL")), ok.join(" | "));
}

// -------------------------------------------------------------- fall stun
console.log("\nFall stun (wiki: Fallstun)");
{
  const drop = (heightHu: number) => {
    const s = new Sim();
    s.p.pos.set(0, heightHu * HU, 0);
    s.p.onGround = false;
    s.p.vel.set(3, 0, 0);
    s.until(() => s.p.onGround, 10);
    return s;
  };
  const low = drop(250);
  check("a 250 hu fall has no stun", !low.p.stunned && low.p.speed > 2.9);
  const full = drop(820);
  check("an 820 hu fall stuns", full.p.stunned);
  near("and removes horizontal speed, m/s", full.p.speed, 0, 0.01);
  full.run(0.95);
  check("for about 1 s", full.p.stunned);
  full.run(0.1);
  check("then it ends", !full.p.stunned);
}

// ----------------------------------------------------------- bhop penalty
console.log("\nHop penalty (wiki: Bunnyhop vs Slidehop)");
{
  const s = new Sim();
  s.p.pos.set(0, 1, 0);
  s.p.onGround = false;
  s.p.vel.set(0, 0, -450 * HU);
  s.until(() => s.p.onGround);
  s.in.tap("jump");
  s.frame();
  near("a hop at 450 hu/s within 0.1 s of landing, hu/s", s.speedHu, 350, 2);
  const w = new Sim();
  w.p.pos.set(0, 1, 0);
  w.p.onGround = false;
  w.p.vel.set(0, 0, -200 * HU);
  w.until(() => w.p.onGround);
  w.in.tap("jump");
  w.frame();
  near("below sprint speed there is no penalty, hu/s", w.speedHu, 200, 2);
}

// -------------------------------------------------- low frame rates stay stable
console.log("\nThe landing dip settles at any frame rate");
{
  // a hard landing, then 3 s at 10 fps (the frame-time clamp): the view must
  // settle back, not swing further out every frame
  for (const fps of [10, 30, 144]) {
    const p = new Player({ minX: -99, maxX: 99, minZ: -99, maxZ: 99 });
    RANGE_SOLIDS.length = 0;
    const sc = new Script();
    p.pos.set(0, 6, 0);
    p.onGround = false;
    let t = 10;
    let worst = 0;
    for (let i = 0; i < fps * 3; i++) {
      t += 1 / fps;
      p.update(1 / fps, t, sc, 0, 1, false);
      sc.endFrame();
      worst = Math.max(worst, Math.abs(p.viewDip));
    }
    check(`${fps} fps: the dip stays small and settles`, worst < 0.2 && Math.abs(p.viewDip) < 0.005, `worst ${worst.toFixed(3)} m, end ${p.viewDip.toFixed(4)} m`);
  }
}

// -------------------------------------------------------- slide start feel
console.log("\nSlide starts at once");
{
  const s = new Sim();
  sprintTo(s, 2);
  const eye0 = s.p.eyePosition().y;
  s.in.hold("crouch");
  s.frame();
  check("sprinting, the slide starts on the frame crouch is pressed", s.p.stance === "slide", s.p.stance);
  s.run(0.1);
  const dropped = eye0 - s.p.eyePosition().y;
  near("and the view is all the way down 0.1 s later, m", dropped, MOVE.eyeStand - MOVE.eyeCrouch, 0.005);
}

// ------------------------------------------------------------- ziplines
// Apex Movement Wiki, Zipline Basics / Zip Jump / Zip Crouch, and the engine
// values it lists (ziplineAcceleration 400, ziplineJumpOnAcceleration 1000,
// mountZiplineTime 0.5, useZiplineCooldown 0.4).
console.log("\nZiplines");
{
  // a level zip along +z, 3 m up: under it your hands are 0.87 m below
  const LEVEL: Array<[[number, number, number], [number, number, number]]> = [[[0, 3, 0], [0, 3, 60]]];
  const mount = (z = 5, yaw = 180) => {
    const s = new Sim([], LEVEL);
    s.p.pos.set(0, 0, z);
    s.p.yaw = yaw;
    s.frame();
    s.in.tap("interact");
    s.frame();
    return s;
  };

  const a = mount();
  check("E under a zip you are looking along mounts it", a.p.stance === "zip");
  a.run(0.25);
  near("0.25 s in: speed at the 1000 hu/s2 mount acceleration, hu/s", a.speedHu, 250, 8);
  a.run(0.35);
  near("0.6 s in: 400 hu/s2 after the 0.5 s mount, hu/s", a.speedHu, 540, 8);
  a.run(1.5);
  near("top speed on a regular zip, hu/s", a.speedHu, 600, 0.5);
  check("you ride the way you look (+z)", a.p.vel.z > 0);
  const back = mount(30, 0);
  back.run(0.3);
  check("looking the other way rides the other way", back.p.vel.z < 0);
  const pole = mount(0.6, 0);
  pole.run(0.3);
  check("near a pole you are forced away from it, wherever you look", pole.p.vel.z > 0);

  // momentum along the zip carries over, up to its cap
  const run = new Sim([], LEVEL);
  run.p.pos.set(0, 0, 3);
  run.p.yaw = 180;
  sprintTo(run, 1.2);
  const before = run.speedHu;
  run.in.tap("interact");
  run.frame();
  near("sprinting into it keeps your speed, hu/s", run.speedHu, before, 0.5);
  run.frame();
  near("and builds on it from there (+1 frame at 1000 hu/s2), hu/s", run.speedHu, before + 1000 / FPS, 0.5);

  // ride to the end
  const end = mount(40);
  end.until(() => end.p.stance !== "zip", 5);
  check("riding to the end throws you off", end.p.stance === "air");
  check("at up to 600 hu/s", end.speedHu <= 600.5 && end.speedHu > 590, `${end.speedHu.toFixed(1)}`);

  // zip jump: capped at 445, a little up, along a shallow zip whatever you press
  const j = mount();
  j.run(2);
  j.in.hold("left");
  j.in.tap("jump");
  j.frame();
  near("zip jump off a shallow zip: horizontal cap, hu/s", j.speedHu, 445, 1);
  check("and it pops you up", j.p.vel.y > 0);
  check("along the zip even holding left (shallower than 45 degrees)", Math.abs(j.p.vel.x) < 1e-6, `vx ${j.p.vel.x.toFixed(3)}`);
  // A zip jump is not a jump, so it does not turn jump fatigue on. Jump 0.2 s
  // after landing: with fatigue that is about a third of full height, without
  // it full height. (Sooner than 0.1 s the bunny-hop penalty applies instead,
  // which is a different rule.)
  j.in.release("left");
  j.until(() => j.p.onGround, 3);
  j.run(0.2);
  j.in.tap("jump");
  const y0 = j.p.pos.y;
  let peak = 0;
  j.run(0.6, () => (peak = Math.max(peak, j.p.pos.y - y0)));
  near("no jump fatigue after a zip jump: next jump height, hu", hu(peak), 56, 0.6);

  // zip crouch: off with the zip's momentum, no pop
  const c = mount();
  c.run(2);
  c.in.tap("crouch");
  c.frame();
  near("zip crouch: horizontal cap, hu/s", c.speedHu, 445, 1);
  check("and no pop", c.p.vel.y <= 0);

  // the re-use cooldown: 0.4 s before you can grab again
  const cd = mount();
  cd.run(0.3);
  cd.in.tap("crouch");
  cd.frame();
  cd.run(0.2, () => cd.p.pos.set(0, 0.87, cd.p.pos.z));
  cd.in.tap("interact");
  cd.frame();
  check("0.2 s after leaving, E does nothing", cd.p.stance !== "zip");
  cd.run(0.25, () => cd.p.pos.set(0, 0.87, cd.p.pos.z));
  cd.in.tap("interact");
  cd.frame();
  check("0.45 s after, it grabs again", cd.p.stance === "zip");

  // no interact on the ground while aiming
  const ads = new Sim([], LEVEL);
  ads.p.pos.set(0, 0, 5);
  ads.p.yaw = 180;
  ads.ads = 1;
  ads.frame();
  ads.in.tap("interact");
  ads.frame();
  check("aiming on the ground, no zip", ads.p.stance !== "zip" && !ads.p.zipPrompt);

  // the look cone: 35 degrees on the ground, 90 in the air
  const cone = (yawOff: number, air: boolean) => {
    const s = new Sim([], [[[3, 3, 0], [3, 3, 60]]]);
    s.p.pos.set(1.5, 0, 5);
    s.p.yaw = yawFacing(1, 0) + yawOff; // face the rope, 1.5 m to the +x side
    if (air) {
      s.p.pos.y = 0.6;
      s.p.onGround = false;
    }
    s.frame();
    return s.p.zipPrompt;
  };
  check("ground: 30 degrees off the rope, prompt", cone(30, false));
  check("ground: 40 degrees off, no prompt", !cone(40, false));
  check("air: 80 degrees off, prompt", cone(80, true));
  check("air: 100 degrees off, no prompt", !cone(100, true));

  // three mid-air interacts, then none until you land or 3 s pass
  const air = new Sim([], [[[0, 20, 0], [0, 20, 200]]]);
  const hangAir = () => {
    air.p.pos.set(0, 20 - MOVE.ziplineHang, air.p.pos.z);
    air.p.vel.set(0, 0, 0);
  };
  air.p.yaw = 180;
  air.p.pos.set(0, 20 - MOVE.ziplineHang, 20);
  air.p.onGround = false;
  let grabs = 0;
  for (let i = 0; i < 4; i++) {
    air.in.tap("interact");
    air.frame();
    if (air.p.stance === "zip") grabs++;
    air.run(0.1);
    air.in.tap("crouch");
    air.frame();
    air.run(0.45, hangAir);
  }
  check("three mid-air grabs, the fourth refused", grabs === 3, `${grabs} grabs`);
  air.run(2.6, hangAir);
  air.in.tap("interact");
  air.frame();
  check("3 s off the zip gives one back", air.p.stance === "zip");

  // riding 0.5 s resets the climb space: grab a vertical zip high in the air
  // (climb space still at the ground), ride, drop off into a wall and climb
  const climbAfter = (ride: number) => {
    const s = new Sim([{ minX: -5, maxX: 5, minZ: -4, maxZ: -0.6, top: 40 }], [[[0, 0.3, 0], [0, 30, 0]]]);
    s.p.yaw = 0; // facing the wall (-z)
    s.p.pos.set(0, 8, 0);
    s.p.onGround = false;
    s.frame();
    s.in.tap("interact");
    s.frame();
    s.run(ride);
    s.in.tap("crouch");
    s.frame();
    s.in.hold("forward");
    s.run(0.25);
    return s.p.stance;
  };
  check("after 0.6 s on a zip you can climb out of it", climbAfter(0.6) === "climb", climbAfter(0.6));
  check("after 0.3 s you cannot (climb space still at the ground)", climbAfter(0.3) !== "climb", climbAfter(0.3));

  // vertical zips top out at 480
  const v = new Sim([], [[[0, 0.3, 0], [0, 60, 0]]]);
  v.p.pos.set(0, 0, 0.9);
  v.frame();
  v.in.tap("interact");
  v.frame();
  v.run(2);
  near("vertical zip top speed, hu/s", Math.abs(v.p.vel.y) / HU, 480, 0.5);
  check("looking level on a vertical zip rides up", v.p.vel.y > 0);
  // and off a steep zip you jump any way you like
  v.in.hold("left");
  v.in.tap("jump");
  v.frame();
  const lx = v.p.vel.x;
  check("zip jump off a vertical zip goes where you steer (left = -x)", lx < -1, `vx ${lx.toFixed(2)}`);
  near("at ziplineJumpOffSpeed, hu/s", v.speedHu, 400, 1);

  // Superjump (wiki: Superjump Variations): grab from the ground, then two
  // jumps on consecutive frames, which is what a scroll wheel on jump gives.
  // The second is a coyote-time jump and stacks on the zip jump's pop.
  const sj = (gapFrames: number, grabFromGround = true) => {
    const s = new Sim([], LEVEL);
    const names: string[] = [];
    s.p.onTech = (n) => names.push(n);
    s.p.pos.set(0, grabFromGround ? 0 : 0.6, 5);
    s.p.yaw = 180;
    if (!grabFromGround) {
      s.p.onGround = false;
      s.t += 1; // long past any coyote time
    }
    s.frame();
    s.in.tap("interact");
    s.frame();
    s.in.tap("jump");
    s.frame();
    for (let i = 0; i < gapFrames; i++) s.frame();
    s.in.tap("jump");
    s.frame();
    let peak = 0;
    s.until(() => {
      peak = Math.max(peak, s.p.pos.y);
      return s.p.vel.y < 0;
    }, 3);
    return { peak: hu(peak), names };
  };
  const superj = sj(0);
  const single = (() => {
    const s = new Sim([], LEVEL);
    s.p.pos.set(0, 0, 5);
    s.p.yaw = 180;
    s.frame();
    s.in.tap("interact");
    s.frame();
    s.in.tap("jump");
    s.frame();
    let peak = 0;
    s.until(() => {
      peak = Math.max(peak, s.p.pos.y);
      return s.p.vel.y < 0;
    }, 3);
    return hu(peak);
  })();
  check("interact, jump, jump from the ground is a superjump", superj.names.includes("SUPERJUMP"), superj.names.join(","));
  check("and goes far higher than the zip jump alone", superj.peak > single + 40, `superjump ${superj.peak.toFixed(0)} hu, zip jump ${single.toFixed(0)} hu`);
  const late = sj(Math.round(0.3 * FPS));
  check("second jump after coyote time runs out: no superjump", !late.names.includes("SUPERJUMP") && late.peak < superj.peak - 30, `peak ${late.peak.toFixed(0)} hu`);

  // geometry in the way throws you off
  const hit = mount(5);
  RANGE_SOLIDS.push({ minX: -3, maxX: 3, minZ: 20, maxZ: 21, top: 10, base: 0 });
  hit.until(() => hit.p.stance !== "zip", 3);
  check("a wall across the zip throws you off before it", hit.p.stance === "air" && hit.p.pos.z < 20);
  check("with half your speed", hit.speedHu < 320 && hit.speedHu > 250, `${hit.speedHu.toFixed(0)}`);
  check("jump velocity helper sanity", Math.abs(jumpVelocityFor(MOVE.jumpHeight) - Math.sqrt(2 * MOVE.gravity * MOVE.jumpHeight)) < 1e-9);
}

// ------------------------------------------------------------- the course
// The same shapes as src/game/course.ts, rebuilt here because the course
// itself draws signs to canvases and cannot be constructed outside a browser.
// These prove each room is possible with our movement, not just designed.
console.log("\nThe course is completable");
{
  // VENT: a wall with a crawl space under a slab at 1.25 m
  const VENT = [
    { minX: -12, maxX: -2, minZ: 9.5, maxZ: 10.5, top: 7 },
    { minX: 2, maxX: 12, minZ: 9.5, maxZ: 10.5, top: 7 },
    { minX: -2, maxX: 2, minZ: 9.5, maxZ: 10.5, top: 7, base: 1.25 },
  ];
  const slide = new Sim(VENT);
  slide.p.yaw = 180; // face +z
  sprintTo(slide, 1.2);
  slide.in.hold("crouch");
  slide.until(() => slide.p.pos.z > 11.5, 3);
  check("sprint and slide passes under the vent", slide.p.pos.z > 11.5, `z ${slide.p.pos.z.toFixed(2)}`);

  const walk = new Sim(VENT);
  walk.p.yaw = 180;
  walk.in.hold("forward");
  walk.run(4);
  check("walking upright does not", walk.p.pos.z < 9.2, `z ${walk.p.pos.z.toFixed(2)}`);

  // crouch-walk to the middle of the crawl space, then let go of everything
  const stuck = new Sim(VENT);
  stuck.p.pos.set(0, 0, 8);
  stuck.p.yaw = 180;
  stuck.in.hold("crouch");
  stuck.run(0.5);
  stuck.in.hold("forward");
  stuck.until(() => stuck.p.pos.z > 10, 4);
  stuck.in.release("crouch");
  stuck.in.release("forward");
  stuck.run(0.3);
  check("letting go of crouch underneath keeps you crouched", stuck.p.crouched && stuck.p.pos.z > 9.5 && stuck.p.pos.z < 10.5, `${stuck.p.stance} at z ${stuck.p.pos.z.toFixed(2)}`);
  stuck.in.hold("forward");
  stuck.run(1.5);
  check("and you stand once you are out", !stuck.p.crouched && stuck.p.pos.z > 11, `${stuck.p.stance} at z ${stuck.p.pos.z.toFixed(2)}`);

  const bump = new Sim([{ minX: -3, maxX: 3, minZ: -3, maxZ: 3, top: 3, base: 1.5 }]);
  bump.p.crouched = true;
  bump.in.hold("crouch");
  bump.run(0.5);
  bump.in.tap("jump");
  let top = 0;
  bump.run(0.6, () => (top = Math.max(top, bump.p.pos.y + MOVE.crouchHeight)));
  check("a jump under a 1.5 m ceiling stops at it", top <= 1.5 + 1e-3, `head ${top.toFixed(3)} m`);

  // CLIMB: 4.2 m, beyond a jump plus a mantle (3.45 m), within a climb
  const WALL42 = { minX: 1.0, maxX: 2.0, minZ: -12, maxZ: 12, top: 4.2 };
  const TOPDECK = { minX: 2.0, maxX: 8.0, minZ: -12, maxZ: 12, top: 4.2 };
  const cl = new Sim([WALL42, TOPDECK]);
  cl.p.pos.set(-2, 0, 0);
  cl.p.yaw = yawFacing(1, 0);
  cl.in.hold("forward");
  cl.run(0.4);
  cl.in.tap("jump");
  cl.until(() => cl.p.onGround && cl.p.pos.y > 4, 4);
  check("jump, climb and mantle get on top of the 4.2 m wall", cl.p.pos.y > 4.1, `feet ${cl.p.pos.y.toFixed(2)} m`);

  // SUPERGLIDE ledge: 1.4 m mantles
  const ledge = new Sim([{ minX: 1.0, maxX: 9, minZ: -12, maxZ: 12, top: 1.4 }]);
  ledge.p.pos.set(-3, 0, 0);
  ledge.p.yaw = yawFacing(1, 0);
  sprintTo(ledge, 0.6);
  ledge.in.tap("jump");
  ledge.until(() => ledge.p.onGround && ledge.p.pos.y > 1.3, 3);
  check("the 1.4 m ledge is mantled", ledge.p.pos.y > 1.35, `feet ${ledge.p.pos.y.toFixed(2)} m`);

  // GAP: from the right platform, over a 3 m gap, onto the offset left one
  const START = { minX: 5, maxX: 12, minZ: 80.5, maxZ: 85, top: 1.4 };
  const LAND = { minX: -8, maxX: 4, minZ: 88, maxZ: 92.5, top: 1.4 };
  const jumpGap = (lurch: boolean) => {
    const g = new Sim([START, LAND]);
    g.p.pos.set(lurch ? 6 : 8, 1.4, 81);
    g.p.yaw = lurch ? 180 : yawFacing(-0.55, 1);
    sprintTo(g, 0.9);
    g.in.hold("crouch");
    g.until(() => g.p.pos.z > 84.3, 2);
    g.in.release("crouch");
    g.in.tap("jump");
    g.frame();
    if (lurch) {
      // W stays held and D is pressed: the lurch aims forward-right, which
      // turns you without throwing away the forward speed a pure sideways
      // lurch would.
      g.run(0.08);
      g.in.hold("right");
    }
    g.until(() => g.p.onGround || g.p.pos.y < 0.5, 3);
    return g;
  };
  const diag = jumpGap(false);
  check("a diagonal slide jump makes the gap", diag.p.onGround && diag.p.pos.y > 1.3, `landed at x ${diag.p.pos.x.toFixed(1)} z ${diag.p.pos.z.toFixed(1)} y ${diag.p.pos.y.toFixed(2)}`);
  // and a straight jump with no turn misses, which is the point of the room
  const straight = new Sim([START, LAND]);
  straight.p.pos.set(5.3, 1.4, 81);
  straight.p.yaw = 180;
  sprintTo(straight, 0.9);
  straight.in.hold("crouch");
  straight.until(() => straight.p.pos.z > 84.3, 2);
  straight.in.release("crouch");
  straight.in.tap("jump");
  straight.frame();
  straight.until(() => straight.p.onGround || straight.p.pos.y < 0.5, 3);
  check("a straight jump with no turn falls in", straight.p.pos.y < 1, `y ${straight.p.pos.y.toFixed(2)}`);
  const lur = jumpGap(true);
  check("so does a straight slide jump with a forward-right lurch (W held, D tapped)", lur.p.onGround && lur.p.pos.y > 1.3, `landed at x ${lur.p.pos.x.toFixed(1)} z ${lur.p.pos.z.toFixed(1)} y ${lur.p.pos.y.toFixed(2)}`);

  // ZIPLINE room: the deck, the vertical zip up its face, the long zip down
  // across the room, and the exit door it throws you through
  const DECK = { minX: -12, maxX: -2, minZ: 96, maxZ: 100, top: 4.5 };
  const EXIT = [
    { minX: -12, maxX: 5, minZ: 116.5, maxZ: 117.5, top: 7 },
    { minX: 9, maxX: 12, minZ: 116.5, maxZ: 117.5, top: 7 },
    { minX: 5, maxX: 9, minZ: 116.5, maxZ: 117.5, top: 7, base: 3.3 },
  ];
  const ROOF = { minX: -13, maxX: 13, minZ: 90, maxZ: 140, top: 7.5, base: 7 };
  const ZIPS: Array<[[number, number, number], [number, number, number]]> = [
    [[-10, 0.3, 95.4], [-10, 6.9, 95.4]],
    [[-4, 6.9, 99.4], [5, 3.4, 113]],
  ];
  const up = new Sim([DECK, ...EXIT, ROOF], ZIPS);
  up.p.pos.set(-10, 0, 94.2);
  up.p.yaw = 180;
  up.frame();
  up.in.tap("interact");
  up.frame();
  check("the vertical zip is in reach from the door side", up.p.stance === "zip");
  const tUp = up.until(() => up.p.onGround, 4);
  check("it rides you up and puts you on the deck", up.p.onGround && Math.abs(up.p.pos.y - 4.5) < 0.01, `y ${up.p.pos.y.toFixed(2)} z ${up.p.pos.z.toFixed(2)} after ${tUp.toFixed(2)} s`);

  const ladder = new Sim([DECK, ROOF]);
  ladder.p.pos.set(-4.5, 0, 94.5);
  ladder.p.yaw = 180;
  ladder.in.hold("forward");
  ladder.run(0.3);
  ladder.in.tap("jump");
  const tLadder = ladder.until(() => ladder.p.onGround && ladder.p.pos.y > 4, 4) + 0.3;
  check("the ladder beside it: climb and mantle onto the 4.5 m deck", ladder.p.pos.y > 4.4, `feet ${ladder.p.pos.y.toFixed(2)} m`);
  check("and the zip is the faster way up", tUp < tLadder, `zip ${tUp.toFixed(2)} s, ladder ${tLadder.toFixed(2)} s`);

  const across = new Sim([DECK, ...EXIT, ROOF], ZIPS);
  across.p.pos.set(-4.3, 4.5, 98.7);
  across.p.yaw = yawFacing(9, 13.6);
  across.p.pos.y = 4.5;
  across.frame();
  across.in.tap("interact");
  across.frame();
  check("on the deck, E takes the long zip", across.p.stance === "zip");
  across.until(() => across.p.stance !== "zip", 4);
  across.until(() => across.p.onGround, 3);
  check("riding it out lands you in line with the exit door", across.p.pos.x > 5.4 && across.p.pos.x < 8.6 && across.p.pos.z > 113, `landed x ${across.p.pos.x.toFixed(2)} z ${across.p.pos.z.toFixed(2)}`);
  across.p.yaw = 180;
  across.in.hold("forward");
  across.until(() => across.p.pos.z > 118.5, 2);
  check("and W carries you straight through it", across.p.pos.z > 118.5, `z ${across.p.pos.z.toFixed(2)}`);

  // The 1v1 arena (arena.ts): a 1.4 m box against the end of a 3 m lane wall.
  // Jump and mantle onto the box, then mantle from the box onto the wall top.
  const LANE_WALL = { minX: -6.5, maxX: -5.5, minZ: 8, maxZ: 25, top: 3 };
  const MID_BOX = { minX: -5.4, maxX: -3.8, minZ: 8.7, maxZ: 10.3, top: 1.4 };
  const onBox = new Sim([LANE_WALL, MID_BOX]);
  onBox.p.pos.set(-1.5, 0, 9.5);
  onBox.p.yaw = yawFacing(-1, 0);
  onBox.in.hold("forward");
  onBox.run(0.25);
  onBox.in.tap("jump");
  onBox.until(() => onBox.p.stance === "stand" && onBox.p.pos.y > 1.3, 3);
  check("arena: jump and mantle onto the 1.4 m middle box", Math.abs(onBox.p.pos.y - 1.4) < 0.01, `feet ${onBox.p.pos.y.toFixed(2)} m`);
  onBox.run(0.3);
  onBox.in.tap("jump");
  // wait for standing: a mantle in progress also reads as on the ground
  onBox.until(() => onBox.p.stance === "stand" && onBox.p.pos.y > 2.9, 3);
  check("and from the box onto the top of the 3 m lane wall", Math.abs(onBox.p.pos.y - 3) < 0.01, `feet ${onBox.p.pos.y.toFixed(2)} m`);
  const container = new Sim([{ minX: 1, maxX: 4, minZ: -3, maxZ: 3, top: 2.4 }]);
  container.p.pos.set(-2, 0, 0);
  container.p.yaw = yawFacing(1, 0);
  container.in.hold("forward");
  container.run(0.3);
  container.in.tap("jump");
  container.until(() => container.p.onGround && container.p.pos.y > 2.3, 3);
  check("arena: the 2.4 m side-lane containers can be climbed", Math.abs(container.p.pos.y - 2.4) < 0.01, `feet ${container.p.pos.y.toFixed(2)} m`);

  // the range's side platforms: a 4.6 m column with a ladder
  const plat = new Sim([
    { minX: -31, maxX: -17, minZ: -51, maxZ: -29, top: 4.6, base: 4 },
    { minX: -17, maxX: -16.5, minZ: -47.2, maxZ: -44.8, top: 4.6 },
  ]);
  plat.p.pos.set(-14.5, 0, -46);
  plat.p.yaw = yawFacing(-1, 0);
  plat.in.hold("forward");
  plat.run(0.3);
  plat.in.tap("jump");
  plat.until(() => plat.p.onGround && plat.p.pos.y > 4, 4);
  check("a range platform ladder: climb and mantle onto 4.6 m", plat.p.pos.y > 4.55, `feet ${plat.p.pos.y.toFixed(2)} m`);
}

// ---------------------------------------------------- the advanced course
// Built from the real layout (courses/advanced.ts) through the collision-only
// builder, so these run against the exact geometry the game draws. Each gate
// is driven both ways: the technique makes it, the plain move does not.
console.log("\nThe advanced course: every gate needs its technique");
{
  const { solids, zips } = courseColliders(ADVANCED_COURSE);
  const world = () => new Sim(solids as Array<{ minX: number; maxX: number; minZ: number; maxZ: number; top: number; base?: number }>, zips.map(([a, b]) => [[a.x, a.y, a.z], [b.x, b.y, b.z]] as [[number, number, number], [number, number, number]]));
  const inside = (s: Sim, hz: { minZ: number; maxZ: number; fallY: number }) => s.p.pos.z > hz.minZ && s.p.pos.z < hz.maxZ && s.p.pos.y < hz.fallY;

  // VENTS: sprint, slide under the first (right), stand, sprint, slide under the second (left)
  const v = world();
  v.p.pos.set(-8, 0, 21);
  v.p.yaw = 180;
  sprintTo(v, 1.0);
  v.in.hold("crouch");
  v.until(() => v.p.pos.z > 28.5, 3);
  check("vents: the first crawl space, sliding from a sprint", v.p.pos.z > 28.5, `z ${v.p.pos.z.toFixed(1)}`);
  v.in.release("crouch");
  // across to the left crawl (facing +z, +x is left), then sprint at it
  v.p.yaw = yawFacing(1, 0);
  v.in.tap("sprint");
  v.until(() => v.p.pos.x > 7.5, 3);
  v.p.yaw = 180;
  v.in.tap("sprint");
  v.until(() => v.p.pos.z > 32.2, 3);
  v.in.hold("crouch");
  v.until(() => v.p.pos.z > 35.5, 3);
  check("vents: and the second", v.p.pos.z > 35.5, `x ${v.p.pos.x.toFixed(1)} z ${v.p.pos.z.toFixed(1)}`);

  // GLIDE: mantle the 2.5 m ledge, superglide off it over the 7.2 m gap
  const HZ_GLIDE = ADVANCED_COURSE.hazards[0];
  const glide = (superglide: boolean) => {
    const s = world();
    s.p.pos.set(0, 0, 41);
    s.p.yaw = 180;
    sprintTo(s, 0.5);
    s.in.tap("jump");
    s.until(() => s.p.stance === "mantle", 3);
    const mt = (s.p as unknown as { mantle: { started: number; duration: number } | null }).mantle;
    if (!mt) return s;
    const endAt = mt.started + mt.duration;
    if (superglide) {
      s.until(() => s.t >= endAt - 0.1, 2);
      s.in.tap("jump");
      s.frame();
      s.in.tap("crouch");
      s.frame();
    } else {
      // a plain sprint jump off the far edge
      s.until(() => s.p.stance === "stand", 2);
      s.until(() => s.p.pos.z > GLIDE.ledgeZ1 - 0.6, 2);
      s.in.tap("jump");
      s.frame();
    }
    s.until(() => (s.p.onGround && s.p.pos.z > GLIDE.ledgeZ1) || inside(s, HZ_GLIDE), 4);
    return s;
  };
  const sg = glide(true);
  check("glide: a superglide off the ledge clears the 7 m gap onto the pad", sg.p.onGround && sg.p.pos.z >= GLIDE.gapEnd && sg.p.pos.y > GLIDE.landH - 0.05 && !inside(sg, HZ_GLIDE), `landed z ${sg.p.pos.z.toFixed(2)} y ${sg.p.pos.y.toFixed(2)}`);
  const pj = glide(false);
  check("glide: a plain jump off the ledge lands in the red", inside(pj, HZ_GLIDE), `z ${pj.p.pos.z.toFixed(2)} y ${pj.p.pos.y.toFixed(2)}`);

  // STRAFE: slide jump off the platform, lurch right, land on the first pad
  const HZ_STRAFE = ADVANCED_COURSE.hazards[1];
  const pad = STRAFE.pads[0];
  const onPad = (s: Sim) => s.p.onGround && s.p.pos.y > STRAFE.h - 0.05 && s.p.pos.x > pad.minX && s.p.pos.x < pad.maxX && s.p.pos.z > pad.minZ && s.p.pos.z < pad.maxZ;
  const strafe = (lurch: boolean) => {
    const s = world();
    s.p.pos.set(0, STRAFE.h, STRAFE.a.minZ + 0.6);
    s.p.yaw = 180;
    sprintTo(s, 0.35);
    s.in.hold("crouch");
    s.until(() => s.p.pos.z > STRAFE.a.maxZ - 0.55, 2);
    s.in.release("crouch");
    s.in.tap("jump");
    s.frame();
    if (lurch) {
      s.run(0.1);
      s.in.release("forward");
      s.in.hold("right");
    }
    s.until(() => onPad(s) || inside(s, HZ_STRAFE) || (s.p.onGround && s.p.pos.z > STRAFE.a.maxZ), 3);
    return s;
  };
  const lu = strafe(true);
  check("strafe: a slide jump with a lurch to the right lands on the first pad", onPad(lu), `x ${lu.p.pos.x.toFixed(2)} z ${lu.p.pos.z.toFixed(2)} y ${lu.p.pos.y.toFixed(2)}`);
  const st = strafe(false);
  check("strafe: a straight slide jump lands in the red", inside(st, HZ_STRAFE), `x ${st.p.pos.x.toFixed(2)} z ${st.p.pos.z.toFixed(2)} y ${st.p.pos.y.toFixed(2)}`);

  // SUPERJUMP: interact at the zip's foot, jump, jump, turn to the platform
  const P = SUPERJUMP.plat;
  const onPlat = (s: Sim) => s.p.onGround && s.p.pos.y > P.top - 0.05 && s.p.pos.x > P.minX && s.p.pos.x < P.maxX && s.p.pos.z > P.minZ - 0.5 && s.p.pos.z < SUPERJUMP.walk.maxZ;
  const sj = world();
  sj.p.pos.set(SUPERJUMP.zip.a.x, 0, SUPERJUMP.zip.a.z - 0.7);
  sj.p.yaw = 180; // face +z, the rope ahead
  sj.frame();
  sj.in.tap("interact");
  sj.frame();
  sj.in.tap("jump");
  sj.frame();
  sj.in.tap("jump");
  sj.frame();
  sj.in.hold("forward");
  sj.until(() => onPlat(sj) || sj.p.onGround, 5);
  check("superjump: interact, jump, jump off the rope reaches the floating platform", onPlat(sj), `x ${sj.p.pos.x.toFixed(2)} y ${sj.p.pos.y.toFixed(2)} z ${sj.p.pos.z.toFixed(2)} ${sj.p.stance}`);
  const nj = world();
  nj.p.pos.set(-8, 0, P.minZ - 2.5);
  nj.p.yaw = 180;
  sprintTo(nj, 0.4);
  nj.in.tap("jump");
  nj.until(() => onPlat(nj) || (nj.p.onGround && nj.p.pos.z > P.minZ), 4);
  check("superjump: a plain sprint jump at it does not (it floats above head height)", !onPlat(nj), `y ${nj.p.pos.y.toFixed(2)} z ${nj.p.pos.z.toFixed(2)}`);

  // DROP: off the 5 m deck, no stun; the vent after it is passable crouched
  const dr = world();
  dr.p.pos.set(0, DROP.deck.top, DROP.deck.maxZ - 1.5);
  dr.p.yaw = 180;
  sprintTo(dr, 0.3);
  dr.in.hold("crouch");
  dr.until(() => dr.p.onGround && dr.p.pos.y < 0.1, 4);
  check("drop: a sprint off the 5 m deck lands without a fall stun", !dr.p.stunned && dr.p.pos.y < 0.01, `stunned ${dr.p.stunned} y ${dr.p.pos.y.toFixed(2)}`);
  dr.p.yaw = 180;
  dr.until(() => dr.p.pos.z > DROP.ventZ + 1.5, 4);
  check("drop: and the vent after it is passable crouched", dr.p.pos.z > DROP.ventZ + 1.5, `z ${dr.p.pos.z.toFixed(1)}`);

  // ZIP: from the deck, the long zip carries you across the room
  const zr = world();
  zr.p.pos.set(ZIP.across.a.x, ZIP.deck.top, ZIP.across.a.z - 0.8);
  zr.p.yaw = 180;
  zr.frame();
  zr.in.tap("interact");
  zr.frame();
  check("zip: the long zip is in reach from the deck", zr.p.stance === "zip", zr.p.stance);
  zr.until(() => zr.p.stance !== "zip", 8);
  zr.until(() => zr.p.onGround, 3);
  check("zip: riding it out lands you by the exit door", zr.p.pos.z > 158, `z ${zr.p.pos.z.toFixed(1)} x ${zr.p.pos.x.toFixed(1)}`);
}

// ------------------------------------------------------------------ JOLT
console.log("\nJOLT, the dash ability (src/config/abilities.json: 10 m over 0.14 s, the owner's distance, out at 360 hu/s)");
{
  const JD = 10;
  const JT = 0.14;
  const EXIT = 360 * HU;
  // standing still on open ground, facing -z, no keys: forward
  const a = new Sim();
  a.p.pos.set(0, 0, 0);
  a.p.yaw = 0;
  a.frame();
  const dir = a.p.moveDir(a.in);
  check("no keys held: JOLT goes forward", Math.abs(dir.x) < 1e-6 && dir.z < -0.99, `(${dir.x.toFixed(2)}, ${dir.z.toFixed(2)})`);
  check("it starts", a.p.jolt(dir.x, dir.z, JD, JT, EXIT));
  const z0 = a.p.pos.z;
  a.run(JT + DT); // 0.14 s is 8.4 frames: the ninth ends it
  near("covers 10 m in its 0.14 s, m", z0 - a.p.pos.z, JD, 0.3);
  check("and is over by then", !a.p.jolting);
  near("leaves at 360 hu/s (faster than a sprint)", a.speedHu, 360, 1);
  // what it is worth: against a sprint from a standstill, a JOLT is well ahead after a second
  const js = new Sim();
  js.p.pos.set(0, 0, 0);
  js.frame();
  js.p.jolt(0, -1, JD, JT, EXIT);
  js.in.hold("forward");
  js.in.tap("sprint");
  js.run(1);
  const sp = new Sim();
  sp.p.pos.set(0, 0, 0);
  sp.in.hold("forward");
  sp.in.tap("sprint");
  sp.run(1);
  check("a JOLT then a sprint is 8 m+ ahead of a sprint after 1 s", -js.p.pos.z - -sp.p.pos.z > 8, `${(-js.p.pos.z - -sp.p.pos.z).toFixed(1)} m`);
  // a second one during the first is refused (the cooldown is the ability's; the movement refuses overlap)
  const b = new Sim();
  b.p.pos.set(0, 0, 0);
  b.frame();
  b.p.jolt(0, -1, JD, JT, EXIT);
  check("a JOLT during a JOLT is refused", !b.p.jolt(1, 0, JD, JT, EXIT));
  // strafing right: goes right
  const r = new Sim();
  r.p.pos.set(0, 0, 0);
  r.p.yaw = 0;
  r.in.hold("right");
  r.frame();
  const rd = r.p.moveDir(r.in);
  check("holding D: JOLT goes right (+x at yaw 0)", rd.x > 0.99, `(${rd.x.toFixed(2)}, ${rd.z.toFixed(2)})`);
  // a wall 4 m ahead stops it
  const w = new Sim([{ minX: -5, maxX: 5, minZ: -5, maxZ: -4, top: 4 }]);
  w.p.pos.set(0, 0, 0);
  w.p.yaw = 0;
  w.frame();
  w.p.jolt(0, -1, JD, JT, EXIT);
  w.run(JT + 0.05);
  check("a wall 4 m ahead stops it at the wall", w.p.pos.z > -4 - 0.01 && w.p.pos.z < -3.4, `z ${w.p.pos.z.toFixed(2)}`);
  // in the air it stays level for its duration
  const air = new Sim();
  air.p.pos.set(0, 0, 0);
  air.frame();
  air.in.tap("jump");
  air.run(0.2);
  const y0 = air.p.pos.y;
  check("mid-jump it starts", air.p.jolt(0, -1, JD, JT, EXIT));
  let worst = 0;
  air.run(JT - 0.01, () => (worst = Math.max(worst, Math.abs(air.p.pos.y - y0))));
  check("and holds you level through it", worst < 0.01, `moved ${worst.toFixed(3)} m vertically`);
  // not on a zipline, a mantle, a climb or the drop
  const dz = new Sim();
  dz.p.beginDrop(0, 50, 0, 0);
  check("not in the drop", !dz.p.jolt(0, -1, JD, JT, EXIT));
  // the sprint numbers are untouched
  const s = new Sim();
  s.in.hold("forward");
  s.in.tap("sprint");
  s.run(3);
  near("sprint is still 260 hu/s", s.speedHu, 260, 0.05);
}

// ------------------------------------------------------------------ healing pace
console.log("\nHealing: 40% slower, no sprint (Season 30, docs/RESEARCH_PHASE_11.md)");
{
  const h = new Sim();
  h.p.healSlow = 0.6;
  h.in.hold("forward");
  h.in.tap("sprint");
  h.run(2);
  near("healing: walk at 60% (173.5 x 0.6), hu/s", h.speedHu, 104.1, 0.1);
  check("and no sprint", !h.p.sprinting);
}

// ------------------------------------------------------------------ launch pads, down
console.log("\nA launch pad's throw, and the crawl when down (src/game/brplay.ts)");
{
  // a pad throws you along the road (17 m/s) and up (12 m/s): off the ground, far down the road, and down again
  const l = new Sim();
  l.p.pos.set(0, 0, 0);
  l.frame();
  l.p.impulse(0, squadCfg.pad.up, -squadCfg.pad.speed);
  check("the pad takes you off the ground", !l.p.onGround);
  let top = 0;
  let t = 0;
  while (t < 6 && (t < 0.2 || !l.p.onGround)) {
    l.run(1 / 60, () => (top = Math.max(top, l.p.pos.y)));
    t += 1 / 60;
  }
  check("and lands you again", l.p.onGround, `after ${t.toFixed(2)} s`);
  check("30 m or more down the road", -l.p.pos.z >= 30, `${(-l.p.pos.z).toFixed(1)} m`);
  check("over the walls on the way (6 m or more up)", top >= 6, `${top.toFixed(1)} m`);
  // down: crouched, at 65% of the crouch walk, no sprint, no jump
  const c = new Sim();
  const plain = new Sim();
  for (const s of [c, plain]) {
    s.in.hold("forward");
    s.in.hold("crouch");
  }
  c.p.healSlow = squadCfg.crawl;
  c.run(2);
  plain.run(2);
  near("down: 65% of the crouch walk", c.speedHu / plain.speedHu, 0.65, 0.01);
}

console.log(fails === 0 ? "\nMOVESIM PASS" : `\nMOVESIM FAIL (${fails})`);
export const movesimFails = fails;
if (process.argv[1]?.endsWith("movesim.ts")) process.exit(fails === 0 ? 0 : 1);
