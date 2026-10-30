// The online leaderboard client. The board is found at run time: on our own
// server (server/game/serve.mjs) /net.json names it, and a build made with
// VITE_LEADERBOARD_URL (the Cloudflare Worker, server/leaderboard/worker.ts)
// uses that. On a page with neither (the dev server) every call is a no-op and
// the boards stay in the browser.
//
// Results are posted after the fact and never block the game. One that did not get there (no answer, the server busy
// or restarting, too many posts from one address) waits in this browser and goes before the next (Milestone 914).

import { session } from "../net/account";
export interface BoardEntry {
  name: string;
  value: number;
  at: string;
}

/** the boards the game posts to, in the order the Stats tab offers them */
export const BOARDS: ReadonlyArray<{ id: string; label: string; unit: "s" | "wins" | "kills" | "damage" }> = [
  // What a match was worth, not how many you have played: the best single
  // match anyone has had. Wins reward turning up, these reward a good night.
  { id: "match:kills", label: "Most kills in a match", unit: "kills" },
  { id: "match:damage", label: "Most damage in a match", unit: "damage" },
  // (THE RUN as rebuilt, Milestone 913: course.ts courseKey; the advanced course went in Milestone 633)
  { id: "course:basic.r2", label: "The Run", unit: "s" },
  { id: "course:drill", label: "Flick drill (30 targets)", unit: "s" },
  { id: "duel:wins", label: "1v1 wins", unit: "wins" },
  { id: "triple:wins", label: "1v1v1 wins", unit: "wins" },
  { id: "br:wins", label: "Battle royale wins", unit: "wins" },
  { id: "tdm:wins", label: "Team deathmatch wins", unit: "wins" },
  { id: "control:wins", label: "Control wins", unit: "wins" },
  { id: "ffa:wins", label: "Free-for-all wins", unit: "wins" },
  // (elite and mixed were posted to and never offered; Gun Run and Crown were offered and never posted to: Milestone 913)
  { id: "bots:elite:wins", label: "Wins against elite bots", unit: "wins" },
  { id: "bots:mixed:wins", label: "Wins against mixed bots", unit: "wins" },
  { id: "bots:hard:wins", label: "Wins against hard bots", unit: "wins" },
  { id: "bots:normal:wins", label: "Wins against normal bots", unit: "wins" },
  { id: "bots:easy:wins", label: "Wins against easy bots", unit: "wins" },
];

// (env read with ?.: tools/checks/account-say.ts runs this file under plain node, which has no import.meta.env)
const BUILD_URL = (import.meta.env?.VITE_LEADERBOARD_URL as string | undefined)?.replace(/\/$/, "") ?? "";
// Only the old Cloudflare board (server/leaderboard/worker.ts) reads this. It
// is built into the page, so it is not a secret from anyone who opens the
// bundle, and the game's own server does not look at it: that one checks the
// account session instead.
const SECRET = (import.meta.env?.VITE_LEADERBOARD_SECRET as string | undefined) ?? "";

let base: Promise<string | null> | null = null;
/**
 * The board's address, or "" when there is none; looked up once it is known. null: no answer this time (the page's
 * server restarting), asked again next time, where a failed look at the page's start left every result of the visit
 * unposted (Milestone 914).
 */
function boardBase(): Promise<string | null> {
  const asked = (base ??= (async () => {
    if (BUILD_URL) return BUILD_URL;
    try {
      const r = await fetch("./net.json", { cache: "no-store" });
      if (!r.ok) return null;
      // the dev server answers any path with the game page
      if (!(r.headers.get("content-type") ?? "").includes("json")) return "";
      const j = (await r.json()) as { board?: unknown };
      return typeof j.board === "string" ? new URL(j.board, location.href).href.replace(/\/$/, "") : "";
    } catch {
      return null;
    }
  })());
  void asked.then((b) => {
    if (b === null && base === asked) base = null;
  });
  return asked;
}

/** the results that did not get there, oldest first, in this browser only (account.ts does not sync it) */
const QUEUE_KEY = "range.board.queue";
const QUEUE_MAX = 30;
type Queued = { board: string; name: string; value: number };
function queued(): Queued[] {
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as unknown;
    return Array.isArray(q) ? q.filter((e): e is Queued => !!e && typeof e.board === "string" && typeof e.name === "string" && typeof e.value === "number") : [];
  } catch {
    return [];
  }
}
function setQueued(q: Queued[]): void {
  try {
    if (q.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-QUEUE_MAX)));
    else localStorage.removeItem(QUEUE_KEY);
  } catch {
    /* ignore */
  }
}

/** one post: its rank, null when refused, "again" when it did not get there */
async function post(b: string, e: Queued): Promise<number | null | "again"> {
  try {
    const r = await fetch(`${b}/submit`, {
      method: "POST",
      // signed in, the session goes with it: the game's server posts the result
      // under the account's own name, and refuses an account's name from anyone
      // who is not signed in to it (server/game/serve.mjs)
      headers: { "content-type": "application/json", ...(session() ? { authorization: `Bearer ${session()!.token}` } : {}) },
      body: JSON.stringify({ board: e.board, name: e.name, value: e.value, secret: SECRET }),
    });
    if (r.status === 429 || r.status >= 500) return "again";
    if (r.status === 403) BOARD_REFUSED.name = e.name;
    if (!r.ok) return null;
    BOARD_REFUSED.name = null;
    const j = (await r.json()) as { rank?: number };
    return typeof j.rank === "number" ? j.rank : null;
  } catch {
    return "again";
  }
}

/**
 * The results still waiting, in the order they were made: a wins board counts a post as one win at most, so each lost
 * post was a win the board never had back, and one posted after a later one would count for nothing. True when none
 * is left waiting.
 */
async function postQueued(b: string): Promise<boolean> {
  let q = queued();
  while (q.length) {
    if ((await post(b, q[0])) === "again") return false;
    q = queued().slice(1);
    setQueued(q);
  }
  return true;
}

export const leaderboardOnline = async (): Promise<boolean> => (await boardBase()) !== "";

/** record a result; resolves to your rank on that board, or null */
/**
 * A name the boards would not take this visit, or null (Milestone 731): a name an account owns, posted from a browser
 * not signed in to it (after a sign-out it stays the name here), is refused, and every result after it went nowhere
 * while the Stats tab said each one was posted.
 */
export const BOARD_REFUSED: { name: string | null } = { name: null };

export async function submitScore(board: string, name: string, value: number): Promise<number | null> {
  const e: Queued = { board, name, value };
  const b = await boardBase();
  if (b === "") return null;
  // (the ones still waiting go first; behind them, this one waits too)
  if (b === null || !(await postQueued(b))) {
    setQueued([...queued(), e]);
    return null;
  }
  const r = await post(b, e);
  if (r === "again") {
    setQueued([...queued(), e]);
    return null;
  }
  return r;
}

/** post what is waiting (the page's start): a result from a visit whose posts did not get there */
export async function flushScores(): Promise<void> {
  if (!queued().length) return;
  const b = await boardBase();
  if (b) await postQueued(b);
}

export async function topScores(board: string, n = 20): Promise<BoardEntry[]> {
  const b = await boardBase();
  if (!b) return [];
  try {
    const r = await fetch(`${b}/top?board=${encodeURIComponent(board)}&n=${n}`, { cache: "no-store" });
    if (!r.ok) return [];
    const j = (await r.json()) as { entries?: BoardEntry[] };
    return Array.isArray(j.entries) ? j.entries.filter((e) => e && typeof e.name === "string" && typeof e.value === "number") : [];
  } catch {
    return [];
  }
}
