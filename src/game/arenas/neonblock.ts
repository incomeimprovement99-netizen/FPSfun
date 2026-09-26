// NEON BLOCK: SpeedKills' arena, a street crossing cut out of the city at
// night (plan section 7.14: arenas from city blocks, for 1v1, FFA and TDM).
//
// 44 m by 48, open to the sky:
//
//   the streets   two cross in the middle, 14 m and 16 m wide, the crown and
//                 Control's points on them, cars and barriers for cover
//   the blocks    one at each corner: a deck 4 m up (a storey, the city's),
//                 reached by a run of half-metre steps so bots use it too,
//                 with a lit tower on its outer corner and a lip to shoot over
//   the bridges   a skybridge across the north street and one across the
//                 south, joining the decks: the high ground is a ring, and a
//                 fight is up as often as across
//   the alleys    three and four metres between the blocks and the walls, the
//                 way round a fight
//
// Every deck and bridge is on a bot's route; nothing a mode scores is up
// there, because a point on a deck is a point the stairs decide.
import { stairs, yawToCentre, type ArenaPlan, type PlanBox } from "./plan";

/** a deck's top, a storey (city.json storey), and the slab it is */
const DECK = 4.0;
/** the blocks' inner and outer edges: the streets are the gap between them */
const BX0 = 7;
const BX1 = 19;
const BZ0 = 8;
const BZ1 = 20;
/** each corner tower on its deck */
const TOWER = 5;
const TOWER_H = 12;

const boxes: PlanBox[] = [];

for (const sx of [-1, 1]) {
  for (const sz of [-1, 1]) {
    const cx = sx * (BX0 + BX1) / 2;
    const cz = sz * (BZ0 + BZ1) / 2;
    const w = BX1 - BX0;
    const d = BZ1 - BZ0;
    // the block: a solid storey, and a concrete deck over it (the facade's windows are for its sides)
    boxes.push({ x: cx, z: cz, w, d, h: DECK - 0.1, mat: "wall" });
    boxes.push({ x: cx, z: cz, w, d, h: 0.1, y: DECK - 0.1, mat: "slab", walk: "bot" });
    // the tower on its outer corner, and its neon up the two street-facing edges
    const tx = sx * (BX1 - TOWER / 2);
    const tz = sz * (BZ1 - TOWER / 2);
    boxes.push({ x: tx, z: tz, w: TOWER, d: TOWER, h: TOWER_H, y: DECK, mat: "wall" });
    for (const [nx, nz] of [
      [tx - sx * (TOWER / 2), tz - sz * (TOWER / 2)],
      [tx + sx * (TOWER / 2), tz - sz * (TOWER / 2)],
      [tx - sx * (TOWER / 2), tz + sz * (TOWER / 2)],
    ] as const)
      boxes.push({ x: nx, z: nz, w: 0.14, d: 0.14, h: TOWER_H, y: DECK, mat: "neon", solid: false });
    // the deck's lip on its two street sides, broken where the stair and the bridge arrive
    const lipZ = sz * (BZ0 + 0.2);
    boxes.push({ x: sx * (BX0 + 3.5), z: lipZ, w: 5, d: 0.4, h: 1.0, y: DECK, mat: "cover" });
    const lipX = sx * (BX0 + 0.2);
    boxes.push({ x: lipX, z: sz * (BZ0 + 2.5), w: 0.4, d: 3.4, h: 1.0, y: DECK, mat: "cover" });
    // neon along the deck's street edges, the city's kerb light a storey up
    boxes.push({ x: cx, z: sz * BZ0, w, d: 0.1, h: 0.08, y: DECK - 0.3, mat: "neon", solid: false });
    boxes.push({ x: sx * BX0, z: cz, w: 0.1, d, h: 0.08, y: DECK - 0.3, mat: "neon", solid: false });
    // a crate on the deck to fight round
    boxes.push({ x: sx * (BX0 + 4), z: sz * (BZ0 + 5.5), w: 1.6, d: 1.6, h: 1.1, y: DECK, mat: "crate" });
    // The stair: eight half-metre steps along the block's face on the street
    // it shares with the x-axis, climbing away from the crossing, so its top
    // step stands beside the deck's far end and the lip's gap.
    boxes.push(...stairs({ x: sx * (BX0 + 2), z: sz * (BZ0 - 1.3), dir: sx > 0 ? "+x" : "-x", steps: 8, rise: 0.5, tread: 0.9, width: 2.6, mat: "slab", cap: true }));
  }
}

