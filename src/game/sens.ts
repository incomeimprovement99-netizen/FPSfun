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
export function adsSensScale(hipH43: number, adsH43: number, multiplier: number): number {
  return (multiplier * Math.tan((adsH43 * DEG) / 2)) / Math.tan((hipH43 * DEG) / 2);
}
