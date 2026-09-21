// The kit an operator wears: a vest, a pack, a helmet, shades, a gas mask, a
// hood, shoulder plates, thigh pouches, knee pads (src/config/gear.json).
//
// The figures were a bare mannequin in one colour. That is the single biggest
// reason they read as a toy: what you recognise about a soldier at 80 m is a
// silhouette made of a helmet, a vest, a mask and a pack, and a smooth body in
// grey has no silhouette but its own. The owner asked for clothes, shades and
// gas masks, and this is the shape of them.
//
// Every piece is built here from boxes, spheres and cylinders in the
// operator's own colours rather than downloaded. A prop can be a scan; a
// garment has to be rigged and weighted to the body that wears it, which is a
// different kind of asset and a different pipeline. Hard kit does not need
// that: a plate carrier does not deform, it is strapped to a chest, so it can
// hang off the chest bone and be right. Soft kit (the hood) is shaped so it
// stands off the head rather than lying on it, which is how a hood behaves and
// also why it does not have to bend.
//
// Which operator wears what is `OperatorSkin.extras` (src/game/operators.ts).
// The pieces name a bone each (`GearPiece.bone`), so the same kit fits the
// mannequin and, where the bones line up, anything else rigged like a person.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import gearCfg from "../config/gear.json";
import type { OperatorSkin } from "./operators";

/** which bone a piece hangs from, in the mannequin's rig */
export type GearBone = "Head" | "spine_03" | "pelvis" | "upperarm_l" | "upperarm_r" | "thigh_l" | "thigh_r" | "calf_l" | "calf_r";

export interface GearPiece {
  /** what it is, for the checks and the snapshots */
  id: string;
  bone: GearBone;
  group: THREE.Group;
}

/** every piece an operator can wear, in the order they are built */
export const GEAR_IDS = ["vest", "pack", "helmet", "shades", "mask", "hood", "brim", "shoulders", "pouches", "knees"] as const;
export type GearId = (typeof GEAR_IDS)[number];

const v3 = (a: readonly number[]): THREE.Vector3 => new THREE.Vector3(a[0], a[1], a[2]);

/** the materials a kit is made of, in one operator's colours */
export interface GearMats {
  /** webbing, pack cloth, straps: the soft dark things */
  cloth: THREE.MeshStandardMaterial;
  /** plates, helmet, pads: hard and a shade lighter */
  hard: THREE.MeshStandardMaterial;
  /** the operator's accent, for the trim that tells two of them apart at range */
  trim: THREE.MeshStandardMaterial;
  /** glass: shades, a mask's lenses */
  glass: THREE.MeshStandardMaterial;
}

/**
 * A kit's colours from the operator's own. The cloth is its joint colour (the
 * darkest thing it already has), the hard parts a step off its shell, and the
 * trim its accent: two operators in the same kit are then still told apart
 * across a street, which is the whole job of the accent.
 */
export function gearMaterials(s: OperatorSkin): GearMats {
  const shade = (hex: number, mul: number): number => {
    const c = new THREE.Color(hex);
    c.multiplyScalar(mul);
    return c.getHex();
  };
  return {
    cloth: new THREE.MeshStandardMaterial({ color: shade(s.joint, 1.25), roughness: 0.92, metalness: 0.05 }),
    // well darker than the body it is worn over: kit that is the same value as
    // the shell under it adds detail without adding an outline, and the
    // outline is the whole point
    hard: new THREE.MeshStandardMaterial({ color: shade(s.shell, 0.34), roughness: 0.6, metalness: 0.25 }),
    trim: new THREE.MeshStandardMaterial({ color: s.accent, roughness: 0.5, metalness: 0.3 }),
    glass: new THREE.MeshStandardMaterial({ color: s.visor, roughness: 0.12, metalness: 0.8, emissive: s.eye, emissiveIntensity: 0.12 }),
  };
}

