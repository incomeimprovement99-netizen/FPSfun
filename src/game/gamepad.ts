// Controller support, through the browser's Gamepad API.
//
// The layout is the game's Default preset (EA's own table,
// docs/RESEARCH_PHASE_12.md section 1):
//   left stick move, right stick look, RT fire, LT aim, A jump, B crouch,
//   X reload (and interact: a zipline in reach, an item, held for a revive or
//   a beacon), Y swap weapon (hold: holster), L3 sprint, R3 melee, LB the
//   ability (the game's tactical), RB ping (twice: an enemy there), D-pad up
//   heal (tap: the quick heal; hold: the wheel), D-pad right a grenade (again:
//   the next kind), D-pad left fire mode (hold: inspect), D-pad down the
//   variable zoom (ours: the game puts a character action there), Back the
//   map, Start the menu. While the ability card is up, D-pad left and right
//   pick one instead. The game's other presets are here too, and "Range",
//   the layout with the optic and magazine on the D-pad for trying guns.
//
// Look: a deadzone, a response curve (the game's Classic is a steeper curve
// than Linear), and yaw and pitch speeds from a look sensitivity of 1 to 8
// like the game's. The exact degrees per second behind the game's numbers
// are not published; ours are 60 deg/s of yaw per level (3 = 180, which is
// where its ALC yaw speed defaults) and two thirds of that in pitch, with the
// ADS level scaled by the zoom the way the mouse is.
//
// The stick's direction is turned into the four movement keys at a
// threshold, so every movement rule (lurch, sprint within 45 degrees, air
// strafe) sees the same inputs a keyboard gives. Auto sprint is a setting:
// on, pushing the stick forward sprints; off, click the stick like the game.
import type { Action } from "./input";
import PAD from "../config/gamepad.json";

export interface PadSettings {
  /** 1 to 8, like the game */
  look: number;
  ads: number;
  curve: "classic" | "linear";
  /** inner deadzone, 0 to 0.3 */
  deadzone: number;
  /** outer deadzone: the last share of the stick's travel counts as full, 0 to 0.3 */
  outerDeadzone: number;
  /** the Classic curve's power: 1 is as linear, higher is finer near the centre */
  exponent: number;
  autoSprint: boolean;
  /** rumble on hits taken and shots fired */
  rumble: boolean;
  /** slowdown and rotational aim assist (aimassist.ts), as the game has for controllers */
  aimAssist: boolean;
  /**
   * The game's advanced look controls: yaw and pitch speeds in degrees a
   * second at full deflection (hip and aimed), and at the stick's edge an
   * extra yaw and pitch that ramps in over `rampTime` after `rampDelay`.
   */
  advanced: boolean;
  yaw: number;
  pitch: number;
  extraYaw: number;
  extraPitch: number;
  rampTime: number;
  rampDelay: number;
  adsYaw: number;
  adsPitch: number;
}

export const PAD_DEFAULTS: PadSettings = {
  look: 3,
  ads: 3,
  curve: "classic",
  deadzone: PAD.defaults.deadzone,
  outerDeadzone: PAD.defaults.outerDeadzone,
  exponent: PAD.defaults.exponent,
  autoSprint: true,
  rumble: true,
  aimAssist: true,
  advanced: false,
  yaw: 180,
  pitch: 120,
  extraYaw: 0,
  extraPitch: 0,
  rampTime: 0.33,
  rampDelay: 0,
  adsYaw: 90,
  adsPitch: 60,
};

/** the stick counts as at its edge (where the extra turn ramps in) from here */
export const PAD_EDGE = PAD.edge;

/** the stick's response: the curve's power on the deflection, keeping its sign */
export function padCurve(s: Pick<PadSettings, "curve" | "exponent">, v: number): number {
  return s.curve === "linear" ? v : Math.sign(v) * Math.pow(Math.abs(v), s.exponent);
}

/** an axis through the inner and outer deadzones: 0 inside the inner, 1 past the outer, linear between */
export function padDeadzone(s: Pick<PadSettings, "deadzone" | "outerDeadzone">, v: number): number {
  const a = Math.abs(v);
  if (a <= s.deadzone) return 0;
  const span = Math.max(1e-3, 1 - s.deadzone - s.outerDeadzone);
  return Math.sign(v) * Math.min(1, (a - s.deadzone) / span);
}

