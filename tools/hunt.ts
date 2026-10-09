// The bug hunt: one drawn SpeedKills page plays every mode in turn, driven by a crude player (aim at the nearest enemy
// in sight, fire, close in, strafe, jump, slide, hacks, swaps, melee, pick up), while a watchdog in the page notes
// anything wrong: page and console errors and failed requests, NaN or fallen-through positions (you, the camera, every
// figure), health out of its range, NaN in the HUD's numbers, frames over 120 ms (with what was new on them: shaders,
// textures, geometry), a battle royale bot standing still alive and landed for 25 s. Between modes, back in the range,
// what the page holds (geometries, textures, programs, scene objects, JS heap), so a leak is a number; assets fetched
// more than once; a screenshot every 5 s of each mode. Built for the owner's "go on a bug hunt across all functionality"
// (2026-09-30): it found bots standing under decks and inside care packages for the rest of a match, the Gulag's first
// frame a 0.75 s freeze, the silent music streamed, and the soldier's body fetched twice. Headless on the GPU, never the
// real mouse or keyboard.
//
// Run: SHOT_URL=http://localhost:5199/ npx tsx tools/hunt.ts
//   OUT=<folder> (default shots/hunt), SCENES=range,br,bots,... (default every mode), QUERY=<page query>
import puppeteer from "puppeteer";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = process.env.SHOT_URL ?? "http://localhost:5173/";
const OUT = process.env.OUT ?? "shots/hunt";
const QUERY = process.env.QUERY ?? "?game=speedkills";
const SCENES = (process.env.SCENES ?? "range,br,bots,tdm,control,ffa,run,tour,lab").split(",");
const SECS: Record<string, number> = { range: 40, br: 240, bots: 70, tdm: 70, control: 70, ffa: 70, run: 25, tour: 20, lab: 20 };
const GO: Record<string, string> = { range: "goRange", br: "goBr", bots: "goBots", tdm: "goTdm", control: "goControl", ffa: "goFfa", run: "goRun", tour: "goTour", lab: "goLab" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const INSTALL = `(() => {
  const R = window.__range; const V = R.THREE.Vector3;
  const H = window.__hunt = { scene: "boot", issues: {}, stats: {}, maxCalls: 0 };
  const issue = (kind, detail) => { const k = H.scene + " | " + kind + " | " + detail; const e = H.issues[k] || (H.issues[k] = { n: 0, first: performance.now() / 1000 }); e.n++; };
  H.issue = issue;
  // frame gaps
  let prev = performance.now();
  let was = { p: 0, t: 0, g: 0 };
  H.stalls = [];
  const tick = (now) => { const g = now - prev; prev = now;
    const info = R.renderer.info; const cur = { p: info.programs?.length ?? 0, t: info.memory.textures, g: info.memory.geometries };
    if (g > 120 && !document.hidden) { const d = R.duel(); const h = R.hud && R.hud.last;
      H.stalls.push({ at: +(now / 1000).toFixed(1), ms: Math.round(g), scene: H.scene, phase: d ? d.phase : null, aboard: R.player.aboard, dropping: R.player.dropping, killcam: R.killcamState().active, gulag: d && d.gulag ? (d.gulag.phase ?? true) : null, dPrograms: cur.p - was.p, dTextures: cur.t - was.t, dGeometries: cur.g - was.g, notice: h ? (h.notice ?? h.notices ?? null) : null, feed: h && h.feed ? JSON.stringify(h.feed).slice(-160) : null });
      if (g > 250) issue("stall", (g > 1000 ? ">1s" : ">250ms") + " " + (d ? (d.phase + (R.player.aboard ? " aboard" : "")) : "no match")); }
    was = cur; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const bad = (v) => typeof v === "number" && !Number.isFinite(v);
  const still = new Map();
  setInterval(() => {
    try {
      const p = R.player; const d = R.duel();
      if (bad(p.pos.x) || bad(p.pos.y) || bad(p.pos.z)) issue("player pos NaN", "");
      if (p.pos.y < -30) issue("player below the world", p.pos.y.toFixed(0));
      if (bad(p.yaw) || bad(p.pitch)) issue("player angles NaN", "");
      const c = R.cameraPos(); if (c.some(bad)) issue("camera NaN", "");
      if (d) {
        if (bad(d.health) || bad(d.shield)) issue("health NaN", d.health + "/" + d.shield);
        if (d.health < 0 || d.shield < 0) issue("health below zero", d.health + "/" + d.shield);
        if (d.shieldMax !== undefined && d.shield > d.shieldMax + 0.5) issue("shield over max", d.shield + " > " + d.shieldMax);
        for (const a of d.avatars || []) {
          const g = a.group.position;
          if (bad(g.x) || bad(g.y) || bad(g.z)) issue("figure pos NaN", "");
          else if (a.group.visible && g.y < -30) issue("figure below the world", g.y.toFixed(0));
        }
        // a battle royale's bots: one alive, landed, up and not aboard that has not moved 0.3 m in 25 s
        for (const b of d.bots || []) {
          const bot = b.bot || b; if (!bot || !bot.pos) continue;
          if (bad(bot.pos.x) || bad(bot.pos.y) || bad(bot.pos.z)) { issue("bot pos NaN", ""); continue; }
          if (!bot.alive || bot.aboard || bot.dropping || b.down || b.guard) { still.delete(bot); continue; }
          const now = performance.now() / 1000; const s = still.get(bot);
          if (!s || Math.hypot(bot.pos.x - s.x, bot.pos.z - s.z) > 0.3) still.set(bot, { x: bot.pos.x, z: bot.pos.z, at: now, told: false });
          else if (now - s.at > 25 && !s.told) { s.told = true; issue("bot stood still 25 s", (bot.remote?.name ?? "?") + " at " + bot.pos.x.toFixed(0) + "," + bot.pos.y.toFixed(1) + "," + bot.pos.z.toFixed(0)); }
        }
      }
      const h = R.hud && R.hud.last;
      // (an infinite reserve is SpeedKills' rule, not a fault: NaN only)
      const nan = (v) => typeof v === "number" && Number.isNaN(v);
      if (h) for (const [k, v] of Object.entries(h)) {
        if (nan(v)) issue("hud NaN", k);
        else if (v && typeof v === "object" && !Array.isArray(v)) for (const [k2, v2] of Object.entries(v)) if (nan(v2)) issue("hud NaN", k + "." + k2);
      }
      const calls = R.renderer.info.render.calls; if (calls > H.maxCalls) H.maxCalls = calls;
    } catch (e) { issue("watchdog threw", String(e).slice(0, 120)); }
  }, 250);

  // the player
  const held = new Set(); const queued = new Set(); let pressed = new Set();
  const input = { held: (a) => held.has(a), pressedNow: (a) => pressed.has(a) };
  const press = (a) => queued.add(a);
  let sawAt = performance.now() / 1000; let last = null; let stuckAt = performance.now() / 1000;
  H.mode = "fight";
  const hook = () => {
    pressed = new Set(queued); queued.clear(); held.clear();
    const now = performance.now() / 1000;
    const p = R.player; const d = R.duel();
    if (H.mode === "off") return;
    if (R.intro.state().kind !== null) return;
    const L = document.getElementById("loading"); if (L && !L.hidden && !L.classList.contains("done")) return;
    if (H.mode === "range") return;
    if (p.aboard) { if (d && d.ship && d.ship.doorsIn(now) <= 0 && Math.random() < 0.01) press("jump"); return; }
    if (p.dropping) { p.pitch = -55; held.add("forward"); return; }
    if (!d) { held.add("forward"); if (Math.random() < 0.01) press("jump"); return; }
    const eye = p.eyePosition();
    let best = null, bd = 1e9;
    for (const a of d.avatars || []) {
      if (!a.group.visible) continue;
      const r = d.remoteOf ? d.remoteOf(a) : null; if (!r || !r.alive || (d.isAlly && d.isAlly(r.id))) continue;
      const g = a.group.position; const dist = Math.hypot(g.x - eye.x, g.y - eye.y, g.z - eye.z);
      if (dist < bd) { bd = dist; best = a; }
    }
    if (best) {
      const g = best.group.position; const chest = new V(g.x, g.y + 1.2, g.z);
      const dx = chest.x - eye.x, dz = chest.z - eye.z, dy = chest.y - eye.y;
      p.yaw = Math.atan2(-dx, -dz) * 180 / Math.PI + (Math.random() - 0.5) * 3;
      p.pitch = Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI + (Math.random() - 0.5) * 3;
      const see = R.clearTo(chest);
      if (see) sawAt = now;
      if (see && bd < 90) { held.add("fire"); if (bd > 20) held.add("ads"); }
      if (!see || bd > 14) { held.add("forward"); if (!see) held.add("sprint"); }
      held.add(Math.floor(now / 0.8) % 2 ? "left" : "right");
      if (bd < 2.5 && Math.random() < 0.05) press("melee");
      // no fight for 20 s: go to one (4 m off the nearest, on its floor)
      if (now - sawAt > 20 && d.phase !== "waiting") { sawAt = now; p.teleport(g.x + 4, g.y + 0.1, g.z, p.yaw); H.teleports = (H.teleports || 0) + 1; }
    } else { held.add("forward"); held.add("sprint"); p.yaw += 0.4; }
    if (Math.random() < 0.012) press("jump");
    if (Math.random() < 0.006) press("crouch");
    if (Math.random() < 0.004) press("swapWeapon");
    if (Math.random() < 0.004) press("ability");
    if (Math.random() < 0.003) press("grenade");
    if (Math.random() < 0.01) press("interact");
    if (Math.random() < 0.002) press("reload");
    if (Math.random() < 0.001) press("inspect");
    // stuck against something: jump and turn
    if (last && Math.hypot(p.pos.x - last.x, p.pos.z - last.z) > 1.5) { last = { x: p.pos.x, z: p.pos.z }; stuckAt = now; }
    if (!last) last = { x: p.pos.x, z: p.pos.z };
    if (now - stuckAt > 4) { press("jump"); p.yaw += 90; stuckAt = now; }
  };
  R.setScript(input, hook);
  H.restore = () => R.setScript(input, hook);
  return true;
})()`;

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 180000, args: ["--use-gl=angle", "--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-sandbox", "--mute-audio", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 720 });
  await p.evaluateOnNewDocument(`for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`);
  const errors: Record<string, number> = {};
  let scene = "boot";
  const note = (s: string) => { const k = `${scene} | ${s.slice(0, 220)}`; errors[k] = (errors[k] ?? 0) + 1; };
  p.on("pageerror", (e) => note(`pageerror: ${String(e)}`));
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warn") note(`console.${m.type()}: ${m.text()}`); });
  p.on("response", (r) => { if (r.status() >= 400) note(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+\//, "")}`); });
  p.on("requestfailed", (r) => note(`request failed ${r.method()} ${r.url().replace(/^https?:\/\/[^/]+\//, "")} ${r.failure()?.errorText}`));
  // every asset asked for more than once: a big file downloaded twice is a real cost
  const asked = new Map<string, string[]>();
  p.on("request", (r) => {
    const u = r.url().replace(/^https?:\/\/[^/]+\//, "");
    if (!/\.(glb|webp|hdr|ktx2|mp3|ogg|wav|png|jpg)(\?|$)/.test(u)) return;
    const l = asked.get(u) ?? [];
    l.push(`${r.method()}@${scene}`);
    asked.set(u, l);
  });
  await p.goto(`${URL}${QUERY}`, { waitUntil: "domcontentloaded" });
  await p.waitForFunction(`(() => { const L = document.getElementById("loading"); return window.__range && (!L || L.hidden || L.classList.contains("done")); })()`, { polling: 250, timeout: 180000 });
  await sleep(2000);
  await p.evaluate(INSTALL);
  const holds: Array<Record<string, unknown>> = [];
  const hold = async (label: string) => holds.push({ after: label, ...((await p.evaluate(`(() => { const R = window.__range; const m = R.renderer.info.memory; let objs = 0; R.scene.traverse(() => objs++);
    return { geometries: m.geometries, textures: m.textures, programs: R.renderer.info.programs?.length ?? null, objects: objs, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, fx: R.fxCount?.(), walls: R.wallCount?.(), maxCalls: window.__hunt.maxCalls }; })()`)) as object) });
  await hold("boot");
  for (const s of SCENES) {
    scene = s;
    const dir = `${OUT}/${s}`;
    mkdirSync(dir, { recursive: true });
    console.log(`-- ${s}`);
    await p.evaluate(`(() => { window.__hunt.scene = "${s}"; window.__hunt.maxCalls = 0; window.__hunt.mode = "${s === "range" ? "range" : "fight"}"; })()`);
    // the menu, the mode's card, its green button: as a player does (the pointer as a real click takes it)
    await p.evaluate(`(() => { const R = window.__range; R.toMenu?.(); })()`);
    await sleep(600);
    await p.evaluate(`(() => { const R = window.__range; document.getElementById("${GO[s]}").click(); document.getElementById("startMode").click(); R.input.locked = true; document.getElementById("overlay").style.display = "none"; })()`);
    const t0 = Date.now();
    let shot = 0;
    const events: string[] = [];
    let lastState = "";
    while (Date.now() - t0 < SECS[s] * 1000) {
      if (s === "range") {
        // every gun of the roster in turn: given, fired at a dummy 1.5 s, reloaded, inspected, swapped
        const roster = (JSON.parse(readFileSync("src/config/games/speedkills.json", "utf8")) as { roster: string[] }).roster;
        for (const id of roster) {
          await p.evaluate(`(() => { const R = window.__range; try { R.loadout.give(0, "${id}"); R.loadout.setWeaponId(0, "${id}"); } catch (e) { window.__hunt.issue("range give threw", "${id} " + String(e).slice(0, 80)); } })()`);
          for (let k = 0; k < 15; k++) {
            await p.evaluate(`(() => { const R = window.__range; const dm = R.dummies[k % R.dummies.length]; if (!dm) return; const g = dm.group.position; const e = R.player.eyePosition(); const dx = g.x - e.x, dz = g.z - e.z, dy = g.y + 1.2 - e.y; R.player.yaw = Math.atan2(-dx, -dz) * 180 / Math.PI; R.player.pitch = Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI; })()`.replace("k %", `${k} %`));
            await p.evaluate(`window.__range.setScript({ held: (a) => a === "fire", pressedNow: () => false }, null)`);
            await sleep(100);
          }
          await p.evaluate(`window.__range.setScript({ held: () => false, pressedNow: (a) => a === "reload" }, null)`);
          await sleep(300);
          await p.evaluate(`window.__range.setScript({ held: () => false, pressedNow: (a) => a === "inspect" }, null)`);
          await sleep(300);
        }
        await p.evaluate(`window.__hunt.restore()`);
        break;
      }
      const st = (await p.evaluate(`(() => { const R = window.__range; const d = R.duel(); return d ? (d.phase + (R.player.aboard ? " aboard" : R.player.dropping ? " dropping" : "") + (d.alive === false ? " dead" : "") + (d.gulag ? " gulag" : "")) : "none"; })()`)) as string;
      if (st !== lastState) { events.push(`${((Date.now() - t0) / 1000).toFixed(0)}s ${st}`); lastState = st; }
      if (Date.now() - t0 > shot * 5000) {
        await p.screenshot({ path: `${dir}/s${String(shot).padStart(2, "0")}.jpg`, type: "jpeg", quality: 55 }).catch(() => undefined);
        shot++;
      }
      await sleep(500);
    }
    console.log(`   ${events.join(" -> ")}`);
    const summary = await p.evaluate(`(() => { const R = window.__range; const d = R.duel(); return { hud: d?.hud?.() ? Object.keys(d.hud()).slice(0, 12) : null, teleports: window.__hunt.teleports || 0, kills: R.stats?.()?.kills ?? null }; })()`).catch((e) => ({ threw: String(e) }));
    console.log(`   ${JSON.stringify(summary)}`);
    // back to the range, and what the page holds there
    await p.evaluate(`(() => { const R = window.__range; window.__hunt.mode = "off"; if (R.duel()) R.leaveMatch(); })()`).catch(() => undefined);
    await sleep(3000);
    await hold(s);
  }
  const issues = (await p.evaluate(`window.__hunt.issues`)) as Record<string, { n: number; first: number }>;
  const stalls = (await p.evaluate(`window.__hunt.stalls`)) as unknown[];
  console.log("== frames over 120 ms");
  for (const x of stalls) console.log(`   ${JSON.stringify(x)}`);
  writeFileSync(`${OUT}/issues.json`, JSON.stringify({ issues, errors, holds }, null, 1));
  console.log("\n== issues (watchdog)");
  for (const [k, v] of Object.entries(issues)) console.log(`${String(v.n).padStart(5)}  ${k}`);
  console.log("\n== errors (page, console, network)");
  for (const [k, v] of Object.entries(errors)) console.log(`${String(v).padStart(5)}  ${k}`);
  console.log("\n== assets asked for more than once");
  for (const [u, l] of asked) if (l.filter((x) => x.startsWith("GET")).length > 1) console.log(`   ${u}: ${l.join(" ")}`);
  console.log("\n== what the page holds, back in the range after each");
  for (const h of holds) console.log(`   ${JSON.stringify(h)}`);
  await browser.close();
}
void main();
