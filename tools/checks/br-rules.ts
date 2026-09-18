// The battle royale's match rules (src/config/br.json, src/game/brmatch.ts):
// the squad sizes, Storm Surge, the loadout crate and the care package's
// arrival.
//
// None of these can be checked against a published number, because Apex
// publishes none of them. What is checked is that each rule is coherent with
// the rules around it and cannot leave a match somewhere it cannot come back
// from: a bot squad a seat short, a surge that would fire in round one or
// that never fires at all, a crate that lands outside the ring it was called
// into or on top of a package's call, or a package that is announced after it
// has already arrived.
//
// Run on its own: npx tsx tools/checks/br-rules.ts. Also belongs inside npm
// run verify.
import { TEAMS, teamFor, savedTeamId, botSquads, squadsInMatch, surgeAllowed, surgeVictims, surgeDamage, surgeNotice, loadoutPodAt, loadoutItems, DROP_HEIGHT, type SurgeView } from "../../src/game/brmatch";
import { BOT_NAMES } from "../../src/game/bots";
import { DEFAULT_LOADOUTS } from "../../src/game/loadouts";
import { kittedAttach } from "../../src/game/loot";
import { ammoTypeOf, STACK } from "../../src/game/ammo";
import { RING_PHASES, RING_TICK, RING_BOUNDS, type Circle } from "../../src/game/ring";
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

// the match takes at most one bot per name (brmatch.ts clamps to it)
const most = Math.max(...TEAMS.flatMap((t) => t.bots));
check("no size offers more bots than the match can field", TEAMS.every((t) => t.bots.every((n) => n >= 1)) && most <= BOT_NAMES.length, `${most} of ${BOT_NAMES.length}`);

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

const solo = teamFor("solo");
const duo = teamFor("duo");
const trio = teamFor("trio");
check(
  "solo has no bleed-out, duos have half a trio's",
  solo.bleed === 0 && duo.bleed > 0 && duo.bleed < trio.bleed && trio.bleed === 1,
  `${solo.bleed} / ${duo.bleed} / ${trio.bleed}`
);

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

// ---------------------------------------------------------------- the surge

const S = brCfg.surge;
check("the surge has a threshold for every ring phase", S.alive.length === RING_PHASES.length, `${S.alive.length} of ${RING_PHASES.length}`);

check(
  "the early rounds never surge",
  S.alive.slice(0, S.fromPhase).every((f) => f >= 1) && surgeAllowed(S.fromPhase - 1, 12) === Infinity,
  `rounds 1 to ${S.fromPhase} are open`
);

let loosened = "";
for (let i = 1; i < S.alive.length; i++) if (S.alive[i] > S.alive[i - 1]) loosened = `phase ${i}`;
check("the threshold only ever tightens", !loosened, loosened || S.alive.join(" -> "));

check(
  "the surge never thins a lobby below minAlive",
  [4, 8, 12].every((total) => RING_PHASES.every((_, p) => surgeAllowed(p, total) >= S.minAlive)),
  `floor ${S.minAlive}`
);

check(
  "a full lobby is over the line by the round the surge starts",
  surgeAllowed(S.fromPhase, 12) < 12 && surgeAllowed(S.fromPhase, 4) < 4,
  `12 allows ${surgeAllowed(S.fromPhase, 12)}, 4 allows ${surgeAllowed(S.fromPhase, 4)}`
);

const worstRing = Math.max(...RING_PHASES.map((p) => p.damage));
check(
  "the surge damage escalates, and ends worse than standing outside the ring",
  S.damage.every((d, i) => i === 0 || d > S.damage[i - 1]) && S.damage[S.damage.length - 1] > worstRing,
  `${S.damage.join(" -> ")} against the ring's ${worstRing}`
);

// The ranking itself. Four alive, none of them fresh from a fight.
const old = -1000;
const rows = [
  { id: 0, dealt: 400, at: old },
  { id: 1, dealt: 0, at: old },
  { id: 2, dealt: 120, at: old },
  { id: 3, dealt: 30, at: old },
];
check("nobody is surged while the lobby is inside the threshold", surgeVictims(rows, 4, 0).length === 0 && surgeVictims(rows, 9, 0).length === 0);

const taken = surgeVictims(rows, 2, 0);
check("the surge takes exactly the count above the line, least damage first", taken.length === 2 && taken.includes(1) && taken.includes(3), `ids ${taken.join(", ")}`);

