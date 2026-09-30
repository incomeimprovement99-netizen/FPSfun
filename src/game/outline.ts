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
//
// Each hull is pushed out in its own mesh's units, so the push is the width
// over that mesh's scale, and a figure's meshes do not share one: the bought
// guns in its hands are modelled a hundredth size and drawn at scale 100. One
// push for all, taken off the figure's first mesh (the body, scale 1), put a
// gun's hull two metres out at 10 m and more further off: the red ball round an
// enemy you aimed at (the owner, 2026-09-29, and three times before; measured on
// a live bot: the magazine and the scope at scale 100, the body at 0.99). So
// the hulls are grouped by scale, a material each, every one the same width.
import * as THREE from "three";

/** a mesh's scale, to three figures: the key its hull's material is shared under */
const scaleKey = (s: number): string => s.toPrecision(3);
/** a mesh's scale in the world, as its hull is pushed (a skinned one's is its skeleton's, which the node carries here) */
const scaleOf = (m: THREE.Object3D): number => Math.max(1e-3, m.getWorldScale(new THREE.Vector3()).x);

export class Outline {
  /** a hull material for each scale among the figure's meshes, and the push it makes, in that scale's units */
  private readonly mats = new Map<string, { mat: THREE.MeshBasicMaterial; thick: { value: number }; scale: number }>();
  /** metres the hull is drawn behind where it is, along the line of sight (view space: metres whatever the mesh) */
  private readonly back = { value: 0 };
  private readonly hulls: Array<{ hull: THREE.Mesh; src: THREE.Mesh }> = [];
  private sources = 0;
  /** the width last asked for, metres */
  private width = 0.02;

  constructor(
    private readonly root: THREE.Object3D,
    private readonly skip: THREE.Object3D[],
    private readonly color: number,
    back = 0,
  ) {
    this.back.value = back;
  }

  /** the hull material for meshes of this scale, made on first asking */
  private matFor(scale: number): THREE.MeshBasicMaterial {
    const key = scaleKey(scale);
    let m = this.mats.get(key);
    if (!m) {
      const thick = { value: this.width / scale };
      const mat = new THREE.MeshBasicMaterial({ color: this.color, side: THREE.BackSide, toneMapped: false });
      mat.onBeforeCompile = (s) => {
        s.uniforms.uThick = thick;
        s.uniforms.uBack = this.back;
        s.vertexShader = s.vertexShader
          .replace("#include <common>", "#include <common>\nuniform float uThick;\nuniform float uBack;")
          .replace("#include <project_vertex>", "#include <project_vertex>\nmvPosition.xyz += normalize(mvPosition.xyz) * uBack;\ngl_Position = projectionMatrix * mvPosition;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed += normalize(normal) * uThick;");
      };
      m = { mat, thick, scale };
      this.mats.set(key, m);
    }
    return m.mat;
  }

  private candidates(): THREE.Mesh[] {
    return figureMeshes(this.root, this.skip);
  }

  private build(): void {
    for (const { hull } of this.hulls) hull.removeFromParent();
    this.hulls.length = 0;
    const list = this.candidates();
    this.sources = list.length;
    for (const src of list) this.hulls.push({ hull: copyOf(src, this.matFor(scaleOf(src))), src });
  }

  /**
   * On or off, `width` metres thick. A figure's meshes can arrive after it is
   * made (a body and its outfit load in the background) or change with its
   * level of detail, so the hulls are rebuilt when the figure has a different
   * number of them, and each shows only while its own mesh does.
   */
  show(on: boolean, width: number): void {
    if (on && this.candidates().length !== this.sources) this.build();
    this.width = width;
    for (const m of this.mats.values()) m.thick.value = width / m.scale;
    for (const { hull, src } of this.hulls) hull.visible = on && shownIn(src, this.root);
  }

  /**
   * Each hull's push in metres, drawn or not, with its mesh's scale in the world (measured here, not the one its
   * material was made for), and how many are drawn (tools/e2e.ts: all one width)
   */
  state(): { hulls: Array<{ width: number; scale: number }>; on: number } {
    const hulls = this.hulls.map((h) => {
      const scale = h.src.getWorldScale(new THREE.Vector3()).x;
      return { width: this.pushOf(h.hull) * scale, scale };
    });
    return { hulls, on: this.hulls.filter((h) => h.hull.visible).length };
  }
  private pushOf(hull: THREE.Mesh): number {
    for (const m of this.mats.values()) if (m.mat === hull.material) return m.thick.value;
    return 0;
  }

