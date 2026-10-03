/**
 * The bought guns on SpeedKills' guns (Phase 21 W3, src/config/paidweapons.json). The procedural model stays as
 * the gun's skeleton, since everything that moves a gun reads it (the muzzle, the sight line, the hand placements,
 * the magazine, bolt and pump groups the reload and the cycle animate), and its meshes are hidden under the bought
 * model: turned to point down -Z as the game's guns do (the pack's forward is +Z, measured), its grip on the
 * procedural grip, the muzzle and the sight line moved to the bought model's own (measured), and its moving parts
 * (Clip, Slide or Slider, Pump) put in the procedural groups, so a reload takes its real magazine out. The pack gives
 * its guns split into parts and no animations: the rest of the parts (a trigger, the launcher's drum, the sniper's
 * wheels, a loading gate) are hinged at their measured edges (PaidParts), and the viewmodel moves them.
 *
 * Loaded once at the start of a SpeedKills page when the files are here; without them, or before they are in, the
 * guns are the procedural ones.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import cfg from "../config/paidweapons.json";
import measuredCfg from "../config/paidmodels.json";
import type { GunModel, PaidParts } from "./gunmodels";

interface Gun {
  model: string;
  skins: string[];
  /** a sight from another model of the pack (paidweapons.json _mount) */
  mount?: { from: string; part: string; z: number };
}
const GUNS = cfg.guns as Record<string, Gun>;
/** every model of each gun's family, measured (tools/checks/paid-weapons.ts writes it) */
const MEASURED = measuredCfg.models as Record<
  string,
  { measured: { length: number; muzzleEnd: number; muzzle: number[]; sightTop: number; sightZ: number; eye: { y: number; back: number; sight: string }; support?: { y: number; z: number } } }
>;
/** how far in front of the eye a bought gun's iron sights come when aimed (paidweapons.json sights) */
export const IRONS_EYE: number = cfg.sights.ironsEye;
/** and a bought scope's reticle dot (paidweapons.json sights) */
export const DOT_EYE: number = cfg.sights.dotEye;
/** how the parts move (paidweapons.json motion) */
export const PAID_MOTION = cfg.motion;
const PROPS = (cfg.props ?? {}) as Record<string, { model: string; skin: string; scale?: number; lid?: string; open?: number }>;
const url = (p: string): string => `${p}?v=${cfg.version}`;

const scenes = new Map<string, THREE.Object3D>();
const skins = new Map<string, THREE.MeshStandardMaterial>();
let loading: Promise<boolean> | null = null;
let ready = false;

/** the bought guns are in (every mapped model and its first skin) */
export function paidGunsReady(): boolean {
  return ready;
}

/**
 * a skin's material, one per family and skin letter, shared by every gun wearing it; `hi`, its textures at 2048 (the
 * gun in your hands on High: paidweapons.json textures2k)
 */
