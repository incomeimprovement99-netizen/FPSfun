// What a bot can see, and what it picks up off the floor.
//
// Two things ship together here because they are the same complaint about the
// same bot: it was blind past 60 m on a map made of 100 to 165 m sightlines,
// and it was handed a kit instead of looting for one (docs/NEXT_STEPS.md items
// 21 and 20). Both now come out of src/config/bots.json, so what this checks is
// that the numbers in the config land where the map needs them, that what a
// target is doing moves the range the way a pair of eyes would, and that a bot
// let loose on a floor full of loot ends up better armed than one let loose in
// a field.
//
// Pure node: the parts with the decisions in them (sightRange, sightScale,
// scopedGun, aimError, BotLooter) are free of the scene, so they run here
// straight. Bot.sees() itself is the range test above plus the line of sight
// it always had, and the browser suite drives that.
//
// Run on its own: npx tsx tools/checks/bot-sense.ts.
import * as THREE from "three";
import botsCfg from "../../src/config/bots.json";
import lootCfg from "../../src/config/loot.json";
import { resolveWeapon } from "../../src/game/weapons";
import {
  BOT_SIGHT_MODES,
  BOT_TIERS,
  BotLooter,
  DIFFICULTY,
  aimError,
  scopedGun,
  sightRange,
  sightScale,
  type BotLootDrop,
  type BotLootItem,
  type BotLootSource,
  type BotTier,
} from "../../src/game/bots";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
function near(label: string, got: number, want: number, tol: number): void {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label} = ${got.toFixed(2)} (want ${want} +/- ${tol})`);
}

const SIGHT = botsCfg.sight;
const LOOTING = botsCfg.loot;
const m = (x: number) => `${x.toFixed(1)} m`;

// ------------------------------------------------------ how far it can see
console.log("How far a bot sees, per mode and per tier (src/config/bots.json sight.range)");
{
  // the battle royale's four: the map's open ground is 100 to 165 m, so the
  // tiers are spread across it rather than all stopping short of it
  near("easy, battle royale, m", sightRange("easy", "br"), 60, 0);
  near("normal, battle royale, m", sightRange("normal", "br"), 90, 0);
  near("hard, battle royale, m", sightRange("hard", "br"), 130, 0);
  near("elite, battle royale, m", sightRange("elite", "br"), 170, 0);
  check(
    "the arena keeps the 60 m it always had, every tier",
    BOT_TIERS.every((t) => Math.abs(sightRange(t, "arena") - 60) <= 10),
    BOT_TIERS.map((t) => `${t} ${m(sightRange(t, "arena"))}`).join(", ")
  );
  check(
    "every tier sees further on the battle royale's map than in the arena",
    BOT_TIERS.every((t) => sightRange(t, "br") > sightRange(t, "arena"))
  );
  check(
    "a better tier sees further, in both modes",
    BOT_SIGHT_MODES.every((mode) => BOT_TIERS.every((t, i) => i === 0 || sightRange(t, mode) > sightRange(BOT_TIERS[i - 1], mode)))
  );
  check("the map's 165 m sightline is inside an elite's range", sightRange("elite", "br") >= 165, m(sightRange("elite", "br")));
  check("and outside an easy one's, so it still has to come down off the ridge", sightRange("easy", "br") < 165, m(sightRange("easy", "br")));
  check("the default mode is the arena, so a bot nobody told is the bot we had", sightRange("hard") === sightRange("hard", "arena"));
}

console.log("\nA long gun in its hands (bots.ts scopedGun)");
{
  check("the sentinel is one", scopedGun(resolveWeapon("sentinel", 2)));
  check("the kraber is one", scopedGun(resolveWeapon("sniper", 2)));
  check("the wingman is not: sniper ammo, but it falls off by 20 m", !scopedGun(resolveWeapon("wingman", 2)));
  check("nor is an SMG", !scopedGun(resolveWeapon("r97", 2)));
  check("a ranged optic off the floor makes one", scopedGun(resolveWeapon("rspn101", 2, ["optic_ranged_hcog"])));
  check("a close quarters holosight does not", !scopedGun(resolveWeapon("rspn101", 2, ["optic_cq_holosight"])));
  const plain = sightRange("hard", "br");
  const scoped = sightRange("hard", "br", {}, true);
  check("a long gun sees further than iron sights", scoped > plain, `${m(scoped)} against ${m(plain)}`);
  near("by the config's factor", scoped / plain, SIGHT.scoped, 1e-9);
  check(
    "and it holds its angle well outside an SMG's range",
    sightRange("elite", "br", {}, true) * SIGHT.holdFrac > 40,
    `${m(sightRange("elite", "br", {}, true) * SIGHT.holdFrac)} held`
  );
}

console.log("\nWhat the target is doing (bots.ts sightScale)");
{
  near("a standing, still body is the plain range", sightScale({}), 1, 1e-9);
  check("a body at a run is picked up further out", sightScale({ speed: 7 }) > 1, `x${sightScale({ speed: 7 }).toFixed(2)}`);
  check("a walk counts for less than a sprint", sightScale({ speed: 2 }) < sightScale({ speed: 7 }));
  check("crouched, there is much less of it to see", sightScale({ crouched: true }) < 1, `x${sightScale({ crouched: true }).toFixed(2)}`);
  check("firing gives it away", sightScale({ firing: true }) > sightScale({}), `x${sightScale({ firing: true }).toFixed(2)}`);
  check("a smaller target is seen later", sightScale({ size: 0.6 }) < 1);
  check("a bigger one sooner", sightScale({ size: 1.4 }) > 1);
  const elite = sightRange("elite", "br");
  const hiding = sightRange("elite", "br", { crouched: true });
  check("a crouched player behind cover is not magically seen", hiding < elite, `${m(hiding)} against ${m(elite)}`);
  const sprinting = sightRange("elite", "br", { speed: 7, firing: true });
  check("a sprinting, firing one is spotted much further off", sprinting > elite * 1.5, `${m(sprinting)} against ${m(elite)}`);
  check("a sniper on a ridge is not blind: it holds the 165 m line", sightRange("elite", "br", { speed: 7, firing: true }, true) >= 165);
  check(
    "someone in its face is always seen, however small and still",
    sightRange("easy", "arena", { crouched: true, size: 0.4 }) >= SIGHT.min,
    m(sightRange("easy", "arena", { crouched: true, size: 0.4 }))
  );
  check(
    "and nothing at all is seen past the cap",
    sightRange("elite", "br", { speed: 9, firing: true, size: 2 }, true) <= SIGHT.max,
    m(sightRange("elite", "br", { speed: 9, firing: true, size: 2 }, true))
  );
}

console.log("\nA long shot is still a missable one (bots.ts aimError)");
{
  const e = DIFFICULTY.elite;
  near("the arena's model is untouched: easy on a new sighting, deg", aimError(DIFFICULTY.easy, 0), 14, 1e-9);
  check("a shot inside the config's `from` is the same shot it always was", aimError(e, 1, SIGHT.far.from - 10) === aimError(e, 1), `${SIGHT.far.from} m`);
  check("past it, the error widens with the range", aimError(e, 60, 170) > aimError(e, 60), `${aimError(e, 60, 170).toFixed(2)} deg against ${aimError(e, 60).toFixed(2)}`);
  check(
    "and keeps widening",
    [60, 100, 140, 170].every((d, i, a) => i === 0 || aimError(e, 60, d) > aimError(e, 60, a[i - 1]))
  );
  near("an elite settled on a 170 m target, deg", aimError(e, 60, 170), e.errFloor * (1 + SIGHT.far.perMetre * (170 - SIGHT.far.from)), 1e-9);
  check("it is still the wide first shot that misses most", aimError(e, 0, 170) > aimError(e, 60, 170) * 2);
}

// ------------------------------------------------------------- the looting
/** a stub floor: the two questions a bot asks of loot, and nothing else */
class Floor implements BotLootSource {
  readonly drops = new Map<number, BotLootDrop>();
  private next = 1;
  add(x: number, z: number, item: BotLootItem): number {
    const key = this.next++;
    this.drops.set(key, { key, pos: new THREE.Vector3(x, 0, z), item });
    return key;
  }
  near(at: THREE.Vector3, radius: number): BotLootDrop[] {
    return [...this.drops.values()].filter((d) => Math.hypot(d.pos.x - at.x, d.pos.z - at.z) <= radius);
  }
  take(key: number): BotLootItem | null {
    const d = this.drops.get(key);
    if (!d) return null;
    this.drops.delete(key);
    return d.item;
  }
}

const gun = (id: string, rarity: string): BotLootItem => ({ kind: "weapon", id, rarity, n: 1 });
const mod = (id: string, rarity: string): BotLootItem => ({ kind: "attach", id, rarity, n: 1 });
const heal = (id: string): BotLootItem => ({ kind: "heal", id, rarity: "common", n: 2 });
const frag = (): BotLootItem => ({ kind: "grenade", id: "frag", rarity: "rare", n: 1 });
const ammo = (): BotLootItem => ({ kind: "ammo", id: "light", rarity: "common", n: 60 });

/** a place: plenty on the floor and all of it close together, like a room with loot in it */
function richFloor(): Floor {
  const f = new Floor();
  const ring = [
    gun("r97", "common"),
    gun("rspn101", "rare"),
    gun("sentinel", "epic"),
    mod("mag:2", "rare"),
    mod("optic_ranged_hcog", "rare"),
    mod("barrel_stabilizer_l2", "rare"),
    mod("stock_tactical_l2", "rare"),
    heal("cell"),
    heal("syringe"),
    heal("battery"),
    frag(),
    frag(),
    ammo(),
    { kind: "helmet", id: "gold", rarity: "legendary", n: 1 },
  ];
  ring.forEach((item, i) => {
    const a = (i / ring.length) * Math.PI * 2;
    f.add(Math.cos(a) * (4 + (i % 4) * 3), Math.sin(a) * (4 + (i % 4) * 3), item);
  });
  return f;
}

/** a field: three things, a long way apart, most of a walk between each */
function poorFloor(): Floor {
  const f = new Floor();
  f.add(38, 0, gun("semipistol", "common"));
  f.add(-20, 34, heal("cell"));
  f.add(0, -40, ammo());
  return f;
}

/** run a looter over a floor, walking it at its tier's speed, and report as it goes */
function loot(tier: BotTier, floor: Floor, seconds: number, busy = false, at = new THREE.Vector3()): { looter: BotLooter; scores: number[] } {
  const looter = new BotLooter(tier);
  const speed = DIFFICULTY[tier].speed;
  const dt = 1 / 20;
  const scores: number[] = [];
  for (let t = 0; t < seconds; t += dt) {
    looter.step(t, at, floor, busy);
    const goal = looter.goal;
    if (goal && !looter.holding) {
      const dx = goal.x - at.x;
      const dz = goal.z - at.z;
      const d = Math.hypot(dx, dz);
      if (d > 1e-6) {
        const step = Math.min(d, speed * dt);
        at.x += (dx / d) * step;
        at.z += (dz / d) * step;
      }
    }
    if (Math.round(t * 20) % 100 === 0) scores.push(looter.score);
  }
  scores.push(looter.score);
  return { looter, scores };
}

console.log("\nA bot loots (bots.ts BotLooter, times from src/config/loot.json botSearch)");
{
  const fresh = new BotLooter("normal");
  check("a bot that has looted nothing has no gun", !fresh.armed);
  near("an easy bot's rummage through one spot, s", new BotLooter("easy").rummage, lootCfg.botSearch.easy * LOOTING.perItem, 1e-9);
  near("an elite's, s", new BotLooter("elite").rummage, lootCfg.botSearch.elite * LOOTING.perItem, 1e-9);
  check("so the tier that searched fastest still searches fastest", new BotLooter("elite").rummage < new BotLooter("easy").rummage);
  near("and it loots for a few of its own searches", new BotLooter("hard").window, lootCfg.botSearch.hard * LOOTING.window, 1e-9);

  const rich = loot("normal", richFloor(), 50);
  const poor = loot("normal", poorFloor(), 50);
  check("a bot that landed on a place finds a gun", rich.looter.armed, `${rich.looter.kit.gunId}`);
  check("and takes the best one there, not the first", rich.looter.kit.gun === 3, `grade ${rich.looter.kit.gun}`);
  check("its kit only ever goes up", rich.scores.every((s, i) => i === 0 || s >= rich.scores[i - 1]), rich.scores.join(" -> "));
  check("it is better armed at the end than at the start", rich.scores[rich.scores.length - 1] > rich.scores[0], `${rich.scores[0]} -> ${rich.scores[rich.scores.length - 1]}`);
  check("it kits up a shield as it goes", rich.looter.kit.armor > LOOTING.startArmor, `tier ${rich.looter.kit.armor}`);
  check("it carries heals it found", rich.looter.kit.cells + rich.looter.kit.syringes > 0, `${rich.looter.kit.cells} cells, ${rich.looter.kit.syringes} syringes`);
  check("and frags", rich.looter.kit.frags > 0, `${rich.looter.kit.frags}`);
  check(
    "the one that landed in a field is worse off for it",
    rich.looter.score > poor.looter.score,
    `${rich.looter.score} against ${poor.looter.score} after 50 s`
  );
  check("it leaves the ammo on the floor: a bot does not count rounds", !fresh.wants(ammo()));
  const left = [...poorFloor().drops.values()].length;
  check("the field's three things are all there to be had", left === 3, `${left}`);

  const quick = loot("elite", richFloor(), 20);
  const slow = loot("easy", richFloor(), 20);
  check(
    "an elite gets through more of a place than an easy one in the same 20 s",
    quick.looter.kit.taken > slow.looter.kit.taken,
    `${quick.looter.kit.taken} against ${slow.looter.kit.taken}`
  );

  const fight = loot("normal", richFloor(), 30, true);
  check("someone in its sights puts looting down", fight.looter.kit.taken === 0, `${fight.looter.kit.taken} taken`);
  const over = loot("hard", richFloor(), 5);
  check("and it stops once its looting time is up", over.looter.done(lootCfg.botSearch.hard * LOOTING.window + 1));
}

console.log("\nWhat a bot would rather have (bots.ts BotLooter.wants)");
{
  const l = new BotLooter("hard");
  check("with nothing, any gun will do", l.wants(gun("semipistol", "common")));
  check("but fittings are no use without one", !l.wants(mod("mag:3", "epic")));
  const floor = new Floor();
  floor.add(0, 0, gun("sentinel", "epic"));
  l.step(0, new THREE.Vector3(), floor, false);
  l.step(l.rummage + 0.1, new THREE.Vector3(), floor, false);
  const got = l.step(l.rummage * 2 + 1, new THREE.Vector3(), floor, false);
  check("it takes the gun it walked to", got?.id === "sentinel", `${got?.id}`);
  check("it swaps up", l.wants(gun("rspn101", "legendary")));
  check("and never down", !l.wants(gun("r97", "common")));
  check("now it has a gun it wants a magazine", l.wants(mod("mag:2", "rare")));
  check("a helmet is worth a shield tier", l.wants({ kind: "helmet", id: "gold", rarity: "legendary", n: 1 }));
  check("an arc star is not: it only ever throws a frag", !l.wants({ kind: "grenade", id: "arcstar", rarity: "rare", n: 1 }));
  const before = l.kit.taken;
  const gone = new Floor();
  const key = gone.add(0, 0, heal("cell"));
  gone.take(key);
  check("a drop someone else got first is nothing taken", gone.take(key) === null && l.kit.taken === before);
}

console.log(fails === 0 ? "\nBOT SENSE PASS" : `\nBOT SENSE FAIL (${fails})`);
export const botSenseFails = fails;
if (process.argv[1]?.endsWith("bot-sense.ts")) process.exit(fails === 0 ? 0 : 1);
