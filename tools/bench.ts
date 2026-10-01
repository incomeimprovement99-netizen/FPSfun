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
// same match from 160 m up over the Spire, the whole city and its neon in frame.
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
// BENCH_RUNS=n repeats every preset n times, taking them in turn round by round (interleaved), and ends with each
// preset's median over its runs and the spread: a single run swings by about 25% when the machine is doing
// anything else (the owner's own use of it included), so one number is not a measurement.
//
// Pacing (docs/PHASE_20_PLAN.md A18): every run counts its hitches, frames over 50 ms, and its worst frame.
// BENCH_PHASES=1 turns on the game's phase timer (src/game/framephase.ts, ?perf) and names the phase each hitch
// was in, or "outside the loop" when the loop's own time was short (the GPU, a garbage collection, the browser).
// "skrun" is the spot for it: the match, with the camera running a street toward the Spire at a sprint (14 m/s),
// since hitches come with moving, not with standing.
//
// The Neon City (the default map since Phase 28; the spots above are the old city's): "neonstreet", the match on
// seed 42 at eye height in the street 45 m south of the tower, facing it (the most drawn from the ground: about 690
// draw calls and 5.7 million triangles on Balanced, 2026-10-01), and "neonhigh", 40 m up 120 m south of it, the
// city in front of you as from a drop.
//
// BENCH_VARIANTS="name=query;name=query" measures each preset once a variant, the query added to the page's address
// (quality.ts reads &q=key:value,... as one setting of the preset changed): what one setting costs, in the same
// interleaved rounds as the preset it changes. "base=" is the preset as it is.
//
// BENCH_GPU=1 times the GPU's own work a frame with timer queries round every draw (EXT_disjoint_timer_query_webgl2):
// a frame longer than the loop's own time and the GPU's is the browser's or the wait between them.
//
// BENCH_DPR is the screen's pixel density (default 1): Balanced draws at up to 1.5 of it and High at up to 2, which a
// 1080p bench at 1 never shows, where a laptop's 1.25 to 2 does. BENCH_CPU=4 runs the page on a quarter of the CPU
// (Chrome's own throttle), for a slower machine's processor.
//
// Run: npm run bench        (needs `npm run dev` already running)
import puppeteer from "puppeteer";

const PAGE_URL = process.env.SHOT_URL ?? "http://localhost:5173/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PRESETS = (process.env.BENCH_PRESETS ?? "competitive,balanced,high").split(",");
const SECONDS = Number(process.env.BENCH_SECONDS ?? 4);
const MERGE = process.env.BENCH_MERGE === "both" ? [true, false] : [true];
const SPOT = process.env.BENCH_SPOT ?? "range";
const RUNS = Math.max(1, Number(process.env.BENCH_RUNS ?? 1));
const PHASES = process.env.BENCH_PHASES === "1";
const GPU = process.env.BENCH_GPU === "1";
const DPR = Number(process.env.BENCH_DPR ?? 1);
const CPU_SLOW = Number(process.env.BENCH_CPU ?? 1);
/** (name, query) a variant; one, unnamed and empty, unless BENCH_VARIANTS names some */
const VARIANTS: Array<[string, string]> = (process.env.BENCH_VARIANTS ?? "")
  .split(";")
  .filter(Boolean)
  .map((v) => [v.split("=")[0], v.slice(v.indexOf("=") + 1)] as [string, string]);
if (!VARIANTS.length) VARIANTS.push(["", ""]);
/** the hitch line, ms: the plan's */
const HITCH = 50;
const GAME = SPOT.startsWith("sk") ? "speedkills" : "legacy";
/** a SpeedKills match on seed 42, dropped on the Spire, fighting held, then the camera put at (x, y, z, yaw, pitch) and kept there */
const skMatch = (x: number, y: number, z: number, yaw: number, pitch: number) => `(async () => { const r = window.__range; r.startBr({ seed: 42, poi: "c" }); r.input.lock();
    for (let i = 0; i < 400 && r.duel()?.phase !== "fight"; i++) await new Promise((ok) => setTimeout(ok, 100));
    const d = r.duel(); if (d) d.holdFire = true;
    const hold = () => r.player.teleport(${x}, ${y}, ${z}, ${yaw}, ${pitch});
    hold();
    setInterval(hold, 50); })()`;
