// THE TUTORIAL, proven (Milestone 633, src/game/courses/tutorial.ts): the real controller with SpeedKills' movement,
// driven frame by frame through the course's own colliders (course.ts courseColliders, the geometry the game draws), its
// doors open. Each room is passed with the move it teaches and not with the one before it, unarmed (the gun put away,
// movement.json holsterBoost) up to the dash room and armed after, as the tutorial has you:
//   the ledge with a jump, not a walk; the higher ledge with a double jump, not one jump; the ledge over the pit with a
//   double jump and a mantle, not one jump; the wall pit with a wall run, not a double jump at any timing; the dash pit
//   with a double jump and the dash (hacks.json dash, as main.ts casts it), not a jump and the dash, not the dash alone,
//   its walls taking no wall run; the platform with a double jump, not one; the wall with a climb; the superglide gap
//   with the real input from every approach and nothing else, and its optional bridge with a walk. And each soldier can
//   be seen from where its room puts you.
//
// It needs the game named: GAME=speedkills npx tsx tools/checks/sk-tutorial.ts (verify runs it that way).
import * as THREE from "three";
import { Player, type MoveInput } from "../../src/game/player";
import type { Action } from "../../src/game/input";
import { RANGE_SOLIDS } from "../../src/game/range";
import { ZIPLINES } from "../../src/game/traversal";
import { MOVE } from "../../src/game/movement";
import { GAME } from "../../src/game/game";
import { solidHit } from "../../src/game/projectile";
import { courseColliders } from "../../src/game/course";
import { TUTORIAL_COURSE, JUMP, DOUBLE, MANTLE, WALLRUN, DASH, HIGH, CLIMB, GLIDE, GLIDE_GAP, EXIT, OUT, BACK, TURN_Z, FALL_Y, DECK, RUN_WALL_X, DIVIDERS, type Ledge, type PitRoom } from "../../src/game/courses/tutorial";
import cfg from "../../src/config/tutorial.json";
import hacksCfg from "../../src/config/hacks.json";
import dress from "../../src/config/tutorialdress.json";

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
const { solids } = courseColliders(TUTORIAL_COURSE);
RANGE_SOLIDS.length = 0;
for (const s of solids) RANGE_SOLIDS.push({ ...s });
ZIPLINES.length = 0;

/** facing +z (out) and -z (back): yaw 0 runs -z */
const OUTWARD = 180;
const BACKWARD = 0;
const OX = (OUT.x0 + OUT.x1) / 2;
const BX = (BACK.x0 + BACK.x1) / 2;

function player(x: number, y: number, z: number, yaw: number, armed: boolean): Player {
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

/** DASH as main.ts casts it: the eye along the look, its distance or to the first wall less 1.5 body radii, momentum kept */
function dash(p: Player, pitchDeg: number): void {
  const eye = p.eyePosition().clone();
  const yaw = (p.yaw * Math.PI) / 180;
  const pit = (pitchDeg * Math.PI) / 180;
  const fwd = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pit), Math.sin(pit), -Math.cos(yaw) * Math.cos(pit));
  const hit = solidHit(eye, fwd, hacksCfg.dash.distance);
  const reach = Math.max(0, Math.min(hacksCfg.dash.distance, (Number.isFinite(hit) ? hit : hacksCfg.dash.distance) - MOVE.radius * 1.5));
  const at = eye.addScaledVector(fwd, reach);
  // (as main.ts moves you since Milestone 867: a blink, which keeps the momentum; the teleport this modelled zeroed it,
  // and the momentum was put back here, where the game had none)
  p.blink(at.x, Math.max(0, at.y - (p.eyePosition().y - p.pos.y)), at.z);
  p.vel.y = Math.max(0, p.vel.y);
}

/** on a ledge's top, or past it the way the room runs */
function onOrPast(p: Player, l: Ledge): boolean {
  const out = l.z1 > l.z0;
  const past = out ? p.pos.z > l.z1 : p.pos.z < l.z1;
  const over = out ? p.pos.z > l.z0 - 0.2 : p.pos.z < l.z0 + 0.2;
  return p.onGround && (past || (over && p.pos.y > l.top - 0.1));
}

