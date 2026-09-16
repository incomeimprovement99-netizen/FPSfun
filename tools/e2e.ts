// End-to-end test in real browser pages: does everything work together.
//
//   1. The page loads with no errors, frames run, the static merge happened.
//   2. A scripted course run (teleporting into each room) finishes with a
//      result and a split for every room.
//   3. A 1v1 between two pages over the local transport (?net=local): they
//      connect, each sees the other at their spawn, the countdown ends, a hit
//      lowers the other's shield, a knock ends the round and scores it for the
//      right player, and the next round restores both players.
//   4. The same connection over the real peer-to-peer path, if the internet
//      and the public broker are reachable (skipped, not failed, otherwise).
//
// Run: npm run e2e        (needs `npm run dev` already running)
import puppeteer, { type Browser, type Page } from "puppeteer";
import modesCfg from "../src/config/modes.json";

/** the arena modes' spawns (arena coordinates) */
const MODE_SPAWNS = [...modesCfg.spawns.a, ...modesCfg.spawns.b, ...modesCfg.spawns.mid];

const BASE = process.env.SHOT_URL ?? "http://localhost:5173/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

let fails = 0;
const errors: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function open(browser: Browser, query: string): Promise<Page> {
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 450, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => errors.push(`pageerror: ${String((e as Error).message ?? e)}`));
  page.on("dialog", (d) => void d.accept());
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  await page.goto(BASE + query, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 60000 });
  return page;
}

/** evaluate an expression string in the page (tsx mangles function sources) */
const ev = <T>(page: Page, expr: string) => page.evaluate(expr) as Promise<T>;

/** back to the menu (Esc), and wait until the game agrees */
async function toMenu(p: Page): Promise<void> {
  await ev(p, "window.__range.toMenu()");
  await p.waitForFunction("!window.__range.input.playing", { polling: 50, timeout: 5000 }).catch(() => undefined);
}

/**
 * "Click Play" without a pointer lock (a scripted page cannot take one): a
 * fake gamepad's Start, which is the controller's way in. Round 1 waits for
 * every player to be in the game, so every page in a match does this.
 */
async function pressPlay(page: Page): Promise<void> {
  // already in (Create and a connect take a page straight in): nothing to press
  if (await ev<boolean>(page, "window.__range.input.playing")) return;
  await ev(page, `(() => {
    if (!window.__pad) {
      const btn = () => ({ pressed: false, touched: false, value: 0 });
      const pad = { index: 0, id: "fake pad", connected: true, mapping: "standard", timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn) };
      window.__pad = pad;
      navigator.getGamepads = () => [pad];
    }
  })()`);
  // no animation frames to wait on: a page behind another tab gets none,
  // but the game keeps ticking on a timer, so a short hold is enough
  await sleep(300);
  await ev(page, "window.__pad.buttons[9].pressed = true");
  await sleep(300);
  await ev(page, "window.__pad.buttons[9].pressed = false");
  await sleep(300);
}

/** a friend opens the invite link and is in the match, with no code typed */
async function inviteTest(browser: Browser, query: string): Promise<void> {
  const host = await open(browser, query);
  await ev(host, `document.getElementById("duelHost").click()`);
  const got = await host.waitForSelector("#inviteLink", { timeout: 20000 }).then(() => true, () => false);
  const link = got ? await ev<string>(host, `document.getElementById("inviteLink").value`) : "";
  check("the host gets an invite link", /[?&]join=[A-Z0-9]{5}/.test(link), link || "none");
  if (!link) return void (await host.close());
  const guest = await open(browser, new URL(link).search);
  const joined = await guest.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 }).then(() => true, () => false);
  check("opening the invite link joins the match", joined, await ev<string>(guest, `document.getElementById("duelStatus").textContent`));
  const search = await ev<string>(guest, "location.search");
  check("and the code comes off the address (a reload does not rejoin)", !/join=/.test(search) && /net=local/.test(search), search);
  await ev(guest, "window.__range.duel()?.leave()");
  await host.waitForFunction("window.__range.duel() === null", { polling: 200, timeout: 15000 }).catch(() => undefined);
  await guest.close();
  await host.close();
}

/** the battle royale: the drop, the landing, a knock, the ring's damage, a heal, leaving */
async function brTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  await ev(page, `(() => { document.getElementById("brStart").value = "loadout"; document.getElementById("brBots").value = "5"; document.getElementById("goBr").click(); })()`);
  await sleep(400);
  const drop = await ev<{ y: number; phase: string; dropping: boolean; poi: string; alive: number; bounds: boolean }>(
    page,
    `(() => { const d = window.__range.duel(); const h = d.hud().br; const p = window.__range.player.pos; return { y: p.y, phase: d.phase, dropping: h.dropping, poi: h.poi, alive: h.alive, bounds: p.z > 280 && p.z < 720 }; })()`
  );
  check("the drop starts high over one of the five places, six in the match", drop.y > 40 && drop.dropping && /HUB|YARD|DEPOT|RIDGE|TOWN/.test(drop.poi) && drop.alive === 6 && drop.bounds, JSON.stringify(drop));
  const landed = await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 40000 }).then(() => true, () => false);
  check("the fight starts when you land", landed, await ev<string>(page, "String(window.__range.duel()?.phase)"));
  await sleep(300);
  const card = await ev<{ on: boolean; choosing: boolean; picked: string | null }>(page, "({ on: window.__range.abilities.enabled, choosing: window.__range.abilities.choosing, picked: window.__range.abilities.picked })");
  check("abilities: the battle royale has them on, and the card is up on landing", card.on && card.choosing && card.picked === null, JSON.stringify(card));
  await ev(page, `window.__range.pickAbility("triage")`);
  const picked = await ev<{ choosing: boolean; picked: string | null }>(page, "({ choosing: window.__range.abilities.choosing, picked: window.__range.abilities.picked })");
  check("abilities: picking TRIAGE takes the card down", !picked.choosing && picked.picked === "triage", JSON.stringify(picked));
  const bots = await ev<{ n: number; onGround: boolean; feet: number }>(page, `(() => { const d = window.__range.duel(); const a = d.avatars; return { n: a.length, onGround: a.every((x) => x.group.position.y < 20), feet: window.__range.player.pos.y }; })()`);
  check("five bots dropped in and are on the map", bots.n === 5 && bots.onGround, JSON.stringify(bots));
  check("no fall stun off the drop: you are standing on something", bots.feet >= 0 && bots.feet < 20, `${bots.feet.toFixed(1)} m`);
  // a knock: the bot's own hit() takes the damage, localHit credits it
  await ev(page, `(() => { const d = window.__range.duel(); const a = d.avatars.find((x) => !x.knocked); const r = d.remoteOf(a); a.hit(0, "body", 500, 1, 1, a.group.position); d.localHit(r, 500, false); })()`);
  const afterKill = await ev<{ kills: number; alive: number }>(page, `(() => { const h = window.__range.duel().hud().br; return { kills: h.kills, alive: h.alive }; })()`);
  check("a knock counts and the alive count drops", afterKill.kills === 1 && afterKill.alive === 5, JSON.stringify(afterKill));
  // EVO the way Season 30 counts it: a knock through the bullets' own path is its damage plus 150
  await ev(page, "window.__range.duel().holdFire = true");
  const alive = () => ev<number[]>(page, "(() => { const d = window.__range.duel(); return d.avatars.filter((a) => !a.knocked).map((a) => d.remoteOf(a).id); })()");
  let ids = await alive();
  const evo0 = await ev<number>(page, "window.__range.armor.evo");
  await ev(page, `window.__range.hitThrough(${ids[0]}, 500)`);
  const evo1 = await ev<number>(page, "window.__range.armor.evo");
  check("EVO: a knock earns 150 on top of the damage dealt", evo1 - evo0 >= 150 + 50, `${evo0} -> ${evo1}`);
  // a care package's loot: 100 once a package
  await ev(page, `window.__range.applyLoot({ kind: "heal", id: "cell", n: 1, rarity: "common", pod: 77 })`);
  await ev(page, `window.__range.applyLoot({ kind: "heal", id: "syringe", n: 1, rarity: "common", pod: 77 })`);
  const evo2 = await ev<number>(page, "window.__range.armor.evo");
  check("EVO: a care package's loot earns 100, once a package", evo2 - evo1 === 100, `${evo1} -> ${evo2}`);
  // Executioner: a knock with the Mastiff that has it brings 50 shield back over 5 s
  ids = await alive();
  await ev(page, `(() => { const l = window.__range.loadout; l.give(l.activeIndex, "mastiff", 0, { hopup: "hopup_executioner" }); window.__range.duel().shield = 0; })()`);
  await ev(page, `window.__range.hitThrough(${ids[0]}, 500)`);
  await sleep(2200);
  const exec = await ev<{ shield: number }>(page, "({ shield: window.__range.duel().shield })");
  check("Executioner: a knock with the Mastiff brings shield back (10 a second)", exec.shield >= 12 && exec.shield <= 40, JSON.stringify(exec));
  // a Peacekeeper off the floor: Executioner fitted but locked, unlocking with the damage done with it
  await ev(page, `window.__range.applyLoot({ kind: "weapon", id: "energy_shotgun", n: 1, rarity: "rare" })`);
  const lock = await ev<{ mod: string; need: number } | null>(page, "window.__range.loadout.active.hopLock ?? null");
  check("a Peacekeeper off the floor comes with Executioner locked until 275 damage", lock?.mod === "hopup_executioner" && lock.need === 275, JSON.stringify(lock));
  ids = await alive();
  await ev(page, "window.__range.loadout.active.hopLock.need = 150");
  await ev(page, `window.__range.hitThrough(${ids[0]}, 100)`);
  await ev(page, `window.__range.hitThrough(${ids[0]}, 100)`);
  const unlocked = await ev<{ lock: unknown; hop: string | null }>(page, "({ lock: window.__range.loadout.active.hopLock ?? null, hop: window.__range.loadout.active.attach.hopup ?? null })");
  check("and once the damage is done it unlocks, fitted", unlocked.lock === null && unlocked.hop === "hopup_executioner", JSON.stringify(unlocked));
  // (Executioner's shield done coming back before the ring's damage is measured)
  await page.waitForFunction("!window.__range.kdState().exec", { polling: 100, timeout: 8000 }).catch(() => undefined);
  // outside the ring: a corner of the map is outside ring 1
  await ev(page, "window.__range.player.teleport(215, 0, 715, 0)");
  const before = await ev<number>(page, "window.__range.duel().shield + window.__range.duel().health");
  await sleep(3500);
  const outside = await ev<{ hp: number; out: boolean }>(page, `(() => { const d = window.__range.duel(); return { hp: d.shield + d.health, out: d.hud().br.ring.outside }; })()`);
  check("outside the ring you take its damage", outside.out && outside.hp < before, `${before} -> ${outside.hp}`);
  // eliminated by the ring: no killcam (nobody to watch), a recap that says so
  const ringPage = await open(browser, query);
  await ev(ringPage, `(() => { document.getElementById("brStart").value = "loadout"; document.getElementById("brBots").value = "3"; document.getElementById("goBr").click(); })()`);
  await ringPage.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 40000 });
  await ev(ringPage, "(() => { window.__range.player.teleport(215, 0, 715, 0); const d = window.__range.duel(); d.shield = 0; d.health = 1; })()");
  const ringOut = await ringPage.waitForFunction("!window.__range.duel()?.alive", { polling: 200, timeout: 8000 }).then(() => true, () => false);
  const ringRc = await ev<{ byRing: boolean; killerName: string } | null>(ringPage, "window.__range.recap()");
  const ringKc = await ev<{ active: boolean }>(ringPage, "window.__range.killcamState()");
  check("recap: out to the ring: no killcam, the recap says the ring", ringOut && !!ringRc?.byRing && !ringKc.active, JSON.stringify({ ringRc, ringKc }));
  await ev(ringPage, "window.__range.duel()?.leave()");
  await ringPage.close();
  // a heal: a cell brings the shield up by 25 in 2.5 s, 1.25 s with TRIAGE, and costs one of four
  await ev(page, "(() => { window.__range.duel().holdFire = true; window.__range.player.teleport(0, 0, 500, 0); })()");
  await sleep(300);
  const cellsBefore = await ev<number>(page, "window.__range.kit.items.cell");
  await ev(page, "window.__range.startHeal()");
  const shieldBefore = await ev<number>(page, "window.__range.duel().shield");
  await sleep(1700);
  const healed = await ev<{ shield: number; cells: number; max: number }>(page, "({ shield: window.__range.duel().shield, cells: window.__range.kit.items.cell, max: window.__range.duel().shieldMax })");
  check("a shield cell heals 25 shield and is spent, in half its time with TRIAGE", healed.shield === Math.min(healed.max, shieldBefore + 25) && healed.cells === cellsBefore - 1, JSON.stringify({ shieldBefore, cellsBefore, ...healed }));
  // the controller's Default: RB twice pings an enemy there; D-pad up heals; D-pad right readies a grenade
  await pressPlay(page);
  await padTap(page, 5, 60);
  await padTap(page, 5, 60);
  const enemyPing = await ev<boolean>(page, "window.__range.brPlay.markers.some((m) => m.k === 'enemy' && m.label === 'ENEMY HERE' && m.from === window.__range.duel().id)");
  check("pad: RB twice quickly is an enemy ping where you look (the game's double tap)", enemyPing, JSON.stringify(await ev(page, "window.__range.brPlay.markers.map((m) => m.label)")));
  await ev(page, "window.__range.duel().shield = 0");
  await padTap(page, 12, 80);
  const padHeal = await ev<string | null>(page, "window.__range.hud.last?.heal?.item ?? null");
  check("pad: D-pad up (a tap) is the quick heal", padHeal !== null, String(padHeal));
  await sleep(1500);
  await padTap(page, 15);
  const padNade = await ev<string | null>(page, "window.__range.ordnance.readied?.kind ?? null");
  check("pad: D-pad right readies a grenade", padNade !== null, String(padNade));
  await padTap(page, 6);
  await ev(page, "window.__range.duel().leave()");
  await sleep(300);
  check("leaving ends the battle royale", (await ev<boolean>(page, "window.__range.duel() === null")));
  await page.close();
}

/**
 * A battle royale that starts with nothing: two empty slots and fists, the
 * floor's loot laid out, E takes the item under the crosshair, a second gun
 * fills the other slot, a third goes in place of the one in hand (which goes
 * down where you stand), ammo, a heal past its stack, a mag onto the gun that
 * takes it, a helmet; your death box; the bots search before they are armed.
 */
