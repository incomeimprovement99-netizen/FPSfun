// The map made of Daelonik's Neon City (Phase 28, docs/PHASE_28_PLAN_THE_CENTRE_FROM_NEON_CITY.md): the owner, 2026-09-28,
// "basically wiping the entire map except the idea". What the game plays: the nine districts of city.json with their
// names and bounds, the collision tools/import-neon.ts measured off the placed pieces' own triangles
// (src/config/neon/neonmap.solids.json), the bots' graph walked over it, the edge and the decay as the city had them.
// What it draws is the bundle's pieces alone, baked into one file a texture size (public/models/paid/neon/, served only by
// the game's own server): until it is in, or where it is not (a checkout without the bought files), a plain floor.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RANGE_SOLIDS, type Solid } from "./range";
import { rebuildSolidGrid, solidsIn } from "./solidgrid";
import { FLOORS, floorAt } from "./floors";
import { botWalk } from "./botbody";
import { Doors } from "./doors";
import { BR_X, BR_Z, BR_HALF, type BrMap, type GraphNode, type Poi } from "./br";
import { SECTORS, SPIRE_TOP, buildEdgeFence, buildRingWall, holdForDecay } from "./city";
import { applyDetailMaps, applyUnityLooks } from "./detailmaps";
import { MOVE } from "./movement";
import { padOnto } from "./padsolve";
import neonCfg from "../config/neonmap.json";
import SOLIDS from "../config/neon/neonmap.solids.json";

/** what the map drew, for the page's hook and the checks */
export const NEON_MAP: { drawn: boolean; file: string; triangles: number; meshes: number; detail: number } = { drawn: false, file: "", triangles: 0, meshes: 0, detail: 0 };

const G = neonCfg.game;
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

  // the collision, measured off the pieces' triangles at the bake
  const first = RANGE_SOLIDS.length;
  for (const h of K.halls) RANGE_SOLIDS.push({ minX: h.x0 + BR_X, maxX: h.x1 + BR_X, minZ: h.z0 + BR_Z, maxZ: h.z1 + BR_Z, base: -G.slab, top: 0 });
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
  const raised = (i: number) => (nodes[i].y ?? 0) > MOVE.stepHeight;
  for (let x = -lim; x <= lim + 1e-6; x += fine)
    for (let z = -lim; z <= lim + 1e-6; z += fine) {
      const street = onStreetGrid(x) && onStreetGrid(z);
      const ys = floorsAt(x, z).filter((y) => street || y > MOVE.stepHeight);
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
  for (const q of neonCfg.pads) {
    const { pad, land } = padOnto(q.face[0], q.face[1], q.out[0], q.out[1], q.floor, q.roof);
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
  for (const q of G.sites.list) {
    if (q.over === "middle") {
      sites.push({ id: q.id, name: q.name, x: (T.x0 + T.x1) / 2 + BR_X, z: (T.z0 + T.z1) / 2 + BR_Z });
      continue;
    }
    const [x0, x1, z0, z1] = blockOf(q.over);
    const on = nodes.filter((n) => (n.y ?? 0) >= G.sites.roof && n.x - BR_X >= x0 && n.x - BR_X <= x1 && n.z - BR_Z >= z0 && n.z - BR_Z <= z1);
    if (on.length) sites.push({ id: q.id, name: q.name, x: on.reduce((a, n) => a + n.x, 0) / on.length, z: on.reduce((a, n) => a + n.z, 0) / on.length });
  }
  // respawn beacons at street crossings, one a side of the centre
  const beacons = (G.beacons as number[][]).map(([x, z]) => ({ x: x + BR_X, z: z + BR_Z }));

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
  const gltf = await new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
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
  holdForDecay(gltf.scene, null);
  if (standIn) standIn.visible = false;
  renderer.shadowMap.needsUpdate = true;
  Object.assign(NEON_MAP, { drawn: true, file: url, meshes });
  return meshes;
}
