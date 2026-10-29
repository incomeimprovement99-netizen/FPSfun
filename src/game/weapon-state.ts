// Firing, ammo, reload, ADS transition and the per-shot hooks into spread
// and view kick. Fire timing is accumulated so the rate is exact.
//
// The one gun that is not a plain trigger (weapons.ts WeaponMech, the rules in
// src/config/weapon-mechanics.json): the L-STAR (CHOOCH) has no magazine, the
// clip is its heat; empty is an overheat and a forced cooldown, and it cools
// back when you stop. The legacy guns' own (the HAVOC's wind-up, the Charge
// Rifle, the Devotion's spin-up, the 30-30's aimed charge, the choke, the
// Nemesis' and the Hemlok's bursts, the Bocek's draw) went with them, Milestone
// 522.
//
// Ammo: a reload takes what it can from `supply` (the inventory or the gun's
// own energy stockpile, loadout.ts); with no supply (the range) it is free.
import type { ResolvedWeapon } from "./weapons";
import { SpreadState, type Motion, type Stance } from "./spread";
import { ViewKick, type KickResult } from "./recoil";

export interface ShotRequest {
  cone: number; // degrees, full cone
  kick: KickResult;
}

/** where a reload's rounds come from */
export interface AmmoSupply {
  available(): number;
  /** take up to n, returns how many were taken */
  take(n: number): number;
}

export class WeaponState {
  w: ResolvedWeapon;
  clip: number;
  reloading = false;
  private reloadDoneAt = 0;
  private reloadTotal = 1;
  adsFrac = 0;
  private nextShotAt = 0;
  private triggerWasDown = false;
  readonly spread: SpreadState;
  readonly kick: ViewKick;
  lastShotAt = -Infinity;
  shotsFired = 0;
  private dryFire = false;
  /** null: the range's endless ammo */
  supply: AmmoSupply | null = null;
  private noAmmo = false;

  // ---- the L-STAR's heat
  /** in its forced cooldown */
  overheated = false;
  private coolAcc = 0;
  /** an overheat began this frame (for the sound); read and cleared by the loop */
  overheatStarted = false;

  /** true once per empty trigger pull, so the caller can play a click */
  consumeDryFire(): boolean {
    const d = this.dryFire;
    this.dryFire = false;
    return d;
  }

  /** true once when a reload was asked for with nothing left to load */
  consumeNoAmmo(): boolean {
    const d = this.noAmmo;
    this.noAmmo = false;
    return d;
  }

  constructor(w: ResolvedWeapon) {
    this.w = w;
    this.clip = w.clipSize;
    this.spread = new SpreadState(w);
    this.kick = new ViewKick(w);
  }

  /**
   * Swap weapon. Cancels any reload in flight, because its finish time was
   * computed from the old weapon's timings, and tops the mag up: a new gun
   * comes with a full magazine, never a partially-timed reload.
   */
  setWeapon(w: ResolvedWeapon): void {
    this.w = w;
    this.spread.setWeapon(w);
    this.kick.setWeapon(w);
    this.reloading = false;
    this.clip = w.clipSize;
    // the old gun's cooldown is not this one's (a sniper's rechamber held a
    // lent pistol); a fresh click is needed, as after a deploy
    this.nextShotAt = -Infinity;
    this.triggerWasDown = true;
    this.overheated = false;
    this.coolAcc = 0;
  }

  /**
   * Abandon whatever the weapon was doing because it is being put away: a
   * reload. An overheat's cooldown stays: it is heat.
   */
  cancelAction(): void {
    if (!this.overheated) this.reloading = false;
  }

  /**
   * The same gun rebuilt (its fusion level up). Unlike a deploy this must NOT
   * touch the recoil spring, heat or pattern cursor, or a rebuild becomes an
   * instant recoil-cancel. Nor does it fill the magazine or end a reload: the
   * rounds in the gun stay (fusion tops them up itself, loadout.ts fuse).
   */
  setBuild(w: ResolvedWeapon): void {
    this.w = w;
    this.spread.setWeapon(w);
    this.kick.setWeaponKeepState(w);
    this.clip = Math.min(this.clip, w.clipSize);
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
    this.triggerWasDown = true; // require a fresh click before a semi-auto fires
    this.nextShotAt = -Infinity;
  }

  /**
   * the reload under way is from an empty magazine (the longer one, the round chambered again: the handle racked, the
   * bolt worked), not a tactical one with a round still in the chamber. The views and the figure others see read it.
   */
  reloadEmpty = false;

  /** a reload by the key: not on an overheating gun (it cools instead), not with nothing to load */
  startReload(now: number): void {
    if (this.w.mech.overheat) return;
    this.beginReload(now, this.clip === 0 ? this.w.reloadEmptyTime : this.w.reloadTime, this.clip === 0);
  }

