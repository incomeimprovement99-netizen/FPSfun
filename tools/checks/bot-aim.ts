// A bot's aim against a running target, in both games (docs/PHASE_20_PLAN.md A18).
//
// A bot's aim follows its target late by its tier's lag (bots.ts aimLagOf), so it trails a target running steadily
// by the target's speed times the lag, and a body is half a metre across: the trail is most of what decides a
// tier's hits on a runner. SpeedKills' players run twice as fast (A15), which doubled every tier's trail until its
// bots aimed with half the lag (speedkills.json botAimLagScale). Held here: the follow is run as a bot runs it,
// behind a target at each game's sprint, and no tier trails a SpeedKills sprint by more than it trailed a legacy
// one (within 15%). The follow is a frame's share of the gap (not an exact exponential), so at 60 fps halving the
// quickest tiers' small lags takes more than half off their trail: Hard 0.48 m then and 0.40 now, Elite 0.19 and
// 0.08, both inside their own aim error at a fight's range; the other three match within 5%. In the legacy game
// the tiers' own lags stand.
//
// Run on its own: npx tsx tools/checks/bot-aim.ts, and GAME=speedkills npx tsx tools/checks/bot-aim.ts (verify
// runs it with SpeedKills named).
import * as THREE from "three";
import { BOT_TIERS, DIFFICULTY, aimLagOf } from "../../src/game/bots";
import { MOVE } from "../../src/game/movement";
import { GAME, IS_SK } from "../../src/game/game";
import legacyMove from "../../src/config/movement.json";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

/** how far behind a target running at `speed` m/s the aim settles, following with time constant `lag`, as Bot.update does */
function trail(lag: number, speed: number): number {
  const dt = 1 / 60;
  const aim = new THREE.Vector3();
  const target = new THREE.Vector3();
  for (let t = 0; t < 4; t += dt) {
    target.x += speed * dt;
    aim.lerp(target, Math.min(1, dt / Math.max(1e-3, lag)));
  }
  return target.x - aim.x;
}

console.log(`\nA bot's aim against a runner (game: ${GAME})`);
// a player's sprint, m/s: this game's, and the legacy game's own (movement.json, Hammer units)
const HU = 0.0254;
const legacySprint = legacyMove.sprintSpeed * HU;
if (!IS_SK) {
  check("legacy: every tier aims with its own lag", BOT_TIERS.every((t) => aimLagOf(DIFFICULTY[t]) === DIFFICULTY[t].aimLag));
} else {
  const rows: string[] = [];
  const off: string[] = [];
  for (const t of BOT_TIERS) {
    const d = DIFFICULTY[t];
    const was = trail(d.aimLag, legacySprint);
    const now = trail(aimLagOf(d), MOVE.sprintSpeed);
    rows.push(`${t} ${was.toFixed(2)} m then, ${now.toFixed(2)} m now`);
    if (now > was * 1.15) off.push(t);
  }
  check(
    `speedkills: no tier trails a sprint at ${MOVE.sprintSpeed.toFixed(1)} m/s by more than it trailed one at the legacy ${legacySprint.toFixed(1)} (within 15%)`,
    off.length === 0,
    off.length ? `off: ${off.join(", ")}; ${rows.join("; ")}` : rows.join("; "),
  );
}

console.log(fails === 0 ? "\nBOT AIM PASS" : `\nBOT AIM FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
