// The host's check on a claimed hit (src/net/hitcheck.ts, src/config/net.json hitCheck).
//
// A real claim must always pass and a forged one must not: every gun's own
// best round (a headshot at its nearest range) goes through with a shot
// behind it, and a round's worth more, a claim with no shot, one from the
// wrong distance, a swing from across the room and a stream faster than the
// gun fires are each refused.
//
// Run on its own: npx tsx tools/checks/hitcheck.ts.
import { HitCheck, maxPerSecond, maxRound } from "../../src/net/hitcheck";
import { resolveWeapon, weaponIds } from "../../src/game/weapons";
import netCfg from "../../src/config/net.json";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const C = netCfg.hitCheck;
console.log("The host's check on a claimed hit");
{
  // every gun's best real round passes
  let bad: string[] = [];
  for (const id of weaponIds()) {
    const w = resolveWeapon(id);
    const best = Math.max(w.damage.near, w.damage.far) * Math.max(1, w.damage.headshot) * Math.max(1, w.damage.shieldScale, w.damage.unshieldedScale) * (1 + (w.mech.adsCharge?.bonus ?? 0));
    const h = new HitCheck();
    if (h.judge({ from: 1, amount: best, weapon: id, dist: 20 }, 10, 9.9, 21) !== null) bad.push(id);
  }
  check(`every gun's best round, a headshot up close with every bonus, passes (${weaponIds().length} guns)`, bad.length === 0, bad.join(", "));
  // a full magazine's worth at the gun's fastest passes too
  bad = [];
  for (const id of weaponIds()) {
    const w = resolveWeapon(id);
    const h = new HitCheck();
    const round = maxRound(w) / C.margin;
    const gap = Math.min(w.shotInterval, w.spin ? 1 / w.spin.to : Infinity);
    for (let i = 0; i < Math.min(30, w.clipSize); i++) {
      const at = 10 + i * gap;
      for (let p = 0; p < Math.max(1, w.pellets); p++) if (h.judge({ from: 1, amount: round, weapon: id, dist: 20 }, at, at, 20) !== null) bad.push(id);
    }
  }
  check("a whole magazine at the gun's fastest, every pellet a headshot, passes", bad.length === 0, [...new Set(bad)].join(", "));
  const r301 = resolveWeapon("rspn101");
  const h = new HitCheck();
  check("a round's worth more than the gun can do is refused", h.judge({ from: 1, amount: maxRound(r301) + 1, weapon: "rspn101", dist: 10 }, 10, 9.9, 10) !== null);
  check("a gun's hit with no shot heard lately is refused", h.judge({ from: 2, amount: 10, weapon: "rspn101", dist: 10 }, 10, 10 - C.shotWindow - 0.1, 10) !== null && h.judge({ from: 3, amount: 10, weapon: "rspn101", dist: 10 }, 10, undefined, 10) !== null);
  check("a claim from 100 m by two players 10 m apart is refused; a round trip's drift is not", h.judge({ from: 4, amount: 10, weapon: "rspn101", dist: 100 }, 10, 9.9, 10) !== null && h.judge({ from: 5, amount: 10, weapon: "rspn101", dist: 18 }, 10, 9.9, 10) === null);
  check(`a swing from 20 m is refused, one from 2 m passes (up to ${C.meleeMax})`, h.judge({ from: 6, amount: 30, weapon: "melee", dist: null }, 10, undefined, 20) !== null && h.judge({ from: 7, amount: 300, weapon: "melee", dist: null }, 10, undefined, 2) === null);
  // a stream faster than the gun fires: one second's worth, then one more
  const fast = new HitCheck();
  const per = maxPerSecond(r301);
  const round = maxRound(r301) / C.margin;
  let passed = 0;
  for (let i = 0; i < Math.ceil(per / round) + 5; i++) if (fast.judge({ from: 8, amount: round, weapon: "rspn101", dist: 10 }, 10 + i * 0.001, 10, 10) === null) passed++;
  check("claims faster than the gun fires are refused once a second's worth is in", passed * round <= per && passed * round > per - round - 1e-6, `${passed} passed of ${Math.round(per)} a second`);
  check("the refused are kept for the tests, with why", fast.refused.length > 0 && /faster/.test(fast.refused[0].why));
}

console.log(fails === 0 ? "\nHITCHECK PASS" : `\nHITCHECK FAIL (${fails})`);
export const hitcheckFails = fails;
if (process.argv[1]?.endsWith("hitcheck.ts")) process.exit(fails === 0 ? 0 : 1);
