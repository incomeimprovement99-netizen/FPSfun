// Screenshots of named scenarios, drawn for real (the e2e runs without
// drawing, so HUD code only runs here): set something up in the page, wait,
// take the picture, and fail on any page error. For judging the HUD and the
// effects this phase adds rather than claiming them.
//
// Run: npx tsx tools/snap.ts                 every scenario
//      SNAP=ability-br,recap npx tsx tools/snap.ts
// (needs `npm run dev` already running; pictures go to shots/, not in git)
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer, { type Page } from "puppeteer";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const OUT = resolve(HERE, "..", "shots");
const BASE = process.env.SHOT_URL ?? "http://localhost:5173/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ev = <T>(page: Page, expr: string) => page.evaluate(expr) as Promise<T>;

interface Scenario {
  name: string;
  note: string;
  /** page query (e.g. ?net=local) */
  query?: string;
  /** steps: an expression to run, then a wait in ms */
  steps: Array<[string, number]>;
}

const hideMenu = `document.getElementById("overlay").classList.add("hidden")`;

export const SCENARIOS: Scenario[] = [
  {
    name: "ability-range",
    note: "the range: the compact ability line; then JOLT picked, the slot with its key",
    steps: [
      [hideMenu, 300],
      [`window.__range.pickAbility("jolt")`, 200],
      [`window.__range.useAbility()`, 120],
    ],
  },
  {
    name: "ability-range-card",
    note: "the range before any pick: the one-line card",
    steps: [[hideMenu, 400]],
  },
  {
    name: "ability-bots-card",
    note: "a bot match with abilities on: the full card at the countdown",
    steps: [
      [`(() => { const s = document.getElementById("botAbilities"); s.value = "1"; s.dispatchEvent(new Event("change")); ${hideMenu}; window.__range.startBots(); })()`, 900],
    ],
  },
  {
    name: "ability-triage",
    note: "TRIAGE picked in a bot match: the passive slot",
    steps: [
      [`(() => { const s = document.getElementById("botAbilities"); s.value = "1"; s.dispatchEvent(new Event("change")); ${hideMenu}; window.__range.startBots(); })()`, 600],
      [`window.__range.pickAbility("triage")`, 3200],
    ],
  },
];

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const only = (process.env.SNAP ?? "").split(",").filter(Boolean);
  const list = SCENARIOS.filter((s) => !only.length || only.includes(s.name));
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars", "--mute-audio", "--no-sandbox"],
  });
  let bad = 0;
  try {
    for (const sc of list) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String((e as Error).message ?? e)));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.evaluateOnNewDocument(() => localStorage.setItem("range.welcomed", "1"));
      await page.goto(BASE + (sc.query ?? ""), { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 60000 });
      await sleep(1500);
      for (const [expr, wait] of sc.steps) {
        await ev(page, expr);
        await sleep(wait);
      }
      await page.screenshot({ path: resolve(OUT, `${sc.name}.png`) });
      const ok = errors.length === 0;
      if (!ok) bad++;
      console.log(`${ok ? "  ok  " : "FAIL  "}${sc.name.padEnd(22)} ${sc.note}${ok ? "" : `: ${errors.slice(0, 3).join(" | ")}`}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log(bad ? `\nSNAP FAIL (${bad})` : "\nSNAP PASS");
  process.exit(bad ? 1 : 0);
}

if (process.argv[1]?.endsWith("snap.ts")) void main();
