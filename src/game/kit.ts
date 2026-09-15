// What you carry to heal with, and your armour (src/config/items.json).
//
// The heal key picks for you, the way Apex's quick heal does: shields first,
// a battery when a lot of shield is gone and a cell for a little, then health
// the same way with a med kit or a syringe, and a phoenix kit when both are
// low. Holding the key opens a wheel to pick one yourself.
//
// Armour: a shield core that levels with EVO (the damage you deal) from white
// 50 to blue 75 to purple 100; the gold helmet sets it to 100 and doubles what
// the small heals give, the mythic one sets it to 125.
import cfg from "../config/items.json";
import { PHOENIX_NAME } from "../config/names";

export type HealItem = keyof typeof cfg.heals;
export const HEAL_ORDER: HealItem[] = ["cell", "battery", "syringe", "medkit", "phoenix"];
export const HEALS = cfg.heals;
// (its name is the game's own: names.ts gives it, codenamed on a public build)
HEALS.phoenix.name = PHOENIX_NAME;
export type Helmet = keyof typeof cfg.helmets;

export class Kit {
  items: Record<HealItem, number> = { cell: 0, syringe: 0, battery: 0, medkit: 0, phoenix: 0 };

  /** a life's start: the arena's kit, a battle royale's start, or nothing */
  fill(which: "kit" | "brStart" | "empty"): void {
    const src = which === "empty" ? null : cfg[which];
    for (const k of HEAL_ORDER) this.items[k] = src ? Math.min(HEALS[k].stack, src[k]) : 0;
  }

  /** picked up: as many as the stack has room for; returns how many went in */
  add(item: HealItem, n: number): number {
    const room = Math.max(0, HEALS[item].stack - this.items[item]);
    const put = Math.min(room, n);
    this.items[item] += put;
    return put;
  }

  get total(): number {
    return HEAL_ORDER.reduce((a, k) => a + this.items[k], 0);
  }

  /**
   * The quick heal's choice for these vitals, or null with nothing that
   * helps. Shields first: a battery for 50 or more missing, else a cell;
   * then health: a med kit for 50 or more missing, else a syringe; a phoenix
   * kit when both are at least half gone, or when it is all that is left.
   */
  pick(shield: number, shieldMax: number, health: number, healthMax: number): HealItem | null {
    const sMiss = Math.max(0, shieldMax - shield);
    const hMiss = Math.max(0, healthMax - health);
    const has = (k: HealItem) => this.items[k] > 0;
    if (sMiss >= shieldMax / 2 && hMiss >= healthMax / 2 && has("phoenix")) return "phoenix";
    if (sMiss > 0) {
      if (sMiss >= 50 && has("battery")) return "battery";
      if (has("cell")) return "cell";
      if (has("battery")) return "battery";
    }
    if (hMiss > 0) {
      if (hMiss >= 50 && has("medkit")) return "medkit";
      if (has("syringe")) return "syringe";
      if (has("medkit")) return "medkit";
    }
    if ((sMiss > 0 || hMiss > 0) && has("phoenix")) return "phoenix";
    return null;
  }

  /** why the quick heal found nothing, for the notice */
  whyNot(shield: number, shieldMax: number, health: number, healthMax: number): string {
    if (this.total === 0) return "NO HEALS LEFT";
    if (shield >= shieldMax && health >= healthMax) return "FULL";
    if (shield < shieldMax && !this.items.cell && !this.items.battery && health >= healthMax) return "NO SHIELD HEALS LEFT";
    return "NO HEALTH HEALS LEFT";
  }
}

export const SHIELD_LEVELS = cfg.shieldLevels;

export class Armor {
  /** EVO earned this life */
  evo = 0;
  /** 1 white, 2 blue, 3 purple */
  level = 1;
  helmet: Helmet | null = null;

  /** a new life: white, no EVO, no helmet */
  reset(level = 1): void {
    this.evo = SHIELD_LEVELS[Math.max(0, Math.min(SHIELD_LEVELS.length - 1, level - 1))].evo;
    this.level = level;
    this.helmet = null;
  }

  /** the shield it holds: the core's level, or the helmet's armour if higher */
  get shieldMax(): number {
    const core = SHIELD_LEVELS[this.level - 1]?.max ?? 50;
    return Math.max(core, this.helmet ? cfg.helmets[this.helmet].armor : 0);
  }

  /** the colour tier for the HUD and the hit sounds: 1 white .. 4 red */
  get tier(): number {
    const m = this.shieldMax;
    return m >= 125 ? 4 : m >= 100 ? 3 : m >= 75 ? 2 : 1;
  }

  /** what cells and syringes give is scaled by this (the gold helmet) */
  get smallHealScale(): number {
    return this.helmet ? cfg.helmets[this.helmet].smallHealScale : 1;
  }

  /** EVO for damage dealt; returns the new level when the core levels up */
  addEvo(amount: number): number | null {
    this.evo += Math.max(0, amount);
    const next = SHIELD_LEVELS[this.level];
    if (next && this.evo >= next.evo) {
      this.level++;
      return this.level;
    }
    return null;
  }

  /** 0..1 of the way to the next level, or null at the top */
  get evoFrac(): number | null {
    const cur = SHIELD_LEVELS[this.level - 1];
    const next = SHIELD_LEVELS[this.level];
    if (!cur || !next) return null;
    return Math.max(0, Math.min(1, (this.evo - cur.evo) / (next.evo - cur.evo)));
  }
}