async function brLootTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  await ev(page, `(() => { document.getElementById("brStart").value = "loot"; document.getElementById("brBots").value = "3"; document.getElementById("goBr").click(); })()`);
  await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 40000 });
  await sleep(300);
  await ev(page, `(() => { window.__range.duel().holdFire = true; window.__range.pickAbility("jolt"); })()`);
  const start = await ev<{ empty: boolean; kit: number; field: number; light: number; weapon: string; botsArmed: number }>(
    page,
    `(() => { const r = window.__range; const d = r.duel(); return { empty: r.loadout.slots.every((s) => s.empty), kit: r.kit.total, field: d.lootField ? d.lootField.count : 0, light: r.loadout.ammo.stock.light, weapon: r.hud.last?.weaponName ?? "", botsArmed: d.bots.filter((b) => b.armedShown).length }; })()`
  );
  check("loot: you land with nothing (two empty slots, fists, no heals, no ammo) on a floor of items", start.empty && start.kit === 0 && start.light === 0 && start.field > 100 && start.weapon === "FISTS", JSON.stringify(start));
  check("loot: the bots land unarmed and search first", start.botsArmed === 0, JSON.stringify(start));
  // an R-97 on the ground in front, looked at; E takes it (through the game's own E)
  // open ground to stand on, the item 1.6 m ahead, looked at from 45 degrees down
  const spot = await ev<{ x: number; z: number } | null>(page, "window.__range.openGround(window.__range.player.pos.x, window.__range.player.pos.z)");
  check("loot: there is open ground near the landing", spot !== null, JSON.stringify(spot));
  const S = spot ?? { x: 0, z: 500 };
  const place = (item: string) => `(() => {
      const r = window.__range; const f = r.duel().lootField;
      r.player.teleport(${S.x}, 0, ${S.z}, 0, -45);
      for (const k of [...f.drops.keys()]) { const x = f.drops.get(k); if (x && Math.hypot(x.pos.x - ${S.x}, x.pos.z - ${S.z}) < 6) f.remove(k); }
      f.add(${item}, new r.THREE.Vector3(${S.x}, 0, ${S.z} - 1.6));
    })()`;
  const take = async (item: string): Promise<void> => {
    await ev(page, place(item));
    await sleep(150);
    await ev(page, `window.__range.setScript({ held: () => false, pressedNow: (a) => a === "interact" })`);
    await sleep(250);
    await ev(page, "window.__range.setScript(null)");
    await sleep(100);
  };
  await ev(page, place(`{ kind: "weapon", id: "r97", n: 1, rarity: "rare" }`));
  await ev(page, "window.__range.setScript({ held: () => false, pressedNow: () => false })");
  await sleep(200);
  const prompt = await ev<string>(page, "JSON.stringify(window.__range.brPlay.hud.prompt)");
  check("loot: looking at an item gives the TAKE prompt", /TAKE/.test(prompt), prompt);
  await ev(page, "window.__range.setScript(null)");
  await take(`{ kind: "weapon", id: "r97", n: 1, rarity: "rare" }`);
  const one = await ev<{ ids: string[]; empty: boolean[]; weapon: string }>(page, "(() => { const r = window.__range; return { ids: r.loadout.slots.map((s) => s.id), empty: r.loadout.slots.map((s) => s.empty), weapon: r.hud.last?.weaponName ?? '' }; })()");
  check("loot: E takes the gun into an empty slot, and it is in hand", one.empty.filter((e) => !e).length === 1 && one.ids.includes("r97") && one.weapon !== "FISTS", JSON.stringify(one));
  await take(`{ kind: "weapon", id: "hemlok", n: 1, rarity: "rare" }`);
  await sleep(700);
  await take(`{ kind: "weapon", id: "wingman", n: 1, rarity: "rare" }`);
  const three = await ev<{ ids: string[]; dropped: boolean }>(page, `(() => { const r = window.__range; const f = r.duel().lootField; return { ids: r.loadout.slots.map((s) => s.id), dropped: [...f.drops.values()].some((x) => x.item.kind === "weapon" && Math.hypot(x.pos.x - ${S.x}, x.pos.z - ${S.z}) < 3) }; })()`);
  check("loot: a second gun fills the other slot, a third goes in place of the one in hand, which goes down", three.ids.includes("wingman") && three.ids.filter((i) => i === "r97" || i === "hemlok").length === 1 && three.dropped, JSON.stringify(three));
  await ev(page, `window.__range.applyLoot({ kind: "ammo", id: "heavy", n: 60, rarity: "common" })`);
  await ev(page, `window.__range.applyLoot({ kind: "heal", id: "battery", n: 3, rarity: "rare" })`);
  const packed = await ev<{ heavy: number; batts: number; putBack: boolean }>(page, `(() => { const r = window.__range; const f = r.duel().lootField; return { heavy: r.loadout.ammo.stock.heavy, batts: r.kit.items.battery, putBack: [...f.drops.values()].some((x) => x.item.kind === "heal" && x.item.id === "battery" && x.item.n === 1) }; })()`);
  check("loot: ammo into the pack; three batteries where two fit: two taken, one back on the ground", packed.heavy === 60 && packed.batts === 2 && packed.putBack, JSON.stringify(packed));
  await ev(page, `window.__range.applyLoot({ kind: "helmet", id: "gold", n: 1, rarity: "legendary" })`);
  const helm = await ev<string | null>(page, "window.__range.armor.helmet");
  check("loot: a helmet goes on", helm === "gold", String(helm));
  // a care package: on the maps while it falls, then its gold gun and extras around it
  await ev(page, `(() => { const d = window.__range.duel(); const f = d.lootField; for (const k of [...f.drops.keys()]) { const x = f.drops.get(k); if (x && Math.hypot(x.pos.x - (${S.x} + 12), x.pos.z - ${S.z}) < 4) f.remove(k); } d.addPod(new window.__range.THREE.Vector3(${S.x} + 12, 0, ${S.z}), 1.2); })()`);
  const falling = await ev<number>(page, "window.__range.duel().hud().br.pods.filter((p) => !p.landed).length");
  await sleep(1800);
  const pod = await ev<{ landed: boolean; items: Array<{ kind: string; id: string; rarity: string }> }>(
    page,
    `(() => { const d = window.__range.duel(); const at = { x: ${S.x} + 12, z: ${S.z} }; return { landed: d.hud().br.pods.some((p) => p.landed), items: [...d.lootField.drops.values()].filter((x) => Math.hypot(x.pos.x - at.x, x.pos.z - at.z) < 2).map((x) => ({ kind: x.item.kind, id: x.item.id, rarity: x.item.rarity })) }; })()`
  );
  const podGun = pod.items.find((i) => i.kind === "weapon");
  check("loot: a care package shows on the map as it falls, then lands with a gold care-package gun and two more", falling === 1 && pod.landed && pod.items.length === 3 && !!podGun && ["sniper", "3030", "lstar"].includes(podGun.id) && podGun.rarity === "legendary", JSON.stringify({ falling, ...pod }));
  // out: your death box with what you had
  const before = await ev<number>(page, "window.__range.duel().lootField.count");
  await ev(page, "window.__range.duel().takeHit(500, 100)");
  await sleep(300);
  const box = await ev<{ alive: boolean; boxes: number; added: number }>(page, `(() => { const d = window.__range.duel(); const f = d.lootField; return { alive: d.alive, boxes: [...f.drops.values()].filter((x) => x.item.kind === "box").length, added: f.count }; })()`);
  check("loot: out, and your death box goes down with your guns, ammo, heals and helmet", !box.alive && box.boxes >= 1 && box.added - before >= 6, JSON.stringify({ before, ...box }));
  await ev(page, "window.__range.duel()?.leave()");
  await sleep(300);
  const back = await ev<{ empty: boolean[] }>(page, "({ empty: window.__range.loadout.slots.map((s) => s.empty) })");
  check("loot: leaving gives you your own loadout back", back.empty.every((e) => !e), JSON.stringify(back));
  await page.close();
}

/** a mode alone from the Play tab's button: in the game (the pad's Start), the fight on */
async function startModePage(browser: Browser, query: string, button: string, setup = ""): Promise<Page> {
  const page = await open(browser, query);
  await ev(page, `(() => { ${setup}; document.getElementById("${button}").click(); })()`);
  await pressPlay(page);
  await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 20000 }).catch(() => undefined);
  await ev(page, "(() => { const d = window.__range.duel(); if (d) d.holdFire = true; })()");
  return page;
}

/** a bot knocked by this player's own bullet (its dummy's hit() and the match's localHit, as the game does) */
const knockBot = (pick: string, weapon = "r97") =>
  `(() => { const d = window.__range.duel(); const a = d.avatars.find((x) => { const r = d.remoteOf(x); return r && r.id >= 100 && r.alive && (${pick}); }); if (!a) return false; const r = d.remoteOf(a); a.hit(0, "body", 900, 1, 1, a.group.position); d.localHit(r, 900, false, "${weapon}", 8); return true; })()`;

/**
 * The arena's modes alone: Gun Run (a kill moves you on and changes your
 * gun, a melee death costs a level, the knife's kill wins), team deathmatch
 * (team mates, the score, the win), Crown (it appears, you take it, the hold
 * takes the round), each from its Play tab button, and each on the Stats tab.
 */
async function modesTest(browser: Browser, query: string): Promise<void> {
  // ---- Gun Run
  const g = await startModePage(browser, query, "goGunRun", `document.getElementById("modeBots").value = "2"; document.getElementById("gunRunList").value = "short"`);
  const g0 = await ev<{ kind: string; slots: string[]; level: number; of: number; bots: number; phase: string }>(
    g,
    `(() => { const r = window.__range; const d = r.duel(); const m = d.hud().mode; return { kind: d.modeKind, slots: r.loadout.slots.map((s) => (s.empty ? "-" : s.id)), level: m.gun.level, of: m.gun.of, bots: d.avatars.length, phase: d.phase }; })()`
  );
  const blocked = await ev<string[]>(g, `(() => { const r = window.__range; const S = ${JSON.stringify(MODE_SPAWNS)}; return S.filter(([x, z]) => { const o = r.openGround(90 + x, -40 + z, 0.6); return !o || Math.hypot(o.x - 90 - x, o.z + 40 - z) > 1e-6; }).map((p) => p.join(",")); })()`);
  check("modes: every spawn point stands clear of the arena's boxes", blocked.length === 0, blocked.join(" "));
  check("gun run: the Play tab button starts it, two bots, level 1 of 11 with the list's first gun and nothing else", g0.kind === "gunrun" && g0.phase === "fight" && g0.bots === 2 && g0.level === 1 && g0.of === 11 && g0.slots[0] === "rspn101" && g0.slots[1] === "-", JSON.stringify(g0));
  await ev(g, knockBot("true"));
  await sleep(300);
  const g1 = await ev<{ slots: string[]; level: number; hudGun: string }>(g, `(() => { const r = window.__range; const m = r.duel().hud().mode; return { slots: r.loadout.slots.map((s) => (s.empty ? "-" : s.id)), level: m.gun.level, hudGun: r.hud.last?.weaponName ?? "" }; })()`);
  check("gun run: a kill moves you to level 2 and the R-99 is in your hands", g1.level === 2 && g1.slots[0] === "r97" && g1.slots[1] === "-", JSON.stringify(g1));
  const back = await g.waitForFunction("window.__range.duel().avatars.every((a) => !a.knocked)", { polling: 200, timeout: 6000 }).then(() => true, () => false);
  check("gun run: the bot is back in after its respawn", back);
  await ev(g, `(() => { const d = window.__range.duel(); d.ladder.row(0).level = 4; d.takeHit(900, 100, false, "melee", 1); })()`);
  await sleep(200);
  const g2 = await ev<{ level: number; alive: boolean; respawnIn: number | null; botLevel: number }>(g, `(() => { const d = window.__range.duel(); const m = d.hud().mode; return { level: d.ladder.level(0), alive: d.alive, respawnIn: m.respawnIn, botLevel: d.ladder.level(100) }; })()`);
  check("gun run: knifed: a level lost (5 to 4), the knifer moves on, a respawn counting down", g2.level === 3 && !g2.alive && g2.respawnIn !== null && g2.respawnIn > 2 && g2.botLevel === 1, JSON.stringify(g2));
  const up = await g.waitForFunction("window.__range.duel().alive", { polling: 200, timeout: 6000 }).then(() => true, () => false);
  const spot = await ev<{ x: number; z: number }>(g, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })");
  check("gun run: back in 3 s later inside the arena", up && Math.abs(spot.x - 90) <= 18 && Math.abs(spot.z + 40) <= 32, JSON.stringify(spot));
  // the knife: the last level is fists; a melee kill with it wins
  await ev(g, `(() => { const d = window.__range.duel(); d.ladder.row(0).level = 10; d.gunsChanged(); })()`);
  await sleep(200);
  const knife = await ev<{ slots: string[]; knife: boolean; name: string; hudGun: string }>(g, `(() => { const r = window.__range; const d = r.duel(); return { slots: r.loadout.slots.map((s) => (s.empty ? "-" : s.id)), knife: d.knifeNow, name: d.hud().mode.gun.name, hudGun: r.hud.last?.weaponName ?? "" }; })()`);
  check("gun run: level 11 is the knife: no guns, fists, the knife's melee", knife.knife && knife.slots.every((s) => s === "-") && knife.name === "THE KNIFE", JSON.stringify(knife));
  const before = await ev<number>(g, `(window.__range.profile?.profile?.matches?.gunrun?.won ?? 0)`).catch(() => 0);
  await ev(g, knockBot("true", "melee"));
  await sleep(400);
  const won = await ev<{ phase: string; winner: string | null; won: boolean | null; stats: number }>(g, `(() => { const d = window.__range.duel(); const m = d.hud().mode; return { phase: d.phase, winner: m.winner, won: m.won, stats: document.getElementById("statsBody").innerHTML.includes("Gun Run") ? 1 : 0 }; })()`);
  check("gun run: a knife kill wins it: the match is over and you are the winner", won.phase === "matchEnd" && won.won === true && won.winner === "YOU", JSON.stringify({ before, ...won }));
  check("gun run: the Stats tab has a Gun Run card", won.stats === 1);
  await ev(g, "window.__range.duel()?.leave()");
  await sleep(300);
  const after = await ev<string[]>(g, "window.__range.loadout.slots.map((s) => (s.empty ? '-' : s.id))");
  check("gun run: leaving gives your own loadout back", after.every((s) => s !== "-"), JSON.stringify(after));
  await g.close();

  // ---- team deathmatch
  const t = await startModePage(browser, query, "goTdm");
  const t0 = await ev<{ allies: number; enemies: number; you: number; them: number; limit: number }>(
    t,
    `(() => { const d = window.__range.duel(); const rs = d.avatars.map((a) => d.remoteOf(a)); const m = d.hud().mode; return { allies: rs.filter((r) => d.isAlly(r.id)).length, enemies: rs.filter((r) => !d.isAlly(r.id)).length, you: m.teams.you, them: m.teams.them, limit: m.teams.limit }; })()`
  );
  check("tdm: you and three bots against four, 0 - 0, first to 30", t0.allies === 3 && t0.enemies === 4 && t0.you === 0 && t0.them === 0 && t0.limit === 30, JSON.stringify(t0));
  const tdmGuns = await ev<string[]>(t, "window.__range.duel().bots.map((b) => b.bot.remote.avatarWeapon)");
  check("tdm: the bots keep their own guns (Gun Run's ladder is not theirs)", new Set(tdmGuns).size >= 4, tdmGuns.join(","));
  const ff = await ev<{ health: number; before: number }>(
    t,
    `(() => { const d = window.__range.duel(); const a = d.avatars.find((x) => d.isAlly(d.remoteOf(x).id)); const r = d.remoteOf(a); const before = a.health + a.shield; d.localHit(r, 80, false, "r97", 5); return { health: a.health + a.shield, before }; })()`
  );
  const ffScore = await ev<number>(t, "window.__range.duel().hud().mode.teams.you");
  check("tdm: a team mate takes no damage from you and scores nothing", ff.health === ff.before && ffScore === 0, JSON.stringify(ff));
  await ev(t, knockBot("!d.isAlly(r.id)"));
  await sleep(200);
  const t1 = await ev<number>(t, "window.__range.duel().hud().mode.teams.you");
  check("tdm: an enemy down scores for your team", t1 === 1, String(t1));
  await ev(t, "(() => { const d = window.__range.duel(); d.teams.score[0] = 29; })()");
  await ev(t, knockBot("!d.isAlly(r.id)"));
  await sleep(400);
  const t2 = await ev<{ phase: string; winner: string | null; won: boolean | null }>(t, "(() => { const d = window.__range.duel(); const m = d.hud().mode; return { phase: d.phase, winner: m.winner, won: m.won }; })()");
  check("tdm: the 30th wins it for your team", t2.phase === "matchEnd" && t2.won === true && t2.winner === "YOUR TEAM", JSON.stringify(t2));
  await ev(t, "window.__range.duel()?.leave()");
  await t.close();

  // ---- Crown
  const c = await startModePage(browser, query, "goCrown", `document.getElementById("modeBots").value = "2"`);
  const c0 = await ev<{ phase: string; left: number | null }>(c, "(() => { const m = window.__range.duel().hud().mode; return { phase: m.crown.phase, left: m.left }; })()");
  check("crown: it waits for 20 s into the round", c0.phase === "waiting" && c0.left !== null && c0.left > 17 && c0.left <= 20, JSON.stringify(c0));
  await ev(c, "(() => { const d = window.__range.duel(); d.crown.appearsAt = 0; for (const a of d.avatars) a.group.visible = true; })()");
  await sleep(300);
  const c1 = await ev<string>(c, "window.__range.duel().hud().mode.crown.phase");
  check("crown: it appears in the middle", c1 === "ground" || c1 === "carried", c1);
  await ev(c, "window.__range.player.teleport(90, 0, -40, 0)");
  const mine = await c.waitForFunction("window.__range.duel().hud().mode.crown.mine", { polling: 100, timeout: 3000 }).then(() => true, () => false);
  check("crown: walking over it takes it", mine, JSON.stringify(await ev(c, "window.__range.duel().hud().mode.crown")));
  await ev(c, "(() => { window.__range.duel().crown.held = 29.4; })()");
  await sleep(900);
  const c2 = await ev<{ phase: string; wins: number; round: number }>(c, "(() => { const d = window.__range.duel(); return { phase: d.phase, wins: d.hud().mode.crown.wins, round: d.round }; })()");
  check("crown: 30 s holding it takes the round", c2.phase === "roundEnd" && c2.wins === 1, JSON.stringify(c2));
  const r2 = await c.waitForFunction("window.__range.duel().phase === 'fight' && window.__range.duel().round === 2", { polling: 200, timeout: 12000 }).then(() => true, () => false);
  check("crown: round 2 starts with the crown waiting again", r2 && (await ev<string>(c, "window.__range.duel().hud().mode.crown.phase")) === "waiting");
  await ev(c, "window.__range.duel()?.leave()");
  await c.close();

  // ---- Control: five a side over A, B and C; standing on A takes it, it scores, you come back on it
  const ct = await startModePage(browser, query, "goControl");
  const ctl0 = await ev<{ kind: string; n: number; allies: number; zones: string }>(ct, "(() => { const d = window.__range.duel(); const h = d.hud().mode; return { kind: h.kind, n: d.avatars.length, allies: h.rows.filter((r) => r.ally).length, zones: (h.control?.zones ?? []).map((z) => z.id).join('') }; })()");
  check("control: five a side (you and four bots against five), zones A, B and C", ctl0.kind === "control" && ctl0.n === 9 && ctl0.allies === 4 && ctl0.zones === "ABC", JSON.stringify(ctl0));
  // the bots stand still (the test's zone is its own); you walk onto A, on your side
  await ev(ct, "(() => { const d = window.__range.duel(); d.bots.forEach((b) => { b.bot.update = () => []; }); const z = d.hud().mode.control.zones[0].at; window.__range.player.teleport(z.x, 0, z.z, 180); })()");
  const tookA = await ct.waitForFunction("window.__range.duel().hud().mode.control.zones[0].owner === 'you'", { polling: 200, timeout: 14000 }).then(() => true, () => false);
  check("control: 8 s on a neutral zone takes it for your team", tookA, JSON.stringify(await ev(ct, "window.__range.duel().hud().mode.control.zones[0]")));
  const s0 = await ev<number>(ct, "window.__range.duel().hud().mode.control.you");
  await sleep(3200);
  const s1 = await ev<number>(ct, "window.__range.duel().hud().mode.control.you");
  check("control: a zone held scores a point a second", s1 - s0 >= 2 && s1 - s0 <= 5, `${s0} -> ${s1}`);
  // down: back in 5 s later on A (held in a line from your base), not at the base
  await ev(ct, "(() => { const d = window.__range.duel(); window.__range.player.teleport(d.hud().mode.control.zones[1].at.x + 6, 0, d.hud().mode.control.zones[1].at.z, 180); d.takeHit(900, 106); })()");
  const backIn = await ct.waitForFunction("window.__range.duel().alive", { polling: 200, timeout: 9000 }).then(() => true, () => false);
  await sleep(300);
  const where = await ev<number>(ct, "(() => { const z = window.__range.duel().hud().mode.control.zones[0].at; const p = window.__range.player.pos; return Math.hypot(p.x - z.x, p.z - z.z); })()");
  check("control: down, you come back on your team's zone A", backIn && where < 4.5, `${where.toFixed(1)} m from A`);
  await ev(ct, "window.__range.duel()?.leave()");
  await ct.close();

  // ---- the motion-captured figures (a setting): they load, a match's figures are mannequins and animate
  const mq = await open(browser, query);
  await ev(mq, `(() => { const s = document.getElementById("figureStyle"); const def = s.value; s.value = "mannequin"; s.dispatchEvent(new Event("change")); window.__mqDefault = def; return window.__range.loadMannequin(); })()`);
  check("figures: the mannequin is the default figure", (await ev<string>(mq, "window.__mqDefault")) === "mannequin");
  await ev(mq, `(() => { document.getElementById("modeBots").value = "2"; document.getElementById("goCrown").click(); })()`);
  await pressPlay(mq);
  await mq.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 20000 }).catch(() => undefined);
  await sleep(800);
  const figs = await ev<{ n: number; mannequins: number; moved: boolean }>(
    mq,
    `(() => { const d = window.__range.duel(); const a = d.avatars; const m = a.map((x) => x.group.getObjectByName("mannequin")).filter(Boolean); let moved = false; m[0]?.traverse((o) => { if (o.name === "thigh_l") moved = Math.abs(o.quaternion.x) + Math.abs(o.quaternion.y) + Math.abs(o.quaternion.z) > 0.01; }); return { n: a.length, mannequins: m.length, moved }; })()`
  );
  check("figures: with the setting on the bots are mannequins, and their clips are playing", figs.n === 2 && figs.mannequins === 2 && figs.moved, JSON.stringify(figs));
  // a long gun is shouldered: it hangs off the chest (not the hand), the right hand on the grip
  const shouldered = await ev<Array<{ mount: boolean; grip: number }>>(mq, `window.__range.duel().avatars.filter((a) => a.mq && a.mq.gunObject).map((a) => ({ mount: a.mq.gunObject.parent?.name === "gunMount", grip: a.mq.gripReach }))`);
  check("figures: a mannequin's rifle hangs off its chest with the right hand on the grip", shouldered.length > 0 && shouldered.every((s) => s.mount && s.grip > 0.5), JSON.stringify(shouldered));
  await ev(mq, `(() => { window.__range.duel()?.leave(); localStorage.removeItem("range.figures"); })()`);
  await mq.close();
}

