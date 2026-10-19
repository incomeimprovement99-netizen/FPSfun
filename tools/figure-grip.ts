// Closing the soldier's fingers round a gun as a hand closes (Milestone 603). tools/figure-fit.ts closed each phalanx on
// its own until its skin touched, which touched, but left fingers no hand makes: a last joint bent 77 degrees on a
// middle one held straight, a pinky hooked from a straight knuckle, a support thumb tucked into the fist. A finger's
// last two joints move together (one tendon bends both: the last about two thirds of the middle), so here each finger
// has two numbers, its knuckle and its middle joint, the last joint following at FOLLOW of the middle; and of every
// pair that leaves its tip on what it holds and no skin in it, the one nearest a grasp's own proportion (the middle
// joint about NATURAL times the knuckle) is kept. The thumb the same way, its last joint following its middle, its
// sideways swing searched too. And a hand closes its fingers together: one held straight between two curled round the
// grip touched the gun with its tip and was no grasp (the first fit's ring finger on the alternator), so a second pass
// asks each finger to curl about as far as the hand's others (NEIGHBOUR, per degree off the middle one of theirs). The right index
// finger goes on the trigger at the crease of its last joint, as before (the owner, 2026-09-30), its last joint
// following too. The hands stay where they are, but for MOVE=r (or l): that hand is first moved, up to 15 mm, to where
// its holding fingers can all close round what they hold alike without going into it. A hand placed where a finger's
// line runs into the gun's side cannot close that finger at all: the alternator's right ring finger touched the gun
// held straight and went 8 to 11 mm in at any curl, between two fingers closed round the grip.
//
// What it holds: the gun, or for a pistol's left hand the right hand round the grip as well (the left wraps the right).
// Measured on one figure in the aimed pose by tools/figure-audit.js (tipGap: each finger's last phalanx to the gun).
//
// Run: SHOT_URL=http://localhost:5198/ npx tsx tools/figure-grip.ts <gun id>  (SIDES=r or l for one hand; MOVE=r to move
// that hand first, or HANDS='{"r":{"at":[x,y,z]}}' to keep a place one found; WRITE=1 stores it as guns.<id>.fingers,
// and a moved hand as its hands). KEY=handle fits a reload key's fingers instead, at the moment its hand holds it. Nothing the page loads may change while it runs (src/, the README): the page reloads.
import fs from "node:fs";
import path from "node:path";
import puppeteer, { type Page } from "puppeteer";

const URL = process.env.SHOT_URL ?? "http://localhost:5198/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ID = process.argv[2] ?? "r97";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const POSE = { speed: 0, stance: "stand", pitch: 0, ads: 1 };
const HOLD = JSON.parse(fs.readFileSync(path.resolve("src/config/soldierhold.json"), "utf8"));
const G = (HOLD.grip ?? {}) as { follow?: number; natural?: number; proportion?: number; thumbFollow?: number; neighbour?: number; swing?: number; spread?: number; wrapMin?: number; wrap?: number; hookBy?: number };
/** the last joint's bend as a share of the middle joint's (soldierhold.json grip.follow) */
const FOLLOW = G.follow ?? 0.67;
/** a grasp's middle joint against its knuckle (soldierhold.json grip.natural) */
const NATURAL = G.natural ?? 1.2;
/** a finger's middle joint off NATURAL times its knuckle, mm of tip gap a degree (soldierhold.json grip.proportion) */
const PROPORTION = G.proportion ?? 0.1;
/** the thumb's last joint against its middle (soldierhold.json grip.thumbFollow) */
const THUMB_FOLLOW = G.thumbFollow ?? 0.8;
/** a finger's curl off its neighbours' mean, mm of tip gap a degree (soldierhold.json grip.neighbour) */
const NEIGHBOUR = G.neighbour ?? 0.1;
/** how far a holding finger may be swung to one side of its own line, degrees, and what a degree of it costs, mm */
const SWING = G.swing ?? 15;
const SPREAD = G.spread ?? 0.05;
/**
 * The right hand's holding fingers wrap the grip: each degree of a finger's curl short of WRAP_MIN costs WRAP mm (a
 * finger held straight along the grip with its tip on it cost nothing, and the alternator's middle and ring were)
 */
