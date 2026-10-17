// The menu by controller (the owner, 2026-10-12: "make it more of an obvious section in the settings page for those
// players (they hate using the mouse to look for shit)"): the D-pad or the left stick moves a lit focus between the
// menu's buttons, boxes and cards, the way a console menu does; A (cross) presses what is lit, B (circle) goes back, LB
// and RB (L1, R1) turn the tabs. On a box, left and right change its value and A steps it on. Start (Options) plays,
// as it always did (main.ts).
//
// Spatial: from the lit thing's middle, the nearest thing whose middle lies that way, its sideways offset counting
// double, so a column is walked down before a step across. Only what can be seen and used is a stop.
import type { GamepadInput } from "../game/gamepad";

/** standard-mapping indices */
const A = 0;
const B = 1;
const LB = 4;
const RB = 5;
const UP = 12;
const DOWN = 13;
const LEFT = 14;
const RIGHT = 15;
/** the stick counts as a direction past this, and a held direction repeats after `firstRepeat` s, then every `repeat` s */
const STICK = 0.55;
const FIRST_REPEAT = 0.4;
const REPEAT = 0.13;

type Dir = "up" | "down" | "left" | "right";

const STOPS = "button, select, input:not([type=hidden]), textarea, [data-tab], a[href]";

export class PadNav {
  /** what is lit */
  focused: HTMLElement | null = null;
  private held: Dir | null = null;
  private nextRepeat = 0;

  constructor(
    /** the part of the page the pad works in now (the hack pick, the start screen or the menu), or null when none is up */
    private readonly root: () => HTMLElement | null,
    /** LB and RB: the tab before or after */
    private readonly turnTab: (step: 1 | -1) => void,
  ) {}

  /** a frame of the menu by pad; `now` in seconds */
  step(now: number, pad: GamepadInput): void {
    const root = this.root();
    if (!root) {
      this.clear();
      return;
    }
    if (this.focused && (!root.contains(this.focused) || !visible(this.focused))) this.clear();
    const dir = this.direction(pad);
    let moved: Dir | null = null;
    if (dir !== this.held) {
      this.held = dir;
      this.nextRepeat = now + FIRST_REPEAT;
      moved = dir;
    } else if (dir && now >= this.nextRepeat) {
      this.nextRepeat = now + REPEAT;
      moved = dir;
    }
    // the tabs and back act at once; a move or A with nothing lit lights the first thing to use, and does nothing else
    if (pad.rawPressed.has(LB)) this.turnTab(-1);
    if (pad.rawPressed.has(RB)) this.turnTab(1);
    if (pad.rawPressed.has(B)) {
      // back: the hack pick's Back, or the menu's own back to the start screen
      const back = ["pickBack", "startBack"].map((id) => document.getElementById(id)).find((b) => b && visible(b));
      back?.click();
    }
    if ((moved || pad.rawPressed.has(A)) && !this.focused) {
      this.focus(first(root));
      return;
    }
    if (moved && this.focused) {
      // a box's value goes left and right; up and down always move
      if ((moved === "left" || moved === "right") && this.adjust(this.focused, moved === "right" ? 1 : -1)) return;
      const to = nearest(root, this.focused, moved);
      if (to) this.focus(to);
    }
    if (pad.rawPressed.has(A) && this.focused) {
      const el = this.focused;
      if (el instanceof HTMLSelectElement) this.adjust(el, 1, true);
      else el.click();
    }
  }

  private direction(pad: GamepadInput): Dir | null {
    const h = pad.rawHeld;
    if (h.has(UP) || pad.leftStick.y < -STICK) return "up";
    if (h.has(DOWN) || pad.leftStick.y > STICK) return "down";
    if (h.has(LEFT) || pad.leftStick.x < -STICK) return "left";
    if (h.has(RIGHT) || pad.leftStick.x > STICK) return "right";
    return null;
  }

  /** a box's value a step on or back (a select's option, a number's step); false when it is not a box */
  private adjust(el: HTMLElement, step: 1 | -1, wrap = false): boolean {
    if (el instanceof HTMLSelectElement) {
      const n = el.options.length;
      if (!n) return true;
      let i = el.selectedIndex + step;
      if (wrap) i = (i + n) % n;
      i = Math.max(0, Math.min(n - 1, i));
      if (i !== el.selectedIndex) {
        el.selectedIndex = i;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return true;
    }
    if (el instanceof HTMLInputElement && (el.type === "number" || el.type === "range")) {
      if (step > 0) el.stepUp();
      else el.stepDown();
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }

  focus(el: HTMLElement | null): void {
    this.focused?.classList.remove("padfocus");
    this.focused = el;
    if (!el) return;
    el.classList.add("padfocus");
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  clear(): void {
    this.focus(null);
    this.held = null;
  }
}

function visible(el: HTMLElement): boolean {
  if ((el as HTMLButtonElement).disabled) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  return el.closest("[hidden]") === null && getComputedStyle(el).visibility !== "hidden";
}

function stops(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(STOPS)].filter(visible);
}

/** the first thing to light: what the page already marks as picked, else the top-left stop of the open tab (not the tabs) */
function first(root: HTMLElement): HTMLElement | null {
  const all = stops(root);
  const on = all.find((e) => e.classList.contains("on") && !e.dataset.tab);
  if (on) return on;
  const panel = root.querySelector<HTMLElement>("section[data-panel]:not([hidden])");
  const inPanel = panel ? all.filter((e) => panel.contains(e)) : [];
  return (inPanel.length ? inPanel : all).sort((a, b) => {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    return ra.top - rb.top || ra.left - rb.left;
  })[0] ?? null;
}

/** the nearest stop that way from `from` */
function nearest(root: HTMLElement, from: HTMLElement, dir: Dir): HTMLElement | null {
  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let score = Infinity;
  for (const el of stops(root)) {
    if (el === from) continue;
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - ax;
    const dy = r.top + r.height / 2 - ay;
    // that way at all: past the lit thing's own edge in that direction
    const ahead = dir === "up" ? a.top - (r.top + r.height / 2) : dir === "down" ? r.top + r.height / 2 - a.bottom : dir === "left" ? a.left - (r.left + r.width / 2) : r.left + r.width / 2 - a.right;
    if (ahead <= 0) continue;
    const along = dir === "up" || dir === "down" ? Math.abs(dy) : Math.abs(dx);
    const across = dir === "up" || dir === "down" ? Math.abs(dx) : Math.abs(dy);
    const s = along + across * 2;
    if (s < score) {
      score = s;
      best = el;
    }
  }
  return best;
}
