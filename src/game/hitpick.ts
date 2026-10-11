// Which of a shot's hits on the hit volumes it takes (projectile.ts): the nearest, but for the seam between a figure's
// head and the body under it.
import type * as THREE from "three";
import figureCfg from "../config/figure.json";

/** how far past a body volume's way in a shot may go on into the same figure's head volume and take the head (figure.json headSeam) */
const SEAM = (figureCfg as { headSeam?: number }).headSeam ?? 0;

/**
 * The hit a shot takes, of all it goes through, nearest first: the first, except that a shot into a figure's body volume
 * that goes on into the same figure's head volume within `headSeam` metres takes the head. Where the head meets the neck
 * and the shoulders, the volumes are boxes, cylinders and an ellipsoid round a drawn body they cannot follow exactly, and
 * from behind a shot at the bottom of the head it showed went into the neck's or the chest's first, the head's 1.5 to
 * 6 cm on: 1 to 6 of every 100 of them, standing, aimed or walking (the owner, 2026-10-11: "i want to always be able to
 * clearly snipe hs someone from the back").
 */
export function takenHit(hits: THREE.Intersection[]): THREE.Intersection | undefined {
  const first = hits[0];
  if (!first || first.object.userData.zone !== "body" || SEAM <= 0) return first;
  for (let i = 1; i < hits.length && hits[i].distance - first.distance <= SEAM; i++) {
    if (hits[i].object.userData.zone === "head" && hits[i].object.parent === first.object.parent) return hits[i];
  }
  return first;
}
