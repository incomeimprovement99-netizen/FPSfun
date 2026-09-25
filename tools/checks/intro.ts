// The intro card (src/ui/intro.ts): the title screen the page opens on and the
// one that plays as you drop into a match.
//
// What is checked here is everything about the card that is arithmetic rather
// than paint: the beats run in order and the match card is the short one, the
// break is the same break every time it is drawn from a seed (which is what
// makes the snapshots worth comparing), every crack starts at the hole and ends
// off the pane, the shards between them cover the whole of it, and the rain
// fills the screen from the first frame at a different speed in every column.
//
// The look itself is checked by eye, in the snapshots `intro-title`,
// `intro-crack` and `intro-shards`, and by the e2e (the card plays, a key
// takes it away, and it never holds the game up).
//
// Run on its own: npx tsx tools/checks/intro.ts.
import { introBeats, crackPlan, rainColumns, blastPlan } from "../../src/ui/intro";
import INTRO_CFG from "../../src/config/intro.json";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("The intro card");
{
  const boot = introBeats("boot");
  const match = introBeats("match");
  const inOrder = (b: typeof boot): boolean => b.rain <= b.title && b.title < b.shot && b.shot < b.blast && b.blast < b.out && b.out < b.end;
  check("the beats run in order: the rain, the name, the round, the shotgun, the glass letting go, gone", inOrder(boot) && inOrder(match), `boot ${JSON.stringify(boot)}`);
  check("the card that plays into a match is the short one, and neither outstays its welcome", match.end < boot.end / 2 && boot.end <= 7 && match.end <= 2.5, `${boot.end} s and ${match.end} s`);
  check("the name is up before the shot, and the shot has time to spread before the glass goes", boot.shot - boot.title > 0.5 && boot.out - boot.shot >= INTRO_CFG.crack.spread, `${(boot.shot - boot.title).toFixed(2)} s up, ${(boot.out - boot.shot).toFixed(2)} s spreading`);
  check("there is a beat of quiet between the round and the shotgun", boot.blast - boot.shot >= 0.4 && match.blast - match.shot >= 0.2, `${(boot.blast - boot.shot).toFixed(2)} s, then the blast`);
  check("and the whole card is under four seconds", boot.end <= 4 && match.end <= 2, `${boot.end} s and ${match.end} s`);
  const quiet = introBeats("boot", true);
  check("asking for less movement gives a shorter card, in order, with no shotgun in it", quiet.end < boot.end && quiet.rain <= quiet.title && quiet.title < quiet.shot && quiet.shot < quiet.out && quiet.out < quiet.end && quiet.blast >= quiet.end, `${quiet.end} s`);
}
{
  const w = 1920;
  const h = 1080;
  const a = crackPlan(w, h, 4242);
  const b = crackPlan(w, h, 4242);
  const c = crackPlan(w, h, 99);
  check("the same seed breaks the glass the same way (the snapshots depend on it)", JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c));
  check("a crack for every ray, and a ring of glass between them", a.rays.length === INTRO_CFG.crack.rays && a.rings.length === INTRO_CFG.crack.rings, `${a.rays.length} rays, ${a.rings.length} rings`);
  const hole = a.hole;
  const fromHole = a.rays.every((r) => Math.abs(Math.hypot(r.points[0].x - hole.x, r.points[0].y - hole.y) - hole.r) < 0.001);
  check("every crack starts at the lip of the bullet hole", fromHole, `hole r ${hole.r}`);
  const offPane = a.rays.every((r) => {
    const last = r.points[r.points.length - 1];
    return last.x < 0 || last.x > w || last.y < 0 || last.y > h;
  });
  check("and runs off the pane, so none of them stops in mid air", offPane);
  const wander = a.rays.every((r) => {
    for (let i = 2; i < r.points.length; i++) {
      const a1 = Math.atan2(r.points[i].y - hole.y, r.points[i].x - hole.x);
      const a0 = Math.atan2(r.points[1].y - hole.y, r.points[1].x - hole.x);
      const d = Math.abs(Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)));
      if (d > INTRO_CFG.crack.wander * r.points.length) return false;
    }
    return true;
  });
  check("a crack wanders as it goes, but never turns back on itself", wander);
  check("the pane is cut into a shard for every crack, each one thrown its own way", a.shards.length === a.rays.length && new Set(a.shards.map((s) => s.spin)).size === a.shards.length, `${a.shards.length} shards`);
  const roundTheHole = a.shards.every((s) => Math.hypot(s.away.x, s.away.y) > 0.99 && Math.hypot(s.away.x, s.away.y) < 1.01);
  check("and each knows which way is out of the hole, to be thrown there", roundTheHole);
}
{
  const pellets = blastPlan(1920, 1080, 4242);
  const again = blastPlan(1920, 1080, 4242);
  check("the shotgun puts its whole pattern through the pane at once", pellets.length === INTRO_CFG.blast.pellets, `${pellets.length} pellets`);
  check("no two pellets go through the same place, and none of them off the screen", new Set(pellets.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`)).size === pellets.length && pellets.every((p) => p.x > 0 && p.x < 1920 && p.y > 0 && p.y < 1080));
  const mid = pellets.filter((p) => Math.hypot(p.x - 960, p.y - 540) < 260).length;
  const wide = pellets.filter((p) => Math.hypot(p.x - 960, p.y - 540) > 500).length;
  check("the pattern keeps off the middle, where the name and the rifle round's own hole are", mid === 0, `${mid} of ${pellets.length} within 260 px of the middle`);
  check("and it is thrown out across the pane rather than heaped anywhere", wide >= pellets.length / 2, `${wide} of ${pellets.length} past 500 px`);
  const pelletReach = Math.max(...pellets.map((p) => Math.max(...p.crack.rays.map((r) => Math.hypot(r.points[r.points.length - 1].x - p.x, r.points[r.points.length - 1].y - p.y)))));
  const shotReach = Math.max(...crackPlan(1920, 1080, 4242).rays.map((r) => Math.hypot(r.points[r.points.length - 1].x - 960, r.points[r.points.length - 1].y - 540)));
  check("a pellet's cracks are far shorter than the rifle round's, so the first shot stays the break", pelletReach < shotReach / 4, `${pelletReach.toFixed(0)} px against ${shotReach.toFixed(0)}`);
  check("a pellet breaks the glass around itself, not across the whole pane", pellets.every((p) => p.crack.rays.length === INTRO_CFG.blast.rays) && pellets.every((p) => p.crack.rays.every((r) => Math.hypot(r.points[r.points.length - 1].x - p.x, r.points[r.points.length - 1].y - p.y) < Math.hypot(1920, 1080) * 0.25)), `${INTRO_CFG.blast.rays} cracks a pellet`);
  check("and the same seed fires the same pattern", JSON.stringify(pellets) === JSON.stringify(again));
}
{
  const cols = rainColumns(1920, 1080, 7);
  const cfg = INTRO_CFG.rain;
  check("the rain covers the width, a column every few pixels", cols.length === Math.ceil(1920 / cfg.column) && cols[0].x === 0, `${cols.length} columns`);
  check("no two columns fall at the same speed, and every one of them is inside its band", new Set(cols.map((c) => c.speed)).size === cols.length && cols.every((c) => c.speed >= cfg.slow && c.speed <= cfg.fast), `${cfg.slow} to ${cfg.fast} glyphs a second`);
  const rows = Math.ceil(1080 / cfg.glyph);
  check("the screen is already raining when the card opens: no column starts above the top", cols.every((c) => c.start >= 0 && c.start <= rows), `${rows} rows`);
  const again = rainColumns(1920, 1080, 7);
  check("and the same seed rains the same way", JSON.stringify(cols) === JSON.stringify(again));
}
{
  // the name is the game's own, and it is the one thing on the card
  check("the card says what the game is called", INTRO_CFG.text.mark.length > 3 && INTRO_CFG.text.sub.length > 3, `${INTRO_CFG.text.mark}: ${INTRO_CFG.text.sub}`);
}

{
  // Every kind of match gets its own card: the mode's name big. A mode added
  // later without one would play the boot card's words, which says nothing
  // about what is starting. The kinds are stats.ts MatchKind's (every bot
  // difficulty is one card) and Resurgence, a battle royale's rules.
  const kinds = ["duel", "triple", "bots", "br", "resurgence", "gunrun", "tdm", "crown", "control", "ffa", "search"];
  const modes = INTRO_CFG.modes as Record<string, { name: string; sub: string }>;
  const missing = kinds.filter((k) => !modes[k] || modes[k].name.length < 3 || modes[k].sub.length < 3);
  check("every kind of match has its own card, its name and a line under it", missing.length === 0, missing.length ? `missing ${missing.join(", ")}` : `${kinds.length} cards`);
  check("and no two modes share a name", new Set(Object.values(modes).map((m) => m.name)).size === Object.keys(modes).length);
  // the flashes the owner asked be halved: the shot's 0.9 and the blast's 0.75
  check("the shot's and the blast's flashes are half as bright as they were", INTRO_CFG.crack.flash <= 0.45 && INTRO_CFG.blast.flashAlpha <= 0.375, `${INTRO_CFG.crack.flash}, ${INTRO_CFG.blast.flashAlpha}`);
}

console.log(fails === 0 ? "\nINTRO PASS" : `\nINTRO FAIL (${fails})`);
export const introFails = fails;
if (process.argv[1]?.endsWith("intro.ts")) process.exit(fails === 0 ? 0 : 1);
