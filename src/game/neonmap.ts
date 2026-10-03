// The map made of Daelonik's Neon City (Phase 28, docs/PHASE_28_PLAN_THE_CENTRE_FROM_NEON_CITY.md): the owner, 2026-09-28,
// "basically wiping the entire map except the idea". What the game plays: the nine districts of city.json with their
// names and bounds, the collision tools/import-neon.ts measured off the placed pieces' own triangles
// (src/config/neon/neonmap.solids.json), the bots' graph walked over it, the edge and the decay as the city had them.
// What it draws is the bundle's pieces alone, baked into one file a texture size (public/models/paid/neon/, served only by
// the game's own server): until it is in, or where it is not (a checkout without the bought files), a plain floor.
import * as THREE from "three";
import { slow } from "./slow";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RANGE_SOLIDS, type Solid } from "./range";
import { rebuildSolidGrid, solidsIn } from "./solidgrid";
import { FLOORS, HALL_FLOORS, floorAt } from "./floors";
import { botWalk } from "./botbody";
import { Doors } from "./doors";
import { BR_X, BR_Z, BR_HALF, type BrMap, type GraphNode, type Poi } from "./br";
import { SECTORS, SPIRE_TOP, buildEdgeFence, buildRingWall, holdForDecay } from "./city";
import { applyDetailMaps, applyUnityLooks } from "./detailmaps";
import { MOVE } from "./movement";
import { padOff, padOnto } from "./padsolve";
import { emissive } from "./geo";
import { ZIPLINES } from "./traversal";
import neonCfg from "../config/neonmap.json";
import SOLIDS from "../config/neon/neonmap.solids.json";

/** the centre's spine of pads as the bake measured it (tools/import-neon.ts spinePads) */
interface Spine {
  up: Array<{ id: string; face: number[]; out: number[]; pad: number[]; floor: number; roof: number; land: number }>;
  down: Array<{ id: string; pad: number[]; floor: number; land: number[]; landY: number; hop: number }>;
}

/** what the map drew, for the page's hook and the checks */
export const NEON_MAP: { drawn: boolean; file: string; triangles: number; meshes: number; detail: number; got: number; total: number } = { drawn: false, file: "", triangles: 0, meshes: 0, detail: 0, got: 0, total: 0 };

const G = neonCfg.game;
/** the map's own haze (atmosphere.ts ownAir), neonmap.json game.air */
export const NEON_AIR = G.air;
/** the plain floor drawn until the bundle's file is in, or where it is not */
let standIn: THREE.Mesh | null = null;

