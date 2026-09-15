// Pointer-lock mouse + keyboard. Raw (unadjusted) movement is requested so
// OS pointer acceleration cannot alter the counts-to-degrees relationship.

/**
 * Keys the game consumes, derived from the bindings so a rebind cannot leave
 * a key falling through to the browser. Everything else reaches the browser
 * untouched, which is why F5 and F12 still work.
 */
let GAME_KEYS: Set<string>;

import bindsJson from "../config/binds.json";
import { GamepadInput } from "./gamepad";

export type Action = Exclude<keyof typeof bindsJson, "_note">;
/** binds.json as shipped: the defaults the Controls tab resets to */
export const DEFAULT_BINDS: Readonly<Record<Action, readonly string[]>> = Object.fromEntries(
  Object.entries(bindsJson).filter(([k]) => !k.startsWith("_"))
) as Record<Action, string[]>;
/** the live bindings: the defaults with the player's changes on top (setBinds) */
const BINDS: Record<string, string[]> = Object.fromEntries(Object.entries(DEFAULT_BINDS).map(([k, v]) => [k, [...v]]));

/**
 * Put the player's bindings on (the Controls tab, src/ui/binds.ts): every
 * action they changed takes their list, every other one the default. The
 * keys the game swallows follow, so a key bound away reaches the browser again.
 */
export function setBinds(changes: Partial<Record<Action, string[]>>): void {
  for (const a of Object.keys(DEFAULT_BINDS) as Action[]) BINDS[a] = [...(changes[a] ?? DEFAULT_BINDS[a])];
  GAME_KEYS = Input.boundKeys();
}

/** the live bindings, for the Controls tab */
export const currentBinds = (): Readonly<Record<Action, readonly string[]>> => BINDS as Record<Action, string[]>;

/** "mouse3" -> 3, anything else -> null */
function mouseIndex(bind: string): number | null {
  const m = /^mouse([0-4])$/.exec(bind);
  return m ? Number(m[1]) : null;
}

/**
 * The scroll wheel as a button. Each notch is a press that lasts one frame,
 * which is exactly what a scroll-bound tap-strafe feeds the game: a stream of
 * separate forward presses, every one of them a fresh lurch.
 */
type Wheel = "wheelup" | "wheeldown";
const isWheel = (b: string): b is Wheel => b === "wheelup" || b === "wheeldown";

export class Input {
  private dx = 0;
  private dy = 0;
  private down = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();
  /**
   * Five buttons: 0 left, 1 middle, 2 right, 3 back (thumb, nearer the wrist),
   * 4 forward (thumb, further from the wrist). Mouse 4 and 5 in common usage
   * are buttons 3 and 4 here, and they are bindable like any other.
   */
  mouseDown = [false, false, false, false, false];
  private mousePressed = [false, false, false, false, false];
  /** scroll notches this frame, by direction */
  private wheel: Record<Wheel, number> = { wheelup: 0, wheeldown: 0 };
  locked = false;
  /** mouse movement comes from pointerrawupdate (lowest latency) */
  rawMouse = false;
  /** go fullscreen (with Keyboard Lock) when play starts; see lock() */
  fullscreen = true;
  onLockChange: ((locked: boolean) => void) | null = null;

