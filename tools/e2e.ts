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
import neonSectorsCfg from "../src/config/neonmap.json";
import soldierCfg from "../src/config/soldier.json";
import { hipFov43, verticalFovFrom43 } from "../src/game/sens";
import vmCfgE2e from "../src/config/viewmodel.json";
import { HIT_POSES, MEASURE_HEADS } from "./soldier-hits";
import lodCfg from "../src/config/lod.json";
import soldierHoldCfg from "../src/config/soldierhold.json";
import figureCfg from "../src/config/figure.json";
import movementCfg from "../src/config/movement.json";
import puppeteer, { type Browser, type Page } from "puppeteer";
import brCfg from "../src/config/br.json";
import { decayRounds } from "../src/game/decay";
import netCfg from "../src/config/net.json";
/**
 * The longest a peer goes unheard by design: one standing still sends nothing until its next keyframe (net.json
 * keyframe, every 2 s give or take its spread), so "the two hear each other" is heard within that and a half second of
 * latency. The checks held it to 1.5 s, under the protocol's own interval, and failed whenever a bot stood still
 * (host migration's botFlow read 1.50 and 1.57 s, alone and in batches).
 */
const HEARD = netCfg.keyframe.seconds + netCfg.keyframe.spread + 0.5;
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
import startCfg from "../src/config/start.json";
import { readFileSync } from "node:fs";
import sharp from "sharp";

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
  // (a page named its game, E2E_GAME or the query's own, until Milestone 520: SpeedKills is the one game, on the Neon
  // City, its one city since the ILranch city before it went, 2026-10-09)
  // on the menu, as the checks of it expect: the start screen in front of it is startScreenTest's (src/ui/start.ts)
  const q = q0.includes("home=") ? q0 : `${q0}&nohome`;
  const url = base.includes("?") ? `${base}&${q.slice(1)}` : base + q;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 60000 });
  return page;
}

/** evaluate an expression string in the page (tsx mangles function sources) */
const ev = <T>(page: Page, expr: string) => page.evaluate(expr) as Promise<T>;

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
  // Start stood in for a click on Play, so the keys on screen stay the keyboard's: since Milestone 538 a pad's press
  // turns them to its buttons (a pad's own checks press it again)
  await ev(page, `window.__range.input.device = "keyboard"`);
}

/**
 * A 1v1 on the Neon City with the host's collision boxes still coming in (a slow phone, or a page opened a moment ago):
 * the match waits for them (main.ts boxesFirst), and what its friend sends meanwhile is kept for it. It was lost, and the
 * friend was told the host had left: a match counts the other end gone after 10 s of silence (duel.ts SILENCE_LIMIT), and
 * the host said nothing while it waited. The live check failed so on a busy machine (2026-10-04); 13 s here is past it.
 */
async function lateBoxesTest(browser: Browser): Promise<void> {
  const q = "?net=local&norender&map=neon";
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
/** a mode alone from the Play tab's button: in the game (the pad's Start), the fight on */
type HudBox = { x: number; y: number; w: number; h: number };
/**
 * Where the HUD drew its scoreboard against the keys panel and the kill feed's room (six lines down from where the feed
 * starts), the HUD drawn for the moment on a ?norender page (Milestone 722: the arena modes' board lay over the keys
 * panel a new player has up, and a 3+ duel's over the keys and the kill feed)
 */
async function boardPlace(page: Page): Promise<{ board: HudBox | null; keys: HudBox | null; feed: HudBox | null; clear: boolean }> {
  return ev(
    page,
    `new Promise((ok) => { const h = window.__range.hud; const was = h.enabled; h.enabled = true;
      setTimeout(() => { const b = h.placed; const u = innerHeight / 1080; const board = b.board ?? null, keys = b.keys ?? null, feed = b.feed ?? null;
        const room = feed && { x: feed.x - 420 * u, y: feed.y, w: 420 * u, h: 150 * u };
        const meet = (p, q) => !!p && !!q && p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
        h.enabled = was; ok({ board, keys, feed, clear: !!board && !meet(board, keys) && !meet(board, room) }); }, 400); })`,
  );
}

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
  // SpeedKills' own maps, the Neon ones (the owner, 2026-10-09: "2 1v1 maps, 1 centre destrict map, 1 br map, all new neon
  // stuff"): its two arenas from the picker, and "picked for the mode", a free-for-all on THE CENTRE
  const cases: Array<{ map: string; button: string; want: string; bots: string }> = [
    { map: "yard", button: "goFfa", want: "yard", bots: "3" },
    { map: "hall", button: "goControl", want: "hall", bots: "3" },
    { map: "auto", button: "goFfa", want: "centre", bots: "2" },
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
    // (THE CENTRE's spawns face its tower, across the ring road: open floor is the arenas' rule)
    if (r.id !== "centre") check(`maps: on ${r.id} you spawn facing open floor, not a box`, view >= 6, `${view.toFixed(1)} m clear ahead`);
    if (r.kind === "control") check(`maps: Control's three zones are on ${r.id}, not in the warehouse`, r.zones === 3 && r.zonesIn === 3, `${r.zonesIn} of ${r.zones}`);
    await page.close();
  }
  // the 1v1 against bots, alone, which is where a 1v1 on a small map is played
  // most: the same picker, NEON HALL
  const page = await startModePage(browser, query, "goBots", `document.getElementById("botCount").value = "1"; document.getElementById("arenaMap").value = "hall"`);
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
  check("maps: the 1v1 against a bot plays on NEON HALL when it is picked, you and the bot inside it", v.id === "hall" && v.me && v.bots === 1 && v.botsIn === 1, JSON.stringify(v));
  await page.close();
}

/**
 * A guest's rounds into a target as its gun would claim them: a shot the
 * host hears first, then BOOG rounds of 25 (the host's hit check refuses a
 * claim no round could make, one with no shot behind it, and in SpeedKills one
 * naming a gun off its roster: this named the legacy R-301 until Milestone 499).
 */
