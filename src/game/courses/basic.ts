// THE RUN (BASIC): seven rooms, one technique each, in the range's back-left
// corner. The layout that was the only course before the advanced one.
import * as THREE from "three";
import { PAL, DEFAULT_WALL } from "../geo";
import { weaponName } from "../weapons";
import type { CourseLayout } from "../course";

/** where the course's x = 0 is in the world: its gate is at x -23.5 to -19.5 */
export const BASIC_X = -21.5;
const X0 = -12;
const X1 = 12;
const WALL_H = 7; // taller than the 6.48 m a climb plus mantle can reach
const FAR_Z = 132;

/** room 5's hazard: below this height inside the room you have fallen */
const GAP_ROOM = { minZ: 80.5, maxZ: 92.5, fallY: 0.7, respawn: new THREE.Vector3(8, 1.4, 81.6) };
/** room 6: the deck the vertical zip and the ladder reach, and the two zips */
const ZIP_DECK = { minX: -12, maxX: -2, minZ: 96, maxZ: 100, top: 4.5 };
const ZIP_UP = { a: new THREE.Vector3(-10, 0.3, 95.4), b: new THREE.Vector3(-10, 6.9, 95.4) };
const ZIP_ACROSS = { a: new THREE.Vector3(-4, 6.9, 99.4), b: new THREE.Vector3(5, 3.4, 113) };