  dispose(): void {
    for (const { hull } of this.hulls) hull.removeFromParent();
    this.hulls.length = 0;
    for (const m of this.mats.values()) m.mat.dispose();
    this.mats.clear();
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
  /** the ring's material for each scale among the figure's meshes, pushing in that scale's units (see Outline) */
  private readonly rings = new Map<string, { mat: THREE.MeshBasicMaterial; thick: { value: number }; scale: number }>();
  private readonly parts: Array<{ mask: THREE.Mesh; ring: THREE.Mesh; src: THREE.Mesh }> = [];
  private sources = 0;
  private width = 0.02;
  private color = 0xffffff;
  private readonly nearest = (s: { fragmentShader: string }): void => {
    s.fragmentShader = s.fragmentShader.replace("#include <dithering_fragment>", "#include <dithering_fragment>\ngl_FragDepth = 0.0;");
  };

  constructor(
    private readonly root: THREE.Object3D,
    private readonly skip: THREE.Object3D[],
  ) {
    this.mask = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, depthFunc: THREE.AlwaysDepth, transparent: true, side: THREE.DoubleSide });
    this.mask.onBeforeCompile = this.nearest;
  }

  /** the ring material for meshes of this scale, made on first asking */
  private ringFor(scale: number): THREE.MeshBasicMaterial {
    const key = scaleKey(scale);
    let r = this.rings.get(key);
    if (!r) {
      const thick = { value: this.width / scale };
      const mat = new THREE.MeshBasicMaterial({ color: this.color, depthWrite: false, depthFunc: THREE.NotEqualDepth, transparent: true, side: THREE.BackSide, toneMapped: false });
      mat.onBeforeCompile = (s) => {
        s.uniforms.uThick = thick;
        s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nuniform float uThick;").replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed += normalize(normal) * uThick;");
        this.nearest(s);
      };
      r = { mat, thick, scale };
      this.rings.set(key, r);
    }
    return r.mat;
  }

  private build(): void {
    for (const p of this.parts) {
      p.mask.removeFromParent();
      p.ring.removeFromParent();
    }
    this.parts.length = 0;
    const list = figureMeshes(this.root, this.skip);
    this.sources = list.length;
    for (const src of list) this.parts.push({ mask: copyOf(src, this.mask, MASK_ORDER), ring: copyOf(src, this.ringFor(scaleOf(src)), RING_ORDER), src });
  }

  /** on in `color` and `width` metres wide, or off; rebuilt when the figure's meshes change (outline.ts Outline.show) */
  show(on: boolean, width = 0.02, color = 0xffffff): void {
    if (on && figureMeshes(this.root, this.skip).length !== this.sources) this.build();
    this.width = width;
    this.color = color;
    for (const r of this.rings.values()) {
      r.thick.value = width / r.scale;
      r.mat.color.setHex(color);
    }
    for (const p of this.parts) {
      const seen = on && shownIn(p.src, this.root);
      p.mask.visible = seen;
      p.ring.visible = seen;
    }
  }

  /** the ring's width in metres and colour, how many of its meshes are drawn, and that nothing in front hides it (tools/e2e.ts) */
  state(): { on: number; width: number; color: number; through: boolean } {
    const rings = [...this.rings.values()];
    const through = this.mask.depthFunc === THREE.AlwaysDepth && rings.every((r) => r.mat.depthFunc === THREE.NotEqualDepth) && !this.mask.colorWrite;
    return { on: this.parts.filter((p) => p.ring.visible).length, width: this.width, color: this.color, through };
  }

  dispose(): void {
    for (const p of this.parts) {
      p.mask.removeFromParent();
      p.ring.removeFromParent();
    }
    this.parts.length = 0;
    this.mask.dispose();
    for (const r of this.rings.values()) r.mat.dispose();
    this.rings.clear();
  }
}
