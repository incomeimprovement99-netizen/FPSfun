// What a player keeps between visits, proven on the real modules (Milestones 909 to 914, from a review of progress,
// the boards and accounts), over a stand-in for the browser's storage and the game's server:
//   - two tabs of the game: what one earns is not wiped by the other's next award (progress and the Stats tab's
//     numbers both);
//   - signing in again after the session ran out keeps this browser's newer copy when nobody has saved to the account
//     since;
//   - a challenge finished out of the pool's order is not put straight back up;
//   - THE RUN's board is its rebuilt course's, and the dead courses' keys stay out of the account's copy;
//   - a result that did not get to the board waits, and goes before the next, in order.
//
// It sets the page's globals for itself, so it runs in a process of its own: npx tsx tools/checks/keep.ts (verify runs
// it that way).

// (a module whose imports wait for the stand-ins below: a static import would read the page's globals before they are set)
export {};

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

// ---------- a stand-in browser: one storage both "tabs" share, and a server ----------
const store = new Map<string, string>();
const g = globalThis as Record<string, unknown>;
g.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};
g.location = { href: "http://keep.test/", reload() {} };

type Answer = { status: number; json: unknown };
let serve: (method: string, path: string, body: unknown) => Answer = () => ({ status: 404, json: {} });
const sent: Array<{ method: string; path: string; body: unknown }> = [];
g.fetch = (async (u: string | URL, init?: RequestInit) => {
  const url = String(u);
  if (url === "./net.json") return new Response(JSON.stringify({ board: "/api/board", account: "http://keep.test/api/account" }), { headers: { "content-type": "application/json" } });
  const path = url.replace("http://keep.test", "");
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  sent.push({ method: init?.method ?? "GET", path, body });
  const a = serve(init?.method ?? "GET", path, body);
  if (a.status === 0) throw new TypeError("no answer");
  return new Response(JSON.stringify(a.json), { status: a.status, headers: { "content-type": "application/json" } });
}) as typeof fetch;

const { Progress, CHALLENGES } = await import("../../src/game/progress");
const { Stats } = await import("../../src/game/stats");
const account = await import("../../src/net/account");
const { BOARDS, submitScore } = await import("../../src/game/leaderboard");
const { courseKey } = await import("../../src/game/course");
const { BASIC_COURSE } = await import("../../src/game/courses/basic");
const { readFileSync } = await import("node:fs");

const match = { won: true, roundsWon: 3, roundsLost: 0, kills: 5, damage: 500, shots: 40, hits: 20, deaths: 0 };

console.log("Two tabs of the game (src/game/progress.ts, src/game/stats.ts)");
{
  store.clear();
  const a = new Progress(localStorage);
  const b = new Progress(localStorage);
  const wonB = b.award("duel", match).gained + b.award("duel", match).gained + b.award("duel", match).gained;
  const ranA = a.awardRun("S").gained;
  const kept = new Progress(localStorage).xp;
  check("what a second tab earns is kept when the first tab earns something next: the stored XP is both", kept === wonB + ranA, JSON.stringify({ secondTab: wonB, firstTab: ranA, stored: kept }));
  const sa = new Stats();
  const sb = new Stats();
  for (let i = 0; i < 3; i++) sb.recordMatch("duel", match);
  sa.recordTech("SUPERGLIDE", true);
  sa.recordRun("basic.r2", 41.2, "A");
  const st = new Stats().profile;
  check(
    "and the Stats tab's numbers: three duels in the second tab, then a run and a superglide in the first, all kept",
    st.matches.duel?.played === 3 && st.courses["basic.r2"]?.runs === 1 && st.tech.SUPERGLIDE === 1,
    JSON.stringify({ duels: st.matches.duel?.played ?? 0, runs: st.courses["basic.r2"]?.runs ?? 0, superglides: st.tech.SUPERGLIDE ?? 0 }),
  );
}

console.log("\nThe challenges (src/game/progress.ts)");
{
  store.clear();
  const p = new Progress(localStorage);
  const before = p.challenges.map((c) => c.id);
  // the second one put up, finished on its own (the first and third need other stats)
  const c = CHALLENGES[1];
  (p as unknown as { apply: (xp: number, add: Record<string, number>) => unknown }).apply(0, { [c.stat]: c.goal });
  const after = p.challenges.map((x) => x.id);
  check(`a challenge finished out of the pool's order (${c.id}) is not put straight back up`, before.includes(c.id) && !after.includes(c.id) && after.length === before.length, JSON.stringify({ before, after }));
}

