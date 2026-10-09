// Searching the soldier's rifle hold (Phase 27, 27.8; src/game/rifle.ts, src/config/soldierhold.json), as
// tools/pack-solve.ts searches the first-person arms: one lab soldier holding the gun in four poses (at rest, aimed
// in, looking 35 degrees up and 35 down), measured each try by tools/figure-audit.js, the numbers moved one at a time
// by coordinate descent, each step halved once no move of any number helps.
//
// What a try costs: the gun into the body, mm, and a hand into the gun, mm, both as the frame sheets flag them; a
// wrist bent past 45 degrees; a palm off its hold; an arm that falls short of its hold (heavily: a hand at nothing is
// the floating hand).
//
// Stages: pocket (where the butt sits, and the chest's turn), hands (each palm's place and turn on its hold, and the
// elbows), rest, lowered, and reload: one of the reload's hand places (KEY=point, handle, handleBack, bolt, boltUp,
// boltBack), measured at the moments of the empty reload the hand is at it (its plan is the first person's, rifle.ts
// reloadPlanOf, read off the page), or KEY=tilt, how far the gun is turned toward the left hand.
// Run: SHOT_URL=http://localhost:5198/ npx tsx tools/figure-solve.ts <gun id> <stage>
// ONLY=down,roll moves only the stage's numbers whose path names one of those (a hand fitted by tools/figure-fit.ts kept)
// KEYFINGERS=1 (the reload stage) searches the key's own fingers too, each of which should lie on the gun
// START='{...}' starts the search from those numbers over the gun's own (a restart out of a local minimum)
// WRITE=1 writes what it found into soldierhold.json as that gun's own numbers (guns.<id>).
import fs from "node:fs";
import path from "node:path";
import puppeteer, { type Page } from "puppeteer";

const URL = process.env.SHOT_URL ?? "http://localhost:5198/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ID = process.argv[2] ?? "r97";
const STAGE = process.argv[3] ?? "pocket";
const MAX = Number(process.env.EVALS ?? 160);
// the gun in the body by the audit's exact look (15 cm in, confirmed by rays): its plain 4 cm look reads a gun deeper in
// than that as outside, and a search on it walked ANAKIN's sprint jump 150 mm into the belly unseen (EXACT=0 for the plain)
const EXACT = process.env.EXACT !== "0";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const ev = <T>(page: Page, expr: string) => page.evaluate(expr) as Promise<T>;