/** Gun Run with a friend over the local transport, and a bot: the ladder is the host's, a kill moves the killer on on both screens, respawns */
async function modesFriendsTest(browser: Browser, query: string): Promise<void> {
  const host = await open(browser, query);
  const guest = await open(browser, query);
  await ev(host, `(() => { document.getElementById("duelMode").value = "gunrun"; document.getElementById("modeBots").value = "1"; document.getElementById("gunRunList").value = "short"; document.getElementById("duelHost").click(); })()`);
  let code = "";
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
  } catch {
    check("modes friends: the host gets a code", false);
    await host.close();
    await guest.close();
    return;
  }
  await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
  try {
    for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  } catch {
    check("modes friends: both connect", false);
    await host.close();
    await guest.close();
    return;
  }
  const kinds = await Promise.all([host, guest].map((p) => ev<{ kind: string; role: string }>(p, "({ kind: window.__range.duel().modeKind, role: window.__range.duel().role })")));
  check("modes friends: the guest plays the host's mode (Gun Run)", kinds.every((k) => k.kind === "gunrun"), JSON.stringify(kinds));
  for (const p of [host, guest]) await pressPlay(p);
  const fight = await Promise.all([host, guest].map((p) => p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 20000 }).then(() => true, () => false)));
  check("modes friends: the fight starts on both", fight.every(Boolean));
  await ev(host, "window.__range.duel().holdFire = true");
  await sleep(1200);
  const seen = await ev<{ bots: number; humans: number; rows: number }>(guest, `(() => { const d = window.__range.duel(); const rs = [...d.remotes.values()]; return { bots: rs.filter((r) => r.id >= 100).length, humans: rs.filter((r) => r.id < 100).length, rows: d.hud().mode.rows.length }; })()`);
  check("modes friends: the guest sees the host and the host's bot, and all three on the scoreboard", seen.bots === 1 && seen.humans === 1 && seen.rows === 3, JSON.stringify(seen));
  // the host knocks the guest: the host's level goes up on both screens, the guest comes back
  await ev(host, `(() => { const d = window.__range.duel(); const r = d.remotes.get(1); d.localHit(r, 900, true, "rspn101", 12); })()`);
  const down = await guest.waitForFunction("!window.__range.duel().alive", { polling: 100, timeout: 5000 }).then(() => true, () => false);
  await sleep(700);
  const lv = await Promise.all([host, guest].map((p) => ev<number>(p, "window.__range.duel().ladder.level(0)")));
  const hostGun = await ev<string>(host, "window.__range.loadout.slots[0].id");
  check("modes friends: the host's kill moves the host to level 2 on both screens, the R-99 in hand", down && lv[0] === 1 && lv[1] === 1 && hostGun === "r97", JSON.stringify({ down, lv, hostGun }));
  const again = await guest.waitForFunction("window.__range.duel().alive", { polling: 200, timeout: 6000 }).then(() => true, () => false);
  const hostSees = await host.waitForFunction("window.__range.duel().remotes.get(1)?.alive === true", { polling: 200, timeout: 4000 }).then(() => true, () => false);
  check("modes friends: the guest respawns and the host sees them back", again && hostSees);
  // the guest knocks the bot (a hit message the host applies): the guest moves on, told by the host
  await ev(guest, `(() => { const d = window.__range.duel(); const r = [...d.remotes.values()].find((x) => x.id >= 100 && x.alive); d.localHit(r, 900, true, "rspn101", 9); })()`);
  const gl = await guest.waitForFunction("window.__range.duel().ladder.level(1) === 1 && window.__range.loadout.slots[0].id === 'r97'", { polling: 200, timeout: 5000 }).then(() => true, () => false);
  check("modes friends: the guest's kill on the host's bot moves the guest on, the R-99 in the guest's hands", gl, JSON.stringify(await ev(guest, "({ lv: window.__range.duel().ladder.level(1), gun: window.__range.loadout.slots[0].id })")));
  // the figure over the network: the guest aims down sights, then heals; the host's copy of the guest does it too
  await ev(guest, `(() => {
    if (!window.__pad) {
      const btn = () => ({ pressed: false, touched: false, value: 0 });
      const pad = { index: 0, id: "fake pad", connected: true, mapping: "standard", timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn) };
      window.__pad = pad;
      navigator.getGamepads = () => [pad];
    }
    window.__pad.buttons[6].pressed = true;
    window.__pad.buttons[6].value = 1;
  })()`);
  const aimed = await host.waitForFunction("(window.__range.duel().remotes.get(1)?.avatar.currentPose.ads ?? 0) > 0.6", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  await ev(guest, "(() => { window.__pad.buttons[6].pressed = false; window.__pad.buttons[6].value = 0; })()");
  check("figures: the guest aims down sights and the host's figure of the guest raises its gun", aimed, JSON.stringify(await ev(host, "window.__range.duel().remotes.get(1)?.avatar.currentPose")));
  await ev(guest, `(() => { const d = window.__range.duel(); d.shield = d.shieldMax - 15; window.__range.startHeal(); })()`);
  const healing = await host.waitForFunction("window.__range.duel().remotes.get(1)?.avatar.currentPose.act === 'heal'", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  const item = await ev<string | undefined>(host, "window.__range.duel().remotes.get(1)?.avatar.currentPose.healItem");
  check("figures: the guest heals and the host's figure of the guest holds the item (a shield cell)", healing && item === "cell", String(item));
  await ev(guest, "window.__range.duel()?.leave()");
  await host.waitForFunction("window.__range.duel() === null || window.__range.duel().phase", { polling: 200, timeout: 5000 }).catch(() => undefined);
  await ev(host, "window.__range.duel()?.leave()");
  await host.close();
  await guest.close();
}

/** two friends drop together: the guest sees the host's bots, a knock reaches both feeds, the squad's result reaches both */
async function brSquadTest(browser: Browser, query: string): Promise<void> {
  const host = await open(browser, query);
  const guest = await open(browser, query);
  await ev(host, `(() => { document.getElementById("duelMode").value = "br"; document.getElementById("brBots").value = "3"; document.getElementById("duelHost").click(); })()`);
  let code = "";
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
  } catch {
    check("squad: the host gets a code", false, await ev<string>(host, `document.getElementById("duelStatus").textContent`));
    await host.close();
    await guest.close();
    return;
  }
  await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
  try {
    for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  } catch {
    check("squad: both connect", false, await ev<string>(guest, `document.getElementById("duelStatus").textContent`));
    await host.close();
    await guest.close();
    return;
  }
  const kinds = await Promise.all([host, guest].map((p) => ev<{ poi: string; players: number; role: string }>(p, "({ poi: window.__range.duel().poi.name, players: window.__range.duel().players, role: window.__range.duel().role })")));
  check("squad: both are in the same battle royale, dropping on the same place", kinds[0].poi === kinds[1].poi && kinds[0].players === 2 && kinds[1].players === 2 && kinds[0].role === "host" && kinds[1].role === "guest", JSON.stringify(kinds));
  for (const p of [host, guest]) await pressPlay(p);
  const dropped = await Promise.all([host, guest].map((p) => p.waitForFunction(`window.__range.duel().phase === "countdown" && window.__range.player.pos.y > 30`, { polling: 200, timeout: 15000 }).then(() => true, () => false)));
  check("squad: everyone in, both drop from the sky", dropped[0] && dropped[1], JSON.stringify(dropped));
  const landed = await Promise.all([host, guest].map((p) => p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 40000 }).then(() => true, () => false)));
  check("squad: the fight starts on both when the host lands", landed[0] && landed[1]);
  await sleep(1500);
  const seen = await ev<{ figures: number; bots: number; humans: number }>(guest, `(() => { const d = window.__range.duel(); const rs = [...d.remotes.values()]; return { figures: d.avatars.filter((a) => a.group.visible).length, bots: rs.filter((r) => r.id >= 100).length, humans: rs.filter((r) => r.id < 100).length }; })()`);
  check("squad: the guest sees the host and the three bots the host runs", seen.bots === 3 && seen.humans === 1 && seen.figures >= 3, JSON.stringify(seen));
  // abilities are on in a squad by default: the guest picks JOLT on landing and the host sees it
  await ev(guest, `window.__range.pickAbility("jolt")`);
  await ev(guest, "window.__range.useAbility()");
  const seenJolt = await host.waitForFunction("window.__range.remoteFxLog.some((e) => e.k === 'jolt' && e.from === 1)", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  check("squad: the guest's JOLT reaches the host", seenJolt, JSON.stringify(await ev(host, "window.__range.remoteFxLog")));
  // the guest knocks a bot: the hit goes to the host, the down comes back to both
  await ev(guest, `(() => { const d = window.__range.duel(); const r = [...d.remotes.values()].find((x) => x.id >= 100 && x.alive); for (let i = 0; i < 6; i++) d.localHit(r, 100, false); })()`);
  await sleep(1200);
  const after = await Promise.all([host, guest].map((p) => ev<{ alive: number; kills: number }>(p, "({ alive: window.__range.duel().hud().br.alive, kills: window.__range.duel().hud().br.kills })")));
  check("squad: the knock is the guest's, and both see one fewer alive", after[1].kills === 1 && after[0].kills === 0 && after[0].alive === 4 && after[1].alive === 4, JSON.stringify(after));
  // a ping: the guest marks a place, the host sees it
  await ev(guest, `(() => { const r = window.__range; const d = r.duel(); d.sendMark("go", r.player.pos.clone(), "GOING HERE"); })()`);
  const pinged = await host.waitForFunction("window.__range.brPlay.markers.some((m) => m.from === 1 && m.k === 'go')", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  check("squad: the guest's ping reaches the host", pinged);
  // the ring hurts a guest outside it on the guest's own clock (it used to tick about once a minute)
  const g0 = await ev<number>(guest, "(() => { const d = window.__range.duel(); window.__range.player.teleport(215, 0, 715, 0); return d.shield + d.health; })()");
  await sleep(3400);
  const g1 = await ev<number>(guest, "(() => { const d = window.__range.duel(); return d.shield + d.health; })()");
  check("squad: outside the ring the guest takes its damage every 1.5 s", g0 - g1 >= 4, `${g0} -> ${g1}`);
  await ev(guest, "(() => { const d = window.__range.duel(); d.shield = d.shieldMax; d.health = 100; window.__range.player.teleport(0, 0, 500, 0); })()");
  // the guest goes down (not out: the host is still up); the host sees it
  await ev(guest, `(() => { const d = window.__range.duel(); d.holdFire = true; d.takeHit(500, 100); })()`);
  await sleep(800);
  const guestDown = await ev<{ alive: boolean; downed: boolean; phase: string; left: number }>(guest, "(() => { const d = window.__range.duel(); return { alive: d.alive, downed: d.downed, phase: d.phase, left: d.bleedUntil - performance.now() / 1000 }; })()");
  const hostSees = await ev<{ phase: string; downed: boolean }>(host, "(() => { const d = window.__range.duel(); const r = d.remotes.get(1); return { phase: d.phase, downed: !!r && r.downed }; })()");
  check("squad: the guest is down, not out, bleeding out from 90 s; the host sees them down", guestDown.alive && guestDown.downed && guestDown.phase === "fight" && guestDown.left > 85 && hostSees.downed && hostSees.phase === "fight", JSON.stringify({ guestDown, hostSees }));
  await sleep(400);
  const crawl = await ev<{ stance: string; weapon: string }>(host, "(() => { const r = window.__range.duel().remotes.get(1); return { stance: r.samples.at(-1)?.stance ?? '', weapon: r.avatarWeapon }; })()");
  const gHud = await ev<{ downed: boolean; weapon: string }>(guest, "(() => { const s = window.__range.hud.last; return { downed: !!s?.downed, weapon: s?.weaponName ?? '' }; })()");
  check("squad: down you crawl with no gun, and the host sees you down", crawl.stance === "downed" && gHud.downed, JSON.stringify({ crawl, gHud }));
  // nobody holds a gun down: not in your view (the hands on the floor), not on the host's figure of you, not on your own in third person
  const gView = await ev<{ gun: boolean; hands: boolean; down: number }>(guest, "window.__range.vmState()");
  check("down: no gun in your view, your hands on the floor", !gView.gun && gView.hands && gView.down > 0.5, JSON.stringify(gView));
  const hostFig = await ev<{ holding: boolean; stance: string }>(host, "(() => { const a = window.__range.duel().remotes.get(1).avatar; return { holding: a.holdingGun, stance: a.currentPose.stance }; })()");
  check("down: the host's figure of you holds no gun", !hostFig.holding && hostFig.stance === "downed", JSON.stringify(hostFig));
  await ev(guest, "window.__range.setThirdPerson(true)");
  await sleep(300);
  const selfDown = await ev<{ holding: boolean; stance: string } | null>(guest, "(() => { const f = window.__range.selfFigure(); return f && { holding: f.holdingGun, stance: f.currentPose.stance }; })()");
  await ev(guest, "window.__range.setThirdPerson(false)");
  check("down: your own figure in third person holds no gun", !!selfDown && !selfDown.holding && selfDown.stance === "downed", JSON.stringify(selfDown));
  // the knockdown shield: held fire raises it at your EVO level's size; the host's figure of you shows it
  await ev(guest, padSet(7, true));
  await sleep(500);
  const kdG = await ev<{ up: boolean; hp: number; max: number }>(guest, "window.__range.kdState()");
  check("knockdown shield: holding fire while down raises it, full (200 / 450 / 750 by EVO level)", kdG.up && kdG.hp === kdG.max && [200, 450, 750].includes(kdG.max), JSON.stringify(kdG));
  const kdSeen = await host.waitForFunction("window.__range.duel().remotes.get(1)?.avatar.knockShieldUp === true", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  check("knockdown shield: the host sees it on the guest's figure", kdSeen);
  // a shot from in front goes into it; one from behind does not
  const front = await ev<{ kd: number; bleed: number }>(guest, `(() => { const r = window.__range; const d = r.duel(); const bot = [...d.remotes.values()].find((x) => x.id >= 100 && x.alive); const p = r.player.pos; const b = bot.avatar.group.position; r.player.yaw = Math.atan2(-(b.x - p.x), -(b.z - p.z)) * 180 / Math.PI; const k0 = r.kdState().hp; const b0 = d.bleedHp; d.takeHit(60, bot.id); return { kd: k0 - r.kdState().hp, bleed: b0 - d.bleedHp }; })()`);
  const behind = await ev<{ kd: number; bleed: number }>(guest, `(() => { const r = window.__range; const d = r.duel(); const bot = [...d.remotes.values()].find((x) => x.id >= 100 && x.alive); r.player.yaw += 180; const k0 = r.kdState().hp; const b0 = d.bleedHp; d.takeHit(10, bot.id); return { kd: k0 - r.kdState().hp, bleed: b0 - d.bleedHp }; })()`);
  check("knockdown shield: a hit from in front goes into it, one from behind into you", front.kd === 60 && front.bleed === 0 && behind.kd === 0 && behind.bleed === 10, JSON.stringify({ front, behind }));
  await ev(guest, padSet(7, false));
  await sleep(300);
  // the host walks over and holds E for 5 s: the guest is back up with 20 health
  await ev(host, `(() => { const r = window.__range; const d = r.duel(); d.holdFire = true; const g = d.remotes.get(1).samples.at(-1); r.player.teleport(g.x + 1.2, g.y, g.z, 90); })()`);
  await sleep(300);
  const revPrompt = await ev<string>(host, "JSON.stringify(window.__range.brPlay.hud.prompt)");
  check("squad: next to a downed mate the prompt is HOLD E to REVIVE", /REVIVE/.test(revPrompt), revPrompt);
  await ev(host, `window.__range.setScript({ held: (a) => a === "interact", pressedNow: () => false })`);
  const reviving = await guest.waitForFunction("window.__range.duel().revivedBy === 0", { polling: 100, timeout: 3000 }).then(() => true, () => false);
  check("squad: the guest sees the host reviving them", reviving);
  const revived = await guest.waitForFunction("!window.__range.duel().downed && window.__range.duel().alive", { polling: 100, timeout: 8000 }).then(() => true, () => false);
  await ev(host, "window.__range.setScript(null)");
  const hp = await ev<number>(guest, "window.__range.duel().health");
  check("squad: after 5 s of E the guest is back up with 20 health", revived && hp === 20, `health ${hp}`);
  // down again and finished off: out, the killcam, the banner for the squad (two cells on them first, for their box)
  await ev(guest, `window.__range.applyLoot({ kind: "heal", id: "cell", n: 2, rarity: "common" })`);
  await ev(guest, `(() => { const d = window.__range.duel(); d.takeHit(500, 100); })()`);
  await sleep(300);
  const second = await ev<{ downed: boolean; left: number }>(guest, "(() => { const d = window.__range.duel(); return { downed: d.downed, left: d.bleedUntil - performance.now() / 1000 }; })()");
  check("squad: the second knock bleeds out from 60 s", second.downed && second.left > 55 && second.left <= 60.5, JSON.stringify(second));
  await ev(guest, `(() => { const d = window.__range.duel(); d.takeHit(150, 100); })()`);
  await sleep(800);
  const guestOut = await ev<{ alive: boolean; phase: string }>(guest, "({ alive: window.__range.duel().alive, phase: window.__range.duel().phase })");
  const hostOn = await ev<string>(host, "window.__range.duel().phase");
  check("squad: finished while down: out, and the match goes on for the host", !guestOut.alive && guestOut.phase === "fight" && hostOn === "fight", JSON.stringify({ guestOut, hostOn }));
  const outFig = await ev<{ holding: boolean; knocked: boolean }>(host, "(() => { const a = window.__range.duel().remotes.get(1).avatar; return { holding: a.holdingGun, knocked: a.knocked }; })()");
  check("out: the host's figure of you is down and holds no gun", outFig.knocked && !outFig.holding, JSON.stringify(outFig));
  const banner = await host.waitForFunction("[...window.__range.duel().lootField.drops.values()].some((x) => x.item.kind === 'banner' && x.item.owner === 1)", { polling: 200, timeout: 4000 }).then(() => true, () => false);
  check("squad: the guest's death box holds their banner, on the host's floor too", banner);
  // Deathbox Respawn: the host holds interact at the guest's box (the lockout waived for the test): a beam for all, and the guest is back on it at 20 health
  await ev(host, "window.__range.duel().boxLockout = () => 0");
  const bAt = await ev<{ x: number; z: number } | null>(host, "(() => { const d = [...window.__range.duel().lootField.drops.values()].find((x) => x.item.kind === 'banner' && x.item.owner === 1); return d ? { x: d.pos.x, z: d.pos.z } : null; })()");
  await ev(host, `window.__range.player.teleport(${(bAt?.x ?? 0) + 1}, 0, ${bAt?.z ?? 0}, 90)`);
  await sleep(400);
  const boxPrompt = await ev<string>(host, "JSON.stringify(window.__range.brPlay.hud.prompt)");
  check("deathbox respawn: at a dead mate's box, a tap takes the banner, a hold respawns them", /HOLD: RESPAWN/.test(boxPrompt), boxPrompt);
  await ev(host, `window.__range.setScript({ held: (a) => a === "interact", pressedNow: () => false })`);
  const beamSeen = await guest.waitForFunction("window.__range.remoteFxLog.some((e) => e.k === 'beam' && e.from === 0)", { polling: 100, timeout: 4000 }).then(() => true, () => false);
  check("deathbox respawn: the beam goes up on the others' screens while it runs", beamSeen);
  const back = await guest.waitForFunction("window.__range.duel().alive", { polling: 100, timeout: 11000 }).then(() => true, () => false);
  await ev(host, "window.__range.setScript(null)");
  await sleep(600);
  const gBack = await ev<{ hp: number; d: number; regen: boolean; shield: number; max: number; things: number }>(guest, `(() => { const r = window.__range; const d = r.duel(); const p = r.player.pos; return { hp: d.health, d: Math.hypot(p.x - ${bAt?.x ?? 0}, p.z - ${bAt?.z ?? 0}), regen: !!r.kdState().box, shield: d.shield, max: d.shieldMax, things: r.loadout.slots.filter((s) => !s.empty).length + Object.values(r.kit.items).reduce((a, b) => a + b, 0) }; })()`);
  check("deathbox respawn: 7 s later the guest is up on the box at 20 health, the shield coming back from nothing, the box's things on", back && gBack.hp === 20 && gBack.d < 3 && gBack.regen && gBack.shield < gBack.max && gBack.things > 0, JSON.stringify(gBack));
  // out again for what follows: down, then finished
  await ev(guest, `(() => { const d = window.__range.duel(); d.takeHit(500, 100); })()`);
  await sleep(300);
  await ev(guest, `(() => { const d = window.__range.duel(); d.takeHit(150, 100); })()`);
  await sleep(800);
  const gk = await ev<{ active: boolean; killer: string }>(guest, "window.__range.killcamState()");
  check("squad: the guest's killcam is the bot that got them (a bot the host runs)", gk.active && /^BOT /.test(gk.killer), JSON.stringify(gk));
  // the host goes down too: no one left up to revive, so out; the squad is out, both get the placement
  await ev(host, `(() => { const d = window.__range.duel(); d.takeHit(500, 100); })()`);
  await sleep(1200);
  const ends = await Promise.all([host, guest].map((p) => ev<{ phase: string; placement: number | null }>(p, "({ phase: window.__range.duel()?.phase, placement: window.__range.duel()?.hud().br.placement })")));
  check("squad: with the last of the squad down both see the placement (#3: two bots still up)", ends.every((e) => e.phase === "matchEnd" && e.placement === 3), JSON.stringify(ends));
  await ev(host, "window.__range.duel()?.leave()");
  await sleep(500);
  await host.close();
  await guest.close();
}

async function duelTest(browser: Browser, query: string, label: string): Promise<boolean> {
  const host = await open(browser, query);
  const guest = await open(browser, query);
  // clicks through script, not the mouse: a background page gets no
  // animation frames, which puppeteer's mouse click waits on
  await ev(host, `document.getElementById("duelHost").click()`);
  let code = "";
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
  } catch {
    const msg = await ev<string>(host, `document.getElementById("duelStatus").textContent`);
    await host.close();
    await guest.close();
    console.log(`  --  ${label}: no match code (${msg})`);
    return false;
  }
  check(`${label}: the host gets a 5-letter code`, /^[A-Z0-9]{5}$/.test(code), code);
  // the lobby is the arena: the host is in it, with the code on the HUD, before anyone joins
  const lobby = await ev<{ x: number; z: number; lobby: string | null }>(host, `(() => { const p = window.__range.player.pos; return { x: p.x, z: p.z, lobby: window.__range.lobbyCode() }; })()`);
  check(`${label}: the host waits in the arena with the code on the HUD`, Math.abs(lobby.x - 90) < 0.5 && Math.abs(lobby.z + 69) < 0.5 && lobby.lobby === code, JSON.stringify(lobby));
  // Create and a connect take the players straight in (a scripted page gets the
  // lock too); back to the menu here, so the Play gate below is what is tested
  await toMenu(host);
  await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
  try {
    await host.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
    await guest.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  } catch {
    check(`${label}: both sides connect`, false, await ev<string>(guest, `document.getElementById("duelStatus").textContent`));
    await host.close();
    await guest.close();
    return true;
  }
  check(`${label}: both sides connect`, true);
  check(`${label}: roles`, (await ev<string>(host, "window.__range.duel().role")) === "host" && (await ev<string>(guest, "window.__range.duel().role")) === "guest");
  await toMenu(guest);
  await toMenu(host);

  // each sees the other at the other's spawn
  await sleep(1500);
  const seen = await ev<{ x: number; z: number; visible: boolean }>(
    host,
    `(() => { const g = window.__range.duel().avatars[0].group; return { x: g.position.x, z: g.position.z, visible: g.visible }; })()`
  );
  check(`${label}: the host sees the guest at the guest spawn (arena, far end)`, seen.visible && Math.abs(seen.x - 90) < 0.5 && Math.abs(seen.z + 11) < 0.5, `${seen.x.toFixed(1)}, ${seen.z.toFixed(1)}`);
  const seen2 = await ev<{ x: number; z: number }>(guest, `(() => { const g = window.__range.duel().avatars[0].group; return { x: g.position.x, z: g.position.z }; })()`);
  check(`${label}: and the guest sees the host at the host spawn`, Math.abs(seen2.x - 90) < 0.5 && Math.abs(seen2.z + 69) < 0.5, `${seen2.x.toFixed(1)}, ${seen2.z.toFixed(1)}`);

  // nobody has clicked Play: the host holds at "waiting" (the countdown used
  // to start the moment the guest connected, with both still on the menu)
  await sleep(800);
  const held = await ev<{ phase: string; waiting: string | null }>(host, "({ phase: window.__range.duel().phase, waiting: window.__range.duel().hud().waiting })");
  check(`${label}: the match waits until everyone clicks Play`, held.phase === "waiting" && /PLAY/.test(held.waiting ?? ""), JSON.stringify(held));
  await pressPlay(host);
  await sleep(400);
  const stillHeld = await ev<string>(host, "window.__range.duel().phase");
  check(`${label}: one player in is not enough`, stillHeld === "waiting", stillHeld);
  await pressPlay(guest);
  // the countdown ends on both sides
  await host.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 15000 });
  await guest.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 15000 });
  check(`${label}: countdown ends, both sides fighting`, true);

  // a 50 damage hit comes off the guest's shield first
  await ev(host, "(() => { const d = window.__range.duel(); d.localHit(d.remoteOf(d.avatars[0]), 50, false); })()");
  await guest.waitForFunction("window.__range.duel().shield < 75", { polling: 200, timeout: 10000 });
  const g1 = await ev<{ sh: number; hp: number }>(guest, "({ sh: window.__range.duel().shield, hp: window.__range.duel().health })");
  check(`${label}: a 50 hit takes the guest's shield 75 to 25, health untouched`, g1.sh === 25 && g1.hp === 100, `shield ${g1.sh} health ${g1.hp}`);

  // a big one knocks: the host takes the round
  await ev(host, "(() => { const d = window.__range.duel(); d.localHit(d.remoteOf(d.avatars[0]), 200, true); })()");
  await guest.waitForFunction("window.__range.duel().alive === false", { polling: 200, timeout: 10000 });
  await host.waitForFunction(`window.__range.duel().hud().you === 1`, { polling: 200, timeout: 10000 });
  await guest.waitForFunction(`window.__range.duel().hud().them === 1`, { polling: 200, timeout: 10000 });
  check(`${label}: a knock scores the round 1-0 for the host, on both screens`, true);
  const feedH = await ev<string[]>(host, "window.__range.hud.feedText");
  const feedG = await ev<string[]>(guest, "window.__range.hud.feedText");
  check(`${label}: the kill feed says who knocked whom, on both screens`, feedH.some((t) => /knocked/.test(t)) && feedG.some((t) => /knocked/.test(t)), `host: ${feedH[0] ?? "-"} | guest: ${feedG[0] ?? "-"}`);
  // the host sees the guest's figure fall over (it used to stay standing)
  const fell = await host
    .waitForFunction("window.__range.duel().avatars[0].group.rotation.x < -1", { polling: 100, timeout: 2500 })
    .then(() => true, () => false);
  check(`${label}: the knocked player's figure falls over on the other screen`, fell);
  const phase = await ev<string>(guest, "window.__range.duel().phase");
  check(`${label}: the guest sees the round end`, phase === "roundEnd" || phase === "countdown", phase);

  // next round: both back at full
  await guest.waitForFunction("window.__range.duel().round === 2 && window.__range.duel().alive", { polling: 200, timeout: 15000 });
  const g2 = await ev<{ sh: number; hp: number }>(guest, "({ sh: window.__range.duel().shield, hp: window.__range.duel().health })");
  check(`${label}: round 2 restores the guest to 75 shield and 100 health`, g2.sh === 75 && g2.hp === 100, `shield ${g2.sh} health ${g2.hp}`);

  // The circle: stand in it alone once it is live (20 s into the round) for
  // 10 s and the round is yours. Only on the local transport, it takes 30 s.
  if (label === "local") {
    await host.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 20000 });
    const fightAt = Date.now();
    await ev(host, `(() => { const p = window.__range.player; p.teleport(90, 0, -40, 180); })()`);
    const live = await host.waitForFunction(`window.__range.duel().hud().zone.live`, { polling: 250, timeout: 30000 }).then(() => true, () => false);
    // real seconds: the round clock is wall time now, not the game clock
    const liveAfter = (Date.now() - fightAt) / 1000;
    check(`${label}: the circle goes live 20 s into the round, in real time`, live && liveAfter >= 18 && liveAfter <= 23.5, `${liveAfter.toFixed(1)} s`);
    const took = await host.waitForFunction(`window.__range.duel().hud().you === 2`, { polling: 250, timeout: 20000 }).then(() => true, () => false);
    check(`${label}: holding it alone for 10 s takes the round (2-0)`, took);
    const gsaw = await guest.waitForFunction(`window.__range.duel().hud().them === 2`, { polling: 250, timeout: 10000 }).then(() => true, () => false);
    check(`${label}: and the guest's screen agrees`, gsaw);
  }

  // leaving tells the other side
  await ev(guest, "window.__range.duel().leave()");
  await host.waitForFunction("window.__range.duel() === null", { polling: 200, timeout: 15000 });
  check(`${label}: leaving ends the match on the other side`, true);
  await host.close();
  await guest.close();
  return true;
}

