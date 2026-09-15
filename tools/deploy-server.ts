// Publish the game to our own server (docs/SERVER_GUIDE.md): build the public
// beta (codenames only, checked), pack it with server/game/, copy it to the box
// over ssh, install, swap it in, reload pm2, check /health, then play a 1v1 on
// the live URL through the site's own broker.
//
// `npm run fps <verb>` is the same tool (like Algonomics' `npm run prod`); on
// its own it is `health`, while `npm run deploy:server` on its own ships.
//
//   npm run fps deploy          build the LAST COMMIT (a clean copy, whatever is
//                               half-edited here is left out), ship, check
//                               (writes: a new release); `deploy local` ships this
//                               folder as it is instead
//   npm run fps dry             build this folder as it is and pack it, then unpack and
//                               run the release here on :4101 and play a 1v1 on it
//                               (everything but the ssh)
//   npm run fps check           from this PC: DNS, ssh, every firewall rule, /health
//                               and a real datagram through the relay (read-only)
//   npm run fps health          /health, pm2, coturn, caddy, memory, disk (read-only)
//   npm run fps logs            the last 60 lines of the server's log (read-only)
//   npm run fps backup          the boards and accounts down to server-backup/ (read-only)
//   npm run fps ssh             a shell on the box
//   npm run fps setup           one-time box setup (server/game/setup.sh; safe to rerun)
//   npm run fps restart         restart the game server, rereading range.env
//   npm run fps rollback        swap the previous release back in
//   npm run fps dns             point the DuckDNS name at RANGE_HOST (needs DUCKDNS_TOKEN)
//   npm run fps run "<cmd>"     any shell command on the box, in ~/range
//
// Settings, in the environment or a `.env.server` file at the repo root
// (KEY=VALUE lines, not in git):
//   RANGE_HOST     ssh target, e.g. ubuntu@1.2.3.4
//   RANGE_KEY      path to the ssh private key (optional if ssh already knows it)
//   RANGE_DOMAIN   the game's hostname, e.g. fpsfun.duckdns.org
//   DUCKDNS_TOKEN  optional, for `dns`: the token at the top of duckdns.org
import { execFileSync, execSync, spawn, spawnSync } from "node:child_process";
import { lookup } from "node:dns/promises";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stunBinding, tcpProbe, turnRelay } from "./net-probe";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
/** this PC's tar: Windows' own bsdtar by its full path (from Git Bash the PATH finds GNU tar first, which reads "C:\..." as a remote host) */
const TAR = process.platform === "win32" ? join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe") : "tar";
const envFile = join(ROOT, ".env.server");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?(.*?)"?\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
const HOST = process.env.RANGE_HOST ?? "";
const KEY = process.env.RANGE_KEY ?? "";
const DOMAIN = process.env.RANGE_DOMAIN ?? "";
const sshArgs = [...(KEY ? ["-i", KEY] : []), "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=15"];
/** the box's address, from RANGE_HOST (user@ip) */
const IP = HOST.replace(/^.*@/, "");
let keyChecked = false;
const needHost = () => {
  if (!HOST) {
    console.error("Set RANGE_HOST (e.g. ubuntu@1.2.3.4), and RANGE_KEY / RANGE_DOMAIN, in .env.server or the environment. See docs/SERVER_GUIDE.md.");
    process.exit(1);
  }
  if (!keyChecked) {
    keyChecked = true;
    tightenKey();
  }
};
/** Windows' ssh refuses a key other users can read ("UNPROTECTED PRIVATE KEY FILE"); a fresh download can be one */
function tightenKey(): void {
  if (process.platform !== "win32" || !KEY || !existsSync(KEY)) return;
  const acl = execFileSync("icacls", [KEY], { encoding: "utf8" });
  if (!/Everyone|Authenticated Users|BUILTIN\\Users/i.test(acl)) return;
  execFileSync("icacls", [KEY, "/inheritance:r", "/grant:r", `${process.env.USERNAME}:R`], { stdio: "ignore" });
  console.log(`(the key file was readable by other users, which ssh refuses; it is now yours only)`);
}
/** Windows' own OpenSSH by its full path, for the same reason as TAR (Git Bash's scp reads "C:\..." as a host) and because tightenKey fixes the permissions that one checks */
const openssh = (exe: string) => {
  const p = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "OpenSSH", `${exe}.exe`);
  return process.platform === "win32" && existsSync(p) ? p : exe;
};
const SSH = openssh("ssh");
const SCP = openssh("scp");
const ssh = (cmd: string) => (needHost(), execFileSync(SSH, [...sshArgs, HOST, cmd], { stdio: "inherit" }));
const sshOut = (cmd: string) => (needHost(), execFileSync(SSH, [...sshArgs, HOST, cmd], { encoding: "utf8" }));
const scp = (from: string, to: string) => (needHost(), execFileSync(SCP, [...sshArgs, from, `${HOST}:${to}`], { stdio: "inherit" }));
const scpDown = (from: string, to: string) => (needHost(), execFileSync(SCP, [...sshArgs, `${HOST}:${from}`, to], { stdio: "inherit" }));
const out = (cmd: string) => execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A clean copy of the last commit to build a release from, so a deploy ships
 * exactly what is committed even while someone (another agent, say) is halfway
 * through an edit in this folder: `git archive HEAD`, the fetched assets git
 * ignores (public/tex, models, audio) copied in, and a junction to this
 * folder's node_modules. dropSnapshot() removes it.
 */
