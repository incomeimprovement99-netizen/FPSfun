// The battle royale's match rules (src/config/br.json, src/game/brmatch.ts):
// the squad sizes and the care package's arrival. (Storm Surge and the
// loadout crate were checked here until they went, Milestone 524.)
//
// None of these can be checked against a published number, because Apex
// publishes none of them. What is checked is that each rule is coherent with
// the rules around it and cannot leave a match somewhere it cannot come back
// from: a bot squad a seat short, or a package that is announced after it
// has already arrived.
//
// Run on its own: npx tsx tools/checks/br-rules.ts. Also belongs inside npm
// run verify.
import { TEAMS, teamFor, savedTeamId, botSquads, squadsInMatch, humanSides, sideOfHuman, DROP_HEIGHT, restingSpot } from "../../src/game/brmatch";
import { RANGE_SOLIDS } from "../../src/game/range";
import * as THREE from "three";
import { BOT_NAMES, MOST_BOTS } from "../../src/game/bots";
import { RING_PHASES, RING_BOUNDS } from "../../src/game/ring";
import brCfg from "../../src/config/br.json";
import lootCfg from "../../src/config/loot.json";

let fails = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("\nThe battle royale's match rules");

// ---------------------------------------------------------------- the sizes

check(
  "three squad sizes, solo to trios",
  TEAMS.length === 3 && TEAMS.map((t) => t.size).join(",") === "1,2,3",
  TEAMS.map((t) => `${t.label} ${t.size}`).join(", ")
);

// A count is only offered when the bots make whole squads. The humans are a
// squad of their own and nothing fills their empty seats, so this is the
// whole of item 46: the first version offered counts where 1 + the count
// divided by the size, which left the last bot squad a seat short in every
// duo and trio lobby, the trio match with a gap in it that it set out to end.
let ragged = "";
for (const t of TEAMS) for (const n of t.bots) if (n % t.size !== 0) ragged = `${t.id} ${n}`;
check("every bot count offered is whole squads of bots", !ragged, ragged || TEAMS.map((t) => `${t.id}: ${t.bots.join("/")}`).join("  "));

// the match takes as many bots as the frame rate will carry, not as many as
// there are names: past the list a bot takes a number (bots.ts botName), the
// way a squad with two Smiths does, because twelve names were a cap on the
// match and the owner wanted thirty and more to stress it
const most = Math.max(...TEAMS.flatMap((t) => t.bots));
check("no size offers more bots than the match can field", TEAMS.every((t) => t.bots.every((n) => n >= 1)) && most <= MOST_BOTS, `${most} of ${BOT_NAMES.length}`);

check(
  "each size opens on a count it offers",
  TEAMS.every((t) => t.bots.includes(t.defaultBots)),
  TEAMS.map((t) => `${t.id} ${t.defaultBots}`).join(", ")
);

// An unknown size has to land somewhere: a welcome packet from an older build
// carries none at all, and a hand-typed one carries anything.
check("an unknown size falls back to the default", teamFor("six-a-side").id === brCfg.defaultTeam && teamFor(null).id === brCfg.defaultTeam, brCfg.defaultTeam);

// A match alone reads the row's last choice out of the browser's store. Here
// there is no browser at all, which is the same shape of failure as a browser
// that refuses storage, and it has to come back with the default rather than
// throw on the way into a match.
check("with no browser storage at all, the size is still the default", savedTeamId() === brCfg.defaultTeam, savedTeamId());

// (the bleed-out by squad size, solo none and duos half a trio's, was the legacy game's: SpeedKills has no knockdowns,
// so none bleeds out; it goes with the knockdowns, docs/PLAN_LEGACY_REMOVAL.md)

check(
  "the bots divide into squads the way the row says, a part-full one counted",
  botSquads(9, 3) === 3 && botSquads(10, 2) === 5 && botSquads(11, 1) === 11 && botSquads(4, 3) === 2,
  "9 in threes is 3, 10 in twos is 5, 11 alone is 11, 4 in threes is 2"
);

// A placement is out of every squad at the start: the bots', and the humans'
// as one, except in solo where each human is their own.
check(
  "a placement is out of the bot squads and yours",
  squadsInMatch(9, 3, 1) === 4 && squadsInMatch(10, 2, 2) === 6 && squadsInMatch(11, 1, 1) === 12 && squadsInMatch(3, 1, 2) === 5,
  "trios alone with 9 bots is 4, duos with a friend and 10 bots is 6, solo is everyone"
);

