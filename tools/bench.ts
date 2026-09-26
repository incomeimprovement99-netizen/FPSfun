// Frame-rate benchmark per graphics preset, on the real GPU.
//
// Headless Chrome on the D3D11 backend with v-sync and the frame-rate limit
// off, so frames are not capped at the monitor and the number measured is how
// many frames the machine can actually produce. The page runs its normal
// game loop; we time requestAnimationFrame intervals from inside it, and read
// each frame's draw calls and triangles over every pass (the shadow map, the
// scene, ambient occlusion and bloom), averaged over the run.
//
// BENCH_MERGE=both runs every preset with the static-mesh merge on and off
// (?nomerge), so the merge's effect is measured rather than assumed.
//
// A spot on the battle royale map says so (setRegion), because nothing there
// starts a match: without it the map was measured under the range's short fog,
// which flattered every number taken on it before 2026-09-19.
//
// BENCH_SPOT picks where the camera stands: "range" (the default, the firing
// range as the page opens), or "br", the battle royale map's worst view, from
// the Mast's roof across the whole of Outskirts, with every place in frame,
// or "brmatch", a real solo battle royale on seed 42 dropped onto the hub,
// standing in the middle of it once landed: the loot on the floor and the
// eleven bots are in the frame, which the empty map leaves out.
// "brcorner" is the map's longest sightline, one corner to the other, where a
// preset's draw distance shows most.
//
// The SpeedKills spots: "skmatch", a real battle royale of thirty in the
// city on seed 42, standing in the street south of the Spire looking up at
// it, with the Spire's drop (every other bot squad) around it; "skroof", the
// same match from 100 m up over the Spire, the whole city and its neon in frame.
// Every other spot is the legacy game's, and the page is told which (the
// site opens in SpeedKills otherwise, and a legacy spot would measure the city).
//
// BENCH_QUERY is added to the page's address as it is, for a switch the page
// reads as it loads: "&noskip" keeps hidden objects in the per-frame matrix
// walk (src/game/hiddenskip.ts), so that change is measured, not assumed.
//
// BENCH_EVAL is one more expression run on the page once the spot is set, for
// a comparison against something the build no longer does (the old fixed far
// plane, say).
//
// Run: npm run bench        (needs `npm run dev` already running)
import puppeteer from "puppeteer";

const PAGE_URL = process.env.SHOT_URL ?? "http://localhost:5173/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PRESETS = (process.env.BENCH_PRESETS ?? "competitive,balanced,high").split(",");
const SECONDS = Number(process.env.BENCH_SECONDS ?? 4);
const MERGE = process.env.BENCH_MERGE === "both" ? [true, false] : [true];
const SPOT = process.env.BENCH_SPOT ?? "range";
const GAME = SPOT.startsWith("sk") ? "speedkills" : "legacy";
/** a SpeedKills match on seed 42, dropped on the Spire, fighting held, then the camera put at (x, y, z, yaw, pitch) and kept there */
const skMatch = (x: number, y: number, z: number, yaw: number, pitch: number) => `(async () => { const r = window.__range; r.startBr({ seed: 42, poi: "c" }); r.input.lock();
    for (let i = 0; i < 400 && r.duel()?.phase !== "fight"; i++) await new Promise((ok) => setTimeout(ok, 100));
    const d = r.duel(); if (d) d.holdFire = true;
    const hold = () => r.player.teleport(${x}, ${y}, ${z}, ${yaw}, ${pitch});
    hold();
    setInterval(hold, 50); })()`;