/** the match on seed 42, and the camera carried along -z from (x, y, z0) at `speed` m/s, placed every frame */
const skRun = (x: number, y: number, z0: number, speed: number) => `(async () => { const r = window.__range; r.startBr({ seed: 42, poi: "c" }); r.input.lock();
    for (let i = 0; i < 400 && r.duel()?.phase !== "fight"; i++) await new Promise((ok) => setTimeout(ok, 100));
    const d = r.duel(); if (d) d.holdFire = true;
    const t0 = performance.now();
    const hold = () => { r.player.teleport(${x}, ${y}, ${z0} - ((performance.now() - t0) / 1000) * ${speed}, 0, 0); requestAnimationFrame(hold); };
    hold(); })()`;
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
  // 160 m, over the Spire's crown deck (140 m) and south of its mast: at 100 m, where it was, it stood in the Spire's third tier
  skroof: skMatch(0, 160, 520, 30, -18),
  // down the street at map x 36 (city.json blocks), from the north edge toward the Spire at a sprint, eye height
  skrun: skRun(36, 1.7, 740, 14),
  neonstreet: skMatch(0, 1.7, 545, 0, 0),
  neonhigh: skMatch(0, 40, 620, 0, -5),
};
/** spots that need the page told something before it loads: a straight drop, and none of the real mouse */
const STRAIGHT_DROP = `window.__straightDrop = true; for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const BEFORE: Record<string, string> = {
  skmatch: STRAIGHT_DROP,
  neonstreet: STRAIGHT_DROP,
  neonhigh: STRAIGHT_DROP,
  skroof: STRAIGHT_DROP,
  brmatch: `window.__straightDrop = true; for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`,
};

type Run = {
  gpu: string;
  frames: number;
  med: number;
  p95: number;
  p99: number;
  hitches: number;
  worst: number;
  calls: number;
  tris: number;
  bots: number;
  merged: { meshes: number; after: number } | null;
  /** the GPU's own time a frame, ms (BENCH_GPU): median and 95th percentile */
  gpuMs: { med: number; p95: number } | null;
  perf: { means: Record<string, number>; hitches: Array<{ ms: number; phases: Record<string, number> }> } | null;
};

async function main(): Promise<void> {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    // (the Neon City's file is parsed on the page's thread: a minute and more where the page answers nothing)
    protocolTimeout: 900000,
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
  const combos = PRESETS.flatMap((preset) => MERGE.flatMap((merge) => VARIANTS.map(([vname, query]) => ({ preset, merge, vname, query }))));
  const label = (c: { preset: string; merge: boolean; vname: string }) =>
    `${c.preset}${c.vname ? ` [${c.vname}]` : ""}${MERGE.length > 1 ? (c.merge ? " merged" : " unmerged") : ""}${SPOT !== "range" ? ` @${SPOT}` : ""}`;
  const results = new Map<string, Run[]>();
  try {
    // round by round, every preset in turn: a change in the machine's load lands on all of them, not on one
    for (let round = 0; round < RUNS; round++) {
      for (const c of combos) {
        const out = await measure(browser, c.preset, c.merge, c.query);
        const l = label(c);
        results.set(l, [...(results.get(l) ?? []), out]);
        console.log(
          `${(RUNS > 1 ? `${l} #${round + 1}` : l).padEnd(26)} ${(1000 / out.med).toFixed(0).padStart(5)} fps median   ` +
            `${out.med.toFixed(2)} ms   p95 ${out.p95.toFixed(2)}   p99 ${out.p99.toFixed(2)} ms   ${out.hitches} over ${HITCH} ms (worst ${out.worst.toFixed(0)})   ` +
            `${String(out.calls).padStart(5)} draw calls   ${(out.tris / 1000).toFixed(0).padStart(5)}k triangles` +
            (SPOT === "brmatch" || GAME === "speedkills" ? `   ${out.bots} bots` : "") +
            (out.merged ? `   (static meshes ${out.merged.meshes} -> ${out.merged.after})` : "") +
            (out.gpuMs ? `   GPU ${out.gpuMs.med.toFixed(2)} ms (p95 ${out.gpuMs.p95.toFixed(2)})` : "") +
            `   GPU: ${out.gpu}`
        );
        if (out.perf) {
          console.log(`    loop, ms a frame: ${Object.entries(out.perf.means).map(([n, v]) => `${n} ${v.toFixed(2)}`).join(", ")}`);
          // each hitch in the loop by the phase that took most of it; the rest of the frames over the line were outside it
          const by = new Map<string, number>();
          for (const h of out.perf.hitches) {
            const top = Object.entries(h.phases).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "?";
            by.set(top, (by.get(top) ?? 0) + 1);
          }
          const outside = Math.max(0, out.hitches - out.perf.hitches.length);
          if (out.hitches || out.perf.hitches.length) console.log(`    hitches: ${[...by].map(([n, k]) => `${n} ${k}`).join(", ") || "none in the loop"}${outside ? `, outside the loop ${outside}` : ""}`);
        }
      }
    }
    if (RUNS > 1) {
      console.log(`\nmedian of ${RUNS} runs each, taken in turn (the spread is the lowest and highest run):`);
      const mid = (xs: number[]) => xs[Math.floor(xs.length / 2)];
      for (const [l, rs] of results) {
        const fps = rs.map((r) => 1000 / r.med).sort((a, b) => a - b);
        const p99 = rs.map((r) => r.p99).sort((a, b) => a - b);
        const gpuMed = rs.map((r) => r.gpuMs?.med ?? NaN).sort((a, b) => a - b);
        const loop = rs.map((r) => (r.perf ? Object.values(r.perf.means).reduce((a, b) => a + b, 0) : NaN)).sort((a, b) => a - b);
        console.log(
          `${l.padEnd(34)} ${mid(fps).toFixed(0).padStart(5)} fps (${fps[0].toFixed(0)} to ${fps[fps.length - 1].toFixed(0)})   ${(1000 / mid(fps)).toFixed(2)} ms   p99 ${mid(p99).toFixed(2)} ms` +
            (GPU ? `   GPU ${mid(gpuMed).toFixed(2)} ms` : "") +
            (PHASES ? `   loop ${mid(loop).toFixed(2)} ms` : "") +
            `   calls ${rs[0].calls}   tris ${(rs[0].tris / 1e6).toFixed(2)}M   hitches ${rs.map((r) => r.hitches).join(", ")}`,
        );
      }
    }
  } finally {
    await browser.close();
  }
}

/** one run of one preset: a fresh page, the spot, a settle, then SECONDS of frames */
async function measure(browser: import("puppeteer").Browser, preset: string, merge: boolean, query = ""): Promise<Run> {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: DPR });
  if (CPU_SLOW > 1) await (await page.createCDPSession()).send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOW });
  await page.evaluateOnNewDocument((v: string) => localStorage.setItem("range.quality", v), preset);
  // one hour for every run (a battle royale draws its own from the seed otherwise)
  await page.evaluateOnNewDocument(() => localStorage.setItem("range.sky.br", "mine"));
  if (BEFORE[SPOT]) await page.evaluateOnNewDocument(BEFORE[SPOT]);
  await page.goto(PAGE_URL + (merge ? "?nointro" : "?nomerge&nointro") + `&game=${GAME}` + (PHASES ? "&perf" : "") + (process.env.BENCH_QUERY ?? "") + query, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("Boolean(window.__range)", { timeout: 60000 });
  await page.waitForFunction("window.__range.loaded()", { timeout: 60000 });
  // the Neon City map's file (&map=neon, Phase 28) loads after the page says it is loaded: measured once it is drawn
  await page.waitForFunction("!window.__range.neonMap || !window.__range.neonMap().on || window.__range.neonMap().drawn", { timeout: 300000 });
  await page.evaluate(`document.getElementById("overlay").classList.add("hidden")`);
  if (SPOTS[SPOT]) await page.evaluate(SPOTS[SPOT]);
  // anything else this measurement wants said to the page, for a
  // comparison the build itself does not offer (BENCH_EVAL)
  if (process.env.BENCH_EVAL) await page.evaluate(process.env.BENCH_EVAL);
  // settle: textures, props, first shadow render, shader compiles
  await new Promise((r) => setTimeout(r, 3000));
  // what the phase timer kept while settling is not the run's
  if (PHASES) await page.evaluate("window.__range.perf(true)");
  // the GPU's time a frame: a timer query round every draw the renderer is asked for (the outermost, where one draw
  // asks for another: the queries do not nest), summed by the animation frame it was asked in
  if (GPU)
    await page.evaluate(`(() => {
      const r = window.__range.renderer; const gl = r.getContext(); const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
      if (!ext) return;
      const W = (window.__gpuT = { frames: [], pending: [], id: 0 });
      const tick = () => { W.id++; requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      const orig = r.render.bind(r);
      let depth = 0;
      r.render = (scene, camera) => {
        if (depth++ > 0) { try { return orig(scene, camera); } finally { depth--; } }
        const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        try { return orig(scene, camera); } finally { gl.endQuery(ext.TIME_ELAPSED_EXT); W.pending.push({ q, f: W.id }); depth--; }
      };
      const poll = () => {
        const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT); const still = [];
        for (const p of W.pending) {
          if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) { still.push(p); continue; }
          const ns = gl.getQueryParameter(p.q, gl.QUERY_RESULT); gl.deleteQuery(p.q);
          if (!disjoint) W.frames[p.f] = (W.frames[p.f] || 0) + ns / 1e6;
        }
        W.pending = still; requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    })()`);
  // Sent as a string: tsx wraps named functions in a __name helper that
  // does not exist inside the page.
  const out = (await page.evaluate(`(async () => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const dbg = gl && gl.getExtension("WEBGL_debug_renderer_info");
    const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "unknown";
    const times = [];
    let calls = 0, tris = 0, n = 0;
    const g0 = window.__gpuT ? window.__gpuT.id : 0;
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
    const g1 = window.__gpuT ? window.__gpuT.id : 0;
    // (the last frames' queries come back a frame or two late)
    if (window.__gpuT) await new Promise((ok) => setTimeout(ok, 300));
    const gt = window.__gpuT ? window.__gpuT.frames.slice(g0 + 1, g1).filter((v) => v > 0).sort((a, b) => a - b) : [];
    const gpuMs = gt.length ? { med: gt[Math.floor(gt.length / 2)], p95: gt[Math.floor(gt.length * 0.95)] } : null;
    const hitches = times.filter((t) => t > ${HITCH}).length;
    const worst = times.reduce((m, t) => Math.max(m, t), 0);
    times.sort((a, b) => a - b);
    const r = window.__range;
    const perf = ${PHASES} ? r.perf() : null;
    return {
      gpu,
      frames: times.length,
      med: times[Math.floor(times.length / 2)],
      p95: times[Math.floor(times.length * 0.95)],
      p99: times[Math.floor(times.length * 0.99)],
      hitches,
      worst,
      calls: Math.round(calls / Math.max(1, n)),
      tris: Math.round(tris / Math.max(1, n)),
      bots: r.duel()?.bots?.length ?? 0,
      merged: r.merged,
      gpuMs,
      perf: perf && { means: perf.means, hitches: perf.hitches },
    };
  })()`)) as Run;
  await page.close();
  return out;
}

void main();
