// Pictures of the squad view (Phase 27), drawn for real from two pages in one
// SpeedKills squad over the local transport: the panel over your health, the
// name over your teammate, their ring through a wall, a hit on their row, the
// compass and the map, their trip to the Gulag, their ghost, their restore,
// and their leaving. The e2e sksquad section checks the same
// states without drawing; these are for looking at, and for the owner.
//
// Run: SHOT_URL=http://localhost:5198/ npx tsx tools/squad-shots.ts [out dir]
// (needs the dev server running; a real GPU, as tools/pack-frames.ts has)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import puppeteer, { type Browser, type Page } from "puppeteer";

const BASE = process.env.SHOT_URL ?? "http://localhost:5173/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = resolve(process.argv[2] ?? "shots/squad");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ev = <T>(page: Page, expr: string) => page.evaluate(expr) as Promise<T>;
/** the real mouse reaches a pointer-locked headless page: none of it here (input.ts's webdriver guard does the rest) */
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;

/**
 * A page. Both are in the one browser, as the local transport (a BroadcastChannel) reaches no other; a page behind
 * the other gets no animation frames, but its game runs on a timer, and shot() brings a page forward to draw it.
 */
async function open(browser: Browser, name: string): Promise<Page> {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.log(`${name} pageerror:`, String(e)));
  await page.evaluateOnNewDocument("window.__straightDrop = true");
  await page.evaluateOnNewDocument("window.__noVault = true");
  await page.evaluateOnNewDocument(() => localStorage.setItem("range.welcomed", "1"));
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  const url = `${BASE}${BASE.includes("?") ? "&" : "?"}net=local&game=speedkills&nointro`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("Boolean(window.__range) && window.__range.loaded()", { polling: 200, timeout: 90000 });
  await ev(page, `window.__range.profile.setName(${JSON.stringify(name)})`);
  return page;
}

/**
 * Start on a fake controller: a scripted page cannot take the pointer lock (tools/e2e.ts pressPlay). The pad is
 * plugged in first and Start pressed after, since a button held from the moment a pad appears is never a press.
 */
async function pressPlay(page: Page): Promise<void> {
  if (await ev<boolean>(page, "window.__range.input.playing")) return;
  await ev(page, `(() => {
    const btn = () => ({ pressed: false, touched: false, value: 0 });
    const pad = { index: 0, id: "fake pad", connected: true, mapping: "standard", timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn) };
    window.__pad = pad;
    navigator.getGamepads = () => [pad];
  })()`);
  await sleep(400);
  await ev(page, "window.__pad.buttons[9].pressed = true");
  await sleep(400);
  await ev(page, "window.__pad.buttons[9].pressed = false");
  await sleep(300);
}

const shots: Array<{ name: string; note: string; squad: unknown }> = [];
/** the page drawing now: a page brought forward is given a moment to draw before its picture */
let front: Page | null = null;
async function forward(page: Page): Promise<void> {
  if (front === page) return;
  await page.bringToFront();
  front = page;
  await sleep(600);
}
async function shot(page: Page, name: string, note: string): Promise<void> {
  await forward(page);
  await page.screenshot({ path: resolve(OUT, `${name}.png`) });
  const squad = await ev(page, "window.__range.squadNow()");
  shots.push({ name, note, squad });
  console.log(`  ${name.padEnd(14)} ${note}`);
}

