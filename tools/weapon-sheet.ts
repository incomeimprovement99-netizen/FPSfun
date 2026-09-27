// Pictures of the bought guns in first person (Phase 21 W4): each SpeedKills gun in the hand, at the hip and in
// the sights, so a look says whether the model sits in the hands, points the right way and lines up with the
// crosshair. Headless, never the real mouse or keyboard.
//
// Run: SHOT_URL=http://localhost:5196/ npx tsx tools/weapon-sheet.ts [out prefix] [ids...]
import puppeteer from "puppeteer";
import skCfg from "../src/config/games/speedkills.json";

const URL = process.env.SHOT_URL ?? "http://localhost:5196/";
const OUT = process.argv[2] ?? "docs/updates/2026-09-28-gun";
const IDS = process.argv.length > 3 ? process.argv.slice(3) : skCfg.roster;
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  page.on("pageerror", (e) => console.log("pageerror:", String(e)));
  await page.goto(`${URL}?game=speedkills&nointro`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("Boolean(window.__range) && window.__range.loaded()", { timeout: 60000 });
  await page.evaluate(`document.getElementById("overlay").classList.add("hidden"); window.__range.input.locked = true;`);
  const ready = await page.waitForFunction("window.__range.paidGuns().ready", { polling: 250, timeout: 60000 }).then(() => true, () => false);
  console.log("bought guns in:", ready);
  for (const id of IDS) {
    await page.evaluate(`(() => { const r = window.__range; r.player.teleport(0, 0, 0, 0, 0); r.loadout.give(0, ${JSON.stringify(id)}); r.setScript({ held: () => false, pressedNow: (a) => a === "slot1" }, null); })()`);
    await new Promise((r) => setTimeout(r, 1500));
    await page.evaluate("window.__range.setScript(null)");
    const inHand = await page.evaluate("JSON.stringify(window.__range.paidGuns())");
    await page.screenshot({ path: `${OUT}-${id}-hip.png` });
    // in the sights, and mid-reload with the magazine out, through the view's own debug hold (main.ts debugView)
    await page.evaluate("window.__range.debugView.ads = 1");
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: `${OUT}-${id}-ads.png` });
    await page.evaluate("window.__range.debugView.ads = null; window.__range.debugView.reload = 0.4");
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: `${OUT}-${id}-reload.png` });
    await page.evaluate("window.__range.debugView.reload = null");
    // fused to the top: the gun's third skin and its brightest glow (paidweapons.json)
    await page.evaluate("window.__range.loadout.setFusion(0, 5)");
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: `${OUT}-${id}-level5.png` });
    await page.evaluate("window.__range.loadout.setFusion(0, 0)");
    console.log(id, inHand);
  }
} finally {
  await browser.close();
}