/**
 * The advanced look's rate, degrees a second (yaw left, pitch up): the curve
 * times the speed for the aim (between hip and ADS by how far the aim is in),
 * plus the extra turn at the stick's edge, ramped in by how long it has been there.
 */
export function advancedLookRate(s: PadSettings, rx: number, ry: number, adsFrac: number, edgeTime: number, opticMult = 1): { yawLeft: number; pitchUp: number } {
  const curve = (v: number) => padCurve(s, v);
  const a = Math.max(0, Math.min(1, adsFrac));
  // the per-optic ADS table (Settings) scales the aimed speeds, as it does the mouse's
  const yawSp = s.yaw + (s.adsYaw * opticMult - s.yaw) * a;
  const pitchSp = s.pitch + (s.adsPitch * opticMult - s.pitch) * a;
  const ramp = s.rampTime > 0 ? Math.max(0, Math.min(1, (edgeTime - s.rampDelay) / s.rampTime)) : edgeTime >= s.rampDelay ? 1 : 0;
  // the extra turn is a hipfire thing: it fades out as the aim comes in
  const extra = ramp * (1 - a);
  const yaw = curve(rx) * yawSp + (Math.abs(rx) >= PAD_EDGE ? Math.sign(rx) * s.extraYaw * extra : 0);
  const pitch = curve(ry) * pitchSp + (Math.abs(ry) >= PAD_EDGE ? Math.sign(ry) * s.extraPitch * extra : 0);
  return { yawLeft: -yaw, pitchUp: -pitch };
}

/** the buttons by their standard-mapping index, as a person would say them */
export const PAD_BUTTON_NAMES = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "Back", "Start", "L3", "R3", "D-pad up", "D-pad down", "D-pad left", "D-pad right"];

/** what each button does out of the box (standard-mapping indices): the game's Default */
export const DEFAULT_PAD_BUTTONS: Readonly<Record<number, Action | "menu">> = {
  0: "jump",
  1: "crouch",
  2: "reload",
  3: "swapWeapon",
  4: "ability",
  5: "ping",
  6: "ads",
  7: "fire",
  8: "map",
  9: "menu",
  10: "sprint",
  11: "melee",
  12: "heal",
  13: "zoomToggle",
  14: "fireMode",
  15: "grenade",
};
export type PadPreset = "default" | "bumperJumper" | "buttonPuncher" | "evolved" | "grenadier" | "ninja" | "range";
/**
 * The game's named presets, as what moves from Default (EA's accessibility
 * page; where it does not say where a displaced action goes, ours is noted),
 * and Range: Phase 11's layout, the optic and magazine level on the D-pad.
 */
export const PAD_PRESETS: Record<PadPreset, { name: string; changes: Partial<Record<number, Action>> }> = {
  default: { name: "Default", changes: {} },
  // jump to LB, the tactical to A
  bumperJumper: { name: "Bumper Jumper", changes: { 4: "jump", 0: "ability" } },
  // crouch to R3, melee to B
  buttonPuncher: { name: "Button Puncher", changes: { 11: "crouch", 1: "melee" } },
  // jump to LB, crouch to R3; the tactical to A and melee to B (ours: unconfirmed)
  evolved: { name: "Evolved", changes: { 4: "jump", 11: "crouch", 0: "ability", 1: "melee" } },
  // grenades to RB, ping to D-pad up; the heal to D-pad right (ours: unconfirmed)
  grenadier: { name: "Grenadier", changes: { 5: "grenade", 12: "ping", 15: "heal" } },
  // jump to LB, crouch to RB; the tactical to B, ping to A
  ninja: { name: "Ninja", changes: { 4: "jump", 5: "crouch", 1: "ability", 0: "ping" } },
  // the range: the optic and the magazine level on the D-pad, the slots on it too, holster on Back, zoom on RB
  range: { name: "Range (optic, magazine and slots on the D-pad)", changes: { 5: "zoomToggle", 8: "holster", 12: "optic", 13: "magLevel", 14: "slot1", 15: "slot2" } },
};
/**
 * A button's hold does something else than its tap, where the game has one:
 * the action on the button, then what holding it does. The tap then goes
 * when the button comes up (before HOLD_TIME); the hold once it has been
 * down that long.
 */
