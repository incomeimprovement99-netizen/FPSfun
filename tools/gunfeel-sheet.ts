// Pictures of the signature guns in the hands (src/config/gunfeel.json): each held part way through its phase out and
// in (a swap), just after a shot, part way through an inspect's scan, and through a reload with its magazine phasing out and a new one in, so a look says
// whether the phase reads and the gun stays where the eye can see it; and from empty, the USSO's rack with the hand on
// the handle, and BOOG's cant as it cycles after a shot. At the owner's own view: 1920 by 1080 at the widest FOV setting
// (FOV=1.571, tools/pov-sheet.ts). ONLY= limits it to some of swap, shot, inspect, reload, rack; RELOAD_AT= the reload's
// moments (shares of it, comma separated). Headless, never the
// real mouse or keyboard.
//
// Run: SHOT_URL=http://localhost:5196/ npx tsx tools/gunfeel-sheet.ts [out prefix] [ids...]
import puppeteer from "puppeteer";
import feel from "../src/config/gunfeel.json";

const URL = process.env.SHOT_URL ?? "http://localhost:5196/";
const OUT = process.argv[2] ?? "docs/updates/gunfeel";
const IDS = process.argv.length > 3 ? process.argv.slice(3) : Object.keys(feel.guns);
const FOV = Number(process.env.FOV ?? 1.571);
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const want = (k: string) => !ONLY || ONLY.includes(k);
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  await page.evaluateOnNewDocument(`try { const k = "range.settings.v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.fovScale = ${FOV}; localStorage.setItem(k, JSON.stringify(s)); } catch {}`);
  page.on("pageerror", (e) => console.log("pageerror:", String(e)));
  await page.goto(`${URL}?game=speedkills&nointro`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("Boolean(window.__range) && window.__range.loaded() && window.__range.paidGuns().ready && window.__range.soldierReady()", { polling: 250, timeout: 60000 });
  await page.evaluate(`document.getElementById("overlay").classList.add("hidden"); window.__range.input.locked = true;`);
  const hold = async (js: string, name: string, ms = 500) => {
    await page.evaluate(`(() => { const r = window.__range; ${js} })()`);
    await wait(ms);
    await page.screenshot({ path: `${OUT}-${name}.png` });
    console.log(`${OUT}-${name}.png`);
  };
  for (const id of IDS) {
    await page.evaluate(`(() => { const r = window.__range; r.player.teleport(0, 0, 0, 0, 0); r.loadout.give(0, ${JSON.stringify(id)}); r.setScript({ held: () => false, pressedNow: (a) => a === "slot1" }, null); })()`);
    await wait(1500);
    await page.evaluate("window.__range.setScript(null)");
    await hold("", `${id}-stand`);
    // the swap: going out at 0.3 of it, coming in at 0.62, 0.72 and 0.84
    if (want("swap")) {
      for (const r of [0.3, 0.62, 0.72, 0.84]) await hold(`r.debugView.raise = ${r};`, `${id}-swap${Math.round(r * 100)}`);
      await page.evaluate("window.__range.debugView.raise = null");
      await wait(400);
    }
    // a shot: the screenshot a few frames in, and on through the cycle after it
    if (want("shot")) {
      await page.evaluate(`window.__range.setScript({ held: (a) => a === "fire", pressedNow: () => false })`);
      await wait(45);
      await page.screenshot({ path: `${OUT}-${id}-shot.png` });
      await page.evaluate("window.__range.setScript(null)");
      await wait(350);
      await page.screenshot({ path: `${OUT}-${id}-after.png` });
      await wait(350);
      await page.screenshot({ path: `${OUT}-${id}-cycle.png` });
      await wait(900);
    }
    // an inspect: the scan passing along the gun as it turns
    if (want("inspect")) {
      for (const t of [0.3, 0.45]) await hold(`r.debugView.inspect = ${t};`, `${id}-inspect${Math.round(t * 100)}`);
      await page.evaluate("window.__range.debugView.inspect = null");
      await wait(400);
    }
    // the reload: the magazine going, gone, coming, seated
    if (want("reload")) {
      for (const p of (process.env.RELOAD_AT ?? "0.22,0.4,0.56,0.8").split(",").map(Number)) await hold(`r.debugView.reload = ${p};`, `${id}-reload${Math.round(p * 100)}`);
      await page.evaluate("window.__range.debugView.reload = null");
      await wait(400);
    }
    // from empty: the rack after the seat, the hand going to the handle, back with it, and to the gun again
    if (want("rack")) {
      for (const p of [0.82, 0.87, 0.9, 0.95]) {
        await page.evaluate("window.__range.debugView.reload = null");
        await wait(120);
        await hold(`r.loadout.active.state.clip = 0; r.debugView.reload = ${p};`, `${id}-rack${Math.round(p * 100)}`);
      }
      await page.evaluate("(() => { const r = window.__range; r.debugView.reload = null; r.loadout.active.state.clip = r.loadout.active.weapon.clipSize; })()");
      await wait(400);
    }
  }
} finally {
  await browser.close();
}
