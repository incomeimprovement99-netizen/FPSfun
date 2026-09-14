// Firing, ammo, reload, ADS transition and the per-shot hooks into spread
// and view kick. Fire timing is accumulated so the rate is exact.
import type { ResolvedWeapon } from "./weapons";
import { SpreadState, type Motion, type Stance } from "./spread";
import { ViewKick, type KickResult } from "./recoil";

export interface ShotRequest {
  cone: number; // degrees, full cone
  kick: KickResult;
}

export class WeaponState {
  w: ResolvedWeapon;
  clip: number;
  reloading = false;
  private reloadDoneAt = 0;
  adsFrac = 0;
  private nextShotAt = 0;
  private triggerWasDown = false;
  private burstLeft = 0;
  private burstEndedAt = -Infinity;
  readonly spread: SpreadState;
  readonly kick: ViewKick;
  lastShotAt = -Infinity;
  shotsFired = 0;
  private dryFire = false;

  /** rounds left in the current burst, for tests and diagnostics */
  get burstRemaining(): number {
    return this.burstLeft;
  }

  /** true once per empty trigger pull, so the caller can play a click */
  consumeDryFire(): boolean {
    const d = this.dryFire;
    this.dryFire = false;
    return d;
  }

  constructor(w: ResolvedWeapon) {
    this.w = w;
    this.clip = w.clipSize;
    this.spread = new SpreadState(w);
    this.kick = new ViewKick(w);
  }

  /**
   * Swap weapon or mag level. Cancels any reload in flight, because its
   * finish time was computed from the old weapon's timings, and tops the mag
   * up: this is a range with unlimited ammo, so a swap should never leave you
   * holding a partially-timed reload.
   */
  setWeapon(w: ResolvedWeapon): void {
    this.w = w;
    this.spread.setWeapon(w);
    this.kick.setWeapon(w);
    this.reloading = false;
    this.clip = w.clipSize;
    this.burstLeft = 0;
    this.burstEndedAt = -Infinity;
  }

  /**
   * Abandon whatever the weapon was doing because it is being put away.
   * The burst matters: burst fire is driven by `burstLeft`, not by the
   * trigger, so a weapon mid-burst would keep firing while holstered.
   */
  cancelAction(): void {
    this.reloading = false;
    this.burstLeft = 0;
  }

  /**
   * Change mag level on the weapon in hand. Unlike a deploy this must NOT
   * touch the recoil spring, heat or pattern cursor, or the mag key becomes
   * an instant recoil-cancel button that is strictly better than not using it.
   */
  setMagLevel(w: ResolvedWeapon): void {
    this.w = w;
    this.spread.setWeapon(w);
    this.kick.setWeaponKeepState(w);
    this.reloading = false;
    this.clip = w.clipSize;
  }

  /**
   * Called when this weapon is raised after a swap. The gun comes up hip-fired
   * with a settled spring; it must not inherit the outgoing weapon's ADS
   * fraction or leftover recoil.
   */
  onDeploy(): void {
    this.adsFrac = 0;
    this.kick.reset();
    // the holstered weapon's spread was frozen while it was away (only the
    // active slot ticks), so it must come up settled rather than resuming a
    // sprint cone from before the swap
    this.spread.settle();
    this.burstLeft = 0;
    this.triggerWasDown = true; // require a fresh click before a semi/burst fires
    this.nextShotAt = -Infinity;
  }

  startReload(now: number): void {
    if (this.reloading || this.clip >= this.w.clipSize) return;
    this.reloading = true;
    this.reloadDoneAt = now + (this.clip === 0 ? this.w.reloadEmptyTime : this.w.reloadTime);
  }

  reloadProgress(now: number): number {
    if (!this.reloading) return 0;
    const total = this.clip === 0 ? this.w.reloadEmptyTime : this.w.reloadTime;
    return 1 - Math.max(0, this.reloadDoneAt - now) / total;
  }

  /**
   * Advance one frame. Returns the shots to spawn this frame (0..n).
   */
  update(
    dt: number,
    now: number,
    triggerDown: boolean,
    adsHeld: boolean,
    stance: Stance,
    motion: Motion,
    inAir: boolean,
    crouched: boolean,
    rnd: () => number
  ): ShotRequest[] {
    // ADS transition
    const rate = adsHeld ? dt / this.w.adsIn : -dt / this.w.adsOut;
    this.adsFrac = Math.max(0, Math.min(1, this.adsFrac + rate));

    if (this.reloading && now >= this.reloadDoneAt) {
      this.reloading = false;
      this.clip = this.w.clipSize;
    }

    const shots: ShotRequest[] = [];
    // shotInterval, not 1/fireRate: pump and bolt-action weapons are limited
    // by their rechamber time instead
    const interval = this.w.shotInterval;
    const semi = this.w.semiAuto;
    const burst = this.w.burstCount > 1;

    let wantShot = false;
    if (!this.reloading) {
      if (burst) {
        // burst_fire_delay is a real gameplay constant in the data: bursts
        // cannot be chained faster than this gap, however fast you click.
        const ready = now >= this.burstEndedAt + this.w.burstDelay;
        if (triggerDown && !this.triggerWasDown && this.burstLeft === 0 && ready) {
          this.burstLeft = this.w.burstCount;
        }
        wantShot = this.burstLeft > 0;
      } else if (semi) {
        wantShot = triggerDown && !this.triggerWasDown;
      } else {
        wantShot = triggerDown;
      }
    }
    this.triggerWasDown = triggerDown;

    if (wantShot && this.clip <= 0) {
      if (!this.reloading) this.dryFire = true;
      this.startReload(now);
      this.burstLeft = 0;
      wantShot = false;
    }

    if (wantShot) {
      if (this.nextShotAt < now - interval) this.nextShotAt = now; // idle: fire immediately
      while (this.nextShotAt <= now && this.clip > 0 && (!burst || this.burstLeft > 0)) {
        this.clip--;
        this.shotsFired++;
        this.lastShotAt = now;
        if (burst) {
          this.burstLeft--;
          if (this.burstLeft === 0) this.burstEndedAt = now;
        }
        const cone = this.spread.cone();
        this.spread.onShot(now, this.adsFrac);
        const kick = this.kick.kick(now, this.adsFrac > 0.5, inAir, crouched, rnd);
        shots.push({ cone, kick });
        this.nextShotAt += interval;
        if (semi && !burst) break;
      }
    }

    this.spread.update(dt, now, stance, motion, this.adsFrac);
    this.kick.update(dt, this.adsFrac > 0.5, now);
    return shots;
  }
}