/** three tabs: the host makes a 3-player match, two guests join, the host knocks both */
async function tripleTest(browser: Browser, query: string): Promise<void> {
  const host = await open(browser, query);
  const g1 = await open(browser, query);
  const g2 = await open(browser, query);
  const pages = [host, g1, g2];
  const closeAll = async () => {
    for (const p of pages) await p.close();
  };
  await ev(host, `(() => { document.getElementById("duelPlayers").value = "3"; document.getElementById("duelHost").click(); })()`);
  let code = "";
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
  } catch {
    check("1v1v1: the host gets a code", false, await ev<string>(host, `document.getElementById("duelStatus").textContent`));
    await closeAll();
    return;
  }
  await ev(g1, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
  await host.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  const waiting = await ev<string>(host, "window.__range.duel().phase");
  check("1v1v1: with one guest in, the host waits for the second", waiting === "waiting", waiting);
  await ev(g2, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
  try {
    for (const p of pages) await p.waitForFunction("window.__range.duel() !== null && window.__range.duel().players === 3", { polling: 200, timeout: 30000 });
  } catch {
    check("1v1v1: all three connect", false, await ev<string>(g2, `document.getElementById("duelStatus").textContent`));
    await closeAll();
    return;
  }
  check("1v1v1: all three connect", true);
  const ids = await Promise.all(pages.map((p) => ev<number>(p, "window.__range.duel().id")));
  check("1v1v1: ids 0, 1, 2", ids.join(",") === "0,1,2", ids.join(","));
  await sleep(1500);
  const seen = await ev<number>(host, "window.__range.duel().avatars.filter((a) => a.group.visible).length");
  check("1v1v1: the host sees two figures", seen === 2, `${seen}`);
  const seenByGuest = await ev<number>(g2, "window.__range.duel().avatars.filter((a) => a.group.visible).length");
  check("1v1v1: a guest sees the other two (one relayed by the host)", seenByGuest === 2, `${seenByGuest}`);
  const spawns = await Promise.all(pages.map((p) => ev<{ x: number; z: number }>(p, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })")));
  const distinct = new Set(spawns.map((sp) => `${sp.x.toFixed(0)},${sp.z.toFixed(0)}`)).size;
  check("1v1v1: three different corners of the triangle", distinct === 3 && spawns.every((sp) => Math.hypot(sp.x - 90, sp.z - 60) > 15), JSON.stringify(spawns.map((sp) => [+sp.x.toFixed(1), +sp.z.toFixed(1)])));
  for (const p of pages) await pressPlay(p);
  for (const p of pages) await p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 15000 });
  check("1v1v1: the countdown ends on all three", true);
  // the host knocks guest 1: the round goes on (two standing)
  await ev(host, `(() => { const d = window.__range.duel(); const r = [...d.remotes.values()].find((x) => x.id === 1); d.localHit(r, 200, true); })()`);
  await g1.waitForFunction("window.__range.duel().alive === false", { polling: 200, timeout: 10000 });
  await sleep(600);
  const still = await ev<string>(host, "window.__range.duel().phase");
  check("1v1v1: one down, two standing: the round goes on", still === "fight", still);
  const g2sees = await ev<boolean>(g2, `(() => { const d = window.__range.duel(); const r = [...d.remotes.values()].find((x) => x.id === 1); return r ? !r.alive : false; })()`);
  check("1v1v1: the other guest sees player 2 down (relayed)", g2sees);
  // then guest 2: last standing, the host takes the round on every screen
  await ev(host, `(() => { const d = window.__range.duel(); const r = [...d.remotes.values()].find((x) => x.id === 2); d.localHit(r, 200, true); })()`);
  const scored = await Promise.all(pages.map((p) => p.waitForFunction(`window.__range.duel().hud().players.find((x) => x.name === window.__range.duel().hud().players[0].name) && window.__range.duel().hud().players.reduce((a, x) => a + x.score, 0) === 1`, { polling: 200, timeout: 10000 }).then(() => true, () => false)));
  check("1v1v1: last one standing, the host takes the round on all three screens", scored.every(Boolean), scored.join(","));
  const hostYou = await ev<number>(host, "window.__range.duel().hud().you");
  check("1v1v1: and it is the host's point", hostYou === 1, `${hostYou}`);
  // a guest leaves: the match carries on as a 1v1 for the other two
  await ev(g1, "window.__range.duel().leave()");
  await host.waitForFunction("window.__range.duel() !== null && window.__range.duel().avatars.length === 1", { polling: 200, timeout: 10000 }).then(() => true, () => false);
  const left = await ev<number>(host, "window.__range.duel() ? window.__range.duel().avatars.length : -1");
  check("1v1v1: a guest leaving drops to a 1v1 for the other two", left === 1, `${left} figures left on the host`);
  await ev(host, "window.__range.duel().leave()");
  await g2.waitForFunction("window.__range.duel() === null", { polling: 200, timeout: 10000 });
  check("1v1v1: the host leaving ends it for the rest", true);
  await closeAll();
}

