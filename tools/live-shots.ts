// The soldier with the USSO and BOOG in the game itself, not the lab (Phase 27, 27.12): the owner, 2026-09-30, "Get many
// pics of enemies and third person". tools/figure-frames.ts steps a lab figure through set poses; here the figures are
// the game's own, driven the way the game drives them, photographed a frame at a time as they go:
//
//   enemies   an Arena Bots match: each bot given the USSO or BOOG, photographed from half a dozen metres as its AI
//             moves, fights and reloads (a bot's magazine run down so it does), the camera kept on it as it goes
//   self      your own soldier in third person, driven by the keys a player presses (the page's own keyboard, never
//             the machine's): standing, running and sprinting, a jump, a reload, a swap, a melee string, a grenade;
//             from behind the shoulder as you play it, and orbited round to the front and side
//   remote    another player, over the network: a second page joins a firing range with friends and is driven by keys,
//             and this page photographs the figure it draws of them from what arrives (their stance, speed, aim and
//             act: a reload, a swap and a melee as an enemy's screen shows them)
//
// Each sheet is a row of frames, captioned with what the figure was doing and, measured by tools/figure-audit.js, the
// same faults as the lab's sheets. Run: SHOT_URL=http://localhost:5198/ npx tsx tools/live-shots.ts [out dir]
// PARTS=enemies,self picks (needs the dev server and a real GPU; never the real mouse or keyboard)
import fs from "node:fs";
import path from "node:path";
import puppeteer, { type Page } from "puppeteer";
import sharp from "sharp";

const URL = process.env.SHOT_URL ?? "http://localhost:5198/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = path.resolve(process.argv[2] ?? "shots/live");
const PARTS = (process.env.PARTS ?? "enemies,self,remote").split(",");
const W = 1600;
const H = 1000;
const TILE = { w: 360, h: 420 };
const COLS = 6;
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const ev = <T>(page: Page, expr: string) => page.evaluate(expr) as Promise<T>;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

type Audit = { grip?: number; support?: number; wristL: number; wristR: number; handIn?: { l: number; r: number }; gunIn?: number; palmGap?: { l: number; r: number }; armed?: boolean } | null;
/** the lab's bar, the same faults its sheets flag */
function faults(a: Audit, reloading: boolean): string[] {
  if (!a || !a.armed) return [];
  const bad: string[] = [];
  if (!reloading && (a.grip ?? 0) > 3) bad.push(`grip ${a.grip}cm`);
  if (!reloading && (a.support ?? 0) > 4) bad.push(`support ${a.support}cm`);
  if (Math.max(a.wristL, a.wristR) > 60) bad.push(`wrist ${Math.round(Math.max(a.wristL, a.wristR))}`);
  if (a.handIn && Math.max(a.handIn.l, a.handIn.r) > 6) bad.push(`hand in gun L${a.handIn.l} R${a.handIn.r}mm`);
  if ((a.gunIn ?? 0) > 15) bad.push(`gun in body ${a.gunIn}mm`);
  return bad;
}

async function tile(file: string, line1: string, line2: string, bad: boolean): Promise<Buffer> {
  const svg = `<svg width="${TILE.w}" height="${TILE.h}"><rect width="${TILE.w}" height="34" fill="rgba(0,0,0,0.7)"/><text x="5" y="14" font-family="Arial" font-size="11" fill="#fff">${esc(line1)}</text><text x="5" y="29" font-family="Arial" font-size="11" fill="${bad ? "#ff5050" : "#60ff60"}">${esc(line2)}</text></svg>`;
  return sharp(file).resize(TILE.w, TILE.h, { fit: "cover" }).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
}
async function sheet(tiles: Buffer[], file: string): Promise<void> {
  const rows = Math.ceil(tiles.length / COLS);
  await sharp({ create: { width: TILE.w * COLS, height: TILE.h * rows, channels: 3, background: "#000" } })
    .composite(tiles.map((t, i) => ({ input: t, left: (i % COLS) * TILE.w, top: Math.floor(i / COLS) * TILE.h })))
    .png()
    .toFile(file);
  console.log(file);
}

