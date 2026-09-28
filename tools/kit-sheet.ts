// Contact sheets of the city bundle's baked pieces (tools/kitview.html), so a look says each piece came out whole,
// the right way up and the right size. Headless, never the real mouse or keyboard; needs the dev server.
//
// Run: SHOT_URL=http://localhost:5197/ npx tsx tools/kit-sheet.ts <out prefix> <pack>[:filter[:cols]] ...
import puppeteer from "puppeteer";
const URL = process.env.SHOT_URL ?? "http://localhost:5197/";
const OUT = process.argv[2] ?? "kit";
const SHEETS = process.argv.slice(3);
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
try {
  for (const s of SHEETS) {
    const [pack, filter = "", cols = "8"] = s.split(":");
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => console.log("pageerror:", String(e)));
    await page.goto(`${URL}tools/kitview.html?pack=${pack}&filter=${encodeURIComponent(filter)}&cols=${cols}${process.env.KIT_FILE ? `&file=${encodeURIComponent(process.env.KIT_FILE)}&yaw=0.35` : ""}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction("window.__kitDone === true", { timeout: 180000 });
    await new Promise((r) => setTimeout(r, 1500));
    const name = `${OUT}-${pack}${filter ? "-" + filter.replace(/\W+/g, "_") : ""}.png`;
    await page.screenshot({ path: name });
    console.log(name, await page.evaluate("JSON.stringify(window.__kit)"));
    await page.close();
  }
} finally {
  await browser.close();
}
