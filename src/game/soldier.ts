/**
 * The bought soldier (Phase 21 S3, src/config/soldier.json): loaded once when its files are here, its materials
 * rebuilt the way the pack's own shaders build them, and its pieces merged, per variant, into one skinned mesh per
 * material, so a figure costs four draws and not eighteen (thirty figures of eighteen pieces were 540 draws before
 * a shadow). mannequin.ts makes the figures from it; without the files it stays null and the figures are as before.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import cfg from "../config/soldier.json";

/** what a player chose: a variant and indexes into soldier.json's palettes, and the pieces turned off on top */
export interface SoldierLook {
  variant: string;
  armor: number;
  accent: number;
  suit: number;
  skin: number;
  eyes: number;
  /** the toggles (soldier.json toggles) turned off */
  off: string[];
}

export const SOLDIER_VARIANTS = Object.keys(cfg.variants) as Array<keyof typeof cfg.variants>;
export const SOLDIER_TOGGLES = Object.keys(cfg.toggles) as Array<keyof typeof cfg.toggles>;

/** a variant as it comes, its own colours */
export function lookOf(variant: string): SoldierLook {
  const v = (cfg.variants as Record<string, { armor: number; accent: number; suit: number }>)[variant] ?? cfg.variants.VANGUARD;
  return { variant: cfg.variants[variant as keyof typeof cfg.variants] ? variant : "VANGUARD", armor: v.armor, accent: v.accent, suit: v.suit, skin: 0, eyes: 1, off: [] };
}

/** a look as a short code, for the wire and for storage: "S" and one character a field (the wire's look field is 48 at most) */
export function soldierCode(l: SoldierLook): string {
  const vi = Math.max(0, SOLDIER_VARIANTS.indexOf(l.variant as never));
  const bits = SOLDIER_TOGGLES.reduce((a, t, i) => a | (l.off.includes(t) ? 1 << i : 0), 0);
  return `S${vi}${l.armor}${l.accent}${l.suit}${l.skin}${l.eyes}${bits}`;
}

/** a code back to a look, or null when it is not one */
export function readSoldierCode(code: string | null | undefined): SoldierLook | null {
  if (!code || !/^S\d{7}$/.test(code)) return null;
  const n = code.slice(1).split("").map(Number);
  const variant = SOLDIER_VARIANTS[n[0]];
  if (!variant) return null;
  const P = cfg.palettes;
  const clamp = (x: number, len: number) => Math.max(0, Math.min(len - 1, x));
  return {
    variant,
    armor: clamp(n[1], P.armor.length),
    accent: clamp(n[2], P.accent.length),
    suit: clamp(n[3], P.suit.length),
    skin: clamp(n[4], P.skin.length),
    eyes: Math.max(1, Math.min(P.eyes, n[5])),
    off: SOLDIER_TOGGLES.filter((_, i) => n[6] & (1 << i)),
  };
}

/** where the player's own choice is kept: SpeedKills' alone (the legacy game has no soldier) */
export const LS_SOLDIER = "range.sk.soldier";

/** the player's own soldier code, or null before they chose one (their operator's look is used then) */
export function mySoldierCode(): string | null {
  try {
    const c = localStorage.getItem(LS_SOLDIER);
    return readSoldierCode(c) ? c : null;
  } catch {
    return null;
  }
}

/** keep the player's choice */
export function saveMySoldier(l: SoldierLook): void {
  try {
    localStorage.setItem(LS_SOLDIER, soldierCode(l));
  } catch {
    /* storage refused: the choice lasts this page */
  }
}

/** a random look, for a bot */
export function randomLook(rng: () => number = Math.random): SoldierLook {
  const pick = (len: number) => Math.floor(rng() * len);
  const l = lookOf(SOLDIER_VARIANTS[pick(SOLDIER_VARIANTS.length)]);
  // half keep their variant's own colours, which read as that variant from afar
  if (rng() < 0.5) {
    l.armor = pick(cfg.palettes.armor.length);
    l.accent = pick(cfg.palettes.accent.length);
  }
  l.skin = pick(cfg.palettes.skin.length);
  l.eyes = 1 + pick(cfg.palettes.eyes);
  return l;
}

