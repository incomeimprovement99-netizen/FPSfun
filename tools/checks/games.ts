// SpeedKills' profile (src/game/game.ts, src/config/games/speedkills.json,
// docs/PHASE_18_PLAN_SPEEDKILLS.md section 4); the switch to the legacy game
// went with it (Milestone 499).
//
// A profile only says which things are in play, so the danger is a profile
// naming something that is not there: a gun id with a typo, an optic the gun
// cannot take, an ability with no code behind it. Each would fail quietly in
// a match. These checks fail loudly here instead. They also hold SpeedKills to
// the brief's shape (about two guns a family, ten hacks, fusion that is
// better and not decisive).
//
// Run on its own: npx tsx tools/checks/games.ts.
import { GAME, IS_SK, PROFILE } from "../../src/game/game";
import { allWeaponIds, weaponMods } from "../../src/game/weapons";
import { opticsFor } from "../../src/game/attachments";
import binds from "../../src/config/binds.json";
import worldCfg from "../../src/config/world.json";
import neonCfg from "../../src/config/neonmap.json";
import ringCfg from "../../src/config/ring.json";
import { readFileSync } from "node:fs";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("SpeedKills, the one game, and its profile");
{
  // (the URL, a browser's old choice and the build's default chose between two games until Milestone 499)
  check("the game is SpeedKills, the one game", GAME === "speedkills" && IS_SK && PROFILE.id === "speedkills");

  const MAPS = new Set(["city"]);
  {
    const p = PROFILE;
    const tag = "speedkills:";
    // (against every gun the engine can make: SpeedKills' own, the launcher, is in no legacy catalogue)
    const unknown = p.roster.filter((g) => !allWeaponIds().includes(g));
    check(`${tag} every gun on the roster exists`, unknown.length === 0, unknown.join(", "));
    const inFamilies = Object.values(p.families).flatMap((f) => f.guns);
    const twice = inFamilies.filter((g, i) => inFamilies.indexOf(g) !== i);
    check(`${tag} the families hold the roster exactly, each gun once`, twice.length === 0 && inFamilies.length === p.roster.length && inFamilies.every((g) => p.roster.includes(g)), twice.join(", "));
    const named = Object.entries(p.weapons);
    check(`${tag} every named gun is on the roster`, named.every(([g]) => p.roster.includes(g)));
    const badOptic = named.filter(([g, w]) => !opticsFor(weaponMods(g)).some((o) => o.mod === w.optic)).map(([g, w]) => `${g}:${w.optic}`);
    check(`${tag} every fixed optic is one the gun can take`, badOptic.length === 0, badOptic.join(", "));
    check(`${tag} every ability sits in one of the game's slots, and every slot has a choice`, p.abilities.set.every((a) => p.abilities.slots.includes(a.slot)) && p.abilities.slots.every((s) => p.abilities.set.some((a) => a.slot === s)));
    check(`${tag} the battle royale map is one there is`, MAPS.has(p.map), p.map);
    check(`${tag} its name and line carry no other game's name`, !/apex|hyper ?scape|ubisoft|neo arcadia/i.test(`${p.name} ${p.tagline} ${p.identity.title}`));
  }

  // (that the legacy roster was the whole catalogue held while the catalogue was the legacy game's; it is SpeedKills' ten now)

  // SpeedKills: the brief's shape
  const sk = PROFILE;
  const sizes = Object.values(sk.families).map((f) => f.guns.length);
  check("speedkills: no family has more than two guns (fewer guns, stronger identities)", sizes.every((n) => n >= 1 && n <= 2), sizes.join(","));
  check("speedkills: every gun has its own name, a role and a fixed optic", sk.roster.every((g) => sk.weapons[g]?.name && sk.weapons[g]?.optic));
  const pairsDiffer = Object.values(sk.families).filter((f) => f.guns.length === 2).every((f) => sk.weapons[f.guns[0]].role !== sk.weapons[f.guns[1]].role);
  check("speedkills: each pair is a hard-hitter and a fast one", pairsDiffer);
  const names = sk.roster.map((g) => sk.weapons[g].name);
  check("speedkills: no two guns share a name", new Set(names).size === names.length);
  check("speedkills: the ten hacks the owner chose, no passives, no ultimates", sk.abilities.set.length === 10 && !sk.abilities.passives && !sk.abilities.ultimates, `${sk.abilities.set.length}`);
  check("speedkills: ten guns, BOOG the sniper, USSO and ANAKIN the SMGs", sk.roster.length === 10 && sk.weapons.sentinel?.name === "BOOG" && sk.weapons.r97?.name === "USSO" && sk.weapons.alternator_smg?.name === "ANAKIN");
  const L = sk.lists;
  const listed = L ? [...L.botWeapons, ...L.loadouts.flat(), ...L.gulagGuns] : [];
  check("speedkills: its lists (bots' guns, default loadouts, the Gulag's pool) hold only its own guns", !!L && listed.every((g) => sk.roster.includes(g)) && L.loadouts.length === 6 && L.loadouts.every((p) => p.length === 2 && p[0] !== p[1]), listed.filter((g) => !sk.roster.includes(g)).join(", "));
  check("speedkills: every gun is carried by some bot", sk.roster.every((g) => L?.botWeapons.includes(g)));
  check("speedkills: the dropship flies at least 5 s before its doors open (the owner's rule)", (sk.ship?.doorsIn ?? 0) >= 5);
  check("speedkills: infinite ammo, 100 health and 50 shield, two ghost revives, 30 players", sk.ammo === "infinite" && sk.health?.health === 100 && sk.health?.shield === 50 && sk.life.ghostRevives === 2 && sk.match.maxPlayers === 30);
  check("speedkills: no attachments (fusion is the upgrade)", sk.attachments.length === 0);
  const F = sk.fusion.gun;
  const rising = F.every((l, i) => i === 0 || (l.mag >= F[i - 1].mag && l.damage >= F[i - 1].damage && l.reload <= F[i - 1].reload && l.recoil <= F[i - 1].recoil));
  check("speedkills: fusion has a row for level 0 (as found) and each of its levels, each at least as good as the last", F.length === sk.fusion.levels + 1 && rising && F[0].damage === 1 && F[0].mag === 1);
  // the owner's numbers: 2% damage and 10% magazine a fusion, +10% and +50% at the top
  check("speedkills: each fusion adds 2% damage and 10% magazine, to +10% and +50%", F.every((l, i) => Math.abs(l.damage - (1 + 0.02 * i)) < 1e-9 && Math.abs(l.mag - (1 + 0.1 * i)) < 1e-9), JSON.stringify(F.map((l) => [l.damage, l.mag])));
  // better, not decisive: time to kill goes with 1/damage, so the top level's damage bonus bounds its advantage
  const ttkCut = 1 - 1 / F[F.length - 1].damage;
  check("speedkills: a level-5 gun kills at most about 10% faster than one as found, on damage alone", ttkCut <= 0.1, `${(ttkCut * 100).toFixed(1)}%`);
  check("speedkills: the ghost's revive is slower away from the reviver, and has a radius to be near", sk.life.ghost && sk.life.awaySlowdown > 1 && sk.life.followRadius > 0 && sk.life.reviveSeconds > 0);
}

