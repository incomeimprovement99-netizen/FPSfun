// Contact sheets of Neon City's prefabs as pictures (tools/neongallery.html over the sheets tools/import-neon.ts
// NEON=gallery bakes), for knowing every piece before planning with them (Phase 28.1). Headless, never the real mouse
// or keyboard; needs the dev server and the bought files.
//
// Run: SHOT_URL=http://localhost:5211/ npx tsx tools/neon-sheets.ts <out dir> <sheet name>... [--cols=6]
import puppeteer from "puppeteer";
const URL = process.env.SHOT_URL ?? "http://localhost:5211/";
const args = process.argv.slice(2);
const out = args[0];
const cols = Number(args.find((a) => a.startsWith("--cols="))?.split("=")[1] ?? 6);
const sheets = args.slice(1).filter((a) => !a.startsWith("--"));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
try {
  for (const s of sheets) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1800, height: 1200 });
    page.on("pageerror", (e) => console.log("pageerror:", String(e)));
    await page.goto(`${URL}tools/neongallery.html?sheet=${s}&cols=${cols}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForFunction("window.__done === true", { timeout: 600000 });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: `${out}/${s}.png` });
    console.log(`${out}/${s}.png`);
    await page.close();
  }
} finally {
  await browser.close();
}
