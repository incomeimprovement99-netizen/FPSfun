// Finishes the bought arms' fit on a gun, where tools/pack-fit.ts (whole hands, whole fingers) left faults the frame
// sheets still flag (the owner, 2026-09-28: "why did you stop short of getting it perfect?"):
//
//   joints  each hand's fingers laid on our grip joint by joint, and the hand moved, until no skin is more than
//           `DEEP` into the gun while every finger that held the gun still touches it and the palm is on it. The grip
//           is the same against the gun in every state it holds the gun in (the hold, the point, aimed, a swap), so
//           it is fitted at the hold, by depth rather than by what is seen: seen or not, a thumb in the grip shows the
//           moment the gun turns over.
//   wrists  each shoulder moved, at rest and aimed, to where both wrists are straightest (the hands stay on the gun:
//           only the elbows and forearms move), and the pointing arm's elbow and reach to where its wrist is straightest
//           with the finger still on its spot.
//
// Coordinate descent: each parameter tried at a few steps either way and kept where the score is lowest, round after
// round. It cannot take a thumb from over a receiver to down a grip's side (every small turn keeps it inside):
// tools/pack-thumb.ts searches a finger's joints over their whole range for that. A Levenberg-Marquardt solve of a
// whole hand at once was tried here too and dropped: two minutes a step in the page, and it stalled where this did. WRITE=1 writes the result into fparms.json (packGuns hold joint and shift, shoulders, point).
//
// Run: SHOT_URL=http://localhost:5196/ npx tsx tools/pack-solve.ts [joints|wrists|all] [ids...]   (SIDES=r, STEPS=30, HOLD=index,middle,ring,pinky, KEEP_HAND=1)
// Headless, never the real mouse or keyboard.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer, { type Page } from "puppeteer";

const URL = process.env.SHOT_URL ?? "http://localhost:5196/";
const STAGE = process.argv[2] ?? "all";
const IDS = process.argv.length > 3 ? process.argv.slice(3) : ["r97", "sentinel"];
const WRITE = process.env.WRITE === "1";
/** skin this deep in the gun is touching it, mm (a grip presses the glove) */
const DEEP = 3.5;
/** a finger that held the gun is still on it within this, mm; the palm within `PALM` */
const TOUCH = 1.5;
const PALM = 1;
/** a wrist bent past this is flagged in the frame sheets (tools/pack-frames.ts), degrees; the aim is under it */
const WRIST = 50;
const FINGERS = ["thumb", "index", "middle", "ring", "pinky"];
const JOINT_STEPS = [-0.48, -0.24, -0.12, -0.06, 0.06, 0.12, 0.24, 0.48];
const SHIFT_STEPS = [-0.003, -0.0015, -0.0006, 0.0006, 0.0015, 0.003];
const SHOULDER_STEPS = [-0.04, -0.02, -0.01, 0.01, 0.02, 0.04];
const ROUNDS = Number(process.env.ROUNDS ?? 3);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const AUDIT = fs.readFileSync(path.join(HERE, "pack-audit.js"), "utf8");
const CFG = path.join(HERE, "..", "src", "config", "fparms.json");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Vec = number[];
type Hand = { shift: Vec; open: Record<string, number>; turn?: Record<string, Vec>; joint?: Record<string, Vec>; rot?: Vec };
type Audit = { bones: Record<string, number>; boneGap: Record<string, number>; palmGap: Record<string, number>; l: number; r: number };
type Shoulders = { l?: Vec; r?: Vec; adsL?: Vec; adsR?: Vec };
type Point = { elbow?: Vec; reach?: number };

const cfg = JSON.parse(fs.readFileSync(CFG, "utf8"));
const results: Record<string, { hold?: { l: Hand; r: Hand }; shoulders?: Shoulders; point?: Point; notes: string[] }> = {};

/** coordinate descent: each (key, index) tried at each step, kept at the lowest score, `rounds` times */
async function descend<T>(start: T, keys: Array<{ get: (t: T) => number; set: (t: T, v: number) => void; steps: number[] }>, score: (t: T) => Promise<number>, rounds: number, done: (s: number) => boolean, log: (s: number, t: T) => void): Promise<{ best: T; score: number }> {
  let best = structuredClone(start);
  let bestScore = await score(best);
  log(bestScore, best);
  for (let r = 0; r < rounds && !done(bestScore); r++) {
    let improved = false;
    for (const k of keys) {
      const was = k.get(best);
      let pick = { v: was, s: bestScore };
      for (const d of k.steps) {
        const t = structuredClone(best);
        k.set(t, was + d);
        const s = await score(t);
        if (s < pick.s - 0.05) pick = { v: was + d, s };
      }
      if (pick.v !== was) {
        k.set(best, pick.v);
        bestScore = pick.s;
        improved = true;
      }
      if (done(bestScore)) break;
    }
    log(bestScore, best);
    if (!improved) break;
  }
  return { best, score: bestScore };
}

