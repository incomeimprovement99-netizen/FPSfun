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
//
// The hull is also drawn a little further from the eye than it is, along the
// line of sight, so it lands in the same place on the screen but behind the
// figure's own front. The soldier is layers (a body under armour a few
// centimetres out), and each layer's hull came through the one over it: red
// streaks across the chest, and far off, with the rim as wide as the limbs, a
// figure filled red (the owner: "this weird ball of red around them").
import * as THREE from "three";

export class Outline {
  private readonly mat: THREE.MeshBasicMaterial;
  private readonly thick = { value: 0.02 };
  /** metres the hull is drawn behind where it is, along the line of sight */
  private readonly back = { value: 0 };
  private readonly hulls: Array<{ hull: THREE.Mesh; src: THREE.Mesh }> = [];
  private sources = 0;
  /** the figure's scale, measured once: the push is in the mesh's own units */
  private scale = 1;

  constructor(
    private readonly root: THREE.Object3D,
    private readonly skip: THREE.Object3D[],
    color: number,
    back = 0,
  ) {
    this.back.value = back;
    this.mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, toneMapped: false });
    this.mat.onBeforeCompile = (s) => {
      s.uniforms.uThick = this.thick;
      s.uniforms.uBack = this.back;
      s.vertexShader = s.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uThick;\nuniform float uBack;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nmvPosition.xyz += normalize(mvPosition.xyz) * uBack;\ngl_Position = projectionMatrix * mvPosition;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed += normalize(normal) * uThick;");
    };
  }

  private candidates(): THREE.Mesh[] {
    return figureMeshes(this.root, this.skip);
  }

  private build(): void {
    for (const { hull } of this.hulls) hull.removeFromParent();
    this.hulls.length = 0;
    const list = this.candidates();
    this.sources = list.length;
    for (const src of list) this.hulls.push({ hull: copyOf(src, this.mat), src });
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
    for (const { hull, src } of this.hulls) hull.visible = on && shownIn(src, this.root);
  }

  dispose(): void {
    for (const { hull } of this.hulls) hull.removeFromParent();
    this.hulls.length = 0;
    this.mat.dispose();
  }
}

/** the meshes an outline copies: what is drawn of the figure (not its hit boxes, shadow or name plate) */
function figureMeshes(root: THREE.Object3D, skip: THREE.Object3D[]): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const skipped = (o: THREE.Object3D): boolean => {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (skip.includes(p)) return true;
    return false;
  };
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.hull || !m.geometry.getAttribute("normal") || skipped(m)) return;
    const mat = m.material as THREE.Material;
    if (Array.isArray(m.material) || mat.transparent || !mat.visible) return;
    out.push(m);
  });
  return out;
}

/** a copy of a figure's mesh in another material, moving with it (a skinned one on the same skeleton) */
function copyOf(src: THREE.Mesh, mat: THREE.Material, order = 0): THREE.Mesh {
  const skinned = src as THREE.SkinnedMesh;
  let m: THREE.Mesh;
  if (skinned.isSkinnedMesh) {
    const s = new THREE.SkinnedMesh(src.geometry, mat);
    s.bind(skinned.skeleton, skinned.bindMatrix);
    m = s;
  } else m = new THREE.Mesh(src.geometry, mat);
  m.userData.hull = true;
  m.position.copy(src.position);
  m.quaternion.copy(src.quaternion);
  m.scale.copy(src.scale);
  m.castShadow = false;
  m.receiveShadow = false;
  m.frustumCulled = src.frustumCulled;
  m.renderOrder = order;
  src.parent?.add(m);
  return m;
}

/** a mesh is drawn: it and everything over it, up to the figure, visible */
function shownIn(src: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = src; p && p !== root.parent; p = p.parent) if (!p.visible) return false;
  return true;
}

/** the frame's last things: every teammate's shape before any teammate's ring, after everything else in the scene */
const MASK_ORDER = 990;
const RING_ORDER = 991;

