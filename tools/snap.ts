// Screenshots of named scenarios, drawn for real (the e2e runs without
// drawing, so HUD code only runs here): set something up in the page, wait,
// take the picture, and fail on any page error. For judging the HUD and the
// effects this phase adds rather than claiming them.
//
// Run: npx tsx tools/snap.ts                 every scenario
//      SNAP=ability-br,recap npx tsx tools/snap.ts
// (needs `npm run dev` already running; pictures go to shots/, not in git)
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer, { type Page } from "puppeteer";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const OUT = resolve(HERE, "..", "shots");
const BASE = process.env.SHOT_URL ?? "http://localhost:5173/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ev = <T>(page: Page, expr: string) => page.evaluate(expr) as Promise<T>;

interface Scenario {
  name: string;
  note: string;
  /** page query (e.g. ?net=local) */
  query?: string;
  /** steps: an expression to run, then a wait in ms */
  steps: Array<[string, number]>;
}

const hideMenu = `document.getElementById("overlay").classList.add("hidden")`;
/** a fake controller whose Start plays (a scripted page gets no pointer lock), and its trigger */
const fakePad = `(() => { const btn = () => ({ pressed: false, touched: false, value: 0 }); const pad = { index: 0, id: "fake pad", connected: true, mapping: "standard", timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn) }; window.__pad = pad; navigator.getGamepads = () => [pad]; })()`;
const padButton = (i: number, on: boolean) => `(() => { window.__pad.buttons[${i}].pressed = ${on}; window.__pad.buttons[${i}].value = ${on ? 1 : 0}; })()`;
/** a step that waits in the page until the match's fight is on */
const untilFight = `new Promise((r) => { const t = setInterval(() => { if (window.__range.duel()?.phase === "fight") { clearInterval(t); r(0); } }, 50); setTimeout(() => { clearInterval(t); r(0); }, 20000); })`;

/** the same for a battle royale, whose drop takes longer */
const untilFightLong = untilFight.replace("20000", "60000");

