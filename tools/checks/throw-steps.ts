// A thrown body flies the same whatever the frame rate (src/game/throwables.ts,
// src/config/throwables.json maxStep).
//
// A frame used to be cut into four slices whatever its length, so on a slow
// machine a frag took 25 ms steps and landed somewhere else than at 60 fps.
// This throws the same frag at 60 fps and at 10 fps (the game's 0.1 s frame
// cap) and compares where it goes off.
//
// Run on its own: npx tsx tools/checks/throw-steps.ts. Also runs inside npm run verify.
import * as THREE from "three";
import { Throwables, type ThrowEvents } from "../../src/game/throwables";
import { RANGE_SOLIDS } from "../../src/game/range";
import { clearLob, lobVelocity } from "../../src/game/bots";

let fails = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("\nThrown bodies at any frame rate");

/** throw one frag and run the world at `fps` until it goes off; where did it */
function blastAt(fps: number, wall: boolean): THREE.Vector3 | null {
  const saved = RANGE_SOLIDS.slice();
  RANGE_SOLIDS.length = 0;
  // a low wall 9 m out that the arc has to bounce off, the case a coarse step gets wrong
  if (wall) RANGE_SOLIDS.push({ minX: -3, maxX: 3, minZ: -9.15, maxZ: -9, base: 0, top: 1.2 });
  let at: THREE.Vector3 | null = null;
  const events: ThrowEvents = {
    onBlast: (_t, p) => {
      at = p.clone();
    },
    onStrike: () => undefined,
    onFireTick: () => undefined,
    onSound: () => undefined,
  };
  const th = new Throwables(new THREE.Scene(), events);
  const dt = 1 / fps;
  let now = 0;
  // low enough when there is a wall to meet it 0.8 m up, rather than sail over
  th.throw("frag", new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, wall ? 2 : 5, -14), 99, false, now);
  for (let i = 0; i < fps * 6 && !at; i++) {
    now += dt;
    th.update(now, dt, []);
  }
  RANGE_SOLIDS.length = 0;
  RANGE_SOLIDS.push(...saved);
  return at;
}

for (const wall of [false, true]) {
  const fast = blastAt(60, wall);
  const slow = blastAt(10, wall);
  const d = fast && slow ? fast.distanceTo(slow) : Infinity;
  check(
    `the same frag goes off within 15 cm at 10 fps as at 60 fps${wall ? ", bouncing off a wall" : " on open ground"}`,
    d < 0.15,
    fast && slow ? `${d.toFixed(2)} m apart` : "one never went off"
  );
}

// A bot looks at its arc before it throws (bots.ts clearLob).
console.log("\nA bot's lob looks before it leaps");
{
  const saved = RANGE_SOLIDS.slice();
  const from = new THREE.Vector3(0, 1.6, 0);
  const to = new THREE.Vector3(0, 0, -12);
  const flight = 1.15 * (0.7 + 12 / 40);
  RANGE_SOLIDS.length = 0;
  const open = clearLob(from, to, flight);
  check("on open ground it throws the arc it always threw", !!open && open.distanceTo(lobVelocity(from, to, flight)) < 1e-9);
  // a wall 3.5 m tall halfway: the flat arc strikes it, a steeper one clears it
  RANGE_SOLIDS.push({ minX: -4, maxX: 4, minZ: -6.2, maxZ: -5.8, base: 0, top: 3.5 });
  const wall = clearLob(from, to, flight);
  check("a wall in the way gets a steeper lob over it, not a frag into the wall", !!wall && wall.y > lobVelocity(from, to, flight).y, wall ? `up ${wall.y.toFixed(1)} m/s` : "no throw");
  // the target inside a room: a flat arc meets the front wall and a steep one
  // the roof over their head, so no arc lands near and it keeps the frag. (A
  // roof alone, open at the sides, is not enough: a flat lob goes under it and
  // does land at the target, which is right.)
  RANGE_SOLIDS.length = 0;
  RANGE_SOLIDS.push({ minX: -5, maxX: 5, minZ: -16, maxZ: -8, base: 3, top: 3.4 });
  RANGE_SOLIDS.push({ minX: -5, maxX: 5, minZ: -8.3, maxZ: -8, base: 0, top: 3 });
  check("a target inside a room means no throw at all, not a frag onto the roof", clearLob(from, to, flight) === null);
  RANGE_SOLIDS.length = 0;
  RANGE_SOLIDS.push({ minX: -5, maxX: 5, minZ: -16, maxZ: -8, base: 3, top: 3.4 });
  check("but a roof open at the sides takes the flat lob in under it", !!clearLob(from, to, flight));
  RANGE_SOLIDS.length = 0;
  RANGE_SOLIDS.push(...saved);
}

console.log(fails === 0 ? "\nTHROW STEPS PASS" : "\nTHROW STEPS FAIL (" + fails + ")");
export const throwStepsFails = fails;
if (process.argv[1]?.endsWith("throw-steps.ts")) process.exit(fails === 0 ? 0 : 1);
