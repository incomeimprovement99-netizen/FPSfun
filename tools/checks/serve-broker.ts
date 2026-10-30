// The game server under bad clients. The broker (Milestone 730): one frame that was not JSON reached the broker's
// "error" with nobody listening, and the throw stopped the whole server (the site, the accounts and every match being
// made); a frame far past a signalling message's size is refused at the socket, and one address holds no more than so
// many sockets. The boards (Milestone 732): an address puts no more than six new names on them in a day, so a flood
// of made-up names cannot push every real result off a board's 100 places. Milestone 936: a `dst` that is no string threw
// in the broker's own timer 5 s later, and that one frame stopped everything. Milestone 937: what one socket may send, a
// client's bad request is no stack in the log, a file that will not parse is kept and not overwritten.
//
// The real server, run on a spare port over a made-up release.
//
// Run on its own: npx tsx tools/checks/serve-broker.ts.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { freePort } from "./free-port";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const SERVE = new URL("../../server/game/serve.mjs", import.meta.url);
// (a port of its own: a fixed one met another verify run's server, free-port.ts)
const PORT = await freePort();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const alive = () => fetch(`http://127.0.0.1:${PORT}/health`).then((r) => r.ok, () => false);
/** a broker socket as the game opens one: open, or refused / closed */
function socket(id: string): Promise<{ ws: WebSocket; open: boolean }> {
  return new Promise((ok) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/peerjs/peerjs?key=range&id=${id}&token=t${id}`);
    const done = (open: boolean) => ok({ ws, open });
    ws.addEventListener("message", (e) => done(String(e.data).includes("OPEN")), { once: true });
    ws.addEventListener("error", () => done(false), { once: true });
    ws.addEventListener("close", () => done(false), { once: true });
    setTimeout(() => done(false), 3000);
  });
}

console.log("The game server under bad clients");
if (!existsSync(new URL("../../server/game/node_modules/ws/package.json", import.meta.url))) {
  console.log("  --  skipped: server/game has no node_modules (npm install there to run it)");
} else {
  const root = mkdtempSync(join(tmpdir(), "serve-broker-"));
  const site = join(root, "app", "site");
  mkdirSync(site, { recursive: true });
  writeFileSync(join(site, "index.html"), "<!doctype html><title>t</title>");
  writeFileSync(join(site, "version.txt"), "check");
  const env = { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", DIST: site, BOARD_FILE: join(root, "b.json"), ACCOUNT_FILE: join(root, "a.json"), SEEN_FILE: join(root, "s.jsonl"), FEEDBACK_FILE: join(root, "f.jsonl") };
  const srv = spawn(process.execPath, [SERVE.pathname.replace(/^\/([A-Za-z]:)/, "$1")], { env, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  srv.stdout.on("data", (d) => (logs += d));
  srv.stderr.on("data", (d) => (logs += d));
  const open: WebSocket[] = [];
  try {
    for (let i = 0; i < 200 && !(await alive()); i++) await wait(100);
    // a frame that is not JSON
    const a = await socket("bad1");
    open.push(a.ws);
    if (a.open) a.ws.send("hi");
    await wait(700);
    check("a frame that is not JSON leaves the server up", a.open && (await alive()), JSON.stringify({ opened: a.open }));
    // a frame far past a signalling message's size: that socket closed, the server up
    const b = await socket("big1");
    open.push(b.ws);
    let closed = false;
    b.ws.addEventListener("close", () => (closed = true));
    if (b.open) b.ws.send(JSON.stringify({ type: "OFFER", dst: "x", payload: "x".repeat(200 * 1024) }));
    await wait(700);
    check("a frame past the size a message needs closes that socket, and the server stays up", b.open && closed && (await alive()), JSON.stringify({ opened: b.open, closed }));
    // one address: so many at once and no more
    const held = await Promise.all(Array.from({ length: 30 }, (_, i) => socket(`many${i}`)));
    for (const h of held) open.push(h.ws);
    const n = held.filter((h) => h.open).length;
    check("one address holds no more than its share of the broker's sockets (24), the rest refused", n >= 20 && n <= 24 && (await alive()), `${n} of 30 open`);
    // the boards: six new names from here today, a seventh refused, the first again taken
    const post = (name: string) => fetch(`http://127.0.0.1:${PORT}/api/board/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ board: "duel:wins", name, value: 1 }) }).then((r) => r.status, () => 0);
    const got = [];
    for (const name of ["FLOOD1", "FLOOD2", "FLOOD3", "FLOOD4", "FLOOD5", "FLOOD6", "FLOOD7", "FLOOD1"]) got.push(await post(name));
    check("an address puts no more than six new names on the boards in a day; a name already there still posts", got.join() === "200,200,200,200,200,200,429,200", got.join());
    for (const w of open.splice(0)) w.close();
    await wait(300);
    // (Milestone 936) a `dst` with no way to be a string, the broker's sweep 5 s on; a real offer to nobody still comes back
    const poison = await socket("dst1");
    open.push(poison.ws);
    const said: string[] = [];
    poison.ws.addEventListener("message", (e) => said.push(String(e.data)));
    if (poison.open) {
      poison.ws.send(JSON.stringify({ type: "OFFER", dst: { toString: 1, valueOf: 2 } }));
      poison.ws.send(JSON.stringify({ type: "OFFER", dst: "nobody", payload: {} }));
    }
    await wait(7000);
    check("a frame whose dst is no string leaves the server up past the broker's sweep", poison.open && (await alive()), JSON.stringify({ opened: poison.open, srv: srv.exitCode }));
    check("and an offer to nobody still comes back as EXPIRE", said.some((s) => s.includes("EXPIRE")), said.join(" ").slice(0, 120));
    // (Milestone 937) a socket past what signalling needs is dropped, the server up
    const fast = await socket("fast1");
    open.push(fast.ws);
    let cut = false;
    fast.ws.addEventListener("close", () => (cut = true));
    for (let i = 0; i < 12 && fast.open; i++) fast.ws.send(JSON.stringify({ type: "OFFER", dst: "nobody", payload: "x".repeat(60 * 1024) }));
    await wait(700);
    check("a socket sending far past signalling's bytes is dropped, the server up", fast.open && cut && (await alive()), JSON.stringify({ opened: fast.open, cut }));
    // (Milestone 937) a client's bad request is its own fault: no stack in the log
    const before = logs.length;
    const bad = await fetch(`http://127.0.0.1:${PORT}/api/seen`, { method: "POST", headers: { "content-type": "application/json", "content-encoding": "x" }, body: "{}" });
    const path = await fetch(`http://127.0.0.1:${PORT}/peerjs/%E0%A4%A`);
    await wait(200);
    const logged = logs.slice(before);
    check("a body in an encoding nobody reads and a path that is no path are refused, with no stack in the log", bad.status === 415 && path.status === 400 && logged.length === 0, JSON.stringify({ bad: bad.status, path: path.status, logged: logged.length }));
  } finally {
    for (const w of open) try { w.close(); } catch { /* gone */ }
    srv.kill();
    await wait(200);
    rmSync(root, { recursive: true, force: true });
  }

  // (Milestone 937) an accounts file that will not parse is kept, not overwritten by the next write
  const again = mkdtempSync(join(tmpdir(), "serve-broker-"));
  const spare = await freePort();
  const accountsAt = join(again, "a.json");
  writeFileSync(accountsAt, '{"users":{"a":{"name":"A"');
  mkdirSync(join(again, "site"), { recursive: true });
  writeFileSync(join(again, "site", "index.html"), "<!doctype html><title>t</title>");
  writeFileSync(join(again, "site", "version.txt"), "check");
  const srv2 = spawn(process.execPath, [SERVE.pathname.replace(/^\/([A-Za-z]:)/, "$1")], { env: { ...process.env, PORT: String(spare), HOST: "127.0.0.1", DIST: join(again, "site"), BOARD_FILE: join(again, "b.json"), ACCOUNT_FILE: accountsAt, SEEN_FILE: join(again, "s.jsonl"), FEEDBACK_FILE: join(again, "f.jsonl") }, stdio: "ignore" });
  try {
    for (let i = 0; i < 100 && !(await fetch(`http://127.0.0.1:${spare}/health`).then((r) => r.ok, () => false)); i++) await wait(100);
    const kept = readdirSync(again).find((f) => f.startsWith("a.json.bad-"));
    check("an accounts file that will not parse is kept beside itself", !!kept && readFileSync(join(again, kept), "utf8").startsWith('{"users"'), kept ?? "no copy");
  } finally {
    srv2.kill();
    await wait(200);
    rmSync(again, { recursive: true, force: true });
  }

  // what cannot be run here (a stop by signal is a kill on Windows; the budget and the day's limit take hours)
  const src = readFileSync(SERVE, "utf8");
  check("the profile budget counts bytes", /Buffer\.byteLength\(JSON\.stringify\(profile\)\)/.test(src));
  check("a stop writes again on the way out", /const out = \(\) => \{\s+flushBoards\(\);\s+flushAccounts\(\);\s+process\.exit\(0\);/.test(src) && /server\.close\(out\)/.test(src) && /setTimeout\(out, /.test(src));
  check("an address makes no more than NEW_ACCOUNTS_A_DAY accounts in a day", /from\.made >= NEW_ACCOUNTS_A_DAY/.test(src));
  check("each page's relay credential is its own, its quota with it", /TURN_TTL_S\}:\$\{randomBytes\(/.test(src));
  check("an address sends no more than FEEDBACK_A_DAY notes in a day", /\+\+day\.count > FEEDBACK_A_DAY/.test(src));
}

export const serveBrokerFails = fails;
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) process.exitCode = fails ? 1 : 0;
