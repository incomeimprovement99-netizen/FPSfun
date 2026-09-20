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
import { introBeats, crackPlan, rainColumns } from "../../src/ui/intro";
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
  const inOrder = (b: typeof boot): boolean => b.rain <= b.title && b.title < b.shot && b.shot < b.out && b.out < b.end;
  check("the beats run in order: the rain, the name, the shot, the glass letting go, gone", inOrder(boot) && inOrder(match), `boot ${JSON.stringify(boot)}`);
  check("the card that plays into a match is the short one, and neither outstays a few seconds", match.end < boot.end && boot.end <= 3 && match.end <= 2, `${boot.end} s and ${match.end} s`);
  check("the name is up before the shot, and the shot has time to spread before the glass goes", boot.shot - boot.title > 0.5 && boot.out - boot.shot >= INTRO_CFG.crack.spread, `${(boot.shot - boot.title).toFixed(2)} s up, ${(boot.out - boot.shot).toFixed(2)} s spreading`);
  const quiet = introBeats("boot", true);
  check("asking for less movement gives a shorter card, still in order", quiet.end < boot.end && inOrder(quiet), `${quiet.end} s`);
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

console.log(fails === 0 ? "\nINTRO PASS" : `\nINTRO FAIL (${fails})`);
export const introFails = fails;
if (process.argv[1]?.endsWith("intro.ts")) process.exit(fails === 0 ? 0 : 1);
