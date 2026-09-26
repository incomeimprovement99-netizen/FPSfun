// Where a frame's CPU time goes, by function: a CPU profile of the page
// standing in a battle royale, with the self time of each function summed and
// the top ones printed. The bench (tools/bench.ts) says how long a frame takes;
// this says what in it is dear, so a slow spot is measured before it is fixed.
//
// Run: PROFILE_SPOT=skmatch SHOT_URL=http://localhost:5194/ npx tsx tools/profile-frame.ts
// PROFILE_SPOT is "skmatch" (SpeedKills' thirty in the city, on the Spire),
// "skroof" (the same, from 100 m over the Spire) or
// "brmatch" (the legacy game's solo match on the hub). The preset is
// Competitive unless PROFILE_PRESET says otherwise.
import puppeteer from "puppeteer";

const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PAGE_URL = process.env.SHOT_URL ?? "http://localhost:5173/";
const SPOT = process.env.PROFILE_SPOT ?? "skmatch";
const PRESET = process.env.PROFILE_PRESET ?? "competitive";
const SECONDS = Number(process.env.PROFILE_SECONDS ?? 5);
const SK = SPOT.startsWith("sk");

interface Node {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  children?: number[];
}

async function main(): Promise<void> {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--disable-gpu-vsync", "--disable-frame-rate-limit", "--mute-audio", "--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument((v: string) => localStorage.setItem("range.quality", v), PRESET);
    // a straight drop, and none of the real mouse (the webdriver guard does the rest)
    await page.evaluateOnNewDocument(`window.__straightDrop = true;`);
    await page.goto(`${PAGE_URL}?nointro&game=${SK ? "speedkills" : "legacy"}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction("window.__range && window.__range.loaded()", { timeout: 60000 });
    await page.evaluate(`document.getElementById("overlay").classList.add("hidden")`);
    await page.evaluate(`(async () => { const r = window.__range; r.startBr({ seed: 42, poi: ${SK ? '"c"' : '"hub"'} }); r.input.lock();
      for (let i = 0; i < 400 && r.duel()?.phase !== "fight"; i++) await new Promise((ok) => setTimeout(ok, 100));
      const d = r.duel(); if (d) d.holdFire = true;
      const hold = () => r.player.teleport(${SPOT === "skroof" ? "0, 100, 500, 30, -18" : SK ? "0, 0.3, 590, 0, 12" : "0, 0, 530, 0, -2"});
      hold(); setInterval(hold, 50); })()`);
    await new Promise((r) => setTimeout(r, 4000));
    const cdp = await page.createCDPSession();
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
    await cdp.send("Profiler.start");
    const frames = (await page.evaluate(`new Promise((done) => { let n = 0; const end = performance.now() + ${SECONDS * 1000}; const tick = (t) => { n++; if (t < end) requestAnimationFrame(tick); else done(n); }; requestAnimationFrame(tick); })`)) as number;
    const { profile } = (await cdp.send("Profiler.stop")) as unknown as { profile: { nodes: Node[]; samples: number[]; timeDeltas: number[] } };
    // self time per node, then summed by function and file
    const self = new Map<number, number>();
    profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
    const byFn = new Map<string, number>();
    const byFile = new Map<string, number>();
    let total = 0;
    for (const n of profile.nodes) {
      const us = self.get(n.id) ?? 0;
      if (!us) continue;
      total += us;
      const file = (n.callFrame.url.split("/").pop() ?? "").split("?")[0] || "(native)";
      const key = `${n.callFrame.functionName || "(anonymous)"}  ${file}:${n.callFrame.lineNumber + 1}`;
      byFn.set(key, (byFn.get(key) ?? 0) + us);
      byFile.set(file, (byFile.get(file) ?? 0) + us);
    }
    const perFrame = (us: number) => (us / 1000 / frames).toFixed(2);
    console.log(`${SPOT} on ${PRESET}: ${frames} frames in ${SECONDS} s (${(frames / SECONDS).toFixed(0)} fps), ${perFrame(total)} ms of sampled time a frame`);
    // what the scene graph walks every frame: every object whose matrix three.js recomputes
    const graph = (await page.evaluate(`(() => { let all = 0, auto = 0, meshes = 0; window.__range.scene.traverse((o) => { all++; if (o.matrixAutoUpdate) auto++; if (o.isMesh) meshes++; }); return { all, auto, meshes }; })()`)) as { all: number; auto: number; meshes: number };
    console.log(`the scene: ${graph.all} objects, ${graph.auto} with their matrix updated every frame, ${graph.meshes} meshes`);
    // and which of the scene's own children hold them, by name (or type), the biggest first
    const parts = (await page.evaluate(`(() => { const by = new Map(); for (const c of window.__range.scene.children) { let n = 0; c.traverse(() => n++); const k = (c.name || c.type).replace(/[0-9]+$/, "#"); const e = by.get(k) || [0, 0]; e[0]++; e[1] += n; by.set(k, e); } return [...by].sort((a, b) => b[1][1] - a[1][1]).slice(0, 12); })()`)) as Array<[string, [number, number]]>;
    for (const [k, [groups, n]] of parts) console.log(`  ${String(n).padStart(6)} objects in ${groups} x ${k}`);
    // the objects three.js walks that draw nothing: under something hidden
    const hidden = (await page.evaluate(`(() => { let n = 0; const walk = (o, shown) => { const s = shown && o.visible; if (!s) n++; for (const c of o.children) walk(c, s); }; walk(window.__range.scene, true); return n; })()`)) as number;
    console.log(`  ${hidden} of them are hidden (under something not visible), and are still walked every frame`);
    // the unnamed groups: what their first named thing is
    const unnamed = (await page.evaluate(`(() => { const by = new Map(); for (const c of window.__range.scene.children) { if (c.name || c.type !== "Group") continue; let n = 0; let first = ""; c.traverse((o) => { n++; if (!first && o.name) first = o.name; if (!first && o.isMesh && o.material && o.material.name) first = "mat:" + o.material.name; }); const k = (first || "?").replace(/[0-9]+$/, "#") + (c.visible ? "" : " (hidden)"); by.set(k, (by.get(k) || 0) + n); } return [...by].sort((a, b) => b[1] - a[1]).slice(0, 8); })()`)) as Array<[string, number]>;
    for (const [k, n] of unnamed) console.log(`    ${String(n).padStart(6)} in unnamed groups holding ${k}`);
    console.log("\nBy file (ms a frame):");
    for (const [k, v] of [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${perFrame(v).padStart(6)}  ${k}`);
    console.log("\nBy function (ms a frame, self time):");
    for (const [k, v] of [...byFn].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`  ${perFrame(v).padStart(6)}  ${k}`);
    // PROFILE_CALLERS=name: who calls that function, two levels up, by the time spent under it
    const want = process.env.PROFILE_CALLERS;
    if (want) {
      const parent = new Map<number, Node>();
      const byId = new Map(profile.nodes.map((n) => [n.id, n]));
      for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n);
      // total time under each node (its own and its children's)
      const under = new Map<number, number>();
      const sum = (n: Node): number => {
        let t = self.get(n.id) ?? 0;
        for (const c of n.children ?? []) t += sum(byId.get(c)!);
        under.set(n.id, t);
        return t;
      };
      for (const n of profile.nodes) if (!parent.has(n.id)) sum(n);
      const name = (n: Node | undefined) => (n ? `${n.callFrame.functionName || "(anonymous)"} ${(n.callFrame.url.split("/").pop() ?? "").split("?")[0]}:${n.callFrame.lineNumber + 1}` : "(top)");
      const callers = new Map<string, number>();
      for (const n of profile.nodes) {
        if (n.callFrame.functionName !== want) continue;
        const p1 = parent.get(n.id);
        const key = `${name(p1)}  <-  ${name(p1 ? parent.get(p1.id) : undefined)}`;
        callers.set(key, (callers.get(key) ?? 0) + (under.get(n.id) ?? 0));
      }
      console.log(`\nWho calls ${want} (ms a frame under it):`);
      for (const [k, v] of [...callers].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${perFrame(v).padStart(6)}  ${k}`);
    }
  } finally {
    await browser.close();
  }
}

void main();
