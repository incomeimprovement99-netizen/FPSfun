// The visit log (server/game/serve.mjs /api/seen) read as visits: each
// browser's lines grouped into sittings, a sitting ending after half an hour
// with nothing from it. `npm run fps seen [days] [all]` prints it from the box;
// tools/checks/seen.ts holds it to what it is meant to say.

export interface SeenLine {
  at: string;
  ev: string;
  name?: string;
  acct?: string;
  dev?: string;
  ip?: string;
  ua?: string;
  game?: string;
  mode?: string;
  code?: string;
  role?: string;
  invite?: number;
  secs?: number;
  v?: string;
  bot?: number;
}

/** nothing from a browser for this long and its next line is a new sitting */
export const SITTING_GAP_MS = 30 * 60 * 1000;

export interface Sitting {
  who: string;
  names: string[];
  acct?: string;
  dev: string;
  ip: string;
  ua: string;
  from: number;
  to: number;
  lines: SeenLine[];
  bot: boolean;
}

/** the log's text as lines, oldest first; a line that is not one is skipped */
export function parseSeen(text: string): SeenLine[] {
  const out: SeenLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    try {
      const l = JSON.parse(raw) as SeenLine;
      if (l && typeof l.at === "string" && typeof l.ev === "string" && Number.isFinite(Date.parse(l.at))) out.push(l);
    } catch {
      /* a torn line from a full disk or a crash: not a visit */
    }
  }
  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** the lines since `since` (ms), grouped by browser into sittings, the latest last */
export function sittings(lines: SeenLine[], since: number): Sitting[] {
  const open = new Map<string, Sitting>();
  const done: Sitting[] = [];
  for (const l of lines) {
    const t = Date.parse(l.at);
    if (t < since) continue;
    // a browser's own id where it sent one; an older page sent none, and its address and browser stand in
    const key = l.dev ? `d:${l.dev}` : `i:${l.ip ?? "?"}:${l.ua ?? "?"}`;
    let s = open.get(key);
    if (s && t - s.to > SITTING_GAP_MS) {
      done.push(s);
      s = undefined;
    }
    if (!s) {
      s = { who: key, names: [], dev: l.dev ?? "", ip: l.ip ?? "", ua: l.ua ?? "", from: t, to: t, lines: [], bot: false };
      open.set(key, s);
    }
    s.to = t;
    s.lines.push(l);
    if (l.name && !s.names.includes(l.name)) s.names.push(l.name);
    if (l.acct) s.acct = l.acct;
    if (l.bot === 1) s.bot = true;
  }
  return [...done, ...open.values()].sort((a, b) => a.from - b.from);
}

/** one line in words */
export function describe(l: SeenLine): string {
  const mode = l.mode ? ` (${l.mode})` : "";
  switch (l.ev) {
    case "open":
      return l.invite ? `opened an invite${l.code ? ` to ${l.code}` : ""}` : "opened the game";
    case "host":
      return `made a lobby ${l.code ?? ""}${mode}`.trim();
    case "join":
      return `joined ${l.code ?? "a lobby"}${mode}`;
    case "match":
      return `played ${l.mode ?? "a match"}${l.role ? ` as ${l.role}` : ""}`;
    case "close":
      return `closed it${typeof l.secs === "number" ? ` after ${Math.round(l.secs / 60)} min` : ""}`;
    default:
      return l.ev;
  }
}

const TZ = "America/Chicago";
const day = (t: number) => new Date(t).toLocaleDateString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });
const clock = (t: number) => new Date(t).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

/** the report: every sitting in the last `days` days, test browsers left out unless `all` */
export function seenReport(text: string, days: number, all = false, now = Date.now()): string {
  const since = now - days * 86400 * 1000;
  const list = sittings(parseSeen(text), since).filter((s) => all || !s.bot);
  const head = `Visits in the last ${days} day${days === 1 ? "" : "s"} (Chicago time)${all ? "" : ", test browsers left out"}:`;
  if (!list.length) return `${head}\n  none`;
  const rows: string[] = [head];
  for (const s of list) {
    const mins = Math.max(1, Math.round((s.to - s.from) / 60000));
    const name = s.names.join(" / ") || "(no name)";
    const who = [s.acct ? `account ${s.acct}` : "", s.dev ? `browser ${s.dev.slice(0, 6)}` : "", s.ip ? `place ${s.ip.slice(0, 6)}` : "", s.ua, s.bot ? "TEST" : ""].filter(Boolean).join(", ");
    rows.push(`\n${day(s.from)}  ${clock(s.from)} to ${clock(s.to)} (${mins} min)  ${name}  [${who}]`);
    // the same thing twice in a row is said once, with how many
    const said: Array<[string, number]> = [];
    for (const l of s.lines) {
      const w = describe(l);
      const last = said.at(-1);
      if (last && last[0] === w) last[1]++;
      else said.push([w, 1]);
    }
    rows.push(`    ${said.map(([w, n]) => (n > 1 ? `${w} x${n}` : w)).join(" · ")}`);
  }
  return rows.join("\n");
}
