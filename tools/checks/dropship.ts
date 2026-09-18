// The dropship (src/game/dropship.ts, src/config/squad.json ship).
//
// The drop used to be a place picked for you. These check the line the ship
// flies over thousands of seeded matches: it crosses the map from edge to
// edge, passes the squad's place with the place still ahead, is a real
// crossing rather than a corner clipped in a second, and is the same on every
// browser for the same match. Then the run's clock, and a bot's glide off the
// ship: it lands on its place from anywhere on the line in glide reach, flies
// no faster than a player can, and comes down beside a wall rather than
// through it.
//
// Run on its own: npx tsx tools/checks/dropship.ts.
import * as THREE from "three";
import squadCfg from "../../src/config/squad.json";
import { SHIP, ShipRun, alongNearest, glideStep, offLine, shipLine, surfaceUnder } from "../../src/game/dropship";
import { BR_BOUNDS } from "../../src/game/br";
import { RANGE_SOLIDS } from "../../src/game/range";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const DIVE = squadCfg.dive;
const B = BR_BOUNDS;
/** metres from (x, z) to the nearest side of the map's square */
const toEdge = (x: number, z: number) => Math.min(Math.abs(x - B.minX), Math.abs(x - B.maxX), Math.abs(z - B.minZ), Math.abs(z - B.maxZ));
const inside = (x: number, z: number) => x >= B.minX - 1e-6 && x <= B.maxX + 1e-6 && z >= B.minZ - 1e-6 && z <= B.maxZ + 1e-6;

console.log("The line across the map (dropship.ts shipLine)");
{
  // places anywhere on the map, corners and edges included
  const places: Array<{ x: number; z: number }> = [];
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) places.push({ x: B.minX + 10 + (i / 8) * (B.maxX - B.minX - 20), z: B.minZ + 10 + (j / 8) * (B.maxZ - B.minZ - 20) });
  let n = 0;
  let offEdge = 0;
  let farFromPlace = 0;
  let behind = 0;
  let short = 0;
  let shortest = Infinity;
  let longest = 0;
  const octants = new Set<number>();
  const firsts = new Set<string>();
  for (let seed = 1; seed <= 120; seed++) {
    for (const p of places) {
      const l = shipLine(seed * 7919, p, B);
      n++;
      if (toEdge(l.ax, l.az) > 0.01 || toEdge(l.bx, l.bz) > 0.01 || !inside(l.ax, l.az) || !inside(l.bx, l.bz)) offEdge++;
      if (offLine(l, p.x, p.z) > SHIP.pass + 0.01) farFromPlace++;
      // the place is ahead: the point the line was drawn through is at least half-way along
      if (alongNearest(l, p.x, p.z) < l.length / 2 - SHIP.pass - 0.01) behind++;
      if (l.length < SHIP.minLine) short++;
      shortest = Math.min(shortest, l.length);
      longest = Math.max(longest, l.length);
      octants.add(Math.floor(((Math.atan2(l.dz, l.dx) + Math.PI) / (Math.PI * 2)) * 8) % 8);
      if (p === places[40]) firsts.add(`${l.ax.toFixed(2)},${l.az.toFixed(2)}`);
    }
  }
  check("every line starts and ends on the map's edge", offEdge === 0, `${offEdge} of ${n}`);
  check(`every line passes within ${SHIP.pass} m of the squad's place`, farFromPlace === 0, `${farFromPlace} of ${n}`);
  check("and comes in from the far side, so the place is ahead of the ship", behind === 0, `${behind} of ${n}`);
  check(`every line is a crossing, ${SHIP.minLine} m or more, even through a place in a corner`, short === 0, `${short} of ${n}; ${shortest.toFixed(0)} to ${longest.toFixed(0)} m`);
  check("lines go every which way", octants.size === 8, `${octants.size} of 8 directions`);
  check("a different match flies a different line over the same place", firsts.size >= 115, `${firsts.size} distinct lines in 120 matches`);
  const a = shipLine(424242, { x: 30, z: 480 }, B);
  const b = shipLine(424242, { x: 30, z: 480 }, B);
  check("the same match gives every browser the same line", JSON.stringify(a) === JSON.stringify(b));
}

console.log("\nThe flight (ShipRun)");
{
  const line = shipLine(99, { x: 0, z: 500 }, B);
  const run = new ShipRun(line, 100);
  const flight = SHIP.doorsIn + line.length / SHIP.speed;
  check(`the doors are shut for the first ${SHIP.doorsIn} s, while it is still off the map`, !run.doorsOpen(100.5) && !run.doorsOpen(100 + SHIP.doorsIn - 0.05) && !inside(run.at(100.5).x, run.at(100.5).z));
  const entry = run.at(100 + SHIP.doorsIn);
  check("and open as it crosses the edge", run.doorsOpen(100 + SHIP.doorsIn + 0.01) && Math.hypot(entry.x - line.ax, entry.z - line.az) < 0.01);
  check(`it flies at ${SHIP.height} m`, run.at(105).y === SHIP.height);
  const p1 = run.at(106);
  const p2 = run.at(107);
  check(`at ${SHIP.speed} m/s`, Math.abs(Math.hypot(p2.x - p1.x, p2.z - p1.z) - SHIP.speed) < 1e-6);
  check("gone past the far edge, where it puts out whoever is aboard", !run.gone(100 + flight - 0.05) && run.gone(100 + flight + 0.01) && !run.doorsOpen(100 + flight + 0.01));
  check("the whole ride is a sensible length", flight >= 12 && flight <= 30, `${flight.toFixed(1)} s`);
  const stalled = run.riderAt(100 + flight + 40);
  check("a rider put out late (a stalled frame loop) starts at the line's end, not past it", Math.hypot(stalled.x - line.bx, stalled.z - line.bz) < 0.01, `${Math.hypot(stalled.x - line.bx, stalled.z - line.bz).toFixed(2)} m from the end`);
  const place = { x: 0, z: 500 };
  const abeam = run.abeamAt(place.x, place.z);
  const there = run.at(abeam);
  check("it passes nearest a place at the moment it says", Math.abs(Math.hypot(there.x - place.x, there.z - place.z) - offLine(line, place.x, place.z)) < 0.01);
  check("and that moment is while the doors are open", run.doorsOpen(abeam));
  // the yaw faces along the line: a yaw looks down (-sin, -cos)
  const r = (run.yaw * Math.PI) / 180;
  check("it faces the way it flies", Math.abs(-Math.sin(r) - line.dx) < 1e-9 && Math.abs(-Math.cos(r) - line.dz) < 1e-9);
}

