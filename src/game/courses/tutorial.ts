// THE TUTORIAL (Milestone 633, docs/PLAN_TUTORIAL.md): the game a room at a time, a run of its own behind the range's
// back wall. The owner, 2026-10-17: "the player spawning in a different location and going through a 'tutorial run'
// and the end they will come out near the area they would have with the firing range ... they shouldn't be able to
// advance through the tutorial if they don't perform the moves."
//
// Nine rooms, in the owner's order. In behind the right-hand gate and out up that bay (facing +z): move, jump up a
// ledge, double jump up a ledge, a ledge over a pit only a double jump and a mantle reach, a pit only a wall run
// crosses. Across the far end, and back down the middle bay (facing -z): DASH with a double jump onto a ledge across a
// pit, the ANAKIN in your hands up a platform and up a wall to shoot soldiers, and the superglide with its optional
// bridge. Then out of the middle gate into the range, between the gun stands and the hack stands. Its steps, its doors,
// the hacks' and the gun's locks are src/game/tutorial.ts's; this is the building.
//
// Every room is built from src/config/tutorial.json, its numbers measured on the real controller (unarmed before the
// ANAKIN, armed after), and tools/checks/sk-tutorial.ts drives the controller through this very geometry: each room
// passed with its move, not with the one before it. A slick face (range.ts Solid.slick) takes no wall run and no climb:
// every wall in a room a jump gates is one, or a climb would take any wall up to 8 m.
//
// Course coordinates (course.ts) with the course at x 0, so they are the world's: x across, z from the gate at 9.
// Facing +z, +x is on your LEFT; facing -z (the way back), on your right.
import * as THREE from "three";
import { PAL, DEFAULT_WALL, emissive } from "../geo";
import type { CourseBuilder, CourseLayout, EnemySpec, Hazard, Room } from "../course";
import reach from "../../config/reach.json";
import cfg from "../../config/tutorial.json";

/** where the course's x = 0 is in the world */
export const TUTORIAL_X = 0;
/** the two bays: out (the right-hand one, from its gate) and back (the middle one, to the middle gate) */
export const OUT = { x0: cfg.out[0], x1: cfg.out[1] };
export const BACK = { x0: cfg.back[0], x1: cfg.back[1] };
export const TURN_Z = cfg.turnZ;
const FAR_Z = cfg.farZ;
const cm = (x: number) => Math.round(x * 100) / 100;
export const inOut = (x: number) => x > OUT.x0 && x < OUT.x1;
export const inBack = (x: number) => x > BACK.x0 && x < BACK.x1;
const OX = (OUT.x0 + OUT.x1) / 2;
const BX = (BACK.x0 + BACK.x1) / 2;
export const DECK = cfg.deck;
/** over a pit off a deck, below this you have fallen */
export const FALL_Y = cfg.deck - cfg.fallBelow;

/** the superglide's gap, from the measured reach (reach.json superglide, armed) */
const SG = cfg.superglide;
export const GLIDE_GAP = cm((reach.superglide.without * SG.over + reach.superglide.carry * SG.under) / 2);

/** a ledge across a room: its near face, its far face, its top (z falls on the way back) */
export interface Ledge {
  z0: number;
  z1: number;
  top: number;
}
/** a pit room: the step up (s0 to a0), the deck (a0 to a1), the pit (a1 to b0), what is past it (b0 to b1) */
export interface PitRoom {
  entryZ: number;
  s0: number;
  a0: number;
  a1: number;
  b0: number;
  b1: number;
  /** the far side's top: the deck's height, or a ledge's */
  top: number;
  exitZ: number;
}
/** a pit room from its door, `dir` the way it runs (+1 out, -1 back) */
function pitRoom(entryZ: number, dir: 1 | -1, pit: number, beyond: number, top: number, exitZ: number): PitRoom {
  const s0 = entryZ + dir;
  const a0 = s0 + 2 * dir;
  const a1 = a0 + cfg.runUp * dir;
  const b0 = cm(a1 + pit * dir);
  return { entryZ, s0, a0, a1, b0, b1: cm(b0 + beyond * dir), top, exitZ };
}