/**
 * A run at a room from inside its door (1.5 m in: the slick panel on a door's wall is 0.8 m out from its middle, and a
 * body started across it is pushed off sideways): sprinting `dir`, a jump `jumpAt` m before the take-off line `takeoff` (null:
 * none), maybe a double jump `dj` s after, maybe the dash `dashAt` s after the jump (or, with no jump, at the line) at
 * `pitch`. True once `done`; false on falling under the pit's fall line, or after `seconds`.
 */
function attempt(o: {
  x: number;
  z: number;
  dir: 1 | -1;
  armed: boolean;
  jumpAt: number | null;
  takeoff: number;
  dj?: number;
  dashAt?: number;
  pitch?: number;
  done: (p: Player) => boolean;
  pit?: [number, number, number];
  seconds?: number;
  onWall?: { seen: boolean };
}): boolean {
  const p = player(o.x, 0, o.z, o.dir === 1 ? OUTWARD : BACKWARD, o.armed);
  const s = new Script();
  s.down.add("forward");
  let t = 1000;
  let clock = 0;
  let jumped = -1;
  let dashed = false;
  for (let i = 0; i < (o.seconds ?? 6) / DT; i++) {
    t += DT;
    clock += DT;
    const to = (o.takeoff - p.pos.z) * o.dir;
    if (o.jumpAt !== null && jumped < 0 && p.onGround && to < o.jumpAt) {
      s.taps.add("jump");
      jumped = clock;
    }
    if (o.dj !== undefined && jumped > 0 && Math.abs(clock - jumped - o.dj) < DT / 2) s.taps.add("jump");
    if (o.dashAt !== undefined && !dashed && (o.jumpAt === null ? to < 0.3 : jumped > 0 && clock - jumped >= o.dashAt)) {
      dash(p, o.pitch ?? 0);
      dashed = true;
    }
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
const span = (r: PitRoom): [number, number] => [Math.min(r.a1, r.b0), Math.max(r.a1, r.b0)];

console.log(`\nTHE TUTORIAL, proven on its own geometry (game: ${GAME})`);
check("this runs with SpeedKills' movement", GAME === "speedkills");
check(
  "it fits: the wall run's landing short of the turn, the superglide's landing deck in from the way out",
  WALLRUN.b1 < TURN_Z - 5 && GLIDE.b1 > EXIT.z + 10 && DASH.exitZ > HIGH.exitZ,
  `the wall pit ${cfg.wallRun.pit} m, the dash pit ${cfg.dash.pit} m, the superglide gap ${GLIDE_GAP} m`,
);

const JUMPS = [1, 1.5, 2, 2.5, 3, 3.5, 4];
const DJS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];

// ---- 2. the jump: onto the ledge with a jump from any distance, never with a walk
{
  const l = JUMP.ledge;
  const tryIt = (jumpAt: number | null) => attempt({ x: OX, z: JUMP.entryZ + 1.5, dir: 1, armed: false, jumpAt, takeoff: l.z0, done: (p) => onOrPast(p, l), seconds: 4 });
  const near = [0.5, 1, 1.5, 2, 2.5, 3];
  const jumps = near.filter((j) => tryIt(j));
  check(`jump (a ${l.top} m ledge): one jump gets onto it from every distance 0.5 to 3 m out, unarmed; a walk does not`, jumps.length === near.length && !tryIt(null), `${jumps.length} of ${near.length}`);
}

// ---- 3. the double jump: never with one jump, with the double jump from most timings
{
  const l = DOUBLE.ledge;
  const tryIt = (jumpAt: number, dj?: number) => attempt({ x: OX, z: DOUBLE.entryZ + 1.5, dir: 1, armed: false, jumpAt, takeoff: l.z0, dj, done: (p) => onOrPast(p, l), seconds: 4 });
  const one = JUMPS.filter((j) => tryIt(j)).length;
  const two = JUMPS.flatMap((j) => DJS.map((d) => tryIt(j, d))).filter(Boolean).length;
  check(`double jump (a ${l.top} m ledge): one jump gets onto it from no distance; the double jump from at least half of 56 timings`, one === 0 && two >= 28, `one jump ${one}, the double jump ${two} of 56`);
}

// ---- 4. the mantle: over the pit onto the higher ledge with the double jump, not one jump
{
  const l = { z0: MANTLE.b0, z1: MANTLE.b1, top: MANTLE.top };
  const tryIt = (dj?: number) => attempt({ x: OX, z: MANTLE.entryZ + 1.5, dir: 1, armed: false, jumpAt: 0.8, takeoff: MANTLE.a1, dj, done: (p) => onOrPast(p, l), pit: [...span(MANTLE), FALL_Y], seconds: 5 });
  const twos = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7].filter((d) => tryIt(d));
  check(
    `mantle (a ${cfg.mantle.pit} m pit to a ledge ${(MANTLE.top - DECK).toFixed(1)} m above the deck): one jump at the edge falls in; the double jump 0.2 to 0.7 s after it mantles onto it`,
    !tryIt() && twos.length === 6,
    `the double jump at ${twos.join(", ")} s`,
  );
}

