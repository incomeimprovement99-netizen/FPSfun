// Resurgence: a battle royale where the dead come back.
//
// A bad landing cost the whole match, with nothing to do afterwards but
// watch. Warzone's Resurgence is the answer for a group of friends: while it
// is on, the dead redeploy from the sky after a wait, and the wait grows as
// the ring closes. Your side's knocks and kills cut the wait of everyone of
// yours who is dead, so the way back is to fight. Two things end it. A side
// whose every member is down or dead at the same moment is out for good,
// because there is nobody left to come back to; and from a set round of the
// ring every death is final, so the end game is a battle royale again. A
// wait already running when that round comes still finishes: dying a second
// before the cut does not cost the match.
//
// This is the rules' arithmetic, pure so the checks can run it. brmatch.ts
// runs it for the bots and main.ts for you; the numbers are in
// src/config/br.json `resurgence`.
import brCfg from "../config/br.json";
import type { RingPhase } from "./ring";

export const RESURGENCE = brCfg.resurgence;

export type BrRules = "br" | "resurgence";
export const BR_RULES: readonly BrRules[] = ["br", "resurgence"];
/** what the lobby row and the welcome carry, read safely (an older host sends none: the battle royale) */
export const asRules = (v: unknown): BrRules => (v === "resurgence" ? "resurgence" : "br");

/** deaths still come back in this round of the ring (0-based) */
export function resurgenceLive(phase: number): boolean {
  return phase < RESURGENCE.endPhase;
}

/** the wait for a death in this round, seconds */
export function redeployWait(phase: number): number {
  const w = RESURGENCE.redeploy;
  return w[Math.min(Math.max(0, Math.floor(phase)), w.length - 1)];
}

/**
 * A death is one you come back from: the rules are on, and your side has
 * somebody up to come back to. A side of one always has itself.
 */
export function comesBack(phase: number, sideSize: number, sideUp: number): boolean {
  return resurgenceLive(phase) && (sideSize <= 1 || sideUp > 0);
}

/** one dead player's (or bot's) way back */
export class Redeploy {
  /** seconds to wait */
  left: number;
  constructor(
    readonly id: number,
    wait: number
  ) {
    this.left = Math.max(0, wait);
  }

  /** time passes; true once the wait is over */
  tick(dt: number): boolean {
    this.left = Math.max(0, this.left - Math.max(0, dt));
    return this.left === 0;
  }

  /** a knock or a kill by your side */
  cut(kind: "knock" | "kill"): number {
    const s = kind === "kill" ? RESURGENCE.killCut : RESURGENCE.knockCut;
    const before = this.left;
    this.left = Math.max(RESURGENCE.floor, this.left - s);
    // a cut never lengthens a wait already under the floor
    if (this.left > before) this.left = before;
    return before - this.left;
  }
}

/** the ring's rounds for Resurgence: the same circles and damage, the waits and closes shortened */
export function resurgencePhases(phases: readonly RingPhase[]): RingPhase[] {
  return phases.map((p) => ({ ...p, wait: p.wait * RESURGENCE.ringScale, close: p.close * RESURGENCE.ringScale }));
}

/** seconds until deaths are final: what is left of the live round, then every round before the cut */
export function secondsToFinal(phases: readonly RingPhase[], phase: number, closing: boolean, timeLeft: number): number {
  if (!resurgenceLive(phase)) return 0;
  // the cut comes when round endPhase begins: the end of round endPhase - 1's close
  let t = Math.max(0, timeLeft) + (closing ? 0 : phases[phase].close);
  for (let p = phase + 1; p < RESURGENCE.endPhase; p++) t += phases[p].wait + phases[p].close;
  return t;
}
