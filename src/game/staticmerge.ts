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
 * Texture coordinates from where each vertex is in the world, projected along
 * its face's main axis (a wall facing x takes z and y, a floor x and z), one
 * tile every `metres`. The map's boxes share one geometry per size with
 * 0-to-1 coordinates, so a texture stretched once across a 20 m wall; the
 * merge has the world positions anyway, so a material that asks for it
 * (userData.worldUV, metres per tile) gets them here, on the merged copy, and
 * every box shows its texture at one real size.
 */
export function worldUVs(g: THREE.BufferGeometry, metres: number): void {
  const pos = g.getAttribute("position") as THREE.BufferAttribute | undefined;
  const nor = g.getAttribute("normal") as THREE.BufferAttribute | undefined;
  if (!pos || !nor) return;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let u: number;
    let v: number;
    if (ay >= ax && ay >= az) {
      u = x;
      v = z;
    } else if (ax >= az) {
      u = z;
      v = y;
    } else {
      u = x;
      v = y;
    }
    uv[i * 2] = u / metres;
    uv[i * 2 + 1] = v / metres;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

/** the metres per tile a material asks its merged geometry to be textured at (0: leave the UVs alone) */
const worldUVOf = (m: THREE.Material): number => (typeof m.userData.worldUV === "number" ? m.userData.worldUV : 0);

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
    if (list.length < 2) {
      // one of its kind: a textured one still wants its coordinates from the
      // world, on a copy (its geometry is shared with others of that size)
      const m = list[0];
      const tile = worldUVOf(m.material as THREE.Material);
      if (tile > 0) {
        const g = m.geometry.clone();
        g.applyMatrix4(m.matrixWorld);
        worldUVs(g, tile);
        g.applyMatrix4(new THREE.Matrix4().copy(m.matrixWorld).invert());
        m.geometry = g;
      }
      continue;
    }
    const geos = list.map((m) => {
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      return g;
    });
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const tile = worldUVOf(list[0].material as THREE.Material);
    if (tile > 0) worldUVs(merged, tile);
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
