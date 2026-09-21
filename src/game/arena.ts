// The 1v1 arena: a small three-lane warehouse, for quick rounds.
//
// Built east of the range, out of sight of it. 36 m across, 64 m long:
//
//   z = -32  spawn A (the host), facing up the map
//            three lanes, split by two 3 m walls at x = +-6:
//              left and right lanes 11.5 m wide with tall crates and low cover,
//              the middle lane 11 m with low walls across it
//   z = 0    the middle, open across the whole width: the capture circle, and
//            boxes to jump on, from which you can mantle onto the lane walls
//            and run along the top of them
//            the lanes again, mirrored
//   z = +32  spawn B (the guest)
//
// Everything is in arena coordinates (centre 0,0) and placed at ARENA_X/Z.
// Every box is reachable: the simulation checks the jump and mantle heights.
import * as THREE from "three";
import MODES from "../config/modes.json";
import { RANGE_SOLIDS } from "./range";
import { PAL, bevel, emissive, flat, graffitiTexture, worldTiledMaterial, textPanel } from "./geo";
import { material } from "./materials";
import { warehouseRoof } from "./warehouse";
import { ZIPLINES } from "./traversal";
import { buildPlan } from "./arenas/build";
import { PLAN_MAPS, type ArenaMapInfo } from "./arenas";
import type { Bounds } from "./player";

export const ARENA_X = 90;
export const ARENA_Z = -40;
const HX = 18;
const HZ = 32;
const WALL_H = 8;
/** lane walls: low enough to mantle onto from the middle boxes */
export const LANE_WALL_H = 3;
/** the capture circle, arena centre */
export const ZONE_RADIUS = 3.5;

export const ARENA_BOUNDS: Bounds = { minX: ARENA_X - HX, maxX: ARENA_X + HX, minZ: ARENA_Z - HZ, maxZ: ARENA_Z + HZ };
export const ARENA_CENTER = new THREE.Vector3(ARENA_X, 0, ARENA_Z);

/** spawn points in world space; yaw 180 faces +z */
export const ARENA_SPAWNS = {
  host: { x: ARENA_X, z: ARENA_Z - 29, yaw: 180 },
  guest: { x: ARENA_X, z: ARENA_Z + 29, yaw: 0 },
} as const;

/**
 * A lobby's worth of spawns in the warehouse, ends first and then down the
 * sides, alternating so the first two are still the 1v1's own ends. Before
 * this there were two, and a fourth player spawned inside the host.
 */
export const ARENA_LOBBY_SPAWNS: Array<{ x: number; z: number; yaw: number }> = [
  { x: ARENA_X, z: ARENA_Z - 29, yaw: 180 },
  { x: ARENA_X, z: ARENA_Z + 29, yaw: 0 },
  { x: ARENA_X - 13, z: ARENA_Z - 27, yaw: 180 },
  { x: ARENA_X + 13, z: ARENA_Z + 27, yaw: 0 },
  { x: ARENA_X + 13, z: ARENA_Z - 27, yaw: 180 },
  { x: ARENA_X - 13, z: ARENA_Z + 27, yaw: 0 },
  { x: ARENA_X - 15, z: ARENA_Z - 6, yaw: 90 },
  { x: ARENA_X + 15, z: ARENA_Z + 6, yaw: -90 },
];

/** the arena's boxes, arena coordinates, for the movement tests */
export const ARENA_BOXES: Array<{ x: number; z: number; w: number; d: number; h: number }> = [];

export interface ArenaHandles {
  root: THREE.Group;
  /** the capture circle: shows when the zone is live */
  zone: { ring: THREE.Mesh; column: THREE.Mesh; disc: THREE.Mesh };
}

