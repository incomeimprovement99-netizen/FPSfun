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
import { HOLD } from "../src/game/hold";
import puppeteer, { type Browser, type Page } from "puppeteer";
import modesCfg from "../src/config/modes.json";
import brCfg from "../src/config/br.json";
import ringCfg from "../src/config/ring.json";
import ammoCfg from "../src/config/ammo.json";
import lootCfg from "../src/config/loot.json";

/** the arena modes' spawns (arena coordinates) */
const MODE_SPAWNS = [...modesCfg.spawns.a, ...modesCfg.spawns.b, ...modesCfg.spawns.mid];

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
  page.on("pageerror", (e) => errors.push(`pageerror: ${String((e as Error).message ?? e)}`));
  page.on("dialog", (d) => void d.accept());
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
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
  if (init) await page.evaluateOnNewDocument(init);
  // a base with a query of its own (OLD_URL=https://the.site/?broker=public) keeps it
  const q = query.includes("intro=on") ? query : query.startsWith("?") ? `${query}&nointro` : "?nointro";
  const url = base.includes("?") ? `${base}&${q.slice(1)}` : base + q;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 60000 });
  return page;
}

/** evaluate an expression string in the page (tsx mangles function sources) */
const ev = <T>(page: Page, expr: string) => page.evaluate(expr) as Promise<T>;

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
const brRow = (team: "solo" | "duo" | "trio", bots: number): string =>
  `(() => { const t = document.getElementById("brTeam"); t.value = "${team}"; t.dispatchEvent(new Event("change")); const b = document.getElementById("brBots"); b.value = "${bots}"; b.dispatchEvent(new Event("change")); const r = document.getElementById("brRules"); if (r) { r.value = "br"; r.dispatchEvent(new Event("change")); } })()`;

/**
 * Doors: a shut door stops you, E opens the one you look at and you walk
 * through, and a bot that walks into a shut door opens it.
 */
/**
 * The vault (br.json vault): the Well's small building, sealed, its door
 * locked. Its guard stands at its post on no side and is not counted among
 * those left; the vault is stocked with two supply bins and a mythic gun as
 * the fight starts; the door will not open without the keycard, which is in
 * the guard's death box; its holder is shown the way and opens the door,
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
  const stock = await ev<{ mythic: string[]; bins: number }>(
    page,
    "(() => { const d = window.__range.duel(); const v = d.vault; const near = [...d.lootField.drops.values()].filter((x) => Math.hypot(x.pos.x - v.x, x.pos.z - v.z) < 4.5); return { mythic: near.filter((x) => x.item.kind === 'weapon' && x.item.mythic).map((x) => x.item.id + ':' + x.item.mag), bins: near.filter((x) => x.item.kind === 'bin' && x.item.id === 'closed').length }; })()"
  );
  check("vault: stocked as the fight starts: a mythic gun at gold mag and two supply bins inside", stock.mythic.length === 1 && stock.mythic[0].endsWith(":4") && stock.bins === 2, JSON.stringify(stock));
  // at the door without the card: it says so, and the door stays shut
  await ev(page, "(() => { const d = window.__range.duel(); const door = window.__range.brMap.doors.list[d.vault.door]; window.__range.player.teleport(door.centre.x, door.centre.y - 1.3, door.centre.z - 2.2, 180, 0); })()");
  await sleep(500);
  const lockedPrompt = await ev<string>(page, "window.__range.brPlay.hud?.prompt?.text ?? ''");
  await ev(page, `window.__range.setScript({ held: () => false, pressedNow: (a) => a === "interact" })`);
  await sleep(300);
  await ev(page, "window.__range.setScript(null)");
  await ev(page, "(() => { const d = window.__range.duel(); d.useDoor(d.vault.door, true); })()");
  await sleep(300);
  const shut = await ev<{ open: boolean; locked: boolean; kicked: string | null }>(page, "(() => { const d = window.__range.duel(); const ds = window.__range.brMap.doors; return { open: ds.list[d.vault.door].open, locked: d.vault.locked, kicked: ds.kick(d.vault.door) }; })()");
  check("vault: without the keycard the door says so, stays shut to interact and cannot be kicked in", /LOCKED/.test(lockedPrompt) && !shut.open && shut.locked && shut.kicked === null, JSON.stringify({ lockedPrompt, shut }));
  // the guard down: his death box holds the keycard
  await ev(page, "(() => { const d = window.__range.duel(); const b = d.bots.find((x) => x.guard); d.botDown(b, d.id); })()");
  await sleep(400);
  const card = await ev<{ key: number | null; said: boolean; left: number }>(page, "(() => { const d = window.__range.duel(); const k = [...d.lootField.drops.values()].find((x) => x.item.kind === 'keycard'); return { key: k ? k.key : null, said: window.__notices.some((t) => t.includes('KEYCARD IS IN HIS BOX')), left: d.aliveCount }; })()");
  check("vault: the guard down, his death box holds the vault keycard, and everyone is told", card.key !== null && card.said, JSON.stringify(card));
  // taken: the holder is shown the way, and the door offers to open
  await ev(page, `window.__range.duel().takeLoot(${card.key ?? -1})`);
  await sleep(700);
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
  await sleep(400);
  await ev(page, swing);
  await sleep(900);
  const afterOne = kicked ? await ev<{ hits: number; open: boolean }>(page, `(() => { const d = window.__range.brMap.doors.list[${kicked.i}]; return { hits: d.hits, open: d.open }; })()`) : null;
  await ev(page, swing);
  await sleep(900);
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
  const card = await ev<{ on: boolean; choosing: boolean; picked: string | null }>(page, "({ on: window.__range.abilities.enabled, choosing: window.__range.abilities.choosing, picked: window.__range.abilities.picked })");
  check("abilities: the battle royale has them on, and the card is up on landing", card.on && card.choosing && card.picked === null, JSON.stringify(card));
  await ev(page, `window.__range.pickAbility("triage")`);
  const picked = await ev<{ choosing: boolean; picked: string | null }>(page, "({ choosing: window.__range.abilities.choosing, picked: window.__range.abilities.picked })");
  check("abilities: picking TRIAGE takes the card down", !picked.choosing && picked.picked === "triage", JSON.stringify(picked));
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
  const ammo0 = await ev<Record<string, number>>(
    page,
    `(() => { const r = window.__range; r.loadouts.select({ kind: "default", index: 3 }); r.player.teleport(${cratePos.x}, 0, ${cratePos.z}, 0); r.duel().addPod(new r.THREE.Vector3(${cratePos.x}, 0, ${cratePos.z}), 0.2, "loadout"); return { ...r.loadout.ammo.stock }; })()`
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
  const ammoOk = types.every((t) => got.ammo[t] - ammo0[t] === (t === "arrows" ? stacks.arrows : stacks[t] * brCfg.loadoutPod.stacks));
  check(
    "loadout crate: it hands you your saved loadout's two guns, kitted and a magazine up, with their ammo",
    got.ids.join() === got.want.join() && got.empty.every((e) => !e) && got.mags.every((m) => m === brCfg.loadoutPod.mag) && got.fitted.every((n) => n > 0) && ammoOk,
    JSON.stringify({ ...got, before: ammo0, types })
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
  // a heal: a cell brings the shield up by 25 in 2.5 s, 1.25 s with TRIAGE, and costs one of four
  await ev(page, "(() => { window.__range.duel().holdFire = true; window.__range.player.teleport(0, 0, 500, 0); })()");
  await sleep(300);
  const cellsBefore = await ev<number>(page, "window.__range.kit.items.cell");
  await ev(page, "window.__range.startHeal()");
  const shieldBefore = await ev<number>(page, "window.__range.duel().shield");
  await sleep(1700);
  const healed = await ev<{ shield: number; cells: number; max: number }>(page, "({ shield: window.__range.duel().shield, cells: window.__range.kit.items.cell, max: window.__range.duel().shieldMax })");
  check("a shield cell heals 25 shield and is spent, in half its time with TRIAGE", healed.shield === Math.min(healed.max, shieldBefore + 25) && healed.cells === cellsBefore - 1, JSON.stringify({ shieldBefore, cellsBefore, ...healed }));
  // the controller's Default: RB twice pings an enemy there; D-pad up heals; D-pad right readies a grenade
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
  await padTap(page, 15);
  const padNade = await ev<string | null>(page, "window.__range.ordnance.readied?.kind ?? null");
  check("pad: D-pad right readies a grenade", padNade !== null, String(padNade));
  await padTap(page, 6);
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
 * takes it, a helmet; your death box; the bots search before they are armed.
 */
async function brLootTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  // trios, the default size: the three bots are one squad of three
  await ev(page, brRow("trio", 3));
  await ev(page, `(() => { document.getElementById("brStart").value = "loot"; document.getElementById("goBr").click(); document.getElementById("startMode").click(); })()`);
  await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 40000 });
  await sleep(300);
  await ev(page, `(() => { window.__range.duel().holdFire = true; window.__range.pickAbility("jolt"); })()`);
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
  // A supply bin: go to one, hold E, and it opens, what it held thrown out round
  // it; it is never in the reach list, and it is gone for whoever comes next.
  const bin = await ev<{ key: number; x: number; y: number; z: number; n: number } | null>(page, `(() => { const f = window.__range.duel().lootField; const all = [...f.drops.values()].filter((d) => d.item.kind === "bin" && d.item.id === "closed"); const b = all[0]; return b ? { key: b.key, x: b.pos.x, y: b.pos.y, z: b.pos.z, n: f.drops.size } : null; })()`);
  if (!bin) check("bins: the match has supply bins", false);
  else {
    await ev(page, `(() => { const r = window.__range; r.player.teleport(${bin.x} - 0.8, ${bin.y}, ${bin.z}, 90, -30); })()`);
    await sleep(400);
    const rows = await ev<number[] | null>(page, `window.__range.brPlay.hud?.reach?.rows?.map((r) => r.key) ?? null`);
    const listed = rows === null || rows.includes(bin.key);
    // held, never pressed again: a press on each frame would take what the bin throws out
    await ev(page, `window.__range.setScript({ held: (a) => a === "interact", pressedNow: () => false })`);
    await sleep(1200);
    await ev(page, "window.__range.setScript(null)");
    const after = await ev<{ closed: boolean; open: boolean; round: number }>(page, `(() => { const f = window.__range.duel().lootField; const at = (d, r) => Math.hypot(d.pos.x - ${bin.x}, d.pos.z - ${bin.z}) < r; const ds = [...f.drops.values()]; return { closed: f.drops.has(${bin.key}), open: ds.some((d) => d.item.kind === "bin" && d.item.id === "open" && at(d, 0.2)), round: ds.filter((d) => d.item.kind !== "bin" && Math.abs(Math.hypot(d.pos.x - ${bin.x}, d.pos.z - ${bin.z}) - 1.1) < 0.15).length }; })()`);
    check("bins: hold E at a supply bin and it opens, what it held thrown out round it (and it is not in the reach list)", !listed && !after.closed && after.open && after.round >= 3, JSON.stringify({ listed, ...after }));
  }
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
  // out: your death box with what you had
  const before = await ev<number>(page, "window.__range.duel().lootField.count");
  await ev(page, "window.__range.duel().takeHit(500, 100)");
  await sleep(300);
  const box = await ev<{ alive: boolean; boxes: number; added: number }>(page, `(() => { const d = window.__range.duel(); const f = d.lootField; return { alive: d.alive, boxes: [...f.drops.values()].filter((x) => x.item.kind === "box").length, added: f.count }; })()`);
  check("loot: out, and your death box goes down with your guns, ammo, heals and helmet", !box.alive && box.boxes >= 1 && box.added - before >= 6, JSON.stringify({ before, ...box }));
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
    { map: "ringworks", button: "goCrown", want: "ringworks", bots: "3" },
    // "picked for the mode": a free-for-all is drawn for the ringworks
    { map: "auto", button: "goFfa", want: "ringworks", bots: "2" },
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
 * The arena's modes alone: Gun Run (a kill moves you on and changes your
 * gun, a melee death costs a level, the knife's kill wins), team deathmatch
 * (team mates, the score, the win), Crown (it appears, you take it, the hold
 * takes the round), each from its Play tab button, and each on the Stats tab.
 */
