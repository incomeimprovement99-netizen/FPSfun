// Where the open left hand is held on an inspect, searched in the page (the owner, 2026-09-28: the hack "needs to be held
// higher and slightly more to the left so it doesn't bug in and out with the gun when it sways back and forth on the
// usso when we inspect"). Each place tried on a grid up and to the left of the config's is held through the inspect on
// each gun, and kept where no hack card is over the gun on the screen at any moment of it (tools/pack-audit.js
// __cardOverGun), the arm reaching, the wrist straight enough and the cards on the screen; the least move that does it.
// The hand's knuckles are turned with it (RAISE, ACROSS), palm up still. WRITE=1 writes fparms.json inspectPalm.at and
// free.palm.along.
//
// Run: SHOT_URL=http://localhost:5196/ npx tsx tools/palm-place.ts [ids...]   (LEFT=0,0.02,..., UP=0,0.02,...)
// Headless, never the real mouse or keyboard.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const URL = process.env.SHOT_URL ?? "http://localhost:5196/";
const IDS = process.argv.length > 2 ? process.argv.slice(2) : ["r97", "sentinel"];
const WRITE = process.env.WRITE === "1";
const LEFT = (process.env.LEFT ?? "0,0.02,0.04,0.06,0.08,0.1").split(",").map(Number);
const UP = (process.env.UP ?? "0,0.02,0.04,0.06,0.08,0.1,0.12").split(",").map(Number);
/** the open hand's knuckles turned up (radians about the view's x) and across (about its y) from the config's way, so the
 * forearm and the hand stay in line at a new place (held higher at the config's way, the wrist bent 100 degrees) */
const RAISE = (process.env.RAISE ?? "0,0.3,0.6,0.9").split(",").map(Number);
const ACROSS = (process.env.ACROSS ?? "-0.4,0,0.4").split(",").map(Number);
/** the moments of the inspect looked at */
const AT = [0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85];
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CFG = path.join(HERE, "..", "src", "config", "fparms.json");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cfg = JSON.parse(fs.readFileSync(CFG, "utf8"));
const base: number[] = cfg.inspectPalm.at;
type Try = { at: number[]; along: number[]; over: number; short: number; wrist: number; off: number };
const along0: number[] = cfg.free.palm.along;
const a0n = (() => { const l = Math.hypot(...along0); return along0.map((v) => v / l); })();
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 1800000, args: ["--use-angle=d3d11", "--enable-gpu", "--mute-audio", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  await page.goto(`${URL}?game=speedkills&nointro`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction("window.__range && window.__range.loaded() && window.__range.paidGuns().ready && window.__range.soldierReady()", { polling: 250, timeout: 120000 });
  await page.evaluate(fs.readFileSync(path.join(HERE, "pack-audit.js"), "utf8"));
  const worst = new Map<string, Try>();
  for (const id of IDS) {
    await page.evaluate(`(() => { const r = window.__range; r.player.teleport(0, 0, 0, 0, 0); r.debugView.inspect = -1; r.loadout.give(0, "${id}"); r.loadout.requestSwap(0, r.gameTime()); })()`);
    await wait(3000);
    const tries = (await page.evaluate(`(async () => {
      const r = window.__range;
      const rig = r.packRig();
      const frame = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      const out = [];
      const T = r.THREE;
      const a0 = new T.Vector3(...${JSON.stringify(along0)}).normalize();
      for (const dx of ${JSON.stringify(LEFT)}) for (const dy of ${JSON.stringify(UP)}) for (const up of ${JSON.stringify(RAISE)}) for (const side of ${JSON.stringify(ACROSS)}) {
        const at = [${base[0]} - dx, ${base[1]} + dy, ${base[2]}];
        const along = a0.clone().applyAxisAngle(new T.Vector3(1, 0, 0), up).applyAxisAngle(new T.Vector3(0, 1, 0), side).toArray().map((v) => Math.round(v * 1000) / 1000);
        rig.debugPalmAt = at;
        rig.debugPalmAlong = along;
        let over = 0, short = 0, wrist = 0, off = 0;
        for (const i of ${JSON.stringify(AT)}) {
          r.debugView.inspect = i;
          await frame();
          await frame();
          const cards = window.__cardOverGun();
          over = Math.max(over, ...cards);
          const s = r.packArms();
          short = Math.max(short, s.reachShort);
          wrist = Math.max(wrist, s.wristL);
          // (a card not drawn, or past the screen's edge, counts against it)
          if (cards.length < 2) off = Math.max(off, 1);
        }
        out.push({ at, along, over, short, wrist, off });
      }
      rig.debugPalmAt = null;
      rig.debugPalmAlong = null;
      r.debugView.inspect = -1;
      return out;
    })()`)) as Try[];
    for (const t of tries) {
      const k = t.at.join(",") + "|" + t.along.join(",");
      const w = worst.get(k);
      worst.set(k, w ? { at: t.at, along: t.along, over: Math.max(w.over, t.over), short: Math.max(w.short, t.short), wrist: Math.max(w.wrist, t.wrist), off: Math.max(w.off, t.off) } : t);
    }
    const here = tries.find((t) => t.at[0] === base[0] && t.at[1] === base[1] && t.along.every((v, i) => Math.abs(v - a0n[i]) < 1e-3));
    if (here) console.log(`${id} at the config's place: a card ${here.over.toFixed(0)}% over the gun at worst, arm short ${(here.short * 100).toFixed(1)} cm, wrist ${here.wrist.toFixed(0)}`);
  }
  const all = [...worst.values()];
  // the least move, a turn of the hand counted as 10 cm a radian
  const moved = (t: Try) => Math.hypot(t.at[0] - base[0], t.at[1] - base[1]) + Math.acos(Math.min(1, t.along.reduce((s, v, i) => s + v * a0n[i], 0))) * 0.1;
  const clear = all.filter((t) => t.over <= 1 && t.short <= 0.005 && t.wrist <= 50 && !t.off).sort((a, b) => moved(a) - moved(b));
  for (const t of clear.slice(0, 6)) console.log(`  [${t.at.map((v) => v.toFixed(3))}] along [${t.along}] over ${t.over.toFixed(0)}%, short ${(t.short * 100).toFixed(1)} cm, wrist ${t.wrist.toFixed(0)}, cards ${t.off ? "missing" : "both"}`);
  const best = clear[0];
  if (!best) {
    console.log("no place clear of the gun on every gun: widen LEFT and UP");
  } else {
    console.log(`best: [${best.at.map((v) => v.toFixed(3))}] along [${best.along}]; a card ${best.over.toFixed(0)}% over the gun at worst, wrist ${best.wrist.toFixed(0)}`);
    if (WRITE) {
      const raw = fs.readFileSync(CFG, "utf8");
      const nl = raw.includes("\r\n") ? "\r\n" : "\n";
      const d = JSON.parse(raw);
      d.inspectPalm.at = best.at.map((v) => Math.round(v * 1000) / 1000);
      d.free.palm.along = best.along;
      fs.writeFileSync(CFG, (JSON.stringify(d, null, 2) + "\n").replace(/\n/g, nl));
      console.log("wrote inspectPalm.at and free.palm.along");
    }
  }
} finally {
  await browser.close();
}
