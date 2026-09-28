// The squad you can see (Phase 27): who is in your squad, each one's colour and
// number, what has become of each of them, and what to say when that changes.
// The owner, 2026-09-28: "We should be very aware that we are playing with a
// friend and should have all the indicators of that, like if a tm8 died or goes
// down or anything like that."
//
// Every screen in a squad has to agree on who is blue and who is 2 without a
// message for it, so the numbers come from what every screen already shares:
// the player ids the host handed out.
//
// Pure: no three.js and no DOM, so tools/checks/squadview.ts runs it in node.
import netCfg from "../config/net.json";
import squadCfg from "../config/squad.json";

/** a teammate as the squad panel shows them */
export type MateLife = "up" | "down" | "gulag" | "ghost" | "out" | "redeploy" | "quiet" | "left";

/**
 * The stage of a battle royale life a player says of themself (state.ts `lf`).
 * Up goes as nothing at all, so a build from before, which sends none, reads
 * as up, which is all it could ever say.
 */
export const LIFE_WIRE = { up: 0, gulag: 1, ghost: 2, out: 3, redeploy: 4 } as const;

export interface SquadColor {
  name: string;
  hex: string;
}

export const SQUAD_COLORS: readonly SquadColor[] = squadCfg.colors;

/** number 1 is the first colour; a squad of more than four goes round the list again */
export function slotColor(slot: number): SquadColor {
  const n = SQUAD_COLORS.length;
  return SQUAD_COLORS[(((slot - 1) % n) + n) % n];
}

/**
 * Each member's number, from 1, in player id order. The host gives the ids
 * and every screen hears the same ones, so every screen gives the same person
 * the same number and colour.
 */
export function squadSlots(ids: Iterable<number>): Map<number, number> {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  return new Map(sorted.map((id, i) => [id, i + 1]));
}

/** what this screen knows of a teammate, from their packets and the match */
export interface MateFacts {
  /** their own word on their life (state.ts lf); a build from before sends none */
  lf?: number;
  alive: boolean;
  /** down, not out (the legacy game's knockdowns) */
  downed: boolean;
  /** in the Gulag, as their "gulag" effect said (brmatch.ts hearGulag) */
  gulag: boolean;
  /** seconds since this screen last heard from them */
  quietFor: number;
  /** gone from the match: their goodbye, or their seat given up */
  gone: boolean;
}

/**
 * A teammate's state. Out is out whatever the connection is doing, but any
 * other state is only as good as the last word from them, so past `quiet`
 * seconds of silence the row says the connection is lost instead.
 */
export function mateLife(f: MateFacts, quiet = squadCfg.mates.quiet): MateLife {
  if (f.gone) return "left";
  const stage: MateLife =
    f.lf === LIFE_WIRE.gulag || f.gulag
      ? "gulag"
      : f.lf === LIFE_WIRE.ghost
        ? "ghost"
        : f.lf === LIFE_WIRE.redeploy
          ? "redeploy"
          : f.lf === LIFE_WIRE.out || !f.alive
            ? "out"
            : f.downed
              ? "down"
              : "up";
  if (stage !== "out" && f.quietFor > quiet) return "quiet";
  return stage;
}

/** the announcer's lines for the squad (announcer.json) */
export type MateCue = "mateBack" | "mateOut" | "mateLost";

/** what to tell you when a teammate's state changes: a line in the feed, one in the middle, and a word said */
export interface MateNews {
  feed: string;
  notice?: string;
  cue?: MateCue;
}

/**
 * The news of one change. A teammate going down, to the Gulag or to a ghost
 * says so here once; the announcer's "Teammate down!" is already said by the
 * death itself (main.ts onKnockSeen), so it is not said twice. The legacy
 * game's knockdowns and redeploys have their own notices and have none here.
 */
export function mateNews(name: string, was: MateLife, now: MateLife): MateNews | null {
  if (was === now) return null;
  const N = name.toUpperCase();
  if (now === "left") return { feed: `${name} left the match`, notice: `${N} LEFT THE MATCH`, cue: "mateOut" };
  if (now === "quiet") return { feed: `${name} lost the connection`, notice: `${N} LOST THE CONNECTION`, cue: "mateLost" };
  if (was === "quiet") return now === "out" ? { feed: `${name} is back, and out` } : { feed: `${name} is back` };
  if (now === "gulag") return { feed: `${name} went to the Gulag`, notice: `${N} IS IN THE GULAG: WIN IT TO DROP BACK IN` };
  if (now === "ghost")
    return was === "gulag"
      ? { feed: `${name} lost the Gulag`, notice: `${N} LOST THE GULAG: RESTORE THEM AT THEIR ECHO` }
      : { feed: `${name} is a ghost`, notice: `${N} IS DOWN: RESTORE THEM AT THEIR ECHO` };
  if (now === "out") return { feed: `${name} is out`, notice: was === "gulag" ? `${N} LOST THE GULAG AND IS OUT` : `${N} IS OUT OF THE MATCH`, cue: "mateOut" };
  if (now === "up" && was === "gulag") return { feed: `${name} won the Gulag`, notice: `${N} WON THE GULAG AND IS DROPPING BACK IN`, cue: "mateBack" };
  if (now === "up" && (was === "ghost" || was === "out")) return { feed: `${name} is back`, notice: `${N} IS BACK IN THE FIGHT`, cue: "mateBack" };
  return null;
}

