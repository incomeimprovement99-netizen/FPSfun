// Loadouts, the way CoD does classes: five fixed defaults, five custom slots
// you name and edit, and the game remembers which one you used last. A
// loadout is an operator look, two weapons and an heirloom.
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

export const DEFAULT_LOADOUTS: readonly LoadoutDef[] = [
  { name: "Assault", operator: "vanguard", slot1: "rspn101", slot2: "wingman", heirloom: "fists" },
  { name: "Close Quarters", operator: "nightshade", slot1: "r97", slot2: "mastiff", heirloom: "karambit" },
  { name: "Marksman", operator: "frost", slot1: "g2", slot2: "volt_smg", heirloom: "tanto" },
  { name: "Heavy", operator: "inferno", slot1: "lmg", slot2: "shotgun", heirloom: "kukri" },
  { name: "Sidearms", operator: "sandstorm", slot1: "semipistol", slot2: "g17", heirloom: "butterfly" },
];

export type LoadoutRef = { kind: "default" | "custom"; index: number };

interface Store {
  selected: LoadoutRef;
  custom: LoadoutDef[];
}

const KEY = "range.loadouts.v1";
const OLD_SLOTS = "range.slots.v1";

function valid(d: Partial<LoadoutDef> | undefined, fallback: LoadoutDef): LoadoutDef {
  const ids = weaponIds();
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
  }

  private load(): Store {
    const fresh: Store = {
      selected: { kind: "default", index: 0 },
      custom: DEFAULT_LOADOUTS.map((d, i) => ({ ...d, name: `Custom ${i + 1}` })),
    };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw) as Partial<Store>;
        const custom = fresh.custom.map((f, i) => valid(s.custom?.[i], f));
        const sel = s.selected;
        const selected: LoadoutRef =
          sel && (sel.kind === "default" || sel.kind === "custom") && Number.isInteger(sel.index) && sel.index >= 0 && sel.index < 5 ? sel : fresh.selected;
        return { selected, custom };
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
