// THE RUN (ADVANCED): nine rooms, 200 m, in the range's back-RIGHT corner.
// Each room's fast line is a technique, and the rooms chain them. Where the
// geometry only goes one way, the numbers come from tools/measure.ts on the
// real controller:
//
//   superglide off a 3 m ledge lands 7.6 m out on a 1 m pad, a sprint jump 6.4 m
//   a slide jump with a lurch 0.1 s in lands 2.9 m to the side
//   a zipline superjump peaks 5.0 m up; a jump plus a mantle reaches 3.4 m
//   jump, climb and mantle top out at 5.76 m, so a wall you must go over is
//   never taller than that, and a platform you must NOT climb floats above
//   head height (its underside over 1.83 m)
//
// The sim (tools/movesim.ts) drives each gate both ways: the technique makes
// it, the plain move does not.
import * as THREE from "three";
import { PAL, DEFAULT_WALL } from "../geo";
import { weaponName } from "../weapons";
import type { CourseLayout } from "../course";

/** where the course's x = 0 is in the world: its gate is at x 19.5 to 23.5 */
export const ADVANCED_X = 21.5;
const X0 = -12;
const X1 = 12;
const WALL_H = 8;
const FAR_Z = 210;

/** room 2: the ledge and the gap a superglide clears */
export const GLIDE = { ledgeZ0: 44, ledgeZ1: 47, ledgeH: 3.0, gapEnd: 54, landH: 1.0 };
/** room 3: the platform and the three pads, 1.4 m over the hazard */
export const STRAFE = {
  h: 1.4,
  a: { minZ: 64, maxZ: 68 },
  pads: [
    { minX: -4.4, maxX: -1.4, minZ: 69.5, maxZ: 73 },
    { minX: 1.4, maxX: 4.4, minZ: 74.5, maxZ: 78 },
    { minX: -4.4, maxX: -1.4, minZ: 79.5, maxZ: 82.5 },
  ],
  exit: { minZ: 82.5, maxZ: 84 },
};
/** room 5: the zip and the platform only a superjump reaches */
export const SUPERJUMP = {
  zip: { a: new THREE.Vector3(-8, 0.3, 108), b: new THREE.Vector3(-8, 7.2, 108) },
  plat: { minX: -12, maxX: -4, minZ: 109.2, maxZ: 113, base: 3.0, top: 4.6 },
  walk: { minX: -12, maxX: -4, minZ: 113, maxZ: 121, base: 3.0, top: 4.6 },
};
/** room 6: the deck you drop off, and the vent you slide under after */
export const DROP = { deck: { minZ: 126, maxZ: 129, top: 5 }, zip: { a: new THREE.Vector3(-9, 0.3, 125.4), b: new THREE.Vector3(-9, 7.2, 125.4) }, ventZ: 135 };
/** room 7: the deck and the long zip */
export const ZIP = {
  deck: { minX: -12, maxX: -4, minZ: 144, maxZ: 148, top: 5 },
  up: { a: new THREE.Vector3(-8, 0.3, 143.4), b: new THREE.Vector3(-8, 7.4, 143.4) },
  across: { a: new THREE.Vector3(-6, 7.4, 147.5), b: new THREE.Vector3(6, 3.0, 163) },
};