console.log("\nSigning in again after the session ran out (src/net/account.ts)");
{
  store.clear();
  const AT = "2026-10-01T10:00:00.000Z";
  let profile: Record<string, string> = { "range.progress.v1": JSON.stringify({ xp: 1000, active: [], done: 0 }) };
  let updated = AT;
  let live = true;
  serve = (method, path, body) => {
    if (path === "/api/account/login") return { status: 200, json: { ok: true, name: "Alice", token: "t2", profile, updated } };
    if (path === "/api/account/profile" && !live) return { status: 401, json: { error: "sign in again" } };
    if (path === "/api/account/profile" && method === "PUT") {
      profile = (body as { profile: Record<string, string> }).profile;
      updated = "2026-10-02T10:00:00.000Z";
      return { status: 200, json: { ok: true, updated } };
    }
    return { status: 200, json: { ok: true, profile, updated } };
  };
  localStorage.setItem("range.account.v1", JSON.stringify({ name: "Alice", token: "t1", updated: AT }));
  // this browser goes on: more XP, and its session runs out on the next save
  localStorage.setItem("range.progress.v1", JSON.stringify({ xp: 9000, active: [], done: 0 }));
  live = false;
  await account.push();
  const out = account.session() === null;
  live = true;
  const r = await account.signIn("Alice", "password1", false);
  const local = JSON.parse(localStorage.getItem("range.progress.v1") ?? "{}").xp;
  const up = JSON.parse(profile["range.progress.v1"] ?? "{}").xp;
  check(
    "signed in again with nobody saving to the account since: this browser's newer copy stays and goes up",
    out && r.ok && !r.reload && local === 9000 && up === 9000,
    JSON.stringify({ signedOut: out, reload: !!r.reload, local, onAccount: up }),
  );
  // another browser saved since: the account's is the newer, and comes on as before
  localStorage.setItem("range.account.v1", JSON.stringify({ name: "Alice", token: "t3", updated }));
  live = false;
  await account.push();
  live = true;
  updated = "2026-10-03T10:00:00.000Z";
  const r2 = await account.signIn("Alice", "password1", false);
  check("and when another browser saved since, the account's copy comes on (a reload), as before", r2.ok && !!r2.reload);
  store.clear();
}

console.log("\nThe boards (src/game/leaderboard.ts, src/net/account.ts)");
{
  const run = `course:${courseKey(BASIC_COURSE)}`;
  const ids = BOARDS.map((b) => b.id);
  const serverSrc = readFileSync(new URL("../../server/game/serve.mjs", import.meta.url), "utf8");
  check("THE RUN's board is its rebuilt course's, offered and kept by the server, and the old ones are not offered", ids.includes(run) && serverSrc.includes(`"${run}"`) && !ids.includes("course:basic") && !ids.includes("course:advanced"), run);
  store.clear();
  localStorage.setItem("range.course.ghost.v2", "x".repeat(1000));
  localStorage.setItem("range.course.advanced.ghost.v2", "x".repeat(1000));
  localStorage.setItem("range.course.r2.ghost.v2", "y");
  localStorage.setItem("range.board.queue", "[]");
  const keys = Object.keys(account.collectProfile());
  check("the dead courses' keys and the results still to post stay out of the account's copy; the course as it is goes", !keys.includes("range.course.ghost.v2") && !keys.includes("range.course.advanced.ghost.v2") && !keys.includes("range.board.queue") && keys.includes("range.course.r2.ghost.v2"), keys.join(", "));
  // the server down for two wins, then back: the two wait and go, in order, before the third
  store.clear();
  sent.length = 0;
  let up = false;
  serve = (_m, path, body) => (path === "/api/board/submit" ? (up ? { status: 200, json: { ok: true, rank: (body as { value: number }).value } } : { status: 0, json: {} }) : { status: 404, json: {} });
  await submitScore("duel:wins", "B00G", 4);
  await submitScore("duel:wins", "B00G", 5);
  const waiting = JSON.parse(localStorage.getItem("range.board.queue") ?? "[]").length;
  up = true;
  sent.length = 0;
  const rank = await submitScore("duel:wins", "B00G", 6);
  const order = sent.filter((s) => s.path === "/api/board/submit").map((s) => (s.body as { value: number }).value);
  check("a result that did not get to the board waits, and goes before the next, in order", waiting === 2 && order.join() === "4,5,6" && rank === 6 && !localStorage.getItem("range.board.queue"), JSON.stringify({ waiting, order, rank }));
}

console.log(fails === 0 ? "\nKEEP PASS" : `\nKEEP FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