/** a number the search moves: where it lives in the config, its range, its first step and its smallest */
type Param = { path: (string | number)[]; lo: number; hi: number; step: number; min: number };
const STAGES: Record<string, Param[]> = {
  pocket: [
    { path: ["pocket", "ahead"], lo: 0.04, hi: 0.26, step: 0.02, min: 0.004 },
    { path: ["pocket", "in"], lo: -0.06, hi: 0.1, step: 0.02, min: 0.004 },
    { path: ["pocket", "down"], lo: -0.04, hi: 0.12, step: 0.02, min: 0.004 },
    { path: ["blade"], lo: 0, hi: 50, step: 6, min: 1 },
  ],
  hands: [
    ...[0, 1, 2].map((i) => ({ path: ["hands", "r", "at", i], lo: -0.06, hi: 0.06, step: 0.008, min: 0.001 })),
    ...[0, 1, 2].map((i) => ({ path: ["hands", "r", "fwd", i], lo: -1.5, hi: 1.5, step: 0.2, min: 0.02 })),
    ...[0, 1, 2].map((i) => ({ path: ["hands", "r", "palm", i], lo: -1.5, hi: 1.5, step: 0.2, min: 0.02 })),
    ...[0, 1, 2].map((i) => ({ path: ["hands", "l", "at", i], lo: -0.06, hi: 0.06, step: 0.008, min: 0.001 })),
    ...[0, 1, 2].map((i) => ({ path: ["hands", "l", "fwd", i], lo: -1.5, hi: 1.5, step: 0.2, min: 0.02 })),
    ...[0, 1, 2].map((i) => ({ path: ["hands", "l", "palm", i], lo: -1.5, hi: 1.5, step: 0.2, min: 0.02 })),
    ...[0, 1, 2].map((i) => ({ path: ["elbows", "r", i], lo: -1.5, hi: 1.5, step: 0.25, min: 0.03 })),
    ...[0, 1, 2].map((i) => ({ path: ["elbows", "l", i], lo: -1.5, hi: 1.5, step: 0.25, min: 0.03 })),
  ],
  right: [
    ...[0, 1, 2].map((i) => ({ path: ["hands", "r", "at", i], lo: -0.08, hi: 0.08, step: 0.006, min: 0.001 })),
    ...[0, 1, 2].map((i) => ({ path: ["hands", "r", "fwd", i], lo: -1.5, hi: 1.5, step: 0.12, min: 0.02 })),
    ...[0, 1, 2].map((i) => ({ path: ["hands", "r", "palm", i], lo: -1.5, hi: 1.5, step: 0.12, min: 0.02 })),
    ...[0, 1, 2].map((i) => ({ path: ["elbows", "r", i], lo: -1.5, hi: 1.5, step: 0.15, min: 0.03 })),
  ],
  left: [
    ...[0, 1, 2].map((i) => ({ path: ["hands", "l", "at", i], lo: -0.08, hi: 0.08, step: 0.006, min: 0.001 })),
    ...[0, 1, 2].map((i) => ({ path: ["hands", "l", "fwd", i], lo: -1.5, hi: 1.5, step: 0.12, min: 0.02 })),
    ...[0, 1, 2].map((i) => ({ path: ["hands", "l", "palm", i], lo: -1.5, hi: 1.5, step: 0.12, min: 0.02 })),
    ...[0, 1, 2].map((i) => ({ path: ["elbows", "l", i], lo: -1.5, hi: 1.5, step: 0.15, min: 0.03 })),
  ],
  lowered: [
    ...["down", "left", "roll"].map((k) => ({ path: ["lowered", k], lo: -60, hi: 70, step: 6, min: 1 })),
    ...[0, 1, 2].map((i) => ({ path: ["lowered", "out", i], lo: -0.1, hi: 0.2, step: 0.02, min: 0.003 })),
    ...[0, 1, 2].map((i) => ({ path: ["lowered", "l", "at", i], lo: -0.1, hi: 0.1, step: 0.01, min: 0.002 })),
    ...[0, 1, 2].map((i) => ({ path: ["lowered", "l", "fwd", i], lo: -1.5, hi: 1.5, step: 0.15, min: 0.02 })),
    ...[0, 1, 2].map((i) => ({ path: ["lowered", "l", "palm", i], lo: -1.5, hi: 1.5, step: 0.15, min: 0.02 })),
  ],
  // a sprint jump's own lowered carry (soldierhold.json air), measured in the air out of a sprint
  air: [
    ...["down", "left", "roll"].map((k) => ({ path: ["air", k], lo: -60, hi: 70, step: 6, min: 1 })),
    ...[0, 1, 2].map((i) => ({ path: ["air", "out", i], lo: -0.1, hi: 0.3, step: 0.02, min: 0.003 })),
  ],
  // the arc the gun swings out on between the lowered carry and the hold, measured on its way up and down (below)
  rise: [0, 1, 2].map((i) => ({ path: ["lowered", "arc", i], lo: -0.1, hi: 0.25, step: 0.02, min: 0.003 })),
  // the swap's own lowered carry (soldierhold.json swap), measured standing in a swap
  // an overheated gun's vent (soldierhold.json vent): its own carry, measured standing as it vents
  vent: [
    ...["down", "left", "roll"].map((k) => ({ path: ["vent", k], lo: -70, hi: 70, step: 6, min: 1 })),
    ...[0, 1, 2].map((i) => ({ path: ["vent", "out", i], lo: -0.1, hi: 0.25, step: 0.02, min: 0.003 })),
  ],
  swap: [
    ...["down", "left", "roll"].map((k) => ({ path: ["swap", k], lo: -60, hi: 70, step: 6, min: 1 })),
    ...[0, 1, 2].map((i) => ({ path: ["swap", "out", i], lo: -0.1, hi: 0.25, step: 0.02, min: 0.003 })),
  ],
  rest: [
    { path: ["pocket", "ahead"], lo: 0.04, hi: 0.3, step: 0.015, min: 0.003 },
    { path: ["pocket", "in"], lo: -0.08, hi: 0.1, step: 0.015, min: 0.003 },
    { path: ["pocket", "down"], lo: -0.04, hi: 0.16, step: 0.015, min: 0.003 },
    // the hands are the gun's (tools/figure-fit.ts puts them on it): at rest the body moves round them, not they on it
    { path: ["blade"], lo: 10, hi: 55, step: 4, min: 0.5 },
    ...[0, 1, 2].map((i) => ({ path: ["elbows", "r", i], lo: -1.5, hi: 1.5, step: 0.15, min: 0.03 })),
    ...[0, 1, 2].map((i) => ({ path: ["elbows", "l", i], lo: -1.5, hi: 1.5, step: 0.15, min: 0.03 })),
    { path: ["aim", "relief"], lo: 0.03, hi: 0.16, step: 0.015, min: 0.003 },
    { path: ["aim", "cheek"], lo: -0.03, hi: 0.06, step: 0.01, min: 0.002 },
    { path: ["aim", "side"], lo: 0, hi: 0.1, step: 0.01, min: 0.002 },
    { path: ["pocket", "adsHead", "down"], lo: 0, hi: 25, step: 3, min: 0.5 },
    { path: ["pocket", "adsHead", "toward"], lo: 0, hi: 25, step: 3, min: 0.5 },
  ],
  // each hand's place and turn on its hold and every finger joint, together: the hand's shape round its own grip
  grip: [
    ...["r", "l"].flatMap((side) => [
      ...[0, 1, 2].map((i) => ({ path: ["hands", side, "at", i], lo: -0.12, hi: 0.16, step: 0.005, min: 0.001 })),
      ...[0, 1, 2].map((i) => ({ path: ["hands", side, "fwd", i], lo: -1.6, hi: 1.6, step: 0.1, min: 0.02 })),
      ...[0, 1, 2].map((i) => ({ path: ["hands", side, "palm", i], lo: -1.6, hi: 1.6, step: 0.1, min: 0.02 })),
    ]),
    ...["r", "l"].flatMap((side) => ["index", "middle", "ring", "pinky", "thumb"].flatMap((f) => [0, 1, 2].map((j) => ({ path: ["fingers", side, f, j], lo: -10, hi: 100, step: 8, min: 1 })))),
  ],
  fingers: ["r", "l"].flatMap((side) => ["index", "middle", "ring", "pinky", "thumb"].flatMap((f) => [0, 1, 2].map((j) => ({ path: ["fingers", side, f, j], lo: -10, hi: 100, step: 12, min: 1.5 })))),
};
/** the reload stage's key: its palm's place and turn, or the gun's tilt toward the left hand */
const KEY = process.env.KEY ?? "mag";
STAGES.reload =
  KEY === "tilt"
    ? [
        { path: ["reload", "tilt", "roll"], lo: 0, hi: 45, step: 4, min: 0.5 },
        { path: ["reload", "tilt", "down"], lo: -15, hi: 30, step: 3, min: 0.5 },
      ]
    : [
        ...[0, 1, 2].map((i) => ({ path: ["reload", "keys", KEY, "at", i], lo: -0.3, hi: 0.3, step: 0.01, min: 0.002 })),
        ...[0, 1, 2].map((i) => ({ path: ["reload", "keys", KEY, "fwd", i], lo: -1.5, hi: 1.5, step: 0.15, min: 0.02 })),
        ...[0, 1, 2].map((i) => ({ path: ["reload", "keys", KEY, "palm", i], lo: -1.5, hi: 1.5, step: 0.15, min: 0.02 })),
        // KEYFINGERS=1: the key's own fingers too (rifle.ts: a key's fingers in place of the hold's), from the hold's
        ...(process.env.KEYFINGERS === "1" ? ["index", "middle", "ring", "pinky", "thumb"].flatMap((f) => [0, 1, 2].map((j) => ({ path: ["reload", "keys", KEY, "fingers", f, j], lo: -10, hi: 100, step: 8, min: 1 }))) : []),
      ];