export function buildArena(scene: THREE.Scene): ArenaHandles {
  const root = new THREE.Group();
  root.name = "arena";
  root.position.set(ARENA_X, 0, ARENA_Z);
  scene.add(root);
  ARENA_BOXES.length = 0;

  const solid = (minX: number, maxX: number, minZ: number, maxZ: number, base: number, top: number) =>
    RANGE_SOLIDS.push({ minX: minX + ARENA_X, maxX: maxX + ARENA_X, minZ: minZ + ARENA_Z, maxZ: maxZ + ARENA_Z, base, top });
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, isSolid = true) => {
    const m = new THREE.Mesh(bevel(w, h, d, 0.05), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    if (isSolid) solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y, y + h);
    return m;
  };
  /** a jumpable crate, recorded for the tests */
  const crate = (w: number, h: number, d: number, x: number, z: number, mat: THREE.Material) => {
    ARENA_BOXES.push({ x, z, w, d, h });
    return box(w, h, d, x, 0, z, mat);
  };

  // B00G on the walls in muted shades, about a third as strong as the
  // course's, so it gives the place character without pulling the eye off a
  // fight.
  const wallMat = worldTiledMaterial(
    graffitiTexture("B00G", {
      top: "#4a5059",
      bottom: "#3d424a",
      words: ["#c98a5a", "#9fb4c8", "#c7b56a", "#b48ab8", "#6fb7a8"],
      strength: 0.3,
    }),
    4,
    2
  );
  const laneMat = worldTiledMaterial(
    graffitiTexture("B00G", {
      top: "#5a5f66",
      bottom: "#4b5057",
      words: ["#d9d2c4", "#e0795a", "#8fc1e8", "#d9d2c4", "#b8d67a"],
      strength: 0.3,
    }),
    4,
    2
  );
  const crateMat = flat(0x8a6a44, 0.8, 0.05);
  const containerMat = flat(0x2f5d7a, 0.6, 0.25);
  const containerMat2 = flat(0x7a3a2f, 0.6, 0.25);
  const coverMat = flat(PAL.steelLight, 0.55, 0.12);
  const trim = flat(PAL.orange, 0.55, 0.25);

  // floor
  const floorMat = material("concrete", { color: 0xb9b3a6, roughness: 0.95, metalness: 0.02 });
  const floorGeo = new THREE.PlaneGeometry(HX * 2, HZ * 2);
  const uv = floorGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 9, uv.getY(i) * 16);
  uv.needsUpdate = true;
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.004;
  floor.receiveShadow = true;
  root.add(floor);
  // painted lane lines, so the three lanes read from a spawn
  for (const x of [-6, 6]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.15, HZ * 2 - 4), new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.9 }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.01, 0);
    root.add(line);
  }

  // outer walls and roof
  box(1, WALL_H, HZ * 2 + 2, -HX - 0.5, 0, 0, wallMat);
  box(1, WALL_H, HZ * 2 + 2, HX + 0.5, 0, 0, wallMat);
  box(HX * 2, WALL_H, 1, 0, 0, -HZ - 0.5, wallMat);
  box(HX * 2, WALL_H, 1, 0, 0, HZ + 0.5, wallMat);
  warehouseRoof(root, { x0: -HX - 1, x1: HX + 1, z0: -HZ - 1, z1: HZ + 1, y: WALL_H, gable: ARENA_GABLE, skylightEvery: 4, girders: [-6, 6], lights: [-12, 0, 12], solid });

  // the lanes: two 3 m walls on each side of the middle, with an orange cap
  // so their tops read as somewhere you can stand
  for (const sz of [-1, 1]) {
    for (const x of [-6, 6]) {
      const z0 = 8;
      const z1 = 25;
      box(1, LANE_WALL_H, z1 - z0, x, 0, sz * ((z0 + z1) / 2), laneMat);
      const cap = new THREE.Mesh(bevel(1.04, 0.08, z1 - z0, 0.02), trim);
      cap.position.set(x, LANE_WALL_H + 0.04, sz * ((z0 + z1) / 2));
      root.add(cap);
    }
    // side lanes: a tall container to break the sight line, low cover near spawn
    for (const sx of [-1, 1]) {
      box(3, 2.4, 6, sx * 12, 0, sz * 17, sz * sx > 0 ? containerMat : containerMat2);
      ARENA_BOXES.push({ x: sx * 12, z: sz * 17, w: 3, d: 6, h: 2.4 });
      crate(1.2, 1.2, 1.2, sx * 15.5, sz * 11, crateMat);
      crate(1.2, 1.2, 1.2, sx * 9, sz * 22.5, crateMat);
    }
    // middle lane: low walls across it, staggered, to slide and jump over
    box(5, 1.1, 0.6, -2, 0, sz * 15, coverMat);
    box(4, 1.1, 0.6, 2.5, 0, sz * 21, coverMat);
    // spawn cover
    crate(1.2, 1.2, 2.4, -3.5, sz * 27, crateMat);
    crate(1.2, 1.2, 2.4, 3.5, sz * 27, crateMat);
    // The middle: a 1.4 m box against the mid-lane face of each lane wall's
    // end, a small step crate beside it. Box to wall top is a 1.6 m mantle.
    for (const sx of [-1, 1]) {
      crate(1.6, 1.4, 1.6, sx * 4.6, sz * 9.5, crateMat);
      crate(1.0, 0.7, 1.0, sx * 3.1, sz * 10.4, crateMat);
    }
  }
  // cover round the circle, and double stacks on the flanks
  for (const sx of [-1, 1]) {
    crate(2.2, 2.4, 2.2, sx * 13, sx * 3, crateMat);
    crate(1.2, 1.2, 1.2, sx * 13, -sx * 1.2, crateMat);
  }

  // The middle building. The middle lane was a corridor with two low walls in
  // it: nothing to go over, round or through, and the circle sat in the open.
  // This is a two-storey shell over the circle you can fight around and on
  // top of, reached by a mantle chain on each side or a zipline from either
  // end of the map (Hyper Scape's lesson: give people a reason to be above
  // the floor, docs/HYPER_SCAPE.md).
  {
    const F1 = 3.2; // the first floor, a mantle up from the 1.6 m crates beside it
    const ROOF = 6.0;
    const W = 11; // across the middle lane, short of the lane walls at x 6
    const D = 9;
    // four corner pillars and the two side walls, open to the lanes at the ends
    for (const sx of [-1, 1]) {
      box(0.7, ROOF, 0.7, sx * (W / 2 - 0.35), 0, -D / 2 + 0.35, wallMat);
      box(0.7, ROOF, 0.7, sx * (W / 2 - 0.35), 0, D / 2 - 0.35, wallMat);
      // The ground floor is a canopy on pillars, not a walled room: walls here
      // closed the middle lane, and a bot walking it could no longer find its
      // way to the other end (every killcam and recap check in the e2e died
      // with it). You run straight through; the cover is upstairs.
      // The first floor's own low wall, to shoot over from up there:
      box(0.4, 1.0, D - 1.4, sx * (W / 2 - 0.2), F1, 0, coverMat);
    }
    // the first floor itself, a hole at each end so you can drop through
    box(W - 1.4, 0.3, 3.4, 0, F1 - 0.3, -D / 2 + 1.9, laneMat);
    box(W - 1.4, 0.3, 3.4, 0, F1 - 0.3, D / 2 - 1.9, laneMat);
    // the roof, and a lip you can crouch behind
    box(W, 0.3, D, 0, ROOF - 0.3, 0, laneMat);
    for (const sz of [-1, 1]) box(W, 0.7, 0.35, 0, ROOF, sz * (D / 2 - 0.18), coverMat);
    // the way up: a crate against each side, first floor, then roof by mantle
    for (const sx of [-1, 1]) {
      crate(1.6, 1.6, 1.6, sx * (W / 2 + 1.1), -2.6, crateMat);
      crate(1.6, 1.6, 1.6, sx * (W / 2 + 1.1), 2.6, crateMat);
      ARENA_BOXES.push({ x: sx * (W / 2 + 1.1), z: 2.6, w: 1.6, d: 1.6, h: 1.6 });
    }
    // A stack inside under each end hole, the first floor from the ground.
    // Off the centre line on purpose: dead centre they closed the middle
    // corridor at chest height, and a bot at one end could no longer see or
    // reach the other.
    for (const sz of [-1, 1]) crate(1.4, 1.5, 1.4, sz * 2.6, sz * (D / 2 - 1.9), crateMat);

    // Ziplines from each end of the map onto the roof: the rotate that the
    // middle lane never had. They ride in the direction you look, so each is
    // a way in AND a way out.
    for (const sz of [-1, 1]) {
      // clear of the spawns at z 29: a 4.6 m post right in front of one was in the way
      const post = new THREE.Vector3(0, 4.6, sz * 21);
      const roofEnd = new THREE.Vector3(0, ROOF + 1.1, sz * (D / 2 - 0.8));
      arenaZip(root, post, roofEnd, 0, ROOF);
    }
  }

  // the capture circle
  // its own material, not the shared cache: it brightens when the zone is live
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x0a0d10, emissive: 0xffd23c, emissiveIntensity: 1.2, roughness: 0.4 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(ZONE_RADIUS - 0.18, ZONE_RADIUS, 48), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  root.add(ring);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(ZONE_RADIUS - 0.18, 48),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.08, depthWrite: false })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.015;
  root.add(disc);
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(ZONE_RADIUS, ZONE_RADIUS, WALL_H, 48, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide })
  );
  column.position.y = WALL_H / 2;
  column.visible = false;
  root.add(column);
  for (const m of [ring, disc, column]) m.userData.dynamic = true;

  // spawn signs
  root.add(textPanel("1V1\nThree lanes. From 20 s into a round the circle in the middle goes live: stand in it alone for 10 s to take the round. A knock wins it at any time.", 0, 4.5, -HZ + 0.02, 0, 7, 2.4));
  root.add(textPanel("1V1\nThree lanes. From 20 s into a round the circle in the middle goes live: stand in it alone for 10 s to take the round. A knock wins it at any time.", 0, 4.5, HZ - 0.02, Math.PI, 7, 2.4));

  // The other three arenas go up with this one. They are built here rather
  // than from main.ts because main.ts belongs to somebody else this week, and
  // because it costs nothing: they are meshes in the same scene, merged by
  // the same static merge, and no match looks at one until it is chosen.
  buildOtherArenas(scene);

  root.updateMatrixWorld(true);
  const handles: ArenaHandles = { root, zone: { ring, column, disc } };
  ARENA_HANDLES.set("warehouse", handles);
  return handles;
}

