// The two abilities (src/config/abilities.json): JOLT, a dash, and TRIAGE,
// heals twice as fast. You pick one when it becomes available: on landing in a
// battle royale, at the first countdown of a 1v1v1 or a bot match (and at
// every countdown after, to change it), or any time in the range. The match
// says whether abilities are on (the host's setting, in the welcome).
//
// This holds the choice and JOLT's cooldown; the dash itself is movement
// (Player.jolt) and TRIAGE is a scale on the heal times.
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
  /** the start of the last JOLT, game clock */
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
    if (this.picked !== id) this.lastUseAt = -Infinity;
    this.picked = id;
    this.choosing = false;
  }

  /** a new match or the menu: nothing picked, the card down */
  reset(enabled: boolean): void {
    this.enabled = enabled;
    this.picked = null;
    this.choosing = false;
    this.lastUseAt = -Infinity;
  }

  /** seconds until JOLT can go again (0: ready) */
  cooldownLeft(now: number): number {
    if (this.picked !== "jolt") return 0;
    return Math.max(0, this.lastUseAt + JOLT.cooldown - now);
  }

  /** JOLT, if it is picked and ready: starts the cooldown and says yes */
  tryJolt(now: number): boolean {
    if (!this.enabled || this.picked !== "jolt" || this.cooldownLeft(now) > 0) return false;
    this.lastUseAt = now;
    return true;
  }

  /** the use was refused after all (the movement code said no): give the cooldown back */
  refund(): void {
    this.lastUseAt = -Infinity;
  }

  /** heal times divide by this */
  get healScale(): number {
    return this.enabled && this.picked === "triage" ? TRIAGE.healSpeed : 1;
  }
}
