// SpeedKills' battle royale map: a dense neo-futuristic city at night
// (docs/PHASE_18_PLAN_SPEEDKILLS.md 7.9). The legacy game's Outskirts is
// br.ts; this is built instead of it on a SpeedKills page, in the same square
// of the world (BR_X, BR_Z), which SpeedKills makes 500 m a side. Everything
// that reads the map (the match, the loot, the bots, the doors, the HUD's map)
// reads the BrMap this returns, as it reads Outskirts'.
//
// The layout, from the owner's answers:
// - nine sectors, the middle one the biggest (200 m): THE SPIRE, the hottest
//   drop, its tallest towers round a plaza with one megatower in it;
// - eight districts round it, each with its own neon accent and its own look:
//   glass towers, lit windows, the old town's brick;
// - a grid of streets 14 m wide between 49 blocks; towers of 8 to 16 storeys
//   in the core, mid-rises round it, low blocks at the edge, all of them
//   4 m storeys with stairs, windows you can vault and roofs you can reach;
// - skybridges between the core's towers, ziplines between roofs, launch pads
//   at the crossings and jump towers in the plazas, so "through, over or up"
//   is always a choice.
//
// Everything is boxes on RANGE_SOLIDS, as the rest of the world is, found
// through the collision grid (solidgrid.ts). The look is CC0: ambientCG's
// night facades (their lit windows glow), dark glass, brick, asphalt and
// black metal (tools/fetch-assets.ts), with emissive neon strips of our own.
import * as THREE from "three";
import { RANGE_SOLIDS } from "./range";
import { DISTRICT_FLOORS, FLOORS, HALL_FLOORS, floorAt } from "./floors";
import DISTRICTS from "../config/citydistricts.json";
import { DISTRICT_INSIDES, DISTRICT_SOLIDS } from "./districtsolids";
import { botWalk } from "./botbody";
import { building, DRESSING, type BoxMaker, type PoiCtx, type Side, type RoutePoint } from "./brpoi";
import { DOORWAYS, Doors } from "./doors";
import { material, tileBox, type MatName } from "./materials";
import { emissive, flat } from "./geo";
import { ZIPLINES } from "./traversal";
// (a jump pad throws to a height by the movement's own gravity: SpeedKills' is 17.5 m/s/s, its overlay's)
import { MOVE } from "./movement";
import { BR_X, BR_Z, BR_HALF, type BrMap, type GraphNode, type Poi, type Site } from "./br";
import cityCfg from "../config/city.json";
import kitCfg from "../config/citykit.json";
import chainCfg from "../config/chaincourse.json";
import { dissolvedTo, type SectorPhase } from "./decay";
import type { Solid } from "./range";

/** a sector of the city: its rectangle (map-local), its name, its neon */
export interface Sector {
  id: string;
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  accent: number;
}

/** the nine sectors (map-local): the centre, then the eight round it */
export const SECTORS: readonly Sector[] = cityCfg.sectors.map((s) => ({ ...s, accent: parseInt(s.accent.slice(1), 16) }));

/** the sector a map-local point is in (the centre's edges belong to it) */
export function sectorAt(x: number, z: number): Sector | null {
  return SECTORS.find((s) => x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) ?? null;
}

/** a seeded random, so every browser builds the same city */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** the block spans along one axis (map-local): the streets are what is between them */
export const BLOCKS: ReadonlyArray<readonly [number, number]> = cityCfg.blocks as Array<[number, number]>;
/** the streets' middles, along one axis */
export const STREETS: readonly number[] = BLOCKS.slice(0, -1).map((b, i) => (b[1] + BLOCKS[i + 1][0]) / 2);

/** each low tower's way up as graph nodes, door to roof, and the street node it hangs off (-1: none in reach); the checks walk them */
export const ROOF_ROUTES: Array<{ street: number; nodes: number[]; storeys: number }> = [];
/** the Sky Lobby's bridges (city.ts skyLobby): each from one lobby's window across a street to the next's, world metres, for the checks that run them */
export const LOBBY_BRIDGES: Array<{ ax: number; az: number; bx: number; bz: number; y: number }> = [];
/** the Sky Lobby's canyons: two lobbies' windows lined up across a canyon, from one face to the other, world metres */
export const LOBBY_CANYONS: Array<{ ax: number; az: number; bx: number; bz: number; y: number }> = [];
/** the Sky Park's (city.json skyPark): its rooms' bridges (the Spire's terrace's among them) and canyons, world metres, as the lobby's */
export const PARK_BRIDGES: Array<{ ax: number; az: number; bx: number; bz: number; y: number }> = [];
export const PARK_CANYONS: Array<{ ax: number; az: number; bx: number; bz: number; y: number }> = [];
/**
 * The stair cores (city.json stairCore), world metres: for each, a point outside its door on the promenade, the way up
 * it as waypoints (each a flight's foot or top, a lane's middle), and the deck it tops out on
 */
export const STAIR_CORES: Array<{ outside: { x: number; z: number; y: number }; way: Array<{ x: number; z: number; y: number }>; top: number }> = [];
/**
 * The fire escapes (city.json fireEscape), world metres, for the checks that climb them: where to stand in front of
 * the drop ladder (`outside`, and `wall` the way to face it, degrees of yaw), the way up the flights as waypoints from
 * the first landing, the spot on the top landing to climb the wall from (facing `wall` again), and the roof it tops
 * out on. `box` is what it stands in.
 */
export const FIRE_ESCAPES: Array<{
  family: string;
  outside: { x: number; z: number; y: number };
  wall: number;
  landing: number;
  way: Array<{ x: number; z: number; y: number }>;
  climb: { x: number; z: number; y: number };
  roof: number;
  box: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** the doorways into the open storeys it passes: a point on the landing in front of each, and one in the room */
  doors: Array<{ out: { x: number; z: number; y: number }; in: { x: number; z: number; y: number } }>;
}> = [];
/** the city's street and the blocks' pavements, which atmosphere.ts makes wet from Balanced up */
export const CITY_GROUND: THREE.MeshStandardMaterial[] = [];
/** where steam rises in the centre (city.json steam; steam.ts draws it), world metres: the metro's stairwells, drains at the kerbs, roof plant */
export const STEAM_SOURCES: Array<{ x: number; y: number; z: number; kind: "metro" | "drain" | "vent" }> = [];
/** the centre's flickering signs (city.json flicker; steam.ts dims them): each in a material of its own, its steady light, and a seed */
export const FLICKER_SIGNS: Array<{ material: THREE.MeshStandardMaterial; base: number; seed: number }> = [];
/** the Spire's drop (city.json spire drop), world metres: the shaft, its top and foot, and the doors out of it */
/**
 * The Spire's crown deck, world metres: its middle, its roof and its size, and how high the mast on it reaches (city.json
 * spire). The SpeedKills ship flies past it (dropship.ts shipLine), always near enough to glide onto it.
 */
export const SPIRE_TOP = { x: 0, z: 0, y: 0, w: 0, d: 0, mast: 0 };
export const SPIRE_DROP: { shaft: { minX: number; maxX: number; minZ: number; maxZ: number }; top: number; foot: number; doors: Array<{ y: number; minX: number; maxX: number; minZ: number; maxZ: number }> } = {
  shaft: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 },
  top: 0,
  foot: 0,
  doors: [],
};
/**
 * The metro under the centre (city.json metro), world metres: its sides (each a stretch of tunnel under a street, `alongX`
 * when the street runs along x), its floor, and its stairs, each from its top on the street (`top`) to its foot on the
 * tunnel's floor (`foot`), for the checks that walk it.
 */
export const METRO: {
  floor: number;
  sides: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; alongX: boolean }>;
  stairs: Array<{ top: { x: number; z: number }; foot: { x: number; z: number }; x0: number; x1: number; z0: number; z1: number }>;
} = { floor: 0, sides: [], stairs: [] };
/**
 * The centre's podium halls (city.json halls, Phase 24.4), world metres: each one's inside (the box you stand in, its
 * floor `y0` and ceiling `y1`), its doors (the opening's middle on the wall's outer face, the way out `nx`, `nz`, its
 * width and top), its columns and counters (solid boxes), for the loot, the bots and the checks
 */
export const HALLS: Array<{
  key: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y0: number;
  y1: number;
  doors: Array<{ x: number; z: number; nx: number; nz: number; w: number; top: number }>;
  columns: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
  /** the waist-high counters and the kiosks, solid boxes to fight round */
  counters: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; top: number }>;
  /** the walk round the walls a storey up (24.4b): its floor's top and underside, and its four runs */
  gallery: { top: number; under: number; runs: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }> };
  /** the flights up to it: each one's box, a point on the gallery at its top and one on the floor past its foot */
  stairs: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; top: { x: number; z: number }; foot: { x: number; z: number } }>;
}> = [];
/** the chimneys (city.json chimneys): each one's walls' inner faces, its length and its landing heights, world metres, for the checks that climb them */
/**
 * The chimneys (city.json chimneys), world metres: `landing` and `top` the first two legs' ends, `platforms` every leg's to
 * the summit, `exits` the openings in its walls onto a room either side (`side` -1 west, 1 east), at the room's floor `y`
 * and `z` along the chimney, over the landing `from`
 */
export const CHIMNEYS: Array<{ name: string; x: number; innerW: number; z0: number; z1: number; base: number; landing: number; top: number; summit: number; platforms: Array<{ y: number; far: boolean }>; exits: Array<{ side: number; y: number; z: number; from: number }> }> = [];
/** the rooftop highway's four corners in order round its loop (world metres, its deck's height), for the checks that walk it */
export const HIGHWAY: Array<{ x: number; z: number; y: number }> = [];
/**
 * The centre's concourse (world metres), for the checks that walk it: each
 * podium's public stair as a walk from the pavement to its top step and onto
 * the podium, and each bridge as a walk from one podium to the next.
 */
export const CONCOURSE: {
  stairs: Array<{ legs: Array<{ x: number; z: number }>; top: number }>;
  bridges: Array<{ a: { x: number; z: number }; b: { x: number; z: number }; y: number }>;
  /** the graph's nodes on the Spire's podium (its promenade's corners), for the checks that find a way there */
  spire: number[];
} = { stairs: [], bridges: [], spire: [] };

/**
 * What the city bundle dresses (citydress.ts), recorded as the city is built, map-local: the towers with their roof
 * clutter, the podiums and which side each leaves open, the public stairs, the skyline and the lamp posts. Recording
 * only: nothing here draws from the city's random stream, so the city is the same with or without the bundle.
 */
/**
 * The materials of what the bought kit draws over and replaces (citykit.ts hides them once it has drawn over every one):
 * Neon Alley's stalls, a dark kiosk each, where the kit's food stand is open-fronted and would show the box inside it.
 */
export const STAND_INS: { stalls: THREE.Material[]; cars: THREE.Material[]; machinery: THREE.Material[]; escapes: THREE.Material[]; skins: THREE.Material[]; kiosks: THREE.Material[] } = { stalls: [], cars: [], machinery: [], escapes: [], skins: [], kiosks: [] };
export const KIT_SITES: {
  /** `core`: its stair core's box (city.json stairCore), which a room module behind a face stops short of. `family` and
   * `faces`: one outside the centre that the kit dresses all the same, in that family's pieces and on those faces alone
   * (a district's backs' fronts, Phase 26.4) */
  towers: Array<{ x: number; z: number; w: number; d: number; base: number; roof: number; storeys: number; lobby?: number; park?: number; floors?: number[]; sector: string; clutter: Array<{ x: number; z: number; y: number; w: number; h: number; d: number }>; core?: { x0: number; x1: number; z0: number; z1: number }; family?: string; faces?: Array<"n" | "s" | "w" | "e"> }>;
  /** the metro's stairwells in the street (map-local), which nothing may stand over */
  openings: Array<{ x0: number; x1: number; z0: number; z1: number }>;
  /** the Sky Lobby's and the Sky Park's rooms: the tower's box, the storey's floor, and each face's window, along it from its middle */
  rooms: Array<{ x: number; z: number; w: number; d: number; y: number; at: { n: number; s: number; w: number; e: number } }>;
  /**
   * The fire escapes (city.json fireEscape), map-local: the family, the face, where along it the pieces' frame starts
   * (`uStart`, and `dir` the way the pieces' width runs along the face's axis), the tower's base and its storeys, and
   * the box it stands in, which nothing of the kit's may cross
   */
  escapes: Array<{ family: string; face: "n" | "s" | "w" | "e"; at: number; uStart: number; dir: number; base: number; storeys: number; x0: number; x1: number; z0: number; z1: number; y0: number; y1: number }>;
  /** the Spire's machinery (city.json spire machinery): solid boxes the kit's Glass pieces dress, `kind` stack or machine */
  machinery: Array<{ kind: "stack" | "machine"; x: number; z: number; y: number; w: number; h: number; d: number }>;
  /** openings in a tower's face the kit leaves bare (the Spire's drop's doors), map-local */
  doors: Array<{ x0: number; x1: number; z0: number; z1: number; y0: number; y1: number; escape?: boolean }>;
  /** the centre's parked cars (city.json streetLife): where each stands, which way along the street, which way it faces */
  cars: Array<{ x: number; z: number; alongX: boolean; facing: number }>;
  /** Neon Alley's stalls (city.json neonAlley): solid boxes, the kit's food stands over them, facing the street (yaw) */
  stalls: Array<{ x: number; z: number; w: number; d: number; h: number; yaw: number }>;
  podia: Array<{ key: string; x0: number; x1: number; z0: number; z1: number; top: number; plaza: number; spire: boolean }>;
  stairs: Array<{ x0: number; x1: number; z0: number; z1: number }>;
  skyline: Array<{ x: number; z: number; w: number; h: number }>;
  lamps: Array<[number, number]>;
  /**
   * The podium halls (HALLS), map-local: each one's inside, and its doors by face (n, s, w, e as a tower's), `u0` to `u1`
   * along the face and up to `top`, so the kit leaves them open outside and lines the walls between them inside
   */
  halls: Array<{ x0: number; x1: number; z0: number; z1: number; y0: number; y1: number; accent: number; doors: Array<{ face: "n" | "s" | "w" | "e"; u0: number; u1: number; top: number }> }>;
  /** the halls' kiosks (city.json halls kiosk), map-local: solid boxes the kit's food stands dress, turned `yaw` */
  kiosks: Array<{ x: number; z: number; w: number; d: number; h: number; yaw: number }>;
} = { towers: [], podia: [], stairs: [], skyline: [], lamps: [], openings: [], stalls: [], rooms: [], cars: [], doors: [], machinery: [], escapes: [], halls: [], kiosks: [] };

