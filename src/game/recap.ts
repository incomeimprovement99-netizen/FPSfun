// The death recap: every hit between you and each opponent in this life,
// both ways, and what they did around the kill.
//
// A DamageLog is kept per life (cleared at every spawn and drop). Every hit you
// land in a match goes in (who, gun, amount, headshot, distance), every hit
// you take (the same, from the hit message or the bot that fired), and every
// heal anyone is seen to finish. When you are eliminated, `recap()` folds it
// into one row per opponent who hurt you or whom you hurt, the killer first:
// damage and hits each way, their guns and distances, a heal of theirs in the
// 10 s before the kill, and what they had left.
import { PHOENIX_NAME } from "../config/names";
import cfg from "../config/killcam.json";
import { weaponName } from "./weapons";

export interface HitEntry {
  t: number;
  /** the shooter: a player or bot id, -1 for the ring */
  from: number;
  to: number;
  amount: number;
  head: boolean;
  /** weapon id, "melee", or "" when an older build did not say */
  weapon: string;
  /** metres, or null when not known */
  dist: number | null;
}

export interface HealEntry {
  t: number;
  id: number;
  item: string;
}

export interface RecapRow {
  id: number;
  name: string;
  killer: boolean;
  /** you to them */
  dealt: { damage: number; hits: number; heads: number };
  /** them to you */
  taken: { damage: number; hits: number; heads: number };
  /** the guns they hit you with: name, hits, damage, closest and farthest */
  guns: Array<{ name: string; hits: number; damage: number; near: number | null; far: number | null }>;
  /** seconds before the kill that they finished a heal, and with what */
  healed: { ago: number; item: string } | null;
  /** what they had left when you went down (null: not known) */
  left: { shield: number; health: number } | null;
}

export interface Recap {
  killerId: number;
  killerName: string;
  /** the ring, or no one we can name */
  byRing: boolean;
  rows: RecapRow[];
  /** everything you took, and dealt, this life */
  totalTaken: number;
  totalDealt: number;
  at: number;
}

/** heal items as small numbers for the network (the fx message's n) */
export const HEAL_CODES = ["cell", "syringe", "battery", "medkit", "phoenix"];

const ITEM_NAME: Record<string, string> = { cell: "SHIELD CELL", syringe: "SYRINGE", battery: "SHIELD BATTERY", medkit: "MED KIT", phoenix: PHOENIX_NAME.toUpperCase() };
export const healItemName = (item: string): string => ITEM_NAME[item] ?? item.toUpperCase();

export class DamageLog {
  hits: HitEntry[] = [];
  heals: HealEntry[] = [];
  /** this player's id in the match */
  me = 0;

  /** a new life: nothing from the last one counts */
  clear(me: number): void {
    this.me = me;
    this.hits = [];
    this.heals = [];
  }

  hit(e: HitEntry): void {
    this.hits.push(e);
    if (this.hits.length > 400) this.hits.shift();
  }

  heal(e: HealEntry): void {
    this.heals.push(e);
    if (this.heals.length > 60) this.heals.shift();
  }

  /**
   * The recap at the moment of the kill. `nameOf` and `vitalsOf` answer for
   * the match's players and bots.
   */
  recap(t: number, killerId: number, nameOf: (id: number) => string, vitalsOf: (id: number) => { shield: number; health: number } | null): Recap {
    const ids = new Set<number>();
    for (const h of this.hits) {
      if (h.to === this.me && h.from !== this.me) ids.add(h.from);
      if (h.from === this.me && h.to !== this.me) ids.add(h.to);
    }
    if (killerId >= 0) ids.add(killerId);
    const rows: RecapRow[] = [];
    for (const id of ids) {
      if (id < 0) continue;
      const mine = this.hits.filter((h) => h.from === this.me && h.to === id);
      const theirs = this.hits.filter((h) => h.from === id && h.to === this.me);
      const guns = new Map<string, { name: string; hits: number; damage: number; near: number | null; far: number | null }>();
      for (const h of theirs) {
        const key = h.weapon || "?";
        const g = guns.get(key) ?? { name: h.weapon === "melee" ? "MELEE" : h.weapon ? weaponName(h.weapon).toUpperCase() : "UNKNOWN GUN", hits: 0, damage: 0, near: null, far: null };
        g.hits++;
        g.damage += h.amount;
        if (h.dist !== null) {
          g.near = g.near === null ? h.dist : Math.min(g.near, h.dist);
          g.far = g.far === null ? h.dist : Math.max(g.far, h.dist);
        }
        guns.set(key, g);
      }
      const heal = [...this.heals].reverse().find((e) => e.id === id && t - e.t <= cfg.healedWithin && e.t <= t + 0.01);
      rows.push({
        id,
        name: nameOf(id),
        killer: id === killerId,
        dealt: { damage: sum(mine), hits: mine.length, heads: mine.filter((h) => h.head).length },
        taken: { damage: sum(theirs), hits: theirs.length, heads: theirs.filter((h) => h.head).length },
        guns: [...guns.values()].sort((a, b) => b.damage - a.damage),
        healed: heal ? { ago: Math.max(0, t - heal.t), item: healItemName(heal.item) } : null,
        left: vitalsOf(id),
      });
    }
    // the killer first, then whoever hurt you most
    rows.sort((a, b) => Number(b.killer) - Number(a.killer) || b.taken.damage - a.taken.damage);
    const taken = this.hits.filter((h) => h.to === this.me);
    return {
      killerId,
      killerName: killerId === -1 ? "THE RING" : nameOf(killerId),
      byRing: killerId === -1,
      rows,
      totalTaken: sum(taken),
      totalDealt: sum(this.hits.filter((h) => h.from === this.me)),
      at: t,
    };
  }
}

const sum = (xs: HitEntry[]): number => xs.reduce((a, h) => a + h.amount, 0);
