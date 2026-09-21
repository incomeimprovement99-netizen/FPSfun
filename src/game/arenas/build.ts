// A plan, built: the one place that turns arena numbers into meshes.
//
// Every map in src/game/arenas goes through here, which is what keeps three
// arenas from costing three times the code and three times the materials.
// The materials are made once and shared by all of them, and they are the
// same instances the 1v1 warehouse already uses (geo.ts caches flat colours
// by value), so after the static merge in main.ts the whole set of arenas
// collapses into the same handful of draw calls the warehouse alone used to
// take.
//
// Nothing in here is imported by the checks: this half needs a browser for
// its canvas textures, and the geometry it works from lives in plan.ts.
import * as THREE from "three";
import { RANGE_SOLIDS } from "../range";
import { placeProps } from "../props";
import { dressPlan } from "../dress";
import { PAL, bevel, emissive, flat, graffitiTexture, textPanel, worldTiledMaterial } from "../geo";
import { material } from "../materials";
import { warehouseRoof } from "../warehouse";
import { ZIPLINES } from "../traversal";
import type { ArenaHandles } from "../arena";
import { allBoxes, type ArenaPlan, type MatKey, type PlanBox } from "./plan";

/**
 * The shared look. Built on the first arena and kept, because a canvas
 * texture costs a megabyte of memory and there is no reason for three maps to
 * hold three copies of the same painted wall.
 */
let shared: Record<MatKey, THREE.Material> | null = null;
function palette(): Record<MatKey, THREE.Material> {
  if (shared) return shared;
  const wall = worldTiledMaterial(
    graffitiTexture("B00G", { top: "#464c55", bottom: "#3a3f47", words: ["#c98a5a", "#9fb4c8", "#c7b56a", "#b48ab8", "#6fb7a8"], strength: 0.3 }),
    4,
    2
  );
  const slab = worldTiledMaterial(
    graffitiTexture("B00G", { top: "#585d64", bottom: "#4a4f56", words: ["#d9d2c4", "#e0795a", "#8fc1e8", "#d9d2c4", "#b8d67a"], strength: 0.3 }),
    4,
    2
  );
  shared = {
    wall,
    slab,
    // the same four flat materials the warehouse uses, so they merge together
    crate: flat(0x8a6a44, 0.8, 0.05),
    container: flat(0x2f5d7a, 0.6, 0.25),
    containerAlt: flat(0x7a3a2f, 0.6, 0.25),
    cover: flat(PAL.steelLight, 0.55, 0.12),
    steel: flat(PAL.steelDark, 0.55, 0.3),
  };
  return shared;
}

/**
 * Build one arena into the scene and register its collision. The root is a
 * top-level object like the warehouse's, so main.ts's static merge picks it
 * up with everything else it already merges.
 */
export function buildPlan(scene: THREE.Scene, plan: ArenaPlan, zoneRadius: number): ArenaHandles {
  const mats = palette();
  const root = new THREE.Group();
  root.name = `arena:${plan.id}`;
  root.position.set(plan.x, 0, plan.z);
  scene.add(root);

  const solid = (minX: number, maxX: number, minZ: number, maxZ: number, base: number, top: number) =>
    RANGE_SOLIDS.push({ minX: minX + plan.x, maxX: maxX + plan.x, minZ: minZ + plan.z, maxZ: maxZ + plan.z, base, top });

  // the floor: one plane, with its texture scaled by the map's real size so a
  // big arena does not get a stretched concrete slab
  const floorMat = material("concrete", { color: plan.floorColor, roughness: 0.95, metalness: 0.02 });
  const floorGeo = new THREE.PlaneGeometry(plan.halfX * 2, plan.halfZ * 2);
  const uv = floorGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (plan.halfX / 2), uv.getY(i) * (plan.halfZ / 2));
  uv.needsUpdate = true;
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.004;
  floor.receiveShadow = true;
  root.add(floor);

  const trim = flat(PAL.orange, 0.55, 0.25);
  // The cover a CC0 prop stands in for (dress.ts): its solid is registered
  // below exactly as before, and only its grey block goes undrawn. A prop is
  // only allowed to take a box's place when it fills it, so the cover is the
  // same cover to shoot over and hide behind.
  // dressed against the same list the meshes are drawn from, so an index is
  // the same box in both: allBoxes puts the shell in front of the plan's own
  const boxes = allBoxes(plan) as PlanBox[];
  const worn = dressPlan(boxes);
  void placeProps(root, worn.props);
  for (const [i, b] of boxes.entries()) {
    const y = b.y ?? 0;
    if (!worn.instead.has(i)) {
      const m = new THREE.Mesh(bevel(b.w, b.h, b.d, 0.05), mats[b.mat]);
      m.position.set(b.x, y + b.h / 2, b.z);
      m.castShadow = true;
      m.receiveShadow = true;
      root.add(m);
    }
    if (b.solid !== false) solid(b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2, y, y + b.h);
    // an orange cap says "this is a surface, stand on it", the same signal
    // the warehouse's lane walls carry
    if (b.cap) {
      const cap = new THREE.Mesh(bevel(b.w + 0.04, 0.08, b.d + 0.04, 0.02), trim);
      cap.position.set(b.x, y + b.h + 0.04, b.z);
      root.add(cap);
    }
  }

  if (plan.roof) {
    warehouseRoof(root, {
      x0: -plan.halfX - 1,
      x1: plan.halfX + 1,
      z0: -plan.halfZ - 1,
      z1: plan.halfZ + 1,
      y: plan.wallH,
      skylightEvery: 4,
      girders: plan.girders,
      lights: plan.lights,
      solid,
    });
  }

  for (const z of plan.zips) {
    zip(root, new THREE.Vector3(z.ax, z.ay, z.az), new THREE.Vector3(z.bx, z.by, z.bz), z.floorA, z.floorB);
  }

  // the capture circle, the same one the warehouse has: a ring on the floor,
  // a faint disc inside it and a column of light that only shows when the
  // match's circle is live
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x0a0d10, emissive: 0xffd23c, emissiveIntensity: 1.2, roughness: 0.4 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(zoneRadius - 0.18, zoneRadius, 48), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(plan.crown.x, 0.02, plan.crown.z);
  root.add(ring);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(zoneRadius - 0.18, 48),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.08, depthWrite: false })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(plan.crown.x, 0.015, plan.crown.z);
  root.add(disc);
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(zoneRadius, zoneRadius, plan.wallH, 48, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide })
  );
  column.position.set(plan.crown.x, plan.wallH / 2, plan.crown.z);
  column.visible = false;
  root.add(column);
  for (const m of [ring, disc, column]) m.userData.dynamic = true;

  // the sign on each end wall: what the place is, in the voice of the others
  const sign = `${plan.name}\n${plan.blurb}`;
  root.add(textPanel(sign, 0, 4.5, -plan.halfZ + 0.02, 0, 7, 2.4));
  root.add(textPanel(sign, 0, 4.5, plan.halfZ - 0.02, Math.PI, 7, 2.4));

  root.updateMatrixWorld(true);
  return { root, zone: { ring, column, disc } };
}

/** a rideable rope between two arena-local points, with a post at each end standing on the floor below it */
function zip(root: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, floorA: number, floorB: number): void {
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
