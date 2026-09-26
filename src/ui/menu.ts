// The menu: tabs (Play, 1v1, Loadouts, Settings, Controls) and the loadout
// editor. Settings and the 1v1 box keep their own wiring in main.ts; this
// owns navigation, loadouts and the battle royale's lobby row.
import { IS_SK } from "../game/game";
import { DEFAULT_LOADOUTS, type LoadoutDef, type LoadoutRef, type Loadouts } from "../game/loadouts";
import { bodyOf, loadMannequin } from "../game/mannequin";
import { botSquads, saveTeamId, savedTeamId, teamFor } from "../game/brmatch";
import { OPERATORS, operatorById } from "../game/operators";
import { BODY_IDS, BUILD_IDS, OUTFIT_IDS, bodyName, buildName, outfitInfo } from "../game/outfit";
import { HEIRLOOMS } from "../game/heirlooms";
import { Stats, type MatchKind, type MatchStats } from "../game/stats";
import { BOARDS, leaderboardOnline, topScores, type BoardEntry } from "../game/leaderboard";
import { LOBBY_MODES, lobbyMode, setupFor, friendsModeFor } from "./lobby";

export type Mode = "range" | "run" | "runAdvanced" | "duel" | "arena" | "bots" | "br" | "gunrun" | "tdm" | "crown" | "control" | "ffa" | "search" | "tour" | "lab";
export type Tab = "play" | "duel" | "loadouts" | "stats" | "settings" | "controls";

export interface MenuOptions {
  /** the Loadouts tab was drawn again (a loadout picked, one changed): the page's own pickers follow it */
  onRendered?: () => void;
  weaponIds: string[];
  weaponName: (id: string) => string;
  /** the selected loadout changed, or was edited: apply it */
  onApply: (def: LoadoutDef) => void;
  /** a mode button: go there and play */
  onGo: (mode: Mode) => void;
  /** the panel's With friends button: make a match on these settings and copy the invite */
  onFriends?: (mode: Mode) => void;
  /** this session's numbers per gun, for the Stats tab */
  sessionGuns?: () => Array<{ name: string; shots: number; hits: number; heads: number; damage: number }>;
  /** the account level and the active challenges (src/game/progress.ts), for the Stats tab */
  progress?: () => { level: number; into: number; need: number; xp: number; done: number; challenges: Array<{ label: string; got: number; goal: number; xp: number }> };
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/** where main.ts keeps the bot count; the row writes it too, since it moves the count itself */
// each game its own: SpeedKills' counts are not the legacy game's
const BR_BOTS_KEY = IS_SK ? "range.br.bots.sk" : "range.br.bots";
const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const word = (n: number): string => COUNT_WORDS[n] ?? String(n);

/**
 * The battle royale's squad size, for whoever starts the match: a host should
 * put it in the welcome packet so the whole lobby plays the same one.
 *
 * It is read off the row rather than out of main.ts because the row is this
 * file's, and a size taken from anywhere else would be a second source of
 * truth for the same choice. A match played alone reads the same store for
 * itself (brmatch.ts savedTeamId).
 */
/** the battle royale's rules, the row's choice, kept between visits: the host's goes in the welcome */
const BR_RULES_KEY = "range.brRules.v1";
/** the lobby's mode, so the panel opens where it was left */
const LOBBY_KEY = "range.lobby.mode";
export function brRulesId(): string {
  const sel = document.getElementById("brRules") as HTMLSelectElement | null;
  if (sel?.value) return sel.value === "resurgence" ? "resurgence" : "br";
  try {
    return localStorage.getItem(BR_RULES_KEY) === "resurgence" ? "resurgence" : "br";
  } catch {
    return "br";
  }
}

export function brTeamId(): string {
  const sel = document.getElementById("brTeam") as HTMLSelectElement | null;
  return sel?.value ? teamFor(sel.value).id : savedTeamId();
}

export class Menu {
  tab: Tab = "play";
  /** the mode the lobby is set up for, kept between visits */
  picked: Mode = "range";
  /** the online board the Stats tab shows, and what it last fetched (kept 20 s) */
  private boardPick = BOARDS[0].id;
  private boardCache = new Map<string, { at: number; entries: BoardEntry[] }>();

