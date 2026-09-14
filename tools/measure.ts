// What each technique reaches, measured on the real controller, so the
// advanced course's gaps and ledges are built from numbers. Not a test: it
// prints. Run: npx tsx tools/measure.ts
import * as THREE from "three";
import { Player, type MoveInput } from "../src/game/player";
import type { Action } from "../src/game/input";
import { RANGE_SOLIDS } from "../src/game/range";
import { ZIPLINES } from "../src/game/traversal";
import { HU, MOVE } from "../src/game/movement";

const FPS = 144;
const DT = 1 / FPS;
const hu = (m: number) => m / HU;

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
type SolidIn = { minX: number; maxX: number; minZ: number; maxZ: number; top: number; base?: number };
class Sim {
  p = new Player({ minX: -500, maxX: 500, minZ: -500, maxZ: 500 });
  in = new Script();
  t = 1000;
  constructor(solids: SolidIn[] = [], zips: Array<[[number, number, number], [number, number, number]]> = []) {
    RANGE_SOLIDS.length = 0;
    for (const s of solids) RANGE_SOLIDS.push({ ...s, base: s.base ?? 0 });
    ZIPLINES.length = 0;
    for (const [a, b] of zips) ZIPLINES.push({ a: new THREE.Vector3(...a), b: new THREE.Vector3(...b) });
  }
  run(seconds: number, each?: () => void): void {
    const n = Math.round(seconds * FPS);
    for (let i = 0; i < n; i++) {
      each?.();
      this.t += DT;
      this.p.update(DT, this.t, this.in, 0, 1, false);
      this.in.endFrame();
    }
  }
  frame(): void {
    this.run(DT);
  }
  until(cond: () => boolean, max = 5): number {
    const start = this.t;
    while (!cond() && this.t - start < max) this.frame();
    return this.t - start;
  }
}
const yawFacing = (x: number, z: number) => (Math.atan2(-x, -z) * 180) / Math.PI;
void yawFacing;
const FLOOR = { minX: -100, maxX: 100, minZ: -100, maxZ: 100, top: 0, base: -1 };
const say = (label: string, v: string) => console.log(`  ${label.padEnd(58)} ${v}`);

// a flat run along +z; returns the landing z after the jump
function flight(s: Sim): { dist: number; peak: number; air: number } {
  const z0 = s.p.pos.z;
  const y0 = s.p.pos.y;
  let peak = y0;
  const air = s.until(() => {
    peak = Math.max(peak, s.p.pos.y);
    return s.p.onGround;
  }, 4);
  return { dist: s.p.pos.z - z0, peak: peak - y0, air };
}

console.log("\nFlat jumps, sprinting along +z");
{
  const s = new Sim([FLOOR]);
  s.p.yaw = 180;
  s.in.hold("forward");
  s.in.tap("sprint");
  s.run(2);
  s.in.tap("jump");
  s.frame();
  const f = flight(s);
  say("sprint jump: distance m / peak m / air s", `${f.dist.toFixed(2)} / ${f.peak.toFixed(2)} / ${f.air.toFixed(2)}`);
}
{
  const s = new Sim([FLOOR]);
  s.p.yaw = 180;
  s.in.hold("forward");
  s.in.tap("sprint");
  s.run(2);
  s.in.hold("crouch");
  s.run(0.05);
  s.in.tap("jump");
  s.frame();
  s.in.release("crouch");
  const sp = hu(s.p.speed);
  const f = flight(s);
  say("slide jump: distance m / peak m / speed hu/s", `${f.dist.toFixed(2)} / ${f.peak.toFixed(2)} / ${sp.toFixed(0)}`);
}

