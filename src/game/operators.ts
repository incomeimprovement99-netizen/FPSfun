// Operators: the look of your character. The other player in a 1v1 sees
// yours, and your own gloves and sleeves take its colours.
//
// All five are the range robot (our own design, dummy.ts) in a distinct
// scheme with its own add-ons, not any game's character.
import * as THREE from "three";

export interface OperatorSkin {
  id: string;
  name: string;
  blurb: string;
  shell: number;
  head: number;
  accent: number;
  joint: number;
  visor: number;
  eye: number;
  /** first-person arms */
  glove: number;
  pad: number;
  sleeve: number;
  cuff: number;
  /**
   * What it wears. `crest` and `antenna` are the robot's own add-ons; the rest
   * are the kit in src/game/gear.ts, which any figure rigged like a person can
   * put on. An operator is a silhouette before it is a colour, so each one
   * wears a different set: at 80 m the helmet, the hood and the gas mask are
   * what tells you which of them is coming.
   */
  extras: {
    crest?: boolean;
    antenna?: boolean;
    /** hard plates over the deltoids */
    shoulders?: boolean;
    /** a cap peak */
    brim?: boolean;
    /** a plate carrier with pouches */
    vest?: boolean;
    /** a daypack with a roll on top */
    pack?: boolean;
    /** a shell over the crown */
    helmet?: boolean;
    /** one dark bar across the eyes */
    shades?: boolean;
    /** a gas mask: a snout, a filter can, lenses */
    mask?: boolean;
    /** a soft hood standing off the back of the head */
    hood?: boolean;
    /** a drop pouch on each thigh */
    pouches?: boolean;
    /** knee pads */
    knees?: boolean;
  };
}

export const OPERATORS: OperatorSkin[] = [
  {
    id: "vanguard",
    name: "Vanguard",
    blurb: "Range grey with safety orange. The original.",
    shell: 0x9aa2aa, head: 0xa9b0b7, accent: 0xd4712a, joint: 0x24282d, visor: 0x0d1013, eye: 0x39d7ee,
    glove: 0x45403a, pad: 0x625a50, sleeve: 0x3a3e43, cuff: 0xc9772f,
    extras: { vest: true, shades: true, pouches: true },
  },
  {
    id: "nightshade",
    name: "Nightshade",
    blurb: "Matte black, violet trim, a blade crest.",
    shell: 0x2c2f36, head: 0x353841, accent: 0x9b4dff, joint: 0x15171a, visor: 0x1a0f24, eye: 0xff3bd4,
    glove: 0x202227, pad: 0x3b2d4a, sleeve: 0x1c1e22, cuff: 0x9b4dff,
    extras: { crest: true, hood: true, mask: true, vest: true, knees: true },
  },
  {
    id: "sandstorm",
    name: "Sandstorm",
    blurb: "Desert tan, olive webbing, brimmed hood and face guard.",
    shell: 0xb59a72, head: 0xc2a67c, accent: 0x5d6b3a, joint: 0x3a3226, visor: 0x1c140c, eye: 0xffb23c,
    glove: 0x6b5a3e, pad: 0x8a7550, sleeve: 0x5d5238, cuff: 0x5d6b3a,
    extras: { brim: true, mask: true, vest: true, pack: true, pouches: true },
  },
  {
    id: "frost",
    name: "Frost",
    blurb: "Arctic white with cobalt, heavy shoulder armour.",
    shell: 0xdfe7ee, head: 0xeef3f7, accent: 0x3b8bff, joint: 0x5c6b78, visor: 0x0c1a2a, eye: 0x7fe8ff,
    glove: 0xc8d3dc, pad: 0x8fa3b5, sleeve: 0x6f7f8e, cuff: 0x3b8bff,
    extras: { shoulders: true, helmet: true, shades: true, vest: true, knees: true },
  },
  {
    id: "inferno",
    name: "Inferno",
    blurb: "Scorched red and black, an antenna and shoulder plates.",
    shell: 0x3a1f1c, head: 0x4a2622, accent: 0xff3b1f, joint: 0x1a1210, visor: 0x2a0a06, eye: 0xffd23c,
    glove: 0x2d1c1a, pad: 0x6a2a1e, sleeve: 0x241816, cuff: 0xff3b1f,
    extras: { antenna: true, shoulders: true, mask: true, helmet: true, pack: true },
  },
];

export function operatorById(id: string | undefined): OperatorSkin {
  return OPERATORS.find((o) => o.id === id) ?? OPERATORS[0];
}

interface SkinMats {
  joint: THREE.MeshStandardMaterial;
  visor: THREE.MeshStandardMaterial;
  eye: THREE.MeshStandardMaterial;
}
const matCache = new Map<string, SkinMats>();

/** the shared joint, visor and eye materials for one operator */
export function skinMaterials(s: OperatorSkin): SkinMats {
  let m = matCache.get(s.id);
  if (!m) {
    m = {
      joint: new THREE.MeshStandardMaterial({ color: s.joint, roughness: 0.45, metalness: 0.6 }),
      visor: new THREE.MeshStandardMaterial({ color: s.visor, roughness: 0.12, metalness: 0.7 }),
      eye: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: s.eye, emissiveIntensity: 2.4 }),
    };
    matCache.set(s.id, m);
  }
  return m;
}
