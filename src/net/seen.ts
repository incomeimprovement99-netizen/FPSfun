// Who played, for the owner: a line in the game server's visit log
// (server/game/serve.mjs /api/seen) as the page opens, a lobby is made or
// joined, a match starts and the page closes. The owner asked whether a friend
// had been on, and nothing could say: the broker keeps no names, and the boards
// only hear about a win. `npm run fps seen` reads the log.
//
// Only our own server has the log: /net.json names it there, and anywhere else
// (the dev server, a copy on another host) nothing is sent. A test browser says
// it is one, so the deploy's own live check can be told from a friend.
import { session } from "./account";

export type SeenEvent = "open" | "host" | "join" | "match" | "close";

export interface SeenDetail {
  /** the name the player goes by (the profile's) */
  name?: string;
  game?: string;
  /** the mode: the lobby's pick for a host, the match's kind for a match */
  mode?: string;
  code?: string;
  role?: "host" | "guest";
  /** the page was opened from an invite link */
  invite?: boolean;
}

/**
 * This browser's own id, made once. Not a range.* key: those follow a signed-in
 * player from browser to browser (account.ts), and two browsers sharing an id
 * would read in the log as one.
 */
const DEVICE_KEY = "seen.device";
function device(): string {
  try {
    let d = localStorage.getItem(DEVICE_KEY);
    if (!d || !/^[a-z0-9]{10}$/.test(d)) {
      d = Array.from(crypto.getRandomValues(new Uint8Array(10)), (x) => "abcdefghijklmnopqrstuvwxyz0123456789"[x % 36]).join("");
      localStorage.setItem(DEVICE_KEY, d);
    }
    return d;
  } catch {
    return "";
  }
}

let where: Promise<string | null> | null = null;
/** the log's address from /net.json, looked up once; null where there is no log */
function logUrl(): Promise<string | null> {
  where ??= fetch("./net.json", { cache: "no-store" })
    .then((r) => (r.ok && (r.headers.get("content-type") ?? "").includes("json") ? r.json() : null))
    .then((j: { seen?: unknown } | null) => (j && typeof j.seen === "string" ? new URL(j.seen, location.href).href : null))
    .catch(() => null);
  return where;
}
/** known once the first line has gone: a closing page cannot wait for a lookup */
let known: string | null = null;
const openedAt = performance.now();

export function seen(ev: SeenEvent, d: SeenDetail = {}): void {
  const body = JSON.stringify({
    ev,
    name: d.name || undefined,
    acct: session()?.name,
    dev: device(),
    game: d.game,
    mode: d.mode,
    code: d.code,
    role: d.role,
    invite: d.invite ? 1 : undefined,
    secs: ev === "close" ? (performance.now() - openedAt) / 1000 : undefined,
    bot: navigator.webdriver ? 1 : undefined,
  });
  const send = (url: string) => {
    try {
      // a beacon outlives the page, which is what the close needs
      if (!navigator.sendBeacon?.(url, body)) void fetch(url, { method: "POST", body, keepalive: true }).catch(() => undefined);
    } catch {
      /* no log is no loss to the game */
    }
  };
  if (known) send(known);
  else
    void logUrl().then((url) => {
      known = url;
      if (url) send(url);
    });
}
