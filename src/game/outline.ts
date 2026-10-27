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
    private color: number,
    back = 0,
  ) {
    this.back.value = back;
  }

  /** its colour now (a colour vision mode's enemy colour, palette.ts enemy3d) */
  setColor(color: number): void {
    if (color === this.color) return;
    this.color = color;
    for (const m of this.mats.values()) m.mat.color.setHex(color);
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

/**
 * Someone under INVISIBILITY, as a shimmer (Milestone 715): a pale rim at their edges and faint bands drifting up them,
 * added to what is behind, barely visible but noticeable when you know what to look for (hacks.json invis.shimmer).
 *
 * Its copies stand outside the figure, in the scene, so the figure itself can stay hidden (main.ts sets its group
 * unseen past invis.seenWithin, and the outline, the plate and the aim assist all go by that). Each takes its source's
 * place in the world every frame, and a skinned one shares its skeleton and its way of binding to it, so it is drawn
 * exactly where its source would be: bound the other way, the soldier's pieces were drawn stretched out across the
 * ground.
 */
export class CloakShell {
  private readonly parts: Array<{ copy: THREE.Mesh; src: THREE.Mesh }> = [];
  private sources = 0;
  /** when the figure's meshes were last counted (show) */
  private counted = -Infinity;
  private mat: THREE.MeshBasicMaterial | null = null;
  private readonly u = {
    amt: { value: 0 },
    color: { value: new THREE.Color() },
    time: { value: 0 },
    rim: { value: 0.9 },
    band: { value: 0.35 },
    bandScale: { value: 7 },
    bandSpeed: { value: 2.5 },
  };

  constructor(
    private readonly root: THREE.Object3D,
    private readonly skip: THREE.Object3D[],
  ) {}

  private material(): THREE.MeshBasicMaterial {
    if (this.mat) return this.mat;
    const mat = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, forceSinglePass: true });
    const u = this.u;
    mat.onBeforeCompile = (s) => {
      s.uniforms.uAmt = u.amt;
      s.uniforms.uColor = u.color;
      s.uniforms.uTime = u.time;
      s.uniforms.uRim = u.rim;
      s.uniforms.uBand = u.band;
      s.uniforms.uBandScale = u.bandScale;
      s.uniforms.uBandSpeed = u.bandSpeed;
      s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nvarying float vFres;\nvarying vec3 vWorld;").replace(
        "#include <project_vertex>",
        [
          "#include <project_vertex>",
          "#ifdef USE_SKINNING",
          "vec3 fN = normalize(normalMatrix * objectNormal);",
          "#else",
          "vec3 fN = normalize(normalMatrix * normal);",
          "#endif",
          "vFres = 1.0 - abs(dot(fN, normalize(-mvPosition.xyz)));",
          "vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
        ].join("\n"),
      );
      s.fragmentShader = s.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uAmt;\nuniform vec3 uColor;\nuniform float uTime;\nuniform float uRim;\nuniform float uBand;\nuniform float uBandScale;\nuniform float uBandSpeed;\nvarying float vFres;\nvarying vec3 vWorld;")
        .replace(
          "#include <dithering_fragment>",
          [
            "#include <dithering_fragment>",
            // bands drifting up the shape, bent a little across it so they read as a ripple and not as stripes
            "float w = sin(vWorld.x * 3.1 + vWorld.z * 2.3 + uTime * 1.7) * 1.5;",
            "float b = 0.5 + 0.5 * sin(vWorld.y * uBandScale - uTime * uBandSpeed + w);",
            "float k = uRim * vFres * vFres + uBand * b * b * vFres;",
            "gl_FragColor = vec4(uColor * uAmt * k, 1.0);",
          ].join("\n"),
        );
    };
    this.mat = mat;
    return mat;
  }

  /** the scene the copies stand in: the figure's top parent (a scene draws at the world's origin) */
  private layer(): THREE.Object3D | null {
    let p: THREE.Object3D | null = this.root.parent;
    while (p?.parent) p = p.parent;
    return p;
  }

  private build(): void {
    for (const p of this.parts) p.copy.removeFromParent();
    this.parts.length = 0;
    const layer = this.layer();
    const list = figureMeshes(this.root, this.skip);
    this.sources = list.length;
    if (!layer) return;
    const mat = this.material();
    for (const src of list) {
      const sk = src as THREE.SkinnedMesh;
      let copy: THREE.Mesh;
      if (sk.isSkinnedMesh) {
        const s = new THREE.SkinnedMesh(src.geometry, mat);
        s.bindMode = sk.bindMode;
        s.bind(sk.skeleton, sk.bindMatrix);
        copy = s;
      } else copy = new THREE.Mesh(src.geometry, mat);
      copy.matrixAutoUpdate = false;
      copy.userData.hull = true;
      copy.castShadow = false;
      copy.receiveShadow = false;
      // (a skinned copy's own bounds are its bind pose at the origin, nowhere near the figure)
      copy.frustumCulled = false;
      layer.add(copy);
      this.parts.push({ copy, src });
    }
  }

  /** a mesh still in the figure: one taken out of it (a gun swapped away) is left where it was, at the world's origin */
  private inFigure(src: THREE.Object3D): boolean {
    for (let p: THREE.Object3D | null = src; p; p = p.parent) if (p === this.root) return true;
    return false;
  }

  /** a mesh shown within the figure: itself and its parents up to the figure, but not the figure's own visibility */
  private shown(src: THREE.Object3D): boolean {
    for (let p: THREE.Object3D | null = src; p && p !== this.root; p = p.parent) if (!p.visible) return false;
    return true;
  }

  /** at `amount` (0 off) in `color`, its bands at `time`: once a frame while it is on */
  show(amount: number, color: number, look: { rim: number; band: number; bandScale: number; bandSpeed: number }, time: number): void {
    const on = amount > 0.001;
    if (on) {
      // Built again when one of its meshes has left the figure: a gun swapped for one with as many meshes kept the
      // copies on the old gun, drawn at the world's origin, and the new gun bare (Milestone 723). The figure's meshes are
      // counted twice a second for one added beside the rest, not every frame: that walked the whole figure.
      let stale = !this.parts.length || this.parts[0].copy.parent !== this.layer();
      for (let i = 0; !stale && i < this.parts.length; i++) stale = !this.inFigure(this.parts[i].src);
      if (!stale && Math.abs(time - this.counted) > 0.5) {
        this.counted = time;
        stale = figureMeshes(this.root, this.skip).length !== this.sources;
      }
      if (stale) {
        this.build();
        this.counted = time;
      }
    }
    this.u.amt.value = amount;
    this.u.color.value.setHex(color);
    this.u.time.value = time;
    this.u.rim.value = look.rim;
    this.u.band.value = look.band;
    this.u.bandScale.value = look.bandScale;
    this.u.bandSpeed.value = look.bandSpeed;
    for (const p of this.parts) {
      p.copy.visible = on && this.shown(p.src);
      if (p.copy.visible) {
        p.src.updateWorldMatrix(true, false);
        p.copy.matrix.copy(p.src.matrixWorld);
        p.copy.matrixWorldNeedsUpdate = true;
      }
    }
  }

  /** how many copies are drawn, at what amount (tools/e2e.ts) */
  state(): { on: number; amount: number; outside: number } {
    return { on: this.parts.filter((p) => p.copy.visible).length, amount: this.u.amt.value, outside: this.parts.filter((p) => p.copy.visible && !this.inFigure(p.src)).length };
  }

  /** a hidden plain and skinned mesh in its material, for the page's warm (as ShieldShell.warmKit) */
  static warmKit(): THREE.Group {
    const g = new THREE.Group();
    g.name = "cloak-warm";
    const mat = new CloakShell(g, []).material();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0.01, 0, 0, 0, 0.01, 0], 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4));
    geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    const plain = new THREE.Mesh(geo, mat);
    const bone = new THREE.Bone();
    const skinned = new THREE.SkinnedMesh(geo, mat);
    skinned.add(bone);
    skinned.bind(new THREE.Skeleton([bone]));
    for (const m of [plain, skinned]) {
      m.visible = false;
      m.frustumCulled = false;
      m.userData.dynamic = true;
    }
    g.add(plain, skinned);
    return g;
  }

  dispose(): void {
    for (const p of this.parts) p.copy.removeFromParent();
    this.parts.length = 0;
    this.mat?.dispose();
    this.mat = null;
  }
}

