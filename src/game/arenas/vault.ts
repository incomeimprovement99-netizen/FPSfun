// THE VAULT: a tight two-storey interior, for 1v1 and free-for-all.
//
// 26 m by 30, which is small enough that a round is a fight rather than a
// walk. The whole map is one room with a first floor over it:
//
//   z = -15  the north end, three bays split by two short walls
//   z = -6   the first floor's edge: from here in, the ceiling is open sky
//            to the roof, and the gallery above looks down on you
//   z = 0    the middle, the capture circle, the crates and the two blocks
//   z = +15  the south end, the same three bays the other way up
//
// The first floor is a ring around a 16 by 12 hole. It is reached by two
// staircases in opposite corners of the hole, which is the part that matters:
// bots cannot jump, climb or mantle, so a floor reached only by a mantle is a
// floor no bot ever sees. The stairs rise half a metre a step, inside the
// 0.56 m a bot can step up, so both sides of the fight use both floors.
//
// There is no long lane on purpose. Two containers sit on the centre line at
// each end, so the straight shot from one 1v1 spawn to the other is broken
// before either player has left their own end.
import { stairs, type ArenaPlan, type PlanBox } from "./plan";

/** the first floor's walking surface, and the slab under it */
const F1 = 3.0;
const SLAB = 0.3;

const boxes: PlanBox[] = [];

// The first floor: a ring of four slabs round a hole. Four big boxes rather
// than a grid of small ones, because every box is a draw call before the
// static merge and a collision test after it.
boxes.push(
  { x: 0, z: -10.5, w: 26, d: 9, h: SLAB, y: F1 - SLAB, mat: "slab", walk: "bot" },
  { x: 0, z: 10.5, w: 26, d: 9, h: SLAB, y: F1 - SLAB, mat: "slab", walk: "bot" },
  { x: -10.5, z: 0, w: 5, d: 12, h: SLAB, y: F1 - SLAB, mat: "slab", walk: "bot" },
  { x: 10.5, z: 0, w: 5, d: 12, h: SLAB, y: F1 - SLAB, mat: "slab", walk: "bot" }
);

for (const sz of [-1, 1]) {
  // The end bays. Two short walls hold the slab up and cut the end into three
  // rooms, open along their inner edge so the ground floor is a loop: a bot
  // that meets one of them slides along it and comes out somewhere useful.
  for (const sx of [-1, 1]) boxes.push({ x: sx * 5, z: sz * 12.2, w: 0.4, d: 5.6, h: F1 - SLAB, mat: "wall" });
  // the container on the centre line, with a step crate beside it: this is
  // what stops a 1v1 being two players shooting down a corridor
  boxes.push({ x: 0, z: sz * 8.5, w: 4, d: 2, h: 2.4, mat: "container" });
  boxes.push({ x: sz * 3, z: sz * 8.5, w: 1.2, d: 1.2, h: 1.0, mat: "crate" });
  // cover across the inner corridor, so it is not 26 m of open floor
  for (const sx of [-1, 1]) boxes.push({ x: sx * 9.5, z: sz * 7.2, w: 3, d: 2, h: 2.4, mat: sx * sz > 0 ? "container" : "containerAlt" });
  // corner crates, away from the spawns
  for (const sx of [-1, 1]) boxes.push({ x: sx * 11.5, z: sz * 12.5, w: 1.2, d: 1.2, h: 1.2, mat: "crate" });
}

// The two staircases, in opposite corners of the hole. Each ends flush with
// the slab it serves: a run that stops short of its landing is a run nobody
// can finish, which is how the battle royale's ridge ramp went wrong.
boxes.push(...stairs({ x: -6.3, z: -0.6, dir: "-z", steps: 6, rise: 0.5, tread: 0.9, width: 2.6, mat: "slab", cap: true }));
boxes.push(...stairs({ x: 6.3, z: 0.6, dir: "+z", steps: 6, rise: 0.5, tread: 0.9, width: 2.6, mat: "slab", cap: true }));