export const SCENARIOS: Scenario[] = [
  {
    name: "ability-range",
    note: "the range: the compact ability line; then JOLT picked, the slot with its key",
    steps: [
      [hideMenu, 300],
      [`window.__range.pickAbility("jolt")`, 200],
      [`window.__range.useAbility()`, 120],
    ],
  },
  {
    name: "ability-range-card",
    note: "the range before any pick: the one-line card",
    steps: [[hideMenu, 400]],
  },
  {
    name: "ability-bots-card",
    note: "a bot match with abilities on: the full card at the countdown",
    steps: [
      [`(() => { const s = document.getElementById("botAbilities"); s.value = "1"; s.dispatchEvent(new Event("change")); ${hideMenu}; window.__range.startBots(); })()`, 900],
    ],
  },
  {
    name: "killcam",
    note: "eliminated by a bot: the replay from its eyes",
    steps: [
      [`(() => { ${hideMenu}; document.getElementById("botDifficulty").value = "easy"; window.__range.startBots(); })()`, 0],
      [untilFight, 200],
      [`(() => { window.__range.landHit(1, 20, true, "r97", 14); const d = window.__range.duel(); d.takeHit(60, d.bots[0], "rspn101", 24); d.takeHit(200, d.bots[0], "rspn101", 22); })()`, 1800],
    ],
  },
  {
    name: "recap",
    note: "after the killcam: the death recap",
    steps: [
      [`(() => { ${hideMenu}; document.getElementById("botDifficulty").value = "easy"; window.__range.startBots(); })()`, 0],
      [untilFight, 200],
      [`(() => { window.__range.landHit(1, 20, true, "r97", 14); window.__range.landHit(1, 15, false, "r97", 14); const d = window.__range.duel(); d.takeHit(60, d.bots[0], "rspn101", 24); d.takeHit(200, d.bots[0], "rspn101", 22); })()`, 300],
      [`window.__range.skipKillcam()`, 400],
    ],
  },
  {
    name: "gun-lstar-heat",
    note: "the L-STAR's heat bar and an energy stockpile's percentage (counted ammo)",
    steps: [
      [`(() => { ${hideMenu}; const s = document.getElementById("rangeAmmo"); s.value = "counted"; s.dispatchEvent(new Event("change")); const l = window.__range.loadout; l.setWeaponId(0, "lstar"); l.slots[0].state.clip = 7; })()`, 500],
    ],
  },
  {
    name: "gun-havoc-charge",
    note: "the HAVOC winding up: the ring round the crosshair",
    steps: [
      [`(() => { ${hideMenu}; const l = window.__range.loadout; l.setWeaponId(0, "energy_ar"); l.slots[0].state.charge = 0.6; l.slots[0].state.update = ((f) => function (...a) { const r = f.apply(this, a); this.charge = 0.6; return r; })(l.slots[0].state.update); })()`, 500],
    ],
  },
  {
    name: "gun-bocek-drawn",
    note: "the Bocek, drawn most of the way",
    steps: [
      [`(() => { ${hideMenu}; const l = window.__range.loadout; l.setWeaponId(0, "bocek"); const st = l.slots[0].state; st.update = ((f) => function (...a) { const r = f.apply(this, a); this.drawFrac = 0.8; return r; })(st.update); })()`, 1200],
    ],
  },
  {
    name: "gun-nemesis",
    note: "the Nemesis in hand",
    steps: [[`(() => { ${hideMenu}; window.__range.loadout.setWeaponId(0, "nemesis"); })()`, 1200]],
  },
  {
    name: "spray-wall",
    note: "the spray wall after a burst from the mark: your hits and the gun's own pattern",
    steps: [
      [fakePad, 800],
      [padButton(9, true), 400],
      [padButton(9, false), 400],
      [`(() => { const p = window.__range.player; p.teleport(13.45, 0, -64, -90); p.pitch = 1.2; window.__range.sprayWall.clear(); })()`, 300],
      [padButton(7, true), 900],
      [padButton(7, false), 700],
    ],
  },
  {
    name: "flick-drill",
    note: "the flick drill running: a figure out in the cone, the clock",
    steps: [[`document.getElementById("goDrill").click()`, 0], [hideMenu, 4200]],
  },
  {
    name: "ability-triage",
    note: "TRIAGE picked in a bot match: the passive slot",
    steps: [
      [`(() => { const s = document.getElementById("botAbilities"); s.value = "1"; s.dispatchEvent(new Event("change")); ${hideMenu}; window.__range.startBots(); })()`, 600],
      [`window.__range.pickAbility("triage")`, 3200],
    ],
  },
  {
    name: "br-loot",
    note: "a battle royale with nothing: fists, the floor's items (a gun, a purple beam, heals, ammo), the TAKE prompt",
    steps: [
      [`(() => { document.getElementById("brStart").value = "loot"; document.getElementById("brBots").value = "3"; ${hideMenu}; document.getElementById("goBr").click(); })()`, 0],
      [untilFightLong, 400],
      [
        `(() => { const r = window.__range; const d = r.duel(); d.holdFire = true; r.pickAbility("jolt"); const s = r.openGround(r.player.pos.x, r.player.pos.z, 7); r.player.teleport(s.x, 0, s.z, 0, -28); const f = d.lootField; const V = (x, z) => new r.THREE.Vector3(s.x + x, 0, s.z + z);
          f.add({ kind: "weapon", id: "r97", n: 1, rarity: "rare" }, V(0, -1.7));
          f.add({ kind: "weapon", id: "bocek", n: 1, rarity: "epic", mag: 2 }, V(-1.6, -4));
          f.add({ kind: "heal", id: "battery", n: 1, rarity: "rare" }, V(1.4, -3.2));
          f.add({ kind: "ammo", id: "light", n: 60, rarity: "common" }, V(0.6, -4.8));
          f.add({ kind: "helmet", id: "gold", n: 1, rarity: "legendary" }, V(2.6, -5.6));
          r.setScript({ held: () => false, pressedNow: () => false }); })()`,
        900,
      ],
    ],
  },
  {
    name: "br-downed",
    note: "down, not out: the bleed-out clock and the crawl, a squad mate's ping on screen",
    steps: [
      [`(() => { document.getElementById("brStart").value = "loot"; document.getElementById("brBots").value = "3"; ${hideMenu}; document.getElementById("goBr").click(); })()`, 0],
      [untilFightLong, 400],
      [
        `(() => { const r = window.__range; const d = r.duel(); d.holdFire = true; r.pickAbility("triage"); const s = r.openGround(r.player.pos.x, r.player.pos.z, 7); r.player.teleport(s.x, 0, s.z, 0, 0); d.downed = true; d.bleedUntil = performance.now() / 1000 + 71.4; r.brPlay.addMarker("go", new r.THREE.Vector3(s.x + 6, 0, s.z - 30), "GOING HERE", 1, -1, r.gameTime()); r.setScript({ held: () => false, pressedNow: () => false }); })()`,
        900,
      ],
    ],
  },
  {
    name: "br-map-icons",
    note: "the full map: jump towers, respawn beacons, a care package falling, pings, the rings",
    steps: [
      [`(() => { document.getElementById("brStart").value = "loot"; document.getElementById("brBots").value = "3"; ${hideMenu}; document.getElementById("goBr").click(); })()`, 0],
      [untilFightLong, 400],
      [
        `(() => { const r = window.__range; const d = r.duel(); d.holdFire = true; r.pickAbility("jolt"); const p = r.player.pos; d.addPod(new r.THREE.Vector3(p.x + 40, 0, p.z - 30), 30); r.brPlay.addMarker("enemy", new r.THREE.Vector3(p.x - 30, 0, p.z - 50), "ENEMY", 0, -1, r.gameTime()); r.brPlay.addMarker("loot", new r.THREE.Vector3(p.x + 15, 0, p.z + 20), "LOOT", 0, -1, r.gameTime()); r.setScript({ held: () => false, pressedNow: () => false }); r.setMapOpen(true); })()`,
        700,
      ],
    ],
  },
];

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const only = (process.env.SNAP ?? "").split(",").filter(Boolean);
  const list = SCENARIOS.filter((s) => !only.length || only.includes(s.name));
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars", "--mute-audio", "--no-sandbox"],
  });
  let bad = 0;
  try {
    for (const sc of list) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String((e as Error).message ?? e)));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.evaluateOnNewDocument(() => localStorage.setItem("range.welcomed", "1"));
      await page.goto(BASE + (sc.query ?? ""), { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 60000 });
      await sleep(1500);
      for (const [expr, wait] of sc.steps) {
        await ev(page, expr);
        await sleep(wait);
      }
      await page.screenshot({ path: resolve(OUT, `${sc.name}.png`) });
      const ok = errors.length === 0;
      if (!ok) bad++;
      console.log(`${ok ? "  ok  " : "FAIL  "}${sc.name.padEnd(22)} ${sc.note}${ok ? "" : `: ${errors.slice(0, 3).join(" | ")}`}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log(bad ? `\nSNAP FAIL (${bad})` : "\nSNAP PASS");
  process.exit(bad ? 1 : 0);
}

if (process.argv[1]?.endsWith("snap.ts")) void main();