/**
 * A bot's soldier, the same on every machine: a random look (randomLook) seeded by the bot's id in the match, which
 * the host and every guest share. Bots had their operator's look, and a battle royale's 27 bots share six operators,
 * so they came in six looks (bots.ts on the host, duel.ts makeAvatar on a guest).
 */
export function botSoldierCode(id: number): string {
  // mulberry32, seeded from the id
  let a = Math.imul(id + 1, 2654435761) >>> 0;
  const rng = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return soldierCode(randomLook(rng));
}

const url = (p: string): string => `${p}?v=${cfg.version}`;

interface Asset {
  scene: THREE.Object3D;
  tex: Record<string, THREE.Texture>;
  eyes: THREE.Texture[];
}
let asset: Asset | null = null;
let loading: Promise<Asset | null> | null = null;

/** the soldier as loaded (its pieces unmerged, its head renamed), or null before it is in or without its files */
export function soldierAsset(): Asset | null {
  return asset;
}

/** load it once; null when its files are not here, and the figures stay as they were */
/**
 * A page served from the machine it runs on: a soldier file missing there is a checkout without the bought assets, not
 * a server part way through a deploy
 */
const LOCAL = typeof location !== "undefined" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

/**
 * The soldier, its files fetched, tried again after each of soldier.json retry.waits when a try fails: a page loaded
 * while a deploy swapped the files found them missing once and settled on the old figures for the whole session (the
 * owner, 2026-10-02: "we are the base model again?"). A file missing on a local server is no try at all.
 */
export function loadSoldier(): Promise<Asset | null> {
  if (loading) return loading;
  loading = (async () => {
    for (let i = 0; ; i++) {
      const got = await tryOnce(i === cfg.retry.waits.length);
      if (got !== "again") return got;
      if (i >= cfg.retry.waits.length) return null;
      await new Promise((ok) => setTimeout(ok, cfg.retry.waits[i] * 1000));
    }
  })();
  return loading;
}

/** one try at the soldier's files: the soldier, null when it is not there to be had, or "again" when a try may yet */
async function tryOnce(last: boolean): Promise<Asset | null | "again"> {
  try {
    // a missing file is the normal case in a checkout without the bought assets: ask first, quietly
    const head = await fetch(url(cfg.model), { method: "HEAD" });
    if (!head.ok || (head.headers.get("content-type") ?? "").includes("text/html")) return LOCAL || last ? null : "again";
    const g = await new GLTFLoader().loadAsync(url(cfg.model));
    const h = g.scene.getObjectByName(cfg.rename.from);
    if (h) h.name = cfg.rename.to;
    const tl = new THREE.TextureLoader();
    const load = (name: string, srgb: boolean): Promise<THREE.Texture> =>
      tl.loadAsync(url(`${cfg.textures}${name}.webp`)).then((t) => {
        t.flipY = false;
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = 4;
        return t;
      });
    const names: Array<[string, boolean]> = [];
    for (const m of ["armor", "body", "head"]) names.push([`${m}_color`, true], [`${m}_normal`, false], [`${m}_orm`, false], [`${m}_mask`, false]);
    names.push(["eyes_normal", false], ["eyes_orm", false]);
    const all = await Promise.all(names.map(([n, s]) => load(n, s)));
    const tex: Record<string, THREE.Texture> = {};
    names.forEach(([n], i) => (tex[n] = all[i]));
    const eyes = await Promise.all(Array.from({ length: cfg.palettes.eyes }, (_, i) => load(`eyes_color_${i + 1}`, true)));
    g.scene.scale.setScalar(cfg.scale);
    asset = { scene: g.scene, tex, eyes };
    return asset;
  } catch (e) {
    if (!last) return "again";
    console.warn("the soldier did not load; the figures stay as they were", e);
    return null;
  }
}

