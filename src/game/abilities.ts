// The two abilities (src/config/abilities.json): JOLT, a dash, and TRIAGE,
// heals twice as fast. You pick one when it becomes available: on landing in a
// battle royale, at the first countdown of a 1v1v1 or a bot match (and at
// every countdown after, to change it), or any time in the range. The match
// says whether abilities are on (the host's setting, in the welcome).
//
// This holds the choice and JOLT's charges (two, each back 4 s after the one
// before it: a full refill in 8 s); the dash itself is movement (Player.jolt)
// and TRIAGE is a scale on the heal times.
import cfg from "../config/abilities.json";
import kits from "../config/kits.json";

/**
 * The kits (kits.json): each ability is now a kit's tactical or passive, with
 * an ultimate beside it. The ids stay "jolt" and "triage", which the bots and
 * the settings already use; what the player sees is the kit.
 */
export const KITS = kits;
export interface KitInfo {
  kit: string;
  tactical: string;
  passive: string;
  ult: string;
  /** one line for the card: all three */
  blurb: string;
}

export type AbilityId = "jolt" | "triage" | "scout" | "hook" | "smoke";
export const ABILITY_IDS: AbilityId[] = ["jolt", "triage", "scout", "hook", "smoke"];
/** the kits a bot takes: the two it can play (SCOUT's is all sight, which a bot's own eyes already do) */
export const BOT_ABILITY_IDS: AbilityId[] = ["jolt", "triage"];

export interface AbilityInfo {
  id: AbilityId;
  name: string;
  blurb: string;
}
export const ABILITIES: Record<AbilityId, AbilityInfo> = {
  jolt: { id: "jolt", name: cfg.jolt.name, blurb: cfg.jolt.blurb },
  triage: { id: "triage", name: cfg.triage.name, blurb: cfg.triage.blurb },
  scout: { id: "scout", name: kits.scout.tactical.name, blurb: `every enemy within ${kits.scout.tactical.range} m in front of you shown for ${kits.scout.tactical.seconds} s` },
  hook: { id: "hook", name: kits.hook.tactical.name, blurb: `a line at what you look at within ${kits.hook.tactical.range} m, and a pull to it` },
  smoke: { id: "smoke", name: kits.smoke.tactical.name, blurb: `a cloud ${kits.smoke.radius * 2} m across that nobody sees through, for ${kits.smoke.seconds} s` },
};
export const JOLT = cfg.jolt;

/** each kit as the card and the HUD show it */
export function kitOf(id: AbilityId): KitInfo {
  if (id === "jolt") {
    const u = kits.runner.ult;
    return { kit: kits.runner.name, tactical: cfg.jolt.name, passive: kits.runner.passive, ult: u.name, blurb: `${cfg.jolt.name}: ${JOLT.blurb}. ${kits.runner.passive}: no stun from a hard landing. ${u.name}: ${u.seconds} s ${Math.round((u.speed - 1) * 100)}% faster, JOLT refilled` };
  }
  if (id === "smoke") {
    const t = kits.smoke.tactical;
    const u = kits.smoke.ult;
    return { kit: kits.smoke.name, tactical: t.name, passive: kits.smoke.passive, ult: u.name, blurb: `${t.name}: a cloud ${kits.smoke.radius * 2} m across at what you look at within ${t.range} m, for ${kits.smoke.seconds} s, every ${t.cooldown} s. ${kits.smoke.passive}: an enemy in your smoke is shown to you. ${u.name}: ${u.count} of them in a line across your view` };
  }
  if (id === "hook") {
    const t = kits.hook.tactical;
    const u = kits.hook.ult;
    return { kit: kits.hook.name, tactical: t.name, passive: kits.hook.passive, ult: u.name, blurb: `${t.name}: a line at what you look at within ${t.range} m and a pull to it, every ${t.cooldown} s. ${kits.hook.passive}: half again as much climb. ${u.name}: a zipline up to ${u.length} m long, for anyone, for ${u.seconds} s` };
  }
  if (id === "scout") {
    const t = kits.scout.tactical;
    const u = kits.scout.ult;
    return { kit: kits.scout.name, tactical: t.name, passive: kits.scout.passive, ult: u.name, blurb: `${t.name}: every enemy within ${t.range} m in front shown for ${t.seconds} s, every ${t.cooldown} s. ${kits.scout.passive}: an enemy firing within ${kits.scout.hearing} m is shown too. ${u.name}: every enemy within ${u.range} m, any way they are, for ${u.seconds} s` };
  }
  const t = kits.medic.tactical;
  const u = kits.medic.ult;
  return { kit: kits.medic.name, tactical: t.name, passive: cfg.triage.name, ult: u.name, blurb: `${t.name}: ${t.health} health over ${t.seconds} s, every ${t.cooldown} s. ${cfg.triage.name}: ${cfg.triage.blurb}. ${u.name}: ${u.health} health to your team within ${u.radius} m` };
}