/** where a figure is on screen, padded, as a crop (null when it is not in front of the camera) */
async function cropAround(page: Page, figExpr: string): Promise<{ x: number; y: number; width: number; height: number } | null> {
  const b = await ev<{ x0: number; y0: number; x1: number; y1: number } | null>(
    page,
    `(() => {
      const r = window.__range, T = r.THREE, f = ${figExpr};
      if (!f) return null;
      const g = f.group; g.updateMatrixWorld(true);
      const p = g.getWorldPosition(new T.Vector3());
      const pts = [p.clone(), p.clone().setY(p.y + 1.9)];
      const cam = r.camera;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const q of pts) { const v = q.project(cam); if (v.z > 1) return null; const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      return { x0, y0, x1, y1 };
    })()`,
  );
  if (!b) return null;
  const h = Math.min(H, (b.y1 - b.y0) * 1.35);
  const w = (h * TILE.w) / TILE.h;
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const x = Math.max(0, Math.min(W - w, cx - w / 2));
  const y = Math.max(0, Math.min(H - h, cy - h / 2));
  if (w < 40 || h < 40) return null;
  return { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };
}

/** the audit of a figure the game drives (a Dummy): figure-audit.js measures lab figures, so it is lent this one */
const auditOf = (figExpr: string, pitch = 0) =>
  `(() => { const r = window.__range, f = ${figExpr}; if (!f) return null; const keep = r.labFigures; r.labFigures = () => [f]; try { return window.__figureAudit(0, { pitch: ${pitch} }); } finally { r.labFigures = keep; } })()`;

async function enemies(page: Page): Promise<void> {
  await ev(page, `(() => { document.getElementById("botCount").value = "4"; document.getElementById("botDifficulty").value = "easy"; window.__range.startBots(); })()`);
  await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 30000 }).catch(() => console.log("the bot match did not start fighting"));
  await ev(page, `(() => { const d = window.__range.duel(); d.bots.forEach((b, i) => b.setWeapon(i % 2 ? "sentinel" : "r97")); })()`);
  await wait(1500);
  // (the menu stays over the game in a scripted page, which has no click to take the lock: it is put away by hand)
  await ev(page, `(() => { const r = window.__range; document.getElementById("overlay").classList.add("hidden"); r.input.locked = true; r.hideViewModel(true); r.shotFov(45); document.getElementById("hud")?.style.setProperty("visibility", "hidden"); })()`);
  const n = await ev<number>(page, "window.__range.duel().bots.length");
  for (let i = 0; i < n; i++) {
    const gun = await ev<string>(page, `window.__range.duel().bots[${i}].weapon.id`);
    const tiles: Buffer[] = [];
    for (let k = 0; k < 24; k++) {
      // a reload now and then: its magazine run down to its last round, so its next shot empties it
      if (k === 6 || k === 16) await ev(page, `(() => { const b = window.__range.duel().bots[${i}]; b.mag.left = 1; })()`);
      // the camera 6 m off the bot, a little to its side, looking at it; the player kept alive to watch
      const seen = await ev<{ act: string | null; speed: number; alive: boolean } | null>(
        page,
        `(() => {
          const r = window.__range, b = r.duel().bots[${i}];
          if (!b || !b.alive) return null;
          const g = b.dummy.group, p = g.position;
          const a = g.rotation.y + ${0.9 + (k % 8) * 0.55};
          const cx = p.x + Math.sin(a) * 6, cz = p.z + Math.cos(a) * 6;
          const dx = p.x - cx, dz = p.z - cz;
          r.player.teleport(cx, p.y, cz, Math.atan2(-dx, -dz) * 180 / Math.PI, -6);
          const d = r.duel(); d.health = 100; d.shield = d.shieldMax;
          document.getElementById("overlay").classList.add("hidden");
          const pose = b.dummy.pose || {};
          return { act: pose.act ?? null, speed: pose.speed ?? 0, alive: b.alive };
        })()`,
      );
      await wait(180);
      if (!seen) {
        await wait(400);
        continue;
      }
      const crop = await cropAround(page, `window.__range.duel().bots[${i}].dummy`);
      if (!crop) continue;
      const file = path.join(OUT, "enemies", `bot${i}-${gun}-${String(k).padStart(2, "0")}.png`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await page.screenshot({ path: file as `${string}.png`, clip: crop });
      const a = await ev<Audit>(page, auditOf(`window.__range.duel().bots[${i}].dummy`, 0));
      const bad = faults(a, seen.act === "reload");
      tiles.push(await tile(file, `bot ${i} ${gun} ${seen.act ?? (seen.speed > 6 ? "sprint" : seen.speed > 0.3 ? "move" : "still")} ${seen.speed.toFixed(1)} m/s`, bad.length ? bad.join(", ") : "ok", bad.length > 0));
    }
    if (tiles.length) await sheet(tiles, path.join(OUT, `enemy-bot${i}-${gun}-sheet.png`));
  }
  await ev(page, "window.__range.duel()?.leave()");
  await wait(800);
}

