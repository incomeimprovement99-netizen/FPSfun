// THE RINGWORKS: a four-way courtyard under open sky, for free-for-all,
// Gun Run and Crown.
//
// The gap this one fills. Every other arena in the game is a map with two
// ends: the warehouse, the Vault and the Crossing all put one side here and
// the other side over there, which is right for a 1v1 and for team
// deathmatch, and wrong for the modes where everybody fights everybody. In a
// free-for-all on a two-ended map the two end spawns are the good ones and
// the four the lobby adds down the sides are leftovers, and Crown has no
// neutral place to hold that is not somebody's end. So this map is the same
// from all four sides: turn it a quarter turn and it is itself.
//
// 44 m square. A square walkway 2.5 m up sits in the middle like a picture
// frame, with a 12 m hole through the middle of it:
//
//   the middle    the capture circle, on the floor, open to the sky, with the
//                 walkway looking down into it from all four sides
//   the walkway   high ground reached by four staircases, one per side, and
//                 left by dropping into the middle or off the outside
//   underneath    2.2 m of headroom, so the walkway is a roof as well as a
//                 floor, and a block under each side breaks the straight
//                 shot from one spawn across the map to the one opposite
//   the corners   four identical stacks of cover, one per quarter
//
// It is the one arena with no roof on it, so the hour of the day (sky.json)
// is on show while you play rather than shut out by a warehouse ceiling.
//
// Every staircase is half-metre steps, which is inside a bot's 0.56 m, so
// bots hold the high ground here as well as players do.
import { stairs, yawToCentre, type ArenaPlan, type PlanBox } from "./plan";

/** the walkway's walking surface and the slab under it */
const RING = 2.5;
const SLAB = 0.3;

/**
 * The same box a quarter turn round the middle. A map that is the same from
 * four sides is drawn once and turned three times: one set of numbers to get
 * right, and no corner that is quietly kinder than the others.
 */
const turn = (b: PlanBox): PlanBox => ({ ...b, x: -b.z, z: b.x, w: b.d, d: b.w });
const fourWays = (bs: PlanBox[]): PlanBox[] => {
  const out: PlanBox[] = [];
  let step = bs;
  for (let i = 0; i < 4; i++) {
    out.push(...step);
    step = step.map(turn);
  }
  return out;
};

const boxes: PlanBox[] = [];

// The walkway: four slabs round a 12 m hole. Written out rather than turned,
// so the four pieces tile the square instead of overlapping at the corners.
boxes.push(
  { x: 0, z: -9, w: 24, d: 6, h: SLAB, y: RING - SLAB, mat: "slab", walk: "bot" },
  { x: 0, z: 9, w: 24, d: 6, h: SLAB, y: RING - SLAB, mat: "slab", walk: "bot" },
  { x: -9, z: 0, w: 6, d: 12, h: SLAB, y: RING - SLAB, mat: "slab", walk: "bot" },
  { x: 9, z: 0, w: 6, d: 12, h: SLAB, y: RING - SLAB, mat: "slab", walk: "bot" }
);

boxes.push(
  ...fourWays([
    // three pillars a quarter: the hole's corner, the outer corner and the
    // middle of one side. Twelve in all, and 2.2 m of headroom under them.
    { x: -6.4, z: -6.4, w: 0.8, d: 0.8, h: RING - SLAB, mat: "wall" },
    { x: -11.6, z: -11.6, w: 0.8, d: 0.8, h: RING - SLAB, mat: "wall" },
    { x: 0, z: -11.6, w: 0.8, d: 0.8, h: RING - SLAB, mat: "wall" },
    // the block under this side, off the middle of the tunnel so it breaks
    // the line across the map without closing the way through
    { x: 0, z: -9, w: 3, d: 2, h: 2.0, mat: "container" },
    // the rail along this side's outer edge, in two pieces with the
    // staircase's landing between them
    { x: -9.25, z: -11.8, w: 5.5, d: 0.4, h: 1.0, y: RING, mat: "cover" },
    { x: 4.25, z: -11.8, w: 15.5, d: 0.4, h: 1.0, y: RING, mat: "cover" },
    // the way up, five steps, ending flush against the walkway's edge
    ...stairs({ x: -5, z: -16.5, dir: "+z", steps: 5, rise: 0.5, tread: 0.9, width: 3, mat: "slab", cap: true }),
    // a crate in the middle, clear of the capture circle: cover down there,
    // and a 1.3 m mantle back up onto the walkway
    { x: -4.2, z: -4.2, w: 1.2, d: 1.2, h: 1.2, mat: "crate" },
    // this quarter's cover, the same five pieces in every quarter. The
    // container on the axis is the one that earns its place: without it the
    // two corner spawns on this side see each other straight down the lane
    // outside the walkway, 28 m with nothing in it.
    { x: -15, z: 0, w: 4, d: 2.4, h: 2.4, mat: "container" },
    { x: -18.5, z: -13, w: 3, d: 4, h: 2.4, mat: "container" },
    { x: -13.5, z: -18.5, w: 4, d: 2.4, h: 2.0, mat: "cover", cap: true },
    { x: -9, z: -16, w: 1.6, d: 1.6, h: 2.0, mat: "cover", cap: true },
    { x: -16.5, z: -7.5, w: 1.2, d: 1.2, h: 1.2, mat: "crate" },
  ])
);

const spawnAt = (x: number, z: number) => ({ x, z, yaw: yawToCentre(x, z) });

export const RINGWORKS: ArenaPlan = {
  id: "ringworks",
  name: "THE RINGWORKS",
  blurb: "A square under open sky, the same from all four sides, with a raised walkway round a pit in the middle. Eight spawns, no back line.",
  x: -72,
  z: 112,
  halfX: 22,
  halfZ: 22,
  wallH: 9,
  roof: false,
  lights: [],
  girders: [],
  floorColor: 0xb6b0a3,
  boxes,
  // Four on the sides and four in the corners, every one of them the same
  // distance from the middle and the same fight. The first two are still a
  // pair of opposite ends, so a 1v1 can be played here.
  spawns: [spawnAt(0, -19), spawnAt(0, 19), spawnAt(-19, 0), spawnAt(19, 0), spawnAt(-14, -14), spawnAt(14, 14), spawnAt(14, -14), spawnAt(-14, 14)],
  // in team deathmatch the sides take opposite halves of the square
  teams: { a: [0, 2, 4, 6], b: [1, 3, 5, 7] },
  zones: [
    { id: "a", x: -15.5, z: -15.5 },
    { id: "b", x: 0, z: 0 },
    { id: "c", x: 15.5, z: 15.5 },
  ],
  crown: { x: 0, z: 0 },
  // two ropes across the middle, corner to corner, one above the other so
  // they read as two ropes and not a cross
  zips: [
    { ax: -9, ay: 4.0, az: -9, bx: 9, by: 4.0, bz: 9, floorA: RING, floorB: RING },
    { ax: 9, ay: 4.7, az: -9, bx: -9, by: 4.7, bz: 9, floorA: RING, floorB: RING },
  ],
  bestFor: ["ffa", "gunrun", "crown"],
};
