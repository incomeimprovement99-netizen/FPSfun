// A hand laid flush on a gun, in the page (the owner, 2026-09-29: "THE THUMB AND THE PALM OF THE LEFT ARM ARE NOT
// EXACTLY FLUSH UP WITH THE USSO ON THE GUNS LEFT SIDE, SEE THE GAP?", and of the right hand "why is the middle finger so
// separated from the bottom two? the 3 should be next to each other"). tools/pack-grip.ts asked only that the palm's
// nearest point touch, so a hand could touch at one point of its heel and stand off the gun everywhere else (the USSO's
// left palm 0.7 mm at its nearest, its thumb 16 to 21 mm off). This scores how much of each named bone's skin lies on
// the gun: a share of its skin points (`PCT`, the palm side of a hand is its nearer half) within `FLUSH` mm, and asks
// named fingertips to lie together, spaced as the next pair are; nothing more than `DEEP` into the gun, the wrist
// straight enough and the arm reaching. It moves the hold (shift, view metres, and rot, radians about the wrist) and
// turns named joints, wide and then narrower round the best. WRITE=1 writes the hold.
//
// The USSO's left hand was fitted in stages (2026-09-30): the palm and thumb placed with only their own depth counted
// (OVER_BONES=^(hand|thumb)), then tools/pack-solve.ts joints laid the fingers on the gun, then a finishing pass here
// with every bone counted, then pack-solve again; a pickup, whose clip carries the gun where the flush hand was out of
// reach, takes the hold's own `pick` fit (fprig.ts mixFit). With PICKUP shares the search scores the pickup too.
//
// Run: SHOT_URL=http://localhost:5196/ npx tsx tools/pack-flush.ts <id> <side>
//   FLUSH_BONES=hand@0.1,thumb_02,thumb_03 the bones laid on the gun, each with its share of skin (else PCT)
//   OVER_BONES=^(hand|thumb)             which bones' skin counts as in the gun (default all)
//   TOUCH_BONES=index_03,middle_03       the bones whose nearest point must touch it
//   TOGETHER=middle_03,ring_03,pinky_03  fingertips kept together, each gap as the last pair's
//   TOGETHER_MM=25                       or each gap this many mm (the USSO's lie 25 apart)
//   TRIGGER=index_03                     this finger's tip on the gun's Trigger part
//   JOINTS=thumb_01,thumb_02             joints turned (Euler, radians) besides the hold's shift and rot
//   PICKUP=0.64,0.7,0.76                 pickup shares scored for the arm's reach and depth
//   START='{"shift":..,"rot":..,"joints":{..}}'  go on from an earlier best
//   MOVE=0.01 TURN=0.3 JTURN=0.4 TRIES=500 PCT=0.25 FLUSH=1.5
//   SEEN=0.2                             each pixel of daylight the eye sees shut between the hand and the gun (pack-audit.js
//                                        __packSeenGap, a 480 wide picture) costs this; the page is then the owner's 1920 by
//                                        1080 at the field of view's 1.571, where the eye sees it (the USSO's left palm laid
//                                        on the gun by skin alone still left a ring of forefinger and thumb open ahead of it)
// (PowerShell drops an empty variable, so a list meant empty is given as a name that matches nothing, `x`.)
// Headless, never the real mouse or keyboard.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const URL = process.env.SHOT_URL ?? "http://localhost:5196/";
const ID = process.argv[2] ?? "r97";
const SIDE = process.argv[3] ?? "l";
const WRITE = process.env.WRITE === "1";
const TRIES = Number(process.env.TRIES ?? 500);
const MOVE = Number(process.env.MOVE ?? 0.01);
const TURN = Number(process.env.TURN ?? 0.3);
const JTURN = Number(process.env.JTURN ?? 0.4);
const PCT = Number(process.env.PCT ?? 0.25);
const FLUSH = Number(process.env.FLUSH ?? 1.5);
/** skin deeper than this in the gun counts against a hold, mm (DEEP=): under the sheets' 4, for a hold that is rolled in an inspect */
const DEEP = Number(process.env.DEEP ?? 4);
const SEEN = Number(process.env.SEEN ?? 0);
const list = (s: string | undefined, d: string) => (s ?? d).split(",").filter(Boolean);
/** a bone may carry its own share, `hand@0.1`: a palm's pad is a tenth of its skin, a thumb's side a quarter */
const FLUSH_BONES = list(process.env.FLUSH_BONES, "hand@0.1,thumb_02,thumb_03");
/**
 * which bones' skin counts as in the gun (a regular expression): a first placing of the palm lets the fingers go in, and
 * tools/pack-solve.ts joints then lays them on it joint by joint
 */
