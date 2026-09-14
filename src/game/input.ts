// Pointer-lock mouse + keyboard. Raw (unadjusted) movement is requested so
// OS pointer acceleration cannot alter the counts-to-degrees relationship.

/**
 * Keys the game consumes, derived from the bindings so a rebind cannot leave
 * a key falling through to the browser. Everything else reaches the browser
 * untouched, which is why F5 and F12 still work.
 */
let GAME_KEYS: Set<string>;

import bindsJson from "../config/binds.json";

export type Action = keyof typeof bindsJson;
const BINDS = bindsJson as unknown as Record<string, string[]>;

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
  }

  async lock(): Promise<void> {
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
        /* user gesture required; ignore */
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
  held(action: Action): boolean {
    for (const b of BINDS[action] ?? []) {
      if (isWheel(b)) {
        if (this.wheel[b] > 0) return true;
        continue;
      }
      const mi = mouseIndex(b);
      if (mi === null ? this.down.has(b) : this.mouseDown[mi]) return true;
    }
    return false;
  }

  /** did any binding for this action go down this frame */
  pressedNow(action: Action): boolean {
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