type Pose = { speed: number; stance: string; pitch: number; ads?: number; act?: string; reloadAt?: number; then?: { pose: Omit<Pose, "then">; dt: number } };
/** the poses a try is measured in: the hold's four, or for the lowered carry a sprint and a swap (settled into) */
let POSES: Pose[] =
  // a hand's place on the gun is the gun's, whatever the pose: one pose measures it
  STAGE === "grip"
    ? [{ speed: 0, stance: "stand", pitch: 0, ads: 1 }]
    : STAGE === "rest"
    ? [
        { speed: 0, stance: "stand", pitch: 0 },
        { speed: 0, stance: "stand", pitch: 0, ads: 1 },
        { speed: 0, stance: "crouch", pitch: 0 },
        { speed: 7, stance: "air", pitch: 0 },
      ]
    : STAGE === "swap"
    ? [{ speed: 0, stance: "stand", pitch: 0, act: "swap" }]
    : STAGE === "vent"
    ? [{ speed: 0, stance: "stand", pitch: 0, act: "vent" }]
    : STAGE === "air"
    ? // both jumps' clips (the athletic one above 7.2 m/s: a sprint's jump is), a moment after the feet leave the ground,
      // settled in the air, and landing (the carry kept low through the landing)
      [
        { speed: 14, stance: "air", pitch: 0 },
        { speed: 7, stance: "air", pitch: 0 },
        { speed: 14, stance: "stand", pitch: 0, then: { pose: { speed: 14, stance: "air", pitch: 0 }, dt: 0.1 } },
        // (and as the body tucks, 0.15 s up: the USSO's magazine went 39 mm into the belly there, between two measured)
        { speed: 14, stance: "stand", pitch: 0, then: { pose: { speed: 14, stance: "air", pitch: 0 }, dt: 0.15 } },
        { speed: 14, stance: "air", pitch: 0, then: { pose: { speed: 0, stance: "stand", pitch: 0 }, dt: 0.12 } },
      ]
    : STAGE === "rise"
    ? // a sprint stopping (the gun coming up) and a stand breaking into a sprint (going down), part way through each
      [0.06, 0.12, 0.2, 0.3].flatMap((dt) => [
        { speed: 14, stance: "stand", pitch: 0, then: { pose: { speed: 0, stance: "stand", pitch: 0 }, dt } },
        { speed: 0, stance: "stand", pitch: 0, then: { pose: { speed: 14, stance: "stand", pitch: 0 }, dt } },
      ])
    : STAGE === "lowered"
    ? // the sprint and the run, which carry the gun low (the swap and a sprint jump have their own, stages swap and
      // air), at moments through their strides: measured at one, BOOG's carry was clean there and 17 mm into the chest
      // a few tenths of a second later (the frames, 2026-10-01)
      [
        ...[0, 0.15, 0.3, 0.45].map((dt) => ({ speed: 14, stance: "stand", pitch: 0, then: { pose: { speed: 14, stance: "stand", pitch: 0 }, dt } })),
        ...[0, 0.25].map((dt) => ({ speed: 7, stance: "stand", pitch: 0, then: { pose: { speed: 7, stance: "stand", pitch: 0 }, dt } })),
      ]
    : [
        { speed: 0, stance: "stand", pitch: 0 },
        { speed: 0, stance: "stand", pitch: 0, ads: 1 },
        { speed: 0, stance: "stand", pitch: 35, ads: 1 },
        { speed: 0, stance: "stand", pitch: -35, ads: 1 },
      ];