async function joints(page: Page, id: string, name: string): Promise<void> {
  const saved = cfg.packGuns[name].hold ?? {};
  const hold: { l: Hand; r: Hand } = {
    l: { shift: [0, 0, 0], open: {}, ...structuredClone(saved.l ?? {}) },
    r: { shift: [0, 0, 0], open: {}, ...structuredClone(saved.r ?? {}) },
  };
  // (a try audits only the skin it can move: one hand to move the hand, one finger to turn its joints; a whole audit of
  // both hands took a second, and a hand's solve half an hour a round)
  const measure = async (h: { l: Hand; r: Hand }, only?: { side: string; bones?: string }): Promise<Audit> => {
    await page.evaluate(`window.__range.packRig().debugHold = ${JSON.stringify(h)}`);
    await wait(90);
    return (await page.evaluate(`window.__packAudit(0.004, false, ${JSON.stringify(only ?? null)})`)) as Audit;
  };
  const start = await measure(hold);
  for (const side of (process.env.SIDES ?? "l,r").split(",") as Array<"l" | "r">) {
    const on = (a: Audit, f: string) => Math.min(...["01", "02", "03"].map((j) => a.boneGap[`${f}_${j}_${side}`] ?? Infinity));
    // the fingers holding the gun as the fit left it: those within 3 mm of it (they must stay on it)
    // (HOLD=index,middle,... names the fingers to bring onto the gun whatever their start, for a hand moved to a new grip)
    const holding = process.env.HOLD ? process.env.HOLD.split(",") : FINGERS.filter((f) => on(start, f) <= 3);
    const mine = (a: Audit, re: RegExp) => Object.entries(a.bones).filter(([k]) => re.test(k));
    const deepest = (a: Audit, re: RegExp) => Math.max(0, ...mine(a, re).map(([, v]) => v));
    // every bone's depth past touching, summed: by the deepest alone, four fingers each 10 to 12 mm into the USSO's
    // grip held the score still whichever one was lifted, and nothing moved
    const over = (a: Audit, re: RegExp) => mine(a, re).reduce((s, [, v]) => s + Math.max(0, v - DEEP), 0);
    const turned = (h: Hand, f?: string) => Object.entries(h.joint ?? {}).filter(([k]) => !f || k.startsWith(f)).reduce((s, [, v]) => s + Math.abs(v[0]) + Math.abs(v[1]) + Math.abs(v[2]), 0);
    const sideRe = new RegExp(`_${side}$`);
    const before = await measure(hold, { side });
    console.log(`${id} ${side}: holding ${holding.join(",")}; before deepest ${deepest(before, sideRe)} mm, palm ${(before.palmGap[side] * 1000).toFixed(1)} mm, fingers off ${holding.map((f) => `${f} ${on(before, f)}`).join(" ")}`);
    // the hand first: out of the gun, the palm on it, the fingers holding it still on it
    const handScore = async (h: { l: Hand; r: Hand }): Promise<number> => {
      const a = await measure(h, { side });
      const palm = (a.palmGap[side] ?? Infinity) * 1000;
      return over(a, sideRe) + Math.max(0, deepest(a, sideRe) - DEEP) + Math.max(0, palm - PALM) * 3 + holding.reduce((s, f) => s + Math.max(0, on(a, f) - TOUCH), 0);
    };
    const shiftKeys = [
      ...[0, 1, 2].map((i) => ({ get: (t: { l: Hand; r: Hand }) => t[side].shift[i], set: (t: { l: Hand; r: Hand }, v: number) => (t[side].shift[i] = v), steps: SHIFT_STEPS })),
      // and turned about the wrist (the thumb's root is in the ball of the hand)
      ...[0, 1, 2].map((i) => ({
        get: (t: { l: Hand; r: Hand }) => t[side].rot?.[i] ?? 0,
        set: (t: { l: Hand; r: Hand }, v: number) => {
          const c = t[side].rot ?? [0, 0, 0];
          c[i] = v;
          t[side].rot = c;
        },
        steps: [-0.16, -0.08, -0.04, 0.04, 0.08, 0.16],
      })),
    ];
    // (KEEP_HAND=1 leaves the hand where it is and lays only the fingers: a hand laid flush by tools/pack-flush.ts was
    // moved 4.5 mm back here, and its palm came 1 mm off the gun's side)
    if (process.env.KEEP_HAND !== "1") {
      const res = await descend(hold, shiftKeys, handScore, ROUNDS, (s) => s < 0.3, (s) => console.log(`  ${id} ${side} hand ${s.toFixed(2)}`));
      hold[side] = res.best[side];
    }
    // then each finger in the gun, its three joints each about its three axes
    for (let pass = 0; pass < 2; pass++) {
      const now = await measure(hold, { side });
      for (const f of FINGERS) {
        const re = new RegExp(`^${f}_0[123]_${side}$`);
        if (deepest(now, re) <= DEEP && (!holding.includes(f) || on(now, f) <= TOUCH)) continue;
        const bones = `^${f}_0[123]_${side}$`;
        const fscore = async (h: { l: Hand; r: Hand }): Promise<number> => {
          const a = await measure(h, { side, bones });
          const touch = holding.includes(f) ? Math.max(0, on(a, f) - TOUCH) : 0;
          return over(a, re) * 2 + Math.max(0, deepest(a, re) - DEEP) * 2 + touch + turned(h[side], f) * 0.5;
        };
        const keys = ["01", "02", "03"].flatMap((j) =>
          [0, 1, 2].map((i) => ({
            get: (t: { l: Hand; r: Hand }) => t[side].joint?.[`${f}_${j}`]?.[i] ?? 0,
            set: (t: { l: Hand; r: Hand }, v: number) => {
              t[side].joint ??= {};
              const cur = t[side].joint![`${f}_${j}`] ?? [0, 0, 0];
              cur[i] = v;
              t[side].joint![`${f}_${j}`] = cur;
            },
            steps: JOINT_STEPS,
          })),
        );
        const fres = await descend(hold, keys, fscore, ROUNDS, (s) => s < 0.2, () => {});
        hold[side] = fres.best[side];
        const a = await measure(hold, { side, bones });
        console.log(`  ${id} ${side} ${f}: deepest ${deepest(a, re)} mm, gap ${on(a, f)} mm`);
      }
    }
    // the zero turns dropped
    for (const [k, v] of Object.entries(hold[side].joint ?? {})) if (v.every((x) => Math.abs(x) < 1e-6)) delete hold[side].joint![k];
    const after = await measure(hold, { side });
    const note = `${side} after: deepest ${deepest(after, sideRe)} mm, palm ${(after.palmGap[side] * 1000).toFixed(1)} mm, fingers ${holding.map((f) => `${f} ${on(after, f)}`).join(" ")}`;
    console.log(`  ${id} ${note}`);
    results[name].notes.push(note);
  }
  await page.evaluate("window.__range.packRig().debugHold = null");
  results[name].hold = hold;
}