/** the pieces a look shows */
function shown(look: SoldierLook): Set<string> {
  const v = (cfg.variants as Record<string, { hide: string[] }>)[look.variant] ?? cfg.variants.VANGUARD;
  const off = new Set(v.hide);
  for (const t of look.off) for (const p of (cfg.toggles as Record<string, string[]>)[t] ?? []) off.add(p);
  return new Set(Object.keys(cfg.parts).filter((p) => !off.has(p)));
}

/** a piece's name: its own, or the named node it hangs in (a piece of two materials is a group of two meshes) */
function partOf(o: THREE.Object3D): string {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if ((cfg.parts as Record<string, string>)[p.name]) return p.name;
  return o.name;
}

const scenes = new Map<string, THREE.Object3D>();

/**
 * The soldier with a look's pieces, merged: one skinned mesh a material on one skeleton (the body's, since every
 * piece has its own skin). A skinned vertex lands at the sum over its bones of the bone's world matrix, its inverse
 * bind matrix and the mesh's bind matrix applied to it (three's attached bind mode cancels the mesh's own place), so
 * a piece can join the body's skeleton when its inverse bind matrices are the body's times one fixed matrix X (each
 * piece bound in its own node's frame): its vertices are taken through its bind matrix, X, and out of the body's.
 * Its bone indexes go onto the body's bones by name. A piece where X is not one matrix for all its bones is kept as
 * it was rather than merged wrong. Cached by the set of pieces.
 */
export function soldierScene(look: SoldierLook): THREE.Object3D | null {
  if (!asset) return null;
  const key = [...shown(look)].sort().join(",");
  const hit = scenes.get(key);
  if (hit) return hit;
  const root = mergeSoldier(asset.scene, look);
  scenes.set(key, root);
  return root;
}

/**
 * The collar behind the head brought down (soldier.json collar), as a function that edits a piece's geometry in the
 * body's bind space: measured off this model, so it holds for the soldier as loaded. Its frame is the bind pose's: up
 * from the pelvis to the head, left from the right shoulder to the left, forward from the two. The cut is `below` under
 * the head's lowest point behind the neck; above it a piece keeps `keep` of its height, all round the back and the
 * sides of the neck and not at its front (`front`, the cosine of the way out from the neck's line against straight
 * ahead). Null when a bone it measures by is missing.
 */
export function collarLowering(meshes: THREE.SkinnedMesh[], body: THREE.SkinnedMesh): ((g: THREE.BufferGeometry) => void) | null {
  const C = cfg.collar;
  const skel = body.skeleton;
  const toBody = body.bindMatrix.clone().invert();
  const at = (name: string): THREE.Vector3 | null => {
    const i = skel.bones.findIndex((b) => b.name === name);
    return i < 0 ? null : new THREE.Vector3().setFromMatrixPosition(toBody.clone().multiply(skel.boneInverses[i].clone().invert()));
  };
  const [pelvis, neck, head, ul, ur] = ["pelvis", "neck_01", "Head", "upperarm_l", "upperarm_r"].map(at);
  if (!pelvis || !neck || !head || !ul || !ur) return null;
  const up = head.clone().sub(pelvis).normalize();
  const left = ul.clone().sub(ur);
  left.addScaledVector(up, -left.dot(up)).normalize();
  const fwd = new THREE.Vector3().crossVectors(left, up).normalize();
  const neckZ = neck.clone().sub(pelvis).dot(fwd);
  const neckX = neck.clone().sub(pelvis).dot(left);
  // how far round toward the front of the neck a place is: the cosine of its way out from the neck's line against
  // straight ahead, -1 behind, 0 at the sides, 1 at the front
  const round = (d: THREE.Vector3): number => {
    const hx = d.dot(left) - neckX;
    const hz = d.dot(fwd) - neckZ;
    return hz / Math.max(1e-6, Math.hypot(hx, hz));
  };
  // the head's lowest point round the back and the sides (as far round as the collar is lowered): its own vertices,
  // weighted half and more to the Head bone. Behind the neck alone, the cut left the collar's sides over the bottom of
  // the head under the ear, seen from 30 degrees to a side
  let low = Infinity;
  const v = new THREE.Vector3();
  for (const m of meshes) {
    if (partOf(m) !== "head_eyes") continue;
    const h = m.skeleton.bones.findIndex((b) => b.name === "Head");
    if (h < 0) continue;
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    const si = m.geometry.attributes.skinIndex as THREE.BufferAttribute;
    const sw = m.geometry.attributes.skinWeight as THREE.BufferAttribute;
    const toB = toBody.clone().multiply(m.bindMatrix);
    for (let i = 0; i < pos.count; i++) {
      let w = 0;
      for (let c = 0; c < 4; c++) if (si.getComponent(i, c) === h) w += sw.getComponent(i, c);
      if (w < 0.5) continue;
      const d = v.fromBufferAttribute(pos, i).applyMatrix4(toB).sub(pelvis);
      if (round(d) <= C.front[1]) low = Math.min(low, d.dot(up));
    }
  }
  if (!Number.isFinite(low)) return null;
  const cut = low - C.below;
  return (g) => {
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const d = v.fromBufferAttribute(pos, i).sub(pelvis);
      const y = d.dot(up);
      if (y <= cut) continue;
      const t = Math.max(0, Math.min(1, (round(d) - C.front[0]) / (C.front[1] - C.front[0])));
      const k = 1 - (1 - t * t * (3 - 2 * t)) * (1 - C.keep);
      v.addScaledVector(up, cut + (y - cut) * k - y).add(pelvis);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
  };
}

