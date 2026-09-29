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
const URL = (process.env.LIVE_URL ?? "https://fpsfun.duckdns.org/").replace(/\/?$/, "/");
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
  // a load the page itself cancelled (closed or moved on mid-download: the bought soldier is 1.7 MB and starts
  // loading as the page opens) is not a failure; a file that is not there answers 404, and that is still caught
  page.on("requestfailed", (r) => {
    if (r.failure()?.errorText === "net::ERR_ABORTED") return;
    errors.push(`request failed: ${r.url()} (${r.failure()?.errorText ?? "?"})`);
  });
  page.on("response", (r) => {
    if (r.status() === 404) errors.push(`404: ${r.url()}`);
  });
  page.on("request", (r) => {
    if (/\/peerjs\//.test(r.url())) brokerHits.add(new globalThis.URL(r.url()).host);
  });
  await page.goto(`${URL}?norender`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 90000 });
  return page;
}

/** sign up in one browser, change a setting and sync; sign in from a second, clean browser and find it there */
async function accountFlow(browser: Browser, page: Page): Promise<void> {
  const stats = (p: Page) => ev(p, `document.querySelector('#tabs button[data-tab="stats"]').click()`);
  await stats(page);
  const offered = await page.waitForFunction(`!document.getElementById("accountSignedOut").hidden`, { polling: 200, timeout: 10000 }).then(() => true, () => false);
  check("accounts: the Stats tab offers to sign up or in (the site has the server)", offered, await ev<string>(page, `document.getElementById("accountStatus").textContent`));
  const name = `Dry ${Math.floor(Math.random() * 9000 + 1000)}`;
  await ev(page, `(() => { document.getElementById("accountName").value = "${name}"; document.getElementById("accountPass").value = "dry run pass"; document.getElementById("accountSignUp").click(); })()`);
  const signed = await page.waitForFunction(`!document.getElementById("accountSignedIn").hidden`, { polling: 200, timeout: 10000 }).then(() => true, () => false);
  const nameShown = await ev<string>(page, `document.getElementById("profileName").value`);
  check("accounts: signing up signs you in, and your name is the account's", signed && nameShown === name, `${nameShown}: ${await ev<string>(page, `document.getElementById("accountStatus").textContent`)}`);
  // a setting of this browser's, synced
  await ev(page, `(() => { localStorage.setItem("range.killcam", "0"); document.getElementById("accountSync").click(); })()`);
  const synced = await page.waitForFunction(`/Synced/.test(document.getElementById("accountStatus").textContent)`, { polling: 200, timeout: 10000 }).then(() => true, () => false);
  check("accounts: Sync now sends this browser's settings", synced);
  // a second browser with nothing saved signs in and gets them
  const ctx = await browser.createBrowserContext();
  const p2 = await ctx.newPage();
  p2.on("pageerror", (e) => errors.push(String(e)));
  await p2.goto(`${URL}?norender`, { waitUntil: "domcontentloaded" });
  await p2.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 90000 });
  await stats(p2);
  await p2.waitForFunction(`!document.getElementById("accountSignedOut").hidden`, { polling: 200, timeout: 10000 });
  const nav = p2.waitForNavigation({ timeout: 20000 }).catch(() => null);
  await ev(p2, `(() => { document.getElementById("accountName").value = "${name.toLowerCase()}"; document.getElementById("accountPass").value = "dry run pass"; document.getElementById("accountSignIn").click(); })()`);
  await nav;
  await p2.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 90000 });
  const there = await ev<{ killcam: string | null; name: string; signedIn: boolean }>(p2, `({ killcam: localStorage.getItem("range.killcam"), name: document.getElementById("profileName").value, signedIn: !!localStorage.getItem("range.account.v1") })`);
  check("accounts: another browser signs in and has the same settings and name", there.killcam === "0" && there.name === name && there.signedIn, JSON.stringify(there));
  await ctx.close();
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
    // the public build names a gun "Not" its real name (phase 13); a bare real name is the failure
    const bare = names.filter((n) => !/^Not /.test(n) && /R-301|Wingman|Glock|Kraber|Flatline|Peacekeeper/i.test(n));
    check('weapon names are the public build\'s ("Not R-301"), never bare', bare.length === 0, names.join(", "));
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
    // accounts, end to end through the page (the dry run's throwaway server only: this writes an account)
    // (and never on a real server, whatever the environment says: only this PC's dry run)
    if (process.env.ACCOUNTS_TEST === "1" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL)) await accountFlow(browser, host);
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
    // Twice, both times the first match after a deploy, the broker handed the host its code and then told the guest
    // there was no such match; a second Join a minute later went through (2026-09-28, 2026-09-29). Two restarts
    // followed at once by this check did not bring it back, so it is not the restart alone. It is let through once,
    // said out loud, and a second "no match" is a failure like any other.
    // (whichever comes first: in, or told there is no such match)
    const noMatch = await guest
      .waitForFunction(`window.__range.duel() !== null || /No match with that code/.test(document.getElementById("duelStatus").textContent)`, { polling: 200, timeout: 30000 })
      .then(async () => !(await ev<boolean>(guest, "window.__range.duel() !== null")), () => false);
    if (noMatch) {
      console.log("  --  the guest's first Join found no match with the host's code (seen twice right after a deploy): joining again");
      await sleep(3000);
      await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
    }
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
    // round 1 waits for everyone to click Play. Host and Join take a page in
    // by themselves (the lock under a test tool is pretend, input.ts); a page
    // still on the menu presses a fake controller's Start for the click, and
    // one already in does not, or Start would open its menu
    for (const p of [host, guest]) {
      if (await ev<boolean>(p, "window.__range.input.playing")) continue;
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
    // here and not after: a check that fails part way returns out of the try, and the verdict after the finally was
    // never reached, so the process ended with 0 and the deploy called a failed live check live (2026-09-29)
    console.log(fails === 0 ? "\nLIVE CHECK PASS" : `\nLIVE CHECK FAIL (${fails})`);
    process.exit(fails === 0 ? 0 : 1);
  }
}
void main();
