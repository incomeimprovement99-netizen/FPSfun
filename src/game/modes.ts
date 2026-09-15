// The arena's modes, the rules alone (src/config/modes.json): Gun Run's
// ladder, team deathmatch's score, the crown, and where to respawn. No
// figures and no network here, so tools/verify.ts tests them in Node; the
// match that plays them is modematch.ts.
//
//   Gun Run: every kill moves the killer to the next gun on the list; after
//   the last gun comes the knife (your fists, the throwing knife's damage),
//   and a kill with it wins. A melee death costs a level. At the time limit
//   the highest level wins, then the most kills.
//   Team deathmatch: a kill scores for the killer's team; first to the limit,
//   or the higher score at the time limit.
//   Crown: 20 s into a round the crown appears in the middle; walk over it to
//   take it; the carrier is shown to everyone; held for 30 s without going
//   down, it takes the round. A carrier who goes down drops it where they fell.
import cfg from "../config/modes.json";

export type ModeKind = "gunrun" | "tdm" | "crown";
export const MODE_KINDS: ModeKind[] = ["gunrun", "tdm", "crown"];
export const MODES = cfg;
export const MODE_TITLE: Record<ModeKind, string> = { gunrun: "GUN RUN", tdm: "TEAM DEATHMATCH", crown: "CROWN" };

export function isModeKind(x: unknown): x is ModeKind {
  return x === "gunrun" || x === "tdm" || x === "crown";
}

/** Gun Run's guns in order, the short list or every gun; the knife follows the last */
export function gunList(which: "short" | "full"): string[] {
  return which === "full" ? cfg.gunRun.full.slice() : cfg.gunRun.short.slice();
}

export interface LadderRow {
  id: number;
  level: number;
  kills: number;
  deaths: number;
}

/** Gun Run's ladder: a level per player (0 is the first gun; guns.length is the knife) */
export class GunLadder {
  private rows = new Map<number, LadderRow>();
  constructor(readonly guns: string[]) {}

  row(id: number): LadderRow {
    let r = this.rows.get(id);
    if (!r) this.rows.set(id, (r = { id, level: 0, kills: 0, deaths: 0 }));
    return r;
  }

  level(id: number): number {
    return this.row(id).level;
  }

  /** the gun at this player's level, or null for the knife */
  gunFor(id: number): string | null {
    const l = this.level(id);
    return l < this.guns.length ? this.guns[l] : null;
  }

  /** the knife is the last level */
  get knifeLevel(): number {
    return this.guns.length;
  }

  /**
   * `victim` went down to `killer` (-1, or the victim themself: nobody).
   * Returns whether that kill won it: a kill made with the knife.
   */
  kill(killer: number, victim: number, melee: boolean): boolean {
    const v = this.row(victim);
    v.deaths++;
    if (melee) v.level = Math.max(0, v.level - cfg.gunRun.meleeDemotes);
    if (killer < 0 || killer === victim) return false;
    const k = this.row(killer);
    k.kills++;
    // the knife level: a knife kill wins it; any other kill (a grenade) counts, but wins nothing
    if (k.level >= this.guns.length) return melee;
    k.level++;
    return false;
  }

  /** the leader: the highest level, then the most kills, then the fewest deaths */
  get leader(): LadderRow | null {
    return this.sorted[0] ?? null;
  }

  get sorted(): LadderRow[] {
    return [...this.rows.values()].sort((a, b) => b.level - a.level || b.kills - a.kills || a.deaths - b.deaths || a.id - b.id);
  }

  /** a player who left: off the ladder (they cannot win on time) */
  remove(id: number): void {
    this.rows.delete(id);
  }

  /** from the host's state packet */
  set(rows: LadderRow[]): void {
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

export interface CrownFighter {
  id: number;
  x: number;
  z: number;
  alive: boolean;
}

export type CrownPhase = "waiting" | "ground" | "carried";

/** the crown in one round: where it is, who has it, how long they have held it */
export class Crown {
  phase: CrownPhase = "waiting";
  x = 0;
  z = 0;
  carrier = -1;
  /** the carrier's unbroken hold, s */
  held = 0;
  private appearsAt: number;

  constructor(
    private readonly cx: number,
    private readonly cz: number,
    fightStart: number
  ) {
    this.x = cx;
    this.z = cz;
    this.appearsAt = fightStart + cfg.crown.appearsAfter;
  }

  get appearsIn(): number {
    return this.appearsAt;
  }

  /**
   * One step: it appears on time, the nearest fighter up within reach takes
   * it, the carrier's hold counts up while they stay up. Returns the round's
   * winner when the hold is complete, and what happened for the feed.
   */
  update(now: number, dt: number, fighters: CrownFighter[]): { winner: number | null; event: "appears" | "taken" | null } {
    if (this.phase === "waiting") {
      if (now < this.appearsAt) return { winner: null, event: null };
      this.phase = "ground";
      this.x = this.cx;
      this.z = this.cz;
      return { winner: null, event: "appears" };
    }
    if (this.phase === "ground") {
      let best: CrownFighter | null = null;
      let bd = Infinity;
      for (const f of fighters) {
        if (!f.alive) continue;
        const d = Math.hypot(f.x - this.x, f.z - this.z);
        if (d <= cfg.crown.pickup && d < bd) {
          bd = d;
          best = f;
        }
      }
      if (!best) return { winner: null, event: null };
      this.phase = "carried";
      this.carrier = best.id;
      this.held = 0;
      this.x = best.x;
      this.z = best.z;
      return { winner: null, event: "taken" };
    }
    const c = fighters.find((f) => f.id === this.carrier);
    if (!c || !c.alive) {
      this.drop(this.x, this.z);
      return { winner: null, event: null };
    }
    this.x = c.x;
    this.z = c.z;
    this.held += dt;
    return { winner: this.held >= cfg.crown.hold ? this.carrier : null, event: null };
  }

  /** the carrier went down (or left): the crown lies where they were, and the hold starts over */
  drop(x: number, z: number): void {
    if (this.phase !== "carried") return;
    this.phase = "ground";
    this.x = x;
    this.z = z;
    this.carrier = -1;
    this.held = 0;
  }
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
