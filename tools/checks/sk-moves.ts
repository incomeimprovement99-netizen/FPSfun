// SpeedKills' movement in the places it went wrong (Milestones 866 to 868), with the real Player over a few boxes. Run in
// a process of its own with the game named (verify does: GAME=speedkills npx tsx tools/checks/sk-moves.ts), since the
// movement reads its numbers as it loads and the boxes here are the whole world.
import * as THREE from "three";
import { Player, type MoveInput } from "../../src/game/player";
import type { Action } from "../../src/game/input";
import { RANGE_SOLIDS } from "../../src/game/range";
import { ZIPLINES, type Zipline } from "../../src/game/traversal";
import { MOVE } from "../../src/game/movement";
import { FLOORS } from "../../src/game/floors";
import squadCfg from "../../src/config/squad.json";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

class Script implements MoveInput {
  down = new Set<Action>();
  pressed = new Set<Action>();
  held(a: Action): boolean {
    return this.down.has(a);
  }
  pressedNow(a: Action): boolean {
    return this.pressed.has(a);
  }
  hold(a: Action): void {
    if (!this.down.has(a)) this.pressed.add(a);
    this.down.add(a);
  }
  release(a: Action): void {
    this.down.delete(a);
  }
  endFrame(): void {
    this.pressed.clear();
  }
}
type Box = { minX: number; maxX: number; minZ: number; maxZ: number; top: number; base?: number };
function world(boxes: Box[]): void {
  RANGE_SOLIDS.length = 0;
  for (const s of boxes) RANGE_SOLIDS.push({ ...s, base: s.base ?? 0 });
  ZIPLINES.length = 0;
}
function player(): Player {
  const p = new Player({ minX: -500, maxX: 500, minZ: -500, maxZ: 500 });
  p.extraMoves = true;
  p.autoClimb = true;
  p.sprintMode = "always";
  return p;
}
const dt = 1 / 60;

console.log("SpeedKills' movement where it went wrong (player.ts)");

// (Milestone 866) a run up a 0.5 m step under a slab 2 m up: no room to stand on the step, so it is a wall. Stepping up
// put the head in the slab and the push-out threw the body 10 m sideways
{
  world([
    { minX: -10, maxX: 10, minZ: -20, maxZ: -7, top: 0.5 },
    { minX: -10, maxX: 10, minZ: -12, maxZ: -3, base: 2.0, top: 2.3 },
  ]);
  let worst = 0;
  let inside = false;
  for (const yaw of [0, 30]) {
    const p = player();
    const inp = new Script();
    let t = 100;
    p.teleport(0, 0, 0, yaw);
    inp.hold("forward");
    for (let i = 0; i < 90; i++) {
      const bx = p.pos.x;
      const bz = p.pos.z;
      t += dt;
      p.update(dt, t, inp, 0, 1, false);
      inp.endFrame();
      worst = Math.max(worst, Math.hypot(p.pos.x - bx, p.pos.z - bz));
      if (p.pos.z < -3 && p.pos.z > -12 && p.pos.y + MOVE.standHeight > 2.0 + 1e-3) inside = true;
    }
  }
  check("a run at a step with no room over it stops at it: never more than a frame's stride in a frame, the head never in the box over it", worst < 0.5 && !inside, JSON.stringify({ worstStep: +worst.toFixed(2), inside }));
}

// (Milestone 867) a blink keeps the way you were going; a teleport starts over
{
  world([]);
  const p = player();
  p.teleport(0, 0, 0, 0);
  p.vel.set(3, 1, -10);
  p.blink(0, 0, -26);
  const kept = p.vel.clone();
  p.teleport(0, 0, 0, 0);
  check("a blink keeps your velocity (DASH's momentum), a teleport starts it over", kept.x === 3 && kept.z === -10 && p.vel.length() === 0, JSON.stringify({ kept: kept.toArray() }));
}

