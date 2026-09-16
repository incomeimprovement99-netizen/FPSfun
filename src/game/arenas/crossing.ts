// THE CROSSING: the wide map, with high ground on both sides and a building
// in the middle lane. Team deathmatch, Control and Crown were drawn for this.
//
// 56 m by 68, turned end for end rather than mirrored, so both teams get the
// same map and neither gets the better side of it:
//
//   z = -34  the north team's end: a deck 4 m up over their spawn, a
//            staircase up each side of it, and a rope from its lip
//   z = -18  the north approach, cover in the middle, side lanes either flank
//   z = 0    the middle building: a ground floor you run straight through, a
//            first floor at 3.5 m with a stair on each side, a roof at 6.8 m
//            that only a rope or a mantle reaches
//   z = +34  the south team's end, the same thing rotated half a turn
//
// The two things the owner asked for are here: ropes, and a building in the
// middle lane with things to move around. The building's ground floor is a
// canopy on pillars and not a walled room, which is the same lesson the 1v1
// arena learned the hard way: walls across the middle lane stop a bot finding
// its way from one end to the other, and it spends the match against a pillar.
//
// Every floor a bot needs is on a staircase of half-metre steps. The roof is
// the one place bots do not go, and nothing a mode scores sits up there.
import { stairs, type ArenaPlan, type PlanBox } from "./plan";

/** the middle building: its half width, half depth, first floor and roof */
const BW = 11;
const BD = 9;
const F1 = 3.5;
const ROOF = 6.8;
/** the team decks: their top, and the slab under it */
const DECK = 4.0;
const SLAB = 0.3;

const boxes: PlanBox[] = [];

// ---------------------------------------------------------- the middle building
// eight pillars, the first floor in four pieces round a hole you can drop
// through, and a roof with a lip to crouch behind
for (const sx of [-1, 1]) {
  for (const sz of [-1, 1]) boxes.push({ x: sx * (BW - 0.9), z: sz * (BD - 0.9), w: 0.9, d: 0.9, h: F1 - SLAB, mat: "wall" });
  boxes.push({ x: sx * (BW - 0.9), z: 0, w: 0.9, d: 0.9, h: F1 - SLAB, mat: "wall" });
  boxes.push({ x: 0, z: sx * (BD - 0.9), w: 0.9, d: 0.9, h: F1 - SLAB, mat: "wall" });
}
boxes.push(
  { x: 0, z: -6.25, w: BW * 2, d: 5.5, h: SLAB, y: F1 - SLAB, mat: "slab", walk: "bot" },
  { x: 0, z: 6.25, w: BW * 2, d: 5.5, h: SLAB, y: F1 - SLAB, mat: "slab", walk: "bot" },
  { x: -7, z: 0, w: 8, d: 7, h: SLAB, y: F1 - SLAB, mat: "slab", walk: "bot" },
  { x: 7, z: 0, w: 8, d: 7, h: SLAB, y: F1 - SLAB, mat: "slab", walk: "bot" },
  { x: 0, z: 0, w: BW * 2, d: BD * 2, h: SLAB, y: ROOF - SLAB, mat: "slab", walk: "player" }
);
// the roof's lip, to crouch behind, with a gap at each corner where the
// stack of crates outside arrives
boxes.push(
  { x: -2, z: -(BD - 0.2), w: 18, d: 0.4, h: 0.7, y: ROOF, mat: "cover" },
  { x: 10.5, z: -(BD - 0.2), w: 1, d: 0.4, h: 0.7, y: ROOF, mat: "cover" },
  { x: 2, z: BD - 0.2, w: 18, d: 0.4, h: 0.7, y: ROOF, mat: "cover" },
  { x: -10.5, z: BD - 0.2, w: 1, d: 0.4, h: 0.7, y: ROOF, mat: "cover" }
);
for (const sx of [-1, 1]) boxes.push({ x: sx * (BW - 0.2), z: 0, w: 0.4, d: BD * 2 - 0.8, h: 0.7, y: ROOF, mat: "cover" });