// ---- the way out, facing +z
export const MOVE_ROOM = { entryZ: cfg.start, exitZ: cfg.start + cfg.move.length };
const ledgeRoom = (entryZ: number, r: { length: number; at: number; height: number; depth: number }) => ({
  entryZ,
  ledge: { z0: entryZ + r.at, z1: entryZ + r.at + r.depth, top: r.height } as Ledge,
  exitZ: entryZ + r.length,
});
export const JUMP = ledgeRoom(MOVE_ROOM.exitZ, cfg.jump);
export const DOUBLE = ledgeRoom(JUMP.exitZ, cfg.double);
export const MANTLE = pitRoom(DOUBLE.exitZ, 1, cfg.mantle.pit, cfg.mantle.depth, cfg.mantle.top, DOUBLE.exitZ + cfg.mantle.length);
export const WALLRUN = pitRoom(MANTLE.exitZ, 1, cfg.wallRun.pit, cfg.wallRun.landing, DECK, TURN_Z);
/** the wall to run: the bay's outer one, its inner face */
export const RUN_WALL_X = OUT.x1;

// ---- the way back, facing -z
export const DASH = pitRoom(TURN_Z, -1, cfg.dash.pit, cfg.dash.depth, cfg.dash.top, TURN_Z - cfg.dash.length);
const H = cfg.high;
export const HIGH = {
  entryZ: DASH.exitZ,
  ledge: { z0: DASH.exitZ - H.at, z1: DASH.exitZ - H.at - H.depth, top: H.height } as Ledge,
  exitZ: DASH.exitZ - H.length,
};
const C = cfg.climb;
export const CLIMB = {
  entryZ: HIGH.exitZ,
  ledge: { z0: HIGH.exitZ - C.at, z1: HIGH.exitZ - C.at - C.depth, top: C.height } as Ledge,
  exitZ: HIGH.exitZ - C.length,
};
/** the superglide room: its lane (x0 to the slick wall), the optional bridge's lane beyond it */
export const GLIDE = (() => {
  const entryZ = CLIMB.exitZ;
  const face = entryZ - SG.runUp;
  const edge = cm(face - SG.top);
  const b0 = cm(edge - GLIDE_GAP);
  const b1 = cm(b0 - SG.landing);
  const laneX1 = BACK.x1 - SG.bridgeW - SG.wall;
  return { entryZ, face, edge, b0, b1, h: SG.ledge, fallY: SG.ledge - cfg.fallBelow, laneX1, bridgeX0: laneX1 + SG.wall };
})();
/** the way out: the middle gate in the range's back wall (range.ts COURSE_GATE_C), under its lintel */
export const EXIT = { z: 8.5, x0: -2, x1: 2, h: cfg.exit.doorH };

const tip = (name: string, body: string) => `${name}\n\n${body}`;
const SOLDIER = (x: number, z: number, gun: string): EnemySpec => ({ x, z, gun, health: H.health });
/** what puts a room's soldiers up: you, on top of its ledge */
const upOn = (l: Ledge) => (x: number, y: number, z: number) => inBack(x) && y > l.top - 0.3 && z < Math.max(l.z0, l.z1) + 0.5 && z > Math.min(l.z0, l.z1) - 0.5;

