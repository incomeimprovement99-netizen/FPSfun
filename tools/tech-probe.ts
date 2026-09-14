// Movement tech in the REAL page, not the simulation: a scripted controller
// runs at the wallbounce practice wall exactly as its sign says, and the tech
// feed says what the game registered. The simulation passes its wallbounce
// tests; this checks the same rules against the real range geometry, the real
// frame loop and the real input path.
//
// Run: npm run dev, then npx tsx tools/tech-probe.ts
import puppeteer from "puppeteer";

const CHROME = process.env.CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.env.RANGE_URL ?? "http://localhost:5173/?norender";

/** a plan the page runs frame by frame; everything below is page-side code as a string */
const PLAN = `(() => {
  const R = window.__range;
  const p = R.player;
  const keys = new Set();
  const pressed = new Set();
  const log = [];
  let phase = "run";
  let climbFrames = 0;
  let jumpedAt = -1;
  let armed = false;
  R.setScript(
    { held: (a) => keys.has(a), pressedNow: (a) => pressed.has(a) },
    (now) => {
      pressed.clear();
      const x = p.pos.x, y = p.pos.y;
      if (phase === "run") {
        keys.add("forward");
        // sprint is a press (toggle), as the game's default
        if (!armed) { pressed.add("sprint"); armed = true; }
        if (x > 31.3) { pressed.add("jump"); jumpedAt = now; keys.delete("forward"); phase = "air"; log.push("jump at x " + x.toFixed(2) + " speed " + (p.speed / 0.0254).toFixed(0)); }
      } else if (phase === "air") {
        if (p.stance === "climb") { phase = "climb"; log.push("attached at y " + y.toFixed(2)); }
        else if (p.onGround && now - jumpedAt > 0.3) { phase = "done"; log.push("landed without attaching, x " + x.toFixed(2) + " y " + y.toFixed(2)); }
      } else if (phase === "climb") {
        climbFrames++;
        // press jump once the feet are in the green band (0.48 .. 1.19 m up)
        if (y > 0.5 && y < 1.15 && climbFrames > 2) { pressed.add("jump"); phase = "bounced"; log.push("jump off at y " + y.toFixed(2) + " after " + climbFrames + " frames"); }
        else if (p.stance !== "climb") { phase = "done"; log.push("fell off the wall at y " + y.toFixed(2) + " after " + climbFrames + " frames"); }
      } else if (phase === "bounced") {
        if (p.onGround) { phase = "done"; log.push("landed at x " + x.toFixed(2)); }
      }
    }
  );
  window.__probe = { log, done: () => phase === "done", phase: () => phase };
})()`;

async function main(): Promise<void> {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--mute-audio", "--no-sandbox", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
  });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.log("PAGE ERROR", String(e)));
    await page.goto(URL);
    await page.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 60000 });
    await page.evaluate(`document.getElementById("overlay").classList.add("hidden")`);
    // at the take-off line's run-up, facing the right-hand wall (+x)
    await page.evaluate(`window.__range.player.teleport(26, 0, -19, -90)`);
    await page.evaluate("new Promise((r) => setTimeout(r, 300))");
    await page.evaluate(PLAN);
    await page.waitForFunction("window.__probe.done()", { polling: 100, timeout: 15000 }).catch(() => undefined);
    const out = await page.evaluate(`({ phase: window.__probe.phase(), log: window.__probe.log, tech: window.__range.techLog.map((t) => t.name + " " + t.detail), pos: [window.__range.player.pos.x, window.__range.player.pos.y, window.__range.player.pos.z], stance: window.__range.player.stance })`);
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await browser.close();
  }
}
void main();