/** the merge itself, on any loaded soldier (tools/checks/soldier.ts runs it in node) */
export function mergeSoldier(src: THREE.Object3D, look: SoldierLook): THREE.Object3D {
  const want = shown(look);
  src.updateMatrixWorld(true);
  const meshes: THREE.SkinnedMesh[] = [];
  src.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh);
  });
  const body = meshes.find((m) => partOf(m) === "body") ?? meshes[0];
  const skel = body.skeleton;
  const index = new Map(skel.bones.map((b, i) => [b.name, i]));
  const byMat = new Map<string, THREE.BufferGeometry[]>();
  const kept: THREE.SkinnedMesh[] = [];
  const m4 = new THREE.Matrix4();
  // the collar behind the head brought down, so the whole back of the head shows (soldier.json collar)
  const lowerCollar = collarLowering(meshes, body);
  for (const m of meshes) {
    if (!want.has(partOf(m))) continue;
    const mat = (m.material as THREE.Material).name;
    // X from its first bone, and every other bone of it must agree
    let x: THREE.Matrix4 | null = null;
    const agrees = m.skeleton.bones.every((b, i) => {
      const j = index.get(b.name);
      if (j === undefined) return false;
      m4.copy(skel.boneInverses[j]).invert().multiply(m.skeleton.boneInverses[i]);
      if (!x) {
        x = m4.clone();
        return true;
      }
      const xe = (x as THREE.Matrix4).elements;
      return m4.elements.every((e, k) => Math.abs(e - xe[k]) < 1e-3 * Math.max(1, Math.abs(e)));
    });
    if (!agrees || !x) {
      kept.push(m);
      continue;
    }
    const g = m.geometry.clone();
    g.applyMatrix4(body.bindMatrix.clone().invert().multiply(x).multiply(m.bindMatrix));
    if (lowerCollar && cfg.collar.parts.includes(partOf(m))) lowerCollar(g);
    const si = g.getAttribute("skinIndex");
    for (let v = 0; v < si.count; v++) for (let c = 0; c < 4; c++) si.setComponent(v, c, index.get(m.skeleton.bones[si.getComponent(v, c)].name) ?? 0);
    for (const a of Object.keys(g.attributes)) if (!["position", "normal", "uv", "skinIndex", "skinWeight"].includes(a)) g.deleteAttribute(a);
    byMat.set(mat, [...(byMat.get(mat) ?? []), g]);
  }
  // a new scene: the model's skeleton and axis turn, the merged meshes, and any piece that could not merge
  const root = src.clone(false) as THREE.Object3D;
  root.name = "soldier";
  const bonesRoot = skel.bones[0];
  let top: THREE.Object3D = bonesRoot;
  while (top.parent && top.parent !== src) top = top.parent;
  const topClone = cloneTree(top);
  root.add(topClone);
  const cloneBones = new Map<string, THREE.Bone>();
  topClone.traverse((o) => {
    if ((o as THREE.Bone).isBone) cloneBones.set(o.name, o as THREE.Bone);
  });
  const skeleton = new THREE.Skeleton(
    skel.bones.map((b) => cloneBones.get(b.name)!),
    skel.boneInverses.map((b) => b.clone())
  );
  for (const [mat, geos] of byMat) {
    const geo = mergeGeometries(geos, false);
    if (!geo) continue;
    const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({ name: mat }));
    mesh.name = `soldier:${mat}`;
    mesh.userData.soldierMaterial = mat;
    root.add(mesh);
    mesh.bind(skeleton, body.bindMatrix.clone());
  }
  for (const m of kept) {
    const c = m.clone();
    c.userData.soldierMaterial = (m.material as THREE.Material).name;
    root.add(c);
    c.bind(new THREE.Skeleton(m.skeleton.bones.map((b) => cloneBones.get(b.name)!), m.skeleton.boneInverses), m.bindMatrix);
  }
  return root;
}