async function modesTest(browser: Browser, query: string): Promise<void> {
  // ---- Gun Run
  const g = await startModePage(browser, query, "goGunRun", `document.getElementById("modeBots").value = "2"; document.getElementById("gunRunList").value = "short"`);
  const g0 = await ev<{ kind: string; slots: string[]; level: number; of: number; bots: number; phase: string }>(
    g,
    `(() => { const r = window.__range; const d = r.duel(); const m = d.hud().mode; return { kind: d.modeKind, slots: r.loadout.slots.map((s) => (s.empty ? "-" : s.id)), level: m.gun.level, of: m.gun.of, bots: d.avatars.length, phase: d.phase }; })()`
  );
  const blocked = await ev<string[]>(g, `(() => { const r = window.__range; const S = ${JSON.stringify(MODE_SPAWNS)}; return S.filter(([x, z]) => { const o = r.openGround(90 + x, -40 + z, 0.6); return !o || Math.hypot(o.x - 90 - x, o.z + 40 - z) > 1e-6; }).map((p) => p.join(",")); })()`);
  check("modes: every spawn point stands clear of the arena's boxes", blocked.length === 0, blocked.join(" "));
  check("gun run: the Play tab button starts it, two bots, level 1 of 11 with the list's first gun and nothing else", g0.kind === "gunrun" && g0.phase === "fight" && g0.bots === 2 && g0.level === 1 && g0.of === 11 && g0.slots[0] === "rspn101" && g0.slots[1] === "-", JSON.stringify(g0));
  await ev(g, knockBot("true"));
  await sleep(300);
  const g1 = await ev<{ slots: string[]; level: number; hudGun: string }>(g, `(() => { const r = window.__range; const m = r.duel().hud().mode; return { slots: r.loadout.slots.map((s) => (s.empty ? "-" : s.id)), level: m.gun.level, hudGun: r.hud.last?.weaponName ?? "" }; })()`);
  check("gun run: a kill moves you to level 2 and the R-99 is in your hands", g1.level === 2 && g1.slots[0] === "r97" && g1.slots[1] === "-", JSON.stringify(g1));
  const back = await g.waitForFunction("window.__range.duel().avatars.every((a) => !a.knocked)", { polling: 200, timeout: 6000 }).then(() => true, () => false);
  check("gun run: the bot is back in after its respawn", back);
  await ev(g, `(() => { const d = window.__range.duel(); d.ladder.row(0).level = 4; d.takeHit(900, 100, false, "melee", 1); })()`);
  await sleep(200);
  const g2 = await ev<{ level: number; alive: boolean; respawnIn: number | null; botLevel: number }>(g, `(() => { const d = window.__range.duel(); const m = d.hud().mode; return { level: d.ladder.level(0), alive: d.alive, respawnIn: m.respawnIn, botLevel: d.ladder.level(100) }; })()`);
  check("gun run: knifed: a level lost (5 to 4), the knifer moves on, a respawn counting down", g2.level === 3 && !g2.alive && g2.respawnIn !== null && g2.respawnIn > 2 && g2.botLevel === 1, JSON.stringify(g2));
  const up = await g.waitForFunction("window.__range.duel().alive", { polling: 200, timeout: 6000 }).then(() => true, () => false);
  const spot = await ev<{ x: number; z: number }>(g, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })");
  check("gun run: back in 3 s later inside the arena", up && Math.abs(spot.x - 90) <= 18 && Math.abs(spot.z + 40) <= 32, JSON.stringify(spot));
  // the knife: the last level is fists; a melee kill with it wins
  await ev(g, `(() => { const d = window.__range.duel(); d.ladder.row(0).level = 10; d.gunsChanged(); })()`);
  await sleep(200);
  const knife = await ev<{ slots: string[]; knife: boolean; name: string; hudGun: string }>(g, `(() => { const r = window.__range; const d = r.duel(); return { slots: r.loadout.slots.map((s) => (s.empty ? "-" : s.id)), knife: d.knifeNow, name: d.hud().mode.gun.name, hudGun: r.hud.last?.weaponName ?? "" }; })()`);
  check("gun run: level 11 is the knife: no guns, fists, the knife's melee", knife.knife && knife.slots.every((s) => s === "-") && knife.name === "THE KNIFE", JSON.stringify(knife));
  const before = await ev<number>(g, `(window.__range.profile?.profile?.matches?.gunrun?.won ?? 0)`).catch(() => 0);
  await ev(g, knockBot("true", "melee"));
  await sleep(400);
  const won = await ev<{ phase: string; winner: string | null; won: boolean | null; stats: number }>(g, `(() => { const d = window.__range.duel(); const m = d.hud().mode; return { phase: d.phase, winner: m.winner, won: m.won, stats: document.getElementById("statsBody").innerHTML.includes("Gun Run") ? 1 : 0 }; })()`);
  check("gun run: a knife kill wins it: the match is over and you are the winner", won.phase === "matchEnd" && won.won === true && won.winner === "YOU", JSON.stringify({ before, ...won }));
  check("gun run: the Stats tab has a Gun Run card", won.stats === 1);
  await ev(g, "window.__range.duel()?.leave()");
  await sleep(300);
  const after = await ev<string[]>(g, "window.__range.loadout.slots.map((s) => (s.empty ? '-' : s.id))");
  check("gun run: leaving gives your own loadout back", after.every((s) => s !== "-"), JSON.stringify(after));
  await g.close();

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
  check("tdm: the bots keep their own guns (Gun Run's ladder is not theirs)", new Set(tdmGuns).size >= 4, tdmGuns.join(","));
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
    await ev(a, `document.getElementById("goArena").click(); document.getElementById("startMode").click()`);
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
  await ev(f, "(() => { const d = window.__range.duel(); d.ladder.row(d.id).kills = 19; })()");
  await ev(f, knockBot("true"));
  await sleep(400);
  const f3 = await ev<{ phase: string; winner: string | null; won: boolean | null; summary: { roundsWon: number } | null }>(f, "(() => { const d = window.__range.duel(); const m = d.hud().mode; return { phase: d.phase, winner: m.winner, won: m.won, summary: d.lastSummary ? { roundsWon: d.lastSummary.roundsWon } : null }; })()");
  check("ffa: the 20th kill wins it for you alone", f3.phase === "matchEnd" && f3.won === true && f3.winner === "YOU" && f3.summary?.roundsWon === 20, JSON.stringify(f3));
  await ev(f, "window.__range.duel()?.leave()");
  await f.close();

  // ---- Crown
  const c = await startModePage(browser, query, "goCrown", `document.getElementById("modeBots").value = "2"`);
  const c0 = await ev<{ phase: string; left: number | null }>(c, "(() => { const m = window.__range.duel().hud().mode; return { phase: m.crown.phase, left: m.left }; })()");
  check("crown: it waits for 20 s into the round", c0.phase === "waiting" && c0.left !== null && c0.left > 17 && c0.left <= 20, JSON.stringify(c0));
  await ev(c, "(() => { const d = window.__range.duel(); d.crown.appearsAt = 0; for (const a of d.avatars) a.group.visible = true; })()");
  await sleep(300);
  const c1 = await ev<string>(c, "window.__range.duel().hud().mode.crown.phase");
  check("crown: it appears in the middle", c1 === "ground" || c1 === "carried", c1);
  await ev(c, "window.__range.player.teleport(90, 0, -40, 0)");
  const mine = await c.waitForFunction("window.__range.duel().hud().mode.crown.mine", { polling: 100, timeout: 3000 }).then(() => true, () => false);
  check("crown: walking over it takes it", mine, JSON.stringify(await ev(c, "window.__range.duel().hud().mode.crown")));
  await ev(c, "(() => { window.__range.duel().crown.held = 29.4; })()");
  await sleep(900);
  const c2 = await ev<{ phase: string; wins: number; round: number }>(c, "(() => { const d = window.__range.duel(); return { phase: d.phase, wins: d.hud().mode.crown.wins, round: d.round }; })()");
  check("crown: 30 s holding it takes the round", c2.phase === "roundEnd" && c2.wins === 1, JSON.stringify(c2));
  // the gap between rounds says what happened in the one just played
  const card = await ev<{ rows: Array<{ name: string; kills: number | null; deaths: number | null; you: boolean }> } | null>(
    c,
    `(() => { const p = window.__range.hud.last?.duel?.players ?? null; return p ? { rows: p.map((r) => ({ name: r.name, kills: r.kills ?? null, deaths: r.deaths ?? null, you: r.you })) } : null; })()`
  );
  check("crown: the gap between rounds carries a card of who did what", !!card && card.rows.length > 1 && card.rows.every((r) => r.kills !== null && r.deaths !== null) && card.rows.some((r) => r.you), JSON.stringify(card));
  const r2 = await c.waitForFunction("window.__range.duel().phase === 'fight' && window.__range.duel().round === 2", { polling: 200, timeout: 12000 }).then(() => true, () => false);
  check("crown: round 2 starts with the crown waiting again", r2 && (await ev<string>(c, "window.__range.duel().hud().mode.crown.phase")) === "waiting");
  await ev(c, "window.__range.duel()?.leave()");
  await c.close();

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

  // ---- SCOUT: PULSE shows the enemies in front, SWEEP everyone around
  const sc = await startModePage(browser, query, "goFfa", `document.getElementById("modeBots").value = "2"; const ab = document.getElementById("botAbilities"); ab.value = "1"; ab.dispatchEvent(new Event("change"))`);
  await ev(sc, `window.__range.pickAbility("scout")`);
  // one bot 20 m in front of you, the other 45 m behind
  const put = await ev<{ front: number; back: number } | null>(
    sc,
    `(() => { const r = window.__range; const d = r.duel(); if (d.bots.length < 2) return null; d.holdFire = true; d.bots.forEach((b) => { b.bot.update = () => []; }); const p = r.player.pos; r.player.yaw = 0; const f = d.bots[0].bot, b2 = d.bots[1].bot; f.pos.set(p.x, p.y, p.z - 20); f.dummy.group.position.copy(f.pos); b2.pos.set(p.x, p.y, p.z + 45); b2.dummy.group.position.copy(b2.pos); return { front: f.remote.id, back: b2.remote.id }; })()`
  );
  await sleep(300);
  await ev(sc, "window.__range.useAbility()");
  await sleep(200);
  const pulsed = await ev<{ front: number; back: number; said: string; left: number }>(
    sc,
    `(() => { const r = window.__range; const d = r.duel(); const at = (id) => d.bots.find((b) => b.bot.remote.id === id)?.bot.dummy.threat ?? -1; return { front: at(${put?.front ?? -1}), back: at(${put?.back ?? -1}), said: r.hud.noticeNow, left: r.abilities.pulseLeft(r.gameTime()) }; })()`
  );
  await sleep(2200);
  const faded = await ev<number>(sc, `(() => { const d = window.__range.duel(); return d.bots.find((b) => b.bot.remote.id === ${put?.front ?? -1})?.bot.dummy.threat ?? -1; })()`);
  check("scout: PULSE shows the enemy in front (not the one behind) for its seconds, then they fade, and it waits out its cooldown", !!put && pulsed.front === 1 && pulsed.back === 0 && /PULSE: 1 ENEMY/.test(pulsed.said) && pulsed.left > 10 && faded === 0, JSON.stringify({ put, pulsed, faded }));
  await ev(sc, "(() => { const r = window.__range; r.abilities.ult = 1; r.useUltimate(); })()");
  await sleep(200);
  const swept = await ev<{ front: number; back: number; said: string }>(
    sc,
    `(() => { const r = window.__range; const d = r.duel(); const at = (id) => d.bots.find((b) => b.bot.remote.id === id)?.bot.dummy.threat ?? -1; return { front: at(${put?.front ?? -1}), back: at(${put?.back ?? -1}), said: r.hud.noticeNow }; })()`
  );
  check("scout: SWEEP shows everyone around, the one behind included", swept.front === 1 && swept.back === 1 && /SWEEP: 2 ENEMY CONTACTS/.test(swept.said), JSON.stringify(swept));
  await ev(sc, "window.__range.duel()?.leave()");
  await ev(sc, `(() => { const ab = document.getElementById("botAbilities"); ab.value = "0"; ab.dispatchEvent(new Event("change")); })()`);
  await sc.close();

  // ---- Search: plant and defuse, one life a round
  const sr = await startModePage(browser, query, "goSearch", `document.getElementById("modeBots").value = "3"`);
  const sr0 = await ev<{ kind: string; attacking: boolean; phase: string; left: number; sites: string; allies: number; n: number } | null>(sr, "(() => { const d = window.__range.duel(); const m = d.hud().mode; return m.search ? { kind: m.kind, attacking: m.search.attacking, phase: m.search.phase, left: m.search.left, sites: m.search.sites.map((q) => q.id).join(''), allies: m.rows.filter((r) => r.ally).length, n: d.avatars.length } : null; })()");
  check("search: three bots to face makes it three a side; round 1 you attack, sites A and B, the round's clock running", !!sr0 && sr0.kind === "search" && sr0.attacking && sr0.phase === "live" && sr0.left > 95 && sr0.left <= 105 && sr0.sites === "AB" && sr0.allies === 2 && sr0.n === 5, JSON.stringify(sr0));
  // the bots stand still (nobody goes down); you on site A, holding interact
  await ev(sr, "(() => { const d = window.__range.duel(); window.__notices = []; const say = d.onNotice; d.onNotice = (t) => { window.__notices.push(t); say?.(t); }; d.bots.forEach((b) => { b.bot.update = () => []; }); const q = d.hud().mode.search.sites[0].at; window.__range.player.teleport(q.x, 0, q.z, 180); })()");
  await sleep(400);
  const prompt = await ev<string | null>(sr, "window.__range.duel().hud().mode.search.prompt");
  await ev(sr, `window.__range.setScript({ held: (a) => a === "interact", pressedNow: () => false })`);
  await sleep(2000);
  const mid = await ev<{ kind: string; mine: boolean; k: number } | null>(sr, "window.__range.duel().hud().mode.search.work");
  const planted = await sr.waitForFunction("window.__range.duel().hud().mode.search.phase === 'planted'", { polling: 100, timeout: 6000 }).then(() => true, () => false);
  await ev(sr, "window.__range.setScript(null)");
  const sr1 = await ev<{ site: string | null; left: number; bomb: boolean; said: boolean }>(sr, "(() => { const d = window.__range.duel(); const m = d.hud().mode.search; return { site: m.site, left: m.left, bomb: d.bombModel.visible, said: window.__notices.some((t) => t.startsWith('BOMB PLANTED ON A')) }; })()");
  check("search: on site A the prompt says to hold E; held, a bar fills and the bomb is planted on A with its 40 s clock", prompt === "HOLD E TO PLANT ON A" && !!mid && mid.kind === "plant" && mid.mine && mid.k > 0.2 && mid.k < 0.8 && planted && sr1.site === "A" && sr1.left > 36 && sr1.bomb && sr1.said, JSON.stringify({ prompt, mid, planted, sr1 }));
  // the bomb beeps, quicker as it runs down, and going off takes the round for the attackers (you)
  // 20 s left, then 2 s: the gaps between beeps at each
  await ev(sr, "(() => { const d = window.__range.duel(); window.__beeps = []; const beep = d.onBeep; d.onBeep = (at, left) => { window.__beeps.push([performance.now(), left]); beep?.(at, left); }; d.search.endsAt = performance.now() / 1000 + 20; })()");
  await sleep(1600);
  await ev(sr, "(() => { const d = window.__range.duel(); d.search.endsAt = performance.now() / 1000 + 2; })()");
  const blown = await sr.waitForFunction("window.__range.duel().phase === 'roundEnd'", { polling: 100, timeout: 6000 }).then(() => true, () => false);
  const sr2 = await ev<{ you: number; them: number; won: boolean | null; slow: number; fast: number; said: boolean }>(sr, "(() => { const d = window.__range.duel(); const h = d.hud(); const b = window.__beeps; const gaps = (hi, lo) => { const g = []; for (let i = 1; i < b.length; i++) if (b[i - 1][1] <= hi && b[i - 1][1] > lo) g.push(b[i][0] - b[i - 1][0]); return g.length ? Math.round(g.reduce((x, y) => x + y, 0) / g.length) : 0; }; return { you: h.mode.search.you, them: h.mode.search.them, won: h.youWonRound, slow: gaps(21, 17), fast: gaps(2.1, 0), said: window.__notices.some((t) => t.startsWith('THE BOMB WENT OFF')) }; })()");
  const quicker = sr2.slow > 250 && sr2.fast > 0 && sr2.fast < sr2.slow * 0.5;
  check("search: the bomb beeps quicker as it runs down, and going off takes the round for the attackers", blown && sr2.you === 1 && sr2.them === 0 && sr2.won === true && sr2.said && quicker, JSON.stringify(sr2));
  // round 2: the clock running out before a plant is the defenders'
  await sr.waitForFunction("window.__range.duel().phase === 'fight' && window.__range.duel().round === 2", { polling: 200, timeout: 15000 }).catch(() => undefined);
  await ev(sr, "(() => { const d = window.__range.duel(); d.bots.forEach((b) => { b.bot.update = () => []; }); d.search.endsAt = performance.now() / 1000 + 0.5; })()");
  await sr.waitForFunction("window.__range.duel().phase === 'roundEnd'", { polling: 100, timeout: 5000 }).catch(() => undefined);
  const sr3 = await ev<{ you: number; them: number; alive: boolean }>(sr, "(() => { const m = window.__range.duel().hud().mode.search; return { you: m.you, them: m.them, alive: window.__range.duel().alive }; })()");
  check("search: the clock running out before a plant is the defenders' round", sr3.you === 1 && sr3.them === 1, JSON.stringify(sr3));
  // after round 6 the sides swap: round 7, you defend, and the bots attack a site and plant on their own
  await ev(sr, "(() => { const d = window.__range.duel(); d.round = 6; })()");
  await sr.waitForFunction("window.__range.duel().phase === 'fight' && window.__range.duel().round === 7", { polling: 200, timeout: 15000 }).catch(() => undefined);
  const swapped = await ev<{ attacking: boolean; round: number }>(sr, "(() => { const d = window.__range.duel(); return { attacking: d.hud().mode.search.attacking, round: d.round }; })()");
  // you and your two bots stay at your end (the bots hold their fire); the attacking bots are let go
  await ev(sr, "(() => { const d = window.__range.duel(); d.bots.forEach((b) => { if (b.team === 1) delete b.bot.update; }); const s = d.startSpawn(0, 0); window.__range.player.teleport(s.x, 0, s.z, s.yaw); })()");
  const botPlant = await sr.waitForFunction("window.__range.duel().hud().mode.search.phase === 'planted'", { polling: 250, timeout: 50000 }).then(() => true, () => false);
  const bySite = await ev<string | null>(sr, "window.__range.duel().hud().mode.search.site");
  check("search: after round 6 the sides swap, and the bots attack a site and plant the bomb on their own", swapped.round === 7 && !swapped.attacking && botPlant && (bySite === "A" || bySite === "B"), JSON.stringify({ swapped, botPlant, bySite }));
  // you defuse it: beside the bomb, holding interact for 7 s (the bots frozen again, so nobody goes down)
  await ev(sr, "(() => { const d = window.__range.duel(); d.bots.forEach((b) => { b.bot.update = () => []; }); d.search.endsAt = performance.now() / 1000 + 30; const q = d.search.bomb; const w = d.world([q.x, q.z]); window.__range.player.teleport(w.x + 0.8, 0, w.z, 0); })()");
  await sleep(300);
  const dPrompt = await ev<string | null>(sr, "window.__range.duel().hud().mode.search.prompt");
  await ev(sr, `window.__range.setScript({ held: (a) => a === "interact", pressedNow: () => false })`);
  const defused = await sr.waitForFunction("window.__range.duel().phase === 'roundEnd'", { polling: 100, timeout: 10000 }).then(() => true, () => false);
  await ev(sr, "window.__range.setScript(null)");
  const sr4 = await ev<{ you: number; them: number; said: boolean }>(sr, "(() => { const m = window.__range.duel().hud().mode.search; return { you: m.you, them: m.them, said: window.__notices.some((t) => t.startsWith('BOMB DEFUSED')) }; })()");
  check("search: beside the bomb the prompt says to hold E, and 7 s of it defuses the bomb: the round is yours", dPrompt === "HOLD E TO DEFUSE" && defused && sr4.you === 2 && sr4.said, JSON.stringify({ dPrompt, defused, sr4 }));
  await ev(sr, "window.__range.duel()?.leave()");
  await sr.close();

  // ---- the motion-captured figures (a setting): they load, a match's figures are mannequins and animate
  const mq = await open(browser, query);
  await ev(mq, `(() => { const s = document.getElementById("figureStyle"); const def = s.value; s.value = "mannequin"; s.dispatchEvent(new Event("change")); window.__mqDefault = def; return window.__range.loadMannequin(); })()`);
  check("figures: the mannequin is the default figure", (await ev<string>(mq, "window.__mqDefault")) === "mannequin");
  await ev(mq, `(() => { document.getElementById("modeBots").value = "2"; document.getElementById("goCrown").click(); document.getElementById("startMode").click(); })()`);
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