console.log("\nSuperglide off a 2.5 m ledge (mantle it sprinting, jump then crouch at the end)");
for (const landY of [0, 1.0, 1.4, 2.5]) {
  const LEDGE = { minX: -12, maxX: 12, minZ: 0, maxZ: 3, top: 2.5 };
  const s = new Sim([FLOOR, LEDGE]);
  s.p.pos.set(0, 0, -4);
  s.p.yaw = 180;
  s.in.hold("forward");
  s.in.tap("sprint");
  s.run(1.0);
  s.in.tap("jump");
  s.until(() => s.p.stance === "mantle", 3);
  // find the mantle's end by probing a copy is awkward; step until 0.1 s remain
  const mt = (s.p as unknown as { mantle: { started: number; duration: number } }).mantle;
  const endAt = mt.started + mt.duration;
  s.until(() => s.t >= endAt - 0.1, 2);
  s.in.tap("jump");
  s.frame();
  s.in.tap("crouch");
  s.frame();
  const z0 = 3; // the ledge's far edge
  const y0 = 2.5;
  let peak = 0;
  const air = s.until(() => {
    peak = Math.max(peak, s.p.pos.y);
    return s.p.pos.y <= landY;
  }, 4);
  say(`superglide, landing at y ${landY}: z past the ledge edge / peak / air`, `${(s.p.pos.z - z0).toFixed(2)} m / ${(peak - y0).toFixed(2)} / ${air.toFixed(2)} s  (${hu(s.p.speed).toFixed(0)} hu/s)`);
}

console.log("\nLedge heights: jump + mantle, sprinting into the wall");
for (const h of [3.2, 3.4, 3.5, 3.6, 3.8]) {
  const s = new Sim([FLOOR, { minX: -12, maxX: 12, minZ: 2, maxZ: 8, top: h }]);
  s.p.pos.set(0, 0, -3);
  s.p.yaw = 180;
  s.in.hold("forward");
  s.in.tap("sprint");
  s.run(0.6);
  s.in.tap("jump");
  s.until(() => s.p.onGround && s.p.pos.y > h - 0.1, 4);
  say(`ledge ${h} m: on top?`, s.p.pos.y > h - 0.1 ? "yes" : `no (feet ${s.p.pos.y.toFixed(2)}, ${s.p.stance})`);
}

console.log("\nWallbounce onto a ledge behind you: run at wall A, bounce, land on ledge B opposite");
// wall A at z 2 (face at z=2), ledge B behind the player at z <= -d
for (const [h, d] of [
  [3.6, 3],
  [3.8, 3],
  [4.0, 3],
  [4.2, 3],
  [4.0, 4],
  [4.2, 4],
] as const) {
  const A = { minX: -12, maxX: 12, minZ: 2, maxZ: 3, top: 9 };
  const B = { minX: -12, maxX: 12, minZ: -20, maxZ: -d, top: h };
  const s = new Sim([FLOOR, A, B]);
  // start clear of ledge B's footprint (radius 0.41), sprint at the wall
  s.p.pos.set(0, 0, -d + 0.6);
  s.p.yaw = 180;
  s.in.hold("forward");
  s.in.tap("sprint");
  s.until(() => s.p.pos.z > 2 - 0.41 - 1.9, 3);
  s.in.release("forward");
  s.in.tap("jump");
  s.until(() => s.p.climbing, 1.5);
  s.until(() => hu(s.p.pos.y) < 44, 1);
  const from = s.p.pos.y;
  // turn to face the ledge as you jump (the bounce direction is the wall's, not the look)
  s.in.tap("jump");
  s.frame();
  s.p.yaw = 0;
  s.in.hold("forward");
  s.until(() => s.p.onGround, 4);
  say(`ledge ${h} m, ${d} m from the wall (bounced from ${from.toFixed(2)} m): on top?`, s.p.pos.y > h - 0.1 ? "yes" : `no (feet ${s.p.pos.y.toFixed(2)} at z ${s.p.pos.z.toFixed(2)}, ${s.p.stance})`);
}

console.log("\nWall push: climb wall A to the top of the climb space, jump off, land on ledge B opposite");
for (const [h, d] of [
  [4.0, 3],
  [4.5, 3],
  [5.0, 3],
  [5.5, 3],
  [5.0, 4],
] as const) {
  const A = { minX: -12, maxX: 12, minZ: 2, maxZ: 3, top: 12 };
  const B = { minX: -12, maxX: 12, minZ: -20, maxZ: -d, top: h };
  const s = new Sim([FLOOR, A, B]);
  s.p.pos.set(0, 0, -d + 0.6);
  s.p.yaw = 180;
  s.in.hold("forward");
  s.until(() => s.p.pos.z > 2 - 0.41 - 0.3, 3);
  s.in.tap("jump");
  s.until(() => s.p.climbing, 1.5);
  // climb until near the climb space top (147 hu = 3.73 m) then jump
  s.until(() => s.p.pos.y > 3.3, 3);
  const from = s.p.pos.y;
  s.in.tap("jump");
  s.frame();
  s.p.yaw = 0;
  s.until(() => s.p.onGround, 4);
  say(`ledge ${h} m, ${d} m from the wall (pushed from ${from.toFixed(2)} m): on top?`, s.p.pos.y > h - 0.1 ? "yes" : `no (feet ${s.p.pos.y.toFixed(2)} at z ${s.p.pos.z.toFixed(2)}, ${s.p.stance})`);
}

