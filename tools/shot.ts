// Screenshot the running range, so visual changes can be judged rather than
// claimed. Uses the system Chrome (puppeteer's bundled download is blocked in
// this environment) with GPU rasterisation so WebGL actually renders.
//
// Run: npm run shot            (needs `npm run dev` already running)
//      SHOT_VIEWS=wide,ads npm run shot
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer, { type Browser, type Page } from "puppeteer";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const OUT = resolve(HERE, "..", "shots");
const PAGE_URL = process.env.SHOT_URL ?? "http://localhost:5173/";
const CHROME =
  process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

/** camera poses to capture: x, y, z are feet position; yaw/pitch in degrees */
interface View {
  name: string;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  note: string;
  /** feet height, for standing on platforms */
  y?: number;
  /** viewmodel overrides: which gun to draw, ADS fraction, reload progress */
  weapon?: string;
  ads?: number;
  reload?: number;
  optic?: string;
  lowered?: number;
  onZip?: boolean;
  /** tech-feed lines to post before the capture: name, detail, good */
  tech?: Array<[string, string, boolean]>;
  /** skip the screenshot: a step in a scripted run */
  step?: boolean;
  /** heirloom to hold (with lowered: 1 to see it) */
  heirloom?: string;
  /** an expression run in the page once before this view */
  setup?: string;
  /** show the menu open on this tab instead of the game */
  menu?: string;
}

/**
 * A scripted course run: teleport across the start line and into each room in
 * turn, so the splits, the result card and the ghost can be captured. Run it
 * twice and the second run has deltas and a ghost to race.
 */
const X = -21.5;
function courseRun(tag: string, shootSplit: boolean, shootResult: boolean): View[] {
  const at = (name: string, x: number, y: number, z: number, step = true): View => ({ name: `${tag}-${name}`, x: X + x, y, z, yaw: 180, pitch: 0, note: `run ${tag}: ${name}`, step });
  return [
    at("pre", 0, 0, 11),
    at("start", 0, 0, 13.5),
    at("breach", 6, 0, 22, !shootSplit),
    at("vent", 0, 0, 42),
    at("climb", 0, 4.2, 52.8),
    at("glide", 0, 1.4, 71),
    at("gap", 8, 1.4, 83),
    at("zip", -7, 0, 95),
    at("final", 7, 0, 119.5),
    at("finish", 7, 0, 131.2, !shootResult),
  ];
}

