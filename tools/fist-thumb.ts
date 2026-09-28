// The bought arms' fists' thumbs, searched in the page (the owner, 2026-09-28, of the fists: "the right arm is clearly
// still so fucked up"): each fist's thumb bent as the pack's pistol grip bends it lay along the top of the fist, its tip
// out ahead like a pointing finger. A fist's thumb lies across the front of the index and middle fingers' middle bones.
// Each thumb joint's turn about its three axes is tried on a grid, one joint after another, and kept where the thumb's
// tip is nearest that place with none of the thumb in the fingers. WRITE=1 writes fparms.json free.thumb.
//
// Run: SHOT_URL=http://localhost:5196/ npx tsx tools/fist-thumb.ts   (WRITE=1; FROM_CONFIG=1 GRID=-0.3,-0.15,0,0.15,0.3 to refine)
// Headless, never the real mouse or keyboard.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const URL = process.env.SHOT_URL ?? "http://localhost:5196/";
const WRITE = process.env.WRITE === "1";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CFG = path.join(HERE, "..", "src", "config", "fparms.json");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** each axis's turns, radians */
const GRID = (process.env.GRID ?? "-1.2,-0.9,-0.6,-0.4,-0.2,0,0.2,0.4,0.6,0.9,1.2").split(",").map(Number);

const cfg = JSON.parse(fs.readFileSync(CFG, "utf8"));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 900000, args: ["--use-angle=d3d11", "--enable-gpu", "--mute-audio", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  await page.goto(`${URL}?game=speedkills&nointro`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction("window.__range && window.__range.loaded() && window.__range.soldierReady() && window.__range.packRig().freeReady", { polling: 250, timeout: 120000 });
  await page.evaluate(`(() => { const r = window.__range; r.debugView.inspect = -1; r.debugView.lowered = 1; })()`);
  await wait(2500);
  // (FROM_CONFIG=1 starts from the thumb written, for a finer GRID round it)
  const thumb: Record<string, Record<string, number[]>> = process.env.FROM_CONFIG === "1" ? { l: {}, r: {}, ...structuredClone(cfg.free.thumb ?? {}) } : { l: {}, r: {} };
  for (const side of ["l", "r"]) {
    for (const j of ["thumb_01", "thumb_02", "thumb_03"]) {
      const res = (await page.evaluate(`(async () => {
        const r = window.__range;
        const T = r.THREE;
        const rig = r.packRig();
        const B = rig.bones;
        const frame = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
        const thumb = ${JSON.stringify(thumb)};
        const at = (n) => B[n + "_${side}"].getWorldPosition(new T.Vector3());
        // in phalanx lengths (the index's first bone), so the rig's scale does not matter
        const look = async (t) => {
          thumb["${side}"]["${j}"] = t;
          rig.debugThumb = thumb;
          await frame();
          const L = at("index_02").distanceTo(at("index_01"));
          const t2 = at("thumb_02"), t3 = at("thumb_03");
          const tip = t3.clone().addScaledVector(t3.clone().sub(t2), 0.8);
          const along = at("middle_01").sub(at("hand")).normalize();
          const mid = (f) => at(f + "_02").add(at(f + "_03")).multiplyScalar(0.5);
          const target = mid("index").add(mid("middle")).multiplyScalar(0.5).addScaledVector(along, 0.3 * L);
          // none of the thumb in the fingers: its joints, its tip and the halfway points kept 0.28 of a phalanx off every
          // finger joint and the halfway points between them
          const fingers = [];
          for (const f of ["index", "middle", "ring", "pinky"]) {
            const p = [at(f + "_01"), at(f + "_02"), at(f + "_03")];
            fingers.push(...p, p[0].clone().add(p[1]).multiplyScalar(0.5), p[1].clone().add(p[2]).multiplyScalar(0.5));
          }
          const own = [t2, t3, tip, t2.clone().add(t3).multiplyScalar(0.5), t3.clone().add(tip).multiplyScalar(0.5)];
          let inside = 0;
          for (const p of own) for (const q of fingers) inside += Math.max(0, 0.28 - p.distanceTo(q) / L);
          return { miss: tip.distanceTo(target) / L, inside };
        };
        const was = thumb["${side}"]["${j}"] ?? [0, 0, 0];
        const start = await look(was);
        const score = (m, x, y, z) => m.miss + m.inside * 20 + (Math.abs(x) + Math.abs(y) + Math.abs(z)) * 0.05;
        let best = { t: was, ...start, score: score(start, 0, 0, 0) };
        const grid = ${JSON.stringify(GRID)};
        for (const x of grid) for (const y of grid) for (const z of grid) {
          const t = [was[0] + x, was[1] + y, was[2] + z];
          const m = await look(t);
          const s = score(m, x, y, z);
          if (s < best.score - 0.005) best = { t, ...m, score: s };
        }
        rig.debugThumb = null;
        return { start, best };
      })()`)) as { start: { miss: number; inside: number }; best: { t: number[]; miss: number; inside: number } };
      thumb[side][j] = res.best.t.map((v) => Math.round(v * 1000) / 1000);
      console.log(`${side} ${j}: before tip ${res.start.miss.toFixed(2)} phalanx off, in the fingers ${res.start.inside.toFixed(2)}; best [${thumb[side][j].join(", ")}] tip ${res.best.miss.toFixed(2)} off, in ${res.best.inside.toFixed(2)}`);
    }
    for (const [k, v] of Object.entries(thumb[side])) if (v.every((x) => Math.abs(x) < 1e-6)) delete thumb[side][k];
  }
  console.log(JSON.stringify(thumb));
  if (WRITE) {
    const raw = fs.readFileSync(CFG, "utf8");
    const nl = raw.includes("\r\n") ? "\r\n" : "\n";
    const d = JSON.parse(raw);
    d.free.thumb = thumb;
    fs.writeFileSync(CFG, (JSON.stringify(d, null, 2) + "\n").replace(/\n/g, nl));
    console.log("wrote free.thumb");
  }
} finally {
  await browser.close();
}