export const PAD_HOLDS: Partial<Record<Action, Action>> = { swapWeapon: "holster", fireMode: "inspect" };
export const HOLD_TIME = PAD.holdTime;
/** the live map: the defaults with the player's changes (the Controls tab) */
const BUTTON: Record<number, Action | "menu"> = { ...DEFAULT_PAD_BUTTONS };
/** put a button map on; Start stays the menu, so a player can always get back to it */
export function setPadButtons(changes: Partial<Record<number, Action | "none">>): void {
  for (const k of Object.keys(BUTTON)) delete BUTTON[Number(k)];
  Object.assign(BUTTON, DEFAULT_PAD_BUTTONS);
  for (const [k, v] of Object.entries(changes)) {
    const i = Number(k);
    if (i === 9 || !Number.isInteger(i) || i < 0 || i > 15) continue;
    if (v === "none") delete BUTTON[i];
    else if (v) BUTTON[i] = v;
  }
}
export function padButtons(): Readonly<Record<number, Action | "menu">> {
  return BUTTON;
}
/** the stick as keys, above this deflection */
const MOVE_THRESHOLD = PAD.moveThreshold;
const TRIGGER_THRESHOLD = PAD.triggerThreshold;

export class GamepadInput {
  settings: PadSettings = { ...PAD_DEFAULTS };
  /** a pad is connected and was touched recently */
  active = false;
  /** set on the connect event, cleared by whoever reads it (the HUD notice) */
  justConnected = false;
  private index = -1;
  private down = new Set<Action | "menu">();
  private pressed = new Set<Action | "menu">();
  private prevButtons: boolean[] = [];
  private lookX = 0;
  private lookY = 0;
  private lastTouched = -Infinity;
  private lastMove = { x: 0, y: 0 };
  /** how long the right stick has been at its edge (the advanced look's ramp) */
  private edgeTime = 0;
  /** a button with a hold: when it went down, and whether its hold has gone */
  private holdStart: Array<number | null> = [];
  private holdFired: boolean[] = [];
  /** the ability card is up: the D-pad's left and right pick (the game does it with the same buttons) */
  cardOpen = false;

  constructor() {
    window.addEventListener("gamepadconnected", (e) => {
      this.index = (e as GamepadEvent).gamepad.index;
      this.justConnected = true;
    });
    window.addEventListener("gamepaddisconnected", (e) => {
      if ((e as GamepadEvent).gamepad.index === this.index) {
        this.index = -1;
        this.active = false;
        this.down.clear();
      }
    });
  }

  get connected(): boolean {
    return this.pad() !== null;
  }

  private pad(): Gamepad | null {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (this.index >= 0 && pads[this.index]) return pads[this.index];
    for (const p of pads) if (p) return p;
    return null;
  }

