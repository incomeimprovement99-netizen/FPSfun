// The loading screen: the page's first seconds, while the models and textures
// come down, with how far along it is and something to read.
//
// The page used to open straight onto the menu with 30 MB of models and 16 MB
// of textures still arriving behind it: the first match could start with the
// range's props missing and the surfaces flat grey, and nothing said why.
// Every loader in the game (the props' and the mannequin's GLTFs, the surface
// textures, the sky) goes through three.js's default loading manager, so this
// listens there and fills a bar. It goes when everything asked for has come
// in and the first frame has been drawn, or after `maxSeconds` whatever
// happens, because a screen that never goes is worse than a grey wall.
//
// SpeedKills puts it up again as a match starts (again, close): the match's own files and its first frames on its side
// of the world are loading too, and they were a black frame with the gun and a stall between the mode's card and the
// ship (the owner, 2026-09-30).
//
// The numbers and the tips are in src/config/hud.json `loading`.
import { IS_SK } from "../game/game";
import * as THREE from "three";
import hudCfg from "../config/hud.json";
import introCfg from "../config/intro.json";

const CFG = hudCfg.loading;
// what a steady frame is: the intro card's own test (intro.json settle), so the screen and the card agree
const SETTLE = introCfg.settle;
// SpeedKills teaches its own game on the loading screen
const TIPS: string[] = IS_SK ? CFG.tipsSk : CFG.tips;

export class LoadingScreen {
  /** everything asked for is in and the first frame is drawn (the tools wait on it) */
  loaded = false;
  /**
   * Something more to wait for once the world is in, or null for the world
   * alone. SpeedKills waits here for its late heavy steps too (main.ts: the
   * bought guns dressed, the figures settled, the first-person arms built): the
   * owner, 2026-09-29, "the basic speed kills with the progress bar is all we
   * want them to see whenever we are loading things", where its intro card had
   * stood in for this screen and held on its rain until they were done.
   */
  waitFor: (() => boolean) | null = null;
  /** the status line while it waits for that, the bar full */
  waitingText = "GETTING THE SOLDIERS AND GUNS READY";
  /**
   * Up again over a match's start (again), until whoever put it up takes it down (close): SpeedKills shows this, not
   * the match, while the match's own files come in and its first frames are drawn (main.ts showFrame)
   */
  up = false;
  /** frames in a row that came steadily (intro.json settle's test), counted while it is up for a match */
  calm = 0;
  /** how far a match's way in has got, 0 to 1 (main.ts showFrame, by `step`): the bar, which only ever moves on */
  private shown = 0;
  private itemsLoaded = 0;
  private itemsTotal = 0;
  private allIn = false;
  private firstFrame = false;
  private started = performance.now();
  /** what had been asked for when it came up again: its bar counts from there */
  private base = 0;
  private upText = "";
  /** the status line in place of the count (main.ts: waiting for the others to click play) */
  private say = "";
  private lastFrame = 0;
  private gaps: number[] = [];
  /** the timer that takes it off the page after its fade, cancelled if it comes up again first */
  private hideTimer = 0;
  private tipAt = 0;
  private tipIndex = 0;
  private readonly el = document.getElementById("loading");
  private readonly fill = document.getElementById("loadingFill");
  private readonly status = document.getElementById("loadingStatus");
  private readonly tip = document.getElementById("loadingTip");

  constructor() {
    // chained, so anything else that listens to the manager still hears it
    const m = THREE.DefaultLoadingManager;
    const onStart = m.onStart;
    const onProgress = m.onProgress;
    const onLoad = m.onLoad;
    m.onStart = (url, loaded, total) => {
      this.note(loaded, total);
      onStart?.(url, loaded, total);
    };
    m.onProgress = (url, loaded, total) => {
      this.note(loaded, total);
      onProgress?.(url, loaded, total);
    };
    m.onLoad = () => {
      this.allIn = true;
      this.draw();
      onLoad?.();
    };
    this.tipIndex = Math.floor(Math.random() * TIPS.length);
    this.showTip();
  }

  private note(loaded: number, total: number): void {
    this.itemsLoaded = Math.max(this.itemsLoaded, loaded);
    this.itemsTotal = Math.max(this.itemsTotal, total);
    this.allIn = this.itemsTotal > 0 && this.itemsLoaded >= this.itemsTotal;
    this.draw();
  }

  private draw(): void {
    if (!this.el) return;
    if (this.up && this.loaded) {
      // a match's: how far main says it has got, and the files it has asked for since, counted on the line
      const asked = this.itemsTotal - this.base;
      const got = this.itemsLoaded - this.base;
      const width = `${Math.round(this.shown * 100)}%`;
      const line = this.say || (asked > 0 && got < asked ? `${this.upText}  ·  ${got} OF ${asked}` : this.upText);
      // drawn every frame while it is up, so only what changed is written: a new line of text is a layout
      if (this.fill && this.fill.style.width !== width) this.fill.style.width = width;
      if (this.status && this.status.textContent !== line) this.status.textContent = line;
      return;
    }
    const frac = this.itemsTotal > 0 ? this.itemsLoaded / this.itemsTotal : 0;
    if (this.fill) this.fill.style.width = `${Math.round(frac * 100)}%`;
    if (this.status) this.status.textContent = this.itemsTotal > 0 ? `LOADING THE WORLD  ·  ${this.itemsLoaded} OF ${this.itemsTotal}` : "LOADING THE WORLD";
  }

  private showTip(): void {
    if (this.tip && TIPS.length) this.tip.textContent = TIPS[this.tipIndex % TIPS.length];
  }

