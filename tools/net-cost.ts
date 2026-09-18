// What a match costs the host's upload, measured rather than estimated.
//
// Two real browser pages play over the real peer-to-peer path (the public
// PeerJS broker introduces them, then WebRTC runs between them), and the
// host's connection to the guest is read with getStats: the messages and
// bytes its data channel carried, and the packets and bytes that went out on
// the wire underneath (SCTP and DTLS inside the UDP payload, plus 28 bytes of
// UDP and IPv4 per packet on top). The upload is what caps a lobby in a star,
// because every guest's view of every other player comes out of the host.
//
// The same four matches run on any two builds, which is how a change to the
// state packets is measured against the build before it:
//   duel   a 1v1, both players running in circles and looking about
//   idle   the same 1v1 with both standing still
//   tdm    team deathmatch: the two of you and eight bots
//   br     a battle royale squad of two against eleven bots, after the drop
//
// Run: npx tsx tools/net-cost.ts          (needs the dev server running)
//   HOST_URL / GUEST_URL  the build each page loads (both default to SHOT_URL,
//                         else http://localhost:5173/), so an old host and a
//                         new guest can be measured together
//   COST_ONLY=duel,br     some of the matches
//   COST_SECONDS=12       how long each is measured for
import puppeteer, { type Browser, type Page } from "puppeteer";

const BASE = process.env.SHOT_URL ?? "http://localhost:5173/";
const HOST_URL = process.env.HOST_URL ?? BASE;
const GUEST_URL = process.env.GUEST_URL ?? BASE;
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SECONDS = Number(process.env.COST_SECONDS ?? 12);
const ONLY = (process.env.COST_ONLY ?? "").split(",").filter(Boolean);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ev = <T>(page: Page, expr: string) => page.evaluate(expr) as Promise<T>;

async function open(browser: Browser, url: string): Promise<Page> {
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 450, deviceScaleFactor: 1 });
  page.on("dialog", (d) => void d.accept());
  const u = new URL(url);
  u.searchParams.set("norender", "");
  await page.goto(u.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 60000 });
  await ev(page, `document.getElementById("welcomeOk")?.click()`);
  return page;
}

/** a fake gamepad's Start: "Click Play" for a page that cannot take the pointer */
async function pressPlay(page: Page): Promise<void> {
  if (await ev<boolean>(page, "window.__range.input.playing")) return;
  await ev(page, `(() => {
    if (!window.__pad) {
      const btn = () => ({ pressed: false, touched: false, value: 0 });
      const pad = { index: 0, id: "fake pad", connected: true, mapping: "standard", timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn) };
      window.__pad = pad;
      navigator.getGamepads = () => [pad];
    }
  })()`);
  await sleep(300);
  await ev(page, "window.__pad.buttons[9].pressed = true");
  await sleep(300);
  await ev(page, "window.__pad.buttons[9].pressed = false");
  await sleep(300);
}

/** run forward in a circle, turning and nodding: every number in the state packet changes every tick */
const RUN = `window.__range.setScript({ held: (a) => a === "forward", pressedNow: () => false }, (now, dt) => { const p = window.__range.player; p.yaw += 80 * dt; p.pitch = 12 * Math.sin(now * 1.3); })`;
const STAND = `window.__range.setScript(null)`;

/**
 * One end's connection as getStats sees it: the data channel's messages and
 * bytes, and the chosen candidate pair's packets and bytes (the UDP payload,
 * so SCTP and DTLS are in it). `link` is an expression for the Link.
 */
const STATS = (link: string) => `(async () => {
  const conn = ${link}?.conn;
  const pc = conn?.peerConnection;
  if (!pc) return null;
  const all = await pc.getStats();
  let dc = null, transport = null, pair = null;
  all.forEach((s) => { if (s.type === "data-channel") dc = s; if (s.type === "transport") transport = s; });
  all.forEach((s) => { if (s.type === "candidate-pair" && transport && s.id === transport.selectedCandidatePairId) pair = s; });
  if (!pair) all.forEach((s) => { if (s.type === "candidate-pair" && s.nominated && s.state === "succeeded") pair = s; });
  return { at: performance.now(), msgs: dc?.messagesSent ?? 0, payload: dc?.bytesSent ?? 0, packets: pair?.packetsSent ?? 0, udp: pair?.bytesSent ?? 0 };
})()`;

interface Snap {
  at: number;
  msgs: number;
  payload: number;
  packets: number;
  udp: number;
}

/** what went out per second between two snapshots */
function rate(a: Snap, b: Snap): { msgs: number; payload: number; packets: number; wire: number } {
  const s = (b.at - a.at) / 1000;
  const packets = (b.packets - a.packets) / s;
  return { msgs: (b.msgs - a.msgs) / s, payload: (b.payload - a.payload) / s, packets, wire: (b.udp - a.udp) / s + packets * 28 };
}

/** count what the host sends its guest by message type, so the bytes can be put down to something */
const COUNT = `(() => {
  const link = window.__range.duel().links.get(1);
  if (link.__counted) return;
  link.__counted = {};
  const send = link.send.bind(link);
  link.send = (m) => { link.__counted[m.t] = (link.__counted[m.t] ?? 0) + 1; send(m); };
})()`;

interface Row {
  name: string;
  host: ReturnType<typeof rate>;
  guest: ReturnType<typeof rate>;
  kinds: Record<string, number>;
  deltas: string;
}

