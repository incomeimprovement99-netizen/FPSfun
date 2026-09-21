// The game's own server: one Node process that
//
//   1. serves the public build (`dist/`, built with `npm run build:beta`),
//   2. runs our own PeerJS broker at /peerjs, so match codes never depend on
//      the free public one (0.peerjs.com),
//   3. answers /net.json with the broker's path and the ICE servers, including
//      short-lived credentials for our TURN relay (coturn) when TURN_SECRET is
//      set, so players on networks that block direct connections still meet,
//   4. keeps the online boards (/api/board: best course times and match
//      wins by name) in a JSON file that survives deploys,
//   5. keeps optional accounts (/api/account: a name and a password, hashed
//      with scrypt; a session token; the player's saved settings, stats and
//      loadouts, synced between browsers), in a JSON file that survives deploys,
//   6. answers /health for the deploy script.
//
// The game reads /net.json when a match is made or joined (src/net/link.ts). On
// a host without this server (GitHub Pages) the file is missing and the game
// falls back to the public broker, so the same build works on both.
//
// Behind Caddy for HTTPS (docs/SERVER_GUIDE.md). Plain JavaScript on purpose:
// the box runs it with `node serve.mjs`, no build step.
//
// Environment (all optional):
//   PORT          default 4100
//   HOST          default 127.0.0.1 (Caddy in front); 0.0.0.0 to expose it
//   DIST          the built site, default ../../dist next to this file
//   TURN_SECRET   coturn's static-auth-secret; no TURN is offered without it
//   TURN_HOST     the relay's public hostname, default the request's host
//   TURN_PORT     default 3478
//   PEER_KEY      the broker key the game must send, default "range"
//   BOARD_FILE    where the boards are kept, default boards.json next to this file
//   ACCOUNT_FILE  where the accounts are kept, default accounts.json next to this file
//   VERSION       shown on /health, default the build stamp in dist/version.txt
import { nextBoardValue } from "./boardrules.mjs";
import express from "express";
import { ExpressPeerServer } from "peer";
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4100);
const HOST = process.env.HOST ?? "127.0.0.1";
const DIST = resolve(process.env.DIST ?? join(here, "..", "..", "dist"));
const TURN_SECRET = process.env.TURN_SECRET ?? "";
const TURN_PORT = Number(process.env.TURN_PORT ?? 3478);
const PEER_KEY = process.env.PEER_KEY ?? "range";
/** a TURN credential lives this long; a match that outlives it keeps its relay, only new allocations need a fresh one */
const TURN_TTL_S = 12 * 3600;

if (!existsSync(join(DIST, "index.html"))) {
  console.error(`no built site at ${DIST} (run npm run build:beta, or set DIST)`);
  process.exit(1);
}
const version =
  process.env.VERSION ?? (existsSync(join(DIST, "version.txt")) ? readFileSync(join(DIST, "version.txt"), "utf8").trim() : "unknown");

const app = express();
app.disable("x-powered-by");
// Caddy is the only thing that talks to us; trust its X-Forwarded-* headers
app.set("trust proxy", "loopback");

let peers = 0;
const started = Date.now();

app.get("/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, version, peers, turn: Boolean(TURN_SECRET), upSeconds: Math.round((Date.now() - started) / 1000) });
});

// the connection settings for the game; TURN credentials in the coturn REST
// format (use-auth-secret): username "<expiry>:range", password
// base64(HMAC-SHA1(secret, username))
app.get("/net.json", (req, res) => {
  res.set("Cache-Control", "no-store");
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
  if (TURN_SECRET) {
    const host = process.env.TURN_HOST ?? req.hostname;
    const username = `${Math.floor(Date.now() / 1000) + TURN_TTL_S}:range`;
    const credential = createHmac("sha1", TURN_SECRET).update(username).digest("base64");
    iceServers.push(
      { urls: `stun:${host}:${TURN_PORT}` },
      { urls: [`turn:${host}:${TURN_PORT}?transport=udp`, `turn:${host}:${TURN_PORT}?transport=tcp`], username, credential }
    );
  }
  res.json({ v: 1, peer: { path: "/peerjs/", key: PEER_KEY }, iceServers, board: "/api/board", account: "/api/account" });
});