function skinMaterial(family: string, skin: string, tl: THREE.TextureLoader, hi = false): THREE.MeshStandardMaterial {
  const id = `${family}${skin}`;
  const had = skins.get(hi ? `${id}@2k` : id);
  if (had) return had;
  const tex = (name: string, srgb: boolean): THREE.Texture => {
    const t = tl.load(url(`${hi ? cfg.textures2k : cfg.textures}${id}_${name}.webp`));
    t.flipY = false;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const orm = tex("orm", false);
  const mat = new THREE.MeshStandardMaterial({
    name: id,
    map: tex("color", true),
    normalMap: tex("normal", false),
    aoMap: orm,
    roughnessMap: orm,
    metalnessMap: orm,
    roughness: 1,
    metalness: 1,
    emissiveMap: tex("emit", true),
    emissive: new THREE.Color(1, 1, 1),
  });
  skins.set(hi ? `${id}@2k` : id, mat);
  return mat;
}

/** a scope's reticle: the pack's dot texture, added over whatever is seen through the lens, as a real one glows */
const dots = new Map<string, THREE.MeshBasicMaterial>();
function dotMaterial(name: string): THREE.MeshBasicMaterial {
  const had = dots.get(name);
  if (had) return had;
  const t = new THREE.TextureLoader().load(url(`${cfg.textures}${name}.webp`));
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  dots.set(name, m);
  return m;
}

/** a gun's models: its own and the one its mount is taken from */
const modelsOf = (id: string): string[] => {
  const g = GUNS[id];
  return g ? [g.model, ...(g.mount ? [g.mount.from] : [])] : [];
};
/** the files are here (the HEAD probe, asked once: a checkout without the bought files has none) */
let present: Promise<boolean> | null = null;
const probe = (): Promise<boolean> =>
  (present ??= fetch(url(`${cfg.models}${Object.values(GUNS)[0].model}.glb`), { method: "HEAD" })
    .then((r) => r.ok && !(r.headers.get("content-type") ?? "").includes("text/html"))
    .catch(() => false));
const gltfs = new GLTFLoader();
/** each model's load, asked once (the rest is asked for while the guns in your hands may still be coming) */
const asked = new Map<string, Promise<void>>();
/** `models` loaded into `scenes` */
function loadModels(models: string[]): Promise<unknown> {
  return Promise.all(
    [...new Set(models)].map((m) => {
      let p = asked.get(m);
      if (!p) {
        p = gltfs.loadAsync(url(`${cfg.models}${m}.glb`)).then((g) => {
          // the collision hulls are never drawn
          const hulls: THREE.Object3D[] = [];
          g.scene.traverse((o) => {
            if (/^UCX_/.test(o.name)) hulls.push(o);
          });
          for (const h of hulls) h.removeFromParent();
          scenes.set(m, g.scene);
        });
        asked.set(m, p);
      }
      return p;
    }),
  );
}

/**
 * The bought guns in `first` (SpeedKills only: the guns in your hands); true when they are in. The rest, the armory's
 * and the floor's guns and the cases, by loadPaidRest: the page's first screen waited for all fourteen files and their
 * skins, 10.5 MB, and the range's first frame shows two (2026-10-03). A gun not in yet stays procedural (dressPaid).
 */
export function loadPaidGuns(first: string[] = Object.keys(GUNS)): Promise<boolean> {
  if (loading) return loading;
  loading = (async () => {
    try {
      if (!(await probe())) return false;
      await loadModels(first.flatMap(modelsOf));
      if (first.length >= Object.keys(GUNS).length) await loadPaidRest();
      return true;
    } catch (e) {
      console.warn("the bought guns did not load; the guns stay procedural", e);
      return false;
    }
  })();
  return loading;
}

let rest: Promise<boolean> | null = null;
/** every other bought gun and the props (the armory's cases, the hack cores, the bins); paidGunsReady() after */
export function loadPaidRest(): Promise<boolean> {
  rest ??= (async () => {
    try {
      if (!(await probe())) return false;
      await loadModels([...Object.keys(GUNS).flatMap(modelsOf), ...Object.values(PROPS).map((p) => p.model)]);
      ready = true;
      return true;
    } catch (e) {
      console.warn("the bought guns did not load; the guns stay procedural", e);
      return false;
    }
  })();
  return rest;
}

/** a bought gun's skin at a fusion level, for its copy on the floor (loot.ts), or null when it wears none */
export function paidGunMaterial(id: string, level = 0): THREE.Material | null {
  const g = GUNS[id];
  if (!g || !scenes.get(g.model)) return null;
  return skinMaterial(g.model.replace(/_\d+$/, ""), skinFor(id, level), tl);
}

const merged = new Map<string, THREE.BufferGeometry>();
const tinted = new Map<string, THREE.MeshStandardMaterial>();

/**
 * A prop in one geometry and a material, to be drawn many times in one call (loot.ts batches the hack cores): its
 * meshes merged in its own space at its scale, and its skin with its glow in `glow`'s colour; null when it is not in
 */
export function paidPropBatch(key: string, glow: number): { geo: THREE.BufferGeometry; mat: THREE.Material } | null {
  const p = PROPS[key];
  const src = p ? scenes.get(p.model) : undefined;
  if (!p || !src) return null;
  let geo = merged.get(key);
  if (!geo) {
    src.updateMatrixWorld(true);
    const parts: THREE.BufferGeometry[] = [];
    src.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
      for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
      parts.push(g.index ? g.toNonIndexed() : g);
    });
    geo = parts.length === 1 ? parts[0] : mergeGeometries(parts)!;
    geo.scale(p.scale ?? 1, p.scale ?? 1, p.scale ?? 1);
    merged.set(key, geo);
  }
  const mk = `${key}:${glow}`;
  let mat = tinted.get(mk);
  if (!mat) {
    mat = skinMaterial(p.model.replace(/_\d+$/, ""), p.skin, tl).clone();
    mat.emissive.setHex(glow);
    mat.emissiveIntensity = 2.2;
    tinted.set(mk, mat);
  }
  return { geo, mat };
}