/**
 * The tiers play differently (src/config/bots.json): an elite bot hears a shot
 * out of its sight, throws a frag at you standing still in view, crouches in
 * the fight, dodges when hit; low, it breaks line of sight to heal.
 */
async function botTiersTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  await ev(page, `document.getElementById("overlay").classList.add("hidden")`);
  await ev(page, `(() => { document.getElementById("botCount").value = "1"; document.getElementById("botDifficulty").value = "elite"; window.__range.startBots(); })()`);
  await page.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 15000 });
  const tier = await ev<string>(page, "window.__range.duel().bots[0].diff.name");
  check("tiers: the elite select makes an elite bot", tier === "elite", tier);
  // you cannot be hurt here; the hits are written down instead (what hit you, for the frag)
  await ev(page, `(() => { const d = window.__range.duel(); window.__hits = []; d.takeHit = (amount, from, weapon) => { window.__hits.push(weapon); }; })()`);
  // hearing: out of its sight, your shot brings it to look (elite hears every one in earshot)
  await ev(page, `(() => { const d = window.__range.duel(); const b = d.bots[0]; b.sees = () => false; const p = window.__range.player.pos; d.localShot(p.clone().setY(p.y + 1.5), new window.__range.THREE.Vector3(0, 0, -1), "r97"); })()`);
  const heard = await ev<boolean>(page, "!!window.__range.duel().bots[0].heard");
  check("tiers: out of its sight, an elite bot hears your shot and goes to look", heard);
  await ev(page, `delete window.__range.duel().bots[0].sees`);
  // a frag at you standing still in its view: it keeps 18 m off, you stay put in the open
  await ev(page, `(() => { const d = window.__range.duel(); const b = d.bots[0]; b.diff = { ...b.diff, keep: 17 }; const s = window.__range.openGround(90, -40, 1.5); window.__range.player.teleport(s.x, 0, s.z, 0); })()`);
  const threw = await page.waitForFunction("window.__range.remoteFxLog.some((e) => e.k === 'throw' && e.from === 1)", { polling: 200, timeout: 14000 }).then(() => true, () => false);
  check("tiers: you stand still in view and the elite bot throws a frag at you", threw, JSON.stringify(await ev(page, "(() => { const b = window.__range.duel().bots[0]; return { frags: b.frags, d: b.pos.distanceTo(window.__range.player.pos).toFixed(1), seen: !!b.lastSeen }; })()")));
  const fragHit = await page.waitForFunction("window.__hits.includes('frag')", { polling: 200, timeout: 7000 }).then(() => true, () => false);
  check("tiers: and the frag's blast lands on you (the bot's side works it out)", fragHit, JSON.stringify(await ev(page, "window.__hits.slice(-6)")));
  // it crouches now and then in the fight (close in, where nothing low stands between you), and dodges when hit
  await ev(page, "(() => { const b = window.__range.duel().bots[0]; b.diff = { ...b.diff, keep: 6 }; })()");
  const crouched = await page.waitForFunction("window.__range.duel().bots[0].crouching", { polling: 50, timeout: 12000 }).then(() => true, () => false);
  check("tiers: the elite bot crouches while it fires", crouched);
  const dodge = await ev<boolean>(page, `(() => { const b = window.__range.duel().bots[0]; const before = b.strafeSign; b.dummy.hit(0, "body", 5, 1, 1, b.pos.clone().setY(1.2)); return new Promise((r) => setTimeout(() => r(b.strafeSign !== before), 400)); })()`);
  check("tiers: hit, it reverses its strafe (hard and elite always dodge)", dodge);
  // low: it finds cover out of your sight and heals there
  await ev(page, `(() => { const b = window.__range.duel().bots[0]; b.diff = { ...b.diff, keep: 6 }; b.dummy.shield = 0; b.dummy.health = 30; })()`);
  const covered = await page.waitForFunction("!!window.__range.duel().bots[0].cover", { polling: 100, timeout: 6000 }).then(() => true, () => false);
  check("tiers: low, it picks a spot out of your sight", covered);
  const healed = await page.waitForFunction("(() => { const b = window.__range.duel().bots[0]; return b.dummy.health + b.dummy.shield > 30 || !!b.healing; })()", { polling: 100, timeout: 12000 }).then(() => true, () => false);
  const hidden = await ev<boolean>(page, "(() => { const b = window.__range.duel().bots[0]; return !b.sees(window.__range.player.pos); })()");
  check("tiers: and heals there, out of your sight", healed && hidden, JSON.stringify({ healed, hidden }));
  await ev(page, "window.__range.duel().leave()");
  // an easy bot does none of it
  await ev(page, `(() => { document.getElementById("botDifficulty").value = "easy"; window.__range.startBots(); })()`);
  await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 15000 });
  const easy = await ev<{ name: string; grenade: unknown; cover: boolean; dodge: number }>(page, "(() => { const b = window.__range.duel().bots[0]; return { name: b.diff.name, grenade: b.diff.grenadeAfter, cover: b.diff.cover, dodge: b.diff.dodge }; })()");
  check("tiers: an easy bot throws nothing, takes no cover, never dodges", easy.name === "easy" && easy.grenade === null && !easy.cover && easy.dodge === 0, JSON.stringify(easy));
  await ev(page, "window.__range.duel().leave()");
  await ev(page, `document.getElementById("botDifficulty").value = "normal"`);
  await page.close();
}

/** one page against a bot: it comes for you, shoots, and can be knocked */
async function botsTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  await ev(page, `document.getElementById("overlay").classList.add("hidden")`);
  await ev(page, `(() => { document.getElementById("botCount").value = "1"; document.getElementById("botDifficulty").value = "hard"; window.__range.startBots(); })()`);
  const d0 = await ev<{ kind: string; players: number; n: number } | null>(page, "window.__range.duel() ? { kind: window.__range.duel().kind, players: window.__range.duel().players, n: window.__range.duel().avatars.length } : null");
  check("bots: a bot match starts with one bot", d0 !== null && d0.kind === "bots" && d0.players === 2 && d0.n === 1, JSON.stringify(d0));
  await page.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 15000 });
  const offAb = await ev<{ on: boolean; choosing: boolean }>(page, "({ on: window.__range.abilities.enabled, choosing: window.__range.abilities.choosing })");
  check("bots: abilities are off by default, no card", !offAb.on && !offAb.choosing, JSON.stringify(offAb));
  // the bot hunts you down the middle lane and shoots: the shield drops
  const shot = await page.waitForFunction("window.__range.duel().shield < 75", { polling: 250, timeout: 25000 }).then(() => true, () => false);
  const pos = await ev<{ x: number; z: number; sh: number }>(page, "(() => { const b = window.__range.duel().avatars[0].group.position; return { x: b.x, z: b.z, sh: window.__range.duel().shield }; })()");
  check("bots: the bot closes in and lands a shot", shot, `bot at ${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}, your shield ${pos.sh}` + (shot ? "" : " " + JSON.stringify(await ev(page, `(() => { const d = window.__range.duel(); const b = d.bots[0]; const pl = window.__range.player.pos; return { y: b.pos.y, you: [pl.x.toFixed(1), pl.z.toFixed(1)], sees: b.sees(pl), crouch: b.crouching, cover: !!b.cover, heard: !!b.heard, seen: b.lastSeen && [b.lastSeen.pos.x.toFixed(1), b.lastSeen.pos.z.toFixed(1)], slideDir: b.slideDir, joltLeft: b.joltLeft, healing: !!b.healing }; })()`))));
  check("bots: it moved off its spawn toward you", pos.z < -12, `z ${pos.z.toFixed(1)}`);
  const snd = await ev<{ played: number; voices: number }>(page, "({ played: window.__range.audio.played, voices: window.__range.audio.voiceCount })");
  check("sound: the fight is heard (its shots and footsteps), under the voice cap", snd.played > 5 && snd.voices <= 56, JSON.stringify(snd));
  // the recorded CC0 samples (npm run sounds) load and are layered in (a checkout without them is the synthesis alone)
  const rec = await ev<{ loaded: number; played: number; files: boolean }>(page, "(async () => { const a = window.__range.audio; a.land(1, 'concrete'); a.punch(null); return { loaded: a.sampleCount, played: a.samplesPlayed, files: (await fetch('audio/kenney/index.json')).ok }; })()");
  check("sound: the recorded samples are loaded and layered into the fight's sounds", !rec.files || (rec.loaded >= 10 && rec.played > 0), JSON.stringify(rec));
  // knock it: a hit through its dummy, then the match is told
  await ev(page, `(() => { const d = window.__range.duel(); const a = d.avatars[0]; const pt = { clone() { return this; } }; a.hit(0, "body", 500, 1, 1, pt); d.localHit(d.remoteOf(a), 500, false); })()`);
  const won = await page.waitForFunction("window.__range.duel().hud().you === 1", { polling: 200, timeout: 5000 }).then(() => true, () => false);
  check("bots: knocking the bot takes the round", won);
  // the bot's gun leaves its hands: a copy on the floor (it has had time to land), none in its hands
  await sleep(900);
  const botGun = await ev<{ holding: boolean; dropped: boolean; y: number; floor: number }>(page, "(() => { const a = window.__range.duel().avatars[0]; const g = a.droppedGun; return { holding: a.holdingGun, dropped: !!g && !!g.parent, y: g ? g.position.y : -1, floor: a.group.position.y }; })()");
  check("bots: knocked out, the bot drops its gun (on the floor, not in its hands)", !botGun.holding && botGun.dropped && botGun.y < botGun.floor + 0.3, JSON.stringify(botGun));
  const bfeed = await ev<string[]>(page, "window.__range.hud.feedText");
  check("bots: the kill feed has the knock", bfeed.some((t) => /knocked BOT/.test(t)), bfeed[0] ?? "-");
  await ev(page, "window.__range.duel().leave()");
  const gone = await ev<boolean>(page, "window.__range.duel() === null");
  check("bots: leaving ends the match", gone);
  // the same with abilities on: the card at the countdown, JOLT, the bots have theirs
  await ev(page, `(() => { const s = document.getElementById("botAbilities"); s.value = "1"; s.dispatchEvent(new Event("change")); window.__range.startBots(); })()`);
  const cardUp = await page.waitForFunction("window.__range.abilities.choosing === true", { polling: 100, timeout: 5000 }).then(() => true, () => false);
  check("bots with abilities: the card is up at the countdown", cardUp);
  const botAb = await ev<string[]>(page, "window.__range.duel().bots.map((b) => String(b.ability))");
  check("bots with abilities: the bot has one too", botAb.every((a) => a === "jolt" || a === "triage"), botAb.join(","));
  await ev(page, `window.__range.pickAbility("jolt")`);
  await page.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 15000 });
  const p0 = await ev<{ x: number; z: number }>(page, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })");
  // third person, where your own streak is drawn (in first person you are inside it)
  await ev(page, "window.__range.setThirdPerson(true)");
  await ev(page, "window.__range.useAbility()");
  const streak = await ev<number>(page, "window.__range.fxCount()");
  await ev(page, "window.__range.setThirdPerson(false)");
  check("bots with abilities: JOLT leaves its streak (third person)", streak > 0, `${streak} effects`);
  await sleep(500);
  const j = await ev<{ x: number; z: number }>(page, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })");
  const moved = Math.hypot(j.x - p0.x, j.z - p0.z);
  check("bots with abilities: JOLT dashes you (up to 10 m, a wall can stop it short)", moved > 3 && moved < 14, `${moved.toFixed(2)} m (the dash, then its exit speed running down)`);
  const ch1 = await ev<{ charges: number; nextIn: number }>(page, "window.__range.abilities.charge(window.__range.gameTime())");
  check("bots with abilities: one of JOLT's two charges spent, coming back", ch1.charges === 1 && ch1.nextIn > 2.5 && ch1.nextIn < 4, JSON.stringify(ch1));
  // back the way you came (the first may have run you up to a wall), then the second, sideways (D held): the view leans into it
  await ev(page, "window.__range.player.yaw += 180");
  await ev(page, `window.__range.setScript({ held: (a) => a === "right", pressedNow: () => false })`);
  await sleep(100);
  await ev(page, "window.__range.useAbility()");
  const rolled = await page.waitForFunction("window.__range.joltFeel().roll > 1.2 && window.__range.joltFeel().fov > 0.03", { polling: 10, timeout: 1500 }).then(() => true, () => false);
  await sleep(300);
  await ev(page, "window.__range.setScript(null)");
  check("bots with abilities: a sideways JOLT rolls the view toward it and widens it", rolled);
  const j2 = await ev<{ x: number; z: number }>(page, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })");
  const cd = await ev<number>(page, "window.__range.abilities.cooldownLeft(window.__range.gameTime())");
  check("bots with abilities: the second charge dashes again", Math.hypot(j2.x - j.x, j2.z - j.z) > 2, `${Math.hypot(j2.x - j.x, j2.z - j.z).toFixed(2)} m`);
  check("bots with abilities: then both are spent until the first is back (4 s)", cd > 2 && cd < 4, cd.toFixed(2));
  const hudAb = await ev<{ charges?: number; max?: number } | null>(page, "window.__range.hud.last.ability");
  check("bots with abilities: the HUD shows the charges", hudAb?.charges === 0 && hudAb?.max === 2, JSON.stringify(hudAb));
  await ev(page, "window.__range.duel().leave()");
  await ev(page, `(() => { const s = document.getElementById("botAbilities"); s.value = "0"; s.dispatchEvent(new Event("change")); })()`);

  // eliminated by the bot: the killcam from its eyes, then the recap with both sides
  await ev(page, `(() => { document.getElementById("botCount").value = "1"; document.getElementById("botDifficulty").value = "hard"; window.__range.startBots(); })()`);
  await page.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 15000 });
  // your two hits on it first (a head and a body, 12 m), then almost nothing left for its next round to take
  await ev(page, "window.__range.landHit(1, 20, true, 'r97', 12)");
  await ev(page, "window.__range.landHit(1, 15, false, 'r97', 12)");
  await ev(page, "(() => { const d = window.__range.duel(); d.shield = 0; d.health = 3; })()");
  const out = await page.waitForFunction("window.__range.duel() && !window.__range.duel().alive", { polling: 100, timeout: 30000 }).then(() => true, () => false);
  check("recap: the bot eliminates you", out, out ? "" : JSON.stringify(await ev(page, `(() => { const d = window.__range.duel(); const b = d.bots[0]; const pl = window.__range.player.pos; return { phase: d.phase, alive: d.alive, hp: d.health, bot: [b.pos.x.toFixed(1), b.pos.y.toFixed(1), b.pos.z.toFixed(1)], you: [pl.x.toFixed(1), pl.y.toFixed(1), pl.z.toFixed(1)], sees: b.sees(pl), crouch: b.crouching, cover: !!b.cover, heard: !!b.heard, seen: !!b.lastSeen, knocked: b.dummy.knocked, joltLeft: b.joltLeft, dropping: b.dropping }; })()`)));
  const kc = await ev<{ active: boolean; killer: string; weapon: string; frames: number; span: number }>(page, "window.__range.killcamState()");
  check("killcam: it starts, from the bot's eyes, with its gun", kc.active && kc.killer === "BOT ASH" && kc.weapon === "rspn101", JSON.stringify(kc));
  const kcView = await ev<{ gun: boolean; hands: boolean }>(page, "window.__range.vmState()");
  check("killcam: the killer's gun is in view (not your empty hands)", kcView.gun, JSON.stringify(kcView));
  check("killcam: the recording holds seconds of the match", kc.frames > 60 && kc.span > 2, JSON.stringify(kc));
  await sleep(1500);
  const mid = await ev<{ active: boolean; progress: number }>(page, "window.__range.killcamState()");
  check("killcam: it plays on", mid.active && mid.progress > 0.2, JSON.stringify(mid));
  await ev(page, "window.__range.skipKillcam()");
  const rc = await ev<{ killerName: string; rows: Array<{ name: string; killer: boolean; dealt: { damage: number; hits: number; heads: number }; taken: { damage: number; hits: number }; guns: Array<{ name: string; near: number | null }>; left: { shield: number; health: number } | null }> } | null>(page, "window.__range.recap()");
  const row = rc?.rows[0];
  check("recap: eliminated by the bot, the killer first", rc?.killerName === "BOT ASH" && row?.killer === true, JSON.stringify(rc?.killerName));
  check("recap: your side: 35 in 2 hits, 1 head", row?.dealt.damage === 35 && row.dealt.hits === 2 && row.dealt.heads === 1, JSON.stringify(row?.dealt));
  check("recap: its side: the damage and hits it landed", !!row && row.taken.damage > 0 && row.taken.hits > 0, JSON.stringify(row?.taken));
  check("recap: its gun and the distance", !!row && row.guns.length > 0 && /R-301|CARBINE/i.test(row.guns[0].name) && (row.guns[0].near ?? 0) > 1, JSON.stringify(row?.guns));
  check("recap: what it had left (75 + 100 less your 35)", !!row?.left && row.left.shield + row.left.health === 140, JSON.stringify(row?.left));
  // the bot heals when it has had nobody to shoot for a while: your next life's recap would say so
  await ev(page, "window.__range.closeRecap()");
  check("recap: it closes", (await ev<unknown>(page, "window.__range.recap()")) === null);
  await ev(page, "window.__range.duel().leave()");
  await page.close();
}

