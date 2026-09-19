// Enemies shown (SCOUT's PULSE and SWEEP, SMOKE's THERMAL; src/config/kits.json).
//
// A kit shows an enemy for a few seconds: their figure glows (the threat
// highlight main.ts draws, so this only says which figures are shown) and, in
// a squad, a mark goes out so a friend sees the same contact.
//
// Kept apart from the matches because two kinds of match have to do it: the
// ones built on Duel (the 1v1, the modes, the battle royale) and the offline
// bot practice, which is its own class. Both hold one of these.
import * as THREE from "three";
import type { Dummy } from "./dummy";

/** an enemy a scan can find: who, what they are called, and where they are */
export interface Seen {
  id: number;
  name: string;
  at: THREE.Vector3;
  avatar: Dummy;
}

export class Revealed {
  /** the figures shown now: the page draws them in the threat highlight */
  readonly figures = new Set<Dummy>();
  private until = new Map<number, { at: number; avatar: Dummy }>();

  /**
   * Every enemy of `all` within `range` of `at`, and inside `cone` degrees of
   * `fwd` where one is given, shown for `seconds`. `told` is called for each,
   * so a match can mark them for its squad. Returns how many.
   */
  scan(all: readonly Seen[], at: THREE.Vector3, fwd: THREE.Vector3 | null, range: number, cone: number, seconds: number, now: number, told?: (s: Seen) => void): number {
    const cos = Math.cos((cone / 2) * (Math.PI / 180));
    let found = 0;
    for (const s of all) {
      const to = new THREE.Vector3(s.at.x - at.x, 0, s.at.z - at.z);
      const d = to.length();
      if (d > range) continue;
      if (fwd && d > 0.5) {
        const f = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
        if (to.normalize().dot(f) < cos) continue;
      }
      found++;
      this.one(s.id, s.avatar, seconds, now);
      told?.(s);
    }
    return found;
  }

  /** every enemy of `all` standing somewhere `where` says yes to (SMOKE's own clouds) */
  where(all: readonly Seen[], test: (at: THREE.Vector3) => boolean, seconds: number, now: number): number {
    let found = 0;
    for (const s of all) {
      if (!test(s.at)) continue;
      found++;
      this.one(s.id, s.avatar, seconds, now);
    }
    return found;
  }

  /** one enemy shown for `seconds` (a squad mate's scan says so too) */
  one(id: number, avatar: Dummy, seconds: number, now: number): void {
    this.until.set(id, { at: now + seconds, avatar });
    this.figures.add(avatar);
  }

  /** the ones whose time is up go back to themselves */
  step(now: number): void {
    if (!this.until.size) return;
    for (const [id, v] of [...this.until]) {
      if (now < v.at) continue;
      this.until.delete(id);
      this.figures.delete(v.avatar);
    }
  }

  clear(): void {
    this.until.clear();
    this.figures.clear();
  }
}
