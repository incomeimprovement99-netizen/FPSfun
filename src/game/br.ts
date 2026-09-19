// The battle royale map: OUTSKIRTS. Open ground 440 m across, south of the
// range (z 280 to 720, x -220 to 220), one POI in the middle and four round
// it, roads between them with cover, and open field to be caught in.
//
//   THE HUB      (0, 0)     a walled compound: four buildings, the Mast (a
//                           seven-storey tower you can climb inside, the one
//                           landmark seen from everywhere), containers, a gate
//                           on each side
//   NORTH YARD   (0, -165)  a container yard you can walk through with a
//                           catwalk over it, a four-storey silo block between
//                           two silos, a warehouse
//   SOUTH DEPOT  (0, 165)   three walled bays, a loading building, an office,
//                           a portal crane over the yard
//   EAST RIDGE   (165, 0)   a stepped mesa with a room inside it, a bunker on
//                           its roof, a lit chimney, two ramps the bots can
//                           walk, a zipline up to the Table Station
//   WEST TOWN    (-165, 0)  six houses in alleys, a water tower you can climb
//                           and ride out of, a clocktower in a churchyard
//
// In each corner between them, 104 m out along both axes, a walled compound:
// a farm with a barn and a wind pump, a store with a billboard, stock pens
// and a works with tanks and a flare stack, each with four buildings, a
// covered yard and a wall that makes it two rooms.
//
// The ground has a shape of its own (see "the landforms"): a bowl of berms
// round the hub, a ridge, a mesa, a dry wash and two mounds round that, and a
// cliff all the way round the edge.
//
// Everything is boxes on RANGE_SOLIDS like the rest of the world, so the
// player, the bots and the bullets see it the same way. Bots walk a graph of
// nodes (POI centres, gates, road bends) laid out here as well.
import * as THREE from "three";
import { RANGE_SOLIDS } from "./range";
import { building, coverWall, crateStair, jumpTower, type BoxMaker, type PoiCtx, type Side } from "./brpoi";
import { PAL, bevel, flat, emissive, textPanel } from "./geo";
import { type MatName, material } from "./materials";
import { ZIPLINES } from "./traversal";
import type { Bounds } from "./player";
import cfg from "../config/brmap.json";

export const BR_X = 0;
export const BR_Z = 500;
/** half the map's side */
export const BR_HALF = 220;
export const BR_BOUNDS: Bounds = { minX: BR_X - BR_HALF, maxX: BR_X + BR_HALF, minZ: BR_Z - BR_HALF, maxZ: BR_Z + BR_HALF };
export const BR_CENTER = new THREE.Vector3(BR_X, 0, BR_Z);

export interface Poi {
  id: string;
  name: string;
  /** world space */
  x: number;
  z: number;
  /** how far the place reaches, metres; src/config/brmap.json's placeRadius when not given */
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
  /** respawn beacons: bring back a squad mate whose banner you carry (world space) */
  beacons: Array<{ x: number; z: number }>;
  /** launch pads on the roads: step on and be thrown along (dx, dz) and up (world space) */
  pads: Array<{ x: number; z: number; dx: number; dz: number }>;
}

