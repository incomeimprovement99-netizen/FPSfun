// The lobby (src/ui/lobby.ts, the Play tab's panel in index.html) and the
// ring's pace (src/game/ring.ts ringPace, src/config/ring.json `pace`).
//
// The lobby is a table of modes and the options each one obeys, and the page
// holds one group of controls per option. Those two can drift apart without
// anybody noticing until a player picks Gun Run and finds no box for its
// ladder, so the table is checked against the page here: every mode has a
// card, every group a mode names exists, every group on the page is named by
// some mode, and every control that used to live on the Friends tab is in the
// panel exactly once. A mode that can be played with friends has to name a
// mode the Friends box actually offers, because that name is the translation
// the player no longer has to do.
//
// The pace is arithmetic: a slow ring is a longer match and not a different
// map, so only the waits and the closes may move.
//
// Run on its own: npx tsx tools/checks/lobby.ts.
import { readFileSync } from "node:fs";
import { LOBBY_MODES, SETUP_GROUPS, setupFor, friendsModeFor, lobbyMode } from "../../src/ui/lobby";
import { RING_PHASES, RING_PACE, ringPace } from "../../src/game/ring";
import { resurgencePhases } from "../../src/game/resurgence";
import squad from "../../src/config/squad.json";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const play = html.slice(html.indexOf('<section data-panel="play">'), html.indexOf('<section data-panel="duel"'));
const has = (id: string): number => html.split(`id="${id}"`).length - 1;
const inPanel = (id: string): boolean => play.includes(`id="${id}"`);

