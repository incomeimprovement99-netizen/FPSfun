// The arenas that are drawn from a plan, and what a caller needs to know
// about one without building it.
//
// This file is deliberately free of three.js and of anything that wants a
// browser: the menu, the match and the checks all read the list from here,
// and only src/game/arena.ts goes on to build the meshes. That is why
// tools/checks/arenas.ts can walk every map in plain node.
import { CROSSING } from "./crossing";
import { RINGWORKS } from "./ringworks";
import { VAULT } from "./vault";
import { NEONBLOCK } from "./neonblock";
import { boundsOf, spawnsOf, teamSpawnsOf, type ArenaPlan, type PlanSpawn } from "./plan";

export const ARENA_PLANS: ArenaPlan[] = [VAULT, CROSSING, RINGWORKS, NEONBLOCK];

/** what a map looks like to a match, a menu or a mode: world coordinates, no meshes */
export interface ArenaMapInfo {
  id: string;
  name: string;
  /** one line for the menu */
  blurb: string;
  /** the play area the player is clamped to (src/game/player.ts Bounds) */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** the middle of the map, where the 1v1 circle and the crown sit */
  center: { x: number; z: number };
  /** every spawn, world space; the first two are a pair of opposite ends */
  spawns: PlanSpawn[];
  /** the two sides' spawns in team deathmatch, world space */
  teams: { a: PlanSpawn[]; b: PlanSpawn[] };
  /** Control's three points, world space */
  zones: Array<{ id: string; x: number; z: number }>;
  /** where the crown drops, world space */
  crown: { x: number; z: number };
  /** the modes the map was drawn for */
  bestFor: string[];
  /** the plan behind it, for the builder and the checks; null for the two hand-built arenas */
  plan: ArenaPlan | null;
}

/** a plan, as the rest of the game wants to read it */
export function infoOf(plan: ArenaPlan): ArenaMapInfo {
  return {
    id: plan.id,
    name: plan.name,
    blurb: plan.blurb,
    bounds: boundsOf(plan),
    center: { x: plan.x, z: plan.z },
    spawns: spawnsOf(plan),
    teams: { a: teamSpawnsOf(plan, "a"), b: teamSpawnsOf(plan, "b") },
    zones: plan.zones.map((z) => ({ id: z.id, x: plan.x + z.x, z: plan.z + z.z })),
    crown: { x: plan.x + plan.crown.x, z: plan.z + plan.crown.z },
    bestFor: plan.bestFor,
    plan,
  };
}

/** the three drawn arenas, in the order they should be offered */
export const PLAN_MAPS: ArenaMapInfo[] = ARENA_PLANS.map(infoOf);

export function planById(id: string): ArenaPlan | null {
  return ARENA_PLANS.find((p) => p.id === id) ?? null;
}
