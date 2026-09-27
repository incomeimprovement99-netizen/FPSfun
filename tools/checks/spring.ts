// The view's recoil springs (src/game/spring.ts): stepped in short pieces, a stiff spring settles at any frame time. The
// USSO's kick, stepped once a frame, grew without end on slow frames and flung the gun off.
//
// Run: npx tsx tools/checks/spring.ts
import { springStep } from "../../src/game/spring";
import feel from "../../src/config/gunfeel.json";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
/** a kick of `impulse` into a spring, run for `seconds` at a frame time of `dt`: the largest offset, and the last */
function run(k: number, c: number, impulse: number, dt: number, seconds: number): { peak: number; end: number } {
  let x = 0;
  let v = impulse;
  let peak = 0;
  for (let t = 0; t < seconds; t += dt) {
    [x, v] = springStep(x, v, k, c, dt);
    peak = Math.max(peak, Math.abs(x));
  }
  return { peak, end: Math.abs(x) };
}
console.log("\nThe recoil springs");
for (const [id, g] of Object.entries(feel.guns as Record<string, { kick: { spring: number; damp: number; impulse: number } }>)) {
  // as far as at 240 fps and no further, and still by 3 s (BOOG's is a slow, heavy one on purpose)
  const fine = run(g.kick.spring, g.kick.damp, g.kick.impulse, 1 / 240, 3).peak;
  for (const fps of [60, 20, 12]) {
    const r = run(g.kick.spring, g.kick.damp, g.kick.impulse, Math.min(0.05, 1 / fps), 3);
    check(`${id}'s kick stays in bounds and settles at ${fps} fps`, r.peak <= fine * 1.5 && r.end < 1e-3, `peak ${r.peak.toExponential(2)} against ${fine.toExponential(2)}, ${r.end.toExponential(2)} at 3 s`);
  }
}
{
  const fine = run(260, 24, 32, 1 / 240, 3).peak;
  const r = run(260, 24, 32, 0.05, 3);
  check("the plain kick stays in bounds and settles at 20 fps", r.peak <= fine * 1.5 && r.end < 1e-3, `peak ${r.peak.toExponential(2)} against ${fine.toExponential(2)}, ${r.end.toExponential(2)}`);
}
console.log(fails === 0 ? "\nSPRING PASS" : `\nSPRING FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
