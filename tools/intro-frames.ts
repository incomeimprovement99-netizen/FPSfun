// The intro cards' frames (src/ui/intro.ts): the gaps between the card's animation frames while it plays (not while it
// holds on its still, waiting for the page to be calm, intro.json settle), on the boot
// card (the page loading under it) and on a match card (the match building under it), so a stutter in the rain is a
// number: the longest gap, how many passed 50 ms, and the median. Headless on the GPU, never the real mouse or keyboard.
//
// Run: SHOT_URL=http://localhost:5196/ npx tsx tools/intro-frames.ts
import puppeteer from "puppeteer";

const URL = process.env.SHOT_URL ?? "http://localhost:5196/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
// every animation frame's time while a card is up and animating (its `at` moving), from the page's first moment
const WATCH = `
  window.__introFrames = { boot: [], match: [] };
  (function tick(now) {
    const r = window.__range;
    const s = r && r.intro ? r.intro.state() : null;
    if (s && s.kind && s.shown && !s.holding) window.__introFrames[s.kind].push({ now, at: s.at, waited: s.waited });
    if (s && s.kind && s.holding) window.__introHeld = (window.__introHeld || 0) + 1;
    requestAnimationFrame(tick);
  })(performance.now());
`;
const summary = (rows: Array<{ now: number; at: number }>) => {
  const gaps = rows.slice(1).map((r, i) => r.now - rows[i].now).sort((a, b) => a - b);
  if (!gaps.length) return "no frames";
  // where the long ones fall: the card's own clock before and after each
  const long = rows.slice(1).map((r, i) => ({ gap: r.now - rows[i].now, from: rows[i].at, to: r.at })).filter((g) => g.gap > 50);
  return `${rows.length} frames, median ${gaps[Math.floor(gaps.length / 2)].toFixed(1)} ms, longest ${gaps[gaps.length - 1].toFixed(0)} ms, ${gaps.filter((g) => g > 50).length} over 50 ms, ${gaps.filter((g) => g > 100).length} over 100 ms` +
    (long.length ? `
    ${long.map((g) => `${g.gap.toFixed(0)} ms at ${g.from.toFixed(2)} s to ${g.to.toFixed(2)} s`).join("; ")}` : "");
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  await page.evaluateOnNewDocument("window.__straightDrop = true; window.__noGulag = true;");
  await page.evaluateOnNewDocument(`addEventListener("DOMContentLoaded", () => { ${WATCH} });`);
  page.on("pageerror", (e) => console.log("pageerror:", String(e)));
  await page.goto(`${URL}?game=speedkills`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("Boolean(window.__range) && window.__range.loaded()", { timeout: 90000 });
  // the boot card to its end
  await page.waitForFunction("window.__range.intro.state().kind === null && window.__introFrames.boot.length > 0", { polling: 200, timeout: 60000 });
  console.log("boot card: ", summary(await page.evaluate("window.__introFrames.boot") as Array<{ now: number; at: number }>));
  await page.waitForFunction("window.__range.paidGuns().ready && window.__range.soldierReady()", { polling: 250, timeout: 60000 });
  await page.evaluate(`document.getElementById("overlay").classList.add("hidden"); window.__range.input.locked = true; window.__range.startBr();`);
  await page.waitForFunction("window.__introFrames.match.length > 0 && window.__range.intro.state().kind === null", { polling: 200, timeout: 60000 });
  console.log("match card:", summary(await page.evaluate("window.__introFrames.match") as Array<{ now: number; at: number }>));
} finally {
  await browser.close();
}
