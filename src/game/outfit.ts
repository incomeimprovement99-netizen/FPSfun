// What an operator is wearing, as clothes rather than as kit.
//
// src/game/gear.ts is the hard stuff strapped on top: plates, a helmet, a
// pack, a gas mask. This is what is under it. The difference matters because
// it is the clothes that say who somebody is: a man in fatigues and a man in a
// t-shirt and shorts read as two different people before you see a single
// piece of their kit, and our figures were all the same bare body in a
// different colour.
//
// The trick that makes this cheap: every bone in this rig points along its own
// +y with a measured length (thigh 0.400 m, calf 0.429, upper arm 0.274,
// forearm 0.273, measured off the rig itself). So a sleeve is a tube from 0 to
// a fraction of that length, hung on the bone, and it moves with the arm
// without being rigged or weighted to it. A garment that has to bend at a
// joint is a different kind of asset and a different pipeline; a garment made
// of one piece per bone is boxes and cylinders, which is what this is.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import outfitCfg from "../config/outfits.json";

/** the bones a garment can hang on, in the mannequin's rig */
export type WearBone = "spine_01" | "upperarm_l" | "upperarm_r" | "lowerarm_l" | "lowerarm_r" | "thigh_l" | "thigh_r" | "calf_l" | "calf_r" | "Head";

/** one garment, built and ready to hang */
export interface WornPiece {
  id: string;
  bone: WearBone;
  group: THREE.Group;
  /**
   * True when the piece is aligned to the FIGURE rather than to the bone. A
   * sleeve belongs to the arm and turns with it; a pair of goggles belongs to
   * the face and is authored the way a person would describe it, so the head's
   * pieces get the same rest-frame holder the kit does.
   */
  aligned: boolean;
}

export type OutfitId = keyof typeof outfitCfg.sets;

/** every outfit there is, in the order the pickers show them */
export const OUTFIT_IDS = Object.keys(outfitCfg.sets) as OutfitId[];

/** an outfit as a person would describe it: its name and what it is */
export function outfitInfo(id: OutfitId): { name: string; blurb: string } {
  const s = outfitCfg.sets[id];
  return { name: s.name, blurb: s.blurb };
}

const hex = (s: string): number => parseInt(s.replace("#", ""), 16);
const FIT = outfitCfg.fit;
const PIECES = outfitCfg.pieces as Record<string, { bone: string; from: number; to: number; over: number }>;
const HEAD = outfitCfg.head;

/** the lengths of the bones a garment hangs on, metres, measured off the rig */
const BONE_LEN: Record<string, number> = {
  spine_01: 0.265,
  upperarm: 0.274,
  lowerarm: 0.273,
  thigh: 0.4,
  calf: 0.429,
};

/** how thick the body is at each bone, metres */
const BODY_R: Record<string, number> = {
  upperarm: FIT.arm,
  lowerarm: FIT.forearm,
  thigh: FIT.thigh,
  calf: FIT.calf,
};

/** the pieces that come in pairs, and the bones they go on */
const SIDED = new Set(["upperarm", "lowerarm", "thigh", "calf"]);

/**
 * A tube along a bone: from `from` to `to` as fractions of the bone's own
 * length, at the body's thickness there plus the garment's own. Eight sides,
 * because a limb read as round at four and costs nothing at eight.
 */
