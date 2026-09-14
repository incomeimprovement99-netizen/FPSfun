// The menu: tabs (Play, 1v1, Loadouts, Settings, Controls) and the loadout
// editor. Settings and the 1v1 box keep their own wiring in main.ts; this
// owns navigation and loadouts.
import { DEFAULT_LOADOUTS, type LoadoutDef, type LoadoutRef, type Loadouts } from "../game/loadouts";
import { OPERATORS } from "../game/operators";
import { HEIRLOOMS } from "../game/heirlooms";
import { Stats, type MatchKind, type MatchStats } from "../game/stats";
import { leaderboardOnline } from "../game/leaderboard";

export type Mode = "range" | "run" | "runAdvanced" | "duel" | "arena" | "bots";
export type Tab = "play" | "duel" | "loadouts" | "stats" | "settings" | "controls";

export interface MenuOptions {
  weaponIds: string[];
  weaponName: (id: string) => string;
  /** the selected loadout changed, or was edited: apply it */
  onApply: (def: LoadoutDef) => void;
  /** a mode button: go there and play */
  onGo: (mode: Mode) => void;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

export class Menu {
  tab: Tab = "play";

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
    $("goRange").addEventListener("click", () => o.onGo("range"));
    $("goRun").addEventListener("click", () => o.onGo("run"));
    $("goRunAdvanced").addEventListener("click", () => o.onGo("runAdvanced"));
    $("goDuel").addEventListener("click", () => this.show("duel"));
    $("goArena").addEventListener("click", () => o.onGo("arena"));
    $("goBots").addEventListener("click", () => o.onGo("bots"));

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
    $("statsOnline").textContent = leaderboardOnline()
      ? "Online boards are on: every run and win is posted under your name."
      : "Everything here is saved in this browser only. Online boards need the leaderboard server (docs/NEXT_STEPS.md).";
    body.innerHTML = [
      matchCard("1v1 with friends", ["duel"]),
      matchCard("1v1v1 with friends", ["triple"]),
      matchCard("Arena, Bots", ["bots:easy", "bots:normal", "bots:hard"]),
      courseCard("basic", "The Run (Basic)"),
      courseCard("advanced", "The Run (Advanced)"),
      techCard,
    ].join("");
  }

  show(tab: Tab): void {
    this.tab = tab;
    if (tab === "stats") this.renderStats();
    for (const b of document.querySelectorAll<HTMLButtonElement>("#tabs button")) b.classList.toggle("on", b.dataset.tab === tab);
    for (const p of document.querySelectorAll<HTMLElement>("[data-panel]")) p.hidden = p.dataset.panel !== tab;
  }

  setRunBest(basic: number | null, advanced: number | null): void {
    $("runBest").textContent = basic !== null ? `Seven rooms, one technique each. Your best: ${basic.toFixed(2)} s.` : "Seven rooms, one technique each, twenty pop-ups.";
    $("runAdvancedBest").textContent = advanced !== null ? `Nine rooms, 200 m, the techniques chained. Your best: ${advanced.toFixed(2)} s.` : "Nine rooms, 200 m, the techniques chained. Thirty pop-ups.";
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