/** a prop is in (its model loaded), without making a copy of it */
export function paidPropReady(key: string): boolean {
  const p = PROPS[key];
  return !!p && scenes.has(p.model);
}

/** a prop's opening part (paidweapons.json props lid) turned open or shut, about its own hinge */
export function setPropOpen(o: THREE.Object3D, key: string, open: boolean): void {
  const p = PROPS[key];
  const lid = p?.lid ? o.getObjectByName(p.lid) : undefined;
  if (lid) lid.rotation.x = open ? (p.open ?? -1.5) : 0;
}

/** a prop from the pack (paidweapons.json props: the mine), in its skin, or null when it is not in */
export function paidProp(key: string): THREE.Object3D | null {
  const p = PROPS[key];
  const src = p ? scenes.get(p.model) : undefined;
  if (!p || !src) return null;
  const mat = skinMaterial(p.model.replace(/_\d+$/, ""), p.skin, tl);
  const o = src.clone(true);
  o.scale.setScalar(p.scale ?? 1);
  o.traverse((x) => {
    const m = x as THREE.Mesh;
    if (m.isMesh) {
      m.material = mat;
      m.castShadow = true;
    }
  });
  return o;
}

/** the skin letter for a fusion level, in the order paidweapons.json gives the gun: levels 0 to 1, 2 to 3, 4 to 5 */
function skinFor(id: string, level: number): string {
  return GUNS[id]?.skins[level >= 4 ? 2 : level >= 2 ? 1 : 0] ?? "A";
}

const tl = new THREE.TextureLoader();

/**
 * Dress a procedural gun model in its bought one, when there is one and it is in: the procedural meshes hidden,
 * the bought model in their place, and the gun's muzzle and sight line moved to the bought model's. One model a gun
 * (paidweapons.json guns), its skin its fusion level's.
 */