// (Milestone 868) the jump that leaves the ship is not a double jump as well
{
  world([]);
  const p = player();
  const inp = new Script();
  let t = 100;
  const tech: string[] = [];
  p.onTech = (name) => tech.push(name);
  p.teleport(0, 0, 0, 0);
  for (let i = 0; i < 30; i++) {
    t += dt;
    p.update(dt, t, inp, 0, 1, false);
    inp.endFrame();
  }
  p.board(0, 400, 0);
  for (let i = 0; i < 30; i++) {
    p.ride(0, 400, i * 0.5);
    t += dt;
    p.update(dt, t, inp, 0, 1, false);
    inp.endFrame();
  }
  inp.hold("jump");
  p.leaveShip(2);
  t += dt;
  p.update(dt, t, inp, 0, 1, false);
  inp.endFrame();
  check("the jump that leaves the ship is not a double jump as well", p.airJumps === 0 && !tech.includes("DOUBLE JUMP"), JSON.stringify({ airJumps: p.airJumps, tech }));
}

// (Milestone 868) a rope gives the double jump back: up to it with the double jump, along it, off it with a zip jump,
// and the jump after is a double jump again
{
  world([]);
  ZIPLINES.push({ a: new THREE.Vector3(0, 6, 0), b: new THREE.Vector3(0, 6, -60) } as unknown as Zipline);
  const p = player();
  const inp = new Script();
  let t = 100;
  const tech: string[] = [];
  p.onTech = (name) => tech.push(name);
  const run = (n: number) => {
    for (let i = 0; i < n; i++) {
      t += dt;
      p.update(dt, t, inp, 0, 1, false);
      inp.endFrame();
    }
  };
  const tap = (a: Action) => {
    inp.hold(a);
    run(1);
    inp.release(a);
  };
  p.teleport(0, 0, 5, 0);
  run(20);
  p.teleport(0, 3.5, -2, 0);
  run(1);
  tap("jump");
  run(6);
  tap("interact");
  run(60);
  const rode = p.onZip;
  tap("jump");
  run(20);
  const before = tech.filter((n) => n === "DOUBLE JUMP").length;
  tap("jump");
  run(2);
  const after = tech.filter((n) => n === "DOUBLE JUMP").length;
  check("a rope gives the double jump back: the jump after a zip jump off it is a double jump", rode && after === before + 1, JSON.stringify({ rode, tech }));
}

// (Milestone 868) a wall run ends in a mantle: a run into a ledge 1.6 m over its feet
{
  world([
    { minX: -2, maxX: -0.5, minZ: -40, maxZ: 10, top: 10 },
    { minX: -2, maxX: 10, minZ: -45, maxZ: -20, top: 2.6 },
  ]);
  const p = player();
  const inp = new Script();
  let t = 100;
  p.teleport(-0.5 + MOVE.radius + 0.05, 1.0, 0, 0);
  p.vel.set(0, 1, -14);
  inp.hold("forward");
  let mantled = 0;
  let onWallMantling = 0;
  for (let i = 0; i < 180; i++) {
    t += dt;
    p.update(dt, t, inp, 0, 1, false);
    inp.endFrame();
    if (p.mantling) {
      mantled++;
      if (p.onWall) onWallMantling++;
    }
  }
  check("a wall run ends in the mantle it runs into", mantled > 0 && onWallMantling === 0, JSON.stringify({ mantled, onWallMantling }));
}

// (Milestone 869) a frame's hitch at speed does not carry the body through a thin wall: at 14 m/s (a slide jump's) at a
// wall 0.25 m thick, one frame of 0.1 s (the game's longest), from twelve points between touching it and a stride short
{
  world([{ minX: -10, maxX: 10, minZ: -5.25, maxZ: -5, top: 6 }]);
  let through = 0;
  for (let k = 0; k < 12; k++) {
    const p = player();
    const inp = new Script();
    inp.hold("forward");
    p.teleport(0, 1, -4.3 - k * 0.025, 0);
    p.vel.set(0, 0, -14);
    p.update(0.1, 100.1, inp, 0, 1, false);
    inp.endFrame();
    if (p.pos.z < -5.25) through++;
  }
  check("a 0.1 s frame at 14 m/s does not carry the body through a 0.25 m wall", through === 0, `${through} of 12 through`);
}

