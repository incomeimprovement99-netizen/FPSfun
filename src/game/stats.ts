// Your profile and stats, kept in this browser: a name, every match (1v1,
// 1v1v1, bots by difficulty), every course's best and its top ten runs, and
// the tech you landed and missed. The Stats tab reads it; the leaderboard
// client (leaderboard.ts) posts from it when a server is configured.
//
// Everything here is per browser. Another device starts fresh: cross-device
// saves need accounts, which need a server (docs/NEXT_STEPS.md).

export interface MatchStats {
  played: number;
  won: number;
  lost: number;
  roundsWon: number;
  roundsLost: number;
  kills: number;
  deaths: number;
  damage: number;
  shots: number;
  hits: number;
  /** current and best win streaks */
  streak: number;
  bestStreak: number;
}

export interface RunEntry {
  time: number;
  rank: string;
  /** ISO date */
  at: string;
}

export interface CourseStats {
  runs: number;
  best: number | null;
  /** the top ten runs, fastest first */
  board: RunEntry[];
}

/** a bot's tier (src/config/bots.json), or "mixed": each bot a tier drawn by weight */
export type BotDifficulty = "easy" | "normal" | "hard" | "elite" | "mixed";
export function asDifficulty(x: unknown): BotDifficulty {
  return x === "easy" || x === "hard" || x === "elite" || x === "mixed" ? x : "normal";
}
export type MatchKind = "duel" | "triple" | `bots:${BotDifficulty}` | "br" | "gunrun" | "tdm" | "crown" | "control";

export interface Profile {
  name: string;
  matches: Partial<Record<MatchKind, MatchStats>>;
  courses: Record<string, CourseStats>;
  /** tech landed, by feed name */
  tech: Record<string, number>;
  /** tech missed (the feed's orange lines), by feed name */
  techMiss: Record<string, number>;
  /** first seen, ISO */
  since: string;
}

export interface MatchSummary {
  won: boolean;
  roundsWon: number;
  roundsLost: number;
  kills: number;
  deaths: number;
  damage: number;
  shots: number;
  hits: number;
  /** a battle royale: where you finished, out of how many, and how long you lasted */
  placement?: number;
  players?: number;
  survived?: number;
}

const KEY = "range.profile.v1";
const BOARD_SIZE = 10;

const emptyMatch = (): MatchStats => ({ played: 0, won: 0, lost: 0, roundsWon: 0, roundsLost: 0, kills: 0, deaths: 0, damage: 0, shots: 0, hits: 0, streak: 0, bestStreak: 0 });

/** a short random handle, so a new profile is never blank on a board */
function randomName(): string {
  const a = ["SWIFT", "STEEL", "NEON", "ASH", "RAPID", "VOLT", "GRIM", "SOLAR", "NOVA", "FLUX"];
  const b = ["GLIDER", "BOUNCER", "STRAFER", "RUNNER", "SLIDER", "HOPPER", "LURCHER", "CLIMBER"];
  return `${a[Math.floor(Math.random() * a.length)]}${b[Math.floor(Math.random() * b.length)]}${Math.floor(Math.random() * 90 + 10)}`;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);

/** a player name as the online board accepts it: letters, digits, space, _ . -, at most 16 */
const cleanName = (s: string): string => s.replace(/[^A-Za-z0-9_ .-]/g, "").trim().slice(0, 16);

function validMatch(m: unknown): MatchStats {
  const out = emptyMatch();
  if (m && typeof m === "object") {
    const o = m as Record<string, unknown>;
    for (const k of Object.keys(out) as Array<keyof MatchStats>) out[k] = Math.floor(num(o[k]));
    out.damage = num(o.damage);
  }
  return out;
}

export class Stats {
  profile: Profile;
  /** something changed (the menu re-renders on it) */
  onChange: (() => void) | null = null;

  constructor() {
    this.profile = this.load();
  }

