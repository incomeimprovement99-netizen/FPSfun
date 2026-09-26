// The Gulag: your first death in a battle royale is a 1v1 for your way back.
//
// Out early, you used to be out: a banner in a box and a squad mate's walk to
// a beacon, or nothing at all alone. Now a first death before the late rings
// sends you to a small room (the Vault, one of the arenas) against a bot, the
// two of you on the same two guns, drawn for the fight. Win and you drop back
// into the match with those guns; lose and you are out for good. A fight that
// runs its clock goes to overtime, a flag in the middle of the room: stand on
// it alone long enough and it is yours. One trip a match.
//
// The room is local to each player: nobody else sees your fight, and the bot
// is yours, not the host's. The host is told you are in the Gulag, so your
// squad is not out while you are and the match's bots do not hunt you there.
//
// This file is the Gulag's clock and rules, kept apart from the match so the
// checks can run them; brmatch.ts runs the room and the bot, main.ts puts you
// in it. The numbers are in src/config/br.json `gulag`.
import { IS_SK, PROFILE } from "./game";
import brCfg from "../config/br.json";

export const GULAG = brCfg.gulag;

export type GulagPhase = "wait" | "countdown" | "fight" | "overtime" | "won" | "lost";

/** what a tick did: nothing, or the moment a phase began */
export type GulagEvent = "enter" | "fight" | "overtime" | "won" | "lost" | null;

export class Gulag {
  phase: GulagPhase = "wait";
  /** the two guns both fighters get */
  readonly guns: [string, string];
  /** when you go in (after the moment of your death), when the fight starts, when overtime does */
  readonly enterAt: number;
  fightAt: number;
  overtimeAt: number;
  /** seconds alone on the flag, yours and theirs */
  capMe = 0;
  capThem = 0;
  /** when it was decided (won or lost) */
  decidedAt = Infinity;

  constructor(now: number, rng: () => number = Math.random) {
    const pool = IS_SK && PROFILE.lists ? PROFILE.lists.gulagGuns : GULAG.guns;
    const a = Math.floor(rng() * pool.length);
    let b = Math.floor(rng() * (pool.length - 1));
    if (b >= a) b++;
    this.guns = [pool[a], pool[b]];
    this.enterAt = now + GULAG.delay;
    this.fightAt = this.enterAt + GULAG.countdown;
    this.overtimeAt = this.fightAt + GULAG.fight;
  }

  /** the fight is on: guns work (the countdown's are held) */
  get live(): boolean {
    return this.phase === "fight" || this.phase === "overtime";
  }

  /** seconds left in the phase the clock is counting: to the entry, the fight, overtime (none: 0) */
  clock(now: number): number {
    if (this.phase === "wait") return Math.max(0, this.enterAt - now);
    if (this.phase === "countdown") return Math.max(0, this.fightAt - now);
    if (this.phase === "fight") return Math.max(0, this.overtimeAt - now);
    return 0;
  }

  /**
   * Time passes. `meOn` and `themOn`: each fighter is on the flag (overtime
   * only). A fighter alone on it gains, both on it is a stand-off, and the
   * first to GULAG.capture seconds wins. The deaths come from outside (won()
   * and lost()).
   */
  tick(now: number, dt: number, meOn: boolean, themOn: boolean): GulagEvent {
    if (this.phase === "wait" && now >= this.enterAt) {
      this.phase = "countdown";
      return "enter";
    }
    if (this.phase === "countdown" && now >= this.fightAt) {
      this.phase = "fight";
      return "fight";
    }
    if (this.phase === "fight" && now >= this.overtimeAt) {
      this.phase = "overtime";
      return "overtime";
    }
    if (this.phase === "overtime") {
      if (meOn && !themOn) this.capMe += dt;
      if (themOn && !meOn) this.capThem += dt;
      if (this.capMe >= GULAG.capture) return this.won(now);
      if (this.capThem >= GULAG.capture) return this.lost(now);
    }
    return null;
  }

  /** the other fighter is down, or you took the flag */
  won(now: number): GulagEvent {
    if (this.phase === "won" || this.phase === "lost") return null;
    this.phase = "won";
    this.decidedAt = now;
    return "won";
  }

  /** you are down, or they took the flag */
  lost(now: number): GulagEvent {
    if (this.phase === "won" || this.phase === "lost") return null;
    this.phase = "lost";
    this.decidedAt = now;
    return "lost";
  }
}

/** a first death goes to the Gulag: the rules have it, it is still early, and this player has not been */
export function gulagFor(rules: string, ringPhase: number, used: boolean): boolean {
  return GULAG.enabled && rules === "br" && !used && ringPhase < GULAG.untilPhase;
}