// ------------------------------------------------------------- 1v1v1: the triangle
//
// Three players, three corners. A square room north of the 1v1 arena; the
// spawns sit at the points of an equilateral triangle round the circle, and
// between each pair of spawns a spoke of staggered 3 m blocks blocks the
// straight line, so the fights come through the middle or round the outside.
// Boxes at the circle to get on the spokes. The same 20 s / 10 s circle.

export const TRI_X = 90;
export const TRI_Z = 60;
const TRI_H = 23;
/** spawn radius from the centre */
const TRI_R = 19;

export const TRI_BOUNDS: Bounds = { minX: TRI_X - TRI_H, maxX: TRI_X + TRI_H, minZ: TRI_Z - TRI_H, maxZ: TRI_Z + TRI_H };
export const TRI_CENTER = new THREE.Vector3(TRI_X, 0, TRI_Z);

/** yaw that looks at the centre from (x, z) (look = (-sin yaw, -cos yaw)) */
const yawTo = (x: number, z: number, tx: number, tz: number) => (Math.atan2(-(tx - x), -(tz - z)) * 180) / Math.PI;

/** the three spawns, world space, each facing the middle */
export const TRI_SPAWNS: Array<{ x: number; z: number; yaw: number }> = [0, 120, 240].map((deg) => {
  const a = (deg * Math.PI) / 180;
  const x = TRI_X + Math.sin(a) * TRI_R;
  const z = TRI_Z + Math.cos(a) * TRI_R;
  return { x, z, yaw: yawTo(x, z, TRI_X, TRI_Z) };
});

