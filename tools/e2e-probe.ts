// Debug probe: teleport the player to a spot and log where they end up.
// Run: npx tsx tools/e2e-probe.ts
import puppeteer from "puppeteer";

async function main(): Promise<void> {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
  });
  const p = await browser.newPage();
  await p.setViewport({ width: 640, height: 360 });
  p.on("pageerror", (e) => console.log(`[error] ${String(e)}`));
  await p.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
  await p.waitForFunction("Boolean(window.__range)");
  await new Promise((r) => setTimeout(r, 2000));
  const pos = `(() => { const pl = window.__range.player; return [pl.pos.x.toFixed(2), pl.pos.y.toFixed(2), pl.pos.z.toFixed(2), pl.stance, pl.onGround].join(" "); })()`;
  for (const [x, y, z] of [
    [2, 0, -2],
    [-28.5, 0, 11.4],
    [90, 0, -69],
  ]) {
    await p.evaluate(`(() => { const pl = window.__range.player; pl.setBounds({ minX: -500, maxX: 500, minZ: -500, maxZ: 500 }); pl.teleport(${x}, ${y}, ${z}, 0, 0); })()`);
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 250));
      console.log(`${x},${z}:`, await p.evaluate(pos));
    }
  }
  await browser.close();
}
void main();
