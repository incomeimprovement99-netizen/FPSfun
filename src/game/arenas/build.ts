// A plan, built: the one place that turns a plan's numbers into meshes. Only THE MOVEMENT LAB is drawn from a plan now
// (arenas/movelab.ts): every map a match is played on is drawn in the Neon City's file, and the last arena drawn here,
// the Vault, went in Milestone 663 with the warehouse look, roof and ropes only it used.
//
// Nothing in here is imported by the checks: this half needs a browser for its textures, and the geometry it works
// from lives in plan.ts.
import * as THREE from "three";
import { RANGE_SOLIDS } from "../range";
import { bevel, emissive, flat, textPanel } from "../geo";
import { material, tileBox, type MatName } from "../materials";
import worldCfg from "../../config/world.json";
import type { ArenaHandles } from "../arena";
import { allBoxes, type ArenaPlan, type MatKey } from "./plan";

/**
 * The city's look: SpeedKills' night facade, concrete and metal, each with how many metres its texture covers, so a
 * facade's windows are a facade's size. Built on the first plan and kept.
 */
let cityShared: { mats: Record<MatKey, THREE.Material>; tile: Map<THREE.Material, number> } | null = null;
function cityPalette(): { mats: Record<MatKey, THREE.Material>; tile: Map<THREE.Material, number> } {
  if (cityShared) return cityShared;
  const tile = new Map<THREE.Material, number>();
  const tex = (name: MatName, t: number, o: { color?: number; roughness?: number; metalness?: number; glow?: number }): THREE.Material => {
    const m = material(name, o);
    tile.set(m, t);
    return m;
  };
  const metal = tex("skMetal", 3, { color: 0x9098a8, roughness: 0.45, metalness: 0.7 });
  cityShared = {
    tile,
    mats: {
      wall: tex("skNight2", worldCfg.arenaLook.facadeTile, { color: 0xb8c4dc, roughness: 0.5, metalness: 0.35, glow: worldCfg.arenaLook.windowGlow }),
      slab: tex("skConcrete", 4, { color: 0x6a6e76, roughness: 0.9, metalness: 0.02 }),
      crate: tex("skConcrete", 4, { color: 0x4a4e56, roughness: 0.9, metalness: 0.02 }),
      // parked cars: dark paint, one cold and one warm
      container: flat(0x1c2638, 0.35, 0.6),
      containerAlt: flat(0x3a1a2c, 0.35, 0.6),
      cover: metal,
      // a street's fixtures (a shelter, a kiosk): lighter than the trim, so one reads at night against the street
      steel: tex("skMetal", 3, { color: 0xd0d8e8, roughness: 0.4, metalness: 0.6 }),
      neon: emissive(0x3cf2ff, worldCfg.neonGlow),
    },
  };
  return cityShared;
}

/**
 * Build one plan into the scene and register its collision. The root is a top-level object, so main.ts's static merge
 * picks it up with everything else it merges.
 */
export function buildPlan(scene: THREE.Scene, plan: ArenaPlan, zoneRadius: number): ArenaHandles {
  const { mats, tile } = cityPalette();
  const root = new THREE.Group();
  root.name = `arena:${plan.id}`;
  root.position.set(plan.x, 0, plan.z);
  scene.add(root);

  const solid = (minX: number, maxX: number, minZ: number, maxZ: number, base: number, top: number) =>
    RANGE_SOLIDS.push({ minX: minX + plan.x, maxX: maxX + plan.x, minZ: minZ + plan.z, maxZ: maxZ + plan.z, base, top });

  // the floor: one plane, with its texture scaled by the plan's real size so a big one does not get a stretched street
  const floorGeo = new THREE.PlaneGeometry(plan.halfX * 2, plan.halfZ * 2);
  const uv = floorGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (plan.halfX / 2), uv.getY(i) * (plan.halfZ / 2));
  uv.needsUpdate = true;
  const floor = new THREE.Mesh(floorGeo, material("skStreet", { color: plan.floorColor, roughness: 0.95, metalness: 0.02 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.004;
  floor.receiveShadow = true;
  root.add(floor);

  // every box, the shell first (allBoxes): drawn, solid unless it says not, and neon along its top where it is a
  // surface to stand on
  for (const b of allBoxes(plan)) {
    const y = b.y ?? 0;
    const g = new THREE.BoxGeometry(b.w, b.h, b.d);
    const t = tile.get(mats[b.mat]) ?? 0;
    if (t > 0) tileBox(g, t);
    const m = new THREE.Mesh(g, mats[b.mat]);
    m.position.set(b.x, y + b.h / 2, b.z);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    if (b.solid !== false) solid(b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2, y, y + b.h);
    if (b.cap) {
      const cap = new THREE.Mesh(bevel(b.w + 0.04, 0.08, b.d + 0.04, 0.02), mats.neon);
      cap.position.set(b.x, y + b.h + 0.04, b.z);
      root.add(cap);
    }
  }

  // the capture circle, at the plan's crown: a ring on the floor, a faint disc inside it and a column of light that
  // only shows when a match's circle is live (the lab's, drawn tiny in its corner, never is)
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
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true })
  );
  column.position.set(plan.crown.x, plan.wallH / 2, plan.crown.z);
  column.visible = false;
  root.add(column);
  for (const m of [ring, disc, column]) m.userData.dynamic = true;

  // the sign on each end wall: what the place is
  const sign = `${plan.name}\n${plan.blurb}`;
  root.add(textPanel(sign, 0, 4.5, -plan.halfZ + 0.02, 0, 7, 2.4));
  root.add(textPanel(sign, 0, 4.5, plan.halfZ - 0.02, Math.PI, 7, 2.4));

  root.updateMatrixWorld(true);
  return { root, zone: { ring, column, disc } };
}