export function buildCityMap(scene: THREE.Scene): BrMap {
  const C = cityCfg;
  const root = new THREE.Group();
  root.name = "br";
  root.position.set(BR_X, 0, BR_Z);
  scene.add(root);
  DOORWAYS.length = 0;
  DRESSING.length = 0;
  FLOORS.length = 0;
  // (let: the districts' ring is built again from a stream of its own, city.json cut, and this one put back after)
  let rnd = seeded(C.seed);
  const firstSolid = RANGE_SOLIDS.length;

  const solid = (minX: number, maxX: number, minZ: number, maxZ: number, base: number, top: number) =>
    RANGE_SOLIDS.push({ minX: minX + BR_X, maxX: maxX + BR_X, minZ: minZ + BR_Z, maxZ: maxZ + BR_Z, base, top });

  // Boxes whose textures keep their world scale: a facade's windows are the
  // same size on a 4 m wall and on a 60 m one (materials.ts tileBox), so the
  // geometry is made per size and material scale, and shared.
  const geoCache = new Map<string, THREE.BoxGeometry>();
  const tileOf = new Map<THREE.Material, number>();
  const geo = (w: number, h: number, d: number, tile: number): THREE.BoxGeometry => {
    const k = `${w.toFixed(2)}:${h.toFixed(2)}:${d.toFixed(2)}:${tile}`;
    let g = geoCache.get(k);
    if (!g) {
      g = new THREE.BoxGeometry(w, h, d);
      if (tile > 0) tileBox(g, tile);
      g.userData.shared = true;
      geoCache.set(k, g);
    }
    return g;
  };
  /**
   * The centre's towers' outward faces in a material of their own, a clone of the tower's (Phase 23.2): once the kit
   * dresses every face, citykit.ts stops it drawing, so a room module's room, set inside the tower's box, shows through
   * its windows. The box's other faces (its top, its cuts: a stair shaft's walls, a room's ceiling) keep the tower's
   * own material. Split into two meshes of one material each, since the static merge merges only those.
   */
  const skins = new Map<THREE.Material, THREE.Material>();
  const skinOf = (mat: THREE.Material): THREE.Material => {
    let s = skins.get(mat);
    if (!s) {
      s = mat.clone();
      s.name = `${mat.name || "tower"} skin`;
      tileOf.set(s, tileOf.get(mat) ?? 0);
      skins.set(mat, s);
      STAND_INS.skins.push(s);
    }
    return s;
  };
  const splitCache = new Map<string, [THREE.BufferGeometry, THREE.BufferGeometry]>();
  /** a box's geometry as two: the faces `mask` names (BoxGeometry's order: +x, -x, +y, -y, +z, -z), and the rest */
  const splitGeo = (w: number, h: number, d: number, tile: number, mask: number): [THREE.BufferGeometry, THREE.BufferGeometry] => {
    const k = `${w.toFixed(2)}:${h.toFixed(2)}:${d.toFixed(2)}:${tile}:${mask}`;
    let pair = splitCache.get(k);
    if (!pair) {
      const base = geo(w, h, d, tile);
      const idx = base.getIndex()!;
      const lists: [number[], number[]] = [[], []];
      for (const gr of base.groups) for (let j = gr.start; j < gr.start + gr.count; j++) lists[(mask >> (gr.materialIndex ?? 0)) & 1 ? 0 : 1].push(idx.getX(j));
      const make = (list: number[]): THREE.BufferGeometry => {
        const g = new THREE.BufferGeometry();
        for (const [n, a] of Object.entries(base.attributes)) g.setAttribute(n, a);
        g.setIndex(list);
        g.userData.shared = true;
        return g;
      };
      pair = [make(lists[0]), make(lists[1])];
      splitCache.set(k, pair);
    }
    return pair;
  };
  /** a solid box whose faces on the tower's outside (`outer`) are drawn in the skin */
  const skinSlab = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, outer: { x0: number; x1: number; z0: number; z1: number }): void => {
    const e = 0.01;
    const mask = (Math.abs(x + w / 2 - outer.x1) < e ? 1 : 0) | (Math.abs(x - w / 2 - outer.x0) < e ? 2 : 0) | (Math.abs(z + d / 2 - outer.z1) < e ? 16 : 0) | (Math.abs(z - d / 2 - outer.z0) < e ? 32 : 0);
    if (!mask) {
      slab(w, h, d, x, y, z, mat);
      return;
    }
    const [og, ig] = splitGeo(w, h, d, tileOf.get(mat) ?? 0, mask);
    for (const [g, m] of [
      [og, skinOf(mat)],
      [ig, mat],
    ] as const) {
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y + h / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
    }
    solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y, y + h);
  };
  const slab: BoxMaker = (w, h, d, x, y, z, mat, isSolid = true) => {
    const m = new THREE.Mesh(geo(w, h, d, tileOf.get(mat) ?? 0), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    if (isSolid) solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y, y + h);
    return m;
  };
  /** a mesh with no collision: trim, neon, the skyline */
  const deco = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material): THREE.Mesh => slab(w, h, d, x, y, z, mat, false);

  // the materials, and how many metres each texture's tile covers
  const tex = (name: MatName, tile: number, o: { color?: number; roughness?: number; metalness?: number; glow?: number } = {}): THREE.MeshStandardMaterial => {
    const m = material(name, o);
    tileOf.set(m, tile);
    return m;
  };
  const night: THREE.MeshStandardMaterial[] = (["skNight1", "skNight2", "skNight3", "skNight4", "skNight5", "skNight6"] as const).map((n) =>
    tex(n, C.facadeTile, { color: 0xb8c4dc, roughness: 0.5, metalness: 0.35, glow: C.windowGlow })
  );
  const glass = tex("skGlass", C.facadeTile, { color: 0x8aa0c0, roughness: 0.25, metalness: 0.6 });
  const brick = tex("skBrick", C.facadeTile * 0.6, { color: 0x9a8a88, roughness: 0.85, metalness: 0.02 });
  const street = tex("skStreet", 8, { color: 0x9aa0aa, roughness: 0.95, metalness: 0.02 });
  const pave = tex("skPave", 4, { color: 0x8a8e96, roughness: 0.9, metalness: 0.02 });
  CITY_GROUND.length = 0;
  CITY_GROUND.push(street, pave);
  const concrete = tex("skConcrete", 4, { color: 0x6a6e76, roughness: 0.9, metalness: 0.02 });
  /** the Sky Lobby's ceiling light, and the frame of a window a pad throws you through (skyLobby) */
  const lobbyLight = emissive(0xfff0d2, 2.2);
  const windowLight = emissive(0x3b8bff, 2.4);
  const metal = tex("skMetal", 3, { color: 0x9098a8, roughness: 0.45, metalness: 0.7 });
  const neonOf = new Map<number, THREE.Material>();
  const neon = (color: number): THREE.Material => {
    let m = neonOf.get(color);
    if (!m) neonOf.set(color, (m = emissive(color, C.neonGlow)));
    return m;
  };
  const trimDark = flat(0x0c0e14, 0.6, 0.4);

  // ---------------------------------------------------------------- the metro's plan (city.json metro)
  // Worked out before anything is built, from the config alone: the streets have stairwells cut into them and the
  // parked cars keep off them. The tunnel itself is built with the streets' life, below.
  const Mt = C.metro;
  const mLines = Mt.streets.map((i) => STREETS[i]);
  const mLo = Math.min(...mLines);
  const mHi = Math.max(...mLines);
  const mHalf = Mt.width / 2;
  /** the ring as four stretches that do not overlap: the two along x the full width, the two along z between them */
  const mSides: Array<{ alongX: boolean; line: number; out: number; a: number; b: number }> = [];
  for (const line of [mLo, mHi]) {
    mSides.push({ alongX: true, line, out: Math.sign(line), a: mLo - mHalf, b: mHi + mHalf });
    mSides.push({ alongX: false, line, out: Math.sign(line), a: mLo + mHalf, b: mHi - mHalf });
  }
  const mRun = Math.ceil(-Mt.floor / C.concourse.stairRise);
  const mLen = mRun * C.concourse.stairRun;
  /** a stair down in each side's outer lane, its top at the end away from the side's middle */
  const mStairs = mSides.flatMap((sd) =>
    Mt.stairs.map((off) => {
      const mid = (sd.a + sd.b) / 2 + off;
      const across = sd.line + sd.out * Mt.lane;
      const top = mid + Math.sign(off) * (mLen / 2);
      const foot = mid - Math.sign(off) * (mLen / 2);
      const [a0, a1] = [Math.min(top, foot), Math.max(top, foot)];
      const [c0, c1] = [across - Mt.stairWidth / 2, across + Mt.stairWidth / 2];
      return { sd, top, foot, across, box: sd.alongX ? { x0: a0, x1: a1, z0: c0, z1: c1 } : { x0: c0, x1: c1, z0: a0, z1: a1 } };
    }),
  );
  // cleared here, where it is filled: the sites' reset further down once emptied it after, so every rule that keeps
  // the kit off a stairwell checked nothing (Phase 22.2 found it)
  KIT_SITES.openings.length = 0;
  KIT_SITES.openings.push(...mStairs.map((s) => s.box));
  /** a footprint (local) over a stairwell's opening, a margin round it */
  const overStairwell = (x0: number, x1: number, z0: number, z1: number): boolean => mStairs.some(({ box: o }) => x1 > o.x0 - 0.5 && x0 < o.x1 + 0.5 && z1 > o.z0 - 0.5 && z0 < o.z1 + 0.5);

  // ---------------------------------------------------------------- ground
  // the streets, one plane under everything (the floor at 0 is the world's own), with the metro's stairwells cut out
  const GS = BR_HALF * 2 + 40;
  const groundShape = new THREE.Shape([new THREE.Vector2(-GS / 2, -GS / 2), new THREE.Vector2(GS / 2, -GS / 2), new THREE.Vector2(GS / 2, GS / 2), new THREE.Vector2(-GS / 2, GS / 2)]);
  // the shape's y is the world's -z once the plane is laid flat
  for (const { box: o } of mStairs) groundShape.holes.push(new THREE.Path([new THREE.Vector2(o.x0, -o.z0), new THREE.Vector2(o.x0, -o.z1), new THREE.Vector2(o.x1, -o.z1), new THREE.Vector2(o.x1, -o.z0)]));
  // and over each district made of a pack's own demo scene (citydistricts.json hole), whose canyons fall away below the street
  for (const d of DISTRICTS.districts) if (d.bottomless) groundShape.holes.push(new THREE.Path(d.hole.map(([x, z]) => new THREE.Vector2(x, -z))));
  const groundGeo = new THREE.ShapeGeometry(groundShape);
  // the street's texture a tile every 8 m, laid from the plane's corner as the one plane's was
  (groundGeo.attributes.uv as THREE.BufferAttribute).array.forEach((v, i, a) => ((a as Float32Array)[i] = (v + GS / 2) / 8));
  const ground = new THREE.Mesh(groundGeo, street);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  // ---------------------------------------------------------------- blocks
  /** a tower, and the street its way up comes off: the side its route's door is on, and that street's line (local) */
  type Tower = { x: number; z: number; w: number; d: number; roof: number; storeys: number; sector: string; route: RoutePoint[]; street: { side: Side; line: number } | null; base?: number; lobby?: number; lobbyMat?: THREE.Material; bridges?: Partial<Record<Side4, number>>; decks?: Set<string>; park?: number; parkBridges?: Partial<Record<Side4, number>>; parkDecks?: Set<string>; floors?: number[]; coreBlock?: Array<{ face: Side4; a: number; b: number }> };
  type Side4 = "n" | "s" | "w" | "e";
  const towers: Tower[] = [];
  /**
   * The open storeys' wall pieces as skyLobby builds them (a face's wall either side of its window, and the lintel):
   * the fire escapes, placed last, cut their doorways into these
   */
  const roomWalls: Array<{ x: number; z: number; y: number; face: Side4; a: number; b: number; h: number; at: number; mat: THREE.Material; mesh: THREE.Mesh; solid: Solid }> = [];
  const plazas: Array<{ x: number; z: number }> = [];
  const PAVE_H = C.kerb;
  const storeyH = C.storey;
  /** the jump pads on the podiums and the terraces (city.json downtown padUp), and the road's */
  const pads: BrMap["pads"] = [];
  /** the core's podiums by block ("i,j"), their tops: the concourse's bridges join them */
  const podia = new Map<string, { x0: number; x1: number; z0: number; z1: number; top: number }>();
  /**
   * The centre's podium halls, built once everything else in the street stands (podiumBody): a door keeps clear of what
   * stands before it, and the bridges' pillars on the kerbs and the metro's stairwell rails come after the blocks
   */
  const hallBodies: Array<() => void> = [];
  CONCOURSE.stairs.length = 0;
  STAIR_CORES.length = 0;
  KIT_SITES.towers.length = KIT_SITES.podia.length = KIT_SITES.stairs.length = KIT_SITES.skyline.length = KIT_SITES.lamps.length = KIT_SITES.stalls.length = KIT_SITES.rooms.length = KIT_SITES.cars.length = KIT_SITES.doors.length = KIT_SITES.machinery.length = KIT_SITES.escapes.length = KIT_SITES.halls.length = KIT_SITES.kiosks.length = HALLS.length = HALL_FLOORS.length = DISTRICT_FLOORS.length = 0;
  FIRE_ESCAPES.length = 0;
  STEAM_SOURCES.length = FLICKER_SIGNS.length = 0;
  STAND_INS.skins = [];
  STAND_INS.kiosks = [];
  /** the public stairs' footprints (local): a bridge landing across one blocked it (the concourse check found it) */
  const stairZones: Array<{ x0: number; x1: number; z0: number; z1: number }> = [];
  CONCOURSE.bridges.length = 0;
  CONCOURSE.spire.length = 0;
  /** where each jump pad lands you (local), by its index in pads: the graph's one-way steps up */
  const padLands: Array<{ pad: number; x: number; z: number; y: number }> = [];
  /** the Spire's block, whose podium the concourse's graph marks */
  let spireKey = "";
  /** the Spire's tier whose roof is the Sky Park's terrace (city.json skyPark), its parapet built once its bridges are */
  const spireDeck: { terrace: { x: number; z: number; w: number; d: number; y: number; k: THREE.Material } | null } = { terrace: null };
  /** the window helpers the joins make, for the window pads and the rooms built after them */
  const windowFree: { at: (t: Tower, key: Side4, offset: number) => boolean; offset: (t: Tower, key: Side4, want: number, room: number) => number } = { at: () => true, offset: (_t, _k, w) => w };
  /** the stair core mass() is building, carried from its cut to its flights (city.json stairCore) */
  let coreBuild: { e0: number; e1: number; ac: number; wid: number; topY: number; face: number; box: (ua: number, ub: number, va: number, vb: number, y0: number, y1: number) => Cut; alongX: boolean; end: number } | null = null;
  /** map-local to world (the graph's P, which is made further down) */
  const W = (x: number, z: number) => ({ x: x + BR_X, z: z + BR_Z });
  /**
   * A jump pad onto a roof, solved: the face it throws you over is at (fx, fz)
   * with (nx, nz) pointing out of it toward the pad, its floor `floor` and the
   * roof `roof`. It throws you straight up to peakOver above the roof, and
   * once you are clear above the edge carries you across to land landInside
   * past it. Timed as one throw, a fraction of a second off met the wall
   * metres below the top (the pads' e2e caught it three ways); split, the push
   * waits for the height. A fixed nudge either met the wall below its top or never
   * got over the edge, and aiming the body's middle at the face met it 0.4 m
   * short of the top (the pads' e2e caught both).
   */
  const PAD_SOLVE = C.padSolve;
  const padOnto = (fx: number, fz: number, nx: number, nz: number, floor: number, roof: number, landInside = PAD_SOLVE.landInside): void => {
    const g = MOVE.gravity;
    const H = roof - floor;
    const v = Math.sqrt(2 * g * (H + PAD_SOLVE.peakOver));
    // the pad a body and a little off the face; straight up, then over the edge once above it
    const d0 = MOVE.radius + PAD_SOLVE.standOff;
    const overY = roof + PAD_SOLVE.clear;
    // from there, up to the peak and down to the roof: the time the push has to carry you d0 + landInside
    const vOver = Math.sqrt(Math.max(0, v * v - 2 * g * (H + PAD_SOLVE.clear)));
    const t = vOver / g + Math.sqrt((2 * PAD_SOLVE.peakOver) / g);
    const vx = (d0 + landInside) / t;
    pads.push({ ...W(fx + nx * d0, fz + nz * d0), dx: -nx * vx, dz: -nz * vx, y: floor, up: v, over: overY });
    padLands.push({ pad: pads.length - 1, x: fx - nx * landInside, z: fz - nz * landInside, y: roof });
  };
  /** the streets inside the map (STREETS keeps the grid's six each way, which the configs name by index) */
  const LANES = STREETS.filter((s) => Math.abs(s) < BR_HALF - 7);
  /** the block of the grid at (bi, bj): its pavement, and what stands on it by its ring round the centre */
  const mid = (BLOCKS.length - 1) / 2;
  function buildBlock(x0: number, x1: number, z0: number, z1: number, bi: number, bj: number): void {
    {
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      // (a block the cut takes away lies past the map's edge: its sector is the one it faces, as it was before the cut)
      const sec = sectorAt(Math.max(-BR_HALF, Math.min(BR_HALF, cx)), Math.max(-BR_HALF, Math.min(BR_HALF, cz)))!;
      // the pavement: the block's floor, a kerb above the street
      slab(x1 - x0, PAVE_H, z1 - z0, cx, 0, cz, pave);
      // neon along the kerb, the district's colour
      const k = neon(sec.accent);
      deco(x1 - x0, 0.06, 0.12, cx, PAVE_H, z0 + 0.06, k);
      deco(x1 - x0, 0.06, 0.12, cx, PAVE_H, z1 - 0.06, k);
      deco(0.12, 0.06, z1 - z0, x0 + 0.06, PAVE_H, cz, k);
      deco(0.12, 0.06, z1 - z0, x1 - 0.06, PAVE_H, cz, k);
      const ring = Math.max(Math.abs(bi - mid), Math.abs(bj - mid));
      const centre = bi === mid && bj === mid;
      // the heart: THE SPIRE, in tiers (city.json spire)
      if (centre) {
        spireBlock(x0, x1, z0, z1, sec, `${bi},${bj}`);
        return;
      }
      // a district's landmark on its block (city.json landmarks)
      const lm = Object.values(C.landmarks).find((l) => l.block[0] === bi && l.block[1] === bj);
      if (lm) {
        landmark(lm.kind, x0, x1, z0, z1, sec);
        return;
      }
      // the downtown, from the centre out (city.json downtown), and the mid-rise blocks round it (perimeter)
      if (ring <= C.downtown.rings) {
        downtownBlock(x0, x1, z0, z1, sec, ring, `${bi},${bj}`);
        return;
      }
      if (ring === C.perimeter.ring) {
        perimeterBlock(x0, x1, z0, z1, sec);
        return;
      }
      // now and then a plaza instead of buildings: open ground to fight over, with cover
      if (rnd() < C.plazaChance && !centre) {
        plazas.push({ x: cx, z: cz });
        for (let i = 0; i < 6; i++) {
          const px = cx + (rnd() - 0.5) * (x1 - x0 - 10);
          const pz = cz + (rnd() - 0.5) * (z1 - z0 - 10);
          slab(2.4 + rnd() * 2, 1.2, 0.8 + rnd() * 0.6, px, PAVE_H, pz, metal);
        }
        return;
      }
      // the buildings: taller toward the core
      const [lo, hi] = ring <= 1 ? C.heights.core : ring === 2 ? C.heights.middle : C.heights.edge;
      const old = sec.id === "w";
      const lots = ring <= 1 ? 1 + (rnd() < 0.5 ? 1 : 0) : 2;
      const span = { w: x1 - x0 - 6, d: z1 - z0 - 6 };
      // which way the block splits, once for the block: drawn for each tower, one could take the full width
      // and the other the full depth, and the two stood inside each other (found walking the bots' roof routes)
      const alongX = rnd() < 0.5;
      for (let i = 0; i < lots; i++) {
        const half = lots === 2;
        const w = half && alongX ? span.w / 2 - 2 : span.w;
        const d = half && !alongX ? span.d / 2 - 2 : span.d;
        const ox = half && alongX ? (i === 0 ? -1 : 1) * (span.w / 4 + 1) : 0;
        const oz = half && !alongX ? (i === 0 ? -1 : 1) * (span.d / 4 + 1) : 0;
        const bw = Math.max(12, Math.min(w, 22 + rnd() * 10));
        const bd = Math.max(12, Math.min(d, 22 + rnd() * 10));
        const storeys = Math.round(lo + rnd() * (hi - lo));
        const mat = old ? brick : ring <= 1 && rnd() < 0.35 ? glass : night[Math.floor(rnd() * night.length)];
        const doors: Side[] = (["n", "s", "e", "w"] as Side[]).filter(() => rnd() < 0.55);
        // a low tower (the bots' roofs, city.json botRoofs) always has a door onto its block's edge: the
        // north one, or the south for the second tower of a block split north and south
        const edgeDoor: Side = half && !alongX && i === 1 ? "s" : "n";
        if (storeys <= C.botRoofs.maxStoreys && !doors.includes(edgeDoor)) doors.push(edgeDoor);
        towers.push(tower({ x: cx + ox, z: cz + oz, w: bw, d: bd, storeys, sector: sec, mat, accent: sec.accent, doors: doors.length ? doors : ["s"], block: { x0, x1, z0, z1 } }));
      }
    }
  }
  /**
   * Build, spending the stream's draws, and take away again (city.json cut): everything a block adds to the scene and to
   * the city's lists, so the blocks built after it draw exactly the numbers they drew before the cut
   */
  const sandbox = (build: () => void): void => {
    const n = { kids: root.children.length, solids: RANGE_SOLIDS.length, towers: towers.length, plazas: plazas.length, pads: pads.length, lands: padLands.length, doorways: DOORWAYS.length, dressing: DRESSING.length, floors: FLOORS.length };
    build();
    root.remove(...root.children.slice(n.kids));
    RANGE_SOLIDS.length = n.solids;
    towers.length = n.towers;
    plazas.length = n.plazas;
    pads.length = n.pads;
    padLands.length = n.lands;
    DOORWAYS.length = n.doorways;
    DRESSING.length = n.dressing;
    FLOORS.length = n.floors;
  };
  const Ct = C.cut;
  BLOCKS.forEach(([x0, x1], bi) =>
    BLOCKS.forEach(([z0, z1], bj) => {
      const ring = Math.max(Math.abs(bi - mid), Math.abs(bj - mid));
      if (ring >= Ct.keep) sandbox(() => buildBlock(x0, x1, z0, z1, bi, bj));
      else buildBlock(x0, x1, z0, z1, bi, bj);
    }),
  );
  // the districts' ring built again, its outer side cut to cut.depth, from a stream of its own; the city's stream put
  // back after, so everything built after the blocks draws what it drew before
  {
    const main = rnd;
    rnd = seeded(C.seed ^ 0xc07);
    const cutSpan = (a0: number, a1: number, i: number): [number, number] => (i === mid - Ct.keep ? [a1 - Ct.depth, a1] : i === mid + Ct.keep ? [a0, a0 + Ct.depth] : [a0, a1]);
    BLOCKS.forEach(([x0, x1], bi) =>
      BLOCKS.forEach(([z0, z1], bj) => {
        if (Math.max(Math.abs(bi - mid), Math.abs(bj - mid)) !== Ct.keep) return;
        const [cx0, cx1] = cutSpan(x0, x1, bi);
        const [cz0, cz1] = cutSpan(z0, z1, bj);
        // a block a district of the packs' own demo scene stands on (citydistricts.json, Phase 25): built, so the stream
        // draws what it drew, and taken away again
        if (DISTRICTS.districts.some((d) => d.blocks.some(([i, j]) => i === bi && j === bj))) sandbox(() => buildBlock(cx0, cx1, cz0, cz1, bi, bj));
        else buildBlock(cx0, cx1, cz0, cz1, bi, bj);
      }),
    );
    rnd = main;
  }
  // the districts made of the packs' own demo scenes (citydistricts.json): their collision, measured off their triangles
  for (const d of DISTRICTS.districts) for (const [x0, x1, z0, z1, y0, y1] of DISTRICT_SOLIDS[d.id] ?? []) solid(x0, x1, z0, z1, y0, y1);
  // and where each one's floors are, in the world's metres, for its loot (floors.ts DISTRICT_FLOORS)
  for (const d of DISTRICTS.districts) {
    const xs = d.hole.map(([x]) => x);
    const zs = d.hole.map(([, z]) => z);
    const [x0, x1] = [Math.max(-d.fill.half, Math.min(...xs)), Math.min(d.fill.half, Math.max(...xs))];
    const [z0, z1] = [Math.max(-d.fill.half, Math.min(...zs)), Math.min(d.fill.half, Math.max(...zs))];
    DISTRICT_FLOORS.push({ plan: d.hole.map(([x, z]) => [x + BR_X, z + BR_Z] as [number, number]), minX: x0 + BR_X, maxX: x1 + BR_X, minZ: z0 + BR_Z, maxZ: z1 + BR_Z, walkway: [d.fill.walkway[0], d.fill.walkway[1]] });
  }
  // Their backs (districtSolids backs, Phase 26.4): the open ground that meets ground you stand on, closed as blocks the
  // height of the buildings round it, drawn as the city's own buildings are, brick walls under a concrete roof, since
  // where the kit is off (Competitive) nothing else covers them; their collision is the district's
  for (const d of DISTRICTS.districts)
    for (const [x0, x1, z0, z1, top] of DISTRICT_INSIDES[d.id]?.backs ?? []) {
      deco(x1 - x0, top - 0.12, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, brick);
      deco(x1 - x0, 0.12, z1 - z0, (x0 + x1) / 2, top - 0.12, (z0 + z1) / 2, concrete);
    }
  // and their backs' faces toward where you stand (districtSolids fronts, Phase 26.4), for the kit to dress in the
  // district's pack's own facade strips as it dresses a tower's: each a tower of its own, the front's width and a storey
  // deep behind it, dressed on that face alone, whole storeys down from the back's top to where you stand; one shorter than
  // fill backs.dress keeps the back's own face
  for (const d of DISTRICTS.districts) {
    for (const [x0, z0, x1, z1, nx, nz, stand, top] of DISTRICT_INSIDES[d.id]?.fronts ?? []) {
      const storeys = Math.round((top - stand) / storeyH);
      if (Math.hypot(x1 - x0, z1 - z0) < d.fill.backs.dress || storeys < 1) continue;
      const face: Side4 = nx < 0 ? "w" : nx > 0 ? "e" : nz < 0 ? "n" : "s";
      const [bx0, bx1] = nx === 0 ? [x0, x1] : nx < 0 ? [x0, x0 + storeyH] : [x0 - storeyH, x0];
      const [bz0, bz1] = nz === 0 ? [z0, z1] : nz < 0 ? [z0, z0 + storeyH] : [z0 - storeyH, z0];
      KIT_SITES.towers.push({ x: (bx0 + bx1) / 2, z: (bz0 + bz1) / 2, w: bx1 - bx0, d: bz1 - bz0, base: top - storeys * storeyH, roof: top, storeys, sector: d.id, clutter: [], family: d.pack, faces: [face] });
    }
  }
  /** a point (local) on a district's plan, where the city's own street things (its cars, its lines) have no place */
  const inDistrict = (x: number, z: number): boolean =>
    DISTRICTS.districts.some(({ hole }) => {
      let n = false;
      for (let i = 0, j = hole.length - 1; i < hole.length; j = i++) {
        const [xi, zi] = hole[i];
        const [xj, zj] = hole[j];
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) n = !n;
      }
      return n;
    });
  /** within 8 m of a district's plan: its faces reach past the plan onto the city's streets there */
  const nearDistrict = (x: number, z: number): boolean => [[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]].some(([dx, dz]) => inDistrict(x + dx, z + dz));
  // and their pads up from the canyons' floor to the walkways: each walks from its spot back to the walkway's front
  // and takes the walkway's height off the collision there, so a re-bake that moves either moves the pad with it
  for (const d of DISTRICTS.districts) {
    const boxes = DISTRICT_SOLIDS[d.id] ?? [];
    const [w0, w1] = d.fill.walkway;
    for (const [px, pz, nx, nz] of d.pads) {
      for (let t = 0; t < d.padReach; t += 0.05) {
        const x = px - nx * t;
        const z = pz - nz * t;
        const face = boxes.find(([x0, x1, z0, z1, y0, y1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1 && y0 < 1 && y1 >= w0 && y1 <= w1);
        if (!face) continue;
        padOnto(x, z, nx, nz, 0, face[5], d.padLand);
        break;
      }
    }
  }

  /**
   * A mass: a solid building of one box, a storey at a time tall, standing on
   * `base`, its roof a floor with a parapet, neon on its edges and clutter to
   * take cover behind. No inside: the downtown's are climbed, not entered.
   */
  /**
   * A roof's parapet, knee high: cover on a roof, and nothing a climb catches on; and its neon. `gaps` open it where a
   * bridge lands: a face, the middle of the opening along it, its width.
   */
  function roofEdge(x: number, z: number, w: number, d: number, roof: number, k: THREE.Material, gaps: Array<{ side: Side4; at: number; width: number }> = []): void {
    /** a run from a to b along a face, less its openings */
    const runs = (side: Side4, a: number, b: number): Array<[number, number]> => {
      const out: Array<[number, number]> = [];
      let from = a;
      for (const g of gaps.filter((q) => q.side === side).sort((p, q) => p.at - q.at)) {
        if (g.at - g.width / 2 > from) out.push([from, g.at - g.width / 2]);
        from = Math.max(from, g.at + g.width / 2);
      }
      if (b > from) out.push([from, b]);
      return out;
    };
    for (const [a, b] of runs("n", x - w / 2, x + w / 2)) slab(b - a, 0.7, 0.25, (a + b) / 2, roof, z - d / 2 + 0.125, trimDark);
    for (const [a, b] of runs("s", x - w / 2, x + w / 2)) slab(b - a, 0.7, 0.25, (a + b) / 2, roof, z + d / 2 - 0.125, trimDark);
    for (const [a, b] of runs("w", z - d / 2 + 0.25, z + d / 2 - 0.25)) slab(0.25, 0.7, b - a, x - w / 2 + 0.125, roof, (a + b) / 2, trimDark);
    for (const [a, b] of runs("e", z - d / 2 + 0.25, z + d / 2 - 0.25)) slab(0.25, 0.7, b - a, x + w / 2 - 0.125, roof, (a + b) / 2, trimDark);
    for (const [a, b] of runs("n", x - w / 2, x + w / 2)) deco(b - a + 0.1, 0.1, 0.1, (a + b) / 2, roof + 0.7, z - d / 2, k);
    for (const [a, b] of runs("s", x - w / 2, x + w / 2)) deco(b - a + 0.1, 0.1, 0.1, (a + b) / 2, roof + 0.7, z + d / 2, k);
    for (const [a, b] of runs("w", z - d / 2, z + d / 2)) deco(0.1, 0.1, b - a + 0.1, x - w / 2, roof + 0.7, (a + b) / 2, k);
    for (const [a, b] of runs("e", z - d / 2, z + d / 2)) deco(0.1, 0.1, b - a + 0.1, x + w / 2, roof + 0.7, (a + b) / 2, k);
  }

  /**
   * `r`: the random stream its roof's clutter draws from (the city's own unless a caller keeps that stream as it was);
   * `edge` false leaves its parapet to the caller, for a roof a bridge lands on
   */
  /**
   * A box of a building with boxes cut out of it (map-local, each x0..x1, z0..z1, y0..y1): in bands up its height at
   * the cuts' tops and bottoms, each band's footprint less the cuts through it
   */
  type Cut = { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number };
  /** `skin`: the tower's outside, whose faces go in a skin (skinSlab), for the centre's towers the kit dresses */
  function cutSlab(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, cuts: Cut[], skin: { x0: number; x1: number; z0: number; z1: number } | null = null): void {
    const put = (pw: number, ph: number, pd: number, px: number, py: number, pz: number): void => {
      if (skin) skinSlab(pw, ph, pd, px, py, pz, mat, skin);
      else slab(pw, ph, pd, px, py, pz, mat);
    };
    const mine = cuts.filter((c) => c.x1 > x - w / 2 && c.x0 < x + w / 2 && c.z1 > z - d / 2 && c.z0 < z + d / 2 && c.y1 > y && c.y0 < y + h);
    if (!mine.length) {
      put(w, h, d, x, y, z);
      return;
    }
    const ys = [...new Set([y, y + h, ...mine.flatMap((c) => [c.y0, c.y1]).filter((v) => v > y && v < y + h)])].sort((a, b) => a - b);
    for (let i = 0; i + 1 < ys.length; i++) {
      const [b0, b1] = [ys[i], ys[i + 1]];
      let parts = [{ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 }];
      for (const c of mine.filter((q) => q.y0 < b1 - 1e-6 && q.y1 > b0 + 1e-6)) {
        parts = parts.flatMap((q) => {
          if (c.x1 <= q.x0 || c.x0 >= q.x1 || c.z1 <= q.z0 || c.z0 >= q.z1) return [q];
          const out: typeof parts = [];
          if (c.x0 > q.x0) out.push({ x0: q.x0, x1: c.x0, z0: q.z0, z1: q.z1 });
          if (c.x1 < q.x1) out.push({ x0: c.x1, x1: q.x1, z0: q.z0, z1: q.z1 });
          const mx0 = Math.max(q.x0, c.x0);
          const mx1 = Math.min(q.x1, c.x1);
          if (c.z0 > q.z0) out.push({ x0: mx0, x1: mx1, z0: q.z0, z1: c.z0 });
          if (c.z1 < q.z1) out.push({ x0: mx0, x1: mx1, z0: c.z1, z1: q.z1 });
          return out;
        });
      }
      for (const q of parts) if (q.x1 - q.x0 > 0.01 && q.z1 - q.z0 > 0.01) put(q.x1 - q.x0, b1 - b0, q.z1 - q.z0, (q.x0 + q.x1) / 2, b0, (q.z0 + q.z1) / 2);
    }
  }

  /** `cuts`: boxes taken out of it (the Spire's drop), which its roof's clutter also keeps off */
  /** `core`: a stair core up it (city.json stairCore), along x or z, its door in the end face at `end` (-1 the low, 1 the high) */
  function mass(x: number, z: number, w: number, d: number, base: number, storeys: number, mat: THREE.Material, accent: number, sector: string, lobby = false, r: () => number = rnd, edge = true, cuts: Cut[] = [], core: { alongX: boolean; end: number } | null = null): Tower {
    const h = storeys * storeyH;
    // the Sky Lobby's floor, when this tower is open for it (city.json skyLobby): below it, over it, and two storeys
    // at least above it; and the Sky Park's (skyPark) the same way, in a tower open for the lobby
    const Lb = C.skyLobby;
    const ly = PAVE_H + Lb.storey * storeyH;
    const py = PAVE_H + C.skyPark.storey * storeyH;
    const opens = (y: number): boolean => lobby && base < y - 0.5 && base + h >= y + 2 * storeyH;
    const open = opens(ly);
    const park = open && opens(py);
    // the open floors (skyLobby floors), in a tower open for the lobby
    const floors = open ? [...Lb.floors, ...(park ? C.skyPark.floors : [])].map((s) => PAVE_H + s * storeyH).filter(opens) : [];
    // the stair core: its box cut up the tower from the concourse to its highest deck, and its door out to the promenade
    if (core && open) {
      const Sc = C.stairCore;
      const topY = park ? py : ly;
      const steps = Math.round(storeyH / Sc.rise);
      const len = steps * Sc.run + 2 * Sc.landing;
      const wid = 2 * Sc.lane;
      const al = core.alongX ? x : z;
      // by the tower's low side (north for a core along x, west along z), so the middle of every face, where windows and
      // bridges land, stays clear of it; set in from that side by the depth of the deepest facade module (3.2 m), whose
      // back, hidden in the wall, would otherwise show inside the door
      const ac = (core.alongX ? z - d / 2 : x - w / 2) + Lb.wall + 2.2 + wid / 2;
      const face = al + core.end * ((core.alongX ? w : d) / 2);
      const e0 = face - core.end * Lb.wall;
      const e1 = e0 - core.end * len;
      const box = (ua: number, ub: number, va: number, vb: number, y0: number, y1: number): Cut =>
        core.alongX ? { x0: Math.min(ua, ub), x1: Math.max(ua, ub), z0: va, z1: vb, y0, y1 } : { x0: va, x1: vb, z0: Math.min(ua, ub), z1: Math.max(ua, ub), y0, y1 };
      const door = box(e0 - core.end * 0.05, face + core.end * 0.1, ac - Sc.door / 2, ac + Sc.door / 2, base, base + Sc.doorHeight);
      cuts = [...cuts, box(e0, e1, ac - wid / 2, ac + wid / 2, base, topY), door];
      KIT_SITES.doors.push(core.alongX ? { x0: face - 0.5, x1: face + 0.5, z0: door.z0, z1: door.z1, y0: door.y0, y1: door.y1 } : { x0: door.x0, x1: door.x1, z0: face - 0.5, z1: face + 0.5, y0: door.y0, y1: door.y1 });
      coreBuild = { e0, e1, ac, wid, topY, face, box, alongX: core.alongX, end: core.end };
    }
    // the mass up to each open storey and on from the storey over it; each open storey is built once its windows are
    // known, since a window goes where its pad can stand or its bridge lands (the window pads and the Sky Park, below).
    // With none open, the walls to a concrete cap: a facade's lit windows are for its sides, not the floor you stand on.
    // An open storey straight over another stands on a floor of its own
    let from = base;
    // the centre's towers, which the kit dresses, have their outward faces skinned (skinSlab)
    const skin = Math.abs(x) <= kitCfg.dress.centre && Math.abs(z) <= kitCfg.dress.centre ? { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 } : null;
    for (const y of [open ? ly : NaN, park ? py : NaN, ...floors].filter((v) => !Number.isNaN(v)).sort((a, b) => a - b)) {
      if (y - from > 0.01) cutSlab(w, y - from, d, x, from, z, mat, cuts, skin);
      else if (from > base) cutSlab(w, 0.3, d, x, y - 0.3, z, concrete, cuts);
      from = y + storeyH;
    }
    cutSlab(w, base + h - 0.12 - from, d, x, from, z, mat, cuts, skin);
    cutSlab(w, 0.12, d, x, base + h - 0.12, z, concrete, cuts);
    const roof = base + h;
    const k = neon(accent);
    if (edge) roofEdge(x, z, w, d, roof, k);
    // neon up the corners
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) deco(C.cornerNeon, h, C.cornerNeon, x + (sx * w) / 2, base, z + (sz * d) / 2, k);
    // a band of light every few storeys
    for (let s = C.bandEvery; s < storeys; s += C.bandEvery) {
      deco(w + 0.12, 0.16, 0.12, x, base + s * storeyH, z - d / 2, k);
      deco(w + 0.12, 0.16, 0.12, x, base + s * storeyH, z + d / 2, k);
    }
    // the roof's clutter: plant rooms and vents to fight round
    const [cMin, cMax] = C.downtown.clutter;
    const n = cMin + Math.floor(r() * (cMax - cMin + 1));
    const clutter: Array<{ x: number; z: number; y: number; w: number; h: number; d: number }> = [];
    for (let i = 0; i < n; i++) {
      const cw = 1.6 + r() * 2.4;
      const cd = 1.2 + r() * 1.8;
      const ch = 1.2 + r() * 1.4;
      const ox = (r() - 0.5) * Math.max(0, w - cw - 2);
      const oz = (r() - 0.5) * Math.max(0, d - cd - 2);
      // (drawn all the same: a box that would stand over a cut, the drop's mouth, is left out)
      if (cuts.some((c) => c.y1 >= roof - 0.2 && x + ox + cw / 2 > c.x0 - 0.5 && x + ox - cw / 2 < c.x1 + 0.5 && z + oz + cd / 2 > c.z0 - 0.5 && z + oz - cd / 2 < c.z1 + 0.5)) continue;
      slab(cw, ch, cd, x + ox, roof, z + oz, metal);
      clutter.push({ x: x + ox, z: z + oz, y: roof, w: cw, h: ch, d: cd });
    }
    const t: Tower = { x, z, w, d, roof, storeys, sector, route: [], street: null, base, lobby: open ? ly : undefined, lobbyMat: open ? mat : undefined, park: park ? py : undefined, floors };
    // where the core stands behind its faces, along each (x for north and south, z for west and east): no window there
    if (coreBuild) {
      const cb = coreBuild;
      const endFace: Side4 = cb.alongX ? (cb.end > 0 ? "e" : "w") : cb.end > 0 ? "s" : "n";
      const sideFace: Side4 = cb.alongX ? "n" : "w";
      t.coreBlock = [
        { face: endFace, a: cb.ac - cb.wid / 2 - 0.3, b: cb.ac + cb.wid / 2 + 0.3 },
        { face: sideFace, a: Math.min(cb.e0, cb.e1) - 0.3, b: Math.max(cb.e0, cb.e1) + 0.3 },
      ];
    }
    towers.push(t);
    const coreBox = coreBuild ? coreBuild.box(coreBuild.e0, coreBuild.e1, coreBuild.ac - coreBuild.wid / 2, coreBuild.ac + coreBuild.wid / 2, base, coreBuild.topY) : null;
    KIT_SITES.towers.push({ x, z, w, d, base, roof, storeys, lobby: open ? ly : undefined, park: park ? py : undefined, floors, sector, clutter, ...(coreBox ? { core: { x0: coreBox.x0, x1: coreBox.x1, z0: coreBox.z0, z1: coreBox.z1 } } : {}) });
    // the stair core's flights and landings, in the box cut for them
    if (coreBuild) {
      const cb = coreBuild;
      coreBuild = null;
      const Sc = C.stairCore;
      const steps = Math.round(storeyH / Sc.rise);
      const n = Math.round((cb.topY - base) / storeyH);
      const dir = -cb.end;
      const laneAt = (k: number) => cb.ac + (k % 2 === 0 ? -1 : 1) * (Sc.lane / 2);
      const at = (u: number, v: number, y: number) => (cb.alongX ? { x: u + BR_X, z: v + BR_Z, y } : { x: v + BR_X, z: u + BR_Z, y });
      // in through the middle of the door first (a line from outside straight to the first lane clips its jamb), then
      // onto the landing at the foot of the first flight
      const way: Array<{ x: number; z: number; y: number }> = [at(cb.e0 + dir * 0.4, cb.ac, base), at(cb.e0 + dir * (Sc.landing / 2), laneAt(0), base)];
      for (let k = 0; k < n; k++) {
        const yk = base + k * storeyH;
        const up = k % 2 === 0 ? dir : -dir;
        const from = k % 2 === 0 ? cb.e0 : cb.e1;
        const to = k % 2 === 0 ? cb.e1 : cb.e0;
        const v = laneAt(k);
        const start = from + up * Sc.landing;
        for (let i = 0; i < steps; i++) {
          const u = start + up * (i + 0.5) * Sc.run;
          const b = cb.box(u - Sc.run / 2, u + Sc.run / 2, v - Sc.lane / 2, v + Sc.lane / 2, yk, yk + (i + 1) * Sc.rise);
          slab(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0, (b.x0 + b.x1) / 2, b.y0, (b.z0 + b.z1) / 2, concrete);
        }
        // the landing it tops out on, across both lanes; at the top deck the other lane is floored over too, so only the
        // flight down is open
        const ly2 = yk + storeyH;
        const land = cb.box(to, to - up * Sc.landing, cb.ac - cb.wid / 2, cb.ac + cb.wid / 2, ly2 - 0.3, ly2);
        slab(land.x1 - land.x0, 0.3, land.z1 - land.z0, (land.x0 + land.x1) / 2, ly2 - 0.3, (land.z0 + land.z1) / 2, metal);
        if (k === n - 1) {
          const other = laneAt(k + 1);
          const fl = cb.box(cb.e0, cb.e1, other - Sc.lane / 2, other + Sc.lane / 2, ly2 - 0.3, ly2);
          slab(fl.x1 - fl.x0, 0.3, fl.z1 - fl.z0, (fl.x0 + fl.x1) / 2, ly2 - 0.3, (fl.z0 + fl.z1) / 2, metal);
          const lbx = cb.box(from, from + up * Sc.landing, cb.ac - cb.wid / 2, cb.ac + cb.wid / 2, ly2 - 0.3, ly2);
          slab(lbx.x1 - lbx.x0, 0.3, lbx.z1 - lbx.z0, (lbx.x0 + lbx.x1) / 2, ly2 - 0.3, (lbx.z0 + lbx.z1) / 2, metal);
          // a rail round the flight down on three sides, open where it tops out level with the floor: across the deck a
          // run went straight into it (sk-lobbies found a bridge's run doing so)
          const out = Math.sign(v - cb.ac);
          const end = start + up * steps * Sc.run;
          for (const [ua, ub, va, vb] of [
            [start, end, v + out * (Sc.lane / 2) - 0.05, v + out * (Sc.lane / 2) + 0.05],
            [start, end, cb.ac - 0.05, cb.ac + 0.05],
            [start - 0.05, start + 0.05, v - Sc.lane / 2, v + Sc.lane / 2],
          ]) {
            const rl = cb.box(ua, ub, Math.min(va, vb), Math.max(va, vb), ly2, ly2 + 1);
            slab(rl.x1 - rl.x0, 1, rl.z1 - rl.z0, (rl.x0 + rl.x1) / 2, ly2, (rl.z0 + rl.z1) / 2, trimDark);
          }
        }
        way.push(at(start, v, yk), at(to - up * (Sc.landing / 2), v, ly2));
        // across the landing to the next lane
        if (k < n - 1) way.push(at(to - up * (Sc.landing / 2), laneAt(k + 1), ly2));
      }
      const outside = at(cb.face + cb.end * 1.6, cb.ac, base);
      STAIR_CORES.push({ outside, way, top: cb.topY });
    }
    return t;
  }

  /**
   * One storey of a tower open as the Sky Lobby (city.json skyLobby): a floor, and every face a wall with a window in
   * its middle from the floor up, so it is a room you run through, and across a canyon a jump from window to window.
   * The north and south walls run the tower's width, the east and west fit between them.
   */
  /** `at`: each face's window, how far along the face from its middle (north, south, west, east); `lit`, the faces with a pad, whose window is framed in light */
  /** `ring`: its level's line of light round the tower (the lobby's and the Sky Park's; the open floors between go without) */
  function skyLobby(x: number, z: number, w: number, d: number, ly: number, mat: THREE.Material, at: { n: number; s: number; w: number; e: number }, lit: Set<string>, ring = true): void {
    const Lb = C.skyLobby;
    const t = Lb.wall;
    const win = Lb.width;
    const H = Lb.height;
    const lintel = storeyH - H;
    KIT_SITES.rooms.push({ x, z, w, d, y: ly, at: { ...at } });
    // its level's ring of light, at the storey's floor and its ceiling, a hand's width out of the face so the kit's
    // band (flat within 0.15 m) leaves it showing
    const ringColour = Math.abs(ly - (PAVE_H + C.skyPark.storey * storeyH)) < 0.5 ? C.skyPark.ring : Lb.ring;
    const ringMat = neon(parseInt(ringColour.slice(1), 16));
    for (const ry of ring ? [ly - 0.08, ly + storeyH] : []) {
      deco(w + 0.44, 0.08, 0.06, x, ry, z - d / 2 - 0.2, ringMat);
      deco(w + 0.44, 0.08, 0.06, x, ry, z + d / 2 + 0.2, ringMat);
      deco(0.06, 0.08, d + 0.44, x - w / 2 - 0.2, ry, z, ringMat);
      deco(0.06, 0.08, d + 0.44, x + w / 2 + 0.2, ry, z, ringMat);
    }
    // a wall from a to b along its face with the window's middle at c: the piece either side, the lintel over it
    const wall = (a: number, b: number, c: number, put: (from: number, to: number, y: number, h: number) => void) => {
      // (a window against a corner, as a chimney's exit is, leaves nothing on that side)
      if (c - win / 2 - a > 0.01) put(a, c - win / 2, ly, storeyH);
      if (b - c - win / 2 > 0.01) put(c + win / 2, b, ly, storeyH);
      put(c - win / 2, c + win / 2, ly + H, lintel);
    };
    // along x, at each end in z
    for (const [s, o, k] of [
      [-1, at.n, "n"],
      [1, at.s, "s"],
    ] as const) {
      const wz = z + s * (d / 2 - t / 2);
      wall(x - w / 2, x + w / 2, x + o, (a, b, y, h) => {
        const mesh = slab(b - a, h, t, (a + b) / 2, y, wz, mat);
        roomWalls.push({ x, z, y: ly, face: k, a, b, h, at: wz, mat, mesh, solid: RANGE_SOLIDS[RANGE_SOLIDS.length - 1] });
      });
      // a pad's window framed in the pads' blue, so it reads as the pad's target from the podium
      if (lit.has(k)) {
        const fz = z + s * (d / 2 + 0.03);
        for (const c of [x + o - win / 2, x + o + win / 2]) deco(0.08, H, 0.08, c, ly, fz, windowLight);
        deco(win, 0.08, 0.08, x + o, ly + H, fz, windowLight);
      }
    }
    // along z, at each end in x, between those
    for (const [s, o, k] of [
      [-1, at.w, "w"],
      [1, at.e, "e"],
    ] as const) {
      const wx = x + s * (w / 2 - t / 2);
      wall(z - d / 2 + t, z + d / 2 - t, z + o, (a, b, y, h) => {
        const mesh = slab(t, h, b - a, wx, y, (a + b) / 2, mat);
        roomWalls.push({ x, z, y: ly, face: k, a, b, h, at: wx, mat, mesh, solid: RANGE_SOLIDS[RANGE_SOLIDS.length - 1] });
      });
      if (lit.has(k)) {
        const fx = x + s * (w / 2 + 0.03);
        for (const c of [z + o - win / 2, z + o + win / 2]) deco(0.08, H, 0.08, fx, ly, c, windowLight);
        deco(0.08, 0.08, win, fx, ly + H, z + o, windowLight);
      }
    }
    // the floor you land on, and a light in the ceiling so the room reads from a window across the canyon
    deco(w - 2 * t, 0.02, d - 2 * t, x, ly, z, concrete);
    deco(Math.min(6, w - 2 * t - 1), 0.05, 0.4, x, ly + storeyH - 0.06, z, lobbyLight);
  }

  /** the halls' materials (city.json halls lit), made once: the street's and the concrete's textures, lit a little from within */
  let hallMats: { lining: THREE.Material; ceiling: THREE.Material; floor: THREE.Material; column: THREE.Material } | null = null;
  const hallLit = () => {
    if (hallMats) return hallMats;
    const L = C.halls.lit;
    const hex = (s: string) => parseInt(s.slice(1), 16);
    const from = (base: THREE.MeshStandardMaterial, color: string, glow: string): THREE.MeshStandardMaterial => {
      const m = base.clone();
      m.color.set(hex(color));
      m.emissive.set(hex(glow));
      tileOf.set(m, tileOf.get(base) ?? 0);
      return m;
    };
    const plain = (color: string, glow: string) => new THREE.MeshStandardMaterial({ color: hex(color), emissive: hex(glow), roughness: 0.85, metalness: 0.05 });
    hallMats = { lining: plain(L.lining[0], L.lining[1]), ceiling: plain(L.ceiling[0], L.ceiling[1]), floor: from(pave, L.floor[0], L.floor[1]), column: from(concrete, L.column[0], L.column[1]) };
    return hallMats;
  };
  /**
   * A podium's body under its cap. Out of the centre, solid, as it always was. In the centre (city.json halls, Phase 24.4)
   * a hall to fight in at street level, as the metro is below it: a shell of walls under a roof that is walked on as
   * before, doors off the streets, square columns and low counters inside as cover, the walls lined and the ceiling lit
   * in the block's colour. Its layout comes from a stream of its own, so the city's draws stay as they were.
   */
  function podiumBody(px0: number, px1: number, pz0: number, pz1: number, top: number, mat: THREE.Material, hall: boolean, stair: { x0: number; x1: number; z0: number; z1: number } | undefined, key: string, accent: number): void {
    const cx = (px0 + px1) / 2;
    const cz = (pz0 + pz1) / 2;
    const h = top - 0.12 - PAVE_H;
    if (!hall) {
      slab(px1 - px0, h, pz1 - pz0, cx, PAVE_H, cz, mat);
      return;
    }
    const H = C.halls;
    const wl = H.wall;
    const y1 = top - H.roof;
    const dw = H.door.width;
    const dTop = PAVE_H + H.door.height;
    const [ix0, ix1, iz0, iz1] = [px0 + wl, px1 - wl, pz0 + wl, pz1 - wl];
    const local = pads.map((p) => ({ x: p.x - BR_X, z: p.z - BR_Z }));
    type HFace = { face: "n" | "s" | "w" | "e"; nx: number; nz: number; at: number; a: number; b: number };
    const hfaces: HFace[] = [
      { face: "n", nx: 0, nz: -1, at: pz0, a: px0, b: px1 },
      { face: "s", nx: 0, nz: 1, at: pz1, a: px0, b: px1 },
      { face: "w", nx: -1, nz: 0, at: px0, a: pz0, b: pz1 },
      { face: "e", nx: 1, nz: 0, at: px1, a: pz0, b: pz1 },
    ];
    /** a box along a face from u0 to u1, from `near` to `far` metres out of it (negative: into the podium) */
    const onF = (f: HFace, u0: number, u1: number, near: number, far: number) => {
      const [o0, o1] = [f.at + (f.nx || f.nz) * near, f.at + (f.nx || f.nz) * far].sort((p, q) => p - q);
      return f.nx !== 0 ? { x0: o0, x1: o1, z0: u0, z1: u1 } : { x0: u0, x1: u1, z0: o0, z1: o1 };
    };
    const meets = (p: { x0: number; x1: number; z0: number; z1: number }, q: { x0: number; x1: number; z0: number; z1: number }, m = 0) => p.x1 > q.x0 - m && p.x0 < q.x1 + m && p.z1 > q.z0 - m && p.z0 < q.z1 + m;
    // the doors: one per `every` metres of each face, at its even spot or slid a little either way to stay clear of the
    // corners, the pads in front of the face and the public stair
    const doors: Array<{ f: HFace; u: number }> = [];
    for (const f of hfaces) {
      const len = f.b - f.a;
      const n = Math.max(1, Math.round(len / H.door.every));
      for (let i = 0; i < n; i++) {
        for (const off of [0, 0.25, -0.25, 0.4, -0.4]) {
          const u = f.a + (i + 0.5 + off) * (len / n);
          if (u - f.a < H.door.corner + dw / 2 || f.b - u < H.door.corner + dw / 2) continue;
          const [ox, oz] = f.nx !== 0 ? [f.at + f.nx * 1.5, u] : [u, f.at + f.nz * 1.5];
          if (local.some((p) => Math.hypot(p.x - ox, p.z - oz) < H.door.pad + dw / 2)) continue;
          if (stair && meets(onF(f, u - dw / 2, u + dw / 2, 0, 2), stair, H.door.stair)) continue;
          // nothing more than a step standing in the way out (a bridge's pillar on the kerb), nor a stairwell's rail
          const way = onF(f, u - dw / 2 - 0.3, u + dw / 2 + 0.3, 0.05, H.door.out);
          if (RANGE_SOLIDS.some((s) => s.base < dTop && s.top > PAVE_H + 0.4 && meets(way, { x0: s.minX - BR_X, x1: s.maxX - BR_X, z0: s.minZ - BR_Z, z1: s.maxZ - BR_Z }))) continue;
          if (KIT_SITES.openings.some((o) => meets(way, o, 0.5))) continue;
          doors.push({ f, u });
          break;
        }
      }
    }
    // the shell: the podium's box less the hall and a cut through the wall at each door
    const cuts: Cut[] = [{ x0: ix0, x1: ix1, z0: iz0, z1: iz1, y0: PAVE_H, y1 }];
    for (const { f, u } of doors) cuts.push({ ...onF(f, u - dw / 2, u + dw / 2, 0.1, -wl - 0.1), y0: PAVE_H, y1: dTop });
    cutSlab(px1 - px0, h, pz1 - pz0, cx, PAVE_H, cz, mat, cuts);
    // lined inside: the walls between the doors and over them, the ceiling, a line of the block's colour along the walls.
    // The roof keeps the sky's light off everything in here and no light of ours is cheap enough for eight halls, so the
    // hall's own surfaces carry a little light of their own (hallLit), what the strips in the ceiling would throw: a body
    // stands out dark against a floor you can see
    const { lining, ceiling, floor, column } = hallLit();
    const k = neon(accent);
    deco(ix1 - ix0, 0.02, iz1 - iz0, (ix0 + ix1) / 2, PAVE_H, (iz0 + iz1) / 2, floor);
    const warm = emissive(0xffe6c0, H.light.glow);
    for (const f of hfaces) {
      const [ia, ib] = f.nx !== 0 ? [iz0, iz1] : [ix0, ix1];
      const mine = doors.filter((d) => d.f === f).map((d) => d.u).sort((p, q) => p - q);
      let from = ia;
      for (const u of [...mine, Infinity]) {
        const to = Math.min(ib, u - dw / 2);
        if (to - from > 0.05) {
          const q = onF(f, from, to, -wl - 0.01, -wl - 0.04);
          deco(q.x1 - q.x0, y1 - PAVE_H, q.z1 - q.z0, (q.x0 + q.x1) / 2, PAVE_H, (q.z0 + q.z1) / 2, lining);
          const s = onF(f, from, to, -wl - 0.04, -wl - 0.07);
          deco(s.x1 - s.x0, 0.08, s.z1 - s.z0, (s.x0 + s.x1) / 2, PAVE_H + 2.2, (s.z0 + s.z1) / 2, k);
        }
        if (u === Infinity) break;
        const q = onF(f, u - dw / 2, u + dw / 2, -wl - 0.01, -wl - 0.04);
        deco(q.x1 - q.x0, y1 - dTop, q.z1 - q.z0, (q.x0 + q.x1) / 2, dTop, (q.z0 + q.z1) / 2, lining);
        from = u + dw / 2;
      }
    }
    deco(ix1 - ix0, 0.05, iz1 - iz0, (ix0 + ix1) / 2, y1 - 0.05, (iz0 + iz1) / 2, ceiling);
    const alongX = ix1 - ix0 >= iz1 - iz0;
    const across = alongX ? iz1 - iz0 : ix1 - ix0;
    const ln = Math.max(1, Math.round(across / H.light.every));
    for (let i = 0; i < ln; i++) {
      const v = (alongX ? iz0 : ix0) + ((i + 0.5) * across) / ln;
      if (alongX) deco(ix1 - ix0 - 4, 0.06, H.light.width, (ix0 + ix1) / 2, y1 - 0.11, v, warm);
      else deco(H.light.width, 0.06, iz1 - iz0 - 4, v, y1 - 0.11, (iz0 + iz1) / 2, warm);
    }
    // each door's lane: the floor in from it, which the columns and counters keep off
    const lanes = doors.map(({ f, u }) => onF(f, u - dw / 2 - 0.5, u + dw / 2 + 0.5, -wl, -wl - H.column.lane));
    // the columns, on a grid clear of the walls and the lanes
    const Co = H.column;
    const columns: Array<{ x0: number; x1: number; z0: number; z1: number }> = [];
    const gx = Math.max(1, Math.round((ix1 - ix0) / Co.every));
    const gz = Math.max(1, Math.round((iz1 - iz0) / Co.every));
    for (let i = 0; i < gx; i++) {
      for (let j = 0; j < gz; j++) {
        const x = ix0 + ((i + 0.5) * (ix1 - ix0)) / gx;
        const z = iz0 + ((j + 0.5) * (iz1 - iz0)) / gz;
        const box = { x0: x - Co.size / 2, x1: x + Co.size / 2, z0: z - Co.size / 2, z1: z + Co.size / 2 };
        if (box.x0 - ix0 < Co.wall || ix1 - box.x1 < Co.wall || box.z0 - iz0 < Co.wall || iz1 - box.z1 < Co.wall) continue;
        if (lanes.some((l) => meets(box, l, 0.5))) continue;
        slab(Co.size, y1 - PAVE_H, Co.size, x, PAVE_H, z, column);
        deco(Co.size + 0.04, 0.08, Co.size + 0.04, x, PAVE_H + 2.2, z, k);
        columns.push(box);
      }
    }
    // The gallery (halls gallery, 24.4b): a walk round every wall a storey up, over the doors and the shop fronts, railed on
    // its inner edge; the north and south runs the hall's length, the west and east between them
    const G = H.gallery;
    const gTop = PAVE_H + G.floor;
    const galleries = hfaces.map((f) => {
      const [ia, ib] = f.nx !== 0 ? [iz0 + G.depth, iz1 - G.depth] : [ix0, ix1];
      return { f, ...onF(f, ia, ib, -wl, -wl - G.depth) };
    });
    for (const g of galleries) slab(g.x1 - g.x0, G.thick, g.z1 - g.z0, (g.x0 + g.x1) / 2, gTop - G.thick, (g.z0 + g.z1) / 2, floor);
    // the flights up to it, from the long walls into the hall, between the columns and clear of the doors' lanes: the top
    // step level with the gallery, each below one `rise` lower and `run` further in
    const nSteps = Math.round(G.floor / G.rise);
    const reach = G.depth + nSteps * G.run;
    const sw = G.stairWidth;
    const stairs: Array<{ f: HFace; u: number; x0: number; x1: number; z0: number; z1: number }> = [];
    const long = [...hfaces].sort((p, q) => q.b - q.a - (p.b - p.a)).slice(0, 2);
    for (const f of long) {
      if (stairs.length >= G.stairs) break;
      const [ia, ib] = f.nx !== 0 ? [iz0, iz1] : [ix0, ix1];
      // from the face's middle out, the first spot whose flight meets nothing
      const spots = Array.from({ length: Math.floor((ib - ia - 2 * G.depth - sw) / 0.5) }, (_, i) => ia + G.depth + sw / 2 + i * 0.5).sort((p, q) => Math.abs(p - (ia + ib) / 2) - Math.abs(q - (ia + ib) / 2));
      for (const u of spots) {
        const box = onF(f, u - sw / 2, u + sw / 2, -wl - G.depth, -wl - reach);
        if ([...columns, ...lanes].some((q) => meets(box, q, 0.6))) continue;
        stairs.push({ f, u, ...box });
        break;
      }
    }
    for (const s of stairs) {
      for (let i = 0; i < nSteps; i++) {
        const q = onF(s.f, s.u - sw / 2, s.u + sw / 2, -wl - G.depth - i * G.run, -wl - G.depth - (i + 1) * G.run);
        slab(q.x1 - q.x0, gTop - i * G.rise - PAVE_H, q.z1 - q.z0, (q.x0 + q.x1) / 2, PAVE_H, (q.z0 + q.z1) / 2, column);
      }
      // its edge lit, to read as the way up
      const e = onF(s.f, s.u - sw / 2 - 0.03, s.u + sw / 2 + 0.03, -wl - G.depth, -wl - G.depth - 0.06);
      deco(e.x1 - e.x0, 0.06, e.z1 - e.z0, (e.x0 + e.x1) / 2, gTop, (e.z0 + e.z1) / 2, k);
    }
    // the rail on the gallery's inner edge, open at the top of each flight; the north and south runs' rails stop where
    // the west and east runs join them, so the corners are open (railed the full length, they shut each run off)
    for (const g of galleries) {
      const f = g.f;
      const [ia, ib] = f.nx !== 0 ? [g.z0, g.z1] : [g.x0 + G.depth, g.x1 - G.depth];
      const gaps = stairs.filter((s) => s.f === f).map((s) => [s.u - sw / 2, s.u + sw / 2] as [number, number]).sort((p, q) => p[0] - q[0]);
      let from = ia;
      for (const [g0, g1] of [...gaps, [ib, ib] as [number, number]]) {
        if (g0 - from > 0.1) {
          const r = onF(f, from, g0, -wl - G.depth + 0.1, -wl - G.depth);
          slab(r.x1 - r.x0, G.rail, r.z1 - r.z0, (r.x0 + r.x1) / 2, gTop, (r.z0 + r.z1) / 2, trimDark);
          deco(r.x1 - r.x0 + 0.02, 0.05, r.z1 - r.z0 + 0.02, (r.x0 + r.x1) / 2, gTop + G.rail, (r.z0 + r.z1) / 2, k);
        }
        from = g1;
      }
    }
    // the counters and the kiosks: cover from the hall's own stream, clear of the columns, the flights, the gallery's
    // shade, the lanes and each other
    const Cn = H.counter;
    const Kk = H.kiosk;
    const own = seeded(C.seed ^ [...key].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 0x4a11));
    const counters: Array<{ x0: number; x1: number; z0: number; z1: number }> = [];
    const kiosks: Array<{ x0: number; x1: number; z0: number; z1: number; yaw: number }> = [];
    const free = (box: { x0: number; x1: number; z0: number; z1: number }, m: number, inset: number) =>
      box.x0 > ix0 + inset && box.x1 < ix1 - inset && box.z0 > iz0 + inset && box.z1 < iz1 - inset && ![...columns, ...counters, ...kiosks, ...stairs, ...lanes].some((q) => meets(box, q, m));
    const kioskBody = flat(0x0c0e14, 0.6, 0.4).clone();
    const kioskLine = emissive(accent, C.neonGlow).clone();
    STAND_INS.kiosks.push(kioskBody, kioskLine);
    for (let tries = 0; kiosks.length < Kk.count && tries < 120; tries++) {
      const turn = Math.floor(own() * 4);
      const [w, d] = turn % 2 === 0 ? [Kk.size[0], Kk.size[2]] : [Kk.size[2], Kk.size[0]];
      const x = ix0 + G.depth + Kk.clear + w / 2 + own() * (ix1 - ix0 - 2 * (G.depth + Kk.clear) - w);
      const z = iz0 + G.depth + Kk.clear + d / 2 + own() * (iz1 - iz0 - 2 * (G.depth + Kk.clear) - d);
      const box = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 };
      if (!free(box, Kk.clear, G.depth)) continue;
      slab(w, Kk.size[1], d, x, PAVE_H, z, kioskBody);
      deco(w + 0.04, 0.08, d + 0.04, x, PAVE_H + 1.1, z, kioskLine);
      kiosks.push({ ...box, yaw: (turn * Math.PI) / 2 });
    }
    for (let tries = 0; counters.length < Cn.count && tries < 80; tries++) {
      const along = own() < 0.5;
      const [w, d] = along ? [Cn.size[0], Cn.size[2]] : [Cn.size[2], Cn.size[0]];
      const x = ix0 + Cn.clear + w / 2 + own() * (ix1 - ix0 - 2 * Cn.clear - w);
      const z = iz0 + Cn.clear + d / 2 + own() * (iz1 - iz0 - 2 * Cn.clear - d);
      const box = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 };
      if (!free(box, Cn.clear, Cn.clear)) continue;
      slab(w, Cn.size[1], d, x, PAVE_H, z, trimDark);
      deco(w + 0.02, 0.05, d + 0.02, x, PAVE_H + Cn.size[1], z, k);
      counters.push(box);
    }
    // for the loot, the bots, the kit and the checks
    const W4 = (q: { x0: number; x1: number; z0: number; z1: number }) => ({ minX: q.x0 + BR_X, maxX: q.x1 + BR_X, minZ: q.z0 + BR_Z, maxZ: q.z1 + BR_Z });
    HALLS.push({
      key,
      ...W4({ x0: ix0, x1: ix1, z0: iz0, z1: iz1 }),
      y0: PAVE_H,
      y1,
      doors: doors.map(({ f, u }) => ({ ...(f.nx !== 0 ? { x: f.at + BR_X, z: u + BR_Z } : { x: u + BR_X, z: f.at + BR_Z }), nx: f.nx, nz: f.nz, w: dw, top: dTop })),
      columns: columns.map(W4),
      counters: [...counters.map((q) => ({ ...W4(q), top: PAVE_H + Cn.size[1] })), ...kiosks.map((q) => ({ ...W4(q), top: PAVE_H + Kk.size[1] }))],
      gallery: { top: gTop, under: gTop - G.thick, runs: galleries.map(W4) },
      stairs: stairs.map((s) => {
        const [nx, nz] = [s.f.nx, s.f.nz];
        const at = (d: number) => (s.f.nx !== 0 ? { x: s.f.at + nx * d + BR_X, z: s.u + BR_Z } : { x: s.u + BR_X, z: s.f.at + nz * d + BR_Z });
        return { ...W4(s), top: at(-wl - G.depth / 2), foot: at(-wl - reach - 1.2) };
      }),
    });
    for (const q of kiosks) KIT_SITES.kiosks.push({ x: (q.x0 + q.x1) / 2, z: (q.z0 + q.z1) / 2, w: q.x1 - q.x0, d: q.z1 - q.z0, h: Kk.size[1], yaw: q.yaw });
    HALL_FLOORS.push({ ...W4({ x0: ix0, x1: ix1, z0: iz0, z1: iz1 }), y: PAVE_H, top: y1 });
    KIT_SITES.halls.push({ x0: ix0, x1: ix1, z0: iz0, z1: iz1, y0: PAVE_H, y1, accent, doors: doors.map(({ f, u }) => ({ face: f.face, u0: u - dw / 2, u1: u + dw / 2, top: dTop })) });
    // the kit leaves each door open: its box through the wall and out past the shop fronts in front of it
    for (const { f, u } of doors) KIT_SITES.doors.push({ ...onF(f, u - dw / 2, u + dw / 2, 0.7, -wl), y0: PAVE_H, y1: dTop });
  }

  /**
   * A downtown block (city.json downtown): a podium over most of it, one side
   * left a plaza at street level, and two to four towers on the podium split
   * by canyons a double jump clears. A jump pad on the plaza throws you onto
   * the podium; one on the podium's terrace throws you up to a tower's roof.
   */
  function downtownBlock(x0: number, x1: number, z0: number, z1: number, sec: Sector, ring: number, key: string): void {
    const D = C.downtown;
    const K = C.concourse;
    const m = D.margin;
    let px0 = x0 + m;
    let px1 = x1 - m;
    let pz0 = z0 + m;
    let pz1 = z1 - m;
    const side = Math.floor(rnd() * 4);
    // the open side: a plaza strip at street level, the podium set back from it
    if (side === 0) pz0 += D.plazaStrip;
    else if (side === 1) pz1 -= D.plazaStrip;
    else if (side === 2) px0 += D.plazaStrip;
    else px1 -= D.plazaStrip;
    const podS = D.podium[0] + Math.floor(rnd() * (D.podium[1] - D.podium[0] + 1));
    const podTop = PAVE_H + podS * storeyH;
    const pcx = (px0 + px1) / 2;
    const pcz = (pz0 + pz1) / 2;
    const k = neon(sec.accent);
    // the podium: lit floors over the street, a cap to walk on, and a shopfront's glow along its foot. Its body is built
    // once the public stair and the plaza's pad are placed (podiumBody, below), since a centre podium's hall keeps its
    // doors clear of both
    const podMat = night[Math.floor(rnd() * night.length)];
    slab(px1 - px0, 0.12, pz1 - pz0, pcx, podTop - 0.12, pcz, concrete);
    const shop = neon(sec.accent);
    deco(px1 - px0 + 0.06, 0.5, 0.06, pcx, PAVE_H + 3.1, pz0, shop);
    deco(px1 - px0 + 0.06, 0.5, 0.06, pcx, PAVE_H + 3.1, pz1, shop);
    deco(0.06, 0.5, pz1 - pz0 + 0.06, px0, PAVE_H + 3.1, pcz, shop);
    deco(0.06, 0.5, pz1 - pz0 + 0.06, px1, PAVE_H + 3.1, pcz, shop);
    deco(px1 - px0 + 0.1, 0.12, 0.12, pcx, podTop - 0.3, pz0, k);
    deco(px1 - px0 + 0.1, 0.12, 0.12, pcx, podTop - 0.3, pz1, k);
    deco(0.12, 0.12, pz1 - pz0 + 0.1, px0, podTop - 0.3, pcz, k);
    deco(0.12, 0.12, pz1 - pz0 + 0.1, px1, podTop - 0.3, pcz, k);
    podia.set(key, { x0: px0, x1: px1, z0: pz0, z1: pz1, top: podTop });
    KIT_SITES.podia.push({ key, x0: px0, x1: px1, z0: pz0, z1: pz1, top: podTop, plaza: side, spire: false });
    // canopies over its shopfronts but the plaza's (city.json streetLife): shelter on the pavement, and a ledge
    {
      const L = C.streetLife;
      const cy = PAVE_H + L.canopyAt;
      if (side !== 0) slab(px1 - px0 - 2, 0.15, L.canopy, pcx, cy, pz0 - L.canopy / 2, trimDark);
      if (side !== 1) slab(px1 - px0 - 2, 0.15, L.canopy, pcx, cy, pz1 + L.canopy / 2, trimDark);
      if (side !== 2) slab(L.canopy, 0.15, pz1 - pz0 - 2, px0 - L.canopy / 2, cy, pcz, trimDark);
      if (side !== 3) slab(L.canopy, 0.15, pz1 - pz0 - 2, px1 + L.canopy / 2, cy, pcz, trimDark);
    }
    // the public stair up onto it, along its face on the plaza side from one end: the way up with no pad
    const run = Math.ceil((podTop - PAVE_H) / K.stairRise);
    const rise = (podTop - PAVE_H) / run;
    for (let i = 0; i < run; i++) {
      const h = (i + 1) * rise;
      const a = (i + 0.5) * K.stairRun + 1;
      if (side === 0) slab(K.stairRun, h, K.stairWidth, px0 + a, PAVE_H, pz0 - K.stairWidth / 2, concrete);
      else if (side === 1) slab(K.stairRun, h, K.stairWidth, px0 + a, PAVE_H, pz1 + K.stairWidth / 2, concrete);
      else if (side === 2) slab(K.stairWidth, h, K.stairRun, px0 - K.stairWidth / 2, PAVE_H, pz0 + a, concrete);
      else slab(K.stairWidth, h, K.stairRun, px1 + K.stairWidth / 2, PAVE_H, pz0 + a, concrete);
    }
    // the walk up it, for the checks: from the pavement before its first step, along to its top one, onto the podium
    const sw = K.stairWidth / 2;
    const foot = 0.3;
    const last = (run - 0.5) * K.stairRun + 1;
    const walkUp =
      side === 0
        ? [W(px0 + foot, pz0 - sw), W(px0 + last, pz0 - sw), W(px0 + last, pz0 + 2)]
        : side === 1
          ? [W(px0 + foot, pz1 + sw), W(px0 + last, pz1 + sw), W(px0 + last, pz1 - 2)]
          : side === 2
            ? [W(px0 - sw, pz0 + foot), W(px0 - sw, pz0 + last), W(px0 + 2, pz0 + last)]
            : [W(px1 + sw, pz0 + foot), W(px1 + sw, pz0 + last), W(px1 - 2, pz0 + last)];
    CONCOURSE.stairs.push({ legs: walkUp, top: podTop });
    // its edge lit, to read from the street as the way up
    const len = run * K.stairRun;
    const sw2 = K.stairWidth;
    stairZones.push(
      side === 0
        ? { x0: px0 + 1, x1: px0 + 1 + len, z0: pz0 - sw2, z1: pz0 }
        : side === 1
          ? { x0: px0 + 1, x1: px0 + 1 + len, z0: pz1, z1: pz1 + sw2 }
          : side === 2
            ? { x0: px0 - sw2, x1: px0, z0: pz0 + 1, z1: pz0 + 1 + len }
            : { x0: px1, x1: px1 + sw2, z0: pz0 + 1, z1: pz0 + 1 + len },
    );
    KIT_SITES.stairs.push(stairZones[stairZones.length - 1]);
    if (side === 0) deco(len, 0.08, 0.08, px0 + 1 + len / 2, PAVE_H + 0.3, pz0 - K.stairWidth, k);
    else if (side === 1) deco(len, 0.08, 0.08, px0 + 1 + len / 2, PAVE_H + 0.3, pz1 + K.stairWidth, k);
    else if (side === 2) deco(0.08, 0.08, len, px0 - K.stairWidth, PAVE_H + 0.3, pz0 + 1 + len / 2, k);
    else deco(0.08, 0.08, len, px1 + K.stairWidth, PAVE_H + 0.3, pz0 + 1 + len / 2, k);
    // the plaza's pad, in front of the podium, throwing you up onto it
    if (side === 0) padOnto(pcx, pz0, 0, -1, PAVE_H, podTop);
    else if (side === 1) padOnto(pcx, pz1, 0, 1, PAVE_H, podTop);
    else if (side === 2) padOnto(px0, pcz, -1, 0, PAVE_H, podTop);
    else padOnto(px1, pcz, 1, 0, PAVE_H, podTop);
    {
      const stair = KIT_SITES.stairs[KIT_SITES.stairs.length - 1];
      // (a district's podium is built now, inside the sandbox that may take its block away again; the centre's are never)
      if (sec.id === "c") hallBodies.push(() => podiumBody(px0, px1, pz0, pz1, podTop, podMat, true, stair, key, sec.accent));
      else podiumBody(px0, px1, pz0, pz1, podTop, podMat, false, stair, key, sec.accent);
    }
    // the towers: a 2 by 2 split of the podium by two canyons, one cell left open as the terrace
    const [lo, hi] = (D.towers as Record<string, number[]>)[String(ring)] ?? D.towers["1"];
    const gap = D.canyon[0] + rnd() * (D.canyon[1] - D.canyon[0]);
    const sx = px0 + (px1 - px0) * (0.38 + rnd() * 0.24);
    const sz = pz0 + (pz1 - pz0) * (0.38 + rnd() * 0.24);
    const cells: Array<[number, number, number, number]> = [
      [px0, sx - gap / 2, pz0, sz - gap / 2],
      [sx + gap / 2, px1, pz0, sz - gap / 2],
      [px0, sx - gap / 2, sz + gap / 2, pz1],
      [sx + gap / 2, px1, sz + gap / 2, pz1],
    ];
    const open = Math.floor(rnd() * 4);
    let lowest: Tower | null = null;
    cells.forEach(([a0, a1, b0, b1], i) => {
      if (i === open) return;
      // a ledge a body wide along the canyons, and the promenade along the podium's edge, the walk to its bridges
      const ia0 = a0 === px0 ? K.promenade : 0.8;
      const ia1 = a1 === px1 ? K.promenade : 0.8;
      const ib0 = b0 === pz0 ? K.promenade : 0.8;
      const ib1 = b1 === pz1 ? K.promenade : 0.8;
      const w = a1 - a0 - ia0 - ia1;
      const d = b1 - b0 - ib0 - ib1;
      if (w < 6 || d < 6) return;
      // a twin stands beside a chimney, along half its length or more (city.json downtown twins): the tallest round the
      // Spire. The same one draw as ever, so the tower stands where it stood
      const twin = C.chimneys.list.some((c) => Math.min(Math.abs(c.x - a0), Math.abs(c.x - a1)) < D.twinReach && Math.min(c.z1, b1) - Math.max(c.z0, b0) >= (c.z1 - c.z0) / 2);
      const [tl, th] = twin ? D.twins : [lo, hi];
      const storeys = Math.round(tl + rnd() * (th - tl));
      const mat = rnd() < 0.3 ? glass : night[Math.floor(rnd() * night.length)];
      // the stair core runs along the tower's long side, its door in an end face on the promenade (not a canyon)
      const alongX = w >= d;
      const ends: Array<[number, number]> = alongX ? [[-1, ia0], [1, ia1]] : [[-1, ib0], [1, ib1]];
      const doorEnd = ends.find(([, inset]) => inset >= K.promenade - 0.01);
      const t = mass((a0 + ia0 + a1 - ia1) / 2, (b0 + ib0 + b1 - ib1) / 2, w, d, podTop, storeys, mat, sec.accent, sec.id, true, rnd, true, [], doorEnd ? { alongX, end: doorEnd[0] } : null);
      if (!lowest || t.roof < lowest.roof) lowest = t;
    });
    // the terrace's pad, in the open cell, up to the lowest tower's roof
    const [a0, a1, b0, b1] = cells[open];
    const low = lowest as Tower | null;
    if (low) {
      // the lowest tower's face toward the open cell, at the middle of the cell's side of it
      const tx = (a0 + a1) / 2;
      const tz = (b0 + b1) / 2;
      const byX = Math.abs(tx - low.x) / (low.w / 2) > Math.abs(tz - low.z) / (low.d / 2);
      if (byX) {
        const n = Math.sign(tx - low.x);
        padOnto(low.x + (n * low.w) / 2, Math.max(low.z - low.d / 2 + 2, Math.min(low.z + low.d / 2 - 2, tz)), n, 0, podTop, low.roof);
      } else {
        const n = Math.sign(tz - low.z);
        padOnto(Math.max(low.x - low.w / 2 + 2, Math.min(low.x + low.w / 2 - 2, tx)), low.z + (n * low.d) / 2, 0, n, podTop, low.roof);
      }
    }
  }

  /**
   * A mid-rise block (city.json perimeter): buildings wall to wall round its
   * edge on a courtyard, each a few storeys from its neighbour so the roofs
   * run round the block, one passage in, a pad on the street onto the roofs
   * and one in the courtyard.
   */
  function perimeterBlock(x0: number, x1: number, z0: number, z1: number, sec: Sector): void {
    const Q = C.perimeter;
    const m = C.downtown.margin;
    const ax0 = x0 + m;
    const ax1 = x1 - m;
    const az0 = z0 + m;
    const az1 = z1 - m;
    const dep = Q.depth[0] + rnd() * (Q.depth[1] - Q.depth[0]);
    const [lo, hi] = Q.storeys;
    let prev = Math.round(lo + rnd() * (hi - lo));
    const next = (): number => {
      prev = Math.max(lo, Math.min(hi, prev + Math.round((rnd() * 2 - 1) * Q.step)));
      return prev;
    };
    // one side has the passage into the courtyard: a gap in its run of buildings
    const passSide = Math.floor(rnd() * 4);
    const built: Tower[] = [];
    // a side's run of buildings from a to b along it: n and s run the full width, e and w between them
    const run = (side: number, a: number, b: number): void => {
      const len = b - a;
      const passAt = side === passSide ? a + len * (0.3 + rnd() * 0.4) : Infinity;
      let at = a;
      while (at < b - 4) {
        let seg = Q.segment[0] + rnd() * (Q.segment[1] - Q.segment[0]);
        if (b - (at + seg) < Q.segment[0]) seg = b - at;
        // the passage: stop short of it, and start again past it
        if (at < passAt && at + seg > passAt - Q.passage / 2) {
          seg = passAt - Q.passage / 2 - at;
          if (seg >= 4) put(side, at, seg);
          at = passAt + Q.passage / 2;
          continue;
        }
        put(side, at, seg);
        at += seg;
      }
    };
    const put = (side: number, at: number, seg: number): void => {
      const storeys = next();
      const mat = sec.id === "w" ? brick : night[Math.floor(rnd() * night.length)];
      const mid = at + seg / 2;
      const [x, z, w, d] = side === 0 ? [mid, az0 + dep / 2, seg, dep] : side === 1 ? [mid, az1 - dep / 2, seg, dep] : side === 2 ? [ax0 + dep / 2, mid, dep, seg] : [ax1 - dep / 2, mid, dep, seg];
      // Entered from the street and climbed by its stairs (perimeter.enter), so a player who lands with nothing
      // gets to the roofs and the loot on every floor without a pad. Its doors are on the street and the
      // courtyard, never the walls it shares, and never its east wall, which its stairs run along.
      if (seg >= Q.enter.minSeg && storeys <= Q.enter.maxStoreys) {
        const doors: Side[] = side === 0 ? ["n", "s"] : side === 1 ? ["s", "n"] : ["w"];
        // windows only where there is something to see: a wall shared with the next building stays whole (a window is five pieces a storey, a wall one)
        const windows: Side[] = side === 0 || side === 1 ? ["n", "s"] : ["w", "e"];
        const t = tower({ x, z, w, d, storeys, sector: sec, mat, accent: sec.accent, doors, windows, block: { x0, x1, z0, z1 } });
        towers.push(t);
        built.push(t);
        return;
      }
      built.push(mass(x, z, w, d, PAVE_H, storeys, mat, sec.accent, sec.id));
    };
    run(0, ax0, ax1);
    run(1, ax0, ax1);
    run(2, az0 + dep, az1 - dep);
    run(3, az0 + dep, az1 - dep);
    if (!built.length) return;
    // a pad on the street, onto the lowest building of a side, from outside its outer face
    const outer = built.filter((t) => Math.abs(t.z - (az0 + dep / 2)) < 0.5).sort((a, b) => a.roof - b.roof)[0];
    if (outer) padOnto(outer.x, outer.z - outer.d / 2, 0, -1, PAVE_H, outer.roof);
    // and one in the courtyard, onto the lowest building facing it from the north side's inner face
    const inner = built.filter((t) => Math.abs(t.z - (az1 - dep / 2)) < 0.5).sort((a, b) => a.roof - b.roof)[0];
    if (inner) padOnto(inner.x, inner.z - inner.d / 2, 0, -1, PAVE_H, inner.roof);
  }

  /**
   * A drum: a cylinder you see, standing on a cross of two boxes you stand on
   * and collide with (the world's collision is boxes; a cross is closer to a
   * circle than a square, and its arms reach the rim).
   */
  function drum(r: number, h: number, x: number, y: number, z: number, mat: THREE.Material, rim: THREE.Material): void {
    const cyl = new THREE.CylinderGeometry(r, r, h, 28);
    // its texture tiled in metres, as a box's is: stretched once round, the facade's windows smeared into a band
    const tile = tileOf.get(mat) ?? 0;
    if (tile > 0) {
      const uv = cyl.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * 2 * Math.PI * r) / tile, (uv.getY(i) * h) / tile);
    }
    const m = new THREE.Mesh(cyl, mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    solid(x - r, x + r, z - r * 0.62, z + r * 0.62, y, y + h);
    solid(x - r * 0.62, x + r * 0.62, z - r, z + r, y, y + h);
    const band = new THREE.Mesh(new THREE.TorusGeometry(r + 0.05, 0.1, 6, 36), rim);
    band.rotation.x = Math.PI / 2;
    band.position.set(x, y + h, z);
    root.add(band);
  }

  /** a district's landmark (city.json landmarks): one shape each, all of them climbed */
  function landmark(kind: string, x0: number, x1: number, z0: number, z1: number, sec: Sector): void {
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    // laid out for a block of 57 m; on the districts' cut blocks (city.json cut, 38 m) the wide ones take its share across
    const f = Math.min(1, Math.min(x1 - x0, z1 - z0) / 57);
    const k = neon(sec.accent);
    const g = PAVE_H;
    const S = storeyH;
    if (kind === "holotower") {
      // NEON ROW: a slim tower ringed by three great holo rings, a plaza of screens at its foot
      const t = mass(cx, cz, 16, 16, g, 16, glass, sec.accent, sec.id);
      for (const [i, y] of [22, 38, 52].entries()) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(15 + i * 2, 0.35, 8, 48), k);
        ring.rotation.x = Math.PI / 2 + (i - 1) * 0.12;
        ring.position.set(cx, g + y, cz);
        root.add(ring);
      }
      for (const [dx, dz, w, d] of (
        [
          [-22, -22, 10, 1],
          [22, 22, 10, 1],
          [-22, 22, 1, 10],
          [22, -22, 1, 10],
        ] as const
      ).map(([a, c, e, h]) => [a * f, c * f, e === 1 ? 1 : e * f, h === 1 ? 1 : h * f])) {
        slab(w, 8, d, cx + dx, g, cz + dz, trimDark);
        deco(w === 1 ? 1.1 : w - 0.4, 6, d === 1 ? 1.1 : d - 0.4, cx + dx, g + 1, cz + dz, k);
      }
      const low = mass(cx - 14, cz + 14, 8, 8, g, 2, night[0], sec.accent, sec.id);
      padOnto(cx - 18, cz + 14, -1, 0, g, low.roof);
      padOnto(cx, cz - 8, 0, -1, g, t.roof);
    } else if (kind === "lantern") {
      // HARBOR GLASS: the Lantern, a glass drum of ten storeys on a plaza, its crown lit, pads up its sides
      const r = 17;
      drum(r, 10 * S, cx, g, cz, night[2], k);
      for (let s = 2; s < 10; s += 2) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(r + 0.06, 0.12, 6, 40), k);
        band.rotation.x = Math.PI / 2;
        band.position.set(cx, g + s * S, cz);
        root.add(band);
      }
      const top = g + 10 * S;
      for (const [nx, nz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) padOnto(cx + nx * r, cz + nz * r, nx, nz, g, top);
      slab(3, 3, 3, cx, top, cz, metal);
      deco(0.5, 16, 0.5, cx, top + 3, cz, k);
    } else if (kind === "silos") {
      // THE STACKS: silos joined by catwalks along their tops, the way across the district in the air
      const spots: Array<[number, number, number]> = [
        [-14, -14, 20],
        [0, -14, 24],
        [14, -14, 20],
        [-14, 12, 16],
        [0, 12, 20],
        [14, 12, 24],
      ];
      const sr = 5.5 * f;
      for (const [dx, dz, h] of spots) drum(sr, h, cx + dx * f, g, cz + dz * f, metal, k);
      // catwalks at 16 m between neighbours, and a pad up to them
      for (const [ax, az, bx, bz] of [
        [-14, -14, 0, -14],
        [0, -14, 14, -14],
        [-14, 12, 0, 12],
        [0, 12, 14, 12],
        [0, -14, 0, 12],
      ] as const) {
        const len = Math.hypot(bx - ax, bz - az) * f;
        const along = ax !== bx;
        const [mx, mz] = [cx + ((ax + bx) / 2) * f, cz + ((az + bz) / 2) * f];
        slab(along ? len : 2.2, 0.3, along ? 2.2 : len, mx, g + 16 - 0.3, mz, metal);
        deco(along ? len : 0.08, 0.08, along ? 0.08 : len, mx + (along ? 0 : 1.1), g + 17, mz + (along ? 1.1 : 0), k);
      }
      padOnto(cx - 14 * f - sr, cz - 14 * f, -1, 0, g, g + 20);
      padOnto(cx + 14 * f + sr, cz + 12 * f, 1, 0, g, g + 24);
    } else if (kind === "cathedral") {
      // OLD TOWN: a long nave with a steep roof, two bell towers at its front, a rose of light over the door
      const nave = mass(cx, cz + 4, 18, 40, g, 5, brick, sec.accent, sec.id);
      const roofGeo = new THREE.CylinderGeometry(0.01, 12.7, 9, 4, 1);
      const roof = new THREE.Mesh(roofGeo, trimDark);
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(1, 1, 3.1);
      roof.position.set(cx, nave.roof + 4.5, cz + 4);
      root.add(roof);
      const bells = [-7, 7].map((dx) => mass(cx + dx, cz - 20, 8, 8, g, 10, brick, sec.accent, sec.id));
      const rose = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.3, 8, 32), k);
      rose.position.set(cx, g + 14, cz - 16.05);
      root.add(rose);
      padOnto(cx - 9, cz + 10, -1, 0, g, nave.roof);
      padOnto(cx + 7, cz - 24, 0, -1, g, bells[1].roof);
    } else if (kind === "bowl") {
      // THE CIRCUIT: a stadium bowl, four stands of steps round a field, their tops a ring to run
      const field = 24 * f;
      const rows = 8;
      for (const [nx, nz] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ] as const) {
        for (let i = 0; i < rows; i++) {
          const off = field / 2 + i * 1.1 + 0.55;
          const long = field + 2 * (i + 1) * 1.1;
          const h = (i + 1) * 0.5;
          if (nx === 0) slab(long, h, 1.1, cx, g, cz + nz * off, concrete);
          else slab(1.1, h, long - 2.2, cx + nx * off, g, cz, concrete);
        }
      }
      const edge = field / 2 + rows * 1.1;
      deco(edge * 2, 0.1, 0.1, cx, g + rows * 0.5, cz - edge, k);
      deco(edge * 2, 0.1, 0.1, cx, g + rows * 0.5, cz + edge, k);
      deco(0.1, 0.1, edge * 2, cx - edge, g + rows * 0.5, cz, k);
      deco(0.1, 0.1, edge * 2, cx + edge, g + rows * 0.5, cz, k);
      // floodlight masts on the corners
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const) {
        slab(0.8, 22, 0.8, cx + sx * (edge + 1.5), g, cz + sz * (edge + 1.5), metal);
        deco(3, 1.2, 3, cx + sx * (edge + 1.5), g + 22, cz + sz * (edge + 1.5), neon(0xe8f6ff));
      }
    } else if (kind === "terraces") {
      // THE GARDENS: a stepped garden, a storey a tier, trees on every terrace
      let w = 46 * f;
      let y = g;
      for (let tier = 0; tier < 5; tier++) {
        slab(w, S - 0.12, w, cx, y, cz, tier % 2 ? concrete : night[1]);
        slab(w, 0.12, w, cx, y + S - 0.12, cz, concrete);
        y += S;
        deco(w + 0.1, 0.1, 0.1, cx, y - 0.3, cz - w / 2, k);
        deco(w + 0.1, 0.1, 0.1, cx, y - 0.3, cz + w / 2, k);
        const trees = tier < 4 ? 4 : 1;
        for (let i = 0; i < trees; i++) {
          const a = (i / trees) * Math.PI * 2 + tier;
          const tx = cx + Math.cos(a) * (w / 2 - 3.5);
          const tz = cz + Math.sin(a) * (w / 2 - 3.5);
          slab(0.5, 2.5, 0.5, tx, y, tz, trimDark);
          const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 0), neon(0x5aff6a));
          crown.position.set(tx, y + 3.4, tz);
          root.add(crown);
        }
        w -= 8 * f;
      }
      padOnto(cx, cz + 23 * f, 0, 1, g, g + 2 * S);
    } else if (kind === "gantry") {
      // THE YARDS: two gantry cranes across the block over stacks of containers, their beams walkable
      const cols = [0x2f5d7a, 0x7a3a2f, 0x3a6a3a, 0x7a6a2a].map((c) => flat(c, 0.55, 0.3));
      for (let i = 0; i < 14; i++) {
        const along = rnd() < 0.5;
        const tiers = 1 + Math.floor(rnd() * 3);
        // (a container 12 m long kept inside the block: its middle no further out than half the block less its half)
        const x = cx + (rnd() - 0.5) * Math.min(44, 44 * f - 10);
        const z = cz + (rnd() - 0.5) * Math.min(44, 44 * f - 10);
        for (let t = 0; t < tiers; t++) slab(along ? 12 : 2.5, 2.6, along ? 2.5 : 12, x, g + t * 2.6, z, cols[(i + t) % cols.length]);
      }
      for (const dz of [-12, 12]) {
        for (const dx of [-24, 24]) slab(1.2, 20, 1.2, cx + dx * f, g, cz + dz, metal);
        slab(49 * f, 1.2, 3, cx, g + 20, cz + dz, metal);
        deco(49 * f, 0.1, 0.1, cx, g + 21.25, cz + dz - 1.45, k);
        padOnto(cx - 24 * f - 0.6, cz + dz, -1, 0, g, g + 21.2);
      }
    } else if (kind === "station") {
      // SKYHAVEN: a station raised on pillars, its platform a storey and a half up, stairs at both ends
      const y = g + 6;
      slab(44 * f, 0.4, 14, cx, y - 0.4, cz, concrete);
      for (const dx of [-18, -6, 6, 18]) for (const dz of [-5, 5]) slab(1, y - g - 0.4, 1, cx + dx * f, g, cz + dz, metal);
      slab(46 * f, 0.3, 16, cx, y + 7, cz, trimDark);
      for (const dx of [-21, 21]) for (const dz of [-6.5, 6.5]) slab(0.6, 7, 0.6, cx + dx * f, y, cz + dz, metal);
      deco(46 * f, 0.12, 0.12, cx, y + 7, cz - 8, k);
      deco(46 * f, 0.12, 0.12, cx, y + 7, cz + 8, k);
      for (const side of [-1, 1]) {
        const steps = 12;
        for (let i = 0; i < steps; i++) slab(3, (i + 1) * 0.5, 0.9, cx + side * 20 * f, g, cz + side * (6.55 + (steps - i) * 0.9), concrete);
      }
      mass(cx, cz, 10, 6, y, 1, glass, sec.accent, sec.id);
    }
  }

  /** THE SPIRE (city.json spire): a podium over its block, tiers stepping in above it, a pad up each, a mast on top */
  function spireBlock(x0: number, x1: number, z0: number, z1: number, sec: Sector, key: string): void {
    spireKey = key;
    const S = C.spire;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const m = C.downtown.margin + 2;
    let w = x1 - x0 - 2 * m;
    let d = z1 - z0 - 2 * m;
    const k = neon(sec.accent);
    let base = PAVE_H;
    slab(w, S.podium * storeyH - 0.12, d, cx, base, cz, glass);
    slab(w, 0.12, d, cx, base + S.podium * storeyH - 0.12, cz, concrete);
    base += S.podium * storeyH;
    podia.set(key, { x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, top: base });
    KIT_SITES.podia.push({ key, x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, top: base, plaza: -1, spire: true });
    deco(w + 0.1, 0.14, 0.14, cx, base - 0.3, cz - d / 2, k);
    deco(w + 0.1, 0.14, 0.14, cx, base - 0.3, cz + d / 2, k);
    deco(0.14, 0.14, d + 0.1, cx - w / 2, base - 0.3, cz, k);
    deco(0.14, 0.14, d + 0.1, cx + w / 2, base - 0.3, cz, k);
    // the four pads onto the podium, one off each street
    for (const [nx, nz] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ] as const) padOnto(cx + (nx * w) / 2, cz + (nz * d) / 2, nx, nz, PAVE_H, base);
    // the drop (city.json spire drop): the shaft down through every tier but the crown, and a door out at its foot and at
    // the Sky Park's height, each through the tier it stands in to that tier's face
    const Dr = S.drop;
    const sx = cx + Dr.at[0];
    const sz = cz + Dr.at[1];
    const hs = Dr.size / 2;
    const tops: number[] = [];
    {
      let y = base;
      for (const n of S.tiers) tops.push((y += n * storeyH));
    }
    const shaftTop = tops[tops.length - 2];
    const py = PAVE_H + C.skyPark.storey * storeyH;
    // each door runs from the shaft out to the face of the tier it is cut through (the first tier's, then the second's)
    const faceAt = (tier: number) => cz + (d - 2 * S.tierInset * (tier + 1)) / 2;
    const doors: Cut[] = [
      { x0: sx - Dr.door / 2, x1: sx + Dr.door / 2, z0: sz + hs - 0.01, z1: faceAt(0) + 0.1, y0: base, y1: base + storeyH },
      { x0: sx - Dr.door / 2, x1: sx + Dr.door / 2, z0: sz + hs - 0.01, z1: faceAt(1) + 0.1, y0: py, y1: py + storeyH },
    ];
    const cuts: Cut[] = [{ x0: sx - hs, x1: sx + hs, z0: sz - hs, z1: sz + hs, y0: base, y1: shaftTop + 0.01 }, ...doors];
    SPIRE_DROP.shaft = { minX: sx - hs + BR_X, maxX: sx + hs + BR_X, minZ: sz - hs + BR_Z, maxZ: sz + hs + BR_Z };
    SPIRE_DROP.top = shaftTop;
    SPIRE_DROP.foot = base;
    SPIRE_DROP.doors = doors.map((q) => ({ y: q.y0, minX: q.x0 + BR_X, maxX: q.x1 + BR_X, minZ: q.z0 + BR_Z, maxZ: q.z1 + BR_Z }));
    for (const q of doors) KIT_SITES.doors.push({ x0: q.x0, x1: q.x1, z0: q.z1 - 0.2, z1: q.z1 + 1, y0: q.y0, y1: q.y1 });
    // lit down its corners in the chain's colour, and round its mouth
    const dl = neon(parseInt(Dr.light.slice(1), 16));
    for (const [ex, ez] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) deco(0.08, shaftTop - base, 0.08, sx + ex * (hs - 0.05), base, sz + ez * (hs - 0.05), dl);
    for (const s of [-1, 1]) {
      deco(Dr.size, 0.06, 0.06, sx, shaftTop + 0.01, sz + s * hs, dl);
      deco(0.06, 0.06, Dr.size, sx + s * hs, shaftTop + 0.01, sz, dl);
    }
    // a tier past the ones the city always had draws from its own stream, so the blocks built after this one stand as they did
    const own = seeded(C.seed + 1);
    S.tiers.forEach((storeys, tier) => {
      const floor = base;
      w -= 2 * S.tierInset;
      d -= 2 * S.tierInset;
      // the tier that ends at the Sky Park's height is its terrace: its parapet waits for the bridges that land on it
      const terrace = Math.abs(base + storeys * storeyH - (PAVE_H + C.skyPark.storey * storeyH)) < 0.05;
      const t = mass(cx, cz, w, d, base, storeys, tier === S.tiers.length - 1 ? glass : night[tier % night.length], sec.accent, sec.id, false, tier < S.sharedTiers ? rnd : own, !terrace, tier < S.tiers.length - 1 ? cuts : []);
      if (terrace) spireDeck.terrace = { x: cx, z: cz, w, d, y: t.roof, k };
      base = t.roof;
      // a pad on the terrace below this tier, up its east face onto its roof
      padOnto(cx + w / 2, cz, 1, 0, floor, t.roof);
    });
    // the machinery (city.json spire machinery): pipe stacks at the top tier's terrace's corners and a machine on the
    // crown deck, solid, in materials of their own the kit hides once it dresses them (flat() shares one a colour)
    {
      const Mc = S.machinery;
      const body = flat(0x1a2030, 0.5, 0.5).clone();
      STAND_INS.machinery = [body];
      const terrace = tops[tops.length - 2];
      const topW = C.downtown.margin * 0 + (x1 - x0 - 2 * m) - 2 * S.tierInset * (S.tiers.length - 1);
      const [sw, sh, sd] = Mc.stacks.size;
      for (const [ex, ez] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const) {
        const px = cx + ex * (topW / 2 - Mc.stacks.inset);
        const pz = cz + ez * (topW / 2 - Mc.stacks.inset);
        slab(sw, sh, sd, px, terrace, pz, body);
        KIT_SITES.machinery.push({ kind: "stack", x: px, z: pz, y: terrace, w: sw, h: sh, d: sd });
      }
      const [mw, mh, md] = Mc.machine.size;
      const mx = cx + Mc.machine.at[0];
      const mz = cz + Mc.machine.at[1];
      slab(mw, mh, md, mx, base, mz, body);
      KIT_SITES.machinery.push({ kind: "machine", x: mx, z: mz, y: base, w: mw, h: mh, d: md });
    }
    // the mast
    Object.assign(SPIRE_TOP, { x: cx + BR_X, z: cz + BR_Z, y: base, w, d, mast: base + S.mast + 0.3 });
    deco(0.6, S.mast, 0.6, cx, base, cz, k);
    deco(2.2, 0.3, 2.2, cx, base + S.mast, cz, neon(0xff3050));
    plazas.push({ x: cx - (x1 - x0) / 2 + 3, z: cz });
  }

  /**
   * One building: brpoi.ts's shell (storeys, stairs, windows, a roof you can
   * reach) in the city's materials, with neon up its corners and round its
   * roof. Returns where it stands and how high its roof is.
   */
  function tower(o: { x: number; z: number; w: number; d: number; storeys: number; sector: Sector; mat: THREE.Material; accent: number; doors: Side[]; windows?: Side[]; block?: { x0: number; x1: number; z0: number; z1: number } }): Tower {
    // The way up starts at the door nearest its block's edge: a block holds two
    // towers, and a door on the side between them opens onto the other's wall.
    // (Not the east one, which the stairs run along.) Its street is the line
    // beyond that edge, the graph's own (city streets, or the edge road).
    let street: Tower["street"] = null;
    let routeDoor: Side | undefined;
    if (o.block) {
      const b = o.block;
      const gap: Record<Side, number> = { n: o.z - o.d / 2 - b.z0, s: b.z1 - (o.z + o.d / 2), w: o.x - o.w / 2 - b.x0, e: b.x1 - (o.x + o.w / 2) };
      const lines = [-BR_HALF + 7, ...LANES, BR_HALF - 7];
      for (const sd of o.doors) {
        // a door onto the block's edge (its margin is 3 m), not onto the other tower of the block
        if (sd === "e" || gap[sd] > 4) continue;
        if (routeDoor && gap[sd] >= gap[routeDoor]) continue;
        const line = sd === "s" ? Math.min(...lines.filter((v) => v > b.z1)) : sd === "n" ? Math.max(...lines.filter((v) => v < b.z0)) : Math.max(...lines.filter((v) => v < b.x0));
        if (!Number.isFinite(line)) continue;
        routeDoor = sd;
        street = { side: sd, line };
      }
    }
    const ctx: PoiCtx = { box: slab, slab, root, mats: { wall: o.mat, floor: concrete, trim: trimDark, crate: metal, steel: metal } };
    const { roof, route } = building(ctx, {
      x: o.x,
      z: o.z,
      y: PAVE_H,
      w: o.w,
      d: o.d,
      storeys: o.storeys,
      storeyH,
      doors: o.doors,
      windows: o.windows ?? ["n", "s", "e", "w"],
      stairs: true,
      roofAccess: true,
      parapet: true,
      dress: "roof",
      routeDoor,
    });
    const k = neon(o.accent);
    // neon up the four corners and round the roof: a district reads by its colour from anywhere
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) deco(C.cornerNeon, roof - PAVE_H, C.cornerNeon, o.x + (sx * o.w) / 2, PAVE_H, o.z + (sz * o.d) / 2, k);
    deco(o.w, 0.14, 0.14, o.x, roof + 0.9, o.z - o.d / 2, k);
    deco(o.w, 0.14, 0.14, o.x, roof + 0.9, o.z + o.d / 2, k);
    deco(0.14, 0.14, o.d, o.x - o.w / 2, roof + 0.9, o.z, k);
    deco(0.14, 0.14, o.d, o.x + o.w / 2, roof + 0.9, o.z, k);
    // a band of light every few storeys on the tall ones
    for (let s = C.bandEvery; s < o.storeys; s += C.bandEvery) {
      const y = PAVE_H + s * storeyH;
      deco(o.w + 0.1, 0.1, 0.1, o.x, y, o.z - o.d / 2 - 0.05, k);
      deco(o.w + 0.1, 0.1, 0.1, o.x, y, o.z + o.d / 2 + 0.05, k);
    }
    return { x: o.x, z: o.z, w: o.w, d: o.d, roof, storeys: o.storeys, sector: o.sector.id, route: street ? route : [], street };
  }

  // ---------------------------------------------------------------- the concourse
  // Bridges across every street between the core's podiums (and the Spire's), all at one height: the centre
  // one raised district over its streets, as Red Tiger was. Each crosses where both podiums face each other,
  // a third of the way along, or elsewhere where a jump pad's throw would hit it or it would land on a stair.
  {
    const K = C.concourse;
    const underPad = (xa: number, xb: number, za: number, zb: number): boolean =>
      pads.some((p) => p.x - BR_X > xa - 2.5 && p.x - BR_X < xb + 2.5 && p.z - BR_Z > za - 2.5 && p.z - BR_Z < zb + 2.5) ||
      stairZones.some((s) => s.x1 > xa - 1 && s.x0 < xb + 1 && s.z1 > za - 1 && s.z0 < zb + 1);
    for (const [key, a] of podia) {
      const [i, j] = key.split(",").map(Number);
      for (const [di, dj] of [
        [1, 0],
        [0, 1],
      ] as const) {
        const b = podia.get(`${i + di},${j + dj}`);
        if (!b || Math.abs(a.top - b.top) > 0.05) continue;
        const alongX = di === 1;
        const lo = alongX ? Math.max(a.z0, b.z0) + K.bridge : Math.max(a.x0, b.x0) + K.bridge;
        const hi = alongX ? Math.min(a.z1, b.z1) - K.bridge : Math.min(a.x1, b.x1) - K.bridge;
        if (hi <= lo) continue;
        const from = alongX ? a.x1 : a.z1;
        const to = alongX ? b.x0 : b.z0;
        const at = [1 / 3, 2 / 3, 1 / 2, 1 / 6, 5 / 6].map((t) => lo + (hi - lo) * t).find((c) =>
          alongX ? !underPad(from, to, c - K.bridge / 2, c + K.bridge / 2) : !underPad(c - K.bridge / 2, c + K.bridge / 2, from, to),
        );
        if (at === undefined) continue;
        const L = to - from;
        const mid = (from + to) / 2;
        const y = a.top;
        const k = neon(0xffd070);
        if (alongX) {
          slab(L, 0.4, K.bridge, mid, y - 0.4, at, metal);
          for (const s of [-1, 1]) {
            slab(L, 1.0, 0.1, mid, y, at + (s * K.bridge) / 2, trimDark);
            deco(L, 0.06, 0.06, mid, y + 1.02, at + (s * K.bridge) / 2, k);
            deco(L, 0.06, 0.06, mid, y - 0.45, at + (s * K.bridge) / 2, k);
          }
        } else {
          slab(K.bridge, 0.4, L, at, y - 0.4, mid, metal);
          for (const s of [-1, 1]) {
            slab(0.1, 1.0, L, at + (s * K.bridge) / 2, y, mid, trimDark);
            deco(0.06, 0.06, L, at + (s * K.bridge) / 2, y + 1.02, mid, k);
            deco(0.06, 0.06, L, at + (s * K.bridge) / 2, y - 0.45, mid, k);
          }
        }
        CONCOURSE.bridges.push(alongX ? { a: W(from - 1.5, at), b: W(to + 1.5, at), y } : { a: W(at, from - 1.5), b: W(at, to + 1.5), y });
      }
    }
  }

  // ---------------------------------------------------------------- the rooftop highway
  // A loop over the street round the core, six storeys up (city.json highway): the fast way round, above the
  // streets' fights and among the mid-rise roofs. Frames at the kerbs hold it, so the street's middle, where
  // the bots walk, stays clear; pads up onto it from the street.
  {
    const Hw = C.highway;
    const L = Math.abs(STREETS[Hw.street]);
    const y = Hw.height;
    const hw = Hw.width / 2;
    const span = 2 * L + Hw.width;
    const k = neon(0x20e0ff);
    const gold = neon(0xffd070);
    for (const s of [-1, 1]) {
      // the deck along x at z = s L, and along z at x = s L (the corners shared)
      slab(span, 0.5, Hw.width, 0, y - 0.5, s * L, metal);
      slab(Hw.width, 0.5, span - 2 * Hw.width, s * L, y - 0.5, 0, metal);
      for (const e of [-1, 1]) {
        // rails on both edges, lit on top and under the deck's lip; the inner ones stop short of the corners,
        // where they would wall off the turn onto the next side
        const len = e === s ? span : span - 2 * Hw.width;
        slab(len, Hw.rail, 0.12, 0, y, s * L + e * (hw - 0.06), trimDark);
        deco(len, 0.08, 0.08, 0, y + Hw.rail, s * L + e * (hw - 0.06), k);
        deco(len, 0.1, 0.1, 0, y - 0.55, s * L + e * hw, gold);
        slab(0.12, Hw.rail, len, s * L + e * (hw - 0.06), y, 0, trimDark);
        deco(0.08, 0.08, len, s * L + e * (hw - 0.06), y + Hw.rail, 0, k);
        deco(0.1, 0.1, len, s * L + e * hw, y - 0.55, 0, gold);
      }
      // the frames: a pillar on each kerb and a beam under the deck
      for (const a of Hw.frames) {
        for (const [px, pz, alongX] of [
          [a, s * L, true],
          [s * L, a, false],
        ] as const) {
          for (const e of [-1, 1]) slab(1, y - 1.1, 1, alongX ? px : px + e * 6.4, 0, alongX ? pz + e * 6.4 : pz, concrete);
          slab(alongX ? 1 : 13.8, 0.6, alongX ? 13.8 : 1, px, y - 1.1, pz, concrete);
        }
      }
      // the pads up from the street, off the deck's outer edge
      for (const a of Hw.pads) {
        padOnto(a, s * (L + hw), 0, s, 0, y);
        padOnto(s * (L + hw), a, s, 0, 0, y);
      }
    }
    HIGHWAY.length = 0;
    // its corners in order round the loop, for the checks that walk it
    HIGHWAY.push(...[W(-L, -L), W(L, -L), W(L, L), W(-L, L)].map((p) => ({ ...p, y })));
  }

  // ---------------------------------------------------------------- the chimneys
  // The owner's chain, built (city.json chimneys; docs/PHASE_21_LAYOUT.md): two walls 3.0 m apart in a canyon by
  // the Spire, three kicks from one to the other climbing a storey to a landing at the far end, a turn, and three
  // more to the top at the near end. Walls, not towers moved, so nothing else in the city shifts.
  {
    const Ch = C.chimneys;
    const lit = neon(parseInt(Ch.color.slice(1), 16));
    CHIMNEYS.length = 0;
    // the city as it stood before any chimney: one chimney's slabs are not another's floor
    const cityBefore = RANGE_SOLIDS.slice();
    for (const c of Ch.list) {
      const len = c.z1 - c.z0;
      const mid = (c.z0 + c.z1) / 2;
      // its floor: whatever the canyon stands on (the towers' podium, a storey up; measured off the solids as built,
      // since at the street the canyon is inside the podium)
      const wx0 = c.x + BR_X;
      const wz0 = mid + BR_Z;
      const base = cityBefore.reduce((a, s) => (wx0 >= s.minX && wx0 <= s.maxX && wz0 >= s.minZ && wz0 <= s.maxZ && s.top < 20 && s.top > a ? s.top : a), 0);
      const landing = base + Ch.rise;
      const top = base + Ch.rise * 2;
      // the stack: a leg a landing, each `rise` over the last, at the far end and the near end in turn, to the summit
      const platforms = Array.from({ length: Ch.legs }, (_, k) => ({ y: base + Ch.rise * (k + 1), far: k % 2 === 0 }));
      const summit = base + Ch.rise * Ch.legs;
      // the exits: a twin either side with a room whose floor is a mantle off a near-end landing, the window in the
      // room's canyon wall `exit.inset` in from its corner at the chimney's near end
      const exits: Array<{ side: number; y: number; z: number; from: number }> = [];
      const winW = C.skyLobby.width;
      for (const s of [-1, 1]) {
        const face = c.x + s * (Ch.width / 2 + Ch.wall);
        const twin = towers.find((t) => Math.abs(t.x - s * (t.w / 2) - face) < 1.2 && c.z1 > t.z - t.d / 2 && c.z1 < t.z + t.d / 2 + 0.2);
        if (!twin) continue;
        for (const y of [twin.lobby, twin.park]) {
          if (y === undefined) continue;
          const from = platforms.find((q) => !q.far && y - q.y >= Ch.exit.below[0] && y - q.y <= Ch.exit.below[1]);
          if (!from) continue;
          const zc = Math.min(c.z1, twin.z + twin.d / 2) - C.skyLobby.wall - Ch.exit.inset - winW / 2;
          exits.push({ side: s, y, z: zc, from: from.y });
        }
      }
      for (const s of [-1, 1]) {
        const wx = c.x + s * (Ch.width / 2 + Ch.wall / 2);
        // the wall in bands up its height, each band's openings left out of it
        const holes = exits.filter((e) => e.side === s).map((e) => ({ y0: e.from, y1: e.y + C.skyLobby.height, z0: e.z - winW / 2, z1: e.z + winW / 2 }));
        const cuts = [base, ...holes.flatMap((h) => [h.y0, h.y1]), summit + 0.4].sort((a, b) => a - b);
        for (let k = 0; k + 1 < cuts.length; k++) {
          const [y0, y1] = [cuts[k], cuts[k + 1]];
          if (y1 - y0 < 0.01) continue;
          const open = holes.filter((h) => h.y0 < y1 - 0.01 && h.y1 > y0 + 0.01).sort((a, b) => a.z0 - b.z0);
          let from = c.z0;
          for (const h of open) {
            if (h.z0 > from) slab(Ch.wall, y1 - y0, h.z0 - from, wx, y0, (from + h.z0) / 2, concrete);
            from = h.z1;
          }
          if (c.z1 > from) slab(Ch.wall, y1 - y0, c.z1 - from, wx, y0, (from + c.z1) / 2, concrete);
        }
        // the chain line, on the inner face at a wall run's height over every leg's floor
        for (const y of [base, ...platforms.slice(0, -1).map((q) => q.y)]) deco(0.04, 0.12, len, c.x + s * (Ch.width / 2 + 0.02), y + 2.2, mid, lit);
      }
      // closed at the far end, so a chain that comes in high runs into the end and drops onto the landing
      // rather than flying out of the open end (the proof found exactly that)
      slab(Ch.width + Ch.wall * 2, summit + 0.4 - base, Ch.wall, c.x, base, c.z0 - Ch.wall / 2, concrete);
      // and closed above the landing at the near end, the way in staying open below it: the second leg comes in
      // high there too
      slab(Ch.width + Ch.wall * 2, summit + 0.4 - landing, Ch.wall, c.x, landing, c.z1 + Ch.wall / 2, concrete);
      // every landing, at its end
      for (const q of platforms) slab(Ch.width, 0.3, Ch.landing, c.x, q.y - 0.3, q.far ? c.z0 + Ch.landing / 2 : c.z1 - Ch.landing / 2, metal);
      CHIMNEYS.push({ name: c.name, x: c.x + BR_X, innerW: Ch.width, z0: c.z0 + BR_Z, z1: c.z1 + BR_Z, base, landing, top, summit, platforms, exits: exits.map((e) => ({ ...e, z: e.z + BR_Z })) });
    }
  }

  // ---------------------------------------------------------------- skybridges
  // between neighbouring towers of the core, across the street, at a floor both have
  const core = towers.filter((t) => Math.abs(t.x) < 110 && Math.abs(t.z) < 110 && t.storeys >= 6);
  const bridged = new Set<string>();
  for (const a of core) {
    for (const b of core) {
      if (a === b) continue;
      const key = [a, b].map((t) => `${t.x.toFixed(0)},${t.z.toFixed(0)}`).sort().join("|");
      if (bridged.has(key)) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const alongX = Math.abs(dx) > Math.abs(dz);
      // across one street, and lined up enough that a bridge runs square
      const gap = alongX ? Math.abs(dx) - (a.w + b.w) / 2 : Math.abs(dz) - (a.d + b.d) / 2;
      const off = alongX ? Math.abs(dz) : Math.abs(dx);
      if (gap < 8 || gap > 26 || off > 6) continue;
      bridged.add(key);
      const floors = Math.min(a.storeys, b.storeys);
      for (const f of C.bridgeFloors) {
        if (f >= floors) continue;
        const y = PAVE_H + f * storeyH;
        if (alongX) {
          const from = a.x + Math.sign(dx) * (a.w / 2);
          const to = b.x - Math.sign(dx) * (b.w / 2);
          const mid = (from + to) / 2;
          const z = (a.z + b.z) / 2;
          slab(Math.abs(to - from), 0.3, 3.2, mid, y - 0.3, z, metal);
          deco(Math.abs(to - from), 0.05, 0.05, mid, y + 1.05, z - 1.55, neon(0x20e0ff));
          deco(Math.abs(to - from), 0.05, 0.05, mid, y + 1.05, z + 1.55, neon(0x20e0ff));
          slab(Math.abs(to - from), 1.0, 0.08, mid, y, z - 1.6, trimDark);
          slab(Math.abs(to - from), 1.0, 0.08, mid, y, z + 1.6, trimDark);
        } else {
          const from = a.z + Math.sign(dz) * (a.d / 2);
          const to = b.z - Math.sign(dz) * (b.d / 2);
          const mid = (from + to) / 2;
          const x = (a.x + b.x) / 2;
          slab(3.2, 0.3, Math.abs(to - from), x, y - 0.3, mid, metal);
          deco(0.05, 0.05, Math.abs(to - from), x - 1.55, y + 1.05, mid, neon(0x20e0ff));
          deco(0.05, 0.05, Math.abs(to - from), x + 1.55, y + 1.05, mid, neon(0x20e0ff));
          slab(0.08, 1.0, Math.abs(to - from), x - 1.6, y, mid, trimDark);
          slab(0.08, 1.0, Math.abs(to - from), x + 1.6, y, mid, trimDark);
        }
      }
    }
  }

  // ---------------------------------------------------------------- the Sky Lobby's bridges and canyons
  // Between two lobby towers facing each other across a street (city.json skyLobby bridge), a bridge at the lobby's
  // floor from window to window, so a tower is a room you run through and out onto a bridge into the next (the brief's
  // "windows are doors"); across a canyon (skyLobby canyon), the two windows lined up, a jump from one lobby into the
  // other. Either way on a line where both faces have room for a window, the windows on it; the window pads (below)
  // leave those faces to them. The Sky Park's rooms (skyPark) are joined the same way at their own height.
  {
    const Lb = C.skyLobby;
    /** the deck at a room's floor from `from` to `to` along one axis at `c` across it, its rails and their neon, as a skybridge's */
    const bridgeDeck = (alongX: boolean, from: number, to: number, c: number, y: number): void => {
      const mid = (from + to) / 2;
      const len = Math.abs(to - from);
      const box = (along: number, h: number, across: number, at: number, yy: number, off: number, mat: THREE.Material, isSolid = true) =>
        alongX ? slab(along, h, across, at, yy, c + off, mat, isSolid) : slab(across, h, along, c + off, yy, at, mat, isSolid);
      box(len, 0.3, 3.2, mid, y - 0.3, 0, metal);
      for (const sd of [-1, 1]) {
        box(len, 1.0, 0.08, mid, y, sd * 1.6, trimDark);
        box(len, 0.05, 0.05, mid, y + 1.05, sd * 1.55, neon(0x20e0ff), false);
      }
    };
    /** a tower standing through the height `y` with its middle between a and b along the line and across it: it would cut a bridge */
    const cuts = (a: Tower, b: { x: number; z: number; w: number; d: number }, y: number, alongX: boolean): boolean =>
      towers.some(
        (t) =>
          t !== a &&
          (t.base ?? 0) < y + storeyH &&
          t.roof > y + 0.5 &&
          !(t.x === b.x && t.z === b.z && t.w === b.w) &&
          (alongX ? (t.x - a.x) * (t.x - b.x) < 0 && Math.abs(t.z - (a.z + b.z) / 2) < (t.d + Math.min(a.d, b.d)) / 2 : (t.z - a.z) * (t.z - b.z) < 0 && Math.abs(t.x - (a.x + b.x) / 2) < (t.w + Math.min(a.w, b.w)) / 2),
      );
    /** a window at `offset` from the middle of a tower's face, clear of its stair core */
    const freeAt = (t: Tower, key: Side4, offset: number): boolean => {
      const pos = (key === "n" || key === "s" ? t.x : t.z) + offset;
      return !(t.coreBlock ?? []).some((q) => q.face === key && pos + Lb.width / 2 > q.a && pos - Lb.width / 2 < q.b);
    };
    /** the offset nearest `want` within `room` either way where a window is clear of the core */
    const freeOffset = (t: Tower, key: Side4, want: number, room: number): number => {
      for (let k = 0; k <= 2 * room + 0.01; k += 0.5)
        for (const o of [want - k, want + k]) if (Math.abs(o) <= room + 1e-6 && freeAt(t, key, o)) return o;
      return want;
    };
    windowFree.at = freeAt;
    windowFree.offset = freeOffset;
    /** the rooms open at one height, joined */
    const join = (level: "lobby" | "park", maxGap: number, canyonGap: number, bridgesOut: typeof LOBBY_BRIDGES, canyonsOut: typeof LOBBY_CANYONS): void => {
      const yOf = (t: Tower): number | undefined => (level === "lobby" ? t.lobby : t.park);
      const lined = (t: Tower): Partial<Record<Side4, number>> => (level === "lobby" ? (t.bridges ??= {}) : (t.parkBridges ??= {}));
      const decked = (t: Tower): Set<string> => (level === "lobby" ? (t.decks ??= new Set()) : (t.parkDecks ??= new Set()));
      const lob = towers.filter((t) => yOf(t) !== undefined);
      const done = new Set<string>();
      bridgesOut.length = 0;
      canyonsOut.length = 0;
      for (const a of lob) {
        for (const b of lob) {
          if (a === b || yOf(a) !== yOf(b)) continue;
          const key = [a, b].map((t) => `${t.x.toFixed(0)},${t.z.toFixed(0)}`).sort().join("|");
          if (done.has(key)) continue;
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const alongX = Math.abs(dx) > Math.abs(dz);
          const gap = alongX ? Math.abs(dx) - (a.w + b.w) / 2 : Math.abs(dz) - (a.d + b.d) / 2;
          if (gap < 2 || gap > maxGap) continue;
          const canyon = gap <= canyonGap;
          // a chimney between the two with an exit at this height: the windows go on it
          const exit = alongX
            ? CHIMNEYS.flatMap((ch) => ch.exits.map((e) => ({ x: ch.x - BR_X, ...e }))).find((e) => Math.abs(e.y - (yOf(a) ?? NaN)) < 0.05 && (e.x - a.x) * (e.x - b.x) < 0 && [a, b].every((t) => Math.abs(e.z - BR_Z - t.z) < t.d / 2 - Lb.wall))
            : undefined;
          const y = yOf(a)!;
          // no third tower standing through this height between the two
          if (cuts(a, b, y, alongX)) continue;
          // a window's room along each face: an x bridge meets the west and east faces, which run along z between
          // the north and south walls; a z bridge meets the north and south, the tower's width
          const room = (t: Tower) => (alongX ? t.d - 2 * Lb.wall : t.w) / 2 - Lb.width / 2 - Lb.corner;
          const ca = alongX ? a.z : a.x;
          const cb = alongX ? b.z : b.x;
          const lo = Math.max(ca - room(a), cb - room(b));
          const hi = Math.min(ca + room(a), cb + room(b));
          if (lo > hi && !exit) continue;
          const fa = alongX ? (dx > 0 ? "e" : "w") : dz > 0 ? "s" : "n";
          const fb = alongX ? (dx > 0 ? "w" : "e") : dz > 0 ? "n" : "s";
          // the line: the chimney's exit, or the middle of the room both faces have, slid along it clear of both towers'
          // stair cores (a window onto a core opens onto its flight down)
          let c = exit ? exit.z - BR_Z : NaN;
          if (!exit)
            for (let k = 0; k <= hi - lo + 0.01 && Number.isNaN(c); k += 0.5)
              for (const q of [(lo + hi) / 2 - k, (lo + hi) / 2 + k]) if (q >= lo - 1e-6 && q <= hi + 1e-6 && freeAt(a, fa, q - ca) && freeAt(b, fb, q - cb)) c = q;
          if (Number.isNaN(c)) continue;
          done.add(key);
          lined(a)[fa] = c - ca;
          lined(b)[fb] = c - cb;
          // a bridge's faces carry its deck; a canyon's keep a pad in line with the window, when there is room for one
          if (!canyon) for (const [t, f] of [[a, fa], [b, fb]] as const) decked(t).add(f);
          if (canyon) {
            canyonsOut.push(alongX ? { ax: a.x + Math.sign(dx) * (a.w / 2) + BR_X, az: c + BR_Z, bx: b.x - Math.sign(dx) * (b.w / 2) + BR_X, bz: c + BR_Z, y } : { ax: c + BR_X, az: a.z + Math.sign(dz) * (a.d / 2) + BR_Z, bx: c + BR_X, bz: b.z - Math.sign(dz) * (b.d / 2) + BR_Z, y });
            continue;
          }
          const from = alongX ? a.x + Math.sign(dx) * (a.w / 2) : a.z + Math.sign(dz) * (a.d / 2);
          const to = alongX ? b.x - Math.sign(dx) * (b.w / 2) : b.z - Math.sign(dz) * (b.d / 2);
          bridgeDeck(alongX, from, to, c, y);
          bridgesOut.push(alongX ? { ax: from + BR_X, az: c + BR_Z, bx: to + BR_X, bz: c + BR_Z, y } : { ax: c + BR_X, az: from + BR_Z, bx: c + BR_X, bz: to + BR_Z, y });
        }
      }
    };
    join("lobby", Lb.bridge, Lb.canyon, LOBBY_BRIDGES, LOBBY_CANYONS);
    const Pk = C.skyPark;
    join("park", Pk.bridge, Pk.canyon, PARK_BRIDGES, PARK_CANYONS);

    // the Sky Park's bridges onto the Spire's terrace: from every room facing it across a street, the line clear of
    // the terrace's corners and of any pad's throw, the terrace's parapet opened where each lands
    const deck = spireDeck.terrace;
    if (deck) {
      const gaps: Array<{ side: Side4; at: number; width: number }> = [];
      const padTop = (q: BrMap["pads"][number]): number => q.over ?? (q.y ?? 0) + ((q.up ?? 0) * (q.up ?? 0)) / (2 * MOVE.gravity);
      for (const a of towers.filter((t) => t.park !== undefined && Math.abs(t.park - deck.y) < 0.05)) {
        const dx = deck.x - a.x;
        const dz = deck.z - a.z;
        const alongX = Math.abs(dx) > Math.abs(dz);
        const gap = alongX ? Math.abs(dx) - (a.w + deck.w) / 2 : Math.abs(dz) - (a.d + deck.d) / 2;
        if (gap < 2 || gap > Pk.bridge) continue;
        const fa: Side4 = alongX ? (dx > 0 ? "e" : "w") : dz > 0 ? "s" : "n";
        // that face's window is already another join's
        if (a.parkBridges?.[fa] !== undefined) continue;
        const roomA = (alongX ? a.d - 2 * Lb.wall : a.w) / 2 - Lb.width / 2 - Lb.corner;
        const roomD = (alongX ? deck.d : deck.w) / 2 - Pk.landing;
        const ca = alongX ? a.z : a.x;
        const cd = alongX ? deck.z : deck.x;
        const lo = Math.max(ca - roomA, cd - roomD);
        const hi = Math.min(ca + roomA, cd + roomD);
        if (lo > hi) continue;
        const c = (lo + hi) / 2;
        if (cuts(a, deck, deck.y, alongX)) continue;
        const from = alongX ? a.x + Math.sign(dx) * (a.w / 2) : a.z + Math.sign(dz) * (a.d / 2);
        const to = alongX ? deck.x - Math.sign(dx) * (deck.w / 2) : deck.z - Math.sign(dz) * (deck.d / 2);
        // nothing a pad throws up through: its column, 2.5 m round, reaching the deck
        const [x0, x1] = alongX ? [Math.min(from, to), Math.max(from, to)] : [c - 1.6, c + 1.6];
        const [z0, z1] = alongX ? [c - 1.6, c + 1.6] : [Math.min(from, to), Math.max(from, to)];
        if (pads.some((q) => q.x - BR_X > x0 - 2.5 && q.x - BR_X < x1 + 2.5 && q.z - BR_Z > z0 - 2.5 && q.z - BR_Z < z1 + 2.5 && padTop(q) > deck.y - 2)) continue;
        (a.parkBridges ??= {})[fa] = c - ca;
        (a.parkDecks ??= new Set()).add(fa);
        bridgeDeck(alongX, from, to, c, deck.y);
        PARK_BRIDGES.push(alongX ? { ax: from + BR_X, az: c + BR_Z, bx: to + BR_X, bz: c + BR_Z, y: deck.y } : { ax: c + BR_X, az: from + BR_Z, bx: c + BR_X, bz: to + BR_Z, y: deck.y });
        const fd: Side4 = alongX ? (dx > 0 ? "w" : "e") : dz > 0 ? "n" : "s";
        gaps.push({ side: fd, at: c, width: Pk.gap });
      }
      roofEdge(deck.x, deck.z, deck.w, deck.d, deck.y, deck.k, gaps);
    }
    // the open floors' rooms (skyLobby floors): a window in the middle of every face, no ring
    /** a room's window on each face: where a join put it, or the middle, clear of the tower's stair core */
    const roomWindows = (t: Tower, joined: Partial<Record<Side4, number>>) => {
      const o = (key: Side4) => joined[key] ?? freeOffset(t, key, 0, (key === "n" || key === "s" ? t.w : t.d - 2 * Lb.wall) / 2 - Lb.width / 2 - Lb.corner);
      return { n: o("n"), s: o("s"), w: o("w"), e: o("e") };
    };
    for (const t of towers) for (const y of t.floors ?? []) if (t.lobbyMat) skyLobby(t.x, t.z, t.w, t.d, y, t.lobbyMat, roomWindows(t, {}), new Set(), false);
    // the Sky Park's rooms: a window where a join lands, and in the middle of every other face, a way out to drop from
    for (const t of towers) {
      if (t.park === undefined || !t.lobbyMat) continue;
      const pb = t.parkBridges ?? {};
      skyLobby(t.x, t.z, t.w, t.d, t.park, t.lobbyMat, roomWindows(t, pb), new Set());
    }
  }

  // ---------------------------------------------------------------- ziplines, roof to roof
  const tall = [...towers].sort((a, b) => b.roof - a.roof).slice(0, C.ziplines * 2);
  for (let i = 0; i + 1 < tall.length; i += 2) {
    const a = tall[i];
    const b = tall[i + 1];
    const A = new THREE.Vector3(a.x, a.roof + 2.13 + 0.4, a.z);
    const B = new THREE.Vector3(b.x, b.roof + 2.13 + 0.4, b.z);
    if (A.distanceTo(B) < 25 || A.distanceTo(B) > 180) continue;
    zipline(root, A, B, a.roof, b.roof);
  }

  // ---------------------------------------------------------------- streetlights
  const lamp = neon(0xe8f6ff);
  const lampAt: Array<[number, number]> = [];
  for (const sx of LANES) {
    for (const sz of LANES) {
      for (const [ox, oz] of [
        [-6.4, -6.4],
        [6.4, 6.4],
      ] as const) {
        slab(0.25, 6, 0.25, sx + ox, 0, sz + oz, metal);
        deco(1.4, 0.12, 0.3, sx + ox, 6, sz + oz, lamp);
        lampAt.push([sx + ox, sz + oz]);
        KIT_SITES.lamps.push([sx + ox, sz + oz]);
      }
    }
  }
  // the light each throws on the road (city.json lampPools), one instanced mesh for all of them
  {
    const pool = new THREE.InstancedMesh(
      new THREE.CircleGeometry(C.lampPools.radius, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: C.lampPools.opacity, blending: THREE.AdditiveBlending, depthWrite: false }),
      lampAt.length,
    );
    const m4 = new THREE.Matrix4();
    lampAt.forEach(([x, z], i) => pool.setMatrixAt(i, m4.makeTranslation(x, 0.04, z)));
    pool.renderOrder = 1;
    root.add(pool);
  }

  // ---------------------------------------------------------------- the skyline
  // outside the play area, never reached: a city that goes on past the edge
  const skyMats = [...night, glass];
  for (let i = 0; i < C.skyline.count; i++) {
    const a = (i / C.skyline.count) * Math.PI * 2 + rnd() * 0.08;
    const r = C.skyline.from + rnd() * (C.skyline.to - C.skyline.from);
    const h = 30 + rnd() * C.skyline.tallest;
    const w = 18 + rnd() * 26;
    // out past the edge's wall (Phase 20 A4: towers stood over the edge, and a player can now walk out to the
    // wall), along the same ray, so every draw from the city's one random stream stays as it was
    const k = Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
    const r2 = Math.max(r, (BR_HALF + C.edge.margin + C.skyline.clear + (w * Math.SQRT2) / 2) / k);
    deco(w, h, w, Math.cos(a) * r2, 0, Math.sin(a) * r2, skyMats[i % skyMats.length]).name = "skyline";
    KIT_SITES.skyline.push({ x: Math.cos(a) * r2, z: Math.sin(a) * r2, w, h });
    if (rnd() < 0.5) deco(0.3, h, 0.3, Math.cos(a) * r2 - w / 2, 0, Math.sin(a) * r2 - w / 2, neon(SECTORS[i % SECTORS.length].accent));
  }
  // holo glyphs hanging over it in the districts' colours (city.json skyline.glyphs): the city glows to the horizon
  {
    const shapes = [new THREE.TorusGeometry(16, 0.7, 6, 48), new THREE.OctahedronGeometry(13, 0), new THREE.TorusKnotGeometry(10, 0.6, 72, 6)];
    const wire = new Map<number, THREE.MeshBasicMaterial>();
    for (let i = 0; i < C.skyline.glyphs; i++) {
      const col = SECTORS[1 + (i % (SECTORS.length - 1))].accent;
      let mat = wire.get(col);
      if (!mat) wire.set(col, (mat = new THREE.MeshBasicMaterial({ color: col, wireframe: i % 3 === 1, toneMapped: false })));
      const a = (i / C.skyline.glyphs) * Math.PI * 2 + 0.26;
      const r = C.skyline.from + 30 + rnd() * (C.skyline.to - C.skyline.from);
      const g = new THREE.Mesh(shapes[i % shapes.length], mat);
      g.position.set(Math.cos(a) * r, C.skyline.glyphHeight * (1 + rnd() * 0.5), Math.sin(a) * r);
      g.rotation.set(rnd() * Math.PI, rnd() * Math.PI, 0);
      root.add(g);
    }
  }

  // ---------------------------------------------------------------- the ground past the edge
  // a dark plain under the skyline, so the towers past the edge stand on something
  const FS = C.skyline.to * 2.4;
  const farShape = new THREE.Shape([new THREE.Vector2(-FS / 2, -FS / 2), new THREE.Vector2(FS / 2, -FS / 2), new THREE.Vector2(FS / 2, FS / 2), new THREE.Vector2(-FS / 2, FS / 2)]);
  // the map's own square left out: the street's plane covers it, and under it a stairwell looks down into the metro
  farShape.holes.push(new THREE.Path([new THREE.Vector2(-GS / 2 + 1, -GS / 2 + 1), new THREE.Vector2(-GS / 2 + 1, GS / 2 - 1), new THREE.Vector2(GS / 2 - 1, GS / 2 - 1), new THREE.Vector2(GS / 2 - 1, -GS / 2 + 1)]));
  const far = new THREE.Mesh(new THREE.ShapeGeometry(farShape), flat(0x07080c, 0.95, 0));
  far.rotation.x = -Math.PI / 2;
  far.position.y = -0.05;
  root.add(far);

  // ---------------------------------------------------------------- holo signs
  // billboards on the towers, in our own made-up brands (some the owner's
  // friends'), each lit in its district's colour: the thing a neon city is
  // recognised by. A canvas per brand, drawn once; no collision.
  if (typeof document !== "undefined") {
    const signMat = new Map<string, THREE.Material>();
    const signOf = (text: string, color: number): THREE.Material => {
      const key = `${text}:${color}`;
      let m = signMat.get(key);
      if (m) return m;
      const cv = document.createElement("canvas");
      cv.width = 512;
      cv.height = 192;
      const g = cv.getContext("2d");
      const hex = `#${color.toString(16).padStart(6, "0")}`;
      if (g) {
        g.fillStyle = "#05060a";
        g.fillRect(0, 0, 512, 192);
        g.strokeStyle = hex;
        g.lineWidth = 10;
        g.strokeRect(8, 8, 496, 176);
        g.fillStyle = hex;
        g.font = "700 88px Rajdhani, Segoe UI, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(text, 256, 100, 470);
      }
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: C.signGlow, roughness: 1, metalness: 0 });
      signMat.set(key, m);
      return m;
    };
    const plane = new THREE.PlaneGeometry(C.sign.w, C.sign.h);
    const centreSigns: THREE.Mesh[] = [];
    for (const t of towers) {
      if (t.storeys < C.sign.minStoreys) continue;
      const sec = SECTORS.find((s) => s.id === t.sector)!;
      const n = t.storeys >= 12 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const side = Math.floor(rnd() * 4);
        const y = PAVE_H + (2 + Math.floor(rnd() * (t.storeys - 3))) * storeyH + 1.5;
        const text = C.brands[Math.floor(rnd() * C.brands.length)];
        const m = new THREE.Mesh(plane, signOf(text, sec.accent));
        const out = 0.35;
        if (side === 0) m.position.set(t.x, y, t.z - t.d / 2 - out);
        else if (side === 1) m.position.set(t.x, y, t.z + t.d / 2 + out);
        else if (side === 2) m.position.set(t.x - t.w / 2 - out, y, t.z);
        else m.position.set(t.x + t.w / 2 + out, y, t.z);
        m.rotation.y = side === 0 ? Math.PI : side === 1 ? 0 : side === 2 ? -Math.PI / 2 : Math.PI / 2;
        root.add(m);
        if (Math.abs(t.x) <= kitCfg.dress.centre && Math.abs(t.z) <= kitCfg.dress.centre) centreSigns.push(m);
      }
    }
    // a few of the centre's flicker (city.json flicker), chosen from a stream of their own so the city's draws the
    // same numbers; each gets its own material, since a brand's is shared by every sign of it
    const pick = seeded(C.seed ^ 0xf11c);
    for (const { m } of centreSigns.map((m) => ({ m, o: pick() })).sort((a, b) => a.o - b.o).slice(0, C.flicker.signs)) {
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      m.material = mat;
      FLICKER_SIGNS.push({ material: mat, base: mat.emissiveIntensity, seed: Math.round(m.position.x * 97 + m.position.z * 13 + m.position.y) });
    }
  }

  // ---------------------------------------------------------------- warning lights on the tallest roofs
  const red = neon(0xff2030);
  for (const t of [...towers].sort((a, b) => b.roof - a.roof).slice(0, C.beaconLights)) {
    deco(0.25, 3.5, 0.25, t.x, t.roof, t.z, metal);
    deco(0.5, 0.5, 0.5, t.x, t.roof + 3.5, t.z, red);
  }

  // ---------------------------------------------------------------- the sectors' edges on the ground
  // a line of light where one sector meets the next, so the decay's waves are
  // plain on the ground as well as on the map
  // (never across a district of a pack's demo scene: it ran over its canyons' floor and into its buildings)
  const edgeLine = (x0: number, z0: number, x1: number, z1: number, k: THREE.Material): void => {
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.5);
    const at = (i: number) => [x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n];
    const out = (i: number) => !inDistrict(...(at(i + 0.5) as [number, number]));
    for (let i = 0; i < n; ) {
      if (!out(i)) {
        i++;
        continue;
      }
      let j = i;
      while (j < n && out(j)) j++;
      const [[ax, az], [bx, bz]] = [at(i), at(j)];
      deco(Math.max(0.3, bx - ax), 0.03, Math.max(0.3, bz - az), (ax + bx) / 2, 0.02, (az + bz) / 2, k);
      i = j;
    }
  };
  for (const s of SECTORS) {
    const k = neon(s.accent);
    edgeLine(s.minX, s.minZ + 0.15, s.maxX, s.minZ + 0.15, k);
    edgeLine(s.minX + 0.15, s.minZ, s.minX + 0.15, s.maxZ, k);
  }

  // ---------------------------------------------------------------- the edge's fence (city.json edge; Phase 20 A4)
  // Lit lines climbing a red fence on all four sides, posts along it and a strip on the ground: the city's edge,
  // plain in the world and not only on the minimap. Past it a countdown runs (edge.ts). Its materials opt out of
  // the decay (userData.decay): the edge sectors dissolving would take the fence with them.
  {
    const F = C.edge.fence;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const g = canvas.getContext("2d");
    if (g) {
      g.clearRect(0, 0, 256, 256);
      g.fillStyle = "rgba(255,255,255,0.9)";
      for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 256, 3);
      const foot = g.createLinearGradient(0, 256, 0, 180);
      foot.addColorStop(0, "rgba(255,255,255,0.9)");
      foot.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = foot;
      g.fillRect(0, 180, 256, 76);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set((BR_HALF * 2) / 8, F.height / 8);
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(F.color), transparent: true, opacity: F.opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, forceSinglePass: true });
    mat.userData.decay = true;
    for (const [x, z, turn] of [
      [0, -BR_HALF, false],
      [0, BR_HALF, false],
      [-BR_HALF, 0, true],
      [BR_HALF, 0, true],
    ] as const) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(BR_HALF * 2, F.height), mat);
      m.position.set(x, F.height / 2, z);
      if (turn) m.rotation.y = Math.PI / 2;
      m.name = "edgeFence";
      m.userData.dynamic = true;
      root.add(m);
    }
    const postMat = emissive(parseInt(F.color.slice(1), 16), C.neonGlow);
    postMat.userData.decay = true;
    const per = Math.round((BR_HALF * 2) / F.postGap);
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, F.height, 0.3), postMat, per * 4);
    const m4 = new THREE.Matrix4();
    let n = 0;
    for (let i = 0; i < per; i++) {
      const t = -BR_HALF + i * F.postGap;
      for (const [x, z] of [
        [t, -BR_HALF],
        [BR_HALF, t],
        [-t, BR_HALF],
        [-BR_HALF, -t],
      ] as const) posts.setMatrixAt(n++, m4.makeTranslation(x, F.height / 2, z));
    }
    posts.name = "edgePosts";
    root.add(posts);
    for (const [w, d, x, z] of [
      [BR_HALF * 2, 0.5, 0, -BR_HALF],
      [BR_HALF * 2, 0.5, 0, BR_HALF],
      [0.5, BR_HALF * 2, -BR_HALF, 0],
      [0.5, BR_HALF * 2, BR_HALF, 0],
    ] as const) deco(w, 0.04, d, x, 0.03, z, postMat);
    FENCE = { mat, tex, base: F.opacity };
  }

  // ---------------------------------------------------------------- the ring's wall (the legacy ring's, until the decay replaces it)
  const ringWall = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 120, 96, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff2e9a, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true })
  );
  ringWall.position.y = 60;
  ringWall.userData.dynamic = true;
  ringWall.frustumCulled = false;
  root.add(ringWall);
  root.updateMatrixWorld(true);

  // ---------------------------------------------------------------- the metro (city.json metro)
  // The loop under the centre's streets: the one floor in the city below the street (range.ts FLOORS). The street over
  // it is a solid slab drawn only from underneath, so the street's own plane stays the one surface on top and nothing
  // flickers against it.
  {
    const y0 = Mt.floor;
    const ceil = -Mt.slab;
    const wl = Mt.wall;
    const tile = neon(0x20e0ff);
    const warm = emissive(0xfff0d2, 2.2);
    // a train's lit inside through its windows: dimmer than a pad's window frame, which is meant to be seen from afar
    const carLight = emissive(0x7fb4d8, 0.9);
    METRO.floor = y0;
    METRO.sides.length = 0;
    METRO.stairs.length = 0;
    /** a rectangle less the openings inside it, as rectangles */
    const less = (r: { x0: number; x1: number; z0: number; z1: number }): Array<{ x0: number; x1: number; z0: number; z1: number }> => {
      let parts = [r];
      for (const { box: o } of mStairs) {
        parts = parts.flatMap((q) => {
          if (o.x1 <= q.x0 || o.x0 >= q.x1 || o.z1 <= q.z0 || o.z0 >= q.z1) return [q];
          const out: Array<{ x0: number; x1: number; z0: number; z1: number }> = [];
          if (o.x0 > q.x0) out.push({ x0: q.x0, x1: o.x0, z0: q.z0, z1: q.z1 });
          if (o.x1 < q.x1) out.push({ x0: o.x1, x1: q.x1, z0: q.z0, z1: q.z1 });
          const mx0 = Math.max(q.x0, o.x0);
          const mx1 = Math.min(q.x1, o.x1);
          if (o.z0 > q.z0) out.push({ x0: mx0, x1: mx1, z0: q.z0, z1: o.z0 });
          if (o.z1 < q.z1) out.push({ x0: mx0, x1: mx1, z0: o.z1, z1: q.z1 });
          return out;
        });
      }
      return parts;
    };
    for (const sd of mSides) {
      const r = sd.alongX ? { x0: sd.a, x1: sd.b, z0: sd.line - mHalf, z1: sd.line + mHalf } : { x0: sd.line - mHalf, x1: sd.line + mHalf, z0: sd.a, z1: sd.b };
      FLOORS.push({ minX: r.x0 + BR_X, maxX: r.x1 + BR_X, minZ: r.z0 + BR_Z, maxZ: r.z1 + BR_Z, y: y0 });
      METRO.sides.push({ minX: r.x0 + BR_X, maxX: r.x1 + BR_X, minZ: r.z0 + BR_Z, maxZ: r.z1 + BR_Z, alongX: sd.alongX });
      const cx = (r.x0 + r.x1) / 2;
      const cz = (r.z0 + r.z1) / 2;
      // the street over it: collision, and its underside the tunnel's ceiling
      for (const q of less(r)) {
        solid(q.x0, q.x1, q.z0, q.z1, ceil, 0);
        deco(q.x1 - q.x0, 0.05, q.z1 - q.z0, (q.x0 + q.x1) / 2, ceil - 0.05, (q.z0 + q.z1) / 2, concrete);
      }
      // the floor you run on
      deco(r.x1 - r.x0, 0.1, r.z1 - r.z0, cx, y0 - 0.1, cz, pave);
      // the track down its middle, and the lights in the ceiling over it
      const len = sd.b - sd.a;
      for (const e of [-0.75, 0.75]) {
        if (sd.alongX) deco(len, 0.1, 0.08, cx, y0, sd.line + e, metal);
        else deco(0.08, 0.1, len, sd.line + e, y0, cz, metal);
      }
      for (let u = sd.a + Mt.lightEvery / 2; u < sd.b; u += Mt.lightEvery) {
        if (sd.alongX) deco(1.6, 0.06, 0.35, u, ceil - 0.11, sd.line, warm);
        else deco(0.35, 0.06, 1.6, sd.line, ceil - 0.11, u, warm);
      }
      // a parked train on the inner lane: cover, too tall to stand on under the roof
      const T = Mt.train;
      const tAcross = sd.line - sd.out * T.lane;
      const total = T.cars * T.length + (T.cars - 1) * T.gap;
      const mid = (sd.a + sd.b) / 2;
      for (let k = 0; k < T.cars; k++) {
        const u = mid - total / 2 + T.length / 2 + k * (T.length + T.gap);
        const put = (along: number, h: number, acr: number, yy: number, off: number, mat: THREE.Material, isSolid = true) =>
          sd.alongX ? slab(along, h, acr, u, yy, tAcross + off, mat, isSolid) : slab(acr, h, along, tAcross + off, yy, u, mat, isSolid);
        put(T.length, T.height, T.width, y0, 0, metal);
        // its windows lit down both sides, and a line of the centre's colour under them
        for (const sgn of [-1, 1]) {
          put(T.length - 1.2, 0.9, 0.04, y0 + 1.5, sgn * (T.width / 2 + 0.02), carLight, false);
          put(T.length, 0.08, 0.04, y0 + 1.1, sgn * (T.width / 2 + 0.02), tile, false);
        }
      }
    }
    // the walls round the ring, outside and in, floor to ceiling; and a line of light along them at a wall run's height
    const outer = mHi + mHalf;
    const inner = mHi - mHalf;
    for (const sg of [-1, 1]) {
      slab(2 * outer + 2 * wl, ceil - y0, wl, 0, y0, sg * (outer + wl / 2), concrete);
      slab(wl, ceil - y0, 2 * outer, sg * (outer + wl / 2), y0, 0, concrete);
      slab(2 * inner, ceil - y0, wl, 0, y0, sg * (inner - wl / 2), concrete);
      slab(wl, ceil - y0, 2 * inner - 2 * wl, sg * (inner - wl / 2), y0, 0, concrete);
      deco(2 * outer, 0.08, 0.04, 0, y0 + 2.2, sg * (outer - 0.02), tile);
      deco(0.04, 0.08, 2 * outer, sg * (outer - 0.02), y0 + 2.2, 0, tile);
      deco(2 * inner, 0.08, 0.04, 0, y0 + 2.2, sg * (inner + 0.02), tile);
      deco(0.04, 0.08, 2 * inner, sg * (inner + 0.02), y0 + 2.2, 0, tile);
    }
    // the stairs: the concourse's rise and run, down from the street's lane to the tunnel's floor
    const SR = C.concourse.stairRun;
    const rise = -y0 / mRun;
    for (const st of mStairs) {
      const along = st.sd.alongX;
      const dir = Math.sign(st.top - st.foot);
      for (let i = 0; i < mRun; i++) {
        const u = st.foot + dir * (i + 0.5) * SR;
        const h = (i + 1) * rise;
        if (along) slab(SR, h, Mt.stairWidth, u, y0, st.across, concrete);
        else slab(Mt.stairWidth, h, SR, st.across, y0, u, concrete);
      }
      // railed at the street on its long sides and over its foot, open at its top; the slab's cut edge faced
      const o = st.box;
      const rl = Mt.rail;
      const hw = Mt.stairWidth / 2;
      for (const sg of [-1, 1]) {
        if (along) {
          slab(mLen, rl, 0.1, (o.x0 + o.x1) / 2, 0, st.across + sg * (hw + 0.05), trimDark);
          deco(mLen, 0.06, 0.06, (o.x0 + o.x1) / 2, rl, st.across + sg * (hw + 0.05), tile);
          deco(mLen, Mt.slab, 0.04, (o.x0 + o.x1) / 2, ceil, st.across + sg * (hw - 0.02), concrete);
        } else {
          slab(0.1, rl, mLen, st.across + sg * (hw + 0.05), 0, (o.z0 + o.z1) / 2, trimDark);
          deco(0.06, 0.06, mLen, st.across + sg * (hw + 0.05), rl, (o.z0 + o.z1) / 2, tile);
          deco(0.04, Mt.slab, mLen, st.across + sg * (hw - 0.02), ceil, (o.z0 + o.z1) / 2, concrete);
        }
      }
      if (along) {
        slab(0.1, rl, Mt.stairWidth + 0.2, st.foot - dir * 0.05, 0, st.across, trimDark);
        deco(0.04, Mt.slab, Mt.stairWidth, st.foot + dir * 0.02, ceil, st.across, concrete);
      } else {
        slab(Mt.stairWidth + 0.2, rl, 0.1, st.across, 0, st.foot - dir * 0.05, trimDark);
        deco(Mt.stairWidth, Mt.slab, 0.04, st.across, ceil, st.foot + dir * 0.02, concrete);
      }
      // a light over its mouth, to read from the street as the way down
      if (along) deco(0.3, 0.08, Mt.stairWidth, st.top, rl + 1.6, st.across, tile);
      else deco(Mt.stairWidth, 0.08, 0.3, st.across, rl + 1.6, st.top, tile);
      const w = (u: number) => (along ? { x: u + BR_X, z: st.across + BR_Z } : { x: st.across + BR_X, z: u + BR_Z });
      METRO.stairs.push({ top: w(st.top + dir * 0.6), foot: w(st.foot - dir * 1.5), x0: o.x0 + BR_X, x1: o.x1 + BR_X, z0: o.z0 + BR_Z, z1: o.z1 + BR_Z });
    }
  }

  // ---------------------------------------------------------------- Neon Alley's stalls (city.json neonAlley)
  // Solid, so a stand you see is cover you can use: on the pavement of the Spire's block along the alley's street, each
  // a dark kiosk with a line of the centre's colour, the kit's food stand over it
  {
    const Na = C.neonAlley;
    const line = STREETS[Na.street];
    // the Spire's block's edge on the alley's side, and the way from it out to the street
    const toward = Math.sign(line);
    const edge = BLOCKS.find(([a, b]) => a < 0 && b > 0)!;
    const kerb = toward < 0 ? edge[0] : edge[1];
    const [sw, sd, sh] = Na.stall;
    // their own materials, so the kit can hide these alone: flat() and emissive() hand out one material a colour, and
    // hiding theirs hid every parapet in the city and every cyan neon in the centre (Milestone 260 shipped it so)
    const body = flat(0x0c0e14, 0.6, 0.4).clone();
    const k = emissive(0x20e0ff, C.neonGlow).clone();
    STAND_INS.stalls = [body, k];
    for (const u of Na.stalls) {
      const z = kerb - toward * (Na.back + sd / 2);
      slab(sw, sh, sd, u, PAVE_H, z, body);
      deco(sw + 0.04, 0.08, 0.04, u, PAVE_H + 1.1, z + toward * (sd / 2 + 0.02), k);
      KIT_SITES.stalls.push({ x: u, z, w: sw, d: sd, h: sh, yaw: toward < 0 ? Math.PI : 0 });
    }
  }

  // ---------------------------------------------------------------- street life (city.json streetLife)
  // Parked cars along every stretch of kerb, cover at street level, lit front and back; zebra crossings at the
  // junctions. Placed after every jump pad, which they keep clear of, and never in the street's middle, the
  // bots' way; and before the graph, whose links are each walked past them.
  {
    const L = C.streetLife;
    const bodies = L.colours.map((c) => flat(parseInt(c.slice(1), 16), 0.35, 0.55));
    const glassDark = flat(0x0a0d14, 0.15, 0.8);
    const head = neon(0xf2f4ff);
    const tail = neon(0xff2a2a);
    const nearPad = (x: number, z: number): boolean => pads.some((p) => Math.hypot(p.x - BR_X - x, p.z - BR_Z - z) < L.padClear);
    const [cl, cw, ch] = L.car;
    const [kl, kw, kh] = L.cabin;
    // the centre's cars in materials of their own, which the kit hides once it has drawn a van over every one (city
    // STAND_INS): flat() and emissive() share a material a colour, so the city's own would take the rest with them
    const inCentre = (x: number, z: number) => sectorAt(x, z)?.id === "c";
    const own = { bodies: bodies.map((m) => m.clone()), glass: glassDark.clone(), sill: trimDark.clone(), head: head.clone(), tail: tail.clone() };
    STAND_INS.cars = [...own.bodies, own.glass, own.sill, own.head, own.tail];
    const car = (x: number, z: number, alongX: boolean, facing: number): void => {
      const pick = Math.floor(rnd() * bodies.length);
      const c = inCentre(x, z);
      if (c) KIT_SITES.cars.push({ x, z, alongX, facing });
      const body = c ? own.bodies[pick] : bodies[pick];
      const [w, d] = alongX ? [cl, cw] : [cw, cl];
      slab(w, ch, d, x, 0.25, z, body);
      slab(alongX ? kl : kw, kh, alongX ? kw : kl, x - (alongX ? facing * 0.3 : 0), 0.25 + ch, z - (alongX ? 0 : facing * 0.3), c ? own.glass : glassDark);
      // wheels' shadow under it: the body stands on its own dark sill
      deco(w - 0.6, 0.25, d - 0.2, x, 0, z, c ? own.sill : trimDark);
      for (const [end, mat] of [
        [1, c ? own.head : head],
        [-1, c ? own.tail : tail],
      ] as const) {
        const e = end * facing;
        if (alongX) deco(0.06, 0.18, cw - 0.5, x + (e * cl) / 2, 0.25 + ch * 0.55, z, mat);
        else deco(cw - 0.5, 0.18, 0.06, x, 0.25 + ch * 0.55, z + (e * cl) / 2, mat);
      }
    };
    for (const s of STREETS) {
      for (const [b0, b1] of BLOCKS) {
        for (const lane of [-1, 1]) {
          for (const alongX of [true, false]) {
            if (rnd() >= L.carChance) continue;
            const a = b0 + 4 + cl / 2 + rnd() * (b1 - b0 - 8 - cl);
            const [x, z] = alongX ? [a, s + lane * L.lane] : [s + lane * L.lane, a];
            // none past the map's edge (city.json cut), the draws spent all the same
            if (Math.abs(x) > BR_HALF - cl || Math.abs(z) > BR_HALF - cl) continue;
            // none on a district of a pack's demo scene, its colour drawn all the same (and first: its own pads are there)
            if (inDistrict(x, z)) {
              rnd();
              continue;
            }
            // and clear of a door's way in from the street: the bots cross the lane to it (sk-roofs walks it)
            if (nearPad(x, z) || DOORWAYS.some((dw) => (alongX ? Math.abs(dw.x - x) < cl / 2 + 3 && Math.abs(dw.z - z) < 14 : Math.abs(dw.z - z) < cl / 2 + 3 && Math.abs(dw.x - x) < 14))) continue;
            // over a metro stairwell: no car, its colour drawn all the same, so everything drawn after it is as it was
            const [hl, hc] = [cl / 2, cw / 2];
            if (alongX ? overStairwell(x - hl, x + hl, z - hc, z + hc) : overStairwell(x - hc, x + hc, z - hl, z + hl)) {
              rnd();
              continue;
            }
            // and off a stairwell's way in: the walk down starts on the street at its top (sk-metro found a car there once
            // the cut moved them)
            if (mStairs.some(({ box: o }) => x > o.x0 - 4 && x < o.x1 + 4 && z > o.z0 - 4 && z < o.z1 + 4)) continue;
            car(x, z, alongX, lane);
          }
        }
      }
    }
    // Zebra crossings on a junction's four sides, stripes lengthwise with the traffic. One instanced mesh of flat
    // quads: as 864 boxes they were 10k of the city's triangles (city-budget.ts), for paint on a road.
    const stripes: Array<[number, number, boolean]> = [];
    for (const sx of LANES) {
      for (const sz of LANES) {
        for (const e of [-1, 1]) {
          for (let k = 0; k < L.stripes; k++) {
            const across = -5.5 + (k * 11) / (L.stripes - 1);
            stripes.push([sx + e * 9, sz + across, true], [sx + across, sz + e * 9, false]);
          }
        }
      }
    }
    const zebra = new THREE.InstancedMesh(new THREE.PlaneGeometry(3, 0.7).rotateX(-Math.PI / 2), flat(0xd8dce4, 0.8, 0.0), stripes.length);
    const m4 = new THREE.Matrix4();
    const turn = new THREE.Matrix4().makeRotationY(Math.PI / 2);
    stripes.forEach(([x, z, alongX], i) => zebra.setMatrixAt(i, m4.makeTranslation(x, 0.02, z).multiply(alongX ? new THREE.Matrix4() : turn)));
    zebra.receiveShadow = true;
    root.add(zebra);
  }

  for (const body of hallBodies) body();
  // ---------------------------------------------------------------- places, the graph, the traversal
  const P = (x: number, z: number) => ({ x: x + BR_X, z: z + BR_Z });
  const pois: Poi[] = SECTORS.map((s) => {
    const inside = LANES.flatMap((x) => LANES.map((z) => [x, z] as const)).filter(([x, z]) => x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ);
    const mid = { x: (s.minX + s.maxX) / 2, z: (s.minZ + s.maxZ) / 2 };
    // (none on or beside a district of a pack's demo scene: its buildings stand on the city's streets there)
    const clear = inside.filter(([x, z]) => !nearDistrict(x, z));
    const drops = (clear.length ? clear : [[mid.x, mid.z] as const]).map(([x, z]) => P(x, z));
    return { id: s.id, name: s.name, ...P(mid.x, mid.z), radius: Math.max(s.maxX - s.minX, s.maxZ - s.minZ) / 2, drops };
  });
  const sites: Site[] = [];
  const placeAt = (x: number, z: number): Poi | Site | null => {
    const s = sectorAt(x - BR_X, z - BR_Z);
    return s ? (pois.find((p) => p.id === s.id) ?? null) : null;
  };
  // the graph: every crossing of two streets, the ends of the streets at the edge, linked along the streets
  const nodes: GraphNode[] = [];
  const index = new Map<string, number>();
  const line = [-BR_HALF + 7, ...LANES, BR_HALF - 7];
  const at = (i: number, j: number): number => {
    const k = `${i},${j}`;
    let n = index.get(k);
    if (n === undefined) {
      const x = line[i];
      const z = line[j];
      n = nodes.length;
      nodes.push({ ...P(x, z), y: 0, poi: sectorAt(x, z)?.id, links: [] });
      index.set(k, n);
    }
    return n;
  };
  const link = (a: number, b: number) => {
    if (!nodes[a].links.includes(b)) nodes[a].links.push(b);
    if (!nodes[b].links.includes(a)) nodes[b].links.push(a);
  };
  // A street through a district of a pack's demo scene, or up to its edge, is on the graph only where a bot walks it both
  // ways: the district stands on the city's streets there (its crossings inside its buildings are never made)
  const walks = (i0: number, j0: number, i1: number, j1: number): boolean => {
    const n = Math.ceil(Math.hypot(line[i1] - line[i0], line[j1] - line[j0]) / 2);
    let near = false;
    for (let k = 0; k <= n && !near; k++) near = nearDistrict(line[i0] + ((line[i1] - line[i0]) * k) / n, line[j0] + ((line[j1] - line[j0]) * k) / n);
    if (!near) return true;
    const [a, b] = [P(line[i0], line[j0]), P(line[i1], line[j1])];
    return botWalk(a.x, a.z, 0, b.x, b.z).ok && botWalk(b.x, b.z, 0, a.x, a.z).ok;
  };
  for (let i = 0; i < line.length; i++) {
    for (let j = 0; j < line.length; j++) {
      // a street runs along i where j is a street (not an edge), and the other way
      const onStreetI = j > 0 && j < line.length - 1;
      const onStreetJ = i > 0 && i < line.length - 1;
      if (!onStreetI && !onStreetJ) continue;
      if (onStreetI && i + 1 < line.length && walks(i, j, i + 1, j)) link(at(i, j), at(i + 1, j));
      if (onStreetJ && j + 1 < line.length && walks(i, j, i, j + 1)) link(at(i, j), at(i, j + 1));
    }
  }
  ROOF_ROUTES.length = 0;
  // The low towers' stairs, door to roof, on the graph (city.json botRoofs): a bot
  // wandering past takes one now and then, and a fight has someone above it.
  const streetNodes = nodes.length;
  for (const t of towers) {
    if (t.storeys > C.botRoofs.maxStoreys || t.route.length < 2) continue;
    const first = nodes.length;
    t.route.forEach((r, k) => {
      nodes.push({ ...P(r.x, r.z), y: r.y, poi: sectorAt(r.x, r.z)?.id, links: [] });
      if (k > 0) link(first + k - 1, first + k);
    });
    // Straight out of the door to its street's middle, then along the street to the nearer
    // crossing a bot walks to (the nearest crossing as the crow flies was behind a block).
    const door = t.route[0];
    const st = t.street!;
    const sx = st.side === "w" ? st.line : door.x;
    const sz = st.side === "w" ? door.z : st.line;
    const onStreet = nodes.length;
    nodes.push({ ...P(sx, sz), y: 0, poi: sectorAt(sx, sz)?.id, links: [] });
    link(onStreet, first);
    let best = -1;
    let bestD = C.botRoofs.reach;
    const S = nodes[onStreet];
    for (let i = 0; i < streetNodes; i++) {
      const n = nodes[i];
      // a crossing on this same street
      if (Math.abs(st.side === "w" ? n.x - S.x : n.z - S.z) > 0.5) continue;
      const dd = Math.hypot(n.x - S.x, n.z - S.z);
      if (dd < bestD && botWalk(S.x, S.z, 0, n.x, n.z).ok) {
        bestD = dd;
        best = i;
      }
    }
    if (best >= 0) link(best, onStreet);
    ROOF_ROUTES.push({ street: best, nodes: [onStreet, ...t.route.map((_, k) => first + k)], storeys: t.storeys });
  }

  // The concourse on the graph (Phase 19 step 11): each podium's promenade corners, linked round; each public
  // stair from its street to its top step and onto its podium; each bridge between two podiums. A link is made
  // only where a bot walks it both ways (botWalk), so the graph never sends one at a wall.
  {
    const add = (x: number, z: number, y: number): number => {
      nodes.push({ ...P(x, z), y, poi: sectorAt(x, z)?.id, links: [] });
      return nodes.length - 1;
    };
    const walkLink = (a: number, b: number): boolean => {
      const A = nodes[a];
      const B = nodes[b];
      const ok = botWalk(A.x, A.z, A.y ?? 0, B.x, B.z).ok && botWalk(B.x, B.z, B.y ?? 0, A.x, A.z).ok;
      if (ok) link(a, b);
      return ok;
    };
    const corners = new Map<string, number[]>();
    for (const [key, p] of podia) {
      const i = C.concourse.promenade / 2;
      const c = [add(p.x0 + i, p.z0 + i, p.top), add(p.x1 - i, p.z0 + i, p.top), add(p.x1 - i, p.z1 - i, p.top), add(p.x0 + i, p.z1 - i, p.top)];
      for (let k = 0; k < 4; k++) walkLink(c[k], c[(k + 1) % 4]);
      corners.set(key, c);
      if (key === spireKey) CONCOURSE.spire.push(...c);
    }
    /** the podium a point (local) stands on, by its top */
    const podOf = (x: number, z: number, y: number): string | undefined =>
      [...podia].find(([, p]) => x >= p.x0 - 0.5 && x <= p.x1 + 0.5 && z >= p.z0 - 0.5 && z <= p.z1 + 0.5 && Math.abs(p.top - y) < 0.3)?.[0];
    const onPodium = (n: number): void => {
      const key = podOf(nodes[n].x - BR_X, nodes[n].z - BR_Z, nodes[n].y ?? 0);
      for (const c of key ? (corners.get(key) ?? []) : []) walkLink(n, c);
    };
    /** a node on the pavement to its street: straight out to the nearer street's middle, then along it to the crossings either side */
    const toStreet = (foot: number): void => {
      const f = { x: nodes[foot].x - BR_X, z: nodes[foot].z - BR_Z };
      const lx = line.reduce((a, v) => (Math.abs(v - f.x) < Math.abs(a - f.x) ? v : a));
      const lz = line.reduce((a, v) => (Math.abs(v - f.z) < Math.abs(a - f.z) ? v : a));
      const alongX = Math.abs(lz - f.z) < Math.abs(lx - f.x);
      const sp = add(alongX ? f.x : lx, alongX ? lz : f.z, 0);
      walkLink(foot, sp);
      const S = nodes[sp];
      for (const dir of [-1, 1]) {
        let best = -1;
        let bestD = Infinity;
        for (let i = 0; i < streetNodes; i++) {
          const n = nodes[i];
          if (Math.abs(alongX ? n.z - S.z : n.x - S.x) > 0.5) continue;
          const d = (alongX ? n.x - S.x : n.z - S.z) * dir;
          if (d > 0 && d < bestD) {
            bestD = d;
            best = i;
          }
        }
        if (best >= 0) walkLink(sp, best);
      }
    };
    for (const s of CONCOURSE.stairs) {
      const [f, t, l] = s.legs.map((q) => ({ x: q.x - BR_X, z: q.z - BR_Z }));
      const foot = add(f.x, f.z, PAVE_H);
      const top = add(t.x, t.z, s.top);
      const land = add(l.x, l.z, s.top);
      walkLink(foot, top);
      walkLink(top, land);
      onPodium(land);
      toStreet(foot);
    }
    // The halls (HALLS, city.json halls): a grid of nodes over each one's floor, linked where a bot walks them; each door
    // from a node just inside it to one just outside, and that one to its street as a public stair's foot is
    for (const hl of HALLS) {
      const Hn = C.halls.nodes;
      const [x0, x1, z0, z1] = [hl.minX - BR_X, hl.maxX - BR_X, hl.minZ - BR_Z, hl.maxZ - BR_Z];
      const along = (a: number, b: number) => {
        const n = Math.max(1, Math.round((b - a - 2 * Hn.wall) / Hn.every) + 1);
        return Array.from({ length: n }, (_, i) => (n === 1 ? (a + b) / 2 : a + Hn.wall + (i * (b - a - 2 * Hn.wall)) / (n - 1)));
      };
      const inHall = (n: number) => ((nodes[n].hall = hl.key), n);
      // a node not inside a column or a counter, where a bot could stand
      const clear = (x: number, z: number) => ![...hl.columns, ...hl.counters, ...hl.stairs].some((q) => x > q.minX - BR_X - 0.9 && x < q.maxX - BR_X + 0.9 && z > q.minZ - BR_Z - 0.9 && z < q.maxZ - BR_Z + 0.9);
      const xs = along(x0, x1);
      const zs = along(z0, z1);
      const grid = xs.map((x) => zs.map((z) => (clear(x, z) ? inHall(add(x, z, hl.y0)) : -1)));
      for (let i = 0; i < xs.length; i++)
        for (let j = 0; j < zs.length; j++) {
          if (grid[i][j] < 0) continue;
          if (i + 1 < xs.length && grid[i + 1][j] >= 0) walkLink(grid[i][j], grid[i + 1][j]);
          if (j + 1 < zs.length && grid[i][j + 1] >= 0) walkLink(grid[i][j], grid[i][j + 1]);
        }
      const cells = grid.flat().filter((n) => n >= 0);
      const nearest = (n: number, among: number[], most: number) => {
        let linked = 0;
        for (const g of [...among].sort((p, q) => Math.hypot(nodes[p].x - nodes[n].x, nodes[p].z - nodes[n].z) - Math.hypot(nodes[q].x - nodes[n].x, nodes[q].z - nodes[n].z)).slice(0, most + 2))
          if (linked < most && walkLink(n, g)) linked++;
      };
      // the gallery: nodes down the middle of each run, linked along it, each run's ends to the nearest of the others; each
      // flight from a node past its foot on the floor to one at its top on the gallery
      const gal: number[] = [];
      for (const r of hl.gallery.runs) {
        const alongX = r.maxX - r.minX >= r.maxZ - r.minZ;
        const [a, b] = alongX ? [r.minX, r.maxX] : [r.minZ, r.maxZ];
        const n = Math.max(2, Math.round((b - a) / Hn.every) + 1);
        const run: number[] = [];
        for (let i = 0; i < n; i++) {
          const u = a + 1 + (i * (b - a - 2)) / (n - 1);
          const [x, z] = alongX ? [u, (r.minZ + r.maxZ) / 2] : [(r.minX + r.maxX) / 2, u];
          run.push(inHall(add(x - BR_X, z - BR_Z, hl.gallery.top)));
        }
        for (let i = 0; i + 1 < run.length; i++) walkLink(run[i], run[i + 1]);
        gal.push(...run);
      }
      for (const n of gal) nearest(n, gal.filter((g) => g !== n && !nodes[n].links.includes(g)), 1);
      for (const s of hl.stairs) {
        const top = inHall(add(s.top.x - BR_X, s.top.z - BR_Z, hl.gallery.top));
        const foot = inHall(add(s.foot.x - BR_X, s.foot.z - BR_Z, hl.y0));
        walkLink(foot, top);
        nearest(top, gal, 2);
        nearest(foot, cells, 2);
      }
      for (const d of hl.doors) {
        const wl = C.halls.wall;
        const inside = inHall(add(d.x - BR_X - d.nx * (wl + 1.5), d.z - BR_Z - d.nz * (wl + 1.5), hl.y0));
        const outside = add(d.x - BR_X + d.nx * 1.5, d.z - BR_Z + d.nz * 1.5, PAVE_H);
        walkLink(inside, outside);
        // the inside node to the two nearest of the grid it walks to
        let linked = 0;
        for (const g of [...cells].sort((p, q) => Math.hypot(nodes[p].x - nodes[inside].x, nodes[p].z - nodes[inside].z) - Math.hypot(nodes[q].x - nodes[inside].x, nodes[q].z - nodes[inside].z)).slice(0, 4))
          if (linked < 2 && walkLink(inside, g)) linked++;
        toStreet(outside);
      }
    }
    for (const b of CONCOURSE.bridges) {
      const a = add(b.a.x - BR_X, b.a.z - BR_Z, b.y);
      const e = add(b.b.x - BR_X, b.b.z - BR_Z, b.y);
      walkLink(a, e);
      onPodium(a);
      onPodium(e);
    }
    // the stair cores (city.json stairCore): the promenade outside each door, onto its podium's corners, and up the
    // flights waypoint by waypoint to the deck it tops out on, so a bot goes up to the lobby and the Sky Park as a
    // player does ("stairs only: the bots use this route", the plan's 4.5)
    for (const c of STAIR_CORES) {
      let prev = add(c.outside.x - BR_X, c.outside.z - BR_Z, c.outside.y);
      onPodium(prev);
      for (const wp of c.way) {
        const n = add(wp.x - BR_X, wp.z - BR_Z, wp.y);
        if (!walkLink(prev, n)) break;
        prev = n;
      }
    }
    // The districts made of the packs' demo scenes (citydistricts.json bots): each canyon's street, a node every `step`
    // metres from the city's street at an arm's end (joined to its crossings either side) through the crossroads to the
    // map's edge; and each walkway, a node every `step` metres either way along it from where a pad lands you, as far as
    // a bot walks it. A link only where a bot walks it both ways. Their pads join below, as the centre's do.
    const districtNode = new Map<string, number>();
    for (const d of DISTRICTS.districts) {
      const B = d.bots;
      const nodeAt = (x: number, z: number, y: number): number => {
        const k = `${x.toFixed(1)},${z.toFixed(1)},${y.toFixed(1)}`;
        return districtNode.get(k) ?? districtNode.set(k, add(x, z, y)).get(k)!;
      };
      for (const line of B.canyons) {
        let prev = -1;
        for (let k = 0; k + 1 < line.length; k++) {
          const [ax, az] = line[k];
          const [bx, bz] = line[k + 1];
          const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / B.step));
          for (let s = k === 0 ? 0 : 1; s <= n; s++) {
            const node = nodeAt(ax + ((bx - ax) * s) / n, az + ((bz - az) * s) / n, 0);
            if (prev >= 0) walkLink(prev, node);
            prev = node;
          }
        }
        // its first point is on the city's street: onto the crossings either side of it along that street
        const [sx, sz] = line[0];
        const S = nodes[nodeAt(sx, sz, 0)];
        for (const side of [-1, 1]) {
          let best = -1;
          let bestD = Infinity;
          for (let i = 0; i < streetNodes; i++) {
            const n = nodes[i];
            const [along, across] = Math.abs(n.z - S.z) < 0.5 ? [n.x - S.x, 0] : Math.abs(n.x - S.x) < 0.5 ? [n.z - S.z, 0] : [0, 1];
            if (across || along * side <= 0 || Math.abs(along) >= bestD || !n.links.length) continue;
            best = i;
            bestD = Math.abs(along);
          }
          if (best >= 0) walkLink(nodeAt(sx, sz, 0), best);
        }
      }
      // The walkways: a point every `grid` metres of the plan where the collision's top is a walkway's, each linked to
      // the points round it a bot walks to and back, and kept where the walk reaches from a pad's landing (the posts,
      // bollards, bins and parked cars on High City's walkways stopped a line of nodes laid along them)
      const boxes = DISTRICT_SOLIDS[d.id] ?? [];
      const [w0, w1] = d.fill.walkway;
      const topAt = (x: number, z: number): number => {
        let t = -Infinity;
        for (const b of boxes) if (x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && b[5] > t && b[5] <= w1 + 2) t = b[5];
        return t;
      };
      const walks = (ax: number, az: number, bx: number, bz: number, y: number): boolean => botWalk(ax + BR_X, az + BR_Z, y, bx + BR_X, bz + BR_Z).ok && botWalk(bx + BR_X, bz + BR_Z, y, ax + BR_X, az + BR_Z).ok;
      const G = B.grid;
      const pts = new Map<string, { x: number; z: number; y: number; to: string[] }>();
      const xs = d.hole.map(([x]) => x);
      const zs = d.hole.map(([, z]) => z);
      const lim = d.fill.half - 3;
      for (let x = Math.min(...xs) + G / 2; x < Math.min(Math.max(...xs), lim); x += G)
        for (let z = Math.min(...zs) + G / 2; z < Math.min(Math.max(...zs), lim); z += G) {
          const y = topAt(x, z);
          if (y >= w0 && y <= w1 && inDistrict(x, z)) pts.set(`${x},${z}`, { x, z, y, to: [] });
        }
      for (const [k, q] of pts)
        for (const [dx, dz] of [[G, 0], [0, G], [G, G], [G, -G]]) {
          const o = pts.get(`${q.x + dx},${q.z + dz}`);
          if (o && walks(q.x, q.z, o.x, o.z, Math.max(q.y, o.y))) {
            q.to.push(`${o.x},${o.z}`);
            o.to.push(k);
          }
        }
      // from each landing, the points it walks to within reach, and all the points those reach
      const seen = new Map<string, number>();
      const queue: string[] = [];
      for (const l of padLands) {
        const p = pads[l.pad];
        if (!inDistrict(p.x - BR_X, p.z - BR_Z)) continue;
        const land = nodeAt(l.x, l.z, l.y);
        for (const [k, q] of pts) {
          if (Math.hypot(q.x - l.x, q.z - l.z) > G * 1.5 || !walks(l.x, l.z, q.x, q.z, l.y)) continue;
          if (!seen.has(k)) {
            seen.set(k, nodeAt(q.x, q.z, q.y));
            queue.push(k);
          }
          link(land, seen.get(k)!);
        }
      }
      for (let i = 0; i < queue.length; i++) {
        const q = pts.get(queue[i])!;
        for (const k of q.to) {
          if (!seen.has(k)) {
            const o = pts.get(k)!;
            seen.set(k, nodeAt(o.x, o.z, o.y));
            queue.push(k);
          }
          link(seen.get(queue[i])!, seen.get(k)!);
        }
      }
    }
    // The centre's jump pads, one way up (the pad node's `pad`, its landing's `padFrom`): the podiums' and the
    // Spire's tiers', so a bot going for the capture zone on the Spire goes up it as a player does. A pad joins
    // the graph where a bot walks to it from a node on its floor within reach, and its landing links on to the
    // nodes on its roof; the next tier's pad is one of them.
    const REACH = 36;
    const centre = (x: number, z: number): boolean => Math.abs(x) < 100 && Math.abs(z) < 100;
    const padNode = new Map<number, number>();
    for (const l of padLands) {
      const p = pads[l.pad];
      const px = p.x - BR_X;
      const pz = p.z - BR_Z;
      if (!centre(px, pz) && !inDistrict(px, pz)) continue;
      padNode.set(l.pad, add(px, pz, p.y ?? 0));
    }
    const landNode = new Map<number, number>();
    // (a district's walkway already has its landing, the node its walk along started from)
    for (const l of padLands) if (padNode.has(l.pad)) landNode.set(l.pad, districtNode.get(`${l.x.toFixed(1)},${l.z.toFixed(1)},${l.y.toFixed(1)}`) ?? add(l.x, l.z, l.y));
    const near = (n: number, skip: number): number[] =>
      nodes
        .map((m, i) => ({ m, i }))
        .filter(({ m, i }) => i !== n && i !== skip && Math.abs((m.y ?? 0) - (nodes[n].y ?? 0)) < 0.6 && Math.hypot(m.x - nodes[n].x, m.z - nodes[n].z) < REACH)
        .sort((a, b) => Math.hypot(a.m.x - nodes[n].x, a.m.z - nodes[n].z) - Math.hypot(b.m.x - nodes[n].x, b.m.z - nodes[n].z))
        .map(({ i }) => i);
    for (const l of padLands) {
      const pn = padNode.get(l.pad);
      const ln = landNode.get(l.pad);
      if (pn === undefined || ln === undefined) continue;
      const p = pads[l.pad];
      // onto the graph on its floor: the two nearest it walks to
      let joined = 0;
      for (const i of near(pn, ln)) if (joined < 2 && walkLink(pn, i)) joined++;
      if (!joined) continue;
      nodes[pn].pad = { to: ln, up: p.up ?? 0, dx: p.dx, dz: p.dz, over: p.over ?? 0 };
      (nodes[ln].padFrom ??= []).push(pn);
      // the landing, on to what stands on its roof (a podium's corners, the next tier's pad); a district's walkway has
      // its landing linked already, to the walkway's own points round it
      if (!inDistrict(p.x - BR_X, p.z - BR_Z)) for (const i of near(ln, pn)) walkLink(ln, i);
    }
  }

  // the jump towers in the plazas, the launch pads at the crossings, the beacons
  // (the districts' plazas only: the Spire's own took none before the cut, when the outer ring's came first)
  const outerPlazas = plazas.filter((p) => Math.abs(p.x) > kitCfg.dress.centre || Math.abs(p.z) > kitCfg.dress.centre);
  const towerSpots = outerPlazas.slice(0, C.jumpTowers).map((p) => ({ ...P(p.x, p.z), y: PAVE_H }));
  // (by the grid's own street numbers, so the crossings that carry a pad are the ones that did before the cut)
  STREETS.forEach((x, i) =>
    STREETS.forEach((z, j) => {
      if ((i + j) % 2 !== 0 || !LANES.includes(x) || !LANES.includes(z)) return;
      const along = (i + j) % 4 === 0;
      pads.push({ ...P(x + (along ? 3 : 0), z + (along ? 0 : 3)), dx: along ? 1 : 0, dz: along ? 0 : 1 });
    })
  );
  // A pad is a vent in the floor that throws you up (city.json padLook, Phase 24.5): a dark grate ringed in its colour
  // (gold a jump pad, blue a window pad, cyan a road's), the kit's own round vent over the grate in the centre from
  // Balanced up (citydress.ts), a soft beam up to where it throws you and one ring at the roof it lands you on. Readable
  // from a street away, which is what a pad is for, without the loud gold disc, its fat beam and its second ring
  // that were the city's look before the packs. None of it is solid, and none of it casts a shadow.
  const PL = C.padLook;
  const gold = emissive(0xffc23c, 2.2);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true, opacity: PL.beam.opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const rimGeo = new THREE.RingGeometry(PL.rim[0], PL.rim[1], 40).rotateX(-Math.PI / 2);
  const grateGeo = new THREE.CircleGeometry(PL.rim[0], 24).rotateX(-Math.PI / 2);
  const roadRimGeo = new THREE.RingGeometry(PL.roadRim[0], PL.roadRim[1], 32).rotateX(-Math.PI / 2);
  const roadGrateGeo = new THREE.CircleGeometry(PL.roadRim[0], 20).rotateX(-Math.PI / 2);
  const grate = flat(0x15171b, 0.5, 0.6);
  const ringGeo = new THREE.TorusGeometry(1.4, 0.16, 6, 28);
  const put = (m: THREE.Mesh, x: number, y: number, z: number): void => {
    m.position.set(x, y, z);
    root.add(m);
  };
  // ---------------------------------------------------------------- the Sky Lobby's window pads
  // On the podium in front of every lobby tower's face with open floor and nothing overhead (city.json skyLobby;
  // tools/centre-towers.ts measured the faces), none too near another pad. The throw is THE CHAIN's window pad
  // (chaincourse.json window, course.ts stepPads): the window and the wall are the same size.
  {
    const Lb = C.skyLobby;
    const Wn = chainCfg.window;
    const g = MOVE.gravity;
    const inWindow = 2 * Math.sqrt((2 * (Wn.apexOver - Wn.overAt)) / g);
    const through = Wn.standOff + Lb.wall + MOVE.radius;
    const push = through / (inWindow * Wn.safety);
    const at = (x: number, z: number) => RANGE_SOLIDS.filter((s) => x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ);
    for (const t of towers) {
      if (t.lobby === undefined || t.base === undefined || !t.lobbyMat) continue;
      const base = t.base;
      const lobby = t.lobby;
      const windows = { n: 0, s: 0, w: 0, e: 0 };
      const lit = new Set<string>();
      for (const [key, nx, nz] of [
        ["n", 0, -1],
        ["s", 0, 1],
        ["w", -1, 0],
        ["e", 1, 0],
      ] as const) {
        // a face with a bridge or a canyon (above) has its window there: a bridge's no pad (its deck is over the
        // column), a canyon's a pad only in line with the window
        const lined = t.bridges?.[key];
        if (lined !== undefined) windows[key] = lined;
        if (t.decks?.has(key)) continue;
        // along the face: x for north and south, z for west and east; the middle first, then slid either way
        const len = nx === 0 ? t.w : t.d - 2 * Lb.wall;
        const room = len / 2 - Lb.width / 2 - Lb.corner;
        const tries = lined !== undefined ? [lined] : [0, Lb.slide * len, -Lb.slide * len].map((o) => Math.max(-room, Math.min(room, o))).filter((o) => windowFree.at(t, key, o));
        if (lined === undefined) windows[key] = windowFree.offset(t, key, 0, room);
        for (const o of tries) {
          const fx = nx === 0 ? t.x + o : t.x + (nx * t.w) / 2;
          const fz = nx === 0 ? t.z + (nz * t.d) / 2 : t.z + o;
          // the floor in front stays the tower's base for minOpen metres, and nothing stands on it
          let open = true;
          for (let dd = 0.5; dd <= Lb.minOpen && open; dd += 0.5) {
            const here = at(fx + nx * dd + BR_X, fz + nz * dd + BR_Z);
            const floor = here.filter((s) => s.top <= base + 0.3).reduce((a, s) => Math.max(a, s.top), 0);
            if (Math.abs(floor - base) > 0.3 || here.some((s) => s.base < base + 2 && s.top > base + 0.3)) open = false;
          }
          const px = fx + nx * Wn.standOff;
          const pz = fz + nz * Wn.standOff;
          // nothing over the column it throws you up
          const overhead = RANGE_SOLIDS.some((s) => px + BR_X > s.minX - 0.9 && px + BR_X < s.maxX + 0.9 && pz + BR_Z > s.minZ - 0.9 && pz + BR_Z < s.maxZ + 0.9 && s.base > base + 2 && s.base < lobby + 3);
          if (!open || overhead) continue;
          if (pads.some((p) => Math.hypot(p.x - BR_X - px, p.z - BR_Z - pz) < Lb.apart)) continue;
          const up = Math.sqrt(2 * g * (lobby - base + Wn.apexOver));
          pads.push({ ...W(px, pz), dx: -nx * push, dz: -nz * push, y: base, up, over: lobby + Wn.overAt, hold: through / push });
          windows[key] = o;
          lit.add(key);
          break;
        }
      }
      skyLobby(t.x, t.z, t.w, t.d, lobby, t.lobbyMat, windows, lit);
    }
  }

  // a window pad: the pads' blue, its beam to the window and one ring there, lighter than a jump pad's two gold rings
  // (28 of them with a jump pad's rings were 22k triangles, over the city's budget; tools/checks/city-budget.ts)
  const blue = emissive(0x3b8bff, 2.2);
  const winRingGeo = new THREE.TorusGeometry(1.2, 0.12, 4, 16);
  const cyan = neon(0x20e0ff);
  for (const p of pads) {
    const x = p.x - BR_X;
    const z = p.z - BR_Z;
    const y0 = p.y ?? 0;
    // the grate and its rim, just over the floor
    const road = p.up === undefined;
    put(new THREE.Mesh(road ? roadGrateGeo : grateGeo, grate), x, y0 + 0.015, z);
    put(new THREE.Mesh(road ? roadRimGeo : rimGeo, road ? cyan : p.hold !== undefined ? blue : gold), x, y0 + 0.02, z);
    if (road || p.up === undefined) continue;
    if (p.hold !== undefined) {
      const top = p.over ?? y0;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(PL.beam.radius, PL.beam.radius, top - y0, 8, 1, true), beamMat);
      put(beam, x, (y0 + top) / 2, z);
      const ring = new THREE.Mesh(winRingGeo, blue);
      ring.rotation.x = Math.PI / 2;
      put(ring, x, top, z);
      continue;
    }
    const top = p.over ?? y0 + (p.up * p.up) / (2 * MOVE.gravity);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(PL.beam.radius, PL.beam.radius, top - y0 + 4, 10, 1, true), beamMat);
    put(beam, x, (y0 + top + 4) / 2, z);
    const ring = new THREE.Mesh(ringGeo, gold);
    ring.rotation.x = Math.PI / 2;
    put(ring, x, top, z);
  }
  const beacons = outerPlazas.slice(C.jumpTowers, C.jumpTowers + C.beacons).map((p) => P(p.x, p.z));

  // ---------------------------------------------------------------- the fire escapes (city.json fireEscape)
  // Last, once every window, pad, door and bridge is where it is, so one goes only where none of them are. Each tower
  // chooses from a stream of its own (seeded by where it stands), so the city's stream draws the same numbers with or
  // without them.
  {
    const Fe = C.fireEscape;
    const Ek = kitCfg.dress.escapes;
    const St = Ek.stair;
    const sz = Ek.depthScale;
    const Lb = C.skyLobby;
    const R = MOVE.radius;
    const body = flat(0x3a4048, 0.55, 0.6).clone();
    body.side = THREE.DoubleSide;
    STAND_INS.escapes = [body];
    const plates = new Map<string, THREE.BufferGeometry>();
    const plateGeo = (w: number, d: number): THREE.BufferGeometry => {
      const k = `${w.toFixed(3)}:${d.toFixed(3)}`;
      let g = plates.get(k);
      if (!g) {
        g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
        g.userData.shared = true;
        plates.set(k, g);
      }
      return g;
    };
    // the centre's three blocks each way and the streets between them: a tower's family is its block's (citykit.json
    // dress families, as citydress.ts familyAt reads them)
    const centre = BLOCKS.filter((b) => Math.abs((b[0] + b[1]) / 2) < kitCfg.dress.centre);
    const third = (v: number): number => (v < (centre[0][1] + centre[1][0]) / 2 ? 0 : v > (centre[1][1] + centre[2][0]) / 2 ? 2 : 1);
    const families = kitCfg.dress.families as Record<string, string>;
    const rise = storeyH / Fe.treads;
    const run = (St.top - St.foot) / Fe.treads;
    // the first tread a body's head would meet the landing over it from: the hole in that landing starts behind its back
    const firstUnder = Math.floor((storeyH - St.plate - MOVE.standHeight) / rise) + 1;
    const hole0 = St.foot + (firstUnder - 1) * run - 2 * R - 0.05;
    const sideOf = (key: Side4) =>
      key === "n" ? { nx: 0, nz: -1, dir: -1 } : key === "s" ? { nx: 0, nz: 1, dir: 1 } : key === "w" ? { nx: -1, nz: 0, dir: 1 } : { nx: 1, nz: 0, dir: -1 };
    type EscapeFamily = (typeof Ek.families)[keyof typeof Ek.families];
    /**
     * One fire escape on a face (`key` as a tower's; `at` its plane, `u0` where the pieces start along it, `mid` the
     * face's middle), from `base` to the ledge at `roof`: `n` - 1 landings a storey apart, the first with its drop ladder
     * from the ground, the last a climb under the ledge. `t`, the tower it hangs on, for its open storeys' windows and
     * doors (a district's walkway front has neither); `floorGround` where the ground under it is the world's own floor,
     * with no solid there (a district's street); `climbX` where along the pieces the climb from the last landing is (a
     * district's front can rise past its walkway in places). Whether it was built: nothing solid in its way, and no
     * pad, open storey's window or door near it
     */
    const escapeAt = (fam: EscapeFamily, family: string, key: Side4, at: number, u0: number, mid: number, base: number, roof: number, n: number, t: Tower | null, floorGround: boolean, climbX = 0.5): boolean => {
      const { nx, nz, dir } = sideOf(key);
      const Wd = fam.width;
      const Dv = fam.depth * sz;
      const lane0 = fam.lane[0] * sz;
      const lane1 = fam.lane[1] * sz;
      const inner = lane0 - Fe.gap;
      const lad = { a: fam.ladder[0], b: fam.ladder[1], v0: fam.ladder[2] * sz, v1: fam.ladder[3] * sz };
      const reach = Math.max(Dv, lad.v1) + 2 * R;
      const uStart = dir > 0 ? u0 : u0 + Wd;
      /** a point in the pieces' frame (along from their left, out from the wall), map-local */
      const pt = (x: number, v: number): [number, number] => {
        const u = uStart + dir * x;
        return nx === 0 ? [u, at + nz * v] : [at + nx * v, u];
      };
      const box = (xa: number, xb: number, va: number, vb: number) => {
        const [x1, z1] = pt(xa, va);
        const [x2, z2] = pt(xb, vb);
        return { minX: Math.min(x1, x2), maxX: Math.max(x1, x2), minZ: Math.min(z1, z2), maxZ: Math.max(z1, z2) };
      };
      const foot = box(-0.3, Wd + 0.3, 0.02, reach);
      // the promenade under it all, at the tower's base
      let ground = true;
      for (const [gx, gv] of [
        [0.3, Dv / 2],
        [Wd - 0.3, Dv / 2],
        [(lad.a + lad.b) / 2, lad.v1 + R],
      ] as const) {
        const [px, pz] = pt(gx, gv);
        const top = RANGE_SOLIDS.filter((s) => px + BR_X > s.minX && px + BR_X < s.maxX && pz + BR_Z > s.minZ && pz + BR_Z < s.maxZ && s.top <= base + 0.3).reduce((m, s) => Math.max(m, s.top), floorGround ? floorAt(px + BR_X, pz + BR_Z) : -Infinity);
        if (Math.abs(top - base) > 0.3) ground = false;
      }
      if (!ground) return false;
      // nothing solid in the way, from the promenade to over the roof
      if (RANGE_SOLIDS.some((s) => s.maxX > foot.minX + BR_X && s.minX < foot.maxX + BR_X && s.maxZ > foot.minZ + BR_Z && s.minZ < foot.maxZ + BR_Z && s.top > base + 0.05 && s.base < roof + 1.2)) return false;
      // no pad's column near it, no window of an open storey, no door
      const cp = Fe.clear.pad;
      if (pads.some((p) => p.x - BR_X > foot.minX - cp && p.x - BR_X < foot.maxX + cp && p.z - BR_Z > foot.minZ - cp && p.z - BR_Z < foot.maxZ + cp)) return false;
      const uLo = Math.min(u0, u0 + Wd);
      const uHi = Math.max(u0, u0 + Wd);
      const win = Lb.width / 2 + Fe.clear.window;
      if (t && KIT_SITES.rooms.some((rm) => Math.abs(rm.x - t.x) < 0.01 && Math.abs(rm.z - t.z) < 0.01 && mid + rm.at[key] + win > uLo && mid + rm.at[key] - win < uHi)) return false;
      const cd = Fe.clear.door;
      if (KIT_SITES.doors.some((q) => !q.escape && q.x1 > foot.minX - cd && q.x0 < foot.maxX + cd && q.z1 > foot.minZ - cd && q.z0 < foot.maxZ + cd && q.y1 > base && q.y0 < roof)) return false;
      const T = Fe.railThick;

      // ---- the solids, a storey at a time, and the way up them
      // Solid as the pieces are, drawn light: where the kit is off (Competitive, a copy without the files) the city
      // draws every escape, and a box a tread and a rail was 82k triangles over the city's 320k (city-budget.ts). So
      // a landing is drawn as its plates, a flight as one plate on its slope, a rail as its top bar
      const hard = (xa: number, xb: number, va: number, vb: number, ya: number, yb: number): void => {
        const q = box(xa, xb, va, vb);
        solid(q.minX, q.maxX, q.minZ, q.maxZ, ya, yb);
      };
      const plateAt = (xa: number, xb: number, va: number, vb: number, y: number): void => {
        const q = box(xa, xb, va, vb);
        const m = new THREE.Mesh(plateGeo(q.maxX - q.minX, q.maxZ - q.minZ), body);
        m.position.set((q.minX + q.maxX) / 2, y, (q.minZ + q.maxZ) / 2);
        m.receiveShadow = true;
        root.add(m);
      };
      /** a landing's plate: solid its thickness, drawn at its top */
      const plate = (xa: number, xb: number, va: number, vb: number, y: number): void => {
        hard(xa, xb, va, vb, y - St.plate, y);
        plateAt(xa, xb, va, vb, y);
      };
      /** a rail: solid its full height, drawn as its top bar */
      const rail = (xa: number, xb: number, va: number, vb: number, y: number, drawn: boolean): void => {
        const q = box(xa, xb, va, vb);
        solid(q.minX, q.maxX, q.minZ, q.maxZ, y, y + Fe.rail);
        if (drawn) deco(q.maxX - q.minX, T, q.maxZ - q.minZ, (q.minX + q.maxX) / 2, y + Fe.rail - T, (q.minZ + q.maxZ) / 2, body);
      };
      /** a flight's treads, solid, drawn as one plate from its foot on the landing below to its top */
      const flight = (y0: number): void => {
        for (let i = 1; i <= Fe.treads; i++) hard(St.foot + (i - 1) * run, St.foot + i * run, lane0 + 0.02, lane1, y0 + i * rise - Fe.tread, y0 + i * rise);
        const len = Math.hypot(St.top - St.foot, storeyH);
        const pitch = Math.atan2(storeyH, St.top - St.foot);
        const [mx, mz] = pt((St.foot + St.top) / 2, (lane0 + lane1) / 2);
        const alongX = nx === 0;
        const m = new THREE.Mesh(alongX ? plateGeo(len, lane1 - lane0) : plateGeo(lane1 - lane0, len), body);
        m.position.set(mx, y0 + storeyH / 2, mz);
        // rising the way the pieces' width runs: about z along x, about x along z
        if (alongX) m.rotation.z = dir * pitch;
        else m.rotation.x = -dir * pitch;
        m.receiveShadow = true;
        root.add(m);
      };
      for (let k = 1; k < n; k++) {
        const y = base + k * storeyH;
        if (k === 1) {
          // the first landing, whole, and its drop ladder from the promenade
          plate(0, Wd, 0, Dv, y);
          const q = box(lad.a, lad.b, lad.v0, lad.v1);
          slab(q.maxX - q.minX, y - base, q.maxZ - q.minZ, (q.minX + q.maxX) / 2, base, (q.minZ + q.maxZ) / 2, body);
        } else {
          // the landing round the hole the flight comes up through, and the flight
          plate(0, Wd, 0, inner, y);
          plate(0, hole0, inner, Dv, y);
          plate(St.top, Wd, inner, Dv, y);
          flight(y - storeyH);
        }
        // its rail: along its outer edge (open over the ladder) and across both ends
        if (k === 1) {
          rail(0, lad.a - 0.15, Dv - T, Dv, y, true);
          rail(lad.b + 0.15, Wd, Dv - T, Dv, y, true);
        } else rail(0, Wd, Dv - T, Dv, y, true);
        rail(0, T, 0, Dv, y, false);
        rail(Wd - T, Wd, 0, Dv, y, false);
      }
      // the way up, for the checks: onto the first landing off the ladder, then each flight from the landing's
      // outer lane by its foot to its top, back along the inner strip past the hole, and out to the next foot
      const laneMid = (inner + R + (Dv - T - R)) / 2;
      const innerMid = (R + (lane0 - R)) / 2;
      const w = (x: number, v: number, y: number) => {
        const [px, pz] = pt(x, v);
        return { x: px + BR_X, z: pz + BR_Z, y };
      };
      const way: Array<{ x: number; z: number; y: number }> = [];
      const lx = (lad.a + lad.b) / 2;
      way.push(w(lx, laneMid, base + storeyH), w(lx, innerMid, base + storeyH));
      for (let k = 1; k < n - 1; k++) {
        const y = base + k * storeyH;
        way.push(w(0.5, innerMid, y), w(0.5, laneMid, y), w(St.top + 0.4, laneMid, y + storeyH), w(St.top + 0.4, innerMid, y + storeyH));
      }
      // a doorway into each open storey a landing stands at, in the landing's middle: the wall's piece there
      // swapped for the same wall round a door, where the room is clear behind it
      const doors: Array<{ out: { x: number; z: number; y: number }; in: { x: number; z: number; y: number } }> = [];
      const [du0, du1] = [uStart + dir * (Wd / 2 - Fe.door / 2), uStart + dir * (Wd / 2 + Fe.door / 2)].sort((p, q) => p - q);
      for (let k = 1; k < n; k++) {
        const y = base + k * storeyH;
        const piece = t ? roomWalls.find((q) => q.x === t.x && q.z === t.z && Math.abs(q.y - y) < 0.01 && q.face === key && q.h > storeyH - 0.01 && q.a < du0 - 0.2 && q.b > du1 + 0.2) : undefined;
        if (!piece) continue;
        // clear behind: nothing standing in the room across the door, doorClear deep past the wall
        const blocked = [0.25, 0.5, 0.75].some((f) =>
          [Lb.wall + 0.5, Lb.wall + Fe.doorClear].some((dv) => {
            const [bx, bz] = pt(Wd / 2 - Fe.door / 2 + f * Fe.door, -dv);
            return RANGE_SOLIDS.some((s) => bx + BR_X > s.minX && bx + BR_X < s.maxX && bz + BR_Z > s.minZ && bz + BR_Z < s.maxZ && s.base < y + 1.8 && s.top > y + 0.3);
          }),
        );
        if (blocked) continue;
        root.remove(piece.mesh);
        const si = RANGE_SOLIDS.indexOf(piece.solid);
        if (si >= 0) RANGE_SOLIDS.splice(si, 1);
        roomWalls.splice(roomWalls.indexOf(piece), 1);
        const alongX = nx === 0;
        const wallBit = (a: number, b: number, yy: number, h: number) =>
          alongX ? slab(b - a, h, Lb.wall, (a + b) / 2, yy, piece.at, piece.mat) : slab(Lb.wall, h, b - a, piece.at, yy, (a + b) / 2, piece.mat);
        wallBit(piece.a, du0, y, storeyH);
        wallBit(du1, piece.b, y, storeyH);
        wallBit(du0, du1, y + Lb.height, storeyH - Lb.height);
        KIT_SITES.doors.push(alongX ? { x0: du0, x1: du1, z0: at - 0.5, z1: at + 0.5, y0: y, y1: y + Lb.height, escape: true } : { x0: at - 0.5, x1: at + 0.5, z0: du0, z1: du1, y0: y, y1: y + Lb.height, escape: true });
        const [px, pz] = pt(Wd / 2, (R + (lane0 - R)) / 2);
        const [ix, iz] = pt(Wd / 2, -(Lb.wall + 1.2));
        doors.push({ out: { x: px + BR_X, z: pz + BR_Z, y }, in: { x: ix + BR_X, z: iz + BR_Z, y } });
      }
      const [ox, oz] = pt(lx, lad.v1 + R + 0.15);
      const [cx, cz] = pt(climbX, R + 0.05);
      FIRE_ESCAPES.push({
        family,
        outside: { x: ox + BR_X, z: oz + BR_Z, y: base },
        wall: (Math.atan2(nx, nz) * 180) / Math.PI,
        landing: base + storeyH,
        way,
        climb: { x: cx + BR_X, z: cz + BR_Z, y: base + (n - 1) * storeyH },
        roof,
        box: { minX: foot.minX + BR_X, maxX: foot.maxX + BR_X, minZ: foot.minZ + BR_Z, maxZ: foot.maxZ + BR_Z },
        doors,
      });
      KIT_SITES.escapes.push({ family, face: key, at, uStart, dir, base, storeys: n, x0: foot.minX, x1: foot.maxX, z0: foot.minZ, z1: foot.maxZ, y0: base, y1: roof + 1.6 });
      return true;
    };
    for (const t of towers) {
      if (t.base === undefined || Math.abs(t.x) > kitCfg.dress.centre || Math.abs(t.z) > kitCfg.dress.centre || t.storeys < Fe.minStoreys) continue;
      const family = families[`${third(t.x)},${third(t.z)}`];
      const fam = (Ek.families as Record<string, EscapeFamily | undefined>)[family];
      if (!fam) continue;
      // a storey of the pieces is the city's: if the kit's were ever re-cut, the solids would stand off the picture
      if (Math.abs(St.landing - storeyH) > 0.05) continue;
      const Wd = fam.width;
      const r = seeded(C.seed ^ Math.round(t.x * 131 + t.z * 7919));
      const keys = (["n", "s", "w", "e"] as const).map((k) => ({ k, o: r() })).sort((a, b) => a.o - b.o);
      let built = 0;
      for (const { k: key } of keys) {
        if (built >= Fe.perTower) break;
        const { nx, nz } = sideOf(key);
        const at = nx === 0 ? t.z + (nz * t.d) / 2 : t.x + (nx * t.w) / 2;
        const a = nx === 0 ? t.x - t.w / 2 : t.z - t.d / 2;
        const b = nx === 0 ? t.x + t.w / 2 : t.z + t.d / 2;
        const mid = (a + b) / 2;
        if (b - a < Wd + 2 * Fe.corner) continue;
        // a canyon in front (another tower's face across it): its walls are for running
        const canyon = towers.some((o) => {
          if (o === t) return false;
          const lat = nx !== 0 ? Math.min(t.z + t.d / 2, o.z + o.d / 2) - Math.max(t.z - t.d / 2, o.z - o.d / 2) : Math.min(t.x + t.w / 2, o.x + o.w / 2) - Math.max(t.x - t.w / 2, o.x - o.w / 2);
          if (lat <= 0) return false;
          const gap = nx !== 0 ? (nx > 0 ? o.x - o.w / 2 - at : at - (o.x + o.w / 2)) : nz > 0 ? o.z - o.d / 2 - at : at - (o.z + o.d / 2);
          return gap >= -0.1 && gap < kitCfg.dress.canyon;
        });
        if (canyon) continue;
        const ends = r() < 0.5 ? [a + Fe.corner, b - Fe.corner - Wd] : [b - Fe.corner - Wd, a + Fe.corner];
        for (const u0 of ends) {
          if (built >= Fe.perTower) break;
          if (escapeAt(fam, family, key, at, u0, mid, t.base, t.roof, t.storeys, t, false)) built++;
        }
      }
    }
    // The districts' (citydistricts.json escapes): up a walkway's front from the canyon's street, by the same rules.
    // Each walks back from its spot to the front, as a pad does, and takes the front's plane and the walkway's height
    // off the collision there, so a re-bake that moves the front moves it too
    for (const d of DISTRICTS.districts) {
      const boxes = DISTRICT_SOLIDS[d.id] ?? [];
      const [w0, w1] = d.fill.walkway;
      for (const q of d.escapes) {
        const fam = (Ek.families as Record<string, EscapeFamily | undefined>)[q.family];
        if (!fam || Math.abs(St.landing - storeyH) > 0.05) continue;
        const [sx, sz] = q.spot;
        const [nx, nz] = q.out;
        for (let s = 0; s < d.padReach; s += 0.05) {
          const x = sx - nx * s;
          const z = sz - nz * s;
          const face = boxes.find(([x0, x1, z0, z1, y0, y1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1 && y0 < 1 && y1 >= w0 && y1 <= w1);
          if (!face) continue;
          const key: Side4 = nx < 0 ? "w" : nx > 0 ? "e" : nz < 0 ? "n" : "s";
          const at = nx < 0 ? face[0] : nx > 0 ? face[1] : nz < 0 ? face[2] : face[3];
          const along = nx === 0 ? sx : sz;
          const base = floorAt(sx + BR_X, sz + BR_Z);
          // the climb from the last landing where the walkway is over it, where a body stands once over the edge, with
          // nothing rising out of it there (a front can: a tower's corner stands in High City's west walkway): its end,
          // middle or other end
          const { dir } = sideOf(key);
          const uStart = dir > 0 ? along - fam.width / 2 : along + fam.width / 2;
          const climbX = [0.5, fam.width / 2, fam.width - 0.5].find((cx) => {
            const u = uStart + dir * cx;
            const [ua, ub] = [u - R - 0.05, u + R + 0.05];
            const [va, vb] = [at - (nx + nz) * 0.05, at - (nx + nz) * (2 * R + 0.1)].sort((p, q) => p - q);
            const [x0, x1, z0, z1] = nx === 0 ? [ua, ub, va, vb] : [va, vb, ua, ub];
            const over = boxes.filter((o) => o[1] > x0 && o[0] < x1 && o[3] > z0 && o[2] < z1 && o[4] < face[5] + MOVE.standHeight);
            return over.some((o) => Math.abs(o[5] - face[5]) < 0.3) && over.every((o) => o[5] < face[5] + 0.3);
          });
          // a landing each whole storey under the walkway, the climb from the last onto it
          if (climbX !== undefined) escapeAt(fam, q.family, key, at, along - fam.width / 2, along, base, face[5], Math.max(2, Math.round((face[5] - base) / storeyH)), null, true, climbX);
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------- steam (city.json steam): where it rises
  // Last, once the pads, the metro's stairwells, the parked cars and the fire escapes are where they are; from a stream
  // of its own, so the city's draws the same numbers with it
  {
    const Sm = C.steam;
    const r = seeded(C.seed ^ 0x57ea);
    const half = kitCfg.dress.centre;
    const inCentre = (x: number, z: number) => Math.abs(x) <= half && Math.abs(z) <= half;
    const clearAt = (x: number, z: number) =>
      !pads.some((p) => Math.hypot(p.x - BR_X - x, p.z - BR_Z - z) < Sm.clear) &&
      !KIT_SITES.escapes.some((e) => x > e.x0 - 1 && x < e.x1 + 1 && z > e.z0 - 1 && z < e.z1 + 1) &&
      !KIT_SITES.cars.some((c) => Math.hypot(c.x - x, c.z - z) < Sm.clear);
    // up out of the metro's stairwells
    for (const o of KIT_SITES.openings) {
      const x = (o.x0 + o.x1) / 2;
      const z = (o.z0 + o.z1) / 2;
      if (inCentre(x, z) && clearAt(x, z)) STEAM_SOURCES.push({ x: x + BR_X, y: 0, z: z + BR_Z, kind: "metro" });
    }
    // drains at the kerbs down the centre's streets, off the crossings (a street's half width and two metres)
    const lines = STREETS.filter((s) => Math.abs(s) < half);
    const crossing = (BLOCKS[1][0] - BLOCKS[0][1]) / 2 + 2;
    for (const s of lines)
      for (const alongX of [true, false])
        for (let a = -half + crossing; a < half - crossing; a += Sm.drainEvery) {
          const side = r() < 0.5 ? -1 : 1;
          const hit = r() < Sm.drainChance;
          if (!hit || lines.some((q) => Math.abs(q - a) < crossing)) continue;
          const [x, z] = alongX ? [a, s + side * Sm.drainOut] : [s + side * Sm.drainOut, a];
          if (!clearAt(x, z) || KIT_SITES.openings.some((o) => x > o.x0 - 2 && x < o.x1 + 2 && z > o.z0 - 2 && z < o.z1 + 2)) continue;
          STEAM_SOURCES.push({ x: x + BR_X, y: 0.05, z: z + BR_Z, kind: "drain" });
        }
    // off the plant on some of the centre's roofs
    for (const t of KIT_SITES.towers) {
      if (!inCentre(t.x, t.z) || !t.clutter.length || r() >= Sm.ventChance) continue;
      const c = t.clutter[0];
      STEAM_SOURCES.push({ x: c.x + BR_X, y: c.y + c.h, z: c.z + BR_Z, kind: "vent" });
    }
    STEAM_SOURCES.length = Math.min(STEAM_SOURCES.length, Math.floor(Sm.cap / Sm.perSource));
  }

  // ---------------------------------------------------------------- the decay's hold on the city
  // every box the city put in, by the sector it stands in, so a decaying
  // sector's boxes can leave the collision list as it dissolves; and every
  // material it drew with, taught to dissolve (cityDecay, below)
  DECAY.solids = RANGE_SOLIDS.slice(firstSolid).map((s) => ({ s, sector: SECTORS.findIndex((x) => sectorContains(x, (s.minX + s.maxX) / 2 - BR_X, (s.minZ + s.maxZ) / 2 - BR_Z)) }));
  const mats = new Set<THREE.Material>();
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (m && !Array.isArray(m)) mats.add(m);
  });
  for (const m of mats) teachDecay(m);

  return {
    root,
    pois,
    sites,
    placeAt,
    nodes,
    ringWall,
    towers: towerSpots,
    beacons,
    pads,
    doors: new Doors(root, { x: BR_X, z: BR_Z }, DOORWAYS),
    // no vault in the city (SpeedKills' loot is guns and hacks)
    vault: { door: -1, ...P(0, 0), y: 0, post: P(0, 0) },
    scenery: { rocks: [], boxed: [], scrub: [], cliffs: [], flora: [] },
  };
}

/** a zipline with its rope and a post at each end, recorded in world space (as br.ts's) */
function zipline(root: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, floorA: number, floorB: number): void {
  const ropeMat = emissive(0x20e0ff, 1.2);
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  const ra = a.clone().addScaledVector(dir, -0.6);
  const rb = b.clone().addScaledVector(dir, 0.6);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, ra.distanceTo(rb), 8), ropeMat);
  rope.position.copy(ra).lerp(rb, 0.5);
  rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(rb, ra).normalize());
  root.add(rope);
  const poleMat = flat(0x14161c, 0.55, 0.5);
  for (const [p, floor] of [
    [ra, floorA],
    [rb, floorB],
  ] as const) {
    const h = p.y + 0.35 - floor;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, h, 0.22), poleMat);
    post.position.set(p.x, floor + h / 2, p.z);
    root.add(post);
  }
  ZIPLINES.push({ a: new THREE.Vector3(a.x + BR_X, a.y, a.z + BR_Z), b: new THREE.Vector3(b.x + BR_X, b.y, b.z + BR_Z) });
}

