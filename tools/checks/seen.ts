// The visit log (server/game/serve.mjs /api/seen, src/net/seen.ts): every event
// the game sends is one the server keeps, and the report reads a night of lines
// as the sittings they were.
//
// The boards once lost every free-for-all win because the game posted to a board
// the server had never heard of; the same drift here would drop a friend's
// visit without a word, so the two lists are compared.
//
// Run on its own: npx tsx tools/checks/seen.ts.
import { readFileSync } from "node:fs";
import { parseSeen, seenReport, sittings, SITTING_GAP_MS } from "../seen-report";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("The visit log, the game's and the server's");
const serve = readFileSync(new URL("../../server/game/serve.mjs", import.meta.url), "utf8");
const m = /const SEEN_EVENTS = new Set\(\[([^\]]*)\]\)/.exec(serve);
const kept = new Set(m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : []);
check("the server's event list is where the check looks for it", kept.size > 0);
const client = readFileSync(new URL("../../src/net/seen.ts", import.meta.url), "utf8");
const t = /export type SeenEvent = ([^;]+);/.exec(client);
const sent = t ? [...t[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
check("the game's event list is where the check looks for it", sent.length > 0);
const lost = sent.filter((e) => !kept.has(e));
check("every event the game sends is one the server keeps", lost.length === 0, lost.join(", ") || sent.join(", "));
// each one the game sends is sent from somewhere
const main = readFileSync(new URL("../../src/main.ts", import.meta.url), "utf8");
const unsent = sent.filter((e) => !main.includes(`note("${e}"`));
check("and main.ts sends every one of them", unsent.length === 0, unsent.join(", "));

// A night: a friend opens an invite, plays two matches and leaves; the deploy's
// test browser plays a 1v1; the same friend is back an hour later.
{
  const at = (min: number) => new Date(Date.UTC(2026, 8, 29, 1, 0) + min * 60000).toISOString();
  const line = (min: number, o: Record<string, unknown>) => JSON.stringify({ at: at(min), dev: "k3j2m9q0aa", ip: "9f3a21bc", ua: "Chrome/Windows", name: "Usso", ...o });
  const text = [
    line(0, { ev: "open", invite: 1, code: "ABCDE" }),
    line(1, { ev: "join", code: "ABCDE", mode: "arena" }),
    line(1, { ev: "match", mode: "duel", role: "guest" }),
    line(9, { ev: "match", mode: "br", role: "guest" }),
    line(24, { ev: "close", secs: 1440 }),
    JSON.stringify({ at: at(30), ev: "match", mode: "duel", dev: "livecheck0", ip: "1234abcd", ua: "Chrome/Linux", bot: 1 }),
    "{ not a line",
    line(24 + SITTING_GAP_MS / 60000 + 36, { ev: "open" }),
  ].join("\n");
  const lines = parseSeen(text);
  check("a torn line is skipped, the rest read", lines.length === 7, String(lines.length));
  const s = sittings(lines, 0);
  const friend = s.filter((x) => x.dev === "k3j2m9q0aa");
  check("a friend's night is two sittings: half an hour apart is a new one", friend.length === 2 && friend[0].lines.length === 5 && friend[1].lines.length === 1, JSON.stringify(friend.map((x) => x.lines.length)));
  check("the test browser is its own sitting, marked", s.some((x) => x.bot && x.dev === "livecheck0"));
  const now = Date.UTC(2026, 8, 29, 6, 0);
  const report = seenReport(text, 1, false, now);
  check("the report names the friend, the invite and both matches, and says how long", /Usso/.test(report) && /opened an invite to ABCDE/.test(report) && /played duel as guest/.test(report) && /played br as guest/.test(report) && /closed it after 24 min/.test(report), report);
  check("and leaves the test browser out", !/livecheck/.test(report) && !/TEST/.test(report));
  check("unless asked for everything", /TEST/.test(seenReport(text, 1, true, now)));
  check("an empty log says so", /none/.test(seenReport("", 3, false, now)));
}

export const seenFails = fails;
