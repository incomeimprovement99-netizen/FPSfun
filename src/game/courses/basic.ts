// THE RUN (BASIC): the timed run behind the range's left-hand gate. Rebuilt in Milestone 636 for today's movement (the
// owner, 2026-10-17: "MAKE THEM MUCH LONGER TO COMPENSATE WITH THE NEW DISTANCES AND MOVEMENT SPEED FOR EVERYTHING. No
// more ziplines"): the old seven rooms were sized to a sprint half as fast, and a jump crossed what a room asked of you.
//
// Nine rooms, out and back as the tutorial runs. Out up the left-hand half (facing +z): jump a low wall, slide a vent,
// climb a wall no jump tops and slide its ramp, double jump a gap, wall run a pit no jump crosses. Round the far end, and
// back down the other half (facing -z): superglide a gap off a ledge (or drop into its pit and climb out, the slow way), drop walkers
// crossing the room, double jump onto high ground to shoot over a screen, and sprint to the finish by the start.
//
// Every room is built from src/config/therun.json, its numbers measured on the real controller, armed (the run hands
// you two pistols), and tools/checks/sk-run.ts drives the controller through this very geometry. A slick face (range.ts
// Solid.slick) takes no wall run and no climb, and a mantle still takes its top.
//
// Course coordinates (course.ts): x across, z from the gate at 9; the course sits at BASIC_X in the world. Facing +z,
// +x is on your LEFT; facing -z (the way back), on your right.
import * as THREE from "three";
import { PAL, DEFAULT_WALL } from "../geo";
import { weaponName } from "../weapons";
import type { CourseLayout, EnemySpec, Hazard, Room } from "../course";
import { GLIDE_GAP, slickRoom, slickLedge, type Ledge } from "./tutorial";
import cfg from "../../config/therun.json";
import tutorialCfg from "../../config/tutorial.json";

/** where the course's x = 0 is in the world: its gate is at x -23.5 to -19.5 */
export const BASIC_X = -21.5;
/** the two halves: out (the left-hand one from the gate) and back */
export const OUT = { x0: cfg.out[0], x1: cfg.out[1] };
export const BACK = { x0: cfg.back[0], x1: cfg.back[1] };
export const TURN_Z = cfg.turnZ;
const FAR_Z = cfg.farZ;
const WH = cfg.wallH;
const DOOR = cfg.door;
export const DECK = cfg.deck;
/** over a pit off a deck, below this you have fallen */
export const FALL_Y = cfg.deck - cfg.fallBelow;
const cm = (x: number) => Math.round(x * 100) / 100;
export const inOut = (x: number) => x > OUT.x0 && x < OUT.x1;
export const inBack = (x: number) => x > BACK.x0 && x < BACK.x1;
export const OX = (OUT.x0 + OUT.x1) / 2;
export const BX = (BACK.x0 + BACK.x1) / 2;

// the doors: near the middle wall, or near the outer one
const nearOut: [number, number] = [OUT.x0 + 1, OUT.x0 + 1 + DOOR];
const farOut: [number, number] = [OUT.x1 - 1 - DOOR, OUT.x1 - 1];
const nearBack: [number, number] = [BACK.x1 - 1 - DOOR, BACK.x1 - 1];
const farBack: [number, number] = [BACK.x0 + 1, BACK.x0 + 1 + DOOR];
const mid = (d: [number, number]) => (d[0] + d[1]) / 2;

/** a pit room: the step up (s0 to a0), the deck (a0 to a1), the pit (a1 to b0), the landing deck (b0 to b1) */
export interface PitRoom {
  entryZ: number;
  s0: number;
  a0: number;
  a1: number;
  b0: number;
  b1: number;
  exitZ: number;
}
function pitRoom(entryZ: number, pit: number, landing: number, exitZ: number): PitRoom {
  const s0 = entryZ + 1;
  const a0 = s0 + 2;
  const a1 = a0 + cfg.runUp;
  const b0 = cm(a1 + pit);
  return { entryZ, s0, a0, a1, b0, b1: cm(b0 + landing), exitZ };
}

