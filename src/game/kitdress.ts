// The building kit drawn onto the battle royale's buildings (brpoi.ts
// DRESSING): Quaternius's Downtown City MegaKit, CC0, fetched by `npm run
// kits`.
//
// Each kind of piece is one instanced mesh per mesh in its model, however
// many buildings wear it: a cornice runs round every roofline on the map, and
// a hundred cornices drawn one by one would be a hundred draw calls where one
// will do. None of it collides: the buildings are the boxes they were, and
// bots, doors and loot see only those. Nothing waits for it either; a map
// drawn without the files is the map as it was.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Dressing } from "./brpoi";

const loader = new GLTFLoader();

/** every piece's meshes, each with its place inside the model, loaded once */
async function piece(name: string): Promise<Array<{ mesh: THREE.Mesh; local: THREE.Matrix4 }>> {
  const g = await loader.loadAsync(`models/kit/city/${name}.gltf`);
  g.scene.updateMatrixWorld(true);
  const out: Array<{ mesh: THREE.Mesh; local: THREE.Matrix4 }> = [];
  g.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) out.push({ mesh: m, local: m.matrixWorld.clone() });
  });
  return out;
}

/** the pieces that throw a shadow worth having: the ones that stand off a wall */
const SHADOWS = new Set(["Cornice_Metal_Center", "Brick_CornerColumn_Bottom", "Brick_CornerColumn_Center", "Brick_CornerColumn_CapShort", "Prop_ACUnit"]);

/**
 * Draw `items` under `root` (the map's own group, whose space they are in).
 * Resolves with how many instances went in, for the tests.
 */
export async function dressKit(root: THREE.Object3D, items: readonly Dressing[]): Promise<number> {
  const byPiece = new Map<string, Dressing[]>();
  for (const it of items) (byPiece.get(it.piece) ?? byPiece.set(it.piece, []).get(it.piece)!).push(it);
  const placed = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  let drawn = 0;
  await Promise.all(
    [...byPiece].map(async ([name, list]) => {
      let parts: Awaited<ReturnType<typeof piece>>;
      try {
        parts = await piece(name);
      } catch {
        return; // a checkout without `npm run kits`: that piece is not drawn, and nothing else changes
      }
      for (const { mesh, local } of parts) {
        const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, list.length);
        list.forEach((it, i) => {
          placed.compose(new THREE.Vector3(it.x, it.y, it.z), q.setFromAxisAngle(up, it.yaw), new THREE.Vector3(it.sx, it.sy, 1));
          inst.setMatrixAt(i, placed.clone().multiply(local));
        });
        inst.instanceMatrix.needsUpdate = true;
        inst.computeBoundingSphere();
        inst.castShadow = SHADOWS.has(name);
        inst.receiveShadow = true;
        inst.name = `kit:${name}`;
        root.add(inst);
      }
      drawn += list.length;
    })
  );
  return drawn;
}