const DOOR = cfg.door;
const ROOMS: Room[] = [
  { name: "MOVE", entryZ: MOVE_ROOM.entryZ, tipX: 0, tip: tip("MOVE", "Forward to the door."), tipAt: { x: OUT.x1 - 4.5, y: 2.6, z: MOVE_ROOM.exitZ - 0.52, rotY: Math.PI }, trigger: (x, _y, z) => inOut(x) && z > MOVE_ROOM.entryZ + 0.7, enemies: [] },
  { name: "JUMP", entryZ: JUMP.entryZ, tipX: 0, tip: tip("JUMP", "Jump up onto the ledge."), tipAt: { x: OUT.x0 + 4.5, y: 2.6, z: JUMP.exitZ - 0.82, rotY: Math.PI }, trigger: (x, _y, z) => inOut(x) && z > JUMP.entryZ + 0.7, enemies: [] },
  { name: "DOUBLE JUMP", entryZ: DOUBLE.entryZ, tipX: 0, tip: tip("DOUBLE JUMP", "Too high for one jump: jump, and jump again in the air."), tipAt: { x: OUT.x1 - 4.5, y: 2.6, z: DOUBLE.exitZ - 0.82, rotY: Math.PI }, trigger: (x, _y, z) => inOut(x) && z > DOUBLE.entryZ + 0.7, enemies: [] },
  { name: "MANTLE", entryZ: MANTLE.entryZ, tipX: 0, tip: tip("MANTLE", "Over the pit with a double jump, and grab the ledge: you pull yourself up."), tipAt: { x: OUT.x0 + 4.5, y: 2.6, z: MANTLE.exitZ - 0.82, rotY: Math.PI }, trigger: (x, _y, z) => inOut(x) && z > MANTLE.entryZ + 0.7, enemies: [] },
  { name: "WALL RUN", entryZ: WALLRUN.entryZ, tipX: 0, tip: tip("WALL RUN", "Jump at the lit wall from the end of the deck and hold forward."), tipAt: { x: RUN_WALL_X - 0.02, y: 3.4, z: WALLRUN.a0 + 4, rotY: -Math.PI / 2 }, trigger: (x, _y, z) => inOut(x) && z > WALLRUN.entryZ + 0.7, enemies: [] },
  { name: "DASH", entryZ: DASH.entryZ, tipX: 0, tip: tip("DASH", "Double jump off the deck's edge, then dash across."), tipAt: { x: BX + 2.5, y: 2.6, z: TURN_Z + 0.52, rotY: 0 }, trigger: (x, _y, z) => inBack(x) && z < DASH.entryZ - 0.7, enemies: [] },
  {
    name: "HIGH GROUND",
    entryZ: HIGH.entryZ,
    tipX: 0,
    tip: tip("HIGH GROUND", "Double jump up onto the platform, and shoot the two soldiers from up there."),
    tipAt: { x: BX + 2.5, y: 2.6, z: HIGH.exitZ + 0.82, rotY: 0 },
    trigger: upOn(HIGH.ledge),
    enemies: [SOLDIER(BX - 3, HIGH.ledge.z1 - H.ahead, "vinson"), SOLDIER(BX + 3, HIGH.ledge.z1 - H.ahead - 2, "r97")],
  },
  {
    name: "CLIMB",
    entryZ: CLIMB.entryZ,
    tipX: 0,
    tip: tip("CLIMB", "Run at the wall and hold forward to climb it. Shoot the two soldiers from the top."),
    tipAt: { x: BX - 2.5, y: 2.6, z: CLIMB.exitZ + 0.52, rotY: 0 },
    trigger: upOn(CLIMB.ledge),
    enemies: [SOLDIER(BX + 2.5, CLIMB.ledge.z1 - C.ahead, "wingman"), SOLDIER(BX - 3, CLIMB.ledge.z1 - C.ahead - 2, "vinson")],
  },
  {
    name: "SUPERGLIDE",
    entryZ: GLIDE.entryZ,
    tipX: 0,
    tip: tip("SUPERGLIDE", "Jump at the ledge: as you pull yourself up, jump, and crouch a frame later. Or take the bridge: it is optional."),
    tipAt: { x: (BACK.x0 + GLIDE.laneX1) / 2, y: 1.9, z: GLIDE.face + 0.02, rotY: 0 },
    trigger: (x, _y, z) => inBack(x) && z < GLIDE.entryZ - 0.7,
    enemies: [],
  },
];

