// A clear place round a point: where a start that is taken, or a spot by a zone that lands in a box, steps out to. A body
// started inside a box does not walk out of it (a bot stood there for good), and on the rings of modes.json stepOut.
import cfg from "../config/modes.json";
import { floorAt } from "./floors";
import { RANGE_SOLIDS } from "./range";

export interface StepBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  circle?: { x: number; z: number; r: number } | null;
}

/** The `lap`th clear place round (x, z), in the world, inside `b`: null with nowhere clear. */
export function stepOutAt(x: number, z: number, lap: number, b: StepBounds): { x: number; z: number } | null {
  const C = cfg.stepOut;
  const over = (px: number, pz: number, pad: number) => RANGE_SOLIDS.filter((s) => px > s.minX - pad && px < s.maxX + pad && pz > s.minZ - pad && pz < s.maxZ + pad);
  // the floor the point stands on: a raised one is a solid's top under it, not a roof over it
  const ground = floorAt(x, z);
  const feet = Math.max(ground, ...over(x, z, 0).map((s) => s.top).filter((t) => t < ground + C.head * 2));
  const clear: Array<{ x: number; z: number }> = [];
  for (const r of C.rings) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const w = { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r };
      if (w.x < b.minX + C.edge || w.x > b.maxX - C.edge || w.z < b.minZ + C.edge || w.z > b.maxZ - C.edge) continue;
      if (b.circle && Math.hypot(w.x - b.circle.x, w.z - b.circle.z) > b.circle.r - C.edge) continue;
      if (over(w.x, w.z, C.pad).some((s) => s.base < feet + C.head && s.top > feet + C.knee)) continue;
      clear.push(w);
    }
  }
  return clear.length ? clear[(Math.max(1, lap) - 1) % clear.length] : null;
}
