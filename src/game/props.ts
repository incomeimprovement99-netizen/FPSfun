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
  /**
   * Scaled to a size rather than by a factor: x, y, z separately. A crate or a
   * rack comes in sizes and stretches without looking wrong, which is what
   * lets one stand in for a cover box exactly (src/game/arenas/dress.ts). A
   * drum or a scanned rock does not, and never gets one of these.
   */
  scale3?: { x: number; y: number; z: number };
  /** add an axis-aligned collider of this footprint */
  solid?: { w: number; h: number; d: number };
}

const loader = new GLTFLoader();
const cache = new Map<PropName, Promise<THREE.Object3D | null>>();

/**
 * A prop's glass drawn the cheap way. three.js draws a see-through,
 * two-sided material twice, back faces then front, and marks it to be
 * rebuilt before each: with a security light's glass on every block of the
 * city that was hundreds of shader rebuilds a frame, and from the Spire's roof
 * 4 ms of a 12 ms frame (tools/profile-frame.ts, getParameters and
 * getProgram). A lamp's glass is too small for the back-first order to show,
 * so it is drawn in one pass. Glass that refracts (glTF transmission) makes
 * three.js draw the whole scene again into a texture every frame one is in
 * view; a generator's window does not need it, so it is plain see-through.
 */
export function plainGlass(mat: THREE.MeshPhysicalMaterial): void {
  if (mat.transmission > 0) {
    mat.transmission = 0;
    mat.transparent = true;
    mat.opacity = Math.min(mat.opacity, 0.45);
    mat.depthWrite = false;
  }
  if (mat.transparent && mat.side === THREE.DoubleSide) mat.forceSinglePass = true;
}

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
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) plainGlass(mat as THREE.MeshPhysicalMaterial);
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
  /** what the props are added to: the scene, or a map's own group (the arenas) */
  scene: THREE.Object3D,
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
      // the size the model is, measured once per prop rather than per copy
      const size = new THREE.Box3().setFromObject(src).getSize(new THREE.Vector3());
      for (const p of list) {
        const o = src.clone(true);
        o.position.set(p.x, p.y ?? 0, p.z);
        o.rotation.y = ((p.rot ?? 0) * Math.PI) / 180;
        if (p.scale3) {
          // stretched to a size: the yaw is a quarter turn or none, so x and z
          // swap with it rather than shearing
          const turned = Math.round(((p.rot ?? 0) % 360) / 90) % 2 !== 0;
          o.scale.set(
            (turned ? p.scale3.z : p.scale3.x) / Math.max(1e-3, size.x),
            p.scale3.y / Math.max(1e-3, size.y),
            (turned ? p.scale3.x : p.scale3.z) / Math.max(1e-3, size.z)
          );
        } else o.scale.setScalar(p.scale ?? 1);
        // so a test can count what actually got placed
        o.userData.prop = name;
        scene.add(o);
      }
    })
  );
}
