/**
 * The bought guns on SpeedKills' guns (Phase 21 W3, src/config/paidweapons.json). The procedural model stays as
 * the gun's skeleton, since everything that moves a gun reads it (the muzzle, the sight line, the hand placements,
 * the magazine, bolt and pump groups the reload and the cycle animate), and its meshes are hidden under the bought
 * model: turned to point down -Z as the game's guns do (the pack's forward is +Z, measured), its grip on the
 * procedural grip, the muzzle and the sight line moved to the bought model's own (measured), and its moving parts
 * (Clip, Slide or Slider, Pump) put in the procedural groups, so a reload takes its real magazine out.
 *
 * Loaded once at the start of a SpeedKills page when the files are here; without them, or before they are in, the
 * guns are the procedural ones.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import cfg from "../config/paidweapons.json";
import type { GunModel } from "./gunmodels";

interface Gun {
  model: string;
  skins: string[];
  measured: { length: number; muzzleEnd: number; muzzle: number[]; sightTop: number };
}
const GUNS = cfg.guns as Record<string, Gun>;
const PROPS = (cfg.props ?? {}) as Record<string, { model: string; skin: string }>;
const url = (p: string): string => `${p}?v=${cfg.version}`;

const scenes = new Map<string, THREE.Object3D>();
const skins = new Map<string, THREE.MeshStandardMaterial>();
let loading: Promise<boolean> | null = null;
let ready = false;

/** the bought guns are in (every mapped model and its first skin) */
export function paidGunsReady(): boolean {
  return ready;
}

/** a skin's material, one per family and skin letter, shared by every gun wearing it */
function skinMaterial(family: string, skin: string, tl: THREE.TextureLoader): THREE.MeshStandardMaterial {
  const id = `${family}${skin}`;
  const had = skins.get(id);
  if (had) return had;
  const tex = (name: string, srgb: boolean): THREE.Texture => {
    const t = tl.load(url(`${cfg.textures}${id}_${name}.webp`));
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
  skins.set(id, mat);
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

/** load every mapped gun once (SpeedKills only); true when they are in */
export function loadPaidGuns(): Promise<boolean> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const first = Object.values(GUNS)[0];
      const probe = await fetch(url(`${cfg.models}${first.model}.glb`), { method: "HEAD" });
      if (!probe.ok || (probe.headers.get("content-type") ?? "").includes("text/html")) return false;
      const loader = new GLTFLoader();
      const models = [...new Set([...Object.values(GUNS).map((g) => g.model), ...Object.values(PROPS).map((p) => p.model)])];
      const got = await Promise.all(models.map((m) => loader.loadAsync(url(`${cfg.models}${m}.glb`)).then((g) => [m, g.scene] as const)));
      for (const [m, scene] of got) {
        // the collision hulls are never drawn
        const hulls: THREE.Object3D[] = [];
        scene.traverse((o) => {
          if (/^UCX_/.test(o.name)) hulls.push(o);
        });
        for (const h of hulls) h.removeFromParent();
        scenes.set(m, scene);
      }
      ready = true;
      return true;
    } catch (e) {
      console.warn("the bought guns did not load; the guns stay procedural", e);
      return false;
    }
  })();
  return loading;
}

/** a bought gun's skin at a fusion level, for its copy on the floor (loot.ts), or null when it wears none */
export function paidGunMaterial(id: string, level = 0): THREE.Material | null {
  const g = GUNS[id];
  if (!g || !scenes.get(g.model)) return null;
  return skinMaterial(g.model.replace(/_\d+$/, ""), skinFor(g, level), tl);
}

/** a prop from the pack (paidweapons.json props: the mine), in its skin, or null when it is not in */
export function paidProp(key: string): THREE.Object3D | null {
  const p = PROPS[key];
  const src = p ? scenes.get(p.model) : undefined;
  if (!p || !src) return null;
  const mat = skinMaterial(p.model.replace(/_\d+$/, ""), p.skin, tl);
  const o = src.clone(true);
  o.traverse((x) => {
    const m = x as THREE.Mesh;
    if (m.isMesh) {
      m.material = mat;
      m.castShadow = true;
    }
  });
  return o;
}

