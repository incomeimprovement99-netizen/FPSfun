// Knockdown shield tiers (src/config/items.json, src/game/kit.ts). The
// backpack tiers were checked here too until the backpacks went with the heals
// they carried (Milestone 523).
//
// Some of these numbers are published and the rest are ours, so this checks
// two different things. The published ones are held to the source: the three
// EVO knockdown sizes are 200 / 450 / 750 and have to agree with the copy
// src/config/squad.json hands the down code. The
// rest is held to the shape the tiers promise: a ladder that never goes
// backwards, a self-revive that is spent once and not once per knock, and a
// channel that keeps nothing when it is interrupted, because each of those is
// a decision at a knock rather than a number on a HUD.
//
// Run on its own: npx tsx tools/checks/knockdown.ts. Also belongs inside
// npm run verify.
import { KNOCK_ORDER, KNOCK_SHIELDS, Knockdown, SELF_REVIVE, SHIELD_LEVELS } from "../../src/game/kit";
import itemsCfg from "../../src/config/items.json";
import squadCfg from "../../src/config/squad.json";
import lootCfg from "../../src/config/loot.json";

let fails = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("\nKnockdown shields");

// ---------------------------------------------------------- the shield tiers

check(
  "four knockdown tiers, and the order lists every one",
  KNOCK_ORDER.length === Object.keys(KNOCK_SHIELDS).length && KNOCK_ORDER.every((t) => t in KNOCK_SHIELDS),
  KNOCK_ORDER.join(", ")
);

const kdHp = KNOCK_ORDER.map((t) => KNOCK_SHIELDS[t].hp);
check("the three EVO tiers are the published 200, 450 and 750", kdHp[0] === 200 && kdHp[1] === 450 && kdHp[2] === 750, kdHp.slice(0, 3).join(" / "));

// squad.json holds the same three for the down code. Two copies of a number
// is how a config drifts, so they are checked against each other rather than
// each against the wiki.
check(
  "and squad.json's copy of them is the same three",
  squadCfg.kdShield.hp.length === 3 && squadCfg.kdShield.hp.every((h, i) => h === kdHp[i]),
  squadCfg.kdShield.hp.join(" / ")
);

check("the ladder never goes backwards", kdHp.every((h, i) => i === 0 || h >= kdHp[i - 1]), kdHp.join(" / "));
check("gold soaks purple's 750 and no more: what it adds is the self-revive", KNOCK_SHIELDS.gold.hp === KNOCK_SHIELDS.purple.hp, `gold ${KNOCK_SHIELDS.gold.hp}, purple ${KNOCK_SHIELDS.purple.hp}`);

const withRevive = KNOCK_ORDER.filter((t) => KNOCK_SHIELDS[t].selfRevives > 0);
check("gold is the only tier carrying a self-revive, and it carries one", withRevive.length === 1 && withRevive[0] === "gold" && KNOCK_SHIELDS.gold.selfRevives === 1, withRevive.join(", ") || "none");

const rarities = Object.keys(lootCfg.colors);
const badRarity = KNOCK_ORDER.map((t) => KNOCK_SHIELDS[t].rarity).filter((r) => !rarities.includes(r));
check("every tier names a rarity the loot table has", badRarity.length === 0, badRarity.join(", ") || rarities.join(", "));

// ------------------------------------------------- the EVO level is the floor

{
  const kd = new Knockdown();
  const byLevel = [1, 2, 3].map((l) => kd.tierFor(l));
  check("with nothing looted your EVO level is the shield: white, blue, purple", byLevel.join(",") === "white,blue,purple", byLevel.join(", "));
  // Only the three shield-core levels exist, so a level past the top must not
  // walk off the end of the order and hand out the gold tier for free.
  check("no EVO level reaches gold: that tier is only ever looted", kd.tierFor(SHIELD_LEVELS.length + 4) === "purple", kd.tierFor(99));
}

{
  const kd = new Knockdown();
  check("a purple shield found at white raises the floor", kd.take("purple", 1) && kd.tierFor(1) === "purple", kd.tierFor(1));
  check("and levelling past it costs nothing", kd.tierFor(3) === "purple", kd.tierFor(3));
  check("a white shield is left lying when you already have better", !kd.take("white", 1) && kd.tierFor(1) === "purple", kd.tierFor(1));
}

{
  const kd = new Knockdown();
  check("a purple shield is left lying at EVO level 3, which already gives purple", !kd.take("purple", 3) && kd.looted === null);
  check("a gold one is worth taking there, because of what it carries", kd.take("gold", 3) && kd.selfLeft === 1, `${kd.tierFor(3)}, ${kd.selfLeft} self-revive`);
  check("a second gold one is left lying while the first still has its revive", !kd.take("gold", 3) && kd.selfLeft === 1, `${kd.selfLeft} self-revive`);
}

