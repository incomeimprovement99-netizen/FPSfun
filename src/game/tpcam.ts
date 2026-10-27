// The third-person cameras round the soldier (Milestone 615).
//
// Watching someone else in third person: out of a match, you watch a bot, or a squad mate with the third-person key,
// from behind and above them. The camera was put there whatever stood there: in the Neon City's streets and towers it
// was inside the wall behind them, or behind it, and you watched the inside of a building. Now it looks from their head
// out to that place first, as your own third-person camera does from your eye, and stops short of the first wall on the
// way (figure.json spectateCam).
//
// And your own soldier, when a wall at your back brings your third-person camera up against it (selfFadeAt).
import * as THREE from "three";
import figureCfg from "../config/figure.json";

const CAM = (figureCfg as unknown as { spectateCam: { back: number; up: number; pivotUp: number; lookAhead: number; lookUp: number; gap: number } }).spectateCam;
const FADE = (figureCfg as unknown as { selfFade: { from: number; to: number } }).selfFade;

/** how far along a ray the first solid is, or `len` if none (projectile.ts solidHit) */
export type RayHit = (from: THREE.Vector3, dir: THREE.Vector3, len: number) => number;

const pivot = new THREE.Vector3();
const way = new THREE.Vector3();

/**
 * Where the camera watching a figure stands and what it looks at: `feet` the figure's place, `yaw` its group's turn
 * (it faces +z of it). Writes `cam` and `look`.
 */
export function spectateCamera(feet: THREE.Vector3, yaw: number, hit: RayHit, cam: THREE.Vector3, look: THREE.Vector3): void {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  pivot.set(feet.x, feet.y + CAM.pivotUp, feet.z);
  cam.set(feet.x - fx * CAM.back, feet.y + CAM.up, feet.z - fz * CAM.back);
  way.subVectors(cam, pivot);
  const len = way.length();
  if (len > 1e-6) {
    way.divideScalar(len);
    const wall = hit(pivot, way, len);
    // (never past the wall, however near it is: right against it, the camera is at their head, and a head's skin drawn
    // from inside is not drawn at all, so you look out from where they are)
    if (wall < len) cam.copy(pivot).addScaledVector(way, Math.max(0, wall - CAM.gap));
  }
  look.set(feet.x + fx * CAM.lookAhead, feet.y + CAM.lookUp, feet.z + fz * CAM.lookAhead);
}

/**
 * Your own soldier in third person, with a wall at your back: the camera is pulled in to stay this side of it, and at
 * half a metre from your eye your head and shoulders covered a third of the screen (the Neon City's streets, measured
 * 0.52 m). So the body thins out as the camera comes in past `selfFade.from` m from your eye and is gone at `to`: how
 * much of it is drawn at `dist` m, 1 all of it.
 */
export function selfFadeAt(dist: number): number {
  if (dist >= FADE.from) return 1;
  if (dist <= FADE.to) return 0;
  const k = (dist - FADE.to) / (FADE.from - FADE.to);
  // eased in and out, so it starts and ends without a step as the camera slides along the wall
  return k * k * (3 - 2 * k);
}
