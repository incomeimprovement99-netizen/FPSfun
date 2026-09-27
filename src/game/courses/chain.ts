// THE CHAIN: the centre's chain modules as a course in the range (Phase 21 4.6, docs/PHASE_21_LAYOUT.md), SpeedKills
// only, in the middle of the range's back wall between the other two. The owner can play the distances the city is
// built to: a run gap, a double gap, a wall gap and a chimney, each at the width the measured movement gives it.
//
// Every gap is worked out from src/config/reach.json when this loads (src/config/chaincourse.json says how), so a
// retune of the movement moves them. tools/checks/sk-chaincourse.ts drives the real controller through this very
// geometry: each gap is landed clean with its move and not with the one below it, and the chimney is climbed to its
// landing and on to its top. The chimney is the city's (city.json chimneys), the same walls to the centimetre.
//
// Course coordinates (course.ts): x across, z from the gate at 9; running it you face +z, and +x is on your LEFT.
import * as THREE from "three";
import { PAL, DEFAULT_WALL } from "../geo";
import type { CourseLayout } from "../course";
import reach from "../../config/reach.json";
import cfg from "../../config/chaincourse.json";
import cityCfg from "../../config/city.json";

/** where the course's x = 0 is in the world: the middle of the range's back wall */
export const CHAIN_X = 0;
/** its walls' inner faces; the other two courses' walls stand 0.5 m beyond each */
const X0 = -7;
const X1 = 7;
const Ch = cityCfg.chimneys;
/** the chimney's top, two rises up */
const TOP = Ch.rise * 2;
const WALL_H = TOP + 4;
const cm = (x: number) => Math.round(x * 100) / 100;

/** the three gaps, metres, from the measured reach */
export const GAPS = {
  run: cm(reach.jump.carry / cfg.runSpare),
  double: cm((reach.jump.carry * cfg.over + reach.doubleJump.carry * cfg.under) / 2),
  wall: cm((reach.doubleJump.carry * cfg.over + reach.wallKick.carry * cfg.under) / 2),
};

/** a gap room from its door at `entryZ`: the deck you climb (a0 to a1), the pit, the deck you land on (b0 to b1) */
export interface GapRoom {
  entryZ: number;
  a0: number;
  a1: number;
  b0: number;
  b1: number;
  /** the next room's door: the floor past the landing deck, to drop down to */
  exitZ: number;
}
function gapRoom(entryZ: number, gap: number): GapRoom {
  const a0 = entryZ + 3;
  const a1 = a0 + cfg.runUp;
  const b0 = cm(a1 + gap);
  const b1 = cm(b0 + cfg.landing);
  return { entryZ, a0, a1, b0, b1, exitZ: Math.ceil(b1 + 4) };
}
export const RUN = gapRoom(20, GAPS.run);
export const DOUBLE = gapRoom(RUN.exitZ, GAPS.double);
export const WALLGAP = gapRoom(DOUBLE.exitZ, GAPS.wall);
/** the deck's height, and the height over a pit below which you have fallen */
export const DECK = cfg.deck;
export const FALL_Y = cfg.deck - cfg.fallBelow;
/** the runnable wall of the wall gap: the course's own right-hand wall (facing +z), its inner face */
export const WALL_X = X0;

/** the chimney: in at z0 (the near end) running +z, the landing at the far end (z1), the top back at the near end */
export const CHIMNEY = { x: -4.5, z0: WALLGAP.exitZ + 3, z1: WALLGAP.exitZ + 3 + Ch.length, innerW: Ch.width, landing: Ch.rise, top: TOP };
/** the deck beside the top, over the chimney's left wall, and the zip from it to the finish */
export const EXIT = { x0: CHIMNEY.x + Ch.width / 2 + Ch.wall, z0: CHIMNEY.z0 - 1, z1: CHIMNEY.z0 + 4 };
const FINISH_Z = CHIMNEY.z1 + 14;
const FAR_Z = FINISH_Z + 6;
export const EXIT_ZIP = { a: new THREE.Vector3(3, TOP + 2.4, EXIT.z1 - 0.5), b: new THREE.Vector3(3, 3.0, FINISH_Z - 2) };