export function buildTriArena(scene: THREE.Scene): ArenaHandles {
  const root = new THREE.Group();
  root.name = "triarena";
  root.position.set(TRI_X, 0, TRI_Z);
  scene.add(root);

  const solid = (minX: number, maxX: number, minZ: number, maxZ: number, base: number, top: number) =>
    RANGE_SOLIDS.push({ minX: minX + TRI_X, maxX: maxX + TRI_X, minZ: minZ + TRI_Z, maxZ: maxZ + TRI_Z, base, top });
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, isSolid = true) => {
    const m = new THREE.Mesh(bevel(w, h, d, 0.05), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    if (isSolid) solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y, y + h);
    return m;
  };

  const wallMat = worldTiledMaterial(
    graffitiTexture("B00G", {
      top: "#4a4f5c",
      bottom: "#3d424e",
      words: ["#c9a25a", "#8fb4c8", "#c96a5a", "#a48ab8", "#6fb79a"],
      strength: 0.3,
    }),
    4,
    2
  );
  const spokeMat = worldTiledMaterial(
    graffitiTexture("B00G", {
      top: "#5c5a66",
      bottom: "#4d4b57",
      words: ["#d9d2c4", "#e0a05a", "#8fc1e8", "#d9d2c4", "#b8d67a"],
      strength: 0.3,
    }),
    4,
    2
  );
  const crateMat = flat(0x8a6a44, 0.8, 0.05);
  const coverMat = flat(PAL.steelLight, 0.55, 0.12);
  const trim = flat(PAL.orange, 0.55, 0.25);

  const floorMat = material("concrete", { color: 0xb3ada2, roughness: 0.95, metalness: 0.02 });
  const floorGeo = new THREE.PlaneGeometry(TRI_H * 2, TRI_H * 2);
  const uv = floorGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 11, uv.getY(i) * 11);
  uv.needsUpdate = true;
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.004;
  floor.receiveShadow = true;
  root.add(floor);

  // outer walls and roof
  box(1, WALL_H, TRI_H * 2 + 2, -TRI_H - 0.5, 0, 0, wallMat);
  box(1, WALL_H, TRI_H * 2 + 2, TRI_H + 0.5, 0, 0, wallMat);
  box(TRI_H * 2, WALL_H, 1, 0, 0, -TRI_H - 0.5, wallMat);
  box(TRI_H * 2, WALL_H, 1, 0, 0, TRI_H + 0.5, wallMat);
  warehouseRoof(root, { x0: -TRI_H - 1, x1: TRI_H + 1, z0: -TRI_H - 1, z1: TRI_H + 1, y: WALL_H, gable: ARENA_GABLE, skylightEvery: 4, girders: [-8, 8], lights: [-12, 0, 12], solid });

  // the spokes: between each pair of spawns, along the bisector, staggered
  // 1.6 m blocks from 6 m out to 16 m out, 3 m tall with an orange cap
  for (const deg of [60, 180, 300]) {
    const a = (deg * Math.PI) / 180;
    const dx = Math.sin(a);
    const dz = Math.cos(a);
    for (let r = 6.5; r <= 16; r += 1.5) {
      const side = ((r * 2) % 3 === 0 ? 1 : -1) * 0.35;
      const x = dx * r - dz * side;
      const z = dz * r + dx * side;
      box(1.7, LANE_WALL_H, 1.7, x, 0, z, spokeMat);
      const cap = new THREE.Mesh(bevel(1.74, 0.08, 1.74, 0.02), trim);
      cap.position.set(x, LANE_WALL_H + 0.04, z);
      root.add(cap);
    }
  }
  // boxes round the circle to get onto the spokes, and a step crate each
  for (const deg of [30, 90, 150, 210, 270, 330]) {
    const a = (deg * Math.PI) / 180;
    const x = Math.sin(a) * 6.2;
    const z = Math.cos(a) * 6.2;
    box(1.6, 1.4, 1.6, x, 0, z, crateMat);
    box(1.0, 0.7, 1.0, Math.sin(a) * 7.9, 0, Math.cos(a) * 7.9, crateMat);
  }
  // cover near each spawn, and a container on the outside of each spoke
  for (const s of TRI_SPAWNS) {
    const lx = s.x - TRI_X;
    const lz = s.z - TRI_Z;
    const toC = Math.atan2(-lx, -lz);
    const px = Math.cos(toC);
    const pz = -Math.sin(toC);
    box(2.4, 1.1, 0.8, lx * 0.78 + px * 2.5, 0, lz * 0.78 + pz * 2.5, coverMat);
    box(2.4, 1.1, 0.8, lx * 0.78 - px * 2.5, 0, lz * 0.78 - pz * 2.5, coverMat);
  }
  for (const deg of [60, 180, 300]) {
    const a = (deg * Math.PI) / 180;
    box(3, 2.4, 3, Math.sin(a) * 19.5, 0, Math.cos(a) * 19.5, flat(0x2f5d7a, 0.6, 0.25));
  }

  // the capture circle
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x0a0d10, emissive: 0xffd23c, emissiveIntensity: 1.2, roughness: 0.4 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(ZONE_RADIUS - 0.18, ZONE_RADIUS, 48), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  root.add(ring);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(ZONE_RADIUS - 0.18, 48),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.08, depthWrite: false })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.015;
  root.add(disc);
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(ZONE_RADIUS, ZONE_RADIUS, WALL_H, 48, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide })
  );
  column.position.y = WALL_H / 2;
  column.visible = false;
  root.add(column);
  for (const m of [ring, disc, column]) m.userData.dynamic = true;

  const rules = "1V1V1\nThree corners, one circle. Last one standing takes the round; from 20 s in, alone in the circle for 10 s takes it too. First to 3.";
  root.add(textPanel(rules, 0, 4.5, -TRI_H + 0.02, 0, 7, 2.4));
  root.add(textPanel(rules, 0, 4.5, TRI_H - 0.02, Math.PI, 7, 2.4));

  root.updateMatrixWorld(true);
  const handles: ArenaHandles = { root, zone: { ring, column, disc } };
  ARENA_HANDLES.set("triangle", handles);
  return handles;
}

