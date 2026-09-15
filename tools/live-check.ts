// The deployed site, checked the way a friend would use it: two browser pages
// open the live URL, one makes a match, the other joins by code over the real
// broker, both connect, the countdown ends and a hit lands. Also the page
// loads with its textures and props and no errors.
//
// Run: npx tsx tools/live-check.ts   (LIVE_URL overrides the default)
// On our own server (server/game/serve.mjs) the match must go through the
// site's own broker; on GitHub Pages through the public one. BROKER=own or
// BROKER=public makes that a check; without it the line is informational.
import puppeteer, { type Browser, type Page } from "puppeteer";

const CHROME = process.env.CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = (process.env.LIVE_URL ?? "https://incomeimprovement99-netizen.github.io/FPSfun/").replace(/\/?$/, "/");
let fails = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
};
const ev = <T>(page: Page, expr: string) => page.evaluate(expr) as Promise<T>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const errors: string[] = [];
/** the broker's id requests: our own server's /peerjs/, or the public 0.peerjs.com */
const brokerHits = new Set<string>();

async function open(browser: Browser): Promise<Page> {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("requestfailed", (r) => errors.push(`request failed: ${r.url()}`));
  page.on("request", (r) => {
    if (/\/peerjs\//.test(r.url())) brokerHits.add(new globalThis.URL(r.url()).host);
  });
  await page.goto(`${URL}?norender`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 90000 });
  return page;
}

async function main(): Promise<void> {
  console.log(`\nLive site: ${URL}`);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    protocolTimeout: 120000,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--mute-audio", "--no-sandbox", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
  });
  try {
    const host = await open(browser);
    check("the page loads and the game starts", true);
    const names = await ev<string[]>(host, "[window.__range.loadout.slots[0].weapon.name, window.__range.loadout.slots[1].weapon.name]");
    check("weapon names are the public codenames", !/R-301|Wingman|Glock/i.test(names.join(" ")), names.join(", "));
    const tex = await ev<number>(host, "performance.getEntriesByType('resource').filter((r) => /tex\\/|models\\//.test(r.name)).length");
    check("textures and props were requested from the site", tex > 5, `${tex} asset requests`);
    if (process.env.BROKER === "own") {
      // read-only: the Stats tab finds the site's board (nothing is posted to a live board)
      await ev(host, `document.querySelector('#tabs button[data-tab="stats"]').click()`);
      const online = await host
        .waitForFunction(`/Online boards are on/.test(document.getElementById("statsOnline").textContent) && !document.getElementById("onlineCard").hidden`, { polling: 200, timeout: 10000 })
        .then(() => true, () => false);
      check("the Stats tab shows the site's online boards", online, await ev<string>(host, `document.getElementById("statsOnline").textContent`));
      await ev(host, `document.querySelector('#tabs button[data-tab="play"]').click()`);
    }
    const guest = await open(browser);
    await ev(host, `document.getElementById("duelHost").click()`);
    let code = "";
    try {
      await host.waitForSelector("#duelStatus .code", { timeout: 30000 });
      code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
      check("the host gets a match code from the broker", /^[A-Z0-9]{5}$/.test(code), code);
    } catch {
      check("the host gets a match code from the broker", false, await ev<string>(host, `document.getElementById("duelStatus").textContent`));
      return;
    }
    await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    try {
      await host.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 40000 });
      await guest.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 40000 });
      check("both sides connect over the internet", true);
      const site = new globalThis.URL(URL).host;
      const own = brokerHits.has(site);
      const which = own ? `this site's own broker (${site})` : `the public broker (${[...brokerHits].join(", ") || "none seen"})`;
      const want = process.env.BROKER;
      if (want === "own" || want === "public") check(`the match went through ${want === "own" ? "our own" : "the public"} broker`, own === (want === "own"), which);
      else console.log(`  --  broker: ${which}`);
    } catch {
      check("both sides connect over the internet", false, await ev<string>(guest, `document.getElementById("duelStatus").textContent`));
      return;
    }
    // round 1 waits for everyone to click Play; a scripted page cannot take a
    // pointer lock, so a fake controller's Start stands in for the click
    for (const p of [host, guest]) {
      await ev(p, `(() => {
        const btn = () => ({ pressed: false, touched: false, value: 0 });
        const pad = { index: 0, id: "fake pad", connected: true, mapping: "standard", timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn) };
        window.__pad = pad;
        navigator.getGamepads = () => [pad];
      })()`);
      // a page behind another tab gets no animation frames to wait on; the
      // game ticks on a timer, so a short hold does it
      await sleep(300);
      await ev(p, "window.__pad.buttons[9].pressed = true");
      await sleep(300);
      await ev(p, "window.__pad.buttons[9].pressed = false");
      await sleep(300);
    }
    await host.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 20000 });
    check("the countdown ends once both have clicked Play", true);
    await sleep(1000);
    await ev(host, "(() => { const d = window.__range.duel(); d.localHit(d.remoteOf(d.avatars[0]), 50, false); })()");
    const hit = await guest.waitForFunction("window.__range.duel().shield < 75", { polling: 200, timeout: 10000 }).then(() => true, () => false);
    check("a hit lands on the other side", hit);
    await ev(guest, "window.__range.duel().leave()");
    await host.waitForFunction("window.__range.duel() === null", { polling: 200, timeout: 15000 }).catch(() => undefined);
    check("leaving ends it for the host", (await ev<boolean>(host, "window.__range.duel() === null")));
    check("no page errors or failed requests", errors.length === 0, [...new Set(errors)].slice(0, 4).join(" | "));
  } finally {
    await browser.close();
  }
  console.log(fails === 0 ? "\nLIVE CHECK PASS" : `\nLIVE CHECK FAIL (${fails})`);
  process.exit(fails === 0 ? 0 : 1);
}
void main();
