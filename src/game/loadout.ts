// Two weapon slots with independent state. Each slot keeps its own clip,
// reload timer, mag level, spread and recoil, so you can empty one mag, swap,
// empty the other, and swap back to a still-empty first gun.
//
// Model: `activeIndex` is what is in hand and what can fire. `targetIndex` is
// where we are heading. They differ exactly while a swap is running, which
// makes redirecting mid-swap (changing your mind) fall out for free.
import { resolveWeapon, weaponMods, type ResolvedWeapon } from "./weapons";
import { WeaponState } from "./weapon-state";
import { fireModeOf, modNames, optionsFor, SLOTS, type AttachSlot, type Attachments } from "./attachments";
import { AMMO, AmmoPouch, fullEnergy, type EnergyStock } from "./ammo";
import { opticInfo } from "./optics";
import { opticName } from "../config/names";

export interface Slot {
  id: string;
  magLevel: number;
  attach: Attachments;
  weapon: ResolvedWeapon;
  state: WeaponState;
  /** a variable optic on its second zoom */
  zoomAlt: boolean;
  /** on its second fire mode (B) */
  altMode: boolean;
  /** an energy gun's own stockpile (ammo.ts), or null */
  energy: EnergyStock | null;
  /** nothing in this slot (a battle royale's start): fists; the weapon object is only a placeholder */
  empty: boolean;
  /** just picked up: its first time out comes with a flourish (cosmetic) */
  firstDraw?: boolean;
  /** a battle royale gun's locked hop-up (Seasons 29 and 30): the damage done with it toward unlocking it */
  hopLock?: { mod: string; have: number; need: number } | null;
}

/** a slot's weapon and its fittings, without the live state */
export interface SlotSetup {
  id: string;
  magLevel: number;
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
      const weapon = resolveWeapon(id, 0);
      const s: Slot = { id, magLevel: 0, attach: {}, weapon, state: new WeaponState(weapon), zoomAlt: false, altMode: false, energy: fullEnergy(weapon), empty: false };
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

  /** the mod chain for a slot: its attachments, and its fire mode's mod when on the second one */
  private chain(s: Slot): string[] {
    const fm = fireModeOf(s.id);
    const list = modNames(s.attach);
    if (s.altMode && fm && this.fireModeAvailable(s)) list.push(fm.mod);
    return list;
  }

  /** a gun's second fire mode can be picked (it has one, and the hop-up it needs is on) */
  fireModeAvailable(s: Slot = this.active): boolean {
    const fm = fireModeOf(s.id);
    return !!fm && (!fm.needs || s.attach.hopup === fm.needs);
  }

  /** B: the other fire mode; returns its label, or null when the gun has none */
  toggleFireMode(): string | null {
    const s = this.active;
    const fm = fireModeOf(s.id);
    if (!fm || !this.fireModeAvailable(s)) return null;
    s.altMode = !s.altMode;
    this.rebuild(true);
    return s.altMode ? fm.alt : fm.base;
  }

  /** the fire mode's name for the HUD */
  fireModeLabel(s: Slot = this.display): string {
    const fm = fireModeOf(s.id);
    if (fm && this.fireModeAvailable(s)) return s.altMode ? fm.alt : fm.base;
    const w = s.weapon;
    return w.burstCount > 1 ? `burst ${w.burstCount}` : w.semiAuto ? "single" : "auto";
  }

  /** rebuild the active slot's weapon from its id, mag level, attachments and fire mode */
  private rebuild(keepState: boolean): void {
    this.rebuildSlot(this.active, keepState);
  }

  private rebuildSlot(s: Slot, keepState: boolean): void {
    s.weapon = resolveWeapon(s.id, s.magLevel, this.chain(s));
    if (keepState) s.state.setMagLevel(s.weapon);
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
    s.altMode = false;
    s.energy = null;
  }

  /** a looted gun into a slot, with its fittings; a full magazine (ours) and, for an energy gun, its stockpile */
  give(i: number, id: string, magLevel = 0, attach: Attachments = {}): void {
    const s = this.slots[i];
    if (!s) return;
    this.setWeaponId(i, id);
    s.empty = false;
    s.firstDraw = true;
    s.magLevel = Math.max(0, Math.min(4, magLevel));
    s.attach = { ...attach };
    s.altMode = false;
    s.hopLock = null;
    this.rebuildSlot(s, false);
    s.energy = fullEnergy(s.weapon);
  }

