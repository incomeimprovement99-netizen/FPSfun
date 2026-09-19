// Weapon finishes (src/config/finishes.json).
//
// XP had nothing to unlock. A finish is paint for a gun's body and accents,
// chosen gun by gun on the Loadouts tab (every gun remembers its own), and
// each one after the factory paint opens at a level. Applying one swaps the
// model's body and accent materials for the finish's (gunmodels.ts
// applyFinish), so two guns that share a palette do not change together.
import cfg from "../config/finishes.json";

export interface Finish {
  id: string;
  label: string;
  level: number;
  body?: number;
  accent?: number;
  metalness?: number;
  roughness?: number;
}

export const FINISHES = cfg.list as Finish[];
const KEY = "range.finishes";

/** each gun's chosen finish, by gun id (remembered in this browser) */
function load(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    return v && typeof v === "object" ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}
let chosen = load();

/** the finish a gun wears: its own choice, if the level still allows it, else the factory paint */
export function finishFor(gun: string, level: number): Finish {
  const f = FINISHES.find((x) => x.id === chosen[gun]);
  return f && f.level <= level ? f : FINISHES[0];
}

/** a gun's finish chosen (not if it is locked at this level): true if it took */
export function chooseFinish(gun: string, id: string, level: number): boolean {
  const f = FINISHES.find((x) => x.id === id);
  if (!f || f.level > level) return false;
  chosen = { ...chosen, [gun]: id };
  try {
    localStorage.setItem(KEY, JSON.stringify(chosen));
  } catch {
    /* ignore */
  }
  return true;
}

/** the finishes a level has opened */
export function unlocked(level: number): Finish[] {
  return FINISHES.filter((f) => f.level <= level);
}
