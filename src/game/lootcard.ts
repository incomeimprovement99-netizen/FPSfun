// The loot card (Phase 20 A8): what a gun or hack core on the floor is, what
// taking it would do, and how it compares with what you carry. The owner:
// most games have a verbose card that teaches a new player and a compact one
// an experienced player reads at a glance, and a setting between them.
//
// Pure: no three.js, no DOM. The HUD draws the view this builds, and the take
// decision here mirrors main.ts applyLoot (a copy fuses, an empty slot fills,
// else the one in hand swaps), so the card says what E will do.
import { PROFILE } from "./game";
import { resolveWeapon, weaponKind, weaponName, type ResolvedWeapon } from "./weapons";
import { cooldownOf, hackDef, hackSlotOf, HACK, type HackId } from "./hacks";
import type { LootItem } from "./loot";
import hudCfg from "../config/hud.json";

export const LS_LOOT_CARD = "range.sk.lootCard";
export type LootCardMode = "full" | "compact";
const CARD = hudCfg.lootCard;

/** seconds to kill a full pool at close range, `hit` of rounds on the body, reloads counted (tools/checks/ttk.ts measures the roster the same way) */
export function ttkClose(w: ResolvedWeapon, pool = PROFILE.health ? PROFILE.health.health + PROFILE.health.shield : 150, hit = CARD.ttkHit): number {
  const perShot = w.damage.near * Math.max(1, w.pellets) * hit;
  const shots = Math.ceil(pool / perShot);
  const interval = w.semiAuto ? Math.max(w.shotInterval, 1 / w.fireRate) : 1 / w.fireRate;
  const reloads = Math.floor((shots - 1) / w.clipSize);
  return (shots - 1) * interval + reloads * w.reloadTime;
}

export type Verdict = "fuse" | "max" | "fill" | "swap";

export interface SlotView {
  id: string;
  empty: boolean;
  fusion: number;
  clip: number;
}

/** what taking a gun at `level` does: as main.ts applyLoot does it */
export function gunOutcome(id: string, level: number, slots: SlotView[], active: number): { verdict: Verdict; slot: number; from: number; to: number } {
  const top = PROFILE.fusion.levels;
  const twin = slots.findIndex((s) => !s.empty && s.id === id);
  if (twin >= 0) {
    const from = slots[twin].fusion;
    const to = Math.min(top, Math.max(from + 1, level));
    return { verdict: to > from ? "fuse" : "max", slot: twin, from, to };
  }
  const empty = slots.findIndex((s) => s.empty);
  if (empty >= 0) return { verdict: "fill", slot: empty, from: 0, to: level };
  return { verdict: "swap", slot: active, from: slots[active]?.fusion ?? 0, to: level };
}

/** what taking a hack core at `level` does: as Hacks.take does it */
export function hackOutcome(id: string, level: number, held: { id: string; level: number } | null): { verdict: Verdict; from: number; to: number } {
  if (!held) return { verdict: "fill", from: 0, to: Math.min(HACK.fuseLevels, level) };
  if (held.id !== id) return { verdict: "swap", from: held.level, to: Math.min(HACK.fuseLevels, level) };
  if (held.level >= HACK.fuseLevels) return { verdict: "max", from: held.level, to: held.level };
  return { verdict: "fuse", from: held.level, to: Math.min(HACK.fuseLevels, Math.max(held.level + 1, level)) };
}

/** a number as a card shows it: whole when it is within 0.05 of one, else one decimal */
export function one(n: number): string {
  return Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1);
}

export interface GunStats {
  ttk: number;
  dmg: string;
  head: number;
  rate: number;
  mag: number;
  reload: number;
  heat: boolean;
}

/** a gun's numbers at a fusion level (the range's armory screens show them too: armory.ts) */
export function gunStats(id: string, level: number): GunStats {
  const w = resolveWeapon(id, 0, [], level);
  const per = w.damage.near;
  const pellets = Math.max(1, w.pellets);
  return {
    ttk: ttkClose(w),
    dmg: pellets > 1 ? `${one(per)} x${pellets}` : one(per),
    head: per * w.damage.headshot,
    rate: w.semiAuto ? 1 / Math.max(w.shotInterval, 1 / w.fireRate) : w.fireRate,
    mag: w.clipSize,
    reload: w.reloadTime,
    heat: !!(w as unknown as { mech?: { overheat?: unknown } }).mech?.overheat,
  };
}

export interface CardRow {
  label: string;
  have: string;
  get: string;
  /** the one on the floor against yours: 1 better, -1 worse, 0 the same or not a better-or-worse number */
  cmp: -1 | 0 | 1;
}