  constructor(
    private loadouts: Loadouts,
    private stats: Stats,
    private o: MenuOptions
  ) {
    for (const b of document.querySelectorAll<HTMLButtonElement>("#tabs button")) {
      b.addEventListener("click", () => this.show(b.dataset.tab as Tab));
    }
    const nameIn = $<HTMLInputElement>("profileName");
    nameIn.value = stats.profile.name;
    nameIn.addEventListener("change", () => {
      stats.setName(nameIn.value);
      nameIn.value = stats.profile.name;
      this.renderStats();
    });
    this.renderStats();
    // The lobby: a card picks the mode and opens that mode's own options, and
    // the green button starts it. A card used to start the match on the spot,
    // on whatever the last visit had left in three boxes on another tab, which
    // is how a battle royale with a friend came to need the tab marked 1v1.
    for (const m of LOBBY_MODES) {
      const card = $<HTMLButtonElement>(m.go);
      card.addEventListener("click", () => this.pickMode(m.id));
      // a second click on the card you are already on starts it, so the fast
      // way in is still one gesture for anyone who knows what they want
      card.addEventListener("dblclick", () => (m.solo ? o.onGo(m.id) : o.onFriends?.(m.id)));
    }
    $("startMode").addEventListener("click", () => {
      const m = lobbyMode(this.picked);
      if (m?.solo) o.onGo(this.picked);
      else o.onFriends?.(this.picked);
    });
    $("playFriends").addEventListener("click", () => o.onFriends?.(this.picked));
    // the aim bot, mirrored from the Settings tab: a practice helper belongs
    // with the rest of a match's setup. Settings still keeps the stored one.
    const aimLobby = $<HTMLSelectElement>("aimbotLobby");
    aimLobby.addEventListener("change", () => {
      const real = document.getElementById("aimbotMode") as HTMLSelectElement | null;
      if (!real) return;
      real.value = aimLobby.value;
      real.dispatchEvent(new Event("change"));
    });
    let opened = "range";
    try {
      opened = localStorage.getItem(LOBBY_KEY) || "range";
    } catch {
      /* storage off: the range */
    }
    this.pickMode(lobbyMode(opened) ? (opened as Mode) : "range");

    // The battle royale's lobby row: the squad size, and a bot count that
    // goes with it. The first render reads the stored count itself: the
    // page's own options are not every size's, so a count restored against
    // them (main.ts does, before this runs) could be dropped for one the size
    // never offered.
    const brRules = $<HTMLSelectElement>("brRules");
    try {
      brRules.value = localStorage.getItem(BR_RULES_KEY) === "resurgence" ? "resurgence" : "br";
    } catch {
      brRules.value = "br";
    }
    brRules.addEventListener("change", () => {
      try {
        localStorage.setItem(BR_RULES_KEY, brRules.value);
      } catch {
        // storage off: the choice holds for the visit
      }
    });
    const brTeam = $<HTMLSelectElement>("brTeam");
    brTeam.value = savedTeamId();
    brTeam.addEventListener("change", () => {
      saveTeamId(brTeam.value);
      this.renderBrRow();
    });
    $<HTMLSelectElement>("brBots").addEventListener("change", () => this.renderBrRow());
    let stored = 0;
    try {
      stored = Number(localStorage.getItem(BR_BOTS_KEY)) || 0;
    } catch {
      /* ignore */
    }
    // nothing stored: the size's own default, not whatever the page's first option happens to be
    this.renderBrRow(stored || teamFor(brTeam.value).defaultBots);

    // weapon pickers, sorted by name
    const sorted = o.weaponIds.slice().sort((a, b) => o.weaponName(a).localeCompare(o.weaponName(b)));
    for (const [i, id] of [
      [0, "slot0"],
      [1, "slot1"],
    ] as const) {
      const sel = $<HTMLSelectElement>(id);
      for (const w of sorted) {
        const opt = document.createElement("option");
        opt.value = w;
        opt.textContent = o.weaponName(w);
        sel.appendChild(opt);
      }
      sel.addEventListener("change", () => this.editCurrent(i === 0 ? { slot1: sel.value } : { slot2: sel.value }));
    }
    $<HTMLInputElement>("loadoutName").addEventListener("change", (e) => this.editCurrent({ name: (e.target as HTMLInputElement).value }));
    const target = $<HTMLSelectElement>("copyTarget");
    for (let i = 0; i < 5; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `into Custom slot ${i + 1}`;
      target.appendChild(opt);
    }
    $("copyLoadout").addEventListener("click", () => {
      const def = this.loadouts.copyTo(this.loadouts.selected, Number(target.value));
      this.o.onApply(def);
      this.render();
    });
    this.render();
  }