/** the frame's last things: a revealed figure's fill, every teammate's shape before any teammate's ring, after everything else */
const FILL_ORDER = 989;
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
  private readonly parts: Array<{ mask: THREE.Mesh; ring: THREE.Mesh; fill: THREE.Mesh | null; src: THREE.Mesh }> = [];
  private sources = 0;
  private width = 0.02;
  private color = 0xffffff;
  /**
   * The figure's shape filled in its colour, over everything, at `fill` opacity (a REVEAL's, Milestone 690: a ring alone
   * through a wall reads as a thin line; a filled shape is a body there). None for a teammate's.
   */
  private readonly fillMat: THREE.MeshBasicMaterial | null;
  private readonly nearest = (s: { fragmentShader: string }): void => {
    s.fragmentShader = s.fragmentShader.replace("#include <dithering_fragment>", "#include <dithering_fragment>\ngl_FragDepth = 0.0;");
  };

  constructor(
    private readonly root: THREE.Object3D,
    private readonly skip: THREE.Object3D[],
    fill = 0,
  ) {
    // (one pass for both sides: it writes depth alone, and a two-sided see-through material is drawn twice a frame)
    this.mask = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, depthFunc: THREE.AlwaysDepth, transparent: true, side: THREE.DoubleSide, forceSinglePass: true });
    this.mask.onBeforeCompile = this.nearest;
    this.fillMat = fill > 0 ? new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: fill, depthTest: false, depthWrite: false, toneMapped: false }) : null;
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
      p.fill?.removeFromParent();
    }
    this.parts.length = 0;
    const list = figureMeshes(this.root, this.skip);
    this.sources = list.length;
    for (const src of list)
      this.parts.push({ mask: copyOf(src, this.mask, MASK_ORDER), ring: copyOf(src, this.ringFor(scaleOf(src)), RING_ORDER), fill: this.fillMat ? copyOf(src, this.fillMat, FILL_ORDER) : null, src });
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
    this.fillMat?.color.setHex(color);
    for (const p of this.parts) {
      const seen = on && shownIn(p.src, this.root);
      p.mask.visible = seen;
      p.ring.visible = seen;
      if (p.fill) p.fill.visible = seen;
    }
  }

  /** the ring's width in metres and colour, how many of its meshes are drawn, and that nothing in front hides it (tools/e2e.ts) */
  state(): { on: number; width: number; color: number; through: boolean; fill: number } {
    const rings = [...this.rings.values()];
    const through = this.mask.depthFunc === THREE.AlwaysDepth && rings.every((r) => r.mat.depthFunc === THREE.NotEqualDepth) && !this.mask.colorWrite && (!this.fillMat || !this.fillMat.depthTest);
    return { on: this.parts.filter((p) => p.ring.visible).length, width: this.width, color: this.color, through, fill: this.fillMat && this.parts.some((p) => p.fill?.visible) ? this.fillMat.opacity : 0 };
  }

  dispose(): void {
    for (const p of this.parts) {
      p.mask.removeFromParent();
      p.ring.removeFromParent();
      p.fill?.removeFromParent();
    }
    this.parts.length = 0;
    this.mask.dispose();
    this.fillMat?.dispose();
    for (const r of this.rings.values()) r.mat.dispose();
    this.rings.clear();
  }
}

