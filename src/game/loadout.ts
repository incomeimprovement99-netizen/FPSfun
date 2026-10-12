// Two weapon slots with independent state. Each slot keeps its own clip,
// reload timer, fusion level, spread and recoil, so you can empty one mag,
// swap, empty the other, and swap back to a still-empty first gun.
//
// Model: `activeIndex` is what is in hand and what can fire. `targetIndex` is
// where we are heading. They differ exactly while a swap is running, which
// makes redirecting mid-swap (changing your mind) fall out for free.
import { PROFILE } from "./game";
import { resolveWeapon, weaponMods, type ResolvedWeapon } from "./weapons";
import { WeaponState } from "./weapon-state";
import { modNames, opticsFor, startingOptic, type Attachments } from "./attachments";
import { AMMO, AmmoPouch, fullEnergy, type EnergyStock } from "./ammo";

export interface Slot {
  id: string;
  /** its sight: the gun's own, fixed (attachments.ts startingOptic) */
  attach: Attachments;
  weapon: ResolvedWeapon;
  state: WeaponState;
  /** a variable optic on its second zoom */
  zoomAlt: boolean;
  /** an energy gun's own stockpile (ammo.ts), or null */
  energy: EnergyStock | null;
  /** nothing in this slot (a battle royale's start): fists; the weapon object is only a placeholder */
  empty: boolean;
  /** just picked up: its first time out comes with a flourish (cosmetic) */
  firstDraw?: boolean;
  /** its fusion level, 0 as found to 5 (src/config/games/speedkills.json fusion) */
  fusion?: number;
}

/** a slot's weapon and its sight, without the live state */
export interface SlotSetup {
  id: string;
  attach: Attachments;
  zoomAlt: boolean;
}

export class Loadout {
  readonly slots: Slot[] = [];
  activeIndex = 0;
  private targetIndex = 0;
  private swapEndsAt = -Infinity;
  private swapTotal = 0;

  /** the inventory's ammo; endless in the range (ammo.ts) */
  readonly ammo = new AmmoPouch();

  constructor(ids: string[]) {
    for (const id of ids) {
      // every gun out of a loadout wears a sight (attachments.ts startingOptic)
      const attach: Attachments = { optic: startingOptic(id) };
      const fitted = resolveWeapon(id, modNames(attach));
      const s: Slot = { id, attach, weapon: fitted, state: new WeaponState(fitted), zoomAlt: false, energy: fullEnergy(fitted), empty: false, fusion: 0 };
      this.slots.push(s);
      this.wireSupply(s);
    }
  }

  /** where a slot's reloads come from: nothing (endless), its energy stockpile, or the inventory */
  private wireSupply(s: Slot): void {
    s.state.supply = {
      available: () => (this.ammo.infinite ? Infinity : s.energy ? s.energy.rounds : this.ammo.stock[s.weapon.ammoType]),
      take: (n: number) => {
        if (this.ammo.infinite) return n;
        if (s.energy) {
          const got = Math.min(n, s.energy.rounds);
          s.energy.rounds -= got;
          return got;
        }
        const got = Math.min(n, this.ammo.stock[s.weapon.ammoType]);
        this.ammo.stock[s.weapon.ammoType] -= got;
        return got;
      },
    };
  }

  /** the mods a slot's gun is built from: its sight (tools/verify.ts: a sight is fitted, not just recorded) */
  chainOf(slotIndex: number): string[] {
    const s = this.slots[slotIndex];
    return s ? modNames(s.attach) : [];
  }

  /** how the gun fires, for the HUD (the legacy game's second fire modes went in Milestone 522) */
  fireModeLabel(s: Slot = this.display): string {
    return s.weapon.semiAuto ? "single" : "auto";
  }

  private rebuildSlot(s: Slot, keepState: boolean): void {
    s.weapon = resolveWeapon(s.id, modNames(s.attach), s.fusion ?? 0);
    if (keepState) s.state.setBuild(s.weapon);
    else s.state.setWeapon(s.weapon);
    if (s.energy) {
      const max = s.weapon.energyStock * s.weapon.clipSize;
      s.energy.rounds = Math.min(s.energy.rounds, max);
      s.energy.max = max;
    }
  }

  /** full energy stockpiles (a spawn with the kit) */
  refillEnergy(): void {
    for (const s of this.slots) s.energy = fullEnergy(s.weapon);
  }

