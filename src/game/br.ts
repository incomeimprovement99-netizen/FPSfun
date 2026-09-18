// The battle royale map: OUTSKIRTS. Open ground 440 m across, south of the
// range (z 280 to 720, x -220 to 220), one POI in the middle and four round
// it, roads between them with cover, and open field to be caught in.
//
//   THE HUB      (0, 0)     a walled compound: four buildings, the Mast (a
//                           seven-storey tower you can climb inside, the one
//                           landmark seen from everywhere), containers, a gate
//                           on each side
//   NORTH YARD   (0, -165)  a container yard: rows, some stacked, a hut
//   SOUTH DEPOT  (0, 165)   three open sheds on pillars, low walls
//   EAST RIDGE   (165, 0)   a stepped mesa with a room inside it, a bunker on
//                           its roof, a lit chimney, two ramps the bots can
//                           walk, a zipline down toward the hub
//   WEST TOWN    (-165, 0)  six houses in alleys, a water tower you can climb
//                           and ride out of, a clocktower in a churchyard
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
import { material } from "./materials";
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
  const wallOf = (color: number) => recolour(wallMat, color);
  const concrete = flat(0x9a948a, 0.8, 0.05);
  const rock = flat(0x6f6a62, 0.9, 0.02);
  const crate = flat(0x8a6a44, 0.8, 0.05);
  const steelA = flat(0x3f6e8a, 0.55, 0.25);
  const steelB = flat(0x8a4b3a, 0.55, 0.25);
  const steelC = flat(0x5d6b3a, 0.55, 0.25);
  const trim = flat(PAL.orange, 0.55, 0.25);
  const roofMat = flat(PAL.steelDark, 0.6, 0.2);
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
    hub: { wall: wallOf(0xb6b0a4), trim: flat(0xc0392b, 0.55, 0.25) },
    north: { wall: wallOf(0xa8825e), trim: flat(0xb5612a, 0.55, 0.25) },
    south: { wall: wallOf(0xc2beb2), trim: flat(0xd8a52a, 0.55, 0.25) },
    east: { wall: wallOf(0x9a6f5c), trim: flat(0x8a4030, 0.55, 0.25) },
    west: { wall: wallOf(0x8e968f), trim: flat(0x3d6e63, 0.55, 0.25) },
  };
  // The ground's own: the top of a raised landform, the face of a cliff, and
  // gravel laid on the sand. Slabs only, so each merges into one group.
  const earth = flat(0xa89473, 1, 0);
  const scarp = flat(0x6d5f47, 1, 0);
  const gravel = recolour(ground, 0x8d8b80);

  // the ground: one big textured plane, and the roads laid on it
  const g = new THREE.PlaneGeometry(BR_HALF * 2, BR_HALF * 2);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 55, uv.getY(i) * 55);
  uv.needsUpdate = true;
  const floor = new THREE.Mesh(g, ground);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);
  const strip = (x0: number, z0: number, x1: number, z1: number, w: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const rg = new THREE.PlaneGeometry(w, len);
    const ruv = rg.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < ruv.count; i++) ruv.setXY(i, ruv.getX(i) * (w / 4), ruv.getY(i) * (len / 4));
    ruv.needsUpdate = true;
    const m = new THREE.Mesh(rg, road);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(x1 - x0, z1 - z0);
    m.position.set((x0 + x1) / 2, 0.01, (z0 + z1) / 2);
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
    zip: (a, b, fa, fb) => zipline(root, a, b, fa, fb),
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
  // (62, -62) and (-62, -62) and the ruin at (62, 62). A rope off the hub
  // wants an open corner too: a rider comes down the last of it with their
  // feet a metre or two off the ground.
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
  // ridge's first step, because the north-east compound's zipline comes down
  // from (118, -118) to (139, 26) just east of it: 10 m further east, its
  // riders would be hanging into the north run's crest.
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
  // the bed is gravel, either side of the road, so it reads as a riverbed from the air
  for (const x of [-38, 38]) {
    const bed = new THREE.PlaneGeometry(68, 8);
    const buv = bed.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < buv.count; i++) buv.setXY(i, buv.getX(i) * 17, buv.getY(i) * 2);
    buv.needsUpdate = true;
    const m = new THREE.Mesh(bed, gravel);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.01, 116);
    m.receiveShadow = true;
    root.add(m);
  }

  // THE KNUCKLES: two mounds west of the hub, not a ridge, so the west stays
  // the quick way round and is still broken up: you go round one as easily
  // as over it. The saddle between them carries the west road. They stand
  // at x -144 to -108 because two ziplines cross the ground just east of
  // them, the north-west compound's to West Town and the water tower's out
  // of it, and a mound under either rope would knock its riders off.
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
    crateStair(here, 13, cz - 12, 7.2, -1);
    box(1.6, 1.4, 1.6, 21, 0, cz - 13.5, crate);
    box(1.6, 1.4, 1.6, 3, 0, cz + 14, crate);
    box(1.6, 1.4, 1.6, -9, 0, cz - 14, crate);
    // Its ramp runs south down the west face: east of it are the yard's
    // containers and a beacon. Its rope runs down through the Notch's defile,
    // corner to corner, and comes down beyond it: the line it had, to
    // (-18, -73), now runs into the ridge's west crest.
    jumpTower(here, -26, cz + 6, new THREE.Vector3(28, 2.2, cz + 92), { face: "w", foot: "s" });
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
    // bots climb.
    building(here, { x: 26, z: cz + 12, w: 11, d: 9, storeys: 2, storeyH: 3.4, doors: ["w"], windows: ["n", "s", "e"], stairs: true, roofAccess: true, balcony: true });
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

    // Its ramp runs north up the east face and its rope comes down on the
    // wash's north bank: the way out of the depot is over the wash. It stood
    // at (-28, cz - 6), where the crane's west leg and the loading building's
    // north door are now, and moved west and north clear of both and of the
    // balloon's mast.
    const bank = groundTop(-21, cz - 64);
    jumpTower(here, -40, cz - 13, new THREE.Vector3(-21, bank + 2.2, cz - 64), { face: "e", foot: "n" }, 6, bank);
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
    // off: it was never ridden from this end. It comes down between the
    // crate by the road at (87.6, -5.8) and the containers north of it; at
    // (88, -6) a rider met that crate a metre short of the end.
    zipline(root, new THREE.Vector3(cx - 1, top + 2.4, -4), new THREE.Vector3(88, 1.6, -3), top, 0);
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
    // north-west farm's rope comes down at (-131, 28).
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
    jumpTower(here, cx + 6, -26, new THREE.Vector3(cx + 92, 2.2, -18), { face: "e", foot: "n" });

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
  // or four rooms, a watch platform, and a zipline pointing at the nearest big
  // place, so a rotation has somewhere to stop.
  //
  // `zip` is where that rope comes down, by the big place it points at. With
  // the platforms at 6 m the ropes hang lower than they did, and a rider hangs
  // 2.1 m under the rope and is knocked off by anything the body touches, so
  // each end was picked for a line clear of everything in both directions:
  // north-west's and south-west's used to run into a roadside container stack
  // and a ruin, and any line from south-east's platform to the depot's north
  // side crosses its own two-storey room, so it comes down on the east side.
  // South-west's comes down where the wash's south bank now stands, so it
  // lands on the bank's crest, 3.5 m up: its end is set on groundTop.
  const COMPOUNDS: Array<{ id: string; name: string; x: number; z: number; zip: [number, number] }> = [
    { id: "nw", name: "NORTHWEST FARM", x: -104, z: -104, zip: [-131, 28] },
    { id: "ne", name: "NORTHEAST STORE", x: 104, z: -104, zip: [139, 26] },
    { id: "sw", name: "SOUTHWEST PENS", x: -104, z: 104, zip: [26, 132] },
    { id: "se", name: "SOUTHEAST WORKS", x: 104, z: 104, zip: [38, 188] },
  ];
  for (const c of COMPOUNDS) {
    // a wall round three sides, open toward the middle of the map
    const W = 26;
    const gapSide = c.x < 0 ? 1 : -1;
    box(W * 2, 2.6, 1, c.x, 0, c.z - W, wallMat);
    box(W * 2, 2.6, 1, c.x, 0, c.z + W, wallMat);
    box(1, 2.6, W * 2, c.x + gapSide * -W, 0, c.z, wallMat);
    // the rooms
    building(poi, { x: c.x - 8, z: c.z - 8, w: 13, d: 11, storeys: 2, storeyH: 3.4, doors: ["s"], windows: ["n", "e", "w"], stairs: true, balcony: true });
    building(poi, { x: c.x + 9, z: c.z + 7, w: 11, d: 9, storeys: 1, storeyH: 3.4, doors: ["n", "w"], windows: ["s", "e"] });
    building(poi, { x: c.x - 10, z: c.z + 10, w: 9, d: 8, storeys: 1, storeyH: 3.4, doors: ["e"], windows: ["n", "s"] });
    crateStair(poi, c.x - 1, c.z - 8, 6.8, 1);
    // A watch platform with the zipline off it toward the nearest big place.
    // Its ramp runs south down its east face and stops short of the low cover
    // there: west of it is the big room, north of it the compound's wall.
    const foot = groundTop(c.zip[0], c.zip[1]);
    jumpTower(poi, c.x + 14, c.z - 14, new THREE.Vector3(c.zip[0], foot + 2.2, c.zip[1]), { face: "e", foot: "s" }, 6, foot);
    for (const [ox, oz] of [
      [-2, 16],
      [16, -2],
      [-16, -2],
    ]) box(4, 1.2, 1, c.x + ox, 0, c.z + oz, concrete);
    root.add(textPanel(c.name, c.x, 3.2, c.z - W + 0.6, 0, 7, 1.4));
  }

  // ------------------------------------------------------------ the roadside
  // Crossing between places was a long run with nothing to break a sightline,
  // so anyone on a roof could watch you the whole way. These are small stops
  // on the roads: a ruin with two walls and a roof, a culvert to run through,
  // a stack of containers. None is a POI (no loot spot of its own) — they are
  // there so the ground between places is not one flat plane of sand.
  {
    const spots: Array<[number, number, number]> = [
      [0, -86, 0],
      [0, 86, 1],
      [86, 0, 2],
      [-86, 0, 0],
      [62, -62, 1],
      [-62, 62, 2],
      [62, 62, 0],
      [-62, -62, 1],
      [0, -130, 2],
      [0, 130, 0],
      [130, 0, 1],
      [-130, 0, 2],
    ];
    for (const [x, z, kind] of spots) {
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
    if (Math.abs(x) > 196 || Math.abs(z) > 196 || !clear || inBed) continue;
    box(w, h, d, x, groundTop(x, z), z, rock);
  }

  // ---------------------------------------------------------------- jump towers, beacons, launch pads
  // A jump tower at each outer place: a mast and a balloon; ride it up and
  // drop again. The Mast carries a fifth over the hub, flown from the top of
  // its lattice: the third number is the height a tower's mast stands on.
  // A respawn beacon at each outer place: a squat box with an antenna and a
  // green light. A launch pad on each road out of the hub, thrown outward.
  const towerSpots: Array<[number, number, number]> = [
    [28, -150, 0],
    [-30, 150, 0],
    [140, 34, 0],
    [-192, 30, 0],
    [0, 0, mastTop],
  ];
  const beaconSpots: Array<[number, number]> = [
    [-24, -150],
    [32, 182],
    [188, -34],
    [-140, -26],
  ];
  const padSpots: Array<[number, number, number, number]> = [
    [0, -70, 0, -1],
    [0, 70, 0, 1],
    [70, 0, 1, 0],
    [-70, 0, -1, 0],
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
    box(1.6, 1.2, 1.6, x, 0, z, concrete);
    box(0.12, 2.6, 0.12, x, 1.2, z, mast, false);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), beaconGlow);
    lamp.position.set(x, 3.9, z);
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
    { id: "ne", name: "NORTHEAST STORE", ...P(104, -104), drops: [P(112, -112), P(92, -96), P(114, -88)] },
    { id: "sw", name: "SOUTHWEST PENS", ...P(-104, 104), drops: [P(-112, 112), P(-92, 96), P(-114, 92)] },
    { id: "se", name: "SOUTHEAST WORKS", ...P(104, 104), drops: [P(112, 112), P(92, 96), P(114, 92)] },
  ];
  // The small places between the big ones (see Site), each added here as
  // { id, name, ...P(x, z) } by whatever builds it.
  const sites: Site[] = [];
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
  for (const gate of [1, 2, 3, 4]) link(0, gate);
  link(1, 5);
  link(2, 6);
  link(3, 7);
  link(4, 8);
  link(5, 9);
  link(6, 10);
  link(7, 11);
  link(8, 12);
  link(9, 13);
  link(13, 11);
  link(11, 14);
  link(14, 10);
  link(10, 15);
  link(15, 12);
  link(12, 16);
  link(16, 9);
  link(11, 17);
  link(17, 18);

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
