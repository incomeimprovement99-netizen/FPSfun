// Hipfire / ADS cone. Base value by stance and movement, plus a per-shot
// kick that accumulates to a cap and decays after a delay. Values are the
// full cone angle in degrees (interpretation noted in docs/FIDELITY.md).
import type { ResolvedWeapon } from "./weapons";

export type Stance = "stand" | "crouch" | "air";
export type Motion = "still" | "walk" | "sprint";

/** how fast the cone opens when the target rises, degrees per second */
const OPEN_RATE_FLOOR = 60;

export class SpreadState {
  private base: number; // smoothed base cone
  private kick = 0;
  private lastShotAt = -Infinity;

  constructor(private w: ResolvedWeapon) {
    // start AT the standing cone, not 0, or the first ~50 ms after load fire
    // with an impossibly tight spread
    this.base = w.spread.standHip;
  }
  setWeapon(w: ResolvedWeapon): void {
    this.w = w;
    this.kick = 0;
    this.base = Math.min(this.base, w.spread.standHip);
  }

  private target(stance: Stance, motion: Motion, adsFrac: number): number {
    const s = this.w.spread;
    let hip = s.standHip;
    if (stance === "crouch") hip = s.crouchHip;
    else if (stance === "air") hip = s.airHip;
    else if (motion === "sprint") hip = s.sprintHip;
    else if (motion === "walk") hip = s.runHip;
    let ads = s.standAds;
    if (stance === "crouch") ads = s.crouchAds;
    else if (stance === "air") ads = s.airAds;
    return hip + (ads - hip) * adsFrac;
  }

  /** bring the cone back to the resting standing value (used on deploy) */
  settle(): void {
    this.base = this.w.spread.standHip;
    this.kick = 0;
    this.lastShotAt = -Infinity;
  }

  onShot(now: number, adsFrac: number): void {
    const s = this.w.spread;
    const kickOnFire = s.kickOnFireHip + (s.kickOnFireAds - s.kickOnFireHip) * adsFrac;
    const maxKick = s.maxKickHip + (s.maxKickAds - s.maxKickHip) * adsFrac;
    this.kick = Math.min(maxKick, this.kick + kickOnFire);
    this.lastShotAt = now;
  }

  update(dt: number, now: number, stance: Stance, motion: Motion, adsFrac: number): void {
    const t = this.target(stance, motion, adsFrac);
    const rate = this.w.spread.movingDecayRate;
    // approach target; snap up fast when it rises (moving), decay when it falls
    if (t > this.base) this.base = Math.min(t, this.base + Math.max(rate, OPEN_RATE_FLOOR) * dt);
    else this.base = Math.max(t, this.base - rate * dt);
    if (now - this.lastShotAt > this.w.spread.decayDelay) {
      this.kick = Math.max(0, this.kick - this.w.spread.decayRate * dt);
    }
  }

  /** current full cone angle in degrees */
  cone(): number {
    return Math.max(0, this.base + this.kick);
  }
}