  /**
   * The energy stockpiles refill one magazine every 18 s while their gun is
   * idle: not fired or reloaded in that time. A gun put away is idle.
   */
  private regen(now: number): void {
    for (const s of this.slots) {
      const e = s.energy;
      if (!e) continue;
      const busy = s.state.reloading || now - s.state.lastShotAt < 0.25;
      if (busy || e.rounds >= e.max) {
        e.regenAt = now + AMMO.energyRegen;
        continue;
      }
      if (e.regenAt === 0) e.regenAt = now + AMMO.energyRegen;
      if (now >= e.regenAt) {
        e.rounds = Math.min(e.max, e.rounds + s.weapon.clipSize);
        e.regenAt = now + AMMO.energyRegen;
      }
    }
  }

  /** what is left to reload with for a slot: rounds, or Infinity in the range */
  reserve(s: Slot = this.display): number {
    if (this.ammo.infinite) return Infinity;
    return s.energy ? s.energy.rounds : this.ammo.stock[s.weapon.ammoType];
  }

  /** empty a slot: fists (a battle royale's start) */
  clearSlot(i: number): void {
    const s = this.slots[i];
    if (!s) return;
    s.empty = true;
    s.attach = {};
    s.energy = null;
  }

  /** a looted gun into a slot, at its fusion level and with its own sight; a full magazine and, for an energy gun, its stockpile */
  give(i: number, id: string, fusion = 0): void {
    const s = this.slots[i];
    if (!s) return;
    this.setWeaponId(i, id);
    s.empty = false;
    s.firstDraw = true;
    s.attach = { optic: startingOptic(id) };
    s.fusion = Math.max(0, Math.min(PROFILE.fusion.levels, fusion));
    this.rebuildSlot(s, false);
    s.energy = fullEnergy(s.weapon);
  }

  /**
   * SpeedKills' fusion: a slot's gun raised to `level` (a copy of it found,
   * one level up; a higher-level copy, to its level), its magazine topped up
   * to the new size. True when it rose.
   */
  fuse(i: number, level: number): boolean {
    const s = this.slots[i];
    if (!s || s.empty) return false;
    const to = Math.max(0, Math.min(PROFILE.fusion.levels, Math.round(level)));
    if (to <= (s.fusion ?? 0)) return false;
    s.fusion = to;
    this.rebuildSlot(s, true);
    s.state.clip = s.weapon.clipSize;
    return true;
  }

  /** SpeedKills: a slot's fusion level set outright, up or down (the range's key; the tests) */
  setFusion(i: number, level: number): void {
    const s = this.slots[i];
    if (!s || s.empty) return;
    s.fusion = Math.max(0, Math.min(PROFILE.fusion.levels, Math.round(level)));
    this.rebuildSlot(s, true);
    s.state.clip = s.weapon.clipSize;
  }

  /** the first empty slot, or -1 */
  get emptySlot(): number {
    return this.slots.findIndex((s) => s.empty);
  }

  /** put a different weapon in a slot, resetting its sight, fusion and state */
  setWeaponId(slotIndex: number, id: string): void {
    const s = this.slots[slotIndex];
    if (!s || s.id === id) return;
    // resolve BEFORE mutating: an unknown id throws, and a half-applied slot
    // whose id no longer matches its weapon would throw on every later rebuild
    const weapon = resolveWeapon(id);
    s.id = id;
    s.fusion = 0;
    // a gun swapped into a loadout slot comes with its sight, like the rest
    s.attach = { optic: startingOptic(id) };
    s.zoomAlt = false;
    s.weapon = weapon;
    s.state.setWeapon(weapon);
    s.energy = fullEnergy(weapon);
    s.empty = false;
    this.rebuildSlot(s, false);
    // A swap in flight was timed from the weapons it started with. Changing
    // one of them mid-swap would leave the timer describing guns that are no
    // longer involved, so land it now.
    if (this.swapping) {
      this.activeIndex = this.targetIndex;
      this.swapTotal = 0;
      this.swapEndsAt = -Infinity;
      this.active.state.onDeploy();
    }
  }

  /** what a slot carries, to put back later: the course lends you its pistols */
  setup(slotIndex: number): SlotSetup {
    const s = this.slots[slotIndex];
    return { id: s.id, attach: { ...s.attach }, zoomAlt: s.zoomAlt };
  }