const guestRounds = (pick: string, n: number): string =>
  `(() => { const d = window.__range.duel(); const T = window.__range.THREE; const r = [...d.remotes.values()].find((x) => ${pick}); if (!r) return false; d.localShot(new T.Vector3(), new T.Vector3(0, 0, -1), "sentinel"); for (let i = 0; i < ${n}; i++) d.localHit(r, 25, true, "sentinel"); return true; })()`;

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
  // its scoreboard clear of the keys panel and the kill feed (Milestone 722): left of the keys on a wide screen; under
  // them on a narrow one, the feed then under the board
  const wideBoard = await boardPlace(t);
  await t.setViewport({ width: 600, height: 450, deviceScaleFactor: 1 });
  const narrowBoard = await boardPlace(t);
  await t.setViewport({ width: 800, height: 450, deviceScaleFactor: 1 });
  check(
    "tdm: the scoreboard clear of the keys panel and the kill feed: left of the keys on a wide screen, under them on a narrow one with the feed under it",
    wideBoard.clear && !!wideBoard.board && !!wideBoard.keys && wideBoard.board.x + wideBoard.board.w <= wideBoard.keys.x &&
      narrowBoard.clear && !!narrowBoard.board && !!narrowBoard.keys && !!narrowBoard.feed && narrowBoard.board.y >= narrowBoard.keys.y + narrowBoard.keys.h && narrowBoard.feed.y >= narrowBoard.board.y + narrowBoard.board.h,
    JSON.stringify({ wideBoard, narrowBoard }),
  );
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
  // the guest runs a circle at one speed, 6 m/s round 4 m, on open ground near the map's middle (its spawn on THE CENTRE
  // stood at the map's edge, and the circle slid along it): its place set each frame from its own clock, the clock its
  // states are stamped with. A run held on the keys was the legacy check's; SpeedKills sprints by itself and its own
  // speed, frame to frame, spread 0.35 over its mean before any network, which the check read as the network's
  const ring = await ev<{ x: number; z: number; found: boolean }>(
    guest,
    `(() => { const r = window.__range; const c = r.duel().center; const b = r.player.bounds; const m = 5.5;
      const inside = (x, z) => x - m > b.minX && x + m < b.maxX && z - m > b.minZ && z + m < b.maxZ && (!b.circle || Math.hypot(x - b.circle.x, z - b.circle.z) + m < b.circle.r);
      const clear = (x, z) => !r.solids.some((s) => s.base < 2 && s.top > 0.05 && x + m > s.minX && x - m < s.maxX && z + m > s.minZ && z - m < s.maxZ);
      for (let d = 0; d < 120; d += 2) for (let a = 0; a < 24; a++) { const x = c.x + Math.cos((a / 24) * Math.PI * 2) * d; const z = c.z + Math.sin((a / 24) * Math.PI * 2) * d;
        if (inside(x, z) && clear(x, z)) { r.player.teleport(x + 4, 0, z, 0, 0); return { x, z, found: true }; } if (d === 0) break; }
      // (none found: the middle itself, and the check's own spread says whether the run there was even)
      return { x: c.x, z: c.z, found: false }; })()`,
  );
  await sleep(600);
  await ev(guest, `(() => { const r = window.__range; const R = 4; const w = 1.5; const t0 = performance.now();
    r.setScript({ held: () => false, pressedNow: () => false }, () => { const t = (performance.now() - t0) / 1000; r.player.pos.set(${ring.x} + R * Math.cos(w * t), r.player.pos.y, ${ring.z} + R * Math.sin(w * t)); r.player.vel.set(0, 0, 0); r.player.yaw = (-w * t * 180) / Math.PI; }); })()`);
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
      JSON.stringify({ bySent, fast, ring })
    );
  } else
    check(
      "jitter: placed by when its states were sent, a friend running at one speed moves at one speed through 60 ms of jitter (and far more evenly than placed by arrival)",
      bySent.frames > 60 && bySent.mean > 3 && bySent.spread < 0.25 && bySent.spread < byArrival.spread * 0.6,
      JSON.stringify({ bySent, byArrival, ring })
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
  await ev(h2, `(() => { const d = window.__range.duel(); d.localHit(d.remotes.get(1), 30, false, "vinson"); })()`);
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
  await ev(host, `(() => { const d = window.__range.duel(); const r = d.remotes.get(1); d.localHit(r, 900, true, "vinson", 12); })()`);
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
  // the figure over the network: the guest aims down sights; the host's copy of the guest does it too
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
  // (a heal's item in the figure's hand was the legacy game's: SpeedKills heals with its HEAL hack, and its health
  // comes back on its own)
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
  // (one sky for the squad, the match's own from its seed, was the legacy game's: SpeedKills plays under each
  // player's own hour, main.ts brHour)
  check("squad: the fight starts on both when the host lands", landed[0] && landed[1]);
  await sleep(1500);
  const seen = await ev<{ figures: number; bots: number; humans: number }>(guest, `(() => { const d = window.__range.duel(); const rs = [...d.remotes.values()]; return { figures: d.avatars.filter((a) => a.group.visible).length, bots: rs.filter((r) => r.id >= 100).length, humans: rs.filter((r) => r.id < 100).length }; })()`);
  // (four in the legacy game's match of four bots; as many as fill SpeedKills' thirty)
  const hostBots = await ev<number>(host, "window.__range.duel().bots.length");
  check(`squad: the guest sees the host and the ${hostBots} bots the host runs`, seen.bots === hostBots && seen.humans === 1 && seen.figures >= 4, JSON.stringify(seen));
  // (a bot of a duo knocked with its mate up, down on the guest's screen and up once revived: SpeedKills has no knockdown)
  // a bot reloading on the host reloads on the guest's screen too, and from empty (act code 9): the host sent its bots'
  // place alone, so a guest's figures of them never reloaded, healed or aimed in
  const rel = await ev<number>(host, `(() => { const d = window.__range.duel(); const b = d.bots.find((x) => x.bot.alive && !x.bot.aboard && !x.down); if (!b) return -1; b.bot.mag.until = 1e12; return b.bot.remote.id; })()`);
  const relSeen = rel >= 0 && (await guest.waitForFunction(`(() => { const r = window.__range.duel().remotes.get(${rel}); const s = r?.samples[r.samples.length - 1]; return !!s && s.act === "reload" && s.reloadEmpty === true; })()`, { polling: 100, timeout: 4000 }).then(() => true, () => false));
  await ev(host, `(() => { const d = window.__range.duel(); const b = d.bots.find((x) => x.bot.remote.id === ${rel}); if (b) b.bot.mag.until = 0; })()`);
  check("squad: a bot reloading on the host is seen reloading from empty on the guest's screen", relSeen, JSON.stringify({ rel, relSeen }));
  // doors: the guest opens one (the host does it for everyone), the host shuts it, and a door the guest has wrong is put right
  // (on a map with doors: the Neon City's are drawn shut into its pieces, and the legacy map's were the ones that opened)
  const doorCount = await ev<number>(guest, "window.__range.brMap.doors.list.length");
  if (doorCount >= 2) {
    const doorI = await ev<number>(guest, `(() => { const r = window.__range; const me = r.player.pos; const ds = r.brMap.doors; const d = ds.list.filter((x) => !x.open).sort((a, b) => Math.hypot(a.centre.x - me.x, a.centre.z - me.z) - Math.hypot(b.centre.x - me.x, b.centre.z - me.z))[0]; r.player.teleport(d.centre.x, d.centre.y - 1.3, d.centre.z + (d.side === "s" ? 2 : d.side === "n" ? -2 : 0) + 0, 0, 0); if (d.side === "e") r.player.pos.x += 2; if (d.side === "w") r.player.pos.x -= 2; return d.i; })()`);
    await sleep(600);
    await ev(guest, `window.__range.duel().useDoor(${doorI}, true)`);
    const hostSawOpen = await host.waitForFunction(`window.__range.brMap.doors.list[${doorI}].open`, { polling: 100, timeout: 4000 }).then(() => true, () => false);
    await ev(host, `window.__range.duel().useDoor(${doorI}, false)`);
    const guestSawShut = await guest.waitForFunction(`!window.__range.brMap.doors.list[${doorI}].open`, { polling: 100, timeout: 4000 }).then(() => true, () => false);
    const wrong = await ev<number>(guest, `(() => { const ds = window.__range.brMap.doors; const d = ds.list.find((x) => !x.open && x.i !== ${doorI}); ds.set(d.i, true); return d.i; })()`);
    const putRight = await guest.waitForFunction(`!window.__range.brMap.doors.list[${wrong}].open`, { polling: 100, timeout: 3000 }).then(() => true, () => false);
    check("squad: doors: the guest opens one and the host sees it, the host shuts it and the guest sees that, and a door the guest had wrong is put right by the host", hostSawOpen && guestSawShut && putRight, JSON.stringify({ doorI, hostSawOpen, guestSawShut, wrong, putRight }));
  } else console.log(`  --  squad: doors: this map has ${doorCount}, so nothing to open`);
  // the guest takes out a bot: the hit goes to the host, the kill comes back to both
  const aliveBefore = await ev<number>(host, "window.__range.duel().hud().br.alive");
  await ev(guest, guestRounds("x.id >= 100 && x.alive", 12));
  await sleep(1200);
  const after = await Promise.all([host, guest].map((p) => ev<{ alive: number; kills: number; squads: number }>(p, "({ alive: window.__range.duel().hud().br.alive, kills: window.__range.duel().hud().br.kills, squads: window.__range.duel().hud().br.squads })")));
  // (fewer, not one fewer: SpeedKills' bots fight each other meanwhile)
  check("squad: the kill is the guest's, and both see the same fewer alive", after[1].kills === 1 && after[0].kills === 0 && after[0].alive < aliveBefore && after[1].alive === after[0].alive, JSON.stringify({ aliveBefore, after }));
  // a forged claim: more than one round of the gun can do, then a hit with no shot behind it; the host drops both
  const refusedBefore = await ev<number>(host, "window.__range.duel().hitCheck.refused.length");
  const target = await ev<{ id: number; hp: number } | null>(host, "(() => { const d = window.__range.duel(); const b = d.bots.find((x) => x.bot.alive && !x.down); return b ? { id: b.bot.remote.id, hp: b.bot.dummy.health + b.bot.dummy.shield } : null; })()");
  if (target) {
    await ev(guest, `(() => { const d = window.__range.duel(); const r = d.remotes.get(${target.id}); if (r) d.localHit(r, 900, true, "r97"); })()`);
    await sleep(3000);
    await ev(guest, `(() => { const d = window.__range.duel(); const r = d.remotes.get(${target.id}); if (r) d.localHit(r, 20, false, "sentinel"); })()`);
    await sleep(600);
  }
  const forged = await ev<{ refused: Array<{ why: string }>; hp: number }>(host, `(() => { const d = window.__range.duel(); const b = d.bots.find((x) => x.bot.remote.id === ${target?.id ?? -1}); return { refused: d.hitCheck.refused.slice(${refusedBefore}), hp: b ? b.bot.dummy.health + b.bot.dummy.shield : -1 }; })()`);
  check("squad: the host drops a forged hit (more than a round can do) and one with no shot behind it", !!target && forged.refused.length === 2 && /more than one round/.test(forged.refused[0].why) && /no shot/.test(forged.refused[1].why), JSON.stringify({ target, forged }));
  // the guest runs no bots: its squad count is the host's, off the ring packet
  check("squad: the guest counts the squads still in it the way the host does", after[0].squads > 1 && after[1].squads === after[0].squads, JSON.stringify(after.map((a) => a.squads)));
  // a squad mate under INVISIBILITY stays whole to their own squad (Milestone 723: past seenWithin they were hidden from
  // it, their mate's ring with them, once Milestone 715 made the hiding work)
  const mateCloak = await ev<{ ally: boolean; visible: boolean; on: number } | null>(
    host,
    `new Promise((ok) => { const R = window.__range; const d = R.duel(); const a = d.avatars.find((x) => d.remoteOf(x)?.id === 1);
      if (!a) return ok(null); const q = a.group.position; const me = R.player.pos.clone();
      R.sk.remoteHack(1, 5, q.x, q.y, q.z, 30); R.player.teleport(q.x + 15, q.y, q.z, 90, 0);
      setTimeout(() => { const s = a.cloakState(); const out = { ally: d.isAlly(1), visible: a.group.visible, on: s ? s.on : 0 };
        R.sk.remoteHack(1, 5, q.x, q.y, q.z, 0); R.player.teleport(me.x, me.y, me.z, 0, 0); ok(out); }, 600); })`,
  );
  check("squad: a squad mate under INVISIBILITY stays whole to their own squad, no shimmer", !!mateCloak && mateCloak.ally && mateCloak.visible && mateCloak.on === 0, JSON.stringify(mateCloak));
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
    const wheel = await ev<{ open: boolean; items: number; icons: number; pick: number | null }>(
      guest,
      `(() => { const w = window.__range.hud.last?.pingWheel ?? null; return { open: !!w, items: w ? w.items.length : 0, icons: w?.icons ? w.icons.filter(Boolean).length : 0, pick: w ? w.pick : null }; })()`
    );
    await guest.mouse.up({ button: "middle" });
    await sleep(150);
    // (each slice with its picture since Milestone 720)
    check("squad: holding the ping key opens the wheel of what a mark means, each with its picture", wheel.open && wheel.items === 6 && wheel.icons === 6, JSON.stringify(wheel));
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
  // (the legacy game's own were checked from here: the ring's tick outside it, a guest down and bleeding out, crawling
  // with no gun, the knockdown shield, the revive, the second knock, the echo restored after a finish, the gold shield's
  // self-revive, the care package, the loadout crate and Storm Surge, and solo with a friend. SpeedKills has no
  // knockdown, decays its city instead of a ring, and its echo restore with a friend is speedkillsGhostTest's; solo with a
  // friend is brSoloTest's)
  // out for what follows: the guest a ghost while the host is up
  await ev(host, "window.__range.duel().holdFire = true");
  await ev(guest, `(() => { const d = window.__range.duel(); d.takeHit(500, 100); })()`);
  await sleep(800);
  const gk = await ev<{ active: boolean; killer: string }>(guest, "window.__range.killcamState()");
  check("squad: the guest's killcam is the bot that got them (a bot the host runs)", gk.active && /^BOT /.test(gk.killer), JSON.stringify(gk));
  // the host goes too: nobody of the squad left up, so the squad is out, last of the squads still in
  const squadsIn = await ev<number>(host, "window.__range.duel().hud().br.squads");
  await ev(host, `(() => { const d = window.__range.duel(); d.takeHit(500, 100); })()`);
  await sleep(1200);
  const ends = await Promise.all([host, guest].map((p) => ev<{ phase: string; placement: number | null; of: number }>(p, "({ phase: window.__range.duel()?.phase, placement: window.__range.duel()?.hud().br.placement, of: window.__range.duel()?.hud().br.squadsTotal })")));
  check(`squad: with the last of the squad out both see the placement, last of the ${squadsIn} squads still in`, ends.every((e) => e.phase === "matchEnd" && e.placement === squadsIn && e.of >= squadsIn), JSON.stringify({ squadsIn, ends }));
  await ev(host, "window.__range.duel()?.leave()");
  await Promise.all([host, guest].map((p) => p.waitForFunction("window.__range.duel() === null", { polling: 200, timeout: 15000 }).catch(() => undefined)));
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
 * The guest's own soldier (src/game/soldier.ts soldierCode): the third variant, in palette colours nobody is given
 * by default, so a host that draws it is drawing the guest's choice off the wire and not its own guess.
 */
const WORN_CODE = "S2111110";
const WORN_SOLDIER = `localStorage.setItem("range.sk.soldier", "${WORN_CODE}")`;
const WORN_VARIANT = Object.keys(soldierCfg.variants)[2];

async function duelTest(browser: Browser, query: string, label: string, bases: [string, string] = [BASE, BASE], want: NetWant = "deltas"): Promise<boolean> {
  const host = await open(browser, query, bases[0]);
  // (this browser's own soldier, put back at the end: every page after this one shares the storage)
  const keptSoldier = await ev<string | null>(host, `localStorage.getItem("range.sk.soldier")`);
  const guest = await open(browser, query, bases[1], WORN_SOLDIER);
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

  // each sees the other at the other's spawn (the match's own: the arena it was made on)
  await sleep(1500);
  const seen = await ev<{ x: number; z: number; visible: boolean; at: { x: number; z: number } }>(
    host,
    `(() => { const d = window.__range.duel(); const g = d.avatars[0].group; return { x: g.position.x, z: g.position.z, visible: g.visible, at: { x: d.spawns[1].x, z: d.spawns[1].z } }; })()`
  );
  check(`${label}: the host sees the guest at the guest spawn`, seen.visible && Math.hypot(seen.x - seen.at.x, seen.z - seen.at.z) < 0.5, `${seen.x.toFixed(1)}, ${seen.z.toFixed(1)} against ${seen.at.x.toFixed(1)}, ${seen.at.z.toFixed(1)}`);
  const seen2 = await ev<{ x: number; z: number; at: { x: number; z: number } }>(
    guest,
    `(() => { const d = window.__range.duel(); const g = d.avatars[0].group; return { x: g.position.x, z: g.position.z, at: { x: d.spawns[0].x, z: d.spawns[0].z } }; })()`
  );
  check(`${label}: and the guest sees the host at the host spawn`, Math.hypot(seen2.x - seen2.at.x, seen2.z - seen2.at.z) < 0.5, `${seen2.x.toFixed(1)}, ${seen2.z.toFixed(1)} against ${seen2.at.x.toFixed(1)}, ${seen2.at.z.toFixed(1)}`);

  // The guest's soldier crosses the wire as its look's code, so the host draws the variant and the colours the guest
  // chose. An older build on either side may not send it, which is why the check runs only when both sides are this
  // build; asked of THIS build only (an older one has no such handle, and in a mixed run the page doing the looking can
  // be the older one).
  if (bases[0] === BASE && bases[1] === BASE) {
    // (what the host has for the guest's look: its fifth field the soldier's code, outfit.ts lookCode; a page drawing
    // nothing, as these are, makes no figure to wear it, so the code is what is checked)
    const look = await host
      .waitForFunction(`window.__range.duel().remotes.get(1)?.avatarLook?.split("|")[4] ?? null`, { polling: 200, timeout: 15000 })
      .then((h) => h.jsonValue() as Promise<string>, () => null);
    check(`${label}: the host has the guest's own soldier (${WORN_VARIANT}, ${WORN_CODE}), off the wire`, look === WORN_CODE, String(look));
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

  // a hit of the shield less 25 comes off the guest's shield first, and leaves its health alone
  const full = await ev<number>(guest, "window.__range.duel().shieldMax");
  await ev(host, `(() => { const d = window.__range.duel(); d.localHit(d.remoteOf(d.avatars[0]), ${full - 25}, false); })()`);
  await guest.waitForFunction(`window.__range.duel().shield < ${full}`, { polling: 200, timeout: 10000 });
  const g1 = await ev<{ sh: number; hp: number }>(guest, "({ sh: window.__range.duel().shield, hp: window.__range.duel().health })");
  check(`${label}: a hit of ${full - 25} takes the guest's shield ${full} to 25, health untouched`, g1.sh === 25 && g1.hp === 100, `shield ${g1.sh} health ${g1.hp}`);

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
  check(`${label}: round 2 restores the guest to ${full} shield and 100 health`, g2.sh === full && g2.hp === 100, `shield ${g2.sh} health ${g2.hp}`);

  // The circle: stand in it alone once it is live (20 s into the round) for
  // 10 s and the round is yours. Only on the local transport, it takes 30 s.
  if (label === "local") {
    await host.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 20000 });
    const fightAt = Date.now();
    // (in the middle of the match's own circle, on the arena it was made on)
    await ev(host, `(() => { const r = window.__range; const c = r.duel().center; r.player.teleport(c.x, 0, c.z, 180); })()`);
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
  // (any packet heard since the reload began, not only the newest: in two loaded sweeps, 2026-10-19 and 10-23, the newest
  // sample at each look never carried it, both reloads read as nothing, and each passed run alone)
  // (and in the 2026-10-27 sweep nothing arrived at all, a third loaded sweep running, passing alone: so the guest's
  // reload is now made sure of, tried again while its gun will not reload, and a miss says what each page saw)
  const reloadSeen = async (clip: string): Promise<{ act: string | null; empty: boolean | null; why?: unknown }> => {
    const since = await ev<number>(host, "(() => { const r = window.__range.duel().remotes.get(1); return r?.samples[r.samples.length - 1]?.at ?? -Infinity; })()");
    let began: { reloading: boolean; noAmmo: boolean; tries: number } = { reloading: false, noAmmo: false, tries: 0 };
    for (let i = 1; i <= 5 && !began.reloading; i++) {
      await guest.waitForFunction("!window.__range.loadout.active.state.reloading", { polling: 100, timeout: 8000 }).catch(() => undefined);
      began = await ev(guest, `(() => { const r = window.__range; const s = r.loadout.active.state; s.clip = ${clip}; s.startReload(r.gameTime()); return { reloading: !!s.reloading, noAmmo: !!s.noAmmo, tries: ${i} }; })()`);
      if (!began.reloading) await sleep(300);
    }
    const got = await host
      .waitForFunction(`(() => { const r = window.__range.duel().remotes.get(1); const s = r?.samples.find((x) => x.at > ${since} && x.act === "reload"); return s ? { act: s.act, empty: !!s.reloadEmpty } : null; })()`, { polling: 50, timeout: 10000 })
      .then((h) => h.jsonValue() as Promise<{ act: string; empty: boolean }>, () => null);
    if (got) {
      await guest.waitForFunction("!window.__range.loadout.active.state.reloading", { polling: 100, timeout: 8000 }).catch(() => undefined);
      return got;
    }
    const why = {
      began,
      guest: await ev(guest, "(() => { const d = window.__range.duel(); return { phase: d?.phase ?? null, alive: d?.alive ?? null, reloading: !!window.__range.loadout.active.state.reloading }; })()"),
      host: await ev(host, `(() => { const d = window.__range.duel(); const r = d?.remotes.get(1); const n = r?.samples ?? []; return { phase: d?.phase ?? null, samples: n.length, newer: n.filter((x) => x.at > ${since}).length, acts: [...new Set(n.map((x) => x.act))] }; })()`),
    };
    return { act: null, empty: null, why };
  };
  const fromEmpty = await reloadSeen("0");
  const tactical = await reloadSeen("Math.max(1, Math.floor(s.clip / 2))");
  check(`${label}: a reload from empty is seen as one on the other screen, and one with rounds left as the tactical one`, fromEmpty.act === "reload" && fromEmpty.empty === true && tactical.act === "reload" && tactical.empty === false, JSON.stringify({ fromEmpty, tactical }));

  // leaving tells the other side
  await ev(guest, "window.__range.duel().leave()");
  await host.waitForFunction("window.__range.duel() === null", { polling: 200, timeout: 15000 });
  check(`${label}: leaving ends the match on the other side`, true);
  await ev(host, `(() => { const k = ${JSON.stringify(keptSoldier)}; if (k === null) localStorage.removeItem("range.sk.soldier"); else localStorage.setItem("range.sk.soldier", k); })()`);
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
  // (three and more play on THE CENTRE since the Triangle went, Milestone 533)
  const onMap = await ev<string>(host, "window.__range.duel().arenaId");
  check(`${tag}: three different spawns on THE CENTRE`, onMap === "centre" && distinct === 3, JSON.stringify({ map: onMap, spawns: spawns.map((sp) => [+sp.x.toFixed(1), +sp.z.toFixed(1)]) }));
  // The relay moves figures, whatever form each guest reads it in: guest 2
  // steps toward the middle and guest 1 sees it there, then the other way
  // round. With one guest on the full packets this is the host turning one
  // guest's delta packets into the other's full ones, and back.
  for (const [mover, watcher, id] of [
    [g2, g1, 2],
    [g1, g2, 1],
  ] as const) {
    const to = await ev<{ x: number; z: number }>(mover, `(() => { const p = window.__range.player; const b = window.__range.duel().arenaBounds; const cx = b.circle ? b.circle.x : (b.minX + b.maxX) / 2, cz = b.circle ? b.circle.z : (b.minZ + b.maxZ) / 2; const dx = cx - p.pos.x, dz = cz - p.pos.z, d = Math.hypot(dx, dz) || 1; p.teleport(p.pos.x + (dx / d) * 4, p.pos.y, p.pos.z + (dz / d) * 4, p.yaw); return { x: p.pos.x, z: p.pos.z }; })()`);
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
  // the three's scoreboard clear of the keys panel and the kill feed (Milestone 722: it sat where the feed starts)
  if (tag === "1v1v1") {
    const placed = await boardPlace(host);
    check(`${tag}: the scoreboard clear of the keys panel and the kill feed`, placed.clear, JSON.stringify(placed));
  }
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
  // (a fresh page loads NEON YARD's pieces before the match starts: 15 s was the legacy arena's, built at once)
  await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 45000 });
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
  check("tiers: the elite bot crouches while it fires", crouched, crouched ? "" : JSON.stringify({ ...(await ev<object>(page, `(() => { const b = window.__range.duel().bots[0]; const p = window.__range.player.pos; const y = b.dummy.group.rotation.y; const dx = p.x - b.pos.x, dz = p.z - b.pos.z; return { sees: b.sees(p), seenAgo: b.lastSeen ? +(performance.now() / 1000 - b.lastSeen.at).toFixed(1) : null, facingDeg: Math.round(Math.acos(Math.max(-1, Math.min(1, (Math.sin(y) * dx + Math.cos(y) * dz) / Math.hypot(dx, dz)))) * 180 / Math.PI), d: +Math.hypot(dx, dz).toFixed(1), cover: !!b.cover }; })()`)), where: await where(), carried }));
  const dodge = await ev<boolean>(page, `(() => { const b = window.__range.duel().bots[0]; const before = b.strafeSign; b.dummy.hit(0, "body", 5, 1, 1, b.pos.clone().setY(1.2)); return new Promise((r) => setTimeout(() => r(b.strafeSign !== before), 400)); })()`);
  check("tiers: hit, it reverses its strafe (hard and elite always dodge)", dodge);
  // low: it finds cover out of your sight and heals there
  await ev(page, `(() => { const b = window.__range.duel().bots[0]; b.diff = { ...b.diff, keep: 6 }; b.dummy.shield = 0; b.dummy.health = 30; })()`);
  const covered = await page.waitForFunction("!!window.__range.duel().bots[0].cover", { polling: 100, timeout: 6000 }).then(() => true, () => false);
  check("tiers: low, it picks a spot out of your sight", covered, covered ? "" : JSON.stringify({ where: await where(), carried }));
  const healed = await page.waitForFunction("(() => { const b = window.__range.duel().bots[0]; return b.dummy.health + b.dummy.shield > 30; })()", { polling: 100, timeout: 12000 }).then(() => true, () => false);
  const hidden = await ev<boolean>(page, "(() => { const b = window.__range.duel().bots[0]; return !b.sees(window.__range.player.pos); })()");
  // (out of your sight was the legacy game's heal, an item behind cover; a SpeedKills bot heals with its HEAL hack, an
  // area, where it stands)
  check("tiers: and heals", healed, JSON.stringify({ healed, hidden }));
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
  // (the match starts once its Neon map is in: NEON YARD's pieces load first, where the legacy arena's were built at once)
  await page.waitForFunction("window.__range.duel() !== null", { polling: 100, timeout: 45000 }).catch(() => undefined);
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
  // (the spin check reads the legacy mannequin's spine_03; SpeedKills' figure is the soldier, whose rig is skfigure's)
  else console.log("  --  figures: the spin check needs the mannequin's spine_03; the figure here is the soldier (skfigure's)");
  await page.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 15000 });
  // the bot hunts you down the middle lane and shoots: the shield drops. From the inside of the lane wall at x 94, which
  // ends in the 1.4 m box of the mantle chain with its step crate 0.2 m off: a bot that came in there walked into the
  // box for the whole match, its detour back up the lane leading it straight back in (2026-10-01, three runs of five).
  // Now each detour from the same pocket is twice the last (bots.json wedge), out in about 19 s of the game's time:
  // waited for on the game's clock, 35 s of it, as the recap's below (a loaded machine runs it at a third of real time)
  // (you where it can see you, clear of the cover: the lane at x 94 was the legacy warehouse's, and in SpeedKills' arena
  // a bot at the middle and you at your spawn stood 24 m apart with cover between, neither seeing the other)
  const start = await ev<{ x: number; z: number; full: number; placed: boolean }>(
    page,
    `(() => { const R = window.__range; const b = R.duel().bots[0]; const V = R.THREE.Vector3;
      const boxed = (x, z) => R.solids.some((s) => s.base < 1.8 && s.top > 0.3 && x > s.minX - 0.6 && x < s.maxX + 0.6 && z > s.minZ - 0.6 && z < s.maxZ + 0.6);
      let placed = false;
      for (const r of [12, 16, 8, 6]) for (let i = 0; i < 16 && !placed; i++) {
        const a = (i / 16) * Math.PI * 2; const p = new V(b.pos.x + Math.cos(a) * r, b.pos.y, b.pos.z + Math.sin(a) * r);
        if (boxed(p.x, p.z) || !b.sees(p)) continue;
        R.player.teleport(p.x, p.y, p.z, 0, 0); placed = true;
      }
      return { x: b.pos.x, z: b.pos.z, full: R.duel().shieldMax, placed }; })()`,
  );
  const shot = await ev<boolean>(
    page,
    `new Promise((ok) => { const R = window.__range; const g0 = R.gameTime(); const t0 = performance.now();
      const step = () => { if (R.duel().shield < ${start.full}) return ok(true); if (R.gameTime() - g0 > 35 || performance.now() - t0 > 150000) return ok(false); setTimeout(step, 100); };
      step(); })`,
  );
  const pos = await ev<{ x: number; z: number; sh: number }>(page, "(() => { const b = window.__range.duel().avatars[0].group.position; return { x: b.x, z: b.z, sh: window.__range.duel().shield }; })()");
  check("bots: the bot closes in and lands a shot", shot, `bot at ${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}, your shield ${pos.sh}` + (shot ? "" : " " + JSON.stringify(await ev(page, `(() => { const d = window.__range.duel(); const b = d.bots[0]; const pl = window.__range.player.pos; return { y: b.pos.y, you: [pl.x.toFixed(1), pl.z.toFixed(1)], sees: b.sees(pl), crouch: b.crouching, cover: !!b.cover, heard: !!b.heard, seen: b.lastSeen && [b.lastSeen.pos.x.toFixed(1), b.lastSeen.pos.z.toFixed(1)], slideDir: b.slideDir, joltLeft: b.joltLeft }; })()`))));
  const off = await ev<number>(page, `(() => { const b = window.__range.duel().bots[0]; return Math.hypot(b.pos.x - ${start.x}, b.pos.z - ${start.z}); })()`);
  check("bots: it fights on the move, off where it stood when it saw you", off > 1, `${off.toFixed(1)} m${start.placed ? "" : " (no spot in its sight was found)"}`);
  const snd = await ev<{ played: number; voices: number }>(page, "({ played: window.__range.audio.played, voices: window.__range.audio.voiceCount })");
  check("sound: the fight is heard (its shots and footsteps), under the voice cap", snd.played > 5 && snd.voices <= 56, JSON.stringify(snd));
  // the recorded CC0 samples (npm run sounds) load and are layered in (a checkout without them is the synthesis alone)
  const rec = await ev<{ loaded: number; played: number; files: boolean }>(page, "(async () => { const a = window.__range.audio; a.land(1, 'concrete'); a.punch(null); return { loaded: a.sampleCount, played: a.samplesPlayed, files: (await fetch('audio/kenney/index.json')).ok }; })()");
  // no pass for a missing file: a release without `npm run sounds` would ship the synthesis (docs/TEST_AUDIT.md)
  check("sound: the recorded samples are loaded and layered into the fight's sounds", rec.files && rec.loaded >= 10 && rec.played > 0, JSON.stringify(rec));
  // recorded gunshots (npm run guns): every class has near and far takes, and a shot plays one
  const guns = await ev<{ files: boolean; classes: string[]; missing: string[]; before: number; after: number }>(page, `(async () => { const a = window.__range.audio; const files = (await fetch("audio/guns/index.json")).ok; const classes = ["pistol", "smg", "rifle", "lmg", "marksman", "sniper", "shotgun"]; const missing = classes.flatMap((c) => [\`shot_\${c}\`, \`shot_\${c}_far\`]).filter((n) => !a.samples.has(n)); const before = a.samplesPlayed; a.gun("vinson"); return { files, classes, missing, before, after: a.samplesPlayed }; })()`);
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
  const killer = await ev<{ name: string; gun: string; full: number }>(page, "(() => { const d = window.__range.duel(); const b = d.bots[0]; return { name: d.nameFor(b.remote.id), gun: b.weapon.id, full: b.dummy.shieldMax }; })()");
  // your two hits on it first (a head and a body, 12 m), then almost nothing left for its next round to take.
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
  check(`killcam: it starts, from the bot's eyes (${killer.name}), with its gun (${killer.gun})`, kc.active && kc.killer === killer.name && kc.weapon === killer.gun, JSON.stringify(kc));
  const kcView = await ev<{ gun: boolean; hands: boolean }>(page, "window.__range.vmState()");
  check("killcam: the killer's gun is in view (not your empty hands)", kcView.gun, JSON.stringify(kcView));
  // The killer was aiming when they killed you, so the replay holds the gun
  // aimed. Sampled ACROSS the whole replay, not its first frames: it starts four
  // seconds before the kill, where the bot has often not seen you yet, and a
  // SpeedKills bot that sees you kills you in about a second.
  const kcAds = await ev<{ killer: number; gun: number; progress: number }>(
    page,
    `(() => new Promise((res) => {
      let killer = 0;
      let gun = 0;
      let progress = 0;
      let n = 0;
      const t = setInterval(() => {
        const s = window.__range.killcamState();
        if (s.active) progress = Math.max(progress, s.progress);
        killer = Math.max(killer, window.__range.killcamAds());
        gun = Math.max(gun, window.__range.vmState().ads);
        if (++n >= 50 || !s.active) { clearInterval(t); res({ killer, gun, progress }); }
      }, 120);
    }))()`
  );
  check("killcam: it scopes in as your killer did, not from the hip", kcAds.killer > 0.5 && kcAds.gun > 0.4, `the killer's aim reached ${kcAds.killer.toFixed(2)}, the gun in view ${kcAds.gun.toFixed(2)}`);
  check("killcam: the recording holds seconds of the match", kc.frames > 60 && kc.span > 2, JSON.stringify(kc));
  check("killcam: it plays on", kcAds.progress > 0.2, `${(kcAds.progress * 100).toFixed(0)}% of it played`);
  await ev(page, "window.__range.skipKillcam()");
  const rc = await ev<{ killerName: string; rows: Array<{ name: string; killer: boolean; dealt: { damage: number; hits: number; heads: number }; taken: { damage: number; hits: number }; guns: Array<{ name: string; near: number | null }>; left: { shield: number; health: number } | null }> } | null>(page, "window.__range.recap()");
  const row = rc?.rows[0];
  check("recap: eliminated by the bot, the killer first", rc?.killerName === killer.name && row?.killer === true, JSON.stringify(rc?.killerName));
  check("recap: your side: 35 in 2 hits, 1 head", row?.dealt.damage === 35 && row.dealt.hits === 2 && row.dealt.heads === 1, JSON.stringify(row?.dealt));
  check("recap: its side: the damage and hits it landed", !!row && row.taken.damage > 0 && row.taken.hits > 0, JSON.stringify(row?.taken));
  const gunName = (skCfg.weapons as Record<string, { name: string }>)[killer.gun]?.name ?? killer.gun;
  check(`recap: its gun (${gunName}) and the distance`, !!row && row.guns.length > 0 && row.guns[0].name.toUpperCase().includes(gunName.toUpperCase()) && (row.guns[0].near ?? 0) > 1, JSON.stringify(row?.guns));
  check(`recap: what it had left (${killer.full} + 100 less your 35)`, !!row?.left && row.left.shield + row.left.health === killer.full + 100 - 35, JSON.stringify(row?.left));
  await ev(page, "window.__range.closeRecap()");

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
 * flourish.
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
  // (DEVINOS wears the 3x, its fixed optic: SpeedKills fits none)
  await ev(page, `(() => { const i = document.getElementById("opticAds3x"); i.value = "0.5"; i.dispatchEvent(new Event("input")); const l = window.__range.loadout; l.setWeaponId(l.activeIndex, "launcher"); })()`);
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
    // (on open ground: SpeedKills' range has its armory where the legacy one's floor was clear)
    await ev(page, `(() => { const r = window.__range; r.input.locked = true; const o = r.openGround(0, 20, 8) ?? { x: 0, z: 20 }; r.player.teleport(o.x, 0, o.z, 0); })()`);
    const before = await ev<{ yaw: number; pitch: number }>(page, `(() => { const s = window.__range.feelState(); return { yaw: s.yaw, pitch: s.pitch }; })()`);
    await ev(page, `(() => { window.__lean = 0; window.__leanT = setInterval(() => { window.__lean = Math.max(window.__lean, Math.abs(window.__range.feelState().lean)); }, 25); return true; })()`);
    // forward and right, up to speed, then a crouch into a slide carrying you to the right: through the game's own input
    // (SpeedKills sprints by itself, so the Shift a keyboard run held turned its sprint off)
    await ev(page, `(() => { const r = window.__range; const t0 = performance.now(); let crouched = false;
      r.setScript({ held: (a) => a === "forward" || a === "right" || (a === "crouch" && performance.now() - t0 > 700 && performance.now() - t0 < 1200),
        pressedNow: (a) => { if (a !== "crouch" || crouched || performance.now() - t0 < 700) return false; crouched = true; return true; } }); })()`);
    await sleep(1200);
    await ev(page, "window.__range.setScript(null)");
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
  // (the spray wall was checked here: a burst from its yellow mark, 20 m off. In SpeedKills both stand 40 m past the
  // sandbox's edge (range.json sandbox edgeZ -24, Phase 20 A12), where no player can reach the mark: the owner's call
  // where it goes, 2026-10-09)
  // a burst into the sky, so this session has shots to keep and the HUD no damage numbers left for the checks after
  await ev(page, "(() => { const p = window.__range.player; p.teleport(0, 0, -20, 0, 0); p.pitch = 60; })()");
  await ev(page, "window.__pad.buttons[7].pressed = true; window.__pad.buttons[7].value = 1;");
  await sleep(700);
  await ev(page, "window.__pad.buttons[7].pressed = false; window.__pad.buttons[7].value = 0;");
  await sleep(300);
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
  // The range's targets (the owner, 2026-10-12: the soldier or a bullseye board, never our robot): the figures made with
  // the page, before the soldier was ready, put it on when it is (dummy.ts dress), and the drill's target is a board
  const soldierIn = await page.waitForFunction("window.__range.soldierReady()", { polling: 250, timeout: 120000 }).then(() => true, () => false);
  await sleep(500);
  const worn = await ev<{ figures: number; soldiers: number; board: boolean; drillFigure: boolean }>(
    page,
    "(() => { const r = window.__range; const ds = r.dummies; return { figures: ds.length, soldiers: ds.filter((d) => !!d.figure?.soldier).length, board: !!r.drill.target.group.getObjectByName('board'), drillFigure: !!r.drill.target.figure }; })()",
  );
  check("range: its figures, made before the soldier was in, wear it once it is, and the drill's target is a bullseye board", soldierIn && worn.figures >= 6 && worn.soldiers === worn.figures && worn.board && !worn.drillFigure, JSON.stringify(worn));
  // a REVEAL or a threat optic (main.ts, setThreat): our robot's shell was all that lit, so on the soldier nothing showed
  const glow = await ev<{ on: number[]; off: number[] }>(
    page,
    "(() => { const d = window.__range.dummies[0]; const read = () => { let e = 0, c = 0; d.figure.root.traverse((o) => { if (o.isSkinnedMesh) { e = Math.max(e, o.material.emissive.r); c = Math.max(c, o.material.color.r); } }); return [e, c]; }; d.setThreat(1); const on = read(); d.setThreat(0); return { on, off: read() }; })()",
  );
  check("range: a REVEAL or a threat optic lights the soldier red over its colours darkened, and it goes again", glow.on[0] > 0.8 && glow.on[1] < 0.15 && glow.off[0] < 0.1 && glow.off[1] > 0.3, JSON.stringify(glow));
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
  // Milestone 691: a street of the Neon City, open to the sky: no canopy over the stands (dropped from 7.2 m there, you
  // land on the street), and the walls' colliders over the street's tallest building, so a LEAP's 16 m does not clear
  // them; and the range takes a share of the sky's environment light, its wet asphalt kept from a blaze
  await ev(page, "window.__range.player.teleport(0, 7.2, 5, 0, 0)");
  await gameSleep(page, 1.5);
  const sky = await ev<{ y: number; ground: boolean; wallTop: number }>(page, "(() => { const r = window.__range; const sides = r.solids.filter((s) => s.minX >= 33 && s.maxX <= 35 && s.maxZ - s.minZ > 100); return { y: r.player.pos.y, ground: r.player.onGround, wallTop: Math.max(0, ...sides.map((s) => s.top)) }; })()");
  check("range: open to the sky over the stands, no canopy to stand on, and its side wall holds 60 m up", sky.ground && sky.y < 0.1 && sky.wallTop >= 60, JSON.stringify(sky));
  const env = await ev<{ env: number; hour: number }>(page, "({ env: window.__range.scene.environmentIntensity, hour: window.__range.sky.hourEnv })");
  check("range: its environment light a third of the hour's (RANGE_ENV_SHARE)", Math.abs(env.env - env.hour * 0.3) < 1e-6, JSON.stringify(env));
  // Milestone 692: the street's lamps along both kerbs, each post a collider as tall as the lamp drawn, so none is walked
  // through (rangedress.json lamps; the bake checks the lamp's height against the piece)
  const posts = await ev<number>(page, "window.__range.solids.filter((s) => Math.abs(Math.abs((s.minX + s.maxX) / 2) - 12.9) < 0.01 && Math.abs(s.maxX - s.minX - 0.6) < 0.01 && Math.abs(s.top - 5.68) < 0.01).length");
  check("range: the street's 14 lamps each stand a post you cannot walk through, the lamp's height", posts === 14, `${posts}`);
  await ev(page, "window.__range.player.teleport(0, 0, 0, 0, 0)");
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
 * most bent wrist and most wrung forearm, degrees, the most an arm falls short, m, and (a flourish's) the most of the left
 * upper arm seen, per cent of the picture, and of a sleeve's inside, pixels of a 480 wide picture */
type Moves = { cards: number; deep: number; wrist: number; wrung: number; short: number; upper: number; inside: number };

async function packFrames(page: Page): Promise<void> {
  await ev(page, readFileSync(new URL("./pack-audit.js", import.meta.url), "utf8"));
  const RL = fparmsCfg.reload;
  type Frames = { wrists: { rest: number[]; aimed: number[]; point: number; pointR: number; swap: number }; pointHand: number; trigTip: number; reloadSeen: { mag: number[]; tip: number[] }; nanBones: string[]; fit: { vanish: number[]; muzzle: number[]; across: number; upper: number; restArm: { upper: number; fore: number; hand: number } | null }; pitch: number; hook: number; fists: { free: boolean; twist: number[]; curl: number[]; thumb: number[]; skew: number[]; rest: Record<"l" | "r", boolean>; upR: { r: number[]; lShown: boolean }; upL: { l: number[]; rShown: boolean }; punch: number[] }; handover: number; palmAhead: number; fov: number; adsNear: number; centreShift: number; centreSwapped: boolean; own: { off: number; turn: number; aimed: number }; pitchWant: number; melee: { on: boolean; free: boolean; off: number; curl: number; deep: number }; tactical: { empty: { handle: number; lead: string }; tactical: { handle: number; lead: string } }; handFit: { palm: number; palmTouch: number; thumb: number; mr: number; rp: number; seen: Record<"l" | "r", { holes: number; cracks: number }>; tips: Record<string, number> }; palm: { w: number; cards: number }; palmArm: { hand: number[]; exit: number[]; leaves: string; keys: string[] }; toss: { y0: number; y1: number; whole0: number; whole1: number; after: number }; rackCurl: number; lead: { out: number[]; into: number[] }; inspect: Moves; flourish: Moves; tilt: number[]; gripSame: number; slid: number; slidIn: number; magPhase: { radial: number[]; off: number[] }; miss: number; off: number; through: Record<string, number>; throughWhere?: Record<string, string>; inside: Record<string, number>; shell: Record<string, number>; swap: { moved: number; deep: number; short: number; gone: number; off: number; face: number; curl: number; radial: number }; aimReach: number; pickLead: string; pickAfter: string; feed?: Feed; pump?: Pump; vent?: Vent };
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
      // and as much of the view's own time: it steps a frame at most 0.05 s (viewmodel.ts), so drawn in software a few
      // frames a second, 0.35 s of game time was a frame or two of the view's, the hands still on their way into a state
      // (STRYDER's 5 mm seen in the gun as a swap came in, on one run in four, and DEVINOS's wrist just over 60 degrees in
      // a first draw's flourish, 2026-10-17)
      H.viewWait = async (s) => {
        await H.gameWait(s);
        const n = Math.ceil(s / 0.05);
        await new Promise((ok) => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); });
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
      // (and which bone it was and in which part, the deepest seen, for a failure to say where: H.where)
      H.through = async () => {
        let worst = 0;
        H.where = null;
        for (let i = 0; i < 3; i++) {
          const a = window.__packAudit(0.004);
          if (a && a.seenDeepest > worst) {
            worst = a.seenDeepest;
            const b = Object.entries(a.seenBones).sort((p, q) => q[1] - p[1])[0];
            H.where = b ? b[0] + " in " + ((a.boneIn && a.boneIn[b[0]] && a.boneIn[b[0]][0]) || "?") : null;
          }
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
  // (as the settings give it, sens.ts gunFov: the world's 4:3 hip view at viewmodel.json's own scale, the player's own
  // cancelling out; it had been read off the first SpeedKills gun not yet in the bought arms, and since DEVINOS, 2026-10-11,
  // none is left)
  const plainFov = verticalFovFrom43(hipFov43(vmCfgE2e.fovScale));
  // and the length of an inspect in the view's own arms (viewmodel.ts INSPECT_TIME, as the page has it)
  const plainInspect = await pf<number>(`return r.packArms().plainInspect;`);
  // (every gun in the bought arms, fparms.json guns: a gun is added to the checks by adding it there)
  for (const id of packIds) {
    const other = allPack[(allPack.indexOf(id) + 1) % allPack.length];
    const o = { through: {} as Record<string, number>, inside: {} as Record<string, number> } as Frames;
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
    const packOf = (fparmsCfg.packGuns as Record<string, { reload?: { style?: string }; vent?: unknown }>)[(fparmsCfg.guns as Record<string, string>)[id]];
    const shells = packOf?.reload?.style === "shells";
    const vents = !!packOf?.vent;
    const noMag = shells || vents;
    // (and the right wrist through the point: the gun's turn bent ANAKIN's 75 to 80 degrees there, its elbow pulled round
    // by the turn where nothing held it, 2026-10-13)
    const pointWr = vents ? [0, 0] : await wr("r.debugView.reload = 0.28;");
    o.wrists = { rest: await wr(""), aimed: await wr("r.debugView.ads = 1;"), point: pointWr[0], pointR: pointWr[1], swap: (await wr("r.debugView.raise = 0.16;"))[0] };
    // and how far an arm falls short of its hold through an aim, cm (BIGANTLER's left arm, its shoulder fitted at rest
    // alone, fell 23 cm short aimed and the hand slid off the pump onto the receiver: the owner, 2026-10-11, "THE
    // BIGANTLERS LEFT HAND FIRST PERSON DOESN'T GRIP THE PUMP")
    o.aimReach = await pf<number>(`let worst = 0; for (const a of [0.5, 1]) { r.debugView.ads = a; await H.gameWait(0.35); const s = r.packArms(); worst = Math.max(worst, s.reachShort, s.reachShortR); } H.clear(); await H.gameWait(0.3); return worst * 100;`);
    // at rest, as fitted to the other games' resting frames (fparms.json packGuns look, tools/gun-fit.ts): where the barrel's
    // line meets the screen and where the muzzle is (shares of the screen, from the left and the top), and the gun's across
    // axis on the screen, degrees off level; and how much of the left upper arm is in the picture through a melee (carried by
    // the new look, the chest it draws back to came by the eye, a sheet of sleeve across the gun: 80% of it in the picture),
    // and how much of the left arm is seen at rest, per cent of the picture
    // (the gun's own box, without a round standing out of it: DEVINOS's rocket, its warhead out of the tube's mouth, put the
    // muzzle 1 to 2% of the picture off where the tube's mouth is)
    o.fit = await pf<Frames["fit"]>(`H.clear(); await H.gameWait(0.4); const restArm = window.__leftArmSeen(); const T = r.THREE; const rig = r.packRig(); const root = r.viewModelRoot(); let gun = null; root.traverse((x) => { if (x.userData && x.userData.paid && !gun) gun = x; }); gun.updateWorldMatrix(true, true); const ginv = new T.Matrix4().copy(gun.matrixWorld).invert(); const lb = new T.Box3(); const inRound = (m) => { for (let q = m; q; q = q.parent) if (q.userData && q.userData.rocket) return true; return false; }; gun.traverse((m) => { if (m.isMesh && m.visible && !inRound(m)) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); lb.union(m.geometry.boundingBox.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(ginv, m.matrixWorld))); } }); const vinv = new T.Matrix4().copy(root.matrixWorld).invert(); const tv = Math.tan(r.gunFov().gun / 2 * Math.PI / 180); const th = tv * innerWidth / innerHeight; const toV = (q) => q.clone().applyMatrix4(gun.matrixWorld).applyMatrix4(vinv); const share = (v) => [(1 + v.x / -v.z / th) / 2, (1 - v.y / -v.z / tv) / 2]; const c = lb.getCenter(new T.Vector3()); const back = toV(new T.Vector3(c.x, c.y, lb.max.z)), front = toV(new T.Vector3(c.x, c.y, lb.min.z)); const d = front.clone().sub(back); const ax = toV(new T.Vector3(c.x + 0.1, c.y, c.z)).sub(toV(c)); let across = Math.atan2(ax.y, ax.x) * 180 / Math.PI; if (across > 90) across -= 180; if (across < -90) across += 180; const upperIn = () => { const inv = new T.Matrix4().copy(root.matrixWorld).invert(); const tv2 = Math.tan(r.gunFov().gun / 2 * Math.PI / 180); const th2 = tv2 * innerWidth / innerHeight; let n = 0, k = 0; rig.group.traverse((m) => { if (!m.isSkinnedMesh) return; const g = m.geometry; const pos = g.attributes.position; const sk = g.attributes.skinIndex, sw = g.attributes.skinWeight; const v = new T.Vector3(); for (let i = 0; i < pos.count; i += 2) { let up = 0; for (let j = 0; j < 4; j++) if (sw.getComponent(i, j) > 0.5 && /^upperarm.*_l$/.test(m.skeleton.bones[sk.getComponent(i, j)].name)) up = 1; if (!up) continue; n++; v.fromBufferAttribute(pos, i); m.applyBoneTransform(i, v); v.applyMatrix4(m.matrixWorld).applyMatrix4(inv); if (v.z < 0 && Math.abs(v.x / -v.z / th2) < 1 && Math.abs(v.y / -v.z / tv2) < 1) k++; } }); return n ? k / n : 0; }; let upper = 0; for (const u of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) { r.meleeAt(u); await H.gameWait(0.15); upper = Math.max(upper, upperIn()); } r.meleeAt(null); H.clear(); await H.gameWait(0.3); return { vanish: d.z < 0 ? share(d) : [9, 9], muzzle: share(front), across, upper, restArm };`);
    // every joint of the arms a number, held (one that is not is drawn from nowhere)
    o.nanBones = await pf<string[]>(`H.clear(); await H.gameWait(0.3); const n = []; r.packRig().group.traverse((b) => { const q = b.quaternion, p = b.position; if (![q.x, q.y, q.z, q.w, p.x, p.y, p.z].every(Number.isFinite)) n.push(b.name); }); return n;`);
    // and how high in the picture the pointing wrist is (-1 its bottom edge, the gun camera's), -9 behind the eye
    // the right forefinger on the trigger at rest, view mm from its tip (its last bone carried on by its own length) to the
    // gun's trigger: six guns' right hands sat on their grips' foot or behind them, the forefinger 3 to 13 cm off the
    // trigger, ANAKIN's round its magazine under the grip and REZ's trigger bare in the picture (2026-10-13)
    o.trigTip = await pf<number>(`H.clear(); await H.gameWait(0.3); const T = r.THREE; const g = r.packRig().group; const s = g.getWorldScale(new T.Vector3()).x; const at = (n) => g.getObjectByName(n).getWorldPosition(new T.Vector3()); let trig = null; r.viewModelRoot().traverse((x) => { if (!trig && x.isMesh && /^Trigger/.test(x.name)) trig = x; }); if (!trig) return -1; const tip = at("index_03_r").add(at("index_03_r").sub(at("index_02_r")).multiplyScalar(0.9)); return (new T.Box3().setFromObject(trig).distanceToPoint(tip) / s) * 1000;`);
    // the reload where it is seen: through the magazine's phase out and in, how much of the magazine the eye sees (pixels of
    // a 480 wide picture, tools/pack-audit.js __magSeen) and how high the pointing fingertip is (-1 the picture's bottom
    // edge): ANAKIN's turn took its magazine and the whole pointing hand under the bottom edge for half its reload
    o.reloadSeen = noMag ? { mag: [], tip: [] } : await pf<Frames["reloadSeen"]>(`const T = r.THREE; const root = r.viewModelRoot(); const tanV = Math.tan(((r.gunFov().gun / 2) * Math.PI) / 180); const out = { mag: [], tip: [] }; for (const u of [0.2, 0.28, 0.4, 0.48]) { r.debugView.reload = u; await H.gameWait(0.15); const inv = new T.Matrix4().copy(root.matrixWorld).invert(); const v = r.packRig().group.getObjectByName("index_03_l").getWorldPosition(new T.Vector3()).applyMatrix4(inv); out.tip.push(v.z < 0 ? v.y / -v.z / tanV : -9); out.mag.push(window.__magSeen()); } H.clear(); await H.gameWait(0.3); return out;`);
    o.pointHand = await pf<number>(`r.debugView.reload = 0.28; await H.gameWait(0.35); const T = r.THREE; const root = r.viewModelRoot(); const inv = new T.Matrix4().copy(root.matrixWorld).invert(); const tanV = Math.tan(((r.gunFov().gun / 2) * Math.PI) / 180); const v = r.packRig().group.getObjectByName("hand_l").getWorldPosition(new T.Vector3()).applyMatrix4(inv); H.clear(); await H.gameWait(0.3); return v.z < 0 ? v.y / -v.z / tanV : -9;`);
    // the magazine as the old one goes (just before its phase out ends), and part way into the new one's phase in: out, and seated
    o.slid = noMag ? 0 : await pf<number>(`const rest = H.magAt(); r.debugView.reload = ${RL.phaseOut[1] - 0.005}; await H.gameWait(0.2); const d = H.magAt().distanceTo(rest); H.clear(); await H.gameWait(0.2); return d;`);
    o.slidIn = noMag ? 0 : await pf<number>(`const rest = H.magAt(); r.debugView.reload = ${RL.phaseIn[0] + (RL.phaseIn[1] - RL.phaseIn[0]) / 4}; await H.gameWait(0.2); const d = H.magAt().distanceTo(rest); H.clear(); await H.gameWait(0.2); return d;`);
    // the magazine's phase in the middle of each: out from its middle (fparms.json reload magPhase), how far the phase's
    // middle is from the magazine's own, view metres (what is drawn of it: its node also holds the old magazine, hidden,
    // which put the middle of the whole 107 mm off the USSO's)
    o.magPhase = noMag ? { radial: [], off: [] } : await pf<Frames["magPhase"]>(`const T = r.THREE; const out = { radial: [], off: [] }; for (const u of [${(RL.phaseOut[0] + RL.phaseOut[1]) / 2}, ${(RL.phaseIn[0] + RL.phaseIn[1]) / 2}]) { r.debugView.reload = u; await H.gameWait(0.2); let m = null; r.viewModelRoot().traverse((x) => { if (x.name === "mag" && !m) m = x; }); const f = r.gunFeel(); out.radial.push(f.magRadial); const seen = new T.Box3(); if (m) { m.updateWorldMatrix(true, true); const inv = new T.Matrix4().copy(m.matrixWorld).invert(); m.traverse((x) => { if (x.isMesh && x.visible) { x.geometry.computeBoundingBox(); seen.union(x.geometry.boundingBox.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inv, x.matrixWorld))); } }); } out.off.push(m ? m.localToWorld(seen.getCenter(new T.Vector3())).distanceTo(new T.Vector3().fromArray(f.magCenter)) / r.packRig().group.getWorldScale(new T.Vector3()).x : 99); } H.clear(); await H.gameWait(0.2); return out;`);
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
    o.handFit = await pf<Frames["handFit"]>(`r.packRig().debugStill = true; H.clear(); await H.viewWait(0.3); const T = r.THREE; const a = window.__packAudit(0.004, false, { side: "l", gapList: true }); const pct = (xs, q) => { const s = (xs || []).slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 99; }; const g = r.packRig().group; const at = (n) => g.getObjectByName(n).getWorldPosition(new T.Vector3()); const s = g.getWorldScale(new T.Vector3()).x; const d = (p, q) => (at(p).distanceTo(at(q)) / s) * 1000; const seen = (side) => { const x = window.__packSeenGap(side); return x ? { holes: x.holes, cracks: x.cracks } : { holes: 99, cracks: 99 }; }; const out = { palm: pct(a.gapList.hand_l, 0.1), palmTouch: (a.palmGap.l ?? 1) * 1000, thumb: Math.max(pct(a.gapList.thumb_02_l, 0.25), pct(a.gapList.thumb_03_l, 0.25)), mr: d("middle_03_r", "ring_03_r"), rp: d("ring_03_r", "pinky_03_r"), seen: { l: seen("l"), r: seen("r") }, tips: Object.fromEntries(["thumb", "index", "middle", "ring", "pinky"].map((f) => [f, a.boneGap[f + "_03_l"] ?? 99])) }; r.packRig().debugStill = false; return out;`);
    // and the forefinger closed round it, degrees
    o.rackCurl = await pf<number>(`r.debugView.reload = 0.76; await H.gameWait(0.2); const c = r.packArms().rackCurl; H.clear(); await H.gameWait(0.3); return c;`);
    // the pointing finger against the magazine, shares of the slide: a quarter into the phase out and halfway into the in
    const outAt = RL.phaseOut[0] + (RL.phaseOut[1] - RL.phaseOut[0]) / 4;
    const inAt = (RL.phaseIn[0] + RL.phaseIn[1]) / 2;
    o.lead = noMag ? { out: [], into: [] } : await pf<Frames["lead"]>(`const at = async (u) => { r.debugView.reload = u; await H.gameWait(0.15); const s = r.packArms(); return [s.tipSlid, s.magSlid]; }; const out = await at(${outAt}); const into = await at(${inAt}); H.clear(); await H.gameWait(0.3); return { out, into };`);
    // the hands off the gun: the bought arms' fists
    // (as Apex shows them: none in the picture standing, each open hand up into its bottom on its step of a sprint, the
    // right fist in its middle on a punch; each hand's middle as shares of the screen from the top left, and whether any
    // of its bones is in the picture)
    o.fists = await pf<Frames["fists"]>(`r.debugView.lowered = 1; await H.gameWait(0.8); const T = r.THREE; const g = r.packRig().group; const cam = r.viewModelRoot().parent; const at = (n) => g.getObjectByName(n).getWorldPosition(new T.Vector3()); const shown = (k) => ["hand", "thumb_03", "index_03", "middle_03", "pinky_03"].some((b) => { const v = at(b + "_" + k).project(cam); return v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1; }); const mid = (k) => { const v = at("hand_" + k).lerp(at("middle_01_" + k), 0.5).project(cam); return [(v.x + 1) / 2, (1 - v.y) / 2]; }; const rest = { l: shown("l"), r: shown("r") }; r.pumpAt(0.25); await H.viewWait(0.2); const upR = { r: mid("r"), lShown: shown("l") }; r.pumpAt(0.75); await H.viewWait(0.2); const upL = { l: mid("l"), rShown: shown("r") }; r.pumpAt(null); r.meleeAt(0.35); await H.viewWait(0.2); const s = r.packArms(); const f = { free: s.free, rest, upR, upL, punch: mid("r"), twist: [s.twistR], curl: [s.curlR], thumb: [s.thumbR], skew: [s.skewR] }; r.meleeAt(null); H.clear(); await H.gameWait(0.8); return f;`);
    // an inspect: the open left palm with the hack over it
    o.palm = await pf<{ w: number; cards: number }>(`r.debugView.inspect = 0.5; await H.gameWait(0.3); const p = { w: r.packArms().palm, cards: r.packArms().palmCards }; r.debugView.inspect = -1; await H.gameWait(0.3); return p;`);
    // the open hand's wrist and elbow on the screen (-1 to 1 across and up it), and the cards' hacks with their levels
    o.palmArm = await pf<Frames["palmArm"]>(`r.sk.setHack("dash", 2); r.sk.setHack("reveal", 3); r.debugView.inspect = 0.3; await H.gameWait(0.3); const T = r.THREE; const root = r.viewModelRoot(); const inv = new T.Matrix4().copy(root.matrixWorld).invert(); const tanV = Math.tan(((r.gunFov().gun / 2) * Math.PI) / 180); const tanH = tanV * (innerWidth / innerHeight); const pos = (n) => r.packRig().group.getObjectByName(n).getWorldPosition(new T.Vector3()).applyMatrix4(inv); const scr = (v) => [v.x / -v.z / tanH, v.y / -v.z / tanV]; const h = pos("hand_l"), e = pos("lowerarm_l"); let leaves = "in", exit = scr(e); for (let i = 1; i <= 400; i++) { const v = h.clone().lerp(e, i / 400); if (v.z > -0.01) { leaves = "behind"; break; } const s = scr(v); if (s[1] < -1) { leaves = "bottom"; exit = s; break; } if (Math.abs(s[0]) > 1 || s[1] > 1) { leaves = s[1] > 1 ? "top" : s[0] < 0 ? "left" : "right"; exit = s; break; } } const out = { hand: scr(h), exit, leaves, keys: r.packArms().palmCardKeys }; r.debugView.inspect = -1; await H.gameWait(0.3); return out;`);
    // the toss: the cards before it, rising and phasing, and after it as the hand goes back
    o.toss = await pf<Frames["toss"]>(`const at = async (u) => { r.debugView.inspect = u; await H.gameWait(0.15); return r.packArms(); }; const a = await at(0.72); const b = await at(0.85); const c = await at(0.93); r.debugView.inspect = -1; await H.gameWait(0.3); return { y0: a.palmCardY, y1: b.palmCardY, whole0: a.palmWhole, whole1: b.palmWhole, after: c.palmCards };`);
    // an inspect and a first draw's flourish all the way through: the worst of each measure at each moment
    // (a page call a moment: the whole sweep in one call took up to 85 s, and with other runs loading the machine it
    // passed the page's 120 s limit, 2026-10-12)
    const moves = async (knob: string, cards: boolean): Promise<Moves> => {
      const w: Moves = { cards: 0, deep: 0, wrist: 0, wrung: 0, short: 0, upper: 0, inside: 0 };
      for (const u of [0.04, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.96]) {
        const m = await pf<Moves>(`r.debugView.${knob} = ${u}; await H.viewWait(0.12); const s = r.packArms(); const a = window.__packAudit(0.004); return { cards: ${cards ? "Math.max(0, ...window.__cardOverGun())" : "0"}, deep: a.seenDeepest * 1000, wrist: Math.max(s.wristL, s.wristR), wrung: Math.max(s.skinL, s.skinR), short: Math.max(s.reachShort, s.reachShortR), upper: ${knob === "flourish" ? "(window.__leftArmSeen() || { upper: 0 }).upper" : "0"}, inside: ${knob === "flourish" ? "(window.__sleeveInside() || { inside: 0 }).inside" : "0"} };`);
        for (const k of Object.keys(w) as Array<keyof Moves>) w[k] = Math.max(w[k], m[k]);
      }
      await pf(`r.debugView.${knob} = -1; await H.gameWait(0.3);`);
      return w;
    };
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
    // (and the inside of a sleeve, in the same states and aimed: tools/pack-audit.js __sleeveInside, null with the arms not
    // drawn, as behind a scope)
    for (const [name, set] of states) {
      const [d, s, where] = await pf<[number, number, string | null]>(`${set} await H.viewWait(0.35); const d = await H.through(); const s = window.__sleeveInside(); H.clear(); r.loadout.active.state.clip = r.loadout.active.weapon.clipSize; await H.gameWait(0.3); return [d, s ? s.inside : 0, H.where];`);
      o.through[name] = d;
      if (d > 0.004 && where) o.throughWhere = { ...(o.throughWhere ?? {}), [name]: where };
      o.inside[name] = s;
    }
    o.inside.aimed = await pf<number>(`r.debugView.ads = 1; await H.gameWait(0.35); const s = window.__sleeveInside(); H.clear(); await H.gameWait(0.3); return s ? s.inside : 0;`);
    // the gun's own inside, where it is not drawn (a shell open at its end, the eye through it): held, aimed, and turned
    // over in an inspect, where the sights are seen from their sides and backs
    o.shell = await pf<Record<string, number>>(`const out = {}; const read = () => window.__gunInside()?.inside ?? 0; r.packRig().debugStill = true; H.clear(); await H.viewWait(0.3); out.held = read(); r.debugView.ads = 0.8; await H.viewWait(0.35); out.aimed = read(); r.debugView.ads = null; for (const u of [0.35, 0.65]) { r.debugView.inspect = u; await H.viewWait(0.3); out["inspect " + u] = read(); } r.debugView.inspect = -1; r.packRig().debugStill = false; H.clear(); await H.gameWait(0.3); return out;`);
    // the swap: the gun stays where it is while it phases out from its edges in and the next phases in from its middle
    // out (the owner, 2026-09-30: "keep the hands where they are while the weapon phases / disintegrates from the outside
    // going in ... then the new weapon should materialize from the inside out"), and the hands come a little off it and
    // turn in round its middle, "like the streetfighter haduken"; through it the most the gun's middle moves, the deepest
    // seen skin in the gun, the most an arm falls short, and with the hands cupped (held 0.6 s of game time to settle) how
    // far they are off their holds, how far each palm is turned from the gun's middle, the fingers' bend, the phase's shape
    // (a page call a step, as the moves above: in one call the sweep took up to 85 s)
    await pf(`r.packRig().debugStill = true; const root = r.viewModelRoot(); const T = r.THREE; let gun = null; root.traverse((o) => { if (o.userData && o.userData.paid && !gun) gun = o; }); H.gunAt = () => root.worldToLocal(new T.Box3().setFromObject(gun).getCenter(new T.Vector3())); H.clear(); await H.gameWait(0.2); H.gunAt0 = H.gunAt();`);
    // (and how many of its frames have the arms gone from the picture: hidden with the gun, they went for the swap's middle,
    // where one gun has phased out and the next not yet in)
    const sw = { moved: 0, deep: 0, short: 0, gone: 0 };
    for (let u = 0.04; u < 0.97; u += 0.04) {
      const m = await pf<typeof sw>(`r.debugView.raise = ${u}; await H.gameWait(0.1); const a = window.__packAudit(0.004); const s = r.packArms(); return { moved: H.gunAt().distanceTo(H.gunAt0), deep: a ? a.seenDeepest * 1000 : 0, short: Math.max(s.reachShort, s.reachShortR), gone: r.packRig().group.visible ? 0 : 1 };`);
      for (const k of ["moved", "deep", "short"] as const) sw[k] = Math.max(sw[k], m[k]);
      sw.gone += m.gone;
    }
    const swap = { ...sw, ...(await pf<Omit<Frames["swap"], "moved" | "deep" | "short" | "gone">>(`r.debugView.raise = 0.4; await H.gameWait(0.6); const c = r.packArms(); const radial = r.gunFeel().radial; r.packRig().debugStill = false; H.clear(); await H.gameWait(0.3); return { off: c.cupOff, face: c.cupFace, curl: Math.min(c.curlL, c.curlR), radial };`)) };
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
      const SR = (fparmsCfg.packGuns as unknown as Record<string, { reload?: { feed: number[]; count: number; push: number[]; back: number[]; pump: number[] } }>)[(fparmsCfg.guns as Record<string, string>)[id]].reload!;
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
  const jumpPage = await open(page.browser(), "?");
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
  /** a pistol: its left hand wraps the right round the grip, and the long guns' fit to a left palm is not made (fparms.json packGuns leftOnHand) */
  const onHand = (id: string) => !!(fparmsCfg.packGuns as Record<string, { leftOnHand?: boolean }>)[(fparmsCfg.guns as Record<string, string>)[id]]?.leftOnHand;
  /**
   * daylight the eye may see shut between a hand and its gun, pixels of tools/pack-audit.js __packSeenGap's 960 wide
   * picture (about a millimetre each at a support hand): no hole through a hand at all, and cracks along its edge as thin
   * as the antialiasing leaves
   */
  const SEEN_HOLES = 5;
  const SEEN_CRACKS = 40;
  check(
    "pack frames: the USSO and BOOG are fitted into the bought hands the same on every draw (it had been only the first)",
    // (tilted either way: ANAKIN's grip into the palm is 6 degrees nose down, DEVINOS's 1.8 up, the second draw's had come out
    // as none at all; a pistol not at all, its left hand on the right, fparms.json packGuns leftOnHand)
    g.length === packIds.length && g.every((x, i) => (onHand(Object.keys(res.guns)[i]) ? Math.abs(x.tilt[0]) < 1e-6 : Math.abs(x.tilt[0]) > 0.01) && Math.abs(x.tilt[0] - x.tilt[1]) < 1e-4),
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
  // (the owner, 2026-10-17: "SOME GUNS / HANDS ARE CLEARLY FUCKED UP STILL. LIKE LOGICALLY THE FINGERS ARE THE WRONG WAY
  // ... A BIG OBV ONE IS ON ANAKIN": its left thumb stood straight out into the air, more than 3 cm off the gun, and REZ's,
  // CHOOCH's and BIGANTLER's thumbs and the USSO's little finger stood 3 to 6 cm off theirs. Every check passed: they
  // counted skin in the gun, daylight between hand and gun and the wrist's bend, and a finger pointing away is none of
  // those. A pistol's left fingers lie on its right hand, not the gun. 2.5 cm: PANDA's little finger lies 2.1 cm from the
  // end of its handguard, beside it, and a search of its three joints (tools/pack-flush.ts) found no better place)
  const TIP_OFF = 25;
  check(
    `pack frames: at rest each long gun's support hand holds it with every finger and its thumb, none pointing off into the air (each tip within ${TIP_OFF} mm of the gun)`,
    g.length === packIds.length && Object.entries(res.guns).every(([id, x]) => onHand(id) || Object.values(x.handFit.tips).every((v) => v <= TIP_OFF)),
    show((x) => x.handFit.tips),
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
  // down; APUHTHEE and STRYDER on Apex's Wingman at rest, its sights' line meeting at 48% across and down, its muzzle
  // 62% across and 56% down, held further off than a rifle as a pistol is, 5 degrees off level; DEVINOS on the shoulder as
  // Battlefield Hardline holds its RPG-7 at rest, Apex having no launcher, its tube's line at the middle, its warhead's tip
  // 57% across and 55% down)
  // (the pistols since Milestone 541: APUHTHEE's rear sight on Apex's Wingman's at rest, 0.607 and 0.574 of the screen, 9 cm
  // left of and 6 lower than its first fit, the owner, 2026-10-11, "too far off on the right"; STRYDER 5 cm nearer the face)
  const FIT: Record<string, { vanish: number[]; muzzle: number[]; level: number }> = { r97: { vanish: [0.5, 0.49], muzzle: [0.565, 0.625], level: -3 }, sentinel: { vanish: [0.5, 0.508], muzzle: [0.5465, 0.57], level: -2 }, alternator_smg: { vanish: [0.49, 0.472], muzzle: [0.593, 0.607], level: -4.3 }, vinson: { vanish: [0.465, 0.463], muzzle: [0.589, 0.574], level: -5 }, mastiff: { vanish: [0.47, 0.47], muzzle: [0.559, 0.593], level: -5 }, shotgun: { vanish: [0.47, 0.47], muzzle: [0.579, 0.583], level: -5 }, lstar: { vanish: [0.47, 0.47], muzzle: [0.569, 0.598], level: -5 }, wingman: { vanish: [0.48, 0.48], muzzle: [0.574, 0.615], level: -5 }, autopistol: { vanish: [0.48, 0.48], muzzle: [0.632, 0.586], level: -5 }, launcher: { vanish: [0.5, 0.5], muzzle: [0.57, 0.55], level: -5 } };
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
  // (the owner, 2026-10-23: "the FOV should barely see left arm on a bunch of guns": at rest Apex's, EMPULSE's and Hyper
  // Scape's support arm comes up from under the picture to the gun, a hand and some forearm; ANAKIN's, PANDA's, BIGANTLER's
  // and CHOOCH's upper arms were in its lower left, 1.8 to 2.3% of it; in a first draw PANDA's upper arm filled 6% and
  // DEVINOS's 4%, and PANDA's and CHOOCH's sleeves came up open end first, 1400 and 2100 pixels of their insides seen)
  check(
    "pack frames: at rest the left arm comes up from under the picture to the gun, as Apex's, EMPULSE's and Hyper Scape's do, its upper arm out of it (under 1% of the picture)",
    g.every((x) => !!x.fit.restArm && x.fit.restArm.upper < 1),
    show((x) => x.fit.restArm && { upper: +x.fit.restArm.upper.toFixed(2), fore: +x.fit.restArm.fore.toFixed(2), hand: +x.fit.restArm.hand.toFixed(2) }),
  );
  check(
    "pack frames: all through a first draw's flourish the left upper arm stays out of the picture (under 3% of it), no sleeve across its bottom and none's inside seen (20 pixels of a 480 wide picture)",
    g.every((x) => x.flourish.upper < 3 && x.flourish.inside <= 20),
    show((x) => ({ upper: +x.flourish.upper.toFixed(2), inside: x.flourish.inside })),
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
  check(
    "pack frames: the right wrist 50 degrees or less while the left hand points at the magazine",
    g.every((x) => x.wrists.pointR <= 50),
    show((x) => Math.round(x.wrists.pointR)),
  );
  check(
    "pack frames: the right forefinger's tip on the trigger at rest (4 mm at most), every gun",
    g.every((x) => x.trigTip >= 0 && x.trigTip <= 4),
    show((x) => +x.trigTip.toFixed(1)),
  );
  check(
    "pack frames: in a reload the magazine is seen through its phase (60 pixels of a 480 wide picture at its most) and the pointing fingertip is in the picture or at its edge",
    gm.every((x) => Math.max(...x.reloadSeen.mag) >= 60 && Math.min(...x.reloadSeen.tip) > -1.1),
    show((x) => ({ mag: x.reloadSeen.mag, tip: x.reloadSeen.tip.map((v) => +v.toFixed(2)) })),
  );
  check(
    "pack frames: both arms reach their holds all through an aim (within 1 cm), the hands staying on the gun",
    g.every((x) => x.aimReach <= 1),
    show((x) => +x.aimReach.toFixed(1)),
  );
  // (the owner, 2026-09-28: "the right arm is clearly still so fucked up ... just put the guns away and look at the right
  // arm": the right fist rolled 159 degrees on its forearm, the glove's cuff split from the sleeve, and each thumb out
  // ahead of its fist like a pointing finger. Since 2026-10-18 the one fist shown is the punch's)
  check(
    "pack frames: an empty-handed punch is the bought arms' right fist, not rolled on its forearm past 45 degrees, every finger curled (120 degrees and more) and its thumb across the fingers (within a phalanx)",
    g.every((x) => x.fists.free && x.fists.twist.every((t) => t <= 45) && x.fists.curl.every((c) => c >= 120) && x.fists.thumb.every((t) => t <= 1)),
    show((x) => ({ twist: x.fists.twist.map(Math.round), curl: x.fists.curl.map(Math.round), thumb: x.fists.thumb.map((t) => +t.toFixed(2)) })),
  );
  check(
    // (the owner, 2026-10-11: "the fists out look obvously fucked up too lmao the fingers are all bent unnaturally": bent on
    // along the grip's own turn, the USSO's fists' fingers curled 75 and 28 degrees off their planes, across each other)
    "pack frames: the punch's fist's fingers curl in their own planes, square to the knuckles' line (20 degrees off at most)",
    g.every((x) => x.fists.skew.every((t) => t <= 20)),
    show((x) => x.fists.skew.map(Math.round)),
  );
  // (the owner, 2026-10-18: "THE FISTS THEMSELVES OUT LOOK RETARDED RIGHT NOW ... THE ANIMATIONS FOR THEM MOVING ARE LIKE
  // PUNCHING THE AIR ... COMPARE WHAT WE HAVE NOW TO APEX / HYPERSCAPE UNARMED": two fists had been held out ahead all the
  // time and thrust forward in turn as you ran. Apex, read frame by frame, shows no hands standing or walking, an open hand
  // up into the picture's bottom on each step of a sprint, and on a punch the right fist in its middle: fparms.json
  // free.unarmed. Within a tenth of the screen of each place)
  const UN = (fparmsCfg.free as unknown as { unarmed: { sprint: { peak: Record<"l" | "r", number[]> }; punch: { hit: number[] } } }).unarmed;
  const near = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= 0.1;
  check(
    "pack frames: with the hands empty, as Apex shows them: neither hand in the picture standing still, each open hand up into its bottom on its own step of a sprint with the other out of it, and a punch's right fist in its middle",
    g.every((x) => !x.fists.rest.l && !x.fists.rest.r && near(x.fists.upR.r, UN.sprint.peak.r) && !x.fists.upR.lShown && near(x.fists.upL.l, UN.sprint.peak.l) && !x.fists.upL.rShown && near(x.fists.punch, UN.punch.hit)),
    show((x) => ({ rest: x.fists.rest, upR: x.fists.upR.r.map((v) => +v.toFixed(2)), lShown: x.fists.upR.lShown, upL: x.fists.upL.l.map((v) => +v.toFixed(2)), rShown: x.fists.upL.rShown, punch: x.fists.punch.map((v) => +v.toFixed(2)) })),
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
    // (each gun's own magSlide where it has one: fparms.json packGuns)
    Object.entries(res.guns).filter(([, x]) => !x.feed && !x.vent).every(([id, x]) => { const want = (fparmsCfg.packGuns as Record<string, { magSlide?: number }>)[(fparmsCfg.guns as Record<string, string>)[id]]?.magSlide ?? RL.slide; return x.slid > want * 0.8 && x.slid < want * 1.2 && (RL.slideIn > 0 ? x.slidIn > RL.slideIn * want * 0.5 : x.slidIn < 0.001); }),
    show((x) => ({ out: +x.slid.toFixed(3), in: +x.slidIn.toFixed(3) })),
  );
  // (the owner, 2026-10-01: "make the magazine phase in from the middle out and then we take the mag out it should be from
  // the outside in", as the guns phase on a swap)
  check(
    "pack frames: the old magazine phases out from its edges in and the new one in from its middle out (the phase radial round the magazine's own middle, within 5 mm)",
    // (its middle in its own frame, as the view takes it: over the world's axes DEVINOS's rocket, 54 cm long and rolled with
    // the reload's turn, came out 12 mm off its own middle)
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
    show((x) => ({ ...Object.fromEntries(Object.entries(x.through).map(([k, d]) => [k, +(d * 1000).toFixed(1)])), ...(x.throughWhere ? { where: x.throughWhere } : {}) })),
  );
  check(
    // (the arms are cut off on the upper arm, an open sleeve: REZ's and PANDA's left hands reached so far out along the gun
    // that the upper arm came up into the picture open end first, 3700 and 4600 pixels of its inside at rest, the owner,
    // 2026-10-11: "the left arm is seethrough... like looks terrible"; a few pixels' edge is let through)
    "pack frames: no inside of a sleeve seen (20 pixels of a 480 wide picture), held, pointing, the new magazine in, racking, aimed, swapping and picking up",
    g.every((x) => Object.values(x.inside).every((n) => n <= 20)),
    show((x) => x.inside),
  );
  // (the owner, 2026-10-18: "on the PANDA that part of the gun is like see through like the scope and shit, other guns
  // might have that too. look specifically on the reticles and what holds them up": looking into PANDA's scope its tube
  // was see-through, 1,871 pixels of this picture aimed, and ANAKIN's sight showed through the base holding it up, 294)
  check(
    "pack frames: no gun shows its inside where it is not drawn, held, aimed and turned over in an inspect (20 pixels of a 480 wide picture): its sights and the parts holding them up are solid",
    g.every((x) => Object.values(x.shell).every((n) => n <= 20)),
    show((x) => x.shell),
  );
  check(
    // (to 5 cm since DEVINOS: its grips are 4.2 cm thick, and its hands need 4.9 cm off them to clear them in the cup; at 3.9 they
    // went 12 mm in)
    "pack frames: a swap keeps the gun where it is (its middle within 1 cm) as it phases out from its edges in and the next from its middle out; the hands come 1 to 5 cm off their holds and turn in round its middle (each palm within 50 degrees of facing it across its forearm, the fingers bent 45 degrees and more), no hand through the gun (4 mm) and both arms reaching all through it",
    g.every((x) => x.swap.moved < 0.01 && x.swap.radial === 1 && x.swap.off > 0.01 && x.swap.off < 0.05 && x.swap.face < 50 && x.swap.curl >= 45 && x.swap.deep <= 4 && x.swap.short < 0.01),
    // (a measure that is no number comes out of the page as null, and is shown as that: a NaN finger had crashed the report)
    show((x) => { const k = (v: number | null, f: number, d: number) => (typeof v === "number" ? +(v * f).toFixed(d) : v); return { moved: k(x.swap.moved, 100, 1), radial: x.swap.radial, off: k(x.swap.off, 100, 1), face: k(x.swap.face, 1, 0), curl: k(x.swap.curl, 1, 0), deep: k(x.swap.deep, 1, 1), short: k(x.swap.short, 100, 1) }; }),
  );
  check(
    // (the owner, 2026-09-30, of the swap in place: "keep the hands where they are while the weapon phases"; hidden with the
    // gun, both arms went from the picture for the middle 6% of every swap, where one gun has phased out and the next not yet
    // in, Milestone 547)
    "pack frames: in a swap in place both arms stay in the picture all through it (24 frames), its middle too, where one gun has phased out and the next is not yet in",
    g.every((x) => x.swap.gone === 0),
    show((x) => x.swap.gone),
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
  const nums = await ev<Array<{ amount: number; text: string; y: number }>>(page, "window.__range.hud.damageNumbers");
  const fired = s1.shots - s0.shots;
  const hits = s1.hits - s0.hits;
  const dealt = s1.damage - s0.damage;
  check(`shotgun: one pull of the Mastiff is ${set.pellets} pellets, and at 4 m they all land`, fired === set.pellets && hits === set.pellets, `fired ${fired}, hit ${hits}`);
  check("shotgun: the pellets do damage each, not one pellet's worth", dealt >= set.near * set.pellets * 0.75, `${dealt} dealt, a pellet is ${set.near}`);
  check("shotgun: the HUD sums the pull into one damage number", nums.length === 1 && nums[0].amount === dealt, JSON.stringify(nums));
  // and it stands over the figure's head, not on the chest it struck (Milestone 690, the owner: "it blocks the soldier")
  const head = await ev<number>(page, "window.__range.dummies[0].overHead(0).y");
  check("shotgun: that number stands over the dummy's head, not where the pellets struck", nums.length === 1 && nums[0].y > head, JSON.stringify({ number: nums[0]?.y, headTop: head }));
  await ev(page, `window.__range.loadout.setWeaponId(0, "vinson")`);
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
  const HEAD_PX = (hudCfgE2e as unknown as { tracers: { head: { minPx: number } } }).tracers.head.minPx;
  // (the owner, 2026-10-18, asking how an enemy reads from your view against Apex, Hyper Scape and EMPULSE: a round fired
  // at you is seen end on, and a streak end on is only its width, 1.5 pixels, so incoming fire was a point you missed.
  // Everyone else's rounds carry a glowing head, hud.json tracers head)
  const incoming = await ev<{ headPx: number; width: number; at: number } | null>(page, `new Promise((ok) => { const r = window.__range; const e = r.player.eyePosition().clone(); r.fireRound([0, 0, 1], true, [e.x, e.y, e.z - 40]);
    const look = () => { const t = r.tracers(); const x = t[t.length - 1]; if (!x) return ok(null); if (x.travelled > 10) return ok({ headPx: +x.headPx.toFixed(1), width: +x.width.toFixed(3), at: +(40 - x.travelled).toFixed(1) }); requestAnimationFrame(look); };
    requestAnimationFrame(look); })`);
  check(`tracers: everyone else's round fired at you reads head on, a glowing head ${HEAD_PX} pixels or more across where its streak is only its width`, !!incoming && incoming.headPx >= HEAD_PX - 0.1, JSON.stringify(incoming));
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
  // the text comes in by itself once the page's first screen has gone, open at its first section (the owner,
  // 2026-10-12: "auto defaulted to the first section"), its tenth the Feedback section with SpeedKills' age filled in
  const opened = await page.waitForFunction("window.__range.readmeTv.loaded", { polling: 100, timeout: 20000 }).then(() => true, () => false);
  const first = await tv();
  const fb = await ev<string>(page, "(() => { const t = window.__range.readmeTv; const at = [t.section, t.page]; t.goto(9, 0); const s = t.pageText(); t.goto(at[0], at[1]); return s; })()");
  check(
    "README screen: the text comes in by itself and opens at its first section, ten of them, the last Feedback with SpeedKills' age in days",
    opened && first.section === 0 && first.page === 0 && first.sections.length === 10 && first.sections[9] === "Feedback" && /SpeedKills: \d+ days old/.test(fb.replace(/\s+/g, " ")) && !/\{days\}|\{started\}/.test(fb),
    JSON.stringify({ opened, at: [first.section, first.page], sections: first.sections.length, fb: fb.slice(0, 160) })
  );
  // (8 m in front of the screen, which hangs 24 m down range: the barrier it hung in, and the bound behind it, went on
  // 2026-10-12, so a teleport past it is no longer held at it)
  await ev(page, `(() => { const r = window.__range; r.player.teleport(0, 0, -16, 0, 0); r.readmeTv.goto(0, 0); })()`);
  await sleep(200);
  const start = await tv();
  // The words of the opening change as the game does (they were the legacy game's until 2026-10-03); what has to hold
  // is that the screen shows THIS file rather than a placeholder: its first heading, and the opening words of its first
  // paragraph, read off the file itself
  // (SpeedKills' screen shows the manual, docs/MANUAL.md; the README was the legacy game's)
  const readme = readFileSync(new URL("../docs/MANUAL.md", import.meta.url), "utf8");
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

  // the list of sections: a round on a name opens it. (A punch did too, from within a fist's reach of the screen; in
  // SpeedKills the screen stands past the sandbox's edge, range.json edgeZ, so a round is the only way to it.)
  const jump = beforeStray.sections.length - 1;
  await shootAt(`window.__range.readmeTv.entryAt(${jump})`);
  const jumped = await tv();
  check("README screen: a round on a section's name opens that section", jumped.section === jump && jumped.page === 0, `wanted ${jump}, got ${jumped.section} ("${jumped.title}")`);
}

/** a fake gamepad: Start plays, the left stick walks, the right stick turns */
async function padTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  // The menu by controller (Milestone 539): RB and LB turn the tabs, the Controller tab is one of them, the D-pad
  // lights a stop, and A on a lit tab opens it
  await padTap(page, 5);
  const t1 = await ev<string>(page, "window.__range.menu.tab");
  await padTap(page, 4);
  const t0 = await ev<string>(page, "window.__range.menu.tab");
  // (six over to it since Milestone 635's Account tab, after Stats)
  for (let i = 0; i < 6; i++) await padTap(page, 5);
  const tc = await ev<{ tab: string; shown: boolean; status: string }>(page, `({ tab: window.__range.menu.tab, shown: !document.querySelector('section[data-panel="controller"]').hidden, status: document.getElementById("padStatus").textContent })`);
  await padTap(page, 4);
  await padTap(page, 4);
  await padTap(page, 4);
  await padTap(page, 4);
  await padTap(page, 4);
  await padTap(page, 13);
  const lit = await ev<string | null>(page, "(() => { const e = document.querySelector('.padfocus'); return e ? (e.id || e.dataset.tab || e.tagName) : null; })()");
  check(
    "pad menu: RB and LB turn the tabs (the Controller tab among them, saying a pad is in), and the D-pad lights something to press",
    t1 === "duel" && t0 === "play" && tc.tab === "controller" && tc.shown && /connected/i.test(tc.status) && lit !== null,
    JSON.stringify({ t1, t0, tc, lit })
  );
  // The Feedback tab (Milestone 625): the last tab LB reaches from the first, and on a page with no server of ours (the
  // dev server has no /net.json) a note says there is nowhere to send it rather than seeming sent
  await ev(page, `window.__range.menu.show("play")`);
  await padTap(page, 4);
  const fb = await ev<{ tab: string; shown: boolean }>(page, `({ tab: window.__range.menu.tab, shown: !document.querySelector('section[data-panel="feedback"]').hidden })`);
  await ev(page, `(() => { document.getElementById("fbText").value = "a note from the e2e"; document.getElementById("fbSend").click(); })()`);
  await page.waitForFunction(`!/Sending/.test(document.getElementById("fbStatus").textContent)`, { polling: 100, timeout: 10000 }).catch(() => undefined);
  const fbSaid = await ev<string>(page, `document.getElementById("fbStatus").textContent`);
  check("feedback: LB from the first tab is the Feedback tab, and with no server of ours to send to it says so", fb.tab === "feedback" && fb.shown && /nowhere to send it/.test(fbSaid), JSON.stringify({ fb, fbSaid }));
  await ev(page, `window.__range.menu.show("play")`);
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
  // (Shattercaps on the 30-30 was checked here: the legacy game's gun and hop-up, gone from SpeedKills)
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
  const df = await ev<string[]>(page, "(() => { const b = window.__range.padButtons(); return [b[4], b[0], b[5], b[12] ?? 'nothing', b[15]]; })()");
  // (Default since Milestone 538: the two hacks on the bumpers, ping on D-pad up, the controls panel on D-pad right)
  check("pad presets: Bumper Jumper (jump on LB, the ability on A), then Default (ability, jump, the utility hack on RB, ping on D-pad up, the keys panel on D-pad right)", bj.join() === "jump,ability" && df.join() === "ability,jump,grenade,ping,keyHints", `${bj} / ${df}`);
  // the controller's table drawn once, whatever changed it (Milestone 731: each rebind, reset or preset added the whole
  // list again), and the Range preset's D-pad down named, the fusion step (it showed blank, not in the Controls list)
  await ev(page, `(() => { const s = document.getElementById("padPreset"); s.value = "range"; s.dispatchEvent(new Event("change")); })()`);
  const padTable = await ev<{ presets: number; heads: number; dpadDown: string; shown: boolean }>(
    page,
    `(() => { const sel = document.querySelector('#padBindTable select[data-button="13"]'); return { presets: document.querySelectorAll("#padPreset").length, heads: document.querySelectorAll("#padBindTable .bindGroup").length, dpadDown: sel ? sel.value : "", shown: !!sel && sel.selectedIndex >= 0 }; })()`,
  );
  await ev(page, `(() => { const s = document.getElementById("padPreset"); s.value = "default"; s.dispatchEvent(new Event("change")); })()`);
  check("pad presets: the controller's table is drawn once after three changes, and the Range preset's D-pad down is named (the fusion step)", padTable.presets === 1 && padTable.heads === 1 && padTable.dpadDown === "magLevel" && padTable.shown, JSON.stringify(padTable));
  // The prompts follow the controller (Milestone 538): a pad in hand names its buttons in the keys panel and the
  // prompts, an unnamed pad as Xbox's, a DualSense as PlayStation's, and a key on the keyboard turns them back
  // (and the range's signs, Milestone 621; since Milestone 636 THE RUN's vent names the slide's button and its climb
  // the forward held)
  const rows = `(() => { const h = window.__range.hud.last; const k = h && h.keyHints; const f = (l) => (k && k.rows.find((r) => r.label.startsWith(l))?.keys.join(" ")) || null; const sign = (t) => window.__range.keyPanelTexts().find((x) => x.startsWith(t)) || ""; const vent = sign("VENT"); const climb = sign("CLIMB"); return { pad: h ? h.padFamily ?? null : null, jump: f("Jump"), mob: f("Mobility"), util: f("Utility"), move: f("Move"), hide: k ? k.hide : null, vent: (vent.match(/press (\\S+) to slide/) || [])[1] || null, climb: (climb.match(/keep holding (.+?): you climb/) || [])[1] || null }; })()`;
  await padTap(page, 0);
  await sleep(700);
  const xb = await ev<{ pad: string | null; jump: string | null; mob: string | null; util: string | null; move: string | null; hide: string | null; vent: string | null; climb: string | null }>(page, rows);
  await ev(page, `window.__pad.id = "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)"`);
  await padTap(page, 0);
  await sleep(700);
  const ps = await ev<typeof xb>(page, rows);
  await ev(page, `document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyQ" })); document.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyQ" }));`);
  await sleep(700);
  const kb = await ev<typeof xb>(page, rows);
  check(
    "pad prompts: an unnamed pad in hand says Xbox's buttons (A, LB, RB, the left stick), a DualSense PlayStation's (cross, L1, R1), and a key turns them back to the keyboard's, the range's signs with them",
    xb.pad === "xbox" && xb.jump === "A" && xb.mob === "LB" && xb.util === "RB" && xb.move === "L-STICK" && xb.hide === "D-PAD →" && xb.vent === "B" && xb.climb === "the stick forward" &&
      ps.pad === "ps" && ps.jump === "✕" && ps.mob === "L1" && ps.util === "R1" && ps.vent === "○" &&
      kb.pad === null && kb.jump !== null && kb.jump !== "A" && kb.jump !== "✕" && kb.vent === "CTRL" && kb.climb === "W",
    JSON.stringify({ xb, ps, kb })
  );
  await page.close();
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
    // the match is there once the city's side is ready, which took 1.6 s on a quiet machine: a fixed 400 ms wait read it
    // before it was made, and the section ended there under load
    await page.waitForFunction("window.__range.duel() !== null", { polling: 100, timeout: 30000 }).catch(() => undefined);
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
  // and with no squad mate up, where a won Gulag drops you is in the final sector, which never decays (Milestone 733: the
  // ring's first round is the whole map, and a drop could land in a wave's sector, warned or decaying); forty picks
  const drops = await ev<{ out: number; worst: number; r: number }>(
    page,
    `(() => { const d = window.__range.duel(); const c = d.decayCircle; let out = 0, worst = 0;
      for (let i = 0; i < 40; i++) { const s = d.dropBackSpot(null); const e = Math.hypot(s.x - c.cx, s.z - c.cz); worst = Math.max(worst, e); if (e > c.r + 6) out++; }
      return { out, worst: Math.round(worst), r: Math.round(c.r) }; })()`,
  );
  check("the Gulag: won with no squad mate up, you drop back in the final sector, which never decays (forty picks)", drops.out === 0, JSON.stringify(drops));
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
  // (on the flag, at its height: THE GULAG's is on the ledge's top, Milestone 662)
  await ev(p2, `(() => { const d = window.__range.duel(); const f = d.gulagFlag.position; d.gulagBot.pos.set(f.x, f.y, f.z); d.gulagBot.dummy.group.position.set(f.x, f.y, f.z); })()`);
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
  // the guest is taken out (there are no knocks: at zero it is out)
  await ev(guest, "(() => { const d = window.__range.duel(); d.takeHit(500, 100); })()");
  await sleep(400);
  const heard = await host.waitForFunction("window.__range.duel().gulagIds.has(1)", { polling: 100, timeout: 5000 }).then(() => true, () => false);
  const gIn = await guest.waitForFunction("window.__range.duel().gulag && window.__range.duel().gulag.phase !== 'wait'", { polling: 100, timeout: (G.delay + 4) * 1000 }).then(() => true, () => false);
  check("the Gulag: a squad mate's trip reaches the host, and they go in", heard && gIn, JSON.stringify({ heard, gIn }));
  // up in the Gulag's room is not up in the match: the host's only mate is in there, so a knock now would be out, not down
  // (plan section 12, item 2: they counted as standing, and a knock went down to bleed out with nobody to come)
  await sleep(1500);
  const standing = await ev<boolean>(host, "window.__range.duel().squadUp()");
  check("the Gulag: a squad mate in the Gulag is not one standing", standing === false, String(standing));
  // the host brings them back at their echo meanwhile: that is their way back, and the trip is over
  await ev(host, `(() => { const r = window.__range; const d = r.duel(); const e = d.lootField ? [...d.lootField.drops.values()].find((x) => x.item.kind === "echo" && x.item.owner === 1) : undefined; d.sendRespawn(1, e ? e.pos.clone() : new r.THREE.Vector3(0, 0, 500), true); })()`);
  const rescued = await guest.waitForFunction("!window.__range.duel().gulag && window.__range.duel().alive", { polling: 100, timeout: 5000 }).then(() => true, () => false);
  const hostLeft = await host.waitForFunction("!window.__range.duel().gulagIds.has(1)", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  check("the Gulag: a squad mate's restore at your echo brings you back out of it, and the host hears the trip is over", rescued && hostLeft, JSON.stringify({ rescued, hostLeft }));
  // someone who leaves while in the Gulag is no longer in it (Milestone 726: they stayed in the host's count, and their
  // side was never out); a third player, 7, made up for it
  const leftIn = await ev<boolean>(host, `(() => { const d = window.__range.duel(); d.hearGulag(7, 1); d.playerGone(7, "left"); return d.gulagIds.has(7); })()`);
  check("the Gulag: someone who leaves while in the Gulag is no longer counted in there", leftIn === false, String(leftIn));
  // a pickup granted to the guest after they are out goes back on the floor, not into their slots (Milestone 726)
  const late = await ev<{ key: number; taken: boolean; slots: string; back: boolean } | null>(
    guest,
    `new Promise((ok) => { const R = window.__range; const d = R.duel(); const f = d.lootField; const drop = f && [...f.drops.values()].find((x) => x.item.kind === "weapon");
      if (!drop) return ok(null); const was = drop.pos.clone(); const before = R.loadout.slots.map((s) => s.id).join(); let taken = false; const on = d.onLootTaken; d.onLootTaken = (it) => { taken = true; on?.(it); };
      d.alive = false; d.onExtra({ t: "loot", op: "gone", key: drop.key, by: d.id }, 0); d.alive = true; d.onLootTaken = on;
      setTimeout(() => ok({ key: drop.key, taken, slots: before === R.loadout.slots.map((s) => s.id).join() ? "same" : "changed", back: [...f.drops.values()].some((x) => x.item.id === drop.item.id && x.pos.distanceTo(was) < 0.5) }), 800); })`,
  );
  check("the Gulag: a pickup granted after you are out goes back on the floor where it lay, not into your slots", !!late && !late.taken && late.slots === "same" && late.back, JSON.stringify(late));
  // the host's own trip, won: back in the match, its first death's echo gone (Milestone 726: left on the floor, a restore
  // at it stood you up at the old spot and gave back a later death's kit as well)
  await ev(host, "(() => { const d = window.__range.duel(); d.takeHit(500, 100); })()");
  const hostIn = await host.waitForFunction("window.__range.duel().gulag && window.__range.duel().gulag.phase !== 'wait' && window.__range.duel().gulagBot", { polling: 100, timeout: (G.delay + 6) * 1000 }).then(() => true, () => false);
  await ev(host, "(() => { const b = window.__range.duel().gulagBot; if (b) b.dummy.hit(0, 'body', 500, 1, 1, b.dummy.group.position); })()");
  const hostBack = await host.waitForFunction("!window.__range.duel().gulag && window.__range.duel().alive", { polling: 100, timeout: (G.after + 6) * 1000 }).then(() => true, () => false);
  await sleep(800);
  const echoLeft = await ev<boolean>(host, `(() => { const d = window.__range.duel(); return !!d.lootField && [...d.lootField.drops.values()].some((x) => x.item.kind === "echo" && x.item.owner === d.id); })()`);
  check("the Gulag: won, your first death's echo is gone from the floor", hostIn && hostBack && echoLeft === false, JSON.stringify({ hostIn, hostBack, echoLeft }));
  // a squad mate losing the Gulag while the rest are out ends it on the host (Milestone 726: the loss came before the
  // state saying they were down, the squad was judged with them standing, and the match ran on with nobody up). The
  // host made out, the guest sent in and losing, as their pages would say it
  const mateLost = await ev<{ over: boolean; phase: string }>(
    host,
    `new Promise((ok) => { const d = window.__range.duel(); d.alive = false; d.hearGulag(1, 1); const r = d.remotes.get(1); if (r) r.alive = true; d.hearGulag(1, 0);
      setTimeout(() => ok({ over: !!d.brOver, phase: d.phase }), 300); })`,
  );
  check("the Gulag: the last squad mate losing it, the rest out, ends the match on the host", mateLost.over, JSON.stringify(mateLost));
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
  await ev(host, "(() => { const p = window.__range.player.eyePosition(); window.__range.duel().localShot(p, new window.__range.THREE.Vector3(0, 0, -1), 'vinson'); })()");
  const lit = await guest.waitForFunction(`(window.__range.duel().remotes.get(0)?.avatar.flashFrames ?? -1) > ${f0}`, { polling: 50, timeout: 3000 }).then(() => true, () => false);
  await sleep(400);
  const out = await ev<boolean>(guest, "!window.__range.duel().remotes.get(0)?.avatar.flashShown");
  check("muzzle flash: the host fires and the guest's figure of the host flashes at the muzzle, then goes out", f0 >= 0 && lit && out, JSON.stringify({ f0, lit, out }));
  // the host fires into the floor: where it lands is marked on the guest's screen too
  const i0 = await ev<number>(guest, "window.__range.impacts()");
  await ev(host, "(() => { const p = window.__range.player.eyePosition(); window.__range.duel().localShot(p, new window.__range.THREE.Vector3(0, -1, -1).normalize(), 'vinson'); })()");
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
  // a capture under way, the host's own side holding it (set by hand: the zone opens late), heard by the guests as its
  // meter (Milestone 728: it started again from nothing on the heir)
  const holdKey = await ev<number>(host, "(() => { const d = window.__range.duel(); const k = d.sideOf(d.id); d.capture.holder = k; d.capture.held = 7.3; d.capture.progress.set(k, 7.3); return k; })()");
  await heir.waitForFunction(`window.__range.duel().capture.holder === ${holdKey}`, { polling: 100, timeout: 4000 }).catch(() => undefined);
  // A pickup a moment before the host goes. The item is off every floor the moment it is taken, so the heir has to hear
  // of it soon (duel.ts heirSoon), not at the next second's snapshot: a takeover from the snapshot before it rebuilt the
  // bot without the item, and it was gone from the match (a gun lost so, 2026-10-12). Taken here through the bot's own
  // take, as its looting takes one, with its kit set as the looting would set it.
  const late = await ev<{ index: number; gun: string } | null>(
    host,
    `(() => { const d = window.__range.duel(); const f = d.lootField; const b = d.bots.find((x) => x.bot.alive && !x.bot.aboard && !x.down && x.bot.lootSource); if (!f || !b) return null; const gun = b.bot.lootKit.gunId === "sentinel" ? "r97" : "sentinel"; const key = f.add({ kind: "weapon", id: gun, n: 1, rarity: "epic" }, b.bot.pos.clone()); const it = b.bot.lootSource.take(key); if (!it) return null; b.bot.looter.kit.gunId = it.id; return { index: b.bot.index, gun }; })()`,
  );
  await sleep(200);
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
  // the heir's ring closes on the final sector, as the first host's did (Milestone 726: it drew the seed's own circles,
  // and the bots fled the decay, packages fell and a won Gulag dropped toward them)
  if (took) {
    const meter = await ev<number | null>(heir, `window.__range.duel().capture.progress.get(${holdKey}) ?? null`);
    check(`${label}: the heir carries on the capture's meter where the old host had it`, meter !== null && Math.abs(meter - 7.3) < 0.15, JSON.stringify({ holdKey, meter }));
    const onFinal = await ev<boolean>(heir, `(() => { const d = window.__range.duel(); const c = d.decayCircle; return !!d.ring && !!c && d.ring.plan.every((q) => Math.abs(q.cx - c.cx) < 0.01 && Math.abs(q.cz - c.cz) < 0.01); })()`);
    check(`${label}: the heir's ring closes on the final sector, as the first host's did`, onFinal);
  }
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
  // armour tier with the same gun (2026-09-29). The guns the same (a fifth swapped allowed, one at least: SpeedKills'
  // 27 bots swapped four in the takeover's few seconds, the legacy game's six one), and nobody's gun or armour lost, is a
  // kit carried; a reset or a lost kit still fails.
  const part = (k: string) => {
    const [, gun, armor] = k.split(":");
    return { gun, armor: Number(armor) };
  };
  const kitSame = after.kits.filter((k, i) => part(k).gun === part(kits[i] ?? "").gun).length;
  const kitLost = after.kits.filter((k, i) => (part(kits[i] ?? "").gun !== "" && part(k).gun === "") || part(k).armor < part(kits[i] ?? "").armor).length;
  check(
    `${label}: the same bots, each with its tier and squad and (nearly all) the kit it had looted, run by the new host`,
    roster.length > 0 && after.roster.join() === roster.join() && after.figures === 0 && kitSame >= kits.length - Math.max(1, Math.ceil(kits.length * 0.2)) && kitLost === 0 && kits.filter((k) => k.split(":")[1]).length >= 4 && after.phase === "fight",
    JSON.stringify({ roster, after: after.roster, kits, afterKits: after.kits, figures: after.figures })
  );
  const lateKit = late ? after.kits.find((k) => k.split(":")[0] === String(late.index)) : undefined;
  check(`${label}: a gun a bot picked up 0.2 s before the host left is still in its hands after the takeover`, !!late && lateKit?.split(":")[1] === late.gun, JSON.stringify({ late, lateKit }));
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
  // and in the moment it is gone, the guest puts a gun down (as a death's drop would): it reaches the match once the guest
  // is back (Milestone 729: said with no host to say it to, it went nowhere, and the guns were gone from the match)
  const putAt = await ev<number[]>(guest, `(() => { const R = window.__range; window.__match = R.duel(); const d = R.duel(); d.dropHostLink(); const p = R.player.pos;
    d.dropLoot({ kind: "weapon", id: "mastiff", n: 1, rarity: "epic", fusion: 0 }, new R.THREE.Vector3(p.x + 2, p.y, p.z)); return [p.x + 2, p.y, p.z]; })()`);
  const back = await guest.waitForFunction("window.__range.duel()?.reconnectUntil === null", { polling: 200, timeout: 20000 }).then(() => true, () => false);
  const gotDrop = await host.waitForFunction(`(() => { const f = window.__range.duel().lootField; return !!f && [...f.drops.values()].some((x) => x.item.id === "mastiff" && x.item.rarity === "epic" && Math.hypot(x.pos.x - ${putAt[0]}, x.pos.z - ${putAt[2]}) < 1.5); })()`, { polling: 200, timeout: 6000 }).then(() => true, () => false);
  check("getting back in: what the guest said while it had no host (a gun put down) reaches the match once it is back", back && gotDrop, JSON.stringify({ back, gotDrop, putAt }));
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
  // (the two duos and the bots' own: one bot duo in the legacy game's match of two bots, as many as fill SpeedKills' thirty)
  const botSquads = await ev<number>(host, "new Set(window.__range.duel().bots.map((b) => b.team)).size");
  const total = 2 + botSquads;
  const want = (s: { id: number; allies: number[]; jm: number | null; lead: boolean; total: number }) => {
    const mate = s.id ^ 1;
    const first = s.id & 2;
    return s.allies.length === 1 && s.allies[0] === mate && s.lead === (s.id === first) && s.jm === (s.id === first ? null : first) && s.total === total;
  };
  check(`squads of friends: split into two duos by join order, each led down by its first, ${total} squads with the bots'`, sides.every(want), JSON.stringify(sides));
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
  // the host takes out player 2: player 3, its mate, is up, so 2 is a ghost to be restored (SpeedKills has no knockdown)
  const hit = (to: number) => ev(host, `(() => { const d = window.__range.duel(); const r = d.remotes.get(${to}); d.localHit(r, 250, true); })()`);
  await hit(2);
  const ghost2 = await by(2).waitForFunction("!window.__range.duel().alive && window.__range.duel().ghost", { polling: 100, timeout: 5000 }).then(() => true, () => false);
  check("squads of friends: the host's shots hurt the other duo, and one of it is a ghost with its mate up", ghost2, `the host's map shows ${mapped} mate(s)`);
  check("squads of friends: the map shows your duo only", mapped === 1, `${mapped}`);
  // then 3: nobody of that duo is up, so 3 is out, and 2, a ghost, goes with it (the duo still standing is the other side)
  await hit(3);
  const out = await Promise.all([2, 3].map((id) => by(id).waitForFunction("!window.__range.duel().alive && !window.__range.duel().ghost", { polling: 100, timeout: 6000 }).then(() => true, () => false)));
  check("squads of friends: the last of a duo out is out, and its ghost goes with it", out.every(Boolean), JSON.stringify(out));
  const going = await ev<string>(host, "window.__range.duel().phase");
  check("squads of friends: the match goes on for the duo still standing", going === "fight", going);
  // the bots go: the host's duo is the one left
  await ev(host, `(() => { const d = window.__range.duel(); for (let k = 0; k < 4; k++) for (const b of d.bots) if (b.bot.remote.alive) d.onHitOther(b.bot.remote.id, 999, true, d.id); })()`);
  const ends = await Promise.all(pages.map((p) => p.waitForFunction(`window.__range.duel()?.phase === "matchEnd"`, { polling: 100, timeout: 10000 }).then(() => true, () => false)));
  const placed = await Promise.all(pages.map((p) => ev<{ id: number; p: number | null } | null>(p, "(() => { const d = window.__range.duel(); return d ? { id: d.id, p: d.placement } : null; })()")));
  const right = placed.every((x) => !!x && x.p === (x.id < 2 ? 1 : total));
  check(`squads of friends: the host's duo wins, and the other duo placed last of ${total}, both of it`, ends.every(Boolean) && right, JSON.stringify({ ends, placed }));
  for (const p of pages) await p.close();
}

/**
 * Solo with friends: everyone against everyone. Friends in a solo battle
 * royale could not hurt each other, and two left alive both "won" when the
 * bots were gone. The host knocks the guest (in solo a knock is the end), the
 * match goes on, and once the bots are gone the host has won and the guest
 * placed last of every side.
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
  // The loot's look on the floor (Milestone 719, the owner, 2026-10-23: "remove the beams of light up in the air as
  // well for weapons/hacks, just keep the circle around it on the ground"): guns and hack cores stand in no beam, an
  // echo alone keeps one (loot.json beam.kinds), and every gun in draw distance has its ring on the ground
  const beams = await ev<{ guns: number; echoes: number; beams: number; rings: number }>(
    host,
    `(() => {
      const f = window.__range.duel().lootField;
      let guns = 0, echoes = 0;
      for (const d of f.drops.values()) if (d.obj.visible) { if (d.item.kind === "weapon") guns++; if (d.item.kind === "echo") echoes++; }
      let beams = 0, rings = 0;
      f.group.traverse((o) => { if (o.name === "loot:beam") beams += o.count; if (o.name === "loot:ring") rings += o.count; });
      return { guns, echoes, beams, rings };
    })()`,
  );
  check(
    "the loot on the floor: no beam over a gun or a hack core, an echo's alone, and every gun in draw distance on its ring",
    beams.guns > 5 && beams.beams === beams.echoes && beams.rings >= beams.guns,
    JSON.stringify(beams),
  );
  // the carry card on Tab (Milestone 706): both guns with their fusion and what it gives, both hacks with their cooldown
  // and what they do, your shield and health; not the legacy game's pack (ammo by kind, attachments, the dummy's armour)
  await ev(host, "(() => { const r = window.__range; r.loadout.slots[0].fusion = 2; r.input.locked = true; r.input.down.add('Tab'); })()");
  await sleep(400);
  const card = await ev<{ guns: Array<[string | null, number, number]>; hacks: Array<[string, boolean, boolean] | null>; vitals: boolean; legacy: boolean } | null>(
    host,
    `(() => { const v = window.__range.hud.last?.inventory ?? null; return v ? { guns: v.guns.map((g) => [g.id ?? null, g.level ?? -1, (g.perks ?? []).length]), hacks: (v.hacks ?? []).map((h) => h && [h.id, h.cooldown > 0, (h.blurb ?? "").length > 0]), vitals: !!v.vitals, legacy: "ammo" in v || "armor" in v } : null; })()`,
  );
  // and its hint says the key on the device in hand (Milestone 721): TAB on a keyboard, none on a pad, which has no
  // button for it (it said HOLD TAB to a pad player)
  const keyOf = await ev<{ keys: string | null; pad: string | null }>(
    host,
    `new Promise((ok) => { const r = window.__range; const keys = r.hud.last?.inventory?.key ?? null; r.input.device = "pad";
      setTimeout(() => { const pad = r.hud.last?.inventory?.key ?? null; r.input.device = "keyboard"; ok({ keys, pad }); }, 300); })`,
  );
  await ev(host, "(() => { const r = window.__range; r.input.down.delete('Tab'); r.loadout.slots[0].fusion = 0; })()");
  check("the carry card's hint is the key on the device in hand: TAB on a keyboard, none on a pad", keyOf.keys === "TAB" && keyOf.pad === "", JSON.stringify(keyOf));
  check(
    "the carry card on Tab: both guns with their fusion and what it gives, both hacks with their cooldown and what they do, your vitals, no legacy pack",
    !!card && card.guns.length === 2 && card.guns[0][1] === 2 && card.guns[0][2] > 0 && card.hacks.length === 2 && card.hacks.every((h) => !!h && h[1] && h[2]) && card.vitals && !card.legacy,
    JSON.stringify(card),
  );
  // someone under INVISIBILITY past seenWithin shimmers (Milestone 715, the owner: "barely visible but still noticeable"):
  // the figure itself hidden, as it was, and its shimmer drawn instead; within seenWithin it is whole, no shimmer. The
  // guest, as the host sees it (a player's figure; the bots never go unseen)
  const cloak = await ev<{ far: { visible: boolean; on: number; amount: number; shot: boolean | null; flared: number } | null; near: { visible: boolean; on: number } | null; off: { on: number } | null } | null>(
    host,
    `new Promise((ok) => { const R = window.__range; const d = R.duel(); const a = d.avatars.find((x) => d.remoteOf(x)?.id === 1);
      if (!a) return ok(null); const id = d.remoteOf(a).id; const q = a.group.position;
      R.sk.remoteHack(id, 5, q.x, q.y, q.z, 30);
      const read = () => { const s = a.cloakState(); return { visible: a.group.visible, on: s ? s.on : 0, amount: s ? s.amount : 0 }; };
      R.player.teleport(q.x + 15, q.y, q.z, 90, 0);
      setTimeout(() => { const far = { ...read(), shot: R.sk.inReach(id) }; a.hit(R.gameTime(), "body", 1, 1, 1, a.group.position.clone());
        setTimeout(() => { far.flared = a.cloakState().amount; R.player.teleport(a.group.position.x + 2, a.group.position.y, a.group.position.z, 90, 0);
        setTimeout(() => { const near = read(); R.sk.remoteHack(id, 5, q.x, q.y, q.z, 0);
          R.player.teleport(a.group.position.x + 15, a.group.position.y, a.group.position.z, 90, 0);
          setTimeout(() => ok({ far, near, off: { on: read().on } }), 600); }, 600); }, 60); }, 600); })`,
  );
  check(
    "INVISIBILITY: someone unseen past seenWithin is hidden and shimmers, a round still finds them and flares it; close, whole and no shimmer; over, no shimmer",
    !!cloak?.far && !cloak.far.visible && cloak.far.on > 0 && cloak.far.amount > 0 && cloak.far.shot === true && cloak.far.flared > cloak.far.amount && !!cloak.near && cloak.near.visible && cloak.near.on === 0 && cloak.off?.on === 0,
    JSON.stringify(cloak),
  );
  // a gun swapped while unseen (Milestone 723): the shimmer's copies stayed on the old gun when the new one had as many
  // meshes, drawn where the old gun was left (the world's origin), the new gun bare; and a figure taken out for another
  // look while unseen left its shimmer standing. The swap made exactly: one of the guest's meshes swapped for a copy of
  // itself, the count the same and the old one out of the figure, as a gun with as many meshes does
  const swap = await ev<{ swapped: boolean; on: number; outside: number; oldOn: number } | null>(
    host,
    `new Promise((ok) => { const R = window.__range; const d = R.duel(); const a = d.avatars.find((x) => d.remoteOf(x)?.id === 1);
      if (!a) return ok(null); const r = d.remoteOf(a); const q = a.group.position;
      R.sk.remoteHack(1, 5, q.x, q.y, q.z, 30); R.player.teleport(q.x + 15, q.y, q.z, 90, 0);
      // (one the shimmer copies and draws: outline.ts figureMeshes' own test, and shown; a plain one first, a skinned one
      // shares its skeleton)
      const copied = (o) => { if (!o.isMesh || o.userData.hull || !o.parent || !o.geometry.getAttribute("normal") || Array.isArray(o.material) || o.material.transparent || !o.material.visible) return false; for (let p = o; p; p = p.parent) if (p === a.hits) return false; for (let p = o; p && p !== a.group; p = p.parent) if (!p.visible) return false; return true; };
      setTimeout(() => { let m = null, sk = null; a.group.traverse((o) => { if (!copied(o)) return; if (!o.isSkinnedMesh) m ??= o; else sk ??= o; }); m ??= sk;
        const parent = m && m.parent; const twin = m && m.clone(); if (m) { parent.add(twin); m.removeFromParent(); }
        setTimeout(() => { const s = a.cloakState(); if (m) { twin.removeFromParent(); parent.add(m); }
          const op = r.avatarOp; d.setAvatarLook(r, r.avatarWeapon, op + "-e2e", r.avatarLook); const oldOn = a.cloakState().on; d.setAvatarLook(r, r.avatarWeapon, op, r.avatarLook);
          R.sk.remoteHack(1, 5, q.x, q.y, q.z, 0); ok({ swapped: !!m, on: s ? s.on : 0, outside: s ? s.outside : -1, oldOn }); }, 400); }, 600); })`,
  );
  check("INVISIBILITY: a gun swapped while unseen carries the shimmer, none left where the old gun went", !!swap && swap.swapped && swap.on > 0 && swap.outside === 0, JSON.stringify(swap));
  check("INVISIBILITY: a figure swapped for another look while unseen leaves no shimmer standing", !!swap && swap.oldOn === 0, JSON.stringify(swap));
  // the host knocks the guest: in solo that is the end of them
  await ev(host, `(() => { const d = window.__range.duel(); const r = [...d.remotes.values()].find((x) => x.id === 1); d.localHit(r, 250, true); })()`);
  const out = await guest.waitForFunction("!window.__range.duel().alive", { polling: 100, timeout: 6000 }).then(() => true, () => false);
  // (no ghost: in SpeedKills one is left to be restored only with a squad mate up, and in solo the one human still
  // standing is an opponent; it counted as a mate before Milestone 499, and the guest was a ghost nobody could restore)
  const ghost = await ev<boolean>(guest, "!!window.__range.duel().ghost");
  check("solo with a friend: the host's shots hurt the guest, and that is the end, no ghost", out && !ghost, JSON.stringify({ out, ghost }));
  // out, the guest is not told it is in the decay, which cannot hurt it (Milestone 733: a ghost waiting on its squad
  // walked the decayed streets under IN THE DECAY); everywhere made a lost sector for the moment
  const ghostWarned = await ev<{ alive: boolean; outside: boolean | null }>(
    guest,
    `(() => { const d = window.__range.duel(); d.lostAt = () => true; const o = d.hud().br?.ring?.outside ?? null; delete d.lostAt; return { alive: d.alive, outside: o }; })()`,
  );
  check("solo with a friend: out, the guest is not warned it is in the decay, which cannot hurt it", !ghostWarned.alive && ghostWarned.outside === false, JSON.stringify(ghostWarned));
  await sleep(1000);
  const going = await ev<string>(host, "window.__range.duel().phase");
  check("solo with a friend: the match goes on for the host", going === "fight", going);
  // and the guest, out of it, watches whoever is left rather than a black
  // screen: their squad first, then the nearest, and they choose which
  // (docs/NEXT_STEPS.md item 7)
  // the end of it (Milestone 708): with the death recap up and the match card with it (the last of a battle royale's
  // players out: the match ends as the recap opens), the two stand side by side, not one over the other (centred, the
  // card's rows ran through the recap's title), both on the screen. The guest's own recap, with a battle royale's card
  // (its four rows) beside it: here the host plays on, so the guest's match has not ended.
  {
    await ev(guest, "window.__range.skipKillcam()");
    const up = await guest.waitForFunction("!!window.__range.hud.last?.recap", { polling: 200, timeout: 15000 }).then(() => true, () => false);
    const lay = await ev<{ recap: { x: number; y: number; w: number; h: number } | null; card: { x: number; y: number; w: number } | null; cardH: number; W: number; H: number } | null>(
      guest,
      `(() => { const h = window.__range.hud; const l = h.last; if (!l || !l.recap) return null; const u = h.h / 1080;
        const summary = { alpha: 1, rows: [["Kills", "0"], ["Damage", "0"], ["Accuracy", "-"], ["Survived", "0:31"]], lines: [] };
        // (as a battle royale's end has it: the placement up, which puts the card under the placement's line)
        const duel = l.duel && l.duel.br ? { ...l.duel, br: { ...l.duel.br, placement: 15 } } : l.duel;
        const L = h.endLayout({ ...l, summary, duel }, u);
        return { ...L, cardH: (118 + 4 * 22 + 46) * u, W: h.w, H: h.h }; })()`,
    );
    const apart = !!lay?.recap && !!lay.card && (lay.card.x >= lay.recap.x + lay.recap.w || lay.card.x + lay.card.w <= lay.recap.x || lay.card.y >= lay.recap.y + lay.recap.h || lay.card.y + lay.cardH <= lay.recap.y);
    const inside = !!lay?.recap && !!lay.card && lay.recap.x >= 0 && lay.card.x + lay.card.w <= lay.W && lay.recap.y + lay.recap.h <= lay.H && lay.card.y + lay.cardH <= lay.H;
    check("out, the death recap and a match card stand side by side on the screen, not one over the other", up && apart && inside, JSON.stringify({ up, lay }));
  }
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
  // A capture's result, a side at a time (Milestone 727): the guest, out early, is told the place it went out in, whether
  // a bot squad or the host's side holds the zone; every side was told the same place. The host's own end and what it
  // sends are held back here, and the match put back as it was, so it plays on to the end below
  const capture = await ev<{ out: number | null; byBots: number | null; byHost: number | null }>(
    host,
    `(() => { const d = window.__range.duel(); const out = d.placedAt.get(d.sideOf(1)) ?? null; const link = d.links.get(1); const snd = link.send; const fin = d.finishBr;
      const told = []; d.finishBr = () => undefined; link.send = (m) => { if (m.t === "brend") told.push(m.placement); else snd.call(link, m); };
      const run = (zone, at) => { d.captureZone = () => zone; d.capture.progress.clear(); d.updateCapture(9999, { x: at.x, y: 0, z: at.z }); d.brOver = false; delete d.captureZone; };
      const b = d.bots.find((x) => x.bot.alive && !x.bot.dropping);
      if (b) run({ x: b.bot.pos.x, z: b.bot.pos.z, r: 0.2 }, { x: 1e5, z: 1e5 });
      const byBots = told.length ? told[told.length - 1] : null;
      const me = window.__range.player.pos; run({ x: me.x, z: me.z, r: 0.2 }, { x: me.x, z: me.z });
      const byHost = told.length > 1 ? told[told.length - 1] : null;
      d.finishBr = fin; link.send = snd; d.capture.progress.clear(); d.capture.holder = -1; d.capture.held = 0;
      return { out, byBots, byHost }; })()`,
  );
  check("solo with a friend: a capture places a side already out where it went out, whether bots or a side of players hold the zone", capture.out !== null && capture.byBots === capture.out && capture.byHost === capture.out, JSON.stringify(capture));
  // the bots go: one side is left, the host's
  await ev(host, `(() => { const d = window.__range.duel(); for (const b of d.bots) if (b.bot.alive) d.onHitOther(b.bot.remote.id, 999, true, d.id); })()`);
  const ends = await Promise.all([host, guest].map((p) => p.waitForFunction(`window.__range.duel()?.phase === "matchEnd"`, { polling: 100, timeout: 8000 }).then(() => true, () => false)));
  const placed = await Promise.all([host, guest].map((p) => ev<{ p: number | null; of: number } | null>(p, "(() => { const d = window.__range.duel(); return d ? { p: d.placement, of: d.squadsTotal } : null; })()")));
  // (last of every side: seven in the legacy game's match of five bots, 31 in SpeedKills' thirty)
  check("solo with a friend: the host wins, and the guest placed last of every side", ends.every(Boolean) && placed[0]?.p === 1 && !!placed[1] && placed[1].p === placed[1].of && placed[1].of > 2, JSON.stringify({ ends, placed }));
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
  // (a bot's knock, its revive and a finisher on it were checked here: SpeedKills has no knockdowns, Milestone 499)
  await ev(page, "window.__range.duel()?.leave()");
  await page.close();
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
      const row = { id: 101, name: "BOT GRIM", killer: true, dealt: { damage: 40.66666666666667, hits: 3, heads: 0 }, taken: { damage: 531.16, hits: 3, heads: 0 }, guns: [{ name: "STRYDER", hits: 3, damage: 531.16, near: 12.34, far: 12.34 }], left: { shield: 0.4, health: 0.3 } };
      h.draw(now, r.camera, { ...base, killcam: null, course: null, drill: null, trainer: null, tutorial: null, hacks: null, ability: null,
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
 * Milestone 694: a shield as the shooter sees it, on a range dummy given a blue shield. A round on it flares the figure
 * in the shield's colour (dummy.ts shieldHit, outline.ts ShieldShell), gone in a fifth of a second; the round that
 * takes the last of it flares it brighter, bursts it off in shards (fx.ts ShardBurst) and gets a marker of its own. The
 * page builds the shell's shaders at load (the page section checks it: this page draws nothing).
 */
async function skShieldFx(page: Page): Promise<void> {
  await ev(page, `(() => { const r = window.__range; r.sk.setFusion(0, 0); r.loadout.setWeaponId(0, "r97"); })()`);
  await sleep(1600);
  const pick = await ev<{ i: number; shield: number; color: number } | null>(
    page,
    `(() => { const r = window.__range; const d = r.dummies.find((x) => x.group.visible && !x.knocked); if (!d) return null; d.setTier(2); d.reset(); const p = d.group.position; r.player.teleport(p.x, 0, p.z + 6, 0, 0); return { i: r.dummies.indexOf(d), shield: d.shield, color: 0x3b8bff }; })()`,
  );
  if (!pick || pick.shield <= 0) {
    check("shield fx: a range dummy with a shield to shoot", false, JSON.stringify(pick));
    return;
  }
  await sleep(300);
  const fire = () => ev(page, `(() => { const r = window.__range; const d = r.dummies[${pick.i}]; const p = d.chestAt(); const eye = r.player.eyePosition(); r.fireRound([p.x - eye.x, p.y - eye.y, p.z - eye.z]); })()`);
  await fire();
  const flared = await page.waitForFunction(`(() => { const s = window.__range.dummies[${pick.i}].shellState(); return !!s && s.on > 0 && s.amount > 0 && s.color === ${pick.color}; })()`, { polling: 30, timeout: 10000 }).then(() => true, () => false);
  const lit = await ev(page, `window.__range.dummies[${pick.i}].shellState()`);
  check("shield fx: a round on a dummy's blue shield flares the figure in the shield's blue", flared, JSON.stringify(lit));
  await gameSleep(page, 1);
  const gone = await ev<{ on: number; amount: number } | null>(page, `window.__range.dummies[${pick.i}].shellState()`);
  check("shield fx: and the flare is gone a moment later (hud.json shieldFx.flare)", !!gone && gone.on === 0 && gone.amount === 0, JSON.stringify(gone));
  // to the round that breaks it: the marker, the shards and the brighter flare read as it lands
  let broke: { kind: string; shards: number; amount: number; shield: number } | null = null;
  for (let n = 0; n < 20 && !broke; n++) {
    await fire();
    broke = await page
      .waitForFunction(`(() => { const r = window.__range; const d = r.dummies[${pick.i}]; return d.shield <= 0 ? { kind: r.hud.hitMarkerKindNow, shards: r.sk.shards(), amount: d.shellState()?.amount ?? 0, shield: d.shield } : null; })()`, { polling: 30, timeout: 1500 })
      .then((h) => h.jsonValue() as Promise<{ kind: string; shards: number; amount: number; shield: number }>, () => null);
  }
  check(
    "shield fx: the round that takes the last of the shield gets its own marker, bursts it off in shards and flares brighter",
    !!broke && broke.kind === "break" && broke.shards > 0 && broke.amount > 1,
    JSON.stringify(broke),
  );
  await ev(page, `(() => { const d = window.__range.dummies[${pick.i}]; d.setTier(0); d.reset(); })()`);
}

/**
 * SpeedKills (docs/PHASE_18_PLAN_SPEEDKILLS.md), on a page that asks for it:
 * the front door, the ten guns, fusion, the health model, and every hack doing
 * what its card says. The rest of the suite tests SpeedKills' shared systems.
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
    const page = await open(browser, "?", BASE, `try { localStorage.setItem("range.quality", "${preset}"); } catch {}`);
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
  const page = await open(browser, "?");
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
  // The volume's middle is its ellipsoid's (Milestone 560, mannequin.ts headShape), which the skull's own extremes place:
  // measured 47 mm from the middle of every point the Head bone carries, the jaw and the face pulling that one down and
  // forward, in every pose (2026-10-12). A volume that stops following the head moves off it by far more.
  const bad = heads.map((h, i) => ({ pose: HIT_POSES[i][0], ...h })).filter((h) => !h.soldier || h.n < 100 || h.offset > 0.055 || h.inside < 0.8);
  check(
    "soldier: its head sits in the head's hit volume standing, aiming, walking, running, sprinting, crouched and sliding (the middle within 55 mm, 80% of it inside)",
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
      // until the figure holds a gun, 10 s at the most: its soldier and gun come in on frames of their own (a fixed 600 ms
      // found none in the sweep and a rerun alone, 2026-10-13)
      const t2 = performance.now();
      while (!fig?.mq?.gun && performance.now() - t2 < 10000) await wait(50);
      const figure = fig?.mq?.gun?.userData?.paid ?? (fig?.mq?.gun ? "a gun, not the paid one" : null);
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
  // fitted optic not drawn on top of them (CHOOCH's and BOOG's); DEVINOS takes out a magazine on a reload (its procedural
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
    "soldier guns: the pack's parts move, CHOOCH's drum a chamber a shot with its trigger back through a burst; CHOOCH and BOOG aimed down their own sights, no fitted optic drawn over them; and DEVINOS's magazine out on a reload",
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
      // (ANAKIN, and DEVINOS on BOOG's model: the USSO and BOOG are held by the bought arms where their files are here)
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
  // USSO's phase down to nothing and brings BOOG's up whole, the gun never dropped out of the frame; and STRYDER, drawn
  // after, comes up whole too (every gun has its feel since Milestone 516: the check's old "STRYDER has no phase" half
  // read its feel as missing and failed on a gun that phases as the others do)
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
  // (a page call a step: the soldier section draws in software, and on a loaded machine the page ran so slowly that 30 s
  // waited on the charge had it at 0.67 and 0.96, and the next call ran past a page call's 120 s; the lobby agent's
  // sweep and a rerun alone, 2026-10-16)
  const gameWaitJs = `const wait = (ms) => new Promise((ok) => setTimeout(ok, ms)); const gameWait = async (s) => { const g0 = r.gameTime(); const t0 = performance.now(); while (r.gameTime() - g0 < s && performance.now() - t0 < 30000) await wait(20); };`;
  const boogShot = await ev<{ after: number | null }>(
    page,
    `(async () => {
      const r = window.__range;
      ${gameWaitJs}
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
      return { after: r.gunFeel().charge };
    })()`,
  );
  // whole again after the rechamber (BOOG's is over two seconds), waited on the charge itself: it counts on the view's
  // own clock, whose step a slow frame caps, so 6 s of game time under load had it at 0.95 (the lobby agent's sweep,
  // 2026-10-13, twice alone), and 30 s of the page's time at 0.67 (2026-10-16)
  const boogLater = await ev<number | null>(
    page,
    `(async () => {
      const r = window.__range;
      ${gameWaitJs}
      const t0 = performance.now();
      while (r.gunFeel().charge !== 1 && performance.now() - t0 < 90000) await wait(50);
      return r.gunFeel().charge;
    })()`,
  );
  const boogGlow = await ev<number>(
    page,
    `(async () => {
      const r = window.__range;
      ${gameWaitJs}
      r.debugView.inspect = 0.3;
      await gameWait(0.2);
      const glow = r.gunFeel().rim;
      r.debugView.inspect = null;
      return glow;
    })()`,
  );
  const boog = { ...boogShot, later: boogLater, glow: boogGlow };
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
  // (a page call a gun: both in one ran past a page call's 120 s with the soldier section drawing in software on a
  // loaded machine, 2026-10-16)
  const twistPoint: { pack: boolean; roll: Record<string, number>; point: Record<string, Point> } = { pack: false, roll: {}, point: {} };
  for (const gunId of ["r97", "sentinel"]) {
    const one = await ev<{ pack: boolean; roll: Record<string, number>; point: Record<string, Point> }>(
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
        for (const id of [${JSON.stringify(gunId)}]) {
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
    twistPoint.pack ||= one.pack;
    Object.assign(twistPoint.roll, one.roll);
    Object.assign(twistPoint.point, one.point);
  }
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
    "soldier guns: the USSO phases out of the hands and BOOG in, whole at the end and drawn; STRYDER drawn after is whole too",
    phased.low.r97 < 0.2 && phased.low.sentinel < 0.2 && phased.end.gun === "sentinel" && phased.end.phase === 1 && phased.end.shown && phased.plain.gun === "autopistol" && phased.plain.phase === 1,
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
  await bare.goto(`${BASE}?nointro`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await bare.waitForFunction("Boolean(window.__range) && window.__range.loaded()", { polling: 250, timeout: 60000 }).catch(() => undefined);
  await ev(bare, "window.__range.loadMannequin()").catch(() => undefined);
  await ev(bare, `(() => { const r = window.__range; r.player.teleport(0, 0, 0, 0, 0); r.figureLab([{ speed: 0, stance: "stand", pitch: 0 }], 4, 0); })()`);
  await gameSleep(bare, 3);
  const fell = await ev<{ soldier: boolean; guns: boolean; figure: boolean; mq: boolean }>(
    bare,
    "(() => { const r = window.__range; const f = r.labFigures()[0]; return { soldier: r.soldierReady(), guns: r.paidGuns().ready, figure: !!f, mq: !!f?.mq }; })()",
  );
  const crashed = errors.slice(before).filter((e) => e.startsWith("pageerror"));
  // (the old game's body stood in here until Milestone 568, and our robot until 569: without the soldier a figure is its
  // hit volumes alone)
  check("soldier: without the bought files the figures are their hit volumes alone and the guns those of before, and nothing throws", !fell.soldier && !fell.guns && fell.figure && !fell.mq && crashed.length === 0, JSON.stringify({ ...fell, crashed: crashed.slice(0, 2) }));
  await bare.close();
  // the 404s were the point of that page, not a fault: only what it threw stays counted
  for (let i = errors.length - 1; i >= before; i--) if (!errors[i].startsWith("pageerror")) errors.splice(i, 1);
}

async function speedkillsTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?norender");
  const front = await ev<{ game: string; html: string; br: boolean; gunrun: boolean; tour: boolean; title: string }>(
    page,
    `(() => { const vis = (id) => getComputedStyle(document.getElementById(id)).display !== "none"; window.__range.menu.showExtras(true); const out = { game: window.__range.sk.game(), html: document.documentElement.dataset.game, br: vis("goBr"), gunrun: !!document.getElementById("goGunRun"), tour: !!document.getElementById("goTour"), title: document.title }; window.__range.menu.showExtras(false); return out; })()`
  );
  check("speedkills: the page is SpeedKills, its menu PLAY and TRAINING behind Extra modes (Gun Run and the guided tour gone)", front.game === "speedkills" && front.html === "speedkills" && front.br && !front.tour && !front.gunrun && front.title === "SpeedKills", JSON.stringify(front));
  // the guns: ten of its own, named, the owner's friends among them
  const guns = await ev<{ ids: number; names: string[] }>(page, `(() => { const r = window.__range; return { ids: r.weaponIds ? r.weaponIds().length : -1, names: r.loadout.slots.map((s) => s.weapon.name) }; })()`);
  check("speedkills: a loadout's guns carry SpeedKills names", guns.names.every((n) => /^[A-Z]+$/.test(n)) && guns.names.every((n) => ["PANDA", "STRYDER", "ANAKIN", "USSO", "BIGANTLER", "REZ", "DEVINOS", "APUHTHEE", "BOOG", "CHOOCH"].includes(n)), JSON.stringify(guns));
  // fusion: level 5 is half again the magazine
  const fused = await ev<{ before: number; after: number; level: number }>(page, `(() => { const r = window.__range; const before = r.loadout.slots[0].weapon.clipSize; r.sk.setFusion(0, 5); return { before, after: r.loadout.slots[0].weapon.clipSize, level: r.sk.fusion()[0] }; })()`);
  check("speedkills: fused to 5, a gun's magazine is half as big again", fused.level === 5 && Math.abs(fused.after / fused.before - 1.5) < 0.08, JSON.stringify(fused));
  await ev(page, "window.__range.sk.setFusion(0, 0)");
  // the hacks you picked, both ready
  const held = await ev<Array<{ slot: string; held: { id: string } | null; left: number }>>(page, "window.__range.sk.hacks()");
  check("speedkills: two hacks held, a mobility and a utility, both ready", held.length === 2 && held.every((h) => h.held && h.left === 0), JSON.stringify(held));
  // onto 44 m of open floor, facing down it: THE RUN's last room (courses/basic.ts FINAL, x -27.75 in the world). The
  // open ground past the old run's far wall went when the run was rebuilt out to the city's edge (Milestone 636): from
  // z 200 its new far wall stopped the dash at 4.4 m
  await ev(page, `(() => { document.getElementById("overlay").classList.add("hidden"); window.__range.player.teleport(-27.75, 0, 60, 0); })()`);
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
  // and a heal area gone frees what it made (Milestone 724): taken out of the scene alone, each left its rings, wall and
  // signs on the GPU, about a hundred geometries a battle royale from the bots' heals; the med kit in it is the pack's
  // model, shared, and stays
  await ev(
    page,
    `(() => { const R = window.__range; const f = (window.__healFreed = { own: 0, freed: 0, kit: 0, kitFreed: 0 });
      R.scene.traverse((o) => { if (o.name !== "heal-area") return; o.traverse((m) => { if (!m.geometry || m.isSprite) return; const own = !!m.userData.healOwn; if (own) f.own++; else f.kit++;
        m.geometry.addEventListener("dispose", () => { if (own) f.freed++; else f.kitFreed++; }); }); }); })()`,
  );
  await gameSleep(page, 10);
  const freed = await ev<{ own: number; freed: number; kit: number; kitFreed: number; zones: number }>(page, "({ ...window.__healFreed, zones: window.__range.sk.state().healZones })");
  check("speedkills: a heal area gone frees its own rings and wall, and not the shared med kit in it", freed.zones === 0 && freed.own >= 4 && freed.freed === freed.own && freed.kitFreed === 0, JSON.stringify(freed));
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
  await skShieldFx(page);
  await page.close();
  // a bot match in SpeedKills, a 1v1: on NEON YARD by default, THE CENTRE picked (below)
  const arena = await open(browser, "?");
  await ev(arena, `(() => { document.getElementById("goBots").click(); document.getElementById("startMode").click(); })()`);
  await arena.waitForFunction("window.__range.duel()?.phase === 'fight' || window.__range.duel()?.phase === 'countdown'", { polling: 200, timeout: 20000 }).catch(() => undefined);
  await sleep(500);
  // SpeedKills' 1v1 against a bot opens on NEON YARD (arenas/neonarenas.ts; the owner, 2026-10-09: "2 1v1 maps ... the 1v1
  // maps are supposed to be super basic"): you and the bot inside its walls, and the city's file showing the yard alone,
  // none of the city, its fence or its ropes (a 7 m wall is no screen against a 144 m tower)
  {
    const page = await open(browser, "?");
    await ev(page, `(() => { document.getElementById("goBots").click(); document.getElementById("startMode").click(); })()`);
    await page.waitForFunction("window.__range.duel()?.phase === 'fight'", { polling: 200, timeout: 60000 }).catch(() => undefined);
    await page.waitForFunction("window.__range.neonMap().drawn", { polling: 500, timeout: 120000 }).catch(() => undefined);
    const y = await ev<{ map: string; me: boolean; bot: boolean; drawn: boolean; part: { shown: string | null; nodes: string[]; extras: boolean }; batches: { batches: number; materials: number; layers: number } }>(
      page,
      `(() => { const R = window.__range; const d = R.duel(); const b = d.arenaBounds; const inside = (q) => q.x > b.minX && q.x < b.maxX && q.z > b.minZ && q.z < b.maxZ;
        return { map: d.arenaId, me: inside(R.player.pos), bot: inside(d.bots[0].pos), drawn: R.neonMap().drawn, part: R.neonMap().part, batches: R.neonMap().batches }; })()`,
    );
    // (and the city's file read whole, its opaque materials' batches joined into their texture arrays: neonbatch.ts)
    check(
      "speedkills: a 1v1 against a bot opens on NEON YARD, you and the bot inside its walls, the city's file showing the yard alone, its batches joined",
      y.map === "yard" && y.me && y.bot && y.drawn && y.part.shown === "a-yard" && y.part.nodes.join() === "a-yard" && !y.part.extras && y.batches?.batches >= 1 && y.batches.layers > y.batches.batches * 4,
      JSON.stringify(y),
    );
    // a REVEAL draws the bot through walls, its rim and its shape filled red, over anything in front (Milestone 690, the
    // owner: "the reveal also just makes them red, it should highlight them through walls")
    await ev(page, "(() => { const R = window.__range; R.duel().reveal(R.player.pos, null, 1000, 360, 3); })()");
    const shown = await page.waitForFunction("window.__range.duel().avatars.some((a) => (a.revealState()?.on ?? 0) > 0)", { polling: 100, timeout: 15000 }).then(() => true, () => false);
    const rv = await ev<{ on: number; through: boolean; fill: number; color: number } | null>(page, "(() => { const a = window.__range.duel().avatars.find((x) => x.revealState()); return a ? a.revealState() : null; })()");
    check("speedkills: a REVEAL draws the bot through walls, its rim and its shape filled in red", shown && !!rv && rv.on > 0 && rv.through && rv.fill > 0 && rv.color === 0xff2a3a, JSON.stringify(rv));
    // with a colour vision mode the REVEAL takes that mode's enemy colour, as the HUD's do (Milestone 703): deuteranopia's
    // orange, then back to normal
    const cv = await ev<{ color: number | null; back: number | null }>(
      page,
      `new Promise((ok) => { const sel = document.getElementById("accVision"); sel.value = "deuteranopia"; sel.dispatchEvent(new Event("change"));
        setTimeout(() => { const a = window.__range.duel().avatars.find((x) => x.revealState()); const color = a ? a.revealState().color : null; sel.value = "normal"; sel.dispatchEvent(new Event("change"));
          setTimeout(() => ok({ color, back: a ? a.revealState().color : null }), 1500); }, 1500); })`,
    );
    check("speedkills: with a colour vision mode, a REVEAL takes its enemy colour (deuteranopia's orange), and red again after", cv.color === 0xff9d1a && cv.back === 0xff2a3a, JSON.stringify(cv));
    // an enemy's ARMOR as their page tells it (Milestone 694): a gold shell over them while it lasts, your rounds doing
    // its share (hacks.json armor.damageScale), and both gone when it ends (armor.seconds, on the wall clock)
    const arm = await ev<{ id: number; scale: number; secs: number } | null>(
      page,
      `(() => { const R = window.__range; const d = R.duel(); const a = d.avatars[0]; const r = a ? d.remoteOf(a) : null; if (!r) return null; const p = a.group.position; R.sk.remoteHack(r.id, 4, p.x, p.y, p.z); return { id: r.id, scale: R.sk.armorScale(r.id), secs: 4 }; })()`,
    );
    const gold = await page.waitForFunction("(() => { const s = window.__range.duel().avatars[0].shellState(); return !!s && s.on > 0 && s.color === 0xffc23a; })()", { polling: 100, timeout: 15000 }).then(() => true, () => false);
    check("speedkills: an enemy under ARMOR wears a gold shell, and your rounds do its share on them (0.4)", !!arm && arm.scale === 0.4 && gold, JSON.stringify(arm));
    await sleep(4600);
    const after = await page
      .waitForFunction(`(() => { const R = window.__range; const s = R.duel().avatars[0].shellState(); return (!s || s.on === 0) && R.sk.armorScale(${arm?.id ?? -1}) === 1; })()`, { polling: 100, timeout: 15000 })
      .then(() => true, () => false);
    check("speedkills: and when ARMOR ends the shell goes and your rounds do their whole damage again", after);
    // every hack of someone else's is heard where it was used (Milestone 710): their INVISIBILITY, a MINE set down, a
    // WALL going up and where a DASH came out were silent or a stand-in
    await ev(
      page,
      `(() => { const R = window.__range; const d = R.duel(); const a = d.avatars[0]; const r = a ? d.remoteOf(a) : null; if (!r) return; const p = a.group.position;
        R.sk.remoteHack(r.id, 5, p.x, p.y, p.z, 2); R.sk.remoteHack(r.id, 6, p.x + 1, p.y, p.z);
        R.sk.remoteFx("wall", r.id, [p.x + 2, p.y, p.z], [0, 0, 0]); R.sk.remoteFx("jolt", r.id, [p.x, p.y, p.z], [p.x + 3, p.y, p.z]); })()`,
    );
    const hacksHeard = await ev<string[]>(page, "window.__range.sk.heardHacks()");
    check("speedkills: another figure's INVISIBILITY, MINE, WALL and DASH are heard where they were used", ["hack_invis", "hack_mine", "hack_wall", "hack_dash"].every((k) => hacksHeard.includes(k)), JSON.stringify(hacksHeard));
    // others' landings, slides and mantles are heard where they are (Milestone 695): the bot's figure taken through them
    // (its pose read as the sounds read it), 4 m from you
    await ev(page, `(() => { const R = window.__range; const a = R.duel().avatars[0]; window.__fake = { stance: "stand", speed: 0, pitch: 0 }; Object.defineProperty(a, "currentPose", { get: () => window.__fake, configurable: true }); const q = a.group.position; R.player.teleport(q.x + 4, q.y, q.z, 90, 0); })()`);
    for (const [i, st] of ["air", "stand", "slide", "stand", "mantle", "stand", "zip", "stand", "air", "air"].entries()) {
      // (the last: a double jump, the figure's count of them one more: Milestone 713)
      await ev(page, `window.__fake = { stance: ${JSON.stringify(st)}, speed: 3, pitch: 0, airJumps: ${i === 9 ? 1 : 0} }`);
      await gameSleep(page, 0.3);
    }
    const heard = await ev<string[]>(page, "window.__range.sk.othersHeard()");
    check("speedkills: another figure's landing, slide, mantle, zipline and double jump are heard where it is", ["land", "slide", "mantle", "zip", "airjump"].every((k) => heard.includes(k)), JSON.stringify(heard));
    // and its footsteps while it is unseen under INVISIBILITY (Milestone 717): its figure hidden past seenWithin, its
    // shimmer up; hidden, its steps went silent (the sounds skip a hidden figure)
    await ev(
      page,
      `(() => { const R = window.__range; const a = R.duel().avatars[0]; window.__fake = { stance: "stand", speed: 3.5, pitch: 0, airJumps: 1 }; a.cloaked = true;
        Object.defineProperty(a.group, "visible", { get: () => false, set: () => undefined, configurable: true }); window.__steps0 = R.sk.stepsHeard(); })()`,
    );
    await gameSleep(page, 1.5);
    const unseenSteps = await ev<number>(
      page,
      `(() => { const R = window.__range; const a = R.duel().avatars[0]; delete a.group.visible; a.group.visible = true; a.cloaked = false; window.__fake = { stance: "stand", speed: 0, pitch: 0, airJumps: 1 }; return R.sk.stepsHeard() - window.__steps0; })()`,
    );
    check("speedkills: someone unseen under INVISIBILITY is still heard walking", unseenSteps >= 2, `${unseenSteps} steps in 1.5 s of game time at 3.5 m/s`);
    // and its steps along a wall (Milestone 707): a wall run was silent; at 12 m/s, a step every audio.json wallStride
    await ev(page, `window.__fake = { stance: "wallL", speed: 12, pitch: 0 }`);
    await gameSleep(page, 1);
    await ev(page, `window.__fake = { stance: "stand", speed: 0, pitch: 0 }`);
    const walled = (await ev<string[]>(page, "window.__range.sk.othersHeard()")).filter((k) => k === "wallstep").length;
    check("speedkills: another figure running a wall is heard, a step at a time", walled >= 3, `${walled} wall steps in 1 s of game time at 12 m/s`);
    await page.close();
  }
  // THE CENTRE, picked (arenas/centre.ts, the owner, 2026-10-01): the city's own middle, inside a circle you cannot leave;
  // its bot from the spawn north of the tower reaches the 1v1's circle by the city's graph (walking straight at it from
  // there, it was 40 m off after 45 s: measured from each spawn)
  {
    const page = await open(browser, "?norender&map=neon");
    await ev(page, `(() => { document.getElementById("arenaMap").value = "centre"; document.getElementById("goBots").click(); document.getElementById("startMode").click(); })()`);
    await page.waitForFunction("window.__range.duel()?.phase === 'fight'", { polling: 200, timeout: 30000 }).catch(() => undefined);
    const at = await ev<{ x: number; z: number; map: string | null; bot: number[] }>(
      page,
      "(() => { const R = window.__range; const d = R.duel(); return { x: R.player.pos.x, z: R.player.pos.z, map: d?.arenaId ?? null, bot: [d.bots[0].pos.x, d.bots[0].pos.z] }; })()",
    );
    const circle = CENTRE_MAP.bounds.circle!;
    const fromMiddle = (p: { x: number; z: number }) => Math.hypot(p.x - circle.x, p.z - circle.z);
    check("speedkills: a 1v1 against a bot on THE CENTRE, picked, is fought in the city's middle, inside its circle", at.map === "centre" && fromMiddle(at) < circle.r, JSON.stringify({ ...at, r: +fromMiddle(at).toFixed(1) }));
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
  const lab = await open(browser, "?");
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
  // The arms in the sights (Phase 20 A3): aimed through a magnified scope (BOOG's; DEVINOS's 3x went with the 30-30 when
  // DEVINOS became the launcher) the gun is hidden for the scope picture,
  // and the arms, which are not under the gun, stayed drawn frozen and filled the scope. With a red dot (USSO) the
  // arms stay, as they should.
  const sight = await open(browser, "?");
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
  // The range open to its far end (the owner, 2026-10-12: "remove the barrier where the tv screen is, but keep the tv
  // screen just like that"): a body sent 40 m down range stays there, no curtain stands, and the manual's screen still
  // hangs 24 m in. Read after a stretch of game time: on the e2e's CPU a frame can take longer than 500 ms
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
  check("speedkills range: open past the screen, 40 m down range and further, no barrier, the manual's screen 24 m in", sb.z < -39 && sb.curtains === 0 && sb.tvZ !== null && Math.abs(sb.tvZ + 24.17) < 0.2, JSON.stringify(sb));
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
  const fresh = await open(browser, "?norender", BASE, `if (!sessionStorage.getItem("e2e.fresh")) { sessionStorage.setItem("e2e.fresh", "1"); localStorage.removeItem("range.loadouts.sk.v1"); }`);
  const a = await ev<{ name: string; want: string[]; held: string[]; pick: string | null }>(fresh, read);
  check("a new player's loadout is the USSO and BOOG, in hand", a.want.join() === "r97,sentinel" && a.held.join() === "r97,sentinel" && a.name === "USSO and BOOG", JSON.stringify(a));
  await fresh.close();
  // a returning player on Marksman from before, the store with no pick in it
  const OLD = `{"selected":{"kind":"default","index":2},"custom":[]}`;
  const back = await open(browser, "?norender", BASE, `if (!sessionStorage.getItem("e2e.back")) { sessionStorage.setItem("e2e.back", "1"); localStorage.setItem("range.loadouts.sk.v1", '${OLD}'); }`);
  const b = await ev<{ want: string[]; held: string[]; pick: string | null; sel: { kind: string; index: number } | null }>(back, read);
  check("a returning player is moved onto the USSO and BOOG once, and the store says so", b.want.join() === "r97,sentinel" && b.held.join() === "r97,sentinel" && b.pick === "usso-boog" && b.sel?.index === 0, JSON.stringify(b));
  // they pick Marksman again: after a reload it is still theirs
  await ev(back, `[...document.querySelectorAll("#loadoutList button")].find((x) => x.textContent.startsWith("Marksman")).click()`);
  await back.reload({ waitUntil: "domcontentloaded" });
  await back.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 60000 });
  const c = await ev<{ name: string; want: string[]; held: string[] }>(back, read);
  // (its own guns in hand, whatever they are now: DEVINOS's id changed with its launcher, Milestone 510)
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
async function skGroupTest(browser: Browser, Q = "?net=local&norender"): Promise<void> {
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
  const Q = "?norender";
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
  const page = await open(browser, "?norender");
  // the bought soldier and guns in first: a figure made before them keeps its stand-in body and gun for the match
  await page.waitForFunction("window.__range.loaded() && window.__range.paidGuns().ready && window.__range.soldierReady()", { polling: 250, timeout: 120000 }).catch(() => undefined);
  await ev(page, `(() => { document.getElementById("botCount").value = "1"; document.getElementById("botDifficulty").value = "normal"; window.__range.startBots(); })()`);
  await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 60000 }).catch(() => undefined);
  // the bot on the rifle, whose bought model is the one with scale-100 parts (a bot 1v1 draws its bot's gun at
  // random, and the Bot guns box is the modes'; on another gun this check measured nothing that could go wrong)
  await ev(page, `(() => { const b0 = window.__range.duel()?.bots?.[0]; if (b0) (b0.bot ?? b0).setWeapon("vinson"); })()`);
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
  const page = await open(browser, "?norender&map=neon");
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
  const arena = await open(browser, "?");
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
  const page = await open(browser, "?");
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
  // (the screen watched from the page's first line, not from when open() returns: on a loaded machine the page was in and
  // the screen gone before the probe below began, 0.0001 s into it, and the bar read as never seen; 2026-10-16 and -17)
  const watch = `window.__boot = { everCard: false, bar: false }; (function watch() { const L = document.getElementById("loading"); const s = window.__range?.intro?.state?.(); if (s && s.kind !== null) window.__boot.everCard = true; const gone = !!L && (L.hidden || L.classList.contains("done")); if (L && !gone && document.getElementById("loadingFill")) window.__boot.bar = true; if (!gone) setTimeout(watch, 30); })();`;
  const page = await open(browser, "?intro=on", BASE, `window.__straightDrop = false; ${watch}`);
  // while it loads: the loading screen, its bar, and no card; and it goes only once everything the card waits on is in
  const boot = await ev<{ everCard: boolean; bar: boolean; atHide: { loaded: boolean; secs: number; status: string; waited: boolean; kind: string | null } | null }>(
    page,
    `new Promise((ok) => { const R = window.__range; const L = document.getElementById("loading"); let everCard = !!window.__boot?.everCard; let bar = !!window.__boot?.bar; const t0 = performance.now();
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
        // (120 s, not 60: on the suite's software drawing the match took 51 to 57 s to build before its card, which then
        // plays 8, and the window closed with the card still up; this is the order's check, not the build's speed)
        if ((cardGone && performance.now() - cardGone > 1500) || performance.now() - t0 > 120000) return ok({ atClick, rows });
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
  // the movement trails' shader built with the page's (trails.ts, Milestone 724): a trail is made only when someone
  // runs near, and one made aboard, after the match's warm, built its shader on the frame it was first drawn (the
  // 2026-10-27 sweep: two trails without one as the ship flew)
  const trailWarm = await ev<{ there: boolean; built: boolean }>(
    page,
    `(() => { const R = window.__range; const w = R.scene.getObjectByName("trail-warm"); const pr = w && R.renderer.properties.get(w.material); return { there: !!w, built: !!(pr && pr.currentProgram) }; })()`,
  );
  check("sk order: the movement trails' shader is built with the page's, before any trail is made", trailWarm.there && trailWarm.built, JSON.stringify(trailWarm));
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
  const host = await open(browser, "?norender", BASE, wear);
  const saved = await ev<string | null>(host, "window.__savedSoldier");
  const g1 = await open(browser, "?norender", BASE, wear);
  const g2 = await open(browser, "?norender", BASE, wear);
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
  const page = await open(browser, "?norender", BASE, "window.__noGulag = false");
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
  const page = await open(browser, "?norender");
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
      // on open street, flat from 3 m behind you to past the far bot and 3 m to each side, and clear of pads (where the
      // match lands you may be a crate's top or a kerb, and the floor under a slam then moves the rule's 2.5 m about: a run
      // hit the bot a storey over as well). (Not 10 m round: the districts' cover, Milestone 660, stands within 8 m of every
      // open spot, so no such circle is left)
      const clear = (x, z) => !r.brMap.pads.some((q) => Math.hypot(q.x - x, q.z - z) < 10) && !r.solids.some((b) => b.maxX > x - 3 && b.minX < x + 9.5 && b.maxZ > z - 3 && b.minZ < z + 3 && b.base < 6 && b.top > 0.1);
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

async function speedkillsStartsTest(browser: Browser): Promise<void> {
  type Slot = { id: string; empty: boolean; fusion: number };
  type Here = { slots: Slot[]; active: number; fused: number; down: string[] };
  for (const start of ["loot", "loadout"] as const) {
    const page = await open(browser, "?norender");
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
      // and a notice with two things in reach (Milestone 725): the list of what is at your feet lay over the notice,
      // which stood at a fixed height under the prompt; it goes under the list now
      const stacked = await ev<{ reach: HudBox | null; notice: HudBox | null }>(
        page,
        `new Promise((ok) => { const r = window.__range; const f = r.duel().lootField; ${clear};
          f.add({ kind: "weapon", id: "sentinel", n: 1, rarity: "common", fusion: 0 }, new r.THREE.Vector3(${S.x}, 0, ${S.z} - 1.4));
          f.add({ kind: "weapon", id: "mastiff", n: 1, rarity: "common", fusion: 0 }, new r.THREE.Vector3(${S.x} + 0.4, 0, ${S.z} - 1.5));
          r.player.teleport(${S.x}, 0, ${S.z}, 0, -45); r.hud.notice("SQUAD WIPED  ·  12 SQUADS LEFT", r.gameTime(), 4);
          const h = r.hud; const was = h.enabled; h.enabled = true;
          setTimeout(() => { const out = { reach: h.placed.reach ?? null, notice: h.placed.notice ?? null }; h.enabled = was; ${clear}; ok(out); }, 500); })`,
      );
      check("sk loot card: a notice with two things in reach goes under the list of them, not over it", !!stacked.reach && !!stacked.notice && stacked.notice.y >= stacked.reach.y + stacked.reach.h, JSON.stringify(stacked));
    }
    await take(`{ kind: "weapon", id: "${a.slots[0].id}", n: 1, rarity: "common", fusion: 0 }`);
    const b = await ev<Here>(page, here);
    check(
      `sk ${start} start: E on a floor copy of a gun you carry fuses it up a level`,
      a.slots.every((s) => !s.empty) && b.slots[0].id === a.slots[0].id && b.slots[0].fusion === a.slots[0].fusion + 1 && b.slots[1].fusion === a.slots[1].fusion && b.fused === a.fused + 1 && b.down.length === 0,
      JSON.stringify({ a, b }),
    );
    const other = skCfg.roster.find((g) => !b.slots.some((s) => s.id === g)) ?? skCfg.roster[0];
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
    // (how it stood before: twice on a loaded machine the loot start found nothing dropped, as if the player were out
    // already, by the decay or a stray round; said in the check's detail so the next time says which)
    // (on 2026-10-25 it said alive false, health 0, not in the decay: out before it; so who, and the feed's last lines)
    const before = await ev<{ alive: boolean; health: number; inDecay: boolean | null; ring: number | null; by: string | null; feed: string[] }>(
      page,
      "(() => { const R = window.__range; const d = R.duel(); const h = d.hud(); return { alive: d.alive, health: d.health, inDecay: h.br?.ring?.outside ?? null, ring: h.br?.ring?.phase ?? null, by: R.hud.last?.recap?.killerName ?? null, feed: R.hud.feedText.slice(0, 3) }; })()",
    );
    await ev(page, "window.__range.duel().takeHit(500, 100)");
    // (the drop is the death's frame's: waited for, not slept on, as a loaded machine runs that frame late)
    await page.waitForFunction(`[...window.__range.duel().lootField.drops.values()].some((x) => x.key >= ${k0} && x.item.kind === "weapon")`, { polling: 100, timeout: 5000 }).catch(() => undefined);
    const dropped = await ev<{ guns: string; other: string[] }>(
      page,
      `(() => { const round = [...window.__range.duel().lootField.drops.values()].filter((x) => x.key >= ${k0} && Math.hypot(x.pos.x - ${fell.x}, x.pos.z - ${fell.z}) < 4);
        return { guns: round.filter((x) => x.item.kind === "weapon").map((x) => x.item.id + ":" + (x.item.fusion ?? 0)).sort().join(), other: round.filter((x) => x.item.kind !== "weapon" && x.item.kind !== "echo").map((x) => x.item.kind + ":" + x.item.id) }; })()`,
    );
    // and nothing else, no box among it: a loadout start's ammo kit would be clutter on a floor of guns and hack cores
    check(`sk ${start} start: what you die with goes down loose, your guns at their levels, and nothing else`, dropped.guns === held && dropped.other.length === 0, JSON.stringify({ held, dropped, before }));
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
 * DEVINOS's rocket launcher (rocket.ts; the owner, 2026-10-06: "it shouldn't hurt the shooter, but it should do more damage
 * the further it travels, so a point blank or very close does like 10 damage and then it scales like that"): a real
 * rocket fired at a range dummy where it stands, from 25 m and from 3 m: drawn as a rocket in flight, its burst seen,
 * the dummy taking the burst's damage for how far the rocket flew. Someone else's rocket (as a shot message redraws it)
 * flies and bursts on this page too and hurts nobody here. A rocket into the floor at a dummy's toes is on it (full
 * damage: the gap is to the body, not a chest point), and one on a range target counts on the target. A bot with the
 * launcher: its rockets stop on you and their damage comes with the burst, and a rocket never bursts on the figure that
 * fired it (the same rocket fired as nobody's does, on its own head).
 */
async function skLauncherTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?norender");
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
        // (1.5 s of the game's own time: of the real clock's, a loaded machine stepping a few frames a second had the 25 m
        // rocket still in the air, no burst and the dummy whole, the city agent's run at 96% CPU, 2026-10-13)
        let bursts = 0; const t0 = performance.now(); const g0 = r.gameTime();
        while (r.gameTime() - g0 < 1.5 && performance.now() - t0 < 20000) { bursts = Math.max(bursts, r.rocketBursts() - b0); await new Promise((ok) => setTimeout(ok, 16)); }
        return { took: Math.round((before - (d.health ?? 0) - (d.shield ?? 0)) * 10) / 10, travelled: r.rocketLast()?.travelled ?? -1, rocketDrawn, bursts };
      })()`,
    );
  const far = await shoot(25, false);
  check("DEVINOS: a rocket at a dummy from 25 m is drawn as a rocket, bursts, and the dummy takes its full 50", far.rocketDrawn && far.bursts >= 1 && Math.abs(far.took - 50) <= 1 && far.travelled > 20, JSON.stringify(far));
  const near = await shoot(3, false);
  check("DEVINOS: from 3 m the same rocket does about 10 to 14 (point blank about 10, more the further it flies)", near.bursts >= 1 && near.took >= 9 && near.took <= 14, JSON.stringify(near));
  const theirs = await shoot(25, true);
  check("DEVINOS: someone else's rocket (a shot message's) flies and bursts here too, and does no damage on this page", theirs.rocketDrawn && theirs.bursts >= 1 && theirs.took === 0, JSON.stringify(theirs));
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
  check("DEVINOS: a rocket into the floor a hand from a dummy's feet is on it: the full damage for its flight", toes.travelled > 0 && Math.abs(toes.took - toes.want) <= 1, JSON.stringify(toes));
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
  check("DEVINOS: a rocket on a range target bursts on it and counts on it, its full 50 from 25 m", !!board && board.burst && (board.off ?? 9) < 0.2 && Math.abs(board.took - 50) <= 1, JSON.stringify(board));
  await page.close();
  // A bot with the launcher, on a page of its own, in the open 7 to 15 m from you. Held and still: a rocket from inside it toward
  // its own head, fired as its own and as nobody's. Then firing: its rockets stop on you (you are no figure on your own
  // page; they had flown through you to burst behind) and what you take comes with a burst (a bot's rocket had been
  // settled as a bullet the moment it left).
  const bp = await open(browser, "?norender");
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
            // (from 35 cm under its head, up into it: from a fixed 1.35 m, a bot crouched with its head's middle at 1.4 m
            // fired from inside its head, and a rocket leaving a mesh from inside meets none of its faces, so the control
            // flew its whole 165 m half the runs, alone and unloaded, 2026-10-13)
            const head = b.dummy.hitMeshes.find((m) => m.userData.zone === "head").getWorldPosition(new T.Vector3());
            const eye = head.clone().setY(head.y - 0.35);
            const before = r.rocketLast();
            b.projectiles.fire(eye, head.sub(eye).normalize(), b.weapon, true, 1, 1, null, null, firer);
            const t1 = performance.now(); while (r.rocketLast() === before && performance.now() - t1 < 4000) await new Promise((ok) => setTimeout(ok, 16));
            return r.rocketLast() === before ? null : Math.round(r.rocketLast().travelled * 100) / 100;
          };
          // where the bot and its head were, for a failure's detail (twice under load at 91% CPU both rockets flew 165 m)
          const dbgHead = b.dummy.hitMeshes.find((m) => m.userData.zone === "head").getWorldPosition(new T.Vector3()); const dbg = { pos: b.pos.toArray().map((v) => +v.toFixed(2)), head: dbgHead.toArray().map((v) => +v.toFixed(2)), alive: b.alive, knocked: b.dummy.knocked, visible: b.dummy.group.visible, inList: b.projectiles.dummies.includes(b.dummy), me: [+me.x.toFixed(2), +me.y.toFixed(2), +me.z.toFixed(2)], bots: d.bots.length };
          const own = await fire({ figure: b.dummy });
          // (the control fired twice at most: under load one of the two nobody's rockets also flew its whole 165 m, while
          // each passed on a rerun; it is there only to show such a rocket bursts on that head)
          let nobody = await fire(null);
          if (nobody === null || nobody >= 0.6) nobody = await fire(null);
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
          return { spot: !!spot, own, nobody, onMe, bursts, took: Math.round(took * 10) / 10, unexplained, dbg };
        })()`,
      )
    : null;
  check("DEVINOS: a rocket never bursts on the figure that fired it (the same one fired as nobody's bursts on it)", !!bot && (bot.own === null || bot.own > 1) && bot.nobody !== null && bot.nobody < 0.6, JSON.stringify(bot));
  check("DEVINOS: a bot's rockets burst on you, and you take their damage with the burst, never before it", !!bot && bot.onMe >= 1 && bot.took > 0 && bot.unexplained === 0, JSON.stringify(bot));
  await bp.close();
}

async function speedkillsGhostTest(browser: Browser, start: "loot" | "loadout"): Promise<void> {
  const tag = start === "loot" ? "speedkills ghost" : "speedkills ghost, loadout start";
  const q = "?net=local&norender";
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
  const g1 = await ev<{ alive: boolean; ghost: boolean }>(guest, "(() => { const d = window.__range.duel(); return { alive: d.alive, ghost: d.ghost }; })()");
  check(`${tag}: no knockdown: at zero the guest is out, and a ghost (its squad mate is up)`, !g1.alive && g1.ghost, JSON.stringify(g1));
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
  // and its squad mate sees it as its own soldier drawn in light where it is, not a capsule (Milestone 605)
  await sleep(800);
  const seenGhost = await host
    .waitForFunction("(() => { const e = window.__range.squadGhosts().find((x) => x.id === 1); return e && e.drawn ? e : null; })()", { polling: 200, timeout: 8000 })
    .then((h) => h.jsonValue() as Promise<{ at: number[] }>, () => null);
  const ghostAt = await ev<number[]>(guest, "window.__range.player.pos.toArray()");
  check(
    `${tag}: its squad mate sees the ghost as its soldier drawn in see-through light, where it is (within 2 m)`,
    !!seenGhost && Math.hypot(seenGhost.at[0] - ghostAt[0], seenGhost.at[2] - ghostAt[2]) < 2,
    JSON.stringify({ seen: seenGhost?.at.map((v) => Math.round(v * 10) / 10), ghost: ghostAt.map((v) => Math.round(v * 10) / 10) }),
  );
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
  // (its guns lay 0.9 m round the echo; the restore clears what lies within 1.3 m of it, and the echo itself. Only the guns
  // it held: the city's own floor loot can lie there, and a launcher in reach failed the loot start, which lands unarmed)
  const leftThere = await ev<string[]>(
    host,
    `[...window.__range.duel().lootField.drops.values()].filter((x) => x.item.kind === "echo" ? x.item.owner === 1 : x.item.kind === "weapon" && ${JSON.stringify(heldBefore ? heldBefore.split(",").map((h) => h.split(":")[0]) : [])}.includes(x.item.id) && Math.hypot(x.pos.x - ${spot.x}, x.pos.z - ${spot.z}) < 1.3).map((x) => x.item.kind + ":" + x.item.id)`,
  );
  check(`${tag}: the restored guest holds the guns it died with, at their levels, and neither they nor the echo are left on the floor`, heldAfter === heldBefore && leftThere.length === 0, JSON.stringify({ heldBefore, heldAfter, leftThere }));
  await close();
}

/**
 * The wall run's feel, in the range: a run along its right-hand wall, the view leaning away from the wall while on it
 * and level again off it. (The guided tour's section until Milestone 637 took the tour out: its other steps are the
 * tutorial's rooms now, the sktutorial section's.)
 */
async function wallFeelTest(browser: Browser): Promise<void> {
  const t = await open(browser, "?");
  await ev(t, `document.getElementById("goRange").click(); document.getElementById("startMode").click()`);
  await pressPlay(t);
  // keys held from now on, and `presses`: milliseconds after the start at which a key is pressed once (a
  // jump, then a second in the air). By the clock, not by frame: a headless page runs at hundreds of frames
  // a second, and a second jump twenty frames on came inside the coyote grace, a ground jump again
  const script = (held: string[], presses: Record<string, number[]> = {}) =>
    `(() => { const K = ${JSON.stringify(held)}; const P = ${JSON.stringify(presses)}; const t0 = performance.now(); let f = 0; const gone = new Set(); let due = new Set();
      window.__range.setScript({ held: (a) => K.includes(a), pressedNow: (a) => (K.includes(a) && f <= 1) || due.has(a) }, () => { f++; const t = performance.now() - t0; due = new Set(); for (const [a, list] of Object.entries(P)) for (const ms of list) if (t >= ms && !gone.has(a + ms)) { gone.add(a + ms); due.add(a); } }); })()`;
  const stop = () => ev(t, "window.__range.setScript(null)");
  const tp = (x: number, y: number, z: number, yaw: number, pitch = 0) => ev(t, `window.__range.player.teleport(${x}, ${y}, ${z}, ${yaw}, ${pitch})`);
  // a wall run: sprinting up THE RUN's wall run deck along the wall on its right (the block between its halves, its face at
  // course x 0.5, world -21; the body 0.41 m round), then a jump: the range's right-hand wall this ran along has stands
  // against it now, which stopped the run short (Milestone 637). Up to three runs, as a player would try again: the
  // take-off is a matter of frames, and a machine busy with another run has fewer of them
  // (and while on the wall, the view's lean off it, read every few frames: the owner, 2026-09-28, "it should twist the
  // camera a bit and have some sort of visual feedback that we are indeed wallrunning")
  let wallFelt: { lean: number; side: number; tilt: number } | null = null;
  for (let i = 0; i < 3; i++) {
    await tp(-20.54, 1, 119.5, 180);
    await ev(t, `(() => { window.__wallFelt = null; clearInterval(window.__wallT); window.__wallT = setInterval(() => { const w = window.__range.wallFeel(); if (w.onWall && (!window.__wallFelt || Math.abs(w.lean) > Math.abs(window.__wallFelt.lean))) window.__wallFelt = { lean: w.lean, side: w.side, tilt: w.tilt }; }, 10); })()`);
    await ev(t, script(["forward", "sprint"], { jump: [600 + i * 150] }));
    await sleep(1400);
    await stop();
    await sleep(400);
    wallFelt = await ev<{ lean: number; side: number; tilt: number } | null>(t, "(() => { clearInterval(window.__wallT); return window.__wallFelt; })()");
    if (wallFelt) break;
  }
  // (off the wall, whenever the run ends, and a second of the game's time for the lean to ease out: wallOut is 0.25 s)
  await t.waitForFunction("!window.__range.wallFeel().onWall", { polling: 50, timeout: 5000 }).catch(() => undefined);
  await gameSleep(t, 1);
  const feelAfter = await ev<{ onWall: boolean; lean: number }>(t, "window.__range.wallFeel()");
  const leanAfter = feelAfter.lean;
  check(
    "the wall run: on the wall the view leans away from it, and levels again off it",
    // (away: the wall on the right, the camera's right side rises, as a head tilts off a wall)
    !!wallFelt && wallFelt.side > 0.5 && wallFelt.lean > 0.5 && wallFelt.tilt > 0.05 && Math.abs(leanAfter) < 0.1,
    JSON.stringify({ wallFelt, feelAfter }),
  );
  await t.close();
}

/**
 * The tutorial (Milestone 633, src/game/tutorial.ts over courses/tutorial.ts), the wiring of it: the menu's Tutorial
 * puts you in its start room, every door shut, the hacks off and the guns away; each room done opens the next door; a
 * room can be skipped; a pit puts you back at its door; the dash room turns the hacks on with DASH and gives it back
 * with a fall; the gun room hands you the ANAKIN; the soldiers stand up only once you are up with them, with 50 health,
 * and shot down open the way on; the optional bridge counts for the superglide; out through the middle gate it is over
 * and remembered, your own guns and hacks back. The moves themselves are proven on the same geometry by
 * tools/checks/sk-tutorial.ts.
 */
async function skTutorialTest(browser: Browser): Promise<void> {
  // (drawn: a figure's hit volumes follow its pose as the frame draws it, as the soldiers' shots need; so every wait is on
  // the game's own clock or on the thing waited for, since a drawn headless page runs few frames a second)
  const t = await open(browser, "?");
  await ev(t, `document.getElementById("goTutorial").click(); document.getElementById("startMode").click()`);
  await pressPlay(t);
  // (`shut`: a door's collider in the doorway; `opening`: it has begun to slide up, which takes 0.6 s)
  type State = { step: string | null; active: boolean; locked: boolean; guns: boolean; holster: string; gun: string; x: number; y: number; z: number; shut: boolean[]; opening: boolean[]; hacks: Array<{ id: string | null; left: number }> };
  const st = () =>
    ev<State>(t, `(() => { const r = window.__range; const tu = r.tutorial; const p = r.player.pos; return { step: tu.stepTitle, active: tu.active, locked: tu.hacksLocked, guns: tu.gunsLocked, holster: r.triggerWhy().holster, gun: r.loadout.active.id, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), shut: tu.doors.map((d) => d.solid.top <= d.h + 0.01), opening: tu.doors.map((d) => d.openedAt !== null), hacks: r.sk.hacks().map((h) => ({ id: h.held ? h.held.id : null, left: +h.left.toFixed(2) })) }; })()`);
  const tp = (x: number, y: number, z: number, yaw: number, pitch = 0) => ev(t, `window.__range.player.teleport(${x}, ${y}, ${z}, ${yaw}, ${pitch})`);
  const until = (cond: string, timeout = 15000) => t.waitForFunction(cond, { polling: 50, timeout }).then(() => true, () => false);
  const stepIs = (title: string | null, timeout = 15000) => until(`window.__range.tutorial.stepTitle === ${JSON.stringify(title)}`, timeout);
  const stop = () => ev(t, "window.__range.setScript(null)");
  const s0 = await st();
  check(
    "sk tutorial: the menu's Tutorial puts you in its start room behind the right-hand gate, on its first room, every door shut, the hacks off and the guns put away",
    s0.step === "MOVE" && s0.locked && s0.guns && s0.holster === "away" && Math.abs(s0.x - 21) < 0.5 && Math.abs(s0.z - 12) < 0.5 && s0.shut.length === 9 && s0.shut.every(Boolean),
    JSON.stringify(s0),
  );
  // its rooms in the Neon City bundle (Milestone 634): their own small file over the plain boxes, which go
  const dressed = await until("window.__range.tutorialDress().dressed", 90000);
  const dr = await ev<{ meshes: number; plain: boolean; file: string }>(t, "({ ...window.__range.tutorialDress(), plain: window.__range.courseTutorial.plain.visible })");
  check("sk tutorial: its rooms are dressed in the Neon City bundle, from a file of their own, over its plain boxes, which are hidden", dressed && dr.meshes >= 2 && !dr.plain && /tutorial-v\d+\.glb/.test(dr.file), JSON.stringify(dr));
  await ev(t, `window.__range.sk.use("mobility"); window.__range.sk.use("utility")`);
  await ev(t, "window.__range.input.locked = true");
  await t.keyboard.press("Digit1");
  await gameSleep(t, 0.5);
  const refused = await st();
  check("sk tutorial: before their rooms the hack keys do nothing, and a gun key does not draw a gun", refused.hacks.every((h) => h.left === 0) && refused.holster === "away", JSON.stringify(refused));
  // forward to the door: the jump room's opens, the next stays shut
  await tp(21, 0, 38, 180);
  const moved = await stepIs("JUMP");
  await until("window.__range.tutorial.doors[0].solid.top > 3.31");
  const opened = await st();
  check("sk tutorial: forward to the door, MOVE is done and the jump room's door opens (the next one stays shut)", moved && !opened.shut[0] && opened.shut[1], JSON.stringify(opened));
  await tp(21, 1.6, 51, 180);
  check("sk tutorial: up on the ledge, JUMP is done", await stepIs("DOUBLE JUMP"));
  // a room skipped: interact held. You are put at the next room's start, through its door (Milestone 638, the owner's
  // playtest: a skip left you where you were stuck, its door open across a pit you could not cross)
  const into = await ev<{ x: number; y: number; z: number; yaw: number }>(t, "window.__range.tutorial.roomStart(2)");
  await t.keyboard.down("KeyE");
  const skipped = await stepIs("MANTLE");
  await t.keyboard.up("KeyE");
  const afterSkip = await st();
  check(
    "sk tutorial: holding interact skips a room (DOUBLE JUMP): its door opens and you are put in the next room, through its door",
    skipped && afterSkip.opening[2] && Math.abs(afterSkip.x - into.x) < 0.6 && Math.abs(afterSkip.z - into.z) < 0.6,
    JSON.stringify({ afterSkip, into }),
  );
  // a fall into the mantle room's pit: back at its door, the room still to do
  await tp(21, 0.2, 96, 180);
  await until("Math.abs(window.__range.player.pos.z - 81.5) < 0.6");
  const fell = await st();
  check("sk tutorial: fallen into the mantle room's pit, you are back at its door", fell.step === "MANTLE" && Math.abs(fell.z - 81.5) < 0.6 && Math.abs(fell.x - 21) < 0.6, JSON.stringify(fell));
  for (const [title, at, next] of [
    ["MANTLE", [21, 5.2, 101, 180], "WALL RUN"],
    ["WALL RUN", [21, 1, 152, 180], "DASH"],
  ] as const) {
    await tp(at[0], at[1], at[2], at[3]);
    check(`sk tutorial: ${title} done where it is done`, await stepIs(next), JSON.stringify(await st()));
  }
  // the hacks come on, DASH in the move slot; a fall in its pit gives the dash back at once
  const dashOn = await st();
  check("sk tutorial: in the dash room the hacks come on, DASH in the move slot", !dashOn.locked && dashOn.hacks[0]?.id === "dash" && dashOn.guns, JSON.stringify(dashOn));
  // (facing back along the deck: a dash the way you came, clear of the pit)
  await tp(0, 1, 168, 180);
  await t.keyboard.press("KeyF");
  await until("window.__range.sk.hacks()[0].left > 0", 5000);
  const used = (await st()).hacks[0].left;
  await tp(0, 0.2, 150, 0);
  await until("Math.abs(window.__range.player.pos.z - 176.5) < 0.6");
  const refilled = await st();
  check("sk tutorial: the dash used and a fall into the pit, the dash is back at once", used > 0 && refilled.hacks[0].left === 0 && refilled.step === "DASH", JSON.stringify({ used, refilled }));
  await tp(0, 5.5, 137, 0);
  check("sk tutorial: onto the far ledge, DASH is done", await stepIs("HIGH GROUND"), JSON.stringify(await st()));
  // the ANAKIN in your hands, drawn
  // (the gun's deploy is game time: a drawn headless page runs a frame or two a second here)
  await until("window.__range.triggerWhy().holster === 'out'", 60000);
  const armed = await st();
  check("sk tutorial: the gun room hands you the ANAKIN, drawn", armed.gun === "alternator_smg" && armed.holster === "out" && !armed.guns, JSON.stringify(armed));
  // a room's soldiers: up only once you are up there, 50 health, shot down for real
  const figs = (room: number) =>
    ev<Array<{ x: number; y: number; z: number; up: boolean; down: boolean; health: number; armed: boolean }>>(t, `window.__range.courseTutorial.roomFigures(${room}).map((d) => ({ x: +d.group.position.x.toFixed(2), y: +d.group.position.y.toFixed(2), z: +d.group.position.z.toFixed(2), up: d.group.visible, down: d.knocked, health: d.health, armed: !!d.armedId }))`);
  const allUp = (room: number) => until(`window.__range.courseTutorial.roomFigures(${room}).length > 0 && window.__range.courseTutorial.roomFigures(${room}).every((d) => d.group.visible)`);
  /** each standing figure of a room shot from (x, y, z): aimed, two frames for the view to take it, then the trigger */
  const shootAll = async (room: number, x: number, y: number, z: number): Promise<number> => {
    let shot = 0;
    for (let tries = 0; tries < 40; tries++) {
      const list = await figs(room);
      const i = list.findIndex((f) => !f.down);
      if (i < 0) break;
      // (aimed again every frame the trigger is pulled; 0.15 s of the game's time is two frames at least)
      const g0 = await ev<number>(t, `(() => { const r = window.__range; const d = r.courseTutorial.roomFigures(${room})[${i}]; const p = d.group.position; r.player.teleport(${x}, ${y}, ${z}, 0, 0); window.__aimAt = () => { const q = r.player.pos; const dx = p.x - q.x, dz = p.z - q.z; r.player.yaw = Math.atan2(-dx, -dz) * 180 / Math.PI; r.player.pitch = Math.atan2(p.y + 1.25 - (q.y + 1.6), Math.hypot(dx, dz)) * 180 / Math.PI; }; window.__aimAt(); const g = r.loadout.active; if (!g.state.reloading) g.state.clip = g.weapon.clipSize; return r.gameTime(); })()`);
      await until(`window.__range.gameTime() >= ${g0 + 0.15}`, 10000);
      await ev(t, `(() => { const r = window.__range; window.__aimAt(); let f = 0; r.setScript({ held: (a) => a === "fire" && f % 4 < 2, pressedNow: () => false }, () => { f++; window.__aimAt(); }); })()`);
      await until(`window.__range.courseTutorial.roomFigures(${room})[${i}].knocked`, 4000);
      await stop();
      if ((await figs(room))[i].down) shot++;
    }
    return shot;
  };
  await tp(0, 0, 128, 0);
  await gameSleep(t, 0.5);
  const below = await figs(6);
  await tp(0, 4, 123, 0);
  const up6 = await allUp(6);
  const high = await figs(6);
  check("sk tutorial: the high ground's two soldiers are down while you are on the floor, up once you are on the platform, with 50 health", below.every((f) => !f.up) && up6 && high.length === 2 && high.every((f) => f.armed && f.health === 50), JSON.stringify({ below, high }));
  const shot6 = await shootAll(6, 0, 4, 123);
  check("sk tutorial: both shot down from the platform, HIGH GROUND is done", shot6 === 2 && (await stepIs("CLIMB")), `${shot6} shot`);
  await tp(0, 6, 98.5, 0);
  const up7 = await allUp(7);
  const shot7 = await shootAll(7, 0, 6, 98.5);
  check("sk tutorial: on top of the wall its two soldiers stand up, and shot down CLIMB is done", up7 && shot7 === 2 && (await stepIs("SUPERGLIDE")), `${shot7} shot`);
  // the optional bridge counts: past the gap by it, the way out opens
  await tp(5.5, 3.8, 45, 0);
  const glided = await stepIs("OUT");
  // (a second of the game's time for the door, 0.6 s to slide up: looking down the bay at the range, a drawn page here
  // runs about a frame a second)
  const gOut = await ev<number>(t, "window.__range.gameTime()");
  await until(`window.__range.gameTime() >= ${gOut + 1}`, 90000);
  const exitOpen = await st();
  check("sk tutorial: past the superglide's gap by the optional bridge, SUPERGLIDE is done and the way out into the range opens", glided && !exitOpen.shut[8], JSON.stringify(exitOpen));
  // out through the way out on foot, not put past it (Milestone 693, the owner: "it doesn't allow me to exit the tutorial
  // run into the firing range"): half way through its wall the doors shut and put you back inside, and the suite, which
  // stood you past it, never saw
  await tp(0, 0, 13, 0);
  await ev(t, `window.__range.setScript({ held: (a) => a === "forward", pressedNow: () => false }, () => { window.__range.player.yaw = 0; })`);
  const walkedOut = await until("window.__range.player.pos.z < 5", 90000);
  await stop();
  check("sk tutorial: walked through the way out, you come out into the range, not shut back inside", walkedOut, JSON.stringify(await st()));
  const finished = await until("!window.__range.tutorial.active && localStorage.getItem('range.tutorial.done') === '1'");
  await until("window.__range.tutorial.doors.every((d) => d.solid.top <= d.h + 0.01)");
  await until("window.__range.triggerWhy().holster === 'out'", 10000);
  const after = await st();
  check(
    "sk tutorial: out through the middle gate it is complete and remembered; your own guns and hacks are back, and its doors shut behind you",
    finished && after.gun !== "alternator_smg" && !after.locked && after.hacks.every((h) => h.id !== null) && after.shut.every(Boolean) && after.holster === "out",
    JSON.stringify(after),
  );
  // the city's file fetched into the browser's cache while the tutorial was played (neonmap.ts prefetchCity), for the
  // battle royale after it
  const cachedCity = await until(`caches.open("sk-city").then((c) => c.keys()).then((k) => k.some((q) => q.url.includes("/neonmap-v")))`, 120000);
  check("sk tutorial: by its end the city's file is in the browser's cache, so the battle royale after it does not start with it to download", cachedCity, JSON.stringify(await ev(t, `caches.open("sk-city").then((c) => c.keys()).then((k) => k.map((q) => q.url))`)));
  // back in by the right-hand gate: from its first room again
  await tp(21, 0, 14, 180);
  const again = await stepIs("MOVE");
  const back = await st();
  check("sk tutorial: back in through the right-hand gate, it starts again from its first room", again && back.locked && back.guns && back.shut.every(Boolean), JSON.stringify(back));
  await t.close();
}

/**
 * SpeedKills' dropship, ridden (the owner's rule, speedkills.json ship): it
 * starts off the city and flies at least five seconds before its doors open,
 * so the city loads behind it; the jump is refused until then, and the drop
 * lands in the city. The city is the square 250 m either side of (0, 500).
 */
async function speedkillsShipTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?norender");
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
/**
 * The city's file not on the site (Milestone 629; on 2026-10-17 a release went out without the High file and a battle
 * royale dropped the owner onto no city, nothing said): the page asks again after each of its waits, and then the HUD
 * says the map did not load, rather than nothing. The next match asks for it again, and with the file back it draws.
 */
async function cityMissingTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?");
  // a visit with no copy kept: the pages before this one in the run share its browser's Cache Storage, and a bot match on
  // NEON YARD earlier in the section kept the city there, so the page read it from that and asked the site for nothing
  await ev(page, `caches.delete("sk-city")`);
  // (the 404s this test serves are its own: kept out of the run's "no page errors")
  const errorsBefore = errors.length;
  let gone = true;
  const asked: string[] = [];
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    if (/neonmap-v\d+-\w+\.glb/.test(r.url())) {
      asked.push(r.method());
      if (gone) return void r.respond({ status: 404, contentType: "text/plain", body: "not here" });
    }
    void r.continue();
  });
  await ev(page, `(async () => { const r = window.__range; r.startBr({ seed: 42, poi: "c" }); })()`);
  const said = await page.waitForFunction(`/DID NOT LOAD/.test(window.__range.hud.noticeNow)`, { polling: 250, timeout: 40000 }).then(() => true, () => false);
  const heads = asked.filter((m) => m === "HEAD").length;
  const notice = await ev<string>(page, "window.__range.hud.noticeNow");
  check(
    "the city's file missing: asked for again after each wait, and then the HUD says the map did not load",
    said && heads === 4 && /RELOAD THE PAGE/.test(notice),
    JSON.stringify({ said, heads, notice }),
  );
  // back on the site: the next match asks again and the city draws
  gone = false;
  await ev(page, "window.__range.duel()?.leave()");
  await sleep(500);
  await ev(page, `(async () => { const r = window.__range; r.startBr({ seed: 42, poi: "c" }); })()`);
  const drawn = await page.waitForFunction("window.__range.neonMap().drawn", { polling: 500, timeout: 240000 }).then(() => true, () => false);
  check("and with the file back the next match asks again, and the city draws", drawn, JSON.stringify({ asked: asked.length }));
  await ev(page, "window.__range.duel()?.leave()");
  await page.close();
  for (let i = errors.length - 1; i >= errorsBefore; i--) if (/neonmap-v\d+|status of 404/.test(errors[i])) errors.splice(i, 1);
}

