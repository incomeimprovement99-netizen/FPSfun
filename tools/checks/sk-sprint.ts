// SpeedKills always sprints (src/game/player.ts sprintMode "always"): whichever way you move, firing included, at the
// sprint's speed; crouched, the crouch's. The owner, 2026-09-27: "we should only have sprinting on and not ever walking
// / non sprinting. fast paced is the goal". It was forward only, and firing or aiming dropped it to the run.
//
// Run: GAME=speedkills npx tsx tools/checks/sk-sprint.ts
import { GAME } from "../../src/game/game";
import { Player } from "../../src/game/player";
import { MOVE } from "../../src/game/movement";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
class Script {
  down = new Set<string>();
  held = (a: string): boolean => this.down.has(a);
  pressedNow = (): boolean => false;
}
/** two seconds holding `keys`, firing or not; the speed at the end and whether it reads as a sprint */
function run(keys: string[], firing = false): { speed: number; sprinting: boolean } {
  const p = new Player({ minX: -500, maxX: 500, minZ: -500, maxZ: 500 });
  p.sprintMode = "always";
  p.teleport(0, 0, 0, 0);
  const s = new Script();
  for (const k of keys) s.down.add(k);
  let t = 100;
  for (let i = 0; i < 288; i++) {
    t += 1 / 144;
    p.update(1 / 144, t, s as never, 0, 1, firing);
  }
  return { speed: p.speed, sprinting: p.sprinting };
}
console.log(`\nSpeedKills always sprints (game: ${GAME})`);
check("this runs with SpeedKills' movement", GAME === "speedkills");
const sprint = MOVE.sprintSpeed;
for (const dir of ["forward", "right", "back", "left"]) {
  const r = run([dir]);
  check(`moving ${dir}, it sprints at the sprint's speed`, r.sprinting && Math.abs(r.speed - sprint) < 0.05 * sprint, `${r.speed.toFixed(2)} of ${sprint.toFixed(2)} m/s`);
}
const firing = run(["right"], true);
check("firing on the move, still a sprint", firing.sprinting && Math.abs(firing.speed - sprint) < 0.05 * sprint, `${firing.speed.toFixed(2)} m/s`);
const crouched = run(["forward", "crouch"]);
check("crouched, not a sprint", !crouched.sprinting && crouched.speed < 0.8 * sprint, `${crouched.speed.toFixed(2)} m/s`);
console.log(fails === 0 ? "\nSK SPRINT PASS" : `\nSK SPRINT FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