// The middle. A block in each quarter of the hole, 2.0 m high, which is
// exactly a mantle from the floor and exactly enough to stand behind: with
// one in each quarter neither diagonal across the hole is a free shot, and
// the capture circle's 3.5 m is still clear ground.
for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxes.push({ x: sx * 3.8, z: sz * 4.8, w: 2.2, d: 2.2, h: 2.0, mat: "cover", cap: true });
boxes.push(
  // A post at the foot of each staircase. Without them the two spawns on the
  // sides look straight through the middle at each other down 22 m of floor,
  // and the circle has to stay open, so the break goes beside it.
  { x: -5.4, z: 0.2, w: 1.6, d: 1.6, h: 2.6, mat: "container" },
  { x: 5.4, z: -0.2, w: 1.6, d: 1.6, h: 2.6, mat: "containerAlt" },
  // the crates a hand's width off the gallery's edge: the players' own way
  // up when both staircases are watched
  { x: 6.9, z: -3.0, w: 1.6, d: 1.6, h: 1.6, mat: "crate" },
  { x: -6.9, z: 3.0, w: 1.6, d: 1.6, h: 1.6, mat: "crate" },
  { x: -10.5, z: 4.5, w: 1.2, d: 1.2, h: 1.2, mat: "crate" },
  { x: 10.5, z: -4.5, w: 1.2, d: 1.2, h: 1.2, mat: "crate" },
  // A pillar in the gap between the middle block and the side container. An
  // end spawn looked diagonally across the hole straight at a side spawn,
  // 17 m of clear floor, and the map is symmetric under a half turn, so the
  // same line ran the other way from the other end. One pillar breaks each.
  { x: 6.4, z: -5.6, w: 1.4, d: 1.4, h: 2.4, mat: "cover", cap: true },
  { x: -6.4, z: 5.6, w: 1.4, d: 1.4, h: 2.4, mat: "cover", cap: true }
);

export const VAULT: ArenaPlan = {
  id: "vault",
  name: "THE VAULT",
  blurb: "Two floors, one hole through the middle. Short rooms, stairs at both ends of the gallery, and a rope across the top.",
  // west of the range and well clear of it, inside the sun's shadow box so
  // the place is lit like everywhere else you play
  x: -72,
  z: -48,
  halfX: 13,
  halfZ: 15,
  wallH: 8,
  roof: true,
  lights: [-8, 8],
  girders: [-8, 8],
  floorColor: 0xa9a49a,
  boxes,
  spawns: [
    { x: 0, z: -12.5, yaw: 180 },
    { x: 0, z: 12.5, yaw: 0 },
    { x: -9, z: -12.5, yaw: 180 },
    { x: 9, z: 12.5, yaw: 0 },
    { x: 9, z: -12.5, yaw: 180 },
    { x: -9, z: 12.5, yaw: 0 },
    { x: -11, z: 0, yaw: -90 },
    { x: 11, z: 0, yaw: 90 },
  ],
  teams: { a: [0, 2, 4, 6], b: [1, 3, 5, 7] },
  zones: [
    { id: "a", x: 0, z: -11.5 },
    { id: "b", x: 0, z: 0 },
    { id: "c", x: 0, z: 11.5 },
  ],
  crown: { x: 0, z: 0 },
  // Two ropes crossing over the hole at different heights. They ride the way
  // you look, so each one is both a way onto the far gallery and a way off it.
  zips: [
    { ax: -6, ay: 4.6, az: -7.5, bx: 6, by: 4.6, bz: 7.5, floorA: F1, floorB: F1 },
    { ax: 6, ay: 5.3, az: -7.5, bx: -6, by: 5.3, bz: 7.5, floorA: F1, floorB: F1 },
  ],
  bestFor: ["duel", "ffa", "gunrun"],
};
