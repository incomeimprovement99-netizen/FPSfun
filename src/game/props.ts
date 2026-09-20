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
  | "modular_chainlink_fence"
  // Outskirts' field. The open ground between the places is boxes called
  // rocks, which from any distance read as boxes. These are scans, fetched by
  // npm run models. They are DECORATION: a prop's collider comes from its
  // placement's `solid` footprint and not from its geometry, because this
  // engine collides against axis-aligned boxes and nothing else, so a rock
  // mesh goes over the box that was already there.
  | "namaqualand_boulder_04"
  | "namaqualand_boulder_06"
  | "namaqualand_boulders_01"
  | "namaqualand_rocks_01"
  | "rock_face_02"
  | "dead_quiver_trunk"
  | "dead_quiver_branch_02"
  | "dry_branches_medium_01";

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
/** how wide a cell of instances is (metres): the map is 440 across, so this is a handful of cells each way */
const CELL = 64;

/**
 * Every cell of instances put down, with where it stands and how far off it is
 * still worth drawing. A scan is tens of thousands of triangles: a cell of them
 * behind you is culled by its bounds, and one far in front is turned off here,
 * because at 200 m a dead branch is a pixel.
 */
const cellsPut: Array<{ mesh: THREE.InstancedMesh; x: number; z: number; far: number; standIn: THREE.Object3D[] }> = [];

/** the page, once a frame: the cells near enough to draw are the ones drawn */
export function stepInstanced(at: THREE.Vector3): void {
  for (const c of cellsPut) {
    const want = Math.hypot(at.x - c.x, at.z - c.z) <= c.far;
    if (c.mesh.visible !== want) {
      c.mesh.visible = want;
      // far off, the shape it stands in for is drawn instead: a rock is cover,
      // so something has to be there whatever the distance
      for (const o of c.standIn) o.visible = !want;
    }
  }
}

/** every cell gone (a map rebuilt) */
export function clearInstanced(): void {
  for (const c of cellsPut) c.mesh.removeFromParent();
  cellsPut.length = 0;
}

/** one kind of prop in many places, each with its own turn and size */
export interface PropSpread {
  prop: PropName;
  /** its copies cast shadows (a rock does; a twig on the sand is not worth the pass) */
  shadows?: boolean;
  /** how far off a cell of them is still drawn, metres (a cliff face reads from further than a twig) */
  far?: number;
  /** the shape each copy stands in for (the map's boxed rock), drawn again beyond `far` */
  standIn?: THREE.Object3D[];
  /** where each copy goes: the ground under it, its yaw in degrees, and either a scale or a box to fit */
  at: Array<{ x: number; y: number; z: number; rot?: number; scale?: number; fit?: { w: number; h: number; d: number } }>;
}

/**
 * Many copies of a few props, each of the prop's meshes drawn as one
 * InstancedMesh: forty boulders cost the meshes of one boulder, not forty
 * times them. The colliders are the caller's (the map's own boxes), so
 * movement is exactly as it was tuned whether or not these arrive.
 *
 * Returns the prop names it managed to draw; a missing model is not fatal
 * (run `npm run models`), and the caller leaves whatever it drew instead.
 */
export async function placeInstanced(scene: THREE.Object3D, spreads: PropSpread[]): Promise<PropName[]> {
  const done: PropName[] = [];
  await Promise.all(
    spreads.map(async ({ prop, at, shadows, far, standIn }) => {
      if (!at.length) return;
      const src = await load(prop);
      if (!src) return;
      src.updateMatrixWorld(true);
      // the model's own size, to fit a copy into a box
      const box = new THREE.Box3().setFromObject(src);
      const size = box.getSize(new THREE.Vector3());
      const meshes: THREE.Mesh[] = [];
      src.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !Array.isArray(m.material)) meshes.push(m);
      });
      if (!meshes.length) return;
      const world = new THREE.Matrix4();
      const inst = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      // A scan is tens of thousands of triangles, so the copies are grouped by
      // where they stand: one instanced mesh per cell of the map, each with
      // its own bounds, so the ones behind you are culled rather than drawn.
      const cells = new Map<string, { at: typeof at; standIn: THREE.Object3D[] }>();
      at.forEach((p, i) => {
        const key = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`;
        const cell = cells.get(key) ?? { at: [], standIn: [] };
        cell.at.push(p);
        const stand = standIn?.[i];
        if (stand) cell.standIn.push(stand);
        cells.set(key, cell);
      });
      for (const m of meshes) {
        for (const cell of cells.values()) {
          const list = cell.at;
          const im = new THREE.InstancedMesh(m.geometry, m.material, list.length);
          im.castShadow = shadows !== false;
          im.receiveShadow = true;
          list.forEach((p, i) => {
            const s = p.fit ? Math.min(p.fit.w / Math.max(1e-3, size.x), p.fit.h / Math.max(1e-3, size.y), p.fit.d / Math.max(1e-3, size.z)) : (p.scale ?? 1);
            scale.setScalar(s);
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((p.rot ?? 0) * Math.PI) / 180);
            world.compose(new THREE.Vector3(p.x, p.y, p.z), q, scale);
            // the mesh's own place inside the model, then where this copy stands
            inst.multiplyMatrices(world, m.matrixWorld);
            im.setMatrixAt(i, inst);
          });
          im.instanceMatrix.needsUpdate = true;
          im.computeBoundingSphere();
          scene.add(im);
          const mid = list.reduce((a, p) => ({ x: a.x + p.x / list.length, z: a.z + p.z / list.length }), { x: 0, z: 0 });
          cellsPut.push({ mesh: im, x: mid.x, z: mid.z, far: far ?? 150, standIn: cell.standIn });
        }
      }
      done.push(prop);
    })
  );
  return done;
}

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