// ---- 5. the wall run: along the lit wall it lands; a double jump at any timing falls in
{
  const byWall = RUN_WALL_X - MOVE.radius - 0.05;
  const past = (p: Player) => p.pos.z > WALLRUN.b0 && p.onGround;
  const wall = { seen: false };
  const run = attempt({ x: byWall, z: WALLRUN.entryZ + 1.5, dir: 1, armed: false, jumpAt: 0.8, takeoff: WALLRUN.a1, done: past, pit: [...span(WALLRUN), FALL_Y], seconds: 7, onWall: wall });
  const djs = DJS.concat([0.9, 1.0]).filter((d) => attempt({ x: OX, z: WALLRUN.entryZ + 1.5, dir: 1, armed: false, jumpAt: 0.8, takeoff: WALLRUN.a1, dj: d, done: past, pit: [...span(WALLRUN), FALL_Y], seconds: 7 }));
  check(`wall run (a ${cfg.wallRun.pit} m pit): a wall run along the lit wall lands past it; a double jump at any timing falls in`, run && wall.seen && djs.length === 0, `double jumps that crossed: ${djs.length}`);
  // and as a player runs it (the owner's playtest, 2026-10-18: it could not be passed): from the door, up the lit line on
  // the deck to beside the wall, a jump at the deck's end looking straight along it, forward held. On the ground a body
  // run beside a wall rides a hand's width off it, past the 4 hu a climb takes; the run's own reach takes it
  // (movement.json wallRun.reach)
  const fromDoor = (jumpAt: number, lineX: number) => {
    const p = player((DIVIDERS[4].door[0] + DIVIDERS[4].door[1]) / 2, 0, WALLRUN.entryZ + 1.5, OUTWARD, false);
    const s = new Script();
    s.down.add("forward");
    let t = 1000;
    let jumped = false;
    let ran = false;
    for (let i = 0; i < 8 / DT; i++) {
      t += DT;
      if (!jumped) {
        // steered at a point 3 m on along the line, as a player follows it
        const ahead = Math.min(WALLRUN.a1, p.pos.z + 3);
        p.yaw = (Math.atan2(-(lineX - p.pos.x), -(ahead - p.pos.z)) * 180) / Math.PI;
        if (p.onGround && p.pos.z > WALLRUN.a1 - jumpAt) {
          s.taps.add("jump");
          jumped = true;
          p.yaw = OUTWARD;
        }
      }
      p.update(DT, t, s, 0, 1, false);
      s.taps.clear();
      if (p.onWall) ran = true;
      if (p.pos.z > WALLRUN.a1 && p.pos.z < WALLRUN.b0 && p.pos.y < FALL_Y) return false;
      if (p.onGround && p.pos.z > WALLRUN.b0) return ran;
    }
    return false;
  };
  const lines = [RUN_WALL_X - 0.55, RUN_WALL_X - MOVE.radius];
  const tries = lines.flatMap((lx) => [0.5, 1, 1.5, 2].map((j) => fromDoor(j, lx)));
  check("and as a player runs it: from the door up the lit line to beside the wall (or steered right into it), a jump at the deck's end 0.5 to 2 m out lands past the pit on the wall", tries.every(Boolean), `${tries.filter(Boolean).length} of ${tries.length}`);
}