// The stairs onto the first floor, one on each side face, each starting from
// the far end of its side so the two teams do not share one. The top step is
// level with the floor and touches it, so there is no gap to fall down.
boxes.push(...stairs({ x: BW + 1.3, z: 6.3, dir: "-z", steps: 7, rise: 0.5, tread: 0.9, width: 2.6, mat: "slab", cap: true }));
boxes.push(...stairs({ x: -(BW + 1.3), z: -6.3, dir: "+z", steps: 7, rise: 0.5, tread: 0.9, width: 2.6, mat: "slab", cap: true }));

// the first floor's own low wall, to shoot over, broken where each stair arrives
boxes.push(
  { x: -(BW - 0.2), z: -5.05, w: 0.4, d: 7.9, h: 1.0, y: F1, mat: "cover" },
  { x: -(BW - 0.2), z: 4.6, w: 0.4, d: 8.8, h: 1.0, y: F1, mat: "cover" },
  { x: BW - 0.2, z: -4.6, w: 0.4, d: 8.8, h: 1.0, y: F1, mat: "cover" },
  { x: BW - 0.2, z: 5.05, w: 0.4, d: 7.9, h: 1.0, y: F1, mat: "cover" },
  { x: 0, z: -(BD - 0.2), w: BW * 2 - 0.8, d: 0.4, h: 1.0, y: F1, mat: "cover" },
  { x: 0, z: BD - 0.2, w: BW * 2 - 0.8, d: 0.4, h: 1.0, y: F1, mat: "cover" }
);
// a crate on each half of the first floor, chest high: cover up there, and
// low enough to still stand on with the roof 3 m overhead
for (const sz of [-1, 1]) boxes.push({ x: sz * 8.2, z: sz * 6.2, w: 1.6, d: 1.6, h: 1.0, y: F1, mat: "crate" });
// The way onto the roof: three crates stacked against the building outside
// each gap in the lip, rising 1.8 m at a time. A player mantles the lot in
// four moves and a bot cannot take the first one, which is the point: the
// roof is the one floor here that has to be earned, by this or by a rope.
for (const s of [-1, 1]) {
  boxes.push({ x: s * 8.5, z: s * -9.9, w: 1.6, d: 1.6, h: 5.2, mat: "crate" });
  boxes.push({ x: s * 8.5, z: s * -11.5, w: 1.6, d: 1.6, h: 3.4, mat: "crate" });
  boxes.push({ x: s * 8.5, z: s * -13.1, w: 1.6, d: 1.6, h: 1.6, mat: "crate" });
}
// cover on the ground floor: two containers on the centre line so nobody
// shoots one spawn from the other, and four blocks to fight round
for (const sz of [-1, 1]) boxes.push({ x: 0, z: sz * 6.4, w: 4.5, d: 2, h: 2.4, mat: "container" });
for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxes.push({ x: sx * 6.5, z: sz * 5.5, w: 2.4, d: 2.4, h: 2.0, mat: "cover", cap: true });

// ------------------------------------------------------------- the team decks
// A deck over each spawn on six pillars, with a staircase up each side and a
// lip along the front with a gap in the middle to drop out of.
for (const sz of [-1, 1]) {
  const z = sz * 25;
  boxes.push({ x: 0, z, w: 22, d: 8, h: SLAB, y: DECK - SLAB, mat: "slab", walk: "bot" });
  for (const px of [-10.1, 0, 10.1]) for (const pz of [-3.1, 3.1]) boxes.push({ x: px, z: z + pz, w: 0.9, d: 0.9, h: DECK - SLAB, mat: "wall" });
  for (const sx of [-1, 1]) boxes.push({ x: sx * 6.5, z: z - sz * 3.8, w: 9, d: 0.4, h: 1.0, y: DECK, mat: "cover" });
  boxes.push(...stairs({ x: 18.2, z, dir: "-x", steps: 8, rise: 0.5, tread: 0.9, width: 2.6, mat: "slab", cap: true }));
  boxes.push(...stairs({ x: -18.2, z, dir: "+x", steps: 8, rise: 0.5, tread: 0.9, width: 2.6, mat: "slab", cap: true }));
}

