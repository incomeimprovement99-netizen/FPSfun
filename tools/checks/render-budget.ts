// How far each preset draws (docs/PLAN_LOD_DRAW_DISTANCE.md step E). (The
// mesh and triangle budget of step B was the Outskirts map's, built in node and
// merged: it went with the map in Milestone 528. The Neon City's looks are its
// bake, which node does not load, so a count there would hold nothing.)
//
// The draw distance is arithmetic, so it is checked exactly: each preset's
// fog ends where it draws, the near end keeps its proportion, and the camera's
// far plane sits beyond the fog, because anything clipped in clear air is the
// pop this was written to end.
//
// Run on its own: npx tsx tools/checks/render-budget.ts.
import { PRESETS, drawRange } from "../../src/game/quality";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("How far each preset draws");
{
  const br = { near: 140, far: 680 };
  const range = { near: 55, far: 290 };
  const comp = drawRange(br, PRESETS.competitive);
  const high = drawRange(br, PRESETS.high);
  check("Competitive draws least and High most", PRESETS.competitive.drawDistance < PRESETS.balanced.drawDistance && PRESETS.balanced.drawDistance < PRESETS.high.drawDistance, `${PRESETS.competitive.drawDistance}, ${PRESETS.balanced.drawDistance}, ${PRESETS.high.drawDistance} m`);
  check("the fog ends where the preset stops drawing", comp.far === PRESETS.competitive.drawDistance && high.far === Math.min(br.far, PRESETS.high.drawDistance), `${comp.far} m and ${high.far} m`);
  check("the near end of the fog keeps its proportion, so the fall-off is the same shape", Math.abs(comp.near / comp.far - br.near / br.far) < 1e-9, `${comp.near.toFixed(0)} m`);
  check("the camera's far plane is beyond the fog's end, so nothing is cut off in clear air", comp.camFar > comp.far && high.camFar > high.far, `${comp.camFar} m and ${high.camFar} m`);
  const r = drawRange(range, PRESETS.competitive);
  check("a region whose fog is shorter than the preset draws keeps its own fog", r.far === range.far && r.near === range.near, `${r.near} to ${r.far} m`);
}

console.log(fails === 0 ? "\nRENDER BUDGET PASS" : `\nRENDER BUDGET FAIL (${fails})`);
export const renderBudgetFails = fails;
if (process.argv[1]?.endsWith("render-budget.ts")) process.exit(fails === 0 ? 0 : 1);