/** the doors, one a room: dividers[i] is the way into rooms[i] (src/game/tutorial.ts shuts all but the first) */
const outSpan: [number, number] = [OUT.x0, OUT.x1];
const backSpan: [number, number] = [BACK.x0, BACK.x1];
const nearOut: [number, number] = [OUT.x0 + 1, OUT.x0 + 1 + DOOR];
const farOut: [number, number] = [OUT.x1 - 1 - DOOR, OUT.x1 - 1];
const nearBack: [number, number] = [BACK.x0 + 1, BACK.x0 + 1 + DOOR];
const farBack: [number, number] = [BACK.x1 - 1 - DOOR, BACK.x1 - 1];
export const DIVIDERS: CourseLayout["dividers"] = [
  // the first in line with the right-hand gate behind it
  { z: MOVE_ROOM.entryZ, door: [OX - DOOR / 2, OX + DOOR / 2], span: outSpan },
  { z: JUMP.entryZ, door: nearOut, span: outSpan },
  { z: DOUBLE.entryZ, door: farOut, span: outSpan },
  { z: MANTLE.entryZ, door: nearOut, span: outSpan },
  { z: WALLRUN.entryZ, door: farOut, span: outSpan },
  { z: DASH.entryZ, door: nearBack, span: backSpan, facing: -1 },
  { z: HIGH.entryZ, door: farBack, span: backSpan, facing: -1 },
  { z: CLIMB.entryZ, door: nearBack, span: backSpan, facing: -1 },
  { z: GLIDE.entryZ, door: farBack, span: backSpan, facing: -1 },
];

/** the pits: below the fall line over one and you are back at its door */
const HAZARDS: Hazard[] = [
  ...[MANTLE, WALLRUN].map((r) => ({ minZ: r.a1, maxZ: r.b0, minX: OUT.x0, maxX: OUT.x1, fallY: FALL_Y, respawn: new THREE.Vector3(OX, 0, r.entryZ + 1.5), yaw: 180 })),
  { minZ: DASH.b0, maxZ: DASH.a1, minX: BACK.x0, maxX: BACK.x1, fallY: FALL_Y, respawn: new THREE.Vector3(BX, 0, DASH.entryZ - 1.5), yaw: 0 },
  { minZ: GLIDE.b0, maxZ: GLIDE.edge, minX: BACK.x0, maxX: BACK.x1, fallY: GLIDE.fallY, respawn: new THREE.Vector3(BX, 0, GLIDE.entryZ - 1.5), yaw: 0 },
];
/** which hazard is the dash room's (a fall there gives the dash back) */
export const DASH_HAZARD = 2;

/** the slick walls' glass: a blue-grey that reads as glass and not as a hole (0x121821 drew them black) */
export const SLICK_GLASS = 0x2b3548;

const theme = (top: string, bottom: string, trim: number) => ({ wall: { top, bottom, words: ["#f1efe6", "#ffd23c", "#9ff0ff", "#1a1d21", "#ff9f43"] as [string, string, string, string, string], strength: 0.5 }, trim });

/**
 * The slick walls of a room, between z0 and z1, in a bay: both sides, and the dividers' faces at its ends but their doors
 * (`doors` the lower z's first). THE RUN's slick rooms are these too (courses/basic.ts), with its own thickness and height.
 */
export function slickRoom(b: CourseBuilder, bay: { x0: number; x1: number }, z0: number, z1: number, doors: Array<[number, number] | null>, T = cfg.slick, WH = cfg.wallH): void {
  const glass = b.flat(SLICK_GLASS, 0.3, 0.35);
  const lo = Math.min(z0, z1);
  const hi = Math.max(z0, z1);
  for (const [x0, x1] of [
    [bay.x0, bay.x0 + T],
    [bay.x1 - T, bay.x1],
  ]) {
    b.box(x1 - x0, WH, hi - lo, (x0 + x1) / 2, 0, (lo + hi) / 2, glass, false);
    b.slick(x0, x1, lo, hi, 0, WH);
    const face = x0 === bay.x0 ? x1 + 0.02 : x0 - 0.02;
    for (const y of [1.2, 4.6]) b.glow(0.04, 0.1, hi - lo, face, y, (lo + hi) / 2, 0xff3b2f, 1.3);
  }
  // across the room at each end (the room's side of the divider, which is 0.5 m either side of its z), but the doorway
  [lo, hi].forEach((z, i) => {
    const door = doors[i];
    const fz = i === 0 ? z + 0.5 : z - 0.5 - T;
    const pieces: Array<[number, number]> = door ? [[bay.x0, door[0]], [door[1], bay.x1]] : [[bay.x0, bay.x1]];
    for (const [x0, x1] of pieces) {
      if (x1 - x0 < 0.05) continue;
      b.box(x1 - x0, WH, T, (x0 + x1) / 2, 0, fz + T / 2, glass, false);
      b.slick(x0, x1, fz, fz + T, 0, WH);
    }
    // over the doorway too, from the door's top up
    if (door) {
      b.box(door[1] - door[0], WH - 3.3, T, (door[0] + door[1]) / 2, 3.3, fz + T / 2, glass, false);
      b.slick(door[0], door[1], fz, fz + T, 3.3, WH);
    }
  });
}