  constructor(private el: HTMLElement) {
    GAME_KEYS = Input.boundKeys();
    // Mouse movement. `pointerrawupdate` delivers each report as the mouse
    // sends it, where `mousemove` is batched up and handed over once per
    // frame, so with it the frame reads movement that arrived after the batch.
    // Chrome has it on secure pages (localhost counts); elsewhere, mousemove.
    const raw = "onpointerrawupdate" in window;
    const onMove = (e: MouseEvent) => {
      if (!this.locked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    };
    if (raw) document.addEventListener("pointerrawupdate" as "pointermove", onMove);
    else document.addEventListener("mousemove", onMove);
    this.rawMouse = raw;
    document.addEventListener("mousedown", (e) => {
      if (!this.locked) return;
      if (e.button < 5) {
        this.mouseDown[e.button] = true;
        this.mousePressed[e.button] = true;
      }
      e.preventDefault();
    });
    document.addEventListener("mouseup", (e) => {
      if (e.button < 5) this.mouseDown[e.button] = false;
    });
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener(
      "wheel",
      (e) => {
        if (!this.locked) return;
        if (e.deltaY < 0) this.wheel.wheelup++;
        else if (e.deltaY > 0) this.wheel.wheeldown++;
        e.preventDefault();
      },
      { passive: false }
    );
    document.addEventListener("keydown", (e) => {
      if (!this.locked) return;
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      // Swallow only the keys the game actually uses. A blanket preventDefault
      // ate F5/F12; leaving Ctrl through instead would have made Ctrl+W (crouch
      // plus forward) close the tab mid-session.
      if (GAME_KEYS.has(e.code)) e.preventDefault();
    });
    document.addEventListener("keyup", (e) => {
      this.down.delete(e.code);
      this.released.add(e.code);
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.el;
      if (!this.locked) {
        // Esc off a mouse session ends a pad session too, or the pad keeps
        // firing behind the menu
        this.padPlaying = false;
        this.down.clear();
        this.mouseDown = [false, false, false, false, false];
      }
      this.onLockChange?.(this.locked);
    });
    window.addEventListener("blur", () => {
      this.down.clear();
      this.pressed.clear(); // else a key held at blur reports justPressed on return
      this.mouseDown = [false, false, false, false, false];
    });
    // the older, promise-less form reports a refusal only as this event
    document.addEventListener("pointerlockerror", () => this.onLockRefused?.());
  }

  /** the browser refused the pointer lock (too soon after Esc, or not allowed here) */
  onLockRefused: (() => void) | null = null;

  /** `quiet`: a lock the game asks for by itself; a refusal is not reported */
  async lock(quiet = false): Promise<void> {
    // Chrome never lets a page cancel Ctrl+W, Ctrl+T or Ctrl+N (crouch plus
    // forward, armour, stock): preventDefault on the keydown is ignored. The one
    // way round it is fullscreen with Keyboard Lock, which hands those keys to
    // the page. Escape is left out of the lock so it still opens the menu.
    if (this.fullscreen && !document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      } catch {
        /* no user gesture, or not allowed: play windowed */
      }
    }
    const kb = (navigator as Navigator & { keyboard?: { lock?: (codes?: string[]) => Promise<void> } }).keyboard;
    if (document.fullscreenElement && kb?.lock) {
      try {
        await kb.lock([...GAME_KEYS].filter((k) => k !== "Escape"));
      } catch {
        /* Keyboard Lock not available (Firefox, Safari) */
      }
    }
    const el = this.el as HTMLElement & {
      requestPointerLock: (opts?: { unadjustedMovement?: boolean }) => Promise<void> | void;
    };
    try {
      await el.requestPointerLock({ unadjustedMovement: true });
    } catch {
      try {
        await el.requestPointerLock();
      } catch {
        // no user gesture, too soon after Esc, or an embedded page without
        // permission: the menu says so rather than nothing happening
        if (!quiet) this.onLockRefused?.();
      }
    }
  }

  unlock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** mouse counts since last call */
  consumeMouse(): { dx: number; dy: number } {
    const r = { dx: this.dx, dy: this.dy };
    this.dx = 0;
    this.dy = 0;
    return r;
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }
  justPressed(code: string): boolean {
    return this.pressed.has(code);
  }
  mouseJustPressed(button: number): boolean {
    return this.mousePressed[button] ?? false;
  }

  /**
   * Is any binding for this action currently held. A scroll notch counts as
   * held for the one frame it happened in, so it combines with held keys the
   * way the game combines directions for a lurch.
   */
  /** a controller, read once a frame by main (gamepad.ts); its keys join the keyboard's */
  readonly pad = new GamepadInput();
  /**
   * Playing: the pointer is locked, or a controller is in use with the menu
   * away (a controller needs no pointer lock, and a pad button cannot ask for
   * one: the browser wants a real click for that).
   */
  padPlaying = false;
  get playing(): boolean {
    return this.locked || (this.padPlaying && this.pad.active);
  }

  held(action: Action): boolean {
    if (this.playing && this.pad.held(action)) return true;
    // the pad's X held: a revive or a beacon (the game decides by the prompt)
    if (this.playing && action === "interact" && this.pad.held("reload")) return true;
    for (const b of BINDS[action] ?? []) {
      if (isWheel(b)) {
        if (this.wheel[b] > 0) return true;
        continue;
      }
      // pressed this frame counts as held for this frame, as the wheel does: a
      // click or a tap that goes down and up between two frames (a hitch is up
      // to 0.1 s) was otherwise never a shot, and never in a lurch's direction
      const mi = mouseIndex(b);
      if (mi === null ? this.down.has(b) || this.pressed.has(b) : this.mouseDown[mi] || this.mousePressed[mi]) return true;
    }
    return false;
  }

  /** did any binding for this action go down this frame */
  pressedNow(action: Action): boolean {
    if (this.playing && this.pad.pressedNow(action)) return true;
    // the pad's X is reload and interact both; the game decides which by the prompt
    if (this.playing && action === "interact" && this.pad.pressedNow("reload")) return true;
    for (const b of BINDS[action] ?? []) {
      if (isWheel(b)) {
        if (this.wheel[b] > 0) return true;
        continue;
      }
      const mi = mouseIndex(b);
      if (mi === null ? this.pressed.has(b) : this.mousePressed[mi]) return true;
    }
    return false;
  }

  /** the keyboard codes this action binds, so they can be preventDefault-ed */
  static boundKeys(): Set<string> {
    const out = new Set<string>();
    for (const list of Object.values(BINDS)) {
      for (const b of list) if (mouseIndex(b) === null && !isWheel(b)) out.add(b);
    }
    return out;
  }
  /** call at end of frame */
  endFrame(): void {
    this.pressed.clear();
    this.released.clear();
    this.mousePressed = [false, false, false, false, false];
    this.wheel.wheelup = 0;
    this.wheel.wheeldown = 0;
  }
}
