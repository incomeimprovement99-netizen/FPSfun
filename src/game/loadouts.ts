// Loadouts, the way CoD does classes: five fixed defaults, five custom slots
// you name and edit, and the game remembers which one you used last. A
// loadout is an operator look, two weapons and an heirloom.
import { IS_SK, PROFILE } from "./game";
import { weaponIds } from "./weapons";
import { OPERATORS } from "./operators";
import { BODY_IDS, BUILD_IDS, OUTFIT_IDS, faceList } from "./outfit";
import type { BodyId, BuildId, OutfitId } from "./outfit";
import { HEIRLOOMS } from "./heirlooms";
import outfitCfg from "../config/outfits.json";

/**
 * Four outfits used to be an outfit on the lighter body. The body is its own
 * pick now, so they went, and a loadout that stored one of them is given the
 * same clothes on that body rather than a stranger's.
 */
const ON_THE_OTHER_BODY: Record<string, string> = { rangerF: "ranger", peasantF: "peasant", scout_f: "scout_leathers", hooded_f: "hoodie" };

export interface LoadoutDef {
  name: string;
  operator: string;
  /** the clothes under the kit, and how they sit (src/game/outfit.ts) */
  outfit?: string;
  build?: string;
  /** which body, when one was picked (outfits.json bodies) */
  body?: string;
  /** what is on the face, over the kit's own: "", "wrap", "goggles", "fullMask", or two of them */
  face?: string;
  slot1: string;
  slot2: string;
  heirloom: string;
}

/**
 * The loadouts everybody starts with. Each one is dressed outright rather than
 * left to inherit its operator's set, and every one of them covers its face:
 * goggles, a full mask, or a helmet. Nobody's eyes are visible, which is the
 * owner's rule and a good one - a figure whose face you can read is a figure
 * out of a different game from the one it is standing in.
 */
export const DEFAULT_LOADOUTS: readonly LoadoutDef[] = [
  { name: "Assault", operator: "vanguard", outfit: "fatigues", build: "regular", face: "goggles", slot1: "rspn101", slot2: "wingman", heirloom: "fists" },
  { name: "Close Quarters", operator: "nightshade", outfit: "urban", build: "lean", face: "fullMask", slot1: "r97", slot2: "mastiff", heirloom: "karambit" },
  { name: "Marksman", operator: "frost", outfit: "arctic", build: "heavy", face: "goggles", slot1: "g2", slot2: "volt_smg", heirloom: "tanto" },
  { name: "Heavy", operator: "inferno", outfit: "irregular", build: "heavy", face: "wrap,goggles", slot1: "lmg", slot2: "shotgun", heirloom: "kukri" },
  { name: "Sidearms", operator: "sandstorm", outfit: "desert", build: "regular", face: "wrap,goggles", slot1: "semipistol", slot2: "g17", heirloom: "butterfly" },
  { name: "Dirt Bike", operator: "scrambler", outfit: "motocross", build: "lean", face: "", slot1: "car", slot2: "mastiff", heirloom: "kukri" },
].map((d, i) => {
  // SpeedKills: the same six, carrying its own guns
  const pair = IS_SK ? PROFILE.lists?.loadouts[i] : undefined;
  return pair ? { ...d, slot1: pair[0], slot2: pair[1] } : d;
});

export type LoadoutRef = { kind: "default" | "custom"; index: number };

interface Store {
  selected: LoadoutRef;
  custom: LoadoutDef[];
}

// each game keeps its own: SpeedKills' guns would not survive a legacy check of what a slot may hold, nor the other way round
const KEY = IS_SK ? "range.loadouts.sk.v1" : "range.loadouts.v1";
const OLD_SLOTS = "range.slots.v1";

/**
 * A dressed slot, picked at random but spread out: the shuffle is seeded by
 * the slot's own number so two slots never start in the same clothes, and a
 * browser that has never seen this game gets six people rather than six of
 * one person.
 */
const spread = <T>(list: readonly T[], i: number): T => list[(i * 7 + 3) % list.length];
const pickOutfit = (i: number): string => spread(DRESSED, i + Math.floor(Math.random() * DRESSED.length));
const pickHeirloom = (i: number): string => spread(HEIRLOOMS, i + Math.floor(Math.random() * HEIRLOOMS.length)).id;

/**
 * The outfits a slot may be given: the ones that are real cloth. An outfit
 * from before the published assets went in - or one that has since been
 * renamed - is not kept, because what it named is gone.
 */
const DRESSED = OUTFIT_IDS.filter((id) => ((outfitCfg.sets as Record<string, { parts?: string[] }>)[id]?.parts?.length ?? 0) > 0);

/** a stored loadout made safe to use: anything unknown falls back (exported for tools/checks/outfit.ts) */
export function valid(d: Partial<LoadoutDef> | undefined, fallback: LoadoutDef): LoadoutDef {
  const ids = weaponIds();
  return {
    name: typeof d?.name === "string" && d.name.trim() ? d.name.trim().slice(0, 24) : fallback.name,
    operator: OPERATORS.some((o) => o.id === d?.operator) ? d!.operator! : fallback.operator,
    slot1: d?.slot1 && ids.includes(d.slot1) ? d.slot1 : fallback.slot1,
    slot2: d?.slot2 && ids.includes(d.slot2) ? d.slot2 : fallback.slot2,
    heirloom: HEIRLOOMS.some((h) => h.id === d?.heirloom) ? d!.heirloom! : fallback.heirloom,
    // What they chose to wear, if they chose: an id we no longer have (an
    // outfit renamed between releases) falls back to the operator's own set
    // rather than to nothing, which would be a naked figure.
    // A stored outfit that is not one of the dressed ones is an old skin: the
    // owner asked that none of those survive, so the slot is given a new one
    // rather than the fallback's, which would make every stale slot identical.
    outfit: DRESSED.includes(d?.outfit as OutfitId) ? d!.outfit : (ON_THE_OTHER_BODY[d?.outfit ?? ""] ?? fallback.outfit),
    build: BUILD_IDS.includes(d?.build as BuildId) ? d!.build : fallback.build,
    body: BODY_IDS.includes(d?.body as BodyId) ? d!.body : ON_THE_OTHER_BODY[d?.outfit ?? ""] ? "Superhero_Female_FullBody" : fallback.body,
    face: typeof d?.face === "string" ? faceList(d.face).join(",") : fallback.face,
  };
}

/**
 * The loadout this browser has selected, read fresh from storage.
 *
 * The battle royale's loadout crate needs your pick at the moment you claim
 * it, and it has no way to reach the Loadouts the menu holds: it is built
 * before the match and lives in main.ts. Reading the store again costs one
 * JSON parse and cannot go stale, which a second long-lived copy could if you
 * edited a loadout between matches.
 */
export function savedLoadout(): LoadoutDef {
  return new Loadouts().current;
}

export class Loadouts {
  private store: Store;

  constructor() {
    this.store = this.load();
  }

  private load(): Store {
    // A custom slot arrives dressed, each in a different outfit with a
    // different melee weapon, rather than six copies of the defaults. Somebody
    // who never opens this tab still gets six characters instead of one.
    const fresh: Store = {
      selected: { kind: "default", index: 0 },
      custom: DEFAULT_LOADOUTS.map((d, i) => ({ ...d, name: `Custom ${i + 1}`, outfit: pickOutfit(i), heirloom: pickHeirloom(i) })),
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
