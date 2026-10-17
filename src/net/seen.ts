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

export type SeenEvent = "open" | "loaded" | "host" | "join" | "match" | "city" | "close";

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
  /** how long it took, seconds: the page's own screen ("loaded"), a match's wait for the city ("city") */
  secs?: number;
  /** the city's file, megabytes, and whether it came from the browser's own copy */
  mb?: number;
  cached?: boolean;
  /** the frame rate while playing, over the visit, and the quality preset */
  fps?: number;
  preset?: string;
  /** where the player was as they closed it: loading, menu, match or range */
  on?: string;
}

/**
 * This browser's own id, made once. Not a range.* key: those follow a signed-in
 * player from browser to browser (account.ts), and two browsers sharing an id
 * would read in the log as one.
 */
const DEVICE_KEY = "seen.device";
export function device(): string {
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

let net: Promise<Record<string, unknown> | null> | null = null;
/** one of our own server's services (the visit log, the feedback) from /net.json, looked up once; null where there is none */
export function serverUrl(key: "seen" | "feedback"): Promise<string | null> {
  net ??= fetch("./net.json", { cache: "no-store" })
    .then((r) => (r.ok && (r.headers.get("content-type") ?? "").includes("json") ? (r.json() as Promise<Record<string, unknown>>) : null))
    .catch(() => null);
  return net.then((j) => (j && typeof j[key] === "string" ? new URL(j[key] as string, location.href).href : null)).catch(() => null);
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
    secs: ev === "close" ? (performance.now() - openedAt) / 1000 : d.secs,
    mb: d.mb,
    cached: d.cached === undefined ? undefined : d.cached ? 1 : 0,
    fps: d.fps,
    preset: d.preset,
    on: d.on,
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
    void serverUrl("seen").then((url) => {
      known = url;
      if (url) send(url);
    });
}
