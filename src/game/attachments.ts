import { opticName } from "../config/names";

// Attachments. Every effect below is a mod block in the reference weapon data;
// nothing here is invented. A slot is only offered on a weapon whose own Mods
// block defines it, so the Wingman never offers a barrel stabiliser and the
// Kraber never offers a 1x holo.
//
// Community mod-pack entries that live in the same Mods blocks (auto_loader,
// gibbyv1, 4d, unsc_super_soldier, elevator_shooter, prophunt, ...) are NOT
// attachments and are deliberately not listed.

// The magazine is deliberately NOT a slot here. Mag level is its own axis
// (resolved through `magMods` in the weapon data and cycled with one key), and
// listing the same mod names in both places double-applied them: a purple mag
// plus mag level 2 counted the reload bonus twice.
export type AttachSlot = "optic" | "barrel" | "stock" | "laser";

export interface AttachOption {
  /** mod name in the weapon data, or null for "none" */
  mod: string | null;
  label: string;
}

/**
 * Candidate mods per slot, in the order they are offered. The first entry of
 * every slot is "none" (iron sights / stock weapon).
 */
const CANDIDATES: Record<AttachSlot, AttachOption[]> = {
  optic: [
    { mod: null, label: "iron sights" },
    { mod: "optic_cq_holosight", label: "1x holo" },
    { mod: "optic_cq_hcog_classic", label: "1x HCOG classic" },
    { mod: "optic_cq_threat", label: "1x digital threat" },
    { mod: "optic_cq_hcog_bruiser", label: "2x HCOG bruiser" },
    { mod: "optic_cq_holosight_variable", label: "1x-2x variable holo" },
    { mod: "optic_ranged_hcog", label: "3x HCOG ranger" },
    { mod: "optic_ranged_aog_variable", label: "2x-4x variable AOG" },
    { mod: "optic_sniper", label: "6x sniper" },
    { mod: "optic_sniper_variable", label: "4x-8x variable sniper" },
    { mod: "optic_sniper_threat", label: "4x-10x digital sniper threat" },
  ],
  barrel: [
    { mod: null, label: "none" },
    { mod: "barrel_stabilizer_l1", label: "white barrel" },
    { mod: "barrel_stabilizer_l2", label: "blue barrel" },
    { mod: "barrel_stabilizer_l3", label: "purple barrel" },
    { mod: "barrel_stabilizer_l4_flash_hider", label: "gold barrel" },
  ],
  stock: [
    { mod: null, label: "none" },
    { mod: "stock_tactical_l1", label: "white stock" },
    { mod: "stock_tactical_l2", label: "blue stock" },
    { mod: "stock_tactical_l3", label: "purple stock" },
    { mod: "stock_sniper_l1", label: "white sniper stock" },
    { mod: "stock_sniper_l2", label: "blue sniper stock" },
    { mod: "stock_sniper_l3", label: "purple sniper stock" },
  ],
  laser: [
    { mod: null, label: "none" },
    { mod: "laser_sight_l1", label: "white laser" },
    { mod: "laser_sight_l2", label: "blue laser" },
    { mod: "laser_sight_l3", label: "purple laser" },
  ],
};

export const SLOTS: AttachSlot[] = ["optic", "barrel", "stock", "laser"];

/** what this weapon can actually take, "none" first */
export function optionsFor(slot: AttachSlot, mods: Record<string, unknown>): AttachOption[] {
  const out: AttachOption[] = [];
  for (const o of CANDIDATES[slot]) {
    if (o.mod === null) out.push(o);
    else if (Object.prototype.hasOwnProperty.call(mods, o.mod)) out.push(slot === "optic" ? { ...o, label: opticName(o.mod, o.label) } : o);
  }
  // mag level 4 is frequently identical to level 3 in the data; keep both so
  // the readout is honest rather than hiding a step that exists
  return out;
}

export type Attachments = Partial<Record<AttachSlot, string | null>>;

/** the mod names a given attachment set resolves to, skipping empty slots */
export function modNames(a: Attachments): string[] {
  const out: string[] = [];
  for (const s of SLOTS) {
    const m = a[s];
    if (m) out.push(m);
  }
  return out;
}
