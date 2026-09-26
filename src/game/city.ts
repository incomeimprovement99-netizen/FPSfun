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
  type Tower = { x: number; z: number; w: number; d: number; roof: number; storeys: number; sector: string; route: RoutePoint[]; street: { side: Side; line: number } | null };
  const towers: Tower[] = [];
  const plazas: Array<{ x: number; z: number }> = [];
  const PAVE_H = C.kerb;
  const storeyH = C.storey;
  /** the jump pads on the podiums and the terraces (city.json downtown padUp), and the road's */
  const pads: BrMap["pads"] = [];
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
        spireBlock(x0, x1, z0, z1, sec);
        return;
      }
      // the downtown, from the centre out (city.json downtown)
      if (ring <= C.downtown.rings) {
        downtownBlock(x0, x1, z0, z1, sec, ring);
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
  function mass(x: number, z: number, w: number, d: number, base: number, storeys: number, mat: THREE.Material, accent: number, sector: string): Tower {
    const h = storeys * storeyH;
    // the walls, and a concrete cap: a facade's lit windows are for its sides, not the floor you stand on
    slab(w, h - 0.12, d, x, base, z, mat);
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
    const n = cMin + Math.floor(rnd() * (cMax - cMin + 1));
    for (let i = 0; i < n; i++) {
      const cw = 1.6 + rnd() * 2.4;
      const cd = 1.2 + rnd() * 1.8;
      const ch = 1.2 + rnd() * 1.4;
      const ox = (rnd() - 0.5) * Math.max(0, w - cw - 2);
      const oz = (rnd() - 0.5) * Math.max(0, d - cd - 2);
      slab(cw, ch, cd, x + ox, roof, z + oz, metal);
    }
    const t: Tower = { x, z, w, d, roof, storeys, sector, route: [], street: null };
    towers.push(t);
    return t;
  }

  /**
   * A downtown block (city.json downtown): a podium over most of it, one side
   * left a plaza at street level, and two to four towers on the podium split
   * by canyons a double jump clears. A jump pad on the plaza throws you onto
   * the podium; one on the podium's terrace throws you up to a tower's roof.
   */
  function downtownBlock(x0: number, x1: number, z0: number, z1: number, sec: Sector, ring: number): void {
    const D = C.downtown;
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
      // a ledge round each tower on the podium's edge, a body wide
      const w = a1 - a0 - 1.6;
      const d = b1 - b0 - 1.6;
      if (w < 6 || d < 6) return;
      const storeys = Math.round(lo + rnd() * (hi - lo));
      const mat = rnd() < 0.3 ? glass : night[Math.floor(rnd() * night.length)];
      const t = mass((a0 + a1) / 2, (b0 + b1) / 2, w, d, podTop, storeys, mat, sec.accent, sec.id);
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

  /** THE SPIRE (city.json spire): a podium over its block, tiers stepping in above it, a pad up each, a mast on top */
  function spireBlock(x0: number, x1: number, z0: number, z1: number, sec: Sector): void {
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
    for (let tier = 0; tier < S.tiers; tier++) {
      const floor = base;
      w -= 2 * S.tierInset;
      d -= 2 * S.tierInset;
      const t = mass(cx, cz, w, d, base, S.tierStoreys, tier === S.tiers - 1 ? glass : night[tier % night.length], sec.accent, sec.id);
      base = t.roof;
      // a pad on the terrace below this tier, up its east face onto its roof
      padOnto(cx + w / 2, cz, 1, 0, floor, t.roof);
    }
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
  function tower(o: { x: number; z: number; w: number; d: number; storeys: number; sector: Sector; mat: THREE.Material; accent: number; doors: Side[]; block?: { x0: number; x1: number; z0: number; z1: number } }): Tower {
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
      windows: ["n", "s", "e", "w"],
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
  for (const sx of STREETS) {
    for (const sz of STREETS) {
      for (const [ox, oz] of [
        [-6.4, -6.4],
        [6.4, 6.4],
      ] as const) {
        slab(0.25, 6, 0.25, sx + ox, 0, sz + oz, metal);
        deco(1.4, 0.12, 0.3, sx + ox, 6, sz + oz, lamp);
      }
    }
  }

  // ---------------------------------------------------------------- the skyline
  // outside the play area, never reached: a city that goes on past the edge
  const skyMats = [...night, glass];
  for (let i = 0; i < C.skyline.count; i++) {
    const a = (i / C.skyline.count) * Math.PI * 2 + rnd() * 0.08;
    const r = C.skyline.from + rnd() * (C.skyline.to - C.skyline.from);
    const h = 30 + rnd() * C.skyline.tallest;
    const w = 18 + rnd() * 26;
    deco(w, h, w, Math.cos(a) * r, 0, Math.sin(a) * r, skyMats[i % skyMats.length]);
    if (rnd() < 0.5) deco(0.3, h, 0.3, Math.cos(a) * r - w / 2, 0, Math.sin(a) * r - w / 2, neon(SECTORS[i % SECTORS.length].accent));
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
  for (const p of pads) {
    const x = p.x - BR_X;
    const z = p.z - BR_Z;
    if (p.up === undefined) {
      deco(2.4, 0.08, 2.4, x, 0.01, z, neon(0x20e0ff));
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