// (Milestone 896) a wall run turns into an inside corner at any frame rate: an L of two walls, a run at 15 m/s along the
// first, forty starts a little apart, at 30, 60 and 144 fps. It turned 7 times of 40 at 30 fps and 37 at 144
{
  world([
    { minX: -2, maxX: -0.5, minZ: -40, maxZ: 10, top: 10 },
    { minX: -2, maxX: 10, minZ: -45, maxZ: -40, top: 10 },
  ]);
  const turned: number[] = [];
  for (const fps of [30, 60, 144]) {
    const step = 1 / fps;
    let n = 0;
    for (let k = 0; k < 40; k++) {
      const p = player();
      const inp = new Script();
      let t = 100;
      const tech: string[] = [];
      p.onTech = (name) => tech.push(name);
      p.teleport(-0.5 + MOVE.radius + 0.05, 2, k * 0.013, 0);
      p.vel.set(0, 1, -15);
      inp.hold("forward");
      for (let i = 0; i < fps * 4 && !tech.includes("WALL TURN"); i++) {
        t += step;
        p.update(step, t, inp, 0, 1, false);
        inp.endFrame();
      }
      if (tech.includes("WALL TURN")) n++;
    }
    turned.push(n);
  }
  check("a wall run turns into an inside corner at 30, 60 and 144 fps alike (35 of 40 at least at each)", turned.every((n) => n >= 35), JSON.stringify({ at30: turned[0], at60: turned[1], at144: turned[2] }));
}

// (Milestone 891) LEAP's glide falls as the dive's glide does and lands softly, with nothing of the dropship's dive
{
  world([]);
  const p = player();
  const inp = new Script();
  let t = 100;
  p.teleport(0, 16, 0, 0);
  p.gliding = true;
  let fell = 0;
  let wasDropping = false;
  for (let i = 0; i < 60 * 20 && !p.onGround; i++) {
    const y = p.pos.y;
    t += dt;
    p.update(dt, t, inp, 0, 1, false);
    inp.endFrame();
    fell = Math.max(fell, (y - p.pos.y) / dt);
    if (p.dropping) wasDropping = true;
  }
  check("a leap's glide falls no faster than the dive's glide (squad.json dive.glideFall), lands, and is over, with the dropship's dive never on", p.onGround && !p.gliding && !wasDropping && fell <= squadCfg.dive.glideFall + 0.5, JSON.stringify({ landed: p.onGround, gliding: p.gliding, wasDropping, fastest: +fell.toFixed(1) }));
}

// (Milestone 931) a dive steered into a roof's edge mantles up: that is a landing, where `dropping` stayed on and the gun
// stayed away and the trigger locked on the roof until the next jump
{
  world([{ minX: -15, maxX: 15, minZ: -40, maxZ: -10, top: 20, base: 0 }]);
  const inp = new Script();
  let mantled = 0;
  let stuck = 0;
  for (let y0 = 22; y0 <= 34; y0 += 0.5) {
    for (const pitch of [-5, -20, -35]) {
      const p = player();
      p.beginDrop(0, y0, 0, 0);
      p.pitch = pitch;
      let t = 100;
      let rose = false;
      inp.hold("forward");
      for (let i = 0; i < 1200; i++) {
        t += dt;
        p.update(dt, t, inp, 0, 1, false);
        inp.endFrame();
        if (p.mantling) rose = true;
        if (p.onGround && !p.mantling) break;
      }
      // a second stood still on the roof: walking on, the far end's fall would end it
      inp.release("forward");
      for (let i = 0; i < 60; i++) {
        t += dt;
        p.update(dt, t, inp, 0, 1, false);
        inp.endFrame();
      }
      if (rose) mantled++;
      if (rose && p.dropping) stuck++;
    }
  }
  check("a dive that ends in a mantle onto a roof is a landing", mantled > 0 && stuck === 0, JSON.stringify({ mantled, stuck }));
}

