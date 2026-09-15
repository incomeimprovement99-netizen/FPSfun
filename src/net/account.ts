// Optional accounts, on the game's own server (server/game/serve.mjs,
// /api/account): a name and a password, and the player's saved data synced
// between browsers. Nobody needs one to play; on a site without the server
// (GitHub Pages) there is nothing to sign in to, and the game says so.
//
// The "profile" is this browser's own saved data: every localStorage key the
// game writes (range.*) but the session itself and the graphics quality (a
// fact about this machine, not the player). Signing in to an account that has
// a profile puts it on and reloads the page, so every part of the game starts
// from it; an account without one takes this browser's.

const TOKEN_KEY = "range.account.v1";
/** kept per browser: the session, and the graphics (this machine's) */
const NOT_SYNCED = new Set([TOKEN_KEY, "range.quality"]);
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
  base ??= fetch("./net.json", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { account?: unknown } | null) => (j && typeof j.account === "string" ? j.account.replace(/\/$/, "") : null))
    .catch(() => null);
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
      if (!k || !k.startsWith("range.") || NOT_SYNCED.has(k)) continue;
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
  const prof = r.json.profile;
  if (prof && typeof prof === "object" && !Array.isArray(prof)) {
    applyProfile(prof as Record<string, unknown>);
    return { ok: true, reload: true };
  }
  // a new account (or one never synced): it takes this browser's
  await push();
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const s = session();
  if (s) await call("logout", "POST", undefined, s.token);
  saveSession(null);
}

/** this browser's saved data up to the account; false when not signed in or it failed */
export async function push(): Promise<boolean> {
  const s = session();
  if (!s) return false;
  const r = await call("profile", "PUT", { profile: collectProfile() }, s.token);
  if (r.status === 401) saveSession(null);
  if (r.status !== 200) return false;
  saveSession({ ...s, updated: typeof r.json.updated === "string" ? r.json.updated : s.updated });
  return true;
}