// ---- 6. the dash: a double jump and the dash, in either order, onto the ledge; a jump and the dash, or the dash alone, not
{
  const l = { z0: DASH.b0, z1: DASH.b1, top: DASH.top };
  const go = (o: { jumpAt?: number | null; dj?: number; dashAt?: number; pitch?: number }) =>
    attempt({ x: BX, z: DASH.entryZ - 1.5, dir: -1, armed: false, jumpAt: o.jumpAt === undefined ? 0.8 : o.jumpAt, takeoff: DASH.a1, dj: o.dj, dashAt: o.dashAt, pitch: o.pitch, done: (p) => onOrPast(p, l), pit: [...span(DASH), FALL_Y], seconds: 6 });
  const djDash = [0.3, 0.4, 0.5, 0.6].flatMap((dj) => [0.1, 0.25, 0.4].map((k) => go({ dj, dashAt: dj + k })));
  const dashDj = [0.3, 0.45].flatMap((d) => [0.1, 0.25].map((k) => go({ dashAt: d, dj: d + k })));
  // (looking level: looking a few degrees up, the dash from a jump goes over the ledge's top rather than into its face,
  // as it would anywhere; tutorial.json _dash)
  const jumpDash = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7].map((d) => go({ dashAt: d }));
  const alone = [0, 5].map((pitch) => go({ jumpAt: null, dashAt: 0, pitch }));
  check(
    `dash (a ${cfg.dash.pit} m pit to a ledge ${(DASH.top - DECK).toFixed(1)} m above the deck): a double jump then the dash lands at every timing tried, and the dash then the double jump at most`,
    djDash.every(Boolean) && dashDj.filter(Boolean).length * 2 > dashDj.length,
    `${djDash.filter(Boolean).length} of ${djDash.length}, ${dashDj.filter(Boolean).length} of ${dashDj.length}`,
  );
  check("and a jump with the dash, at any moment of it, falls in, as does the dash alone (level or 5 degrees up)", jumpDash.every((x) => !x) && alone.every((x) => !x), `${jumpDash.filter(Boolean).length} jump and dash crossed, ${alone.filter(Boolean).length} dash alone`);
  const ran = [BACK.x0 + cfg.slick + MOVE.radius + 0.05, BACK.x1 - cfg.slick - MOVE.radius - 0.05].map((x) => {
    const w = { seen: false };
    attempt({ x, z: DASH.entryZ - 1.5, dir: -1, armed: false, jumpAt: 0.8, takeoff: DASH.a1, done: () => false, pit: [...span(DASH), FALL_Y], seconds: 3, onWall: w });
    return w.seen;
  });
  check("its walls are slick: a jump off the deck beside either takes no wall run", ran.every((r) => !r));
}

// ---- 7 and 8 (armed): the platform with a double jump, not one; the wall with a climb; the soldiers in sight from each
{
  const l = HIGH.ledge;
  const tryIt = (jumpAt: number, dj?: number) => attempt({ x: BX, z: HIGH.entryZ - 1.5, dir: -1, armed: true, jumpAt, takeoff: l.z0, dj, done: (p) => onOrPast(p, l), seconds: 4 });
  const one = JUMPS.filter((j) => tryIt(j)).length;
  const two = JUMPS.flatMap((j) => DJS.map((d) => tryIt(j, d))).filter(Boolean).length;
  check(`high ground (a ${l.top} m platform, armed): one jump gets onto it from no distance; the double jump from at least half of 56 timings`, one === 0 && two >= 28, `one jump ${one}, the double jump ${two} of 56`);
  const c = CLIMB.ledge;
  const climbs = [null, 1, 2, 3].filter((j) => attempt({ x: BX, z: CLIMB.entryZ - 1.5, dir: -1, armed: true, jumpAt: j, takeoff: c.z0, done: (p) => onOrPast(p, c), seconds: 5 }));
  check(`climb (a ${c.top} m wall, armed): running at it and holding forward climbs it, with a jump or without`, climbs.length === 4, `${climbs.length} of 4`);
  const seen = (top: Ledge, figs: Array<{ x: number; z: number }>) =>
    figs.every((f) => {
      const eye = new THREE.Vector3(BX, top.top + MOVE.standHeight * 0.88, (top.z0 + top.z1) / 2);
      const chest = new THREE.Vector3(f.x, 1.25, f.z);
      const d = chest.clone().sub(eye);
      const len = d.length();
      return solidHit(eye, d.normalize(), len) >= len;
    });
  check("and every soldier is in sight from the platform and from the wall's top", seen(HIGH.ledge, TUTORIAL_COURSE.rooms[6].enemies) && seen(CLIMB.ledge, TUTORIAL_COURSE.rooms[7].enemies));
}