const OVER_BONES = process.env.OVER_BONES ?? ".";
const TOUCH_BONES = list(process.env.TOUCH_BONES, "");
const TOGETHER = list(process.env.TOGETHER, "");
const JOINTS = list(process.env.JOINTS, "").filter((j) => /^(thumb|index|middle|ring|pinky)_0[123]$/.test(j));
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CFG = path.join(HERE, "..", "src", "config", "fparms.json");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cfg = JSON.parse(fs.readFileSync(CFG, "utf8"));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 3600000, args: ["--use-angle=d3d11", "--enable-gpu", "--mute-audio", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  if (SEEN > 0) {
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(`try { const k = "range.settings.v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.fovScale = 1.571; localStorage.setItem(k, JSON.stringify(s)); } catch {}`);
  }
  await page.goto(`${URL}?game=speedkills&nointro`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction("window.__range && window.__range.loaded() && window.__range.paidGuns().ready && window.__range.soldierReady()", { polling: 250, timeout: 120000 });
  await page.evaluate(fs.readFileSync(path.join(HERE, "pack-audit.js"), "utf8"));
  await page.evaluate(`(() => { const r = window.__range; r.player.teleport(0, 0, 0, 0, 0); r.debugView.inspect = -1; r.debugView.flourish = -1; r.loadout.give(0, "${ID}"); r.loadout.requestSwap(0, r.gameTime()); })()`);
  await wait(3200);
  const name = (await page.evaluate("window.__range.packArms().active")) as string;
  const hold = structuredClone(cfg.packGuns[name].hold);
  hold[SIDE].rot ??= [0, 0, 0];
  hold[SIDE].joint ??= {};
  // START='{"shift":[..],"rot":[..],"joints":{..}}': go on from an earlier run's best, before it is written
  if (process.env.START) {
    const s = JSON.parse(process.env.START) as { shift?: number[]; rot?: number[]; joints?: Record<string, number[]> };
    if (s.shift) hold[SIDE].shift = s.shift;
    if (s.rot) hold[SIDE].rot = s.rot;
    for (const [j, e] of Object.entries(s.joints ?? {})) hold[SIDE].joint[j] = e;
  }
  for (const j of JOINTS) hold[SIDE].joint[j] ??= [0, 0, 0];
  const setup = { side: SIDE, pickup: list(process.env.PICKUP, "").map(Number), over: OVER_BONES, flush: FLUSH_BONES, touch: TOUCH_BONES, together: TOGETHER, togetherMm: Number(process.env.TOGETHER_MM ?? 0), trigger: process.env.TRIGGER ?? "", joints: JOINTS, pct: PCT, flushMm: FLUSH, deep: DEEP, tries: TRIES, move: MOVE, turn: TURN, jturn: JTURN, seen: SEEN };
  const res = (await page.evaluate(`(async () => {
    const r = window.__range;
    const T = r.THREE;
    const rig = r.packRig();
    // the idle's breath held still, so two tries of one hold score alike (fprig.ts debugStill, Milestone 462)
    rig.debugStill = true;
    const S = ${JSON.stringify(setup)};
    const frame = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    const hold = ${JSON.stringify(hold)};
    const H = hold[S.side];
    const pct = (xs, q) => { if (!xs || !xs.length) return 30; const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
    const at = (n) => rig.group.getObjectByName(n + "_" + S.side).getWorldPosition(new T.Vector3());
    const gs = rig.group.getWorldScale(new T.Vector3()).x;
    const look = async (x) => {
      H.shift = x.shift; H.rot = x.rot;
      for (const j of S.joints) H.joint[j] = x.joints[j];
      rig.debugHold = hold;
      await frame();
      const a = window.__packAudit(S.deep / 1000, false, { side: S.side, gapList: true });
      const st = r.packArms();
      const overRe = new RegExp(S.over);
      const over = Object.entries(a.bones).filter(([b]) => b.endsWith("_" + S.side) && overRe.test(b)).reduce((s, [, v]) => s + Math.max(0, v - S.deep), 0);
      const flush = S.flush.map((f) => { const [b, q] = f.split("@"); return pct(a.gapList[b + "_" + S.side], q ? Number(q) : S.pct); });
      const touch = S.touch.map((b) => a.boneGap[b + "_" + S.side] ?? 30);
      // the fingertips' spacing, mm: each pair's gap against the last pair's
      let apart = 0; const gaps = [];
      for (let i = 0; i + 1 < S.together.length; i++) gaps.push(at(S.together[i]).distanceTo(at(S.together[i + 1])) / gs * 1000);
      // (each against a set spacing where one is given: asked only to be even, BOOG's spread 74 mm apart were made even at
      // 101, where a hand's lie 25 apart)
      if (S.togetherMm > 0) for (const g of gaps) apart += Math.abs(g - S.togetherMm);
      else if (gaps.length > 1) for (let i = 0; i + 1 < gaps.length; i++) apart += Math.abs(gaps[i] - gaps[gaps.length - 1]);
      // the forefinger's tip on the trigger (its last joint out by 0.8 of the bone before, as fprig.ts finds a tip), mm to
      // the trigger's box: the owner, 2026-09-30, "trigger finger should be on the trigger, not in the ready position"
      let trig = 0;
      if (S.trigger) {
        const j2 = at(S.trigger.replace("_03", "_02"));
        const j3 = at(S.trigger);
        const tip = j3.clone().addScaledVector(j3.clone().sub(j2), 0.8);
        let t = null;
        r.viewModelRoot().traverse((o) => { if (!t && o.name === "Trigger") t = o; });
        trig = t ? new T.Box3().setFromObject(t).distanceToPoint(tip) / gs * 1000 : 30;
      }
      const wrist = S.side === "l" ? st.wristL : st.wristR;
      const short = (S.side === "l" ? st.reachShort : st.reachShortR) * 1000;
      // and the same hold where the pickup's clip carries the gun (PICKUP shares): the arm reaching and nothing in the gun
      // (the USSO's left hand laid flush fell short of its place there and came back 10 mm into the gun)
      let pickShort = 0, pickOver = 0;
      for (const u of S.pickup) {
        r.packPickupAt(u);
        await frame();
        const b = window.__packAudit(S.deep / 1000, false, { side: S.side });
        const ps = r.packArms();
        pickShort = Math.max(pickShort, (S.side === "l" ? ps.reachShort : ps.reachShortR) * 1000);
        pickOver += Object.entries(b.bones).filter(([n]) => n.endsWith("_" + S.side)).reduce((s, [, v]) => s + Math.max(0, v - S.deep), 0);
      }
      if (S.pickup.length) { r.packPickupAt(null); await frame(); }
      const sg = S.seen > 0 ? window.__packSeenGap(S.side, { w: 480, r: 3 }) : null;
      const seen = sg ? sg.holes + sg.cracks : 0;
      const score = seen * S.seen + over * 3 + flush.reduce((s, g) => s + Math.max(0, g - S.flushMm), 0) * 2 + touch.reduce((s, g) => s + Math.max(0, g - S.flushMm), 0) + apart * 0.5 + trig * 2 + Math.max(0, wrist - 45) + short * 10 + pickShort * 10 + pickOver * 3;
      // (and each flush bone's spread, for the report: its skin's gaps at a twentieth, a tenth, a quarter and half)
      const spread = Object.fromEntries(S.flush.map((f) => f.split("@")[0]).map((b) => [b, [0.05, 0.1, 0.25, 0.5].map((q) => pct(a.gapList[b + "_" + S.side], q))]));
      return { score, seen, over, flush, touch, gaps, trig, wrist, short, pickShort, pickOver, spread };
    };
    const x0 = { shift: H.shift.slice(), rot: H.rot.slice(), joints: Object.fromEntries(S.joints.map((j) => [j, H.joint[j].slice()])) };
    const start = await look(x0);
    let best = { x: x0, m: start, total: start.score };
    let seed = 20260929;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 * 2 - 1; };
    const reg = (x) => x.rot.reduce((s, v, i) => s + Math.abs(v - x0.rot[i]), 0) + S.joints.reduce((s, j) => s + x.joints[j].reduce((t, v, i) => t + Math.abs(v - x0.joints[j][i]), 0), 0) * 0.5;
    for (let i = 0; i < S.tries; i++) {
      const k = i < S.tries / 2 ? 1 : 0.3;
      const from = i < S.tries / 2 ? x0 : best.x;
      const x = {
        shift: from.shift.map((v) => v + rnd() * S.move * k),
        rot: from.rot.map((v) => v + rnd() * S.turn * k),
        joints: Object.fromEntries(S.joints.map((j) => [j, from.joints[j].map((v) => v + rnd() * S.jturn * k)])),
      };
      const m = await look(x);
      const total = m.score + reg(x);
      if (total < best.total) best = { x, m, total };
    }
    rig.debugHold = null;
    return { start, best };
  })()`)) as { start: Record<string, unknown>; best: { x: { shift: number[]; rot: number[]; joints: Record<string, number[]> }; m: Record<string, unknown> } };
  const fmt = (m: Record<string, unknown>) => JSON.stringify(m, (_, v) => (typeof v === "number" ? Math.round(v * 10) / 10 : v));
  console.log(`${ID} ${SIDE} (${name}) before: ${fmt(res.start)}`);
  console.log(`${ID} ${SIDE} best: ${fmt(res.best.m)}\n   ${JSON.stringify(res.best.x, (_, v) => (typeof v === "number" ? Math.round(v * 10000) / 10000 : v))}`);
  if (WRITE) {
    const raw = fs.readFileSync(CFG, "utf8");
    const nl = raw.includes("\r\n") ? "\r\n" : "\n";
    const d = JSON.parse(raw);
    const h = d.packGuns[name].hold[SIDE];
    const r4 = (v: number) => Math.round(v * 10000) / 10000;
    h.shift = res.best.x.shift.map(r4);
    if (res.best.x.rot.some((v) => Math.abs(v) > 1e-6)) h.rot = res.best.x.rot.map((v) => Math.round(v * 1000) / 1000);
    for (const [j, e] of Object.entries(res.best.x.joints)) (h.joint ??= {})[j] = e.map((v) => Math.round(v * 1000) / 1000);
    fs.writeFileSync(CFG, (JSON.stringify(d, null, 2) + "\n").replace(/\n/g, nl));
    console.log(`wrote ${name} ${SIDE}'s hold`);
  }
} finally {
  await browser.close();
}