// ---- the way out, facing +z
const B = cfg.breach;
export const BREACH = { entryZ: cfg.start, wall: { z0: cfg.start + B.at, z1: cfg.start + B.at + B.d, top: B.h } as Ledge, exitZ: cfg.start + B.length };
const V = cfg.vent;
export const VENT = (() => {
  const entryZ = BREACH.exitZ;
  // straight ahead of its door
  const slot: [number, number] = [mid(farOut) - V.slotW / 2, mid(farOut) + V.slotW / 2];
  return { entryZ, z0: entryZ + V.at, z1: entryZ + V.at + V.depth, slot, h: V.slot, exitZ: entryZ + V.length };
})();
const Cl = cfg.climb;
export const CLIMB = (() => {
  const entryZ = VENT.exitZ;
  const wall: Ledge = { z0: entryZ + Cl.at, z1: entryZ + Cl.at + Cl.depth, top: Cl.height };
  const angle = (Cl.slope * Math.PI) / 180;
  return { entryZ, wall, angle, rampEnd: cm(wall.z1 + Cl.height / Math.tan(angle)), exitZ: entryZ + Cl.length };
})();
// (the landing deck stops at the next divider's face, half a metre short of its middle)
export const GAP = pitRoom(CLIMB.exitZ, cfg.gap.pit, cfg.gap.landing - 0.5, CLIMB.exitZ + 3 + cfg.runUp + cfg.gap.pit + cfg.gap.landing);
export const WALLRUN = pitRoom(GAP.exitZ, cfg.wallRun.pit, cfg.wallRun.landing, TURN_Z);
/** the wall to run: the out half's outer one, its inner face */
export const RUN_WALL_X = OUT.x1;

// ---- the way back, facing -z
const SG = tutorialCfg.superglide;
/** the superglide room: the tutorial's ledge (its gap measured off it, reach.json superglide), a landing deck at its height */
export const GLIDE = (() => {
  const entryZ = TURN_Z;
  const face = entryZ - SG.runUp;
  const edge = cm(face - SG.top);
  const b0 = cm(edge - GLIDE_GAP);
  return { entryZ, face, edge, b0, b1: cm(b0 - cfg.superglide.landing), h: SG.ledge, exitZ: entryZ - cfg.superglide.length };
})();
const X = cfg.crossfire;
export const CROSS = { entryZ: GLIDE.exitZ, exitZ: GLIDE.exitZ - X.length };
const H = cfg.high;
export const HIGH = {
  entryZ: CROSS.exitZ,
  ledge: { z0: CROSS.exitZ - H.at, z1: CROSS.exitZ - H.at - H.depth, top: H.height } as Ledge,
  screenZ: CROSS.exitZ - H.screenAt,
  /** the screen runs from the outer wall to this x, and the gap past it to the middle wall */
  screenX1: BACK.x1 - H.gapW,
  exitZ: CROSS.exitZ - H.length,
};
export const FINAL = { entryZ: HIGH.exitZ, exitZ: HIGH.exitZ - cfg.final.length };
/** the line, inside the last door, and the door out into the start area */
export const FINISH_Z = FINAL.exitZ + cfg.finishAt;
export const BACK_EXIT = { z: FINAL.exitZ, door: nearBack };

const outSpan: [number, number] = [OUT.x0, OUT.x1];
const backSpan: [number, number] = [BACK.x0, BACK.x1];
/** the doors, one a room: DIVIDERS[i] is the way into ROOMS[i] */
export const DIVIDERS: CourseLayout["dividers"] = [
  { z: BREACH.entryZ, door: nearOut, span: outSpan },
  { z: VENT.entryZ, door: farOut, span: outSpan },
  { z: CLIMB.entryZ, door: nearOut, span: outSpan },
  { z: GAP.entryZ, door: farOut, span: outSpan },
  // beside the lit wall, so the run starts straight along it
  { z: WALLRUN.entryZ, door: farOut, span: outSpan },
  { z: GLIDE.entryZ, door: nearBack, span: backSpan, facing: -1 },
  { z: CROSS.entryZ, door: farBack, span: backSpan, facing: -1 },
  { z: HIGH.entryZ, door: nearBack, span: backSpan, facing: -1 },
  { z: FINAL.entryZ, door: farBack, span: backSpan, facing: -1 },
];

