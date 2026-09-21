// Firing, ammo, reload, ADS transition and the per-shot hooks into spread
// and view kick. Fire timing is accumulated so the rate is exact.
//
// The guns that are not a plain trigger (weapons.ts WeaponMech, the rules in
// src/config/weapon-mechanics.json):
//   HAVOC        the trigger winds it up before the first round
//   Charge Rifle the round leaves a fixed time after the trigger
//   Devotion     the fire rate climbs while you hold it (the data's spin-up)
//   L-STAR       no magazine: the clip is its heat; empty is an overheat and a
//                forced cooldown, and it cools back when you stop
//   30-30        aiming charges it; the charge adds damage to the next round
//   Precision Choke  aiming closes the pellet cone
//   Nemesis      each burst charges it and the delay between bursts shortens
//
// Ammo: a reload takes what it can from `supply` (the inventory or the gun's
// own energy stockpile, loadout.ts); with no supply (the range) it is free.
import type { ResolvedWeapon } from "./weapons";
import { SpreadState, type Motion, type Stance } from "./spread";
import { ViewKick, type KickResult } from "./recoil";

export interface ShotRequest {
  cone: number; // degrees, full cone
  kick: KickResult;
  /** the pellet cone this round (a choke closes it) */
  coneScale: number;
  /** the damage this round (a charged 30-30, a drawn arrow) */
  dmgScale: number;
  /** the launch speed this round (a drawn arrow flies faster) */
  speedScale: number;
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
  private burstLeft = 0;
  private burstEndedAt = -Infinity;
  readonly spread: SpreadState;
  readonly kick: ViewKick;
  lastShotAt = -Infinity;
  shotsFired = 0;
  private dryFire = false;
  /** null: the range's endless ammo */
  supply: AmmoSupply | null = null;
  private noAmmo = false;

  // ---- the mechanics' state
  /** HAVOC: 0..1 wound up */
  charge = 0;
  private chargeHeldAt = -Infinity;
  /** Charge Rifle: when the round leaves, or null */
  chargeShotAt: number | null = null;
  /** Devotion: 0..1 of the way to its top rate */
  spin = 0;
  /** L-STAR: in its forced cooldown */
  overheated = false;
  private coolAcc = 0;
  /** 30-30: 0..1 charged by aiming */
  adsCharge = 0;
  /** Precision Choke: 0..1 closed */
  choke = 0;
  /** Nemesis: 0..1 */
  burstCharge = 0;
  /** Bocek: 0..1 drawn */
  drawFrac = 0;
  private lastBurstAt = -Infinity;
  /** a wind-up or a charge began this frame, or an overheat (for the sounds); read and cleared by the loop */
  chargeStarted = false;
  overheatStarted = false;

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

  /** the mechanics' state back to rest (a new gun, a spawn) */
  private resetMech(): void {
    this.charge = 0;
    this.chargeHeldAt = -Infinity;
    this.chargeShotAt = null;
    this.spin = 0;
    this.overheated = false;
    this.coolAcc = 0;
    this.adsCharge = 0;
    this.choke = 0;
    this.burstCharge = 0;
    this.lastBurstAt = -Infinity;
    this.drawFrac = 0;
  }

  /**
   * Swap weapon or mag level. Cancels any reload in flight, because its
   * finish time was computed from the old weapon's timings, and tops the mag
   * up: a new gun comes with a full magazine, never a partially-timed reload.
   */
  setWeapon(w: ResolvedWeapon): void {
    this.w = w;
    this.spread.setWeapon(w);
    this.kick.setWeapon(w);
    this.reloading = false;
    this.clip = w.clipSize;
    this.burstLeft = 0;
    this.burstEndedAt = -Infinity;
    // the old gun's cooldown is not this one's (a Kraber's rechamber held a
    // lent pistol for 2.4 s); a fresh click is needed, as after a deploy
    this.nextShotAt = -Infinity;
    this.triggerWasDown = true;
    this.resetMech();
  }

  /**
   * Abandon whatever the weapon was doing because it is being put away.
   * The burst matters: burst fire is driven by `burstLeft`, not by the
   * trigger, so a weapon mid-burst would keep firing while holstered. A
   * charge in flight goes too. An overheat's cooldown does not: it is heat.
   */
  cancelAction(): void {
    if (!this.overheated) this.reloading = false;
    this.burstLeft = 0;
    this.chargeShotAt = null;
    this.charge = 0;
    this.spin = 0;
  }

  /** stop a burst in flight: it fires without the trigger, so a knock or a round's end must end it */
  cancelBurst(): void {
    this.burstLeft = 0;
    this.chargeShotAt = null;
  }