// Grace is the difference between hiding and losing a fight you are in.
const fighting = rows.map((r) => (r.id === 1 ? { ...r, at: -S.grace * 0.5 } : r));
check(
  "dealing damage recently buys you out of it",
  !surgeVictims(fighting, 2, 0).includes(1) && surgeVictims(fighting.map((r) => (r.id === 1 ? { ...r, at: -S.grace * 2 } : r)), 2, 0).includes(1),
  `${S.grace} s`
);

check(
  "the damage steps on br.json's clock and stops at the last step",
  surgeDamage(0) === S.damage[0] && surgeDamage(S.stepEvery * 1.5) === S.damage[1] && surgeDamage(S.stepEvery * 1000) === S.damage[S.damage.length - 1],
  `a step every ${S.stepEvery} s, ${S.damage.length} steps`
);

// What the surge says, and when. The host runs it and a guest only sees it in
// the ring packet twice a second, so both go through surgeNotice: a notice for
// each change worth one, and nothing for a countdown ticking down, which on a
// guest would be a notice every packet.
{
  const warned = (startsIn: number): SurgeView => ({ live: false, startsIn, damage: S.damage[0], below: 2 });
  const live = (damage: number): SurgeView => ({ live: true, startsIn: 0, damage, below: 2 });
  const said = [
    surgeNotice(null, warned(S.warn)),
    surgeNotice(warned(S.warn), warned(S.warn - 0.5)),
    surgeNotice(warned(0.2), live(S.damage[0])),
    surgeNotice(live(S.damage[0]), live(S.damage[0])),
    surgeNotice(live(S.damage[0]), live(S.damage[1])),
    surgeNotice(live(S.damage[1]), null),
    surgeNotice(warned(3), null),
    surgeNotice(null, null),
  ];
  const shape = said.map((s) => (s === null ? "-" : /OVER/.test(s) ? "over" : /IN \d/.test(s) ? "warn" : "step")).join(" ");
  check(
    "the surge is announced, counted down in silence, called live, stepped and ended, once each",
    shape === "warn - step - step over over -" && said[0]!.includes(`IN ${S.warn}`) && said[2]!.includes(`${S.damage[0]} EVERY ${RING_TICK} S`) && said[4]!.includes(`${S.damage[1]} EVERY`),
    shape
  );
  // a guest whose first packet with the surge in it is already past the warning
  const late = surgeNotice(null, live(S.damage[2]));
  check("a guest that first hears of it once it is live is told what it costs", !!late && late.includes(`${S.damage[2]} EVERY`), String(late));
}

// ---------------------------------------------------------- loadout crates

const L = brCfg.loadoutPod;
check(
  "one or two crates a match, both of them late",
  L.phases.length >= 1 && L.phases.length <= 2 && new Set(L.phases).size === L.phases.length && L.phases.every((p) => p >= 1 && p < RING_PHASES.length),
  `ring phases ${L.phases.join(" and ")} of ${RING_PHASES.length}`
);

// Every browser works the crate's spot out for itself from the match seed and
// the circle in the ring packet, so it must land inside that circle wherever
// the circle is, and it must be the same point on every browser.
const rnd = (() => {
  let s = 12345;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
})();
let outside = "";
let drift = 0;
for (let i = 0; i < 400; i++) {
  const r = 8 + rnd() * 120;
  const reach = RING_BOUNDS.half - r;
  const c: Circle = { cx: RING_BOUNDS.centerX + (rnd() * 2 - 1) * reach, cz: RING_BOUNDS.centerZ + (rnd() * 2 - 1) * reach, r };
  for (const phase of L.phases) {
    const seed = Math.floor(rnd() * 2 ** 31);
    const at = loadoutPodAt(seed, phase, c);
    const d = Math.hypot(at.x - c.cx, at.z - c.cz);
    if (d > r * L.inset + 1e-9) outside = `${d.toFixed(1)} m into a ${r.toFixed(1)} m circle`;
    if (Math.abs(at.x - RING_BOUNDS.centerX) > RING_BOUNDS.half || Math.abs(at.z - RING_BOUNDS.centerZ) > RING_BOUNDS.half) outside = "outside the map";
    const again = loadoutPodAt(seed, phase, c);
    drift = Math.max(drift, Math.hypot(again.x - at.x, again.z - at.z));
  }
}
check("a loadout crate lands well inside the ring it was called into", !outside, outside || `400 matches, never past ${L.inset} of the radius`);
check("the same match and phase always put it in the same place", drift === 0, "every browser draws it from the seed, so none of it goes over the wire");

