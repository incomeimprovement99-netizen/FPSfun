// Optional accounts, on the game's own server (server/game/serve.mjs,
// /api/account): a name and a password, and the player's saved data synced
// between browsers. Nobody needs one to play; on a page without the server
// (the dev server) there is nothing to sign in to, and the game says so.
//
// The "profile" is this browser's own saved data: every localStorage key the
// game writes (range.*) but the session itself and the graphics quality (a
// fact about this machine, not the player). Signing in to an account that has
// a profile makes the two one (mergeprofile.ts) and reloads the page, so every
// part of the game starts from it; an account without one takes this browser's.
// A save says which copy it was made from, and one made from an older copy than
// the account's is merged and sent again (Milestone 949).
import { isRecordKey, mergeProfiles } from "./mergeprofile";

const TOKEN_KEY = "range.account.v1";
/** whose record this browser holds: the last account on it, kept past signing out, so a friend's is not taken for it */
const WHO_KEY = "range.account.who";
/** a stamp of what last went up, for a page that opens with more than that */
const PUSHED_KEY = "range.account.pushed";
/**
 * Kept per browser: the session and what is said of it, the graphics (this machine's), and the board results still
 * to be posted (leaderboard.ts: another browser posting them again would count them twice)
 */
const NOT_SYNCED = new Set([TOKEN_KEY, WHO_KEY, PUSHED_KEY, "range.account.lapsed", "range.quality", "range.renderScale", "range.board.queue"]);
/**
 * And the keys of courses that are gone: THE RUN before its rebuild (Milestone 636: its keys without a version) and the
 * advanced course (gone in Milestone 633). Their ghost runs were most of a profile, 98 KB of one account's 107 KB, near
 * what a save may be (Milestone 913).
 */
const RETIRED = /^range\.course\.(best|splits\.v2|ghost\.v2|recent\.v1|ghostOn)$|^range\.course\.advanced\./;
/** a key bigger than this stays local (a recorded ghost run) */
const KEY_MAX = 64 * 1024;

export interface Session {
  name: string;
  token: string;
  /** when the profile was last written to the account (the server's clock) */
  updated: string | null;
}

let base: Promise<string | null> | null = null;
/** where the accounts are: /net.json says, on our own server; null anywhere else */
export function accountBase(): Promise<string | null> {
  // (a server that says it has none is kept; a look that failed is asked again: one failure while the server restarted
  // sent nothing up for the rest of the visit, Milestone 949)
  base ??= fetch("./net.json", { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .then((j: { account?: unknown } | null) => (j && typeof j.account === "string" ? j.account.replace(/\/$/, "") : null))
    .catch(() => {
      base = null;
      return null;
    });
  return base;
}

export function session(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? "null") as Session | null;
    return s && typeof s.name === "string" && typeof s.token === "string" ? s : null;
  } catch {
    return null;
  }
}

function owner(): string | null {
  try {
    return localStorage.getItem(WHO_KEY);
  } catch {
    return null;
  }
}

function setOwner(name: string): void {
  try {
    localStorage.setItem(WHO_KEY, name);
  } catch {
    /* ignore */
  }
}

/** this browser's record gone, its next owner's to start: `name` is who it now is */
function clearRecord(name: string): void {
  try {
    for (const k of Object.keys(collectProfile())) if (isRecordKey(k)) localStorage.removeItem(k);
    localStorage.setItem("range.profile.v1", JSON.stringify({ name, matches: {}, courses: {}, tech: {}, techMiss: {}, since: new Date().toISOString() }));
  } catch {
    /* ignore */
  }
}