export function buildNeonMap(scene: THREE.Scene): BrMap {
  const root = new THREE.Group();
  root.name = "neon";
  root.position.set(BR_X, 0, BR_Z);
  scene.add(root);

  standIn = new THREE.Mesh(new THREE.PlaneGeometry(BR_HALF * 2 + 16, BR_HALF * 2 + 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2c2e33, roughness: 0.95 }));
  standIn.position.y = -0.02;
  standIn.receiveShadow = true;
  standIn.name = "neon:standIn";
  root.add(standIn);

  // the court the tallest building stands in (neon-layout.ts): the world's floor lowered to its floor, 7 m down, as the
  // old city's metro lowered it (floors.ts), so a body in it stands on the court's tiles and not on the street's height
  FLOORS.length = 0;
  const K = neonCfg.court;
  FLOORS.push({ minX: K.x0 + BR_X, maxX: K.x1 + BR_X, minZ: K.z0 + BR_Z, maxZ: K.z1 + BR_Z, y: K.y });
  // and its halls under the plaza: their floor lowered too, and the street's slab over them where the plaza's tiles are
  // drawn (the world's floor lowered under a hall lets a body through the tiles onto the corridor's roof otherwise)
  for (const h of K.halls) FLOORS.push({ minX: h.x0 + BR_X, maxX: h.x1 + BR_X, minZ: h.z0 + BR_Z, maxZ: h.z1 + BR_Z, y: K.y });
  // and the underground (neon-layout.ts rules.underground): the station and its tunnel to their track bed, the glass hall
  // to its marble floor (FLOORS is read first match first: these are clear of the court's and the halls')
  const UG = neonCfg.underground ?? { floors: [], slabs: [] };
  // the tower's floors over its lobby (neon-layout.ts rules.tower), each a hall's for the loot (loot.ts halls): spots of
  // their own a floor, and the field's loot kept off them. Spread over every floor at random they held half an item a
  // floor, and they are the centre's fight
  HALL_FLOORS.length = 0;
  const TW = (neonCfg as unknown as { tower?: { square: number[]; slab: number; core: { storeys: number[] } } }).tower;
  if (TW) {
    const [sx0, sx1, sz0, sz1] = TW.square;
    const S = TW.core.storeys;
    for (let k = 1; k < S.length; k++) HALL_FLOORS.push({ minX: sx0 + BR_X, maxX: sx1 + BR_X, minZ: sz0 + BR_Z, maxZ: sz1 + BR_Z, y: S[k], top: (S[k + 1] ?? S[k] + 3) - TW.slab });
  }
  for (const { rect: [x0, x1, z0, z1], y } of UG.floors) FLOORS.push({ minX: x0 + BR_X, maxX: x1 + BR_X, minZ: z0 + BR_Z, maxZ: z1 + BR_Z, y });

  // the collision, measured off the pieces' triangles at the bake
  const first = RANGE_SOLIDS.length;
  // (over the corridor only: an entrance's well is open to the street; over the station and its tunnel, the street)
  for (const { slab: [x0, x1, z0, z1] } of K.halls) RANGE_SOLIDS.push({ minX: x0 + BR_X, maxX: x1 + BR_X, minZ: z0 + BR_Z, maxZ: z1 + BR_Z, base: -G.slab, top: 0 });
  for (const [x0, x1, z0, z1] of UG.slabs) RANGE_SOLIDS.push({ minX: x0 + BR_X, maxX: x1 + BR_X, minZ: z0 + BR_Z, maxZ: z1 + BR_Z, base: -G.slab, top: 0 });
  for (const [x0, x1, z0, z1, y0, y1] of SOLIDS.solids as number[][]) RANGE_SOLIDS.push({ minX: x0 + BR_X, maxX: x1 + BR_X, minZ: z0 + BR_Z, maxZ: z1 + BR_Z, base: y0, top: y1 });
  rebuildSolidGrid();

  buildEdgeFence(root);
  const ringWall = buildRingWall(root);

  // the tallest building's top: the ship passes it, as it passed the Spire
  const T = neonCfg.tallest;
  Object.assign(SPIRE_TOP, { x: (T.x0 + T.x1) / 2 + BR_X, z: (T.z0 + T.z1) / 2 + BR_Z, y: T.top, w: T.x1 - T.x0, d: T.z1 - T.z0, mast: 0 });

  const sectorAt = (x: number, z: number) => SECTORS.find((s) => x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) ?? null;
  /**
   * The floors a body stands on at (x, z), map-local: the world's own (the street, the court) where nothing is under foot, and the top of every box
   * there that carries the spot's middle, each with a head's room over it (nothing from a step over it to a standing
   * body's height). A roof, a room's floor, the tallest building's lobby
   */
  const floorsAt = (x: number, z: number): number[] => {
    const [wx, wz] = [x + BR_X, z + BR_Z];
    const [x0, x1, z0, z1] = [wx - G.clear, wx + G.clear, wz - G.clear, wz + G.clear];
    // (the grid hands back every box that may overlap, the always-checked ones too: the overlap is tested here)
    const here = solidsIn(x0, x1, z0, z1).filter((s: Solid) => s.minX < x1 && s.maxX > x0 && s.minZ < z1 && s.maxZ > z0);
    const out: number[] = [];
    const ground = floorAt(wx, wz);
    for (const y of new Set([ground, ...here.filter((s) => s.minX <= wx && s.maxX >= wx && s.minZ <= wz && s.maxZ >= wz && s.top > ground).map((s) => s.top)])) {
      if (here.some((s) => s.base < y + MOVE.standHeight && s.top > y + MOVE.stepHeight)) continue;
      out.push(y);
    }
    return out;
  };

  // the bots' graph: a node every `step` metres of the street and every `raised` of the floors over it, linked to the
  // ones round it on a floor it walks to and back (botWalk, ending at the other's height)
  const nodes: GraphNode[] = [];
  const at = new Map<string, number[]>();
  const step = G.graph.step;
  const fine = G.graph.raised;
  const lim = BR_HALF - G.graph.margin;
  const add = (x: number, z: number, y: number): number => {
    nodes.push({ x: x + BR_X, z: z + BR_Z, y, poi: sectorAt(x, z)?.id, links: [] });
    return nodes.length - 1;
  };
  const onStreetGrid = (v: number) => Math.abs((v + lim) / step - Math.round((v + lim) / step)) < 1e-6;
  // (above the street or under it: the court and its halls, 7 m down, are walked at the finer step too)
  const raised = (i: number) => Math.abs(nodes[i].y ?? 0) > MOVE.stepHeight;
  // (the street's height inside the court is the tallest building's ground floor, a storey over the court's and walled
  // in, not street: nodes there were an island a drop could be put on)
  const inCourt = (x: number, z: number) => x > K.x0 && x < K.x1 && z > K.z0 && z < K.z1;
  for (let x = -lim; x <= lim + 1e-6; x += fine)
    for (let z = -lim; z <= lim + 1e-6; z += fine) {
      const street = onStreetGrid(x) && onStreetGrid(z) && !inCourt(x, z);
      const ys = floorsAt(x, z).filter((y) => street || Math.abs(y) > MOVE.stepHeight);
      if (ys.length) at.set(`${x},${z}`, ys.map((y) => add(x, z, y)));
    }
  const reaches = (a: GraphNode, b: GraphNode): boolean => {
    const w = botWalk(a.x, a.z, a.y ?? 0, b.x, b.z);
    return w.ok && Math.abs(w.y - (b.y ?? 0)) < G.graph.level;
  };
  const walks = (i: number, j: number): boolean => Math.abs((nodes[i].y ?? 0) - (nodes[j].y ?? 0)) < G.graph.climb && reaches(nodes[i], nodes[j]) && reaches(nodes[j], nodes[i]);
  const link = (i: number, j: number): void => {
    nodes[i].links.push(j);
    nodes[j].links.push(i);
  };
  for (const [k, here] of at) {
    const [x, z] = k.split(",").map(Number);
    for (const d of [fine, step])
      for (const [dx, dz] of [
        [d, 0],
        [0, d],
        [d, d],
        [d, -d],
      ])
        for (const j of at.get(`${x + dx},${z + dz}`) ?? [])
          for (const i of here) {
            // the street's links a `step` apart, a raised floor's (and from it down to the street) `raised` apart
            if ((d === step) !== !(raised(i) || raised(j))) continue;
            if (walks(i, j)) link(i, j);
          }
  }

  // the jump pads the bake found (neonmap.json pads), each thrown as padsolve.ts solves it: a node on its spot joined to
  // the street round it, one way up to a node where it lands, joined to the roof round that; a bot's way up only where
  // the landing joins the roof (High City's round islands are a player's double jump from the rest; a bot never jumps)
  const pads: BrMap["pads"] = [];
  /** the nodes on a floor within reach of a spot, nearest first */
  const near = (n: number): number[] =>
    nodes
      .map((m, i) => ({ i, d: Math.hypot(m.x - nodes[n].x, m.z - nodes[n].z) }))
      .filter(({ i, d }) => i !== n && d < step * 1.5 && Math.abs((nodes[i].y ?? 0) - (nodes[n].y ?? 0)) < G.graph.climb)
      .sort((a, b) => a.d - b.d)
      .map(({ i }) => i);
  // (and the centre's spine, neonmap.json spine: up from the plaza onto the base's roof, and from there onto the top)
  const SPINE = (neonCfg as unknown as { spine?: Spine }).spine ?? { up: [], down: [] };
  for (const q of [...neonCfg.pads.map((q) => ({ ...q, land: undefined as number | undefined })), ...SPINE.up]) {
    const { pad, land } = padOnto(q.face[0], q.face[1], q.out[0], q.out[1], q.floor, q.roof, q.land);
    pads.push({ ...pad, x: pad.x + BR_X, z: pad.z + BR_Z });
    const pn = add(pad.x, pad.z, pad.y);
    const ln = add(land.x, land.z, land.y);
    // (the pad's spot joined to the street's two nearest it walks to, the landing to the roof's three)
    for (const [n, most] of [
      [pn, 2],
      [ln, 3],
    ]) {
      let joined = 0;
      for (const i of near(n)) {
        if (joined === most) break;
        if (!walks(n, i)) continue;
        link(n, i);
        joined++;
      }
    }
    if (!nodes[ln].links.length) continue;
    nodes[pn].pad = { to: ln, up: pad.up, dx: pad.dx, dz: pad.dz, over: pad.over };
    (nodes[ln].padFrom ??= []).push(pn);
  }
  // the spine's way down: off the top, thrown out over its parapet onto the base's roof (no bot is sent up there)
  for (const q of SPINE.down) {
    const t = padOff(q.pad[0], q.pad[1], q.floor, q.land[0], q.land[1], q.landY, q.hop);
    pads.push({ x: q.pad[0] + BR_X, z: q.pad[1] + BR_Z, y: q.floor, up: t.up, dx: t.dx, dz: t.dz });
  }

  // the nine places: each sector's street nodes its drops, spread across it
  const pois: Poi[] = SECTORS.map((s) => {
    const mine = nodes.filter((n) => n.poi === s.id && n.links.length && !n.y);
    const mid = { x: (s.minX + s.maxX) / 2, z: (s.minZ + s.maxZ) / 2 };
    mine.sort((a, b) => Math.hypot(a.x - BR_X - mid.x, a.z - BR_Z - mid.z) - Math.hypot(b.x - BR_X - mid.x, b.z - BR_Z - mid.z));
    const every = Math.max(1, Math.floor(mine.length / G.drops));
    const drops = mine.filter((_, i) => i % every === 0).slice(0, G.drops).map((n) => ({ x: n.x, z: n.z }));
    return { id: s.id, name: s.name, x: mid.x + BR_X, z: mid.z + BR_Z, radius: Math.max(s.maxX - s.minX, s.maxZ - s.minZ) / 2, drops: drops.length ? drops : [{ x: mid.x + BR_X, z: mid.z + BR_Z }] };
  });
  const placeAt = (x: number, z: number) => {
    const s = sectorAt(x - BR_X, z - BR_Z);
    return s ? (pois.find((p) => p.id === s.id) ?? null) : null;
  };
  // the small named places, their own loot (loot.ts sites): each high city block's deck, at the middle of the nodes on
  // its roof, and the tallest building's lobby
  const B = neonCfg.rules.blocks;
  const blockOf = (dir: string): [number, number, number, number] => {
    const far = dir === "n" || dir === "w" ? [-B.outer[1], -B.outer[0]] : [B.outer[0], B.outer[1]];
    return dir === "n" || dir === "s" ? [B.inner[0], B.inner[1], far[0], far[1]] : [far[0], far[1], B.inner[0], B.inner[1]];
  };
  const sites: BrMap["sites"] = [];
  // (and each corner block's own name, the master plan's: over its rooms building's roof yard, or over the Well's middle, its
  // loot within `reach` of there, so up the fire escape and through the building's floors)
  const yards = (neonCfg as unknown as { yards?: Array<{ block: string; inside: number[] }> }).yards ?? [];
  const well = (neonCfg as unknown as { well?: { hole: number[] } }).well;
  for (const q of G.sites.list as Array<{ id: string; name: string; over: string; reach?: number }>) {
    if (q.over === "middle") {
      sites.push({ id: q.id, name: q.name, x: (T.x0 + T.x1) / 2 + BR_X, z: (T.z0 + T.z1) / 2 + BR_Z });
      continue;
    }
    if (q.over.length === 2) {
      const block = `${q.over[1] === "w" ? -1 : 1},${q.over[0] === "n" ? -1 : 1}`;
      const y = yards.find((w) => w.block === block);
      const at = y ? [(y.inside[0] + y.inside[1]) / 2, (y.inside[2] + y.inside[3]) / 2] : well && neonCfg.rules.well?.block === block ? [(well.hole[0] + well.hole[1]) / 2, (well.hole[2] + well.hole[3]) / 2] : null;
      if (at) sites.push({ id: q.id, name: q.name, x: at[0] + BR_X, z: at[1] + BR_Z, radius: q.reach });
      continue;
    }
    const [x0, x1, z0, z1] = blockOf(q.over);
    const on = nodes.filter((n) => (n.y ?? 0) >= G.sites.roof && n.x - BR_X >= x0 && n.x - BR_X <= x1 && n.z - BR_Z >= z0 && n.z - BR_Z <= z1);
    if (on.length) sites.push({ id: q.id, name: q.name, x: on.reduce((a, n) => a + n.x, 0) / on.length, z: on.reduce((a, n) => a + n.z, 0) / on.length });
  }
  // respawn beacons at street crossings, one a side of the centre
  const beacons = (G.beacons as number[][]).map(([x, z]) => ({ x: x + BR_X, z: z + BR_Z }));

  // the glass lifts (neon-layout.ts rules.lifts): each a vertical rope up out of its glass car over the Sky Ring's
  // footbridge to over its island's landing, ridden as any zipline is (interact, up or down), lit in its island's colour
  // from the car's floor to just over the rope's top
  // (and the Well's rope, neon-layout.ts rules.well: up its light-well from the bottom to the ground ring)
  const ropeCfg = neonCfg as unknown as { lifts?: Array<{ rope: number[][]; floor: number; colour: string }>; well?: { ropes: Array<{ rope: number[][]; floor: number; colour: string }> } };
  for (const q of [...(ropeCfg.lifts ?? []), ...(ropeCfg.well?.ropes ?? [])]) {
    const [a, b] = q.rope;
    const top = b[1] + 0.3;
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, top - q.floor, 8), emissive(new THREE.Color(q.colour).getHex(), 1.2));
    rope.position.set(a[0], (q.floor + top) / 2, a[2]);
    rope.name = "neon:lift";
    root.add(rope);
    ZIPLINES.push({ a: new THREE.Vector3(a[0] + BR_X, a[1], a[2] + BR_Z), b: new THREE.Vector3(b[0] + BR_X, b[1], b[2] + BR_Z) });
  }
  // the zip lines (neon-layout.ts rules.low.zip): from each rooms building's roof yard up to a High City deck, a rope
  // between its ends lit in its block's colour, ridden up or down
  for (const q of (neonCfg as unknown as { zips?: Array<{ a: number[]; b: number[]; colour: string }> }).zips ?? []) {
    const [a, b] = [new THREE.Vector3(...(q.a as [number, number, number])), new THREE.Vector3(...(q.b as [number, number, number]))];
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, a.distanceTo(b), 8), emissive(new THREE.Color(q.colour).getHex(), 1.2));
    rope.position.copy(a).add(b).multiplyScalar(0.5);
    rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    rope.name = "neon:zip";
    root.add(rope);
    ZIPLINES.push({ a: new THREE.Vector3(a.x + BR_X, a.y, a.z + BR_Z), b: new THREE.Vector3(b.x + BR_X, b.y, b.z + BR_Z) });
  }

  holdForDecay(root, RANGE_SOLIDS.slice(first));
  root.updateMatrixWorld(true);
  return {
    root,
    pois,
    sites,
    placeAt,
    nodes,
    ringWall,
    towers: [],
    beacons,
    pads,
    doors: new Doors(root, { x: BR_X, z: BR_Z }, []),
    vault: { door: -1, x: BR_X, z: BR_Z, y: 0, post: { x: BR_X, z: BR_Z } },
    scenery: { rocks: [], boxed: [], scrub: [], cliffs: [], flora: [] },
  };
}