console.log("\nSuperjump off a vertical zipline, onto a ledge beside it");
for (const [h, d] of [
  [3.0, 2],
  [3.5, 2],
  [4.0, 2],
  [4.5, 2],
  [5.0, 2],
] as const) {
  const LEDGE = { minX: -12, maxX: 12, minZ: -20, maxZ: -d, top: h };
  const s = new Sim([FLOOR, LEDGE], [[[0, 0.3, 0.6], [0, 8, 0.6]]]);
  s.p.pos.set(0, 0, 0);
  s.p.yaw = 180; // face +z at the rope
  s.frame();
  s.in.tap("interact");
  s.frame();
  s.in.tap("jump");
  s.frame();
  s.in.tap("jump");
  s.frame();
  s.p.yaw = 0; // now toward the ledge
  s.in.hold("forward");
  let peak = 0;
  s.until(() => {
    peak = Math.max(peak, s.p.pos.y);
    return s.p.onGround;
  }, 5);
  say(`ledge ${h} m, ${d} m away (peak ${peak.toFixed(2)} m): on top?`, s.p.pos.y > h - 0.1 ? "yes" : `no (feet ${s.p.pos.y.toFixed(2)} z ${s.p.pos.z.toFixed(2)})`);
}

console.log("\nLurch: slide jump along +z, tap right 0.1 s in, hold right: where do you land");
{
  const s = new Sim([FLOOR]);
  s.p.yaw = 180;
  s.in.hold("forward");
  s.in.tap("sprint");
  s.run(2);
  s.in.hold("crouch");
  s.run(0.05);
  s.in.tap("jump");
  s.frame();
  s.in.release("crouch");
  const x0 = s.p.pos.x;
  const z0 = s.p.pos.z;
  s.run(0.1);
  s.in.release("forward");
  s.in.hold("right");
  s.until(() => s.p.onGround, 4);
  say("landing offset: right m / forward m", `${(s.p.pos.x - x0).toFixed(2)} / ${(s.p.pos.z - z0).toFixed(2)}`);
  const t = new Sim([FLOOR]);
  t.p.yaw = 180;
  t.in.hold("forward");
  t.in.tap("sprint");
  t.run(2);
  t.in.hold("crouch");
  t.run(0.05);
  t.in.tap("jump");
  t.frame();
  t.in.release("crouch");
  const tx0 = t.p.pos.x;
  const tz0 = t.p.pos.z;
  t.until(() => t.p.onGround, 4);
  say("same jump, no lurch: right m / forward m", `${(t.p.pos.x - tx0).toFixed(2)} / ${(t.p.pos.z - tz0).toFixed(2)}`);
}

console.log("\nDrops: fall stun and landing slides");
for (const h of [4, 5, 6, 7, 8]) {
  const s = new Sim([FLOOR]);
  s.p.pos.set(0, h, 0);
  s.p.yaw = 180;
  s.p.vel.set(0, 0, 4);
  s.in.hold("forward");
  s.in.hold("crouch");
  s.until(() => s.p.onGround, 4);
  const st0 = s.p.stance;
  s.run(0.1);
  say(`drop ${h} m holding crouch (on landing: ${st0}, 0.1 s later): stunned? / stance / speed hu/s`, `${s.p.stunned} / ${s.p.stance} / ${hu(s.p.speed).toFixed(0)}`);
}
console.log(`\n(mantle height ${(MOVE.mantleHeight).toFixed(2)} m, climb space ${(MOVE.climbSpaceHeight).toFixed(2)} m, jump ${(MOVE.jumpHeight).toFixed(2)} m)`);