export function dressPaid(m: GunModel, level = 0): boolean {
  const g = GUNS[m.id];
  const name = g?.model ?? null;
  const src = name ? scenes.get(name) : undefined;
  const size = name ? MEASURED[name]?.measured : undefined;
  if (!g || !name || !src || !size) return false;
  // the procedural look off; its groups stay, since the animations move them
  m.root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.visible = false;
  });
  const family = name.replace(/_\d+$/, "");
  const mat = skinMaterial(family, skinFor(m.id, level), tl);
  const model = src.clone(true);
  model.name = `paid:${name}`;
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.visible = true;
    const name = (mesh.material as THREE.Material).name;
    mesh.userData.dot = /Dot/i.test(name) ? name : undefined;
    mesh.material = mesh.userData.dot ? dotMaterial(name) : mat;
    mesh.castShadow = true;
  });
  // a sight from another model, on a gun with irons alone (paidweapons.json mount)
  const mounted = g.mount ? mountSight(model, g.mount, skinFor(m.id, level)) : null;
  // the pack points down +Z (measured, muzzleEnd), the game's guns down -Z: a half turn about Y; its origin, at the
  // pack's grip, on the procedural grip (the hand's centre, forward f along -Z and up u)
  const place = new THREE.Group();
  place.name = "paid";
  if (size.muzzleEnd > 0) place.rotation.y = Math.PI;
  place.position.set(m.grip.x ?? 0, m.grip.u, -m.grip.f);
  place.add(model);
  m.root.add(place);
  place.updateMatrixWorld(true);
  // the muzzle and the sight line, from the bought model's measurements, in the procedural gun's space
  const muz = new THREE.Vector3().fromArray(size.muzzle).applyMatrix4(place.matrix);
  m.muzzle.copy(muz);
  // The gun's own sights, which it is aimed down (paidmodels.json eye, measured): its scope's reticle dot, the sniper's
  // scope, or its irons. A fitted optic never goes on top of them (viewmodel fitOptic): ours on top stood over the
  // rifle's and the steady SMG's scopes, the launcher's sights and USSO's irons, and made two scopes of the sniper's
  const own = mounted ?? size.eye;
  const eye = new THREE.Vector3(0, own.y, own.back).applyMatrix4(place.matrix);
  m.sightY = m.railY = eye.y;
  m.rearF = m.opticF = -eye.z;
  m.root.userData.ownSight = { y: eye.y, f: -eye.z, irons: own.sight === "irons", dot: own.sight === "dot" };
  // the support hand under the bought gun, where paidweapons.json support holds it (measured, paidmodels.json), 22 mm
  // above the underside as the procedural hand sits over its handguard's: it was where the procedural handguard had
  // been, on the USSO over the top of the bought gun and, aimed, beside the rear sight by the eye
  if (size.support) {
    const hold = new THREE.Vector3(0, size.support.y, size.support.z).applyMatrix4(place.matrix);
    m.support = { ...m.support, f: -hold.z, u: hold.y + 0.022, x: 0 };
  }
  // its moving parts into the procedural groups the animations move, kept where they are
  const mover = (re: RegExp, group: THREE.Group | null) => {
    if (!group) return;
    const parts: THREE.Object3D[] = [];
    model.traverse((o) => {
      if (re.test(o.name) && (o as THREE.Mesh).isMesh) parts.push(o);
    });
    for (const p of parts) group.attach(p);
  };
  m.root.updateMatrixWorld(true);
  const clips: THREE.Object3D[] = [];
  model.traverse((o) => {
    if (/^Clip/.test(o.name) && (o as THREE.Mesh).isMesh) clips.push(o);
  });
  if (clips.length) {
    // a gun whose procedural model has no magazine (HAEFY's tube) takes out its bought model's on a reload
    if (!m.mag) {
      m.mag = new THREE.Group();
      m.mag.name = "mag";
      m.root.add(m.mag);
      m.reload = "mag";
    }
    // the support hand goes to the bought magazine's bottom, not the procedural one's (measured off the part)
    const box = new THREE.Box3();
    for (const c of clips) box.union(boxIn(m.root, c));
    m.magBottom.set((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
  }
  // the charging handle, where the support hand takes it to rack it (viewmodel feelFrame): the top of its middle
  {
    const box = new THREE.Box3();
    model.traverse((o) => {
      if (/^(Slide|Slider)$/.test(o.name)) o.traverse((c) => void ((c as THREE.Mesh).isMesh && box.union(boxIn(m.root, c))));
    });
    m.boltGrip = box.isEmpty() ? undefined : new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
  }
  mover(/^Clip/, m.mag);
  mover(/^(Slide|Slider)$/, m.bolt);
  mover(/^Pump$/, m.pump);
  m.parts = hingeParts(model, size.muzzleEnd);
  if (m.irons) m.irons.visible = false;
  m.root.userData.paid = name;
  m.root.userData.paidLevel = level;
  setPaidLevel(m, level);
  return true;
}

/** a part's own geometry's box (not its children's) in another object's space */
function boxIn(space: THREE.Object3D, o: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  const pos = (o as THREE.Mesh).geometry?.getAttribute("position");
  if (!pos) return box;
  const to = new THREE.Matrix4().copy(space.matrixWorld).invert().multiply(o.matrixWorld);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(to));
  return box;
}

