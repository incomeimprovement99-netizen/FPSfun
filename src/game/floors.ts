// The world's floor where it is not y = 0. Its own module, with nothing in it but this, so the movement, the bots, the
// shots and the throws can all ask it without importing the range or the city.
/**
 * Where the world's floor is lower than y = 0 (world metres): the city's metro under its centre (city.ts, city.json
 * metro). What falls, walks or lands stops at floorAt rather than at 0: a body, a bot, a shot, a grenade, a drop. The
 * street over it is a solid slab, so above ground nothing changes.
 */
export const FLOORS: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; y: number }> = [];
/** the world's floor at (x, z), world metres: 0, or lower over the metro */
export function floorAt(x: number, z: number): number {
  for (const f of FLOORS) if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) return f.y;
  return 0;
}