  private load(): Profile {
    const fresh: Profile = { name: randomName(), matches: {}, courses: {}, tech: {}, techMiss: {}, since: new Date().toISOString() };
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        this.persist(fresh);
        return fresh;
      }
      const p = JSON.parse(raw) as Partial<Profile>;
      const out: Profile = {
        name: (typeof p.name === "string" && cleanName(p.name)) || fresh.name,
        matches: {},
        courses: {},
        tech: {},
        techMiss: {},
        since: typeof p.since === "string" ? p.since : fresh.since,
      };
      if (p.matches && typeof p.matches === "object") {
        for (const [k, v] of Object.entries(p.matches)) out.matches[k as MatchKind] = validMatch(v);
      }
      if (p.courses && typeof p.courses === "object") {
        for (const [id, c] of Object.entries(p.courses as Record<string, Partial<CourseStats> | null>)) {
          // one bad entry is skipped: throwing here fell to the catch below,
          // which handed back a fresh profile that the next save wrote over the real one
          if (!c || typeof c !== "object") continue;
          const board = Array.isArray(c.board)
            ? c.board
                .filter((e): e is RunEntry => !!e && typeof e.time === "number" && Number.isFinite(e.time) && typeof e.rank === "string" && typeof e.at === "string")
                .sort((a, b) => a.time - b.time)
                .slice(0, BOARD_SIZE)
            : [];
          out.courses[id] = { runs: Math.floor(num(c.runs)), best: typeof c.best === "number" && Number.isFinite(c.best) ? c.best : (board[0]?.time ?? null), board };
        }
      }
      for (const key of ["tech", "techMiss"] as const) {
        const src = p[key];
        if (src && typeof src === "object") for (const [k, v] of Object.entries(src)) out[key][k] = Math.floor(num(v));
      }
      return out;
    } catch {
      return fresh;
    }
  }

  private persist(p = this.profile): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
    this.onChange?.();
  }

  /**
   * Letters, digits, space and _ . - only: the characters the online board
   * accepts. Anything else was taken here and then refused by the board on
   * every post, with nothing to say so. The field shows what was kept.
   */
  setName(name: string): void {
    const n = cleanName(name);
    if (!n) return;
    this.profile.name = n;
    this.persist();
  }

  match(kind: MatchKind): MatchStats {
    return (this.profile.matches[kind] ??= emptyMatch());
  }

  course(id: string): CourseStats {
    return (this.profile.courses[id] ??= { runs: 0, best: null, board: [] });
  }

  /** a finished course run */
  recordRun(courseId: string, time: number, rank: string): void {
    const c = this.course(courseId);
    c.runs++;
    if (c.best === null || time < c.best) c.best = time;
    c.board.push({ time, rank, at: new Date().toISOString() });
    c.board.sort((a, b) => a.time - b.time);
    c.board.length = Math.min(c.board.length, BOARD_SIZE);
    this.persist();
  }

  /** a finished match of any kind */
  recordMatch(kind: MatchKind, s: MatchSummary): void {
    const m = this.match(kind);
    m.played++;
    if (s.won) {
      m.won++;
      m.streak++;
      m.bestStreak = Math.max(m.bestStreak, m.streak);
    } else {
      m.lost++;
      m.streak = 0;
    }
    m.roundsWon += s.roundsWon;
    m.roundsLost += s.roundsLost;
    m.kills += s.kills;
    m.deaths += s.deaths;
    m.damage += s.damage;
    m.shots += s.shots;
    m.hits += s.hits;
    this.persist();
  }

  /** a line from the tech feed */
  recordTech(name: string, good: boolean): void {
    const bag = good ? this.profile.tech : this.profile.techMiss;
    bag[name] = (bag[name] ?? 0) + 1;
    // not persisted on every line: the feed can fire many times a second
    this.dirty = true;
  }
  private dirty = false;
  /** call now and then (the menu opening, a run ending) to write buffered tech counts */
  flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.persist();
  }

  /** K/D as the game shows it: kills per death, deaths of zero read as the kills */
  static kd(m: MatchStats): string {
    return m.deaths === 0 ? m.kills.toFixed(2) : (m.kills / m.deaths).toFixed(2);
  }
  static accuracy(m: MatchStats): string {
    return m.shots === 0 ? "-" : `${Math.round((100 * m.hits) / m.shots)}%`;
  }
}