const sectorContains = (s: Sector, x: number, z: number): boolean => x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ;

/**
 * The decay's hold on the city: the shader's numbers every city material
 * reads (each sector's rectangle in world space, how high it has dissolved,
 * whether it is warned), and the city's boxes by sector with the ones taken
 * out of the collision list so far.
 */
/** the edge's fence (Phase 20 A4): its material and texture, which cityEdge brightens near you and scrolls */
let FENCE: { mat: THREE.MeshBasicMaterial; tex: THREE.Texture; base: number } | null = null;

/** the fence a frame on: its lines climb, and it brightens as you come within nearAt metres of it */
export function cityEdge(now: number, near: number): void {
  if (!FENCE) return;
  const F = cityCfg.edge.fence;
  FENCE.tex.offset.y = -((now * F.scroll) % 1);
  FENCE.mat.opacity = F.opacity + (F.nearOpacity - F.opacity) * Math.max(0, 1 - near / F.nearAt);
}

const DECAY = {
  rect: SECTORS.map((s) => new THREE.Vector4(s.minX + BR_X, s.minZ + BR_Z, s.maxX + BR_X, s.maxZ + BR_Z)),
  level: { value: SECTORS.map(() => -1) },
  warn: { value: SECTORS.map(() => 0) },
  time: { value: 0 },
  solids: [] as Array<{ s: Solid; sector: number }>,
  removed: new Set<Solid>(),
};

