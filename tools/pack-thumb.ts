// The thumb's joints searched over their whole range, one joint at a time, in the page (tools/pack-solve.ts's local
// searches cannot get a thumb from over a receiver to down a grip's side: every small turn keeps it inside). Each
// joint's turn about its three axes tried on a grid, each try checked on the thumb's own skin, and kept where least of
// it is in the gun with it still touching; then the next joint from there. WRITE=1 writes the hold's joint turns.
//
// Run: SHOT_URL=http://localhost:5196/ npx tsx tools/pack-thumb.ts <id> [side]
// Headless, never the real mouse or keyboard.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const URL = process.env.SHOT_URL ?? "http://localhost:5196/";
const ID = process.argv[2] ?? "r97";
const SIDE = process.argv[3] ?? "r";
const FINGER = process.env.FINGER ?? "thumb";
const WRITE = process.env.WRITE === "1";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CFG = path.join(HERE, "..", "src", "config", "fparms.json");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** each axis's turns, radians */
const GRID = (process.env.GRID ?? "-1.2,-0.8,-0.4,-0.2,0,0.2,0.4,0.8,1.2").split(",").map(Number);

const cfg = JSON.parse(fs.readFileSync(CFG, "utf8"));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 600000, args: ["--use-angle=d3d11", "--enable-gpu", "--mute-audio", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  await page.goto(`${URL}?game=speedkills&nointro`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction("window.__range && window.__range.loaded() && window.__range.paidGuns().ready && window.__range.soldierReady()", { polling: 250, timeout: 90000 });
  await page.evaluate(fs.readFileSync(path.join(HERE, "pack-audit.js"), "utf8"));
  await page.evaluate(`(() => { const r = window.__range; r.debugView.inspect = -1; r.loadout.give(0, "${ID}"); r.loadout.requestSwap(0, r.gameTime()); })()`);
  await wait(2800);
  const name = (await page.evaluate("window.__range.packArms().active")) as string;
  const hold = structuredClone(cfg.packGuns[name].hold ?? { l: { shift: [0, 0, 0], open: {} }, r: { shift: [0, 0, 0], open: {} } });
  hold[SIDE].joint ??= {};
  for (const j of ["01", "02", "03"]) {
    const key = `${FINGER}_${j}`;
    const res = (await page.evaluate(`(async () => {
      const r = window.__range;
      const frame = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      const hold = ${JSON.stringify(hold)};
      const grid = ${JSON.stringify(GRID)};
      const was = hold["${SIDE}"].joint["${key}"] ?? [0, 0, 0];
      const bones = "^${FINGER}_0[123]_${SIDE}$";
      const look = async (t) => {
        hold["${SIDE}"].joint["${key}"] = t;
        r.packRig().debugHold = hold;
        await frame();
        const a = window.__packAudit(0.004, false, { side: "${SIDE}", bones });
        const mine = Object.entries(a.bones);
        const over = mine.reduce((s, [, v]) => s + Math.max(0, v - 3.5), 0);
        const deepest = Math.max(0, ...mine.map(([, v]) => v));
        const gap = Math.min(...["01", "02", "03"].map((k) => a.boneGap["${FINGER}_" + k + "_${SIDE}"] ?? 30));
        return { over, deepest, gap };
      };
      const start = await look(was);
      let best = { t: was, ...start, score: start.over + Math.max(0, start.gap - 1.5) * 2 };
      for (const x of grid) for (const y of grid) for (const z of grid) {
        const t = [was[0] + x, was[1] + y, was[2] + z];
        const m = await look(t);
        const score = m.over + Math.max(0, m.gap - 1.5) * 2 + (Math.abs(x) + Math.abs(y) + Math.abs(z)) * 0.3;
        if (score < best.score - 0.05) best = { t, ...m, score };
      }
      hold["${SIDE}"].joint["${key}"] = best.t;
      r.packRig().debugHold = null;
      return { start, best };
    })()`)) as { start: { deepest: number; gap: number }; best: { t: number[]; deepest: number; gap: number } };
    hold[SIDE].joint[key] = res.best.t.map((v) => Math.round(v * 1000) / 1000);
    console.log(`${ID} ${SIDE} ${key}: before deepest ${res.start.deepest} mm gap ${res.start.gap}; best [${res.best.t.map((v) => v.toFixed(2))}] deepest ${res.best.deepest} mm gap ${res.best.gap}`);
  }
  for (const [k, v] of Object.entries(hold[SIDE].joint as Record<string, number[]>)) if (v.every((x) => Math.abs(x) < 1e-6)) delete hold[SIDE].joint[k];
  if (WRITE) {
    const raw = fs.readFileSync(CFG, "utf8");
    const nl = raw.includes("\r\n") ? "\r\n" : "\n";
    const d = JSON.parse(raw);
    d.packGuns[name].hold[SIDE].joint = hold[SIDE].joint;
    fs.writeFileSync(CFG, (JSON.stringify(d, null, 2) + "\n").replace(/\n/g, nl));
    console.log(`wrote ${name} ${SIDE} joints`);
  }
} finally {
  await browser.close();
}
