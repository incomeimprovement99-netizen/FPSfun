// The soldier's contact sheet (Phase 21 S5): every motion the game plays on a figure, on the soldier, at five
// moments a fifth of a second apart, front and side, so a look finds feet through the floor, hands off the gun,
// elbows through the vest and plates through the head. Each picture is one row of motions with its five moments
// stacked under it. Headless, never the real mouse or keyboard.
//
// Run: SHOT_URL=http://localhost:5196/ npx tsx tools/soldier-clips.ts [out prefix]
import puppeteer from "puppeteer";

const URL = process.env.SHOT_URL ?? "http://localhost:5196/";
const OUT = process.argv[2] ?? "docs/updates/2026-09-28-soldier-clips";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;

/** every motion a figure plays (dummy.ts FigurePose): the stances, the speeds that pick a clip, and the hands' acts */
const MOTIONS: Array<[string, Record<string, unknown>]> = [
  ["idle", { speed: 0, stance: "stand" }],
  ["walk", { speed: 2.5, stance: "stand" }],
  ["run", { speed: 7, stance: "stand" }],
  ["sprint", { speed: 14, stance: "stand" }],
  ["strafe", { speed: 7, stance: "stand", moveDir: Math.PI / 2 }],
  ["backpedal", { speed: 4, stance: "stand", moveDir: Math.PI }],
  ["aim", { speed: 0, stance: "stand", ads: 1 }],
  ["crouch", { speed: 0, stance: "crouch" }],
  ["crouch walk", { speed: 3, stance: "crouch" }],
  ["slide", { speed: 12, stance: "slide" }],
  ["air", { speed: 8, stance: "air" }],
  ["climb", { speed: 0, stance: "climb" }],
  ["mantle", { speed: 0, stance: "mantle" }],
  ["zipline", { speed: 10, stance: "zip" }],
  ["reload", { speed: 0, stance: "stand", act: "reload" }],
  ["swap", { speed: 0, stance: "stand", act: "swap" }],
  ["heal", { speed: 0, stance: "stand", act: "heal", healItem: "syringe" }],
  ["throw", { speed: 0, stance: "stand", act: "throw" }],
  ["melee", { speed: 0, stance: "stand", act: "melee" }],
  ["downed", { speed: 1, stance: "downed" }],
  ["knocked out", { speed: 0, stance: "stand", dead: true }],
];
const PER_ROW = 7;
const MOMENTS = 5;
const W = 1600;
const H = 900;
/** the figures this far off (m), and the screen rows they stand in there: head 1.85 m and feet 1.6 m below the eye at the view's 76 degrees up and down, looking 6 degrees down */
const DIST = 3.5;
const BAND = [320, 700];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  page.on("pageerror", (e) => console.log("pageerror:", String(e)));
  await page.goto(`${URL}?game=speedkills&nointro`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("Boolean(window.__range) && window.__range.loaded()", { timeout: 60000 });
  await page.evaluate(`document.getElementById("overlay").classList.add("hidden"); document.getElementById("hud")?.style.setProperty("visibility", "hidden")`);
  const ready = await page.waitForFunction("window.__range.soldierReady()", { polling: 250, timeout: 60000 }).then(() => true, () => false);
  console.log("soldier ready:", ready);
  const sheet = await browser.newPage();
  for (let row = 0; row * PER_ROW < MOTIONS.length; row++) {
    const motions = MOTIONS.slice(row * PER_ROW, (row + 1) * PER_ROW);
    for (const [view, turn] of [["front", 0], ["side", 90]] as const) {
      // each motion on its own variant, so the four kits' pieces are all seen moving
      const poses = motions.map(([, p], i) => ({ pitch: 0, look: ["S0000010", "S1111020", "S2222030", "S3343040"][i % 4], ...p }));
      // the game page to the front: in the background it stops drawing, and its screenshot never comes
      await page.bringToFront();
      await page.evaluate(`(() => { const r = window.__range; r.player.teleport(0, 0, 0, 0, -6); r.hideViewModel(true); r.figureLab(${JSON.stringify(poses)}, ${DIST}, ${turn}); })()`);
      // the figures' own clips settle (a knocked-out one stands 0.6 s, then falls)
      await new Promise((r) => setTimeout(r, 700));
      const bands: string[] = [];
      for (let k = 0; k < MOMENTS; k++) {
        bands.push(await page.screenshot({ encoding: "base64", clip: { x: 0, y: BAND[0], width: W, height: BAND[1] - BAND[0] } }));
        await new Promise((r) => setTimeout(r, 200));
      }
      // figureLab lays its first figure on the right of the screen, so the labels run right to left
      const labels = motions.map(([n]) => `<span>${n}</span>`).reverse().join("");
      await sheet.setViewport({ width: W, height: 40 + MOMENTS * (BAND[1] - BAND[0]), deviceScaleFactor: 1 });
      await sheet.setContent(
        `<body style="margin:0;background:#111;font:16px sans-serif;color:#fff"><div style="display:flex;justify-content:space-around;height:40px;align-items:center">${labels}</div>` +
          bands.map((b) => `<img style="display:block" src="data:image/png;base64,${b}">`).join("") +
          "</body>",
      );
      const path = `${OUT}-${row + 1}-${view}.png`;
      await sheet.screenshot({ path, fullPage: true });
      console.log(path);
    }
  }
} finally {
  await browser.close();
}