/**
 * The pack's other moving parts, each put in a pivot at its hinge, found off the part's own geometry (the pack's
 * origins are not always hinges: the auto shotgun's parts all sit at the gun's origin): a trigger swings from its
 * top, a loading gate from its front top edge; the drum turns about its centre, and a wheel, a button and the
 * extruder move about theirs.
 */
export function hingeParts(model: THREE.Object3D, end: number): PaidParts {
  model.updateMatrixWorld(true);
  const find = (re: RegExp): THREE.Object3D[] => {
    const out: THREE.Object3D[] = [];
    model.traverse((o) => {
      if (re.test(o.name) && (o as THREE.Mesh).isMesh) out.push(o);
    });
    return out;
  };
  const hinge = (o: THREE.Object3D | undefined, at: (b: THREE.Box3, c: THREE.Vector3) => THREE.Vector3): THREE.Object3D | null => {
    if (!o) return null;
    const b = boxIn(model, o);
    const pivot = new THREE.Group();
    pivot.name = `hinge:${o.name}`;
    pivot.position.copy(at(b, b.getCenter(new THREE.Vector3())));
    pivot.userData.base = pivot.position.clone();
    model.add(pivot);
    pivot.updateMatrixWorld(true);
    pivot.attach(o);
    return pivot;
  };
  const drumPart = find(/^Drum$/)[0];
  // the drum turns a chamber a shot: the angle between its rounds, counted
  const rounds = drumPart ? drumPart.children.filter((c) => /^Grenade/.test(c.name)).length : 0;
  const buttonPart = find(/^Button$/)[0];
  const buttonX = buttonPart ? boxIn(model, buttonPart).getCenter(new THREE.Vector3()).x : 0;
  return {
    end,
    trigger: hinge(find(/^Trigger$/)[0], (b, c) => c.setY(b.max.y)),
    drum: rounds > 1 ? hinge(drumPart, (_b, c) => c) : null,
    drumStep: rounds > 1 ? (Math.PI * 2) / rounds : 0,
    spinners: find(/^Spinner\d+$/).map((o) => hinge(o, (_b, c) => c)!),
    cover: hinge(find(/^Cover$/)[0], (b, c) => c.set(c.x, b.max.y, end > 0 ? b.max.z : b.min.z)),
    round: hinge(find(/^Bullet$/)[0], (_b, c) => c),
    button: hinge(buttonPart, (_b, c) => c),
    buttonIn: -Math.sign(buttonX),
    extruder: hinge(find(/^Extruder$/)[0], (_b, c) => c),
  };
}

const glassless = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();

/**
 * A bought scope's glass cut out, on the gun in the hand only (viewmodel setWeapon): the pack paints its lenses on,
 * opaque, so aimed down the rifle's own scope the target was behind a blue disc. The glass is the faces of a scope
 * part (paidweapons.json sights) that face along the gun, inside its rim: every corner within 85% of the part's half
 * height of its middle. The figures' and the floor's copies keep their glass, which is right from outside.
 */