console.log("\nA bot's glide off the ship (glideStep)");
{
  const saved = RANGE_SOLIDS.slice();
  RANGE_SOLIDS.length = 0;
  const flat = () => 0;
  const open = () => false;
  const dt = 1 / 60;
  /** leave the ship `d` metres from the place, glide down; where it lands, how long it took, its fastest */
  const fly = (d: number, blocked: (x: number, z: number) => boolean = open) => {
    const pos = new THREE.Vector3(0, SHIP.height - SHIP.exit, 0);
    const target = { x: d, z: 0 };
    let t = 0;
    let across = 0;
    let down = 0;
    while (pos.y > 0 && t < 60) {
      const x0 = pos.x;
      const y0 = pos.y;
      glideStep(pos, target, dt, flat, blocked);
      across = Math.max(across, Math.abs(pos.x - x0) / dt);
      down = Math.max(down, (y0 - pos.y) / dt);
      t += dt;
    }
    return { miss: Math.abs(pos.x - d), t, across, down, x: pos.x };
  };
  const reach = ((SHIP.height - SHIP.exit) / DIVE.glideFall) * DIVE.glideSpeed;
  const near = fly(0);
  check("a place under the ship: it dives, on the ground in under 5 s", near.miss < 0.1 && near.t < 5, `${near.t.toFixed(1)} s`);
  const mid = fly(80);
  check("a place 80 m off the line: it lands on it", mid.miss < 1, `${mid.miss.toFixed(2)} m off, ${mid.t.toFixed(1)} s`);
  const edge = fly(reach - 2);
  check(`a place at the edge of a glide's reach (${reach.toFixed(0)} m): it still lands on it`, edge.miss < 2, `${edge.miss.toFixed(2)} m off`);
  const far = fly(250);
  check("a place beyond the reach: it lands short and walks the rest, no further than a glide carries", far.x <= reach + 1 && far.x > reach - 10, `${far.x.toFixed(0)} m of 250`);
  const fastest = Math.max(near.across, mid.across, edge.across, far.across);
  check("never faster across than a player's glide", fastest <= DIVE.glideSpeed + 1e-6, `${fastest.toFixed(1)} m/s`);
  const steepest = Math.max(near.down, mid.down, edge.down, far.down);
  check("never faster down than a player's dive, nor slower than a glide", steepest <= DIVE.diveFall + 1e-6 && Math.min(mid.down, edge.down) >= DIVE.glideFall - 1e-6, `${steepest.toFixed(1)} m/s at most`);
  // a wall 20 m tall between it and its place, standing where the glide comes low
  const wallX = 60;
  const walled = fly(70, (x) => x >= wallX - 0.4 && x <= wallX + 0.4 + 0.5);
  check("a wall in the way: it comes down beside it, not through it", walled.x < wallX - 0.3, `landed at x = ${walled.x.toFixed(1)}, the wall at ${wallX}`);
  RANGE_SOLIDS.length = 0;
  RANGE_SOLIDS.push({ minX: -5, maxX: 5, minZ: -5, maxZ: 5, base: 3, top: 3.4 });
  check("what is under a point: a roof from above it, the ground from under it", surfaceUnder(0, 0, 50) === 3.4 && surfaceUnder(0, 0, 2) === 0 && surfaceUnder(20, 0, 50) === 0);
  RANGE_SOLIDS.length = 0;
  RANGE_SOLIDS.push(...saved);
}

console.log("\nFollowing the jumpmaster (squad.json ship.follow)");
{
  const f = SHIP.follow;
  check("the formation holds a follower off the jumpmaster, not on top of them", Math.hypot(f.back, f.side) >= 3, `${Math.hypot(f.back, f.side).toFixed(1)} m`);
  check("and lets go high enough to steer the last of it", f.release >= 15 && f.release < SHIP.height / 2, `${f.release} m`);
  check("closing fast enough to keep up with a dive", f.gain * Math.hypot(f.back, f.side) < DIVE.diveFall + DIVE.glideSpeed && f.gain >= 2, `${f.gain} /s`);
}

console.log(fails === 0 ? "\nDROPSHIP PASS" : `\nDROPSHIP FAIL (${fails})`);
export const dropshipFails = fails;
if (process.argv[1]?.endsWith("dropship.ts")) process.exit(fails === 0 ? 0 : 1);
