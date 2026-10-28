// What the Account and Stats tabs say when the server will not take something (Milestone 731). A failed sync said "sign
// in again" whatever the answer was, and signing in again put the account's older profile over this browser's newer
// one; and a result the boards refused (a name an account owns, posted from a browser not signed in to it) went
// nowhere while the Stats tab said every result was posted.
//
// Run on its own: npx tsx tools/checks/account-say.ts.
import { syncFailed } from "../../src/ui/account";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("What the Account and Stats tabs say when the server will not take something");
const said = [401, 429, 507, 0].map((s) => syncFailed(s));
check("a failed sync says sign in again only when the server signed you out (401)", /sign in again/i.test(said[0]) && said.slice(1).every((t) => !/sign in/i.test(t)), JSON.stringify(said));
check("and each other answer says something of its own: too many saves, too big, no answer", new Set(said).size === 4);

// the boards, over a stand-in for the server: a refusal remembered, a result taken clearing it
const g = globalThis as unknown as { fetch: typeof fetch; location?: unknown };
const realFetch = g.fetch;
const hadLocation = "location" in g;
if (!hadLocation) g.location = { href: "http://check.test/" };
let answer = 403;
g.fetch = (async (u: string | URL) => {
  if (String(u).endsWith("net.json")) return new Response(JSON.stringify({ board: "/api/board" }), { headers: { "content-type": "application/json" } });
  return new Response(JSON.stringify(answer === 200 ? { rank: 3 } : { error: "that name belongs to an account" }), { status: answer, headers: { "content-type": "application/json" } });
}) as typeof fetch;
try {
  const { submitScore, BOARD_REFUSED } = await import("../../src/game/leaderboard");
  await submitScore("course:basic", "B00G", 12);
  const refused = BOARD_REFUSED.name;
  answer = 200;
  const rank = await submitScore("course:basic", "B00G", 12);
  check("a result the boards refuse is remembered for the Stats tab, and the next one taken clears it", refused === "B00G" && rank === 3 && BOARD_REFUSED.name === null, JSON.stringify({ refused, rank, after: BOARD_REFUSED.name }));
} finally {
  g.fetch = realFetch;
  if (!hadLocation) delete g.location;
}

export const accountSayFails = fails;
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) process.exitCode = fails ? 1 : 0;