  /** put a slot back as `setup` had it, its sight included, with a full magazine */
  restore(slotIndex: number, su: SlotSetup): void {
    const s = this.slots[slotIndex];
    if (!s) return;
    this.setWeaponId(slotIndex, su.id);
    s.attach = { ...su.attach };
    s.zoomAlt = su.zoomAlt;
    s.weapon = resolveWeapon(s.id, modNames(s.attach));
    s.state.setWeapon(s.weapon);
    s.energy = fullEnergy(s.weapon);
  }

  /**
   * Switch a variable optic between its two zooms. Returns false when the
   * weapon in hand has no variable optic.
   */
  toggleZoom(): boolean {
    const s = this.active;
    if (s.weapon.zoomToggleFov43 === null) return false;
    s.zoomAlt = !s.zoomAlt;
    return true;
  }

  /**
   * The sight's name (the inventory lists it). Reads the DISPLAY slot so the panel names the incoming gun's during a
   * swap, matching the name and ammo beside it rather than describing the weapon being put away.
   */
  opticLabel(): string | null {
    const s = this.display;
    return opticsFor(weaponMods(s.id)).find((o) => o.mod !== null && o.mod === s.attach.optic)?.label ?? null;
  }

  /** the weapon in hand: the only one that can fire */
  get active(): Slot {
    return this.slots[this.activeIndex];
  }

  /**
   * A swap is running, or a cancelled one is still raising the gun that never
   * went away (swapTotal stays set until that raise ends): it cannot fire
   * either way, or swapping back would be an instant cancel.
   */
  get swapping(): boolean {
    return this.targetIndex !== this.activeIndex || this.swapTotal > 0;
  }

  /**
   * What the HUD should name. During a swap this is the INCOMING weapon, so
   * pressing 2 changes the readout at once instead of looking like the key
   * was ignored for the best part of a second.
   */
  get displayIndex(): number {
    return this.targetIndex;
  }
  get display(): Slot {
    return this.slots[this.targetIndex];
  }

  /** which slot Q would go to right now, so the prompt cannot lie */
  get nextIndex(): number {
    return (this.targetIndex + 1) % this.slots.length;
  }

  /** 0..1 through the current swap, for the viewmodel arc */
  swapProgress(now: number): number {
    if (!this.swapping || this.swapTotal <= 0) return 1;
    return Math.max(0, Math.min(1, 1 - (this.swapEndsAt - now) / this.swapTotal));
  }

  /**
   * Head for `index`. Time is the outgoing weapon's holster plus the incoming
   * weapon's deploy, both from the weapon data. Redirecting mid-swap is
   * allowed and restarts the timer. Returns false only for a no-op.
   */
  requestSwap(index: number, now: number): boolean {
    if (index < 0 || index >= this.slots.length) return false;
    if (index === this.targetIndex) return false; // already going there
    this.targetIndex = index;
    if (index === this.activeIndex) {
      // changed our mind: bring the gun we never put away back up
      this.swapTotal = this.active.weapon.deployTime;
    } else {
      this.swapTotal = this.active.weapon.holsterTime + this.slots[index].weapon.deployTime;
      // a reload in flight does not survive being put away
      this.active.state.cancelAction();
    }
    this.swapEndsAt = now + this.swapTotal;
    return true;
  }

  /** the gun in hand comes up again, taking its deploy time (Gun Run's next gun) */
  raise(now: number): void {
    this.targetIndex = this.activeIndex;
    this.swapTotal = this.active.weapon.deployTime;
    this.swapEndsAt = now + this.swapTotal;
  }

  /** cycle to the next slot */
  requestNext(now: number): boolean {
    return this.requestSwap(this.nextIndex, now);
  }

  /** call once per frame; completes a swap when its timer expires, and refills energy stockpiles */
  update(now: number): void {
    this.regen(now);
    if (this.targetIndex === this.activeIndex) {
      // a cancelled swap still runs its raise; nothing to commit
      if (now >= this.swapEndsAt) this.swapTotal = 0;
      return;
    }
    if (now >= this.swapEndsAt) {
      this.activeIndex = this.targetIndex;
      this.swapTotal = 0;
      // the incoming weapon comes up hip-fired with a settled spring, not
      // carrying the outgoing gun's state
      this.active.state.onDeploy();
    }
  }
}
