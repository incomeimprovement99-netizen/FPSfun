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
import { session } from "../net/account";
import { StartRain } from "./startrain";

export type StartWay = "range" | "br" | "tutorial";
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
  /** someone new here (their profile made on this visit, and no way in ever chosen): the tutorial is pointed out */
  newPlayer: boolean;
  /** the menu, opened on one of its tabs (the sign-in line's links) */
  openTab(tab: "settings" | "account"): void;
}

/** a way in has been chosen in this browser: from then on its player is not new, and the nudge is not shown */
const STARTED_KEY = "range.startedOnce";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const SLOTS: HackSlot[] = ["mobility", "utility"];
const WAY_NAME: Record<StartWay, string> = { range: "Firing Range", br: "Battle Royale", tutorial: "Tutorial" };

export class StartScreen {
  view: View = "menu";
  /** More was chosen: the overlay opens on the menu until Back */
  private wantMenu = false;
  /** a match is on: its menu (Leave, the squad) is the one to show, and there is no way back from it to here */
  private inMatch = false;
  private pick: { way: StartWay; endsAt: number; picks: Record<HackSlot, HackId> } | null = null;
  private frame = 0;
  private timer = 0;
  /** the rain behind it, while it is up */
  private readonly rain = new StartRain($("startRain"));

  constructor(
    private o: StartOptions,
    /** SpeedKills, and not a test page that asked for the menu (?nohome) */
    readonly enabled: boolean
  ) {
    // The tutorial goes straight in: it teaches the hacks in their own room, on the picks you already have (Milestone 632)
    $("startTutorial").addEventListener("click", () => {
      this.started();
      this.o.go("tutorial", savedPicks(), true);
    });
    // A new player is pointed at it (the owner, 2026-10-17: "New players should get a nudge ... returning players
    // shouldn't get that"); anyone who has chosen a way in before has not
    let started = false;
    try {
      started = localStorage.getItem(STARTED_KEY) === "1";
    } catch {
      /* no storage: treated as returning, no nudge */
      started = true;
    }
    this.nudge(o.newPlayer && !started);
    $("startRange").addEventListener("click", () => this.ask("range"));
    $("startBr").addEventListener("click", () => this.ask("br"));
    $("startMore").addEventListener("click", () => this.more());
    // (Milestone 635, the owner: "a login or something with some helper text ... Then do a link for settings and the
    // account tab")
    $("startSettings").addEventListener("click", () => {
      this.more();
      o.openTab("settings");
    });
    $("startAccount").addEventListener("click", () => {
      this.more();
      o.openTab("account");
    });
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

  /**
   * Start on a controller: in the pick it is Start now, as the button is. It played the range with the pick's timer
   * still going behind the game, which then pulled you into the mode picked (Milestone 905). True when it was the pick's.
   */
  startNow(): boolean {
    if (this.view !== "pick" || !this.pick) return false;
    this.finish(true);
    return true;
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
    this.rain.set(view === "start");
    if (view === "start") this.signLine();
  }

  /** the sign-in line: the helper and its two links, or, signed in, whose the settings and stats are */
  private signLine(): void {
    const s = session();
    const text = $("startSignText");
    if (s) {
      text.textContent = "";
      const who = document.createElement("b");
      who.textContent = s.name;
      text.append("Signed in as ", who, ": your settings and stats are kept on your account.");
    } else text.textContent = "If you change your settings, they will be saved as long as you connect from the same browser. Making an account will always keep your settings and allow for stat tracking.";
    $("startAccount").textContent = s ? "Account" : "Sign in or make an account";
  }

  /** the tutorial pointed out, or not */
  private nudge(on: boolean): void {
    $("startNudge").hidden = !on;
    $("startTutorial").classList.toggle("nudge", on);
  }

  /** a way in has been chosen: this browser's player is not new any more */
  private started(): void {
    this.nudge(false);
    try {
      localStorage.setItem(STARTED_KEY, "1");
    } catch {
      /* the nudge comes back next visit: no harm */
    }
  }

  /** a way in chosen: the hacks first, on your last picks, for pickSeconds */
  private ask(way: StartWay): void {
    this.started();
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