const box = (size: readonly number[], m: THREE.Material, at: readonly number[] = [0, 0, 0]): THREE.Mesh => {
  const g = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), m);
  g.position.set(at[0], at[1], at[2]);
  g.castShadow = true;
  return g;
};

/** the pieces, one builder each. Each returns a group in its bone's own space */
const BUILD: Record<GearId, (m: GearMats) => { bone: GearBone; group: THREE.Group }> = {
  vest: (m) => {
    const c = gearCfg.vest;
    const g = new THREE.Group();
    const half = c.gap / 2 + c.plate[2] / 2;
    // the plates in the cloth's colour, because a carrier is the dark mass on
    // a chest that says somebody is kitted out at fifty metres
    g.add(box(c.plate, m.cloth, [0, 0, half]));
    g.add(box(c.plate, m.cloth, [0, 0, -half]));
    // the webbing over each shoulder, joining the two plates
    for (const side of [-1, 1]) {
      g.add(box([c.shoulder[0], c.shoulder[1], c.gap + c.plate[2] * 2], m.cloth, [side * (c.plate[0] / 2 - c.shoulder[0]), c.plate[1] / 2 - c.shoulder[1] / 4, 0]));
    }
    // magazine pouches across the front, the middle one in the accent
    const span = c.plate[0] - c.pouch[0];
    for (let i = 0; i < c.pouches; i++) {
      const x = c.pouches === 1 ? 0 : -span / 2 + (span * i) / (c.pouches - 1);
      g.add(box(c.pouch, i === (c.pouches - 1) / 2 ? m.trim : m.cloth, [x, -c.plate[1] / 4, half + c.pouch[2] / 2]));
    }
    g.position.copy(v3(c.at));
    return { bone: "spine_03", group: g };
  },
  pack: (m) => {
    const c = gearCfg.pack;
    const g = new THREE.Group();
    g.add(box(c.size, m.cloth));
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(c.roll, c.roll, c.size[0] * 0.92, 10), m.cloth);
    roll.rotation.z = Math.PI / 2;
    roll.position.y = c.size[1] / 2 + c.roll * 0.6;
    roll.castShadow = true;
    g.add(roll);
    g.position.copy(v3(c.at));
    return { bone: "spine_03", group: g };
  },
  helmet: (m) => {
    const c = gearCfg.helmet;
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(c.radius, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), m.hard);
    shell.scale.y = c.squash;
    shell.castShadow = true;
    g.add(shell);
    // the rear lip, which is what stops a helmet reading as a bowl
    g.add(box(c.lip, m.hard, [0, -c.lip[1], -c.radius * 0.55]));
    for (const side of [-1, 1]) g.add(box(c.rail, m.cloth, [side * c.radius * 0.92, c.radius * 0.18, 0]));
    g.position.copy(v3(c.at));
    return { bone: "Head", group: g };
  },
  shades: (m) => {
    const c = gearCfg.shades;
    const g = new THREE.Group();
    g.add(box(c.size, m.glass));
    g.add(box(c.strap, m.cloth, [0, 0, -c.size[2] * 1.6]));
    g.position.copy(v3(c.at));
    return { bone: "Head", group: g };
  },
  mask: (m) => {
    const c = gearCfg.mask;
    const g = new THREE.Group();
    g.add(box(c.snout, m.cloth));
    const f = new THREE.Mesh(new THREE.CylinderGeometry(c.filter.r, c.filter.r, c.filter.len, 12), m.hard);
    f.rotation.z = Math.PI / 2;
    f.position.copy(v3(c.filter.at));
    f.castShadow = true;
    g.add(f);
    // the lenses, which is where a gas mask becomes a face
    g.add(box([c.snout[0] * 1.05, c.snout[1] * 0.34, c.snout[2] * 0.5], m.glass, [0, c.snout[1] * 0.42, c.snout[2] * 0.3]));
    g.add(box(c.strap, m.cloth, [0, c.snout[1] * 0.3, -c.snout[2] * 1.4]));
    g.position.copy(v3(c.at));
    return { bone: "Head", group: g };
  },
  hood: (m) => {
    const c = gearCfg.hood;
    const g = new THREE.Group();
    // open at the front: a sphere with the front cut away, so it frames a face
    const shell = new THREE.Mesh(new THREE.SphereGeometry(c.radius, 16, 12, Math.PI * (1 - c.cut / 2), Math.PI * c.cut * 2), m.cloth);
    shell.scale.y = c.squash;
    shell.rotation.y = Math.PI / 2;
    shell.castShadow = true;
    g.add(shell);
    g.position.copy(v3(c.at));
    return { bone: "Head", group: g };
  },
  brim: (m) => {
    const c = gearCfg.brim;
    const g = new THREE.Group();
    g.add(box(c.size, m.cloth));
    g.position.copy(v3(c.at));
    return { bone: "Head", group: g };
  },
  shoulders: (m) => {
    const c = gearCfg.shoulders;
    const g = new THREE.Group();
    g.add(box(c.size, m.hard));
    g.position.copy(v3(c.at));
    return { bone: "upperarm_r", group: g };
  },
  pouches: (m) => {
    const c = gearCfg.pouches;
    const g = new THREE.Group();
    g.add(box(c.size, m.cloth));
    g.position.copy(v3(c.at));
    return { bone: "thigh_r", group: g };
  },
  knees: (m) => {
    const c = gearCfg.knees;
    const g = new THREE.Group();
    g.add(box(c.size, m.hard));
    g.position.copy(v3(c.at));
    return { bone: "calf_r", group: g };
  },
};

