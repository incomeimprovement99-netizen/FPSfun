// Every frame of the bought arms' reload and swap, as contact sheets and numbers, so a gun on them is checked start to end
// rather than at a few moments (the owner, 2026-09-28: "check all frames of the reload for pinpoint accuracy, and ensure
// the hands are the correct size and on the correct area at all times, not glitching through the gun at any point").
// For each frame it reads where the finger points and how far off (fprig.ts seen), each wrist's bend, whether either arm
// falls short of the gun, and how much of the hands' skin is inside the gun: each hand vertex (a sample) against the nearest
// part's surface (tools/pack-audit.js). A grip's fingers touch the gun, so only skin deeper than `DEEP` counts.
//
// Run: SHOT_URL=http://localhost:5196/ npx tsx tools/pack-frames.ts <out dir> [ids...]   (SEQ=reload,tactical,swap,ads,pickup,inspect,flourish,melee STEP=0.04; tactical: a reload begun with rounds still in the magazine)
// At the owner's view (1920 by 1080, FOV setting 1.571). Headless, never the real mouse or keyboard.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import sharp from "sharp";

const URL = process.env.SHOT_URL ?? "http://localhost:5196/";
const OUT = process.argv[2] ?? "pack-frames";
const IDS = process.argv.length > 3 ? process.argv.slice(3) : ["r97", "sentinel"];
const SEQ = (process.env.SEQ ?? "reload,swap").split(",");
const STEP = Number(process.env.STEP ?? 0.04);
/** FROM= and TO=: only that stretch of each sequence (shares of it) */
const FROM = Number(process.env.FROM ?? 0);
const TO = Number(process.env.TO ?? 1);
const FOV = Number(process.env.FOV ?? 1.571);
/** XRAY=1: each frame again with the gun see-through and every hand point inside it marked red, to see where */
const XRAY = process.env.XRAY === "1";
/** skin deeper than this inside the gun is a hand through it, metres in the view (a grip's fingers touch it) */
const DEEP = 0.004;
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
// the part of the screen the arms and gun are in, and each tile's size on the sheet
const CROP = { left: 360, top: 200, width: 1560, height: 880 };
const TILE = { w: 468, h: 264 };
const COLS = 5;

// in the page: the hands' skin against our gun, this frame (tools/pack-audit.js)
const AUDIT = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "pack-audit.js"), "utf8");

type Frame = { at: number; file: string; s: Record<string, number | string>; a: { l: number; r: number; seenL: number; seenR: number; seenDeepest: number; deepest: number; where: Record<string, number>; tested: number; touch: number; self: boolean; selfShare?: number } | null };
/** where the hands and the gun are, in the view's own space, for the frame-to-frame jumps */
type Place = { l: number[] | null; r: number[] | null; gc: number[] | null; gq: number[] | null };
// (the owner, 2026-09-30: "ensuring each frame is perfect, no resetting states, jumping UI, or bugging in any frame from
// start to finish for each animation type"): each hand and the gun measured every frame and against the hold before and
// after, and a move flagged as a jump where it is a spike, JUMP_MM and more and JUMP_K times the moves either side of it
const JUMP_MM = 25;
const JUMP_DEG = 8;
const JUMP_K = 2.5;
const PLACE = `(() => {
  const r = window.__range; const T = r.THREE; const root = r.viewModelRoot();
  root.updateWorldMatrix(true, true);
  const inv = new T.Matrix4().copy(root.matrixWorld).invert();
  const g = r.packRig().group;
  const at = (n) => { const b = g.getObjectByName(n); return b ? b.getWorldPosition(new T.Vector3()).applyMatrix4(inv).toArray() : null; };
  let gun = null;
  root.traverse((o) => { if (o.userData && o.userData.paid && !gun) gun = o; });
  // (the gun's own origin, not its box: the box takes in the magazine and handle, which move on their own)
  const gc = gun ? gun.getWorldPosition(new T.Vector3()).applyMatrix4(inv).toArray() : null;
  const gq = gun ? gun.getWorldQuaternion(new T.Quaternion()).premultiply(root.getWorldQuaternion(new T.Quaternion()).invert()).toArray() : null;
  return { l: at("hand_l"), r: at("hand_r"), gc, gq };
})()`;
/** each move between two places: the hands' and the gun's middle's in mm (view metres) and the gun's turn in degrees */
function moves(a: Place, b: Place): { l: number; r: number; gc: number; gq: number } {
  const d = (x: number[] | null, y: number[] | null) => (x && y ? Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) * 1000 : 0);
  const q = (x: number[] | null, y: number[] | null) => (x && y ? (2 * Math.acos(Math.min(1, Math.abs(x[0] * y[0] + x[1] * y[1] + x[2] * y[2] + x[3] * y[3]))) * 180) / Math.PI : 0);
  return { l: d(a.l, b.l), r: d(a.r, b.r), gc: d(a.gc, b.gc), gq: q(a.gq, b.gq) };
}

fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  await page.evaluateOnNewDocument(`try { const k = "range.settings.v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.fovScale = ${FOV}; localStorage.setItem(k, JSON.stringify(s)); } catch {}`);
  page.on("pageerror", (e) => console.log("pageerror:", String(e)));
  await page.goto(`${URL}?game=speedkills&nointro`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("Boolean(window.__range) && window.__range.loaded() && window.__range.paidGuns().ready && window.__range.soldierReady()", { polling: 250, timeout: 90000 });
  await page.evaluate(`document.getElementById("overlay").classList.add("hidden"); window.__range.input.locked = true; ${AUDIT}`);
  const report: string[] = [];
  for (const id of IDS) {
    await page.evaluate(`(() => { const r = window.__range; r.player.teleport(0, 0, 0, 0, 0); r.debugView.inspect = -1; r.debugView.flourish = -1; r.loadout.give(0, ${JSON.stringify(id)}); r.loadout.requestSwap(0, r.gameTime()); })()`);
    await wait(2800);
    for (const seq of SEQ) {
      // (ads: the way into the sights, held at each share of it)
      const knob = seq === "swap" ? "raise" : seq === "ads" ? "ads" : seq === "inspect" || seq === "flourish" ? seq : "reload";
      const frames: Frame[] = [];
      const steps: number[] = [];
      for (let p = seq === "reload" || seq === "tactical" ? 0 : STEP; p <= 1 - (seq === "swap" || seq === "inspect" || seq === "flourish" || seq === "melee" ? STEP / 2 : -1e-9); p += STEP) if (p >= FROM - 1e-9 && p <= TO + 1e-9) steps.push(Math.round(p * 1000) / 1000);
      if (seq === "reload") await page.evaluate("window.__range.loadout.active.state.clip = 0");
      // (pickup: taking something off the ground, and melee: a swing, each held at each share of it by its own knob)
      // (an inspect put back to none rather than to the game's own: the sweep keeps inspects and flourishes off)
      const set = (v: number | null) => (seq === "pickup" ? `window.__range.packPickupAt(${v})` : seq === "melee" ? `window.__range.meleeAt(${v})` : seq === "inspect" || seq === "flourish" ? `window.__range.debugView.${seq} = ${v ?? -1}` : `window.__range.debugView.${knob} = ${v}`);
      // the hold before it, for the jump into its first frame
      const places: Place[] = [(await page.evaluate(PLACE)) as Place];
      for (const p of steps) {
        await page.evaluate(set(p));
        await wait(220);
        const file = path.join(OUT, `${id}-${seq}-${String(Math.round(p * 100)).padStart(3, "0")}.png`);
        await page.screenshot({ path: file as `${string}.png`, clip: { x: CROP.left, y: CROP.top, width: CROP.width, height: CROP.height } });
        const s = (await page.evaluate("window.__range.packArms()")) as Record<string, number | string>;
        places.push((await page.evaluate(PLACE)) as Place);
        const a = (await page.evaluate(`window.__packAudit(${DEEP}, ${XRAY})`)) as Frame["a"] & { pts?: number[][] };
        // (an inspect's hack cards: how much of each is over the gun on the screen)
        if (seq === "inspect") s.cards = JSON.stringify(await page.evaluate("window.__cardOverGun()"));
        if (XRAY && a && a.pts && a.pts.length) {
          await page.evaluate(`(() => {
            const r = window.__range, T = r.THREE, root = r.viewModelRoot();
            let rig = null, layer = null;
            root.traverse((o) => { if (o.name === "pack-arms") rig = o; });
            const under = (o, x) => { for (let q = o; q; q = q.parent) if (q === x) return true; return false; };
            const mats = new Map();
            root.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && !under(o, rig)) { layer ??= o.layers.mask; for (const m of [].concat(o.material)) if (!mats.has(m)) { mats.set(m, [m.transparent, m.opacity, m.depthWrite]); m.transparent = true; m.opacity = 0.25; m.depthWrite = false; m.wireframe = true; } } });
            const pts = ${JSON.stringify(a.pts)};
            const g = new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute(pts.flatMap((q) => q.slice(0, 3)), 3));
            g.setAttribute("color", new T.Float32BufferAttribute(pts.flatMap((q) => (q[4] ? [1, 0, 0] : [1, 0.8, 0])), 3));
            const dots = new T.Points(g, new T.PointsMaterial({ vertexColors: true, size: 5, sizeAttenuation: false, depthTest: false }));
            dots.renderOrder = 999;
            dots.layers.mask = layer ?? 1;
            dots.matrixAutoUpdate = false;
            dots.matrix.copy(root.matrixWorld).invert();
            dots.name = "__xray";
            root.add(dots);
            window.__xrayUndo = () => { root.remove(dots); for (const [m, [t, o, d]] of mats) { m.transparent = t; m.opacity = o; m.depthWrite = d; m.wireframe = false; } };
          })()`);
          await wait(120);
          await page.screenshot({ path: file.replace(/\.png$/, "-xray.png") as `${string}.png`, clip: { x: CROP.left, y: CROP.top, width: CROP.width, height: CROP.height } });
          await page.evaluate("window.__xrayUndo()");
        }
        if (a) delete a.pts;
        frames.push({ at: p, file, s, a });
      }
      await page.evaluate(`${set(null)}; window.__range.loadout.active.state.clip = window.__range.loadout.active.weapon.clipSize;`);
      await wait(400);
      // and the hold after it, for the jump out of its last frame: a state that ends somewhere other than where it began snaps
      places.push((await page.evaluate(PLACE)) as Place);
      const mv = places.slice(1).map((pl, i) => moves(places[i], pl));
      const jumps: string[] = [];
      for (let i = 0; i < mv.length; i++) {
        const said: string[] = [];
        for (const k of ["l", "r", "gc", "gq"] as const) {
          const floor = k === "gq" ? JUMP_DEG : JUMP_MM;
          const side = Math.max(mv[i - 1]?.[k] ?? 0, mv[i + 1]?.[k] ?? 0);
          if (mv[i][k] >= floor && mv[i][k] > JUMP_K * side) said.push(`${k === "gc" ? "gun" : k === "gq" ? "gun turn" : `hand ${k.toUpperCase()}`} ${mv[i][k].toFixed(0)}${k === "gq" ? "deg" : "mm"}`);
        }
        if (!said.length) continue;
        // (between two frames of the state, held again at four steps between them, each let settle longer: a jump is a
        // move made in one of them, where a quick one spreads across them all; at 4% steps the pack's own quick moves, a
        // pickup's hand back to the gun, BOOG's bolt thrown, read as spikes, and so did the view still settling)
        if (i >= 1 && i < frames.length) {
          const sub: Place[] = [];
          for (let k = 0; k <= 4; k++) {
            await page.evaluate(set(steps[i - 1] + ((steps[i] - steps[i - 1]) * k) / 4));
            await wait(450);
            sub.push((await page.evaluate(PLACE)) as Place);
          }
          await page.evaluate(set(null));
          const parts = sub.slice(1).map((pl, j) => moves(sub[j], pl));
          const snap = (["l", "r", "gc", "gq"] as const).some((k) => {
            const total = parts.reduce((s, m) => s + m[k], 0);
            const most = Math.max(...parts.map((m) => m[k]));
            return most >= (k === "gq" ? JUMP_DEG : JUMP_MM) / 2 && most > 0.6 * total;
          });
          if (!snap) continue;
        }
        // (onto frame i: the move from the one before it, or from the hold; the last is onto the hold after)
        const msg = `jump ${said.join(" ")}`;
        if (i < frames.length) frames[i].s.jump = msg;
        // (not aiming's: its sheet runs the way into the sights, and ends aimed, not back at the hold)
        else if (seq !== "ads") jumps.push(`${id} ${seq} end: ${msg} back to the hold`);
      }
      // the sheet: each frame with its moment and its faults written on it
      const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
      const tiles = await Promise.all(
        frames.map(async (fr) => {
          const s = fr.s;
          const miss = n(s.pointMiss);
          const off = n(s.pointOff);
          const bad: string[] = [];
          if (miss !== null && miss > 0.06) bad.push(`tip ${(miss * 100).toFixed(0)}cm off`);
          if (miss !== null && off !== null && off > 10) bad.push(`aim ${off.toFixed(0)}deg off`);
          // (a wrist only while its hand can be in the picture: at the hip it shows 40 degrees under the eye line, and in a
          // swap's middle both hands are well under it)
          const shown = (n(s.handsBelow) ?? 0) < 45;
          if (shown && (n(s.wristL) ?? 0) > 60) bad.push(`wristL ${Math.round(s.wristL as number)}`);
          if (shown && (n(s.wristR) ?? 0) > 60) bad.push(`wristR ${Math.round(s.wristR as number)}`);
          if (Math.max(n(s.reachShort) ?? 0, n(s.reachShortR) ?? 0) > 0.01) bad.push("arm short");
          // (a forearm's skin wrung past what the gun holds' own go to, 77 degrees: the open palm's 150 split the glove's cuff)
          // (only where it can be seen, as the wrists: in a swap's middle the pack's own clip wrings them out of the picture)
          if (shown) for (const k of ["skinL", "skinR"] as const) if ((n(s[k]) ?? 0) > 90) bad.push(`wrist wrung ${k.slice(-1)} ${Math.round(s[k] as number)}`);
          if (typeof s.cards === "string") {
            const over = Math.max(0, ...(JSON.parse(s.cards) as number[]));
            if (over > 2) bad.push(`hack card ${over.toFixed(0)}% over the gun`);
          }
          // (through where it can be seen; inside but hidden behind the gun, as a fingertip round a grip's far side, is not)
          if (fr.a && fr.a.seenL + fr.a.seenR > 0) bad.push(`through gun L${fr.a.seenL} R${fr.a.seenR} ${(fr.a.seenDeepest * 1000).toFixed(0)}mm`);
          if (fr.a && !fr.a.self && fr.a.selfShare !== undefined && fr.a.tested > 0 && (fr.a as { parts?: number }).parts !== 0) bad.push(`inside test failed on itself (${Math.round((fr.a.selfShare ?? 0) * 16)}/16)`);
          if (typeof s.jump === "string") bad.push(s.jump);
          const line1 = `${seq} ${Math.round(fr.at * 100)}%  ${s.lead}${miss !== null ? `  tip ${(miss * 100).toFixed(1)}cm ${off?.toFixed(0)}deg` : ""}  wrist ${Math.round((s.wristL as number) || 0)}/${Math.round((s.wristR as number) || 0)}`;
          const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
          const svg = `<svg width="${TILE.w}" height="${TILE.h}"><rect x="0" y="0" width="${TILE.w}" height="34" fill="rgba(0,0,0,0.65)"/><text x="6" y="14" font-family="Arial" font-size="12" fill="#fff">${esc(line1)}</text><text x="6" y="29" font-family="Arial" font-size="12" fill="${bad.length ? "#ff5050" : "#60ff60"}">${esc(bad.length ? bad.join(", ") : "ok")}</text></svg>`;
          fr.s.bad = bad.join(", ");
          return sharp(fr.file).resize(TILE.w, TILE.h).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
        }),
      );
      const rows = Math.ceil(tiles.length / COLS);
      const sheet = path.join(OUT, `${id}-${seq}-sheet.png`);
      await sharp({ create: { width: TILE.w * COLS, height: TILE.h * rows, channels: 3, background: "#000" } })
        .composite(tiles.map((t, i) => ({ input: t, left: (i % COLS) * TILE.w, top: Math.floor(i / COLS) * TILE.h })))
        .png()
        .toFile(sheet);
      console.log(sheet);
      for (const fr of frames) if (fr.s.bad) report.push(`${id} ${seq} ${Math.round(fr.at * 100)}%: ${fr.s.bad}${fr.a && Object.keys(fr.a.where).length ? ` (${JSON.stringify(fr.a.where)})` : ""}`);
      report.push(...jumps);
      fs.writeFileSync(path.join(OUT, `${id}-${seq}.json`), JSON.stringify(frames.map((f) => ({ at: f.at, ...f.s, audit: f.a })), null, 1));
    }
    await page.evaluate("window.__range.debugView.inspect = null; window.__range.debugView.flourish = null");
  }
  console.log(report.length ? `\n${report.length} frames with a fault:\n${report.join("\n")}` : "\nno frame with a fault");
} finally {
  await browser.close();
}