/** the dash as the config ships it, to reset a setting back to it */
export const JOLT_DEFAULTS = { distance: cfg.jolt.distance, duration: cfg.jolt.duration, charges: cfg.jolt.charges, recharge: cfg.jolt.recharge };

/**
 * The dash's feel, from Settings. `JOLT` is one object every user reads
 * through, so writing here changes the dash for the player, the bots and the
 * HUD at once. The card's blurb is rewritten so it never claims numbers the
 * dash no longer has.
 */
export function setJolt(v: Partial<{ distance: number; duration: number; charges: number; recharge: number }>): void {
  const clamp = (x: number, lo: number, hi: number, fallback: number): number => (Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : fallback);
  if (v.distance !== undefined) JOLT.distance = clamp(v.distance, 2, 30, JOLT.distance);
  if (v.duration !== undefined) JOLT.duration = clamp(v.duration, 0.05, 0.6, JOLT.duration);
  if (v.charges !== undefined) JOLT.charges = Math.round(clamp(v.charges, 1, 4, JOLT.charges));
  if (v.recharge !== undefined) JOLT.recharge = clamp(v.recharge, 1, 30, JOLT.recharge);
  const each = JOLT.charges > 1 ? `, ${JOLT.charges} charges, one back every ${JOLT.recharge} s` : `, back every ${JOLT.recharge} s`;
  JOLT.blurb = `dash ${JOLT.distance} m the way you are moving${each}`;
  ABILITIES.jolt.blurb = JOLT.blurb;
}
export const TRIAGE = cfg.triage;
export const BOT_ABILITY = cfg.bots;

/** a small number for the network: 0 none, 1 JOLT, 2 TRIAGE */
export const abilityCode = (a: AbilityId | null): number => (a ? ABILITY_IDS.indexOf(a) + 1 : 0);
export const abilityFromCode = (c: unknown): AbilityId | null => (typeof c === "number" && c >= 1 && c <= ABILITY_IDS.length ? ABILITY_IDS[c - 1] : null);

export class Abilities {
  /** what you picked, or nothing yet */
  picked: AbilityId | null = null;
  /** the match (or the range) allows abilities */
  enabled = false;
  /** the choice card is up */
  choosing = false;
  /** JOLT's charges in hand, and when the next one is back (Infinity: they are all there) */
  private charges: number = JOLT.charges;
  private rechargeAt = Infinity;
  /** the start of the last JOLT, game clock (the gap before the next) */
  private lastUseAt = -Infinity;
  /** when the card went up, for the HUD's slide-in */
  offeredAt = -Infinity;
  /** the ultimate's meter, 0 to 1 (kits.json ultimate): kept through deaths, emptied by a new match */
  ult = 0;
  /** MEDIC's PATCH, SCOUT's PULSE and HOOK's GRAPPLE: when each can go again */
  private patchAt = -Infinity;
  private pulseAt = -Infinity;
  private grappleAt = -Infinity;
  private canisterAt = -Infinity;

  /** SMOKE's CANISTER, if it is ready: starts its cooldown and says yes */
  tryCanister(now: number): boolean {
    if (!this.enabled || this.picked !== "smoke" || now < this.canisterAt) return false;
    this.canisterAt = now + KITS.smoke.tactical.cooldown;
    return true;
  }

  /** seconds until CANISTER is back (0: ready) */
  canisterLeft(now: number): number {
    return Math.max(0, this.canisterAt - now);
  }

  /** HOOK's GRAPPLE, if it is ready: starts its cooldown and says yes */
  tryGrapple(now: number): boolean {
    if (!this.enabled || this.picked !== "hook" || now < this.grappleAt) return false;
    this.grappleAt = now + KITS.hook.tactical.cooldown;
    return true;
  }

  /** seconds until GRAPPLE is back (0: ready) */
  grappleLeft(now: number): number {
    return Math.max(0, this.grappleAt - now);
  }

  /** a grapple that found nothing: no cooldown for a line thrown at the sky */
  refundGrapple(): void {
    this.grappleAt = -Infinity;
  }