console.log("The lobby");
{
  check("every mode the lobby offers has a card on the page, and the card says which mode it is", LOBBY_MODES.every((m) => play.includes(`id="${m.go}"`) && play.includes(`data-mode="${m.id}"`)), `${LOBBY_MODES.length} modes`);
  // (a card may carry more classes than "mode": SpeedKills' own ones are "mode skOnly")
  const cards = (play.match(/class="mode(?: [^"]*)?"/g) ?? []).length;
  check("and there are no cards on the page the table does not know about", cards === LOBBY_MODES.length, `${cards} cards, ${LOBBY_MODES.length} modes`);
  const groups = Array.from(play.matchAll(/data-group="([a-z]+)"/g)).map((m) => m[1]);
  check("every option a mode obeys has a group of controls on the page", SETUP_GROUPS.every((g) => groups.includes(g)), SETUP_GROUPS.join(", "));
  check("and every group on the page is one some mode obeys, so nothing is shown that nothing reads", groups.every((g) => SETUP_GROUPS.includes(g as never)) && new Set(groups).size === groups.length, groups.join(", "));
}
{
  // the whole point: one place to set a match up. Every control that used to
  // be on the Friends tab is in the panel, once.
  const moved = ["arenaMap", "botCount", "botDifficulty", "botAbilities", "modeBots", "modeSides", "botWeapon", "gunRunList", "ruleGuns", "ruleRounds", "ruleFF", "brTeam", "brRules", "brSides", "brBots", "brPace", "brAbilities", "brStart", "dummyMode", "dummySpeed", "dummyShoot"];
  check("every option that used to be on another tab is in the panel", moved.every(inPanel), `${moved.length} controls`);
  check("and none of them is on the page twice, which would be two answers to one question", moved.every((id) => has(id) === 1), moved.filter((id) => has(id) !== 1).join(", ") || "all once");
  check("the panel starts the match itself, alone or with friends", inPanel("startMode") && inPanel("playFriends"));
}
{
  const friends = LOBBY_MODES.filter((m) => m.friends);
  const box = html.slice(html.indexOf('id="duelMode"'));
  const offered = Array.from(box.slice(0, box.indexOf("</select>")).matchAll(/value="([a-z]+)"/g)).map((m) => m[1]);
  check("every mode that can be played with friends names a mode the Friends box offers", friends.every((m) => offered.includes(m.friends as string)), friends.map((m) => `${m.id}>${m.friends}`).join(" "));
  check("the battle royale is one of them, which is the thing that used to take a tab marked 1v1", friendsModeFor("br") === "br" && friendsModeFor("bots") === "arena");
  check("the range and the courses are not, and they are the ones with nobody else in them", ["range", "run", "runAdvanced", "tour"].every((id) => friendsModeFor(id) === null));
  check("a 1v1 cannot be played alone, and everything else can", lobbyMode("duel")?.solo === false && LOBBY_MODES.filter((m) => m.id !== "duel").every((m) => m.solo));
}
{
  // a mode only shows what it obeys: the old panel showed everything at once
  check("the range asks about its dummies and nothing about bots or a ring", setupFor("range").includes("range") && !setupFor("range").includes("br") && !setupFor("range").includes("difficulty"));
  check("the battle royale asks about the squad, the bots and the ring, and nothing about an arena", setupFor("br").includes("br") && setupFor("br").includes("difficulty") && !setupFor("br").includes("map") && !setupFor("br").includes("range"), setupFor("br").join(", "));
  check("Gun Run asks about its ladder, and no other mode does", setupFor("gunrun").includes("gunrun") && LOBBY_MODES.filter((m) => m.id !== "gunrun").every((m) => !m.needs.includes("gunrun")));
  check("every mode with bots in it asks how good they are", ["bots", "br", "gunrun", "tdm", "crown", "control", "ffa", "search"].every((id) => setupFor(id).includes("difficulty")));
  check("the courses and the tour ask nothing: they are one button each", setupFor("run").length === 0 && setupFor("runAdvanced").length === 0 && setupFor("tour").length === 0);
  check("the aim bot is offered wherever there is something to aim at", ["range", "bots", "br", "tdm"].every((id) => setupFor(id).includes("train")));
}
console.log("\nThe ring's pace");
{
  const slow = ringPace(RING_PHASES, "slow");
  const fast = ringPace(RING_PHASES, "fast");
  const same = ringPace(RING_PHASES, "normal");
  const total = (p: readonly { wait: number; close: number }[]): number => p.reduce((a, b) => a + b.wait + b.close, 0);
  check("the paces are offered slowest to fastest, and normal is the match as built", RING_PACE.slow > 1 && RING_PACE.normal === 1 && RING_PACE.fast < 1, JSON.stringify(RING_PACE));
  check("a slow ring is a longer match and a fast one a shorter", total(slow) > total(RING_PHASES) && total(fast) < total(RING_PHASES), `${total(slow)} s, ${total(RING_PHASES)} s, ${total(fast)} s`);
  check("the normal pace changes nothing at all", JSON.stringify(same) === JSON.stringify(RING_PHASES));
  check("and no pace moves a circle or a damage number: the map was built around those", [slow, fast].every((ps) => ps.every((p, i) => p.radius === RING_PHASES[i].radius && p.damage === RING_PHASES[i].damage)));
  check("every round still closes, so no pace can leave a ring waiting for ever", [slow, fast].every((ps) => ps.every((p) => p.wait > 0 && p.close > 0)));
  const res = resurgencePhases(fast, 1);
  check("Resurgence's own clock multiplies on top of the pace, rather than replacing it", total(res) < total(fast), `${total(res)} s against ${total(fast)} s`);
  const unknown = ringPace(RING_PHASES, "whatever an older host sent");
  check("a pace this build does not know is the normal one, so an old host cannot stop the ring", JSON.stringify(unknown) === JSON.stringify(RING_PHASES));
}
console.log("\nThe drop");
{
  check("boarding the ship no longer throws the map over the first thing you see of a match", squad.dive.mapOnBoard === false);
  check("a redeploy straight into the sky still gets its glance at the map", squad.dive.mapSeconds > 0, `${squad.dive.mapSeconds} s`);
}

console.log(fails === 0 ? "\nLOBBY PASS" : `\nLOBBY FAIL (${fails})`);
export const lobbyFails = fails;
if (process.argv[1]?.endsWith("lobby.ts")) process.exit(fails === 0 ? 0 : 1);