/** where a bot starts in the 1v1 arena, by index (0 the guest's spawn, then the flanks) */
export const ARENA_BOT_SPAWNS: Array<{ x: number; z: number; yaw: number }> = [
  ARENA_SPAWNS.guest,
  { x: ARENA_X - 13, z: ARENA_Z + 24, yaw: 0 },
  { x: ARENA_X + 13, z: ARENA_Z + 24, yaw: 0 },
];

/** a rideable zipline between two arena-local points, with a post at each end */
function arenaZip(root: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, floorA: number, floorB: number): void {
  const origin = root.position;
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, a.distanceTo(b), 8), emissive(0xffc21a, 0.55));
  rope.position.copy(a).lerp(b, 0.5);
  rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(b, a).normalize());
  root.add(rope);
  const poleMat = flat(PAL.steelDark, 0.55, 0.3);
  for (const [p, floor] of [
    [a, floorA],
    [b, floorB],
  ] as const) {
    const h = Math.max(0.3, p.y + 0.35 - floor);
    const post = new THREE.Mesh(bevel(0.22, h, 0.22, 0.04), poleMat);
    post.position.set(p.x, floor + h / 2, p.z);
    post.castShadow = true;
    root.add(post);
  }
  ZIPLINES.push({ a: new THREE.Vector3(a.x + origin.x, a.y, a.z + origin.z), b: new THREE.Vector3(b.x + origin.x, b.y, b.z + origin.z) });
}

