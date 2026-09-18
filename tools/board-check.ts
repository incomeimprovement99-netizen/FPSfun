// The online board's rules about WHO a result is from, checked against the
// real server (server/game/serve.mjs) started here on a spare port with
// throwaway files, so nothing on a real board is touched.
//
// Run: npm run boardcheck (needs server/game/node_modules: npm install there once).
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
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
    env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", BOARD_FILE: join(dir, "boards.json"), ACCOUNT_FILE: join(dir, "accounts.json") },
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
      mine.status === 200 && top.entries.some((e) => e.name === "Alice" && e.value === 7) && !top.entries.some((e) => e.name === "Mallory"),
      JSON.stringify(top.entries)
    );
    const forged = await post("/board/submit", { board: "duel:wins", name: "Alice", value: 50 }, "0".repeat(64));
    check("a made-up session is no session: the account's name stays refused", forged.status === 403, String(forged.status));
  } finally {
    server.kill();
    await sleep(200);
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(fails === 0 ? "\nBOARD CHECK PASS" : `\nBOARD CHECK FAIL (${fails})`);
  process.exit(fails === 0 ? 0 : 1);
}
void main();