/**
 * An enemy's shield as you see it (Milestone 694): a glow over the figure's whole shape in the shield's colour when a
 * round lands on the shield, brightest round where it landed and at the figure's edges, gone in a fifth of a second.
 * Apex's shields flare in their colour where they are hit, and Halo's and Splitgate's shimmer over the body; a white
 * flash alone said a round landed, not that a shield took it. The same shell glows gold, steadily, over an enemy
 * under ARMOR (Hyper Scape's armour reads as a shell on the body), so you can see the rounds will not do their numbers.
 *
 * Copies of the figure's meshes, pushed a little out along their normals as the outlines are, drawn additive and
 * depth tested: the figure's own front hides what is behind it, and a wall hides all of it, so it never shows anyone
 * through a wall. Made the first time it shows; its copies stay, hidden, after.
 */
export class ShieldShell {
  private readonly mats = new Map<string, { mat: THREE.MeshBasicMaterial; thick: { value: number }; scale: number }>();
  private readonly parts: Array<{ copy: THREE.Mesh; src: THREE.Mesh }> = [];
  private sources = 0;
  private width = 0.012;
  private readonly u = {
    amt: { value: 0 },
    color: { value: new THREE.Color() },
    hit: { value: new THREE.Vector3() },
    spot: { value: 0 },
    fill: { value: 0.25 },
    rim: { value: 1 },
  };

  constructor(
    private readonly root: THREE.Object3D,
    private readonly skip: THREE.Object3D[],
  ) {}

