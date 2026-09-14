// CC0 glTF props (Poly Haven). Loaded asynchronously and dropped into the
// scene once ready, so the range is playable before they arrive and still
// works if they are missing entirely.
//
// Repeats are cloned rather than re-loaded, and share the loaded materials, so
// twenty crates cost one fetch.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type PropName =
  | "wooden_military_crate"
  | "Barrel_01"
  | "concrete_road_barrier"
  | "plastic_crate_03"
  | "security_light"
  | "utility_box_01"
  | "ammo_box"
  | "steel_frame_shelves_01"
  | "portable_generator"
  | "modular_chainlink_fence";

export interface Placement {
  prop: PropName;
  x: number;
  z: number;
  y?: number;
  /** yaw in degrees */
  rot?: number;
  scale?: number;
  /** add an axis-aligned collider of this footprint */
  solid?: { w: number; h: number; d: number };
}

const loader = new GLTFLoader();
const cache = new Map<PropName, Promise<THREE.Object3D | null>>();

function load(name: PropName): Promise<THREE.Object3D | null> {
  const hit = cache.get(name);
  if (hit) return hit;
  const p = loader
    .loadAsync(`models/${name}/${name}.gltf`)
    .then((g) => {
      const root = g.scene;
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
      });
      return root as THREE.Object3D;
    })
    .catch(() => null); // missing props are not fatal; run `npm run models`
  cache.set(name, p);
  return p;
}

/**
 * Place every prop. Returns the colliders to add to the world, which are
 * resolved immediately from the placement list rather than from the loaded
 * geometry, so collision does not depend on a network fetch.
 */
export async function placeProps(
  scene: THREE.Scene,
  placements: Placement[]
): Promise<void> {
  const byProp = new Map<PropName, Placement[]>();
  for (const p of placements) {
    const list = byProp.get(p.prop) ?? [];
    list.push(p);
    byProp.set(p.prop, list);
  }
  await Promise.all(
    [...byProp.entries()].map(async ([name, list]) => {
      const src = await load(name);
      if (!src) return;
      for (const p of list) {
        const o = src.clone(true);
        o.position.set(p.x, p.y ?? 0, p.z);
        o.rotation.y = ((p.rot ?? 0) * Math.PI) / 180;
        const s = p.scale ?? 1;
        o.scale.setScalar(s);
        scene.add(o);
      }
    })
  );
}