/**
 * A teammate's outline, seen through walls, in their squad colour (Phase 27,
 * the owner: "his model should always be visible in an outline with a small
 * name above him in the color that he is").
 *
 * The enemy's outline above is depth tested so a wall hides it. This one must
 * not be hidden, and must still be only a rim: a hull drawn through walls
 * would fill the whole figure with colour. The canvas and the post chain have
 * no stencil to cut the figure out with (main.ts asks for none), so the depth
 * buffer does it, in two passes after everything else is drawn:
 *
 * 1. the figure's own meshes, drawn to the depth buffer only, at the nearest
 *    depth there is (0), wherever they fall on the screen, walls or not;
 * 2. the hull, also at depth 0, drawn only where the depth is NOT 0: round
 *    the figure, never on it.
 *
 * The 0s are left in the depth buffer, which is why these come last. The
 * gun's own pass clears the depth before it draws (render.ts drawViewModel),
 * so the held gun is not cut by them, and both materials are transparent, so
 * the AO pass leaves them out (render.ts excludeFromAo).
 */
export class MateOutline {
  private readonly mask: THREE.MeshBasicMaterial;
  private readonly ring: THREE.MeshBasicMaterial;
  private readonly thick = { value: 0.02 };
  private readonly parts: Array<{ mask: THREE.Mesh; ring: THREE.Mesh; src: THREE.Mesh }> = [];
  private sources = 0;
  private scale = 1;

  constructor(
    private readonly root: THREE.Object3D,
    private readonly skip: THREE.Object3D[],
  ) {
    const nearest = (s: { fragmentShader: string }): void => {
      s.fragmentShader = s.fragmentShader.replace("#include <dithering_fragment>", "#include <dithering_fragment>\ngl_FragDepth = 0.0;");
    };
    this.mask = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, depthFunc: THREE.AlwaysDepth, transparent: true, side: THREE.DoubleSide });
    this.mask.onBeforeCompile = nearest;
    this.ring = new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false, depthFunc: THREE.NotEqualDepth, transparent: true, side: THREE.BackSide, toneMapped: false });
    this.ring.onBeforeCompile = (s) => {
      s.uniforms.uThick = this.thick;
      s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nuniform float uThick;").replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed += normalize(normal) * uThick;");
      nearest(s);
    };
  }

  private build(): void {
    for (const p of this.parts) {
      p.mask.removeFromParent();
      p.ring.removeFromParent();
    }
    this.parts.length = 0;
    const list = figureMeshes(this.root, this.skip);
    this.sources = list.length;
    for (const src of list) this.parts.push({ mask: copyOf(src, this.mask, MASK_ORDER), ring: copyOf(src, this.ring, RING_ORDER), src });
    const first = list[0];
    if (first) this.scale = Math.max(1e-3, first.getWorldScale(new THREE.Vector3()).x);
  }

  /** on in `color` and `width` metres wide, or off; rebuilt when the figure's meshes change (outline.ts Outline.show) */
  show(on: boolean, width = 0.02, color = 0xffffff): void {
    if (on && figureMeshes(this.root, this.skip).length !== this.sources) this.build();
    this.thick.value = width / this.scale;
    this.ring.color.setHex(color);
    for (const p of this.parts) {
      const seen = on && shownIn(p.src, this.root);
      p.mask.visible = seen;
      p.ring.visible = seen;
    }
  }

  /** the ring's width in metres and colour, how many of its meshes are drawn, and that nothing in front hides it (tools/e2e.ts) */
  state(): { on: number; width: number; color: number; through: boolean } {
    const through = this.mask.depthFunc === THREE.AlwaysDepth && this.ring.depthFunc === THREE.NotEqualDepth && !this.mask.colorWrite;
    return { on: this.parts.filter((p) => p.ring.visible).length, width: this.thick.value * this.scale, color: this.ring.color.getHex(), through };
  }

  dispose(): void {
    for (const p of this.parts) {
      p.mask.removeFromParent();
      p.ring.removeFromParent();
    }
    this.parts.length = 0;
    this.mask.dispose();
    this.ring.dispose();
  }
}