const intoOut = (entryZ: number) => (x: number, _y: number, z: number) => inOut(x) && z > entryZ + 0.7;
const intoBack = (entryZ: number) => (x: number, _y: number, z: number) => inBack(x) && z < entryZ - 0.7;
/** a room's tip on the wall you came in by, over its door, facing into the room: only seen if you turn round */
const tipOut = (entryZ: number) => ({ x: OX, y: 5.4, z: entryZ + 0.51, rotY: 0 });
const tipBack = (entryZ: number) => ({ x: BX, y: 5.4, z: entryZ - 0.51, rotY: Math.PI });
const tip = (name: string, body: string) => `${name}\n\n${body}`;
const walker = ([x, z, dx, period]: number[], i: number): EnemySpec => ({ x, z, gun: i % 2 ? "semipistol" : "vinson", path: { dx, dz: 0, period } });

export const ROOMS: Room[] = [
  {
    name: "BREACH",
    entryZ: BREACH.entryZ,
    tipX: OX,
    tipAt: tipOut(BREACH.entryZ),
    tip: tip("BREACH", "Sprint and jump the low wall: three pop up behind it as you come in. Drop them as you land. Out through the left-hand door."),
    trigger: intoOut(BREACH.entryZ),
    enemies: [
      { x: 2.5, z: 34, gun: "vinson" },
      { x: 6.5, z: 36.5, gun: "semipistol", sway: 0.4 },
      { x: 10, z: 34.5, gun: "vinson" },
    ],
  },
  {
    name: "VENT",
    entryZ: VENT.entryZ,
    tipX: OX,
    tipAt: tipOut(VENT.entryZ),
    tip: tip("VENT", "The slot straight ahead of the door is 1.25 m high. Sprint, press {crouch} to slide, and stay down until you are through: standing, you do not fit. Two on the far side. Out right."),
    trigger: intoOut(VENT.entryZ),
    enemies: [
      { x: 3, z: 55, gun: "semipistol" },
      { x: 7, z: 56, gun: "vinson", sway: 0.4 },
    ],
  },
  {
    name: "CLIMB",
    entryZ: CLIMB.entryZ,
    tipX: OX,
    tipAt: tipOut(CLIMB.entryZ),
    tip: tip("CLIMB", "No jump gets up 6.5 m. Run at the wall and keep holding {forward}: you climb it and pull yourself over the top. Slide down the ramp for speed and drop the three below. Out left."),
    trigger: intoOut(CLIMB.entryZ),
    enemies: [
      { x: 2, z: 80, gun: "vinson" },
      { x: 6.5, z: 81.5, gun: "semipistol", sway: 0.45 },
      { x: 10.5, z: 79.5, gun: "vinson" },
    ],
  },
  {
    name: "GAP",
    entryZ: GAP.entryZ,
    tipX: OX,
    tipAt: tipOut(GAP.entryZ),
    tip: tip("GAP", "Too far for one jump: double jump across, the second as the first one tops out (a slide jump makes it too). The glass takes no wall run. Fall in and you restart the room, 2 s down. Two across the gap. Out left."),
    trigger: intoOut(GAP.entryZ),
    enemies: [
      { x: 3, y: DECK, z: GAP.b0 + 4.5, gun: "vinson" },
      { x: 7.5, y: DECK, z: GAP.b0 + 5.5, gun: "semipistol", sway: 0.3 },
    ],
  },
  {
    name: "WALL RUN",
    entryZ: WALLRUN.entryZ,
    tipX: OX,
    tipAt: tipOut(WALLRUN.entryZ),
    tip: tip("WALL RUN", "No jump crosses this pit. Run the deck beside the lit wall on your left, jump at it from the end and keep holding {forward}: you run along it and off past the pit. Three wait round the turn."),
    trigger: intoOut(WALLRUN.entryZ),
    enemies: [
      { x: 4, z: 186, gun: "vinson" },
      { x: 9.5, z: 190, gun: "semipistol", sway: 0.4 },
      { x: -3, z: 190.5, gun: "vinson" },
    ],
  },
  {
    name: "SUPERGLIDE",
    entryZ: GLIDE.entryZ,
    tipX: BX,
    tipAt: tipBack(GLIDE.entryZ),
    tip: tip("SUPERGLIDE", "Jump at the ledge and mantle up. At the very end of the mantle press jump, then crouch one frame later: you leave fast enough to clear the gap. Miss it and you drop into the pit: climb out up its far side, the slow way. Three on the deck. Out left."),
    trigger: intoBack(GLIDE.entryZ),
    enemies: [
      { x: -9, y: GLIDE.h, z: GLIDE.b0 - 3.5, gun: "semipistol" },
      { x: -3.5, y: GLIDE.h, z: GLIDE.b0 - 4, gun: "vinson", sway: 0.4 },
      { x: -6.5, z: GLIDE.b1 - 3, gun: "vinson" },
    ],
  },
  {
    name: "CROSSFIRE",
    entryZ: CROSS.entryZ,
    tipX: BX,
    tipAt: tipBack(CROSS.entryZ),
    tip: tip("CROSSFIRE", "Four walk across the room, each at its own pace. Lead them, and slide between the pillars. Out right."),
    trigger: intoBack(CROSS.entryZ),
    enemies: X.walkers.map(walker),
  },
  {
    name: "HIGH GROUND",
    entryZ: HIGH.entryZ,
    tipX: BX,
    tipAt: tipBack(HIGH.entryZ),
    tip: tip("HIGH GROUND", "The three are behind the screen, out of sight from the floor. Double jump up onto the platform and shoot them over it, then drop off and round the screen by the right-hand wall. Out left."),
    trigger: intoBack(HIGH.entryZ),
    enemies: [
      { x: -10.5, z: HIGH.screenZ - 5, gun: "vinson" },
      { x: -8, z: HIGH.screenZ - 6.5, gun: "semipistol" },
      { x: -5.5, z: HIGH.screenZ - 4.5, gun: "vinson", sway: 0.3 },
    ],
  },
  {
    name: "FINAL",
    entryZ: FINAL.entryZ,
    tipX: BX,
    tipAt: tipBack(FINAL.entryZ),
    tip: tip("FINAL SPRINT", "Holster (3) to sprint 15% faster, draw and drop all four, and cross the gold line."),
    trigger: intoBack(FINAL.entryZ),
    enemies: [
      { x: -10, z: FINAL.entryZ - 12, gun: "vinson" },
      { x: -3, z: FINAL.entryZ - 18, gun: "semipistol", sway: 0.4 },
      { x: -8.5, z: FINAL.entryZ - 26, gun: "vinson" },
      { x: -2.5, z: FINAL.entryZ - 33, gun: "semipistol", sway: 0.3 },
    ],
  },
];

