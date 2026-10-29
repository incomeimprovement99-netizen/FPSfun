// SpeedKills' movement in the places it went wrong (Milestones 866 to 868), with the real Player over a few boxes. Run in
// a process of its own with the game named (verify does: GAME=speedkills npx tsx tools/checks/sk-moves.ts), since the
// movement reads its numbers as it loads and the boxes here are the whole world.
import * as THREE from "three";
import { Player, type MoveInput } from "../../src/game/player";
import type { Action } from "../../src/game/input";
import { RANGE_SOLIDS } from "../../src/game/range";
import { ZIPLINES, type Zipline } from "../../src/game/traversal";
import { MOVE } from "../../src/game/movement";
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

console.log(fails === 0 ? "\nSK MOVES PASS" : `\nSK MOVES FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
