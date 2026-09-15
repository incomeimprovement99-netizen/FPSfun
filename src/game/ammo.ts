// What you carry to reload with (src/config/ammo.json, Season 30).
//
// The inventory holds light, heavy, sniper, shotgun rounds and arrows, in
// stacks. Energy guns carry their own stockpile of whole magazines instead,
// which refills one magazine every 18 s while the gun sits idle (not firing,
// not reloading). The range is endless (`infinite`) unless Settings says
// otherwise; a match counts.
import cfg from "../config/ammo.json";
import type { AmmoType, ResolvedWeapon } from "./weapons";

export const AMMO = cfg;
export const STACK: Record<Exclude<AmmoType, "energy">, number> = cfg.stacks;

export class AmmoPouch {
  infinite = true;
  stock: Record<AmmoType, number> = { light: 0, heavy: 0, energy: 0, sniper: 0, shotgun: 0, arrows: 0 };

  empty(): void {
    for (const k of Object.keys(this.stock) as AmmoType[]) this.stock[k] = 0;
  }

  /** the match's kit: this many stacks of each of these guns' ammo */
  kit(weapons: ResolvedWeapon[], stacks = cfg.kitStacks): void {
    this.empty();
    for (const w of weapons) {
      if (w.energyStock > 0 || w.ammoType === "energy") continue;
      const per = STACK[w.ammoType as Exclude<AmmoType, "energy">] ?? 60;
      // the bow's arrows are its own quiver: one of them, not stacks
      this.stock[w.ammoType] = Math.max(this.stock[w.ammoType], w.ammoType === "arrows" ? per : per * stacks);
    }
  }

  add(type: AmmoType, n: number): void {
    this.stock[type] += Math.max(0, Math.floor(n));
  }
}

/** the ammo a gun takes (by id, for a gun not in hand) */
export function ammoTypeOf(id: string): AmmoType {
  return ((cfg.types as Record<string, string>)[id] ?? "light") as AmmoType;
}

/** an energy gun's own stockpile: rounds, its most, when the next magazine comes back */
export interface EnergyStock {
  rounds: number;
  max: number;
  regenAt: number;
}

/** a full stockpile for this gun at its mag level */
export function fullEnergy(w: ResolvedWeapon): EnergyStock | null {
  if (w.energyStock <= 0) return null;
  const max = w.energyStock * w.clipSize;
  return { rounds: max, max, regenAt: 0 };
}
