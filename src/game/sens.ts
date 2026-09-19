// Sensitivity and FOV math. The game's mouse yaw is 0.022 degrees per count
// at sensitivity 1.0 (Source-family m_yaw); FOV settings are 4:3 horizontal.

export const M_YAW = 0.022;
export const BASE_FOV_43 = 70;
const DEG = Math.PI / 180;

export function degPerCount(sens: number): number {
  return M_YAW * sens;
}

export function cmPer360(sens: number, dpi: number): number {
  const counts = 360 / degPerCount(sens);
  return (counts / dpi) * 2.54;
}

export function hipFov43(fovScale: number): number {
  return BASE_FOV_43 * fovScale;
}

/** vertical FOV (degrees) for a 4:3-referenced horizontal FOV; hor+ on wider aspects */
export function verticalFovFrom43(h43: number): number {
  return (2 * Math.atan(Math.tan((h43 * DEG) / 2) * 0.75)) / DEG;
}

/**
 * The first-person gun's vertical FOV (it has a camera of its own): the
 * hip-to-aimed blend of the world's, at the gun's own FOV scale rather than
 * the player's, so the gun is drawn the same on every FOV setting. `hipH` and
 * `adsH` are the world's 4:3 values at the player's `userScale`. A slide or a
 * JOLT widens only the world: they are not in here.
 */
export function gunFov(hipH: number, adsH: number, adsFrac: number, userScale: number, gunScale: number): number {
  const k = gunScale / userScale;
  const hip = verticalFovFrom43(hipH * k);
  return hip + (verticalFovFrom43(adsH * k) - hip) * adsFrac;
}

/** actual horizontal FOV at a given aspect for a 4:3-referenced value */
export function horizontalFovAtAspect(h43: number, aspect: number): number {
  const v = verticalFovFrom43(h43) * DEG;
  return (2 * Math.atan(Math.tan(v / 2) * aspect)) / DEG;
}

/**
 * ADS sensitivity as a multiple of hipfire. At multiplier 1.0 the game scales
 * turn rate by the zoom ratio (0% monitor-distance match). Approximation noted
 * in docs/FIDELITY.md.
 */
/** the per-optic ADS multipliers' zooms, as the game lists them */
export const OPTIC_ZOOMS = ["1x", "2x", "3x", "4x", "6x", "8x", "10x"] as const;
export type OpticZoom = (typeof OPTIC_ZOOMS)[number];

/**
 * Which per-optic multiplier applies: the optic's zoom from its label ("3x
 * HCOG Ranger"), a variable optic's current one (its two zooms, `alt` the
 * second), iron sights and anything unlabelled 1x.
 */
export function opticZoom(label: string | null, zooms?: [string, string], alt = false): OpticZoom {
  const z = zooms ? zooms[alt ? 1 : 0] : label ? /^(\d+)x/.exec(label)?.[0] : null;
  return (OPTIC_ZOOMS as readonly string[]).includes(z ?? "") ? (z as OpticZoom) : "1x";
}

export function adsSensScale(hipH43: number, adsH43: number, multiplier: number): number {
  return (multiplier * Math.tan((adsH43 * DEG) / 2)) / Math.tan((hipH43 * DEG) / 2);
}
