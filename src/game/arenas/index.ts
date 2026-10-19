// The arenas that are drawn from a plan, and what a caller needs to know
// about one without building it.
//
// This file is deliberately free of three.js and of anything that wants a
// browser: the menu, the match and the checks all read the list from here,
// and only src/game/arena.ts goes on to build the meshes. That is why
// tools/checks/arenas.ts can walk every map in plain node.
import { VAULT } from "./vault";
import { boundsOf, spawnsOf, teamSpawnsOf, type ArenaPlan, type PlanSpawn } from "./plan";

/** the drawn arenas: the Gulag's Vault alone since the legacy game's went (Milestone 533) */
export const ARENA_PLANS: ArenaPlan[] = [VAULT];

/** what a map looks like to a match, a menu or a mode: world coordinates, no meshes */
export interface ArenaMapInfo {
  id: string;
  name: string;
  /** one line for the menu */
  blurb: string;
  /** the play area the player is clamped to (src/game/player.ts Bounds), and a circle inside it where there is one */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number; circle?: { x: number; z: number; r: number } };
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
  /** the plan behind it, for the builder and the checks; null for the maps drawn in the city's file */
  plan: ArenaPlan | null;
  /** played on the battle royale's city, not on an arena of its own (THE CENTRE, arenas/centre.ts) */
  city?: boolean;
  /** the city file's own piece it is drawn in, shown alone while it is played, the city hidden (arenas/neonarenas.ts) */
  chunk?: string;
  /**
   * what stands in its middle where it is not the floor (THE GULAG's ledge): the top's height, where the overtime flag
   * stands, and the ways up a bot walks to first (it cannot jump or climb), world space
   */
  ledge?: { y: number; ways: Array<{ x: number; z: number }> };
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

/** the drawn arenas, as the rest of the game reads them */
export const PLAN_MAPS: ArenaMapInfo[] = ARENA_PLANS.map(infoOf);