export function openLenses(m: GunModel): void {
  const paid = m.root.getObjectByName("paid");
  if (!paid || m.root.userData.lensesOpen) return;
  m.root.userData.lensesOpen = true;
  paid.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(paid.children[0].matrixWorld).invert();
  const part = new RegExp(cfg.sights.parts);
  paid.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !/^Scope/.test(mesh.name) || /Dot/i.test((mesh.material as THREE.Material).name) || !part.test(mesh.name)) return;
    const src = mesh.geometry;
    let cut = glassless.get(src);
    if (!cut) {
      const toM = new THREE.Matrix4().multiplyMatrices(toModel, mesh.matrixWorld);
      const pos = src.getAttribute("position");
      const pts = Array.from({ length: pos.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(toM));
      const box = new THREE.Box3().setFromPoints(pts);
      const cy = (box.min.y + box.max.y) / 2;
      const rim = ((box.max.y - box.min.y) / 2) * 0.85;
      const inside = (v: THREE.Vector3) => Math.hypot(v.x, v.y - cy) < rim;
      const index = src.index ? Array.from(src.index.array) : Array.from({ length: pos.count }, (_, i) => i);
      const keep: number[] = [];
      const n = new THREE.Vector3();
      const tri = new THREE.Triangle();
      for (let t = 0; t < index.length; t += 3) {
        const [a, b, c] = [pts[index[t]], pts[index[t + 1]], pts[index[t + 2]]];
        tri.set(a, b, c).getNormal(n);
        const glass = Math.abs(n.z) > 0.8 && inside(a) && inside(b) && inside(c);
        if (!glass) keep.push(index[t], index[t + 1], index[t + 2]);
      }
      cut = src.clone();
      cut.setIndex(keep);
      glassless.set(src, cut);
    }
    mesh.geometry = cut;
  });
}

/** the parts that are not a gun's body: its moving parts and its sights */
const NOT_BODY = /^(Clip|Trigger|Drum|Grenade|Scope|FrontSight|RearSight|SightImage|Button|Bullet|Cover|Extruder|Slide|Slider|Pump|Spinner)/;

/** the top of a model's body within 3 cm along it of `z` and 2 cm of its centre line, in the model's own space */
function bodyTop(model: THREE.Object3D, z: number): number {
  model.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const to = new THREE.Matrix4();
  const v = new THREE.Vector3();
  let top = -Infinity;
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (let q: THREE.Object3D | null = mesh; q && q !== model; q = q.parent) if (NOT_BODY.test(q.name)) return;
    to.multiplyMatrices(inv, mesh.matrixWorld);
    const p = mesh.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(to);
      if (Math.abs(v.x) < 0.02 && Math.abs(v.z - z) < 0.03) top = Math.max(top, v.y);
    }
  });
  return top;
}

/**
 * Another model's sight part on this gun (paidweapons.json mount): its middle at `z` along the gun, sat into the gun's
 * top as far as it sits into its own gun's (both tops measured off the models), in its own model's skin at this gun's
 * level (setPaidLevel keeps it there). Returns the sight line it gives the gun, a dot's middle behind the part's back,
 * in the model's space; null when the other model is not in.
 */
function mountSight(model: THREE.Object3D, mount: { from: string; part: string; z: number }, skin: string): { y: number; back: number; sight: "dot" } | null {
  const srcScene = scenes.get(mount.from);
  const srcPart = srcScene?.getObjectByName(mount.part);
  if (!srcScene || !srcPart) return null;
  srcScene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(srcPart, true);
  const cz = (box.min.z + box.max.z) / 2;
  // how far below its own gun's top the part reaches (its clamp), kept on this gun
  const sink = bodyTop(srcScene, cz) - box.min.y;
  const dy = bodyTop(model, mount.z) - sink - box.min.y;
  const dz = mount.z - cz;
  const part = srcPart.clone(true);
  part.name = mount.part;
  new THREE.Matrix4().makeTranslation(0, dy, dz).multiply(srcPart.matrixWorld).decompose(part.position, part.quaternion, part.scale);
  const family = mount.from.replace(/_\d+$/, "");
  let dot: THREE.Mesh | null = null;
  part.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const name = (mesh.material as THREE.Material).name;
    mesh.visible = true;
    mesh.castShadow = true;
    if (/Dot/i.test(name)) {
      mesh.userData.dot = name;
      mesh.material = dotMaterial(name);
      dot = mesh;
    } else {
      mesh.userData.mountFamily = family;
      mesh.material = mountMaterial(family, skin, false);
    }
  });
  model.add(part);
  model.updateMatrixWorld(true);
  const partBox = new THREE.Box3().setFromObject(part, true).applyMatrix4(new THREE.Matrix4().copy(model.matrixWorld).invert());
  const dotBox = dot ? boxIn(model, dot) : partBox;
  return { y: (dotBox.min.y + dotBox.max.y) / 2, back: partBox.min.z, sight: "dot" };
}