/** a small deterministic random, so the field's rocks land in the same places every load */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildBrMap(scene: THREE.Scene): BrMap {
  const root = new THREE.Group();
  root.name = "br";
  root.position.set(BR_X, 0, BR_Z);
  scene.add(root);

  const solid = (minX: number, maxX: number, minZ: number, maxZ: number, base: number, top: number) =>
    RANGE_SOLIDS.push({ minX: minX + BR_X, maxX: maxX + BR_X, minZ: minZ + BR_Z, maxZ: maxZ + BR_Z, base, top });
  const box: BoxMaker = (w, h, d, x, y, z, mat, isSolid = true) => {
    const m = new THREE.Mesh(bevel(w, h, d, 0.05), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    if (isSolid) solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y, y + h);
    return m;
  };
  // A plain box, for anything big: walls, floors, steps, the ground's tiers.
  // box() above is geo.ts's bevel, which is about 300 triangles at any size
  // against a plain box's 12. main.ts merges the whole map by material, so a
  // box costs no draw call of its own and its triangles are what it costs:
  // on a 13 m wall that is 300 triangles for a 5 cm chamfer nobody sees.
  // Cached by size, as bevel() is, so a hundred equal steps are one buffer.
  // (A material used by both kinds merges into two groups rather than one,
  // since one geometry is indexed and the other is not.)
  const slabCache = new Map<string, THREE.BoxGeometry>();
  const slabGeo = (w: number, h: number, d: number): THREE.BoxGeometry => {
    const key = `${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}`;
    let g = slabCache.get(key);
    if (!g) {
      g = new THREE.BoxGeometry(w, h, d);
      // shared by every slab this size: never dispose it
      g.userData.shared = true;
      slabCache.set(key, g);
    }
    return g;
  };
  const slab: BoxMaker = (w, h, d, x, y, z, mat, isSolid = true) => {
    const m = new THREE.Mesh(slabGeo(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    if (isSolid) solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y, y + h);
    return m;
  };
  /**
   * A round thing's collision. There is nothing but boxes, so a cylinder of
   * radius r is five overlapping boxes whose corners stand on its circle, at
   * 10, 30, 45, 60 and 80 degrees off each axis. A body pressed against it is
   * never more than about 15 cm off the drawn surface, and cannot get its
   * eyes inside it. One square box would do neither: fitted to the axes, the
   * corners of a silo stood 1.9 m out into thin air; fitted inside, a body
   * could walk 1.3 m into the drawn wall and see out of it unseen, since a
   * mesh is not drawn from inside.
   */
  const roundSolid = (x: number, z: number, r: number, base: number, top: number): void => {
    for (const [a, b] of [
      [0.985, 0.174],
      [0.866, 0.5],
      [0.707, 0.707],
      [0.5, 0.866],
      [0.174, 0.985],
    ]) solid(x - a * r, x + a * r, z - b * r, z + b * r, base, top);
  };
  /**
   * A round thing's look, for roundSolid to make solid: a cylinder standing
   * at y, and with `cap` a cone roof of that material. The cylinder and the
   * cone carry the slabs' shadow flags, so each merges into its material's
   * group with the slabs and costs no draw call of its own.
   */
  const drum = (x: number, z: number, r: number, y: number, h: number, mat: THREE.Material, cap?: { mat: THREE.Material; h: number }, sides = 12): void => {
    const parts: Array<[THREE.BufferGeometry, THREE.Material, number]> = [[new THREE.CylinderGeometry(r, r, h, sides), mat, y + h / 2]];
    if (cap) parts.push([new THREE.ConeGeometry(r + 0.3, cap.h, sides), cap.mat, y + h + cap.h / 2]);
    for (const [geo, material, cy] of parts) {
      const m = new THREE.Mesh(geo, material);
      m.position.set(x, cy, z);
      m.castShadow = true;
      m.receiveShadow = true;
      root.add(m);
    }
  };
  /** a strut from a to b, for show: a lattice's bracing, a crane's cable, a windmill's blade */
  const strut = (a: THREE.Vector3, b: THREE.Vector3, t: number, mat: THREE.Material): void => {
    const m = new THREE.Mesh(slabGeo(t, a.distanceTo(b), t), mat);
    m.position.copy(a).lerp(b, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  };
  /**
   * A place's name, to be read from across its half of the map. textPanel
   * letters its title at a fixed size in pixels, so a bigger board is only
   * more board round the same small letters. This asks for a board short
   * enough to be lettered to its full height and scales it up whole: at 2.8
   * it is 12 by 2.2 m with capitals over a metre tall.
   */
  const bigSign = (text: string, x: number, y: number, z: number, rotY: number, scale: number): void => {
    const s = textPanel(text, x, y, z, rotY, 4.4, 0.8);
    s.scale.set(scale, scale, 1);
    root.add(s);
  };

  // materials: sand ground, concrete walls, painted steel containers, rock
  const ground = material("ground", { color: 0xb8a988, roughness: 1, metalness: 0 });
  // the road a stop darker than the sand, the walls a warm concrete
  const road = material("concrete", { color: 0x4e4c48, roughness: 0.95, metalness: 0.02 });
  const wallMat = material("concrete", { color: 0xa39b8e, roughness: 0.85, metalness: 0.05 });
  /**
   * A textured material in another colour, sharing the textures it already
   * has. A material() of its own would fetch and upload the whole set again,
   * three 1024 px maps and 16 MB of video memory for every colour. If the set
   * fails to load, materials.ts drops it from the original, and this follows
   * so it does not render black, keeping its own colour.
   */
  /**
   * The sets' roughness maps have glossy texels: in full sun, looked at into
   * the light, a whole tread or apron flashed white. The map's surfaces keep
   * the normal maps (the detail) and take one roughness of their own instead.
   */
  const matte = (m: THREE.MeshStandardMaterial, roughness: number): THREE.MeshStandardMaterial => {
    m.roughnessMap = null;
    m.roughness = roughness;
    m.needsUpdate = true;
    return m;
  };
  const recolour = (base: THREE.MeshStandardMaterial, color: number): THREE.MeshStandardMaterial => {
    const m = base.clone();
    m.color.setHex(color);
    m.onBeforeRender = () => {
      if (m.map && !base.map) {
        m.map = m.roughnessMap = m.normalMap = null;
        m.needsUpdate = true;
      }
    };
    return m;
  };
  /**
   * One of the CC0 sets (public/tex, fetched and credited, and until now
   * never put on the map), in a colour, at `metres` a tile. The map's boxes
   * share their geometry by size, so the merge gives each its coordinates
   * from where it is in the world (staticmerge.ts worldUVs), and a wall shows
   * its bricks at one real size however long it is. A colour of its own is a
   * material of its own but shares the set's textures (materials.ts caches the
   * maps by set).
   */
  const tex = (name: MatName, color: number, metres: number, roughness?: number): THREE.MeshStandardMaterial => {
    const m = matte(material(name, { color, roughness }), roughness ?? 0.9);
    m.userData.worldUV = metres;
    return m;
  };
  // the floor itself glared white looking toward the sun, for the same reason
  matte(ground, 1);
  wallMat.userData.worldUV = 3;
  const wallOf = (color: number) => {
    const m = recolour(wallMat, color);
    m.userData.worldUV = 3;
    return m;
  };
  // Concrete048 is a clean light concrete: darker, or it glares in the sun
  const concrete = tex("concrete", 0x8e8880, 3, 0.9);
  const rock = tex("rock", 0xa8a094, 3, 0.95);
  const crate = tex("planks", 0xd0b088, 1.2, 0.85);
  // the containers: corrugated metal in three colours
  const steelA = tex("corrugated", 0x6f9ec0, 2.4, 0.6);
  const steelB = tex("corrugated", 0xc27a62, 2.4, 0.6);
  const steelC = tex("corrugated", 0x8e9c62, 2.4, 0.6);
  const trim = flat(PAL.orange, 0.55, 0.25);
  const roofMat = tex("roof", 0x9aa0a6, 2, 0.7);
  const post = flat(PAL.steelLight, 0.55, 0.14);
  // the jump towers' masts, the Mast's lattice and its stays
  const mast = flat(PAL.steelLight, 0.5, 0.3);
  // Each of the five big places has its own wall colour and trim, so you can
  // tell which one you are looking at from across the map: every wall on the
  // map was the one concrete before, and every place looked like every other.
  // They differ by lightness first and hue second. Across the map the fog
  // (140 to 680 m) has taken a third of every colour by 350 m, and on
  // something that small and far off a difference in how light it is still
  // reads after a difference in hue has gone. The compounds and the roadside
  // keep wallMat. A tint costs a merge group or two and no textures of its own.
  const TINT = {
    // concrete at the hub, corrugated sheds at North Yard, brick at South
    // Depot, rendered plaster on East Ridge and in West Town, each in its colour
    hub: { wall: wallOf(0xb6b0a4), trim: flat(0xc0392b, 0.55, 0.25) },
    north: { wall: tex("corrugated", 0xd0a27a, 2.4, 0.65), trim: flat(0xb5612a, 0.55, 0.25) },
    south: { wall: tex("brick", 0xe6ded2, 2, 0.9), trim: flat(0xd8a52a, 0.55, 0.25) },
    east: { wall: tex("plaster", 0xc4957e, 2.5, 0.9), trim: flat(0x8a4030, 0.55, 0.25) },
    west: { wall: tex("plaster", 0xb4bcb4, 2.5, 0.9), trim: flat(0x3d6e63, 0.55, 0.25) },
  };
  // The ground's own: the top of a raised landform, the face of a cliff, and
  // gravel laid on the sand. Slabs only, so each merges into one group.
  // the raised ground in the floor's own texture at the floor's own scale
  // (8 m a tile: 440 m over 55), so a landform reads as the same earth piled
  // up; the "sand" set is Ground037, which has grass in it
  const earth = matte(recolour(ground, 0xb09c7a), 1);
  earth.userData.worldUV = 8;
  const scarp = tex("rock", 0x9a8a70, 4, 1);
  const gravel = matte(recolour(ground, 0x8d8b80), 1);
  // The ground plan's own, laid flat on the sand like the roads: a dirt track,
  // and the dark of an oil stain or a wet braid down the wash's bed.
  const dirt = matte(recolour(ground, 0x8c7456), 1);
  const stain = matte(recolour(ground, 0x4b453d), 1);
  // All of it lies a centimetre over the sand, and the roads over the aprons
  // and tracks where they cross. A centimetre is nothing to the depth buffer
  // from the drop, 150 m up with the near plane at 2 cm, so each layer is
  // pulled toward the eye by a polygon offset instead, a step more for each
  // one that lies over another: aprons and the bed, then tracks, then roads,
  // then stains. The offset is in depth steps, so it holds at any height.
  for (const [m, units] of [
    [gravel, -2],
    [dirt, -4],
    [road, -6],
    [stain, -8],
  ] as const) {
    m.polygonOffset = true;
    m.polygonOffsetFactor = -1;
    m.polygonOffsetUnits = units;
  }

  // the ground: one big textured plane, and the roads laid on it
  const g = new THREE.PlaneGeometry(BR_HALF * 2, BR_HALF * 2);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 55, uv.getY(i) * 55);
  uv.needsUpdate = true;
  const floor = new THREE.Mesh(g, ground);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);
  /** a flat strip w wide from (x0, z0) to (x1, z1), laid on ground `y` high: a road, or in another material an apron, a track or a bed */
  const strip = (x0: number, z0: number, x1: number, z1: number, w: number, mat: THREE.Material = road, y = 0) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const rg = new THREE.PlaneGeometry(w, len);
    const ruv = rg.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < ruv.count; i++) ruv.setXY(i, ruv.getX(i) * (w / 4), ruv.getY(i) * (len / 4));
    ruv.needsUpdate = true;
    const m = new THREE.Mesh(rg, mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(x1 - x0, z1 - z0);
    m.position.set((x0 + x1) / 2, y + 0.01, (z0 + z1) / 2);
    m.receiveShadow = true;
    root.add(m);
  };
  // roads: the four spokes, and a loop road through the field corners
  for (const [x, z] of [
    [0, -165],
    [0, 165],
    [165, 0],
    [-165, 0],
  ]) strip(0, 0, x, z, 8);
  const corners: Array<[number, number]> = [
    [150, -150],
    [150, 150],
    [-150, 150],
    [-150, -150],
  ];
  const outer: Array<[number, number]> = [
    [0, -165],
    [165, 0],
    [0, 165],
    [-165, 0],
  ];
  for (let i = 0; i < 4; i++) {
    strip(outer[i][0], outer[i][1], corners[i][0], corners[i][1], 6);
    strip(corners[i][0], corners[i][1], outer[(i + 1) % 4][0], outer[(i + 1) % 4][1], 6);
  }

  // ---------------------------------------------------------------- the ground's shape
  // Collision is boxes and nothing else, and the floor of the world is y = 0:
  // the bots' ground and the loot's floor both start there, so nothing can be
  // dug. A hill is a stack of slabs each a tread smaller than the one under
  // it, and a hollow is made by raising the ground round it.
  //
  // Everything raised is recorded here (POI-local), so anything put down on
  // the map afterwards (a prop, a sign, a zipline's foot) can stand on the
  // ground as it is and not on the sand under it: see groundTop.
  const LANDFORMS: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; top: number }> = [];
  const raised = (x: number, z: number, w: number, d: number, top: number): void => {
    LANDFORMS.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top });
  };
  /**
   * Raised ground over [x0, x1] x [z0, z1], POI-local, h metres high, as
   * tiers half a metre apart, every one standing on y = 0. Each tier is a
   * tread in from the one under it on every side but those in `sheer`,
   * which go straight up as a cliff. Half a metre is under the bots' 0.56 m
   * step with room to spare, and a 1 m tread is two of tools/e2e.ts's
   * half-metre cells to land on, so a stepped side is a walk for a bot; a
   * sheer side is a wall to a bot at any height, and to a player once it is
   * past the 6.5 m that a climb and the mantle at its top reach. Tiers stop
   * early if the footprint runs out before the height does.
   */
  const terrace = (x0: number, x1: number, z0: number, z1: number, h: number, opts: { tread?: number; sheer?: Side[]; mat?: THREE.Material } = {}): void => {
    const tread = opts.tread ?? 1;
    const inset = (s: Side) => (opts.sheer?.includes(s) ? 0 : tread);
    const tiers = Math.round(h / 0.5);
    for (let i = 0; i < tiers; i++) {
      const ax = x0 + inset("w") * i;
      const bx = x1 - inset("e") * i;
      const az = z0 + inset("n") * i;
      const bz = z1 - inset("s") * i;
      if (bx - ax < 1 || bz - az < 1) break;
      const top = 0.5 * (i + 1);
      raised((ax + bx) / 2, (az + bz) / 2, bx - ax, bz - az, top);
      // a tier the next one covers exactly (every side sheer) is never seen
      const covered = i + 1 < tiers && inset("w") + inset("e") + inset("n") + inset("s") === 0;
      if (!covered) slab(bx - ax, top, bz - az, (ax + bx) / 2, 0, (az + bz) / 2, opts.mat ?? earth);
    }
  };
  /** the top of the raised ground at (x, z), POI-local, or 0 on the sand: where anything put down there stands */
  const groundTop = (x: number, z: number): number =>
    LANDFORMS.reduce((best, l) => (x > l.minX && x < l.maxX && z > l.minZ && z < l.maxZ && l.top > best ? l.top : best), 0);

  // Buildings you can go INSIDE (src/game/brpoi.ts). The places used to be
  // solid boxes you could only stand on, so every fight was outdoors on open
  // sand. This hands the helpers the same box makers the rest of the map uses.
  const poi: PoiCtx = {
    box,
    slab,
    root,
    mats: { wall: wallMat, floor: concrete, trim, crate, steel: post },
  };
  /** a place's own helpers: the same, in its colours, so every building it puts up is tinted */
  const ctxOf = (tint: { wall: THREE.Material; trim: THREE.Material }): PoiCtx => ({ ...poi, mats: { ...poi.mats, ...tint } });

  // ---------------------------------------------------------------- the landforms
  // The map was one flat plane, so a sightline was broken by a prop or by
  // nothing. It has three bands of ground round the middle now and an edge:
  // a bowl of berms round the hub; four pieces of high ground round that,
  // each built differently so the map does not read as a wheel (a ridge
  // with a defile north, a mesa with a cliff east, a dry wash south, two
  // mounds west); and a cliff where the world stops. Every spoke road keeps
  // a pass of 24 m or more through all of it at y = 0, so no road is blocked
  // and nothing that stood on the sand is buried. The ground itself is all
  // slabs, 12 triangles each, in earth and scarp, which main.ts merges into a
  // draw apiece; what stands on it is in materials the map already had.
  //
  // Built before the places, so everything put down after it (the zipline
  // feet, the field's rocks) can ask groundTop what it is standing on.

  // THE BOWL: four berms 44 to 68 m out from the hub, each its own height
  // (north 4 m, east 3, south 2.5, west 5), so the four ways in are not the
  // same way in. When the ring closes on the hub its last circles (22, 10 and
  // 0 m, src/config/ring.json) close inside the rim. Each berm is two runs
  // with a 24 m pass where its spoke road crosses, every face stepped, so a
  // bot walks over one from any side.
  //
  // The runs stop 40 m out along the rim and leave the four corners open, as
  // ways in between the berms. They cannot run on: two berms 16 to 24 m
  // thick would meet in each corner, over the roadside culverts at
  // (62, -62) and (-62, -62) and the ruin at (62, 62), where the Relay and
  // the Motor Pool stand now.
  //
  // A wall along the middle of each crest makes the rim a firing line, with
  // cover from inside the bowl or out. 12 m, or 8 on the west berm, whose
  // ten tiers leave a crest only 10 m long.
  for (const b of [
    { across: "z", from: -64, to: -44, h: 4 },
    { across: "x", from: 44, to: 60, h: 3 },
    { across: "z", from: 44, to: 58, h: 2.5 },
    { across: "x", from: -68, to: -44, h: 5 },
  ] as const) {
    const tiers = b.h / 0.5;
    for (const [a0, a1] of [
      [-40, -12],
      [12, 40],
    ]) {
      const mid = (b.from + b.to) / 2;
      const along = (a0 + a1) / 2;
      // the crest's length, less a metre at each end
      const wall = Math.min(12, a1 - a0 - 2 * (tiers - 1) - 2);
      if (b.across === "z") {
        terrace(a0, a1, b.from, b.to, b.h);
        coverWall(poi, along, mid, wall, 0.8, b.h);
      } else {
        terrace(b.from, b.to, a0, a1, b.h);
        coverWall(poi, mid, along, 0.8, wall, b.h);
      }
    }
  }

  // THE NOTCH: a ridge 6 m high across the north road, 40 m deep, with a
  // 28 m defile where the road goes through it. The run from the hub to
  // North Yard was one 165 m sightline; whoever holds a crest now holds it.
  // Its faces toward the hub and the yard and its outer ends are stepped;
  // the two faces on the defile are sheer 6 m walls.
  terrace(-70, -14, -140, -100, 6, { sheer: ["e"] });
  terrace(14, 70, -140, -100, 6, { sheer: ["w"] });
  // Two ledges against each defile wall, a 2 m climb apiece: a player
  // mantles (2.03 m) from the road to the first, from there to the second,
  // and from there onto the crest. A bot's 0.56 m step does none of that,
  // so it walks round by the stepped ends, and a bot on the crest can only
  // drop down them. They run only where the wall behind them is 5 m high or
  // more, so no stepped tier of the ridge comes within a step of the upper
  // ledge to make it a bot's way up after all, and they stop short of the
  // rock and crate at (7, -115) on the road.
  for (const s of [-1, 1]) {
    for (const [x, h] of [
      [12.8, 4],
      [10.4, 2],
    ]) {
      slab(2.4, h, 12, s * x, 0, -124, scarp);
      raised(s * x, -124, 2.4, 12, h);
    }
  }

  // THE TABLE: a mesa 8 m high east of the hub, the highest ground on the
  // map outside a building, in two runs either side of the east road's 28 m
  // pass. It steps up from the hub's side, the north and the south, and
  // drops to the East Ridge as a sheer 8 m cliff: it is taken from the map
  // and held against the ridge. The cliff is at x 124, 19 m short of the
  // ridge's first step: the north-east compound's rope came down just east
  // of it when the mesa went in, and the gap is the ridge's own ground now.
  terrace(74, 124, -64, -14, 8, { sheer: ["e"] });
  terrace(74, 124, 14, 64, 8, { sheer: ["e"] });

  // THE WASH: a dry riverbed across the south half. Nothing can be dug, so
  // the bed is the sand and the banks are raised either side of it, 3.5 m
  // high with the channel 8 m wide between their feet (z 112 to 120). Your
  // eyes in the bed are under both crests, so it is a covered lane 116 m
  // long; the road's pass and the two open ends are the ways along and out
  // of it, and the stepped banks are a slower climb anywhere else.
  for (const [x0, x1] of [
    [-72, -14],
    [14, 72],
  ]) {
    terrace(x0, x1, 92, 112, 3.5);
    terrace(x0, x1, 120, 140, 3.5);
  }
  // In the bed, culverts and boulders so it is not a shooting gallery. Each
  // takes up one half of the channel's width, the halves taken in turn, so no
  // line runs far along it. A culvert is a concrete box with its bore across
  // the channel: somewhere to hide from the banks, and a way from the bed
  // onto the bank behind it.
  for (const [x, north] of [
    [-64, true],
    [-44, false],
    [-24, true],
    [24, false],
    [44, true],
    [64, false],
  ] as const) {
    const z = north ? 114 : 118;
    slab(0.6, 2.2, 4, x - 1.7, 0, z, concrete);
    slab(0.6, 2.2, 4, x + 1.7, 0, z, concrete);
    slab(4, 0.4, 4, x, 2.2, z, concrete);
  }
  for (const [x, z, w, h, d] of [
    [-53, 117.8, 3.4, 1.9, 2.6],
    [-34, 114.3, 2.8, 1.6, 3],
    [34, 117.6, 3.2, 1.8, 2.8],
    [53, 114.2, 3, 2, 2.6],
  ]) slab(w, h, d, x, 0, z, rock);
  // (The bed's gravel is laid with the rest of the ground plan, after the sites.)

  // THE KNUCKLES: two mounds west of the hub, not a ridge, so the west stays
  // the quick way round and is still broken up: you go round one as easily
  // as over it. The saddle between them carries the west road. They stand
  // at x -144 to -108 because the water tower's rope crosses the ground just
  // east of the south one, and a mound under it would knock its riders off.
  terrace(-144, -108, -70, -38, 5.5);
  terrace(-144, -108, 38, 70, 4);

  // THE EDGE. The map used to stop at an invisible clamp with a post every
  // 20 m. It stops at a cliff now, rock from 216 to 220 m out, so a player is
  // stopped by it (at 215.6 m) and not by the clamp, and it reads as the
  // world ending rather than as a wall to get on top of. That wants it more
  // than 6.5 m above anywhere at its foot: a climb, its end boost and the
  // mantle at the top of it reach that far. The shelf below stands 2.5 m high
  // against it, so the cliff is 10 m, 7.5 over the shelf. It starts no
  // nearer than 216: tools/e2e.ts stands the player at (215, 215) to prove
  // the ring hurts outside it, and nothing solid may be there.
  for (const [w, d, x, z] of [
    [440, 4, 0, -218],
    [440, 4, 0, 218],
    [4, 432, -218, 0],
    [4, 432, 218, 0],
  ]) {
    slab(w, 10, d, x, 0, z, scarp);
    raised(x, z, w, d, 10);
  }
  // A shelf at the cliff's foot, five half-metre tiers over 16 m, so the band
  // round the edge that was dead ground is somewhere to rotate along. The
  // shelf does not turn the corners: wrapped round them its top tier would
  // stand over (215, 215). Each corner is a square of sand between the ends
  // of two shelves, entered off their lowest tier.
  for (let i = 0; i < 5; i++) {
    const h = 0.5 * (i + 1);
    const at = 200 + 3.2 * i + 1.6;
    for (const [w, d, x, z] of [
      [400, 3.2, 0, -at],
      [400, 3.2, 0, at],
      [3.2, 400, -at, 0],
      [3.2, 400, at, 0],
    ]) {
      slab(w, h, d, x, 0, z, earth);
      raised(x, z, w, d, h);
    }
  }
  // A tower on the cliff top at each compass point, 14 m to its top with a
  // red lamp: the outermost landmarks, to find your way by from across the map.
  const gateLamp = emissive(0xff3b2f, 2.4);
  const gateLampGeo = new THREE.SphereGeometry(0.6, 12, 8);
  for (const [x, z, name] of [
    [0, -218, "NORTH"],
    [0, 218, "SOUTH"],
    [218, 0, "EAST"],
    [-218, 0, "WEST"],
  ] as const) {
    const alongX = z !== 0;
    slab(alongX ? 12 : 4, 4, alongX ? 4 : 12, x, 10, z, scarp);
    const lamp = new THREE.Mesh(gateLampGeo, gateLamp);
    lamp.position.set(x, 14.6, z);
    root.add(lamp);
    // its name on the face toward the middle of the map
    const inX = -Math.sign(x) * 2.1;
    const inZ = -Math.sign(z) * 2.1;
    root.add(textPanel(name, x + inX, 12, z + inZ, Math.atan2(inX, inZ), 7, 1.4));
  }
  // a lit line along the shelf's foot, where you can see it from the field
  for (const [w, d, x, z] of [
    [398, 0.15, 0, -199],
    [398, 0.15, 0, 199],
    [0.15, 398, -199, 0],
    [0.15, 398, 199, 0],
  ]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), emissive(PAL.orange, 1.2));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.03, z);
    root.add(m);
  }

  // The top of the Mast's lattice, set when the hub is built: its balloon
  // (see the jump towers below) flies from there and not from the sand.
  let mastTop = 0;
  // The rotation network's two ends, recorded as the places are built and
  // tied together in one table after the sites (see "the rotation network"):
  // each jump tower's rope anchor and pad, and the height of every roof or
  // deck a rope comes down on.
  const towerAt: Record<string, { anchor: THREE.Vector3; floor: number }> = {};
  const deckAt: Record<string, number> = {};

  // ---------------------------------------------------------------- THE HUB
  {
    const here = ctxOf(TINT.hub);
    const W = 32;
    const H = 3;
    // walls with a 6 m gate in the middle of each side
    for (const s of [-1, 1]) {
      for (const half of [-1, 1]) {
        box(W - 3, H, 1, half * (W / 2 + 1.5), 0, s * W, TINT.hub.wall);
        box(1, H, W - 3, s * W, 0, half * (W / 2 + 1.5), TINT.hub.wall);
      }
    }
    // gate posts
    for (const [x, z] of [
      [3, -W],
      [-3, -W],
      [3, W],
      [-3, W],
      [W, 3],
      [W, -3],
      [-W, 3],
      [-W, -3],
    ]) box(1.2, 4.2, 1.2, x, 0, z, concrete);
    // THE MAST: the map's one landmark, seven storeys and a lattice, 40 m to
    // its lamp. The camera sees 400 m and nothing on Outskirts is more than
    // 311 m from the middle, so from the middle, and only there, one tower
    // can be seen from everywhere on the map. It replaces a 13 m stack of three
    // solid blocks that you climbed by crates and could not go inside.
    //
    // The ground storey is an open hall on four corner columns, so the hub's
    // four gate lanes run straight through it where the old stack blocked the
    // courtyard. Above it, six storeys with window bands east and west and a
    // switchback stair a bot can walk from the hall to the roof. At 16 m deep
    // its treads are the full 0.62 m: two flights of ten, 6.2 m each, with
    // 2.2 m of floor between them in the 15.2 m inside, so half a metre of
    // flight rises 0.32 m, well under the bots' 0.56 m step. The column at
    // its south-east corner stands in the first two steps, which costs
    // nothing: solids overlapping are one solid.
    //
    // Loot lands on anything up to 12 m (src/game/loot.ts), so the hall and
    // the floors at 4, 8 and 12 m all take it, and the floors at 16, 20 and
    // 24 m hold none: they are the fight on the way up. The lattice, its
    // stays and its lamp are for show and not solid, so there is nothing
    // over the roof to perch on.
    const { roof } = building(here, { x: 0, z: 0, w: 18, d: 16, storeys: 7, storeyH: 4, openGround: true, windows: ["e", "w"], stairs: true, roofAccess: true, parapet: true });
    box(0.9, 12, 0.9, 0, roof, 0, mast, false);
    mastTop = roof + 12;
    deckAt.mast = roof;
    // four stays from the lattice to the roof, their feet clear of the stair's hole
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const a = new THREE.Vector3(sx * 0.35, roof + 9, sz * 0.35);
      const b = new THREE.Vector3(sx * 5, roof, sz * 5.5);
      const stay = new THREE.Mesh(bevel(0.12, a.distanceTo(b), 0.12, 0.03), mast);
      stay.position.copy(a).lerp(b, 0.5);
      stay.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      stay.castShadow = true;
      stay.receiveShadow = true;
      root.add(stay);
    }
    const lamp = new THREE.Mesh(gateLampGeo, gateLamp);
    lamp.position.set(0, mastTop + 0.6, 0);
    root.add(lamp);
    // Four buildings, each with a crate stack beside it, a stair inside to its
    // roof, and a container. Before the roof stair no bot ever stood on these
    // roofs: the only way up was the crates, and a 1.35 m crate is a player's
    // mantle and not a bot's step.
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const x = sx * 19;
      const z = sz * 17;
      // two floors you can fight through, doors facing the tower, windows out
      building(here, {
        x,
        z,
        w: 13,
        d: 11,
        storeys: 2,
        storeyH: 3.4,
        doors: [sz > 0 ? "n" : "s", sx > 0 ? "w" : "e"],
        windows: [sz > 0 ? "s" : "n", sx > 0 ? "e" : "w"],
        stairs: true,
        roofAccess: true,
        balcony: true,
      });
      crateStair(here, x + sx * 8.4, z - sz * 2, 6.8, sz > 0 ? -1 : 1);
      box(6, 2.6, 2.6, x - sx * 4, 0, z + sz * 9, [steelA, steelB, steelC][(sx + 1 + sz + 1) % 3]);
    }
    // low cover round the Mast, out past its hall: 10 m out it stood inside it
    for (const [x, z] of [
      [14, 0],
      [-14, 0],
      [0, 14],
      [0, -14],
    ]) box(3, 1.1, 0.8, x, 0, z, concrete);
    root.add(textPanel("THE HUB", 0, 3.6, -W + 0.6, 0, 6, 1.4));
  }

  // How far North Yard reaches, for placeAt: out to the silo block's far
  // corner, past the default reach. Set when the yard is built.
  let northReach = 0;

  // ---------------------------------------------------------------- NORTH YARD
  {
    const here = ctxOf(TINT.north);
    const cz = -165;
    // Twenty containers in four rows. Every one was a solid block, so the
    // yard was a field of things to climb and nothing to go through. Eight
    // are open-ended shells now, every other one along a row and across the
    // rows, so the yard is a grid of covered runs and blind corners: you can
    // be inside one while somebody stands on its roof. A shell is its roof
    // and two sides, 2.4 m clear inside, so a body stands up in it and loot
    // lands in it. The four stacked ends of the outer rows stay solid under
    // the containers on top of them.
    let n = 0;
    for (let row = -1.5; row <= 1.5; row++) {
      for (let col = -2; col <= 2; col++) {
        const x = col * 8;
        const z = cz + row * 5;
        const mat = [steelA, steelB, steelC][n++ % 3];
        const stacked = (col === -2 || col === 2) && Math.abs(row) > 1;
        if (!stacked && Math.abs(col + row + 1.5) % 2 === 0) {
          box(6, 0.2, 2.6, x, 2.4, z, mat);
          for (const s of [-1, 1]) box(6, 2.4, 0.15, x, 0, z + s * 1.225, mat);
        } else box(6, 2.6, 2.6, x, 0, z, mat);
        // the ends of the outer rows are stacked two high
        if (stacked) box(6, 2.6, 2.6, x, 2.6, z, [steelB, steelC, steelA][n % 3]);
      }
    }
    // A way up for the bots. The containers are 2.6 m, a player's climb and
    // never a bot's step, so no bot ever stood on one. Five half-metre tiers
    // against the north side of the north row's middle container climb to
    // 2.5 m, a step from its roof, and a plank across each gap beside it
    // makes the row's three middle roofs one catwalk over the yard. The
    // planks are 2.4 m up, so the gaps under them are still ways through.
    for (let i = 0; i < 5; i++) slab(4, 0.5 * (i + 1), 1.6, 0, 0, cz - 7.5 - 1.3 - 0.8 - 1.6 * (4 - i), concrete);
    for (const s of [-1, 1]) box(2, 0.2, 2.6, s * 4, 2.4, cz - 7.5, crate);

    // THE SILO BLOCK, the yard's silhouette: a grain elevator of four
    // storeys with a round head on its roof and a silo either side of it,
    // three drums in a row from the hub 12 m apart. Its stair climbs to the
    // roof, and at 13 m deep the treads are the full 0.62 m, so half a metre
    // of flight rises 0.34 m. The floors at 3.4, 6.8 and 10.2 m are all under
    // the 12 m that loot lands on; the roof at 13.6 m is the fight on top.
    //
    // It stands 3 m clear of the container rows, room to walk and the east
    // door's approach, and 4 m clear of the jump tower's pad to the south.
    // The head is solid (see roundSolid): drawn and not solid, it would hide
    // anyone on the roof inside it, looking out. It sits against the roof's
    // north-west corner, clear of the stair's hole, so the roof is an L round
    // it from the stairhead, east over the yard and south toward the hub.
    const sx = -28.5;
    const sz = cz - 7;
    const silo = building(here, { x: sx, z: sz, w: 13, d: 13, storeys: 4, storeyH: 3.4, doors: ["s", "e"], windows: ["n", "w"], stairs: true, roofAccess: true });
    drum(sx - 1.7, sz - 1.7, 4.4, silo.roof, 9, TINT.north.wall, { mat: TINT.north.trim, h: 2.5 });
    roundSolid(sx - 1.7, sz - 1.7, 4.4, silo.roof, silo.roof + 9);
    // The two silos are all silhouette, 20 m to their eaves and nothing on
    // them for loot, which lands on nothing over 12 m. One stands north-west
    // of the block and one north of the containers, clear of the drop point
    // and crate between them.
    for (const [x, z] of [
      [-42, cz - 20],
      [-17, cz - 21],
    ]) {
      drum(x, z, 4.5, 0, 20, TINT.north.wall, { mat: TINT.north.trim, h: 2.5 });
      roundSolid(x, z, 4.5, 0, 20);
    }
    // the yard's name across the block's top storey, facing the hub
    bigSign("NORTH YARD", sx, silo.roof - 2.2, sz + 6.5 + 0.26, 0, 2.8);
    northReach = Math.hypot(sx - 6.7, sz - 6.7 - (cz + 15));

    // the yard's warehouse: two floors, four ways in, and a stair on to its roof
    building(here, { x: 24, z: cz - 18, w: 18, d: 14, storeys: 2, storeyH: 3.6, doors: ["s", "w"], windows: ["n", "e"], stairs: true, roofAccess: true });
    // Crates up its east face as well, a player's quick way on to the roof.
    // They stood on the west face, a metre in front of the west door, which
    // opened into the slot behind them: no bot ever came through it.
    crateStair(here, 35, cz - 12, 7.2, -1);
    box(1.6, 1.4, 1.6, 21, 0, cz - 13.5, crate);
    box(1.6, 1.4, 1.6, 3, 0, cz + 14, crate);
    box(1.6, 1.4, 1.6, -9, 0, cz - 14, crate);
    // Its ramp runs south down the west face: east of it are the yard's
    // containers and a beacon.
    towerAt.north = jumpTower(here, -26, cz + 6, { face: "w", foot: "s" }, 6);
  }

  // How far South Depot reaches, for placeAt: out to the loading building's
  // far corner. Set when the depot is built.
  let southReach = 0;

  // ---------------------------------------------------------------- SOUTH DEPOT
  {
    const here = ctxOf(TINT.south);
    const cz = 165;
    for (const x of [-16, 0, 16]) {
      // a roof on four pillars: under it is cover from above and a lane to fight down
      for (const [px, pz] of [
        [x - 2.5, cz - 11],
        [x + 2.5, cz - 11],
        [x - 2.5, cz + 11],
        [x + 2.5, cz + 11],
      ]) box(0.8, 5, 0.8, px, 0, pz, concrete);
      box(7, 0.6, 24, x, 5, cz, roofMat);
      box(1.6, 1.4, 1.6, x + 1.5, 0, cz - 4, crate);
      box(1.6, 1.4, 1.6, x - 1.8, 0, cz + 5, crate);
      box(1.6, 1.4, 1.6, x - 1.8, 1.4, cz + 5, crate);
      // THE BAYS. A canopy with nothing under it is cover from above and
      // nothing to fight round, so each has walls down both sides now, up to
      // the roof and flush with its edges. The outer two are closed at the
      // north as well and open south, onto their sheds' doors: rooms you
      // fight in rather than lanes you fight down. The middle one stays open
      // at both ends, onto the shed to its north: the bots' node for the
      // depot is inside it, and a bot walking out of a room open at one end
      // toward the closed end can only slide into its corner.
      for (const s of [-1, 1]) slab(0.4, 5, 24, x + s * 3.3, 0, cz, TINT.south.wall);
      if (x !== 0) slab(7, 5, 0.4, x, 0, cz - 11.8, TINT.south.wall);
    }
    // (There was a fourth at (-24, cz + 2): the loading building stands on it.)
    for (const [x, z] of [
      [-8, cz - 16],
      [8, cz + 16],
      [24, cz - 2],
    ]) box(6, 1.1, 0.8, x, 0, z, concrete);
    // three sheds under the canopies, and the depot office over the yard: the
    // lanes between the canopies were the whole place before
    for (const x of [-16, 0, 16]) {
      building(here, { x, z: cz + (x === 0 ? -18 : 18), w: 9, d: 7, storeys: 1, storeyH: 3.4, doors: [x === 0 ? "s" : "n"], windows: ["e", "w"] });
    }
    // The office's stair goes on to its roof now: at 9 m deep that is two
    // flights of 0.36 m treads, the same as West Town's houses, which the
    // bots climb. Its door is on the north, onto the yard and the crane. On
    // the west it opened 0.8 m from the east bay's wall, with a pillar of that
    // bay's canopy in front of it: a gap a body cannot get through. It stands
    // 10 cm east of where it did, so its west wall and the east shed's east
    // wall, which touch for 2 m, are not in one plane and do not flicker.
    deckAt.office = building(here, { x: 26.1, z: cz + 12, w: 11, d: 9, storeys: 2, storeyH: 3.4, doors: ["n"], windows: ["n", "s", "e"], stairs: true, roofAccess: true, balcony: true }).roof;
    crateStair(here, 33, cz + 6, 6.8, -1);

    // THE LOADING BUILDING: three storeys on the west side of the yard, what
    // the crane is for, and the depot's inside. At 16 m deep its treads are
    // the full 0.62 m, half a metre of flight rising 0.29 m, and its floors
    // at 3.6 and 7.2 m and its roof at 10.8 m all take loot. Its north door
    // looks at the jump tower's ramp, 6 m off; its east door at the west
    // bay, 4 m off, and it opens beside the top of the first flight, not
    // onto its side.
    const load = { x: -31, z: cz + 3, w: 14, d: 16 };
    building(here, { ...load, storeys: 3, storeyH: 3.6, doors: ["n", "e"], windows: ["s", "w"], stairs: true, roofAccess: true });
    southReach = Math.hypot(load.x - load.w / 2 - 0.2, load.z + load.d / 2 + 0.2 - cz);

    // THE CRANE: a portal crane over the north of the yard, the south's
    // silhouette and the only thing on its skyline, 26.4 m to the top of
    // its girder. Each leg is four thin columns with bracing up its faces,
    // which reads as a lattice with the sky through it from across the map,
    // where four plain sides would read as a chimney. The trolley hangs off
    // centre with a container on its cables: square under the girder it
    // would read as a gate, and off to one side it reads as a machine. The
    // legs stand 1 m clear of the drop point by the east leg, and the girder
    // and what hangs from it are solid, so a shot at them hits them.
    const top = 24;
    const cr = { z: cz - 15, legs: [-27, 27] };
    for (const lx of cr.legs) {
      const c = [-1.4, 1.4];
      for (const px of c) for (const pz of c) slab(1.2, top, 1.2, lx + px, 0, cr.z + pz, TINT.south.trim);
      // a zig-zag of braces up each face, 6 m a panel, for show
      for (let k = 0; k < 4; k++) {
        const y0 = k * 6;
        const flip = k % 2 === 0 ? 1 : -1;
        for (const face of c) {
          strut(new THREE.Vector3(lx - 1.4 * flip, y0, cr.z + face), new THREE.Vector3(lx + 1.4 * flip, y0 + 6, cr.z + face), 0.3, TINT.south.trim);
          strut(new THREE.Vector3(lx + face, y0, cr.z - 1.4 * flip), new THREE.Vector3(lx + face, y0 + 6, cr.z + 1.4 * flip), 0.3, TINT.south.trim);
        }
      }
    }
    slab(58, 2.4, 3, 0, top, cr.z, TINT.south.trim);
    box(3.4, 1.6, 3.4, -8, top - 1.6, cr.z, roofMat);
    for (const s of [-1, 1]) strut(new THREE.Vector3(-8 + s * 1.2, top - 1.6, cr.z), new THREE.Vector3(-8 + s * 2.4, 14.6, cr.z), 0.08, roofMat);
    box(6, 2.6, 2.6, -8, 12, cr.z, steelB);
    // the depot's name along the girder, facing the hub
    bigSign("SOUTH DEPOT", 0, top + 1.2, cr.z - 1.56, Math.PI, 2.8);

    // Its ramp runs north up the east face. It stood at (-28, cz - 6), where
    // the crane's west leg and the loading building's north door are now, and
    // moved west and north clear of both and of the balloon's mast.
    towerAt.south = jumpTower(here, -40, cz - 13, { face: "e", foot: "n" }, 6);
  }

  // ---------------------------------------------------------------- EAST RIDGE
  {
    const cx = 165;
    const here = ctxOf(TINT.east);
    // Two 2 m steps: the second mantleable from the first. They are the two
    // biggest boxes on the map, so they are slabs: bevelled they cost 600
    // triangles for a chamfer nobody sees. The ridge is ground, so all of its
    // rock goes on the record for groundTop.
    for (let i = 0; i < 2; i++) {
      const size = 44 - i * 10;
      slab(size, 2, size, cx + i * 2, i * 2, i * 1.5, rock);
      raised(cx + i * 2, i * 1.5, size, size, (i + 1) * 2);
    }
    // THE UNDERCROFT: a room inside the mesa, where its third and fourth
    // steps were. Its floor is the second step's top at 4 m, and its roof at
    // 8 m is the bunker's terrace, the height the fourth step's top was, so
    // the bunker and the north ramp's head stand where they did. A stair up
    // its east side comes out through the terrace, so a bot that walks in
    // from the south ramp can go on up to the bunker. The ridge had a room
    // before, but it stood on the sand inside the first two steps: its floor
    // was rock and nobody was ever inside it.
    const top = 8;
    building(here, { x: cx + 5, z: 4, y: 4, w: 22, d: 22, storeys: 1, storeyH: top - 4, doors: ["w", "s"], windows: ["n", "e"], roofAccess: true, parapet: false });
    // the bunker on the terrace, a gap in its west wall
    box(8, 3, 1, cx + 6, top, 4.5 - 4, TINT.east.wall);
    box(8, 3, 1, cx + 6, top, 4.5 + 4, TINT.east.wall);
    box(1, 3, 8, cx + 10, top, 4.5, TINT.east.wall);
    box(1, 3, 3, cx + 2, top, 4.5 + 2.5, TINT.east.wall);
    box(8.4, 0.5, 8.4, cx + 6, top + 3, 4.5, roofMat);
    // Two crates against its west wall, beside the doorway and not in it. Its
    // roof is 3.5 m over the terrace, past the 2.03 m mantle, and loot lands
    // on it (anything up to 12 m takes loot); from the crates it is a jump
    // and a short mantle.
    box(1.6, 1.4, 1.6, cx - 0.9, top, 7, crate);
    box(1.6, 2.8, 1.6, cx + 0.7, top, 7, crate);
    // THE STACK: a chimney off the undercroft, tapering to a red lamp 31 m
    // up, the east of the map's landmark as the Mast is the middle's. It is a
    // thin vertical where the Mast is a mass, so the two never read as each
    // other at a distance. It stands in the terrace's north-east corner, since
    // the stair's hole takes the south-east, 1.2 m short of the bunker: room
    // for a body to go round between them.
    const stackX = cx + 13.2;
    const stackZ = -4.2;
    for (const [w, y0, y1] of [
      [6, top, 14],
      [5, 14, 22],
      [4, 22, 30],
    ]) {
      slab(w, y1 - y0, w, stackX, y0, stackZ, TINT.east.wall);
      // A band of safety paint round each section, for show, in the orange
      // trim: in the hazard yellow they were the only shadow-casting slabs
      // that colour, and a group of their own is a draw call of its own.
      slab(w + 0.2, 0.4, w + 0.2, stackX, y1 - 2.4, stackZ, trim, false);
    }
    slab(4.6, 0.8, 4.6, stackX, 30, stackZ, TINT.east.trim);
    const stackLamp = new THREE.Mesh(gateLampGeo, gateLamp);
    stackLamp.position.set(stackX, 31.3, stackZ);
    root.add(stackLamp);
    // a ramp the bots can walk (0.5 m steps over 32 m) up the north face,
    // its head level with the terrace
    for (let i = 0; i < 16; i++) {
      slab(5, 0.5 * (i + 1), 2, cx - 4, 0, -38 + i * 2, rock);
      raised(cx - 4, -38 + i * 2, 5, 2, 0.5 * (i + 1));
    }
    // and a second one up the south face to the second step, 3 m from the
    // undercroft's south door. With one ramp, anything standing in it shut
    // the whole ridge to the bots.
    for (let i = 0; i < 8; i++) {
      slab(10, 0.5 * (i + 1), 2, cx - 8, 0, 33 - 2 * i, rock);
      raised(cx - 8, 33 - 2 * i, 10, 2, 0.5 * (i + 1));
    }
    // The rope hangs 2.4 m over the terrace. At 1.6 m, as it was, a rider's
    // feet start under the terrace's top and the terrace itself knocks them
    // off: it was never ridden from this end. Where it goes is the rotation
    // network's business, after the sites.
    towerAt.ridge = { anchor: new THREE.Vector3(cx - 1, top + 2.4, -4), floor: top };
    box(1.6, 1.4, 1.6, cx - 24, 0, 8, crate);
    box(1.6, 1.4, 1.6, cx + 3, 0, 26, crate);
    root.add(textPanel("EAST RIDGE", cx, 3.4, -28, 0, 6, 1.4));
  }

  // How far West Town reaches, for placeAt: out to its churchyard's far
  // corner, which is well past the default reach. Set when the town is built.
  let westReach = 0;

  // ---------------------------------------------------------------- WEST TOWN
  {
    const here = ctxOf(TINT.west);
    const cx = -165;
    // Six houses you can go inside, in two rows with a street between them:
    // doors onto the street, windows on the far sides, and a stair to the
    // roof, by way of a first floor in the four with two storeys. They were
    // solid 8 x 8 blocks before, and until the roof stair no bot ever stood on
    // a roof in town: it fought in the street under the people who had.
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const x = cx - 14 + c * 14;
        const z = -8 + r * 16;
        const twoStorey = c !== 1;
        building(here, {
          x,
          z,
          w: 10,
          d: 9,
          storeys: twoStorey ? 2 : 1,
          storeyH: 3.4,
          doors: [r ? "n" : "s"],
          windows: r ? ["s", "e", "w"] : ["n", "e", "w"],
          roofAccess: true,
          balcony: c === 2,
        });
        crateStair(here, x + 6.4, z + (r ? 5 : -5), twoStorey ? 6.8 : 3.4, r ? 1 : -1);
      }
    }
    // Two low walls down the middle of the street, cover between the two
    // rows. The street runs from z -3.3 to 3.3, and no door on it has a wall
    // within 2.5 m: these stand in the gap between the west and middle
    // houses, not in front of either. They once stood at z -2 and 6: one
    // 0.9 m from the west house's only door, a gap the bots' half-metre walk
    // never finds, and the other inside the house across the street.
    for (const zz of [-1.2, 1.2]) coverWall(here, cx - 7, zz, 4, 0.8);
    coverWall(here, cx + 6, 2, 0.8, 7);

    // THE WATER TOWER. Its tank stood on four 10 m poles that nothing could
    // climb, so its rope was only ever ridden into town and never out. It
    // stands on a three-storey block now, with a stair inside to the roof,
    // and both floors take loot. The block is 10 m wide to fit the ground
    // it has: east of the south-east house's crate stack and clear of its
    // balcony, clear of the drop point at (-143, 12), and short of where the
    // north-west farm's rope came down, at (-131, 28), when it was built.
    const tank = building(here, { x: cx + 27, z: 20.5, w: 10, d: 15, storeys: 3, storeyH: 3.4, doors: ["e", "s"], windows: ["n", "w"], roofAccess: true });
    box(6, 3.5, 6, cx + 25.4, tank.roof, 16.4, steelA);
    // Off the roof, out of town: a place needs a way out that is not a run
    // across the open. The rope leaves from beside the tank over the east
    // parapet, 3.3 m over the roof: hands on the roof are 2.13 m up and
    // reach 2.41 m, and a rider's feet clear the 0.9 m parapet on the way
    // off. Any lower and the parapet knocks them off it.
    zipline(root, new THREE.Vector3(cx + 30.5, tank.roof + 3.3, 20.5), new THREE.Vector3(cx + 70, 2.2, 52), tank.roof, 0);
    for (const [x, z] of [
      [cx - 26, -14],
      [cx + 12, 22],
      [cx - 4, 26],
    ]) box(6, 1.1, 0.8, x, 0, z, concrete);
    // its ramp runs north up the east face: west of it is the churchyard, south the houses' crate stairs
    towerAt.west = jumpTower(here, cx + 6, -26, { face: "e", foot: "n" }, 6);

    // THE CLOCKTOWER: the town's silhouette, four storeys and a square spire
    // on four posts, 26 m to its tip. A square spire against the sky is a
    // different shape from the ridge's chimney and the Mast's lattice. It
    // stands north-west of the houses, the one piece of ground by the town
    // with room for it and its churchyard: north-east of them are the jump
    // tower's ramp and rope, the north mound and a beacon. At 12 m deep its
    // stair's treads are 0.575 m, so half a metre of flight rises 0.37 m,
    // and its floors at 3.4, 6.8 and 10.2 m are all low enough for loot.
    const ctX = cx - 12;
    const ctZ = -32;
    const clock = building(here, { x: ctX, z: ctZ, w: 12, d: 12, storeys: 4, storeyH: 3.4, doors: ["s"], windows: ["n", "e", "w"], roofAccess: true, parapet: true });
    // The belfry, all for show: posts on the parapet's corners and the spire
    // on them. The posts are 4.5 m so that the spire's base is half a metre
    // over the eyes of anyone jumping on the 0.9 m parapet (a 1.42 m jump,
    // eyes 1.68 m over the feet), who would otherwise see out through it
    // unseen: a mesh is not drawn from inside.
    const belfry = 4.5;
    for (const [px, pz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) box(0.6, belfry, 0.6, ctX + px * 5.7, clock.roof, ctZ + pz * 5.7, TINT.west.wall, false);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(8.6, 8, 4), TINT.west.trim);
    spire.rotation.y = Math.PI / 4;
    spire.position.set(ctX, clock.roof + belfry + 4, ctZ);
    spire.castShadow = true;
    spire.receiveShadow = true;
    root.add(spire);
    // a lit clock high on the south face, and the town's name over the door
    const face = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.12, 24), emissive(0xffc21a, 1.4));
    face.rotation.x = Math.PI / 2;
    face.position.set(ctX, clock.roof - 2, ctZ + 6.26);
    root.add(face);
    box(0.12, 0.8, 0.06, ctX, clock.roof - 2, ctZ + 6.35, roofMat, false);
    box(0.6, 0.12, 0.06, ctX + 0.3, clock.roof - 2.06, ctZ + 6.35, roofMat, false);
    root.add(textPanel("WEST TOWN", ctX, 4.4, ctZ + 6.3, 0, 6, 1.4));
    // THE CHURCHYARD: a 2.2 m wall round the clocktower, with a gate in
    // front of its door and one toward the jump tower. A 2.2 m wall is a
    // jump and a mantle to a player and a wall to a bot, so it is a pocket
    // players hold and bots walk into by the gates. Five graves inside are
    // cover to crouch behind. The wall stands 1.6 m short of the crate stack
    // north of the houses, so there is a way round between them.
    const yard = { x0: cx - 27, x1: cx + 2, z0: -46, z1: -22.5 };
    const yardWall = (x0: number, x1: number, z0: number, z1: number): void => {
      slab(x1 - x0, 2.2, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, TINT.west.wall);
    };
    // half the wall's thickness
    const half = 0.25;
    yardWall(yard.x0 - half, yard.x1 + half, yard.z0 - half, yard.z0 + half);
    yardWall(yard.x0 - half, ctX - 1.5, yard.z1 - half, yard.z1 + half);
    yardWall(ctX + 1.5, yard.x1 + half, yard.z1 - half, yard.z1 + half);
    yardWall(yard.x0 - half, yard.x0 + half, yard.z0 + half, yard.z1 - half);
    // the east gate looks at the foot of the jump tower's ramp
    yardWall(yard.x1 - half, yard.x1 + half, yard.z0 + half, -35.5);
    yardWall(yard.x1 - half, yard.x1 + half, -32.5, yard.z1 - half);
    westReach = Math.hypot(yard.x0 - half - cx, yard.z0 - half);
    for (const [x, z, alongX] of [
      [cx - 22.5, -41, false],
      [cx - 22.5, -33, false],
      [cx - 14, -42.5, true],
      [cx - 7, -42.5, true],
      [cx - 2, -40, false],
    ] as const) slab(alongX ? 2.2 : 1, 1.2, alongX ? 1 : 2.2, x, 0, z, concrete);
  }

  // ------------------------------------------------------- the four compounds
  // The corners between the five places were 100 m of empty sand you crossed
  // with nothing to use. Each diagonal now holds a small walled compound: three
  // or four rooms, a watch platform, and a zipline off it, so a rotation has
  // somewhere to stop. Where each rope goes is the rotation network's, after
  // the sites.
  //
  // Each was three buildings in a 52 m yard with a third of it built on, and
  // the four were the same yard: from inside one, nothing said which. Each
  // has four more things now, and no two put them in the same place: a
  // fourth building, two storeys with a stair on to its roof; a covered yard,
  // a roof on six posts with pallets under it; a 2 m wall that makes the open
  // ground two rooms with one gate between them; and one thing of its own
  // that says which compound it is from across its quarter of the map. Each
  // compound's own block follows the loop. They are all in the shared
  // concrete and not a tint of their own: the tints are for the five big
  // places, and four more would double the map's merge groups for a
  // difference the fog has taken by 120 m.
  //
  // `gate` is a way out through the back wall (the compound's own z, so the
  // pens' gate is 1.5 m north of its middle to 2 m south of it). `nameX` moves
  // the name along the north wall off the middle, where one fourth building
  // stands in front of it.
  const COMPOUNDS: Array<{ id: string; name: string; x: number; z: number; gate?: [number, number]; nameX?: number }> = [
    { id: "nw", name: "NORTHWEST FARM", x: -104, z: -104 },
    { id: "ne", name: "NORTHEAST STORE", x: 104, z: -104 },
    { id: "sw", name: "SOUTHWEST PENS", x: -104, z: 104, gate: [-1.5, 2] },
    { id: "se", name: "SOUTHEAST WORKS", x: 104, z: 104, nameX: -9 },
  ];
  for (const c of COMPOUNDS) {
    // a wall round three sides, open toward the middle of the map
    const W = 26;
    const gapSide = c.x < 0 ? 1 : -1;
    box(W * 2, 2.6, 1, c.x, 0, c.z - W, wallMat);
    box(W * 2, 2.6, 1, c.x, 0, c.z + W, wallMat);
    const [g0, g1] = c.gate ?? [W, W];
    for (const [a, b] of [
      [-W, g0],
      [g1, W],
    ]) if (b > a) box(1, 2.6, b - a, c.x + gapSide * -W, 0, c.z + (a + b) / 2, wallMat);
    // the rooms: the big room north of the middle, the east room and the west room south of it
    building(poi, { x: c.x - 8, z: c.z - 8, w: 13, d: 11, storeys: 2, storeyH: 3.4, doors: ["s"], windows: ["n", "e", "w"], stairs: true, balcony: true });
    building(poi, { x: c.x + 9, z: c.z + 7, w: 11, d: 9, storeys: 1, storeyH: 3.4, doors: ["n", "w"], windows: ["s", "e"] });
    building(poi, { x: c.x - 10, z: c.z + 10, w: 9, d: 8, storeys: 1, storeyH: 3.4, doors: ["e"], windows: ["n", "s"] });
    crateStair(poi, c.x - 1, c.z - 8, 6.8, 1);
    // A watch platform with a zipline off it. Its ramp runs south down its
    // east face and stops short of the low cover there: west of it is the big
    // room, north of it the compound's wall.
    towerAt[c.id] = jumpTower(poi, c.x + 14, c.z - 14, { face: "e", foot: "s" }, 6);
    for (const [ox, oz] of [
      [-2, 16],
      [16, -2],
      [-16, -2],
    ]) {
      // at the works, the tank yard's wall runs 2 m south of the east block,
      // and the foot of the platform's ramp would be a slot between them
      if (c.id === "se" && ox === 16) continue;
      box(4, 1.2, 1, c.x + ox, 0, c.z + oz, concrete);
    }
    root.add(textPanel(c.name, c.x + (c.nameX ?? 0), 3.2, c.z - W + 0.6, 0, 7, 1.4));
  }

  /**
   * A compound's fourth building: two storeys and a stair on to the roof, the
   * first roof in any compound a bot can stand on. Its doors face the yard;
   * the stair runs up the east side, so a door is never put there. It is
   * 10 m deep, a metre more than West Town's houses. With the roof stair its
   * two flights share the depth, and at 9 m their treads are 0.36 m for a
   * 0.43 m rise: each is a step, but half a metre of flight rises 0.58 m,
   * more than one, and the bots' walk (tested on a half-metre grid) only
   * gets up that by working across the flight. At 10 m a tread is 0.44 m
   * and half a metre of flight rises 0.48 m. (Compound-local: x east, z
   * south of the compound's middle.)
   */
  const fourth = (c: { x: number; z: number }, x: number, z: number, doors: Side[], windows: Side[]): void => {
    building(poi, { x: c.x + x, z: c.z + z, w: 10, d: 10, storeys: 2, storeyH: 3.4, doors, windows, roofAccess: true });
  };
  /**
   * A covered yard: a roof on six posts at 4.5 m, clear of a jump, open all
   * round, with its middle posts along its long sides, and pallets under it
   * to fight between. A pallet stack is at most 1.9 m, so there is 2.6 m over
   * it to the roof and loot can land on it. `timber` posts are for the farm
   * buildings; the rest are steel. (POI-local: x and z are the roof's middle.)
   */
  const coveredYard = (x: number, z: number, w: number, d: number, timber: boolean, pallets: Array<[number, number, number]>): void => {
    slab(w, 0.5, d, x, 4.5, z, roofMat);
    const long = w >= d;
    for (const a of [-1, 0, 1]) {
      for (const b of [-1, 1]) {
        const px = x + (long ? a : b) * (w / 2 - 0.25);
        const pz = z + (long ? b : a) * (d / 2 - 0.25);
        if (timber) box(0.5, 4.5, 0.5, px, 0, pz, crate);
        else slab(0.5, 4.5, 0.5, px, 0, pz, roofMat);
      }
    }
    for (const [px, pz, h] of pallets) box(1.2, h, 1, px, 0, pz, crate);
  };
  /** a compound's 2 m inner wall, between its extents: a jump and a mantle for a player, a wall for a bot */
  const yardWall = (x0: number, x1: number, z0: number, z1: number): void => {
    slab(x1 - x0, 2, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, wallMat);
  };

  // THE FARM (north-west). Its fourth building is the farmhouse, in the
  // north-west corner with the compound's walls for its back; its covered
  // yard is the barn, in the south-east; and a wall along the east room's
  // north face, out to either side of the compound, makes a house yard and a
  // barnyard, with its gate at the west end. The east room's two doors, one
  // each side of the wall, are the other way through. Its own things are the
  // barn's round roof and a wind pump in the field outside its west wall.
  {
    const c = COMPOUNDS[0];
    fourth(c, -20.5, -20.6, ["s"], ["e", "n", "w"]);
    const bx = c.x + 16;
    const bz = c.z + 19;
    coveredYard(bx, bz, 16, 12, true, [
      [bx - 4.5, bz - 1, 1.1],
      [bx + 3.5, bz + 1.5, 1.6],
      [bx - 3, bz + 3.2, 1.9],
    ]);
    // The barn's roof is a Dutch barn's, a half-round vault along it, drawn
    // over the flat roof and squashed to 3.5 m high. It is solid as a stack
    // of slabs whose tops sit on the curve or at most 25 cm over it. Drawn
    // and not solid, anyone landing on the barn from the drop would sink into
    // it and see out of it unseen (a mesh is not drawn from inside), and loot
    // that landed on the roof would be inside it.
    const vault = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 16, 16, 1, false, 0, Math.PI), roofMat);
    vault.rotation.z = Math.PI / 2;
    vault.scale.set(3.5 / 6, 1, 1);
    vault.position.set(bx, 5, bz);
    vault.castShadow = true;
    vault.receiveShadow = true;
    root.add(vault);
    for (let k = 1; k <= 14; k++) {
      const top = 0.25 * k;
      // as far out either side as the vault stands at least a step under this one's top
      const half = 6 * Math.sqrt(1 - ((top - 0.25) / 3.5) ** 2);
      solid(bx - 8, bx + 8, bz - half, bz + half, 5, 5 + top);
    }
    // the wall and its gate
    yardWall(c.x - 25.5, c.x - 22, c.z + 2.3, c.z + 2.7);
    yardWall(c.x - 18.5, c.x + 3.5, c.z + 2.3, c.z + 2.7);
    yardWall(c.x + 14.5, c.x + 26, c.z + 2.3, c.z + 2.7);
    // THE WIND PUMP: a fan on a lattice tower, 15 m to the top of its fan,
    // 8 m out from the west wall. The farm's mark from across the west of the
    // map, and something to stand behind in a field with nothing in it. The
    // tower's legs lean in, which boxes cannot follow, so it is all for show
    // but its feet: the bottom 2 m of each leg is a post you walk into.
    const wx = c.x - 34;
    const wz = c.z - 6;
    const leg = (sx: number, sz: number, y: number): THREE.Vector3 => {
      const r = 1.8 - (1.35 * y) / 12;
      return new THREE.Vector3(wx + sx * r, y, wz + sz * r);
    };
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    corners.forEach(([sx, sz], i) => {
      const [nx, nz] = corners[(i + 1) % 4];
      strut(leg(sx, sz, 0), leg(sx, sz, 12), 0.2, roofMat);
      // a girt round the tower at 6 m, and a brace across each face under it
      strut(leg(sx, sz, 6), leg(nx, nz, 6), 0.12, roofMat);
      strut(leg(sx, sz, 0), leg(nx, nz, 6), 0.1, roofMat);
      const mid = (1.8 + 1.575) / 2;
      solid(wx + sx * mid - 0.22, wx + sx * mid + 0.22, wz + sz * mid - 0.22, wz + sz * mid + 0.22, 0, 2);
    });
    // The head: the pump's gearbox, a fan of six blades turned to the middle
    // of the map on a shaft, and the vane behind that keeps it turned there.
    // The shaft holds the fan 1.3 m out, clear of the legs, which splay out
    // under the head and would stand in the lower blade's way.
    slab(0.9, 0.9, 0.9, wx, 12, wz, roofMat, false);
    const face = new THREE.Vector3(1, 0, 1).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(up, face);
    const head = new THREE.Vector3(wx, 12.6, wz);
    const hub = head.clone().addScaledVector(face, 1.3);
    strut(head, hub, 0.14, roofMat);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const out = up.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a));
      const blade = new THREE.Mesh(slabGeo(0.55, 2.1, 0.05), roofMat);
      blade.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(out, face), out, face));
      blade.position.copy(hub).addScaledVector(out, 1.35);
      blade.castShadow = true;
      blade.receiveShadow = true;
      root.add(blade);
    }
    const tail = head.clone().addScaledVector(face, -2.6);
    strut(head, tail, 0.1, roofMat);
    const vane = new THREE.Mesh(slabGeo(0.05, 1.2, 1.8), trim);
    vane.rotation.y = Math.atan2(face.x, face.z);
    vane.position.copy(tail);
    vane.castShadow = true;
    vane.receiveShadow = true;
    root.add(vane);
  }

  // THE STORE (north-east). Its fourth building is the stock room, against
  // the south wall; its covered yard is a loading shed in the north-west
  // corner, on the open side; and a wall along the east room's north face
  // makes a loading yard of the north half and a stock yard of the south,
  // with its gate at the east end. Its own thing is a
  // billboard over the big room's roof.
  {
    const c = COMPOUNDS[1];
    fourth(c, 8, 20.6, ["n", "w"], ["e"]);
    coveredYard(c.x - 18, c.z - 20.4, 16, 10, false, [
      [c.x - 22.5, c.z - 21, 1.6],
      [c.x - 14.5, c.z - 22.5, 1.1],
      [c.x - 17, c.z - 18.5, 1.9],
    ]);
    yardWall(c.x - 26, c.x + 3.5, c.z + 2.3, c.z + 2.7);
    yardWall(c.x + 14.5, c.x + 18, c.z + 2.3, c.z + 2.7);
    yardWall(c.x + 21.5, c.x + 25.5, c.z + 2.3, c.z + 2.7);
    // THE BILLBOARD: a blank board 12 by 4 m on two posts, its top 9 m over
    // the big room's roof, turned to face the hub. A blank board is a shape,
    // and a shape is what reads at 200 m. The posts are solid, since the
    // crates climb to that roof; the board is turned, so it cannot be, and it
    // is 5 m over the roof, out of anyone's reach. The posts run on up inside
    // it to 13.8 m: stopped under it at 11.8, their tops were somewhere loot
    // could land (anything up to 12 m takes it) and be lost inside the board.
    // The lit strip along its foot is the orange the shelf's line is lit in,
    // so it adds no draw.
    const roofY = 6.8;
    const bx = c.x - 8;
    const bz = c.z - 8;
    const turn = -Math.PI / 4;
    const along = new THREE.Vector3(Math.cos(turn), 0, -Math.sin(turn));
    const toward = new THREE.Vector3(Math.sin(turn), 0, Math.cos(turn));
    for (const s of [-1, 1]) slab(0.35, 7, 0.35, bx + along.x * 4 * s, roofY, bz + along.z * 4 * s, roofMat);
    slab(12, 4, 0.5, bx, roofY + 5, bz, trim, false).rotation.y = turn;
    const strip = new THREE.Mesh(slabGeo(11.6, 0.2, 0.1), emissive(PAL.orange, 1.2));
    strip.rotation.y = turn;
    strip.position.set(bx + toward.x * 0.3, roofY + 5.3, bz + toward.z * 0.3);
    root.add(strip);
  }

  // THE PENS (south-west). Its fourth building stands in the south-east
  // corner, on the open side; its covered yard is a shearing shed in the
  // south-west corner; and a wall from the north wall to the south wall,
  // through the east room, makes a back yard and a front yard, with its gate
  // near the north wall. The east room's two doors, one each side of it, are
  // the other way through. Its own thing is the pens.
  {
    const c = COMPOUNDS[2];
    fourth(c, 20.5, 20.6, ["n", "w"], ["e", "n"]);
    coveredYard(c.x - 17.3, c.z + 20.3, 16, 10, true, [
      [c.x - 21.5, c.z + 20, 1.9],
      [c.x - 13, c.z + 22, 1.1],
      [c.x - 15.5, c.z + 18, 1.6],
    ]);
    yardWall(c.x + 1.3, c.x + 1.7, c.z - 25.5, c.z - 21);
    yardWall(c.x + 1.3, c.x + 1.7, c.z - 17.5, c.z + 2.3);
    yardWall(c.x + 1.3, c.x + 3.5, c.z + 2.3, c.z + 2.7);
    yardWall(c.x + 3.3, c.x + 3.7, c.z + 11.5, c.z + 25.5);
    // THE PENS: four stock pens 8 by 10 m outside the west wall, a lane
    // between them and the wall, and the gate through the wall into the lane.
    // Twelve board fences 1.2 m high: a crouch hides behind one, a stand
    // shoots over it and vaults it, and a bot goes round by the gates. The
    // south-west quarter of the map had no cover at all, and this is 40 m of
    // it. Two wings close the lane off from the field at either end, so the
    // pens are the compound's back yard: a bot gets in by the gate in the
    // wall, a player over any fence.
    const px0 = c.x - 37;
    const px1 = c.x - 29;
    const fence = (x0: number, x1: number, z0: number, z1: number): void => {
      box(x1 - x0, 1.2, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, crate);
    };
    fence(px0 - 0.1, px0 + 0.1, c.z - 20, c.z + 20);
    for (const z of [-20, -10, 0, 10, 20]) fence(px0, px1, c.z + z - 0.1, c.z + z + 0.1);
    // each pen's east side, with a gate into the lane at the end nearest the next pen
    for (const [a, b] of [
      [-20, -13],
      [-7, 0],
      [0, 7],
      [13, 20],
    ]) fence(px1 - 0.1, px1 + 0.1, c.z + a, c.z + b);
    for (const z of [-20, 20]) fence(px1, c.x - 26.5, c.z + z - 0.1, c.z + z + 0.1);
  }

  // THE WORKS (south-east). Its fourth building is the works office, against
  // the north wall; its covered yard is a loading shed on the open side, off
  // the big room; and its 2 m wall is a blast wall round the tank yard in the
  // east of it, with one gate. Its own things are four tanks in that yard and
  // a flare stack 16 m high with a flame on it. Everything tall stands east:
  // the rope off its platform crosses the compound to the south-west, low
  // over the south wall, and a rider is knocked off by anything the body
  // meets.
  {
    const c = COMPOUNDS[3];
    fourth(c, 4, -20.6, ["s"], ["e", "n", "w"]);
    coveredYard(c.x - 21.5, c.z - 4, 11, 16, false, [
      [c.x - 23.5, c.z - 8.5, 1.9],
      [c.x - 21, c.z + 0.5, 1.1],
      [c.x - 19.5, c.z - 6.5, 1.6],
    ]);
    yardWall(c.x + 16, c.x + 25.5, c.z - 0.2, c.z + 0.2);
    yardWall(c.x + 16, c.x + 16.4, c.z + 0.2, c.z + 12);
    yardWall(c.x + 16, c.x + 16.4, c.z + 15.5, c.z + 25.5);
    // The tanks are drawn round and made solid as roundSolid's five boxes, as
    // the silos are. Solid to the top of the cone, so a body or an item that
    // lands on one stands on the cone and not inside it; the cone is a
    // storage tank's shallow one, so nothing stands more than a hand over it.
    for (const tz of [3.5, 8.5, 13.5, 18.5]) {
      drum(c.x + 22.6, c.z + tz, 2, 0, 6, concrete, { mat: roofMat, h: 0.3 });
      roundSolid(c.x + 22.6, c.z + tz, 2, 0, 6.3);
    }
    // THE FLARE STACK, in the yard's south-east corner: a thin line 16 m up
    // with a flame on it, a different mark from the ridge's chimney, which is
    // a stepped mass, and the depot's crane, which is a frame.
    const fx = c.x + 22.6;
    const fz = c.z + 23.5;
    slab(2, 1, 2, fx, 0, fz, concrete);
    drum(fx, fz, 0.45, 1, 14.4, roofMat);
    roundSolid(fx, fz, 0.45, 1, 15.4);
    slab(1.3, 0.3, 1.3, fx, 15.4, fz, trim, false);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 8), emissive(0xffc21a, 1.4));
    flame.position.set(fx, 16.5, fz);
    root.add(flame);
  }

  // ------------------------------------------------------------ the roadside
  // Crossing between places was a long run with nothing to break a sightline,
  // so anyone on a roof could watch you the whole way. These are small stops
  // on the roads: a ruin with two walls and a roof, a culvert to run through,
  // a stack of containers. None is a POI (no loot spot of its own) — they are
  // there so the ground between places is not one flat plane of sand. Kind 3
  // is a stop with nothing built here: the ruin at (62, 62) and the culvert
  // at (-62, -62) are gone, and the Motor Pool and the Relay stand there now
  // (see the sites below). They stay in the table because it is the ring's
  // list of roadside cover too (src/config/ring.json's attractors, which
  // tools/checks/ring-place.ts holds to it), and a site is still cover.
  {
    const spots: Array<[number, number, number]> = [
      [0, -86, 0],
      [0, 86, 1],
      [86, 0, 2],
      [-86, 0, 0],
      [62, -62, 1],
      [-62, 62, 2],
      [62, 62, 3],
      [-62, -62, 3],
      [0, -130, 2],
      [0, 130, 0],
      [130, 0, 1],
      [-130, 0, 2],
    ];
    for (const [x, z, kind] of spots) {
      if (kind === 3) continue;
      if (kind === 0) {
        // a ruin: two standing walls and half a roof to shelter under
        box(12, 4, 0.6, x, 0, z - 4, wallMat);
        box(0.6, 4, 9, x - 6, 0, z, wallMat);
        box(9, 0.4, 7, x - 1.5, 4, z - 1, roofMat);
        box(1.6, 1.4, 1.6, x + 4, 0, z + 2, crate);
      } else if (kind === 1) {
        // a culvert: a covered run you can cross the road inside
        box(0.6, 2.6, 14, x - 2.2, 0, z, concrete);
        box(0.6, 2.6, 14, x + 2.2, 0, z, concrete);
        box(5, 0.5, 14, x, 2.6, z, concrete);
        box(1.6, 1.4, 1.6, x, 0, z + 5, crate);
      } else {
        // a container stack with a gap to shoot through
        box(6, 2.6, 2.6, x, 0, z, steelA);
        box(6, 2.6, 2.6, x + 1.5, 0, z + 3.4, steelB);
        box(6, 2.6, 2.6, x, 2.6, z, steelC);
        box(1.6, 1.4, 1.6, x - 4, 0, z + 1, crate);
      }
    }
  }

  // ---------------------------------------------------------------- the sites
  // Eight small places between the big ones (see Site): a name and a sign, a
  // building or two with loot in it, somewhere to hold, and a dirt track to
  // the nearest road, so that from the drop you can see something is there.
  // They are not pois: everything that picks one (the squad's drop, the bots'
  // drops, tools/e2e.ts's count of nine) means a big place, and a site there
  // would be a landing and spread the bots across seventeen. The field's
  // twenty cover spots were not enough to make the ground between the places
  // worth crossing; these are what makes it.
  //
  // Every building in them is one or two storeys, stands on groundTop, and
  // has 2.5 m clear in front of every doorway. None with a stair has a door
  // on its east side: brpoi.ts runs the stair up the east wall, and a door
  // there opens on to the flight.
  const siteSpots: Array<{ id: string; name: string; x: number; z: number }> = [];
  /** ground the field's rocks and cover clusters leave alone: the sites' yards, POI-local */
  const keepClear: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }> = [];
  const clearOf = (x0: number, x1: number, z0: number, z1: number): boolean =>
    keepClear.every((r) => x1 < r.minX || x0 > r.maxX || z1 < r.minZ || z0 > r.maxZ);
  /** a site's name and where it is, and the ground it takes up as [x0, x1, z0, z1] rectangles */
  const site = (id: string, name: string, x: number, z: number, yards: Array<[number, number, number, number]>): void => {
    siteSpots.push({ id, name, x, z });
    for (const [minX, maxX, minZ, maxZ] of yards) keepClear.push({ minX, maxX, minZ, maxZ });
  };
  /** a site's name board, on a wall and facing (fx, fz): the name the arrival card gives it */
  const siteSign = (text: string, x: number, y: number, z: number, fx: number, fz: number): void => {
    root.add(textPanel(text, x, y, z, Math.atan2(fx, fz), 6, 1.4));
  };
  /**
   * A dirt track from (x0, z0) to (x1, z1), laid on the ground as it is.
   * One flat strip would be buried in the first tier it met, so where it
   * climbs a terrace it is a strip on each tier's top, cut wherever groundTop
   * changes along its middle line.
   */
  const track = (x0: number, z0: number, x1: number, z1: number, w = 4, mat: THREE.Material = dirt): void => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.25));
    const at = (t: number): [number, number] => [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t];
    let from = 0;
    let h = groundTop(...at(0.5 / n));
    for (let k = 1; k <= n; k++) {
      const next = k < n ? groundTop(...at((k + 0.5) / n)) : NaN;
      if (next === h) continue;
      strip(...at(from), ...at(k / n), w, mat, h);
      from = k / n;
      h = next;
    }
  };
  /** a truck left to rot: an 8 m trailer along x or z and its cab at the + or - end */
  const hulk = (x: number, z: number, alongX: boolean, cab: 1 | -1, mat: THREE.Material): void => {
    if (alongX) {
      box(8, 2.8, 2.6, x, 0, z, mat);
      box(2.4, 3, 2.6, x + cab * 5.2, 0, z, roofMat);
    } else {
      box(2.6, 2.8, 8, x, 0, z, mat);
      box(2.6, 3, 2.4, x, 0, z + cab * 5.2, roofMat);
    }
  };
  /**
   * Steps up to the end of a trailer lying along x, from the sand to its
   * 2.8 m deck, running away from it (dir -1 west, 1 east). A trailer is a
   * player's climb and never a bot's step, so without these the bots only
   * ever walked the gaps between them. Five 0.47 m steps, each under the
   * bots' 0.56 m.
   */
  const trailerSteps = (endX: number, z: number, dir: 1 | -1): void => {
    for (let k = 1; k <= 5; k++) slab(1, (2.8 * k) / 6, 2.6, endX + dir * (5.5 - k), 0, z, concrete);
  };

  // THE NOTCH: the north defile made a checkpoint. A guard block at each end
  // of the pass, backed on to the defile's walls, and between them a chicane
  // of low walls and a wrecked flatbed under a barrier lifted open. The
  // blocks stand at the pass's ends because the ledges against its walls
  // fill the middle, and off the diagonal: the North Yard's rope ran
  // through the pass corner to corner when they went in.
  //
  // On the east crest, 6 m up, a post with a stair to its roof at 9.4 m: the
  // best-held ground in the north half. The bots reach it up the ridge's
  // stepped east end and along the crest. Its doors face the crest's open
  // ground and the defile, since its stair has the east wall.
  {
    building(poi, { x: -10, z: -105, w: 8, d: 7, storeys: 1, storeyH: 3.4, doors: ["e"], windows: ["n", "s"] });
    building(poi, { x: 10, z: -135, w: 8, d: 7, storeys: 1, storeyH: 3.4, doors: ["w"], windows: ["n", "s"] });
    // the barrier: a post, and its boom lifted to seventy degrees, for show
    box(0.5, 1.2, 0.5, -6, 0, -126, concrete);
    strut(new THREE.Vector3(-6, 1.1, -126), new THREE.Vector3(-6 + 7 * Math.cos(1.22), 1.1 + 7 * Math.sin(1.22), -126), 0.16, trim);
    // Six low walls staggered across the road, each 1.4 m or more from the
    // next thing. The last two stand east of the road's middle: the hub's
    // north pad throws you down between z -102 and -106 (where on the pad you
    // stepped moves it), and a wall across the middle there is what you
    // landed on.
    for (const [x, z] of [
      [-1.5, -122],
      [1.5, -118],
      [1.5, -114],
      [-0.5, -109],
      [5.5, -105.5],
      [5.5, -102],
    ]) slab(5, 1.2, 0.6, x, 0, z, concrete);
    box(7, 2.4, 2.6, -6, 0, -113, steelB);
    const y = groundTop(24, -120);
    deckAt.notch = building(poi, { x: 24, z: -120, y, w: 10, d: 8, storeys: 1, storeyH: 3.4, doors: ["s", "w"], windows: ["n", "e"], roofAccess: true }).roof;
    // its name over the defile, on the parapet's face
    siteSign("THE NOTCH", 18.74, y + 3.4 + 0.45, -120, -1, 0);
    site("notch", "THE NOTCH", 0, -120, [
      [-15, -5, -110, -100],
      [5, 15, -140, -130],
      [18, 30, -125, -115],
    ]);
  }

  // THE TABLE STATION: a relay station on the east mesa's crest, 8 m up, the
  // highest small place on the map: from there you overlook the east road,
  // both east compounds and the ridge. Its ground floor at 8 m and its first
  // floor at 11.4 are both under the 12 m that loot lands on, so it is
  // looted top to bottom; its roof at 14.8 holds nothing, which is right for
  // a deck to ride out from. The bots come up the mesa's stepped north,
  // south and west faces; the east face is the 8 m cliff, so it is taken
  // from the map and held against the ridge. A chain-link fence closes the
  // crest's north and west, with a gate in the west run.
  {
    const here = ctxOf(TINT.east);
    const x = 112;
    const z = -36;
    const y = groundTop(x, z);
    const st = building(here, { x, z, y, w: 13, d: 13, storeys: 2, storeyH: 3.4, doors: ["w", "s"], windows: ["n", "e"], stairs: true, roofAccess: true });
    deckAt.table = st.roof;
    // The dish mast, 10 m over the roof in its north-west corner, clear of
    // the stair's hole down the east side. Solid: its top is out of reach,
    // and a mast you could walk through would hide whoever stood in it.
    box(0.5, 10, 0.5, x - 4.5, st.roof, z - 4.5, mast);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 0.35, 0.6, 16), roofMat);
    dish.position.set(x - 4.5, st.roof + 8.6, z - 4.5);
    // turned to the hub and tipped up to the sky
    dish.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-x, 40, -z).normalize());
    dish.castShadow = true;
    dish.receiveShadow = true;
    root.add(dish);
    for (const fx of [99, 109, 119]) slab(10, 2, 0.3, fx, y, -47.5, roofMat);
    slab(0.3, 2, 10, 94, y, -42.35, roofMat);
    slab(0.3, 2, 5.35, 94, y, -31.675, roofMat);
    // the gate's leaf, swung open outward
    slab(3, 2, 0.3, 92.35, y, -37.2, roofMat);
    siteSign("TABLE STATION", x - 6.76, y + 3.4 + 1.7, z, -1, 0);
    site("table", "TABLE STATION", x, z, [[88, 124, -50, -26]]);
  }

  // THE CROSSING, where the south road fords the wash. The road's pass is
  // flat sand 28 m wide, so the old bridge beside it stands on abutments of
  // its own: a stepped ramp up to 3.5 m at each end, and a deck on piers at
  // 4 m, half a metre over them, a step a bot takes. A 3.4 m span of the
  // deck is broken out and lies in the bed below as three steps: a player
  // clears the gap at a sprint and a bot never will, so the bridge is a high
  // road the bots can stand on either end of, over a low road through the
  // channel under it. Two ropes come down on the deck, from the Mast and
  // from South Depot's tower; its rails stop short of the broken span.
  //
  // Across the road a pump house stands in the mouth of the east channel,
  // its first floor and roof looking along the wash both ways, on the
  // pass's sand where the field had a rock and a crate.
  {
    const here = ctxOf(TINT.south);
    terrace(-15, -9, 97, 108, 3.5, { sheer: ["s", "e", "w"], mat: concrete });
    terrace(-15, -9, 124, 135, 3.5, { sheer: ["n", "e", "w"], mat: concrete });
    const deck = 3.6;
    deckAt.crossing = deck + 0.4;
    slab(6, 0.4, 10, -12, deck, 113, concrete);
    slab(6, 0.4, 2.6, -12, deck, 122.7, concrete);
    // piers flush with the abutments, so there is no slot behind them
    for (const px of [-14, -10]) {
      slab(2, deck, 2.5, px, 0, 109.25, concrete);
      slab(2, deck, 2.5, px, 0, 122.75, concrete);
    }
    for (const px of [-14.9, -9.1]) slab(0.2, 1, 8, px, deck + 0.4, 112, TINT.south.trim);
    // the fallen span, 2.1 m under the deck at its highest
    for (let k = 0; k < 3; k++) slab(5, 0.5 * (k + 1), 1.4, -12, 0, 118.4 + 1.4 * k, concrete);
    building(here, { x: 10, z: 116, w: 8, d: 10, storeys: 2, storeyH: 3.4, doors: ["w"], windows: ["n", "e", "w"], stairs: true, roofAccess: true });
    siteSign("THE CROSSING", 10, 5.1, 121.26, 0, 1);
    site("crossing", "THE CROSSING", 0, 116, [
      [-16, -8, 96, 136],
      [5, 15, 110, 122],
    ]);
  }

  // THE WELL, in the west saddle between the knuckles: a walled yard south
  // of the road, open on the east, with a farmhouse, a byre and the well in
  // it, and across the road a fuel canopy, a flat plate on thin legs, which
  // nothing else on the map is the shape of. Two ropes come down on the
  // farmhouse's roof, from the Mast and from West Town's tower, and the
  // water tower's passes south of it overhead. Flat ground throughout,
  // so the bots walk all of it.
  {
    const here = ctxOf(TINT.west);
    const wall = TINT.west.wall;
    // the road side's wall, with a 3 m gate, and the back and west walls
    slab(17, 2.6, 0.8, -112.5, 0, 6, wall);
    slab(8, 2.6, 0.8, -97, 0, 6, wall);
    slab(28, 2.6, 0.8, -107, 0, 32, wall);
    slab(0.8, 2.6, 26.8, -121, 0, 19, wall);
    deckAt.well = building(here, { x: -114.6, z: 14, w: 12, d: 10, storeys: 2, storeyH: 3.4, doors: ["s"], windows: ["n", "e", "w"], roofAccess: true }).roof;
    building(here, { x: -100, z: 24, w: 9, d: 7, storeys: 1, storeyH: 3.2, doors: ["n"], windows: ["s"] });
    // the well head and its gibbet, whose arm is for show
    box(2.6, 1.2, 2.6, -106, 0, 13, concrete);
    box(0.3, 2.4, 0.3, -106, 1.2, 11.95, crate);
    box(1.3, 0.2, 0.2, -105.5, 3.4, 11.95, crate, false);
    // a hay stack and two runs of cover, all 2.5 m or more from a door
    box(1.6, 1.4, 1.6, -112, 0, 28, crate);
    box(1.6, 1.4, 1.6, -110.3, 0, 28, crate);
    box(1.6, 1.4, 1.6, -111.15, 1.4, 28, crate);
    coverWall(here, -97, 13, 4, 0.8);
    coverWall(here, -108, 25, 0.8, 4);
    // The fuel canopy, on six posts, and its two pumps, 4.5 m off the road;
    // crates up its west side put a player on top.
    for (const px of [-113.25, -106.5, -99.75]) for (const pz of [-16.75, -8.25]) box(0.5, 4.5, 0.5, px, 0, pz, post);
    slab(14, 0.5, 9, -106.5, 4.5, -12.5, roofMat);
    for (const px of [-109.5, -103.5]) slab(0.8, 1.6, 1.2, px, 0, -12.5, TINT.west.trim);
    crateStair(here, -115, -16.5, 4.5, 1);
    siteSign("THE WELL", -112.5, 1.5, 5.54, 0, -1);
    site("well", "THE WELL", -107, 8, [[-122, -92, -22, 33]]);
  }

  // HIGHPOINT: the only high ground in the outer north-east, a mesa of ten
  // half-metre tiers north-east of the loop road's corner, and a two-storey
  // block on top whose floors at 8.4 m and roof at 11.8 all take loot. The
  // mesa stands off the corner, so the corner's node and the road stay on
  // the sand and the loop is not a climb; a track runs from the corner up
  // the mesa's south face to the block's door. Its top is 19.5 m square on
  // 1.25 m treads, which is what fits a 14 m block in 42 m of ground.
  {
    terrace(154, 196, -196, -154, 5, { tread: 1.25 });
    const x = 175;
    const z = -175;
    const y = groundTop(x, z);
    const hp = building(poi, { x, z, y, w: 14, d: 12, storeys: 2, storeyH: 3.4, doors: ["w", "s"], windows: ["n", "e"], stairs: true, roofAccess: true });
    deckAt.highpoint = hp.roof;
    // A crane's hook with a lamp on it, off a post in the roof's north-west
    // corner. The post is solid; the jib, the cable and the lamp are for show.
    const top = hp.roof + 4;
    slab(0.4, 4, 0.4, x - 5.5, hp.roof, z - 4.5, roofMat);
    strut(new THREE.Vector3(x - 5.5, top, z - 4.5), new THREE.Vector3(x - 9, top, z - 4.5), 0.25, trim);
    strut(new THREE.Vector3(x - 9, top, z - 4.5), new THREE.Vector3(x - 9, top - 2.2, z - 4.5), 0.05, roofMat);
    const lamp = new THREE.Mesh(gateLampGeo, gateLamp);
    lamp.position.set(x - 9, top - 2.8, z - 4.5);
    root.add(lamp);
    siteSign("HIGHPOINT", x, y + 3.4 + 1.7, z + 6.26, 0, 1);
    site("highpoint", "HIGHPOINT", 170, -170, [[152, 198, -198, -152]]);
  }

  // THE SUMP: the south-west corner's mesa, the mirror of Highpoint's, and a
  // tank farm on it. Four tanks 7 m across and 8 m tall stand in a square
  // with 2 m alleys between them, and a cross of catwalks runs down the
  // alleys at 8 m, reached by six half-metre steps from the mesa's top. The
  // tanks are solid as roundSolid's boxes to their tops at 13 m, over the
  // 12 m that loot lands on, so nothing is dropped where nobody can reach it.
  // A one-storey pump house at the front has a stair on to its roof.
  {
    terrace(-198, -152, 152, 198, 5);
    const cx = -175;
    const cz = 175;
    const y = groundTop(cx, cz);
    for (const [u, v] of [
      [-10, 1],
      [-1, 1],
      [-10, 10],
      [-1, 10],
    ]) {
      drum(cx + u, cz + v, 3.5, y, 7.6, concrete, { mat: roofMat, h: 0.4 });
      roundSolid(cx + u, cz + v, 3.5, y, y + 8);
    }
    // the catwalks, their tops 3 m over the mesa, down the two alleys
    const walk = y + 3;
    slab(17.5, 0.4, 2, cx - 4.75, walk - 0.4, cz + 5.5, roofMat);
    slab(2, 0.4, 16, cx - 5.5, walk - 0.4, cz + 5.5, roofMat);
    // rails where a catwalk runs out past the tanks, clear of where the two cross
    for (const s of [-1, 1]) {
      slab(8.5, 0.9, 0.08, cx - 0.25, walk, cz + 5.5 + s * 0.96, roofMat);
      slab(0.08, 0.9, 7, cx - 5.5 + s * 0.96, walk, cz + 10, roofMat);
    }
    // the steps up, east from the catwalk's end
    for (let k = 0; k < 6; k++) slab(1, 3 - 0.5 * k, 2, cx + 4.5 + k, y, cz + 5.5, concrete);
    deckAt.sump = building(poi, { x: cx + 8.5, z: cz - 8.5, y, w: 10, d: 9, storeys: 1, storeyH: 3.4, doors: ["n", "w"], windows: ["s", "e"], roofAccess: true }).roof;
    siteSign("THE SUMP", cx + 8.5, y + 3.4 + 0.45, cz - 13.26, 0, -1);
    site("sump", "THE SUMP", -172, 172, [[-199, -151, 151, 199]]);
  }

  // THE MOTOR POOL, where the roadside ruin was: an open workshop with a
  // roller door on the west, six trucks left to rot round it (one inside,
  // one jack-knifed across the track in), and a fuel canopy by the north
  // wall. Two trailers have steps up to them, so the bots stand on trucks
  // and not only in the gaps between them, and one of those is against the
  // workshop's south wall: from its deck the roof is a jump and a mantle.
  // It is 14 m clear of the bowl's berms and 8 m clear of the works.
  {
    slab(16, 4.6, 0.4, 62, 0, 56.2, wallMat);
    slab(16, 4.6, 0.4, 62, 0, 67.8, wallMat);
    slab(0.4, 4.6, 12, 69.8, 0, 62, wallMat);
    for (const z of [58, 66]) slab(0.4, 4.6, 4, 54.2, 0, z, wallMat);
    slab(16, 0.5, 12, 62, 4.6, 62, roofMat);
    hulk(64, 64.5, true, -1, steelA);
    // jack-knifed: the trailer across the track, the cab folded against its end
    box(2.6, 2.8, 8, 36, 0, 63, steelB);
    box(2.4, 3, 2.6, 38.5, 0, 67.2, roofMat);
    hulk(50, 52, true, 1, steelC);
    trailerSteps(46, 52, -1);
    hulk(74, 64, false, 1, steelA);
    hulk(62, 69.3, true, 1, steelB);
    trailerSteps(58, 69.3, -1);
    hulk(48, 72, false, 1, steelC);
    for (const px of [65.75, 70, 74.25]) for (const pz of [47.25, 52.75]) box(0.5, 4.5, 0.5, px, 0, pz, post);
    slab(9, 0.5, 6, 70, 4.5, 50, roofMat);
    box(2.4, 1.2, 0.8, 70, 0, 50, trim);
    // crates up the canopy's east side, a player's way on to its deck
    crateStair(poi, 75.4, 47.5, 4.5, 1);
    siteSign("MOTOR POOL", 62, 3.2, 55.94, 0, -1);
    site("motorpool", "MOTOR POOL", 60, 60, [[30, 78, 44, 79]]);
  }

  // THE RELAY, where the roadside culvert was: a pad of six half-metre tiers
  // with three open-ended containers on it in a horseshoe open to the east,
  // and a lattice mast in the middle, 20 m to a red lamp that marks the
  // north-west of the bowl from anywhere round it. The mast is solid, since
  // anyone can stand beside it; its stays are for show.
  {
    terrace(-76, -48, -76, -48, 3, { tread: 1.5 });
    const y = groundTop(-62, -62);
    /** a container with its ends open, 2.4 m clear inside, so loot lands in it and a body stands up in it */
    const shell = (x: number, z: number, alongX: boolean, mat: THREE.Material): void => {
      if (alongX) {
        box(6, 0.2, 2.6, x, y + 2.4, z, mat);
        for (const s of [-1, 1]) box(6, 2.4, 0.15, x, y, z + s * 1.225, mat);
      } else {
        box(2.6, 0.2, 6, x, y + 2.4, z, mat);
        for (const s of [-1, 1]) box(0.15, 2.4, 6, x + s * 1.225, y, z, mat);
      }
    };
    shell(-66.5, -62, false, steelA);
    deckAt.relay = y + 2.6;
    shell(-61, -66.3, true, steelB);
    shell(-61, -57.7, true, steelC);
    box(1, 20, 1, -60, y, -62, mast);
    for (const [fx, fz] of [
      [-63.5, -64.3],
      [-63.5, -59.7],
      [-56.5, -64.3],
      [-56.5, -59.7],
    ]) strut(new THREE.Vector3(-60, y + 14, -62), new THREE.Vector3(fx, y, fz), 0.1, roofMat);
    const lamp = new THREE.Mesh(gateLampGeo, gateLamp);
    lamp.position.set(-60, y + 20.6, -62);
    root.add(lamp);
    siteSign("THE RELAY", -67.86, y + 1.3, -62, -1, 0);
    site("relay", "THE RELAY", -62, -62, [[-78, -46, -78, -46]]);
  }

  // THE GROUND PLAN. For the seconds of the drop you look straight down, so
  // this is the picture of Outskirts that everybody sees, and it was a tan
  // square with a cross and a diamond on it. Now each place stands on a
  // gravel apron, each site is joined to a road by a dirt track, the wash
  // has a bed with dark braids down it, and there are oil stains where the
  // fuel was. All of it is flat strips in four materials, a merged draw
  // apiece; the polygon offsets where the materials are made keep it off the
  // sand and in order.
  {
    for (const [x, z, s] of [
      [0, 0, 70],
      [0, -165, 70],
      [0, 165, 70],
      [165, 0, 70],
      [-165, 0, 70],
      ...COMPOUNDS.map((c) => [c.x, c.z, 56]),
    ]) strip(x, z - s / 2, x, z + s / 2, s, gravel);
    // Each track joins its site to a road, so none runs to nowhere. The
    // Motor Pool and the Relay are nearer a spoke than the loop road, and
    // the Relay's passes the north berm's end with half a metre to spare.
    track(24, -115.6, 24, -100);
    track(24, -100, 4, -94);
    track(112, -29.2, 112, -4);
    track(-1, 90, -12, 97.2);
    track(-12, 97.2, -12, 107.9);
    track(-12, 124.1, -12, 134.8);
    track(-12, 134.8, -1, 142);
    track(-102.5, 7, -104, -8);
    track(150, -151, 173, -151);
    track(175, -149, 175, -168.6);
    track(-150, 149, -164.5, 149);
    track(-166.5, 147, -166.5, 161.6);
    track(53.8, 62, 4, 62);
    track(-55.3, -63, -48, -63);
    track(-47.9, -63, -4, -86);
    // the wash's bed, wandering a little from bank to bank, and a braid of
    // darker, wetter gravel down each side of the road
    for (const s of [-1, 1]) {
      strip(s * 72, 116.4, s * 53, 115.6, 7, gravel);
      strip(s * 53, 115.6, s * 34, 116.4, 7.6, gravel);
      strip(s * 34, 116.4, s * 14, 116, 7, gravel);
    }
    for (const [x0, z0, x1, z1] of [
      [-72, 114.2, -43, 117.6],
      [-43, 117.6, -14, 114.8],
      [14, 117.4, 43, 114.4],
      [43, 114.4, 72, 117.6],
    ]) strip(x0, z0, x1, z1, 1.1, stain);
    // stains: under both fuel canopies, between the Sump's tanks, on the
    // depot's dock and on the workshop's floor
    const blot = new THREE.CircleGeometry(1, 14);
    for (const [x, z, r, sx] of [
      [-106.5, -12.5, 2.6, 1.5],
      [70, 50, 2.2, 1.4],
      [-180.5, 174.5, 1.1, 1],
      [-170.5, 175.5, 1.8, 1.3],
      [-21.5, 168, 2, 1.3],
      [62, 60, 2.2, 1.6],
    ]) {
      const m = new THREE.Mesh(blot, stain);
      m.rotation.x = -Math.PI / 2;
      m.scale.set(r * sx, r, 1);
      m.position.set(x, groundTop(x, z) + 0.01, z);
      m.receiveShadow = true;
      root.add(m);
    }
  }

  // ---------------------------------------------------------------- the field
  // cover clusters along the spokes, and rocks in the open
  const rnd = lcg(7);
  for (const [dx, dz] of [
    [0, -1],
    [0, 1],
    [1, 0],
    [-1, 0],
  ]) {
    for (const d of [55, 85, 115]) {
      const side = rnd() < 0.5 ? -7 : 7;
      const x = dx * d + (dz ? side : 0);
      const z = dz * d + (dx ? side : 0);
      // two stood where a site is now, one in the Crossing's pump house and one in the Well's yard
      if (!clearOf(x - 1.6, x + 3.4, z - 1.2, z + 2)) continue;
      box(3.2, 1.7, 2.4, x, 0, z, rock);
      box(1.6, 1.4, 1.6, x + 2.6, 0, z + 1.2, crate);
    }
  }
  for (let i = 0; i < 40; i++) {
    const x = (rnd() * 2 - 1) * 200;
    const z = (rnd() * 2 - 1) * 200;
    // clear of the POIs and the spokes
    const nearPoi = [
      [0, 0, 45],
      [0, -165, 34],
      [0, 165, 34],
      [165, 0, 34],
      [-165, 0, 34],
    ].some(([px, pz, r]) => Math.hypot(x - px, z - pz) < r);
    const onRoad = (Math.abs(x) < 7 && Math.abs(z) < 170) || (Math.abs(z) < 7 && Math.abs(x) < 170);
    if (nearPoi || onRoad) continue;
    const w = 2 + rnd() * 3;
    const h = 1.2 + rnd() * 1.6;
    const d = 1.5 + rnd() * 2;
    // A metre clear of all the raised ground, and of the wash's bed with its
    // culverts; inside 196 m, so none sits on the edge's shelf or hides the
    // lit line at its foot. Tested after the sizes are drawn, so every rock
    // it lets through lands where it did before the ground had a shape. Set
    // on groundTop, so a change to the test can never leave one half-buried.
    const clear = LANDFORMS.every((l) => x + w / 2 + 1 < l.minX || x - w / 2 - 1 > l.maxX || z + d / 2 + 1 < l.minZ || z - d / 2 - 1 > l.maxZ);
    const inBed = Math.abs(x) < 73 && Math.abs(z - 116) < 5;
    if (Math.abs(x) > 196 || Math.abs(z) > 196 || !clear || inBed || !clearOf(x - w / 2 - 1, x + w / 2 + 1, z - d / 2 - 1, z + d / 2 + 1)) continue;
    box(w, h, d, x, groundTop(x, z), z, rock);
  }

  // ---------------------------------------------------------------- the rotation network
  // The ropes. There were nine, and every one ran from a place out to bare
  // sand: they were ways out and never ways anywhere, and nothing but a run
  // across the open went from one place to the next. Each now ties a place
  // to another place, and every end is somewhere to stand: a jump tower's
  // pad, a roof, a deck. A rope is ridden the way you look, so each is a way
  // there and a way back.
  //
  // A rope's end is 2.2 m over the floor it comes down on, where the hands
  // (2.13 m over the feet, reaching 2.41 m) take it from a stand; over a roof
  // with a parapet it is 3.3 m, so a rider's feet clear the 0.9 m parapet on
  // the way off and on, and 3.5 or 4 m where the rope climbs to the roof and
  // meets the parapet lower down its length. A rider is knocked off by
  // anything the body touches, so every line here was ridden both ways
  // against the map's boxes before it went in.
  //
  // Four more run out from the Mast's roof, one over each side, to a place in
  // the band round the bowl. With them the Mast is a way into the middle of
  // the map from the Notch, the Table, the Crossing and the Well, not only a
  // tower to be shot off: from the roof you are 13 to 24 m over any of them,
  // and from any of them the roof is one ride.
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const mastRope = (x: number, z: number) => ({ anchor: V(x, deckAt.mast + 3.3, z), floor: deckAt.mast });
  const ropes: Array<[{ anchor: THREE.Vector3; floor: number }, THREE.Vector3, number]> = [
    // North Yard's pad to the Notch's blockhouse roof, over the defile
    [towerAt.north, V(24, deckAt.notch + 3.3, -120), deckAt.notch],
    // South Depot's pad to the Crossing's deck, over the wash's south bank
    [towerAt.south, V(-12, deckAt.crossing + 2.2, 114.5), deckAt.crossing],
    // West Town's pad to the Well's farmhouse roof, down the saddle
    [towerAt.west, V(-117, deckAt.well + 3.3, 14), deckAt.well],
    // the farm's platform to the Relay's west container
    [towerAt.nw, V(-66.5, deckAt.relay + 2.2, -61.5), deckAt.relay],
    // the store's platform up to Highpoint's roof
    [towerAt.ne, V(175, deckAt.highpoint + 3.5, -175), deckAt.highpoint],
    // the pens' platform up to the Sump's pump house roof
    [towerAt.sw, V(-166.5, deckAt.sump + 3.3, 166.5), deckAt.sump],
    // The works' platform to the depot office's roof. It was meant for the
    // Motor Pool, but every line from this platform toward it crosses the
    // works office's roof with a rider's feet a metre under it; south-west is the
    // one way out of the works that nothing stands in.
    [towerAt.se, V(25, deckAt.office + 3.3, 178), deckAt.office],
    // the ridge's bunker terrace up to the Table Station's roof, over the cliff
    [towerAt.ridge, V(114, deckAt.table + 4, -38), deckAt.table],
    // the Mast's four
    [mastRope(0, -5.5), V(21.5, deckAt.notch + 3.3, -119), deckAt.notch],
    [mastRope(6.5, -2.5), V(109.5, deckAt.table + 3.3, -35), deckAt.table],
    [mastRope(0, 5.5), V(-12, deckAt.crossing + 2.2, 111), deckAt.crossing],
    [mastRope(-6.5, 0), V(-114, deckAt.well + 3.3, 15.5), deckAt.well],
  ];
  for (const [from, to, floor] of ropes) zipline(root, from.anchor, to, from.floor, floor);

  // A balloon at each outer place: a mast and a balloon; ride it up and drop
  // again. The Mast carries one over the hub, flown from the top of its
  // lattice, and Highpoint and the Sump one each beside them, so the outer
  // corners have a way back into the fight too: the third number is the
  // height a tower's mast stands on. (The jump towers' pads are not in this
  // list: riding a tower here is a balloon ride, and they have no balloon.)
  // A respawn beacon at each outer place and at the Crossing and the Table
  // Station, so the south and east halves of the map are not a long walk from
  // one: a squat box with an antenna and a green light. A launch pad on each
  // road out of the hub, thrown outward, and one on each road back in,
  // thrown toward it, where the road runs on flat sand: a pad only throws
  // someone standing on the sand.
  const towerSpots: Array<[number, number, number]> = [
    [28, -150, 0],
    [-30, 150, 0],
    [140, 34, 0],
    [-192, 30, 0],
    [0, 0, mastTop],
    [130, -170, 0],
    [-130, 170, 0],
  ];
  const beaconSpots: Array<[number, number]> = [
    [-24, -150],
    // clear of the depot office's south-east corner, which it stood inside
    [33.3, 183.3],
    [188, -34],
    [-140, -26],
    [18, 116],
    [99, -40],
  ];
  // A throw carries about 34 m, so an outward pad lands you near 104 m. Each
  // inward pad stands at 99 (the west one at 101, so its throw is high
  // enough by the roadside stop's 4 m wall at -92), 3 m across the road: BEHIND where the outward
  // throw comes down, so the slide after landing carries you away from it,
  // and its own throw lands you past the outward pad at 70 the same way. At
  // 104 it stood where you land, and a step onto the outward pad 1.3 m off
  // its middle came down within reach of it and was thrown straight back.
  const padSpots: Array<[number, number, number, number]> = [
    [0, -70, 0, -1],
    [0, 70, 0, 1],
    [70, 0, 1, 0],
    [-70, 0, -1, 0],
    [3, -99, 0, 1],
    [-3, 99, 0, -1],
    [99, 3, -1, 0],
    [-101, -3, 1, 0],
  ];
  const balloonMat = new THREE.MeshStandardMaterial({ color: 0xd8452f, roughness: 0.6, emissive: 0x401208, emissiveIntensity: 0.4 });
  for (const [x, z, foot] of towerSpots) {
    box(0.4, 44 - foot, 0.4, x, foot, z, mast, false);
    if (foot === 0) box(2.4, 0.3, 2.4, x, 0, z, trim, false);
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(3, 20, 14), balloonMat);
    balloon.position.set(x, 47, z);
    root.add(balloon);
  }
  const beaconGlow = emissive(0x7ddc8a, 2.2);
  for (const [x, z] of beaconSpots) {
    // the Table Station's stands on the mesa, 8 m up
    const y = groundTop(x, z);
    box(1.6, 1.2, 1.6, x, y, z, concrete);
    box(0.12, 2.6, 0.12, x, y + 1.2, z, mast, false);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), beaconGlow);
    lamp.position.set(x, y + 3.9, z);
    root.add(lamp);
  }
  const padMat = emissive(0xffc21a, 1.4);
  for (const [x, z, dx, dz] of padSpots) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.12, 24), flat(PAL.steelDark, 0.5, 0.3));
    disc.position.set(x, 0.06, z);
    root.add(disc);
    // a chevron pointing the way it throws you
    const chev = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.2, 3), padMat);
    chev.rotation.x = -Math.PI / 2;
    chev.rotation.z = -Math.atan2(dx, -dz);
    chev.position.set(x, 0.14, z);
    chev.scale.set(1, 1, 0.12);
    root.add(chev);
  }

  // the ring wall: a unit cylinder, scaled to the live ring; it never merges
  const ringWall = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 120, 96, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide })
  );
  ringWall.position.y = 60;
  ringWall.userData.dynamic = true;
  ringWall.frustumCulled = false;
  root.add(ringWall);
  void trim;

  root.updateMatrixWorld(true);

  const P = (x: number, z: number) => ({ x: x + BR_X, z: z + BR_Z });
  const pois: Poi[] = [
    { id: "hub", name: "THE HUB", ...P(0, 0), drops: [P(-14, -28), P(14, 28), P(26, -8)] },
    { id: "north", name: "NORTH YARD", ...P(0, -150), radius: Math.max(cfg.placeRadius, northReach), drops: [P(0, -150), P(-14, -178), P(6, -180)] },
    { id: "south", name: "SOUTH DEPOT", ...P(0, 165), radius: Math.max(cfg.placeRadius, southReach), drops: [P(0, 148), P(-24, 178), P(24, 150)] },
    { id: "east", name: "EAST RIDGE", ...P(165, 0), drops: [P(140, -18), P(188, 20), P(150, 26)] },
    { id: "west", name: "WEST TOWN", ...P(-165, 0), radius: westReach, drops: [P(-143, 12), P(-186, -14), P(-160, 30)] },
    // the four compounds: smaller places to drop, and the reason the corners are worth crossing
    { id: "nw", name: "NORTHWEST FARM", ...P(-104, -104), drops: [P(-112, -112), P(-92, -96), P(-114, -92)] },
    // its third drop was (114, -88), a body's width inside where the stock room's north wall now stands
    { id: "ne", name: "NORTHEAST STORE", ...P(104, -104), drops: [P(112, -112), P(92, -96), P(114, -90.5)] },
    { id: "sw", name: "SOUTHWEST PENS", ...P(-104, 104), drops: [P(-112, 112), P(-92, 96), P(-114, 92)] },
    { id: "se", name: "SOUTHEAST WORKS", ...P(104, 104), drops: [P(112, 112), P(92, 96), P(114, 92)] },
  ];
  // The small places between the big ones (see Site), as the sites block
  // above recorded them.
  const sites: Site[] = siteSpots.map((s) => ({ id: s.id, name: s.name, ...P(s.x, s.z) }));
  const placeAt = (x: number, z: number): Poi | Site | null => {
    let best: Poi | Site | null = null;
    let bestD = Infinity;
    for (const p of pois) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d <= (p.radius ?? cfg.placeRadius) && d < bestD) {
        best = p;
        bestD = d;
      }
    }
    for (const s of sites) {
      const d = Math.hypot(x - s.x, z - s.z);
      if (d <= cfg.siteRadius && d < bestD) {
        best = s;
        bestD = d;
      }
    }
    return best;
  };
  // the graph: POI centres and gates, road bends, field corners
  const N = (x: number, z: number, poi?: string): GraphNode => ({ ...P(x, z), poi, links: [] });
  const nodes: GraphNode[] = [
    // The hub's node was (0, 0), inside the old tower's solid 8 x 8 m base. A
    // bot that picked it could never arrive (it stops 4.4 m out and the
    // arrival test is 3 m), so it ground against the tower until the ring
    // moved it on. It sits in the courtyard, clear of the Mast's corner
    // column and of the four buildings' corners. The Mast's open hall made
    // (0, 0) floor again, but the node stays where tools/e2e.ts has always
    // found it: that test walks the graph and fails on a node a bot cannot
    // reach, so a move like the old one cannot quietly come back.
    N(10, 10, "hub"), // 0 hub courtyard
    N(0, -36, "hub"), // 1 north gate
    N(0, 36, "hub"), // 2 south gate
    N(36, 0, "hub"), // 3 east gate
    N(-36, 0, "hub"), // 4 west gate
    N(0, -100), // 5 north road
    N(0, 100), // 6 south road
    N(100, 0), // 7 east road
    N(-100, 0), // 8 west road
    N(0, -160, "north"), // 9
    N(0, 160, "south"), // 10
    // Was (150, -20), inside the ridge's first 2 m step: both ground edges
    // into it dead-ended at a face a 0.56 m step cannot climb.
    N(140, -12, "east"), // 11 the flat west of the ridge's steps
    N(-165, 4, "west"), // 12
    N(150, -150), // 13 corners
    N(150, 150), // 14
    N(-150, 150), // 15
    N(-150, -150), // 16
    N(161, -40, "east"), // 17 the ramp foot
    N(166, 2, "east"), // 18 the ridge top, west of the bunker's door
  ];
  const link = (a: number, b: number) => {
    nodes[a].links.push(b);
    nodes[b].links.push(a);
  };
  // THE GRAPH OVER THE MAP AS IT IS. The nineteen nodes above were laid on
  // flat sand with a hub, four roads and a loop, and the map has since grown
  // berms, a ridge, a mesa, a wash, the sites, a chicane in the Notch and a
  // shelf round the edge. What follows is appended to them and never
  // renumbers them: tools/e2e.ts floods from node 5 and names nodes by index.
  //
  // A bot walks straight at its next node and, meeting a wall, slides along
  // it at right angles to the way it wants to go (src/game/bots.ts). A wall
  // square across the line and wider than a few metres is therefore a trap:
  // the slide leans back into the wall as the bot gets off the line, and it
  // rocks there until the ring moves it. Eleven of the old twenty-two links
  // ran into one (the ruins on the north and west roads, the chicane, the
  // depot's sheds, West Town's street, the ridge's undercroft wall), so those
  // eleven now go by way of a node or two set where the walk is clear, and
  // every link below was walked both ways by a copy of the bots' own walk,
  // six times each with its random slides, before it went in.
  //
  // A node's `y` is the floor it stands on. It is left out where there is a
  // floor over the node that the bots can also reach (the Mast's hall, a
  // building's ground floor): tools/e2e.ts's flood keeps only the highest
  // floor it finds in each half-metre cell, so it could never confirm a
  // lower one there. No node stands straight over another: a bot walks
  // straight, so it could never climb a switchback stair from the one to
  // the other, and the Mast's floors and the hub's roofs have no node.
  /** a node appended to the graph, POI-local, and its index */
  const add = (x: number, z: number, y: number | null, poi?: string): number => {
    const n: GraphNode = { ...P(x, z), poi, links: [] };
    if (y !== null) n.y = y;
    return nodes.push(n) - 1;
  };

  // the hub: the Mast's open hall, where the four gate lanes cross
  const mastHall = add(0, 0, null, "hub");
  // The bowl's crests, one on each run of each berm, on the hub side of its
  // wall: from there the wall is cover and the bowl is the field of fire.
  // They make a ring round the hub, across each road's pass and round each
  // open corner, and each is a walk up the stepped face from a gate.
  const crestNE = add(26, -52.2, 4, "hub");
  const crestNW = add(-26, -52.2, 4, "hub");
  const crestEN = add(50, -26, 3, "hub");
  const crestES = add(50, 26, 3, "hub");
  const crestSE = add(26, 49.3, 2.5, "hub");
  const crestSW = add(-26, 49.3, 2.5, "hub");
  const crestWS = add(-54.3, 26, 5, "hub");
  const crestWN = add(-54.3, -26, 5, "hub");
  // The north road. Its node (5) is boxed in by the ruin south of it and the
  // chicane north of it, so two nodes either side of it on the road are the
  // ways past both. The pass through the defile runs up the east lane
  // between the chicane and the ledges, round the rock at (7, -115), and
  // the west lane is the way on to North Yard.
  const roadNE = add(11, -97, 0);
  const roadNW = add(-11, -97, 0);
  const notchPass = add(6.5, -121, 0);
  const notchRock = add(11, -117, 0);
  const notchLane = add(-8, -116, 0);
  // the Notch's crests, 6 m up: the west one open, the east one south of the blockhouse
  const notchWest = add(-40, -120, 6);
  const notchEast = add(24, -112.5, 6);
  // North Yard: the lane between the container rows at their west gap, the
  // gap to the north, and the silo block's and the warehouse's ground
  // floors by their south doors
  const yardLane = add(-4, -160, 0, "north");
  const yardNorth = add(-4, -184, 0, "north");
  const siloDoor = add(-28.5, -162.5, 0, "north");
  const siloFloor = add(-28.5, -170, null, "north");
  const houseDoor = add(24, -171, 0, "north");
  const houseFloor = add(24, -181, null, "north");
  // The Table: the mesa's pass, the crests either side of it, and the
  // Station, whose ground floor is reached by its south door from the face.
  const mesaPass = add(110, 0, 0);
  const tableTop = add(101, -31, 8);
  const tableFace = add(112, -25, 6);
  const tableFloor = add(112, -34, null);
  const mesaSouth = add(112, 36, 8);
  // the east road round the container stack and the culvert
  const eastStack = add(79, -4, 0);
  const eastCulvert = add(130, -9, 0);
  // East Ridge: the north ramp's head on the terrace, and the south ramp's
  // foot and head and the undercroft's south door, the way to node 18
  const ridgeTop = add(161, -8, 8, "east");
  const rampFoot = add(157, 37, 0, "east");
  const rampHead = add(157, 18, 4, "east");
  const ridgeDoor = add(170, 17.5, 4, "east");
  // The wash: the road's pass through it, the channel either side, the
  // north bank's crest, and the Crossing's deck with the way on to its
  // north abutment. The pump house stands in the mouth of the east channel,
  // so that is reached from its north side.
  const washPass = add(0, 116, 0);
  const channelWest = add(-34, 118, 0);
  const channelEast = add(40, 114, 0);
  const bankWest = add(-40, 102, 3.5);
  const crossingDeck = add(-12, 112, 4);
  const abutment = add(-8, 95, 0);
  const pumpNorth = add(7, 108, 0);
  const ruinSouth = add(8, 127, 0);
  // South Depot: the lane west of the east bay, the gap between the middle
  // shed and the middle bay that node 10 is reached by, and the loading
  // building's ground floor by its north door
  const depotEast = add(20, 149.5, 0, "south");
  const depotGap = add(0, 152, 0, "south");
  const depotWest = add(-21.5, 152, 0, "south");
  const loadingDoor = add(-32, 155, 0, "south");
  const loadingFloor = add(-31, 166, null, "south");
  // The west: the saddle between the knuckles, the Well's yard through its
  // gate, both knuckles' tops, the water tower block's ground floor by its
  // east door, and West Town's street, reached along its north side past
  // the container stack on the road and the wall across its east end.
  const saddle = add(-116, -3.5, 0);
  const wellGate = add(-103, 3, 0);
  const wellYard = add(-102.5, 16, 0);
  const knuckleNorth = add(-126, -54, 5.5);
  const knuckleSouth = add(-126, 54, 4);
  const knuckleEast = add(-88, -32, 0);
  const westRuin = add(-84, -7.5, 0);
  const towerDoor = add(-128, 20.5, 0, "west");
  const towerFloor = add(-138, 22, null, "west");
  const street = add(-165, -2.4, 0, "west");
  const streetWest = add(-189, -2, 0, "west");
  const streetEast = add(-141, -2, 0, "west");
  // The edge's shelf, on its top tier 2.5 m up: the first way round the map
  // that is not the loop road. Where two shelves meet, the corner node is on
  // one shelf's lowest tier, since the corner itself is sand and the other
  // shelf's end is a 2.5 m face.
  const edgeN = add(0, -214.4, 2.5);
  const edgeNE = add(150, -214.4, 2.5);
  const cornerNE = add(201.6, -196, 0.5);
  const edgeEN = add(214.4, -150, 2.5);
  const edgeE = add(214.4, 0, 2.5);
  const edgeES = add(214.4, 150, 2.5);
  const cornerSE = add(196, 201.6, 0.5);
  const edgeSE = add(150, 214.4, 2.5);
  const edgeS = add(0, 214.4, 2.5);
  const edgeSW = add(-150, 214.4, 2.5);
  const cornerSW = add(-201.6, 196, 0.5);
  const edgeWS = add(-214.4, 150, 2.5);
  const edgeW = add(-214.4, 0, 2.5);
  const edgeWN = add(-214.4, -150, 2.5);
  const cornerNW = add(-196, -201.6, 0.5);
  const edgeNW = add(-150, -214.4, 2.5);
  // the sites: Highpoint's top, the Sump's top and its steps up to the
  // catwalk, the Motor Pool's workshop by its roller door, the Relay's pad
  const highpoint = add(175, -166.5, 5);
  const sump = add(-164, 175, 5);
  const sumpSteps = add(-163, 180.5, 5);
  const sumpCatwalk = add(-176, 180.5, 8);
  const workshop = add(62, 61, 0);
  const workshopDoor = add(47, 62, 0);
  const relay = add(-57.5, -62, 3);
  // The compounds. Each is open on the side toward the middle of the map and
  // walled on the others, so each has a node in its yard on the open side,
  // the way in on that side, and one outside the corner of its wall toward
  // the loop, the way round it.
  const farmYard = add(-96, -110, 0, "nw");
  const farmIn = add(-82, -108, 0, "nw");
  const farmEast = add(-72, -99, 0);
  const farmCorner = add(-76, -132, 0);
  const storeYard = add(84, -110, 0, "ne");
  const storeIn = add(61, -83, 0);
  const storeCorner = add(76, -132, 0);
  const pensYard = add(-84, 110, 0, "sw");
  const pensIn = add(-76, 83, 0);
  const pensCorner = add(-76, 132, 0);
  const worksYard = add(84, 86, 0, "se");
  const worksIn = add(76, 80, 0);
  const worksCorner = add(76, 132, 0);

  // The old links a bot walks as they are.
  for (const gate of [1, 2, 3, 4]) link(0, gate);
  link(2, 6);
  link(7, 11);
  link(9, 13);
  link(13, 11);
  link(11, 14);
  link(16, 9);
  link(11, 17);
  // The eleven that walked into a wall, each by its way round.
  for (const [a, b] of [
    // 1-5 and 5-9: the north road past its ruin, the chicane and the yard
    [1, roadNW],
    [roadNW, 5],
    [5, roadNE],
    [roadNE, notchRock],
    [notchRock, notchPass],
    [notchPass, notchLane],
    [notchLane, yardLane],
    [yardLane, 9],
    // 3-7 and 4-8: round the east road's containers and the west road's ruin
    [3, eastStack],
    [eastStack, 7],
    [4, westRuin],
    [westRuin, 8],
    // 6-10, 14-10 and 10-15: round the depot's sheds, into the middle bay from its north end
    [6, washPass],
    [washPass, ruinSouth],
    [ruinSouth, depotEast],
    [depotEast, depotGap],
    [depotGap, 10],
    [depotGap, 14],
    [depotGap, depotWest],
    [depotWest, loadingDoor],
    [loadingDoor, 15],
    // 8-12, 15-12 and 12-16: along West Town's street and out of either end
    [8, saddle],
    [saddle, street],
    [street, 12],
    [street, streetWest],
    [streetWest, 15],
    [street, streetEast],
    [streetEast, 16],
    // 17-18: node 18 is in the undercroft, and the north ramp comes up on to
    // its roof; the way in is the south ramp and the south door
    [17, ridgeTop],
    [11, rampFoot],
    [14, rampFoot],
    [rampFoot, rampHead],
    [rampHead, ridgeDoor],
    [ridgeDoor, 18],
  ]) link(a, b);
  // The hub: the Mast's hall to the courtyard and every gate, and the ring
  // of crests, each to its neighbours and to the gate it looks down on.
  for (const n of [0, 1, 2, 3, 4]) link(mastHall, n);
  const ring = [crestNW, crestNE, crestEN, crestES, crestSE, crestSW, crestWS, crestWN];
  ring.forEach((c, i) => link(c, ring[(i + 1) % ring.length]));
  for (const [c, gate] of [
    [crestNW, 1],
    [crestNE, 1],
    [crestEN, 3],
    [crestES, 3],
    [crestSE, 2],
    [crestSW, 2],
    [crestWS, 4],
    [crestWN, 4],
  ]) link(c, gate);
  for (const [a, b] of [
    // the north: the Notch's crests off the road, and North Yard's buildings
    [roadNW, notchWest],
    [roadNE, notchEast],
    [crestNW, roadNW],
    [crestNE, roadNE],
    [siloFloor, siloDoor],
    [siloDoor, 9],
    [siloDoor, yardLane],
    [siloDoor, 16],
    [houseFloor, houseDoor],
    [houseDoor, 9],
    [houseDoor, yardLane],
    [edgeN, yardNorth],
    [yardNorth, yardLane],
    // the east: the mesa's pass and crests, the Table Station, round the culvert
    [mesaPass, 7],
    [mesaPass, eastCulvert],
    [eastCulvert, 11],
    [mesaPass, tableTop],
    [mesaPass, tableFace],
    [tableTop, tableFace],
    [tableFace, tableFloor],
    [mesaPass, mesaSouth],
    [mesaSouth, crestES],
    // the south: the wash, its banks, the Crossing's deck
    [washPass, channelWest],
    [washPass, pumpNorth],
    [pumpNorth, channelEast],
    [pumpNorth, 6],
    [pumpNorth, crestSE],
    [washPass, bankWest],
    [bankWest, channelWest],
    [bankWest, abutment],
    [bankWest, crestSW],
    [abutment, 6],
    [crossingDeck, abutment],
    [loadingFloor, loadingDoor],
    // the west: the Well, the knuckles, the water tower block
    [saddle, wellGate],
    [wellGate, wellYard],
    [saddle, knuckleNorth],
    [saddle, knuckleSouth],
    [knuckleNorth, knuckleEast],
    [knuckleEast, saddle],
    [knuckleEast, crestWN],
    [knuckleNorth, 16],
    [knuckleSouth, 15],
    [towerFloor, towerDoor],
    [towerDoor, saddle],
    [towerDoor, streetEast],
    [street, edgeW],
    // the sites
    [highpoint, 13],
    [highpoint, edgeNE],
    [sump, 15],
    [sump, edgeSW],
    [sump, sumpSteps],
    [sumpSteps, sumpCatwalk],
    [workshop, workshopDoor],
    [workshopDoor, crestSE],
    [workshopDoor, 6],
    [relay, crestWN],
    [relay, roadNW],
  ]) link(a, b);
  // The edge's shelf, all the way round, and down off it to the loop at
  // every corner and to the four places at the ends of the roads.
  const shelf = [edgeN, edgeNE, cornerNE, edgeEN, edgeE, edgeES, cornerSE, edgeSE, edgeS, edgeSW, cornerSW, edgeWS, edgeW, edgeWN, cornerNW, edgeNW];
  shelf.forEach((e, i) => link(e, shelf[(i + 1) % shelf.length]));
  for (const [e, n] of [
    [edgeNE, 13],
    [edgeEN, 13],
    [edgeES, 14],
    [edgeSE, 14],
    [edgeSW, 15],
    [edgeWS, 15],
    [edgeWN, 16],
    [edgeNW, 16],
    [edgeS, 10],
    [edgeE, 17],
    [edgeE, rampFoot],
  ]) link(e, n);
  // The compounds, each into its yard, round its wall to the loop, and out
  // on the diagonals: the north road to the farm and on to the saddle, the
  // north road to the store and on to the mesa's pass, the pass to the
  // works and on to the wash, and the wash to the pens and on to the west
  // road. Before these a rotation went through the hub or all the way round
  // the loop, which is why the bots' traffic looked the same every match.
  for (const [a, b] of [
    [farmYard, farmIn],
    [farmIn, farmCorner],
    [farmCorner, 16],
    [farmCorner, notchWest],
    [farmYard, farmEast],
    [farmEast, relay],
    [farmEast, roadNW],
    [farmEast, notchWest],
    [farmEast, knuckleEast],
    [storeYard, roadNE],
    [storeYard, storeCorner],
    [storeCorner, 13],
    [storeCorner, notchEast],
    [storeCorner, highpoint],
    [storeYard, storeIn],
    [storeIn, mesaPass],
    [storeIn, 7],
    [storeIn, notchEast],
    [storeIn, crestEN],
    [worksYard, worksIn],
    [worksIn, mesaPass],
    [worksIn, 7],
    [worksIn, crestES],
    [worksIn, mesaSouth],
    [worksYard, pumpNorth],
    [worksYard, channelEast],
    [worksYard, worksCorner],
    [worksCorner, 14],
    [worksYard, workshopDoor],
    [pensYard, washPass],
    [pensYard, pensCorner],
    [pensCorner, 15],
    [pensCorner, sump],
    [pensYard, pensIn],
    [pensIn, 8],
    [pensIn, crestWS],
    [pensIn, crestSW],
  ]) link(a, b);

  return {
    root,
    pois,
    sites,
    placeAt,
    nodes,
    ringWall,
    towers: towerSpots.map(([x, z, foot]) => ({ ...P(x, z), y: foot })),
    beacons: beaconSpots.map(([x, z]) => P(x, z)),
    pads: padSpots.map(([x, z, dx, dz]) => ({ ...P(x, z), dx, dz })),
  };
}

