// SpeedKills' two 1v1 arenas, NEON YARD and NEON HALL (the owner, 2026-10-09: "2 1v1 maps, 1 centre destrict map, 1 br
// map, all new neon stuff, the 1v1 maps are supposed to be super basic"): small walled rooms of the Neon City bundle's
// own pieces, laid by the city's layout out past its square (neon-layout.ts rules.arenas) and baked into the city's file,
// each a node of its own that the page draws alone while it is played (neonmap.ts showNeonPart). Played on the city's
// side of the world, like THE CENTRE, but with walls of their own: no circle, and none of the city in view.
//
// Plain data in world space, so the menu, the match and the checks read it in node, as arenas/index.ts wants.
import neonCfg from "../../config/neonmap.json";
import centreCfg from "../../config/centre.json";
import type { ArenaMapInfo } from "./index";
import type { PlanSpawn } from "./plan";

/** what the layout wrote of an arena (neonmap.json arenas), map-local */
type Laid = { chunk: string; at: number[]; half: number[]; roof: number | null; shadow: number; spawns: number[][]; zones: number[][] };

// (the city's middle in the world: THE CENTRE's, which is br.ts BR_X and BR_Z, read here without three.js)
const OX = centreCfg.x;
const OZ = centreCfg.z;

const LAID = (neonCfg as unknown as { arenas: Record<string, Laid> }).arenas;

function arena(id: string, name: string, blurb: string): ArenaMapInfo {
  const L = LAID[id];
  const [x, z] = [L.at[0] + OX, L.at[1] + OZ];
  const spawns: PlanSpawn[] = L.spawns.map(([sx, sz, yaw]) => ({ x: sx + OX, z: sz + OZ, yaw }));
  const zones = L.zones.map(([zx, zz], i) => ({ id: "ABC"[i], x: zx + OX, z: zz + OZ }));
  return {
    id,
    name,
    blurb,
    bounds: { minX: x - L.half[0], maxX: x + L.half[0], minZ: z - L.half[1], maxZ: z + L.half[1] },
    center: { x: zones[0].x, z: zones[0].z },
    spawns,
    // each pair's first to one side, its second to the other
    teams: { a: spawns.filter((_, i) => i % 2 === 0), b: spawns.filter((_, i) => i % 2 === 1) },
    zones,
    crown: { x: zones[0].x, z: zones[0].z },
    bestFor: ["duel"],
    plan: null,
    city: true,
    chunk: L.chunk,
  };
}

export const YARD_MAP = arena("yard", "NEON YARD", "A walled yard under the open sky: crates, cool boxes and a wall across each end. Small, flat and quick.");
export const HALL_MAP = arena("hall", "NEON HALL", "A closed concrete hall under one roof: pillars, crates and lamps overhead.");

/** the sun's shadow box's half width over an arena (range.ts setShadowRegion), rules.arenas `shadow` */
export const arenaShadow = (m: ArenaMapInfo): number => LAID[m.id].shadow;