export const ADVANCED_COURSE: CourseLayout = {
  id: "advanced",
  title: "THE RUN: ADVANCED",
  x: ADVANCED_X,
  x0: X0,
  x1: X1,
  wallH: WALL_H,
  startZ: 12,
  finishZ: 208,
  farZ: FAR_Z,
  /** provisional until someone sets real times (ours) */
  ranks: [
    ["S", 80],
    ["A", 95],
    ["B", 120],
    ["C", Infinity],
  ],
  rooms: [
    {
      name: "VENTS",
      entryZ: 20,
      tipX: -4,
      tip:
        "VENTS\n\nTwo vents, on opposite sides. Sprint, slide under the first on the right, " +
        "stand and sprint across, slide under the second on the left. A slide from a " +
        "sprint carries the full 4 m; a slide from a walk does not. Two dummies past " +
        "the second. Out through the left-hand door.",
      trigger: (_x, _y, z) => z > 20.7,
      enemies: [
        { x: 0, z: 38.5, gun: "rspn101", sway: 0.35 },
        { x: -7, z: 37, gun: "semipistol" },
      ],
    },
    {
      name: "GLIDE",
      entryZ: 40,
      tipX: 3,
      tip:
        "GLIDE\n\nSprint into the ledge and mantle it. Jump in the last 0.15 s of the mantle " +
        "and crouch ONE frame later: the superglide throws you 7.6 m off the edge onto the " +
        "far pad, and the gap is 7 m. A plain jump lands 6.4 m out, in the red. Fall and you " +
        "restart the room with 2 s added. Three dummies on the pad. Out right.",
      trigger: (_x, _y, z) => z > 40.7,
      enemies: [
        { x: -7, y: 1.0, z: 58, gun: "rspn101" },
        { x: 0, y: 1.0, z: 60, gun: "semipistol", sway: 0.4 },
        { x: 8, y: 1.0, z: 58.5, gun: "rspn101" },
      ],
    },
    {
      name: "STRAFE",
      entryZ: 62,
      tipX: -4,
      tip:
        "STRAFE\n\nThree pads, each one off to the side of the last. Slide jump off the " +
        "edge, and in the air let go of W and tap the side (D for right, A for left): " +
        "the lurch turns you 60 degrees at full speed onto the pad. Straight jumps " +
        "land in the red. Two dummies on the far side. Out left.",
      trigger: (_x, _y, z) => z > 62.7,
      enemies: [
        { x: -8, y: 1.4, z: 83.3, gun: "semipistol" },
        { x: 8, y: 1.4, z: 83.3, gun: "rspn101", sway: 0.3 },
      ],
    },
    {
      name: "BOUNCE",
      entryZ: 84,
      tipX: 3,
      tip:
        "BOUNCE\n\nA slalom: two fins, left then right. Slide, jump out of the slide at each " +
        "fin's face on the diagonal, let go of W, and press jump as you touch it near the top " +
        "of the jump: the wallbounce sends you off the fin at 350 hu/s or more, round it, with " +
        "your speed. Running round costs a second a fin. Three dummies after the second. Out right.",
      trigger: (_x, _y, z) => z > 84.7,
      enemies: [
        { x: -8, z: 100, gun: "rspn101" },
        { x: 2, z: 101.5, gun: "semipistol", sway: 0.4 },
        { x: 8, z: 99, gun: "rspn101" },
      ],
    },
    {
      name: "SUPERJUMP",
      entryZ: 104,
      tipX: -4,
      tip:
        "SUPERJUMP\n\nThe yellow rope on your right. Stand at its foot, press E, and roll " +
        "the wheel up (two jumps in two frames): the zip jump and the coyote jump stack " +
        "and throw you 5 m up. Turn to the platform on the right as you rise and mantle " +
        "it: nothing else reaches it. Walk its length, drop off the end. Three below. Out left.",
      trigger: (_x, _y, z) => z > 104.7,
      enemies: [
        { x: 0, z: 116, gun: "rspn101", sway: 0.4 },
        { x: 8, z: 119, gun: "semipistol" },
        { x: 4, z: 122, gun: "rspn101" },
      ],
    },
    {
      name: "DROP",
      entryZ: 124,
      tipX: 3,
      tip:
        "DROP\n\nThe rope on your right takes you to the deck (the ladder is the slow way). " +
        "Sprint off the far edge holding crouch: 5 m is under the fall-stun height, and the " +
        "landing starts a slide. Keep crouch held and slide under the vent. Three past it. Out right.",
      trigger: (_x, _y, z) => z > 124.7,
      enemies: [
        { x: -6, z: 138, gun: "semipistol" },
        { x: 1, z: 140, gun: "rspn101", sway: 0.4 },
        { x: 8, z: 137.5, gun: "rspn101" },
      ],
    },
    {
      name: "ZIP",
      entryZ: 142,
      tipX: -4,
      tip:
        "ZIP\n\nUp the rope on your right to the deck, then E on the long zip. Four " +
        "dummies below as you ride; the rope ends at the left-hand door. Crouch to " +
        "drop early, or ride it out at full speed.",
      trigger: (_x, _y, z) => z > 142.7,
      enemies: [
        { x: 0, z: 151, gun: "rspn101", sway: 0.4 },
        { x: -8, z: 155, gun: "semipistol" },
        { x: 8, z: 157, gun: "rspn101" },
        { x: -2, z: 161, gun: "rspn101", sway: 0.3 },
      ],
    },
    {
      name: "FLOW",
      entryZ: 166,
      tipX: 3,
      tip:
        "FLOW\n\nTwo low walls. Slide, jump the wall out of the slide, keep W held and " +
        "land in a slide for the next. Four dummies between the walls. Out right.",
      trigger: (_x, _y, z) => z > 166.7,
      enemies: [
        { x: -8, z: 174, gun: "rspn101" },
        { x: 6, z: 175.5, gun: "semipistol", sway: 0.4 },
        { x: 8, z: 181, gun: "rspn101" },
        { x: -5, z: 183, gun: "rspn101", sway: 0.3 },
      ],
    },
    {
      name: "FINAL",
      entryZ: 186,
      tipX: -4,
      tip:
        "FINAL\n\nHolster (3) to sprint 15% faster, draw and drop all six, and cross the line. " +
        "Slide jump the cover instead of going round it.",
      trigger: (_x, _y, z) => z > 186.7,
      enemies: [
        { x: 8, z: 191, gun: "rspn101" },
        { x: -8, z: 193, gun: "semipistol", sway: 0.4 },
        { x: 0, z: 197, gun: "rspn101" },
        { x: 6, z: 201, gun: "semipistol", sway: 0.3 },
        { x: -6, z: 203, gun: "rspn101" },
        { x: 0, z: 206.5, gun: "rspn101", sway: 0.5 },
      ],
    },
  ],
  dividers: [
    { z: 20, door: [5, 9] },
    { z: 40, door: [5, 9] },
    { z: 62, door: [-9, -5] },
    { z: 84, door: [5, 9] },
    { z: 104, door: [-9, -5] },
    { z: 124, door: [5, 9] },
    { z: 142, door: [-9, -5] },
    { z: 166, door: [5, 9] },
    { z: 186, door: [-9, -5] },
  ],
  themes: [
    { wall: DEFAULT_WALL, trim: PAL.orange },
    { wall: { top: "#3f6a70", bottom: "#345a60", words: ["#f1efe6", "#ffb03a", "#9ff0ff", "#1a1d21", "#ffd23c"] }, trim: 0x2fd0e8 },
    { wall: { top: "#4f3f6e", bottom: "#43355e", words: ["#ff5ad4", "#9ff0ff", "#f1efe6", "#ffd23c", "#7ddc8a"] }, trim: 0xb04cff },
    { wall: { top: "#7a3a36", bottom: "#682f2c", words: ["#f1efe6", "#ffd23c", "#1a1d21", "#9ff0ff", "#ff9f43"] }, trim: 0xff3b2f },
    { wall: { top: "#5f6a45", bottom: "#525c3b", words: ["#e8e0c8", "#ff7a2a", "#1a1d21", "#ffd23c", "#b8e0ff"] }, trim: 0xa8c93a },
    { wall: { top: "#8a7a3a", bottom: "#776832", words: ["#1a1d21", "#f1efe6", "#d4302a", "#1a1d21", "#2fd0e8"] }, trim: 0xffd23c },
    { wall: { top: "#7a5a44", bottom: "#6a4b38", words: ["#ffd23c", "#f1efe6", "#2fd0e8", "#1a1d21", "#ff7a3a"] }, trim: 0xff7a3a },
    { wall: { top: "#355e7a", bottom: "#2c4f68", words: ["#f1efe6", "#ffd23c", "#ff7a3a", "#9ff0ff", "#1a1d21"] }, trim: 0x3b8bff },
    { wall: { top: "#6a3f5e", bottom: "#5a3450", words: ["#9ff0ff", "#ffd23c", "#f1efe6", "#ff5ad4", "#1a1d21"] }, trim: 0xff5ad4 },
    { wall: { top: "#c9ccd1", bottom: "#b3b7bd", words: ["#d9a441", "#1a1d21", "#d4302a", "#3b8bff", "#d9a441"] }, trim: 0xd9a441 },
  ],
  segments: [9, 20, 40, 62, 84, 104, 124, 142, 166, 186, FAR_Z],
  hazards: [
    { minZ: GLIDE.ledgeZ1, maxZ: GLIDE.gapEnd, fallY: 0.7, respawn: new THREE.Vector3(7, 0, 41.5) },
    { minZ: STRAFE.a.maxZ, maxZ: STRAFE.exit.minZ, fallY: 0.7, respawn: new THREE.Vector3(0, STRAFE.h, 66) },
  ],
  tv: { x: 7, y: 2.7, z: 9.03, w: 5.2, h: 2.9 },
  returnTo: { x: 7, z: 11.4, yaw: 0, pitch: 3 },
  startPose: { x: 0, z: 10.2, yaw: 180 },
  sign:
    "THE RUN: ADVANCED\n\nNine rooms, 200 m, thirty dummies. Every room's fast line is a technique: " +
    "slides, a superglide gap, lurch pads, wallbounces, a zipline superjump, a drop slide, a shooting zip. " +
    "Gaps you fall in put you back at the room's entrance with 2 s added. Each dummy left standing adds 3 s. " +
    `Starting the run equips the ${weaponName("semipistol")} and the ${weaponName("g17")}.\n\n` +
    "Every room's fast line is written on the wall you came in by: turn round.\n\nF resets the course.",
  girders: [-6, 6],
  lights: [-3, 3],
  build(b) {
    const { coverMat, platMat, roomMat } = b;
    const vent = (z: number, crawlX0: number, crawlX1: number) => {
      // full-height wall either side of the crawl, a slab over it at 1.25 m
      if (crawlX0 > X0) b.box(crawlX0 - X0, WALL_H, 1, (X0 + crawlX0) / 2, 0, z, roomMat(z));
      if (crawlX1 < X1) b.box(X1 - crawlX1, WALL_H, 1, (crawlX1 + X1) / 2, 0, z, roomMat(z));
      b.box(crawlX1 - crawlX0, WALL_H - 1.25, 1, (crawlX0 + crawlX1) / 2, 1.25, z, roomMat(z));
      b.glow(crawlX1 - crawlX0, 0.06, 1.02, (crawlX0 + crawlX1) / 2, 1.19, z, 0xffb03a);
    };

    // --- room 1: two vents on opposite sides (facing +z, +x is on your left)
    vent(27, -12, -4);
    vent(34, 4, 12);

    // --- room 2: the superglide ledge, the gap, the 1 m landing pad (a pad, not
    // the floor: a flight to floor level dips under the fall line before it lands)
    b.box(X1 - X0, GLIDE.ledgeH, GLIDE.ledgeZ1 - GLIDE.ledgeZ0, 0, 0, (GLIDE.ledgeZ0 + GLIDE.ledgeZ1) / 2, platMat);
    b.hazardFloor(GLIDE.ledgeZ1, GLIDE.gapEnd);
    b.box(X1 - X0, GLIDE.landH, 62 - GLIDE.gapEnd, 0, 0, (GLIDE.gapEnd + 62) / 2, platMat);
    // the landing's edge lit, so the gap reads from the ledge
    b.glow(X1 - X0, 0.05, 0.15, 0, GLIDE.landH, GLIDE.gapEnd + 0.1, 0x7ddc8a, 1.4);
    // the doorway into room 3 is at pad height
    b.box(4, GLIDE.landH, 1.02, -7, 0, 62, platMat);

    // --- room 3: in at 1 m, a step up onto the platform, three pads over the red, the exit strip
    b.box(X1 - X0, GLIDE.landH, 1.5, 0, 0, 63.25, platMat);
    b.box(X1 - X0, STRAFE.h, STRAFE.a.maxZ - STRAFE.a.minZ, 0, 0, (STRAFE.a.minZ + STRAFE.a.maxZ) / 2, platMat);
    for (const p of STRAFE.pads) b.box(p.maxX - p.minX, STRAFE.h, p.maxZ - p.minZ, (p.minX + p.maxX) / 2, 0, (p.minZ + p.maxZ) / 2, platMat);
    b.box(X1 - X0, STRAFE.h, STRAFE.exit.maxZ - STRAFE.exit.minZ, 0, 0, (STRAFE.exit.minZ + STRAFE.exit.maxZ) / 2, platMat);
    // the doorway into room 4 is at platform height: a floor through the wall
    b.box(4, STRAFE.h, 1.02, 7, 0, 84, platMat);
    b.hazardFloor(STRAFE.a.maxZ, STRAFE.exit.minZ);

    // --- room 4: a deck to step down from, then two fins to bounce round
    b.box(X1 - X0, STRAFE.h, 3, 0, 0, 86, platMat);
    b.box(12, WALL_H, 0.6, -6, 0, 91, roomMat(91));
    b.box(12, WALL_H, 0.6, 6, 0, 97, roomMat(97));
    // a stripe up each fin's bounce face, the way the practice wall is painted
    b.glow(0.04, 1.2, 0.62, 0 - 0.03, 0.48, 91, 0x7ddc8a, 1.2);
    b.glow(0.04, 1.2, 0.62, 0 + 0.03, 0.48, 97, 0x7ddc8a, 1.2);

    // --- room 5: the zip and the floating platform, the walkway, a drop to the floor
    b.zipline(SUPERJUMP.zip.a, SUPERJUMP.zip.b, { vertical: true });
    for (const p of [SUPERJUMP.plat, SUPERJUMP.walk]) {
      b.box(p.maxX - p.minX, p.top - p.base, p.maxZ - p.minZ, (p.minX + p.maxX) / 2, p.base, (p.minZ + p.maxZ) / 2, roomMat(110));
    }
    // a rail along the walkway's open side
    b.box(0.07, 0.07, SUPERJUMP.walk.maxZ - SUPERJUMP.plat.minZ, SUPERJUMP.plat.maxX - 0.1, SUPERJUMP.plat.top + 1.0, (SUPERJUMP.plat.minZ + SUPERJUMP.walk.maxZ) / 2, b.flat(PAL.orange, 0.55, 0.25), false);
    b.box(1.6, 1.2, 1.2, 4, 0, 118, coverMat);

    // --- room 6: the deck (zip and ladder up), the drop, the vent after it
    b.box(X1 - X0, DROP.deck.top, DROP.deck.maxZ - DROP.deck.minZ, 0, 0, (DROP.deck.minZ + DROP.deck.maxZ) / 2, roomMat(127));
    b.zipline(DROP.zip.a, DROP.zip.b, { vertical: true });
    b.ladder(5, DROP.deck.minZ, 0, -1, 0, DROP.deck.top);
    vent(DROP.ventZ, -2, 6);

    // --- room 7: the deck on the right, up by zip, the long zip to the exit
    const dk = ZIP.deck;
    b.box(dk.maxX - dk.minX, dk.top, dk.maxZ - dk.minZ, (dk.minX + dk.maxX) / 2, 0, (dk.minZ + dk.maxZ) / 2, roomMat(146));
    b.box(0.07, 0.07, dk.maxZ - dk.minZ, dk.maxX - 0.1, dk.top + 1.0, (dk.minZ + dk.maxZ) / 2, b.flat(PAL.orange, 0.55, 0.25), false);
    b.zipline(ZIP.up.a, ZIP.up.b, { vertical: true });
    b.zipline(ZIP.across.a, ZIP.across.b, { vertical: false, floorA: dk.top, floorB: 0 });
    b.box(1.6, 1.3, 1.6, 4, 0, 154, coverMat);
    b.box(1.6, 1.3, 1.6, -5, 0, 159, coverMat);

    // --- room 8: two low walls to slide jump
    b.box(14, 1.1, 0.8, -5, 0, 171, coverMat);
    b.box(14, 1.1, 0.8, 5, 0, 178, coverMat);
    b.box(1.6, 1.3, 1.6, 8, 0, 174.5, coverMat);

    // --- room 9: cover for the last six
    b.box(2, 1.2, 1.2, 4, 0, 192, coverMat);
    b.box(2, 1.2, 1.2, -4, 0, 195, coverMat);
    b.box(6, 1.1, 0.8, 0, 0, 200, coverMat);
    b.box(2, 1.2, 1.2, 5, 0, 204, coverMat);
  },
};
