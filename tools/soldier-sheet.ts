// Pictures of the bought soldier (Phase 21 S4 and S5): the four variants side by side, front and side, standing
// and mid-sprint, so a look at one file says whether the model, its colours and its animation are right.
// Headless, and never the real mouse or keyboard (the page's webdriver guard stays on).
//
// Run: SHOT_URL=http://localhost:5196/ npx tsx tools/soldier-sheet.ts [out.png prefix]
import puppeteer from "puppeteer";

const URL = process.env.SHOT_URL ?? "http://localhost:5196/";
const OUT = process.argv[2] ?? "docs/updates/2026-09-28-soldier";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  page.on("pageerror", (e) => console.log("pageerror:", String(e)));
  await page.goto(`${URL}?game=speedkills&nointro`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("Boolean(window.__range) && window.__range.loaded()", { timeout: 60000 });
  await page.evaluate(`document.getElementById("overlay").classList.add("hidden")`);
  const ready = await page.waitForFunction("window.__range.soldierReady()", { polling: 250, timeout: 60000 }).then(() => true, () => false);
  console.log("soldier ready:", ready);
  // the four variants in their own colours: the code is S, the variant, then its palette picks (soldier.json)
  const looks = ["S0000010", "S1111020", "S2222030", "S3343040"];
  const shots: Array<[string, string]> = [
    ["front-stand", `window.__range.figureLab(${JSON.stringify(looks.map((look) => ({ speed: 0, stance: "stand", pitch: 0, look })))}, 5, 0)`],
    ["close", `window.__range.figureLab(${JSON.stringify(looks.slice(0, 2).map((look) => ({ speed: 0, stance: "stand", pitch: 0, look })))}, 2.2, 0)`],
    ["side-sprint", `window.__range.figureLab(${JSON.stringify(looks.map((look) => ({ speed: 7, stance: "stand", pitch: 0, look })))}, 5, 90)`],
    ["front-aim", `window.__range.figureLab(${JSON.stringify(looks.map((look) => ({ speed: 0, stance: "stand", pitch: 0, ads: 1, look })))}, 4, 20)`],
  ];
  for (const [name, js] of shots) {
    await page.evaluate(`(() => { const r = window.__range; r.player.teleport(0, 0, 0, 0, -4); r.hideViewModel?.(true); ${js}; })()`);
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: `${OUT}-${name}.png` });
    console.log(`${OUT}-${name}.png`);
  }
} finally {
  await browser.close();
}