console.log("\nSpeedKills' keys");
{
  // every key SpeedKills uses does one thing only (the legacy kit's ultimate and
  // card picks, which shared keys with the zoom, the emote and the spray, went
  // with the kits in Milestone 491)
  const byKey = new Map<string, string[]>();
  for (const [action, keys] of Object.entries(binds as Record<string, unknown>)) {
    if (action.startsWith("_")) continue;
    for (const k of Array.isArray(keys) ? keys : [keys]) if (typeof k === "string") byKey.set(k, [...(byKey.get(k) ?? []), action]);
  }
  const shared = [...byKey].filter(([, a]) => a.length > 1).map(([k, a]) => `${k}: ${a.join(", ")}`);
  check("speedkills: no key does two things", shared.length === 0, shared.join("; "));
}

// the map's size, one number everywhere: the battle royale's cut (world.json cut, Phase 23.3), the square its rounds
// live in and the Neon City's sectors' edge (neonmap.json game.sectors). From ring-place.ts, whose other checks were
// the legacy game's ring and went with it (Milestone 520)
{
  const br = readFileSync(new URL("../../src/game/br.ts", import.meta.url), "utf8");
  const cut = /BR_HALF = (?:IS_SK \? )?worldCfg\.cut\.half/.test(br);
  const edge = Math.max(...neonCfg.game.sectors.flatMap((s: { maxX: number; maxZ: number }) => [s.maxX, s.maxZ]));
  check("speedkills: the map's half-side: br.ts takes the map's cut, and the rounds' square and the sectors' edge are the same", cut && ringCfg.speedkills.half === worldCfg.cut.half && edge === worldCfg.cut.half, `cut ${worldCfg.cut.half}, ring ${ringCfg.speedkills.half}, sectors to ${edge}`);
}

console.log(fails === 0 ? "\nGAMES PASS" : `\nGAMES FAIL (${fails})`);
export const gamesFails = fails;
if (process.argv[1]?.endsWith("games.ts")) process.exit(fails === 0 ? 0 : 1);
