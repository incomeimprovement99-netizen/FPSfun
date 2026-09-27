// Every SpeedKills gun in every model it can be picked in (Phase 21 W9, gunpick.ts): picked on the Loadouts tab as
// a player picks it, then at the hip, in the sights and mid-reload, one picture a gun with a row a model, so a look
// finds a model that floats, points wrong, covers the sight or keeps its magazine in on a reload. It prints each
// model in hand and how many of its parts the reload moves (the pack splits only some builds into parts).
// Headless, never the real mouse or keyboard.
//
// Run: SHOT_URL=http://localhost:5196/ npx tsx tools/weapon-picks-sheet.ts [out prefix] [ids...]
import puppeteer from "puppeteer";
import skCfg from "../src/config/games/speedkills.json";

const URL = process.env.SHOT_URL ?? "http://localhost:5196/";
const OUT = process.argv[2] ?? "docs/updates/2026-09-28-picks";
const IDS = process.argv.length > 3 ? process.argv.slice(3) : skCfg.roster;
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const W = 1280;
const H = 720;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  page.on("pageerror", (e) => console.log("pageerror:", String(e)));
  await page.goto(`${URL}?game=speedkills&nointro`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("Boolean(window.__range) && window.__range.loaded()", { timeout: 60000 });
  await page.waitForFunction("window.__range.paidGuns().ready && window.__range.soldierReady() && window.__range.realArms()", { polling: 250, timeout: 90000 });
  await page.evaluate(`localStorage.removeItem("range.sk.guns")`);
  const sheet = await browser.newPage();
  for (const id of IDS) {
    const rows: string[][] = [];
    const notes: string[] = [];
    const count = (await page.evaluate(`(() => { const s = document.getElementById("slot0"); s.value = ${JSON.stringify(id)}; s.dispatchEvent(new Event("change")); return document.querySelectorAll("#gunModel0 option").length; })()`)) as number;
    for (let k = 0; k < count; k++) {
      await page.bringToFront();
      await page.evaluate(`(() => {
        const pick = (id, v) => { const s = document.getElementById(id); s.value = v; s.dispatchEvent(new Event("change")); };
        pick("slot0", ${JSON.stringify(id)});
        pick("gunModel0", "${k}");
        pick("gunSkin0", "0");
        document.getElementById("overlay").classList.add("hidden");
        const r = window.__range;
        r.input.locked = true;
        r.player.teleport(0, 0, 0, 0, 0);
        r.loadout.give(0, ${JSON.stringify(id)});
        r.setScript({ held: () => false, pressedNow: (a) => a === "slot1" }, null);
      })()`);
      await sleep(1500);
      await page.evaluate("window.__range.setScript(null)");
      const info = (await page.evaluate("window.__range.paidGuns()")) as { inHand: string | null; skin: string | null };
      const shots: string[] = [];
      shots.push(await page.screenshot({ encoding: "base64" }));
      await page.evaluate("window.__range.debugView.ads = 1");
      await sleep(700);
      shots.push(await page.screenshot({ encoding: "base64" }));
      await page.evaluate("window.__range.debugView.ads = null; window.__range.debugView.reload = 0.4");
      await sleep(700);
      shots.push(await page.screenshot({ encoding: "base64" }));
      const moving = (await page.evaluate("window.__range.gunParts()")) as { mag: number; bolt: number; pump: number } | null;
      await page.evaluate("window.__range.debugView.reload = null");
      rows.push(shots);
      notes.push(`model ${k + 1}: ${info.inHand} in ${info.skin}${moving ? `, the reload moves mag ${moving.mag}, bolt ${moving.bolt}, pump ${moving.pump}` : ""}`);
      console.log(`${id} ${notes[notes.length - 1]}`);
    }
    await sheet.bringToFront();
    await sheet.setViewport({ width: 3 * 480, height: rows.length * (270 + 24) + 10, deviceScaleFactor: 1 });
    await sheet.setContent(
      `<body style="margin:0;background:#111;font:14px sans-serif;color:#fff">` +
        rows.map((r, i) => `<div style="height:24px;line-height:24px;padding-left:6px">${id}: ${notes[i]}</div><div style="display:flex">${r.map((b) => `<img width="480" height="270" src="data:image/png;base64,${b}">`).join("")}</div>`).join("") +
        "</body>",
    );
    await sleep(300);
    await sheet.screenshot({ path: `${OUT}-${id}.png`, fullPage: true });
  }
  await page.evaluate(`localStorage.removeItem("range.sk.guns")`);
} finally {
  await browser.close();
}