/**
 * Throwables: G readies one and again the next; a frag at a bot's feet takes
 * its shield and a quarter of its health; thermite under it burns it; and
 * over the local transport a friend's arc star sticks to you, goes off, slows
 * you, and you saw it thrown.
 */
async function throwTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  await ev(page, `(() => { document.getElementById("botCount").value = "1"; document.getElementById("botDifficulty").value = "easy"; window.__range.startBots(); })()`);
  await pressPlay(page);
  await page.waitForFunction(`window.__range.duel()?.phase === "fight"`, { polling: 200, timeout: 15000 });
  // the bot stands still on open ground 6 m in front of you, and does not shoot
  await ev(page, `(() => { const r = window.__range; const d = r.duel(); const b = d.bots[0]; b.update = function (now, dt) { this.dummy.update(now, dt); return []; }; b.pos.set(90, 0, -1); b.dummy.group.position.copy(b.pos); r.player.teleport(90, 0, 5, 0); })()`);
  const kit = await ev<{ counts: Record<string, number>; endless: boolean }>(page, "({ counts: { ...window.__range.ordnance.counts }, endless: window.__range.ordnance.endless })");
  check("throwables: a bot match gives one of each and counts them", !kit.endless && kit.counts.frag === 1 && kit.counts.arcstar === 1 && kit.counts.thermite === 1, JSON.stringify(kit));
  // the key itself (a scripted page has no pointer lock: the lock flag stands in)
  await ev(page, "window.__range.input.locked = true");
  await page.keyboard.press("KeyG");
  await sleep(150);
  const first = await ev<string | null>(page, "window.__range.ordnance.readied?.kind ?? null");
  await page.keyboard.press("KeyG");
  await sleep(150);
  const second = await ev<string | null>(page, "window.__range.ordnance.readied?.kind ?? null");
  check("throwables: G readies the frag, again the arc star", first === "frag" && second === "arcstar", `${first} then ${second}`);
  const lowered = await ev<string>(page, "window.__range.hud.last?.ordnance?.readied ?? ''");
  check("throwables: the HUD names the one in hand", /STAR/.test(lowered), lowered);
  await ev(page, "(() => { window.__range.ordnance.readied = null; window.__range.input.locked = false; })()");
  // a frag at its feet: the full 100 (its 75 shield, then 25 health)
  await ev(page, `(() => { const r = window.__range; const b = r.duel().bots[0]; r.throwAt("frag", new r.THREE.Vector3(b.pos.x, 0.3, b.pos.z + 0.6), new r.THREE.Vector3(0, 0, 0)); })()`);
  await sleep(3500);
  const pre = await ev<number>(page, "(() => { const a = window.__range.duel().avatars[0]; return a.health + a.shield; })()");
  await sleep(1100);
  const post = await ev<{ hp: number; sh: number }>(page, "(() => { const a = window.__range.duel().avatars[0]; return { hp: a.health, sh: a.shield }; })()");
  check("throwables: nothing before the 4 s fuse; then a frag at its feet takes 100 (75 shield, 25 health)", pre === 175 && post.sh === 0 && post.hp === 75, JSON.stringify({ pre, ...post }));
  // thermite under it: 4 a tick, twice a second
  await ev(page, `(() => { const r = window.__range; const b = r.duel().bots[0]; r.throwAt("thermite", new r.THREE.Vector3(b.pos.x, 0.3, b.pos.z + 0.4), new r.THREE.Vector3(0, -2, -0.5)); })()`);
  await sleep(2100);
  const burnt = await ev<number>(page, "window.__range.duel().avatars[0].health");
  check("throwables: thermite under it burns it, 4 a tick", burnt <= 75 - 12 && burnt >= 75 - 24, `health ${burnt}`);
  // the throw takes the click: the gun in hand does not fire with it (it used to, the same frame)
  await ev(page, "(() => { window.__range.input.locked = true; window.__range.player.teleport(90, 0, 12, 180); })()");
  await page.keyboard.press("KeyG");
  await sleep(700);
  const clip0 = await ev<number>(page, "window.__range.loadout.active.state.clip");
  await ev(page, "(() => { window.__pad.buttons[7].pressed = true; window.__pad.buttons[7].value = 1; })()");
  await sleep(350);
  await ev(page, "(() => { window.__pad.buttons[7].pressed = false; window.__pad.buttons[7].value = 0; })()");
  const thrown = await ev<{ live: number; clip: number }>(page, "({ live: window.__range.throwables.live.filter((t) => t.mine && t.kind === 'frag').length, clip: window.__range.loadout.active.state.clip })");
  check("throwables: a click throws the grenade and the gun does not fire with it", thrown.live >= 1 && thrown.clip === clip0, JSON.stringify({ clip0, ...thrown }));
  await ev(page, "window.__range.input.locked = false");
  await ev(page, "window.__range.duel().leave()");
  await sleep(200);
  const range = await ev<{ endless: boolean; live: number }>(page, "({ endless: window.__range.ordnance.endless, live: window.__range.throwables.live.length + window.__range.throwables.fires.length })");
  check("throwables: back in the range, no count and nothing left burning", range.endless && range.live === 0, JSON.stringify(range));
  await page.close();

  // ---- a friend's arc star, over the local transport
  const host = await open(browser, "?net=local&norender");
  const guest = await open(browser, "?net=local&norender");
  await ev(host, `document.getElementById("duelHost").click()`);
  let code = "";
  try {
    await host.waitForSelector("#duelStatus .code", { timeout: 20000 });
    code = await ev<string>(host, `document.querySelector("#duelStatus .code").textContent`);
  } catch {
    check("throwables: a 1v1 to throw in", false);
    await host.close();
    await guest.close();
    return;
  }
  await ev(guest, `(() => { document.getElementById("duelCode").value = "${code}"; document.getElementById("duelJoin").click(); })()`);
  for (const p of [host, guest]) await p.waitForFunction("window.__range.duel() !== null", { polling: 200, timeout: 30000 });
  for (const p of [host, guest]) await pressPlay(p);
  for (const p of [host, guest]) await p.waitForFunction(`window.__range.duel().phase === "fight"`, { polling: 200, timeout: 20000 });
  await sleep(600);
  // at the guest's chest, from a metre in front of them: it sticks (+10), then 75
  await ev(host, `(() => { const r = window.__range; const g = r.duel().avatars[0].group.position; r.throwAt("arcstar", new r.THREE.Vector3(g.x, g.y + 1.2, g.z - 1.1), new r.THREE.Vector3(0, 0, 6)); })()`);
  const seen = await guest.waitForFunction("window.__range.throwables.live.some((t) => t.kind === 'arcstar' && !t.mine)", { polling: 50, timeout: 3000 }).then(() => true, () => false);
  check("throwables: the guest sees the host's arc star in the air", seen);
  const hit = await guest.waitForFunction("window.__range.duel().shield + window.__range.duel().health <= 175 - 80", { polling: 100, timeout: 6000 }).then(() => true, () => false);
  const g1 = await ev<{ sh: number; hp: number; slowed: number }>(guest, "(() => { const d = window.__range.duel(); return { sh: d.shield, hp: d.health, slowed: window.__range.player.arcSlowUntil - window.__range.gameTime() }; })()");
  check("throwables: it sticks to the guest and goes off: 10 and 75, and they are slowed", hit && g1.sh + g1.hp === 175 - 85 && g1.slowed > 2, JSON.stringify(g1));
  await ev(guest, "window.__range.duel()?.leave()");
  await host.waitForFunction("window.__range.duel() === null", { polling: 200, timeout: 8000 }).catch(() => undefined);
  await host.close();
  await guest.close();
}

/** a fake controller on a page (if it has none) and a button held or let go */
const padSet = (i: number, on: boolean) =>
  `(() => {
    if (!window.__pad) {
      const btn = () => ({ pressed: false, touched: false, value: 0 });
      const pad = { index: 0, id: "fake pad", connected: true, mapping: "standard", timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn) };
      window.__pad = pad;
      navigator.getGamepads = () => [pad];
    }
    window.__pad.buttons[${i}].pressed = ${on};
    window.__pad.buttons[${i}].value = ${on ? 1 : 0};
  })()`;
const padTap = async (page: Page, i: number, ms = 120): Promise<void> => {
  await ev(page, padSet(i, true));
  await sleep(ms);
  await ev(page, padSet(i, false));
  await sleep(120);
};

/**
 * The finishing touches: toggle ADS and crouch, per-optic ADS, the
 * controller's buttons and advanced look, weapon inspect and the first-draw
 * flourish, and the guided tour from its first step to its last.
 */
async function finishTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  await pressPlay(page);
  // ---- toggle ADS: one press in, it stays in after the button is let go, the next press out
  await ev(page, `(() => { const s = document.getElementById("adsMode"); s.value = "toggle"; s.dispatchEvent(new Event("change")); })()`);
  await padTap(page, 6);
  await sleep(500);
  const aimed = await ev<number>(page, "window.__range.loadout.active.state.adsFrac");
  await padTap(page, 6);
  await sleep(500);
  const out = await ev<number>(page, "window.__range.loadout.active.state.adsFrac");
  check("toggle ADS: a press aims and it stays aimed; the next press comes out", aimed > 0.9 && out < 0.1, `${aimed.toFixed(2)} then ${out.toFixed(2)}`);
  await ev(page, `(() => { const s = document.getElementById("adsMode"); s.value = "hold"; s.dispatchEvent(new Event("change")); })()`);
  // ---- toggle crouch: a press crouches, it stays; a jump stands you up
  await ev(page, `(() => { const s = document.getElementById("crouchMode"); s.value = "toggle"; s.dispatchEvent(new Event("change")); window.__range.player.teleport(0, 0, 0, 0); })()`);
  await padTap(page, 1);
  await sleep(400);
  const down = await ev<boolean>(page, "window.__range.player.crouched");
  await padTap(page, 0);
  await sleep(500);
  const up = await ev<boolean>(page, "window.__range.player.crouched");
  check("toggle crouch: a press crouches and it holds; a jump stands you up", down && !up, `${down} then ${up}`);
  await ev(page, `(() => { const s = document.getElementById("crouchMode"); s.value = "hold"; s.dispatchEvent(new Event("change")); })()`);
  // ---- per-optic ADS: the 3x's multiplier applies with a 3x on
  await ev(page, `(() => { const i = document.getElementById("opticAds3x"); i.value = "0.5"; i.dispatchEvent(new Event("input")); const l = window.__range.loadout; l.fitAttachment(l.activeIndex, "optic", "optic_ranged_hcog"); })()`);
  await sleep(200);
  const mult = await ev<number>(page, "window.__range.opticAdsMult()");
  check("per-optic ADS: with the 3x on, its multiplier (0.5) applies", Math.abs(mult - 0.5) < 1e-9, String(mult));
  await ev(page, `(() => { const i = document.getElementById("opticAds3x"); i.value = "1"; i.dispatchEvent(new Event("input")); })()`);
  // ---- the controller's buttons: Y to reload, and it reloads
  await ev(page, `(() => { const sel = document.querySelector('select.padBind[data-button="3"]'); sel.value = "reload"; sel.dispatchEvent(new Event("change")); })()`);
  const mapped = await ev<string>(page, "window.__range.padButtons()[3]");
  await ev(page, "(() => { const s = window.__range.loadout.active.state; s.clip = 3; })()");
  await padTap(page, 3);
  await sleep(200);
  const reloading = await ev<boolean>(page, "window.__range.loadout.active.state.reloading");
  check("controller buttons: Y set to reload on the Controls tab reloads", mapped === "reload" && reloading, `${mapped}, reloading ${reloading}`);
  await ev(page, `(() => { const sel = document.querySelector('select.padBind[data-button="3"]'); sel.value = "swapWeapon"; sel.dispatchEvent(new Event("change")); })()`);
  // ---- the advanced look: switched on, the numbers kept
  await ev(page, `(() => { const s = document.getElementById("padAdvanced"); s.value = "1"; s.dispatchEvent(new Event("change")); const y = document.getElementById("pad_extraYaw"); y.value = "150"; y.dispatchEvent(new Event("change")); })()`);
  const adv = await ev<{ advanced: boolean; extraYaw: number; saved: boolean }>(page, `({ advanced: window.__range.input.pad.settings.advanced, extraYaw: window.__range.input.pad.settings.extraYaw, saved: (JSON.parse(localStorage.getItem("range.pad.v1") || "{}").extraYaw === 150) })`);
  check("advanced look: on, with the extra yaw set and remembered", adv.advanced && adv.extraYaw === 150 && adv.saved, JSON.stringify(adv));
  await ev(page, `(() => { const s = document.getElementById("padAdvanced"); s.value = "0"; s.dispatchEvent(new Event("change")); })()`);
  // ---- inspect: hold reload with a full magazine; firing ends it
  await sleep(2500);
  await ev(page, "(() => { const s = window.__range.loadout.active.state; s.clip = window.__range.loadout.active.weapon.clipSize; })()");
  await ev(page, padSet(2, true));
  await sleep(700);
  const inspecting = await ev<boolean>(page, "window.__range.vmState().inspecting");
  await ev(page, padSet(2, false));
  await padTap(page, 7);
  const stopped = await ev<boolean>(page, "window.__range.vmState().inspecting");
  check("inspect: holding reload with a full magazine turns the gun over; firing ends it", inspecting && !stopped, `${inspecting} then ${stopped}`);
  // ---- a gun picked up: its first time out has the flourish
  await ev(page, "(() => { const l = window.__range.loadout; l.give(l.activeIndex, 'r97'); })()");
  const flourish = await page.waitForFunction("window.__range.vmState().flourish", { polling: 50, timeout: 3000 }).then(() => true, () => false);
  check("first draw: a gun just picked up comes out with the flourish", flourish);
  await page.close();

  // ---- the guided tour, every step, from the Play tab
  const t = await open(browser, query);
  await ev(t, `document.getElementById("goTour").click()`);
  await pressPlay(t);
  const step = () => ev<string | null>(t, "window.__range.tour.stepId");
  check("tour: the Play tab's button starts it at MOVE", (await step()) === "move", String(await step()));
  // keys held from now on, pressed on the first frame only (a press every frame toggles a sprint on and off)
  const hold = (keys: string[]) =>
    `(() => { const K = ${JSON.stringify(keys)}; let f = 0; window.__range.setScript({ held: (a) => K.includes(a), pressedNow: (a) => K.includes(a) && f <= 1 }, () => { f++; }); })()`;
  // the same, with a press of `again` every third of a second (a jump when you reach a wall)
  const holdRepeat = (keys: string[], again: string) =>
    `(() => { const K = ${JSON.stringify(keys)}; let f = 0; window.__range.setScript({ held: (a) => K.includes(a), pressedNow: (a) => (K.includes(a) && f <= 1) || (a === ${JSON.stringify(again)} && f % 20 === 0) }, () => { f++; }); })()`;
  const ORDER = ["move", "sprint", "slide", "jump", "mantle", "climb", "superglide", "shoot", "reload", "swap", "heal", "ability", "grenade"];
  // the tour moved from this step to the very next one (not merely "somewhere else")
  const stepTo = async (id: string, timeout = 6000) => {
    const next = ORDER[ORDER.indexOf(id) + 1] ?? null;
    return t.waitForFunction(`window.__range.tour.stepId === ${JSON.stringify(next)}`, { polling: 50, timeout }).then(() => true, () => false);
  };
  const tp = (x: number, z: number, yaw: number) => ev(t, `window.__range.player.teleport(${x}, 0, ${z}, ${yaw})`);
  // move: to the marker
  await tp(0, -8, 0);
  check("tour: MOVE done at the marker", await stepTo("move"));
  // sprint: run to the next marker holding sprint
  await tp(-6, -5, 0);
  await ev(t, hold(["forward", "sprint"]));
  check("tour: SPRINT done running to the marker", await stepTo("sprint", 8000), String(await step()));
  await ev(t, "window.__range.setScript(null)");
  // slide: sprint at the rail, then crouch
  await tp(0, -16, 0);
  await ev(t, hold(["forward", "sprint"]));
  await sleep(700);
  await ev(t, hold(["forward", "sprint", "crouch"]));
  check("tour: SLIDE done", await stepTo("slide"), String(await step()));
  await ev(t, "window.__range.setScript(null)");
  await sleep(300);
  // jump
  await ev(t, hold(["jump"]));
  check("tour: JUMP done", await stepTo("jump"));
  await ev(t, "window.__range.setScript(null)");
  await sleep(800);
  // mantle: at the 2.4 m ledge (x -33 to -27 at z -58), too high to jump onto: forward, a jump at the face
  await tp(-25.8, -58, 90);
  await ev(t, holdRepeat(["forward"], "jump"));
  check("tour: MANTLE done at the ledge", await stepTo("mantle", 8000), String(await step()));
  await ev(t, "window.__range.setScript(null)");
  await sleep(400);
  // climb: into the ladder's wall (x 16 to 16.5 at z -46), forward, a jump at it
  await tp(15, -46, -90);
  await ev(t, holdRepeat(["forward"], "jump"));
  check("tour: CLIMB done at the ladder", await stepTo("climb", 8000), String(await step()));
  await ev(t, "window.__range.setScript(null)");
  await sleep(1500);
  // the superglide: skipped by holding interact (the pad's X)
  await tp(25.5, -8, -90);
  // back in the game by the controller's Start if the pointer lock has gone (a background page loses it)
  await pressPlay(t);
  await sleep(300);
  await ev(t, padSet(2, true));
  const skipped = await stepTo("superglide", 4000);
  const diag = await ev(t, "({ step: window.__range.tour.stepId, playing: window.__range.input.playing, locked: window.__range.input.locked, active: window.__range.input.pad.active, interact: window.__range.input.held('interact'), skip: window.__range.hud.last?.tour?.skip })");
  await ev(t, padSet(2, false));
  check("tour: a step can be skipped by holding interact (the superglide)", skipped, JSON.stringify(diag));
  // shoot: from the firing line, six metres from a dummy and facing it, a burst with the trigger
  await ev(t, "window.__range.player.teleport(0, 0, -2, 0)");
  await sleep(300);
  await ev(t, `(() => { const r = window.__range; const d = r.dummies.find((x) => x.group.visible && !x.knocked); const p = d.group.position; const from = { x: p.x, z: p.z + 6 }; const yaw = Math.atan2(-(p.x - from.x), -(p.z - from.z)) * 180 / Math.PI; r.player.teleport(from.x, 0, from.z, yaw, -5); })()`);
  await sleep(300);
  await ev(t, padSet(7, true));
  const shot = await stepTo("shoot", 3000);
  await ev(t, padSet(7, false));
  check("tour: SHOOT done with a real hit on a dummy", shot, JSON.stringify(await ev(t, "window.__range.stats()")));
  // reload, swap
  await ev(t, "(() => { window.__range.loadout.active.state.clip = 2; })()");
  await padTap(t, 2);
  check("tour: RELOAD done", await stepTo("reload"));
  await sleep(2500);
  await padTap(t, 3);
  check("tour: SWAP done", await stepTo("swap"));
  // (Y's tap goes as it comes up: let the swap finish before the heal, which a swap would cancel)
  await t.waitForFunction("!window.__range.loadout.swapping", { polling: 50, timeout: 3000 }).catch(() => undefined);
  await sleep(300);
  // heal: the tour's own shield is down; the heal key
  await ev(t, "window.__range.startHeal()");
  check("tour: HEAL done (the tour lends a shield to heal)", await stepTo("heal"), String(await step()));
  // the ability, then a grenade
  await ev(t, `(() => { window.__range.pickAbility("jolt"); window.__range.useAbility(); })()`);
  check("tour: ABILITY done with a JOLT", await stepTo("ability"), String(await step()));
  // the real G and the trigger (after the heal step, G used to be dead: the heal never ended)
  // the cell started at the heal step finishes first (a grenade cannot come out mid-heal)
  await t.waitForFunction("!window.__range.hud.last?.heal", { polling: 100, timeout: 6000 }).catch(() => undefined);
  await ev(t, "window.__range.input.locked = true");
  await t.keyboard.press("KeyG");
  await sleep(700);
  await padTap(t, 7, 250);
  const finished = await t.waitForFunction("window.__range.tour.stepId === null && localStorage.getItem('range.tour.done') === '1'", { polling: 100, timeout: 5000 }).then(() => true, () => false);
  check("tour: GRENADE, and the tour is complete (remembered)", finished, String(await step()));
  await t.close();
}

