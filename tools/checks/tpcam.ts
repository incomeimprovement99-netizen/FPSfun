// Watching someone in third person (src/game/tpcam.ts, Milestone 615): the camera behind and above the one you watch
// stops short of the first wall between their head and its place, and is where it always was with nothing there.
// Walls here are flat planes standing in the figure's way, the ray met as projectile.ts solidHit meets a box's face.
//
// Run on its own: npx tsx tools/checks/tpcam.ts.
import * as THREE from "three";
import figureCfg from "../../src/config/figure.json";
import { selfFadeAt, spectateCamera, type RayHit } from "../../src/game/tpcam";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const CAM = (figureCfg as unknown as { spectateCam: { back: number; up: number; pivotUp: number; lookAhead: number; lookUp: number; gap: number } }).spectateCam;
const open: RayHit = (_from, _dir, len) => len;
/** a wall: the plane through `at` facing `n` (toward the figure); a ray meets it going against its face */
const wall =
  (at: THREE.Vector3, n: THREE.Vector3): RayHit =>
  (from, dir, len) => {
    const d = dir.dot(n);
    if (d >= -1e-9) return len;
    const t = at.clone().sub(from).dot(n) / d;
    return t >= 0 && t < len ? t : len;
  };
/** which side of the wall a point is on: + the figure's */
const side = (p: THREE.Vector3, at: THREE.Vector3, n: THREE.Vector3) => p.clone().sub(at).dot(n);

console.log("Watching someone in third person (tpcam.ts)");
const cam = new THREE.Vector3();
const look = new THREE.Vector3();
let worst = Infinity;
let off = 0;
for (const yawDeg of [0, 37, 90, 180, 251]) {
  const yaw = (yawDeg * Math.PI) / 180;
  const feet = new THREE.Vector3(12, 3, -40);
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  // nothing behind them: the place it always had
  spectateCamera(feet, yaw, open, cam, look);
  off = Math.max(off, cam.distanceTo(new THREE.Vector3(feet.x - fx * CAM.back, feet.y + CAM.up, feet.z - fz * CAM.back)), look.distanceTo(new THREE.Vector3(feet.x + fx * CAM.lookAhead, feet.y + CAM.lookUp, feet.z + fz * CAM.lookAhead)));
  // a wall behind them, near and nearer: square on, and turned 30 degrees
  for (const back of [2.2, 1, 0.4, 0.1]) {
    for (const turn of [0, 30]) {
      const t = yaw + (turn * Math.PI) / 180;
      const n = new THREE.Vector3(Math.sin(t), 0, Math.cos(t));
      const at = feet.clone().addScaledVector(n, -back);
      spectateCamera(feet, yaw, wall(at, n), cam, look);
      worst = Math.min(worst, side(cam, at, n));
    }
  }
}
check(`with nothing behind them, the camera ${CAM.back} m behind and ${CAM.up} m over their feet, looking ${CAM.lookAhead} m ahead of them`, off < 1e-9, `${off.toExponential(1)} m off`);
check(`with a wall behind them, 2.2 m to 0.1 m off and turned up to 30 degrees, the camera on their side of it (${CAM.gap} m short of it at most)`, worst > 0, `nearest ${worst.toFixed(3)} m on their side`);
{
  // standing with their back to a wall 1 m behind: the camera between them and it, not 2.6 m back inside the building
  const feet = new THREE.Vector3(0, 0, 0);
  const n = new THREE.Vector3(0, 0, 1);
  const at = new THREE.Vector3(0, 0, -1);
  spectateCamera(feet, 0, wall(at, n), cam, look);
  check("a wall 1 m behind them: the camera stops in front of it, as near them as it has to be", cam.z > at.z && cam.z <= at.z + CAM.gap + 1e-6 && cam.y > feet.y + CAM.pivotUp, `camera at z ${cam.z.toFixed(3)}, y ${cam.y.toFixed(2)}; the wall at z ${at.z}`);
}

console.log("\nYour own soldier with a wall at your back (selfFadeAt)");
{
  const FADE = (figureCfg as unknown as { selfFade: { from: number; to: number } }).selfFade;
  // the camera's own distances from the eye: at the hip 2.4 m back and 0.45 m over the shoulder, aimed in 0.9 m nearer,
  // an emote's 3 m in front, and pulled in by a wall to 0.25 m back (main.ts)
  const hip = Math.hypot(2.4, 0.45, 0.1);
  const aimed = Math.hypot(1.5, 0.45, 0.1);
  const wallBack = Math.hypot(0.25, 0.45, 0.1);
  check(`whole at the hip (${hip.toFixed(2)} m), aimed in (${aimed.toFixed(2)} m) and in an emote (3 m)`, selfFadeAt(hip) === 1 && selfFadeAt(aimed) === 1 && selfFadeAt(3) === 1);
  check(`gone with a wall pulling the camera in against it (${wallBack.toFixed(2)} m)`, selfFadeAt(wallBack) === 0);
  let steps = 0;
  let back = 0;
  let prev = selfFadeAt(0);
  for (let d = 0.001; d <= 3; d += 0.001) {
    const a = selfFadeAt(d);
    steps = Math.max(steps, Math.abs(a - prev));
    if (a < prev - 1e-12) back++;
    prev = a;
  }
  check(`thinning the nearer the camera, without a step (${FADE.to} to ${FADE.from} m)`, back === 0 && steps < 0.01, `largest change in a millimetre ${steps.toFixed(4)}, ${back} turning back`);
}

console.log(fails === 0 ? "\nTHIRD PERSON CAMERA PASS" : `\nTHIRD PERSON CAMERA FAIL (${fails})`);
export const tpcamFails = fails;
if (process.argv[1]?.endsWith("tpcam.ts")) process.exit(fails === 0 ? 0 : 1);
