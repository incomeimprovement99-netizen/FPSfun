// The online board's rules about WHO a result is from, checked against the
// real server (server/game/serve.mjs) started here on a spare port with
// throwaway files, so nothing on a real board is touched.
//
// Run: npm run boardcheck (needs server/game/node_modules: npm install there once).
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const PORT = 4199;
const BASE = `http://127.0.0.1:${PORT}/api`;
let fails = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post(path: string, body: unknown, token?: string): Promise<{ status: number; json: Record<string, unknown> }> {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await r.json()) as Record<string, unknown>;
  } catch {
    /* an empty body */
  }
  return { status: r.status, json };
}

async function main(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "board-check-"));
  const server = spawn(process.execPath, [resolve(HERE, "..", "server", "game", "serve.mjs")], {
    env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", BOARD_FILE: join(dir, "boards.json"), ACCOUNT_FILE: join(dir, "accounts.json"), SEEN_FILE: join(dir, "seen.jsonl"), FEEDBACK_FILE: join(dir, "feedback.jsonl") },
    stdio: "ignore",
  });
  try {
    let up = false;
    for (let i = 0; i < 50 && !up; i++) {
      await sleep(200);
      up = await fetch(`${BASE}/board/top?board=duel:wins&n=1`).then((r) => r.ok, () => false);
    }
    check("the server comes up on the spare port with empty boards", up);
    if (!up) return;

    console.log("\nWho a result is from");
    const reg = await post("/account/register", { name: "Alice", password: "correct horse battery" });
    const token = typeof reg.json.token === "string" ? reg.json.token : "";
    check("an account can be made", reg.status === 200 && token.length === 64, String(reg.status));

    const anon = await post("/board/submit", { board: "duel:wins", name: "Bob", value: 3 });
    check("anyone may post under a name nobody owns", anon.status === 200 && anon.json.rank === 1, JSON.stringify(anon.json));

    const steal = await post("/board/submit", { board: "duel:wins", name: "alice", value: 99 });
    check("but not under a name an account owns, whatever its case", steal.status === 403, `${steal.status} ${JSON.stringify(steal.json)}`);

    const mine = await post("/board/submit", { board: "duel:wins", name: "Mallory", value: 7 }, token);
    const top = (await (await fetch(`${BASE}/board/top?board=duel:wins&n=10`)).json()) as { entries: Array<{ name: string; value: number }> };
    check(
      "signed in, a result goes under the account's own name whatever the post says",
      // (one win: a wins board counts wins whatever value a post names, since 2026-09-19, and this check still wanted 7)
      mine.status === 200 && top.entries.some((e) => e.name === "Alice" && e.value === 1) && !top.entries.some((e) => e.name === "Mallory"),
      JSON.stringify(top.entries)
    );
    const forged = await post("/board/submit", { board: "duel:wins", name: "Alice", value: 50 }, "0".repeat(64));
    check("a made-up session is no session: the account's name stays refused", forged.status === 403, String(forged.status));

    // the menu's Feedback tab (Milestone 625): a note kept a line each, with the address only as a hash, its lines kept
    const net = (await (await fetch(`http://127.0.0.1:${PORT}/net.json`)).json()) as { feedback?: string };
    check("net.json names the feedback's address", net.feedback === "/api/feedback", JSON.stringify(net));
    const note = await post("/feedback", { kind: "bug", text: "The rope drops me.\nAt the top.", name: "Tiger", dev: "k3j2m9q0aa", preset: "balanced", fps: 61, mode: "br" });
    const kept = readFileSync(join(dir, "feedback.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
    check(
      "a note is kept with its kind, its lines, the name and settings, and the address only hashed",
      note.status === 204 && kept.length === 1 && kept[0].kind === "bug" && kept[0].text === "The rope drops me.\nAt the top." && kept[0].name === "Tiger" && kept[0].fps === 61 && /^[0-9a-f]{8}$/.test(String(kept[0].ip)) && !JSON.stringify(kept[0]).includes("127.0.0.1"),
      JSON.stringify({ status: note.status, kept }),
    );
    const empty = await post("/feedback", { kind: "bug", text: "   " });
    const odd = await post("/feedback", { kind: "rant", text: "hello" });
    check("an empty note or a kind it does not know is refused", empty.status === 400 && odd.status === 400, `${empty.status} ${odd.status}`);
    const long = await post("/feedback", { kind: "idea", text: "x".repeat(4000) });
    const last = readFileSync(join(dir, "feedback.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as { text: string });
    check("a long note is cut to 1500 characters", long.status === 204 && last.at(-1)?.text.length === 1500, String(last.at(-1)?.text.length));
    // (ten an address in ten minutes: four posted above, so the eleventh is refused)
    const more: number[] = [];
    for (let i = 0; i < 7; i++) more.push((await post("/feedback", { kind: "other", text: `note ${i}` })).status);
    check("past ten notes from one address in its window, it waits", more.slice(0, 6).every((s) => s === 204) && more[6] === 429, more.join(","));
    // the visit log keeps a visit's new lines (Milestone 625): the page's screen, the city's wait, where the player left
    for (const b of [{ ev: "loaded", secs: 7.4, preset: "balanced" }, { ev: "city", secs: 64.2, mb: 154.9, cached: 0 }, { ev: "close", secs: 900, on: "match", fps: 58.3 }]) await post("/seen", b);
    const visit = readFileSync(join(dir, "seen.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
    check(
      "the visit log keeps the new lines: in after 7 s, the city 155 MB downloaded in 64 s, closed in a match at 58 fps",
      visit.length === 3 && visit[0].ev === "loaded" && visit[0].secs === 7 && visit[0].preset === "balanced" && visit[1].mb === 155 && visit[1].cached === 0 && visit[1].secs === 64 && visit[2].on === "match" && visit[2].fps === 58,
      JSON.stringify(visit),
    );
  } finally {
    server.kill();
    await sleep(200);
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(fails === 0 ? "\nBOARD CHECK PASS" : `\nBOARD CHECK FAIL (${fails})`);
  process.exit(fails === 0 ? 0 : 1);
}
void main();
