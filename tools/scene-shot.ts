// Pictures of a pack's own demo scene (tools/sceneview.html) from given spots, to set beside the game's. Headless,
// never the real mouse or keyboard; needs the dev server and the bought files.
//
// Run: SHOT_URL=http://localhost:5211/ npx tsx tools/scene-shot.ts <out prefix> <pack> '<json [{name, q}]>'
import puppeteer from "puppeteer";
const URL = process.env.SHOT_URL ?? "http://localhost:5211/";
const [out, pack, spotsJson] = process.argv.slice(2);
const spots: Array<{ name: string; q: string }> = JSON.parse(spotsJson ?? '[{"name":"over","q":""}]');
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
try {
  for (const s of spots) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900 });
    page.on("pageerror", (e) => console.log("pageerror:", String(e)));
    await page.goto(`${URL}tools/sceneview.html?pack=${pack}&${s.q}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction("window.__done === true", { timeout: 300000 });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: `${out}-${pack}-${s.name}.png` });
    console.log(`${out}-${pack}-${s.name}.png`, await page.evaluate("JSON.stringify(window.__scene)"));
    await page.close();
  }
} finally {
  await browser.close();
}