/** the range's tooling: moving dummies, dummies that shoot back, the spray wall, per-gun numbers, the flick drill */
async function rangeTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  await pressPlay(page);
  const sel = (id: string, v: string) => ev(page, `(() => { const s = document.getElementById("${id}"); s.value = "${v}"; s.dispatchEvent(new Event("change")); })()`);
  const home = await ev<number[]>(page, "window.__range.dummies.filter((d) => !d.rail).map((d) => d.group.position.x)");
  await sel("dummyMode", "strafe");
  await sleep(900);
  const moved = await ev<number[]>(page, "window.__range.dummies.filter((d) => !d.rail).map((d) => d.group.position.x)");
  check("range: strafing dummies move off their marks", moved.some((x, i) => Math.abs(x - home[i]) > 0.3), moved.map((x, i) => (x - home[i]).toFixed(2)).join(","));
  await sel("dummyMode", "stand");
  // shoot back: the nearest dummies fire and you have a shield in the range
  await ev(page, "window.__range.player.teleport(0, 0, 0, 0)");
  await sel("dummyShoot", "hard");
  const hurt = await page.waitForFunction("window.__range.rangeCombat.shield < 75 || window.__range.rangeCombat.health < 100", { polling: 200, timeout: 12000 }).then(() => true, () => false);
  check("range: shoot back: the dummies hit you", hurt, JSON.stringify(await ev(page, "({ sh: window.__range.rangeCombat.shield, hp: window.__range.rangeCombat.health })")));
  await sel("dummyShoot", "off");
  // the spray wall: a burst from the yellow mark lands on it
  await ev(page, "(() => { const p = window.__range.player; p.teleport(13.45, 0, -64, -90); p.pitch = 1.2; window.__range.sprayWall.clear(); })()");
  await ev(page, "window.__pad.buttons[7].pressed = true; window.__pad.buttons[7].value = 1;");
  await sleep(700);
  await ev(page, "window.__pad.buttons[7].pressed = false; window.__pad.buttons[7].value = 0;");
  await sleep(500);
  const marks = await ev<number>(page, "window.__range.sprayWall.marks");
  check("range: the spray wall takes the burst", marks >= 3, `${marks} marks`);
  const guns = await ev<Array<[string, { shots: number; hits: number }]>>(page, "window.__range.gunSession()");
  check("range: this session's numbers per gun", guns.some(([, r]) => r.shots > 0), JSON.stringify(guns));
  // the flick drill: its countdown, thirty figures, a time and a best
  await ev(page, `document.getElementById("goDrill").click()`);
  const running = await page.waitForFunction(`window.__range.drill.state === "running"`, { polling: 100, timeout: 6000 }).then(() => true, () => false);
  check("range: the flick drill counts down and starts", running);
  const pos = await ev<{ x: number; z: number }>(page, "({ x: window.__range.drill.target.group.position.x, z: window.__range.drill.target.group.position.z })");
  const dist = Math.hypot(pos.x - 3, pos.z - 2.2);
  check("range: its figure is 5 to 30 m out ahead of the pad", dist >= 4.9 && dist <= 30.1 && pos.z < 2.2, JSON.stringify(pos));
  for (let i = 0; i < 30; i++) await ev(page, "window.__range.drill.onHit(window.__range.drill.target, window.__range.gameTime())");
  const done = await ev<{ state: string; best: number | null }>(page, "({ state: window.__range.drill.state, best: window.__range.drill.best })");
  check("range: thirty down and the drill has a time and a best", done.state === "done" && (done.best ?? 0) > 0, JSON.stringify(done));
  await readmeTvChecks(page);
  await page.close();
}

/** look straight at a point in the world (bullets leave the eye, so this is what the crosshair is on) */
const AIM = `const aimAt = (p) => { const r = window.__range; const e = r.player.eyePosition(); const dx = p.x - e.x, dy = p.y - e.y, dz = p.z - e.z; r.player.yaw = Math.atan2(-dx, -dz) * 180 / Math.PI; r.player.pitch = Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI; };`;

interface TvState {
  section: number;
  page: number;
  pages: number;
  title: string;
  sections: string[];
}

/**
 * The README screen at the far end of the range: it is this repository's own
 * README, and shooting the arrow plates beside it turns its pages.
 */
async function readmeTvChecks(page: Page): Promise<void> {
  const tv = (): Promise<TvState> => ev<TvState>(page, "window.__range.readmeTv.state()");
  // aimed, not hip fired: a hip-fired round at 8 m can spread off a plate, and
  // this is a test of the paging, not of the cone
  const shootAt = async (expr: string, ms = 60) => {
    await ev(page, `(() => { ${AIM} aimAt(${expr}); })()`);
    await ev(page, padSet(6, true));
    await sleep(420);
    await ev(page, `(() => { ${AIM} aimAt(${expr}); })()`);
    await sleep(120);
    await padTap(page, 7, ms);
    await sleep(500);
    await ev(page, padSet(6, false));
    await sleep(150);
  };
  await ev(page, `(() => { const r = window.__range; r.player.teleport(0, 0, -98, 0, 0); r.readmeTv.goto(0, 0); })()`);
  await sleep(200);
  const start = await tv();
  check(
    "README screen: the range's own README, in sections and pages",
    start.sections.length > 8 && start.pages >= 1 && /range/i.test(start.title),
    `${start.sections.length} sections, "${start.title}" is ${start.pages} page(s)`
  );
  const text = await ev<string>(page, "window.__range.readmeTv.pageText()");
  check("README screen: the first page is the README's own text", /browser firing range/i.test(text), text.slice(0, 80).replace(/\n/g, " "));

  // the right-hand PAGE arrow
  await shootAt(`window.__range.readmeTv.buttonAt("nextPage")`);
  const paged = await tv();
  check("README screen: a round on the ▶ arrow turns the page", paged.page > start.page || paged.section !== start.section, `${start.section}/${start.page} -> ${paged.section}/${paged.page}`);
  // the SECTION arrow below it
  await shootAt(`window.__range.readmeTv.buttonAt("nextSection")`);
  const sectioned = await tv();
  check("README screen: a round on the ▼ arrow moves to the next section", sectioned.section !== paged.section && sectioned.page === 0, `${paged.section} -> ${sectioned.section} (page ${sectioned.page})`);
  // and back the other way
  await shootAt(`window.__range.readmeTv.buttonAt("prevSection")`);
  const back = await tv();
  check("README screen: the ▲ arrow goes back a section", back.section === paged.section, `${sectioned.section} -> ${back.section}`);

  // a round on the page itself changes nothing (stray fire down range)
  const beforeStray = await tv();
  await shootAt(`window.__range.readmeTv.bodyPoint()`);
  const afterStray = await tv();
  check("README screen: a round on the page itself does not move it", afterStray.section === beforeStray.section && afterStray.page === beforeStray.page, `${beforeStray.section}/${beforeStray.page} -> ${afterStray.section}/${afterStray.page}`);

  // the list of sections: a punch on a name opens it (the melee path). The
  // last one sits low on the screen, within a fist's reach of the floor.
  const jump = beforeStray.sections.length - 1;
  await ev(page, `(() => { ${AIM} const r = window.__range; const p = r.readmeTv.entryAt(${jump}); r.player.teleport(p.x, 0, p.z + 1.2, 0, 0); aimAt(p); })()`);
  await sleep(200);
  await padTap(page, 11, 90);
  await sleep(500);
  const jumped = await tv();
  check("README screen: a hit on a section's name opens that section", jumped.section === jump && jumped.page === 0, `wanted ${jump}, got ${jumped.section} ("${jumped.title}")`);
}

/** a fake gamepad: Start plays, the left stick walks, the right stick turns */
async function padTest(browser: Browser, query: string): Promise<void> {
  const page = await open(browser, query);
  // Start on the menu: play without a pointer lock
  await pressPlay(page);
  const playing = await ev<{ hidden: boolean; playing: boolean; active: boolean }>(page, `({ hidden: document.getElementById("overlay").classList.contains("hidden"), playing: window.__range.input.playing, active: window.__range.input.pad.active })`);
  check("pad: Start hides the menu and the game takes the controller", playing.hidden && playing.playing && playing.active, JSON.stringify(playing));
  const before = await ev<{ z: number; yaw: number }>(page, "({ z: window.__range.player.pos.z, yaw: window.__range.player.yaw })");
  // stick forward and a right turn for a second
  await ev(page, "(() => { window.__pad.axes[1] = -1; window.__pad.axes[2] = 0.6; })()");
  await sleep(1000);
  await ev(page, "(() => { window.__pad.axes[1] = 0; window.__pad.axes[2] = 0; })()");
  const after = await ev<{ z: number; yaw: number; sprint: boolean }>(page, "({ z: window.__range.player.pos.z, yaw: window.__range.player.yaw, sprint: window.__range.player.sprinting })");
  check("pad: the left stick moves the player", Math.abs(after.z - before.z) > 1, `moved ${Math.abs(after.z - before.z).toFixed(1)} m`);
  check("pad: the right stick turns the view (right = yaw down)", after.yaw < before.yaw - 20, `yaw ${before.yaw.toFixed(0)} -> ${after.yaw.toFixed(0)}`);
  // RT fires: the shot counter moves
  const shots0 = await ev<number>(page, "window.__range.loadout.slots[0].state.clip");
  await ev(page, "window.__pad.buttons[7].pressed = true; window.__pad.buttons[7].value = 1;");
  await sleep(300);
  await ev(page, "window.__pad.buttons[7].pressed = false; window.__pad.buttons[7].value = 0;");
  const shots1 = await ev<number>(page, "window.__range.loadout.slots[0].state.clip");
  check("pad: the right trigger fires", shots1 < shots0, `clip ${shots0} -> ${shots1}`);
  // Shattercaps: the 30-30 fired from the hip is a blast of 7 pellets
  await ev(page, `(() => { const l = window.__range.loadout; l.setWeaponId(0, "3030"); l.fitAttachment(0, "hopup", "hopup_shattercaps"); })()`);
  await sleep(1500);
  const sc0 = await ev<number>(page, "window.__range.stats().shots");
  await padTap(page, 7, 60);
  await sleep(300);
  const sc1 = await ev<number>(page, "window.__range.stats().shots");
  check("Shattercaps: one pull of the 30-30 from the hip is 7 pellets", sc1 - sc0 === 7, `${sc0} -> ${sc1}`);
  await ev(page, `(() => { const l = window.__range.loadout; l.setWeaponId(0, "rspn101"); })()`);
  await sleep(1200);
  // the game's Default: Y taps swap, Y held holsters; D-pad left held inspects
  const slotA = await ev<number>(page, "window.__range.loadout.activeIndex");
  await ev(page, padSet(3, true));
  await sleep(100);
  await ev(page, padSet(3, false));
  const swapping = await page.waitForFunction(`window.__range.loadout.swapping || window.__range.loadout.activeIndex !== ${slotA}`, { polling: 20, timeout: 1000 }).then(() => true, () => false);
  await sleep(1500);
  const slotB = await ev<number>(page, "window.__range.loadout.activeIndex");
  check("pad: Y (a tap) swaps weapons (on the release)", swapping && slotB !== slotA, `${slotA} -> ${slotB}, swap seen ${swapping}`);
  await padTap(page, 3, 550);
  await sleep(900);
  const away = await ev<{ gun: boolean }>(page, "window.__range.vmState()");
  check("pad: Y held holsters (the gun goes away)", !away.gun, JSON.stringify(away));
  await padTap(page, 7);
  await sleep(900);
  await ev(page, "(() => { const s = window.__range.loadout.active.state; s.clip = window.__range.loadout.active.weapon.clipSize; })()");
  await ev(page, padSet(14, true));
  await sleep(500);
  const insp = await ev<boolean>(page, "window.__range.vmState().inspecting");
  await ev(page, padSet(14, false));
  check("pad: D-pad left held inspects the gun", insp);
  // the presets: Bumper Jumper puts jump on LB and the ability on A; Default puts them back
  await ev(page, `(() => { const s = document.getElementById("padPreset"); s.value = "bumperJumper"; s.dispatchEvent(new Event("change")); })()`);
  const bj = await ev<string[]>(page, "(() => { const b = window.__range.padButtons(); return [b[4], b[0]]; })()");
  await ev(page, `(() => { const s = document.getElementById("padPreset"); s.value = "default"; s.dispatchEvent(new Event("change")); })()`);
  const df = await ev<string[]>(page, "(() => { const b = window.__range.padButtons(); return [b[4], b[0], b[5], b[12], b[15]]; })()");
  check("pad presets: Bumper Jumper (jump on LB, the ability on A), then Default (ability, jump, ping, heal, grenade)", bj.join() === "jump,ability" && df.join() === "ability,jump,ping,heal,grenade", `${bj} / ${df}`);
  await page.close();
  // the ability card takes D-pad left and right while it is up: left picks JOLT, and readies no grenade or fire mode
  const cp = await open(browser, query);
  await pressPlay(cp);
  await ev(cp, `(() => { const s = document.getElementById("botAbilities"); s.value = "1"; s.dispatchEvent(new Event("change")); document.getElementById("botCount").value = "1"; window.__range.startBots(); })()`);
  await cp.waitForFunction("window.__range.abilities.choosing === true", { polling: 100, timeout: 5000 });
  await padTap(cp, 14);
  const cardPick = await ev<{ picked: string | null; nade: unknown }>(cp, "({ picked: window.__range.abilities.picked, nade: window.__range.ordnance.readied })");
  check("pad: with the card up, D-pad left picks JOLT (and nothing else)", cardPick.picked === "jolt" && !cardPick.nade, JSON.stringify(cardPick));
  await ev(cp, `(() => { window.__range.duel()?.leave(); const s = document.getElementById("botAbilities"); s.value = "0"; s.dispatchEvent(new Event("change")); })()`);
  await cp.close();
}

/** E2E_ONLY=bots,br runs only those sections (page, duel, invite, triple, bots, pad, range, finish, throw, br, loot, modes, squad, p2p) */
const ONLY = (process.env.E2E_ONLY ?? "").split(",").filter(Boolean);
const want = (k: string): boolean => !ONLY.length || ONLY.includes(k);