// ------------------------------------------------------------- the maps
//
// One map for six modes is why a 1v1, a free-for-all, Gun Run, team
// deathmatch, Control and Crown all play the same. There are five now: the
// warehouse and the triangle above, which are hand built, and the three in
// src/game/arenas, which are drawn from plans so that a check can walk them
// in plain node (tools/checks/arenas.ts).
//
// Everything a match, a mode or a menu needs to know about a map is in the
// list below in world coordinates. Nothing here picks a map by itself: the
// choosing is duel.ts's arenaFor, and what a mode would pick if nobody says
// otherwise is `mapFor`.

export type ArenaMapId = "warehouse" | "triangle" | "vault" | "crossing" | "ringworks";

/** the 1v1 warehouse as the list sees it; its Control points are the ones in src/config/modes.json */
const WAREHOUSE_MAP: ArenaMapInfo = {
  id: "warehouse",
  name: "THE WAREHOUSE",
  blurb: "Three lanes, a two-storey shell over the middle and a rope in from each end. The arena everything was built on.",
  bounds: ARENA_BOUNDS,
  center: { x: ARENA_X, z: ARENA_Z },
  spawns: ARENA_LOBBY_SPAWNS,
  teams: {
    a: MODES.spawns.a.slice(0, 4).map((p) => ({ x: ARENA_X + p[0], z: ARENA_Z + p[1], yaw: 180 })),
    b: MODES.spawns.b.slice(0, 4).map((p) => ({ x: ARENA_X + p[0], z: ARENA_Z + p[1], yaw: 0 })),
  },
  zones: MODES.control.zones.map((z) => ({ id: String(z[0]), x: ARENA_X + Number(z[1]), z: ARENA_Z + Number(z[2]) })),
  crown: { x: ARENA_X, z: ARENA_Z },
  bestFor: ["duel", "tdm", "gunrun"],
  plan: null,
};