/** keys a player presses, to the page (puppeteer's keyboard reaches the page only, never the machine) */
async function press(page: Page, code: string, holdMs = 60): Promise<void> {
  await page.keyboard.down(code as never);
  await wait(holdMs);
  await page.keyboard.up(code as never);
}

async function self(page: Page): Promise<void> {
  // the range, your loadout the USSO then BOOG, third person
  await ev(page, `(() => { const r = window.__range; r.loadouts.copyTo({ kind: "default", index: 0 }, 0); r.loadouts.edit(0, { slot1: "r97", slot2: "sentinel" }); })()`);
  await ev(page, `(() => { const s = document.getElementById("cameraMode"); s.value = "third"; s.dispatchEvent(new Event("change")); const r = window.__range; r.hideViewModel(true); document.getElementById("hud")?.style.setProperty("visibility", "hidden"); document.getElementById("overlay").classList.add("hidden"); r.input.locked = true; r.shotFov(60); r.player.teleport(0, 0, -4, 0, 0); })()`);
  await wait(1500);
  const selfExpr = `window.__range.selfFigure()`;
  const has = await ev<boolean>(page, `!!(${selfExpr})`);
  if (!has) console.log("no third-person figure yet: it is photographed but not measured");
  // each action: what the keys do, and for how long to photograph it; views: behind the shoulder, then orbited round
  const actions: Array<{ name: string; start: (p: Page) => Promise<void>; stop?: (p: Page) => Promise<void>; frames: number; every: number }> = [
    { name: "stand", start: async () => undefined, frames: 6, every: 200 },
    {
      name: "run",
      start: (p) => ev(p, `window.__range.setScript({ held: (a) => a === "forward", pressedNow: () => false })`),
      stop: (p) => ev(p, "window.__range.setScript(null)"),
      frames: 12,
      every: 90,
    },
    {
      name: "sprint-jump",
      start: async (p) => {
        await ev(p, `(() => { let t = 0; window.__range.setScript({ held: (a) => a === "forward" || a === "sprint", pressedNow: (a) => a === "jump" && (++t === 25) }); })()`);
      },
      stop: (p) => ev(p, "window.__range.setScript(null)"),
      frames: 18,
      every: 70,
    },
    {
      // a few rounds first: a full magazine does not reload
      name: "reload",
      start: async (p) => {
        await ev(p, `window.__range.setScript({ held: (a) => a === "fire", pressedNow: () => false })`);
        await wait(400);
        await ev(p, "window.__range.setScript(null)");
        await wait(200);
        await press(p, "KeyR");
      },
      frames: 24,
      every: 90,
    },
    {
      name: "fire",
      start: (p) => ev(p, `window.__range.setScript({ held: (a) => a === "fire" || a === "ads", pressedNow: () => false })`),
      stop: (p) => ev(p, "window.__range.setScript(null)"),
      frames: 12,
      every: 60,
    },
    { name: "swap", start: (p) => press(p, "Digit2"), frames: 20, every: 80 },
    { name: "swap-back", start: (p) => press(p, "Digit1"), frames: 20, every: 80 },
    {
      name: "melee",
      // one swing, photographed as fast as the page gives frames (it is 0.38 s)
      start: (p) => press(p, "KeyV", 20),
      frames: 10,
      every: 0,
    },
  ];
  const views: Array<[string, number, number]> = [
    ["behind", 0, 0],
    ["front", 180, -5],
    ["side", 100, -5],
  ];
  for (const [vname, yaw, pitch] of views) {
    const tiles: Buffer[] = [];
    for (const act of actions) {
      await ev(page, `(() => { const r = window.__range; r.player.teleport(0, 0, -4, 0, 0); r.setOrbit(${yaw}, ${pitch}, ${yaw !== 0}); })()`);
      await wait(900);
      await act.start(page);
      for (let k = 0; k < act.frames; k++) {
        await wait(act.every);
        const crop = await cropAround(page, selfExpr);
        if (!crop) continue;
        const file = path.join(OUT, "self", `${vname}-${act.name}-${String(k).padStart(2, "0")}.png`);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        await page.screenshot({ path: file as `${string}.png`, clip: crop });
        const st = await ev<{ gun: string; stance: string }>(page, `(() => { const r = window.__range; return { gun: r.loadout.active.id, stance: r.player.stance }; })()`);
        const a = has ? await ev<Audit>(page, auditOf(selfExpr)) : null;
        const bad = faults(a, act.name === "reload");
        if (act.every === 0 || k % Math.max(1, Math.round(act.frames / 6)) === 0 || bad.length) tiles.push(await tile(file, `${vname} ${act.name} ${k * act.every} ms ${st.gun} ${st.stance}`, bad.length ? bad.join(", ") : "ok", bad.length > 0));
      }
      if (act.stop) await act.stop(page);
      await wait(600);
    }
    await ev(page, "window.__range.setOrbit(0, 0, false)");
    if (tiles.length) await sheet(tiles, path.join(OUT, `self-${vname}-sheet.png`));
  }
}

