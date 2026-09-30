// SpeedKills from opening the page to riding the dropship, as a player sees it: every frame the page paints (Chrome's
// screencast) and, every 100 ms beside them, what the game is doing (the loading screen and its line, the card, the
// match's phase, the ship and its doors). Then one sheet of a frame every 5% of the way from Start to the ship, each
// marked with its time and that state, so the order of things is one picture to look at.
//
// Built for the owner's question (2026-09-30): "you can't test the full end to end flow with screenshots capturing
// frames every like 5% to tell?" It found the card over the range, the gun on black and a 6.8 s freeze on the ship
// (Milestone 359). Headless on the GPU, never the real mouse or keyboard.
//
// Run: SHOT_URL=http://localhost:5199/ npx tsx tools/flow-frames.ts
//   OUT=<folder> (default shots/flow), QUERY=<page query> (default ?game=speedkills), GL=d3d11 | swiftshader,
//   RIDE=<seconds on the ship after boarding> (6), STEPS=<frames on the sheet less one> (20)
import puppeteer from "puppeteer";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const URL = process.env.SHOT_URL ?? "http://localhost:5173/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = resolve(process.env.OUT ?? "shots/flow");
const QUERY = process.env.QUERY ?? "?game=speedkills";
const GL = process.env.GL ?? "d3d11";
const RIDE = Number(process.env.RIDE ?? 6);
const STEPS = Number(process.env.STEPS ?? 20);
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
// what the game is doing, as a row beside the frames
const STATE = `(() => { const r = window.__range; if (!r) return null;
  const L = document.getElementById("loading"); const i = r.intro?.state?.(); const d = r.duel?.(); const now = performance.now() / 1000;
  return { screen: !!L && !L.hidden && !L.classList.contains("done"), line: document.getElementById("loadingStatus")?.textContent ?? "",
    card: i?.kind ?? null, cardAt: i ? +i.at.toFixed(2) : null, phase: d?.phase ?? null, aboard: r.player?.aboard ?? false,
    doorsIn: d?.ship ? +d.ship.doorsIn(now).toFixed(2) : null }; })()`;

type Row = { t: number; screen: boolean; line: string; card: string | null; cardAt: number | null; phase: string | null; aboard: boolean; doorsIn: number | null };