/** a zipline with its rope, an anchor post at each end, recorded in world space */
function zipline(root: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, floorA: number, floorB: number): void {
  const ropeMat = emissive(0xffc21a, 0.55);
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  const ra = a.clone().addScaledVector(dir, -0.6);
  const rb = b.clone().addScaledVector(dir, 0.6);
  const len = ra.distanceTo(rb);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, len, 8), ropeMat);
  rope.position.copy(ra).lerp(rb, 0.5);
  rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(rb, ra).normalize());
  root.add(rope);
  const poleMat = flat(PAL.steelDark, 0.55, 0.3);
  const cap = flat(PAL.hazard, 0.5, 0.3);
  for (const [p, floor] of [
    [ra, floorA],
    [rb, floorB],
  ] as const) {
    const h = p.y + 0.35 - floor;
    const post = new THREE.Mesh(bevel(0.22, h, 0.22, 0.04), poleMat);
    post.position.set(p.x, floor + h / 2, p.z);
    post.castShadow = true;
    root.add(post);
    const head = new THREE.Mesh(bevel(0.34, 0.2, 0.34, 0.04), cap);
    head.position.set(p.x, p.y + 0.12, p.z);
    root.add(head);
  }
  ZIPLINES.push({ a: new THREE.Vector3(a.x + BR_X, a.y, a.z + BR_Z), b: new THREE.Vector3(b.x + BR_X, b.y, b.z + BR_Z) });
}
