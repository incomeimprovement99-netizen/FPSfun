// HAEFY's rocket (src/game/rocket.ts, src/config/rocket.json; the owner, 2026-10-06: "it shouldn't hurt the shooter, but it
// should do more damage the further it travels, so a point blank or very close does like 10 damage and then it scales
// like that, the skybreaker is the reference for hyperscape"). The burst's numbers: its damage by how far the rocket
// flew, its reach, and its fall-off from the middle; the gap to a body it is measured by (a figure's own hit volumes, or
// a body known by its feet); the gun the launcher is; the host's check letting a burst's hits through, as late as a
// rocket's flight. The flight and a real burst on a figure are tools/e2e.ts's (speedkills).
//
// Run on its own: GAME=speedkills npx tsx tools/checks/rocket.ts
import * as THREE from "three";
import { blastAt, blastReach, blastSees, blastShare, bodyAlong, bodyGap, meshGap, rocketDamage, rocketHurts, ROCKET } from "../../src/game/rocket";
import { resolveWeapon } from "../../src/game/weapons";
import { GAME } from "../../src/game/game";
import { HitCheck, maxPerSecond } from "../../src/net/hitcheck";
import { falloff } from "../../src/game/projectile";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("\nHAEFY's rocket");
const r = (x: number) => Math.round(x * 10) / 10;
check("point blank, about 10 (the owner's 'like 10')", Math.abs(rocketDamage(0.5) - 10) < 1e-9 && Math.abs(rocketDamage(ROCKET.damage.from) - 10) < 1e-9, `${r(rocketDamage(0.5))} at 0.5 m`);
const steps = [2, 5, 10, 15, 20, 30, 80].map(rocketDamage);
check("more damage the further it flew, all the way to its full damage at 20 m, and no more after", steps.every((d, i) => i === 0 || d >= steps[i - 1]) && Math.abs(rocketDamage(20) - ROCKET.damage.full) < 1e-9 && rocketDamage(80) === rocketDamage(20), steps.map(r).join(" / "));
check("its full damage a third of a kill against 150, as the Skybreaker's 40 was against 120", Math.abs(ROCKET.damage.full / 150 - 40 / 120) < 1e-9, `${ROCKET.damage.full}`);
check("the burst's reach grows with the flight too (the Skybreaker's full area from 20 m)", blastReach(1) < blastReach(10) && blastReach(10) < blastReach(20) && blastReach(20) === ROCKET.blast.reach, [1, 10, 20].map((m) => r(blastReach(m))).join(" / "));
check("full damage at the burst's middle, less out to its edge, none past it", blastAt(25, 0) === 50 && blastAt(25, 0.5) === 50 && blastAt(25, 1.5) > 0 && blastAt(25, 1.5) < 50 && blastAt(25, 2.9) < blastAt(25, 1.5) && blastAt(25, 3) === 0 && blastAt(25, 5) === 0, [0, 0.5, 1.5, 2.9, 3].map((m) => r(blastAt(25, m))).join(" / "));
check("point blank its burst is small as well as weak (1.5 m)", blastAt(1, 1.6) === 0 && blastAt(1, 0) === 10, `${r(blastReach(1))} m`);
// (a wall between the burst and a chest takes it: one box between them)
const wall = (from: THREE.Vector3, dir: THREE.Vector3, len: number) => {
  const t = (0 - from.x) / (dir.x || 1e-9);
  return t > 0 && t < len ? t : Infinity;
};
check("a wall between the burst and a chest takes it; open air does not", !blastSees(new THREE.Vector3(-1, 1, 0), new THREE.Vector3(1, 1, 0), wall) && blastSees(new THREE.Vector3(1, 1, 0), new THREE.Vector3(2, 1, 0), wall));
check("a body's share: all of it within the inner reach, none at the edge, the damage that share of the middle's", blastShare(25, ROCKET.blast.inner) === 1 && blastShare(25, ROCKET.blast.reach) === 0 && Math.abs(blastAt(25, 1.5) - rocketDamage(25) * blastShare(25, 1.5)) < 1e-9, [0.6, 1.5, 3].map((m) => r(blastShare(25, m))).join(" / "));