const WRAP_MIN = G.wrapMin ?? 60;
const WRAP = G.wrap ?? 0.05;
/** a finger's middle joint past twice its knuckle and HOOK_BY degrees is hooked: what tools/checks/soldier-hold.ts refuses */
const HOOK_BY = G.hookBy ?? 45;
/** skin this far into what it holds is touching, not through (mm) */
const TOUCH = 2;
const FINGERS = ["index", "middle", "ring", "pinky"] as const;
const PISTOL = HOLD.guns[ID]?.stance === "pistol";
type Side = "l" | "r";
type Audit = {
  handWhere?: Record<string, number>;
  handOnHandWhere?: Record<string, number>;
  tipGap?: Record<string, number>;
  handGap?: Record<string, number>;
  fingerGap?: Record<string, number>;
  palmGap?: { l: number; r: number };
  thumbX: { l: number; r: number };
  trigger: number | null;
};
const ev = <T>(page: Page, expr: string) => page.evaluate(expr) as Promise<T>;
const r1 = (v: number) => Math.round(v * 10) / 10;

async function main(): Promise<void> {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 1800000, args: ["--mute-audio", "--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(NO_REAL_MOUSE);
    await page.evaluateOnNewDocument(() => localStorage.setItem("range.welcomed", "1"));
    await page.goto(`${URL}${URL.includes("?") ? "&" : "?"}nointro&norender`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction("Boolean(window.__range) && window.__range.loaded() && window.__range.soldierReady() && window.__range.paidGuns().ready", { polling: 250, timeout: 240000 });
    await page.addScriptTag({ path: path.resolve("tools/figure-audit.js") });
    await ev(page, `(() => { document.getElementById("overlay").classList.add("hidden"); window.__range.player.teleport(0, 0, 0, 0, -9); })()`);
    const all = await ev<Record<string, unknown>>(page, "window.__range.rifleConfig()");
    const own = ((all.guns as Record<string, Record<string, unknown>>)[ID] ?? {}) as {
      hands?: object;
      fingers?: Record<Side, Record<string, number[]>>;
      reload?: { keys?: Record<string, { fingers?: Record<string, number[]> }> };
    };
    const fingers: Record<Side, Record<string, number[]>> = JSON.parse(JSON.stringify({ ...(all.fingers as object), ...(own.fingers ?? {}) }));
    /** the gun's own hands, once one is moved (MOVE) */
    let hands: Record<Side, { at: number[] }> | null = null;
    // KEY=handle: a reload's key instead of the hold (soldierhold.json guns.<id>.reload.keys.<key>.fingers): the hand that
    // works it, at the moment of the empty reload it holds it (the first person's plan, rifle.ts reloadPlanOf), its
    // fingers closed the same way round what it takes hold of (Milestone 613: they were fitted a phalanx at a time, a
    // middle finger 88 degrees at the knuckle and straight after it at the USSO's charging handle)
    const KEY = process.env.KEY ?? "";
    let keySide: Side | null = null;
    let keyAt = 0;
    if (KEY) {
      const plan = await ev<{ left: [number, string][]; right: [number, string][] }>(page, `window.__range.rifleReloadPlan(${JSON.stringify(ID)}, false)`);
      for (const [seq, side] of [
        [plan.left, "l"],
        [plan.right, "r"],
      ] as const) {
        const i = seq.findIndex(([, k]) => k === KEY);
        if (i < 0 || keySide) continue;
        keySide = side;
        keyAt = seq[i + 1]?.[1] === KEY ? (seq[i][0] + seq[i + 1][0]) / 2 : seq[i][0];
      }
      if (!keySide) throw new Error(`${ID} has no reload key ${KEY}`);
      fingers[keySide] = { ...fingers[keySide], ...(own.reload?.keys?.[KEY]?.fingers ?? {}) };
    }
    const tune = () =>
      KEY && keySide
        ? `window.__range.rifleTune({ guns: { ${JSON.stringify(ID)}: { reload: { keys: { ${JSON.stringify(KEY)}: { fingers: ${JSON.stringify(fingers[keySide])} } } } } } })`
        : `window.__range.rifleTune({ guns: { ${JSON.stringify(ID)}: { fingers: ${JSON.stringify(fingers)}${hands ? `, hands: ${JSON.stringify(hands)}` : ""} } } })`;
    const reloadTime = KEY ? await ev<number>(page, `window.__range.weaponTimes(${JSON.stringify(ID)}).reloadEmpty`) : 0;
    const toKey = KEY ? `r.figureLabPose(0, ${JSON.stringify({ speed: 0, stance: "stand", pitch: 0, act: "reload", reloadEmpty: true, weapon: ID })}); r.figureLabStep(${keyAt * reloadTime});` : "";
    const pose = KEY ? { speed: 0, stance: "stand", pitch: 0 } : POSE;
    await ev(page, `(() => { const r = window.__range; ${tune()}; r.figureLabManual(false); r.figureLab([${JSON.stringify({ ...pose, weapon: ID, look: "S0000010" })}], 2.6, 30); r.figureLabManual(true); r.figureLabStep(0.8); ${toKey} })()`);
    if (KEY) console.log(`${ID} reload key ${KEY}: the ${keySide === "l" ? "left" : "right"} hand, ${(keyAt * reloadTime).toFixed(2)} s into the empty reload`);
    let n = 0;
    const measure = async (): Promise<Audit> => {
      n++;
      return ev<Audit>(
        page,
        `(() => { const r = window.__range; ${tune()}; r.figureLabStep(0.00001); const a = window.__figureAudit(0, { pitch: 0, handsOnly: true }); const mq = r.labFigures()[0].figure; const x = (s) => mq.gunObject.worldToLocal(mq.boneAt("thumb_03_" + s).getWorldPosition(new r.THREE.Vector3())).x * 100; a.thumbX = { l: x("l"), r: x("r") }; a.trigger = window.__triggerGap(0); return a; })()`,
      );
    };
    /** how deep a finger's skin is in what it holds, mm (a pistol's left: in the right hand too) */
    const deepOf = (a: Audit, f: string, side: Side) => Math.max(0, ...[1, 2, 3].map((j) => Math.max(a.handWhere?.[`${f}_0${j}_${side}`] ?? 0, side === "l" && PISTOL ? (a.handOnHandWhere?.[`${f}_0${j}_${side}`] ?? 0) : 0)));
    /** how far its tip is from what it holds, mm (a pistol's left: the gun or the right hand, the nearer) */
    const tipOf = (a: Audit, f: string, side: Side) => Math.min(a.tipGap?.[`${f}_${side}`] ?? 30, side === "l" && PISTOL ? (a.handGap?.[`${f}_l`] ?? 30) : 30);
    const report = async (label: string) => {
      const a = await measure();
      const line = (side: Side) =>
        [...FINGERS, "thumb"].map((f) => `${f}[${fingers[side][f].map((x) => Math.round(x)).join("/")}] tip ${tipOf(a, f, side)} in ${deepOf(a, f, side)}`).join("; ");
      console.log(`${ID} ${label}: trigger ${a.trigger === null ? "none" : `${a.trigger.toFixed(1)} mm`}, palms L${a.palmGap?.l} R${a.palmGap?.r} mm\n  R ${line("r")}\n  L ${line("l")}`);
    };
    await report("before");

    /** a finger's joints for knuckle a and middle joint b: the last follows the middle; its sideways swing is kept */
    const set = (side: Side, f: string, a: number, b: number, swing?: number) => {
      const J = fingers[side][f];
      const sw = swing !== undefined ? (swing ? [r1(swing)] : []) : J.length > 3 ? [J[3]] : [];
      fingers[side][f] = [r1(a), r1(b), r1(b * (f === "thumb" ? THUMB_FOLLOW : FOLLOW)), ...sw];
    };
    /**
     * The holding fingers closed as a hand closes them: every knuckle and middle joint on a grid, all the fingers at once
     * (each is measured on its own skin, and one finger's joints do not move another's), each finger keeping the pair
     * whose tip touches with no skin in, nearest the grasp's own proportion; then a finer grid round each one's best
     */
    const close = async (side: Side, list: readonly string[]) => {
      /** each finger's wanted curl (knuckle plus middle joint): its neighbours' mean, once the first pass has them */
      let want: Record<string, number> | null = null;
      /** each finger's own sideways swing as it was: a swing searched off it costs SPREAD a degree */
      const swing0 = Object.fromEntries(list.map((f) => [f, fingers[side][f][3] ?? 0]));
      const cost = (a: Audit, f: string, k: number, m: number, s: number) =>
        10 * Math.max(0, deepOf(a, f, side) - TOUCH) +
        tipOf(a, f, side) +
        PROPORTION * Math.abs(m - NATURAL * k) +
        (want ? NEIGHBOUR * Math.abs(k + m - want[f]) : 0) +
        SPREAD * Math.abs(s - swing0[f]) +
        (side === "r" ? WRAP * Math.max(0, WRAP_MIN - (k + m)) : 0) +
        // (never hooked: the alternator's charging handle had a little finger 95 degrees at its middle joint off a straight
        // knuckle, its tip on the gun, before this)
        10 * Math.max(0, m - (2 * Math.max(0, k) + HOOK_BY));
      type Try = [number, number, number];
      let best: Record<string, { c: number; a: number; b: number; s: number }> = {};
      const tryAt = async (tries: Record<string, Try>) => {
        for (const f of list) set(side, f, tries[f][0], tries[f][1], tries[f][2]);
        const a = await measure();
        for (const f of list) {
          const c = cost(a, f, ...tries[f]);
          if (c < best[f].c - 0.01) best[f] = { c, a: tries[f][0], b: tries[f][1], s: tries[f][2] };
        }
      };
      /** the grid at each of `swings` off each finger's own swing, then finer round each one's best */
      const search = async (swings: number[], seed?: Record<string, Try>) => {
        best = Object.fromEntries(list.map((f) => [f, { c: Infinity, a: 0, b: 0, s: swing0[f] }]));
        // (the first pass's own answers among the second's candidates: its grid alone could miss them)
        if (seed) await tryAt(seed);
        for (const ds of swings)
          for (let k = 0; k <= 90; k += 10) for (let m = 0; m <= 100; m += 10) await tryAt(Object.fromEntries(list.map((f) => [f, [k, m, swing0[f] + ds] as Try])));
        for (const step of [5, 2.5]) {
          const base = Object.fromEntries(list.map((f) => [f, { ...best[f] }]));
          for (const dk of [-step, 0, step])
            for (const dm of [-step, 0, step]) {
              if (!dk && !dm) continue;
              await tryAt(Object.fromEntries(list.map((f) => [f, [Math.max(-5, Math.min(95, base[f].a + dk)), Math.max(-5, Math.min(105, base[f].b + dm)), base[f].s] as Try])));
            }
        }
        console.log(`${side} ${list.join(", ")}${want ? " beside each other" : ""}: ${list.map((f) => `${f} ${best[f].a}/${best[f].b}/${best[f].s} (${best[f].c.toFixed(1)})`).join("; ")}`);
      };
      // (each finger free to swing a little to one side: the alternator's right ring finger went 8 to 11 mm into its grip
      // at any curl held in line, and touched nothing swung 10 degrees toward the little finger; held in line in this
      // pass, it was straight, and the middle finger beside it was asked to be straight too in the next)
      await search([0, -SWING, SWING]);
      // The second pass: each finger near the hand's own curl from the first, the middle one of its holding fingers' (the
      // index, on the trigger, is not one). Its neighbours' mean let one wrong finger pull the next after it: the
      // alternator's right ring finger, straight in the first pass, had the middle finger straightened beside it.
      const curl = Object.fromEntries(list.map((f) => [f, best[f].a + best[f].b]));
      const sorted = Object.values(curl).sort((x, y) => x - y);
      const middle = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
      const first = Object.fromEntries(list.map((f) => [f, [best[f].a, best[f].b, best[f].s] as Try]));
      want = Object.fromEntries(list.map((f) => [f, middle]));
      await search([0, -SWING, SWING], first);
      for (const f of list) set(side, f, best[f].a, best[f].b, best[f].s);
    };
    /** the thumb: its middle joint and its swing round its base, its last following, its tip on the gun's left */
    const thumb = async (side: Side) => {
      const J0 = fingers[side].thumb;
      let best = { c: Infinity, J: [...J0] };
      const cost = (a: Audit) => 10 * Math.max(0, deepOf(a, "thumb", side) - TOUCH) + tipOf(a, "thumb", side) + (KEY ? 0 : 5 * Math.max(0, a.thumbX[side] + 1)) + 0.02 * (fingers[side].thumb[0] + fingers[side].thumb[1]);
      const at = async (k: number, m: number, swing: number) => {
        fingers[side].thumb = [r1(k), r1(m), r1(m * THUMB_FOLLOW), swing];
        const c = cost(await measure());
        if (c < best.c - 0.01) best = { c, J: [...fingers[side].thumb] };
      };
      for (const swing of [-120, -90, -60, -30, 0, 30, 60, 90, 120]) for (const k of [0, 30, 60, 90]) for (const m of [0, 25, 50, 75]) await at(k, m, swing);
      for (const step of [15, 7.5]) {
        const b = [...best.J];
        for (const ds of [-step, 0, step]) for (const dk of [-step, 0, step]) for (const dm of [-step, 0, step]) if (ds || dk || dm) await at(Math.max(-10, Math.min(90, b[0] + dk)), Math.max(-10, Math.min(100, b[1] + dm)), b[3] + ds);
      }
      fingers[side].thumb = best.J;
      console.log(`${side} thumb: ${JSON.stringify(best.J)} (${best.c.toFixed(1)})`);
    };
    /** the right index on the trigger at its crease: knuckle, middle joint and swing searched, the last following */
    const trigger = async () => {
      if ((await measure()).trigger === null) return;
      let best = { c: Infinity, J: [...fingers.r.index], follow: FOLLOW };
      // (its last joint following the middle at FOLLOW, or as far as the middle: a finger pressing a trigger bends both
      // about alike, and through a narrow guard FOLLOW alone left the crease 15 mm off the VINSON's)
      const at = async (k: number, m: number, swing: number, follow: number) => {
        fingers.r.index = [r1(k), r1(m), r1(m * follow), swing];
        const a = await measure();
        const c = (a.trigger ?? 99) + 10 * Math.max(0, deepOf(a, "index", "r") - TOUCH);
        if (c < best.c - 0.01) best = { c, J: [...fingers.r.index], follow };
      };
      for (const follow of [FOLLOW, 1]) for (let k = 0; k <= 70; k += 10) for (let m = 0; m <= 100; m += 10) for (const s of [-30, -15, 0, 15, 30]) await at(k, m, s, follow);
      for (const step of [5, 2.5, 1]) {
        const b = [...best.J];
        for (const dk of [-step, 0, step]) for (const dm of [-step, 0, step]) for (const ds of [-step, 0, step]) if (dk || dm || ds) await at(b[0] + dk, b[1] + dm, b[3] + ds, best.follow);
      }
      fingers.r.index = best.J;
      console.log(`r index on the trigger: ${JSON.stringify(best.J)}, its crease ${best.c.toFixed(1)} mm off`);
    };

    /**
     * The hand moved to where its holding fingers can each close round what they hold: every place within 15 mm on a 5
     * mm grid, then 2.5 mm round the best, each tried with the fingers at a grasp's curls (knuckle 20, 35, 50 or 65, the
     * middle joint NATURAL of it); a place costs each finger's best of those (its skin in the gun past TOUCH and its tip
     * off it), the palm off its hold and a third of a mm for each mm it moved
     */
    const moveHand = async (side: Side) => {
      hands = JSON.parse(JSON.stringify(own.hands)) as Record<Side, { at: number[] }>;
      const at0 = [...hands[side].at];
      const list = side === "r" ? ["middle", "ring", "pinky"] : [...FINGERS];
      const keep = JSON.parse(JSON.stringify(fingers[side]));
      const costAt = async (d: number[]) => {
        hands![side].at = at0.map((v, i) => r1(v * 10000 + d[i] * 10) / 10000);
        const each: Record<string, number> = Object.fromEntries(list.map((f) => [f, Infinity]));
        let palm = 0;
        for (const k of [20, 35, 50, 65]) {
          for (const f of list) set(side, f, k, NATURAL * k);
          const a = await measure();
          for (const f of list) each[f] = Math.min(each[f], 10 * Math.max(0, deepOf(a, f, side) - TOUCH) + tipOf(a, f, side));
          palm = 20 * Math.max(0, (a.palmGap?.[side] ?? 30) - 1);
        }
        return Object.values(each).reduce((t, v) => t + v, 0) + palm + Math.hypot(...d) / 3;
      };
      let best = { c: await costAt([0, 0, 0]), d: [0, 0, 0] };
      const start = best.c;
      for (const step of [5, 2.5]) {
        const b = [...best.d];
        const span = step === 5 ? [-15, -10, -5, 0, 5, 10, 15] : [-step, 0, step];
        for (const dx of span)
          for (const dy of span)
            for (const dz of span) {
              const d = [b[0] + dx, b[1] + dy, b[2] + dz];
              if (Math.max(...d.map(Math.abs)) > 15 || (!dx && !dy && !dz)) continue;
              const c = await costAt(d);
              if (c < best.c - 0.01) best = { c, d };
            }
      }
      hands[side].at = at0.map((v, i) => r1(v * 10000 + best.d[i] * 10) / 10000);
      fingers[side] = keep;
      console.log(`${side} hand moved ${JSON.stringify(best.d)} mm to ${JSON.stringify(hands[side].at)}: its fingers closed alike cost ${start.toFixed(1)}, now ${best.c.toFixed(1)}`);
    };

    // HANDS='{"r":{"at":[...]}}': a hand's place from a MOVE before, kept, without searching it again
    if (process.env.HANDS) {
      const given = JSON.parse(process.env.HANDS) as Partial<Record<Side, { at: number[] }>>;
      hands = JSON.parse(JSON.stringify(own.hands)) as Record<Side, { at: number[] }>;
      for (const side of ["r", "l"] as const) if (given[side]) hands[side] = { ...hands[side], ...given[side] };
    }
    const sides = keySide ? [keySide] : ((process.env.SIDES ?? "r,l").split(",") as Side[]);
    for (const side of sides) {
      if ((process.env.MOVE ?? "").split(",").includes(side)) await moveHand(side);
      // (a key's hand takes hold with every finger: the right's index is off the trigger then)
      await close(side, side === "r" && !KEY ? ["middle", "ring", "pinky"] : FINGERS);
      await thumb(side);
      if (side === "r" && !KEY) await trigger();
    }
    await report(`after ${n} measures`);
    console.log(JSON.stringify(fingers));
    if (hands) console.log(`hands ${JSON.stringify(hands)}`);
    if (process.env.WRITE === "1") {
      const file = path.resolve("src/config/soldierhold.json");
      const j = JSON.parse(fs.readFileSync(file, "utf8"));
      if (KEY && keySide) j.guns[ID].reload.keys[KEY].fingers = fingers[keySide];
      else j.guns[ID] = { ...(j.guns[ID] ?? {}), fingers, ...(hands ? { hands } : {}) };
      fs.writeFileSync(file, `${JSON.stringify(j, null, 2)}\n`);
      console.log(`written to soldierhold.json guns.${ID}.${KEY ? `reload.keys.${KEY}.fingers` : "fingers"}`);
    }
  } finally {
    await browser.close();
  }
}

void main();
