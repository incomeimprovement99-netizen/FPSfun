// THE RUN, proven (Milestone 636, src/game/courses/basic.ts): the real controller with SpeedKills' movement, armed as the
// run has you (its two pistols), driven frame by frame through the course's own colliders (course.ts courseColliders, the
// geometry the game draws). Each room is passed with the move its tip names and not with the one before it:
//   the low wall with a jump; the vent's slot with a slide, not standing; the wall with a climb, and no jump at any
//   timing over it when it takes no climb; the gap with a double jump, not one jump; the wall pit with a wall run along
//   the lit wall, not a double jump at any timing (a slide into it too); the superglide gap with the real input from every
//   approach and nothing else, and its pit's far side with a double jump, the slow way; the high ground with a double
//   jump, not one, its three hidden from the floor and in sight from the top. The "not" cases run from a full sprint and
//   the "with" cases from the door at rest, the hard end of each. The walkers stay in their room and off the pillars,
//   every other dummy is in sight from its room's way through, no climb gets over a wall, and the whole route is run end
//   to end, door to door, for the time the S rank is set from (therun.json ranks).
//
// It needs the game named: GAME=speedkills npx tsx tools/checks/sk-run.ts (verify runs it that way).
import * as THREE from "three";
import { Player, type MoveInput } from "../../src/game/player";
import type { Action } from "../../src/game/input";
import { RANGE_SOLIDS } from "../../src/game/range";
import { ZIPLINES } from "../../src/game/traversal";
import { MOVE } from "../../src/game/movement";
import { GAME } from "../../src/game/game";
import { solidHit } from "../../src/game/projectile";
import { courseColliders, roomPars } from "../../src/game/course";
import { BASIC_COURSE, ROOMS, OUT, BACK, OX, BX, DECK, FALL_Y, TURN_Z, BREACH, VENT, CLIMB, GAP, WALLRUN, GLIDE, CROSS, HIGH, FINAL, FINISH_Z, DIVIDERS, RUN_WALL_X, type PitRoom } from "../../src/game/courses/basic";
import type { Ledge } from "../../src/game/courses/tutorial";
import cfg from "../../src/config/therun.json";

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
const { solids } = courseColliders(BASIC_COURSE);
function load(slickAlso?: (s: (typeof solids)[number]) => boolean): void {
  RANGE_SOLIDS.length = 0;
  for (const s of solids) RANGE_SOLIDS.push({ ...s, slick: s.slick || (slickAlso?.(s) ?? false) });
  ZIPLINES.length = 0;
}
load();

/** facing +z (out) and -z (back): yaw 0 runs -z */
const OUTWARD = 180;
const BACKWARD = 0;
const mid = (d: [number, number]) => (d[0] + d[1]) / 2;

function player(x: number, y: number, z: number, yaw: number, armed = true): Player {
  const p = new Player({ minX: -500, maxX: 500, minZ: -500, maxZ: 500 });
  p.extraMoves = true;
  p.autoClimb = true;
  p.sprintMode = "always";
  p.holsterBoost = armed ? 1 : MOVE.holsterBoost;
  p.teleport(x, y, z, yaw);
  return p;
}
type Mantle = { started: number; duration: number } | null;
const mantleOf = (p: Player): Mantle => (p as unknown as { mantle: Mantle }).mantle;

/** on a ledge's top, or past it the way the room runs */
function onOrPast(p: Player, l: Ledge): boolean {
  const out = l.z1 > l.z0;
  const past = out ? p.pos.z > l.z1 : p.pos.z < l.z1;
  const over = out ? p.pos.z > l.z0 - 0.2 : p.pos.z < l.z0 + 0.2;
  return p.onGround && (past || (over && p.pos.y > l.top - 0.1));
}

/**
 * A run at a take-off line `takeoff` from `z` (a door's inside), sprinting `dir`: from rest, or `fast` at a full sprint
 * already; a slide `slideAt` m before the line (held to the jump), a jump `jumpAt` m before it (null: none), maybe a
 * double jump `dj` s after. True once `done`; false on falling under the pit's fall line, or after `seconds`.
 */
