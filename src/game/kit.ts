// Your armour and your knockdown shield, the legacy game's (src/config/items.json); they go with its battle royale.
//
// Armour: a shield core that levels with EVO (the damage you deal) from white
// 50 to blue 75 to purple 100; the gold helmet sets it to 100, the mythic one
// to 125.
//
// A KNOCKDOWN SHIELD is what soaks the shots aimed at you while you are down:
// your EVO level sets the floor, a better one off the floor raises it, and the
// gold one carries a single self-revive that a long, droppable channel spends.
// It knows nothing about the world, so the down code, the HUD and the loot
// code drive it from outside and this file stays arithmetic.
//
// The heals you carried, the heal wheel and the backpacks that made room for
// them went in Milestone 523: SpeedKills' health comes back on its own, and its
// one heal is the HEAL hack.
import cfg from "../config/items.json";

export type Helmet = keyof typeof cfg.helmets;

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

export type KnockTier = keyof typeof cfg.knockdown;
export const KNOCK_SHIELDS = cfg.knockdown;
/** the knockdown shields worst to best; the first three are the EVO levels' */
export const KNOCK_ORDER: KnockTier[] = ["white", "blue", "purple", "gold"];
export const SELF_REVIVE = cfg.selfRevive;

/**
 * What one frame of the self-revive did. "cancelled" comes back once, on the
 * frame the channel stopped, so a caller can play a sound for it and can tell
 * a hold that broke from a hold that never started.
 */
export type SelfReviveState = { state: "idle" } | { state: "running"; progress: number } | { state: "cancelled" } | { state: "done"; health: number };

const rankOf = (t: KnockTier | null): number => (t === null ? -1 : KNOCK_ORDER.indexOf(t));

/**
 * The knockdown shield: what soaks the shots aimed at you while you are down.
 *
 * Since Season 28 its size is your EVO level's, so this starts from the level
 * and treats a shield you found as something that raises a floor. Pick a
 * purple one up while you are still white and you go down behind 750 instead
 * of 200, and levelling past it later costs you nothing. Gold is the only
 * tier that changes a decision rather than a number, because it is the only
 * one carrying a self-revive.
 *
 * It knows nothing about the world. Whether a shot was inside the arc, what
 * the crawl speed is, whether you moved: all of that is the caller's, and it
 * arrives here as absorb() and as the two booleans selfRevive() takes.
 */
export class Knockdown {
  /** the shield you found, or null with only the one your EVO level gives */
  looted: KnockTier | null = null;
  /** self-revives left in the shield you carry: a gold one arrives with one */
  selfLeft = 0;
  /** what it has left this knock, and what it started the knock at */
  hp = 0;
  max = 0;
  /** raised (main.ts holds fire while down), so absorb() can take the hit */
  up = false;
  /** the knock it belongs to, so a second knock refills it and a frame does not */
  knock = -1;
  /** when the self-revive channel started, or null while nothing is running */
  private channelAt: number | null = null;

  /** a new life: no looted shield, no self-revive, nothing raised */
  reset(): void {
    this.looted = null;
    this.selfLeft = 0;
    this.hp = 0;
    this.max = 0;
    this.up = false;
    this.knock = -1;
    this.channelAt = null;
  }

  /** the shield in force at this EVO level: the level's, or the better one you found */
  tierFor(evoLevel: number): KnockTier {
    // clamped by the shield core's levels rather than by KNOCK_ORDER, so no
    // amount of EVO can hand you the gold tier: that one is only ever looted
    const lvl = KNOCK_ORDER[Math.max(0, Math.min(SHIELD_LEVELS.length - 1, evoLevel - 1))];
    return rankOf(this.looted) > rankOf(lvl) ? (this.looted as KnockTier) : lvl;
  }

  /** what the shield in force is called, for the HUD and the loot prompt */
  labelFor(evoLevel: number): string {
    return KNOCK_SHIELDS[this.tierFor(evoLevel)].name;
  }

