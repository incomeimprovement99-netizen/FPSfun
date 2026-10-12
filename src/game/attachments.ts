import { PROFILE } from "./game";
import { opticName } from "../config/names";

// Optics: the one attachment SpeedKills has, each gun's own and fixed (speedkills.json weapons optic). Every effect is
// the optic's mod block in the reference weapon data; nothing here is invented. An optic is only offered on a weapon
// whose own Mods block defines it.
//
// The legacy game's other attachments (barrels, stocks, lasers, hop-ups and their locked kind, the fire-mode
// switches) and its magazine levels went with it in Milestone 522: SpeedKills' upgrade is fusion.
export type AttachSlot = "optic";

export interface AttachOption {
  /** mod name in the weapon data, or null for "none" */
  mod: string | null;
  label: string;
}

/** the optics, in the order they are offered; "none" (iron sights) first */
const OPTICS: AttachOption[] = [
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
];

/** the sight a gun comes out wearing: the one its profile gives it, always */
export function startingOptic(id: string): string | null {
  return PROFILE.weapons[id]?.optic ?? null;
}

/** the optics this weapon can take, iron sights first */
export function opticsFor(mods: Record<string, unknown>): AttachOption[] {
  return OPTICS.filter((o) => o.mod === null || Object.prototype.hasOwnProperty.call(mods, o.mod)).map((o) => (o.mod ? { ...o, label: opticName(o.mod, o.label) } : o));
}

export type Attachments = Partial<Record<AttachSlot, string | null>>;

/** the mod names a given attachment set resolves to, skipping an empty slot */
export function modNames(a: Attachments): string[] {
  return a.optic ? [a.optic] : [];
}
