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
import { LootField, binContents, pickHotZone, rarityWeights, rollSpot, seeded, tierOf, type LootItem, type LootPlace, type PlaceTier, type Rarity } from "../../src/game/loot";
import { optionsFor, SLOTS } from "../../src/game/attachments";
import { weaponMods } from "../../src/game/weapons";
import { AmmoPouch, STACK, ammoCap, ammoTypeOf } from "../../src/game/ammo";
import ammoCfg from "../../src/config/ammo.json";

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
/** the eight small sites between them (br.ts's sites), on open ground of their own well clear of the places */
const sites: LootPlace[] = Array.from({ length: 8 }, (_, i) => ({ id: `site${i}`, x: (i % 4) * 200 - 300, z: 6500 + Math.floor(i / 4) * 200, radius: 18 }));
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
  field.generate(seed, places, bounds, sites);
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
  const pool: Record<PlaceTier, LootItem[]> = { low: [], mid: [], high: [], site: [], hot: [] };
  const counts: Record<PlaceTier, number[]> = { low: [], mid: [], high: [], site: [], hot: [] };
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
  const pool: Record<PlaceTier, LootItem[]> = { low: [], mid: [], high: [], site: [], hot: [] };
  for (const m of matches) for (const t of m.takes) pool[t.tier].push(...t.items.filter(rolled));
  for (const tier of Object.keys(pool) as PlaceTier[]) {
    if (!pool[tier].length) continue;
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
    const guns = spot.filter((it) => it.kind === "weapon");
    if (!guns.length) continue;
    racks++;
    // A rack can hold two guns, so a stack has to match ONE of them and not
    // whichever happens to be first. The roller used to remember only the
    // last gun's type, which left the other one with a stack it could not
    // use; this is the check that would have caught it.
    const types = guns.map((g) => ammoTypeOf(g.id));
    const ammo = spot.filter((it) => it.kind === "ammo");
    // An energy gun draws on a stockpile rather than a stack, so its share of
    // the spot becomes an attachment. A rack that holds one is allowed to
    // carry no ammo at all; what is never allowed is a stack that none of the
    // guns on the rack can take.
    if (types.every((t) => t === "energy")) energyStacks += ammo.length;
    else if (ammo.some((a) => !types.includes(a.id as ReturnType<typeof ammoTypeOf>))) wrongAmmo++;
    else if (!ammo.length && !types.includes("energy")) wrongAmmo++;
    if (!spot.some((it) => it.kind === "attach" && it.id.startsWith("mag:"))) noMag++;
  }
  check("a gun rack holds ammo one of its own guns takes", wrongAmmo === 0, `${racks} racks, ${wrongAmmo} with the wrong stack`);
  check("a rack of energy guns holds no stack it cannot use", energyStacks === 0, `${energyStacks} useless stacks`);
  // A rack used to come with a magazine every time. That was written when
  // racks were a third of the floor; they are over half of it now, because a
  // rack is what puts a gun in your hands and the owner asked for guns. At
  // that share, a magazine on every rack made the magazine the commonest
  // object on the map after a heal, at nearly two per gun, most of them worse
  // than the one already fitted. Magazines come off the attachment table now,
  // like every other attachment, and the rule is only that they stay rarer
  // than the guns they go in.
  check("a magazine is an attachment and not what the floor is made of", noMag > racks * 0.5, `${noMag} of ${racks} racks carry none`);
  check("a spot is never empty", Math.min(...sizes) > 0, `smallest ${Math.min(...sizes)}, largest ${Math.max(...sizes)} items`);
}

// ---------------------------------------------------------------- the sites
//
// The small places between the big ones: each lays its own tier's spots, is
// never the Hot Zone, leans a little richer than a mid place, and adding
// them moved nothing of the nine places' own rolls or the Hot Zone.
{
  const siteTier = lootCfg.siteTier as PlaceTier;
  const near = (d: { pos: { x: number; z: number } }, p: LootPlace) => Math.hypot(d.pos.x - p.x, d.pos.z - p.z) <= (p.radius ?? 18) + 1;
  const items: LootItem[] = [];
  let everyHas = true;
  let neverHot = true;
  let unmoved = true;
  const plain = new LootField(null);
  for (const seed of seeds) {
    field.generate(seed, places, bounds, sites);
    plain.generate(seed, places, bounds);
    if ((field.hotZone?.id ?? "").startsWith("site")) neverHot = false;
    if (field.hotZone?.id !== plain.hotZone?.id) unmoved = false;
    // the nine places' items, the same with or without the sites
    const key = (f: LootField) => [...f.drops.values()].filter((d) => places.some((p) => Math.hypot(d.pos.x - p.x, d.pos.z - p.z) <= 40)).map((d) => `${d.item.kind}:${d.item.id}:${d.pos.x.toFixed(2)}`).join("|");
    if (key(field) !== key(plain)) unmoved = false;
    for (const s of sites) {
      const here = [...field.drops.values()].filter((d) => near(d, s));
      if (!here.length) everyHas = false;
      items.push(...here.map((d) => d.item));
    }
  }
  check("every site holds loot, match after match", everyHas);
  check("a site is never the Hot Zone, and adding the sites moved neither the Hot Zone nor the places' own loot", neverHot && unmoved);
  const want = normalised(rarityWeights(siteTier));
  const got = items.filter(rolled);
  check(
    "a site's loot leans between a mid place's and a high place's",
    Math.abs(share(got, "epic") - want.epic) < 0.03 && Math.abs(share(got, "legendary") - want.legendary) < 0.03,
    `epic ${share(got, "epic").toFixed(3)} want ${want.epic.toFixed(3)}, legendary ${share(got, "legendary").toFixed(3)} want ${want.legendary.toFixed(3)}`,
  );
}

