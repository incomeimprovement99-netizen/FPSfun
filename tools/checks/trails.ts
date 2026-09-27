// SpeedKills' movement trails (src/game/trails.ts, hud.json trails), Hyper Scape's red and blue: a player running
// leaves a ribbon that grows a point every step metres and fades over its seconds; standing still, it empties; a jump
// across the map (a respawn, a DASH) starts it afresh instead of drawing a line across the map; too far off, none; and
// a player gone leaves theirs to fade before it is taken away.
//
// Run on its own: npx tsx tools/checks/trails.ts (npm run verify runs it).
import * as THREE from "three";
import { Trails, TRAILS } from "../../src/game/trails";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("\nMovement trails");
const tr = new Trails(null);
const eye = new THREE.Vector3(0, 1.7, 10);
const feet = new THREE.Vector3(0, 0, 0);
let now = 0;
const dt = 1 / 60;
const frame = (live = true, side: "enemy" | "ally" | "crown" = "enemy") => {
  now += dt;
  tr.update(now, eye, [{ key: 1, feet, side, live }]);
};

// running at 8 m/s for half a second
for (let i = 0; i < 30; i++) {
  feet.x += 8 * dt;
  frame();
}
const running = tr.points(1);
check("running, the trail gathers a point every step metres", Math.abs(running - Math.min(TRAILS.points, Math.floor(4 / TRAILS.step))) <= 2, `${running} points over 4 m`);
check("and it is drawn", tr.count === 1);
// standing still: it fades away in its seconds
for (let i = 0; i < Math.ceil((TRAILS.seconds + 0.1) / dt); i++) frame();
check("standing still, it fades out within its seconds, nothing drawn", tr.count === 0 && tr.points(1) <= 1, `${tr.points(1)} points left`);
// a jump across the map starts it afresh
for (let i = 0; i < 20; i++) {
  feet.x += 8 * dt;
  frame();
}
feet.x += 50;
frame();
check("a jump across the map starts the trail afresh, no line across the map", tr.points(1) === 1, `${tr.points(1)} points`);
// too far: none
feet.set(TRAILS.maxDist + 20, 0, 0);
for (let i = 0; i < Math.ceil((TRAILS.seconds + 0.1) / dt); i++) frame();
check(`past ${TRAILS.maxDist} m, no trail`, tr.points(1) === 0 && tr.count === 0, `${tr.points(1)} points`);
// a player gone: theirs fades, then goes
feet.set(0, 0, 0);
for (let i = 0; i < 20; i++) {
  feet.x += 8 * dt;
  frame();
}
for (let i = 0; i < 5; i++) {
  now += dt;
  tr.update(now, eye, []);
}
const lingering = tr.points(1);
for (let i = 0; i < Math.ceil(TRAILS.seconds / dt); i++) {
  now += dt;
  tr.update(now, eye, []);
}
check("a player gone leaves theirs to fade, then it is taken away", lingering > 0 && tr.points(1) === 0, `${lingering} lingering, then ${tr.points(1)}`);

console.log(fails === 0 ? "\nTRAILS PASS" : `\nTRAILS FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
