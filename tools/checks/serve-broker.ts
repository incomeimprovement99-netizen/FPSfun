// The game server under bad clients. The broker (Milestone 730): one frame that was not JSON reached the broker's
// "error" with nobody listening, and the throw stopped the whole server (the site, the accounts and every match being
// made); a frame far past a signalling message's size is refused at the socket, and one address holds no more than so
// many sockets. The boards (Milestone 732): an address puts no more than six new names on them in a day, so a flood
// of made-up names cannot push every real result off a board's 100 places.
//
// The real server, run on a spare port over a made-up release.
//
// Run on its own: npx tsx tools/checks/serve-broker.ts.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const SERVE = new URL("../../server/game/serve.mjs", import.meta.url);
const PORT = 4131;
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
  const srv = spawn(process.execPath, [SERVE.pathname.replace(/^\/([A-Za-z]:)/, "$1")], { env, stdio: "ignore" });
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
  } finally {
    for (const w of open) try { w.close(); } catch { /* gone */ }
    srv.kill();
    await wait(200);
    rmSync(root, { recursive: true, force: true });
  }
}

export const serveBrokerFails = fails;
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) process.exitCode = fails ? 1 : 0;