  private beginReload(now: number, seconds: number, empty: boolean): void {
    if (this.reloading || this.clip >= this.w.clipSize) return;
    if (this.supply && this.supply.available() <= 0) {
      this.noAmmo = true;
      return;
    }
    this.reloading = true;
    this.reloadEmpty = empty;
    this.reloadTotal = Math.max(0.01, seconds);
    this.reloadDoneAt = now + this.reloadTotal;
  }

  /** the reload under way's length, seconds (its sound is timed to it) */
  get reloadSeconds(): number {
    return this.reloadTotal;
  }

  reloadProgress(now: number): number {
    if (!this.reloading) return 0;
    return 1 - Math.max(0, this.reloadDoneAt - now) / this.reloadTotal;
  }

  /** the L-STAR's heat, 0..1 */
  get heat(): number {
    return this.w.mech.overheat ? 1 - this.clip / Math.max(1, this.w.clipSize) : 0;
  }

  /** the rounds a supply gives, up to `need` (all of them with none) */
  private fill(need: number): number {
    if (need <= 0) return 0;
    return this.supply ? this.supply.take(need) : need;
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
    const m = this.w.mech;
    // ADS transition
    const rate = adsHeld ? dt / this.w.adsIn : -dt / this.w.adsOut;
    this.adsFrac = Math.max(0, Math.min(1, this.adsFrac + rate));

    if (this.reloading && now >= this.reloadDoneAt) {
      this.reloading = false;
      this.clip += this.fill(this.w.clipSize - this.clip);
      this.overheated = false;
      this.coolAcc = 0;
    }
    // the L-STAR cools when you stop: rounds of heat come back (from the supply)
    if (m.overheat && !triggerDown && !this.reloading && now - this.lastShotAt >= m.overheat.coolDelay && this.clip < this.w.clipSize) {
      this.coolAcc += (dt * this.w.clipSize) / m.overheat.coolTime;
      const whole = Math.floor(this.coolAcc);
      if (whole > 0) {
        this.coolAcc -= whole;
        this.clip += this.fill(Math.min(whole, this.w.clipSize - this.clip));
      }
    }

    const interval = this.w.shotInterval;

    const shots: ShotRequest[] = [];
    /** how much of this frame the recoil spring has already been advanced by */
    let spent = 0;
    const semi = this.w.semiAuto;

    const fresh = triggerDown && !this.triggerWasDown;
    let wantShot = false;
    if (!this.reloading) wantShot = semi ? fresh : triggerDown;
    this.triggerWasDown = triggerDown;

    if (wantShot && this.clip <= 0) {
      if (!this.reloading) this.dryFire = true;
      if (!m.overheat) this.startReload(now);
      wantShot = false;
    }

    if (wantShot) {
      // A new pull, or a trigger held through a long idle, starts the schedule
      // from now. A stale time left within one interval must not survive a new
      // pull: the shot it lets through would schedule the next one early (two
      // Wingman shots 83 ms apart, two sniper shots 0.2 s apart). An idle is no
      // shot in the frame before, or a schedule further behind than this frame
      // could owe (a gun just changed has none): one fallen behind while it
      // fired was the frame rate's, and starting it over lost the shots owed,
      // an R-97 firing 15 a second at 15 fps of its 18 (Milestone 895).
      if (fresh || now - this.nextShotAt > dt + interval || now - this.lastShotAt > dt + interval) this.nextShotAt = Math.max(this.nextShotAt, now);
      while (this.nextShotAt <= now && this.clip > 0) {
        // The spring runs between the shots of a frame, not only between
        // frames. At 144 fps that is one shot a frame and it makes no
        // difference; at 25 it is four or five stacked on top of each other
        // with no recovery in between, and the pattern a burst draws then
        // depends on the machine it was fired on rather than on the gun.
        const gap = Math.max(0, Math.min(dt - spent, this.nextShotAt - (now - dt + spent)));
        if (gap > 0) {
          this.kick.update(gap, this.adsFrac > 0.5, now - dt + spent + gap);
          spent += gap;
        }
        this.clip--;
        this.shotsFired++;
        this.lastShotAt = now;
        const cone = this.spread.cone();
        this.spread.onShot(now, this.adsFrac);
        const kick = this.kick.kick(now, this.adsFrac > 0.5, inAir, crouched, rnd);
        shots.push({ cone, kick });
        this.nextShotAt += interval;
        if (semi) break;
      }
      // the L-STAR's last round of heat: overheated, a forced cooldown
      if (m.overheat && this.clip <= 0 && !this.reloading) {
        this.overheated = true;
        this.overheatStarted = true;
        this.reloading = true;
        this.reloadTotal = m.overheat.lockout;
        this.reloadDoneAt = now + m.overheat.lockout;
        this.coolAcc = 0;
      }
    }

    this.spread.update(dt, now, stance, motion, this.adsFrac);
    this.kick.update(Math.max(0, dt - spent), this.adsFrac > 0.5, now);
    return shots;
  }
}
