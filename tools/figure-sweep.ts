// The soldier's hold swept through every motion a frame at a time (docs/PLAN_SOLDIER_EIGHT_GUNS.md, G1): each sequence on
// a lab figure stepped at 1/30 s and audited every frame (figure-audit.js), the worst of each measure kept with where and
// when it was. The frame sheets step 4% of a sequence, and a finger 16 mm through BOOG's fore-end lived at 7%; this
// looks at every frame, in minutes a gun, without pictures.
//
//   hand   the deepest skin of either hand inside the gun, mm (the audit stops at 30), and the bone it is on
//   gun    the deepest drawn point of the gun inside the body, mm, the gun's part and the bone: the audit's exact look
//          (15 cm in, each deepest point confirmed inside by rays; EXACT=0 for its plain 4 cm look, which reads a point
//          deeper than that as outside: ANAKIN's stock in the forearm read 40 where it is 67)
//   grip, sup   each palm off its hold, mm, while it is meant to be on it (not at a reload's key)
//   wrist  the more bent wrist, degrees
// A frame is bad past 6 mm (hand), 15 (gun), 3 (grip), 4 (sup) or 60 degrees.
//
// Run: SHOT_URL=http://localhost:5198/ npx tsx tools/figure-sweep.ts [gun id ...]   (default: the fitted guns, the keys
// of soldierhold.json guns; SEQ=reload,jump for some sequences only; DETAIL=1 prints each bad frame, its time, measures
// and the rig's keys). A fresh browser a gun: one page through many guns
// died after two ("Target closed"). ?norender, and never the real mouse or keyboard.
import path from "node:path";
import puppeteer from "puppeteer";
import soldierHold from "../src/config/soldierhold.json";

const URL = process.env.SHOT_URL ?? "http://localhost:5198/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const IDS = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(soldierHold.guns).filter((k) => !k.startsWith("_"));
const ONLY = (process.env.SEQ ?? "").split(",").filter(Boolean);
const DETAIL = !!process.env.DETAIL;
const EXACT = process.env.EXACT !== "0";
const DT = 1 / 30;
const BAR = { hand: 6, gun: 15, grip: 3, sup: 4, wrist: 60 };

type Pose = Record<string, unknown>;
type Times = { reload: number; reloadEmpty: number; holster: number; deploy: number };
const stand = { speed: 0, stance: "stand", pitch: 0 };
const SEQS: Array<{ name: string; settle: Pose; at: (t: number, T: Times) => Pose; end: (T: Times) => number }> = [
  { name: "idle", settle: stand, at: () => stand, end: () => 1.2 },
  { name: "aim", settle: { ...stand, ads: 1 }, at: () => ({ ...stand, ads: 1 }), end: () => 1 },
  // the look from 40 degrees down to 40 up, aimed
  { name: "look", settle: { ...stand, ads: 1, pitch: -40 }, at: (t) => ({ ...stand, ads: 1, pitch: -40 + t * 80 }), end: () => 1 },
  { name: "runaim", settle: { speed: 8.8, stance: "stand", pitch: 0, ads: 0.85 }, at: () => ({ speed: 8.8, stance: "stand", pitch: 0, ads: 0.85 }), end: () => 1.2 },
  { name: "sprint", settle: { speed: 14, stance: "stand", pitch: 0 }, at: () => ({ speed: 14, stance: "stand", pitch: 0 }), end: () => 1 },
  { name: "crouch", settle: { speed: 0, stance: "crouch", pitch: 0 }, at: () => ({ speed: 0, stance: "crouch", pitch: 0 }), end: () => 1 },
  // from empty, the longer of the two, and a little after it for the hands' way back
  { name: "reload", settle: stand, at: (t, T) => ({ ...stand, act: t < T.reloadEmpty ? "reload" : null, reloadEmpty: true }), end: (T) => T.reloadEmpty * 1.15 },
  // a jump out of a sprint, and the landing
  { name: "jump", settle: { speed: 14, stance: "stand", pitch: 0 }, at: (t) => (t < 0.2 ? { speed: 14, stance: "stand", pitch: 0 } : t < 0.9 ? { speed: 14, stance: "air", pitch: 0 } : stand), end: () => 1.4 },
  { name: "melee", settle: stand, at: (t) => ({ ...stand, act: t < soldierHold.melee.time ? "melee" : null }), end: () => 0.8 },
];

type Frame = { hand: number; handAt: string; gun: number; gunAt: string; grip: number; sup: number; wrist: number; keys: string };
const worstOf = (o: Record<string, number> | undefined): string => {
  const e = Object.entries(o ?? {}).sort((a, b) => b[1] - a[1])[0];
  return e ? `${e[0]} ${e[1]}` : "";
};