function attempt(o: {
  x: number;
  z: number;
  dir: 1 | -1;
  jumpAt: number | null;
  takeoff: number;
  slideAt?: number;
  dj?: number;
  fast?: boolean;
  done: (p: Player) => boolean;
  pit?: [number, number, number];
  seconds?: number;
  onWall?: { seen: boolean };
  crouchUntil?: number;
}): boolean {
  const p = player(o.x, 0, o.z, o.dir === 1 ? OUTWARD : BACKWARD);
  if (o.fast) p.vel.set(0, 0, o.dir * MOVE.sprintSpeed);
  const s = new Script();
  s.down.add("forward");
  let t = 1000;
  let clock = 0;
  let jumped = -1;
  let slid = false;
  for (let i = 0; i < (o.seconds ?? 6) / DT; i++) {
    t += DT;
    clock += DT;
    const to = (o.takeoff - p.pos.z) * o.dir;
    if (o.slideAt !== undefined && !slid && to < o.slideAt) {
      s.down.add("crouch");
      s.taps.add("crouch");
      slid = true;
    }
    if (o.crouchUntil !== undefined && slid && (p.pos.z - o.crouchUntil) * o.dir > 0) s.down.delete("crouch");
    if (o.jumpAt !== null && jumped < 0 && p.onGround && to < o.jumpAt) {
      s.down.delete("crouch");
      s.taps.add("jump");
      jumped = clock;
    }
    if (o.dj !== undefined && jumped > 0 && Math.abs(clock - jumped - o.dj) < DT / 2) s.taps.add("jump");
    p.update(DT, t, s, 0, 1, false);
    s.taps.clear();
    if (o.onWall && p.onWall) o.onWall.seen = true;
    if (o.pit) {
      const [lo, hi, fallY] = o.pit;
      if (p.pos.z > lo && p.pos.z < hi && p.pos.y < fallY) return false;
    }
    if (o.done(p)) return true;
  }
  return false;
}
const pitOf = (r: PitRoom): [number, number, number] => [r.a1, r.b0, FALL_Y];

console.log(`\nTHE RUN, proven on its own geometry (game: ${GAME})`);
check("this runs with SpeedKills' movement", GAME === "speedkills");
check(
  "it fits: out to the turn, round, and back down to the start area's wall, the finish line inside the last door",
  WALLRUN.b1 < TURN_Z && FINAL.exitZ === cfg.start && FINISH_Z > FINAL.exitZ && FINISH_Z < FINAL.entryZ && GLIDE.b1 > CROSS.entryZ,
  `the gap ${cfg.gap.pit} m, the wall pit ${cfg.wallRun.pit} m, the superglide gap ${(GLIDE.edge - GLIDE.b0).toFixed(2)} m, the run ${(TURN_Z - cfg.start) * 2} m of bays`,
);

const JUMPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5];
const DJS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

// ---- the walls: a climb up any of them stops short of the top (a climb reaches 8 m)
{
  const p = player(OX, 0, TURN_Z + 8, OUTWARD);
  const s = new Script();
  s.down.add("forward");
  let t = 1000;
  let top = 0;
  for (let i = 0; i < 8 / DT; i++) {
    t += DT;
    p.update(DT, t, s, 0, 1, false);
    top = Math.max(top, p.pos.y);
  }
  check(`no climb gets over a wall: up the far wall the feet top out at ${top.toFixed(2)} m, the walls ${cfg.wallH} m`, top > 3 && top + MOVE.standHeight < cfg.wallH - 1);
}

// ---- 1. breach: the low wall with a jump from a sprint
{
  const l = BREACH.wall;
  const over = (p: Player) => p.onGround && p.pos.z > l.z1 + 0.3;
  const clears = [1, 1.5, 2].filter((j) => attempt({ x: OX, z: BREACH.entryZ + 1.5, dir: 1, jumpAt: j, takeoff: l.z0, done: over, seconds: 4 }));
  const fast = [3, 4, 5, 6].filter((j) => attempt({ x: OX, z: BREACH.entryZ + 1.5, dir: 1, jumpAt: j, takeoff: l.z0, fast: true, done: over, seconds: 4 }));
  check(`breach (a ${l.top} m wall): a jump 1 to 2 m before it clears it from the door, and 3 to 6 m before it at a full sprint`, clears.length === 3 && fast.length === 4, `${clears.length} of 3, ${fast.length} of 4`);
}

