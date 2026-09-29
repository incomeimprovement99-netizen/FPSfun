// The thrown swap's let-go, searched in the page (the owner, 2026-09-28: "have the character throw it up and out").
// Fingers wrapped round a gun part collide with nearly every way out: slid straight up out of the closed hands, the
// USSO's grip came 5 mm through the fingertips; opened in place, the straightening fingers went into the magazine in
// front of it and the front of the gun. This tries the lift, when the flight starts and which way it leaves, when the
// fingers relax and open and how far each hand backs off, all together, over the let-go at 1% steps (the catch is the
// same run backwards), for no hand more than 4 mm into the gun where it is seen, the wrists 58 degrees or less and the
// arms reaching: wide first, then round the best. The best few are checked on each gun. WRITE=1 writes fparms.json swap
// throw (only a setting clear on every gun). On the USSO (2026-09-29) nothing it tried in 20 tries beat a fingertip
// grazing the gun by 5 mm as it leaves: its magazine and trigger guard sit where a hand opening off its grip sweeps.
//
// Run: SHOT_URL=http://localhost:5196/ npx tsx tools/throw-release.ts   (TRIES=240)
// Headless, never the real mouse or keyboard.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const URL = process.env.SHOT_URL ?? "http://localhost:5196/";
const WRITE = process.env.WRITE === "1";
const TRIES = Number(process.env.TRIES ?? 240);
const IDS = (process.env.IDS ?? "r97,sentinel").split(",");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CFG = path.join(HERE, "..", "src", "config", "fparms.json");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Hand = { leave: number[]; off: number[]; open: number[] };
type Try = { lift: number[]; fly: number[]; drop: number[]; relax: number; slide: number; hands: { l: Hand; r: Hand } };
const cfg = JSON.parse(fs.readFileSync(CFG, "utf8"));
const base = cfg.swap.throw;
// the knobs and their ranges; each try is a point in them
const KNOBS: Array<[string, number, number]> = [
  ["liftY", 0.03, 0.07],
  ["liftZ", -0.01, 0.03],
  ["fly0", 0.16, 0.24],
  ["open0", 0.2, 0.32],
  ["leave0", 0.12, 0.24],
  ["relax", 0, 0.5],
  ["slide", -0.08, 0.08],
  ["offLy", -0.03, 0],
  ["offLz", -0.02, 0.02],
  ["offRx", 0, 0.03],
  ["offRy", -0.02, 0.01],
  ["offRz", -0.01, 0.04],
];
const toTry = (v: Record<string, number>): Try => {
  const hand = (off: number[]): Hand => ({ leave: [v.leave0, v.leave0 + 0.06], off, open: [v.open0, v.open0 + 0.08] });
  return {
    lift: [0, v.liftY, v.liftZ],
    fly: [v.fly0, 0.5],
    drop: [v.open0 + 0.02, v.open0 + 0.14],
    relax: v.relax,
    slide: v.slide,
    hands: { l: hand([0, v.offLy, v.offLz]), r: hand([v.offRx, v.offRy, v.offRz]) },
  };
};
const H0 = base.hands;
const start: Record<string, number> = { liftY: base.lift[1], liftZ: base.lift[2], fly0: base.fly[0], open0: H0.r.open[0], leave0: H0.r.leave[0], relax: base.relax, slide: base.slide, offLy: H0.l.off[1], offLz: H0.l.off[2], offRx: H0.r.off[0], offRy: H0.r.off[1], offRz: H0.r.off[2] };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 3600000, args: ["--use-angle=d3d11", "--enable-gpu", "--mute-audio", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1560, height: 880, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  await page.goto(`${URL}?game=speedkills&nointro`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction("window.__range && window.__range.loaded() && window.__range.paidGuns().ready && window.__range.soldierReady()", { polling: 250, timeout: 120000 });
  await page.evaluate(fs.readFileSync(path.join(HERE, "pack-audit.js"), "utf8"));
  // one gun's let-go under a try: the worst of each measure at each 1% of it
  await page.evaluate(`window.__throwScore = async (t) => {
    const r = window.__range;
    const rig = r.packRig();
    const frame = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    rig.debugThrow = t;
    let score = 0, deep = 0, wrist = 0, short = 0;
    for (let u = 0.12; u <= 0.405; u += 0.01) {
      r.debugView.raise = u;
      await frame();
      const a = window.__packAudit(0.004);
      const s = r.packArms();
      const d = (a ? a.seenDeepest : 0) * 1000;
      deep = Math.max(deep, d);
      wrist = Math.max(wrist, s.wristL, s.wristR);
      short = Math.max(short, s.reachShort, s.reachShortR);
      score += Math.max(0, d - 4) * 2 + Math.max(0, s.wristL - 58) + Math.max(0, s.wristR - 58) + Math.max(s.reachShort, s.reachShortR) * 1000;
    }
    r.debugView.raise = null;
    rig.debugThrow = null;
    return { score, deep, wrist, short };
  }`);
  const hold = async (id: string) => {
    await page.evaluate(`(() => { const r = window.__range; r.player.teleport(0, 0, 0, 0, 0); r.debugView.inspect = -1; r.debugView.flourish = -1; r.loadout.give(0, "${id}"); r.loadout.requestSwap(0, r.gameTime()); })()`);
    await wait(3000);
  };
  const score = (t: Try) => page.evaluate(`window.__throwScore(${JSON.stringify(t)})`) as Promise<{ score: number; deep: number; wrist: number; short: number }>;
  // a fixed spread of tries (no Math.random: the same run finds the same)
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
  await hold(IDS[0]);
  const s0 = await score(toTry(start));
  console.log(`${IDS[0]} as written: score ${s0.score.toFixed(1)}, deepest ${s0.deep.toFixed(1)} mm, wrist ${s0.wrist.toFixed(0)}`);
  const found: Array<{ v: Record<string, number>; s: { score: number; deep: number; wrist: number; short: number } }> = [{ v: start, s: s0 }];
  let best = found[0];
  for (let i = 0; i < TRIES; i++) {
    const wide = i < TRIES / 2;
    const v: Record<string, number> = {};
    for (const [k, lo, hi] of KNOBS) {
      const c = wide ? (lo + hi) / 2 : best.v[k];
      const span = (hi - lo) / 2 * (wide ? 1 : 0.3);
      v[k] = Math.min(hi, Math.max(lo, c + rnd() * span));
    }
    const s = await score(toTry(v));
    found.push({ v, s });
    if (s.score < best.s.score) {
      best = { v, s };
      console.log(`  try ${i}: score ${s.score.toFixed(1)}, deepest ${s.deep.toFixed(1)} mm, wrist ${s.wrist.toFixed(0)}, short ${(s.short * 100).toFixed(1)} cm`);
    }
  }
  // the best few on every gun, the worst of them counting
  const top = found.sort((a, b) => a.s.score - b.s.score).slice(0, 6);
  const verdict: Array<{ v: Record<string, number>; worst: number; per: string[] }> = [];
  for (const t of top) verdict.push({ v: t.v, worst: 0, per: [] });
  for (const id of IDS) {
    await hold(id);
    for (const t of verdict) {
      const s = await score(toTry(t.v));
      t.worst = Math.max(t.worst, s.score);
      t.per.push(`${id} ${s.score.toFixed(1)} (${s.deep.toFixed(1)} mm, wrist ${s.wrist.toFixed(0)})`);
    }
  }
  verdict.sort((a, b) => a.worst - b.worst);
  for (const t of verdict) console.log(`worst ${t.worst.toFixed(1)}: ${t.per.join("; ")}  ${JSON.stringify(toTry(t.v))}`);
  const win = verdict[0];
  if (WRITE && win.worst < 1e-6) {
    const raw = fs.readFileSync(CFG, "utf8");
    const nl = raw.includes("\r\n") ? "\r\n" : "\n";
    const d = JSON.parse(raw);
    const r4 = (x: number) => Math.round(x * 10000) / 10000;
    const t = toTry(win.v);
    const h = (x: Hand): Hand => ({ leave: x.leave.map(r4), off: x.off.map(r4), open: x.open.map(r4) });
    Object.assign(d.swap.throw, {
      lift: t.lift.map(r4),
      fly: t.fly.map(r4),
      drop: t.drop.map(r4),
      relax: r4(t.relax),
      slide: r4(t.slide),
      hands: { l: h(t.hands.l), r: h(t.hands.r) },
    });
    fs.writeFileSync(CFG, (JSON.stringify(d, null, 2) + "\n").replace(/\n/g, nl));
    console.log("wrote swap throw");
  } else if (WRITE) console.log("nothing clear on every gun: not written");
} finally {
  await browser.close();
}