/**
 * A buddy joining a team deathmatch or a free-for-all with bots: the thing
 * the owner tried and could not do. The code was fine; the way in was behind
 * a tab called "1v1". These hold the whole path anyway, per mode.
 */
/**
 * Search with a friend: the guest plants. The host runs the round, so the
 * guest's hold on interact has to reach it (the "hold" effect), and the bar
 * and the bomb have to come back to the guest's screen.
 */
async function searchFriendsTest(browser: Browser, query: string): Promise<void> {
  const host = await open(browser, query);
  const guest = await open(browser, query);
  await ev(host, `(() => { document.getElementById("duelMode").value = "search"; document.getElementById("modeBots").value = "1"; document.getElementById("modeSides").value = "together"; document.getElementById("duelHost").click(); })()`);
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
    for (const p of [host, guest]) await pressPlay(p);
    for (const p of [host, guest]) await p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 30000 });
  } catch {
    check("search with a friend: the two start", false);
    await host.close();
    await guest.close();
    return;
  }
  // the bots stand still; the guest on site B, holding interact
  await ev(host, "(() => { const d = window.__range.duel(); d.holdFire = true; d.bots.forEach((b) => { b.bot.update = () => []; }); })()");
  await ev(guest, "(() => { const q = window.__range.duel().hud().mode.search.sites[1].at; window.__range.player.teleport(q.x, 0, q.z, 0); })()");
  await sleep(600);
  await ev(guest, `window.__range.setScript({ held: (a) => a === "interact", pressedNow: () => false })`);
  const barOnGuest = await guest.waitForFunction("window.__range.duel().hud().mode.search.work?.mine === true", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  const barOnHost = await host.waitForFunction("(() => { const w = window.__range.duel().hud().mode.search.work; return !!w && !w.mine && w.ally; })()", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  const planted = await host.waitForFunction("window.__range.duel().hud().mode.search.phase === 'planted'", { polling: 100, timeout: 8000 }).then(() => true, () => false);
  await ev(guest, "window.__range.setScript(null)");
  const seen = await guest.waitForFunction("(() => { const m = window.__range.duel().hud().mode.search; return m.phase === 'planted' && m.site === 'B'; })()", { polling: 100, timeout: 3000 }).then(() => true, () => false);
  const bomb = await ev<boolean>(guest, "window.__range.duel().bombModel.visible");
  check("search with a friend: the guest holds E on site B, both screens show its bar, and the host plants the bomb on B for it; the guest sees it", barOnGuest && barOnHost && planted && seen && bomb, JSON.stringify({ barOnGuest, barOnHost, planted, seen, bomb }));
  await host.close();
  await guest.close();
}

/**
 * A MEDIC's FIELD HEAL between friends: the guest's ultimate goes to the host
 * as an effect, and the host's page, a team mate within its reach, heals its
 * own player.
 */
async function kitsFriendsTest(browser: Browser, query: string): Promise<void> {
  const host = await open(browser, query);
  const guest = await open(browser, query);
  await ev(host, `(() => { document.getElementById("duelMode").value = "tdm"; document.getElementById("modeBots").value = "1"; document.getElementById("modeSides").value = "together"; const a = document.getElementById("duelAbilities"); a.value = "1"; a.dispatchEvent(new Event("change")); document.getElementById("duelHost").click(); })()`);
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
    for (const p of [host, guest]) await pressPlay(p);
    for (const p of [host, guest]) await p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 30000 });
  } catch {
    check("kits with a friend: the two start", false);
    await host.close();
    await guest.close();
    return;
  }
  await ev(host, "(() => { const d = window.__range.duel(); d.holdFire = true; d.bots.forEach((b) => { b.bot.update = () => []; }); })()");
  // side by side, the host hurt, the guest a MEDIC with a full meter
  await ev(guest, `(() => { const r = window.__range; r.pickAbility("triage"); r.abilities.ult = 1; })()`);
  const at = await ev<{ x: number; z: number }>(guest, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })");
  await ev(host, `(() => { const r = window.__range; r.player.teleport(${at.x + 3}, 0, ${at.z}, 0); r.duel().health = 35; })()`);
  await sleep(600);
  await ev(guest, "window.__range.useUltimate()");
  const healed = await host.waitForFunction("window.__range.duel().health > 90", { polling: 200, timeout: 8000 }).then(() => true, () => false);
  const hp = await ev<number>(host, "window.__range.duel().health");
  check("kits with a friend: a MEDIC's FIELD HEAL reaches a team mate close by, whose page heals them", healed, hp.toFixed(1));
  await host.close();
  await guest.close();
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
  const measure = `new Promise((done) => { const d = window.__range.duel(); const r = d.remotes.get(1); const pts = []; const t0 = performance.now(); const up = d.update.bind(d); d.update = (l) => { const at = performance.now(); up(l); const g = r.avatar.group.position; pts.push([at, g.x, g.z]); if (performance.now() - t0 > 2500 && !pts.done) { pts.done = true; d.update = up; const v = []; for (let i = 1; i < pts.length; i++) { const dt = (pts[i][0] - pts[i - 1][0]) / 1000; if (dt > 0.004) v.push(Math.hypot(pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]) / dt); } const m = v.reduce((a, b) => a + b, 0) / v.length; const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / v.length); const ss = r.samples.slice(-40); const sv = []; for (let i = 1; i < ss.length; i++) { const dt = ss[i].at - ss[i - 1].at; if (dt > 0) sv.push(Math.hypot(ss[i].x - ss[i - 1].x, ss[i].z - ss[i - 1].z) / dt); } const sm = sv.reduce((a, b) => a + b, 0) / sv.length; const ssd = Math.sqrt(sv.reduce((a, b) => a + (b - sm) * (b - sm), 0) / sv.length); done({ frames: v.length, mean: m, spread: sd / m, sampleSpread: ssd / sm, stalls: v.filter((x) => x < m * 0.2).length }); } }; })`;
  const bySent = await ev<{ frames: number; mean: number; spread: number }>(host, measure);
  await ev(host, "window.__range.duel().senderClock = false");
  await sleep(800);
  const byArrival = await ev<{ frames: number; mean: number; spread: number }>(host, measure);
  if (lossy) {
    // a sixth of the state packets lost and the rest out of order: the figure still runs as the player did
    const fast = await ev<{ sent: number; got: number } | null>(guest, "window.__range.duel()?.linkFor(0)?.fastStats?.() ?? null");
    check("loss: with 15% of the state packets lost and the rest out of order, a friend running at one speed still moves at one speed", bySent.frames > 60 && bySent.mean > 3 && bySent.spread < 0.3, JSON.stringify({ bySent, fast }));
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

/** Gun Run with a friend over the local transport, and a bot: the ladder is the host's, a kill moves the killer on on both screens, respawns */
async function modesFriendsTest(browser: Browser, query: string): Promise<void> {
  const host = await open(browser, query);
  const guest = await open(browser, query);
  await ev(host, `(() => { document.getElementById("duelMode").value = "gunrun"; document.getElementById("modeBots").value = "1"; document.getElementById("gunRunList").value = "short"; document.getElementById("duelHost").click(); })()`);
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
  check("modes friends: the guest plays the host's mode (Gun Run)", kinds.every((k) => k.kind === "gunrun"), JSON.stringify(kinds));
  for (const p of [host, guest]) await pressPlay(p);
  const fight = await Promise.all([host, guest].map((p) => p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 20000 }).then(() => true, () => false)));
  check("modes friends: the fight starts on both", fight.every(Boolean));
  await ev(host, "window.__range.duel().holdFire = true");
  await sleep(1200);
  const seen = await ev<{ bots: number; humans: number; rows: number }>(guest, `(() => { const d = window.__range.duel(); const rs = [...d.remotes.values()]; return { bots: rs.filter((r) => r.id >= 100).length, humans: rs.filter((r) => r.id < 100).length, rows: d.hud().mode.rows.length }; })()`);
  check("modes friends: the guest sees the host and the host's bot, and all three on the scoreboard", seen.bots === 1 && seen.humans === 1 && seen.rows === 3, JSON.stringify(seen));
  // the host knocks the guest: the host's level goes up on both screens, the guest comes back
  await ev(host, `(() => { const d = window.__range.duel(); const r = d.remotes.get(1); d.localHit(r, 900, true, "rspn101", 12); })()`);
  const down = await guest.waitForFunction("!window.__range.duel().alive", { polling: 100, timeout: 5000 }).then(() => true, () => false);
  await sleep(700);
  const lv = await Promise.all([host, guest].map((p) => ev<number>(p, "window.__range.duel().ladder.level(0)")));
  const hostGun = await ev<string>(host, "window.__range.loadout.slots[0].id");
  check("modes friends: the host's kill moves the host to level 2 on both screens, the R-99 in hand", down && lv[0] === 1 && lv[1] === 1 && hostGun === "r97", JSON.stringify({ down, lv, hostGun }));
  const again = await guest.waitForFunction("window.__range.duel().alive", { polling: 200, timeout: 6000 }).then(() => true, () => false);
  const hostSees = await host.waitForFunction("window.__range.duel().remotes.get(1)?.alive === true", { polling: 200, timeout: 4000 }).then(() => true, () => false);
  check("modes friends: the guest respawns and the host sees them back", again && hostSees);
  // the guest knocks the bot (a hit message the host applies): the guest moves on, told by the host
  await ev(guest, guestRounds("x.id >= 100 && x.alive", 16));
  const gl = await guest.waitForFunction("window.__range.duel().ladder.level(1) === 1 && window.__range.loadout.slots[0].id === 'r97'", { polling: 200, timeout: 5000 }).then(() => true, () => false);
  check("modes friends: the guest's kill on the host's bot moves the guest on, the R-99 in the guest's hands", gl, JSON.stringify(await ev(guest, "({ lv: window.__range.duel().ladder.level(1), gun: window.__range.loadout.slots[0].id })")));
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
  // abilities are on in a squad by default: the guest picks JOLT on landing and the host sees it
  await ev(guest, `window.__range.pickAbility("jolt")`);
  await ev(guest, "window.__range.useAbility()");
  const seenJolt = await host.waitForFunction("window.__range.remoteFxLog.some((e) => e.k === 'jolt' && e.from === 1)", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  check("squad: the guest's JOLT reaches the host", seenJolt, JSON.stringify(await ev(host, "window.__range.remoteFxLog")));
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
  // down again and finished off: out, the killcam, the banner for the squad (two cells on them first, for their box)
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
  const outFig = await ev<{ holding: boolean; knocked: boolean }>(host, "(() => { const a = window.__range.duel().remotes.get(1).avatar; return { holding: a.holdingGun, knocked: a.knocked }; })()");
  check("out: the host's figure of you is down and holds no gun", outFig.knocked && !outFig.holding, JSON.stringify(outFig));
  const banner = await host.waitForFunction("[...window.__range.duel().lootField.drops.values()].some((x) => x.item.kind === 'banner' && x.item.owner === 1)", { polling: 200, timeout: 4000 }).then(() => true, () => false);
  check("squad: the guest's death box holds their banner, on the host's floor too", banner);
  // Deathbox Respawn: the host holds interact at the guest's box (the lockout waived for the test): a beam for all, and the guest is back on it at 20 health
  await ev(host, "window.__range.duel().boxLockout = () => 0");
  const bAt = await ev<{ x: number; z: number } | null>(host, "(() => { const d = [...window.__range.duel().lootField.drops.values()].find((x) => x.item.kind === 'banner' && x.item.owner === 1); return d ? { x: d.pos.x, z: d.pos.z } : null; })()");
  await ev(host, `window.__range.player.teleport(${(bAt?.x ?? 0) + 1}, 0, ${bAt?.z ?? 0}, 90)`);
  await sleep(400);
  const boxPrompt = await ev<string>(host, "JSON.stringify(window.__range.brPlay.hud.prompt)");
  check("deathbox respawn: at a dead mate's box, a tap takes the banner, a hold respawns them", /HOLD: RESPAWN/.test(boxPrompt), boxPrompt);
  await ev(host, `window.__range.setScript({ held: (a) => a === "interact", pressedNow: () => false })`);
  const beamSeen = await guest.waitForFunction("window.__range.remoteFxLog.some((e) => e.k === 'beam' && e.from === 0)", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  check("deathbox respawn: the beam goes up on the others' screens while it runs", beamSeen);
  const back = await guest.waitForFunction("window.__range.duel().alive", { polling: 100, timeout: 11000 }).then(() => true, () => false);
  await ev(host, "window.__range.setScript(null)");
  await sleep(600);
  const gBack = await ev<{ hp: number; d: number; regen: boolean; shield: number; max: number; things: number }>(guest, `(() => { const r = window.__range; const d = r.duel(); const p = r.player.pos; return { hp: d.health, d: Math.hypot(p.x - ${bAt?.x ?? 0}, p.z - ${bAt?.z ?? 0}), regen: !!r.kdState().box, shield: d.shield, max: d.shieldMax, things: r.loadout.slots.filter((s) => !s.empty).length + Object.values(r.kit.items).reduce((a, b) => a + b, 0) }; })()`);
  check("deathbox respawn: 7 s later the guest is up on the box at 20 health, the shield coming back from nothing, the box's things on", back && gBack.hp === 20 && gBack.d < 3 && gBack.regen && gBack.shield < gBack.max && gBack.things > 0, JSON.stringify(gBack));
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

async function duelTest(browser: Browser, query: string, label: string, bases: [string, string] = [BASE, BASE], want: NetWant = "deltas"): Promise<boolean> {
  const host = await open(browser, query, bases[0]);
  const guest = await open(browser, query, bases[1]);
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
  // the lobby is the arena: the host is in it, with the code on the HUD, before anyone joins
  const lobby = await ev<{ x: number; z: number; lobby: string | null }>(host, `(() => { const p = window.__range.player.pos; return { x: p.x, z: p.z, lobby: window.__range.lobbyCode() }; })()`);
  check(`${label}: the host waits in the arena with the code on the HUD`, Math.abs(lobby.x - 90) < 0.5 && Math.abs(lobby.z + 69) < 0.5 && lobby.lobby === code, JSON.stringify(lobby));
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
 * out of its sight, throws a frag at you standing still in view, crouches in
 * the fight, dodges when hit; low, it breaks line of sight to heal.
 */
async function botTiersTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  await ev(page, `document.getElementById("overlay").classList.add("hidden")`);
  await ev(page, `(() => { document.getElementById("botCount").value = "1"; document.getElementById("botDifficulty").value = "elite"; window.__range.startBots(); })()`);
  await page.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 15000 });
  const tier = await ev<string>(page, "window.__range.duel().bots[0].diff.name");
  check("tiers: the elite select makes an elite bot", tier === "elite", tier);
  // you cannot be hurt here; the hits are written down instead (what hit you, for the frag)
  await ev(page, `(() => { const d = window.__range.duel(); window.__hits = []; d.takeHit = (amount, from, weapon) => { window.__hits.push(weapon); }; })()`);
  // hearing: out of its sight, your shot brings it to look (elite hears every one in earshot)
  await ev(page, `(() => { const d = window.__range.duel(); const b = d.bots[0]; b.sees = () => false; const p = window.__range.player.pos; d.localShot(p.clone().setY(p.y + 1.5), new window.__range.THREE.Vector3(0, 0, -1), "r97"); })()`);
  const heard = await ev<boolean>(page, "!!window.__range.duel().bots[0].heard");
  check("tiers: out of its sight, an elite bot hears your shot and goes to look", heard);
  await ev(page, `delete window.__range.duel().bots[0].sees`);
  // a frag at you standing still in its view: it keeps 18 m off, you stay put in the open
  // Out in the open near a spawn, not the middle of the map: there is a
  // building over the capture circle now. A lobbed frag thrown from the far
  // side of it lands on its roof, and from the middle it lands on its floor.
  await ev(page, `(() => { const d = window.__range.duel(); const b = d.bots[0]; b.diff = { ...b.diff, keep: 10 }; const s = window.__range.openGround(90, -60, 1.5); window.__range.player.teleport(s.x, 0, s.z, 0); })()`);
  const threw = await page.waitForFunction("window.__range.remoteFxLog.some((e) => e.k === 'throw' && e.from === 1)", { polling: 200, timeout: 14000 }).then(() => true, () => false);
  check("tiers: you stand still in view and the elite bot throws a frag at you", threw, JSON.stringify(await ev(page, "(() => { const b = window.__range.duel().bots[0]; return { frags: b.frags, d: b.pos.distanceTo(window.__range.player.pos).toFixed(1), seen: !!b.lastSeen }; })()")));
  const fragHit = await page.waitForFunction("window.__hits.includes('frag')", { polling: 200, timeout: 7000 }).then(() => true, () => false);
  check("tiers: and the frag's blast lands on you (the bot's side works it out)", fragHit, JSON.stringify(await ev(page, "window.__hits.slice(-6)")));
  // it crouches now and then in the fight (close in, where nothing low stands between you), and dodges when hit
  // in front of it: a bot that has wandered off with its back to you does not see you (its view cone), which is the point
  await ev(page, "(() => { const r = window.__range; const b = r.duel().bots[0]; b.diff = { ...b.diff, keep: 6 }; const y = b.dummy.group.rotation.y; const s = r.openGround(b.pos.x + Math.sin(y) * 12, b.pos.z + Math.cos(y) * 12, 1.5); if (s) r.player.teleport(s.x, 0, s.z, 0); })()");
  const crouched = await page.waitForFunction("window.__range.duel().bots[0].crouching", { polling: 50, timeout: 12000 }).then(() => true, () => false);
  check("tiers: the elite bot crouches while it fires", crouched, crouched ? "" : JSON.stringify(await ev(page, `(() => { const b = window.__range.duel().bots[0]; const p = window.__range.player.pos; const y = b.dummy.group.rotation.y; const dx = p.x - b.pos.x, dz = p.z - b.pos.z; return { sees: b.sees(p), seenAgo: b.lastSeen ? +(performance.now() / 1000 - b.lastSeen.at).toFixed(1) : null, facingDeg: Math.round(Math.acos(Math.max(-1, Math.min(1, (Math.sin(y) * dx + Math.cos(y) * dz) / Math.hypot(dx, dz)))) * 180 / Math.PI), d: +Math.hypot(dx, dz).toFixed(1), healing: !!b.healing, cover: !!b.cover }; })()`)));
  const dodge = await ev<boolean>(page, `(() => { const b = window.__range.duel().bots[0]; const before = b.strafeSign; b.dummy.hit(0, "body", 5, 1, 1, b.pos.clone().setY(1.2)); return new Promise((r) => setTimeout(() => r(b.strafeSign !== before), 400)); })()`);
  check("tiers: hit, it reverses its strafe (hard and elite always dodge)", dodge);
  // low: it finds cover out of your sight and heals there
  await ev(page, `(() => { const b = window.__range.duel().bots[0]; b.diff = { ...b.diff, keep: 6 }; b.dummy.shield = 0; b.dummy.health = 30; })()`);
  const covered = await page.waitForFunction("!!window.__range.duel().bots[0].cover", { polling: 100, timeout: 6000 }).then(() => true, () => false);
  check("tiers: low, it picks a spot out of your sight", covered);
  const healed = await page.waitForFunction("(() => { const b = window.__range.duel().bots[0]; return b.dummy.health + b.dummy.shield > 30 || !!b.healing; })()", { polling: 100, timeout: 12000 }).then(() => true, () => false);
  const hidden = await ev<boolean>(page, "(() => { const b = window.__range.duel().bots[0]; return !b.sees(window.__range.player.pos); })()");
  check("tiers: and heals there, out of your sight", healed && hidden, JSON.stringify({ healed, hidden }));
  await ev(page, "window.__range.duel().leave()");
  // an easy bot does none of it
  await ev(page, `(() => { document.getElementById("botDifficulty").value = "easy"; window.__range.startBots(); })()`);
  await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 15000 });
  const easy = await ev<{ name: string; grenade: unknown; cover: boolean; dodge: number }>(page, "(() => { const b = window.__range.duel().bots[0]; return { name: b.diff.name, grenade: b.diff.grenadeAfter, cover: b.diff.cover, dodge: b.diff.dodge }; })()");
  check("tiers: an easy bot throws nothing, takes no cover, never dodges", easy.name === "easy" && easy.grenade === null && !easy.cover && easy.dodge === 0, JSON.stringify(easy));
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
  const offAb = await ev<{ on: boolean; choosing: boolean }>(page, "({ on: window.__range.abilities.enabled, choosing: window.__range.abilities.choosing })");
  check("bots: abilities are off by default, no card", !offAb.on && !offAb.choosing, JSON.stringify(offAb));
  // the bot hunts you down the middle lane and shoots: the shield drops
  const shot = await page.waitForFunction("window.__range.duel().shield < 75", { polling: 250, timeout: 25000 }).then(() => true, () => false);
  const pos = await ev<{ x: number; z: number; sh: number }>(page, "(() => { const b = window.__range.duel().avatars[0].group.position; return { x: b.x, z: b.z, sh: window.__range.duel().shield }; })()");
  check("bots: the bot closes in and lands a shot", shot, `bot at ${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}, your shield ${pos.sh}` + (shot ? "" : " " + JSON.stringify(await ev(page, `(() => { const d = window.__range.duel(); const b = d.bots[0]; const pl = window.__range.player.pos; return { y: b.pos.y, you: [pl.x.toFixed(1), pl.z.toFixed(1)], sees: b.sees(pl), crouch: b.crouching, cover: !!b.cover, heard: !!b.heard, seen: b.lastSeen && [b.lastSeen.pos.x.toFixed(1), b.lastSeen.pos.z.toFixed(1)], slideDir: b.slideDir, joltLeft: b.joltLeft, healing: !!b.healing }; })()`))));
  check("bots: it moved off its spawn toward you", pos.z < -12, `z ${pos.z.toFixed(1)}`);
  const snd = await ev<{ played: number; voices: number }>(page, "({ played: window.__range.audio.played, voices: window.__range.audio.voiceCount })");
  check("sound: the fight is heard (its shots and footsteps), under the voice cap", snd.played > 5 && snd.voices <= 56, JSON.stringify(snd));
  // the recorded CC0 samples (npm run sounds) load and are layered in (a checkout without them is the synthesis alone)
  const rec = await ev<{ loaded: number; played: number; files: boolean }>(page, "(async () => { const a = window.__range.audio; a.land(1, 'concrete'); a.punch(null); return { loaded: a.sampleCount, played: a.samplesPlayed, files: (await fetch('audio/kenney/index.json')).ok }; })()");
  check("sound: the recorded samples are loaded and layered into the fight's sounds", !rec.files || (rec.loaded >= 10 && rec.played > 0), JSON.stringify(rec));
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
  // the same with abilities on: the card at the countdown, JOLT, the bots have theirs
  await ev(page, `(() => { const s = document.getElementById("botAbilities"); s.value = "1"; s.dispatchEvent(new Event("change")); window.__range.startBots(); })()`);
  const cardUp = await page.waitForFunction("window.__range.abilities.choosing === true", { polling: 100, timeout: 5000 }).then(() => true, () => false);
  check("bots with abilities: the card is up at the countdown", cardUp);
  const botAb = await ev<string[]>(page, "window.__range.duel().bots.map((b) => String(b.ability))");
  check("bots with abilities: the bot has one too, from the four a bot plays", botAb.every((a) => a === "jolt" || a === "triage" || a === "smoke" || a === "ward"), botAb.join(","));
  await ev(page, `window.__range.pickAbility("jolt")`);
  await page.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 15000 });
  const p0 = await ev<{ x: number; z: number }>(page, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })");
  // third person, where your own streak is drawn (in first person you are inside it)
  await ev(page, "window.__range.setThirdPerson(true)");
  await ev(page, "window.__range.useAbility()");
  const streak = await ev<number>(page, "window.__range.fxCount()");
  await ev(page, "window.__range.setThirdPerson(false)");
  check("bots with abilities: JOLT leaves its streak (third person)", streak > 0, `${streak} effects`);
  await sleep(500);
  const j = await ev<{ x: number; z: number }>(page, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })");
  const moved = Math.hypot(j.x - p0.x, j.z - p0.z);
  check("bots with abilities: JOLT dashes you (up to 10 m, a wall can stop it short)", moved > 3 && moved < 14, `${moved.toFixed(2)} m (the dash, then its exit speed running down)`);
  const ch1 = await ev<{ charges: number; nextIn: number }>(page, "window.__range.abilities.charge(window.__range.gameTime())");
  check("bots with abilities: one of JOLT's two charges spent, coming back", ch1.charges === 1 && ch1.nextIn > 2.5 && ch1.nextIn < 4, JSON.stringify(ch1));
  // back the way you came (the first may have run you up to a wall), then the second, sideways (D held): the view leans into it
  await ev(page, "window.__range.player.yaw += 180");
  await ev(page, `window.__range.setScript({ held: (a) => a === "right", pressedNow: () => false })`);
  await sleep(100);
  await ev(page, "window.__range.useAbility()");
  const rolled = await page.waitForFunction("window.__range.joltFeel().roll > 1.2 && window.__range.joltFeel().fov > 0.03", { polling: 10, timeout: 1500 }).then(() => true, () => false);
  await sleep(300);
  await ev(page, "window.__range.setScript(null)");
  check("bots with abilities: a sideways JOLT rolls the view toward it and widens it", rolled);
  const j2 = await ev<{ x: number; z: number }>(page, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })");
  const cd = await ev<number>(page, "window.__range.abilities.cooldownLeft(window.__range.gameTime())");
  check("bots with abilities: the second charge dashes again", Math.hypot(j2.x - j.x, j2.z - j.z) > 2, `${Math.hypot(j2.x - j.x, j2.z - j.z).toFixed(2)} m`);
  check("bots with abilities: then both are spent until the first is back (4 s)", cd > 2 && cd < 4, cd.toFixed(2));
  const hudAb = await ev<{ charges?: number; max?: number } | null>(page, "window.__range.hud.last.ability");
  check("bots with abilities: the HUD shows the charges", hudAb?.charges === 0 && hudAb?.max === 2, JSON.stringify(hudAb));
  // the kit's ultimate: the meter fills in the match; full, RUNNER's OVERDRIVE is faster moving and JOLT refilled
  await ev(page, "(() => { const d = window.__range.duel(); d.holdFire = true; })()");
  const k0 = await ev<number>(page, "window.__range.abilities.ult");
  await ev(page, "window.__range.abilities.ult = 1");
  await ev(page, "window.__range.useUltimate()");
  await sleep(300);
  const od = await ev<{ boost: number; charges: number; ult: { name: string; live: number; k: number } | null }>(page, "(() => { const r = window.__range; return { boost: r.player.holsterBoost, charges: r.abilities.charge(r.gameTime()).charges, ult: r.hud.last.ability?.ult ?? null }; })()");
  check("kits: the ultimate's meter fills in a match; full, RUNNER's OVERDRIVE makes you faster for 8 s, JOLT refilled, the meter spent", k0 > 0 && od.boost >= 1.24 && od.charges === 2 && !!od.ult && od.ult.name === "OVERDRIVE" && od.ult.live > 7 && od.ult.k < 0.05, JSON.stringify({ k0, od }));
  // MEDIC: PATCH gives 25 health over 3 s; FIELD HEAL 60 over 5
  await ev(page, `window.__range.pickAbility("triage")`);
  await ev(page, "(() => { window.__range.duel().health = 50; window.__range.useAbility(); })()");
  await sleep(3400);
  const patched = await ev<{ hp: number; left: number; name: string }>(page, "(() => { const r = window.__range; return { hp: r.duel().health, left: r.abilities.patchLeft(r.gameTime()), name: r.hud.last.ability?.name ?? '' }; })()");
  check("kits: MEDIC's PATCH gives back 25 health over 3 s, then waits out its cooldown", Math.abs(patched.hp - 75) < 2.5 && patched.left > 12 && patched.name === "PATCH", JSON.stringify(patched));
  await ev(page, "(() => { const r = window.__range; r.abilities.ult = 1; r.duel().health = 30; r.useUltimate(); })()");
  await sleep(5400);
  const healed = await ev<number>(page, "window.__range.duel().health");
  check("kits: MEDIC's FIELD HEAL gives 60 health over 5 s", Math.abs(healed - 90) < 2.5, healed.toFixed(1));
  await ev(page, "window.__range.clearKitStuff()");
  // WARD: a wall in front of you stops a bot's line to you, and HARD SHELL gives the shield back out of a fight
  await ev(page, `window.__range.pickAbility("ward")`);
  const ward0 = await ev<{ walls: number; sees: boolean } | null>(
    page,
    `(() => { const r = window.__range; const d = r.duel(); const b = d.bots[0]; if (!b) return null; d.holdFire = true; b.update = () => []; const p = r.player.pos; b.pos.set(p.x, p.y, p.z - 8); b.dummy.group.position.copy(b.pos); r.player.yaw = 0; r.player.pitch = 0; b.lastSeen = { pos: p.clone(), at: b.clock, id: 0 }; d.shield = 10; return { walls: r.wallCount(), sees: b.sees(p) }; })()`
  ).catch(() => null);
  await ev(page, "window.__range.useAbility()");
  await sleep(300);
  const walled = await ev<{ walls: number; sees: boolean; left: number; name: string }>(
    page,
    `(() => { const r = window.__range; const d = r.duel(); const b = d.bots[0]; return { walls: r.wallCount(), sees: b.sees(r.player.pos), left: r.abilities.wallLeft(r.gameTime()), name: r.hud.last.ability?.name ?? "" }; })()`
  );
  check("kits: WARD's WALL stands in front of you and takes the bot's line to you away, then waits out its cooldown", !!ward0 && ward0.sees && walled.walls === (ward0.walls ?? 0) + 1 && !walled.sees && walled.left > 12 && walled.name === "WALL", JSON.stringify({ ward0, walled }));
  // the shield comes back after the quiet, and the ultimate puts up its horseshoe
  const shield0 = await ev<number>(page, "window.__range.duel().shield");
  await sleep(7000);
  const shield1 = await ev<number>(page, "window.__range.duel().shield");
  await ev(page, "(() => { const r = window.__range; r.abilities.ult = 1; r.useUltimate(); })()");
  await sleep(300);
  const bastion = await ev<number>(page, "window.__range.wallCount()");
  check("kits: WARD's HARD SHELL gives the shield back once nothing has hurt you, and BASTION puts up its horseshoe", shield1 > shield0 + 5 && bastion === walled.walls + 3, JSON.stringify({ shield0, shield1, walls: walled.walls, bastion }));
  await ev(page, `window.__range.pickAbility("smoke")`);

  await ev(page, "window.__range.clearKitStuff()");
  // a bot's own ultimate: a RUNNER bot with a full meter and someone in front of it goes quicker for its seconds
  const botUlt = await ev<{ base: number; speed: number } | null>(
    page,
    `(() => { const r = window.__range; const d = r.duel(); const b = d.bots[0]; if (!b) return null; delete b.update; b.ability = "jolt"; b.ultAt = 0; b.lastSeen = { pos: r.player.pos.clone(), at: b.clock, id: 0 }; const p = r.player.pos; b.pos.set(p.x, p.y, p.z - 8); b.dummy.group.position.copy(b.pos); r.player.yaw = 180; return { base: b.diff.speed, speed: b.speedNow }; })()`
  );
  await sleep(900);
  const botAfter = await ev<{ base: number; speed: number } | null>(page, "(() => { const b = window.__range.duel().bots[0]; return b ? { base: b.diff.speed, speed: b.speedNow } : null; })()");
  await ev(page, "window.__range.clearKitStuff()");
  // HOOK: a line at what you look at pulls you to it, and its ultimate puts up a zipline
  await ev(page, `window.__range.pickAbility("hook")`);
  await sleep(200);
  const climb = await ev<number>(page, "window.__range.player.climbBoost");
  // a wall to take hold of: each way round until the line finds one (a miss costs no cooldown)
  let pulled = { speed: 0, left: 0, name: "", said: "" };
  for (const yaw of [0, 90, 180, 270]) {
    await ev(page, `(() => { const p = window.__range.player; p.yaw = ${yaw}; p.pitch = 0; p.vel.set(0, 0, 0); })()`);
    await sleep(150);
    await ev(page, "window.__range.useAbility()");
    await sleep(150);
    pulled = await ev<{ speed: number; left: number; name: string; said: string }>(page, "(() => { const r = window.__range; return { speed: r.player.speed, left: r.abilities.grappleLeft(r.gameTime()), name: r.hud.last.ability?.name ?? '', said: r.hud.noticeNow }; })()");
    if (pulled.speed > 6) break;
  }
  check("kits: HOOK's STRONG ARMS gives half again the climb, and GRAPPLE pulls you at what you look at, then waits out its cooldown", Math.abs(climb - 1.5) < 1e-9 && pulled.speed > 6 && pulled.left > 8 && pulled.name === "GRAPPLE", JSON.stringify({ climb, pulled }));
  await ev(page, "window.__range.clearKitStuff()");
  // SMOKE: a canister blinds a bot through it, your own cloud shows an enemy standing in it, and SCREEN throws three
  await ev(page, `window.__range.pickAbility("smoke")`);
  const smoke = await ev<{ before: boolean; id: number } | null>(
    page,
    `(() => { const r = window.__range; const d = r.duel(); const b = d.bots[0]; if (!b) return null; d.holdFire = true; b.update = () => []; const p = r.player.pos; b.pos.set(p.x, p.y, p.z - 8); b.dummy.group.position.copy(b.pos); r.player.yaw = 0; r.player.pitch = -11.3; b.lastSeen = { pos: r.player.pos.clone(), at: b.clock, id: 0 }; return { before: b.sees(r.player.pos), id: b.remote.id }; })()`
  ).catch(() => null);
  const smoke0 = await ev<number>(page, "window.__range.smokeCount()");
  await ev(page, "window.__range.useAbility()");
  await sleep(1400);
  const smoked = await ev<{ clouds: number; sees: boolean; threat: number; spots?: unknown; me?: unknown; bot?: unknown }>(
    page,
    `(() => { const r = window.__range; const d = r.duel(); const b = d.bots[0]; return { clouds: r.smokeCount(), sees: b.sees(r.player.pos), threat: b.dummy.threat, spots: r.smokeSpots(), me: { x: r.player.pos.x, z: r.player.pos.z }, bot: { x: b.pos.x, z: b.pos.z } }; })()`
  );
  check("kits: SMOKE's canister blooms a cloud that blinds a bot through it, and THERMAL shows an enemy standing in it", !!smoke && smoke.before && smoked.clouds === smoke0 + 1 && !smoked.sees && smoked.threat === 1, JSON.stringify({ smoke, smoke0, smoked }));
  await ev(page, "(() => { const r = window.__range; r.abilities.ult = 1; r.useUltimate(); })()");
  await sleep(300);
  const screen = await ev<number>(page, "window.__range.smokeCount()");
  check("kits: SMOKE's SCREEN throws three clouds in a line", screen === smoked.clouds + 3, `${smoked.clouds} then ${screen}`);
  // a bot's own kit: hurt it, stand where it can see you, and its SMOKE or its
  // WARD goes up between the two of you (src/game/bots.ts coverPlan)
  {
    const put = await ev<{ kind: string; clouds: number; walls: number }>(
      page,
      `new Promise((ok) => { const r = window.__range; const d = r.duel(); const b = d.bots[0];
        delete b.update;
        d.holdFire = false;
        b.ability = "smoke";
        b.dummy.health = 40;
        // it decides from where it is and where you are: stand 12 m off, in the open
        r.player.teleport(b.pos.x, 0, b.pos.z + 12, 180);
        const c0 = r.smokeCount(); const w0 = r.wallCount();
        setTimeout(() => ok({ kind: "smoke", clouds: r.smokeCount() - c0, walls: r.wallCount() - w0 }), 1200); })`
    );
    check("kits: a hurt bot playing SMOKE puts a cloud up between the two of you", put.clouds >= 1, JSON.stringify(put));
    await ev(page, "window.__range.clearKitStuff()");
    // A hurt bot goes for cover the moment it is hurt, so by the time it would
    // put a wall up it is usually behind something with nobody in sight. The
    // decision itself is checked in tools/checks/kits.ts; what is checked here
    // is the rest of the chain: that what a bot puts up reaches the world.
    const wall = await ev<{ walls: number }>(
      page,
      `new Promise((ok) => { const r = window.__range; const b = r.duel().bots[0];
        b.ability = "ward";
        const w0 = r.wallCount();
        b.putUp = { k: "wall", from: new r.THREE.Vector3(b.pos.x, b.pos.y, b.pos.z + 2), to: new r.THREE.Vector3(0, 0, 0) };
        setTimeout(() => ok({ walls: r.wallCount() - w0 }), 600); })`
    );
    check("kits: and what a bot playing WARD puts up reaches the world as a wall", wall.walls >= 1, JSON.stringify(wall));
    await ev(page, "window.__range.clearKitStuff()");
  }
  await ev(page, `window.__range.pickAbility("hook")`);
  const zip0 = await ev<number>(page, "window.__range.ziplineCount()");
  await ev(page, "(() => { const r = window.__range; r.abilities.ult = 1; r.useUltimate(); })()");
  await sleep(200);
  const zip1 = await ev<number>(page, "window.__range.ziplineCount()");
  await ev(page, "window.__range.duel().leave()");
  await sleep(300);
  const zip2 = await ev<number>(page, "window.__range.ziplineCount()");
  check("kits: HOOK's ZIP LINE puts a rope up in play, and it comes down with the match", zip1 === zip0 + 1 && zip2 === zip0, JSON.stringify({ zip0, zip1, zip2 }));
  await ev(page, `(() => { const s = document.getElementById("botAbilities"); s.value = "1"; s.dispatchEvent(new Event("change")); window.__range.startBots(); })()`);
  await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 20000 }).catch(() => undefined);
  await ev(page, "(() => { const d = window.__range.duel(); if (d) d.holdFire = true; })()");
  check("kits: a bot with a full meter and someone to fight uses its own ultimate (RUNNER: it moves faster)", !!botUlt && botUlt.speed === botUlt.base && !!botAfter && botAfter.speed > botAfter.base * 1.2, JSON.stringify({ botUlt, botAfter }));
  await ev(page, "window.__range.duel().leave()");
  await ev(page, `(() => { const s = document.getElementById("botAbilities"); s.value = "0"; s.dispatchEvent(new Event("change")); })()`);

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
  const out = await page.waitForFunction("window.__range.duel() && !window.__range.duel().alive", { polling: 100, timeout: 30000 }).then(() => true, () => false);
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

