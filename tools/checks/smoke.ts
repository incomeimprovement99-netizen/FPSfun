// Smoke clouds (src/config/kits.json smoke, src/game/smoke.ts): what a cloud
// does to sight.
//
// A canister blocks nothing while it is still in the air; once it has bloomed,
// a line through its ball is blocked and one past it is not; a line that both
// ends inside it is blocked; it stops blocking when its seconds are up; and
// `smokeAt` finds the cloud a body is standing in, which is what SMOKE's
// passive looks through.
//
// Run on its own: npx tsx tools/checks/smoke.ts.
import * as THREE from "three";
import { KITS } from "../../src/game/abilities";
import { SMOKES, clearSmoke, smokeAt, smokeBlocks, stepSmoke, throwSmoke } from "../../src/game/smoke";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const S = KITS.smoke;
const parent = new THREE.Group();
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** run the clouds on for `secs` in sixtieths, from `t` */
function run(t: number, secs: number): number {
  for (let k = 0; k < Math.round(secs * 60); k++) {
    t += 1 / 60;
    stepSmoke(t, 1 / 60);
  }
  return t;
}

console.log("Smoke clouds");
{
  clearSmoke();
  let t = 10;
  throwSmoke(parent, V(0, 1.6, 0), V(0, 0, 20), t);
  const mid = V(0, 1.2, 20);
  const flying = smokeBlocks(V(0, 1.6, 10), V(0, 1.6, 30), t + S.fly * 0.5);
  t = run(t, S.fly + 0.6);
  check(`a canister blocks nothing in the air, and its cloud has bloomed ${S.fly} s later`, !flying && SMOKES.length === 1 && smokeBlocks(V(0, 1.6, 10), V(0, 1.6, 30), t), `${SMOKES.length} clouds`);
  check("a line through the cloud is blocked; one well past it is not", smokeBlocks(V(0, 1.6, 10), V(0, 1.6, 30), t) && !smokeBlocks(V(40, 1.6, 10), V(40, 1.6, 30), t));
  check(`a line that misses it by more than its ${S.radius} m is not blocked`, !smokeBlocks(V(S.radius + 3, 1.6, 10), V(S.radius + 3, 1.6, 30), t));
  check("standing inside it, everything is blocked", smokeBlocks(mid.clone(), mid.clone().add(V(1, 0, 1)), t));
  check("smokeAt finds the cloud a body stands in, and none for a body outside it", !!smokeAt(mid, t) && !smokeAt(V(0, 1.2, 40), t));
  // it goes when its seconds are up, and takes its puffs with it
  t = run(t, S.seconds + 1);
  check(`the cloud is gone ${S.seconds} s after it bloomed`, SMOKES.length === 0 && !smokeBlocks(V(0, 1.6, 10), V(0, 1.6, 30), t) && parent.children.length === 0, `${SMOKES.length} clouds, ${parent.children.length} in the world`);
}
{
  // a screen of three, and everything gone at a match's end
  clearSmoke();
  const t = 100;
  for (const off of [-S.ult.spread, 0, S.ult.spread]) throwSmoke(parent, V(0, 1.6, 0), V(off, 0, 20), t);
  const after = run(t, S.fly + 0.6);
  const wide = [-S.ult.spread, 0, S.ult.spread].every((off) => smokeBlocks(V(off, 1.6, 12), V(off, 1.6, 28), after));
  check(`${S.ult.count} clouds ${S.ult.spread} m apart block a line through each of them`, SMOKES.length === 3 && wide);
  clearSmoke();
  check("a match ending takes every cloud", SMOKES.length === 0 && parent.children.length === 0);
}

console.log(fails === 0 ? "\nSMOKE PASS" : `\nSMOKE FAIL (${fails})`);
export const smokeFails = fails;
if (process.argv[1]?.endsWith("smoke.ts")) process.exit(fails === 0 ? 0 : 1);
