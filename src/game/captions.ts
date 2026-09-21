// Captions for the sounds that matter (Settings: "Sound captions").
//
// A deaf player, or one with the volume off in a room with someone asleep in
// it, loses the half of this game that is listening: a door two rooms away, a
// reload behind a wall, a zipline over the roof. None of that is on the screen
// anywhere. So the sounds worth acting on are written down as they play, with
// which way they came from and roughly how far, in the same words a player
// would use: "DOOR, LEFT, NEAR".
//
// What this module is: the wording, the direction and the list. The sounds
// themselves are src/game/audio.ts, which calls `onCue` as it plays them, and
// the drawing is the HUD's. Keeping the three apart is what lets the checks
// ask the questions that matter (does a sound behind you say behind?) without
// a browser.
import capCfg from "../config/captions.json";

/** what a caption says: the sound, which way it came from, and how far */
export interface Caption {
  /** the sound's own name (audio.ts), for the checks and the icons */
  id: string;
  /** what the line says, e.g. "DOOR" */
  text: string;
  /** "AHEAD" | "LEFT" | "RIGHT" | "BEHIND", or "" for your own sounds */
  where: string;
  /** "CLOSE" | "NEAR" | "FAR", or "" for your own */
  range: string;
  /** when it was heard, and when the line goes */
  at: number;
  until: number;
}

/** the sounds worth writing down, and what a player would call each one */
export const CAPTION_WORDS: Readonly<Record<string, string>> = capCfg.words;

/** every sound the game can caption, in the order the checks read them */
export const CAPTION_IDS: readonly string[] = Object.keys(capCfg.words);

/**
 * Which way a sound came from, in a word. The angle is measured off where you
 * are facing, so "LEFT" means left of the screen and not west: a caption is
 * read while looking at something, and a compass bearing would have to be
 * translated by the person reading it.
 */
export function whereFrom(dx: number, dz: number, fx: number, fz: number): string {
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return "AHEAD";
  const ux = dx / len;
  const uz = dz / len;
  const flen = Math.hypot(fx, fz) || 1;
  const ax = fx / flen;
  const az = fz / flen;
  // the angle between where you look and where it came from, signed: the
  // cross product says which side, the dot says how far round
  const dot = ux * ax + uz * az;
  const cross = ax * uz - az * ux;
  const deg = (Math.atan2(cross, dot) * 180) / Math.PI;
  if (Math.abs(deg) <= capCfg.cone.ahead) return "AHEAD";
  if (Math.abs(deg) >= 180 - capCfg.cone.behind) return "BEHIND";
  return deg > 0 ? "RIGHT" : "LEFT";
}

/** how far off it was, in a word: the bands are what a player can act on, not metres */
export function howFar(dist: number): string {
  if (dist <= capCfg.range.close) return "CLOSE";
  if (dist <= capCfg.range.near) return "NEAR";
  return "FAR";
}

/**
 * The lines on screen. It keeps the last few, drops one that is said twice in
 * a row within `repeat` seconds (a run of footsteps is one line that stays up,
 * not eight that scroll), and forgets them after `life`.
 */
export class Captions {
  lines: Caption[] = [];
  /** off, the important ones only, or everything the game can caption */
  mode: "off" | "important" | "all" = "off";

  /** a sound played: written down when it is one this mode says */
  heard(id: string, now: number, where: string, range: string): void {
    if (this.mode === "off") return;
    const text = CAPTION_WORDS[id];
    if (!text) return;
    if (this.mode === "important" && !capCfg.important.includes(id)) return;
    const last = this.lines[this.lines.length - 1];
    if (last && last.id === id && last.where === where && now - last.at < capCfg.repeat) {
      // the same thing again from the same place: the line stays, its clock restarts
      last.at = now;
      last.until = now + capCfg.life;
      return;
    }
    this.lines.push({ id, text, where, range, at: now, until: now + capCfg.life });
    if (this.lines.length > capCfg.most) this.lines.shift();
  }

  /** the lines still worth showing, oldest first */
  live(now: number): Caption[] {
    this.lines = this.lines.filter((l) => l.until > now);
    return this.lines;
  }

  clear(): void {
    this.lines = [];
  }
}
