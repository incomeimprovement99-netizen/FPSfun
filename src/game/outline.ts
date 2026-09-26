// The red outline round the enemy you are aiming at (Phase 19 step 10), after
// Hyper Scape's: in a city of lit windows and neon, a figure against a busy
// facade is the hardest thing on the screen to read, and the outline is what
// makes it one shape again.
//
// An inverted hull: a copy of each of the figure's meshes, drawn back faces
// only and pushed out along its normals, so only the rim shows round the
// figure. It works with no post-processing (the Competitive preset has none),
// and it is depth tested like the figure, so a wall hides it as it hides the
// figure: it shows who you are aiming at, never who is behind a wall.
import * as THREE from "three";

export class Outline {
  private readonly mat: THREE.MeshBasicMaterial;
  private readonly thick = { value: 0.02 };
  private readonly hulls: Array<{ hull: THREE.Mesh; src: THREE.Mesh }> = [];
  private sources = 0;
  /** the figure's scale, measured once: the push is in the mesh's own units */
  private scale = 1;

  constructor(
    private readonly root: THREE.Object3D,
    private readonly skip: THREE.Object3D[],
    color: number,
  ) {
    this.mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, toneMapped: false });
    this.mat.onBeforeCompile = (s) => {
      s.uniforms.uThick = this.thick;
      s.vertexShader = s.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uThick;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed += normalize(normal) * uThick;");
    };
  }

  /** the meshes a hull copies: what is drawn of the figure (not its hit boxes, shadow or name plate) */
  private candidates(): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    const skipped = (o: THREE.Object3D): boolean => {
      for (let p: THREE.Object3D | null = o; p; p = p.parent) if (this.skip.includes(p)) return true;
      return false;
    };
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.userData.hull || !m.geometry.getAttribute("normal") || skipped(m)) return;
      const mat = m.material as THREE.Material;
      if (Array.isArray(m.material) || mat.transparent || !mat.visible) return;
      out.push(m);
    });
    return out;
  }

  private build(): void {
    for (const { hull } of this.hulls) hull.removeFromParent();
    this.hulls.length = 0;
    const list = this.candidates();
    this.sources = list.length;
    for (const src of list) {
      const skinned = src as THREE.SkinnedMesh;
      let hull: THREE.Mesh;
      if (skinned.isSkinnedMesh) {
        const s = new THREE.SkinnedMesh(src.geometry, this.mat);
        s.bind(skinned.skeleton, skinned.bindMatrix);
        hull = s;
      } else hull = new THREE.Mesh(src.geometry, this.mat);
      hull.userData.hull = true;
      hull.position.copy(src.position);
      hull.quaternion.copy(src.quaternion);
      hull.scale.copy(src.scale);
      hull.castShadow = false;
      hull.receiveShadow = false;
      hull.frustumCulled = src.frustumCulled;
      src.parent?.add(hull);
      this.hulls.push({ hull, src });
    }
    const first = list[0];
    if (first) this.scale = Math.max(1e-3, first.getWorldScale(new THREE.Vector3()).x);
  }

  /**
   * On or off, `width` metres thick. A figure's meshes can arrive after it is
   * made (a body and its outfit load in the background) or change with its
   * level of detail, so the hulls are rebuilt when the figure has a different
   * number of them, and each shows only while its own mesh does.
   */
  show(on: boolean, width: number): void {
    if (on && this.candidates().length !== this.sources) this.build();
    this.thick.value = width / this.scale;
    for (const { hull, src } of this.hulls) {
      let seen = on;
      for (let p: THREE.Object3D | null = src; seen && p && p !== this.root.parent; p = p.parent) seen = p.visible;
      hull.visible = seen;
    }
  }

  dispose(): void {
    for (const { hull } of this.hulls) hull.removeFromParent();
    this.hulls.length = 0;
    this.mat.dispose();
  }
}