// ---------- the online boards ----------
// One entry per name per board, the best kept, 100 per board. The game posts a
// course time when a run finishes and its win count when a match is won (the
// same contract as server/leaderboard/worker.ts). Anyone can post any number:
// the browser is the only witness, so these are boards between friends, not
// ranked play (that needs the game server of NEXT_STEPS).
const BOARD_FILE = resolve(process.env.BOARD_FILE ?? join(here, "boards.json"));
const BOARD_IDS = new Set(["course:basic", "course:advanced", "course:drill", "duel:wins", "triple:wins", "br:wins", "gunrun:wins", "tdm:wins", "crown:wins", "control:wins", "ffa:wins", "bots:easy:wins", "bots:normal:wins", "bots:hard:wins", "bots:elite:wins", "bots:mixed:wins", "match:kills", "match:damage"]);
const LOWER_IS_BETTER = /^course:/;
const NAME = /^[A-Za-z0-9_ .-]{1,16}$/;
const MAX_ENTRIES = 100;
/** @type {Record<string, Array<{ name: string; value: number; at: string }>>} */
let boards = {};
try {
  if (existsSync(BOARD_FILE)) boards = JSON.parse(readFileSync(BOARD_FILE, "utf8"));
} catch (e) {
  console.error(`boards: could not read ${BOARD_FILE}, starting empty (${e})`);
}
let boardsDirty = false;
/** write to a temp file and rename, so a crash mid-write never leaves half a file */
const flushBoards = () => {
  if (!boardsDirty) return;
  boardsDirty = false;
  try {
    writeFileSync(`${BOARD_FILE}.tmp`, JSON.stringify(boards));
    renameSync(`${BOARD_FILE}.tmp`, BOARD_FILE);
  } catch (e) {
    boardsDirty = true;
    console.error(`boards: write failed (${e})`);
  }
};
setInterval(flushBoards, 5000).unref();

// 30 posts per 10 minutes per address: a match or a run is minutes long
const posts = new Map();
const POST_LIMIT = 30;
const POST_WINDOW_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [ip, p] of posts) if (p.resetAt < now) posts.delete(ip);
}, POST_WINDOW_MS).unref();

app.get("/api/board/top", (req, res) => {
  res.set("Cache-Control", "no-store");
  const board = String(req.query.board ?? "");
  if (!BOARD_IDS.has(board)) return res.status(400).json({ error: "bad board" });
  const n = Math.max(1, Math.min(100, Number(req.query.n) || 20));
  res.json({ board, entries: (boards[board] ?? []).slice(0, n) });
});

app.post("/api/board/submit", express.json({ limit: "2kb" }), (req, res) => {
  const now = Date.now();
  const ip = req.ip ?? "?";
  const p = posts.get(ip) ?? { count: 0, resetAt: now + POST_WINDOW_MS };
  if (p.resetAt < now) Object.assign(p, { count: 0, resetAt: now + POST_WINDOW_MS });
  if (++p.count > POST_LIMIT) return res.status(429).json({ error: "slow down" });
  posts.set(ip, p);
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const { board, value } = body;
  let { name } = body;
  if (typeof board !== "string" || !BOARD_IDS.has(board)) return res.status(400).json({ error: "bad board" });
  // Who a result is from. It used to be whatever name the post carried, so
  // anyone could post under anyone's name, a registered player's included, and
  // overwrite their entry. Signed in, a result goes under the account's own
  // name whatever the post says. Not signed in, a result may not use a name an
  // account owns: those names are reserved for the account.
  const who = userOf(req);
  if (who) name = who.user.name;
  else if (typeof name === "string" && userAt(name.toLowerCase())) return res.status(403).json({ error: "that name belongs to an account: sign in to post under it" });
  if (typeof name !== "string" || !NAME.test(name)) return res.status(400).json({ error: "bad name" });
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1e5) return res.status(400).json({ error: "bad value" });
  const lower = LOWER_IS_BETTER.test(board);
  const entries = (boards[board] ??= []);
  const mine = entries.find((e) => e.name === name);
  // what the board keeps: a time's best, or wins one more at most (boardrules.mjs)
  const kept = nextBoardValue(lower, mine?.value, value, board);
  if (kept === null) return res.status(400).json({ error: "bad value" });
  if (mine) {
    if (kept === mine.value) return res.json({ ok: true, rank: entries.indexOf(mine) + 1 });
    mine.value = kept;
    mine.at = new Date().toISOString();
  } else entries.push({ name, value: kept, at: new Date().toISOString() });
  entries.sort((a, b) => (lower ? a.value - b.value : b.value - a.value));
  entries.length = Math.min(entries.length, MAX_ENTRIES);
  boardsDirty = true;
  const rank = entries.findIndex((e) => e.name === name) + 1;
  res.json({ ok: true, rank: rank || null });
});