/**
 * Squash a piece into one mesh per material. A plate carrier is seven boxes
 * and a helmet four, and a lobby of twelve figures wearing five pieces each
 * would be six hundred things to draw for what the eye reads as five. They
 * are welded into their own local space, so the piece still hangs off its
 * bone and still turns with it.
 */
function weld(group: THREE.Group): THREE.Group {
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const keep: THREE.Object3D[] = [];
  for (const child of [...group.children]) {
    const m = child as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) {
      keep.push(child);
      continue;
    }
    const g = m.geometry.clone();
    m.updateMatrix();
    g.applyMatrix4(m.matrix);
    const list = byMat.get(m.material as THREE.Material) ?? [];
    list.push(g);
    byMat.set(m.material as THREE.Material, list);
  }
  const out = new THREE.Group();
  out.name = group.name;
  out.position.copy(group.position);
  out.quaternion.copy(group.quaternion);
  for (const child of keep) out.add(child);
  for (const [mat, list] of byMat) {
    const merged = list.length === 1 ? list[0] : mergeGeometries(list);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    out.add(mesh);
  }
  return out;
}

/** the pieces this operator wears, built and ready to hang on its bones */
export function buildGear(skin: OperatorSkin, mats = gearMaterials(skin)): GearPiece[] {
  const out: GearPiece[] = [];
  for (const id of GEAR_IDS) {
    if (!wears(skin, id)) continue;
    const built = BUILD[id](mats);
    const bone = built.bone;
    const group = weld(built.group);
    group.name = `gear:${id}`;
    out.push({ id, bone, group });
    // the pieces that come in pairs are built once and mirrored onto the other side
    const pair = PAIRED[id];
    if (pair) {
      const other = group.clone(true);
      other.name = `gear:${id}:l`;
      other.position.x *= -1;
      out.push({ id, bone: pair, group: other });
    }
  }
  return out;
}

/** the bone the mirrored copy of a piece goes on, for the kit that comes in twos */
const PAIRED: Partial<Record<GearId, GearBone>> = {
  shoulders: "upperarm_l",
  knees: "calf_l",
  pouches: "thigh_l",
};

/** does this operator wear this piece */
export function wears(skin: OperatorSkin, id: GearId): boolean {
  const e = skin.extras as Record<string, boolean | undefined>;
  return e[id] === true;
}
