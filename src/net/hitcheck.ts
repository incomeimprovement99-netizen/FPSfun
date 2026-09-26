// The host's sanity check on a claimed hit (src/config/net.json hitCheck).
//
// The shooter's own browser decides a hit and tells the others how much it
// did: that is what keeps a hit where you saw it at any ping. It also meant a
// friend's page could claim anything, a 999 from across the map with a gun it
// never fired. The host sees every shot and every hit, so it holds each claim
// up to what the gun can do: no more than one round of it can deal, only after
// a shot from that player, from about where the shooter stands, and no faster
// than the gun fires. A claim that fails is dropped before it reaches anyone.
//
// Generous on purpose: this is here to stop a forged or broken claim, not to
// second-guess a real one, so every limit is the gun's best case with room on
// top (a headshot with every damage bonus the gun can have, the positions a
// round trip stale).
import netCfg from "../config/net.json";
import { resolveWeapon, weaponIds, type ResolvedWeapon } from "../game/weapons";

const C = netCfg.hitCheck;
const GUNS = new Set(weaponIds());

export interface HitClaim {
  /** who claims it */
  from: number;
  amount: number;
  /** the weapon id the claim names ("melee" for a swing; none from an older build) */
  weapon: string;
  /** the distance the shooter measured, metres, if it sent one */
  dist: number | null;
}

/** a gun by id, or null for anything that is not one (a swing, an older build's claim with no id) */
function gunOf(id: string): ResolvedWeapon | null {
  if (!id || !GUNS.has(id)) return null;
  try {
    // the most it can be: SpeedKills' top fusion level (the legacy game has none, and ignores it)
    return resolveWeapon(id, 0, [], 5);
  } catch {
    return null;
  }
}

/** the most one round of this gun can deal: a headshot at its nearest range with every bonus it can carry */
export function maxRound(w: ResolvedWeapon): number {
  const d = w.damage;
  const bonus = 1 + (w.mech.adsCharge?.bonus ?? 0);
  return Math.max(d.near, d.far, d.veryFar) * Math.max(1, d.headshot) * Math.max(1, d.shieldScale, d.unshieldedScale) * bonus * C.margin;
}

/** the most this gun can deal in a second: every pellet of every shot at its fastest, and never less than one whole trigger pull (a sniper fires slower than once a second) */
export function maxPerSecond(w: ResolvedWeapon): number {
  const fastest = Math.min(w.shotInterval, w.spin ? 1 / w.spin.to : Infinity);
  const shots = Math.max(1, 1 / Math.max(0.01, fastest));
  return maxRound(w) * Math.max(1, w.pellets) * shots * C.rateMargin;
}

export class HitCheck {
  /** each shooter's claims in the last second, for the rate */
  private recent = new Map<number, Array<{ at: number; amount: number }>>();
  /** claims refused so far, by why (the tests read it; nothing is shown to players) */
  readonly refused: Array<{ from: number; why: string }> = [];

  /**
   * Why a claimed hit is refused, or null to let it through. `lastShotAt` is
   * when the host last heard a shot from the shooter (undefined for never),
   * `apart` how far apart the host sees the two now (null if it cannot say).
   */
  judge(c: HitClaim, now: number, lastShotAt: number | undefined, apart: number | null): string | null {
    const why = this.why(c, now, lastShotAt, apart);
    if (why) {
      this.refused.push({ from: c.from, why });
      if (this.refused.length > 50) this.refused.shift();
    }
    return why;
  }

  private why(c: HitClaim, now: number, lastShotAt: number | undefined, apart: number | null): string | null {
    if (!Number.isFinite(c.amount) || c.amount < 0) return "not a number";
    const melee = c.weapon === "melee";
    const gun = melee ? null : gunOf(c.weapon);
    const cap = gun ? maxRound(gun) : melee ? C.meleeMax : C.otherMax;
    if (c.amount > cap) return `more than one ${melee ? "swing" : "round"} can do (${Math.round(c.amount)} over ${Math.round(cap)})`;
    // a round lands after the shot that fired it: a gun's hit with no shot heard lately is made up
    if (gun && (lastShotAt === undefined || now - lastShotAt > C.shotWindow)) return "no shot fired";
    if (apart !== null) {
      if (melee && apart > C.meleeRange) return `a swing from ${apart.toFixed(1)} m away`;
      if (c.dist !== null && Math.abs(apart - c.dist) > C.rangeSlack + apart * C.rangeShare) return `claimed from ${c.dist.toFixed(0)} m, but ${apart.toFixed(0)} m apart`;
    }
    const list = (this.recent.get(c.from) ?? []).filter((h) => now - h.at < 1);
    const perSecond = gun ? maxPerSecond(gun) : (melee ? C.meleeMax : C.otherMax) * 2;
    const sum = list.reduce((a, h) => a + h.amount, 0);
    if (sum + c.amount > perSecond) {
      this.recent.set(c.from, list);
      return `faster than the gun fires (${Math.round(sum + c.amount)} in a second, over ${Math.round(perSecond)})`;
    }
    list.push({ at: now, amount: c.amount });
    this.recent.set(c.from, list);
    return null;
  }

  /** a player gone: their history with them */
  forget(id: number): void {
    this.recent.delete(id);
  }
}
