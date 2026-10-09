// A gun in the bought arms measured as the soldier e2e's pack frames measure it (tools/e2e.ts packFrames), and the keys
// behind a failing move searched in the page, live, against those same measures (Milestone 488). ANAKIN's swap took a
// day of one-off probes: its hands went 6 to 7 mm into the gun whatever single key was moved, and only a search over the
// cup's move, turn, bend and timing together, scored as the e2e scores, found a way through. Each gun after it is fitted
// with this.
//
// The keys are changed on the page's own copy of fparms.json (the module the rig reads), so a try costs a sweep and no
// reload; WRITE=1 writes the best back into src/config/fparms.json.
//
// Run: SHOT_URL=http://localhost:5196/ npx tsx tools/pack-tune.ts <gun id> [stage...]
//   stages: report (the default: every measure, no search), swap, pickup, inspect, melee, shoulders
//   TRIES=40 a stage's search; SEED=1 its start
// Headless, never the real mouse or keyboard.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const URL = process.env.SHOT_URL ?? "http://localhost:5196/";
const ID = process.argv[2] ?? "r97";
const STAGES = process.argv.slice(3).length ? process.argv.slice(3) : ["report"];
const TRIES = Number(process.env.TRIES ?? 40);
const SEED = Number(process.env.SEED ?? 1);
const WRITE = process.env.WRITE === "1";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CFG = path.join(HERE, "..", "src", "config", "fparms.json");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;

