// What a caller needs to know about a map without building it.
//
// This file is deliberately free of three.js and of anything that wants a browser: the menu, the match and the checks
// all read a map from here. Every map is drawn in the Neon City's file (arenas/neonarenas.ts, arenas/centre.ts): the
// last arena drawn from a plan, the Vault, went in Milestone 663, when the Gulag moved to THE GULAG street.
import type { PlanSpawn } from "./plan";

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