/** where each spot puts the camera: x, y, z, yaw, pitch (the BR map's world coordinates) */
const SPOTS: Record<string, string> = {
  range: "",
  br: `(() => { const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); r.player.teleport(0, 28.2, 500, 45, -8); r.setRegion("br"); })()`,
  // the longest sightline there is: one corner of the map looking diagonally
  // across to the other, 622 m away, which is where the old fixed far plane
  // cut the world off in clear air (docs/PLAN_LOD_DRAW_DISTANCE.md step E)
  brcorner: `(() => { const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 });
    // nothing to stand on above the corner, so the camera is put back where it
    // belongs each frame: the view is the same in every sample, which is what a
    // benchmark wants anyway
    const hold = () => r.player.teleport(-196, 36, 304, -135, -4);
    hold();
    setInterval(hold, 50);
    r.setRegion("br"); })()`,
  // (the lock is what a click on the menu's button takes: the match waits for everyone in the game, this page included,
  // and without it this spot measured the range's edge with the match still waiting)
  brmatch: `(async () => { const r = window.__range; r.startBr({ seed: 42, poi: "hub" }); r.input.lock();
    for (let i = 0; i < 400 && r.duel()?.phase !== "fight"; i++) await new Promise((ok) => setTimeout(ok, 100));
    const d = r.duel(); if (d) d.holdFire = true;
    r.player.teleport(0, 0, 530, 0, -2); })()`,
  skmatch: skMatch(0, 0.3, 590, 0, 12),
  skroof: skMatch(0, 100, 500, 30, -18),
};
/** spots that need the page told something before it loads: a straight drop, and none of the real mouse */
const STRAIGHT_DROP = `window.__straightDrop = true; for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const BEFORE: Record<string, string> = {
  skmatch: STRAIGHT_DROP,
  skroof: STRAIGHT_DROP,
  brmatch: `window.__straightDrop = true; for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`,
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
        // one hour for every run (a battle royale draws its own from the seed otherwise)
        await page.evaluateOnNewDocument(() => localStorage.setItem("range.sky.br", "mine"));
        if (BEFORE[SPOT]) await page.evaluateOnNewDocument(BEFORE[SPOT]);
        await page.goto(PAGE_URL + (merge ? "?nointro" : "?nomerge&nointro") + `&game=${GAME}` + (process.env.BENCH_QUERY ?? ""), { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForFunction("Boolean(window.__range)", { timeout: 60000 });
        await page.waitForFunction("window.__range.loaded()", { timeout: 60000 });
        await page.evaluate(`document.getElementById("overlay").classList.add("hidden")`);
        if (SPOTS[SPOT]) await page.evaluate(SPOTS[SPOT]);
        // anything else this measurement wants said to the page, for a
        // comparison the build itself does not offer (BENCH_EVAL)
        if (process.env.BENCH_EVAL) await page.evaluate(process.env.BENCH_EVAL);
        // settle: textures, props, first shadow render, shader compiles
        await new Promise((r) => setTimeout(r, 3000));
        // Sent as a string: tsx wraps named functions in a __name helper that
        // does not exist inside the page.
        const out = (await page.evaluate(`(async () => {
          const gl = document.createElement("canvas").getContext("webgl2");
          const dbg = gl && gl.getExtension("WEBGL_debug_renderer_info");
          const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "unknown";
          const times = [];
          let calls = 0, tris = 0, n = 0;
          await new Promise((done) => {
            let prev = 0;
            const end = performance.now() + ${SECONDS} * 1000;
            function tick(t) {
              if (prev) times.push(t - prev);
              prev = t;
              const c = window.__range.frameCost();
              calls += c.calls; tris += c.triangles; n++;
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
            p99: times[Math.floor(times.length * 0.99)],
            calls: Math.round(calls / Math.max(1, n)),
            tris: Math.round(tris / Math.max(1, n)),
            bots: r.duel()?.bots?.length ?? 0,
            merged: r.merged,
          };
        })()`)) as { gpu: string; frames: number; med: number; p95: number; p99: number; calls: number; tris: number; bots: number; merged: { meshes: number; after: number } | null };
        const label = `${preset}${MERGE.length > 1 ? (merge ? " merged" : " unmerged") : ""}${SPOT !== "range" ? ` @${SPOT}` : ""}`;
        console.log(
          `${label.padEnd(22)} ${(1000 / out.med).toFixed(0).padStart(5)} fps median   ` +
            `${out.med.toFixed(2)} ms   p95 ${out.p95.toFixed(2)}   p99 ${out.p99.toFixed(2)} ms   ${String(out.calls).padStart(5)} draw calls   ${(out.tris / 1000).toFixed(0).padStart(5)}k triangles` +
            (SPOT === "brmatch" || GAME === "speedkills" ? `   ${out.bots} bots` : "") +
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