  /**
   * Change mag level on the weapon in hand. Unlike a deploy this must NOT
   * touch the recoil spring, heat or pattern cursor, or the mag key becomes
   * an instant recoil-cancel button that is strictly better than not using it.
   * For the same reason it must not fill the magazine or end a reload: the
   * rounds in the gun stay, and a bigger mag fills on the next reload.
   */
  setMagLevel(w: ResolvedWeapon): void {
    this.w = w;
    this.spread.setWeapon(w);
    this.kick.setWeaponKeepState(w);
    this.clip = Math.min(this.clip, w.clipSize);
    if (!w.mech.choke) this.choke = 0;
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
    this.charge = 0;
    this.chargeShotAt = null;
    this.spin = 0;
    this.adsCharge = 0;
    this.choke = 0;
  }

  /** a reload by the key: not on an overheating gun (it cools instead), not with nothing to load */
  startReload(now: number): void {
    if (this.w.mech.overheat) return;
    this.beginReload(now, this.clip === 0 ? this.w.reloadEmptyTime : this.w.reloadTime);
  }

  private beginReload(now: number, seconds: number): void {
    if (this.reloading || this.clip >= this.w.clipSize) return;
    if (this.supply && this.supply.available() <= 0) {
      this.noAmmo = true;
      return;
    }
    this.reloading = true;
    this.reloadTotal = Math.max(0.01, seconds);
    this.reloadDoneAt = now + this.reloadTotal;
    this.chargeShotAt = null;
  }

  reloadProgress(now: number): number {
    if (!this.reloading) return 0;
    return 1 - Math.max(0, this.reloadDoneAt - now) / this.reloadTotal;
  }

  /** the L-STAR's heat, 0..1 */
  get heat(): number {
    return this.w.mech.overheat ? 1 - this.clip / Math.max(1, this.w.clipSize) : 0;
  }