  /** the shield in force as a loot rarity, for the HUD to colour it */
  rarityFor(evoLevel: number): string {
    return KNOCK_SHIELDS[this.tierFor(evoLevel)].rarity;
  }

  /**
   * A knockdown shield off the floor. It is worth taking when it beats what
   * you have in force, and a gold one is worth taking again once the one you
   * carry has spent its self-revive on you: the same 750, but the revive is
   * the item. False means leave it lying there.
   *
   * It deliberately does not touch the shield you are behind right now. Apex
   * fixes that one at the knock and it stays broken until the next knock, and
   * picking a better one up mid-crawl should not undo a fight you just lost.
   */
  take(tier: KnockTier, evoLevel: number): boolean {
    const grant = KNOCK_SHIELDS[tier].selfRevives;
    if (rankOf(tier) <= rankOf(this.tierFor(evoLevel)) && grant <= this.selfLeft) return false;
    if (rankOf(tier) > rankOf(this.looted)) this.looted = tier;
    this.selfLeft = Math.max(this.selfLeft, grant);
    return true;
  }

  /**
   * A new knock: the shield comes back full at the tier in force. Returns
   * true only the first time it is called for a knock, so a caller can say so
   * on the HUD without repeating it every frame.
   */
  onKnock(knockCount: number, evoLevel: number): boolean {
    if (this.knock === knockCount) return false;
    this.knock = knockCount;
    this.max = KNOCK_SHIELDS[this.tierFor(evoLevel)].hp;
    this.hp = this.max;
    this.up = false;
    this.channelAt = null;
    return true;
  }

  /**
   * Damage the caller has already decided came in through the arc: what is
   * left over for you, and whether this was the hit that broke it. Broken, it
   * drops and stays down until the next knock.
   */
  absorb(amount: number): { through: number; broke: boolean } {
    if (!this.up || this.hp <= 0) return { through: amount, broke: false };
    // never below zero: a caller handing this a negative amount must not heal
    // the shield back above the size the knock gave it
    const took = Math.max(0, Math.min(this.hp, amount));
    this.hp -= took;
    if (this.hp > 0) return { through: amount - took, broke: false };
    this.up = false;
    return { through: amount - took, broke: true };
  }

  /** a gold shield with its self-revive still in it */
  get canSelfRevive(): boolean {
    return this.selfLeft > 0;
  }

  /**
   * The self-revive, a frame at a time. `held` is the key, and `interrupted`
   * is the caller's judgement of everything this file cannot see: you took a
   * hit, you crawled, a squad mate started picking you up, the match ended.
   *
   * Nothing is kept when it stops. Seven seconds of holding still is the
   * price of the tier, and a channel that resumed where it broke would make
   * shooting the crawling enemy pointless, which is the decision the gold
   * shield exists to create.
   */
  selfRevive(now: number, held: boolean, interrupted: boolean): SelfReviveState {
    if (!this.canSelfRevive || !held || interrupted) {
      const running = this.channelAt !== null;
      this.channelAt = null;
      return running ? { state: "cancelled" } : { state: "idle" };
    }
    // `now < channelAt` is a clock that went backwards under a running
    // channel (a new match's gameTime). Re-anchor rather than stall: a
    // channel left anchored in the old match's future would sit at 0 for ever
    // and neither finish nor cancel.
    if (this.channelAt === null || now < this.channelAt) this.channelAt = now;
    const t = (now - this.channelAt) / SELF_REVIVE.time;
    if (t < 1) return { state: "running", progress: Math.max(0, Math.min(1, t)) };
    this.channelAt = null;
    this.selfLeft--;
    // you are standing: whatever the knock raised is not raised any more
    this.up = false;
    return { state: "done", health: SELF_REVIVE.health };
  }

  /** how far into the channel it is for the HUD's bar, or null with none running */
  selfProgress(now: number): number | null {
    if (this.channelAt === null) return null;
    return Math.max(0, Math.min(1, (now - this.channelAt) / SELF_REVIVE.time));
  }
}