const twoPhases = new Set(L.phases.map((p) => JSON.stringify(loadoutPodAt(7, p, { cx: 0, cz: 500, r: 80 }))));
check("two crates in one match land in two different places", twoPhases.size === L.phases.length, `${twoPhases.size} spots`);

check(
  "you can claim a crate from where you could loot one, standing beside it but not from a floor above",
  L.claim.reach >= lootCfg.pickupReach && L.claim.time > 0 && L.claim.time < 6 && L.claim.height > 0 && L.claim.height <= 3,
  `${L.claim.reach} m, ${L.claim.time} s, within ${L.claim.height} m up or down, against the loot's ${lootCfg.pickupReach} m`
);

check("the crate's guns arrive fitted and magazined", L.mag >= 1 && L.mag <= 4 && ["rare", "epic", "legendary"].includes(L.rarity), `${L.rarity}, mag ${L.mag}`);

// When things happen in a close, in seconds from its start. A crate's phase
// that also calls a care package used to call both on one frame, and the HUD
// shows one notice at a time: the package's call was never seen. Every
// call and every landing wants a moment of its own, and the crate has to be
// down before its own ring has finished closing.
{
  const warning = brCfg.pod.announce + lootCfg.podFall;
  let clash = "";
  let late = "";
  for (const p of L.phases) {
    const events = [L.after, L.after + warning];
    if (brCfg.pod.phases.includes(p)) events.push(0, warning);
    events.sort((a, b) => a - b);
    for (let i = 1; i < events.length; i++) if (events[i] - events[i - 1] < 1) clash = `phase ${p}: ${events.join(", ")} s`;
    if (L.after + warning > RING_PHASES[p].close) late = `phase ${p}: down at ${L.after + warning} s of a ${RING_PHASES[p].close} s close`;
  }
  check("a crate's call and landing never share a moment with a care package's", L.after > 0 && !clash, clash || `called ${L.after} s into the close, the package at 0`);
  check("and a crate is down before the ring it was called into has closed", !late, late || L.phases.map((p) => `phase ${p}: ${L.after + warning} of ${RING_PHASES[p].close} s`).join(", "));
}

// What the crate hands over: your loadout's two guns, the Hot Zone's kit on
// them from the same function, and ammo for each that counts it.
{
  let wrong = "";
  for (const def of DEFAULT_LOADOUTS) {
    const items = loadoutItems(def);
    const guns = items.filter((it) => it.kind === "weapon");
    const ammo = items.filter((it) => it.kind === "ammo");
    if (guns.length !== 2 || guns[0].id !== def.slot1 || guns[1].id !== def.slot2) wrong = `${def.name}: guns ${guns.map((g) => g.id).join(", ")}`;
    else if (guns.some((g) => g.mag !== L.mag || g.rarity !== L.rarity || JSON.stringify(g.attach) !== JSON.stringify(kittedAttach(g.id)))) wrong = `${def.name}: not kitted as the Hot Zone's gun`;
    const types = new Set<string>([def.slot1, def.slot2].map(ammoTypeOf).filter((t) => t !== "energy"));
    // a bow's arrows are one quiver, as a match's kit counts them
    const want = (id: string): number => (id === "arrows" ? STACK.arrows : STACK[id as keyof typeof STACK] * L.stacks);
    if (ammo.length !== types.size || ammo.some((a) => !types.has(a.id) || a.n !== want(a.id))) wrong = `${def.name}: ammo ${ammo.map((a) => `${a.id} ${a.n}`).join(", ")}`;
  }
  check("a crate hands over your two guns kitted, and ammo for each gun that counts it", !wrong && L.stacks >= 1, wrong || `${DEFAULT_LOADOUTS.length} default loadouts, ${L.stacks} stacks a gun, energy guns on their own stockpile`);
}

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

check("the ring's tick is the surge's tick", RING_TICK > 0, `${RING_TICK} s`);

check(
  "the config carries its own notes",
  Boolean(brCfg._note && brCfg._teams && brCfg._pod && brCfg._loadoutPod && brCfg._surge && brCfg._podHeard && brCfg._podLure && brCfg._defaultTeam)
);

export const brRulesFails = fails;
if (process.argv[1]?.includes("br-rules")) console.log(fails ? `\n${fails} FAILED` : "\nbr rules PASS");
