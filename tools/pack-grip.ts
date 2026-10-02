// A support hand moved to a new place on a gun and turned into a grip there, in the page (the owner, 2026-09-28: "for the
// boog, the support hand is holding the mag"). BOOG's magazine is further ahead of its trigger than the pack's L96X's,
// so the pack's hold put the left hand on it; moved ahead onto the fore-end (fparms.json packGuns hold shift), the
// pack's grip, made for a thicker fore-end, lay flat against BOOG's side with its fingers 5 to 10 cm off it. This
// searches the hand's move and turn about the wrist, wide and then narrower round the best, for the palm on the gun,
// every finger and the thumb on it too and none of the skin more than `DEEP` into it. tools/pack-solve.ts joints then
// lays each finger on it joint by joint. WRITE=1 writes the hold's shift and rot.
//
// FORE weighs how long the forearm is on the screen (the owner, 2026-10-01, of the support arm: "arm not visible, hand and
// wrist visible") and WRIST the wrist's bend past 45 degrees, both 0 unless given.
//
// Run: SHOT_URL=http://localhost:5196/ npx tsx tools/pack-grip.ts <id> [side]   (TRIES=600, SPREAD=0.03,0.9, AHEAD=2, FORE=0, WRIST=0)
// Headless, never the real mouse or keyboard.
import fs from "node:fs";
const FORE = Number(process.env.FORE ?? 0);
const WRIST = Number(process.env.WRIST ?? 0);
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const URL = process.env.SHOT_URL ?? "http://localhost:5196/";
const ID = process.argv[2] ?? "sentinel";
const SIDE = process.argv[3] ?? "l";
const WRITE = process.env.WRITE === "1";
const TRIES = Number(process.env.TRIES ?? 600);
/** the widest try: metres of move, radians of turn */
const [MOVE, TURN] = (process.env.SPREAD ?? "0.03,0.9").split(",").map(Number);
/** how far the palm's middle must be ahead of the magazine's front, cm (the hold's palmAhead) */
const AHEAD = Number(process.env.AHEAD ?? 2);
/** a hand's skin past touching, mm, that counts as in the gun */
const DEEP = 4;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CFG = path.join(HERE, "..", "src", "config", "fparms.json");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cfg = JSON.parse(fs.readFileSync(CFG, "utf8"));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 1800000, args: ["--use-angle=d3d11", "--enable-gpu", "--mute-audio", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  // (the owner's screen and field of view, 110: where the forearm is in the picture depends on both)
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(`try { const k = "range.settings.v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.fovScale = 1.571; localStorage.setItem(k, JSON.stringify(s)); } catch {}`);
  await page.goto(`${URL}?game=speedkills&nointro`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction("window.__range && window.__range.loaded() && window.__range.paidGuns().ready && window.__range.soldierReady()", { polling: 250, timeout: 120000 });
  await page.evaluate(fs.readFileSync(path.join(HERE, "pack-audit.js"), "utf8"));
  await page.evaluate(`(() => { const r = window.__range; r.debugView.inspect = -1; r.loadout.give(0, "${ID}"); r.loadout.requestSwap(0, r.gameTime()); })()`);
  await wait(2800);
  const name = (await page.evaluate("window.__range.packArms().active")) as string;
  const hold = structuredClone(cfg.packGuns[name].hold);
  hold[SIDE].rot ??= [0, 0, 0];
  const res = (await page.evaluate(`(async () => {
    const r = window.__range;
    const rig = r.packRig();
    const frame = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    const hold = ${JSON.stringify(hold)};
    const s0 = hold["${SIDE}"].shift.slice(), r0 = hold["${SIDE}"].rot.slice();
    const fingers = ["index", "middle", "ring", "pinky", "thumb"];
    const look = async (shift, rot) => {
      hold["${SIDE}"].shift = shift;
      hold["${SIDE}"].rot = rot;
      rig.debugHold = hold;
      await frame();
      const a = window.__packAudit(${DEEP / 1000}, false, { side: "${SIDE}" });
      const depth = Object.values(a.bones);
      const over = depth.reduce((s, v) => s + Math.max(0, v - ${DEEP}), 0);
      const gaps = fingers.map((f) => Math.min(...["01", "02", "03"].map((j) => a.boneGap[f + "_" + j + "_${SIDE}"] ?? 100)));
      const palm = (a.palmGap["${SIDE}"] ?? 1) * 1000;
      const short = r.packArms().reachShort * 1000;
      const ahead = r.packArms().palmAhead * 100;
      // (FORE: how long the forearm is on the screen, in the screen's half-heights, from wrist to elbow where it is in it;
      // WRIST: the wrist's bend past 45 degrees)
      const root = r.viewModelRoot(); const T = r.THREE; const inv = new T.Matrix4().copy(root.matrixWorld).invert();
      const tv = Math.tan(r.gunFov().gun / 2 * Math.PI / 180); const th = tv * innerWidth / innerHeight;
      const hp = rig.group.getObjectByName('hand_${SIDE}').getWorldPosition(new T.Vector3()), ep = rig.group.getObjectByName('lowerarm_${SIDE}').getWorldPosition(new T.Vector3());
      let fore = 0, prev = null;
      for (let i = 0; i <= 20; i++) { const v = hp.clone().lerp(ep, i / 20).applyMatrix4(inv); const s = v.z < 0 ? [v.x / -v.z / th * innerWidth / innerHeight, v.y / -v.z / tv] : null; const inside = s && Math.abs(s[0]) < innerWidth / innerHeight && Math.abs(s[1]) < 1; if (inside && prev) fore += Math.hypot(s[0] - prev[0], s[1] - prev[1]); prev = inside ? s : null; }
      const wrist = r.packArms()['wrist' + '${SIDE}'.toUpperCase()];
      // the palm on it and ahead of the magazine, the fingers and thumb on it (the thumb half as much: a support hand's
      // thumb may lie along the side), nothing in it, the arm reaching, and no more turn than it needs
      const score = over * 3 + Math.max(0, palm - 1) * 4 + gaps.slice(0, 4).reduce((s, g) => s + Math.max(0, g - 1.5), 0) + Math.max(0, gaps[4] - 1.5) * 0.5 + short * 10 + Math.max(0, ${AHEAD} - ahead) * 20 + ${FORE} * fore * 100 + ${WRIST} * Math.max(0, wrist - 45);
      return { score, over, palm, gaps, short, ahead, fore, wrist };
    };
    const reg = (rot) => (Math.abs(rot[0] - r0[0]) + Math.abs(rot[1] - r0[1]) + Math.abs(rot[2] - r0[2])) * 2;
    const start = await look(s0, r0);
    let best = { shift: s0, rot: r0, ...start, total: start.score };
    // a fixed spread of tries (no Math.random: the same run finds the same grip), wide first and then round the best
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 * 2 - 1; };
    for (let i = 0; i < ${TRIES}; i++) {
      const k = i < ${TRIES} / 2 ? 1 : 0.35;
      const from = i < ${TRIES} / 2 ? { shift: s0, rot: r0 } : best;
      const shift = from.shift.map((v) => v + rnd() * ${MOVE} * k);
      const rot = from.rot.map((v) => v + rnd() * ${TURN} * k);
      const m = await look(shift, rot);
      const total = m.score + reg(rot);
      if (total < best.total) best = { shift, rot, ...m, total };
    }
    rig.debugHold = null;
    return { start, best };
  })()`)) as { start: { over: number; palm: number; gaps: number[]; short: number; ahead: number }; best: { shift: number[]; rot: number[]; over: number; palm: number; gaps: number[]; short: number; ahead: number } };
  const fmt = (m: { over: number; palm: number; gaps: number[]; short: number; ahead: number; fore?: number; wrist?: number }) => `in the gun ${m.over.toFixed(1)} mm summed, palm ${m.palm.toFixed(1)} mm and ${m.ahead.toFixed(1)} cm ahead of the magazine, fingers and thumb ${m.gaps.map((g) => g.toFixed(0)).join("/")} mm, arm short ${m.short.toFixed(0)} mm, forearm ${(m.fore ?? 0).toFixed(2)} of the screen's half-height on it, wrist ${Math.round(m.wrist ?? 0)} degrees`;
  console.log(`${ID} ${SIDE} before: ${fmt(res.start)}`);
  console.log(`${ID} ${SIDE} best: ${fmt(res.best)}; shift [${res.best.shift.map((v) => v.toFixed(4))}], rot [${res.best.rot.map((v) => v.toFixed(3))}]`);
  if (WRITE) {
    const raw = fs.readFileSync(CFG, "utf8");
    const nl = raw.includes("\r\n") ? "\r\n" : "\n";
    const d = JSON.parse(raw);
    d.packGuns[name].hold[SIDE].shift = res.best.shift.map((v) => Math.round(v * 10000) / 10000);
    d.packGuns[name].hold[SIDE].rot = res.best.rot.map((v) => Math.round(v * 1000) / 1000);
    fs.writeFileSync(CFG, (JSON.stringify(d, null, 2) + "\n").replace(/\n/g, nl));
    console.log(`wrote ${name} ${SIDE} shift and rot`);
  }
} finally {
  await browser.close();
}