export const BASIC_COURSE: CourseLayout = {
  id: "basic",
  title: "THE RUN",
  x: BASIC_X,
  x0: X0,
  x1: X1,
  wallH: WALL_H,
  startZ: 12,
  finishZ: 130,
  farZ: FAR_Z,
  /** provisional until someone sets real times; A and B are The Pit's star times plus the zip room */
  ranks: [
    ["S", 34],
    ["A", 40],
    ["B", 50],
    ["C", Infinity],
  ],
  rooms: [
    {
      name: "BREACH",
      entryZ: 20,
      tipX: -4,
      tip:
        "BREACH\n\nYou come in on the left: drop the left dummy first. Sprint right, " +
        "jump the low wall and take the centre and right dummies as you land. " +
        "Out through the right-hand door.",
      trigger: (_x, _y, z) => z > 20.7,
      enemies: [
        { x: 8.5, z: 30.5, gun: "rspn101", sway: 0.35 },
        { x: 0, z: 30, gun: "semipistol" },
        { x: -9, z: 31.5, gun: "rspn101" },
      ],
    },
    {
      name: "VENT",
      entryZ: 33,
      tipX: 3,
      tip:
        "VENT\n\nThe vent is straight ahead of the door. Sprint and slide under it, " +
        "holding crouch until you are through: you cannot stand up underneath. Two " +
        "dummies pop up on the far side. Out through the left-hand door.",
      trigger: (_x, _y, z) => z > 40.7,
      enemies: [
        { x: 5, z: 45.5, gun: "semipistol" },
        { x: -1.5, z: 44.5, gun: "rspn101", sway: 0.4 },
      ],
    },
    {
      name: "CLIMB",
      entryZ: 47,
      tipX: -4,
      tip:
        "CLIMB\n\nThe ladder straight ahead marks the climb. Jump into the wall " +
        "holding W to climb it, and keep W held at the top to mantle over. Slide " +
        "down the ramp to pick up speed. Three dummies below. Out through the " +
        "right-hand door.",
      trigger: (_x, y, z) => z > 51.5 && y > 3.5,
      enemies: [
        { x: -6, z: 63, gun: "rspn101" },
        { x: 6, z: 62.5, gun: "semipistol" },
        { x: 0, z: 64, gun: "rspn101", sway: 0.45 },
      ],
    },
    {
      name: "SUPERGLIDE",
      entryZ: 66,
      tipX: 3,
      tip:
        "SUPERGLIDE\n\nSprint into the ledge. At the very end of the mantle press " +
        "jump, then crouch one frame later: you leave at 400 hu/s. Three dummies " +
        "up top. Out through the left-hand door.",
      trigger: (_x, _y, z) => z > 69,
      enemies: [
        { x: -7, y: 1.4, z: 77, gun: "semipistol" },
        { x: 0, y: 1.4, z: 78.5, gun: "rspn101", sway: 0.4 },
        { x: 7.5, y: 1.4, z: 76, gun: "rspn101" },
      ],
    },
    {
      name: "GAP",
      entryZ: 80,
      tipX: -4,
      tip:
        "GAP\n\nThe far platform is off to the right. Slide jump straight off the " +
        "end at full speed, then keep W held and tap D in the air: a forward-right " +
        "lurch that keeps your speed. Or jump diagonally. Fall and you restart " +
        "this room with 2 s added. Two dummies across the gap. Out right.",
      trigger: (_x, _y, z) => z > 82,
      enemies: [
        { x: -6, y: 1.4, z: 92, gun: "rspn101" },
        { x: 0.5, y: 1.4, z: 92.3, gun: "semipistol", sway: 0.3 },
      ],
    },
    {
      name: "ZIPLINE",
      entryZ: 93,
      tipX: 3,
      tip:
        "ZIPLINE\n\nThe yellow rope on your right goes straight up: look at it, press E, " +
        "and it carries you to the deck (the ladder beside it is the slow way). On " +
        "the deck, E on the long zip and shoot the three below as you ride. Ride it " +
        "to the end to leave at full speed, or crouch to drop off. Out left.",
      trigger: (_x, _y, z) => z > 94.5,
      enemies: [
        { x: 1, z: 105, gun: "rspn101", sway: 0.4 },
        { x: -8, z: 109.5, gun: "semipistol" },
        { x: 9.5, z: 104, gun: "rspn101" },
      ],
    },
    {
      name: "FINAL",
      entryZ: 117,
      tipX: -4,
      tip:
        "FINAL SPRINT\n\nHolster (3) to sprint 15% faster, draw and drop all four, " +
        "and cross the line.",
      trigger: (_x, _y, z) => z > 118,
      enemies: [
        { x: 8, z: 123.5, gun: "rspn101" },
        { x: -8, z: 126.5, gun: "semipistol", sway: 0.4 },
        { x: 3, z: 128.5, gun: "rspn101" },
        { x: -3, z: 122.5, gun: "semipistol", sway: 0.3 },
      ],
    },
  ],
  dividers: [
    { z: 20, door: [5, 9] },
    { z: 33, door: [-9, -5] },
    { z: 47, door: [5, 9] },
    { z: 66, door: [-9, -5] },
    { z: 80, door: [5, 9] },
    { z: 93, door: [-9, -5] },
    { z: 117, door: [5, 9] },
  ],
  /**
   * Each room its own look: wall paint and spray colours, and the door trim you
   * walk through into it. Index 0 is the start area, then the seven rooms in
   * order; segments are where each one's walls begin and end.
   */
  themes: [
    { wall: DEFAULT_WALL, trim: PAL.orange },
    { wall: { top: "#7a5a44", bottom: "#6a4b38", words: ["#ffd23c", "#f1efe6", "#2fd0e8", "#1a1d21", "#ff7a3a"] }, trim: 0xff7a3a },
    { wall: { top: "#3f6a70", bottom: "#345a60", words: ["#f1efe6", "#ffb03a", "#9ff0ff", "#1a1d21", "#ffd23c"] }, trim: 0x2fd0e8 },
    { wall: { top: "#5f6a45", bottom: "#525c3b", words: ["#e8e0c8", "#ff7a2a", "#1a1d21", "#ffd23c", "#b8e0ff"] }, trim: 0xa8c93a },
    { wall: { top: "#4f3f6e", bottom: "#43355e", words: ["#ff5ad4", "#9ff0ff", "#f1efe6", "#ffd23c", "#7ddc8a"] }, trim: 0xb04cff },
    { wall: { top: "#7a3a36", bottom: "#682f2c", words: ["#f1efe6", "#ffd23c", "#1a1d21", "#9ff0ff", "#ff9f43"] }, trim: 0xff3b2f },
    { wall: { top: "#8a7a3a", bottom: "#776832", words: ["#1a1d21", "#f1efe6", "#d4302a", "#1a1d21", "#2fd0e8"] }, trim: 0xffd23c },
    { wall: { top: "#c9ccd1", bottom: "#b3b7bd", words: ["#d9a441", "#1a1d21", "#d4302a", "#3b8bff", "#d9a441"] }, trim: 0xd9a441 },
  ],
  segments: [9, 20, 33, 47, 66, 80, 93, 117, FAR_Z],
  hazards: [GAP_ROOM],
  // right of the gate: the left side has the rules sign and a range pillar behind the wall
  tv: { x: 7, y: 2.7, z: 9.03, w: 5.2, h: 2.9 },
  returnTo: { x: 7, z: 11.4, yaw: 0, pitch: 3 },
  startPose: { x: 0, z: 10.2, yaw: 180 },
  sign:
    "THE RUN\n\nCross the green line to start the clock and the gold line to stop it. " +
    "Drop every armed dummy: each one left standing adds 3 s. Starting the run equips " +
    `the ${weaponName("semipistol")} and the ${weaponName("g17")}; your guns come back when you finish. E rides a zipline.\n\n` +
    "Every room's fastest route is written on the wall you came in by. " +
    "You will only see it if you turn round.\n\nF resets the course.",
  girders: [-6, 6],
  lights: [-3, 3],
  build(b) {
    const { coverMat, platMat, roomMat } = b;

    // --- room 1: a low wall across the middle to jump over
    b.box(11, 1.0, 0.8, -1.5, 0, 26.4, coverMat);
    b.box(1.6, 1.3, 1.6, 6, 0, 24.5, coverMat);

    // --- room 2: the vent. A wall across z = 40 with a crawl space under a
    // slab at 1.25 m: 1.19 m crouched fits, 1.83 m standing does not.
    b.box(-9 - X0, WALL_H, 1, (X0 - 9) / 2, 0, 40, roomMat(40));
    b.box(X1 + 5, WALL_H, 1, (-5 + X1) / 2, 0, 40, roomMat(40));
    b.box(4, WALL_H - 1.25, 1, -7, 1.25, 40, roomMat(40));
    b.glow(4, 0.06, 1.02, -7, 1.19, 40, 0xffb03a);

    // --- room 3: a 4.2 m wall you must climb (a jump plus a mantle tops out
    // at 3.45 m), then a ramp down at 30 degrees to slide. A ladder on it,
    // straight ahead of the door, says where.
    b.box(X1 - X0, 4.2, 1, 0, 0, 52.5, roomMat(52.5));
    b.ladder(7, 52, 0, -1, 0, 4.2);
    const rampTopZ = 53;
    const rampH = 4.2;
    const angle = 0.5313;
    const run = rampH / Math.tan(angle);
    const rampLen = rampH / Math.sin(angle);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0, 0.3, rampLen), platMat);
    ramp.position.set(0, rampH / 2 - 0.15, rampTopZ + run / 2);
    ramp.rotation.x = angle; // rises toward -z, matching the colliders
    ramp.receiveShadow = true;
    ramp.castShadow = true;
    b.add(ramp);
    const STEPS = 16;
    for (let i = 0; i < STEPS; i++) {
      const t0 = i / STEPS;
      b.solid(X0, X1, rampTopZ + run * t0, rampTopZ + run * ((i + 1) / STEPS), 0, rampH * (1 - t0));
    }

    // --- room 4: a 1.4 m ledge the width of the room, platform to the wall
    b.box(X1 - X0, 1.4, 80 - 0.5 - 70, 0, 0, (70 + 79.5) / 2, platMat);

    // the doorway from room 4 into room 5 is at platform height, so it needs
    // a floor through the wall's thickness or you drop into a 1 m slot
    b.box(4, 1.4, 1.02, 7, 0, 80, platMat);

    // --- room 5: two platforms at 1.4 m and a gap between them
    b.box(X1 - 5, 1.4, 85 - 80.5, (5 + X1) / 2, 0, (80.5 + 85) / 2, platMat);
    // Landing platform x -8..4: a straight jump off the start platform (whose
    // edge is x 5) misses it; a diagonal jump or a forward-right lurch lands.
    b.box(4 - -8, 1.4, 92.5 - 88, (-8 + 4) / 2, 0, (88 + 92.5) / 2, platMat);
    b.hazardFloor(GAP_ROOM.minZ, GAP_ROOM.maxZ);

    // --- room 6: the zipline room. A 4.5 m deck on the right, a vertical zip
    // up its face and a ladder beside it, and a long zip from the deck down
    // across the room to the exit.
    const dk = ZIP_DECK;
    b.box(dk.maxX - dk.minX, dk.top, dk.maxZ - dk.minZ, (dk.minX + dk.maxX) / 2, 0, (dk.minZ + dk.maxZ) / 2, roomMat(98));
    b.ladder(-4.5, dk.minZ, 0, -1, 0, dk.top);
    // a rail along the deck's open side, facing the room
    b.box(0.07, 0.07, dk.maxZ - dk.minZ, dk.maxX - 0.1, dk.top + 1.0, (dk.minZ + dk.maxZ) / 2, b.flat(PAL.orange, 0.55, 0.25), false);
    b.zipline(ZIP_UP.a, ZIP_UP.b, { vertical: true });
    b.zipline(ZIP_ACROSS.a, ZIP_ACROSS.b, { vertical: false, floorA: dk.top, floorB: 0 });

    // --- room 7: a bit of cover for the last four
    b.box(2, 1.2, 1.2, 5, 0, 125, coverMat);
    b.box(2, 1.2, 1.2, -4, 0, 124.5, coverMat);
  },
};
