// The WALL hack's walls (src/config/wall.json, hacks.json wall, src/game/walls.ts).
//
// A wall put up in play is a real solid, so what stops at any wall stops at
// it: a shot through where it stands is stopped, one past its end is not, and
// its box is the box round it however it is turned. It comes down when its
// seconds are up, and takes its solid with it, so nothing invisible is left
// standing in the world.
//
// Run on its own: npx tsx tools/checks/walls.ts.
import * as THREE from "three";
import hackCfg from "../../src/config/hacks.json";
import { RANGE_SOLIDS } from "../../src/game/range";
import { solidHit } from "../../src/game/projectile";
import { WALL, WALLS, clearWalls, putWall, stepWalls } from "../../src/game/walls";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const W = WALL;
/** how long one stands (the hack's) */
const SECONDS = hackCfg.wall.seconds;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const parent = new THREE.Group();
/** how far a shot from `from` toward +z gets */
const shot = (from: THREE.Vector3, far = 40): number => solidHit(from, V(0, 0, 1), far);

console.log("The WALL hack's walls");
{
  RANGE_SOLIDS.length = 0;
  clearWalls();
  const before = shot(V(0, 1.2, -6));
  // a wall across the shot, at the world's origin, square to it (as one put up in front of a player is)
  putWall(parent, 0, 0, 0, 0, 100, SECONDS);
  const through = shot(V(0, 1.2, -6));
  const past = shot(V(W.width, 1.2, -6));
  const over = shot(V(0, W.height + 0.6, -6));
  check(`a wall ${W.width} m wide stops a shot through where it stands`, before > 39 && through < 6.2 && through > 5.5, `${through.toFixed(2)} m`);
  check("a shot past its end, or over its top, goes on", past > 39 && over > 39, `${past.toFixed(1)} m and ${over.toFixed(1)} m`);
  check("its solid is in the world once", RANGE_SOLIDS.length === 1 && WALLS.length === 1);
  // its seconds up: the wall and its solid are gone
  stepWalls(100 + SECONDS - 0.1);
  const still = RANGE_SOLIDS.length;
  stepWalls(100 + SECONDS + 0.1);
  check(`the wall stands its ${SECONDS} s and then goes, solid and all`, still === 1 && RANGE_SOLIDS.length === 0 && WALLS.length === 0 && shot(V(0, 1.2, -6)) > 39);
}
{
  // (Milestone 894) turned 45 degrees: its collision follows the panel, short boxes along it, the whole panel in them and
  // nothing a metre off its face. As one box round it, it stopped rounds 2.3 m in front of the panel and behind it
  RANGE_SOLIDS.length = 0;
  clearWalls();
  const w = putWall(parent, 0, 0, 0, 45, 0, SECONDS);
  const inAny = (x: number, z: number) => w.solids.some((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);
  const along = (t: number): [number, number] => [Math.cos(Math.PI / 4) * t, -Math.sin(Math.PI / 4) * t];
  const ends = [-W.width / 2 + 0.05, 0, W.width / 2 - 0.05].every((t) => inAny(...along(t)));
  // a metre off the panel's face, along its normal (sin, cos at 45 degrees), at its middle and toward each end
  const off = [-1.5, 0, 1.5].some((t) => { const [x, z] = along(t); return inAny(x + Math.sin(Math.PI / 4), z + Math.cos(Math.PI / 4)); });
  check("a wall turned 45 degrees collides along its panel: the whole panel in its boxes, nothing a metre off its face", ends && !off && w.solids.length > 1, JSON.stringify({ ends, off, boxes: w.solids.length }));
  check("and it stands on the ground, its own height tall", w.solids.every((s) => Math.abs(s.base - 0) < 1e-9 && Math.abs(s.top - W.height) < 1e-9));
  clearWalls();
  check("a match ending takes every wall and its solid", WALLS.length === 0 && RANGE_SOLIDS.length === 0);
}

console.log(fails === 0 ? "\nWALLS PASS" : `\nWALLS FAIL (${fails})`);
export const wallsFails = fails;
if (process.argv[1]?.endsWith("walls.ts")) process.exit(fails === 0 ? 0 : 1);