/** the pits: below the fall line over one and you are back at its door, 2 s down (the superglide's pit is no hazard) */
const HAZARDS: Hazard[] = [GAP, WALLRUN].map((r, i) => ({
  minZ: r.a1,
  maxZ: r.b0,
  minX: OUT.x0,
  maxX: OUT.x1,
  fallY: FALL_Y,
  respawn: new THREE.Vector3(mid(DIVIDERS[3 + i].door), 0, r.entryZ + 1.5),
  yaw: 180,
}));

/**
 * Points through every room, start line to finish (world x): the e2e walks them to prove a run through it finishes, a
 * split a room. Each is inside its room past the trigger, clear of a pit.
 */
export const RUN_ROUTE: Array<[number, number, number]> = (
  [
    [mid(nearOut), 0, 11],
    [mid(nearOut), 0, 13.5],
    [mid(nearOut), 0, BREACH.entryZ + 2],
    [mid(farOut), 0, VENT.entryZ + 2],
    [mid(nearOut), 0, CLIMB.entryZ + 2],
    [mid(farOut), 0, GAP.entryZ + 1.5],
    [mid(farOut), 0, WALLRUN.entryZ + 1.5],
    [mid(nearBack), 0, GLIDE.entryZ - 2],
    [mid(farBack), 0, CROSS.entryZ - 2],
    [mid(nearBack), 0, HIGH.entryZ - 2],
    [mid(farBack), 0, FINAL.entryZ - 2],
    [mid(nearBack), 0, FINISH_Z + 1.5],
    [mid(nearBack), 0, FINISH_Z - 1],
  ] as Array<[number, number, number]>
).map(([x, y, z]) => [x + BASIC_X, y, z]);

