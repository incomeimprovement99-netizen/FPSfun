// Callouts: the name of the ground you are standing on, so a squad without
// voice can say where they are.
//
// The battle royale names its places already (br.ts placeAt: THE HUB, WEST
// TOWN, the sites between them), and the arenas name nothing at all. Seven of
// the game's modes are played in the arenas, and in them "he's over there" is
// the only thing anybody can say. The owner asked for the callout list we
// never built, and for the roofs to be part of it: being on top of something
// is the single most useful thing to be able to say in a room with cover in
// it, because it is the one thing that changes where everybody has to look.
//
// An arena is not hand-named. Its callout is worked out from where you stand
// in it, which means it works for the three drawn maps, the warehouse, the
// triangle and anything drawn later, and it cannot go stale when a map moves.
// A hand-written name for the middle of each map goes on top of that, because
// "MID" is what people actually say.

/** the ground under a point: the region, and whether it is above the floor */
export interface Callout {
  /** what a player would say: "MID", "NORTH-EAST", "EAST ROOF" */
  name: string;
  /** the region on its own, without the roof */
  region: string;
  /** standing on something rather than on the floor */
  high: boolean;
}

/** how far up counts as being on top of something rather than on the floor */
export const ROOF_AT = 1.4;

/** the nine regions of a map, by where a point falls in it */
const REGIONS = [
  ["NORTH-WEST", "NORTH", "NORTH-EAST"],
  ["WEST", "MID", "EAST"],
  ["SOUTH-WEST", "SOUTH", "SOUTH-EAST"],
] as const;

/**
 * Where a point is in a map, as a player would say it. `halfX` and `halfZ`
 * are the map's own half-sizes about its centre, and `middle` is how much of
 * it counts as the middle: the middle of an arena is a place people fight
 * over and name, and the edges are quarters.
 *
 * The roof: `y` is the height above the map's floor. Anything above `ROOF_AT`
 * is on top of something, and that is said, because it is the thing worth
 * saying.
 */
export function calloutAt(x: number, z: number, y: number, halfX: number, halfZ: number, middle = 0.34): Callout {
  const band = (v: number, half: number): 0 | 1 | 2 => {
    const f = half <= 0 ? 0 : v / half;
    if (f < -middle) return 0;
    return f > middle ? 2 : 1;
  };
  // z grows south, as the maps are laid out, so the row is picked from it
  const region = REGIONS[band(z, halfZ)][band(x, halfX)];
  const high = y >= ROOF_AT;
  return { name: high ? `${region} ROOF` : region, region, high };
}

/**
 * The same, for a squad mate's marker: short enough for a line of HUD, and
 * with "ON THE" in front of a roof so it reads as a sentence rather than a
 * grid reference.
 */
export function calloutLine(c: Callout): string {
  return c.high ? `ON THE ${c.region} ROOF` : `IN ${c.region}`;
}