/** the page's measures and searches: one evaluate per stage, the helpers kept on window.__tune */
const PAGE = `(async () => {
  const r = window.__range;
  const rig = r.packRig();
  const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const gw = async (s) => { const g0 = r.gameTime(); const t0 = performance.now(); while (r.gameTime() - g0 < s && performance.now() - t0 < 30000) await wait(20); };
  const mod = (await import("/src/config/fparms.json?import")).default;
  const T = window.__tune = { r, rig, gw, mod };
  T.pack = () => mod.packGuns[mod.guns[${JSON.stringify(ID)}]];
  T.clear = async () => { r.debugView.reload = null; r.debugView.raise = null; r.debugView.ads = null; r.debugView.inspect = -1; r.debugView.flourish = -1; r.meleeAt(null); r.packPickupAt(null); await gw(0.3); };
  const seen = () => { const a = window.__packAudit(0.004); return a ? a.seenDeepest * 1000 : 0; };
  // (three looks, as the e2e's H.through takes the worst of)
  const through = async () => { let w = 0; for (let i = 0; i < 3; i++) { w = Math.max(w, seen()); await wait(120); } return w; };
  T.rest = async () => {
    await T.clear(); await gw(0.2);
    const a = r.packArms(); const L = window.__packSeenGap("l"), R = window.__packSeenGap("r");
    const out = { wrists: [a.wristL, a.wristR], held: await through(), day: { l: [L.holes, L.cracks], r: [R.holes, R.cracks] } };
    r.debugView.ads = 1; await gw(0.4); const b = r.packArms(); out.aimed = [b.wristL, b.wristR];
    await T.clear();
    for (const [k, v] of [["pointing", 0.28], ["magIn", 0.46], ["racking", 0.78]]) { r.debugView.reload = v; await gw(0.35); out[k] = await through(); if (k === "pointing") out.pointWrist = r.packArms().wristL; await T.clear(); }
    return out;
  };
  T.swap = async () => {
    let deep = 0, at = 0;
    for (let u = 0.04; u < 0.97; u += 0.04) { r.debugView.raise = u; await gw(0.1); const d = seen(); if (d > deep) { deep = d; at = u; } }
    r.debugView.raise = 0.4; await gw(0.6); const c = r.packArms();
    const out = { deep, at: +at.toFixed(2), face: c.cupFace, off: c.cupOff * 100, curl: Math.min(c.curlL, c.curlR) };
    await T.clear();
    let thr = 0;
    for (const u of [0.12, 0.88]) { r.debugView.raise = u; await gw(0.35); thr = Math.max(thr, await through()); await T.clear(); }
    out.thr = thr;
    r.debugView.raise = 0.16; await gw(0.3); out.wE = r.packArms().wristL; await T.clear();
    return out;
  };
  T.pickup = async () => { r.packPickupAt(0.6); await gw(0.35); const d = await through(); await T.clear(); return { deep: d }; };
  T.moves = async (knob) => {
    const w = { deep: 0, wrist: 0, wrung: 0, short: 0 };
    for (const u of [0.04, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.96]) { r.debugView[knob] = u; await gw(0.12); const s = r.packArms(); w.deep = Math.max(w.deep, seen()); w.wrist = Math.max(w.wrist, s.wristL, s.wristR); w.wrung = Math.max(w.wrung, s.skinL, s.skinR); w.short = Math.max(w.short, s.reachShort, s.reachShortR); }
    await T.clear(); return w;
  };
  // (and how much of the left upper arm is in the picture through the punch, as the e2e's fit check counts it: PANDA's
  // shoulder brought forward for its reach filled 80% of the picture with sleeve)
  T.upperIn = () => {
    const root = r.viewModelRoot(); const inv = new r.THREE.Matrix4().copy(root.matrixWorld).invert();
    const tv = Math.tan(((r.gunFov().gun / 2) * Math.PI) / 180), th = (tv * innerWidth) / innerHeight;
    let n = 0, k = 0;
    rig.group.traverse((m) => { if (!m.isSkinnedMesh) return; const g = m.geometry; const pos = g.attributes.position, sk = g.attributes.skinIndex, sw = g.attributes.skinWeight; const v = new r.THREE.Vector3(); for (let i = 0; i < pos.count; i += 2) { let up = 0; for (let j = 0; j < 4; j++) if (sw.getComponent(i, j) > 0.5 && /^upperarm.*_l$/.test(m.skeleton.bones[sk.getComponent(i, j)].name)) up = 1; if (!up) continue; n++; v.fromBufferAttribute(pos, i); m.applyBoneTransform(i, v); v.applyMatrix4(m.matrixWorld).applyMatrix4(inv); if (v.z < 0 && Math.abs(v.x / -v.z / th) < 1 && Math.abs(v.y / -v.z / tv) < 1) k++; } });
    return n ? k / n : 0;
  };
  T.melee = async () => {
    let upper = 0;
    for (const u of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) { r.meleeAt(u); await gw(0.15); upper = Math.max(upper, T.upperIn()); }
    r.meleeAt(0.4); await gw(0.3); const s = r.packArms(); const d = await through(); await T.clear();
    return { on: s.on, free: s.free, off: s.offHold, curl: s.curlL, deep: d, upper };
  };
  // a seeded jitter, for searches that repeat
  let seed = 1;
  T.seed = (s) => { seed = s; };
  T.rnd = (a, b) => { seed = (seed * 1103515245 + 12345) % 2147483648; return a + (seed / 2147483648) * (b - a); };
  r.loadout.give(0, ${JSON.stringify(ID)}); r.loadout.requestSwap(0, r.gameTime()); await gw(2.5);
  rig.debugStill = true; await gw(0.3);
  return mod.guns[${JSON.stringify(ID)}];
})()`;

