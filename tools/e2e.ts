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
import puppeteer, { type Browser, type Page } from "puppeteer";

const BASE = process.env.SHOT_URL ?? "http://localhost:5173/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

let fails = 0;
const errors: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function open(browser: Browser, query: string): Promise<Page> {
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 450, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => errors.push(`pageerror: ${String((e as Error).message ?? e)}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  await page.goto(BASE + query, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 60000 });
  return page;
}

/** evaluate an expression string in the page (tsx mangles function sources) */
const ev = <T>(page: Page, expr: string) => page.evaluate(expr) as Promise<T>;

/**
 * "Click Play" without a pointer lock (a scripted page cannot take one): a
 * fake gamepad's Start, which is the controller's way in. Round 1 waits for
 * every player to be in the game, so every page in a match does this.
 */
async function pressPlay(page: Page): Promise<void> {
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

async function duelTest(browser: Browser, query: string, label: string): Promise<boolean> {
  const host = await open(browser, query);
  const guest = await open(browser, query);
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

  // each sees the other at the other's spawn
  await sleep(1500);
  const seen = await ev<{ x: number; z: number; visible: boolean }>(
    host,
    `(() => { const g = window.__range.duel().avatars[0].group; return { x: g.position.x, z: g.position.z, visible: g.visible }; })()`
  );
  check(`${label}: the host sees the guest at the guest spawn (arena, far end)`, seen.visible && Math.abs(seen.x - 90) < 0.5 && Math.abs(seen.z + 11) < 0.5, `${seen.x.toFixed(1)}, ${seen.z.toFixed(1)}`);
  const seen2 = await ev<{ x: number; z: number }>(guest, `(() => { const g = window.__range.duel().avatars[0].group; return { x: g.position.x, z: g.position.z }; })()`);
  check(`${label}: and the guest sees the host at the host spawn`, Math.abs(seen2.x - 90) < 0.5 && Math.abs(seen2.z + 69) < 0.5, `${seen2.x.toFixed(1)}, ${seen2.z.toFixed(1)}`);

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
  check(`${label}: the kill feed says who knocked whom, on both screens`, feedH.some((t) => /knocked/.test(t)) && feedG.some((t) => /knocked/.test(t)), `host: ${feedH[0] ?? "-"} | guest: ${feedG[0] ?? "-"}`);
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

  // leaving tells the other side
  await ev(guest, "window.__range.duel().leave()");
  await host.waitForFunction("window.__range.duel() === null", { polling: 200, timeout: 15000 });
  check(`${label}: leaving ends the match on the other side`, true);
  await host.close();
  await guest.close();
  return true;
}

/** three tabs: the host makes a 3-player match, two guests join, the host knocks both */
async function tripleTest(browser: Browser, query: string): Promise<void> {
  const host = await open(browser, query);
  const g1 = await open(browser, query);
  const g2 = await open(browser, query);
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
    check("1v1v1: the host gets a code", false, await ev<string>(host, `document.getElementById("duelStatus").textContent`));
    await closeAll();
    return;
  }
  await ev(g1, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
  await host.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  const waiting = await ev<string>(host, "window.__range.duel().phase");
  check("1v1v1: with one guest in, the host waits for the second", waiting === "waiting", waiting);
  await ev(g2, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
  try {
    for (const p of pages) await p.waitForFunction("window.__range.duel() !== null && window.__range.duel().players === 3", { polling: 200, timeout: 30000 });
  } catch {
    check("1v1v1: all three connect", false, await ev<string>(g2, `document.getElementById("duelStatus").textContent`));
    await closeAll();
    return;
  }
  check("1v1v1: all three connect", true);
  const ids = await Promise.all(pages.map((p) => ev<number>(p, "window.__range.duel().id")));
  check("1v1v1: ids 0, 1, 2", ids.join(",") === "0,1,2", ids.join(","));
  await sleep(1500);
  const seen = await ev<number>(host, "window.__range.duel().avatars.filter((a) => a.group.visible).length");
  check("1v1v1: the host sees two figures", seen === 2, `${seen}`);
  const seenByGuest = await ev<number>(g2, "window.__range.duel().avatars.filter((a) => a.group.visible).length");
  check("1v1v1: a guest sees the other two (one relayed by the host)", seenByGuest === 2, `${seenByGuest}`);
  const spawns = await Promise.all(pages.map((p) => ev<{ x: number; z: number }>(p, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })")));
  const distinct = new Set(spawns.map((sp) => `${sp.x.toFixed(0)},${sp.z.toFixed(0)}`)).size;
  check("1v1v1: three different corners of the triangle", distinct === 3 && spawns.every((sp) => Math.hypot(sp.x - 90, sp.z - 60) > 15), JSON.stringify(spawns.map((sp) => [+sp.x.toFixed(1), +sp.z.toFixed(1)])));
  for (const p of pages) await pressPlay(p);
  for (const p of pages) await p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 15000 });
  check("1v1v1: the countdown ends on all three", true);
  // the host knocks guest 1: the round goes on (two standing)
  await ev(host, `(() => { const d = window.__range.duel(); const r = [...d.remotes.values()].find((x) => x.id === 1); d.localHit(r, 200, true); })()`);
  await g1.waitForFunction("window.__range.duel().alive === false", { polling: 200, timeout: 10000 });
  await sleep(600);
  const still = await ev<string>(host, "window.__range.duel().phase");
  check("1v1v1: one down, two standing: the round goes on", still === "fight", still);
  const g2sees = await ev<boolean>(g2, `(() => { const d = window.__range.duel(); const r = [...d.remotes.values()].find((x) => x.id === 1); return r ? !r.alive : false; })()`);
  check("1v1v1: the other guest sees player 2 down (relayed)", g2sees);
  // then guest 2: last standing, the host takes the round on every screen
  await ev(host, `(() => { const d = window.__range.duel(); const r = [...d.remotes.values()].find((x) => x.id === 2); d.localHit(r, 200, true); })()`);
  const scored = await Promise.all(pages.map((p) => p.waitForFunction(`window.__range.duel().hud().players.find((x) => x.name === window.__range.duel().hud().players[0].name) && window.__range.duel().hud().players.reduce((a, x) => a + x.score, 0) === 1`, { polling: 200, timeout: 10000 }).then(() => true, () => false)));
  check("1v1v1: last one standing, the host takes the round on all three screens", scored.every(Boolean), scored.join(","));
  const hostYou = await ev<number>(host, "window.__range.duel().hud().you");
  check("1v1v1: and it is the host's point", hostYou === 1, `${hostYou}`);
  // a guest leaves: the match carries on as a 1v1 for the other two
  await ev(g1, "window.__range.duel().leave()");
  await host.waitForFunction("window.__range.duel() !== null && window.__range.duel().avatars.length === 1", { polling: 200, timeout: 10000 }).then(() => true, () => false);
  const left = await ev<number>(host, "window.__range.duel() ? window.__range.duel().avatars.length : -1");
  check("1v1v1: a guest leaving drops to a 1v1 for the other two", left === 1, `${left} figures left on the host`);
  await ev(host, "window.__range.duel().leave()");
  await g2.waitForFunction("window.__range.duel() === null", { polling: 200, timeout: 10000 });
  check("1v1v1: the host leaving ends it for the rest", true);
  await closeAll();
}

/** one page against a bot: it comes for you, shoots, and can be knocked */
async function botsTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  await ev(page, `document.getElementById("overlay").classList.add("hidden")`);
  await ev(page, `(() => { document.getElementById("botCount").value = "1"; document.getElementById("botDifficulty").value = "hard"; window.__range.startBots(); })()`);
  const d0 = await ev<{ kind: string; players: number; n: number } | null>(page, "window.__range.duel() ? { kind: window.__range.duel().kind, players: window.__range.duel().players, n: window.__range.duel().avatars.length } : null");
  check("bots: a bot match starts with one bot", d0 !== null && d0.kind === "bots" && d0.players === 2 && d0.n === 1, JSON.stringify(d0));
  await page.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 15000 });
  // the bot hunts you down the middle lane and shoots: the shield drops
  const shot = await page.waitForFunction("window.__range.duel().shield < 75", { polling: 250, timeout: 25000 }).then(() => true, () => false);
  const pos = await ev<{ x: number; z: number; sh: number }>(page, "(() => { const b = window.__range.duel().avatars[0].group.position; return { x: b.x, z: b.z, sh: window.__range.duel().shield }; })()");
  check("bots: the bot closes in and lands a shot", shot, `bot at ${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}, your shield ${pos.sh}`);
  check("bots: it moved off its spawn toward you", pos.z < -12, `z ${pos.z.toFixed(1)}`);
  // knock it: a hit through its dummy, then the match is told
  await ev(page, `(() => { const d = window.__range.duel(); const a = d.avatars[0]; const pt = { clone() { return this; } }; a.hit(0, "body", 500, 1, 1, pt); d.localHit(d.remoteOf(a), 500, false); })()`);
  const won = await page.waitForFunction("window.__range.duel().hud().you === 1", { polling: 200, timeout: 5000 }).then(() => true, () => false);
  check("bots: knocking the bot takes the round", won);
  const bfeed = await ev<string[]>(page, "window.__range.hud.feedText");
  check("bots: the kill feed has the knock", bfeed.some((t) => /knocked BOT/.test(t)), bfeed[0] ?? "-");
  await ev(page, "window.__range.duel().leave()");
  const gone = await ev<boolean>(page, "window.__range.duel() === null");
  check("bots: leaving ends the match", gone);
  await page.close();
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
  await page.close();
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
    ],
  });
  try {
    console.log("\nThe page");
    const page = await open(browser, "");
    await sleep(2500);
    const t0 = await ev<number>(page, "performance.now()");
    const f = await ev<{ merged: { meshes: number; after: number } | null; calls: number }>(page, "({ merged: window.__range.merged, calls: window.__range.drawCalls() })");
    check("loads with the static merge done", f.merged !== null && f.merged.after < f.merged.meshes, f.merged ? `${f.merged.meshes} -> ${f.merged.after} meshes` : "none");
    check("frames are drawing", f.calls > 0, `${f.calls} draw calls`);
    check("no page errors on load", errors.length === 0, errors.slice(0, 3).join(" | "));
    void t0;

    console.log("\nThe first visit");
    check("a first visit shows the welcome", await ev<boolean>(page, `!document.getElementById("welcome").hidden`));
    check("the menu button says Play before anything has started", (await ev<string>(page, `document.getElementById("play").textContent`)) === "Play");
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
    await ev(page, `(() => { const p = window.__range.player; p.pos.set(${X}, 0, 11); p.vel.set(0, 0, 0); p.yaw = 180; })()`);
    await ev(page, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
    await ev(page, `(() => { const p = window.__range.player; p.pos.set(${X}, 0, 13.5); p.vel.set(0, 0, 0); })()`);
    await page.waitForFunction("window.__range.course.running", { polling: 50, timeout: 5000 }).catch(() => undefined);
    await pressPlay(page); // Start again: back to the menu
    const clock = () => ev<number>(page, "window.__range.courseClock()");
    const c0 = await clock();
    await sleep(1500);
    const c1 = await clock();
    check("the menu stops a run's clock", c0 > 0 && Math.abs(c1 - c0) < 0.05, `${c0.toFixed(2)} s -> ${c1.toFixed(2)} s over 1.5 s on the menu`);
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
    await rebind("Jump", "KeyX");
    check("a key can be rebound", (await keysOf("Jump"))[0] === "X", (await keysOf("Jump")).join(","));
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
    check("choosing a loadout puts its weapons in the slots", w[0] === "r97" && w[1] === "mastiff", w.join(","));
    const locked = await ev<boolean>(page, `document.getElementById("slot0").disabled`);
    check("a default loadout cannot be edited", locked);
    // copy it into custom slot 2, rename it, change slot 1
    await ev(page, `(() => { document.getElementById("copyTarget").value = "1"; document.getElementById("copyLoadout").click(); })()`);
    await ev(page, `(() => { const n = document.getElementById("loadoutName"); n.value = "Test Kit"; n.dispatchEvent(new Event("change")); const s = document.getElementById("slot0"); s.value = "wingman"; s.dispatchEvent(new Event("change")); })()`);
    const w2 = await ev<string[]>(page, "window.__range.loadout.slots.map((s) => s.weapon.id)");
    check("an edited custom loadout applies at once", w2[0] === "wingman", w2.join(","));
    // reload: the choice and the edit are remembered
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 60000 });
    const after = await ev<{ name: string; slot1: string; w: string }>(page, `({ name: window.__range.loadouts.current.name, slot1: window.__range.loadouts.current.slot1, w: window.__range.loadout.slots[0].weapon.id })`);
    check("after a reload the loadout and its edit are remembered", after.name === "Test Kit" && after.slot1 === "wingman" && after.w === "wingman", JSON.stringify(after));
    // the menu's The Run button puts you at the course start, facing the line
    await ev(page, `document.getElementById("goRun").click()`);
    const at = await ev<{ x: number; z: number; yaw: number }>(page, `({ x: window.__range.player.pos.x, z: window.__range.player.pos.z, yaw: window.__range.player.yaw })`);
    check("The Run button: at the course start facing the start line", Math.abs(at.x + 21.5) < 0.5 && Math.abs(at.z - 10.2) < 0.5 && at.yaw === 180, JSON.stringify(at));
    await ev(page, `document.getElementById("goRunAdvanced").click()`);
    const adv = await ev<{ x: number; z: number; yaw: number }>(page, `({ x: window.__range.player.pos.x, z: window.__range.player.pos.z, yaw: window.__range.player.yaw })`);
    check("The Run (Advanced) button: at the advanced course start", Math.abs(adv.x - 21.5) < 0.5 && Math.abs(adv.z - 10.2) < 0.5 && adv.yaw === 180, JSON.stringify(adv));
    await ev(page, `document.getElementById("goArena").click()`);
    const ar = await ev<{ x: number; z: number }>(page, `({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })`);
    check("Arena alone: at the arena's first spawn", Math.abs(ar.x - 90) < 0.5 && Math.abs(ar.z + 69) < 0.5, JSON.stringify(ar));
    // put the default back for the 1v1 pages
    await ev(page, `[...document.querySelectorAll("#loadoutList button")].find((b) => b.textContent.startsWith("Assault")).click()`);
    await page.close();

    console.log("\n1v1 over the local transport (two tabs)");
    await duelTest(browser, "?net=local&norender", "local");

    console.log("\nInvite links");
    await inviteTest(browser, "?net=local&norender");

    console.log("\n1v1v1 over the local transport (three tabs)");
    await tripleTest(browser, "?net=local&norender");

    console.log("\nArena, Bots");
    await botsTest(browser, "?norender");

    console.log("\nController");
    await padTest(browser, "?norender");

    console.log("\n1v1 over peer to peer (the public broker)");
    const ran = await duelTest(browser, "?norender", "p2p");
    if (!ran) console.log("  --  skipped: the broker or the internet was not reachable");

    check("no page errors anywhere", errors.length === 0, [...new Set(errors)].slice(0, 5).join(" | "));
  } finally {
    await browser.close();
  }
  console.log(fails === 0 ? "\nE2E PASS" : `\nE2E FAIL (${fails})`);
  process.exit(fails === 0 ? 0 : 1);
}

void main();