// ---- 2. the vent: a slide takes you through its slot; standing, you stop at it
{
  const x = mid(VENT.slot);
  const through = (p: Player) => p.pos.z > VENT.z1 + 0.5;
  const slides = [2, 3, 4].map((at) => attempt({ x, z: VENT.entryZ + 1.5, dir: 1, jumpAt: null, takeoff: VENT.z0, slideAt: at, crouchUntil: VENT.z1 + 0.3, done: through, seconds: 4 }));
  const stand = attempt({ x, z: VENT.entryZ + 1.5, dir: 1, jumpAt: null, takeoff: VENT.z0, done: through, seconds: 4 });
  const jumpIn = attempt({ x, z: VENT.entryZ + 1.5, dir: 1, jumpAt: 1, takeoff: VENT.z0, done: through, seconds: 4 });
  check(`vent (a ${VENT.h} m slot, ${VENT.z1 - VENT.z0} m deep): a slide 2 to 4 m before it takes you through; running in standing, or jumping at it, does not`, slides.every(Boolean) && !stand && !jumpIn, `slides ${slides.filter(Boolean).length} of 3`);
}

// ---- 3. the climb: up the wall holding forward; and with the wall taking no climb, no jump at any timing tops it
{
  const c = CLIMB.wall;
  const over = (p: Player) => p.pos.z > c.z1 + 0.5;
  const climbs = [null, 1, 2].filter((j) => attempt({ x: OX, z: CLIMB.entryZ + 1.5, dir: 1, jumpAt: j, takeoff: c.z0, done: over, seconds: 6 }));
  check(`climb (a ${c.top} m wall): running at it holding forward climbs it and over, with a jump or without`, climbs.length === 3, `${climbs.length} of 3`);
  load((s) => s.minZ === c.z0 && s.maxZ === c.z1 && s.top === c.top);
  const jumps = JUMPS.flatMap((j) => [undefined, ...DJS].map((d) => attempt({ x: OX, z: CLIMB.entryZ + 1.5, dir: 1, jumpAt: j, takeoff: c.z0, dj: d, fast: true, done: over, seconds: 4 }))).filter(Boolean).length;
  load();
  check("and with that wall taking no climb, no jump or double jump at any timing gets over it, from a full sprint", jumps === 0, `${jumps} of ${JUMPS.length * (DJS.length + 1)} got over`);
  // the ramp: a slide down it from the top leaves faster than a sprint
  const p = player(OX, c.top, c.z1 - 0.2, OUTWARD);
  const s = new Script();
  s.down.add("forward");
  s.down.add("crouch");
  s.taps.add("crouch");
  let t = 1000;
  let foot = 0;
  for (let i = 0; i < 3 / DT; i++) {
    t += DT;
    p.update(DT, t, s, 0, 1, false);
    s.taps.clear();
    if (p.pos.z > CLIMB.rampEnd && foot === 0) foot = Math.hypot(p.vel.x, p.vel.z);
  }
  check(`its ramp: a slide down from the top leaves it faster than a sprint`, foot > MOVE.sprintSpeed, `${foot.toFixed(2)} m/s at its foot, the sprint ${MOVE.sprintSpeed.toFixed(2)}`);
}

// ---- 4. the gap: never one jump, from a full sprint; the double jump from at least half the timings, from the door
{
  const l: Ledge = { z0: GAP.b0, z1: GAP.b1, top: DECK };
  const x = mid(DIVIDERS[3].door);
  const go = (o: { jumpAt: number; dj?: number; slideAt?: number; fast?: boolean }) =>
    attempt({ x, z: GAP.entryZ + 1.5, dir: 1, takeoff: GAP.a1, ...o, done: (p) => onOrPast(p, l), pit: pitOf(GAP), seconds: 5 });
  const one = JUMPS.filter((j) => go({ jumpAt: j, fast: true })).length;
  const two = JUMPS.flatMap((j) => DJS.map((d) => go({ jumpAt: j, dj: d }))).filter(Boolean).length;
  check(`gap (${cfg.gap.pit} m): one jump crosses from no take-off at a full sprint; the double jump from at least half of ${JUMPS.length * DJS.length} timings from the door`, one === 0 && two * 2 >= JUMPS.length * DJS.length, `one jump ${one}, the double jump ${two}`);
  const ran = [OUT.x0 + cfg.slick + MOVE.radius + 0.05, OUT.x1 - cfg.slick - MOVE.radius - 0.05].map((wx) => {
    const w = { seen: false };
    attempt({ x: wx, z: GAP.entryZ + 1.5, dir: 1, jumpAt: 0.8, takeoff: GAP.a1, done: () => false, pit: pitOf(GAP), seconds: 3, onWall: w });
    return w.seen;
  });
  check("its walls are slick: a jump off the deck beside either takes no wall run", ran.every((r) => !r));
}

