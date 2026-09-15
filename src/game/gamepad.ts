// Controller support, through the browser's Gamepad API.
//
// The layout is the game's default one, as far as the buttons map:
//   left stick move, right stick look, RT fire, LT aim, A jump, B crouch,
//   X reload (and interact: a zipline in reach, an item, held for a revive or
//   a beacon), Y swap weapon, L3 sprint,
//   R3 melee, LB the ability (the game's tactical button), RB variable zoom,
//   d-pad up optic, down magazine level, left slot 1, right slot 2 (and, while
//   the ability card is up, left and right pick one), Start the menu, Back
//   holster.
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

export interface PadSettings {
  /** 1 to 8, like the game */
  look: number;
  ads: number;
  curve: "classic" | "linear";
  /** inner deadzone, 0 to 0.3 */
  deadzone: number;
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
  deadzone: 0.12,
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
export const PAD_EDGE = 0.98;

/**
 * The advanced look's rate, degrees a second (yaw left, pitch up): the curve
 * times the speed for the aim (between hip and ADS by how far the aim is in),
 * plus the extra turn at the stick's edge, ramped in by how long it has been there.
 */
export function advancedLookRate(s: PadSettings, rx: number, ry: number, adsFrac: number, edgeTime: number): { yawLeft: number; pitchUp: number } {
  const curve = (v: number) => (s.curve === "linear" ? v : Math.sign(v) * Math.pow(Math.abs(v), 1.7));
  const a = Math.max(0, Math.min(1, adsFrac));
  const yawSp = s.yaw + (s.adsYaw - s.yaw) * a;
  const pitchSp = s.pitch + (s.adsPitch - s.pitch) * a;
  const ramp = s.rampTime > 0 ? Math.max(0, Math.min(1, (edgeTime - s.rampDelay) / s.rampTime)) : edgeTime >= s.rampDelay ? 1 : 0;
  // the extra turn is a hipfire thing: it fades out as the aim comes in
  const extra = ramp * (1 - a);
  const yaw = curve(rx) * yawSp + (Math.abs(rx) >= PAD_EDGE ? Math.sign(rx) * s.extraYaw * extra : 0);
  const pitch = curve(ry) * pitchSp + (Math.abs(ry) >= PAD_EDGE ? Math.sign(ry) * s.extraPitch * extra : 0);
  return { yawLeft: -yaw, pitchUp: -pitch };
}

/** the buttons by their standard-mapping index, as a person would say them */
export const PAD_BUTTON_NAMES = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "Back", "Start", "L3", "R3", "D-pad up", "D-pad down", "D-pad left", "D-pad right"];

/** what each button does out of the box (standard-mapping indices) */
export const DEFAULT_PAD_BUTTONS: Readonly<Record<number, Action | "menu">> = {
  0: "jump",
  1: "crouch",
  2: "reload",
  3: "swapWeapon",
  4: "ability",
  5: "zoomToggle",
  6: "ads",
  7: "fire",
  8: "holster",
  9: "menu",
  10: "sprint",
  11: "melee",
  12: "optic",
  13: "magLevel",
  14: "slot1",
  15: "slot2",
};
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
const MOVE_THRESHOLD = 0.35;
const TRIGGER_THRESHOLD = 0.35;

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
  poll(now: number, dt: number, adsScale: number, adsFrac = 0): { yawLeft: number; pitchUp: number } {
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
    const dz = (v: number) => {
      const a = Math.abs(v);
      if (a <= s.deadzone) return 0;
      const t = Math.min(1, (a - s.deadzone) / (1 - s.deadzone - 0.02));
      return Math.sign(v) * t;
    };
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
      const action = BUTTON[i];
      if (!action) return;
      if (on) {
        next.add(action);
        if (!this.prevButtons[i]) this.pressed.add(action);
      }
      this.prevButtons[i] = on;
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
    if (s.autoSprint && my < -0.8 && !(this.lastMove.y < -0.8)) this.pressed.add("sprint");
    if (s.autoSprint && my < -0.8) next.add("sprint");
    this.lastMove = { x: mx, y: my };
    this.down = next;

    if (touched) this.lastTouched = now;
    this.active = now - this.lastTouched < 120;

    // the advanced look: its own speeds, and the extra turn at the edge
    if (s.advanced) {
      this.edgeTime = Math.abs(rx) >= PAD_EDGE || Math.abs(ry) >= PAD_EDGE ? this.edgeTime + dt : 0;
      const r = advancedLookRate(s, rx, ry, adsFrac, this.edgeTime);
      this.lookX = r.yawLeft * dt;
      this.lookY = r.pitchUp * dt;
      return { yawLeft: this.lookX, pitchUp: this.lookY };
    }
    // look: the curve, then the speed for the level, scaled at ADS
    const curve = (v: number) => (s.curve === "linear" ? v : Math.sign(v) * Math.pow(Math.abs(v), 1.7));
    const yawSpeed = 60 * Math.max(1, Math.min(8, s.look));
    const pitchSpeed = yawSpeed * (2 / 3);
    const adsK = adsScale === 1 ? 1 : adsScale * (Math.max(1, Math.min(8, s.ads)) / 3);
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
