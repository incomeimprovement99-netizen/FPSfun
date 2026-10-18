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
import { RUN_ROUTE } from "../src/game/courses/basic";

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
 * twice and the second run has deltas and a ghost to race. The points are the
 * course's own (courses/basic.ts RUN_ROUTE, out and back since Milestone 636).
 */
function courseRun(tag: string, shootSplit: boolean, shootResult: boolean): View[] {
  const names = ["pre", "start", "breach", "vent", "climb", "gap", "wallrun", "superglide", "crossfire", "high", "final", "line", "finish"];
  return RUN_ROUTE.map(([x, y, z], i) => {
    const shoot = (i === 2 && shootSplit) || (i === RUN_ROUTE.length - 1 && shootResult);
    return { name: `${tag}-${names[i] ?? i}`, x, y, z, yaw: i >= 7 ? 0 : 180, pitch: 0, note: `run ${tag}: ${names[i] ?? i}`, step: !shoot };
  });
}

const VIEWS: View[] = [
  { name: "firing-line", x: 0, z: 0, yaw: 0, pitch: -4, note: "down the lanes from the spawn" },
  { name: "lanes-mid", x: -8, z: -12, yaw: 12, pitch: -3, note: "mid range, cover row and targets" },
  { name: "platform-left", x: -20, z: -14, yaw: -25, pitch: 6, note: "stairs up to the left platform" },
  { name: "ramp-right", x: 14, z: -12, yaw: 22, pitch: 4, note: "the ramp to the right platform" },
  { name: "looking-back", x: 0, z: -40, yaw: 180, pitch: 0, note: "back toward the covered firing line" },
  { name: "gun-r301", x: 2, z: -2, yaw: 8, pitch: -2, note: "R-301 at the hip", weapon: "vinson" },
  { name: "gun-r301-ads", x: 2, z: -2, yaw: 8, pitch: -1, note: "R-301 aimed down the sights", weapon: "vinson", ads: 1 },
  { name: "gun-r301-reload", x: 2, z: -2, yaw: 8, pitch: -2, note: "R-301 mid reload, magazine out", weapon: "vinson", reload: 0.24 },
  { name: "gun-wingman", x: 2, z: -2, yaw: 8, pitch: -2, note: "Wingman at the hip", weapon: "wingman" },
  { name: "gun-wingman-reload", x: 2, z: -2, yaw: 8, pitch: -2, note: "Wingman, cylinder swung out", weapon: "wingman", reload: 0.33 },
  { name: "gun-flatline", x: 2, z: -2, yaw: 8, pitch: -2, note: "Flatline, another rifle for comparison", weapon: "vinson" },
  { name: "gun-mastiff", x: 2, z: -2, yaw: 8, pitch: -2, note: "Mastiff, pump shotgun", weapon: "mastiff" },
  { name: "dummy-close", x: -11.2, z: -11.6, yaw: 12, pitch: -6, note: "a dummy from 3.5 m", weapon: "vinson" },
  { name: "targets", x: 1.5, z: -5, yaw: 0, pitch: -3, note: "flippers at 7 m, boards at 23 m", weapon: "vinson" },
  { name: "gun-p2020", x: 2, z: -2, yaw: 8, pitch: -2, note: "P2020, detailed", weapon: "semipistol" },
  { name: "gun-g17", x: 2, z: -2, yaw: 8, pitch: -2, note: "Glock 17", weapon: "g17" },
  { name: "spawn-to-course", x: 0, z: 0, yaw: 118, pitch: 3, note: "from the spawn, turned toward the course gate" },
  { name: "course-gate", x: -21.5, z: 3, yaw: 180, pitch: 4, note: "the lit gate to the course, back-left of the spawn" },
  { name: "course-start", x: -18.5, z: 10.5, yaw: 160, pitch: 0, note: "start room, rules sign and the start line" },
  { name: "course-breach", x: -18, z: 21.5, yaw: 180, pitch: -2, note: "room 1, the low wall" },
  { name: "course-tip", x: -15.25, z: 30, yaw: 0, pitch: 22, note: "room 1 looking back: the route tip over the door" },
  { name: "course-climb", x: -18, z: 59.5, yaw: 180, pitch: 16, note: "room 3, the 6.5 m climb wall" },
  { name: "course-gap", x: -12.5, y: 1, z: 94.5, yaw: 180, pitch: -8, note: "room 4, the double jump gap in slick glass" },
  { name: "course-wallrun", x: -10.2, y: 1, z: 119.5, yaw: 178, pitch: 2, note: "room 5, the lit wall and the pit" },
  { name: "course-superglide", x: -27.75, y: 3.8, z: 163.6, yaw: 0, pitch: -8, note: "room 6 from the ledge: the gap and the deck" },
  { name: "course-high", x: -27.75, y: 4, z: 87, yaw: 0, pitch: -12, note: "room 8 from the platform, over the screen" },
  { name: "course-finish", x: -25, z: 28, yaw: 0, pitch: -4, note: "the finish line inside the last door" },
  { name: "range-ladder", x: -13, z: -44, yaw: -78, pitch: 12, note: "a ladder on the left platform" },
  { name: "holstered", x: 2, z: -2, yaw: 8, pitch: -2, note: "holstered: empty hands on screen", weapon: "vinson", lowered: 1 },
  { name: "zip-hands", x: 2, z: -2, yaw: 8, pitch: -4, note: "on a zipline: left hand on the trolley", weapon: "semipistol", onZip: true },
  { name: "optic-holo", x: 2, z: -2, yaw: 8, pitch: -2, note: "R-301 with a 1x holo, hip", weapon: "vinson", optic: "optic_cq_holosight" },
  { name: "optic-holo-ads", x: 2, z: -2, yaw: 2, pitch: -1, note: "R-301 1x holo, aimed", weapon: "vinson", optic: "optic_cq_holosight", ads: 1 },
  { name: "optic-classic-ads", x: 2, z: -2, yaw: 2, pitch: -1, note: "R-301 1x HCOG Classic, aimed", weapon: "vinson", optic: "optic_cq_hcog_classic", ads: 1 },
  { name: "optic-bruiser", x: 2, z: -2, yaw: 8, pitch: -2, note: "R-301 2x Bruiser, hip", weapon: "vinson", optic: "optic_cq_hcog_bruiser" },
  { name: "optic-bruiser-ads", x: 2, z: -2, yaw: 2, pitch: -1, note: "R-301 2x Bruiser, aimed", weapon: "vinson", optic: "optic_cq_hcog_bruiser", ads: 1 },
  { name: "optic-vholo-ads", x: 2, z: -2, yaw: 2, pitch: -1, note: "R-301 1x-2x variable holo, aimed", weapon: "vinson", optic: "optic_cq_holosight_variable", ads: 1 },
  { name: "optic-ranger-ads", x: 2, z: -2, yaw: 2, pitch: -1, note: "R-301 3x Ranger, aimed: scope picture", weapon: "vinson", optic: "optic_ranged_hcog", ads: 1 },
  { name: "optic-aog", x: 2, z: -2, yaw: 8, pitch: -2, note: "R-301 2x-4x AOG, hip", weapon: "vinson", optic: "optic_ranged_aog_variable" },
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
    weapon: "vinson",
    tech: [
      ["SLIDE JUMP", "412 hu/s", true],
      ["LURCH", "34 deg, 88% speed", true],
      ["WALLBOUNCE", "+44 hu", true],
      ["DEADSLIDE", "jumped too early: wait 0.24 s", false],
      ["SUPERGLIDE", "410 hu/s", true],
    ],
  },
  { name: "operators", x: 0, z: -13, yaw: 180, pitch: -4, note: "the five operators", setup: "window.__range.gallery()" },
  { name: "range-roof", x: 0, z: -20, yaw: 0, pitch: 22, note: "the range under its new roof" },
  { name: "course-vent", x: -12.5, z: 41.5, yaw: 180, pitch: -4, note: "room 2, the slot to slide" },
  { name: "course-tv", x: -14.5, z: 11.4, yaw: 0, pitch: 3, note: "the results TV by the start" },
  { name: "menu-stats", x: 0, z: 0, yaw: 0, pitch: 0, note: "menu: stats", menu: "stats" },
  { name: "holster-mid", x: 2, z: -2, yaw: 8, pitch: -2, note: "halfway through holstering: the gun turns down and away", weapon: "vinson", lowered: 0.5 },
  { name: "hands-grip", x: 2, z: -2, yaw: 8, pitch: -2, note: "the rebuilt gripping hands on the Wingman", weapon: "wingman" },
  { name: "heirloom-karambit", x: 2, z: -2, yaw: 8, pitch: -2, note: "karambit, holstered", weapon: "vinson", lowered: 1, heirloom: "karambit" },
  { name: "heirloom-butterfly", x: 2, z: -2, yaw: 8, pitch: -2, note: "butterfly knife, holstered", weapon: "vinson", lowered: 1, heirloom: "butterfly" },
  { name: "heirloom-kukri", x: 2, z: -2, yaw: 8, pitch: -2, note: "kukri, holstered", weapon: "vinson", lowered: 1, heirloom: "kukri" },
  { name: "heirloom-tanto", x: 2, z: -2, yaw: 8, pitch: -2, note: "combat tanto, holstered", weapon: "vinson", lowered: 1, heirloom: "tanto" },
  { name: "heirloom-katana", x: 2, z: -2, yaw: 8, pitch: -2, note: "CC0 katana, holstered", weapon: "vinson", lowered: 1, heirloom: "katana" },
  { name: "heirloom-dagger", x: 2, z: -2, yaw: 8, pitch: -2, note: "CC0 dagger, holstered", weapon: "vinson", lowered: 1, heirloom: "dagger" },
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