/** a slick ledge across a bay, drawn and solid */
export function slickLedge(b: CourseBuilder, bay: { x0: number; x1: number }, l: Ledge): void {
  const lo = Math.min(l.z0, l.z1);
  const hi = Math.max(l.z0, l.z1);
  b.box(bay.x1 - bay.x0, l.top, hi - lo, (bay.x0 + bay.x1) / 2, 0, (lo + hi) / 2, b.platMat, false);
  b.slick(bay.x0, bay.x1, lo, hi, 0, l.top);
  // its near top edge lit, so the height reads from the room
  b.glow(bay.x1 - bay.x0, 0.06, 0.12, (bay.x0 + bay.x1) / 2, l.top - 0.06, l.z0 + (l.z0 < l.z1 ? -0.06 : 0.06), 0xffd23c, 1.4);
}

export const TUTORIAL_COURSE: CourseLayout = {
  id: "tutorial",
  title: "THE TUTORIAL",
  x: TUTORIAL_X,
  x0: BACK.x0,
  x1: OUT.x1,
  wallH: cfg.wallH,
  untimed: true,
  dressed: true,
  startZ: 12,
  finishZ: 9,
  farZ: FAR_Z,
  ranks: [["-", Infinity]],
  rooms: ROOMS,
  dividers: DIVIDERS,
  themes: [
    { wall: DEFAULT_WALL, trim: PAL.orange },
    theme("#3f6a70", "#345a60", 0x2fd0e8),
    theme("#4f3f6e", "#43355e", 0xb04cff),
    theme("#7a3a36", "#682f2c", 0xff3b2f),
    theme("#355e7a", "#2c4f68", 0x3b8bff),
    theme("#6a3f5e", "#5a3450", 0xff5ad4),
    theme("#5a5a3a", "#4a4a2e", 0xffd23c),
    theme("#2e3442", "#262b37", 0xff3b2f),
    theme("#3a5a48", "#2f4a3b", 0x7ddc8a),
    theme("#5e4a36", "#4e3d2c", 0xff9f43),
  ],
  segments: [9, MOVE_ROOM.entryZ, JUMP.entryZ, DOUBLE.entryZ, MANTLE.entryZ, WALLRUN.entryZ, FAR_Z],
  hazards: HAZARDS,
  startPose: { x: OX, z: 12, yaw: 180 },
  sign:
    "THE TUTORIAL\n\nThe game a room at a time: every move first, then your hacks, then a gun and a fight. " +
    "A room's door opens once you have done its move, and the dark glass walls cannot be climbed or run on.\n\n" +
    "Fall into a pit and you are back at its door. Stuck on a room? Hold {interact} to skip it.",
  signAt: { x: OUT.x0 + 0.51, z: 15.5 },
  girders: [-3.5, 3.5, 17.5, 24.5],
  lights: [0, 21],
  build(b) {
    const { platMat, roomMat } = b;
    const WH = cfg.wallH;
    // between the bays, out to the turn: one block, the full height
    b.box(OUT.x0 - BACK.x1, WH, TURN_Z - 9, (BACK.x1 + OUT.x0) / 2, 0, (9 + TURN_Z) / 2, roomMat(100));

    // 2 and 3: a slick ledge across the bay, in a slick room
    for (const [r, i] of [
      [JUMP, 1],
      [DOUBLE, 2],
    ] as const) {
      slickRoom(b, OUT, r.entryZ, r.exitZ, [DIVIDERS[i].door, DIVIDERS[i + 1].door]);
      slickLedge(b, OUT, r.ledge);
    }

    // 4, 5 and 6: a step up, the deck, the pit; 4's and 6's far side a slick ledge, 5's a deck and the lit wall to run
    const deckOf = (r: PitRoom, bay: { x0: number; x1: number }) => {
      const w = bay.x1 - bay.x0;
      const cx = (bay.x0 + bay.x1) / 2;
      b.box(w, cfg.step, Math.abs(r.a0 - r.s0), cx, 0, (r.s0 + r.a0) / 2, platMat);
      b.box(w, DECK, Math.abs(r.a1 - r.a0), cx, 0, (r.a0 + r.a1) / 2, platMat);
      b.hazardFloor(Math.min(r.a1, r.b0), Math.max(r.a1, r.b0), bay.x0, bay.x1);
      b.glow(w, 0.05, 0.15, cx, DECK, r.a1 - Math.sign(r.a1 - r.a0) * 0.1, 0x7ddc8a, 1.4);
    };
    slickRoom(b, OUT, MANTLE.entryZ, MANTLE.exitZ, [DIVIDERS[3].door, DIVIDERS[4].door]);
    deckOf(MANTLE, OUT);
    slickLedge(b, OUT, { z0: MANTLE.b0, z1: MANTLE.b1, top: MANTLE.top });
    deckOf(WALLRUN, OUT);
    b.box(OUT.x1 - OUT.x0, DECK, WALLRUN.b1 - WALLRUN.b0, OX, 0, (WALLRUN.b0 + WALLRUN.b1) / 2, platMat);
    b.glow(OUT.x1 - OUT.x0, 0.05, 0.15, OX, DECK, WALLRUN.b0 + 0.1, 0x7ddc8a, 1.4);
    const lit = parseInt(cfg.wallRun.lit.slice(1), 16);
    b.glow(0.04, 0.12, WALLRUN.b0 - WALLRUN.a1 + 6, RUN_WALL_X - 0.03, DECK + 2.2, (WALLRUN.a1 + WALLRUN.b0) / 2, lit, 1.6);
    // and a lit line up the deck from its door to the lit wall, then along the wall to the take-off: run it and you are
    // where a jump takes the wall (the owner's playtest, 2026-10-18: "painfully obvious where to go"). A body run along a
    // wall rides a hand's width off it, inside the wall run's reach (movement.json wallRun.reach).
    {
      const door = DIVIDERS[4].door;
      const fromX = (door[0] + door[1]) / 2;
      const lineX = RUN_WALL_X - 0.55;
      const z0 = WALLRUN.a0 + 0.5;
      const z1 = WALLRUN.a0 + 3.5;
      const len = Math.hypot(lineX - fromX, z1 - z0);
      const diag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, len), emissive(lit, 1.8));
      diag.position.set((fromX + lineX) / 2, DECK + 0.02, (z0 + z1) / 2);
      diag.rotation.y = Math.atan2(lineX - fromX, z1 - z0);
      b.add(diag);
      b.glow(0.16, 0.03, WALLRUN.a1 - z1, lineX, DECK, (z1 + WALLRUN.a1) / 2, lit, 1.8);
    }
    slickRoom(b, BACK, DASH.entryZ, DASH.exitZ, [DIVIDERS[6].door, DIVIDERS[5].door]);
    deckOf(DASH, BACK);
    slickLedge(b, BACK, { z0: DASH.b0, z1: DASH.b1, top: DASH.top });

    // 7: the platform you double jump onto, in a slick room; 8: the wall you climb (not slick)
    slickRoom(b, BACK, HIGH.entryZ, HIGH.exitZ, [DIVIDERS[7].door, DIVIDERS[6].door]);
    slickLedge(b, BACK, HIGH.ledge);
    const cl = CLIMB.ledge;
    b.box(BACK.x1 - BACK.x0, cl.top, cl.z0 - cl.z1, BX, 0, (cl.z0 + cl.z1) / 2, roomMat(cl.z0));
    b.glow(BACK.x1 - BACK.x0, 0.06, 0.12, BX, cl.top - 0.06, cl.z0 + 0.06, 0xffd23c, 1.4);

    // 9: the superglide. Its lane: slick walls, the ledge, the pit, the landing deck across the whole bay; the other
    // lane, behind a slick wall, the optional way: stairs up to the ledge's height and a bridge over the pit
    const G = GLIDE;
    const glass = b.flat(SLICK_GLASS, 0.3, 0.35);
    const T = cfg.slick;
    b.box(T, WH, G.entryZ - G.b1, BACK.x0 + T / 2, 0, (G.entryZ + G.b1) / 2, glass, false);
    b.slick(BACK.x0, BACK.x0 + T, G.b1, G.entryZ, 0, WH);
    b.box(SG.wall, 6, G.face - G.b0, G.laneX1 + SG.wall / 2, 0, (G.face + G.b0) / 2, glass, false);
    b.slick(G.laneX1, G.laneX1 + SG.wall, G.b0, G.face, 0, 6);
    b.glow(0.04, 0.1, G.face - G.b0, G.laneX1 - 0.02, 1.2, (G.face + G.b0) / 2, 0xff3b2f, 1.3);
    b.box(G.laneX1 - BACK.x0, G.h, SG.top, (BACK.x0 + G.laneX1) / 2, 0, (G.face + G.edge) / 2, platMat);
    b.box(BACK.x1 - BACK.x0, G.h, G.b0 - G.b1, BX, 0, (G.b0 + G.b1) / 2, platMat);
    b.hazardFloor(G.b0, G.edge, BACK.x0, BACK.x1);
    b.glow(G.laneX1 - BACK.x0, 0.05, 0.15, (BACK.x0 + G.laneX1) / 2, G.h, G.edge + 0.1, 0x7ddc8a, 1.4);
    b.glow(BACK.x1 - BACK.x0, 0.05, 0.15, BX, G.h, G.b0 - 0.1, 0x7ddc8a, 1.4);
    // the bridge's lane: the stairs (each rise under a step's height, so walked) and the bridge on to the landing deck
    const bw = BACK.x1 - G.bridgeX0;
    const bx = (G.bridgeX0 + BACK.x1) / 2;
    const rise = G.h / SG.stairs;
    for (let i = 0; i < SG.stairs; i++) b.box(bw, rise * (i + 1), 1, bx, 0, G.face + (SG.stairs - i) - 0.5, b.coverMat);
    b.box(bw, 0.3, G.face - G.b0, bx, G.h - 0.3, (G.face + G.b0) / 2, b.flat(0x2a6f4a, 0.5, 0.2));
    b.glow(0.06, 0.06, G.face - G.b0, BACK.x1 - 0.2, G.h + 1.0, (G.face + G.b0) / 2, 0x7ddc8a, 1.6);
    // (drawn only in the page: the checks build this in node, with no canvas)
    // (over the foot of the stairs, under 25 degrees up from the room's door, so it is read coming in)
    if (typeof document !== "undefined") b.add(optionalSign(bx, 3.3, G.face + SG.stairs + 1.8));
  },
};

/** "OPTIONAL" over the bridge's stairs, facing you as you come down the bay, green so it reads as a way, not a warning */
function optionalSign(x: number, y: number, z: number): THREE.Object3D {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 256;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#0e2a1c";
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = "#7ddc8a";
  g.lineWidth = 10;
  g.strokeRect(8, 8, 496, 240);
  g.fillStyle = "#7ddc8a";
  g.textAlign = "center";
  g.font = '700 92px "Rajdhani", Impact, sans-serif';
  g.fillText("OPTIONAL", 256, 120);
  g.font = '600 40px "Rajdhani", "Segoe UI", sans-serif';
  g.fillStyle = "#e8fbff";
  g.fillText("no superglide: take the bridge", 256, 196);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  m.position.set(x, y, z);
  return m;
}