// ---------- accounts (optional: nobody needs one to play) ----------
// A name (the boards' rules: 1 to 16 of letters, digits, space, _ . -; unique
// whatever its case) and a password of 8 to 128 characters, kept only as an
// scrypt hash with its own salt. Signing up or in gives a random session
// token, good for 30 days, sent back as "Authorization: Bearer <token>". The
// profile is the game's own saved data (settings, binds, stats, loadouts), up
// to 256 KB of JSON, stored as it comes: the game decides what goes in it.
const ACCOUNT_FILE = resolve(process.env.ACCOUNT_FILE ?? join(here, "accounts.json"));
const SESSION_DAYS = 30;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const PROFILE_MAX = 128 * 1024;
// Both tables have no prototype: a name like "constructor" or "__proto__" is a
// key like any other, not something every object already has.
/** @type {{ users: Record<string, { name: string; salt: string; hash: string; created: string; profile: unknown; updated: string | null; saves?: number[] }>; sessions: Record<string, { user: string; expires: number }> }} */
let accounts = { users: Object.create(null), sessions: Object.create(null) };
try {
  if (existsSync(ACCOUNT_FILE)) {
    const saved = JSON.parse(readFileSync(ACCOUNT_FILE, "utf8"));
    accounts = { users: Object.assign(Object.create(null), saved.users), sessions: Object.assign(Object.create(null), saved.sessions) };
  }
} catch (e) {
  console.error(`accounts: could not read ${ACCOUNT_FILE}, starting empty (${e})`);
}
/** a user by key, only if it is one (never anything inherited) */
const userAt = (key) => (Object.hasOwn(accounts.users, key) ? accounts.users[key] : undefined);
// the file's size is bounded: this many accounts, profiles this big, this many profile saves a user per 10 minutes
const MAX_ACCOUNTS = 5000;
const SAVE_LIMIT = 40;
/** an async handler whose failure is a plain 500, not a crash of the whole server */
const safe = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(`accounts: ${req.path}: ${e}`);
    if (!res.headersSent) res.status(500).json({ error: "server error" });
  });
let accountsDirty = false;
const flushAccounts = () => {
  if (!accountsDirty) return;
  accountsDirty = false;
  try {
    writeFileSync(`${ACCOUNT_FILE}.tmp`, JSON.stringify(accounts));
    renameSync(`${ACCOUNT_FILE}.tmp`, ACCOUNT_FILE);
  } catch (e) {
    accountsDirty = true;
    console.error(`accounts: write failed (${e})`);
  }
};
setInterval(flushAccounts, 3000).unref();
setInterval(() => {
  const now = Date.now();
  for (const [t, s] of Object.entries(accounts.sessions)) if (s.expires < now) delete accounts.sessions[t];
  accountsDirty = true;
}, 3600 * 1000).unref();

/** scrypt, the way Node does it, as a promise: 64 bytes, N = 16384 */
const hashOf = (password, salt) =>
  new Promise((ok, fail) => scrypt(password, Buffer.from(salt, "hex"), 64, { N: 16384, r: 8, p: 1 }, (e, key) => (e ? fail(e) : ok(key.toString("hex")))));

// 10 sign-ups or sign-ins per 10 minutes per address: a guess at a password costs
const tries = new Map();
const TRY_LIMIT = 10;
setInterval(() => {
  const now = Date.now();
  for (const [ip, p] of tries) if (p.resetAt < now) tries.delete(ip);
}, POST_WINDOW_MS).unref();
const tooMany = (req) => {
  const now = Date.now();
  const ip = req.ip ?? "?";
  const p = tries.get(ip) ?? { count: 0, resetAt: now + POST_WINDOW_MS };
  if (p.resetAt < now) Object.assign(p, { count: 0, resetAt: now + POST_WINDOW_MS });
  tries.set(ip, p);
  return ++p.count > TRY_LIMIT;
};
const newSession = (key) => {
  const token = randomBytes(32).toString("hex");
  accounts.sessions[token] = { user: key, expires: Date.now() + SESSION_DAYS * 86400 * 1000 };
  accountsDirty = true;
  return token;
};
/** the signed-in user from the Bearer token, or null */
const userOf = (req) => {
  const m = /^Bearer ([0-9a-f]{64})$/.exec(req.get("authorization") ?? "");
  const s = m && Object.hasOwn(accounts.sessions, m[1]) ? accounts.sessions[m[1]] : undefined;
  if (!s || s.expires < Date.now()) return null;
  const u = userAt(s.user);
  return u ? { key: s.user, token: m[1], user: u } : null;
};
const credentials = (body) => {
  const b = body && typeof body === "object" ? body : {};
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const password = typeof b.password === "string" ? b.password : "";
  if (!NAME.test(name)) return { error: "a name is 1 to 16 letters, digits, spaces, _ . or -" };
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) return { error: `a password is ${PASSWORD_MIN} to ${PASSWORD_MAX} characters` };
  return { name, password, key: name.toLowerCase() };
};

