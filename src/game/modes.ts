// The arena's modes, the rules alone (src/config/modes.json): the scoreboard,
// team deathmatch's score, free-for-all's leader, Control's zones, and where
// to respawn. No figures and no network here, so tools/verify.ts tests them in
// Node; the match that plays them is modematch.ts.
//
//   Team deathmatch: a kill scores for the killer's team; first to the limit,
//   or the higher score at the time limit.
//   Free-for-all: everyone for themselves; first to the limit, or the most
//   kills at the time limit.
//   Control: see its section below.
//
// Gun Run, Crown and Search were the legacy game's, and went with it (the
// owner, 2026-10-04: "remove all legacy stuff").
import cfg from "../config/modes.json";

export type ModeKind = "tdm" | "control" | "ffa";
export const MODE_KINDS: ModeKind[] = ["tdm", "control", "ffa"];
export const MODES = cfg;
export const MODE_TITLE: Record<ModeKind, string> = { tdm: "TEAM DEATHMATCH", control: "CONTROL", ffa: "FREE FOR ALL" };

export function isModeKind(x: unknown): x is ModeKind {
  return x === "tdm" || x === "control" || x === "ffa";
}

/** the team modes (sides, team scores): team deathmatch and Control */
export const teamMode = (k: ModeKind): boolean => k === "tdm" || k === "control";

export interface ScoreRow {
  id: number;
  kills: number;
  deaths: number;
}

/** every player's kills and deaths in a match */
export class Scoreboard {
  private rows = new Map<number, ScoreRow>();

  row(id: number): ScoreRow {
    let r = this.rows.get(id);
    if (!r) this.rows.set(id, (r = { id, kills: 0, deaths: 0 }));
    return r;
  }

  /** `victim` went down to `killer` (-1, or the victim themself: nobody) */
  kill(killer: number, victim: number): void {
    this.row(victim).deaths++;
    if (killer < 0 || killer === victim) return;
    this.row(killer).kills++;
  }

  /** the most kills first, then the fewest deaths */
  get sorted(): ScoreRow[] {
    return [...this.rows.values()].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || a.id - b.id);
  }

  /** a player who left: off the board */
  remove(id: number): void {
    this.rows.delete(id);
  }

  /** from the host's state packet */
  set(rows: ScoreRow[]): void {
    this.rows.clear();
    for (const r of rows) this.rows.set(r.id, { ...r });
  }

  clear(): void {
    this.rows.clear();
  }
}


/** team deathmatch: team 0 and team 1 */
export class TeamScore {
  score: [number, number] = [0, 0];
  constructor(readonly limit = cfg.tdm.scoreLimit) {}

  /** a kill for `team`; the winning team once it reaches the limit, else null */
  kill(team: 0 | 1): 0 | 1 | null {
    this.score[team]++;
    return this.score[team] >= this.limit ? team : null;
  }

  /** at the time limit: the higher score, or null for a draw */
  get ahead(): 0 | 1 | null {
    return this.score[0] > this.score[1] ? 0 : this.score[1] > this.score[0] ? 1 : null;
  }

  clear(): void {
    this.score = [0, 0];
  }
}

/**
 * Free-for-all: whoever has the most kills, the fewest deaths on a tie, or
 * null when the top two are level on both (a draw at the clock).
 */
export function killLeader(rows: Array<{ id: number; kills: number; deaths: number }>): number | null {
  if (!rows.length) return null;
  const s = [...rows].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || a.id - b.id);
  const [a, b] = s;
  if (b && a.kills === b.kills && a.deaths === b.deaths) return null;
  return a.id;
}

/**
 * Where to come back: of the candidates, the one farthest from the nearest
 * enemy still up (all candidates are as good when nobody is: the first).
 */
export function pickSpawn(cands: Array<[number, number]>, enemies: Array<{ x: number; z: number }>): [number, number] {
  let best = cands[0];
  let bd = -Infinity;
  for (const c of cands) {
    let near = Infinity;
    for (const e of enemies) near = Math.min(near, Math.hypot(e.x - c[0], e.z - c[1]));
    if (near > bd) {
      bd = near;
      best = c;
    }
  }
  return best;
}