/** where a page's player stands and faces */
const where = (p: Page) => ev<{ x: number; y: number; z: number; yaw: number }>(p, "({ x: window.__range.player.pos.x, y: window.__range.player.pos.y, z: window.__range.player.pos.z, yaw: window.__range.player.yaw })");

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
  try {
    const host = await open(browser, "B00G");
    const guest = await open(browser, "FRIEND");
    await ev(host, `(() => { const t = document.getElementById("brTeam"); t.value = "duo"; t.dispatchEvent(new Event("change")); const b = document.getElementById("brBots"); b.value = "8"; b.dispatchEvent(new Event("change")); document.getElementById("duelMode").value = "br"; document.getElementById("duelHost").click(); })()`);
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
    await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
    for (const p of [host, guest]) await pressPlay(p);
    for (const p of [host, guest]) await p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 90000 });
    await ev(host, "window.__range.duel().holdFire = true");
    // both landed (the straight drop still falls a while into the fight), then on the host's street
    for (const p of [host, guest]) await p.waitForFunction("window.__range.player.onGround", { polling: 200, timeout: 30000 }).catch(() => undefined);
    await sleep(1000);
    // together: the guest 7 m behind the host, facing them (yaw 0 faces -z), on whichever of their two spots is lower
    // (a drop can land on a walkway 24 m up, and the one put beside it with nothing under them falls to the street)
    const a = await where(host);
    const b = await where(guest);
    const h0 = a.y <= b.y ? a : { ...b, z: b.z - 7 };
    const g = { x: h0.x, y: h0.y, z: h0.z + 7 };
    await ev(host, `window.__range.player.teleport(${h0.x}, ${h0.y}, ${h0.z}, 180)`);
    await ev(guest, `window.__range.player.teleport(${g.x}, ${g.y}, ${g.z}, 0)`);
    await sleep(2000);
    await shot(guest, "together", "the friend's screen: B00G 7 m ahead, in their colour, the panel over the friend's own health");
    await shot(host, "together-host", "B00G's screen of the same moment: the friend in theirs");

    // a wall between them: a slab dropped in, the ring and the name still there
    await ev(guest, `(() => { const T = window.__range.THREE; const m = new T.Mesh(new T.BoxGeometry(8, 5, 0.5), new T.MeshStandardMaterial({ color: 0x4a5058 })); m.position.set(${g.x}, ${g.y + 2.5}, ${g.z - 3.5}); m.name = "squad-shots wall"; window.__range.scene.add(m); })()`);
    await sleep(800);
    await shot(guest, "wall", "the same, a wall between: the ring and the name through it");
    await ev(guest, `(() => { const s = window.__range.scene; const m = s.getObjectByName("squad-shots wall"); if (m) s.remove(m); })()`);

    // a hit on the teammate: their row flashes and what it took shows fading (the friend's page drawing already)
    await forward(guest);
    await ev(host, "window.__range.duel().takeHit(38, 100)");
    await sleep(180);
    await shot(guest, "hit", "B00G takes 38: the row flashes, the shield's part still showing as it drains");

    // far off: the name with how far, the compass, the map
    await ev(host, `window.__range.player.teleport(${g.x + 70}, ${g.y}, ${g.z - 90}, 0)`);
    await sleep(2500);
    await shot(guest, "far", "B00G 114 m off to the right: the name with the distance, their number on the compass and the map");

    // to the Gulag: the first death, early in the match
    await ev(host, `window.__range.player.teleport(${g.x}, ${g.y}, ${g.z - 7}, 180)`);
    await sleep(800);
    await ev(host, "window.__range.duel().takeHit(500, 100)");
    await sleep(1200);
    await shot(guest, "gulag", "B00G goes down early: IN THE GULAG on the row, the feed and the middle of the screen say so");
    // lose it: a death in the fight in the Gulag's room
    await host.waitForFunction("(() => { const g = window.__range.duel().gulag; return g && g.phase === 'fight'; })()", { polling: 200, timeout: 30000 }).catch(() => undefined);
    await ev(host, "window.__range.duel().takeHit(500, 100)");
    await sleep(1500);
    await shot(guest, "ghost", "B00G lost the Gulag: a ghost, restore them at their echo; the name over the ghost");

    // restored: back in the fight
    const h = await where(host);
    await ev(host, `window.__range.duel().respawnHere(new window.__range.THREE.Vector3(${h.x}, ${h.y}, ${h.z}), true)`);
    await sleep(700);
    await shot(guest, "restored", "B00G restored: back in the fight, said in the feed and the middle");

    // the friend closes the game: a goodbye, so their row says they left (a drop with no goodbye says the
    // connection is lost; the e2e sksquad section drops one)
    await guest.close();
    front = null;
    await sleep(1500);
    await shot(host, "left", "the friend closed the game: LEFT THE MATCH on B00G's panel, the feed and the middle");
  } finally {
    await browser.close();
  }
  writeFileSync(resolve(OUT, "squad.json"), JSON.stringify(shots, null, 2));
  console.log(`\n${shots.length} pictures in ${OUT}`);
}

void main();
