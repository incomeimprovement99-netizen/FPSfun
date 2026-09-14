// Ziplines and ladders: the traversal pieces the controller and the HUD read.
//
// Filled by whoever builds the level (course.ts, range.ts), the same way
// RANGE_SOLIDS is, so the controller never needs to know which level it is in
// and the movement tests can place their own.
import * as THREE from "three";
import { PAL, bevel, flat } from "./geo";

/** A zipline: a straight rope between two points, where your hands hold it. */
export interface Zipline {
  a: THREE.Vector3;
  b: THREE.Vector3;
}
export const ZIPLINES: Zipline[] = [];

/**
 * A ladder. In Apex a ladder is not its own mechanic: it is rungs on a wall
 * you climb with the ordinary wall climb, put where a climb reaches the top.
 * It is a sign that says "climb here". So a ladder is just a face of a solid,
 * and what this records is where it is, for the hint.
 */
export interface Ladder {
  /** centre of the ladder's foot, on the wall face */
  x: number;
  z: number;
  /** the wall's outward normal: which way the ladder faces */
  nx: number;
  nz: number;
  /** height of the base and of the ledge the ladder reaches */
  base: number;
  top: number;
  width: number;
}
export const LADDERS: Ladder[] = [];

/**
 * Is the player standing in front of a ladder and facing it: close, level
 * with its foot, and looking at it within 45 degrees. That is when the HUD
 * says how to climb it.
 */
export function ladderAhead(px: number, py: number, pz: number, yawDeg: number): Ladder | null {
  const yaw = (yawDeg * Math.PI) / 180;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  for (const l of LADDERS) {
    const dx = px - l.x;
    const dz = pz - l.z;
    const out = dx * l.nx + dz * l.nz; // distance out from the wall
    const side = Math.abs(dx * -l.nz + dz * l.nx);
    if (out < 0 || out > 2.2 || side > l.width / 2 + 0.4) continue;
    if (py < l.base - 0.3 || py > l.top - 0.5) continue;
    if (-(fx * l.nx + fz * l.nz) < 0.7) continue;
    return l;
  }
  return null;
}

/**
 * Build a ladder on a wall face and record it: two rails and rungs every 30
 * cm, standing just proud of the wall, with the rails running on past the top
 * the way a real ladder's do. Not a collider and no mechanic of its own: the
 * wall behind it is what you climb. (x, z) is the foot of the ladder on the
 * face, (nx, nz) the face's outward normal, in `parent`'s space; `worldX` is
 * added for the record when the parent is offset.
 */
export function buildLadder(parent: THREE.Object3D, x: number, z: number, nx: number, nz: number, base: number, top: number, worldX = 0): void {
  const mat = flat(PAL.hazard, 0.5, 0.35);
  const W = 0.56;
  const ox = x + nx * 0.07;
  const oz = z + nz * 0.07;
  const tx = -nz;
  const tz = nx;
  const railH = top - base + 0.9;
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(bevel(0.06, railH, 0.06, 0.015), mat);
    r.position.set(ox + tx * s * (W / 2), base + railH / 2, oz + tz * s * (W / 2));
    r.castShadow = true;
    parent.add(r);
  }
  const rungGeo = new THREE.CylinderGeometry(0.02, 0.02, W, 8);
  rungGeo.rotateZ(Math.PI / 2);
  if (Math.abs(tz) > 0.5) rungGeo.rotateY(Math.PI / 2);
  for (let y = base + 0.3; y < top + 0.05; y += 0.3) {
    const rung = new THREE.Mesh(rungGeo, mat);
    rung.position.set(ox, y, oz);
    parent.add(rung);
  }
  LADDERS.push({ x: x + worldX, z, nx, nz, base, top, width: W });
}
