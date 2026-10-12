// Operators: a character's colours. Each wears a soldier of its own unless a player picked one (mannequin.ts
// soldierLookFor), the Loadouts tab shows its colours, and your own drawn gloves and sleeves take them until the
// soldier's arms are in. Their robot and its kit went in Milestone 569.
import { readLook } from "./outfit";

export interface OperatorSkin {
  id: string;
  name: string;
  blurb: string;
  /** its colours on the Loadouts tab */
  shell: number;
  accent: number;
  eye: number;
  /** first-person arms */
  glove: number;
  pad: number;
  sleeve: number;
  cuff: number;
  /** the soldier's look (soldier.ts soldierCode), when one was chosen; a figure without one takes its operator's */
  soldier?: string;
}

export const OPERATORS: OperatorSkin[] = [
  {
    id: "vanguard",
    name: "Vanguard",
    blurb: "Range grey with safety orange. The original.",
    shell: 0x9aa2aa, accent: 0xd4712a, eye: 0x39d7ee,
    glove: 0x45403a, pad: 0x625a50, sleeve: 0x3a3e43, cuff: 0xc9772f,
    // the goggles are the outfit's, so the kit's flat shades bar would double up
  },
  {
    id: "nightshade",
    name: "Nightshade",
    blurb: "Matte black, violet trim, a blade crest.",
    shell: 0x2c2f36, accent: 0x9b4dff, eye: 0xff3bd4,
    glove: 0x202227, pad: 0x3b2d4a, sleeve: 0x1c1e22, cuff: 0x9b4dff,
  },
  {
    id: "sandstorm",
    name: "Sandstorm",
    blurb: "Desert tan, olive webbing, brimmed hood and face guard.",
    shell: 0xb59a72, accent: 0x5d6b3a, eye: 0xffb23c,
    glove: 0x6b5a3e, pad: 0x8a7550, sleeve: 0x5d5238, cuff: 0x5d6b3a,
  },
  {
    id: "frost",
    name: "Frost",
    blurb: "Arctic white with cobalt, heavy shoulder armour.",
    shell: 0xdfe7ee, accent: 0x3b8bff, eye: 0x7fe8ff,
    glove: 0xc8d3dc, pad: 0x8fa3b5, sleeve: 0x6f7f8e, cuff: 0x3b8bff,
  },
  {
    id: "inferno",
    name: "Inferno",
    blurb: "Scorched red and black, an antenna and shoulder plates.",
    shell: 0x3a1f1c, accent: 0xff3b1f, eye: 0xffd23c,
    glove: 0x2d1c1a, pad: 0x6a2a1e, sleeve: 0x241816, cuff: 0xff3b1f,
  },
  {
    id: "scrambler",
    name: "Scrambler",
    blurb: "Dirt bike blue and orange, a peaked helmet and a dark visor.",
    shell: 0x24425f, accent: 0xff7a18, eye: 0xffa03c,
    glove: 0x1b2833, pad: 0x2f4a66, sleeve: 0x1f3242, cuff: 0xff7a18,
  },
];

export function operatorById(id: string | undefined): OperatorSkin {
  return OPERATORS.find((o) => o.id === id) ?? OPERATORS[0];
}

/**
 * An operator wearing the soldier a player chose (outfit.ts lookCode), which is how two people on the same operator
 * turn up as two people. Only the look moves: the operator and its hit boxes are its own.
 */
export function operatorWearing(id: string | undefined, look: string | undefined): OperatorSkin {
  const base = operatorById(id);
  const worn = readLook(look);
  return worn.soldier === undefined ? base : { ...base, soldier: worn.soldier };
}
