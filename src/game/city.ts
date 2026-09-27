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
/** the chimneys (city.json chimneys): each one's walls' inner faces, its length and its landing heights, world metres, for the checks that climb them */
export const CHIMNEYS: Array<{ name: string; x: number; innerW: number; z0: number; z1: number; base: number; landing: number; top: number }> = [];
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
export const KIT_SITES: {
  towers: Array<{ x: number; z: number; w: number; d: number; base: number; roof: number; storeys: number; lobby?: number; sector: string; clutter: Array<{ x: number; z: number; y: number; w: number; h: number; d: number }> }>;
  podia: Array<{ key: string; x0: number; x1: number; z0: number; z1: number; top: number; plaza: number; spire: boolean }>;
  stairs: Array<{ x0: number; x1: number; z0: number; z1: number }>;
  skyline: Array<{ x: number; z: number; w: number; h: number }>;
  lamps: Array<[number, number]>;
} = { towers: [], podia: [], stairs: [], skyline: [], lamps: [] };

export function buildCityMap(scene: THREE.Scene): BrMap {
  const C = cityCfg;
  const root = new THREE.Group();
  root.name = "br";
  root.position.set(BR_X, 0, BR_Z);
  scene.add(root);
  DOORWAYS.length = 0;
  DRESSING.length = 0;
  const rnd = seeded(C.seed);
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

  // ---------------------------------------------------------------- ground
  // the streets, one plane under everything (the floor at 0 is the world's own)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(BR_HALF * 2 + 40, BR_HALF * 2 + 40), street);
  ground.rotation.x = -Math.PI / 2;
  (ground.geometry.attributes.uv as THREE.BufferAttribute).array.forEach((_, i, a) => ((a as Float32Array)[i] *= (BR_HALF * 2 + 40) / 8));
  ground.receiveShadow = true;
  root.add(ground);

  // ---------------------------------------------------------------- blocks
  /** a tower, and the street its way up comes off: the side its route's door is on, and that street's line (local) */
  type Tower = { x: number; z: number; w: number; d: number; roof: number; storeys: number; sector: string; route: RoutePoint[]; street: { side: Side; line: number } | null; base?: number; lobby?: number; lobbyMat?: THREE.Material; bridges?: Partial<Record<"n" | "s" | "w" | "e", number>>; decks?: Set<string> };
  const towers: Tower[] = [];
  const plazas: Array<{ x: number; z: number }> = [];
  const PAVE_H = C.kerb;
  const storeyH = C.storey;
  /** the jump pads on the podiums and the terraces (city.json downtown padUp), and the road's */
  const pads: BrMap["pads"] = [];
  /** the core's podiums by block ("i,j"), their tops: the concourse's bridges join them */
  const podia = new Map<string, { x0: number; x1: number; z0: number; z1: number; top: number }>();
  CONCOURSE.stairs.length = 0;
  KIT_SITES.towers.length = KIT_SITES.podia.length = KIT_SITES.stairs.length = KIT_SITES.skyline.length = KIT_SITES.lamps.length = 0;
  /** the public stairs' footprints (local): a bridge landing across one blocked it (the concourse check found it) */
  const stairZones: Array<{ x0: number; x1: number; z0: number; z1: number }> = [];
  CONCOURSE.bridges.length = 0;
  CONCOURSE.spire.length = 0;
  /** where each jump pad lands you (local), by its index in pads: the graph's one-way steps up */
  const padLands: Array<{ pad: number; x: number; z: number; y: number }> = [];
  /** the Spire's block, whose podium the concourse's graph marks */
  let spireKey = "";
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
  const padOnto = (fx: number, fz: number, nx: number, nz: number, floor: number, roof: number): void => {
    const g = MOVE.gravity;
    const H = roof - floor;
    const v = Math.sqrt(2 * g * (H + PAD_SOLVE.peakOver));
    // the pad a body and a little off the face; straight up, then over the edge once above it
    const d0 = MOVE.radius + PAD_SOLVE.standOff;
    const overY = roof + PAD_SOLVE.clear;
    // from there, up to the peak and down to the roof: the time the push has to carry you d0 + landInside
    const vOver = Math.sqrt(Math.max(0, v * v - 2 * g * (H + PAD_SOLVE.clear)));
    const t = vOver / g + Math.sqrt((2 * PAD_SOLVE.peakOver) / g);
    const vx = (d0 + PAD_SOLVE.landInside) / t;
    pads.push({ ...W(fx + nx * d0, fz + nz * d0), dx: -nx * vx, dz: -nz * vx, y: floor, up: v, over: overY });
    padLands.push({ pad: pads.length - 1, x: fx - nx * PAD_SOLVE.landInside, z: fz - nz * PAD_SOLVE.landInside, y: roof });
  };
  BLOCKS.forEach(([x0, x1], bi) => {
    BLOCKS.forEach(([z0, z1], bj) => {
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const sec = sectorAt(cx, cz)!;
      // the pavement: the block's floor, a kerb above the street
      slab(x1 - x0, PAVE_H, z1 - z0, cx, 0, cz, pave);
      // neon along the kerb, the district's colour
      const k = neon(sec.accent);
      deco(x1 - x0, 0.06, 0.12, cx, PAVE_H, z0 + 0.06, k);
      deco(x1 - x0, 0.06, 0.12, cx, PAVE_H, z1 - 0.06, k);
      deco(0.12, 0.06, z1 - z0, x0 + 0.06, PAVE_H, cz, k);
      deco(0.12, 0.06, z1 - z0, x1 - 0.06, PAVE_H, cz, k);
      const ring = Math.max(Math.abs(bi - 3), Math.abs(bj - 3));
      const centre = bi === 3 && bj === 3;
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
    });
  });

  /**
   * A mass: a solid building of one box, a storey at a time tall, standing on
   * `base`, its roof a floor with a parapet, neon on its edges and clutter to
   * take cover behind. No inside: the downtown's are climbed, not entered.
   */
  /** `r`: the random stream its roof's clutter draws from (the city's own unless a caller keeps that stream as it was) */
  function mass(x: number, z: number, w: number, d: number, base: number, storeys: number, mat: THREE.Material, accent: number, sector: string, lobby = false, r: () => number = rnd): Tower {
    const h = storeys * storeyH;
    // the Sky Lobby's floor, when this tower is open for it (city.json skyLobby): below it, over it, and two storeys
    // at least above it
    const Lb = C.skyLobby;
    const ly = PAVE_H + Lb.storey * storeyH;
    const open = lobby && base < ly - 0.5 && base + h >= ly + 2 * storeyH;
    if (open) {
      // the mass below and the mass above; the lobby's storey between is built once its pads are placed, since a
      // window goes where its pad can stand (the window pads, below)
      slab(w, ly - base, d, x, base, z, mat);
      slab(w, base + h - 0.12 - (ly + storeyH), d, x, ly + storeyH, z, mat);
    } else {
      // the walls, and a concrete cap: a facade's lit windows are for its sides, not the floor you stand on
      slab(w, h - 0.12, d, x, base, z, mat);
    }
    slab(w, 0.12, d, x, base + h - 0.12, z, concrete);
    const roof = base + h;
    const k = neon(accent);
    // the roof's parapet, knee high: cover on a roof, and nothing a climb catches on
    slab(w, 0.7, 0.25, x, roof, z - d / 2 + 0.125, trimDark);
    slab(w, 0.7, 0.25, x, roof, z + d / 2 - 0.125, trimDark);
    slab(0.25, 0.7, d - 0.5, x - w / 2 + 0.125, roof, z, trimDark);
    slab(0.25, 0.7, d - 0.5, x + w / 2 - 0.125, roof, z, trimDark);
    deco(w + 0.1, 0.1, 0.1, x, roof + 0.7, z - d / 2, k);
    deco(w + 0.1, 0.1, 0.1, x, roof + 0.7, z + d / 2, k);
    deco(0.1, 0.1, d + 0.1, x - w / 2, roof + 0.7, z, k);
    deco(0.1, 0.1, d + 0.1, x + w / 2, roof + 0.7, z, k);
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
      slab(cw, ch, cd, x + ox, roof, z + oz, metal);
      clutter.push({ x: x + ox, z: z + oz, y: roof, w: cw, h: ch, d: cd });
    }
    const t: Tower = { x, z, w, d, roof, storeys, sector, route: [], street: null, base, lobby: open ? ly : undefined, lobbyMat: open ? mat : undefined };
    towers.push(t);
    KIT_SITES.towers.push({ x, z, w, d, base, roof, storeys, lobby: open ? ly : undefined, sector, clutter });
    return t;
  }

  /**
   * One storey of a tower open as the Sky Lobby (city.json skyLobby): a floor, and every face a wall with a window in
   * its middle from the floor up, so it is a room you run through, and across a canyon a jump from window to window.
   * The north and south walls run the tower's width, the east and west fit between them.
   */
  /** `at`: each face's window, how far along the face from its middle (north, south, west, east); `lit`, the faces with a pad, whose window is framed in light */
  function skyLobby(x: number, z: number, w: number, d: number, ly: number, mat: THREE.Material, at: { n: number; s: number; w: number; e: number }, lit: Set<string>): void {
    const Lb = C.skyLobby;
    const t = Lb.wall;
    const win = Lb.width;
    const H = Lb.height;
    const lintel = storeyH - H;
    // a wall from a to b along its face with the window's middle at c: the piece either side, the lintel over it
    const wall = (a: number, b: number, c: number, put: (from: number, to: number, y: number, h: number) => void) => {
      put(a, c - win / 2, ly, storeyH);
      put(c + win / 2, b, ly, storeyH);
      put(c - win / 2, c + win / 2, ly + H, lintel);
    };
    // along x, at each end in z
    for (const [s, o, k] of [
      [-1, at.n, "n"],
      [1, at.s, "s"],
    ] as const) {
      const wz = z + s * (d / 2 - t / 2);
      wall(x - w / 2, x + w / 2, x + o, (a, b, y, h) => slab(b - a, h, t, (a + b) / 2, y, wz, mat));
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
      wall(z - d / 2 + t, z + d / 2 - t, z + o, (a, b, y, h) => slab(t, h, b - a, wx, y, (a + b) / 2, mat));
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
    // the podium: lit floors over the street, a cap to walk on, and a shopfront's glow along its foot
    const podMat = night[Math.floor(rnd() * night.length)];
    slab(px1 - px0, podS * storeyH - 0.12, pz1 - pz0, pcx, PAVE_H, pcz, podMat);
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
      const t = mass((a0 + ia0 + a1 - ia1) / 2, (b0 + ib0 + b1 - ib1) / 2, w, d, podTop, storeys, mat, sec.accent, sec.id, true);
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
      for (const [dx, dz, w, d] of [
        [-22, -22, 10, 1],
        [22, 22, 10, 1],
        [-22, 22, 1, 10],
        [22, -22, 1, 10],
      ] as const) {
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
      for (const [dx, dz, h] of spots) drum(5.5, h, cx + dx, g, cz + dz, metal, k);
      // catwalks at 16 m between neighbours, and a pad up to them
      for (const [ax, az, bx, bz] of [
        [-14, -14, 0, -14],
        [0, -14, 14, -14],
        [-14, 12, 0, 12],
        [0, 12, 14, 12],
        [0, -14, 0, 12],
      ] as const) {
        const len = Math.hypot(bx - ax, bz - az);
        const along = ax !== bx;
        slab(along ? len : 2.2, 0.3, along ? 2.2 : len, cx + (ax + bx) / 2, g + 16 - 0.3, cz + (az + bz) / 2, metal);
        deco(along ? len : 0.08, 0.08, along ? 0.08 : len, cx + (ax + bx) / 2 + (along ? 0 : 1.1), g + 17, cz + (az + bz) / 2 + (along ? 1.1 : 0), k);
      }
      padOnto(cx - 14 - 5.5, cz - 14, -1, 0, g, g + 20);
      padOnto(cx + 14 + 5.5, cz + 12, 1, 0, g, g + 24);
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
      const field = 24;
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
      let w = 46;
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
        w -= 8;
      }
      padOnto(cx, cz + 23, 0, 1, g, g + 2 * S);
    } else if (kind === "gantry") {
      // THE YARDS: two gantry cranes across the block over stacks of containers, their beams walkable
      const cols = [0x2f5d7a, 0x7a3a2f, 0x3a6a3a, 0x7a6a2a].map((c) => flat(c, 0.55, 0.3));
      for (let i = 0; i < 14; i++) {
        const along = rnd() < 0.5;
        const tiers = 1 + Math.floor(rnd() * 3);
        const x = cx + (rnd() - 0.5) * 44;
        const z = cz + (rnd() - 0.5) * 44;
        for (let t = 0; t < tiers; t++) slab(along ? 12 : 2.5, 2.6, along ? 2.5 : 12, x, g + t * 2.6, z, cols[(i + t) % cols.length]);
      }
      for (const dz of [-12, 12]) {
        for (const dx of [-24, 24]) slab(1.2, 20, 1.2, cx + dx, g, cz + dz, metal);
        slab(49, 1.2, 3, cx, g + 20, cz + dz, metal);
        deco(49, 0.1, 0.1, cx, g + 21.25, cz + dz - 1.45, k);
        padOnto(cx - 24 - 0.6, cz + dz, -1, 0, g, g + 21.2);
      }
    } else if (kind === "station") {
      // SKYHAVEN: a station raised on pillars, its platform a storey and a half up, stairs at both ends
      const y = g + 6;
      slab(44, 0.4, 14, cx, y - 0.4, cz, concrete);
      for (const dx of [-18, -6, 6, 18]) for (const dz of [-5, 5]) slab(1, y - g - 0.4, 1, cx + dx, g, cz + dz, metal);
      slab(46, 0.3, 16, cx, y + 7, cz, trimDark);
      for (const dx of [-21, 21]) for (const dz of [-6.5, 6.5]) slab(0.6, 7, 0.6, cx + dx, y, cz + dz, metal);
      deco(46, 0.12, 0.12, cx, y + 7, cz - 8, k);
      deco(46, 0.12, 0.12, cx, y + 7, cz + 8, k);
      for (const side of [-1, 1]) {
        const steps = 12;
        for (let i = 0; i < steps; i++) slab(3, (i + 1) * 0.5, 0.9, cx + side * 20, g, cz + side * (6.55 + (steps - i) * 0.9), concrete);
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
    // a tier past the ones the city always had draws from its own stream, so the blocks built after this one stand as they did
    const own = seeded(C.seed + 1);
    S.tiers.forEach((storeys, tier) => {
      const floor = base;
      w -= 2 * S.tierInset;
      d -= 2 * S.tierInset;
      const t = mass(cx, cz, w, d, base, storeys, tier === S.tiers.length - 1 ? glass : night[tier % night.length], sec.accent, sec.id, false, tier < S.sharedTiers ? rnd : own);
      base = t.roof;
      // a pad on the terrace below this tier, up its east face onto its roof
      padOnto(cx + w / 2, cz, 1, 0, floor, t.roof);
    });
    // the mast
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
      const lines = [-BR_HALF + 7, ...STREETS, BR_HALF - 7];
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
      for (const s of [-1, 1]) {
        const wx = c.x + s * (Ch.width / 2 + Ch.wall / 2);
        slab(Ch.wall, top + 0.4 - base, len, wx, base, mid, concrete);
        // the chain line, on the inner face at a wall run's height
        deco(0.04, 0.12, len, c.x + s * (Ch.width / 2 + 0.02), base + 2.2, mid, lit);
      }
      // closed at the far end, so a chain that comes in high runs into the end and drops onto the landing
      // rather than flying out of the open end (the proof found exactly that)
      slab(Ch.width + Ch.wall * 2, top + 0.4 - base, Ch.wall, c.x, base, c.z0 - Ch.wall / 2, concrete);
      // and closed above the landing at the near end, the way in staying open below it: the second leg comes in
      // high there too
      slab(Ch.width + Ch.wall * 2, top + 0.4 - landing, Ch.wall, c.x, landing, c.z1 + Ch.wall / 2, concrete);
      // the landing at the far end, one storey up, and the top at the near end, two
      slab(Ch.width, 0.3, Ch.landing, c.x, landing - 0.3, c.z0 + Ch.landing / 2, metal);
      slab(Ch.width, 0.3, Ch.landing, c.x, top - 0.3, c.z1 - Ch.landing / 2, metal);
      CHIMNEYS.push({ name: c.name, x: c.x + BR_X, innerW: Ch.width, z0: c.z0 + BR_Z, z1: c.z1 + BR_Z, base, landing, top });
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
  // leave those faces to them.
  {
    const Lb = C.skyLobby;
    const lob = towers.filter((t) => t.lobby !== undefined);
    const done = new Set<string>();
    LOBBY_BRIDGES.length = 0;
    LOBBY_CANYONS.length = 0;
    for (const a of lob) {
      for (const b of lob) {
        if (a === b || a.lobby !== b.lobby) continue;
        const key = [a, b].map((t) => `${t.x.toFixed(0)},${t.z.toFixed(0)}`).sort().join("|");
        if (done.has(key)) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const alongX = Math.abs(dx) > Math.abs(dz);
        const gap = alongX ? Math.abs(dx) - (a.w + b.w) / 2 : Math.abs(dz) - (a.d + b.d) / 2;
        if (gap < 2 || gap > Lb.bridge) continue;
        const canyon = gap <= Lb.canyon;
        // no third tower's lobby between the two
        const between = lob.some((t) => t !== a && t !== b && (alongX ? (t.x - a.x) * (t.x - b.x) < 0 && Math.abs(t.z - (a.z + b.z) / 2) < (t.d + Math.min(a.d, b.d)) / 2 : (t.z - a.z) * (t.z - b.z) < 0 && Math.abs(t.x - (a.x + b.x) / 2) < (t.w + Math.min(a.w, b.w)) / 2));
        if (between) continue;
        // a window's room along each face: an x bridge meets the west and east faces, which run along z between
        // the north and south walls; a z bridge meets the north and south, the tower's width
        const room = (t: Tower) => (alongX ? t.d - 2 * Lb.wall : t.w) / 2 - Lb.width / 2 - Lb.corner;
        const ca = alongX ? a.z : a.x;
        const cb = alongX ? b.z : b.x;
        const lo = Math.max(ca - room(a), cb - room(b));
        const hi = Math.min(ca + room(a), cb + room(b));
        if (lo > hi) continue;
        done.add(key);
        const c = (lo + hi) / 2;
        const y = a.lobby!;
        const fa = alongX ? (dx > 0 ? "e" : "w") : dz > 0 ? "s" : "n";
        const fb = alongX ? (dx > 0 ? "w" : "e") : dz > 0 ? "n" : "s";
        a.bridges = { ...a.bridges, [fa]: c - ca };
        b.bridges = { ...b.bridges, [fb]: c - cb };
        // a bridge's faces carry its deck; a canyon's keep a pad in line with the window, when there is room for one
        if (!canyon) for (const [t, f] of [[a, fa], [b, fb]] as const) (t.decks ??= new Set()).add(f);
        if (canyon) {
          LOBBY_CANYONS.push(alongX ? { ax: a.x + Math.sign(dx) * (a.w / 2) + BR_X, az: c + BR_Z, bx: b.x - Math.sign(dx) * (b.w / 2) + BR_X, bz: c + BR_Z, y } : { ax: c + BR_X, az: a.z + Math.sign(dz) * (a.d / 2) + BR_Z, bx: c + BR_X, bz: b.z - Math.sign(dz) * (b.d / 2) + BR_Z, y });
          continue;
        }
        const from = alongX ? a.x + Math.sign(dx) * (a.w / 2) : a.z + Math.sign(dz) * (a.d / 2);
        const to = alongX ? b.x - Math.sign(dx) * (b.w / 2) : b.z - Math.sign(dz) * (b.d / 2);
        const mid = (from + to) / 2;
        const len = Math.abs(to - from);
        // the deck at the lobby's floor, its rails and their neon, as a skybridge's
        const box = (along: number, h: number, across: number, at: number, yy: number, off: number, mat: THREE.Material, isSolid = true) =>
          alongX ? slab(along, h, across, at, yy, c + off, mat, isSolid) : slab(across, h, along, c + off, yy, at, mat, isSolid);
        box(len, 0.3, 3.2, mid, y - 0.3, 0, metal);
        for (const s of [-1, 1]) {
          box(len, 1.0, 0.08, mid, y, s * 1.6, trimDark);
          box(len, 0.05, 0.05, mid, y + 1.05, s * 1.55, neon(0x20e0ff), false);
        }
        LOBBY_BRIDGES.push(alongX ? { ax: from + BR_X, az: c + BR_Z, bx: to + BR_X, bz: c + BR_Z, y } : { ax: c + BR_X, az: from + BR_Z, bx: c + BR_X, bz: to + BR_Z, y });
      }
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
  for (const sx of STREETS) {
    for (const sz of STREETS) {
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
  const far = new THREE.Mesh(new THREE.PlaneGeometry(C.skyline.to * 2.4, C.skyline.to * 2.4), flat(0x07080c, 0.95, 0));
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
      }
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
  for (const s of SECTORS) {
    const k = neon(s.accent);
    deco(s.maxX - s.minX, 0.03, 0.3, (s.minX + s.maxX) / 2, 0.02, s.minZ + 0.15, k);
    deco(0.3, 0.03, s.maxZ - s.minZ, s.minX + 0.15, 0.02, (s.minZ + s.maxZ) / 2, k);
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
    const car = (x: number, z: number, alongX: boolean, facing: number): void => {
      const body = bodies[Math.floor(rnd() * bodies.length)];
      const [w, d] = alongX ? [cl, cw] : [cw, cl];
      slab(w, ch, d, x, 0.25, z, body);
      slab(alongX ? kl : kw, kh, alongX ? kw : kl, x - (alongX ? facing * 0.3 : 0), 0.25 + ch, z - (alongX ? 0 : facing * 0.3), glassDark);
      // wheels' shadow under it: the body stands on its own dark sill
      deco(w - 0.6, 0.25, d - 0.2, x, 0, z, trimDark);
      for (const [end, mat] of [
        [1, head],
        [-1, tail],
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
            // and clear of a door's way in from the street: the bots cross the lane to it (sk-roofs walks it)
            if (nearPad(x, z) || DOORWAYS.some((dw) => (alongX ? Math.abs(dw.x - x) < cl / 2 + 3 && Math.abs(dw.z - z) < 14 : Math.abs(dw.z - z) < cl / 2 + 3 && Math.abs(dw.x - x) < 14))) continue;
            car(x, z, alongX, lane);
          }
        }
      }
    }
    // Zebra crossings on a junction's four sides, stripes lengthwise with the traffic. One instanced mesh of flat
    // quads: as 864 boxes they were 10k of the city's triangles (city-budget.ts), for paint on a road.
    const stripes: Array<[number, number, boolean]> = [];
    for (const sx of STREETS) {
      for (const sz of STREETS) {
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

  // ---------------------------------------------------------------- places, the graph, the traversal
  const P = (x: number, z: number) => ({ x: x + BR_X, z: z + BR_Z });
  const pois: Poi[] = SECTORS.map((s) => {
    const inside = STREETS.flatMap((x) => STREETS.map((z) => [x, z] as const)).filter(([x, z]) => x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ);
    const mid = { x: (s.minX + s.maxX) / 2, z: (s.minZ + s.maxZ) / 2 };
    const drops = (inside.length ? inside : [[mid.x, mid.z] as const]).map(([x, z]) => P(x, z));
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
  const line = [-BR_HALF + 7, ...STREETS, BR_HALF - 7];
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
  for (let i = 0; i < line.length; i++) {
    for (let j = 0; j < line.length; j++) {
      // a street runs along i where j is a street (not an edge), and the other way
      const onStreetI = j > 0 && j < line.length - 1;
      const onStreetJ = i > 0 && i < line.length - 1;
      if (!onStreetI && !onStreetJ) continue;
      if (onStreetI && i + 1 < line.length) link(at(i, j), at(i + 1, j));
      if (onStreetJ && j + 1 < line.length) link(at(i, j), at(i, j + 1));
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
    for (const s of CONCOURSE.stairs) {
      const [f, t, l] = s.legs.map((q) => ({ x: q.x - BR_X, z: q.z - BR_Z }));
      const foot = add(f.x, f.z, PAVE_H);
      const top = add(t.x, t.z, s.top);
      const land = add(l.x, l.z, s.top);
      walkLink(foot, top);
      walkLink(top, land);
      onPodium(land);
      // the foot to its street: straight out to the nearer street's middle, then along it to the crossings either side
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
    }
    for (const b of CONCOURSE.bridges) {
      const a = add(b.a.x - BR_X, b.a.z - BR_Z, b.y);
      const e = add(b.b.x - BR_X, b.b.z - BR_Z, b.y);
      walkLink(a, e);
      onPodium(a);
      onPodium(e);
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
      if (!centre(px, pz)) continue;
      padNode.set(l.pad, add(px, pz, p.y ?? 0));
    }
    const landNode = new Map<number, number>();
    for (const l of padLands) if (padNode.has(l.pad)) landNode.set(l.pad, add(l.x, l.z, l.y));
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
      // the landing, on to what stands on its roof (a podium's corners, the next tier's pad)
      for (const i of near(ln, pn)) walkLink(ln, i);
    }
  }

  // the jump towers in the plazas, the launch pads at the crossings, the beacons
  const towerSpots = plazas.slice(0, C.jumpTowers).map((p) => ({ ...P(p.x, p.z), y: PAVE_H }));
  STREETS.forEach((x, i) =>
    STREETS.forEach((z, j) => {
      if ((i + j) % 2 !== 0) return;
      const along = (i + j) % 4 === 0;
      pads.push({ ...P(x + (along ? 3 : 0), z + (along ? 0 : 3)), dx: along ? 1 : 0, dz: along ? 0 : 1 });
    })
  );
  // A road's pad is a cyan plate. A jump pad is what Hyper Scape's were, readable from a street away: a gold
  // disc on its floor, a beam of light up to where it throws you, and gold rings on the beam, one overhead and
  // one at the roof it lands you on. None of it is solid, and none of it casts a shadow.
  const gold = emissive(0xffc23c, 2.2);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const discGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.12, 24);
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
        const tries = lined !== undefined ? [lined] : [0, Lb.slide * len, -Lb.slide * len].map((o) => Math.max(-room, Math.min(room, o)));
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
  const winDiscGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.12, 16);
  for (const p of pads) {
    const x = p.x - BR_X;
    const z = p.z - BR_Z;
    if (p.up === undefined) {
      deco(2.4, 0.08, 2.4, x, 0.01, z, neon(0x20e0ff));
      continue;
    }
    if (p.hold !== undefined) {
      const y0 = p.y ?? 0;
      const top = p.over ?? y0;
      put(new THREE.Mesh(winDiscGeo, blue), x, y0 + 0.07, z);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, top - y0, 8, 1, true), beamMat);
      put(beam, x, (y0 + top) / 2, z);
      const ring = new THREE.Mesh(winRingGeo, blue);
      ring.rotation.x = Math.PI / 2;
      put(ring, x, top, z);
      continue;
    }
    const y0 = p.y ?? 0;
    const top = p.over ?? y0 + (p.up * p.up) / (2 * MOVE.gravity);
    put(new THREE.Mesh(discGeo, gold), x, y0 + 0.07, z);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, top - y0 + 4, 10, 1, true), beamMat);
    put(beam, x, (y0 + top + 4) / 2, z);
    for (const ry of [y0 + 3.2, top]) {
      const ring = new THREE.Mesh(ringGeo, gold);
      ring.rotation.x = Math.PI / 2;
      put(ring, x, ry, z);
    }
  }
  const beacons = plazas.slice(C.jumpTowers, C.jumpTowers + C.beacons).map((p) => P(p.x, p.z));

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
    const out = sector >= 0 && levels[sector] >= 0 && s.base < levels[sector];
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
