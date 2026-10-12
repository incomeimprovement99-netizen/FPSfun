// Loadouts, the way CoD does classes: five fixed defaults, five custom slots
// you name and edit, and the game remembers which one you used last. A
// loadout is an operator look, two weapons and an heirloom.
import { PROFILE } from "./game";
import { weaponIds } from "./weapons";
import { OPERATORS } from "./operators";
import { HEIRLOOMS } from "./heirlooms";

export interface LoadoutDef {
  name: string;
  operator: string;
  slot1: string;
  slot2: string;
  heirloom: string;
}

/** the loadouts everybody starts with */
export const DEFAULT_LOADOUTS: readonly LoadoutDef[] = [
  { name: "Assault", operator: "vanguard", heirloom: "fists" },
  { name: "Close Quarters", operator: "nightshade", heirloom: "karambit" },
  { name: "Marksman", operator: "frost", heirloom: "tanto" },
  { name: "Heavy", operator: "inferno", heirloom: "kukri" },
  { name: "Sidearms", operator: "sandstorm", heirloom: "butterfly" },
  { name: "Dirt Bike", operator: "scrambler", heirloom: "kukri" },
].map((d, i) => {
  // each carries one of SpeedKills' six pairs (speedkills.json lists.loadouts), with a name that fits it (Phase 20 A7);
  // the legacy game's own guns were here until Milestone 521
  const [slot1, slot2] = PROFILE.lists?.loadouts[i] ?? ["", ""];
  return { ...d, name: PROFILE.lists?.loadoutNames?.[i] ?? d.name, slot1, slot2 };
});

export type LoadoutRef = { kind: "default" | "custom"; index: number };

interface Store {
  selected: LoadoutRef;
  custom: LoadoutDef[];
  /** the game's loadoutPick this store has already been moved onto (see PICK) */
  pick?: string;
}

// SpeedKills' own key, from when the legacy game kept another (its guns would not have survived the other's check)
const KEY = "range.loadouts.sk.v1";
const OLD_SLOTS = "range.slots.v1";
/**
 * A returning player keeps whatever loadout they last picked, which for
 * everyone who played before the USSO and BOOG were finished is a pair that
 * shows none of that work. A new tag here moves every browser onto the first
 * default once; the tag is kept in the store, so a pick made after that sticks.
 */
const PICK = PROFILE.lists?.loadoutPick ?? "";

/**
 * A slot's melee weapon, picked at random but spread out: the shuffle is seeded by the slot's own number so two slots
 * never start with the same one.
 */
const spread = <T>(list: readonly T[], i: number): T => list[(i * 7 + 3) % list.length];
const pickHeirloom = (i: number): string => spread(HEIRLOOMS, i + Math.floor(Math.random() * HEIRLOOMS.length)).id;

/** a stored loadout made safe to use: anything unknown falls back, and what is no longer kept (the old clothes) is dropped */
export function valid(d: Partial<LoadoutDef> | undefined, fallback: LoadoutDef): LoadoutDef {
  const ids = weaponIds();
  // (a gun that left the roster for another id keeps its holder's choice: STRYDER's rifle is its pistol now)
  const named = (id?: string) => (id ? (PROFILE.renamed?.[id] ?? id) : id);
  if (d) d = { ...d, slot1: named(d.slot1), slot2: named(d.slot2) };
  return {
    name: typeof d?.name === "string" && d.name.trim() ? d.name.trim().slice(0, 24) : fallback.name,
    operator: OPERATORS.some((o) => o.id === d?.operator) ? d!.operator! : fallback.operator,
    slot1: d?.slot1 && ids.includes(d.slot1) ? d.slot1 : fallback.slot1,
    slot2: d?.slot2 && ids.includes(d.slot2) ? d.slot2 : fallback.slot2,
    heirloom: HEIRLOOMS.some((h) => h.id === d?.heirloom) ? d!.heirloom! : fallback.heirloom,
  };
}

export class Loadouts {
  private store: Store;

  constructor() {
    this.store = this.load();
    if (PICK && this.store.pick !== PICK) {
      this.store.selected = { kind: "default", index: 0 };
      this.store.pick = PICK;
      this.save();
    }
  }

  private load(): Store {
    // A custom slot arrives with a different melee weapon each, rather than six copies of the defaults
    const fresh: Store = {
      selected: { kind: "default", index: 0 },
      custom: DEFAULT_LOADOUTS.map((d, i) => ({ ...d, name: `Custom ${i + 1}`, heirloom: pickHeirloom(i) })),
    };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw) as Partial<Store>;
        const custom = fresh.custom.map((f, i) => valid(s.custom?.[i], f));
        const sel = s.selected;
        const selected: LoadoutRef =
          // (the bound is the list's own length: it was five, and adding a
          // sixth default would otherwise make it unselectable after a reload)
          sel && (sel.kind === "default" || sel.kind === "custom") && Number.isInteger(sel.index) && sel.index >= 0 && sel.index < DEFAULT_LOADOUTS.length ? sel : fresh.selected;
        return { selected, custom, pick: typeof s.pick === "string" ? s.pick : undefined };
      }
      // carry over the two weapons picked before loadouts existed
      const old = JSON.parse(localStorage.getItem(OLD_SLOTS) ?? "null") as unknown;
      if (Array.isArray(old) && old.length === 2) {
        fresh.custom[0] = valid({ ...fresh.custom[0], slot1: String(old[0]), slot2: String(old[1]) }, fresh.custom[0]);
        fresh.selected = { kind: "custom", index: 0 };
      }
    } catch {
      /* ignore */
    }
    return fresh;
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.store));
    } catch {
      /* ignore */
    }
  }

  get selected(): LoadoutRef {
    return this.store.selected;
  }

  /** the loadout in use */
  get current(): LoadoutDef {
    return this.get(this.store.selected);
  }

  get(ref: LoadoutRef): LoadoutDef {
    return ref.kind === "default" ? DEFAULT_LOADOUTS[ref.index] : this.store.custom[ref.index];
  }

  get custom(): readonly LoadoutDef[] {
    return this.store.custom;
  }

  select(ref: LoadoutRef): LoadoutDef {
    this.store.selected = { ...ref };
    this.save();
    return this.current;
  }

  /** change a custom loadout; defaults cannot be edited */
  edit(index: number, patch: Partial<LoadoutDef>): LoadoutDef {
    const cur = this.store.custom[index];
    this.store.custom[index] = valid({ ...cur, ...patch }, cur);
    this.save();
    return this.store.custom[index];
  }

  /** copy any loadout into a custom slot, and select it */
  copyTo(from: LoadoutRef, index: number): LoadoutDef {
    const src = this.get(from);
    this.store.custom[index] = { ...src, name: from.kind === "default" ? `My ${src.name}` : src.name };
    return this.select({ kind: "custom", index });
  }
}
