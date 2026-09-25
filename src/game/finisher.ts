// Finishers (docs/AAA_GAP.md step 6): Apex's most-watched three seconds. A
// knocked enemy in front of you, the melee key, and instead of a swing both
// figures play a short exchange while your camera steps out to watch it. It
// ends in the kill and your shield back, and any hit you take breaks it off,
// so finishing someone in the open is a risk and not a free reward.
//
// This file is the choice of who can be finished from where; the running of
// one is in main.ts beside the melee it replaces, because it has to hold the
// same keys, camera and figure the melee does.
import cfg from "../config/finisher.json";

export interface Spot {
  x: number;
  y: number;
  z: number;
}

/**
 * The one to finish from `from` facing `yawDeg` (0 looks down -z), or null:
 * the nearest of `list` inside `reach` metres on the ground, within `cone`
 * degrees of the facing and `rise` metres up or down. A downed figure is on
 * the floor at your feet, so the facing is the flat one and not the look:
 * nobody should have to aim at the ground to be offered it.
 */
export function finishTarget<T>(from: Spot, yawDeg: number, list: ReadonlyArray<{ at: Spot; item: T }>, reach = cfg.reach, cone = cfg.cone, rise = cfg.rise): T | null {
  const yaw = (yawDeg * Math.PI) / 180;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const minCos = Math.cos((cone * Math.PI) / 180);
  let best: T | null = null;
  let bestD = Infinity;
  for (const { at, item } of list) {
    if (Math.abs(at.y - from.y) > rise) continue;
    const dx = at.x - from.x;
    const dz = at.z - from.z;
    const d = Math.hypot(dx, dz);
    if (d > reach || d >= bestD) continue;
    // standing on top of them counts: there is no facing to be off by
    if (d > 0.2 && (dx * fx + dz * fz) / d < minCos) continue;
    best = item;
    bestD = d;
  }
  return best;
}

/** the yaw (degrees, 0 down -z) that faces from one spot to another, for turning the finisher to the finished */
export function yawToward(from: Spot, to: Spot): number {
  return (Math.atan2(-(to.x - from.x), -(to.z - from.z)) * 180) / Math.PI;
}

/** which of the finisher's blows has landed by `t` seconds in: the sounds, once each */
export function blowsBy(t: number, blows: readonly number[] = cfg.blows): number {
  return blows.filter((b) => t >= b).length;
}
