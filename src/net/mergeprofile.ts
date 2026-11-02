// Two copies of a player's saved data made one. A save went over whatever the account held, and signing in went over
// whatever the browser held: a tab left open wiped ten matches played on a laptop, and signing in on a main PC to an
// account made on a phone took 200 matches down to 1, with one copy kept and no undo (Milestone 949).
//
// What a player earned only ever goes up, so of two copies the record is the further of each: the most XP, the highest of
// each count, the best time with its splits and ghost. Everything else (settings, keys, loadouts) is one choice or
// another, and goes to `theirs`, the copy already on the account.

type Copy = Record<string, string>;
type Obj = Record<string, unknown>;

const PROGRESS = "range.progress.v1";
const STATS = "range.profile.v1";
/** the flick drill's best, the lower the better (a merge kept the account's: 20.5 lost to 33.1, and a 25 then read NEW BEST, Milestone 994) */
const DRILL = "range.drill.blink";
/** a course's best time, by the keys course.ts storageKeys gives: its prefix */
const BEST = /^(range\.course(?:\..+)?)\.best$/;
/** every key of a player's record, kept apart from their settings */
export const isRecordKey = (k: string): boolean => k === PROGRESS || k === STATS || k === DRILL || k.startsWith("range.course");

const parsed = (t: string | undefined): Obj | null => {
  if (t === undefined) return null;
  try {
    const v = JSON.parse(t) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null;
  } catch {
    return null;
  }
};
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const bag = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});

function mergeProgress(mine: Obj, theirs: Obj): Obj {
  const further = num(mine.xp) > num(theirs.xp) ? mine : theirs;
  return { ...further, done: Math.max(num(mine.done), num(theirs.done)) };
}

/** each number the higher of the two; a win streak is the copy with more played, being a run and not a total */
function mergeMatch(mine: Obj, theirs: Obj): Obj {
  const out: Obj = { ...theirs, ...mine };
  for (const k of Object.keys(out)) if (typeof out[k] === "number") out[k] = Math.max(num(mine[k]), num(theirs[k]));
  out.streak = num(num(mine.played) > num(theirs.played) ? mine.streak : theirs.streak);
  return out;
}

function mergeCourse(mine: Obj, theirs: Obj): Obj {
  const times = [mine.best, theirs.best].filter((t): t is number => typeof t === "number" && Number.isFinite(t));
  const seen = new Set<string>();
  const board = [...(Array.isArray(mine.board) ? mine.board : []), ...(Array.isArray(theirs.board) ? theirs.board : [])]
    .filter((r: Obj) => {
      const id = `${String(r.time)} ${String(r.at)}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((a: Obj, b: Obj) => num(a.time) - num(b.time))
    .slice(0, 10);
  return { ...theirs, runs: Math.max(num(mine.runs), num(theirs.runs)), best: times.length ? Math.min(...times) : null, board };
}

function mergeCounts(mine: unknown, theirs: unknown): Obj {
  const a = bag(mine);
  const b = bag(theirs);
  const out: Obj = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = Math.max(num(a[k]), num(b[k]));
  return out;
}

function mergeStats(mine: Obj, theirs: Obj): Obj {
  const matches: Obj = {};
  const a = bag(mine.matches);
  const b = bag(theirs.matches);
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) matches[k] = a[k] && b[k] ? mergeMatch(bag(a[k]), bag(b[k])) : (a[k] ?? b[k]);
  const courses: Obj = {};
  const ca = bag(mine.courses);
  const cb = bag(theirs.courses);
  for (const k of new Set([...Object.keys(ca), ...Object.keys(cb)])) courses[k] = ca[k] && cb[k] ? mergeCourse(bag(ca[k]), bag(cb[k])) : (ca[k] ?? cb[k]);
  const dates = [mine.since, theirs.since].filter((d): d is string => typeof d === "string").sort();
  return { ...theirs, matches, courses, tech: mergeCounts(mine.tech, theirs.tech), techMiss: mergeCounts(mine.techMiss, theirs.techMiss), since: dates[0] ?? theirs.since };
}

/** the one copy of `mine` (this browser's) and `theirs` (the account's) */
export function mergeProfiles(mine: Copy, theirs: Copy): Copy {
  const out: Copy = { ...mine, ...theirs };
  const whole = (k: string, join: (a: Obj, b: Obj) => Obj): void => {
    const a = parsed(mine[k]);
    const b = parsed(theirs[k]);
    if (a && b) out[k] = JSON.stringify(join(a, b));
  };
  whole(PROGRESS, mergeProgress);
  whole(STATS, mergeStats);
  if (Number(mine[DRILL]) > 0 && !(Number(theirs[DRILL]) <= Number(mine[DRILL]))) out[DRILL] = mine[DRILL];
  // a course's best time, and the splits and the ghost of that run with it
  for (const [k, v] of Object.entries(mine)) {
    const at = BEST.exec(k);
    if (!at) continue;
    const own = Number(v);
    const other = Number(theirs[k]);
    if (!(own > 0) || (other > 0 && other <= own)) continue;
    out[k] = v;
    for (const part of [`${at[1]}.splits.v2`, `${at[1]}.ghost.v2`]) {
      if (mine[part] !== undefined) out[part] = mine[part];
      else delete out[part];
    }
  }
  return out;
}
