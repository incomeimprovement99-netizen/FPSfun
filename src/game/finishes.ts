// Weapon finishes (src/config/finishes.json).
//
// A finish is paint for a gun's body and accents, chosen gun by gun on the
// Loadouts tab (every gun remembers its own). Applying one swaps the model's
// body and accent materials for the finish's (gunmodels.ts applyFinish), so
// two guns that share a palette do not change together.
//
// They used to open at levels, because XP had nothing else to unlock. The
// owner asked for that to go: "take out the leveling for the skins on the guns
// and let the user choose any". So every finish is available to everybody from
// the first minute. `level` stays in the data as the order the list is shown
// in - it is what sorts a rough factory paint from a gold one - and nothing
// reads it as a gate any more. This is a paint job in a game about shooting,
// and making somebody grind for it was never the interesting part.
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

/** the finish a gun wears: whatever it was given, else the factory paint */
export function finishFor(gun: string): Finish {
  return FINISHES.find((x) => x.id === chosen[gun]) ?? FINISHES[0];
}

/** a gun's finish chosen: true if it took (a finish we do not have does not) */
export function chooseFinish(gun: string, id: string): boolean {
  const f = FINISHES.find((x) => x.id === id);
  if (!f) return false;
  chosen = { ...chosen, [gun]: id };
  try {
    localStorage.setItem(KEY, JSON.stringify(chosen));
  } catch {
    /* ignore */
  }
  return true;
}

/** every finish there is, in the order the list shows them */
export function unlocked(): Finish[] {
  return FINISHES.slice();
}