async function capture(): Promise<{ frames: Array<{ i: number; t: number }>; rows: Row[]; marks: Array<{ t: number; what: string }> }> {
  mkdirSync(OUT, { recursive: true });
  const gl = GL === "swiftshader" ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--use-gl=angle", `--use-angle=${GL}`, "--enable-gpu", "--ignore-gpu-blocklist"];
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: [...gl, "--no-sandbox", "--mute-audio", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
  const frames: Array<{ i: number; t: number }> = [];
  const rows: Row[] = [];
  const marks: Array<{ t: number; what: string }> = [];
  try {
    const p = await browser.newPage();
    await p.setViewport({ width: 960, height: 540 });
    await p.evaluateOnNewDocument(NO_REAL_MOUSE);
    const cdp = await p.createCDPSession();
    const t0 = Date.now();
    const mark = (what: string) => marks.push({ t: Date.now() - t0, what });
    cdp.on("Page.screencastFrame", (f: { data: string; sessionId: number }) => {
      const i = frames.length;
      frames.push({ i, t: Date.now() - t0 });
      writeFileSync(`${OUT}/f${String(i).padStart(4, "0")}.jpg`, Buffer.from(f.data, "base64"));
      void cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 60, everyNthFrame: 1 });
    mark("the page opened");
    await p.goto(`${URL}${QUERY}`, { waitUntil: "domcontentloaded" });
    let stop = false;
    const sampler = (async () => {
      while (!stop) {
        const s = (await p.evaluate(STATE).catch(() => null)) as Omit<Row, "t"> | null;
        if (s) rows.push({ t: Date.now() - t0, ...s });
        await new Promise((r) => setTimeout(r, 100));
      }
    })();
    await p.waitForFunction(`(() => { const L = document.getElementById("loading"); return window.__range && (!L || L.hidden || L.classList.contains("done")); })()`, { polling: 200, timeout: 180000 });
    mark("the loading screen gone");
    await new Promise((r) => setTimeout(r, 1500));
    // Battle Royale, Start, as a player clicks it; the pointer as a real click takes it (a test's click is no gesture a
    // browser gives the pointer for), and the menu put away as a real lock does
    mark("Start");
    await p.evaluate(`(() => { document.getElementById("goBr").click(); document.getElementById("startMode").click(); window.__range.input.locked = true; document.getElementById("overlay").style.display = "none"; })()`);
    await p.waitForFunction(`window.__range.player.aboard || window.__range.player.dropping`, { polling: 100, timeout: 120000 }).then(() => mark("aboard"), () => mark("never aboard"));
    await new Promise((r) => setTimeout(r, RIDE * 1000));
    mark("the end");
    stop = true;
    await sampler;
    await cdp.send("Page.stopScreencast");
  } finally {
    await browser.close();
  }
  writeFileSync(`${OUT}/frames.json`, JSON.stringify(frames));
  writeFileSync(`${OUT}/log.json`, JSON.stringify(rows));
  writeFileSync(`${OUT}/marks.json`, JSON.stringify(marks));
  return { frames, rows, marks };
}

/** the sheet: from `from` to `to` ms, the last frame painted at each 5% step and what the game was doing then */
async function sheet(frames: Array<{ i: number; t: number }>, rows: Row[], marks: Array<{ t: number; what: string }>, from: number, to: number, name: string): Promise<string> {
  const cells: string[] = [];
  for (let k = 0; k <= STEPS; k++) {
    const at = from + ((to - from) * k) / STEPS;
    let f = frames[0];
    for (const x of frames) if (x.t <= at) f = x;
    let s: Row | undefined;
    for (const x of rows) if (x.t <= at) s = x;
    const what = s ? [s.screen ? `LOADING SCREEN "${s.line}"` : "", s.card ? `CARD ${s.cardAt}` : "", s.phase ?? "menu or range", s.aboard ? `ship, doors ${s.doorsIn}` : ""].filter(Boolean).join(" · ") : "";
    const mark = marks.filter((m) => m.t <= at).pop()?.what ?? "";
    const src = `data:image/jpeg;base64,${readFileSync(`${OUT}/f${String(f.i).padStart(4, "0")}.jpg`).toString("base64")}`;
    cells.push(`<figure><img src="${src}"><figcaption><b>${Math.round((k * 100) / STEPS)}%</b> ${(at / 1000).toFixed(2)} s (frame ${f.i} at ${(f.t / 1000).toFixed(2)})<br>${what}<br><i>${mark}</i></figcaption></figure>`);
  }
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#111;color:#eee;font:12px sans-serif;display:grid;grid-template-columns:repeat(5,384px);gap:6px;padding:6px}figure{margin:0}img{width:384px;height:216px;display:block}figcaption{padding:2px 0 4px;line-height:1.3}i{color:#9cf}</style>${cells.join("")}`;
  writeFileSync(`${OUT}/${name}.html`, html);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  try {
    const p = await browser.newPage();
    await p.setViewport({ width: 5 * 384 + 36, height: 800 });
    await p.goto(`file:///${OUT.replace(/\\/g, "/")}/${name}.html`);
    await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  } finally {
    await browser.close();
  }
  return `${OUT}/${name}.png`;
}

const { frames, rows, marks } = await capture();
const at = (what: string) => marks.find((m) => m.what === what)?.t;
console.log(`${frames.length} frames, ${rows.length} states; ${marks.map((m) => `${m.what} at ${(m.t / 1000).toFixed(1)} s`).join(", ")}`);
// the whole of it, and from Start to the ship
console.log(await sheet(frames, rows, marks, 0, frames[frames.length - 1].t, "sheet"));
const start = at("Start");
if (start !== undefined) console.log(await sheet(frames, rows, marks, start - 200, (at("the end") ?? frames[frames.length - 1].t), "start-to-ship"));
// what the game was doing each time it changed, from Start: the order of things in words
const since = rows.filter((r) => start === undefined || r.t >= start - 200);
const say = (r: Row) => `${r.screen ? "loading screen" : r.card ? "card" : r.phase ? (r.aboard ? `ship (doors ${r.doorsIn})` : r.phase) : "menu"}`;
const steps = since.filter((r, i) => i === 0 || say(r).replace(/ \(doors [^)]*\)/, "") !== say(since[i - 1]).replace(/ \(doors [^)]*\)/, ""));
console.log(`the order: ${steps.map((r) => `${say(r)} at ${(r.t / 1000).toFixed(1)} s`).join(" -> ")}`);
