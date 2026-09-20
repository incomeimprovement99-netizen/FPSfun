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
  /** a battle royale starts on the dropship (the rest drop straight in, as the e2e does) */
  ship?: boolean;
}

const hideMenu = `document.getElementById("overlay").classList.add("hidden")`;
/** a fake controller whose Start plays (a scripted page gets no pointer lock), and its trigger */
const fakePad = `(() => { const btn = () => ({ pressed: false, touched: false, value: 0 }); const pad = { index: 0, id: "fake pad", connected: true, mapping: "standard", timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn) }; window.__pad = pad; navigator.getGamepads = () => [pad]; })()`;
const padButton = (i: number, on: boolean) => `(() => { window.__pad.buttons[${i}].pressed = ${on}; window.__pad.buttons[${i}].value = ${on ? 1 : 0}; })()`;
/** a step that waits in the page until the match's fight is on */
const untilFight = `new Promise((r) => { const t = setInterval(() => { if (window.__range.duel()?.phase === "fight") { clearInterval(t); r(0); } }, 50); setTimeout(() => { clearInterval(t); r(0); }, 20000); })`;

/** the same for a battle royale, whose drop takes longer */
const untilFightLong = untilFight.replace("20000", "60000");

/** wait in the page until `s` seconds of GAME time have passed (a software renderer draws a few frames a second, so wall time says little) */
const gameSeconds = (s: number) => `new Promise((r) => { const t0 = window.__range.gameTime(); const t = setInterval(() => { if (window.__range.gameTime() - t0 >= ${s}) { clearInterval(t); r(0); } }, 50); setTimeout(() => { clearInterval(t); r(0); }, 90000); })`;

/** the figure lab: standing aimed, walking, crouched, down and crawling, knocked out (the gun on the floor) */
const lab = (style: "robot" | "mannequin") =>
  `(async () => { ${hideMenu}; const r = window.__range; if (${style === "mannequin"}) { await r.loadMannequin(); } r.setFigureStyle("${style}"); const s = r.openGround(0, 40, 6); r.player.teleport(s.x, 0, s.z, 0, -12);
    r.figureLab([{ speed: 0, stance: "stand", pitch: 0, ads: 1 }, { speed: 7, stance: "stand", pitch: 0 }, { speed: 3.5, stance: "stand", pitch: 0 }, { speed: 0, stance: "crouch", pitch: 0 }, { speed: 1, stance: "downed", pitch: 0 }, { speed: 0, stance: "stand", pitch: 0, dead: true }], 4.5); })()`;

/** the rifle hold from the side: the left hand on each gun's handguard */
const holdLab = `(async () => { ${hideMenu}; const r = window.__range; await r.loadMannequin(); r.setFigureStyle("mannequin"); const s = r.openGround(0, 40, 6); r.player.teleport(s.x, 0, s.z, 0, -8);
    r.figureLab([{ speed: 0, stance: "stand", pitch: 0, ads: 1, weapon: "rspn101" }, { speed: 0, stance: "stand", pitch: 0, ads: 0, weapon: "vinson" }, { speed: 0, stance: "stand", pitch: 0, ads: 1, weapon: "energy_shotgun" }, { speed: 0, stance: "stand", pitch: 0, ads: 1, weapon: "wingman" }], 3.2, 90); })()`;