/** the 1v1v1 triangle: three corners, and no fourth, which is why it is only ever offered to three */
const TRIANGLE_MAP: ArenaMapInfo = {
  id: "triangle",
  name: "THE TRIANGLE",
  blurb: "Three corners and one circle, for three players. Spokes of blocks between each pair of spawns.",
  bounds: TRI_BOUNDS,
  center: { x: TRI_X, z: TRI_Z },
  spawns: TRI_SPAWNS,
  teams: { a: [TRI_SPAWNS[0]], b: [TRI_SPAWNS[1]] },
  zones: [{ id: "B", x: TRI_X, z: TRI_Z }],
  crown: { x: TRI_X, z: TRI_Z },
  bestFor: ["duel"],
  plan: null,
};

/** every arena there is, in the order a menu should offer them */
/**
 * The pitch on an arena's roof: how far the ridge stands above the eaves and
 * in how many steps each side. A building with a flat lid is a box; two
 * slopes and it is a building, which is what the owner asked for. Stepped
 * because the engine collides against axis-aligned boxes, so the steps are
 * both what is drawn and what stops a bullet (warehouse.ts gable).
 */
export const ARENA_GABLE = { rise: 3.2, steps: 7 };

export const ARENA_MAPS: ArenaMapInfo[] = [WAREHOUSE_MAP, TRIANGLE_MAP, ...PLAN_MAPS];

/** a map by id, falling back to the warehouse so a stale saved id can never leave a match without an arena */
export function arenaMap(id: string | null | undefined): ArenaMapInfo {
  return ARENA_MAPS.find((m) => m.id === id) ?? WAREHOUSE_MAP;
}

/**
 * The map a mode is played on when nobody has chosen one. These are
 * recommendations rather than the law: `arenaFor` only uses them when a
 * match is told to, because until the menu and the welcome packet carry a map
 * id, and main.ts clamps the player to the chosen map's bounds, every match
 * has to keep landing in the warehouse it lands in today.
 */
export function mapFor(mode: string, players: number): ArenaMapId {
  // three players is still the triangle: it is the only map with three
  // corners and no fourth side to be caught from
  if (mode === "duel" && players === 3) return "triangle";
  // a 1v1 wants the small two-storey room, where a round is a fight
  if (mode === "duel") return "vault";
  // the modes where everybody fights everybody want a map with no back line
  if (mode === "ffa" || mode === "crown") return "ringworks";
  // Gun Run is a race through weapons, so the smallest map wins
  if (mode === "gunrun") return "vault";
  // teams want the wide map: high ground each, and three points worth holding
  if (mode === "tdm" || mode === "control") return "crossing";
  return "warehouse";
}

/** the built arenas by id, so whoever shows a capture circle can find the right one */
export const ARENA_HANDLES = new Map<string, ArenaHandles>();
let othersBuilt = false;

/** the three drawn arenas, built into the scene once */
function buildOtherArenas(scene: THREE.Scene): void {
  if (othersBuilt) return;
  othersBuilt = true;
  for (const m of PLAN_MAPS) if (m.plan) ARENA_HANDLES.set(m.id, buildPlan(scene, m.plan, ZONE_RADIUS));
}