// ---- 9 (armed): the superglide gap, and its optional bridge
{
  const G = GLIDE;
  const mid = (BACK.x0 + G.laneX1) / 2;
  const glide = (o: { jumpAt: number; dj1?: number; sg: boolean; hop?: boolean; dj2?: number }): { landed: boolean; glided: boolean } => {
    const p = player(mid, 0, G.entryZ - 1.5, BACKWARD, true);
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
      if (p.pos.z < G.edge && p.pos.z > G.b0 && p.pos.y < G.fallY) return { landed: false, glided: p.superglidedAt > 0 };
      if (p.onGround && p.pos.z < G.b0) return { landed: true, glided: p.superglidedAt > 0 };
      if (clock > 4 && p.onGround && p.pos.z > G.face) break;
    }
    return { landed: false, glided: p.superglidedAt > 0 };
  };
  const sg = JUMPS.flatMap((jumpAt) => [undefined, 0.2, 0.4].map((dj1) => glide({ jumpAt, dj1, sg: true })));
  const sgDj = JUMPS.flatMap((jumpAt) => [0.5, 0.7, 0.9].map((dj2) => glide({ jumpAt, sg: true, dj2 })));
  check(
    `superglide (${GLIDE_GAP} m off a ${G.h} m ledge, armed): the superglide's own input (jump, crouch a frame later) from every approach lands past the gap, and with a double jump at its top too`,
    sg.every((r) => r.glided && r.landed) && sgDj.every((r) => r.landed),
    `${sg.filter((r) => r.landed).length} of ${sg.length} alone, ${sgDj.filter((r) => r.landed).length} of ${sgDj.length} with the double jump`,
  );
  let any = false;
  for (const jumpAt of JUMPS) for (const dj1 of [undefined, 0.1, 0.3, 0.5]) for (const hop of [false, true]) for (const dj2 of [undefined, 0.2, 0.4, 0.6, 0.8, 1.0]) if (glide({ jumpAt, dj1, sg: false, hop, dj2 }).landed) any = true;
  check("and without a superglide nothing crosses its lane: every approach, a jump and double jump off the top at every timing", !any);
  // the optional bridge: a walk up the stairs and along it gets past the gap
  const p = player((G.bridgeX0 + BACK.x1) / 2, 0, G.entryZ - 1.5, BACKWARD, true);
  const s = new Script();
  s.down.add("forward");
  let t = 1000;
  let fell = false;
  for (let i = 0; i < 6 / DT; i++) {
    t += DT;
    p.update(DT, t, s, 0, 1, false);
    if (p.pos.z < G.edge && p.pos.z > G.b0 && p.pos.y < G.fallY) fell = true;
    if (p.pos.z < G.b0 - 1) break;
  }
  check("the optional bridge: a walk up its stairs and along it gets past the gap, no jump at all", !fell && p.pos.z < G.b0 - 1 && p.pos.y > G.h - 0.1, `at z ${p.pos.z.toFixed(1)} y ${p.pos.y.toFixed(2)}`);
}

// ---- the dressing's pieces (Milestone 634, src/config/tutorialdress.json): none where a body goes. They draw and do not
// collide, so a sign a wall run passed through would be seen through; every one on a wall stands its bottom 6.5 m up
// or more (a wall run is 2 to 4 m up, a double jump's top under 3), and every one hanging free 8 m up or more
{
  const pieces = (dress as unknown as { pieces: Array<[string, string | number, number, number, number?]> }).pieces;
  const low = pieces.filter(([, a, b, c]) => (typeof a === "string" ? c < 6.5 : b < 8));
  check(`the dressing's ${pieces.length} pieces hang clear of every move: on a wall 6.5 m up or more, free 8 m up or more`, low.length === 0, low.map(([k]) => k.split("/").pop()).join(", "));
}