// ---- 5. the wall run: along the lit wall it lands from every take-off; no double jump at any timing crosses, a slide into one included
{
  const past = (p: Player) => p.pos.z > WALLRUN.b0 && p.onGround;
  const byWall = RUN_WALL_X - MOVE.radius - 0.05;
  const runs = [0.5, 0.8, 1.2].map((j) => {
    const wall = { seen: false };
    return attempt({ x: byWall, z: WALLRUN.entryZ + 1.5, dir: 1, jumpAt: j, takeoff: WALLRUN.a1, done: past, pit: pitOf(WALLRUN), seconds: 8, onWall: wall }) && wall.seen;
  });
  const djs = JUMPS.flatMap((j) => DJS.map((d) => attempt({ x: OX, z: WALLRUN.entryZ + 1.5, dir: 1, jumpAt: j, takeoff: WALLRUN.a1, dj: d, fast: true, done: past, pit: pitOf(WALLRUN), seconds: 7 }))).filter(Boolean).length;
  const slideDjs = JUMPS.flatMap((j) => DJS.map((d) => attempt({ x: OX, z: WALLRUN.entryZ + 1.5, dir: 1, jumpAt: j, slideAt: j + 2, takeoff: WALLRUN.a1, dj: d, fast: true, done: past, pit: pitOf(WALLRUN), seconds: 7 }))).filter(Boolean).length;
  check(`wall run (a ${cfg.wallRun.pit} m pit): a wall run along the lit wall lands past it from every take-off tried, from the door`, runs.every(Boolean), `${runs.filter(Boolean).length} of 3`);
  check("and no double jump crosses at any timing from a full sprint, nor a slide into one", djs === 0 && slideDjs === 0, `${djs} double jumps, ${slideDjs} slides into one`);
}

