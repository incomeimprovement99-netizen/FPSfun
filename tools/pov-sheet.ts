// The owner's own view (Phase 21, 2026-09-27: "take a screenshot from the pov I use"): 1920x1080 at the widest FOV
// setting (1.571, 110 degrees), each gun standing, walking, sprinting, sliding, aimed, reloading and firing, so the arms
// are judged where the owner sees them. Headless, never the real mouse or keyboard.
//
// Run: SHOT_URL=http://localhost:5196/ npx tsx tools/pov-sheet.ts [out prefix] [ids...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const URL = process.env.SHOT_URL ?? "http://localhost:5196/";
const OUT = process.argv[2] ?? "docs/updates/pov";
const IDS = process.argv.length > 3 ? process.argv.slice(3) : Object.keys(JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "config", "fparms.json"), "utf8")).guns);
const FOV = Number(process.env.FOV ?? 1.571);
// ONLY=stand,aim takes just those of the poses
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  await page.evaluateOnNewDocument(`try { const k = "range.settings.v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.fovScale = ${FOV}; localStorage.setItem(k, JSON.stringify(s)); } catch {}`);
  page.on("pageerror", (e) => console.log("pageerror:", String(e)));
  await page.goto(`${URL}?game=speedkills&nointro`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("Boolean(window.__range) && window.__range.loaded() && window.__range.paidGuns().ready && window.__range.soldierReady()", { polling: 250, timeout: 60000 });
  await page.evaluate(`document.getElementById("overlay").classList.add("hidden"); window.__range.input.locked = true;`);
  const shot = async (name: string, script: string, ms: number) => {
    if (ONLY && !ONLY.includes(name.slice(name.lastIndexOf("-") + 1))) return;
    await page.evaluate(`(() => { const r = window.__range; r.player.teleport(0, 0, 30, 0, 0); ${script} })()`);
    await wait(ms);
    await page.screenshot({ path: `${OUT}-${name}.png` });
    await page.evaluate("window.__range.setScript(null); window.__range.debugView.reload = null");
    await wait(300);
    console.log(`${OUT}-${name}.png`);
  };
  for (const id of IDS) {
    await page.evaluate(`(() => { const r = window.__range; r.player.teleport(0, 0, 30, 0, 0); r.loadout.give(0, ${JSON.stringify(id)}); r.loadout.requestSwap(0, r.gameTime()); })()`);
    await wait(1500);
    await shot(`${id}-stand`, "", 600);
    await shot(`${id}-walk`, `r.setScript({ held: (a) => a === "left", pressedNow: () => false });`, 900);
    await shot(`${id}-sprint`, `r.setScript({ held: (a) => a === "forward", pressedNow: (a) => a === "sprint" });`, 1200);
    await shot(`${id}-slide`, `let f = 0; r.setScript({ held: (a) => a === "forward" || (a === "crouch" && f > 60), pressedNow: (a) => a === "sprint" }, () => { f++; });`, 1400);
    await shot(`${id}-aim`, `r.setScript({ held: (a) => a === "ads", pressedNow: () => false });`, 800);
    await shot(`${id}-fire`, `r.setScript({ held: (a) => a === "fire", pressedNow: () => false });`, 120);
    await shot(`${id}-reload`, `r.debugView.reload = 0.3;`, 500);
  }
} finally {
  await browser.close();
}
