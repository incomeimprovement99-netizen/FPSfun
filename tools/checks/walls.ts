// WARD's walls (src/config/kits.json ward, src/game/walls.ts).
//
// A wall put up in play is a real solid, so what stops at any wall stops at
// it: a shot through where it stands is stopped, one past its end is not, and
// its box is the box round it however it is turned. It comes down when its
// seconds are up, and takes its solid with it, so nothing invisible is left
// standing in the world.
//
// Run on its own: npx tsx tools/checks/walls.ts.
import * as THREE from "three";
import { KITS } from "../../src/game/abilities";
import { RANGE_SOLIDS } from "../../src/game/range";
import { solidHit } from "../../src/game/projectile";
import { WALLS, clearWalls, putWall, stepWalls } from "../../src/game/walls";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const W = KITS.ward;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const parent = new THREE.Group();
/** how far a shot from `from` toward +z gets */
const shot = (from: THREE.Vector3, far = 40): number => solidHit(from, V(0, 0, 1), far);

console.log("WARD's walls");
{
  RANGE_SOLIDS.length = 0;
  clearWalls();
  const before = shot(V(0, 1.2, -6));
  // a wall across the shot, at the world's origin, square to it (as one put up in front of a player is)
  putWall(parent, 0, 0, 0, 0, 100);
  const through = shot(V(0, 1.2, -6));
  const past = shot(V(W.width, 1.2, -6));
  const over = shot(V(0, W.height + 0.6, -6));
  check(`a wall ${W.width} m wide stops a shot through where it stands`, before > 39 && through < 6.2 && through > 5.5, `${through.toFixed(2)} m`);
  check("a shot past its end, or over its top, goes on", past > 39 && over > 39, `${past.toFixed(1)} m and ${over.toFixed(1)} m`);
  check("its solid is in the world once", RANGE_SOLIDS.length === 1 && WALLS.length === 1);
  // its seconds up: the wall and its solid are gone
  stepWalls(100 + W.tactical.seconds - 0.1);
  const still = RANGE_SOLIDS.length;
  stepWalls(100 + W.tactical.seconds + 0.1);
  check(`the wall stands its ${W.tactical.seconds} s and then goes, solid and all`, still === 1 && RANGE_SOLIDS.length === 0 && WALLS.length === 0 && shot(V(0, 1.2, -6)) > 39);
}
{
  // turned 45 degrees: the box round it is wider than the panel and no thinner
  RANGE_SOLIDS.length = 0;
  clearWalls();
  const w = putWall(parent, 0, 0, 0, 45, 0);
  const s = w.solid;
  const diag = (W.width + W.thick) / Math.SQRT2;
  check("a wall turned 45 degrees has the box round it, not a box the panel pokes out of", Math.abs(s.maxX - s.minX - diag) < 0.05 && Math.abs(s.maxZ - s.minZ - diag) < 0.05, `${(s.maxX - s.minX).toFixed(2)} by ${(s.maxZ - s.minZ).toFixed(2)} m`);
  check("and it stands on the ground, its own height tall", Math.abs(s.base - 0) < 1e-9 && Math.abs(s.top - W.height) < 1e-9);
  clearWalls();
  check("a match ending takes every wall and its solid", WALLS.length === 0 && RANGE_SOLIDS.length === 0);
}
{
  // the ultimate's horseshoe: its walls all stand, and each has its own solid
  RANGE_SOLIDS.length = 0;
  clearWalls();
  for (let i = 0; i < W.ult.count; i++) putWall(parent, i * 6, 0, 0, 0, 0, W.ult.seconds);
  check(`${W.ult.count} walls of the horseshoe stand for its ${W.ult.seconds} s, each with its solid`, WALLS.length === W.ult.count && RANGE_SOLIDS.length === W.ult.count && WALLS.every((w) => Math.abs(w.until - W.ult.seconds) < 1e-9));
  stepWalls(W.tactical.seconds + 0.1);
  check("and they are still up after a plain wall's time, because theirs is longer", WALLS.length === W.ult.count);
  clearWalls();
}

console.log(fails === 0 ? "\nWALLS PASS" : `\nWALLS FAIL (${fails})`);
export const wallsFails = fails;
if (process.argv[1]?.endsWith("walls.ts")) process.exit(fails === 0 ? 0 : 1);