/** the yaw that faces the arena's middle from (x, z) in arena coordinates (look = (-sin yaw, -cos yaw)) */
export function yawToMiddle(x: number, z: number): number {
  return (Math.atan2(x, z) * 180) / Math.PI;
}

// ------------------------------------------------------------------ Control
//
// Three zones, A B C, from team 0's end to team 1's. Each zone is a number
// from -1 (team 0 holds it) to +1 (team 1 holds it), 0 neutral: the players of
// one team on it move it toward their end, at the capture rate for how many of
// them there are; both teams on it, it holds. A zone changes hands only at the
// ends, and goes neutral when pushed back through 0, so taking an enemy's
// zone is clearing it first, then capturing it (Apex's rule).

export type ControlOwner = -1 | 0 | 1;
export interface ControlZone {
  id: string;
  x: number;
  z: number;
  v: number;
  owner: ControlOwner;
}

export class Control {
  zones: ControlZone[];
  score: [number, number] = [0, 0];
  /** the bonus event: which zone, when it ends (the owner then takes the points) */
  bonus: { zone: number; endsAt: number } | null = null;
  private nextBonusAt: number;
  /** one team holding all three: who, and when it wins if nobody retakes one */
  lockout: { team: 0 | 1; endsAt: number } | null = null;

  constructor(
    fightStart: number,
    private readonly rng: () => number = Math.random,
    /** the three points in the arena's own coordinates; the warehouse's, from modes.json, when none are given */
    zones: ReadonlyArray<readonly [string, number, number]> = cfg.control.zones.map(([id, x, z]) => [String(id), Number(x), Number(z)] as const)
  ) {
    this.zones = zones.map(([id, x, z]) => ({ id, x, z, v: 0, owner: -1 as ControlOwner }));
    this.nextBonusAt = fightStart + cfg.control.bonus.firstAt;
  }

  /** the next bonus event's time (host migration: the heir's snapshot carries it) */
  get nextBonus(): number {
    return this.nextBonusAt;
  }

  /** as a guest last saw it (host migration): the zones, the scores, the bonus and the lockout; `nextBonusAt` from the snapshot */
  restore(v: { v: number[]; owner: number[]; score: [number, number]; bonus: number; bonusLeft: number; lockTeam: number; lockLeft: number }, now: number, nextBonusAt: number): void {
    this.zones.forEach((z, i) => {
      z.v = v.v[i] ?? 0;
      const o = v.owner[i];
      z.owner = o === 0 || o === 1 ? o : -1;
    });
    this.score = [v.score[0], v.score[1]];
    this.bonus = v.bonus >= 0 && v.bonus < this.zones.length ? { zone: v.bonus, endsAt: now + v.bonusLeft } : null;
    this.lockout = v.lockTeam === 0 || v.lockTeam === 1 ? { team: v.lockTeam, endsAt: now + v.lockLeft } : null;
    this.nextBonusAt = nextBonusAt;
  }

  /** the capture rate for n players on a zone, per second (a full capture from neutral is 1) */
  static rate(n: number): number {
    if (n <= 0) return 0;
    const m = cfg.control.captureMult;
    return m[Math.min(n, m.length) - 1] / cfg.control.captureTime;
  }

  /** how many of each team's fighters (up) stand on each zone */
  counts(fighters: Array<{ x: number; z: number; team: 0 | 1; alive: boolean }>): Array<[number, number]> {
    return this.zones.map((zn) => {
      const c: [number, number] = [0, 0];
      for (const f of fighters) if (f.alive && Math.hypot(f.x - zn.x, f.z - zn.z) <= cfg.control.radius) c[f.team]++;
      return c;
    });
  }