  /**
   * Read the pad once per frame. `dt` scales the look; the result is in
   * degrees for this frame (yaw left positive, pitch up positive).
   */
  poll(now: number, dt: number, adsScale: number, adsFrac = 0, opticMult = 1): { yawLeft: number; pitchUp: number } {
    const p = this.pad();
    this.pressed.clear();
    this.lookX = 0;
    this.lookY = 0;
    if (!p) {
      this.active = false;
      this.down.clear();
      return { yawLeft: 0, pitchUp: 0 };
    }
    const s = this.settings;
    const dz = (v: number) => padDeadzone(s, v);
    const ax = p.axes;
    const mx = dz(ax[0] ?? 0);
    const my = dz(ax[1] ?? 0);
    const rx = dz(ax[2] ?? 0);
    const ry = dz(ax[3] ?? 0);
    let touched = Math.abs(mx) + Math.abs(my) + Math.abs(rx) + Math.abs(ry) > 0;

    // buttons: held and pressed-this-frame
    const next = new Set<Action | "menu">();
    p.buttons.forEach((b, i) => {
      const on = b.pressed || b.value > TRIGGER_THRESHOLD;
      if (on) touched = true;
      const was = !!this.prevButtons[i];
      this.prevButtons[i] = on;
      // the card up: left and right on the D-pad pick an ability, nothing else
      const card = this.cardOpen && (i === 14 || i === 15);
      const action: Action | "menu" | undefined = card ? (i === 14 ? "pickAbility1" : "pickAbility2") : BUTTON[i];
      if (!action) return;
      const hold = card || action === "menu" ? undefined : PAD_HOLDS[action];
      if (hold) {
        // a tap goes as it comes up; the hold once it has been down HOLD_TIME, and is held after
        if (on && !was) {
          this.holdStart[i] = now;
          this.holdFired[i] = false;
        }
        const start = this.holdStart[i];
        if (on && start != null && !this.holdFired[i] && now - start >= HOLD_TIME) {
          this.holdFired[i] = true;
          this.pressed.add(hold);
        }
        if (on && this.holdFired[i]) next.add(hold);
        if (!on && was && start != null && !this.holdFired[i]) this.pressed.add(action);
        if (!on) this.holdStart[i] = null;
        return;
      }
      if (on) {
        next.add(action);
        if (!was) this.pressed.add(action);
      }
    });
    // the stick as keys, with a press when a direction crosses the threshold
    const moveKeys: Array<[Action, boolean]> = [
      ["forward", my < -MOVE_THRESHOLD],
      ["back", my > MOVE_THRESHOLD],
      ["left", mx < -MOVE_THRESHOLD],
      ["right", mx > MOVE_THRESHOLD],
    ];
    for (const [a, on] of moveKeys) {
      if (on) {
        next.add(a);
        if (!this.down.has(a)) this.pressed.add(a);
      }
    }
    // auto sprint: a forward push is a sprint press each time it starts
    const sprintAt = -PAD.autoSprintAt;
    if (s.autoSprint && my < sprintAt && !(this.lastMove.y < sprintAt)) this.pressed.add("sprint");
    if (s.autoSprint && my < sprintAt) next.add("sprint");
    this.lastMove = { x: mx, y: my };
    this.down = next;

    if (touched) this.lastTouched = now;
    this.active = now - this.lastTouched < 120;

    // the advanced look: its own speeds, and the extra turn at the edge
    if (s.advanced) {
      this.edgeTime = Math.abs(rx) >= PAD_EDGE || Math.abs(ry) >= PAD_EDGE ? this.edgeTime + dt : 0;
      const r = advancedLookRate(s, rx, ry, adsFrac, this.edgeTime, opticMult);
      this.lookX = r.yawLeft * dt;
      this.lookY = r.pitchUp * dt;
      return { yawLeft: this.lookX, pitchUp: this.lookY };
    }
    // look: the curve, then the speed for the level, scaled at ADS
    const curve = (v: number) => padCurve(s, v);
    const yawSpeed = PAD.yawPerLevel * Math.max(1, Math.min(8, s.look));
    const pitchSpeed = yawSpeed * PAD.pitchShare;
    const adsK = adsScale === 1 ? 1 : adsScale * (Math.max(1, Math.min(8, s.ads)) / PAD.adsBase);
    this.lookX = -curve(rx) * yawSpeed * adsK * dt;
    this.lookY = -curve(ry) * pitchSpeed * adsK * dt;
    return { yawLeft: this.lookX, pitchUp: this.lookY };
  }

  held(action: Action): boolean {
    return this.down.has(action);
  }
  pressedNow(action: Action): boolean {
    return this.pressed.has(action);
  }
  /** Start went down this frame */
  get menuPressed(): boolean {
    return this.pressed.has("menu");
  }

  /** a short rumble, if the pad and the setting allow */
  rumble(strong: number, weak: number, ms: number): void {
    if (!this.settings.rumble) return;
    const p = this.pad() as (Gamepad & { vibrationActuator?: { playEffect?: (type: string, params: Record<string, number>) => Promise<unknown> } }) | null;
    const act = p?.vibrationActuator;
    if (!act?.playEffect) return;
    void act.playEffect("dual-rumble", { startDelay: 0, duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => undefined);
  }
}
