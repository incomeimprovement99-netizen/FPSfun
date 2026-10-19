// What a plan is, before anything is drawn: THE MOVEMENT LAB's shape (arenas/movelab.ts), the one place still drawn
// from a plan since the Vault went (Milestone 663).
//
// A plan is numbers and nothing else: no three.js, no materials, no textures, no canvas. The builder (build.ts) turns it
// into meshes and needs a browser for its textures; the checks read the numbers in plain node.
//
// Two rules of this engine are baked into the types:
//   - Collision is axis-aligned boxes only. A PlanBox is a box, there is no
//     rotation field, and a slope is a staircase of boxes (see `stairs`).
//   - Bots cannot jump, climb or mantle (src/game/bots.ts). They walk, step up
//     0.56 m and slide along walls. Anything a bot has to reach needs a run of
//     steps no taller than that, which is what `stairs` is for.

/** the materials a plan can ask for; build.ts decides what each one looks like */
export type MatKey = "wall" | "slab" | "crate" | "container" | "containerAlt" | "cover" | "steel" | "neon";

export interface PlanBox {
  /** centre of the box on the floor plane, in arena coordinates */
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  /** the height the box starts at; 0 is the floor */
  y?: number;
  mat: MatKey;
  /** false for decoration bullets and bodies pass through */
  solid?: boolean;
  /** a neon cap on top, the plan's way of saying "you can stand here" */
  cap?: boolean;
}

/** a spawn in arena coordinates; yaw 180 faces +z, the same as arena.ts */
export interface PlanSpawn {
  x: number;
  z: number;
  yaw: number;
}

/** one of Control's three points */
export interface PlanZone {
  id: string;
  x: number;
  z: number;
}

export interface ArenaPlan {
  id: string;
  /** what the menu calls it */
  name: string;
  /** one line for the menu, and for the sign on the end wall */
  blurb: string;
  /** where the map sits in the world */
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  /** the outer walls' height (open sky over them) */
  wallH: number;
  floorColor: number;
  boxes: PlanBox[];
  /**
   * Eight spawns, because a match holds eight (duel.ts MAX_PLAYERS). The
   * first two are the ends a 1v1 uses, so every map can be played by two.
   */
  spawns: PlanSpawn[];
  /** which spawns belong to which side in team deathmatch, as indices */
  teams: { a: number[]; b: number[] };
  /** Control's three points, and the point the crown sits on */
  zones: PlanZone[];
  crown: { x: number; z: number };
  /** the modes this map was drawn for, for the menu's "best for" line */
  bestFor: string[];
}

/**
 * A staircase, which in this engine is the only kind of slope there is. The
 * steps are stacked blocks rather than floating treads, so a bullet cannot go
 * under them and a body cannot get wedged beneath one.
 *
 * `x` and `z` are the middle of the bottom step's leading edge, and the run
 * climbs in `dir`. The last step can be made deeper than the rest so it meets
 * the floor it is serving with no gap to fall through, which is the mistake
 * that left the battle royale's ridge ramp ending in open air (roadmap
 * milestone 50).
 */
export function stairs(o: {
  x: number;
  z: number;
  dir: "+x" | "-x" | "+z" | "-z";
  steps: number;
  rise: number;
  tread: number;
  width: number;
  mat: MatKey;
  /** the depth of the top step, when it has to reach a landing */
  lastTread?: number;
  cap?: boolean;
}): PlanBox[] {
  const out: PlanBox[] = [];
  const along = o.dir === "+x" || o.dir === "-x" ? "x" : "z";
  const sign = o.dir === "+x" || o.dir === "+z" ? 1 : -1;
  let at = along === "x" ? o.x : o.z;
  for (let i = 0; i < o.steps; i++) {
    const tread = i === o.steps - 1 ? (o.lastTread ?? o.tread) : o.tread;
    const centre = at + (sign * tread) / 2;
    out.push(
      along === "x"
        ? { x: centre, z: o.z, w: tread, d: o.width, h: (i + 1) * o.rise, mat: o.mat, cap: o.cap && i === o.steps - 1 }
        : { x: o.x, z: centre, w: o.width, d: tread, h: (i + 1) * o.rise, mat: o.mat, cap: o.cap && i === o.steps - 1 }
    );
    at += sign * tread;
  }
  return out;
}

/** the four outer walls, built from the plan's own size so nothing can drift out of step with it */
export function shellOf(plan: ArenaPlan): PlanBox[] {
  const { halfX: hx, halfZ: hz, wallH: h } = plan;
  return [
    { x: -hx - 0.5, z: 0, w: 1, d: hz * 2 + 2, h, mat: "wall" },
    { x: hx + 0.5, z: 0, w: 1, d: hz * 2 + 2, h, mat: "wall" },
    { x: 0, z: -hz - 0.5, w: hx * 2, d: 1, h, mat: "wall" },
    { x: 0, z: hz + 0.5, w: hx * 2, d: 1, h, mat: "wall" },
  ];
}

/** every box in the map: the shell first, then everything the plan puts inside it */
export function allBoxes(plan: ArenaPlan): PlanBox[] {
  return [...shellOf(plan), ...plan.boxes];
}

/** the play area the player is clamped to, matching src/game/player.ts's Bounds */
export function boundsOf(plan: ArenaPlan): { minX: number; maxX: number; minZ: number; maxZ: number } {
  return { minX: plan.x - plan.halfX, maxX: plan.x + plan.halfX, minZ: plan.z - plan.halfZ, maxZ: plan.z + plan.halfZ };
}