// ---- 6. the superglide: the real input from every approach clears the gap; nothing else lands on the deck without first
// dropping into the pit; and out of the pit, a double jump up its far side
{
  const G = GLIDE;
  const lane = BX;
  const glide = (o: { jumpAt: number; dj1?: number; sg: boolean; hop?: boolean; dj2?: number }): { landed: boolean; glided: boolean } => {
    const p = player(lane, 0, G.entryZ - 1.5, BACKWARD);
    const s = new Script();
    s.down.add("forward");
    let t = 1000;
    let clock = 0;
    let jumped = -1;
    let mantled = false;
    let sgFrame = -1;
    let hopped = false;
    let leftTop = -1;
    for (let i = 0; i < 7 / DT; i++) {
      t += DT;
      clock += DT;
      if (jumped < 0 && p.pos.z < G.face + o.jumpAt) {
        s.taps.add("jump");
        jumped = clock;
      }
      const m = mantleOf(p);
      if (m) mantled = true;
      if (o.dj1 !== undefined && jumped > 0 && !mantled && Math.abs(clock - jumped - o.dj1) < DT / 2) s.taps.add("jump");
      if (o.sg && m) {
        const left = m.started + m.duration - t;
        if (sgFrame < 0 && left <= MOVE.superglideWindow * 0.5 + DT) {
          s.taps.add("jump");
          sgFrame = i;
        } else if (sgFrame >= 0 && i === sgFrame + 1) s.taps.add("crouch");
      }
      if (o.hop && !hopped && !m && p.onGround && p.pos.y > G.h - 0.05) {
        s.taps.add("jump");
        hopped = true;
      }
      if (leftTop < 0 && p.pos.z < G.edge) leftTop = clock;
      if (o.dj2 !== undefined && leftTop > 0 && Math.abs(clock - leftTop - o.dj2) < DT / 2) s.taps.add("jump");
      p.update(DT, t, s, 0, 1, false);
      s.taps.clear();
      // in the pit: under the ledge's top by the fall line, between its edge and the deck
      if (p.pos.z < G.edge && p.pos.z > G.b0 && p.pos.y < G.h - cfg.fallBelow) return { landed: false, glided: p.superglidedAt > 0 };
      if (p.onGround && p.pos.z < G.b0) return { landed: true, glided: p.superglidedAt > 0 };
      if (clock > 4 && p.onGround && p.pos.z > G.face) break;
    }
    return { landed: false, glided: p.superglidedAt > 0 };
  };
  const JS = [1, 1.5, 2, 2.5, 3, 3.5, 4];
  const sg = JS.flatMap((jumpAt) => [undefined, 0.2, 0.4].map((dj1) => glide({ jumpAt, dj1, sg: true })));
  check(
    `superglide (${(G.edge - G.b0).toFixed(2)} m off a ${G.h} m ledge): the superglide's own input (jump, crouch a frame later) from every approach lands past the gap`,
    sg.every((r) => r.glided && r.landed),
    `${sg.filter((r) => r.landed).length} of ${sg.length}`,
  );
  let any = false;
  for (const jumpAt of JS) for (const dj1 of [undefined, 0.1, 0.3, 0.5]) for (const hop of [false, true]) for (const dj2 of [undefined, 0.2, 0.4, 0.6, 0.8, 1.0]) if (glide({ jumpAt, dj1, sg: false, hop, dj2 }).landed) any = true;
  check("and without a superglide nothing gets across before dropping into the pit: every approach, a jump and double jump off the top at every timing", !any);
  // the slow way: from the pit's floor, a run and a double jump up the deck's slick face
  const outs = [1, 1.5, 2].filter((j) => attempt({ x: lane, z: G.edge - 1, dir: -1, jumpAt: j, takeoff: G.b0, dj: 0.3, done: (p) => p.onGround && p.pos.z < G.b0 && p.pos.y > G.h - 0.1, seconds: 4 }));
  check("the slow way out: from the pit's floor a double jump mantles onto the landing deck", outs.length === 3, `${outs.length} of 3`);
}

// ---- 7. the walkers: in the room, clear of the walls and of every pillar
{
  const ok = cfg.crossfire.walkers.every(([x, z, dx]) => {
    const [a, b] = [Math.min(x, x + dx), Math.max(x, x + dx)];
    const inside = a > BACK.x0 + 0.6 && b < BACK.x1 - 0.6 && z < CROSS.entryZ - 2 && z > CROSS.exitZ + 2;
    const clear = cfg.crossfire.pillars.every(([, pz]) => Math.abs(pz - z) > 1.5);
    return inside && clear;
  });
  check(`crossfire: ${cfg.crossfire.walkers.length} walkers, each line inside the room and 1.5 m or more from every pillar's`, ok);
}

