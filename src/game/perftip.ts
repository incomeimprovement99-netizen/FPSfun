// A tip for a player whose machine is struggling (Milestone 627). A friend on a laptop playing at 30 fps does not know
// there is a Render scale or a Competitive preset, and the owner only hears "it was laggy". After `seconds` of play at
// under `below` frames a second, the HUD says so once, with what to try: the tip is kept as shown in this browser, so
// it is said once and never again. Numbers in src/config/hud.json slowTip.
import hudCfg from "../config/hud.json";

const CFG = hudCfg.slowTip;
const KEY = "range.slowTipShown";

export class SlowTip {
  private secs = 0;
  private frames = 0;
  private done: boolean;

  constructor(private store: Pick<Storage, "getItem" | "setItem"> | null = safeStorage()) {
    this.done = readShown(store);
  }

  /**
   * A frame: `dt` its wall-clock seconds, `playing` whether the player is in play (not the menu, not loading). The
   * tip's text the one frame it is due, else null. `scale` and `preset` say what is already tried.
   */
  frame(dt: number, playing: boolean, scale: number, preset: string): string | null {
    if (this.done || !playing || !(dt > 0) || dt > 1) return null;
    this.secs += dt;
    this.frames++;
    if (this.secs < CFG.seconds) return null;
    const fps = this.frames / this.secs;
    this.secs = 0;
    this.frames = 0;
    if (fps >= CFG.below) return null;
    this.done = true;
    try {
      this.store?.setItem(KEY, "1");
    } catch {
      /* a tip said twice is no harm */
    }
    const tries: string[] = [];
    if (scale > 0.7) tries.push("RENDER SCALE 70%");
    if (preset !== "competitive") tries.push("THE COMPETITIVE PRESET");
    const what = tries.length ? `TRY ${tries.join(" OR ")} IN SETTINGS` : "FEWER BOTS IN A BATTLE ROYALE WILL HELP";
    return `LOW FRAME RATE (${Math.round(fps)} FPS): ${what}`;
  }
}

function safeStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readShown(store: Pick<Storage, "getItem" | "setItem"> | null): boolean {
  try {
    return store?.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
