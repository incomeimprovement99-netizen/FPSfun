// Fitting the soldier's hands to a gun (Phase 27, 27.11), as tools/pack-fit.ts fits the first-person arms: rather
// than nudge every number and hope (tools/figure-solve.ts's coordinate descent stalled with BOOG's palms 2 cm inside
// its grip and fore-end), each hand is closed round its hold the way a hand grasps: the palm along the way it faces
// until it lies on the gun, then each finger a phalanx at a time, knuckle first, each turned until its own skin
// touches the gun (no more than 2 mm into it) or it is closed. A finger that is only kept out of the gun is not
// holding it: fitted by depth alone, the fingers of both guns' right hands came out straight, pointing past the grip.
//
// Where the hand sits on its hold decides whether its fingers can close round it at all (the USSO's knuckles were
// behind its grip's front, and every curled finger went through it), so the hand's place is searched too: moved
// along its own length and across its knuckles and tilted, each place given its own grasp and scored by what a
// grasp should be (no skin in the gun, the palm on it, the holding fingers touching it and closed round it, the wrist
// straight). The thumb is swung round its base as well as curled (a fourth number, soldierhold.json fingers).
//
// The right index finger goes on the trigger (the owner, 2026-09-30: the gun fires on a click, so a finger laid along
// the frame reads as not firing): once the right hand is placed, its three joints and its sideways swing are searched
// so its last phalanx's nearest skin is on the middle of the trigger's front face, no finger deeper in the gun than
// touching. The trigger is the bought model's own part (its mesh named Trigger).
//
// Measured in the aimed pose on one figure, settled once and re-posed for each try (rifle.ts keeps no state between
// frames, so a try's answer is the same as a fresh figure's), by tools/figure-audit.js.
//
// Run: SHOT_URL=http://localhost:5198/ npx tsx tools/figure-fit.ts <gun id>   (WRITE=1 stores it as guns.<id>)
//      SCALE=1.1 draws the gun that much bigger (soldierhold.json scale); HAND_R / HAND_L='{"at":..,"fwd":..,"palm":..}'
//      start a hand there; SIDES=r fits only that hand; SEARCH=0 grasps where the hand is, without moving it;
//      TRIGGER_ONLY=1 only puts the right index on the trigger, the hands as they are; TOGETHER=l closes that hand's four
//      fingers as one (a fist's curl, as far as the first of them touches), for a hold narrower than the fingers are long
//      (BOOG's rail: closed one by one, the middle finger stood straight up its side and the rest shut on the air). Each hand's numbers are printed
//      as it is done. Nothing the page loads may change while it runs (src/, the README the range's walls show): the
//      dev server reloads the page and the run dies
import fs from "node:fs";
import path from "node:path";
import puppeteer, { type Page } from "puppeteer";

const URL = process.env.SHOT_URL ?? "http://localhost:5198/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ID = process.argv[2] ?? "r97";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const POSE = { speed: 0, stance: "stand", pitch: 0, ads: 1 };
/** skin this far into the gun is touching, not through (mm) */
const TOUCH = 2;
/** how far each joint closes at most, knuckle out (degrees): a finger touching nothing makes a fist, not a knot */
const SHUT = [90, 100, 80];
const FINGERS = ["index", "middle", "ring", "pinky"] as const;
/** the fingers that close round each hold (the right index is at the trigger) */
const HOLDING = { r: ["middle", "ring", "pinky"], l: ["index", "middle", "ring", "pinky"] } as const;

type Side = "l" | "r";
type Audit = { handWhere?: Record<string, number>; fingerGap?: Record<string, number>; palmGap?: { l: number; r: number }; wristL: number; wristR: number; thumbX: { l: number; r: number }; trigger: number | null };
type Hand = { at: number[]; fwd: number[]; palm: number[] };
type Cfg = { hands: Record<Side, Hand>; fingers: Record<Side, Record<string, number[]>>; scale?: number };

const ev = <T>(page: Page, expr: string) => page.evaluate(expr) as Promise<T>;
const round = (v: number, k = 10000) => Math.round(v * k) / k;
const norm = (v: number[]) => {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
};
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** v turned by deg about the unit axis k (Rodrigues) */
function turn(v: number[], k: number[], deg: number): number[] {
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const kxv = cross(k, v);
  const kv = dot(k, v);
  return v.map((x, i) => x * c + kxv[i] * s + k[i] * kv * (1 - c));
}

