// A jump pad onto a roof, solved (city.json padSolve): shared by the old city (city.ts) and the Neon City map
// (neonmap.ts, and tools/import-neon.ts, which stands the pack's plate and beam where the pad is).
import { MOVE } from "./movement";
import cityCfg from "../config/city.json";

const S = cityCfg.padSolve;

/** how far out from the face a pad stands: a body and a little, so the throw straight up clears the wall */
export function padStandOff(): number {
  return MOVE.radius + S.standOff;
}

/**
 * The face it throws you over is at (fx, fz) with (nx, nz) pointing out of it toward the pad, its floor `floor` and the
 * roof `roof`. It throws you straight up to peakOver above the roof, and once you are clear above the edge carries you
 * across to land landInside past it. Timed as one throw, a fraction of a second off met the wall metres below the top
 * (the pads' e2e caught it three ways); split, the push waits for the height. A fixed nudge either met the wall below
 * its top or never got over the edge, and aiming the body's middle at the face met it 0.4 m short of the top (the pads'
 * e2e caught both). In the caller's coordinates: the pad, and where it lands you
 */
export function padOnto(fx: number, fz: number, nx: number, nz: number, floor: number, roof: number, landInside = S.landInside): { pad: { x: number; z: number; dx: number; dz: number; y: number; up: number; over: number }; land: { x: number; z: number; y: number } } {
  const g = MOVE.gravity;
  const H = roof - floor;
  const v = Math.sqrt(2 * g * (H + S.peakOver));
  const d0 = padStandOff();
  const overY = roof + S.clear;
  // from there, up to the peak and down to the roof: the time the push has to carry you d0 + landInside
  const vOver = Math.sqrt(Math.max(0, v * v - 2 * g * (H + S.clear)));
  const t = vOver / g + Math.sqrt((2 * S.peakOver) / g);
  const vx = (d0 + landInside) / t;
  return {
    pad: { x: fx + nx * d0, z: fz + nz * d0, dx: -nx * vx, dz: -nz * vx, y: floor, up: v, over: overY },
    land: { x: fx - nx * landInside, z: fz - nz * landInside, y: roof },
  };
}

/**
 * A pad that throws you off a roof onto a lower one (the centre's way down, neonmap.json rules.pads.spine): `hop` metres
 * up first, so you clear the parapet it stands behind, then down onto (lx, lz) at `landY`, the throw solved for the
 * heights. In the caller's coordinates: the push up and across, and how long you are in the air
 */
export function padOff(px: number, pz: number, floor: number, lx: number, lz: number, landY: number, hop: number): { up: number; dx: number; dz: number; t: number } {
  const g = MOVE.gravity;
  const up = Math.sqrt(2 * g * hop);
  const t = (up + Math.sqrt(up * up + 2 * g * (floor - landY))) / g;
  return { up, dx: (lx - px) / t, dz: (lz - pz) / t, t };
}