const tip = (name: string, body: string) => `${name}\n\n${body}`;

export const CHAIN_COURSE: CourseLayout = {
  id: "chain",
  title: "THE CHAIN",
  x: CHAIN_X,
  x0: X0,
  x1: X1,
  wallH: WALL_H,
  startZ: 12,
  finishZ: FINISH_Z,
  farZ: FAR_Z,
  /** provisional until the owner sets real times (ours) */
  ranks: [
    ["S", 35],
    ["A", 45],
    ["B", 60],
    ["C", Infinity],
  ],
  rooms: [
    {
      name: "RUN GAP",
      entryZ: RUN.entryZ,
      tipX: -3,
      tip: tip("RUN GAP", `Climb the deck, sprint its length and jump at the edge: ${GAPS.run.toFixed(1)} m, a sprint jump with a fifth to spare. Run off without jumping and you fall in.`),
      trigger: (_x, _y, z) => z > RUN.entryZ + 0.7,
      enemies: [],
    },
    {
      name: "DOUBLE GAP",
      entryZ: DOUBLE.entryZ,
      tipX: 3,
      tip: tip("DOUBLE GAP", `${GAPS.double.toFixed(1)} m: one jump falls short. Jump at the edge, and jump again at the top of it.`),
      trigger: (_x, _y, z) => z > DOUBLE.entryZ + 0.7,
      enemies: [],
    },
    {
      name: "WALL GAP",
      entryZ: WALLGAP.entryZ,
      tipX: 3,
      tip: tip("WALL GAP", `${GAPS.wall.toFixed(1)} m, past any jump. Sprint beside the lit wall on your right, jump at the edge into a wall run along it, and kick off (jump) late in the run, 1.2 to 1.4 s in. The run alone falls short.`),
      trigger: (_x, _y, z) => z > WALLGAP.entryZ + 0.7,
      enemies: [],
    },
    {
      name: "CHIMNEY",
      entryZ: WALLGAP.exitZ,
      tipX: 3,
      tip: tip("CHIMNEY", `Two walls ${Ch.width.toFixed(1)} m apart. Sprint in beside one, jump, and kick across to the other a quarter second into each wall run: three kicks reach the landing ${Ch.rise} m up. Turn round on it and kick on up to the top, ${TOP} m. The zip off the top goes to the finish.`),
      trigger: (_x, _y, z) => z > WALLGAP.exitZ + 0.7,
      enemies: [],
    },
  ],
  dividers: [
    { z: RUN.entryZ, door: [3, 7] },
    { z: DOUBLE.entryZ, door: [-7, -3] },
    // in on the right, beside the wall you run
    { z: WALLGAP.entryZ, door: [-7, -3] },
    // in line with the chimney's mouth
    { z: WALLGAP.exitZ, door: [-7, -3] },
  ],
  themes: [
    { wall: DEFAULT_WALL, trim: PAL.orange },
    { wall: { top: "#3f6a70", bottom: "#345a60", words: ["#f1efe6", "#ffb03a", "#9ff0ff", "#1a1d21", "#ffd23c"] }, trim: 0x2fd0e8 },
    { wall: { top: "#4f3f6e", bottom: "#43355e", words: ["#ff5ad4", "#9ff0ff", "#f1efe6", "#ffd23c", "#7ddc8a"] }, trim: 0xb04cff },
    { wall: { top: "#7a3a36", bottom: "#682f2c", words: ["#f1efe6", "#ffd23c", "#1a1d21", "#9ff0ff", "#ff9f43"] }, trim: 0xff3b2f },
    { wall: { top: "#6a3f5e", bottom: "#5a3450", words: ["#9ff0ff", "#ffd23c", "#f1efe6", "#ff5ad4", "#1a1d21"] }, trim: 0xff5ad4 },
  ],
  segments: [9, RUN.entryZ, DOUBLE.entryZ, WALLGAP.entryZ, WALLGAP.exitZ, FAR_Z],
  hazards: [RUN, DOUBLE, WALLGAP].map((r) => ({ minZ: r.a1, maxZ: r.b0, fallY: FALL_Y, respawn: new THREE.Vector3(0, 0, r.entryZ + 1.5) })),
  tv: { x: 3.4, y: 2.7, z: 9.03, w: 5.2, h: 2.9 },
  returnTo: { x: 3.4, z: 11.4, yaw: 0, pitch: 3 },
  startPose: { x: 0, z: 10.2, yaw: 180 },
  sign:
    "THE CHAIN\n\nThe city's moves at the distances it is built to, measured on the real movement: a RUN GAP (a sprint jump), " +
    "a DOUBLE GAP (the double jump), a WALL GAP (a wall run and the kick off it), and the CHIMNEY: kick wall to wall to its " +
    "landing, turn, and on to its top. The zip from the top goes to the finish.\n\n" +
    "Fall into a gap and the room restarts with 2 s added. Every room's way is written on the wall you came in by: turn round.\n\nF resets the course.",
  girders: [-4, 4],
  lights: [-2, 2],
  build(b) {
    const { platMat, roomMat } = b;
    const lit = parseInt(cfg.chainColor.slice(1), 16);
    // the three gap rooms: a deck to climb, the pit, the deck you land on, then down to the floor for the next door
    for (const r of [RUN, DOUBLE, WALLGAP]) {
      b.box(X1 - X0, DECK, r.a1 - r.a0, 0, 0, (r.a0 + r.a1) / 2, platMat);
      b.box(X1 - X0, DECK, r.b1 - r.b0, 0, 0, (r.b0 + r.b1) / 2, platMat);
      b.hazardFloor(r.a1, r.b0);
      // both edges lit, so the gap reads from the take-off
      b.glow(X1 - X0, 0.05, 0.15, 0, DECK, r.a1 - 0.1, 0x7ddc8a, 1.4);
      b.glow(X1 - X0, 0.05, 0.15, 0, DECK, r.b0 + 0.1, 0x7ddc8a, 1.4);
    }
    // the wall gap's wall: the chain line along its face at a wall run's height, from the take-off to the landing
    b.glow(0.04, 0.12, WALLGAP.b0 - WALLGAP.a1 + 6, WALL_X + 0.03, DECK + 2.2, (WALLGAP.a1 + WALLGAP.b0) / 2, lit, 1.6);

    // the chimney, as city.ts builds them: two walls, the far end closed, the near end closed above the landing's
    // height (the way in open below it), the landing at the far end and the top at the near end
    const C = CHIMNEY;
    const len = C.z1 - C.z0;
    for (const s of [-1, 1]) {
      b.box(Ch.wall, TOP + 0.4, len, C.x + s * (Ch.width / 2 + Ch.wall / 2), 0, (C.z0 + C.z1) / 2, roomMat(C.z0 + 1));
      b.glow(0.04, 0.12, len, C.x + s * (Ch.width / 2 - 0.02), 2.2, (C.z0 + C.z1) / 2, lit, 1.6);
    }
    b.box(Ch.width + Ch.wall * 2, TOP + 0.4, Ch.wall, C.x, 0, C.z1 + Ch.wall / 2, roomMat(C.z1));
    b.box(Ch.width + Ch.wall * 2, TOP + 0.4 - Ch.rise, Ch.wall, C.x, Ch.rise, C.z0 - Ch.wall / 2, roomMat(C.z0));
    b.box(Ch.width, 0.3, Ch.landing, C.x, Ch.rise - 0.3, C.z1 - Ch.landing / 2, platMat);
    b.box(Ch.width, 0.3, Ch.landing, C.x, TOP - 0.3, C.z0 + Ch.landing / 2, platMat);
    // off the top: over the wall's cap onto the deck beside it, and the zip down to the finish
    b.box(X1 - EXIT.x0, 0.3, EXIT.z1 - EXIT.z0, (EXIT.x0 + X1) / 2, TOP - 0.3, (EXIT.z0 + EXIT.z1) / 2, platMat);
    b.box(0.07, 0.07, EXIT.z1 - EXIT.z0, X1 - 0.1, TOP + 1.0, (EXIT.z0 + EXIT.z1) / 2, b.flat(PAL.orange, 0.55, 0.25), false);
    b.zipline(EXIT_ZIP.a, EXIT_ZIP.b, { vertical: false, floorA: TOP, floorB: 0 });
  },
};