function snapshot(): string {
  const dir = mkdtempSync(join(tmpdir(), "range-head-"));
  const tar = `${dir}.tar`;
  execFileSync("git", ["archive", "--format=tar", "-o", tar, "HEAD"], { cwd: ROOT });
  execFileSync(TAR, ["-xf", tar, "-C", dir]);
  rmSync(tar, { force: true });
  for (const f of execFileSync("git", ["ls-files", "-o", "-i", "--exclude-standard", "-z", "--", "public"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean)) {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    cpSync(join(ROOT, f), join(dir, f));
  }
  symlinkSync(join(ROOT, "node_modules"), join(dir, "node_modules"), "junction");
  return dir;
}
function dropSnapshot(dir: string): void {
  // the junction first, by itself, so nothing can ever walk into the real node_modules
  unlinkSync(join(dir, "node_modules"));
  rmSync(dir, { recursive: true, force: true });
}

/** build the public beta in `src` (this folder, or a snapshot of the last commit) and pack site/ + server/ into one tarball; returns its path and the version stamp */
function pack(src = ROOT): { tgz: string; version: string } {
  console.log(`\n== building the public beta${src === ROOT ? " from this folder as it is" : " from the last commit"}`);
  execSync("npm run build:beta", { cwd: src, stdio: "inherit" });
  const sha = out("git rev-parse --short HEAD");
  const dirty = src === ROOT && out("git status --porcelain") ? "+local" : "";
  const version = `${sha}${dirty} ${new Date().toISOString().slice(0, 16)}Z`;
  writeFileSync(join(src, "dist", "version.txt"), `${version}\n`);
  const stage = mkdtempSync(join(tmpdir(), "range-release-"));
  try {
    cpSync(join(src, "dist"), join(stage, "site"), { recursive: true });
    mkdirSync(join(stage, "server"));
    for (const f of ["serve.mjs", "package.json", "package-lock.json", "ecosystem.config.cjs", "setup.sh"]) {
      cpSync(join(src, "server", "game", f), join(stage, "server", f));
    }
    const tgz = join(tmpdir(), `range-release-${Date.now()}.tgz`);
    // Windows' own tar (bsdtar), by its full path: from Git Bash the PATH finds GNU tar first, which reads
    // "C:\..." as a remote host and fails; -C keeps the paths relative
    execFileSync(TAR, ["-czf", tgz, "-C", stage, "site", "server"], { stdio: "inherit" });
    return { tgz, version };
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

/** the online boards' rules, against a throwaway server (the dry run's): never a live one */
async function boardCheck(origin: string): Promise<void> {
  const post = (b: unknown) => fetch(`${origin}/api/board/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
  const top = async (board: string) => ((await (await fetch(`${origin}/api/board/top?board=${board}`)).json()) as { entries: Array<{ name: string; value: number }> }).entries;
  const fails: string[] = [];
  const expect = (label: string, ok: boolean) => {
    console.log(`${ok ? "  ok  " : "FAIL  "}boards: ${label}`);
    if (!ok) fails.push(label);
  };
  expect("a course time is taken", (await post({ board: "course:basic", name: "DRY A", value: 61.5 })).ok);
  await post({ board: "course:basic", name: "DRY B", value: 58.25 });
  await post({ board: "course:basic", name: "DRY A", value: 70 }); // worse: kept at 61.5
  const t = await top("course:basic");
  expect("lower is better, one entry per name, the best kept", t[0]?.name === "DRY B" && t[1]?.name === "DRY A" && t[1]?.value === 61.5);
  await post({ board: "duel:wins", name: "DRY A", value: 3 });
  await post({ board: "duel:wins", name: "DRY B", value: 7 });
  expect("higher is better for wins", (await top("duel:wins"))[0]?.name === "DRY B");
  expect("an unknown board is refused", (await post({ board: "course:nope", name: "DRY A", value: 60 })).status === 400);
  expect("a name with markup is refused", (await post({ board: "course:basic", name: "<img src=x>", value: 60 })).status === 400);
  expect("a 2 s course time is refused", (await post({ board: "course:basic", name: "DRY C", value: 2 })).status === 400);
  expect("a null body is refused, not a crash", (await post(null)).status === 400);
  let limited = false;
  for (let i = 0; i < 40 && !limited; i++) limited = (await post({ board: "duel:wins", name: "DRY A", value: 1 })).status === 429;
  expect("posting is rate limited", limited);
  if (fails.length) throw new Error(`board checks failed: ${fails.join("; ")}`);
}

/** the accounts' rules, against the dry run's throwaway server: never a live one */
async function accountCheck(origin: string): Promise<void> {
  const call = async (path: string, method: string, body?: unknown, token?: string) => {
    const r = await fetch(`${origin}/api/account/${path}`, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, json: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  };
  const fails: string[] = [];
  const expect = (label: string, ok: boolean) => {
    console.log(`${ok ? "  ok  " : "FAIL  "}accounts: ${label}`);
    if (!ok) fails.push(label);
  };
  const net = (await (await fetch(`${origin}/net.json`)).json()) as { account?: string };
  expect("/net.json says where the accounts are", net.account === "/api/account");
  const reg = await call("register", "POST", { name: "Dry Tester", password: "correct horse" });
  expect("sign up: a name and a password give a session", reg.status === 200 && typeof reg.json.token === "string" && (reg.json.token as string).length === 64);
  expect("the same name in another case is taken", (await call("register", "POST", { name: "dry tester", password: "another one" })).status === 409);
  expect("a short password is refused", (await call("register", "POST", { name: "Dry Two", password: "short" })).status === 400);
  expect("a name with markup is refused", (await call("register", "POST", { name: "<b>x</b>", password: "long enough" })).status === 400);
  expect("a wrong password is refused", (await call("login", "POST", { name: "Dry Tester", password: "wrong horse" })).status === 401);
  expect("an unknown name gets the same answer", (await call("login", "POST", { name: "Nobody Here", password: "whatever12" })).status === 401);
  const login = await call("login", "POST", { name: "dry tester", password: "correct horse" });
  const token = login.json.token as string;
  expect("sign in (any case) gives a new session", login.status === 200 && typeof token === "string" && token !== reg.json.token);
  const put = await call("profile", "PUT", { profile: { "range.profile": "{\"name\":\"Dry Tester\"}", "range.sens": "1.2" } }, token);
  expect("the profile is saved", put.status === 200 && typeof put.json.updated === "string");
  const got = await call("profile", "GET", undefined, token);
  expect("and comes back as it went", got.status === 200 && (got.json.profile as Record<string, string>)?.["range.sens"] === "1.2");
  expect("no token, no profile", (await call("profile", "GET")).status === 401);
  expect("a profile that is not an object is refused", (await call("profile", "PUT", { profile: [1, 2] }, token)).status === 400);
  await call("logout", "POST", undefined, token);
  expect("signed out, the token is dead", (await call("profile", "GET", undefined, token)).status === 401);
  // a name every JavaScript object has is only a name (it used to crash the server)
  expect("signing in as \"constructor\" is a wrong name, not a crash", (await call("login", "POST", { name: "constructor", password: "whatever12" })).status === 401);
  const health = await fetch(`${origin}/health`).then((r) => r.ok, () => false);
  expect("and the server is still up", health);
  let limited = false;
  for (let i = 0; i < 14 && !limited; i++) limited = (await call("login", "POST", { name: "Dry Tester", password: "guess guess" + i })).status === 429;
  expect("guessing passwords is rate limited", limited);
  if (fails.length) throw new Error(`account checks failed: ${fails.join("; ")}`);
}

function liveCheck(url: string, accounts = false): void {
  execSync("npx tsx tools/live-check.ts", { cwd: ROOT, stdio: "inherit", env: { ...process.env, LIVE_URL: url, BROKER: "own", ACCOUNTS_TEST: accounts ? "1" : "" } });
}

/**
 * Everything a player's browser needs, probed from this PC the way a stranger
 * would reach the box, each failure with its fix. Read-only: the relay test
 * takes one allocation and gives it back.
 */
async function check(): Promise<void> {
  needHost();
  let fails = 0;
  const line = (ok: boolean, label: string, fix: string) => {
    console.log(`${ok ? "  ok  " : "FAIL  "}${label}${ok ? "" : `\n        -> ${fix}`}`);
    if (!ok) fails++;
  };
  const upFix = "the cloud lets it through, the box does not answer yet: npm run fps setup, then npm run fps deploy";
  const tcp = async (port: number, what: string) => {
    const s = await tcpProbe(IP, port);
    line(s === "open", `TCP ${port}, ${what}: ${s}`, s === "timeout" ? `the Oracle security list needs an ingress rule: TCP, source 0.0.0.0/0, port ${port}` : upFix);
  };
  console.log(`== ${DOMAIN || "(no RANGE_DOMAIN)"} on ${IP}, from this PC\n`);
  if (KEY) line(existsSync(KEY), `the key file is there (${KEY})`, "RANGE_KEY in .env.server: the private key Oracle gave you for this VM");
  if (DOMAIN) {
    const got = await lookup(DOMAIN, { family: 4 }).then((r) => r.address, () => "nothing");
    line(got === IP, `${DOMAIN} points at ${got}`, `duckdns.org: ${IP} in the ${DOMAIN.split(".")[0]} row, then "update ip" (or npm run fps dns); it can take a minute`);
  } else line(false, "RANGE_DOMAIN is set", "RANGE_DOMAIN=fpsfun.duckdns.org in .env.server");
  const login = spawnSync(SSH, [...sshArgs, "-o", "BatchMode=yes", HOST, "echo ok"], { encoding: "utf8" });
  const why = (login.stderr ?? "").trim().split(/\r?\n/).filter((l) => !/^Warning: Permanently added/.test(l)).pop() ?? "";
  line(login.stdout?.trim() === "ok", `ssh ${HOST}`, `${why || "no answer"} (RANGE_HOST is ubuntu@<the VM's public IP>, RANGE_KEY the key downloaded with that VM)`);
  await tcp(80, "the site, and HTTPS certificates");
  await tcp(443, "the site");
  await tcp(3478, "the relay over TCP");
  const stun = await stunBinding(IP, 3478).catch(() => null);
  line(Boolean(stun), `UDP 3478, the relay: ${stun ? `answers (sees this PC as ${stun.ip})` : "no answer"}`, "the Oracle security list needs UDP 3478 from 0.0.0.0/0 (or coturn is down: npm run fps health)");

  const get = (path: string) => fetch(`https://${DOMAIN}${path}`, { signal: AbortSignal.timeout(10000) }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));
  const health = (await get("/health").catch((e: Error) => ({ error: e.cause instanceof Error ? e.cause.message : e.message }))) as { ok?: boolean; version?: string; turn?: boolean; error?: string };
  line(health.ok === true, `https://${DOMAIN}/health: ${health.ok ? `release ${health.version}` : health.error}`, "npm run fps setup (Caddy and the certificate), then npm run fps deploy (the game)");
  if (health.ok) {
    const net = (await get("/net.json").catch(() => ({}))) as { iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }> };
    const turn = net.iceServers?.find((s) => s.username && s.credential);
    if (!turn) line(false, "the site hands out relay credentials", "TURN_SECRET is missing from ~/range/range.env: npm run fps setup, then npm run fps restart");
    else {
      const relay = await turnRelay(IP, 3478, turn.username!, turn.credential!).catch((e: Error) => ({ ok: false, detail: e.message }));
      line(relay.ok, `the relay carries a match: ${relay.ok ? relay.detail : "no"}`, relay.detail);
    }
  }
  console.log(fails ? `\n== ${fails} to fix (each has its fix under it)` : `\n== all good: https://${DOMAIN}/ works for friends on any network`);
  if (fails) process.exitCode = 1;
}

async function main(): Promise<void> {
  // `npm run fps` on its own looks; `npm run deploy:server` on its own ships (as it always has)
  const verb = process.argv[2] ?? (process.env.npm_lifecycle_event === "fps" ? "health" : "deploy");
  if (verb === "setup") {
    if (!DOMAIN) throw new Error("setup needs RANGE_DOMAIN (the game's hostname)");
    ssh("mkdir -p ~/range");
    scp(join(ROOT, "server", "game", "setup.sh"), "range/setup.sh");
    ssh(`bash ~/range/setup.sh ${DOMAIN}`);
    console.log("\nNext: npm run fps deploy (the game), then npm run fps check (everything, from outside)");
  } else if (verb === "check") {
    await check();
  } else if (verb === "health") {
    ssh("curl -fsS localhost:4100/health; echo; pm2 ls; systemctl is-active coturn caddy; free -m | head -2; df -h / | tail -1");
  } else if (verb === "ssh") {
    needHost();
    spawnSync(SSH, [...sshArgs, HOST], { stdio: "inherit" });
  } else if (verb === "restart") {
    ssh("pm2 startOrReload ~/range/app/server/ecosystem.config.cjs --update-env && pm2 save >/dev/null; sleep 1; curl -fsS localhost:4100/health; echo");
  } else if (verb === "backup") {
    const have = sshOut("cd ~/range && ls boards.json accounts.json 2>/dev/null || true").split(/\s+/).filter(Boolean);
    if (!have.length) return console.log("nothing to save yet: no boards or accounts on the box");
    const dir = join(ROOT, "server-backup", new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-"));
    mkdirSync(dir, { recursive: true });
    for (const f of have) scpDown(`range/${f}`, join(dir, f));
    console.log(`saved ${have.join(" and ")} to ${dir}`);
  } else if (verb === "dns") {
    needHost();
    const token = process.env.DUCKDNS_TOKEN;
    if (!token) throw new Error("dns needs DUCKDNS_TOKEN in .env.server: the token shown at the top of duckdns.org when signed in");
    if (!DOMAIN.endsWith(".duckdns.org")) throw new Error(`dns only knows DuckDNS names, and RANGE_DOMAIN is ${DOMAIN || "not set"}`);
    const sub = DOMAIN.slice(0, -".duckdns.org".length);
    const said = (await (await fetch(`https://www.duckdns.org/update?domains=${sub}&token=${encodeURIComponent(token)}&ip=${IP}`)).text()).trim();
    if (said !== "OK") throw new Error(`DuckDNS said ${said}: a wrong token, or ${sub} is not on that account`);
    console.log(`${DOMAIN} -> ${IP} (lookups can take a minute to catch up)`);
  } else if (verb === "run") {
    const cmd = process.argv.slice(3).join(" ").trim();
    if (!cmd) throw new Error('run needs a command: npm run fps run "pm2 ls"');
    // in ~/range once setup has made it, the home directory before
    ssh(`cd ~/range 2>/dev/null || cd; ${cmd}`);
  } else if (verb === "logs") {
    ssh("pm2 logs range --lines 60 --nostream");
  } else if (verb === "rollback") {
    ssh(
      "set -e; cd ~/range; test -d prev || { echo 'no previous release'; exit 1; }; " +
        "mv app failed; mv prev app; mv failed prev; " +
        "pm2 startOrReload app/server/ecosystem.config.cjs --update-env && pm2 save >/dev/null; sleep 1; curl -fsS localhost:4100/health; echo"
    );
  } else if (verb === "dry") {
    // the release as the box would get it, unpacked and run here
    const { tgz, version } = pack();
    const box = mkdtempSync(join(tmpdir(), "range-box-"));
    const app = join(box, "app");
    mkdirSync(app);
    execFileSync(TAR, ["-xzf", tgz, "-C", app], { stdio: "inherit" });
    rmSync(tgz, { force: true });
    execSync("npm ci --omit=dev --no-audit --no-fund --loglevel=error", { cwd: join(app, "server"), stdio: "inherit" });
    // what pm2 would run: the ecosystem file's env, on another port
    const cfg = (await import(`file:///${join(app, "server", "ecosystem.config.cjs").replace(/\\/g, "/")}`)).default.apps[0];
    const srv = spawn(process.execPath, [cfg.script], { cwd: cfg.cwd, env: { ...process.env, ...cfg.env, PORT: "4101", TURN_SECRET: "dry-run" }, stdio: "inherit" });
    try {
      await sleep(1500);
      const health = (await (await fetch("http://127.0.0.1:4101/health")).json()) as { version: string };
      if (health.version !== version) throw new Error(`/health says ${health.version}, the release is ${version}`);
      console.log(`\n== the unpacked release answers /health as ${version}`);
      await boardCheck("http://127.0.0.1:4101");
      // (the dry run's server is thrown away after: the page may make an account on it; the page's
      // sign-up goes first, as the account checks end by using up this address's tries)
      liveCheck("http://localhost:4101/", true);
      await accountCheck("http://127.0.0.1:4101");
      console.log("\n== DRY RUN PASS: the release installs, starts and hosts a 1v1 through its own broker");
    } finally {
      srv.kill();
      await sleep(500);
      rmSync(box, { recursive: true, force: true });
    }
  } else if (verb === "deploy") {
    needHost();
    // the last commit, built from a clean copy; `deploy local` ships this folder as it is, uncommitted edits and all
    const local = process.argv[3] === "local";
    if (!local) {
      console.log(`== deploying the last commit: ${execFileSync("git", ["log", "-1", "--format=%h %s"], { cwd: ROOT, encoding: "utf8" }).trim()}`);
      const ahead = spawnSync("git", ["rev-list", "--count", "origin/main..HEAD"], { cwd: ROOT, encoding: "utf8" });
      if (ahead.status === 0 && ahead.stdout.trim() !== "0") console.log(`   (${ahead.stdout.trim()} of them not pushed to origin/main yet)`);
      if (out("git status --porcelain")) console.log("   (this folder has uncommitted changes, which this release leaves out: commit them first, or npm run fps deploy local)");
    }
    const src = local ? ROOT : snapshot();
    let packed: { tgz: string; version: string };
    try {
      packed = pack(src);
    } finally {
      if (!local) dropSnapshot(src);
    }
    const { tgz, version } = packed;
    console.log(`\n== shipping ${version} to ${HOST}`);
    ssh("mkdir -p ~/range");
    scp(tgz, "range/incoming.tgz");
    rmSync(tgz, { force: true });
    ssh(
      [
        "set -e",
        "cd ~/range",
        "rm -rf next && mkdir next && tar -xzf incoming.tgz -C next && rm incoming.tgz",
        "cd next/server && npm ci --omit=dev --no-audit --no-fund --loglevel=error && cd ~/range",
        "rm -rf prev; if [ -d app ]; then mv app prev; fi; mv next app",
        "pm2 startOrReload app/server/ecosystem.config.cjs --update-env && pm2 save >/dev/null",
        "sleep 1",
        "curl -fsS localhost:4100/health; echo",
      ].join("; ")
    );
    if (DOMAIN) {
      console.log(`\n== playing a 1v1 on https://${DOMAIN}/ through its own broker`);
      liveCheck(`https://${DOMAIN}/`);
      console.log(`\n== live at https://${DOMAIN}/ (npm run fps check probes it from outside)`);
    }
  } else {
    console.error(`unknown: ${verb} (deploy, dry, check, health, logs, backup, ssh, setup, restart, rollback, dns, run)`);
    process.exit(1);
  }
}
void main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