/**
 * A remote player's health or shield as this screen should show it. Their own
 * packet lags a hit we just predicted by a round trip, so for `trust` seconds
 * after our last hit on them a packet may only lower the number; after that
 * their word is the truth, up as well as down. Taking only the lower number
 * forever (as duel.ts did) left a teammate, or an enemy, drawn at the lowest
 * they had ever been, though SpeedKills gives health and shield back.
 */
export function heardVital(predicted: number, said: number, sinceHit: number, trust = netCfg.hitTrust): number {
  return sinceHit < trust ? Math.min(predicted, said) : said;
}

/** a teammate's row on the squad panel (hud.ts drawSquadPanel) */
export interface SquadRow {
  id: number;
  slot: number;
  color: string;
  name: string;
  life: MateLife;
  health: number;
  healthMax: number;
  shield: number;
  shieldMax: number;
  /** health and shield a moment ago: the part since lost is drawn fading on each bar (the chip) */
  chipHealth: number;
  chipShield: number;
  /** how much of the chip is left, 1 to 0 */
  chipK: number;
  /** the row's flash after a hit, 1 to 0 */
  hurtK: number;
  /** metres from you, or null when there is nothing to measure */
  dist: number | null;
  talking: boolean;
}

/** a teammate as the panel is told of them this frame */
export interface MateNow {
  id: number;
  name: string;
  facts: MateFacts;
  health: number;
  healthMax: number;
  shield: number;
  shieldMax: number;
  dist: number | null;
  talking: boolean;
}

/**
 * One match's squad, frame by frame: the numbers (given out once, and kept by
 * anyone who leaves), each teammate's state and the news when it changes, and
 * a hit's flash and chip on their row.
 */
export class SquadWatch {
  private ids = new Set<number>();
  private slots = new Map<number, number>();
  private lives = new Map<number, MateLife>();
  private pools = new Map<number, { h: number; s: number; hurtAt: number; chipH: number; chipS: number; chipAt: number }>();
  private names = new Map<number, string>();

  /** the squad's ids, you among them: anyone new is numbered with the rest */
  members(ids: Iterable<number>): void {
    let grew = false;
    for (const id of ids)
      if (!this.ids.has(id)) {
        this.ids.add(id);
        grew = true;
      }
    if (grew) this.slots = squadSlots(this.ids);
  }

  /** a teammate heard from, by name: kept, so their row can still say they left once their figure is gone */
  hear(id: number, name: string): void {
    this.names.set(id, name);
  }

  heard(id: number): boolean {
    return this.names.has(id);
  }

  nameOf(id: number): string {
    return this.names.get(id) ?? `PLAYER ${id + 1}`;
  }

  slotOf(id: number): number | null {
    return this.slots.get(id) ?? null;
  }

  colorOf(id: number): string | null {
    const s = this.slots.get(id);
    return s === undefined ? null : slotColor(s).hex;
  }

  /** a squad of more than one: the only kind with anything to show */
  get squad(): boolean {
    return this.slots.size > 1;
  }

  /**
   * This frame's rows, in number order, and the news of whatever changed. A
   * teammate seen for the first time says nothing: joining a match is not
   * news, and a screen that opens on a teammate already out should not
   * announce it.
   */
  step(mates: MateNow[], now: number): { rows: SquadRow[]; news: Array<MateNews & { id: number }> } {
    const rows: SquadRow[] = [];
    const news: Array<MateNews & { id: number }> = [];
    for (const m of mates) {
      const slot = this.slots.get(m.id);
      if (slot === undefined) continue;
      const life = mateLife(m.facts);
      const was = this.lives.get(m.id);
      if (was !== undefined) {
        const n = mateNews(m.name, was, life);
        if (n) news.push({ ...n, id: m.id });
      }
      this.lives.set(m.id, life);
      const C = squadCfg.mates.chip;
      const p = this.pools.get(m.id) ?? { h: m.health, s: m.shield, hurtAt: -Infinity, chipH: m.health, chipS: m.shield, chipAt: -Infinity };
      // A drop starts the flash, and the chip holds each bar where it was before the first hit of a burst, so a spray
      // reads as one chunk draining rather than a flicker a bullet. A rise (a heal, the regeneration) takes it along.
      if (m.health + m.shield < p.h + p.s - 0.5 && life === "up") {
        if (now - p.chipAt > C) {
          p.chipH = p.h;
          p.chipS = p.s;
        }
        p.hurtAt = now;
        p.chipAt = now;
      }
      if (now - p.chipAt > C) {
        p.chipH = m.health;
        p.chipS = m.shield;
      }
      p.chipH = Math.max(p.chipH, m.health);
      p.chipS = Math.max(p.chipS, m.shield);
      p.h = m.health;
      p.s = m.shield;
      this.pools.set(m.id, p);
      const hurtK = Math.max(0, 1 - (now - p.hurtAt) / squadCfg.mates.hurt);
      const chipK = Math.max(0, 1 - (now - p.chipAt) / C);
      rows.push({ id: m.id, slot, color: slotColor(slot).hex, name: m.name, life, health: m.health, healthMax: m.healthMax, shield: m.shield, shieldMax: m.shieldMax, chipHealth: p.chipH, chipShield: p.chipS, chipK, hurtK, dist: m.dist, talking: m.talking });
    }
    rows.sort((a, b) => a.slot - b.slot);
    return { rows, news };
  }
}
