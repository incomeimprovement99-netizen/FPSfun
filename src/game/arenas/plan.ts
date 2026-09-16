// What an arena is, before anything is drawn.
//
// An arena plan is numbers and nothing else: no three.js, no materials, no
// textures, no canvas. That split is deliberate. The builder (build.ts) turns
// a plan into meshes and needs a browser for its graffiti textures, but the
// checks in tools/checks/arenas.ts have to walk every map in plain node, and
// they can only do that if the box list exists without a DOM. So the shape of
// a map lives here and the look of it lives there.
//
// Two rules of this engine are baked into the types:
//   - Collision is axis-aligned boxes only. A PlanBox is a box, there is no
//     rotation field, and a slope is a staircase of boxes (see `stairs`).
//   - Bots cannot jump, climb or mantle (src/game/bots.ts). They walk, step up
//     0.56 m and slide along walls. Anything a bot has to reach needs a run of
//     steps no taller than that, which is what `stairs` is for.

/** the materials a plan can ask for; build.ts decides what each one looks like */
export type MatKey = "wall" | "slab" | "crate" | "container" | "containerAlt" | "cover" | "steel";

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
  /** an orange cap on top, the arena's way of saying "you can stand here" */
  cap?: boolean;
  /**
   * This box's top is a floor people are meant to walk on, and who is meant
   * to get there. "bot" means a bot has to be able to walk to it, which is
   * what tools/checks/arenas.ts proves by flooding the map with a bot's own
   * rules; "player" is a place only a mantle or a rope reaches, and a bot
   * never needs it. Nothing a mode scores may sit on a "player" floor.
   */
  walk?: "bot" | "player";
}

/** a spawn in arena coordinates; yaw 180 faces +z, the same as arena.ts */
export interface PlanSpawn {
  x: number;
  z: number;
  yaw: number;
}

/** a rideable rope, arena coordinates, with the floor height under each end so its post can reach the ground */
export interface PlanZip {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  floorA: number;
  floorB: number;
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
  /** the outer walls' height */
  wallH: number;
  /** a warehouse roof on top, or open sky */
  roof: boolean;
  /** the roof's light strips and girders, at these x */
  lights: number[];
  girders: number[];
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
  zips: PlanZip[];
  /** the modes this map was drawn for, for the menu's "best for" line */
  bestFor: string[];
}

/** a solid as RANGE_SOLIDS holds it: world space, axis aligned */
export interface PlanSolid {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  base: number;
  top: number;
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

/** the map's collision, in world space, exactly as buildPlan pushes it into RANGE_SOLIDS */
export function solidsOf(plan: ArenaPlan): PlanSolid[] {
  const out: PlanSolid[] = [];
  for (const b of allBoxes(plan)) {
    if (b.solid === false) continue;
    const y = b.y ?? 0;
    out.push({
      minX: plan.x + b.x - b.w / 2,
      maxX: plan.x + b.x + b.w / 2,
      minZ: plan.z + b.z - b.d / 2,
      maxZ: plan.z + b.z + b.d / 2,
      base: y,
      top: y + b.h,
    });
  }
  // the roof is a lid nobody can jump out through, the same one warehouseRoof adds
  if (plan.roof) {
    out.push({
      minX: plan.x - plan.halfX - 1,
      maxX: plan.x + plan.halfX + 1,
      minZ: plan.z - plan.halfZ - 1,
      maxZ: plan.z + plan.halfZ + 1,
      base: plan.wallH,
      top: plan.wallH + 0.5,
    });
  }
  return out;
}

/** the play area the player is clamped to, matching src/game/player.ts's Bounds */
export function boundsOf(plan: ArenaPlan): { minX: number; maxX: number; minZ: number; maxZ: number } {
  return { minX: plan.x - plan.halfX, maxX: plan.x + plan.halfX, minZ: plan.z - plan.halfZ, maxZ: plan.z + plan.halfZ };
}

/** a plan's spawns moved into the world, which is where every caller wants them */
export function spawnsOf(plan: ArenaPlan): PlanSpawn[] {
  return plan.spawns.map((s) => ({ x: plan.x + s.x, z: plan.z + s.z, yaw: s.yaw }));
}

/** one side's spawns in the world, for team deathmatch */
export function teamSpawnsOf(plan: ArenaPlan, side: "a" | "b"): PlanSpawn[] {
  return plan.teams[side].map((i) => ({ x: plan.x + plan.spawns[i].x, z: plan.z + plan.spawns[i].z, yaw: plan.spawns[i].yaw }));
}

/** the yaw that looks at the middle of the map from (x, z), so no spawn faces a wall */
export function yawToCentre(x: number, z: number): number {
  return Math.round(((Math.atan2(x, z) * 180) / Math.PI) * 10) / 10;
}
