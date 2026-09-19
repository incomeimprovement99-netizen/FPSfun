// The eight-player rehearsal: a full lobby of friends, played for a minute
// over the real peer-to-peer path, before eight real people find what breaks.
//
// Eight browser pages join one battle royale through the public PeerJS broker
// (then WebRTC between them, the way friends play), split into four duos with
// three bot duos besides. Everyone lands, the guests run circles so every
// state stream changes every tick, and for a minute this measures what the
// host carries: its upload to each guest (getStats on each connection, the
// wire bytes of both data channels) and how long its match update takes each
// frame (the network, the bots, the ring). It fails if anyone cannot connect
// or land, if anyone does not see all seven others, or if any page logs an
// error.
//
// Run: npx tsx tools/rehearsal.ts   (needs the dev server running)
//   SHOT_URL             the build (default http://localhost:5173/)
//   PLAYERS=8            how many pages
//   REHEARSAL_SECONDS=60 how long it is measured for
import puppeteer, { type Browser, type Page } from "puppeteer";

const BASE = process.env.SHOT_URL ?? "http://localhost:5173/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PLAYERS = Math.max(2, Math.min(8, Number(process.env.PLAYERS ?? 8)));
const SECONDS = Number(process.env.REHEARSAL_SECONDS ?? 60);

const errors: string[] = [];
let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const ev = <T>(p: Page, js: string): Promise<T> => p.evaluate(js) as Promise<T>;

