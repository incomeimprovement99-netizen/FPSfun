// The battle royale map's shared shape: where it sits in the world, and the types a map is made of (its places, its
// sites, the bots' graph, its towers, pads and doors). SpeedKills' map is the Neon City (neonmap.ts). The legacy
// game's OUTSKIRTS, built here until Milestone 528, went with its scenery, its building kit and its checks.
import type { Doors } from "./doors";
import * as THREE from "three";
import type { Bounds } from "./player";
import worldCfg from "../config/world.json";

export const BR_X = 0;
export const BR_Z = 500;
/** half the map's side: the city's (world.json cut: 304 m since Phase 23.3) */
export const BR_HALF = worldCfg.cut.half;
export const BR_BOUNDS: Bounds = { minX: BR_X - BR_HALF, maxX: BR_X + BR_HALF, minZ: BR_Z - BR_HALF, maxZ: BR_Z + BR_HALF };
export const BR_CENTER = new THREE.Vector3(BR_X, 0, BR_Z);

export interface Poi {
  id: string;
  name: string;
  /** world space */
  x: number;
  z: number;
  /** how far the place reaches, metres */
  radius?: number;
  /** where players drop in, world space; the first is the bots' rally point */
  drops: Array<{ x: number; z: number }>;
}

/**
 * A small named place between the big ones: loot of its own and a name when
 * you walk into it, but no drop points and no bot rally. It is not a Poi
 * because everything that picks a Poi (the squad's drop, the bots' drops,
 * tools/e2e.ts's count of nine) means one of the big places.
 */
export interface Site {
  id: string;
  name: string;
  /** world space */
  x: number;
  z: number;
  /** how far its own loot is laid out, metres (else brmap.json siteRadius): a corner block's on the Neon map is its rooms building */
  radius?: number;
  /** a site on one floor of a building (THE VAULT on the Neon tower): its loot on the floor at this height alone */
  y?: number;
  /** its loot's tier (loot.json tiers) where it is not loot.json's siteTier */
  tier?: string;
}

export interface GraphNode {
  x: number;
  z: number;
  /**
   * The floor the node stands on (0 on the sand; a crest, a deck, the
   * edge's shelf above it). Left out where the bots can also reach a floor
   * over the node, since a flood of the map keeps only the higher of the two.
   */
  y?: number;
  /** the POI this node belongs to, if any */
  poi?: string;
  links: number[];
  /**
   * Nodes reached from this one by riding a zipline, not by walking (the
   * rope's other end). A bot plans through these as it plans through a link,
   * and rides rather than walks them: walking a rope's line would be a fall.
   */
  ropes?: number[];
  /**
   * A jump pad stands here (city.ts padOnto) and throws you up to node `to`:
   * straight up at `up` m/s, then across at (dx, dz) m/s once above `over`.
   * One way: nothing walks back down it. A bot plans through it only on its
   * way somewhere (navgraph.ts), never wandering, since the roofs a pad
   * reaches have parapets it cannot step off.
   */
  pad?: { to: number; up: number; dx: number; dz: number; over: number };
  /** the pads that throw to this node (their nodes): what a plan to here follows back */
  padFrom?: number[];
  /**
   * Inside one of SpeedKills' podium halls (city.ts HALLS), its key: under a roof other nodes stand on, so a bot coming
   * down from the sky never takes one of these for the nearest node
   */
  hall?: string;
}

export interface BrMap {
  root: THREE.Group;
  pois: Poi[];
  /** the small places between the big ones (world space) */
  sites: Site[];
  /**
   * The place or site you are in at (x, z), world space: the nearest one
   * whose radius takes the point in, or null out in the open. What an
   * arrival card asks each frame.
   */
  placeAt(x: number, z: number): Poi | Site | null;
  nodes: GraphNode[];
  /** the ring wall, scaled to the live ring each frame */
  ringWall: THREE.Mesh;
  /** jump towers: a balloon to ride up and drop again from (world space), and the height of the floor it is ridden from (the Mast's is its roof) */
  towers: Array<{ x: number; z: number; y: number }>;
  /**
   * launch pads: step on and be thrown along (dx, dz) and up (world space). A
   * jump pad (SpeedKills' city) stands on a floor `y` up and throws you `up`
   * m/s straight up, and once you are above `over` (a roof's edge, world
   * height) carries you across at (dx, dz) m/s onto it; the road's pads have
   * none of these, and throw by squad.json pad. A window pad (the Sky Lobby's, city.ts) has a `hold`: it takes you
   * to its middle and holds the column and the push (course.ts stepPads), so you go through a window, not at it.
   */
  pads: Array<{ x: number; z: number; dx: number; dz: number; y?: number; up?: number; over?: number; hold?: number }>;
  /** a door in every ground-floor doorway (doors.ts) */
  doors: Doors;
}