  /**
   * Pick a mode: the card lights up, the panel becomes that mode's own, and
   * the choice is remembered. Nothing starts.
   */
  pickMode(id: Mode): void {
    if (!lobbyMode(id)) return;
    this.picked = id;
    try {
      localStorage.setItem(LOBBY_KEY, id);
    } catch {
      /* storage off: it holds for the visit */
    }
    this.renderSetup();
  }

  /**
   * The panel: the mode's name, its own line, and only the options it obeys.
   * The line is read off the card rather than written twice, because the cards
   * are what the game keeps up to date (the Run's best times, the battle
   * royale's lobby size) and a second copy of it would go stale.
   */
  renderSetup(): void {
    const m = lobbyMode(this.picked);
    if (!m) return;
    for (const card of document.querySelectorAll<HTMLElement>(".lobby .mode")) {
      card.classList.toggle("on", card.dataset.mode === m.id);
    }
    $("setupName").textContent = m.name;
    const card = document.getElementById(m.go);
    $("setupLine").textContent = card?.querySelector("span")?.textContent ?? m.card;
    const needs = setupFor(m.id);
    for (const g of document.querySelectorAll<HTMLElement>(".setupGroup")) {
      g.hidden = !needs.includes(g.dataset.group as never);
    }
    const start = $<HTMLButtonElement>("startMode");
    const friends = $<HTMLButtonElement>("playFriends");
    const shared = friendsModeFor(m.id);
    start.hidden = !m.solo;
    start.textContent = needs.length ? `Start ${m.name}` : "Start";
    friends.hidden = !shared;
    // with friends is the only way into a 1v1, so there it wears the colour
    friends.classList.toggle("go", !m.solo);
    $("setupFriends").textContent = shared
      ? "With friends makes the match on these settings and copies the invite link: everyone who opens it plays this map, these bots and these rules."
      : "On your own. Every mode from the arena down can be played with friends instead.";
    // the aim bot's switch follows the one on the Settings tab
    const real = document.getElementById("aimbotMode") as HTMLSelectElement | null;
    if (real) $<HTMLSelectElement>("aimbotLobby").value = real.value;
  }

