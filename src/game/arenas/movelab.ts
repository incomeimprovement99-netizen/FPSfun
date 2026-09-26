// THE MOVEMENT LAB: SpeedKills' practice ground for the moves the city is
// built round (plan section 7.13, "practice is core"). It is not a map a
// match is played on, so it is not one of ARENA_PLANS: those are held to
// bots' rules (every floor on a bot's route), and the lab is exactly the
// floors a bot cannot reach. It is built only in SpeedKills (main.ts), and
// tools/checks/arenas.ts still holds it clear of every other place.
//
// 48 m by 42, open sky, three stations along the north wall:
//
//   CLIMB     three blocks, 2, 4 and 8 m: a mantle, a storey (the climb), and
//             two storeys (a double jump, then the climb)
//   WALL RUN  a wall 30 m long down the middle, to run along either side
//   GAPS      decks a storey up with a 4 m gap and then a 6 m one: a jump, then
//             a double jump; a stair up to the first
//
// The numbers are the city's: a storey is 4 m (city.json storey), which the
// SpeedKills movement is measured against (movement.speedkills.json).
import { stairs, type ArenaPlan, type PlanBox } from "./plan";

const STOREY = 4;

const boxes: PlanBox[] = [];

// CLIMB: a mantle, a storey, two storeys, each with neon along its top edge
const climbs: Array<[number, number]> = [
  [-20, 2],
  [-15, STOREY],
  [-10, STOREY * 2],
];
for (const [x, h] of climbs) {
  boxes.push({ x, z: -15, w: 4, d: 6, h, mat: "wall" });
  boxes.push({ x, z: -12, w: 4, d: 0.1, h: 0.08, y: h - 0.2, mat: "neon", solid: false });
}

// WALL RUN: one long wall down the middle, a strip of neon along it at a run's height
boxes.push({ x: 0, z: -3, w: 0.6, d: 30, h: 6, mat: "wall" });
for (const side of [-1, 1]) boxes.push({ x: side * 0.35, z: -3, w: 0.08, d: 30, h: 0.08, y: 2.2, mat: "neon", solid: false });

// GAPS: a deck a storey up, a 4 m gap, a second, a 6 m gap, a third; a stair to the first
boxes.push({ x: 10.5, z: 0, w: 5, d: 8, h: STOREY, mat: "slab", walk: "player" });
boxes.push({ x: 19.5, z: 0, w: 5, d: 8, h: STOREY, mat: "slab", walk: "player" });
boxes.push({ x: 19.5, z: -13, w: 5, d: 6, h: STOREY, mat: "slab", walk: "player" });
for (const [x, z, w, d] of [
  [10.5, 4, 5, 0.1],
  [19.5, 4, 5, 0.1],
  [19.5, -10, 5, 0.1],
] as const)
  boxes.push({ x, z, w, d, h: 0.08, y: STOREY - 0.2, mat: "neon", solid: false });
boxes.push(...stairs({ x: 10.5, z: 11.2, dir: "-z", steps: 8, rise: 0.5, tread: 0.9, width: 2.6, mat: "slab", cap: true }));

export const MOVELAB: ArenaPlan = {
  id: "movelab",
  name: "THE MOVEMENT LAB",
  blurb: "Climb a storey, two with a double jump first; run the long wall; clear the gaps a storey up.",
  x: 98,
  z: -100,
  halfX: 24,
  halfZ: 21,
  wallH: 12,
  roof: false,
  lights: [],
  girders: [],
  floorColor: 0x9aa0aa,
  look: "city",
  boxes,
  // where you come in, facing the stations (the rest of a plan's fields are for matches, which the lab has none of)
  spawns: Array.from({ length: 8 }, () => ({ x: 0, z: 17, yaw: 0 })),
  teams: { a: [0], b: [1] },
  zones: [],
  // (the plan's capture ring is drawn at the crown: in a corner, and drawn tiny, main.ts)
  crown: { x: -22, z: 19 },
  zips: [],
  bestFor: [],
};
