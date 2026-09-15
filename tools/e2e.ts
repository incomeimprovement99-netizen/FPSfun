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
  await ev(page, "window.__range.startHeal()");
  const shieldBefore = await ev<number>(page, "window.__range.duel().shield");
  await sleep(1700);
  const healed = await ev<{ shield: number; cells: number; max: number }>(page, "({ shield: window.__range.duel().shield, cells: window.__range.kit.items.cell, max: window.__range.duel().shieldMax })");
  check("a shield cell heals 25 shield and is spent, in half its time with TRIAGE", healed.shield === Math.min(healed.max, shieldBefore + 25) && healed.cells === 1, JSON.stringify({ shieldBefore, ...healed }));
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
  // down again and finished off: out, the killcam, the banner for the squad
  await ev(guest, `(() => { const d = window.__range.duel(); d.takeHit(500, 100); })()`);
  await sleep(300);
  const second = await ev<{ downed: boolean; left: number }>(guest, "(() => { const d = window.__range.duel(); return { downed: d.downed, left: d.bleedUntil - performance.now() / 1000 }; })()");
  check("squad: the second knock bleeds out from 60 s", second.downed && second.left > 55 && second.left <= 60.5, JSON.stringify(second));
  await ev(guest, `(() => { const d = window.__range.duel(); d.takeHit(150, 100); })()`);
  await sleep(800);
  const guestOut = await ev<{ alive: boolean; phase: string }>(guest, "({ alive: window.__range.duel().alive, phase: window.__range.duel().phase })");
  const hostOn = await ev<string>(host, "window.__range.duel().phase");
  check("squad: finished while down: out, and the match goes on for the host", !guestOut.alive && guestOut.phase === "fight" && hostOn === "fight", JSON.stringify({ guestOut, hostOn }));
  const banner = await host.waitForFunction("[...window.__range.duel().lootField.drops.values()].some((x) => x.item.kind === 'banner' && x.item.owner === 1)", { polling: 200, timeout: 4000 }).then(() => true, () => false);
  check("squad: the guest's death box holds their banner, on the host's floor too", banner);
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
  check("bots: the bot closes in and lands a shot", shot, `bot at ${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}, your shield ${pos.sh}`);
  check("bots: it moved off its spawn toward you", pos.z < -12, `z ${pos.z.toFixed(1)}`);
  const snd = await ev<{ played: number; voices: number }>(page, "({ played: window.__range.audio.played, voices: window.__range.audio.voiceCount })");
  check("sound: the fight is heard (its shots and footsteps), under the voice cap", snd.played > 5 && snd.voices <= 56, JSON.stringify(snd));
  // knock it: a hit through its dummy, then the match is told
  await ev(page, `(() => { const d = window.__range.duel(); const a = d.avatars[0]; const pt = { clone() { return this; } }; a.hit(0, "body", 500, 1, 1, pt); d.localHit(d.remoteOf(a), 500, false); })()`);
  const won = await page.waitForFunction("window.__range.duel().hud().you === 1", { polling: 200, timeout: 5000 }).then(() => true, () => false);
  check("bots: knocking the bot takes the round", won);
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
  const cd = await ev<number>(page, "window.__range.abilities.cooldownLeft(window.__range.gameTime())");
  check("bots with abilities: and its cooldown is running", cd > 1.5 && cd < 3, cd.toFixed(2));
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
  check("recap: the bot eliminates you", out);
  const kc = await ev<{ active: boolean; killer: string; weapon: string; frames: number; span: number }>(page, "window.__range.killcamState()");
  check("killcam: it starts, from the bot's eyes, with its gun", kc.active && kc.killer === "BOT ASH" && kc.weapon === "rspn101", JSON.stringify(kc));
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
  await page.close();
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
  await page.close();
}

/** E2E_ONLY=bots,br runs only those sections (page, duel, invite, triple, bots, pad, range, br, loot, modes, squad, p2p) */
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