// Squads of friends: split, the humans are squads of the size in join order,
// and each squad is a side of its own in the count.
check(
  "split, friends make squads of the size in join order: four in duos are two duos, five in trios a trio and a pair",
  [0, 1, 2, 3].map((id) => sideOfHuman(id, 2, true)).join() === "0,0,1,1" && [0, 1, 2, 3, 4].map((id) => sideOfHuman(id, 3, true)).join() === "0,0,0,1,1" && humanSides(2, 4, true) === 2 && humanSides(3, 5, true) === 2
);
check(
  "together, every friend is one side; in solo each is their own either way",
  [0, 1, 2, 3].every((id) => sideOfHuman(id, 2, false) === 0) && humanSides(2, 4, false) === 1 && humanSides(1, 3, true) === 3 && humanSides(1, 3, false) === 3 && sideOfHuman(2, 1, false) === 2
);
check("the placement counts every squad of friends as a squad", squadsInMatch(6, 2, 4, true) === 5 && squadsInMatch(6, 2, 4) === 4, `${squadsInMatch(6, 2, 4, true)}`);

// -------------------------------------------------------- the package's theatre

const P = brCfg.pod;
check("a care package is called before it can be seen", P.announce > 0 && lootCfg.podFall > 0, `${P.announce} s called, then ${lootCfg.podFall} s falling`);

check(
  "care packages come in the middle rounds, one a round, inside the circle they close to",
  P.phases.length >= 1 && new Set(P.phases).size === P.phases.length && P.phases.every((p) => p >= 1 && p < RING_PHASES.length) && P.inset > 0 && P.inset < 1,
  `ring phases ${P.phases.join(", ")}, within ${P.inset} of the radius`
);

check("it comes in from above the drop itself", P.height > DROP_HEIGHT, `${P.height} m against a ${DROP_HEIGHT} m drop`);

check(
  "there is a window to fight over it once it is down",
  P.contest > lootCfg.podFall && P.contest <= 120,
  `${P.contest} s lit and pinged`
);

check(
  "the smoke trails behind it and the dust clears",
  P.trail.every > 0 && P.trail.every < P.trail.life && P.trail.grow > 1 && P.dust.time > 0 && P.dust.radius > P.canopy.radius,
  `a puff every ${P.trail.every} s living ${P.trail.life} s, dust to ${P.dust.radius} m`
);

check(
  "the horn carries further than the thump, and both by the metre",
  brCfg.podHeard.horn > brCfg.podHeard.thump && brCfg.podHeard.thump > 0,
  `${brCfg.podHeard.horn} m and ${brCfg.podHeard.thump} m, delayed by the 343 m/s the audio already models`
);

// A package nobody but the squad contests is a free gold gun, not an event.
check(
  "bots come for a package from across the second ring",
  brCfg.podLure > RING_PHASES[1].radius && brCfg.podLure < RING_BOUNDS.half,
  `${brCfg.podLure} m against a ${RING_PHASES[1].radius} m second circle`
);

check(
  "the config carries its own notes",
  Boolean(brCfg._note && brCfg._teams && brCfg._pod && brCfg._podHeard && brCfg._podLure && brCfg._defaultTeam)
);

// (Milestone 862) something put down comes to rest on what a body standing there would stand on: two steps of a stair
// side by side, a seam 2 cm wide between them, and a gun put down over the seam stays on the steps. Tested at a single
// point under it, it fell through the seam to the floor below. (Boxes far off from everything, there and gone again
// in the one synchronous step, so no other check running beside this one sees them)
{
  const X = 9000;
  const steps = [
    { minX: X - 1, maxX: X - 0.01, minZ: -1, maxZ: 1, top: 1, base: 0 },
    { minX: X + 0.01, maxX: X + 1, minZ: -1, maxZ: 1, top: 1, base: 0 },
  ];
  RANGE_SOLIDS.push(...steps);
  const rest = restingSpot(new THREE.Vector3(X, 1.01, 0)).y;
  const air = restingSpot(new THREE.Vector3(X + 5, 3, 0)).y;
  RANGE_SOLIDS.splice(RANGE_SOLIDS.length - steps.length, steps.length);
  check("a gun put down over the seam between two steps stays on the steps, and one put down in the air comes to the ground", Math.abs(rest - 1) < 1e-6 && air === 0, JSON.stringify({ rest, air }));
}

export const brRulesFails = fails;
if (process.argv[1]?.includes("br-rules")) console.log(fails ? `\n${fails} FAILED` : "\nbr rules PASS");
