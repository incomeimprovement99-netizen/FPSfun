// Publish the game to our own server (docs/SERVER_GUIDE.md): build the public
// beta (codenames only, checked), pack it with server/game/, copy it to the box
// over ssh, install, swap it in, reload pm2, check /health, then play a 1v1 on
// the live URL through the site's own broker.
//
//   npm run deploy:server                  build, ship, check
//   npm run deploy:server -- dry           build and pack, then unpack and run the
//                                          release here on :4101 and play a 1v1 on
//                                          it (everything but the ssh)
//   npm run deploy:server -- setup         one-time box setup (server/game/setup.sh)
//   npm run deploy:server -- health        /health, pm2, coturn and caddy on the box
//   npm run deploy:server -- logs          the last 60 lines of the server's log
//   npm run deploy:server -- rollback      swap the previous release back in
//
// Settings, in the environment or a `.env.server` file at the repo root
// (KEY=VALUE lines, not in git):
//   RANGE_HOST    ssh target, e.g. ubuntu@1.2.3.4
//   RANGE_KEY     path to the ssh private key (optional if ssh already knows it)
//   RANGE_DOMAIN  the game's hostname, e.g. fpsfun.duckdns.org
import { execFileSync, execSync, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
const needHost = () => {
  if (HOST) return;
  console.error("Set RANGE_HOST (e.g. ubuntu@1.2.3.4), and RANGE_KEY / RANGE_DOMAIN, in .env.server or the environment. See docs/SERVER_GUIDE.md.");
  process.exit(1);
};
const ssh = (cmd: string) => (needHost(), execFileSync("ssh", [...sshArgs, HOST, cmd], { stdio: "inherit" }));
const scp = (from: string, to: string) => (needHost(), execFileSync("scp", [...sshArgs, from, `${HOST}:${to}`], { stdio: "inherit" }));
const out = (cmd: string) => execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** build the public beta and pack site/ + server/ into one tarball; returns its path and the version stamp */
function pack(): { tgz: string; version: string } {
  console.log("\n== building the public beta");
  execSync("npm run build:beta", { cwd: ROOT, stdio: "inherit" });
  const sha = out("git rev-parse --short HEAD");
  const dirty = out("git status --porcelain") ? "+local" : "";
  const version = `${sha}${dirty} ${new Date().toISOString().slice(0, 16)}Z`;
  writeFileSync(join(ROOT, "dist", "version.txt"), `${version}\n`);
  const stage = mkdtempSync(join(tmpdir(), "range-release-"));
  try {
    cpSync(join(ROOT, "dist"), join(stage, "site"), { recursive: true });
    mkdirSync(join(stage, "server"));
    for (const f of ["serve.mjs", "package.json", "package-lock.json", "ecosystem.config.cjs", "setup.sh"]) {
      cpSync(join(ROOT, "server", "game", f), join(stage, "server", f));
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
  let limited = false;
  for (let i = 0; i < 14 && !limited; i++) limited = (await call("login", "POST", { name: "Dry Tester", password: "guess guess" + i })).status === 429;
  expect("guessing passwords is rate limited", limited);
  if (fails.length) throw new Error(`account checks failed: ${fails.join("; ")}`);
}

function liveCheck(url: string, accounts = false): void {
  execSync("npx tsx tools/live-check.ts", { cwd: ROOT, stdio: "inherit", env: { ...process.env, LIVE_URL: url, BROKER: "own", ...(accounts ? { ACCOUNTS_TEST: "1" } : {}) } });
}

async function main(): Promise<void> {
  const verb = process.argv[2] ?? "deploy";
  if (verb === "setup") {
    if (!DOMAIN) throw new Error("setup needs RANGE_DOMAIN (the game's hostname)");
    ssh("mkdir -p ~/range");
    scp(join(ROOT, "server", "game", "setup.sh"), "range/setup.sh");
    ssh(`bash ~/range/setup.sh ${DOMAIN}`);
  } else if (verb === "health") {
    ssh("curl -fsS localhost:4100/health; echo; pm2 ls; systemctl is-active coturn caddy");
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
    const { tgz, version } = pack();
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
      console.log(`\n== live at https://${DOMAIN}/`);
    }
  } else {
    console.error(`unknown: ${verb} (deploy, dry, setup, health, logs, rollback)`);
    process.exit(1);
  }
}
void main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
