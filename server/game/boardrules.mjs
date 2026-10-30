// What a posted result may change on a leaderboard (serve.mjs uses this; a
// node check, tools/checks/boards.ts, holds it to its word).
//
// A wins board used to take whatever total a post said, up to 100,000, so a
// single forged post put anyone at the top. The game posts its running total
// after every win, so the server now counts the posts instead of trusting the
// total: a post raises a name's wins by one at most over what the board has.
// The per-address rate limit bounds how fast that can go. A course time is
// still the best of what is posted, over 5 s.

/**
 * The boards that keep the best of ONE match rather than a running total
 * ("match:kills", "match:damage"). A total can be counted post by post, which
 * is what stops a forged total; a personal best cannot, so it is bounded
 * instead: nothing above what a real match can produce is kept.
 */
export const BEST_OF = { "match:kills": 60, "match:damage": 20000 };

/**
 * The least time a course board takes, by board, and 5 s for any other. THE RUN since its rebuild (Milestone 636): its
 * route, door to door, is 29.5 s at a run's best line (tools/checks/sk-run.ts), and a DASH or two saves seconds of it,
 * not ten. Under this, a post is a forgery, and the boards keep a course's best for good (Milestone 912).
 */
export const COURSE_FLOOR = { "course:basic.r2": 20 };

/**
 * A name as the boards keep it: spaces trimmed off its ends and run together to one. "Alice " and " Alice" were names
 * of their own, past the check that keeps an account's name for its owner, and a table shows them as "Alice"
 * (Milestone 912).
 */
export function boardName(name) {
  return name.trim().replace(/ {2,}/g, " ");
}

/** the value a board keeps after this post: `prev` is the name's current entry (undefined: none yet), or null to reject */
export function nextBoardValue(lowerIsBetter, prev, value, board) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1e5) return null;
  if (lowerIsBetter) {
    // no course is run in under 5 s (or its own floor): a smaller time is a mistake or a forgery
    const floor = board && Object.prototype.hasOwnProperty.call(COURSE_FLOOR, board) ? COURSE_FLOOR[board] : 5;
    if (value < floor) return null;
    return prev === undefined ? value : Math.min(prev, value);
  }
  const cap = board && Object.prototype.hasOwnProperty.call(BEST_OF, board) ? BEST_OF[board] : null;
  if (cap !== null) {
    // the best of one match: above what a match can produce it is a forgery,
    // and below the name's own best it changes nothing
    if (value > cap) return null;
    return Math.max(prev ?? 0, Math.floor(value));
  }
  // (a whole number of wins: a post of 1.5 was kept as "1.5 wins", Milestone 912)
  const was = prev ?? 0;
  return Math.max(was, Math.min(Math.floor(value), was + 1));
}