/**
 * The pack's materials reflecting the city itself, not the game's sky: its asphalt is smoothness 0.85, a wet street, and
 * in Unity the scene's reflection probes show it the dark city and its neon; with the sky's map in it the roads came out
 * pale, lit or not (turning the moon, the sky's fill and the environment down left them as they were). One picture of
 * the lit map taken from `reflect.at` (map-local) once its file is in, as the old city's wet streets did (atmosphere.ts)
 */
let reflection: { cam: THREE.CubeCamera; scene: THREE.Scene; renderer: THREE.WebGLRenderer; mats: THREE.MeshStandardMaterial[] } | null = null;
function reflectCity(map: THREE.Object3D, renderer: THREE.WebGLRenderer): void {
  const scene = map.parent?.parent as THREE.Scene | undefined;
  if (!scene) return;
  const R = G.reflect;
  const rt = new THREE.WebGLCubeRenderTarget(R.size, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cam = new THREE.CubeCamera(0.5, R.far, rt);
  cam.position.set(BR_X + R.at[0], R.at[1], BR_Z + R.at[2]);
  const mats: THREE.MeshStandardMaterial[] = [];
  reflection = { cam, scene, renderer, mats };
  // (its first picture is taken once the warm has built its shaders, main.ts warmBrSide: taken here, now that it is of
  // the city and not of nothing, it built them on the spot)
  const done = new Set<THREE.Material>();
  map.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m || Array.isArray(m) || done.has(m) || !m.isMeshStandardMaterial) return;
    done.add(m);
    m.envMap = rt.texture;
    m.needsUpdate = true;
    mats.push(m);
  });
}