const VIEWS: View[] = [
  { name: "firing-line", x: 0, z: 0, yaw: 0, pitch: -4, note: "down the lanes from the spawn" },
  { name: "lanes-mid", x: -8, z: -12, yaw: 12, pitch: -3, note: "mid range, cover row and targets" },
  { name: "platform-left", x: -20, z: -14, yaw: -25, pitch: 6, note: "stairs up to the left platform" },
  { name: "ramp-right", x: 14, z: -12, yaw: 22, pitch: 4, note: "the ramp to the right platform" },
  { name: "looking-back", x: 0, z: -40, yaw: 180, pitch: 0, note: "back toward the covered firing line" },
  { name: "gun-r301", x: 2, z: -2, yaw: 8, pitch: -2, note: "R-301 at the hip", weapon: "rspn101" },
  { name: "gun-r301-ads", x: 2, z: -2, yaw: 8, pitch: -1, note: "R-301 aimed down the sights", weapon: "rspn101", ads: 1 },
  { name: "gun-r301-reload", x: 2, z: -2, yaw: 8, pitch: -2, note: "R-301 mid reload, magazine out", weapon: "rspn101", reload: 0.24 },
  { name: "gun-wingman", x: 2, z: -2, yaw: 8, pitch: -2, note: "Wingman at the hip", weapon: "wingman" },
  { name: "gun-wingman-reload", x: 2, z: -2, yaw: 8, pitch: -2, note: "Wingman, cylinder swung out", weapon: "wingman", reload: 0.33 },
  { name: "gun-flatline", x: 2, z: -2, yaw: 8, pitch: -2, note: "Flatline, another rifle for comparison", weapon: "vinson" },
  { name: "gun-mastiff", x: 2, z: -2, yaw: 8, pitch: -2, note: "Mastiff, pump shotgun", weapon: "mastiff" },
  { name: "dummy-close", x: -11.2, z: -11.6, yaw: 12, pitch: -6, note: "a dummy from 3.5 m", weapon: "rspn101" },
  { name: "targets", x: 1.5, z: -5, yaw: 0, pitch: -3, note: "flippers at 7 m, boards at 23 m", weapon: "rspn101" },
  { name: "gun-p2020", x: 2, z: -2, yaw: 8, pitch: -2, note: "P2020, detailed", weapon: "semipistol" },
  { name: "gun-g17", x: 2, z: -2, yaw: 8, pitch: -2, note: "Glock 17", weapon: "g17" },
  { name: "spawn-to-course", x: 0, z: 0, yaw: 118, pitch: 3, note: "from the spawn, turned toward the course gate" },
  { name: "course-gate", x: -21.5, z: 3, yaw: 180, pitch: 4, note: "the lit gate to the course, back-left of the spawn" },
  { name: "course-start", x: -18.5, z: 10.5, yaw: 160, pitch: 0, note: "start room, rules sign and the start line" },
  { name: "course-breach", x: -14.5, z: 22, yaw: 180, pitch: -2, note: "room 1, B00G walls and the roof" },
  { name: "course-tip", x: -21.5, z: 26, yaw: 0, pitch: 4, note: "room 1 looking back: the route tip" },
  { name: "course-climb", x: -14.5, z: 49, yaw: 180, pitch: 10, note: "room 3, the 4.2 m climb wall and its ladder" },
  { name: "course-gap", x: -13.5, y: 1.4, z: 82, yaw: 180, pitch: -10, note: "room 5, the gap" },
  { name: "course-zip", x: -28.5, z: 94, yaw: 170, pitch: 16, note: "room 6: deck, vertical zip, ladder" },
  { name: "course-zip-deck", x: -25.8, y: 4.5, z: 98.6, yaw: -146, pitch: -8, note: "room 6 from the deck, down the long zip" },
  { name: "range-ladder", x: -13, z: -44, yaw: -78, pitch: 12, note: "a ladder on the left platform" },
  { name: "holstered", x: 2, z: -2, yaw: 8, pitch: -2, note: "holstered: empty hands on screen", weapon: "rspn101", lowered: 1 },
  { name: "zip-hands", x: -25.8, y: 4.5, z: 100, yaw: -146, pitch: -4, note: "on a zipline: left hand on the trolley", weapon: "semipistol", onZip: true },
  { name: "optic-holo", x: 2, z: -2, yaw: 8, pitch: -2, note: "R-301 with a 1x holo, hip", weapon: "rspn101", optic: "optic_cq_holosight" },
  { name: "optic-holo-ads", x: 2, z: -2, yaw: 2, pitch: -1, note: "R-301 1x holo, aimed", weapon: "rspn101", optic: "optic_cq_holosight", ads: 1 },
  { name: "optic-classic-ads", x: 2, z: -2, yaw: 2, pitch: -1, note: "R-301 1x HCOG Classic, aimed", weapon: "rspn101", optic: "optic_cq_hcog_classic", ads: 1 },
  { name: "optic-bruiser", x: 2, z: -2, yaw: 8, pitch: -2, note: "R-301 2x Bruiser, hip", weapon: "rspn101", optic: "optic_cq_hcog_bruiser" },
  { name: "optic-bruiser-ads", x: 2, z: -2, yaw: 2, pitch: -1, note: "R-301 2x Bruiser, aimed", weapon: "rspn101", optic: "optic_cq_hcog_bruiser", ads: 1 },
  { name: "optic-vholo-ads", x: 2, z: -2, yaw: 2, pitch: -1, note: "R-301 1x-2x variable holo, aimed", weapon: "rspn101", optic: "optic_cq_holosight_variable", ads: 1 },
  { name: "optic-ranger-ads", x: 2, z: -2, yaw: 2, pitch: -1, note: "R-301 3x Ranger, aimed: scope picture", weapon: "rspn101", optic: "optic_ranged_hcog", ads: 1 },
  { name: "optic-aog", x: 2, z: -2, yaw: 8, pitch: -2, note: "R-301 2x-4x AOG, hip", weapon: "rspn101", optic: "optic_ranged_aog_variable" },
  { name: "optic-sniper", x: 2, z: -2, yaw: 8, pitch: -2, note: "G7 with a 6x sniper, hip", weapon: "g2", optic: "optic_sniper" },
  { name: "optic-sniper-ads", x: 2, z: -2, yaw: 2, pitch: -1, note: "G7 6x sniper, aimed", weapon: "g2", optic: "optic_sniper", ads: 1 },
  { name: "optic-p2020-holo-ads", x: 2, z: -2, yaw: 2, pitch: -1, note: "P2020 with a 1x holo on the slide, aimed", weapon: "semipistol", optic: "optic_cq_holosight", ads: 1 },
  { name: "optic-threat-ads", x: 2, z: -2, yaw: 2, pitch: -1, note: "P2020 1x digital threat, aimed", weapon: "semipistol", optic: "optic_cq_threat", ads: 1 },
  { name: "wallbounce-wall", x: 26, z: -19, yaw: -90, pitch: 12, note: "the wallbounce practice wall and its climb zones" },
  {
    name: "tech-feed",
    x: 2,
    z: -2,
    yaw: 8,
    pitch: -2,
    note: "the tech feed after a few pieces of tech",
    weapon: "rspn101",
    tech: [
      ["SLIDE JUMP", "412 hu/s", true],
      ["LURCH", "34 deg, 88% speed", true],
      ["WALLBOUNCE", "+44 hu", true],
      ["DEADSLIDE", "jumped too early: wait 0.24 s", false],
      ["SUPERGLIDE", "410 hu/s", true],
    ],
  },
  { name: "arena-spawn", x: 90, z: -69, yaw: 180, pitch: 2, note: "1v1 arena from the first spawn: three lanes" },
  { name: "arena-mid", x: 97, z: -47, yaw: 140, pitch: 4, note: "1v1 arena middle: the circle and the boxes" },
  { name: "arena-walltop", x: 84, y: 3, z: -30, yaw: 200, pitch: -8, note: "on top of a lane wall" },
  { name: "operators", x: 90, z: -69, yaw: 180, pitch: -4, note: "the five operators", setup: "window.__range.gallery()" },
  { name: "range-roof", x: 0, z: -20, yaw: 0, pitch: 22, note: "the range under its new roof" },
  { name: "course-vent", x: -18.5, z: 35, yaw: 180, pitch: 4, note: "room 2 in its own colours" },
  { name: "course-glide", x: -21.5, y: 1.4, z: 72, yaw: 180, pitch: 4, note: "room 4 in its own colours" },
  { name: "course-tv", x: -14.5, z: 11.4, yaw: 0, pitch: 3, note: "the results TV by the start" },
  { name: "adv-gate", x: 21.5, z: 3, yaw: 180, pitch: 4, note: "the lit gate to the advanced course, back-right of the spawn" },
  { name: "adv-glide", x: 21.5, y: 3.0, z: 45, yaw: 180, pitch: -6, note: "advanced room 2 from the ledge: the 7 m gap and the pad" },
  { name: "adv-strafe", x: 21.5, y: 1.4, z: 65, yaw: 180, pitch: -8, note: "advanced room 3: the lurch pads over the red" },
  { name: "adv-superjump", x: 21.5, z: 105, yaw: 200, pitch: 12, note: "advanced room 5: the zip and the floating platform" },
  { name: "tri-spawn", x: 90, z: 79, yaw: 180, pitch: 2, note: "1v1v1: from a corner toward the circle and the spokes" },
  { name: "tri-mid", x: 90, y: 1.4, z: 54, yaw: 60, pitch: -4, note: "1v1v1: the middle from a box" },
  { name: "kraber-scope", x: 2, z: -2, yaw: 8, pitch: -1, note: "the Kraber wearing its built-in 4x-8x", weapon: "sniper", ads: 1 },
  { name: "menu-stats", x: 0, z: 0, yaw: 0, pitch: 0, note: "menu: stats", menu: "stats" },
  { name: "heirloom-karambit", x: 2, z: -2, yaw: 8, pitch: -2, note: "karambit, holstered", weapon: "rspn101", lowered: 1, heirloom: "karambit" },
  { name: "heirloom-butterfly", x: 2, z: -2, yaw: 8, pitch: -2, note: "butterfly knife, holstered", weapon: "rspn101", lowered: 1, heirloom: "butterfly" },
  { name: "heirloom-kukri", x: 2, z: -2, yaw: 8, pitch: -2, note: "kukri, holstered", weapon: "rspn101", lowered: 1, heirloom: "kukri" },
  { name: "heirloom-tanto", x: 2, z: -2, yaw: 8, pitch: -2, note: "combat tanto, holstered", weapon: "rspn101", lowered: 1, heirloom: "tanto" },
  { name: "heirloom-katana", x: 2, z: -2, yaw: 8, pitch: -2, note: "CC0 katana, holstered", weapon: "rspn101", lowered: 1, heirloom: "katana" },
  { name: "heirloom-dagger", x: 2, z: -2, yaw: 8, pitch: -2, note: "CC0 dagger, holstered", weapon: "rspn101", lowered: 1, heirloom: "dagger" },
  { name: "menu-play", x: 0, z: 0, yaw: 0, pitch: 0, note: "menu: play", menu: "play" },
  { name: "menu-duel", x: 0, z: 0, yaw: 0, pitch: 0, note: "menu: 1v1", menu: "duel" },
  { name: "menu-loadouts", x: 0, z: 0, yaw: 0, pitch: 0, note: "menu: loadouts", menu: "loadouts" },
  { name: "menu-settings", x: 0, z: 0, yaw: 0, pitch: 0, note: "menu: settings", menu: "settings" },
  { name: "menu-controls", x: 0, z: 0, yaw: 0, pitch: 0, note: "menu: controls", menu: "controls" },
  ...courseRun("run1", false, true),
  ...courseRun("run2", true, false),
];

