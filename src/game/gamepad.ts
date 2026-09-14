// Controller support, through the browser's Gamepad API.
//
// The layout is the game's default one, as far as the buttons map:
//   left stick move, right stick look, RT fire, LT aim, A jump, B crouch,
//   X reload (and interact: a zipline in reach), Y swap weapon, L3 sprint,
//   R3 melee, LB holster, RB variable zoom, d-pad up optic, down magazine
//   level, left slot 1, right slot 2, Start the menu, Back the ghost.
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
}

export const PAD_DEFAULTS: PadSettings = { look: 3, ads: 3, curve: "classic", deadzone: 0.12, autoSprint: true, rumble: true };

/** standard-mapping button indices */
const BUTTON: Record<number, Action | "menu"> = {
  0: "jump",
  1: "crouch",
  2: "reload",
  3: "swapWeapon",
  4: "holster",
  5: "zoomToggle",
  6: "ads",
  7: "fire",
  8: "ghost",
  9: "menu",
  10: "sprint",
  11: "melee",
  12: "optic",
  13: "magLevel",
  14: "slot1",
  15: "slot2",
};
/** the stick as keys, above this deflection */
const MOVE_THRESHOLD = 0.35;
const TRIGGER_THRESHOLD = 0.35;

export class GamepadInput {
  settings: PadSettings = { ...PAD_DEFAULTS };
  /** a pad is connected and was touched recently */
  active = false;
  private index = -1;
  private down = new Set<Action | "menu">();
  private pressed = new Set<Action | "menu">();
  private prevButtons: boolean[] = [];
  private lookX = 0;
  private lookY = 0;
  private lastTouched = -Infinity;
  private lastMove = { x: 0, y: 0 };

  constructor() {
    window.addEventListener("gamepadconnected", (e) => {
      this.index = (e as GamepadEvent).gamepad.index;
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
  poll(now: number, dt: number, adsScale: number): { yawLeft: number; pitchUp: number } {
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
    this.active = now - this.lastTouched < 30;

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