// The gap is to the body, not to a chest point: a rocket at someone's feet is on them (to a chest 1.1 m up it had been
// at the inner reach's edge, and at a crouched body's feet farther)
const feet = new THREE.Vector3(4, 0, 4);
const at = (x: number, y: number, z: number) => new THREE.Vector3(feet.x + x, feet.y + y, feet.z + z);
check("a burst at the feet, at the chest or on the head of a body is on it (gap 0)", bodyGap(at(0, 0.02, 0), feet) === 0 && bodyGap(at(0, 1.1, 0), feet) === 0 && bodyGap(at(0, 1.75, 0), feet) === 0, [0.02, 1.1, 1.75].map((y) => r(bodyGap(at(0, y, 0), feet))).join(" / "));
check("1 m beside the chest is 1 m less the body's half width; over a crouched head, the crouch's height lower", Math.abs(bodyGap(at(1, 1.1, 0), feet) - (1 - ROCKET.body.radius)) < 1e-9 && bodyGap(at(0, 1.5, 0), feet, true) > 0 && bodyGap(at(0, 1.5, 0), feet) === 0, `${r(bodyGap(at(1, 1.1, 0), feet))} m; ${r(bodyGap(at(0, 1.5, 0), feet, true))} m over a crouched one`);
check("a body known by its feet takes the full middle's damage on it, none through a wall", rocketHurts(50, new THREE.Vector3(-0.1, 0.05, 0), 25, new THREE.Vector3(-0.1, 0, 0), false, wall) === 50 && rocketHurts(50, new THREE.Vector3(0.3, 1, 0), 25, new THREE.Vector3(-0.3, 0, 0), false, wall) === 0);
// someone else's rocket stops on you (bodyAlong): a step through you, and not one passing beside you
const unit = new THREE.Vector3(0, 0, 1);
check("a rocket's step through a body stops on it, a step 0.5 m beside it does not", bodyAlong(at(0, 1.2, -0.6), unit, 1, feet) < 1 && bodyAlong(at(0.5, 1.2, -0.6), unit, 1, feet) === Infinity, `${r(bodyAlong(at(0, 1.2, -0.6), unit, 1, feet))} m into a 1 m step`);
// a drawn figure is measured by its own hit volumes, as posed: the torso's box (dummy.ts), turned side on
{
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.63, 0.32));
  const fig = new THREE.Group();
  fig.position.set(2, 0, 0);
  fig.rotation.y = Math.PI / 2;
  torso.position.y = 1.235;
  fig.add(torso);
  // turned a quarter, its 0.32 m depth lies along x: 0.4 m out along x is 0.24 m from its face; along z, 0.4 - 0.25
  const gx = meshGap(new THREE.Vector3(2.4, 1.2, 0), [torso]);
  const gz = meshGap(new THREE.Vector3(2, 1.2, 0.4), [torso]);
  check("a figure's gap is to its hit volumes as they are turned and placed", Math.abs(gx - 0.24) < 1e-6 && Math.abs(gz - 0.15) < 1e-6 && meshGap(new THREE.Vector3(2, 1.2, 0), [torso]) === 0, `${r(gx * 100) / 100} m and ${r(gz * 100) / 100} m`);
}

if (GAME === "speedkills") {
  const w = resolveWeapon("launcher", 0, [], 0);
  check("the launcher: HAEFY's, a burst its round, no drop, the numbers rocket.json gives", w.blast === true && w.name === "HAEFY" && w.projectile.gravity === 0 && Math.abs(w.projectile.speed - ROCKET.speed) < 1e-6 && w.clipSize === ROCKET.magazine && Math.abs(w.reloadTime - ROCKET.reload) < 1e-9 && w.damage.headshot === 1, `${w.projectile.speed} m/s, ${w.clipSize} rockets, ${w.reloadTime} s`);
  check("its damage by distance is the rocket's (10 point blank, 50 from 20 m)", w.damage.near === ROCKET.damage.pointBlank && w.damage.far === ROCKET.damage.full && Math.abs(w.damage.nearDist - ROCKET.damage.from) < 1e-6 && Math.abs(w.damage.farDist - ROCKET.damage.fullFrom) < 1e-6);
  // (the burst's middle is the gun's own damage for the distance flown, so the two must be one curve)
  const flown = [1, 2, 8, 14, 20, 40];
  check("the gun's damage by distance flown is rocket.json's ramp, the burst's middle", flown.every((m) => Math.abs(falloff(w, m) - rocketDamage(m)) < 1e-6), flown.map((m) => `${m} m ${r(falloff(w, m))}`).join(", "));
  // the host's check: one rocket's burst on four figures at once passes; a fifth round's worth in that second does not
  const h = new HitCheck();
  let passed = 0;
  for (let i = 0; i < 4; i++) if (h.judge({ from: 7, amount: 50, weapon: "launcher", dist: 25 }, 10, 9.6, 25) === null) passed++;
  check("the host lets one burst's hits on four through", passed === 4, `${passed} of 4`);
  // (the host judges a claim against the gun fused to 5, the most it can be)
  const per = maxPerSecond(resolveWeapon("launcher", 0, [], 5)) * 4;
  let more = 0;
  for (let i = 0; i < 40; i++) if (h.judge({ from: 7, amount: 50, weapon: "launcher", dist: 25 }, 10.01 + i * 0.001, 9.6, 25) === null) more++;
  check("and no more than four bursts' worth of what the gun fires in a second", (4 + more) * 50 <= per + 1e-6, `${4 + more} claims of 50, over ${Math.round(per)} a second`);
  // a rocket at range bursts as late as its whole flight (3 s, 165 m): its hit comes after a bullet's window
  const late = new HitCheck();
  const rocketLate = late.judge({ from: 8, amount: 50, weapon: "launcher", dist: 150 }, 12.9, 10, 150);
  const rifleLate = late.judge({ from: 9, amount: 20, weapon: "vinson", dist: 150 }, 12.9, 10, 150);
  const rocketStale = late.judge({ from: 10, amount: 50, weapon: "launcher", dist: 150 }, 16.5, 10, 150);
  check("the host takes a rocket's hit 2.9 s after its shot, not a bullet's, and not a rocket's past its flight", rocketLate === null && rifleLate === "no shot fired" && rocketStale === "no shot fired", `${rocketLate ?? "taken"}; ${rifleLate ?? "taken"}; ${rocketStale ?? "taken"}`);
}

console.log(fails === 0 ? "\nROCKET PASS" : `\nROCKET FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
