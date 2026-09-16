// Loot tiers, the Hot Zone and the typed spots.
//
// Drives the real LootField (src/game/loot.ts) over many seeds and asks the
// questions the feature exists to answer: is a high place worth more than a
// low one, is there one rich place a match and is it the richest, does the
// kitted gun turn up wearing its kit, does every place still hand you a gun
// and something to heal with, and is the map's rarity mix still the one
// src/config/loot.json asks for. Every expected value is read from the config
// rather than typed here, so tuning loot.json retunes the checks with it.
//
// Run on its own: npx tsx tools/checks/loot-tiers.ts
import lootCfg from "../../src/config/loot.json";
import { LootField, pickHotZone, rarityWeights, rollSpot, seeded, tierOf, type LootItem, type LootPlace, type PlaceTier, type Rarity } from "../../src/game/loot";
import { optionsFor, SLOTS } from "../../src/game/attachments";
import { weaponMods } from "../../src/game/weapons";
import { ammoTypeOf } from "../../src/game/ammo";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
function near(label: string, got: number, want: number, tol: number): void {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label} (${got.toFixed(3)}, want ${want.toFixed(3)} +/- ${tol})`);
}

const RARITIES: Rarity[] = ["common", "rare", "epic", "legendary"];
const RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

/**
 * The nine places of br.ts's map, in br.ts's order, spread far enough apart
 * that a place's 34 m of loot cannot reach its neighbour and every spot lands
 * on open ground (nothing of the arena's geometry is out here, so a place
 * lays down exactly its tier's spot count and the counts are comparable).
 */
const places: LootPlace[] = lootCfg.placeOrder.map((id, i) => ({ id, x: (i % 3) * 300 - 300, z: 5000 + Math.floor(i / 3) * 300 - 300 }));
const bounds = { minX: -2000, maxX: 2000, minZ: 3000, maxZ: 7000 };
const SEEDS = 80;
const seeds = Array.from({ length: SEEDS }, (_, i) => i * 7919 + 13);

/** everything one place held in one match */
interface Take {
  tier: PlaceTier;
  items: LootItem[];
}
/** a rarity this item ROLLED for, as against ammo, throwables, hop-ups and helmets, whose rarity is fixed by what they are */
const rolled = (it: LootItem): boolean => (it.kind === "weapon" ? !it.attach : it.kind === "heal" || it.kind === "attach");
const meanRank = (items: LootItem[]): number => (items.length ? items.reduce((a, it) => a + RANK[it.rarity], 0) / items.length : 0);
const share = (items: LootItem[], r: Rarity): number => items.filter((it) => it.rarity === r).length / Math.max(1, items.length);
/** a weight table as four shares that sum to one */
function normalised(w: Record<Rarity, number>): Record<Rarity, number> {
  const total = RARITIES.reduce((a, k) => a + w[k], 0);
  const out = {} as Record<Rarity, number>;
  for (const k of RARITIES) out[k] = w[k] / total;
  return out;
}

const field = new LootField(null);
const matches: Array<{ seed: number; hot: number; takes: Take[]; kitted: LootItem[] }> = [];
for (const seed of seeds) {
  field.generate(seed, places, bounds);
  const hot = field.hotZone?.index ?? -1;
  const takes: Take[] = places.map((p, i) => ({ tier: i === hot ? "hot" : tierOf(p, i), items: [] }));
  const kitted: LootItem[] = [];
  for (const d of field.drops.values()) {
    if (d.item.kind === "weapon" && d.item.attach) kitted.push(d.item);
    for (let i = 0; i < places.length; i++) {
      if (Math.hypot(d.pos.x - places[i].x, d.pos.z - places[i].z) <= lootCfg.hotZone.radius) {
        takes[i].items.push(d.item);
        break;
      }
    }
  }
  matches.push({ seed, hot, takes, kitted });
}

console.log(`Loot tiers, the Hot Zone and the typed spots (src/game/loot.ts, src/config/loot.json), over ${SEEDS} seeds`);

// ------------------------------------------------------------------ tiers
{
  const pool: Record<PlaceTier, LootItem[]> = { low: [], mid: [], high: [], hot: [] };
  const counts: Record<PlaceTier, number[]> = { low: [], mid: [], high: [], hot: [] };
  for (const m of matches) {
    for (const t of m.takes) {
      pool[t.tier].push(...t.items);
      counts[t.tier].push(t.items.length);
    }
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  check(
    "a high place is worth more than a low one: richer loot",
    meanRank(pool.high) > meanRank(pool.low),
    `high ${meanRank(pool.high).toFixed(2)} vs low ${meanRank(pool.low).toFixed(2)} on a 0-3 rarity scale`,
  );
  check("and a mid place sits between the two", meanRank(pool.low) < meanRank(pool.mid) && meanRank(pool.mid) < meanRank(pool.high), `mid ${meanRank(pool.mid).toFixed(2)}`);
  check("a high place holds more of it", mean(counts.high) > mean(counts.low), `high ${mean(counts.high).toFixed(1)} items vs low ${mean(counts.low).toFixed(1)}`);
  let everyMatch = 0;
  for (const m of matches) {
    const high = m.takes.filter((t) => t.tier === "high").map((t) => t.items.length);
    const low = m.takes.filter((t) => t.tier === "low").map((t) => t.items.length);
    if (high.length && low.length && Math.min(...high) > Math.max(...low)) everyMatch++;
  }
  check("and holds more in every single match, not just on average", everyMatch === matches.length, `${everyMatch} of ${matches.length}`);
}

// ------------------------------------------------------------------ the Hot Zone
{
  const missing = matches.filter((m) => m.hot < 0).length;
  check("exactly one place a match is the Hot Zone", missing === 0, `${matches.length - missing} of ${matches.length} matches named one place`);
  const agrees = seeds.every((s) => {
    const a = pickHotZone(s, places);
    field.generate(s, places, bounds);
    return a?.index === field.hotZone?.index && a?.id === field.hotZone?.id;
  });
  check("and a guest finds the same one from the seed alone, with nothing sent", agrees);
  const ring = pickHotZone(seeds[0], places);
  check("the Hot Zone carries a radius for the map to ring", ring !== null && ring.radius === lootCfg.hotZone.radius, `${ring?.id} at ${ring?.radius} m`);
  const seen = new Set(matches.map((m) => m.hot));
  check("over enough matches it falls on every place", seen.size === places.length, `${seen.size} of ${places.length} places`);

  let richerCount = 0;
  let richerRarity = 0;
  for (const m of matches) {
    const hot = m.takes[m.hot];
    const rest = m.takes.filter((_, i) => i !== m.hot);
    if (rest.every((t) => hot.items.length > t.items.length)) richerCount++;
    if (meanRank(hot.items) > meanRank(rest.flatMap((t) => t.items))) richerRarity++;
  }
  check("and it holds more than every ordinary place, in every match", richerCount === matches.length, `${richerCount} of ${matches.length}`);
  check("and better than the rest of the map put together", richerRarity >= matches.length * 0.98, `${richerRarity} of ${matches.length} matches`);
}

// ------------------------------------------------------------------ the fully kitted gun
{
  const withGun = matches.filter((m) => m.kitted.length === 1).length;
  const tooMany = matches.filter((m) => m.kitted.length > 1).length;
  check("never more than one fully kitted gun in a match", tooMany === 0, `${tooMany} matches with two or more`);
  near("a fully kitted gun in as many matches as loot.json asks for", withGun / matches.length, lootCfg.hotZone.kittedChance, 0.1);
  const guns = matches.flatMap((m) => m.kitted);
  check("there is one to find at all", guns.length > 0, `${guns.length} over ${matches.length} matches`);
  const bare = guns.filter((g) => {
    for (const slot of SLOTS) {
      const fits = optionsFor(slot, weaponMods(g.id), g.id).filter((o) => o.mod !== null);
      if (!fits.length) continue;
      const on = g.attach?.[slot];
      if (!on || !fits.some((o) => o.mod === on)) return true;
    }
    return false;
  });
  check("the kitted gun wears every slot it can take, and only mods that fit it", bare.length === 0, `${bare.length} of ${guns.length} came up short`);
  const magOk = guns.every((g) => g.mag === lootCfg.kitted.mag && g.rarity === lootCfg.kitted.rarity);
  check("with the magazine and the colour loot.json gives it", magOk, `mag ${lootCfg.kitted.mag}, ${lootCfg.kitted.rarity}`);
  let inside = 0;
  for (const m of matches) {
    if (!m.kitted.length) continue;
    if (m.takes[m.hot].items.includes(m.kitted[0])) inside++;
  }
  check("and it lies inside the Hot Zone, not somewhere else on the map", inside === matches.filter((m) => m.kitted.length > 0).length, `${inside} of ${matches.filter((m) => m.kitted.length > 0).length}`);
}

// ------------------------------------------------------------------ a place is still a landing
{
  let instances = 0;
  let withGun = 0;
  let withHeal = 0;
  for (const m of matches) {
    for (const t of m.takes) {
      instances++;
      if (t.items.some((it) => it.kind === "weapon")) withGun++;
      if (t.items.some((it) => it.kind === "heal")) withHeal++;
    }
  }
  check("every place hands you a gun, match after match", withGun >= instances * 0.99, `${((100 * withGun) / instances).toFixed(1)}% of ${instances} landings`);
  check("and something to heal with", withHeal >= instances * 0.99, `${((100 * withHeal) / instances).toFixed(1)}% of ${instances} landings`);
}

// ------------------------------------------------------------------ the rarity mix
{
  const pool: Record<PlaceTier, LootItem[]> = { low: [], mid: [], high: [], hot: [] };
  for (const m of matches) for (const t of m.takes) pool[t.tier].push(...t.items.filter(rolled));
  for (const tier of Object.keys(pool) as PlaceTier[]) {
    const want = normalised(rarityWeights(tier));
    let worst: Rarity = "common";
    let off = 0;
    for (const r of RARITIES) {
      const d = Math.abs(share(pool[tier], r) - want[r]);
      if (d > off) {
        off = d;
        worst = r;
      }
    }
    near(`a ${tier} place rolls the ${tier} multipliers, furthest out on ${worst}`, share(pool[tier], worst), want[worst], 0.02);
  }
  // Outside the Hot Zone the map should still be the table the owner tunes:
  // the tiers move loot about between places, they do not inflate the map.
  const ordinary = [...pool.low, ...pool.mid, ...pool.high];
  const want = normalised(lootCfg.rarity as Record<Rarity, number>);
  for (const r of RARITIES) near(`the map outside the Hot Zone is still loot.json's table: ${r}`, share(ordinary, r), want[r], 0.03);
}

