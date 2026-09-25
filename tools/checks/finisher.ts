// Finishers (src/game/finisher.ts): who can be finished from where, and the
// two figure acts that carry one over the network.
//
// The running of one (the keys held, the camera, the kill through the melee's
// path, the shield back, a hit breaking it off) is checked end to end in the
// e2e's bot squads section, on a real knocked bot.
//
// Run on its own: npx tsx tools/checks/finisher.ts.
import { finishTarget, yawToward, blowsBy } from "../../src/game/finisher";
import { actCode, actFromCode } from "../../src/game/dummy";
import CFG from "../../src/config/finisher.json";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("Finishers");
{
  const me = { x: 0, y: 0, z: 0 };
  // yaw 0 looks down -z
  const ahead = (d: number, side = 0, y = 0) => ({ at: { x: side, y, z: -d }, item: `${d},${side},${y}` });
  check("a knocked enemy a metre ahead can be finished", finishTarget(me, 0, [ahead(1)]) === "1,0,0");
  check("one past the reach cannot", finishTarget(me, 0, [ahead(CFG.reach + 0.1)]) === null, `reach ${CFG.reach}`);
  check("one behind you cannot: you have to be facing them", finishTarget(me, 0, [{ at: { x: 0, y: 0, z: 1 }, item: "behind" }]) === null);
  const off = Math.tan(((CFG.cone + 10) * Math.PI) / 180);
  check("one off to the side past the cone cannot", finishTarget(me, 0, [ahead(1, off)]) === null, `cone ${CFG.cone}`);
  check("one on a floor above cannot", finishTarget(me, 0, [ahead(1, 0, CFG.rise + 0.5)]) === null);
  check("of two in reach, the nearer is the one", finishTarget(me, 0, [ahead(1.8), ahead(0.9)]) === "0.9,0,0");
  check("standing over them counts whatever way you face", finishTarget(me, 90, [{ at: { x: 0.1, y: 0, z: 0 }, item: "under" }]) === "under");
  // turned to face them: the yaw that points at a spot, then a pick from there
  const spot = { x: 1.2, y: 0, z: 0.8 };
  const yaw = yawToward(me, spot);
  check("turning to face them points straight at them", finishTarget(me, yaw, [{ at: spot, item: "it" }], CFG.reach, 1) === "it", `yaw ${yaw.toFixed(1)}`);
  check("the blows land in order inside the finisher, each heard once", blowsBy(0) === 0 && blowsBy(CFG.seconds) === CFG.blows.length && CFG.blows.every((b, i) => b < CFG.seconds && (i === 0 || b > CFG.blows[i - 1])), JSON.stringify(CFG.blows));
  check("it kills a downed pool (never more than 100) in one blow", CFG.damage >= 100 && CFG.damage <= 1000, `${CFG.damage}`);
  // The acts ride on the state packet as a small number. The old codes stay
  // where they were, so a page from before this reads the new ones as
  // nothing rather than as a reload.
  const old = ["reload", "swap", "throw", "melee", "revive", "interact"] as const;
  check("the acts that were there keep their codes (1 to 6)", old.every((a, i) => actCode(a) === i + 1));
  check("finishing and being finished go over the wire and come back", actFromCode(actCode("finish")) === "finish" && actFromCode(actCode("finished")) === "finished" && actCode("finish") < 10 && actCode("finished") < 10);
}

console.log(fails === 0 ? "\nFINISHER PASS" : `\nFINISHER FAIL (${fails})`);
export const finisherFails = fails;
if (process.argv[1]?.endsWith("finisher.ts")) process.exit(fails === 0 ? 0 : 1);
