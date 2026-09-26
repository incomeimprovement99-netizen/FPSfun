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
// The numbers and the tips are in src/config/hud.json `loading`.
import { IS_SK } from "../game/game";
import * as THREE from "three";
import hudCfg from "../config/hud.json";

const CFG = hudCfg.loading;
// SpeedKills teaches its own game on the loading screen
const TIPS: string[] = IS_SK ? CFG.tipsSk : CFG.tips;

export class LoadingScreen {
  /** everything asked for is in and the first frame is drawn (the tools wait on it) */
  loaded = false;
  private itemsLoaded = 0;
  private itemsTotal = 0;
  private allIn = false;
  private firstFrame = false;
  private readonly started = performance.now();
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
    const frac = this.itemsTotal > 0 ? this.itemsLoaded / this.itemsTotal : 0;
    if (this.fill) this.fill.style.width = `${Math.round(frac * 100)}%`;
    if (this.status) this.status.textContent = this.itemsTotal > 0 ? `LOADING THE WORLD  ·  ${this.itemsLoaded} OF ${this.itemsTotal}` : "LOADING THE WORLD";
  }

  private showTip(): void {
    if (this.tip && TIPS.length) this.tip.textContent = TIPS[this.tipIndex % TIPS.length];
  }

  /** every frame until it is gone: the first frame counts, the tips turn over, and it goes when it is time */
  frame(): void {
    if (this.loaded) return;
    this.firstFrame = true;
    const t = (performance.now() - this.started) / 1000;
    if (t - this.tipAt > CFG.tipSeconds) {
      this.tipAt = t;
      this.tipIndex++;
      this.showTip();
    }
    // nothing was ever asked for (all cached, or a page with no loads): a short grace, then go
    const nothingAsked = this.itemsTotal === 0 && t > CFG.quietSeconds;
    if (t < CFG.minSeconds) return;
    if ((this.allIn || nothingAsked) && this.firstFrame) this.finish();
    else if (t > CFG.maxSeconds) this.finish();
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
    if (!this.el) return;
    this.el.classList.add("done");
    // off the page once it has faded, so it takes no clicks and no layout
    window.setTimeout(() => (this.el!.hidden = true), 400);
  }
}