// ------------------------------------------------------ a knock and the soak

{
  const kd = new Knockdown();
  check("a new knock fills the shield at the tier in force", kd.onKnock(0, 1) && kd.hp === 200 && kd.max === 200, `${kd.hp} of ${kd.max}`);
  check("and the same knock asked again changes nothing", !kd.onKnock(0, 1) && kd.hp === 200);
  kd.hp = 40;
  check("a second knock refills it, and at the level you are now", kd.onKnock(1, 2) && kd.hp === 450 && kd.max === 450, `${kd.hp} of ${kd.max}`);
}

{
  const kd = new Knockdown();
  kd.onKnock(0, 1);
  const down = kd.absorb(60);
  check("a shield that is not raised soaks nothing", down.through === 60 && !down.broke && kd.hp === 200, `${down.through} through`);
  kd.up = true;
  const soaked = kd.absorb(60);
  check("raised, it takes the hit whole", soaked.through === 0 && !soaked.broke && kd.hp === 140, `${kd.hp} left`);
  const broke = kd.absorb(200);
  check("the hit that empties it reports the break once, and the rest reaches you", broke.through === 60 && broke.broke && !kd.up, `${broke.through} through`);
  const after = kd.absorb(30);
  check("broken, it stays broken for the rest of that knock", after.through === 30 && !after.broke, `${after.through} through`);
}

// ---------------------------------------------------------- the self-revive

check("the channel is longer than a squad mate's revive, so pushing a knock is still right", SELF_REVIVE.time > squadCfg.reviveTime, `${SELF_REVIVE.time} s against ${squadCfg.reviveTime} s`);
check("and it gives back no more than being picked up does", SELF_REVIVE.health <= squadCfg.reviveHealth, `${SELF_REVIVE.health} health`);

{
  const kd = new Knockdown();
  kd.onKnock(0, 1);
  check("a shield with no self-revive does nothing when you hold the key", kd.selfRevive(0, true, false).state === "idle" && !kd.canSelfRevive);
  kd.take("gold", 1);
  check("a gold one is ready", kd.canSelfRevive && kd.selfLeft === 1);
  const started = kd.selfRevive(0, true, false);
  check("holding starts the channel", started.state === "running" && started.progress === 0, started.state);
  const half = kd.selfRevive(SELF_REVIVE.time / 2, true, false);
  check("it runs to half way at half the time", half.state === "running" && Math.abs((half.state === "running" ? half.progress : 0) - 0.5) < 1e-9, half.state);
  const hit = kd.selfRevive(SELF_REVIVE.time / 2, true, true);
  check("a hit drops it, and says so once", hit.state === "cancelled" && kd.selfRevive(SELF_REVIVE.time / 2, false, false).state === "idle", hit.state);
  const again = kd.selfRevive(SELF_REVIVE.time / 2, true, false);
  check("what it had run is not kept: the next hold starts at nothing", again.state === "running" && again.progress === 0, again.state);
  const done = kd.selfRevive(SELF_REVIVE.time * 1.5, true, false);
  check("a whole channel brings you up at the revive's health", done.state === "done" && (done.state === "done" ? done.health : 0) === SELF_REVIVE.health, `${SELF_REVIVE.health} health`);
  check("and it is spent: one per shield, not one per knock", !kd.canSelfRevive && kd.selfRevive(100, true, false).state === "idle", `${kd.selfLeft} left`);
  kd.onKnock(1, 1);
  check("a second knock refills the soak but not the revive", kd.hp === KNOCK_SHIELDS.gold.hp && !kd.canSelfRevive, `${kd.hp} of ${kd.max}, ${kd.selfLeft} revives`);
  check("a fresh gold shield off the floor is worth taking now", kd.take("gold", 1) && kd.canSelfRevive);
}

{
  const kd = new Knockdown();
  kd.take("gold", 1);
  kd.selfRevive(0, true, false);
  check("the HUD can read the bar while it runs, and nothing when it does not", Math.abs((kd.selfProgress(SELF_REVIVE.time / 4) ?? -1) - 0.25) < 1e-9 && kd.selfProgress(0) !== null);
  kd.selfRevive(1, false, false);
  check("a released channel leaves no bar behind", kd.selfProgress(2) === null);
}

{
  const kd = new Knockdown();
  kd.take("gold", 1);
  kd.onKnock(0, 1);
  kd.up = true;
  kd.reset();
  check("a new life clears the shield, the revive and the raise", kd.looted === null && kd.selfLeft === 0 && kd.hp === 0 && !kd.up && kd.knock === -1);
}

check("the config carries its own notes", Boolean(itemsCfg._knockdown && itemsCfg._selfRevive));

export const knockdownFails = fails;
if (process.argv[1]?.includes("knockdown")) console.log(fails ? `\n${fails} FAILED` : "\nknockdown PASS");