/** in the page: how many of the arms' skin points (not the hands') are in the gun camera's picture, per cent */
const COVER = `window.__armCover = () => {
  const r = window.__range;
  const T = r.THREE;
  let rig = null;
  r.viewModelRoot().traverse((o) => { if (o.name === "pack-arms") rig = o; });
  const tanV = Math.tan(((r.gunFov().gun / 2) * Math.PI) / 180);
  const tanH = tanV * (innerWidth / innerHeight);
  let n = 0, on = 0;
  const v = new T.Vector3();
  rig.traverse((sk) => {
    if (!sk.isSkinnedMesh) return;
    if (!sk.userData.armVerts) {
      const si = sk.geometry.attributes.skinIndex, sw = sk.geometry.attributes.skinWeight, list = [];
      for (let i = 0; i < si.count; i += 4) {
        let best = 0, bi = 0;
        for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > best) { best = sw.getComponent(i, k); bi = si.getComponent(i, k); }
        const nm = (sk.skeleton.bones[bi] && sk.skeleton.bones[bi].name) || "";
        if (/(upperarm|lowerarm|clavicle)/.test(nm)) list.push(i);
      }
      sk.userData.armVerts = list;
    }
    for (const i of sk.userData.armVerts) {
      sk.getVertexPosition(i, v);
      v.applyMatrix4(sk.matrixWorld);
      rig.worldToLocal(v);
      n++;
      if (v.z < -0.02 && Math.abs(v.x) <= -v.z * tanH && Math.abs(v.y) <= -v.z * tanV) on++;
    }
  });
  return n ? (100 * on) / n : 0;
};`;