/** the city's picture taken again, as the hour changes (main.ts applyHour): a night's city reflected in a golden hour's road read wrong */
export function retakeReflection(): void {
  if (!reflection) return;
  const { cam, scene, renderer, mats } = reflection;
  // Taken as the first one was, before the city was given it: its materials without their own reflection. Given it,
  // every city shader needed a second build for the cube's faces, and the first change of hour in a visit held the page
  // 3.1 s compiling them (a CPU profile, 2026-10-02: 3,022 ms in the shaders' link); and each would have been drawn
  // reading the very picture it was drawn into.
  const own = mats.map((m) => m.envMap);
  for (const m of mats) m.envMap = null;
  // (its side shown for the picture: taken from the range, with the city's side hidden, the picture was empty, and the
  // first was always taken so, the city's file coming in while the range is shown)
  const shown = scene.visible;
  scene.visible = true;
  scene.add(cam);
  cam.update(renderer, scene);
  scene.remove(cam);
  scene.visible = shown;
  mats.forEach((m, i) => (m.envMap = own[i]));
}

/**
 * The retake's shaders built ahead (main.ts warmBrSide, under the loading screen), off the page's thread where the browser
 * can: `root` as the retake draws it, its materials without their own reflection, into the cube's faces. A shader is
 * built for the target it draws into, and the screen's, which the warm builds, are not the cube's: the first retake in
 * a match still built them on the spot, 1.3 s on the first change of hour.
 */