  /**
   * One step (fighters in arena coordinates): the zones move, the points
   * come in, the bonus and the lockout run. Returns the winning team once
   * decided (a score at the limit, or a lockout run out), and what happened.
   */
  update(now: number, dt: number, fighters: Array<{ x: number; z: number; team: 0 | 1; alive: boolean }>): { winner: 0 | 1 | null; events: string[] } {
    const events: string[] = [];
    const counts = this.counts(fighters);
    this.zones.forEach((zn, i) => {
      const [a, b] = counts[i];
      if (a > 0 && b > 0) return; // contested: it holds
      const team: 0 | 1 | null = a > 0 ? 0 : b > 0 ? 1 : null;
      if (team === null) return;
      const dir = team === 0 ? -1 : 1;
      zn.v = Math.max(-1, Math.min(1, zn.v + dir * Control.rate(team === 0 ? a : b) * dt));
      // pushed back to or through 0 (the other side's hold cleared): neutral; to the end: theirs
      if (zn.owner !== -1 && zn.owner !== team && zn.v * dir >= 0) {
        zn.owner = -1;
        events.push("neutral " + zn.id);
      }
      if (zn.v * dir >= 1 - 1e-9 && zn.owner !== team) {
        zn.owner = team;
        events.push("taken " + zn.id + " " + team);
      }
    });
    // the points: 1 a second per zone held
    for (const zn of this.zones) if (zn.owner !== -1) this.score[zn.owner] += dt;
    // the bonus: a zone marked for a while; whoever holds it at the end takes the points
    const B = cfg.control.bonus;
    if (!this.bonus && now >= this.nextBonusAt) {
      this.bonus = { zone: Math.floor(this.rng() * this.zones.length), endsAt: now + B.lasts };
      this.nextBonusAt = now + B.every;
      events.push("bonus");
    }
    if (this.bonus && now >= this.bonus.endsAt) {
      const o = this.zones[this.bonus.zone].owner;
      if (o !== -1) {
        this.score[o] += B.points;
        events.push("bonus " + o);
      }
      this.bonus = null;
    }
    // the lockout: all three held by one team; broken when the other retakes one
    const L = cfg.control.lockout;
    const all: 0 | 1 | null = this.zones.every((zn) => zn.owner === 0) ? 0 : this.zones.every((zn) => zn.owner === 1) ? 1 : null;
    if (this.lockout && all !== this.lockout.team) {
      this.lockout = null;
      events.push("lockout broken");
    }
    const late = Math.max(...this.score) >= cfg.control.scoreLimit - L.notWithin;
    if (!this.lockout && all !== null && !late) {
      this.lockout = { team: all, endsAt: now + L.time };
      events.push("lockout " + all);
    }
    if (this.lockout && now >= this.lockout.endsAt) return { winner: this.lockout.team, events };
    const limit = cfg.control.scoreLimit;
    if (this.score[0] >= limit || this.score[1] >= limit) return { winner: this.score[0] >= this.score[1] ? 0 : 1, events };
    return { winner: null, events };
  }

  /**
   * Where a team can come back in: the zones it holds in an unbroken line
   * from its base, but not the last one before the enemy's base (Apex: a
   * spawn zone is linked to your base and a zone away from theirs). The most
   * forward of them, or null for the base.
   */
  spawnZone(team: 0 | 1): ControlZone | null {
    return controlSpawnZone(this.zones, team);
  }

  /** the ahead team at the time limit, or null for a draw (below, the spawn rule on its own, for a guest's view) */
  get ahead(): 0 | 1 | null {
    const a = Math.floor(this.score[0]);
    const b = Math.floor(this.score[1]);
    return a > b ? 0 : b > a ? 1 : null;
  }
}

/** Control's spawn rule on any zones (the host's, or a guest's view of them): see Control.spawnZone */
export function controlSpawnZone<Z extends { owner: number }>(zones: Z[], team: 0 | 1): Z | null {
  const chain = team === 0 ? zones : [...zones].reverse();
  let best: Z | null = null;
  for (let i = 0; i < chain.length - 1; i++) {
    if (chain[i].owner !== team) break;
    best = chain[i];
  }
  return best;
}
