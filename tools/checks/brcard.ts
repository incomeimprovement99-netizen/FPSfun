// The battle royale's loading screen (src/ui/loading.ts setCard, main.ts playerCard, hud.json loading.tipsBr): the
// tips teach what the owner asked for (2026-10-02: how the decay closes in, fusing guns and hacks, the jump pads and
// lifts, and every move: wall run, double jump, wall kick, superglide, tap-strafe), every number in them is one the
// game puts in, and there are enough to fill the card's column.
//
// The card itself (its name, figure, numbers, guns and hacks) was photographed at 1080p, 1366x768 and a phone's
// width, 2026-10-02 (Milestone 412): the match screen is skipped by every e2e page (?nointro).
//
// Run on its own: npx tsx tools/checks/brcard.ts.
import HUD from "../../src/config/hud.json";
import HOLD from "../../src/config/soldierhold.json";
import SK from "../../src/config/games/speedkills.json";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("The battle royale's card");
{
  const tips = HUD.loading.tipsBr;
  const all = tips.map((t) => `${t.tag} ${t.say}`).join(" ").toLowerCase();
  const asked = ["decay", "capture zone", "fuse your guns", "fuse your hacks", "jump pads", "lifts", "wall run", "double jump", "wall kick", "superglide", "tap-strafe"];
  const missing = asked.filter((w) => !all.includes(w));
  check("the tips teach everything the owner asked for", missing.length === 0, missing.join(", "));
  check("no tip calls the decay a ring closing", !tips.some((t) => /ring (is )?clos/i.test(t.say)));
  const known = ["captureHold", "gunLevels", "hackLevels"];
  const unknown = tips.flatMap((t) => [...t.say.matchAll(/\{(\w+)\}/g)].map((m) => m[1])).filter((k) => !known.includes(k));
  check("every {number} in a tip is one main.ts tipWords puts in", unknown.length === 0, unknown.join(", "));
  const tags = tips.map((t) => t.tag);
  check("each tip has its own heading", new Set(tags).size === tags.length);
  check("more tips than the card shows at once, so they turn over", tips.length > HUD.loading.brCard.tipsShown, `${tips.length} for ${HUD.loading.brCard.tipsShown}`);
  check("each tip short enough to read while the bar fills (at most 40 words)", tips.every((t) => t.say.split(/\s+/).length <= 40));
  // the figure holds only a gun the soldier's third person is finished for (the owner: "the BOOG and the USSO to start")
  const figGuns = HUD.loading.brCard.figureGuns;
  const held = HOLD.guns as Record<string, unknown>;
  check("the card's figure holds only guns SpeedKills hands out that have the soldier's own hold", figGuns.length > 0 && figGuns.every((g) => (SK.roster as string[]).includes(g) && !!held[g]), figGuns.join(", "));
  check("and faces you", HUD.loading.brCard.portraitTurn === 0);
}

console.log(fails === 0 ? "\nBR CARD PASS" : `\nBR CARD FAIL (${fails})`);
export const brCardFails = fails;