async function remote(browser: import("puppeteer").Browser, host: Page): Promise<void> {
  const guest = await browser.newPage();
  await guest.setViewport({ width: 800, height: 600, deviceScaleFactor: 1 });
  await guest.evaluateOnNewDocument(NO_REAL_MOUSE);
  await guest.evaluateOnNewDocument(() => localStorage.setItem("range.welcomed", "1"));
  await guest.goto(`${URL}${URL.includes("?") ? "&" : "?"}game=speedkills&nointro&norender&net=local`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await guest.waitForFunction("Boolean(window.__range) && window.__range.loaded() && window.__range.soldierReady()", { polling: 250, timeout: 90000 });
  await guest.waitForFunction("window.__range.paidGuns().ready", { polling: 250, timeout: 60000 }).catch(() => undefined);
  await ev(guest, `(() => { const r = window.__range; r.profile.setName("FRIEND"); r.loadouts.copyTo({ kind: "default", index: 0 }, 0); r.loadouts.edit(0, { slot1: "r97", slot2: "sentinel" }); })()`);
  // the drawing page in front: a page behind another gets no frames to draw
  await host.bringToFront();
  await ev(host, `(() => { document.getElementById("overlay").classList.remove("hidden"); document.getElementById("duelMode").value = "arena"; document.getElementById("duelPlayers").value = "2"; document.getElementById("duelHost").click(); })()`);
  await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
  const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
  await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
  for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  await ev(guest, `(() => { const r = window.__range; document.getElementById("overlay").classList.add("hidden"); r.input.locked = true; })()`);
  await ev(host, `(() => { const r = window.__range; document.getElementById("overlay").classList.add("hidden"); r.input.locked = true; r.hideViewModel(true); r.shotFov(45); document.getElementById("hud")?.style.setProperty("visibility", "hidden"); const s = document.getElementById("cameraMode"); s.value = "first"; s.dispatchEvent(new Event("change")); })()`);
  await host.waitForFunction("window.__range.duel().avatars.length > 0 && window.__range.duel().avatars[0].group.visible", { polling: 200, timeout: 20000 }).catch(() => console.log("the other player's figure did not show"));
  await wait(1500);
  for (const p of [host, guest]) await p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 30000 }).catch(() => console.log("the round did not start"));
  const them = "window.__range.duel().avatars[0]";
  const hold = (what: string) => (p: Page) => ev<void>(p, `window.__range.setScript({ held: (a) => ${what}, pressedNow: () => false })`);
  const free = (p: Page) => ev<void>(p, "window.__range.setScript(null)");
  const actions: Array<{ name: string; start: (p: Page) => Promise<void>; stop?: (p: Page) => Promise<void>; frames: number; every: number }> = [
    { name: "stand", start: async () => undefined, frames: 4, every: 250 },
    { name: "aim", start: hold(`a === "ads"`), stop: free, frames: 5, every: 200 },
    { name: "fire", start: hold(`a === "fire" || a === "ads"`), stop: free, frames: 8, every: 60 },
    { name: "reload", start: (p) => press(p, "KeyR"), frames: 16, every: 80 },
    { name: "swap", start: (p) => press(p, "Digit2"), frames: 14, every: 80 },
    { name: "aim-boog", start: hold(`a === "ads"`), stop: free, frames: 4, every: 200 },
    { name: "swap-back", start: (p) => press(p, "Digit1"), frames: 14, every: 80 },
    { name: "melee", start: (p) => press(p, "KeyV", 20), frames: 8, every: 0 },
    { name: "crouch", start: hold(`a === "crouch"`), stop: free, frames: 4, every: 200 },
    { name: "run", start: hold(`a === "left"`), stop: free, frames: 8, every: 90 },
  ];
  for (const [vname, ang] of [["front", 0.5], ["right", -1.4], ["left", 1.7]] as Array<[string, number]>) {
    const tiles: Buffer[] = [];
    for (const act of actions) {
      // (neither can hurt the other: this page holds its fire, and the other's shots are given back each frame)
      await ev(host, `(() => { const d = window.__range.duel(); d.holdFire = true; d.health = 100; d.shield = d.shieldMax; })()`);
      await wait(500);
      await act.start(guest);
      for (let k = 0; k < act.frames; k++) {
        if (act.every) await wait(act.every);
        // the camera 4.5 m off their figure, at this view's angle from the way it faces
        const seen = await ev<{ act: string | null; speed: number; gun: string | null } | null>(
          host,
          `(() => {
            const r = window.__range, d = ${them};
            if (!d) return null;
            const g = d.group, p = g.position, a = g.rotation.y + ${ang};
            const cx = p.x + Math.sin(a) * 4.5, cz = p.z + Math.cos(a) * 4.5;
            r.player.teleport(cx, p.y, cz, Math.atan2(-(p.x - cx), -(p.z - cz)) * 180 / Math.PI, -6);
            const m = r.duel(); m.health = 100; m.shield = m.shieldMax;
            const pose = d.pose || {};
            return { act: pose.act ?? null, speed: pose.speed ?? 0, gun: d.armedId };
          })()`,
        );
        if (!seen) continue;
        await wait(40);
        const crop = await cropAround(host, them);
        if (!crop) continue;
        const file = path.join(OUT, "remote", `${vname}-${act.name}-${String(k).padStart(2, "0")}.png`);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        await host.screenshot({ path: file as `${string}.png`, clip: crop });
        const a = await ev<Audit>(host, auditOf(them));
        const bad = faults(a, seen.act === "reload" || seen.act === "swap");
        tiles.push(await tile(file, `${vname} ${act.name} ${k} ${seen.gun} ${seen.act ?? "-"} ${seen.speed.toFixed(1)} m/s`, bad.length ? bad.join(", ") : "ok", bad.length > 0));
      }
      if (act.stop) await act.stop(guest);
      await wait(500);
    }
    if (tiles.length) await sheet(tiles, path.join(OUT, `remote-${vname}-sheet.png`));
  }
  await guest.close();
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(NO_REAL_MOUSE);
    await page.evaluateOnNewDocument(() => localStorage.setItem("range.welcomed", "1"));
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${URL}${URL.includes("?") ? "&" : "?"}game=speedkills&nointro${PARTS.includes("remote") ? "&net=local" : ""}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction("Boolean(window.__range) && window.__range.loaded() && window.__range.soldierReady()", { polling: 250, timeout: 90000 });
    await page.waitForFunction("window.__range.paidGuns().ready", { polling: 250, timeout: 60000 }).catch(() => console.log("the bought guns did not load"));
    await page.addScriptTag({ path: path.resolve("tools/figure-audit.js") });
    if (PARTS.includes("enemies")) await enemies(page);
    if (PARTS.includes("self")) await self(page);
    if (PARTS.includes("remote")) await remote(browser, page);
    console.log(errors.length ? `page errors:\n${errors.slice(0, 10).join("\n")}` : "no page errors");
  } finally {
    await browser.close();
  }
}

void main();