/**
 * Throwables: G readies one and again the next; a frag at a bot's feet takes
 * its shield and a quarter of its health; thermite under it burns it; and
 * over the local transport a friend's arc star sticks to you, goes off, slows
 * you, and you saw it thrown.
 */
async function throwTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  await ev(page, `(() => { document.getElementById("botCount").value = "1"; document.getElementById("botDifficulty").value = "easy"; window.__range.startBots(); })()`);
  await pressPlay(page);
  await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 15000 });
  // the bot stands still on open ground 6 m in front of you, and does not shoot
  await ev(page, `(() => { const r = window.__range; const d = r.duel(); const b = d.bots[0]; b.update = function (now, dt) { this.dummy.update(now, dt); return []; }; b.pos.set(90, 0, -1); b.dummy.group.position.copy(b.pos); r.player.teleport(90, 0, 5, 0); })()`);
  const kit = await ev<{ counts: Record<string, number>; endless: boolean }>(page, "({ counts: { ...window.__range.ordnance.counts }, endless: window.__range.ordnance.endless })");
  check("throwables: a bot match gives one of each and counts them", !kit.endless && kit.counts.frag === 1 && kit.counts.arcstar === 1 && kit.counts.thermite === 1, JSON.stringify(kit));
  // the key itself (a scripted page has no pointer lock: the lock flag stands in)
  await ev(page, "window.__range.input.locked = true");
  await page.keyboard.press("KeyG");
  await sleep(150);
  const first = await ev<string | null>(page, "window.__range.ordnance.readied?.kind ?? null");
  await page.keyboard.press("KeyG");
  await sleep(150);
  const second = await ev<string | null>(page, "window.__range.ordnance.readied?.kind ?? null");
  check("throwables: G readies the frag, again the arc star", first === "frag" && second === "arcstar", `${first} then ${second}`);
  const lowered = await ev<string>(page, "window.__range.hud.last?.ordnance?.readied ?? ''");
  check("throwables: the HUD names the one in hand", /STAR/.test(lowered), lowered);
  await ev(page, "(() => { window.__range.ordnance.readied = null; window.__range.input.locked = false; })()");
  // a frag at its feet: the full 100 (its 75 shield, then 25 health)
  const blasts0 = await ev<number>(page, "window.__range.blasts()");
  await ev(page, `(() => { const r = window.__range; const b = r.duel().bots[0]; r.throwAt("frag", new r.THREE.Vector3(b.pos.x, 0.3, b.pos.z + 0.6), new r.THREE.Vector3(0, 0, 0)); })()`);
  await sleep(3500);
  const pre = await ev<number>(page, "(() => { const a = window.__range.duel().avatars[0]; return a.health + a.shield; })()");
  await sleep(1100);
  const post = await ev<{ hp: number; sh: number }>(page, "(() => { const a = window.__range.duel().avatars[0]; return { hp: a.health, sh: a.shield }; })()");
  check("throwables: nothing before the 4 s fuse; then a frag at its feet takes 100 (75 shield, 25 health)", pre === 175 && post.sh === 0 && post.hp === 75, JSON.stringify({ pre, ...post }));
  const blasts1 = await ev<number>(page, "window.__range.blasts()");
  check("throwables: the blast leaves a scorch and a column of smoke", blasts1 === blasts0 + 1, `${blasts0} -> ${blasts1}`);
  // thermite under it: 4 a tick, twice a second
  await ev(page, `(() => { const r = window.__range; const b = r.duel().bots[0]; r.throwAt("thermite", new r.THREE.Vector3(b.pos.x, 0.3, b.pos.z + 0.4), new r.THREE.Vector3(0, -2, -0.5)); })()`);
  await sleep(2100);
  const burnt = await ev<number>(page, "window.__range.duel().avatars[0].health");
  check("throwables: thermite under it burns it, 4 a tick", burnt <= 75 - 12 && burnt >= 75 - 24, `health ${burnt}`);
  // the throw takes the click: the gun in hand does not fire with it (it used to, the same frame)
  await ev(page, "(() => { window.__range.input.locked = true; window.__range.player.teleport(90, 0, 12, 180); })()");
  await page.keyboard.press("KeyG");
  await sleep(700);
  const clip0 = await ev<number>(page, "window.__range.loadout.active.state.clip");
  await ev(page, "(() => { window.__pad.buttons[7].pressed = true; window.__pad.buttons[7].value = 1; })()");
  await sleep(350);
  await ev(page, "(() => { window.__pad.buttons[7].pressed = false; window.__pad.buttons[7].value = 0; })()");
  const thrown = await ev<{ live: number; clip: number }>(page, "({ live: window.__range.throwables.live.filter((t) => t.mine && t.kind === 'frag').length, clip: window.__range.loadout.active.state.clip })");
  check("throwables: a click throws the grenade and the gun does not fire with it", thrown.live >= 1 && thrown.clip === clip0, JSON.stringify({ clip0, ...thrown }));
  await ev(page, "window.__range.input.locked = false");

  await ev(page, "window.__range.duel().leave()");
  await sleep(200);
  // Sound captions: what you would have heard, written down (src/game/captions.ts)
  {
    const caps = await ev<{ lines: Array<{ text: string; where: string; range: string }>; mode: string }>(
      page,
      `new Promise((ok) => { const r = window.__range; const sel = document.getElementById("accCaptions");
        sel.value = "important"; sel.dispatchEvent(new Event("change"));
        const me = r.player.pos;
        // a door heard away to one side, and a gun the other way
        r.audio.door({ x: me.x - 20, y: me.y, z: me.z }, "open");
        r.audio.gun("rspn101", { x: me.x + 60, y: me.y, z: me.z }, 1);
        setTimeout(() => ok({ lines: r.hud.last?.captions ?? [], mode: sel.value }), 300); })`
    );
    const door = caps.lines.find((l) => l.text === "DOOR");
    const gun = caps.lines.find((l) => l.text === "GUNFIRE");
    check("captions: a door and a gunshot are written down with which way they came from and how far", !!door && !!gun && door.where !== gun.where && !!door.range && !!gun.range, JSON.stringify(caps));
    const off = await ev<number>(
      page,
      `new Promise((ok) => { const r = window.__range; const sel = document.getElementById("accCaptions");
        sel.value = "off"; sel.dispatchEvent(new Event("change"));
        r.audio.door({ x: r.player.pos.x - 5, y: r.player.pos.y, z: r.player.pos.z }, "open");
        setTimeout(() => ok((r.hud.last?.captions ?? []).length), 250); })`
    );
    check("captions: off writes nothing down at all", off === 0, `${off} lines`);
  }
  // Tab, held: what you are carrying, in one place (src/game/hud.ts drawInventory)
  {
    await ev(page, "window.__range.input.locked = true");
    await page.keyboard.down("Tab");
    await sleep(250);
    const inv = await ev<{ guns: number; inHand: string | null; attach: number; ammo: number; armor: string } | null>(
      page,
      `(() => { const i = window.__range.hud.last?.inventory ?? null; if (!i) return null;
        const hand = i.guns.find((g) => g.inHand) ?? null;
        return { guns: i.guns.length, inHand: hand ? hand.name : null, attach: hand ? hand.attach.length : 0, ammo: i.ammo.length, armor: i.armor }; })()`
    );
    await page.keyboard.up("Tab");
    await sleep(200);
    const closed = await ev<boolean>(page, "(window.__range.hud.last?.inventory ?? null) === null");
    check("the pack: holding Tab shows both guns, the build in hand and what ammo you have", !!inv && inv.guns === 2 && !!inv.inHand && inv.attach >= 1 && /SHIELD/.test(inv.armor), JSON.stringify(inv));
    check("and letting go puts it away", closed);
    await ev(page, "window.__range.input.locked = false");
  }
  const range = await ev<{ endless: boolean; live: number }>(page, "({ endless: window.__range.ordnance.endless, live: window.__range.throwables.live.length + window.__range.throwables.fires.length })");
  check("throwables: back in the range, no count and nothing left burning", range.endless && range.live === 0, JSON.stringify(range));

  // ---- PAINT: the patch, and what you carry off it (src/config/paint.json)
  await ev(page, `(() => { const r = window.__range; r.player.teleport(0, 0, -6, 180); r.throwAt("speedpaint", new r.THREE.Vector3(0, 0.4, -8), new r.THREE.Vector3(0, -1, 0)); })()`);
  await sleep(600);
  const splat = await ev<{ patches: number; kind: string | null; wall: boolean | null }>(
    page,
    `(() => { const p = window.__range.throwables.paints; return { patches: p.length, kind: p[0]?.kind ?? null, wall: p[0]?.wall ?? null }; })()`
  );
  check("paint: a bomb on the floor leaves a patch of the right colour", splat.patches === 1 && splat.kind === "speed" && splat.wall === false, JSON.stringify(splat));
  // stand in it: the top speed rises, and it is still rising a moment after you leave
  const boosted = await ev<{ on: number; off: number; away: number }>(
    page,
    `new Promise((ok) => { const r = window.__range; const p = r.throwables.paints[0]; r.player.teleport(p.at.x, p.at.y, p.at.z, 180);
      setTimeout(() => { const t = r.gameTime(); const on2 = r.player.paintSpeed(t);
        r.player.teleport(p.at.x, p.at.y, p.at.z + 12, 180); ok({ on: on2, off: r.player.paintSpeed(t + 0.2), away: r.player.paintSpeed(t + 3) }); }, 320); })`
  );
  check("paint: standing on the orange boosts you, and the boost carries off it before it fades", boosted.on > 1.2 && boosted.off > 1.2 && boosted.away === 1, JSON.stringify(boosted));
  const boostSeen = await ev<string | null>(page, `window.__range.hud.last?.boost ?? null`);
  check("paint: the HUD's speed readout says a boost is on", boostSeen === "speed", String(boostSeen));
  // the blue: a jump that leaves from it goes higher than the same jump without it
  const jumps = await ev<{ plain: number; painted: number }>(
    page,
    `(() => { const r = window.__range; const now = r.gameTime();
      r.player.paintSpeedAt = -Infinity; r.player.paintJumpAt = -Infinity;
      const plain = r.player.paintJump(now);
      r.player.onPaint("jump", now);
      return { plain, painted: r.player.paintJump(now) }; })()`
  );
  check("paint: a jump off the blue is higher, and an ordinary jump is untouched", jumps.plain === 1 && jumps.painted > 1.2, JSON.stringify(jumps));

  await page.close();

  // ---- a friend's arc star, over the local transport
  const host = await open(browser, "?net=local&norender");
  const guest = await open(browser, "?net=local&norender");
  await ev(host, `document.getElementById("duelHost").click()`);
  let code = "";
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
  } catch {
    check("throwables: a 1v1 to throw in", false);
    await host.close();
    await guest.close();
    return;
  }
  await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
  for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  for (const p of [host, guest]) await pressPlay(p);
  for (const p of [host, guest]) await p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 20000 });
  await sleep(600);
  // at the guest's chest, from a metre in front of them: it sticks (+10), then 75
  await ev(host, `(() => { const r = window.__range; const g = r.duel().avatars[0].group.position; r.throwAt("arcstar", new r.THREE.Vector3(g.x, g.y + 1.2, g.z - 1.1), new r.THREE.Vector3(0, 0, 6)); })()`);
  const seen = await guest.waitForFunction("window.__range.throwables.live.some((t) => t.kind === 'arcstar' && !t.mine)", { polling: 50, timeout: 3000 }).then(() => true, () => false);
  check("throwables: the guest sees the host's arc star in the air", seen);
  const hit = await guest.waitForFunction("window.__range.duel().shield + window.__range.duel().health <= 175 - 80", { polling: 100, timeout: 6000 }).then(() => true, () => false);
  const g1 = await ev<{ sh: number; hp: number; slowed: number }>(guest, "(() => { const d = window.__range.duel(); return { sh: d.shield, hp: d.health, slowed: window.__range.player.arcSlowUntil - window.__range.gameTime() }; })()");
  check("throwables: it sticks to the guest and goes off: 10 and 75, and they are slowed", hit && g1.sh + g1.hp === 175 - 85 && g1.slowed > 2, JSON.stringify(g1));
  await ev(guest, "window.__range.duel()?.leave()");
  await host.waitForFunction("window.__range.duel() === null", { polling: 200, timeout: 8000 }).catch(() => undefined);
  await host.close();
  await guest.close();
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
  const ORDER = ["move", "sprint", "slide", "jump", "mantle", "climb", "superglide", "shoot", "reload", "swap", "heal", "ability", "grenade"];
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
  // the ability, then a grenade
  await ev(t, `(() => { window.__range.pickAbility("jolt"); window.__range.useAbility(); })()`);
  check("tour: ABILITY done with a JOLT", await stepTo("ability"), String(await step()));
  // the real G and the trigger (after the heal step, G used to be dead: the heal never ended)
  // the cell started at the heal step finishes first (a grenade cannot come out mid-heal)
  await t.waitForFunction("!window.__range.hud.last?.heal", { polling: 100, timeout: 6000 }).catch(() => undefined);
  await ev(t, "window.__range.input.locked = true");
  await t.keyboard.press("KeyG");
  await sleep(700);
  await padTap(t, 7, 250);
  const finished = await t.waitForFunction("window.__range.tour.stepId === null && localStorage.getItem('range.tour.done') === '1'", { polling: 100, timeout: 5000 }).then(() => true, () => false);
  check("tour: GRENADE, and the tour is complete (remembered)", finished, String(await step()));
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
  await dashChecks(page);
  // the plates' line-of-sight test, on known geometry: the backstop is at z -106.75
  const los = await ev<{ open: boolean; wall: boolean }>(page, `(() => { const r = window.__range; r.player.teleport(0, 0, 0, 0, 0); const T = r.THREE; return { open: r.clearTo(new T.Vector3(0, 1.2, -50)), wall: r.clearTo(new T.Vector3(0, 1.2, -110)) }; })()`);
  check("plates: the line of sight is clear down the range and blocked through the backstop", los.open && !los.wall, JSON.stringify(los));
  await readmeTvChecks(page);
  await page.close();
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