type Audit = { grip?: number; support?: number; wristL: number; wristR: number; handIn?: { l: number; r: number }; gunIn?: number; fingerGap?: Record<string, number>; handWhere?: Record<string, number>; gunWhere?: Record<string, number> };
/** the fingers that hold the gun, each of which should touch it: a hand held open beside it is not holding it */
let HOLDING = ["middle_r", "ring_r", "pinky_r", "thumb_r", "index_l", "middle_l", "ring_l", "pinky_l"].filter(
  // (in a reload the left hand holds the gun only at its magazine, at the pouch or the handle its fingers are its own;
  // and the right hand working a bolt is off its grip)
  (f) => STAGE !== "reload" || (f.endsWith("_l") ? false : !KEY.startsWith("bolt")),
);
type Out = { shortL: number; shortR: number; slide?: number; pinch?: number } | null;
/** a shell gun's feed key (rifle.ts keyTarget, `from` "round"): the hand holds a shell in its pinch, not the gun */
let SHELL_KEY = false;

/**
 * A try's cost. Skin in the gun weighs three times a finger's gap, and each bone's depth adds to it, not only the
 * deepest: weighed alike, a palm 1 mm out of the grip cost more in the eight fingers' gaps than it saved, and the search
 * kept the hand inside the gun. A finger costs only past 6 mm off the gun (a hand does not touch it with every joint).
 */