async function wrists(page: Page, id: string, name: string): Promise<void> {
  await page.evaluate(COVER);
  // from the pack's own shoulders (no fit of ours), and never with more of the arms in the picture than those put there:
  // the first search raised the USSO's left shoulder 16 cm and its sleeve filled the bottom of the picture aimed
  // (POINT_ONLY=1: the shoulders written, the pointing arm alone)
  const sh: Shoulders = process.env.POINT_ONLY === "1" ? structuredClone(cfg.packGuns[name].shoulders ?? {}) : {};
  const state = async (js: string) => {
    await page.evaluate(`(() => { const r = window.__range; r.debugView.ads = null; r.debugView.reload = null; ${js} })()`);
    await wait(700);
  };
  const read = async (): Promise<{ l: number; r: number; short: number; cover: number }> => {
    const s = (await page.evaluate("window.__range.packArms()")) as { wristL: number; wristR: number; reachShort: number; reachShortR: number };
    const cover = (await page.evaluate("window.__armCover()")) as number;
    return { l: s.wristL, r: s.wristR, short: Math.max(s.reachShort, s.reachShortR), cover };
  };
  for (const [label, js, keysOf] of [
    ["rest", "", ["l", "r"]],
    ["aimed", "r.debugView.ads = 1;", ["adsL", "adsR"]],
  ] as const) {
    if (process.env.POINT_ONLY === "1") break;
    await state(js);
    await page.evaluate(`window.__range.packRig().debugShoulders = ${JSON.stringify(sh)}`);
    await wait(150);
    const before = await read();
    const score = async (t: Shoulders): Promise<number> => {
      await page.evaluate(`window.__range.packRig().debugShoulders = ${JSON.stringify(t)}`);
      await wait(120);
      const b = await read();
      return Math.max(0, b.l - WRIST) + Math.max(0, b.r - WRIST) + (b.l + b.r) * 0.02 + b.short * 1000 + Math.max(0, b.cover - before.cover) * 5;
    };
    const keys = keysOf.flatMap((k) => [0, 1, 2].map((i) => ({ get: (t: Shoulders) => t[k]?.[i] ?? 0, set: (t: Shoulders, v: number) => { const c = t[k] ?? [0, 0, 0]; c[i] = v; t[k] = c; }, steps: SHOULDER_STEPS })));
    const res = await descend(sh, keys, score, ROUNDS, () => false, () => {});
    Object.assign(sh, res.best);
    await page.evaluate(`window.__range.packRig().debugShoulders = ${JSON.stringify(sh)}`);
    await wait(150);
    const after = await read();
    const note = `${label} wrists: before L ${before.l.toFixed(0)} R ${before.r.toFixed(0)}, after L ${after.l.toFixed(0)} R ${after.r.toFixed(0)}; arms in the picture ${before.cover.toFixed(1)}% then ${after.cover.toFixed(1)}% (shoulders ${JSON.stringify(sh)})`;
    console.log(`  ${id} ${note}`);
    results[name].notes.push(note);
  }
  results[name].shoulders = sh;
  // the pointing arm, with those shoulders in: its elbow's hang, the hand's reach behind the fingertip and how exactly
  // the finger turns onto its spot, for the straightest wrist with the tip on its spot (within 1 cm, 10 degrees) and no
  // more of the arm in the picture
  await page.evaluate(`window.__range.packRig().debugShoulders = ${JSON.stringify(sh)}`);
  const pt = cfg.packGuns[name].point ?? {};
  const P: Point & { aimAt: number } = { elbow: structuredClone(cfg.reload.elbow), reach: cfg.reload.reach, aimAt: pt.aimAt ?? cfg.reload.aimAt };
  await state("r.debugView.reload = 0.28;");
  await page.evaluate(`window.__range.packRig().debugPoint = ${JSON.stringify(P)}`);
  await wait(150);
  const p0 = await read();
  const pscore = async (t: Point & { aimAt: number }): Promise<number> => {
    if (t.aimAt > 1 || t.aimAt < 0.3 || t.reach! < 0.08) return 1e9;
    await page.evaluate(`window.__range.packRig().debugPoint = ${JSON.stringify(t)}`);
    await wait(120);
    const s = (await page.evaluate("window.__range.packArms()")) as { wristL: number; pointMiss: number; pointOff: number; reachShort: number };
    const cover = (await page.evaluate("window.__armCover()")) as number;
    const miss = Number.isFinite(s.pointMiss) ? s.pointMiss : 1;
    return Math.max(0, s.wristL - WRIST) + s.wristL * 0.02 + Math.max(0, miss - 0.01) * 1000 + Math.max(0, s.pointOff - 9) * 20 + s.reachShort * 1000 + Math.max(0, cover - p0.cover) * 5;
  };
  const pkeys = [
    ...[0, 1, 2].map((i) => ({ get: (t: Point & { aimAt: number }) => t.elbow![i], set: (t: Point & { aimAt: number }, v: number) => (t.elbow![i] = v), steps: [-0.6, -0.3, -0.15, 0.15, 0.3, 0.6] })),
    { get: (t: Point & { aimAt: number }) => t.reach!, set: (t: Point & { aimAt: number }, v: number) => (t.reach = v), steps: [-0.06, -0.03, 0.03, 0.06] },
    { get: (t: Point & { aimAt: number }) => t.aimAt, set: (t: Point & { aimAt: number }, v: number) => (t.aimAt = v), steps: [-0.3, -0.15, -0.07, 0.07] },
  ];
  const pres = await descend(P, pkeys, pscore, ROUNDS + 2, () => false, () => {});
  await page.evaluate(`window.__range.packRig().debugPoint = ${JSON.stringify(pres.best)}`);
  await wait(150);
  const w1 = (await page.evaluate("window.__range.packArms()")) as { wristL: number; pointMiss: number; pointOff: number };
  const c1 = (await page.evaluate("window.__armCover()")) as number;
  const note = `pointing wrist: before ${p0.l.toFixed(0)}, after ${w1.wristL.toFixed(0)} (tip ${(w1.pointMiss * 100).toFixed(1)} cm, ${w1.pointOff.toFixed(0)} deg; arms in the picture ${p0.cover.toFixed(1)}% then ${c1.toFixed(1)}%; elbow ${pres.best.elbow!.map((v) => v.toFixed(2)).join(",")}, reach ${pres.best.reach!.toFixed(2)}, aimAt ${pres.best.aimAt.toFixed(2)})`;
  console.log(`  ${id} ${note}`);
  results[name].notes.push(note);
  results[name].point = pres.best;
  await page.evaluate("window.__range.packRig().debugPoint = null; window.__range.packRig().debugShoulders = null; window.__range.debugView.reload = null");
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  page.on("pageerror", (e) => console.log("pageerror:", String(e)));
  await page.goto(`${URL}?game=speedkills&nointro`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("Boolean(window.__range) && window.__range.loaded() && window.__range.paidGuns().ready && window.__range.soldierReady()", { polling: 250, timeout: 90000 });
  await page.evaluate(`document.getElementById("overlay").classList.add("hidden"); window.__range.input.locked = true; ${AUDIT}`);
  for (const id of IDS) {
    await page.evaluate(`(() => { const r = window.__range; r.player.teleport(0, 0, 0, 0, 0); r.debugView.inspect = -1; r.loadout.give(0, ${JSON.stringify(id)}); r.loadout.requestSwap(0, r.gameTime()); })()`);
    await wait(2800);
    const name = (await page.evaluate("window.__range.packArms().active")) as string | null;
    if (!name) continue;
    results[name] = { notes: [] };
    if (STAGE === "joints" || STAGE === "all") await joints(page, id, name);
    if (STAGE === "wrists" || STAGE === "all") await wrists(page, id, name);
  }
} finally {
  await browser.close();
}

if (WRITE) {
  const raw = fs.readFileSync(CFG, "utf8");
  const nl = raw.includes("\r\n") ? "\r\n" : "\n";
  const d = JSON.parse(raw);
  const r4 = (v: number) => Math.round(v * 10000) / 10000;
  const rv = (v: Vec) => v.map(r4);
  for (const [name, res] of Object.entries(results)) {
    const g = d.packGuns[name];
    if (res.hold)
      for (const side of ["l", "r"] as const) {
        const h = res.hold[side];
        g.hold = g.hold ?? {};
        g.hold[side] = { ...g.hold[side], shift: rv(h.shift), ...(h.rot ? { rot: rv(h.rot) } : {}), ...(h.joint && Object.keys(h.joint).length ? { joint: Object.fromEntries(Object.entries(h.joint).map(([k, v]) => [k, rv(v)])) } : {}) };
      }
    if (res.shoulders) g.shoulders = Object.fromEntries(Object.entries(res.shoulders).map(([k, v]) => [k, rv(v as Vec)]));
    if (res.point) g.point = { ...g.point, elbow: rv(res.point.elbow!), reach: r4(res.point.reach!), ...((res.point as { aimAt?: number }).aimAt !== undefined ? { aimAt: r4((res.point as { aimAt: number }).aimAt) } : {}) };
    g._solve = `tools/pack-solve.ts, ${new Date().toISOString().slice(0, 10)}: ${res.notes.join("; ")}.`;
  }
  fs.writeFileSync(CFG, (JSON.stringify(d, null, 2) + "\n").replace(/\n/g, nl));
  console.log(`wrote ${Object.keys(results).join(", ")}`);
}