async function measure(host: Page, guest: Page, name: string): Promise<Row | null> {
  await ev(host, COUNT);
  await ev(host, "window.__range.duel().links.get(1).__counted = {}");
  const h0 = await ev<Snap | null>(host, STATS("window.__range.duel().links.get(1)"));
  const g0 = await ev<Snap | null>(guest, STATS("window.__range.duel().hostLink"));
  await sleep(SECONDS * 1000);
  const h1 = await ev<Snap | null>(host, STATS("window.__range.duel().links.get(1)"));
  const g1 = await ev<Snap | null>(guest, STATS("window.__range.duel().hostLink"));
  if (!h0 || !h1 || !g0 || !g1) return null;
  const kinds = await ev<Record<string, number>>(host, "window.__range.duel().links.get(1).__counted");
  for (const k of Object.keys(kinds)) kinds[k] = Math.round(kinds[k] / SECONDS);
  // a build with delta packets says whether this pair of pages is using them
  const deltas = await ev<string>(host, `(() => { const s = window.__range.duel().sync; return s ? (s.speaksDeltas(1) ? "deltas" : "full packets") : "full packets (old build)"; })()`);
  return { name, host: rate(h0, h1), guest: rate(g0, g1), kinds, deltas };
}

/** host a match of `mode` with `bots`, join it, both press Play; the two pages, or null when the broker was not reachable */
async function connect(browser: Browser, setup: string): Promise<{ host: Page; guest: Page } | null> {
  const host = await open(browser, HOST_URL);
  const guest = await open(browser, GUEST_URL);
  await ev(host, `(() => { ${setup}; document.getElementById("duelHost").click(); })()`);
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 25000 });
  } catch {
    console.log(`  --  no match code: ${await ev<string>(host, `document.getElementById("duelStatus").textContent`)}`);
    await host.close();
    await guest.close();
    return null;
  }
  const code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
  await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
  try {
    for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 40000 });
  } catch {
    console.log(`  --  the two pages did not connect: ${await ev<string>(guest, `document.getElementById("duelStatus").textContent`)}`);
    await host.close();
    await guest.close();
    return null;
  }
  for (const p of [host, guest]) await pressPlay(p);
  return { host, guest };
}

const kB = (n: number): string => `${(n / 1024).toFixed(1)} kB/s`;
const kbit = (n: number): string => `${((n * 8) / 1000).toFixed(0)} kbit/s`;

function print(r: Row): void {
  console.log(`\n${r.name}  (${r.deltas})`);
  console.log(
    `  host to guest: ${r.host.msgs.toFixed(0)} messages/s, ${kB(r.host.payload)} of messages, ${r.host.packets.toFixed(0)} packets/s, ${kB(r.host.wire)} on the wire (${kbit(r.host.wire)})`
  );
  console.log(`  guest to host: ${r.guest.msgs.toFixed(0)} messages/s, ${kB(r.guest.payload)} of messages, ${r.guest.packets.toFixed(0)} packets/s, ${kB(r.guest.wire)} on the wire (${kbit(r.guest.wire)})`);
  console.log(`  what the host sent, a second: ${Object.entries(r.kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ")}`);
}

async function main(): Promise<void> {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    protocolTimeout: 120000,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--mute-audio", "--no-sandbox", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"],
  });
  const want = (k: string): boolean => !ONLY.length || ONLY.includes(k);
  console.log(`host ${HOST_URL}, guest ${GUEST_URL}, ${SECONDS} s a match`);
  try {
    if (want("duel") || want("idle")) {
      const c = await connect(browser, `document.getElementById("duelMode").value = "arena"`);
      if (c) {
        await Promise.all([c.host, c.guest].map((p) => p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 20000 })));
        if (want("duel")) {
          for (const p of [c.host, c.guest]) await ev(p, RUN);
          await sleep(1500);
          const r = await measure(c.host, c.guest, "1v1, both running");
          if (r) print(r);
        }
        if (want("idle")) {
          for (const p of [c.host, c.guest]) await ev(p, STAND);
          await sleep(2500);
          const r = await measure(c.host, c.guest, "1v1, both standing still");
          if (r) print(r);
        }
        await ev(c.guest, "window.__range.duel()?.leave()");
        await sleep(500);
        await c.host.close();
        await c.guest.close();
      }
    }
    if (want("tdm")) {
      const c = await connect(browser, `document.getElementById("duelMode").value = "tdm"; document.getElementById("modeBots").value = "5"`);
      if (c) {
        await Promise.all([c.host, c.guest].map((p) => p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 25000 })));
        for (const p of [c.host, c.guest]) await ev(p, RUN);
        await sleep(2000);
        const bots = await ev<number>(c.host, "window.__range.duel().bots.length");
        const r = await measure(c.host, c.guest, `team deathmatch, 2 players and ${bots} bots, both running`);
        if (r) print(r);
        await ev(c.guest, "window.__range.duel()?.leave()");
        await sleep(500);
        await c.host.close();
        await c.guest.close();
      }
    }
    if (want("br")) {
      const c = await connect(browser, `document.getElementById("duelMode").value = "br"; document.getElementById("brBots").value = "11"`);
      if (c) {
        await Promise.all([c.host, c.guest].map((p) => p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 250, timeout: 60000 })));
        for (const p of [c.host, c.guest]) await ev(p, RUN);
        await sleep(2000);
        const bots = await ev<number>(c.host, "window.__range.duel().bots.length");
        const r = await measure(c.host, c.guest, `battle royale squad, 2 players and ${bots} bots, both running`);
        if (r) print(r);
        await ev(c.guest, "window.__range.duel()?.leave()");
        await sleep(500);
        await c.host.close();
        await c.guest.close();
      }
    }
  } finally {
    await browser.close();
  }
}

void main();
