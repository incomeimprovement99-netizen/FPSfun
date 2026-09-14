// Merge the static level into a few meshes, one per material.
//
// The range and the course are built from several hundred boxes, rails,
// rungs and trims. Each is its own draw call, and every draw call is CPU work
// on every frame: state changes, uniform uploads, a trip through the driver.
// Nothing in the level moves, so meshes that share a material (and shadow
// flags, and vertex layout) are baked into one geometry in world space. What
// is drawn is identical; how many times the CPU asks for it is not.
//
// Left alone: anything transparent (it needs sorting per object), anything
// with custom shaders or that follows the camera (the sky), sprites, and
// meshes whose material is unique anyway (text panels), since merging one
// mesh gains nothing.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface MergeReport {
  /** meshes before */
  meshes: number;
  /** meshes after: merged groups plus everything left alone */
  after: number;
}

function mergeable(m: THREE.Mesh): boolean {
  const mat = m.material;
  if (Array.isArray(mat)) return false;
  if (mat.transparent || (mat as THREE.ShaderMaterial).isShaderMaterial) return false;
  if (!m.frustumCulled || m.name === "sky") return false;
  // things that change after the build (the course TV, the 1v1 circle)
  if (m.userData.dynamic) return false;
  if ((m as THREE.SkinnedMesh).isSkinnedMesh || (m as THREE.InstancedMesh).isInstancedMesh) return false;
  return true;
}

/** a key two meshes must share to be merged */
function layoutKey(m: THREE.Mesh): string {
  const g = m.geometry;
  const attrs = Object.keys(g.attributes)
    .sort()
    .map((k) => `${k}${g.attributes[k].itemSize}`)
    .join(",");
  const mat = m.material as THREE.Material;
  return `${mat.uuid}|${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}|${g.index ? "i" : "n"}|${attrs}|${m.renderOrder}`;
}

/**
 * Merge every static mesh under `roots` into the scene. Roots are removed
 * from nothing; merged originals are detached from their parents.
 */
export function mergeStatic(scene: THREE.Scene, roots: THREE.Object3D[]): MergeReport {
  for (const r of roots) r.updateMatrixWorld(true);
  const groups = new Map<string, THREE.Mesh[]>();
  let meshes = 0;
  for (const r of roots) {
    r.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes++;
      if (!mergeable(m) || !m.visible) return;
      const key = layoutKey(m);
      let list = groups.get(key);
      if (!list) groups.set(key, (list = []));
      list.push(m);
    });
  }
  let removed = 0;
  let added = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map((m) => {
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      return g;
    });
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    const first = list[0];
    const mesh = new THREE.Mesh(merged, first.material);
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder;
    mesh.name = "static-merged";
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    scene.add(mesh);
    for (const m of list) m.removeFromParent();
    removed += list.length;
    added++;
  }
  return { meshes, after: meshes - removed + added };
}