// ---- 8. high ground: the platform with a double jump, not one; the three hidden from the floor, in sight from the top
{
  const l = HIGH.ledge;
  const x = mid(DIVIDERS[7].door);
  const one = JUMPS.filter((j) => attempt({ x, z: HIGH.entryZ - 1.5, dir: -1, jumpAt: j, takeoff: l.z0, fast: true, done: (p) => onOrPast(p, l), seconds: 4 })).length;
  const two = JUMPS.flatMap((j) => DJS.map((d) => attempt({ x, z: HIGH.entryZ - 1.5, dir: -1, jumpAt: j, takeoff: l.z0, dj: d, done: (p) => onOrPast(p, l), seconds: 4 }))).filter(Boolean).length;
  check(`high ground (a ${l.top} m platform): one jump gets onto it from no take-off at a full sprint; the double jump from at least half of ${JUMPS.length * DJS.length} timings`, one === 0 && two * 2 >= JUMPS.length * DJS.length, `one jump ${one}, the double jump ${two}`);
  const figs = ROOMS[7].enemies;
  const seenFrom = (eye: THREE.Vector3) =>
    figs.filter((f) => {
      const chest = new THREE.Vector3(f.x, 1.25, f.z);
      const d = chest.clone().sub(eye);
      const len = d.length();
      return solidHit(eye, d.normalize(), len) >= len;
    }).length;
  const eyeUp = MOVE.standHeight * 0.88;
  let fromFloor = 0;
  // the floor before the platform, and between it and the screen but at the screen's gap
  for (let z = HIGH.entryZ - 1; z > l.z0 + 0.4; z -= 1) for (const fx of [BACK.x0 + 0.6, BX, BACK.x1 - 0.6]) fromFloor = Math.max(fromFloor, seenFrom(new THREE.Vector3(fx, eyeUp, z)));
  for (let z = l.z1 - 0.6; z > HIGH.screenZ + 0.6; z -= 1) for (const fx of [BACK.x0 + 0.6, BX, HIGH.screenX1 - 1]) fromFloor = Math.max(fromFloor, seenFrom(new THREE.Vector3(fx, eyeUp, z)));
  const fromTop = seenFrom(new THREE.Vector3(BX, l.top + eyeUp, (l.z0 + l.z1) / 2));
  check("and its three are out of sight from the floor before it and behind the screen, every one in sight from its top", fromFloor === 0 && fromTop === figs.length, `from the floor ${fromFloor}, from the top ${fromTop} of ${figs.length}`);
}

// ---- every other room's dummies in sight from a point on its way through
{
  const eye = MOVE.standHeight * 0.88;
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y + eye, z);
  const views: Array<[number, THREE.Vector3[]]> = [
    [0, [v(OX, BREACH.wall.top, BREACH.wall.z1)]],
    [1, [v(mid(VENT.slot), 0, VENT.z1 + 1)]],
    [2, [v(OX, 0, CLIMB.rampEnd + 0.5)]],
    [3, [v(mid(DIVIDERS[3].door), DECK, GAP.a1 - 0.5)]],
    [4, [v(OX, DECK, WALLRUN.b1 - 1)]],
    [5, [v(BX, GLIDE.h, GLIDE.face - 0.3), v(BX, GLIDE.h, GLIDE.b1 + 0.5)]],
    [6, [v(mid(DIVIDERS[6].door), 0, CROSS.entryZ - 2), v(BX, 0, (CROSS.entryZ + CROSS.exitZ) / 2)]],
    [8, [v(mid(DIVIDERS[8].door), 0, FINAL.entryZ - 2)]],
  ];
  const clear = (from: THREE.Vector3, to: THREE.Vector3) => {
    const d = to.clone().sub(from);
    const len = d.length();
    return solidHit(from, d.normalize(), len) >= len;
  };
  const hidden: string[] = [];
  for (const [ri, from] of views) {
    ROOMS[ri].enemies.forEach((f, i) => {
      // a walker at both ends of its line
      const xs = f.path ? [f.x, f.x + f.path.dx] : [f.x];
      for (const fx of xs) if (!from.some((e) => clear(e, new THREE.Vector3(fx, (f.y ?? 0) + 1.25, f.z)))) hidden.push(`${ROOMS[ri].name} ${i}`);
    });
  }
  check("every other room's dummies are in sight from a point on its way through (a walker at both ends of its line)", hidden.length === 0, hidden.join(", "));
}