function cost(a: Audit | null, o: Out, reload = false): number {
  if (!a) return 1e6;
  const sum = (m?: Record<string, number>) => Object.values(m ?? {}).reduce((s, v) => s + v, 0);
  return (
    (a.gunIn ?? 0) +
    0.3 * sum(a.gunWhere) +
    3 * Math.max(a.handIn?.l ?? 0, a.handIn?.r ?? 0) +
    0.5 * sum(a.handWhere) +
    3 * Math.max(0, a.wristR - 45) +
    3 * Math.max(0, a.wristL - 45) +
    // (in a reload a hand is away from its hold on purpose: whether its arm reaches is `short`'s to say)
    (reload ? 0 : 20 * Math.max(0, (a.grip ?? 0) - 1.5) + 20 * Math.max(0, (a.support ?? 0) - 2)) +
    3000 * ((o?.shortL ?? 0) + (o?.shortR ?? 0)) +
    // the left hold slid back along the gun because the arm fell short (mannequin.ts supportHold): its straight way back
    // to the grip can run through a magazine (PANDA's sprint carry, its left hand 30 mm in), and a carry that needs it is
    // one the arm cannot hold; a reload's hand is away from the hold, so it does not count there
    (reload ? 0 : 300 * (o?.slide ?? 0)) +
    // a shell key's pinch (the index's and the thumb's last joints between them) off where the shell is held, past 3 mm
    (SHELL_KEY ? 3 * Math.max(0, (o?.pinch ?? 50) - 3) : 0) +
    (STAGE === "pocket" ? 0 : HOLDING.reduce((s, f) => s + Math.max(0, (a.fingerGap?.[f] ?? 30) - 6), 0))
  );
}

const get = (o: Record<string, unknown>, p: (string | number)[]): number => p.reduce<unknown>((x, k) => (x as Record<string | number, unknown>)[k], o) as number;
const set = (o: Record<string, unknown>, p: (string | number)[], v: number): void => {
  let x = o as Record<string | number, unknown>;
  for (const k of p.slice(0, -1)) x = x[k] as Record<string | number, unknown>;
  x[p[p.length - 1]] = v;
};