/** what fails, as the e2e's checks put it: a list of the faults */
type Report = Record<string, unknown> & { rest: { wrists: number[]; aimed: number[]; held: number; day: { l: number[]; r: number[] }; pointing: number; magIn: number; racking: number; pointWrist: number }; swap: Record<string, number>; pickup: { deep: number }; inspect: Record<string, number>; flourish: Record<string, number>; melee: Record<string, number | boolean> };
function faults(m: Report): string[] {
  const f: string[] = [];
  const R = m.rest;
  if (Math.max(...R.wrists, ...R.aimed) > 50) f.push(`wrists rest ${R.wrists.map(Math.round)} aimed ${R.aimed.map(Math.round)} (50)`);
  for (const k of ["held", "pointing", "magIn", "racking"] as const) if (R[k] > 4) f.push(`${k} ${R[k].toFixed(1)} mm in the gun (4)`);
  for (const s of ["l", "r"] as const) if (R.day[s][0] > 5 || R.day[s][1] > 40) f.push(`daylight ${s} ${R.day[s]} (5 holes, 40 cracks)`);
  const S = m.swap;
  if (S.deep > 4 || S.thr > 4) f.push(`swap ${S.deep.toFixed(1)} / ${S.thr.toFixed(1)} mm in the gun (4)`);
  if (S.face > 50) f.push(`swap palms ${Math.round(S.face)} degrees off the middle (50)`);
  if (S.off < 1 || S.off > 4) f.push(`swap hands ${S.off.toFixed(1)} cm off (1 to 4)`);
  if (S.curl < 45) f.push(`swap fingers bent ${Math.round(S.curl)} (45)`);
  if (S.wE > 60) f.push(`swap wrist early ${Math.round(S.wE)} (60)`);
  if (m.pickup.deep > 4) f.push(`pickup ${m.pickup.deep.toFixed(1)} mm in the gun (4)`);
  for (const k of ["inspect", "flourish"] as const) {
    const w = m[k];
    if (w.deep > 4 || w.wrist > 60 || w.wrung > 90 || w.short > 0.01) f.push(`${k} deep ${w.deep.toFixed(1)} wrist ${Math.round(w.wrist)} wrung ${Math.round(w.wrung)} short ${(w.short * 100).toFixed(1)} cm`);
  }
  const M = m.melee;
  if (!M.on || M.free || (M.off as number) <= 0.12 || (M.curl as number) < 120 || (M.deep as number) > 4) f.push(`melee off ${((M.off as number) * 100).toFixed(1)} cm curl ${Math.round(M.curl as number)} deep ${(M.deep as number).toFixed(1)}`);
  if ((M.upper as number) >= 0.1) f.push(`melee upper arm ${Math.round((M.upper as number) * 100)}% in the picture (10)`);
  return f;
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 3600000, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  // (the e2e's page shape, 16:9 at the default field of view, so a measure here is the e2e's)
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  page.on("pageerror", (e) => console.log("pageerror:", String(e)));
  await page.goto(`${URL}?game=speedkills&nointro`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction("window.__range && window.__range.loaded() && window.__range.paidGuns().ready && window.__range.soldierReady()", { polling: 250, timeout: 180000 });
  await page.evaluate(fs.readFileSync(path.join(HERE, "pack-audit.js"), "utf8"));
  const packName = (await page.evaluate(PAGE)) as string;
  if (!packName) throw new Error(`${ID} is not in the bought arms (fparms.json guns)`);
  const ev = <T>(js: string) => page.evaluate(`(async () => { const T = window.__tune; const { r, rig, gw, mod } = T; ${js} })()`) as Promise<T>;
  const report = async (): Promise<Report> =>
    ({ rest: await ev(`return await T.rest();`), swap: await ev(`return await T.swap();`), pickup: await ev(`return await T.pickup();`), inspect: await ev(`return await T.moves("inspect");`), flourish: await ev(`return await T.moves("flourish");`), melee: await ev(`return await T.melee();`) }) as Report;
  const show = (m: Report) => JSON.stringify(m, (_, v) => (typeof v === "number" ? Math.round(v * 10) / 10 : v));
  const before = await report();
  console.log(`${ID} (${packName}) before: ${show(before)}`);
  console.log(`  faults: ${faults(before).join("; ") || "none"}`);

  // each stage: the keys it moves, a try from the best so far, and its score from the measures it touches
  const keep: Record<string, unknown> = {};
  for (const stage of STAGES) {
    if (stage === "report") continue;
    const res = (await ev(`
      const P = T.pack();
      T.seed(${SEED});
      const jit = (v, d, k, lo, hi) => Math.min(hi, Math.max(lo, +(v + T.rnd(-d, d) * k).toFixed(4)));
      const stage = ${JSON.stringify(stage)};
      let get, set, measure, score;
      if (stage === "swap") {
        const C = mod.swap.cup;
        get = () => JSON.parse(JSON.stringify({ move: P.cupMove ?? { l: C.move.l, r: C.move.r }, cup: { turn: P.cup?.turn ?? C.turn, curl: P.cup?.curl ?? C.curl, shape: { l: P.cup?.shape?.l ?? C.shape.l, r: P.cup?.shape?.r ?? C.shape.r }, moveAt: { l: P.cup?.moveAt?.l ?? C.moveAt.l, r: P.cup?.moveAt?.r ?? C.moveAt.r } } }));
        set = (x) => { P.cupMove = x.move; P.cup = x.cup; };
        measure = () => T.swap();
        score = (m) => Math.max(0, Math.max(m.deep, m.thr) - 3.3) * 10 + Math.max(0, m.face - 46) * 3 + Math.max(0, m.off - 3.9) * 30 + Math.max(0, 1.2 - m.off) * 30 + Math.max(0, 47 - m.curl) * 3 + Math.max(0, m.wE - 56) * 6;
        T.jitter = (b, k) => { const s0 = jit(b.cup.shape.l[0], 0.2, k, 0, 0.6), m0 = jit(b.cup.moveAt.l[0], 0.2, k, 0, 0.7); return { move: { l: b.move.l.map((v) => jit(v, 0.015, k, -0.05, 0.05)), r: b.move.r.map((v) => jit(v, 0.01, k, -0.05, 0.05)) }, cup: { turn: jit(b.cup.turn, 0.25, k, 0, 1), curl: jit(b.cup.curl, 0.15, k, 0, 0.5), shape: { l: [s0, jit(b.cup.shape.l[1], 0.2, k, s0 + 0.1, 1)], r: [jit(b.cup.shape.r[0], 0.15, k, 0, 0.5), jit(b.cup.shape.r[1], 0.2, k, 0.3, 1)] }, moveAt: { l: [m0, jit(b.cup.moveAt.l[1], 0.2, k, m0 + 0.1, 1)], r: [jit(b.cup.moveAt.r[0], 0.15, k, 0, 0.5), jit(b.cup.moveAt.r[1], 0.2, k, 0.5, 1)] } } }; };
      } else if (stage === "pickup") {
        const H = P.hold.l;
        get = () => ({ d: [0, 0, 0] });
        set = (x) => { H.pick = { shift: H.shift.map((v, i) => +(v + x.d[i]).toFixed(4)), rot: H.rot ? H.rot.slice() : [0, 0, 0], joint: JSON.parse(JSON.stringify(H.joint ?? {})), open: JSON.parse(JSON.stringify(H.open ?? {})) }; };
        measure = () => T.pickup();
        score = (m) => Math.max(0, m.deep - 3) * 10;
        T.jitter = (b, k) => ({ d: b.d.map((v) => jit(v, 0.02, k, -0.04, 0.04)) });
      } else if (stage === "inspect") {
        get = () => JSON.parse(JSON.stringify(P.beforeArm ?? { elbow: [0, -0.45, 0.1], shoulder: [0, 0, 0] }));
        set = (x) => { P.beforeArm = x; };
        measure = async () => ({ ins: await T.moves("inspect"), fl: await T.moves("flourish"), mel: await T.melee() });
        score = (m) => Math.max(0, m.ins.wrist - 56) * 3 + Math.max(0, m.ins.deep - 3.5) * 10 + Math.max(0, m.ins.wrung - 85) + Math.max(0, m.fl.wrist - 56) * 3 + Math.max(0, m.fl.deep - 3.5) * 10 + Math.max(0, m.mel.deep - 3.5) * 10 + Math.max(0, m.mel.upper - 0.08) * 300 + (m.ins.short + m.fl.short) * 1000;
        T.jitter = (b, k) => ({ elbow: b.elbow.map((v) => jit(v, 0.3, k, -1.5, 1.5)), shoulder: b.shoulder.map((v) => jit(v, 0.04, k, -0.15, 0.15)) });
      } else if (stage === "melee") {
        get = () => ({ way: P.meleeClearWay ?? [-1, -1, 0], clear: P.meleeClear ?? mod.melee?.clear ?? 1, shoulder: P.meleeShoulder ?? P.beforeArm?.shoulder ?? [0, 0, 0] });
        set = (x) => { P.meleeClearWay = x.way; P.meleeClear = x.clear; P.meleeShoulder = x.shoulder; };
        measure = () => T.melee();
        score = (m) => Math.max(0, m.deep - 3.5) * 10 + Math.max(0, 0.125 - m.off) * 500 + Math.max(0, 122 - m.curl) + Math.max(0, m.upper - 0.08) * 300;
        T.jitter = (b, k) => ({ way: b.way.map((v) => jit(v, 0.6, k, -1.5, 1.5)), clear: jit(b.clear, 0.6, k, 0, 3), shoulder: b.shoulder.map((v) => jit(v, 0.05, k, -0.2, 0.2)) });
      } else if (stage === "shoulders") {
        get = () => JSON.parse(JSON.stringify(P.shoulders));
        set = (x) => { P.shoulders = x; };
        measure = async () => ({ rest: await T.rest(), swap: await T.swap() });
        score = (m) => Math.max(0, Math.max(...m.rest.wrists, ...m.rest.aimed) - 46) * 3 + Math.max(0, m.swap.wE - 56) * 3 + Math.max(0, Math.max(m.swap.deep, m.swap.thr) - 3.3) * 10;
        T.jitter = (b, k) => Object.fromEntries(Object.entries(b).map(([key, v]) => [key, v.map((x) => jit(x, 0.03, k, -0.4, 0.4))]));
      } else return { error: "no stage " + stage };
      const start = get();
      set(start);
      let best = { x: start, m: await measure() };
      best.s = score(best.m);
      const first = best;
      for (let i = 0; i < ${TRIES}; i++) {
        const x = T.jitter(best.x, i < ${TRIES} / 2 ? 1 : 0.4);
        set(x);
        const m = await measure();
        const s = score(m);
        if (s < best.s) best = { x, m, s };
      }
      set(best.x);
      return { stage, first: { s: first.s, m: first.m }, best };
    `)) as { stage: string; error?: string; first: { s: number; m: unknown }; best: { x: unknown; m: unknown; s: number } };
    if (res.error) { console.log(res.error); continue; }
    console.log(`${stage}: score ${res.first.s.toFixed(1)} -> ${res.best.s.toFixed(1)}\n  ${JSON.stringify(res.best.x)}\n  ${JSON.stringify(res.best.m, (_, v) => (typeof v === "number" ? Math.round(v * 10) / 10 : v))}`);
    keep[stage] = res.best.x;
  }
  if (Object.keys(keep).length) {
    const after = await report();
    console.log(`${ID} after: ${show(after)}`);
    console.log(`  faults: ${faults(after).join("; ") || "none"}`);
    if (WRITE) {
      const raw = fs.readFileSync(CFG, "utf8");
      const d = JSON.parse(raw);
      const P = d.packGuns[packName];
      const x = keep as Record<string, any>;
      if (x.swap) { P.cupMove = x.swap.move; P.cup = x.swap.cup; }
      if (x.pickup) { const H = P.hold.l; H.pick = { shift: H.shift.map((v: number, i: number) => +(v + x.pickup.d[i]).toFixed(4)), rot: (H.rot ?? [0, 0, 0]).slice(), joint: structuredClone(H.joint ?? {}), open: structuredClone(H.open ?? {}) }; }
      if (x.inspect) P.beforeArm = x.inspect;
      if (x.melee) { P.meleeClearWay = x.melee.way; P.meleeClear = x.melee.clear; P.meleeShoulder = x.melee.shoulder; }
      if (x.shoulders) P.shoulders = x.shoulders;
      fs.writeFileSync(CFG, (JSON.stringify(d, null, 2) + "\n").replace(/\n/g, raw.includes("\r\n") ? "\r\n" : "\n"));
      console.log(`wrote ${packName}: ${Object.keys(keep).join(", ")}`);
    }
  }
} finally {
  await browser.close();
}