// (Milestone 991, from a review of the movement) each on its own few boxes
{
  const run = (p: Player, inp: Script, t: { at: number }, n: number, each?: () => void): void => {
    for (let i = 0; i < n; i++) {
      t.at += dt;
      p.update(dt, t.at, inp, 0, 1, false);
      inp.endFrame();
      each?.();
    }
  };
  // through a ceiling: a jump and W under a floor, standing and crouched
  let through = 0;
  for (const base of [2.6, 2.8, 3.0]) {
    for (const crouch of [false, true]) {
      world([{ minX: -30, maxX: 30, minZ: -30, maxZ: 30, base, top: base + 0.3 }]);
      const p = player();
      const inp = new Script();
      const t = { at: 100 };
      p.teleport(0, 0, 0, 0);
      run(p, inp, t, 6);
      if (crouch) {
        inp.hold("crouch");
        run(p, inp, t, 27);
      }
      inp.hold("forward");
      run(p, inp, t, 18);
      inp.hold("jump");
      run(p, inp, t, 1);
      inp.release("jump");
      let top = 0;
      run(p, inp, t, 90, () => void (top = Math.max(top, p.pos.y)));
      if (top >= base) through++;
    }
  }
  check("a jump and W under a floor stays under it, standing or crouched", through === 0, `${through} of 6 went through`);
  world([{ minX: -3, maxX: 3, minZ: -60, maxZ: -1.5, top: 2 }]);
  const ledge = player();
  const li = new Script();
  const lt = { at: 100 };
  ledge.teleport(0, 0, -0.9, 0);
  run(ledge, li, lt, 6);
  li.hold("forward");
  li.hold("jump");
  run(ledge, li, lt, 1);
  li.release("jump");
  run(ledge, li, lt, 90);
  check("a ledge over your jump still mantles", ledge.pos.y > 1.9, `feet at ${ledge.pos.y.toFixed(2)}`);

  // a body pushed out to a face on a line that rounds is not still in it: the next axis then "hit" that wall and threw you along it
  world([{ minX: -4, maxX: -3, minZ: 575, maxZ: 580, top: 6 }]);
  const pushed = (player() as unknown as { overlapping(x: number, z: number, r: number): unknown[] }).overlapping(-4 - MOVE.radius, 577, MOVE.radius).length;
  check("a body at a wall's face on a rounding line is not in the wall", pushed === 0, `${pushed} boxes`);

  // a dive into a tall wall is not a climb, and a glide along one is no wall run
  world([{ minX: -30, maxX: 30, minZ: -6, maxZ: -2, top: 300 }]);
  const dive = player();
  const di = new Script();
  const dt0 = { at: 100 };
  dive.beginDrop(0, 200, 0, 0);
  di.hold("forward");
  let held = 0;
  run(dive, di, dt0, 480, () => {
    if (dive.onWall || dive.climbing) held++;
  });
  check("a dive into a tall wall neither climbs it nor runs along it", held === 0 && dive.pos.y < 200 - 60, `${held} frames on it, at ${dive.pos.y.toFixed(0)} m after 8 s`);

  // in a corner the wall you face is the one you climb
  world([
    { minX: -3, maxX: 3, minZ: -5, maxZ: -1, top: 12 },
    { minX: 0.5, maxX: 2, minZ: -2, maxZ: 3, top: 12 },
  ]);
  const corner = player();
  const ci = new Script();
  const ct = { at: 100 };
  corner.teleport(0.5 - MOVE.radius - 0.05, 0, 1, 0);
  run(corner, ci, ct, 6);
  ci.hold("forward");
  let climbed = false;
  run(corner, ci, ct, 90, () => void (climbed ||= corner.climbing));
  check("in a corner the wall you face climbs", climbed);

  // a sunken floor's edge is a wall from inside it
  world([]);
  FLOORS.push({ minX: -10, maxX: 10, minZ: -10, maxZ: 10, y: -13 });
  const pit = player();
  const pi = new Script();
  const pt = { at: 100 };
  pit.teleport(8, -13, 0, -90);
  run(pit, pi, pt, 6);
  pi.hold("forward");
  run(pit, pi, pt, 60);
  FLOORS.length = 0;
  check("off a sunken floor's edge you stay down", pit.pos.y < -12 && pit.pos.x < 10.5, `at ${pit.pos.x.toFixed(2)}, ${pit.pos.y.toFixed(2)}`);

  // a rope grabbed in a dive ends the dive
  world([]);
  ZIPLINES.push({ a: new THREE.Vector3(0, 40, 0), b: new THREE.Vector3(0, 40, -60) } as unknown as Zipline);
  const rope = player();
  const ri = new Script();
  const rt = { at: 100 };
  rope.beginDrop(0, 40, -20, 0);
  run(rope, ri, rt, 8);
  ri.hold("interact");
  run(rope, ri, rt, 1);
  ri.release("interact");
  run(rope, ri, rt, 10);
  check("a rope grabbed in a dive ends the dive", rope.onZip && !rope.dropping, `on it ${rope.onZip}, diving ${rope.dropping}`);

  // a wall run does not board the ship, and a LEAP leaves the wall
  world([{ minX: -2, maxX: -0.5, minZ: -80, maxZ: 10, top: 10 }]);
  const wall = player();
  const wi = new Script();
  const wt = { at: 100 };
  wall.teleport(-0.5 + MOVE.radius + 0.05, 1, 0, 0);
  wall.vel.set(0, 1, -14);
  wi.hold("forward");
  run(wall, wi, wt, 12);
  const running = wall.onWall;
  wall.impulse(6, 8, 0);
  run(wall, wi, wt, 2);
  const leapt = !wall.onWall;
  wall.teleport(-0.5 + MOVE.radius + 0.05, 1, -10, 0);
  wall.vel.set(0, 1, -14);
  run(wall, wi, wt, 20);
  const again = wall.onWall;
  wall.teleport(0, 100, 0, 0);
  check("a LEAP leaves a wall run, and a teleport takes it with it", running && leapt && again && !wall.onWall, JSON.stringify({ running, leapt, again, after: wall.onWall }));

  // a double tap is not the double jump gone
  world([]);
  const twice = player();
  const ti = new Script();
  const tt = { at: 100 };
  const said: string[] = [];
  twice.onTech = (name) => said.push(name);
  twice.teleport(0, 0, 0, 0);
  run(twice, ti, tt, 12);
  const press = (): void => {
    ti.hold("jump");
    run(twice, ti, tt, 1);
    ti.release("jump");
    run(twice, ti, tt, 1);
  };
  press();
  press();
  const spent = said.filter((n) => n === "DOUBLE JUMP").length;
  run(twice, ti, tt, 12);
  press();
  check("a double tap of jump leaves the double jump for later", spent === 0 && said.filter((n) => n === "DOUBLE JUMP").length === 1, `${spent} spent on the tap`);
}