function tube(bone: string, from: number, to: number, over: number, mat: THREE.Material): THREE.Mesh {
  const len = BONE_LEN[bone] ?? 0.3;
  const r = (BODY_R[bone] ?? 0.07) + over;
  const h = Math.max(0.02, (to - from) * len);
  const g = new THREE.CylinderGeometry(r, r * 1.02, h, 8, 1, false);
  g.translate(0, from * len + h / 2, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

/** the torso's own shell: a box along the spine, a little wider at the shoulders */
function torso(from: number, to: number, over: number, mat: THREE.Material): THREE.Mesh {
  const len = BONE_LEN.spine_01;
  const h = Math.max(0.05, (to - from) * len);
  const g = new THREE.BoxGeometry(FIT.torso.w + over * 2, h, FIT.torso.d + over * 2);
  // the spine bone runs up the BACK, so a garment centred on it sits behind
  // the body: the chest's own middle is measured off the rig (fit.torsoAt)
  g.translate(FIT.torsoAt[0], from * len + h / 2 + FIT.torsoAt[1], FIT.torsoAt[2]);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

/** the materials an outfit is made of */
export interface OutfitMats {
  cloth: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  boots: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
}

/** an outfit's colours, with the operator's own accent for the glass it wears */
export function outfitMaterials(id: OutfitId, visor: number, eye: number): OutfitMats {
  const s = outfitCfg.sets[id];
  return {
    cloth: new THREE.MeshStandardMaterial({ color: hex(s.cloth), roughness: 0.94, metalness: 0.02 }),
    trim: new THREE.MeshStandardMaterial({ color: hex(s.trim), roughness: 0.9, metalness: 0.05 }),
    boots: new THREE.MeshStandardMaterial({ color: hex(s.boots), roughness: 0.75, metalness: 0.08 }),
    glass: new THREE.MeshStandardMaterial({ color: visor, roughness: 0.14, metalness: 0.8, emissive: eye, emissiveIntensity: 0.1 }),
  };
}

/** a head wrap: a shell round the skull with a tail down the back */
function wrap(m: OutfitMats): THREE.Group {
  const c = HEAD.wrap;
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(c.radius, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), m.cloth);
  shell.scale.y = c.squash;
  shell.castShadow = true;
  g.add(shell);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(c.tail[0], c.tail[1], c.tail[2]), m.cloth);
  tail.position.set(c.tailAt[0], c.tailAt[1], c.tailAt[2]);
  tail.rotation.x = -0.25;
  tail.castShadow = true;
  g.add(tail);
  g.position.set(c.at[0], c.at[1], c.at[2]);
  return g;
}

/** goggles: two round lenses on a strap, which read as goggles where a flat bar reads as shades */
function goggles(m: OutfitMats): THREE.Group {
  const c = HEAD.goggles;
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(c.lens, c.lens, 0.022, 12), m.glass);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(side * c.gap, 0, 0);
    g.add(lens);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(c.lens, 0.009, 6, 14), m.trim);
    rim.position.set(side * c.gap, 0, 0.002);
    g.add(rim);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(c.gap * 2 - c.lens, 0.02, 0.02), m.trim);
  g.add(bridge);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(c.strap[0], c.strap[1], c.strap[2]), m.trim);
  strap.position.z = -0.06;
  g.add(strap);
  g.position.set(c.at[0], c.at[1], c.at[2]);
  return g;
}

/** a full-face mask: the whole face, not the nose and mouth the gas mask covers */
function fullMask(m: OutfitMats): THREE.Group {
  const c = HEAD.fullMask;
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.BoxGeometry(c.size[0], c.size[1], c.size[2]), m.trim);
  face.castShadow = true;
  g.add(face);
  const lens = new THREE.Mesh(new THREE.BoxGeometry(c.lens[0], c.lens[1], c.lens[2]), m.glass);
  lens.position.set(0, c.size[1] * 0.18, c.size[2] * 0.48);
  g.add(lens);
  const f = new THREE.Mesh(new THREE.CylinderGeometry(c.filter.r, c.filter.r, c.filter.len, 10), m.trim);
  f.rotation.x = Math.PI / 2;
  f.position.set(c.filter.at[0], c.filter.at[1], c.filter.at[2]);
  g.add(f);
  g.position.set(c.at[0], c.at[1], c.at[2]);
  return g;
}

/** one mesh per material: a sleeve and its cuff are one thing to draw */
function weld(group: THREE.Group): THREE.Group {
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const out = new THREE.Group();
  out.name = group.name;
  out.position.copy(group.position);
  out.quaternion.copy(group.quaternion);
  for (const child of group.children) {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) {
      out.add(child.clone(true));
      continue;
    }
    const g = mesh.geometry.clone();
    mesh.updateMatrix();
    g.applyMatrix4(mesh.matrix);
    const list = byMat.get(mesh.material as THREE.Material) ?? [];
    list.push(g);
    byMat.set(mesh.material as THREE.Material, list);
  }
  for (const [mat, list] of byMat) {
    const merged = list.length === 1 ? list[0] : mergeGeometries(list);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    out.add(mesh);
  }
  return out;
}

/**
 * Everything an outfit puts on a figure. `face` is what it wears on its head
 * on top of the set's own clothes, which is the operator's choice rather than
 * the outfit's: a wrap, goggles, a full mask, or nothing.
 */
export function buildOutfit(id: OutfitId, mats: OutfitMats, face: Array<"wrap" | "goggles" | "fullMask"> = []): WornPiece[] {
  const set = outfitCfg.sets[id];
  const out: WornPiece[] = [];
  for (const name of set.wears) {
    const p = PIECES[name];
    if (!p) continue;
    const mat = name === "boot" ? mats.boots : name === "cuff" ? mats.trim : mats.cloth;
    const make = (bone: WearBone, side: "" | "_l" | "_r"): void => {
      const g = new THREE.Group();
      g.name = `wear:${name}${side}`;
      g.add(p.bone === "spine_01" ? torso(p.from, p.to, p.over, mat) : tube(p.bone, p.from, p.to, p.over, mat));
      out.push({ id: name, bone, group: weld(g), aligned: false });
    };
    if (SIDED.has(p.bone)) {
      make(`${p.bone}_l` as WearBone, "_l");
      make(`${p.bone}_r` as WearBone, "_r");
    } else make(p.bone as WearBone, "");
  }
  for (const f of face) {
    const g = f === "wrap" ? wrap(mats) : f === "goggles" ? goggles(mats) : fullMask(mats);
    g.name = `wear:${f}`;
    out.push({ id: f, bone: "Head", group: weld(g), aligned: true });
  }
  return out;
}