  /** how charged the gun is, 0..1, whichever kind it has (the HUD's ring) */
  chargeFrac(now: number): number {
    const m = this.w.mech;
    if (m.chargeShot) return this.chargeShotAt === null ? 0 : Math.max(0, Math.min(1, 1 - (this.chargeShotAt - now) / m.chargeShot.time));
    if (m.chargeUp) return this.charge;
    if (m.draw) return this.drawFrac;
    if (m.adsCharge) return this.adsCharge;
    if (m.choke) return this.choke;
    if (m.burstCharge) return this.burstCharge;
    return 0;
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
    // aimed in: the 30-30 charges and the choke closes; out of the aim they are gone
    const aimed = this.adsFrac >= 0.9;
    if (m.adsCharge) this.adsCharge = aimed ? Math.min(1, this.adsCharge + dt / m.adsCharge.time) : 0;
    if (m.choke) this.choke = aimed ? Math.min(1, this.choke + dt / m.choke.time) : 0;
    if (m.burstCharge && now - this.lastBurstAt > m.burstCharge.decayAfter) this.burstCharge = Math.max(0, this.burstCharge - m.burstCharge.decayRate * dt);

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

    // the HAVOC's wind-up: held trigger winds it, a let-go runs it down
    if (m.chargeUp) {
      if (triggerDown && !this.reloading && this.clip > 0) {
        if (this.charge === 0) this.chargeStarted = true;
        this.charge = Math.min(1, this.charge + dt / Math.max(1e-3, m.chargeUp.time));
        this.chargeHeldAt = now;
      } else if (now - this.chargeHeldAt >= m.chargeUp.coolDelay) this.charge = Math.max(0, this.charge - dt / m.chargeUp.coolTime);
    }
    // the Devotion's spin: up while held, gone when let go (the data's cooldown is 0)
    let interval = this.w.shotInterval;
    if (this.w.spin) {
      const sp = this.w.spin;
      if (triggerDown && !this.reloading && this.clip > 0) this.spin = Math.min(1, this.spin + dt / sp.time);
      else this.spin = 0;
      interval = 1 / (sp.from + (sp.to - sp.from) * this.spin);
    }

    // the bow: hold to draw, let go to loose one arrow; the next one nocks by itself
    if (m.draw) {
      const out: ShotRequest[] = [];
      const letGo = !triggerDown && this.triggerWasDown;
      if (triggerDown && !this.reloading && this.clip > 0) {
        if (this.drawFrac === 0) this.chargeStarted = true;
        this.drawFrac = Math.min(1, this.drawFrac + dt / m.draw.time);
      } else if (letGo && this.drawFrac > 0.08 && this.clip > 0 && !this.reloading) {
        this.clip--;
        this.shotsFired++;
        this.lastShotAt = now;
        const cone = this.spread.cone();
        this.spread.onShot(now, this.adsFrac);
        const kick = this.kick.kick(now, this.adsFrac > 0.5, inAir, crouched, rnd);
        const d = this.drawFrac;
        // a fuller draw hits harder, flies faster and truer (the truer is ours)
        out.push({ cone, kick, coneScale: 1.5 - 0.5 * d, dmgScale: m.draw.minDamage + (1 - m.draw.minDamage) * d, speedScale: m.draw.minSpeed + (1 - m.draw.minSpeed) * d });
        this.drawFrac = 0;
        this.beginReload(now, this.w.reloadTime);
      } else if (!triggerDown) this.drawFrac = 0;
      if (triggerDown && !this.triggerWasDown && this.clip <= 0 && !this.reloading) {
        this.dryFire = true;
        this.beginReload(now, this.w.reloadTime);
      }
      this.triggerWasDown = triggerDown;
      this.spread.update(dt, now, stance, motion, this.adsFrac);
      this.kick.update(dt, this.adsFrac > 0.5, now);
      return out;
    }

    const shots: ShotRequest[] = [];
    /** how much of this frame the recoil spring has already been advanced by */
    let spent = 0;
    const semi = this.w.semiAuto;
    const burst = this.w.burstCount > 1;
    const burstDelay = m.burstCharge ? m.burstCharge.delayFrom + (m.burstCharge.delayTo - m.burstCharge.delayFrom) * this.burstCharge : this.w.burstDelay;
    const charged = !m.chargeUp || this.charge >= 1;

    const fresh = triggerDown && !this.triggerWasDown;
    let wantShot = false;
    if (m.chargeShot) {
      // the Charge Rifle: a pull starts the charge; the round leaves when it is done
      if (this.chargeShotAt === null && fresh && !this.reloading && this.clip > 0 && now >= this.nextShotAt) {
        this.chargeShotAt = now + m.chargeShot.time;
        this.chargeStarted = true;
      }
      wantShot = this.chargeShotAt !== null && now >= this.chargeShotAt && !this.reloading;
    } else if (!this.reloading && charged) {
      if (burst) {
        // burst_fire_delay is a real gameplay constant in the data: bursts
        // cannot be chained faster than this gap, however fast you click. The
        // Nemesis keeps bursting while the trigger is held.
        const ready = now >= this.burstEndedAt + burstDelay;
        if (triggerDown && (!this.triggerWasDown || m.burstCharge) && this.burstLeft === 0 && ready) {
          this.burstLeft = this.w.burstCount;
          if (m.burstCharge) {
            this.burstCharge = Math.min(1, this.burstCharge + m.burstCharge.perBurst);
            this.lastBurstAt = now;
          }
        }
        wantShot = this.burstLeft > 0;
      } else if (semi) {
        // a charged single (the HAVOC's altfire) goes when the wind-up completes under the held trigger
        wantShot = m.chargeUp && !m.chargeUp.remainFull ? triggerDown : triggerDown && !this.triggerWasDown;
      } else {
        wantShot = triggerDown;
      }
    }
    this.triggerWasDown = triggerDown;

    if (wantShot && this.clip <= 0) {
      if (!this.reloading) this.dryFire = true;
      if (!m.overheat) this.startReload(now);
      this.burstLeft = 0;
      this.chargeShotAt = null;
      wantShot = false;
    }

    if (wantShot) {
      // A new pull, or a trigger held through a long idle, starts the schedule
      // from now. A stale time left within one interval must not survive a new
      // pull: the shot it lets through would schedule the next one early (two
      // Wingman shots 83 ms apart, two Kraber shots 0.2 s apart).
      if (fresh || this.nextShotAt < now - interval || m.chargeShot) this.nextShotAt = Math.max(this.nextShotAt, now);
      while (this.nextShotAt <= now && this.clip > 0 && (!burst || this.burstLeft > 0)) {
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
        if (burst) {
          this.burstLeft--;
          if (this.burstLeft === 0) this.burstEndedAt = now;
        }
        const cone = this.spread.cone();
        this.spread.onShot(now, this.adsFrac);
        const kick = this.kick.kick(now, this.adsFrac > 0.5, inAir, crouched, rnd);
        shots.push({
          cone,
          kick,
          coneScale: m.choke ? 1 - (1 - m.choke.minScale) * this.choke : 1,
          dmgScale: m.adsCharge ? 1 + m.adsCharge.bonus * this.adsCharge : 1,
          speedScale: 1,
        });
        // a charged 30-30 round spends the charge; a charged single spends the wind-up
        if (m.adsCharge) this.adsCharge = 0;
        if (m.chargeUp && !m.chargeUp.remainFull) this.charge = 0;
        this.nextShotAt += interval;
        if (m.chargeShot) {
          this.chargeShotAt = null;
          this.nextShotAt = now + interval;
          break;
        }
        if (semi && !burst) break;
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
