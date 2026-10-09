// The start screen, and the hack pick before play (src/config/start.json).
//
// The menu had grown into tabs, a lobby of modes and a panel of options, and a
// new player met all of it before a single shot. The overlay now opens on two
// ways in, the Firing Range and the battle royale, with More under them for
// the menu as it was. Either way in asks for your two hacks first, on a timer,
// and then goes in exactly as the menu's Start does, on the same settings.
//
// The timer has one catch: the browser lets the game take the mouse only just
// after a click, and the timer running out is not one. So a pick that times
// out starts the game and leaves one button up, Click to play, rather than
// putting the whole menu back over a match that has begun.
import cfg from "../config/start.json";
import { HACK_DEFS, savedPicks, type HackId, type HackSlot } from "../game/hacks";

export type StartWay = "range" | "br";
type View = "start" | "pick" | "click" | "menu";

export interface StartOptions {
  /** go in: the picks kept, the mode picked and started (main.ts); `click` is false when the timer ran out */
  go(way: StartWay, picks: Record<HackSlot, HackId>, click: boolean): void;
  /** back into the game already running (the menu's Resume) */
  resume(): void;
  /** a game is running behind the overlay, to resume */
  canResume(): boolean;
  /** the keys the two hacks are on, as the HUD names them */
  keys(): Record<HackSlot, string>;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const SLOTS: HackSlot[] = ["mobility", "utility"];
const WAY_NAME: Record<StartWay, string> = { range: "Firing Range", br: "Battle Royale" };

export class StartScreen {
  view: View = "menu";
  /** More was chosen: the overlay opens on the menu until Back */
  private wantMenu = false;
  /** a match is on: its menu (Leave, the squad) is the one to show, and there is no way back from it to here */
  private inMatch = false;
  private pick: { way: StartWay; endsAt: number; picks: Record<HackSlot, HackId> } | null = null;
  private frame = 0;
  private timer = 0;

  constructor(
    private o: StartOptions,
    /** SpeedKills, and not a test page that asked for the menu (?nohome) */
    readonly enabled: boolean
  ) {
    $("startRange").addEventListener("click", () => this.ask("range"));
    $("startBr").addEventListener("click", () => this.ask("br"));
    $("startMore").addEventListener("click", () => this.more());
    $("startBack").addEventListener("click", () => {
      this.wantMenu = false;
      this.show("start");
    });
    $("startResume").addEventListener("click", () => o.resume());
    $("pickGo").addEventListener("click", () => this.finish(true));
    $("pickBack").addEventListener("click", () => this.cancel());
    $("clickPlay").addEventListener("click", () => o.resume());
    document.addEventListener("keydown", (e) => {
      if (this.view !== "pick") return;
      if (e.key === "Enter") {
        e.preventDefault();
        this.finish(true);
      }
    });
  }

  /** the overlay came up: the start screen, unless a match is on or More was chosen */
  opened(inMatch: boolean): void {
    this.inMatch = inMatch;
    if (this.view === "pick") return;
    this.show(this.enabled && !inMatch && !this.wantMenu ? "start" : "menu");
  }

  /** Esc on the overlay, before it means Resume: the pick goes Back, and the start screen with nothing to resume stays */
  escape(): boolean {
    if (this.view === "pick") {
      this.cancel();
      return true;
    }
    return this.view === "start" && !this.o.canResume();
  }

  /** the menu as it was, from now until Back (More, or an invite link that opens on the Friends tab) */
  more(): void {
    this.wantMenu = true;
    this.cancel(false);
    this.show("menu");
  }

  private show(view: View): void {
    this.view = view;
    $("start").hidden = view !== "start";
    $("pick").hidden = view !== "pick";
    $("clickPlay").hidden = view !== "click";
    (document.querySelector("#overlay .menu") as HTMLElement).hidden = view !== "menu";
    $("startBack").hidden = !this.enabled || this.inMatch;
    $("startResume").hidden = !this.o.canResume();
  }

  /** a way in chosen: the hacks first, on your last picks, for pickSeconds */
  private ask(way: StartWay): void {
    this.pick = { way, endsAt: performance.now() / 1000 + cfg.pickSeconds, picks: savedPicks() };
    $("pickFor").textContent = WAY_NAME[way];
    const keys = this.o.keys();
    $("pickKeyMobility").textContent = keys.mobility;
    $("pickKeyUtility").textContent = keys.utility;
    for (const slot of SLOTS) {
      const row = $(slot === "mobility" ? "pickMobility" : "pickUtility");
      row.textContent = "";
      for (const h of HACK_DEFS.filter((d) => d.slot === slot)) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "pickCard";
        card.dataset.hack = h.id;
        const name = document.createElement("b");
        name.textContent = h.name;
        const line = document.createElement("span");
        line.textContent = h.blurb;
        card.append(name, line);
        card.addEventListener("click", () => {
          if (!this.pick) return;
          this.pick.picks[slot] = h.id;
          this.mark();
        });
        row.appendChild(card);
      }
    }
    this.mark();
    this.show("pick");
    cancelAnimationFrame(this.frame);
    window.clearTimeout(this.timer);
    // the end on a timer as well as the frames: a tab in the background gets no frames, and the wait still has to end
    this.timer = window.setTimeout(() => this.finish(false), cfg.pickSeconds * 1000);
    this.tick();
  }

  /** the picked card of each row lit */
  private mark(): void {
    const p = this.pick;
    if (!p) return;
    for (const card of document.querySelectorAll<HTMLElement>("#pick .pickCard")) {
      const slot: HackSlot = card.parentElement?.id === "pickMobility" ? "mobility" : "utility";
      const on = p.picks[slot] === card.dataset.hack;
      card.classList.toggle("on", on);
      card.setAttribute("aria-pressed", String(on));
    }
  }

  /** the timer's bar and its seconds, until it runs out */
  private tick = (): void => {
    const p = this.pick;
    if (!p) return;
    const left = Math.max(0, p.endsAt - performance.now() / 1000);
    $("pickBar").style.transform = `scaleX(${left / cfg.pickSeconds})`;
    $("pickLeft").textContent = `Starting in ${Math.ceil(left)}`;
    if (left <= 0) {
      this.finish(false);
      return;
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  /** in: with a click (Start now, Enter) the game takes the mouse at once; with the timer's end it asks for one */
  private finish(click: boolean): void {
    const p = this.pick;
    if (!p) return;
    this.pick = null;
    cancelAnimationFrame(this.frame);
    window.clearTimeout(this.timer);
    this.show(click ? "start" : "click");
    this.o.go(p.way, p.picks, click);
  }

  /** Back: no match, the start screen again */
  private cancel(show = true): void {
    this.pick = null;
    cancelAnimationFrame(this.frame);
    window.clearTimeout(this.timer);
    if (show) this.show("start");
  }
}
