// THE CENTRE: SpeedKills' 1v1 map, the Neon City's own middle (the owner, 2026-10-01: "make it like one of the sections
// of our ... map ... that middle district, the circular part, and the vertical building ... a small map where you
// can't go outside of that circle"). Nothing is built for it: it is the battle royale's city, its tower, the tower's
// podium, the Sky Ring and the ring road round them, inside a circle you cannot leave (player.ts Bounds.circle, a bot's
// ring, a wall drawn where it stands). Played on the city's side of the world: its fog, its light, its shadows.
//
// Like the plans here it is plain data in world space, so the menu, the match and the checks read it in node.
import cfg from "../../config/centre.json";
import type { ArenaMapInfo } from "./index";
import type { PlanSpawn } from "./plan";

const DEG = Math.PI / 180;

/** a point on the map at a bearing (degrees, 0 toward +z) and a distance from the middle, world space */
function at(bearing: number, r: number): { x: number; z: number } {
  return { x: cfg.x + Math.sin(bearing * DEG) * r, z: cfg.z + Math.cos(bearing * DEG) * r };
}

/** a spawn on the ring at a bearing, facing the tower (a yaw of b faces back along the bearing, toward the middle) */
function spawn(bearing: number): PlanSpawn {
  return { ...at(bearing, cfg.spawnR), yaw: bearing };
}

const SPAWNS = cfg.spawns.map(spawn);
const ZONE = at(cfg.zone.bearing, cfg.zone.r);

export const CENTRE_MAP: ArenaMapInfo = {
  id: "centre",
  name: "THE CENTRE",
  blurb: "The Neon City's own middle: the tower, its podium and the Sky Ring, inside a circle you cannot leave.",
  bounds: {
    minX: cfg.x - cfg.radius,
    maxX: cfg.x + cfg.radius,
    minZ: cfg.z - cfg.radius,
    maxZ: cfg.z + cfg.radius,
    circle: { x: cfg.x, z: cfg.z, r: cfg.radius },
  },
  // the 1v1's circle, the bots' goal and a mode's middle: on the ring road, not inside the tower
  center: ZONE,
  spawns: SPAWNS,
  // each pair's first to one side, its second to the other
  teams: { a: SPAWNS.filter((_, i) => i % 2 === 0), b: SPAWNS.filter((_, i) => i % 2 === 1) },
  zones: cfg.zones.map((b, i) => ({ id: "ABC"[i], ...at(b, cfg.zone.r) })),
  crown: ZONE,
  bestFor: ["duel"],
  plan: null,
  city: true,
};

/** the circle's middle and the shadow box over it, for the page (main.ts) */
export const CENTRE = { x: cfg.x, z: cfg.z, radius: cfg.radius, shadow: cfg.shadow, wall: cfg.wall };