const mountMats = new Map<string, THREE.MeshStandardMaterial>();
/**
 * a mounted sight's skin, drawn from both sides: lifted off its own gun, the sight is a shell whose inner faces that gun
 * hid, and seen from the USSO's hold the lower half of its frame and its base drew see-through (the owner, 2026-09-29:
 * "the sight's base has seethrough textures and the bottom half of the red dot sight has them as well"); a copy, so the
 * gun it came from is drawn as before
 */
function mountMaterial(family: string, skin: string, hi: boolean): THREE.MeshStandardMaterial {
  const key = `${family}|${skin}|${hi}`;
  let mat = mountMats.get(key);
  if (!mat) {
    mat = skinMaterial(family, skin, tl, hi).clone();
    mat.side = THREE.DoubleSide;
    mountMats.set(key, mat);
  }
  return mat;
}

const tintedDots = new Map<string, THREE.MeshBasicMaterial>();

/** a bought gun's reticle dots in a colour (viewmodel fitOptic: the fitted optic's), so the pack's white dot is a red dot */
export function tintDots(root: THREE.Object3D, color: string): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const name = mesh.isMesh ? (mesh.userData.dot as string | undefined) : undefined;
    if (!name) return;
    const key = `${name}|${color}`;
    let mat = tintedDots.get(key);
    if (!mat) {
      mat = dotMaterial(name).clone();
      mat.color.set(color).multiplyScalar(1.4);
      tintedDots.set(key, mat);
    }
    mesh.material = mat;
  });
}

/**
 * A bought gun's fusion level shown on it: its skin (as found, levels 2 to 3, levels 4 to 5, in the order
 * paidweapons.json gives each gun) and its glow, which brightens a step each level, so a fused gun is visibly the
 * better one in a hand and on the floor.
 */
export function setPaidLevel(m: GunModel, level: number, hi = false): void {
  const name = m.root.userData.paid as string | undefined;
  if (!GUNS[m.id] || !name) return;
  const family = name.replace(/_\d+$/, "");
  const skin = skinFor(m.id, level);
  const base = skinMaterial(family, skin, tl, hi);
  // one material a skin and level, so a brighter glow on one gun does not light every gun of its skin
  const key = `${family}${skin}:${level}${hi ? "@2k" : ""}`;
  let mat = levelled.get(key);
  if (!mat) {
    mat = base.clone();
    mat.emissiveIntensity = cfg.glow[Math.max(0, Math.min(cfg.glow.length - 1, level))];
    levelled.set(key, mat);
  }
  m.root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || mesh.userData.dot || /Dot/i.test((mesh.material as THREE.Material).name)) return;
    if (mesh.userData.procedural) return;
    // a sight from another model (mountSight) wears that model's skin at this level
    if (mesh.userData.mountFamily) {
      mesh.material = mountMaterial(mesh.userData.mountFamily as string, skin, hi);
      return;
    }
    if ((mesh.material as THREE.Material).name.startsWith(family)) mesh.material = mat;
  });
  m.root.userData.paidLevel = level;
  m.root.userData.paidHi = hi;
}
const levelled = new Map<string, THREE.MeshStandardMaterial>();
