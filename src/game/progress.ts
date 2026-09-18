// The progression spine: XP, an account level, and rolling challenges.
//
// Every big shooter gives you something for playing beyond the match itself,
// and this one gave you nothing: the stats were there, banked per mode, but
// they went nowhere. This turns them into a number that goes up.
//
// It is kept apart from the profile (src/game/stats.ts) on purpose: its own
// storage key, its own validation, so the profile's schema and the online
// board that reads it are untouched. The numbers are in
// src/config/progress.json.
import cfg from "../config/progress.json";
import type { MatchKind, MatchSummary } from "./stats";

export interface Challenge {
  id: string;
  label: string;
  stat: string;
  goal: number;
  xp: number;
}
export const CHALLENGES = cfg.challenges as Challenge[];

interface State {
  /** everything ever earned */
  xp: number;
  /** the active challenges and how far each has got */
  active: Array<{ id: string; got: number }>;
  /** how many challenges have been finished, all time */
  done: number;
}

export interface Award {
  gained: number;
  /** what the match itself paid, before challenges */
  match: number;
  levelBefore: number;
  levelAfter: number;
  /** challenges finished by this award */
  completed: Challenge[];
}

const KEY = "range.progress.v1";
const MODE_KINDS = new Set(["gunrun", "tdm", "crown", "control", "ffa"]);

/** what one level to the next costs: level n to n + 1 */
export function levelCost(n: number): number {
  return Math.round((cfg.levels.first * Math.pow(cfg.levels.growth, n - 1)) / 50) * 50;
}

/** the level a total of XP reaches, and how far into the next one it is */
export function levelFor(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let left = Math.max(0, xp);
  while (level < cfg.levels.cap && left >= levelCost(level)) {
    left -= levelCost(level);
    level++;
  }
  return { level, into: level >= cfg.levels.cap ? 0 : left, need: level >= cfg.levels.cap ? 0 : levelCost(level) };
}

/** what a finished match pays, before challenges */
export function xpFor(kind: MatchKind, s: MatchSummary): number {
  const x = cfg.xp;
  let xp = x.played + s.kills * x.kill + Math.floor(Math.max(0, s.damage) / 100) * x.damagePer100;
  if (kind === "br") {
    const players = s.players ?? 0;
    if (s.placement !== undefined && s.placement <= 3) xp += x.brTop3;
    else if (s.placement !== undefined && players > 10 && s.placement <= 10) xp += x.brTop10;
    xp += Math.floor(Math.min(x.brMinutesCap, Math.max(0, (s.survived ?? 0) / 60))) * x.brPerMinute;
  } else {
    if (s.won) xp += x.win;
    xp += Math.max(0, s.roundsWon) * x.roundWon;
  }
  return Math.max(0, Math.round(xp));
}

/** what a match adds to each challenge stat */
function statsOf(kind: MatchKind, s: MatchSummary): Record<string, number> {
  return {
    kills: Math.max(0, s.kills),
    damage: Math.max(0, s.damage),
    hits: Math.max(0, s.hits),
    wins: s.won ? 1 : 0,
    br: kind === "br" ? 1 : 0,
    brTop3: kind === "br" && s.placement !== undefined && s.placement <= 3 ? 1 : 0,
    arena: MODE_KINDS.has(kind) ? 1 : 0,
  };
}

function clean(raw: unknown): State {
  const fresh: State = { xp: 0, active: [], done: 0 };
  if (raw && typeof raw === "object") {
    const r = raw as Partial<State>;
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
    fresh.xp = n(r.xp);
    fresh.done = Math.floor(n(r.done));
    if (Array.isArray(r.active))
      for (const a of r.active) if (a && typeof a === "object" && CHALLENGES.some((c) => c.id === (a as { id: unknown }).id) && !fresh.active.some((x) => x.id === a.id)) fresh.active.push({ id: a.id, got: n(a.got) });
  }
  return fresh;
}

export class Progress {
  private s: State;
  /** called whenever something changes, so a screen that shows it can redraw */
  onChange: (() => void) | null = null;

  constructor(private readonly storage: Pick<Storage, "getItem" | "setItem"> | null = typeof localStorage !== "undefined" ? localStorage : null) {
    let raw: unknown = null;
    try {
      const t = this.storage?.getItem(KEY);
      raw = t ? JSON.parse(t) : null;
    } catch {
      raw = null;
    }
    this.s = clean(raw);
    this.refill();
  }

  get xp(): number {
    return this.s.xp;
  }
  get done(): number {
    return this.s.done;
  }
  get level(): { level: number; into: number; need: number } {
    return levelFor(this.s.xp);
  }
  /** the active challenges, each with its progress */
  get challenges(): Array<Challenge & { got: number }> {
    return this.s.active.map((a) => ({ ...CHALLENGES.find((c) => c.id === a.id)!, got: a.got }));
  }

  /** a finished match */
  award(kind: MatchKind, s: MatchSummary): Award {
    return this.apply(xpFor(kind, s), statsOf(kind, s));
  }

  /** a finished course run, with the rank it earned */
  awardRun(rank: string): Award {
    const medal = (cfg.xp.courseMedal as Record<string, number>)[rank] ?? 0;
    return this.apply(cfg.xp.courseRun + medal, { runs: 1 });
  }

  private apply(matchXp: number, add: Record<string, number>): Award {
    const levelBefore = this.level.level;
    let gained = matchXp;
    const completed: Challenge[] = [];
    for (const a of this.s.active) {
      const c = CHALLENGES.find((x) => x.id === a.id)!;
      a.got = Math.min(c.goal, a.got + (add[c.stat] ?? 0));
      if (a.got >= c.goal) completed.push(c);
    }
    for (const c of completed) {
      gained += c.xp;
      this.s.done++;
      this.s.active = this.s.active.filter((a) => a.id !== c.id);
    }
    this.s.xp += gained;
    this.refill();
    this.save();
    return { gained, match: matchXp, levelBefore, levelAfter: this.level.level, completed };
  }

  /** top the active list back up, rotating through the pool from where the finished ones were */
  private refill(): void {
    const want = Math.min(cfg.active, CHALLENGES.length);
    let cursor = this.s.done;
    let guard = 0;
    while (this.s.active.length < want && guard++ < CHALLENGES.length * 2) {
      const c = CHALLENGES[cursor % CHALLENGES.length];
      cursor++;
      if (!this.s.active.some((a) => a.id === c.id)) this.s.active.push({ id: c.id, got: 0 });
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.s));
    } catch {
      // storage off: progress counts for the session and is not kept
    }
    this.onChange?.();
  }
}