async function main(): Promise<void> {
  const only = (process.env.ONLY ?? "").split(",").filter(Boolean);
  const params = STAGES[STAGE]?.filter((p) => !only.length || p.path.some((k) => only.includes(String(k))));
  if (!params?.length) throw new Error(`no stage ${STAGE} (or nothing in it by ONLY): ${Object.keys(STAGES).join(", ")}`);
  // the browser too is started again if it dies (two searches lost theirs at the same moment, to the machine)
  let browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
  try {
    // A page opened afresh every 50 tries: a figure made and dropped four times a try left something behind, and a
    // search of hundreds of tries lost its page to it at the 150th
    let page!: Page;
    const openPage = async () => {
    if (page) await page.close().catch(() => undefined);
    if (!browser.connected) browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
    page = await browser.newPage();
    await page.setViewport({ width: 800, height: 500, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(NO_REAL_MOUSE);
    await page.evaluateOnNewDocument(() => localStorage.setItem("range.welcomed", "1"));
    page.on("pageerror", (e) => console.log("pageerror:", String(e)));
    await page.goto(`${URL}${URL.includes("?") ? "&" : "?"}game=speedkills&nointro&norender`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction("Boolean(window.__range) && window.__range.loaded()", { timeout: 90000 });
    await page.waitForFunction("window.__range.soldierReady()", { polling: 250, timeout: 60000 });
    await page.waitForFunction("window.__range.paidGuns().ready", { polling: 250, timeout: 60000 }).catch(() => console.log("the bought guns did not load"));
    await page.addScriptTag({ path: path.resolve("tools/figure-audit.js") });
    await ev(page, `(() => { const r = window.__range; document.getElementById("overlay").classList.add("hidden"); r.player.teleport(0, 0, 0, 0, -9); r.figureLab([${JSON.stringify({ ...POSES[0], weapon: ID, look: "S0000010" })}], 2.6, 30); r.figureLabManual(true); r.figureLabStep(0.8); })()`);
    };
    await openPage();
    const cfg = await ev<Record<string, unknown>>(page, "window.__range.rifleConfig()");
    // what this gun's numbers are now: its own over the shared
    const own = ((cfg.guns as Record<string, Record<string, unknown>>)[ID] ?? {}) as Record<string, unknown>;
    const cur = JSON.parse(JSON.stringify(cfg)) as Record<string, unknown>;
    delete cur.guns;
    const mergeInto = (to: Record<string, unknown>, from: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(from)) {
        if (v && typeof v === "object" && !Array.isArray(v) && to[k] && typeof to[k] === "object") mergeInto(to[k] as Record<string, unknown>, v as Record<string, unknown>);
        else to[k] = JSON.parse(JSON.stringify(v));
      }
    };
    mergeInto(cur, own);
    // START='{"reload":{"keys":{"handle":{"at":[0.01,0.02,0.015]}}}}': begin the search from there (a restart out of a
    // local minimum: the USSO's handle hand stopped with its palm 17 mm in the receiver)
    if (process.env.START) mergeInto(cur, JSON.parse(process.env.START) as Record<string, unknown>);
    // a reload key is measured at each moment of the reload the hand holds it (the middle of its span), the tilt at three
    let reloadTime = 0;
    if (STAGE === "reload") {
      // (the empty reload's plan, every key of it: the first person's timeline, rifle.ts reloadPlanOf)
      const R = await ev<{ left: [number, string][]; right: [number, string][] }>(page, `window.__range.rifleReloadPlan(${JSON.stringify(ID)}, false)`);
      const at: number[] = [];
      for (const seq of [R.left, R.right]) seq.forEach(([u, k], i) => k === KEY && at.push(seq[i + 1]?.[1] === KEY ? (u + seq[i + 1][0]) / 2 : u));
      // a shell key: its fingers hold the shell, so none of them is held to the gun; its pinch is held to the shell
      SHELL_KEY = (cur.reload as { keys: Record<string, { from?: string }> }).keys[KEY]?.from === "round";
      // the key's own fingers searched: they start as the hold's, and each of them should lie on the gun
      if (process.env.KEYFINGERS === "1") {
        const side = R.left.some(([, k]) => k === KEY) ? "l" : "r";
        const keys = (cur.reload as { keys: Record<string, { fingers?: Record<string, number[]> }> }).keys;
        const hold = (cur.fingers as Record<string, Record<string, number[]>>)[side];
        keys[KEY].fingers ??= Object.fromEntries(["index", "middle", "ring", "pinky", "thumb"].map((f) => [f, hold[f].slice(0, 3)]));
        HOLDING = ["index", "middle", "ring", "pinky", "thumb"].map((f) => `${f}_${side}`);
      }
      if (SHELL_KEY) HOLDING = [];
      POSES = (KEY === "tilt" ? [0.2, 0.45, 0.7] : at.length ? at : [0.5]).map((u) => ({ speed: 0, stance: "stand", pitch: 0, reloadAt: u }));
      reloadTime = await ev<number>(page, `window.__range.weaponTimes(${JSON.stringify(ID)}).reloadEmpty`);
      console.log(`${ID} reload ${KEY}: measured at ${POSES.map((p) => p.reloadAt).join(", ")} of its ${reloadTime} s`);
    }
    // the patch this stage owns: its numbers' own sub-objects, whole, so a write keeps what it did not move
    const tops = [...new Set(params.map((p) => p.path[0] as string))];
    const patchOf = (c: Record<string, unknown>) => Object.fromEntries(tops.map((k) => [k, c[k]]));
    let evals = 0;
    const measure = async (c: Record<string, unknown>): Promise<{ cost: number; worst: Audit | null; per: number[] }> => {
      if (evals > 0 && evals % 50 === 0) await openPage();
      evals++;
      await ev(page, `window.__range.rifleTune({ guns: { ${JSON.stringify(ID)}: ${JSON.stringify(patchOf(c))} } })`);
      let total = 0;
      let worst: Audit | null = null;
      let worstCost = -1;
      const per: number[] = [];
      for (const p of POSES) {
        // A fresh figure every pose of every try, stepped the same time: its clips start over, so a try is measured at
        // the same moment of them as every other and its score is the numbers', not the breathing's (a figure carried
        // from try to try was measured 0.1 s further into its idle each time, and the noise passed for improvements)
        const { reloadAt, then: next, ...pose } = p;
        // (a reload's moment: settled, then the reload begun and stepped to it; or settled, then another pose for a while)
        const then =
          reloadAt !== undefined
            ? `r.figureLabPose(0, ${JSON.stringify({ ...pose, act: "reload", reloadEmpty: true, weapon: ID })}); r.figureLabStep(${reloadAt * reloadTime});`
            : next
              ? `r.figureLabPose(0, ${JSON.stringify({ ...next.pose, weapon: ID })}); r.figureLabStep(${next.dt});`
              : "";
        const expr = `(() => { const r = window.__range; r.figureLabManual(false); r.figureLab([${JSON.stringify({ ...POSES[0], reloadAt: undefined, then: undefined, weapon: ID, look: "S0000010" })}], 2.6, 30); r.figureLabManual(true); r.figureLabPose(0, ${JSON.stringify({ ...pose, weapon: ID })}); r.figureLabStep(0.8); ${then} const fg = r.labFigures()[0].figure; const L = r.labFigures()[0].group; const W = (n) => L.getObjectByName(n).getWorldPosition(new r.THREE.Vector3()); const at = fg.rifleOut && fg.rifleOut.pinchAt; return { a: window.__figureAudit(0, { pitch: ${p.pitch}, exact: ${EXACT} }), o: fg.rifleOut && { ...fg.rifleOut, slide: fg.supportSlide, pinch: at ? W("index_03_l").add(W("thumb_03_l")).multiplyScalar(0.5).distanceTo(at) * 1000 : undefined } }; })()`;
        let got: { a: Audit | null; o: Out };
        try {
          got = await ev<{ a: Audit | null; o: Out }>(page, expr);
        } catch (e) {
          // the page (or the browser) died under it: a new one, the try's numbers again, the pose again
          console.log(`  (page lost at try ${evals}: ${String(e).slice(0, 80)}; opening another)`);
          await openPage();
          await ev(page, `window.__range.rifleTune({ guns: { ${JSON.stringify(ID)}: ${JSON.stringify(patchOf(c))} } })`);
          got = await ev<{ a: Audit | null; o: Out }>(page, expr);
        }
        const c1 = cost(got.a, got.o, reloadAt !== undefined);
        per.push(Math.round(c1));
        total += c1;
        if (c1 > worstCost) {
          worstCost = c1;
          worst = got.a;
        }
      }
      return { cost: total, worst, per };
    };
    let best = await measure(cur);
    console.log(`${ID} ${STAGE}: start ${best.cost.toFixed(1)} per pose ${best.per.join("/")} ${JSON.stringify(best.worst)}`);
    const steps = params.map((p) => p.step);
    while (evals < MAX) {
      let moved = false;
      for (let i = 0; i < params.length && evals < MAX; i++) {
        const p = params[i];
        if (steps[i] < p.min) continue;
        const v0 = get(cur, p.path);
        for (const dir of [1, -1]) {
          const v = Math.max(p.lo, Math.min(p.hi, v0 + dir * steps[i]));
          if (Math.abs(v - v0) < 1e-9) continue;
          set(cur, p.path, v);
          const m = await measure(cur);
          if (m.cost < best.cost - 1e-6) {
            best = m;
            moved = true;
            console.log(`  ${evals} ${p.path.join(".")} ${v0.toFixed(4)} -> ${v.toFixed(4)}: ${m.cost.toFixed(1)} per pose ${m.per.join("/")}`);
            console.log(`best ${JSON.stringify(patchOf(cur))}`);
            break;
          }
          set(cur, p.path, v0);
        }
      }
      if (!moved) {
        for (let i = 0; i < steps.length; i++) steps[i] /= 2;
        if (steps.every((s, i) => s < params[i].min)) break;
      }
    }
    // the found numbers applied, and measured once more as they stand
    const fin = await measure(cur);
    console.log(`${ID} ${STAGE}: end ${fin.cost.toFixed(1)} per pose ${fin.per.join("/")} after ${evals} tries ${JSON.stringify(fin.worst)}`);
    const found = patchOf(cur);
    console.log(JSON.stringify(found));
    if (process.env.WRITE === "1") {
      const file = path.resolve("src/config/soldierhold.json");
      const j = JSON.parse(fs.readFileSync(file, "utf8"));
      j.guns[ID] = { ...(j.guns[ID] ?? {}), ...found };
      fs.writeFileSync(file, `${JSON.stringify(j, null, 2)}\n`);
      console.log(`written to soldierhold.json guns.${ID}`);
    }
  } finally {
    await browser.close();
  }
}

void main();
