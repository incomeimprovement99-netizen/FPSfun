// The battle royale map: OUTSKIRTS. Open ground 440 m across, south of the
// range (z 280 to 720, x -220 to 220), one POI in the middle and four round
// it, roads between them with cover, and open field to be caught in.
//
//   THE HUB      (0, 0)     a walled compound: four buildings, a tower with a
//                           zipline off it, containers, a gate on each side
//   NORTH YARD   (0, -165)  a container yard: rows, some stacked, a hut
//   SOUTH DEPOT  (0, 165)   three open sheds on pillars, low walls
//   EAST RIDGE   (165, 0)   a stepped mesa with a bunker on top, a ramp the
//                           bots can walk, a zipline down toward the hub
//   WEST TOWN    (-165, 0)  six houses in alleys and a water tower
//
// Everything is boxes on RANGE_SOLIDS like the rest of the world, so the
// player, the bots and the bullets see it the same way. Bots walk a graph of
// nodes (POI centres, gates, road bends) laid out here as well.
import * as THREE from "three";
import { RANGE_SOLIDS } from "./range";
import { building, coverWall, crateStair, jumpTower, type PoiCtx } from "./brpoi";
import { PAL, bevel, flat, emissive, textPanel } from "./geo";
import { material } from "./materials";
import { ZIPLINES } from "./traversal";
import type { Bounds } from "./player";

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
  /** where players drop in, world space; the first is the bots' rally point */
  drops: Array<{ x: number; z: number }>;
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
  nodes: GraphNode[];
  /** the ring wall, scaled to the live ring each frame */
  ringWall: THREE.Mesh;
  /** jump towers: a balloon to ride up and drop again from (world space) */
  towers: Array<{ x: number; z: number }>;
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
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, isSolid = true) => {
    const m = new THREE.Mesh(bevel(w, h, d, 0.05), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    if (isSolid) solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y, y + h);
    return m;
  };

  // materials: sand ground, concrete walls, painted steel containers, rock
  const ground = material("ground", { color: 0xb8a988, roughness: 1, metalness: 0 });
  // the road a stop darker than the sand, the walls a warm concrete
  const road = material("concrete", { color: 0x4e4c48, roughness: 0.95, metalness: 0.02 });
  const wallMat = material("concrete", { color: 0xa39b8e, roughness: 0.85, metalness: 0.05 });
  const concrete = flat(0x9a948a, 0.8, 0.05);
  const rock = flat(0x6f6a62, 0.9, 0.02);
  const crate = flat(0x8a6a44, 0.8, 0.05);
  const steelA = flat(0x3f6e8a, 0.55, 0.25);
  const steelB = flat(0x8a4b3a, 0.55, 0.25);
  const steelC = flat(0x5d6b3a, 0.55, 0.25);
  const trim = flat(PAL.orange, 0.55, 0.25);
  const roofMat = flat(PAL.steelDark, 0.6, 0.2);
  const post = flat(PAL.steelLight, 0.55, 0.14);

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

  // Buildings you can go INSIDE (src/game/brpoi.ts). The places used to be
  // solid boxes you could only stand on, so every fight was outdoors on open
  // sand. This hands the helpers the same box maker the rest of the map uses.
  const poi: PoiCtx = {
    box,
    root,
    zip: (a, b, fa, fb) => zipline(root, a, b, fa, fb),
    mats: { wall: wallMat, floor: concrete, trim, crate, steel: post },
  };

  // ---------------------------------------------------------------- THE HUB
  {
    const W = 32;
    const H = 3;
    // walls with a 6 m gate in the middle of each side
    for (const s of [-1, 1]) {
      for (const half of [-1, 1]) {
        box(W - 3, H, 1, half * (W / 2 + 1.5), 0, s * W, wallMat);
        box(1, H, W - 3, s * W, 0, half * (W / 2 + 1.5), wallMat);
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
    // the tower: three tiers, crates up one side, a bracket and a zipline off the top
    box(8, 4, 8, 0, 0, 0, concrete);
    box(6, 5, 6, 0, 4, 0, concrete);
    box(4, 4, 4, 0, 9, 0, concrete);
    box(1.6, 1.4, 1.6, 5.4, 0, 3.2, crate);
    box(1.6, 1.4, 1.6, 5.4, 1.4, 1.6, crate);
    box(1.6, 1.4, 1.6, 5.4, 2.8, 0, crate);
    box(1.6, 1.4, 1.6, 4, 4, -3.4, crate);
    box(1.6, 1.4, 1.6, 4, 5.4, -1.8, crate);
    box(1.6, 1.4, 1.6, 4, 6.8, -0.2, crate);
    box(1.6, 1.4, 1.6, 2.6, 9, 2.6, crate);
    box(1.6, 1.4, 1.6, 2.6, 10.4, 1, crate);
    box(1.6, 1.4, 1.6, 2.6, 11.8, -0.6, crate);
    zipline(root, new THREE.Vector3(1.5, 13.4, 1.5), new THREE.Vector3(60, 1.6, 60), 13, 0);
    // four buildings with crate steps to their roofs, and a container each
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const x = sx * 19;
      const z = sz * 17;
      // two floors you can fight through, doors facing the tower, windows out
      building(poi, {
        x,
        z,
        w: 13,
        d: 11,
        storeys: 2,
        storeyH: 3.4,
        doors: [sz > 0 ? "n" : "s", sx > 0 ? "w" : "e"],
        windows: [sz > 0 ? "s" : "n", sx > 0 ? "e" : "w"],
        stairs: true,
        balcony: true,
      });
      crateStair(poi, x + sx * 8.4, z - sz * 2, 6.8, sz > 0 ? -1 : 1);
      box(6, 2.6, 2.6, x - sx * 4, 0, z + sz * 9, [steelA, steelB, steelC][(sx + 1 + sz + 1) % 3]);
    }
    // low cover round the tower
    for (const [x, z] of [
      [10, 0],
      [-10, 0],
      [0, 10],
      [0, -10],
    ]) box(3, 1.1, 0.8, x, 0, z, concrete);
    root.add(textPanel("THE HUB", 0, 3.6, -W + 0.6, 0, 6, 1.4));
  }

  // ---------------------------------------------------------------- NORTH YARD
  {
    const cz = -165;
    let n = 0;
    for (let row = -1.5; row <= 1.5; row++) {
      for (let col = -2; col <= 2; col++) {
        const x = col * 8;
        const z = cz + row * 5;
        const mat = [steelA, steelB, steelC][n++ % 3];
        box(6, 2.6, 2.6, x, 0, z, mat);
        // the ends of the outer rows are stacked two high
        if ((col === -2 || col === 2) && Math.abs(row) > 1) box(6, 2.6, 2.6, x, 2.6, z, [steelB, steelC, steelA][n % 3]);
      }
    }
    // the yard's warehouse: two floors, four ways in, a roof worth holding
    building(poi, { x: 24, z: cz - 18, w: 18, d: 14, storeys: 2, storeyH: 3.6, doors: ["s", "w"], windows: ["n", "e"], stairs: true });
    crateStair(poi, 13, cz - 12, 7.2, -1);
    box(1.6, 1.4, 1.6, 21, 0, cz - 13.5, crate);
    box(1.6, 1.4, 1.6, 3, 0, cz + 14, crate);
    box(1.6, 1.4, 1.6, -9, 0, cz - 14, crate);
    root.add(textPanel("NORTH YARD", 0, 3.4, cz - 22, 0, 6, 1.4));
  }

  // ---------------------------------------------------------------- SOUTH DEPOT
  {
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
    }
    for (const [x, z] of [
      [-8, cz - 16],
      [8, cz + 16],
      [-24, cz + 2],
      [24, cz - 2],
    ]) box(6, 1.1, 0.8, x, 0, z, concrete);
    // three sheds under the canopies, and the depot office over the yard: the
    // lanes between the canopies were the whole place before
    for (const x of [-16, 0, 16]) {
      building(poi, { x, z: cz + (x === 0 ? -18 : 18), w: 9, d: 7, storeys: 1, storeyH: 3.4, doors: [x === 0 ? "s" : "n"], windows: ["e", "w"] });
    }
    building(poi, { x: 26, z: cz + 12, w: 11, d: 9, storeys: 2, storeyH: 3.4, doors: ["w"], windows: ["n", "s", "e"], stairs: true, balcony: true });
    crateStair(poi, 33, cz + 6, 6.8, -1);
    root.add(textPanel("SOUTH DEPOT", 0, 3.4, cz + 22, Math.PI, 6, 1.4));
  }

  // ---------------------------------------------------------------- EAST RIDGE
  {
    const cx = 165;
    // four 2 m steps: each mantleable from the one below
    for (let i = 0; i < 4; i++) {
      const size = 44 - i * 10;
      box(size, 2, size, cx + i * 2, i * 2, i * 1.5, rock);
    }
    // the bunker on top, a gap in its west wall
    const top = 8;
    box(8, 3, 1, cx + 6, top, 4.5 - 4, wallMat);
    box(8, 3, 1, cx + 6, top, 4.5 + 4, wallMat);
    box(1, 3, 8, cx + 10, top, 4.5, wallMat);
    box(1, 3, 3, cx + 2, top, 4.5 + 2.5, wallMat);
    box(8.4, 0.5, 8.4, cx + 6, top + 3, 4.5, roofMat);
    // a room in the step below, so the ridge is somewhere to be inside as well as on
    building(poi, { x: cx - 8, z: 16, w: 12, d: 10, storeys: 1, storeyH: 3.4, doors: ["s", "n"], windows: ["e", "w"] });
    // a ramp the bots can walk (0.5 m steps over 32 m) up the north face
    for (let i = 0; i < 16; i++) box(5, 0.5 * (i + 1), 2, cx - 4, 0, -38 + i * 2, rock);
    zipline(root, new THREE.Vector3(cx - 1, top + 1.6, -4), new THREE.Vector3(88, 1.6, -6), top, 0);
    box(1.6, 1.4, 1.6, cx - 24, 0, 8, crate);
    box(1.6, 1.4, 1.6, cx + 3, 0, 26, crate);
    root.add(textPanel("EAST RIDGE", cx, 3.4, -28, 0, 6, 1.4));
  }

  // ---------------------------------------------------------------- WEST TOWN
  {
    const cx = -165;
    // Six houses you can go inside, in two rows with a street between them:
    // doors onto the street, windows on the far sides, stairs to a first
    // floor and a roof to fight from. They were solid 8 x 8 blocks before.
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const x = cx - 14 + c * 14;
        const z = -8 + r * 16;
        const twoStorey = c !== 1;
        building(poi, {
          x,
          z,
          w: 10,
          d: 9,
          storeys: twoStorey ? 2 : 1,
          storeyH: 3.4,
          doors: [r ? "n" : "s"],
          windows: r ? ["s", "e", "w"] : ["n", "e", "w"],
          stairs: twoStorey,
          balcony: c === 2,
        });
        // the way onto the roof from the street, for anyone who does not want the stairs
        crateStair(poi, x + 6.4, z + (r ? 5 : -5), twoStorey ? 6.8 : 3.4, r ? 1 : -1);
      }
    }
    // a low wall down the middle of the street: cover between the two rows
    for (const zz of [-2, 6]) coverWall(poi, cx - 14, zz, 6, 0.8);
    coverWall(poi, cx + 6, 2, 0.8, 7);
    // the water tower: four legs and a tank
    for (const [lx, lz] of [
      [-2, -2],
      [2, -2],
      [-2, 2],
      [2, 2],
    ]) box(0.5, 10, 0.5, cx + 24 + lx, 0, 20 + lz, post);
    box(6, 3.5, 6, cx + 24, 10, 20, steelA);
    // off the tank, out of town: a place needs a way out that is not a run across the open
    zipline(root, new THREE.Vector3(cx + 24, 14.6, 20), new THREE.Vector3(cx + 70, 2.2, 52), 13.5, 0);
    for (const [x, z] of [
      [cx - 26, -14],
      [cx + 12, 22],
      [cx - 4, 26],
    ]) box(6, 1.1, 0.8, x, 0, z, concrete);
    root.add(textPanel("WEST TOWN", cx, 3.4, -24, 0, 6, 1.4));
  }

  // ------------------------------------------------------- the four compounds
  // The corners between the five places were 100 m of empty sand you crossed
  // with nothing to use. Each diagonal now holds a small walled compound: three
  // or four rooms, a watch platform, and a zipline pointing at the nearest big
  // place, so a rotation has somewhere to stop.
  const COMPOUNDS: Array<{ id: string; name: string; x: number; z: number; to: [number, number] }> = [
    { id: "nw", name: "NORTHWEST FARM", x: -104, z: -104, to: [-165, 0] },
    { id: "ne", name: "NORTHEAST STORE", x: 104, z: -104, to: [165, 0] },
    { id: "sw", name: "SOUTHWEST PENS", x: -104, z: 104, to: [0, 165] },
    { id: "se", name: "SOUTHEAST WORKS", x: 104, z: 104, to: [0, 165] },
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
    // a watch platform with the zipline off it toward the nearest big place
    jumpTower(poi, c.x + 14, c.z - 14, new THREE.Vector3(c.to[0] + (c.x < 0 ? 26 : -26), 2.2, c.to[1] + (c.z < 0 ? 26 : -26)), 13);
    for (const [ox, oz] of [
      [-2, 16],
      [16, -2],
      [-16, -2],
    ]) box(4, 1.2, 1, c.x + ox, 0, c.z + oz, concrete);
    root.add(textPanel(c.name, c.x, 3.2, c.z - W + 0.6, 0, 7, 1.4));
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
    box(w, 1.2 + rnd() * 1.6, 1.5 + rnd() * 2, x, 0, z, rock);
  }
  // the edge: posts every 20 m, and a lit line at the very edge
  for (let t = -BR_HALF; t <= BR_HALF; t += 20) {
    for (const [x, z] of [
      [t, -BR_HALF],
      [t, BR_HALF],
      [-BR_HALF, t],
      [BR_HALF, t],
    ]) box(0.3, 2.2, 0.3, x, 0, z, post, false);
  }
  for (const [w, d, x, z] of [
    [BR_HALF * 2, 0.15, 0, -BR_HALF],
    [BR_HALF * 2, 0.15, 0, BR_HALF],
    [0.15, BR_HALF * 2, -BR_HALF, 0],
    [0.15, BR_HALF * 2, BR_HALF, 0],
  ]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), emissive(PAL.orange, 1.2));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.02, z);
    root.add(m);
  }

  // ---------------------------------------------------------------- jump towers, beacons, launch pads
  // A jump tower at each outer place: a mast and a balloon; ride it up and
  // drop again. A respawn beacon at each: a squat box with an antenna and a
  // green light. A launch pad on each road out of the hub, thrown outward.
  const towerSpots: Array<[number, number]> = [
    [28, -150],
    [-30, 150],
    [140, 34],
    [-192, 30],
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
  const mast = flat(PAL.steelLight, 0.5, 0.3);
  const balloonMat = new THREE.MeshStandardMaterial({ color: 0xd8452f, roughness: 0.6, emissive: 0x401208, emissiveIntensity: 0.4 });
  for (const [x, z] of towerSpots) {
    box(0.4, 44, 0.4, x, 0, z, mast, false);
    box(2.4, 0.3, 2.4, x, 0, z, trim, false);
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
    { id: "north", name: "NORTH YARD", ...P(0, -165), drops: [P(0, -150), P(-14, -178), P(16, -176)] },
    { id: "south", name: "SOUTH DEPOT", ...P(0, 165), drops: [P(0, 148), P(-24, 178), P(24, 150)] },
    { id: "east", name: "EAST RIDGE", ...P(165, 0), drops: [P(140, -18), P(188, 20), P(150, 26)] },
    { id: "west", name: "WEST TOWN", ...P(-165, 0), drops: [P(-145, 12), P(-188, -14), P(-160, 30)] },
    // the four compounds: smaller places to drop, and the reason the corners are worth crossing
    { id: "nw", name: "NORTHWEST FARM", ...P(-104, -104), drops: [P(-112, -112), P(-92, -96), P(-114, -92)] },
    { id: "ne", name: "NORTHEAST STORE", ...P(104, -104), drops: [P(112, -112), P(92, -96), P(114, -92)] },
    { id: "sw", name: "SOUTHWEST PENS", ...P(-104, 104), drops: [P(-112, 112), P(-92, 96), P(-114, 92)] },
    { id: "se", name: "SOUTHEAST WORKS", ...P(104, 104), drops: [P(112, 112), P(92, 96), P(114, 92)] },
  ];
  // the graph: POI centres and gates, road bends, field corners
  const N = (x: number, z: number, poi?: string): GraphNode => ({ ...P(x, z), poi, links: [] });
  const nodes: GraphNode[] = [
    N(0, 0, "hub"), // 0 hub centre
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
    N(150, -20, "east"), // 11 the ridge foot (the ramp's bottom is at 161, -38)
    N(-165, 4, "west"), // 12
    N(150, -150), // 13 corners
    N(150, 150), // 14
    N(-150, 150), // 15
    N(-150, -150), // 16
    N(161, -40, "east"), // 17 the ramp foot
    N(165, 6, "east"), // 18 the ridge top
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
    nodes,
    ringWall,
    towers: towerSpots.map(([x, z]) => P(x, z)),
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
