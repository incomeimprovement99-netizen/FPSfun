// Fits the bought arms' hold to each of our guns on them, by measurement (the owner, 2026-09-28: the hands "on the
// correct area at all times, not glitching through the gun at any point"). The pack's hands are made for its own guns'
// grips, and ours are thicker: the USSO's magazine runs up its grip, and the right palm made for the MPS5's sank 12 mm
// into it, the thumb 15. At the hold, again and again: each palm moved out along the way tools/pack-audit.js finds out
// of the gun, as far as its deepest point is in (and `MARGIN` more); then each finger still in the gun tried
// from curled tighter to opened, and the one that leaves it least through (`DEEP` or less is touching). WRITE=1 writes the fit into fparms.json (packGuns hold).
//
// Run: SHOT_URL=http://localhost:5196/ npx tsx tools/pack-fit.ts [ids...]   (every gun in fparms.json guns by default)
// Headless, never the real mouse or keyboard.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const URL = process.env.SHOT_URL ?? "http://localhost:5196/";
const IDS =
  process.argv.length > 2 ? process.argv.slice(2) : Object.keys(JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "config", "fparms.json"), "utf8")).guns);
const WRITE = process.env.WRITE === "1";
/** the owner's field of view setting (tools/pack-frames.ts looks at the same) */
const FOV = Number(process.env.FOV ?? 1.571);
/** skin deeper than this is through the gun (as tools/pack-frames.ts) */
const DEEP = 0.004;
/** a palm moved this much further than its deepest point was in, metres, so it rests on the surface, not in it */
const MARGIN = 0.001;
/** a finger's tries: below 0 curled tighter than the pack's, above it opened toward straight */
const TRY = [-0.4, -0.3, -0.2, -0.1, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
/** a finger's base joint turned by these, radians, about each of its axes in turn */
const TURNS = [-0.5, -0.3, -0.15, 0.15, 0.3, 0.5];
/** a hand moved by these, view metres, along each of our gun's axes in turn */
const NUDGE = [-0.015, -0.01, -0.005, -0.0025, 0.0025, 0.005, 0.01, 0.015];
/** a held palm this near the gun touches it, view metres */
const TOUCH = 0.001;
const ROUNDS = 12;
/**
 * The states a hold is seen in, each set on the view and read: at the hip the right hand is mostly under the screen's
 * edge, aimed it comes up with the gun, and turned over for a reload's point it is in the middle of the picture
 */
const STATES = ["", "r.debugView.reload = 0.3;", "r.debugView.ads = 1;"];
/** looks a state, a moment apart: the idle's sway moves the eye against the gun */
const LOOKS = 2;
/** the fingers are tried again while any is still in, at most this often */
const PASSES = 3;
const FINGERS = ["thumb", "index", "middle", "ring", "pinky"];
const CHROME =
  process.env.CHROME_PATH ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const AUDIT = fs.readFileSync(path.join(HERE, "pack-audit.js"), "utf8");
const CFG = path.join(HERE, "..", "src", "config", "fparms.json");
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Hand = { shift: number[]; open: Record<string, number>; turn?: Record<string, number[]> };
type Audit = {
  l: number;
  r: number;
  seenL: number;
  seenR: number;
  seenDeepest: number;
  deepest: number;
  bones: Record<string, number>;
  seenBones: Record<string, number>;
  push: Record<string, number[]>;
  palmGap: Record<string, number>;
  holdGap: Record<string, number>;
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    "--use-angle=d3d11",
    "--enable-gpu",
    "--ignore-gpu-blocklist",
    "--mute-audio",
    "--no-sandbox",
  ],
});
const fits: Record<
  string,
  { l: Hand; r: Hand; before: string; after: string }