/**
 * A material that dissolves where the decay has reached: under a decaying
 * sector's line it is not drawn, a band just above the line glows magenta,
 * and a warned sector's surfaces pulse. One patch, shared by every city
 * material, so the whole city dissolves as one thing.
 */
function teachDecay(m: THREE.Material): void {
  if (m.userData.decay) return;
  m.userData.decay = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, r) => {
    prev?.call(m, shader, r);
    shader.uniforms.uSkRect = { value: DECAY.rect };
    shader.uniforms.uSkLevel = DECAY.level;
    shader.uniforms.uSkWarn = DECAY.warn;
    shader.uniforms.uSkTime = DECAY.time;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSkWorld;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSkWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    const n = SECTORS.length;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vSkWorld;
uniform vec4 uSkRect[${n}];
uniform float uSkLevel[${n}];
uniform float uSkWarn[${n}];
uniform float uSkTime;
vec3 skGlow = vec3(0.0);`
      )
      .replace(
        "void main() {",
        `void main() {
  for (int i = 0; i < ${n}; i++) {
    vec4 r = uSkRect[i];
    if (vSkWorld.x < r.x || vSkWorld.x > r.z || vSkWorld.z < r.y || vSkWorld.z > r.w) continue;
    float jag = fract(sin(dot(floor(vSkWorld.xz * 0.8), vec2(12.9898, 78.233))) * 43758.5453) * 1.4;
    float line = uSkLevel[i] - jag;
    // the ground stays, corrupted red: it is where you still stand while the decay hurts you
    if (uSkLevel[i] >= 0.0 && vSkWorld.y <= 0.25) { skGlow += vec3(0.55, 0.02, 0.12); continue; }
    if (uSkLevel[i] >= 0.0 && vSkWorld.y < line) discard;
    if (uSkLevel[i] >= 0.0 && vSkWorld.y < line + 1.6) skGlow += vec3(1.0, 0.18, 0.6) * (1.0 - (vSkWorld.y - line) / 1.6) * 3.0;
    if (uSkWarn[i] > 0.0) skGlow += vec3(1.0, 0.18, 0.6) * (0.25 + 0.25 * sin(uSkTime * 6.0)) * uSkWarn[i];
  }`
      )
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += skGlow;");
  };
  m.customProgramCacheKey = () => "skdecay";
  m.needsUpdate = true;
}

/**
 * The city as the decay has it now (decay.ts sectorPhases, by sector id):
 * a decaying sector dissolved up to its line, a gone one entirely, a warned
 * one pulsing; the boxes under a line taken out of the collision list, and
 * every box put back once nothing is decaying (a match over, the range).
 * Returns how many boxes the decay holds out now, for the tests.
 */
export function cityDecay(states: Record<string, { phase: SectorPhase; k: number }> | null, now: number): number {
  DECAY.time.value = now;
  const levels = SECTORS.map((s) => {
    const st = states?.[s.id];
    if (!st || st.phase === "live" || st.phase === "warning") return -1;
    return st.phase === "gone" ? dissolvedTo(1) + 100 : dissolvedTo(st.k);
  });
  SECTORS.forEach((s, i) => {
    DECAY.level.value[i] = levels[i];
    DECAY.warn.value[i] = states?.[s.id]?.phase === "warning" ? 1 : 0;
  });
  // the collision list: out below the lines, back where there is no line
  let changed = false;
  for (const { s, sector } of DECAY.solids) {
    // not what is under the street (the metro, and the street's slab over it, top 0): the decay's damage finds you
    // down there, and the street stays a floor
    const out = sector >= 0 && levels[sector] >= 0 && s.top > 0.001 && s.base < levels[sector];
    if (out && !DECAY.removed.has(s)) {
      DECAY.removed.add(s);
      changed = true;
    } else if (!out && DECAY.removed.has(s)) {
      DECAY.removed.delete(s);
      RANGE_SOLIDS.push(s);
    }
  }
  if (changed) {
    let j = 0;
    for (const s of RANGE_SOLIDS) if (!DECAY.removed.has(s)) RANGE_SOLIDS[j++] = s;
    RANGE_SOLIDS.length = j;
  }
  return DECAY.removed.size;
}