const theme = (top: string, bottom: string, words: [string, string, string, string, string], trim: number) => ({ wall: { top, bottom, words }, trim });
const R = cfg.ranks;

export const BASIC_COURSE: CourseLayout = {
  id: "basic",
  title: "THE RUN",
  version: 2,
  x: BASIC_X,
  x0: BACK.x0,
  x1: OUT.x1,
  wallH: WH,
  startZ: 12,
  finishZ: FINISH_Z,
  finishDir: -1,
  finishSpan: backSpan,
  farZ: FAR_Z,
  // (therun.json ranks: S the route's time as tools/checks/sk-run.ts measures it)
  ranks: [
    ["S", R.S],
    ["A", Math.round(R.S * R.a * 2) / 2],
    ["B", Math.round(R.S * R.b * 2) / 2],
    ["C", Infinity],
  ],
  rooms: ROOMS,
  dividers: DIVIDERS,
  /**
   * Each room its own look: wall paint and spray colours, and the door trim you walk through into it. Index 0 is the
   * start area, then the nine rooms in order; segments are where the out half's walls change (the way back shares them).
   */
  themes: [
    { wall: DEFAULT_WALL, trim: PAL.orange },
    theme("#7a5a44", "#6a4b38", ["#ffd23c", "#f1efe6", "#2fd0e8", "#1a1d21", "#ff7a3a"], 0xff7a3a),
    theme("#3f6a70", "#345a60", ["#f1efe6", "#ffb03a", "#9ff0ff", "#1a1d21", "#ffd23c"], 0x2fd0e8),
    theme("#5f6a45", "#525c3b", ["#e8e0c8", "#ff7a2a", "#1a1d21", "#ffd23c", "#b8e0ff"], 0xa8c93a),
    theme("#7a3a36", "#682f2c", ["#f1efe6", "#ffd23c", "#1a1d21", "#9ff0ff", "#ff9f43"], 0xff3b2f),
    theme("#355e7a", "#2c4f68", ["#f1efe6", "#ffd23c", "#9ff0ff", "#1a1d21", "#ff9f43"], 0x3b8bff),
    theme("#4f3f6e", "#43355e", ["#ff5ad4", "#9ff0ff", "#f1efe6", "#ffd23c", "#7ddc8a"], 0xb04cff),
    theme("#8a7a3a", "#776832", ["#1a1d21", "#f1efe6", "#d4302a", "#1a1d21", "#2fd0e8"], 0xffd23c),
    theme("#3a5a48", "#2f4a3b", ["#f1efe6", "#ffd23c", "#9ff0ff", "#1a1d21", "#7ddc8a"], 0x7ddc8a),
    theme("#c9ccd1", "#b3b7bd", ["#d9a441", "#1a1d21", "#d4302a", "#3b8bff", "#d9a441"], 0xd9a441),
  ],
  segments: [9, BREACH.entryZ, VENT.entryZ, CLIMB.entryZ, GAP.entryZ, WALLRUN.entryZ, FAR_Z],
  hazards: HAZARDS,
  // right of the gate: the left side has the rules sign and a range pillar behind the wall
  tv: { x: 7, y: 2.7, z: 9.03, w: 5.2, h: 2.9 },
  returnTo: { x: 7, z: 11.4, yaw: 0, pitch: 3 },
  startPose: { x: mid(nearOut), z: 10.2, yaw: 180 },
  sign:
    "THE RUN\n\nCross the green line to start the clock and the gold line to stop it: out up the left-hand side, round the far end, " +
    "and back down the other side to finish here. Drop every armed dummy: each one left standing adds 3 s. Starting the run equips " +
    `the ${weaponName("semipistol")} and the ${weaponName("g17")}; your guns come back when you finish. The dark glass walls take no wall run.\n\n` +
    "Every room's fastest route is written on the wall you came in by. " +
    "You will only see it if you turn round.\n\nF resets the course.",
  girders: [-9, 0, 9],
  lights: [BX, OX],
  build(b) {
    const { coverMat, platMat, roomMat } = b;
    const w = OUT.x1 - OUT.x0;
    // between the halves, from the start area to the turn: one wall, the full height
    b.box(OUT.x0 - BACK.x1, WH, TURN_Z - (cfg.start - 0.5), (BACK.x1 + OUT.x0) / 2, 0, (cfg.start - 0.5 + TURN_Z) / 2, roomMat(100));
    // the way back's last door, out into the start area, its frame in the start area's trim
    {
      const [d0, d1] = BACK_EXIT.door;
      const z = BACK_EXIT.z;
      b.box(d0 - BACK.x0, WH, 1, (BACK.x0 + d0) / 2, 0, z, roomMat(z - 0.1));
      b.box(BACK.x1 - d1, WH, 1, (d1 + BACK.x1) / 2, 0, z, roomMat(z - 0.1));
      b.box(d1 - d0, WH - 3.3, 1, (d0 + d1) / 2, 3.3, z, roomMat(z - 0.1));
      const trim = b.flat(PAL.orange, 0.5, 0.2);
      for (const x of [d0, d1]) b.box(0.2, 3.3, 1.08, x, 0, z, trim, false);
      b.box(d1 - d0 + 0.2, 0.2, 1.08, (d0 + d1) / 2, 3.2, z, trim, false);
    }

    // 1: the low wall, and a cover box past it
    b.box(w, BREACH.wall.top, BREACH.wall.z1 - BREACH.wall.z0, OX, 0, (BREACH.wall.z0 + BREACH.wall.z1) / 2, coverMat);
    b.box(1.6, 1.3, 1.6, 9, 0, BREACH.wall.z1 + 3.5, coverMat);

    // 2: the vent, a block across the half with the slot through it at crouch height
    {
      const [s0, s1] = VENT.slot;
      const d = VENT.z1 - VENT.z0;
      const zc = (VENT.z0 + VENT.z1) / 2;
      if (s0 > OUT.x0) b.box(s0 - OUT.x0, WH, d, (OUT.x0 + s0) / 2, 0, zc, roomMat(zc));
      if (s1 < OUT.x1) b.box(OUT.x1 - s1, WH, d, (s1 + OUT.x1) / 2, 0, zc, roomMat(zc));
      b.box(s1 - s0, WH - VENT.h, d, (s0 + s1) / 2, VENT.h, zc, roomMat(zc));
      b.glow(s1 - s0, 0.06, 0.04, (s0 + s1) / 2, VENT.h - 0.06, VENT.z0 - 0.02, 0xffb03a);
    }

    // 3: the wall to climb, its top edge lit, and the ramp down its far side: drawn as one slab, solid as steps (each
    // under a step's height, so a body slides down it rather than dropping off each)
    {
      const c = CLIMB.wall;
      b.box(w, c.top, c.z1 - c.z0, OX, 0, (c.z0 + c.z1) / 2, roomMat(c.z0));
      b.glow(w, 0.06, 0.12, OX, c.top - 0.06, c.z0 - 0.06, 0xffd23c, 1.4);
      const run = CLIMB.rampEnd - c.z1;
      const len = c.top / Math.sin(CLIMB.angle);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, len), platMat);
      ramp.position.set(OX, c.top / 2 - 0.15, c.z1 + run / 2);
      ramp.rotation.x = CLIMB.angle; // rises toward -z, as the steps do
      ramp.receiveShadow = true;
      ramp.castShadow = true;
      b.add(ramp);
      const STEPS = 40;
      for (let i = 0; i < STEPS; i++) {
        const t0 = i / STEPS;
        b.solid(OUT.x0, OUT.x1, c.z1 + run * t0, c.z1 + run * ((i + 1) / STEPS), 0, c.top * (1 - t0));
      }
    }

    // 4 and 5: a step up, the deck, the pit, the landing deck; 4's in slick glass, 5's beside the lit wall
    const deckOf = (r: PitRoom) => {
      b.box(w, cfg.step, r.a0 - r.s0, OX, 0, (r.s0 + r.a0) / 2, platMat);
      b.box(w, DECK, r.a1 - r.a0, OX, 0, (r.a0 + r.a1) / 2, platMat);
      b.hazardFloor(r.a1, r.b0, OUT.x0, OUT.x1);
      b.glow(w, 0.05, 0.15, OX, DECK, r.a1 - 0.1, 0x7ddc8a, 1.4);
      b.box(w, DECK, r.b1 - r.b0, OX, 0, (r.b0 + r.b1) / 2, platMat);
      b.glow(w, 0.05, 0.15, OX, DECK, r.b0 + 0.1, 0x7ddc8a, 1.4);
    };
    slickRoom(b, OUT, GAP.entryZ, GAP.exitZ, [DIVIDERS[3].door, DIVIDERS[4].door], cfg.slick, WH);
    deckOf(GAP);
    deckOf(WALLRUN);
    const lit = parseInt(cfg.wallRun.lit.slice(1), 16);
    b.glow(0.04, 0.12, WALLRUN.b0 - WALLRUN.a1 + 6, RUN_WALL_X - 0.03, DECK + 2.2, (WALLRUN.a1 + WALLRUN.b0) / 2, lit, 1.6);

    // 6: the superglide, in slick glass: the ledge, the pit (no hazard: the slow way is out up its far side), the landing
    // deck. The ledge and the deck are the tutorial's as they were measured, plain, so a jump at either climbs its face.
    const G = GLIDE;
    const bw = BACK.x1 - BACK.x0;
    slickRoom(b, BACK, G.exitZ, G.entryZ, [DIVIDERS[6].door, DIVIDERS[5].door], cfg.slick, WH);
    b.box(bw, G.h, G.face - G.edge, BX, 0, (G.face + G.edge) / 2, platMat);
    b.box(bw, G.h, G.b0 - G.b1, BX, 0, (G.b0 + G.b1) / 2, platMat);
    b.glow(bw, 0.06, 0.12, BX, G.h - 0.06, G.face + 0.06, 0xffd23c, 1.4);
    b.glow(bw, 0.05, 0.15, BX, G.h, G.edge + 0.1, 0x7ddc8a, 1.4);
    b.glow(bw, 0.05, 0.15, BX, G.h, G.b0 - 0.1, 0x7ddc8a, 1.4);

    // 7: pillars between the walkers' lines
    for (const [x, z] of X.pillars) b.box(1.2, X.pillarH, 1.2, x, 0, z, coverMat);

    // 8: the slick platform across the half, and the screen past it, the gap by the middle wall
    slickLedge(b, BACK, HIGH.ledge);
    b.box(HIGH.screenX1 - BACK.x0, H.screenH, 0.5, (BACK.x0 + HIGH.screenX1) / 2, 0, HIGH.screenZ, coverMat);
    b.glow(HIGH.screenX1 - BACK.x0, 0.05, 0.52, (BACK.x0 + HIGH.screenX1) / 2, H.screenH - 0.05, HIGH.screenZ, 0xff9f43, 1.2);
  },
};