// ---------------------------------------------------------- the side platforms
// Half height, half way down each flank: somewhere to hold the side lane from
// and the far end of two of the ropes. A five-step run up, so bots use them.
for (const sx of [-1, 1]) {
  boxes.push({ x: sx * 20, z: 0, w: 8, d: 8, h: SLAB, y: 2.6 - SLAB, mat: "slab", walk: "bot" });
  for (const pz of [-3.2, 3.2]) for (const px of [-3.2, 3.2]) boxes.push({ x: sx * 20 + px, z: pz, w: 0.8, d: 0.8, h: 2.3, mat: "wall" });
  boxes.push(...stairs({ x: sx * 20, z: sx * 8.5, dir: sx > 0 ? "-z" : "+z", steps: 5, rise: 0.52, tread: 0.9, width: 2.6, mat: "slab", cap: true }));
}

// ------------------------------------------------------------ the lane cover
// Containers down the flanks and low walls across the approaches, staggered,
// so neither side lane is 68 m of clear line.
for (const sz of [-1, 1]) {
  for (const sx of [-1, 1]) {
    boxes.push({ x: sx * 19, z: sz * 14, w: 3, d: 6, h: 2.4, mat: sx * sz > 0 ? "container" : "containerAlt" });
    boxes.push({ x: sx * 24, z: sz * 6, w: 1.6, d: 1.6, h: 1.6, mat: "crate" });
    boxes.push({ x: sx * 15, z: sz * 20.5, w: 1.2, d: 1.2, h: 1.2, mat: "crate" });
  }
  boxes.push({ x: -5, z: sz * 15.5, w: 6, d: 0.7, h: 1.1, mat: "cover" });
  boxes.push({ x: 5.5, z: sz * 18.5, w: 5, d: 0.7, h: 1.1, mat: "cover" });
  boxes.push({ x: sz * 9, z: sz * 13, w: 3, d: 5, h: 2.4, mat: "containerAlt" });
}

export const CROSSING: ArenaPlan = {
  id: "crossing",
  name: "THE CROSSING",
  blurb: "High ground at both ends, a two-storey building in the middle lane, and four ropes between them. Drawn for five a side.",
  x: -96,
  z: 34,
  halfX: 28,
  halfZ: 34,
  wallH: 11,
  roof: true,
  lights: [-14, 14],
  girders: [-14, 14],
  floorColor: 0xb2aca0,
  boxes,
  spawns: [
    { x: 0, z: -31.5, yaw: 180 },
    { x: 0, z: 31.5, yaw: 0 },
    { x: -9, z: -31.5, yaw: 180 },
    { x: 9, z: 31.5, yaw: 0 },
    { x: 9, z: -31.5, yaw: 180 },
    { x: -9, z: 31.5, yaw: 0 },
    { x: -18, z: -30, yaw: 180 },
    { x: 18, z: 30, yaw: 0 },
  ],
  teams: { a: [0, 2, 4, 6], b: [1, 3, 5, 7] },
  // Control's three points: each team's approach and the building's ground
  // floor. All three are on the floor, because a point a bot cannot reach is
  // a point that scores itself.
  zones: [
    { id: "a", x: 0, z: -19 },
    { id: "b", x: 0, z: 0 },
    { id: "c", x: 0, z: 19 },
  ],
  crown: { x: 0, z: 0 },
  // A rope from each deck onto the building's roof, and one from each deck
  // out to the far flank: the rotate the middle lane never had.
  zips: [
    { ax: 0, ay: 5.4, az: -21.5, bx: 0, by: ROOF + 1.1, bz: -(BD - 0.8), floorA: DECK, floorB: ROOF },
    { ax: 0, ay: 5.4, az: 21.5, bx: 0, by: ROOF + 1.1, bz: BD - 0.8, floorA: DECK, floorB: ROOF },
    { ax: -9, ay: 5.4, az: -21.5, bx: -19.5, by: 4.0, bz: -2.5, floorA: DECK, floorB: 2.6 },
    { ax: 9, ay: 5.4, az: 21.5, bx: 19.5, by: 4.0, bz: 2.5, floorA: DECK, floorB: 2.6 },
  ],
  bestFor: ["tdm", "control", "crown"],
};