  /** every frame until it is gone: the first frame counts, the tips turn over, and it goes when it is time */
  frame(): void {
    if (this.loaded && !this.up) return;
    this.firstFrame = true;
    const t = (performance.now() - this.started) / 1000;
    if (t - this.tipAt > CFG.tipSeconds) {
      this.tipAt = t;
      this.tipIndex++;
      this.showTip();
    }
    if (this.up) this.countCalm();
    // up for a match: it goes when main takes it down, not by itself
    if (this.loaded) {
      this.draw();
      return;
    }
    // nothing was ever asked for (all cached, or a page with no loads): a short grace, then go
    const nothingAsked = this.itemsTotal === 0 && t > CFG.quietSeconds;
    if (t < CFG.minSeconds) return;
    const settled = !this.waitFor || this.waitFor();
    if ((this.allIn || nothingAsked) && this.firstFrame && settled) this.finish();
    else if (t > CFG.maxSeconds) this.finish();
    else if ((this.allIn || nothingAsked) && !settled && this.status) this.status.textContent = this.waitingText;
  }

  /**
   * Off the page now, with its own reckoning left running. The intro card
   * (src/ui/intro.ts) covers the whole of loading, so the bar and the tip
   * under it would only be something to read through a title screen; what
   * this screen knows is still worth having, and the card draws the fraction
   * as the line under the name.
   */
  hide(): void {
    if (this.el) this.el.hidden = true;
  }

  /** how much of what was asked for is in, 0 to 1 (the intro card draws it) */
  get fraction(): number {
    return this.itemsTotal > 0 ? this.itemsLoaded / this.itemsTotal : 0;
  }

  private finish(): void {
    this.loaded = true;
    // a match asked for it while the page was still opening: it stays, and counts the match's own from here
    if (this.up) {
      this.base = this.itemsLoaded;
      this.shown = 0;
      this.barFromNothing();
      return;
    }
    this.fadeOut();
  }

  private fadeOut(): void {
    if (!this.el) return;
    this.el.classList.add("done");
    // off the page once it has faded, so it takes no clicks and no layout
    window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => (this.el!.hidden = true), 400);
  }

  /**
   * Up again, over a match's start (main.ts showFrame), with `text` as its line: the owner, 2026-09-29, "the basic
   * speed kills with the progress bar is all we want them to see whenever we are loading things". Its bar counts what
   * is asked for from now (the bought guns' textures for the loot and the bots came in after the page's own had), and
   * it stays until close: the match decides when it is ready to be seen.
   */
  again(text: string): void {
    const already = this.up;
    this.up = true;
    this.upText = text;
    this.say = "";
    this.resetCalm();
    // still opening: it is already up, and its own count carries on until it would have gone (finish)
    if (!this.loaded) return;
    // up already (put up as Start was clicked, before the match was built): its count, its bar and its tip carry on
    if (already) {
      this.draw();
      return;
    }
    this.base = this.itemsLoaded;
    this.shown = 0;
    this.started = performance.now();
    this.tipAt = 0;
    this.tipIndex++;
    this.showTip();
    window.clearTimeout(this.hideTimer);
    if (this.el) {
      // at once, not faded in: a fade showed the range and the gun through it for its first frames
      this.el.style.transition = "none";
      this.el.hidden = false;
      this.el.classList.remove("done");
      void this.el.offsetWidth;
      this.el.style.transition = "";
    }
    this.barFromNothing();
  }

  /** the bar drawn from empty at once, not slid back from where the page's own loading left it full */
  private barFromNothing(): void {
    if (this.fill) this.fill.style.transition = "none";
    this.draw();
    if (this.fill) {
      void this.fill.offsetWidth;
      this.fill.style.transition = "";
    }
  }

  /** a match's way in has got this far, 0 to 1 (main.ts showFrame): the bar moves on to it, and never back */
  step(k: number): void {
    const v = Math.min(1, Math.max(0, k));
    if (v <= this.shown) return;
    this.shown = v;
    if (this.up) this.draw();
  }

  /** what a match has asked for since the screen came up for it that is in, 0 to 1 (1 with nothing asked) */
  get filesIn(): number {
    const asked = this.itemsTotal - this.base;
    return asked > 0 ? (this.itemsLoaded - this.base) / asked : 1;
  }

  /** down again, with its fade (under the card, which covers it from its first frame): whoever put it up has something to show now */
  close(): void {
    if (!this.up) return;
    this.up = false;
    this.say = "";
    if (this.loaded) this.fadeOut();
  }

  /** its line says this in place of the count, until it is given "" (main.ts: a friend's match waiting for the others) */
  sayLine(text: string): void {
    if (this.say === text) return;
    this.say = text;
    if (this.up) this.draw();
  }

  /** everything asked for so far is in (a match's own files too) */
  get allAsked(): boolean {
    return this.itemsLoaded >= this.itemsTotal;
  }

  /** start the count of steady frames again: what comes next (the ship) is to be seen steady on its own */
  resetCalm(): void {
    this.calm = 0;
    this.gaps = [];
    this.lastFrame = 0;
  }

  /** one frame more: steady if it came within intro.json settle's `under` ms, or `spike` times the recent median */
  private countCalm(): void {
    const now = performance.now();
    if (this.lastFrame === 0) {
      this.lastFrame = now;
      return;
    }
    const gap = now - this.lastFrame;
    this.lastFrame = now;
    this.gaps.push(gap);
    if (this.gaps.length > 16) this.gaps.shift();
    const sorted = [...this.gaps].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? gap;
    this.calm = gap <= Math.max(SETTLE.under, median * SETTLE.spike) ? this.calm + 1 : 0;
  }
}
