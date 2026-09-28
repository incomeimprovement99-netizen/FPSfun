// Pictures of SpeedKills' centre from the plan's fixed cameras (docs/CITY_BUNDLE_IMPLEMENTATION.md section 8), the
// same spots every time so each change is a before and an after. Headless, never the real mouse or keyboard; the
// player is held at each spot while the picture is taken, inside bounds widened to the city (the range's own would
// clamp every spot back into the range). Needs the dev server.
//
// Run: SHOT_URL=http://127.0.0.1:5197/ npx tsx tools/city-sheet.ts <out prefix> [preset: competitive|balanced|high] [before]
// CLEAN=1 hides the HUD for a picture of the city alone.
// SKY=<hour> (sky.json hours, e.g. hazyDay) sets the time of day first, for the same spots by day and by night.
// SHOT_FOV=<degrees> sets the view's vertical field of view (the settings' scale found for it), to frame as a store picture.
// EYE=1 takes each spot's `eye` as the camera's own position (the feet put the player's eye height under it), and CLEAN
// then hides the gun too, for a picture framed exactly as tools/scene-shot.ts frames the pack's own scene.
import puppeteer from "puppeteer";
import { BR_X, BR_Z } from "../src/game/br";
const URL = process.env.SHOT_URL ?? "http://127.0.0.1:5197/";
const OUT = process.argv[2] ?? "city";
const PRESET = process.argv[3] ?? "balanced";
/** "before": the same spots with the bundle left off (main.ts ?nocitykit) */
const BEFORE = process.argv[4] === "before";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
/** map-local eye and the point it looks at */
const SHOTS: Array<{ name: string; eye: [number, number, number]; at: [number, number, number] }> = [
  { name: "1-alley", eye: [36, 1.7, 62], at: [36, 6, -20] },
  { name: "2-bridge", eye: [60, 10, 30], at: [0, 30, 0] },
  { name: "3-lobby", eye: [70, 34, 70], at: [0, 34, 0] },
  { name: "4-chimney", eye: [-7.5, 9.9, -50], at: [-7.5, 30, -62] },
  { name: "5-skypark", eye: [0, 70, 95], at: [0, 40, 400] },
  { name: "6-aerial", eye: [150, 140, 150], at: [0, 20, 0] },
  { name: "7-fronts", eye: [43, 1.7, -60], at: [25, 4, -60] },
];
// SPOTS='[{"name":"x","eye":[..],"at":[..]}]' replaces the fixed cameras, for a look at one place
if (process.env.SPOTS) SHOTS.splice(0, SHOTS.length, ...JSON.parse(process.env.SPOTS));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  await page.evaluateOnNewDocument(`try { localStorage.setItem("range.quality", ${JSON.stringify(PRESET)}); } catch {}`);
  page.on("pageerror", (e) => console.log("pageerror:", String(e)));
  await page.goto(`${URL}?game=speedkills&nointro${BEFORE ? "&nocitykit" : ""}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("Boolean(window.__range) && window.__range.loaded()", { timeout: 120000 });
  await page.evaluate(`document.getElementById("overlay").classList.add("hidden"); window.__range.input.locked = true; window.__range.setRegion("br"); ${process.env.SKY ? `window.__range.sky.set(${JSON.stringify(process.env.SKY)});` : ""} ${process.env.CLEAN ? 'document.getElementById("hud").style.visibility = "hidden"; window.__range.hideViewModel(true);' : ""} window.__range.player.setBounds({ minX: ${BR_X - 600}, maxX: ${BR_X + 600}, minZ: ${BR_Z - 600}, maxZ: ${BR_Z + 600} });`);
  const kitIn = BEFORE ? false : await page.waitForFunction("window.__range.cityKit().drawn > 0", { polling: 500, timeout: 180000 }).then(() => true, () => false);
  if (BEFORE) await new Promise((r) => setTimeout(r, 5000));
  console.log("city kit:", kitIn, await page.evaluate("JSON.stringify(window.__range.cityKit())"), "districts:", await page.evaluate("JSON.stringify(window.__range.cityDistricts?.())"), "fov:", await page.evaluate("window.__range.camera.fov.toFixed(1)"));
  if (process.env.SHOT_FOV) {
    // the settings' scale that gives this vertical field of view, found by halves (the view sets its FOV each frame)
    const got = await page.evaluate(`(async () => { const r = window.__range; const want = ${Number(process.env.SHOT_FOV)}; let lo = 0.2, hi = 2;
      const frame = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; r.settings.fovScale = m; await frame(); if (r.camera.fov > want) hi = m; else lo = m; }
      return r.camera.fov; })()`);
    console.log("fov set:", Number(got).toFixed(1));
  }
  // WARM=1: a look from every spot first, so the first picture is not the frame that compiles the whole view's materials
  // (the district's haze had not taken in the first picture of a run, and had in the same spot taken again)
  if (process.env.WARM)
    for (const s of SHOTS) {
      await page.evaluate(`(() => { const r = window.__range; clearInterval(window.__hold); window.__hold = setInterval(() => r.player.teleport(${s.eye[0] + BR_X}, ${s.eye[1]}, ${s.eye[2] + BR_Z}, 0, 0), 0); })()`);
      await new Promise((r) => setTimeout(r, 2500));
    }
  for (const s of SHOTS) {
    const [ex, ey, ez] = [s.eye[0] + BR_X, s.eye[1], s.eye[2] + BR_Z];
    const [dx, dy, dz] = [s.at[0] - s.eye[0], s.at[1] - s.eye[1], s.at[2] - s.eye[2]];
    const yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI;
    const pitch = (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
    // held there every frame: there is no free camera, and the body would fall
    await page.evaluate(`(() => { const r = window.__range; clearInterval(window.__hold); window.__hold = setInterval(() => r.player.teleport(${ex}, ${ey}${process.env.EYE ? " - r.player.eye" : ""}, ${ez}, ${yaw}, ${pitch}), 0); })()`);
    // (SETTLE=<ms>: longer, for the haze to ease to a place's own, atmosphere.ts)
    await new Promise((r) => setTimeout(r, Number(process.env.SETTLE ?? 1800)));
    // (FOGLOG=1: the fog and the light as drawn, to set a place's staging by numbers, not only by eye)
    if (process.env.FOGLOG) console.log(s.name, await page.evaluate("(() => { const r = window.__range; const f = r.scene.fog; return JSON.stringify({ fog: f && '#' + f.color.getHexString(), near: f?.near, far: f?.far, env: r.scene.environmentIntensity, tone: r.renderer.toneMapping, exposure: r.renderer.toneMappingExposure }); })()"));
    await page.screenshot({ path: `${OUT}-${PRESET}${BEFORE ? "-before" : ""}-${s.name}.png` });
    console.log(`${OUT}-${PRESET}${BEFORE ? "-before" : ""}-${s.name}.png`);
  }
  await page.evaluate("clearInterval(window.__hold)");
} finally {
  await browser.close();
}
