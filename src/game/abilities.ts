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

export type AbilityId = "jolt" | "triage";
export const ABILITY_IDS: AbilityId[] = ["jolt", "triage"];

export interface AbilityInfo {
  id: AbilityId;
  name: string;
  blurb: string;
}
export const ABILITIES: Record<AbilityId, AbilityInfo> = {
  jolt: { id: "jolt", name: cfg.jolt.name, blurb: cfg.jolt.blurb },
  triage: { id: "triage", name: cfg.triage.name, blurb: cfg.triage.blurb },
};
export const JOLT = cfg.jolt;

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