// (Milestone 1002) a flight of stairs at a low frame rate, and through one long frame: the real flight's treads, 0.25 m deep
// and 0.171 m high (the movement review measured them). A frame's move was tested at the feet it started from, so in one
// 0.1 s frame at a sprint the third tread was a wall, and at a steady 15 fps every frame was such a frame
{
  const TREAD = 0.25;
  const RISE = 0.171;
  const N = 30;
  const boxes: Box[] = [];
  for (let i = 0; i < N; i++) boxes.push({ minX: -3, maxX: 3, minZ: -2 - (i + 1) * TREAD, maxZ: -2 - i * TREAD, top: (i + 1) * RISE });
  boxes.push({ minX: -3, maxX: 3, minZ: -30, maxZ: -2 - N * TREAD, top: N * RISE });
  world(boxes);
  const climb = (frames: number[]): { y: number; z: number; least: number } => {
    const p = player();
    const inp = new Script();
    let t = 100;
    p.teleport(0, 0, 0, 0);
    inp.hold("forward");
    let least = Infinity;
    for (const f of frames) {
      t += f;
      p.update(f, t, inp, 0, 1, false);
      inp.endFrame();
      // (its speed while on the flight, past the first metre of it)
      if (p.pos.z < -3 && p.pos.z > -2 - N * TREAD + 0.5) least = Math.min(least, Math.hypot(p.vel.x, p.vel.z));
    }
    return { y: p.pos.y, z: p.pos.z, least };
  };
  const top = N * RISE;
  const at15 = climb(Array.from({ length: 60 }, () => 1 / 15));
  // a steady 60 fps, with one 0.1 s frame as the body reaches the flight's third metre
  const hitch = climb(Array.from({ length: 240 }, (_, i) => (i === 40 ? 0.1 : 1 / 60)));
  const sprint = climb(Array.from({ length: 240 }, () => 1 / 60));
  check(
    "up a flight of stairs at a steady 15 fps, and through a 0.1 s frame at 60, without stopping on it",
    Math.abs(at15.y - top) < 0.05 && at15.z < -2 - N * TREAD && Math.abs(hitch.y - top) < 0.05 && hitch.least > sprint.least * 0.5,
    `15 fps: at ${at15.y.toFixed(2)} m of ${top.toFixed(2)}, slowest ${at15.least.toFixed(1)} m/s; the hitch: slowest ${hitch.least.toFixed(1)} m/s, at 60 fps ${sprint.least.toFixed(1)}`,
  );
}

console.log(fails === 0 ? "\nSK MOVES PASS" : `\nSK MOVES FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
