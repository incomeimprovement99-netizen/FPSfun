// Two weapon slots with independent state. Each slot keeps its own clip,
// reload timer, mag level, spread and recoil, so you can empty one mag, swap,
// empty the other, and swap back to a still-empty first gun.
//
// Model: `activeIndex` is what is in hand and what can fire. `targetIndex` is
// where we are heading. They differ exactly while a swap is running, which
// makes redirecting mid-swap (changing your mind) fall out for free.
import { resolveWeapon, weaponMods, type ResolvedWeapon } from "./weapons";
import { WeaponState } from "./weapon-state";
import { modNames, optionsFor, SLOTS, type AttachSlot, type Attachments } from "./attachments";
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

  constructor(ids: string[]) {
    for (const id of ids) {
      const weapon = resolveWeapon(id, 0);
      this.slots.push({ id, magLevel: 0, attach: {}, weapon, state: new WeaponState(weapon), zoomAlt: false });
    }
  }

  /** rebuild the active slot's weapon from its id, mag level and attachments */
  private rebuild(keepState: boolean): void {
    const s = this.active;
    s.weapon = resolveWeapon(s.id, s.magLevel, modNames(s.attach));
    if (keepState) s.state.setMagLevel(s.weapon);
    else s.state.setWeapon(s.weapon);
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
    s.weapon = weapon;
    s.state.setWeapon(weapon);
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
    s.weapon = resolveWeapon(s.id, s.magLevel, modNames(s.attach));
    s.state.setWeapon(s.weapon);
  }

  /** cycle one attachment slot on the weapon in hand */
  cycleAttachment(slot: AttachSlot): void {
    const s = this.active;
    const opts = optionsFor(slot, weaponMods(s.id));
    if (opts.length <= 1) return; // nothing to cycle on this weapon
    const cur = s.attach[slot] ?? null;
    const i = opts.findIndex((o) => o.mod === cur);
    const next = opts[(i + 1) % opts.length];
    s.attach[slot] = next.mod;
    if (slot === "optic") s.zoomAlt = false;
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
      const opts = optionsFor(slot, mods);
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

  get swapping(): boolean {
    return this.targetIndex !== this.activeIndex;
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

  /** cycle to the next slot */
  requestNext(now: number): boolean {
    return this.requestSwap(this.nextIndex, now);
  }

  /** call once per frame; completes a swap when its timer expires */
  update(now: number): void {
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