  private matFor(scale: number): THREE.MeshBasicMaterial {
    const key = scaleKey(scale);
    let m = this.mats.get(key);
    if (!m) {
      const thick = { value: this.width / scale };
      const mat = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, forceSinglePass: true });
      const u = this.u;
      mat.onBeforeCompile = (s) => {
        s.uniforms.uThick = thick;
        s.uniforms.uAmt = u.amt;
        s.uniforms.uColor = u.color;
        s.uniforms.uHit = u.hit;
        s.uniforms.uSpot = u.spot;
        s.uniforms.uFill = u.fill;
        s.uniforms.uRim = u.rim;
        s.vertexShader = s.vertexShader
          .replace("#include <common>", "#include <common>\nuniform float uThick;\nvarying float vFres;\nvarying vec3 vWorld;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed += normalize(normal) * uThick;")
          .replace(
            "#include <project_vertex>",
            [
              "#include <project_vertex>",
              "#ifdef USE_SKINNING",
              "vec3 fN = normalize(normalMatrix * objectNormal);",
              "#else",
              "vec3 fN = normalize(normalMatrix * normal);",
              "#endif",
              "vFres = 1.0 - abs(dot(fN, normalize(-mvPosition.xyz)));",
              "vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
            ].join("\n"),
          );
        s.fragmentShader = s.fragmentShader
          .replace("#include <common>", "#include <common>\nuniform float uAmt;\nuniform vec3 uColor;\nuniform vec3 uHit;\nuniform float uSpot;\nuniform float uFill;\nuniform float uRim;\nvarying float vFres;\nvarying vec3 vWorld;")
          .replace(
            "#include <dithering_fragment>",
            [
              "#include <dithering_fragment>",
              "vec3 dh = vWorld - uHit;",
              "float sp = uSpot > 0.0 ? exp(-dot(dh, dh) / (uSpot * uSpot)) : 0.0;",
              "gl_FragColor = vec4(uColor * uAmt * (uFill + uRim * vFres * vFres + sp), 1.0);",
            ].join("\n"),
          );
      };
      m = { mat, thick, scale };
      this.mats.set(key, m);
    }
    return m.mat;
  }

  private build(): void {
    for (const p of this.parts) p.copy.removeFromParent();
    this.parts.length = 0;
    const list = figureMeshes(this.root, this.skip);
    this.sources = list.length;
    for (const src of list) this.parts.push({ copy: copyOf(src, this.matFor(scaleOf(src))), src });
  }

  /**
   * Two hidden meshes in its material, a plain one and a skinned one, for the page's warm to build its two shaders with
   * the rest (main.ts): a figure's own shell is made at its first shield hit, and its shader was built on that frame. The
   * shaders are shared by every shell after (the same code, the same kind of mesh)
   */
  static warmKit(): THREE.Group {
    const g = new THREE.Group();
    g.name = "shell-warm";
    const mat = new ShieldShell(g, []).matFor(1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0.01, 0, 0, 0, 0.01, 0], 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4));
    geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    const plain = new THREE.Mesh(geo, mat);
    const bone = new THREE.Bone();
    const skinned = new THREE.SkinnedMesh(geo, mat);
    skinned.add(bone);
    skinned.bind(new THREE.Skeleton([bone]));
    for (const m of [plain, skinned]) {
      m.visible = false;
      m.frustumCulled = false;
      m.userData.dynamic = true;
    }
    g.add(plain, skinned);
    return g;
  }

  /**
   * At `amount` (0 off) in `color`: `fill` over the whole shape, `rim` more at its edges, and `spot` metres round `hit`
   * brighter (0, no spot), `width` metres out from the figure
   */
  show(amount: number, color: number, look: { fill: number; rim: number; spot: number; width: number }, hit: THREE.Vector3 | null = null): void {
    const on = amount > 0.001;
    if (on && figureMeshes(this.root, this.skip).length !== this.sources) this.build();
    this.u.amt.value = amount;
    this.u.color.value.setHex(color);
    this.u.fill.value = look.fill;
    this.u.rim.value = look.rim;
    this.u.spot.value = hit ? look.spot : 0;
    if (hit) this.u.hit.value.copy(hit);
    if (look.width !== this.width) {
      this.width = look.width;
      for (const m of this.mats.values()) m.thick.value = look.width / m.scale;
    }
    for (const p of this.parts) p.copy.visible = on && shownIn(p.src, this.root);
  }

  /** how many of its copies are drawn, at what amount and colour (tools/e2e.ts) */
  state(): { on: number; amount: number; color: number } {
    return { on: this.parts.filter((p) => p.copy.visible).length, amount: this.u.amt.value, color: this.u.color.value.getHex() };
  }

  dispose(): void {
    for (const p of this.parts) p.copy.removeFromParent();
    this.parts.length = 0;
    for (const m of this.mats.values()) m.mat.dispose();
    this.mats.clear();
  }
}