async function main(): Promise<void> {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--mute-audio", "--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(NO_REAL_MOUSE);
    await page.evaluateOnNewDocument(() => localStorage.setItem("range.welcomed", "1"));
    page.on("pageerror", (e) => console.log("pageerror:", String(e)));
    await page.goto(`${URL}${URL.includes("?") ? "&" : "?"}game=speedkills&nointro&norender`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction("Boolean(window.__range) && window.__range.loaded() && window.__range.soldierReady()", { polling: 250, timeout: 90000 });
    await page.waitForFunction("window.__range.paidGuns().ready", { polling: 250, timeout: 60000 }).catch(() => console.log("the bought guns did not load"));
    await page.addScriptTag({ path: path.resolve("tools/figure-audit.js") });
    await ev(page, `(() => { document.getElementById("overlay").classList.add("hidden"); window.__range.player.teleport(0, 0, 0, 0, -9); })()`);
    // this gun's hands and fingers as they stand: its own over the shared
    const all = await ev<Record<string, unknown>>(page, "window.__range.rifleConfig()");
    const own = ((all.guns as Record<string, Partial<Cfg>>)[ID] ?? {}) as Partial<Cfg>;
    const cfg: Cfg = JSON.parse(JSON.stringify({ hands: { ...(all.hands as object), ...(own.hands ?? {}) }, fingers: { ...(all.fingers as object), ...(own.fingers ?? {}) } }));
    cfg.scale = process.env.SCALE ? Number(process.env.SCALE) : ((own.scale as number | undefined) ?? (all.scale as number));
    if (process.env.HAND_R) cfg.hands.r = JSON.parse(process.env.HAND_R) as Hand;
    if (process.env.HAND_L) cfg.hands.l = JSON.parse(process.env.HAND_L) as Hand;
    // (FINGERS=0.7 tries the fingers at another size than soldierhold.json fingerSize: the figure takes it as it is built)
    const size = process.env.FINGERS ? `fingerSize: ${Number(process.env.FINGERS)}, ` : "";
    const tune = () => `window.__range.rifleTune({ ${size}guns: { ${JSON.stringify(ID)}: ${JSON.stringify(cfg)} } })`;
    // the figure, settled into the aimed pose once (the gun's scale is taken when the figure takes the gun)
    await ev(page, `(() => { const r = window.__range; ${tune()}; r.figureLabManual(false); r.figureLab([${JSON.stringify({ ...POSE, weapon: ID, look: "S0000010" })}], 2.6, 30); r.figureLabManual(true); r.figureLabStep(0.8); })()`);
    // how far the right index's tip is from the trigger, each measure (figure-audit.js __triggerGap)
    console.log(`the trigger: ${(await ev<number | null>(page, "window.__triggerGap(0)")) === null ? "none on this gun" : "found"}`);
    let n = 0;
    const measure = async (): Promise<Audit> => {
      n++;
      // (and each thumb's last joint across the gun, cm, the gun's own frame: + its right, - its left)
      return ev<Audit>(
        page,
        `(() => { const r = window.__range; ${tune()}; r.figureLabStep(0.00001); const a = window.__figureAudit(0, { pitch: 0, handsOnly: true }); const mq = r.labFigures()[0].figure; const x = (s) => mq.gunObject.worldToLocal(mq.boneAt("thumb_03_" + s).getWorldPosition(new r.THREE.Vector3())).x * 100; a.thumbX = { l: x("l"), r: x("r") }; a.trigger = window.__triggerGap(0); return a; })()`,
      );
    };
    const report = (a: Audit, label: string) =>
      console.log(`${label}: palms off it L${a.palmGap?.l} R${a.palmGap?.r} mm, wrists ${Math.round(a.wristL)}/${Math.round(a.wristR)}, in the gun ${JSON.stringify(a.handWhere)}, fingers off it ${JSON.stringify(a.fingerGap)}`);
    report(await measure(), `${ID} before`);

    /** the palm along the way it faces until it lies on the gun: out of it, or in onto it (at most 3 cm in, 12 mm out) */
    const seatPalm = async (side: Side): Promise<void> => {
      const H = cfg.hands[side];
      const face = norm(H.palm);
      const start = [...H.at];
      let prev = [...H.at];
      let last = Infinity;
      for (let i = 0; i < 10; i++) {
        const a = await measure();
        const deep = Math.max(a.handWhere?.[`hand_${side}`] ?? 0, a.handWhere?.[`thumb_01_${side}`] ?? 0);
        const gap = a.palmGap?.[side] ?? 0;
        const step = deep > 1 ? -(deep + 0.5) : gap > 1 ? gap - 0.5 : 0;
        if (!step) return;
        if (deep + gap >= last - 0.5) {
          H.at = prev;
          return;
        }
        last = deep + gap;
        const next = H.at.map((v, k) => round(v + (face[k] * step) / 1000));
        if (Math.hypot(...next.map((v, k) => v - start[k])) > (step < 0 ? 0.012 : 0.03)) return;
        prev = [...H.at];
        H.at = next;
      }
    };
    /**
     * One finger closed a phalanx at a time, each until its own skin touches the gun or it is shut. A phalanx in the gun
     * even held straight has the joint before it opened back until it is out: that joint had closed its own phalanx
     * onto nothing and pointed the next one into the gun.
     */
    const wrap = async (side: Side, f: string): Promise<void> => {
      const J = cfg.fingers[side][f];
      /** joint j's greatest bend from -10 to `top` with phalanx `seg` touching and no deeper; false if it is in at -10 */
      const close = async (j: number, seg: string, top: number): Promise<boolean> => {
        const depthAt = async (v: number) => {
          J[j] = v;
          return (await measure()).handWhere?.[seg] ?? 0;
        };
        if ((await depthAt(top)) <= TOUCH) return true;
        if ((await depthAt(-10)) > TOUCH) return false;
        let lo = -10;
        let hi = top;
        for (let s = 0; s < 7; s++) {
          const mid = (lo + hi) / 2;
          if ((await depthAt(mid)) <= TOUCH) lo = mid;
          else hi = mid;
        }
        J[j] = Math.round(lo * 10) / 10;
        return true;
      };
      for (let j = 0; j < 3; j++) {
        for (let k = j; k < 3; k++) J[k] = 0;
        const seg = `${f}_0${j + 1}_${side}`;
        if ((await close(j, seg, SHUT[j])) || j === 0) continue;
        J[j] = 0;
        await close(j - 1, seg, J[j - 1]);
        await close(j, seg, SHUT[j]);
      }
    };
    /**
     * What the thumb adds to a grasp: its skin in the gun, how far it is off it, and how far short of the gun's left
     * its last joint is: a grip's thumb goes round the far side of its hold (both hands' thumbs are on the gun's left).
     * Asked only to touch the gun and stay out of it, the USSO's stood straight up beside the receiver.
     */
    const thumbCost = (a: Audit, side: Side) => {
      const deep = Object.entries(a.handWhere ?? {}).filter(([b]) => b.startsWith("thumb") && b.endsWith(`_${side}`));
      return 10 * Math.max(0, Math.max(0, ...deep.map(([, d]) => d)) - 3) + deep.reduce((t, [, d]) => t + d, 0) + 2 * Math.max(0, (a.fingerGap?.[`thumb_${side}`] ?? 30) - TOUCH) + 5 * Math.max(0, a.thumbX[side] + 1);
    };
    /** how good a grasp is: lower is better (mm and degrees, weighed as the header says) */
    const score = (a: Audit, side: Side): { cost: number; why: string } => {
      const inGun = Object.entries(a.handWhere ?? {}).filter(([b]) => b.endsWith(`_${side}`) && !b.startsWith("thumb"));
      const deepest = Math.max(0, ...inGun.map(([, d]) => d));
      const sum = inGun.reduce((t, [, d]) => t + d, 0);
      const palm = a.palmGap?.[side] ?? 30;
      const off = HOLDING[side].reduce((t, f) => t + Math.max(0, (a.fingerGap?.[`${f}_${side}`] ?? 30) - TOUCH), 0);
      // (closed round a pistol grip, a hand's fingers are curled; along the side of a fore-end or a magazine, a slab
      // taller than they are long, they lie nearly straight, and asked to curl there they closed on the air)
      const open = side === "l" ? 0 : HOLDING[side].reduce((t, f) => t + Math.max(0, 180 - cfg.fingers[side][f].slice(0, 3).reduce((x, y) => x + y, 0)), 0);
      const wrist = Math.max(0, (side === "r" ? a.wristR : a.wristL) - 35);
      const th = thumbCost(a, side);
      return {
        cost: 10 * Math.max(0, deepest - 3) + sum + 3 * palm + 2 * off + 0.1 * open + 2 * wrist + th,
        why: `deepest ${deepest} mm, palm off ${palm} mm, fingers off ${off} mm, ${Math.round(open)} deg short of closed, wrist ${Math.round(side === "r" ? a.wristR : a.wristL)}, thumb ${th.toFixed(1)} (its last joint ${a.thumbX[side].toFixed(1)} cm across)`,
      };
    };
    /** the four fingers closed as one along a fist's curl (SHUT times k), as far as none is deeper than touching */
    const together = (process.env.TOGETHER ?? "").split(",");
    const wrapTogether = async (side: Side): Promise<void> => {
      const set = (k: number) => {
        for (const f of FINGERS) cfg.fingers[side][f].splice(0, 3, ...SHUT.map((x) => round(x * k, 10)));
      };
      const deep = async (k: number) => {
        set(k);
        const a = await measure();
        return Math.max(0, ...FINGERS.flatMap((f) => [1, 2, 3].map((j) => a.handWhere?.[`${f}_0${j}_${side}`] ?? 0)));
      };
      let lo = 0;
      let hi = 1;
      if ((await deep(1)) <= TOUCH) return;
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2;
        if ((await deep(mid)) <= TOUCH) lo = mid;
        else hi = mid;
      }
      set(lo);
    };
    const grasp = async (side: Side): Promise<{ cost: number; why: string }> => {
      await seatPalm(side);
      if (together.includes(side)) {
        await wrapTogether(side);
        await wrap(side, "thumb");
      } else for (const f of [...FINGERS, "thumb"]) await wrap(side, f);
      return score(await measure(), side);
    };
    /** the thumb swung round its base (the fingers as they are) to where, curled, it costs least */
    const thumb = async (side: Side): Promise<void> => {
      const J = cfg.fingers[side].thumb;
      let best = { cost: Infinity, J: [...J], x: 0 };
      const tryAt = async (swing: number) => {
        J.length = 4;
        J[3] = swing;
        await wrap(side, "thumb");
        const a = await measure();
        const cost = thumbCost(a, side);
        if (cost < best.cost) best = { cost, J: [...J], x: a.thumbX[side] };
      };
      for (let s = -120; s <= 120; s += 15) await tryAt(s);
      const mid = best.J[3];
      for (const s of [mid - 7.5, mid + 7.5]) await tryAt(s);
      cfg.fingers[side].thumb = best.J;
      console.log(`${side} thumb swung ${best.J[3]} deg, curled ${best.J.slice(0, 3).join("/")}, its last joint ${best.x.toFixed(1)} cm across the gun (cost ${best.cost.toFixed(1)})`);
    };

    /**
     * The right index onto the trigger: its three joints and its sideways swing, a coarse look over how a trigger finger
     * bends and then a finer one round the best, scored by its tip's distance from the trigger's face, mm, and ten times
     * any of the finger deeper in the gun than touching
     */
    const trigger = async (): Promise<void> => {
      const J = cfg.fingers.r.index;
      const cost = async (): Promise<number> => {
        const a = await measure();
        if (a.trigger === null) return Infinity;
        const deep = Math.max(0, ...[1, 2, 3].map((j) => a.handWhere?.[`index_0${j}_r`] ?? 0));
        return a.trigger + 10 * Math.max(0, deep - TOUCH);
      };
      let best = { c: Infinity, J: [...J] };
      const tryJ = async (v: number[]) => {
        J.splice(0, J.length, ...v);
        const c = await cost();
        if (c < best.c - 0.05) best = { c, J: [...v] };
      };
      for (let j1 = 0; j1 <= 80; j1 += 10) for (let j2 = 0; j2 <= 90; j2 += 10) for (const j3 of [0, 20, 40]) for (const sw of [-15, 0, 15]) await tryJ([j1, j2, j3, sw]);
      // (down to half a degree: PANDA's crease stopped 4.1 mm off at 1, against the check's 4)
      for (const step of [5, 2.5, 1, 0.5]) {
        let moved = true;
        while (moved) {
          moved = false;
          const from = best.c;
          for (let k = 0; k < 4; k++) for (const d of [-step, step]) await tryJ(best.J.map((x, i) => (i === k ? round(x + d, 10) : x)));
          moved = best.c < from - 0.05;
        }
      }
      cfg.fingers.r.index = best.J;
      console.log(`r index on the trigger: its crease ${best.c.toFixed(1)} mm from the trigger's face, joints ${JSON.stringify(best.J)}`);
    };

    const sides = (process.env.SIDES ?? "r,l").split(",") as Side[];
    if (process.env.TRIGGER_ONLY === "1") sides.length = 0;
    for (const side of sides) {
      // the thumb's swing first, where the hand is, so every grasp tried has a thumb that can go round the hold
      await thumb(side);
      const H0 = JSON.parse(JSON.stringify(cfg.hands[side])) as Hand;
      const F0 = JSON.parse(JSON.stringify(cfg.fingers[side])) as Record<string, number[]>;
      let best = { cost: Infinity, why: "", hand: H0, fingers: F0 };
      const tryPlace = async (along: number, across: number, tilt: number, from: Hand) => {
        const fwd = norm(from.fwd);
        const face = norm(from.palm);
        const side3 = norm(cross(fwd, face));
        cfg.hands[side] = {
          at: from.at.map((v, k) => round(v + (fwd[k] * along + side3[k] * across) / 100)),
          fwd: turn(fwd, face, tilt).map((v) => round(v, 1000)),
          palm: from.palm,
        };
        cfg.fingers[side] = JSON.parse(JSON.stringify(F0));
        const g = await grasp(side);
        if (g.cost < best.cost) best = { cost: g.cost, why: g.why, hand: JSON.parse(JSON.stringify(cfg.hands[side])), fingers: JSON.parse(JSON.stringify(cfg.fingers[side])) };
        return g;
      };
      if (process.env.SEARCH === "0") await tryPlace(0, 0, 0, H0);
      else {
        // along the hand's length (its knuckles forward of the hold or back), across its knuckles, and tilted in the
        // palm's plane: a coarse look round the start, then a finer one round the best
        for (const along of [-5, -4, -3, -2, -1, 0, 1]) for (const across of [-1, 0, 1]) for (const tilt of [-24, -12, 0, 12, 24]) await tryPlace(along, across, tilt, H0);
        console.log(`${side} coarse best: ${best.cost.toFixed(1)} (${best.why})`);
        const H1 = best.hand;
        for (const along of [-0.5, 0, 0.5]) for (const across of [-0.5, 0, 0.5]) for (const tilt of [-6, 0, 6]) if (along || across || tilt) await tryPlace(along, across, tilt, H1);
      }
      cfg.hands[side] = best.hand;
      cfg.fingers[side] = best.fingers;
      console.log(`${side} hand: ${best.cost.toFixed(1)} (${best.why}) after ${n} measures`);
      // the thumb's swing again where the hand now is, and the grasp once more with it (it moves the palm's seat)
      await thumb(side);
      const last = await grasp(side);
      console.log(`${side} final: ${last.cost.toFixed(1)} (${last.why})`);
      // each hand as soon as it is done: a run that dies later (a page reloaded by an edit, the machine) keeps it
      console.log(`${side} fitted: ${JSON.stringify({ hand: cfg.hands[side], fingers: cfg.fingers[side] })}`);
    }
    if (sides.includes("r") || process.env.TRIGGER_ONLY === "1") await trigger();
    report(await measure(), `${ID} after ${n} measures`);
    console.log(JSON.stringify(cfg));
    if (process.env.WRITE === "1") {
      const file = path.resolve("src/config/soldierhold.json");
      const j = JSON.parse(fs.readFileSync(file, "utf8"));
      j.guns[ID] = { ...(j.guns[ID] ?? {}), hands: cfg.hands, fingers: cfg.fingers, ...(cfg.scale !== undefined && cfg.scale !== 1 ? { scale: cfg.scale } : {}) };
      fs.writeFileSync(file, `${JSON.stringify(j, null, 2)}\n`);
      console.log(`written to soldierhold.json guns.${ID}`);
    }
  } finally {
    await browser.close();
  }
}

void main();