> = {};
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  await page.evaluateOnNewDocument(
    `try { const k = "range.settings.v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.fovScale = ${FOV}; localStorage.setItem(k, JSON.stringify(s)); } catch {}`,
  );
  page.on("pageerror", (e) => console.log("pageerror:", String(e)));
  await page.goto(`${URL}?game=speedkills&nointro`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForFunction(
    "Boolean(window.__range) && window.__range.loaded() && window.__range.paidGuns().ready && window.__range.soldierReady()",
    { polling: 250, timeout: 90000 },
  );
  await page.evaluate(
    `document.getElementById("overlay").classList.add("hidden"); window.__range.input.locked = true; ${AUDIT}`,
  );
  for (const id of IDS) {
    await page.evaluate(
      `(() => { const r = window.__range; r.player.teleport(0, 0, 0, 0, 0); r.debugView.inspect = -1; r.loadout.give(0, ${JSON.stringify(id)}); r.loadout.requestSwap(0, r.gameTime()); })()`,
    );
    await wait(2800);
    const name = (await page.evaluate("window.__range.packArms().active")) as
      string | null;
    if (!name) {
      console.log(`${id}: not on the bought arms`);
      continue;
    }
    // from nothing: a fit found on top of the last one would never take back a step it no longer needs (FROM_CONFIG=1:
    // from the one written, to go on with its fingers' turns alone)
    const saved = JSON.parse(fs.readFileSync(CFG, "utf8")).packGuns?.[name]?.hold;
    const hold: Record<"l" | "r", Hand> =
      process.env.FROM_CONFIG === "1" && saved
        ? { l: { turn: {}, ...saved.l }, r: { turn: {}, ...saved.r } }
        : { l: { shift: [0, 0, 0], open: {}, turn: {} }, r: { shift: [0, 0, 0], open: {}, turn: {} } };
    // every state's looks together: each bone's deepest, each count's most, and the palms' way out from the look they
    // were deepest in. The fit goes by how deep the skin is (`bones`), which is the hold's alone; what the eye sees of it
    // (`seenBones`) comes and goes with the idle's sway, and fitted by that the same hold read 9 points through, then 60,
    // and the fit chased the noise into a worse one (77 through where it began at 32)
    const measure = async (): Promise<Audit> => {
      await page.evaluate(
        `window.__range.packRig().debugHold = ${JSON.stringify(hold)}`,
      );
      let worst: Audit | null = null;
      for (let i = 0; i < STATES.length * LOOKS; i++) {
        if (i % LOOKS === 0)
          await page.evaluate(
            `(() => { const r = window.__range; r.debugView.ads = null; r.debugView.reload = null; ${STATES[i / LOOKS]} })()`,
          );
        // (aimed last and a long settle: BOOG's scope hides the gun aimed, and eased half out of it the gun was still hidden,
        // so the reload's state read as nothing through it)
        await wait(i % LOOKS === 0 ? 800 : 230);
        const b = (await page.evaluate(`window.__packAudit(${DEEP})`)) as Audit;
        if (process.env.LOOKLOG) console.log(`    look ${i}: seen L ${b.seenL} R ${b.seenR}, in L ${b.l} R ${b.r}`);
        // (the palm's gap to the gun held, at rest and aimed: in the reload's state the left hand points, off the gun)
        const held = STATES[Math.floor(i / LOOKS)] !== "r.debugView.reload = 0.3;";
        if (!worst) {
          worst = b;
          worst.holdGap = { l: held ? b.palmGap.l : 0, r: held ? b.palmGap.r : 0 };
          continue;
        }
        if (held) for (const sd of ["l", "r"]) worst.holdGap[sd] = Math.max(worst.holdGap[sd], b.palmGap[sd]);
        for (const side of ["l", "r"] as const) if ((b.bones[`hand_${side}`] ?? 0) > (worst.bones[`hand_${side}`] ?? 0)) worst.push[side] = b.push[side];
        for (const key of ["bones", "seenBones"] as const) for (const [k, v] of Object.entries(b[key])) worst[key][k] = Math.max(worst[key][k] ?? 0, v);
        worst.l = Math.max(worst.l, b.l);
        worst.r = Math.max(worst.r, b.r);
        worst.seenL = Math.max(worst.seenL, b.seenL);
        worst.seenR = Math.max(worst.seenR, b.seenR);
        worst.seenDeepest = Math.max(worst.seenDeepest, b.seenDeepest);
        worst.deepest = Math.max(worst.deepest, b.deepest);
      }
      await page.evaluate(
        "window.__range.debugView.ads = null; window.__range.debugView.reload = null",
      );
      await wait(800);
      return worst!;
    };
    const say = (a: Audit) =>
      `in L ${a.l} R ${a.r} deepest ${(a.deepest * 1000).toFixed(0)} mm ${JSON.stringify(a.bones)}; seen L ${a.seenL} R ${a.seenR} deepest ${(a.seenDeepest * 1000).toFixed(0)} mm; palm gap L ${(a.holdGap.l * 1000).toFixed(1)} R ${(a.holdGap.r * 1000).toFixed(1)} mm`;
    let a = await measure();
    const before = say(a);
    console.log(`${id} (${name}) before: ${before}`);
    // STAGE=seen: only the last stage, on the fit written (with FROM_CONFIG=1)
    const seenOnly = process.env.STAGE === "seen";
    // the palms first, out along their way out of the gun, a few rounds
    for (let round = 0; round < (seenOnly ? 0 : ROUNDS); round++) {
      let moved = false;
      for (const side of ["l", "r"] as const) {
        const push = a.push[side];
        if (!push || (a.bones[`hand_${side}`] ?? 0) <= DEEP * 1000)
          continue;
        const g = (await page.evaluate(
          `window.__range.packRig().gunAxes(${JSON.stringify(push)})`,
        )) as number[];
        const len = Math.hypot(g[0], g[1], g[2]);
        if (len <= 0) continue;
        const k = (len + MARGIN) / len;
        hold[side].shift = hold[side].shift.map((v, i) => v + g[i] * k);
        moved = true;
      }
      if (!moved) break;
      a = await measure();
      console.log(
        `  palms, round ${round + 1}: ${say(a)}  shift L ${hold.l.shift.map((v) => (v * 100).toFixed(1)).join(",")} cm, R ${hold.r.shift.map((v) => (v * 100).toFixed(1)).join(",")} cm`,
      );
    }
    // then each finger still in where it is seen: from curled tighter than the pack's to opened toward straight, the one
    // that leaves it least through the gun where it is seen (straightened alone, a fingertip round a thick grip came out
    // through its near side)
    // a hand's worst: its deepest bone, mm, and a hundredth of a mm a point in, so of two as deep the one less in wins
    const hand = (b: Audit, side: "l" | "r") =>
      Math.max(0, ...Object.entries(b.bones).filter(([k]) => k.endsWith(`_${side}`)).map(([, v]) => v)) + (side === "l" ? b.l : b.r) / 100;
    const fingerIn = (b: Audit, side: string, fg: string) =>
      Math.max(
        0,
        ...["01", "02", "03"].map(
          (j) => b.bones[`${fg}_${j}_${side}`] ?? 0,
        ),
      );
    for (let pass = 0; pass < (seenOnly ? 0 : PASSES); pass++) {
      let tried = false;
      for (const side of ["l", "r"] as const) {
        for (const fg of FINGERS) {
          if (fingerIn(a, side, fg) <= DEEP * 1000) continue;
          tried = true;
          // (judged by the whole hand, its deepest and then how much of it is in: a finger shares skin with the next one
          // at the knuckle, and BOOG's index opened for its own sake pushed the thumb from 6 mm in to 16)
          const worse = (x: Audit, y: Audit) => hand(x, side) - hand(y, side);
          let best = { open: hold[side].open[fg] ?? 0, audit: a };
          for (const open of TRY) {
            hold[side].open[fg] = open;
            const b = await measure();
            const d = worse(b, best.audit);
            if (d < -0.5 || (Math.abs(d) <= 0.5 && Math.abs(open) < Math.abs(best.open))) best = { open, audit: b };
          }
          const depth = fingerIn(best.audit, side, fg);
          hold[side].open[fg] = best.open;
          a = best.audit;
          console.log(
            `  ${side} ${fg}: open ${best.open} leaves ${depth} mm  (${say(a)})`,
          );
        }
        for (const fg of Object.keys(hold[side].open))
          if (hold[side].open[fg] === 0) delete hold[side].open[fg];
      }
      if (!tried) break;
      a = await measure();
    }
    // then a finger still in turned at its base about each of its own axes: a thumb lies across the grip's side, and
    // neither curling it nor opening it moves it off (BOOG's stayed 13 mm into its grip either way)
    for (const side of seenOnly ? [] : (["l", "r"] as const)) {
      for (const fg of FINGERS) {
        if (fingerIn(a, side, fg) <= DEEP * 1000) continue;
        const was = hold[side].turn?.[fg] ?? [0, 0, 0];
        let best = { turn: was, audit: a };
        for (let axis = 0; axis < 3; axis++) {
          for (const ang of TURNS) {
            const t = was.slice();
            t[axis] += ang;
            hold[side].turn = { ...(hold[side].turn ?? {}), [fg]: t };
            const b = await measure();
            if (hand(b, side) < hand(best.audit, side) - 0.5) best = { turn: t, audit: b };
          }
        }
        hold[side].turn = { ...(hold[side].turn ?? {}), [fg]: best.turn };
        if (best.turn.every((v) => v === 0)) delete hold[side].turn![fg];
        a = best.audit;
        console.log(`  ${side} ${fg}: turned ${best.turn.map((v) => v.toFixed(2)).join(",")} leaves ${fingerIn(a, side, fg)} mm  (${say(a)})`);
      }
    }
    // last, each hand moved along each of our gun's axes in turn to where the least of it is through the gun where it is
    // seen: a finger pressed into the grip's far side is hidden behind the gun, and the pack's hands are made for grips
    // thinner than ours, so no curl or turn of a finger took it off both sides at once (BOOG's thumb 13 mm into the side
    // of its grip that faces you as it turns over for the reload)
    // (and on it: the palm within `TOUCH` of the gun where it holds it, a millimetre of gap past that as bad as one
    // through it; moved off for the fingers' sake alone, the USSO's left hand held the air 6 mm beside its gun)
    const seenOf = (b: Audit, side: "l" | "r") =>
      Math.max(0, ...Object.entries(b.seenBones).filter(([k]) => k.endsWith(`_${side}`)).map(([, v]) => v)) +
      Math.max(0, (Number.isFinite(b.holdGap[side]) ? b.holdGap[side] : 0.05) - TOUCH) * 1000 +
      (side === "l" ? b.l : b.r) / 1000;
    for (const side of ["l", "r"] as const) {
      if (seenOf(a, side) <= DEEP * 1000) continue;
      for (let axis = 0; axis < 3; axis++) {
        const was = hold[side].shift.slice();
        let best = { shift: was, audit: a };
        for (const d of NUDGE) {
          const t = was.slice();
          t[axis] += d;
          hold[side].shift = t;
          const b = await measure();
          if (seenOf(b, side) < seenOf(best.audit, side) - 0.5) best = { shift: t, audit: b };
        }
        hold[side].shift = best.shift;
        a = best.audit;
      }
      console.log(`  ${side} moved to ${hold[side].shift.map((v) => (v * 100).toFixed(1)).join(",")} cm  (${say(a)})`);
    }
    a = await measure();
    await page.evaluate(
      "window.__range.packRig().debugHold = null; window.__range.debugView.inspect = null",
    );
    fits[name] = { ...hold, before, after: say(a) };
    console.log(
      `${id} (${name}) after: ${say(a)}\n  fit ${JSON.stringify(hold)}`,
    );
  }
} finally {
  await browser.close();
}

if (WRITE) {
  const raw = fs.readFileSync(CFG, "utf8");
  const nl = raw.includes("\r\n") ? "\r\n" : "\n";
  const d = JSON.parse(raw);
  const round = (v: number) => Math.round(v * 10000) / 10000;
  for (const [name, fit] of Object.entries(fits)) {
    const hand = (h: Hand) => ({
      shift: h.shift.map(round),
      open: Object.fromEntries(
        Object.entries(h.open).map(([k, v]) => [k, round(v)]),
      ),
      ...(h.turn && Object.keys(h.turn).length ? { turn: Object.fromEntries(Object.entries(h.turn).map(([k, v]) => [k, v.map(round)])) } : {}),
    });
    d.packGuns[name].hold = { l: hand(fit.l), r: hand(fit.r) };
    d.packGuns[name]._hold =
      `Fitted by tools/pack-fit.ts on ${new Date().toISOString().slice(0, 10)}: before, ${fit.before}; after, ${fit.after}.`;
  }
  fs.writeFileSync(CFG, (JSON.stringify(d, null, 2) + "\n").replace(/\n/g, nl));
  console.log(`wrote ${Object.keys(fits).join(", ")} into ${CFG}`);
}
