// The first person's pump, measured for the soldier to ride (BIGANTLER, Milestone 513). After a shot the bought arms
// play the KXG12's Pump clip and slide our pump with the left hand, `pumpScale` of the pack's stroke (fprig.ts, the guns
// agent's): a curve no config holds, since a clip makes it. The soldier has no bought arms, so it rides the same curve
// from samples of it: the shot held at each share of its rechamber (packRig().debugShot), the pump group's way along the
// gun read in the gun's own frame, which is the frame the soldier's copy of the gun moves its pump in.
//
// Run: SHOT_URL=http://localhost:5198/ npx tsx tools/figure-pump.ts [gun id, mastiff]
//   WRITE=1 writes the samples into src/config/soldierhold.json guns.<id>.pump.ride
// Headless, never the real mouse or keyboard.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const URL = process.env.SHOT_URL ?? "http://localhost:5198/";
const ID = process.argv[2] ?? "mastiff";
const WRITE = process.env.WRITE === "1";
const STEPS = 20;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CFG = path.join(HERE, "..", "src", "config", "soldierhold.json");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;

const PAGE = `(async () => {
  const r = window.__range, T = r.THREE, rig = r.packRig();
  const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const gw = async (s) => { const g0 = r.gameTime(); const t0 = performance.now(); while (r.gameTime() - g0 < s && performance.now() - t0 < 30000) await wait(20); };
  r.loadout.give(0, ${JSON.stringify(ID)}); r.loadout.requestSwap(0, r.gameTime()); await gw(2.5);
  // (the bought arms take the gun once its clips are in: until then the view's own arms hold it, and its pump is still)
  { const t0 = performance.now(); while (!rig.active && performance.now() - t0 < 60000) await wait(250); }
  if (!rig.active) return null;
  rig.debugStill = true; await gw(0.3);
  let gun = null; r.viewModelRoot().traverse((x) => { if (!gun && x.userData && x.userData.paid) gun = x; });
  const pump = gun && gun.getObjectByName("pump");
  if (!pump) return null;
  // (the left hand's palm, where the e2e's pump check reads it, in the gun's frame: it should ride with the pump)
  const g = rig.group;
  const palm = () => gun.worldToLocal(g.getObjectByName("hand_l").getWorldPosition(new T.Vector3()).lerp(g.getObjectByName("middle_01_l").getWorldPosition(new T.Vector3()), 0.55));
  rig.debugShot = null; await gw(0.3);
  const z0 = pump.position.z, h0 = palm();
  const ride = [], apart = [];
  for (let i = 0; i <= ${STEPS}; i++) {
    rig.debugShot = Math.min(0.999, i / ${STEPS}); await gw(0.12);
    ride.push(pump.position.z - z0);
    apart.push(Math.abs(palm().z - h0.z - (pump.position.z - z0)));
  }
  rig.debugShot = null; rig.debugStill = false;
  return { ride, apart, scale: gun.getWorldScale(new T.Vector3()).x };
})()`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 600000, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  page.on("pageerror", (e) => console.log("pageerror:", String(e)));
  await page.goto(`${URL}?game=speedkills&nointro`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction("window.__range && window.__range.loaded() && window.__range.paidGuns().ready && window.__range.soldierReady()", { polling: 250, timeout: 180000 });
  const got = (await page.evaluate(PAGE)) as { ride: number[]; apart: number[]; scale: number } | null;
  if (!got) throw new Error(`${ID}: the bought arms never took it, or its gun has no pump (a missing pack file: copy main's public/models/paid)`);
  const mm = (v: number) => Math.round(v * 10000) / 10;
  console.log(`${ID}: the pump's way along the gun over a shot's rechamber, mm (gun frame), at 0, 1/${STEPS}, ... 1:`);
  console.log(got.ride.map(mm).join(" "));
  console.log(`the left hand off the pump along it, most: ${mm(Math.max(...got.apart))} mm`);
  if (WRITE) {
    const raw = fs.readFileSync(CFG, "utf8");
    const cfg = JSON.parse(raw);
    const g = (cfg.guns[ID] ??= {});
    g.pump = {
      ...(g.pump ?? {}),
      _ride: `Measured by tools/figure-pump.ts, ${new Date().toISOString().slice(0, 10)}: the first person's pump along the gun after a shot (metres in the gun's own frame, + back toward the butt), at 0, 1/${STEPS}, ... 1 of the shot's rechamber; the soldier's pump and left hand ride it, and over the empty reload's pump (fparms.json packGuns reload.pump) as the first person's clip does. Measure again when the guns agent changes the pump (pumpScale, the Pump clip).`,
      ride: got.ride.map((v) => Math.round(v * 100000) / 100000),
    };
    fs.writeFileSync(CFG, JSON.stringify(cfg, null, 2).replace(/\n/g, raw.includes("\r\n") ? "\r\n" : "\n") + (raw.includes("\r\n") ? "\r\n" : "\n"));
    console.log(`wrote soldierhold.json guns.${ID}.pump.ride`);
  }
} finally {
  await browser.close();
}