async function sweep(id: string): Promise<void> {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(NO_REAL_MOUSE);
    await page.evaluateOnNewDocument(() => localStorage.setItem("range.welcomed", "1"));
    await page.goto(`${URL}?game=speedkills&nointro&norender`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction("Boolean(window.__range) && window.__range.loaded() && window.__range.soldierReady()", { polling: 250, timeout: 90000 });
    await page.waitForFunction("window.__range.paidGuns().ready", { polling: 250, timeout: 60000 });
    await page.addScriptTag({ path: path.resolve("tools/figure-audit.js") });
    const T = (await page.evaluate(`window.__range.weaponTimes(${JSON.stringify(id)})`)) as Times;
    console.log(`== ${id}`);
    for (const s of SEQS) {
      if (ONLY.length && !ONLY.includes(s.name)) continue;
      await page.evaluate(`(() => { const r = window.__range; r.figureLabManual(false); r.figureLab([${JSON.stringify({ ...s.settle, weapon: id, look: "S0000010" })}], 2.6, 30); r.figureLabManual(true); r.figureLabStep(0.9); })()`);
      const w = { hand: [0, 0, ""] as [number, number, string], gun: [0, 0, ""] as [number, number, string], grip: [0, 0] as [number, number], sup: [0, 0] as [number, number], wrist: [0, 0] as [number, number], n: 0, bad: 0 };
      const end = s.end(T);
      for (let t = 0; t < end; t += DT) {
        const pose = s.at(t, T);
        const f = (await page.evaluate(`(() => {
          const r = window.__range;
          r.figureLabPose(0, ${JSON.stringify({ ...pose, weapon: id })});
          r.figureLabStep(${DT});
          const fig = r.labFigures()[0].figure;
          const a = window.__figureAudit(0, { pitch: ${(pose.pitch as number) ?? 0}, locate: ${DETAIL}, exact: ${EXACT} });
          if (!a) return null;
          return { hand: Math.max(a.handIn?.l ?? 0, a.handIn?.r ?? 0), handWhere: a.handWhere, whereAt: a.whereAt, gun: a.gunIn ?? 0, gunWhere: a.gunWhere, grip: a.grip ?? 0, sup: a.support ?? 0, wrist: Math.max(a.wristL, a.wristR), keys: fig.rifleOut?.keys ?? "" };
        })()`)) as (Omit<Frame, "handAt" | "gunAt"> & { handWhere?: Record<string, number>; gunWhere?: Record<string, number>; whereAt?: Record<string, unknown[]> }) | null;
        if (!f) continue;
        w.n++;
        // a palm away from its hold at a reload's key or a punch is where it is meant to be
        const away = /l:(?!hold)|r:(?!grip)/.test(f.keys);
        if (f.hand > w.hand[0]) w.hand = [f.hand, t, worstOf(f.handWhere)];
        if (f.gun > w.gun[0]) w.gun = [f.gun, t, worstOf(f.gunWhere)];
        if (!away && f.grip > w.grip[0]) w.grip = [f.grip, t];
        if (!away && f.sup > w.sup[0]) w.sup = [f.sup, t];
        if (f.wrist > w.wrist[0]) w.wrist = [f.wrist, t];
        if (f.hand > BAR.hand || f.gun > BAR.gun || (!away && (f.grip > BAR.grip || f.sup > BAR.sup)) || f.wrist > BAR.wrist) {
          w.bad++;
          // (where the deepest hand bone's skin is: cm in the gun's own frame, and the gun's part)
          const deep = worstOf(f.handWhere).split(" ")[0];
          if (DETAIL) console.log(`    ${t.toFixed(3)} s: hand ${f.hand} (${worstOf(f.handWhere)}${deep && f.whereAt?.[deep] ? ` at ${JSON.stringify(f.whereAt[deep])}` : ""}) gun ${f.gun} (${worstOf(f.gunWhere)}) grip ${f.grip.toFixed(1)} sup ${f.sup.toFixed(1)} wrist ${Math.round(f.wrist)} [${f.keys}]`);
        }
      }
      const at = (x: number) => `${x.toFixed(2)} s`;
      console.log(
        `  ${s.name}: ${w.bad}/${w.n} bad | hand ${w.hand[0]} at ${at(w.hand[1])} (${w.hand[2]}) | gun ${w.gun[0]} at ${at(w.gun[1])} (${w.gun[2]}) | grip ${w.grip[0].toFixed(1)} sup ${w.sup[0].toFixed(1)} | wrist ${Math.round(w.wrist[0])} at ${at(w.wrist[1])}`
      );
    }
  } finally {
    await browser.close();
  }
}

(async () => {
  for (const id of IDS) await sweep(id);
})();