export const SCENARIOS: Scenario[] = [
  {
    name: "loading",
    note: "the loading screen, held part way: the name, the bar, the count and a tip",
    steps: [[`(() => { const e = document.getElementById("loading"); e.hidden = false; e.classList.remove("done"); document.getElementById("loadingFill").style.width = "42%"; document.getElementById("loadingStatus").textContent = "LOADING THE WORLD  ·  21 OF 50"; })()`, 400]],
  },
  {
    name: "readme-tv",
    note: "the README screen at the far end of the range, under its B00G'S RANGE sign, with the arrow plates beside it",
    steps: [
      [`(() => { ${hideMenu}; window.__range.player.teleport(0, 0, -96, 0, 6); })()`, 0],
      [gameSeconds(0.8), 200],
    ],
  },
  {
    name: "readme-tv-page",
    note: "the same screen a few pages in: a section jumped to, then two pages on",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.teleport(0, 0, -99.5, 0, 5); r.readmeTv.goto(3, 0); r.readmeTv.press("nextPage"); })()`, 0],
      [gameSeconds(0.8), 200],
    ],
  },
  {
    name: "arena-middle",
    note: "the 1v1 arena's new middle building over the capture circle, from a spawn: two storeys, the roof, the ziplines onto it",
    steps: [
      [`(() => { ${hideMenu}; document.getElementById("goArena").click(); })()`, 600],
      [`(() => { const r = window.__range; r.player.teleport(90, 0, -58, 180, 6); })()`, 0],
      [gameSeconds(1), 250],
    ],
  },
  {
    name: "arena-vault",
    note: "the Vault, the small two-storey arena for 1v1 and free-for-all, from a spawn at one end",
    steps: [
      [`(() => { ${hideMenu}; document.getElementById("goArena").click(); })()`, 600],
      [`(() => { const r = window.__range; r.player.setBounds({ minX: -86, maxX: -58, minZ: -64, maxZ: -32 }); r.player.teleport(-72, 0, -60.5, 180, 4); })()`, 0],
      [gameSeconds(1), 250],
    ],
  },
  {
    name: "arena-crossing",
    note: "the Crossing, the wide symmetric team arena, from one team's end",
    steps: [
      [`(() => { ${hideMenu}; document.getElementById("goArena").click(); })()`, 600],
      [`(() => { const r = window.__range; r.player.setBounds({ minX: -125, maxX: -67, minZ: -1, maxZ: 69 }); r.player.teleport(-96, 0, 2.5, 180, 4); })()`, 0],
      [gameSeconds(1), 250],
    ],
  },
  {
    name: "arena-ringworks",
    note: "the Ringworks, the open-sky free-for-all arena, from a spawn on its edge",
    steps: [
      [`(() => { ${hideMenu}; document.getElementById("goArena").click(); })()`, 600],
      [`(() => { const r = window.__range; r.player.setBounds({ minX: -95, maxX: -49, minZ: 89, maxZ: 135 }); r.player.teleport(-72, 0, 93, 180, 4); })()`, 0],
      [gameSeconds(1), 250],
    ],
  },
  {
    name: "arena-middle-roof",
    note: "the middle building from the side, at roof height: the two storeys, the roof lip and the ziplines",
    steps: [
      [`(() => { ${hideMenu}; document.getElementById("goArena").click(); })()`, 600],
      [`(() => { const r = window.__range; r.setThirdPerson(true); r.player.teleport(90 - 15.5, 4.2, -48, -90, -2); })()`, 0],
      [gameSeconds(1), 250],
    ],
  },
  {
    name: "inspect-mid",
    note: "the weapon inspect held at its first turn: the owner reports the arm stub ends up in the camera",
    steps: [
      [`(() => { ${hideMenu}; window.__range.debugView.inspect = 0.34; })()`, 0],
      [gameSeconds(0.8), 250],
    ],
  },
  {
    name: "inspect-late",
    note: "the weapon inspect at its second turn, showing the other side",
    steps: [
      [`(() => { ${hideMenu}; window.__range.debugView.inspect = 0.72; })()`, 0],
      [gameSeconds(0.8), 250],
    ],
  },
  {
    name: "br-town",
    note: "WEST TOWN: houses you can go inside, a street between the rows, roofs and a zipline off the water tower",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); r.player.teleport(-165 - 30, 0, 500 + 2, -90, 2); })()`, 0],
      [gameSeconds(1), 300],
    ],
  },
  {
    name: "br-rocks",
    note: "the field's cover on the north spoke: rocks, not boxes the colour of rock",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); r.player.teleport(0, 0, 500 - 40, 0, -8); })()`, 0],
      [gameSeconds(1), 300],
    ],
  },
  {
    name: "br-field",
    note: "the open field between the places: rock, dead scrub and the cliff face at the map's edge, none of it a box",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); r.player.teleport(-108, 4, 500 - 168, 0, -3); r.player.vel.set(0, 0, 0); })()`, 0],
      [gameSeconds(1), 400],
    ],
  },
  {
    name: "br-door",
    note: "a door in a doorway, shut: the panel, its handle, the frame round it",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); const d = r.brMap.doors.list.find((x) => x.side === "s" && x.centre.y < 3); r.player.teleport(d.centre.x + 1.2, d.centre.y - 1.3, d.centre.z + 3.2, 20, -4); })()`, 0],
      [gameSeconds(1), 300],
    ],
  },
  {
    name: "br-door-open",
    note: "the same door opened: swung in against the hinge side, the room behind it",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); const d = r.brMap.doors.list.find((x) => x.side === "s" && x.centre.y < 3); r.brMap.doors.set(d.i, true); r.player.teleport(d.centre.x + 1.2, d.centre.y - 1.3, d.centre.z + 3.2, 20, -4); })()`, 0],
      [gameSeconds(1), 300],
    ],
  },
  {
    name: "br-town-inside",
    note: "standing inside one of WEST TOWN's houses, looking out of the door",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); r.player.teleport(-179, 0, 492, 180, 0); })()`, 0],
      [gameSeconds(1), 300],
    ],
  },
  {
    name: "br-compound",
    note: "NORTHWEST FARM, one of the four new compounds filling the corners: walled, three buildings, a watch tower with a zipline out",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); r.player.teleport(-104, 0, 500 - 104 + 20, 180, 2); })()`, 0],
      [gameSeconds(1), 300],
    ],
  },
  {
    name: "br-road",
    note: "the road between the hub and NORTH YARD: roadside ruins, a culvert and container stacks where there was flat sand",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); r.player.teleport(4, 0, 500 - 62, 0, 1); })()`, 0],
      [gameSeconds(1), 300],
    ],
  },
  {
    name: "br-mast",
    note: "THE MAST from 70 m south: seven storeys, the lattice and the lamp, the hub round it",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); r.player.teleport(0, 0, 500 + (70), 0, 9); })()`, 0],
      [gameSeconds(1), 300],
    ],
  },
  {
    name: "br-mast-roof",
    note: "on the Mast's roof at 28 m, looking east over the bowl's berm toward East Ridge and its stack",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); r.player.teleport(0, 28.2, 500 + (0), -90, -6); })()`, 0],
      [gameSeconds(1), 300],
    ],
  },
  {
    name: "br-north-yard",
    note: "NORTH YARD from the south: the silo block and its drum, the two silos, the container runs",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); r.player.teleport(0, 0, 500 + (-136), 8, 7); })()`, 0],
      [gameSeconds(1), 300],
    ],
  },
  {
    name: "br-south-depot",
    note: "SOUTH DEPOT from the north: the portal crane with the name on its girder, the loading building, the walled bays",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); r.player.teleport(0, 0, 500 + (100), 180, 8); })()`, 0],
      [gameSeconds(1), 300],
    ],
  },
  {
    name: "br-notch",
    note: "the Notch from its west crest: the defile below, the east crest across it",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); r.player.teleport(-20, 6.2, 500 + (-120), -90, -8); })()`, 0],
      [gameSeconds(1), 300],
    ],
  },
  {
    name: "br-east-ridge",
    note: "EAST RIDGE from the hub side: the undercroft, the bunker on the terrace, the stack",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); r.player.teleport(110, 0, 500 + (10), -90, 7); })()`, 0],
      [gameSeconds(1), 300],
    ],
  },
  {
    name: "br-town-clock",
    note: "WEST TOWN from the east: the clocktower, the water tower, the houses with their roof stairs",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); r.player.teleport(-115, 0, 500 + (10), 90, 6); })()`, 0],
      [gameSeconds(1), 300],
    ],
  },
  {
    name: "br-edge",
    note: "the map's edge: the shelf and the 10 m cliff with a gate tower, where the posts used to be",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); r.player.teleport(-180, 0, 500 + (40), 90, 8); })()`, 0],
      [gameSeconds(1), 300],
    ],
  },
  {
    name: "br-site-crossing",
    note: "the Crossing from the road north of it: the broken bridge on its abutments, the pump house across the road",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); r.player.teleport(8, 0, 500 + (100), 110, 2); })()`, 0],
      [gameSeconds(1), 300],
    ],
  },
  {
    name: "br-site-table",
    note: "Table Station on the mesa, from below its west side: the relay house and the dish",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); r.player.teleport(80, 0, 500 + (-20), -63, 10); })()`, 0],
      [gameSeconds(1), 300],
    ],
  },
  {
    name: "br-site-sump",
    note: "the Sump from its own mesa top: four tanks, the catwalks between them, the pump house",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); r.player.teleport(-156, 5.1, 500 + (182), 90, 4); })()`, 0],
      [gameSeconds(1), 300],
    ],
  },
  {
    name: "br-site-motorpool",
    note: "Motor Pool from the hub side: the workshop, the truck hulks and the canopy",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.setBounds({ minX: -220, maxX: 220, minZ: 280, maxZ: 720 }); r.player.teleport(40, 0, 500 + (40), -135, 5); })()`, 0],
      [gameSeconds(1), 300],
    ],
  },
  {
    name: "control",
    note: "Control: the A B C strip and the scores, zone A taken, the zones in the arena",
    steps: [
      [`(() => { ${hideMenu}; document.getElementById("goControl").click(); })()`, 0],
      [untilFight, 100],
      [`(() => { const d = window.__range.duel(); d.holdFire = true; const z = d.hud().mode.control.zones[0].at; window.__range.player.teleport(z.x + 3, 0, z.z - 9, 180, -8); })()`, 0],
      [gameSeconds(1.5), 100],
      [`(() => { const d = window.__range.duel(); d.control.zones[0].owner = 0; d.control.zones[0].v = -1; d.control.zones[1].v = 0.45; })()`, 0],
      [gameSeconds(1), 100],
    ],
  },
  {
    name: "figures-crouch-close",
    note: "close up: a robot and a mannequin crouched and walking, from the side",
    steps: [[`(async () => { ${hideMenu}; const r = window.__range; await r.loadMannequin(); const s = r.openGround(0, 40, 6); r.player.teleport(s.x, 0, s.z, 0, -14); r.setFigureStyle("robot"); const a = r.figureLab([{ speed: 0, stance: "crouch", pitch: 0 }, { speed: 3.5, stance: "stand", pitch: 0 }], 2.6, 90); r.setFigureStyle("mannequin"); })()`, 0], [gameSeconds(1), 100]],
  },
  {
    name: "figures-hold-close",
    note: "close up, from the side: a mannequin holding the R-301, its left hand on the handguard",
    steps: [[`(async () => { ${hideMenu}; const r = window.__range; await r.loadMannequin(); r.setFigureStyle("mannequin"); const s = r.openGround(0, 40, 6); r.player.teleport(s.x, 0, s.z, 0, -18); r.figureLab([{ speed: 0, stance: "stand", pitch: 0, ads: 1, weapon: "rspn101" }], 1.7, 90); })()`, 0], [gameSeconds(1.2), 100]],
  },
  {
    name: "figures-hold",
    note: "mannequins from the side: the left hand on the R-301's, the Flatline's and the Peacekeeper's handguard; the Wingman two-handed",
    steps: [[holdLab, 0], [gameSeconds(1.2), 100]],
  },
  {
    name: "downed-view",
    note: "down, in first person: no gun, the hands low on the floor",
    steps: [[`(() => { ${hideMenu}; window.__range.debugView.downed = true; })()`, 0], [gameSeconds(0.6), 100]],
  },
  {
    name: "figures-robot",
    note: "the figure lab, robots: aimed, walking, crouched, down (no gun), knocked out (the gun on the floor)",
    steps: [[lab("robot"), 0], [gameSeconds(2.5), 100]],
  },
  {
    name: "figures-mannequin",
    note: "the figure lab, mannequins: aimed, walking, crouched, down (no gun), dead (its death clip, the gun on the floor)",
    steps: [[lab("mannequin"), 0], [gameSeconds(3), 100]],
  },
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
    name: "gun-finish-gold",
    note: "the R-301 in the Gold finish (the level for it reached): the body metal, the accents dark",
    steps: [[`(() => { ${hideMenu}; const r = window.__range; r.progress.s.xp = 1e7; r.progress.onChange?.(); r.loadout.setWeaponId(0, "rspn101"); const s0 = document.getElementById("slot0"); s0.value = "rspn101"; const f = document.getElementById("finish0"); f.value = "gold"; f.dispatchEvent(new Event("change")); })()`, 1200]],
  },
  {
    name: "gun-finish-arctic",
    note: "the R-301 in the Arctic finish",
    steps: [[`(() => { ${hideMenu}; const r = window.__range; r.progress.s.xp = 1e7; r.progress.onChange?.(); r.loadout.setWeaponId(0, "rspn101"); const s0 = document.getElementById("slot0"); s0.value = "rspn101"; const f = document.getElementById("finish0"); f.value = "arctic"; f.dispatchEvent(new Event("change")); })()`, 1200]],
  },
  {
    name: "gun-fov-wide",
    note: "the widest FOV setting: the world wide, the gun as it is at the default (its own camera)",
    steps: [[`(() => { ${hideMenu}; const f = document.getElementById("fov"); f.value = "1.571"; f.dispatchEvent(new Event("input")); window.__range.loadout.setWeaponId(0, "rspn101"); })()`, 1200]],
  },
  {
    name: "gun-fov-narrow",
    note: "the narrowest FOV setting: the gun still as it is at the default",
    steps: [[`(() => { ${hideMenu}; const f = document.getElementById("fov"); f.value = "1"; f.dispatchEvent(new Event("input")); window.__range.loadout.setWeaponId(0, "rspn101"); })()`, 1200]],
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
    name: "tracers",
    note: "a burst down the range, caught in flight: streaks from the muzzle joining the line of sight, not dots",
    steps: [
      [`(() => { ${hideMenu}; const r = window.__range; r.player.teleport(0, 0, 0, 0, 1); })()`, 600],
      [`(() => { const r = window.__range; for (let i = 0; i < 4; i++) setTimeout(() => r.fireRound([(i - 1.5) * 0.02, 0.01, -1]), i * 25); })()`, 110],
    ],
  },
  {
    name: "br-impacts",
    note: "a burst into the hub's north berm: bullet holes on its face, the dust off it",
    steps: [
      [`(() => { document.getElementById("brStart").value = "loadout"; document.getElementById("brBots").value = "3"; ${hideMenu}; document.getElementById("goBr").click(); })()`, 0],
      [untilFightLong, 400],
      [`(() => { const r = window.__range; const d = r.duel(); d.holdFire = true; r.pickAbility("jolt"); r.input.locked = true; r.player.teleport(24, 0, 500 - 36, 0, 6);
        for (let i = 0; i < 14; i++) setTimeout(() => r.fireRound([(Math.random() - 0.5) * 0.12, 0.02 + (Math.random() - 0.5) * 0.1, -1]), i * 30); })()`, 520],
    ],
  },
  {
    name: "br-bins",
    note: "supply bins: one closed (its lit seam) and one opened (lid up, what it held round it)",
    steps: [
      [`(() => { document.getElementById("brStart").value = "loot"; document.getElementById("brBots").value = "3"; ${hideMenu}; document.getElementById("goBr").click(); })()`, 0],
      [untilFightLong, 400],
      [
        `(() => { const r = window.__range; const d = r.duel(); d.holdFire = true; r.pickAbility("jolt"); const f = d.lootField; const bins = [...f.drops.values()].filter((x) => x.item.kind === "bin");
          const a = bins[0]; if (!a) return; d.takeLoot(a.key);
          const p = a.pos; r.player.teleport(p.x - 3.2, p.y, p.z + 1.2, 110, -22); r.setScript({ held: () => false, pressedNow: () => false }); })()`,
        900,
      ],
    ],
  },
  {
    name: "spray",
    note: "a spray on the wall in front of you: the icon cut out of a painted disc, its drips",
    steps: [
      [`(async () => { ${hideMenu}; const r = window.__range; r.player.teleport(-20, 0, 12, 90, -6); for (let yaw = 0; yaw < 360; yaw += 15) { r.player.yaw = yaw; await new Promise((ok) => setTimeout(ok, 80)); if (r.spray()) break; } })()`, 1200],
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
    name: "br-downed-3p",
    note: "down, seen in third person: the figure low and bent into a crawl, not a crouch",
    steps: [
      [`(() => { document.getElementById("brStart").value = "loot"; document.getElementById("brBots").value = "3"; ${hideMenu}; document.getElementById("goBr").click(); })()`, 0],
      [untilFightLong, 400],
      [
        `(() => { const r = window.__range; const d = r.duel(); d.holdFire = true; r.pickAbility("triage"); const s = r.openGround(r.player.pos.x, r.player.pos.z, 7); r.player.teleport(s.x, 0, s.z, 0, 0); d.downed = true; d.bleedUntil = performance.now() / 1000 + 71.4; r.setThirdPerson(true); r.setScript({ held: () => false, pressedNow: () => false }); })()`,
        1400,
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
  {
    name: "br-skydive",
    note: "the skydive after the map steps aside: the dive readout between glide and dive, the height, the hint",
    steps: [
      [`(() => { document.getElementById("brStart").value = "loot"; document.getElementById("brBots").value = "3"; ${hideMenu}; document.getElementById("goBr").click(); })()`, 300],
      [`(() => { const r = window.__range; r.player.pitch = -10; r.setScript({ held: () => false, pressedNow: () => false }); })()`, 0],
      [gameSeconds(2.8), 0],
      [`(() => { window.__range.player.pitch = -52; })()`, 400],
    ],
  },
  {
    name: "br-fullmap",
    note: "the full map after landing: the landforms shaded as steps, the places, the consoles, the rings",
    steps: [
      [`(() => { document.getElementById("brStart").value = "loadout"; document.getElementById("brBots").value = "3"; ${hideMenu}; document.getElementById("goBr").click(); })()`, 0],
      [untilFightLong, 400],
      [`(() => { const r = window.__range; r.duel().holdFire = true; r.setScript({ held: () => false, pressedNow: () => false }); r.setMapOpen(true); })()`, 700],
    ],
  },
  {
    name: "br-gulag",
    note: "the Gulag: in its room on the fight's two guns, the bot at the far end, the countdown held",
    steps: [
      [`(() => { document.getElementById("brStart").value = "loadout"; document.getElementById("brBots").value = "3"; ${hideMenu}; document.getElementById("goBr").click(); })()`, 0],
      [gameSeconds(0.5), 0],
      [`(() => { const p = window.__range.player.pos; window.__range.player.teleport(p.x, 0.5, p.z, 0, -4); })()`, 0],
      [untilFight, 300],
      [`(() => { const r = window.__range; const d = r.duel(); d.holdFire = true; r.setScript({ held: () => false, pressedNow: () => false }); d.takeHit(1000, d.bots[0].bot.remote.id); })()`, 0],
      [`new Promise((r) => { const t = setInterval(() => { const g = window.__range.duel().gulag; if (g && g.phase !== "wait") { clearInterval(t); g.fightAt = performance.now() / 1000 + 60; r(0); } }, 50); setTimeout(() => { clearInterval(t); r(0); }, 30000); })`, 900],
    ],
  },
  {
    name: "br-resurgence",
    note: "Resurgence, out and waiting: the redeploy countdown, and the clock to final deaths under the ring's",
    steps: [
      [`(() => { const r = document.getElementById("brRules"); r.value = "resurgence"; r.dispatchEvent(new Event("change")); document.getElementById("brStart").value = "loot"; document.getElementById("brBots").value = "3"; ${hideMenu}; document.getElementById("goBr").click(); })()`, 0],
      // put down on the ground rather than waiting out the drop, which a software renderer takes minutes over
      [gameSeconds(0.5), 0],
      [`(() => { const p = window.__range.player.pos; window.__range.player.teleport(p.x, 0.5, p.z, 0, -4); })()`, 0],
      [untilFight, 300],
      [`(() => { const r = window.__range; const d = r.duel(); d.holdFire = true; r.setScript({ held: () => false, pressedNow: () => false }); d.takeHit(1000, d.bots[0].bot.remote.id); })()`, 600],
      [`(() => { const d = window.__range.duel(); if (d.selfRedeploy) d.selfRedeploy.left = 12.4; })()`, 300],
      [`(() => { const r = document.getElementById("brRules"); r.value = "br"; r.dispatchEvent(new Event("change")); })()`, 100],
    ],
  },
  {
    name: "br-dropship",
    note: "aboard the dropship with the map closed: the chase camera behind the ship, the panel with the jump key and the clock",
    ship: true,
    steps: [
      [`(() => { document.getElementById("brStart").value = "loot"; document.getElementById("brBots").value = "3"; ${hideMenu}; document.getElementById("goBr").click(); })()`, 300],
      [gameSeconds(0.5), 0],
      // the ship runs on the wall clock and a software renderer is slow: pin it 6 s into the flight
      [`(() => { const r = window.__range; r.setScript({ held: () => false, pressedNow: () => false }); r.player.pitch = -14; r.player.yaw += 18; r.setMapOpen(false); r.ship().startAt = performance.now() / 1000 - 6; })()`, 500],
    ],
  },
  {
    name: "br-dropship-map",
    note: "aboard the dropship with the map up: the line flown and still to fly, the squad's place on it, the keys",
    ship: true,
    steps: [
      [`(() => { document.getElementById("brStart").value = "loot"; document.getElementById("brBots").value = "3"; ${hideMenu}; document.getElementById("goBr").click(); })()`, 300],
      [gameSeconds(0.5), 0],
      [`(() => { const r = window.__range; r.setScript({ held: () => false, pressedNow: () => false }); r.ship().startAt = performance.now() / 1000 - 7; })()`, 500],
    ],
  },
  {
    name: "mode-gunrun",
    note: "Gun Run against bots: your level and gun, the next one, the clock, the scoreboard",
    steps: [
      [fakePad, 600],
      [`(() => { document.getElementById("modeBots").value = "3"; window.__range.startMode("gunrun"); })()`, 400],
      [padButton(9, true), 300],
      [padButton(9, false), 300],
      [untilFight, 300],
      [`(() => { const d = window.__range.duel(); d.holdFire = true; const a = d.avatars[0]; const r = d.remoteOf(a); a.hit(0, "body", 900, 1, 1, a.group.position); d.localHit(r, 900, false, "rspn101", 9); })()`, 1400],
    ],
  },
  {
    name: "mode-tdm",
    note: "team deathmatch: the teams' score, team mates' green plates",
    steps: [
      [fakePad, 600],
      [`window.__range.startMode("tdm")`, 400],
      [padButton(9, true), 300],
      [padButton(9, false), 300],
      [untilFight, 300],
      [`(() => { const r = window.__range; const d = r.duel(); d.holdFire = true; d.teams.score[0] = 12; d.teams.score[1] = 9; r.player.teleport(90, 0, -60, 180); })()`, 1500],
    ],
  },
  {
    name: "mode-crown",
    note: "Crown: a bot has the crown, its marker and the hold bar",
    steps: [
      [fakePad, 600],
      [`(() => { document.getElementById("modeBots").value = "2"; window.__range.startMode("crown"); })()`, 400],
      [padButton(9, true), 300],
      [padButton(9, false), 300],
      [untilFight, 300],
      [`(() => { const r = window.__range; const d = r.duel(); d.holdFire = true; d.crown.appearsAt = 0; r.player.teleport(90, 0, -62, 180); })()`, 300],
      [`(() => { const d = window.__range.duel(); const b = d.bots[0].bot; b.pos.set(90, 0, -40); d.crown.phase = "ground"; d.crown.x = 90; d.crown.z = -40; })()`, 1200],
    ],
  },
  {
    name: "emotes-mannequin",
    note: "the six emotes on the mannequin, a moment in: wave, cheer, over there, salute, shrug, dance",
    steps: [
      [`(async () => { ${hideMenu}; const r = window.__range; await r.loadMannequin(); r.setFigureStyle("mannequin"); const s = r.openGround(0, 40, 6); r.player.teleport(s.x, 0, s.z, 0, -6);
        const still = { speed: 0, stance: "stand", pitch: 0 };
        const figs = r.figureLab([still, still, still, still, still, still], 5.5);
        figs.forEach((f, i) => f.emote(i)); })()`, 0],
      [gameSeconds(1.1), 200],
    ],
  },
  {
    name: "emote-self",
    note: "your own emote: the view steps back and comes round in front to watch you dance",
    steps: [
      [`(async () => { ${hideMenu}; const r = window.__range; await r.loadMannequin(); r.setFigureStyle("mannequin"); const s = r.openGround(0, 40, 6); r.player.teleport(s.x, 0, s.z, 0, 0); })()`, 0],
      // on game time: an emote wants your feet on the ground, and a slow renderer may not have drawn the landing yet
      [gameSeconds(0.6), 0],
      [`(() => { window.__range.emote(5); })()`, 0],
      [gameSeconds(1.4), 200],
    ],
  },
  {
    name: "emotes-robot",
    note: "the six emotes on the robots, a moment in",
    steps: [
      [`(async () => { ${hideMenu}; const r = window.__range; r.setFigureStyle("robot"); const s = r.openGround(0, 40, 6); r.player.teleport(s.x, 0, s.z, 0, -6);
        const still = { speed: 0, stance: "stand", pitch: 0 };
        const figs = r.figureLab([still, still, still, still, still, still], 5.5);
        figs.forEach((f, i) => f.emote(i)); })()`, 0],
      [gameSeconds(1.1), 200],
    ],
  },
  {
    name: "figure-poses",
    note: "the figures: a strafe aimed down sights, a backpedal reloading, a heal, a swap (left to right)",
    steps: [
      [fakePad, 600],
      [`(() => { document.getElementById("modeBots").value = "4"; window.__range.startMode("crown"); })()`, 400],
      [padButton(9, true), 300],
      [padButton(9, false), 300],
      [untilFight, 300],
      [
        `(() => { const r = window.__range; const d = r.duel(); d.holdFire = true; r.player.teleport(89.6, 0, -30.2, 0, -6); r.debugView.lowered = 1;
          const poses = [
            { speed: 5, stance: "stand", pitch: 0, moveDir: Math.PI / 2, ads: 1, act: null },
            { speed: 3, stance: "stand", pitch: 0, moveDir: Math.PI, ads: 0, act: "reload" },
            { speed: 0, stance: "stand", pitch: -10, moveDir: 0, ads: 0, act: "heal", healItem: "battery" },
            { speed: 0, stance: "crouch", pitch: 0, moveDir: 0, ads: 0, act: "swap" },
          ];
          d.bots.forEach((b, i) => { const bot = b.bot; bot.update = function (now, dt) { this.dummy.setPose(poses[i]); this.dummy.update(now, dt); return []; }; bot.pos.set(87.4 + i * 1.5, 0, -34); bot.dummy.group.position.copy(bot.pos); bot.dummy.group.rotation.y = -Math.PI / 2; });
        })()`,
        1500,
      ],
    ],
  },  {
    name: "figure-mannequins",
    note: "the motion-captured mannequins (a setting): the same four poses",
    steps: [
      [fakePad, 600],
      [`(() => { window.__range.setFigureStyle("mannequin"); return window.__range.loadMannequin(); })()`, 200],
      [`(() => { document.getElementById("modeBots").value = "4"; window.__range.startMode("crown"); })()`, 400],
      [padButton(9, true), 300],
      [padButton(9, false), 300],
      [untilFight, 300],
      [
        `(() => { const r = window.__range; const d = r.duel(); d.holdFire = true; r.player.teleport(89.6, 0, -30.2, 0, -6); r.debugView.lowered = 1;
          const poses = [
            { speed: 5, stance: "stand", pitch: 0, moveDir: Math.PI / 2, ads: 1, act: null },
            { speed: 3, stance: "stand", pitch: 0, moveDir: Math.PI, ads: 0, act: "reload" },
            { speed: 0, stance: "stand", pitch: -10, moveDir: 0, ads: 0, act: "heal", healItem: "battery" },
            { speed: 0, stance: "crouch", pitch: 0, moveDir: 0, ads: 0, act: "swap" },
          ];
          d.bots.forEach((b, i) => { const bot = b.bot; bot.update = function (now, dt) { this.dummy.setPose(poses[i]); this.dummy.update(now, dt); return []; }; bot.pos.set(87.4 + i * 1.5, 0, -34); bot.dummy.group.position.copy(bot.pos); bot.dummy.group.rotation.y = -Math.PI / 2; });
        })()`,
        1500,
      ],
    ],
  },
  {
    name: "throw-preview",
    note: "a frag in hand: the arc it would take and where it lands; thermite burning ahead",
    steps: [
      [hideMenu, 300],
      [`(() => { const r = window.__range; r.player.teleport(0, 0, -6, 0, 8); r.throwAt("thermite", new r.THREE.Vector3(-1.5, 1.2, -12), new r.THREE.Vector3(0, -1, -4)); r.ordnance.readied = { kind: "frag", readyAt: 0 }; })()`, 1400],
    ],
  },
  {
    name: "tour",
    note: "the guided tour: the step, what to do and the keys, the marker to walk to",
    steps: [
      [`(() => { document.getElementById("goTour").click(); ${hideMenu}; })()`, 600],
      [`(() => { window.__range.player.teleport(0, 0, -8, 0); })()`, 500],
      [`(() => { window.__range.player.teleport(2, 0, -2, 20); })()`, 600],
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
      // a battle royale's own hour comes from a random seed: pictures keep one hour, so two runs compare
      await page.evaluateOnNewDocument(() => localStorage.setItem("range.sky.br", "mine"));
      if (!sc.ship) await page.evaluateOnNewDocument("window.__straightDrop = true");
      // the real mouse reaches a pointer-locked headless page: none of it here, or whoever moves it turns the picture
      await page.evaluateOnNewDocument(`for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`);
      await page.goto(BASE + (sc.query ?? ""), { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 60000 });
      // the loading screen is over everything until the world is in
      await page.waitForFunction("window.__range.loaded()", { polling: 200, timeout: 60000 });
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