function stamp(p: Record<string, string>): string {
  const t = JSON.stringify(Object.keys(p).sort().map((k) => [k, p[k]]));
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

function saveSession(s: Session | null): void {
  try {
    if (s) localStorage.setItem(TOKEN_KEY, JSON.stringify(s));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** this browser's saved data, to go to the account */
export function collectProfile(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("range.") || NOT_SYNCED.has(k) || RETIRED.test(k)) continue;
      const v = localStorage.getItem(k);
      if (v !== null && v.length <= KEY_MAX) out[k] = v;
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** the account's saved data onto this browser (its keys replace these; ours it does not have stay) */
function applyProfile(p: Record<string, unknown>): number {
  let n = 0;
  try {
    for (const [k, v] of Object.entries(p)) {
      if (!k.startsWith("range.") || NOT_SYNCED.has(k) || typeof v !== "string" || v.length > KEY_MAX) continue;
      localStorage.setItem(k, v);
      n++;
    }
  } catch {
    /* ignore */
  }
  return n;
}

async function call(path: string, method: string, body?: unknown, token?: string): Promise<{ status: number; json: Record<string, unknown> }> {
  const b = await accountBase();
  if (!b) return { status: 0, json: { error: "accounts need the game's own server" } };
  try {
    const r = await fetch(`${b}/${path}`, {
      method,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, json: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { status: 0, json: { error: "no answer from the server" } };
  }
}

export interface SignInResult {
  ok: boolean;
  error?: string;
  /** the account's profile went onto this browser: reload so every part starts from it */
  reload?: boolean;
}

/** sign up (new) or in (existing): the session is kept; the profile goes one way or the other */
export async function signIn(name: string, password: string, create: boolean): Promise<SignInResult> {
  const r = await call(create ? "register" : "login", "POST", { name, password });
  if (r.status !== 200 || typeof r.json.token !== "string") return { ok: false, error: typeof r.json.error === "string" ? r.json.error : "that did not work" };
  const s: Session = { name: String(r.json.name), token: r.json.token, updated: typeof r.json.updated === "string" ? r.json.updated : null };
  saveSession(s);
  // This browser's record is this player's unless it was left by another account: a friend's sign-in on it neither takes
  // on what is here nor carries it into their account (Milestone 949).
  const held = owner();
  const same = held === null || held.toLowerCase() === s.name.toLowerCase();
  setOwner(s.name);
  const prof = r.json.profile;
  const has = !!prof && typeof prof === "object" && !Array.isArray(prof);
  if (!same) {
    clearRecord(s.name);
    if (has) applyProfile(prof as Record<string, unknown>);
    else await push();
    return { ok: true, reload: true };
  }
  if (has) {
    // Both kept: what this browser earned, signed out or with its session run out, and what the account has
    const here = collectProfile();
    const both = mergeProfiles(here, onlyStrings(prof as Record<string, unknown>));
    applyProfile(both);
    await push();
    return Object.keys(both).every((k) => both[k] === here[k]) ? { ok: true } : { ok: true, reload: true };
  }
  // a new account (or one never synced): it takes this browser's
  await push();
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const s = session();
  if (s) {
    // what is here goes up first: signing out left it on this browser alone
    await push();
    await call("logout", "POST", undefined, s.token);
  }
  saveSession(null);
}

/**
 * On load, signed in: if the account's profile is newer than what this
 * browser last synced (another browser saved since), put it on and say so
 * (the caller reloads). Once per change: the new time is kept.
 */
export async function pullIfNewer(): Promise<boolean> {
  const s = session();
  if (!s) return false;
  setOwner(s.name);
  const r = await call("profile", "GET", undefined, s.token);
  if (r.status === 401) saveSession(null);
  if (r.status !== 200) return false;
  const updated = typeof r.json.updated === "string" ? r.json.updated : null;
  const prof = r.json.profile;
  const newer = !!updated && updated !== s.updated && !!prof && typeof prof === "object" && !Array.isArray(prof) && !(s.updated && updated < s.updated);
  if (!newer) {
    // what a failed save left here goes up as the page opens, and does not wait for the next match
    if (unsaved()) await push();
    return false;
  }
  // (both kept, as a save that meets another's: what this browser earned and failed to send went under the account's)
  const here = collectProfile();
  const both = mergeProfiles(here, onlyStrings(prof as Record<string, unknown>));
  applyProfile(both);
  saveSession({ ...s, updated });
  await push();
  return true;
}

function unsaved(): boolean {
  try {
    return localStorage.getItem(PUSHED_KEY) !== stamp(collectProfile());
  } catch {
    return false;
  }
}

function onlyStrings(p: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(p).filter((e): e is [string, string] => typeof e[1] === "string"));
}

/** the last save's answer when it failed: its HTTP status, 0 for no answer at all (the Account tab says which) */
export const PUSH_FAILED: { status: number | null } = { status: null };

/** this browser's saved data up to the account; false when not signed in or it failed (PUSH_FAILED says why) */
export async function push(): Promise<boolean> {
  const s = session();
  if (!s) return false;
  // `base` is the copy this one was made from: the account's, if it has moved on since, comes back to be merged. A tab left
  // open, a look that failed as the page opened or a save that got no answer each went straight over what another
  // browser had saved, with no undo (Milestone 949).
  let profile = collectProfile();
  let r = await call("profile", "PUT", { profile, base: s.updated }, s.token);
  if (r.status === 409 && r.json.profile && typeof r.json.profile === "object" && !Array.isArray(r.json.profile)) {
    profile = mergeProfiles(profile, onlyStrings(r.json.profile as Record<string, unknown>));
    applyProfile(profile);
    r = await call("profile", "PUT", { profile, base: typeof r.json.updated === "string" ? r.json.updated : null }, s.token);
  }
  // (signed out while this was on its way: its answer does not bring the session back)
  if (session()?.token !== s.token) return false;
  if (r.status === 401) saveSession(null);
  PUSH_FAILED.status = r.status === 200 ? null : r.status;
  if (r.status !== 200) return false;
  saveSession({ ...s, updated: typeof r.json.updated === "string" ? r.json.updated : s.updated });
  try {
    localStorage.setItem(PUSHED_KEY, stamp(profile));
  } catch {
    /* ignore */
  }
  return true;
}