/** a node and its children, cloned without their meshes */
function cloneTree(o: THREE.Object3D): THREE.Object3D {
  const c = o.clone(false);
  for (const ch of o.children) if (!(ch as THREE.Mesh).isMesh) c.add(cloneTree(ch));
  return c;
}

const lin = (hex: string): THREE.Color => new THREE.Color(hex);

/**
 * The material for one of the model's four slots, with a look's colours: the pack's multiply, a tint wherever
 * its mask is white (mask R the first tint, G the second), put in after the base colour is read. Each figure has
 * its own, so its colours are its own, and they share the textures.
 */
export function soldierMaterial(slot: string, look: SoldierLook): THREE.MeshStandardMaterial {
  const a = asset!;
  const P = cfg.palettes;
  const t = a.tex;
  const base = (m: string) => ({ map: t[`${m}_color`], normalMap: t[`${m}_normal`], aoMap: t[`${m}_orm`], roughnessMap: t[`${m}_orm`], metalnessMap: t[`${m}_orm`] });
  let maps: ReturnType<typeof base> | { map: THREE.Texture; normalMap: THREE.Texture; aoMap: THREE.Texture; roughnessMap: THREE.Texture; metalnessMap: THREE.Texture };
  let tintA = new THREE.Color(1, 1, 1);
  let tintB = new THREE.Color(1, 1, 1);
  let mask: THREE.Texture | null = null;
  if (slot === "M_armor") {
    maps = base("armor");
    mask = t.armor_mask;
    tintA = lin(P.armor[look.armor]);
    tintB = lin(P.accent[look.accent]);
  } else if (slot === "M_body") {
    maps = base("body");
    mask = t.body_mask;
    tintA = lin(P.suit[look.suit]);
  } else if (slot === "M_head") {
    maps = base("head");
    mask = t.head_mask;
    tintA = lin(P.skin[look.skin]);
  } else {
    maps = { map: a.eyes[Math.max(0, look.eyes - 1)] ?? a.eyes[0], normalMap: t.eyes_normal, aoMap: t.eyes_orm, roughnessMap: t.eyes_orm, metalnessMap: t.eyes_orm };
  }
  const mat = new THREE.MeshStandardMaterial({ name: slot, ...maps, roughness: 1, metalness: 1 });
  if (mask) {
    const u = { uTintA: { value: tintA }, uTintB: { value: tintB }, uMask: { value: mask } };
    mat.userData.tint = u;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uTintA;\nuniform vec3 uTintB;\nuniform sampler2D uMask;")
        .replace(
          "#include <map_fragment>",
          "#include <map_fragment>\n  vec4 skMask = texture2D( uMask, vMapUv );\n  diffuseColor.rgb *= mix( vec3( 1.0 ), uTintA, skMask.r ) * mix( vec3( 1.0 ), uTintB, skMask.g );"
        );
    };
    mat.customProgramCacheKey = () => "soldier-tint";
  }
  return mat;
}
