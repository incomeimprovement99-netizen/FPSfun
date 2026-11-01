// A player's record across browsers (Milestone 949, from a review of the saved data), the real account and game modules
// against the real server on a spare port, each "browser" with its own storage:
//   - a tab left open, a look that failed as the page opened, and a save that got no answer each leave what another
//     browser saved on the account, where each wiped it;
//   - signing in on a richer browser keeps its record, and signing out and in again keeps what was played between;
//   - a friend's account on the same browser neither takes on the last player's record nor carries it away;
//   - a failed save goes up as the page next opens, and a look that failed is asked again.
//
// It sets the page's globals for itself, so it runs in a process of its own: npx tsx tools/checks/accounts.ts (verify
// runs it that way). The live site is never touched.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { freePort } from "./free-port";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

if (!existsSync(new URL("../../server/game/node_modules/ws/package.json", import.meta.url))) {
  console.log("  --  skipped: server/game has no node_modules (npm install there to run it)");
  process.exit(0);
}

const port = await freePort();
const origin = `http://127.0.0.1:${port}`;
const dir = mkdtempSync(join(tmpdir(), "accounts-"));
mkdirSync(join(dir, "site"));
writeFileSync(join(dir, "site", "index.html"), "<!doctype html><title>t</title>");
writeFileSync(join(dir, "site", "version.txt"), "check");
const srv = spawn(process.execPath, [new URL("../../server/game/serve.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")], {
  env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", DIST: join(dir, "site"), BOARD_FILE: join(dir, "b.json"), ACCOUNT_FILE: join(dir, "a.json"), SEEN_FILE: join(dir, "s.jsonl"), FEEDBACK_FILE: join(dir, "f.jsonl") },
  stdio: "ignore",
});
for (let i = 0; i < 200 && !(await fetch(`${origin}/health`).then((r) => r.ok, () => false)); i++) await wait(100);

let cur = new Map<string, string>();
const g = globalThis as Record<string, unknown>;
g.localStorage = {
  getItem: (k: string) => cur.get(k) ?? null,
  setItem: (k: string, v: string) => void cur.set(k, String(v)),
  removeItem: (k: string) => void cur.delete(k),
  key: (i: number) => [...cur.keys()][i] ?? null,
  get length() {
    return cur.size;
  },
};
g.location = { href: `${origin}/`, reload() {} };
const realFetch = globalThis.fetch;
let offline = false;
let asks = 0;
g.fetch = (async (u: string | URL, init?: RequestInit) => {
  if (offline) throw new TypeError("no answer");
  const s = String(u);
  // (each sign-in from an address of its own: this runs more than the server gives one address in ten minutes)
  const headers = { ...(init?.headers as Record<string, string> | undefined), "x-forwarded-for": `10.1.1.${++asks % 250}` };
  return realFetch(s === "./net.json" ? `${origin}/net.json` : s.startsWith("/") ? `${origin}${s}` : s, { ...init, headers });
}) as typeof fetch;

const { Progress } = await import("../../src/game/progress");
const { Stats } = await import("../../src/game/stats");
const account = await import("../../src/net/account");

const win = { won: true, roundsWon: 3, roundsLost: 0, kills: 5, damage: 500, shots: 40, hits: 20, deaths: 0 };
/** n matches on this browser's page, as main.ts writes them */
function play(b: Map<string, string>, n: number): void {
  cur = b;
  const p = new Progress(localStorage);
  const s = new Stats();
  for (let i = 0; i < n; i++) {
    s.recordMatch("duel", win);
    p.award("duel", win);
  }
}
const read = (b: Map<string, string>) => {
  const st = JSON.parse(b.get("range.profile.v1") ?? "{}") as { matches?: { duel?: { played?: number } } };
  return { played: st.matches?.duel?.played ?? 0, xp: (JSON.parse(b.get("range.progress.v1") ?? "{}") as { xp?: number }).xp ?? 0 };
};
let names = 0;
const fresh = (): string => `User${++names}`;
/** what the account itself now holds */
async function onAccount(b: Map<string, string>): Promise<{ played: number; xp: number }> {
  cur = b;
  const s = account.session();
  const r = await fetch(`${origin}/api/account/profile`, { headers: { authorization: `Bearer ${s?.token}` } });
  const p = ((await r.json()) as { profile: Record<string, string> | null }).profile ?? {};
  return read(new Map(Object.entries(p)));
}

