// Frame-rate benchmark per graphics preset, on the real GPU.
//
// Headless Chrome on the D3D11 backend with v-sync and the frame-rate limit
// off, so frames are not capped at the monitor and the number measured is how
// many frames the machine can actually produce. The page runs its normal
// game loop; we time requestAnimationFrame intervals from inside it, and read
// the draw calls of the last frame and the page's own CPU time per frame.
//
// BENCH_MERGE=both runs every preset with the static-mesh merge on and off
// (?nomerge), so the merge's effect is measured rather than assumed.
//
// BENCH_SPOT picks where the camera stands: "range" (the default, the firing
// range as the page opens), or "br", the battle royale map's worst view, from
// the Mast's roof across the whole of Outskirts, with every place in frame.
//
// Run: npm run bench        (needs `npm run dev` already running)
import puppeteer from "puppeteer";

const PAGE_URL = process.env.SHOT_URL ?? "http://localhost:5173/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PRESETS = (process.env.BENCH_PRESETS ?? "competitive,balanced,high").split(",");
const SECONDS = Number(process.env.BENCH_SECONDS ?? 4);
const MERGE = process.env.BENCH_MERGE === "both" ? [true, false] : [true];
const SPOT = process.env.BENCH_SPOT ?? "range";
/** where each spot puts the camera: x, y, z, yaw, pitch (the BR map's world coordinates) */
const SPOTS: Record<string, string> = {
  range: "",
  br: `(() => { const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); r.player.teleport(0, 28.2, 500, 45, -8); })()`,
};

async function main(): Promise<void> {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      "--use-angle=d3d11",
      "--enable-gpu",
      "--ignore-gpu-blocklist",
      "--disable-gpu-vsync",
      "--disable-frame-rate-limit",
      "--mute-audio",
      "--no-sandbox",
    ],
  });
  try {
    for (const preset of PRESETS) {
      for (const merge of MERGE) {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
        await page.evaluateOnNewDocument((v: string) => localStorage.setItem("range.quality", v), preset);
        await page.goto(PAGE_URL + (merge ? "" : "?nomerge"), { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForFunction("Boolean(window.__range)", { timeout: 60000 });
        await page.waitForFunction("window.__range.loaded()", { timeout: 60000 });
        await page.evaluate(`document.getElementById("overlay").classList.add("hidden")`);
        if (SPOTS[SPOT]) await page.evaluate(SPOTS[SPOT]);
        // settle: textures, props, first shadow render, shader compiles
        await new Promise((r) => setTimeout(r, 3000));
        // Sent as a string: tsx wraps named functions in a __name helper that
        // does not exist inside the page.
        const out = (await page.evaluate(`(async () => {
          const gl = document.createElement("canvas").getContext("webgl2");
          const dbg = gl && gl.getExtension("WEBGL_debug_renderer_info");
          const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "unknown";
          const times = [];
          await new Promise((done) => {
            let prev = 0;
            const end = performance.now() + ${SECONDS} * 1000;
            function tick(t) {
              if (prev) times.push(t - prev);
              prev = t;
              if (t < end) requestAnimationFrame(tick); else done();
            }
            requestAnimationFrame(tick);
          });
          times.sort((a, b) => a - b);
          const r = window.__range;
          return {
            gpu,
            frames: times.length,
            med: times[Math.floor(times.length / 2)],
            p95: times[Math.floor(times.length * 0.95)],
            calls: r.drawCalls(),
            merged: r.merged,
          };
        })()`)) as { gpu: string; frames: number; med: number; p95: number; calls: number; merged: { meshes: number; after: number } | null };
        const label = `${preset}${MERGE.length > 1 ? (merge ? " merged" : " unmerged") : ""}${SPOT !== "range" ? ` @${SPOT}` : ""}`;
        console.log(
          `${label.padEnd(22)} ${(1000 / out.med).toFixed(0).padStart(5)} fps median   ` +
            `${out.med.toFixed(2)} ms   p95 ${out.p95.toFixed(2)} ms   ${String(out.calls).padStart(4)} draw calls` +
            (out.merged ? `   (static meshes ${out.merged.meshes} -> ${out.merged.after})` : "") +
            `   GPU: ${out.gpu}`
        );
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

void main();