export interface LootCardView {
  mode: LootCardMode;
  kind: "gun" | "hack";
  title: string;
  sub: string;
  verdict: Verdict;
  say: string;
  sayMore: string;
  heads: [string, string] | null;
  rows: CardRow[];
  notes: string[];
}

/** lower is better (a time), or higher is (a magazine) */
function cmpOf(have: number, get: number, lowerBetter: boolean): -1 | 0 | 1 {
  if (!Number.isFinite(have) || have <= 0) return 0;
  const r = get / have;
  if (Math.abs(r - 1) <= CARD.same) return 0;
  return (r < 1) === lowerBetter ? 1 : -1;
}

/** what a family is for, one line (speedkills.json families.use) */
export function useOf(id: string): string {
  for (const f of Object.values(PROFILE.families ?? {}) as Array<{ guns: string[]; use?: string }>) if (f.guns.includes(id)) return f.use ?? "";
  return "";
}

/**
 * The card for the floor item a player is looking at, against what they carry, or null for anything but a gun
 * or a hack core.
 */
export function lootCardView(item: LootItem, ctx: { slots: SlotView[]; active: number; held: Partial<Record<"mobility" | "utility", { id: string; level: number } | null>> }, mode: LootCardMode): LootCardView | null {
  const full = mode === "full";
  if (item.kind === "weapon") {
    const level = item.fusion ?? 0;
    const name = weaponName(item.id).toUpperCase();
    const kind = weaponKind(item.id);
    const o = gunOutcome(item.id, level, ctx.slots, ctx.active);
    const mine = ctx.slots[o.slot];
    const mineName = mine && !mine.empty ? weaponName(mine.id).toUpperCase() : "";
    const top = PROFILE.fusion.levels;
    const card: LootCardView = { mode, kind: "gun", title: name, sub: `${kind ? kind.toUpperCase() + "  ·  " : ""}LEVEL ${level}`, verdict: o.verdict, say: "", sayMore: "", heads: null, rows: [], notes: [] };
    if (o.verdict === "max") {
      card.say = `YOUR ${name} IS AT LEVEL ${top}: NOTHING TO GAIN`;
      return card;
    }
    if (o.verdict === "fuse") {
      card.say = mode === "compact" ? `FUSE ${o.from} -> ${o.to}` : `FUSES TO LEVEL ${o.to}`;
      card.sayMore = `YOUR ${name} IS LEVEL ${o.from}${o.slot === ctx.active ? ", IN HAND" : `, SLOT ${o.slot + 1}`}`;
    } else if (o.verdict === "fill") {
      const hand = ctx.slots[ctx.active];
      card.say = `GOES IN SLOT ${o.slot + 1}`;
      card.sayMore = hand && !hand.empty ? `YOU KEEP YOUR ${weaponName(hand.id).toUpperCase()}` : "YOUR HANDS ARE EMPTY";
    } else {
      card.say = `SWAPS FOR YOUR ${mineName}`;
      card.sayMore = `YOUR ${mineName} (LV ${o.from}) GOES DOWN HERE`;
    }
    const get = gunStats(item.id, o.verdict === "fuse" ? o.to : level);
    // what it is set against: your copy as it is now (a fuse), the one it swaps for, or the one in hand (a fill)
    const against = o.verdict === "fuse" ? mine : o.verdict === "swap" ? mine : ctx.slots[ctx.active];
    const have = against && !against.empty ? gunStats(against.id, against.fusion) : null;
    const clip = against && !against.empty ? against.clip : 0;
    if (!full && o.verdict === "fuse") return card;
    card.heads = o.verdict === "fuse" ? [`NOW (LV ${o.from})`, `AFTER (LV ${o.to})`] : [have ? `YOUR ${weaponName(against!.id).toUpperCase()}` : "IN HAND", `THIS ${name}`];
    const oneShot = get.head >= (PROFILE.health ? PROFILE.health.health + PROFILE.health.shield : 150);
    const ttkRow: CardRow = { label: "TIME TO KILL", have: have ? `${have.ttk.toFixed(2)} S` : "-", get: oneShot && !full ? "1 HEADSHOT" : `${get.ttk.toFixed(2)} S`, cmp: have ? cmpOf(have.ttk, get.ttk, true) : 0 };
    const magRow: CardRow = get.heat
      ? { label: "SHOTS TO OVERHEAT", have: have ? String(have.mag) : "-", get: String(get.mag), cmp: have ? cmpOf(have.mag, get.mag, false) : 0 }
      : { label: "MAGAZINE", have: have ? `${clip}/${have.mag}` : "-", get: `${get.mag} FULL`, cmp: have ? cmpOf(have.mag, get.mag, false) : 0 };
    if (!full) {
      card.rows = [ttkRow, magRow];
      return card;
    }
    card.rows = [
      ttkRow,
      { label: "DAMAGE", have: have ? have.dmg : "-", get: get.dmg, cmp: o.verdict === "fuse" && have ? cmpOf(Number.parseFloat(have.dmg), Number.parseFloat(get.dmg), false) : 0 },
      { label: "FIRE RATE", have: have ? `${one(have.rate)} / S` : "-", get: `${one(get.rate)} / S`, cmp: 0 },
      magRow,
      get.heat ? { label: "RELOAD", have: "-", get: "COOLS, NEVER RELOADS", cmp: 0 } : { label: "RELOAD", have: have ? `${have.reload.toFixed(1)} S` : "-", get: `${get.reload.toFixed(1)} S`, cmp: have ? cmpOf(have.reload, get.reload, true) : 0 },
    ];
    if (o.verdict !== "fuse" && oneShot) card.rows.push({ label: "HEADSHOT", have: have ? one(have.head) : "-", get: `${one(get.head)}, ONE SHOT`, cmp: 0 });
    const use = useOf(item.id);
    if (use) card.notes.push(`${kind ?? "It"}: ${use}.`);
    const f1 = PROFILE.fusion.gun[1];
    card.notes.push(
      o.verdict === "fuse"
        ? `A copy of a gun you carry fuses into it: each level +${Math.round((f1.damage - 1) * 100)}% damage, +${Math.round((f1.mag - 1) * 100)}% magazine, a faster reload and less recoil, to level ${top}. A higher copy takes yours to its level.`
        : o.verdict === "swap"
          ? `Taking it puts your ${mineName} down here at its level.`
          : `It goes in your empty slot; you keep what you hold.`,
    );
    card.notes.push(`Time to kill: ${PROFILE.health ? `${PROFILE.health.health} health + ${PROFILE.health.shield} shield` : "150"}, ${Math.round(CARD.ttkHit * 10)} in 10 rounds on the body, close range.`);
    return card;
  }
  if (item.kind === "hack") {
    const def = hackDef(item.id);
    const slot = hackSlotOf(item.id);
    if (!def || !slot) return null;
    const level = item.n ?? 0;
    const held = ctx.held[slot] ?? null;
    const o = hackOutcome(item.id, level, held);
    const name = def.name.toUpperCase();
    const heldName = held ? (hackDef(held.id)?.name ?? held.id).toUpperCase() : "";
    const card: LootCardView = { mode, kind: "hack", title: `${name} HACK`, sub: `${slot.toUpperCase()}  ·  LEVEL ${level}`, verdict: o.verdict, say: "", sayMore: "", heads: null, rows: [], notes: [] };
    if (o.verdict === "max") {
      card.say = `YOUR ${name} IS AT LEVEL ${HACK.fuseLevels}: NOTHING TO GAIN`;
      return card;
    }
    if (o.verdict === "fuse") {
      card.say = mode === "compact" ? `FUSE ${o.from} -> ${o.to}` : `FUSES TO LEVEL ${o.to}`;
      card.sayMore = `YOUR ${name} IS LEVEL ${o.from}`;
    } else if (o.verdict === "swap") {
      card.say = `SWAPS FOR YOUR ${heldName}`;
      card.sayMore = `YOUR ${heldName} (LV ${o.from}) GOES DOWN HERE`;
    } else {
      card.say = `FILLS YOUR ${slot.toUpperCase()} SLOT`;
    }
    const haveCd = held ? cooldownOf(held.id as HackId, held.level) : NaN;
    const getCd = cooldownOf(item.id as HackId, o.verdict === "fuse" ? o.to : level);
    card.heads = [held ? (o.verdict === "fuse" ? `NOW (LV ${o.from})` : `YOUR ${heldName}`) : "NONE", o.verdict === "fuse" ? `AFTER (LV ${o.to})` : `THIS ${name}`];
    card.rows = [{ label: "COOLDOWN", have: held ? `${one(haveCd)} S` : "-", get: `${one(getCd)} S`, cmp: held ? cmpOf(haveCd, getCd, true) : 0 }];
    if (full) {
      card.notes.push(`${name}: ${def.blurb}`);
      card.notes.push(o.verdict === "swap" ? `Your ${heldName} goes down here; the cooldown now running carries over.` : `A copy of a hack you carry fuses it: each level shortens its cooldown, to level ${HACK.fuseLevels}.`);
    }
    return card;
  }
  return null;
}