  /** SCOUT's PULSE, if it is ready: starts its cooldown and says yes */
  tryPulse(now: number): boolean {
    if (!this.enabled || this.picked !== "scout" || now < this.pulseAt) return false;
    this.pulseAt = now + KITS.scout.tactical.cooldown;
    return true;
  }

  /** seconds until PULSE is back (0: ready) */
  pulseLeft(now: number): number {
    return Math.max(0, this.pulseAt - now);
  }

  /** the meter: time passing, and damage dealt */
  chargeUlt(dt: number, damage = 0): void {
    if (!this.enabled || !this.picked) return;
    this.ult = Math.min(1, this.ult + Math.max(0, dt) / KITS.ultimate.fullAfter + Math.max(0, damage) * KITS.ultimate.perDamage);
  }

  /** the ultimate, if the meter is full: spends it and says yes */
  tryUlt(): boolean {
    if (!this.enabled || !this.picked || this.ult < 1) return false;
    this.ult = 0;
    return true;
  }

  /** MEDIC's PATCH, if it is ready: starts its cooldown and says yes */
  tryPatch(now: number): boolean {
    if (!this.enabled || this.picked !== "triage" || now < this.patchAt) return false;
    this.patchAt = now + KITS.medic.tactical.cooldown;
    return true;
  }

  /** seconds until PATCH is back (0: ready) */
  patchLeft(now: number): number {
    return Math.max(0, this.patchAt - now);
  }

  /** the ability becomes available: put the card up (a pick already made stays, and can be changed) */
  offer(now: number): void {
    if (!this.enabled) return;
    this.choosing = true;
    this.offeredAt = now;
  }

  pick(id: AbilityId): void {
    if (!this.enabled) return;
    if (this.picked !== id) this.fill();
    this.picked = id;
    this.choosing = false;
  }

  /** a new match or the menu: nothing picked, the card down */
  reset(enabled: boolean): void {
    this.enabled = enabled;
    this.picked = null;
    this.choosing = false;
    this.ult = 0;
    this.patchAt = -Infinity;
    this.pulseAt = -Infinity;
    this.grappleAt = -Infinity;
    this.canisterAt = -Infinity;
    this.fill();
  }

  /** both charges back (a new life's start keeps what you had: only a pick or a new match fills them) */
  fill(): void {
    this.charges = JOLT.charges;
    this.rechargeAt = Infinity;
    this.lastUseAt = -Infinity;
  }

  /** the charges that have come back by now: one every `recharge` seconds, one at a time */
  private settle(now: number): void {
    while (this.charges < JOLT.charges && now >= this.rechargeAt) {
      this.charges++;
      this.rechargeAt = this.charges < JOLT.charges ? this.rechargeAt + JOLT.recharge : Infinity;
    }
  }

  /** JOLT's charges now, how many it holds, and the seconds until the next one is back (0: all there) */
  charge(now: number): { charges: number; max: number; nextIn: number; recharge: number } {
    this.settle(now);
    return { charges: this.charges, max: JOLT.charges, nextIn: Number.isFinite(this.rechargeAt) ? Math.max(0, this.rechargeAt - now) : 0, recharge: JOLT.recharge };
  }

  /** seconds until JOLT can go again (0: a charge is ready and the gap has passed) */
  cooldownLeft(now: number): number {
    if (this.picked !== "jolt") return 0;
    this.settle(now);
    const gap = Math.max(0, this.lastUseAt + JOLT.gap - now);
    return this.charges > 0 ? gap : Math.max(gap, this.rechargeAt - now);
  }

  /** JOLT, if it is picked and a charge is ready: spends one (the next starts coming back) and says yes */
  tryJolt(now: number): boolean {
    if (!this.enabled || this.picked !== "jolt" || this.cooldownLeft(now) > 0) return false;
    this.charges--;
    if (!Number.isFinite(this.rechargeAt)) this.rechargeAt = now + JOLT.recharge;
    this.lastUseAt = now;
    return true;
  }

  /** the use was refused after all (the movement code said no): give the charge back */
  refund(): void {
    this.charges = Math.min(JOLT.charges, this.charges + 1);
    if (this.charges >= JOLT.charges) this.rechargeAt = Infinity;
    this.lastUseAt = -Infinity;
  }

  /** heal times divide by this */
  get healScale(): number {
    return this.enabled && this.picked === "triage" ? TRIAGE.healSpeed : 1;
  }
}