async function speedkillsBrTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?norender");
  // the row set to what this checks (trios, 27 bots), not left to its defaults: those are duos and 28 since Milestone 341
  await ev(page, brRow("trio", 27));
  await ev(page, `(() => { document.getElementById("brStart").value = "loot"; document.getElementById("goBr").click(); document.getElementById("startMode").click(); })()`);
  const fought = await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 60000 }).then(() => true, () => false);
  if (!fought) {
    check("speedkills br: a match starts in the city", false);
    await page.close();
    return;
  }
  // the bots' fire held from the start: nothing here is about surviving a fight, and a player standing still where it
  // landed was being shot down before the checks were done (at 70 and at 4 of 150 by the decay's check on 2026-10-16,
  // dead by the outline check on 2026-10-17), the match then over and every check after it reading nothing
  await ev(page, "window.__range.duel().holdFire = true");
  // an enemy's REVEAL that catches you (Milestone 695): its scan's mark names you, and you are told for its seconds. An
  // enemy bot's, as it would come off the wire (duel.ts receiveSquad); a squad mate's tells you nothing
  const told = await ev<{ before: number; mate: number; enemy: number } | null>(
    page,
    `(() => { const R = window.__range; const d = R.duel(); const foe = d.bots.find((b) => !d.isFriend(b.bot.remote.id)); const mate = d.bots.find((b) => d.isFriend(b.bot.remote.id)); if (!foe) return null; const before = R.sk.revealedLeft();
      const mark = { t: "mark", k: "scan", at: [R.player.pos.x, R.player.pos.y, R.player.pos.z], label: "", target: d.id };
      if (mate) d.receiveSquad(mark, mate.bot.remote.id, null); const fromMate = R.sk.revealedLeft();
      d.receiveSquad(mark, foe.bot.remote.id, null); return { before, mate: fromMate, enemy: R.sk.revealedLeft() }; })()`,
  );
  check("speedkills: an enemy's REVEAL that catches you puts REVEALED up for its seconds, a squad mate's does not", !!told && told.before === 0 && told.mate === 0 && told.enemy > 7, JSON.stringify(told));
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
  check("speedkills br: 100 health and 50 shield", start.health === 100 && start.shieldMax === 50, JSON.stringify(start));
  const spireBots = await ev<number>(page, `(() => { const d = window.__range.duel(); const m = window.__range.brMap; const c = m.pois.find((p) => p.id === "c"); return d.bots.filter((b) => b.dropTo && (m.placeAt(b.dropTo.x, b.dropTo.z)?.id === "c" || (c && Math.max(Math.abs(b.dropTo.x - c.x), Math.abs(b.dropTo.z - c.z)) <= 60))).length; })()`);
  // (at the Spire: in the centre's sector or within 10 m of its edge, the street round it: each one's spot is walked out to
  // open ground clear of the drops' room, and of the fifteen that aim for it two to five came down just over the line)
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
      // 1.2 m passed over one on a roof. A ray at 1.4 m is cast too and must miss, so every run proves the crouch (the
      // crouched soldier's volumes reach 1.25 m, its head, so a ray at 1.2 met the head on some runs with the bot
      // crouched all the same; standing, its chest spans 1.4 and its head tops 1.86; top reports the reach)
      // the one the game outlines (main.ts outlined): which pieces of it show depends on the figure's level of
      // detail, which a ?norender page never updates, so the count read 0 on some bots; the picture is sk-outline's
      const lit = () => (r.outlinedNow() === b.bot.dummy ? 1 : 0);
      // what the game's outline ray needed, for a failure to say which part was missing
      const at = { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) };
      const why = () => ({ playing: r.input.playing, inAvatars: d.avatars.includes(b.bot.dummy), meshes: b.bot.dummy.hitMeshes.length, shown: b.bot.dummy.group.visible, other: r.outlinedNow() ? r.outlinedNow() !== b.bot.dummy : false, from: at, now: { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) }, bot: { x: +b.bot.pos.x.toFixed(2), y: +b.bot.pos.y.toFixed(2), z: +b.bot.pos.z.toFixed(2) }, pitch: +r.player.pitch.toFixed(1), ray: (() => { const T = r.THREE; const cast = (pitch) => new T.Raycaster(r.player.eyePosition(), new T.Vector3(0, 0, -1).applyQuaternion(r.player.orientationAt(r.player.yaw, pitch, 0, 0))).intersectObjects(b.bot.dummy.hitMeshes, false).length; const w = b.bot.dummy.hitMeshes[1].getWorldPosition(new T.Vector3()); return { hits: cast(r.player.pitch), at12: cast(Math.atan2(b.bot.pos.y + 1.4 - r.player.eyePosition().y, 12) * 180 / Math.PI), torso: [+w.x.toFixed(2), +w.y.toFixed(2), +w.z.toFixed(2)], top: +(new T.Box3().setFromObject(b.bot.dummy.hits).max.y - b.bot.pos.y).toFixed(2) }; })() });
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
  // the quiet minute (decay.json grace, the owner's 2026-10-11 rule): the ring set just short of wave 1's warning flags
  // nothing, and just past it warns wave 1's two sectors (their beams and the map's colour read these states)
  const warnLen = await ev<number>(page, "window.__range.duel().phases[0].warn ?? 0");
  await push(warnLen + 3);
  await sleep(400);
  const calm = await ev<Decay>(page, "window.__range.sk.decay()");
  await push(warnLen - 3);
  await sleep(400);
  const warned = await ev<Decay>(page, "window.__range.sk.decay()");
  check(
    "speedkills decay: the quiet minute, no sector flagged before wave 1's warning, then its sectors warned",
    warnLen > 0 && Object.values(calm.states).every((s) => s.phase === "live") && decay0.plan.waves[0].every((id) => warned.states[id].phase === "warning"),
    JSON.stringify({ warnLen, calm: Object.values(calm.states).filter((s) => s.phase !== "live").length, warned: decay0.plan.waves[0].map((id) => warned.states[id].phase) }),
  );
  await push(0.05);
  await sleep(1200);
  const dec = await ev<Decay>(page, "window.__range.sk.decay()");
  const first = decay0.plan.waves[0];
  check("speedkills decay: the first wave's sectors decay, from the ground up, and their boxes leave the collision list", first.every((id) => dec.states[id].phase === "decaying") && dec.held > 0, JSON.stringify({ states: first.map((id) => dec.states[id]), held: dec.held }));
  // standing in a decaying sector hurts (from after its first tick: until one lands a part-empty shield refills at its own
  // rate, 17 a second, and outran the first two ticks)
  // (topped up first and taken to the final sector after: the fights before had left the player at 70 and at 4 of 150 on
  // 2026-10-16, and a player the decay kills here ends the match, so the waves and the capture after it read nothing)
  const hurt = await ev<{ before: number; after: number }>(
    page,
    `(() => new Promise((ok) => { const r = window.__range; const d = r.duel(); d.holdFire = true; d.health = 100; d.shield = d.shieldMax; const s = r.brMap.pois.find((p) => p.id === "${first[0]}"); r.player.teleport(s.x, 0.3, s.z, 0); setTimeout(() => { const before = d.health + d.shield; setTimeout(() => { const after = d.health + d.shield; const f = r.brMap.pois.find((p) => p.id === "${decay0.plan.final}"); r.player.teleport(f.x, 150, f.z, 0); d.health = 100; d.shield = d.shieldMax; ok({ before, after }); }, 3500); }, 1600); }))()`
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
  // the kill feed carries the gun and the head (Milestone 701): an enemy bot dropped by your round to the head, through
  // the match's own path for a hit of yours (its figure hit, then the match told)
  const fk = await ev<{ killer: string; victim: string; weapon: string | null; head: boolean } | null>(
    page,
    `(() => { const R = window.__range; const d = R.duel(); const foe = d.bots.find((b) => !d.isFriend(b.bot.remote.id) && b.bot.alive); if (!foe) return null; const q = foe.bot.pos;
      foe.bot.dummy.hit(R.gameTime(), "head", 9999, 2, 1, q.clone().setY(q.y + 1.6)); d.localHit(foe.bot.remote, 9999, true, "r97", 12); return R.hud.feedKills[0]; })()`,
  );
  check("speedkills: a kill in the feed carries the gun's outline and the head (USSO, to the head)", !!fk && fk.weapon === "r97" && fk.head && fk.victim.length > 0, JSON.stringify(fk));
  const won = await ev<{ phase: string; placement: number | null; zone?: number[]; me?: number[]; health?: number; progress?: Record<string, number> }>(
    page,
    `(() => new Promise((ok) => { const r = window.__range; const d = r.duel(); d.holdFire = true; for (const b of d.bots) if (b.bot.alive) { b.bot.pos.set(b.bot.pos.x + 400, b.bot.pos.y, b.bot.pos.z); } const z = d.captureZone(); d.health = 100; r.player.teleport(z.x, 150, z.z, 0);
      d.capture.progress.set(d.sideOf(d.id), ${45} - 1.5); setTimeout(() => { const p = r.player.pos; ok({ phase: d.phase, placement: d.placement, zone: [Math.round(z.x), Math.round(z.z)], me: [Math.round(p.x), Math.round(p.y * 10) / 10, Math.round(p.z)], health: d.health, progress: Object.fromEntries([...d.capture.progress].map(([k, v]) => [k, Math.round(v * 10) / 10])) }); }, 3500); }))()`
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
/**
 * The soldier's neck from behind, the sides and above: no gap at the bottom of the back of the neck you can see through
 * (the owner, 2026-10-12, in third person with the USSO: Milestone 560's collar, lowered to show the whole head, went 5
 * cm under the bottom edge of the neck's skin all round the back). Every gun, standing, aimed level, 30 degrees down and
 * up, crouched and aimed, and sprinting, from straight behind, 35 degrees to either side and from above, 0.9 m away: the
 * figure alone on flat magenta, drawn as it is and then with the back of every surface flat green. A pixel within 15 cm
 * either side of the neck, between the head and 12 cm under the neck bone, that shows the world in the first picture and
 * the body's inside in the second is a ray through a gap in the surface out to the world. (The inside alone is not a gap:
 * a shoulder plate's rim shows its own inside with the suit behind it, and the space between an arm and the body shows
 * the world with no inside in front of it.)
 */
/**
 * The soldier on a wall and in the skydive, as others see it (Milestone 604): both were the jump pose until then. On a
 * wall it leans off it, its feet toward it, the gun up; gliding it lies on the air, diving it goes head down; in the
 * fall the gun is away and on the ground it stands up again with it. And the head's hit volume goes with the head: the
 * volumes follow the bones (dummy.ts followBones), so a body leant 25 degrees is hit where it is drawn.
 */
async function figureStancesTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?norender");
  const ready = await page.waitForFunction("window.__range.soldierReady() && window.__range.paidGuns().ready", { polling: 250, timeout: 180000 }).then(() => true, () => false);
  if (!ready) {
    console.log("  --  the soldier's or the guns' files are not here (npm run paid makes them), so its wall run and skydive are not checked");
    await page.close();
    return;
  }
  await page.addScriptTag({ path: "tools/figure-audit.js" });
  type Seen = { spine: number[]; head: number; soles: number; gun: boolean; inHand: boolean; gunDeep: number; headVolume: number };
  /** a figure in `pose` for `seconds`, then `after` for `then` seconds if given: where its parts are in its own frame (+x its left) */
  const seen = (pose: Record<string, unknown>, seconds = 1.5, after?: Record<string, unknown>, then = 0) =>
    ev<Seen>(
      page,
      `(() => {
        const r = window.__range, T = r.THREE;
        r.player.teleport(0, 0, 0, 0, 0);
        r.figureLabManual(false); r.figureLab([{ ...${JSON.stringify(pose)}, weapon: "r97", look: "S0000010" }], 3, 180); r.figureLabManual(true);
        for (let i = 0; i < ${Math.round(seconds / 0.05)}; i++) r.figureLabStep(0.05);
        const f = r.labFigures()[0], mq = f.mq;
        // (the same figure on into the next pose: the lab holds its own, so this one is stepped here)
        ${after ? `for (let i = 0, t = 1e5; i < ${Math.round(then / 0.05)}; i++) { t += 0.05; f.setPose(${JSON.stringify(after)}); f.update(t, 0.05); }` : ""}
        const g = f, m = mq;
        g.group.updateMatrixWorld(true);
        const at = (n) => g.group.worldToLocal(m.bone(n).getWorldPosition(new T.Vector3()));
        const pelvis = at("pelvis");
        const spine = at("neck_01").sub(pelvis).normalize();
        const head = at("Head");
        const vol = g.hitMeshes.find((h) => h.userData.zone === "head");
        const headVolume = vol ? vol.getWorldPosition(new T.Vector3()).distanceTo(m.bone("Head").getWorldPosition(new T.Vector3())) : -1;
        return { spine: [spine.x, spine.y, spine.z].map((v) => Math.round(v * 100) / 100), head: Math.round((head.x - pelvis.x) * 1000) / 1000, soles: Math.round(((at("ball_l").x + at("ball_r").x) / 2 - pelvis.x) * 1000) / 1000, gun: !!m.gun?.visible, inHand: !!m.gunInHand, gunDeep: Math.max(0, ...Object.values(window.__figureAudit(0, { pitch: 0, exact: true }).gunWhere ?? {})), headVolume: Math.round(headVolume * 1000) / 1000 };
      })()`,
    );
  const stand = await seen({ speed: 0, stance: "stand", pitch: 0 });
  const left = await seen({ speed: 12, stance: "wallL", pitch: 0, moveDir: 0 });
  const right = await seen({ speed: 12, stance: "wallR", pitch: 0, moveDir: 0 });
  check(
    "on a wall the soldier leans off it, its head away from the wall and its feet toward it, the gun up (a wall on its left, then its right)",
    left.head < -0.15 && left.soles > 0.15 && right.head > 0.15 && right.soles < -0.15 && left.gun && right.gun,
    `left: head ${left.head} m, feet ${left.soles} m; right: head ${right.head}, feet ${right.soles} m across the hips`,
  );
  check(
    "and its head's hit volume goes with the drawn head (no further from the Head bone than standing, within 2 cm)",
    stand.headVolume >= 0 && Math.abs(left.headVolume - stand.headVolume) < 0.02 && Math.abs(right.headVolume - stand.headVolume) < 0.02,
    `standing ${stand.headVolume} m, on the walls ${left.headVolume} and ${right.headVolume}`,
  );
  const glide = await seen({ speed: 14, stance: "skydive", pitch: 0, moveDir: 0 });
  const dive = await seen({ speed: 5, stance: "skydive", pitch: -80, moveDir: 0 });
  const landed = await seen({ speed: 5, stance: "skydive", pitch: -80 }, 1.5, { speed: 0, stance: "stand", pitch: 0 }, 1.2);
  check(
    "in the skydive it lies on the air gliding and goes head down diving, its hands empty; on the ground it stands with the gun in them again",
    Math.abs(glide.spine[1]) < 0.35 && glide.spine[2] > 0.8 && dive.spine[1] < -0.7 && !glide.inHand && !dive.inHand && landed.spine[1] > 0.85 && landed.gun && landed.inHand,
    `along the back: glide ${glide.spine}, dive ${dive.spine}, landed ${landed.spine}; in hand ${glide.inHand}/${dive.inHand}/${landed.inHand}`,
  );
  // (and the gun slung on its back for the fall, Milestone 612: shown, and no bone of it in the gun, gliding or diving)
  check(
    "in the skydive its gun rides on its back: shown, not in its hands, and nothing of it in the gun (5 mm at most), gliding and diving",
    glide.gun && dive.gun && glide.gunDeep <= 5 && dive.gunDeep <= 5,
    `shown ${glide.gun}/${dive.gun}, deepest in it ${glide.gunDeep}/${dive.gunDeep} mm`,
  );
  // GRAPPLE (Milestone 607): pulled to a point 8 m ahead and 5 m up, the left forearm points at it, the gun still in the
  // right hand; once the pull's 1.6 s are up, the arm has gone back to the gun
  const grab = await ev<{ during: number; after: number; gun: boolean }>(
    page,
    `(() => {
      const r = window.__range, T = r.THREE;
      r.player.teleport(0, 0, 0, 0, 0);
      r.figureLabManual(false); const [f] = r.figureLab([{ speed: 6, stance: "air", pitch: 20, weapon: "r97", look: "S0000010" }], 3, 180); r.figureLabManual(true);
      r.figureLabStep(0.5);
      const to = f.group.localToWorld(new T.Vector3(0.5, 5, 8));
      f.reachFor(to, 1.6, 2);
      const off = () => { const at = (n) => f.mq.bone(n).getWorldPosition(new T.Vector3()); const fore = at("hand_l").sub(at("lowerarm_l")).normalize(); return Math.round(Math.acos(Math.max(-1, Math.min(1, fore.dot(to.clone().sub(at("lowerarm_l")).normalize())))) * 180 / Math.PI); };
      for (let i = 0; i < 8; i++) r.figureLabStep(0.05);
      const during = off(), gun = !!f.mq.gun?.visible;
      for (let i = 0; i < 40; i++) r.figureLabStep(0.05);
      return { during, after: off(), gun };
    })()`,
  );
  check("a grapple: the left arm points at its hook point (within 10 degrees), the gun still in the right hand, and goes back to the gun after", grab.during <= 10 && grab.gun && grab.after > 30, JSON.stringify(grab));
  // A zip line (Milestone 616): the rider hangs from the rope by the left hand, closed round it, the gun in the right
  // hand, every gun (it stood in the air under the rope with the gun in both hands). The rope runs movement.json
  // ziplineHang over the feet the game moves; the knuckles go figure.json zipline.grip off the point right over them
  const ZIP = (figureCfg as unknown as { zipline: { grip: number[] } }).zipline;
  const zips = await ev<Array<{ id: string; knuckle: number; off: number; gun: boolean; inHand: boolean; grip: number | null }>>(
    page,
    `(async () => {
      const r = window.__range, T = r.THREE, out = [];
      const hang = ${movementCfg.ziplineHang} * 0.0254, G = ${JSON.stringify(ZIP.grip)};
      for (const id of ${JSON.stringify(Object.keys(soldierHoldCfg.guns).filter((k) => !k.startsWith("_")))}) {
        r.player.teleport(0, 0, 0, 0, 0);
        r.figureLabManual(false); const [f] = r.figureLab([{ speed: 0, stance: "stand", pitch: 0, weapon: id, look: "S0000010" }], 3, 180); r.figureLabManual(true);
        r.figureLabStep(1);
        r.figureLabPose(0, { speed: 10, stance: "zip", pitch: 0, moveDir: 0 });
        for (let i = 0; i < 24; i++) r.figureLabStep(0.05);
        const mq = f.mq, at = (n) => mq.bone(n).getWorldPosition(new T.Vector3());
        // (the hold: G[0] to its left and G[2] ahead of the point right over its feet, G[1] under the rope)
        const hold = f.group.localToWorld(new T.Vector3(G[0], 0, G[2])); hold.y = f.group.getWorldPosition(new T.Vector3()).y + hang - G[1];
        const k = at("middle_01_l");
        const a = window.__figureAudit(0, { pitch: 0 });
        out.push({ id, knuckle: Math.round(k.distanceTo(hold) * 1000) / 10, off: Math.round(k.distanceTo(at("middle_01_r")) * 100), gun: !!mq.gun?.visible, inHand: !!mq.gunInHand, grip: a?.grip ?? null });
      }
      return out;
    })()`,
  );
  const zipBad = zips.filter((z) => !(z.knuckle <= 3 && z.off >= 30 && z.gun && z.inHand && (z.grip ?? 99) <= 3));
  check(
    "on a zip line it hangs from the rope by its left hand, every gun: the left knuckles within 3 cm of their hold under the rope, the left hand off the gun (30 cm or more from the right), the gun shown and its grip in the right hand (3 cm)",
    zips.length > 0 && zipBad.length === 0,
    JSON.stringify(zipBad.length ? zipBad : zips.map((z) => `${z.id} ${z.knuckle}cm`)),
  );
  // The gun put away (Milestone 617): an emote and an interact take the hands, and a long gun went with them, gone from
  // the figure until it was back in its hands. Now a long gun rides on the back as it does in the skydive (holsterMount),
  // shown and nothing of the soldier in it (figure.json sling: upright and to the left of the spine, the arms clear of it
  // even where they come behind the back); a pistol is put away; and after, it is back in the hands
  // (and a climb, Milestone 618: a long gun went with the right hand onto the ledge, a pistol stays in it)
  const away = await ev<Array<{ id: string; emote: { gun: boolean; inHand: boolean; deep: number }; interact: { gun: boolean; inHand: boolean; deep: number }; climb: { gun: boolean; inHand: boolean; deep: number }; after: { gun: boolean; inHand: boolean } }>>(
    page,
    `(() => {
      const r = window.__range, out = [];
      for (const id of ["r97", "sentinel", "launcher", "wingman"]) {
        r.player.teleport(0, 0, 0, 0, 0);
        r.figureLabManual(false); const [f] = r.figureLab([{ speed: 0, stance: "stand", pitch: 0, weapon: id, look: "S0000010" }], 3, 180); r.figureLabManual(true);
        r.figureLabStep(1);
        const look = () => ({ gun: !!f.mq.gun?.visible, inHand: !!f.mq.gunInHand, deep: Math.max(0, ...Object.values(window.__figureAudit(0, { pitch: 0, exact: true }).gunWhere ?? {})) });
        f.emote(0);
        for (let i = 0; i < 20; i++) r.figureLabStep(0.05);
        const emote = look();
        for (let i = 0; i < 60; i++) r.figureLabStep(0.05);
        r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0, act: "interact" });
        for (let i = 0; i < 16; i++) r.figureLabStep(0.05);
        const interact = look();
        r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0 });
        for (let i = 0; i < 30; i++) r.figureLabStep(0.05);
        r.figureLabPose(0, { speed: 0, stance: "climb", pitch: 0 });
        for (let i = 0; i < 12; i++) r.figureLabStep(0.05);
        const climb = look();
        r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0 });
        for (let i = 0; i < 30; i++) r.figureLabStep(0.05);
        out.push({ id, emote, interact, climb, after: { gun: !!f.mq.gun?.visible, inHand: !!f.mq.gunInHand } });
      }
      return out;
    })()`,
  );
  const awayBad = away.filter((a) => {
    const pistol = (soldierHoldCfg.guns as Record<string, { stance?: string }>)[a.id]?.stance === "pistol";
    const slung = (s: { gun: boolean; inHand: boolean; deep: number }) => (pistol ? !s.gun : s.gun && !s.inHand && s.deep <= 5);
    return !(slung(a.emote) && slung(a.interact) && (pistol ? a.climb.gun && a.climb.inHand : slung(a.climb)) && a.after.gun && a.after.inHand);
  });
  check(
    "in an emote, holding interact and in a climb, a long gun rides on the back (shown, out of the hands, nothing of the soldier 5 mm into it); a pistol is put away, and kept in the hand climbing; after, the gun is back in the hands",
    away.length === 4 && awayBad.length === 0,
    JSON.stringify(awayBad.length ? awayBad : away.map((a) => `${a.id} emote ${a.emote.deep} mm, interact ${a.interact.deep} mm, climb ${a.climb.deep} mm`)),
  );
  // SLAM's way down (Milestone 608): a figure in the air coming down at the slam's 38 m/s has its knees up (each knee 20 cm
  // or more higher against its hips than falling at 10 m/s, a jump's)
  const plunge = await ev<{ slow: number; fast: number }>(
    page,
    `(() => {
      const r = window.__range, T = r.THREE;
      const knees = (speed) => {
        r.player.teleport(0, 0, 0, 0, 0);
        r.figureLabManual(false); const [f] = r.figureLab([{ speed: 0, stance: "air", pitch: 0, weapon: "r97", look: "S0000010" }], 3, 180); r.figureLabManual(true);
        f.group.position.y = 30;
        for (let i = 0; i < 20; i++) { f.group.position.y -= speed * 0.02; r.figureLabStep(0.02); }
        f.group.updateMatrixWorld(true);
        const at = (n) => f.group.worldToLocal(f.mq.bone(n).getWorldPosition(new T.Vector3()));
        return (at("calf_l").y + at("calf_r").y) / 2 - at("pelvis").y;
      };
      return { slow: Math.round(knees(10) * 1000) / 1000, fast: Math.round(knees(38) * 1000) / 1000 };
    })()`,
  );
  check("SLAM's way down: coming down at 38 m/s its knees are up (20 cm or more higher against its hips than falling at 10 m/s)", plunge.fast - plunge.slow >= 0.2, JSON.stringify(plunge));
  // a run round a turn (Milestone 609): sprinting round a 6 m circle it leans into it, toward the middle, either way
  // round (the mean of the two: a sprint's own sway to one side, 6 degrees mid-stride, is toward the middle one way and
  // away from it the other)
  const lean = await ev<{ left: number; right: number }>(
    page,
    `(() => {
      const r = window.__range, T = r.THREE;
      const run = (dir) => {
        r.player.teleport(0, 0, 0, 0, 0);
        r.figureLabManual(false); const [f] = r.figureLab([{ speed: 12, stance: "stand", pitch: 0, weapon: "r97", look: "S0000010" }], 3, 180); r.figureLabManual(true);
        const c = f.group.position.clone();
        for (let i = 0; i < 60; i++) {
          const t = i * 0.02;
          const a = dir * 2 * t;
          f.group.position.set(c.x + 6 * Math.cos(a), c.y, c.z + 6 * Math.sin(a));
          f.group.rotation.y = Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir);
          r.figureLabStep(0.02);
        }
        // the back's lean across the way it runs, toward the circle's middle (+), degrees: the run's own lean forward left out
        const at = (n) => f.mq.bone(n).getWorldPosition(new T.Vector3());
        const sp = at("neck_01").sub(at("pelvis")).normalize();
        const fwd = new T.Vector3(0, 0, 1).applyQuaternion(f.group.quaternion).setY(0).normalize();
        const left = new T.Vector3(0, 1, 0).cross(fwd).normalize();
        const mid = c.clone().sub(at("pelvis")).setY(0);
        const inward = mid.dot(left) >= 0 ? left : left.negate();
        return Math.asin(Math.max(-1, Math.min(1, sp.dot(inward)))) * 180 / Math.PI;
      };
      return { left: Math.round(run(1) * 10) / 10, right: Math.round(run(-1) * 10) / 10 };
    })()`,
  );
  check("a run round a turn: sprinting round a 6 m circle either way its back leans toward the middle, 5 degrees or more on the mean of the two", (lean.left + lean.right) / 2 >= 5 && lean.left > 0 && lean.right > 0, JSON.stringify(lean));
  // a death falls away from the shot (Milestone 610): shot dead from its left, from behind and from the front, its head
  // ends up on the far side, a metre or more from where it stood
  const death = await ev<Record<string, number>>(
    page,
    `(() => {
      const r = window.__range, T = r.THREE;
      const out = {};
      for (const [name, side] of [["left", [1, 0]], ["behind", [0, -1]], ["front", [0, 1]]]) {
        r.player.teleport(0, 0, 0, 0, 0);
        r.figureLabManual(false); const [f] = r.figureLab([{ speed: 0, stance: "stand", pitch: 0, weapon: "r97", look: "S0000010" }], 4, 180); r.figureLabManual(true);
        r.figureLabStep(0.3);
        f.group.updateMatrixWorld(true);
        const from = f.group.localToWorld(new T.Vector3(side[0] * 0.3, 1.3, side[1] * 0.3));
        const feet = f.group.position.clone();
        f.hit(1000, "body", 500, 1, 1, from);
        for (let i = 0; i < 50; i++) r.figureLabStep(0.05);
        const head = f.mq.bone("Head").getWorldPosition(new T.Vector3());
        const away = feet.clone().sub(from).setY(0).normalize();
        out[name] = Math.round(head.sub(feet).setY(0).dot(away) * 100) / 100;
      }
      return out;
    })()`,
  );
  check("a death falls away from the shot: shot from its left, from behind and from the front, the head ends a metre or more away on the far side", Object.values(death).every((d) => d >= 1), JSON.stringify(death));
  // and never through a wall (Milestone 619): knocked down with its back to a wall 0.45 m behind it, square on and turned
  // 30 degrees, the head stays this side of the wall (every such fall in the Neon City lay through it). The wall is a box
  // put in the page's solids for the check and taken out after
  const walled = await ev<Array<{ turn: number; head: number }>>(
    page,
    `(async () => {
      const r = window.__range, T = r.THREE;
      const { RANGE_SOLIDS } = await import("/src/game/range.ts");
      const { rebuildSolidGrid } = await import("/src/game/solidgrid.ts");
      const out = [];
      for (const turn of [0, 30]) {
        r.player.teleport(0, 0, 0, 0, 0);
        r.figureLabManual(false); const [f] = r.figureLab([{ speed: 0, stance: "stand", pitch: 0, weapon: "r97", look: "S0000010" }], 4, 180 + turn); r.figureLabManual(true);
        r.figureLabStep(0.3);
        const at = f.group.position.clone();
        // the wall across +z behind it: it faces -z, turned 180 from the camera, so its back is to +z
        const wall = { minX: at.x - 3, maxX: at.x + 3, minZ: at.z + 0.45, maxZ: at.z + 0.8, base: at.y - 0.1, top: at.y + 3 };
        RANGE_SOLIDS.push(wall);
        rebuildSolidGrid();
        f.fallDown();
        for (let i = 0; i < 50; i++) r.figureLabStep(0.05);
        const head = f.mq.bone("Head").getWorldPosition(new T.Vector3());
        out.push({ turn, head: Math.round((head.z - at.z) * 100) / 100 });
        RANGE_SOLIDS.splice(RANGE_SOLIDS.indexOf(wall), 1);
        rebuildSolidGrid();
      }
      return out;
    })()`,
  );
  check("and never through a wall: its back to a wall 0.45 m behind, square on and turned 30 degrees, its head ends this side of it", walled.length === 2 && walled.every((w) => w.head < 0.45), JSON.stringify(walled));
  // A slide (Milestone 831): sat up with the gun on the look, every gun, the way a player shoots sliding. Played whole,
  // the clip laid the soldier on its back, the gun 25 to 55 degrees off where it looked
  const slides = await ev<Array<{ id: string; lean: number; aim: number | null; grip: number | null; gunIn: number }>>(
    page,
    `(() => {
      const r = window.__range, T = r.THREE, out = [];
      for (const id of ${JSON.stringify(Object.keys(soldierHoldCfg.guns).filter((k) => !k.startsWith("_")))}) {
        r.player.teleport(0, 0, 0, 0, 0);
        r.figureLabManual(false); const [f] = r.figureLab([{ speed: 12, stance: "stand", pitch: 0, weapon: id, look: "S0000010" }], 3, 180); r.figureLabManual(true);
        r.figureLabStep(0.6);
        r.figureLabPose(0, { speed: 12, stance: "slide", pitch: 0 });
        for (let i = 0; i < 10; i++) r.figureLabStep(0.05);
        const mq = f.mq, toFig = mq.root.getWorldQuaternion(new T.Quaternion()).invert();
        const line = mq.bone("neck_01").getWorldPosition(new T.Vector3()).sub(mq.bone("spine_03").getWorldPosition(new T.Vector3())).applyQuaternion(toFig);
        const a = window.__figureAudit(0, { pitch: 0, exact: true });
        out.push({ id, lean: Math.round(Math.atan2(line.z, line.y) * 180 / Math.PI), aim: a?.aim ?? null, grip: a?.grip ?? null, gunIn: Math.max(0, ...Object.values(a?.gunWhere ?? {})) });
      }
      return out;
    })()`,
  );
  const slideBad = slides.filter((s) => !(Math.abs(s.lean) <= 15 && (s.aim ?? 99) <= 6 && (s.grip ?? 99) <= 3 && s.gunIn <= 40));
  check(
    "a slide, every gun: sat up (the upper chest within 15 degrees of upright), the gun along the look (6 degrees) in the right hand (3 cm), and no more than 40 mm of it in the soldier",
    slides.length > 0 && slideBad.length === 0,
    JSON.stringify(slideBad.length ? slideBad : slides.map((s) => `${s.id} lean ${s.lean} aim ${s.aim} in ${s.gunIn}`)),
  );
  // a landing taken in the legs (Milestone 611): a second in the air and down on the run, its legs (hips over the lower
  // ankle) come down to two thirds of their standing length for a moment (the run's clip alone, 83%), and no ankle goes
  // under its height on the floor
  const land = await ev<{ legs: number; ankle: number }>(
    page,
    `(() => {
      const r = window.__range, T = r.THREE;
      r.player.teleport(0, 0, 0, 0, 0);
      r.figureLabManual(false); const [f] = r.figureLab([{ speed: 6, stance: "air", pitch: 0, weapon: "r97", look: "S0000010" }], 3, 180); r.figureLabManual(true);
      let t = 1e5;
      const step = (pose, n) => { for (let i = 0; i < n; i++) { t += 0.02; f.setPose(pose); f.update(t, 0.02); } };
      step({ speed: 6, stance: "air", pitch: 0 }, 50);
      step({ speed: 6, stance: "stand", pitch: 0 }, 3);
      f.group.updateMatrixWorld(true);
      const y = (n) => f.group.worldToLocal(f.mq.bone(n).getWorldPosition(new T.Vector3())).y;
      const ankle = Math.min(y("foot_l"), y("foot_r"));
      const legs = (y("pelvis") - ankle) / (f.mq.hipY - f.mq.ankleY);
      return { legs: Math.round(legs * 100) / 100, ankle: Math.round((ankle - f.mq.ankleY) * 1000) / 1000 };
    })()`,
  );
  check("a landing taken in the legs: down on the run from a second in the air, its legs come down to two thirds of their standing length or less, and no ankle under the floor", land.legs <= 0.67 && land.ankle >= -0.01, JSON.stringify(land));
  await page.close();
}

async function neckSeamTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?");
  const SIZE = 480;
  await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 });
  const ready = await page.waitForFunction("window.__range.soldierReady() && window.__range.paidGuns().ready", { polling: 250, timeout: 180000 }).then(() => true, () => false);
  if (!ready) {
    console.log("  --  the soldier's or the guns' files are not here (npm run paid makes them), so the neck's seam is not checked");
    await page.close();
    return;
  }
  await ev(page, `(() => { document.getElementById("overlay").classList.add("hidden"); const r = window.__range; r.input.locked = true; r.hideViewModel(true); document.getElementById("hud")?.style.setProperty("display", "none"); r.shotFov(40); })()`);
  const guns = Object.keys((soldierHoldCfg as { guns: Record<string, unknown> }).guns);
  const poses: Record<string, Record<string, unknown>> = {
    stand: { speed: 0, stance: "stand", pitch: 0 },
    aimed: { speed: 0, stance: "stand", pitch: 0, ads: 1 },
    "aimed down": { speed: 0, stance: "stand", pitch: -30, ads: 1 },
    "aimed up": { speed: 0, stance: "stand", pitch: 30, ads: 1 },
    "crouched aimed": { speed: 0, stance: "crouch", pitch: 0, ads: 1 },
    sprint: { speed: 14, stance: "stand", pitch: 0 },
  };
  const views: Record<string, number> = { behind: 0, "its left": -35, "its right": 35, above: 0 };
  const pixels = async (): Promise<{ data: Buffer; channels: number; width: number; height: number }> => {
    const { data, info } = await sharp(await page.screenshot()).raw().toBuffer({ resolveWithObject: true });
    return { data, channels: info.channels, width: info.width, height: info.height };
  };
  const bad: string[] = [];
  let shots = 0;
  for (const [view, turn] of Object.entries(views)) {
    // the view settles onto the eye over a moment after a teleport: both pictures of a shot must be of the same frame
    await ev(page, `window.__range.player.teleport(0, 0, 0, 0, ${view === "above" ? -22 : 0})`);
    await sleep(1200);
    for (const gun of guns)
      for (const [pose, p] of Object.entries(poses)) {
        const at = await ev<{ neck: number[]; head: number[]; ppm: number }>(
          page,
          `(() => {
            const r = window.__range, T = r.THREE;
            r.figureLabManual(false); r.figureLab([{ ...${JSON.stringify(p)}, weapon: "${gun}", look: "S0000010" }], 2.4, 180); r.figureLabManual(true);
            r.figureLabStep(1.5);
            const f = r.labFigures()[0];
            const scene = f.group.parent;
            for (const c of scene.children) if (c !== f.group && !c.isLight && !c.isCamera) c.visible = false;
            scene.background = new T.Color(1, 0, 1);
            scene.fog = null;
            const C = r.camera;
            C.updateMatrixWorld(true);
            const cam = C.getWorldPosition(new T.Vector3());
            const F = C.getWorldDirection(new T.Vector3());
            f.group.rotation.y += ${turn} * Math.PI / 180;
            f.group.updateMatrixWorld(true);
            const neck0 = new T.Vector3().setFromMatrixPosition(f.mq.bone("neck_01").matrixWorld);
            f.group.position.add(cam.clone().addScaledVector(F, 0.9).sub(neck0));
            r.figureLabStep(0.05);
            f.group.updateMatrixWorld(true);
            const neck = new T.Vector3().setFromMatrixPosition(f.mq.bone("neck_01").matrixWorld);
            const head = new T.Vector3().setFromMatrixPosition(f.mq.bone("Head").matrixWorld);
            const px = (v) => { const q = v.clone().project(C); return [(q.x + 1) / 2 * ${SIZE}, (1 - q.y) / 2 * ${SIZE}]; };
            const right = new T.Vector3(1, 0, 0).applyQuaternion(C.quaternion);
            const n = px(neck), s = px(neck.clone().addScaledVector(right, 0.1));
            return { neck: n, head: px(head), ppm: Math.hypot(s[0] - n[0], s[1] - n[1]) / 0.1 };
          })()`,
        );
        await sleep(300);
        const drawn = await pixels();
        await ev(
          page,
          `(() => { const T = window.__range.THREE; window.__range.labFigures()[0].figure.root.traverse((o) => {
            if (!o.isSkinnedMesh) return;
            const m = o.material.clone();
            m.side = T.DoubleSide;
            m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <dithering_fragment>", "#include <dithering_fragment>" + String.fromCharCode(10) + " if (!gl_FrontFacing) gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);"); };
            m.customProgramCacheKey = () => "inside";
            m.toneMapped = false;
            o.material = m;
          }); })()`,
        );
        await sleep(300);
        const inside = await pixels();
        const x0 = at.neck[0] - 0.15 * at.ppm, x1 = at.neck[0] + 0.15 * at.ppm;
        const y0 = Math.min(at.head[1], at.neck[1]), y1 = at.neck[1] + 0.12 * at.ppm;
        let through = 0;
        for (let y = Math.max(0, Math.floor(y0)); y < Math.min(drawn.height, y1); y++)
          for (let x = Math.max(0, Math.floor(x0)); x < Math.min(drawn.width, x1); x++) {
            const a = (y * drawn.width + x) * drawn.channels;
            const b = (y * inside.width + x) * inside.channels;
            const world = drawn.data[a] > 150 && drawn.data[a + 1] < 90 && drawn.data[a + 2] > 150;
            const back = inside.data[b] < 60 && inside.data[b + 1] > 200 && inside.data[b + 2] < 60;
            if (world && back) through++;
          }
        shots++;
        if (through > 5) bad.push(`${gun} ${pose} from ${view}: ${through} px`);
      }
  }
  check(`soldier's neck: no gap at the bottom of the back of the neck to see through, on every gun, six poses, from behind, either side and above (${shots} shots)`, shots === guns.length * 24 && bad.length === 0, bad.slice(0, 6).join("; ") || `${shots} shots, none`);
  await page.close();
}