// ------------------------------------------------------------------ typed spots
{
  const rnd = seeded(20260916);
  let racks = 0;
  let wrongAmmo = 0;
  let energyStacks = 0;
  let noMag = 0;
  const sizes: number[] = [];
  for (let i = 0; i < 40000; i++) {
    const spot = rollSpot(rnd, "mid");
    sizes.push(spot.length);
    const gun = spot.find((it) => it.kind === "weapon");
    if (!gun) continue;
    racks++;
    const takes = ammoTypeOf(gun.id);
    const ammo = spot.filter((it) => it.kind === "ammo");
    if (takes === "energy") energyStacks += ammo.length;
    else if (!ammo.length || ammo.some((a) => a.id !== takes)) wrongAmmo++;
    if (!spot.some((it) => it.kind === "attach" && it.id.startsWith("mag:"))) noMag++;
  }
  check("a gun rack holds the ammo its own gun takes", wrongAmmo === 0, `${racks} racks, ${wrongAmmo} with the wrong stack`);
  check("an energy gun's rack holds no stack it cannot use", energyStacks === 0, `${energyStacks} useless stacks`);
  check("and every rack comes with a magazine", noMag === 0, `${noMag} racks without one`);
  check("a spot is never empty", Math.min(...sizes) > 0, `smallest ${Math.min(...sizes)}, largest ${Math.max(...sizes)} items`);
}

console.log(fails === 0 ? "\nLOOT TIERS PASS" : `\nLOOT TIERS FAIL (${fails})`);
export const lootTiersFails = fails;
if (process.argv[1]?.endsWith("loot-tiers.ts")) process.exit(fails === 0 ? 0 : 1);