  /** the first empty slot, or -1 */
  get emptySlot(): number {
    return this.slots.findIndex((s) => s.empty);
  }

  /** a looted attachment onto a slot's gun, if it takes it; true when it went on */
  fitAttachment(i: number, slot: AttachSlot, mod: string): boolean {
    const s = this.slots[i];
    if (!s || s.empty) return false;
    if (!optionsFor(slot, weaponMods(s.id), s.id).some((o) => o.mod === mod)) return false;
    s.attach[slot] = mod;
    this.rebuildSlot(s, true);
    return true;
  }

  /** a looted magazine: a higher mag level on a slot's gun, if it has magazines; true when it went on */
  fitMag(i: number, level: number): boolean {
    const s = this.slots[i];
    if (!s || s.empty || level <= s.magLevel) return false;
    const before = s.weapon.clipSize;
    const r = resolveWeapon(s.id, level, this.chain(s));
    if (r.clipSize === before && level > 0 && s.weapon.reloadTime === r.reloadTime) return false;
    s.magLevel = level;
    this.rebuildSlot(s, true);
    return true;
  }

  /** put a different weapon in a slot, resetting its attachments and state */
  setWeaponId(slotIndex: number, id: string): void {
    const s = this.slots[slotIndex];
    if (!s || s.id === id) return;
    // resolve BEFORE mutating: an unknown id throws, and a half-applied slot
    // whose id no longer matches its weapon would throw on every later rebuild
    const weapon = resolveWeapon(id, 0);
    s.id = id;
    s.magLevel = 0;
    s.attach = {};
    s.zoomAlt = false;
    s.altMode = false;
    s.weapon = weapon;
    s.state.setWeapon(weapon);
    s.energy = fullEnergy(weapon);
    s.empty = false;
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
    return { id: s.id, magLevel: s.magLevel, attach: { ...s.attach }, zoomAlt: s.zoomAlt };
  }

  /** put a slot back as `setup` had it, attachments and mag level included, with a full magazine */
  restore(slotIndex: number, su: SlotSetup): void {
    const s = this.slots[slotIndex];
    if (!s) return;
    this.setWeaponId(slotIndex, su.id);
    s.magLevel = su.magLevel;
    s.attach = { ...su.attach };
    s.zoomAlt = su.zoomAlt;
    s.weapon = resolveWeapon(s.id, s.magLevel, this.chain(s));
    s.state.setWeapon(s.weapon);
    s.energy = fullEnergy(s.weapon);
  }

  /** cycle one attachment slot on the weapon in hand */
  cycleAttachment(slot: AttachSlot): void {
    const s = this.active;
    const opts = optionsFor(slot, weaponMods(s.id), s.id);
    if (opts.length <= 1) return; // nothing to cycle on this weapon
    const cur = s.attach[slot] ?? null;
    const i = opts.findIndex((o) => o.mod === cur);
    const next = opts[(i + 1) % opts.length];
    s.attach[slot] = next.mod;
    if (slot === "optic") s.zoomAlt = false;
    // a fire mode that needed the hop-up just taken off goes back to the first
    if (slot === "hopup" && s.altMode && !this.fireModeAvailable(s)) s.altMode = false;
    this.rebuild(true);
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
   * Label for each attachment slot. Reads the DISPLAY slot so the panel lists
   * the incoming gun's attachments during a swap, matching the name and ammo
   * beside it rather than describing the weapon being put away.
   */
  attachLabels(): Array<{ slot: AttachSlot; label: string; available: boolean }> {
    const s = this.display;
    const mods = weaponMods(s.id);
    return SLOTS.map((slot) => {
      const opts = optionsFor(slot, mods, s.id);
      const cur = s.attach[slot] ?? null;
      const found = opts.find((o) => o.mod === cur);
      // a scoped weapon's own sight, when nothing else is fitted
      const own = slot === "optic" && cur === null && s.weapon.integralOptic ? opticInfo(s.weapon.integralOptic) : null;
      const label = own ? `${opticName(s.weapon.integralOptic!, own.label)} (built in)` : (found?.label ?? "none");
      return { slot, label, available: opts.length > 1 };
    });
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
      // a reload or a burst in flight does not survive being put away
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

  /** change the active slot's mag level (0..4) */
  setMagLevel(level: number): void {
    this.active.magLevel = Math.max(0, Math.min(4, level));
    this.rebuild(true);
  }
}
