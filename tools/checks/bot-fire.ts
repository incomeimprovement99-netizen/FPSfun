// A bot's gun plays by the players' rules, and its death box holds what it had.
//
// The gap pass found three ways a bot's gun was not a player's gun: it never
// reloaded (an R-99 bot outdamaged a player with the same gun about two and a
// half times over a fight), every round did the near damage at any range, and
// a player crouched behind cover was hit as if standing. And a bot's death
// box was a rare gun and the same heals whatever it had looted.
//
// Pure node: the magazine (BotMag), the damage falloff, the body test
// (hitsBody) and the death box (deathBoxOf) are free of the scene.
//
// Run on its own: npx tsx tools/checks/bot-fire.ts.
import * as THREE from "three";
import lootCfg from "../../src/config/loot.json";
import { BODY_TOP, BOT_WEAPONS, BotMag, CROUCH_TOP, hitsBody } from "../../src/game/bots";
import { falloff } from "../../src/game/projectile";
import { deathBoxOf } from "../../src/game/loot";
import { resolveWeapon } from "../../src/game/weapons";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("A bot's gun, and its death box");

// ------------------------------------------------------------ the magazine
{
  const SECONDS = 20;
  for (const id of ["r97", "rspn101", "lmg", "wingman"]) {
    const w = resolveWeapon(id, 2);
    const interval = Math.max(w.shotInterval, w.semiAuto ? 0.25 : 0);
    // a bot firing whenever it may, as Bot.update does
    const mag = new BotMag();
    let shots = 0;
    let next = 0;
    for (let t = 0; t < SECONDS; t += 1 / 240) {
      if (!mag.ready(t, w) || t < next) continue;
      next = t + interval;
      mag.fired(t, w, interval);
      shots++;
    }
    // a player holding the trigger: a magazine, then a reload, round again
    const cycle = w.clipSize * interval + w.reloadTime;
    const player = Math.floor(SECONDS / cycle) * w.clipSize + Math.min(w.clipSize, Math.ceil((SECONDS % cycle) / interval));
    const ratio = shots / player;
    check(`${w.name}: over ${SECONDS} s a bot fires what a player can (a magazine, then a reload)`, ratio > 0.85 && ratio < 1.2, `${shots} shots against a player's ${player}, x${ratio.toFixed(2)}; without reloads it was ${Math.floor(SECONDS / interval)}`);
  }
  const w = resolveWeapon("r97", 2);
  const mag = new BotMag();
  mag.ready(0, w);
  for (let i = 0; i < w.clipSize; i++) mag.fired(i * 0.05, w, 0.05);
  const last = (w.clipSize - 1) * 0.05;
  check("the last round starts a reload as long as the gun's", mag.reloading(last + 0.1) && !mag.reloading(last + 0.05 + w.reloadTime + 0.01), `${w.reloadTime} s`);
  check("and a gun it picks up comes loaded", mag.ready(last + 0.1, resolveWeapon("wingman", 2)));
}

// ------------------------------------------------------------ falloff
// A bot's round now does what a player's does at that range (falloff(), the
// players' own). No gun a bot carries falls off today, as none of the guns
// they come from do, so this holds the rule on a gun made to fall off.
{
  const base = resolveWeapon("rspn101", 2);
  const w = { ...base, damage: { ...base.damage, near: 20, far: 14, veryFar: 10, nearDist: 20, farDist: 60, veryFarDist: 120 } };
  check("a bot's round does the near damage up close", falloff(w, 10) === 20);
  check("and less at range, as a player's does", falloff(w, 40) === 17 && falloff(w, 60) === 14 && falloff(w, 200) === 10, `${falloff(w, 40)} at 40 m, ${falloff(w, 200)} at 200 m`);
  const falls = BOT_WEAPONS.filter((id) => { const d = resolveWeapon(id, 2).damage; return d.far < d.near || d.veryFar < d.near; });
  console.log(`  --  bot guns that fall off today: ${falls.join(", ") || "none"}`);
}

// ------------------------------------------------------------ a crouched target
{
  const feet = new THREE.Vector3(0, 0, -20);
  const from = new THREE.Vector3(0, 1.35, 0);
  // aimed at a standing chest: 1.5 m up
  const dir = new THREE.Vector3(0, 1.5, -20).sub(from).normalize();
  // high over a crouched head: the top of a crouched body plus the capsule's own reach
  const over = new THREE.Vector3(0, CROUCH_TOP + 0.6, -20).sub(from).normalize();
  check("a round at a standing chest hits a standing body", hitsBody(from, dir, feet, BODY_TOP));
  check("a round over a crouched body's head misses it", !hitsBody(from, over, feet, CROUCH_TOP), `crouched top ${CROUCH_TOP.toFixed(2)} m`);
  check("the same round hits it standing", hitsBody(from, over, feet, BODY_TOP));
}

// ------------------------------------------------------------ the death box
{
  const kit = { gunId: "r97", gun: 3, mag: 3, mods: { barrel: { id: "barrel_2", rank: 2 }, hopup: { id: "hopup_x", rank: 4 } }, cells: 5, syringes: 0, frags: 2 };
  const box = deathBoxOf(kit, "r97");
  const gun = box.find((i) => i.kind === "weapon");
  check("a bot that looted an epic gun drops it epic, with its magazine", gun?.id === "r97" && gun.rarity === "epic" && gun.mag === 3, JSON.stringify(gun));
  check("its magazine, its fittings and its hop-up come out as it had them", box.some((i) => i.id === "mag:3" && i.rarity === "epic") && box.some((i) => i.id === "barrel_2" && i.rarity === "rare") && box.some((i) => i.kind === "hopup" && i.rarity === "legendary"));
  check("its frags too", box.some((i) => i.kind === "grenade" && i.n === 2));
  const cells = box.find((i) => i.id === "cell")?.n ?? 0;
  const syr = box.find((i) => i.id === "syringe")?.n ?? 0;
  check("its heals, never fewer than a box always held", cells === 5 && syr === lootCfg.deathBox.syringes, `${cells} cells, ${syr} syringes`);
  const plain = deathBoxOf(null, "wingman");
  check("a bot that looted nothing still drops its gun, rare, and the basics", plain.some((i) => i.kind === "weapon" && i.rarity === "rare") && plain.some((i) => i.id === "cell"));
  check("and an unarmed one drops no gun", !deathBoxOf(null, null).some((i) => i.kind === "weapon"));
}

console.log(fails === 0 ? "\nBOT FIRE PASS" : `\nBOT FIRE FAIL (${fails})`);
export const botFireFails = fails;
if (process.argv[1]?.endsWith("bot-fire.ts")) process.exit(fails === 0 ? 0 : 1);