// ---------------------------------------------------------------- density
//
// What the whole floor holds, by kind, over every seed. The move to typed
// spots re-tuned this without anyone noticing: guns fell 57 per cent,
// helmets 80, hop-ups 69, and magazines went up eight times, so the
// commonest thing on the map after a heal was a magazine, most of them worse
// than the one already fitted. Every check passed, because they all asked
// whether a place hands you a gun and none asked how many. These do ask.
console.log("");
console.log("Loot density");
{
  const tally: Record<string, number> = { weapon: 0, ammo: 0, heal: 0, attach: 0, helmet: 0, hopup: 0, grenade: 0, mag: 0 };
  let total = 0;
  for (const seed of seeds) {
    field.generate(seed, places, bounds, sites);
    for (const d of field.drops.values()) {
      // a supply bin is a container, not an item on the floor
      if (d.item.kind === "bin") continue;
      total++;
      tally[d.item.kind] = (tally[d.item.kind] ?? 0) + 1;
      if (d.item.kind === "attach" && String(d.item.id).startsWith("mag")) tally.mag++;
    }
  }
  const per = (n: number) => n / seeds.length;
  const targets = lootCfg.densityTargets as unknown as Record<string, [number, number]>;
  for (const [kind, [lo, hi]] of Object.entries(targets)) {
    const got = kind === "total" ? per(total) : per(tally[kind] ?? 0);
    check(`a match's floor holds the right number of ${kind === "mag" ? "magazines" : kind === "total" ? "items in all" : kind + "s"}`, got >= lo && got <= hi, `${got.toFixed(1)}, want ${lo} to ${hi}`);
  }
  // A magazine is an attachment among others, not the thing the floor is made
  // of: it went to 1.8 magazines per gun, and a floor reads as junk long
  // before that.
  check("and fewer magazines than guns", tally.mag < tally.weapon, `${per(tally.mag).toFixed(1)} against ${per(tally.weapon).toFixed(1)}`);
}

// ---------------------------------------------------------------- supply bins
// A place has a spot or two for a bin and a site one, each there with the
// chance from the seed: rich one match, thin the next. A bin opened throws
// out its tier's rolls, the same for the same bin in the same match.
{
  const B = lootCfg.bins;
  const counts: number[] = [];
  for (const seed of seeds) {
    field.generate(seed, places, bounds, sites);
    counts.push([...field.drops.values()].filter((d) => d.item.kind === "bin").length);
  }
  const most = places.length * B.perPlace + sites.length * B.perSite;
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  check(`bins: about ${Math.round(most * B.chance)} a match of ${most} spots, and not the same number every match`, Math.abs(mean - most * B.chance) < most * 0.08 && new Set(counts).size > 3, `${mean.toFixed(1)} a match, ${Math.min(...counts)} to ${Math.max(...counts)}`);
  const a = binContents(seeds[0], 41);
  const b = binContents(seeds[0], 41);
  const c = binContents(seeds[0], 42);
  check("a bin's contents are the same for the same bin and match, and differ bin to bin", JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c) && a.length >= B.spots, `${a.length} items`);
}

// ---------------------------------------------------------------- what you can carry
// There was no limit: the walk-over pickup took every matching stack and a
// match ended with thousands of rounds. The backpack sets it now.
{
  const C = ammoCfg.carry;
  check(`a white backpack carries ${C.stacks} stacks of a type, each tier up ${C.perPack} more`, ammoCap("light", 0) === STACK.light * C.stacks && ammoCap("light", 3) === STACK.light * (C.stacks + 3 * C.perPack), `${ammoCap("light", 0)} light rounds white, ${ammoCap("light", 3)} gold`);
  const pouch = new AmmoPouch();
  pouch.packTier = 0;
  const cap = ammoCap("heavy", 0);
  pouch.add("heavy", cap - 10);
  const put = pouch.add("heavy", 60);
  check("a stack that does not fit goes in as far as it fits, and says how much", put === 10 && pouch.stock.heavy === cap && pouch.room("heavy") === 0, `${put} went in`);
  const range = new AmmoPouch();
  check("outside a battle royale nothing limits it", range.add("light", 100000) === 100000);
}

console.log(fails === 0 ? "\nLOOT TIERS PASS" : `\nLOOT TIERS FAIL (${fails})`);
export const lootTiersFails = fails;
if (process.argv[1]?.endsWith("loot-tiers.ts")) process.exit(fails === 0 ? 0 : 1);