async function figureHoldTest(browser: Browser): Promise<void> {
  const page = await open(browser, "?norender");
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
  // (a gun carried low unless aimed, DEVINOS's tube, soldierhold.json carryLow: at rest its barrel is not along the look)
  const carriedLow = (id: string) => !!(soldierHoldCfg.guns as Record<string, { carryLow?: unknown }>)[id]?.carryLow;
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
      check(`the soldier holding ${name}, ${label}: both palms on their holds and the fingers round them, the barrel along the look${label === "at rest" && carriedLow(id) ? " (carried low, not along it)" : ""}, the wrists straight enough, no hand in the gun or the other hand and the gun not in the body`, within(a, !(label === "at rest" && carriedLow(id)), id), JSON.stringify(a));
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
    // straight finger read as not firing), and the only finger in the guard (the owner, 2026-10-23: "never more than one
    // finger in the trigger guard, and that one finger should be your pointer finger, and it should always be on the
    // trigger with a slight bit of the finger, like tip, extending from the left side"): aimed in, its last phalanx's pad
    // on the trigger's face (2 mm at most), its tip past the trigger's left side by a little (1 to 6 mm), and no other
    // finger of the hand more than 1 mm into the guard (Milestone 614)
    const trig = await ev<{ pad: number; past: number | null; others: number; which: string | null } | null>(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0, ads: 1 }); r.figureLabStep(0.9); return window.__triggerFit(0); })()`);
    check(
      `the soldier holding ${name}: the right index finger alone in the guard, its pad on the trigger and its tip just past the trigger's left side, aimed in`,
      trig !== null && trig.pad <= 2 && trig.past !== null && trig.past >= 1 && trig.past <= 6 && trig.others <= 1,
      trig ? `pad ${trig.pad} mm off, tip ${trig.past} mm past, another finger ${trig.others} mm into the guard${trig.which ? ` (${trig.which})` : ""}` : "no trigger",
    );
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
    const gunZ = `(() => { const r = window.__range, f = r.labFigures()[0], g = f.figure.gunObject; f.group.updateMatrixWorld(true); return { z: f.group.worldToLocal(g.getWorldPosition(new r.THREE.Vector3())).z, shown: g.visible, inHand: !!f.figure.gunInHand, keys: f.figure.rifleOut?.keys ?? "", curl: Math.round(f.figure.boneAt("middle_02_l").quaternion.angleTo(new r.THREE.Quaternion()) * 57.3), hand: f.group.worldToLocal(f.figure.boneAt("hand_l").getWorldPosition(new r.THREE.Vector3())).toArray() }; })()`;
    type GZ = { z: number; shown: boolean; inHand: boolean; keys: string; curl: number; hand: number[] };
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
    // A grenade thrown: the gun out of the hands for the throw (a long gun on the back since Milestone 617, a pistol put
    // away), and back in them only once both hands are on it (shown at once, it came back through both hands, 23 to 28
    // mm, while they were still on their way)
    await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0, act: "throw" }); r.figureLabStep(0.2); })()`);
    const thrown = await ev<{ z: number; shown: boolean; inHand: boolean }>(page, gunZ);
    let worst = 0;
    let worstOver = -99;
    let backAt = -1;
    for (let i = 1; i <= 16; i++) {
      await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, { speed: 0, stance: "stand", pitch: 0, act: ${i <= 5 ? `"throw"` : "null"} }); r.figureLabStep(0.06); })()`);
      const g = await ev<{ z: number; shown: boolean; inHand: boolean }>(page, gunZ);
      if (!g.inHand) continue;
      if (backAt < 0) backAt = 0.2 + i * 0.06;
      const a = await ev<A | null>(page, `window.__figureAudit(0, { pitch: 0 })`);
      worst = Math.max(worst, a?.handIn?.l ?? 0, a?.handIn?.r ?? 0);
      worstOver = Math.max(worstOver, over(a));
    }
    check(`the soldier's ${name} throw: the gun out of the hands for it, and back in them within a second with no hand through it (8 mm at most, or 3 past its grip's own)`, !thrown.inHand && backAt > 0 && backAt <= 1 && worstOver <= 0, JSON.stringify({ thrown: { shown: thrown.shown, inHand: thrown.inHand }, backAt, worst, restIn }));
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
    check(`the soldier's ${name} reload: after it, the hands are back on the gun`, within(after, !carriedLow(id), id), JSON.stringify(after));
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
      // (a gun carried low unless aimed, DEVINOS's, goes out from its carry and comes in at it: in place there)
      cupOn ? [going, gone, arrived, coming].every((x) => Math.abs(x.lowered - (carriedLow(x.id) ? 1 : 0)) < 0.05 && (x.radial === null || x.radial === 1)) && [gone, arrived].every((x) => /l:cup/.test(x.keys) && /r:cup/.test(x.keys)) && !/cup/.test(after.keys) : gone.lowered > 0.5,
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
  // The head from behind (the owner, 2026-10-04: with BOOG he could not headshot a soldier from behind, its head "all
  // tucked down, like chin is to the player's chest"; 2026-10-11: "ensure 100% of the head is visible from the back, i
  // want to always be able to clearly snipe hs someone from the back"). Shooters 30 m behind, straight and 30 degrees off
  // each way at a standing eye, and straight behind 10 m up; every point of the drawn head turned to one is looked at:
  // what of the soldier is in front of it (its own head and neck skin aside), and a shot at it asked of the hit volumes
  // as the game's own shot asks them (hitpick.ts). The skull is the head over its lowest 6 cm (the jaw and the nape, which
  // the neck and the collar meet). Every shot at the head it shows takes the head; nothing but the soldier's own head and
  // neck hides the skull, save looking 30 degrees down, where the raised right arm and BOOG's stock still hide some of it.
  // Before: the collar hid 36 in 100 of a standing soldier's head from straight behind; DEVINOS's tube, carried on the
  // shoulder, 54 to 95 in 100 from 30 degrees off; and 2 to 7 in 100 shots at a sprinting or crouched soldier's head were
  // headshots before the head was held up (figure.json headUp), the chest held up (chestUp), the torso's volume split at
  // spine_02 and each arm's made two cylinders (dummy.ts followBones)
  {
    const backPoses: Array<[string, string, Record<string, unknown>]> = [
      ["BOOG", "standing", { speed: 0, stance: "stand", pitch: 0 }],
      ["BOOG", "walking", { speed: 3, stance: "stand", pitch: 0 }],
      ["BOOG", "sprinting", { speed: 9.5, stance: "stand", pitch: 0 }],
      ["BOOG", "crouched", { speed: 0, stance: "crouch", pitch: 0 }],
      ["BOOG", "aimed", { speed: 0, stance: "stand", pitch: 0, ads: 1 }],
      ["BOOG", "crouched and aimed", { speed: 0, stance: "crouch", pitch: 0, ads: 1 }],
      ["BOOG", "aimed 30 down", { speed: 0, stance: "stand", pitch: -30, ads: 1 }],
      ["DEVINOS", "standing", { speed: 0, stance: "stand", pitch: 0 }],
      ["DEVINOS", "walking", { speed: 3, stance: "stand", pitch: 0 }],
      ["DEVINOS", "sprinting", { speed: 9.5, stance: "stand", pitch: 0 }],
    ];
    const gunOf: Record<string, string> = { BOOG: "sentinel", DEVINOS: "launcher" };
    type Back = { seen: number; head: number; skullSeen: number; skullHead: number; skull: number; skullHid: number; face: number; chest: number };
    const back: Record<string, Back> = {};
    for (const [look, kit] of [["S0000010", "VANGUARD"], ["S3000010", "RUNNER"]] as const)
      for (const [gun, label, pose] of backPoses)
        back[`${kit} ${gun} ${label}`] = await ev<Back>(
          page,
          `(() => {
            const r = window.__range, T = r.THREE;
            r.player.teleport(0, 0, 0, 0, 0);
            r.figureLabManual(false); r.figureLab([{ ...${JSON.stringify(pose)}, weapon: "${gunOf[gun]}", look: "${look}" }], 6, 180); r.figureLabManual(true); r.figureLabStep(1.2);
            const f = r.labFigures()[0], mq = f.mq; f.group.updateMatrixWorld(true);
            const figQ = f.group.getWorldQuaternion(new T.Quaternion());
            const fwd = new T.Vector3(0, 0, 1).applyQuaternion(figQ).setY(0).normalize(), side = new T.Vector3(-fwd.z, 0, fwd.x);
            const feet = f.group.position.clone();
            // everything drawn near the head, posed once into plain triangles (a ray at a skinned mesh skins every
            // triangle it tries), each marked as the head's own (its corners weighted half and more to Head), the rest of
            // the soldier's skin (its neck), or kit (the collar, the armour, an arm, the gun)
            const head = mq.boneAt("Head"), neck = mq.boneAt("neck_01");
            const hc = head.getWorldPosition(new T.Vector3());
            const P = [], own = [], pts = [], v = new T.Vector3(), nrm = new T.Vector3();
            const hitSet = new Set(f.hitMeshes);
            f.group.traverse((o) => {
              if (!o.isMesh || hitSet.has(o) || !o.visible || o.material?.visible === false) return;
              const g = o.geometry, n = g.attributes.position.count, idx = g.index;
              const W = new Float32Array(n * 3);
              for (let i = 0; i < n; i++) { if (o.isSkinnedMesh) o.getVertexPosition(i, v); else v.fromBufferAttribute(g.attributes.position, i); v.applyMatrix4(o.matrixWorld); W[3 * i] = v.x; W[3 * i + 1] = v.y; W[3 * i + 2] = v.z; }
              const h = o.isSkinnedMesh ? o.skeleton.bones.findIndex((x) => x.name === "Head") : -1;
              const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
              const wOf = (i, b) => { let w = 0; if (b >= 0) for (let c = 0; c < 4; c++) if (si.getComponent(i, c) === b) w += sw.getComponent(i, c); return w; };
              const skin = o.isSkinnedMesh && o.material?.name === "M_head";
              for (let t = 0; t < (idx ? idx.count : n); t += 3) {
                const tri = idx ? [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)] : [t, t + 1, t + 2];
                if (!tri.some((k) => (W[3 * k] - hc.x) ** 2 + (W[3 * k + 1] - hc.y) ** 2 + (W[3 * k + 2] - hc.z) ** 2 < 0.64)) continue;
                for (const k of tri) P.push(W[3 * k], W[3 * k + 1], W[3 * k + 2]);
                own.push((wOf(tri[0], h) + wOf(tri[1], h) + wOf(tri[2], h)) / 3 >= 0.5 ? 2 : skin ? 1 : 0);
              }
              if (h < 0) return;
              for (let i = 0; i < n; i += 2) if (wOf(i, h) >= 0.5) pts.push({ p: new T.Vector3(W[3 * i], W[3 * i + 1], W[3 * i + 2]), n: nrm.fromBufferAttribute(g.attributes.normal, i).transformDirection(o.skeleton.bones[h].matrixWorld).clone() });
            });
            const bg = new T.BufferGeometry(); bg.setAttribute("position", new T.Float32BufferAttribute(P, 3)); bg.computeBoundingSphere();
            const drawn = new T.Mesh(bg, new T.MeshBasicMaterial({ side: T.DoubleSide }));
            const nc = neck.getWorldPosition(new T.Vector3()), up = hc.clone().sub(nc).normalize();
            const lows = pts.map((q) => q.p.clone().sub(nc).dot(up)), low = Math.min(...lows);
            const ray = new T.Raycaster();
            let seen = 0, hd = 0, skullSeen = 0, skullHead = 0, skull = 0, skullHid = 0;
            for (const [az, rise] of [[0, 0], [-30, 0], [30, 0], [0, 10]]) {
              const a = (az * Math.PI) / 180, dir = fwd.clone().multiplyScalar(-Math.cos(a)).addScaledVector(side, Math.sin(a));
              const S = feet.clone().addScaledVector(dir, 30).add(new T.Vector3(0, 1.6 + rise, 0));
              pts.forEach((q, k) => {
                const d = q.p.clone().sub(S), len = d.length(); d.divideScalar(len);
                if (q.n.dot(d) > -0.1) return;
                const isSkull = lows[k] > low + 0.06;
                ray.set(S, d); ray.far = len - 0.012;
                const block = ray.intersectObject(drawn, false).find((x) => own[x.faceIndex] !== 2);
                if (isSkull) { skull++; if (block && own[block.faceIndex] === 0) skullHid++; }
                if (block) return;
                seen++; if (isSkull) skullSeen++;
                ray.far = 80;
                const hit = r.takenHit(ray.intersectObjects(f.hitMeshes, false));
                if (hit && hit.object.userData.zone === "head") { hd++; if (isSkull) skullHead++; }
              });
            }
            // the face's pitch: the bind pose's forward, carried by the Head bone (mannequin.ts holdHeadUp measures it so)
            const face = mq.faceLocal ? mq.faceLocal.clone().transformDirection(head.matrixWorld).applyQuaternion(figQ.clone().invert()) : new T.Vector3(0, -1, 0);
            // the upper chest's lean, spine_03 to the neck, forward of upright (figure.json chestUp)
            const line = nc.clone().sub(mq.boneAt("spine_03").getWorldPosition(new T.Vector3())).applyQuaternion(figQ.clone().invert());
            const pc = (x, y) => Math.round((x / Math.max(1, y)) * 1000) / 10;
            return { seen, head: pc(hd, seen), skullSeen, skullHead: pc(skullHead, skullSeen), skull, skullHid: pc(skullHid, skull), face: Math.round(Math.asin(Math.max(-1, Math.min(1, face.y))) * 573) / 10, chest: Math.round(Math.atan2(line.z, line.y) * 573) / 10 };
          })()`,
        );
    const down = (k: string) => k.endsWith("30 down");
    check(
      "a soldier seen from behind (VANGUARD and RUNNER, 30 m back, straight and 30 degrees off, level and 10 m up; BOOG standing, walking, sprinting, crouched, aimed, crouched and aimed, aimed 30 down; DEVINOS carried standing, walking, sprinting): every shot at the skull it shows is a headshot, and 99 in 100 at the whole head it shows (the jaw and the nape where they meet the collar too)",
      Object.values(back).every((x) => x.skullSeen >= 100 && x.skullHead === 100 && x.head >= 99),
      JSON.stringify(Object.fromEntries(Object.entries(back).map(([k, x]) => [k, { seen: x.seen, head: x.head, skull: x.skullHead }])))
    );
    check(
      "nothing but the soldier's own head and neck hides its skull from behind (its collar, its armour, its arms or its gun: none of it), except looking 30 degrees down, where its raised right arm and BOOG's stock hide 30 in 100 or less",
      Object.entries(back).every(([k, x]) => x.skull >= 100 && x.skullHid <= (down(k) ? 30 : 0.5)),
      JSON.stringify(Object.fromEntries(Object.entries(back).map(([k, x]) => [k, x.skullHid])))
    );
    check(
      "and its face within 20 degrees of where it looks (level, or 30 down), its upper chest leaning no more than 12 degrees forward (figure.json chestUp 8: crouched it leans 11)",
      Object.entries(back).every(([k, x]) => Math.abs(x.face - (down(k) ? -30 : 0)) <= 20 && x.chest <= 12),
      JSON.stringify(Object.fromEntries(Object.entries(back).map(([k, x]) => [k, { face: x.face, chest: x.chest }])))
    );
  }
  // The legs and the arms as they are hit (figure.json legVolume, armVolume, handVolume): shooters 30 m off all round (8
  // ways, at a chest's height) aim at points of the drawn legs and arms they can see, and a shot goes into a volume
  // within 6 cm of the point, either side, or into none until 6 cm past it (the arms: or into none at all, past it).
  // One box from the pelvis to the feet stood between the legs and missed a leg a stride swung out of it: 9 to 23 in
  // 100 went in within 6 cm, 58 to 80 into none (standing, walking, sprinting, crouched). With no volume round the
  // hands, a shot at an arm went into nothing at all 22 to 26 times in 100, most at the left hand round the fore-end
  {
    const legPoses: Array<[string, Record<string, unknown>]> = [
      ["standing", { speed: 0, stance: "stand", pitch: 0 }],
      ["walking", { speed: 3, stance: "stand", pitch: 0 }],
      ["sprinting", { speed: 9.5, stance: "stand", pitch: 0 }],
      ["crouched", { speed: 0, stance: "crouch", pitch: 0 }],
    ];
    const legs: Record<string, { n: number; fit: number; none: number; armN: number; armFit: number; armLost: number }> = {};
    for (const [label, pose] of legPoses)
      legs[label] = await ev<{ n: number; fit: number; none: number; armN: number; armFit: number; armLost: number }>(
        page,
        `(() => {
          const r = window.__range, T = r.THREE;
          r.player.teleport(0, 0, 0, 0, 0);
          r.figureLabManual(false); r.figureLab([{ ...${JSON.stringify(pose)}, weapon: "sentinel", look: "S0000010" }], 6, 180); r.figureLabManual(true); r.figureLabStep(1.2);
          const f = r.labFigures()[0], mq = f.mq; f.group.updateMatrixWorld(true);
          const figQ = f.group.getWorldQuaternion(new T.Quaternion());
          const fwd = new T.Vector3(0, 0, 1).applyQuaternion(figQ).setY(0).normalize(), side = new T.Vector3(-fwd.z, 0, fwd.x);
          // the drawn skin posed once into plain triangles, and every eleventh point of it weighted most to a leg bone or an
          // arm's (a hand and its fingers with it)
          const P = [], pts = [], v = new T.Vector3();
          mq.root.traverse((o) => {
            if (!o.isSkinnedMesh || !o.visible) return;
            const g = o.geometry, n = g.attributes.position.count, idx = g.index, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
            const W = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) { o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld); W[3 * i] = v.x; W[3 * i + 1] = v.y; W[3 * i + 2] = v.z; }
            for (let t = 0; t < (idx ? idx.count : n); t++) { const k = idx ? idx.getX(t) : t; P.push(W[3 * k], W[3 * k + 1], W[3 * k + 2]); }
            for (let i = 0; i < n; i += 11) {
              let bi = -1, bw = -1; for (let c = 0; c < 4; c++) if (sw.getComponent(i, c) > bw) { bw = sw.getComponent(i, c); bi = si.getComponent(i, c); }
              const bn = o.skeleton.bones[bi]?.name ?? "";
              const part = /^(thigh|calf|foot|ball)/.test(bn) ? "leg" : /^(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)/.test(bn) ? "arm" : null;
              if (part) pts.push({ p: new T.Vector3(W[3 * i], W[3 * i + 1], W[3 * i + 2]), part });
            }
          });
          const bg = new T.BufferGeometry(); bg.setAttribute("position", new T.Float32BufferAttribute(P, 3)); bg.computeBoundingSphere();
          const drawn = new T.Mesh(bg, new T.MeshBasicMaterial({ side: T.DoubleSide }));
          const ray = new T.Raycaster();
          let n = 0, fit = 0, none = 0, armN = 0, armFit = 0, armLost = 0;
          for (let az = 0; az < 360; az += 45) {
            const a = (az * Math.PI) / 180, dir = fwd.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a));
            const S = f.group.position.clone().addScaledVector(dir, 30).add(new T.Vector3(0, 1.2, 0));
            for (const { p, part } of pts) {
              const d = p.clone().sub(S), len = d.length(); d.divideScalar(len);
              ray.set(S, d); ray.far = len + 0.5;
              const first = ray.intersectObject(drawn, false)[0];
              if (!first || first.distance < len - 0.015) continue;
              ray.far = part === "arm" ? 80 : len + 0.06;
              const hit = ray.intersectObjects(f.hitMeshes, false)[0];
              const near = !!hit && hit.distance >= len - 0.06 && hit.distance <= len + 0.06;
              if (part === "arm") { armN++; if (near) armFit++; if (!hit) armLost++; continue; }
              n++;
              if (!hit) none++;
              else if (near) fit++;
            }
          }
          const pc = (x, y) => Math.round((x / Math.max(1, y)) * 1000) / 10;
          return { n, fit: pc(fit, n), none: pc(none, n), armN, armFit: pc(armFit, armN), armLost: pc(armLost, armN) };
        })()`,
      );
    check(
      "a shot at the soldier's drawn legs from any side, standing, walking, sprinting or crouched (VANGUARD, 30 m off all round) goes into a volume within 6 cm of where it aimed 55 in 100 times or more, and into none 25 in 100 or fewer",
      Object.values(legs).every((x) => x.n >= 250 && x.fit >= 55 && x.none <= 25),
      JSON.stringify(Object.fromEntries(Object.entries(legs).map(([k, x]) => [k, { n: x.n, fit: x.fit, none: x.none }])))
    );
    check(
      "and a shot at its drawn arms and hands goes into a volume within 6 cm of where it aimed 50 in 100 times or more, and into none at all 19 in 100 or fewer",
      Object.values(legs).every((x) => x.armN >= 250 && x.armFit >= 50 && x.armLost <= 19),
      JSON.stringify(Object.fromEntries(Object.entries(legs).map(([k, x]) => [k, { n: x.armN, fit: x.armFit, none: x.armLost }])))
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
  const lp = await open(browser, "?", BASE, `localStorage.setItem("range.welcomed", "1")`);
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
    await rp.goto(`${BASE}?norender&nointro`, { waitUntil: "domcontentloaded", timeout: 90000 });
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
  const q = "?net=local&norender";
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

/** the centre sector's name (the Neon City's): its places name it */
const CENTRE_NAME = neonSectorsCfg.game.sectors.find((s) => s.id === "c")!.name;

/**
 * The start screen and the hack pick before play (src/ui/start.ts; the owner, 2026-10-09: "the main screen should be
 * like MUCH more simple"): two ways in and More; either way in asks for the hacks for ten seconds, on your last picks
 * (DASH and HEAL for someone new), and goes in by itself when the time is up.
 */
async function startScreenTest(browser: Browser): Promise<void> {
  // (a player who has chosen a way in before: the returning one, Milestone 632; someone new is a page of its own below)
  const page = await open(browser, "?norender&home=on", BASE, `localStorage.setItem("range.startedOnce", "1")`);
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
  check("start: three ways in, the Tutorial, the Firing Range and the Battle Royale, and More", ways.join("|") === "Tutorial|Firing Range|Battle Royale|More", ways.join("|"));
  // (Milestone 632) a page whose player has been here before: no nudge to the tutorial
  check("start: someone who has been here before is not nudged to the tutorial", await ev<boolean>(page, `document.getElementById("startNudge").hidden && !document.getElementById("startTutorial").classList.contains("nudge")`));
  // (Milestone 635) the Tutorial and the Firing Range side by side, the Battle Royale under them in the middle, as wide as one
  const lay = await ev<Record<string, { l: number; r: number; t: number; b: number }>>(page, `(() => { const r = (id) => { const q = document.getElementById(id).getBoundingClientRect(); return { l: q.left, r: q.right, t: q.top, b: q.bottom }; }; return { tut: r("startTutorial"), range: r("startRange"), br: r("startBr"), ways: document.querySelector("#start .startWays").getBoundingClientRect() }; })()`);
  const mid = (q: { l: number; r: number }) => (q.l + q.r) / 2;
  check(
    "start: the Tutorial left of the Firing Range, level with it, and the Battle Royale under both, in the middle, as wide as one",
    lay.tut.r <= lay.range.l && Math.abs(lay.tut.t - lay.range.t) < 2 && lay.br.t >= Math.max(lay.tut.b, lay.range.b) && Math.abs(mid(lay.br) - (lay.tut.l + lay.range.r) / 2) < 4 && Math.abs(lay.br.r - lay.br.l - (lay.tut.r - lay.tut.l)) < 4,
    JSON.stringify(lay),
  );
  // the rain behind it, painted, blue and pink at half strength
  await page.waitForFunction(`(() => { const c = document.getElementById("startRain"); if (c.hidden || !c.width) return false; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 0) n++; return n > 20; })()`, { polling: 200, timeout: 15000 }).catch(() => undefined);
  const rain = await ev<{ shown: boolean; opacity: string; lit: number; blue: number; pink: number; base: number }>(page, `(() => { const c = document.getElementById("startRain"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let lit = 0, blue = 0, pink = 0, opaque = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 13) { n++; if (d[i + 3] > 250) opaque++; if (d[i + 3] < 60) continue; lit++; if (d[i + 2] > d[i] + 40) blue++; if (d[i] > d[i + 1] + 60 && d[i + 2] > d[i + 1]) pink++; } return { shown: !c.hidden, opacity: getComputedStyle(c).opacity, lit, blue, pink, base: +(opaque / n).toFixed(2) }; })()`);
  // the name across half to three fifths of the window, the ways' names and lines outlined in black (Milestone 639)
  const brand = await ev<{ share: number; outlined: boolean; label: number }>(page, `(() => { const b = document.querySelector(".startBrand").getBoundingClientRect(); const way = document.querySelector(".startWay"); const outlined = [way.querySelector("b"), way.querySelector("span")].every((e) => /rgb\\(0, 0, 0\\)/.test(getComputedStyle(e).textShadow)); return { share: +(b.width / innerWidth).toFixed(2), outlined, label: parseFloat(getComputedStyle(way.querySelector("small")).fontSize) }; })()`);
  check("start: the SPEEDKILLS name runs half to three fifths of the window across, each way's name and line outlined in black, its label a size up", brand.share >= 0.47 && brand.share <= 0.62 && brand.outlined && brand.label >= 19, JSON.stringify(brand));
  // (since Milestone 639 on a dark base, the whole at 0.75: the owner, "we see less of the background")
  check("start: the rain falls behind it, blue and pink on a dark base, the whole at its opacity (0.75), so little of the game shows through", rain.shown && Number(rain.opacity) === startCfg.rain.opacity && startCfg.rain.opacity >= 0.75 && rain.base > 0.95 && rain.blue > 5 && rain.pink > 5, JSON.stringify(rain));
  // the sign-in line: where settings are kept, and its links to the Settings and Account tabs
  const sign = await ev<string>(page, `document.getElementById("startSign").textContent`);
  check("start: it says where your settings are kept and what an account adds", /saved as long as you connect from the same browser/.test(sign) && /account will always keep your settings and allow for stat tracking/i.test(sign), sign);
  const tabShown = (tab: string) => `(() => ({ menu: !document.querySelector("#overlay .menu").hidden, tab: !document.querySelector('section[data-panel="${tab}"]').hidden, start: !document.getElementById("start").hidden, rain: !document.getElementById("startRain").hidden }))()`;
  await ev(page, `document.getElementById("startSettings").click()`);
  const toSettings = await ev<{ menu: boolean; tab: boolean; start: boolean; rain: boolean }>(page, tabShown("settings"));
  await ev(page, `document.getElementById("startBack").click()`);
  await ev(page, `document.getElementById("startAccount").click()`);
  const toAccount = await ev<{ menu: boolean; tab: boolean; start: boolean; rain: boolean; box?: boolean }>(page, `(() => ({ ...${tabShown("account")}, box: !!document.querySelector('section[data-panel="account"] #accountBox') }))()`);
  await ev(page, `document.getElementById("startBack").click()`);
  check(
    "start: its Settings link opens the menu on Settings and its account link on the Account tab (the account box there); the rain stops with the start screen",
    toSettings.menu && toSettings.tab && !toSettings.start && !toSettings.rain && toAccount.menu && toAccount.tab && !!toAccount.box,
    JSON.stringify({ toSettings, toAccount }),
  );
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
  // (Milestone 632) someone new: no profile and no way in ever chosen. The tutorial is pointed out; it goes straight
  // in, with no hack pick (Milestone 633: onto the tutorial's first room); and from then on the nudge is gone
  const fresh = await open(browser, "?norender&home=on", BASE, `if (!sessionStorage.getItem("e2e.fresh")) { sessionStorage.setItem("e2e.fresh", "1"); window.__keptProfile = localStorage.getItem("range.profile.v1"); window.__keptStarted = localStorage.getItem("range.startedOnce"); localStorage.removeItem("range.profile.v1"); localStorage.removeItem("range.startedOnce"); }`);
  const nudged = await ev<boolean>(fresh, `!document.getElementById("startNudge").hidden && document.getElementById("startTutorial").classList.contains("nudge")`);
  await ev(fresh, `document.getElementById("startTutorial").click()`);
  await sleep(800);
  const tut = await ev<{ pick: boolean; step: string | null; started: string | null; nudge: boolean }>(fresh, `({ pick: !document.getElementById("pick").hidden, step: window.__range.tutorial.stepTitle, started: localStorage.getItem("range.startedOnce"), nudge: !document.getElementById("startNudge").hidden })`);
  check("start: someone new is nudged to the tutorial, which goes straight in (no hack pick) to its first room, and the nudge is gone after", nudged && !tut.pick && tut.step === "MOVE" && tut.started === "1" && !tut.nudge, JSON.stringify({ nudged, tut }));
  await fresh.close();
  await ev(page, `localStorage.setItem("range.startedOnce", "1")`);
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
  // a bot's HEAL shows as a player's (Milestone 702): its area where it stands, which everyone sees and hears; it showed
  // nothing at all. The bot taken low, its HEAL ready
  const heal = await ev<{ before: number; after: number } | null>(
    page,
    `new Promise((ok) => { const r = window.__range; const d = r.duel(); const b = d?.bots[0]; if (!b) return ok(null);
      Object.defineProperty(b, "skHacks", { get: () => ["heal"], configurable: true }); const before = r.sk.state().healZones; b.dummy.health = 10; b.dummy.shield = 0; b.skHealAt = -Infinity;
      const t0 = performance.now(); const step = () => { const after = r.sk.state().healZones; if (after > before || performance.now() - t0 > 15000) return ok({ before, after }); setTimeout(step, 100); }; step(); })`,
  );
  check("bots: a bot's HEAL shows its area where it stands, as a player's does", !!heal && heal.after > heal.before, JSON.stringify(heal));
  await ev(page, "window.__range.duel()?.leave()");
  await ev(page, `(() => { const k = ${JSON.stringify(kept)}; if (k !== null) localStorage.setItem("range.bots.difficulty", k); })()`);
  await page.close();
}


/** E2E_ONLY=bots,brsolo runs only those sections (page, panel, duel, invite, triple, bots, pad, range, finish, throw, emote, speedkills, soldier, skpack (named only), skwall, sktutorial, skship, gulag, modes, hidden, brsolo, squad, sksquad, skfigure, sklobby, skhunt, skarmory, skfriends, start, skbots, p2p, mixed) */
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
  // (against the normal pace's own first wait, not a number: the quiet first minute, Milestone 577, made it 110 s and
  // this check read 95 s fast against the 45 it had been written for)
  const normalWait = decayRounds("normal")[0].wait;
  check("and the pace the panel was set to is the pace the ring runs at", ring.wait < normalWait - 1, `${ring.wait} s before the first close, against ${normalWait} at the normal pace`);
  await ev(page, "window.__range.toMenu()");

  await ev(page, `document.getElementById("goBots").click(); document.getElementById("playFriends").click()`);
  await sleep(600);
  const friends = await ev<{ tab: string; mode: string }>(page, `({ tab: window.__range.menu.tab, mode: document.getElementById("duelMode").value })`);
  check("With friends carries the mode across, which nobody should have to do by hand", friends.mode === "arena" && friends.tab === "duel", JSON.stringify(friends));
  await ev(page, `(() => { const b = document.getElementById("duelLeave"); if (b && !b.hidden) b.click(); })()`);
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
  await start("goRange");
  const armed = await ev<boolean>(page, `window.__range.player.extraMoves`);
  check("and on in the range too", armed);
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
    // an enemy's shield shell's shaders, a plain and a skinned figure's, built with the rest, not at the first round on a
    // shield (outline.ts ShieldShell.warmKit, Milestone 694)
    const shellWarm = await page.waitForFunction(`(() => { const R = window.__range; const k = R.scene.getObjectByName("shell-warm"); if (!k || k.children.length !== 2) return false; const pr = R.renderer.properties.get(k.children[0].material); return !!pr.programs && pr.programs.size >= 2; })()`, { polling: 500, timeout: 90000 }).then(() => true, () => false);
    check("the shield shell's two shaders, a plain and a skinned figure's, are built at load, before the first round on a shield", shellWarm);
    // the loading screen counts the models and textures in, and goes once they are and a frame is drawn
    // (90 s, not 30: the first page of a run compiles every module of the dev server's, and with the machine at 94% under
    // other runs the world was in 31 s on, every part of it, where a quiet machine takes 4; this is not a speed check)
    const inWorld = await page.waitForFunction("window.__range.loaded()", { polling: 200, timeout: 90000 }).then(() => true, () => false);
    // the range a street of the Neon City (Milestone 691): its own small file, drawn over the plain look, which it hides
    const streetIn = await page.waitForFunction("window.__range.rangeDress().drawn || window.__range.rangeDress().failed", { polling: 250, timeout: 90000 }).then(() => true, () => false);
    const street = await ev<{ drawn: boolean; meshes: number; plainShown: boolean; file: string }>(page, "window.__range.rangeDress()");
    check("the range is a street of the Neon City from a file of its own, laid over the plain look, which is hidden", streetIn && street.drawn && street.meshes >= 1 && !street.plainShown && /range-v\d+\.glb/.test(street.file), JSON.stringify(street));
    await sleep(500);
    const ls = await ev<{ hidden: boolean; status: string; fill: string }>(page, `(() => { const e = document.getElementById("loading"); return { hidden: e.hidden, status: document.getElementById("loadingStatus").textContent, fill: document.getElementById("loadingFill").style.width }; })()`);
    // (SpeedKills' screen goes as soon as the range is drawn, the last few files still on their way: the first screen
    // sooner, Milestones 452 to 469, so its bar need not reach the end)
    // (and when the world is not in, which of loaded()'s parts it is still waiting on)
    const parts = inWorld ? null : await ev<Record<string, boolean>>(page, "window.__range.loadedParts()");
    check("the loading screen counts the world in and goes once it is", inWorld && ls.hidden && /\d+ OF \d+/.test(ls.status), JSON.stringify({ ...ls, parts }));
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
    // Render scale (Settings, Milestone 626): at once, the 3D view's pixel ratio its share of what it was and its canvas
    // that many fewer pixels, kept for the next visit, and back at 100% the same as before
    const scaled = await ev<{ was: number; half: number; px: [number, number]; kept: string | null; back: number }>(
      page,
      `(() => { const R = window.__range.renderer; const s = document.getElementById("renderScale"); const was = R.getPixelRatio(); const w0 = R.domElement.width; s.value = "0.5"; s.dispatchEvent(new Event("change")); const half = R.getPixelRatio(); const px = [w0, R.domElement.width]; const kept = localStorage.getItem("range.renderScale"); s.value = "1"; s.dispatchEvent(new Event("change")); return { was, half, px, kept, back: R.getPixelRatio() }; })()`,
    );
    check("render scale: 50% halves the 3D view's pixel ratio and its canvas at once, is kept, and 100% puts it back", Math.abs(scaled.half - scaled.was / 2) < 1e-9 && Math.abs(scaled.px[1] - scaled.px[0] / 2) <= 1 && scaled.kept === "0.5" && scaled.back === scaled.was, JSON.stringify(scaled));
    check("no page errors on load", errors.length === 0, errors.slice(0, 3).join(" | "));
    // smaller downloads (tools/compress-assets.ts): the surfaces' maps come as WebP, and none is missing (19 of them since
    // the props and their maps went, Milestone 663; there were 20 and more)
    const webp = await ev<{ webp: number; jpg: number; bad: string[] }>(page, `(() => { const r = performance.getEntriesByType("resource"); const tex = r.filter((x) => x.name.includes("/tex/") || x.name.includes("/models/")); return { webp: tex.filter((x) => x.name.endsWith(".webp")).length, jpg: tex.filter((x) => x.name.endsWith(".jpg")).length, bad: tex.filter((x) => x.responseStatus >= 400).map((x) => x.name.split("/").slice(-2).join("/")) }; })()`);
    check("textures: the range's maps load as WebP, none missing", webp.webp >= 15 && webp.jpg === 0 && webp.bad.length === 0, JSON.stringify(webp));
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
        // (on the Account tab since Milestone 635)
        document.querySelector('#tabs button[data-tab="account"]').click();
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
    // the voice chat's slider is its own (Milestone 711): it had the callouts' slider's id, so the callouts' set both and
    // it did nothing. Moved, it sets the voice chat's volume and leaves the callouts' where they were.
    const vols = await ev<{ chat: string | null; voiceBefore: number; voiceAfter: number }>(
      page,
      `(() => { const R = window.__range; const voiceBefore = R.audio.volumes.voice; const el = document.getElementById("volChat"); if (!el) return { chat: null, voiceBefore, voiceAfter: voiceBefore };
        const was = el.value; el.value = "23"; el.dispatchEvent(new Event("input")); const chat = localStorage.getItem("range.voiceVolume"); const voiceAfter = R.audio.volumes.voice;
        el.value = was; el.dispatchEvent(new Event("input")); return { chat, voiceBefore, voiceAfter }; })()`,
    );
    check("settings: the voice chat slider sets the voice chat's volume, not the callouts'", vols.chat === "0.23" && vols.voiceAfter === vols.voiceBefore, JSON.stringify(vols));
    const inGame = await ev<number>(page, `(() => { document.getElementById("overlay").classList.add("hidden"); window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape", bubbles: true, cancelable: true })); document.getElementById("overlay").classList.remove("hidden"); return window.__range.menuEscapes(); })()`);
    check("Esc with the menu closed is not a resume", inGame === escOnMenu, `${inGame} taken as Resume, ${escOnMenu} before`);

    console.log("\nThe course");
    // in the game, not on the menu: the menu stops a run's clock
    await pressPlay(page);
    await ev(page, `document.getElementById("overlay").classList.add("hidden")`);
    // slot 1's optic, its own: the course lends pistols and must give it back
    const fitted = await ev<string | null>(page, `(() => { const l = window.__range.loadout; return l.slots[0].attach.optic ?? null; })()`);
    const X = -21.5;
    // (since Milestone 636 out and back: the points through every room are the course's own, courses/basic.ts RUN_ROUTE)
    const steps = await ev<Array<[number, number, number]>>(page, "window.__range.runRoute");
    const roomCount = await ev<number>(page, "window.__range.course.layout.rooms.length");
    const frames3 = "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))))";
    // the finish by the start counts only once every room is entered: over the start line, in at the last door from the
    // start area and back over the finish, and no result
    {
      const [sx, , sz] = steps[0];
      const [fx, , fz] = steps[steps.length - 1];
      for (const [x, z] of [[sx, sz], [sx, steps[1][2]], [fx, 18], [fx, fz + 2.5], [fx, fz]]) {
        await ev(page, `(() => { const p = window.__range.player; p.pos.set(${x}, 0, ${z}); p.vel.set(0, 0, 0); p.yaw = 0; })()`);
        await ev(page, frames3);
      }
      const short = await ev<{ result: boolean; running: boolean }>(page, "({ result: window.__range.course.result !== null, running: window.__range.course.running })");
      check("the finish counts only after every room: in from the start area at the last door and over the line, no result", !short.result && short.running, JSON.stringify(short));
      // (leave, not reset: a result left over would pass the run below without it finishing)
      await ev(page, `window.__range.course.leave()`);
    }
    for (const [x, y, z] of steps) {
      await ev(page, `(() => { const p = window.__range.player; p.pos.set(${x}, ${y}, ${z}); p.vel.set(0, 0, 0); p.yaw = 180; })()`);
      // wait for at least three frames at this spot
      await ev(page, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))))");
    }
    const res = await ev<{ splits: Array<{ name: string; time: number }>; time: number } | null>(page, "window.__range.course.result");
    check("a run through every room finishes with a result", res !== null, res ? `${res.time.toFixed(2)} s` : "no result");
    if (res) {
      const skipped = res.splits.filter((s) => !Number.isFinite(s.time)).map((s) => s.name);
      check("with a split for every room and the finish", res.splits.length === roomCount + 1 && roomCount === 9 && skipped.length === 0, skipped.length ? `skipped ${skipped.join(",")}` : `${res.splits.length} splits`);
      const medals = (res.splits as Array<{ name: string; par?: number; medal?: string | null }>).slice(0, roomCount);
      check("medals: every room has a par, and a run this quick takes gold in each", medals.every((s) => (s.par ?? 0) > 1 && s.medal === "gold"), JSON.stringify(medals.map((s) => `${s.name}:${s.medal}/${s.par}`)));
      // 1.5 s of game time after the finish you are put back near the start, facing the results TV (60 s to wait: the
      // drawn page makes about one frame a second in software at the finish, its game time a tenth of a second a frame)
      const back = await page
        .waitForFunction(`Math.abs(window.__range.player.pos.x - (${X} + 7)) < 0.3 && Math.abs(window.__range.player.pos.z - 11.4) < 0.3`, { polling: 200, timeout: 60000 })
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
    // (and your figure whole there, none of it thinned: it thins only as a wall brings the camera in, tpcam.ts)
    const tp = await ev<{ dist: number; fig: boolean; vm: boolean; drawn: number | null }>(page, `(() => { const p = window.__range.player; const c = window.__range.camera; const e = p.eyePosition(); return { dist: Math.hypot(c.position.x - e.x, c.position.y - e.y, c.position.z - e.z), fig: window.__range.selfFigureVisible(), vm: window.__range.viewModelVisible(), drawn: window.__range.selfFigure()?.figure?.faded ?? null }; })()`);
    check("third person: the camera sits behind the shoulder, your figure shows whole, the gun in hand does not", tp.dist > 1.8 && tp.dist < 3 && tp.fig && tp.drawn === 1 && !tp.vm, JSON.stringify(tp));
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
    check("your own arms in first person are the soldier's, not drawn gloves", real);
    // the clips a figure plays now and then load after the figures do (tools/fetch-clips.ts), and they arrive
    const extras = ["Slide_Start", "Slide_Exit", "OverhandThrow", "Melee_Hook", "Punch_Cross", "Hit_Head", "NinjaJump_Idle_Loop", "Interact", "Dance_Loop", "Yes", "Idle_FoldArms_Loop"];
    const clipsIn = await ev<string[]>(page, `new Promise((ok) => { const want = ${JSON.stringify(extras)}; const t0 = performance.now(); const w = () => { const miss = want.filter((c) => !window.__range.hasClip(c)); if (!miss.length || performance.now() - t0 > 10000) ok(miss); else setTimeout(w, 100); }; w(); })`);
    check("the extra clips (a slide's way in and out, a throw, three swings, a reach, emotes) load after the figures", clipsIn.length === 0, clipsIn.length ? `missing ${clipsIn.join(", ")}` : `${extras.length} clips`);
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
    const at = await ev<{ x: number; z: number; yaw: number; sx: number; sz: number }>(page, `({ x: window.__range.player.pos.x, z: window.__range.player.pos.z, yaw: window.__range.player.yaw, sx: window.__range.course.startPose.x, sz: window.__range.course.startPose.z })`);
    check("The Run button: at the course start facing the start line", Math.abs(at.x - at.sx) < 0.5 && Math.abs(at.z - at.sz) < 0.5 && at.sz < 12 && at.yaw === 180, JSON.stringify(at));
    await ev(page, `document.getElementById("goTutorial").click(); document.getElementById("startMode").click()`);
    const tut = await ev<{ x: number; z: number; yaw: number; step: string | null }>(page, `({ x: window.__range.player.pos.x, z: window.__range.player.pos.z, yaw: window.__range.player.yaw, step: window.__range.tutorial.stepTitle })`);
    check("The Tutorial button: in the tutorial's start room, facing in, on its first room", Math.abs(tut.x - 21) < 0.5 && Math.abs(tut.z - 12) < 0.5 && tut.yaw === 180 && tut.step === "MOVE", JSON.stringify(tut));
    // put the first default back for the 1v1 pages (SpeedKills' defaults have their own names)
    await ev(page, `document.querySelector("#loadoutList button").click()`);
    await page.close();
    }

    if (want("duel")) await section("duel", async () => {
      console.log("\n1v1 over the local transport (two tabs)");
      await duelTest(browser, "?net=local&norender", "local");
      console.log("\nA friend's figure over a jittery connection");
      await jitterTest(browser, "?net=local&norender&jitter=60");
      console.log("\nA friend's figure with state packets lost and out of order");
      await jitterTest(browser, "?net=local&norender&jitter=60&loss=0.15", true);
      console.log("\nCustom rules");
      await rulesTest(browser, "?net=local&norender");
      console.log("\nA 1v1 on the Neon City before the host's collision boxes are in");
      await lateBoxesTest(browser);
      console.log("\nThe site's broker asked for slowly");
      await brokerWaitTest(browser);
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
      await botsTest(browser, "?norender");
      console.log("\nBot tiers");
      await botTiersTest(browser, "?norender");
      console.log("\nWhere you are being shot from");
      await damageDirTest(browser, "?norender");
    });

    if (want("pad")) await section("pad", async () => {
      console.log("\nController");
      await padTest(browser, "?norender");
    });

    if (want("panel")) await section("panel", async () => {
      console.log("\nThe lobby");
      await lobbyPanelTest(browser);
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
      await rangeTest(browser, "?norender");
    });




    if (want("gulag")) await section("gulag", async () => {
      console.log("\nThe Gulag: in, the fight, the way back, one trip, overtime, a squad mate");
      await gulagTest(browser, "?norender", "?net=local&norender");
    });

    if (want("finish")) await section("finish", async () => {
      console.log("\nThe finishing touches: toggles, per-optic ADS, the controller, inspect, the first draw");
      await finishTest(browser, "?norender");
    });

    if (want("modes")) await section("modes", async () => {
      console.log("\nThe arena's modes: team deathmatch, free-for-all, Control (alone, against bots)");
      await modesTest(browser, "?norender");
      console.log("\nThe arenas: NEON YARD, NEON HALL and THE CENTRE");
      await arenaMapsTest(browser, "?norender");
      console.log("\nA free-for-all with a friend (two tabs, the local transport)");
      await modesFriendsTest(browser, "?net=local&norender");
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
      await cityMissingTest(browser);
    });
    // (the city's file missing, alone, named only)
    if (ONLY.includes("skcity")) {
      console.log("\nSpeedKills: the city's file missing, alone");
      await cityMissingTest(browser);
    }
    // (the slam alone, named only: a rerun of the one check that failed, as a flaky one is rerun)
    if (ONLY.includes("skslam")) {
      console.log("\nSpeedKills: the slam, alone");
      await speedkillsSlamTest(browser);
    }
    // (the battle royale's part alone, named only: a rerun of one of its checks, the decay's among them, without the
    // menus and guns before it)
    if (ONLY.includes("skbr")) {
      console.log("\nSpeedKills: the battle royale, alone");
      await speedkillsBrTest(browser);
    }

    // (the bought arms' frames alone, named only: the soldier section's longest part without the rest of it, on a page of
    // its own, for a change to a gun's hold; E2E_GUNS narrows it to those guns)
    if (ONLY.includes("skpack")) await section("skpack", async () => {
      console.log(`\nSpeedKills' bought arms: their frames alone${E2E_GUNS.length ? ` (${E2E_GUNS.join(", ")})` : ""}`);
      const page = await open(browser, "?");
      // (the arms too: a checkout with the paid guns but not the arms, public/models/paid/arms, had gone on into the frames
      // and stopped on a rig that never loaded, a TypeError, 2026-10-09)
      const ready = await page.waitForFunction("window.__range.loaded() && window.__range.paidGuns().ready && window.__range.soldierReady() && window.__range.packRig().ready", { polling: 250, timeout: 180000 }).then(() => true, () => false);
      check("skpack: the bought guns and arms load (public/models/paid/arms)", ready);
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
      await neckSeamTest(browser);
      console.log("\nThe soldier on a wall and in the skydive, as others see it (Milestone 604)");
      await figureStancesTest(browser);
    });

    if (want("sksquad")) await section("sksquad", async () => {
      console.log("\nThe squad you can see: a friend's number, colour, name, ring and every change of state (Phase 27)");
      await skSquadTest(browser);
    });

    if (want("skship")) await section("skship", async () => {
      console.log("\nSpeedKills' dropship, ridden: off the city, doors after five seconds, a landing in the city");
      await speedkillsShipTest(browser);
    });

    if (want("skwall")) await section("skwall", async () => {
      console.log("\nThe wall run's feel: the view leans off the wall, and levels again");
      await wallFeelTest(browser);
    });

    if (want("sktutorial")) await section("sktutorial", async () => {
      console.log("\nThe tutorial: its rooms, doors, pits, the hacks' and the gun's locks, DASH, the ANAKIN, the soldiers, the way out");
      await skTutorialTest(browser);
    });

    if (want("botsquads")) await section("botsquads", async () => {
      console.log("\nBot squads: a trio of bots keeps together");
      await botSquadsTest(browser, "?norender");
    });

    if (want("brsolo")) await section("brsolo", async () => {
      console.log("\nSolo with a friend: everyone against everyone, each placed on their own");
      await brSoloTest(browser, "?net=local&norender");
      console.log("\nSquads of friends: two duos against each other");
      await brSquadsTest(browser, "?net=local&norender");
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
      await brMigrateTest(browser, "?net=local&norender");
    });

    if (want("squad")) await section("squad", async () => {
      console.log("\nBattle royale as a squad (two tabs, the local transport)");
      await brSquadTest(browser, "?net=local&norender");
    });

    if (want("p2p")) await section("p2p", async () => {
      console.log("\n1v1 over peer to peer (the public broker)");
      const ran = await duelTest(browser, "?norender", "p2p");
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
        await skGroupTest(browser, "?norender");
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
        // (a build from before Milestone 533 plays three in the Triangle, this one on THE CENTRE: these two want an OLD_URL from it on)
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