async function capture(page: Page, v: View): Promise<void> {
  if (v.setup) await page.evaluate(v.setup);
  await page.evaluate(`(() => { const r = window.__range; if (r && r.debugView) r.debugView.heirloom = ${JSON.stringify(v.heirloom ?? null)}; })()`);
  if (v.menu) {
    await page.evaluate(`(() => { document.getElementById("overlay").classList.remove("hidden"); window.__range.menu.show(${JSON.stringify(v.menu)}); })()`);
    await new Promise((r) => setTimeout(r, 300));
    await page.screenshot({ path: resolve(OUT, `${v.name}.png`) });
    await page.evaluate(`document.getElementById("overlay").classList.add("hidden")`);
    console.log(`  ${v.name.padEnd(16)} ${v.note}`);
    return;
  }
  await page.evaluate(
    (x: number, z: number, yaw: number, pitch: number, weapon: string | null, ads: number | null, reload: number | null, feetY: number, optic: string | null, lowered: number | null, onZip: boolean | null) => {
      const r = (window as unknown as {
        __range?: { player?: Record<string, unknown>; debugView?: Record<string, unknown> };
      }).__range;
      const p = r?.player as { teleport: (x: number, y: number, z: number, yaw: number, pitch: number) => void; setBounds: (b: unknown) => void } | undefined;
      if (!p) return;
      // wide bounds, so a view anywhere (the arena included) is not clamped
      p.setBounds({ minX: -500, maxX: 500, minZ: -500, maxZ: 500 });
      p.teleport(x, feetY, z, yaw, pitch);
      const pl = r?.player as { vel?: { set: (a: number, b: number, c: number) => void } } | undefined;
      pl?.vel?.set(0, 0, 0);
      if (r?.debugView) {
        r.debugView.weapon = weapon;
        r.debugView.ads = ads;
        r.debugView.reload = reload;
        r.debugView.optic = optic;
        r.debugView.lowered = lowered;
        r.debugView.onZip = onZip;
      }
    },
    v.x,
    v.z,
    v.yaw,
    v.pitch,
    v.weapon ?? null,
    v.ads ?? null,
    v.reload ?? null,
    v.y ?? 0,
    v.optic ?? null,
    v.lowered ?? null,
    v.onZip ?? null
  );
  if (v.tech) {
    await page.evaluate((lines: Array<[string, string, boolean]>) => {
      const p = (window as unknown as { __range?: { player?: { onTech?: (n: string, d: string, g: boolean) => void } } }).__range?.player;
      for (const [n, d, g] of lines) p?.onTech?.(n, d, g);
    }, v.tech);
  }
  if (v.step) {
    await new Promise((r) => setTimeout(r, 250));
    return;
  }
  // let a few frames run so the camera and any pending textures settle
  await new Promise((r) => setTimeout(r, 450));
  await page.screenshot({ path: resolve(OUT, `${v.name}.png`) });
  console.log(`  ${v.name.padEnd(16)} ${v.note}`);
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--hide-scrollbars",
        "--mute-audio",
        "--no-sandbox",
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${String((e as Error).message ?? e)}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console: ${m.text()}`);
    });
    page.on("requestfailed", (r) => errors.push(`request failed: ${r.url()}`));

    // SHOT_QUALITY=high|balanced|competitive picks the graphics preset
    const q = process.env.SHOT_QUALITY;
    if (q) await page.evaluateOnNewDocument((v: string) => localStorage.setItem("range.quality", v), q);
    await page.goto(PAGE_URL, { waitUntil: "networkidle2", timeout: 60000 });
    // wait for the debug handle, which only exists once main.ts has run
    await page.waitForFunction(
      () => Boolean((window as unknown as { __range?: unknown }).__range),
      { timeout: 30000 }
    );
    // and for the textures to finish loading
    await new Promise((r) => setTimeout(r, 2500));

    // hide the settings overlay so the scene is visible
    await page.evaluate(() => document.getElementById("overlay")?.classList.add("hidden"));

    const want = (process.env.SHOT_VIEWS ?? "").split(",").filter(Boolean);
    const views = want.length ? VIEWS.filter((v) => want.includes(v.name)) : VIEWS;
    console.log(`capturing ${views.length} views to shots/`);
    for (const v of views) await capture(page, v);

    // the settings screen with the frame-rate guide hovered open
    if (!want.length || want.includes("perf-guide")) {
      await page.evaluate(() => document.getElementById("overlay")?.classList.remove("hidden"));
      await page.hover(".tipIcon");
      await new Promise((r) => setTimeout(r, 400));
      await page.screenshot({ path: resolve(OUT, "perf-guide.png") });
      console.log("  perf-guide       the settings screen with the frame-rate guide open");
    }

    if (errors.length) {
      console.error(`\n${errors.length} page error(s):`);
      for (const e of [...new Set(errors)].slice(0, 20)) console.error(`  ${e}`);
      process.exitCode = 1;
    } else {
      console.log("\nno page errors");
    }
  } finally {
    await browser?.close();
  }
}

void main();