export function warmReflection(root: THREE.Object3D): Promise<unknown> {
  if (!reflection) return Promise.resolve();
  const { cam, scene, renderer, mats } = reflection;
  const own = mats.map((m) => m.envMap);
  for (const m of mats) m.envMap = null;
  const was = renderer.getRenderTarget();
  let built: Promise<unknown> = Promise.resolve();
  try {
    renderer.setRenderTarget(cam.renderTarget);
    built = renderer.compileAsync(root, cam.children[0] as THREE.Camera, scene);
  } catch {
    /* built on the retake, as before */
  } finally {
    renderer.setRenderTarget(was);
    mats.forEach((m, i) => (m.envMap = own[i]));
  }
  return built;
}

/**
 * The bundle's file drawn over the map: the preset's texture size (lo 512, hi 1024, max 2048), its geometry
 * meshopt-compressed, its detail maps multiplied in (detailmaps.ts), every material taught the decay, the plain floor put
 * away. How many meshes it drew; 0 where the file is not (a checkout without the bought files)
 */
export async function dressNeonMap(root: THREE.Object3D, renderer: THREE.WebGLRenderer, size: "lo" | "hi" | "max"): Promise<number> {
  // (?neontag=: a bake of another grouping beside this one, for measuring the two in turn: tools/import-neon.ts NEON_TAG)
  const tag = (new URLSearchParams(location.search).get("neontag") ?? "").replace(/[^a-z0-9-]/gi, "");
  const url = `models/paid/neon/neonmap-v${neonCfg.version}-${size}${tag}.glb?v=${neonCfg.version}`;
  // a HEAD first: the Vite dev server answers a missing file with its index page, not a 404
  const probe = await fetch(url, { method: "HEAD" }).catch(() => null);
  if (!probe || !probe.ok || (probe.headers.get("content-type") ?? "").includes("text/html")) return 0;
  const ktx2 = new KTX2Loader().setTranscoderPath("libs/basis/").detectSupport(renderer);
  // (its bytes as they come: a match's screen waits for the city and draws its bar by them, main.ts showFrame)
  const gltf = await new GLTFLoader()
    .setKTX2Loader(ktx2)
    .setMeshoptDecoder(MeshoptDecoder)
    .loadAsync(url, (e) => {
      if (!e.lengthComputable) return;
      NEON_MAP.got = e.loaded;
      NEON_MAP.total = e.total;
    });
  NEON_MAP.detail = await applyDetailMaps(gltf);
  let meshes = 0;
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes++;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  // (after the shadows: a beam of light casts none)
  applyUnityLooks(gltf.scene);
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]) {
      // HDR emission past 1 comes from the importer as a strength (glTF extras reach userData), as the kit's does
      const strength = Number(m.userData?.emissiveStrength ?? 1);
      if (strength > 1 && m.emissiveIntensity === 1) m.emissiveIntensity = strength;
    }
    NEON_MAP.triangles += (mesh.geometry.getIndex()?.count ?? mesh.geometry.getAttribute("position").count) / 3;
  });
  gltf.scene.name = "neon:map";
  root.add(gltf.scene);
  // nothing in the file moves (its decay is its materials' own), so its matrices are worked out once and not every
  // frame (?slow=static: every frame, as before)
  if (!slow("static"))
    gltf.scene.traverse((o) => {
      o.updateMatrix();
      o.matrixAutoUpdate = false;
    });
  holdForDecay(gltf.scene, null);
  reflectCity(gltf.scene, renderer);
  if (standIn) standIn.visible = false;
  renderer.shadowMap.needsUpdate = true;
  Object.assign(NEON_MAP, { drawn: true, file: url, meshes });
  return meshes;
}
