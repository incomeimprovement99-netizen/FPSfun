// SpeedKills' hacks (docs/PHASE_18_PLAN_SPEEDKILLS.md 7.7): two slots, one
// mobility and one utility, each holding one hack at a fusion level with its
// own cooldown. The legacy game's kits (abilities.ts) are untouched; this is
// the SpeedKills side, and it holds only the state: what you carry, how long
// until each is back, what a found copy does. What a hack does when it fires
// is main.ts's, beside the rest of the player's effects.
//
// Pure: no three.js and no DOM, so tools/checks/hacks.ts loads it.
import cfg from "../config/hacks.json";
import { profileOf } from "./game";

const PROFILE = profileOf("speedkills");

export type HackSlot = "mobility" | "utility";
export type HackId = "dash" | "slam" | "leap" | "grapple" | "heal" | "armor" | "wall" | "invis" | "reveal" | "mine";

/** every hack with its slot, name and line, from the SpeedKills profile (src/config/games/speedkills.json) */
export const HACK_DEFS: ReadonlyArray<{ id: HackId; slot: HackSlot; name: string; blurb: string }> = PROFILE.abilities.set
  .filter((a) => a.slot === "mobility" || a.slot === "utility")
  .map((a) => ({ id: a.id as HackId, slot: a.slot as HackSlot, name: a.name, blurb: a.blurb }));

export const HACK_IDS: readonly HackId[] = HACK_DEFS.map((h) => h.id);
export const hackDef = (id: string) => HACK_DEFS.find((h) => h.id === id) ?? null;
export const hackSlotOf = (id: string): HackSlot | null => hackDef(id)?.slot ?? null;
export const isHack = (id: unknown): id is HackId => typeof id === "string" && HACK_IDS.includes(id as HackId);

/** a hack's own numbers (src/config/hacks.json) */
export const HACK = cfg as unknown as Record<HackId, { cooldown: number } & Record<string, number>> & { fuseLevels: number; fuseStep: number };

/**
 * The cooldown of `id` at fusion `level`: Hyper Scape's own table where it
 * published one (hacks.json `cooldowns`), else each level takes fuseStep off
 * the base.
 */
export function cooldownOf(id: HackId, level: number): number {
  const l = Math.max(0, Math.min(HACK.fuseLevels, Math.round(level)));
  const table = (HACK[id] as unknown as { cooldowns?: number[] }).cooldowns;
  if (table && table.length > l) return table[l];
  return HACK[id].cooldown * (1 - HACK.fuseStep * l);
}

interface Held {
  id: HackId;
  level: number;
  /** when it can be used again (the page's clock, seconds) */
  readyAt: number;
}

/** what the floor's copy of a hack did to your kit */
export type Taken = "fused" | "swapped" | "maxed";

export class Hacks {
  private held: Record<HackSlot, Held | null> = { mobility: null, utility: null };

  /** what a slot holds, or null */
  get(slot: HackSlot): Readonly<Held> | null {
    return this.held[slot];
  }

  /** put `id` in its slot at `level`, ready now (a match's start with your picks, a swap) */
  set(id: HackId, level = 0, now = -Infinity): void {
    const slot = hackSlotOf(id);
    if (!slot) return;
    this.held[slot] = { id, level: Math.max(0, Math.min(HACK.fuseLevels, level)), readyAt: now };
  }

  /** nothing in either slot */
  clear(): void {
    this.held = { mobility: null, utility: null };
  }

  /**
   * A copy of `id` found on the floor: the same hack fuses up a level (a
   * higher-level copy, to its level), another of the slot swaps in at the
   * found copy's level with its cooldown kept, and a full one says so.
   */
  take(id: HackId, level: number, now: number): Taken | null {
    const slot = hackSlotOf(id);
    if (!slot) return null;
    const h = this.held[slot];
    if (!h) {
      this.set(id, level, now);
      return "swapped";
    }
    if (h.id !== id) {
      this.held[slot] = { id, level: Math.max(0, Math.min(HACK.fuseLevels, level)), readyAt: h.readyAt };
      return "swapped";
    }
    const to = Math.max(h.level + 1, level);
    if (h.level >= HACK.fuseLevels) return "maxed";
    h.level = Math.min(HACK.fuseLevels, to);
    return "fused";
  }

  /** seconds until a slot's hack is back (0: ready; Infinity: none) */
  left(slot: HackSlot, now: number): number {
    const h = this.held[slot];
    return h ? Math.max(0, h.readyAt - now) : Infinity;
  }

  /** a slot's cooldown as a fraction still to go, for the HUD (0 ready) */
  fraction(slot: HackSlot, now: number): number {
    const h = this.held[slot];
    if (!h) return 1;
    const total = cooldownOf(h.id, h.level);
    return total > 0 ? Math.max(0, Math.min(1, (h.readyAt - now) / total)) : 0;
  }

  /** use a slot's hack: its id if it was ready (and its cooldown starts), else null */
  use(slot: HackSlot, now: number): HackId | null {
    const h = this.held[slot];
    if (!h || now < h.readyAt) return null;
    h.readyAt = now + cooldownOf(h.id, h.level);
    return h.id;
  }

  /** a use that did not happen after all (a grapple with nothing in reach): the cooldown back */
  refund(slot: HackSlot): void {
    const h = this.held[slot];
    if (h) h.readyAt = -Infinity;
  }
}

/** the picks a browser keeps between matches: one mobility, one utility */
export const LS_HACKS = "range.sk.hacks";
export function savedPicks(): { mobility: HackId; utility: HackId } {
  const fallback = { mobility: "dash" as HackId, utility: "heal" as HackId };
  try {
    const v = JSON.parse(localStorage.getItem(LS_HACKS) ?? "null") as { mobility?: string; utility?: string } | null;
    return {
      mobility: v && isHack(v.mobility) && hackSlotOf(v.mobility) === "mobility" ? v.mobility : fallback.mobility,
      utility: v && isHack(v.utility) && hackSlotOf(v.utility) === "utility" ? v.utility : fallback.utility,
    };
  } catch {
    return fallback;
  }
}
export function savePicks(p: { mobility: HackId; utility: HackId }): void {
  try {
    localStorage.setItem(LS_HACKS, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
