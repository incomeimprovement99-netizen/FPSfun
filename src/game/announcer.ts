// Voice callouts and the announcer (docs/AAA_GAP.md step 7). Apex's legends
// say "enemy knocked" and "I'm down", Warzone has a voice for every phase of
// the ring, and until this the game said all of it in captions and effects.
//
// The words are spoken by the browser's own speech synthesis. Free recorded
// voice lines are scarce and rarely match each other; a set system voice
// reading short lines is consistent, costs nothing to download, and an
// announcer is a voice reading short lines. Two voices: yours (what your
// character says) and the match's.
//
// `cues` is the part that decides, and it is pure: it looks at the match's
// HUD this frame against last frame's and says which lines that change calls
// for. The rest are said where they happen (a knock, a finish, a ping).
import cfg from "../config/announcer.json";

export type Line = keyof typeof cfg.lines;
type Who = keyof typeof cfg.voices;

/** what the announcer watches from frame to frame (a battle royale's HUD, trimmed) */
export interface Watch {
  /** on the ship or in the air: the drop */
  dropping: boolean;
  ringPhase: number;
  ringPhases: number;
  closing: boolean;
  outside: boolean;
  /** squads still up, and how many to a squad (1 is solo) */
  squads: number;
  team: number;
  /** where you finished, once you have (1 is the win) */
  placement: number | null;
}

/**
 * The lines a change from `prev` to `next` calls for, in the order they
 * happened. The first frame of a match (`prev` null) says only the drop:
 * everything else is how things start, not news.
 */
export function cues(prev: Watch | null, next: Watch): Line[] {
  const out: Line[] = [];
  if (!prev) return next.dropping ? ["drop"] : [];
  if (next.dropping && !prev.dropping) out.push("drop");
  if (next.closing && !prev.closing) out.push(next.ringPhase >= next.ringPhases ? "finalRing" : "ringClosing");
  if (next.outside && !prev.outside && !next.dropping) out.push("outside");
  // squads counted down to the last three and the last two, said once each, and not when it is you and one other in solo
  if (next.team > 1 && next.squads < prev.squads) {
    if (next.squads === 3) out.push("squads3");
    else if (next.squads === 2) out.push("squads2");
  }
  if (next.placement !== null && prev.placement === null) out.push(next.placement === 1 ? "won" : "lost");
  return out;
}

/** a line's words, picked by `r` (0..1) from its list */
export function wordsFor(line: Line, r: number): string {
  const say = cfg.lines[line].say;
  return say[Math.min(say.length - 1, Math.floor(r * say.length))];
}

interface Waiting {
  line: Line;
  at: number;
}

/**
 * Says the lines: one at a time, the most important first, each no more often
 * than its cooldown, and a line that waited too long is dropped rather than
 * said late. Without speech synthesis (a browser without it, a test page) it
 * keeps the log all the same, so what would have been said can be checked.
 */
export class Announcer {
  /** everything said, newest last (tools/e2e.ts reads it) */
  readonly spoken: Array<{ line: Line; words: string; at: number }> = [];
  /** 0..1: the master volume times the voice slider (Settings); 0 says nothing */
  level = 0.8;
  private waiting: Waiting[] = [];
  private lastSaid = new Map<Line, number>();
  private speaking: { line: Line; until: number } | null = null;
  private voices: Partial<Record<Who, SpeechSynthesisVoice | null>> = {};
  private readonly synth: SpeechSynthesis | null = typeof speechSynthesis !== "undefined" ? speechSynthesis : null;

  /** a line is called for at `now`: queued, or dropped if it said the same too recently */
  say(line: Line, now: number): void {
    const def = cfg.lines[line];
    if (now - (this.lastSaid.get(line) ?? -Infinity) < def.cooldown) return;
    if (this.waiting.some((w) => w.line === line)) return;
    this.waiting.push({ line, at: now });
    // the most important first, then the oldest
    this.waiting.sort((a, b) => cfg.lines[b.line].priority - cfg.lines[a.line].priority || a.at - b.at);
    if (this.waiting.length > cfg.queue) this.waiting.length = cfg.queue;
    // one more important than what is being said cuts it off
    if (this.speaking && def.priority > cfg.lines[this.speaking.line].priority) {
      this.synth?.cancel();
      this.speaking = null;
    }
  }

  /** each frame: the next line when the last is done */
  update(now: number): void {
    this.waiting = this.waiting.filter((w) => now - w.at <= cfg.stale);
    if (this.speaking && now < this.speaking.until) return;
    this.speaking = null;
    const next = this.waiting.shift();
    if (!next) return;
    const words = wordsFor(next.line, Math.random());
    this.lastSaid.set(next.line, now);
    this.spoken.push({ line: next.line, words, at: now });
    if (this.spoken.length > 50) this.spoken.shift();
    // a line takes about as long as its words at the voice's rate: long enough that two do not talk over each other
    const who = cfg.lines[next.line].by as Who;
    const v = cfg.voices[who];
    this.speaking = { line: next.line, until: now + (cfg.lead + words.split(" ").length * cfg.perWord) / v.rate + cfg.gap };
    if (!this.synth || this.level <= 0) return;
    try {
      const u = new SpeechSynthesisUtterance(words);
      u.rate = v.rate;
      u.pitch = v.pitch;
      u.volume = Math.max(0, Math.min(1, this.level));
      const voice = this.voiceFor(who);
      if (voice) u.voice = voice;
      this.synth.speak(u);
    } catch {
      /* speech is a nicety: a browser that refuses it plays on without */
    }
  }

  /** a match ended or was left: nothing said about it later */
  clear(): void {
    this.waiting = [];
    this.speaking = null;
    this.synth?.cancel();
  }

  /** the system voice for `who`: the first preferred name there is, else the first English one (the list arrives late on some browsers) */
  private voiceFor(who: Who): SpeechSynthesisVoice | null {
    if (this.voices[who]) return this.voices[who] ?? null;
    const all = this.synth?.getVoices() ?? [];
    if (!all.length) return null;
    const pick = cfg.voices[who].prefer.map((n) => all.find((v) => v.name.includes(n))).find(Boolean) ?? all.find((v) => v.lang.startsWith("en")) ?? null;
    this.voices[who] = pick;
    return pick;
  }
}