/** the dash's settings reach the dash itself, and the card stops claiming the old numbers */
async function dashChecks(page: Page): Promise<void> {
  const set = await ev<{ distance: number; charges: number; blurb: string }>(
    page,
    `(() => { const r = window.__range; r.setJolt({ distance: 22, duration: 0.1, charges: 3, recharge: 9 }); const j = r.jolt(); return { distance: j.distance, charges: j.charges, blurb: j.blurb }; })()`
  );
  check("dash: the settings reach the dash", set.distance === 22 && set.charges === 3, JSON.stringify({ d: set.distance, c: set.charges }));
  check("dash: the ability card stops claiming numbers the dash no longer has", /22 m/.test(set.blurb) && /3 charges/.test(set.blurb) && /9 s/.test(set.blurb), set.blurb);
  // across the open floor past the last target bank, so nothing caps the reach
  const went = async (d: number): Promise<number> => {
    await ev(page, `(() => { const r = window.__range; r.setJolt({ distance: ${d}, duration: 0.14, charges: 2, recharge: 4 }); r.player.teleport(-25, 0, -95, -90, 0); r.abilities.fill(); r.pickAbility("jolt"); r.useAbility(); })()`);
    await sleep(400);
    return Math.abs((await ev<number>(page, "window.__range.player.pos.x")) + 25);
  };
  const short = await went(6);
  const long = await went(20);
  check("dash: a 20 m dash goes further than a 6 m one", long > short + 6, `${short.toFixed(1)} m then ${long.toFixed(1)} m`);
  await ev(page, "window.__range.setJolt({ distance: 10, duration: 0.14, charges: 2, recharge: 4 })");
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
  const tr = await ev<{ first: { len: number; width: number; off: number } | null; later: { off: number; travelled: number } | null }>(page, `new Promise((ok) => { const r = window.__range; r.fireRound([0, 0.01, -1]); let first = null;
    const look = () => { const t = r.tracers(); if (!t.length) return ok({ first, later: null }); const x = t[t.length - 1]; if (!first && x.travelled > 0.5) first = x; if (x.travelled > 12) return ok({ first, later: x }); requestAnimationFrame(look); };
    requestAnimationFrame(look); })`);
  check("tracers: a streak a metre or more long, and on the real path once it is clear of the gun", !!tr.first && tr.first.len >= 1 && tr.first.width >= 0.02 && (!tr.later || tr.later.off < 0.05), JSON.stringify(tr));
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
  await ev(page, `(() => { const r = window.__range; r.player.teleport(0, 0, -98, 0, 0); r.readmeTv.goto(0, 0); })()`);
  await sleep(200);
  const start = await tv();
  check(
    "README screen: the range's own README, in sections and pages",
    start.sections.length > 8 && start.pages >= 1 && /range/i.test(start.title),
    `${start.sections.length} sections, "${start.title}" is ${start.pages} page(s)`
  );
  const text = await ev<string>(page, "window.__range.readmeTv.pageText()");
  // the words of the opening change as the game does; what has to hold is that
  // the screen is showing THIS file rather than a placeholder
  check("README screen: the first page is the README's own text", /browser (shooter|firing range)/i.test(text) && text.includes("Apex Legends"), text.slice(0, 80).replace(/\n/g, " "));

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
  // the ability card takes D-pad left and right while it is up: left picks JOLT, and readies no grenade or fire mode
  const cp = await open(browser, query);
  await pressPlay(cp);
  await ev(cp, `(() => { const s = document.getElementById("botAbilities"); s.value = "1"; s.dispatchEvent(new Event("change")); document.getElementById("botCount").value = "1"; window.__range.startBots(); })()`);
  await cp.waitForFunction("window.__range.abilities.choosing === true", { polling: 100, timeout: 5000 });
  await padTap(cp, 14);
  const cardPick = await ev<{ picked: string | null; nade: unknown }>(cp, "({ picked: window.__range.abilities.picked, nade: window.__range.ordnance.readied })");
  check("pad: with the card up, D-pad left picks JOLT (and nothing else)", cardPick.picked === "jolt" && !cardPick.nade, JSON.stringify(cardPick));
  await ev(cp, `(() => { window.__range.duel()?.leave(); const s = document.getElementById("botAbilities"); s.value = "0"; s.dispatchEvent(new Event("change")); })()`);
  await cp.close();
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

/** the lobby row's rules, the way a pick would set them */
const brRules = (rules: "br" | "resurgence"): string => `(() => { const r = document.getElementById("brRules"); r.value = "${rules}"; r.dispatchEvent(new Event("change")); })()`;

/**
 * Resurgence (src/game/resurgence.ts). Alone: the lobby's choice reaches the
 * match with its faster ring; a death is not the end, the wait is on the
 * screen, and when it runs out you come back from the sky with a sidearm,
 * its ammo and heals; a bot killed comes back too; from the round where
 * deaths go final, a death ends it. As a squad: the guest dies, the host's
 * kill cuts the guest's wait, the guest comes back near the host, and both
 * down at once is the squad out.
 */
async function resurgenceTest(browser: Browser, query: string, squadQuery: string): Promise<void> {
  const R = brCfg.resurgence;
  const page = await open(browser, query);
  await ev(page, brRow("solo", 3));
  await ev(page, brRules("resurgence"));
  await ev(page, `(() => { document.getElementById("brStart").value = "loot"; document.getElementById("goBr").click(); document.getElementById("startMode").click(); })()`);
  await sleep(400);
  await ev(page, "window.__range.duel().holdFire = true");
  const fight = await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 30000 }).then(() => true, () => false);
  const on = await ev<{ rules: string; rs: { live: boolean; toFinal: number; redeployIn: number | null } | null; wait: number }>(
    page,
    "(() => { const d = window.__range.duel(); return { rules: d.rules, rs: d.hud().br.resurgence, wait: d.phases[0].wait }; })()"
  );
  check(
    "resurgence: the lobby's choice reaches the match, with a faster ring and the clock to final deaths on the HUD",
    fight && on.rules === "resurgence" && !!on.rs && on.rs.live && on.rs.toFinal > 60 && on.rs.redeployIn === null && Math.abs(on.wait - ringCfg.phases[0].wait * R.ringScale) < 1e-6,
    JSON.stringify(on)
  );
  // a quarter of the map: the first circle is the area, and the squad drops inside it
  const area = await ev<{ r: number; poiIn: boolean; bots: number; botsIn: number }>(page, `(() => { const d = window.__range.duel(); const a = d.area; const inA = (x, z) => Math.hypot(x - a.cx, z - a.cz) <= a.r; return { r: d.ringState.current.r, poiIn: inA(d.poi.x, d.poi.z), bots: d.bots.length, botsIn: d.bots.filter((b) => inA(b.dropTo.x, b.dropTo.z)).length }; })()`);
  check("resurgence: played on a quarter of the map: the first circle is the area, and everyone drops inside it", area.r === R.area.radius && area.poiIn && area.botsIn === area.bots, JSON.stringify(area));
  // alone, a knock is the end of a life, not of the match
  await ev(page, "(() => { const d = window.__range.duel(); d.takeHit(1000, d.bots[0].bot.remote.id); })()");
  await sleep(600);
  const dead = await ev<{ alive: boolean; phase: string; wait: number | null }>(page, "(() => { const d = window.__range.duel(); return { alive: d.alive, phase: d.phase, wait: d.hud().br.resurgence.redeployIn }; })()");
  check(`resurgence: alone, a death is not the end: the match goes on and the wait is ${R.redeploy[0]} s`, !dead.alive && dead.phase === "fight" && dead.wait !== null && dead.wait > R.redeploy[0] - 2 && dead.wait <= R.redeploy[0], JSON.stringify(dead));
  // the wait, run down: back from the sky with a sidearm, its ammo and heals
  await ev(page, "window.__range.duel().selfRedeploy.left = 0.3");
  const back = await page.waitForFunction("window.__range.duel().alive && window.__range.player.dropping", { polling: 50, timeout: 5000 }).then(() => true, () => false);
  const kit = await ev<{ y: number; gun: string | null; heals: number; ammo: number; inRing: boolean }>(
    page,
    `(() => { const R = window.__range; const d = R.duel(); const g = R.loadout.slots.find((s) => !s.empty); const c = d.hud().br.ring.current; const p = R.player.pos;
      // an energy sidearm's rounds are its own stockpile, not the reserve
      return { y: p.y, gun: g ? g.id : null, heals: R.kit.total, ammo: Object.values(R.loadout.ammo.stock).reduce((a, n) => a + n, 0) + (g && g.energy ? g.energy.rounds : 0), inRing: Math.hypot(p.x - c.cx, p.z - c.cz) < c.r }; })()`
  );
  check("resurgence: the wait over, you come back from the sky, inside the ring, with a sidearm, its ammo and heals", back && kit.y > 40 && kit.inRing && R.kit.includes(kit.gun ?? "") && kit.ammo > 0 && kit.heals >= 4, JSON.stringify(kit));
  // a bot killed comes back too
  const victim = await ev<number>(page, "window.__range.duel().bots.find((b) => b.bot.alive).bot.remote.id");
  await ev(page, `window.__range.hitThrough(${victim}, 500)`);
  const waiting = await ev<{ alive: boolean; wait: number | null }>(page, `(() => { const b = window.__range.duel().bots.find((x) => x.bot.remote.id === ${victim}); return { alive: b.bot.alive, wait: b.redeploy ? b.redeploy.left : null }; })()`);
  await ev(page, `window.__range.duel().bots.find((x) => x.bot.remote.id === ${victim}).redeploy.left = 0.2`);
  const botBack = await page.waitForFunction(`(() => { const b = window.__range.duel().bots.find((x) => x.bot.remote.id === ${victim}); return b.bot.alive && b.bot.dropping; })()`, { polling: 50, timeout: 5000 }).then(() => true, () => false);
  check("resurgence: a bot killed waits too, then comes back from the sky", !waiting.alive && waiting.wait !== null && waiting.wait > 10 && botBack, JSON.stringify({ waiting, botBack }));
  // the round where deaths go final: said once, and a death now is the end
  await ev(page, `(() => { const d = window.__range.duel(); d.ring.phase = ${R.endPhase}; d.ring.state = "waiting"; d.ring.timeLeft = 60; })()`);
  const said = await page.waitForFunction("window.__range.duel().hud().br.resurgence.live === false", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  await ev(page, "(() => { const d = window.__range.duel(); d.takeHit(1000, d.bots.find((b) => b.bot.alive).bot.remote.id); })()");
  const ended = await page.waitForFunction(`window.__range.duel() === null || window.__range.duel().phase === "matchEnd"`, { polling: 100, timeout: 5000 }).then(() => true, () => false);
  check(`resurgence: from ring ${R.endPhase + 1} every death is final, and a death then ends it`, said && ended, JSON.stringify({ said, ended }));
  await page.close();

  // ---- a squad: a kill by the host cuts the guest's wait, and the guest comes back near the host
  const host = await open(browser, squadQuery);
  const guest = await open(browser, squadQuery);
  await ev(host, brRow("duo", 2));
  await ev(host, brRules("resurgence"));
  await ev(guest, brRules("br"));
  await ev(host, `(() => { document.getElementById("duelMode").value = "br"; document.getElementById("duelHost").click(); })()`);
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    for (const pg of [host, guest]) await pg.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  } catch {
    check("resurgence: a squad connects", false);
    await host.close();
    await guest.close();
    return;
  }
  const rules = await Promise.all([host, guest].map((pg) => ev<string>(pg, "window.__range.duel().rules")));
  check("resurgence: the host's rules are the guest's, whatever the guest's own row says", rules[0] === "resurgence" && rules[1] === "resurgence", JSON.stringify(rules));
  for (const pg of [host, guest]) await pressPlay(pg);
  await ev(host, "window.__range.duel().holdFire = true");
  await Promise.all([host, guest].map((pg) => pg.waitForFunction(`window.__range.duel().phase === "fight" && !window.__range.player.dropping`, { polling: 200, timeout: 30000 }).catch(() => undefined)));
  // the guest goes down and bleeds out
  await ev(guest, "(() => { const d = window.__range.duel(); d.takeHit(500, 100); })()");
  await sleep(400);
  await ev(guest, "(() => { const d = window.__range.duel(); d.bleedUntil = performance.now() / 1000; })()");
  const gDead = await guest.waitForFunction("!window.__range.duel().alive && window.__range.duel().selfRedeploy !== null", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  const w0 = await ev<number>(guest, "window.__range.duel().selfRedeploy.left");
  // the host kills a bot: the guest's wait is cut
  const target = await ev<number>(host, "window.__range.duel().bots.find((b) => b.bot.alive).bot.remote.id");
  await ev(host, `window.__range.hitThrough(${target}, 500)`);
  await sleep(700);
  const w1 = await ev<number>(guest, "window.__range.duel().selfRedeploy ? window.__range.duel().selfRedeploy.left : -1");
  check(`resurgence: the guest is out and waiting, and the host's kill takes ${R.killCut} s off the guest's wait`, gDead && w1 > 0 && w0 - w1 >= R.killCut - 0.2 && w0 - w1 < R.killCut + 1.5, `${w0.toFixed(1)} -> ${w1.toFixed(1)}`);
  await ev(guest, "window.__range.duel().selfRedeploy.left = 0.3");
  const gBack = await guest.waitForFunction("window.__range.duel().alive && window.__range.player.dropping", { polling: 50, timeout: 5000 }).then(() => true, () => false);
  const near = await Promise.all([host, guest].map((pg) => ev<{ x: number; z: number }>(pg, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })")));
  const gap = Math.hypot(near[0].x - near[1].x, near[0].z - near[1].z);
  const hostSees = await host.waitForFunction("window.__range.duel().remotes.get(1)?.alive === true", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  check("resurgence: the guest comes back from the sky near the host, and the host sees them back", gBack && gap >= 5 && gap <= R.spread + 12 && hostSees, `${gap.toFixed(1)} m apart`);
  // both down at once: nobody left to come back to, the squad is out
  await ev(host, "(() => { const d = window.__range.duel(); d.takeHit(500, 100); })()");
  await ev(guest, "(() => { const d = window.__range.duel(); d.takeHit(500, 100); })()");
  const out = await Promise.all([host, guest].map((pg) => pg.waitForFunction(`window.__range.duel() === null || window.__range.duel().phase === "matchEnd"`, { polling: 100, timeout: 6000 }).then(() => true, () => false)));
  check("resurgence: both down at once is the squad out", out[0] && out[1], JSON.stringify(out));
  // the browser's stored choice back to the battle royale for whatever runs next
  await ev(host, brRules("br"));
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
  const fighting = await page.waitForFunction("window.__range.duel().gulag && window.__range.duel().gulag.phase === 'fight' && window.__range.duel().canFire", { polling: 100, timeout: (G.countdown + 3) * 1000 }).then(() => true, () => false);
  check(`the Gulag: ${G.countdown} s of countdown, then the fight, guns live`, fighting);
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
  const taking = await p2.waitForFunction("window.__range.duel().gulag && window.__range.duel().gulag.capThem > 1", { polling: 100, timeout: 6000 }).then(() => true, () => false);
  const lost = await p2.waitForFunction(`window.__range.duel() === null || window.__range.duel().phase === "matchEnd"`, { polling: 100, timeout: (G.capture + 8) * 1000 }).then(() => true, () => false);
  check("the Gulag: past its clock, overtime's flag; the bot holds it alone, and you are out", ot && taking && lost, JSON.stringify({ ot, taking, lost }));
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
  // the host brings them back at a beacon meanwhile: that is their way back, and the trip is over
  await ev(host, `(() => { const r = window.__range; r.duel().sendRespawn(1, new r.THREE.Vector3(0, 0, 500)); })()`);
  const rescued = await guest.waitForFunction("!window.__range.duel().gulag && window.__range.duel().alive && window.__range.player.dropping", { polling: 100, timeout: 5000 }).then(() => true, () => false);
  const hostLeft = await host.waitForFunction("!window.__range.duel().gulagIds.has(1)", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  check("the Gulag: a squad mate's beacon brings you back out of it, and the host hears the trip is over", rescued && hostLeft, JSON.stringify({ rescued, hostLeft }));
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
  await ev(host, `(() => { const d = window.__range.duel(); d.ladder.row(${otherId}).kills = 3; d.modeSendNext = 0; })()`);
  await heir.waitForFunction(`window.__range.duel().ladder.row(${otherId}).kills === 3`, { polling: 100, timeout: 4000 }).catch(() => undefined);
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
  const after = await ev<{ phase: string; kills: number; left: number; linked: boolean; held: boolean; oldGone: boolean }>(heir, `(() => { const d = window.__range.duel(); return { phase: d.phase, kills: d.ladder.row(${otherId}).kills, left: d.clockLeft(performance.now() / 1000), linked: d.links.has(${otherId}), held: d.held.has(${otherId}), oldGone: !d.remotes.has(0) }; })()`);
  const expected = before - (Date.now() - beforeAt) / 1000;
  const flow = await Promise.all([
    ev<number>(heir, `performance.now() / 1000 - window.__range.duel().remotes.get(${otherId}).lastHeard`),
    ev<number>(other, `performance.now() / 1000 - window.__range.duel().remotes.get(${heirId}).lastHeard`),
  ]);
  const otherView = await ev<{ phase: string; kills: number; oldGone: boolean }>(other, `(() => { const d = window.__range.duel(); return { phase: d.phase, kills: d.ladder.row(${otherId}).kills, oldGone: !d.remotes.has(0) }; })()`);
  check(
    `${label}: the match goes on, its score and clock carried over, the old host gone and the two hearing each other`,
    after.phase === "fight" && otherView.phase === "fight" && after.kills === 3 && otherView.kills === 3 && Math.abs(after.left - expected) < 2 && after.linked && !after.held && after.oldGone && otherView.oldGone && flow[0] < 1.5 && flow[1] < 1.5,
    JSON.stringify({ after, otherView, expected, flow })
  );
  if (bots > 0) {
    // the bots: the same ones, made again on the heir, and still moving on the other guest's screen
    const botsAfter = await ev<string>(heir, botsOf);
    const botFlow = await ev<number>(other, "Math.max(...[...window.__range.duel().remotes.values()].filter((r) => r.id >= 100).map((r) => performance.now() / 1000 - r.lastHeard))");
    const figures = await ev<number>(heir, "[...window.__range.duel().remotes.keys()].filter((id) => id >= 100).length");
    const extra = kind === "control" ? await ev<{ zones: number; heirZones: number }>(heir, "(() => { const d = window.__range.duel(); return { zones: d.control ? d.control.zones.length : 0, heirZones: d.control ? 1 : 0 }; })()") : null;
    check(`${label}: the bots are the same ones, each with its tier and team, run by the new host, and heard from on the other guest's screen`, botsBefore.length > 0 && botsAfter === botsBefore && figures === 0 && botFlow < 1.5 && (!extra || extra.zones === 3), JSON.stringify({ botsBefore, botsAfter, figures, botFlow, extra }));
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
  await ev(host, `(() => { document.getElementById("brSides").value = "together"; document.getElementById("botDifficulty").value = "mixed"; document.getElementById("duelMode").value = "br"; document.getElementById("duelPlayers").value = "3"; document.getElementById("duelHost").click(); })()`);
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    for (const p of [b, c]) {
      await ev(p, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
      await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
    }
    await host.waitForFunction("window.__range.duel()?.connected === 2", { polling: 200, timeout: 30000 });
    for (const p of pages) await pressPlay(p);
    for (const p of pages) await p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 60000 });
    await ev(host, "window.__range.duel().holdFire = true");
    // every bot down on the map, and the heir named with a snapshot to take over from
    await host.waitForFunction("window.__range.duel().heir !== null", { polling: 250, timeout: 60000 });
    // most of the bots with a gun they found, and the ring closing: the state worth carrying over
    await host.waitForFunction("window.__range.duel().bots.filter((x) => x.bot.lootKit.gunId).length >= 4", { polling: 500, timeout: 60000 });
    await ev(host, "(() => { const r = window.__range.duel().ring; if (r.state === 'waiting') r.timeLeft = Math.min(r.timeLeft, 1); })()");
    await host.waitForFunction("window.__range.duel().view.state === 'closing'", { polling: 200, timeout: 10000 });
  } catch {
    const why = await ev<unknown>(host, "(() => { const d = window.__range.duel(); return d ? { phase: d.phase, heir: d.heir, over: d.brOver, bots: d.bots.map((x) => [x.landed, x.bot.alive, x.bot.aboard, x.bot.dropping]) } : null; })()").catch(() => null);
    check(`${label}: the three drop and the host names an heir once the bots are down`, false, JSON.stringify(why));
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
  const kitSame = after.kits.filter((k, i) => k === kits[i]).length;
  check(
    `${label}: the same bots, each with its tier and squad and (nearly all) the kit it had looted, run by the new host`,
    roster.length === 6 && after.roster.join() === roster.join() && after.figures === 0 && kitSame >= kits.length - 1 && kits.filter((k) => k.split(":")[1]).length >= 4 && after.phase === "fight",
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
  check("getting back in: the guest is back on its own seat, and the two hear each other again", back && seat.linked && !seat.held && hostNow - flow[0] < 1.5 && flow[1] < 1.5, JSON.stringify({ back, seat, t0, sinceGuest: hostNow - flow[0], sinceHost: flow[1] }));
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
  await ev(host, `(() => { document.getElementById("duelMode").value = "gunrun"; document.getElementById("duelMode").dispatchEvent(new Event("change")); document.getElementById("duelAgain").click(); })()`);
  const again = await Promise.all([host, guest].map((p) => p.waitForFunction(`window.__range.duel()?.modeKind === "gunrun"`, { polling: 200, timeout: 15000 }).then(() => true, () => false)));
  const who = await Promise.all([host, guest].map((p) => ev<{ role: string; id: number } | null>(p, "(() => { const d = window.__range.duel(); return d ? { role: d.role, id: d.id } : null; })()")));
  const kept = await Promise.all([host, guest].map((p) => ev<number>(p, `document.querySelectorAll("#tonight [data-name]").length`)));
  check("tonight's tally: Play again keeps it (a new code would start it over)", kept.every((n) => n === 2), JSON.stringify(kept));
  check("the group: the host's Play again puts both straight into Gun Run, on the links they had", again.every(Boolean) && who[0]?.role === "host" && who[1]?.role === "guest" && who[1]?.id === 1, JSON.stringify({ again, who }));
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
  for (let i = 0; i < 20; i++) {
    await sleep(1500);
    // only a squad out of a fight: one that has seen someone lately breaks formation to fight, as it should
    const spread = await ev<number[]>(page, `(() => { const d = window.__range.duel(); const now = performance.now() / 1000; const by = new Map(); const fighting = new Set();
      for (const b of d.bots) { if (!b.bot.alive) continue; if (!by.has(b.team)) by.set(b.team, []); by.get(b.team).push(b.bot.pos); if ((b.bot.lastSeen && now - b.bot.lastSeen.at < 8) || b.bot.travel) fighting.add(b.team); }
      return [...by.entries()].filter(([t]) => !fighting.has(t)).map(([, ps]) => { let m = 0; for (const a of ps) for (const c of ps) m = Math.max(m, Math.hypot(a.x - c.x, a.z - c.z)); return m; }); })()`);
    for (const m of spread) {
      samples++;
      if (m < 25) together++;
    }
  }
  // A squad walks with some slack (a follower closes in only past 12 m), so it
  // is not every sample: measured 60 to 100 per cent out of a fight with the
  // squad following its first bot, and nearer 37 without. A squad with a bot
  // in the air off a launch pad or on a rope is left out with the fighting
  // ones: it is apart for the length of the ride, then together again.
  check("bot squads: each squad out of a fight keeps together (within 25 m, most of the time)", samples >= 8 && together / samples >= 0.55, `${together} of ${samples} squad samples together`);
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

/** E2E_ONLY=bots,br runs only those sections (page, panel, duel, invite, triple, bots, pad, range, finish, throw, emote, br, loot, ship, console, resurgence, gulag, modes, hidden, brsolo, squad, p2p, mixed) */
/**
 * The intro card (src/ui/intro.ts). What has to hold: the page opens on it, it
 * plays on the page's own clock and takes itself away, a key or a click takes
 * the rest of it, the game underneath is never held up or blocked by it, one
 * plays again as a match starts, and `?nointro` means none at all.
 */
async function introTest(browser: Browser): Promise<void> {
  // the one page in the suite that opens with the card on
  const page = await open(browser, "?intro=on");
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
  // and it waits on the rain for the world rather than firing into a page that is still loading
  const held = await ev<{ waited: number; at: number; loaded: boolean }>(
    page,
    `new Promise((ok) => { const R = window.__range; const t0 = performance.now();
      const step = () => { const s = R.intro.state(); if (s.kind === null || s.at > s.beats.shot + 0.05 || performance.now() - t0 > 20000) ok({ waited: s.waited, at: s.at, loaded: R.loaded() }); else requestAnimationFrame(step); };
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

  await pick("br");
  const afterPick = await ev<{ mode: string; started: boolean }>(page, `({ mode: window.__range.menu.picked, started: !!window.__range.duel() })`);
  check("a card picks the mode and does not start it", afterPick.mode === "br" && !afterPick.started, JSON.stringify(afterPick));
  for (const id of ["range", "br", "bots", "gunrun", "run"]) {
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
  const page = await open(browser, "?norender&nointro");
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
  const page = await open(browser, "?norender&nointro");
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

const ONLY = (process.env.E2E_ONLY ?? "").split(",").filter(Boolean);
const want = (k: string): boolean => !ONLY.length || ONLY.includes(k);

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
    check("the loading screen counts the world in and goes once it is", inWorld && ls.hidden && /\d+ OF \d+/.test(ls.status) && ls.fill === "100%", JSON.stringify(ls));
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
      const before = await ev<{ locked: boolean; carbon: boolean; gun: string }>(page, `(() => { const s = document.getElementById("finish0"); const o = (v) => [...s.options].find((x) => x.value === v); return { locked: !!o("gold")?.disabled, carbon: !!o("carbon")?.disabled, gun: document.getElementById("slot0").value }; })()`);
      // the level reached, Gold chosen for the first slot's gun
      await ev(page, `(() => { const p = window.__range.progress; p.s.xp = 1e7; p.onChange?.(); const sel = document.getElementById("finish0"); sel.value = "gold"; sel.dispatchEvent(new Event("change")); })()`);
      await sleep(400);
      const worn = await ev<{ finish: string }>(page, `window.__range.gunFinish(${JSON.stringify(before.gun)})`);
      const shown = await ev<string>(page, `document.getElementById("finish0").value`);
      const drawn = await ev<string>(page, "window.__range.loadout.active.id");
      check("finishes: at level 1 Gold and Carbon are locked; at the level for it Gold is chosen for the first slot's gun, and that gun wears it in hand", before.locked && before.carbon && shown === "gold" && drawn === before.gun && worn.finish === "gold", JSON.stringify({ before, shown, worn, drawn }));
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
    check("choosing a loadout puts its weapons in the slots", w[0] === "r97" && w[1] === "mastiff", w.join(","));
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
    await ev(page, `document.getElementById("goArena").click(); document.getElementById("startMode").click()`);
    const ar = await ev<{ x: number; z: number }>(page, `({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })`);
    check("Arena alone: at the arena's first spawn", Math.abs(ar.x - 90) < 0.5 && Math.abs(ar.z + 69) < 0.5, JSON.stringify(ar));
    // put the default back for the 1v1 pages
    await ev(page, `[...document.querySelectorAll("#loadoutList button")].find((b) => b.textContent.startsWith("Assault")).click()`);
    await page.close();
    }

    if (want("duel")) {
      console.log("\n1v1 over the local transport (two tabs)");
      await duelTest(browser, "?net=local&norender", "local");
      console.log("\nA friend's figure over a jittery connection");
      await jitterTest(browser, "?net=local&norender&jitter=60");
      console.log("\nA friend's figure with state packets lost and out of order");
      await jitterTest(browser, "?net=local&norender&jitter=60&loss=0.15", true);
      console.log("\nCustom rules");
      await rulesTest(browser, "?net=local&norender");
    }

    if (want("intro")) {
      console.log("\nThe intro card: the name, the shot through the screen, and out of the way");
      await introTest(browser);
    }

    if (want("emote")) {
      console.log("\nEmotes: yours, the camera, a step to end it, a 1v1's host's on the guest's screen");
      await emoteTest(browser, "?norender", "?net=local&norender");
    }

    if (want("invite")) {
      console.log("\nInvite links");
      await inviteTest(browser, "?net=local&norender");
    }

    if (want("triple")) {
      console.log("\n1v1v1 over the local transport (three tabs)");
      await tripleTest(browser, "?net=local&norender");
      // ?deltas=0 puts a page on the full packets exactly as a build from
      // before the delta packets would be: it announces nothing and reads
      // nothing else. The host has to relay between the two forms.
      console.log("\n1v1v1 with one guest on the full packets (?deltas=0, as an older build)");
      await tripleTest(browser, "?net=local&norender", "1v1v1 mixed", [{}, {}, { extra: "&deltas=0", want: "full" }]);
      console.log("\nHanding the host over in the lobby");
      await handoverTest(browser, "?net=local&norender");
    }

    if (want("bots")) {
      console.log("\nArena, Bots");
      await botsTest(browser, "?norender");
      console.log("\nBot tiers");
      await botTiersTest(browser, "?norender");
      console.log("\nWhere you are being shot from");
      await damageDirTest(browser, "?norender");
    }

    if (want("pad")) {
      console.log("\nController");
      await padTest(browser, "?norender");
    }

    if (want("panel")) {
      console.log("\nThe lobby");
      await lobbyPanelTest(browser);
    }
    if (want("hold")) {
      console.log("\nHow a figure holds a gun");
      await holdTest(browser);
    }
    if (want("spray")) {
      console.log("\nThe spray, against what the range draws of it");
      await sprayTest(browser);
    }
    if (want("ping")) {
      console.log("\nA match at a real ping");
      await pingTest(browser, 30);
      await pingTest(browser, 60);
    }
    if (want("range")) {
      console.log("\nThe range's tooling");
      await rangeTest(browser, "?norender");
    }
    if (want("br")) {
      console.log("\nBattle royale against bots");
      await brTest(browser, "?norender");
      console.log("\nDoors");
      await doorTest(browser, "?norender");
      console.log("\nThe vault");
      await vaultTest(browser, "?norender");
    }

    if (want("loot")) {
      console.log("\nBattle royale: landing with nothing, the loot");
      await brLootTest(browser, "?norender");
    }

    if (want("ship")) {
      console.log("\nThe dropship: the ride, the jump, the end of the line, the bots, the jumpmaster");
      await shipTest(browser, "?norender", "?net=local&norender");
    }

    if (want("console")) {
      console.log("\nRing Consoles: the scan, the circle after next, the squad");
      await consoleTest(browser, "?norender", "?net=local&norender");
    }

    if (want("gulag")) {
      console.log("\nThe Gulag: in, the fight, the way back, one trip, overtime, a squad mate");
      await gulagTest(browser, "?norender", "?net=local&norender");
    }

    if (want("resurgence")) {
      console.log("\nResurgence: the wait, the way back, the bots, the final round, the squad");
      await resurgenceTest(browser, "?norender", "?net=local&norender");
    }

    if (want("finish")) {
      console.log("\nThe finishing touches: toggles, per-optic ADS, the controller, inspect, the first draw, the tour");
      await finishTest(browser, "?norender");
    }

    if (want("throw")) {
      console.log("\nThrowables: the frag, the arc star, thermite");
      await throwTest(browser, "?norender");
    }

    if (want("modes")) {
      console.log("\nThe arena's modes: Gun Run, team deathmatch, Crown (alone, against bots)");
      await modesTest(browser, "?norender");
      console.log("\nThe new arenas: the Vault, the Crossing, the Ringworks");
      await arenaMapsTest(browser, "?norender");
      console.log("\nGun Run with a friend (two tabs, the local transport)");
      await modesFriendsTest(browser, "?net=local&norender");
      await modesSplitTest(browser, "?net=local&norender");
      await friendsModesTest(browser, "?net=local&norender");
      await searchFriendsTest(browser, "?net=local&norender");
      await kitsFriendsTest(browser, "?net=local&norender");
      await lobbyTest(browser, "?net=local&norender");
      await lobbyShortTest(browser, "?net=local&norender");
    }

    if (want("hidden")) {
      console.log("\nA hidden host: the match runs on at 30 Hz from a worker, not at the background tab's one frame a second");
      await hiddenHostTest(browser, "?net=local&norender");
    }

    if (want("botsquads")) {
      console.log("\nBot squads: a trio of bots keeps together");
      await botSquadsTest(browser, "?norender");
    }

    if (want("brsolo")) {
      console.log("\nSolo with a friend: everyone against everyone, each placed on their own");
      await brSoloTest(browser, "?net=local&norender");
      console.log("\nSquads of friends: two duos against each other");
      await brSquadsTest(browser, "?net=local&norender");
      console.log("\nGetting back in after a dropped connection");
      await rejoinTest(browser, "?net=local&norender");
    }

    if (want("migrate")) {
      console.log("\nHost migration: the host's tab crashes and a friend takes the match over");
      await migrateTest(browser, "?net=local&norender");
      console.log("\nHost migration in team deathmatch, with bots");
      await migrateTest(browser, "?net=local&norender", "host migration (tdm)", "tdm", 6);
      console.log("\nHost migration in Control, with bots");
      await migrateTest(browser, "?net=local&norender", "host migration (control)", "control", 3);
      console.log("\nHost migration in a battle royale");
      await brMigrateTest(browser, "?net=local&norender");
    }

    if (want("squad")) {
      console.log("\nBattle royale as a squad (two tabs, the local transport)");
      await brSquadTest(browser, "?net=local&norender");
    }

    if (want("p2p")) {
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
      }
    }

    // An older build against this one, over the real peer to peer path:
    // OLD_URL is where the older build is served (a second dev server on an
    // older checkout, or the deployed site with ?broker=public, so both meet
    // on the public broker). Both ways round for the 1v1, and a 1v1v1 whose
    // host has to relay between the two. The deployed build has had the delta
    // packets since they shipped, so the two find each other and use them;
    // OLD_NET=full is for a build from before them, where both fall back to
    // the full packets.
    if (want("mixed")) {
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
    }

    check("no page errors anywhere", errors.length === 0, [...new Set(errors)].slice(0, 5).join(" | "));
  } finally {
    await browser.close();
  }
  console.log(fails === 0 ? "\nE2E PASS" : `\nE2E FAIL (${fails})`);
  process.exit(fails === 0 ? 0 : 1);
}

void main();