async function main(): Promise<void> {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    protocolTimeout: 120000,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--mute-audio",
      "--no-sandbox",
      // two pages must both keep running frames
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  });
  try {
    if (want("page")) {
    console.log("\nThe page");
    const page = await open(browser, "");
    await sleep(2500);
    const t0 = await ev<number>(page, "performance.now()");
    const f = await ev<{ merged: { meshes: number; after: number } | null; calls: number }>(page, "({ merged: window.__range.merged, calls: window.__range.drawCalls() })");
    check("loads with the static merge done", f.merged !== null && f.merged.after < f.merged.meshes, f.merged ? `${f.merged.meshes} -> ${f.merged.after} meshes` : "none");
    check("frames are drawing", f.calls > 0, `${f.calls} draw calls`);
    check("no page errors on load", errors.length === 0, errors.slice(0, 3).join(" | "));
    // smaller downloads (tools/compress-assets.ts): the surfaces and the props' maps come as WebP, and none is missing
    const webp = await ev<{ webp: number; jpg: number; bad: string[] }>(page, `(() => { const r = performance.getEntriesByType("resource"); const tex = r.filter((x) => x.name.includes("/tex/") || x.name.includes("/models/")); return { webp: tex.filter((x) => x.name.endsWith(".webp")).length, jpg: tex.filter((x) => x.name.endsWith(".jpg")).length, bad: tex.filter((x) => x.responseStatus >= 400).map((x) => x.name.split("/").slice(-2).join("/")) }; })()`);
    check("textures: the range's and the props' maps load as WebP, none missing", webp.webp >= 20 && webp.bad.length === 0, JSON.stringify(webp));
    void t0;

    console.log("\nThe first visit");
    check("a first visit shows the welcome", await ev<boolean>(page, `!document.getElementById("welcome").hidden`));
    check("the menu button says Play before anything has started", (await ev<string>(page, `document.getElementById("play").textContent`)) === "Play");
    const probs = await ev<Record<string, string | null>>(
      page,
      `(() => { const f = window.__range.deviceProblem; return {
        phone: f("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"),
        android: f("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36"),
        safari: f("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15"),
        firefox: f("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0"),
        edge: f("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36 Edg/128.0"),
      }; })()`
    );
    check("a phone is told this is a PC game", /PC game/.test(probs.phone ?? "") && /PC game/.test(probs.android ?? ""));
    check("Safari is told to use Chrome or Edge, Firefox is warned", /Safari is not supported/.test(probs.safari ?? "") && /Firefox works/.test(probs.firefox ?? ""));
    check("Chrome or Edge on a PC gets no warning", probs.edge === null, String(probs.edge));
    await ev(page, `document.getElementById("welcomeOk").click()`);
    check("Got it puts the welcome away", await ev<boolean>(page, `document.getElementById("welcome").hidden`));
    // accounts are optional and need the game's own server: here (no server) the Stats tab says so and offers nothing
    const acct = await page.waitForFunction(`/own server/.test(document.getElementById("accountStatus").textContent)`, { polling: 200, timeout: 8000 }).then(() => true, () => false);
    check("accounts: without the game's own server the Stats tab says so, and nothing to sign in to", acct && (await ev<boolean>(page, `document.getElementById("accountSignedOut").hidden && document.getElementById("accountSignedIn").hidden`)));
    // Esc on the menu is the Resume button (a scripted page gets no pointer
    // lock, so what is checked is that the press is taken as Resume)
    const escKey = `(() => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape", bubbles: true, cancelable: true })); return window.__range.menuEscapes(); })()`;
    const escOnMenu = await ev<number>(page, escKey);
    check("Esc on the menu is Resume", escOnMenu === 1, `${escOnMenu} taken as Resume`);
    // ...but not while typing a name, and not while the game is running
    const typing = await ev<{ taken: number; focused: boolean; blurred: boolean }>(
      page,
      `(() => { const el = document.createElement("input"); document.getElementById("overlay").appendChild(el); el.focus(); const focused = document.activeElement === el;
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape", bubbles: true, cancelable: true }));
        const out = { taken: window.__range.menuEscapes(), focused, blurred: document.activeElement !== el }; el.remove(); return out; })()`
    );
    check("Esc in a text field leaves the field instead of resuming", typing.focused && typing.taken === escOnMenu && typing.blurred, JSON.stringify(typing));
    const inGame = await ev<number>(page, `(() => { document.getElementById("overlay").classList.add("hidden"); window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape", bubbles: true, cancelable: true })); document.getElementById("overlay").classList.remove("hidden"); return window.__range.menuEscapes(); })()`);
    check("Esc with the menu closed is not a resume", inGame === escOnMenu, `${inGame} taken as Resume, ${escOnMenu} before`);

    console.log("\nThe course");
    // in the game, not on the menu: the menu stops a run's clock
    await pressPlay(page);
    await ev(page, `document.getElementById("overlay").classList.add("hidden")`);
    // fit an optic to slot 1 first: the course lends pistols and must give it back
    const fitted = await ev<string | null>(page, `(() => { const l = window.__range.loadout; l.cycleAttachment("optic"); return l.slots[0].attach.optic ?? null; })()`);
    const X = -21.5;
    const steps: Array<[number, number, number]> = [
      [0, 0, 11], [0, 0, 13.5], [6, 0, 22], [0, 0, 42], [0, 4.2, 52.8], [0, 1.4, 71], [8, 1.4, 83], [-7, 0, 95], [7, 0, 119.5], [7, 0, 131.2],
    ];
    for (const [x, y, z] of steps) {
      await ev(page, `(() => { const p = window.__range.player; p.pos.set(${X + x}, ${y}, ${z}); p.vel.set(0, 0, 0); p.yaw = 180; })()`);
      // wait for at least three frames at this spot
      await ev(page, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))))");
    }
    const res = await ev<{ splits: Array<{ name: string; time: number }>; time: number } | null>(page, "window.__range.course.result");
    check("a run through every room finishes with a result", res !== null, res ? `${res.time.toFixed(2)} s` : "no result");
    if (res) {
      const skipped = res.splits.filter((s) => !Number.isFinite(s.time)).map((s) => s.name);
      check("with a split for every room and the finish", res.splits.length === 8 && skipped.length === 0, skipped.length ? `skipped ${skipped.join(",")}` : "8 splits");
      const medals = (res.splits as Array<{ name: string; par?: number; medal?: string | null }>).slice(0, 7);
      check("medals: every room has a par, and a run this quick takes gold in each", medals.every((s) => (s.par ?? 0) > 1 && s.medal === "gold"), JSON.stringify(medals.map((s) => `${s.name}:${s.medal}/${s.par}`)));
      // 1.5 s after the finish you are put back near the start, facing the results TV
      const back = await page
        .waitForFunction(`Math.abs(window.__range.player.pos.x - (${X} + 7)) < 0.3 && Math.abs(window.__range.player.pos.z - 11.4) < 0.3`, { polling: 200, timeout: 10000 })
        .then(() => true, () => false);
      const pose = await ev<{ x: number; z: number; yaw: number; running: boolean }>(page, "({ x: window.__range.player.pos.x, z: window.__range.player.pos.z, yaw: window.__range.player.yaw, running: window.__range.course.running })");
      check("after the finish: back near the start, facing the TV, no run going", back && Math.abs(pose.yaw) < 1 && !pose.running, JSON.stringify({ x: +pose.x.toFixed(2), z: +pose.z.toFixed(2), yaw: +pose.yaw.toFixed(1) }));
      const after = await ev<string | null>(page, "window.__range.loadout.slots[0].attach.optic ?? null");
      check("your own gun comes back with its optic after the run", fitted !== null && after === fitted, `${fitted} -> ${after}`);
    }

    // the menu stops the clock: start a run, open the menu, and it keeps its time
    // (reset first: the finish's return to the start would override the teleport)
    await ev(page, `window.__range.course.reset()`);
    await ev(page, `(() => { const p = window.__range.player; p.pos.set(${X}, 0, 11); p.vel.set(0, 0, 0); p.yaw = 180; })()`);
    await ev(page, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
    await ev(page, `(() => { const p = window.__range.player; p.pos.set(${X}, 0, 13.5); p.vel.set(0, 0, 0); })()`);
    // a little time on the clock before the menu stops it
    await page.waitForFunction("window.__range.course.running && window.__range.courseClock() > 0.05", { polling: 50, timeout: 8000 }).catch(() => undefined);
    await toMenu(page);
    const clock = () => ev<number>(page, "window.__range.courseClock()");
    const c0 = await clock();
    await sleep(1500);
    const c1 = await clock();
    const diag = await ev<string>(page, `JSON.stringify({ playing: window.__range.input.playing, running: window.__range.course.running, z: window.__range.player.pos.z, x: window.__range.player.pos.x })`);
    check("the menu stops a run's clock", c0 > 0 && Math.abs(c1 - c0) < 0.05, `${c0.toFixed(2)} s -> ${c1.toFixed(2)} s over 1.5 s on the menu ${diag}`);
    await ev(page, `window.__range.course.reset()`);

    // Swap away and back: one optic on the gun in hand, not one per round trip
    // (models are cached per weapon and the old optic used to stay on).
    for (const slot of [1, 0, 1, 0]) {
      await ev(page, `window.__range.loadout.requestSwap(${slot}, 0)`);
      await page.waitForFunction("!window.__range.loadout.swapping", { polling: 100, timeout: 10000 });
      await ev(page, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
    }
    const optics = await ev<number>(page, "window.__range.opticsInScene()");
    check("after swapping back and forth, one optic in the scene", optics === 1, `${optics}`);

    console.log("\nThird person");
    await ev(page, `document.getElementById("goRange").click()`);
    await ev(page, "window.__range.setThirdPerson(true)");
    await ev(page, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
    const tp = await ev<{ dist: number; fig: boolean; vm: boolean }>(page, `(() => { const p = window.__range.player; const c = window.__range.camera; const e = p.eyePosition(); return { dist: Math.hypot(c.position.x - e.x, c.position.y - e.y, c.position.z - e.z), fig: window.__range.selfFigureVisible(), vm: window.__range.viewModelVisible() }; })()`);
    check("third person: the camera sits behind the shoulder, your figure shows, the gun in hand does not", tp.dist > 1.8 && tp.dist < 3 && tp.fig && !tp.vm, JSON.stringify(tp));
    await ev(page, "window.__range.setOrbit(180, 10)");
    await ev(page, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
    const orbit = await ev<{ ahead: number }>(page, `(() => { const p = window.__range.player; const c = window.__range.camera; return { ahead: -(c.position.z - p.pos.z) }; })()`);
    check("the orbit puts the camera in front of your figure", orbit.ahead > 1.5, `${orbit.ahead.toFixed(2)} m ahead`);
    await ev(page, "window.__range.setOrbit(0, 0, false)");
    await ev(page, "window.__range.setThirdPerson(false)");
    await ev(page, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
    const fp = await ev<{ dist: number; fig: boolean; vm: boolean }>(page, `(() => { const p = window.__range.player; const c = window.__range.camera; const e = p.eyePosition(); return { dist: Math.hypot(c.position.x - e.x, c.position.y - e.y, c.position.z - e.z), fig: window.__range.selfFigureVisible(), vm: window.__range.viewModelVisible() }; })()`);
    check("back in first person: the camera is at the eye and the gun is back", fp.dist < 0.1 && !fp.fig && fp.vm, JSON.stringify(fp));

    console.log("\nThe menu and loadouts");
    const tabs = ["play", "duel", "loadouts", "settings", "controls"];
    for (const t of tabs) {
      await ev(page, `document.querySelector('#tabs button[data-tab="${t}"]').click()`);
      const shown = await ev<string[]>(page, `[...document.querySelectorAll("[data-panel]")].filter((p) => !p.hidden).map((p) => p.dataset.panel)`);
      check(`tab ${t} shows its panel and only that`, shown.length === 1 && shown[0] === t, shown.join(","));
    }
    // rebinding: Jump's first key to X, then Jump takes C from Crouch
    await ev(page, `document.querySelector('#tabs button[data-tab="controls"]').click()`);
    const chipOf = (label: string) => `[...document.querySelectorAll("#bindTable .bindRow")].find((r) => r.querySelector(".bindName").textContent === "${label}")`;
    const keysOf = (label: string) => ev<string[]>(page, `[...${chipOf(label)}.querySelectorAll(".bindKey:not(.add)")].map((b) => b.textContent)`);
    const rebind = async (label: string, code: string) => {
      await ev(page, `${chipOf(label)}.querySelector(".bindKey").click()`);
      await sleep(50);
      await ev(page, `document.dispatchEvent(new KeyboardEvent("keydown", { code: "${code}", bubbles: true }))`);
    };
    await rebind("Jump", "Semicolon");
    check("a key can be rebound", (await keysOf("Jump"))[0] === ";", (await keysOf("Jump")).join(","));
    await rebind("Jump", "KeyC");
    const crouchKeys = await keysOf("Crouch, slide");
    check("a key taken from another action moves over", (await keysOf("Jump"))[0] === "C" && !crouchKeys.includes("C"), `jump ${(await keysOf("Jump")).join(",")}, crouch ${crouchKeys.join(",")}`);
    check("and the tab says so", /It was Crouch, slide/.test(await ev<string>(page, `document.getElementById("bindsNote").textContent`)));
    const stored = await ev<Record<string, string[]>>(page, `JSON.parse(localStorage.getItem("range.binds.v1") ?? "{}")`);
    check("only the changed actions are stored", stored.jump?.[0] === "KeyC" && !("fire" in stored), JSON.stringify(stored));
    await ev(page, `document.getElementById("bindsReset").click()`);
    check("reset puts every key back", (await keysOf("Jump")).join(",") === "Space,Scroll up" && (await keysOf("Crouch, slide")).includes("C"), (await keysOf("Jump")).join(","));

    // pick the Close Quarters default: its weapons go in the slots
    await ev(page, `[...document.querySelectorAll("#loadoutList button")].find((b) => b.textContent.startsWith("Close Quarters")).click()`);
    const w = await ev<string[]>(page, "window.__range.loadout.slots.map((s) => s.weapon.id)");
    check("choosing a loadout puts its weapons in the slots", w[0] === "r97" && w[1] === "mastiff", w.join(","));
    const locked = await ev<boolean>(page, `document.getElementById("slot0").disabled`);
    check("a default loadout cannot be edited", locked);
    // copy it into custom slot 2, rename it, change slot 1
    await ev(page, `(() => { document.getElementById("copyTarget").value = "1"; document.getElementById("copyLoadout").click(); })()`);
    await ev(page, `(() => { const n = document.getElementById("loadoutName"); n.value = "Test Kit"; n.dispatchEvent(new Event("change")); const s = document.getElementById("slot0"); s.value = "wingman"; s.dispatchEvent(new Event("change")); })()`);
    const w2 = await ev<string[]>(page, "window.__range.loadout.slots.map((s) => s.weapon.id)");
    check("an edited custom loadout applies at once", w2[0] === "wingman", w2.join(","));
    // reload: the choice and the edit are remembered (a "leave site?" prompt
    // would hang a reload; the game only asks while playing or in a match)
    await toMenu(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction("Boolean(window.__range)", { polling: 200, timeout: 60000 });
    const after = await ev<{ name: string; slot1: string; w: string }>(page, `({ name: window.__range.loadouts.current.name, slot1: window.__range.loadouts.current.slot1, w: window.__range.loadout.slots[0].weapon.id })`);
    check("after a reload the loadout and its edit are remembered", after.name === "Test Kit" && after.slot1 === "wingman" && after.w === "wingman", JSON.stringify(after));
    // the menu's The Run button puts you at the course start, facing the line
    await ev(page, `document.getElementById("goRun").click()`);
    const at = await ev<{ x: number; z: number; yaw: number }>(page, `({ x: window.__range.player.pos.x, z: window.__range.player.pos.z, yaw: window.__range.player.yaw })`);
    check("The Run button: at the course start facing the start line", Math.abs(at.x + 21.5) < 0.5 && Math.abs(at.z - 10.2) < 0.5 && at.yaw === 180, JSON.stringify(at));
    await ev(page, `document.getElementById("goRunAdvanced").click()`);
    const adv = await ev<{ x: number; z: number; yaw: number }>(page, `({ x: window.__range.player.pos.x, z: window.__range.player.pos.z, yaw: window.__range.player.yaw })`);
    check("The Run (Advanced) button: at the advanced course start", Math.abs(adv.x - 21.5) < 0.5 && Math.abs(adv.z - 10.2) < 0.5 && adv.yaw === 180, JSON.stringify(adv));
    await ev(page, `document.getElementById("goArena").click()`);
    const ar = await ev<{ x: number; z: number }>(page, `({ x: window.__range.player.pos.x, z: window.__range.player.pos.z })`);
    check("Arena alone: at the arena's first spawn", Math.abs(ar.x - 90) < 0.5 && Math.abs(ar.z + 69) < 0.5, JSON.stringify(ar));
    // put the default back for the 1v1 pages
    await ev(page, `[...document.querySelectorAll("#loadoutList button")].find((b) => b.textContent.startsWith("Assault")).click()`);
    await page.close();
    }

    if (want("duel")) {
      console.log("\n1v1 over the local transport (two tabs)");
      await duelTest(browser, "?net=local&norender", "local");
    }

    if (want("invite")) {
      console.log("\nInvite links");
      await inviteTest(browser, "?net=local&norender");
    }

    if (want("triple")) {
      console.log("\n1v1v1 over the local transport (three tabs)");
      await tripleTest(browser, "?net=local&norender");
    }

    if (want("bots")) {
      console.log("\nArena, Bots");
      await botsTest(browser, "?norender");
      console.log("\nBot tiers");
      await botTiersTest(browser, "?norender");
    }

    if (want("pad")) {
      console.log("\nController");
      await padTest(browser, "?norender");
    }

    if (want("range")) {
      console.log("\nThe range's tooling");
      await rangeTest(browser, "?norender");
    }
    if (want("br")) {
      console.log("\nBattle royale against bots");
      await brTest(browser, "?norender");
    }

    if (want("loot")) {
      console.log("\nBattle royale: landing with nothing, the loot");
      await brLootTest(browser, "?norender");
    }

    if (want("finish")) {
      console.log("\nThe finishing touches: toggles, per-optic ADS, the controller, inspect, the first draw, the tour");
      await finishTest(browser, "?norender");
    }

    if (want("throw")) {
      console.log("\nThrowables: the frag, the arc star, thermite");
      await throwTest(browser, "?norender");
    }

    if (want("modes")) {
      console.log("\nThe arena's modes: Gun Run, team deathmatch, Crown (alone, against bots)");
      await modesTest(browser, "?norender");
      console.log("\nGun Run with a friend (two tabs, the local transport)");
      await modesFriendsTest(browser, "?net=local&norender");
    }

    if (want("squad")) {
      console.log("\nBattle royale as a squad (two tabs, the local transport)");
      await brSquadTest(browser, "?net=local&norender");
    }

    if (want("p2p")) {
      console.log("\n1v1 over peer to peer (the public broker)");
      const ran = await duelTest(browser, "?norender", "p2p");
      if (!ran) console.log("  --  skipped: the broker or the internet was not reachable");
    }

    check("no page errors anywhere", errors.length === 0, [...new Set(errors)].slice(0, 5).join(" | "));
  } finally {
    await browser.close();
  }
  console.log(fails === 0 ? "\nE2E PASS" : `\nE2E FAIL (${fails})`);
  process.exit(fails === 0 ? 0 : 1);
}

void main();