async function open(browser: Browser, i: number): Promise<Page> {
  const page = await browser.newPage();
  await page.setViewport({ width: 640, height: 360, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => errors.push(`page ${i}: ${String((e as Error).message ?? e)}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`page ${i} console: ${m.text()}`);
  });
  await page.evaluateOnNewDocument("window.__straightDrop = true; window.__noGulag = true");
  await page.goto(`${BASE}?norender&broker=public`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("!!window.__range", { timeout: 60000 });
  return page;
}

/** into the game as a click on Play would (the pad's Start: no real mouse or keyboard) */
async function pressPlay(page: Page): Promise<void> {
  if (await ev<boolean>(page, "window.__range.input.playing")) return;
  await ev(page, `(() => { if (!window.__pad) { const btn = () => ({ pressed: false, touched: false, value: 0 }); const pad = { index: 0, id: "fake pad", connected: true, mapping: "standard", timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn) }; window.__pad = pad; navigator.getGamepads = () => [pad]; } })()`);
  await sleep(300);
  await ev(page, "window.__pad.buttons[9].pressed = true");
  await sleep(300);
  await ev(page, "window.__pad.buttons[9].pressed = false");
}

/** one connection's wire bytes out so far (both data channels share its transport) */
const STATS = (link: string) => `(async () => {
  const pc = ${link}?.conn?.peerConnection;
  if (!pc) return null;
  const all = await pc.getStats();
  let transport = null, pair = null;
  all.forEach((s) => { if (s.type === "transport") transport = s; });
  all.forEach((s) => { if (s.type === "candidate-pair" && transport && s.id === transport.selectedCandidatePairId) pair = s; });
  if (!pair) all.forEach((s) => { if (s.type === "candidate-pair" && s.nominated && s.state === "succeeded") pair = s; });
  return pair ? { at: performance.now(), bytes: pair.bytesSent + pair.packetsSent * 28 } : null;
})()`;

async function main(): Promise<void> {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    protocolTimeout: 180000,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--mute-audio", "--no-sandbox", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"],
  });
  try {
    console.log(`The rehearsal: ${PLAYERS} players over the internet, split duos against bot duos`);
    const host = await open(browser, 0);
    await ev(host, `(() => { const t = document.getElementById("brTeam"); t.value = "duo"; t.dispatchEvent(new Event("change")); const b = document.getElementById("brBots"); b.value = "6"; b.dispatchEvent(new Event("change")); document.getElementById("brSides").value = "split"; document.getElementById("duelMode").value = "br"; document.getElementById("duelPlayers").value = "${PLAYERS}"; document.getElementById("duelHost").click(); })()`);
    const code = await host
      .waitForFunction(`(() => { const c = document.querySelector("#duelStatus .code"); return c && c.textContent; })()`, { polling: 200, timeout: 30000 })
      .then((h) => h.jsonValue() as Promise<string>, () => "");
    check("the host gets a code from the broker", /^[A-Z0-9]{5}$/.test(code), code);
    if (!code) return;
    const pages: Page[] = [host];
    for (let i = 1; i < PLAYERS; i++) {
      const g = await open(browser, i);
      pages.push(g);
      await ev(g, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
      await sleep(800);
    }
    const joined = await Promise.all(pages.map((p) => p.waitForFunction("window.__range.duel() !== null", { polling: 250, timeout: 60000 }).then(() => true, () => false)));
    check(`all ${PLAYERS} join one match`, joined.every(Boolean), JSON.stringify(joined));
    if (!joined.every(Boolean)) return;
    for (const p of pages) await pressPlay(p);
    const landed = await Promise.all(pages.map((p) => p.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 250, timeout: 90000 }).then(() => true, () => false)));
    check(`all ${PLAYERS} land`, landed.every(Boolean), JSON.stringify(landed));
    if (!landed.every(Boolean)) return;
    await ev(host, "window.__range.duel().holdFire = true");
    // the guests run circles and look about: every number in a state changes every tick
    for (const p of pages.slice(1)) await ev(p, `window.__range.setScript({ held: (a) => a === "forward", pressedNow: () => false }, (now, dt) => { const pl = window.__range.player; pl.yaw += 70 * dt; pl.pitch = 10 * Math.sin(now * 1.3); })`);
    await sleep(8000);
    const sees = await Promise.all(pages.map((p) => ev<number>(p, `(() => { const d = window.__range.duel(); const t = performance.now() / 1000; return [...d.remotes.values()].filter((r) => r.id < 100 && r.samples.length && t - r.lastHeard < 5).length; })()`)));
    check(`everyone sees the other ${PLAYERS - 1}`, sees.every((n) => n === PLAYERS - 1), sees.join(","));
    // a minute of it: the host's match update, frame by frame, and its upload to each guest
    await ev(host, `(() => { const d = window.__range.duel(); const up = d.update.bind(d); window.__costs = []; d.update = (l) => { const t = performance.now(); up(l); window.__costs.push(performance.now() - t); }; })()`);
    const ids = Array.from({ length: PLAYERS - 1 }, (_, i) => i + 1);
    const before = await Promise.all(ids.map((id) => ev<{ at: number; bytes: number } | null>(host, STATS(`window.__range.duel().links.get(${id})`))));
    await sleep(SECONDS * 1000);
    const after = await Promise.all(ids.map((id) => ev<{ at: number; bytes: number } | null>(host, STATS(`window.__range.duel().links.get(${id})`))));
    const perGuest = ids.map((_, i) => {
      const a = before[i];
      const b = after[i];
      return a && b ? (b.bytes - a.bytes) / ((b.at - a.at) / 1000) / 1024 : NaN;
    });
    const total = perGuest.reduce((s, x) => s + (Number.isFinite(x) ? x : 0), 0);
    const costs = await ev<number[]>(host, "window.__costs");
    costs.sort((a, b) => a - b);
    const q = (f: number) => costs[Math.min(costs.length - 1, Math.floor(costs.length * f))] ?? NaN;
    console.log(`  --  the host's upload: ${perGuest.map((x) => x.toFixed(1)).join(", ")} kB/s to its guests, ${total.toFixed(1)} kB/s (${Math.round(total * 8)} kbit/s) in all`);
    console.log(`  --  the host's match update: ${q(0.5).toFixed(2)} ms median, ${q(0.95).toFixed(2)} ms p95, ${q(0.99).toFixed(2)} ms p99 over ${costs.length} frames`);
    check("every guest's connection was measured", perGuest.every(Number.isFinite), perGuest.map((x) => x.toFixed(1)).join(","));
    const still = await Promise.all(pages.map((p) => ev<string | null>(p, "window.__range.duel()?.phase ?? null")));
    check(`all ${PLAYERS} still in the match after ${SECONDS} s`, still.every((s) => s === "fight"), still.join(","));
    check("no page logged an error", errors.length === 0, errors.slice(0, 5).join(" | "));
  } finally {
    await browser.close();
  }
  console.log(fails === 0 ? "\nREHEARSAL PASS" : `\nREHEARSAL FAIL (${fails})`);
  process.exit(fails === 0 ? 0 : 1);
}

void main();
