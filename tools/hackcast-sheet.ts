// Pictures of a hack used in first person (src/game/hackcast.ts): the owner's view (1920 by 1080, the widest FOV)
// held at moments through the cast (the hand coming up, the tap, the burst, going back), with the USSO in hand, so a
// look says whether the hand, the card and the gun's dip read. Headless, never the real mouse or keyboard.
//
// Run: SHOT_URL=http://localhost:5196/ npx tsx tools/hackcast-sheet.ts [out prefix] [hack ids...]
import puppeteer from "puppeteer";

const URL = process.env.SHOT_URL ?? "http://localhost:5196/";
const OUT = process.argv[2] ?? "docs/updates/hackcast";
const IDS = process.argv.length > 3 ? process.argv.slice(3) : ["heal", "dash"];
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  await page.evaluateOnNewDocument(`try { const k = "range.settings.v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.fovScale = 1.571; localStorage.setItem(k, JSON.stringify(s)); } catch {}`);
  page.on("pageerror", (e) => console.log("pageerror:", String(e)));
  await page.goto(`${URL}?game=speedkills&nointro`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("Boolean(window.__range) && window.__range.loaded() && window.__range.paidGuns().ready && window.__range.soldierReady()", { polling: 250, timeout: 60000 });
  await page.evaluate(`document.getElementById("overlay").classList.add("hidden"); window.__range.input.locked = true; const r = window.__range; r.player.teleport(0, 0, 30, 0, 0); r.loadout.give(0, "r97"); r.loadout.requestSwap(0, r.gameTime());`);
  await wait(1500);
  for (const id of IDS) {
    for (const at of [0.08, 0.16, 0.22, 0.34]) {
      await page.evaluate(`window.__range.debugView.cast = { id: ${JSON.stringify(id)}, at: ${at} }`);
      await wait(250);
      await page.screenshot({ path: `${OUT}-${id}-${Math.round(at * 100)}.png` });
      console.log(`${OUT}-${id}-${Math.round(at * 100)}.png`);
    }
    await page.evaluate("window.__range.debugView.cast = null");
    await wait(600);
  }
  // the HEAL area for real, from a step back and from inside it while it heals you (the view's green edges)
  await page.evaluate(`(() => { const r = window.__range; r.player.teleport(0, 0, -6, 0, 0); r.sk.setHack("heal"); r.sk.use("utility"); })()`);
  await wait(400);
  await page.evaluate(`window.__range.player.teleport(0, 0, 3, 0, -14)`);
  await wait(700);
  await page.screenshot({ path: `${OUT}-heal-area.png` });
  console.log(`${OUT}-heal-area.png`);
  await page.evaluate(`(() => { const r = window.__range; const d = r.duel && r.duel(); r.player.teleport(0, 0, -5, 0, -8); })()`);
  await wait(700);
  await page.screenshot({ path: `${OUT}-heal-inside.png` });
  console.log(`${OUT}-heal-inside.png`);
} finally {
  await browser.close();
}