/** the skin letter for a fusion level: as found, levels 2 to 3, levels 4 to 5 */
function skinFor(g: Gun, level: number): string {
  return g.skins[level >= 4 ? 2 : level >= 2 ? 1 : 0] ?? "A";
}

const tl = new THREE.TextureLoader();

/**
 * Dress a procedural gun model in its bought one, when there is one and it is in: the procedural meshes hidden,
 * the bought model in their place, and the gun's muzzle and sight line moved to the bought model's.
 */
export function dressPaid(m: GunModel, level = 0): boolean {
  const g = GUNS[m.id];
  const src = g ? scenes.get(g.model) : undefined;
  if (!g || !src) return false;
  // the procedural look off; its groups stay, since the animations move them
  m.root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.visible = false;
  });
  const family = g.model.replace(/_\d+$/, "");
  const mat = skinMaterial(family, skinFor(g, level), tl);
  const model = src.clone(true);
  model.name = `paid:${g.model}`;
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.visible = true;
    const name = (mesh.material as THREE.Material).name;
    mesh.material = /Dot/i.test(name) ? dotMaterial(name) : mat;
    mesh.castShadow = true;
  });
  // the pack points down +Z (measured, muzzleEnd), the game's guns down -Z: a half turn about Y; its origin, at the
  // pack's grip, on the procedural grip (the hand's centre, forward f along -Z and up u)
  const place = new THREE.Group();
  place.name = "paid";
  if (g.measured.muzzleEnd > 0) place.rotation.y = Math.PI;
  place.position.set(m.grip.x ?? 0, m.grip.u, -m.grip.f);
  place.add(model);
  m.root.add(place);
  place.updateMatrixWorld(true);
  // the muzzle and the sight line, from the bought model's measurements, in the procedural gun's space
  const muz = new THREE.Vector3().fromArray(g.measured.muzzle).applyMatrix4(place.matrix);
  m.muzzle.copy(muz);
  m.sightY = m.grip.u + g.measured.sightTop;
  // a fitted optic sits on the bought gun's top, not at the procedural rail, where it hung in the air
  m.railY = m.sightY;
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
  mover(/^Clip/, m.mag);
  mover(/^(Slide|Slider)$/, m.bolt);
  mover(/^Pump$/, m.pump);
  if (m.irons) m.irons.visible = false;
  m.root.userData.paid = g.model;
  m.root.userData.paidLevel = level;
  setPaidLevel(m, level);
  return true;
}

/**
 * A bought gun's fusion level shown on it: its skin (as found, levels 2 to 3, levels 4 to 5, in the order
 * paidweapons.json gives each gun) and its glow, which brightens a step each level, so a fused gun is visibly the
 * better one in a hand and on the floor.
 */
export function setPaidLevel(m: GunModel, level: number): void {
  const g = GUNS[m.id];
  if (!g || !m.root.userData.paid) return;
  const family = g.model.replace(/_\d+$/, "");
  const base = skinMaterial(family, skinFor(g, level), tl);
  // one material a gun and level, so a brighter glow on one gun does not light every gun of its skin
  const key = `${family}${skinFor(g, level)}:${level}`;
  let mat = levelled.get(key);
  if (!mat) {
    mat = base.clone();
    mat.emissiveIntensity = cfg.glow[Math.max(0, Math.min(cfg.glow.length - 1, level))];
    levelled.set(key, mat);
  }
  m.root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || /Dot/i.test((mesh.material as THREE.Material).name)) return;
    if (mesh.userData.procedural) return;
    if ((mesh.material as THREE.Material).name.startsWith(family)) mesh.material = mat;
  });
  m.root.userData.paidLevel = level;
}
const levelled = new Map<string, THREE.MeshStandardMaterial>();
