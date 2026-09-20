// PAINT: the throwable the movement chain is built on (src/config/paint.json,
// src/game/throwables.ts, docs/PLAN_MOVEMENT_CHAIN.md).
//
// What has to hold: a patch is found from where your feet are and nowhere
// else (not through a floor, not on a wall), it dries on time, and the boost
// it hands you outlives the ground it came from, which is the whole mechanic.
// The jump boost is all or nothing inside its grace, so a jump you meant
// counts and a jump a second later does not. And nothing here may change what
// the movement does with no paint down: every Apex number in
// docs/MOVEMENT_AUDIT.md is measured with none.
//
// Run on its own: npx tsx tools/checks/paint.ts.
import * as THREE from "three";
import { makePaint, paintUnder, PAINT, type Paint } from "../../src/game/throwables";
import { Player } from "../../src/game/player";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
const near = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) <= eps;
const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

console.log("PAINT: the patch, and what you carry off it");
{
  const floor = makePaint(0, true, "speed", V(0, 0, 0), V(0, 1, 0), 100);
  const wall = makePaint(0, true, "jump", V(10, 1.5, 0), V(-1, 0, 0), 100);
  check("a bomb on the ground paints a floor patch, one on a wall a wall patch", !floor.wall && wall.wall && floor.radius === PAINT.radius.floor && wall.radius === PAINT.radius.wall, `${floor.radius} m and ${wall.radius} m`);
  check("and it dries on time", near(floor.until - 100, PAINT.life.seconds), `${PAINT.life.seconds} s`);
  const paints: Paint[] = [floor, wall];
  check("standing in it finds it", paintUnder(paints, V(1, 0, 1))?.kind === "speed");
  check("standing a step outside it does not", paintUnder(paints, V(PAINT.radius.floor + 0.3, 0, 0)) === null, `${PAINT.radius.floor} m across`);
  check("a floor above it is not in it: paint on a roof is not paint in the room below", paintUnder(paints, V(0, 3, 0)) === null);
  check("and a wall patch is never underfoot", paintUnder([wall], V(10, 1.5, 0)) === null);
  const older = makePaint(0, true, "speed", V(0, 0, 0), V(0, 1, 0), 90);
  const newer = makePaint(0, true, "jump", V(0, 0, 0), V(0, 1, 0), 101);
  check("two patches over each other: the newer one is the one you are standing in", paintUnder([older, newer], V(0, 0, 0))?.kind === "jump");
}
{
  const p = new Player({ minX: -50, maxX: 50, minZ: -50, maxZ: 50 });
  const t0 = 10;
  check("with no paint down, nothing is boosted at all", p.paintSpeed(t0) === 1 && p.paintJump(t0) === 1);
  p.onPaint("speed", t0);
  check("on the orange, the full boost", near(p.paintSpeed(t0), PAINT.speed.mul), `x${PAINT.speed.mul}`);
  const half = p.paintSpeed(t0 + PAINT.speed.carry / 2);
  check("off it, the boost decays rather than ending: half way through the carry it is half of it", Math.abs(half - (1 + (PAINT.speed.mul - 1) / 2)) < 1e-6, `x${half.toFixed(3)}`);
  check("and after the carry it is gone", p.paintSpeed(t0 + PAINT.speed.carry + 0.01) === 1, `${PAINT.speed.carry} s`);
  // this is the chain: a slide off the end of a patch still has most of it
  const atSlide = p.paintSpeed(t0 + 0.25);
  check("a quarter of a second off the paint, into a slide, still carries most of it", atSlide > 1 + (PAINT.speed.mul - 1) * 0.7, `x${atSlide.toFixed(3)}`);
  p.onPaint("jump", t0);
  check("the blue is all or nothing: a jump inside its grace goes higher", near(p.paintJump(t0 + PAINT.jump.grace - 0.01), PAINT.jump.mul), `x${PAINT.jump.mul}`);
  check("and a jump after it is an ordinary jump", p.paintJump(t0 + PAINT.jump.grace + 0.01) === 1, `${PAINT.jump.grace} s of grace`);
}
{
  // the boost has to be worth chaining and has to stay inside Apex's air rules
  const sprint = 260;
  const boosted = sprint * PAINT.speed.mul;
  check("a boosted sprint is quick but nowhere near the lurch cap, so air control is Apex's", boosted > sprint * 1.2 && boosted < 1200, `${boosted.toFixed(0)} hu/s against the 1200 cap`);
  check("the carry is long enough to reach a jump and short enough not to be a state you live in", PAINT.speed.carry >= 0.6 && PAINT.speed.carry <= 2, `${PAINT.speed.carry} s`);
  check("a jump boost is a boost, not a launch", PAINT.jump.mul > 1.2 && PAINT.jump.mul <= 2, `x${PAINT.jump.mul}`);
}

console.log(fails === 0 ? "\nPAINT PASS" : `\nPAINT FAIL (${fails})`);
export const paintFails = fails;
if (process.argv[1]?.endsWith("paint.ts")) process.exit(fails === 0 ? 0 : 1);