app.post("/api/account/register", express.json({ limit: "2kb" }), safe(async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (tooMany(req)) return res.status(429).json({ error: "slow down" });
  const c = credentials(req.body);
  if (c.error) return res.status(400).json({ error: c.error });
  if (userAt(c.key)) return res.status(409).json({ error: "that name is taken" });
  if (Object.keys(accounts.users).length >= MAX_ACCOUNTS) return res.status(503).json({ error: "no room for new accounts" });
  const salt = randomBytes(16).toString("hex");
  const hash = await hashOf(c.password, salt);
  // (a second sign-up for the same name while this one hashed)
  if (userAt(c.key)) return res.status(409).json({ error: "that name is taken" });
  accounts.users[c.key] = { name: c.name, salt, hash, created: new Date().toISOString(), profile: null, updated: null };
  accountsDirty = true;
  res.json({ ok: true, name: c.name, token: newSession(c.key), profile: null, updated: null });
}));

app.post("/api/account/login", express.json({ limit: "2kb" }), safe(async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (tooMany(req)) return res.status(429).json({ error: "slow down" });
  const c = credentials(req.body);
  if (c.error) return res.status(400).json({ error: "wrong name or password" });
  const u = userAt(c.key);
  // an unknown name costs the same hash as a known one, so the answer's timing tells nothing
  const hash = await hashOf(c.password, u?.salt ?? "00".repeat(16));
  if (!u || typeof u.hash !== "string" || !timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(u.hash, "hex"))) return res.status(401).json({ error: "wrong name or password" });
  res.json({ ok: true, name: u.name, token: newSession(c.key), profile: u.profile, updated: u.updated });
}));

app.post("/api/account/logout", (req, res) => {
  res.set("Cache-Control", "no-store");
  const s = userOf(req);
  if (s) {
    delete accounts.sessions[s.token];
    accountsDirty = true;
  }
  res.json({ ok: true });
});

app.get("/api/account/profile", (req, res) => {
  res.set("Cache-Control", "no-store");
  const s = userOf(req);
  if (!s) return res.status(401).json({ error: "sign in again" });
  res.json({ ok: true, name: s.user.name, profile: s.user.profile, updated: s.user.updated });
});

app.put("/api/account/profile", express.json({ limit: PROFILE_MAX }), (req, res) => {
  res.set("Cache-Control", "no-store");
  const s = userOf(req);
  if (!s) return res.status(401).json({ error: "sign in again" });
  // a save limit a user: the game saves after a match or a run, not every second
  const now = Date.now();
  s.user.saves = (s.user.saves ?? []).filter((t) => now - t < POST_WINDOW_MS);
  if (s.user.saves.length >= SAVE_LIMIT) return res.status(429).json({ error: "slow down" });
  s.user.saves.push(now);
  const profile = req.body && typeof req.body === "object" ? req.body.profile : undefined;
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return res.status(400).json({ error: "bad profile" });
  s.user.profile = profile;
  s.user.updated = new Date().toISOString();
  accountsDirty = true;
  res.json({ ok: true, updated: s.user.updated });
});

// the built site: file names under assets/ carry a content hash, so they can be
// cached for good; everything else is revalidated so a deploy shows at once
app.use(
  express.static(DIST, {
    index: "index.html",
    setHeaders(res, path) {
      if (/[\\/]assets[\\/]/.test(path)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      else if (/[\\/](tex|models)[\\/]/.test(path)) res.setHeader("Cache-Control", "public, max-age=86400");
      else res.setHeader("Cache-Control", "no-cache");
    },
  })
);

const server = app.listen(PORT, HOST, () => {
  console.log(`range server ${version} on http://${HOST}:${PORT} (site ${DIST}, TURN ${TURN_SECRET ? "on" : "off"})`);
});

const broker = ExpressPeerServer(server, {
  path: "/",
  key: PEER_KEY,
  proxied: true,
  // no listing of who is online: a code is the only way in
  allow_discovery: false,
  // a few friends at a time; this caps a flood, not real use
  concurrent_limit: 500,
  alive_timeout: 60000,
  expire_timeout: 5000,
});
broker.on("connection", () => peers++);
broker.on("disconnect", () => (peers = Math.max(0, peers - 1)));
app.use("/peerjs", broker);

// unknown paths: a plain 404, not the game page (a typo in an asset path should
// fail loudly, and /net.json callers need to tell "no such file" from JSON)
app.use((_req, res) => res.status(404).type("text/plain").send("not found"));
// a body that is not JSON, or too big: a plain 400, not a stack trace in the log
app.use((err, _req, res, next) => {
  if (err?.type === "entity.parse.failed" || err?.type === "entity.too.large") return res.status(400).json({ error: "bad json" });
  next(err);
});

const stop = () => {
  flushBoards();
  flushAccounts();
  server.close(() => process.exit(0));
  // open broker sockets keep close() waiting; pm2 would kill us anyway
  setTimeout(() => process.exit(0), 2000).unref();
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
