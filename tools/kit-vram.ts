// The textures' memory on the card and the city kit's download, per graphics preset, read from the page
// (window.__range.textureMemory: a compressed texture at its mips' bytes, any other at four bytes a pixel and a third for
// mips). Q="&nocitykit" measures without the kit, so the kit's share is the difference. Headless, never the real mouse or
// keyboard; needs the dev server and the bought files.
//
// Run: SHOT_URL=http://localhost:5211/ [PRESETS=high] [Q=&nocitykit] npx tsx tools/kit-vram.ts
import puppeteer from "puppeteer";
const URL = process.env.SHOT_URL ?? "http://localhost:5211/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
try {
  for (const preset of (process.env.PRESETS ?? "competitive,balanced,high").split(",")) {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument((p) => localStorage.setItem("range.quality", p), preset);
    let bytes = 0;
    page.on("response", async (r) => {
      if (r.url().includes("/models/paid/city/") && r.request().method() === "GET") bytes += Number(r.headers()["content-length"] ?? 0);
    });
    await page.goto(URL + "?game=speedkills" + (process.env.Q ?? ""), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction("window.__range && window.__range.cityKit().drawn > 0", { polling: 500, timeout: 240000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 3000));
    console.log(preset, JSON.stringify(await page.evaluate("window.__range.textureMemory()")), `download ${(bytes / 1e6).toFixed(0)} MB`);
    await page.close();
  }
} finally {
  await browser.close();
}
