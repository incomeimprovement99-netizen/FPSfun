// End-to-end test in real browser pages: does everything work together.
//
//   1. The page loads with no errors, frames run, the static merge happened.
//   2. A scripted course run (teleporting into each room) finishes with a
//      result and a split for every room.
//   3. A 1v1 between two pages over the local transport (?net=local): they
//      connect, each sees the other at their spawn, the countdown ends, a hit
//      lowers the other's shield, a knock ends the round and scores it for the
//      right player, and the next round restores both players.
//   4. The same connection over the real peer-to-peer path, if the internet
//      and the public broker are reachable (skipped, not failed, otherwise).
//
// Run: npm run e2e        (needs `npm run dev` already running)
import { LOBBY_MODES, setupFor } from "../src/ui/lobby";
import citySectorsCfg from "../src/config/city.json";
import neonSectorsCfg from "../src/config/neonmap.json";
import { HOLD } from "../src/game/hold";
import { HIT_POSES, MEASURE_HEADS } from "./soldier-hits";
import soldierCfg from "../src/config/soldier.json";
import lodCfg from "../src/config/lod.json";
import soldierHoldCfg from "../src/config/soldierhold.json";
import figureCfg from "../src/config/figure.json";
import puppeteer, { type Browser, type Page } from "puppeteer";
import brCfg from "../src/config/br.json";
import netCfg from "../src/config/net.json";
/**
 * The longest a peer goes unheard by design: one standing still sends nothing until its next keyframe (net.json
 * keyframe, every 2 s give or take its spread), so "the two hear each other" is heard within that and a half second of
 * latency. The checks held it to 1.5 s, under the protocol's own interval, and failed whenever a bot stood still
 * (host migration's botFlow read 1.50 and 1.57 s, alone and in batches).
 */
const HEARD = netCfg.keyframe.seconds + netCfg.keyframe.spread + 0.5;
import ringCfg from "../src/config/ring.json";
import ammoCfg from "../src/config/ammo.json";
import lootCfg from "../src/config/loot.json";
import skCfg from "../src/config/games/speedkills.json";
import armoryCfg from "../src/config/armory.json";
import hacksCfg from "../src/config/hacks.json";
import killcamCfg from "../src/config/killcam.json";
import { CENTRE_MAP } from "../src/game/arenas/centre";
import botsCfgE2e from "../src/config/bots.json";
import hudCfgE2e from "../src/config/hud.json";
import fparmsCfg from "../src/config/fparms.json";
import gunfeelCfg from "../src/config/gunfeel.json";
import squadCfg from "../src/config/squad.json";
import cityCfgE2e from "../src/config/city.json";
import districtsCfg from "../src/config/citydistricts.json";
import { BR_X, BR_Z } from "../src/game/br";
import { readFileSync } from "node:fs";

/**
 * A test of the legacy game alone, pinned to it until the code it tests goes (docs/PLAN_LEGACY_REMOVAL.md, 494): the
 * suite runs SpeedKills by default, and a test that holds the legacy game's own map, loot, abilities, knockdowns or
 * arenas names it with this.
 */
const LEGACY = "&game=legacy";

const BASE = process.env.SHOT_URL ?? "http://localhost:5173/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

let fails = 0;
const errors: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Headless Chrome grants a test page pointer lock and then hands it the real
 * mouse on this machine: whoever moves it while the suite runs turns the
 * player's view in every page. No test drives the mouse, so a page drops
 * trusted pointer movement before the game hears it.
 */
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;

/**
 * A page for a check. The intro card is turned off on all of them but the
 * intro's own (`introTest` opens its page itself): it is two and a half
 * seconds of title over every page the suite opens, and the suite opens
 * hundreds.
 */
async function open(browser: Browser, query: string, base = BASE, init?: string): Promise<Page> {
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 450, deviceScaleFactor: 1 });
  // with where it was thrown, the first line of ours in its stack: "reading 'phase'" of null, said alone, left the
  // 2026-10-04 sweep's error with nowhere to look
  page.on("pageerror", (e) => {
    const at = /\/src\/[^\s)?]+(?:\?[^\s):]*)?:\d+:\d+/.exec(String((e as Error).stack ?? ""))?.[0].replace(/\?[^:]*/, "");
    errors.push(`pageerror: ${String((e as Error).message ?? e)}${at ? ` (at ${at})` : ""}`);
  });
  page.on("dialog", (d) => void d.accept());
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  // A 404 reaches the console as "Failed to load resource" and nothing else:
  // no URL, so nobody can act on it. The response carries the URL, so the
  // failure says which file was missing.
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()}: ${r.url().replace(/^https?:\/\/[^/]+\//, "")}`);
  });
  // The battle royale drops straight onto the squad's place in every test but
  // the ship's own (shipTest), which turns it back off: the checks after a
  // landing are about the landing, and a ride across the map would add half a
  // minute to each of them.
  await page.evaluateOnNewDocument("window.__straightDrop = true");
  // and no Gulag, for the same reason: the checks of a plain death are about the death (gulagTest turns it back on)
  await page.evaluateOnNewDocument("window.__noGulag = true");
  // and no vault: its guard is a bot more, and most checks count the bots (vaultTest turns it back on)
  await page.evaluateOnNewDocument("window.__noVault = true");
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  // every file the page loads kept for the checks that count them (the textures'): the browser keeps 250, and the dev
  // server's modules, a request each, grew past that before the first texture came (it counted 37, then 22, then 0)
  await page.evaluateOnNewDocument("performance.setResourceTimingBufferSize(20000)");
  if (init) await page.evaluateOnNewDocument(init);
  // E2E_THROTTLE=4 runs every page on a quarter of the CPU: what a machine busy with other runs does to a
  // page, on demand, so a check that only fails in the release run can be made to fail alone
  const throttle = Number(process.env.E2E_THROTTLE ?? 0);
  if (throttle > 1) await (await page.createCDPSession()).send("Emulation.setCPUThrottlingRate", { rate: throttle });
  // a base with a query of its own (OLD_URL=https://the.site/?broker=public) keeps it
  const q0 = query.includes("intro=on") ? query : query.startsWith("?") ? `${query}&nointro` : "?nointro";
  // A page is SpeedKills unless its query or E2E_GAME names a game: the suite was the legacy game's regression net
  // until that game was being removed (the owner, 2026-10-04), and a check of the legacy game alone names it.
  const q1 = q0.includes("game=") ? q0 : `${q0}&game=${process.env.E2E_GAME ?? "speedkills"}`;
  // SpeedKills opens on the Neon City map now (Phase 28); the suite's city tests are the ILranch city's, which ?map=city
  // keeps, so a SpeedKills page is on it unless its query names a map (E2E_MAP=neon puts every one on the new map)
  const q2 = q1.includes("game=speedkills") && !q1.includes("map=") ? `${q1}&map=${process.env.E2E_MAP ?? "city"}` : q1;
  // and on the menu, as the checks of it expect: the start screen in front of it is startScreenTest's (src/ui/start.ts)
  const q = q2.includes("home=") ? q2 : `${q2}&nohome`;
  const url = base.includes("?") ? `${base}&${q.slice(1)}` : base + q;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 60000 });
  return page;
}

/** evaluate an expression string in the page (tsx mangles function sources) */
const ev = <T>(page: Page, expr: string) => page.evaluate(expr) as Promise<T>;
/** the page is on the Neon City map (the default since Phase 28: the suite's SpeedKills pages are on the city before it
 * unless E2E_MAP=neon) */
const onNeon = (page: Page): Promise<boolean> => ev<boolean>(page, "!!window.__range.neonMap?.().on");
/** a check of the city before the Neon City, which the Neon map has nothing of: said as skipped there, not failed */
const oldCityOnly = (what: string): void => console.log(`  --  ${what}: the city before the Neon City's, skipped on the Neon map`);

/**
 * Waits until the page's game clock has moved on `secs`. A cooldown, a prompt or a door's swing runs on game time,
 * and a starved page's game time falls behind the wall's: the frame step is capped at 0.1 s, so under 10 fps a
 * second of waiting is less than a second of game. With the machine at 95% (a release run beside other work) a
 * door's second kick came inside the first's cooldown and the vault's prompt was read before the frame that moved
 * you had run; both passed alone.
 */
async function gameSleep(page: Page, secs: number): Promise<void> {
  const t0 = await ev<number>(page, "window.__range.gameTime()");
  await page.waitForFunction(`window.__range.gameTime() >= ${t0 + secs}`, { polling: 50, timeout: 5000 + secs * 20000 }).catch(() => undefined);
}

/** back to the menu (Esc), and wait until the game agrees */
async function toMenu(p: Page): Promise<void> {
  await ev(p, "window.__range.toMenu()");
  await p.waitForFunction("!window.__range.input.playing", { polling: 50, timeout: 5000 }).catch(() => undefined);
}

/**
 * "Click Play" without a pointer lock (a scripted page cannot take one): a
 * fake gamepad's Start, which is the controller's way in. Round 1 waits for
 * every player to be in the game, so every page in a match does this.
 */
async function pressPlay(page: Page): Promise<void> {
  // already in (Create and a connect take a page straight in): nothing to press
  if (await ev<boolean>(page, "window.__range.input.playing")) return;
  await ev(page, `(() => {
    if (!window.__pad) {
      const btn = () => ({ pressed: false, touched: false, value: 0 });
      const pad = { index: 0, id: "fake pad", connected: true, mapping: "standard", timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn) };
      window.__pad = pad;
      navigator.getGamepads = () => [pad];
    }
  })()`);
  // no animation frames to wait on: a page behind another tab gets none,
  // but the game keeps ticking on a timer, so a short hold is enough
  await sleep(300);
  await ev(page, "window.__pad.buttons[9].pressed = true");
  await sleep(300);
  await ev(page, "window.__pad.buttons[9].pressed = false");
  await sleep(300);
}

/**
 * A 1v1 on the Neon City with the host's collision boxes still coming in (a slow phone, or a page opened a moment ago):
 * the match waits for them (main.ts boxesFirst), and what its friend sends meanwhile is kept for it. It was lost, and the
 * friend was told the host had left: a match counts the other end gone after 10 s of silence (duel.ts SILENCE_LIMIT), and
 * the host said nothing while it waited. The live check failed so on a busy machine (2026-10-04); 13 s here is past it.
 */
async function lateBoxesTest(browser: Browser): Promise<void> {
  const q = "?net=local&norender&game=speedkills&map=neon";
  const host = await open(browser, q, BASE, "window.__boxesLate = 13000");
  const guest = await open(browser, q);
  await guest.waitForFunction("window.__range.neonMap().boxes > 0", { polling: 200, timeout: 60000 }).catch(() => undefined);
  await ev(host, `document.getElementById("duelHost").click()`);
  const code = await host
    .waitForSelector("#duelStatus .code", { timeout: 20000 })
    .then(() => ev<string>(host, `document.querySelector("#duelStatus .code").textContent`), () => "");
  const early = await ev<number>(host, "window.__range.neonMap().boxes");
  await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
  const both = await Promise.all([host, guest].map((p) => p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 40000 }).then(() => true, () => false)));
  // still together a while after the host's match began: the friend's hello and the host's welcome both arrived
  await sleep(5000);
  const after = await Promise.all(
    [host, guest].map((p) => ev<{ in: boolean; others: number; status: string }>(p, `({ in: window.__range.duel() !== null, others: window.__range.duel()?.avatars.length ?? 0, status: document.getElementById("duelStatus").textContent.slice(0, 80) })`))
  );
  check(
    "a 1v1 on the Neon City whose host's boxes are still coming in starts once they are, and both stay in it",
    !!code && early === 0 && both.every(Boolean) && after.every((a) => a.in && a.others >= 1),
    JSON.stringify({ code, hostBoxesAtCode: early, both, host: after[0], guest: after[1] })
  );
  await ev(guest, "window.__range.duel()?.leave()").catch(() => undefined);
  await guest.close();
  await host.close();
}

/**
 * A code typed from a page of the other game (the invite link carries the host's game). Each is told and left where it
 * is (Milestone 455): a SpeedKills player is never moved into the legacy game and its old name, and the move the other
 * way never worked for a 1v1 (the page's leaving ended the host's match before it came back).
 */
async function crossGameTest(browser: Browser): Promise<void> {
  const host = await open(browser, "?net=local&norender" + LEGACY);
  const guest = await open(browser, "?net=local&norender&game=speedkills");
  await ev(host, `document.getElementById("duelHost").click()`);
  const code = await host
    .waitForSelector("#duelStatus .code", { timeout: 20000 })
    .then(() => ev<string>(host, `document.querySelector("#duelStatus .code").textContent`), () => "");
  await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
  await guest.waitForFunction(`/older version/.test(document.getElementById("duelStatus").textContent)`, { polling: 200, timeout: 15000 }).catch(() => undefined);
  const stayed = await ev<{ status: string; search: string; duel: boolean }>(guest, `({ status: document.getElementById("duelStatus").textContent, search: location.search, duel: window.__range.duel() !== null })`);
  check(
    "a SpeedKills player given a legacy host's code is told its page is behind, and stays in SpeedKills",
    !!code && /older version/.test(stayed.status) && !/game=legacy/.test(stayed.search) && !stayed.duel && !/legacy/i.test(stayed.status),
    JSON.stringify({ code, ...stayed })
  );
  await host.close();
  await guest.close();
  const skHost = await open(browser, "?net=local&norender&game=speedkills");
  const oldGuest = await open(browser, "?net=local&norender" + LEGACY);
  await ev(skHost, `document.getElementById("duelHost").click()`);
  const code2 = await skHost
    .waitForSelector("#duelStatus .code", { timeout: 20000 })
    .then(() => ev<string>(skHost, `document.querySelector("#duelStatus .code").textContent`), () => "");
  await ev(oldGuest, `(() => { document.getElementById("duelCode").value = "${code2}"; document.getElementById("duelJoin").click(); })()`);
  await oldGuest.waitForFunction(`/That match is SpeedKills/.test(document.getElementById("duelStatus").textContent)`, { polling: 200, timeout: 15000 }).catch(() => undefined);
  const told = await ev<{ status: string; search: string; duel: boolean }>(oldGuest, `({ status: document.getElementById("duelStatus").textContent, search: location.search, duel: window.__range.duel() !== null })`);
  check("and a legacy page given a SpeedKills host's code is told so, and stays", !!code2 && /That match is SpeedKills/.test(told.status) && /game=legacy/.test(told.search) && !told.duel, JSON.stringify({ code2, ...told }));
  await oldGuest.evaluate("window.__range?.duel()?.leave()").catch(() => undefined);
  await oldGuest.close();
  await skHost.close();
}

/**
 * A slow answer from the site about its broker (net.json) is waited for, not taken for none. A host whose answer came
 * after 3 s went to the public broker while its friend went to the site's, and the friend found no match with that
 * code: the live check, for 8 minutes after a deploy (2026-10-04). Here the page's net.json comes 4 s late and names a
 * broker path of its own; the host's broker socket has to go there. (That path's socket is a stand-in that never
 * opens: nothing connects, and nothing fails into the run's error count.)
 */
async function brokerWaitTest(browser: Browser): Promise<void> {
  const page = await open(
    browser,
    "?norender",
    BASE,
    `(() => {
      window.__ws = [];
      const W = window.WebSocket;
      const Stand = function (u, p) {
        if (/peerjs\\?key=/.test(String(u))) window.__ws.push(String(u));
        if (String(u).includes("/broker-probe/")) {
          const t = new EventTarget();
          t.readyState = 0;
          t.send = () => undefined;
          t.close = () => undefined;
          return t;
        }
        return new W(u, p);
      };
      Stand.prototype = W.prototype;
      Object.assign(Stand, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
      window.WebSocket = Stand;
    })()`
  );
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    if (/\/net\.json/.test(r.url())) setTimeout(() => void r.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ v: 1, peer: { path: "/broker-probe/", key: "probe" }, iceServers: [] }) }), 4000);
    else void r.continue();
  });
  await ev(page, `document.getElementById("duelHost").click()`);
  await page.waitForFunction("window.__ws.length > 0", { polling: 200, timeout: 25000 }).catch(() => undefined);
  const ws = await ev<string[]>(page, "window.__ws");
  check(
    "a slow answer about the site's broker is waited for: the host goes to the site's broker, not the public one",
    ws.length > 0 && ws.every((u) => u.includes("/broker-probe/")),
    ws.map((u) => u.replace(/[?].*$/, "")).join(" ") || "no broker socket in 25 s"
  );
  await page.close();
}

/** a friend opens the invite link and is in the match, with no code typed */
async function inviteTest(browser: Browser, query: string): Promise<void> {
  const host = await open(browser, query);
  await ev(host, `document.getElementById("duelHost").click()`);
  const got = await host.waitForSelector("#inviteLink", { timeout: 20000 }).then(() => true, () => false);
  const link = got ? await ev<string>(host, `document.getElementById("inviteLink").value`) : "";
  check("the host gets an invite link", /[?&]join=[A-Z0-9]{5}/.test(link), link || "none");
  if (!link) return void (await host.close());
  const guest = await open(browser, new URL(link).search);
  const joined = await guest.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 }).then(() => true, () => false);
  check("opening the invite link joins the match", joined, await ev<string>(guest, `document.getElementById("duelStatus").textContent`));
  const search = await ev<string>(guest, "location.search");
  check("and the code comes off the address (a reload does not rejoin)", !/join=/.test(search) && /net=local/.test(search), search);
  await ev(guest, "window.__range.duel()?.leave()");
  await host.waitForFunction("window.__range.duel() === null", { polling: 200, timeout: 15000 }).catch(() => undefined);
  await guest.close();
  await host.close();
}

/** the battle royale: the drop, the landing, a knock, the ring's damage, a heal, leaving */
/** the battle royale's bot graph: every node a bot can actually walk to */
async function navChecks(page: Page): Promise<void> {
  const nav = await ev<{ nodes: number; pois: number; cells: number; bad: Array<Record<string, unknown>> }>(page, NAV_PROBE);
  check(
    "the map's bot graph: every node, link and drop is somewhere a bot can walk to",
    nav.bad.length === 0 && nav.nodes > 12 && nav.pois === 9,
    nav.bad.length ? JSON.stringify(nav.bad).slice(0, 400) : nav.nodes + " nodes, " + nav.pois + " places, " + nav.cells + " walkable half-metre cells"
  );
}

const NAV_PROBE = String.raw`(() => {
  // Can a bot walk the battle royale's graph? Floods the map on a half-metre
  // grid using the bot's own rules from src/game/bots.ts (0.41 m radius,
  // 0.56 m step, 1.83 m standing room) and reports any node the flood never
  // reaches. A node it cannot reach is a bot stuck for a whole match.
  const S = window.__range.solids, map = window.__range.brMap;
  const R = 0.406, STEP = 0.5588, STAND = 1.83;
  const X0 = -224, Z0 = 276, SIDE = 448, C = 0.5, N = Math.ceil(SIDE / C);
  // solids bucketed 8 m, so a cell looks at a dozen boxes and not two thousand
  const B = 8, BN = Math.ceil(SIDE / B), bucket = new Array(BN * BN);
  for (const s of S) {
    // a door is a way through: the bots open the ones they walk into
    if (s.top <= 0.01 || s.door) continue;
    const i0 = Math.max(0, Math.floor((s.minX - R - X0) / B)), i1 = Math.min(BN - 1, Math.floor((s.maxX + R - X0) / B));
    const j0 = Math.max(0, Math.floor((s.minZ - R - Z0) / B)), j1 = Math.min(BN - 1, Math.floor((s.maxZ + R - Z0) / B));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) (bucket[i * BN + j] ??= []).push(s);
  }
  const at = (x, z) => bucket[Math.min(BN - 1, Math.max(0, Math.floor((x - X0) / B))) * BN + Math.min(BN - 1, Math.max(0, Math.floor((z - Z0) / B)))] ?? [];
  // the highest floor a body at height y can step up onto, and -1 if a wall is in the way
  const stand = (x, z, y) => {
    let floor = 0;
    const near = at(x, z);
    for (const s of near) if (x + R > s.minX && x - R < s.maxX && z + R > s.minZ && z - R < s.maxZ && s.top <= y + STEP + 1e-4 && s.top > floor) floor = s.top;
    for (const s of near) if (x + R > s.minX && x - R < s.maxX && z + R > s.minZ && z - R < s.maxZ && s.top > floor + STEP + 1e-4 && s.base < floor + STAND - 1e-4) return -1;
    return floor;
  };
  const best = new Float32Array(N * N).fill(-2);
  const start = map.nodes[5];
  const si = Math.round((start.x - X0) / C), sj = Math.round((start.z - Z0) / C);
  const y0 = stand(start.x, start.z, 40);
  best[si * N + sj] = y0;
  let queue = [si * N + sj], reached = 1;
  while (queue.length) {
    const next = [];
    for (const k of queue) {
      const i = (k / N) | 0, j = k % N, y = best[k];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const nk = ni * N + nj, was = best[nk];
        const ny = stand(X0 + ni * C, Z0 + nj * C, y);
        if (ny < 0 || ny <= was + 1e-4) continue;
        if (was < -1) reached++;
        best[nk] = ny;
        next.push(nk);
      }
    }
    queue = next;
  }
  const reachable = (x, z) => { const k = Math.round((x - X0) / C) * N + Math.round((z - Z0) / C); return k >= 0 && k < N * N && best[k] > -1; };
  // the nearest spot the flood did reach, so a report says where to move to
  const nearestFree = (x, z) => {
    for (let r = 1; r < 40; r++) for (let a = -r; a <= r; a++) for (const [dx, dz] of [[a, -r], [a, r], [-r, a], [r, a]]) {
      const px = x + dx * C, pz = z + dz * C;
      if (reachable(px, pz)) return { x: Math.round(px), z: Math.round(pz - 500), away: +(r * C).toFixed(1) };
    }
    return null;
  };
  const bad = [];
  map.nodes.forEach((n, i) => {
    if (!reachable(n.x, n.z)) bad.push({ kind: "node-cut-off", i, x: Math.round(n.x), z: Math.round(n.z - 500) });
    // a node on a crest, a deck or a roof says so, and the flood has to stand
    // there: a bot sent to it counts as arrived only on that floor
    else if (n.y !== undefined) {
      const k = Math.round((n.x - X0) / C) * N + Math.round((n.z - Z0) / C);
      if (Math.abs(best[k] - n.y) > 1) bad.push({ kind: "node-wrong-floor", i, y: n.y, flood: +best[k].toFixed(2) });
    }
    for (const j of n.links) {
      if (!map.nodes[j]) { bad.push({ kind: "link-missing", i, j }); continue; }
      if (!map.nodes[j].links.includes(i)) bad.push({ kind: "link-one-way", i, j });
    }
    if (!n.links.length) bad.push({ kind: "node-no-links", i });
  });
  // every place has to be reachable too, and every spot a squad drops on
  map.pois.forEach((p) => {
    p.drops.forEach((d, k) => { if (!reachable(d.x, d.z)) bad.push({ kind: "drop-cut-off", id: p.id, k, x: Math.round(d.x), z: Math.round(d.z - 500), nearest: nearestFree(d.x, d.z) }); });
  });
  return { nodes: map.nodes.length, pois: map.pois.length, cells: reached, bad };
})()`;

/**
 * The battle royale row's squad size, then its bot count, the way a click on
 * each would set them. The size goes first because it decides which counts
 * the row offers, and every page of a run shares one browser's storage, so a
 * test that leaves it to the last test's choice is testing that test.
 */
/**
 * A battle royale that lands with nothing and loots, set on the host's page for its own match only (no change event,
 * so nothing is saved for the pages after). The pages share one browser's storage, and any SpeedKills page moves it
 * onto SpeedKills' defaults once, landing with the loadout (main.ts brDefaults): a legacy match after that had no
 * floor loot at all, so the squad's death drops and the bots' found guns were never there (failing since 2026-10-02).
 */
const LOOT_START = `(() => { document.getElementById("brStart").value = "loot"; })()`;
const brRow = (team: "solo" | "duo" | "trio", bots: number): string =>
  `(() => { const t = document.getElementById("brTeam"); t.value = "${team}"; t.dispatchEvent(new Event("change")); const b = document.getElementById("brBots"); b.value = "${bots}"; b.dispatchEvent(new Event("change")); })()`;

/**
 * Doors: a shut door stops you, E opens the one you look at and you walk
 * through, and a bot that walks into a shut door opens it.
 */
/**
 * The vault (br.json vault): the Well's small building, sealed, its door
 * locked. Its guard stands at its post on no side and is not counted among
 * those left; the vault is stocked with a mythic gun as
 * the fight starts; the door will not open without the keycard, which is in
 * dropped where the guard falls; its holder is shown the way and opens the door,
 * which uses the card.
 */
async function vaultTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  await ev(page, brRow("solo", 5));
  await ev(page, `(() => { window.__noVault = false; document.getElementById("brStart").value = "loot"; document.getElementById("goBr").click(); document.getElementById("startMode").click(); })()`);
  const fought = await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 40000 }).then(() => true, () => false);
  if (!fought) {
    check("vault: the match starts", false);
    await page.close();
    return;
  }
  await ev(page, "(() => { const d = window.__range.duel(); d.holdFire = true; window.__notices = []; const say = d.onNotice; d.onNotice = (t) => { window.__notices.push(t); say?.(t); }; })()");
  await sleep(1500);
  const g = await ev<{ name: string; tier: string; team: number; at: number; alive: boolean; aboard: boolean; left: number; bots: number; vault: { door: number; x: number; z: number; locked: boolean } | null } | null>(
    page,
    "(() => { const d = window.__range.duel(); const b = d.bots.find((x) => x.guard); if (!b) return null; return { name: b.bot.remote.name, tier: b.bot.diff.name, team: b.team, at: Math.hypot(b.bot.pos.x - b.guard.x, b.bot.pos.z - b.guard.z), alive: b.bot.alive, aboard: b.bot.aboard, left: d.aliveCount, bots: d.bots.filter((x) => !x.guard).length, vault: d.vault }; })()"
  );
  check("vault: its guard, THE WARDEN, elite and on no side, stands at his post (not on the ship), and is not counted among those left", !!g && g.name === "THE WARDEN" && g.tier === "elite" && g.team === -1 && g.at < 2 && g.alive && !g.aboard && g.left === 1 + g.bots && !!g.vault?.locked, JSON.stringify(g));
  const stock = await ev<{ mythic: string[] }>(
    page,
    "(() => { const d = window.__range.duel(); const v = d.vault; const near = [...d.lootField.drops.values()].filter((x) => Math.hypot(x.pos.x - v.x, x.pos.z - v.z) < 4.5); return { mythic: near.filter((x) => x.item.kind === 'weapon' && x.item.mythic).map((x) => x.item.id + ':' + x.item.mag) }; })()"
  );
  check("vault: stocked as the fight starts: a mythic gun at gold mag inside", stock.mythic.length === 1 && stock.mythic[0].endsWith(":4"), JSON.stringify(stock));
  // at the door without the card: it says so, and the door stays shut
  await ev(page, "(() => { const d = window.__range.duel(); const door = window.__range.brMap.doors.list[d.vault.door]; window.__range.player.teleport(door.centre.x, door.centre.y - 1.3, door.centre.z - 2.2, 180, 0); })()");
  await gameSleep(page, 0.5);
  const lockedPrompt = await ev<string>(page, "window.__range.brPlay.hud?.prompt?.text ?? ''");
  await ev(page, `window.__range.setScript({ held: () => false, pressedNow: (a) => a === "interact" })`);
  await sleep(300);
  await ev(page, "window.__range.setScript(null)");
  await ev(page, "(() => { const d = window.__range.duel(); d.useDoor(d.vault.door, true); })()");
  await sleep(300);
  const shut = await ev<{ open: boolean; locked: boolean; kicked: string | null }>(page, "(() => { const d = window.__range.duel(); const ds = window.__range.brMap.doors; return { open: ds.list[d.vault.door].open, locked: d.vault.locked, kicked: ds.kick(d.vault.door) }; })()");
  check("vault: without the keycard the door says so, stays shut to interact and cannot be kicked in", /LOCKED/.test(lockedPrompt) && !shut.open && shut.locked && shut.kicked === null, JSON.stringify({ lockedPrompt, shut }));
  // the guard down: he drops the keycard
  await ev(page, "(() => { const d = window.__range.duel(); const b = d.bots.find((x) => x.guard); d.botDown(b, d.id); })()");
  await sleep(400);
  const card = await ev<{ key: number | null; said: boolean; left: number }>(page, "(() => { const d = window.__range.duel(); const k = [...d.lootField.drops.values()].find((x) => x.item.kind === 'keycard'); return { key: k ? k.key : null, said: window.__notices.some((t) => t.includes('DROPPED THE VAULT KEYCARD')), left: d.aliveCount }; })()");
  check("vault: the guard down, he drops the vault keycard, and everyone is told", card.key !== null && card.said, JSON.stringify(card));
  // taken: the holder is shown the way, and the door offers to open
  await ev(page, `window.__range.duel().takeLoot(${card.key ?? -1})`);
  await gameSleep(page, 0.7);
  const held = await ev<{ mine: boolean; mark: boolean; prompt: string }>(page, "(() => { const d = window.__range.duel(); return { mine: d.myKey, mark: window.__range.brPlay.markers.some((m) => m.label === 'THE VAULT'), prompt: window.__range.brPlay.hud?.prompt?.text ?? '' }; })()");
  check("vault: holding the keycard, the way to the vault is marked and the door offers to open", held.mine && held.mark && /OPEN THE VAULT/.test(held.prompt), JSON.stringify(held));
  await ev(page, `window.__range.setScript({ held: () => false, pressedNow: (a) => a === "interact" })`);
  const opened = await page.waitForFunction("(() => { const d = window.__range.duel(); return !d.vault.locked && window.__range.brMap.doors.list[d.vault.door].open; })()", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  await ev(page, "window.__range.setScript(null)");
  const after = await ev<{ mine: boolean; said: boolean }>(page, "({ mine: window.__range.duel().myKey, said: window.__notices.some((t) => t === 'THE VAULT IS OPEN') })");
  check("vault: interact with the keycard opens the vault, which uses the card", opened && !after.mine && after.said, JSON.stringify({ opened, after }));
  await page.close();
}

async function doorTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  await ev(page, brRow("solo", 5));
  await ev(page, `(() => { document.getElementById("brStart").value = "loadout"; document.getElementById("goBr").click(); document.getElementById("startMode").click(); })()`);
  // on the ship, before anyone has landed: every door shut
  await page.waitForFunction(`window.__range.duel()?.phase === "countdown"`, { polling: 100, timeout: 20000 }).catch(() => undefined);
  const openAtStart = await ev<number>(page, "window.__range.brMap.doors.openList().length");
  const fought = await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 40000 }).then(() => true, () => false);
  if (!fought) {
    check("doors: the match starts", false);
    await page.close();
    return;
  }
  // the ring off the doors' way, the bots held, every door shut
  const info = await ev<{ count: number; open: number; i: number; z: number } | null>(
    page,
    `(() => { const r = window.__range; const d = r.duel(); d.holdFire = true; const ds = r.brMap.doors; const door = ds.list.find((x) => x.side === "s" && x.centre.y < 3 && !ds.list.some((y) => y !== x && Math.hypot(y.centre.x - x.centre.x, y.centre.z - x.centre.z) < 8)); if (!door) return null; for (const b of d.bots) b.bot.pos.set(door.centre.x + 60, 0, door.centre.z + 60); r.player.teleport(door.centre.x, door.centre.y - 1.3, door.centre.z + 2.5, 0, 0); return { count: ds.list.length, open: ds.openList().length, i: door.i, z: door.centre.z }; })()`
  );
  if (!info) {
    check("doors: a door to test on", false);
    await page.close();
    return;
  }
  check(`doors: a door in every ground-floor doorway, all shut as the match starts (${info.count})`, info.count > 50 && openAtStart === 0, JSON.stringify({ ...info, openAtStart }));
  // walk into it shut: stopped outside
  await ev(page, `window.__range.setScript({ held: (a) => a === "forward", pressedNow: () => false })`);
  await sleep(1500);
  const stopped = await ev<number>(page, "window.__range.player.pos.z");
  // look at it and press E: it opens, and the walk carries on inside
  await ev(page, "window.__range.setScript({ held: () => false, pressedNow: () => false })");
  await sleep(300);
  const prompt = await ev<string>(page, "window.__range.brPlay.hud?.prompt?.text ?? ''");
  // E for one frame (held, the door would open and shut every frame)
  await ev(page, `(() => { const s = { k: 0, held: () => false, pressedNow: (a) => a === "interact" && s.k === 2 }; window.__range.setScript(s, () => { s.k++; }); })()`);
  await sleep(300);
  await ev(page, `window.__range.setScript({ held: (a) => a === "forward", pressedNow: () => false })`);
  await sleep(1500);
  const through = await ev<{ z: number; open: boolean }>(page, `({ z: window.__range.player.pos.z, open: window.__range.brMap.doors.list[${info.i}].open })`);
  await ev(page, "window.__range.setScript(null)");
  check("doors: a shut door stops you; E opens the one you look at, and you walk through it", stopped > info.z + 0.3 && prompt === "OPEN THE DOOR" && through.open && through.z < info.z - 1, JSON.stringify({ doorZ: info.z, stopped, prompt, through }));
  // a bot walking into a shut door opens it
  const other = await ev<{ i: number } | null>(
    page,
    `(() => { const r = window.__range; const d = r.duel(); const ds = r.brMap.doors; const door = ds.list.find((x) => !x.open && x.centre.y < 3 && x.i !== ${info.i}); if (!door) return null; const b = d.bots.find((x) => x.bot.alive); b.bot.pos.set(door.centre.x, door.centre.y - 1.3, door.centre.z + (door.side === "s" ? 1 : door.side === "n" ? -1 : 0)); if (door.side === "e") b.bot.pos.x += 1; if (door.side === "w") b.bot.pos.x -= 1; return { i: door.i }; })()`
  );
  const botOpened = !!other && (await page.waitForFunction(`window.__range.brMap.doors.list[${other?.i ?? 0}].open`, { polling: 100, timeout: 3000 }).then(() => true, () => false));
  check("doors: a bot that walks into a shut door opens it", botOpened, JSON.stringify(other));
  // two swings into a shut door kick it in: gone from the doorway, nothing left to bump into
  const kicked = await ev<{ i: number } | null>(
    page,
    `(() => { const r = window.__range; const ds = r.brMap.doors; const door = ds.list.find((x) => !x.open && x.side === "s" && x.centre.y < 3 && x.i !== ${info.i} && x.i !== ${other?.i ?? -1}); if (!door) return null; r.player.teleport(door.centre.x, door.centre.y - 1.3, door.centre.z + 1.3, 0, 0); return { i: door.i }; })()`
  );
  const swing = "window.__range.swing()";
  await gameSleep(page, 0.4);
  await ev(page, swing);
  await gameSleep(page, 0.9);
  const afterOne = kicked ? await ev<{ hits: number; open: boolean }>(page, `(() => { const d = window.__range.brMap.doors.list[${kicked.i}]; return { hits: d.hits, open: d.open }; })()`) : null;
  await ev(page, swing);
  await gameSleep(page, 0.9);
  await ev(page, "window.__range.setScript(null)");
  const afterTwo = kicked ? await ev<{ broken: boolean; flat: boolean; shown: boolean }>(page, `(() => { const d = window.__range.brMap.doors.list[${kicked.i}]; return { broken: d.broken, flat: d.solid.top === d.solid.base, shown: d.pivot.visible }; })()`) : null;
  check("doors: one swing into a shut door shakes it, the second kicks it in: gone from the doorway for the match", !!afterOne && afterOne.hits === 1 && !afterOne.open && !!afterTwo && afterTwo.broken && afterTwo.flat && !afterTwo.shown, JSON.stringify({ kicked, afterOne, afterTwo }));
  // the traversal: a bot put on a launch pad is thrown along it
  const pad = await ev<{ id: number; x: number; z: number; dx: number; dz: number } | null>(
    page,
    `(() => { const r = window.__range; const d = r.duel(); const p = r.brMap.pads[0]; const b = d.bots.find((x) => x.bot.alive && !x.down && !x.bot.travel); if (!b) return null; b.bot.pos.set(p.x, 0, p.z); return { id: b.bot.remote.id, x: p.x, z: p.z, dx: p.dx, dz: p.dz }; })()`
  );
  const flew = !!pad && (await page.waitForFunction(`window.__range.duel().bots.find((x) => x.bot.remote.id === ${pad?.id ?? -1})?.bot.travel?.kind === "fling"`, { polling: 50, timeout: 2000 }).then(() => true, () => false));
  if (pad) await page.waitForFunction(`!window.__range.duel().bots.find((x) => x.bot.remote.id === ${pad.id})?.bot.travel`, { polling: 100, timeout: 8000 }).catch(() => undefined);
  const landed = pad ? await ev<{ x: number; z: number }>(page, `(() => { const b = window.__range.duel().bots.find((x) => x.bot.remote.id === ${pad.id}); return { x: b.bot.pos.x, z: b.bot.pos.z }; })()`) : null;
  const along = pad && landed ? (landed.x - pad.x) * pad.dx + (landed.z - pad.z) * pad.dz : 0;
  check("traversal: a bot that steps on a launch pad is thrown along it", flew && along > 20, JSON.stringify({ pad, landed, along: Math.round(along) }));
  // a bot at a rope's end, going somewhere nearer the far end, rides the rope there
  const rope = await ev<{ id: number; far: number[] } | null>(
    page,
    `(() => { const r = window.__range; const d = r.duel(); const zs = r.ziplines.filter((q) => q.a.z > 250).map((q) => ({ a: [q.a.x, q.a.y, q.a.z], b: [q.b.x, q.b.y, q.b.z] })); const z = zs.find((q) => q.a[1] < 12) ?? zs[0]; if (!z) return null; const b = d.bots.find((x) => x.bot.alive && !x.down && !x.bot.travel); if (!b) return null;
      const nodes = r.brMap.nodes; let best = 0, bd = Infinity; nodes.forEach((n, i) => { const dd = Math.hypot(n.x - z.b[0], n.z - z.b[2]); if (dd < bd) { bd = dd; best = i; } });
      b.bot.pos.set(z.a[0], z.a[1] - 2.13, z.a[2]); b.goal = best; b.node = best; for (const o of d.bots) if (o !== b) o.bot.pos.set(z.a[0] + 150, 0, z.a[2] + 150); return { id: b.bot.remote.id, far: z.b }; })()`
  );
  const rode = !!rope && (await page.waitForFunction(`window.__range.duel().bots.find((x) => x.bot.remote.id === ${rope?.id ?? -1})?.bot.travel?.kind === "zip"`, { polling: 50, timeout: 3000 }).then(() => true, () => false));
  if (rope) await page.waitForFunction(`!window.__range.duel().bots.find((x) => x.bot.remote.id === ${rope.id})?.bot.travel`, { polling: 100, timeout: 20000 }).catch(() => undefined);
  const at = rope ? await ev<number>(page, `(() => { const b = window.__range.duel().bots.find((x) => x.bot.remote.id === ${rope.id}); return Math.hypot(b.bot.pos.x - ${rope.far[0]}, b.bot.pos.z - ${rope.far[2]}); })()`) : -1;
  check("traversal: a bot at a zipline's end, going somewhere nearer its far end, rides it there", rode && at >= 0 && at < 4, JSON.stringify({ rope, rode, at: +at.toFixed(1) }));
  // and a rope its route says to take: it rides that one whichever way its goal lies (br.ts rope steps on the graph)
  const planned = await ev<{ id: number; far: number[]; goal: number[] } | null>(
    page,
    `(() => { const r = window.__range; const d = r.duel(); const nodes = r.brMap.nodes; const from = nodes.findIndex((n) => (n.ropes ?? []).length); if (from < 0) return null; const to = nodes[from].ropes[0];
      const z = r.ziplines.find((q) => (Math.hypot(q.a.x - nodes[from].x, q.a.z - nodes[from].z) < 22 && Math.hypot(q.b.x - nodes[to].x, q.b.z - nodes[to].z) < 22) || (Math.hypot(q.b.x - nodes[from].x, q.b.z - nodes[from].z) < 22 && Math.hypot(q.a.x - nodes[to].x, q.a.z - nodes[to].z) < 22));
      if (!z) return null; const near = Math.hypot(z.a.x - nodes[from].x, z.a.z - nodes[from].z) < 22 ? z.a : z.b; const far = near === z.a ? z.b : z.a;
      const b = d.bots.find((x) => x.bot.alive && !x.down && !x.bot.travel); if (!b) return null;
      b.bot.pos.set(near.x, near.y - 2.13, near.z); b.node = from; b.goal = to; b.ropeTo = { x: nodes[to].x, z: nodes[to].z };
      for (const o of d.bots) if (o !== b) o.bot.pos.set(near.x + 150, 0, near.z + 150);
      return { id: b.bot.remote.id, far: [far.x, far.y, far.z], goal: [nodes[to].x, nodes[to].z] }; })()`
  );
  const rodePlan = !!planned && (await page.waitForFunction(`window.__range.duel().bots.find((x) => x.bot.remote.id === ${planned?.id ?? -1})?.bot.travel?.kind === "zip"`, { polling: 50, timeout: 3000 }).then(() => true, () => false));
  if (planned) await page.waitForFunction(`!window.__range.duel().bots.find((x) => x.bot.remote.id === ${planned.id})?.bot.travel`, { polling: 100, timeout: 20000 }).catch(() => undefined);
  const atPlan = planned ? await ev<number>(page, `(() => { const b = window.__range.duel().bots.find((x) => x.bot.remote.id === ${planned.id}); return Math.hypot(b.bot.pos.x - ${planned.far[0]}, b.bot.pos.z - ${planned.far[2]}); })()`) : -1;
  check("traversal: a rope its route plans through is ridden, not walked round", rodePlan && atPlan >= 0 && atPlan < 5, JSON.stringify({ planned, rodePlan, at: +atPlan.toFixed(1) }));
  // a jump tower: a bot at one with a long way to go rides it and glides for its goal
  const tower = await ev<{ id: number; goal: number[]; x: number; z: number } | null>(
    page,
    `(() => { const r = window.__range; const d = r.duel(); const t = r.brMap.towers[0]; if (!t) return null; const b = d.bots.find((x) => x.bot.alive && !x.down && !x.bot.travel && !x.bot.dropping); if (!b) return null;
      b.bot.pos.set(t.x, t.y ?? 0, t.z); b.bot.dummy.group.position.copy(b.bot.pos); b.bot.travel = null;
      const far = { x: t.x + 150, z: t.z + 60 }; const nodes = r.brMap.nodes; let best = 0, bd = Infinity; nodes.forEach((n, i) => { const dd = Math.hypot(n.x - far.x, n.z - far.z); if (dd < bd) { bd = dd; best = i; } });
      b.node = best; b.goal = best; b.ropeTo = null;
      for (const o of d.bots) if (o !== b) o.bot.pos.set(t.x + 220, 0, t.z + 220);
      return { id: b.bot.remote.id, goal: [nodes[best].x, nodes[best].z], x: t.x, z: t.z }; })()`
  );
  const rode2 = !!tower && (await page.waitForFunction(`window.__range.duel().bots.find((x) => x.bot.remote.id === ${tower?.id ?? -1})?.bot.dropping === true`, { polling: 50, timeout: 4000 }).then(() => true, () => false));
  const up = tower ? await ev<number>(page, `(() => { const b = window.__range.duel().bots.find((x) => x.bot.remote.id === ${tower.id}); return b.bot.pos.y; })()`) : -1;
  if (tower) await page.waitForFunction(`!window.__range.duel().bots.find((x) => x.bot.remote.id === ${tower.id})?.bot.dropping`, { polling: 200, timeout: 30000 }).catch(() => undefined);
  const went = tower ? await ev<number>(page, `(() => { const b = window.__range.duel().bots.find((x) => x.bot.remote.id === ${tower.id}); return Math.hypot(b.bot.pos.x - ${tower.x}, b.bot.pos.z - ${tower.z}); })()`) : -1;
  check("traversal: a bot at a jump tower with a long way to go rides it and glides on", rode2 && up > 40 && went > 40, JSON.stringify({ tower, rode2, up: +up.toFixed(1), went: +went.toFixed(1) }));
  await ev(page, "window.__range.duel()?.leave()");
  await page.waitForFunction("window.__range.duel() === null", { polling: 100, timeout: 5000 }).catch(() => undefined);
  const afterOpen = await ev<number>(page, "window.__range.brMap.doors.openList().length");
  check("doors: leaving the match shuts every door again, for the next", afterOpen === 0, `${afterOpen} open`);
  await page.close();
}

async function brTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  await ev(page, brRow("solo", 5));
  await ev(page, `(() => { document.getElementById("brStart").value = "loadout"; document.getElementById("goBr").click(); document.getElementById("startMode").click(); })()`);
  await sleep(400);
  const drop = await ev<{ y: number; phase: string; dropping: boolean; poi: string; alive: number; bounds: boolean }>(
    page,
    `(() => { const d = window.__range.duel(); const h = d.hud().br; const p = window.__range.player.pos; return { y: p.y, phase: d.phase, dropping: h.dropping, poi: h.poi, alive: h.alive, bounds: p.z > 280 && p.z < 720 }; })()`
  );
  check("the drop starts high over one of the nine places, six in the match", drop.y > 40 && drop.dropping && /HUB|YARD|DEPOT|RIDGE|TOWN|FARM|STORE|PENS|WORKS/.test(drop.poi) && drop.alive === 6 && drop.bounds, JSON.stringify(drop));
  // the match's own hour, from its seed; "always my time of day" keeps yours, and back
  const sky = await ev<{ id: string; want: string; mine: string; back: string }>(
    page,
    `(() => { const R = window.__range; const want = R.sky.matchFor(R.duel().seed); const id = R.sky.id; const sel = document.getElementById("skyBr");
      // your own hour, one the match did not draw, so keeping it shows
      localStorage.setItem("range.sky.hour", R.sky.ids.find((h) => h !== want));
      sel.value = "mine"; sel.dispatchEvent(new Event("change")); const mine = R.sky.id;
      sel.value = "match"; sel.dispatchEvent(new Event("change")); return { id, want, mine, back: R.sky.id }; })()`
  );
  const own = await ev<string>(page, `localStorage.getItem("range.sky.hour")`);
  check("the sky: the match is played at its seed's hour; 'always my time of day' keeps yours", sky.id === sky.want && sky.mine === own && own !== sky.want && sky.back === sky.want, JSON.stringify({ ...sky, own }));
  const early = await ev<number>(page, `(() => { const d = window.__range.duel(); const now = performance.now() / 1000; return d.bots.filter((b) => b.armedAt <= now).length; })()`);
  check("landing: nobody's gun works while the drop is still coming down", early === 0, `${early} armed`);
  // the skydive's two states in the page: after its first moments the drop's
  // map steps aside, and where you look is the trade between falling and travelling
  const glideAt = await ev<{ map: boolean; k: number; fall: number; air: boolean }>(
    page,
    `new Promise((ok) => { const R = window.__range; R.player.pitch = 0; setTimeout(() => ok({ map: !!R.hud.last?.mapOpen, k: R.hud.last?.dive?.k ?? -1, fall: -R.player.vel.y, air: R.player.dropping }), 2800); })`
  );
  check("the skydive: the map steps aside after the drop's first moments, and looking level glides (12 m/s down)", !glideAt.map && glideAt.k === 0 && glideAt.air && Math.abs(glideAt.fall - 12) < 0.6, JSON.stringify(glideAt));
  const diveAt = await ev<{ k: number; fall: number; air: boolean }>(
    page,
    `new Promise((ok) => { const R = window.__range; R.player.pitch = -89; setTimeout(() => ok({ k: R.hud.last?.dive?.k ?? -1, fall: -R.player.vel.y, air: R.player.dropping }), 1200); })`
  );
  check("and looking down dives (30 m/s)", diveAt.k === 1 && (!diveAt.air || diveAt.fall > 27), JSON.stringify(diveAt));
  const landed = await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 40000 }).then(() => true, () => false);
  check("the fight starts when you land", landed, await ev<string>(page, "String(window.__range.duel()?.phase)"));
  // the owner landed beside bots and died before the drop finished. They take
  // the OTHER places now, and a bot's gun does not work for the first seconds
  // after ITS landing, taken here the moment you touch down.
  const landing = await ev<{ nearest: number; poi: string }>(
    page,
    `(() => { const d = window.__range.duel(); const me = window.__range.player.pos;
      let nearest = Infinity;
      for (const a of d.avatars) nearest = Math.min(nearest, Math.hypot(a.group.position.x - me.x, a.group.position.z - me.z));
      return { nearest, poi: d.hud().br.poi }; })()`,
  );
  // the map itself: nine places, ziplines out of each, towers to ride up
  const shape = await ev<{ pois: number; zips: number; towers: number; pads: number }>(
    page,
    `(() => { const m = window.__range.brMap; return { pois: m.pois.length, zips: window.__range.ziplines.filter((z) => z.a.z > 280 && z.a.z < 720).length, towers: m.towers.length, pads: m.pads.length }; })()`
  );
  check("the map: nine places, ziplines off them, jump towers and launch pads", shape.pois === 9 && shape.zips >= 8 && shape.towers >= 3 && shape.pads >= 2, JSON.stringify(shape));  // how far the open map is drawn: the fog ends where this preset draws, and
  // the camera's far plane sits beyond it. It used to be a fixed 400 m while
  // the fog reached 680, so a ridge in clear air was cut off at the seam.
  // the sky is the range's to build and everyone's to stand under: it sat on
  // the range's side of the world, so the battle royale was played under a
  // black sky from Milestone 100 until a picture of the map's corner showed it
  const dome = await ev<{ there: boolean; visible: boolean; under: string; shown: string }>(page, "window.__range.skyDome()");
  check("the sky is over the battle royale too, not left behind with the range", dome.there && dome.visible && dome.under !== "range-side" && dome.shown !== "range", JSON.stringify(dome));
  const view = await ev<{ near: number; far: number; camFar: number; draws: number }>(page, "window.__range.viewRange()");
  check("the open map is drawn as far as the preset says, and the far plane is beyond the fog", view.far === Math.min(680, view.draws) && view.camFar > view.far && view.near > 20, JSON.stringify(view));
  await navChecks(page);
  check("landing: no bot drops on your place, so the nearest is a long way off", landing.nearest > 60, `${landing.nearest.toFixed(0)} m to the nearest bot at ${landing.poi}`);

  await sleep(300);
  const bots = await ev<{ n: number; onGround: boolean; feet: number }>(page, `(() => { const d = window.__range.duel(); const a = d.avatars; return { n: a.length, onGround: a.every((x) => x.group.position.y < 20), feet: window.__range.player.pos.y }; })()`);
  check("five bots dropped in and are on the map", bots.n === 5 && bots.onGround, JSON.stringify(bots));
  check("no fall stun off the drop: you are standing on something", bots.feet >= 0 && bots.feet < 20, `${bots.feet.toFixed(1)} m`);

  // ---- the match rules (src/config/br.json): solo, the care package's
  // arrival, the loadout crate, Storm Surge. Every notice from here on is
  // kept, because the HUD shows one at a time and the next can replace one
  // before it is read. The bots hold their fire, so what hurts you is the rule.
  await ev(page, `(() => { const d = window.__range.duel(); const say = d.onNotice; window.__notices = []; d.onNotice = (t) => { window.__notices.push(t); say?.(t); }; const end = d.onEnd; d.onEnd = (why) => { window.__ended = why + " (" + d.phase + ", alive " + d.alive + ")"; end?.(why); }; d.holdFire = true; })()`);
  const solo = await ev<{ id: string; team: number; squads: number; total: number }>(page, `(() => { const d = window.__range.duel(); const h = d.hud().br; return { id: d.team.id, team: h.team, squads: h.squadsTotal, total: h.total }; })()`);
  check("solo: the row's size is the match's, a squad of one, and a placement is out of everyone", solo.id === "solo" && solo.team === 1 && solo.squads === 6 && solo.total === 6, JSON.stringify(solo));
  // A care package is called before it can be seen: the notice names the
  // place, a ping of its own marks it without taking yours, the horn goes to
  // the page's audio, and it is on the maps while the sky is still empty.
  const called = await ev<{ notice: string; marks: Array<{ label: string; mine: boolean }>; horn: boolean; onMap: boolean; inSky: boolean }>(
    page,
    `(() => { const r = window.__range; const d = r.duel(); const p = r.player.pos;
      r.brPlay.addMarker("go", p.clone(), "GOING HERE", d.id, -1, r.gameTime());
      const fx = r.remoteFxLog.length;
      d.addPod(new r.THREE.Vector3(p.x + 30, 0, p.z), ${brCfg.pod.announce + lootCfg.podFall});
      return { notice: window.__notices.at(-1) ?? "", marks: r.brPlay.markers.map((m) => ({ label: m.label, mine: m.from === d.id })), horn: r.remoteFxLog.slice(fx).some((e) => e.k === "pod"), onMap: d.hud().br.pods.some((x) => !x.landed && !x.loadout), inSky: d.pods.at(-1).obj.visible }; })()`
  );
  check(
    "care package: called before it is seen: the place named, pinged beside your own ping, the horn, on the map, the sky still empty",
    /^CARE PACKAGE INBOUND  ·  [A-Z]/.test(called.notice) && called.marks.some((m) => m.label === "CARE PACKAGE" && !m.mine) && called.marks.some((m) => m.label === "GOING HERE" && m.mine) && called.horn && called.onMap && !called.inSky,
    JSON.stringify(called)
  );
  await sleep(400);
  const seenEarly = await ev<boolean>(page, "window.__range.duel().pods.at(-1).obj.visible");
  // the announce brought to its end: into the sky, under its canopy, smoke behind it
  await ev(page, `(() => { const p = window.__range.duel().pods.at(-1); p.landsAt = performance.now() / 1000 + p.fallFor * 0.6; })()`);
  await sleep(400);
  const falling = await ev<{ inSky: boolean; y: number; canopy: boolean; puffs: number }>(page, `(() => { const p = window.__range.duel().pods.at(-1); return { inSky: p.obj.visible, y: p.obj.position.y, canopy: p.canopy.visible, puffs: p.trail.children.length }; })()`);
  check("care package: then it is in the sky, falling under a canopy with smoke behind it", !seenEarly && falling.inSky && falling.y > 1 && falling.y < brCfg.pod.height && falling.canopy && falling.puffs > 0, JSON.stringify({ seenEarly, ...falling }));
  const fx1 = await ev<number>(page, "window.__range.remoteFxLog.length");
  await ev(page, `(() => { const p = window.__range.duel().pods.at(-1); p.landsAt = performance.now() / 1000 + 0.1; })()`);
  await sleep(500);
  const down = await ev<{ landed: boolean; hot: boolean; canopy: boolean; dust: boolean; thump: boolean; said: boolean }>(
    page,
    `(() => { const r = window.__range; const d = r.duel(); const p = d.pods.at(-1); const h = d.hud().br.pods.find((x) => !x.loadout); return { landed: !!h?.landed, hot: !!h?.hot, canopy: p.canopy.visible, dust: !!p.dust, thump: r.remoteFxLog.slice(${fx1}).some((e) => e.k === "pod"), said: window.__notices.some((t) => /^CARE PACKAGE DOWN/.test(t)) }; })()`
  );
  check("care package: it lands in a ring of dust, the canopy cut loose, with a thump, and stays lit to be fought over", down.landed && down.hot && !down.canopy && down.dust && down.thump && down.said, JSON.stringify(down));
  // The loadout crate hands you the loadout you built: the saved one (Heavy
  // here), both guns kitted a magazine up, into your two slots, with ammo.
  const pickedBefore = await ev<{ kind: string; index: number }>(page, "window.__range.loadouts.selected");
  const cratePos = (await ev<{ x: number; z: number } | null>(page, "window.__range.openGround(window.__range.player.pos.x, window.__range.player.pos.z, 3)")) ?? { x: 0, z: 500 };
  // what you had, and how much more of each would fit: a crate can only hand
  // over what the pouch has room for, and a spawn kit can already fill it
  const { stock: ammo0, room: room0 } = await ev<{ stock: Record<string, number>; room: Record<string, number> }>(
    page,
    `(() => { const r = window.__range; r.loadouts.select({ kind: "default", index: 3 }); r.player.teleport(${cratePos.x}, 0, ${cratePos.z}, 0); r.duel().addPod(new r.THREE.Vector3(${cratePos.x}, 0, ${cratePos.z}), 0.2, "loadout"); const a = r.loadout.ammo; return { stock: { ...a.stock }, room: Object.fromEntries(Object.keys(a.stock).map((t) => [t, a.room(t)])) }; })()`
  );
  await sleep(1300);
  const claiming = await ev<{ hold: { label: string; progress: number } | null; crate: number | null }>(page, "({ hold: window.__range.hud.last?.brHold ?? null, crate: window.__range.duel().hud().br.crate })");
  check("loadout crate: stood on, the claim fills in the HUD's hold bar", !!claiming.hold && /LOADOUT CRATE/.test(claiming.hold.label) && claiming.crate !== null && claiming.crate > 0 && claiming.crate < 1, JSON.stringify(claiming));
  await sleep(2200);
  const got = await ev<{ want: string[]; ids: string[]; empty: boolean[]; mags: number[]; fitted: number[]; ammo: Record<string, number> }>(
    page,
    `(() => { const r = window.__range; const def = r.loadouts.current; return { want: [def.slot1, def.slot2], ids: r.loadout.slots.map((s) => s.id), empty: r.loadout.slots.map((s) => s.empty), mags: r.loadout.slots.map((s) => s.magLevel), fitted: r.loadout.slots.map((s) => Object.keys(s.attach).length), ammo: { ...r.loadout.ammo.stock } }; })()`
  );
  const types = [...new Set(got.want.map((id) => (ammoCfg.types as Record<string, string>)[id] ?? "light"))].filter((t) => t !== "energy");
  const stacks = ammoCfg.stacks as Record<string, number>;
  const ammoOk = types.every((t) => got.ammo[t] - ammo0[t] === Math.min(room0[t], t === "arrows" ? stacks.arrows : stacks[t] * brCfg.loadoutPod.stacks));
  check(
    "loadout crate: it hands you your saved loadout's two guns, kitted and a magazine up, with their ammo",
    got.ids.join() === got.want.join() && got.empty.every((e) => !e) && got.mags.every((m) => m === brCfg.loadoutPod.mag) && got.fitted.every((n) => n > 0) && ammoOk,
    JSON.stringify({ ...got, before: ammo0, room: room0, types })
  );
  await ev(page, `window.__range.loadout.give(0, "r97")`);
  await sleep(2800);
  const once = await ev<{ id0: string; crate: number | null; match: boolean; ended: string | null }>(page, "({ id0: window.__range.loadout.slots[0].id, crate: window.__range.duel()?.hud().br.crate ?? null, match: !!window.__range.duel(), ended: window.__ended ?? null })");
  check("loadout crate: once each: standing on it after the claim hands nothing more", once.match && once.id0 === "r97" && once.crate === null, JSON.stringify(once));
  if (!once.match) {
    await page.close();
    return;
  }
  await ev(page, `window.__range.loadouts.select(${JSON.stringify(pickedBefore)})`);
  // Storm Surge. The ring held in its fourth round (its circle does not
  // move), and six alive where three are allowed: it is called with a
  // countdown first.
  await ev(page, `(() => { const r = window.__range.duel().ring; window.__ringWas = { phase: r.phase, state: r.state, timeLeft: r.timeLeft }; r.phase = ${brCfg.surge.fromPhase}; r.state = "waiting"; r.timeLeft = 1e6; })()`);
  await sleep(400);
  const warned = await ev<{ surge: { live: boolean; startsIn: number } | null; said: boolean }>(page, `({ surge: window.__range.duel().hud().br.surge, said: window.__notices.some((t) => t.startsWith("STORM SURGE IN ${brCfg.surge.warn}")) })`);
  check("storm surge: late, with more alive than the ring allows, it is called with a countdown before it bites", !!warned.surge && !warned.surge.live && warned.surge.startsIn > brCfg.surge.warn - 2 && warned.surge.startsIn <= brCfg.surge.warn && warned.said, JSON.stringify(warned));
  // You have dealt nothing and every bot something: you are below the line.
  // The countdown skipped, it goes live and takes its tick wherever you stand.
  await ev(page, "(() => { const d = window.__range.duel(); d.dealt.clear(); for (const b of d.bots) d.dealt.set(b.bot.remote.id, { total: 999, at: -1e9 }); d.surgeAt = performance.now() / 1000; })()");
  await sleep(300);
  const hp0 = await ev<{ hp: number; surge: { live: boolean; safe: boolean; below: number } | null }>(page, "(() => { const d = window.__range.duel(); return { hp: d.shield + d.health, surge: d.hud().br.surge }; })()");
  await sleep(1800);
  const hp1 = await ev<number>(page, "(() => { const d = window.__range.duel(); return d.shield + d.health; })()");
  check("storm surge: live, whoever has dealt the least takes a tick wherever they stand, and the HUD says it is you", !!hp0.surge && hp0.surge.live && !hp0.surge.safe && hp0.surge.below >= 1 && hp0.hp - hp1 >= brCfg.surge.damage[0], JSON.stringify({ ...hp0, after: hp1 }));
  // back to the ring's own round: it no longer applies, so it ends and says so
  await ev(page, "Object.assign(window.__range.duel().ring, window.__ringWas)");
  await sleep(400);
  const ended = await ev<{ surge: unknown; said: boolean }>(page, `({ surge: window.__range.duel().hud().br.surge, said: window.__notices.includes("STORM SURGE OVER") })`);
  check("storm surge: once it no longer applies it ends, and says so", ended.surge === null && ended.said, JSON.stringify(ended));

  // a knock: the bot's own hit() takes the damage, localHit credits it
  await ev(page, `(() => { const d = window.__range.duel(); const a = d.avatars.find((x) => !x.knocked); const r = d.remoteOf(a); a.hit(0, "body", 500, 1, 1, a.group.position); d.localHit(r, 500, false); })()`);
  const afterKill = await ev<{ kills: number; alive: number }>(page, `(() => { const h = window.__range.duel().hud().br; return { kills: h.kills, alive: h.alive }; })()`);
  check("a knock counts and the alive count drops", afterKill.kills === 1 && afterKill.alive === 5, JSON.stringify(afterKill));
  // EVO the way Season 30 counts it: a knock through the bullets' own path is its damage plus 150
  await ev(page, "window.__range.duel().holdFire = true");
  const alive = () => ev<number[]>(page, "(() => { const d = window.__range.duel(); return d.avatars.filter((a) => !a.knocked).map((a) => d.remoteOf(a).id); })()");
  let ids = await alive();
  const evo0 = await ev<number>(page, "window.__range.armor.evo");
  await ev(page, `window.__range.hitThrough(${ids[0]}, 500)`);
  const evo1 = await ev<number>(page, "window.__range.armor.evo");
  check("EVO: a knock earns 150 on top of the damage dealt", evo1 - evo0 >= 150 + 50, `${evo0} -> ${evo1}`);
  // a bot's knock is its death: the kill marker (not a hit's), and the feed says eliminated
  const kill = await ev<{ mark: string; feed: string[] }>(page, "({ mark: window.__range.hud.hitMarkerKindNow, feed: window.__range.hud.feedText })");
  check("a kill confirms as one: the kill marker, and 'eliminated' in the feed", kill.mark === "kill" && kill.feed.some((t) => /eliminated BOT/.test(t)), JSON.stringify({ mark: kill.mark, feed: kill.feed.slice(0, 3) }));
  // a care package's loot: 100 once a package
  await ev(page, `window.__range.applyLoot({ kind: "heal", id: "cell", n: 1, rarity: "common", pod: 77 })`);
  await ev(page, `window.__range.applyLoot({ kind: "heal", id: "syringe", n: 1, rarity: "common", pod: 77 })`);
  const evo2 = await ev<number>(page, "window.__range.armor.evo");
  check("EVO: a care package's loot earns 100, once a package", evo2 - evo1 === 100, `${evo1} -> ${evo2}`);
  // Executioner: a knock with the Mastiff that has it brings 50 shield back over 5 s
  ids = await alive();
  await ev(page, `(() => { const l = window.__range.loadout; l.give(l.activeIndex, "mastiff", 0, { hopup: "hopup_executioner" }); window.__range.duel().shield = 0; })()`);
  await ev(page, `window.__range.hitThrough(${ids[0]}, 500)`);
  await sleep(2200);
  const exec = await ev<{ shield: number }>(page, "({ shield: window.__range.duel().shield })");
  check("Executioner: a knock with the Mastiff brings shield back (10 a second)", exec.shield >= 12 && exec.shield <= 40, JSON.stringify(exec));
  // a Peacekeeper off the floor: Executioner fitted but locked, unlocking with the damage done with it
  await ev(page, `window.__range.applyLoot({ kind: "weapon", id: "energy_shotgun", n: 1, rarity: "rare" })`);
  const lock = await ev<{ mod: string; need: number } | null>(page, "window.__range.loadout.active.hopLock ?? null");
  check("a Peacekeeper off the floor comes with Executioner locked until 275 damage", lock?.mod === "hopup_executioner" && lock.need === 275, JSON.stringify(lock));
  ids = await alive();
  await ev(page, "window.__range.loadout.active.hopLock.need = 150");
  await ev(page, `window.__range.hitThrough(${ids[0]}, 100)`);
  await ev(page, `window.__range.hitThrough(${ids[0]}, 100)`);
  const unlocked = await ev<{ lock: unknown; hop: string | null }>(page, "({ lock: window.__range.loadout.active.hopLock ?? null, hop: window.__range.loadout.active.attach.hopup ?? null })");
  check("and once the damage is done it unlocks, fitted", unlocked.lock === null && unlocked.hop === "hopup_executioner", JSON.stringify(unlocked));
  // Fusion (br.json fusion): the R-301 you carry, found again, is a better R-301, not a second one
  const fuse0 = await ev<{ ids: string[]; mag: number; light: number; fused: number }>(
    page,
    `(() => { const r = window.__range; const l = r.loadout; l.give(l.activeIndex, "rspn101", 0, {}); l.ammo.stock.light = 0; return { ids: l.slots.map((s) => s.id), mag: l.active.magLevel, light: l.ammo.stock.light, fused: r.fused() }; })()`
  );
  await ev(page, `window.__range.applyLoot({ kind: "weapon", id: "rspn101", n: 1, rarity: "rare", mag: 0, attach: { optic: "optic_cq_hcog_classic" } })`);
  const fuse1 = await ev<{ ids: string[]; mag: number; light: number; fused: number; optic: string | null }>(
    page,
    `(() => { const r = window.__range; const l = r.loadout; return { ids: l.slots.map((s) => s.id), mag: l.active.magLevel, light: l.ammo.stock.light, fused: r.fused(), optic: l.active.attach.optic ?? null }; })()`
  );
  check(
    "fusion: picking up the gun you carry makes it better (a magazine level, the attachment it lacked, a stack of ammo) instead of a second copy",
    fuse1.ids.join() === fuse0.ids.join() && fuse1.mag === fuse0.mag + 1 && fuse1.light > fuse0.light && fuse1.fused === fuse0.fused + 1 && fuse1.optic === "optic_cq_hcog_classic",
    JSON.stringify({ before: fuse0, after: fuse1 })
  );
  // (Executioner's shield done coming back before the ring's damage is measured)
  await page.waitForFunction("!window.__range.kdState().exec", { polling: 100, timeout: 8000 }).catch(() => undefined);
  // outside the ring: a corner of the map is outside ring 1
  await ev(page, "window.__range.player.teleport(215, 0, 715, 0)");
  const before = await ev<number>(page, "window.__range.duel().shield + window.__range.duel().health");
  await sleep(3500);
  const outside = await ev<{ hp: number; out: boolean }>(page, `(() => { const d = window.__range.duel(); return { hp: d.shield + d.health, out: d.hud().br.ring.outside }; })()`);
  check("outside the ring you take its damage", outside.out && outside.hp < before, `${before} -> ${outside.hp}`);
  // eliminated by the ring: no killcam (nobody to watch), a recap that says so
  const ringPage = await open(browser, query);
  await ev(ringPage, brRow("solo", 3));
  await ev(ringPage, `(() => { document.getElementById("brStart").value = "loadout"; document.getElementById("goBr").click(); document.getElementById("startMode").click(); })()`);
  await ringPage.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 40000 });
  await ev(ringPage, "(() => { window.__range.player.teleport(215, 0, 715, 0); const d = window.__range.duel(); d.shield = 0; d.health = 1; })()");
  const ringOut = await ringPage.waitForFunction("!window.__range.duel()?.alive", { polling: 200, timeout: 8000 }).then(() => true, () => false);
  const ringRc = await ev<{ byRing: boolean; killerName: string } | null>(ringPage, "window.__range.recap()");
  const ringKc = await ev<{ active: boolean }>(ringPage, "window.__range.killcamState()");
  check("recap: out to the ring: no killcam, the recap says the ring", ringOut && !!ringRc?.byRing && !ringKc.active, JSON.stringify({ ringRc, ringKc }));
  // solo: that knock was the end, not a down: out, the match over at once,
  // placed behind every bot still up, out of everyone
  const soloEnd = await ev<{ downed: boolean; alive: boolean; phase: string; placement: number | null; squads: number; bots: number } | null>(
    ringPage,
    `(() => { const d = window.__range.duel(); if (!d) return null; const h = d.hud().br; return { downed: d.downed, alive: d.alive, phase: d.phase, placement: h.placement, squads: h.squadsTotal, bots: d.bots.filter((b) => b.bot.alive).length }; })()`
  );
  check("solo: a knock is the end: out rather than down, the match over, placed behind every bot still up", !!soloEnd && !soloEnd.downed && !soloEnd.alive && soloEnd.phase === "matchEnd" && soloEnd.placement === soloEnd.bots + 1 && soloEnd.squads === 4, JSON.stringify(soloEnd));
  await ev(ringPage, "window.__range.duel()?.leave()");
  await ringPage.close();
  // a heal: a cell brings the shield up by 25 in 2.5 s of the game's time, and costs one of four
  await ev(page, "(() => { window.__range.duel().holdFire = true; window.__range.player.teleport(0, 0, 500, 0); })()");
  await sleep(300);
  const cellsBefore = await ev<number>(page, "window.__range.kit.items.cell");
  await ev(page, "window.__range.startHeal()");
  const shieldBefore = await ev<number>(page, "window.__range.duel().shield");
  await page.waitForFunction(`window.__range.kit.items.cell < ${cellsBefore}`, { polling: 100, timeout: 10000 }).catch(() => undefined);
  const healed = await ev<{ shield: number; cells: number; max: number }>(page, "({ shield: window.__range.duel().shield, cells: window.__range.kit.items.cell, max: window.__range.duel().shieldMax })");
  check("a shield cell heals 25 shield and is spent", healed.shield === Math.min(healed.max, shieldBefore + 25) && healed.cells === cellsBefore - 1, JSON.stringify({ shieldBefore, cellsBefore, ...healed }));
  // the controller's Default: RB twice pings an enemy there; D-pad up heals
  await pressPlay(page);
  await padTap(page, 5, 60);
  await padTap(page, 5, 60);
  const enemyPing = await ev<boolean>(page, "window.__range.brPlay.markers.some((m) => m.k === 'enemy' && m.label === 'ENEMY HERE' && m.from === window.__range.duel().id)");
  check("pad: RB twice quickly is an enemy ping where you look (the game's double tap)", enemyPing, JSON.stringify(await ev(page, "window.__range.brPlay.markers.map((m) => m.label)")));
  await ev(page, "window.__range.duel().shield = 0");
  await padTap(page, 12, 80);
  const padHeal = await ev<string | null>(page, "window.__range.hud.last?.heal?.item ?? null");
  check("pad: D-pad up (a tap) is the quick heal", padHeal !== null, String(padHeal));
  await sleep(1500);
  await ev(page, "window.__range.duel().leave()");
  await sleep(300);
  check("leaving ends the battle royale", (await ev<boolean>(page, "window.__range.duel() === null")));
  check("and the sky is your own hour again", (await ev<string>(page, "window.__range.sky.id")) === own, await ev<string>(page, "window.__range.sky.id"));
  // the pages share one browser's storage: no later page starts on this hour
  await ev(page, `localStorage.removeItem("range.sky.hour")`);
  await page.close();
}

/**
 * A battle royale that starts with nothing: two empty slots and fists, the
 * floor's loot laid out, E takes the item under the crosshair, a second gun
 * fills the other slot, a third goes in place of the one in hand (which goes
 * down where you stand), ammo, a heal past its stack, a mag onto the gun that
 * takes it, a helmet; what you had, loose where you fall; the bots search before they are armed.
 */
async function brLootTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  // trios, the default size: the three bots are one squad of three
  await ev(page, brRow("trio", 3));
  await ev(page, `(() => { document.getElementById("brStart").value = "loot"; document.getElementById("goBr").click(); document.getElementById("startMode").click(); })()`);
  await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 40000 });
  await sleep(300);
  await ev(page, "window.__range.duel().holdFire = true");
  const start = await ev<{ empty: boolean; kit: number; field: number; light: number; weapon: string; botsArmed: number; looted: number; sight: number[] }>(
    page,
    `(() => { const r = window.__range; const d = r.duel(); return { empty: r.loadout.slots.every((s) => s.empty), kit: r.kit.total, field: d.lootField ? d.lootField.count : 0, light: r.loadout.ammo.stock.light, weapon: r.hud.last?.weaponName ?? "", botsArmed: d.bots.filter((b) => b.armedShown).length, looted: d.bots.filter((b) => b.armedShown && b.bot.lootKit.gunId !== null && b.bot.lootKit.taken > 0).length, sight: d.bots.map((b) => Math.round(b.bot.sight)) }; })()`
  );
  check("loot: you land with nothing (two empty slots, fists, no heals, no ammo) on a floor of items", start.empty && start.kit === 0 && start.light === 0 && start.field > 100 && start.weapon === "FISTS", JSON.stringify(start));
  // the hot zone: the place this match kitted out, which nothing showed before
  const hot = await ev<{ name: string; x: number; z: number; radius: number; poi: boolean; kitted: number } | null>(
    page,
    `(() => { const r = window.__range; const d = r.duel(); const h = d.hud().br.hot; if (!h) return null;
      const poi = r.brMap.pois.some((p) => p.name === h.name);
      // the guns lying in it that came built, which is what makes it hot
      const drops = d.lootField ? [...d.lootField.drops.values()] : [];
      const near = drops.filter((x) => x.item.kind === "weapon" && Math.hypot(x.pos.x - h.x, x.pos.z - h.z) < h.radius);
      const kitted = near.filter((x) => (x.item.attach && Object.keys(x.item.attach).length > 0) || (x.item.mag ?? 0) > 0).length;
      return { name: h.name, x: h.x, z: h.z, radius: h.radius, poi, kitted }; })()`
  );
  check("the hot zone: this match kitted one of the places out, and the map can say which", !!hot && hot.poi && hot.radius > 10 && hot.kitted >= 1, JSON.stringify(hot));
  // A bot lands with nothing and LOOTS its gun off the floor, so one that came
  // down a few seconds before you may already have one. What must never
  // happen is a bot holding a gun it did not find.
  check("loot: the bots land unarmed and search first: any bot with a gun looted it", start.botsArmed === start.looted, JSON.stringify({ armed: start.botsArmed, looted: start.looted }));
  check("loot: the bots see with the battle royale's range, not the arena's 60 m", start.sight.length > 0 && start.sight.every((m) => m >= 60) && start.sight.some((m) => m > 70), JSON.stringify(start.sight));
  // The places are buildings now, so the loot has to be IN them: a spot picks
  // any floor at that point with headroom, which is what puts items upstairs
  // and on roofs. Before the buildings, a spot under anything was refused
  // outright and every item ended up outdoors.
  const spread = await ev<{ total: number; upstairs: number; guns: number }>(
    page,
    `(() => { const lf = window.__range.duel().lootField; const all = [...lf.drops.values()];
      const y = (d) => (d.at ? d.at.y : d.pos ? d.pos.y : 0);
      return { total: all.length, upstairs: all.filter((d) => y(d) > 1.5).length, guns: all.filter((d) => (d.item?.kind ?? d.kind) === "weapon").length }; })()`
  );
  check("loot: the map carries hundreds of items, a couple of hundred of them guns", spread.total > 500 && spread.guns > 120, JSON.stringify(spread));
  check("loot: a good share of it is upstairs and on roofs, not all on the sand", spread.upstairs > 80, `${spread.upstairs} of ${spread.total} above ground`);
  // an R-97 on the ground in front, looked at; E takes it (through the game's own E)
  // open ground to stand on, the item 1.6 m ahead, looked at from 45 degrees down
  const spot = await ev<{ x: number; z: number } | null>(page, "window.__range.openGround(window.__range.player.pos.x, window.__range.player.pos.z)");
  check("loot: there is open ground near the landing", spot !== null, JSON.stringify(spot));
  const S = spot ?? { x: 0, z: 500 };
  const place = (item: string) => `(() => {
      const r = window.__range; const f = r.duel().lootField;
      r.player.teleport(${S.x}, 0, ${S.z}, 0, -45);
      for (const k of [...f.drops.keys()]) { const x = f.drops.get(k); if (x && Math.hypot(x.pos.x - ${S.x}, x.pos.z - ${S.z}) < 6) f.remove(k); }
      f.add(${item}, new r.THREE.Vector3(${S.x}, 0, ${S.z} - 1.6));
    })()`;
  const take = async (item: string): Promise<void> => {
    await ev(page, place(item));
    await sleep(150);
    await ev(page, `window.__range.setScript({ held: () => false, pressedNow: (a) => a === "interact" })`);
    await sleep(250);
    await ev(page, "window.__range.setScript(null)");
    await sleep(100);
  };
  await ev(page, place(`{ kind: "weapon", id: "r97", n: 1, rarity: "rare" }`));
  await ev(page, "window.__range.setScript({ held: () => false, pressedNow: () => false })");
  await sleep(200);
  const prompt = await ev<string>(page, "JSON.stringify(window.__range.brPlay.hud.prompt)");
  check("loot: looking at an item gives the TAKE prompt", /TAKE/.test(prompt), prompt);
  await ev(page, "window.__range.setScript(null)");
  await take(`{ kind: "weapon", id: "r97", n: 1, rarity: "rare" }`);
  const one = await ev<{ ids: string[]; empty: boolean[]; weapon: string }>(page, "(() => { const r = window.__range; return { ids: r.loadout.slots.map((s) => s.id), empty: r.loadout.slots.map((s) => s.empty), weapon: r.hud.last?.weaponName ?? '' }; })()");
  check("loot: E takes the gun into an empty slot, and it is in hand", one.empty.filter((e) => !e).length === 1 && one.ids.includes("r97") && one.weapon !== "FISTS", JSON.stringify(one));
  await take(`{ kind: "weapon", id: "hemlok", n: 1, rarity: "rare" }`);
  await sleep(700);
  await take(`{ kind: "weapon", id: "wingman", n: 1, rarity: "rare" }`);
  const three = await ev<{ ids: string[]; dropped: boolean }>(page, `(() => { const r = window.__range; const f = r.duel().lootField; return { ids: r.loadout.slots.map((s) => s.id), dropped: [...f.drops.values()].some((x) => x.item.kind === "weapon" && Math.hypot(x.pos.x - ${S.x}, x.pos.z - ${S.z}) < 3) }; })()`);
  check("loot: a second gun fills the other slot, a third goes in place of the one in hand, which goes down", three.ids.includes("wingman") && three.ids.filter((i) => i === "r97" || i === "hemlok").length === 1 && three.dropped, JSON.stringify(three));
  await ev(page, `window.__range.applyLoot({ kind: "ammo", id: "heavy", n: 60, rarity: "common" })`);
  await ev(page, `window.__range.applyLoot({ kind: "heal", id: "battery", n: 3, rarity: "rare" })`);
  const packed = await ev<{ heavy: number; batts: number; putBack: boolean }>(page, `(() => { const r = window.__range; const f = r.duel().lootField; return { heavy: r.loadout.ammo.stock.heavy, batts: r.kit.items.battery, putBack: [...f.drops.values()].some((x) => x.item.kind === "heal" && x.item.id === "battery" && x.item.n === 1) }; })()`);
  check("loot: ammo into the pack; three batteries where two fit: two taken, one back on the ground", packed.heavy === 60 && packed.batts === 2 && packed.putBack, JSON.stringify(packed));
  await ev(page, `window.__range.applyLoot({ kind: "helmet", id: "gold", n: 1, rarity: "legendary" })`);
  const helm = await ev<string | null>(page, "window.__range.armor.helmet");
  check("loot: a helmet goes on", helm === "gold", String(helm));
  // A backpack: more room for every heal, and a worse one stays on the floor.
  const packs = await ev<{ before: number; after: number; pack: string; kept: string }>(
    page,
    `(() => { const r = window.__range; const before = r.kit.room.battery + r.kit.items.battery;
      r.applyLoot({ kind: "backpack", id: "gold", n: 1, rarity: "legendary" });
      const after = r.kit.room.battery + r.kit.items.battery; const pack = r.kit.pack;
      r.applyLoot({ kind: "backpack", id: "blue", n: 1, rarity: "rare" });
      return { before, after, pack, kept: r.kit.pack }; })()`
  );
  check("loot: a gold backpack fits more batteries, and a blue one after it stays down", packs.pack === "gold" && packs.after > packs.before && packs.kept === "gold", JSON.stringify(packs));
  // A knockdown shield off the floor: a gold one carries a self-revive.
  const kdGold = await ev<{ self: boolean; looted: string | null }>(
    page,
    `(() => { const r = window.__range; r.applyLoot({ kind: "knockdown", id: "gold", n: 1, rarity: "legendary" }); return { self: r.kd.canSelfRevive, looted: r.kd.looted }; })()`
  );
  check("loot: a gold knockdown shield is taken and carries its self-revive", kdGold.self && kdGold.looted === "gold", JSON.stringify(kdGold));
  // The walk-over pickup. It shipped with its carry hook never set, so in a
  // real match it took nothing: ammo for a gun you carry, dropped at your
  // feet, has to come up with no press at all.
  const walk = await ev<{ light: number }>(
    page,
    `(() => { const r = window.__range; const f = r.duel().lootField;
      r.player.teleport(${S.x}, 0, ${S.z}, 0, -45);
      for (const k of [...f.drops.keys()]) { const x = f.drops.get(k); if (x && Math.hypot(x.pos.x - ${S.x}, x.pos.z - ${S.z}) < 6) f.remove(k); }
      const light = r.loadout.ammo.stock.light;
      f.add({ kind: "ammo", id: "light", n: 60, rarity: "common" }, new r.THREE.Vector3(${S.x} + 0.6, 0, ${S.z}));
      return { light }; })()`
  );
  await sleep(1200);
  const walked = await ev<{ light: number; left: boolean }>(
    page,
    `(() => { const r = window.__range; const f = r.duel().lootField; return { light: r.loadout.ammo.stock.light, left: [...f.drops.values()].some((x) => x.item.kind === "ammo" && x.item.id === "light" && Math.hypot(x.pos.x - ${S.x}, x.pos.z - ${S.z}) < 2) }; })()`
  );
  check("loot: ammo for the gun you carry comes up as you stand over it, no key pressed", walked.light > walk.light && !walked.left, JSON.stringify({ before: walk.light, after: walked.light, stillThere: walked.left }));
  // a care package: on the maps while it falls, then its gold gun and extras around it
  await ev(page, `(() => { const d = window.__range.duel(); const f = d.lootField; for (const k of [...f.drops.keys()]) { const x = f.drops.get(k); if (x && Math.hypot(x.pos.x - (${S.x} + 12), x.pos.z - ${S.z}) < 4) f.remove(k); } d.addPod(new window.__range.THREE.Vector3(${S.x} + 12, 0, ${S.z}), 1.2); })()`);
  const falling = await ev<number>(page, "window.__range.duel().hud().br.pods.filter((p) => !p.landed).length");
  await sleep(1800);
  const pod = await ev<{ landed: boolean; items: Array<{ kind: string; id: string; rarity: string }> }>(
    page,
    `(() => { const d = window.__range.duel(); const at = { x: ${S.x} + 12, z: ${S.z} }; return { landed: d.hud().br.pods.some((p) => p.landed), items: [...d.lootField.drops.values()].filter((x) => Math.hypot(x.pos.x - at.x, x.pos.z - at.z) < 2).map((x) => ({ kind: x.item.kind, id: x.item.id, rarity: x.item.rarity })) }; })()`
  );
  const podGun = pod.items.find((i) => i.kind === "weapon");
  check("loot: a care package shows on the map as it falls, then lands with a gold care-package gun and two more", falling === 1 && pod.landed && pod.items.length === 3 && !!podGun && ["sniper", "3030", "lstar"].includes(podGun.id) && podGun.rarity === "legendary", JSON.stringify({ falling, ...pod }));
  // out: what you had goes down loose where you fell, no box round it
  const before = await ev<number>(page, "window.__range.duel().lootField.count");
  await ev(page, "window.__range.duel().takeHit(500, 100)");
  await sleep(300);
  const box = await ev<{ alive: boolean; boxes: number; added: number }>(page, `(() => { const d = window.__range.duel(); const f = d.lootField; return { alive: d.alive, boxes: [...f.drops.values()].filter((x) => x.item.kind === "box").length, added: f.count }; })()`);
  check("loot: out, and your guns, ammo, heals and helmet go down loose where you fell, with no death box", !box.alive && box.boxes === 0 && box.added - before >= 5, JSON.stringify({ before, ...box }));
  await ev(page, "window.__range.duel()?.leave()");
  await sleep(300);
  const back = await ev<{ empty: boolean[] }>(page, "({ empty: window.__range.loadout.slots.map((s) => s.empty) })");
  check("loot: leaving gives you your own loadout back", back.empty.every((e) => !e), JSON.stringify(back));
  await page.close();
}

/** a mode alone from the Play tab's button: in the game (the pad's Start), the fight on */
async function startModePage(browser: Browser, query: string, button: string, setup = ""): Promise<Page> {
  const page = await open(browser, query);
  // the card picks the mode and the panel's own button starts it (the lobby,
  // src/ui/lobby.ts); the settings are set first, since the panel reads them
  await ev(page, `(() => { ${setup}; document.getElementById("${button}").click(); document.getElementById("startMode")?.click(); })()`);
  await pressPlay(page);
  await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 20000 }).catch(() => undefined);
  await ev(page, "(() => { const d = window.__range.duel(); if (d) d.holdFire = true; })()");
  return page;
}

/**
 * The three new arenas (src/game/arenas). One map for six modes was why
 * every mode played the same, and the owner asked for small maps for 1v1s
 * and free-for-all. Each map is started from the menu's Map picker in the
 * mode it was drawn for, and has to put you, the bots and Control's zones
 * inside ITS walls: a match that quietly stayed in the warehouse would still
 * reach the fight, so the positions are what is checked.
 */
async function arenaMapsTest(browser: Browser, query: string): Promise<void> {
  const cases: Array<{ map: string; button: string; want: string; bots: string }> = [
    { map: "vault", button: "goFfa", want: "vault", bots: "3" },
    { map: "crossing", button: "goControl", want: "crossing", bots: "3" },
    { map: "ringworks", button: "goFfa", want: "ringworks", bots: "3" },
    // "picked for the mode": SpeedKills plays its free-for-all in NEON BLOCK, its city's own arena
    { map: "auto", button: "goFfa", want: "neonblock", bots: "2" },
  ];
  for (const c of cases) {
    const page = await startModePage(browser, query, c.button, `document.getElementById("modeBots").value = "${c.bots}"; document.getElementById("arenaMap").value = "${c.map}"`);
    await sleep(2500);
    const r = await ev<{ id: string; kind: string; phase: string; me: boolean; bots: number; botsIn: number; zones: number; zonesIn: number; bounds: string }>(
      page,
      `(() => {
        const R = window.__range; const d = R.duel(); const b = d.arenaBounds; const p = R.player.pos;
        const inside = (x, z) => x >= b.minX - 0.5 && x <= b.maxX + 0.5 && z >= b.minZ - 0.5 && z <= b.maxZ + 0.5;
        const figs = d.avatars.map((a) => a.group.position);
        const zones = d.hud().mode?.control?.zones ?? [];
        return { id: d.arenaId, kind: d.modeKind, phase: d.phase, me: inside(p.x, p.z), bots: figs.length, botsIn: figs.filter((q) => inside(q.x, q.z)).length,
          zones: zones.length, zonesIn: zones.filter((z) => inside(z.at.x, z.at.z)).length, bounds: [b.minX, b.maxX, b.minZ, b.maxZ].map((v) => v.toFixed(0)).join(",") };
      })()`
    );
    check(`maps: ${c.map} for ${r.kind} opens on ${c.want}, fighting`, r.id === c.want && r.phase === "fight", JSON.stringify({ id: r.id, phase: r.phase }));
    check(`maps: on ${r.id} you and every bot stand inside its walls`, r.me && r.bots > 0 && r.botsIn === r.bots, `${r.botsIn} of ${r.bots} bots, bounds ${r.bounds}`);
    // you spawn looking down open floor, not at the cover a metre away that
    // breaks the line between opposite spawns
    const view = await ev<number>(
      page,
      `(() => { const R = window.__range; const p = R.player.pos; const y = R.player.yaw * Math.PI / 180;
        const dx = -Math.sin(y), dz = -Math.cos(y); let d = 0;
        for (; d < 30; d += 0.25) { const x = p.x + dx * d, z = p.z + dz * d;
          if (R.solids.some((s) => x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ && s.base < 1.6 && s.top > 1.6)) break; }
        return d; })()`
    );
    check(`maps: on ${r.id} you spawn facing open floor, not a box`, view >= 6, `${view.toFixed(1)} m clear ahead`);
    if (r.kind === "control") check(`maps: Control's three zones are on ${r.id}, not in the warehouse`, r.zones === 3 && r.zonesIn === 3, `${r.zonesIn} of ${r.zones}`);
    await page.close();
  }
  // the 1v1 against bots, alone, which is where a 1v1 on a small map is played
  // most: the same picker, the Vault
  const page = await startModePage(browser, query, "goBots", `document.getElementById("botCount").value = "1"; document.getElementById("arenaMap").value = "vault"`);
  await sleep(1500);
  const v = await ev<{ id: string; me: boolean; bots: number; botsIn: number; phase: string }>(
    page,
    `(() => {
      const R = window.__range; const d = R.duel(); const b = d.arenaBounds; const p = R.player.pos;
      const inside = (x, z) => x >= b.minX - 0.5 && x <= b.maxX + 0.5 && z >= b.minZ - 0.5 && z <= b.maxZ + 0.5;
      const figs = d.avatars.map((a) => a.group.position);
      return { id: d.arenaId, phase: d.phase, me: inside(p.x, p.z), bots: figs.length, botsIn: figs.filter((q) => inside(q.x, q.z)).length };
    })()`
  );
  check("maps: the 1v1 against a bot plays on the Vault when it is picked, you and the bot inside it", v.id === "vault" && v.me && v.bots === 1 && v.botsIn === 1, JSON.stringify(v));
  await page.close();
}

/**
 * A guest's rounds into a target as its gun would claim them: a shot the
 * host hears first, then R-301 rounds of 25 (the host's hit check refuses a
 * claim no round could make, or one with no shot behind it).
 */
const guestRounds = (pick: string, n: number): string =>
  `(() => { const d = window.__range.duel(); const T = window.__range.THREE; const r = [...d.remotes.values()].find((x) => ${pick}); if (!r) return false; d.localShot(new T.Vector3(), new T.Vector3(0, 0, -1), "rspn101"); for (let i = 0; i < ${n}; i++) d.localHit(r, 25, true, "rspn101"); return true; })()`;

/** a bot knocked by this player's own bullet (its dummy's hit() and the match's localHit, as the game does) */
const knockBot = (pick: string, weapon = "r97") =>
  `(() => { const d = window.__range.duel(); const a = d.avatars.find((x) => { const r = d.remoteOf(x); return r && r.id >= 100 && r.alive && (${pick}); }); if (!a) return false; const r = d.remoteOf(a); a.hit(0, "body", 900, 1, 1, a.group.position); d.localHit(r, 900, false, "${weapon}", 8); return true; })()`;

/**
 * The arena's modes alone: team deathmatch (team mates, the score, the win),
 * free-for-all and Control, each from its Play tab button.
 */
async function modesTest(browser: Browser, query: string): Promise<void> {
  // ---- team deathmatch
  // four bots to face, so your side is filled to four: a 4 v 4 like before,
  // but now because the count says so rather than a fixed team size
  const t = await startModePage(browser, query, "goTdm", `document.getElementById("modeBots").value = "4"`);
  const t0 = await ev<{ allies: number; enemies: number; you: number; them: number; limit: number }>(
    t,
    `(() => { const d = window.__range.duel(); const rs = d.avatars.map((a) => d.remoteOf(a)); const m = d.hud().mode; return { allies: rs.filter((r) => d.isAlly(r.id)).length, enemies: rs.filter((r) => !d.isAlly(r.id)).length, you: m.teams.you, them: m.teams.them, limit: m.teams.limit }; })()`
  );
  check("tdm: four bots to face fills your side to four, 0 - 0, first to 30", t0.allies === 3 && t0.enemies === 4 && t0.you === 0 && t0.them === 0 && t0.limit === 30, JSON.stringify(t0));
  const tdmGuns = await ev<string[]>(t, "window.__range.duel().bots.map((b) => b.bot.remote.avatarWeapon)");
  check("tdm: the bots keep their own guns (each its own)", new Set(tdmGuns).size >= 4, tdmGuns.join(","));
  const ff = await ev<{ health: number; before: number }>(
    t,
    `(() => { const d = window.__range.duel(); const a = d.avatars.find((x) => d.isAlly(d.remoteOf(x).id)); const r = d.remoteOf(a); const before = a.health + a.shield; d.localHit(r, 80, false, "r97", 5); return { health: a.health + a.shield, before }; })()`
  );
  const ffScore = await ev<number>(t, "window.__range.duel().hud().mode.teams.you");
  check("tdm: a team mate takes no damage from you and scores nothing", ff.health === ff.before && ffScore === 0, JSON.stringify(ff));
  await ev(t, knockBot("!d.isAlly(r.id)"));
  await sleep(200);
  const t1 = await ev<number>(t, "window.__range.duel().hud().mode.teams.you");
  check("tdm: an enemy down scores for your team", t1 === 1, String(t1));
  await ev(t, "(() => { const d = window.__range.duel(); d.teams.score[0] = 29; })()");
  await ev(t, knockBot("!d.isAlly(r.id)"));
  await sleep(400);
  const t2 = await ev<{ phase: string; winner: string | null; won: boolean | null }>(t, "(() => { const d = window.__range.duel(); const m = d.hud().mode; return { phase: d.phase, winner: m.winner, won: m.won }; })()");
  check("tdm: the 30th wins it for your team", t2.phase === "matchEnd" && t2.won === true && t2.winner === "YOUR TEAM", JSON.stringify(t2));
  await ev(t, "window.__range.duel()?.leave()");
  await t.close();

  // ---- the middle building: a roof to stand on, and ziplines onto it
  // (no match: a mode would put the player back on a spawn)
  {
    const a = await open(browser, query);
    await pressPlay(a);
    await sleep(800);
    const built = await ev<{ zips: number; slab: boolean }>(
      a,
      `(() => { const r = window.__range;
        const zips = r.ziplines.filter((z) => Math.abs(z.a.x - 90) < 40 && z.a.z > -80 && z.a.z < 0).length;
        // the roof as a floor in the collision. Standing on it is not checked
        // here: with no drawing the page runs a handful of frames a second and
        // falls half a metre a frame, which tunnels a 0.3 m slab. A page with
        // drawing on, at 56 fps, lands on it and stays.
        const slab = r.solids.some((s) => s.top > 5.9 && s.top < 6.1 && s.minX < 90 && s.maxX > 90 && s.minZ < -40 && s.maxZ > -40);
        return { zips, slab }; })()`
    );
    check("arena: the middle building's roof is a floor over the middle of the map, 6 m up", built.slab);
    check("arena: two ziplines run onto it, one from each end", built.zips === 2, `${built.zips} ziplines in the arena`);
    await a.close();
  }

  // ---- free-for-all: no teams, everyone scores for themselves, first to 20
  const f = await startModePage(browser, query, "goFfa", `document.getElementById("modeBots").value = "3"`);
  const f0 = await ev<{ allies: number; enemies: number; you: number; best: number; limit: number; teams: boolean }>(
    f,
    `(() => { const d = window.__range.duel(); const rs = d.avatars.map((a) => d.remoteOf(a)); const m = d.hud().mode; return { allies: rs.filter((r) => d.isAlly(r.id)).length, enemies: rs.filter((r) => !d.isAlly(r.id)).length, you: m.ffa.you, best: m.ffa.best, limit: m.ffa.limit, teams: !!m.teams }; })()`
  );
  check("ffa: three bots, none of them yours, 0 - 0, first to 20, no team score", f0.allies === 0 && f0.enemies === 3 && f0.you === 0 && f0.best === 0 && f0.limit === 20 && !f0.teams, JSON.stringify(f0));
  await ev(f, knockBot("true"));
  await sleep(200);
  const f1 = await ev<{ you: number; top: string; kills: number }>(f, "(() => { const m = window.__range.duel().hud().mode; return { you: m.ffa.you, top: m.rows[0].name, kills: m.rows[0].kills }; })()");
  check("ffa: a kill is yours alone, and puts you at the top of the board", f1.you === 1 && f1.kills === 1 && /YOU|^[A-Z]/.test(f1.top), JSON.stringify(f1));
  // a bot's kill on another bot counts for that bot, not for a side
  const f2 = await ev<{ best: number; you: number }>(
    f,
    `(() => { const d = window.__range.duel(); const bots = d.bots; const v = bots[1]; d.onHitOther(v.bot.remote.id, 900, false, bots[0].bot.remote.id, "r97"); const m = d.hud().mode; return { best: m.ffa.best, you: m.ffa.you }; })()`
  );
  check("ffa: a bot's kill on another bot is that bot's own", f2.best === 1 && f2.you === 1, JSON.stringify(f2));
  await ev(f, "(() => { const d = window.__range.duel(); d.board.row(d.id).kills = 19; })()");
  await ev(f, knockBot("true"));
  await sleep(400);
  const f3 = await ev<{ phase: string; winner: string | null; won: boolean | null; summary: { roundsWon: number } | null }>(f, "(() => { const d = window.__range.duel(); const m = d.hud().mode; return { phase: d.phase, winner: m.winner, won: m.won, summary: d.lastSummary ? { roundsWon: d.lastSummary.roundsWon } : null }; })()");
  check("ffa: the 20th kill wins it for you alone", f3.phase === "matchEnd" && f3.won === true && f3.winner === "YOU" && f3.summary?.roundsWon === 20, JSON.stringify(f3));
  await ev(f, "window.__range.duel()?.leave()");
  await f.close();

  // ---- Control: five a side over A, B and C; standing on A takes it, it scores, you come back on it
  const ct = await startModePage(browser, query, "goControl", `document.getElementById("modeBots").value = "5"`);
  const ctl0 = await ev<{ kind: string; n: number; allies: number; zones: string }>(ct, "(() => { const d = window.__range.duel(); const h = d.hud().mode; return { kind: h.kind, n: d.avatars.length, allies: h.rows.filter((r) => r.ally).length, zones: (h.control?.zones ?? []).map((z) => z.id).join('') }; })()");
  check("control: five bots to face makes it five a side, zones A, B and C", ctl0.kind === "control" && ctl0.n === 9 && ctl0.allies === 4 && ctl0.zones === "ABC", JSON.stringify(ctl0));
  // the bots stand still (the test's zone is its own); you walk onto A, on your side
  await ev(ct, "(() => { const d = window.__range.duel(); d.bots.forEach((b) => { b.bot.update = () => []; }); const z = d.hud().mode.control.zones[0].at; window.__range.player.teleport(z.x, 0, z.z, 180); })()");
  const tookA = await ct.waitForFunction("window.__range.duel().hud().mode.control.zones[0].owner === 'you'", { polling: 200, timeout: 14000 }).then(() => true, () => false);
  check("control: 8 s on a neutral zone takes it for your team", tookA, JSON.stringify(await ev(ct, "window.__range.duel().hud().mode.control.zones[0]")));
  const s0 = await ev<number>(ct, "window.__range.duel().hud().mode.control.you");
  await sleep(3200);
  const s1 = await ev<number>(ct, "window.__range.duel().hud().mode.control.you");
  check("control: a zone held scores a point a second", s1 - s0 >= 2 && s1 - s0 <= 5, `${s0} -> ${s1}`);
  // down: back in 5 s later on A (held in a line from your base), not at the base
  await ev(ct, "(() => { const d = window.__range.duel(); window.__range.player.teleport(d.hud().mode.control.zones[1].at.x + 6, 0, d.hud().mode.control.zones[1].at.z, 180); d.takeHit(900, 106); })()");
  const backIn = await ct.waitForFunction("window.__range.duel().alive", { polling: 200, timeout: 9000 }).then(() => true, () => false);
  await sleep(300);
  const where = await ev<number>(ct, "(() => { const z = window.__range.duel().hud().mode.control.zones[0].at; const p = window.__range.player.pos; return Math.hypot(p.x - z.x, p.z - z.z); })()");
  check("control: down, you come back on your team's zone A", backIn && where < 4.5, `${where.toFixed(1)} m from A`);
  await ev(ct, "window.__range.duel()?.leave()");
  await ct.close();

  // ---- the motion-captured figures (a setting): they load, a match's figures are mannequins and animate
  const mq = await open(browser, query + LEGACY);
  await ev(mq, `(() => { const s = document.getElementById("figureStyle"); const def = s.value; s.value = "mannequin"; s.dispatchEvent(new Event("change")); window.__mqDefault = def; return window.__range.loadMannequin(); })()`);
  check("figures: the mannequin is the default figure", (await ev<string>(mq, "window.__mqDefault")) === "mannequin");
  await ev(mq, `(() => { document.getElementById("modeBots").value = "2"; document.getElementById("goFfa").click(); document.getElementById("startMode").click(); })()`);
  await pressPlay(mq);
  await mq.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 20000 }).catch(() => undefined);
  await sleep(800);
  const figs = await ev<{ n: number; mannequins: number; moved: boolean }>(
    mq,
    `(() => { const d = window.__range.duel(); const a = d.avatars; const m = a.map((x) => x.group.getObjectByName("mannequin")).filter(Boolean); let moved = false; m[0]?.traverse((o) => { if (o.name === "thigh_l") moved = Math.abs(o.quaternion.x) + Math.abs(o.quaternion.y) + Math.abs(o.quaternion.z) > 0.01; }); return { n: a.length, mannequins: m.length, moved }; })()`
  );
  check("figures: with the setting on the bots are mannequins, and their clips are playing", figs.n === 2 && figs.mannequins === 2 && figs.moved, JSON.stringify(figs));
  // a long gun is shouldered: it hangs off the chest (not the hand), the right hand on the grip
  const shouldered = await ev<Array<{ mount: boolean; grip: number }>>(mq, `window.__range.duel().avatars.filter((a) => a.mq && a.mq.gunObject).map((a) => ({ mount: a.mq.gunObject.parent?.name === "gunMount", grip: a.mq.gripReach }))`);
  check("figures: a mannequin's rifle hangs off its chest with the right hand on the grip", shouldered.length > 0 && shouldered.every((s) => s.mount && s.grip > 0.5), JSON.stringify(shouldered));
  await ev(mq, `(() => { window.__range.duel()?.leave(); localStorage.removeItem("range.figures"); })()`);
  await mq.close();
}

async function friendsModesTest(browser: Browser, query: string): Promise<void> {
  for (const [kind, bots, wantsAllies] of [["tdm", 3, true], ["ffa", 3, false], ["control", 2, true]] as const) {
    const host = await open(browser, query);
    const guest = await open(browser, query);
    await ev(host, `(() => { document.getElementById("duelMode").value = "${kind}"; document.getElementById("modeBots").value = "${bots}"; document.getElementById("botWeapon").value = "wingman"; document.getElementById("duelHost").click(); })()`);
    let code = "";
    try {
      await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
      code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    } catch {
      check(`friends ${kind}: the host gets a code`, false, await ev<string>(host, `document.getElementById("duelStatus").textContent`));
      await host.close();
      await guest.close();
      continue;
    }
    await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    const joined = await Promise.all([host, guest].map((p) => p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 25000 }).then(() => true, () => false)));
    if (!joined.every(Boolean)) {
      check(`friends ${kind}: the buddy joins`, false, JSON.stringify(joined));
      await host.close();
      await guest.close();
      continue;
    }
    for (const p of [host, guest]) await pressPlay(p);
    const fight = await Promise.all([host, guest].map((p) => p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 20000 }).then(() => true, () => false)));
    check(`friends ${kind}: a buddy joins and the fight starts on both screens`, fight.every(Boolean), JSON.stringify(fight));
    await sleep(1200);
    const side = await ev<{ enemies: number; allies: number; guns: string[] }>(
      host,
      `(() => { const d = window.__range.duel(); const mine = d.bots.filter((b) => b.team === 0).length; const theirs = d.bots.filter((b) => b.team === 1).length;
        return { enemies: ${kind === "ffa"} ? d.bots.length : theirs, allies: mine, guns: d.bots.map((b) => b.bot.remote.avatarWeapon) }; })()`
    );
    check(`friends ${kind}: the ${bots} bots you asked for are the ones you face`, side.enemies === bots, JSON.stringify({ enemies: side.enemies, allies: side.allies }));
    if (wantsAllies) check(`friends ${kind}: your side is filled to match (two of you, so ${bots - 2} ally bot(s))`, side.allies === bots - 2, `${side.allies} allies`);
    check(`friends ${kind}: the bots carry the gun the host chose`, side.guns.every((g) => g === "wingman"), [...new Set(side.guns)].join(","));
    await ev(host, "window.__range.duel()?.leave()");
    await host.close();
    await guest.close();
  }
}

/**
 * A friend's figure over a jittery connection. Arrival times bunch and gap as
 * the network jitters, and a figure placed by when its states arrived runs,
 * stalls and lurches though its player ran at one speed; placed by when they
 * were sent, it runs as the player did. Two tabs, 60 ms of jitter on every
 * message, the guest running a steady circle, and the host measuring how even
 * the guest's figure's speed is from frame to frame, placed each way.
 */
/** how evenly a figure moved: over the frames, and over the states behind them */
interface Smoothness {
  frames: number;
  mean: number;
  /** standard deviation over the mean: one frozen frame in 390 moves this a long way */
  spread: number;
  /** what a typical frame did, against the middle one: robust to a stall */
  mad: number;
  /** and what a bad one did */
  p95: number;
  sampleSpread: number;
  stalls: number;
}

async function jitterTest(browser: Browser, query: string, lossy = false): Promise<void> {
  const host = await open(browser, query);
  const guest = await open(browser, query);
  await ev(host, `(() => { document.getElementById("duelMode").value = "arena"; document.getElementById("duelPlayers").value = "2"; document.getElementById("duelHost").click(); })()`);
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  } catch {
    check("jitter: the two connect", false);
    await host.close();
    await guest.close();
    return;
  }
  // the guest runs a circle at one speed: forward held, turning at a steady rate
  await ev(guest, `(() => { window.__range.setScript({ held: (a) => a === "forward", pressedNow: () => false }); setInterval(() => { window.__range.player.yaw += 1.5; }, 16); })()`);
  await sleep(1500);
  // how even the figure's speed is, frame to frame, over 2.5 s: the spread of it over its mean
  // measured in the game's own frame: after each update of the match, where the figure stands
  await host.bringToFront();
  const measure = `new Promise((done) => { const d = window.__range.duel(); const r = d.remotes.get(1); const pts = []; const t0 = performance.now(); const up = d.update.bind(d); d.update = (l) => { const at = performance.now(); up(l); const g = r.avatar.group.position; pts.push([at, g.x, g.z]); if (performance.now() - t0 > 2500 && !pts.done) { pts.done = true; d.update = up; const v = []; for (let i = 1; i < pts.length; i++) { const dt = (pts[i][0] - pts[i - 1][0]) / 1000; if (dt > 0.004) v.push(Math.hypot(pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]) / dt); } const m = v.reduce((a, b) => a + b, 0) / v.length; const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / v.length); const ss = r.samples.slice(-40); const sv = []; for (let i = 1; i < ss.length; i++) { const dt = ss[i].at - ss[i - 1].at; if (dt > 0) sv.push(Math.hypot(ss[i].x - ss[i - 1].x, ss[i].z - ss[i - 1].z) / dt); } const sm = sv.reduce((a, b) => a + b, 0) / sv.length; const ssd = Math.sqrt(sv.reduce((a, b) => a + (b - sm) * (b - sm), 0) / sv.length); const sorted = v.slice().sort((a, b) => a - b); const med = sorted[Math.floor(sorted.length / 2)]; const devs = v.map((x) => Math.abs(x - med)).sort((a, b) => a - b); const mad = devs[Math.floor(devs.length / 2)] / med; const p95 = devs[Math.floor(devs.length * 0.95)] / med; done({ frames: v.length, mean: m, spread: sd / m, mad, p95, sampleSpread: ssd / sm, stalls: v.filter((x) => x < m * 0.2).length }); } }; })`;
  const bySent = await ev<Smoothness>(host, measure);
  await ev(host, "window.__range.duel().senderClock = false");
  await sleep(800);
  const byArrival = await ev<Smoothness>(host, measure);
  if (lossy) {
    // A sixth of the state packets lost and the rest out of order: the figure
    // still runs as the player did.
    //
    // Measured by the MIDDLE frame rather than the mean one, and the reason is
    // worth stating. Over 390 frames, one frame where the buffer had nothing
    // new to show moves the standard deviation more than the other 389 put
    // together: the same build measured 0.11, 0.32, 0.34 and 0.56 on four runs
    // against a 0.30 bar, so the check was reporting which run it was, not
    // whether the movement was smooth. The median absolute deviation says what
    // a typical frame did, the 95th says what a bad one did, and `stalls`
    // counts the frames that genuinely froze, which is the thing a player
    // sees. All three have to hold, so a real stutter still fails.
    const fast = await ev<{ sent: number; got: number } | null>(guest, "window.__range.duel()?.linkFor(0)?.fastStats?.() ?? null");
    check(
      "loss: with 15% of the state packets lost and the rest out of order, a friend running at one speed still moves at one speed",
      bySent.frames > 60 && bySent.mean > 3 && bySent.mad < 0.12 && bySent.p95 < 0.55 && bySent.stalls <= 3 && bySent.sampleSpread < 0.2,
      JSON.stringify({ bySent, fast })
    );
  } else
    check(
      "jitter: placed by when its states were sent, a friend running at one speed moves at one speed through 60 ms of jitter (and far more evenly than placed by arrival)",
      bySent.frames > 60 && bySent.mean > 3 && bySent.spread < 0.25 && bySent.spread < byArrival.spread * 0.6,
      JSON.stringify({ bySent, byArrival })
    );
  await host.close();
  await guest.close();
}

/**
 * Voice chat over the internet: the guest holds the key and the host hears
 * it (Chrome's fake microphone is a tone); let go, it goes quiet.
 */
async function voiceTest(browser: Browser, query: string): Promise<void> {
  const host = await open(browser, query);
  const guest = await open(browser, query);
  await ev(host, `document.getElementById("duelHost").click()`);
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
    // both in the game, so the key counts
    for (const p of [host, guest]) await pressPlay(p);
  } catch {
    check("voice: the two connect", false);
    await host.close();
    await guest.close();
    return;
  }
  const grouped = await Promise.all([host, guest].map((p) => p.waitForFunction("window.__range.voiceState().group !== ''", { polling: 200, timeout: 8000 }).then(() => true, () => false)));
  await ev(guest, `window.__range.setScript({ held: (a) => a === "voice", pressedNow: () => false })`);
  const live = await guest.waitForFunction("window.__range.voiceState().live", { polling: 100, timeout: 8000 }).then(() => true, () => false);
  // the loudest the host hears the guest over a few seconds (the tone comes and goes)
  let peak = 0;
  for (let i = 0; i < 40 && peak < 0.05; i++) {
    const s = await ev<{ levels: Record<string, number> }>(host, "window.__range.voiceState()");
    peak = Math.max(peak, ...Object.values(s.levels), 0);
    await sleep(150);
  }
  await ev(guest, "window.__range.setScript(null)");
  await sleep(2500);
  let after = 0;
  for (let i = 0; i < 8; i++) {
    const s = await ev<{ levels: Record<string, number> }>(host, "window.__range.voiceState()");
    after = Math.max(after, ...Object.values(s.levels), 0);
    await sleep(150);
  }
  const off = await ev<boolean>(guest, "window.__range.voiceState().live");
  check("voice: the guest holds the key and the host hears them; let go, it goes quiet", grouped.every(Boolean) && live && peak > 0.05 && after < 0.02 && !off, JSON.stringify({ grouped, live, peak: +peak.toFixed(3), after: +after.toFixed(3), off }));
  // the host mutes the guest on the Friends tab: the guest talks, and the host hears nothing
  const muteClicked = await host
    .waitForSelector("#voiceList [data-mute]", { timeout: 5000 })
    .then(async () => {
      await ev(host, `document.querySelector("#voiceList [data-mute]").click()`);
      return true;
    }, () => false);
  await ev(guest, `window.__range.setScript({ held: (a) => a === "voice", pressedNow: () => false })`);
  let mutedPeak = 0;
  for (let i = 0; i < 20; i++) {
    const s = await ev<{ levels: Record<string, number> }>(host, "window.__range.voiceState()");
    mutedPeak = Math.max(mutedPeak, ...Object.values(s.levels), 0);
    await sleep(150);
  }
  await ev(guest, "window.__range.setScript(null)");
  const mutedList = await ev<string[]>(host, "window.__range.voiceState().muted");
  const button = await ev<string>(host, `document.querySelector("#voiceList [data-mute]")?.textContent ?? ""`);
  check("voice: muted on the Friends tab, the guest talks and the host hears nothing", muteClicked && mutedList.length === 1 && mutedPeak === 0 && button === "Unmute", JSON.stringify({ muteClicked, mutedList, mutedPeak, button }));
  await host.close();
  await guest.close();
}

/**
 * Handing the host over in the lobby: the host picks a friend on its roster,
 * that friend opens a new code for the same match, and all three are in it
 * with the friend hosting, nobody typing a code.
 */
async function handoverTest(browser: Browser, query: string): Promise<void> {
  const pages: Page[] = [];
  const host = await open(browser, query);
  pages.push(host);
  await ev(host, `(() => { document.getElementById("duelMode").value = "ffa"; document.getElementById("duelPlayers").value = "3"; document.getElementById("modeBots").value = "1"; document.getElementById("duelHost").click(); })()`);
  let code = "";
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    for (let i = 0; i < 2; i++) {
      const g = await open(browser, query);
      pages.push(g);
      await ev(g, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
      await sleep(500);
    }
    for (const p of pages) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 25000 });
  } catch {
    check("handover: three in one lobby", false, code);
    for (const p of pages) await p.close();
    return;
  }
  const ids = await Promise.all(pages.map((p) => ev<number>(p, "window.__range.duel().id")));
  const heir = pages[ids.indexOf(1)];
  // the host's roster: Make host on player 2
  const clicked = await host
    .waitForSelector('#duelRoster [data-host="1"]', { timeout: 6000 })
    .then(async () => {
      await ev(host, `document.querySelector('#duelRoster [data-host="1"]').click()`);
      return true;
    }, () => false);
  const moved = await heir.waitForFunction(`window.__range.duel()?.role === "host" && window.__range.duel().id === 0`, { polling: 200, timeout: 20000 }).then(() => true, () => false);
  const all = await Promise.all(pages.map((p) => p.waitForFunction(`(() => { const d = window.__range.duel(); return !!d && (d.role === "host" ? d.links.size === 2 : d.remotes.has(0)); })()`, { polling: 200, timeout: 20000 }).then(() => true, () => false)));
  const roles = await Promise.all(pages.map((p) => ev<{ role: string; id: number; players: number } | null>(p, "(() => { const d = window.__range.duel(); return d ? { role: d.role, id: d.id, players: d.players } : null; })()")));
  const said = await ev<string>(heir, `document.getElementById("duelStatus").textContent`);
  check(
    "handover: Make host moves the lobby to player 2's new code, the three of them in it with player 2 hosting",
    clicked && moved && all.every(Boolean) && roles.filter((r) => r?.role === "host").length === 1 && roles.every((r) => r?.players === 3) && !said.includes(code),
    JSON.stringify({ clicked, moved, all, roles, said })
  );
  for (const p of pages) await p.close();
}

/**
 * Custom rules: a 1v1 with shotguns only and first to 1 (everyone holds a
 * shotgun, and one knock ends the match), then a team deathmatch with a
 * friend on the same side and friendly fire on (the host's round hurts them).
 */
async function rulesTest(browser: Browser, query: string): Promise<void> {
  const pair = async (setup: string): Promise<[Page, Page] | null> => {
    const host = await open(browser, query);
    const guest = await open(browser, query);
    await ev(host, `(() => { ${setup}; document.getElementById("duelHost").click(); })()`);
    try {
      await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
      const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
      await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
      for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
      for (const p of [host, guest]) await pressPlay(p);
      for (const p of [host, guest]) await p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 30000 });
      return [host, guest];
    } catch {
      await host.close();
      await guest.close();
      return null;
    }
  };
  const set = (id: string, v: string) => `document.getElementById("${id}").value = "${v}"`;
  const one = await pair([set("duelMode", "arena"), set("duelPlayers", "2"), set("ruleGuns", "shotgun"), set("ruleRounds", "1"), set("ruleFF", "off")].join("; "));
  if (!one) {
    check("rules: the 1v1 starts", false);
    return;
  }
  const [h1, g1] = one;
  await sleep(500);
  const guns = await Promise.all([h1, g1].map((p) => ev<string[]>(p, "window.__range.loadout.slots.filter((s) => !s.empty).map((s) => s.id)")));
  await ev(h1, `(() => { const d = window.__range.duel(); d.localHit(d.remotes.get(1), 250, true, "shotgun"); })()`);
  const over = await Promise.all([h1, g1].map((p) => p.waitForFunction(`window.__range.duel()?.phase === "matchEnd"`, { polling: 100, timeout: 8000 }).then(() => true, () => false)));
  check("rules: shotguns only, first to 1: both hold only shotguns, and one knock ends the match", guns.every((g) => g.length > 0 && g.every((id) => id === "shotgun" || id === "mastiff")) && over.every(Boolean), JSON.stringify({ guns, over }));
  await h1.close();
  await g1.close();
  const two = await pair([set("duelMode", "tdm"), set("duelPlayers", "2"), set("modeBots", "1"), set("ruleGuns", "any"), set("ruleRounds", "3"), set("ruleFF", "on")].join("; "));
  if (!two) {
    check("rules: the team deathmatch starts", false);
    return;
  }
  const [h2, g2] = two;
  await sleep(500);
  const ally = await ev<boolean>(h2, "window.__range.duel().isAlly(1)");
  const before = await ev<number>(g2, "(() => { const d = window.__range.duel(); return d.health + d.shield; })()");
  await ev(h2, `(() => { const d = window.__range.duel(); d.localHit(d.remotes.get(1), 30, false, "rspn101"); })()`);
  const hurt = await g2.waitForFunction(`(() => { const d = window.__range.duel(); return d.health + d.shield < ${before}; })()`, { polling: 100, timeout: 4000 }).then(() => true, () => false);
  check("rules: friendly fire on: the host's round hurts its team mate", ally && hurt, JSON.stringify({ ally, before, hurt }));
  await h2.close();
  await g2.close();
}

/** a lobby bigger than three: everyone gets their own spawn, nobody stacks */
async function lobbyTest(browser: Browser, query: string): Promise<void> {
  const pages: Page[] = [];
  const host = await open(browser, query);
  pages.push(host);
  await ev(host, `(() => { document.getElementById("duelMode").value = "ffa"; document.getElementById("duelPlayers").value = "4"; document.getElementById("modeBots").value = "1"; document.getElementById("duelHost").click(); })()`);
  let code = "";
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
  } catch {
    check("lobby: the host gets a code for four", false);
    for (const p of pages) await p.close();
    return;
  }
  for (let i = 0; i < 3; i++) {
    const g = await open(browser, query);
    pages.push(g);
    await ev(g, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    await sleep(600);
  }
  const inMatch = await Promise.all(pages.map((p) => p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 25000 }).then(() => true, () => false)));
  check("lobby: four people join one match", inMatch.every(Boolean), JSON.stringify(inMatch));
  for (const p of pages) await pressPlay(p);
  await Promise.all(pages.map((p) => p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 25000 }).catch(() => undefined)));
  await sleep(800);
  const spots = await Promise.all(pages.map((p) => ev<{ x: number; z: number }>(p, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })")));
  let closest = Infinity;
  for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) closest = Math.min(closest, Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z));
  check("lobby: nobody spawns on top of anybody (the fourth used to land inside the host)", closest > 4, `${closest.toFixed(1)} m between the nearest two`);
  await ev(host, "window.__range.duel()?.leave()");
  for (const p of pages) await p.close();
}

/** A free-for-all with a friend over the local transport, and a bot: the board is the host's, a kill counts on both screens, respawns */
async function modesFriendsTest(browser: Browser, query: string): Promise<void> {
  const host = await open(browser, query);
  const guest = await open(browser, query);
  await ev(host, `(() => { document.getElementById("duelMode").value = "ffa"; document.getElementById("modeBots").value = "1"; document.getElementById("duelHost").click(); })()`);
  let code = "";
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
  } catch {
    check("modes friends: the host gets a code", false);
    await host.close();
    await guest.close();
    return;
  }
  await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
  try {
    for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  } catch {
    check("modes friends: both connect", false);
    await host.close();
    await guest.close();
    return;
  }
  const kinds = await Promise.all([host, guest].map((p) => ev<{ kind: string; role: string }>(p, "({ kind: window.__range.duel().modeKind, role: window.__range.duel().role })")));
  check("modes friends: the guest plays the host's mode (a free-for-all)", kinds.every((k) => k.kind === "ffa"), JSON.stringify(kinds));
  for (const p of [host, guest]) await pressPlay(p);
  const fight = await Promise.all([host, guest].map((p) => p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 20000 }).then(() => true, () => false)));
  check("modes friends: the fight starts on both", fight.every(Boolean));
  await ev(host, "window.__range.duel().holdFire = true");
  await sleep(1200);
  const seen = await ev<{ bots: number; humans: number; rows: number }>(guest, `(() => { const d = window.__range.duel(); const rs = [...d.remotes.values()]; return { bots: rs.filter((r) => r.id >= 100).length, humans: rs.filter((r) => r.id < 100).length, rows: d.hud().mode.rows.length }; })()`);
  check("modes friends: the guest sees the host and the host's bot, and all three on the scoreboard", seen.bots === 1 && seen.humans === 1 && seen.rows === 3, JSON.stringify(seen));
  // the host knocks the guest: the host's kill counts on both screens, the guest comes back
  await ev(host, `(() => { const d = window.__range.duel(); const r = d.remotes.get(1); d.localHit(r, 900, true, "rspn101", 12); })()`);
  const down = await guest.waitForFunction("!window.__range.duel().alive", { polling: 100, timeout: 5000 }).then(() => true, () => false);
  await sleep(700);
  const lv = await Promise.all([host, guest].map((p) => ev<number>(p, "window.__range.duel().board.row(0).kills")));
  check("modes friends: the host's kill is on the board on both screens", down && lv[0] === 1 && lv[1] === 1, JSON.stringify({ down, lv }));
  const again = await guest.waitForFunction("window.__range.duel().alive", { polling: 200, timeout: 6000 }).then(() => true, () => false);
  const hostSees = await host.waitForFunction("window.__range.duel().remotes.get(1)?.alive === true", { polling: 200, timeout: 4000 }).then(() => true, () => false);
  check("modes friends: the guest respawns and the host sees them back", again && hostSees);
  // the guest knocks the bot (a hit message the host applies): the guest's kill, told by the host
  await ev(guest, guestRounds("x.id >= 100 && x.alive", 16));
  const gl = await guest.waitForFunction("window.__range.duel().board.row(1).kills === 1", { polling: 200, timeout: 5000 }).then(() => true, () => false);
  check("modes friends: the guest's kill on the host's bot is the guest's on the board", gl, JSON.stringify(await ev(guest, "window.__range.duel().board.sorted")));
  // the figure over the network: the guest aims down sights, then heals; the host's copy of the guest does it too
  await ev(guest, `(() => {
    if (!window.__pad) {
      const btn = () => ({ pressed: false, touched: false, value: 0 });
      const pad = { index: 0, id: "fake pad", connected: true, mapping: "standard", timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn) };
      window.__pad = pad;
      navigator.getGamepads = () => [pad];
    }
    window.__pad.buttons[6].pressed = true;
    window.__pad.buttons[6].value = 1;
  })()`);
  const aimed = await host.waitForFunction("(window.__range.duel().remotes.get(1)?.avatar.currentPose.ads ?? 0) > 0.6", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  await ev(guest, "(() => { window.__pad.buttons[6].pressed = false; window.__pad.buttons[6].value = 0; })()");
  check("figures: the guest aims down sights and the host's figure of the guest raises its gun", aimed, JSON.stringify(await ev(host, "window.__range.duel().remotes.get(1)?.avatar.currentPose")));
  await ev(guest, `(() => { const d = window.__range.duel(); d.shield = d.shieldMax - 15; window.__range.startHeal(); })()`);
  const healing = await host.waitForFunction("window.__range.duel().remotes.get(1)?.avatar.currentPose.act === 'heal'", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  const item = await ev<string | undefined>(host, "window.__range.duel().remotes.get(1)?.avatar.currentPose.healItem");
  check("figures: the guest heals and the host's figure of the guest holds the item (a shield cell)", healing && item === "cell", String(item));
  await ev(guest, "window.__range.duel()?.leave()");
  await host.waitForFunction("window.__range.duel() === null || window.__range.duel().phase", { polling: 200, timeout: 5000 }).catch(() => undefined);
  await ev(host, "window.__range.duel()?.leave()");
  await host.close();
  await guest.close();
}

/**
 * Two friends drop together as a duo against two bot pairs: the guest sees
 * the host's bots, a knock reaches both feeds, a duo's half bleed-out and a
 * revive by the one mate there is, the late rings' drops and Storm Surge on
 * the guest's screen, and the squad's result reaches both. Then the same two
 * in a solo match, where a knock is the end even with a friend still up.
 */
async function brSquadTest(browser: Browser, query: string): Promise<void> {
  const host = await open(browser, query);
  const guest = await open(browser, query);
  await ev(host, brRow("duo", 4));
  await ev(host, LOOT_START);
  await ev(host, `(() => { document.getElementById("duelMode").value = "br"; document.getElementById("duelHost").click(); })()`);
  let code = "";
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
  } catch {
    check("squad: the host gets a code", false, await ev<string>(host, `document.getElementById("duelStatus").textContent`));
    await host.close();
    await guest.close();
    return;
  }
  await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
  try {
    for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  } catch {
    check("squad: both connect", false, await ev<string>(guest, `document.getElementById("duelStatus").textContent`));
    await host.close();
    await guest.close();
    return;
  }
  const kinds = await Promise.all([host, guest].map((p) => ev<{ poi: string; players: number; role: string; team: string }>(p, "({ poi: window.__range.duel().poi.name, players: window.__range.duel().players, role: window.__range.duel().role, team: window.__range.duel().team.id })")));
  check("squad: both are in the same battle royale, dropping on the same place", kinds[0].poi === kinds[1].poi && kinds[0].players === 2 && kinds[1].players === 2 && kinds[0].role === "host" && kinds[1].role === "guest", JSON.stringify(kinds));
  // the guest's own row is still on its default: the size it plays is the welcome's
  check("squad: the host's size reaches the guest in the welcome: both play duos", kinds[0].team === "duo" && kinds[1].team === "duo", JSON.stringify(kinds.map((k) => k.team)));
  // every notice either page shows from here is kept (the HUD shows one at a time)
  for (const p of [host, guest]) await ev(p, `(() => { const d = window.__range.duel(); const say = d.onNotice; window.__notices = []; d.onNotice = (t) => { window.__notices.push(t); say?.(t); }; })()`);
  for (const p of [host, guest]) await pressPlay(p);
  const dropped = await Promise.all([host, guest].map((p) => p.waitForFunction(`window.__range.duel().phase === "countdown" && window.__range.player.pos.y > 30`, { polling: 200, timeout: 15000 }).then(() => true, () => false)));
  check("squad: everyone in, both drop from the sky", dropped[0] && dropped[1], JSON.stringify(dropped));
  const landed = await Promise.all([host, guest].map((p) => p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 40000 }).then(() => true, () => false)));
  // the host's seed is the guest's, so the squad plays under one sky
  const skies = await Promise.all([host, guest].map((p) => ev<string>(p, "window.__range.sky.id")));
  const skyWant = await ev<string>(host, "window.__range.sky.matchFor(window.__range.duel().seed)");
  check("squad: host and guest play under the same sky, the match's own", skies[0] === skyWant && skies[1] === skyWant, JSON.stringify({ skies, skyWant }));
  check("squad: the fight starts on both when the host lands", landed[0] && landed[1]);
  await sleep(1500);
  const seen = await ev<{ figures: number; bots: number; humans: number }>(guest, `(() => { const d = window.__range.duel(); const rs = [...d.remotes.values()]; return { figures: d.avatars.filter((a) => a.group.visible).length, bots: rs.filter((r) => r.id >= 100).length, humans: rs.filter((r) => r.id < 100).length }; })()`);
  check("squad: the guest sees the host and the four bots the host runs", seen.bots === 4 && seen.humans === 1 && seen.figures >= 4, JSON.stringify(seen));
  // a bot of a duo knocked with its mate up: down on the guest's screen too, crawling, and back up when its mate picks it up
  const knocked = await ev<number>(host, `(() => { const d = window.__range.duel(); const b = d.bots.find((x) => x.bot.alive && !x.bot.aboard && d.bots.some((o) => o !== x && o.team === x.team && o.bot.alive && !o.bot.aboard)); if (!b) return -1; d.onHitOther(b.bot.remote.id, 999, false, d.id); return b.down ? b.bot.remote.id : -1; })()`);
  const downSeen = knocked >= 0 && (await guest.waitForFunction(`(() => { const r = window.__range.duel().remotes.get(${knocked}); const s = r?.samples[r.samples.length - 1]; return !!r && r.downed && r.alive && s?.stance === "downed"; })()`, { polling: 100, timeout: 4000 }).then(() => true, () => false));
  await ev(host, `(() => { const d = window.__range.duel(); const a = d.bots.find((x) => x.bot.remote.id === ${knocked}); const m = a && d.bots.find((o) => o !== a && o.team === a.team && o.bot.alive && !o.down); if (a && m) d.reviveBot(a, m); })()`);
  const upSeen = downSeen && (await guest.waitForFunction(`(() => { const r = window.__range.duel().remotes.get(${knocked}); const s = r?.samples[r.samples.length - 1]; return !!r && !r.downed && s?.stance !== "downed"; })()`, { polling: 100, timeout: 4000 }).then(() => true, () => false));
  check("squad: a duo's bot knocked with its mate up shows down on the guest's screen, and up again once revived", downSeen && upSeen, JSON.stringify({ knocked, downSeen, upSeen }));
  // a bot reloading on the host reloads on the guest's screen too, and from empty (act code 9): the host sent its bots'
  // place alone, so a guest's figures of them never reloaded, healed or aimed in
  const rel = await ev<number>(host, `(() => { const d = window.__range.duel(); const b = d.bots.find((x) => x.bot.alive && !x.bot.aboard && !x.down && !x.bot.healing); if (!b) return -1; b.bot.mag.until = 1e12; return b.bot.remote.id; })()`);
  const relSeen = rel >= 0 && (await guest.waitForFunction(`(() => { const r = window.__range.duel().remotes.get(${rel}); const s = r?.samples[r.samples.length - 1]; return !!s && s.act === "reload" && s.reloadEmpty === true; })()`, { polling: 100, timeout: 4000 }).then(() => true, () => false));
  await ev(host, `(() => { const d = window.__range.duel(); const b = d.bots.find((x) => x.bot.remote.id === ${rel}); if (b) b.bot.mag.until = 0; })()`);
  check("squad: a bot reloading on the host is seen reloading from empty on the guest's screen", relSeen, JSON.stringify({ rel, relSeen }));
  // doors: the guest opens one (the host does it for everyone), the host shuts it, and a door the guest has wrong is put right
  const doorI = await ev<number>(guest, `(() => { const r = window.__range; const me = r.player.pos; const ds = r.brMap.doors; const d = ds.list.filter((x) => !x.open).sort((a, b) => Math.hypot(a.centre.x - me.x, a.centre.z - me.z) - Math.hypot(b.centre.x - me.x, b.centre.z - me.z))[0]; r.player.teleport(d.centre.x, d.centre.y - 1.3, d.centre.z + (d.side === "s" ? 2 : d.side === "n" ? -2 : 0) + 0, 0, 0); if (d.side === "e") r.player.pos.x += 2; if (d.side === "w") r.player.pos.x -= 2; return d.i; })()`);
  await sleep(600);
  await ev(guest, `window.__range.duel().useDoor(${doorI}, true)`);
  const hostSawOpen = await host.waitForFunction(`window.__range.brMap.doors.list[${doorI}].open`, { polling: 100, timeout: 4000 }).then(() => true, () => false);
  await ev(host, `window.__range.duel().useDoor(${doorI}, false)`);
  const guestSawShut = await guest.waitForFunction(`!window.__range.brMap.doors.list[${doorI}].open`, { polling: 100, timeout: 4000 }).then(() => true, () => false);
  const wrong = await ev<number>(guest, `(() => { const ds = window.__range.brMap.doors; const d = ds.list.find((x) => !x.open && x.i !== ${doorI}); ds.set(d.i, true); return d.i; })()`);
  const putRight = await guest.waitForFunction(`!window.__range.brMap.doors.list[${wrong}].open`, { polling: 100, timeout: 3000 }).then(() => true, () => false);
  check("squad: doors: the guest opens one and the host sees it, the host shuts it and the guest sees that, and a door the guest had wrong is put right by the host", hostSawOpen && guestSawShut && putRight, JSON.stringify({ doorI, hostSawOpen, guestSawShut, wrong, putRight }));
  // the guest knocks a bot: the hit goes to the host, the down comes back to both
  await ev(guest, guestRounds("x.id >= 100 && x.alive", 12));
  await sleep(1200);
  const after = await Promise.all([host, guest].map((p) => ev<{ alive: number; kills: number; squads: number }>(p, "({ alive: window.__range.duel().hud().br.alive, kills: window.__range.duel().hud().br.kills, squads: window.__range.duel().hud().br.squads })")));
  check("squad: the knock is the guest's, and both see one fewer alive", after[1].kills === 1 && after[0].kills === 0 && after[0].alive === 5 && after[1].alive === 5, JSON.stringify(after));
  // a forged claim: more than one round of the gun can do, then a hit with no shot behind it; the host drops both
  const refusedBefore = await ev<number>(host, "window.__range.duel().hitCheck.refused.length");
  const target = await ev<{ id: number; hp: number } | null>(host, "(() => { const d = window.__range.duel(); const b = d.bots.find((x) => x.bot.alive && !x.down); return b ? { id: b.bot.remote.id, hp: b.bot.dummy.health + b.bot.dummy.shield } : null; })()");
  if (target) {
    await ev(guest, `(() => { const d = window.__range.duel(); const r = d.remotes.get(${target.id}); if (r) d.localHit(r, 900, true, "rspn101"); })()`);
    await sleep(3000);
    await ev(guest, `(() => { const d = window.__range.duel(); const r = d.remotes.get(${target.id}); if (r) d.localHit(r, 20, false, "rspn101"); })()`);
    await sleep(600);
  }
  const forged = await ev<{ refused: Array<{ why: string }>; hp: number }>(host, `(() => { const d = window.__range.duel(); const b = d.bots.find((x) => x.bot.remote.id === ${target?.id ?? -1}); return { refused: d.hitCheck.refused.slice(${refusedBefore}), hp: b ? b.bot.dummy.health + b.bot.dummy.shield : -1 }; })()`);
  check("squad: the host drops a forged hit (more than a round can do) and one with no shot behind it", !!target && forged.refused.length === 2 && /more than one round/.test(forged.refused[0].why) && /no shot/.test(forged.refused[1].why), JSON.stringify({ target, forged }));
  // the guest runs no bots: its squad count is the host's, off the ring packet (the pair with a bot down is still in it)
  check("squad: the guest counts the squads still in it the way the host does", after[0].squads === 3 && after[1].squads === 3, JSON.stringify(after.map((a) => a.squads)));
  // a ping: the guest marks a place, the host sees it
  await ev(guest, `(() => { const r = window.__range; const d = r.duel(); d.sendMark("go", r.player.pos.clone(), "GOING HERE"); })()`);
  const pinged = await host.waitForFunction("window.__range.brPlay.markers.some((m) => m.from === 1 && m.k === 'go')", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  check("squad: the guest's ping reaches the host", pinged);
  // and the wheel: holding the ping key says what the mark MEANS, and that
  // reaches the host too (src/game/brplay.ts PING_INTENTS)
  {
    await ev(guest, "window.__range.input.locked = true");
    await guest.mouse.down({ button: "middle" });
    await sleep(450);
    const wheel = await ev<{ open: boolean; items: number; pick: number | null }>(
      guest,
      `(() => { const w = window.__range.hud.last?.pingWheel ?? null; return { open: !!w, items: w ? w.items.length : 0, pick: w ? w.pick : null }; })()`
    );
    await guest.mouse.up({ button: "middle" });
    await sleep(150);
    check("squad: holding the ping key opens the wheel of what a mark means", wheel.open && wheel.items === 6, JSON.stringify(wheel));
    const sent = await ev<{ label: string | null }>(
      guest,
      `new Promise((ok) => { const r = window.__range; const d = r.duel();
        // the wheel's own marking path, at the slice DEFENDING HERE sits in
        const label = r.brPlay.pingIntent(d, r.player.pos.clone(), new r.THREE.Vector3(0, 0, -1), r.gameTime(), d.id, 5);
        r.input.locked = false;
        setTimeout(() => ok({ label }), 100); })`
    );
    const seen = await host.waitForFunction(`window.__range.brPlay.markers.some((m) => m.from === 1 && m.label === "DEFENDING HERE")`, { polling: 100, timeout: 4000 }).then(() => true, () => false);
    check("squad: what the wheel marked reaches the host, in the words it was marked with", sent.label === "DEFENDING HERE" && seen, JSON.stringify({ ...sent, seen }));
  }
  // the ring hurts a guest outside it on the guest's own clock (it used to tick about once a minute)
  const g0 = await ev<number>(guest, "(() => { const d = window.__range.duel(); window.__range.player.teleport(215, 0, 715, 0); return d.shield + d.health; })()");
  await sleep(3400);
  const g1 = await ev<number>(guest, "(() => { const d = window.__range.duel(); return d.shield + d.health; })()");
  check("squad: outside the ring the guest takes its damage every 1.5 s", g0 - g1 >= 4, `${g0} -> ${g1}`);
  await ev(guest, "(() => { const d = window.__range.duel(); d.shield = d.shieldMax; d.health = 100; window.__range.player.teleport(0, 0, 500, 0); })()");
  // the guest goes down (not out: the host is still up); the host sees it
  await ev(guest, `(() => { const d = window.__range.duel(); d.holdFire = true; d.takeHit(500, 100); })()`);
  await sleep(800);
  const guestDown = await ev<{ alive: boolean; downed: boolean; phase: string; left: number }>(guest, "(() => { const d = window.__range.duel(); return { alive: d.alive, downed: d.downed, phase: d.phase, left: d.bleedUntil - performance.now() / 1000 }; })()");
  const hostSees = await ev<{ phase: string; downed: boolean }>(host, "(() => { const d = window.__range.duel(); const r = d.remotes.get(1); return { phase: d.phase, downed: !!r && r.downed }; })()");
  // a duo's bleed-out is half a trio's 90 s: only one person can ever come
  check("squad: the guest is down, not out, bleeding out from a duo's 45 s; the host sees them down", guestDown.alive && guestDown.downed && guestDown.phase === "fight" && guestDown.left > 40 && guestDown.left <= 45.5 && hostSees.downed && hostSees.phase === "fight", JSON.stringify({ guestDown, hostSees }));
  await sleep(400);
  const crawl = await ev<{ stance: string; weapon: string }>(host, "(() => { const r = window.__range.duel().remotes.get(1); return { stance: r.samples.at(-1)?.stance ?? '', weapon: r.avatarWeapon }; })()");
  const gHud = await ev<{ downed: boolean; weapon: string }>(guest, "(() => { const s = window.__range.hud.last; return { downed: !!s?.downed, weapon: s?.weaponName ?? '' }; })()");
  check("squad: down you crawl with no gun, and the host sees you down", crawl.stance === "downed" && gHud.downed, JSON.stringify({ crawl, gHud }));
  // nobody holds a gun down: not in your view (the hands on the floor), not on the host's figure of you, not on your own in third person
  const gView = await ev<{ gun: boolean; hands: boolean; down: number }>(guest, "window.__range.vmState()");
  check("down: no gun in your view, your hands on the floor", !gView.gun && gView.hands && gView.down > 0.5, JSON.stringify(gView));
  const hostFig = await ev<{ holding: boolean; stance: string }>(host, "(() => { const a = window.__range.duel().remotes.get(1).avatar; return { holding: a.holdingGun, stance: a.currentPose.stance }; })()");
  check("down: the host's figure of you holds no gun", !hostFig.holding && hostFig.stance === "downed", JSON.stringify(hostFig));
  await ev(guest, "window.__range.setThirdPerson(true)");
  await sleep(300);
  const selfDown = await ev<{ holding: boolean; stance: string } | null>(guest, "(() => { const f = window.__range.selfFigure(); return f && { holding: f.holdingGun, stance: f.currentPose.stance }; })()");
  await ev(guest, "window.__range.setThirdPerson(false)");
  check("down: your own figure in third person holds no gun", !!selfDown && !selfDown.holding && selfDown.stance === "downed", JSON.stringify(selfDown));
  // the knockdown shield: held fire raises it at your EVO level's size; the host's figure of you shows it
  await ev(guest, padSet(7, true));
  await sleep(500);
  const kdG = await ev<{ up: boolean; hp: number; max: number }>(guest, "window.__range.kdState()");
  check("knockdown shield: holding fire while down raises it, full (200 / 450 / 750 by EVO level)", kdG.up && kdG.hp === kdG.max && [200, 450, 750].includes(kdG.max), JSON.stringify(kdG));
  const kdSeen = await host.waitForFunction("window.__range.duel().remotes.get(1)?.avatar.knockShieldUp === true", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  check("knockdown shield: the host sees it on the guest's figure", kdSeen);
  // a shot from in front goes into it; one from behind does not
  const front = await ev<{ kd: number; bleed: number }>(guest, `(() => { const r = window.__range; const d = r.duel(); const bot = [...d.remotes.values()].find((x) => x.id >= 100 && x.alive); const p = r.player.pos; const b = bot.avatar.group.position; r.player.yaw = Math.atan2(-(b.x - p.x), -(b.z - p.z)) * 180 / Math.PI; const k0 = r.kdState().hp; const b0 = d.bleedHp; d.takeHit(60, bot.id); return { kd: k0 - r.kdState().hp, bleed: b0 - d.bleedHp }; })()`);
  const behind = await ev<{ kd: number; bleed: number }>(guest, `(() => { const r = window.__range; const d = r.duel(); const bot = [...d.remotes.values()].find((x) => x.id >= 100 && x.alive); r.player.yaw += 180; const k0 = r.kdState().hp; const b0 = d.bleedHp; d.takeHit(10, bot.id); return { kd: k0 - r.kdState().hp, bleed: b0 - d.bleedHp }; })()`);
  check("knockdown shield: a hit from in front goes into it, one from behind into you", front.kd === 60 && front.bleed === 0 && behind.kd === 0 && behind.bleed === 10, JSON.stringify({ front, behind }));
  await ev(guest, padSet(7, false));
  await sleep(300);
  // the host walks over and holds E for 5 s: the guest is back up with 20 health
  await ev(host, `(() => { const r = window.__range; const d = r.duel(); d.holdFire = true; const g = d.remotes.get(1).samples.at(-1); r.player.teleport(g.x + 1.2, g.y, g.z, 90); })()`);
  await sleep(300);
  const revPrompt = await ev<string>(host, "JSON.stringify(window.__range.brPlay.hud.prompt)");
  check("squad: next to a downed mate the prompt is HOLD E to REVIVE", /REVIVE/.test(revPrompt), revPrompt);
  await ev(host, `window.__range.setScript({ held: (a) => a === "interact", pressedNow: () => false })`);
  const reviving = await guest.waitForFunction("window.__range.duel().revivedBy === 0", { polling: 100, timeout: 3000 }).then(() => true, () => false);
  check("squad: the guest sees the host reviving them", reviving);
  const revived = await guest.waitForFunction("!window.__range.duel().downed && window.__range.duel().alive", { polling: 100, timeout: 8000 }).then(() => true, () => false);
  await ev(host, "window.__range.setScript(null)");
  const hp = await ev<number>(guest, "window.__range.duel().health");
  check("squad: after 5 s of E the guest is back up with 20 health", revived && hp === 20, `health ${hp}`);
  // the reviver's credit comes once the guest has said they are up (plan section 12, item 5)
  const credited = await host.waitForFunction("/IS BACK UP|REVIVE/.test(window.__range.hud.noticeText ?? '')", { polling: 50, timeout: 3000 }).then(() => true, () => false);
  check("squad: the reviver is told the guest is back up, once the guest says so", credited, String(await ev(host, "window.__range.hud.noticeText")));
  // down again and finished off: out, the killcam, their echo for the squad (two cells on them first, to be given back)
  await ev(guest, `window.__range.applyLoot({ kind: "heal", id: "cell", n: 2, rarity: "common" })`);
  await ev(guest, `(() => { const d = window.__range.duel(); d.takeHit(500, 100); })()`);
  await sleep(300);
  const second = await ev<{ downed: boolean; left: number }>(guest, "(() => { const d = window.__range.duel(); return { downed: d.downed, left: d.bleedUntil - performance.now() / 1000 }; })()");
  check("squad: the second knock bleeds out from a duo's 30 s (half of 60)", second.downed && second.left > 25 && second.left <= 30.5, JSON.stringify(second));
  await ev(guest, `(() => { const d = window.__range.duel(); d.takeHit(150, 100); })()`);
  await sleep(800);
  const guestOut = await ev<{ alive: boolean; phase: string }>(guest, "({ alive: window.__range.duel().alive, phase: window.__range.duel().phase })");
  const hostOn = await ev<string>(host, "window.__range.duel().phase");
  check("squad: finished while down: out, and the match goes on for the host", !guestOut.alive && guestOut.phase === "fight" && hostOn === "fight", JSON.stringify({ guestOut, hostOn }));
  // a revive the host finished for a guest who is out instead (they died as it ended) earns nothing
  const unearned = await ev<string>(host, `new Promise((ok) => { const r = window.__range; r.hud.noticeText = ""; r.brPlay.revived = { id: 1, name: "GHOSTLY", at: r.gameTime() }; setTimeout(() => ok(r.hud.noticeText ?? ""), 800); })`);
  // (the credit is the notice and then the EVO for it, which says REVIVE)
  check("squad: a revive whose mate is out instead is not credited", !/BACK UP|REVIVE/.test(unearned), unearned || "nothing said");
  const outFig = await ev<{ holding: boolean; knocked: boolean }>(host, "(() => { const a = window.__range.duel().remotes.get(1).avatar; return { holding: a.holdingGun, knocked: a.knocked }; })()");
  check("out: the host's figure of you is down and holds no gun", outFig.knocked && !outFig.holding, JSON.stringify(outFig));
  const echo = await host.waitForFunction("[...window.__range.duel().lootField.drops.values()].some((x) => x.item.kind === 'echo' && x.item.owner === 1)", { polling: 200, timeout: 4000 }).then(() => true, () => false);
  const boxes = await ev<number>(host, "[...window.__range.duel().lootField.drops.values()].filter((x) => x.item.kind === 'box').length");
  check("squad: the guest's echo lies where they fell, on the host's floor too, and no death box", echo && boxes === 0, JSON.stringify({ echo, boxes }));
  // brought back at the echo: the host holds interact there (the lockout waived for the test): a beam for all, and the guest is back on it at 20 health
  await ev(host, "window.__range.duel().boxLockout = () => 0");
  const bAt = await ev<{ x: number; z: number } | null>(host, "(() => { const d = [...window.__range.duel().lootField.drops.values()].find((x) => x.item.kind === 'echo' && x.item.owner === 1); return d ? { x: d.pos.x, z: d.pos.z } : null; })()");
  await ev(host, `window.__range.player.teleport(${(bAt?.x ?? 0) + 1}, 0, ${bAt?.z ?? 0}, 90)`);
  await sleep(400);
  const echoPrompt = await ev<string>(host, "JSON.stringify(window.__range.brPlay.hud.prompt)");
  check("echo restore: at a dead mate's echo, a hold brings them back there", /HOLD/.test(echoPrompt) && /BACK HERE/.test(echoPrompt), echoPrompt);
  await ev(host, `window.__range.setScript({ held: (a) => a === "interact", pressedNow: () => false })`);
  const beamSeen = await guest.waitForFunction("window.__range.remoteFxLog.some((e) => e.k === 'beam' && e.from === 0)", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  check("echo restore: the beam goes up on the others' screens while it runs", beamSeen);
  const back = await guest.waitForFunction("window.__range.duel().alive", { polling: 100, timeout: 11000 }).then(() => true, () => false);
  await ev(host, "window.__range.setScript(null)");
  await sleep(600);
  const gBack = await ev<{ hp: number; d: number; regen: boolean; shield: number; max: number; cells: number }>(guest, `(() => { const r = window.__range; const d = r.duel(); const p = r.player.pos; return { hp: d.health, d: Math.hypot(p.x - ${bAt?.x ?? 0}, p.z - ${bAt?.z ?? 0}), regen: !!r.kdState().echo, shield: d.shield, max: d.shieldMax, cells: r.kit.items.cell ?? 0 }; })()`);
  check("echo restore: 7 s later the guest is up on their echo at 20 health, the shield coming back from nothing, what they died with given back", back && gBack.hp === 20 && gBack.d < 3 && gBack.regen && gBack.shield < gBack.max && gBack.cells >= 2, JSON.stringify(gBack));
  const left = await ev<string[]>(host, `[...window.__range.duel().lootField.drops.values()].filter((x) => x.item.kind === "echo" ? x.item.owner === 1 : Math.hypot(x.pos.x - ${bAt?.x ?? 0}, x.pos.z - ${bAt?.z ?? 0}) < 1.3).map((x) => x.item.kind + ":" + x.item.id)`);
  check("echo restore: the echo and what the guest dropped are cleared off the floor, so none of it is there twice", left.length === 0, JSON.stringify(left));
  // A gold knockdown shield's self-revive: the guest loots one, goes down with
  // the host still up, holds interact, and stands again at a squad mate's
  // revive health with the shield's one self-revive spent.
  await ev(guest, `window.__range.applyLoot({ kind: "knockdown", id: "gold", n: 1, rarity: "legendary" })`);
  await ev(guest, `(() => { const d = window.__range.duel(); d.takeHit(500, 100); })()`);
  await sleep(500);
  const selfPrompt = await ev<string>(guest, "JSON.stringify(window.__range.hud.last?.downed?.self ?? null)");
  await ev(guest, `window.__range.setScript({ held: (a) => a === "interact", pressedNow: () => false })`);
  const selfUp = await guest.waitForFunction("!window.__range.duel().downed && window.__range.duel().alive", { polling: 100, timeout: 12000 }).then(() => true, () => false);
  await ev(guest, "window.__range.setScript(null)");
  const selfState = await ev<{ hp: number; left: number }>(guest, "(() => { const r = window.__range; return { hp: r.duel().health, left: r.kd.selfLeft }; })()");
  check("self-revive: down with a gold shield, the HUD offers it, holding interact stands you up at revive health, and it is spent", /"key"/.test(selfPrompt) && selfUp && selfState.hp === 20 && selfState.left === 0, JSON.stringify({ selfPrompt, selfUp, selfState }));

  // ---- The late rings, brought forward on the host: its ring put into the
  // second round's close, past the crate's delay, with the circle held where
  // it is (the next circle set to the current one) so nobody ends up outside.
  await ev(
    host,
    `(() => { const r = window.__range.duel().ring; window.__ringWas = { phase: r.phase, state: r.state, timeLeft: r.timeLeft, current: { ...r.current }, next: { ...r.next }, from: { ...r.from } };
      Object.assign(r.next, r.current); r.from = { ...r.current }; r.phase = 1; r.state = "closing"; r.timeLeft = ${ringCfg.phases[1].close - brCfg.loadoutPod.after - 0.5}; })()`
  );
  await sleep(1500);
  const drops = await Promise.all(
    [host, guest].map((p) =>
      ev<{ crates: Array<{ x: number; z: number }>; packages: number; marks: string[]; said: string[] }>(
        p,
        `(() => { const r = window.__range; const h = r.duel().hud().br; return { crates: h.pods.filter((x) => x.loadout).map((x) => ({ x: x.x, z: x.z })), packages: h.pods.filter((x) => !x.loadout).length, marks: r.brPlay.markers.map((m) => m.label), said: window.__notices.filter((t) => / INBOUND /.test(t)) }; })()`
      )
    )
  );
  check("care package: the host calls one as the second round closes and the guest is told: on its map, pinged, the place named", drops[1].packages === 1 && drops[1].marks.includes("CARE PACKAGE") && drops[1].said.some((t) => t.startsWith("CARE PACKAGE INBOUND")), JSON.stringify(drops[1]));
  const [hc, gc] = [drops[0].crates, drops[1].crates];
  const saidCare = drops[1].said.findIndex((t) => t.startsWith("CARE PACKAGE"));
  const saidCrate = drops[1].said.findIndex((t) => t.startsWith("LOADOUT CRATE"));
  check(
    "loadout crate: host and guest each work out the same spot from the seed and the ring, nothing sent for it, and it is called after the package",
    hc.length === 1 && gc.length === 1 && Math.hypot(hc[0].x - gc[0].x, hc[0].z - gc[0].z) < 1e-6 && drops[1].marks.includes("LOADOUT CRATE") && saidCare >= 0 && saidCrate > saidCare,
    JSON.stringify({ host: hc, guest: gc, said: drops[1].said })
  );
  // both copies land at once for the test, and the guest stands on its own for the claim time
  for (const p of [host, guest]) await ev(p, `(() => { for (const x of window.__range.duel().pods) if (x.kind === "loadout") x.landsAt = performance.now() / 1000 + 0.2; })()`);
  const gWant = await ev<string[]>(guest, "(() => { const d = window.__range.loadouts.current; return [d.slot1, d.slot2]; })()");
  await ev(guest, `window.__range.player.teleport(${gc[0]?.x ?? 0}, 0, ${gc[0]?.z ?? 500}, 0)`);
  await sleep(3600);
  const gGot = await ev<string[]>(guest, "window.__range.loadout.slots.map((s) => s.id)");
  const hostClaims = await ev<number>(host, `window.__range.duel().pods.filter((x) => x.kind === "loadout").reduce((n, x) => n + x.claimed.size, 0)`);
  check("loadout crate: the guest claims its own loadout off its own copy, and the host's crate is untouched by it", gGot.join() === gWant.join() && hostClaims === 0, JSON.stringify({ gGot, gWant, hostClaims }));
  // Storm Surge: the host's ring held in its last round with more alive than
  // it allows, and the guest the one who has dealt the least. The host ranks,
  // the ring packet carries the line, and the guest takes its own tick.
  await ev(host, `(() => { const d = window.__range.duel(); const r = d.ring; r.phase = ${ringCfg.phases.length - 1}; r.state = "waiting"; r.timeLeft = 1e6; d.dealt.clear(); d.dealt.set(0, { total: 5000, at: -1e9 }); for (const b of d.bots) d.dealt.set(b.bot.remote.id, { total: 999, at: -1e9 }); })()`);
  await sleep(900);
  const gWarn = await ev<{ surge: { live: boolean; startsIn: number; safe: boolean } | null; said: boolean }>(guest, `({ surge: window.__range.duel().hud().br.surge, said: window.__notices.some((t) => t.startsWith("STORM SURGE IN")) })`);
  check("storm surge: the guest sees it called, with its countdown and itself below the line, off the host's ring packet", !!gWarn.surge && !gWarn.surge.live && gWarn.surge.startsIn > 0 && !gWarn.surge.safe && gWarn.said, JSON.stringify(gWarn));
  await ev(host, "window.__range.duel().surgeAt = performance.now() / 1000");
  await ev(guest, "window.__range.duel().health = 100");
  await sleep(900);
  const gSurge = await ev<{ hp: number; surge: { live: boolean; safe: boolean } | null }>(guest, "(() => { const d = window.__range.duel(); return { hp: d.shield + d.health, surge: d.hud().br.surge }; })()");
  await sleep(1800);
  const gSurged = await ev<number>(guest, "(() => { const d = window.__range.duel(); return d.shield + d.health; })()");
  const hostSafe = await ev<boolean | null>(host, "window.__range.duel().hud().br.surge?.safe ?? null");
  check("storm surge: live, the guest below the line takes its own tick wherever it stands, while the host above it is clear", !!gSurge.surge && gSurge.surge.live && !gSurge.surge.safe && gSurge.hp - gSurged >= brCfg.surge.damage[0] && hostSafe === true, JSON.stringify({ ...gSurge, after: gSurged, hostSafe }));
  // the host's ring put back: the surge no longer applies on either screen
  await ev(host, `(() => { const r = window.__range.duel().ring; const w = window.__ringWas; r.phase = w.phase; r.state = w.state; r.timeLeft = w.timeLeft; Object.assign(r.current, w.current); Object.assign(r.next, w.next); r.from = w.from; })()`);
  await sleep(1000);
  const gOver = await ev<{ surge: unknown; said: boolean }>(guest, `({ surge: window.__range.duel().hud().br.surge, said: window.__notices.includes("STORM SURGE OVER") })`);
  check("storm surge: over on the host is over on the guest, and it says so", gOver.surge === null && gOver.said, JSON.stringify(gOver));

  // out again for what follows: down, then finished
  await ev(guest, `(() => { const d = window.__range.duel(); d.takeHit(500, 100); })()`);
  await sleep(300);
  await ev(guest, `(() => { const d = window.__range.duel(); d.takeHit(150, 100); })()`);
  await sleep(800);
  const gk = await ev<{ active: boolean; killer: string }>(guest, "window.__range.killcamState()");
  check("squad: the guest's killcam is the bot that got them (a bot the host runs)", gk.active && /^BOT /.test(gk.killer), JSON.stringify(gk));
  // the host goes down too: no one left up to revive, so out; the squad is out, both get the placement
  await ev(host, `(() => { const d = window.__range.duel(); d.takeHit(500, 100); })()`);
  await sleep(1200);
  const ends = await Promise.all([host, guest].map((p) => ev<{ phase: string; placement: number | null; of: number }>(p, "({ phase: window.__range.duel()?.phase, placement: window.__range.duel()?.hud().br.placement, of: window.__range.duel()?.hud().br.squadsTotal })")));
  check("squad: with the last of the squad down both see the placement, out of the squads (#3 of 3: both bot pairs still up)", ends.every((e) => e.phase === "matchEnd" && e.placement === 3 && e.of === 3), JSON.stringify(ends));
  await ev(host, "window.__range.duel()?.leave()");
  await Promise.all([host, guest].map((p) => p.waitForFunction("window.__range.duel() === null", { polling: 200, timeout: 15000 }).catch(() => undefined)));

  // ---- Solo with a friend. The two of you are still on one side (only the
  // bots come in squads), but nobody picks anybody up: a knock is the end
  // even with the friend up, and the host's size is again the guest's.
  await ev(host, brRow("solo", 3));
  await ev(host, `(() => { document.getElementById("duelMode").value = "br"; document.getElementById("duelHost").click(); })()`);
  const code2 = await host
    .waitForFunction(`(() => { const c = document.querySelector("#duelStatus .code"); return c && c.textContent; })()`, { polling: 200, timeout: 20000 })
    .then((h) => h.jsonValue() as Promise<string>, () => "");
  check("solo with a friend: the host gets a code", /^[A-Z0-9]{5}$/.test(code2), code2);
  if (!code2) {
    await host.close();
    await guest.close();
    return;
  }
  await ev(guest, `(() => { document.getElementById("duelCode").value = "${code2}"; document.getElementById("duelJoin").click(); })()`);
  const joined = await Promise.all([host, guest].map((p) => p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 }).then(() => true, () => false)));
  for (const p of [host, guest]) await pressPlay(p);
  const fought = await Promise.all([host, guest].map((p) => p.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 45000 }).then(() => true, () => false)));
  const soloTeams = await Promise.all([host, guest].map((p) => ev<string | null>(p, "window.__range.duel()?.team.id ?? null")));
  check("solo with a friend: both connect and land, and both play solo", joined.every(Boolean) && fought.every(Boolean) && soloTeams.every((t) => t === "solo"), JSON.stringify({ joined, fought, soloTeams }));
  await ev(host, "window.__range.duel().holdFire = true");
  await ev(guest, `(() => { const d = window.__range.duel(); d.takeHit(500, 100); })()`);
  await sleep(900);
  const gSolo = await ev<{ alive: boolean; downed: boolean; phase: string }>(guest, "(() => { const d = window.__range.duel(); return { alive: d.alive, downed: d.downed, phase: d.phase }; })()");
  const hSolo = await ev<{ mate: boolean | null; phase: string }>(host, "(() => { const d = window.__range.duel(); return { mate: d.remotes.get(1)?.alive ?? null, phase: d.phase }; })()");
  check("solo with a friend: a knock is the end even with the friend up to come: out, not down, and it goes on for the host", !gSolo.alive && !gSolo.downed && gSolo.phase === "fight" && hSolo.mate === false && hSolo.phase === "fight", JSON.stringify({ gSolo, hSolo }));
  await ev(host, `(() => { const d = window.__range.duel(); d.takeHit(500, 100); })()`);
  await sleep(1200);
  const botsUp = await ev<number>(host, "window.__range.duel().bots.filter((b) => b.bot.alive).length");
  const soloEnds = await Promise.all([host, guest].map((p) => ev<{ phase: string; placement: number | null; of: number } | null>(p, "(() => { const d = window.__range.duel(); return d && { phase: d.phase, placement: d.hud().br.placement, of: d.hud().br.squadsTotal }; })()")));
  // each placed on their own (solo is everyone against everyone): the host, out
  // last, behind every bot still up; the guest, out first, behind the host too
  check("solo with a friend: the last of you out ends it for both, each placed where they went out, out of everyone", soloEnds.every((e) => !!e && e.phase === "matchEnd" && e.of === 5) && soloEnds[0]?.placement === botsUp + 1 && soloEnds[1]?.placement === botsUp + 2, JSON.stringify({ soloEnds, botsUp }));
  await ev(host, "window.__range.duel()?.leave()");
  await sleep(500);
  await host.close();
  await guest.close();
}

/**
 * What a match's state packets should have been, for NET_PROBE: "deltas" when
 * both pages are this build (they find each other and switch to the delta
 * packets), "full" when one of them is a build from before them or has them
 * off (this build's page must never have switched, and must never have been
 * sent one).
 */
type NetWant = "deltas" | "full";

/** a page's delta packets as its Duel saw them, toward `peer`; null on a build from before them */
const NET_PROBE = (peer: number) => `(() => { const s = window.__range.duel()?.sync; return s ? { on: s.speaksDeltas(${peer}), applied: s.stats.applied, refused: s.stats.refused, unexpected: s.stats.unexpected, sent: s.stats.parts } : null; })()`;
interface NetSeen {
  on: boolean;
  applied: number;
  refused: number;
  unexpected: number;
  sent: number;
}
/** whether one page's state packets went the way they should have */
function netAsWanted(n: NetSeen | null, want: NetWant): boolean {
  if (!n) return want === "full";
  return want === "deltas" ? n.on && n.applied > 0 && n.sent > 0 && n.refused === 0 && n.unexpected === 0 : !n.on && n.applied === 0 && n.sent === 0 && n.unexpected === 0;
}

/**
 * A loadout wearing clothes the operator would not choose for itself: the
 * guest arrives in a tracksuit with goggles and a head wrap, and the host has
 * to draw that rather than the operator's own fatigues (src/game/outfit.ts).
 */
const WORN_LOADOUT = `localStorage.setItem("range.loadouts.v1", JSON.stringify({
  selected: { kind: "custom", index: 0 },
  custom: [{ name: "Worn", operator: "vanguard", slot1: "rspn101", slot2: "wingman", heirloom: "fists", outfit: "shirtsleeves", build: "heavy", face: "" }],
}))`;

async function duelTest(browser: Browser, query: string, label: string, bases: [string, string] = [BASE, BASE], want: NetWant = "deltas"): Promise<boolean> {
  const host = await open(browser, query, bases[0]);
  const guest = await open(browser, query, bases[1], WORN_LOADOUT);
  // clicks through script, not the mouse: a background page gets no
  // animation frames, which puppeteer's mouse click waits on
  await ev(host, `document.getElementById("duelHost").click()`);
  let code = "";
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
  } catch {
    const msg = await ev<string>(host, `document.getElementById("duelStatus").textContent`);
    await host.close();
    await guest.close();
    console.log(`  --  ${label}: no match code (${msg})`);
    return false;
  }
  check(`${label}: the host gets a 5-letter code`, /^[A-Z0-9]{5}$/.test(code), code);
  // the lobby is the range (every host's since Milestone 485): the host is in it, with the code on the HUD, before anyone joins
  const lobby = await ev<{ x: number; z: number; lobby: string | null }>(host, `(() => { const p = window.__range.player.pos; return { x: p.x, z: p.z, lobby: window.__range.lobbyCode() }; })()`);
  check(`${label}: the host waits in the range with the code on the HUD`, Math.hypot(lobby.x, lobby.z) < 1 && lobby.lobby === code, JSON.stringify(lobby));
  // Create and a connect take the players straight in (a scripted page gets the
  // lock too); back to the menu here, so the Play gate below is what is tested
  await toMenu(host);
  await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
  try {
    await host.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
    await guest.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  } catch {
    check(`${label}: both sides connect`, false, await ev<string>(guest, `document.getElementById("duelStatus").textContent`));
    await host.close();
    await guest.close();
    return true;
  }
  check(`${label}: both sides connect`, true);
  check(`${label}: roles`, (await ev<string>(host, "window.__range.duel().role")) === "host" && (await ev<string>(guest, "window.__range.duel().role")) === "guest");
  await toMenu(guest);
  await toMenu(host);

  // each sees the other at the other's spawn
  await sleep(1500);
  const seen = await ev<{ x: number; z: number; visible: boolean }>(
    host,
    `(() => { const g = window.__range.duel().avatars[0].group; return { x: g.position.x, z: g.position.z, visible: g.visible }; })()`
  );
  check(`${label}: the host sees the guest at the guest spawn (arena, far end)`, seen.visible && Math.abs(seen.x - 90) < 0.5 && Math.abs(seen.z + 11) < 0.5, `${seen.x.toFixed(1)}, ${seen.z.toFixed(1)}`);
  const seen2 = await ev<{ x: number; z: number }>(guest, `(() => { const g = window.__range.duel().avatars[0].group; return { x: g.position.x, z: g.position.z }; })()`);
  check(`${label}: and the guest sees the host at the host spawn`, Math.abs(seen2.x - 90) < 0.5 && Math.abs(seen2.z + 69) < 0.5, `${seen2.x.toFixed(1)}, ${seen2.z.toFixed(1)}`);

  // What the guest chose to wear crosses the wire beside the operator id, so
  // the host draws the tracksuit, the goggles and the wrap. An older build on
  // either side has never heard of the field: it ignores it and dresses the
  // operator in its own set, which is why the strong check only runs when both
  // sides are this build. Either way the figure is dressed, never bare.
  // (asked of THIS build only: an older one has no such handle, and in a mixed
  // run the page doing the looking can be the older one)
  if (bases[0] === BASE) {
    // (the figure's rig is a model load: wait for it rather than assume the frame)
    await host.waitForFunction(`window.__range.figureWear("opponent").length >= 6`, { polling: 200, timeout: 15000 }).catch(() => null);
    const worn = await ev<string[]>(host, `window.__range.figureWear("opponent")`);
    check(`${label}: the other figure is dressed`, worn.length >= 4, worn.join(" "));
    if (bases[1] === BASE) {
      // The guest is in SHIRTSLEEVES, which is the pack's peasant shirt and
      // trousers; the default loadout is in the ranger's coat. So the host
      // seeing peasant parts is the host seeing the guest's own choice, and
      // not what it would draw for anybody.
      check(
        `${label}: and wears the published cloth the guest chose, not the default`,
        worn.some((w) => w.includes("Peasant_Body")) && worn.some((w) => w.includes("Peasant_Legs")) && !worn.some((w) => w.includes("Ranger_Body")),
        worn.join(" ")
      );
    }
  }

  // nobody has clicked Play: the host holds at "waiting" (the countdown used
  // to start the moment the guest connected, with both still on the menu)
  await sleep(800);
  const held = await ev<{ phase: string; waiting: string | null }>(host, "({ phase: window.__range.duel().phase, waiting: window.__range.duel().hud().waiting })");
  check(`${label}: the match waits until everyone clicks Play`, held.phase === "waiting" && /PLAY/.test(held.waiting ?? ""), JSON.stringify(held));
  await pressPlay(host);
  await sleep(400);
  const stillHeld = await ev<string>(host, "window.__range.duel().phase");
  check(`${label}: one player in is not enough`, stillHeld === "waiting", stillHeld);
  await pressPlay(guest);
  // the countdown ends on both sides
  await host.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 15000 });
  await guest.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 15000 });
  check(`${label}: countdown ends, both sides fighting`, true);

  // a 50 damage hit comes off the guest's shield first
  await ev(host, "(() => { const d = window.__range.duel(); d.localHit(d.remoteOf(d.avatars[0]), 50, false); })()");
  await guest.waitForFunction("window.__range.duel().shield < 75", { polling: 200, timeout: 10000 });
  const g1 = await ev<{ sh: number; hp: number }>(guest, "({ sh: window.__range.duel().shield, hp: window.__range.duel().health })");
  check(`${label}: a 50 hit takes the guest's shield 75 to 25, health untouched`, g1.sh === 25 && g1.hp === 100, `shield ${g1.sh} health ${g1.hp}`);

  // a big one knocks: the host takes the round
  await ev(host, "(() => { const d = window.__range.duel(); d.localHit(d.remoteOf(d.avatars[0]), 200, true); })()");
  await guest.waitForFunction("window.__range.duel().alive === false", { polling: 200, timeout: 10000 });
  await host.waitForFunction(`window.__range.duel().hud().you === 1`, { polling: 200, timeout: 10000 });
  await guest.waitForFunction(`window.__range.duel().hud().them === 1`, { polling: 200, timeout: 10000 });
  check(`${label}: a knock scores the round 1-0 for the host, on both screens`, true);
  const feedH = await ev<string[]>(host, "window.__range.hud.feedText");
  const feedG = await ev<string[]>(guest, "window.__range.hud.feedText");
  check(`${label}: the kill feed says who eliminated whom, on both screens`, feedH.some((t) => /eliminated/.test(t)) && feedG.some((t) => /eliminated/.test(t)), `host: ${feedH[0] ?? "-"} | guest: ${feedG[0] ?? "-"}`);
  // the host sees the guest's figure fall over (it used to stay standing)
  const fell = await host
    .waitForFunction("window.__range.duel().avatars[0].group.rotation.x < -1", { polling: 100, timeout: 2500 })
    .then(() => true, () => false);
  check(`${label}: the knocked player's figure falls over on the other screen`, fell);
  const phase = await ev<string>(guest, "window.__range.duel().phase");
  check(`${label}: the guest sees the round end`, phase === "roundEnd" || phase === "countdown", phase);

  // next round: both back at full
  await guest.waitForFunction("window.__range.duel().round === 2 && window.__range.duel().alive", { polling: 200, timeout: 15000 });
  const g2 = await ev<{ sh: number; hp: number }>(guest, "({ sh: window.__range.duel().shield, hp: window.__range.duel().health })");
  check(`${label}: round 2 restores the guest to 75 shield and 100 health`, g2.sh === 75 && g2.hp === 100, `shield ${g2.sh} health ${g2.hp}`);

  // The circle: stand in it alone once it is live (20 s into the round) for
  // 10 s and the round is yours. Only on the local transport, it takes 30 s.
  if (label === "local") {
    await host.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 20000 });
    const fightAt = Date.now();
    await ev(host, `(() => { const p = window.__range.player; p.teleport(90, 0, -40, 180); })()`);
    const live = await host.waitForFunction(`window.__range.duel().hud().zone.live`, { polling: 250, timeout: 30000 }).then(() => true, () => false);
    // real seconds: the round clock is wall time now, not the game clock
    const liveAfter = (Date.now() - fightAt) / 1000;
    check(`${label}: the circle goes live 20 s into the round, in real time`, live && liveAfter >= 18 && liveAfter <= 23.5, `${liveAfter.toFixed(1)} s`);
    const took = await host.waitForFunction(`window.__range.duel().hud().you === 2`, { polling: 250, timeout: 20000 }).then(() => true, () => false);
    check(`${label}: holding it alone for 10 s takes the round (2-0)`, took);
    const gsaw = await guest.waitForFunction(`window.__range.duel().hud().them === 2`, { polling: 250, timeout: 10000 }).then(() => true, () => false);
    check(`${label}: and the guest's screen agrees`, gsaw);
  }

  // Quick chat: the host says line 1 and it shows in the guest's kill feed
  // under the host's name, and the next line inside the gap is refused
  const said = await ev<[boolean, boolean]>(host, "[window.__range.quickChat(0), window.__range.quickChat(1)]");
  const heard = await guest
    .waitForFunction("window.__range.hud.feedText.some((t) => /: GG$/.test(t))", { polling: 200, timeout: 6000 })
    .then(() => true, () => false);
  check(`${label}: quick chat: a line said by the host shows in the guest's feed, and a second inside the gap is held`, said[0] && !said[1] && heard, JSON.stringify({ said, heard }));

  // The state packets over the whole match: two pages of this build found
  // each other and moved every figure above with the delta packets, and
  // nothing was refused; with an older build on one side, this build's page
  // never switched and was never sent one.
  const nets = [await ev<NetSeen | null>(host, NET_PROBE(1)), await ev<NetSeen | null>(guest, NET_PROBE(0))];
  check(`${label}: the state packets were ${want === "deltas" ? "delta packets both ways, none refused" : "the full ones, both ways"}`, nets.every((n) => netAsWanted(n, want)), JSON.stringify(nets));
  // two pages of this build over the internet: the delta packets went on the unordered channel, both ways
  if (label === "p2p") {
    const fast = [await ev<{ open: boolean; sent: number; got: number } | null>(host, "window.__range.duel()?.linkFor(1)?.fastStats?.() ?? null"), await ev<{ open: boolean; sent: number; got: number } | null>(guest, "window.__range.duel()?.linkFor(0)?.fastStats?.() ?? null")];
    check(`${label}: the delta packets and their acks went on the unordered channel, both ways`, fast.every((f) => !!f && f.open && f.sent > 5 && f.got > 5), JSON.stringify(fast));
  }

  // Which reload it is crosses to the other screen (act code 9 from empty, 1 with rounds left): the owner, 2026-09-30, "a
  // reload differentiator for empty mag vs still 1 in the chamber". The guest reloads from empty, then with half a
  // magazine, its gun's own reload begun on its own clock (a key needs the gun out, and the round may have it away)
  const reloadSeen = async (clip: string): Promise<{ act: string | null; empty: boolean | null }> => {
    await ev(guest, `(() => { const r = window.__range; const s = r.loadout.active.state; s.clip = ${clip}; s.startReload(r.gameTime()); })()`);
    const got = await host
      .waitForFunction(`(() => { const r = window.__range.duel().remotes.get(1); const s = r?.samples[r.samples.length - 1]; return s && s.act === "reload" ? { act: s.act, empty: !!s.reloadEmpty } : null; })()`, { polling: 50, timeout: 5000 })
      .then((h) => h.jsonValue() as Promise<{ act: string; empty: boolean }>, () => ({ act: null, empty: null }));
    await guest.waitForFunction("!window.__range.loadout.active.state.reloading", { polling: 100, timeout: 8000 }).catch(() => undefined);
    return got;
  };
  const fromEmpty = await reloadSeen("0");
  const tactical = await reloadSeen("Math.max(1, Math.floor(s.clip / 2))");
  check(`${label}: a reload from empty is seen as one on the other screen, and one with rounds left as the tactical one`, fromEmpty.act === "reload" && fromEmpty.empty === true && tactical.act === "reload" && tactical.empty === false, JSON.stringify({ fromEmpty, tactical }));

  // leaving tells the other side
  await ev(guest, "window.__range.duel().leave()");
  await host.waitForFunction("window.__range.duel() === null", { polling: 200, timeout: 15000 });
  check(`${label}: leaving ends the match on the other side`, true);
  await host.close();
  await guest.close();
  return true;
}

/** three tabs: the host makes a 3-player match, two guests join, the host knocks both */
async function tripleTest(browser: Browser, query: string, tag = "1v1v1", pages3: Array<{ base?: string; extra?: string; want?: NetWant }> = []): Promise<void> {
  const at = (i: number) => pages3[i] ?? {};
  const host = await open(browser, query + (at(0).extra ?? ""), at(0).base);
  const g1 = await open(browser, query + (at(1).extra ?? ""), at(1).base);
  const g2 = await open(browser, query + (at(2).extra ?? ""), at(2).base);
  const pages = [host, g1, g2];
  const closeAll = async () => {
    for (const p of pages) await p.close();
  };
  await ev(host, `(() => { document.getElementById("duelPlayers").value = "3"; document.getElementById("duelHost").click(); })()`);
  let code = "";
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
  } catch {
    check(`${tag}: the host gets a code`, false, await ev<string>(host, `document.getElementById("duelStatus").textContent`));
    await closeAll();
    return;
  }
  await ev(g1, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
  await host.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  const waiting = await ev<string>(host, "window.__range.duel().phase");
  check(`${tag}: with one guest in, the host waits for the second`, waiting === "waiting", waiting);
  await ev(g2, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
  try {
    for (const p of pages) await p.waitForFunction("window.__range.duel() !== null && window.__range.duel().players === 3", { polling: 200, timeout: 30000 });
  } catch {
    check(`${tag}: all three connect`, false, await ev<string>(g2, `document.getElementById("duelStatus").textContent`));
    await closeAll();
    return;
  }
  check(`${tag}: all three connect`, true);
  const ids = await Promise.all(pages.map((p) => ev<number>(p, "window.__range.duel().id")));
  check(`${tag}: ids 0, 1, 2`, ids.join(",") === "0,1,2", ids.join(","));
  // a player standing still sends a whole state only every keyframe (2 s), and one relayed by the host
  // crosses two streams, so the figures can take a few seconds to appear
  const visible = "window.__range.duel().avatars.filter((a) => a.group.visible).length";
  await host.waitForFunction(`${visible} === 2`, { polling: 200, timeout: 6000 }).catch(() => undefined);
  const seen = await ev<number>(host, visible);
  check(`${tag}: the host sees two figures`, seen === 2, `${seen}`);
  await g2.waitForFunction(`${visible} === 2`, { polling: 200, timeout: 6000 }).catch(() => undefined);
  const seenByGuest = await ev<number>(g2, visible);
  check(`${tag}: a guest sees the other two (one relayed by the host)`, seenByGuest === 2, `${seenByGuest}`);
  const spawns = await Promise.all(pages.map((p) => ev<{ x: number; z: number }>(p, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })")));
  const distinct = new Set(spawns.map((sp) => `${sp.x.toFixed(0)},${sp.z.toFixed(0)}`)).size;
  check(`${tag}: three different corners of the triangle`, distinct === 3 && spawns.every((sp) => Math.hypot(sp.x - 90, sp.z - 60) > 15), JSON.stringify(spawns.map((sp) => [+sp.x.toFixed(1), +sp.z.toFixed(1)])));
  // The relay moves figures, whatever form each guest reads it in: guest 2
  // steps toward the middle and guest 1 sees it there, then the other way
  // round. With one guest on the full packets this is the host turning one
  // guest's delta packets into the other's full ones, and back.
  for (const [mover, watcher, id] of [
    [g2, g1, 2],
    [g1, g2, 1],
  ] as const) {
    const to = await ev<{ x: number; z: number }>(mover, `(() => { const p = window.__range.player; const dx = 90 - p.pos.x, dz = 60 - p.pos.z, d = Math.hypot(dx, dz) || 1; p.teleport(p.pos.x + (dx / d) * 4, p.pos.y, p.pos.z + (dz / d) * 4, p.yaw); return { x: p.pos.x, z: p.pos.z }; })()`);
    const moved = await watcher
      .waitForFunction(`(() => { const r = window.__range.duel().remotes.get(${id}); const g = r && r.avatar.group.position; return !!g && Math.hypot(g.x - ${to.x}, g.z - ${to.z}) < 0.2; })()`, { polling: 100, timeout: 5000 })
      .then(() => true, () => false);
    check(`${tag}: player ${id + 1} moves and the other guest sees it, through the host`, moved, JSON.stringify(await ev(watcher, `(() => { const g = window.__range.duel().remotes.get(${id})?.avatar.group.position; return { want: ${JSON.stringify(to)}, saw: g && { x: +g.x.toFixed(2), z: +g.z.toFixed(2) } }; })()`)));
  }
  for (const p of pages) await pressPlay(p);
  for (const p of pages) await p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 15000 });
  check(`${tag}: the countdown ends on all three`, true);
  // the host knocks guest 1: the round goes on (two standing)
  await ev(host, `(() => { const d = window.__range.duel(); const r = [...d.remotes.values()].find((x) => x.id === 1); d.localHit(r, 200, true); })()`);
  await g1.waitForFunction("window.__range.duel().alive === false", { polling: 200, timeout: 10000 });
  await sleep(600);
  const still = await ev<string>(host, "window.__range.duel().phase");
  check(`${tag}: one down, two standing: the round goes on`, still === "fight", still);
  const g2sees = await ev<boolean>(g2, `(() => { const d = window.__range.duel(); const r = [...d.remotes.values()].find((x) => x.id === 1); return r ? !r.alive : false; })()`);
  check(`${tag}: the other guest sees player 2 down (relayed)`, g2sees);
  // then guest 2: last standing, the host takes the round on every screen
  await ev(host, `(() => { const d = window.__range.duel(); const r = [...d.remotes.values()].find((x) => x.id === 2); d.localHit(r, 200, true); })()`);
  const scored = await Promise.all(pages.map((p) => p.waitForFunction(`window.__range.duel().hud().players.find((x) => x.name === window.__range.duel().hud().players[0].name) && window.__range.duel().hud().players.reduce((a, x) => a + x.score, 0) === 1`, { polling: 200, timeout: 10000 }).then(() => true, () => false)));
  check(`${tag}: last one standing, the host takes the round on all three screens`, scored.every(Boolean), scored.join(","));
  const hostYou = await ev<number>(host, "window.__range.duel().hud().you");
  check(`${tag}: and it is the host's point`, hostYou === 1, `${hostYou}`);
  // The state packets, page by page: each guest's link to the host carried
  // the delta packets when both ends are this build with them on, and the
  // full ones otherwise; nothing was refused and nobody was sent a delta
  // packet it had not asked for.
  const wants = [0, 1, 2].map((i) => at(i).want ?? "deltas");
  const hostNet = await ev<{ on1: boolean; on2: boolean; refused: number; unexpected: number } | null>(host, `(() => { const s = window.__range.duel()?.sync; return s ? { on1: s.speaksDeltas(1), on2: s.speaksDeltas(2), refused: s.stats.refused, unexpected: s.stats.unexpected } : null; })()`);
  const g1Net = await ev<NetSeen | null>(g1, NET_PROBE(0));
  const g2Net = await ev<NetSeen | null>(g2, NET_PROBE(0));
  const hostOk = !hostNet ? wants[0] === "full" : hostNet.on1 === (wants[1] === "deltas") && hostNet.on2 === (wants[2] === "deltas") && hostNet.refused === 0 && hostNet.unexpected === 0;
  check(`${tag}: the state packets went in the form each guest reads (${wants.slice(1).join(", ")})`, hostOk && netAsWanted(g1Net, wants[1]) && netAsWanted(g2Net, wants[2]), JSON.stringify({ hostNet, g1Net, g2Net }));
  // A guest cannot speak for another: guest 1 sends a goodbye that says it
  // is from guest 2, and the host must not drop guest 2. (Only a host of this
  // build: an older one still believes a guest's own "from".)
  if (!at(0).base) {
    await ev(g1, `window.__range.duel().links.get(0)?.send({ t: "bye", from: 2 })`);
    await sleep(800);
    const kept = await ev<number>(host, "window.__range.duel() ? window.__range.duel().avatars.length : -1");
    check(`${tag}: a guest cannot forge another's goodbye: the host keeps both`, kept === 2, `${kept} figures on the host`);
  }
  // a guest leaves: the match carries on as a 1v1 for the other two
  await ev(g1, "window.__range.duel().leave()");
  await host.waitForFunction("window.__range.duel() !== null && window.__range.duel().avatars.length === 1", { polling: 200, timeout: 10000 }).then(() => true, () => false);
  const left = await ev<number>(host, "window.__range.duel() ? window.__range.duel().avatars.length : -1");
  check(`${tag}: a guest leaving drops to a 1v1 for the other two`, left === 1, `${left} figures left on the host`);
  await ev(host, "window.__range.duel().leave()");
  await g2.waitForFunction("window.__range.duel() === null", { polling: 200, timeout: 10000 });
  check(`${tag}: the host leaving ends it for the rest`, true);
  await closeAll();
}

/**
 * The tiers play differently (src/config/bots.json): an elite bot hears a shot
 * out of its sight, crouches in
 * the fight, dodges when hit; low, it breaks line of sight to heal.
 */
async function botTiersTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  // What an earlier section left in this browser's storage: these checks fail in a full batch and pass
  // alone, the same way each time (docs/TEST_AUDIT.md), which is state carried over, not chance. Said with
  // a failure, so the next one names it.
  const carried = await ev<Record<string, string>>(page, "Object.fromEntries(Object.keys(localStorage).filter((k) => !/profile|progress|xp|stats|board|history|recap/i.test(k)).map((k) => [k, String(localStorage.getItem(k)).slice(0, 60)]))");
  const where = () => ev<unknown>(page, "(() => { const d = window.__range.duel(); return { arena: d && 'arenaId' in d ? d.arenaId : null, camera: localStorage.getItem('range.camera') }; })()");
  await ev(page, `document.getElementById("overlay").classList.add("hidden")`);
  await ev(page, `(() => { document.getElementById("botCount").value = "1"; document.getElementById("botDifficulty").value = "elite"; window.__range.startBots(); })()`);
  await page.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 15000 });
  const tier = await ev<string>(page, "window.__range.duel().bots[0].diff.name");
  check("tiers: the elite select makes an elite bot", tier === "elite", tier);
  // you cannot be hurt here; the hits are written down instead
  await ev(page, `(() => { const d = window.__range.duel(); window.__hits = []; d.takeHit = (amount, from, weapon) => { window.__hits.push(weapon); }; })()`);
  // hearing: out of its sight, your shot brings it to look (elite hears every one in earshot)
  await ev(page, `(() => { const d = window.__range.duel(); const b = d.bots[0]; b.sees = () => false; const p = window.__range.player.pos; d.localShot(p.clone().setY(p.y + 1.5), new window.__range.THREE.Vector3(0, 0, -1), "r97"); })()`);
  const heard = await ev<boolean>(page, "!!window.__range.duel().bots[0].heard");
  check("tiers: out of its sight, an elite bot hears your shot and goes to look", heard);
  await ev(page, `delete window.__range.duel().bots[0].sees`);
  // it crouches now and then in the fight (close in, where nothing low stands between you), and dodges when hit
  // in front of it: a bot that has wandered off with its back to you does not see you (its view cone), which is the point
  // (open ground in front that it also sees: the first open spot 12 m ahead had a box between, 2026-10-01, and the
  // bot facing you 20 degrees off never saw you; the turns and distances tried after it are near the same)
  await ev(page, `(() => { const r = window.__range; const b = r.duel().bots[0]; b.diff = { ...b.diff, keep: 6 }; const y = b.dummy.group.rotation.y; const V = r.THREE.Vector3;
    let first = null;
    for (const d of [12, 10, 14, 8]) for (const t of [0, 0.25, -0.25, 0.5, -0.5]) {
      const s = r.openGround(b.pos.x + Math.sin(y + t) * d, b.pos.z + Math.cos(y + t) * d, 1.5); if (!s) continue; first = first || s;
      if (b.sees(new V(s.x, b.pos.y, s.z))) { r.player.teleport(s.x, 0, s.z, 0); return; }
    }
    if (first) r.player.teleport(first.x, 0, first.z, 0); })()`);
  const crouched = await page.waitForFunction("window.__range.duel().bots[0].crouching", { polling: 50, timeout: 12000 }).then(() => true, () => false);
  check("tiers: the elite bot crouches while it fires", crouched, crouched ? "" : JSON.stringify({ ...(await ev<object>(page, `(() => { const b = window.__range.duel().bots[0]; const p = window.__range.player.pos; const y = b.dummy.group.rotation.y; const dx = p.x - b.pos.x, dz = p.z - b.pos.z; return { sees: b.sees(p), seenAgo: b.lastSeen ? +(performance.now() / 1000 - b.lastSeen.at).toFixed(1) : null, facingDeg: Math.round(Math.acos(Math.max(-1, Math.min(1, (Math.sin(y) * dx + Math.cos(y) * dz) / Math.hypot(dx, dz)))) * 180 / Math.PI), d: +Math.hypot(dx, dz).toFixed(1), healing: !!b.healing, cover: !!b.cover }; })()`)), where: await where(), carried }));
  const dodge = await ev<boolean>(page, `(() => { const b = window.__range.duel().bots[0]; const before = b.strafeSign; b.dummy.hit(0, "body", 5, 1, 1, b.pos.clone().setY(1.2)); return new Promise((r) => setTimeout(() => r(b.strafeSign !== before), 400)); })()`);
  check("tiers: hit, it reverses its strafe (hard and elite always dodge)", dodge);
  // low: it finds cover out of your sight and heals there
  await ev(page, `(() => { const b = window.__range.duel().bots[0]; b.diff = { ...b.diff, keep: 6 }; b.dummy.shield = 0; b.dummy.health = 30; })()`);
  const covered = await page.waitForFunction("!!window.__range.duel().bots[0].cover", { polling: 100, timeout: 6000 }).then(() => true, () => false);
  check("tiers: low, it picks a spot out of your sight", covered, covered ? "" : JSON.stringify({ where: await where(), carried }));
  const healed = await page.waitForFunction("(() => { const b = window.__range.duel().bots[0]; return b.dummy.health + b.dummy.shield > 30 || !!b.healing; })()", { polling: 100, timeout: 12000 }).then(() => true, () => false);
  const hidden = await ev<boolean>(page, "(() => { const b = window.__range.duel().bots[0]; return !b.sees(window.__range.player.pos); })()");
  check("tiers: and heals there, out of your sight", healed && hidden, JSON.stringify({ healed, hidden }));
  await ev(page, "window.__range.duel().leave()");
  // an easy bot does none of it
  await ev(page, `(() => { document.getElementById("botDifficulty").value = "easy"; window.__range.startBots(); })()`);
  await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 15000 });
  const easy = await ev<{ name: string; cover: boolean; dodge: number }>(page, "(() => { const b = window.__range.duel().bots[0]; return { name: b.diff.name, cover: b.diff.cover, dodge: b.diff.dodge }; })()");
  check("tiers: an easy bot takes no cover and never dodges", easy.name === "easy" && !easy.cover && easy.dodge === 0, JSON.stringify(easy));
  await ev(page, "window.__range.duel().leave()");
  await ev(page, `document.getElementById("botDifficulty").value = "normal"`);
  await page.close();
}

/** one page against a bot: it comes for you, shoots, and can be knocked */
async function botsTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  await ev(page, `document.getElementById("overlay").classList.add("hidden")`);
  await ev(page, `(() => { document.getElementById("botCount").value = "1"; document.getElementById("botDifficulty").value = "hard"; window.__range.startBots(); })()`);
  const d0 = await ev<{ kind: string; players: number; n: number } | null>(page, "window.__range.duel() ? { kind: window.__range.duel().kind, players: window.__range.duel().players, n: window.__range.duel().avatars.length } : null");
  check("bots: a bot match starts with one bot", d0 !== null && d0.kind === "bots" && d0.players === 2 && d0.n === 1, JSON.stringify(d0));
  // an enemy's plate: nothing until you have hurt them, then only in your line of sight
  await page.waitForFunction("window.__range.duel()?.phase === 'fight'", { polling: 100, timeout: 20000 }).catch(() => undefined);
  await sleep(300);
  const noPlate = await ev<number>(page, "window.__range.platesNow().length");
  check("plates: an enemy you have not hurt has no name or bars over them", noPlate === 0, `${noPlate} plates`);
  const plate = await ev<{ shown: number; clear: boolean }>(
    page,
    `(() => { const r = window.__range; const d = r.duel(); const b = d.bots[0]; r.hitThrough(b.remote.id, 5); return new Promise((res) => setTimeout(() => {
      const a = d.avatars[0]; const chest = a.hitMeshes.find((m) => m.userData.zone === "body").getWorldPosition(new r.THREE.Vector3());
      res({ shown: r.platesNow().length, clear: r.clearTo(chest) }); }, 250)); })()`
  );
  check("plates: once hurt, the bot's plate shows exactly when your eye has a clear line to it", (plate.shown === 1) === plate.clear, JSON.stringify(plate));
  // the mannequin's upper body holds still on a held pose: it used to spin
  // without end (three's mixer skips a bone whose clip value has not changed,
  // so every frame's turn piled onto the last). Force a still pose with a
  // steep look and watch the chest's and head's yaw against the figure's.
  // (Its model loads after the match starts: on a machine at 100% it had not come when this looked, 2026-10-01, and
  // the check failed for want of a mannequin, three runs of four. It waits for it now, 30 s at most.)
  await page.waitForFunction(`!!window.__range.duel().avatars[0]?.group.getObjectByName("spine_03")`, { polling: 250, timeout: 30000 }).catch(() => undefined);
  const spin = await ev<{ mannequin: boolean; chest: number; head: number; pelvis: number } | null>(
    page,
    `(() => new Promise((res) => {
      const r = window.__range; const T = r.THREE; const d = r.duel(); const a = d.avatars[0];
      if (!a.group.getObjectByName("spine_03")) return res(null);
      // no shots: a recoil kick and a flinch are meant to move the chest and head
      const heldFire = d.holdFire; d.holdFire = true;
      const orig = a.setPose.bind(a);
      a.setPose = (p) => orig({ ...p, moveDir: 0.6, speed: 0, stance: "stand", pitch: 40, ads: 1, act: null });
      const q = new T.Quaternion();
      const yawOf = (o) => { o.getWorldQuaternion(q); const f = new T.Vector3(0, 0, 1).applyQuaternion(q); return Math.atan2(f.x, f.z) * 180 / Math.PI; };
      const rows = [];
      const t = setInterval(() => {
        a.group.updateMatrixWorld(true);
        const gy = a.group.rotation.y * 180 / Math.PI;
        rows.push({ chest: yawOf(a.group.getObjectByName("spine_03")) - gy, head: yawOf(a.group.getObjectByName("Head")) - gy, pelvis: yawOf(a.group.getObjectByName("pelvis")) - gy });
        if (rows.length >= 20) {
          clearInterval(t);
          a.setPose = orig;
          d.holdFire = heldFire;
          const range = (k) => { const x0 = rows[0][k]; const xs = rows.map((w) => ((w[k] - x0 + 540) % 360) - 180); return Math.max(...xs) - Math.min(...xs); };
          res({ mannequin: true, chest: range("chest"), head: range("head"), pelvis: range("pelvis") });
        }
      }, 60);
    }))()`
  );
  // the pelvis is left out: standing still, the feet stay planted as the bot turns its aim, then step round (by design)
  // 30 degrees: a hunting bot turns its aim and the clip moves the spine a
  // little; an accumulating spine went round 280 degrees in a second and a half
  if (spin) check("figures: a still mannequin's chest and head hold their yaw on the aim (no endless upper-body spin)", spin.chest < 30 && spin.head < 30, `over 1.2 s the chest moved ${spin.chest.toFixed(1)} deg, the head ${spin.head.toFixed(1)} (the planted pelvis ${spin.pelvis.toFixed(1)})`);
  else check("figures: the bot is a mannequin (the spin check needs one)", false, "no spine_03 bone on the figure");
  await page.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 15000 });
  // the bot hunts you down the middle lane and shoots: the shield drops. From the inside of the lane wall at x 94, which
  // ends in the 1.4 m box of the mantle chain with its step crate 0.2 m off: a bot that came in there walked into the
  // box for the whole match, its detour back up the lane leading it straight back in (2026-10-01, three runs of five).
  // Now each detour from the same pocket is twice the last (bots.json wedge), out in about 19 s of the game's time:
  // waited for on the game's clock, 35 s of it, as the recap's below (a loaded machine runs it at a third of real time)
  await ev(page, "(() => { const b = window.__range.duel().bots[0]; b.pos.set(94.6, 0, -24); })()");
  const shot = await ev<boolean>(
    page,
    `new Promise((ok) => { const R = window.__range; const g0 = R.gameTime(); const t0 = performance.now();
      const step = () => { if (R.duel().shield < 75) return ok(true); if (R.gameTime() - g0 > 35 || performance.now() - t0 > 150000) return ok(false); setTimeout(step, 100); };
      step(); })`,
  );
  const pos = await ev<{ x: number; z: number; sh: number }>(page, "(() => { const b = window.__range.duel().avatars[0].group.position; return { x: b.x, z: b.z, sh: window.__range.duel().shield }; })()");
  check("bots: the bot closes in and lands a shot, from the lane at x 94 that ends in a box", shot, `bot at ${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}, your shield ${pos.sh}` + (shot ? "" : " " + JSON.stringify(await ev(page, `(() => { const d = window.__range.duel(); const b = d.bots[0]; const pl = window.__range.player.pos; return { y: b.pos.y, you: [pl.x.toFixed(1), pl.z.toFixed(1)], sees: b.sees(pl), crouch: b.crouching, cover: !!b.cover, heard: !!b.heard, seen: b.lastSeen && [b.lastSeen.pos.x.toFixed(1), b.lastSeen.pos.z.toFixed(1)], slideDir: b.slideDir, joltLeft: b.joltLeft, healing: !!b.healing }; })()`))));
  check("bots: it moved off its spawn toward you", pos.z < -12, `z ${pos.z.toFixed(1)}`);
  const snd = await ev<{ played: number; voices: number }>(page, "({ played: window.__range.audio.played, voices: window.__range.audio.voiceCount })");
  check("sound: the fight is heard (its shots and footsteps), under the voice cap", snd.played > 5 && snd.voices <= 56, JSON.stringify(snd));
  // the recorded CC0 samples (npm run sounds) load and are layered in (a checkout without them is the synthesis alone)
  const rec = await ev<{ loaded: number; played: number; files: boolean }>(page, "(async () => { const a = window.__range.audio; a.land(1, 'concrete'); a.punch(null); return { loaded: a.sampleCount, played: a.samplesPlayed, files: (await fetch('audio/kenney/index.json')).ok }; })()");
  // no pass for a missing file: a release without `npm run sounds` would ship the synthesis (docs/TEST_AUDIT.md)
  check("sound: the recorded samples are loaded and layered into the fight's sounds", rec.files && rec.loaded >= 10 && rec.played > 0, JSON.stringify(rec));
  // recorded gunshots (npm run guns): every class has near and far takes, and a shot plays one
  const guns = await ev<{ files: boolean; classes: string[]; missing: string[]; before: number; after: number }>(page, `(async () => { const a = window.__range.audio; const files = (await fetch("audio/guns/index.json")).ok; const classes = ["pistol", "smg", "rifle", "lmg", "marksman", "sniper", "shotgun"]; const missing = classes.flatMap((c) => [\`shot_\${c}\`, \`shot_\${c}_far\`]).filter((n) => !a.samples.has(n)); const before = a.samplesPlayed; a.gun("rspn101"); return { files, classes, missing, before, after: a.samplesPlayed }; })()`);
  check("sound: every gun class has recorded shots near and far, and a shot plays one", guns.files && guns.missing.length === 0 && guns.after > guns.before, JSON.stringify({ files: guns.files, missing: guns.missing, played: guns.after - guns.before }));
  // knock it: a hit through its dummy, then the match is told
  await ev(page, `(() => { const d = window.__range.duel(); const a = d.avatars[0]; const pt = { clone() { return this; } }; a.hit(0, "body", 500, 1, 1, pt); d.localHit(d.remoteOf(a), 500, false); })()`);
  const won = await page.waitForFunction("window.__range.duel().hud().you === 1", { polling: 200, timeout: 5000 }).then(() => true, () => false);
  check("bots: knocking the bot takes the round", won);
  // the bot's gun leaves its hands: a copy on the floor (it has had time to land), none in its hands
  await sleep(900);
  const botGun = await ev<{ holding: boolean; dropped: boolean; y: number; floor: number }>(page, "(() => { const a = window.__range.duel().avatars[0]; const g = a.droppedGun; return { holding: a.holdingGun, dropped: !!g && !!g.parent, y: g ? g.position.y : -1, floor: a.group.position.y }; })()");
  check("bots: knocked out, the bot drops its gun (on the floor, not in its hands)", !botGun.holding && botGun.dropped && botGun.y < botGun.floor + 0.3, JSON.stringify(botGun));
  const bfeed = await ev<string[]>(page, "window.__range.hud.feedText");
  check("bots: the kill feed has the knock", bfeed.some((t) => /knocked BOT/.test(t)), bfeed[0] ?? "-");
  await ev(page, "window.__range.duel().leave()");
  const gone = await ev<boolean>(page, "window.__range.duel() === null");
  check("bots: leaving ends the match", gone);

  // eliminated by the bot: the killcam from its eyes, then the recap with both sides
  await ev(page, `(() => { document.getElementById("botCount").value = "1"; document.getElementById("botDifficulty").value = "hard"; window.__range.startBots(); })()`);
  await page.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 15000 });
  // your two hits on it first (a head and a body, 12 m), then almost nothing left for its next round to take.
  // It keeps no heals: a hard bot that heals behind cover is back at full by the kill, and the recap below
  // reads what it really has left, so the check would be measuring the heal rather than your damage.
  await ev(page, "(() => { const b = window.__range.duel().bots[0]; b.kit.cell = 0; b.kit.syringe = 0; b.healing = null; })()");
  await ev(page, "window.__range.landHit(1, 20, true, 'r97', 12)");
  await ev(page, "window.__range.landHit(1, 15, false, 'r97', 12)");
  await ev(page, "(() => { const d = window.__range.duel(); d.shield = 0; d.health = 3; })()");
  // you where the bot sees you, clear of every box: these checks are about what an elimination leaves, not the way
  // to you. In the warehouse a bot that came in by the lane at x 94 walked into the box at its end for the whole match
  // (a wall on one side, a crate 0.2 m off the other; 2026-10-01, three runs of three), the legacy game's routing,
  // which is not this check's
  const inSight = await ev<number[] | null>(
    page,
    `(() => { const R = window.__range; const b = R.duel().bots[0]; const V = R.THREE.Vector3;
      const boxed = (x, z) => R.solids.some((s) => s.base < 1.8 && s.top > 0.3 && x > s.minX - 0.6 && x < s.maxX + 0.6 && z > s.minZ - 0.6 && z < s.maxZ + 0.6);
      for (const r of [8, 12, 6, 16]) for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2; const p = new V(b.pos.x + Math.cos(a) * r, b.pos.y, b.pos.z + Math.sin(a) * r);
        if (boxed(p.x, p.z) || !b.sees(p)) continue;
        R.player.teleport(p.x, p.y, p.z, 0, 0); return [+p.x.toFixed(1), +p.z.toFixed(1)];
      }
      return null; })()`,
  );
  if (!inSight) console.log("  --  recap: no spot in the bot's sight; you wait where you stand");
  // 25 s of the game's own time (110 s of real time at the most): 30 s of real time was 10 s of the game on a loaded
  // machine, the bot still 40 m off at the arena's middle (it failed twice in the sweep on 2026-09-30, and passed alone)
  const out = await ev<boolean>(
    page,
    `new Promise((ok) => { const R = window.__range; const g0 = R.gameTime(); const t0 = performance.now();
      const step = () => { const d = R.duel(); if (d && !d.alive) return ok(true); if (R.gameTime() - g0 > 25 || performance.now() - t0 > 110000) return ok(false); setTimeout(step, 100); };
      step(); })`,
  );
  check("recap: the bot eliminates you", out, out ? "" : JSON.stringify(await ev(page, `(() => { const d = window.__range.duel(); const b = d.bots[0]; const pl = window.__range.player.pos; return { phase: d.phase, alive: d.alive, hp: d.health, bot: [b.pos.x.toFixed(1), b.pos.y.toFixed(1), b.pos.z.toFixed(1)], you: [pl.x.toFixed(1), pl.y.toFixed(1), pl.z.toFixed(1)], sees: b.sees(pl), crouch: b.crouching, cover: !!b.cover, heard: !!b.heard, seen: !!b.lastSeen, knocked: b.dummy.knocked, joltLeft: b.joltLeft, dropping: b.dropping }; })()`)));
  const kc = await ev<{ active: boolean; killer: string; weapon: string; frames: number; span: number }>(page, "window.__range.killcamState()");
  check("killcam: it starts, from the bot's eyes, with its gun", kc.active && kc.killer === "BOT ASH" && kc.weapon === "rspn101", JSON.stringify(kc));
  const kcView = await ev<{ gun: boolean; hands: boolean }>(page, "window.__range.vmState()");
  check("killcam: the killer's gun is in view (not your empty hands)", kcView.gun, JSON.stringify(kcView));
  // The killer was aiming when they killed you, so the replay holds the gun
  // aimed. Sampled ACROSS the replay, not at its first frame: it starts four
  // seconds before the kill, where the bot has often not seen you yet.
  const kcAds = await ev<{ killer: number; gun: number }>(
    page,
    `(() => new Promise((res) => {
      let killer = 0;
      let gun = 0;
      let n = 0;
      const t = setInterval(() => {
        killer = Math.max(killer, window.__range.killcamAds());
        gun = Math.max(gun, window.__range.vmState().ads);
        if (++n >= 14) { clearInterval(t); res({ killer, gun }); }
      }, 120);
    }))()`
  );
  check("killcam: it scopes in as your killer did, not from the hip", kcAds.killer > 0.5 && kcAds.gun > 0.4, `the killer's aim reached ${kcAds.killer.toFixed(2)}, the gun in view ${kcAds.gun.toFixed(2)}`);
  check("killcam: the recording holds seconds of the match", kc.frames > 60 && kc.span > 2, JSON.stringify(kc));
  await sleep(1500);
  const mid = await ev<{ active: boolean; progress: number }>(page, "window.__range.killcamState()");
  check("killcam: it plays on", mid.active && mid.progress > 0.2, JSON.stringify(mid));
  await ev(page, "window.__range.skipKillcam()");
  const rc = await ev<{ killerName: string; rows: Array<{ name: string; killer: boolean; dealt: { damage: number; hits: number; heads: number }; taken: { damage: number; hits: number }; guns: Array<{ name: string; near: number | null }>; left: { shield: number; health: number } | null }> } | null>(page, "window.__range.recap()");
  const row = rc?.rows[0];
  check("recap: eliminated by the bot, the killer first", rc?.killerName === "BOT ASH" && row?.killer === true, JSON.stringify(rc?.killerName));
  check("recap: your side: 35 in 2 hits, 1 head", row?.dealt.damage === 35 && row.dealt.hits === 2 && row.dealt.heads === 1, JSON.stringify(row?.dealt));
  check("recap: its side: the damage and hits it landed", !!row && row.taken.damage > 0 && row.taken.hits > 0, JSON.stringify(row?.taken));
  check("recap: its gun and the distance", !!row && row.guns.length > 0 && /R-301|CARBINE/i.test(row.guns[0].name) && (row.guns[0].near ?? 0) > 1, JSON.stringify(row?.guns));
  check("recap: what it had left (75 + 100 less your 35)", !!row?.left && row.left.shield + row.left.health === 140, JSON.stringify(row?.left));
  await ev(page, "window.__range.closeRecap()");
  // the bot heals when it has had nobody to shoot for a while: your next life's recap would say so

  check("recap: it closes", (await ev<unknown>(page, "window.__range.recap()")) === null);
  await ev(page, "window.__range.duel().leave()");
  await page.close();
}

/**
 * Where you are being shot from: a hit from a bot draws a red arc round the
 * crosshair pointing at it, and the arc keeps pointing at the bot when you
 * turn, because it is anchored to where the shooter stood and not to where
 * it was on screen.
 */
async function damageDirTest(browser: Browser, query: string): Promise<void> {
  const page = await startModePage(browser, query, "goBots", `document.getElementById("botCount").value = "1"`);
  // The bot holds its fire: the arcs checked here are the test's own hits,
  // and a live bot's shot would add one of its own.
  await ev(page, "window.__range.duel().holdFire = true");
  await sleep(800);
  // the bot 10 m straight to your right, and a hit from it
  const right = await ev<{ angle: number | null }>(
    page,
    `(async () => {
      const R = window.__range; const d = R.duel(); const b = d.bots[0];
      R.player.yaw = 0;
      const p = R.player.pos;
      b.pos.set(p.x + 10, p.y, p.z);
      // the arc is drawn from the shooter's figure, which a bot moves to its
      // position on its next frame: move it now, as a frame would have
      b.dummy.group.position.copy(b.pos);
      d.takeHit(1, b, "r97", 10);
      await new Promise((r) => setTimeout(r, 400));
      const dirs = R.hud.last?.damageDirs ?? [];
      return { angle: dirs.length ? dirs[0].angle : null };
    })()`
  );
  check("hit feedback: a hit from your right draws an arc on the right of the crosshair", right.angle !== null && Math.abs(right.angle - Math.PI / 2) < 0.35, JSON.stringify(right));
  // turn to face the bot: the same arc swings round to straight ahead
  const turned = await ev<{ angle: number | null }>(
    page,
    `(async () => { const R = window.__range; R.player.yaw = -90; await new Promise((r) => setTimeout(r, 300)); const dirs = R.hud.last?.damageDirs ?? []; return { angle: dirs.length ? dirs[0].angle : null }; })()`
  );
  check("hit feedback: turn to face the shooter and the arc swings to straight ahead", turned.angle !== null && Math.abs(turned.angle) < 0.35, JSON.stringify(turned));
  // the bot is live and would shoot again, drawing a fresh arc: put it far
  // out of its own sight range before waiting for the old one to fade
  await ev(page, "(() => { const R = window.__range; const b = R.duel().bots[0]; const p = R.player.pos; b.pos.set(p.x + 400, p.y, p.z + 400); })()");
  await sleep(2200);
  const gone = await ev<number>(page, "(window.__range.hud.last?.damageDirs ?? []).length");
  check("hit feedback: and it fades out on its own", gone === 0, `${gone} arcs left`);
  // The match summary: the real match-end path (main.ts's onMatchEnd) puts a
  // card up with the result, the numbers and the XP, and the level bar runs.
  const card = await ev<{ title: string; xp: number; rows: number; bar: number } | null>(
    page,
    `(async () => {
      const R = window.__range; const d = R.duel();
      d.phase = "matchEnd";
      d.onMatchEnd({ won: true, roundsWon: 3, roundsLost: 1, kills: 5, deaths: 1, damage: 710, shots: 50, hits: 26 });
      await new Promise((r) => setTimeout(r, 2200));
      const m = R.hud.last?.summary;
      return m ? { title: m.title, xp: m.xp, rows: m.rows.length, bar: m.bar } : null;
    })()`
  );
  check("summary: a won match ends on a VICTORY card with the numbers and the XP it paid", !!card && card.title === "VICTORY" && card.xp > 0 && card.rows >= 4, JSON.stringify(card));
  await ev(page, "window.__range.duel().leave()");
  await page.close();
}

/** a fake controller on a page (if it has none) and a button held or let go */
const padSet = (i: number, on: boolean) =>
  `(() => {
    if (!window.__pad) {
      const btn = () => ({ pressed: false, touched: false, value: 0 });
      const pad = { index: 0, id: "fake pad", connected: true, mapping: "standard", timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn) };
      window.__pad = pad;
      navigator.getGamepads = () => [pad];
    }
    window.__pad.buttons[${i}].pressed = ${on};
    window.__pad.buttons[${i}].value = ${on ? 1 : 0};
  })()`;
const padTap = async (page: Page, i: number, ms = 120): Promise<void> => {
  await ev(page, padSet(i, true));
  await sleep(ms);
  await ev(page, padSet(i, false));
  await sleep(120);
};

/**
 * The finishing touches: toggle ADS and crouch, per-optic ADS, the
 * controller's buttons and advanced look, weapon inspect and the first-draw
 * flourish, and the guided tour from its first step to its last.
 */
async function finishTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  await pressPlay(page);
  // ---- toggle ADS: one press in, it stays in after the button is let go, the next press out
  await ev(page, `(() => { const s = document.getElementById("adsMode"); s.value = "toggle"; s.dispatchEvent(new Event("change")); })()`);
  await padTap(page, 6);
  await sleep(500);
  const aimed = await ev<number>(page, "window.__range.loadout.active.state.adsFrac");
  await padTap(page, 6);
  await sleep(500);
  const out = await ev<number>(page, "window.__range.loadout.active.state.adsFrac");
  check("toggle ADS: a press aims and it stays aimed; the next press comes out", aimed > 0.9 && out < 0.1, `${aimed.toFixed(2)} then ${out.toFixed(2)}`);
  await ev(page, `(() => { const s = document.getElementById("adsMode"); s.value = "hold"; s.dispatchEvent(new Event("change")); })()`);
  // ---- toggle crouch: a press crouches, it stays; a jump stands you up
  await ev(page, `(() => { const s = document.getElementById("crouchMode"); s.value = "toggle"; s.dispatchEvent(new Event("change")); window.__range.player.teleport(0, 0, 0, 0); })()`);
  await padTap(page, 1);
  await sleep(400);
  const down = await ev<boolean>(page, "window.__range.player.crouched");
  await padTap(page, 0);
  await sleep(500);
  const up = await ev<boolean>(page, "window.__range.player.crouched");
  check("toggle crouch: a press crouches and it holds; a jump stands you up", down && !up, `${down} then ${up}`);
  await ev(page, `(() => { const s = document.getElementById("crouchMode"); s.value = "hold"; s.dispatchEvent(new Event("change")); })()`);
  // ---- per-optic ADS: the 3x's multiplier applies with a 3x on
  await ev(page, `(() => { const i = document.getElementById("opticAds3x"); i.value = "0.5"; i.dispatchEvent(new Event("input")); const l = window.__range.loadout; l.fitAttachment(l.activeIndex, "optic", "optic_ranged_hcog"); })()`);
  await sleep(200);
  const mult = await ev<number>(page, "window.__range.opticAdsMult()");
  check("per-optic ADS: with the 3x on, its multiplier (0.5) applies", Math.abs(mult - 0.5) < 1e-9, String(mult));
  await ev(page, `(() => { const i = document.getElementById("opticAds3x"); i.value = "1"; i.dispatchEvent(new Event("input")); })()`);
  // ---- the controller's buttons: Y to reload, and it reloads
  await ev(page, `(() => { const sel = document.querySelector('select.padBind[data-button="3"]'); sel.value = "reload"; sel.dispatchEvent(new Event("change")); })()`);
  const mapped = await ev<string>(page, "window.__range.padButtons()[3]");
  await ev(page, "(() => { const s = window.__range.loadout.active.state; s.clip = 3; })()");
  await padTap(page, 3);
  await sleep(200);
  const reloading = await ev<boolean>(page, "window.__range.loadout.active.state.reloading");
  check("controller buttons: Y set to reload on the Controls tab reloads", mapped === "reload" && reloading, `${mapped}, reloading ${reloading}`);
  await ev(page, `(() => { const sel = document.querySelector('select.padBind[data-button="3"]'); sel.value = "swapWeapon"; sel.dispatchEvent(new Event("change")); })()`);
  // ---- the advanced look: switched on, the numbers kept
  await ev(page, `(() => { const s = document.getElementById("padAdvanced"); s.value = "1"; s.dispatchEvent(new Event("change")); const y = document.getElementById("pad_extraYaw"); y.value = "150"; y.dispatchEvent(new Event("change")); })()`);
  const adv = await ev<{ advanced: boolean; extraYaw: number; saved: boolean }>(page, `({ advanced: window.__range.input.pad.settings.advanced, extraYaw: window.__range.input.pad.settings.extraYaw, saved: (JSON.parse(localStorage.getItem("range.pad.v1") || "{}").extraYaw === 150) })`);
  check("advanced look: on, with the extra yaw set and remembered", adv.advanced && adv.extraYaw === 150 && adv.saved, JSON.stringify(adv));
  await ev(page, `(() => { const s = document.getElementById("padAdvanced"); s.value = "0"; s.dispatchEvent(new Event("change")); })()`);
  // ---- the stick's outer deadzone and curve strength: set, used, remembered, then put back
  await ev(page, `(() => { for (const [id, v] of [["padOuterDeadzone", "10"], ["padExponent", "2.2"]]) { const i = document.getElementById(id); i.value = v; i.dispatchEvent(new Event("change")); } })()`);
  const stick = await ev<{ outer: number; exp: number; saved: boolean }>(page, `({ outer: window.__range.input.pad.settings.outerDeadzone, exp: window.__range.input.pad.settings.exponent, saved: (() => { const p = JSON.parse(localStorage.getItem("range.pad.v1") || "{}"); return p.outerDeadzone === 0.1 && p.exponent === 2.2; })() })`);
  check("controller: the outer deadzone and curve strength are set and remembered", Math.abs(stick.outer - 0.1) < 1e-9 && stick.exp === 2.2 && stick.saved, JSON.stringify(stick));
  await ev(page, `(() => { for (const [id, v] of [["padOuterDeadzone", "2"], ["padExponent", "1.7"]]) { const i = document.getElementById(id); i.value = v; i.dispatchEvent(new Event("change")); } })()`);
  // ---- inspect: hold reload with a full magazine; firing ends it
  await sleep(2500);
  await ev(page, "(() => { const s = window.__range.loadout.active.state; s.clip = window.__range.loadout.active.weapon.clipSize; })()");
  await ev(page, padSet(2, true));
  await sleep(700);
  const inspecting = await ev<boolean>(page, "window.__range.vmState().inspecting");
  await ev(page, padSet(2, false));
  await padTap(page, 7);
  const stopped = await ev<boolean>(page, "window.__range.vmState().inspecting");
  check("inspect: holding reload with a full magazine turns the gun over; firing ends it", inspecting && !stopped, `${inspecting} then ${stopped}`);
  // ---- a gun picked up: its first time out has the flourish
  await ev(page, "(() => { const l = window.__range.loadout; l.give(l.activeIndex, 'r97'); })()");
  const flourish = await page.waitForFunction("window.__range.vmState().flourish", { polling: 50, timeout: 3000 }).then(() => true, () => false);
  check("first draw: a gun just picked up comes out with the flourish", flourish);
  await page.close();

  // ---- the guided tour, every step, from the Play tab
  const t = await open(browser, query);
  await ev(t, `document.getElementById("goTour").click(); document.getElementById("startMode").click()`);
  await pressPlay(t);
  const step = () => ev<string | null>(t, "window.__range.tour.stepId");
  check("tour: the Play tab's button starts it at MOVE", (await step()) === "move", String(await step()));
  // keys held from now on, pressed on the first frame only (a press every frame toggles a sprint on and off)
  const hold = (keys: string[]) =>
    `(() => { const K = ${JSON.stringify(keys)}; let f = 0; window.__range.setScript({ held: (a) => K.includes(a), pressedNow: (a) => K.includes(a) && f <= 1 }, () => { f++; }); })()`;
  // the same, with a press of `again` every third of a second (a jump when you reach a wall)
  const holdRepeat = (keys: string[], again: string) =>
    `(() => { const K = ${JSON.stringify(keys)}; let f = 0; window.__range.setScript({ held: (a) => K.includes(a), pressedNow: (a) => (K.includes(a) && f <= 1) || (a === ${JSON.stringify(again)} && f % 20 === 0) }, () => { f++; }); })()`;
  const ORDER = ["move", "sprint", "slide", "jump", "mantle", "climb", "superglide", "shoot", "reload", "swap", "heal"];
  // the tour moved from this step to the very next one (not merely "somewhere else")
  const stepTo = async (id: string, timeout = 6000) => {
    const next = ORDER[ORDER.indexOf(id) + 1] ?? null;
    return t.waitForFunction(`window.__range.tour.stepId === ${JSON.stringify(next)}`, { polling: 50, timeout }).then(() => true, () => false);
  };
  const tp = (x: number, z: number, yaw: number) => ev(t, `window.__range.player.teleport(${x}, 0, ${z}, ${yaw})`);
  // move: to the marker
  await tp(0, -8, 0);
  check("tour: MOVE done at the marker", await stepTo("move"));
  // sprint: run to the next marker holding sprint
  await tp(-6, -5, 0);
  await ev(t, hold(["forward", "sprint"]));
  check("tour: SPRINT done running to the marker", await stepTo("sprint", 8000), String(await step()));
  await ev(t, "window.__range.setScript(null)");
  // slide: sprint at the rail, then crouch
  await tp(0, -16, 0);
  await ev(t, hold(["forward", "sprint"]));
  await sleep(700);
  await ev(t, hold(["forward", "sprint", "crouch"]));
  check("tour: SLIDE done", await stepTo("slide"), String(await step()));
  await ev(t, "window.__range.setScript(null)");
  await sleep(300);
  // jump
  await ev(t, hold(["jump"]));
  check("tour: JUMP done", await stepTo("jump"));
  await ev(t, "window.__range.setScript(null)");
  await sleep(800);
  // mantle: at the 2.4 m ledge (x -33 to -27 at z -58), too high to jump onto: forward, a jump at the face
  await tp(-25.8, -58, 90);
  await ev(t, holdRepeat(["forward"], "jump"));
  check("tour: MANTLE done at the ledge", await stepTo("mantle", 8000), String(await step()));
  await ev(t, "window.__range.setScript(null)");
  await sleep(400);
  // climb: into the ladder's wall (x 16 to 16.5 at z -46), forward, a jump at it
  await tp(15, -46, -90);
  await ev(t, holdRepeat(["forward"], "jump"));
  check("tour: CLIMB done at the ladder", await stepTo("climb", 8000), String(await step()));
  await ev(t, "window.__range.setScript(null)");
  await sleep(1500);
  // the superglide: skipped by holding interact (the pad's X)
  await tp(25.5, -8, -90);
  // back in the game by the controller's Start if the pointer lock has gone (a background page loses it)
  await pressPlay(t);
  await sleep(300);
  await ev(t, padSet(2, true));
  const skipped = await stepTo("superglide", 4000);
  const diag = await ev(t, "({ step: window.__range.tour.stepId, playing: window.__range.input.playing, locked: window.__range.input.locked, active: window.__range.input.pad.active, interact: window.__range.input.held('interact'), skip: window.__range.hud.last?.tour?.skip })");
  await ev(t, padSet(2, false));
  check("tour: a step can be skipped by holding interact (the superglide)", skipped, JSON.stringify(diag));
  // the mantle boost's row on Settings: off by default, and the switch reaches
  // the movement (the superglide it hands you is checked in the simulator)
  {
    const row = await ev<{ there: boolean; value: string; player: boolean }>(
      t,
      `(() => { const el = document.getElementById("mantleBoost"); return { there: !!el, value: el ? el.value : "", player: window.__range.player.mantleBoost }; })()`
    );
    await ev(t, `(() => { const el = document.getElementById("mantleBoost"); el.value = "on"; el.dispatchEvent(new Event("change")); })()`);
    const on = await ev<boolean>(t, "window.__range.player.mantleBoost");
    await ev(t, `(() => { const el = document.getElementById("mantleBoost"); el.value = "off"; el.dispatchEvent(new Event("change")); })()`);
    const off = await ev<boolean>(t, "window.__range.player.mantleBoost");
    check("settings: the mantle boost is off by default and its switch reaches the movement", row.there && row.value === "off" && !row.player && on && !off, JSON.stringify({ ...row, on, off }));
  }
  // shoot: from the firing line, six metres from a dummy and facing it, a burst with the trigger
  await ev(t, "window.__range.player.teleport(0, 0, -2, 0)");
  await sleep(300);
  await ev(t, `(() => { const r = window.__range; const d = r.dummies.find((x) => x.group.visible && !x.knocked); const p = d.group.position; const from = { x: p.x, z: p.z + 6 }; const yaw = Math.atan2(-(p.x - from.x), -(p.z - from.z)) * 180 / Math.PI; r.player.teleport(from.x, 0, from.z, yaw, -5); })()`);
  await sleep(300);
  await ev(t, padSet(7, true));
  const shot = await stepTo("shoot", 3000);
  await ev(t, padSet(7, false));
  check("tour: SHOOT done with a real hit on a dummy", shot, JSON.stringify(await ev(t, "window.__range.stats()")));
  // reload, swap
  await ev(t, "(() => { window.__range.loadout.active.state.clip = 2; })()");
  await padTap(t, 2);
  check("tour: RELOAD done", await stepTo("reload"));
  await sleep(2500);
  await padTap(t, 3);
  check("tour: SWAP done", await stepTo("swap"));
  // (Y's tap goes as it comes up: let the swap finish before the heal, which a swap would cancel)
  await t.waitForFunction("!window.__range.loadout.swapping", { polling: 50, timeout: 3000 }).catch(() => undefined);
  await sleep(300);
  // heal: the tour's own shield is down; the heal key
  await ev(t, "window.__range.startHeal()");
  check("tour: HEAL done (the tour lends a shield to heal)", await stepTo("heal"), String(await step()));
  const finished = await t.waitForFunction("window.__range.tour.stepId === null && localStorage.getItem('range.tour.done') === '1'", { polling: 100, timeout: 5000 }).then(() => true, () => false);
  check("tour: and the tour is complete (remembered)", finished, String(await step()));
  await t.close();
}

/** the range's tooling: moving dummies, dummies that shoot back, the spray wall, per-gun numbers, the flick drill */
async function rangeTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  await pressPlay(page);
  const sel = (id: string, v: string) => ev(page, `(() => { const s = document.getElementById("${id}"); s.value = "${v}"; s.dispatchEvent(new Event("change")); })()`);
  const home = await ev<number[]>(page, "window.__range.dummies.filter((d) => !d.rail).map((d) => d.group.position.x)");
  await sel("dummyMode", "strafe");
  await sleep(900);
  const moved = await ev<number[]>(page, "window.__range.dummies.filter((d) => !d.rail).map((d) => d.group.position.x)");
  check("range: strafing dummies move off their marks", moved.some((x, i) => Math.abs(x - home[i]) > 0.3), moved.map((x, i) => (x - home[i]).toFixed(2)).join(","));
  await sel("dummyMode", "stand");

  // ---- the camera that moves with the body (src/config/player.json `feel`)
  // What matters is not that it leans, it is that leaning never moves the aim.
  {
    await ev(page, `(() => { const r = window.__range; r.input.locked = true; r.player.teleport(0, 0, 20, 0); })()`);
    const before = await ev<{ yaw: number; pitch: number }>(page, `(() => { const s = window.__range.feelState(); return { yaw: s.yaw, pitch: s.pitch }; })()`);
    await ev(page, `(() => { window.__lean = 0; window.__leanT = setInterval(() => { window.__lean = Math.max(window.__lean, Math.abs(window.__range.feelState().lean)); }, 25); return true; })()`);
    await page.keyboard.down("KeyW");
    await page.keyboard.down("KeyD");
    await page.keyboard.down("ShiftLeft");
    await sleep(700);
    await page.keyboard.down("ControlLeft");
    await sleep(500);
    await page.keyboard.up("ControlLeft");
    await page.keyboard.up("ShiftLeft");
    await page.keyboard.up("KeyD");
    await page.keyboard.up("KeyW");
    await sleep(900);
    const lean = await ev<{ leaned: number; yawMoved: number; pitchMoved: number; back: number }>(
      page,
      `(() => { const r = window.__range; clearInterval(window.__leanT); const s = r.feelState();
        return { leaned: window.__lean, yawMoved: Math.abs(s.yaw - ${before.yaw}), pitchMoved: Math.abs(s.pitch - ${before.pitch}), back: Math.abs(s.lean) }; })()`
    );
    check("feel: a slide leans the camera, and the lean comes back to nothing after it", lean.leaned > 0.05 && lean.back < 0.05, JSON.stringify(lean));
    check("feel: and it never moves the aim: the angles the shot uses are untouched", lean.yawMoved < 1e-9 && lean.pitchMoved < 1e-9, JSON.stringify({ yaw: lean.yawMoved, pitch: lean.pitchMoved }));
    await ev(page, `window.__range.input.locked = false`);
  }

  // shoot back: the nearest dummies fire and you have a shield in the range
  await ev(page, "window.__range.player.teleport(0, 0, 0, 0)");
  await sel("dummyShoot", "hard");
  const hurt = await page.waitForFunction("window.__range.rangeCombat.shield < 75 || window.__range.rangeCombat.health < 100", { polling: 200, timeout: 12000 }).then(() => true, () => false);
  check("range: shoot back: the dummies hit you", hurt, JSON.stringify(await ev(page, "({ sh: window.__range.rangeCombat.shield, hp: window.__range.rangeCombat.health })")));
  await sel("dummyShoot", "off");
  // the spray wall: a burst from the yellow mark lands on it
  await ev(page, "(() => { const p = window.__range.player; p.teleport(13.45, 0, -64, -90); p.pitch = 1.2; window.__range.sprayWall.clear(); })()");
  await ev(page, "window.__pad.buttons[7].pressed = true; window.__pad.buttons[7].value = 1;");
  await sleep(700);
  await ev(page, "window.__pad.buttons[7].pressed = false; window.__pad.buttons[7].value = 0;");
  await sleep(500);
  const marks = await ev<number>(page, "window.__range.sprayWall.marks");
  check("range: the spray wall takes the burst", marks >= 3, `${marks} marks`);
  const guns = await ev<Array<[string, { shots: number; hits: number }]>>(page, "window.__range.gunSession()");
  check("range: this session's numbers per gun", guns.some(([, r]) => r.shots > 0), JSON.stringify(guns));
  // the flick drill: its countdown, thirty figures, a time and a best
  await ev(page, `document.getElementById("goDrill").click()`);
  const running = await page.waitForFunction(`window.__range.drill.state === "running"`, { polling: 100, timeout: 6000 }).then(() => true, () => false);
  check("range: the flick drill counts down and starts", running);
  const pos = await ev<{ x: number; z: number }>(page, "({ x: window.__range.drill.target.group.position.x, z: window.__range.drill.target.group.position.z })");
  const dist = Math.hypot(pos.x - 3, pos.z - 2.2);
  check("range: its figure is 5 to 30 m out ahead of the pad", dist >= 4.9 && dist <= 30.1 && pos.z < 2.2, JSON.stringify(pos));
  for (let i = 0; i < 30; i++) await ev(page, "window.__range.drill.onHit(window.__range.drill.target, window.__range.gameTime())");
  const done = await ev<{ state: string; best: number | null }>(page, "({ state: window.__range.drill.state, best: window.__range.drill.best })");
  check("range: thirty down and the drill has a time and a best", done.state === "done" && (done.best ?? 0) > 0, JSON.stringify(done));
  await shotgunChecks(page);
  await aimbotChecks(page);
  // the plates' line-of-sight test, on known geometry: the backstop is at z -106.75. One line from the firing line
  // rising to 4 m, over the 1.5 m wall at z -34 and the 2.2 m block at z -78, to just short of it and just past it.
  // (It looks from the camera, which is at a teleport's spot only once a frame has put it there: it once read from
  // wherever the check before it had left you, and passed on a line that is blocked at z -34.)
  await ev(page, "window.__range.player.teleport(0, 0, 0, 0, 0)");
  await sleep(200);
  const los = await ev<{ open: boolean; wall: boolean }>(page, `(() => { const r = window.__range; const T = r.THREE; return { open: r.clearTo(new T.Vector3(0, 4, -100)), wall: r.clearTo(new T.Vector3(0, 4, -110)) }; })()`);
  check("plates: the line of sight is clear down the range and blocked through the backstop", los.open && !los.wall, JSON.stringify(los));
  await readmeTvChecks(page);
  await page.close();
}

/**
 * The bought arms on the USSO and BOOG through each thing they do (the owner, 2026-09-28: "check all frames of the reload
 * for pinpoint accuracy, and ensure the hands are the correct size and on the correct area at all times, not glitching
 * through the gun at any point"; tools/pack-frames.ts is the long form, every 4% of each): the gun fitted into the hands
 * the same on every draw, the magazine sliding out as it phases, the finger on its spot, the pack's own swap, pickup and
 * jump played, and no skin through the gun where the eye sees it go in (tools/pack-audit.js), held, pointing, the new
 * magazine in, racking, aimed, on the way out and in of a swap and taking something off the ground.
 */
/** the worst of an inspect's or a flourish's measures: a card's share over the gun, %, the deepest seen skin in it, mm, the
 * most bent wrist and most wrung forearm, degrees, and the most an arm falls short, m */
type Moves = { cards: number; deep: number; wrist: number; wrung: number; short: number };

async function packFrames(page: Page): Promise<void> {
  await ev(page, readFileSync(new URL("./pack-audit.js", import.meta.url), "utf8"));
  const RL = fparmsCfg.reload;
  type Frames = { wrists: { rest: number[]; aimed: number[]; point: number; swap: number }; pointHand: number; nanBones: string[]; fit: { vanish: number[]; muzzle: number[]; across: number; upper: number }; pitch: number; hook: number; fists: { free: boolean; twist: number[]; curl: number[]; thumb: number[] }; handover: number; palmAhead: number; fov: number; adsNear: number; centreShift: number; centreSwapped: boolean; own: { off: number; turn: number; aimed: number }; pitchWant: number; melee: { on: boolean; free: boolean; off: number; curl: number; deep: number }; tactical: { empty: { handle: number; lead: string }; tactical: { handle: number; lead: string } }; handFit: { palm: number; palmTouch: number; thumb: number; mr: number; rp: number; seen: Record<"l" | "r", { holes: number; cracks: number }> }; palm: { w: number; cards: number }; palmArm: { hand: number[]; exit: number[]; leaves: string; keys: string[] }; toss: { y0: number; y1: number; whole0: number; whole1: number; after: number }; rackCurl: number; lead: { out: number[]; into: number[] }; inspect: Moves; flourish: Moves; tilt: number[]; gripSame: number; slid: number; slidIn: number; magPhase: { radial: number[]; off: number[] }; miss: number; off: number; through: Record<string, number>; swap: { moved: number; deep: number; short: number; off: number; face: number; curl: number; radial: number }; pickLead: string; pickAfter: string; feed?: Feed; pump?: Pump; vent?: Vent };
/** an overheat's vent (CHOOCH's): its turn's weight mid-vent and at its ends, which clip leads mid-vent, the deepest seen
 * skin in the gun through it, mm, and the worst wrist, degrees */
type Vent = { mid: number; ends: number; lead: string; deep: number; wrist: number };
/** a reload a shell at a time (BIGANTLER's): through the feed, the most the hand's pinch is off the shell it holds, cm, the
 * gate's most opening at each push, radians, the deepest seen skin in the gun, mm, the most the arm falls short, cm, the
 * worst wrist, degrees, how far the last shell is from its rest once in, cm, and the most the hand or the shell moves across
 * a shell's start (a moment either side of it), cm */
type Feed = { pinch: number; gates: number[]; deep: number; short: number; wrist: number; seated: number; jump: number };
/** after a shot: the most the pump and the hand moved apart, cm, the pump's stroke, cm, the deepest seen skin, mm; and which
 * clip leads late in a reload from empty and one with a shell chambered */
type Pump = { apart: number; stroke: number; deep: number; empty: string; tactical: string };
  // (a page call a gun and one for the jump: in one call they ran past a page call's 120 s)
  const res: { guns: Record<string, Frames>; jump: string[]; inspectLen: { time: number; at44: boolean; at56: boolean; e44: number; e56: number }; meleeWorks: { swung: boolean; hurt: number; during: number; after: number; meleeing: boolean } } = { guns: {}, jump: [], inspectLen: { time: 0, at44: false, at56: true, e44: 0, e56: 0 }, meleeWorks: { swung: false, hurt: 0, during: 0, after: 0, meleeing: false } };
  // (the page's helpers once, then one short page call a measure: the e2e draws in software, a few frames a second, and
  // a call doing several draws and states ran past a page call's 120 s)
  await ev(
    page,
    `(() => {
      const r = window.__range;
      const T = r.THREE;
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const H = (window.__pf = {});
      H.gameWait = async (s) => {
        const g0 = r.gameTime();
        const t0 = performance.now();
        while (r.gameTime() - g0 < s && performance.now() - t0 < 30000) await wait(20);
      };
      H.hold = async (id) => {
        r.loadout.give(0, id);
        r.loadout.requestSwap(0, r.gameTime());
        const t0 = performance.now();
        let clearFrom = r.gameTime();
        while (r.gameTime() - clearFrom < 0.6 && performance.now() - t0 < 30000) {
          if (r.loadout.swapping || r.vmState().flourish) clearFrom = r.gameTime();
          await wait(20);
        }
      };
      // the other slot and back, as a player swaps (giving slot 0 a new gun builds it again: it never draws a gun that
      // still carries its last throw, which is the draw the middle was measured wrong on)
      H.slot = async (i) => {
        const went = r.loadout.requestSwap(i, r.gameTime());
        const t0 = performance.now();
        let clearFrom = r.gameTime();
        while (r.gameTime() - clearFrom < 0.6 && performance.now() - t0 < 30000) {
          if (r.loadout.swapping || r.vmState().flourish) clearFrom = r.gameTime();
          await wait(20);
        }
        return went;
      };
      H.clear = () => {
        r.debugView.reload = null;
        r.debugView.vent = null;
        r.debugView.raise = null;
        r.debugView.ads = null;
        r.debugView.lowered = null;
        r.packPickupAt(null);
      };
      // the magazine in its gun's own frame, in the view's metres (the gun turns over for the reload: in the world the
      // turn read as more slide than there was)
      H.magAt = () => {
        let m = null;
        r.viewModelRoot().traverse((x) => { if (x.name === "mag" && !m) m = x; });
        if (!m) return new T.Vector3();
        let root = m;
        while (root.parent && !root.userData.paid) root = root.parent;
        const k = root.getWorldScale(new T.Vector3()).x / r.packRig().group.getWorldScale(new T.Vector3()).x;
        return root.worldToLocal(m.getWorldPosition(new T.Vector3())).multiplyScalar(k);
      };
      H.fingers = () => ["thumb_01_r", "middle_01_r", "index_02_l", "pinky_03_l"].map((n) => r.packRig().group.getObjectByName(n).quaternion.clone());
      // the barrel's pitch against the view, degrees up
      H.pitch = () => {
        const root = r.viewModelRoot();
        let gun = null;
        root.traverse((x) => { if (x.userData && x.userData.paid && !gun) gun = x; });
        const m = new T.Matrix4().multiplyMatrices(new T.Matrix4().copy(root.matrixWorld).invert(), gun.matrixWorld);
        const d = new T.Vector3(0, 0, -1).transformDirection(m);
        return (Math.atan2(d.y, Math.hypot(d.x, d.z)) * 180) / Math.PI;
      };
      // the deepest skin through the gun where it is seen, the worst of three looks
      H.through = async () => {
        let worst = 0;
        for (let i = 0; i < 3; i++) {
          const a = window.__packAudit(0.004);
          worst = Math.max(worst, a ? a.seenDeepest : 0);
          await wait(120);
        }
        return worst;
      };
    })()`,
  );
  const pf = <T>(js: string) => ev<T>(page, `(async () => { const r = window.__range; const H = window.__pf; ${js} })()`);
  // the gun camera's field of view at the hip with a gun the view's own arms hold, to hold the bought arms' to (the
  // owner, 2026-09-28: "like the view angle isn't how it was originally": they had drawn at the pack's 80 degrees);
  // the first SpeedKills gun not yet in the bought arms (it had been ANAKIN, until ANAKIN went into them)
  // (E2E_GUNS=alternator_smg narrows the frames to the guns named, for a change to one gun's hold: the sweeps of every
  // move take minutes a gun; a check of one named gun is left out when that gun is, and a swap's other gun is still the
  // next in the whole list)
  const allPack = Object.keys(fparmsCfg.guns);
  const packIds = allPack.filter((id) => !E2E_GUNS.length || E2E_GUNS.includes(id));
  const has = (...ids: string[]) => ids.every((id) => packIds.includes(id));
  const plainGun = ["alternator_smg", "vinson", "mastiff", "shotgun", "lstar", "wingman"].find((id) => !allPack.includes(id)) ?? "wingman";
  const plainFov = await pf<number>(`r.debugView.inspect = -1; H.clear(); await H.hold("${plainGun}"); await H.gameWait(0.4); return r.gunFov().gun;`);
  // and the length of an inspect in the view's own arms
  const plainInspect = await pf<number>(`return r.packArms().inspectTime;`);
  // (every gun in the bought arms, fparms.json guns: a gun is added to the checks by adding it there)
  for (const id of packIds) {
    const other = allPack[(allPack.indexOf(id) + 1) % allPack.length];
    const o = { through: {} as Record<string, number> } as Frames;
    await pf(`r.debugView.inspect = -1; H.clear(); await H.hold(${JSON.stringify(id)}); window.__pf.first = H.fingers();`);
    // drawn, away, and drawn again: fitted the same (the second draw's fit had come out as no tilt), and the grip's
    // fingers the same (the clips had stopped putting still bones back, and a hold depended on the guns drawn before it)
    const t0 = await pf<number>(`return r.packRig().tilt;`);
    const c0 = await pf<number[]>(`return r.packArms().gunCentre;`);
    await pf(`await H.hold(${JSON.stringify(other)});`);
    await pf(`await H.hold(${JSON.stringify(id)});`);
    o.tilt = [t0, await pf<number>(`return r.packRig().tilt;`)];
    o.gripSame = await pf<number>(`return Math.min(...H.fingers().map((q, i) => Math.abs(q.dot(H.first[i]))));`);
    // and its middle measured the same, thrown for the other slot's gun and drawn back
    o.centreSwapped = (await pf<boolean>(`return await H.slot(1);`)) && (await pf<boolean>(`return await H.slot(0);`));
    const c1 = await pf<number[]>(`return r.packArms().gunCentre;`);
    o.centreShift = Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]);
    // the barrel's pitch at rest (the owner: "the gun is never like that" up and to the left)
    // (and what it should be: level, then turned by the gun's look, out of the bottom right corner and in toward the
    // crosshair: fparms.json packGuns look, hipLook)
    o.pitch = await pf<number>(`await H.gameWait(0.3); return H.pitch();`);
    o.pitchWant = await pf<number>(`const T = r.THREE; const L = r.packRig().hipLook; const q = new T.Quaternion().setFromEuler(new T.Euler(L.turn[0], L.turn[1], L.turn[2] ?? 0, "YXZ")).multiply(new T.Quaternion().setFromEuler(new T.Euler(${fparmsCfg.hipPitch}, 0.05, 0))); const d = new T.Vector3(0, 0, -1).applyQuaternion(q); return (Math.atan2(d.y, Math.hypot(d.x, d.z)) * 180) / Math.PI;`);
    // the rest hold at the gun's own place: where it is and how it is turned at rest, and aimed with and without the move
    // (the idle's breath held still while it measures: packRig debugStill)
    o.own = await pf<Frames["own"]>(`
      const T = r.THREE;
      r.packRig().debugStill = true;
      await H.gameWait(0.3);
      const s = r.packArms();
      // (and moved by the gun's look on top, out of the bottom right corner: fparms.json packGuns look, hipLook)
      const L = r.packRig().hipLook;
      const want = new T.Quaternion().setFromEuler(new T.Euler(L.turn[0], L.turn[1], L.turn[2] ?? 0, "YXZ")).multiply(new T.Quaternion().setFromEuler(new T.Euler(0, 0.05, 0)));
      const off = Math.hypot(...s.poseAt.map((v, i) => v - s.ownAt[i] - L.shift[i]));
      const turn = (new T.Quaternion().fromArray(s.poseTurn).angleTo(want) * 180) / Math.PI;
      r.debugView.ads = 1;
      await H.gameWait(0.35);
      const a1 = r.packArms();
      r.packRig().debugHipOwn = 0;
      await H.gameWait(0.35);
      const a0 = r.packArms();
      r.packRig().debugHipOwn = null;
      r.packRig().debugStill = false;
      H.clear();
      await H.gameWait(0.3);
      return { off, turn, aimed: Math.hypot(...a1.poseAt.map((v, i) => v - a0.poseAt[i])) + new T.Quaternion().fromArray(a1.poseTurn).angleTo(new T.Quaternion().fromArray(a0.poseTurn)) };`);
    // (the reloads below are the empty one's, the rack and all: with rounds in the magazine a reload is a tactical one, on
    // its own timeline, with no rack; fparms.json reload tactical, checked on its own further down)
    await pf(`r.loadout.active.state.clip = 0;`);
    // the wrists: at rest and aimed, pointing, and early in a swap as the pack's unequip swings the gun
    const wr = (js: string) => pf<number[]>(`${js} await H.gameWait(0.35); const s = r.packArms(); H.clear(); await H.gameWait(0.3); return [s.wristL, s.wristR];`);
    // (a gun reloaded a shell at a time has no magazine, and one that vents its heat never reloads: neither points or racks)
    const packOf = (fparmsCfg.packGuns as Record<string, { reload?: unknown; vent?: unknown }>)[(fparmsCfg.guns as Record<string, string>)[id]];
    const shells = !!packOf?.reload;
    const vents = !!packOf?.vent;
    const noMag = shells || vents;
    o.wrists = { rest: await wr(""), aimed: await wr("r.debugView.ads = 1;"), point: vents ? 0 : (await wr("r.debugView.reload = 0.28;"))[0], swap: (await wr("r.debugView.raise = 0.16;"))[0] };
    // at rest, as fitted to the other games' resting frames (fparms.json packGuns look, tools/gun-fit.ts): where the barrel's
    // line meets the screen and where the muzzle is (shares of the screen, from the left and the top), and the gun's across
    // axis on the screen, degrees off level; and how much of the left upper arm is in the picture through a melee (carried by
    // the new look, the chest it draws back to came by the eye, a sheet of sleeve across the gun: 80% of it in the picture)
    o.fit = await pf<Frames["fit"]>(`H.clear(); await H.gameWait(0.4); const T = r.THREE; const rig = r.packRig(); const root = r.viewModelRoot(); let gun = null; root.traverse((x) => { if (x.userData && x.userData.paid && !gun) gun = x; }); gun.updateWorldMatrix(true, true); const ginv = new T.Matrix4().copy(gun.matrixWorld).invert(); const lb = new T.Box3(); gun.traverse((m) => { if (m.isMesh && m.visible) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); lb.union(m.geometry.boundingBox.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(ginv, m.matrixWorld))); } }); const vinv = new T.Matrix4().copy(root.matrixWorld).invert(); const tv = Math.tan(r.gunFov().gun / 2 * Math.PI / 180); const th = tv * innerWidth / innerHeight; const toV = (q) => q.clone().applyMatrix4(gun.matrixWorld).applyMatrix4(vinv); const share = (v) => [(1 + v.x / -v.z / th) / 2, (1 - v.y / -v.z / tv) / 2]; const c = lb.getCenter(new T.Vector3()); const back = toV(new T.Vector3(c.x, c.y, lb.max.z)), front = toV(new T.Vector3(c.x, c.y, lb.min.z)); const d = front.clone().sub(back); const ax = toV(new T.Vector3(c.x + 0.1, c.y, c.z)).sub(toV(c)); let across = Math.atan2(ax.y, ax.x) * 180 / Math.PI; if (across > 90) across -= 180; if (across < -90) across += 180; const upperIn = () => { const inv = new T.Matrix4().copy(root.matrixWorld).invert(); const tv2 = Math.tan(r.gunFov().gun / 2 * Math.PI / 180); const th2 = tv2 * innerWidth / innerHeight; let n = 0, k = 0; rig.group.traverse((m) => { if (!m.isSkinnedMesh) return; const g = m.geometry; const pos = g.attributes.position; const sk = g.attributes.skinIndex, sw = g.attributes.skinWeight; const v = new T.Vector3(); for (let i = 0; i < pos.count; i += 2) { let up = 0; for (let j = 0; j < 4; j++) if (sw.getComponent(i, j) > 0.5 && /^upperarm.*_l$/.test(m.skeleton.bones[sk.getComponent(i, j)].name)) up = 1; if (!up) continue; n++; v.fromBufferAttribute(pos, i); m.applyBoneTransform(i, v); v.applyMatrix4(m.matrixWorld).applyMatrix4(inv); if (v.z < 0 && Math.abs(v.x / -v.z / th2) < 1 && Math.abs(v.y / -v.z / tv2) < 1) k++; } }); return n ? k / n : 0; }; let upper = 0; for (const u of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) { r.meleeAt(u); await H.gameWait(0.15); upper = Math.max(upper, upperIn()); } r.meleeAt(null); H.clear(); await H.gameWait(0.3); return { vanish: d.z < 0 ? share(d) : [9, 9], muzzle: share(front), across, upper };`);
    // every joint of the arms a number, held (one that is not is drawn from nowhere)
    o.nanBones = await pf<string[]>(`H.clear(); await H.gameWait(0.3); const n = []; r.packRig().group.traverse((b) => { const q = b.quaternion, p = b.position; if (![q.x, q.y, q.z, q.w, p.x, p.y, p.z].every(Number.isFinite)) n.push(b.name); }); return n;`);
    // and how high in the picture the pointing wrist is (-1 its bottom edge, the gun camera's), -9 behind the eye
    o.pointHand = await pf<number>(`r.debugView.reload = 0.28; await H.gameWait(0.35); const T = r.THREE; const root = r.viewModelRoot(); const inv = new T.Matrix4().copy(root.matrixWorld).invert(); const tanV = Math.tan(((r.gunFov().gun / 2) * Math.PI) / 180); const v = r.packRig().group.getObjectByName("hand_l").getWorldPosition(new T.Vector3()).applyMatrix4(inv); H.clear(); await H.gameWait(0.3); return v.z < 0 ? v.y / -v.z / tanV : -9;`);
    // the magazine as the old one goes (just before its phase out ends), and part way into the new one's phase in: out, and seated
    o.slid = noMag ? 0 : await pf<number>(`const rest = H.magAt(); r.debugView.reload = ${RL.phaseOut[1] - 0.005}; await H.gameWait(0.2); const d = H.magAt().distanceTo(rest); H.clear(); await H.gameWait(0.2); return d;`);
    o.slidIn = noMag ? 0 : await pf<number>(`const rest = H.magAt(); r.debugView.reload = ${RL.phaseIn[0] + (RL.phaseIn[1] - RL.phaseIn[0]) / 4}; await H.gameWait(0.2); const d = H.magAt().distanceTo(rest); H.clear(); await H.gameWait(0.2); return d;`);
    // the magazine's phase in the middle of each: out from its middle (fparms.json reload magPhase), how far the phase's
    // middle is from the magazine's own, view metres (what is drawn of it: its node also holds the old magazine, hidden,
    // which put the middle of the whole 107 mm off the USSO's)
    o.magPhase = noMag ? { radial: [], off: [] } : await pf<Frames["magPhase"]>(`const T = r.THREE; const out = { radial: [], off: [] }; for (const u of [${(RL.phaseOut[0] + RL.phaseOut[1]) / 2}, ${(RL.phaseIn[0] + RL.phaseIn[1]) / 2}]) { r.debugView.reload = u; await H.gameWait(0.2); let m = null; r.viewModelRoot().traverse((x) => { if (x.name === "mag" && !m) m = x; }); const f = r.gunFeel(); out.radial.push(f.magRadial); const seen = new T.Box3(); if (m) m.traverse((x) => { if (x.isMesh && x.visible) seen.expandByObject(x); }); out.off.push(m ? seen.getCenter(new T.Vector3()).distanceTo(new T.Vector3().fromArray(f.magCenter)) / r.packRig().group.getWorldScale(new T.Vector3()).x : 99); } H.clear(); await H.gameWait(0.2); return out;`);
    const point = noMag ? { miss: 0, off: 0 } : await pf<{ miss: number; off: number }>(`r.debugView.reload = 0.28; await H.gameWait(0.2); const s = r.packArms(); H.clear(); await H.gameWait(0.2); return { miss: Number.isFinite(s.pointMiss) ? s.pointMiss : 99, off: s.pointOff };`);
    o.miss = point.miss;
    o.off = point.off;
    // where the support hand holds the gun at rest against its magazine
    o.palmAhead = await pf<number>(`H.clear(); await H.gameWait(0.3); return r.packArms().palmAhead;`);
    o.fov = await pf<number>(`H.clear(); await H.gameWait(0.3); return r.gunFov().gun;`);
    // aimed in and firing a burst: how far the gun's nearest part in the picture stays outside the gun camera's near plane,
    // view units (below 0, cut open by it); a stock reaching back past the cheek, behind the eye, is out of the picture
    // and counts for nothing (ANAKIN's ran 19 cm behind it, nothing of it seen)
    o.adsNear = await pf<number>(`r.loadout.active.state.clip = r.loadout.active.weapon.clipSize; const T = r.THREE; const root = r.viewModelRoot(); let gun = null; root.traverse((x) => { if (x.userData && x.userData.paid && !gun) gun = x; }); const shown = (x) => { for (let q = x; q; q = q.parent) if (!q.visible) return false; return true; }; const tv = Math.tan((r.gunFov().gun / 2) * Math.PI / 180); const th = (tv * innerWidth) / innerHeight; const near = () => { const inv = new T.Matrix4().copy(root.matrixWorld).invert(); let n = Infinity; const v = new T.Vector3(); gun.traverse((x) => { if (!x.isMesh || !shown(x)) return; const m = new T.Matrix4().multiplyMatrices(inv, x.matrixWorld); const pos = x.geometry.attributes.position; for (let i = 0; i < pos.count; i += 3) { v.fromBufferAttribute(pos, i).applyMatrix4(m); if (-v.z > 0 && Math.abs(v.x / -v.z) < th && Math.abs(v.y / -v.z) < tv) n = Math.min(n, -v.z); } }); return n; }; r.debugView.ads = 1; await H.gameWait(0.4); let least = near(); r.setScript({ held: (a) => a === "ads" || a === "fire", pressedNow: () => false }); for (let k = 0; k < 10; k++) { await H.gameWait(0.1); least = Math.min(least, near()); } r.setScript(null); r.debugView.ads = null; H.clear(); await H.gameWait(0.4); r.loadout.active.state.clip = 0; return least - r.vmCameraNear() / root.getWorldScale(new T.Vector3()).x;`);
    // from the magazine seated to the grab on the handle, how near the left hand comes to its place on the gun (the
    // USSO's: it goes from the point straight to the handle)
    const grabbed = RL.rack[0] + (fparmsCfg.packGuns.MPS5.rack.grab?.reach[1] ?? 0) * (RL.rack[1] - RL.rack[0]);
    const across = Array.from({ length: 8 }, (_, i) => RL.seat + ((grabbed - RL.seat) * (i + 1)) / 8);
    o.handover = await pf<number>(`let least = Infinity; for (const u of ${JSON.stringify(across)}) { r.debugView.reload = u; await H.gameWait(0.12); least = Math.min(least, r.packArms().offHold); } H.clear(); await H.gameWait(0.3); return least;`);
    // the rack's grab: the fingertips on the handle (the USSO's pinch)
    o.hook = await pf<number>(`r.debugView.reload = 0.76; await H.gameWait(0.2); const h = r.packArms().hookMiss; H.clear(); await H.gameWait(0.3); return Number.isFinite(h) ? h : ${id === "r97" ? 99 : 0};`);
    // the hands at rest: how much of the left palm and thumb lie on the gun (mm off it of the palm's nearest tenth of skin
    // and the thumb's nearest quarter), and the right hand's last three fingertips' spacing, mm
    o.handFit = await pf<Frames["handFit"]>(`r.packRig().debugStill = true; H.clear(); await H.gameWait(0.3); const T = r.THREE; const a = window.__packAudit(0.004, false, { side: "l", gapList: true }); const pct = (xs, q) => { const s = (xs || []).slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 99; }; const g = r.packRig().group; const at = (n) => g.getObjectByName(n).getWorldPosition(new T.Vector3()); const s = g.getWorldScale(new T.Vector3()).x; const d = (p, q) => (at(p).distanceTo(at(q)) / s) * 1000; const seen = (side) => { const x = window.__packSeenGap(side); return x ? { holes: x.holes, cracks: x.cracks } : { holes: 99, cracks: 99 }; }; const out = { palm: pct(a.gapList.hand_l, 0.1), palmTouch: (a.palmGap.l ?? 1) * 1000, thumb: Math.max(pct(a.gapList.thumb_02_l, 0.25), pct(a.gapList.thumb_03_l, 0.25)), mr: d("middle_03_r", "ring_03_r"), rp: d("ring_03_r", "pinky_03_r"), seen: { l: seen("l"), r: seen("r") } }; r.packRig().debugStill = false; return out;`);
    // and the forefinger closed round it, degrees
    o.rackCurl = await pf<number>(`r.debugView.reload = 0.76; await H.gameWait(0.2); const c = r.packArms().rackCurl; H.clear(); await H.gameWait(0.3); return c;`);
    // the pointing finger against the magazine, shares of the slide: a quarter into the phase out and halfway into the in
    const outAt = RL.phaseOut[0] + (RL.phaseOut[1] - RL.phaseOut[0]) / 4;
    const inAt = (RL.phaseIn[0] + RL.phaseIn[1]) / 2;
    o.lead = noMag ? { out: [], into: [] } : await pf<Frames["lead"]>(`const at = async (u) => { r.debugView.reload = u; await H.gameWait(0.15); const s = r.packArms(); return [s.tipSlid, s.magSlid]; }; const out = await at(${outAt}); const into = await at(${inAt}); H.clear(); await H.gameWait(0.3); return { out, into };`);
    // the hands off the gun: the bought arms' fists
    o.fists = await pf<Frames["fists"]>(`r.debugView.lowered = 1; await H.gameWait(0.8); const s = r.packArms(); const f = { free: s.free, twist: [s.twistL, s.twistR], curl: [s.curlL, s.curlR], thumb: [s.thumbL, s.thumbR] }; H.clear(); await H.gameWait(0.8); return f;`);
    // an inspect: the open left palm with the hack over it
    o.palm = await pf<{ w: number; cards: number }>(`r.debugView.inspect = 0.5; await H.gameWait(0.3); const p = { w: r.packArms().palm, cards: r.packArms().palmCards }; r.debugView.inspect = -1; await H.gameWait(0.3); return p;`);
    // the open hand's wrist and elbow on the screen (-1 to 1 across and up it), and the cards' hacks with their levels
    o.palmArm = await pf<Frames["palmArm"]>(`r.sk.setHack("dash", 2); r.sk.setHack("reveal", 3); r.debugView.inspect = 0.3; await H.gameWait(0.3); const T = r.THREE; const root = r.viewModelRoot(); const inv = new T.Matrix4().copy(root.matrixWorld).invert(); const tanV = Math.tan(((r.gunFov().gun / 2) * Math.PI) / 180); const tanH = tanV * (innerWidth / innerHeight); const pos = (n) => r.packRig().group.getObjectByName(n).getWorldPosition(new T.Vector3()).applyMatrix4(inv); const scr = (v) => [v.x / -v.z / tanH, v.y / -v.z / tanV]; const h = pos("hand_l"), e = pos("lowerarm_l"); let leaves = "in", exit = scr(e); for (let i = 1; i <= 400; i++) { const v = h.clone().lerp(e, i / 400); if (v.z > -0.01) { leaves = "behind"; break; } const s = scr(v); if (s[1] < -1) { leaves = "bottom"; exit = s; break; } if (Math.abs(s[0]) > 1 || s[1] > 1) { leaves = s[1] > 1 ? "top" : s[0] < 0 ? "left" : "right"; exit = s; break; } } const out = { hand: scr(h), exit, leaves, keys: r.packArms().palmCardKeys }; r.debugView.inspect = -1; await H.gameWait(0.3); return out;`);
    // the toss: the cards before it, rising and phasing, and after it as the hand goes back
    o.toss = await pf<Frames["toss"]>(`const at = async (u) => { r.debugView.inspect = u; await H.gameWait(0.15); return r.packArms(); }; const a = await at(0.72); const b = await at(0.85); const c = await at(0.93); r.debugView.inspect = -1; await H.gameWait(0.3); return { y0: a.palmCardY, y1: b.palmCardY, whole0: a.palmWhole, whole1: b.palmWhole, after: c.palmCards };`);
    // an inspect and a first draw's flourish all the way through: the worst of each measure at each moment
    const moves = (knob: string, cards: boolean) =>
      pf<Moves>(`const w = { cards: 0, deep: 0, wrist: 0, wrung: 0, short: 0 }; for (const u of [0.04, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.96]) { r.debugView.${knob} = u; await H.gameWait(0.12); const s = r.packArms(); const a = window.__packAudit(0.004); ${cards ? "w.cards = Math.max(w.cards, ...window.__cardOverGun());" : ""} w.deep = Math.max(w.deep, a.seenDeepest * 1000); w.wrist = Math.max(w.wrist, s.wristL, s.wristR); w.wrung = Math.max(w.wrung, s.skinL, s.skinR); w.short = Math.max(w.short, s.reachShort, s.reachShortR); } r.debugView.${knob} = -1; await H.gameWait(0.3); return w;`);
    o.inspect = await moves("inspect", true);
    o.flourish = await moves("flourish", false);
    // no skin through the gun where it is seen, in each state
    const states: Array<[string, string]> = [
      ["held", ""],
      ...((vents
        ? [["venting", "r.debugView.vent = 0.5;"]]
        : [
            ["pointing", "r.debugView.reload = 0.28;"],
            ["new magazine in", "r.debugView.reload = 0.46;"],
            // (from empty, so it is the rack: the clip left by the checks before had made it a tactical reload on one run and
            // an empty one on the next)
            ["racking", "r.loadout.active.state.clip = 0; r.debugView.reload = 0.78;"],
          ]) as Array<[string, string]>),
      ["swap out", "r.debugView.raise = 0.12;"],
      ["swap in", "r.debugView.raise = 0.88;"],
      ["pickup", "r.packPickupAt(0.6);"],
      ...(id === "r97" ? ([["aimed", "r.debugView.ads = 1;"]] as Array<[string, string]>) : []),
    ];
    for (const [name, set] of states) o.through[name] = await pf<number>(`${set} await H.gameWait(0.35); const d = await H.through(); H.clear(); r.loadout.active.state.clip = r.loadout.active.weapon.clipSize; await H.gameWait(0.3); return d;`);
    // the swap: the gun stays where it is while it phases out from its edges in and the next phases in from its middle
    // out (the owner, 2026-09-30: "keep the hands where they are while the weapon phases / disintegrates from the outside
    // going in ... then the new weapon should materialize from the inside out"), and the hands come a little off it and
    // turn in round its middle, "like the streetfighter haduken"; through it the most the gun's middle moves, the deepest
    // seen skin in the gun, the most an arm falls short, and with the hands cupped (held 0.6 s of game time to settle) how
    // far they are off their holds, how far each palm is turned from the gun's middle, the fingers' bend, the phase's shape
    const swap = await pf<Frames["swap"]>(`r.packRig().debugStill = true; const root = r.viewModelRoot(); const T = r.THREE; let gun = null; root.traverse((o) => { if (o.userData && o.userData.paid && !gun) gun = o; }); const at = () => root.worldToLocal(new T.Box3().setFromObject(gun).getCenter(new T.Vector3())); H.clear(); await H.gameWait(0.2); const p0 = at(); let moved = 0, deep = 0, short = 0; for (let u = 0.04; u < 0.97; u += 0.04) { r.debugView.raise = u; await H.gameWait(0.1); moved = Math.max(moved, at().distanceTo(p0)); const a = window.__packAudit(0.004); deep = Math.max(deep, a ? a.seenDeepest * 1000 : 0); const s = r.packArms(); short = Math.max(short, s.reachShort, s.reachShortR); } r.debugView.raise = 0.4; await H.gameWait(0.6); const c = r.packArms(); const radial = r.gunFeel().radial; r.packRig().debugStill = false; H.clear(); await H.gameWait(0.3); return { moved, deep, short, off: c.cupOff, face: c.cupFace, curl: Math.min(c.curlL, c.curlR), radial };`);
    o.swap = swap;
    const pick = await pf<string[]>(`r.packPickupAt(0.4); await H.gameWait(0.2); const a = r.packArms().lead; r.packPickupAt(null); await H.gameWait(0.3); const b = r.packArms().lead; r.debugView.inspect = null; return [a, b];`);
    o.pickLead = pick[0];
    o.pickAfter = pick[1];
    // a melee held as the punch goes out: the bought arms still holding the gun (no fists of the view's own), the left hand
    // off it and a fist, and no skin in the gun
    o.melee = await pf<Frames["melee"]>(`r.meleeAt(0.4); await H.gameWait(0.3); const s = r.packArms(); const deep = await H.through(); r.meleeAt(null); await H.gameWait(0.3); return { on: s.on, free: s.free, off: s.offHold, curl: s.curlL, deep: deep * 1000 };`);
    // a reload with a round still chambered against one from empty (the owner, 2026-09-30: "we need a reload differentiator
    // for empty mag vs still 1 in the chamber"): late in each, where the empty one racks (its handle back, BOOG's bolt
    // clip leading), and the tactical one's last share, which on the empty one's timeline falls in its rack
    // a venting gun's vent: the gun turned in both hands and back, no clip of the pack's playing
    if (vents) {
      o.vent = await pf<Vent>(`
        r.packRig().debugStill = true; H.clear(); await H.gameWait(0.2);
        const out = { mid: 0, ends: 0, lead: "", deep: 0, wrist: 0 };
        for (const u of [0.1, 0.3, 0.5, 0.7, 0.9]) {
          r.debugView.vent = u; await H.gameWait(0.15);
          const s = r.packArms();
          if (u === 0.5) { out.mid = s.vent; out.lead = s.lead; }
          out.deep = Math.max(out.deep, (window.__packAudit(0.004)?.seenDeepest ?? 0) * 1000);
          out.wrist = Math.max(out.wrist, s.wristL, s.wristR);
        }
        for (const u of [0.001, 0.999]) { r.debugView.vent = u; await H.gameWait(0.12); out.ends = Math.max(out.ends, r.packArms().vent); }
        r.packRig().debugStill = false; H.clear(); await H.gameWait(0.3);
        return out;`);
    }
    // a shell gun's feed through its reload from empty, and its pump after a shot and at the end of that reload
    if (shells) {
      const SR = (fparmsCfg.packGuns as Record<string, { reload?: { feed: number[]; count: number; push: number[]; back: number[]; pump: number[] } }>)[(fparmsCfg.guns as Record<string, string>)[id]].reload!;
      // (20 moments, a look each: three looks at 40 ran past the page's two minutes a step)
      const at = Array.from({ length: 20 }, (_, i) => SR.feed[0] + ((SR.feed[1] - SR.feed[0]) * (i + 0.5)) / 20);
      o.feed = await pf<Feed>(`
        r.packRig().debugStill = true; r.loadout.active.state.clip = 0; r.debugView.reload = 0.001; await H.gameWait(0.15);
        const T = r.THREE; const g = r.packRig().group; const gs = g.getWorldScale(new T.Vector3()).x;
        const root = r.viewModelRoot(); let gun = null; root.traverse((x) => { if (x.userData && x.userData.paid && !gun) gun = x; });
        let bullet = null, cover = null; gun.traverse((x) => { if (!bullet && /^Bullet$/.test(x.name)) bullet = x; if (!cover && /^Cover$/.test(x.name)) cover = x; });
        const W = (o) => o.getWorldPosition(new T.Vector3());
        const pinch = () => W(g.getObjectByName("index_03_l")).add(W(g.getObjectByName("thumb_03_l"))).multiplyScalar(0.5);
        const out = { pinch: 0, gates: [], deep: 0, short: 0, wrist: 0, seated: 0, jump: 0 };
        let gate = 0, slot = 0;
        for (const u of ${JSON.stringify(at)}) {
          r.debugView.reload = u; await H.gameWait(0.12);
          const k = Math.min(${SR.count - 1}, Math.floor(((u - ${SR.feed[0]}) / ${SR.feed[1] - SR.feed[0]}) * ${SR.count}));
          if (k !== slot) { out.gates.push(gate); gate = 0; slot = k; }
          gate = Math.max(gate, Math.abs(cover.parent.rotation.x));
          if (r.packRig().feed.held) out.pinch = Math.max(out.pinch, pinch().distanceTo(W(bullet)) / gs * 100);
          out.deep = Math.max(out.deep, (window.__packAudit(0.004)?.seenDeepest ?? 0) * 1000);
          out.short = Math.max(out.short, r.packRig().seen.reachShort * 100);
          out.wrist = Math.max(out.wrist, r.packArms().wristL);
        }
        out.gates.push(gate);
        // (the hand and the shell either side of each shell's start: nothing jumps there)
        out.jump = 0;
        for (let k = 1; k < ${SR.count}; k++) {
          const b = ${SR.feed[0]} + (k * ${SR.feed[1] - SR.feed[0]}) / ${SR.count};
          const at = async (u) => { r.debugView.reload = u; await H.gameWait(0.08); return [pinch(), W(bullet)]; };
          const [p0, s0] = await at(b - 0.002);
          const [p1, s1] = await at(b + 0.002);
          out.jump = Math.max(out.jump, p0.distanceTo(p1) / gs * 100, s0.distanceTo(s1) / gs * 100);
        }
        // (the last shell in, at its rest in the gate as the hand goes back to the pump)
        r.debugView.reload = ${(SR.back[0] + SR.back[1]) / 2}; await H.gameWait(0.2);
        const base = bullet.parent.userData.base; out.seated = base ? bullet.parent.position.distanceTo(base) / gs * 100 : 99;
        r.debugView.reload = null; r.packRig().debugStill = false; r.loadout.active.state.clip = r.loadout.active.weapon.clipSize; H.clear(); await H.gameWait(0.3);
        return out;`);
      o.pump = await pf<Pump>(`
        r.packRig().debugStill = true; H.clear(); await H.gameWait(0.3);
        const T = r.THREE; const g = r.packRig().group; const gs = g.getWorldScale(new T.Vector3()).x;
        const root = r.viewModelRoot(); let gun = null; root.traverse((x) => { if (x.userData && x.userData.paid && !gun) gun = x; });
        let pump = null; gun.traverse((x) => { if (!pump && /^Pump$/.test(x.name)) pump = x; });
        const inGun = (v) => gun.worldToLocal(v.clone());
        const palm = () => inGun(g.getObjectByName("hand_l").getWorldPosition(new T.Vector3()).lerp(g.getObjectByName("middle_01_l").getWorldPosition(new T.Vector3()), 0.55));
        const p0 = inGun(pump.getWorldPosition(new T.Vector3())), h0 = palm();
        const out = { apart: 0, stroke: 0, deep: 0, empty: "", tactical: "" };
        for (let u = 0.05; u < 1; u += 0.1) {
          r.packRig().debugShot = u; await H.gameWait(0.12);
          const dp = inGun(pump.getWorldPosition(new T.Vector3())).sub(p0), dh = palm().sub(h0);
          out.apart = Math.max(out.apart, dp.distanceTo(dh) * gun.getWorldScale(new T.Vector3()).x / gs * 100);
          out.stroke = Math.max(out.stroke, dp.length() * gun.getWorldScale(new T.Vector3()).x / gs * 100);
          out.deep = Math.max(out.deep, (window.__packAudit(0.004)?.seenDeepest ?? 0) * 1000);
        }
        r.packRig().debugShot = null;
        const late = async (empty) => {
          H.clear(); r.debugView.reload = null; await H.gameWait(0.3);
          r.loadout.active.state.clip = empty ? 0 : r.loadout.active.weapon.clipSize;
          r.debugView.reload = 0.001; await H.gameWait(0.15);
          r.debugView.reload = empty ? ${(SR.pump[0] + SR.pump[1]) / 2} : 0.97; await H.gameWait(0.3);
          return r.packArms().lead;
        };
        out.empty = await late(true);
        out.tactical = await late(false);
        r.debugView.reload = null; r.packRig().debugStill = false; r.loadout.active.state.clip = r.loadout.active.weapon.clipSize; H.clear(); await H.gameWait(0.3);
        return out;`);
    }
    o.tactical = await pf<Frames["tactical"]>(`
      const at = async (u, empty) => {
        H.clear(); r.debugView.reload = null; await H.gameWait(0.3);
        r.loadout.active.state.clip = empty ? 0 : r.loadout.active.weapon.clipSize;
        r.debugView.reload = 0.001; await H.gameWait(0.15);
        r.debugView.reload = u; await H.gameWait(0.3);
        const s = r.packArms();
        return { handle: s.handleBack, lead: s.lead };
      };
      const empty = await at(0.76, true);
      const tactical = await at(0.95, false);
      r.debugView.reload = null; r.loadout.active.state.clip = r.loadout.active.weapon.clipSize; H.clear(); await H.gameWait(0.3);
      return { empty, tactical };`);
    res.guns[id] = o;
  }
  // a melee that works (the owner, 2026-09-29: "ENSURE THE MELEE ACTUALLY WORKS AND DOES DAMAGE, WE SHOULDN'T BE ABLE TO
  // SHOOT WITH MELEEING"): the USSO in hand, a dummy 1.2 m ahead, a swing with the trigger held all through it; what the
  // dummy lost and the rounds fired by the swing's last frame, read every frame while it lasts (read at 0.3 s of game
  // time, of 0.38, a slow frame carried the read past its end and counted the first round after it), and the rounds
  // fired after it
  res.meleeWorks = await pf<typeof res.meleeWorks>(`
    H.clear();
    await H.hold("r97");
    const d = r.dummies.find((x) => x.group.visible && !x.knocked && !x.rail);
    const t = d.group.position;
    r.player.teleport(t.x, 0, t.z + 1.2, 0, -15);
    await H.gameWait(0.3);
    const hp0 = d.health + d.shield;
    const c0 = r.loadout.active.state.clip;
    const g0 = r.gameTime();
    const swung = r.swing();
    r.setScript({ held: (a) => a === "fire", pressedNow: () => false });
    const w0 = performance.now();
    let meleeing = false, cMid = c0, hp1 = hp0;
    while (r.triggerWhy().meleeing && performance.now() - w0 < 30000) {
      meleeing = true;
      cMid = r.loadout.active.state.clip;
      hp1 = d.health + d.shield;
      await new Promise((ok) => requestAnimationFrame(ok));
    }
    while (r.gameTime() - g0 < 0.9 && performance.now() - w0 < 30000) await new Promise((ok) => setTimeout(ok, 10));
    r.setScript(null);
    const cAfter = r.loadout.active.state.clip;
    await H.gameWait(0.3);
    return { swung, hurt: hp0 - hp1, during: c0 - cMid, after: cMid - cAfter, meleeing };`);
  // an inspect begun as its button begins one, timed in the game's own clock (BOOG, in the bought arms), waited for by game
  // time itself (H.gameWait gives up after 30 s, and on a loaded machine drawing a few frames a second, 5.6 s of game time
  // had not passed by then)
  res.inspectLen = await pf<typeof res.inspectLen>(`r.debugView.inspect = null; H.clear(); await H.gameWait(0.3); const time = r.packArms().inspectTime; const t0 = r.gameTime(); r.inspectNow(); const until = async (s) => { const w0 = performance.now(); while (r.gameTime() - t0 < s && performance.now() - w0 < 100000) await new Promise((ok) => setTimeout(ok, 20)); return r.gameTime() - t0; }; const e44 = await until(4.4); const at44 = r.vmState().inspecting; const e56 = await until(5.6); const at56 = r.vmState().inspecting; return { time, at44, at56, e44, e56 };`);
  // (the jump in a page of its own: in the section's, after the checks before it, the player left the ground and was
  // never stepped again, where a fresh page jumps, loops and lands)
  const jumpPage = await open(page.browser(), "?game=speedkills");
  await jumpPage.waitForFunction("window.__range.loaded() && window.__range.paidGuns().ready && window.__range.soldierReady()", { polling: 250, timeout: 120000 });
  await jumpPage.bringToFront();
  res.jump = await ev<string[]>(
    jumpPage,
    `(async () => {
      const r = window.__range;
      const T = r.THREE;
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const gameWait = async (s) => {
        const g0 = r.gameTime();
        const t0 = performance.now();
        while (r.gameTime() - g0 < s && performance.now() - t0 < 30000) await wait(20);
      };
      const hold = async (id) => {
        r.loadout.give(0, id);
        r.loadout.requestSwap(0, r.gameTime());
        const t0 = performance.now();
        let clearFrom = r.gameTime();
        while (r.gameTime() - clearFrom < 0.6 && performance.now() - t0 < 30000) {
          if (r.loadout.swapping || r.vmState().flourish) clearFrom = r.gameTime();
          await wait(20);
        }
      };
      const clear = () => {
        r.debugView.reload = null;
        r.debugView.raise = null;
        r.debugView.ads = null;
        r.packPickupAt(null);
      };
      // the magazine in its gun's own frame, in the view's metres (the gun turns over for the reload: in the world the
      // turn read as more slide than there was)
      const magAt = () => {
        let m = null;
        r.viewModelRoot().traverse((x) => { if (x.name === "mag" && !m) m = x; });
        if (!m) return new T.Vector3();
        let root = m;
        while (root.parent && !root.userData.paid) root = root.parent;
        const k = root.getWorldScale(new T.Vector3()).x / r.packRig().group.getWorldScale(new T.Vector3()).x;
        return root.worldToLocal(m.getWorldPosition(new T.Vector3())).multiplyScalar(k);
      };
      const scale = () => r.packRig().group.getWorldScale(new T.Vector3()).x;
      // a jump: the pack's start as you leave the ground, its end as you land
      // (on the range's floor, landed: where the section left the player it was still in the air the whole time)
      r.player.teleport(0, 0, 0, 0, 0);
      await hold("r97");
      // (the bought arms on the gun first: they come a moment after the page says it is ready)
      const t1 = performance.now();
      while (!r.packArms().on && performance.now() - t1 < 15000) await wait(50);
      await gameWait(0.5);
      const jump = [];
      let f = 0;
      // (in play for it: the section's page has its menu up, and the game steps no player while the menu is up, so the
      // jump left the ground and never came down)
      const overlay = document.getElementById("overlay");
      const menuWasUp = !overlay.classList.contains("hidden");
      const lockedWas = r.input.locked;
      overlay.classList.add("hidden");
      r.input.locked = true;
      r.setScript({ held: (a) => a === "jump" && f < 3, pressedNow: (a) => a === "jump" && f < 2 }, () => { f++; });
      // (2 s of the game's time, not the wall's: the e2e draws in software, a few frames a second, and 2.5 s of the wall
      // was half a second of game, the jump still in its start)
      const g0 = r.gameTime();
      const t0 = performance.now();
      while (r.gameTime() - g0 < 2 && performance.now() - t0 < 90000) {
        const p = r.packArms().jumpPart + (r.packArms().on ? "" : "(arms off)") + (r.player.onGround ? "" : "~");
        if (jump[jump.length - 1] !== p) jump.push(p);
        await wait(15);
      }
      r.setScript(null);
      r.input.locked = lockedWas;
      if (menuWasUp) overlay.classList.remove("hidden");
      return jump;
    })()`,
  );
  await jumpPage.close();
  await page.bringToFront();
  const g = Object.values(res.guns);
  // (a gun reloaded a shell at a time has no magazine to slide, phase or point at, and is checked on its feed and its pump)
  const gm = g.filter((x) => !x.feed && !x.vent);
  const gsh = Object.entries(res.guns).filter(([, x]) => !!x.feed);
  const show = (f: (x: Frames) => unknown) => JSON.stringify(Object.fromEntries(Object.entries(res.guns).map(([k, x]) => [k, f(x)])));
  /**
   * daylight the eye may see shut between a hand and its gun, pixels of tools/pack-audit.js __packSeenGap's 960 wide
   * picture (about a millimetre each at a support hand): no hole through a hand at all, and cracks along its edge as thin
   * as the antialiasing leaves
   */
  const SEEN_HOLES = 5;
  const SEEN_CRACKS = 40;
  check(
    "pack frames: the USSO and BOOG are fitted into the bought hands the same on every draw (it had been only the first)",
    // (tilted either way: ANAKIN's grip into the palm is 6 degrees nose down)
    g.length === packIds.length && g.every((x) => Math.abs(x.tilt[0]) > 0.05 && Math.abs(x.tilt[0] - x.tilt[1]) < 1e-4),
    show((x) => x.tilt.map((v) => +((v * 180) / Math.PI).toFixed(2))),
  );
  // (a cached gun keeps the place its last throw or draw's spin gave it, and its middle measured there moved with it:
  // the USSO aimed right after one draw and pushed far out after another, the owner, 2026-09-29, "adsing with the usso is
  // completely broken")
  check(
    "pack frames: the USSO's and BOOG's middles are measured the same drawn first and drawn back after a thrown swap",
    g.every((x) => x.centreSwapped && x.centreShift < 1e-4),
    show((x) => `${+x.centreShift.toFixed(5)}${x.centreSwapped ? "" : " (no swap)"}`),
  );
  check(
    "pack frames: at rest the USSO's and BOOG's barrels point as their look turns them (within 1 degree), not up the fit's tilt",
    g.every((x) => Math.abs(x.pitch - x.pitchWant) < 1),
    show((x) => ({ got: +x.pitch.toFixed(1), want: +x.pitchWant.toFixed(1) })),
  );
  // (the owner, 2026-09-30: "when we melee currently, the gun goes to a different spot ... we want it defaulted there":
  // the gun's own hold, where a melee left it when the bought arms let it go; the arms move with it, and aimed nothing of
  // the move is left)
  check(
    "pack frames: at rest the USSO and BOOG are held where the gun's own hold has them moved by each gun's look, out of the bottom right corner (within 2 mm, turned within half a degree), the arms moved with them, and aimed exactly where they were",
    g.every((x) => x.own.off < 0.002 && x.own.turn < 0.5 && x.own.aimed < 1e-4),
    show((x) => ({ off: +(x.own.off * 1000).toFixed(2), turn: +x.own.turn.toFixed(2), aimed: +x.own.aimed.toExponential(1) })),
  );
  // (aimed down the USSO its receiver's back end comes to 2 mm of the eye, which the gun camera's 2 cm near plane cut
  // open; the gun pushed out to clear it instead broke aiming, the owner, 2026-09-29: "adsing with the usso is completely
  // broken", so the near plane came in)
  check(
    "pack frames: aimed in and firing, no part of the USSO or BOOG comes inside the gun camera's near plane (nothing of it cut open)",
    g.every((x) => x.adsNear > 0),
    show((x) => +x.adsNear.toFixed(4)),
  );
  // (a 55 degree camera of their own, 2026-10-01, made a fit read off the wrong edges look right: the guns came out flat
  // across the picture, twice the size; fitted to where the references' guns point, the world's own matches)
  check(
    "pack frames: at the hip the bought arms' guns are drawn at the gun camera's own field of view, as a gun the view's own arms hold (within half a degree)",
    g.every((x) => Math.abs(x.fov - plainFov) < 0.5),
    `${plainFov.toFixed(1)}: ${show((x) => +x.fov.toFixed(1))}`,
  );
  // (the owner, 2026-09-28: "for the boog, the support hand is holding the mag": its palm was 10 cm back from the
  // magazine's front, the pack's L96X's fore-end being where BOOG's magazine is. The USSO's left hand is on its magazine
  // well, as Hyper Scape's Harpy is held, coming up from the bottom of the picture: the owner, 2026-10-03, "your
  // recommendation, like the harpy")
  if (has("sentinel")) check(
    "pack frames: at rest the support hand holds BOOG ahead of the magazine, not on it (its palm's middle 1 cm and more ahead of the magazine's front)",
    res.guns.sentinel?.palmAhead >= 0.01,
    show((x) => +(x.palmAhead * 100).toFixed(1)),
  );
  // (the owner, 2026-09-29: "THE THUMB AND THE PALM OF THE LEFT ARM ARE NOT EXACTLY FLUSH UP WITH THE USSO ON THE GUNS
  // LEFT SIDE, SEE THE GAP?": the palm touched at one point of its heel and its nearest tenth of skin stood 18.6 mm off,
  // the thumb's quarter 21 to 28 mm. Since 2026-10-03 the hand holds the USSO low ahead of its trigger guard as Hyper
  // Scape's Harpy is held, its fingers round the gun's underside and the back of the hand to the eye, the palm turned
  // away: the thumb lies along the side)
  if (has("r97")) check(
    "pack frames: at rest the USSO's left thumb lies along its left side (the thumb's quarter within 9 mm) and its palm is on the gun (touching, 1.5 mm)",
    res.guns.r97?.handFit.palmTouch <= 1.5 && res.guns.r97?.handFit.thumb <= 9,
    show((x) => ({ palm: +x.handFit.palmTouch.toFixed(1), thumb: +x.handFit.thumb.toFixed(1) })),
  );
  // (the owner, 2026-10-05: "WOW THE LEFT SUPPORT HAND ON THE USSO HAS A GAP BETWEEN IT AND THE GUN, DOUBLE CHECK FOR ANY
  // MORE OF THOSE": the USSO's left forefinger curled round to its thumb ahead of the gun, and the eye saw the range
  // through the ring, 80 pixels; ANAKIN's fingertips stood off its front, 70, and BOOG's palm edge showed a sliver along
  // the forend, 88. Every check of skin against the gun passed: the palm touched at one point. This counts what the eye
  // sees)
  check(
    `pack frames: at rest no gun shows daylight between a hand and the gun (no hole through a hand over ${SEEN_HOLES} pixels, a pinhole under 8 not a hole, cracks along it under ${SEEN_CRACKS}, of a 960 wide picture)`,
    g.length === packIds.length && g.every((x) => (["l", "r"] as const).every((k) => x.handFit.seen[k].holes <= SEEN_HOLES && x.handFit.seen[k].cracks <= SEEN_CRACKS)),
    show((x) => `l ${x.handFit.seen.l.holes}/${x.handFit.seen.l.cracks}, r ${x.handFit.seen.r.holes}/${x.handFit.seen.r.cracks}`),
  );
  // (and of the right: "why is the middle finger so separated from the bottom two? the 3 should be next to each other":
  // its tip 36 mm from the ring finger's, the ring's 25 from the little finger's)
  if (has("r97")) check(
    "pack frames: at rest the USSO's right middle, ring and little fingers lie together on the grip (the middle's gap to the ring within a quarter of the ring's to the little finger)",
    Math.abs(res.guns.r97?.handFit.mr - res.guns.r97?.handFit.rp) <= 0.25 * res.guns.r97?.handFit.rp,
    show((x) => ({ middleRing: +x.handFit.mr.toFixed(1), ringLittle: +x.handFit.rp.toFixed(1) })),
  );
  // (the owner, 2026-09-28: "the hand goes back to the grip in between pointing at the mag and hitting the charging
  // handle": it came within 4 cm of its place, the point let go as the magazine seated and the grab not yet reaching)
  if (has("r97")) check(
    "pack frames: reloading the USSO, the left hand goes from pointing at the magazine straight to its handle, never back onto the gun between (15 cm off its place at least)",
    res.guns.r97?.handover >= 0.15,
    show((x) => +(x.handover * 100).toFixed(1)),
  );
  if (has("r97")) check(
    "pack frames: racking the USSO, the left thumb and forefinger pinch its handle (their tips within 2 cm of the knob)",
    res.guns.r97?.hook < 0.02,
    show((x) => +(x.hook * 100).toFixed(1)),
  );
  // (the owner, 2026-09-29: "the left hand when doing the charging handle on the usso doesn't like close its
  // joints/fingers around the charging handle ... it kind of keeps its same position from the pointing": the forefinger
  // lay straight up the gun's side, curled 13 degrees)
  if (has("r97")) check(
    "pack frames: racking the USSO, the left forefinger closes round its handle (curled 100 degrees and more)",
    res.guns.r97?.rackCurl >= 100,
    show((x) => Math.round(x.rackCurl)),
  );
  // (the owner: "have the finger move up and down by a bit following where the mag goes, as if the finger controls the
  // mag going in": in step with it, nothing read as the finger's doing)
  check(
    // (and with the new one phasing in seated, the finger back at its spot as the new one builds down to it)
    "pack frames: the pointing finger leads the magazine, a third of its way and more ahead as it starts out, and is back at its spot as the new one builds",
    gm.every((x) => x.lead.out[0] - x.lead.out[1] >= 0.33 && (RL.slideIn > 0 ? x.lead.into[1] - x.lead.into[0] >= 0.33 : x.lead.into[0] < 0.05 && x.lead.into[1] < 0.05)),
    show((x) => ({ out: x.lead.out.map((v) => +v.toFixed(2)), in: x.lead.into.map((v) => +v.toFixed(2)) })),
  );
  // (the owner, 2026-10-01: "Our guns still look like they are pointed too far up and to the left", then "the exact match on
  // the harpy and r99 from their respective games ... Same with the boog for the apex and Hyperscape snipers": Apex's R-99 and
  // Sentinel at rest in the game's own weapon showcase, a still camera, traced; the USSO checked on Hyper Scape's Harpy and
  // BOOG on its Protocol V. Their edges found by machine meet at the crosshair, so each points straight at it, its cross edges
  // within 3 degrees of level; a first fit read the R-99's barrel line off the wrong edges, 25% across, and the guns lay
  // flat across the picture, their sides to the eye: the owner, "my gun is still pointing super weird and clipping through")
  // (then, 2026-10-02, the owner's pick of twenty placements round that fit, "pull back towards the camera a little ...
  // point at the crosshair ... rotate it left so the front goes right a little bit": the USSO's muzzle 2.4% further right
  // and 1.8% lower, both guns still pointing at the crosshair. ANAKIN (2026-10-04) on Apex's Alternator at rest, its barrel
  // edges meeting at 49% across and 47% down, 4.3 degrees off level, and the USSO's move from the fit on top, its muzzle
  // 2.4% right and 1.8% lower: the owner, "A is good, but obviously needs the usso treatment")
  // (PANDA, 2026-10-08, on Apex's Flatline at rest, its rail's edges meeting at 46.5% across and 46.3% down, 5 degrees
  // off level, and the USSO's move from the fit on top, its muzzle 2.4% right and 1.8% lower)
  // (BIGANTLER, 2026-10-09, on Apex's Mastiff at rest: Apex holds it canted across the picture, its rail's edges near
  // parallel, so only its muzzle is taken, 53.5% across and 57.5% down, with the USSO's move on top; its barrel's line at
  // the crosshair, as the others' are, 5 degrees off level; REZ the same way on Apex's EVA-8, its muzzle 55.5% across and
  // 56.5% down; CHOOCH on Apex's Devotion, there being no L-STAR at rest in the frames, its muzzle 54.5% across and 58%
  // down)
  const FIT: Record<string, { vanish: number[]; muzzle: number[]; level: number }> = { r97: { vanish: [0.5, 0.49], muzzle: [0.565, 0.625], level: -3 }, sentinel: { vanish: [0.5, 0.508], muzzle: [0.5465, 0.57], level: -2 }, alternator_smg: { vanish: [0.49, 0.472], muzzle: [0.593, 0.607], level: -4.3 }, vinson: { vanish: [0.465, 0.463], muzzle: [0.589, 0.574], level: -5 }, mastiff: { vanish: [0.47, 0.47], muzzle: [0.559, 0.593], level: -5 }, shotgun: { vanish: [0.47, 0.47], muzzle: [0.579, 0.583], level: -5 }, lstar: { vanish: [0.47, 0.47], muzzle: [0.569, 0.598], level: -5 } };
  check(
    "pack frames: at rest the USSO is held as Apex's R-99 and BOOG as its Sentinel and Hyper Scape's Protocol V: pointing at the crosshair (the barrel's line meeting the screen within 2% of theirs), level as theirs (within 2 degrees), the muzzle on theirs (within 2%)",
    g.every((x, i) => { const f = FIT[Object.keys(res.guns)[i]]; return !!f && x.fit.vanish.every((v, j) => Math.abs(v - f.vanish[j]) < 0.02) && x.fit.muzzle.every((v, j) => Math.abs(v - f.muzzle[j]) < 0.02) && Math.abs(x.fit.across - f.level) < 2; }),
    show((x) => ({ vanish: x.fit.vanish.map((v) => +v.toFixed(3)), muzzle: x.fit.muzzle.map((v) => +v.toFixed(3)), across: +x.fit.across.toFixed(1) })),
  );
  check(
    "pack frames: through a melee the left upper arm stays out of the picture (under 10% of it in it), no sheet of sleeve across the gun",
    g.every((x) => x.fit.upper < 0.1),
    show((x) => +x.fit.upper.toFixed(2)),
  );
  // (BOOG's left ring finger's middle joint had been NaN in every frame BOOG was held, after the USSO: the L96X's hold has
  // no track for it, and three.js kept the NaN it once blended toward)
  check(
    "pack frames: every joint of the bought arms is a number, held, on the USSO and BOOG (drawn one after the other)",
    g.every((x) => x.nanBones.length === 0),
    show((x) => x.nanBones.slice(0, 4)),
  );
  check(
    // (the pointing wrist where it is seen: held from the corner, the USSO's is 0.7 to 0.9 of the half picture under its
    // bottom edge through the point, bent 67 to 80 degrees, its finger up into the picture)
    "pack frames: both wrists 50 degrees or less at rest and aimed, and 60 or less pointing (where it is in the picture) and early in a swap, on the USSO and BOOG",
    g.every((x) => [...x.wrists.rest, ...x.wrists.aimed].every((w) => w <= 50) && (x.wrists.point <= 60 || x.pointHand < -1) && x.wrists.swap <= 60),
    show((x) => ({ rest: x.wrists.rest.map(Math.round), aimed: x.wrists.aimed.map(Math.round), point: Math.round(x.wrists.point), pointAt: +x.pointHand.toFixed(2), swap: Math.round(x.wrists.swap) })),
  );
  // (the owner, 2026-09-28: "the right arm is clearly still so fucked up ... just put the guns away and look at the right
  // arm": the right fist rolled 159 degrees on its forearm, the glove's cuff split from the sleeve, and each thumb out
  // ahead of its fist like a pointing finger)
  check(
    "pack frames: the fists are the bought arms', neither rolled on its forearm past 45 degrees, every finger curled (120 degrees and more) and each thumb across the fingers (within a phalanx)",
    g.every((x) => x.fists.free && x.fists.twist.every((t) => t <= 45) && x.fists.curl.every((c) => c >= 120) && x.fists.thumb.every((t) => t <= 1)),
    show((x) => ({ twist: x.fists.twist.map(Math.round), curl: x.fists.curl.map(Math.round), thumb: x.fists.thumb.map((t) => +t.toFixed(2)) })),
  );
  check(
    "pack frames: on an inspect the left hand opens, palm up, with both hacks you carry over it",
    g.every((x) => x.palm.w > 0.9 && x.palm.cards === 2),
    show((x) => x.palm),
  );
  // (the owner, 2026-09-29: "the arm looks out of place now when inspecting the hacks ... move it back down and slightly
  // closer to the camera ... the arm is weirdly up and out there": the elbow had been in the picture on its left, 0.5 and
  // 0.69 of the way down, the whole arm in from the side and the hand a third of the way down. Where the forearm leaves
  // the picture is walked along it, not read off the elbow: with the guns held from the corner the USSO's elbow is behind
  // the eye, and an elbow there projects to nonsense)
  check(
    "pack frames: on an inspect the open hand's forearm comes up from below the picture (it leaves through the bottom edge), the hand in the lower half of it",
    g.every((x) => x.palmArm.leaves === "bottom" && x.palmArm.hand[1] < -0.45),
    show((x) => ({ hand: x.palmArm.hand.map((v) => +v.toFixed(2)), leaves: x.palmArm.leaves, exit: x.palmArm.exit.map((v) => +v.toFixed(2)) })),
  );
  // (the owner: "or it should show the level as well like we do on the custom ui on the bottom")
  check(
    "pack frames: on an inspect each hack's card carries its fusion level, lit in its slot's colour as the HUD's hack boxes",
    g.every((x) => JSON.stringify(x.palmArm.keys) === JSON.stringify(["dash|2|mobility", "reveal|3|utility"])),
    show((x) => x.palmArm.keys),
  );
  // (the owner: "include the tossing up animation of the hacks nearing the end of the inspect and they dissolve in the air
  // like we plan to do when swapping guns")
  check(
    "pack frames: near an inspect's end the hacks are tossed up off the palm (5 cm and more) and phase out in the air, gone before the hand goes back to the gun",
    g.every((x) => x.toss.whole0 > 0.99 && x.toss.y1 - x.toss.y0 > 0.05 && x.toss.whole1 < 0.6 && x.toss.after === 0),
    show((x) => ({ rise: +(x.toss.y1 - x.toss.y0).toFixed(3), whole: [+x.toss.whole0.toFixed(2), +x.toss.whole1.toFixed(2)], after: x.toss.after })),
  );
  // (the owner: "make the whole animation like 2 seconds longer, so like a bit longer after each twist"), timed in the game
  check(
    "pack frames: an inspect in the bought arms runs 2 s longer than the view's own, still going 4.4 s in and over by 5.6",
    Math.abs(res.inspectLen.time - plainInspect - 2) < 0.01 && res.inspectLen.e44 >= 4.4 && res.inspectLen.at44 && res.inspectLen.e56 >= 5.6 && !res.inspectLen.at56,
    JSON.stringify({ ...res.inspectLen, plain: plainInspect }),
  );
  // (the owner, 2026-09-28: the hack "needs to be held higher and slightly more to the left so it doesn't bug in and out
  // with the gun when it sways back and forth on the usso", and "I have two hacks enabled, only 1 shows"; and the inspect
  // itself, first swept then: 85 of its 98 frames at fault, BOOG's grip 20 cm out of the right arm's reach, the right
  // wrist bent 99 degrees, the hands through the gun)
  const movesOk = (m: Moves, cards: boolean) => (!cards || m.cards <= 2) && m.deep <= 4 && m.wrist <= 60 && m.wrung <= 90 && m.short <= 0.01;
  const showMoves = (k: "inspect" | "flourish") => show((x) => ({ cards: Math.round(x[k].cards), deep: Math.round(x[k].deep), wrist: Math.round(x[k].wrist), wrung: Math.round(x[k].wrung), short: +(x[k].short * 100).toFixed(1) }));
  check(
    "pack frames: all through an inspect the hack cards are clear of the gun on the screen (2%), no hand through the gun (4 mm), the wrists 60 degrees or less, a forearm wrung 90 or less and both arms reaching",
    g.every((x) => movesOk(x.inspect, true)),
    showMoves("inspect"),
  );
  check(
    "pack frames: all through a first draw's flourish, a flick of the forearm, no hand through the gun, the wrists 60 degrees or less, a forearm wrung 90 or less and both arms reaching",
    g.every((x) => movesOk(x.flourish, false)),
    showMoves("flourish"),
  );
  check(
    "pack frames: drawn after the other gun, the hands hold the USSO and BOOG with the same grip as on the first draw",
    g.every((x) => x.gripSame > 0.9999),
    show((x) => +x.gripSame.toFixed(6)),
  );
  check(
    `pack frames: as it phases out the magazine has slid ${RL.slide} m out of the gun (the owner: "drop out and pixelate"), and the new one phases in ${RL.slideIn ? `from ${RL.slideIn * RL.slide} m out` : "seated"}`,
    gm.every((x) => x.slid > RL.slide * 0.8 && x.slid < RL.slide * 1.2 && (RL.slideIn > 0 ? x.slidIn > RL.slideIn * RL.slide * 0.5 : x.slidIn < 0.001)),
    show((x) => ({ out: +x.slid.toFixed(3), in: +x.slidIn.toFixed(3) })),
  );
  // (the owner, 2026-10-01: "make the magazine phase in from the middle out and then we take the mag out it should be from
  // the outside in", as the guns phase on a swap)
  check(
    "pack frames: the old magazine phases out from its edges in and the new one in from its middle out (the phase radial round the magazine's own middle, within 5 mm)",
    gm.every((x) => x.magPhase.radial.every((v) => v === 1) && x.magPhase.off.every((d) => d < 0.005)),
    show((x) => ({ radial: x.magPhase.radial, mm: x.magPhase.off.map((d) => Math.round(d * 1000)) })),
  );
  check(
    "pack frames: the pointing finger's tip is on its spot (within 1 cm) and points at the magazine (within 10 degrees)",
    gm.every((x) => x.miss < 0.01 && x.off < 10),
    show((x) => ({ cm: +(x.miss * 100).toFixed(1), deg: +x.off.toFixed(1) })),
  );
  check(
    // (none past touching, 4 mm: the holds fitted joint by joint to our grips, tools/pack-solve.ts and pack-thumb.ts; the
    // right thumbs had pressed 9 mm into the grips' sides, the pack's hands being made for thinner grips)
    "pack frames: no skin through the gun past touching (4 mm) where it is seen, held, pointing, the new magazine in, racking, aimed, swapping and picking up",
    g.every((x) => Object.values(x.through).every((d) => d <= 0.004)),
    show((x) => Object.fromEntries(Object.entries(x.through).map(([k, d]) => [k, Math.round(d * 1000)]))),
  );
  check(
    "pack frames: a swap keeps the gun where it is (its middle within 1 cm) as it phases out from its edges in and the next from its middle out; the hands come 1 to 4 cm off their holds and turn in round its middle (each palm within 50 degrees of facing it across its forearm, the fingers bent 45 degrees and more), no hand through the gun (4 mm) and both arms reaching all through it",
    g.every((x) => x.swap.moved < 0.01 && x.swap.radial === 1 && x.swap.off > 0.01 && x.swap.off < 0.04 && x.swap.face < 50 && x.swap.curl >= 45 && x.swap.deep <= 4 && x.swap.short < 0.01),
    // (a measure that is no number comes out of the page as null, and is shown as that: a NaN finger had crashed the report)
    show((x) => { const k = (v: number | null, f: number, d: number) => (typeof v === "number" ? +(v * f).toFixed(d) : v); return { moved: k(x.swap.moved, 100, 1), radial: x.swap.radial, off: k(x.swap.off, 100, 1), face: k(x.swap.face, 1, 0), curl: k(x.swap.curl, 1, 0), deep: k(x.swap.deep, 1, 1), short: k(x.swap.short, 100, 1) }; }),
  );
  check("pack frames: taking something off the ground plays the pack's pickup, and the hold comes back after", g.every((x) => x.pickLead === "pickup" && x.pickAfter === "pose"), show((x) => [x.pickLead, x.pickAfter]));
  check(
    "pack frames: a melee keeps the bought arms on the USSO and BOOG (no view fists), the left hand 12 cm and more off the gun in a fist (fingers curled 120 degrees and more), no skin in the gun (4 mm)",
    g.every((x) => x.melee.on && !x.melee.free && x.melee.off > 0.12 && x.melee.curl >= 120 && x.melee.deep <= 4),
    show((x) => ({ on: x.melee.on, free: x.melee.free, off: +(x.melee.off * 100).toFixed(1), curl: +x.melee.curl.toFixed(0), deep: +x.melee.deep.toFixed(1) })),
  );
  const TU = res.guns.r97?.tactical;
  const TB = res.guns.sentinel?.tactical;
  if (has("r97", "sentinel")) check(
    "pack frames: a reload from empty racks (the USSO's handle back, BOOG's bolt worked) and one with a round still chambered does not, the hands back on the gun",
    !!TU && !!TB && TU.empty.handle > 0.3 && TB.empty.lead === "fire" && TU.tactical.handle < 0.02 && TU.tactical.lead === "pose" && TB.tactical.handle < 0.02 && TB.tactical.lead === "pose",
    JSON.stringify({ usso: TU, boog: TB }),
  );
  // BIGANTLER's reload, a shell at a time (fparms.json packGuns reload): the left hand off the pump, each shell held at its
  // pinch and pushed up into the gate as it opens, then back on the pump; after a shot the hand works the pump, and a
  // reload from empty ends with it while one with a shell chambered does not
  if (gsh.length) {
    const showS = (f: (x: Frames) => unknown) => JSON.stringify(Object.fromEntries(gsh.map(([k, x]) => [k, f(x)])));
    check(
      "pack frames: a shell reload feeds every shell into the gate: each held at the hand's pinch (within 1 cm), the gate open as it goes in (30 degrees and more), the last one home, nothing jumping from one shell to the next (1 cm), no hand through the gun (4 mm), the arm reaching and the wrist 60 degrees or less",
      gsh.every(([, x]) => x.feed!.pinch < 1 && x.feed!.gates.length >= 2 && x.feed!.gates.every((a) => a > 0.52) && x.feed!.seated < 0.2 && x.feed!.jump < 1 && x.feed!.deep <= 4 && x.feed!.short < 1 && x.feed!.wrist <= 60),
      showS((x) => ({ pinch: +x.feed!.pinch.toFixed(1), gates: x.feed!.gates.map((a) => Math.round((a * 180) / Math.PI)), seated: +x.feed!.seated.toFixed(2), jump: +x.feed!.jump.toFixed(1), deep: +x.feed!.deep.toFixed(1), short: +x.feed!.short.toFixed(1), wrist: Math.round(x.feed!.wrist) })),
    );
    check(
      "pack frames: after a shot the left hand works the pump, the two moving together (within 5 mm), the pump back 3 cm and more, no hand through the gun (4 mm); a shell reload from empty ends with the pump and one with a shell chambered does not",
      gsh.every(([, x]) => x.pump!.apart < 0.5 && x.pump!.stroke > 3 && x.pump!.deep <= 4 && x.pump!.empty === "fire" && x.pump!.tactical === "pose"),
      showS((x) => ({ apart: +x.pump!.apart.toFixed(2), stroke: +x.pump!.stroke.toFixed(1), deep: +x.pump!.deep.toFixed(1), empty: x.pump!.empty, tactical: x.pump!.tactical })),
    );
  }
  // CHOOCH's overheat (fparms.json packGuns vent): its hands stay on it while it turns up and canted and back
  const gv = Object.entries(res.guns).filter(([, x]) => !!x.vent);
  if (gv.length) {
    check(
      "pack frames: an overheat vents: the gun turned up and canted in both hands mid-vent and back by its ends, no clip of the pack's playing, no hand through the gun (4 mm) and the wrists 60 degrees or less",
      gv.every(([, x]) => x.vent!.mid > 0.9 && x.vent!.ends < 0.05 && x.vent!.lead === "pose" && x.vent!.deep <= 4 && x.vent!.wrist <= 60),
      JSON.stringify(Object.fromEntries(gv.map(([k, x]) => [k, { mid: +x.vent!.mid.toFixed(2), ends: +x.vent!.ends.toFixed(2), lead: x.vent!.lead, deep: +x.vent!.deep.toFixed(1), wrist: Math.round(x.vent!.wrist) }]))),
    );
  }
  const MW = res.meleeWorks;
  check("pack frames: a melee with the USSO in hand lands on a dummy 1.2 m ahead for 30", MW.swung && MW.hurt === 30, JSON.stringify(MW));
  check("pack frames: the trigger held through a melee fires nothing until the swing is over, and fires after it", MW.swung && MW.meleeing && MW.during === 0 && MW.after > 0, JSON.stringify(MW));
  const js = res.jump.join(" ");
  check("pack frames: a jump plays the pack's start as you leave the ground and its end as you land", /start.*end/.test(js), js);
}

/**
 * The practice aim bot: it pulls the view onto a target you are not looking
 * straight at, it takes nothing it cannot see, and anyone running it is
 * marked on everyone else's screen.
 */
async function aimbotChecks(page: Page): Promise<void> {
  // it locks whichever target is nearest the crosshair, so the check is the
  // angle to the one it settles on, not to the one the test picked
  const aim = await ev<{ before: number; after: number }>(
    page,
    `(() => new Promise((res) => {
      const r = window.__range;
      const offTo = () => {
        const eye = r.player.eyePosition();
        let best = 999;
        for (const d of r.dummies) {
          if (!d.group.visible || d.knocked) continue;
          const part = d.hitMeshes.find((m) => m.userData.zone === "body") ?? d.hitMeshes[1];
          if (!part) continue;
          const at = part.getWorldPosition(new r.THREE.Vector3());
          const dx = at.x - eye.x, dy = at.y - eye.y, dz = at.z - eye.z;
          const dist = Math.hypot(dx, dy, dz);
          if (dist > 120) continue;
          const yaw = Math.atan2(-dx, -dz) * 180 / Math.PI;
          const pitch = Math.asin(dy / dist) * 180 / Math.PI;
          let dyaw = ((yaw - r.player.yaw + 540) % 360) - 180;
          best = Math.min(best, Math.hypot(dyaw, pitch - r.player.pitch));
        }
        return best;
      };
      const t = r.dummies[0].group.position;
      r.player.teleport(t.x, 0, t.z + 8, 0, 0);
      r.player.yaw = 25;
      r.player.pitch = 0;
      const before = offTo();
      r.aimbot.enabled = true;
      setTimeout(() => { const after = offTo(); r.aimbot.enabled = false; res({ before, after }); }, 2500);
    }))()`
  );
  check("aim bot: it sweeps the view onto the nearest target in sight", aim.before > 5 && aim.after < 2, `${aim.before.toFixed(1)} deg off -> ${aim.after.toFixed(1)}`);
  const blind = await ev<number>(
    page,
    `(() => new Promise((res) => {
      const r = window.__range;
      // nose to the backstop at the far end: every dummy is behind you
      r.player.teleport(0, 0, -103, 0, 0);
      const yaw0 = r.player.yaw;
      r.aimbot.enabled = true;
      setTimeout(() => { r.aimbot.enabled = false; res(Math.abs(r.player.yaw - yaw0)); }, 1200);
    }))()`
  );
  check("aim bot: with nothing in sight it leaves your view alone", blind < 1, `${blind.toFixed(2)} deg`);
}

/**
 * A shotgun's blast at a dummy from 4 m: every pellet leaves, they land in a
 * pattern rather than down one line, and the HUD sums the pull into one
 * damage number (the Mastiff read as a single 19 before).
 */
async function shotgunChecks(page: Page): Promise<void> {
  await ev(page, `(() => { const r = window.__range; r.loadout.setWeaponId(0, "mastiff"); })()`);
  await sleep(1600);
  const set = await ev<{ pellets: number; near: number }>(
    page,
    `(() => { const r = window.__range; const d = r.dummies[0]; const t = d.group.position; r.player.teleport(t.x, 0, t.z + 4, 0, 0); const eye = r.player.eyePosition();
      r.player.pitch = Math.atan2(t.y + 1.2 - eye.y, 4) * 180 / Math.PI; r.player.yaw = 0; const w = r.loadout.active.weapon; const st = r.loadout.active.state; st.clip = w.clipSize; return { pellets: w.pellets, near: w.damage.near }; })()`
  );
  const s0 = await ev<{ shots: number; hits: number; damage: number }>(page, "window.__range.stats()");
  await padTap(page, 7, 60);
  await sleep(700);
  const s1 = await ev<{ shots: number; hits: number; damage: number }>(page, "window.__range.stats()");
  const nums = await ev<Array<{ amount: number; text: string }>>(page, "window.__range.hud.damageNumbers");
  const fired = s1.shots - s0.shots;
  const hits = s1.hits - s0.hits;
  const dealt = s1.damage - s0.damage;
  check(`shotgun: one pull of the Mastiff is ${set.pellets} pellets, and at 4 m they all land`, fired === set.pellets && hits === set.pellets, `fired ${fired}, hit ${hits}`);
  check("shotgun: the pellets do damage each, not one pellet's worth", dealt >= set.near * set.pellets * 0.75, `${dealt} dealt, a pellet is ${set.near}`);
  check("shotgun: the HUD sums the pull into one damage number", nums.length === 1 && nums[0].amount === dealt, JSON.stringify(nums));
  await ev(page, `window.__range.loadout.setWeaponId(0, "rspn101")`);
  await sleep(1600);
  // a spray at one target: one number that grows, not one a round (hud.json
  // damageNumbers); five hits on one target handed to the HUD, as main.ts does
  const spray = await ev<Array<{ amount: number }>>(page, `(() => { const r = window.__range; const key = {}; const now = performance.now() / 1000;
    const before = r.hud.damageNumbers.length;
    for (let i = 0; i < 5; i++) r.hud.addDamage(new r.THREE.Vector3(0, 1.2, -10), 10, "#ff4a3d", false, now + i * 0.1, key);
    return r.hud.damageNumbers.slice(before); })()`);
  check("damage numbers: a spray at one target reads as one number that grows", spray.length === 1 && spray[0].amount === 50, JSON.stringify(spray));
  // a tracer is a streak from the muzzle, not a dot on the line of sight:
  // caught in flight, it is a metre or more long, and a few metres out it
  // has joined the real path
  const tr = await ev<{ first: { len: number; width: number; off: number; opacity: number } | null; later: { off: number; travelled: number } | null }>(page, `new Promise((ok) => { const r = window.__range; r.fireRound([0, 0.01, -1]); let first = null;
    const look = () => { const t = r.tracers(); if (!t.length) return ok({ first, later: null }); const x = t[t.length - 1]; if (!first && x.travelled > 0.5) first = x; if (x.travelled > 12) return ok({ first, later: x }); requestAnimationFrame(look); };
    requestAnimationFrame(look); })`);
  // (and your own dim: the owner, 2026-09-28, of a USSO spray, "the tracers ... are a bit obnoxious ... we should make the
  // tracers much less visible"; everyone else's keep 0.9, so fire coming at you still reads)
  check("tracers: a streak a metre or more long, on the real path once it is clear of the gun, and your own dim (0.3 or less)", !!tr.first && tr.first.len >= 1 && tr.first.width >= 0.02 && tr.first.opacity <= 0.3 && (!tr.later || tr.later.off < 0.05), JSON.stringify(tr));
  // the low-ammo line: a quarter of the magazine left, then none
  await ev(page, "(() => { const r = window.__range; r.loadout.active.state.clip = 3; })()");
  await sleep(200);
  const low = await ev<string | null>(page, "window.__range.hud.ammoWarningNow");
  await ev(page, "(() => { const r = window.__range; r.loadout.active.state.clip = 0; })()");
  await sleep(200);
  const none = await ev<string | null>(page, "window.__range.hud.ammoWarningNow");
  await ev(page, "(() => { const r = window.__range; r.loadout.active.state.clip = r.loadout.active.weapon.clipSize; })()");
  check("the low-ammo line: LOW AMMO with a few rounds left, RELOAD with none", low === "LOW AMMO" && none === "RELOAD", JSON.stringify({ low, none }));
}

/** look straight at a point in the world (bullets leave the eye, so this is what the crosshair is on) */
const AIM = `const aimAt = (p) => { const r = window.__range; const e = r.player.eyePosition(); const dx = p.x - e.x, dy = p.y - e.y, dz = p.z - e.z; r.player.yaw = Math.atan2(-dx, -dz) * 180 / Math.PI; r.player.pitch = Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI; };`;

interface TvState {
  section: number;
  page: number;
  pages: number;
  title: string;
  sections: string[];
}

/**
 * The README screen at the far end of the range: it is this repository's own
 * README, and shooting the arrow plates beside it turns its pages.
 */
async function readmeTvChecks(page: Page): Promise<void> {
  const tv = (): Promise<TvState> => ev<TvState>(page, "window.__range.readmeTv.state()");
  // aimed, not hip fired: a hip-fired round at 8 m can spread off a plate, and
  // this is a test of the paging, not of the cone
  const shootAt = async (expr: string, ms = 60) => {
    await ev(page, `(() => { ${AIM} aimAt(${expr}); })()`);
    await ev(page, padSet(6, true));
    await sleep(420);
    await ev(page, `(() => { ${AIM} aimAt(${expr}); })()`);
    await sleep(120);
    await padTap(page, 7, ms);
    await sleep(500);
    await ev(page, padSet(6, false));
    await sleep(150);
  };
  // the text comes when the screen is used (the owner, 2026-10-04): a cover until then, and a round on an arrow opens it
  const cover = await ev<{ loaded: boolean; sections: number }>(page, "({ loaded: window.__range.readmeTv.loaded, sections: window.__range.readmeTv.sections.length })");
  await ev(page, `(() => { const r = window.__range; r.player.teleport(0, 0, -98, 0, 0); })()`);
  await shootAt(`window.__range.readmeTv.buttonAt("nextPage")`);
  const opened = await page.waitForFunction("window.__range.readmeTv.loaded", { polling: 100, timeout: 8000 }).then(() => true, () => false);
  const first = await tv();
  // (at its first section: the pull fires more than one round, and one landing after the text is in turns a page, as an arrow does)
  check("README screen: a cover until it is used, and a round on an arrow loads the text at its start", !cover.loaded && cover.sections === 1 && opened && first.section === 0 && first.sections.length > 1, JSON.stringify({ cover, opened, at: [first.section, first.page] }));
  await ev(page, `(() => { const r = window.__range; r.player.teleport(0, 0, -98, 0, 0); r.readmeTv.goto(0, 0); })()`);
  await sleep(200);
  const start = await tv();
  // The words of the opening change as the game does (they were the legacy game's until 2026-10-03); what has to hold
  // is that the screen shows THIS file rather than a placeholder: its first heading, and the opening words of its first
  // paragraph, read off the file itself
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const heading = (readme.match(/^# (.+)$/m)?.[1] ?? "").trim();
  const opening = (readme.split(/\r?\n\r?\n/).find((p) => p.trim() && !p.trim().startsWith("#")) ?? "").trim().split(/\s+/).slice(0, 6).join(" ");
  check(
    "README screen: the range's own README, in sections and pages",
    start.sections.length > 8 && start.pages >= 1 && !!heading && start.title === heading,
    `${start.sections.length} sections, "${start.title}" (the file's "${heading}") is ${start.pages} page(s)`
  );
  const text = await ev<string>(page, "window.__range.readmeTv.pageText()");
  check("README screen: the first page is the README's own text", !!opening && text.replace(/\s+/g, " ").includes(opening), `"${opening}" in: ${text.slice(0, 80).replace(/\n/g, " ")}`);

  // the right-hand PAGE arrow
  await shootAt(`window.__range.readmeTv.buttonAt("nextPage")`);
  const paged = await tv();
  check("README screen: a round on the ▶ arrow turns the page", paged.page > start.page || paged.section !== start.section, `${start.section}/${start.page} -> ${paged.section}/${paged.page}`);
  // the SECTION arrow below it
  await shootAt(`window.__range.readmeTv.buttonAt("nextSection")`);
  const sectioned = await tv();
  check("README screen: a round on the ▼ arrow moves to the next section", sectioned.section !== paged.section && sectioned.page === 0, `${paged.section} -> ${sectioned.section} (page ${sectioned.page})`);
  // and back the other way
  await shootAt(`window.__range.readmeTv.buttonAt("prevSection")`);
  const back = await tv();
  check("README screen: the ▲ arrow goes back a section", back.section === paged.section, `${sectioned.section} -> ${back.section}`);

  // a round on the page itself changes nothing (stray fire down range)
  const beforeStray = await tv();
  await shootAt(`window.__range.readmeTv.bodyPoint()`);
  const afterStray = await tv();
  check("README screen: a round on the page itself does not move it", afterStray.section === beforeStray.section && afterStray.page === beforeStray.page, `${beforeStray.section}/${beforeStray.page} -> ${afterStray.section}/${afterStray.page}`);

  // the list of sections: a punch on a name opens it (the melee path). The
  // last one sits low on the screen, within a fist's reach of the floor.
  const jump = beforeStray.sections.length - 1;
  await ev(page, `(() => { ${AIM} const r = window.__range; const p = r.readmeTv.entryAt(${jump}); r.player.teleport(p.x, 0, p.z + 1.2, 0, 0); aimAt(p); })()`);
  await sleep(200);
  await padTap(page, 11, 90);
  await sleep(500);
  const jumped = await tv();
  check("README screen: a hit on a section's name opens that section", jumped.section === jump && jumped.page === 0, `wanted ${jump}, got ${jumped.section} ("${jumped.title}")`);
}

/** a fake gamepad: Start plays, the left stick walks, the right stick turns */
async function padTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  // Start on the menu: play without a pointer lock
  await pressPlay(page);
  const playing = await ev<{ hidden: boolean; playing: boolean; active: boolean }>(page, `({ hidden: document.getElementById("overlay").classList.contains("hidden"), playing: window.__range.input.playing, active: window.__range.input.pad.active })`);
  check("pad: Start hides the menu and the game takes the controller", playing.hidden && playing.playing && playing.active, JSON.stringify(playing));
  const before = await ev<{ z: number; yaw: number }>(page, "({ z: window.__range.player.pos.z, yaw: window.__range.player.yaw })");
  // stick forward and a right turn for a second
  await ev(page, "(() => { window.__pad.axes[1] = -1; window.__pad.axes[2] = 0.6; })()");
  await sleep(1000);
  await ev(page, "(() => { window.__pad.axes[1] = 0; window.__pad.axes[2] = 0; })()");
  const after = await ev<{ z: number; yaw: number; sprint: boolean }>(page, "({ z: window.__range.player.pos.z, yaw: window.__range.player.yaw, sprint: window.__range.player.sprinting })");
  check("pad: the left stick moves the player", Math.abs(after.z - before.z) > 1, `moved ${Math.abs(after.z - before.z).toFixed(1)} m`);
  check("pad: the right stick turns the view (right = yaw down)", after.yaw < before.yaw - 20, `yaw ${before.yaw.toFixed(0)} -> ${after.yaw.toFixed(0)}`);
  // RT fires: the shot counter moves
  const shots0 = await ev<number>(page, "window.__range.loadout.slots[0].state.clip");
  await ev(page, "window.__pad.buttons[7].pressed = true; window.__pad.buttons[7].value = 1;");
  await sleep(300);
  await ev(page, "window.__pad.buttons[7].pressed = false; window.__pad.buttons[7].value = 0;");
  const shots1 = await ev<number>(page, "window.__range.loadout.slots[0].state.clip");
  check("pad: the right trigger fires", shots1 < shots0, `clip ${shots0} -> ${shots1}`);
  // Shattercaps: the 30-30 fired from the hip is a blast of 7 pellets
  await ev(page, `(() => { const l = window.__range.loadout; l.setWeaponId(0, "3030"); l.fitAttachment(0, "hopup", "hopup_shattercaps"); })()`);
  await sleep(1500);
  const sc0 = await ev<number>(page, "window.__range.stats().shots");
  await padTap(page, 7, 60);
  await sleep(300);
  const sc1 = await ev<number>(page, "window.__range.stats().shots");
  check("Shattercaps: one pull of the 30-30 from the hip is 7 pellets", sc1 - sc0 === 7, `${sc0} -> ${sc1}`);
  await ev(page, `(() => { const l = window.__range.loadout; l.setWeaponId(0, "rspn101"); })()`);
  await sleep(1200);
  // the game's Default: Y taps swap, Y held holsters; D-pad left held inspects
  const slotA = await ev<number>(page, "window.__range.loadout.activeIndex");
  await ev(page, padSet(3, true));
  await sleep(100);
  await ev(page, padSet(3, false));
  const swapping = await page.waitForFunction(`window.__range.loadout.swapping || window.__range.loadout.activeIndex !== ${slotA}`, { polling: 20, timeout: 1000 }).then(() => true, () => false);
  await sleep(1500);
  const slotB = await ev<number>(page, "window.__range.loadout.activeIndex");
  check("pad: Y (a tap) swaps weapons (on the release)", swapping && slotB !== slotA, `${slotA} -> ${slotB}, swap seen ${swapping}`);
  await padTap(page, 3, 550);
  await sleep(900);
  const away = await ev<{ gun: boolean }>(page, "window.__range.vmState()");
  check("pad: Y held holsters (the gun goes away)", !away.gun, JSON.stringify(away));
  await padTap(page, 7);
  await sleep(900);
  await ev(page, "(() => { const s = window.__range.loadout.active.state; s.clip = window.__range.loadout.active.weapon.clipSize; })()");
  await ev(page, padSet(14, true));
  await sleep(500);
  const insp = await ev<boolean>(page, "window.__range.vmState().inspecting");
  await ev(page, padSet(14, false));
  check("pad: D-pad left held inspects the gun", insp);
  // the presets: Bumper Jumper puts jump on LB and the ability on A; Default puts them back
  await ev(page, `(() => { const s = document.getElementById("padPreset"); s.value = "bumperJumper"; s.dispatchEvent(new Event("change")); })()`);
  const bj = await ev<string[]>(page, "(() => { const b = window.__range.padButtons(); return [b[4], b[0]]; })()");
  await ev(page, `(() => { const s = document.getElementById("padPreset"); s.value = "default"; s.dispatchEvent(new Event("change")); })()`);
  const df = await ev<string[]>(page, "(() => { const b = window.__range.padButtons(); return [b[4], b[0], b[5], b[12], b[15]]; })()");
  check("pad presets: Bumper Jumper (jump on LB, the ability on A), then Default (ability, jump, ping, heal, grenade)", bj.join() === "jump,ability" && df.join() === "ability,jump,ping,heal,grenade", `${bj} / ${df}`);
  await page.close();
}

/**
 * The dropship (src/game/dropship.ts): the battle royale starts on a ship
 * flying a line across the map. Alone: aboard with the map up and the doors
 * shut, the bots riding out of sight, the jump refused until the doors open
 * and taken the moment they do, and every bot leaving the ship as it passes
 * its place and gliding onto it. Then the end of the line, which puts out
 * whoever is still aboard. Then a squad: the host is the jumpmaster, the
 * guest is linked, the host's jump takes the guest along in formation, and
 * the guest's break key lets go.
 */
async function shipTest(browser: Browser, query: string, squadQuery: string): Promise<void> {
  const page = await open(browser, query);
  await ev(page, "window.__straightDrop = false");
  await ev(page, brRow("solo", 5));
  await ev(page, `(() => { document.getElementById("brStart").value = "loadout"; document.getElementById("goBr").click(); document.getElementById("startMode").click(); })()`);
  await sleep(400);
  // the bots hold their fire: this is about the ride, and an idle rider on the ground is easy prey
  await ev(page, "window.__range.duel().holdFire = true");
  const on = await ev<{ aboard: boolean; y: number; map: boolean; doorsIn: number; hud: boolean; hidden: number; bots: number; edge: number[]; off: number; ahead: boolean; hands: boolean }>(
    page,
    `(() => { const R = window.__range; const d = R.duel(); const run = R.ship(); const h = R.hud.last; const L = run.line;
      const B = { minX: -220, maxX: 220, minZ: 280, maxZ: 720 };
      const edge = (x, z) => Math.min(Math.abs(x - B.minX), Math.abs(x - B.maxX), Math.abs(z - B.minZ), Math.abs(z - B.maxZ));
      const along = Math.max(0, Math.min(L.length, (d.poi.x - L.ax) * L.dx + (d.poi.z - L.az) * L.dz));
      const off = Math.hypot(d.poi.x - (L.ax + L.dx * along), d.poi.z - (L.az + L.dz * along));
      return { aboard: R.shipState().aboard, y: R.player.pos.y, map: !!h?.mapOpen, doorsIn: h?.ship?.doorsIn ?? -1, hud: !!h?.ship,
        hidden: d.bots.filter((b) => b.bot.aboard && !b.bot.dummy.group.visible).length, bots: d.bots.length,
        edge: [edge(L.ax, L.az), edge(L.bx, L.bz)], off, ahead: along >= L.length / 2 - 30, hands: R.viewModelVisible() }; })()`
  );
  // the map used to be thrown up over all of this, so the first thing anyone
  // saw of a match was a map with the ship, the sky and the island behind it
  check("the ship: the battle royale starts aboard it, at its height, the ride in view, the doors still shut", on.aboard && Math.abs(on.y - 138.4) < 0.6 && !on.map && on.hud && on.doorsIn > 0, JSON.stringify(on));
  await ev(page, `window.__range.setMapOpen(true)`);
  // hud.last is the frame that has been drawn, so the map opens on the next one
  await ev(page, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  const byHand = await ev<boolean>(page, `!!window.__range.hud.last.mapOpen`);
  await ev(page, `window.__range.setMapOpen(false)`);
  check("the ship: and the map is there for the asking, rather than in the way", byHand);
  check("the ship: the five bots ride it too, out of sight", on.bots === 5 && on.hidden === 5, `${on.hidden} of ${on.bots} hidden aboard`);
  check("the ship: its line crosses the map edge to edge, over the squad's place, with the place ahead", on.edge.every((e) => e < 0.05) && on.off <= 30.01 && on.ahead, JSON.stringify({ edge: on.edge, off: on.off, ahead: on.ahead }));
  check("the ship: no hands in the view aboard", !on.hands);
  // the match's voice says the drop, and the drop theme is on (announcer.ts, audio.ts music)
  const voiced = await ev<{ spoken: string[]; music: { on: boolean } }>(page, "(() => ({ spoken: window.__range.spoken(), music: window.__range.music() }))()");
  check("the ship: the announcer says the drop and the drop theme plays", voiced.spoken.includes("drop") && voiced.music.on, JSON.stringify(voiced));
  // the ship carries you: two readings of where you are a second apart
  const pace = await ev<number>(page, `new Promise((ok) => { const R = window.__range; const a = R.player.pos.clone(); const t0 = performance.now(); setTimeout(() => { const b = R.player.pos; ok(Math.hypot(b.x - a.x, b.z - a.z) / ((performance.now() - t0) / 1000)); }, 500); })`);
  check("the ship: it carries you along its line at 26 m/s", Math.abs(pace - 26) < 4, `${pace.toFixed(1)} m/s`);
  // the jump key held from here: refused while the doors are shut, taken as they open
  await ev(page, `window.__range.setScript({ held: (a) => a === "jump", pressedNow: (a) => a === "jump", playing: true, endFrame: () => {} })`);
  await sleep(150);
  const shut = await ev<{ aboard: boolean; doorsIn: number }>(page, `(() => { const R = window.__range; return { aboard: R.shipState().aboard, doorsIn: R.ship().doorsIn(performance.now() / 1000) }; })()`);
  check("the ship: the jump is refused while the doors are shut", shut.aboard && shut.doorsIn > 0, JSON.stringify(shut));
  // The first ring's wait starts once the ship has flown its line: the ride
  // used to eat into round one's wait, leaving about 25 s to loot.
  const clock = async () => ev<{ left: number; flying: boolean }>(page, `(() => { const d = window.__range.duel(); return { left: d.view ? d.view.timeLeft : -1, flying: !d.ship.gone(performance.now() / 1000) }; })()`);
  const c0 = await clock();
  await sleep(1500);
  const c1 = await clock();
  check("the ship: the first ring's clock waits while the ship flies", c0.flying && c1.flying && c0.left > 0 && Math.abs(c0.left - c1.left) < 0.05, JSON.stringify({ c0, c1 }));
  const out = await page.waitForFunction("!window.__range.shipState().aboard", { polling: 50, timeout: 6000 }).then(() => true, () => false);
  const left = await ev<{ dropping: boolean; map: boolean; along: number; inside: boolean }>(
    page,
    `(() => { const R = window.__range; const L = R.ship().line; const p = R.player.pos;
      return { dropping: R.player.dropping, map: !!R.hud.last?.mapOpen, along: (p.x - L.ax) * L.dx + (p.z - L.az) * L.dz, inside: p.x > -220 && p.x < 220 && p.z > 280 && p.z < 720 }; })()`
  );
  check("the ship: and taken the moment they open, into the skydive over the map's edge, the map out of the way", out && left.dropping && !left.map && left.inside && left.along >= -1 && left.along < 30, JSON.stringify(left));
  await ev(page, "window.__range.setScript(null)");
  const fight = await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 30000 }).then(() => true, () => false);
  check("the ship: the fight starts when you land", fight, await ev<string>(page, "String(window.__range.duel()?.phase)"));
  // the bots leave as the ship passes their places and glide down onto them
  const allOff = await page.waitForFunction("window.__range.duel().bots.every((b) => !b.bot.aboard)", { polling: 250, timeout: 30000 }).then(() => true, () => false);
  const down = await page.waitForFunction("window.__range.duel().bots.every((b) => !b.bot.dropping)", { polling: 250, timeout: 20000 }).then(() => true, () => false);
  const bots = await ev<Array<{ miss: number; off: number; y: number }>>(
    page,
    `(() => { const R = window.__range; const run = R.ship(); if (!run) return []; const L = run.line; return R.duel().bots.map((b) => {
      const t = b.dropTo; const s = Math.max(0, Math.min(L.length, (t.x - L.ax) * L.dx + (t.z - L.az) * L.dz));
      const at = b.landedAt;
      const miss = at ? Math.hypot(at.x - t.x, at.z - t.z) : -1;
      const off = Math.hypot(t.x - (L.ax + L.dx * s), t.z - (L.az + L.dz * s));
      return { miss, off: Number.isFinite(off) ? off : -1, y: b.bot.pos.y }; }); })()`
  );
  // a bot still in the air (miss -1) is not one that landed off its place
  const inReach = bots.filter((b) => b.off >= 0 && b.off < 140 && b.miss >= 0);
  // Within 8 m: the landforms and the tall buildings stand in some glide
  // paths, and a bot that meets one slides along it and comes down beside it
  // (5.5 m once, beside a mound).
  check("the ship: every bot leaves it and lands", allOff && down && bots.length === 5, JSON.stringify({ allOff, down, bots: bots.length }));
  // down on the ground, the drop theme fades: the fight has its own sounds
  const onFoot = await page.waitForFunction("(() => { const p = window.__range.player; return !p.dropping && !p.aboard && p.onGround; })()", { polling: 250, timeout: 40000 }).then(() => true, () => false);
  const quiet = await ev<{ on: boolean }>(page, "window.__range.music()");
  check("the ship: landed, the drop theme is off", onFoot && !quiet.on, JSON.stringify({ onFoot, quiet }));
  check(
    "the ship: a bot whose place is in a glide's reach lands on it",
    inReach.length > 0 && inReach.every((b) => b.miss < 8),
    JSON.stringify(bots.map((b) => [b.miss < 0 ? "in the air" : b.miss.toFixed(1), b.off < 0 ? "?" : b.off.toFixed(0)]))
  );
  await page.close();

  // ---- the end of the line: whoever is still aboard is put out
  const late = await open(browser, query);
  await ev(late, "window.__straightDrop = false");
  await ev(late, brRow("solo", 2));
  await ev(late, `(() => { document.getElementById("brStart").value = "loadout"; document.getElementById("goBr").click(); document.getElementById("startMode").click(); })()`);
  await sleep(400);
  await ev(late, "window.__range.ship().startAt -= 60");
  const put = await late.waitForFunction("!window.__range.shipState().aboard", { polling: 50, timeout: 3000 }).then(() => true, () => false);
  const lastOut = await ev<{ dropping: boolean; bots: number }>(late, "(() => { const R = window.__range; return { dropping: R.player.dropping, bots: R.duel().bots.filter((b) => b.bot.aboard).length }; })()");
  check("the ship: at the far edge it puts out whoever is still aboard, you and the bots", put && lastOut.dropping && lastOut.bots === 0, JSON.stringify(lastOut));
  await late.close();

  // ---- a squad: the jumpmaster's jump is the squad's
  const host = await open(browser, squadQuery);
  const guest = await open(browser, squadQuery);
  for (const p of [host, guest]) await ev(p, "window.__straightDrop = false");
  await ev(host, brRow("duo", 2));
  await ev(host, `(() => { document.getElementById("duelMode").value = "br"; document.getElementById("duelHost").click(); })()`);
  let code = "";
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  } catch {
    check("the ship: a squad connects", false, code);
    await host.close();
    await guest.close();
    return;
  }
  for (const p of [host, guest]) await pressPlay(p);
  const both = await Promise.all([host, guest].map((p) => p.waitForFunction("window.__range.shipState().aboard", { polling: 100, timeout: 15000 }).then(() => true, () => false)));
  const roles = await Promise.all(
    [host, guest].map((p) => ev<{ linkedTo: number | null; master: boolean; linkedName: string | null }>(p, "(() => { const R = window.__range; const h = R.hud.last?.ship; return { linkedTo: R.shipState().linkedTo, master: !!h?.master, linkedName: h?.linkedTo ?? null }; })()"))
  );
  check("the ship: a squad boards together, the host the jumpmaster and the guest linked to them", both[0] && both[1] && roles[0].master && roles[0].linkedTo === null && roles[1].linkedTo === 0 && !!roles[1].linkedName, JSON.stringify(roles));
  await host.waitForFunction("window.__range.ship().doorsOpen(performance.now() / 1000)", { polling: 100, timeout: 8000 }).catch(() => undefined);
  await ev(host, `window.__range.setScript({ held: (a) => a === "jump", pressedNow: (a) => a === "jump", playing: true, endFrame: () => {} })`);
  const hostOut = await host.waitForFunction("!window.__range.shipState().aboard", { polling: 50, timeout: 4000 }).then(() => true, () => false);
  await ev(host, "window.__range.setScript(null)");
  const guestOut = await guest.waitForFunction("!window.__range.shipState().aboard", { polling: 50, timeout: 4000 }).then(() => true, () => false);
  const gs = await ev<{ following: number | null; dropping: boolean }>(guest, "(() => { const R = window.__range; return { following: R.shipState().following, dropping: R.player.dropping }; })()");
  check("the ship: the jumpmaster's jump takes the linked guest out with them", hostOut && guestOut && gs.following === 0 && gs.dropping, JSON.stringify({ hostOut, guestOut, gs }));
  await sleep(2000);
  const gap = await ev<{ gap: number; following: number | null; hint: string | null }>(
    guest,
    `(() => { const R = window.__range; const f = R.duel().figureOf(0); const p = R.player.pos; const g = f ? f.group.position : null;
      return { gap: g ? Math.hypot(p.x - g.x, p.y - g.y, p.z - g.z) : -1, following: R.shipState().following, hint: R.hud.last?.dive?.following ?? null }; })()`
  );
  check("the ship: the guest flies in formation behind the jumpmaster, and the dive readout says whom it follows", gap.following === 0 && gap.gap > 2 && gap.gap < 12 && !!gap.hint, JSON.stringify(gap));
  await ev(guest, `window.__range.setScript({ held: (a) => a === "crouch", pressedNow: (a) => a === "crouch", playing: true, endFrame: () => {} })`);
  await sleep(300);
  await ev(guest, "window.__range.setScript(null)");
  const broke = await ev<{ following: number | null; leash: unknown; dropping: boolean }>(guest, "(() => { const R = window.__range; const s = R.shipState(); return { following: s.following, leash: s.leash, dropping: R.player.dropping }; })()");
  check("the ship: the break key lets go, and the guest flies themself", broke.following === null && broke.leash === null && broke.dropping, JSON.stringify(broke));
  const landed = await Promise.all([host, guest].map((p) => p.waitForFunction(`window.__range.duel().phase === "fight" && !window.__range.player.dropping`, { polling: 200, timeout: 30000 }).then(() => true, () => false)));
  check("the ship: both land and the fight is on", landed[0] && landed[1], JSON.stringify(landed));
  await host.close();
  await guest.close();
}

/**
 * Ring Consoles (src/game/ringconsole.ts): four by the map's places, lit.
 * Alone: the prompt at one, a scan that takes its hold and shows nothing
 * until it is done, then the circle after next on the map (the very circle
 * the ring's chain holds for that round), the console spent and saying so,
 * and the EVO paid. As a squad: a guest's scan reaches the host's map.
 */
async function consoleTest(browser: Browser, query: string, squadQuery: string): Promise<void> {
  const page = await open(browser, query);
  await ev(page, brRow("solo", 3));
  await ev(page, `(() => { document.getElementById("brStart").value = "loadout"; document.getElementById("goBr").click(); document.getElementById("startMode").click(); })()`);
  await sleep(400);
  await ev(page, "window.__range.duel().holdFire = true");
  const fight = await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 30000 }).then(() => true, () => false);
  const setup = await ev<{ n: number; lit: number; icons: number; plan: number; ahead: unknown; places: number }>(
    page,
    `(() => { const d = window.__range.duel(); const br = d.hud().br; return { n: d.consoles.length, lit: br.consoles.filter((c) => c.ready).length, icons: br.consoles.length, plan: d.ringPlan.length, ahead: br.ring.ahead, places: new Set(d.consoles.map((c) => c.place)).size }; })()`
  );
  check("ring console: four by four different places, lit and on the map; the ring's six circles known from the start; nothing ahead shown yet", fight && setup.n === 4 && setup.places === 4 && setup.lit === 4 && setup.icons === 4 && setup.plan === 6 && setup.ahead === null, JSON.stringify(setup));
  await ev(page, `(() => { const R = window.__range; const c = R.duel().consoles[0]; R.player.teleport(c.x + 1.2, 0, c.z, 0); })()`);
  await sleep(300);
  const prompt = await ev<string>(page, "JSON.stringify(window.__range.brPlay.hud.prompt)");
  check("ring console: standing at one, the prompt offers the scan", /SCAN THE RING CONSOLE/.test(prompt), prompt);
  const evo0 = await ev<number>(page, "window.__range.armor.evo");
  await ev(page, `window.__range.setScript({ held: (a) => a === "interact", pressedNow: (a) => a === "interact" })`);
  await sleep(3000);
  const half = await ev<{ hold: number; ahead: unknown }>(page, "(() => { const R = window.__range; return { hold: R.hud.last?.brHold?.progress ?? -1, ahead: R.duel().hud().br.ring.ahead }; })()");
  check("ring console: the scan is a hold, and shows nothing until it is done", half.hold > 0.2 && half.hold < 0.8 && half.ahead === null, JSON.stringify(half));
  const done = await page.waitForFunction("window.__range.duel().hud().br.ring.ahead !== null", { polling: 100, timeout: 8000 }).then(() => true, () => false);
  await ev(page, "window.__range.setScript(null)");
  await sleep(200);
  const after = await ev<{ ahead: { cx: number; cz: number; r: number } | null; want: { cx: number; cz: number; r: number }; ready: boolean; evo: number; prompt: string }>(
    page,
    `(() => { const R = window.__range; const d = R.duel(); const br = d.hud().br; return { ahead: br.ring.ahead, want: d.ringPlan[br.ring.phase], ready: br.consoles[0].ready, evo: R.armor.evo, prompt: JSON.stringify(R.brPlay.hud.prompt) }; })()`
  );
  const match = !!after.ahead && Math.abs(after.ahead.cx - after.want.cx) < 1e-6 && Math.abs(after.ahead.cz - after.want.cz) < 1e-6 && Math.abs(after.ahead.r - after.want.r) < 1e-6;
  check("ring console: done, the circle after next is on the map, the one the ring's chain holds for that round", done && match, JSON.stringify({ ahead: after.ahead, want: after.want }));
  check("ring console: spent for the round, and it says it reboots when the ring closes", !after.ready && /REBOOTS/.test(after.prompt), after.prompt);
  check("ring console: the scan pays 100 EVO", after.evo - evo0 === 100, `${evo0} -> ${after.evo}`);
  await page.close();

  // ---- a squad mate's scan reaches the host
  const host = await open(browser, squadQuery);
  const guest = await open(browser, squadQuery);
  await ev(host, brRow("duo", 2));
  await ev(host, `(() => { document.getElementById("duelMode").value = "br"; document.getElementById("duelHost").click(); })()`);
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    for (const pg of [host, guest]) await pg.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  } catch {
    check("ring console: a squad connects", false);
    await host.close();
    await guest.close();
    return;
  }
  for (const pg of [host, guest]) await pressPlay(pg);
  await ev(host, "window.__range.duel().holdFire = true");
  const landed = await Promise.all([host, guest].map((pg) => pg.waitForFunction(`window.__range.duel().phase === "fight" && !window.__range.player.dropping`, { polling: 200, timeout: 30000 }).then(() => true, () => false)));
  const plans = await Promise.all([host, guest].map((pg) => ev<string>(pg, "JSON.stringify({ plan: window.__range.duel().ringPlan, spots: window.__range.duel().consoles.map((c) => [c.x, c.z]) })")));
  check("ring console: host and guest know the same chain and the same consoles", landed[0] && landed[1] && plans[0] === plans[1], plans[0] === plans[1] ? "" : `${plans[0].slice(0, 120)} / ${plans[1].slice(0, 120)}`);
  await ev(guest, `(() => { const R = window.__range; const c = R.duel().consoles[1]; R.player.teleport(c.x + 1.2, 0, c.z, 0); R.setScript({ held: (a) => a === "interact", pressedNow: (a) => a === "interact" }); })()`);
  const seen = await host.waitForFunction("window.__range.duel().hud().br.ring.ahead !== null", { polling: 100, timeout: 12000 }).then(() => true, () => false);
  await ev(guest, "window.__range.setScript(null)");
  const hostView = await ev<{ ready: boolean[]; ahead: unknown }>(host, "(() => { const br = window.__range.duel().hud().br; return { ready: br.consoles.map((c) => c.ready), ahead: br.ring.ahead }; })()");
  check("ring console: the guest's scan puts the circle after next on the host's map too, and the host sees that console spent", seen && hostView.ready[1] === false && hostView.ready.filter(Boolean).length === 3, JSON.stringify(hostView));
  await host.close();
  await guest.close();
}

/**
 * The Gulag (src/game/gulag.ts). Alone, under the battle royale's rules: a
 * first death is not the end but a moment, then the Gulag's room, up again,
 * on its two guns, against a bot of your own; the countdown, the fight; a win
 * drops you back into the match with those guns; a second death is final.
 * Then a fresh match: overtime's flag, taken by the bot, loses it and ends it.
 * And a squad mate's trip reaches the host.
 */
async function gulagTest(browser: Browser, query: string, squadQuery: string): Promise<void> {
  const G = brCfg.gulag;
  const start = async (): Promise<Page> => {
    const page = await open(browser, query);
    await ev(page, "window.__noGulag = false");
    await ev(page, brRow("solo", 3));
    await ev(page, `(() => { document.getElementById("brStart").value = "loadout"; document.getElementById("goBr").click(); document.getElementById("startMode").click(); })()`);
    await sleep(400);
    await ev(page, "window.__range.duel().holdFire = true");
    await page.waitForFunction(`window.__range.duel()?.phase === "fight" && !window.__range.player.dropping`, { polling: 200, timeout: 30000 }).catch(() => undefined);
    return page;
  };
  const page = await start();
  await ev(page, "(() => { const d = window.__range.duel(); d.takeHit(1000, d.bots[0].bot.remote.id); })()");
  await sleep(500);
  const dead = await ev<{ alive: boolean; phase: string; gulag: string | null; hud: string | null }>(page, "(() => { const d = window.__range.duel(); return { alive: d.alive, phase: d.phase, gulag: d.gulag ? d.gulag.phase : null, hud: d.hud().br.gulag ? d.hud().br.gulag.phase : null }; })()");
  check("the Gulag: alone, a first death is not the end: a moment, and the Gulag is next", !dead.alive && dead.phase === "fight" && dead.gulag === "wait" && dead.hud === "wait", JSON.stringify(dead));
  const inside = await page.waitForFunction("window.__range.duel().gulag && window.__range.duel().gulag.phase !== 'wait'", { polling: 100, timeout: (G.delay + 3) * 1000 }).then(() => true, () => false);
  const room = await ev<{ alive: boolean; far: number; gap: number; guns: string[]; want: string[]; bot: boolean }>(
    page,
    `(() => { const R = window.__range; const d = R.duel(); const p = R.player.pos; const b = d.gulagBot;
      return { alive: d.alive, far: Math.hypot(p.x, p.z - 500), gap: b ? Math.hypot(b.pos.x - p.x, b.pos.z - p.z) : -1, guns: R.loadout.slots.filter((s) => !s.empty).map((s) => s.id).sort(), want: d.gulag.guns.slice().sort(), bot: !!b && b.alive }; })()`
  );
  check("the Gulag: in, up again, far from the map, facing a bot of your own, on the fight's two guns", inside && room.alive && room.far > 150 && room.gap > 5 && room.gap < 60 && room.bot && JSON.stringify(room.guns) === JSON.stringify(room.want), JSON.stringify(room));
  // where the bot stood through the countdown, to see it leave once the fight is on
  const spawnAt = await ev<{ x: number; z: number }>(page, "(() => { const b = window.__range.duel().gulagBot; return { x: b.pos.x, z: b.pos.z }; })()");
  const fighting = await page.waitForFunction("window.__range.duel().gulag && window.__range.duel().gulag.phase === 'fight' && window.__range.duel().canFire", { polling: 100, timeout: (G.countdown + 3) * 1000 }).then(() => true, () => false);
  check(`the Gulag: ${G.countdown} s of countdown, then the fight, guns live`, fighting);
  // The bot comes looking for you once the fight is on (the owner, 2026-09-28: it stood at its spawn the whole fight):
  // three seconds of the game's time on (a ?norender page's frames come slowly, and a wall's second is less of the game)
  const from = await ev<{ held: number; gap0: number }>(page, `(() => { const R = window.__range; const b = R.duel().gulagBot; const p = R.player.pos; return { held: Math.hypot(b.pos.x - ${spawnAt.x}, b.pos.z - ${spawnAt.z}), gap0: Math.hypot(b.pos.x - p.x, b.pos.z - p.z) }; })()`);
  await gameSleep(page, 3);
  const hunt = await ev<{ held: number; gap0: number; moved: number; gap: number }>(
    page,
    `(() => { const R = window.__range; const b = R.duel().gulagBot; const p = R.player.pos; return { held: ${from.held}, gap0: ${from.gap0}, moved: Math.hypot(b.pos.x - ${spawnAt.x}, b.pos.z - ${spawnAt.z}), gap: Math.hypot(b.pos.x - p.x, b.pos.z - p.z) }; })()`,
  );
  check("the Gulag: the bot holds its spawn through the countdown, then comes for you: 5 m and more closer in 3 s of the fight", hunt.held < 1 && hunt.gap0 - hunt.gap > 5, JSON.stringify(hunt));
  // the bot goes down: won, and back into the match with the same guns
  const guns = room.want;
  await ev(page, "(() => { const b = window.__range.duel().gulagBot; b.dummy.hit(0, 'body', 500, 1, 1, b.dummy.group.position); })()");
  const won = await page.waitForFunction("!window.__range.duel().gulag && window.__range.player.dropping", { polling: 100, timeout: (G.after + 4) * 1000 }).then(() => true, () => false);
  const back = await ev<{ y: number; inMap: boolean; guns: string[]; alive: boolean }>(
    page,
    `(() => { const R = window.__range; const p = R.player.pos; return { y: p.y, inMap: p.x > -220 && p.x < 220 && p.z > 280 && p.z < 720, guns: R.loadout.slots.filter((s) => !s.empty).map((s) => s.id).sort(), alive: R.duel().alive }; })()`
  );
  check("the Gulag: won, you drop back into the match with the guns you fought with", won && back.alive && back.y > 40 && back.inMap && JSON.stringify(back.guns) === JSON.stringify(guns), JSON.stringify(back));
  // a second death is final: one trip a match
  await page.waitForFunction("!window.__range.player.dropping", { polling: 200, timeout: 20000 }).catch(() => undefined);
  await ev(page, "(() => { const d = window.__range.duel(); d.takeHit(1000, d.bots[0].bot.remote.id); })()");
  const over = await page.waitForFunction(`window.__range.duel() === null || window.__range.duel().phase === "matchEnd"`, { polling: 100, timeout: 6000 }).then(() => true, () => false);
  check("the Gulag: one trip a match, and a second death ends it", over);
  await page.close();

  // ---- overtime's flag, taken by the bot: lost, and out
  const p2 = await start();
  await ev(p2, "(() => { const d = window.__range.duel(); d.takeHit(1000, d.bots[0].bot.remote.id); })()");
  await p2.waitForFunction("window.__range.duel().gulag && window.__range.duel().gulag.phase === 'fight'", { polling: 100, timeout: (G.delay + G.countdown + 4) * 1000 }).catch(() => undefined);
  // the clock run down; the bot put on the flag, you in a corner
  await ev(p2, "(() => { const g = window.__range.duel().gulag; g.overtimeAt = performance.now() / 1000; })()");
  const ot = await p2.waitForFunction("window.__range.duel().gulag && window.__range.duel().gulag.phase === 'overtime' && window.__range.duel().hud().br.gulag.phase === 'overtime'", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  await ev(p2, `(() => { const d = window.__range.duel(); const f = d.gulagFlag.position; d.gulagBot.pos.set(f.x, 0, f.z); d.gulagBot.dummy.group.position.set(f.x, 0, f.z); })()`);
  // the feed from here on, and where the Gulag is, to look for a second death's drop in it afterwards
  const flagAt = await ev<{ x: number; z: number }>(p2, `(() => { const d = window.__range.duel(); window.__gfeed = []; const f = d.onFeed; d.onFeed = (t, ...a) => { window.__gfeed.push(t); f?.(t, ...a); }; const p = d.gulagFlag.position; return { x: p.x, z: p.z }; })()`);
  const taking = await p2.waitForFunction("window.__range.duel().gulag && window.__range.duel().gulag.capThem > 1", { polling: 100, timeout: 6000 }).then(() => true, () => false);
  const lost = await p2.waitForFunction(`window.__range.duel() === null || window.__range.duel().phase === "matchEnd"`, { polling: 100, timeout: (G.capture + 8) * 1000 }).then(() => true, () => false);
  check("the Gulag: past its clock, overtime's flag; the bot holds it alone, and you are out", ot && taking && lost, JSON.stringify({ ot, taking, lost }));
  // lost, the trip is over and nothing else: nothing dropped in the Gulag's room, and the feed names the one who won it
  const after = await ev<{ feed: string[]; boxes: number }>(
    p2,
    `(() => { const d = window.__range.duel(); const drops = d && d.lootField ? [...d.lootField.drops.values()] : []; return { feed: window.__gfeed ?? [], boxes: drops.filter((x) => Math.hypot(x.pos.x - ${flagAt.x}, x.pos.z - ${flagAt.z}) < 40).length }; })()`
  );
  check("the Gulag: a loss is not a second death: nothing dropped in the Gulag, and the feed names who won it, not an id", after.boxes === 0 && after.feed.some((l) => /won the Gulag/.test(l)) && !after.feed.some((l) => /PLAYER \d/.test(l)), JSON.stringify(after));
  await p2.close();

  // ---- a squad mate's trip reaches the host
  const host = await open(browser, squadQuery);
  const guest = await open(browser, squadQuery);
  for (const pg of [host, guest]) await ev(pg, "window.__noGulag = false");
  await ev(host, brRow("duo", 2));
  await ev(host, `(() => { document.getElementById("duelMode").value = "br"; document.getElementById("duelHost").click(); })()`);
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    for (const pg of [host, guest]) await pg.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  } catch {
    check("the Gulag: a squad connects", false);
    await host.close();
    await guest.close();
    return;
  }
  for (const pg of [host, guest]) await pressPlay(pg);
  await ev(host, "window.__range.duel().holdFire = true");
  await Promise.all([host, guest].map((pg) => pg.waitForFunction(`window.__range.duel().phase === "fight" && !window.__range.player.dropping`, { polling: 200, timeout: 30000 }).catch(() => undefined)));
  // the guest goes down and bleeds out
  await ev(guest, "(() => { const d = window.__range.duel(); d.takeHit(500, 100); })()");
  await sleep(400);
  await ev(guest, "(() => { const d = window.__range.duel(); d.bleedUntil = performance.now() / 1000; })()");
  const heard = await host.waitForFunction("window.__range.duel().gulagIds.has(1)", { polling: 100, timeout: 5000 }).then(() => true, () => false);
  const gIn = await guest.waitForFunction("window.__range.duel().gulag && window.__range.duel().gulag.phase !== 'wait'", { polling: 100, timeout: (G.delay + 4) * 1000 }).then(() => true, () => false);
  check("the Gulag: a squad mate's trip reaches the host, and they go in", heard && gIn, JSON.stringify({ heard, gIn }));
  // up in the Gulag's room is not up in the match: the host's only mate is in there, so a knock now would be out, not down
  // (plan section 12, item 2: they counted as standing, and a knock went down to bleed out with nobody to come)
  await sleep(1500);
  const standing = await ev<boolean>(host, "window.__range.duel().squadUp()");
  check("the Gulag: a squad mate in the Gulag is not one standing to revive you", standing === false, String(standing));
  // the host brings them back at their echo meanwhile: that is their way back, and the trip is over
  await ev(host, `(() => { const r = window.__range; const d = r.duel(); const e = d.lootField ? [...d.lootField.drops.values()].find((x) => x.item.kind === "echo" && x.item.owner === 1) : undefined; d.sendRespawn(1, e ? e.pos.clone() : new r.THREE.Vector3(0, 0, 500), true); })()`);
  const rescued = await guest.waitForFunction("!window.__range.duel().gulag && window.__range.duel().alive", { polling: 100, timeout: 5000 }).then(() => true, () => false);
  const hostLeft = await host.waitForFunction("!window.__range.duel().gulagIds.has(1)", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  check("the Gulag: a squad mate's restore at your echo brings you back out of it, and the host hears the trip is over", rescued && hostLeft, JSON.stringify({ rescued, hostLeft }));
  await host.close();
  await guest.close();
}

/**
 * Emotes (src/game/emotes.ts). Your own: the figure plays it, your view steps
 * back and comes round in front to watch, and a step ends it. Someone
 * else's: a 1v1's host waves, and the guest's figure of the host waves, then
 * stops when the host moves.
 */
async function emoteTest(browser: Browser, query: string, duelQuery: string): Promise<void> {
  const page = await open(browser, query);
  await sleep(800);
  await ev(page, "window.__range.emote(1)");
  await sleep(700);
  const on = await ev<{ emoting: number | null; fig: number | null; shown: boolean; dist: number; ahead: number }>(
    page,
    `(() => { const R = window.__range; const c = R.cameraPos(); const e = R.player.eyePosition(); const f = R.selfFigure(); const y = R.player.yaw * Math.PI / 180;
      const dx = c[0] - e.x, dz = c[2] - e.z;
      return { emoting: R.emoting() ? R.emoting().index : null, fig: f ? f.emoting : null, shown: !!f && f.group.visible, dist: Math.hypot(dx, c[1] - e.y, dz), ahead: dx * -Math.sin(y) + dz * -Math.cos(y) }; })()`
  );
  check("emote: yours plays on your figure, and your view steps back in front of you to watch", on.emoting === 1 && on.fig === 1 && on.shown && on.dist > 1.5 && on.ahead > 0.5, JSON.stringify(on));
  await ev(page, `window.__range.setScript({ held: (a) => a === "forward", pressedNow: (a) => a === "forward" })`);
  await sleep(300);
  await ev(page, "window.__range.setScript(null)");
  const off = await ev<{ emoting: unknown; fig: number | null }>(page, "(() => { const R = window.__range; const f = R.selfFigure(); return { emoting: R.emoting(), fig: f ? f.emoting : null }; })()");
  check("emote: a step ends it", off.emoting === null && off.fig === null, JSON.stringify(off));
  await page.close();

  // a 1v1's host waves: the guest's figure of the host waves, and stops when the host moves
  const host = await open(browser, duelQuery);
  const guest = await open(browser, duelQuery);
  await ev(host, `document.getElementById("duelHost").click()`);
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    for (const pg of [host, guest]) await pg.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  } catch {
    check("emote: a 1v1 connects", false);
    await host.close();
    await guest.close();
    return;
  }
  await sleep(1200);
  // the host fires: the guest's figure of the host flashes at the muzzle, and the flash goes out
  const f0 = await ev<number>(guest, "window.__range.duel().remotes.get(0)?.avatar.flashFrames ?? -1");
  await ev(host, "(() => { const p = window.__range.player.eyePosition(); window.__range.duel().localShot(p, new window.__range.THREE.Vector3(0, 0, -1), 'rspn101'); })()");
  const lit = await guest.waitForFunction(`(window.__range.duel().remotes.get(0)?.avatar.flashFrames ?? -1) > ${f0}`, { polling: 50, timeout: 3000 }).then(() => true, () => false);
  await sleep(400);
  const out = await ev<boolean>(guest, "!window.__range.duel().remotes.get(0)?.avatar.flashShown");
  check("muzzle flash: the host fires and the guest's figure of the host flashes at the muzzle, then goes out", f0 >= 0 && lit && out, JSON.stringify({ f0, lit, out }));
  // the host fires into the floor: where it lands is marked on the guest's screen too
  const i0 = await ev<number>(guest, "window.__range.impacts()");
  await ev(host, "(() => { const p = window.__range.player.eyePosition(); window.__range.duel().localShot(p, new window.__range.THREE.Vector3(0, -1, -1).normalize(), 'rspn101'); })()");
  const marked = await guest.waitForFunction(`window.__range.impacts() > ${i0}`, { polling: 50, timeout: 3000 }).then(() => true, () => false);
  check("impacts: another player's round into the floor is marked where it lands", marked, `${i0} before`);
  // the host sprays the nearest wall it can turn to: the guest sees the host's spray
  let sprayed = false;
  for (let yaw = 0; yaw < 360 && !sprayed; yaw += 20) {
    await ev(host, `(() => { const p = window.__range.player; p.yaw = ${yaw}; p.pitch = -8; })()`);
    await sleep(60);
    sprayed = await ev<boolean>(host, "window.__range.spray()");
  }
  const seenSpray = sprayed && (await guest.waitForFunction("window.__range.sprays().owners.includes(0)", { polling: 100, timeout: 4000 }).then(() => true, () => false));
  check("sprays: the host sprays the wall in front of it, and the guest sees the host's spray there", seenSpray, JSON.stringify({ sprayed }));
  // the host's banner card reaches the guest, for a recap or a champion screen
  const hostCard = await ev<number>(host, "window.__range.banner()");
  const cardSeen = await guest.waitForFunction(`window.__range.banners()[0] === ${hostCard}`, { polling: 200, timeout: 12000 }).then(() => true, () => false);
  check("banner cards: the host's card reaches the guest", cardSeen, `${hostCard}`);
  // the host's finish on its gun: the guest's figure of the host wears it too
  await ev(host, `(() => { const r = window.__range; r.progress.s.xp = 1e7; r.progress.onChange?.(); const slot = document.getElementById("slot0"); slot.value = r.loadout.active.id; const f = document.getElementById("finish0"); f.value = "gold"; f.dispatchEvent(new Event("change")); })()`);
  const finishSeen = await guest.waitForFunction("window.__range.duel().avatarOf(0)?.finishId === 'gold'", { polling: 200, timeout: 8000 }).then(() => true, () => false);
  const hostWorn = await ev<string>(host, "window.__range.gunFinish(window.__range.loadout.active.id).finish");
  check("finishes: the host's gun in Gold, and the guest's figure of the host wears it too", finishSeen && hostWorn === "gold", JSON.stringify({ finishSeen, hostWorn }));
  await ev(host, "window.__range.emote(0)");
  const seen = await guest.waitForFunction("window.__range.duel().remotes.get(0)?.avatar.emoting === 0", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  await ev(host, `window.__range.setScript({ held: (a) => a === "forward", pressedNow: (a) => a === "forward" })`);
  const stopped = await guest.waitForFunction("window.__range.duel().remotes.get(0)?.avatar.emoting === null", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  await ev(host, "window.__range.setScript(null)");
  check("emote: the host's wave shows on the guest's figure of the host, and stops when the host moves", seen && stopped, JSON.stringify({ seen, stopped }));
  await host.close();
  await guest.close();
}

/**
 * Host migration (docs/PLAN_HOST_MIGRATION.md): three friends in a
 * Free-for-all with no bots. The host names an heir; the host's tab crashes
 * (its links cut with no goodbye, then the tab closed); the heir takes the
 * match over on the same code and the third page comes back to it on its
 * seat. The match goes on: the same match on both pages, the score and the
 * clock carried over, and the two hearing each other.
 */
async function migrateTest(browser: Browser, query: string, label = "host migration", kind = "ffa", bots = 0): Promise<void> {
  const host = await open(browser, query);
  const b = await open(browser, query);
  const c = await open(browser, query);
  const pages = [host, b, c];
  const close = async () => {
    for (const p of pages) if (!p.isClosed()) await p.close();
  };
  await ev(host, `(() => { document.getElementById("duelMode").value = "${kind}"; document.getElementById("modeBots").value = "${bots}"; document.getElementById("modeSides").value = "together"; document.getElementById("botDifficulty").value = "mixed"; document.getElementById("duelPlayers").value = "3"; document.getElementById("duelHost").click(); })()`);
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    for (const p of [b, c]) {
      await ev(p, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
      await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
    }
    await host.waitForFunction("window.__range.duel()?.connected === 2", { polling: 200, timeout: 30000 });
    for (const p of pages) await pressPlay(p);
    for (const p of pages) await p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 45000 });
  } catch {
    check(`${label}: the three start the match`, false);
    await close();
    return;
  }
  // the heir, named to everyone
  const named = await Promise.all(pages.map((p) => p.waitForFunction("window.__range.duel().heir !== null", { polling: 200, timeout: 8000 }).then(() => true, () => false)));
  const heirId = await ev<number | null>(host, "window.__range.duel().heir");
  const ids = await Promise.all([b, c].map((p) => ev<number>(p, "window.__range.duel().id")));
  const heir = ids[0] === heirId ? b : c;
  const other = heir === b ? c : b;
  const otherId = heir === b ? ids[1] : ids[0];
  const seen = await Promise.all([heir, other].map((p) => ev<number | null>(p, "window.__range.duel().heir")));
  check(`${label}: the host names the lowest guest its heir, and both guests know it`, named.every(Boolean) && heirId === Math.min(...ids) && seen.every((h) => h === heirId), JSON.stringify({ heirId, ids, seen }));
  // a score to carry over: three kills for the other guest, which the host tells everyone
  await ev(host, `(() => { const d = window.__range.duel(); d.board.row(${otherId}).kills = 3; d.modeSendNext = 0; })()`);
  await heir.waitForFunction(`window.__range.duel().board.row(${otherId}).kills === 3`, { polling: 100, timeout: 4000 }).catch(() => undefined);
  const before = await ev<number>(host, "window.__range.duel().clockLeft(performance.now() / 1000)");
  const beforeAt = Date.now();
  for (const p of [heir, other]) await ev(p, "window.__match = window.__range.duel()");
  // the bots as the host has them: index, tier, team
  const botsOf = "window.__range.duel().bots.map((b) => [b.bot.index, b.bot.diff.name, b.team].join(':')).sort().join(',')";
  const botsBefore = await ev<string>(host, botsOf);
  // the host's tab crashes: every link cut with no goodbye, then the tab is gone
  await ev(host, "(() => { const d = window.__range.duel(); for (const l of d.links.values()) { l.onClose = null; l.abandon?.(); } d.leave = () => undefined; })()");
  await host.close();
  const t0 = Date.now();
  const took = await heir.waitForFunction("window.__range.duel()?.role === 'host'", { polling: 100, timeout: 30000 }).then(() => true, () => false);
  const tookIn = (Date.now() - t0) / 1000;
  const back = await other.waitForFunction(`window.__range.duel()?.hostId === ${heirId} && window.__range.duel().reconnectUntil === null`, { polling: 100, timeout: 30000 }).then(() => true, () => false);
  const backIn = (Date.now() - t0) / 1000;
  const same = await Promise.all([heir, other].map((p) => ev<boolean>(p, "window.__range.duel() === window.__match")));
  check(`${label}: the heir takes the match over and the other guest is back in on its seat, with the heir as its host`, took && back && same.every(Boolean), JSON.stringify({ took, back, same, tookIn, backIn }));
  // the match goes on: the phase, the score and the clock carried over, the two hearing each other
  await sleep(1500);
  const after = await ev<{ phase: string; kills: number; left: number; linked: boolean; held: boolean; oldGone: boolean }>(heir, `(() => { const d = window.__range.duel(); return { phase: d.phase, kills: d.board.row(${otherId}).kills, left: d.clockLeft(performance.now() / 1000), linked: d.links.has(${otherId}), held: d.held.has(${otherId}), oldGone: !d.remotes.has(0) }; })()`);
  const expected = before - (Date.now() - beforeAt) / 1000;
  const flow = await Promise.all([
    ev<number>(heir, `performance.now() / 1000 - window.__range.duel().remotes.get(${otherId}).lastHeard`),
    ev<number>(other, `performance.now() / 1000 - window.__range.duel().remotes.get(${heirId}).lastHeard`),
  ]);
  const otherView = await ev<{ phase: string; kills: number; oldGone: boolean }>(other, `(() => { const d = window.__range.duel(); return { phase: d.phase, kills: d.board.row(${otherId}).kills, oldGone: !d.remotes.has(0) }; })()`);
  check(
    `${label}: the match goes on, its score and clock carried over, the old host gone and the two hearing each other`,
    after.phase === "fight" && otherView.phase === "fight" && after.kills === 3 && otherView.kills === 3 && Math.abs(after.left - expected) < 2 && after.linked && !after.held && after.oldGone && otherView.oldGone && flow[0] < HEARD && flow[1] < HEARD,
    JSON.stringify({ after, otherView, expected, flow })
  );
  if (bots > 0) {
    // the bots: the same ones, made again on the heir, and still moving on the other guest's screen
    const botsAfter = await ev<string>(heir, botsOf);
    const botFlow = await ev<number>(other, "Math.max(...[...window.__range.duel().remotes.values()].filter((r) => r.id >= 100).map((r) => performance.now() / 1000 - r.lastHeard))");
    const figures = await ev<number>(heir, "[...window.__range.duel().remotes.keys()].filter((id) => id >= 100).length");
    const extra = kind === "control" ? await ev<{ zones: number; heirZones: number }>(heir, "(() => { const d = window.__range.duel(); return { zones: d.control ? d.control.zones.length : 0, heirZones: d.control ? 1 : 0 }; })()") : null;
    check(`${label}: the bots are the same ones, each with its tier and team, run by the new host, and heard from on the other guest's screen`, botsBefore.length > 0 && botsAfter === botsBefore && figures === 0 && botFlow < HEARD && (!extra || extra.zones === 3), JSON.stringify({ botsBefore, botsAfter, figures, botFlow, extra }));
  }
  // and the new host names its own heir: the last guest
  const next = await heir.waitForFunction(`window.__range.duel().heir === ${otherId}`, { polling: 200, timeout: 5000 }).then(() => true, () => false);
  check(`${label}: the new host names the other guest its heir`, next);
  await close();
}

/**
 * Host migration in a battle royale (phase 4): three friends as a trio
 * against bot squads, down on the map. The host's tab crashes; the heir
 * takes the match over. The same bots, each with its tier, squad and kit,
 * run on from where the heir last saw them; the ring is where it was on its
 * seeded plan; the third friend is back in and sees the bots move.
 */
async function brMigrateTest(browser: Browser, query: string, label = "host migration (battle royale)"): Promise<void> {
  const host = await open(browser, query);
  const b = await open(browser, query);
  const c = await open(browser, query);
  const pages = [host, b, c];
  const close = async () => {
    for (const p of pages) if (!p.isClosed()) await p.close();
  };
  await ev(host, brRow("trio", 6));
  await ev(host, LOOT_START);
  await ev(host, `(() => { document.getElementById("brSides").value = "together"; document.getElementById("botDifficulty").value = "mixed"; document.getElementById("duelMode").value = "br"; document.getElementById("duelPlayers").value = "3"; document.getElementById("duelHost").click(); })()`);
  // which of the waits below gave out, so a failure says where it stopped (docs/TEST_AUDIT.md: this check
  // failed about one run in two for weeks with nothing to say which step it was)
  let step = "the lobby";
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    step = "the friends joining";
    for (const p of [b, c]) {
      await ev(p, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
      await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
    }
    await host.waitForFunction("window.__range.duel()?.connected === 2", { polling: 200, timeout: 30000 });
    step = "the fight starting";
    for (const p of pages) await pressPlay(p);
    for (const p of pages) await p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 60000 });
    await ev(host, "window.__range.duel().holdFire = true");
    // every bot down on the map, and the heir named with a snapshot to take over from
    step = "an heir";
    await host.waitForFunction("window.__range.duel().heir !== null", { polling: 250, timeout: 60000 });
    // most of the bots with a gun they found, and the ring closing: the state worth carrying over
    step = "four bots armed";
    // a minute of the match's own time for them to find guns: three whole battle royales in one browser starve
    // each other's frames, and a starved page's game time falls behind the wall's (gameSleep's reason), so a minute
    // of wall time was sometimes a fraction of one in the match and the bots had not walked to their guns yet
    const armedFrom = await ev<number>(host, "window.__range.gameTime()");
    await host.waitForFunction(`window.__range.duel().bots.filter((x) => x.bot.lootKit.gunId).length >= 4 || window.__range.gameTime() > ${armedFrom} + 60`, { polling: 500, timeout: 240000 });
    if ((await ev<number>(host, "window.__range.duel().bots.filter((x) => x.bot.lootKit.gunId).length")) < 4) throw new Error("four bots armed");
    step = "the ring closing";
    await ev(host, "(() => { const r = window.__range.duel().ring; if (r.state === 'waiting') r.timeLeft = Math.min(r.timeLeft, 1); })()");
    await host.waitForFunction("window.__range.duel().view.state === 'closing'", { polling: 200, timeout: 10000 });
  } catch {
    const why = await ev<unknown>(
      host,
      // and, for a bot without a gun, what it is doing about it: where it is, its tier, its loot goal and how far off,
      // whether it has loot to look in and has stopped looking; and the settings the page came in with from the
      // sections before it (pages share localStorage), the suspect when it fails in a batch and passes alone
      "(() => { const d = window.__range.duel(); if (!d) return null; const r = (v) => Math.round(v * 10) / 10; return { phase: d.phase, heir: d.heir, over: d.brOver, ring: d.ring.state, view: d.view.state, armed: d.bots.filter((x) => x.bot.lootKit.gunId).length, bots: d.bots.map((x) => [x.landed, x.bot.alive, x.bot.aboard, x.bot.dropping, x.bot.lootKit.gunId ?? null]), unarmed: d.bots.filter((x) => !x.bot.lootKit.gunId).map((x) => { const b = x.bot; const g = b.looter?.goal; return { at: [r(b.pos.x), r(b.pos.y), r(b.pos.z)], tier: b.diff?.name, goal: g ? [r(g.x), r(g.z)] : null, off: g ? r(Math.hypot(g.x - b.pos.x, g.z - b.pos.z)) : null, source: !!b.lootSource, done: b.looter?.done?.(window.__range.gameTime()) ?? null, knife: !!b.knife }; }), carried: Object.fromEntries(Object.keys(localStorage).filter((k) => !/profile|progress|xp|stats|board|history|recap|ghost|splits/i.test(k)).map((k) => [k, String(localStorage.getItem(k)).slice(0, 40)])) }; })()"
    ).catch(() => null);
    check(`${label}: the three drop and the host names an heir once the bots are down`, false, `stopped at ${step}: ${JSON.stringify(why)}`);
    await close();
    return;
  }
  const heirId = await ev<number | null>(host, "window.__range.duel().heir");
  const ids = await Promise.all([b, c].map((p) => ev<number>(p, "window.__range.duel().id")));
  const heir = ids[0] === heirId ? b : c;
  const other = heir === b ? c : b;
  const kitsOf = "window.__range.duel().bots.map((x) => [x.bot.index, x.bot.lootKit.gunId, x.bot.lootKit.armor].join(':')).sort()";
  // a snapshot made after the bots are as they will be read: let one more go out
  await sleep(1300);
  const roster = await ev<string[]>(host, "window.__range.duel().botRoster");
  const kits = await ev<string[]>(host, kitsOf);
  const ring = await ev<{ phase: number; state: string; timeLeft: number }>(host, "(() => { const v = window.__range.duel().view; return { phase: v.phase, state: v.state, timeLeft: v.timeLeft }; })()");
  const ringAt = Date.now();
  for (const p of [heir, other]) await ev(p, "window.__match = window.__range.duel()");
  await ev(host, "(() => { const d = window.__range.duel(); for (const l of d.links.values()) { l.onClose = null; l.abandon?.(); } d.leave = () => undefined; })()");
  await host.close();
  const t0 = Date.now();
  const took = await heir.waitForFunction("window.__range.duel()?.role === 'host'", { polling: 100, timeout: 30000 }).then(() => true, () => false);
  const tookIn = (Date.now() - t0) / 1000;
  const back = await other.waitForFunction(`window.__range.duel()?.hostId === ${heirId} && window.__range.duel().reconnectUntil === null`, { polling: 100, timeout: 30000 }).then(() => true, () => false);
  const backIn = (Date.now() - t0) / 1000;
  const same = await Promise.all([heir, other].map((p) => ev<boolean>(p, "window.__range.duel() === window.__match")));
  check(`${label}: the heir takes the match over and the third friend is back in on its seat`, took && back && same.every(Boolean), JSON.stringify({ took, back, same, tookIn, backIn }));
  if (!took) {
    await close();
    return;
  }
  await ev(heir, "window.__range.duel().holdFire = true");
  await sleep(1500);
  const after = await ev<{ roster: string[]; kits: string[]; figures: number; ring: { phase: number; state: string; timeLeft: number }; hasRing: boolean; phase: string }>(
    heir,
    `(() => { const d = window.__range.duel(); const v = d.view; return { roster: d.botRoster, kits: ${kitsOf}, figures: [...d.remotes.keys()].filter((id) => id >= 100).length, ring: { phase: v.phase, state: v.state, timeLeft: v.timeLeft }, hasRing: !!d.ring, phase: d.phase }; })()`
  );
  // What the takeover has to carry is each bot's kit, not freeze it: a bot goes on looting through the few seconds
  // of it, and whole kits compared (armour included, one change allowed) failed on two bots that had each gone up an
  // armour tier with the same gun (2026-09-29). The guns the same (one swapped up allowed), and nobody's gun or armour
  // lost, is a kit carried; a reset or a lost kit still fails.
  const part = (k: string) => {
    const [, gun, armor] = k.split(":");
    return { gun, armor: Number(armor) };
  };
  const kitSame = after.kits.filter((k, i) => part(k).gun === part(kits[i] ?? "").gun).length;
  const kitLost = after.kits.filter((k, i) => (part(kits[i] ?? "").gun !== "" && part(k).gun === "") || part(k).armor < part(kits[i] ?? "").armor).length;
  check(
    `${label}: the same bots, each with its tier and squad and (nearly all) the kit it had looted, run by the new host`,
    roster.length === 6 && after.roster.join() === roster.join() && after.figures === 0 && kitSame >= kits.length - 1 && kitLost === 0 && kits.filter((k) => k.split(":")[1]).length >= 4 && after.phase === "fight",
    JSON.stringify({ roster, after: after.roster, kits, afterKits: after.kits, figures: after.figures })
  );
  const expected = ring.timeLeft - (Date.now() - ringAt) / 1000;
  check(
    `${label}: the ring is where it was on its plan, its clock running on`,
    after.hasRing && after.ring.phase === ring.phase && after.ring.state === "closing" && ring.state === "closing" && Math.abs(after.ring.timeLeft - expected) < 2.5,
    JSON.stringify({ before: ring, after: after.ring, expected })
  );
  const botFlow = await ev<number>(other, "Math.max(...[...window.__range.duel().remotes.values()].filter((r) => r.id >= 100 && r.alive).map((r) => performance.now() / 1000 - r.lastHeard))");
  const otherRing = await ev<number>(other, "window.__range.duel().view.phase");
  // (a bot standing still is sent only as a keyframe, every 2 s)
  check(`${label}: the third friend hears from the bots and follows the new host's ring`, botFlow < 3 && otherRing === ring.phase, JSON.stringify({ botFlow, otherRing }));
  await close();
}

/**
 * The broker gone for a moment in the middle of a Join (link.ts, net.json broker). The host's page loses its broker
 * socket a moment after the friend's Join, mid-handshake: it ended the join ("Connection failed (webrtc)") and could
 * end the host's lobby too, with "No match with that code" on the host's own screen (a probe on our own server,
 * 2026-09-29). Now the host's lobby waits for the broker and the friend's page tries once more.
 */
async function brokerBlipTest(browser: Browser, query: string, afterMs: number): Promise<void> {
  const REC = `(() => { const W = window.WebSocket; window.__sockets = []; window.WebSocket = class extends W { constructor(...a) { super(...a); window.__sockets.push(this); } }; })()`;
  const host = await open(browser, query, BASE, REC);
  const guest = await open(browser, query);
  const label = `a broker blip ${afterMs} ms into a friend's Join`;
  await ev(host, `document.getElementById("duelHost").click()`);
  let code = "";
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 30000 });
    code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
  } catch {
    console.log(`  --  ${label}: skipped, no code from the broker`);
    await host.close();
    await guest.close();
    return;
  }
  await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
  await sleep(afterMs);
  const cut = await ev<number>(host, `(() => { const s = window.__sockets.filter((x) => /peerjs/.test(x.url) && x.readyState === 1); s.forEach((x) => x.close()); return s.length; })()`);
  const inBoth = await Promise.all([host, guest].map((p) => p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 45000 }).then(() => true, () => false)));
  const said = await Promise.all([host, guest].map((p) => ev<string>(p, `document.getElementById("duelStatus").textContent`)));
  check(`${label}: the friend still gets in, and the host's lobby is not ended by it`, cut === 1 && inBoth.every(Boolean), JSON.stringify({ cut, inBoth, host: said[0].slice(0, 90), guest: said[1].slice(0, 90) }));
  for (const p of [guest, host]) {
    await ev(p, "window.__range.duel()?.leave()").catch(() => undefined);
    await p.close();
  }
}

/**
 * Getting back in: a guest whose connection drops mid-match (no goodbye)
 * keeps playing, the host holds the seat, and the guest is back on it with
 * the same code and the seat's key; a seat nobody comes back for is given up,
 * and so is a guest that cannot get back.
 */
async function rejoinTest(browser: Browser, query: string): Promise<void> {
  const host = await open(browser, query);
  const guest = await open(browser, query);
  await ev(host, brRow("duo", 2));
  await ev(host, `(() => { document.getElementById("brSides").value = "together"; document.getElementById("duelMode").value = "br"; document.getElementById("duelPlayers").value = "2"; document.getElementById("duelHost").click(); })()`);
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
    for (const p of [host, guest]) await pressPlay(p);
    for (const p of [host, guest]) await p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 45000 });
  } catch {
    check("getting back in: the match starts", false);
    await host.close();
    await guest.close();
    return;
  }
  await ev(host, "window.__range.duel().holdFire = true");
  // the guest's connection drops: the host holds the seat and takes the guest back on it (over two tabs that is at once)
  await ev(host, "(() => { const d = window.__range.duel(); const take = d.rejoin.bind(d); window.__backs = []; d.rejoin = (l, id) => { const held = d.held.has(id); const ok = take(l, id); window.__backs.push({ id, held, ok }); return ok; }; })()");
  await ev(guest, "(() => { window.__match = window.__range.duel(); window.__range.duel().dropHostLink(); })()");
  const back = await guest.waitForFunction("window.__range.duel()?.reconnectUntil === null", { polling: 200, timeout: 20000 }).then(() => true, () => false);
  const backs = await ev<Array<{ id: number; held: boolean; ok: boolean }>>(host, "window.__backs");
  const same = await ev<{ same: boolean; phase: string }>(guest, "({ same: window.__range.duel() === window.__match, phase: window.__range.duel()?.phase })");
  check("getting back in: a dropped connection holds the guest's seat, the guest's match keeps going, and it is taken back on that seat", backs.length === 1 && backs[0].id === 1 && backs[0].held && backs[0].ok && same.same && same.phase === "fight", JSON.stringify({ backs, same }));
  await ev(host, "(() => { const d = window.__range.duel(); delete d.rejoin; })()");
  const seat = await ev<{ linked: boolean; held: boolean }>(host, "(() => { const d = window.__range.duel(); return { linked: d.links.has(1), held: d.held.has(1) }; })()");
  // traffic both ways again: the guest's state reaches the host, the host's ring reaches the guest
  const t0 = await ev<number>(host, "window.__range.duel().remotes.get(1).samples.length");
  await sleep(1500);
  const flow = await Promise.all([
    ev<number>(host, "window.__range.duel().remotes.get(1).lastHeard"),
    ev<number>(guest, "performance.now() / 1000 - window.__range.duel().remotes.get(0).lastHeard"),
  ]);
  const hostNow = await ev<number>(host, "performance.now() / 1000");
  check("getting back in: the guest is back on its own seat, and the two hear each other again", back && seat.linked && !seat.held && hostNow - flow[0] < HEARD && flow[1] < HEARD, JSON.stringify({ back, seat, t0, sinceGuest: hostNow - flow[0], sinceHost: flow[1] }));
  // a seat nobody comes back for: the host gives it up once the hold is over
  // (the host turns the guest's attempts away, so it cannot get back this time)
  await ev(host, "(() => { window.__range.duel().rejoin = () => false; })()");
  await ev(guest, "window.__range.duel().dropHostLink()");
  await host.waitForFunction("window.__range.duel().held.has(1)", { polling: 50, timeout: 4000 }).catch(() => undefined);
  await ev(host, "(() => { const d = window.__range.duel(); d.held.set(1, performance.now() / 1000 - 1); })()");
  const gone = await host.waitForFunction("!window.__range.duel().held.has(1) && !window.__range.duel().links.has(1)", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  // and a guest that cannot get back is out once its own clock runs out
  await ev(guest, "(() => { const d = window.__range.duel(); if (d && d.reconnectUntil !== null) d.reconnectUntil = performance.now() / 1000 - 1; })()");
  const out = await guest.waitForFunction("window.__range.duel() === null", { polling: 100, timeout: 6000 }).then(() => true, () => false);
  const said = await ev<string>(guest, `document.getElementById("duelStatus").textContent`);
  check("getting back in: a seat nobody comes back for is given up, and a guest that cannot get back is out", gone && out && /Lost the connection/.test(said), JSON.stringify({ gone, out, said }));
  await host.close();
  await guest.close();
}

/**
 * Squads of friends: four friends in duos, split, are two duos against each
 * other and the bots. Each duo's first leads it down; a friend of the other
 * duo is an enemy (a plate, the damage, the map); a player down whose mate is
 * then knocked goes out with them; and the duo left standing wins, the other
 * placed where it went out.
 */
async function brSquadsTest(browser: Browser, query: string): Promise<void> {
  const pages: Page[] = [];
  const host = await open(browser, query);
  pages.push(host);
  await ev(host, brRow("duo", 2));
  await ev(host, `(() => { document.getElementById("brSides").value = "split"; document.getElementById("duelMode").value = "br"; document.getElementById("duelPlayers").value = "4"; document.getElementById("duelHost").click(); })()`);
  let code = "";
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    for (let i = 0; i < 3; i++) {
      const g = await open(browser, query);
      pages.push(g);
      await ev(g, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
      await sleep(600);
    }
    for (const p of pages) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  } catch {
    check("squads of friends: four connect", false, code || "no code");
    for (const p of pages) await p.close();
    return;
  }
  // by id: 0 and 1 are one duo, 2 and 3 the other
  const ids = await Promise.all(pages.map((p) => ev<number>(p, "window.__range.duel().id")));
  const by = (id: number) => pages[ids.indexOf(id)];
  const sides = await Promise.all(pages.map((p) => ev<{ id: number; allies: number[]; jm: number | null; lead: boolean; total: number }>(p, `(() => { const d = window.__range.duel(); return { id: d.id, allies: [0, 1, 2, 3].filter((i) => d.isAlly(i)), jm: d.jumpmaster(), lead: d.isJumpmaster(), total: d.squadsTotal }; })()`)));
  const want = (s: { id: number; allies: number[]; jm: number | null; lead: boolean; total: number }) => {
    const mate = s.id ^ 1;
    const first = s.id & 2;
    return s.allies.length === 1 && s.allies[0] === mate && s.lead === (s.id === first) && s.jm === (s.id === first ? null : first) && s.total === 3;
  };
  check("squads of friends: split into two duos by join order, each led down by its first, three squads with the bots'", sides.every(want), JSON.stringify(sides));
  for (const p of pages) await pressPlay(p);
  const landed = await Promise.all(pages.map((p) => p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 45000 }).then(() => true, () => false)));
  if (!landed.every(Boolean)) {
    check("squads of friends: all four land", false, JSON.stringify(landed));
    for (const p of pages) await p.close();
    return;
  }
  await ev(host, "window.__range.duel().holdFire = true");
  await sleep(1500);
  // the host's map shows its own duo, not the other one
  const mapped = await ev<number>(host, "window.__range.duel().hud().br.mates.length");
  // the host knocks player 2: player 3 is up, so 2 is down, not out
  const hit = (to: number) => ev(host, `(() => { const d = window.__range.duel(); const r = d.remotes.get(${to}); d.localHit(r, 250, true); })()`);
  await hit(2);
  const down2 = await by(2).waitForFunction("window.__range.duel().downed && window.__range.duel().alive", { polling: 100, timeout: 5000 }).then(() => true, () => false);
  check("squads of friends: the host's shots hurt the other duo, and one of it is down with its mate up", down2, `the host's map shows ${mapped} mate(s)`);
  check("squads of friends: the map shows your duo only", mapped === 1, `${mapped}`);
  // then 3: nobody of that duo is up, so 3 is out, and 2, down, goes with it
  await hit(3);
  const out = await Promise.all([2, 3].map((id) => by(id).waitForFunction("!window.__range.duel().alive", { polling: 100, timeout: 6000 }).then(() => true, () => false)));
  check("squads of friends: the last of a duo knocked is out, and its mate on the floor goes with it", out.every(Boolean), JSON.stringify(out));
  const going = await ev<string>(host, "window.__range.duel().phase");
  check("squads of friends: the match goes on for the duo still standing", going === "fight", going);
  // the bots go: the host's duo is the one left
  await ev(host, `(() => { const d = window.__range.duel(); for (let k = 0; k < 4; k++) for (const b of d.bots) if (b.bot.remote.alive) d.onHitOther(b.bot.remote.id, 999, true, d.id); })()`);
  const ends = await Promise.all(pages.map((p) => p.waitForFunction(`window.__range.duel()?.phase === "matchEnd"`, { polling: 100, timeout: 10000 }).then(() => true, () => false)));
  const placed = await Promise.all(pages.map((p) => ev<{ id: number; p: number | null } | null>(p, "(() => { const d = window.__range.duel(); return d ? { id: d.id, p: d.placement } : null; })()")));
  const right = placed.every((x) => !!x && x.p === (x.id < 2 ? 1 : 3));
  check("squads of friends: the host's duo wins, and the other duo placed third of three, both of it", ends.every(Boolean) && right, JSON.stringify({ ends, placed }));
  for (const p of pages) await p.close();
}

/**
 * Solo with friends: everyone against everyone. Friends in a solo battle
 * royale could not hurt each other, and two left alive both "won" when the
 * bots were gone. The host knocks the guest (in solo a knock is the end), the
 * match goes on, and once the bots are gone the host has won and the guest
 * placed last of the seven sides.
 */
async function brSoloTest(browser: Browser, query: string): Promise<void> {
  const host = await open(browser, query);
  const guest = await open(browser, query);
  await ev(host, brRow("solo", 5));
  await ev(host, `(() => { document.getElementById("duelMode").value = "br"; document.getElementById("duelHost").click(); })()`);
  let code = "";
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  } catch {
    check("solo with a friend: both connect", false, code || "no code");
    await host.close();
    await guest.close();
    return;
  }
  for (const p of [host, guest]) await pressPlay(p);
  const landed = await Promise.all([host, guest].map((p) => p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 40000 }).then(() => true, () => false)));
  if (!landed.every(Boolean)) {
    check("solo with a friend: both land", false, JSON.stringify(landed));
    await host.close();
    await guest.close();
    return;
  }
  await ev(host, "window.__range.duel().holdFire = true");
  const sides = await Promise.all([host, guest].map((p, i) => ev<{ team: string; ally: boolean }>(p, `({ team: window.__range.duel().team.id, ally: window.__range.duel().isAlly(${i === 0 ? 1 : 0}) })`)));
  check("solo with a friend: both play solo, and the other human is an opponent, not a mate", sides.every((x) => x.team === "solo" && !x.ally), JSON.stringify(sides));
  // the host knocks the guest: in solo that is the end of them
  await ev(host, `(() => { const d = window.__range.duel(); const r = [...d.remotes.values()].find((x) => x.id === 1); d.localHit(r, 250, true); })()`);
  const out = await guest.waitForFunction("!window.__range.duel().alive", { polling: 100, timeout: 6000 }).then(() => true, () => false);
  check("solo with a friend: the host's shots hurt the guest, and the knock is the end", out);
  await sleep(1000);
  const going = await ev<string>(host, "window.__range.duel().phase");
  check("solo with a friend: the match goes on for the host", going === "fight", going);
  // and the guest, out of it, watches whoever is left rather than a black
  // screen: their squad first, then the nearest, and they choose which
  // (docs/NEXT_STEPS.md item 7)
  {
    await ev(guest, "window.__range.skipKillcam()");
    await ev(guest, "window.__range.closeRecap()");
    await sleep(500);
    const spec = await ev<{ name: string; of: number; at: number; list: string[] } | null>(
      guest,
      `(() => { const r = window.__range; const s = r.hud.last?.spectating ?? null; const d = r.duel();
        return s ? { name: s.name, of: s.of ?? 1, at: s.at ?? 1, list: d.spectateList().map((x) => x.name) } : { name: "", of: 0, at: 0, list: d ? d.spectateList().map((x) => x.name) : [] }; })()`
    );
    check("out of a battle royale: you watch one of those still standing, and the HUD says whose eyes", !!spec && spec.list.length > 1 && spec.name === spec.list[0], JSON.stringify(spec));
    await ev(guest, "(() => { window.__range.input.locked = true; })()");
    await guest.mouse.down();
    await guest.mouse.up();
    await sleep(300);
    const next = await ev<{ name: string; at: number } | null>(guest, `(() => { const s = window.__range.hud.last?.spectating ?? null; return s ? { name: s.name, at: s.at ?? 1 } : null; })()`);
    check("out of a battle royale: a click moves you along the list of who is left", !!next && !!spec && next.name !== spec.name, JSON.stringify({ was: spec?.name, now: next?.name }));
    await ev(guest, "(() => { window.__range.input.locked = false; })()");
  }
  // the bots go: one side is left, the host's
  await ev(host, `(() => { const d = window.__range.duel(); for (const b of d.bots) if (b.bot.alive) d.onHitOther(b.bot.remote.id, 999, true, d.id); })()`);
  const ends = await Promise.all([host, guest].map((p) => p.waitForFunction(`window.__range.duel()?.phase === "matchEnd"`, { polling: 100, timeout: 8000 }).then(() => true, () => false)));
  const placed = await Promise.all([host, guest].map((p) => ev<{ p: number | null; of: number } | null>(p, "(() => { const d = window.__range.duel(); return d ? { p: d.placement, of: d.squadsTotal } : null; })()")));
  check("solo with a friend: the host wins, and the guest placed last of the seven sides", ends.every(Boolean) && placed[0]?.p === 1 && placed[1]?.p === 7 && placed[1]?.of === 7, JSON.stringify({ ends, placed }));
  // one table at the end, both lines on it
  const table = await host.waitForFunction("(window.__range.hud.last?.summary?.table ?? []).length === 2", { polling: 100, timeout: 6000 }).then(() => true, () => false);
  const rows = await ev(host, "window.__range.hud.last?.summary?.table ?? null");
  check("the end table: the host's card lists both players, placed", table, JSON.stringify(rows));
  // the group stays together: once the end screen is over nobody needs a new code for the next match
  const back = await Promise.all([host, guest].map((p) => p.waitForFunction("window.__range.duel() === null", { polling: 200, timeout: 30000 }).then(() => true, () => false)));
  const offer = await ev<{ shown: boolean; text: string }>(host, `(() => { const b = document.getElementById("duelAgain"); return { shown: !b.hidden, text: b.textContent }; })()`);
  const told = await ev<string>(guest, `document.getElementById("duelStatus").textContent`);
  check("the group: back in the range, the host is offered Play again with both, and the guest told the group is still together", back.every(Boolean) && offer.shown && offer.text.includes("2") && told.includes("still together"), JSON.stringify({ back, offer, told }));
  // tonight's tally: the same on both pages, the host with the win
  const tallies = await Promise.all([host, guest].map((p) => ev<string[]>(p, `[...document.querySelectorAll("#tonight [data-name]")].map((r) => r.textContent)`)));
  const same = tallies[0].join("|") === tallies[1].join("|");
  check("tonight's tally: both pages show the same table of the two, one match played, one win for the winner", same && tallies[0].length === 2 && tallies[0].every((t) => /1 played/.test(t)) && tallies[0].filter((t) => /1 win /.test(t)).length === 1, JSON.stringify(tallies));
  await ev(host, `(() => { document.getElementById("duelMode").value = "tdm"; document.getElementById("duelMode").dispatchEvent(new Event("change")); document.getElementById("duelAgain").click(); })()`);
  const again = await Promise.all([host, guest].map((p) => p.waitForFunction(`window.__range.duel()?.modeKind === "tdm"`, { polling: 200, timeout: 15000 }).then(() => true, () => false)));
  const who = await Promise.all([host, guest].map((p) => ev<{ role: string; id: number } | null>(p, "(() => { const d = window.__range.duel(); return d ? { role: d.role, id: d.id } : null; })()")));
  const kept = await Promise.all([host, guest].map((p) => ev<number>(p, `document.querySelectorAll("#tonight [data-name]").length`)));
  check("tonight's tally: Play again keeps it (a new code would start it over)", kept.every((n) => n === 2), JSON.stringify(kept));
  check("the group: the host's Play again puts both straight into a team deathmatch, on the links they had", again.every(Boolean) && who[0]?.role === "host" && who[1]?.role === "guest" && who[1]?.id === 1, JSON.stringify({ again, who }));
  await host.close();
  await guest.close();
}

/**
 * A host whose tab is hidden (alt-tabbed to paste the invite) keeps the
 * match running. Chrome slows a background tab's timers to about one a
 * second, and the loop ran on one, so the host's bots, ring and state
 * packets went out at one frame a second. Headless Chrome here is launched
 * with that throttling off, so the host's page does it itself: it reports the
 * tab hidden and slows its own timers to a second, as Chrome would. The
 * worker the game ticks from while hidden is not slowed.
 */
const FAKE_HIDDEN = `(() => {
  window.__hidden = false;
  Object.defineProperty(document, "hidden", { get: () => window.__hidden, configurable: true });
  Object.defineProperty(document, "visibilityState", { get: () => (window.__hidden ? "hidden" : "visible"), configurable: true });
  const st = window.setTimeout.bind(window);
  window.setTimeout = (fn, ms, ...a) => st(fn, window.__hidden ? Math.max(1000, ms || 0) : ms, ...a);
})()`;
async function hiddenHostTest(browser: Browser, query: string): Promise<void> {
  const host = await open(browser, query, BASE, FAKE_HIDDEN);
  const guest = await open(browser, query);
  await ev(host, `document.getElementById("duelHost").click()`);
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  } catch {
    check("a hidden host: the 1v1 connects", false);
    await host.close();
    await guest.close();
    return;
  }
  await sleep(1000);
  await ev(host, `(() => { window.__hidden = true; document.dispatchEvent(new Event("visibilitychange")); })()`);
  await sleep(500);
  const rate = async (): Promise<number> => {
    const f0 = await ev<number>(host, "window.__range.frames()");
    await sleep(3000);
    return ((await ev<number>(host, "window.__range.frames()")) - f0) / 3;
  };
  const perSecond = await rate();
  check("a hidden host: the match keeps running at 30 frames a second, not one", perSecond >= 20 && perSecond <= 45, `${perSecond.toFixed(1)} frames a second while hidden`);
  // the old way, for the proof that this measures what it says: the same
  // page with no worker falls back to its own (slowed) timer
  await ev(host, `(() => { window.__hidden = false; document.dispatchEvent(new Event("visibilitychange")); window.Worker = undefined; window.__hidden = true; document.dispatchEvent(new Event("visibilitychange")); })()`);
  await sleep(1500);
  const slowed = await rate();
  check("and without the worker it would have crawled at the background tab's pace", slowed <= 2, `${slowed.toFixed(1)} frames a second on the page's own timer`);
  await ev(host, `(() => { window.__hidden = false; document.dispatchEvent(new Event("visibilitychange")); })()`);
  await host.close();
  await guest.close();
}

/**
 * Team deathmatch with the friends split: two humans on two sides, no bots,
 * so it is their own 1v1 as teams. Every human used to be on one side, so a
 * group of friends could never fight each other in a team mode.
 */
async function modesSplitTest(browser: Browser, query: string): Promise<void> {
  const host = await open(browser, query);
  const guest = await open(browser, query);
  await ev(host, `(() => { document.getElementById("duelMode").value = "tdm"; document.getElementById("modeBots").value = "0"; document.getElementById("modeSides").value = "split"; document.getElementById("duelHost").click(); })()`);
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  } catch {
    check("split sides: both connect", false);
    await host.close();
    await guest.close();
    return;
  }
  for (const p of [host, guest]) await pressPlay(p);
  const live = await Promise.all([host, guest].map((p) => p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 20000 }).then(() => true, () => false)));
  const sides = await Promise.all([host, guest].map((p, i) => ev<{ split: boolean; mine: number; other: number; ally: boolean; bots: number }>(p, `(() => { const d = window.__range.duel(); return { split: d.split, mine: d.teamFor(d.id), other: d.teamFor(${i === 0 ? 1 : 0}), ally: d.isAlly(${i === 0 ? 1 : 0}), bots: d.avatars.length - 1 }; })()`)));
  check("split sides: the two friends are on two sides, opponents, and no bots were asked for", live.every(Boolean) && sides.every((x) => x.split && x.mine !== x.other && !x.ally), JSON.stringify(sides));
  const hp0 = await ev<number>(guest, "window.__range.duel().health + window.__range.duel().shield");
  await ev(host, `(() => { const d = window.__range.duel(); const r = [...d.remotes.values()].find((x) => x.id === 1); d.localHit(r, 30, false); })()`);
  const hurt = await guest.waitForFunction(`window.__range.duel().health + window.__range.duel().shield < ${hp0}`, { polling: 100, timeout: 4000 }).then(() => true, () => false);
  check("split sides: the host's hit on the other side lands", hurt);
  await host.close();
  await guest.close();
}

/**
 * Start with those in: a match made for four with two friends in starts for
 * three when the host says so, and the code takes nobody after. A host who
 * made a match for eight with seven in used to wait for ever.
 */
async function lobbyShortTest(browser: Browser, query: string): Promise<void> {
  const pages: Page[] = [];
  const host = await open(browser, query);
  pages.push(host);
  await ev(host, `(() => { document.getElementById("duelMode").value = "ffa"; document.getElementById("duelPlayers").value = "4"; document.getElementById("modeBots").value = "1"; document.getElementById("duelHost").click(); })()`);
  let code = "";
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
  } catch {
    check("start with those in: the host gets a code", false);
    for (const p of pages) await p.close();
    return;
  }
  for (let i = 0; i < 2; i++) {
    const g = await open(browser, query);
    pages.push(g);
    await ev(g, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    await sleep(600);
  }
  await Promise.all(pages.map((p) => p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 25000 }).catch(() => undefined)));
  await ev(host, "window.__range.toMenu()");
  await sleep(300);
  const btn = await ev<{ shown: boolean; text: string }>(host, `(() => { const b = document.getElementById("duelStartNow"); return { shown: !b.hidden, text: b.textContent }; })()`);
  check("start with those in: two of three friends in, the host is offered to start with three", btn.shown && btn.text === "Start with 3", JSON.stringify(btn));
  // the roster: both friends by name, and a kick for each
  await sleep(700);
  const roster = await ev<number>(host, `document.querySelectorAll("#duelRoster [data-kick]").length`);
  check("the lobby's roster: the host sees each friend in, with a kick", roster === 2, `${roster} rows`);
  // the host takes the second friend out: they are told, and the host can start with two
  await ev(host, `document.querySelector('#duelRoster [data-kick="2"]').click()`);
  const kicked = await pages[2].waitForFunction("window.__range.duel() === null", { polling: 200, timeout: 8000 }).then(() => true, () => false);
  const told = await ev<string>(pages[2], `document.getElementById("duelStatus").textContent`);
  await sleep(700);
  const btn2 = await ev<string>(host, `document.getElementById("duelStartNow").textContent`);
  check("the lobby's kick: the friend is out and told so, and the host is offered to start with two", kicked && /took you out/.test(told) && btn2 === "Start with 2", JSON.stringify({ kicked, told, btn2 }));
  await pages[2].close();
  pages.splice(2, 1);
  await ev(host, `document.getElementById("duelStartNow").click()`);
  for (const p of pages) await pressPlay(p);
  const going = await Promise.all(pages.map((p) => p.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 25000 }).then(() => true, () => false)));
  const count = await ev<number>(host, "window.__range.duel()?.players ?? -1");
  const dbg = going.every(Boolean) ? "" : JSON.stringify(await Promise.all(pages.map((p) => ev(p, "(() => { const d = window.__range.duel(); return d ? { phase: d.phase, players: d.players, links: d.links?.size, ready: d.ready, rs: [...d.remotes.values()].filter((r) => r.id < 100).map((r) => [r.id, r.ready]), status: document.getElementById('duelStatus').textContent.slice(0, 80) } : { none: document.getElementById('duelStatus').textContent.slice(0, 80) }; })()"))));
  check("start with those in: the match starts for the two who are in", going.every(Boolean) && count === 2, JSON.stringify({ going, count }) + dbg);
  const late = await open(browser, query);
  pages.push(late);
  await ev(late, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
  await sleep(3000);
  const lateIn = await ev<boolean>(late, "window.__range.duel() !== null");
  check("start with those in: the code takes nobody after it", !lateIn);
  await ev(host, "window.__range.duel()?.leave()");
  for (const p of pages) await p.close();
}

/**
 * Bot squads act as squads: in trios a squad follows its first bot, so its
 * members stay together after landing rather than each wandering off along
 * the graph on its own.
 */
async function botSquadsTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  await ev(page, brRow("trio", 6));
  await ev(page, `(() => { document.getElementById("brStart").value = "loadout"; document.getElementById("goBr").click(); document.getElementById("startMode").click(); })()`);
  const fought = await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 40000 }).then(() => true, () => false);
  if (!fought) {
    check("bot squads: the match starts", false);
    await page.close();
    return;
  }
  // nobody fights: this is about where they walk
  await ev(page, "(() => { const d = window.__range.duel(); d.holdFire = true; window.__range.player.teleport(0, 60, 500, 0); })()");
  // wait for them all down and walking
  await page.waitForFunction("window.__range.duel().bots.every((b) => b.landed)", { polling: 250, timeout: 30000 }).catch(() => undefined);
  let together = 0;
  let samples = 0;
  // the squads found apart, where each of their bots was (x, height, z), so a failure says where they stuck
  const apart: string[] = [];
  for (let i = 0; i < 20; i++) {
    // 1.5 s of the game's own time, not the wall's: a page slowed by a busy
    // machine runs fewer game seconds a real one, and a squad regrouping after
    // the drop was sampled before it had walked the distance (the release run,
    // sharing the machine with two others, saw 6 of 40 together where a run
    // alone saw 40 of 40)
    const t0 = await ev<number>(page, "window.__range.gameTime()");
    await page.waitForFunction(`window.__range.gameTime() >= ${t0 + 1.5}`, { polling: 100, timeout: 20000 }).catch(() => undefined);
    // only a squad out of a fight: one that has seen someone lately breaks formation to fight, as it should
    const spread = await ev<Array<[number, string]>>(page, `(() => { const d = window.__range.duel(); const now = performance.now() / 1000; const by = new Map(); const fighting = new Set();
      for (const b of d.bots) { if (!b.bot.alive) continue; if (!by.has(b.team)) by.set(b.team, []); by.get(b.team).push(b.bot.pos); if ((b.bot.lastSeen && now - b.bot.lastSeen.at < 8) || b.bot.travel) fighting.add(b.team); }
      return [...by.entries()].filter(([t]) => !fighting.has(t)).map(([t, ps]) => { let m = 0; for (const a of ps) for (const c of ps) m = Math.max(m, Math.hypot(a.x - c.x, a.z - c.z)); return [m, "squad " + t + ": " + ps.map((p) => p.x.toFixed(0) + "," + p.y.toFixed(1) + "," + p.z.toFixed(0)).join(" / ")]; }); })()`);
    for (const [m, where] of spread) {
      samples++;
      if (m < 25) together++;
      else apart.push(`${m.toFixed(0)} m, ${where}`);
    }
  }
  // A squad walks with some slack (a follower closes in only past 12 m), so it
  // is not every sample: measured 60 to 100 per cent out of a fight with the
  // squad following its first bot, and nearer 37 without. A squad with a bot
  // in the air off a launch pad or on a rope is left out with the fighting
  // ones: it is apart for the length of the ride, then together again.
  check("bot squads: each squad out of a fight keeps together (within 25 m, most of the time)", samples >= 8 && together / samples >= 0.55, `${together} of ${samples} squad samples together${apart.length ? `; apart, last seen: ${apart.slice(-4).join("; ")}` : ""}`);
  await botKnockSteps(page);
  await ev(page, "window.__range.duel()?.leave()");
  await page.close();
}

/**
 * A trio's bot knocked with its squad up goes down, not out; a mate picks it
 * up; one left to bleed dies of it; and a squad with nobody standing takes
 * its downed with it. The host is left out of the bots' sight (the Gulag's
 * list) so nothing breaks a revive off, and the other squad is taken out
 * first so nobody else does either.
 */
async function botKnockSteps(page: Page): Promise<void> {
  const state = `(() => { const d = window.__range.duel(); return d.bots.map((b) => ({ id: b.bot.remote.id, team: b.team, alive: b.bot.remote.alive, down: !!b.down, standing: b.bot.alive && !b.down, hp: b.bot.dummy.health })); })()`;
  type Row = { id: number; team: number; alive: boolean; down: boolean; standing: boolean; hp: number };
  const hit = (id: number) => ev(page, `(() => { const d = window.__range.duel(); d.onHitOther(${id}, 999, false, d.id); })()`);
  await ev(page, "(() => { const d = window.__range.duel(); d.gulagIds.add(d.id); })()");
  let rows = await ev<Row[]>(page, state);
  const team = rows.find((r) => r.standing && rows.filter((o) => o.team === r.team && o.standing).length === 3)?.team;
  if (team === undefined) {
    check("bot knocks: a trio of bots all standing to test on", false, JSON.stringify(rows));
    return;
  }
  await finisherSteps(page, team);
  // the other squads out: every one of theirs hit until gone
  for (let k = 0; k < 8; k++) for (const r of (await ev<Row[]>(page, state)).filter((o) => o.team !== team && o.alive)) await hit(r.id);
  rows = await ev<Row[]>(page, state);
  const mine = rows.filter((r) => r.team === team);
  const [a, b, c] = mine.map((r) => r.id);
  await hit(a);
  const downed = (await ev<Row[]>(page, state)).find((r) => r.id === a);
  check("bot knocks: a trio's bot knocked with its squad up is down, not out", !!downed && downed.alive && downed.down, JSON.stringify(downed));
  // a mate beside it, nothing in sight: it kneels and picks it up in the revive's 5 s
  await ev(page, `(() => { const d = window.__range.duel(); const bs = d.bots; const A = bs.find((x) => x.bot.remote.id === ${a}); const B = bs.find((x) => x.bot.remote.id === ${b}); A.bot.pos.copy(B.bot.pos).add(new window.__range.THREE.Vector3(1, 0, 0)); })()`);
  const up = await page.waitForFunction(`(() => { const b = window.__range.duel().bots.find((x) => x.bot.remote.id === ${a}); return !b.down && b.bot.alive && b.bot.remote.alive; })()`, { polling: 200, timeout: 20000 }).then(() => true, () => false);
  const back = (await ev<Row[]>(page, state)).find((r) => r.id === a);
  check("bot knocks: a squad mate out of a fight walks over and revives it, back up on 20 health", up && !!back && back.hp > 0 && back.hp <= 25, JSON.stringify(back));
  // down again, left to bleed: the bleed-out ends it (its clock cut short here)
  await hit(a);
  await ev(page, `(() => { const b = window.__range.duel().bots.find((x) => x.bot.remote.id === ${a}); if (b.down) b.down.bleed = 0.3; })()`);
  const bled = await page.waitForFunction(`!window.__range.duel().bots.find((x) => x.bot.remote.id === ${a}).bot.remote.alive`, { polling: 100, timeout: 6000 }).then(() => true, () => false);
  check("bot knocks: a bot left down bleeds out", bled);
  // one down and the last standing gone: the squad is out, its downed with it
  await hit(b);
  const bDown = (await ev<Row[]>(page, state)).find((r) => r.id === b);
  await hit(c);
  const after = (await ev<Row[]>(page, state)).filter((r) => r.team === team);
  check("bot knocks: with nobody of the squad standing, its downed go with it", !!bDown?.down && after.every((r) => !r.alive), JSON.stringify({ bDown, after }));
}

/**
 * Finishers (src/game/finisher.ts) on a real knocked bot of a squad other
 * than `keep` (the one botKnockSteps goes on to use): the prompt offers it,
 * the key's path starts it, both figures play it, it ends in the kill and a
 * full shield, and on a second one a hit breaks it off with the bot still down.
 */
async function finisherSteps(page: Page, keep: number): Promise<void> {
  type Bot = { id: number; team: number; standing: boolean; down: boolean; alive: boolean; x: number; y: number; z: number };
  const bots = () => ev<Bot[]>(page, `window.__range.duel().bots.map((b) => ({ id: b.bot.remote.id, team: b.team, standing: b.bot.alive && !b.down, down: !!b.down, alive: b.bot.remote.alive, x: b.bot.pos.x, y: b.bot.pos.y, z: b.bot.pos.z }))`);
  const all = await bots();
  const team = all.find((r) => r.team !== keep && r.standing && all.filter((o) => o.team === r.team && o.standing).length === 3)?.team;
  if (team === undefined) {
    check("finisher: a second trio standing to test on", false, JSON.stringify(all));
    return;
  }
  const [x, y, z] = all.filter((r) => r.team === team).map((r) => r.id);
  // knocked (its mates up, so down, not out), frozen where it fell, and you a metre off it facing it
  const knockAndStand = async (id: number): Promise<void> => {
    await ev(page, `(() => { const d = window.__range.duel(); d.onHitOther(${id}, 999, false, d.id); })()`);
    await ev(page, `(() => { const R = window.__range; const b = R.duel().bots.find((o) => o.bot.remote.id === ${id}); b.bot.crawlSpeed = 0; const p = b.bot.pos; R.player.teleport(p.x + 1, p.y + 0.05, p.z, 90, 0); })()`);
    await page.waitForFunction("window.__range.player.onGround", { polling: 50, timeout: 3000 }).catch(() => undefined);
  };
  await knockAndStand(x);
  const offered = await ev<number | null>(page, "window.__range.finisher.target()");
  check("finisher: a knocked enemy in front of you is offered", offered === x, `${offered} (want ${x})`);
  await ev(page, "(() => { const d = window.__range.duel(); d.shield = 0; })()");
  const started = await ev<boolean>(page, "window.__range.finisher.start()");
  await sleep(300);
  const during = await ev<{ on: boolean; act: number; victimAct: boolean; third: boolean }>(page, "(() => { const s = window.__range.finisher.state(); return { ...s, third: window.__range.debugView?.third ?? null }; })()");
  check("finisher: it starts, your figure plays it for everyone and the one knocked takes it", started && during.on && during.act === 7 && during.victimAct, JSON.stringify(during));
  const ended = await page.waitForFunction("!window.__range.finisher.state().on", { polling: 100, timeout: 5000 }).then(() => true, () => false);
  const after = await ev<{ alive: boolean; done: number; shield: number; max: number }>(
    page,
    `(() => { const d = window.__range.duel(); const b = d.bots.find((o) => o.bot.remote.id === ${x}); return { alive: b.bot.remote.alive, done: window.__range.finisher.state().done, shield: d.shield, max: d.shieldMax }; })()`
  );
  check("finisher: it ends in the kill and your shield back to full", ended && !after.alive && after.done === 1 && after.max > 0 && after.shield === after.max, JSON.stringify(after));
  await sleep(300);
  const said = await ev<string[]>(page, "window.__range.spoken()");
  check("finisher: and you say so", said.includes("finish"), JSON.stringify(said));
  // the second: a hit on you part way through breaks it off, and they are still down
  await knockAndStand(y);
  const again = await ev<boolean>(page, "window.__range.finisher.start()");
  await sleep(400);
  await ev(page, `(() => { const d = window.__range.duel(); d.takeHit(10, ${z}, false, "r97", 5); })()`);
  await sleep(200);
  const broken = await ev<{ on: boolean; alive: boolean; down: boolean; done: number }>(
    page,
    `(() => { const d = window.__range.duel(); const b = d.bots.find((o) => o.bot.remote.id === ${y}); return { on: window.__range.finisher.state().on, alive: b.bot.remote.alive, down: !!b.down, done: window.__range.finisher.state().done }; })()`
  );
  check("finisher: a hit on you breaks it off, and the one you were finishing is still down", again && !broken.on && broken.alive && broken.down && broken.done === 1, JSON.stringify(broken));
}

/**
 * Phase 20 A2, the drawn frame: the owner saw "33.66666666666666" over a bot he finished. One HUD frame is drawn by
 * hand from the last real state, with SpeedKills' real fractions in every damage, health and shield field (a
 * tuned 11.16 round, a bot's part-refilled pool, a float's 42.00000000000001), and every string the HUD canvas
 * draws is collected. None may carry a decimal but the readouts that are decimals on purpose.
 */
async function skWholeNumbers(page: Page): Promise<void> {
  const got = await ev<{ bad: string[]; drawn: string[]; numbers: Array<{ amount: number; text: string }> }>(page, `(() => {
    const r = window.__range; const h = r.hud; const base = h.last; const drawn = [];
    const P = CanvasRenderingContext2D.prototype; const fill = P.fillText; const stroke = P.strokeText;
    P.fillText = function (t, ...a) { if (this.canvas.id === "hud") drawn.push(String(t)); return fill.call(this, t, ...a); };
    P.strokeText = function (t, ...a) { if (this.canvas.id === "hud") drawn.push(String(t)); return stroke.call(this, t, ...a); };
    const was = h.enabled; const kept = h.numbers.length; let numbers = [];
    h.enabled = true;
    try {
      const now = r.gameTime();
      const at = r.camera.position.clone().addScaledVector(new r.THREE.Vector3(0, 0, -1).applyQuaternion(r.camera.quaternion), 6);
      const key = {};
      for (let i = 0; i < 3; i++) h.addDamage(at.clone(), 11.16, "#ff4a3d", false, now, key);
      h.addDamage(at.clone().add(new r.THREE.Vector3(1.5, 0, 0)), 101 / 3, "#ff4a3d", true, now, {});
      numbers = h.damageNumbers.slice(kept).map((n) => ({ amount: n.amount, text: n.text }));
      const row = { id: 101, name: "BOT GRIM", killer: true, dealt: { damage: 40.66666666666667, hits: 3, heads: 0 }, taken: { damage: 531.16, hits: 3, heads: 0 }, guns: [{ name: "STRYDER", hits: 3, damage: 531.16, near: 12.34, far: 12.34 }], healed: null, left: { shield: 0.4, health: 0.3 } };
      h.draw(now, r.camera, { ...base, killcam: null, course: null, drill: null, trainer: null, tour: null, hacks: null, ability: null,
        stats: { ...base.stats, damage: 135.85606666673223, headshots: 4, lastTtk: null },
        vitals: { ...(base.vitals ?? {}), shield: 18.84, shieldMax: 50, health: 42.00000000000001, healthMax: 100 },
        recap: { killerId: 101, killerName: "BOT GRIM", byRing: false, rows: [row], totalTaken: 531.16, totalDealt: 40.66666666666667, at: now, age: 1, closeKey: "SPACE", killerCard: null },
        summary: { title: "#10 OF 10", good: false, rows: [["Kills", "0"], ["Damage", "41"]], xp: 0, lines: [], level: 1, bar: 0, levelUp: false, alpha: 1, table: [{ name: "YOU", kills: 0, damage: 40.66666666666667, place: 10, you: true }, { name: "FRIEND", kills: 2, damage: 211.5, place: 3, you: false }] } });
    } finally { h.enabled = was; h.last = base; h.numbers.length = kept; P.fillText = fill; P.strokeText = stroke; }
    const legit = (t) => /ms frame$/.test(t) || /cm\\/360/.test(t) || /TTK \\d+\\.\\d\\d$/.test(t);
    return { bad: drawn.filter((t) => /\\d\\.\\d/.test(t) && !legit(t)), drawn, numbers };
  })()`);
  const has = (t: string) => got.drawn.includes(t);
  check("sk numbers: no damage, health or shield number the HUD draws has a decimal", got.bad.length === 0, JSON.stringify([...new Set(got.bad)]));
  check("sk numbers: three 11.16s read 33 and keep 33.48 underneath; a finishing 33.667 reads 34", got.numbers[0]?.text === "33" && Math.abs(got.numbers[0].amount - 33.48) < 1e-9 && got.numbers[1]?.text === "34", JSON.stringify(got.numbers));
  check("sk numbers: the stats panel's DAMAGE, the health, the recap and the end table read whole", has("136   HS 4") && has("42") && !has("43") && has("YOU DEALT 41  \·  TOOK 531") && has("LEFT: 1 SHIELD \· 1 HEALTH") && has("212"), JSON.stringify(got.drawn.filter((t) => /\d/.test(t))));
}

/**
 * Phase 20 A2, through the bullets' own path: SpeedKills lands a round at its tuned damage. Every hit used to be
 * rounded down as it landed (dummy.ts, projectile.ts), so USSO's 7.8 dealt 7 to a dummy and to a board: 10% off
 * the time to kill the owner signed off. Six rounds on a range dummy take six times the tuned damage off and
 * read as one whole number; one round on a board deals the same 7.8.
 */
async function skHitsLand(page: Page): Promise<void> {
  await ev(page, `(() => { const r = window.__range; r.sk.setFusion(0, 0); r.loadout.setWeaponId(0, "r97"); })()`);
  await sleep(1600);
  const fireAt = (where: string) => ev(page, `(() => { const r = window.__range; const p = ${where}; const eye = r.player.eyePosition(); r.fireRound([p.x - eye.x, p.y - eye.y, p.z - eye.z]); })()`);
  const tally = "(() => { const s = window.__range.stats(); return { hits: s.hits, damage: s.damage }; })()";
  const gun = await ev<{ id: string; near: number; i: number } | null>(
    page,
    `(() => { const r = window.__range; const w = r.loadout.active.weapon; const d = r.dummies.find((x) => x.group.visible && !x.knocked); if (!d) return null; const p = d.group.position; r.player.teleport(p.x, 0, p.z + 6, 0, 0); return { id: w.id, near: w.damage.near, i: r.dummies.indexOf(d) }; })()`,
  );
  await sleep(300);
  const s0 = await ev<{ hits: number; damage: number }>(page, tally);
  for (let i = 0; i < 6 && gun; i++) {
    await fireAt(`r.dummies[${gun.i}].group.position.clone().setY(r.dummies[${gun.i}].group.position.y + 1.25)`);
    await sleep(90);
  }
  await sleep(500);
  const s1 = await ev<{ hits: number; damage: number }>(page, tally);
  const num = await ev<{ amount: number; text: string } | null>(page, "window.__range.hud.damageNumbers.at(-1) ?? null");
  const hits = s1.hits - s0.hits;
  const want = gun ? hits * gun.near : NaN;
  check(
    "sk hits: USSO's tuned 7.8 lands in full on a range dummy, six rounds taking six times it off, and the number over it reads whole",
    !!gun && gun.id === "r97" && gun.near % 1 !== 0 && hits === 6 && !!num && Math.abs(num.amount - want) < 1e-6 && Math.abs(s1.damage - s0.damage - want) < 1e-6 && num.text === String(Math.round(want)),
    JSON.stringify({ gun, hits, dealt: s1.damage - s0.damage, want, num }),
  );
  // a board: stood 8 m in front of its face, one round at its middle
  const board = await ev<{ x: number; y: number; z: number } | null>(
    page,
    `(() => { const r = window.__range; const t = r.targets.find((x) => x.kind === "board"); if (!t) return null; const p = t.hitMeshes[0].getWorldPosition(new r.THREE.Vector3()); r.player.teleport(p.x, 0, p.z + 8, 0, 0); return { x: p.x, y: p.y, z: p.z }; })()`,
  );
  await sleep(300);
  const b0 = await ev<{ hits: number; damage: number }>(page, tally);
  if (board) await fireAt(`new r.THREE.Vector3(${board.x}, ${board.y}, ${board.z})`);
  await sleep(500);
  const b1 = await ev<{ hits: number; damage: number }>(page, tally);
  check(
    "sk hits: and one round on a board deals the same tuned 7.8, not 7",
    !!board && !!gun && b1.hits - b0.hits === 1 && Math.abs(b1.damage - b0.damage - gun.near) < 1e-6,
    JSON.stringify({ board, hits: b1.hits - b0.hits, dealt: b1.damage - b0.damage, near: gun?.near }),
  );
}

/**
 * SpeedKills (docs/PHASE_18_PLAN_SPEEDKILLS.md), on a page that asks for it:
 * the front door, the ten guns, fusion, the health model, and every hack doing
 * what its card says. The rest of the suite is the legacy game's.
 */
/**
 * SpeedKills' soldier (Phase 21 S8), with the bought files here (they are local only; without them this is skipped
 * with a note): it renders; its head sits in the head's hit volume in every pose a head is shot in (S7: the volumes
 * follow its bones, dummy.ts followBones); figures of different operators, as bots are, wear different kits; and with
 * the files answering 404, as on a copy without them, the game falls back to the figures and guns of before.
 */
/**
 * The gun in your hands at 2048 on High and 1024 on the other presets (paidweapons.json textures2k; the owner,
 * 2026-09-28: "Yes raise the textures on high settings"): only the one gun, so the memory it costs is one gun's.
 */
async function heldTexTest(browser: Browser): Promise<void> {
  const sizes: Record<string, number> = {};
  for (const preset of ["high", "balanced"]) {
    const page = await open(browser, "?game=speedkills", BASE, `try { localStorage.setItem("range.quality", "${preset}"); } catch {}`);
    const ready = await page.waitForFunction("window.__range.loaded() && window.__range.paidGuns().ready", { polling: 250, timeout: 120000 }).then(() => true, () => false);
    if (!ready) {
      console.log("  --  the bought guns are not here, so the texture check is skipped");
      await page.close();
      return;
    }
    await ev(page, `(() => { const r = window.__range; r.loadout.give(0, "r97"); r.loadout.requestSwap(0, r.gameTime()); })()`);
    await gameSleep(page, 2.5);
    sizes[preset] = await ev<number>(
      page,
      `(async () => {
        const r = window.__range;
        const width = (root) => { let w = 0; root.traverse((o) => { if (!w && o.isMesh && o.material && o.material.map && o.material.map.image) w = o.material.map.image.width; }); return w; };
        let gun = null;
        r.viewModelRoot().traverse((o) => { if (o.userData && o.userData.paid && !gun) gun = o; });
        const t0 = performance.now();
        while (gun && !width(gun) && performance.now() - t0 < 10000) await new Promise((ok) => setTimeout(ok, 100));
        return gun ? width(gun) : 0;
      })()`,
    );
    await page.close();
  }
  check(
    "soldier guns: the gun in your hands wears its 2048 skin on High and its 1024 one on Balanced",
    sizes.high === 2048 && sizes.balanced === 1024,
    JSON.stringify(sizes),
  );
}

async function soldierTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?game=speedkills");
  const here = await ev<boolean>(page, `fetch(${JSON.stringify(soldierCfg.model)}, { method: "HEAD" }).then((r) => r.ok && !(r.headers.get("content-type") ?? "").includes("text/html"), () => false)`);
  const ready = await page.waitForFunction("window.__range.soldierReady()", { polling: 250, timeout: 120000 }).then(() => true, () => false);
  if (!here && !ready) {
    console.log("  --  the soldier's files are not here (npm run paid makes them), so its checks are skipped");
    await page.close();
    return;
  }
  check("soldier: the bought soldier loads and its clips are carried over to it", ready);
  // the poses a head is shot in, each on a soldier, their heads against their head volumes (tools/soldier-hits.ts)
  const poses = HIT_POSES.map(([, p]) => ({ pitch: 0, look: "S0000000", ...p }));
  await ev(page, `(() => { const r = window.__range; r.player.teleport(0, 0, 0, 0, 0); r.figureLab(${JSON.stringify(poses)}, 4.5, 90); })()`);
  await gameSleep(page, 1.5);
  const heads = await ev<Array<{ soldier: boolean; n: number; inside: number; offset: number }>>(page, MEASURE_HEADS);
  const bad = heads.map((h, i) => ({ pose: HIT_POSES[i][0], ...h })).filter((h) => !h.soldier || h.n < 100 || h.offset > 0.02 || h.inside < 0.8);
  check(
    "soldier: its head sits in the head's hit volume standing, aiming, walking, running, sprinting, crouched and sliding (the middle within 20 mm, 80% of it inside)",
    heads.length === HIT_POSES.length && bad.length === 0,
    JSON.stringify(bad.length ? bad : heads.map((h) => `${Math.round(h.offset * 1000)} mm, ${Math.round(h.inside * 100)}%`)),
  );
  // bots wear their operator's soldier: figures of eight operators with no look of their own, at least three kits
  await ev(page, `window.__range.figureLab(${JSON.stringify(Array.from({ length: 8 }, () => ({ speed: 0, stance: "stand", pitch: 0 })))}, 6, 0)`);
  await gameSleep(page, 0.5);
  const kits = await ev<string[]>(page, "window.__range.labFigures().map((f) => f.mq?.soldier?.variant ?? '')");
  check("soldier: figures of different operators, as bots are, wear different kits (three or more of the four among eight)", kits.every(Boolean) && new Set(kits).size >= 3, kits.join(", "));
  await ev(page, "window.__range.figureLab([])");
  // one model a gun (paidweapons.json guns): the USSO wears its own, in its first skin as found and its third fused to
  // level 5 (the fusion level shows on the gun), and a figure holding it holds the same model; the Loadouts tab has no
  // picker for either
  const worn = await ev<{ inHand: string | null; skin: string | null; fused: string | null; figure: string | null; pickers: number }>(
    page,
    `(async () => {
      const r = window.__range;
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const t0 = performance.now();
      while (!r.paidGuns().ready && performance.now() - t0 < 30000) await wait(200);
      // in play, not the menu: the view moves the gun to its fusion level on a frame of play
      document.getElementById("overlay").classList.add("hidden");
      r.input.locked = true;
      r.loadout.give(0, "r97");
      r.setScript({ held: () => false, pressedNow: (a) => a === "slot1" }, null);
      await wait(1500);
      r.setScript(null);
      const held = r.paidGuns();
      r.loadout.setFusion(0, 5);
      // until it changes, 10 s at the most: it changes on the next frame of play, and a frame drawn in software took
      // 643 ms on its own (a fixed 600 ms wait failed under load with the first skin still on, 2026-09-30)
      const t1 = performance.now();
      while (r.paidGuns().skin === held.skin && performance.now() - t1 < 10000) await wait(50);
      const fused = r.paidGuns().skin;
      r.loadout.setFusion(0, 0);
      const [fig] = r.figureLab([{ speed: 0, stance: "stand", pitch: 0, weapon: "r97", look: "S0000000" }], 4, 0);
      await wait(600);
      const figure = fig?.mq?.gun?.userData?.paid ?? null;
      r.figureLab([]);
      return { inHand: held.inHand, skin: held.skin, fused, figure, pickers: document.querySelectorAll("#gunModel0, #gunSkin0").length };
    })()`,
  );
  check(
    "soldier guns: one model a gun, the USSO in its own (SciFiSMG02_2) in hand and on a figure, its first skin as found and its third at level 5, and no picker for either",
    worn.inHand === "SciFiSMG02_2" && /^SciFiSMG02A/.test(worn.skin ?? "") && /^SciFiSMG02C/.test(worn.fused ?? "") && worn.figure === "SciFiSMG02_2" && worn.pickers === 0,
    JSON.stringify(worn),
  );
  // the pack's own parts move in the hand (paidgun.ts PaidParts; the pack gives them split and moves none): CHOOCH's drum
  // turns a chamber a shot and its trigger stays back through a burst; a bought gun is aimed down its own sights, the
  // fitted optic not drawn on top of them (CHOOCH's and BOOG's); HAEFY takes out a magazine on a reload (its procedural
  // gun has none, and the bought one's stayed in)
  const moving = await ev<{ why: unknown; shots: number; pulled: number; drum: number; step: number; choochOptic: boolean | null; boogOptic: boolean | null; helixMag: number; helixOut: number }>(
    page,
    `(async () => {
      const r = window.__range;
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      // in game time: the e2e draws on the CPU (swiftshader), a few frames a second, and the parts move on frames
      const gameWait = async (s) => {
        const g0 = r.gameTime();
        const t0 = performance.now();
        while (r.gameTime() - g0 < s && performance.now() - t0 < 30000) await wait(20);
      };
      const hold = async (id) => {
        r.loadout.give(0, id);
        r.setScript({ held: () => false, pressedNow: (a) => a === "slot1" }, null);
        await gameWait(0.1);
        r.setScript(null);
        const t0 = performance.now();
        while (r.loadout.swapping && performance.now() - t0 < 30000) await wait(20);
        await gameWait(0.3);
      };
      await hold("lstar");
      const clip0 = r.loadout.active.state.clip;
      let pulled = 0;
      r.setScript({ held: (a) => a === "fire", pressedNow: () => false });
      // what holds the trigger, if a shot does not go (main.ts triggerWhy)
      const why = r.triggerWhy();
      const g0 = r.gameTime();
      const t0 = performance.now();
      while (r.gameTime() - g0 < 0.4 && performance.now() - t0 < 30000) {
        pulled = Math.max(pulled, r.gunParts()?.parts?.trigger ?? 0);
        await wait(10);
      }
      r.setScript(null);
      const shots = clip0 - r.loadout.active.state.clip;
      await gameWait(0.6);
      const choochAll = r.gunParts();
      const chooch = choochAll?.parts;
      await hold("sentinel");
      const boog = r.gunParts();
      await hold("3030");
      const rest = r.gunParts();
      r.debugView.reload = 0.2;
      await gameWait(0.3);
      const out = r.gunParts();
      r.debugView.reload = null;
      return { why, shots, pulled, drum: chooch?.drum ?? NaN, step: chooch?.drumStep ?? 0, choochOptic: choochAll?.opticShown ?? null, boogOptic: boog?.opticShown ?? null, helixMag: out?.mag ?? 0, helixOut: (rest?.magY ?? 0) - (out?.magY ?? 0) };
    })()`,
  );
  check(
    "soldier guns: the pack's parts move, CHOOCH's drum a chamber a shot with its trigger back through a burst; CHOOCH and BOOG aimed down their own sights, no fitted optic drawn over them; and HAEFY's magazine out on a reload",
    moving.shots >= 2 &&
      Math.abs(moving.drum - moving.shots * moving.step) < 0.02 &&
      moving.pulled > 0.3 &&
      moving.choochOptic === false &&
      moving.boogOptic === false &&
      moving.helixMag >= 1 &&
      moving.helixOut > 0.02,
    JSON.stringify(moving),
  );
  // the arms' upper arms' cut ends stay off the frame (fparms.ts cutOffFrame): one in it hung under the gun, at the hip
  // and in the sights, on the USSO and on BOOG (the owner: "the left is clearly fucked up")
  const elbows = await ev<Array<{ id: string; hip: { r: boolean; l: boolean } | null; ads: { r: boolean; l: boolean } | null }>>(
    page,
    `(async () => {
      const r = window.__range;
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const gameWait = async (s) => {
        const g0 = r.gameTime();
        const t0 = performance.now();
        while (r.gameTime() - g0 < s && performance.now() - t0 < 30000) await wait(20);
      };
      const out = [];
      // (ANAKIN, and HAEFY on BOOG's model: the USSO and BOOG are held by the bought arms where their files are here)
      for (const id of ["alternator_smg", "3030"]) {
        r.loadout.give(0, id);
        r.setScript({ held: () => false, pressedNow: (a) => a === "slot1" }, null);
        await gameWait(0.1);
        r.setScript(null);
        const t0 = performance.now();
        while (r.loadout.swapping && performance.now() - t0 < 30000) await wait(20);
        await gameWait(0.4);
        const hip = r.realArms() ? r.armCutsOff() : null;
        // aimed for real, not the view's debug hold, which leaves the gun camera at the hip's wider frame
        r.setScript({ held: (a) => a === "ads", pressedNow: () => false });
        await gameWait(0.5);
        const ads = r.realArms() ? r.armCutsOff() : null;
        r.setScript(null);
        await gameWait(0.3);
        out.push({ id, hip, ads });
      }
      return out;
    })()`,
  );
  // the signature guns phase out of the hands and in (gunfeel.json, phase.ts): a swap from the USSO to BOOG takes the
  // USSO's phase down to nothing and brings BOOG's up whole, the gun never dropped out of the frame; STRYDER has no feel
  const phased = await ev<{ low: Record<string, number>; end: { gun: string | null; phase: number; shown: boolean }; plain: { gun: string | null; phase: number }; frames: number }>(
    page,
    `(async () => {
      const r = window.__range;
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const gameWait = async (s) => {
        const g0 = r.gameTime();
        const t0 = performance.now();
        while (r.gameTime() - g0 < s && performance.now() - t0 < 30000) await wait(20);
      };
      r.loadout.give(0, "r97");
      r.loadout.give(1, "sentinel");
      r.setScript({ held: () => false, pressedNow: (a) => a === "slot1" }, null);
      await gameWait(0.1);
      r.setScript(null);
      let t0 = performance.now();
      while (r.loadout.swapping && performance.now() - t0 < 30000) await wait(20);
      await gameWait(0.3);
      // the swap itself (the slot keys read the real keyboard, which a test never touches)
      r.loadout.requestSwap(1, r.gameTime());
      // each gun's own lowest phase while it is the one in the hands
      const low = { r97: 1, sentinel: 1 };
      let frames = 0;
      t0 = performance.now();
      while (r.loadout.swapping && performance.now() - t0 < 30000) {
        const s = r.gunFeel();
        if (s.gun in low) low[s.gun] = Math.min(low[s.gun], s.phase);
        frames++;
        await wait(15);
      }
      await gameWait(0.3);
      const end = r.gunFeel();
      r.loadout.give(0, "autopistol");
      r.loadout.requestSwap(0, r.gameTime());
      t0 = performance.now();
      while (r.loadout.swapping && performance.now() - t0 < 30000) await wait(20);
      await gameWait(0.3);
      return { low, end, plain: r.gunFeel(), frames };
    })()`,
  );
  // BOOG recharges after a shot (gunfeel.json charge; its scope's ring and its glow show it): part way just after it,
  // whole a rechamber later; and an inspect makes it glow round its edges as the hack cards glow (the owner, 2026-09-29:
  // "that glow we are using on the hacks, not the janky looking highlight")
  const boog = await ev<{ after: number | null; later: number | null; glow: number }>(
    page,
    `(async () => {
      const r = window.__range;
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const gameWait = async (s) => {
        const g0 = r.gameTime();
        const t0 = performance.now();
        while (r.gameTime() - g0 < s && performance.now() - t0 < 30000) await wait(20);
      };
      r.loadout.give(0, "sentinel");
      r.loadout.requestSwap(0, r.gameTime());
      let t0 = performance.now();
      while (r.loadout.swapping && performance.now() - t0 < 30000) await wait(20);
      await gameWait(0.3);
      const clip0 = r.loadout.active.state.clip;
      r.setScript({ held: (a) => a === "fire", pressedNow: () => false });
      t0 = performance.now();
      while (r.loadout.active.state.clip === clip0 && performance.now() - t0 < 20000) await wait(10);
      r.setScript(null);
      await gameWait(0.15);
      const after = r.gunFeel().charge;
      // whole again within the rechamber and a little (BOOG's is over two seconds)
      const g1 = r.gameTime();
      t0 = performance.now();
      while (r.gunFeel().charge !== 1 && r.gameTime() - g1 < 6 && performance.now() - t0 < 30000) await wait(20);
      const later = r.gunFeel().charge;
      r.debugView.inspect = 0.3;
      await gameWait(0.2);
      const glow = r.gunFeel().rim;
      r.debugView.inspect = null;
      return { after, later, glow };
    })()`,
  );
  check(
    "soldier guns: BOOG recharges after a shot (part way just after it, whole later) and an inspect makes it glow",
    boog.after !== null && boog.after > 0 && boog.after < 0.9 && boog.later === 1 && boog.glow > 0.1,
    JSON.stringify(boog),
  );
  // The reload in view, the USSO and BOOG. With the bought arms (fprig.ts, KINEMATION's pack) holding them, their clips:
  // mid-reload the clip has turned the gun over in the hands (the pack gun's own reload, MPS5's and L96X's, 23 and 38
  // degrees at the middle); from empty the charging handle goes back, the left hand on it (its knuckle within 12 cm of
  // our handle as it moves), and afterwards the hand is back on the gun. Without the pack's files, the view's own:
  // rolled over by gunfeel.json reload.twist, the support hand on the handle for the rack (rackHand)
  type Point = { miss: number; lead: string; turn: number; rackLead: string; rackBack: number; rackHand: number; held: number; swapped: number; shortHip: number; shortAimed: number };
  const twistPoint = await ev<{ pack: boolean; roll: Record<string, number>; point: Record<string, Point> }>(
    page,
    `(async () => {
      const r = window.__range;
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const gameWait = async (s) => {
        const g0 = r.gameTime();
        const t0 = performance.now();
        while (r.gameTime() - g0 < s && performance.now() - t0 < 30000) await wait(20);
      };
      // in the hands and settled, 0.6 s with no swap and no flourish: a gun's first draw twirls it a whole turn round
      // its barrel, starting as the swap ends; and the bought arms' clips in, if their files are here
      const hold = async (id) => {
        r.loadout.give(0, id);
        r.loadout.requestSwap(0, r.gameTime());
        const t0 = performance.now();
        let clearFrom = r.gameTime();
        while (r.gameTime() - clearFrom < 0.6 && performance.now() - t0 < 30000) {
          if (r.loadout.swapping || r.vmState().flourish) clearFrom = r.gameTime();
          await wait(20);
        }
      };
      r.debugView.inspect = -1;
      const roll = {};
      const point = {};
      let pack = false;
      for (const id of ["r97", "sentinel"]) {
        await hold(id);
        pack = r.packArms().on;
        const rest = r.gunFeel().roll;
        const held = r.packArms().handsBelow;
        // both hands on the gun, still, a second after it was drawn and aimed (how far each arm falls short of where
        // it reaches; BOOG's right arm drifted off behind the eye within seconds of drawing it, its shoulder moved 21 cm
        // back every frame)
        await gameWait(1);
        const shortHip = Math.max(r.packArms().reachShort, r.packArms().reachShortR);
        r.debugView.ads = 1;
        await gameWait(1);
        const shortAimed = Math.max(r.packArms().reachShort, r.packArms().reachShortR);
        r.debugView.ads = null;
        await gameWait(0.3);
        // (the empty reload, rack and all: with rounds in, a reload is a tactical one, with no rack)
        r.loadout.active.state.clip = 0;
        r.debugView.reload = 0.5;
        await gameWait(0.2);
        roll[id] = r.gunFeel().roll - rest;
        if (pack) {
          // the bought arms: pointing at the magazine as it phases out (fparms.json reload), the gun left alone by the
          // pack's clip; working the gun in the rack window; and out of the picture at the bottom of a swap
          r.debugView.reload = 0.28;
          await gameWait(0.2);
          const s = r.packArms();
          r.debugView.reload = 0.78;
          await gameWait(0.2);
          const rackLead = r.packArms().lead;
          const rackBack = r.packArms().handleBack;
          const rackHand = r.packArms().leftToHandle;
          r.debugView.reload = null;
          await gameWait(0.2);
          r.debugView.raise = 0.5;
          await gameWait(0.2);
          const swapped = r.packArms().handsBelow;
          r.debugView.raise = null;
          // (no point is Infinity, which comes out of the page as null, and null < 0.06 holds: so 99 m)
          point[id] = { miss: Number.isFinite(s.pointMiss) ? s.pointMiss : 99, lead: s.lead, turn: s.gunTurn, rackLead, rackBack, rackHand, held, swapped, shortHip, shortAimed };
        }
        r.debugView.reload = null;
        r.loadout.active.state.clip = r.loadout.active.weapon.clipSize;
        await gameWait(0.2);
      }
      r.debugView.inspect = null;
      return { pack, roll, point };
    })()`,
  );
  // (the empty reload's sweep in a call of its own: in one with the above it ran past a page call's 120 s on a busy
  // machine)
  const twistRack = await ev<{ rack: { back: number; hand: number; after: number } | null; onHandle: number | null; away: number | null }>(
    page,
    `(async () => {
      const r = window.__range;
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const gameWait = async (s) => {
        const g0 = r.gameTime();
        const t0 = performance.now();
        while (r.gameTime() - g0 < s && performance.now() - t0 < 30000) await wait(20);
      };
      // in the hands and settled, 0.6 s with no swap and no flourish: a gun's first draw twirls it a whole turn round
      // its barrel, starting as the swap ends; and the bought arms' clips in, if their files are here
      const hold = async (id) => {
        r.loadout.give(0, id);
        r.loadout.requestSwap(0, r.gameTime());
        const t0 = performance.now();
        let clearFrom = r.gameTime();
        while (r.gameTime() - clearFrom < 0.6 && performance.now() - t0 < 30000) {
          if (r.loadout.swapping || r.vmState().flourish) clearFrom = r.gameTime();
          await wait(20);
        }
      };
      r.debugView.inspect = -1;
      await hold("r97");
      const pack = r.packArms().on;
      r.loadout.active.state.clip = 0;
      let rack = null;
      let onHandle = null;
      if (pack) {
        // through the empty reload from its start: the handle's travel and the hand on it while it is back
        let back = 0;
        let hand = Infinity;
        for (let p = 0.001; p < 0.99; p += 0.025) {
          r.debugView.reload = p;
          await gameWait(0.06);
          const s = r.packArms();
          back = Math.max(back, s.handleBack);
          if (s.handleBack > 0.5) hand = Math.min(hand, s.leftToHandle);
        }
        rack = { back, hand, after: 0 };
      } else {
        r.debugView.reload = 0.9;
        await gameWait(0.2);
        onHandle = r.gunFeel().onHandle;
      }
      r.debugView.reload = null;
      r.loadout.active.state.clip = r.loadout.active.weapon.clipSize;
      await gameWait(0.3);
      const away = r.gunFeel().onHandle;
      if (rack) rack.after = r.packArms().leftToHandle;
      r.debugView.inspect = null;
      return { rack, onHandle, away };
    })()`,
  );
  const twist = { ...twistPoint, ...twistRack };
  if (twist.pack) {
    const pt = Object.values(twist.point);
    const show = (f: (p: Point) => unknown) => JSON.stringify(Object.fromEntries(Object.entries(twist.point).map(([k, p]) => [k, f(p)])));
    check(
      "soldier guns: held a while at the hip and aimed, both of the bought arms' hands stay on the USSO and BOOG (neither arm 1 cm short)",
      pt.length === 2 && pt.every((p) => p.shortHip < 0.01 && p.shortAimed < 0.01),
      show((p) => ({ hip: +(p.shortHip * 100).toFixed(1), aimed: +(p.shortAimed * 100).toFixed(1) })),
    );
    // (the owner, 2026-09-27: "point a finger at it while it phases out and in for a reload and then smack the
    // charging handle ... same w the sniper")
    check(
      "soldier guns: as the magazine phases out, the bought arms' left forefinger points at it (within 6 cm), the gun not turned by the pack's own reload",
      pt.length === 2 && pt.every((p) => p.miss < 0.06 && p.lead === "pose" && p.turn < 5),
      show((p) => ({ miss: +(p.miss * 100).toFixed(1), lead: p.lead, turn: +p.turn.toFixed(1) })),
    );
    // (the USSO's by its own grab of its handle, at the back of the gun: the MPS5's empty reload is made for a handle at the
    // front, and carried over the left hand filled a third of the view; fparms.json packGuns MPS5 rack grab)
    check(
      "soldier guns: after the phase the hands work the gun, the USSO's left hand holding its handle back (within 6 cm of it), BOOG's bolt thrown by the pack's own",
      twist.point.r97?.rackBack > 0.9 && twist.point.r97?.rackHand < 0.06 && twist.point.sentinel?.rackLead === "fire",
      show((p) => ({ lead: p.rackLead, back: +p.rackBack.toFixed(2), hand: +(p.rackHand * 100).toFixed(1) })),
    );
    // (the owner: "the guns fly in and out but the arms stay in a weird position"; then, of a swap in place, 2026-09-30:
    // the hands "close and open around the phasing out/in of the weapon", cupped round it in the picture)
    const cupSwap = fparmsCfg.swap.style === "cup";
    check(
      cupSwap
        ? "soldier guns: in the middle of a swap in place both hands stay in the picture, cupped round the gun (under 45 degrees below the eye line), as held"
        : "soldier guns: at the bottom of a swap both hands are below the picture (40 degrees under the eye line at the hip), and held, one is in it",
      pt.every((p) => (cupSwap ? p.swapped < 45 : p.swapped > 45) && p.held < 40),
      show((p) => ({ held: Math.round(p.held), swapped: Math.round(p.swapped) })),
    );
    check(
      "soldier guns: from empty, the USSO's charging handle goes back with the left hand on it, and the hand is back on the gun after",
      !!twist.rack && twist.rack.back > 0.9 && twist.rack.hand < 0.12 && twist.rack.after > 0.05,
      JSON.stringify(twist.rack),
    );
    await packFrames(page);
  } else {
    check("soldier guns: part way through a reload the USSO and BOOG are rolled over, the underside toward you", twist.roll.r97 < -0.7 && twist.roll.sentinel < -0.6, JSON.stringify(twist.roll));
    check(
      "soldier guns: from empty, the USSO's support hand is on its charging handle for the rack, and back on the gun after",
      twist.onHandle !== null && twist.onHandle < 0.005 && twist.away !== null && twist.away > 0.03,
      JSON.stringify(twist),
    );
  }
  // the support wrist (fparms.ts, speedkills.json viewmodel support straighten): the hand rolls round what it holds
  // until the wrist is nearly straight on the forearm, and on the charging handle (a knob) turns any way. Measured
  // without it, 44 to 83 degrees at the hip, up to 103 aimed and 122 on the USSO's rack (the owner: "look at how
  // fucked up the left wrist is")
  const wrists = await ev<Record<string, number>>(
    page,
    `(async () => {
      const r = window.__range;
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const gameWait = async (s) => {
        const g0 = r.gameTime();
        const t0 = performance.now();
        while (r.gameTime() - g0 < s && performance.now() - t0 < 30000) await wait(20);
      };
      const out = {};
      r.debugView.inspect = -1;
      for (const id of ["r97", "sentinel", "alternator_smg", "mastiff"]) {
        r.loadout.give(0, id);
        r.loadout.requestSwap(0, r.gameTime());
        const t0 = performance.now();
        let clearFrom = r.gameTime();
        while (r.gameTime() - clearFrom < 0.6 && performance.now() - t0 < 30000) {
          if (r.loadout.swapping || r.vmState().flourish) clearFrom = r.gameTime();
          await wait(20);
        }
        // (the bought arms' wrist on a gun they hold: fprig.ts)
        const wrist = () => (r.packArms().on ? r.packArms().wristL : r.wristBend().l);
        out[id] = wrist();
        r.debugView.ads = 1;
        await gameWait(0.3);
        out[id + " aimed"] = wrist();
        r.debugView.ads = null;
        await gameWait(0.2);
        if (id === "r97") {
          r.loadout.active.state.clip = 0;
          r.debugView.reload = 0.9;
          await gameWait(0.2);
          out["r97 rack"] = r.packArms().on ? r.packArms().wristL : r.wristBend().l;
          out.packRack = r.packArms().on ? 1 : 0;
          r.debugView.reload = null;
          r.loadout.active.state.clip = r.loadout.active.weapon.clipSize;
          await gameWait(0.2);
        }
      }
      r.debugView.inspect = null;
      return out;
    })()`,
  );
  check(
    "soldier arms: the support wrist is nearly straight on every gun, held (50 degrees at most) and on the USSO's rack (30; 60 in the bought arms' own grip on the handle)",
    Object.entries(wrists).every(([k, v]) => v <= (k.endsWith("rack") ? (wrists.packRack ? 60 : 30) : 50)) && Object.keys(wrists).length === 10,
    JSON.stringify(Object.fromEntries(Object.entries(wrists).map(([k, v]) => [k, Math.round(v)]))),
  );
  // BOOG's recharge in its scope (hud.json hsCharge): aimed in, a shot, and the ring round the aim point is drawn part
  // closed; once it has closed, nothing more (the owner: no READY, the closed circle says it)
  const scopeRing = await ev<{ during: { ring: number; ready: boolean }; after: { ring: number; ready: boolean }; charge: number | null }>(
    page,
    `(async () => {
      const r = window.__range;
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const gameWait = async (s) => {
        const g0 = r.gameTime();
        const t0 = performance.now();
        while (r.gameTime() - g0 < s && performance.now() - t0 < 30000) await wait(20);
      };
      r.loadout.give(0, "sentinel");
      r.loadout.requestSwap(0, r.gameTime());
      let t0 = performance.now();
      while (r.loadout.swapping && performance.now() - t0 < 30000) await wait(20);
      r.setScript({ held: (a) => a === "ads", pressedNow: () => false });
      await gameWait(1.2);
      const clip0 = r.loadout.active.state.clip;
      r.setScript({ held: (a) => a === "ads" || a === "fire", pressedNow: () => false });
      t0 = performance.now();
      while (r.loadout.active.state.clip === clip0 && performance.now() - t0 < 20000) await wait(10);
      r.setScript({ held: (a) => a === "ads", pressedNow: () => false });
      await gameWait(0.3);
      const during = { ...r.hud.hsChargeDrawn };
      const charge = r.gunFeel().charge;
      t0 = performance.now();
      while (r.hud.hsChargeDrawn.ring < 1 && performance.now() - t0 < 20000) await wait(15);
      await gameWait(0.3);
      const after = { ...r.hud.hsChargeDrawn };
      r.setScript(null);
      await gameWait(0.3);
      return { during, after, charge };
    })()`,
  );
  check(
    "soldier guns: BOOG's scope draws its recharge as a ring round the aim point after a shot, closing, and no READY once it has",
    scopeRing.during.ring > 0 && scopeRing.during.ring < 1 && scopeRing.after.ring === 1 && !scopeRing.after.ready,
    JSON.stringify(scopeRing),
  );
  // the USSO wears the pack's reflex sight from the steady SMG (paidweapons.json mount; the pack has no sight
  // attachments, and the USSO had irons alone) and is aimed down its dot, drawn in its optic's red
  const reddot = await ev<{ mounted: boolean; dot: string | null; sight: { dot: boolean } | null } | null>(
    page,
    `(async () => {
      const r = window.__range;
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      r.loadout.give(0, "r97");
      r.loadout.requestSwap(0, r.gameTime());
      // until the view holds it (the e2e's CPU drawing is a few frames a second)
      const t0 = performance.now();
      let g = null;
      while (performance.now() - t0 < 30000) {
        g = r.loadout.swapping ? null : r.gunParts();
        if (g && r.paidGuns().inHand === "SciFiSMG02_2") break;
        await wait(50);
      }
      return g ? { mounted: g.mounted, dot: g.dot, sight: g.sight } : null;
    })()`,
  );
  // Hyper Scape's guns carried a live screen (docs/HYPERSCAPE_GAP_ANALYSIS.md): the USSO's shows its rounds, and a shot
  // takes one off it
  const screen = await ev<{ before: string | null; after: string | null; clip: number }>(
    page,
    `(async () => {
      const r = window.__range;
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const until = async (ok) => { const t0 = performance.now(); while (!ok() && performance.now() - t0 < 30000) await wait(20); };
      await until(() => r.gunFeel().screen);
      const before = r.gunFeel().screen;
      const clip0 = r.loadout.active.state.clip;
      r.setScript({ held: (a) => a === "fire", pressedNow: () => false });
      await until(() => r.loadout.active.state.clip < clip0);
      r.setScript(null);
      const clip = r.loadout.active.state.clip;
      await until(() => r.gunFeel().screen && r.gunFeel().screen.startsWith(clip + "|"));
      return { before, after: r.gunFeel().screen, clip };
    })()`,
  );
  // a scoped figure aiming in glints (Hyper Scape's lens flare, muzzle.ts fitGlint): BOOG aimed does, BOOG at the hip
  // does not, and the USSO (a reflex sight, not a magnified one) has none to show
  const glint = await ev<Array<boolean | null>>(
    page,
    `(async () => {
      const r = window.__range;
      const figs = r.figureLab([
        { speed: 0, stance: "stand", pitch: 0, ads: 1, weapon: "sentinel", look: "S0000010" },
        { speed: 0, stance: "stand", pitch: 0, ads: 0, weapon: "sentinel", look: "S1111020" },
        { speed: 0, stance: "stand", pitch: 0, ads: 1, weapon: "r97", look: "S2222030" },
      ], 6, 0);
      const g0 = r.gameTime();
      const t0 = performance.now();
      while (r.gameTime() - g0 < 1 && performance.now() - t0 < 30000) await new Promise((ok) => setTimeout(ok, 20));
      const out = r.labFigures().map((f) => (f.mq && f.mq.glint ? f.mq.glint.visible : null));
      r.figureLab([]);
      return out;
    })()`,
  );
  check("soldier guns: a figure aiming BOOG's scope glints, not at the hip, and the USSO's reflex sight has no glint", glint[0] === true && glint[1] === false && glint[2] === null, JSON.stringify(glint));
  check(
    "soldier guns: the USSO's screen shows its rounds, and a shot takes one off it",
    !!screen.before && !!screen.after && screen.after.startsWith(`${screen.clip}|`) && screen.before !== screen.after,
    JSON.stringify(screen),
  );
  check(
    "soldier guns: the USSO wears the pack's reflex sight and is aimed down its dot, a red one",
    !!reddot && reddot.mounted && !!reddot.sight?.dot && !!reddot.dot && parseInt(reddot.dot.slice(0, 2), 16) > 2 * parseInt(reddot.dot.slice(2, 4), 16),
    JSON.stringify(reddot),
  );
  check(
    "soldier guns: the USSO phases out of the hands and BOOG in, whole at the end and drawn; STRYDER has no phase",
    phased.low.r97 < 0.2 && phased.low.sentinel < 0.2 && phased.end.gun === "sentinel" && phased.end.phase === 1 && phased.end.shown && phased.plain.gun === null && phased.plain.phase === 1,
    JSON.stringify(phased),
  );
  // a hack used in first person (hackcast.ts): the left hand comes up with its card and taps it, and HEAL's area is
  // Hyper Scape's ring on the ground with the heal's signs rising (healarea.ts), not a wall round the player
  const cast = await ev<{ up: number; tapped: boolean; area: boolean; back: number }>(
    page,
    `(async () => {
      const r = window.__range;
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const g0 = r.gameTime();
      r.sk.setHack("heal");
      r.sk.use("utility");
      // until the hand is back on the gun: the view's clock steps at most 0.05 s a frame, so on the e2e's CPU drawing,
      // a few frames a second, the cast runs about three times slower than game time
      let up = 0;
      let tapped = false;
      const t0 = performance.now();
      while (r.gameTime() - g0 < 6 && performance.now() - t0 < 30000) {
        const c = r.castState();
        up = Math.max(up, c.up);
        tapped = tapped || c.tapped;
        if (tapped && c.up === 0) break;
        await wait(10);
      }
      let area = false;
      r.scene.traverse((o) => { if (o.name === "heal-area") area = true; });
      return { up, tapped, area, back: r.castState().up };
    })()`,
  );
  check("soldier hacks: a hack is used with the left hand up, its card tapped, and back on the gun after; HEAL lays its ring on the ground", cast.up > 0.9 && cast.tapped && cast.back === 0 && cast.area, JSON.stringify(cast));
  check(
    "soldier arms: both upper arms' cut ends off the gun camera's frame at the hip and on the way into the sights, on the USSO and BOOG",
    elbows.length === 2 && elbows.every((e) => e.hip?.r && e.hip.l && e.ads?.r && e.ads.l),
    JSON.stringify(elbows),
  );
  await page.close();

  // without the files: every request for them answers 404, as on a copy that never ran npm run paid
  const before = errors.length;
  const bare = await browser.newPage();
  await bare.setRequestInterception(true);
  bare.on("request", (q) => (q.url().includes("/models/paid/") ? void q.respond({ status: 404, contentType: "text/plain", body: "" }) : void q.continue()));
  bare.on("pageerror", (e) => errors.push(`pageerror: ${String((e as Error).message ?? e)}`));
  await bare.evaluateOnNewDocument(NO_REAL_MOUSE);
  await bare.setViewport({ width: 800, height: 450, deviceScaleFactor: 1 });
  await bare.goto(`${BASE}?game=speedkills&nointro`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await bare.waitForFunction("Boolean(window.__range) && window.__range.loaded()", { polling: 250, timeout: 60000 }).catch(() => undefined);
  await ev(bare, "window.__range.loadMannequin()").catch(() => undefined);
  await ev(bare, `(() => { const r = window.__range; r.player.teleport(0, 0, 0, 0, 0); r.figureLab([{ speed: 0, stance: "stand", pitch: 0 }], 4, 0); })()`);
  await gameSleep(bare, 3);
  const fell = await ev<{ soldier: boolean; guns: boolean; figure: boolean; mq: boolean }>(
    bare,
    "(() => { const r = window.__range; const f = r.labFigures()[0]; return { soldier: r.soldierReady(), guns: r.paidGuns().ready, figure: !!f, mq: !!f?.mq && !f.mq.soldier }; })()",
  );
  const crashed = errors.slice(before).filter((e) => e.startsWith("pageerror"));
  check("soldier: without the bought files the game runs on the figures and guns of before, and nothing throws", !fell.soldier && !fell.guns && fell.figure && crashed.length === 0, JSON.stringify({ ...fell, crashed: crashed.slice(0, 2) }));
  await bare.close();
  // the 404s were the point of that page, not a fault: only what it threw stays counted
  for (let i = errors.length - 1; i >= before; i--) if (!errors[i].startsWith("pageerror")) errors.splice(i, 1);
}

async function speedkillsTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?norender&game=speedkills");
  const front = await ev<{ game: string; html: string; br: boolean; gunrun: boolean; tour: boolean; title: string }>(
    page,
    `(() => { const vis = (id) => getComputedStyle(document.getElementById(id)).display !== "none"; window.__range.menu.showExtras(true); const out = { game: window.__range.sk.game(), html: document.documentElement.dataset.game, br: vis("goBr"), gunrun: !!document.getElementById("goGunRun"), tour: vis("goTour"), title: document.title }; window.__range.menu.showExtras(false); return out; })()`
  );
  check("speedkills: the page is SpeedKills, its menu PLAY and TRAINING behind Extra modes (Gun Run gone)", front.game === "speedkills" && front.html === "speedkills" && front.br && front.tour && !front.gunrun && front.title === "SpeedKills", JSON.stringify(front));
  if (!(await onNeon(page))) {
    // High City's corner (citydistricts.ts): drawn from its own file, and its opaque faces from behind too (look backs): the
    // film set is faced only toward its canyons, and from the city's streets round it only its frames showed
    type Dist = { drawn: string[]; triangles: number; opaque: number; both: number };
    const dist = await page
      .waitForFunction("window.__range.cityDistricts().drawn.length > 0", { polling: 250, timeout: 90000 })
      .then(
        () => ev<Dist>(page, `(() => { const r = window.__range; let opaque = 0, both = 0; r.scene.getObjectByName("district:high-corner")?.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (!m.transparent) { opaque++; if (m.side === 2) both++; } }); return { ...r.cityDistricts(), opaque, both }; })()`),
        () => null,
      );
    check("speedkills: High City's corner is drawn from its own file, its faces from behind too (no film set's frames to see through)", !!dist && dist.drawn.includes("high-corner") && dist.triangles > 500000 && dist.opaque > 20 && dist.both === dist.opaque, JSON.stringify(dist));
  } else oldCityOnly("High City's corner drawn from its own file");
  // the guns: ten of its own, named, the owner's friends among them
  const guns = await ev<{ ids: number; names: string[] }>(page, `(() => { const r = window.__range; return { ids: r.weaponIds ? r.weaponIds().length : -1, names: r.loadout.slots.map((s) => s.weapon.name) }; })()`);
  check("speedkills: a loadout's guns carry SpeedKills names", guns.names.every((n) => /^[A-Z]+$/.test(n)) && guns.names.every((n) => ["PANDA", "STRYDER", "ANAKIN", "USSO", "BIGANTLER", "REZ", "HAEFY", "APUHTHEE", "BOOG", "CHOOCH"].includes(n)), JSON.stringify(guns));
  // fusion: level 5 is half again the magazine
  const fused = await ev<{ before: number; after: number; level: number }>(page, `(() => { const r = window.__range; const before = r.loadout.slots[0].weapon.clipSize; r.sk.setFusion(0, 5); return { before, after: r.loadout.slots[0].weapon.clipSize, level: r.sk.fusion()[0] }; })()`);
  check("speedkills: fused to 5, a gun's magazine is half as big again", fused.level === 5 && Math.abs(fused.after / fused.before - 1.5) < 0.08, JSON.stringify(fused));
  await ev(page, "window.__range.sk.setFusion(0, 0)");
  // the hacks you picked, both ready
  const held = await ev<Array<{ slot: string; held: { id: string } | null; left: number }>>(page, "window.__range.sk.hacks()");
  check("speedkills: two hacks held, a mobility and a utility, both ready", held.length === 2 && held.every((h) => h.held && h.left === 0), JSON.stringify(held));
  // onto the open ground behind the range, outdoors, facing down it: past the basic course's far wall (x -21, z 200),
  // since THE CHAIN (courses/chain.ts) stands where this was, between the other two courses
  await ev(page, `(() => { document.getElementById("overlay").classList.add("hidden"); window.__range.player.teleport(-21, 0, 200, 0); })()`);
  await sleep(300);
  const hack = async (id: string, slot: string, settle = 600) => {
    await ev(page, `(() => { const r = window.__range; r.sk.setHack("${id}"); r.sk.use("${slot}"); })()`);
    await sleep(settle);
  };
  // DASH: Hyper Scape's Teleport, about 26 m the way you look (measured off its footage; Phase 20 A9)
  const z0 = await ev<number>(page, "window.__range.player.pos.z");
  await hack("dash", "mobility", 500);
  const z1 = await ev<number>(page, "window.__range.player.pos.z");
  check("speedkills: DASH carries you about 26 m the way you look", z0 - z1 > 20 && z0 - z1 < 28, `${(z0 - z1).toFixed(1)} m`);
  // LEAP: straight up four storeys, then a glide
  await ev(page, `window.__range.player.teleport(-21, 0, 200, 0)`);
  await sleep(200);
  let top = 0;
  await ev(page, `(() => { const r = window.__range; r.sk.setHack("leap"); r.sk.use("mobility"); })()`);
  let glide = false;
  // up for about 1.4 s (the top of a 16 m throw), then the glide
  for (let i = 0; i < 30 && !glide; i++) {
    await sleep(100);
    top = Math.max(top, await ev<number>(page, "window.__range.player.pos.y"));
    glide = await ev<boolean>(page, "window.__range.player.dropping");
  }
  check("speedkills: LEAP throws you about four storeys up, then you glide", top > 12 && glide, `${top.toFixed(1)} m, gliding ${glide}`);
  await page.waitForFunction("window.__range.player.onGround", { polling: 100, timeout: 20000 }).catch(() => undefined);
  // HEAL: an area on the ground; ARMOR: slower while it lasts; INVISIBILITY; MINE
  await hack("heal", "utility", 150);
  const healed = await ev<{ healZones: number }>(page, "window.__range.sk.state()");
  check("speedkills: HEAL puts a healing area down", healed.healZones >= 1, JSON.stringify(healed));
  // an enemy's HEAL heals you too if you stand in it (the owner, 2026-09-27: "we should be able to heal in it
  // anyways"): someone on no side of yours puts one down at your feet, and it is one more area that heals
  const foeHeal = await ev<{ before: number; after: number }>(
    page,
    `(() => { const r = window.__range; const before = r.sk.state().healZones; const p = r.player.pos; r.sk.remoteHack(987654, 3, p.x, p.y, p.z); return { before, after: r.sk.state().healZones }; })()`,
  );
  check("speedkills: an enemy's HEAL is an area you heal in too", foeHeal.after === foeHeal.before + 1, JSON.stringify(foeHeal));
  await hack("armor", "utility", 150);
  const arm = await ev<{ armored: boolean; hackSlow: number }>(page, "window.__range.sk.state()");
  check("speedkills: ARMOR is on, and you are slower under it", arm.armored && arm.hackSlow < 1, JSON.stringify(arm));
  await hack("invis", "utility", 150);
  const inv = await ev<{ invisible: boolean }>(page, "window.__range.sk.state()");
  check("speedkills: INVISIBILITY is on", inv.invisible);
  await hack("mine", "utility", 150);
  const mine = await ev<{ mines: number }>(page, "window.__range.sk.state()");
  check("speedkills: MINE puts a mine down", mine.mines >= 1, JSON.stringify(mine));
  // a hack used is gone for its cooldown
  const cool = await ev<number>(page, "window.__range.sk.hacks().find((h) => h.slot === 'utility').left");
  check("speedkills: a hack just used is on its cooldown", cool > 1, `${cool.toFixed(1)} s`);
  // the gun panel: each slot's fusion (drawn as pips), and none of the legacy game's attachment lines
  await ev(page, "window.__range.sk.setFusion(0, 3)");
  await sleep(300);
  const panel = await ev<{ fusion: { levels: number[]; max: number } | null; attach: number }>(page, "({ fusion: window.__range.hud.last?.fusion ?? null, attach: (window.__range.hud.last?.attachLines ?? []).length })");
  check("speedkills: the gun panel carries each slot's fusion to level 5, and no attachment lines", panel.fusion?.levels[0] === 3 && panel.fusion.max === 5 && panel.attach === 0, JSON.stringify(panel));
  await skWholeNumbers(page);
  await skHitsLand(page);
  await page.close();
  // an arena match in SpeedKills on the city before the Neon City (?map=city, the suite's) is fought in its block:
  // NEON BLOCK (arenas/neonblock.ts), its bounds 74..118 by 94..142 (THE CENTRE is the Neon City's middle: below)
  const arena = await open(browser, "?game=speedkills");
  await ev(arena, `(() => { document.getElementById("goBots").click(); document.getElementById("startMode").click(); })()`);
  await arena.waitForFunction("window.__range.duel()?.phase === 'fight' || window.__range.duel()?.phase === 'countdown'", { polling: 200, timeout: 20000 }).catch(() => undefined);
  await sleep(500);
  const where = await ev<{ x: number; z: number; phase: string | null }>(arena, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z, phase: window.__range.duel()?.phase ?? null })");
  if (!(await onNeon(arena))) {
    check("speedkills: an arena match is fought in NEON BLOCK, the city's crossing", where.x > 74 && where.x < 118 && where.z > 94 && where.z < 142, JSON.stringify(where));
  } else oldCityOnly("an arena match fought in NEON BLOCK");
  // SpeedKills' 1v1 on the Neon City is fought on THE CENTRE (arenas/centre.ts, the owner, 2026-10-01): the city's
  // own middle, inside a circle you cannot leave; its bot from the spawn north of the tower reaches the 1v1's circle by
  // the city's graph (walking straight at it from there, it was 40 m off after 45 s: measured from each spawn)
  {
    const page = await open(browser, "?norender&game=speedkills&map=neon");
    await ev(page, `(() => { document.getElementById("goBots").click(); document.getElementById("startMode").click(); })()`);
    await page.waitForFunction("window.__range.duel()?.phase === 'fight'", { polling: 200, timeout: 30000 }).catch(() => undefined);
    const at = await ev<{ x: number; z: number; map: string | null; bot: number[] }>(
      page,
      "(() => { const R = window.__range; const d = R.duel(); return { x: R.player.pos.x, z: R.player.pos.z, map: d?.arenaId ?? null, bot: [d.bots[0].pos.x, d.bots[0].pos.z] }; })()",
    );
    const circle = CENTRE_MAP.bounds.circle!;
    const fromMiddle = (p: { x: number; z: number }) => Math.hypot(p.x - circle.x, p.z - circle.z);
    check("speedkills: a 1v1 against a bot on the Neon City is fought on THE CENTRE, the city's middle, inside its circle", at.map === "centre" && fromMiddle(at) < circle.r, JSON.stringify({ ...at, r: +fromMiddle(at).toFixed(1) }));
    // walked out of it, you are back on its edge
    await ev(page, `(() => { const R = window.__range; R.input.locked = true; R.player.teleport(${circle.x}, 0, ${circle.z + circle.r + 12}, 0, 0); })()`);
    await gameSleep(page, 0.4);
    const out = await ev<{ x: number; z: number }>(page, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })");
    // you back at your spawn, south, far from the circle; the bot from its own, north of the tower
    const you = CENTRE_MAP.spawns[0];
    const zone = CENTRE_MAP.center;
    const nearest = await ev<number>(
      page,
      `new Promise((ok) => { const R = window.__range; const d = R.duel(); d.holdFire = true; R.player.teleport(${you.x}, 0, ${you.z}, ${you.yaw}, 0);
        const b = d.bots[0]; b.pos.set(${CENTRE_MAP.spawns[1].x}, 0, ${CENTRE_MAP.spawns[1].z});
        const g0 = R.gameTime(); const t0 = performance.now(); let best = Infinity;
        const step = () => { best = Math.min(best, Math.hypot(b.pos.x - ${zone.x}, b.pos.z - ${zone.z}));
          if (best < 3 || R.gameTime() - g0 > 45 || performance.now() - t0 > 180000) return ok(best); setTimeout(step, 100); };
        step(); })`,
    );
    check(
      "speedkills: on THE CENTRE you cannot leave its circle, and its bot reaches the 1v1's circle from north of the tower by the city's graph",
      fromMiddle(out) <= circle.r + 0.01 && nearest < 3,
      JSON.stringify({ out: +fromMiddle(out).toFixed(2), botNearestToCircle: +nearest.toFixed(1) }),
    );
    await page.close();
  }
  // the city under it: the ambience on, and its file found (audio.json ambience)
  await sleep(1500);
  const amb = await ev<{ on: boolean; missing: boolean }>(arena, "({ ...window.__range.audio.ambienceState })");
  check("speedkills: the city's ambience plays under a match, and its file is there", amb.on && !amb.missing, JSON.stringify(amb));
  await arena.close();
  // the movement lab, from TRAINING: in its bounds, and its storey block climbed for real (arenas/movelab.ts:
  // the lab at x 74..122, z -121..-79; the 4 m block's south face at x 83, z -112)
  const lab = await open(browser, "?game=speedkills");
  await ev(lab, `(() => { document.getElementById("goLab").click(); document.getElementById("startMode").click(); })()`);
  await sleep(800);
  const inLab = await ev<{ x: number; z: number }>(lab, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })");
  check("speedkills: the movement lab opens from TRAINING", inLab.x > 74 && inLab.x < 122 && inLab.z > -121 && inLab.z < -79, JSON.stringify(inLab));
  await ev(lab, "window.__range.player.teleport(83, 0, -111.2, 0)");
  // the jump pressed for the next frame or two, counted in frames: 30 ms of real time was often over before the
  // page's next frame at the 35 ms a frame a loaded machine draws, and the press was never seen
  await ev(lab, `(() => { let press = true; requestAnimationFrame(() => requestAnimationFrame(() => { press = false; })); const t0 = performance.now(); window.__range.setScript({ held: (a) => a === "forward" || (a === "jump" && performance.now() - t0 < 120), pressedNow: (a) => a === "jump" && press }, null); })()`);
  const topped = await lab.waitForFunction("window.__range.player.pos.y > 3.9", { polling: 50, timeout: 6000 }).then(() => true, () => false);
  await ev(lab, "window.__range.setScript(null)");
  check("speedkills: in the lab, the storey block is climbed to its top (4 m)", topped, JSON.stringify(await ev(lab, "({ y: window.__range.player.pos.y, z: window.__range.player.pos.z })")));
  await lab.close();
  // The arms in the sights (Phase 20 A3): aimed through a magnified scope (BOOG's; HAEFY's 3x went with the 30-30 when
  // HAEFY became the launcher) the gun is hidden for the scope picture,
  // and the arms, which are not under the gun, stayed drawn frozen and filled the scope. With a red dot (USSO) the
  // arms stay, as they should.
  const sight = await open(browser, "?game=speedkills");
  const arms = await ev<{ scoped: boolean; dot: boolean; ready: boolean }>(
    sight,
    `(async () => { const r = window.__range; await r.loadMannequin(); const wait = (ms) => new Promise((ok) => setTimeout(ok, ms)); const t0 = performance.now(); while (!r.realArms() && performance.now() - t0 < 8000) await wait(100); r.loadout.setWeaponId(0, "sentinel"); r.debugView.ads = 1; await wait(1200); const scoped = r.realArmsShown(); r.loadout.setWeaponId(0, "r97"); const t1 = performance.now(); while (!r.realArmsShown() && !r.packArms().on && performance.now() - t1 < 4000) await wait(100); const dot = r.realArmsShown() || r.packArms().on; r.debugView.ads = null; return { scoped, dot, ready: r.realArms() }; })()`,
  );
  check("speedkills sights: aimed through a magnified scope (BOOG's) the frozen arms are hidden; through a red dot they stay", arms.ready && !arms.scoped && arms.dot, JSON.stringify(arms));
  // every gun named with its class for a beginner (Phase 20 A7): USSO (Fast SMG) in the label and in the loadout pickers
  const names = await ev<{ usso: string; picker: string[] }>(sight, `({ usso: window.__range.weaponLabel("r97"), picker: [...document.querySelectorAll("#slot0 option")].map((o) => o.textContent) })`);
  check("speedkills names: every gun carries its class, USSO (Fast SMG), in the label and the loadout picker", names.usso === "USSO (Fast SMG)" && names.picker.length >= 10 && names.picker.every((t) => /\(.+\)$/.test(t ?? "")), JSON.stringify(names));
  // The HUD as the owner laid it out (Phase 20 A6, hud.json layouts.speedkills), read off the boxes it drew in this
  // match: all on the bottom edge, the health bar twice the legacy 12 thick, the ammo count 1.5 times the legacy 58,
  // the hacks right of the health, the guns left of the ammo, nothing overlapping
  // (on a rendered page: a ?norender page draws no HUD, and in one the check read no boxes at all)
  const hud = await ev<{ b: Record<string, { x: number; y: number; w: number; h: number }>; W: number; H: number; u: number }>(
    sight,
    "(() => { const h = window.__range.hud; return { b: JSON.parse(JSON.stringify(h.boxes)), W: innerWidth, H: innerHeight, u: innerHeight / 1080 }; })()",
  );
  {
    const { b, W, H, u } = hud;
    // the hacks' boxes only where hacks are held (a page with none picked draws none)
    const need = ["health", "shield", "ammo", "slot0", ...(b.hack0 ? ["hack0"] : [])];
    const all = need.every((k) => b[k]);
    const inBand = Object.values(b).every((r) => r.y >= H - 125 * u && r.y + r.h <= H + 0.5 && r.x >= -0.5 && r.x + r.w <= W + 0.5);
    const overlap = (p: { x: number; y: number; w: number; h: number }, q: { x: number; y: number; w: number; h: number }) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
    const keys = Object.keys(b).filter((k) => k !== "healthNumber");
    const clash = keys.flatMap((k, i) => keys.slice(i + 1).filter((k2) => overlap(b[k], b[k2])).map((k2) => `${k}/${k2}`));
    check(
      "sk hud: all on the bottom edge, health twice as thick, ammo half as big again, hacks right of the health, guns left of the ammo, nothing overlapping",
      all && inBand && clash.length === 0 && b.health.h >= 2 * 12 * u - 0.01 && b.ammo.h / 0.66 >= 1.5 * 58 * u - 0.01 && (!b.hack0 || (b.hack0.x >= b.health.x + b.health.w && b.hack0.w > 58 * u)) && b.slot0.x + b.slot0.w <= b.ammo.x,
      JSON.stringify({ all, have: Object.keys(b), inBand, clash, health: b.health, ammo: b.ammo, hack0: b.hack0, slot0: b.slot0 }),
    );
  }
  // The range as SpeedKills' sandbox (Phase 20 A12): a body sent 40 m down range stops at the lit edge 24 m in,
  // where the curtain stands, and the README screen hangs in it. Read after a stretch of game time, not 500 ms: on the
  // e2e's CPU drawing a frame can take longer than that, and the edge had not been reached because no frame had run
  const sb = await ev<{ z: number; curtains: number; tvZ: number | null }>(
    sight,
    `(async () => {
      const r = window.__range;
      r.player.teleport(0, 0, -40, 0);
      const g0 = r.gameTime();
      const t0 = performance.now();
      while (r.gameTime() - g0 < 0.3 && performance.now() - t0 < 20000) await new Promise((ok) => setTimeout(ok, 20));
      const c = [];
      r.scene.traverse((o) => { if (o.name === "sk-sandbox-curtain") c.push(o); });
      const out = { z: r.player.pos.z, curtains: c.length, tvZ: r.readmeTv ? r.readmeTv.root.children[0]?.position.z ?? null : null };
      r.player.teleport(0, 0, 0, 0);
      return out;
    })()`,
  );
  check("speedkills range: the sandbox stops you at its lit edge, 24 m down range, where the curtain stands", sb.z >= -24.5 && sb.z <= -22 && sb.curtains === 3, JSON.stringify(sb));
  // The menu (Phase 20 A11): no tab and no Play mode wider than the menu, at three screen sizes (the hack pickers
  // and the controller boxes pushed rows past its edge, and every mode scrolled sideways)
  const wide: string[] = [];
  for (const [w, h] of [[1024, 576], [1280, 720], [1920, 1080]]) {
    await sight.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await sleep(250);
    wide.push(
      ...(await ev<string[]>(
        sight,
        `(() => { const r = window.__range; const m = r.menu; const el = document.querySelector(".menu"); const out = []; const look = (state) => { el.scrollTop = 0; if (el.scrollWidth > el.clientWidth + 1) out.push("${w}x${h} " + state + " +" + (el.scrollWidth - el.clientWidth) + "px"); };
          const modes = [...document.querySelectorAll(".lobby .modes .mode")].map((c) => c.dataset.mode).filter(Boolean);
          for (const mode of modes) { m.show("play"); m.pickMode(mode); look("play:" + mode); }
          for (const tab of ["duel", "loadouts", "stats", "settings", "controls"]) { try { m.show(tab); look(tab); } catch (e) {} }
          m.show("play"); return out; })()`,
      )),
    );
  }
  await sight.setViewport({ width: 800, height: 450, deviceScaleFactor: 1 });
  check("speedkills menu: from 1024x576 to 1920x1080 no tab and no Play mode is wider than the menu (no sideways scrollbar)", wide.length === 0, wide.slice(0, 6).join("; ") || "none");
  await sight.close();
  await speedkillsBrTest(browser);
  await speedkillsStartsTest(browser);
  await speedkillsEdgeTest(browser);
  await speedkillsGhostTest(browser, "loot");
  await speedkillsGhostTest(browser, "loadout");
  await skLauncherTest(browser);
}

/**
 * SpeedKills' two starts (Phase 20 A1): the owner landed with a loadout and
 * could not loot, fuse or change a gun, because that start built no floor.
 * In both, through the game's own E: the floor has its loot, a copy of a gun
 * you carry fuses it, a gun you do not carry swaps in and the one in hand
 * goes down at its level, and what you die with goes down at its levels. What
 * the start does decide: you land with nothing, or with your loadout at
 * level 0 (a level tried on the range's key stays in the range), and the
 * bots loot or land armed. The loadout pass also checks what the floor can
 * now hold in SpeedKills: a care package of its own loot, no loadout crate,
 * and a bot's box with its gun and nothing of the legacy game's.
 */
/**
 * Two friends into one SpeedKills battle royale (the owner, 2026-09-26: two friends could not join; when the second
 * came in, one was sent back to the lobby). The host picks a trio battle royale and leaves the players dropdown,
 * which is the 1v1's, as it opens (2): the match must still take both friends, since a squad of three is three.
 */
/**
 * SpeedKills' first loadout is the USSO and BOOG (speedkills.json lists.loadoutPick; the owner, 2026-09-29): a new
 * player starts with them, a returning one is moved onto them once, and a pick made after that is kept.
 */
async function skLoadoutTest(browser: Browser): Promise<void> {
  const read = `(() => { const r = window.__range; const c = r.loadouts.current; const s = JSON.parse(localStorage.getItem("range.loadouts.sk.v1") ?? "null"); return { name: c.name, want: [c.slot1, c.slot2], held: r.loadout.slots.map((x) => x.id), pick: s?.pick ?? null, sel: s?.selected ?? null }; })()`;
  // a new player: nothing stored
  const fresh = await open(browser, "?game=speedkills&norender", BASE, `if (!sessionStorage.getItem("e2e.fresh")) { sessionStorage.setItem("e2e.fresh", "1"); localStorage.removeItem("range.loadouts.sk.v1"); }`);
  const a = await ev<{ name: string; want: string[]; held: string[]; pick: string | null }>(fresh, read);
  check("a new player's loadout is the USSO and BOOG, in hand", a.want.join() === "r97,sentinel" && a.held.join() === "r97,sentinel" && a.name === "USSO and BOOG", JSON.stringify(a));
  await fresh.close();
  // a returning player on Marksman from before, the store with no pick in it
  const OLD = `{"selected":{"kind":"default","index":2},"custom":[]}`;
  const back = await open(browser, "?game=speedkills&norender", BASE, `if (!sessionStorage.getItem("e2e.back")) { sessionStorage.setItem("e2e.back", "1"); localStorage.setItem("range.loadouts.sk.v1", '${OLD}'); }`);
  const b = await ev<{ want: string[]; held: string[]; pick: string | null; sel: { kind: string; index: number } | null }>(back, read);
  check("a returning player is moved onto the USSO and BOOG once, and the store says so", b.want.join() === "r97,sentinel" && b.held.join() === "r97,sentinel" && b.pick === "usso-boog" && b.sel?.index === 0, JSON.stringify(b));
  // they pick Marksman again: after a reload it is still theirs
  await ev(back, `[...document.querySelectorAll("#loadoutList button")].find((x) => x.textContent.startsWith("Marksman")).click()`);
  await back.reload({ waitUntil: "domcontentloaded" });
  await back.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 60000 });
  const c = await ev<{ name: string; want: string[]; held: string[] }>(back, read);
  // (its own guns in hand, whatever they are now: HAEFY's id changed with its launcher, Milestone 510)
  check("a pick made after the move is kept over a reload", c.name === "Marksman" && c.held.join() === c.want.join() && c.want.join() !== "r97,sentinel", JSON.stringify(c));
  // put the first back for the pages after this one (they share the browser's storage)
  await ev(back, `[...document.querySelectorAll("#loadoutList button")].find((x) => x.textContent.startsWith("USSO and BOOG")).click()`);
  await back.close();
}

/**
 * The group (the owner, 2026-09-29): "when I send a friend a join link, it needs to put me in the range waiting for
 * him ... once they're joined, we play the game ... I could just pull us both into a new match, whether that's ...
 * battle royale or back to a range". The host waits in the range; the friend who opens the link is in the 1v1 as it
 * always was; the host then moves both into the range together, into a battle royale and back mid-match, with no new
 * code; a friend who opens the same link later lands in the range with them; one who leaves is gone from it.
 */
async function skGroupTest(browser: Browser, Q = "?game=speedkills&net=local&norender"): Promise<void> {
  const host = await open(browser, Q);
  await ev(host, `(() => { const s = document.getElementById("duelMode"); s.value = "arena"; s.dispatchEvent(new Event("change")); document.getElementById("duelPlayers").value = "2"; document.getElementById("duelHost").click(); })()`);
  const got = await host.waitForSelector("#inviteLink", { timeout: 20000 }).then(() => true, () => false);
  const link = got ? await ev<string>(host, `document.getElementById("inviteLink").value`) : "";
  const wait = await ev<{ x: number; z: number; code: string | null; match: boolean }>(host, `(() => { const p = window.__range.player.pos; return { x: +p.x.toFixed(2), z: +p.z.toFixed(2), code: window.__range.lobbyCode(), match: window.__range.duel() !== null }; })()`);
  check("group: the host waits for a friend in the range (not a small map), with the code on the HUD", Math.hypot(wait.x, wait.z) < 1 && !!wait.code && !wait.match, JSON.stringify(wait));
  if (!link) return void (await host.close());
  const guest = await open(browser, new URL(link).search);
  const duel = await Promise.all([host, guest].map((p) => p.waitForFunction(`window.__range.duel()?.mode === "duel"`, { polling: 200, timeout: 30000 }).then(() => true, () => false)));
  const inArena = await ev<{ inside: boolean; x: number; z: number }>(host, `(() => { const d = window.__range.duel(); const b = d.arenaBounds, p = window.__range.player.pos; return { inside: p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ, x: +p.x.toFixed(1), z: +p.z.toFixed(1) }; })()`);
  check("group: the friend who opens the link is in the 1v1 with the host, and the host is in its arena now, as it always was", duel.every(Boolean) && inArena.inside, JSON.stringify({ duel, inArena }));
  const buttons = await Promise.all([host, guest].map((p) => ev<{ text: string; off: boolean }>(p, `(() => { window.__range.menu.pickMode("range"); const b = document.getElementById("playFriends"); return { text: b.textContent, off: b.disabled }; })()`)));
  check("group: the host's With friends is now Start for everyone (2); the friend's says the host picks", buttons[0].text === "Start for everyone (2)" && !buttons[0].off && buttons[1].off && /host picks/.test(buttons[1].text), JSON.stringify(buttons));

  // mid-1v1, the range together
  await ev(host, `document.getElementById("playFriends").click()`);
  const ranged = await Promise.all([host, guest].map((p) => p.waitForFunction(`window.__range.duel() === null && window.__range.hangout()?.mode === "range"`, { polling: 200, timeout: 15000 }).then(() => true, () => false)));
  await Promise.all([host, guest].map((p) => p.waitForFunction(`(window.__range.hangout()?.avatars ?? []).filter((a) => a.group.visible).length === 1`, { polling: 200, timeout: 10000 }).catch(() => undefined)));
  const seen = await Promise.all(
    [host, guest].map((p) =>
      ev<{ role: string; figures: number; x: number; z: number; fire: boolean; status: string }>(
        p,
        `(() => { const h = window.__range.hangout(); const p = window.__range.player.pos; return { role: h?.role, figures: h ? h.avatars.filter((a) => a.group.visible).length : -1, x: +p.x.toFixed(1), z: +p.z.toFixed(1), fire: window.__range.triggerWhy().canFire, status: document.getElementById("duelStatus").textContent }; })()`
      )
    )
  );
  check("group: mid-1v1 the host takes both to the range together, no new code: out of the match, each with the other's figure in view", ranged.every(Boolean) && seen[0].role === "host" && seen[1].role === "guest" && seen.every((s) => s.figures === 1), JSON.stringify({ ranged, seen }));
  check("group: in the range, beside its spawn (the friend a place along), with the range's own rules: the guns fire", Math.hypot(seen[0].x, seen[0].z) < 1 && Math.abs(seen[1].x - 1.6) < 0.3 && Math.abs(seen[1].z) < 0.3 && seen.every((s) => s.fire), JSON.stringify(seen));
  check("group: the friend is told the group is still together and the host picks", /still together/.test(seen[1].status) && /host picks/.test(seen[1].status), seen[1].status);
  // what one does, the other sees: the host's emote on the friend's page
  await ev(host, `window.__range.hangout().localFx("emote", undefined, undefined, 0)`);
  const emote = await guest.waitForFunction(`window.__range.remoteFxLog.some((e) => e.k === "emote" && e.from === 0)`, { polling: 100, timeout: 5000 }).then(() => true, () => false);
  check("group: in the range together the host's emote reaches the friend", emote);

  // from the range, a battle royale for both
  await ev(host, `(() => { ${brRow("duo", 2)}; window.__range.menu.pickMode("br"); document.getElementById("playFriends").click(); })()`);
  const br = await Promise.all([host, guest].map((p) => p.waitForFunction(`window.__range.duel()?.mode === "br" && window.__range.hangout() === null`, { polling: 200, timeout: 15000 }).then(() => true, () => false)));
  const brSame = await Promise.all([host, guest].map((p) => ev<{ poi: string; role: string; id: number }>(p, `(() => { const d = window.__range.duel(); return { poi: d?.poi?.name ?? "", role: d?.role ?? "", id: d?.id ?? -1 }; })()`)));
  check("group: from the range the host starts a battle royale for both, on the same links: one match, one drop", br.every(Boolean) && brSame[0].poi !== "" && brSame[0].poi === brSame[1].poi && brSame[0].role === "host" && brSame[1].role === "guest" && brSame[1].id === 1, JSON.stringify({ br, brSame }));

  // and mid-battle royale, back to the range
  await ev(host, `(() => { window.__range.menu.pickMode("range"); document.getElementById("playFriends").click(); })()`);
  const back = await Promise.all([host, guest].map((p) => p.waitForFunction(`window.__range.duel() === null && window.__range.hangout()?.mode === "range"`, { polling: 200, timeout: 15000 }).then(() => true, () => false)));
  check("group: mid-battle royale the host takes both back to the range", back.every(Boolean), JSON.stringify(back));

  // a friend who opens the same link now comes into the range with them
  const late = await open(browser, new URL(link).search);
  const lateIn = await late.waitForFunction(`window.__range.hangout()?.role === "guest"`, { polling: 200, timeout: 20000 }).then(() => true, () => false);
  await Promise.all([host, guest, late].map((p) => p.waitForFunction(`(window.__range.hangout()?.avatars ?? []).filter((a) => a.group.visible).length === 2`, { polling: 200, timeout: 10000 }).catch(() => undefined)));
  const three = await Promise.all([host, guest, late].map((p) => ev<number>(p, `(() => { const h = window.__range.hangout(); return h ? h.avatars.filter((a) => a.group.visible).length : -1; })()`)));
  const size = await ev<string>(host, `document.getElementById("playFriends").textContent`);
  check("group: a friend opening the same link later lands in the range with them, and all three see the other two", lateIn && three.every((n) => n === 2) && size === "Start for everyone (3)", JSON.stringify({ lateIn, three, size }));

  // the first friend leaves the group: gone from the others' range, the group two again
  await ev(guest, `document.getElementById("duelLeave").click()`);
  const left = await host.waitForFunction(`window.__range.hangout()?.connected === 1`, { polling: 200, timeout: 10000 }).then(() => true, () => false);
  await sleep(800);
  const after = await Promise.all([guest, late].map((p) => ev<{ in: boolean; figures: number }>(p, `(() => { const h = window.__range.hangout(); return { in: !!h, figures: h ? h.avatars.filter((a) => a.group.visible).length : -1 }; })()`)));
  check("group: a friend who leaves is out of the range, and gone from the others' (the group two again)", left && !after[0].in && after[1].in && after[1].figures === 1, JSON.stringify({ left, after }));
  // the last friend goes too: alone in the range, the host picks a 1v1, and the same old link now makes that match
  await ev(late, `document.getElementById("duelLeave").click()`);
  await host.waitForFunction(`window.__range.hangout()?.connected === 0`, { polling: 200, timeout: 10000 }).catch(() => undefined);
  const alone = await ev<{ text: string; code: string | null }>(host, `(() => { window.__range.menu.pickMode("duel"); return { text: document.getElementById("playFriends").textContent, code: window.__range.lobbyCode() }; })()`);
  await ev(host, `(() => { document.getElementById("duelPlayers").value = "2"; document.getElementById("playFriends").click(); })()`);
  const waiting = await ev<{ range: boolean; code: string | null }>(host, `({ range: window.__range.hangout() !== null, code: window.__range.lobbyCode() })`);
  check("group: alone in the range, the host's button is With friends again, and picking a 1v1 waits on the same code", alone.text === "With friends" && !waiting.range && !!alone.code && waiting.code === alone.code, JSON.stringify({ alone, waiting }));
  const next = await open(browser, new URL(link).search);
  const again = await Promise.all([host, next].map((p) => p.waitForFunction(`window.__range.duel()?.mode === "duel"`, { polling: 200, timeout: 30000 }).then(() => true, () => false)));
  const sized = await ev<number>(host, `window.__range.duel()?.players ?? -1`);
  check("group: a friend opening that link now is in the 1v1 with the host, a match for two", again.every(Boolean) && sized === 2, JSON.stringify({ again, sized }));
  for (const p of [next, late, guest, host]) await p.close();
}

/**
 * The owner's asks of 2026-09-29, after the group: no music unless turned up; the battle royale row starting at duos,
 * one squad, 28 bots, the normal ring, landing with the loadout and Casual bots, and Casual bots
 * at 0.75 of their speed; I inspects; and the keys on screen, up until / hides them.
 */
async function skDefaultsTest(browser: Browser): Promise<void> {
  const Q = "?game=speedkills&norender";
  const row = `(() => ({ team: document.getElementById("brTeam").value, sides: document.getElementById("brSides").value, bots: document.getElementById("brBots").value, pace: document.getElementById("brPace").value, start: document.getElementById("brStart").value, difficulty: document.getElementById("botDifficulty").value, music: window.__range.audio.volumes.music }))()`;
  const want = JSON.stringify({ team: "duo", sides: "together", bots: "28", pace: "normal", start: "loadout", difficulty: "easy", music: 0 });
  // a new player: nothing stored
  const fresh = await open(browser, Q, BASE, `if (!sessionStorage.getItem("e2e.d1")) { sessionStorage.setItem("e2e.d1", "1"); for (const k of ["range.brDefaults", "range.br.team.sk", "range.br.bots.sk", "range.br.start", "range.bots.difficulty", "range.audio.v1"]) localStorage.removeItem(k); }`);
  const a = await ev<Record<string, unknown>>(fresh, row);
  check("defaults: a new player's battle royale row is duos, one squad, 28 bots, normal ring, landing with the loadout, Casual; the music at 0", JSON.stringify(a) === want, JSON.stringify(a));
  await fresh.close();
  // a returning one, with trios, 9 bots, loot, Skilled bots and the music at 60% from before
  const OLD = `localStorage.removeItem("range.brDefaults"); localStorage.setItem("range.br.team.sk", "trio"); localStorage.setItem("range.br.bots.sk", "9"); localStorage.setItem("range.br.start", "loot"); localStorage.setItem("range.bots.difficulty", "normal"); localStorage.setItem("range.audio.v1", JSON.stringify({ master: 0.8, effects: 1, hits: 1, voice: 0.8, music: 0.6 }));`;
  const back = await open(browser, Q, BASE, `if (!sessionStorage.getItem("e2e.d2")) { sessionStorage.setItem("e2e.d2", "1"); ${OLD} }`);
  const b = await ev<Record<string, unknown>>(back, row);
  check("defaults: a returning player is moved onto them once, the music included", JSON.stringify(b) === want, JSON.stringify(b));
  // they choose trios and turn the music up: after a reload it is theirs
  await ev(back, `(() => { const t = document.getElementById("brTeam"); t.value = "trio"; t.dispatchEvent(new Event("change")); window.__range.audio.setVolumes({ music: 0.4 }); })()`);
  await back.reload({ waitUntil: "domcontentloaded" });
  await back.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 60000 });
  const c = await ev<{ team: string; music: number }>(back, row);
  check("defaults: a choice made after that is kept over a reload", c.team === "trio" && c.music === 0.4, JSON.stringify(c));
  await ev(back, `(() => { const t = document.getElementById("brTeam"); t.value = "duo"; t.dispatchEvent(new Event("change")); window.__range.audio.setVolumes({ music: 0 }); })()`);
  await back.close();

  // Casual bots at 0.75 of their speed, the other tiers as they were
  const page = await open(browser, Q);
  const speeds = await ev<Record<string, number>>(page, `(() => { const r = window.__range; return Object.fromEntries(["easy", "normal"].map((t) => [t, r.botSpeedOf(t)])); })()`);
  const base = skCfg.botSpeedScale ?? 1;
  check("casual: a Casual bot moves at 0.75 of its tier's speed, a Skilled one as it did", Math.abs(speeds.easy - botsCfgE2e.tiers.easy.speed * base * 0.75) < 1e-6 && Math.abs(speeds.normal - botsCfgE2e.tiers.normal.speed * base) < 1e-6, JSON.stringify(speeds));

  // the keys on screen: up by default, I inspects, / hides them, and hidden stays hidden
  await pressPlay(page);
  await sleep(800);
  const hints = await ev<{ rows: Array<{ label: string; keys: string[] }>; hide: string } | null>(page, "window.__range.hud.last?.keyHints ?? null");
  const inspectRow = hints?.rows.find((r) => /Inspect/.test(r.label));
  check("keys: up on screen by default, Inspect on I and the hide key named", !!hints && hints.rows.length >= 12 && inspectRow?.keys[0] === "I" && hints.hide === "/", JSON.stringify({ rows: hints?.rows.length, inspect: inspectRow, hide: hints?.hide }));
  // the keys themselves (a scripted page has no pointer lock: the lock flag stands in)
  await ev(page, "window.__range.input.locked = true");
  await ev(page, "(() => { const s = window.__range.loadout.active.state; s.clip = window.__range.loadout.active.weapon.clipSize; })()");
  await page.keyboard.press("KeyI");
  await sleep(500);
  const inspecting = await ev<boolean>(page, "window.__range.vmState().inspecting");
  check("keys: I turns the gun over (inspect had no key of its own)", inspecting);
  await ev(page, "window.__range.input.locked = true");
  await page.keyboard.press("Slash");
  await sleep(500);
  const hidden = await ev<{ hints: unknown; stored: string | null }>(page, `({ hints: window.__range.hud.last?.keyHints ?? null, stored: localStorage.getItem("range.keyHints") })`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 60000 });
  await pressPlay(page);
  await sleep(800);
  const still = await ev<unknown>(page, "window.__range.hud.last?.keyHints ?? null");
  check("keys: / hides them, and they stay hidden after a reload", hidden.hints === null && hidden.stored === "off" && still === null, JSON.stringify({ hidden, still }));
  // back up for the pages after this one (they share the browser's storage)
  await ev(page, `localStorage.setItem("range.keyHints", "on")`);
  await page.close();
}

/**
 * The red orb (the owner, 2026-09-29, and three times before): the outline round the enemy you aim at is a hull pushed
 * out along each mesh's normals, in the mesh's own units, and one push was taken off the figure's first mesh for all
 * of them. The bought guns in a figure's hands are drawn at scale 100, so their hulls stood 100 times too far out: a
 * red ball metres wide round a bot. Every hull must stand out the width asked for, the scale-100 parts too.
 */
async function skOutlineTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?game=speedkills&norender");
  // the bought soldier and guns in first: a figure made before them keeps its stand-in body and gun for the match
  await page.waitForFunction("window.__range.loaded() && window.__range.paidGuns().ready && window.__range.soldierReady()", { polling: 250, timeout: 120000 }).catch(() => undefined);
  await ev(page, `(() => { document.getElementById("botCount").value = "1"; document.getElementById("botDifficulty").value = "normal"; window.__range.startBots(); })()`);
  await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 60000 }).catch(() => undefined);
  // the bot on the rifle, whose bought model is the one with scale-100 parts (a bot 1v1 draws its bot's gun at
  // random, and the Bot guns box is the modes'; on another gun this check measured nothing that could go wrong)
  await ev(page, `(() => { const b0 = window.__range.duel()?.bots?.[0]; if (b0) (b0.bot ?? b0).setWeapon("rspn101"); })()`);
  // the bot's figure with a bought gun in its hands (the scale-100 parts), its outline on at 2 cm
  const read = `(() => { const r = window.__range; const d = r.duel(); const b0 = d?.bots?.[0]; if (!b0) return null; const fig = (b0.bot ?? b0).dummy;
    fig.setOutline(true, 0.02, 0xff2a3a, 0.12);
    // every hull, drawn or not: which of the gun's parts are drawn is a level of detail a ?norender page never updates
    const st = fig.outline.state();
    return { widths: st.hulls.map((h) => +h.width.toFixed(4)), big: st.hulls.filter((h) => h.scale >= 10).length, on: st.on }; })()`;
  const got = await page.waitForFunction(`(() => { const x = ${read}; return x && x.big > 0 && x.on > 0 ? x : null; })()`, { polling: 500, timeout: 30000 }).then((h) => h.jsonValue() as Promise<{ widths: number[]; on: number; big: number }>, () => null);
  const off = got ? got.widths.filter((w) => Math.abs(w - 0.02) > 0.0005) : [];
  if (!got) console.log("  --  outline read:", await ev<string>(page, `(() => { try { return JSON.stringify(${read}); } catch (e) { return "threw: " + e.message; } })()`).catch((e) => String(e)));
  check("outline: every hull round an enemy stands 2 cm out, the bought gun's scale-100 parts too (they stood 2 m out: the red orb)", !!got && got.on > 0 && got.big > 0 && off.length === 0, JSON.stringify({ hulls: got?.widths.length, big: got?.big, off: off.slice(0, 6) }));
  await page.close();
}

/**
 * What the bug hunt of 2026-09-30 found (every mode played by a scripted player, a watchdog in the page): battle royale
 * bots standing still for the rest of a match under a deck or inside a care package, the city's loop streamed with the
 * music at nothing, and the soldier's body fetched twice.
 */
async function skHuntTest(browser: Browser): Promise<void> {
  // the Neon City's graph (its decks, the court 7 m down): a battle royale on it, bots landed
  const page = await open(browser, "?norender&game=speedkills&map=neon");
  await ev(page, brRow("solo", 9));
  await ev(page, `(() => { document.getElementById("brStart").value = "loadout"; document.getElementById("goBr").click(); document.getElementById("startMode").click(); })()`);
  const landed = await page.waitForFunction(`window.__range.duel()?.phase === "fight" && window.__range.duel().bots.some((b) => b.landed && b.bot.alive && !b.guard)`, { polling: 200, timeout: 60000 }).then(() => true, () => false);
  const bots = await ev<{ deck: number; street: number; sky: number; floor: number; floorY: number | null; floorLinks: number; before: number; after: number; afterY: number | null; stand: number; side: boolean; done: boolean } | { none: string }>(
    page,
    `(() => {
      const R = window.__range; const d = R.duel(); d.holdFire = true;
      const nodes = d.map.nodes;
      // a bot at street height 0.3 m off a deck node's (x, z), 5 m and more below it, its node the deck: it stands under
      // it for good. (Any deck: the map's layout changes, and the bot is put there, not found there.)
      // (one with no other node within a metre of its (x, z): from the sky the deck is then the nearest, not a tie with one under it)
      const deck = nodes.findIndex((n, i) => (n.y ?? 0) >= 5 && !n.hall && n.links.length > 0 && !nodes.some((m, j) => j !== i && Math.hypot(m.x - n.x, m.z - n.z) < 1));
      if (deck < 0) return { none: "no deck node" };
      const street = -1;
      const qx = nodes[deck].x + 0.3, qz = nodes[deck].z;
      const b = d.bots.find((x) => x.landed && x.bot.alive && !x.guard && !x.down);
      if (!b) return { none: "no bot landed" };
      // where a bot at street height there takes itself to be: on its own floor, a node with links; from the sky, the deck
      const floor = d.nearestNode(qx, qz, 0);
      const sky = d.nearestNode(qx, qz);
      // stood under the deck with the deck its node: unstick, now and 2.5 s on
      b.bot.pos.set(qx, 0, qz);
      b.node = b.goal = deck;
      const t = performance.now() / 1000;
      d.unstick(b, t);
      const before = b.goal;
      d.unstick(b, t + 2.5);
      const after = b.goal;
      // a care package 20 m off, landed and hot: the bot stands 4 m short of it on its own side, and once there it is done with it
      const V = R.THREE.Vector3; const at = new V(b.bot.pos.x + 20, 0, b.bot.pos.z);
      d.pods.push({ id: 4242, at, hotUntil: t + 60, landed: true });
      const g = d.podToContest(b.bot.pos, b);
      b.bot.pos.set(at.x - 3, 0, at.z);
      const there = d.podToContest(b.bot.pos, b);
      d.pods.splice(d.pods.findIndex((p) => p.id === 4242), 1);
      return { deck, street, sky, floor, floorY: nodes[floor].y ?? null, floorLinks: nodes[floor].links.length, before, after, afterY: nodes[after].y ?? null,
        stand: g ? Math.hypot(g.x - at.x, g.z - at.z) : -1, side: !!g && g.x < at.x, done: there === null && !!b.podsDone && b.podsDone.has(4242) };
    })()`,
  );
  const ok = landed && !("none" in bots);
  const b = bots as Exclude<typeof bots, { none: string }>;
  // (from the sky, by (x, z) alone, the deck is the nearest: which is what a landed bot used to keep)
  check("hunt: a landed bot takes the nearest node on its own floor with links, not the deck over its head (it stood under one for good)", ok && b.sky === b.deck && b.floor !== b.deck && Math.abs(b.floorY ?? 0) < 2.5 && b.floorLinks > 0, JSON.stringify(bots));
  check("hunt: a bot stood under its node (a deck 5 m and more over it) takes one on its own floor after 2 s, not before", ok && b.before === b.deck && b.after !== b.deck && Math.abs(b.afterY ?? 0) < 2.5, JSON.stringify(bots));
  check("hunt: a bot lured to a care package stands 4 m off it on its own side, and there it is done with it (two stood inside one, blind to each other)", ok && Math.abs(b.stand - 4) < 0.2 && b.side && b.done, JSON.stringify(bots));
  // the killcam of an elimination in it (killcam.ts): its figures one a frame, the victim's first, the killer's never.
  // Built all on its first frame they were every actor in the match, 30, and that frame took 0.43 to 0.55 s.
  await gameSleep(page, 5);
  const kcRun = await ev<{ victim: number; killer: number; seen: number[][]; active: boolean }>(
    page,
    `new Promise((ok) => {
      const R = window.__range; const d = R.duel();
      const killer = d.bots.find((x) => x.landed && x.bot.alive && !x.guard).bot.remote.id;
      const seen = [];
      R.setScript({ held: () => false, pressedNow: () => false }, () => { const k = R.killcamState(); if (k.active && seen.length < 8) seen.push(k.ghosts.slice()); });
      d.shield = 0; d.health = 1;
      d.hurt(500, killer, "r97", 10);
      const t0 = performance.now();
      const step = () => { if (seen.length >= 8 || performance.now() - t0 > 20000) { R.setScript(null); return ok({ victim: d.id, killer, seen, active: R.killcamState().active }); } setTimeout(step, 50); };
      step();
    })`,
  );
  const grows = kcRun.seen.every((g, i) => i === 0 || g.length - kcRun.seen[i - 1].length <= killcamCfg.ghostsAFrame);
  const firstGhost = kcRun.seen.find((g) => g.length > 0)?.[0];
  check(
    "hunt: a battle royale's killcam builds its figures one a frame, the victim's first and the killer's never (all on its first frame, 30 of them, it froze for half a second)",
    kcRun.seen.length >= 8 && grows && kcRun.seen[0].length <= 1 && firstGhost === kcRun.victim && !kcRun.seen.some((g) => g.includes(kcRun.killer)) && (kcRun.seen.at(-1)?.length ?? 0) > 1,
    JSON.stringify({ victim: kcRun.victim, killer: kcRun.killer, counts: kcRun.seen.map((g) => g.length), first: kcRun.seen.slice(0, 3) }),
  );
  await page.close();
  // drawn: the soldier's body and textures fetched once, and the city's loop not fetched at all while the music is at nothing
  const arena = await open(browser, "?game=speedkills");
  await arena.waitForFunction("window.__range.loaded()", { polling: 250, timeout: 120000 }).catch(() => undefined);
  // (SpeedKills' own soldier's: its pages stopped loading the legacy body, T_Superhero_Male_Dark, which counted 0 here in
  // the 2026-10-04 sweep: not fetched twice, but not this check's figure any more)
  const body = await ev<number>(arena, `performance.getEntriesByType("resource").filter((e) => /\\/soldier\\/tex\\/body_color/.test(e.name)).length`);
  check("hunt: the soldier's body texture is fetched once (it was twice: the body loaded on its own and again for a figure)", body === 1, String(body));
  // the hands' pickup clip fetched once, with the second gun's hands loaded too (each gun's set of clips fetched it
  // again: a hunt, 2026-10-01)
  await ev(arena, "(() => { const R = window.__range; R.loadout.requestSwap(1 - R.loadout.activeIndex, R.gameTime()); })()");
  await gameSleep(arena, 4);
  const pickups = await ev<number>(arena, `performance.getEntriesByType("resource").filter((e) => /A_FP_PickUp_Item/.test(e.name)).length`);
  check("hunt: the hands' pickup clip is fetched once, a second gun's hands loaded as well (each gun's fetched it again)", pickups === 1, String(pickups));
  await ev(arena, `(() => { window.__range.audio.setVolumes({ music: 0 });document.getElementById("goBots").click(); document.getElementById("startMode").click(); })()`);
  await arena.waitForFunction("window.__range.duel()?.phase === 'fight' || window.__range.duel()?.phase === 'countdown'", { polling: 200, timeout: 30000 }).catch(() => undefined);
  await sleep(1500);
  const silent = await ev<{ on: boolean; el: boolean }>(arena, "(() => { const a = window.__range.audio; return { on: a.ambienceState.on, el: !!a.ambEl && !a.ambEl.paused }; })()");
  await ev(arena, "window.__range.audio.setVolumes({ music: 0.3 })");
  await sleep(1500);
  const heard = await ev<{ on: boolean; el: boolean }>(arena, "(() => { const a = window.__range.audio; return { on: a.ambienceState.on, el: !!a.ambEl && !a.ambEl.paused }; })()");
  await ev(arena, "window.__range.audio.setVolumes({ music: 0 })");
  check("hunt: the city's loop is on under a match but not fetched or played with the music at nothing, and plays once the slider is up", silent.on && !silent.el && heard.on && heard.el, JSON.stringify({ silent, heard }));
  // a bot's figure is culled as anything else is, by a sphere round it (mannequin.ts cullAsFigure): drawn 4 m in front
  // of you standing and fallen, and not drawn with you facing away. Never culled, every figure in a match was drawn
  // every frame wherever it stood (2026-10-01). Its skinned meshes are counted as three draws them (onBeforeRender).
  const drawn = (yaw: number, fall: boolean) =>
    ev<{ n: number; meshes: number }>(
      arena,
      `new Promise((ok) => { const R = window.__range; const d = R.duel(); d.holdFire = true; const b = d.bots[0];
        // playing, as a player is (with the menu up the view is the menu's, not yours)
        R.input.locked = true; document.getElementById("overlay").classList.add("hidden");
        ${fall ? "b.dummy.fallDown();" : ""}
        // counted over frames, not time: the suite's pages draw in software, a frame of the city a second and more
        const meshes = []; b.dummy.group.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); }); let n = 0; let f = 0;
        const step = () => { R.player.teleport(b.pos.x, b.pos.y, b.pos.z + 4, ${yaw}, 0); f++;
          if (f === 3) for (const m of meshes) m.onBeforeRender = () => { n++; };
          if (f === 6) { for (const m of meshes) m.onBeforeRender = () => {}; return ok({ n, meshes: meshes.length }); }
          requestAnimationFrame(step); };
        requestAnimationFrame(step); })`,
    );
  const front = await drawn(0, false);
  const back = await drawn(180, false);
  const fallen = await drawn(0, true);
  check(
    "hunt: a bot's figure is drawn in front of you, standing and fallen, and not drawn behind you (every figure was drawn every frame)",
    front.meshes > 0 && front.n > 0 && back.n === 0 && fallen.n > 0,
    JSON.stringify({ front, back, fallen }),
  );
  await arena.close();
}

/**
 * The range's armory (armory.ts; the owner, 2026-09-30: "the back end of the firing range to show the 10 guns ... make
 * each hack and gun have a tv behind it showing details on the gun, what it is, how to fuse ... Same for hacks"): the
 * ten guns and the ten hacks on the back wall clear of the gates, each on its case with its hologram and its screen
 * drawn; each case solid, the size measured off it; at a stand E takes it and E again fuses it a level up, to its top
 * and no further, the prompt saying which, and the stand's screen drawn again and its hologram's skin changed as the
 * level goes up.
 */
async function skArmoryTest(browser: Browser): Promise<void> {
  // drawn: a ?norender page builds no armory (its screens are for a player to read)
  const page = await open(browser, "?game=speedkills");
  await ev(page, "window.__range.input.locked = true");
  type Stand = { kind: string; id: string; x: number; z: number; drawn: string; stand: boolean; dressed: boolean; skin: string; box: number[] | null };
  const ready = await page
    .waitForFunction(`(() => { const a = window.__range.armory(); return !!a && a.stands.every((s) => s.drawn && s.stand && s.dressed); })()`, { polling: 250, timeout: 90000 })
    .then(() => true, () => false);
  const stands = (await ev<Stand[] | null>(page, "window.__range.armory()?.stands ?? null")) ?? [];
  const guns = stands.filter((s) => s.kind === "gun").map((s) => s.id);
  const hacks = stands.filter((s) => s.kind === "hack").map((s) => s.id);
  // every screen clear of the gates' lit posts (0.1 m out from a gate, 0.2 m wide) and inside the side walls (x 34)
  const half = armoryCfg.tv.w / 2;
  const GATES = [[-23.5, -19.5], [-2, 2], [19.5, 23.5]];
  const clear = stands.every((s) => GATES.every(([l, r]) => s.x + half < l - 0.2 || s.x - half > r + 0.2) && Math.abs(s.x) + half < 34);
  check(
    "armory: the ten guns and the ten hacks on the range's back wall, clear of the gates, each on its case with its hologram and its screen drawn",
    ready && guns.join() === armoryCfg.guns.join() && hacks.join() === armoryCfg.hacks.join() && clear && stands.every((s) => (s.x < 0) === (s.kind === "gun")),
    JSON.stringify({ ready, guns, hacks, clear, at: stands.map((s) => `${s.id}@${s.x.toFixed(2)}${s.drawn ? "" : " undrawn"}${s.stand ? "" : " nocase"}${s.dressed ? "" : " plain"}`) }),
  );
  // each case is a solid the size armory.json's solid says, held to the case as measured off the loaded model
  const S = armoryCfg.solid;
  const solids = await ev<Array<{ minX: number; maxX: number; minZ: number; maxZ: number; top: number }>>(page, "window.__range.solids.map((s) => ({ minX: s.minX, maxX: s.maxX, minZ: s.minZ, maxZ: s.maxZ, top: s.top }))");
  const near3 = (a: number, b: number) => Math.abs(a - b) < 0.03;
  const off = stands.filter((s) => {
    const b = s.box;
    const fits = !!b && near3(b[0], S.minX) && near3(b[1], S.maxX) && near3(b[2], S.top) && near3(b[3], S.minZ) && near3(b[4], S.maxZ);
    const has = solids.some((o) => near3(o.minX, s.x + S.minX) && near3(o.maxX, s.x + S.maxX) && near3(o.minZ, s.z + S.minZ) && near3(o.maxZ, s.z + S.maxZ) && near3(o.top, S.top));
    return !fits || !has;
  });
  // walked into, a case stops you at its face
  const gunAt = stands.find((s) => s.id === "vinson");
  await ev(page, `window.__range.player.teleport(${gunAt?.x ?? 0}, 0, ${(gunAt?.z ?? 0) - 1.6}, 180, 0)`);
  await ev(page, `window.__range.setScript({ held: (a) => a === "forward", pressedNow: () => false })`);
  await gameSleep(page, 1.2);
  await ev(page, "window.__range.setScript(null)");
  const stopped = await ev<number>(page, "window.__range.player.pos.z");
  const face = (gunAt?.z ?? 0) + S.minZ;
  check(
    "armory: each stand's case is solid, its box the case's own as it stands, and walking into one stops you at its face",
    off.length === 0 && stopped < face && stopped > face - 0.8,
    JSON.stringify({ off: off.map((s) => `${s.id} ${JSON.stringify(s.box)}`), solid: S, stopped, face }),
  );
  const go = (id: string) => ev(page, `(() => { const r = window.__range; const s = r.armory().stands.find((t) => t.id === "${id}"); r.player.teleport(s.x, 0, s.z - 1.6, 180, 0); })()`);
  // E for one frame, as a key press is
  const press = async () => {
    await ev(page, `(() => { window.__armK = 0; window.__range.setScript({ held: () => false, pressedNow: (a) => a === "interact" && window.__armK === 2 }, () => { window.__armK++; }); })()`);
    await page.waitForFunction("window.__armK > 5", { polling: 30, timeout: 15000 }).catch(() => undefined);
    await ev(page, "window.__range.setScript(null)");
    await gameSleep(page, 0.1);
  };
  type Seen = { held: Array<string | null>; prompt: string | null; near: string | null; redraws: number; stand: Stand; hack: { id: string; level: number } | null };
  const seen = (id: string) =>
    ev<Seen>(
      page,
      `(() => { const r = window.__range; const a = r.armory(); return { held: r.loadout.slots.map((s) => s.empty ? null : s.id + ":" + (s.fusion ?? 0)), prompt: r.prompt()?.text ?? null, near: a.near(), redraws: a.redraws, stand: a.stands.find((s) => s.id === "${id}"), hack: r.sk.hacks().find((h) => h.slot === "mobility").held }; })()`,
    );
  // a gun not carried (a new player holds the USSO and the BOOG): looked at, the prompt offers it; E takes it
  const GUN = "launcher";
  const TOP = skCfg.fusion.levels;
  await go(GUN);
  await gameSleep(page, 0.2);
  const g0 = await seen(GUN);
  await press();
  const g1 = await seen(GUN);
  check(
    "armory: in front of a gun's stand the prompt offers it, and E takes it into your hands at level 0",
    g0.near === GUN && /^TAKE /.test(g0.prompt ?? "") && !g0.held.some((h) => h?.startsWith(`${GUN}:`)) && g1.held.includes(`${GUN}:0`) && /^FUSE .*LEVEL 0 TO 1/.test(g1.prompt ?? ""),
    JSON.stringify({ g0, g1 }),
  );
  // E again, and again: a level up each time to the top, the screen drawn again and the skin changed on the way
  const levels: number[] = [];
  for (let i = 0; i < TOP; i++) {
    await press();
    const s = await seen(GUN);
    levels.push(Number(s.held.find((h) => h?.startsWith(`${GUN}:`))?.split(":")[1] ?? -1));
  }
  const gTop = await seen(GUN);
  await press();
  const gOver = await seen(GUN);
  check(
    `armory: E at a gun you carry fuses it a level up each time, to ${TOP} and no further, and its stand is drawn again at each level, its skin changed on the way`,
    levels.join() === Array.from({ length: TOP }, (_, i) => i + 1).join() && /ITS TOP/.test(gTop.prompt ?? "") && gOver.held.includes(`${GUN}:${TOP}`) && gTop.redraws >= g1.redraws + TOP && gTop.stand.drawn.startsWith(`${TOP}|`) && g1.stand.skin !== gTop.stand.skin,
    JSON.stringify({ levels, gTop: { prompt: gTop.prompt, held: gTop.held, drawn: gTop.stand.drawn, skin: gTop.stand.skin, redraws: gTop.redraws }, g1: { drawn: g1.stand.drawn, skin: g1.stand.skin, redraws: g1.redraws }, over: gOver.held }),
  );
  // a hack: E takes it into its slot (the mobility one, for the GRAPPLE), and fuses it a level up each time, to its top
  const HACK = "grapple";
  const HTOP = hacksCfg.fuseLevels;
  await go(HACK);
  await gameSleep(page, 0.2);
  const h0 = await seen(HACK);
  await press();
  const h1 = await seen(HACK);
  const hl: number[] = [];
  for (let i = 0; i < HTOP; i++) {
    await press();
    hl.push((await seen(HACK)).hack?.level ?? -1);
  }
  const hTop = await seen(HACK);
  await press();
  const hOver = await seen(HACK);
  check(
    `armory: E at a hack's stand takes it into its slot, and again fuses it a level up each time, to ${HTOP} and no further, its screen drawn again`,
    h0.near === HACK && /^TAKE /.test(h0.prompt ?? "") && h0.hack?.id !== HACK && h1.hack?.id === HACK && h1.hack.level === 0 && hl.join() === Array.from({ length: HTOP }, (_, i) => i + 1).join() && /ITS TOP/.test(hTop.prompt ?? "") && hOver.hack?.level === HTOP && hTop.stand.drawn.startsWith(`${HACK}:${HTOP}|`),
    JSON.stringify({ h0: { prompt: h0.prompt, hack: h0.hack }, h1: h1.hack, hl, hTop: { prompt: hTop.prompt, drawn: hTop.stand.drawn }, over: hOver.hack }),
  );
  await page.close();
}

/**
 * SpeedKills' order of things (the owner, 2026-09-29): "the basic speed kills with the progress bar is all we want them
 * to see whenever we are loading things, then once that's done, then we put the animation specific screen up (depending
 * on which mode they are playing), then when that finishes playing, then we start the drop ship and / or other modes".
 * The one SpeedKills page in the suite with the card on.
 */
async function skIntroTest(browser: Browser): Promise<void> {
  // drawn: a ?norender page never builds the first-person arms, one of the late steps the loading screen waits on.
  // The ship on (open() drops straight in): the way in is the ship's to hold.
  const page = await open(browser, "?game=speedkills&intro=on", BASE, "window.__straightDrop = false");
  // while it loads: the loading screen, its bar, and no card; and it goes only once everything the card waits on is in
  const boot = await ev<{ everCard: boolean; bar: boolean; atHide: { loaded: boolean; secs: number; status: string; waited: boolean; kind: string | null } | null }>(
    page,
    `new Promise((ok) => { const R = window.__range; const L = document.getElementById("loading"); let everCard = false; let bar = false; const t0 = performance.now();
      const step = () => { const s = R.intro.state(); if (s.kind !== null) everCard = true; if (L && !L.hidden && !L.classList.contains("done") && document.getElementById("loadingFill")) bar = true;
        const gone = !L || L.hidden || L.classList.contains("done");
        const st = document.getElementById("loadingStatus")?.textContent ?? "";
        if (!gone && /READY/.test(st)) window.__waitedLate = true;
        // (the screen's own state: loaded() waits for what comes in after it too, Milestones 426 and 430)
        if (gone) return ok({ everCard, bar, atHide: { loaded: R.screenLoaded ? R.screenLoaded() : R.loaded(), secs: (performance.now() - t0) / 1000, status: st, waited: !!window.__waitedLate, kind: s.kind } });
        if (performance.now() - t0 > 120000) return ok({ everCard, bar, atHide: null });
        setTimeout(step, 50); };
      step(); })`
  );
  const after = await ev<{ played: number; kind: string | null }>(page, `(() => { const s = window.__range.intro.state(); return { played: s.played, kind: s.kind }; })()`);
  check("sk order: while it loads, the loading screen and its bar and no card; no card when it goes either", !boot.everCard && boot.bar && after.played === 0 && after.kind === null, JSON.stringify({ boot, after }));
  // it goes by itself once everything asked for is in and the late steps (the bought guns, the figures) are done, not
  // on its time limit (hud.json loading.maxSeconds). (Its count can run on after it has gone: a page asks for a few
  // more files as it settles, and the line keeps counting under the fade.)
  check("sk order: the loading screen goes by itself once everything is in, not on its time limit", !!boot.atHide && boot.atHide.loaded && boot.atHide.secs < hudCfgE2e.loading.maxSeconds, JSON.stringify(boot.atHide));
  // A battle royale (the owner, 2026-09-30, of the order before: "it loads the map, then the animation matrix, then it
  // shows our gun while it like loads the map again or something with black background, then we are in the ship"):
  // the loading screen at once, the ship boarded under it, the card over the ship, and the ship off once it has gone.
  // What the player would see, sampled every 30 ms from the click: which of the screen and the card is up, and the ship.
  type Seen = { t: number; screen: boolean; card: boolean; built: boolean; phase: string | null; aboard: boolean; doorsIn: number | null; startAt: number | null; line: string };
  const seen = await ev<{ atClick: Seen; rows: Seen[] }>(
    page,
    `new Promise((ok) => { const R = window.__range; const L = document.getElementById("loading"); const t0 = performance.now(); const rows = []; let cardGone = 0;
      const look = () => { const d = R.duel(); const now = performance.now();
        return { t: +((now - t0) / 1000).toFixed(3), screen: !!L && !L.hidden && !L.classList.contains("done"), card: R.intro.state().kind === "match", built: !!d, phase: d ? d.phase : null, aboard: R.player.aboard, doorsIn: d && d.ship ? +d.ship.doorsIn(now / 1000).toFixed(2) : null, startAt: d && d.ship ? d.ship.startAt : null, line: document.getElementById("loadingStatus")?.textContent ?? "" }; };
      document.getElementById("goBr").click(); document.getElementById("startMode").click();
      // the pointer as a real click takes it (a test's click is no gesture a browser gives the pointer for)
      R.input.locked = true;
      const atClick = look();
      const step = () => { const s = look(); rows.push(s);
        if (rows.some((r) => r.card) && !s.card && !cardGone) cardGone = performance.now();
        if ((cardGone && performance.now() - cardGone > 1500) || performance.now() - t0 > 60000) return ok({ atClick, rows });
        setTimeout(step, 30); };
      step(); })`,
  );
  const rows = seen.rows;
  const cardFrom = rows.findIndex((r) => r.card);
  const before = cardFrom < 0 ? rows : rows.slice(0, cardFrom);
  const under = cardFrom < 0 ? [] : rows.slice(cardFrom).filter((r) => r.card);
  const last = rows[rows.length - 1];
  const full = Math.max(...rows.map((r) => r.doorsIn ?? 0));
  const brief = (r?: Seen) => (r ? `${r.t}s screen ${r.screen} card ${r.card} ${r.phase} aboard ${r.aboard} doors ${r.doorsIn} "${r.line}"` : "none");
  // where the time went, for a run that took long: the screen's line as it changed, and when the match started
  const lines = before.filter((r, i) => i === 0 || r.line !== before[i - 1].line || r.phase !== before[i - 1].phase).map((r) => `${r.t}s ${r.phase ?? "-"} "${r.line}"`);
  console.log(`  --  from Start to the card: ${lines.join("; ")}`);
  check("sk order: Start puts the loading screen up at once, before the match is built (the menu stood frozen through the build)", seen.atClick.screen && !seen.atClick.built, brief(seen.atClick));
  const bare = before.find((r) => !r.screen);
  check("sk order: from Start to the card the loading screen is up the whole time: never the range, the gun on black, or the ship", cardFrom > 0 && !bare, `card from ${brief(rows[cardFrom])}; bare ${brief(bare)}`);
  check("sk order: the card plays over the ship: you are aboard under it, the match started", cardFrom > 0 && rows[cardFrom].aboard && rows[cardFrom].phase === "countdown", brief(rows[cardFrom]));
  // Held, the ship's clock is moved on to each frame's time (brmatch.ts holdShip), so its start keeps up with the card;
  // let go, its start stays where it was. (Its doors' count read between two frames is a frame's time along: in the
  // software drawing the suite runs on, a frame on the ship took over a second.)
  const firstUnder = under[0];
  const lastUnder = under[under.length - 1];
  const cardLong = under.length ? lastUnder.t - firstUnder.t : 0;
  const kept = under.length && firstUnder.startAt !== null && lastUnder.startAt !== null ? lastUnder.startAt - firstUnder.startAt : 0;
  check("sk order: the ship waits at its start while the loading screen and the card are up (its clock held with the card)", cardLong > 1.5 && full > 1 && kept > cardLong * 0.5, `full ${full}; the card ${cardLong.toFixed(2)} s; the ship's start moved on ${kept.toFixed(2)} s with it`);
  check("sk order: once the card has gone the ship sets off", !last.card && last.aboard && last.doorsIn !== null && last.doorsIn < full - 0.5, brief(last));
  // the match's own things (its bots, their guns, the floor's loot) have their shaders while you ride, before the ship
  // flies over them (main.ts warmMatch): drawn first from the ship, they were compiled on that frame, 0.25 s about 9 s
  // into the ride (a hunt, 2026-10-01)
  const unready = await ev<{ total: number; n: number; without: string[] }>(
    page,
    `(() => { const R = window.__range; const skip = new Set([R.scene.getObjectByName("range-side"), R.scene.getObjectByName("br-side")]);
      let total = 0; const without = [];
      for (const c of R.scene.children) {
        if (skip.has(c) || c.isLight || c.isCamera) continue;
        c.traverse((o) => { if (!o.isMesh && !o.isSprite) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!m) continue; total++; const pr = R.renderer.properties.get(m); if (!pr || !pr.currentProgram) without.push((c.name || c.type) + ":" + (o.name || m.type)); } });
      }
      return { total, n: without.length, without: without.slice(0, 12) }; })()`,
  );
  check("sk order: aboard, the match's own figures and loot have their shaders before the ship flies over them", unready.total > 50 && unready.n === 0, JSON.stringify(unready));
  await page.close();
}

/** a soldier nobody has by default (soldier.ts code: RUNNER, its colours, the helmet off), so seeing it is seeing it sent */
const FRIEND_SOLDIER = "S3343041";

async function brFriendsJoinTest(browser: Browser): Promise<void> {
  // each page wears FRIEND_SOLDIER from its first frame (pages share one localStorage; the saved one goes back after)
  const wear = `window.__savedSoldier = localStorage.getItem("range.sk.soldier"); localStorage.setItem("range.sk.soldier", "${FRIEND_SOLDIER}")`;
  const host = await open(browser, "?norender&game=speedkills", BASE, wear);
  const saved = await ev<string | null>(host, "window.__savedSoldier");
  const g1 = await open(browser, "?norender&game=speedkills", BASE, wear);
  const g2 = await open(browser, "?norender&game=speedkills", BASE, wear);
  const pages = [host, g1, g2];
  const closeAll = async () => {
    await ev(host, saved === null ? `localStorage.removeItem("range.sk.soldier")` : `localStorage.setItem("range.sk.soldier", ${JSON.stringify(saved)})`);
    for (const p of pages) await p.close();
  };
  // each choice made as a player makes it, its change event and all: the players count follows the squad size on
  // that event, and a value set without it left the count at whatever squad an earlier section had saved
  await ev(host, `(() => { const pick = (id, v) => { const s = document.getElementById(id); s.value = v; s.dispatchEvent(new Event("change")); }; pick("duelMode", "br"); pick("brTeam", "trio"); pick("brSides", "together"); document.getElementById("duelHost").click(); })()`);
  let code = "";
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
  } catch {
    check("sk friends: the host of a battle royale gets a code", false, await ev<string>(host, `document.getElementById("duelStatus").textContent`));
    await closeAll();
    return;
  }
  for (const g of [g1, g2]) {
    await ev(g, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    await g.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 20000 }).catch(() => undefined);
    await sleep(1500);
  }
  await sleep(2000);
  const got = await Promise.all(pages.map((p) => ev<{ in: boolean; players: number; connected: number; status: string }>(p, `(() => { const d = window.__range.duel(); return { in: !!d, players: d ? d.players : 0, connected: d ? d.connected : 0, status: document.getElementById("duelStatus").textContent.slice(0, 120) }; })()`)));
  check(
    "sk friends: two friends both join the host's trio battle royale, and neither is sent back to the lobby",
    got.every((x) => x.in) && got[0].connected === 2,
    JSON.stringify(got),
  );
  // the soldier each picked goes with them (S8): the host's figure of each friend is built from their soldier's code
  const looks = await host
    .waitForFunction(`(() => { const l = [...window.__range.duel().remotes.values()].map((r) => r.avatarLook ?? ""); return l.length === 2 && l.every((x) => x.split("|").includes("${FRIEND_SOLDIER}")); })()`, { polling: 250, timeout: 15000 })
    .then(() => null, () => ev<string[]>(host, `[...window.__range.duel().remotes.values()].map((r) => r.avatarLook ?? "")`));
  check("sk friends: each friend's soldier, kit and colours, reaches the host with them", looks === null, JSON.stringify(looks));
  await closeAll();
}

/**
 * SpeedKills' edge (Phase 20 A4): past the city's edge a countdown runs, a step back in stops it, and staying
 * brings the laser and a death by OUT OF BOUNDS (to the Gulag, as a ring death goes). The wall stops a body
 * edge.margin metres out.
 */
async function speedkillsEdgeTest(browser: Browser): Promise<void> {
  // the Gulag back on (open() turns it off): where an out-of-bounds first death goes is part of the check
  const page = await open(browser, "?norender&game=speedkills", BASE, "window.__noGulag = false");
  await ev(page, brRow("solo", 9));
  await ev(page, `(() => { document.getElementById("brStart").value = "loot"; document.getElementById("goBr").click(); document.getElementById("startMode").click(); })()`);
  const fought = await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 60000 }).then(() => true, () => false);
  const landed = fought && (await page.waitForFunction("window.__range.player.onGround && !window.__range.player.dropping && window.__range.sk.edge().armed", { polling: 100, timeout: 30000 }).then(() => true, () => false));
  if (!landed) {
    check("sk edge: a match starts and the player lands", false, JSON.stringify({ fought }));
    await page.close();
    return;
  }
  await ev(page, `(() => { const d = window.__range.duel(); d.holdFire = true; window.__feed = []; const f = d.onFeed; d.onFeed = (t, a, b) => { window.__feed.push(t); f?.(t, a, b); }; })()`);
  const e0 = await ev<{ city: { maxX: number }; margin: number }>(page, "window.__range.sk.edge()");
  const wait = (s: number) => page.waitForFunction(`window.__range.gameTime() - window.__t0 > ${s}`, { polling: 50, timeout: 30000 }).catch(() => undefined);
  const mark = () => ev(page, "window.__t0 = window.__range.gameTime()");
  // out, for a second and a half: the countdown runs
  await ev(page, `window.__range.player.teleport(${e0.city.maxX + 12}, 0, 500, 90)`);
  await mark();
  await wait(1.5);
  const out = await ev<{ out: boolean; left: number | null }>(page, "window.__range.sk.edge()");
  check("sk edge: past the city's edge a countdown runs from 5", out.out && out.left !== null && out.left > 2.5 && out.left < 4.5, JSON.stringify(out));
  // back in: it stops
  await ev(page, `window.__range.player.teleport(${e0.city.maxX - 10}, 0, 500, 90)`);
  await mark();
  await wait(0.4);
  const back = await ev<{ out: boolean; left: number | null; alive: boolean }>(page, "({ ...window.__range.sk.edge(), alive: window.__range.duel().alive })");
  check("sk edge: a step back into the city stops the countdown", !back.out && back.left === null && back.alive, JSON.stringify(back));
  // the wall: a body stops the margin out, however far it is pushed
  await ev(page, `window.__range.player.teleport(${e0.city.maxX + e0.margin + 30}, 0, 500, 90)`);
  await mark();
  await wait(0.3);
  const wallX = await ev<number>(page, "window.__range.player.pos.x");
  check("sk edge: a wall stops a body the margin past the edge", wallX <= e0.city.maxX + e0.margin + 0.01 && wallX > e0.city.maxX + e0.margin - 1, `${wallX.toFixed(2)} for a wall at ${e0.city.maxX + e0.margin}`);
  // stay out: the death by OUT OF BOUNDS, with no laser (the owner took it out)
  const died = await page.waitForFunction("!window.__range.duel().alive", { polling: 100, timeout: 20000 }).then(() => true, () => false);
  const end = await ev<{ byEdge: boolean | null; killer: string | null; feed: string[]; gulag: boolean; fx: number }>(
    page,
    "(() => { const r = window.__range; const rc = r.recap(); return { byEdge: rc ? rc.byEdge : null, killer: rc ? rc.killerName : null, feed: window.__feed, gulag: !!r.duel().gulag, fx: 0 }; })()",
  );
  check(
    "sk edge: staying out, the death is OUT OF BOUNDS, in the recap and the feed, to the Gulag",
    died && end.byEdge === true && end.killer === "OUT OF BOUNDS" && end.feed.some((t) => /OUT OF BOUNDS/.test(t)) && end.gulag,
    JSON.stringify({ died, ...end }),
  );
  await page.close();
}

/**
 * SLAM in a battle royale (main.ts slamTargets and showSlamRing, hacks.json slam). The owner, 2026-09-28: "the slam
 * doesn't seem to do any damage to an enemy, it should show the radius circle around the player when they are landing
 * to visually show if it will hit or not and if it hits give the damage number". Three bots held round you: one beside
 * you on your floor, one as near but a storey over you, one outside the ring. The ring shows red while you are up; the
 * first takes the damage, its number shown; the other two take nothing.
 */
async function speedkillsSlamTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?norender&game=speedkills");
  await ev(page, brRow("solo", 9));
  await ev(page, `(() => { document.getElementById("brStart").value = "loot"; document.getElementById("goBr").click(); document.getElementById("startMode").click(); })()`);
  const landed = await page
    .waitForFunction(`window.__range.duel()?.phase === "fight" && window.__range.player.onGround && !window.__range.player.dropping`, { polling: 100, timeout: 90000 })
    .then(() => true, () => false);
  if (!landed) {
    check("slam: a match starts and the player lands", false);
    await page.close();
    return;
  }
  type Hp = { id: number; hp: number; sh: number };
  const before = await ev<{ spot: boolean; bots: Hp[]; numbers: number }>(
    page,
    `(() => { const r = window.__range; const d = r.duel(); d.holdFire = true;
      // on open street, flat 10 m round and clear of pads (where the match lands you may be a crate's top or a kerb, and
      // the floor under a slam then moves the rule's 2.5 m about: a run hit the bot a storey over as well)
      const clear = (x, z) => !r.brMap.pads.some((q) => Math.hypot(q.x - x, q.z - z) < 10) && !r.solids.some((b) => b.maxX > x - 10 && b.minX < x + 10 && b.maxZ > z - 10 && b.minZ < z + 10 && b.base < 6 && b.top > 0.1);
      const spot = r.brMap.nodes.find((q) => (q.y ?? 0) === 0 && clear(q.x, q.z));
      if (spot) r.player.teleport(spot.x, 0, spot.z, 0);
      const p = r.player.pos.clone();
      const bs = d.bots.filter((b) => b.bot.alive && !b.down).slice(0, 3);
      // the one a storey over stands on a deck of its own, 2 m to your side (held in the air by the pins alone, its own
      // update let it fall to your floor between them, and on a loaded machine the slam took it there 3 runs in 5)
      window.__slamDeck = { minX: p.x - 0.5, maxX: p.x + 0.5, minZ: p.z + 1.6, maxZ: p.z + 2.4, base: p.y, top: p.y + 4 };
      r.solids.push(window.__slamDeck);
      const offs = [[2.5, 0, 0], [0, 4, 2], [8, 0, 0]];
      window.__slamPins = bs.map((b, i) => ({ b, at: [p.x + offs[i][0], p.y + offs[i][1], p.z + offs[i][2]] }));
      const pin = () => { for (const q of window.__slamPins) { q.b.bot.pos.set(q.at[0], q.at[1], q.at[2]); q.b.bot.dummy.group.position.copy(q.b.bot.pos); } };
      pin();
      window.__slamPin = setInterval(pin, 8);
      r.sk.take("slam", 0);
      return { spot: !!spot, bots: bs.map((b) => ({ id: b.bot.remote.id, hp: b.bot.remote.health, sh: b.bot.remote.shield })), numbers: r.hud.damageNumbers.length }; })()`,
  );
  await ev(page, `(() => { window.__ring = { visible: false, hit: false }; window.__ringT = setInterval(() => { const s = window.__range.sk.state().slamRing; if (s.visible) window.__ring.visible = true; if (s.hit) window.__ring.hit = true; }, 8); window.__range.sk.use("mobility"); })()`);
  await page.waitForFunction("window.__range.sk.state().slam === 'up'", { polling: 20, timeout: 3000 }).catch(() => undefined);
  await page.waitForFunction("window.__range.sk.state().slam === null", { polling: 50, timeout: 15000 }).catch(() => undefined);
  await gameSleep(page, 0.3);
  const after = await ev<{ ring: { visible: boolean; hit: boolean }; bots: Hp[]; numbers: number[]; landed: number[] }>(
    page,
    `(() => { clearInterval(window.__slamPin); clearInterval(window.__ringT); const k = window.__range.solids.indexOf(window.__slamDeck); if (k >= 0) window.__range.solids.splice(k, 1); const p = window.__range.player.pos; const q0 = window.__slamPins[0].at; return { ring: window.__ring, bots: window.__slamPins.map((q) => ({ id: q.b.bot.remote.id, hp: q.b.bot.remote.health, sh: q.b.bot.remote.shield })), numbers: window.__range.hud.damageNumbers.slice(${before.numbers}).map((n) => n.amount), landed: [+(p.x - q0[0] + 2.5).toFixed(2), +(p.y - q0[1]).toFixed(2), +(p.z - q0[2]).toFixed(2)] }; })()`,
  );
  const lost = (i: number) => (before.bots[i] && after.bots[i] ? before.bots[i].hp + before.bots[i].sh - (after.bots[i].hp + after.bots[i].sh) : NaN);
  // (where you came down, from where you went up: x, height, z)
  const detail = JSON.stringify({ spot: before.spot, lost: [0, 1, 2].map(lost), numbers: after.numbers, landed: after.landed });
  check("slam: its ring on the floor while you are up, red with an enemy inside it", after.ring.visible && after.ring.hit, JSON.stringify(after.ring));
  check("slam: the enemy beside you on your floor takes its damage (20), and its number shows", before.spot && before.bots.length === 3 && lost(0) === 20 && after.numbers.includes(20), detail);
  check("slam: one as near but a storey over you, and one outside the ring, take nothing", lost(1) === 0 && lost(2) === 0, detail);
  await page.close();
}

/**
 * A bot takes High City's corner's walkway as high ground (city.ts DISTRICT_HOLDS, brmatch.ts roofFor, Phase 26.4): in a
 * match none went up, which only a wander that happened onto a pad reached. A bot on a canyon node beside a pad, sent
 * for the walkway the pad lands on, with nobody in sight, rides the pad and stands up there holding it
 */
async function speedkillsDistrictHoldTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?norender&game=speedkills");
  if (await onNeon(page)) {
    oldCityOnly("district hold: a bot sent to its pad's walkway");
    await page.close();
    return;
  }
  await ev(page, brRow("solo", 9));
  await ev(page, `(() => { document.getElementById("brStart").value = "loot"; document.getElementById("goBr").click(); document.getElementById("startMode").click(); })()`);
  const landed = await page
    .waitForFunction(`window.__range.duel()?.phase === "fight" && window.__range.player.onGround && !window.__range.player.dropping && window.__range.duel().bots.some((b) => b.landed && b.bot.alive)`, { polling: 100, timeout: 90000 })
    .then(() => true, () => false);
  if (!landed) {
    check("district hold: a match starts and a bot lands", false);
    await page.close();
    return;
  }
  // (every bot down first: one still falling into sight was a target, and a bot with a target does not walk its way)
  await page.waitForFunction("window.__range.duel().bots.every((b) => !b.bot.alive || (b.landed && !b.bot.dropping))", { polling: 100, timeout: 60000 }).catch(() => undefined);
  const d0 = districtsCfg.districts[0];
  const [w0] = d0.fill.walkway;
  const set = await ev<{ hold: number; roof: number; from: number; bot: number } | null>(
    page,
    `(() => { const r = window.__range; const d = r.duel(); d.holdFire = true;
      const nodes = r.brMap.nodes;
      const inCorner = (n) => n.x - ${BR_X} > ${d0.hole[0][0]} && n.z - ${BR_Z} > ${d0.hole[0][1]};
      const hold = nodes.findIndex((n) => n.padFrom && (n.y ?? 0) >= ${w0} && inCorner(n));
      if (hold < 0) return null;
      const pad = nodes[hold].padFrom[0];
      let from = -1, best = Infinity;
      nodes.forEach((n, i) => { if (i === pad || (n.y ?? 0) > 1 || !n.links.includes(pad)) return; const dd = Math.hypot(n.x - nodes[pad].x, n.z - nodes[pad].z); if (dd < best) { best = dd; from = i; } });
      if (from < 0) return null;
      // (the sectors it passes through live the while: a bot in a sector the decay warns runs from it, and drops any
      // climb, as it should; the pad stands on the line between two of them)
      const sectors = ${JSON.stringify(cityCfgE2e.sectors.map((q) => ({ id: q.id, minX: q.minX, maxX: q.maxX, minZ: q.minZ, maxZ: q.maxZ })))};
      const pts = [nodes[from], nodes[pad], nodes[hold]].map((n) => [n.x - ${BR_X}, n.z - ${BR_Z}]);
      const keep = sectors.filter((q) => pts.some(([x, z]) => x > q.minX - 5 && x < q.maxX + 5 && z > q.minZ - 5 && z < q.maxZ + 5)).map((q) => q.id).filter((id) => d.decay && id !== d.decay.final);
      if (d.decay && keep.length) {
        d.decay.waves = d.decay.waves.map((w) => w.filter((id) => !keep.includes(id))).filter((w) => w.length);
        d.decay.waves.push(keep);
      }
      // the player far off on the far side of the map, and every other bot too, so nothing is in sight
      const far = nodes.find((n) => (n.y ?? 0) === 0 && n.x - ${BR_X} < -60 && n.z - ${BR_Z} < -60);
      if (far) r.player.teleport(far.x, 0, far.z, 0);
      const bs = d.bots.filter((b) => b.landed && b.bot.alive && !b.down);
      const b = bs[0];
      // (off any ride it was on: a launch pad's throw or a rope carried it on past the move)
      for (const o of d.bots) if (o !== b && far) { o.bot.travel = null; o.bot.pos.set(far.x + 5, 0, far.z + 5); o.bot.dummy.group.position.copy(o.bot.pos); }
      // (and nobody in its memory: a bot hunts where it last saw an enemy, which was where it landed)
      b.bot.travel = null;
      b.bot.lastSeen = null;
      b.ropeTo = null;
      b.bot.pos.set(nodes[from].x, 0, nodes[from].z);
      b.bot.dummy.group.position.copy(b.bot.pos);
      b.node = from;
      b.goal = from;
      // the high ground the match gives it (roofFor), its tier's chance made a yes: the walkway beside it, before any
      // low tower's roof
      const rnd = Math.random;
      Math.random = () => 0;
      const roof = d.roofFor(b);
      Math.random = rnd;
      b.climb = roof >= 0 ? { roof, holdUntil: null } : null;
      window.__holdBot = b;
      return { hold, roof, from, bot: b.bot.remote.id }; })()`,
  );
  if (!set) {
    check("district hold: a bot, a pad and its walkway's landing to send it to", false);
    await page.close();
    return;
  }
  let at = { x: 0, y: 0, z: 0, holding: false };
  for (let i = 0; i < 30 && at.y < w0 - 0.3; i++) {
    await gameSleep(page, 1);
    at = await ev(page, `(() => { const b = window.__holdBot; return { x: b.bot.pos.x - ${BR_X}, y: b.bot.pos.y, z: b.bot.pos.z - ${BR_Z}, holding: !!(b.climb && b.climb.holdUntil !== null) }; })()`);
  }
  let held = { y: 0, holding: false };
  for (let i = 0; i < 6 && !held.holding; i++) {
    await gameSleep(page, 1);
    held = await ev<{ y: number; holding: boolean }>(page, `(() => { const b = window.__holdBot; return { y: b.bot.pos.y, holding: !!(b.climb && b.climb.holdUntil !== null) || b.node === ${set.hold} }; })()`);
  }
  check(
    "district hold: a bot sent for High City's corner's walkway rides its pad up and holds it",
    set.roof === set.hold && at.y >= w0 - 0.3 && held.y >= w0 - 0.3 && held.holding,
    JSON.stringify({ ...set, at: { x: +at.x.toFixed(1), y: +at.y.toFixed(2), z: +at.z.toFixed(1) }, held }),
  );
  await page.close();
}

async function speedkillsStartsTest(browser: Browser): Promise<void> {
  type Slot = { id: string; empty: boolean; fusion: number };
  type Here = { slots: Slot[]; active: number; fused: number; down: string[] };
  for (const start of ["loot", "loadout"] as const) {
    const page = await open(browser, "?norender&game=speedkills");
    await ev(page, "window.__range.sk.setFusion(0, 3)");
    await ev(page, brRow("solo", 9));
    await ev(page, `(() => { document.getElementById("brStart").value = "${start}"; document.getElementById("goBr").click(); document.getElementById("startMode").click(); })()`);
    const fought = await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 60000 }).then(() => true, () => false);
    if (!fought) {
      check(`sk ${start} start: a match starts in the city`, false);
      await page.close();
      continue;
    }
    await ev(page, "window.__range.duel().holdFire = true");
    const land = await ev<{ drops: number; hot: string | null; slots: Slot[]; want: string[]; bots: number; looting: number }>(
      page,
      `(() => { const r = window.__range; const d = r.duel(); const c = r.loadouts.current; return { drops: d.lootField ? d.lootField.drops.size : -1, hot: d.hotZone()?.name ?? null, slots: r.loadout.slots.map((s) => ({ id: s.id, empty: s.empty, fusion: s.fusion ?? 0 })), want: [c.slot1, c.slot2], bots: d.bots.length, looting: d.bots.filter((b) => b.bot.lootSource !== null).length }; })()`,
    );
    check(`sk ${start} start: the floor has its loot, the centre its hot zone`, land.drops > 150 && land.hot === CENTRE_NAME, JSON.stringify({ drops: land.drops, hot: land.hot }));
    check(
      start === "loot" ? "sk loot start: you land with nothing" : "sk loadout start: you land with your loadout's two guns at level 0",
      start === "loot" ? land.slots.every((s) => s.empty) : land.slots.every((s, i) => !s.empty && s.id === land.want[i] && s.fusion === 0),
      JSON.stringify(land.slots),
    );
    check(`sk ${start} start: the bots ${start === "loot" ? "loot their guns off the floor" : "land with theirs and do not loot"}`, start === "loot" ? land.looting === land.bots : land.looting === 0, `${land.looting} of ${land.bots} looting`);
    // without a floor nothing below can be placed or taken: the checks above have already failed
    if (land.drops < 0) {
      await page.close();
      continue;
    }
    // brLootTest's place and take, through the game's own E: open ground, the item 1.6 m ahead, looked at from 45 degrees down
    const S = (await ev<{ x: number; z: number } | null>(page, "window.__range.openGround(window.__range.player.pos.x, window.__range.player.pos.z)")) ?? { x: 0, z: 500 };
    const clear = `(() => { const f = window.__range.duel().lootField; for (const k of [...f.drops.keys()]) { const x = f.drops.get(k); if (x && Math.hypot(x.pos.x - ${S.x}, x.pos.z - ${S.z}) < 6) f.remove(k); } })()`;
    const settle = () => page.waitForFunction("!window.__range.loadout.swapping", { polling: 50, timeout: 5000 }).catch(() => undefined);
    const take = async (item: string): Promise<void> => {
      await ev(page, `(() => { const r = window.__range; r.player.teleport(${S.x}, 0, ${S.z}, 0, -45); ${clear}; r.duel().lootField.add(${item}, new r.THREE.Vector3(${S.x}, 0, ${S.z} - 1.6)); })()`);
      await sleep(150);
      await ev(page, `window.__range.setScript({ held: () => false, pressedNow: (a) => a === "interact" })`);
      await sleep(250);
      await ev(page, "window.__range.setScript(null)");
      await sleep(900);
      await settle();
    };
    const here = `(() => { const r = window.__range; const l = r.loadout; const f = r.duel().lootField; return { slots: l.slots.map((s) => ({ id: s.id, empty: s.empty, fusion: s.fusion ?? 0 })), active: l.activeIndex, fused: r.fused(), down: [...f.drops.values()].filter((x) => x.item.kind === "weapon" && Math.hypot(x.pos.x - ${S.x}, x.pos.z - ${S.z}) < 3).map((x) => x.item.id + ":" + (x.item.fusion ?? 0)) }; })()`;
    // a loot start's two guns come off the floor first, so both starts fuse and swap with both slots full
    if (start === "loot") {
      await take(`{ kind: "weapon", id: "r97", n: 1, rarity: "common", fusion: 0 }`);
      await take(`{ kind: "weapon", id: "vinson", n: 1, rarity: "common", fusion: 0 }`);
    }
    const a = await ev<Here>(page, here);
    // The loot card (Phase 20 A8), looked at before it is taken: a copy of the gun in slot 1 says it fuses, in Full
    // with its numbers and in Compact as the short verdict; a gun you do not carry says it swaps for the one in hand
    if (start === "loadout") {
      const other = ["sentinel", "lstar", "launcher", "mastiff"].find((id) => !a.slots.some((sl) => sl.id === id))!;
      const card = await ev<{ full: { say: string; rows: unknown[]; notes: string[] } | null; compact: { say: string; rows: unknown[] } | null; swap: { say: string; rows: Array<{ label: string }> } | null }>(
        page,
        `(() => new Promise((ok) => { const r = window.__range; const put = (id) => { ${clear}; r.duel().lootField.add({ kind: "weapon", id, n: 1, rarity: "common", fusion: 0 }, new r.THREE.Vector3(${S.x}, 0, ${S.z} - 1.6)); }; r.player.teleport(${S.x}, 0, ${S.z}, 0, -45); put("${a.slots[0].id}");
          setTimeout(() => { const full = r.lootCard(); r.setLootCard("compact"); setTimeout(() => { const compact = r.lootCard(); r.setLootCard("full"); put("${other}"); setTimeout(() => { const swap = r.lootCard(); ${clear}; ok({ full, compact, swap }); }, 350); }, 350); }, 350); }))()`,
      );
      check(
        "sk loot card: a copy of your gun says it fuses (Full: its numbers and notes; Compact: the verdict alone), a gun you do not carry says it swaps for yours",
        !!card.full && /^FUSES TO LEVEL \d/.test(card.full.say) && card.full.rows.length >= 4 && card.full.notes.length > 0 && !!card.compact && /^FUSE \d -> \d/.test(card.compact.say) && !!card.swap && /^SWAPS FOR YOUR /.test(card.swap.say) && card.swap.rows.some((r) => r.label === "TIME TO KILL"),
        JSON.stringify(card).slice(0, 600),
      );
    }
    await take(`{ kind: "weapon", id: "${a.slots[0].id}", n: 1, rarity: "common", fusion: 0 }`);
    const b = await ev<Here>(page, here);
    check(
      `sk ${start} start: E on a floor copy of a gun you carry fuses it up a level`,
      a.slots.every((s) => !s.empty) && b.slots[0].id === a.slots[0].id && b.slots[0].fusion === a.slots[0].fusion + 1 && b.slots[1].fusion === a.slots[1].fusion && b.fused === a.fused + 1 && b.down.length === 0,
      JSON.stringify({ a, b }),
    );
    const other = skCfg.roster.find((g) => !b.slots.some((s) => s.id === g)) ?? "g2";
    const was = b.slots[b.active];
    await take(`{ kind: "weapon", id: "${other}", n: 1, rarity: "rare", fusion: 1 }`);
    const c = await ev<Here>(page, here);
    check(
      `sk ${start} start: E on a gun you do not carry swaps it in at its level, and the one in hand goes down at its own`,
      c.slots[b.active].id === other && c.slots[b.active].fusion === 1 && c.slots[1 - b.active].id === b.slots[1 - b.active].id && c.down.includes(`${was.id}:${was.fusion}`),
      JSON.stringify({ other, was, c }),
    );
    if (start === "loadout") {
      // What else the floor brings now that a loadout start has one. A care package: SpeedKills' own guns and
      // hack cores at its levels (speedkills.json loot.carePackage), never the legacy gun, helmet or heals.
      const P = skCfg.loot.carePackage;
      const lowest = (odds: number[]) => odds.findIndex((p) => p > 0);
      const pods = await ev<Array<Array<{ kind: string; id: string; n: number; fusion?: number }>>>(page, "Array.from({ length: 24 }, () => window.__range.duel().podItems())");
      const hackIds = skCfg.abilities.set.map((h) => h.id);
      const podOk = pods.every(
        (p) =>
          p.length === P.guns + P.hacks &&
          p.filter((it) => it.kind === "weapon").every((it) => skCfg.roster.includes(it.id) && (it.fusion ?? 0) >= lowest(P.gunOdds) && (it.fusion ?? 0) < P.gunOdds.length) &&
          p.filter((it) => it.kind === "hack").every((it) => hackIds.includes(it.id) && it.n >= lowest(P.hackOdds) && it.n < P.hackOdds.length) &&
          p.every((it) => it.kind === "weapon" || it.kind === "hack"),
      );
      check("sk: a care package holds SpeedKills guns and hack cores at the package's levels, nothing of the legacy game's", podOk, JSON.stringify(pods.slice(0, 3)));
      // no loadout crate: a round's close that calls one in the legacy game calls none (it handed back level-0 copies)
      const crates = await ev<number>(
        page,
        `(() => { const d = window.__range.duel(); const L = ${JSON.stringify(brCfg.loadoutPod.phases)}; d.view = { ...d.view, phase: L[0], state: "closing", timeLeft: 0 }; d.maybeCrate(); return d.pods.filter((p) => p.kind === "loadout").length; })()`,
      );
      check("sk: no loadout crate is called as a round closes", crates === 0, `${crates} called`);
      // what a bot drops: its gun at its level, loose, and none of the legacy ammo, cells or syringes
      // (one past its landing grace, so it has its gun in hand: before that it rightly drops nothing. What it put
      // down is every key the field handed out during the kill.)
      await page.waitForFunction("window.__range.duel().bots.some((x) => x.armedShown && x.bot.alive && !x.down)", { polling: 200, timeout: 30000 }).catch(() => undefined);
      const botBox = await ev<string[] | null>(
        page,
        `(() => { const d = window.__range.duel(); const f = d.lootField; const b = d.bots.find((x) => x.armedShown && x.bot.alive && !x.down); if (!b) return null; const k0 = f.keyNext; d.botDown(b, d.id);
          const put = [...f.drops.values()].filter((x) => x.key >= k0);
          return put.map((x) => x.item.kind + ":" + x.item.id + ":" + (x.item.fusion ?? "-")); })()`,
      );
      check("sk: a bot drops its gun at its level, loose, and nothing of the legacy game's (no box)", !!botBox && botBox.length === 1 && /^weapon:[a-z0-9_]+:0$/.test(botBox[0]), JSON.stringify(botBox));
    }
    // out, with the floor round you cleared first: what you die with goes down loose, each gun at its level
    await ev(page, clear);
    const held = await ev<string>(page, `window.__range.loadout.slots.filter((s) => !s.empty).map((s) => s.id + ":" + (s.fusion ?? 0)).sort().join()`);
    // (yours are the ones put down as you died, by key, and near where you fell: a restock can add guns meanwhile, far off)
    const k0 = await ev<number>(page, "window.__range.duel().lootField.keyNext");
    const fell = await ev<{ x: number; z: number }>(page, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })");
    await ev(page, "window.__range.duel().takeHit(500, 100)");
    // (the drop is the death's frame's: waited for, not slept on, as a loaded machine runs that frame late)
    await page.waitForFunction(`[...window.__range.duel().lootField.drops.values()].some((x) => x.key >= ${k0} && x.item.kind === "weapon")`, { polling: 100, timeout: 5000 }).catch(() => undefined);
    const dropped = await ev<{ guns: string; other: string[] }>(
      page,
      `(() => { const round = [...window.__range.duel().lootField.drops.values()].filter((x) => x.key >= ${k0} && Math.hypot(x.pos.x - ${fell.x}, x.pos.z - ${fell.z}) < 4);
        return { guns: round.filter((x) => x.item.kind === "weapon").map((x) => x.item.id + ":" + (x.item.fusion ?? 0)).sort().join(), other: round.filter((x) => x.item.kind !== "weapon" && x.item.kind !== "echo").map((x) => x.item.kind + ":" + x.item.id) }; })()`,
    );
    // and nothing else, no box among it: a loadout start's ammo kit would be clutter on a floor of guns and hack cores
    check(`sk ${start} start: what you die with goes down loose, your guns at their levels, and nothing else`, dropped.guns === held && dropped.other.length === 0, JSON.stringify({ held, dropped }));
    await page.close();
  }
}

/**
 * SpeedKills' second life, over two real pages: the guest dies past its
 * Gulag and is a ghost; the ghost moves; the host restores it at its echo
 * (where it fell), a third as fast while the ghost is away, full speed once
 * it follows; the guest stands up whole, holding what it died with. Run in
 * both starts: a loadout start has a floor since Phase 20 A1, and a restore
 * there must not fuse the guns given back onto the same guns in hand.
 */
/**
 * HAEFY's rocket launcher (rocket.ts; the owner, 2026-10-06: "it shouldn't hurt the shooter, but it should do more damage
 * the further it travels, so a point blank or very close does like 10 damage and then it scales like that"): a real
 * rocket fired at a range dummy where it stands, from 25 m and from 3 m: drawn as a rocket in flight, its burst seen,
 * the dummy taking the burst's damage for how far the rocket flew. Someone else's rocket (as a shot message redraws it)
 * flies and bursts on this page too and hurts nobody here. A rocket into the floor at a dummy's toes is on it (full
 * damage: the gap is to the body, not a chest point), and one on a range target counts on the target. A bot with the
 * launcher: its rockets stop on you and their damage comes with the burst, and a rocket never bursts on the figure that
 * fired it (the same rocket fired as nobody's does, on its own head).
 */
async function skLauncherTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?norender&game=speedkills");
  await page.waitForFunction("window.__range.paidGuns().ready", { polling: 250, timeout: 90000 }).catch(() => undefined);
  await ev(page, `(() => { const r = window.__range; const l = r.loadout; l.give(0, "launcher"); l.requestSwap(0, r.gameTime()); })()`);
  await page.waitForFunction("window.__range.loadout.active.weapon.id === 'launcher' && !window.__range.loadout.swapping", { polling: 100, timeout: 15000 }).catch(() => undefined);
  type Shot = { took: number; travelled: number; rocketDrawn: boolean; bursts: number };
  // (`aimAt`: where at the dummy, from its feet)
  const shoot = (dist: number, visual: boolean, aimAt = "feet.clone().setY(feet.y + 1.1)") =>
    ev<Shot>(
      page,
      `(async () => {
        const r = window.__range, T = r.THREE; const d = r.dummies[1];
        d.health = d.healthMax ?? d.health; if ("shield" in d) d.shield = d.shieldCap ?? d.shield;
        const home = d.group.position.clone();
        r.player.teleport(home.x, 0, home.z + ${dist}, 0, 0);
        await new Promise((ok) => setTimeout(ok, 300));
        const eye = r.player.eyePosition(); const feet = d.group.position.clone();
        const aim = (${aimAt}).sub(eye);
        const before = (d.health ?? 0) + (d.shield ?? 0); const b0 = r.rocketBursts();
        r.fireRound([aim.x, aim.y, aim.z], ${visual});
        // (the rocket in flight is drawn as the rocket model, not a streak)
        await new Promise((ok) => setTimeout(ok, 40));
        const rocketDrawn = !!r.scene.getObjectByName("rocket");
        let bursts = 0; const t0 = performance.now();
        while (performance.now() - t0 < 1500) { bursts = Math.max(bursts, r.rocketBursts() - b0); await new Promise((ok) => setTimeout(ok, 16)); }
        return { took: Math.round((before - (d.health ?? 0) - (d.shield ?? 0)) * 10) / 10, travelled: r.rocketLast()?.travelled ?? -1, rocketDrawn, bursts };
      })()`,
    );
  const far = await shoot(25, false);
  check("HAEFY: a rocket at a dummy from 25 m is drawn as a rocket, bursts, and the dummy takes its full 50", far.rocketDrawn && far.bursts >= 1 && Math.abs(far.took - 50) <= 1 && far.travelled > 20, JSON.stringify(far));
  const near = await shoot(3, false);
  check("HAEFY: from 3 m the same rocket does about 10 to 14 (point blank about 10, more the further it flies)", near.bursts >= 1 && near.took >= 9 && near.took <= 14, JSON.stringify(near));
  const theirs = await shoot(25, true);
  check("HAEFY: someone else's rocket (a shot message's) flies and bursts here too, and does no damage on this page", theirs.rocketDrawn && theirs.bursts >= 1 && theirs.took === 0, JSON.stringify(theirs));
  // Into the floor a hand beside a dummy's feet, from 10 m to its side (in front of it a low wall takes a floor shot):
  // on it, the full damage for the rocket's flight (to a chest point 1.1 m up it had been four fifths of it)
  const toes = await ev<{ took: number; travelled: number; want: number }>(
    page,
    `(async () => {
      const r = window.__range, T = r.THREE; const d = r.dummies[1];
      d.health = d.healthMax ?? d.health; if ("shield" in d) d.shield = d.shieldCap ?? d.shield;
      const feet = d.group.position.clone();
      r.player.teleport(feet.x + 10, 0, feet.z, 0, 0);
      await new Promise((ok) => setTimeout(ok, 300));
      const before = (d.health ?? 0) + (d.shield ?? 0); const L0 = r.rocketLast();
      const aim = feet.clone().add(new T.Vector3(0.35, 0, 0)).sub(r.player.eyePosition());
      r.fireRound([aim.x, aim.y, aim.z]);
      const t0 = performance.now(); while (r.rocketLast() === L0 && performance.now() - t0 < 1500) await new Promise((ok) => setTimeout(ok, 16));
      await new Promise((ok) => setTimeout(ok, 100));
      const travelled = r.rocketLast() === L0 ? -1 : r.rocketLast().travelled;
      // the launcher's damage for that flight (rocket.json: 10 to 2 m, 50 from 20 m)
      const want = 10 + 40 * Math.max(0, Math.min(1, (travelled - 2) / 18));
      return { took: Math.round((before - (d.health ?? 0) - (d.shield ?? 0)) * 10) / 10, travelled: Math.round(travelled * 10) / 10, want: Math.round(want * 10) / 10 };
    })()`,
  );
  check("HAEFY: a rocket into the floor a hand from a dummy's feet is on it: the full damage for its flight", toes.travelled > 0 && Math.abs(toes.took - toes.want) <= 1, JSON.stringify(toes));
  // a range target: a rocket's burst counts on it as a round does (only the figures took one before); aimed at its middle
  const board = await ev<{ took: number; burst: boolean; off: number | null } | null>(
    page,
    `(async () => {
      const r = window.__range, T = r.THREE; const now = r.gameTime();
      const t = r.targets.find((x) => x.kind === "board" && x.isLive(now) && x.group.visible); if (!t) return null;
      const c = new T.Box3().setFromObject(t.hitMeshes[0]).getCenter(new T.Vector3());
      let took = 0; const orig = t.hit; t.hit = (n, h, dmg) => { took += dmg; return orig.call(t, n, h, dmg); };
      r.player.teleport(c.x, 0, c.z + 25, 0, 0);
      await new Promise((ok) => setTimeout(ok, 300));
      const aim = c.clone().sub(r.player.eyePosition()); const L0 = r.rocketLast();
      r.fireRound([aim.x, aim.y, aim.z]);
      const t0 = performance.now(); while (performance.now() - t0 < 1500 && !took) await new Promise((ok) => setTimeout(ok, 16));
      t.hit = orig;
      // (rocketBursts() counts the bursts still showing: the last check's can fade out under this one)
      const L = r.rocketLast();
      return { took: Math.round(took * 10) / 10, burst: L !== L0, off: L !== L0 ? Math.round(new T.Vector3(...L.at).distanceTo(c) * 100) / 100 : null };
    })()`,
  );
  check("HAEFY: a rocket on a range target bursts on it and counts on it, its full 50 from 25 m", !!board && board.burst && (board.off ?? 9) < 0.2 && Math.abs(board.took - 50) <= 1, JSON.stringify(board));
  await page.close();
  // A bot with the launcher, on a page of its own, in the open 7 to 15 m from you. Held and still: a rocket from inside it toward
  // its own head, fired as its own and as nobody's. Then firing: its rockets stop on you (you are no figure on your own
  // page; they had flown through you to burst behind) and what you take comes with a burst (a bot's rocket had been
  // settled as a bullet the moment it left).
  const bp = await open(browser, "?norender&game=speedkills");
  await ev(bp, `document.getElementById("overlay").classList.add("hidden")`);
  await ev(bp, `(() => { document.getElementById("botCount").value = "1"; document.getElementById("botDifficulty").value = "elite"; window.__range.startBots(); })()`);
  const fought = await bp.waitForFunction("window.__range.duel()?.phase === 'fight'", { polling: 100, timeout: 30000 }).then(() => true, () => false);
  type BotRockets = { spot: boolean; own: number | null; nobody: number | null; onMe: number; bursts: number; took: number; unexplained: number };
  const bot = fought
    ? await ev<BotRockets>(
        bp,
        `(async () => {
          const r = window.__range, T = r.THREE; const d = r.duel(); const b = d.bots[0];
          d.holdFire = true; b.grenadesAllowed = false; b.setWeapon("launcher");
          // a spot with a clear line to you, 7 to 15 m off (15 m in front of the city's spawn is behind a wall)
          const me = r.player.pos; let spot = null;
          for (const dist of [15, 11, 7]) for (let k = 0; k < 8 && !spot; k++) {
            const q = me.clone().add(new T.Vector3(Math.sin((k * Math.PI) / 4) * dist, 0, Math.cos((k * Math.PI) / 4) * dist));
            if (r.clearTo(q.clone().setY(me.y + 1.2)) && r.clearTo(q.clone().setY(me.y + 0.4))) spot = q;
          }
          if (spot) { b.pos.copy(spot); b.dummy.group.position.copy(b.pos); }
          await new Promise((ok) => setTimeout(ok, 100));
          // still while its own rockets fly: a bot runs sideways at up to 10 m/s, out of the line it was fired along
          const upd = b.update; b.update = () => [];
          const fire = async (firer) => {
            const eye = b.pos.clone().setY(b.pos.y + 1.35);
            const head = b.dummy.hitMeshes.find((m) => m.userData.zone === "head").getWorldPosition(new T.Vector3());
            const before = r.rocketLast();
            b.projectiles.fire(eye, head.sub(eye).normalize(), b.weapon, true, 1, 1, null, null, firer);
            const t1 = performance.now(); while (r.rocketLast() === before && performance.now() - t1 < 4000) await new Promise((ok) => setTimeout(ok, 16));
            return r.rocketLast() === before ? null : Math.round(r.rocketLast().travelled * 100) / 100;
          };
          const own = await fire({ figure: b.dummy });
          const nobody = await fire(null);
          b.update = upd; d.holdFire = false;
          const h0 = d.health + d.shield; let last = r.rocketLast(); let took = 0; let onMe = 0, bursts = 0, unexplained = 0;
          const t0 = performance.now();
          while (performance.now() - t0 < 8000 && onMe < 3 && d.alive) {
            const L = r.rocketLast(); const now = h0 - d.health - d.shield;
            const fresh = !!L && L !== last;
            if (fresh) { last = L; bursts++; if (Math.hypot(L.at[0] - me.x, L.at[2] - me.z) < 0.5 && L.at[1] > me.y && L.at[1] < me.y + 2) onMe++; }
            if (now > took + 1e-6 && !fresh) unexplained++;
            took = now;
            await new Promise((ok) => setTimeout(ok, 16));
          }
          return { spot: !!spot, own, nobody, onMe, bursts, took: Math.round(took * 10) / 10, unexplained };
        })()`,
      )
    : null;
  check("HAEFY: a rocket never bursts on the figure that fired it (the same one fired as nobody's bursts on it)", !!bot && (bot.own === null || bot.own > 1) && bot.nobody !== null && bot.nobody < 0.6, JSON.stringify(bot));
  check("HAEFY: a bot's rockets burst on you, and you take their damage with the burst, never before it", !!bot && bot.onMe >= 1 && bot.took > 0 && bot.unexplained === 0, JSON.stringify(bot));
  await bp.close();
}

async function speedkillsGhostTest(browser: Browser, start: "loot" | "loadout"): Promise<void> {
  const tag = start === "loot" ? "speedkills ghost" : "speedkills ghost, loadout start";
  const q = "?net=local&norender&game=speedkills";
  const host = await open(browser, q);
  const guest = await open(browser, q);
  const close = async () => {
    for (const p of [host, guest]) if (!p.isClosed()) await p.close();
  };
  await ev(host, brRow("duo", 8));
  await ev(host, `(() => { document.getElementById("brStart").value = "${start}"; document.getElementById("duelMode").value = "br"; document.getElementById("duelHost").click(); })()`);
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
    for (const p of [host, guest]) await pressPlay(p);
    for (const p of [host, guest]) await p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 60000 });
  } catch {
    check(`${tag}: host and guest in one city match`, false);
    await close();
    return;
  }
  await ev(host, "window.__range.duel().holdFire = true");
  // what the guest dies holding: in a loadout start its two guns, the first fused to 2 as though found twice
  if (start === "loadout") await ev(guest, "window.__range.sk.setFusion(0, 2)");
  const heldBefore = await ev<string>(guest, `window.__range.loadout.slots.filter((s) => !s.empty).map((s) => s.id + ":" + (s.fusion ?? 0)).sort().join()`);
  // the guest's Gulag already spent: this death makes a ghost
  await ev(guest, `(() => { const d = window.__range.duel(); d.gulagUsed = true; d.takeHit(500, 100); })()`);
  await sleep(800);
  const g1 = await ev<{ alive: boolean; downed: boolean; ghost: boolean }>(guest, "(() => { const d = window.__range.duel(); return { alive: d.alive, downed: d.downed, ghost: d.ghost }; })()");
  check(`${tag}: no knockdown: at zero the guest is out, and a ghost (its squad mate is up)`, !g1.alive && !g1.downed && g1.ghost, JSON.stringify(g1));
  // the ghost moves
  const p0 = await ev<{ x: number; z: number }>(guest, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })");
  // forward, turning to each side in turn: where the squad lands is the drop's, and one run faced a wall 2 m off
  let p1 = p0;
  for (const yaw of [0, 90, 180, 270]) {
    await ev(guest, `(() => { window.__range.player.yaw = ${yaw}; window.__range.setScript({ held: (a) => a === "forward", pressedNow: () => false }); })()`);
    await sleep(1500);
    await ev(guest, "window.__range.setScript(null)");
    p1 = await ev<{ x: number; z: number }>(guest, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })");
    if (Math.hypot(p1.x - p0.x, p1.z - p0.z) > 3) break;
  }
  check(`${tag}: a ghost moves`, Math.hypot(p1.x - p0.x, p1.z - p0.z) > 3, `${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)} m`);
  // a respawn that comes from an opponent (a bot, id 100) is not the squad's to give: it is ignored
  // (plan section 12, item 7: it was taken from anyone)
  const forged = await ev<{ alive: boolean }>(guest, `(() => { const d = window.__range.duel(); d.receiveSquad({ t: "respawn", to: d.id, at: [0, 0, 500] }, 100, 0); return { alive: d.alive }; })()`);
  check(`${tag}: a respawn from an opponent is ignored; only the squad brings you back`, !forged.alive, JSON.stringify(forged));
  // its echo, where it fell; the host beside it, the ghost sent far away
  const spot = await host.waitForFunction("(() => { const d = [...window.__range.duel().lootField.drops.values()].find((x) => x.item.kind === 'echo' && x.item.owner === 1); return d ? { x: d.pos.x, y: d.pos.y, z: d.pos.z } : null; })()", { polling: 200, timeout: 6000 }).then((h) => h.jsonValue() as Promise<{ x: number; y: number; z: number }>, () => null);
  if (!spot) {
    check(`${tag}: the ghost's echo is on the host's floor`, false);
    await close();
    return;
  }
  await ev(guest, `window.__range.player.teleport(${spot.x + 40}, ${spot.y}, ${spot.z}, 0)`);
  await ev(host, `window.__range.player.teleport(${spot.x + 1}, ${spot.y}, ${spot.z}, 90)`);
  await sleep(700);
  const far = await ev<string>(host, "JSON.stringify(window.__range.brPlay.hud.prompt)");
  check(`${tag}: at the echo the prompt is RESTORE, and it says the ghost is away`, /RESTORE/.test(far) && /AWAY/.test(far), far);
  await ev(host, `window.__range.setScript({ held: (a) => a === "interact", pressedNow: () => false })`);
  await sleep(5500);
  const early = await ev<boolean>(guest, "window.__range.duel().alive");
  check(`${tag}: with the ghost away, 5 s of holding is not enough (a third as fast)`, !early);
  // the ghost comes to the one restoring it: the rest goes at full speed
  await ev(guest, `window.__range.player.teleport(${spot.x + 2}, ${spot.y}, ${spot.z}, 0)`);
  // the rest is about 3 s of the game's time; a loaded machine stretches that past 6 s of real time (a run beside the
  // release e2e failed it with the restore still going), and how fast it goes is the check above's to say
  const back = await guest.waitForFunction("window.__range.duel().alive", { polling: 100, timeout: 15000 }).then(() => true, () => false);
  await ev(host, "window.__range.setScript(null)");
  const g2 = await ev<{ hp: number; restores: number }>(guest, "({ hp: window.__range.duel().health, restores: window.__range.duel().restores })");
  check(`${tag}: with the ghost beside them, the host finishes the restore, and the guest stands up whole`, back && g2.hp === 100 && g2.restores === 1, JSON.stringify(g2));
  // What it stands up holding: its own guns back, at the levels it had. Copies taken onto the same guns still in hand
  // fused each a level (a free fusion a death); or nothing came back at all.
  const count = heldBefore ? heldBefore.split(",").length : 0;
  await guest.waitForFunction(`window.__range.loadout.slots.filter((s) => !s.empty).length >= ${count}`, { polling: 100, timeout: 6000 }).catch(() => undefined);
  await sleep(600);
  const heldAfter = await ev<string>(guest, `window.__range.loadout.slots.filter((s) => !s.empty).map((s) => s.id + ":" + (s.fusion ?? 0)).sort().join()`);
  // (its guns lay 0.9 m round the echo; the restore clears what lies within 1.3 m of it, and the echo itself)
  const leftThere = await ev<string[]>(
    host,
    `[...window.__range.duel().lootField.drops.values()].filter((x) => x.item.kind === "echo" ? x.item.owner === 1 : x.item.kind === "weapon" && Math.hypot(x.pos.x - ${spot.x}, x.pos.z - ${spot.z}) < 1.3).map((x) => x.item.kind + ":" + x.item.id)`,
  );
  check(`${tag}: the restored guest holds the guns it died with, at their levels, and neither they nor the echo are left on the floor`, heldAfter === heldBefore && leftThere.length === 0, JSON.stringify({ heldBefore, heldAfter, leftThere }));
  await close();
}

/**
 * SpeedKills' tour, its eight steps (tour.ts SK_STEPS), each done for real in
 * the range: a walk, a double jump, a wall run along the range's right-hand
 * wall and a climb up a ladder's wall, a hit, both hacks on their keys, the
 * fusion key, a hit from the top of a platform, five seconds in the ring, and
 * the walk to the echo.
 */
async function speedkillsTourTest(browser: Browser): Promise<void> {
  const t = await open(browser, "?game=speedkills");
  await ev(t, `document.getElementById("goTour").click(); document.getElementById("startMode").click()`);
  await pressPlay(t);
  const step = () => ev<string | null>(t, "window.__range.tour.stepId");
  check("sk tour: it starts at MOVE", (await step()) === "move", String(await step()));
  const ORDER = ["move", "moves", "shoot", "hacks", "fusion", "high", "zone", "dying"];
  const stepTo = async (id: string, timeout = 6000) => {
    const next = ORDER[ORDER.indexOf(id) + 1] ?? null;
    return t.waitForFunction(`window.__range.tour.stepId === ${JSON.stringify(next)}`, { polling: 50, timeout }).then(() => true, () => false);
  };
  // keys held from now on, and `presses`: milliseconds after the start at which a key is pressed once (a
  // jump, then a second in the air). By the clock, not by frame: a headless page runs at hundreds of frames
  // a second, and a second jump twenty frames on came inside the coyote grace, a ground jump again
  const script = (held: string[], presses: Record<string, number[]> = {}) =>
    `(() => { const K = ${JSON.stringify(held)}; const P = ${JSON.stringify(presses)}; const t0 = performance.now(); let f = 0; const gone = new Set(); let due = new Set();
      window.__range.setScript({ held: (a) => K.includes(a), pressedNow: (a) => (K.includes(a) && f <= 1) || due.has(a) }, () => { f++; const t = performance.now() - t0; due = new Set(); for (const [a, list] of Object.entries(P)) for (const ms of list) if (t >= ms && !gone.has(a + ms)) { gone.add(a + ms); due.add(a); } }); })()`;
  const stop = () => ev(t, "window.__range.setScript(null)");
  const tp = (x: number, y: number, z: number, yaw: number, pitch = 0) => ev(t, `window.__range.player.teleport(${x}, ${y}, ${z}, ${yaw}, ${pitch})`);
  await tp(0, 0, -8, 0);
  check("sk tour: MOVE done at the marker", await stepTo("move"));
  // a double jump in the open
  await tp(0, 0, -12, 0);
  await ev(t, script([], { jump: [30, 450] }));
  await sleep(1200);
  await stop();
  // a wall run: sprinting along the right-hand wall (its face at x 33.49, the body 0.41 m round, a wall
  // counted within 4 hu of it), then a jump, from 2 m down range: SpeedKills' range ends 24 m in (Phase 20 A12). Up to three runs, as a player would try again: the take-off
  // is a matter of frames, and a machine busy with another run has fewer of them
  // (and while on the wall, the view's lean off it, read every few frames: the owner, 2026-09-28, "it should twist the
  // camera a bit and have some sort of visual feedback that we are indeed wallrunning")
  let wallFelt: { lean: number; side: number; tilt: number } | null = null;
  for (let i = 0; i < 3; i++) {
    await tp(33.03, 0, -2, 0);
    await ev(t, `(() => { window.__wallFelt = null; clearInterval(window.__wallT); window.__wallT = setInterval(() => { const w = window.__range.wallFeel(); if (w.onWall && (!window.__wallFelt || Math.abs(w.lean) > Math.abs(window.__wallFelt.lean))) window.__wallFelt = { lean: w.lean, side: w.side, tilt: w.tilt }; }, 10); })()`);
    await ev(t, script(["forward", "sprint"], { jump: [600 + i * 150] }));
    await sleep(1400);
    await stop();
    await sleep(400);
    wallFelt = await ev<{ lean: number; side: number; tilt: number } | null>(t, "(() => { clearInterval(window.__wallT); return window.__wallFelt; })()");
    if (await ev<boolean>(t, `window.__range.tour.seen.tech.some((x) => x === "WALL RUN" || x === "WALL KICK")`)) break;
  }
  // (off the wall, whenever the run ends, and a second of the game's time for the lean to ease out: wallOut is 0.25 s)
  await t.waitForFunction("!window.__range.wallFeel().onWall", { polling: 50, timeout: 5000 }).catch(() => undefined);
  await gameSleep(t, 1);
  const feelAfter = await ev<{ onWall: boolean; lean: number }>(t, "window.__range.wallFeel()");
  const leanAfter = feelAfter.lean;
  check(
    "sk tour: on the wall the view leans away from it, and levels again off it",
    // (away: the wall on the right, the camera's right side rises, as a head tilts off a wall)
    !!wallFelt && wallFelt.side > 0.5 && wallFelt.lean > 0.5 && wallFelt.tilt > 0.05 && Math.abs(leanAfter) < 0.1,
    JSON.stringify({ wallFelt, feelAfter }),
  );
  // a climb: into the right-hand wall (its face at x 33.49), forward, a jump at it; the ladder's wall at z -46 is
  // past SpeedKills' sandbox edge now (Phase 20 A12)
  await tp(32.9, 0, -12, -90);
  await ev(t, `(() => { const K = ["forward"]; let f = 0; window.__range.setScript({ held: (a) => K.includes(a), pressedNow: (a) => (K.includes(a) && f <= 1) || (a === "jump" && f % 20 === 0) }, () => { f++; }); })()`);
  const moved = await stepTo("moves", 8000);
  await stop();
  check("sk tour: DOUBLE JUMP, WALL RUN and CLIMB, all three done for real", moved, JSON.stringify(await ev(t, "({ step: window.__range.tour.stepId, seen: window.__range.tour.seen, extra: window.__range.player.extraMoves })")));
  await sleep(800);
  // shoot: six metres from a figure, facing it, a burst with the trigger
  const aimAt = (fromX: number, fromY: number, fromZ: number) =>
    `(() => { const r = window.__range; const d = r.dummies.filter((x) => x.group.visible && !x.knocked).sort((a, b) => Math.hypot(a.group.position.x - ${fromX}, a.group.position.z - ${fromZ}) - Math.hypot(b.group.position.x - ${fromX}, b.group.position.z - ${fromZ}))[0]; const p = d.group.position; const dx = p.x - ${fromX}, dz = p.z - ${fromZ}; const yaw = Math.atan2(-dx, -dz) * 180 / Math.PI; const pitch = Math.atan2(p.y + 1.3 - (${fromY} + 1.6), Math.hypot(dx, dz)) * 180 / Math.PI; r.player.teleport(${fromX}, ${fromY}, ${fromZ}, yaw, pitch); return { x: p.x, y: p.y, z: p.z }; })()`;
  await tp(0, 0, -2, 0);
  await sleep(300);
  await ev(t, `(() => { const r = window.__range; const d = r.dummies.find((x) => x.group.visible && !x.knocked); const p = d.group.position; const yaw = Math.atan2(0, -6) * 180 / Math.PI; r.player.teleport(p.x, 0, p.z + 6, 0, -5); })()`);
  await sleep(300);
  await ev(t, padSet(7, true));
  const shot = await stepTo("shoot", 3000);
  await ev(t, padSet(7, false));
  check("sk tour: SHOOT done with a real hit", shot, JSON.stringify(await ev(t, "window.__range.stats()")));
  // the two hacks, on their own keys (F the move, G the tool)
  await ev(t, "window.__range.input.locked = true");
  await t.keyboard.press("KeyF");
  await sleep(600);
  await t.keyboard.press("KeyG");
  check("sk tour: HACKS done with both keys", await stepTo("hacks", 4000), JSON.stringify(await ev(t, "window.__range.sk.state()")));
  // fusion: the range's fusion key, once the hand is free (a key the gun takes waits out a swap)
  await t.waitForFunction("!window.__range.loadout.swapping", { polling: 50, timeout: 3000 }).catch(() => undefined);
  // (the fusion key reads the keyboard itself, not the movement script)
  await t.keyboard.press("KeyU");
  const fused = await stepTo("fusion", 3000);
  check("sk tour: FUSION done with the fusion key", fused, JSON.stringify(await ev(t, "({ step: window.__range.tour.stepId, fusion: window.__range.loadout.active.fusion, swapping: window.__range.loadout.swapping, playing: window.__range.input.playing, locked: window.__range.input.locked, id: window.__range.loadout.active.id })")));
  // high ground: on the stairs' sixth step (2.64 m, the tour asks 2.5), the highest footing inside SpeedKills'
  // sandbox (Phase 20 A12: the left platform at 4.6 m is past its edge)
  await sleep(1500);
  // (the trigger pulled for two frames and let go for two: a pull of this gun is one shot. Counted in frames, not
  // milliseconds: on a page drawing few frames a 120 ms beat could pull and let go between two of them)
  const target = await ev(t, aimAt(-20, 2.64, -23.5));
  await sleep(300);
  await ev(t, aimAt(-20, 2.64, -23.5));
  await ev(t, `(() => { let f = 0; window.__range.setScript({ held: (a) => a === "fire" && f % 4 < 2, pressedNow: () => false }, () => { f++; }); })()`);
  // what holds the trigger, read while the script pulls it (read after, the script is gone)
  await sleep(700);
  const during = await ev(t, "({ why: window.__range.triggerWhy(), shots: window.__range.stats().shots, pos: window.__range.player.pos.toArray().map((v) => +v.toFixed(2)), yaw: +window.__range.player.yaw.toFixed(1), pitch: +window.__range.player.pitch.toFixed(1) })");
  const high = await stepTo("high", 3300);
  await stop();
  check("sk tour: HIGH GROUND done with a hit from the stairs, 2.6 m up", high, JSON.stringify(await ev(t, `({ during: ${JSON.stringify(during)}, target: ${JSON.stringify(target)}, step: window.__range.tour.stepId, y: window.__range.player.pos.y, stats: window.__range.stats(), dropping: window.__range.player.dropping, aboard: window.__range.player.aboard, empty: window.__range.loadout.active.empty, clip: window.__range.loadout.active.state.clip, swapping: window.__range.loadout.swapping, reloading: window.__range.loadout.active.state.reloading, hud: window.__range.hud.last && { heal: window.__range.hud.last.heal, holster: window.__range.hud.last.holster } })`)));
  // the ring: five seconds in it
  await tp(6, 0, -14, 0);
  // (five seconds of the game's time: a slow page runs fewer of them to the wall's second)
  const g0 = await ev<number>(t, "window.__range.gameTime()");
  await t.waitForFunction(`window.__range.tour.stepId === "dying" || window.__range.gameTime() - ${g0} > 7`, { polling: 100, timeout: 40000 }).catch(() => undefined);
  check("sk tour: DECAY AND THE ZONE done after five seconds in the ring", (await step()) === "dying", JSON.stringify(await ev(t, "({ step: window.__range.tour.stepId, pos: [window.__range.player.pos.x, window.__range.player.pos.y, window.__range.player.pos.z], tour: window.__range.hud.last && window.__range.hud.last.tour, t: window.__range.gameTime() })")));
  // the echo, and the tour is over and remembered
  await tp(-6, 0, -20, 0);
  const finished = await t.waitForFunction("window.__range.tour.stepId === null && localStorage.getItem('range.tour.done') === '1'", { polling: 100, timeout: 5000 }).then(() => true, () => false);
  check("sk tour: DYING done at the echo, and the tour is complete (remembered)", finished, String(await step()));
  await t.close();
}

/**
 * SpeedKills' dropship, ridden (the owner's rule, speedkills.json ship): it
 * starts off the city and flies at least five seconds before its doors open,
 * so the city loads behind it; the jump is refused until then, and the drop
 * lands in the city. The city is the square 250 m either side of (0, 500).
 */
async function speedkillsShipTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?norender&game=speedkills");
  await ev(page, "window.__straightDrop = false");
  await ev(page, `(() => { document.getElementById("brStart").value = "loadout"; document.getElementById("goBr").click(); document.getElementById("startMode").click(); })()`);
  await page.waitForFunction("window.__range.duel() && window.__range.shipState().aboard", { polling: 100, timeout: 20000 }).catch(() => undefined);
  await ev(page, "window.__range.duel().holdFire = true");
  const on = await ev<{ aboard: boolean; x: number; z: number; doorsIn: number }>(
    page,
    `(() => { const R = window.__range; return { aboard: R.shipState().aboard, x: R.player.pos.x, z: R.player.pos.z, doorsIn: R.ship().doorsIn(performance.now() / 1000) }; })()`
  );
  const outside = Math.abs(on.x) > 250 || Math.abs(on.z - 500) > 250;
  check("sk ship: the match starts aboard, off the city, with the doors at least five seconds away", on.aboard && outside && on.doorsIn >= 5, JSON.stringify(on));
  // the ship passes the Spire, beside its mast and near enough to glide onto its crown (speedkills.json ship centre;
  // tools/checks/sk-drop.ts glides it): the match's own line, not only the function's
  const shipPass = await ev<{ off: number; near: number; far: number } | null>(
    page,
    `(() => { const r = window.__range; const l = r.duel().shipLine; const t = r.sk.spireTop(); if (!l) return null; const s = Math.max(0, Math.min(l.length, (t.x - l.ax) * l.dx + (t.z - l.az) * l.dz)); return { off: Math.hypot(t.x - (l.ax + l.dx * s), t.z - (l.az + l.dz * s)), near: 17, far: 26 }; })()`,
  );
  check("sk ship: the ship passes the Spire's crown, 17 to 26 m off its middle", !!shipPass && shipPass.off >= shipPass.near - 0.01 && shipPass.off <= shipPass.far + 0.01, JSON.stringify(shipPass));
  // aboard, the city is the side drawn, wherever the ship starts (Phase 20 A5: from the north the camera hung over
  // the range for 7.5 s and the range and its arenas were drawn instead)
  const side = await ev<{ want: string }>(page, "window.__range.sides()");
  check("sk ship: aboard, the city is what is drawn, not the range", side.want === "br", JSON.stringify({ ...side, z: on.z }));
  // the jump held from here: refused while the doors are shut, taken as they open
  await ev(page, `window.__range.setScript({ held: (a) => a === "jump", pressedNow: (a) => a === "jump", playing: true, endFrame: () => {} })`);
  await sleep(1500);
  const shut = await ev<boolean>(page, "window.__range.shipState().aboard");
  check("sk ship: a jump with the doors shut is refused", shut);
  const left = await page.waitForFunction("!window.__range.shipState().aboard", { polling: 100, timeout: 15000 }).then(() => true, () => false);
  await ev(page, "window.__range.setScript(null)");
  check("sk ship: once the doors open, the jump takes you out", left);
  const landed = await page.waitForFunction("!window.__range.player.dropping && !window.__range.shipState().aboard", { polling: 250, timeout: 60000 }).then(() => true, () => false);
  const at = await ev<{ x: number; z: number }>(page, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })");
  check("sk ship: and the drop lands in the city", landed && Math.abs(at.x) <= 251 && Math.abs(at.z - 500) <= 251, JSON.stringify({ landed, ...at }));
  await page.close();
}

/** a SpeedKills battle royale in the city: it starts, 30 in it, bots on the streets, loot on the floors */
async function speedkillsBrTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?norender&game=speedkills");
  // the row set to what this checks (trios, 27 bots), not left to its defaults: those are duos and 28 since Milestone 341
  await ev(page, brRow("trio", 27));
  await ev(page, `(() => { document.getElementById("brStart").value = "loot"; document.getElementById("goBr").click(); document.getElementById("startMode").click(); })()`);
  const fought = await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 60000 }).then(() => true, () => false);
  if (!fought) {
    check("speedkills br: a match starts in the city", false);
    await page.close();
    return;
  }
  // its sky (speedkills.json identity.skies): golden hour it starts at (the owner's, 2026-10-04), the neon night, and the
  // hazy day to see the city by (Milestone 288), applied at once
  const sky = await ev<{ options: string[]; start: string; night: number; golden: number; kept: string | null }>(
    page,
    `(() => { const s = document.getElementById("skyHour"); const sc = window.__range.scene; const start = s.value; const golden = sc.environmentIntensity; s.value = "neonNight"; s.dispatchEvent(new Event("change")); const night = sc.environmentIntensity; const kept = localStorage.getItem("range.sky.hour.sk"); s.value = start; s.dispatchEvent(new Event("change")); return { options: [...s.options].map((o) => o.value), start, night, golden, kept }; })()`,
  );
  check("speedkills: its sky is golden hour, with the neon night and the hazy day the others, applied at once and kept as its own", sky.options.join(",") === "goldenHour,neonNight,hazyDay" && sky.start === "goldenHour" && sky.golden > sky.night && sky.kept === "neonNight", JSON.stringify(sky));
  const start = await ev<{ players: number; bots: number; pois: string[]; loot: number; health: number; shield: number; shieldMax: number }>(
    page,
    `(() => { const d = window.__range.duel(); return { players: d.players, bots: d.bots.length, teams: d.bots.map((x) => x.team + (x.guard ? "g" : "")).join(","), pois: window.__range.brMap.pois.map((p) => p.name), loot: d.lootField ? d.lootField.drops.size : -1, health: d.health, shield: d.shield, shieldMax: d.shieldMax }; })()`
  );
  check("speedkills br: a match in the city, its nine sectors the places, the centre among them", start.pois.length === 9 && start.pois.includes(CENTRE_NAME), JSON.stringify(start.pois));
  check("speedkills br: thirty in the match (27 bots in squads, with your squad of three)", start.bots === 27, JSON.stringify(start));
  check("speedkills br: loot on the city's floors", start.loot > 150, `${start.loot} items`);
  // and up on the roofs, where the fights are (speedkills.json loot maxFloor): it stopped at 12 m, under most of the city's roofs
  const high = await ev<{ over12: number; over24: number }>(page, "(() => { const ds = [...window.__range.duel().lootField.drops.values()]; return { over12: ds.filter((x) => x.pos.y > 12).length, over24: ds.filter((x) => x.pos.y > 24).length }; })()");
  check("speedkills br: loot on the roofs too, a dozen storeys and more up", high.over12 >= 40 && high.over24 >= 10, JSON.stringify(high));
  if (!(await onNeon(page))) {
    // A bot whose way goes up a jump pad is thrown by it (city.ts, a graph node's `pad`; bots.ts jumpPad): one stood
    // on the Spire's pad up to its second tier, its next step the tier's roof. Early in the fight with the ring held,
    // before the first wave's 50 s warning is out: the centre goes early in some matches (half of them end
    // elsewhere), and one run's bot fell through a Spire already dissolved. The bot is put back as it was after.
    await page.waitForFunction("window.__range.duel().bots.some((b) => b.landed && b.bot.alive && !b.bot.dropping && !b.down && !b.guard)", { polling: 200, timeout: 30000 }).catch(() => undefined);
    const rode = await ev<{ from: number; y: number; want: number; end: number; phase: string } | null>(
      page,
      `(() => new Promise((ok) => { const r = window.__range; const d = r.duel(); const nodes = d.map.nodes; const i = nodes.findIndex((n) => n.pad && (n.y ?? 0) > 20 && (nodes[n.pad.to].y ?? 0) > (n.y ?? 0) + 10); const b = d.bots.find((x) => x.landed && x.bot.alive && !x.bot.dropping && !x.guard && !x.down); if (i < 0 || !b) return ok(null); const n = nodes[i];
        const held = { fire: d.holdFire, ring: d.ring.timeLeft, sees: b.bot.sees }; d.holdFire = true; d.ring.timeLeft = 1e6; b.bot.sees = () => false; b.bot.pos.set(n.x, n.y, n.z); b.bot.dummy.group.position.copy(b.bot.pos); b.node = i; b.goal = n.pad.to;
        const phase = r.sk.decay()?.states?.[n.poi]?.phase ?? "none";
        // the highest it got, and where it is after: its way can go on from that roof (the next tier's pad stands
        // 0.1 m from where this one lands you, and a bot on a roof's climb takes it within a frame)
        let y = n.y; const want = nodes[n.pad.to].y; const t0 = performance.now(); const tick = () => { y = Math.max(y, b.bot.pos.y); if (performance.now() - t0 < 5000) return void setTimeout(tick, 30); d.holdFire = held.fire; d.ring.timeLeft = held.ring; b.bot.sees = held.sees; ok({ from: n.y, y, want, end: b.bot.pos.y, phase }); }; tick(); }))()`,
    );
    check("speedkills bots: a bot whose way goes up a jump pad is thrown onto the roof it leads to", !!rode && rode.y >= rode.want - 0.6 && rode.end >= rode.want - 0.6, JSON.stringify(rode));
  } else oldCityOnly("a bot thrown up a jump pad onto its roof");
  check("speedkills br: 100 health and 50 shield", start.health === 100 && start.shieldMax === 50, JSON.stringify(start));
  const spireBots = await ev<number>(page, `(() => { const d = window.__range.duel(); const m = window.__range.brMap; return d.bots.filter((b) => b.dropTo && m.placeAt(b.dropTo.x, b.dropTo.z)?.id === "c").length; })()`);
  check("speedkills br: the bots drop on the Spire the most (every other squad)", spireBots >= 12, `${spireBots} of 27`);
  // The bots land and walk the streets: each one's farthest from where it stood once all had landed, over 12 s of game
  // time. Where it stood after 6 s of the wall's counted the first rummage: on the Neon City a gun lies within reach of
  // most landings, a bot stands over it 1.5 to 9 s by its tier (bots.json loot perItem), and 8 to 13 of 28 had moved
  // 3 m when the 6 s were up, the same before the street cover as after it; by 12 s 26 to 28 of 28 had, none of the
  // rest stuck (a probe of seven matches, 2026-10-09).
  await page.waitForFunction("window.__range.duel().bots.every((b) => b.landed)", { polling: 500, timeout: 60000 }).catch(() => undefined);
  const far = await ev<number[]>(
    page,
    `(() => new Promise((ok) => { const r = window.__range; const bots = r.duel().bots; const from = bots.map((b) => [b.bot.pos.x, b.bot.pos.z]); const far = bots.map(() => 0); const g0 = r.gameTime(); const t0 = performance.now();
      const tick = () => { bots.forEach((b, i) => (far[i] = Math.max(far[i], Math.hypot(b.bot.pos.x - from[i][0], b.bot.pos.z - from[i][1])))); if (r.gameTime() - g0 < 12 && performance.now() - t0 < 240000) return void setTimeout(tick, 250); ok(far); }; tick(); }))()`,
  );
  const moved = far.filter((d) => d > 3).length;
  check("speedkills br: the bots land and move through the city", moved >= 22, `${moved} of ${far.length} moved 3 m in 12 s of game time`);
  if (!(await onNeon(page))) {
    // the high ground: a bot sent up a low tower's stairs (bots.json skRoofs, city.ts ROOF_ROUTES) walks them to the
    // roof with its own movement. The match takes the choice by chance; the test makes it, and watches the walk.
    // The bot is made blind for it: someone in sight comes before a climb, as it should, and one run's bot chased
    // whoever it saw straight past its stair.
    const climb = await ev<{ id: number; roofY: number } | null>(
      page,
      `(() => { const r = window.__range; const d = r.duel(); d.holdFire = true; window.__heldRing = d.ring.timeLeft; d.ring.timeLeft = 1e6; const early = new Set(d.decay.waves[0] ?? []); const route = r.roofRoutes().find((x) => x.street >= 0 && [x.street, ...x.nodes].every((i) => !early.has(d.map.nodes[i].poi))); if (!route) return null; const n = d.map.nodes; const roof = route.nodes[route.nodes.length - 1]; const b = d.bots.find((x) => x.bot.alive && !x.down && !x.bot.dropping); if (!b) return null; const s = n[route.street]; b.bot.pos.set(s.x, 0, s.z); b.node = route.street; b.goal = route.street; b.climb = { roof, holdUntil: null }; b.bot.sees = () => false; return { id: b.bot.remote.id, roofY: n[roof].y }; })()`
    );
    const g0 = await ev<number>(page, "window.__range.gameTime()");
    const roofed = climb
      ? await page.waitForFunction(`(() => { const b = window.__range.duel().bots.find((x) => x.bot.remote.id === ${climb.id}); return !!b && b.bot.pos.y > ${climb.roofY} - 0.5 || window.__range.gameTime() - ${g0} > 90; })()`, { polling: 250, timeout: 180000 }).then(() => true, () => false)
      : false;
    const top = climb ? await ev<{ y: number; goal: number; climb: unknown }>(page, `(() => { const b = window.__range.duel().bots.find((x) => x.bot.remote.id === ${climb.id}); return { y: b.bot.pos.y, goal: b.goal, climb: b.climb }; })()`) : null;
    // the downtown's jump pads (city.ts downtownBlock): one on the street throws you onto its podium, one on a
    // podium's terrace up onto a tower's roof. Stood on, each lands you a storey or more up.
    const padRide = async (pick: string): Promise<{ from: number; to: number; x: number; z: number } | null> => {
      const pad = await ev<{ x: number; y: number; z: number } | null>(page, `(() => { const p = window.__range.duel().map.pads.filter((q) => q.up !== undefined).find(${pick}); return p ? { x: p.x, y: p.y ?? 0, z: p.z } : null; })()`);
      if (!pad) return null;
      await ev(page, `window.__range.player.teleport(${pad.x}, ${pad.y + 0.05}, ${pad.z}, 0)`);
      const g0 = await ev<number>(page, "window.__range.gameTime()");
      await page.waitForFunction(`window.__range.gameTime() - ${g0} > 4 && window.__range.player.onGround`, { polling: 100, timeout: 30000 }).catch(() => undefined);
      const at = await ev<{ y: number; x: number; z: number }>(page, "({ y: window.__range.player.pos.y, x: window.__range.player.pos.x, z: window.__range.player.pos.z })");
      return { from: pad.y, to: at.y, x: at.x, z: at.z };
    };
    await ev(page, "window.__range.duel().holdFire = true");
    // a podium's pad stands on the pavement (a kerb up); the highway's stand in the road
    const street = await padRide("(q) => (q.y ?? 0) > 0.1 && (q.y ?? 0) < 1 && Math.hypot(q.x, q.z - 500) > 60");
    check("speedkills city: a street's jump pad throws you onto its podium, a storey or two up", !!street && street.to > street.from + 3.5, JSON.stringify(street));
    const highway = await padRide("(q) => (q.y ?? 0) === 0 && q.over > 20");
    check("speedkills city: a pad in the road throws you onto the rooftop highway, six storeys up", !!highway && Math.abs(highway.to - 24) < 0.5, JSON.stringify(highway));
    const terrace = await padRide("(q) => (q.y ?? 0) > 3 && Math.hypot(q.x, q.z - 500) > 60");
    check("speedkills city: a terrace's jump pad throws you onto a tower's roof", !!terrace && terrace.to > terrace.from + 10, JSON.stringify(terrace));
    check("speedkills br: a bot sent up a low tower walks its stairs to the roof", !!climb && roofed && !!top && top.y > climb.roofY - 0.5, JSON.stringify({ climb, top }));
    await ev(page, "(() => { const d = window.__range.duel(); d.holdFire = false; d.ring.timeLeft = window.__heldRing; })()");
  } else oldCityOnly("a bot up a low tower's stairs, and the street, road and terrace jump pads");
  // the bots play by a player's health and carry their tier's hacks (bots.json skHacks)
  const kit = await ev<{ shields: number[]; hacks: string[]; tier: string }>(
    page,
    `(() => { const d = window.__range.duel(); const b = d.bots.find((x) => x.bot.alive && x.bot.diff.name === "normal") ?? d.bots.find((x) => x.bot.alive); const shields = [...new Set(d.bots.map((x) => x.bot.dummy.shieldMax))]; const t = b.bot.dummy.tier; b.bot.dummy.setTier(4); const kitted = b.bot.dummy.shieldMax; b.bot.dummy.setTier(t); return { shields: [...shields, kitted], hacks: [...b.bot.skHacks], tier: b.bot.diff.name }; })()`
  );
  const tiers = await ev<string[]>(page, `[...document.querySelectorAll("#botDifficulty option")].map((o) => o.textContent)`);
  check("speedkills: the bots' five tiers by SpeedKills' names, then Mixed", tiers.slice(0, 5).join(",") === "Beginner,Casual,Skilled,Advanced,Extreme" && /Mixed/.test(tiers[5] ?? ""), tiers.join(","));
  check("speedkills br: every bot has a player's one 50 shield, whatever armour tier its kit reaches", kit.shields.every((x) => x === 50), JSON.stringify(kit));
  check("speedkills br: a Skilled bot carries Heal and Dash", kit.tier !== "normal" || kit.hacks.join(",") === "heal,dash", JSON.stringify(kit));
  // hurt one badly, with nobody shooting (the bots fight each other otherwise, and one run lost half
  // the heal to them): its Heal hack brings its health back well before regeneration would. Three
  // seconds of the game's own time, which a busy machine stretches.
  const healed = await ev<{ before: number; after: number; used: number }>(
    page,
    `(() => new Promise((ok) => { const r = window.__range; const d = r.duel(); const held = d.holdFire; d.holdFire = true; const b = d.bots.find((x) => x.bot.alive && x.bot.skHacks.includes("heal")).bot; b.dummy.shield = 0; b.dummy.health = 30; const before = b.dummy.health; const t0 = r.gameTime();
      const wait = () => { if (r.gameTime() - t0 < 3) return setTimeout(wait, 50); d.holdFire = held; ok({ before, after: b.dummy.health, used: b.skUsed.heal }); }; wait(); }))()`
  );
  // (at 12 a second, hacks.json _heal: about 36 back in 3 s)
  check("speedkills br: a hurt bot uses its Heal hack (health back within 3 s, before regeneration starts at 8)", healed.used >= 1 && healed.after >= healed.before + 10, JSON.stringify(healed));
  // Phase 20 A2, the owner's case for real: that healed bot's health is a fraction (Heal gives perSecond x dt a
  // frame). A hit through the bullets' own path that finishes it takes exactly what it had left, and reads whole.
  // A third off first, in case the heal happened to stop on a whole number, so this cannot pass by luck.
  const finish = await ev<{ left: number; n: { amount: number; text: string } | null } | null>(
    page,
    `(() => { const r = window.__range; const d = r.duel(); const held = d.holdFire; d.holdFire = true;
      const b = d.bots.find((x) => x.bot.alive && x.bot.skUsed.heal >= 1)?.bot; if (!b) { d.holdFire = held; return null; }
      if ((b.dummy.health + b.dummy.shield) % 1 === 0) b.dummy.health -= 1 / 3;
      const left = b.dummy.health + b.dummy.shield;
      r.hitThrough(b.remote.id, 250); d.holdFire = held;
      const n = r.hud.damageNumbers.at(-1); return { left, n: n ? { amount: n.amount, text: n.text } : null }; })()`,
  );
  check("speedkills numbers: a finishing hit on a bot part-way healed reads whole, and keeps what it took underneath", !!finish?.n && /^\d+$/.test(finish.n.text) && Math.abs(finish.n.amount - finish.left) < 1e-9, JSON.stringify(finish));
  // No material rebuilt every frame. three.js draws a see-through two-sided material twice, marking it
  // to be rebuilt before each pass, and glass that refracts has it draw the whole scene again: a
  // security light's glass did the first and a generator's window the second, 4 ms of a frame over the
  // city (props.ts plainGlass). What is on screen varies with the window, so the rule is held on
  // every material in the scene, drawn or not.
  const dear = await ev<string[]>(
    page,
    `(() => { const out = new Set(); window.__range.scene.traverse((o) => { const m = o.material; if (!m) return; for (const x of Array.isArray(m) ? m : [m]) { if (x.transparent && x.side === 2 && !x.forceSinglePass) out.add((x.name || x.type) + " (two passes)"); if (x.transmission > 0) out.add((x.name || x.type) + " (transmission)"); } }); return [...out]; })()`
  );
  check("speedkills br: no material that three.js rebuilds every frame (two-sided see-through in two passes, or refracting glass)", dear.length === 0, dear.slice(0, 12).join(", ") || "none");
  // the floor: guns and hack cores only, the Spire the richest
  const floor = await ev<{ kinds: string[]; spire: number; other: number; levels: number[] }>(
    page,
    `(() => { const d = window.__range.duel(); const m = window.__range.brMap; const kinds = new Set(); let spire = 0, other = 0; const levels = [0, 0, 0, 0, 0, 0];
      for (const x of d.lootField.drops.values()) { kinds.add(x.item.kind); const p = m.placeAt(x.pos.x, x.pos.z); if (p && p.id === "c") spire++; else other++; if (x.item.kind === "weapon") levels[x.item.fusion ?? 0]++; }
      return { kinds: [...kinds], spire, other, levels }; })()`
  );
  check("speedkills br: the floor is guns and hack cores, nothing else to sort", floor.kinds.every((k) => ["weapon", "hack", "echo"].includes(k)) && floor.kinds.includes("hack"), JSON.stringify(floor.kinds));
  check("speedkills br: the Spire is the richest sector (the hot drop)", floor.spire > floor.other / 8 * 1.5, JSON.stringify({ spire: floor.spire, other: floor.other }));
  // The centre's loot comes back (speedkills.json loot.restock, as Red Tiger's did): take most of the hot
  // zone's guns and hack cores away, as a crowd landing there would, and the host puts some back.
  const taken = await ev<{ stock: number; left: number }>(
    page,
    `(() => { const d = window.__range.duel(); const f = d.lootField; const held = f.hotHeld(); held.slice(0, Math.ceil(held.length * 0.7)).forEach((x) => f.remove(x.key)); d.restockAt = 0; return { stock: f.hotStock, left: f.hotHeld().length }; })()`,
  );
  await sleep(1500);
  const back = await ev<number>(page, "window.__range.duel().lootField.hotHeld().length");
  check("speedkills br: the centre's loot comes back once most of it is taken", taken.stock > 40 && back > taken.left, JSON.stringify({ ...taken, back }));
  check("speedkills br: some guns lie already fused", floor.levels[1] + floor.levels[2] + floor.levels[3] > 0, JSON.stringify(floor.levels));
  // picking up: a copy fuses, a higher copy takes you to its level, a hack core fuses its hack
  const fuse = await ev<{ first: number; second: number; third: number; hack: number }>(
    page,
    `(() => { const r = window.__range; const g = { kind: "weapon", id: "r97", n: 1, rarity: "common", fusion: 0 };
      r.applyLoot({ ...g }); const i = r.loadout.slots.findIndex((s) => s.id === "r97"); const first = r.loadout.slots[i].fusion;
      r.applyLoot({ ...g }); const second = r.loadout.slots[i].fusion;
      r.applyLoot({ ...g, fusion: 4, rarity: "legendary" }); const third = r.loadout.slots[i].fusion;
      const mob = r.sk.hacks()[0].held.id; r.applyLoot({ kind: "hack", id: mob, n: 0, rarity: "common" }); const hack = r.sk.hacks()[0].held.level;
      return { first, second, third, hack }; })()`
  );
  check("speedkills br: a gun found is level 0, a copy fuses it to 1, a level-4 copy takes it to 4, a hack core fuses its hack", fuse.first === 0 && fuse.second === 1 && fuse.third === 4 && fuse.hack === 1, JSON.stringify(fuse));
  // (before the decay: from its first wave the player stands in a sector coming apart, and the checks of a
  // fight's feel are not about that; there the outline read nothing on some runs)
  // (the bot frozen and moved by hand: its world matrix is brought up to date as the renderer would, since a
  // ?norender page never draws and the aim ray met it where it had been)
  // The feel of a fight (speedkills.json feel): a bot stood in front of you is outlined while your crosshair is on
  // it and not once you turn away; and going well past a sprint shows the speed streaks
  const outline = await ev<{ on: number; off: number; alive: boolean; ghost: boolean; why: { ray: { hits: number; at12: number } } & Record<string, unknown> } | null>(
    page,
    `(() => new Promise((ok) => { const r = window.__range; const d = r.duel(); d.holdFire = true; const b = d.bots.find((x) => x.bot.alive && !x.bot.dropping && !x.bot.skHacks?.includes("invis") && x.bot.dummy.group.visible); if (!b) return ok(null); const upd = b.bot.update; b.bot.update = () => []; const p = r.player.pos; const eye = r.player.eyePosition(); b.bot.pos.set(p.x, p.y, p.z - 12); b.bot.dummy.group.position.copy(b.bot.pos); b.bot.dummy.pose.stance = "crouch"; b.bot.dummy.crouchAmt = 1; b.bot.dummy.hits.scale.y = 0.66; b.bot.dummy.group.updateMatrixWorld(true); r.player.yaw = 0; const torso = b.bot.dummy.hitMeshes[1].getWorldPosition(new r.THREE.Vector3()); r.player.pitch = Math.atan2(torso.y - eye.y, Math.hypot(torso.x - eye.x, torso.z - eye.z)) * 180 / Math.PI;
      // crouched, and aimed at the torso where it is: a bot crouched in cover is shorter, and the check's old fixed
      // 1.2 m passed over one on a roof. The ray at 1.2 m is cast too and must miss, so every run proves the crouch
      // the one the game outlines (main.ts outlined): which pieces of it show depends on the figure's level of
      // detail, which a ?norender page never updates, so the count read 0 on some bots; the picture is sk-outline's
      const lit = () => (r.outlinedNow() === b.bot.dummy ? 1 : 0);
      // what the game's outline ray needed, for a failure to say which part was missing
      const at = { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) };
      const why = () => ({ playing: r.input.playing, inAvatars: d.avatars.includes(b.bot.dummy), meshes: b.bot.dummy.hitMeshes.length, shown: b.bot.dummy.group.visible, other: r.outlinedNow() ? r.outlinedNow() !== b.bot.dummy : false, from: at, now: { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) }, bot: { x: +b.bot.pos.x.toFixed(2), y: +b.bot.pos.y.toFixed(2), z: +b.bot.pos.z.toFixed(2) }, pitch: +r.player.pitch.toFixed(1), ray: (() => { const T = r.THREE; const cast = (pitch) => new T.Raycaster(r.player.eyePosition(), new T.Vector3(0, 0, -1).applyQuaternion(r.player.orientationAt(r.player.yaw, pitch, 0, 0))).intersectObjects(b.bot.dummy.hitMeshes, false).length; const w = b.bot.dummy.hitMeshes[1].getWorldPosition(new T.Vector3()); return { hits: cast(r.player.pitch), at12: cast(Math.atan2(b.bot.pos.y + 1.2 - r.player.eyePosition().y, 12) * 180 / Math.PI), torso: [+w.x.toFixed(2), +w.y.toFixed(2), +w.z.toFixed(2)] }; })() });
      setTimeout(() => { const on = lit(); const w = why(); r.player.yaw = 180; setTimeout(() => { const off = lit(); b.bot.update = upd; ok({ on, off, alive: d.alive, ghost: !!d.ghost, why: w }); }, 400); }, 400); }))()`,
  );
  check("speedkills feel: the enemy under your crosshair is outlined, crouched too, and not once you look away", !!outline && outline.on > 0 && outline.off === 0 && outline.why.ray.at12 === 0, JSON.stringify(outline));
  const streaks = await ev<number>(
    page,
    `(() => new Promise((ok) => { const r = window.__range; let best = 0; const t0 = performance.now(); const tick = () => { r.player.vel.x = 28; best = Math.max(best, Number(document.getElementById("speedLines").style.opacity || 0)); if (performance.now() - t0 < 600) requestAnimationFrame(tick); else ok(best); }; tick(); }))()`,
  );
  check("speedkills feel: going well past a sprint shows the speed streaks", streaks > 0.2, String(streaks));
  // the decay: the clock pushed on, a wave at a time
  type Decay = { plan: { final: string; waves: string[][] }; states: Record<string, { phase: string; k: number }>; held: number; zone: { x: number; z: number; r: number } | null; capture: { holder: number; held: number; open: boolean } };
  const decay0 = await ev<Decay>(page, "window.__range.sk.decay()");
  check("speedkills decay: a plan of four waves of two toward a final sector, every sector live at the start", decay0.plan.waves.length === 4 && decay0.plan.waves.every((w) => w.length === 2) && Object.values(decay0.states).every((s) => s.phase === "live" || s.phase === "warning"), JSON.stringify(decay0.plan));
  const push = (secs: number) => ev(page, `(() => { const r = window.__range.duel().ring; r.timeLeft = Math.min(r.timeLeft, ${secs}); })()`);
  await push(0.05);
  await sleep(1200);
  const dec = await ev<Decay>(page, "window.__range.sk.decay()");
  const first = decay0.plan.waves[0];
  check("speedkills decay: the first wave's sectors decay, from the ground up, and their boxes leave the collision list", first.every((id) => dec.states[id].phase === "decaying") && dec.held > 0, JSON.stringify({ states: first.map((id) => dec.states[id]), held: dec.held }));
  // standing in a decaying sector hurts
  const hurt = await ev<{ before: number; after: number }>(
    page,
    `(() => new Promise((ok) => { const r = window.__range; const d = r.duel(); const s = r.brMap.pois.find((p) => p.id === "${first[0]}"); r.player.teleport(s.x, 0.3, s.z, 0); const before = d.health + d.shield; setTimeout(() => ok({ before, after: d.health + d.shield }), 3500); }))()`
  );
  check("speedkills decay: standing in a decaying sector hurts", hurt.after < hurt.before, JSON.stringify(hurt));
  // on through the waves to the endgame
  for (let w = 0; w < 9; w++) {
    await push(0.05);
    await sleep(350);
  }
  await page.waitForFunction("window.__range.sk.decay()?.zone !== null", { polling: 200, timeout: 15000 }).catch(() => undefined);
  const end = await ev<Decay>(page, "window.__range.sk.decay()");
  const gone = Object.entries(end.states).filter(([id, s]) => id !== end.plan.final && s.phase === "gone").length;
  check("speedkills decay: after four waves every sector but the final one is gone, and the capture zone opens there", gone === 8 && end.states[end.plan.final].phase === "live" && !!end.zone, JSON.stringify({ gone, final: end.plan.final, zone: end.zone }));
  // The bots go for the zone once it is open (brmatch.ts zoneTree): one stood on a street of the final sector, 20 m
  // and more from the zone (an outer district is 52 m deep since Phase 23.3's cut), takes the graph's way to the node
  // nearest its middle (up the Spire's stairs, bridges
  // and pads when that is where it is). Three seconds on, its next node is a step along that way. (A street node, at the
  // street's height and not under it: it is put down at y 0, and on the Neon City the first node under 0.5 m was in the
  // shut space between the metro tunnel's roof and the street, 4 m down, with no way out, the lobby agent's 2026-10-04 run)
  const toward = await ev<{ start: number; goal: number; path: number[] } | null>(
    page,
    `(() => new Promise((ok) => { const r = window.__range; const d = r.duel(); const z = d.captureZone(); if (!z) return ok(null); const nodes = d.map.nodes; const fin = r.sk.decay().plan.final; const start = nodes.findIndex((n) => n.poi === fin && Math.abs(n.y ?? 0) < 0.5 && n.links.length >= 2 && Math.hypot(n.x - z.x, n.z - z.z) > 20); const b = d.bots.find((x) => x.bot.alive && !x.bot.dropping && !x.down && !x.guard); if (start < 0 || !b) return ok(null); const n = nodes[start];
      const held = { fire: d.holdFire, sees: b.bot.sees }; d.holdFire = true; b.bot.sees = () => false; b.bot.pos.set(n.x, 0, n.z); b.bot.dummy.group.position.copy(b.bot.pos); b.node = start; b.goal = start; b.climb = null;
      setTimeout(() => { const t = d.zoneNav?.tree; const path = []; for (let i = start; t && i >= 0 && path.length < 300; i = t.toward[i]) path.push(i); d.holdFire = held.fire; b.bot.sees = held.sees; ok({ start, goal: b.goal, path }); }, 3000); }))()`,
  );
  check(
    "speedkills bots: once the capture zone opens, a bot in its sector takes the graph's way to it",
    !!toward && toward.path.length > 1 && toward.path.indexOf(toward.goal) >= 1,
    JSON.stringify(toward && { start: toward.start, goal: toward.goal, steps: toward.path.length - 1, along: toward.path.indexOf(toward.goal) }),
  );
  // holding the zone alone wins: the bots kept out of it, you in it (dropped from above onto whatever floor
  // stands there: the Spire is solid to its tiers now), its meter near full
  const won = await ev<{ phase: string; placement: number | null }>(
    page,
    `(() => new Promise((ok) => { const r = window.__range; const d = r.duel(); d.holdFire = true; for (const b of d.bots) if (b.bot.alive) { b.bot.pos.set(b.bot.pos.x + 400, b.bot.pos.y, b.bot.pos.z); } const z = d.captureZone(); d.health = 100; r.player.teleport(z.x, 150, z.z, 0);
      d.capture.progress.set(d.sideOf(d.id), ${45} - 1.5); setTimeout(() => ok({ phase: d.phase, placement: d.placement }), 3500); }))()`
  );
  check("speedkills capture: a squad alone in the zone for 45 s wins the match outright", won.phase === "matchEnd" && won.placement === 1, JSON.stringify(won));
  await ev(page, "window.__range.duel()?.leave()");
  await page.close();
}

/**
 * The soldier as other players see it, holding the USSO and BOOG (Phase 27, 27.8 to 27.10): a lab soldier measured by
 * tools/figure-audit.js against tools/figure-frames.ts's bar at rest, aimed and looking up and down; its reload taking
 * the magazine out, letting a copy fall that is cleared away, and bringing a new one home; and the Loadouts tab's soldier
 * with its hands on the gun it shows. The frame sheets are tools/figure-frames.ts's.
 */
async function figureHoldTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?norender&game=speedkills");
  const ready = await page.waitForFunction("window.__range.loaded() && window.__range.soldierReady()", { polling: 250, timeout: 90000 }).then(() => true, () => false);
  if (!ready) {
    check("the soldier: loaded", false);
    await page.close();
    return;
  }
  const paid = await page.waitForFunction("window.__range.paidGuns().ready", { polling: 250, timeout: 60000 }).then(() => true, () => false);
  await page.addScriptTag({ path: "tools/figure-audit.js" });
  await ev(page, `document.getElementById("overlay").classList.add("hidden")`);
  // The hold's bar: both palms on their holds, the barrel along the look, the wrists straight enough. How deep skin goes
  // into the gun and the gun into the body are held no worse than Milestone 320 left them (the USSO's hands 14 mm in
  // where they wrap the grip, BOOG's 28 mm round its thick grip and fore-end; the stock 40 mm into the armour at worst,
  // looking 35 degrees up): tools/figure-frames.ts's sheets hold the finer bar, 6 and 15, still to reach.
  // A hand is on its hold, too: its palm and the fingers that close round it touching the gun, `off` mm at most (a hand
  // kept out of the gun and splayed beside it measured perfect by depth alone).
  // (handOnHand, handOnHandN: how deep the left hand's skin is in the right's, mm, and how much of it, its skin points 4 mm
  // or more in, where a pistol holds both on one grip: G7, figure-audit.js. A depth is at most half a hand's thickness
  // however far one goes through the other, so the count is the measure that grows. Set by the pistols' fits: APUHTHEE's
  // 5 mm at one point, STRYDER's 10 mm at five (its left ring's middle segment pressed into the right fingers, hidden in
  // the clasp); APUHTHEE's left hand put 1 cm into the right reads 10 to 12 mm and 9 to 27 points, 2 cm 23 to 52)
  const BAR = { grip: 3, support: 4, aim: 6, wrist: 60, handIn: 30, gunIn: 40, off: 8, handOnHand: 11, handOnHandN: 5 };
  // Every gun the soldier is fitted to hold (soldierhold.json guns, in the roster's order: docs/PLAN_SOLDIER_EIGHT_GUNS.md
  // G2): each is held to every check below, so a gun joins them by its fit alone, and none is forgotten for it
  const ROSTER = skCfg.roster as string[];
  // (FIGURE_GUNS=wingman,lstar runs these checks on those guns alone: a new gun's fit without every fitted gun's run)
  const FIGURE_GUNS = (process.env.FIGURE_GUNS ?? "").split(",").filter(Boolean);
  const FITTED = Object.keys(soldierHoldCfg.guns)
    .filter((k) => !k.startsWith("_") && (!FIGURE_GUNS.length || FIGURE_GUNS.includes(k)))
    .sort((a, b) => ROSTER.indexOf(a) - ROSTER.indexOf(b));
  const nameOf = (id: string) => (skCfg.weapons as Record<string, { name?: string }>)[id]?.name ?? id;
  type A = { armed: boolean; grip?: number; support?: number; aim?: number; wristL: number; wristR: number; handIn?: { l: number; r: number }; gunIn?: number; palmGap?: { l: number; r: number }; fingerGap?: Record<string, number>; handOnHand?: number; handOnHandN?: number; handGap?: Record<string, number>; below?: string[] };
  const HOLDING = ["middle_r", "ring_r", "pinky_r", "thumb_r", "index_l", "middle_l", "ring_l", "pinky_l"];
  // (the left hand round a pistol's grip holds the right hand: a left finger or palm touching it is on its hold, G8)
  const touching = (a: A, f: string) => Math.min(a.fingerGap?.[f] ?? 99, f.endsWith("_l") ? (a.handGap?.[f] ?? 99) : 99);
  // (on a pistol the left hand's four fingers lie over the right's three below the guard, so its pinky is past the
  // handle's bottom, as a big hand's support pinky hangs under a magazine: APUHTHEE's 14 mm from the right pinky)
  const holdingOf = (id: string) => ((soldierHoldCfg.guns as Record<string, { stance?: string }>)[id]?.stance === "pistol" ? HOLDING.filter((f) => f !== "pinky_l") : HOLDING);
  // (and a finger whose knuckle is under the gun's lowest point has nothing there to hold: figure-audit.js below;
  // STRYDER's right pinky, the soldier's glove wider than its handle is long)
  const on = (a: A, id: string) => Math.max(Math.min(a.palmGap?.l ?? 99, a.handGap?.palm_l ?? 99), a.palmGap?.r ?? 99) <= BAR.off && holdingOf(id).every((f) => (a.below ?? []).includes(f) || touching(a, f) <= BAR.off);
  const within = (a: A | null, aimed: boolean, id: string) =>
    !!a && a.armed && (a.grip ?? 99) <= BAR.grip && (a.support ?? 99) <= BAR.support && (!aimed || (a.aim ?? 99) <= BAR.aim) && a.wristL <= BAR.wrist && a.wristR <= BAR.wrist && Math.max(a.handIn?.l ?? 99, a.handIn?.r ?? 99) <= BAR.handIn && (a.gunIn ?? 99) <= BAR.gunIn && (a.handOnHand ?? 0) <= BAR.handOnHand && (a.handOnHandN ?? 0) <= BAR.handOnHandN && on(a, id);
  for (const id of FITTED) {
    const name = nameOf(id);
    await ev(page, `(() => { const r = window.__range; r.player.teleport(0, 0, 0, 0, -9); r.figureLabManual(false); r.figureLab([{ speed: 0, stance: "stand", pitch: 0, weapon: "${id}", look: "S0000010" }], 2.6, 30); r.figureLabManual(true); r.figureLabStep(0.9); })()`);
    const poses: Array<[string, Record<string, unknown>]> = [
      ["at rest", { speed: 0, stance: "stand", pitch: 0 }],
      ["aimed in", { speed: 0, stance: "stand", pitch: 0, ads: 1 }],
      ["looking 35 up", { speed: 0, stance: "stand", pitch: 35, ads: 1 }],
      ["looking 35 down", { speed: 0, stance: "stand", pitch: -35, ads: 1 }],
    ];
    for (const [label, p] of poses) {
      const a = await ev<A | null>(page, `(() => { const r = window.__range; r.figureLabPose(0, ${JSON.stringify(p)}); r.figureLabStep(0.3); return window.__figureAudit(0, { pitch: ${p.pitch} }); })()`);
      check(`the soldier holding ${name}, ${label}: both palms on their holds and the fingers round them, the barrel along the look, the wrists straight enough, no hand in the gun or the other hand and the gun not in the body`, within(a, true, id), JSON.stringify(a));
      // An arm through the gun, measured exactly (the hold check's measure stops at 4 cm, so an arm 15 cm inside read 4):
      // BOOG's left forearm looking up ran 149 mm through it (2026-10-09, found looking at every gun). ANAKIN's stock along
      // the right arm, 60 to 70 mm, is the owner's to keep ("accept stock in arm", 2026-10-05)
      const arms = await ev<Record<string, number>>(page, `(() => { const a = window.__figureAudit(0, { pitch: ${p.pitch}, exact: true }); return Object.fromEntries(Object.entries(a.gunWhere ?? {}).filter(([k]) => /(lowerarm|upperarm)_[lr]$/.test(k))); })()`);
      const accepted = (k: string) => id === "alternator_smg" && /(lowerarm|upperarm)_r$/.test(k);
      const armDeep = Math.max(0, ...Object.entries(arms).filter(([k]) => !accepted(k)).map(([, d]) => d));
      check(`the soldier holding ${name}, ${label}: no arm through the gun, measured exactly (40 mm at most)`, armDeep <= 40, JSON.stringify(arms));
    }
    // Aimed on the move, as every bot fights and a player strafes: the left hand stays on its hold. The running clips
    // lean the chest forward, and the hold used to slide a third of the way back to the grip, the hand into the gun.
    const moving = await ev<{ slide: number; a: A | null }>(
      page,
      `(() => { const r = window.__range; r.figureLabPose(0, { speed: 14, stance: "stand", pitch: 0, ads: 1 }); r.figureLabStep(0.9); return { slide: r.labFigures()[0].figure.supportSlide, a: window.__figureAudit(0, { pitch: 0 }) }; })()`,
    );
    check(`the soldier holding ${name}, aimed at a sprint: the left hand on its hold, not slid back along the gun and into it`, moving.slide < 0.01 && (moving.a?.handIn?.l ?? 99) <= 8, JSON.stringify({ slide: moving.slide, handIn: moving.a?.handIn }));
    // Carried low running and sprinting (the lowered carry, soldierhold.json lowered.l): the left palm and the holding
    // fingers on the gun as at rest. The owner, 2026-10-05, of a support hand off its gun ("WOW THE LEFT SUPPORT HAND ON
    // THE USSO HAS A GAP"): swept on every gun, PANDA's left palm was 11 mm off its fore-end and two fingers 14 and 18
    // in the low carry, ANAKIN's palm 7 and its index 19, the carry's own left hand a different place from the fitted one
    for (const [label, speed] of [["running", 6.3], ["sprinting", 9.5]] as const) {
      const low = await ev<A | null>(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: ${speed}, stance: "stand", pitch: 0 }); r.figureLabStep(0.9); return window.__figureAudit(0, { pitch: 0 }); })()`);
      check(`the soldier holding ${name}, carried low ${label}: the left palm and its holding fingers on the gun (8 mm at most)`, !!low && on(low, id), JSON.stringify({ palmGap: low?.palmGap, fingerGap: low?.fingerGap, handGap: low?.handGap }));
    }
    // The right index on the trigger, not laid along the frame (the owner, 2026-09-30: the gun fires on a click, and a
    // straight finger read as not firing): aimed in, the tip of its last joint on the trigger's face, 4 mm at most
    const trig = await ev<number | null>(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0, ads: 1 }); r.figureLabStep(0.9); return window.__triggerGap(0); })()`);
    // (at the crease of its last joint, through the guard, not only its tip: the owner, 2026-09-30, "more through the hold")
    check(`the soldier holding ${name}: the right index finger on the trigger at its last joint's crease, aimed in`, trig !== null && trig <= 4, `${trig} mm from its face`);
    // the fingers drawn at soldierhold.json fingerSize (the owner: "cut down by like 50%"), every one of both hands
    const sizes = await ev<number[]>(page, `(() => { const f = window.__range.labFigures()[0].figure; return ["index", "middle", "ring", "pinky", "thumb"].flatMap((n) => ["l", "r"].map((s) => Math.round(f.boneAt(n + "_01_" + s).scale.x * 1000) / 1000)); })()`);
    check(`the soldier holding ${name}: every finger drawn at ${soldierHoldCfg.fingerSize} of the model's size`, sizes.every((x) => Math.abs(x - soldierHoldCfg.fingerSize) < 1e-3), sizes.join());
    const glinting = await ev<boolean>(page, `!!window.__range.labFigures()[0].figure.glint`);
    if (glinting) {
      // A magnified scope glints only while the figure looks down it (the owner, 2026-09-30, of BOOG: "the sniper should
      // only have glint when they are ADSing"): aimed in, yes; the aim held through a reload or a swap, or at the hip, no
      const glintIn = async (p: Record<string, unknown>) => ev<boolean | null>(page, `(() => { const r = window.__range; r.figureLabPose(0, ${JSON.stringify({ speed: 0, stance: "stand", pitch: 0, ...p })}); r.figureLabStep(0.6); const g = r.labFigures()[0].figure.glint; return g ? g.visible : null; })()`);
      const glints = { aimed: await glintIn({ ads: 1 }), reloading: await glintIn({ ads: 1, act: "reload" }), swapping: await glintIn({ ads: 1, act: "swap" }), hip: await glintIn({ ads: 0 }), again: await glintIn({ ads: 1 }) };
      await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0 }); r.figureLabStep(2.5); })()`);
      check(`${name}'s scope glints only while the soldier looks down it: aimed in, not through a reload or a swap, not at the hip`, glints.aimed === true && glints.reloading === false && glints.swapping === false && glints.hip === false && glints.again === true, JSON.stringify(glints));
    }
    if (id === "sentinel") {
      // BOOG's left hand on the rail under its fore-end, not the magazine (which ends 20 cm in front of the grip): the
      // owner, 2026-09-30, "the boogs 3rd person still has the hand grabbing the magazine instead of the hand stop/rail"
      const rail = await ev<{ z: number; y: number; slide: number }>(page, `(() => { const f = window.__range.labFigures()[0].figure, g = f.gunObject, h = f.holdPoints(); const at = g.worldToLocal(h.support.clone()); return { z: Math.round(at.z * 1000) / 1000, y: Math.round(at.y * 1000) / 1000, slide: f.supportSlide }; })()`);
      check(`the soldier holding ${name}: the left hand on the rail under the fore-end, 22 cm or more in front of the grip, not on the magazine`, rail.z <= -0.22 && rail.slide < 0.01, JSON.stringify(rail));
    }
    // A melee as the first person's (fparms.json melee; the owner, 2026-09-29: "HOLD THE WEAPON WITH THE RIGHT ARM, SWING
    // AT THEM WITH THE LEFT ARM, LEFT ARM SHOULD GO FROM SUPPORTING THE GUN, BACK A BIT TOWARDS THE PLAYERS CHEST, THEN SWING
    // OUT"): the gun stays where it is in the right hand, the left hand leaves it and punches out, a fist, and comes back
    // onto it in the game's melee time. It was a strike with the gun in both hands, which the first person's no longer is
    const gunZ = `(() => { const r = window.__range, f = r.labFigures()[0], g = f.figure.gunObject; f.group.updateMatrixWorld(true); return { z: f.group.worldToLocal(g.getWorldPosition(new r.THREE.Vector3())).z, shown: g.visible, keys: f.figure.rifleOut?.keys ?? "", curl: Math.round(f.figure.boneAt("middle_02_l").quaternion.angleTo(new r.THREE.Quaternion()) * 57.3), hand: f.group.worldToLocal(f.figure.boneAt("hand_l").getWorldPosition(new r.THREE.Vector3())).toArray() }; })()`;
    type GZ = { z: number; shown: boolean; keys: string; curl: number; hand: number[] };
    const travel = (a: GZ, b: GZ) => Math.round(Math.hypot(a.hand[0] - b.hand[0], a.hand[1] - b.hand[1], a.hand[2] - b.hand[2]) * 1000) / 1000;
    await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0 }); r.figureLabStep(1.2); })()`);
    const rest = await ev<GZ>(page, gunZ);
    // (drawn back between the hand's way off the gun and the punch, and out at the punch's end: fparms.json melee's shares
    // of the game's melee time)
    const PM = (fparmsCfg as unknown as { melee: { on: number[]; punch: number[] } }).melee;
    // (the fist's middle finger, its second joint: what the curl measures; the hold's fingers close a share of the way to it)
    const FIST = (soldierHoldCfg as unknown as { fist: Record<string, number[]> }).fist.middle[1];
    const drawAt = ((PM.on[1] + PM.punch[0]) / 2) * soldierHoldCfg.melee.time;
    const punchAt = PM.punch[1] * soldierHoldCfg.melee.time;
    await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0, act: "melee" }); r.figureLabStep(${drawAt}); })()`);
    const drawn = await ev<GZ>(page, gunZ);
    await ev(page, `window.__range.figureLabStep(${punchAt - drawAt})`);
    const struck = await ev<GZ>(page, gunZ);
    const strike = await ev<A | null>(page, `window.__figureAudit(0, { pitch: 0 })`);
    check(
      `the soldier's ${name} melee: the gun stays in the right hand where it was, and the left hand leaves it, draws back beside the chest and punches 20 cm or more forward from there, a fist`,
      struck.shown && Math.abs(struck.z - rest.z) < 0.03 && (strike?.grip ?? 99) <= BAR.grip && struck.hand[2] > drawn.hand[2] + 0.2 && /l:punch/.test(struck.keys) && struck.curl - rest.curl >= 0.2 * (FIST - rest.curl),
      JSON.stringify({ rest, drawn: drawn.hand, struck, grip: strike?.grip, punch: travel(struck, drawn) })
    );
    await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0 }); r.figureLabStep(0.6); })()`);
    const after2 = await ev<GZ>(page, gunZ);
    const back = await ev<A | null>(page, `window.__figureAudit(0, { pitch: 0 })`);
    check(`the soldier's ${name} melee: and the left hand back on the gun after it`, after2.shown && Math.abs(after2.z - rest.z) < 0.02 && (back?.support ?? 99) <= BAR.support && !/punch/.test(after2.keys), JSON.stringify({ rest, after2, support: back?.support }));
    // a string of three, through each one's whole length: no hand into the gun, the right hand on its grip, the wrists.
    // A hand is held to 8 mm, or to 3 mm past its own depth at rest where a gun's grip has it deeper (CHOOCH's right
    // fingers curled 18 mm into its guard frame on purpose, hidden there): what the check catches is a hand passing
    // through the gun as it moves, not a grip; the grip's own depth is the hold checks' (BAR.handIn)
    const restIn = { l: back?.handIn?.l ?? 0, r: back?.handIn?.r ?? 0 };
    const over = (a: A | null) => Math.max((a?.handIn?.l ?? 0) - Math.max(8, restIn.l + 3), (a?.handIn?.r ?? 0) - Math.max(8, restIn.r + 3));
    // (a right hand closed round a bolt's knob meets the receiver's side, as a gloved fist round a short knob must: BOOG's
    // 23 mm after a shot and 28 at its deepest in the reload, photographed reading right from outside, 2026-10-09; held to
    // 30 so it does not grow, the left hand to its own bar)
    const boltOver = (a: A | null) => Math.max((a?.handIn?.l ?? 0) - Math.max(8, restIn.l + 3), (a?.handIn?.r ?? 0) - 30);
    let swingOver = -99;
    let swingWorst = 0;
    let swingGrip = 0;
    let swingWrist = 0;
    await ev(page, `window.__range.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0, act: "melee" })`);
    for (let i = 0; i < 24; i++) {
      const a = await ev<A | null>(page, `(() => { window.__range.figureLabStep(${soldierHoldCfg.melee.time / 8}); return window.__figureAudit(0, { pitch: 0 }); })()`);
      swingWorst = Math.max(swingWorst, a?.handIn?.l ?? 0, a?.handIn?.r ?? 0);
      swingOver = Math.max(swingOver, over(a));
      swingGrip = Math.max(swingGrip, a?.grip ?? 0);
      swingWrist = Math.max(swingWrist, a?.wristL ?? 0);
    }
    await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0 }); r.figureLabStep(0.5); })()`);
    check(`the soldier's ${name} melee: through three punches in a row no hand goes into the gun (8 mm at most, or 3 past its grip's own), the right stays on its grip and the left wrist bends 60 degrees at most`, swingOver <= 0 && swingGrip <= BAR.grip && swingWrist <= 60, JSON.stringify({ swingWorst, swingGrip, swingWrist: Math.round(swingWrist) }));
    // A grenade thrown: the gun away for the throw, and back only once both hands are on it (shown at once, it came
    // back through both hands, 23 to 28 mm, while they were still on their way)
    await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0, act: "throw" }); r.figureLabStep(0.2); })()`);
    const thrown = await ev<{ z: number; shown: boolean }>(page, gunZ);
    let worst = 0;
    let worstOver = -99;
    let backAt = -1;
    for (let i = 1; i <= 16; i++) {
      await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0, act: ${i <= 5 ? `"throw"` : "null"} }); r.figureLabStep(0.06); })()`);
      const g = await ev<{ z: number; shown: boolean }>(page, gunZ);
      if (!g.shown) continue;
      if (backAt < 0) backAt = 0.2 + i * 0.06;
      const a = await ev<A | null>(page, `window.__figureAudit(0, { pitch: 0 })`);
      worst = Math.max(worst, a?.handIn?.l ?? 0, a?.handIn?.r ?? 0);
      worstOver = Math.max(worstOver, over(a));
    }
    check(`the soldier's ${name} throw: the gun away for it, and back within a second with no hand through it (8 mm at most, or 3 past its grip's own)`, !thrown.shown && backAt > 0 && backAt <= 1 && worstOver <= 0, JSON.stringify({ thrown: thrown.shown, backAt, worst, restIn }));
    await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0 }); r.figureLabStep(1.2); })()`);
    // A bolt gun's bolt after each shot, as the first person's: the bought arms play the pack's fire clip over the
    // rechamber and work its bolt over that clip's rack window (fparms.json packGuns.<gun>.rack, clip "fire"), and the
    // soldier lays its reload's bolt keys over the same window (rifle.ts shotCycleOf). Before, others saw BOOG only kick.
    {
      const rackFire = (fparmsCfg.packGuns as unknown as Record<string, { rack?: { clip: string; window: number[] } }>)[(fparmsCfg.guns as Record<string, string>)[id]]?.rack;
      const boltKeys = (soldierHoldCfg.guns as unknown as Record<string, { reload?: { bolt?: unknown[] } }>)[id]?.reload?.bolt;
      if (rackFire?.clip === "fire" && boltKeys) {
        const rech = (await ev<{ rechamber: number }>(page, `window.__range.weaponTimes("${id}")`)).rechamber;
        const [w0, w1] = rackFire.window;
        await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0 }); r.figureLabStep(1.2); r.labFigures()[0].kick(); })()`);
        let t = 0;
        let worst = -99;
        const keys: string[] = [];
        for (const u of [w0 + 0.1 * (w1 - w0), (w0 + w1) / 2, w0 + 0.9 * (w1 - w0)]) {
          await ev(page, `window.__range.figureLabStep(${u * rech - t})`);
          t = u * rech;
          const a = await ev<A | null>(page, `window.__figureAudit(0, { pitch: 0 })`);
          worst = Math.max(worst, boltOver(a));
          keys.push(await ev<string>(page, `window.__range.labFigures()[0].figure.rifleOut?.keys ?? ""`));
        }
        await ev(page, `window.__range.figureLabStep(${rech - t + 0.4})`);
        const after = await ev<A | null>(page, `window.__figureAudit(0, { pitch: 0 })`);
        const afterKeys = await ev<string>(page, `window.__range.labFigures()[0].figure.rifleOut?.keys ?? ""`);
        check(
          `the soldier's ${name} works its bolt after a shot, as the first person's fire clip does (${w0} to ${w1} of the ${rech} s rechamber): the right hand at the bolt in the middle, round its knob no deeper than 30 mm, the left on its hold, and both back on their holds after`,
          /r:bolt/.test(keys[1]) && worst <= 0 && !afterKeys && within(after, true, id),
          JSON.stringify({ keys, worst, afterKeys, after: after && { grip: after.grip, support: after.support, handIn: after.handIn } }),
        );
        await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0 }); r.figureLabStep(1.2); })()`);
      }
    }
    // The reload, the first person's (the owner, 2026-09-30: "the first and third person final forms agree ... when they
    // reload"): read from the guns agent's fparms.json, as the soldier reads it, so a change there fails here. The
    // magazine slides down and phases out, a new one phases in and seats, all in the gun; nothing is dropped
    // (from empty: the whole timeline, the rack or bolt at its end, over the gun's empty reload time)
    const RT = await ev<{ reload: number; reloadEmpty: number }>(page, `window.__range.weaponTimes("${id}")`);
    const R = RT.reloadEmpty;
    const FR = fparmsCfg.reload;
    const rack = (fparmsCfg.packGuns as Record<string, { rack?: { grab?: { reach: number[]; pull: number[] } } }>)[(fparmsCfg.guns as Record<string, string>)[id]]?.rack;
    type Mag = { y: number; shown: boolean; phase: number; keys: string; drops: number; radial: number; off: number } | null;
    const mag = `(() => { const f = window.__range.labFigures()[0].figure; const m = f.gunObject.getObjectByName("mag"); const drops = window.__range.scene.children.filter((o) => o.name === "mag").length; const S = f.magSweep; if (!m) return null; const T = window.__range.THREE; const mid = new T.Box3(); const v = new T.Vector3(); m.updateMatrixWorld(true); const inv = new T.Matrix4().copy(m.matrixWorld).invert(); m.traverse((o) => { if (o.isMesh) { let on = true; for (let q = o; q && q !== m; q = q.parent) on &&= q.visible; if (on) { const pos = o.geometry.getAttribute("position"); const to = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld); for (let i = 0; i < pos.count; i++) mid.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(to)); } } }); return m ? { y: m.position.y, shown: m.visible, phase: S.phase.value, keys: f.rifleOut?.keys ?? "", drops, radial: S.radial.value, off: Math.round(S.center.value.distanceTo(m.localToWorld(mid.getCenter(new T.Vector3()))) * 1000) } : null; })()`;
    const home = await ev<Mag>(page, mag);
    // (a gun with no magazine, BIGANTLER's pump, has none of the magazine's checks: its shells' are below)
    if (home) {
    await ev(page, `window.__range.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0, act: "reload", reloadEmpty: true })`);
    let at = 0;
    const to = async (u: number): Promise<Mag> => {
      await ev(page, `window.__range.figureLabStep(${Math.max(0, u - at) * R})`);
      at = u;
      return ev<Mag>(page, mag);
    };
    const pointing = await to((FR.phaseOut[0] + FR.phaseOut[1]) / 2);
    const gone = await to(FR.phaseOut[1] + 0.02);
    const coming = await to((FR.phaseIn[0] + FR.phaseIn[1]) / 2);
    const seated = await to(FR.seat + 0.02);
    const workAt = rack?.grab ? FR.rack[0] + ((rack.grab.pull[0] + rack.grab.pull[1]) / 2) * (FR.rack[1] - FR.rack[0]) : FR.rack[0] + 0.5 * (FR.rack[1] - FR.rack[0]);
    const bolted = !rack?.grab && !!(soldierHoldCfg.guns as Record<string, { reload?: { bolt?: unknown } }>)[id]?.reload?.bolt;
    // (a bolt worked by the right hand: how deep a hand goes in the gun at each of its keys, up to the middle of the rack;
    // its keys' hands had gone 20 mm and more into BOOG's receiver, unmeasured, the check reading only which key it was at)
    const boltX = bolted ? ((soldierHoldCfg.guns as unknown as Record<string, { reload: { bolt: Array<[number, string]> } }>)[id].reload.bolt.filter(([, k]) => k !== "grip").map(([x]) => x)) : [];
    let boltDeep = -99;
    for (const x of boltX.filter((v) => FR.rack[0] + v * (FR.rack[1] - FR.rack[0]) < workAt)) {
      await to(FR.rack[0] + x * (FR.rack[1] - FR.rack[0]));
      boltDeep = Math.max(boltDeep, boltOver(await ev<A | null>(page, `window.__figureAudit(0, { pitch: 0 })`)));
    }
    const working = await to(workAt);
    if (bolted) boltDeep = Math.max(boltDeep, boltOver(await ev<A | null>(page, `window.__figureAudit(0, { pitch: 0 })`)));
    const slid = (m: Mag) => (home && m ? home.y - m.y : 0);
    check(`the soldier's ${name} reload is the first person's: the left hand points at the magazine as it slides down and phases out`, !!pointing && pointing.shown && pointing.phase > 0 && pointing.phase < 1 && slid(pointing) > 0 && /l:point/.test(pointing.keys), JSON.stringify({ pointing, slid: slid(pointing) }));
    check(`the soldier's ${name} reload: by the end of the first person's phase out (${FR.phaseOut[1]}) the old magazine is gone, ${FR.slide} m down`, !!gone && !gone.shown && gone.phase === 0 && Math.abs(slid(gone) - FR.slide) < 0.005, JSON.stringify({ gone, slid: slid(gone) }));
    // (the new one comes in `slideIn` of the way out, and up as it phases in, the one curve: 0 is seated, built from the
    // well down; 1 when not given)
    const SI = (FR as { slideIn?: number }).slideIn ?? 1;
    check(`the soldier's ${name} reload: a new one phases in (${SI} of the way out) and comes up`, !!coming && coming.shown && coming.phase > 0.2 && coming.phase < 0.8 && Math.abs(slid(coming) - FR.slide * SI * (1 - coming.phase)) < 0.002, JSON.stringify({ coming, slid: slid(coming) }));
    check(`the soldier's ${name} reload: seated by the first person's seat (${FR.seat}), home and whole`, !!seated && !!home && seated.shown && seated.phase === 1 && Math.abs(slid(seated)) < 1e-3, JSON.stringify({ seated, slid: slid(seated) }));
    check(
      `the soldier's ${name} reload: then the hands work the gun as the first person's do (${rack?.grab ? "the left racks the charging handle" : bolted ? "the right works the bolt" : "nothing yet: the first person has no rack for it, so the magazine alone"})`,
      !!working && (rack?.grab ? /l:handle/.test(working.keys) : bolted ? /r:bolt/.test(working.keys) : !/l:handle|r:bolt/.test(working.keys)),
      working?.keys ?? "none"
    );
    if (bolted) check(`the soldier's ${name} reload: working the bolt, the right hand round its knob no deeper than 30 mm and the left on its hold`, boltDeep <= 0, `${boltDeep} mm over`);
    // round its own middle where the first person's is (fparms.json reload.magPhase; the owner, 2026-10-01: "make the
    // magazine phase in from the middle out and then we take the mag out it should be from the outside in")
    const radialMag = (FR as { magPhase?: string }).magPhase === "radial";
    check(
      `the soldier's ${name} reload: the magazine phases ${radialMag ? "round its own middle, out from its edges in and in from its middle out" : "along its length"}, as the first person's`,
      [pointing, coming].every((m) => !!m && m.radial === (radialMag ? 1 : 0) && (!radialMag || m.off <= 5)),
      JSON.stringify({ radialMag, pointing: pointing && { radial: pointing.radial, off: pointing.off }, coming: coming && { radial: coming.radial, off: coming.off } })
    );
    check(`the soldier's ${name} reload: no magazine is ever dropped, and no hand goes to a pouch`, [pointing, gone, coming, seated, working].every((m) => !!m && m.drops === 0 && !/pouch/.test(m.keys)), JSON.stringify([pointing, gone, coming, seated, working].map((m) => m && { drops: m.drops, keys: m.keys })));
    await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0 }); r.figureLabStep(2.5); })()`);
    // A tactical reload (a round still chambered: the owner, 2026-09-30, "a reload differentiator for empty mag vs still
    // 1 in the chamber"): over the gun's tactical time. Where the first person has its own (fparms.json reload.tactical),
    // it is the empty one's beats in seconds, ending before the rack, and no rack or bolt ever; until then, the whole
    // timeline over the tactical time, as the first person plays it
    {
      const tac = (FR as { tactical?: { rack: boolean; back: number[] } }).tactical;
      const own = !!tac && !tac.rack;
      await ev(page, `window.__range.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0, act: "reload" })`);
      const seen: string[] = [];
      let mags: Mag[] = [];
      for (let k = 1; k <= 12; k++) {
        await ev(page, `window.__range.figureLabStep(${RT.reload / 12})`);
        const m = await ev<Mag>(page, mag);
        mags.push(m);
        seen.push(m?.keys ?? "");
      }
      const racked = seen.some((k) => /l:handle|r:bolt/.test(k));
      await ev(page, `window.__range.figureLabStep(0.1)`);
      const done = await ev<Mag>(page, mag);
      mags = [...mags, done];
      check(
        `the soldier's ${name} tactical reload: over the gun's tactical time (${RT.reload} s, against ${RT.reloadEmpty} from empty)${own ? ", the magazine out and in with no rack or bolt" : " (the first person has no tactical timeline of its own yet: the whole one)"}, done by its end`,
        !!done && done.shown && done.phase === 1 && !done.keys && (own ? !racked : true) && mags.some((m) => !!m && m.phase < 1),
        JSON.stringify({ own, racked, keys: seen, done })
      );
      await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0 }); r.figureLabStep(2.5); })()`);
    }
    // At the charging handle the left hand has fingers of its own (soldierhold.json reload.keys.handle.fingers): with the
    // hold's, laid along the fore-end, its index and middle fingers stood 25 mm off the gun while the palm racked it
    if (rack?.grab) {
      const plan = await ev<{ left: [number, string][] }>(page, `window.__range.rifleReloadPlan("${id}", false)`);
      const i = plan.left.findIndex(([, k]) => k === "handle");
      const uKey = i < 0 ? -1 : plan.left[i + 1]?.[1] === "handle" ? (plan.left[i][0] + plan.left[i + 1][0]) / 2 : plan.left[i][0];
      await ev(page, `window.__range.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0, act: "reload", reloadEmpty: true })`);
      await ev(page, `window.__range.figureLabStep(${Math.max(0, uKey) * R})`);
      const a = await ev<A | null>(page, `window.__figureAudit(0, { pitch: 0 })`);
      const gaps = ["thumb", "index", "middle", "ring", "pinky"].map((f) => a?.fingerGap?.[`${f}_l`] ?? 99);
      check(`the soldier's ${name} reload: at the charging handle the left hand's own fingers lie on the gun, each within 6 mm`, uKey > 0 && gaps.every((g) => g <= 6), JSON.stringify({ uKey, gaps }));
      await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0 }); r.figureLabStep(2.5); })()`);
    }
    } else if ((fparmsCfg.packGuns as Record<string, { reload?: { style?: string } }>)[(fparmsCfg.guns as Record<string, string>)[id]]?.reload?.style === "shells") {
      // BIGANTLER's reload, a shell at a time, as the first person's (fparms.json packGuns.<gun>.reload, which the soldier
      // reads: rifle.ts feedAt): the left hand off the pump, each shell held at its pinch and pushed up through the gate as
      // it swings open, back on the pump, and from empty the pump worked; one with a shell chambered ends on the pump. And
      // after a shot the left hand rides the pump (soldierhold.json pump.ride, measured off the first person's)
      const SR = (fparmsCfg.packGuns as unknown as Record<string, { reload: { count: number; feed: number[]; back: number[]; pump: number[] } }>)[(fparmsCfg.guns as Record<string, string>)[id]].reload;
      type Fed = { keys: string; pinch: number | null; gate: number; handIn: number; wrist: number; seated: number; pump: number; palm: number };
      const fed = `(() => { const r = window.__range, T = r.THREE; const f = r.labFigures()[0]; const fg = f.figure; const g = fg.gunObject; const W = (o) => o.getWorldPosition(new T.Vector3());
        const pinch = W(f.group.getObjectByName("index_03_l")).add(W(f.group.getObjectByName("thumb_03_l"))).multiplyScalar(0.5);
        const shell = g.getObjectByName("Bullet")?.parent; const gate = g.getObjectByName("Cover")?.parent; const home = fg.reloadParts?.shells?.roundHome;
        const o = fg.rifleOut || {}; const a = window.__figureAudit(0, { pitch: 0 });
        return { keys: o.keys || "", pinch: shell && shell.userData.inHand ? pinch.distanceTo(W(shell)) * 100 : null, gate: gate ? Math.abs(gate.rotation.x) : -1, handIn: a?.handIn?.l ?? 99, wrist: a?.wristL ?? 99,
          seated: shell && home ? shell.position.distanceTo(home) * 100 : 99, pump: (o.pump ?? 0) * 100, palm: a?.palmGap?.l ?? 99 }; })()`;
      await ev(page, `window.__range.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0, act: "reload", reloadEmpty: true })`);
      let at = 0;
      const to = async (u: number): Promise<Fed> => {
        await ev(page, `window.__range.figureLabStep(${Math.max(0, u - at) * R})`);
        at = u;
        return ev<Fed>(page, fed);
      };
      // (24 moments over the feed: a shell's gate is open a third of its share)
      const feed = { pinch: 0, held: 0, gates: [] as number[], deep: 0, wrist: 0 };
      let slot = 0;
      let gateMax = 0;
      for (let i = 0; i < 24; i++) {
        const u = SR.feed[0] + ((SR.feed[1] - SR.feed[0]) * (i + 0.5)) / 24;
        const x = await to(u);
        const k = Math.min(SR.count - 1, Math.floor(((u - SR.feed[0]) / (SR.feed[1] - SR.feed[0])) * SR.count));
        if (k !== slot) {
          feed.gates.push(gateMax);
          gateMax = 0;
          slot = k;
        }
        gateMax = Math.max(gateMax, x.gate);
        if (x.pinch !== null) {
          feed.held++;
          feed.pinch = Math.max(feed.pinch, x.pinch);
        }
        feed.deep = Math.max(feed.deep, x.handIn);
        feed.wrist = Math.max(feed.wrist, x.wrist);
      }
      feed.gates.push(gateMax);
      const home = await to((SR.back[0] + SR.back[1]) / 2);
      check(
        `the soldier's ${name} reload is the first person's, a shell at a time: each of ${SR.count} held at the left hand's pinch (within 1.5 cm), the gate swung open as it goes in (30 degrees and more), the last one home, no hand in the gun (8 mm), the left wrist 60 degrees or less`,
        feed.held >= 6 && feed.pinch <= 1.5 && feed.gates.length === SR.count && feed.gates.every((a) => a > 0.52) && home.seated < 0.2 && feed.deep <= 8 && feed.wrist <= 60,
        JSON.stringify({ ...feed, pinch: +feed.pinch.toFixed(2), gates: feed.gates.map((a) => Math.round((a * 180) / Math.PI)), seated: +home.seated.toFixed(2) }),
      );
      // (the stroke over the pump's window, as the first person's clip runs it: back early, home by its middle)
      let pumped = await to(SR.pump[0] + 0.05 * (SR.pump[1] - SR.pump[0]));
      for (let k = 2; k <= 10; k++) {
        const x = await to(SR.pump[0] + (k / 20) * (SR.pump[1] - SR.pump[0]));
        if (x.pump > pumped.pump) pumped = x;
      }
      await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0 }); r.figureLabStep(1.2); })()`);
      // (with a shell chambered: the empty one's beats in seconds, ending on the pump, no pump worked)
      await ev(page, `window.__range.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0, act: "reload" })`);
      let tacPump = 0;
      for (let k = 1; k <= 12; k++) {
        await ev(page, `window.__range.figureLabStep(${RT.reload / 12})`);
        tacPump = Math.max(tacPump, Math.abs((await ev<Fed>(page, fed)).pump));
      }
      check(
        `the soldier's ${name} reload from empty ends with the pump, back 3 cm and more with the left hand on it (8 mm); one with a shell chambered does not pump`,
        pumped.pump > 3 && pumped.palm <= 8 && pumped.handIn <= 8 && tacPump < 0.1,
        JSON.stringify({ pump: +pumped.pump.toFixed(1), palm: pumped.palm, handIn: pumped.handIn, keys: pumped.keys, tactical: +tacPump.toFixed(2) }),
      );
      // after a shot (the figure's kick, as a remote shot gives it): the pump and the left hand back together
      await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0 }); r.figureLabStep(1.2); r.labFigures()[0].kick(); })()`);
      let ride = { pump: 0, palm: 99, handIn: 99 };
      for (let k = 0; k < 8; k++) {
        await ev(page, `window.__range.figureLabStep(0.05)`);
        const x = await ev<Fed>(page, fed);
        if (x.pump > ride.pump) ride = { pump: x.pump, palm: x.palm, handIn: x.handIn };
      }
      check(`the soldier's ${name}: after a shot the left hand rides the pump back 3 cm and more, on it (8 mm), no hand in the gun (8 mm)`, ride.pump > 3 && ride.palm <= 8 && ride.handIn <= 8, JSON.stringify({ ...ride, pump: +ride.pump.toFixed(1) }));
      await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0 }); r.figureLabStep(1.2); })()`);
    } else {
      await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0, act: "reload", reloadEmpty: true }); r.figureLabStep(${R}); r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0 }); r.figureLabStep(1.2); })()`);
    }
    const after = await ev<A | null>(page, `window.__figureAudit(0, { pitch: 0 })`);
    check(`the soldier's ${name} reload: after it, the hands are back on the gun`, within(after, true, id), JSON.stringify(after));
  }
  // A swap as the first person's (gunfeel.json guns.<id>.swap; the owner, 2026-09-30, "no resetting states, jumping UI or
  // bugging in any frame"): the USSO phases out over its holster, BOOG in over its draw from when it comes, the model
  // changing between, the magazine with the gun. The new gun appeared whole in the hands at the swap's middle
  const SWAPPED = FITTED.filter((g) => !!(gunfeelCfg.guns as Record<string, { swap?: unknown }>)[g]?.swap);
  for (const [k, SB] of SWAPPED.entries()) {
    if (SWAPPED.length < 2) break;
    // (from the one before it, the last into the first)
    const SA = SWAPPED[(k + SWAPPED.length - 1) % SWAPPED.length];
    type Ph = { gun: number; mag: number; id: string; shown: boolean; lowered: number; keys: string; radial: number | null };
    const ph = `(() => { const f = window.__range.labFigures()[0].figure; return { gun: f.gunSweep.phase.value, mag: f.magSweep.phase.value, id: f.gunId, shown: !!f.gunObject?.visible, lowered: f.lowered, keys: f.rifleOut?.keys ?? "", radial: f.gunSweep.radial ? f.gunSweep.radial.value : null }; })()`;
    const SWC = gunfeelCfg.guns as unknown as Record<string, { swap: { out: number[]; in: number[] } }>;
    const H = (await ev<{ holster: number }>(page, `window.__range.weaponTimes("${SA}")`)).holster;
    const D = (await ev<{ deploy: number }>(page, `window.__range.weaponTimes("${SB}")`)).deploy;
    await ev(page, `(() => { const r = window.__range; r.figureLabManual(false); r.figureLab([{ speed: 0, stance: "stand", pitch: 0, weapon: "${SA}", look: "S0000010" }], 2.6, 30); r.figureLabManual(true); r.figureLabStep(1); r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0, act: "swap", weapon: "${SA}" }); })()`);
    const held = await ev<Ph>(page, ph);
    // (the first person's shares are of the whole swap, its first half the holster: half a share is a share of it)
    const outMid = (SWC[SA].swap.out[0] + SWC[SA].swap.out[1]) * H;
    await ev(page, `window.__range.figureLabStep(${outMid})`);
    const going = await ev<Ph>(page, ph);
    await ev(page, `window.__range.figureLabStep(${H - outMid})`);
    const gone = await ev<Ph>(page, ph);
    await ev(page, `window.__range.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0, act: "swap", weapon: "${SB}" })`);
    const arrived = await ev<Ph>(page, ph);
    const inMid = (SWC[SB].swap.in[0] + SWC[SB].swap.in[1] - 1) * D;
    await ev(page, `window.__range.figureLabStep(${inMid})`);
    const coming = await ev<Ph>(page, ph);
    await ev(page, `window.__range.figureLabStep(${D - inMid})`);
    const whole = await ev<Ph>(page, ph);
    await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0, weapon: "${SB}" }); r.figureLabStep(0.5); })()`);
    const after = await ev<Ph>(page, ph);
    const mid = (x: Ph) => x.gun > 0.15 && x.gun < 0.85 && Math.abs(x.mag - x.gun) < 1e-6;
    check(
      `the soldier's swap is the first person's: the ${nameOf(SA)} phases out over its holster, the magazine with it, the ${nameOf(SB)} phases in over its draw from nothing, whole by its end`,
      held.gun === 1 && mid(going) && going.id === SA && gone.gun < 0.01 && arrived.id === SB && arrived.gun === 0 && mid(coming) && coming.id === SB && whole.gun === 1 && after.gun === 1 && after.mag === 1 && [held, going, gone, arrived, coming, whole].every((x) => x.shown),
      JSON.stringify({ held, going, gone, arrived, coming, whole, after })
    );
    // and held as the first person's is: in place when its style is the cup (fparms.json swap.style; the owner, 2026-09-30,
    // "keep the hands where they are while the weapon phases ... like the streetfighter haduken"), the gun up, both hands
    // off it and cupped round it, the phase out from its edges where the sweep has one; else lowered across the body
    const cupOn = (fparmsCfg as { swap?: { style?: string } }).swap?.style === "cup";
    check(
      cupOn ? `the soldier's swap is in place, as the first person's cup: the gun stays up, both hands cupped round it through the swap's middle, back on the ${nameOf(SB)}'s holds after` : "the soldier's swap lowers the gun across the body, as the first person's swap (not the cup) does",
      cupOn ? [going, gone, arrived, coming].every((x) => x.lowered < 0.05 && (x.radial === null || x.radial === 1)) && [gone, arrived].every((x) => /l:cup/.test(x.keys) && /r:cup/.test(x.keys)) && !/cup/.test(after.keys) : gone.lowered > 0.5,
      JSON.stringify({ cupOn, going, gone, arrived, coming, after })
    );
  }
  // A double jump: the knees come up and go back down, the body upright (the owner, 2026-09-30, of the flip it first was:
  // "just have the legs raise a bit at the same time as the double jump"). One seen for the first time with a count
  // already made does not lift for them.
  const kneeOf = `(() => { const r = window.__range, T = r.THREE, f = r.labFigures()[0].figure; const k = f.boneAt("calf_l").getWorldPosition(new T.Vector3()); const pv = f.boneAt("pelvis").getWorldPosition(new T.Vector3()); return { knee: Math.round((k.y - pv.y) * 1000), turn: Math.round((f.root.rotation.x * 180) / Math.PI) }; })()`;
  await ev(page, `(() => { const r = window.__range; r.figureLabManual(false); r.figureLab([{ speed: 0, stance: "air", pitch: 0, weapon: "r97", look: "S0000010", airJumps: 5 }], 2.6, 30); r.figureLabManual(true); r.figureLabStep(0.25); })()`);
  const firstSeen = await ev<{ knee: number; turn: number }>(page, kneeOf);
  await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "air", pitch: 0, airJumps: 6 }); r.figureLabStep(${figureCfg.doubleJump.time / 2}); })()`);
  const lifted = await ev<{ knee: number; turn: number }>(page, kneeOf);
  await ev(page, `window.__range.figureLabStep(${figureCfg.doubleJump.time / 2 + 0.05})`);
  const after = await ev<{ knee: number; turn: number }>(page, kneeOf);
  check(
    "a double jump: the knees come up (6 cm or more nearer the hips) and go back down, the body upright throughout; none for a count it was first seen with",
    lifted.knee - firstSeen.knee >= 60 && Math.abs(after.knee - firstSeen.knee) <= 20 && firstSeen.turn === 0 && lifted.turn === 0 && after.turn === 0,
    JSON.stringify({ firstSeen, lifted, after })
  );
  // Standing still, flat on its feet (figure.json flatFeet; the owner asked it fixed when the card showed it on its heels,
  // toes 16 degrees up): each foot's toe no higher than its bind pose has it, and the boots' lowest skin on the floor
  const feet = await ev<{ toes: number[]; soles: number[] }>(
    page,
    `(() => {
      const r = window.__range, T = r.THREE;
      r.figureLabManual(false); r.figureLab([{ speed: 0, stance: "stand", pitch: 0, weapon: "r97", look: "S0000010" }], 2.6, 30); r.figureLabManual(true); r.figureLabStep(1.5);
      const f = r.labFigures()[0];
      f.group.updateMatrixWorld(true);
      let mesh = null; f.group.traverse((o) => { if (!mesh && o.isSkinnedMesh && o.skeleton.bones.some((x) => x.name === "foot_l")) mesh = o; });
      const sk = mesh.skeleton, bi = (n) => sk.bones.findIndex((x) => x.name === n);
      const bindAt = (i) => new T.Vector3().setFromMatrixPosition(sk.boneInverses[i].clone().invert());
      const up = bindAt(bi("Head")).sub(bindAt(bi("foot_l")).add(bindAt(bi("foot_r"))).multiplyScalar(0.5)).normalize();
      const toes = ["l", "r"].map((s) => {
        const rest = Math.asin(bindAt(bi("ball_" + s)).sub(bindAt(bi("foot_" + s))).normalize().dot(up));
        const d = sk.bones[bi("ball_" + s)].getWorldPosition(new T.Vector3()).sub(sk.bones[bi("foot_" + s)].getWorldPosition(new T.Vector3())).normalize();
        return Math.round((Math.asin(d.y) - rest) * 573) / 10;
      });
      const soles = { l: 9, r: 9 };
      const v = new T.Vector3();
      f.group.traverse((o) => {
        if (!o.isSkinnedMesh || !o.visible) return;
        const pos = o.geometry.getAttribute("position"), sw = o.geometry.getAttribute("skinWeight"), si = o.geometry.getAttribute("skinIndex");
        for (let i = 0; i < pos.count; i++) {
          let best = 0, bone = -1;
          for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > best) { best = sw.getComponent(i, k); bone = si.getComponent(i, k); }
          const m = /^(foot|ball)_([lr])$/.exec(o.skeleton.bones[bone]?.name ?? "");
          if (!m) continue;
          o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld);
          soles[m[2]] = Math.min(soles[m[2]], v.y - f.group.position.y);
        }
      });
      return { toes, soles: [soles.l, soles.r].map((x) => Math.round(x * 1000)) };
    })()`,
  );
  // An overheated gun venting (act 20; the owner, 2026-10-01: other players see CHOOCH's overheat): the gun tipped up
  // in its vent carry (soldierhold.json vent), the hands on it, and back to its hold after. On the first person's beats
  // (fparms.json packGuns.<gun>.vent, shares of the lockout): on its way back by `out`'s middle, and back at its hold by
  // the lockout's end, as the first person's is, whether or not the figure has been told the vent is over
  if (FITTED.includes("lstar")) {
    const L = (await ev<{ lockout: number | null }>(page, `window.__range.weaponTimes("lstar")`)).lockout ?? 1;
    const VO = (fparmsCfg.packGuns as unknown as Record<string, { vent?: { in: number[]; out: number[] } }>)[(fparmsCfg.guns as Record<string, string>).lstar]?.vent;
    const outMid = VO ? (VO.out[0] + VO.out[1]) / 2 : 0.875;
    const vented = await ev<{ rest: number; vent: number; leaving: number; done: number; back: number; a: A | null }>(
      page,
      `(() => {
        const r = window.__range, T = r.THREE;
        r.figureLabManual(false); r.figureLab([{ speed: 0, stance: "stand", pitch: 0, weapon: "lstar", look: "S0000010" }], 2.6, 30); r.figureLabManual(true); r.figureLabStep(1.2);
        const f = r.labFigures()[0];
        const pitch = () => { const d = new T.Vector3(0, 0, -1).applyQuaternion(f.figure.gunObject.getWorldQuaternion(new T.Quaternion())); return Math.round((Math.asin(d.y) * 1800) / Math.PI) / 10; };
        const rest = pitch();
        r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0, act: "vent" }); r.figureLabStep(${0.5 * L});
        const vent = pitch(); const a = window.__figureAudit(0, { pitch: 0 });
        r.figureLabStep(${(outMid - 0.5) * L}); const leaving = pitch();
        r.figureLabStep(${(1.05 - outMid) * L}); const done = pitch();
        r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0 }); r.figureLabStep(1.2);
        return { rest, vent, leaving, done, back: pitch(), a };
      })()`,
    );
    check(
      "the soldier's CHOOCH vents as others see it: the gun tipped up 10 degrees or more off its hold, the hands on it, and back after",
      vented.vent - vented.rest >= 10 && Math.abs(vented.back - vented.rest) <= 2 && (vented.a?.support ?? 99) <= BAR.support && Math.max(vented.a?.handIn?.l ?? 99, vented.a?.handIn?.r ?? 99) <= BAR.handIn,
      JSON.stringify({ rest: vented.rest, vent: vented.vent, back: vented.back, support: vented.a?.support, handIn: vented.a?.handIn })
    );
    check(
      `the soldier's CHOOCH vents on the first person's beats: on its way back by the middle of its \`out\` (${outMid.toFixed(3)} of the ${L} s lockout) and at its hold by the lockout's end`,
      !!VO && vented.leaving - vented.rest > 1 && vented.leaving < vented.vent - 1 && Math.abs(vented.done - vented.rest) <= 2,
      JSON.stringify({ rest: vented.rest, vent: vented.vent, leaving: vented.leaving, done: vented.done, lockout: L, out: VO?.out })
    );
  }
  // The head shot from behind (the owner, 2026-10-04: with BOOG he could not headshot a soldier from behind, its head
  // "all tucked down, like chin is to the player's chest"): from 30 m behind at a standing eye, every point of the drawn
  // head the shooter can see is aimed at and the hit volumes asked what it hits, as the game's hitscan does. The head
  // held up to the look (figure.json headUp): before it, 3 to 7 in 100 were headshots crouched and aimed or sprinting,
  // the neck's and the torso's volumes taking the rest, and the face was tipped 40 degrees and more down. The chest held
  // more upright too (figure.json chestUp, the owner's choice): it leaned 33 to 40 there, the armour hiding the head
  {
    const backPoses: Array<[string, Record<string, unknown>]> = [
      ["standing", { speed: 0, stance: "stand", pitch: 0 }],
      ["aimed", { speed: 0, stance: "stand", pitch: 0, ads: 1 }],
      ["crouched and aimed", { speed: 0, stance: "crouch", pitch: 0, ads: 1 }],
      ["sprinting", { speed: 9.5, stance: "stand", pitch: 0 }],
    ];
    const back: Record<string, { seen: number; head: number; face: number; chest: number }> = {};
    for (const [label, pose] of backPoses)
      back[label] = await ev<{ seen: number; head: number; face: number; chest: number }>(
        page,
        `(() => {
          const r = window.__range, T = r.THREE;
          r.player.teleport(0, 0, 0, 0, 0);
          r.figureLabManual(false); r.figureLab([{ ...${JSON.stringify(pose)}, weapon: "sentinel", look: "S0000010" }], 6, 180); r.figureLabManual(true); r.figureLabStep(1.2);
          const f = r.labFigures()[0], mq = f.mq; f.group.updateMatrixWorld(true);
          const fwd = new T.Vector3(0, 0, 1).applyQuaternion(f.group.getWorldQuaternion(new T.Quaternion())).setY(0).normalize();
          const S = f.group.position.clone().addScaledVector(fwd, -30).add(new T.Vector3(0, 1.6, 0));
          const skins = []; mq.root.traverse((o) => { if (o.isSkinnedMesh && o.visible) skins.push(o); });
          const ray = new T.Raycaster(); ray.far = 60;
          const v = new T.Vector3(), nrm = new T.Vector3();
          let seen = 0, head = 0;
          for (const o of skins) {
            const h = o.skeleton.bones.findIndex((x) => x.name === "Head"); if (h < 0) continue;
            const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight, nm = o.geometry.attributes.normal;
            for (let i = 0; i < o.geometry.attributes.position.count; i += 3) {
              let w = 0; for (let c = 0; c < 4; c++) if (si.getComponent(i, c) === h) w += sw.getComponent(i, c);
              if (w < 0.5) continue;
              o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld);
              nrm.fromBufferAttribute(nm, i).transformDirection(o.skeleton.bones[h].matrixWorld);
              if (nrm.dot(S.clone().sub(v).normalize()) < 0.2) continue;
              ray.set(S, v.clone().sub(S).normalize());
              const drawn = ray.intersectObjects(skins, false)[0];
              if (drawn && drawn.distance < S.distanceTo(v) - 0.015) continue;
              seen++;
              const hit = ray.intersectObjects(f.hitMeshes, false)[0];
              if (hit && hit.object.userData.zone === "head") head++;
            }
          }
          // the face's pitch: the bind pose's forward, carried by the Head bone (mannequin.ts holdHeadUp measures it so)
          const face = mq.faceLocal ? mq.faceLocal.clone().transformDirection(mq.boneAt("Head").matrixWorld).applyQuaternion(f.group.getWorldQuaternion(new T.Quaternion()).invert()) : new T.Vector3(0, -1, 0);
          // the upper chest's lean, spine_03 to the neck, forward of upright (figure.json chestUp)
          const toFig = f.group.getWorldQuaternion(new T.Quaternion()).invert();
          const line = mq.boneAt("neck_01").getWorldPosition(new T.Vector3()).sub(mq.boneAt("spine_03").getWorldPosition(new T.Vector3())).applyQuaternion(toFig);
          return { seen, head: Math.round((head / Math.max(1, seen)) * 100), face: Math.round(Math.asin(Math.max(-1, Math.min(1, face.y))) * 573) / 10, chest: Math.round(Math.atan2(line.z, line.y) * 573) / 10 };
        })()`,
      );
    check(
      "a soldier seen from behind (BOOG, 30 m): standing, aimed, crouched and aimed or sprinting, 70 in 100 or more of the shots at the head it shows are headshots, its face within 20 degrees of level and its upper chest leaning 22 or less",
      Object.values(back).every((x) => x.seen >= 15 && x.head >= 70 && Math.abs(x.face) <= 20 && x.chest <= 22),
      JSON.stringify(back)
    );
  }
  // A far soldier's eyes are not drawn (lod.json figures.eyes; a draw call a figure) and never cast a shadow: shown near,
  // hidden moved past the distance, shown again brought back
  const eyesLod = await ev<{ n: number; near: boolean[][]; far: boolean[][]; back: boolean[][] }>(
    page,
    `(() => {
      const r = window.__range, T = r.THREE;
      r.figureLabManual(false); r.figureLab([{ speed: 0, stance: "stand", pitch: 0, weapon: "r97", look: "S0000010" }], 2.6, 0); r.figureLabManual(true); r.figureLabStep(0.5);
      const f = r.labFigures()[0], mq = f.figure;
      const eyes = () => mq.eyes.map((m) => [m.visible, m.castShadow]);
      const near = eyes();
      const home = f.group.position.clone();
      const dir = r.camera.getWorldDirection(new T.Vector3()).setY(0).normalize();
      f.group.position.copy(r.camera.getWorldPosition(new T.Vector3()).setY(home.y).addScaledVector(dir, ${lodCfg.figures.eyes + 20}));
      r.figureLabStep(0.2); const far = eyes();
      f.group.position.copy(home); r.figureLabStep(0.2); const back = eyes();
      return { n: mq.eyes.length, near, far, back };
    })()`,
  );
  check(
    `a far soldier's eyes are not drawn (past ${lodCfg.figures.eyes} m) and never cast a shadow: shown near, hidden far, shown again`,
    eyesLod.n > 0 && eyesLod.near.every(([v, sh]) => v && !sh) && eyesLod.far.every(([v, sh]) => !v && !sh) && eyesLod.back.every(([v]) => v),
    JSON.stringify(eyesLod)
  );
  check(
    "the soldier standing still is flat on its feet: each toe no higher than its bind pose has it (2 degrees), the soles on the floor (10 mm)",
    feet.toes.every((t) => t <= 2) && feet.soles.every((s) => Math.abs(s) <= 10),
    JSON.stringify(feet)
  );
  await ev(page, "window.__range.figureLabManual(false)");
  await page.close();
  // the Loadouts tab's soldier holding the USSO: the same hold, its palms on their holds (on a page that draws: the
  // preview is built and posed by the drawing, which ?norender has none of)
  // (the first visit's welcome screen covers the menu, and a panel under it is never drawn)
  const lp = await open(browser, "?game=speedkills", BASE, `localStorage.setItem("range.welcomed", "1")`);
  // (the tab shows its soldier only on a window wide enough for it: at the suite's 800 it is laid out of sight)
  await lp.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
  await lp.waitForFunction("window.__range.loaded() && window.__range.soldierReady()", { polling: 250, timeout: 90000 }).catch(() => undefined);
  await lp.waitForFunction("window.__range.paidGuns().ready", { polling: 250, timeout: 60000 }).catch(() => undefined);
  // Each gun: both palms on their holds, the gun held as the soldier stands with it (not aimed in, head down on the
  // stock), and the whole gun inside the panel at every turn (BOOG, held side on, ran out of it)
  await ev(lp, `(() => { const r = window.__range; r.loadouts.copyTo({ kind: "default", index: 0 }, 0); document.getElementById("overlay").classList.remove("hidden"); document.querySelector('[data-tab="loadouts"]').click(); })()`);
  // (the roster's guns: one fitted ahead of its roster change, STRYDER's pistol, has no Loadouts card yet)
  for (const id of FITTED.filter((g) => ROSTER.includes(g))) {
    const name = nameOf(id);
    await ev(lp, `window.__range.loadouts.edit(0, { slot1: "${id}" })`);
    const shown = await lp.waitForFunction(`(window.__range.previewState().key || "").includes("|${id}|")`, { polling: 100, timeout: 15000 }).then(() => true, () => false);
    await sleep(1500);
    const lo = await ev<{ grip: number; support: number; aimed: boolean } | null>(lp, `(() => { const f = window.__range.previewFigure()?.figure; const h = f && f.holdPoints(); if (!h) return null; const T = window.__range.THREE; const palm = (s) => f.boneAt("hand_" + s).getWorldPosition(new T.Vector3()).lerp(f.boneAt("middle_01_" + s).getWorldPosition(new T.Vector3()), 0.5); return { grip: palm("r").distanceTo(h.grip) * 100, support: palm("l").distanceTo(h.support) * 100, aimed: (window.__range.previewFigure().pose?.ads ?? 0) > 0 }; })()`);
    check(`the Loadouts tab's soldier holds the ${name}: both palms on their holds, at rest and not aimed in`, shown && !!lo && lo.grip <= BAR.grip && lo.support <= BAR.support && !lo.aimed, JSON.stringify(lo));
    const outs: number[] = [];
    for (const turn of [0, 0.6, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      await ev(lp, `window.__range.previewTurn(${turn})`);
      await sleep(250);
      outs.push(Math.round(((await ev<number | null>(lp, "window.__range.previewGunOut()")) ?? 9) * 1000) / 1000);
    }
    check(`the Loadouts tab's soldier's ${name} is whole in the panel at every turn (front, three quarters, both sides, back)`, outs.every((o) => o <= 0), JSON.stringify(outs));
  }
  check("the bought guns were there to hold (the checks above are on them)", paid);
  // The soldier's files failing to come (a deploy swapping them as the page loaded): tried again, so the page still ends
  // up with the soldier and not the old figures for the whole session (the owner, 2026-10-02: "we are the base model
  // again?"). The model's first two downloads fail here; the third must bring the soldier.
  {
    const rp = await browser.newPage();
    let gets = 0;
    await rp.setRequestInterception(true);
    rp.on("request", (q) => {
      if (/models\/paid\/soldier\/soldier\.glb/.test(q.url()) && q.method() === "GET" && ++gets <= 2) void q.abort("failed");
      else void q.continue();
    });
    await rp.evaluateOnNewDocument(() => localStorage.setItem("range.welcomed", "1"));
    await rp.goto(`${BASE}?norender&game=speedkills&nointro`, { waitUntil: "domcontentloaded", timeout: 90000 });
    const came = await rp.waitForFunction("Boolean(window.__range) && window.__range.soldierReady()", { polling: 250, timeout: 60000 }).then(() => true, () => false);
    check("the soldier's model failing to download twice is tried again: the page still gets the soldier, not the old figures", came && gets >= 3, JSON.stringify({ came, gets }));
    await rp.close();
  }
  await lp.close();
}

/**
 * The squad you can see (Phase 27): two friends in one SpeedKills squad, each
 * with the other on the squad panel in the same number and colour on both
 * screens, their name over them, their ring through walls (and no ring on a
 * bot), their health heard going up as well as down, and every change of
 * state said: a connection lost and back, the Gulag, a ghost, back in the
 * fight, out, and gone. The pictures of it are tools/squad-shots.ts's.
 */
async function skSquadTest(browser: Browser): Promise<void> {
  const q = "?net=local&norender&game=speedkills";
  const host = await open(browser, q);
  const guest = await open(browser, q);
  const close = async () => {
    for (const p of [host, guest]) if (!p.isClosed()) await p.close();
  };
  // the Gulag on (every e2e page opens with it off): the trip is one of the states to see
  for (const p of [host, guest]) await ev(p, "window.__noGulag = false");
  await ev(host, `window.__range.profile.setName("B00G")`);
  await ev(guest, `window.__range.profile.setName("FRIEND")`);
  await ev(host, brRow("duo", 8));
  await ev(host, `(() => { document.getElementById("duelMode").value = "br"; document.getElementById("duelHost").click(); })()`);
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
    for (const p of [host, guest]) await pressPlay(p);
    for (const p of [host, guest]) await p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 60000 });
  } catch {
    check("squad view: two friends in one SpeedKills squad", false);
    await close();
    return;
  }
  await ev(host, "window.__range.duel().holdFire = true");
  type Sq = { me: { slot: number; color: string } | null; rows: Array<{ id: number; slot: number; color: string; name: string; life: string; health: number; shield: number }>; tags: Array<{ id: number; slot: number; color: string; life: string }> } | null;
  const squad = (p: Page) => ev<Sq>(p, "JSON.parse(JSON.stringify(window.__range.squadNow()))");
  /** the one teammate's row reaches `cond` (a page expression over `r`), or not within the time */
  const rowIs = (p: Page, cond: string, ms = 8000) =>
    p.waitForFunction(`(() => { const s = window.__range.squadNow(); const r = s && s.rows[0]; return !!r && (${cond}); })()`, { polling: 100, timeout: ms }).then(() => true, () => false);
  const said = (p: Page, re: string, ms = 4000) =>
    p.waitForFunction(`(() => { const h = window.__range.hud; return new RegExp(${JSON.stringify(re)}).test(h.noticeNow + " | " + h.feedText.join(" | ")); })()`, { polling: 100, timeout: ms }).then(() => true, () => false);
  const words = (p: Page) => ev<string>(p, `(() => { const h = window.__range.hud; return h.noticeNow + " | " + h.feedText.join(" | "); })()`);
  const [BLUE, GREEN] = [squadCfg.colors[0].hex, squadCfg.colors[1].hex];

  // the numbers and colours: the host is 1 and blue, the friend 2 and green, and both screens say so
  const both = (await rowIs(host, "r.life === 'up'")) && (await rowIs(guest, "r.life === 'up'"));
  const [sh, sg] = [await squad(host), await squad(guest)];
  check("squad view: each friend has one row, the other, up", both && sh?.rows.length === 1 && sg?.rows.length === 1, JSON.stringify({ host: sh?.rows, guest: sg?.rows }));
  check(
    "squad view: the same number and colour on both screens: B00G 1 blue, FRIEND 2 green",
    sh?.me?.slot === 1 && sh.me.color === BLUE && sh.rows[0]?.id === 1 && sh.rows[0].slot === 2 && sh.rows[0].color === GREEN && sh.rows[0].name === "FRIEND" && sg?.me?.slot === 2 && sg.me.color === GREEN && sg.rows[0]?.id === 0 && sg.rows[0].slot === 1 && sg.rows[0].color === BLUE && sg.rows[0].name === "B00G",
    JSON.stringify({ host: { me: sh?.me, row: sh?.rows[0] }, guest: { me: sg?.me, row: sg?.rows[0] } })
  );
  check("squad view: a name over the teammate, in their colour", sg?.tags.length === 1 && sg.tags[0].id === 0 && sg.tags[0].color === BLUE && sh?.tags.length === 1 && sh.tags[0].color === GREEN, JSON.stringify({ host: sh?.tags, guest: sg?.tags }));
  const plated = await ev<string[]>(guest, "window.__range.platesNow().map((p) => p.name)");
  check("squad view: the teammate's plate gives way to their name tag (one name over them, not two)", !plated.includes("B00G"), plated.join());

  // the ring round the teammate, through walls, in their colour, and none on a bot
  type Ring = { id: number; ring: { on: number; width: number; color: number; through: boolean } | null };
  const ringed = await guest.waitForFunction("(() => { const r = window.__range.mateRings().find((x) => x.id === 0); return !!r && !!r.ring && r.ring.on > 0; })()", { polling: 200, timeout: 15000 }).then(() => true, () => false);
  const rings = await ev<Ring[]>(guest, "window.__range.mateRings()");
  const mate = rings.find((r) => r.id === 0)?.ring;
  check("squad view: the teammate has a ring, drawn through walls, in their blue", ringed && !!mate && mate.through && mate.color === parseInt(BLUE.slice(1), 16), JSON.stringify(mate));
  check(`squad view: the ring is a thin line (${squadCfg.mates.outline.min} to ${squadCfg.mates.outline.max} m)`, !!mate && mate.width >= squadCfg.mates.outline.min - 1e-6 && mate.width <= squadCfg.mates.outline.max + 1e-6, String(mate?.width));
  const botRings = rings.filter((r) => r.id >= 100 && r.ring && r.ring.on > 0).length;
  check("squad view: no bot has one", rings.some((r) => r.id >= 100) && botRings === 0, `${botRings} of ${rings.filter((r) => r.id >= 100).length}`);

  // shield heard going up as well as down: a hit takes 40 off it, then SpeedKills gives it back by itself
  // (speedkills.json health: back after shieldDelay, full in shieldFill); a packet could only ever lower it
  await ev(host, "window.__range.duel().takeHit(40, 100)");
  const down = await rowIs(guest, "r.shield <= 11 && r.hurtK > 0");
  const H = skCfg.health;
  const up = await rowIs(guest, "r.shield === 50", (H.shieldDelay + H.shieldFill) * 1000 + 8000);
  check("squad view: a hit on the teammate shows on their row, and their shield coming back does too", down && up, JSON.stringify((await squad(guest))?.rows[0]));

  // a silence past the limit on a guest: the connection lost, then back when the next packet comes
  await ev(guest, `(() => { const r = window.__range.duel().remoteById(0); r.lastHeard = performance.now() / 1000 - ${squadCfg.mates.quiet + 1}; })()`);
  const lost = await said(guest, "B00G LOST THE CONNECTION", 3000);
  const backOn = await said(guest, "B00G is back", 8000);
  check("squad view: a teammate gone silent: CONNECTION LOST, and back with their next packet", lost && backOn, await words(guest));
  // a seat held for a dropped guest on the host: said at once
  await ev(host, "window.__range.duel().held.set(1, performance.now() / 1000 + 60)");
  const held = (await rowIs(host, "r.life === 'quiet'", 3000)) && (await said(host, "FRIEND LOST THE CONNECTION", 3000));
  await ev(host, "window.__range.duel().held.delete(1)");
  const unheld = await rowIs(host, "r.life === 'up'", 3000);
  check("squad view: on the host, a dropped friend's held seat says the connection is lost at once, and back", held && unheld, await words(host));

  // to the Gulag: the first death, early
  await ev(host, "window.__range.duel().takeHit(500, 100)");
  const toGulag = (await rowIs(guest, "r.life === 'gulag'")) && (await said(guest, "B00G IS IN THE GULAG")) && (await said(guest, "B00G went to the Gulag"));
  check("squad view: to the Gulag: the row, the middle of the screen and the feed", toGulag, await words(guest));
  const gone = await ev<Ring[]>(guest, "window.__range.mateRings()");
  const sgG = await squad(guest);
  check("squad view: in the Gulag, no ring and no name where they fell", !gone.find((r) => r.id === 0)?.ring?.on && sgG?.tags.length === 0, JSON.stringify({ ring: gone.find((r) => r.id === 0)?.ring, tags: sgG?.tags }));
  // lost: a death in the room's fight
  const inFight = await host.waitForFunction("(() => { const g = window.__range.duel().gulag; return !!g && g.phase === 'fight'; })()", { polling: 200, timeout: 30000 }).then(() => true, () => false);
  await ev(host, "window.__range.duel().takeHit(500, 100)");
  const ghost = inFight && (await rowIs(guest, "r.life === 'ghost'")) && (await said(guest, "B00G LOST THE GULAG: RESTORE THEM AT THEIR ECHO"));
  const sgH = await squad(guest);
  check("squad view: the Gulag lost: a ghost, where to restore them, and their name over the ghost", ghost && sgH?.tags.length === 1 && sgH.tags[0].life === "ghost", `${await words(guest)} ${JSON.stringify(sgH?.tags)}`);
  // restored, the second restore: back, and no box offered for them after (their "no restores" word, which was dropped)
  await ev(host, "(() => { const d = window.__range.duel(); d.restores = 1; const p = window.__range.player.pos; d.respawnHere(new window.__range.THREE.Vector3(p.x, p.y, p.z), true); })()");
  const back = (await rowIs(guest, "r.life === 'up'")) && (await said(guest, "B00G IS BACK IN THE FIGHT"));
  const noMore = await guest.waitForFunction("window.__range.duel().noRestores.has(0)", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  check("squad view: restored: back in the fight", back, await words(guest));
  check("squad view: their last restore used, their box is not offered again (the word reaches the squad)", noMore);
  // out: a death with no restore left
  await ev(host, "window.__range.duel().takeHit(500, 100)");
  const out = (await rowIs(guest, "r.life === 'out'")) && (await said(guest, "B00G IS OUT OF THE MATCH"));
  check("squad view: out: the row, the middle and the feed", out, await words(guest));

  // gone: the friend closes the game
  await guest.close();
  const left = (await rowIs(host, "r.life === 'left'")) && (await said(host, "FRIEND LEFT THE MATCH"));
  check("squad view: the friend closes the game: LEFT THE MATCH, their row kept", left, await words(host));
  await close();
}

/** the centre sector's name on the map the run is on (E2E_MAP; the old city's by default): its places name it */
const CENTRE_NAME = ((process.env.E2E_MAP ?? "city") === "neon" ? neonSectorsCfg.game.sectors : citySectorsCfg.sectors).find((s) => s.id === "c")!.name;

/**
 * The start screen and the hack pick before play (src/ui/start.ts; the owner, 2026-10-09: "the main screen should be
 * like MUCH more simple"): two ways in and More; either way in asks for the hacks for ten seconds, on your last picks
 * (DASH and HEAL for someone new), and goes in by itself when the time is up.
 */
async function startScreenTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?norender&home=on");
  await page
    .waitForFunction(`(() => { const L = document.getElementById("loading"); return !L || L.hidden || L.classList.contains("done"); })()`, { polling: 250, timeout: 180000 })
    .catch(() => undefined);
  // this browser's own picks and difficulty, put back at the end: every page after this one shares them
  const kept = await ev<{ hacks: string | null; diff: string | null }>(page, `({ hacks: localStorage.getItem("range.sk.hacks"), diff: localStorage.getItem("range.bots.difficulty") })`);
  await ev(page, `localStorage.removeItem("range.sk.hacks")`);
  type Views = { start: boolean; pick: boolean; click: boolean; menu: boolean; overlay: boolean };
  const views = `({ start: !document.getElementById("start").hidden, pick: !document.getElementById("pick").hidden, click: !document.getElementById("clickPlay").hidden, menu: !document.querySelector("#overlay .menu").hidden, overlay: !document.getElementById("overlay").classList.contains("hidden") })`;
  const first = await ev<Views>(page, views);
  check("start: a page opens on the start screen, not the menu", first.overlay && first.start && !first.menu && !first.pick, JSON.stringify(first));
  const ways = await ev<string[]>(page, `[...document.querySelectorAll("#start .startWay b, #startMore")].map((e) => e.firstChild.textContent.trim())`);
  check("start: two ways in, the Firing Range and the Battle Royale, and More", ways.join("|") === "Firing Range|Battle Royale|More", ways.join("|"));
  // More: the menu as it was, and Back to here
  await ev(page, `document.getElementById("startMore").click()`);
  const more = await ev<Views & { back: boolean }>(page, `(() => ({ ...${views}, back: !document.getElementById("startBack").hidden }))()`);
  await ev(page, `document.getElementById("startBack").click()`);
  const back = await ev<Views>(page, views);
  check("start: More opens the menu, and its Back comes here again", more.menu && !more.start && more.back && back.start && !back.menu, JSON.stringify({ more, back }));
  // the Firing Range: the hacks first, DASH and HEAL for someone new, with the clock running
  await ev(page, `document.getElementById("startRange").click()`);
  const pick = await ev<Views & { on: string[]; left: string; way: string }>(
    page,
    `(() => ({ ...${views}, on: [...document.querySelectorAll("#pick .pickCard.on")].map((c) => c.dataset.hack), left: document.getElementById("pickLeft").textContent, way: document.getElementById("pickFor").textContent }))()`
  );
  check("start: a way in asks for the hacks first, on DASH and HEAL, ten seconds on the clock", pick.pick && !pick.start && pick.on.join() === "dash,heal" && /Starting in (10|9)$/.test(pick.left) && pick.way === "Firing Range", JSON.stringify(pick));
  // Esc in the pick is Back, not Resume
  await page.keyboard.press("Escape");
  const esc = await ev<Views & { locked: boolean }>(page, `(() => ({ ...${views}, locked: window.__range.input.locked }))()`);
  check("start: Esc in the pick goes back to the start screen, and does not go in", esc.start && !esc.pick && !esc.locked, JSON.stringify(esc));
  // GRAPPLE and WALL, and in at once
  await ev(page, `document.getElementById("startRange").click()`);
  await ev(page, `(() => { document.querySelector('#pickMobility [data-hack="grapple"]').click(); document.querySelector('#pickUtility [data-hack="wall"]').click(); document.getElementById("pickGo").click(); })()`);
  await sleep(500);
  const inRange = await ev<{ locked: boolean; duel: boolean; saved: string | null; held: string[] }>(
    page,
    `({ locked: window.__range.input.locked, duel: !!window.__range.duel(), saved: localStorage.getItem("range.sk.hacks"), held: [document.getElementById("hackMobility").value, document.getElementById("hackUtility").value] })`
  );
  check("start: Start now goes into the range with the hacks picked, kept for next time", inRange.locked && !inRange.duel && inRange.held.join() === "grapple,wall" && /grapple/.test(inRange.saved ?? "") && /wall/.test(inRange.saved ?? ""), JSON.stringify(inRange));
  // out of the range: the start screen again, with Resume
  await ev(page, "window.__range.input.unlock()");
  await sleep(200);
  const out = await ev<Views & { resume: boolean }>(page, `(() => ({ ...${views}, resume: !document.getElementById("startResume").hidden }))()`);
  check("start: Esc out of the range is the start screen again, with Resume", out.start && out.resume, JSON.stringify(out));
  // the Battle Royale: the last picks kept, and with nothing clicked it goes in by itself when the ten seconds are up
  await ev(page, `document.getElementById("startBr").click()`);
  const br0 = await ev<{ on: string[]; t: number }>(page, `({ on: [...document.querySelectorAll("#pick .pickCard.on")].map((c) => c.dataset.hack), t: performance.now() })`);
  const went = await page.waitForFunction(`window.__range.duel()?.constructor.name === "BrMatch"`, { polling: 100, timeout: 30000 }).then(() => true, () => false);
  const waited = ((await ev<number>(page, "performance.now()")) - br0.t) / 1000;
  check("start: the pick opens on the last picks", br0.on.join() === "grapple,wall", br0.on.join());
  check("start: with nothing clicked, the battle royale starts by itself when the ten seconds are up", went && waited >= 9.5 && waited < 20, `${waited.toFixed(1)} s`);
  // in a match, Esc is the menu (Leave is there), with no way back to the start screen from it
  await sleep(500);
  await ev(page, "window.__range.input.unlock()");
  await sleep(200);
  const inMatch = await ev<Views & { back: boolean }>(page, `(() => ({ ...${views}, back: !document.getElementById("startBack").hidden }))()`);
  check("start: Esc in a match opens the menu, with no Back to the start screen", inMatch.menu && !inMatch.start && !inMatch.back, JSON.stringify(inMatch));
  await ev(page, "window.__range.duel()?.leave()");
  await ev(page, `(() => { const k = ${JSON.stringify(kept)}; if (k.hacks === null) localStorage.removeItem("range.sk.hacks"); else localStorage.setItem("range.sk.hacks", k.hacks); if (k.diff !== null) localStorage.setItem("range.bots.difficulty", k.diff); })()`);
  await page.close();
}

/**
 * A bot's strafe in a fight (bots.ts, speedkills.json botStrafe; the owner, 2026-10-09: "make the bots a little bit
 * easier to hit, their strafing is wild right now"). A Skilled bot in sight of you, 20 samples a second: it strafes at
 * its share of its speed and slows into each turn. It ran sideways at the whole of its speed before, 8.6 m/s on
 * average and 10.8 in its fastest tenth, and reversed at full speed.
 */
async function botStrafeTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?norender");
  const kept = await ev<string | null>(page, `localStorage.getItem("range.bots.difficulty")`);
  await ev(page, `(() => { const s = document.getElementById("botDifficulty"); s.value = "normal"; s.dispatchEvent(new Event("change")); document.getElementById("botCount").value = "1"; window.__range.startBots(); })()`);
  await ev(page, "window.__range.input.lock()");
  const fighting = await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 60000 }).then(() => true, () => false);
  const got = await ev<{ placed: boolean; seen: number; mean: number; p90: number } | null>(
    page,
    `new Promise((ok) => {
      const r = window.__range; const d = r.duel(); const b = d?.bots[0]; if (!b) return ok(null);
      const p = r.player.pos;
      // you, out in the open 14 m from it and in its sight (its own spawn is behind the arena's buildings)
      let placed = false;
      for (let a = 0; a < 360 && !placed; a += 20) {
        const rr = (a * Math.PI) / 180; const o = r.openGround(b.pos.x + Math.sin(rr) * 14, b.pos.z + Math.cos(rr) * 14, 1.5);
        if (!o || Math.hypot(o.x - b.pos.x, o.z - b.pos.z) < 9) continue;
        r.player.teleport(o.x, 0, o.z, 0, 0); placed = b.sees(p.clone());
      }
      const lat = []; let seen = 0; let prev = null; const t0 = performance.now();
      const step = () => {
        d.health = 100; d.shield = d.shieldMax;
        const now = { t: r.gameTime(), x: b.pos.x, z: b.pos.z };
        if (b.sees(p.clone())) {
          seen++;
          if (prev && now.t > prev.t) { const tx = p.x - now.x, tz = p.z - now.z, tl = Math.hypot(tx, tz) || 1; lat.push(Math.abs(((now.x - prev.x) * -tz + (now.z - prev.z) * tx) / tl / (now.t - prev.t))); }
          prev = now;
        } else prev = null;
        if (performance.now() - t0 < 12000) return void setTimeout(step, 50);
        ok({ placed, seen, mean: lat.reduce((s, v) => s + v, 0) / Math.max(1, lat.length), p90: lat.length ? lat.slice().sort((x, y) => x - y)[Math.floor(lat.length * 0.9)] : 0 });
      };
      step();
    })`
  );
  check("bots: the strafe check found a fight to watch (a Skilled bot in sight of you)", fighting && !!got && got.placed && got.seen > 100, JSON.stringify(got));
  if (got && got.seen > 100) {
    // (the 90th percentile, not the single fastest sample: a frame that comes late reads as a jump in speed)
    check("bots: a Skilled bot strafes, at its share of its speed and not the whole of it (it was 8.6 m/s on average, 10.8 in its fastest tenth)", got.mean > 2 && got.mean < 6 && got.p90 < 8.5, `${got.mean.toFixed(1)} m/s on average, ${got.p90.toFixed(1)} in its fastest tenth`);
  }
  await ev(page, "window.__range.duel()?.leave()");
  await ev(page, `(() => { const k = ${JSON.stringify(kept)}; if (k !== null) localStorage.setItem("range.bots.difficulty", k); })()`);
  await page.close();
}


/** E2E_ONLY=bots,br runs only those sections (page, panel, duel, invite, triple, bots, pad, range, finish, throw, emote, speedkills, soldier, skpack (named only), sktour, skship, br, loot, ship, console, gulag, modes, hidden, brsolo, squad, sksquad, skfigure, sklobby, skhunt, skarmory, skfriends, start, skbots, p2p, mixed) */
/**
 * The intro card (src/ui/intro.ts). What has to hold: the page opens on it, it
 * plays on the page's own clock and takes itself away, a key or a click takes
 * the rest of it, the game underneath is never held up or blocked by it, one
 * plays again as a match starts, and `?nointro` means none at all.
 */
async function introTest(browser: Browser): Promise<void> {
  // the one page in the suite that opens with the card on
  const page = await open(browser, "?intro=on" + LEGACY);
  const up = await page
    .waitForFunction(`(() => { const s = window.__range.intro.state(); return s.kind === "boot" && s.shown; })()`, { polling: 20, timeout: 20000 })
    .then(() => true, () => false);
  const early = await ev<{ at: number; beats: { title: number; shot: number; out: number; end: number }; text: string; clicks: boolean }>(
    page,
    `(() => { const s = window.__range.intro.state(); const c = document.getElementById("intro");
      return { at: s.at, beats: s.beats, text: document.getElementById("introSay").textContent, clicks: getComputedStyle(c).pointerEvents !== "none" }; })()`
  );
  check("the page opens on the intro card, and it says the game's name for a reader too", up && /FULL POWER SURGE/.test(early.text), JSON.stringify({ up, text: early.text }));
  // the card is the loading screen now: the bar and the tip are off the page
  // while it plays, and the fraction is the line under the name instead
  const cover = await ev<{ loadingHidden: boolean; at: number; shot: number; loaded: boolean }>(
    page,
    `(() => { const l = document.getElementById("loading"); const s = window.__range.intro.state(); return { loadingHidden: !!l && l.hidden, at: s.at, shot: s.beats.shot, loaded: window.__range.loaded() }; })()`
  );
  check("it stands in for the loading screen, which is off the page while it plays", cover.loadingHidden, JSON.stringify(cover));
  // and it waits on the rain for the world rather than firing into a page that is still loading: the first screen's
  // world (screenLoaded), which is what the card covers. loaded() waits for the loads after that screen too (Milestone
  // 440), and the shot rightly does not, so asked of loaded() this failed from 2026-10-03.
  const held = await ev<{ waited: number; at: number; loaded: boolean }>(
    page,
    `new Promise((ok) => { const R = window.__range; const t0 = performance.now();
      const step = () => { const s = R.intro.state(); if (s.kind === null || s.at > s.beats.shot + 0.05 || performance.now() - t0 > 20000) ok({ waited: s.waited, at: s.at, loaded: R.screenLoaded() }); else requestAnimationFrame(step); };
      step(); })`
  );
  check("the shot waits for the world to be in, so the card covers loading instead of following it", held.loaded, JSON.stringify(held));
  check("the card takes no clicks: everything under it is still there to be used", !early.clicks);
  // the menu underneath is live while the card plays: the card is a picture, not a gate
  const live = await ev<boolean>(page, `(() => { const b = document.getElementById("goRange"); return !!b && !b.disabled; })()`);
  check("the game underneath it is not held up: the menu is there and live while the card plays", live);
  // the glass breaks and the card takes itself off the page, on its own clock
  const gone = await page
    .waitForFunction(`window.__range.intro.state().kind === null`, { polling: 50, timeout: 20000 })
    .then(() => true, () => false);
  const after = await ev<{ shown: boolean; played: number; say: string }>(page, `(() => ({ shown: window.__range.intro.state().shown, played: window.__range.intro.state().played, say: document.getElementById("introSay").textContent }))()`);
  check("it ends by itself, takes the canvas off the page and stops saying its name", gone && !after.shown && after.say === "", JSON.stringify(after));
  // a key takes the rest of it away
  await ev(page, `(() => { window.__range.intro.play("boot"); return true; })()`);
  await sleep(250);
  const before = await ev<boolean>(page, `window.__range.intro.state().kind !== null`);
  await page.keyboard.press("Space");
  await sleep(120);
  const skipped = await ev<{ kind: string | null; shown: boolean }>(page, `(() => { const s = window.__range.intro.state(); return { kind: s.kind, shown: s.shown }; })()`);
  check("a key takes the rest of it: nobody watches a title card twice", before && skipped.kind === null && !skipped.shown, JSON.stringify(skipped));
  // and one plays again as a match starts, the short one
  const played = await ev<number>(page, `window.__range.intro.state().played`);
  await ev(page, `window.__range.startBots()`);
  await sleep(200);
  const onMatch = await ev<{ kind: string | null; played: number; end: number; inGame: boolean }>(
    page,
    `(() => { const s = window.__range.intro.state(); return { kind: s.kind, played: s.played, end: s.beats.end, inGame: !!window.__range.duel() }; })()`
  );
  check("dropping into a match plays the short card, over a match that has already started", onMatch.kind === "match" && onMatch.played === played + 1 && onMatch.end < 2.5 && onMatch.inGame, JSON.stringify(onMatch));
  await ev(page, `window.__range.intro.skip()`);
  await toMenu(page);
  // and for someone whose machine is set to less movement: a shorter card, no
  // shake, no falling glass
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await ev(page, `(() => { window.__range.intro.play("boot"); return true; })()`);
  await sleep(150);
  const quiet = await ev<{ reduced: boolean; end: number; kind: string | null; blast: number }>(page, `(() => { const s = window.__range.intro.state(); return { reduced: s.reduced, end: s.beats.end, kind: s.kind, blast: s.beats.blast }; })()`);
  check("a machine asking for less movement gets a shorter card with no shake and no falling glass", quiet.reduced && quiet.kind === "boot" && quiet.end < 2 && quiet.blast >= quiet.end, JSON.stringify(quiet));
  await ev(page, `window.__range.intro.skip()`);
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  // and the tools' pages have none of it
  const off = await open(browser, "?norender");
  await sleep(600);
  const none = await ev<{ kind: string | null; played: number }>(off, `(() => { const s = window.__range.intro.state(); return { kind: s.kind, played: s.played }; })()`);
  check("?nointro means no card at all, which is how every other page in this suite opens", none.kind === null && none.played === 0, JSON.stringify(none));
  await off.close();
  await page.close();
}

/**
 * The lobby (src/ui/lobby.ts, the Play tab's panel). What has to hold: a card
 * picks a mode rather than starting one, the panel then shows that mode's own
 * options and none of anyone else's, the green button starts it, the choice
 * survives a reload, and With friends carries the mode across to a friends'
 * match, which is the translation this whole panel exists to remove.
 */
async function lobbyPanelTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?norender&nointro");
  await page.waitForFunction("!!window.__range && !!window.__range.menu", { polling: 100, timeout: 30000 });
  const shown = async (): Promise<string[]> =>
    await ev<string[]>(page, `[...document.querySelectorAll(".setupGroup")].filter((g) => !g.hidden).map((g) => g.dataset.group)`);
  const pick = async (id: string): Promise<void> => {
    await ev(page, `document.getElementById("${LOBBY_MODES.find((m) => m.id === id)!.go}").click()`);
  };

  // The owner, 2026-10-04: the battle royale the main obvious mode, the Firing Range under it, one Extra modes button
  // for the rest; the defaults as they are, with Adjust settings on the right opening today's options.
  const seen = (): Promise<string[]> =>
    ev<string[]>(page, `[...document.querySelectorAll(".lobby .modes .mode")].filter((c) => c.offsetParent !== null).map((c) => c.dataset.mode)`);
  await ev(page, `window.__range.menu.showExtras(false)`);
  await pick("br");
  const closed = await seen();
  const big = await ev<{ br: number; range: number }>(page, `({ br: document.getElementById("goBr").getBoundingClientRect().height, range: document.getElementById("goRange").getBoundingClientRect().height })`);
  await ev(page, `document.getElementById("extraModes").click()`);
  const opened = await seen();
  await ev(page, `document.getElementById("extraModes").click()`);
  const shutAgain = await seen();
  check(
    "the play menu: the battle royale first and biggest, the Firing Range under it, and the rest only behind Extra modes",
    closed.join() === "br,range" && big.br > big.range && opened.length > 4 && opened.slice(0, 2).join() === "br,range" && opened.includes("ffa") && shutAgain.join() === "br,range",
    JSON.stringify({ closed, big, opened, shutAgain }),
  );
  await pick("ffa");
  const extraLit = await seen();
  await pick("br");
  check("picking a mode among the extras keeps them open, so its card can be seen lit", extraLit.includes("ffa"), extraLit.join());
  const settings = async (): Promise<{ more: boolean; button: boolean; squad: boolean }> =>
    await ev(page, `({ more: !document.getElementById("setupMore").hidden, button: document.getElementById("adjustSettings").offsetParent !== null, squad: document.getElementById("brTeam").offsetParent !== null })`);
  await ev(page, `window.__range.menu.showSettings(false)`);
  const shut = await settings();
  await ev(page, `document.getElementById("adjustSettings").click()`);
  const adjusted = await settings();
  await ev(page, `document.getElementById("adjustSettings").click()`);
  check(
    "the panel plays on the defaults with its options shut; Adjust settings on the right opens them, the same boxes as before",
    !shut.more && shut.button && !shut.squad && adjusted.more && adjusted.squad,
    JSON.stringify({ shut, adjusted }),
  );
  await ev(page, `window.__range.menu.showSettings(true)`);

  await pick("br");
  const afterPick = await ev<{ mode: string; started: boolean }>(page, `({ mode: window.__range.menu.picked, started: !!window.__range.duel() })`);
  check("a card picks the mode and does not start it", afterPick.mode === "br" && !afterPick.started, JSON.stringify(afterPick));
  // the loadout you play with, under Start and With friends (the owner: "my chosen loadout should be on the battle royale
  // screen below the play / play with friends button"): its two guns, hidden on the range, and Change opens the Loadouts tab
  const card = await ev<{ shown: boolean; text: string; below: boolean }>(
    page,
    `(() => { const c = document.getElementById("setupLoadout"); const go = document.getElementById("startMode"); return { shown: !c.hidden, text: c.textContent, below: c.getBoundingClientRect().top > go.getBoundingClientRect().bottom }; })()`,
  );
  const guns = await ev<string[]>(page, `(() => { const r = window.__range; return r.loadout.slots.map((s) => s.weapon?.name ?? s.id); })()`);
  await pick("range");
  const onRange = await ev<boolean>(page, `!document.getElementById("setupLoadout").hidden`);
  await pick("br");
  await ev(page, `document.getElementById("setupLoadoutEdit").click()`);
  const toLoadouts = await ev<boolean>(page, `!document.querySelector('[data-panel="loadouts"]').hidden`);
  await ev(page, `document.querySelector('#tabs button[data-tab="play"]').click()`);
  check(
    "the battle royale's panel shows the loadout you play with under its buttons, its two guns named; not on the range; Change opens Loadouts",
    card.shown && card.below && guns.every((g) => card.text.toUpperCase().includes(String(g).toUpperCase())) && !onRange && toLoadouts,
    JSON.stringify({ ...card, guns, onRange, toLoadouts }),
  );
  for (const id of ["range", "br", "bots", "ffa", "run"]) {
    await pick(id);
    const on = await shown();
    const want = [...setupFor(id)].sort().join(",");
    check(`${id}: the panel shows its own options and nobody else's`, on.slice().sort().join(",") === want, on.join(", ") || "none");
  }
  const brOnly = await ev<{ ring: boolean; squad: boolean; map: boolean; dummies: boolean }>(
    page,
    `(() => { const vis = (id) => { const e = document.getElementById(id); return !!e && !!e.closest(".setupGroup") && !e.closest(".setupGroup").hidden; };
      return { ring: vis("brPace"), squad: vis("brTeam"), map: vis("arenaMap"), dummies: vis("dummyMode") }; })()`
  );
  check("the battle royale is set up where it is played: squad, bots, the ring's pace", brOnly.ring === false && brOnly.squad === false);
  await pick("br");
  const brBoxes = await ev<{ ring: string; squad: string; bots: string; start: string }>(
    page,
    `(() => { const v = (id) => document.getElementById(id).value; return { ring: v("brPace"), squad: v("brTeam"), bots: v("brBots"), start: v("brStart") }; })()`
  );
  check("and every one of those boxes is on the panel with a value", !!brBoxes.ring && !!brBoxes.squad && !!brBoxes.bots && !!brBoxes.start, JSON.stringify(brBoxes));

  // the ring's pace is a match setting, so it has to reach the match
  await ev(page, `(() => { const s = document.getElementById("brPace"); s.value = "fast"; s.dispatchEvent(new Event("change")); })()`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction("!!window.__range && !!window.__range.menu", { polling: 100, timeout: 30000 });
  const kept = await ev<{ mode: string; pace: string }>(page, `({ mode: window.__range.menu.picked, pace: document.getElementById("brPace").value })`);
  check("the mode and its setup are still there on the next visit", kept.mode === "br" && kept.pace === "fast", JSON.stringify(kept));

  await ev(page, `document.getElementById("startMode").click()`);
  const started = await page.waitForFunction("!!window.__range.duel()", { polling: 100, timeout: 30000 }).then(() => true, () => false);
  const ring = await ev<{ phases: number; wait: number }>(page, `(() => { const p = window.__range.duel().phases; return { phases: p.length, wait: p[0].wait }; })()`);
  check("the panel's own button starts the match it is set up for", started, `${ring.phases} rounds`);
  check("and the pace the panel was set to is the pace the ring runs at", ring.wait < 45, `${ring.wait} s before the first close, against 45 at the normal pace`);
  await ev(page, "window.__range.toMenu()");

  await ev(page, `document.getElementById("goBots").click(); document.getElementById("playFriends").click()`);
  await sleep(600);
  const friends = await ev<{ tab: string; mode: string }>(page, `({ tab: window.__range.menu.tab, mode: document.getElementById("duelMode").value })`);
  check("With friends carries the mode across, which nobody should have to do by hand", friends.mode === "arena" && friends.tab === "duel", JSON.stringify(friends));
  await ev(page, `(() => { const b = document.getElementById("duelLeave"); if (b && !b.hidden) b.click(); })()`);
  await page.close();
}

/**
 * How a figure holds its gun, and where its shots come from (src/game/hold.ts,
 * src/game/muzzle.ts, src/game/mannequin.ts).
 *
 * Two things the owner reported, measured rather than looked at. Guns went
 * through people: the animation library has no rifle clips, so a long gun
 * hangs off the chest at a point we choose, and that point put the stock
 * beside the neck. And tracers did not start at the barrel: a figure's muzzle
 * marker was looked for by a name only the first-person view model's own
 * flash has, so no figure in the game had a muzzle at all, and every bot and
 * every friend fired from the middle of their chest.
 *
 * So: for a gun of every length, the stock clears the body, both hands are on
 * their holds, the muzzle marker is at the end of the barrel, and a shot's
 * tracer starts there.
 */
async function holdTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?norender&nointro" + LEGACY);
  await page.waitForFunction("window.__range.loaded()", { polling: 200, timeout: 40000 });
  const ok = await ev<boolean>(page, "window.__range.loadMannequin().then(() => true, () => false)");
  if (!ok) {
    check("figures: the mannequin loads", false);
    await page.close();
    return;
  }
  await ev(page, `window.__range.setFigureStyle("mannequin")`);
  // one of each length: a pistol, two SMGs, a rifle, a shotgun, an LMG, the
  // longest gun in the game, and the bow, which is held like none of them
  const GUNS = ["autopistol", "volt_smg", "r97", "rspn101", "mastiff", "esaw", "sniper", "bocek"];
  await ev(page, `(() => { const r = window.__range; const s = r.openGround(0, 40, 8); r.player.teleport(s.x, 0, s.z, 0, 0);
    window.__labFigs = r.figureLab(${JSON.stringify(GUNS.map((w) => ({ speed: 0, stance: "stand", pitch: 0, ads: 1, weapon: w })))}, 4, 90); })()`);
  await ev(page, "new Promise((r) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), 900))");

  const held = await ev<Array<{ gun: string; gaps: { stock: number; grip: number; support: number; slide: number } | null; muzzle: number[] | null; chest: number[]; far: number }>>(
    page,
    `(() => { const r = window.__range; return window.__labFigs.map((f, i) => {
       const mq = f.mq;
       const m = f.muzzleWorld();
       const chest = f.group.getWorldPosition(new r.THREE.Vector3());
       const box = mq && mq.gunObject ? new r.THREE.Box3().setFromObject(mq.gunObject) : null;
       return { gun: ${JSON.stringify(GUNS)}[i], gaps: mq ? mq.holdGaps() : null, muzzle: m ? [m.x, m.y, m.z] : null, chest: [chest.x, chest.y, chest.z], far: box ? box.max.distanceTo(box.min) : 0 };
     }); })()`
  );
  check("figures: every gun a figure can hold has a muzzle at the end of its barrel", held.length === GUNS.length && held.every((h) => h.muzzle !== null), held.filter((h) => !h.muzzle).map((h) => h.gun).join(", ") || "all of them");
  const away = held.filter((h) => h.muzzle).map((h) => Math.hypot(h.muzzle![0] - h.chest[0], h.muzzle![2] - h.chest[2]));
  check("and it is out in front of the figure rather than inside it", away.every((d) => d > 0.25), away.map((d) => d.toFixed(2)).join(", "));
  const gaps = held.map((h) => h.gaps).filter(Boolean) as Array<{ stock: number; grip: number; support: number; slide: number }>;
  check("figures: no gun's stock sits further into the body than a stock goes", gaps.every((g) => g.stock <= HOLD.stockAllow + 0.001), gaps.map((g) => g.stock.toFixed(3)).join(", "));
  check("figures: the firing hand is on the grip, not near it", gaps.every((g) => g.grip < 0.09), gaps.map((g) => g.grip.toFixed(3)).join(", "));
  check("figures: and the support hand is on the gun, so no hand floats", gaps.every((g) => g.support < 0.08), gaps.map((g) => g.support.toFixed(3)).join(", "));
  check("figures: a hand that cannot reach the handguard slides back along the gun rather than hanging in the air", gaps.every((g) => g.slide >= 0 && g.slide <= 1), gaps.map((g) => g.slide.toFixed(2)).join(", "));

  // a shot from a bot: its tracer is drawn from its barrel, not its chest
  await ev(page, `(() => { document.getElementById("goBots").click(); document.getElementById("startMode")?.click(); })()`);
  await page.waitForFunction("!!window.__range.duel()", { polling: 100, timeout: 20000 });
  await sleep(2500);
  const shot = await ev<{ from: number[]; muzzle: number[] | null; eye: number[] } | null>(
    page,
    `(() => { const d = window.__range.duel(); const b = d.avatars && d.avatars[0]; if (!b) return null;
       const m = b.muzzleWorld(); const e = b.group.getWorldPosition(new window.__range.THREE.Vector3());
       return { from: m ? [m.x, m.y, m.z] : [0, 0, 0], muzzle: m ? [m.x, m.y, m.z] : null, eye: [e.x, e.y + 1.6, e.z] }; })()`
  );
  check("bots: a bot's gun has a muzzle too, so its tracers leave the barrel", !!shot && shot.muzzle !== null, JSON.stringify(shot?.muzzle));
  await ev(page, "window.__range.toMenu()");
  await page.close();
}

/**
 * The spray, measured against what the range draws of it (src/game/rangetools.ts
 * SprayWall, src/game/recoil.ts).
 *
 * The owner said the spray looks off. The pattern itself is simulated and
 * checked frame by frame, but nothing has ever checked the claim the range
 * makes about it: the wall draws a gold line of where the gun sends a
 * magazine and white marks where your rounds went, and if those two disagree
 * the gun is lying to whoever is standing at the mark trying to learn it.
 *
 * So: stand on the mark, hold the trigger for a magazine with the mouse
 * still, and compare where the rounds landed with the line the wall drew.
 */
async function sprayTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?norender&nointro" + LEGACY);
  await page.waitForFunction("window.__range.loaded()", { polling: 200, timeout: 40000 });
  await ev(page, `(() => { const r = window.__range; r.player.teleport(13.45, 0, -64, -90); r.player.pitch = 1.2; r.sprayWall.clear(); })()`);
  // aimed in and holding the trigger, with nothing else touching the view
  await ev(page, `(() => { const r = window.__range; r.setScript({ held: (a) => a === "fire" || a === "ads", pressedNow: () => false }); })()`);
  const fired = await page
    .waitForFunction(`window.__range.sprayWall.shown.hits.length >= 12`, { polling: 100, timeout: 20000 })
    .then(() => true, () => false);
  await ev(page, `window.__range.setScript(null)`);
  const board = await ev<{ hits: Array<{ u: number; v: number }>; want: Array<{ u: number; v: number }>; marks: number; cone: number; band: number[] }>(
    page,
    `(() => { const w = window.__range.sprayWall; return { hits: w.shown.hits, want: w.shown.want, marks: w.marks, cone: w.shown.cone, band: w.shown.band }; })()`
  );
  check("spray: a magazine held on the wall lands on the wall", fired && board.hits.length >= 12, `${board.hits.length} of ${board.marks} marks on the board`);
  check("spray: and the wall drew the gun's own pattern beside them", board.want.length >= board.hits.length, `${board.want.length} drawn`);
  if (board.hits.length >= 12 && board.want.length >= board.hits.length) {
    // the wall is 5 m across and 3.5 m high, so a board unit is metres/5 and
    // metres/3.5: a miss of 0.04 across is 20 cm at 20 m, which is a hit or a
    // miss on a head
    // How far each round landed from the LINE the wall drew, not from the dot
    // with its own number on it: the gold line is the path the gun walks, and
    // a round is thrown into a cone around wherever on that path the gun had
    // got to. Asking a round to land on its own dot would be asking the random
    // part of the kick not to exist.
    const near = (h: { u: number; v: number }): number => {
      let best = Infinity;
      for (let i = 0; i < board.want.length - 1; i++) {
        const a = board.want[i];
        const b = board.want[i + 1];
        const vx = (b.u - a.u) * 5;
        const vy = (b.v - a.v) * 3.5;
        const wx = (h.u - a.u) * 5;
        const wy = (h.v - a.v) * 3.5;
        const len = vx * vx + vy * vy;
        const t = len < 1e-9 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len));
        best = Math.min(best, Math.hypot(wx - vx * t, wy - vy * t));
      }
      return best;
    };
    const off = board.hits.map(near);
    const worst = Math.max(...off);
    const mid = off.slice().sort((a, b) => a - b)[Math.floor(off.length / 2)];
    // the band the wall draws round the path: the gun's cone plus how far the
    // pattern itself wanders from one magazine to the next
    const ring = Math.max(...board.band) * 5;
    const inside = off.filter((d) => d <= ring).length;
    check("spray: the rounds land along the line the wall draws, inside the band it draws round it", inside >= off.length - 1, `${inside} of ${off.length} inside a ${(ring * 100).toFixed(0)} cm band, ${(mid * 100).toFixed(0)} cm off the line in the middle, ${(worst * 100).toFixed(0)} at worst`);
    // and the pattern climbs: a gun that does not climb is not a gun
    const climb = (board.hits[board.hits.length - 1].v - board.hits[0].v) * 3.5;
    check("spray: and it climbs up the wall as the magazine goes on", climb < -0.3, `${(-climb * 100).toFixed(0)} cm up over ${board.hits.length} rounds`);
  }
  await page.close();
}

/**
 * What a player on a real ping actually experiences (?ping=N, src/net/link.ts).
 *
 * We interpolate and we reconcile, and both are checked: a friend's figure is
 * placed by when its states were SENT, so it moves at one speed through
 * jitter, and a hit is decided by the shooter's own browser, so it lands where
 * the shooter saw it. What has never been measured is the thing those two are
 * for: at 120 ms round trip, does a shot at the figure you can see hit the
 * player it stands for, and how far behind their real position is it?
 *
 * The answer has to be "it hits, and the figure is one interpolation delay
 * behind". A figure placed AHEAD of where it may be would be a hit on
 * somebody who was never there; one further behind than the delay is a friend
 * who has to be led like a duck.
 */
async function pingTest(browser: Browser, ms: number): Promise<void> {
  /** the least the game ever draws a friend behind (src/config/net.json buffer.min) */
  const netMin = 0.1;
  const query = `?net=local&norender&nointro&ping=${ms}`;
  const host = await open(browser, query);
  const guest = await open(browser, query);
  await ev(host, `(() => { document.getElementById("duelMode").value = "arena"; document.getElementById("duelPlayers").value = "2"; document.getElementById("duelHost").click(); })()`);
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  } catch {
    check(`ping ${ms * 2} ms: the two connect`, false);
    await host.close();
    await guest.close();
    return;
  }
  for (const p of [host, guest]) await pressPlay(p);
  for (const p of [host, guest]) await p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 30000 }).catch(() => undefined);
  // the guest strafes across the host's view at a steady speed
  await ev(guest, `(() => { const r = window.__range; r.player.teleport(90, 0, 52, 0); r.setScript({ held: (a) => a === "left", pressedNow: () => false }); })()`);
  await ev(host, `(() => { const r = window.__range; r.player.teleport(90, 0, 62, 0); r.player.pitch = 0; })()`);
  await sleep(1800);

  // how far the figure the host can see is from where that player actually is
  const seen = await ev<{ fx: number; fz: number; delay: number; need: number } | null>(
    host,
    `(() => { const d = window.__range.duel(); const r = d.remotes.get(1); return r ? { fx: r.avatar.group.position.x, fz: r.avatar.group.position.z, delay: r.buffer?.delay ?? -1, need: r.buffer?.need ?? -1 } : null; })()`
  );
  const real = await ev<{ x: number; z: number; speed: number }>(guest, `(() => { const p = window.__range.player; return { x: p.pos.x, z: p.pos.z, speed: Math.hypot(p.vel.x, p.vel.z) }; })()`);
  const behind = seen ? Math.hypot(seen.fx - real.x, seen.fz - real.z) : -1;
  const delay = real.speed > 0.5 ? behind / real.speed : 0;
  // The figure is drawn one buffer behind the states it is placed from, and
  // those are one ping old: that is the whole of the delay and it is what it
  // has to be. What must NOT happen is a buffer bigger than the gap it is
  // covering, which would be lag the connection never asked for. (The buffer
  // follows the gap between states, and a page rendering at fifteen frames a
  // second sends them that slowly, so the number here is the test machine's
  // as much as the network's: it is checked against the gap, not a constant.)
  const want = (seen?.need ?? 0) + ms / 1000;
  check(`ping ${ms * 2} ms: the figure is drawn one buffer and one ping behind, and the buffer is the gap between states rather than more`, !!seen && seen.delay > 0 && seen.delay <= Math.max(netMin, seen.need * 1.6 + 0.05), `buffer ${((seen?.delay ?? 0) * 1000).toFixed(0)} ms for a ${((seen?.need ?? 0) * 1000).toFixed(0)} ms gap`);
  check(`ping ${ms * 2} ms: and what you see is that far behind and no further`, !!seen && delay <= want * 1.8 + 0.12, `${behind.toFixed(2)} m at ${real.speed.toFixed(1)} m/s, ${(delay * 1000).toFixed(0)} ms behind against ${(want * 1000).toFixed(0)} expected`);
  check(`ping ${ms * 2} ms: and it is behind rather than ahead, because a figure ahead of a player is a hit on somebody who was never there`, !!seen && behind >= 0, `${behind.toFixed(2)} m`);

  // now shoot the figure the host can see, and see whether the player takes it
  const before = await ev<number>(guest, `window.__range.duel().health + window.__range.duel().shield`);
  const hit = await ev<{ fired: boolean }>(
    host,
    `(() => { const r = window.__range; const d = r.duel(); const rem = d.remotes.get(1); if (!rem) return { fired: false };
       const at = rem.avatar.group.position.clone(); at.y += 1.1;
       const eye = r.player.eyePosition(); const dir = at.sub(eye).normalize();
       for (let i = 0; i < 6; i++) r.fireRound([dir.x, dir.y, dir.z]);
       return { fired: true }; })()`
  );
  await sleep(Math.max(600, ms * 6));
  const after = await ev<number>(guest, `window.__range.duel().health + window.__range.duel().shield`);
  check(`ping ${ms * 2} ms: six rounds into the figure you can see land on the player it stands for`, hit.fired && after < before, `${before} -> ${after}`);
  await ev(guest, "window.__range.setScript(null)");
  await host.close();
  await guest.close();
}

/**
 * The things the owner asked for on the 21st, in a real page: picking a mode
 * wipes the match you were in rather than sending you to a tab to resign from
 * it, a match can hold thirty bots and more, the kit card fits on the screen
 * with six kits on it, the callouts name the ground you stand on, and the two
 * extra moves are off unless a match asks for them.
 */
async function ownerTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?norender&nointro");
  await page.waitForFunction("window.__range.loaded()", { polling: 200, timeout: 40000 });
  const start = async (id: string): Promise<void> => {
    await ev(page, `(() => { document.getElementById("${id}").click(); document.getElementById("startMode").click(); })()`);
    await sleep(1200);
  };

  // switching modes: no refusal, no tab, and nothing of the old match left
  await start("goBots");
  const first = await ev<string>(page, `window.__range.duel()?.kind ?? "none"`);
  await start("goFfa");
  const second = await ev<{ kind: string; mode: string }>(page, `(() => { const d = window.__range.duel(); return { kind: d?.kind ?? "none", mode: d?.modeKind ?? "" }; })()`);
  check("picking a mode in a match starts it rather than refusing", first === "bots" && second.mode === "ffa", `${first} then ${second.kind}/${second.mode}`);
  await ev(page, `(() => { document.getElementById("goRange").click(); document.getElementById("startMode").click(); })()`);
  await sleep(900);
  const cleared = await ev<{ match: boolean; notice: string }>(page, `({ match: !!window.__range.duel(), notice: window.__range.hud.last?.notice?.text ?? "" })`);
  check("and going back to the range leaves no match behind", !cleared.match, JSON.stringify(cleared));

  // thirty bots, each with its own name
  await ev(page, `(() => { const s = document.getElementById("botCount"); s.value = "30"; s.dispatchEvent(new Event("change")); })()`);
  await start("goBots");
  const many = await ev<{ n: number; names: number }>(
    page,
    `(() => { const d = window.__range.duel(); const bots = d?.bots ?? []; return { n: bots.length, names: new Set(bots.map((b) => b.remote?.name ?? "")).size }; })()`
  );
  check("a match can hold thirty bots, and no two of them share a name", many.n === 30 && many.names === 30, JSON.stringify(many));

  // the callout: the ground you are standing on, said in a word
  const call = await ev<string | null>(page, `(() => { const r = window.__range; r.player.teleport(r.player.pos.x, 0, r.player.pos.z, 0); return r.hud.last?.callout ?? null; })()`);
  check("the arena says which part of it you are standing in", !!call && /MID|NORTH|SOUTH|EAST|WEST/.test(call), String(call));

  // the movement: SpeedKills' own, the double jump and the wall run always on
  const moves = await ev<{ on: boolean }>(page, `({ on: window.__range.player.extraMoves })`);
  check("the double jump and the wall run are on, as SpeedKills always has them", moves.on, JSON.stringify(moves));
  await ev(page, `(() => { const s = document.getElementById("extraMoves"); s.value = "1"; s.dispatchEvent(new Event("change")); })()`);
  await start("goRange");
  const armed = await ev<boolean>(page, `window.__range.player.extraMoves`);
  check("and on when it does", armed);
  await ev(page, `(() => { const s = document.getElementById("extraMoves"); s.value = "0"; s.dispatchEvent(new Event("change")); })()`);
  await page.close();
}

const ONLY = (process.env.E2E_ONLY ?? "").split(",").filter(Boolean);
/** E2E_GUNS=alternator_smg narrows the bought arms' frames (the soldier and skpack sections) to those guns */
const E2E_GUNS = (process.env.E2E_GUNS ?? "").split(",").filter(Boolean);
const want = (k: string): boolean => !ONLY.length || ONLY.includes(k);
/**
 * One section, run so that a throw in it (a wait that timed out) is a failed check and the sections after it still run: a
 * 1v1's countdown wait timed out under load on 2026-09-30, and the throw took every section after it in its batch with it.
 */
async function section(name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (e) {
    check(`${name}: the section ran to its end`, false, String(e).split(/\r?\n/)[0].slice(0, 300));
  }
}

async function main(): Promise<void> {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    protocolTimeout: 120000,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--mute-audio",
      "--no-sandbox",
      // two pages must both keep running frames
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      // voice chat: a fake microphone (a tone), allowed without a prompt
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  try {
    if (want("page")) {
    console.log("\nThe page");
    const page = await open(browser, "");
    await sleep(2500);
    const t0 = await ev<number>(page, "performance.now()");
    const f = await ev<{ merged: { meshes: number; after: number } | null; calls: number }>(page, "({ merged: window.__range.merged, calls: window.__range.drawCalls() })");
    check("loads with the static merge done", f.merged !== null && f.merged.after < f.merged.meshes, f.merged ? `${f.merged.meshes} -> ${f.merged.after} meshes` : "none");
    // the loading screen counts the models and textures in, and goes once they are and a frame is drawn
    const inWorld = await page.waitForFunction("window.__range.loaded()", { polling: 200, timeout: 30000 }).then(() => true, () => false);
    await sleep(500);
    const ls = await ev<{ hidden: boolean; status: string; fill: string }>(page, `(() => { const e = document.getElementById("loading"); return { hidden: e.hidden, status: document.getElementById("loadingStatus").textContent, fill: document.getElementById("loadingFill").style.width }; })()`);
    // (SpeedKills' screen goes as soon as the range is drawn, the last few files still on their way: the first screen
    // sooner, Milestones 452 to 469, so its bar need not reach the end)
    check("the loading screen counts the world in and goes once it is", inWorld && ls.hidden && /\d+ OF \d+/.test(ls.status), JSON.stringify(ls));
    // A test page must never take the real locks: headless Chrome has a real,
    // invisible window, and pointer lock pinned the owner's cursor inside it
    // (a small square in a monitor's corner) while Keyboard Lock held the keys.
    // A Play button or a click on the game locks; on a test page that is pretend only.
    {
      const lp = await open(browser, "?norender");
      const read = "({ game: window.__range.input.locked, pointer: !!document.pointerLockElement, full: !!document.fullscreenElement })";
      // asked for by the game itself, as a match that connects does: refused, as a real browser refuses it
      await ev(lp, "window.__range.input.lock(true)");
      await sleep(300);
      const asked = await ev<{ game: boolean; pointer: boolean; full: boolean }>(lp, read);
      // asked for by a button, as Play does: the game is in, and still nothing is taken from the machine
      await ev(lp, "window.__range.input.lock()");
      await sleep(500);
      const lk = await ev<{ game: boolean; pointer: boolean; full: boolean }>(lp, read);
      check("a test page: a lock the game asks for by itself is refused; one from a button counts as locked, yet the browser holds no pointer lock and no fullscreen", !asked.game && lk.game && !lk.pointer && !lk.full, JSON.stringify({ asked, clicked: lk }));
      await lp.close();
    }
    check("frames are drawing", f.calls > 0, `${f.calls} draw calls`);
    check("no page errors on load", errors.length === 0, errors.slice(0, 3).join(" | "));
    // smaller downloads (tools/compress-assets.ts): the surfaces and the props' maps come as WebP, and none is missing
    const webp = await ev<{ webp: number; jpg: number; bad: string[] }>(page, `(() => { const r = performance.getEntriesByType("resource"); const tex = r.filter((x) => x.name.includes("/tex/") || x.name.includes("/models/")); return { webp: tex.filter((x) => x.name.endsWith(".webp")).length, jpg: tex.filter((x) => x.name.endsWith(".jpg")).length, bad: tex.filter((x) => x.responseStatus >= 400).map((x) => x.name.split("/").slice(-2).join("/")) }; })()`);
    check("textures: the range's and the props' maps load as WebP, none missing", webp.webp >= 20 && webp.bad.length === 0, JSON.stringify(webp));
    // The HUD's icons (npm run icons). They are SVG, so they have to survive
    // being rasterised and then tinted with a source-in fill: an icon that
    // still carried game-icons.net's black background plate would light every
    // pixel of the square instead of the glyph, which is a black box over the
    // ammo counter rather than an icon.
    const icons = await ev<{ count: number; loaded: boolean; lit: number; all: number }>(
      page,
      `(async () => {
        const idx = await (await fetch("icons/index.json")).json();
        const img = new Image();
        const loaded = await new Promise((res) => { img.onload = () => res(true); img.onerror = () => res(false); img.src = "icons/frag.svg"; });
        const c = document.createElement("canvas"); c.width = 16; c.height = 16;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0, 16, 16);
        g.globalCompositeOperation = "source-in";
        g.fillStyle = "#ff0000";
        g.fillRect(0, 0, 16, 16);
        const d = g.getImageData(0, 0, 16, 16).data;
        let lit = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) lit++;
        return { count: Object.keys(idx).length, loaded, lit, all: 256 };
      })()`
    );
    check(
      "the HUD's icons load, tint, and are a glyph rather than a black square",
      icons.count >= 40 && icons.loaded && icons.lit > 20 && icons.lit < icons.all * 0.8,
      `${icons.count} icons, ${icons.lit} of ${icons.all} pixels lit`
    );
    // the fonts are ours now, not a third-party request on the first frame
    const fonts = await ev<{ own: number; google: number }>(
      page,
      `(() => { const r = performance.getEntriesByType("resource").map((x) => x.name); return { own: r.filter((n) => n.includes("/fonts/") && n.endsWith(".woff2")).length, google: r.filter((n) => n.includes("googleapis") || n.includes("gstatic")).length }; })()`
    );
    check("the fonts are self-hosted and nothing is fetched from Google", fonts.own >= 2 && fonts.google === 0, JSON.stringify(fonts));
    void t0;

    console.log("\nThe first visit");
    check("a first visit shows the welcome", await ev<boolean>(page, `!document.getElementById("welcome").hidden`));
    // the panel's own button is the way in now; Resume is not offered until
    // there is a game to resume, because two Play buttons is one too many
    const buttons = await ev<{ start: string; resume: boolean }>(page, `({ start: document.getElementById("startMode").textContent, resume: !document.getElementById("play").hidden })`);
    check("the panel's button says what it starts, and nothing says Resume before anything has started", /^Start /.test(buttons.start) && !buttons.resume, JSON.stringify(buttons));
    const probs = await ev<Record<string, string | null>>(
      page,
      `(() => { const f = window.__range.deviceProblem; return {
        phone: f("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"),
        android: f("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36"),
        safari: f("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15"),
        firefox: f("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0"),
        edge: f("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36 Edg/128.0"),
      }; })()`
    );
    check("a phone is told this is a PC game", /PC game/.test(probs.phone ?? "") && /PC game/.test(probs.android ?? ""));
    check("Safari is told to use Chrome or Edge, Firefox is warned", /Safari is not supported/.test(probs.safari ?? "") && /Firefox works/.test(probs.firefox ?? ""));
    check("Chrome or Edge on a PC gets no warning", probs.edge === null, String(probs.edge));
    await ev(page, `document.getElementById("welcomeOk").click()`);
    check("Got it puts the welcome away", await ev<boolean>(page, `document.getElementById("welcome").hidden`));
    // accounts are optional and need the game's own server: here (no server) the Stats tab says so and offers nothing
    const acct = await page.waitForFunction(`/own server/.test(document.getElementById("accountStatus").textContent)`, { polling: 200, timeout: 8000 }).then(() => true, () => false);
    check("accounts: without the game's own server the Stats tab says so, and nothing to sign in to", acct && (await ev<boolean>(page, `document.getElementById("accountSignedOut").hidden && document.getElementById("accountSignedIn").hidden`)));
    // Esc on the menu is the Resume button (a scripted page gets no pointer
    // lock, so what is checked is that the press is taken as Resume)
    const escKey = `(() => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape", bubbles: true, cancelable: true })); return window.__range.menuEscapes(); })()`;
    const escOnMenu = await ev<number>(page, escKey);
    check("Esc on the menu is Resume", escOnMenu === 1, `${escOnMenu} taken as Resume`);
    // ...but not while typing a name, and not while the game is running
    const typing = await ev<{ taken: number; focused: boolean; blurred: boolean }>(
      page,
      `(async () => { const el = document.getElementById("profileName") ?? document.createElement("input");
        if (!el.isConnected) document.getElementById("overlay").appendChild(el);
        // The Esc just above was taken as Resume, and whether the menu has
        // closed by now is a race: it flaked with the whole overlay hidden.
        // This check is about typing on the menu, so the menu is put back.
        document.getElementById("overlay").classList.remove("hidden");
        document.querySelector('#tabs button[data-tab="stats"]').click();
        // A hidden field cannot take focus, and on a loaded machine the tab's
        // panel is not always shown by the time the click returns: this flaked
        // with "focused: false" whenever the CPU was busy. Wait for it to show.
        for (let i = 0; i < 40 && el.offsetParent === null; i++) await new Promise((r) => requestAnimationFrame(r));
        el.focus(); const focused = document.activeElement === el;
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape", bubbles: true, cancelable: true }));
        const out = { taken: window.__range.menuEscapes(), focused, blurred: document.activeElement !== el };
        document.querySelector('#tabs button[data-tab="play"]').click(); return out; })()`
    );
    check("Esc in a text field leaves the field instead of resuming", typing.focused && typing.taken === escOnMenu && typing.blurred, JSON.stringify(typing));
    // The crosshair: the Settings rows change it at once, keep it, and draw a
    // preview; Reset puts the game's own back.
    const xh = await ev<{ before: string; style: string; color: string; hud: string; stored: string; lit: number; reset: string }>(
      page,
      `(async () => {
        const R = window.__range; const $ = (id) => document.getElementById(id);
        const before = R.reticle.style;
        $("xhStyle").value = "cross"; $("xhStyle").dispatchEvent(new Event("change"));
        $("xhColor").value = "green"; $("xhColor").dispatchEvent(new Event("change"));
        await new Promise((r) => setTimeout(r, 300));
        const cur = { style: R.reticle.style, color: R.reticle.color };
        const stored = JSON.parse(localStorage.getItem("range.reticle.v1") ?? "{}");
        const g = $("xhPreview").getContext("2d"); const px = g.getImageData(0, 0, 96, 96).data;
        let lit = 0; for (let i = 0; i < px.length; i += 4) if (px[i + 1] > 200 && px[i] < 120) lit++;
        $("xhReset").click();
        const reset = JSON.parse(localStorage.getItem("range.reticle.v1") ?? "{}").style;
        return { before, style: cur?.style ?? "", color: cur?.color ?? "", hud: cur ? cur.style + "/" + cur.color : "", stored: stored.style + "/" + stored.color, lit, reset };
      })()`
    );
    check("crosshair: the game's own by default; a new style and colour apply at once and are kept", xh.before === "apex" && xh.style === "cross" && xh.color === "green" && xh.stored === "cross/green", JSON.stringify(xh));
    check("crosshair: the preview draws it, and Reset brings the game's own back", xh.lit > 10 && xh.reset === "apex", JSON.stringify({ lit: xh.lit, reset: xh.reset }));
    // Progression: a finished match pays XP, and the Stats tab shows the level,
    // the bar and the three challenges.
    const prog = await ev<{ before: number; after: number; card: boolean; challenges: number; text: string }>(
      page,
      `(() => {
        const R = window.__range; const before = R.progress.xp;
        R.progress.award("duel", { won: true, roundsWon: 3, roundsLost: 1, kills: 4, deaths: 1, damage: 620, shots: 40, hits: 22 });
        const card = document.getElementById("levelCard");
        return { before, after: R.progress.xp, card: !!card, challenges: card ? card.querySelectorAll("tr").length : 0, text: card ? card.textContent.slice(0, 60) : "" };
      })()`
    );
    check("progression: a won 1v1 pays XP, and the Stats tab shows the level and three challenges", prog.after > prog.before && prog.card && prog.challenges === 3 && /Level/.test(prog.text), JSON.stringify(prog));
    // Accessibility: the colour vision and HUD size selects apply and are kept
    const acc = await ev<{ saved: string; options: number; scales: number }>(
      page,
      `(() => { const $ = (id) => document.getElementById(id);
        $("accVision").value = "deuteranopia"; $("accVision").dispatchEvent(new Event("change"));
        $("accHudScale").value = "1.25"; $("accHudScale").dispatchEvent(new Event("change"));
        const saved = localStorage.getItem("range.access.v1") ?? "";
        const out = { saved, options: $("accVision").options.length, scales: $("accHudScale").options.length };
        $("accVision").value = "normal"; $("accVision").dispatchEvent(new Event("change"));
        $("accHudScale").value = "1"; $("accHudScale").dispatchEvent(new Event("change"));
        return out; })()`
    );
    check("accessibility: four colour vision modes and six HUD sizes, and a choice is kept", acc.options === 4 && acc.scales === 6 && /deuteranopia/.test(acc.saved) && /1\.25/.test(acc.saved), JSON.stringify(acc));
    const inGame = await ev<number>(page, `(() => { document.getElementById("overlay").classList.add("hidden"); window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape", bubbles: true, cancelable: true })); document.getElementById("overlay").classList.remove("hidden"); return window.__range.menuEscapes(); })()`);
    check("Esc with the menu closed is not a resume", inGame === escOnMenu, `${inGame} taken as Resume, ${escOnMenu} before`);

    console.log("\nThe course");
    // in the game, not on the menu: the menu stops a run's clock
    await pressPlay(page);
    await ev(page, `document.getElementById("overlay").classList.add("hidden")`);
    // fit an optic to slot 1 first: the course lends pistols and must give it back
    const fitted = await ev<string | null>(page, `(() => { const l = window.__range.loadout; l.cycleAttachment("optic"); return l.slots[0].attach.optic ?? null; })()`);
    const X = -21.5;
    const steps: Array<[number, number, number]> = [
      [0, 0, 11], [0, 0, 13.5], [6, 0, 22], [0, 0, 42], [0, 4.2, 52.8], [0, 1.4, 71], [8, 1.4, 83], [-7, 0, 95], [7, 0, 119.5], [7, 0, 131.2],
    ];
    for (const [x, y, z] of steps) {
      await ev(page, `(() => { const p = window.__range.player; p.pos.set(${X + x}, ${y}, ${z}); p.vel.set(0, 0, 0); p.yaw = 180; })()`);
      // wait for at least three frames at this spot
      await ev(page, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))))");
    }
    const res = await ev<{ splits: Array<{ name: string; time: number }>; time: number } | null>(page, "window.__range.course.result");
    check("a run through every room finishes with a result", res !== null, res ? `${res.time.toFixed(2)} s` : "no result");
    if (res) {
      const skipped = res.splits.filter((s) => !Number.isFinite(s.time)).map((s) => s.name);
      check("with a split for every room and the finish", res.splits.length === 8 && skipped.length === 0, skipped.length ? `skipped ${skipped.join(",")}` : "8 splits");
      const medals = (res.splits as Array<{ name: string; par?: number; medal?: string | null }>).slice(0, 7);
      check("medals: every room has a par, and a run this quick takes gold in each", medals.every((s) => (s.par ?? 0) > 1 && s.medal === "gold"), JSON.stringify(medals.map((s) => `${s.name}:${s.medal}/${s.par}`)));
      // 1.5 s after the finish you are put back near the start, facing the results TV
      const back = await page
        .waitForFunction(`Math.abs(window.__range.player.pos.x - (${X} + 7)) < 0.3 && Math.abs(window.__range.player.pos.z - 11.4) < 0.3`, { polling: 200, timeout: 10000 })
        .then(() => true, () => false);
      const pose = await ev<{ x: number; z: number; yaw: number; running: boolean }>(page, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z, yaw: window.__range.player.yaw, running: window.__range.course.running })");
      check("after the finish: back near the start, facing the TV, no run going", back && Math.abs(pose.yaw) < 1 && !pose.running, JSON.stringify({ x: +pose.x.toFixed(2), z: +pose.z.toFixed(2), yaw: +pose.yaw.toFixed(1) }));
      const after = await ev<string | null>(page, "window.__range.loadout.slots[0].attach.optic ?? null");
      check("your own gun comes back with its optic after the run", fitted !== null && after === fitted, `${fitted} -> ${after}`);
    }

    // the menu stops the clock: start a run, open the menu, and it keeps its time
    // (reset first: the finish's return to the start would override the teleport)
    await ev(page, `window.__range.course.reset()`);
    await ev(page, `(() => { const p = window.__range.player; p.pos.set(${X}, 0, 11); p.vel.set(0, 0, 0); p.yaw = 180; })()`);
    await ev(page, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
    await ev(page, `(() => { const p = window.__range.player; p.pos.set(${X}, 0, 13.5); p.vel.set(0, 0, 0); })()`);
    // a little time on the clock before the menu stops it
    await page.waitForFunction("window.__range.course.running && window.__range.courseClock() > 0.05", { polling: 50, timeout: 8000 }).catch(() => undefined);
    await toMenu(page);
    const clock = () => ev<number>(page, "window.__range.courseClock()");
    const c0 = await clock();
    await sleep(1500);
    const c1 = await clock();
    const diag = await ev<string>(page, `JSON.stringify({ playing: window.__range.input.playing, running: window.__range.course.running, z: window.__range.player.pos.z, x: window.__range.player.pos.x })`);
    check("the menu stops a run's clock", c0 > 0 && Math.abs(c1 - c0) < 0.05, `${c0.toFixed(2)} s -> ${c1.toFixed(2)} s over 1.5 s on the menu ${diag}`);
    await ev(page, `window.__range.course.reset()`);

    // Swap away and back: one optic on the gun in hand, not one per round trip
    // (models are cached per weapon and the old optic used to stay on).
    for (const slot of [1, 0, 1, 0]) {
      await ev(page, `window.__range.loadout.requestSwap(${slot}, 0)`);
      await page.waitForFunction("!window.__range.loadout.swapping", { polling: 100, timeout: 10000 });
      await ev(page, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
    }
    const optics = await ev<number>(page, "window.__range.opticsInScene()");
    check("after swapping back and forth, one optic in the scene", optics === 1, `${optics}`);

    console.log("\nWeapon finishes");
    {
      // No levels on a paint job any more: the owner asked for the grind to
      // come off them, so a page at level 1 can pick the last one in the list.
      const before = await ev<{ any: boolean; count: number; gun: string }>(
        page,
        `(() => { const s = document.getElementById("finish0"); return { any: [...s.options].some((x) => x.disabled), count: s.options.length, gun: document.getElementById("slot0").value }; })()`
      );
      await ev(page, `(() => { const sel = document.getElementById("finish0"); sel.value = "gold"; sel.dispatchEvent(new Event("change")); })()`);
      await sleep(400);
      const worn = await ev<{ finish: string }>(page, `window.__range.gunFinish(${JSON.stringify(before.gun)})`);
      const shown = await ev<string>(page, `document.getElementById("finish0").value`);
      const drawn = await ev<string>(page, "window.__range.loadout.active.id");
      check(
        "finishes: every one of them is open from the first minute, and Gold picked for the first slot's gun is worn in hand",
        !before.any && before.count >= 8 && shown === "gold" && drawn === before.gun && worn.finish === "gold",
        JSON.stringify({ before, shown, worn, drawn })
      );
    }

    console.log("\nThird person");
    await ev(page, `document.getElementById("goRange").click(); document.getElementById("startMode").click()`);
    await ev(page, "window.__range.setThirdPerson(true)");
    await ev(page, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
    const tp = await ev<{ dist: number; fig: boolean; vm: boolean }>(page, `(() => { const p = window.__range.player; const c = window.__range.camera; const e = p.eyePosition(); return { dist: Math.hypot(c.position.x - e.x, c.position.y - e.y, c.position.z - e.z), fig: window.__range.selfFigureVisible(), vm: window.__range.viewModelVisible() }; })()`);
    check("third person: the camera sits behind the shoulder, your figure shows, the gun in hand does not", tp.dist > 1.8 && tp.dist < 3 && tp.fig && !tp.vm, JSON.stringify(tp));
    await ev(page, "window.__range.setOrbit(180, 10)");
    await ev(page, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
    const orbit = await ev<{ ahead: number }>(page, `(() => { const p = window.__range.player; const c = window.__range.camera; return { ahead: -(c.position.z - p.pos.z) }; })()`);
    check("the orbit puts the camera in front of your figure", orbit.ahead > 1.5, `${orbit.ahead.toFixed(2)} m ahead`);
    await ev(page, "window.__range.setOrbit(0, 0, false)");
    await ev(page, "window.__range.setThirdPerson(false)");
    await ev(page, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
    const fp = await ev<{ dist: number; fig: boolean; vm: boolean }>(page, `(() => { const p = window.__range.player; const c = window.__range.camera; const e = p.eyePosition(); return { dist: Math.hypot(c.position.x - e.x, c.position.y - e.y, c.position.z - e.z), fig: window.__range.selfFigureVisible(), vm: window.__range.viewModelVisible() }; })()`);
    check("back in first person: the camera is at the eye and the gun is back", fp.dist < 0.1 && !fp.fig && fp.vm, JSON.stringify(fp));
    // The arms in your own view are the published body's, in your outfit's
    // sleeves, not the drawn gloves (src/game/fparms.ts). They come in once the
    // body has; a figure is already on screen above, so the body is here.
    const real = await ev<boolean>(page, `new Promise((ok) => { const t0 = performance.now(); const w = () => (window.__range.realArms() || performance.now() - t0 > 8000 ? ok(window.__range.realArms()) : setTimeout(w, 100)); w(); })`);
    check("your own arms in first person are the real body's, not drawn gloves", real);
    // the clips a figure plays now and then load after the figures do (tools/fetch-clips.ts), and they arrive
    const extras = ["Slide_Start", "Slide_Exit", "OverhandThrow", "Melee_Hook", "Punch_Cross", "Hit_Head", "NinjaJump_Idle_Loop", "Fixing_Kneeling", "Interact", "Dance_Loop", "Yes", "Idle_FoldArms_Loop"];
    const clipsIn = await ev<string[]>(page, `new Promise((ok) => { const want = ${JSON.stringify(extras)}; const t0 = performance.now(); const w = () => { const miss = want.filter((c) => !window.__range.hasClip(c)); if (!miss.length || performance.now() - t0 > 10000) ok(miss); else setTimeout(w, 100); }; w(); })`);
    check("the extra clips (a slide's way in and out, a throw, three swings, a revive, emotes) load after the figures", clipsIn.length === 0, clipsIn.length ? `missing ${clipsIn.join(", ")}` : `${extras.length} clips`);
    // (the Outskirts' kit dressing and its scenery were checked here: the legacy game's map, which SpeedKills never
    // draws; the code goes with the map, docs/PLAN_LEGACY_REMOVAL.md 496)
    await ev(page, "window.__range.player.teleport(0, 0, 6, 0)");
    // the gun has its own camera: the FOV setting widens the world, not the gun
    const fovAt = async (v: string) => {
      await ev(page, `(() => { const f = document.getElementById("fov"); f.value = "${v}"; f.dispatchEvent(new Event("input")); })()`);
      await ev(page, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
      return ev<{ gun: number; world: number }>(page, "window.__range.gunFov()");
    };
    const narrow = await fovAt("1");
    const wide = await fovAt("1.571");
    await fovAt("1.55");
    check("the gun's own FOV: the narrowest and widest settings change the world's FOV, not the gun's", Math.abs(narrow.gun - wide.gun) < 0.01 && wide.world - narrow.world > 20, JSON.stringify({ narrow, wide }));

    console.log("\nThe menu and loadouts");
    const tabs = ["play", "duel", "loadouts", "settings", "controls"];
    for (const t of tabs) {
      await ev(page, `document.querySelector('#tabs button[data-tab="${t}"]').click()`);
      const shown = await ev<string[]>(page, `[...document.querySelectorAll("[data-panel]")].filter((p) => !p.hidden).map((p) => p.dataset.panel)`);
      check(`tab ${t} shows its panel and only that`, shown.length === 1 && shown[0] === t, shown.join(","));
    }
    // rebinding: Jump's first key to X, then Jump takes C from Crouch
    await ev(page, `document.querySelector('#tabs button[data-tab="controls"]').click()`);
    const chipOf = (label: string) => `[...document.querySelectorAll("#bindTable .bindRow")].find((r) => r.querySelector(".bindName").textContent === "${label}")`;
    const keysOf = (label: string) => ev<string[]>(page, `[...${chipOf(label)}.querySelectorAll(".bindKey:not(.add)")].map((b) => b.textContent)`);
    const rebind = async (label: string, code: string) => {
      await ev(page, `${chipOf(label)}.querySelector(".bindKey").click()`);
      await sleep(50);
      await ev(page, `document.dispatchEvent(new KeyboardEvent("keydown", { code: "${code}", bubbles: true }))`);
    };
    await rebind("Jump", "Semicolon");
    check("a key can be rebound", (await keysOf("Jump"))[0] === ";", (await keysOf("Jump")).join(","));
    await rebind("Jump", "KeyC");
    const crouchKeys = await keysOf("Crouch, slide");
    check("a key taken from another action moves over", (await keysOf("Jump"))[0] === "C" && !crouchKeys.includes("C"), `jump ${(await keysOf("Jump")).join(",")}, crouch ${crouchKeys.join(",")}`);
    check("and the tab says so", /It was Crouch, slide/.test(await ev<string>(page, `document.getElementById("bindsNote").textContent`)));
    const stored = await ev<Record<string, string[]>>(page, `JSON.parse(localStorage.getItem("range.binds.v1") ?? "{}")`);
    check("only the changed actions are stored", stored.jump?.[0] === "KeyC" && !("fire" in stored), JSON.stringify(stored));
    await ev(page, `document.getElementById("bindsReset").click()`);
    check("reset puts every key back", (await keysOf("Jump")).join(",") === "Space,Scroll up" && (await keysOf("Crouch, slide")).includes("C"), (await keysOf("Jump")).join(","));

    // pick the Close Quarters default: its weapons go in the slots
    await ev(page, `[...document.querySelectorAll("#loadoutList button")].find((b) => b.textContent.startsWith("Close Quarters")).click()`);
    const w = await ev<string[]>(page, "window.__range.loadout.slots.map((s) => s.weapon.id)");
    const def = await ev<string[]>(page, "[window.__range.loadouts.current.slot1, window.__range.loadouts.current.slot2]");
    check("choosing a loadout puts its weapons in the slots", w.join() === def.join() && def[0] !== def[1], `${w.join(",")} for ${def.join(",")}`);
    const locked = await ev<boolean>(page, `document.getElementById("slot0").disabled`);
    check("a default loadout cannot be edited", locked);
    // copy it into custom slot 2, rename it, change slot 1
    await ev(page, `(() => { document.getElementById("copyTarget").value = "1"; document.getElementById("copyLoadout").click(); })()`);
    await ev(page, `(() => { const n = document.getElementById("loadoutName"); n.value = "Test Kit"; n.dispatchEvent(new Event("change")); const s = document.getElementById("slot0"); s.value = "wingman"; s.dispatchEvent(new Event("change")); })()`);
    const w2 = await ev<string[]>(page, "window.__range.loadout.slots.map((s) => s.weapon.id)");
    check("an edited custom loadout applies at once", w2[0] === "wingman", w2.join(","));
    // reload: the choice and the edit are remembered (a "leave site?" prompt
    // would hang a reload; the game only asks while playing or in a match)
    await toMenu(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 60000 });
    const after = await ev<{ name: string; slot1: string; w: string }>(page, `({ name: window.__range.loadouts.current.name, slot1: window.__range.loadouts.current.slot1, w: window.__range.loadout.slots[0].weapon.id })`);
    check("after a reload the loadout and its edit are remembered", after.name === "Test Kit" && after.slot1 === "wingman" && after.w === "wingman", JSON.stringify(after));
    // the menu's The Run button puts you at the course start, facing the line
    await ev(page, `document.getElementById("goRun").click(); document.getElementById("startMode").click()`);
    const at = await ev<{ x: number; z: number; yaw: number }>(page, `({ x: window.__range.player.pos.x, z: window.__range.player.pos.z, yaw: window.__range.player.yaw })`);
    check("The Run button: at the course start facing the start line", Math.abs(at.x + 21.5) < 0.5 && Math.abs(at.z - 10.2) < 0.5 && at.yaw === 180, JSON.stringify(at));
    await ev(page, `document.getElementById("goRunAdvanced").click(); document.getElementById("startMode").click()`);
    const adv = await ev<{ x: number; z: number; yaw: number }>(page, `({ x: window.__range.player.pos.x, z: window.__range.player.pos.z, yaw: window.__range.player.yaw })`);
    check("The Run (Advanced) button: at the advanced course start", Math.abs(adv.x - 21.5) < 0.5 && Math.abs(adv.z - 10.2) < 0.5 && adv.yaw === 180, JSON.stringify(adv));
    // put the first default back for the 1v1 pages (SpeedKills' defaults have their own names)
    await ev(page, `document.querySelector("#loadoutList button").click()`);
    await page.close();
    }

    if (want("duel")) await section("duel", async () => {
      console.log("\n1v1 over the local transport (two tabs)");
      await duelTest(browser, "?net=local&norender" + LEGACY, "local");
      console.log("\nA friend's figure over a jittery connection");
      await jitterTest(browser, "?net=local&norender&jitter=60" + LEGACY);
      console.log("\nA friend's figure with state packets lost and out of order");
      await jitterTest(browser, "?net=local&norender&jitter=60&loss=0.15" + LEGACY, true);
      console.log("\nCustom rules");
      await rulesTest(browser, "?net=local&norender");
      console.log("\nA 1v1 on the Neon City before the host's collision boxes are in");
      await lateBoxesTest(browser);
      console.log("\nA code from a page of the other game");
      await crossGameTest(browser);
      console.log("\nThe site's broker asked for slowly");
      await brokerWaitTest(browser);
    });

    if (want("intro")) await section("intro", async () => {
      console.log("\nThe intro card: the name, the shot through the screen, and out of the way");
      await introTest(browser);
    });

    if (want("emote")) await section("emote", async () => {
      console.log("\nEmotes: yours, the camera, a step to end it, a 1v1's host's on the guest's screen");
      await emoteTest(browser, "?norender", "?net=local&norender");
    });

    if (want("invite")) await section("invite", async () => {
      console.log("\nInvite links");
      await inviteTest(browser, "?net=local&norender");
    });

    if (want("triple")) await section("triple", async () => {
      console.log("\n1v1v1 over the local transport (three tabs)");
      await tripleTest(browser, "?net=local&norender");
      // ?deltas=0 puts a page on the full packets exactly as a build from
      // before the delta packets would be: it announces nothing and reads
      // nothing else. The host has to relay between the two forms.
      console.log("\n1v1v1 with one guest on the full packets (?deltas=0, as an older build)");
      await tripleTest(browser, "?net=local&norender", "1v1v1 mixed", [{}, {}, { extra: "&deltas=0", want: "full" }]);
      console.log("\nHanding the host over in the lobby");
      await handoverTest(browser, "?net=local&norender");
    });

    if (want("bots")) await section("bots", async () => {
      console.log("\nArena, Bots");
      await botsTest(browser, "?norender" + LEGACY);
      console.log("\nBot tiers");
      await botTiersTest(browser, "?norender" + LEGACY);
      console.log("\nWhere you are being shot from");
      await damageDirTest(browser, "?norender");
    });

    if (want("pad")) await section("pad", async () => {
      console.log("\nController");
      await padTest(browser, "?norender" + LEGACY);
    });

    if (want("panel")) await section("panel", async () => {
      console.log("\nThe lobby");
      await lobbyPanelTest(browser);
    });
    if (want("hold")) await section("hold", async () => {
      console.log("\nHow a figure holds a gun");
      await holdTest(browser);
    });
    if (want("spray")) await section("spray", async () => {
      console.log("\nThe spray, against what the range draws of it");
      await sprayTest(browser);
    });
    if (want("ping")) await section("ping", async () => {
      console.log("\nA match at a real ping");
      await pingTest(browser, 30);
      await pingTest(browser, 60);
    });
    if (want("owner")) await section("owner", async () => {
      console.log("\nThe owner's list");
      await ownerTest(browser);
    });
    if (want("range")) await section("range", async () => {
      console.log("\nThe range's tooling");
      await rangeTest(browser, "?norender" + LEGACY);
    });
    if (want("br")) await section("br", async () => {
      console.log("\nBattle royale against bots");
      await brTest(browser, "?norender" + LEGACY);
      console.log("\nDoors");
      await doorTest(browser, "?norender" + LEGACY);
      console.log("\nThe vault");
      await vaultTest(browser, "?norender" + LEGACY);
    });

    if (want("loot")) await section("loot", async () => {
      console.log("\nBattle royale: landing with nothing, the loot");
      await brLootTest(browser, "?norender" + LEGACY);
    });

    if (want("ship")) await section("ship", async () => {
      console.log("\nThe dropship: the ride, the jump, the end of the line, the bots, the jumpmaster");
      await shipTest(browser, "?norender" + LEGACY, "?net=local&norender" + LEGACY);
    });

    if (want("console")) await section("console", async () => {
      console.log("\nRing Consoles: the scan, the circle after next, the squad");
      await consoleTest(browser, "?norender" + LEGACY, "?net=local&norender" + LEGACY);
    });

    if (want("gulag")) await section("gulag", async () => {
      console.log("\nThe Gulag: in, the fight, the way back, one trip, overtime, a squad mate");
      await gulagTest(browser, "?norender", "?net=local&norender");
    });

    if (want("finish")) await section("finish", async () => {
      console.log("\nThe finishing touches: toggles, per-optic ADS, the controller, inspect, the first draw, the tour");
      await finishTest(browser, "?norender" + LEGACY);
    });

    if (want("modes")) await section("modes", async () => {
      console.log("\nThe arena's modes: team deathmatch, free-for-all, Control (alone, against bots)");
      await modesTest(browser, "?norender");
      console.log("\nThe new arenas: the Vault, the Crossing, the Ringworks");
      await arenaMapsTest(browser, "?norender");
      console.log("\nA free-for-all with a friend (two tabs, the local transport)");
      await modesFriendsTest(browser, "?net=local&norender" + LEGACY);
      await modesSplitTest(browser, "?net=local&norender");
      await friendsModesTest(browser, "?net=local&norender");
      await lobbyTest(browser, "?net=local&norender");
      await lobbyShortTest(browser, "?net=local&norender");
    });

    if (want("hidden")) await section("hidden", async () => {
      console.log("\nA hidden host: the match runs on at 30 Hz from a worker, not at the background tab's one frame a second");
      await hiddenHostTest(browser, "?net=local&norender");
    });

    if (want("speedkills")) await section("speedkills", async () => {
      console.log("\nSpeedKills: the front door, the guns, fusion and the hacks");
      await speedkillsTest(browser);
      await speedkillsSlamTest(browser);
      await speedkillsDistrictHoldTest(browser);
    });
    // (the slam alone, named only: a rerun of the one check that failed, as a flaky one is rerun)
    if (ONLY.includes("skslam")) {
      console.log("\nSpeedKills: the slam, alone");
      await speedkillsSlamTest(browser);
    }

    // (the bought arms' frames alone, named only: the soldier section's longest part without the rest of it, on a page of
    // its own, for a change to a gun's hold; E2E_GUNS narrows it to those guns)
    if (ONLY.includes("skpack")) await section("skpack", async () => {
      console.log(`\nSpeedKills' bought arms: their frames alone${E2E_GUNS.length ? ` (${E2E_GUNS.join(", ")})` : ""}`);
      const page = await open(browser, "?game=speedkills");
      const ready = await page.waitForFunction("window.__range.loaded() && window.__range.paidGuns().ready && window.__range.soldierReady()", { polling: 250, timeout: 180000 }).then(() => true, () => false);
      check("skpack: the bought guns and arms load", ready);
      if (ready) await packFrames(page);
      await page.close();
    });

    if (want("soldier")) await section("soldier", async () => {
      console.log("\nSpeedKills' soldier: it renders, its hit volumes, bots' kits and the fallback");
      await soldierTest(browser);
      await heldTexTest(browser);
    });

    if (want("sklobby")) await section("sklobby", async () => {
      console.log("\nSpeedKills' lobby: the USSO and BOOG first; the group, from match to match with no new code");
      await skLoadoutTest(browser);
      await skGroupTest(browser);
      await skDefaultsTest(browser);
      await skOutlineTest(browser);
      await skIntroTest(browser);
    });

    if (want("skhunt")) await section("skhunt", async () => {
      console.log("\nSpeedKills: what the bug hunt of 2026-09-30 found (stuck bots, the silent loop, the body fetched twice)");
      await skHuntTest(browser);
    });

    if (want("skarmory")) await section("skarmory", async () => {
      console.log("\nSpeedKills' range armory: the ten guns and ten hacks on the back wall, taken and fused at their stands");
      await skArmoryTest(browser);
    });

    if (want("skfriends")) await section("skfriends", async () => {
      console.log("\nSpeedKills with friends: two friends into one battle royale");
      await brFriendsJoinTest(browser);
    });

    if (want("start")) await section("start", async () => {
      console.log("\nThe start screen: two ways in and More, and the hacks picked on a timer before play");
      await startScreenTest(browser);
    });

    if (want("skbots")) await section("skbots", async () => {
      console.log("\nSpeedKills' bots in a fight: a strafe that can be followed");
      await botStrafeTest(browser);
    });

    if (want("skfigure")) await section("skfigure", async () => {
      console.log("\nThe soldier as others see it, holding the USSO and BOOG, and its reload (Phase 27)");
      await figureHoldTest(browser);
    });

    if (want("sksquad")) await section("sksquad", async () => {
      console.log("\nThe squad you can see: a friend's number, colour, name, ring and every change of state (Phase 27)");
      await skSquadTest(browser);
    });

    if (want("skship")) await section("skship", async () => {
      console.log("\nSpeedKills' dropship, ridden: off the city, doors after five seconds, a landing in the city");
      await speedkillsShipTest(browser);
    });

    if (want("sktour")) await section("sktour", async () => {
      console.log("\nSpeedKills' tour: eight steps, each done for real in the range");
      await speedkillsTourTest(browser);
    });

    if (want("botsquads")) await section("botsquads", async () => {
      console.log("\nBot squads: a trio of bots keeps together");
      await botSquadsTest(browser, "?norender" + LEGACY);
    });

    if (want("brsolo")) await section("brsolo", async () => {
      console.log("\nSolo with a friend: everyone against everyone, each placed on their own");
      await brSoloTest(browser, "?net=local&norender" + LEGACY);
      console.log("\nSquads of friends: two duos against each other");
      await brSquadsTest(browser, "?net=local&norender" + LEGACY);
      console.log("\nGetting back in after a dropped connection");
      await rejoinTest(browser, "?net=local&norender");
    });

    if (want("migrate")) await section("migrate", async () => {
      console.log("\nHost migration: the host's tab crashes and a friend takes the match over");
      await migrateTest(browser, "?net=local&norender");
      console.log("\nHost migration in team deathmatch, with bots");
      await migrateTest(browser, "?net=local&norender", "host migration (tdm)", "tdm", 6);
      console.log("\nHost migration in Control, with bots");
      await migrateTest(browser, "?net=local&norender", "host migration (control)", "control", 3);
      console.log("\nHost migration in a battle royale");
      await brMigrateTest(browser, "?net=local&norender" + LEGACY);
    });

    if (want("squad")) await section("squad", async () => {
      console.log("\nBattle royale as a squad (two tabs, the local transport)");
      await brSquadTest(browser, "?net=local&norender" + LEGACY);
    });

    if (want("p2p")) await section("p2p", async () => {
      console.log("\n1v1 over peer to peer (the public broker)");
      const ran = await duelTest(browser, "?norender" + LEGACY, "p2p");
      if (!ran) console.log("  --  skipped: the broker or the internet was not reachable");
      else {
        console.log("\nGetting back in after a dropped connection, over peer to peer");
        await rejoinTest(browser, "?norender");
        console.log("\nHost migration, over peer to peer");
        await migrateTest(browser, "?norender", "host migration (p2p)");
        console.log("\nHanding the host over, over peer to peer");
        await handoverTest(browser, "?norender");
        console.log("\nVoice chat, over peer to peer");
        await voiceTest(browser, "?norender");
        console.log("\nThe broker gone for a moment in the middle of a Join, over peer to peer");
        for (const ms of [50, 300]) await brokerBlipTest(browser, "?norender", ms);
        console.log("\nThe group from match to match, over peer to peer (a welcome mid-match, packed the way PeerJS packs it)");
        await skGroupTest(browser, "?game=speedkills&norender");
      }
    });

    // An older build against this one, over the real peer to peer path:
    // OLD_URL is where the older build is served (a second dev server on an
    // older checkout, or the deployed site with ?broker=public, so both meet
    // on the public broker). Both ways round for the 1v1, and a 1v1v1 whose
    // host has to relay between the two. The deployed build has had the delta
    // packets since they shipped, so the two find each other and use them;
    // OLD_NET=full is for a build from before them, where both fall back to
    // the full packets.
    if (want("mixed")) await section("mixed", async () => {
      const OLD = process.env.OLD_URL;
      const oldNet: NetWant = process.env.OLD_NET === "full" ? "full" : "deltas";
      if (!OLD) console.log("\nAn older build and this one: skipped, set OLD_URL to an older build (and OLD_NET=full if it is from before the delta packets)");
      else {
        console.log(`\nAn older build (${OLD}, ${oldNet} packets) and this one, over peer to peer`);
        await duelTest(browser, "?norender", "old guest", [BASE, OLD], oldNet);
        await duelTest(browser, "?norender", "old host", [OLD, BASE], oldNet);
        await tripleTest(browser, "?norender", "1v1v1, an old guest", [{}, {}, { base: OLD, want: oldNet }]);
        await tripleTest(browser, "?norender", "1v1v1, an old host", [{ base: OLD, want: oldNet }, { want: oldNet }, { want: oldNet }]);
      }
    });

    check("no page errors anywhere", errors.length === 0, [...new Set(errors)].slice(0, 5).join(" | "));
  } finally {
    await browser.close();
  }
  console.log(fails === 0 ? "\nE2E PASS" : `\nE2E FAIL (${fails})`);
  process.exit(fails === 0 ? 0 : 1);
}

void main();