// the skybridges, north and south, from deck to deck across the street between them
for (const sz of [-1, 1]) {
  boxes.push({ x: 0, z: sz * 16.5, w: BX0 * 2 + 0.2, d: 3, h: 0.3, y: DECK - 0.3, mat: "slab", walk: "bot" });
  for (const side of [-1, 1]) boxes.push({ x: 0, z: sz * 16.5 + side * 1.45, w: BX0 * 2, d: 0.1, h: 1.0, y: DECK, mat: "cover" });
  boxes.push({ x: 0, z: sz * 16.5 - 1.5, w: BX0 * 2, d: 0.1, h: 0.08, y: DECK - 0.36, mat: "neon", solid: false });
}

// the streets' cover: parked cars along the kerbs, barriers across the crossing's corners, and the middle kept open
const car = (x: number, z: number, alongX: boolean, alt: boolean): PlanBox => ({ x, z, w: alongX ? 4.2 : 1.9, d: alongX ? 1.9 : 4.2, h: 1.5, mat: alt ? "containerAlt" : "container" });
for (const s of [-1, 1]) {
  // (in the lane clear of the stairs, which take the street's last 2.6 m before each block)
  boxes.push(car(s * 12.5, s * 3.0, true, s > 0));
  boxes.push(car(-s * 16.5, s * 3.6, true, s < 0));
  boxes.push(car(s * 4.6, -s * 12, false, s > 0));
  // a lit kiosk across each street end, so the two ends of the long street do not see each other
  // (dressed as the blocks are: plain metal read as a black slab at night)
  boxes.push({ x: 0, z: s * 18.5, w: 4, d: 1, h: 2.4, mat: "wall" });
  for (const face of [-1, 1]) boxes.push({ x: 0, z: s * 18.5 + face * 0.55, w: 4, d: 0.08, h: 0.08, y: 2.3, mat: "neon", solid: false });
  // a crate in each alley on the blocks' rows: the alley is no longer one straight line from end to end,
  // and 0.9 m either side of it is still a way through
  for (const t of [-1, 1]) boxes.push({ x: t * 20.5, z: s * 10, w: 1.2, d: 1.2, h: 1.8, mat: "crate" });
  boxes.push({ x: s * 5.5, z: s * 5.5, w: 3, d: 0.6, h: 0.95, mat: "cover" });
  boxes.push({ x: -s * 5.5, z: s * 5.5, w: 0.6, d: 3, h: 0.95, mat: "cover" });
}

export const NEONBLOCK: ArenaPlan = {
  id: "neonblock",
  name: "NEON BLOCK",
  blurb: "A crossing cut out of the city at night: four decks a storey up joined by skybridges, and the fight in the streets under them.",
  x: 96,
  z: 118,
  halfX: 22,
  halfZ: 24,
  wallH: 16,
  roof: false,
  lights: [],
  girders: [],
  floorColor: 0x9aa0aa,
  look: "city",
  boxes,
  // one at each end of the long street behind its shelter, the rest in the alleys behind the blocks,
  // where a block stands between every spawn and every one of the other side
  spawns: [
    { x: 0, z: -22.5, yaw: yawToCentre(0, -22.5) },
    { x: 0, z: 22.5, yaw: yawToCentre(0, 22.5) },
    { x: -20.5, z: -22.5, yaw: yawToCentre(-20.5, -22.5) },
    { x: 20.5, z: 22.5, yaw: yawToCentre(20.5, 22.5) },
    { x: 20.5, z: -22.5, yaw: yawToCentre(20.5, -22.5) },
    { x: -20.5, z: 22.5, yaw: yawToCentre(-20.5, 22.5) },
    { x: -20.5, z: -12, yaw: yawToCentre(-20.5, -12) },
    { x: 20.5, z: 12, yaw: yawToCentre(20.5, 12) },
  ],
  teams: { a: [0, 2, 4, 6], b: [1, 3, 5, 7] },
  zones: [
    { id: "a", x: 0, z: -12 },
    { id: "b", x: 0, z: 0 },
    { id: "c", x: 0, z: 12 },
  ],
  crown: { x: 0, z: 0 },
  zips: [],
  bestFor: ["duel", "ffa", "tdm", "control"],
};