  /**
   * The battle royale's row: the squad size, the bot counts that make whole
   * bot squads at that size, and one line saying what the lobby comes to.
   * The counts are the size's (src/config/br.json), so picking Trios cannot
   * leave a bot squad a seat short, and moving between sizes keeps the lobby
   * about as big as it was. You, and any friends, are a squad of your own.
   */
  private renderBrRow(wanted?: number): void {
    const t = teamFor($<HTMLSelectElement>("brTeam").value);
    const bots = $<HTMLSelectElement>("brBots");
    const want = wanted || Number(bots.value) || t.defaultBots;
    const pick = t.bots.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a), t.defaultBots);
    bots.innerHTML = "";
    for (const n of t.bots) {
      const o = document.createElement("option");
      o.value = String(n);
      o.textContent = `${n} bots (${n + 1} in the match)`;
      bots.appendChild(o);
    }
    bots.value = String(pick);
    try {
      localStorage.setItem(BR_BOTS_KEY, bots.value);
    } catch {
      /* ignore */
    }
    const players = pick + 1;
    const squads = botSquads(pick, t.size);
    const theirs = `${word(squads)} squad${squads === 1 ? "" : "s"} of ${word(t.size)}`;
    const lobby = t.size === 1 ? `${word(players)} in the match, one life each` : `${word(players)} in the match: you, and ${theirs}`;
    $("brLobby").textContent = `${lobby[0].toUpperCase()}${lobby.slice(1)}. Friends who join are on your side. The ring closes six times, there are 4 heals, and M is the map.`;
    $("brBlurb").textContent =
      t.size === 1
        ? `Solo: drop onto Outskirts with ${word(pick)} bots, one life each, the ring closes, last one standing.`
        : `${t.label}: drop onto Outskirts against ${theirs} bots, the ring closes, last squad standing.`;
    if (this.picked === "br") this.renderSetup();
  }

  /** the Stats tab: matches, courses, tech, from the profile */
  renderStats(): void {
    const p = this.stats.profile;
    const body = $("statsBody");
    const matchCard = (title: string, kinds: MatchKind[]): string => {
      const rows = kinds.map((k) => [k, p.matches[k]] as const).filter((x): x is readonly [MatchKind, MatchStats] => !!x[1] && x[1].played > 0);
      if (!rows.length) return `<div class="statcard"><h4>${esc(title)}</h4><div class="empty">No matches yet.</div></div>`;
      const sum = rows.reduce(
        (a, [, m]) => ({ played: a.played + m.played, won: a.won + m.won, kills: a.kills + m.kills, deaths: a.deaths + m.deaths, damage: a.damage + m.damage, shots: a.shots + m.shots, hits: a.hits + m.hits, bestStreak: Math.max(a.bestStreak, m.bestStreak), streak: Math.max(a.streak, m.streak), roundsWon: a.roundsWon + m.roundsWon, roundsLost: a.roundsLost + m.roundsLost, lost: a.lost + m.lost }),
        { played: 0, won: 0, lost: 0, kills: 0, deaths: 0, damage: 0, shots: 0, hits: 0, bestStreak: 0, streak: 0, roundsWon: 0, roundsLost: 0 }
      );
      const per = rows.length > 1 ? rows.map(([k, m]) => `<tr><td>${esc(k.replace("bots:", ""))}</td><td>${m.won} W ${m.lost} L, K/D ${Stats.kd(m)}</td></tr>`).join("") : "";
      return `<div class="statcard"><h4>${esc(title)}</h4><div class="big">${sum.won}<small>WON</small> ${sum.lost}<small>LOST</small></div><table>
        <tr><td>Win rate</td><td>${sum.played ? Math.round((100 * sum.won) / sum.played) : 0}%</td></tr>
        <tr><td>K/D</td><td>${Stats.kd(sum)} (${sum.kills} / ${sum.deaths})</td></tr>
        <tr><td>Rounds</td><td>${sum.roundsWon} - ${sum.roundsLost}</td></tr>
        <tr><td>Damage</td><td>${Math.round(sum.damage)}</td></tr>
        <tr><td>Accuracy</td><td>${Stats.accuracy(sum)}</td></tr>
        <tr><td>Win streak</td><td>${sum.streak} (best ${sum.bestStreak})</td></tr>${per}</table></div>`;
    };
    const courseCard = (id: string, title: string): string => {
      const c = p.courses[id];
      if (!c || !c.runs) return `<div class="statcard"><h4>${esc(title)}</h4><div class="empty">No runs yet.</div></div>`;
      const board = c.board.map((e, i) => `<tr><td>${i + 1}. ${esc(e.rank)}</td><td>${e.time.toFixed(2)} s <span style="color:#7d8895">${new Date(e.at).toLocaleDateString()}</span></td></tr>`).join("");
      return `<div class="statcard"><h4>${esc(title)}</h4><div class="big">${c.best !== null ? c.best.toFixed(2) : "-"}<small>BEST, ${c.runs} RUNS</small></div><table>${board}</table></div>`;
    };
    const techs = Object.entries(p.tech).sort((a, b) => b[1] - a[1]);
    const misses = Object.entries(p.techMiss).sort((a, b) => b[1] - a[1]);
    const techCard =
      techs.length || misses.length
        ? `<div class="statcard wide"><h4>Tech landed</h4><div class="techlist">${techs.map(([n, c]) => `<span>${esc(n)} <b>${c}</b></span>`).join("") || '<span class="empty">none yet</span>'}</div>
           <h4 style="margin-top:10px">Misses called out</h4><div class="techlist">${misses.map(([n, c]) => `<span class="miss">${esc(n)} <b>${c}</b></span>`).join("") || '<span class="empty">none</span>'}</div></div>`
        : `<div class="statcard wide"><h4>Tech</h4><div class="empty">Nothing landed yet. The feed on the left names every superglide, wallbounce and lurch as you do it, and says why a miss missed.</div></div>`;
    // the level and the challenges, first: it is the one card that changes
    // every match whatever you played
    const pr = this.o.progress?.();
    const levelCard = pr
      ? `<div class="statcard wide" id="levelCard"><h4>Level ${pr.level}</h4>
          <div class="big">${pr.level}<small>${pr.need ? `${Math.floor(pr.into)} / ${pr.need} XP TO ${pr.level + 1}` : "MAX LEVEL"}</small></div>
          <div style="height:8px;background:#222932;border-radius:4px;margin:6px 0 10px"><div style="height:8px;border-radius:4px;background:#ffd23c;width:${pr.need ? Math.round((100 * pr.into) / pr.need) : 100}%"></div></div>
          <table>${pr.challenges
            .map(
              (c) =>
                `<tr><td>${esc(c.label)}</td><td>${Math.floor(c.got)} / ${c.goal} <span style="color:#ffd23c">+${c.xp} XP</span></td></tr>`
            )
            .join("")}</table>
          <div class="empty" style="margin-top:6px">${pr.xp} XP all time, ${pr.done} challenges finished. Every match pays; winning, damage and kills pay more.</div></div>`
      : "";
    body.innerHTML = [
      levelCard,
      `<div class="statcard wide" id="onlineCard" hidden></div>`,
      matchCard("1v1 with friends", ["duel"]),
      matchCard("1v1v1 with friends", ["triple"]),
      matchCard("Arena, Bots", ["bots:easy", "bots:normal", "bots:hard", "bots:elite", "bots:mixed"]),
      matchCard("Battle Royale (bots)", ["br"]),
      matchCard("Gun Run", ["gunrun"]),
      matchCard("Team Deathmatch", ["tdm"]),
      matchCard("Crown", ["crown"]),
      matchCard("Control", ["control"]),
      matchCard("Free-for-all", ["ffa"]),
      matchCard("Search", ["search"]),
      courseCard("basic", "The Run (Basic)"),
      courseCard("advanced", "The Run (Advanced)"),
      courseCard("drill", "Flick drill (30 targets)"),
      this.gunsCard(),
      techCard,
    ].join("");
    void this.renderOnline();
  }

  /** this session, per gun: shots, hits, headshots, damage, accuracy (the live overlay's numbers, split) */
  private gunsCard(): string {
    const rows = (this.o.sessionGuns?.() ?? []).filter((r) => r.shots > 0).sort((a, b) => b.shots - a.shots);
    if (!rows.length) return `<div class="statcard"><h4>This session, by gun</h4><div class="empty">Fire something: each gun's numbers go here.</div></div>`;
    const tr = rows
      .map((r) => `<tr><td>${esc(r.name)}</td><td>${Math.round((100 * r.hits) / r.shots)}% · ${r.hits}/${r.shots} · ${r.heads} HS · ${Math.round(r.damage)} dmg</td></tr>`)
      .join("");
    return `<div class="statcard"><h4>This session, by gun</h4><table>${tr}</table></div>`;
  }

  /** the online boards card, when the site has a board (our own server does) */
  private async renderOnline(): Promise<void> {
    const on = await leaderboardOnline();
    $("statsOnline").textContent = on
      ? "Online boards are on: every course run and every win is posted under your name."
      : "Everything here is saved in this browser only. The online boards are on the game's own server.";
    const card = document.getElementById("onlineCard");
    if (!card || !on) return;
    const pick = BOARDS.find((b) => b.id === this.boardPick) ?? BOARDS[0];
    const options = BOARDS.map((b) => `<option value="${b.id}"${b.id === pick.id ? " selected" : ""}>${esc(b.label)}</option>`).join("");
    const head = `<h4 style="display:flex;justify-content:space-between;align-items:center;gap:10px">Online boards <select id="boardPick" class="boardPick">${options}</select></h4>`;
    card.hidden = false;
    const cached = this.boardCache.get(pick.id);
    if (!cached) card.innerHTML = `${head}<div class="empty">Loading...</div>`;
    let entries = cached?.entries ?? [];
    if (!cached || performance.now() - cached.at > 20000) {
      entries = await topScores(pick.id, 15);
      this.boardCache.set(pick.id, { at: performance.now(), entries });
    }
    // the tab may have been redrawn while the board was on its way
    const now = document.getElementById("onlineCard");
    if (!now) return;
    const me = this.stats.profile.name;
    const fmt = (v: number) =>
      pick.unit === "s" ? `${v.toFixed(2)} s` : pick.unit === "kills" ? `${v} ${v === 1 ? "kill" : "kills"}` : pick.unit === "damage" ? `${v} damage` : `${v} ${v === 1 ? "win" : "wins"}`;
    const rows = entries
      .map((e, i) => `<tr${e.name === me ? ' class="me"' : ""}><td>${i + 1}. ${esc(e.name)}</td><td>${fmt(e.value)} <span style="color:#7d8895">${esc(new Date(e.at).toLocaleDateString())}</span></td></tr>`)
      .join("");
    now.innerHTML = `${head}${rows ? `<table>${rows}</table>` : `<div class="empty">Nobody on this board yet. ${pick.unit === "s" ? "Finish a run" : pick.unit === "wins" ? "Win a match" : "Play a match"} and you are first.</div>`}`;
    now.querySelector<HTMLSelectElement>("#boardPick")?.addEventListener("change", (e) => {
      this.boardPick = (e.target as HTMLSelectElement).value;
      void this.renderOnline();
    });
  }

  show(tab: Tab): void {
    this.tab = tab;
    if (tab === "stats") this.renderStats();
    // the figure in the Loadouts panel is the mannequin: ask for it now, so it
    // is there by the time somebody has read the cards
    if (tab === "loadouts") void loadMannequin();
    for (const b of document.querySelectorAll<HTMLButtonElement>("#tabs button")) b.classList.toggle("on", b.dataset.tab === tab);
    for (const p of document.querySelectorAll<HTMLElement>("[data-panel]")) p.hidden = p.dataset.panel !== tab;
  }

  setRunBest(basic: number | null, advanced: number | null): void {
    $("runBest").textContent = basic !== null ? `Seven rooms, one technique each. Your best: ${basic.toFixed(2)} s.` : "Seven rooms, one technique each, twenty pop-ups.";
    $("runAdvancedBest").textContent = advanced !== null ? `Nine rooms, 200 m, the techniques chained. Your best: ${advanced.toFixed(2)} s.` : "Nine rooms, 200 m, the techniques chained. Thirty pop-ups.";
    // the panel shows the card's line, so a new best time has to reach it
    if (this.picked === "run" || this.picked === "runAdvanced") this.renderSetup();
  }

  private editCurrent(patch: Partial<LoadoutDef>): void {
    const sel = this.loadouts.selected;
    if (sel.kind !== "custom") return;
    const def = this.loadouts.edit(sel.index, patch);
    this.o.onApply(def);
    this.render();
  }

  private select(ref: LoadoutRef): void {
    const def = this.loadouts.select(ref);
    this.o.onApply(def);
    this.render();
  }

  /** redraw the loadout list, the editor and the summaries */
  render(): void {
    const cur = this.loadouts.current;
    const sel = this.loadouts.selected;
    const editable = sel.kind === "custom";

    const list = $("loadoutList");
    list.innerHTML = "";
    const group = (label: string, defs: readonly LoadoutDef[], kind: LoadoutRef["kind"]) => {
      const h = document.createElement("div");
      h.className = "group";
      h.textContent = label;
      list.appendChild(h);
      defs.forEach((d, index) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = sel.kind === kind && sel.index === index ? "on" : "";
        b.innerHTML = `${esc(d.name)}<small>${esc(this.o.weaponName(d.slot1))} / ${esc(this.o.weaponName(d.slot2))}</small>`;
        b.addEventListener("click", () => this.select({ kind, index }));
        list.appendChild(b);
      });
    };
    group("DEFAULT", DEFAULT_LOADOUTS, "default");
    group("CUSTOM", this.loadouts.custom, "custom");

    const name = $<HTMLInputElement>("loadoutName");
    name.value = cur.name;
    name.disabled = !editable;
    $("loadoutLocked").hidden = editable;
    $<HTMLSelectElement>("slot0").value = cur.slot1;
    $<HTMLSelectElement>("slot1").value = cur.slot2;
    $<HTMLSelectElement>("slot0").disabled = !editable;
    $<HTMLSelectElement>("slot1").disabled = !editable;
    this.o.onRendered?.();

    const ops = $("operatorCards");
    ops.innerHTML = "";
    for (const op of OPERATORS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = op.id === cur.operator ? "on" : "";
      b.disabled = !editable;
      b.title = op.blurb;
      b.innerHTML = `<span class="sw"><i style="background:${hex(op.shell)}"></i><i style="background:${hex(op.accent)}"></i><i style="background:${hex(op.eye)}"></i></span><b>${esc(op.name)}</b>${esc(op.blurb)}`;
      b.addEventListener("click", () => this.editCurrent({ operator: op.id }));
      ops.appendChild(b);
    }
    // What they wear, under the kit (src/game/outfit.ts). The operator's own
    // set is the default; picking one here overrides it for this loadout, so
    // two players on the same operator can look like two people.
    const worn = $("outfitCards");
    worn.innerHTML = "";
    for (const id of OUTFIT_IDS) {
      const info = outfitInfo(id);
      const b = document.createElement("button");
      b.type = "button";
      b.className = id === (cur.outfit ?? operatorById(cur.operator).outfit) ? "on" : "";
      b.disabled = !editable;
      b.title = info.blurb;
      b.innerHTML = `<b>${esc(info.name)}</b>${esc(info.blurb)}`;
      b.addEventListener("click", () => this.editCurrent({ outfit: id }));
      worn.appendChild(b);
    }
    const buildSel = $<HTMLSelectElement>("opBuild");
    if (!buildSel.options.length) {
      for (const id of BUILD_IDS) {
        const o = document.createElement("option");
        o.value = id;
        o.textContent = buildName(id);
        buildSel.appendChild(o);
      }
      buildSel.addEventListener("change", () => this.editCurrent({ build: buildSel.value }));
    }
    buildSel.value = cur.build ?? operatorById(cur.operator).build ?? "regular";
    buildSel.disabled = !editable;
    const bodySel = $<HTMLSelectElement>("opBody");
    if (!bodySel.options.length) {
      for (const id of BODY_IDS) {
        const o = document.createElement("option");
        o.value = id;
        o.textContent = bodyName(id);
        bodySel.appendChild(o);
      }
      bodySel.addEventListener("change", () => this.editCurrent({ body: bodySel.value }));
    }
    bodySel.value = bodyOf(cur.outfit ?? operatorById(cur.operator).outfit, cur.body);
    bodySel.disabled = !editable;
    const faceSel = $<HTMLSelectElement>("opFace");
    if (!faceSel.dataset.wired) {
      faceSel.dataset.wired = "1";
      faceSel.addEventListener("change", () => this.editCurrent({ face: faceSel.value }));
    }
    faceSel.value = cur.face ?? (operatorById(cur.operator).face ?? []).join(",");
    faceSel.disabled = !editable;

    const hl = $("heirloomCards");
    hl.innerHTML = "";
    for (const h of HEIRLOOMS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = h.id === cur.heirloom ? "on" : "";
      b.disabled = !editable;
      b.innerHTML = `<b>${esc(h.name)}</b>${esc(h.blurb)}`;
      b.addEventListener("click", () => this.editCurrent({ heirloom: h.id }));
      hl.appendChild(b);
    }

    const opName = OPERATORS.find((x) => x.id === cur.operator)?.name ?? "";
    $("loadoutChip").innerHTML = `Loadout <b>${esc(cur.name)}</b> &middot; ${esc(opName)}`;
    $("duelLoadout").textContent = `${cur.name} (${this.o.weaponName(cur.slot1)}, ${this.o.weaponName(cur.slot2)})`;
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