// ---- the turn: open across the far end from the way out's landing to the way back's first door
{
  const p = player(OX, 0, TURN_Z + 4, 90, false);
  const s = new Script();
  s.down.add("forward");
  let t = 1000;
  for (let i = 0; i < 3 / DT; i++) {
    t += DT;
    p.update(DT, t, s, 0, 1, false);
  }
  check("the turn: across the far end from the right-hand bay to the middle one, nothing in the way", p.pos.x < BACK.x1 - 2, `reached x ${p.pos.x.toFixed(1)}`);
}

// ---- the whole tutorial, end to end (Milestone 638, the owner's playtest, 2026-10-18: "have the bot actually run through
// 4's end to 5's beginning. there is a wall blocking it"): from its start through every room's door into the next, each
// room with its move, steered at points through the doors, unarmed until the ANAKIN and armed after, and out of its last
// door into the range. The rooms above are proven one at a time from inside their doors; this is the way between them.
{
  const door = (i: number) => (DIVIDERS[i].door[0] + DIVIDERS[i].door[1]) / 2;
  const lineX = RUN_WALL_X - 0.55;
  const lane = (BACK.x0 + GLIDE.laneX1) / 2;
  const exitX = (EXIT.x0 + EXIT.x1) / 2;
  const way: Array<[number, number]> = [
    [door(0), DIVIDERS[0].z + 1],
    [door(1), DIVIDERS[1].z - 1],
    [door(1), DIVIDERS[1].z + 1],
    [door(1), JUMP.ledge.z1 + 1],
    [door(2), DIVIDERS[2].z - 1],
    [door(2), DIVIDERS[2].z + 1],
    [door(2), DOUBLE.ledge.z1 + 1],
    [door(3), DIVIDERS[3].z - 1],
    [door(3), DIVIDERS[3].z + 1],
    [door(3), MANTLE.b1 + 0.8],
    [door(4), DIVIDERS[4].z - 1],
    [door(4), DIVIDERS[4].z + 1],
    // up the lit line to the wall, and along it
    [lineX, WALLRUN.a0 + 3.5],
    [lineX, WALLRUN.b0 + 4],
    [OX, TURN_Z + 8],
    [door(5), TURN_Z + 8],
    [door(5), DIVIDERS[5].z - 1],
    [door(5), DASH.b1 - 1],
    [door(6), DIVIDERS[6].z + 1],
    [door(6), DIVIDERS[6].z - 1],
    [door(6), HIGH.ledge.z1 - 1],
    [door(7), DIVIDERS[7].z + 1],
    [door(7), DIVIDERS[7].z - 1],
    [door(7), CLIMB.ledge.z1 - 1],
    [door(8), DIVIDERS[8].z + 1],
    [door(8), DIVIDERS[8].z - 1],
    [lane, DIVIDERS[8].z - 3],
    [lane, GLIDE.b1 - 1],
    [exitX, EXIT.z + 1.5],
    [exitX, EXIT.z - 2],
  ];
  type Act = { z: number; dir: 1 | -1; jump?: boolean; dj?: number; dash?: number; glide?: boolean; arm?: boolean };
  const acts: Act[] = [
    { z: JUMP.ledge.z0 - 1.5, dir: 1, jump: true },
    { z: DOUBLE.ledge.z0 - 1, dir: 1, jump: true, dj: 0.3 },
    { z: MANTLE.a1 - 0.8, dir: 1, jump: true, dj: 0.4 },
    { z: WALLRUN.a1 - 1, dir: 1, jump: true },
    { z: DASH.a1 + 0.8, dir: -1, jump: true, dj: 0.3, dash: 0.55 },
    { z: HIGH.entryZ - 1, dir: -1, arm: true },
    { z: HIGH.ledge.z0 + 1, dir: -1, jump: true, dj: 0.3 },
    { z: GLIDE.face + 2, dir: -1, jump: true, dj: 0.2, glide: true },
  ];
  const p = player(TUTORIAL_COURSE.startPose.x, 0, TUTORIAL_COURSE.startPose.z, OUTWARD, false);
  const s = new Script();
  s.down.add("forward");
  let t = 1000;
  let clock = 0;
  let next = 0;
  let actZ = p.pos.z;
  const done = new Set<Act>();
  let djAt = -1;
  let dashAt = -1;
  let glide = false;
  let sgFrame = -1;
  let out = -1;
  let fell = "";
  const moves = { ran: false, climbed: false, glided: false, dashed: false };
  const reached: number[] = [];
  for (let i = 0; i < 180 / DT && out < 0; i++) {
    t += DT;
    clock += DT;
    const [tx, tz] = way[next];
    const [px, pz] = next > 0 ? way[next - 1] : [p.pos.x, p.pos.z];
    const ux = tx - px;
    const uz = tz - pz;
    const ul = Math.hypot(ux, uz) || 1;
    if ((p.pos.x - tx) * (ux / ul) + (p.pos.z - tz) * (uz / ul) > -0.5 && next < way.length - 1) next++;
    {
      // a point 3 m on along the line to the next one, so the body keeps to the line
      const [bx, bz] = way[next];
      const [cx, cz] = next > 0 ? way[next - 1] : [p.pos.x, p.pos.z];
      const vx = bx - cx;
      const vz = bz - cz;
      const vl = Math.hypot(vx, vz) || 1;
      const k = Math.min(vl, Math.max(0, ((p.pos.x - cx) * vx + (p.pos.z - cz) * vz) / vl) + 3);
      if (!p.onWall && !p.climbing) p.yaw = (Math.atan2(-(cx + (vx / vl) * k - p.pos.x), -(cz + (vz / vl) * k - p.pos.z)) * 180) / Math.PI;
    }
    for (const a of acts) {
      if (done.has(a)) continue;
      const side = a.dir === 1 ? p.pos.x > OUT.x0 : p.pos.x < BACK.x1;
      if (!side || !((actZ - a.z) * a.dir < 0 && (p.pos.z - a.z) * a.dir >= 0)) continue;
      done.add(a);
      if (a.jump) {
        s.taps.add("jump");
        if (a.dj !== undefined) djAt = clock + a.dj;
        if (a.dash !== undefined) dashAt = clock + a.dash;
      }
      if (a.glide) glide = true;
      if (a.arm) p.holsterBoost = 1;
    }
    actZ = p.pos.z;
    const m = mantleOf(p);
    if (djAt > 0 && clock >= djAt) {
      if (!m) s.taps.add("jump");
      djAt = -1;
    }
    if (dashAt > 0 && clock >= dashAt) {
      dash(p, 0);
      moves.dashed = true;
      dashAt = -1;
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
    if (p.onWall) moves.ran = true;
    if (p.climbing) moves.climbed = true;
    if (p.superglidedAt > 0) moves.glided = true;
    // every room's door come through
    DIVIDERS.forEach((d, di) => {
      if (reached[di] !== undefined) return;
      const inDoor = p.pos.x > d.door[0] && p.pos.x < d.door[1];
      if (inDoor && (d.facing === -1 ? p.pos.z < d.z - 0.5 : p.pos.z > d.z + 0.5)) reached[di] = clock;
    });
    for (const hz of TUTORIAL_COURSE.hazards) if (p.pos.z > hz.minZ && p.pos.z < hz.maxZ && p.pos.y < hz.fallY && p.pos.x > (hz.minX ?? -Infinity) && p.pos.x < (hz.maxX ?? Infinity)) fell ||= `fell at z ${p.pos.z.toFixed(1)}`;
    if (fell) break;
    if (p.pos.z < EXIT.z - 0.5 && p.pos.x > EXIT.x0 && p.pos.x < EXIT.x1) out = clock;
  }
  const doors = DIVIDERS.map((_, i) => (reached[i] !== undefined ? reached[i].toFixed(1) : "-")).join(" ");
  const where = `at x ${p.pos.x.toFixed(1)} y ${p.pos.y.toFixed(1)} z ${p.pos.z.toFixed(1)}, the point ${next} of ${way.length}`;
  check(
    "the whole tutorial run end to end: through every room's door into the next, out of the last door into the range, no fall",
    out > 0 && reached.filter((r) => r !== undefined).length === DIVIDERS.length && !fell,
    out > 0 ? `${out.toFixed(1)} s, the doors at ${doors}` : `${fell || "stopped"} ${where}; the doors at ${doors}`,
  );
  check("and on the way the wall run, the dash, the climb and the superglide each happened", moves.ran && moves.dashed && moves.climbed && moves.glided, JSON.stringify(moves));
}

console.log(fails === 0 ? "\nSK TUTORIAL PASS" : `\nSK TUTORIAL FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