try {
  console.log("A save that meets another browser's (src/net/account.ts, server/game/serve.mjs)");
  {
    const pc = new Map<string, string>();
    const laptop = new Map<string, string>();
    const name = fresh();
    play(pc, 5);
    cur = pc;
    await account.signIn(name, "password1", true);
    await account.push();
    cur = laptop;
    await account.signIn(name, "password1", false);
    play(laptop, 10);
    cur = laptop;
    await account.push();
    // the PC's tab was open all along: Esc syncs it, nothing played
    cur = pc;
    await account.push();
    const a = await onAccount(pc);
    check("a tab left open does not wipe what another browser saved", a.played >= 15, JSON.stringify(a));
    check("and it has the other browser's matches itself now", read(pc).played >= 15, JSON.stringify(read(pc)));
  }
  {
    // the look as the page opened failed: this browser knows nothing of the laptop's matches
    const pc = new Map<string, string>();
    const laptop = new Map<string, string>();
    const name = fresh();
    play(pc, 2);
    cur = pc;
    await account.signIn(name, "password1", true);
    await account.push();
    cur = laptop;
    await account.signIn(name, "password1", false);
    play(laptop, 12);
    cur = laptop;
    await account.push();
    cur = pc;
    offline = true;
    await account.pullIfNewer();
    offline = false;
    play(pc, 1);
    cur = pc;
    await account.push();
    const a = await onAccount(pc);
    check("a browser whose look failed as the page opened does not take the account back", a.played >= 14, JSON.stringify(a));
  }
  {
    // a save that got no answer, then another browser's, then this page opening again
    const a1 = new Map<string, string>();
    const b1 = new Map<string, string>();
    const name = fresh();
    play(a1, 1);
    cur = a1;
    await account.signIn(name, "password1", true);
    await account.push();
    cur = b1;
    await account.signIn(name, "password1", false);
    play(a1, 6);
    cur = a1;
    offline = true;
    await account.push();
    offline = false;
    play(b1, 2);
    cur = b1;
    await account.push();
    cur = a1;
    await account.pullIfNewer();
    const a = await onAccount(a1);
    check("a save that got no answer is not lost when the page next opens", a.played >= 7, JSON.stringify(a));
  }
  {
    const b = new Map<string, string>();
    const name = fresh();
    play(b, 1);
    cur = b;
    await account.signIn(name, "password1", true);
    await account.push();
    play(b, 3);
    cur = b;
    offline = true;
    await account.push();
    offline = false;
    await account.pullIfNewer();
    const a = await onAccount(b);
    check("a failed save goes up as the page next opens, with nothing new from elsewhere", a.played >= 4, JSON.stringify(a));
  }

  console.log("\nSigning in and out (src/net/account.ts)");
  {
    const phone = new Map<string, string>();
    const main = new Map<string, string>();
    const name = fresh();
    play(phone, 1);
    cur = phone;
    await account.signIn(name, "password1", true);
    await account.push();
    play(main, 40);
    cur = main;
    const r = await account.signIn(name, "password1", false);
    check("signing in on a richer browser keeps its record", r.ok && read(main).played >= 40, JSON.stringify(read(main)));
    check("and the account has it", (await onAccount(main)).played >= 40);
  }
  {
    const b = new Map<string, string>();
    const name = fresh();
    play(b, 3);
    cur = b;
    await account.signIn(name, "password1", true);
    await account.push();
    play(b, 2);
    cur = b;
    await account.signOut();
    play(b, 20);
    cur = b;
    await account.signIn(name, "password1", false);
    check("sign out, play, sign in: nothing rolled back", read(b).played >= 25, JSON.stringify(read(b)));
    check("and it is on the account", (await onAccount(b)).played >= 25);
  }
  {
    const b = new Map<string, string>();
    const name = fresh();
    play(b, 30);
    cur = b;
    await account.signIn(name, "password1", true);
    await account.signOut();
    const friend = fresh();
    cur = b;
    const r = await account.signIn(friend, "password2", true);
    const a = await onAccount(b);
    check("a friend's new account on this browser starts its own record", r.ok && read(b).played === 0 && a.played === 0, JSON.stringify({ here: read(b), a }));
    await account.signOut();
    cur = b;
    await account.signIn(name, "password1", false);
    check("and the first player signing back in has theirs", read(b).played >= 30, JSON.stringify(read(b)));
  }

  console.log("\nA look that failed (src/net/account.ts)");
  {
    // (a module of its own: a look kept from before would hide this)
    const spec = "../../src/net/account?look";
    const again = (await import(spec)) as typeof account;
    offline = true;
    const none = await again.accountBase();
    offline = false;
    const some = await again.accountBase();
    check("a failed look at where the accounts are is asked again", none === null && some !== null, JSON.stringify({ none, some }));
  }
} finally {
  srv.kill();
  await wait(200);
  rmSync(dir, { recursive: true, force: true });
}

console.log(fails === 0 ? "\nACCOUNTS PASS" : `\nACCOUNTS FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