// ---- the whole route, end to end: door to door through every room, each with the move its tip names, steered at points
// through the doors. Its time (and a shot a dummy) is what the S rank is set from (therun.json ranks).
{
  const byWall = RUN_WALL_X - MOVE.radius - 0.05;
  const dOut = (i: number) => mid(DIVIDERS[i].door);
  // the points: through each door's middle, and on through each room by its move
  const way: Array<[number, number]> = [
    [dOut(0), BREACH.entryZ + 1],
    [OX, BREACH.wall.z0 - 1],
    [dOut(1), VENT.entryZ - 1],
    [mid(VENT.slot), VENT.entryZ + 2],
    [mid(VENT.slot), VENT.z1 + 1],
    [dOut(2), CLIMB.entryZ - 1],
    [dOut(2), CLIMB.wall.z0 + 4],
    [dOut(3), GAP.entryZ - 1],
    [dOut(3), GAP.b0 + 4],
    [dOut(4), WALLRUN.entryZ - 1],
    [byWall, WALLRUN.a0],
    // (along the deck turning in at the wall, so the jump at its end goes onto it, as a player jumps at it: on the ground
    // the body keeps a hand's width off a wall it runs beside, more than a run's reach)
    [RUN_WALL_X + 2, WALLRUN.a1 + 6],
    [byWall, WALLRUN.b0 + 6],
    [OX, TURN_Z + 6],
    [dOut(5), TURN_Z + 6],
    [dOut(5), GLIDE.entryZ - 2],
    [dOut(5), GLIDE.b1 + 1],
    [dOut(6), CROSS.entryZ + 1],
    [dOut(7), HIGH.entryZ + 1],
    [dOut(7), HIGH.ledge.z1 - 1],
    [BACK.x1 - cfg.high.gapW / 2, HIGH.screenZ - 1.5],
    [dOut(8), FINAL.entryZ + 1],
    [dOut(8), FINAL.entryZ - 3],
    [mid(DIVIDERS[5].door), FINISH_Z - 2],
  ];
  // what is done where: crossing a line along z the way the bay runs (+1 out, -1 back)
  type Act = { z: number; dir: 1 | -1; jump?: boolean; dj?: number; slide?: number; holster?: boolean; glide?: boolean };
  const acts: Act[] = [
    { z: BREACH.wall.z0 - 4, dir: 1, jump: true },
    { z: VENT.z0 - 3, dir: 1, slide: VENT.z1 + 0.3 },
    { z: CLIMB.wall.z1 + 0.3, dir: 1, slide: CLIMB.rampEnd },
    { z: GAP.a1 - 1, dir: 1, jump: true, dj: 0.4 },
    { z: WALLRUN.a1 - 0.8, dir: 1, jump: true },
    { z: GLIDE.face + 2, dir: -1, jump: true, dj: 0.2, glide: true },
    { z: HIGH.ledge.z0 + 1.5, dir: -1, jump: true, dj: 0.3 },
    { z: FINAL.entryZ, dir: -1, holster: true },
  ];
  const p = player(BASIC_COURSE.startPose.x, 0, BASIC_COURSE.startPose.z, OUTWARD);
  const s = new Script();
  s.down.add("forward");
  let t = 1000;
  let clock = 0;
  let started = -1;
  let next = 0;
  let lastZ = p.pos.z;
  let actZ = p.pos.z;
  const done = new Set<Act>();
  let djAt = -1;
  let slideTo: { z: number; dir: 1 | -1 } | null = null;
  let glide = false;
  let sgFrame = -1;
  let finished = -1;
  const entered: number[] = [];
  let stuck = "";
  let ranWall = false;
  let climbed = false;
  for (let i = 0; i < 120 / DT && finished < 0; i++) {
    t += DT;
    clock += DT;
    const [tx, tz] = way[Math.min(next, way.length - 1)];
    // on to the next point once at it or past it along the way from the last
    const [px, pz] = next > 0 ? way[next - 1] : [p.pos.x, BASIC_COURSE.startPose.z];
    const lx = tx - px;
    const lz = tz - pz;
    const ll = Math.hypot(lx, lz) || 1;
    if ((p.pos.x - tx) * (lx / ll) + (p.pos.z - tz) * (lz / ll) > -0.5 && next < way.length - 1) next++;
    // face a point 3 m on along the line from the last point to this one, so the body keeps to the line (yaw 0 runs -z,
    // positive turns left: forward is (-sin, -cos))
    {
      const [bx, bz] = way[Math.min(next, way.length - 1)];
      const [cx, cz] = next > 0 ? way[next - 1] : [p.pos.x, p.pos.z];
      const ux = bx - cx;
      const uz = bz - cz;
      const ul = Math.hypot(ux, uz) || 1;
      const k = Math.min(ul, Math.max(0, ((p.pos.x - cx) * ux + (p.pos.z - cz) * uz) / ul) + 3);
      const ax = cx + (ux / ul) * k;
      const az = cz + (uz / ul) * k;
      if (!p.onWall) p.yaw = (Math.atan2(-(ax - p.pos.x), -(az - p.pos.z)) * 180) / Math.PI;
    }
    for (const a of acts) {
      if (done.has(a)) continue;
      const side = a.dir === 1 ? p.pos.x > OUT.x0 : p.pos.x < BACK.x1;
      if (!side || !((actZ - a.z) * a.dir < 0 && (p.pos.z - a.z) * a.dir >= 0)) continue;
      done.add(a);
      if (a.slide !== undefined) {
        s.down.add("crouch");
        s.taps.add("crouch");
        slideTo = { z: a.slide, dir: a.dir };
      }
      if (a.jump) {
        s.down.delete("crouch");
        s.taps.add("jump");
        if (a.dj !== undefined) djAt = clock + a.dj;
      }
      if (a.glide) glide = true;
      if (a.holster) p.holsterBoost = MOVE.holsterBoost;
    }
    actZ = p.pos.z;
    if (slideTo && (p.pos.z - slideTo.z) * slideTo.dir > 0) {
      s.down.delete("crouch");
      slideTo = null;
    }
    // the double jump, unless a mantle took the first jump onto the ledge
    const m = mantleOf(p);
    if (djAt > 0 && clock >= djAt) {
      if (!m) s.taps.add("jump");
      djAt = -1;
    }
    if (glide && m) {
      const left = m.started + m.duration - t;
      if (sgFrame < 0 && left <= MOVE.superglideWindow * 0.5 + DT) {
        s.taps.add("jump");
        sgFrame = i;
      } else if (sgFrame >= 0 && i === sgFrame + 1) {
        s.taps.add("crouch");
        glide = false;
      }
    }
    p.update(DT, t, s, 0, 1, false);
    s.taps.clear();
    const { x, y, z } = p.pos;
    if (p.onWall && z > WALLRUN.a1 && z < WALLRUN.b0) ranWall = true;
    if (p.climbing && z < CLIMB.wall.z0) climbed = true;
    if (started < 0 && lastZ < BASIC_COURSE.startZ && z >= BASIC_COURSE.startZ) started = clock;
    ROOMS.forEach((r, ri) => {
      if (entered[ri] === undefined && r.trigger(x, y, z)) entered[ri] = clock - started;
    });
    for (const hz of BASIC_COURSE.hazards) if (z > hz.minZ && z < hz.maxZ && y < hz.fallY && x > (hz.minX ?? -Infinity) && x < (hz.maxX ?? Infinity)) stuck ||= `fell at z ${z.toFixed(1)}`;
    if (started >= 0 && x > BACK.x0 && x < BACK.x1 && lastZ > FINISH_Z && z <= FINISH_Z) finished = clock - started;
    lastZ = z;
    if (stuck) break;
  }
  const where = `at x ${p.pos.x.toFixed(1)} y ${p.pos.y.toFixed(1)} z ${p.pos.z.toFixed(1)}, the point ${next} of ${way.length}`;
  const rooms = ROOMS.map((r, i) => `${r.name} ${entered[i]?.toFixed(2) ?? "-"}`).join(", ");
  check("the whole route runs end to end, door to door, every room entered, the finish line crossed, no fall", finished > 0 && entered.length === ROOMS.length && entered.every((e) => e !== undefined) && !stuck, finished > 0 ? `${finished.toFixed(2)} s: ${rooms}` : `${stuck || "stopped"} ${where}; ${rooms}`);
  check("and on it the climb, the wall run and the superglide each happened", climbed && ranWall && p.superglidedAt > 0, JSON.stringify({ climbed, ranWall, glided: p.superglidedAt > 0 }));
  const dummies = ROOMS.reduce((n, r) => n + r.enemies.length, 0);
  const S = finished + dummies * cfg.ranks.shot;
  check(`the S rank (${cfg.ranks.S} s) is within 10% of the route's time and a shot a dummy`, finished > 0 && Math.abs(cfg.ranks.S - S) <= S * 0.1, `${finished.toFixed(2)} s run + ${dummies} x ${cfg.ranks.shot} s = ${S.toFixed(1)} s`);
  const pars = roomPars(BASIC_COURSE);
  check("every room's par is over a second", pars.every((x) => x > 1), pars.join(" "));
}

console.log(fails === 0 ? "\nSK RUN PASS" : `\nSK RUN FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
