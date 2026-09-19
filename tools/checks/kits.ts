// Ability kits (src/config/kits.json, src/game/abilities.ts): the ultimate's
// meter, MEDIC's PATCH and what the card says.
//
// The meter fills with time alone in fullAfter seconds and faster with damage
// dealt, stops at full, is spent whole by the ultimate and emptied by a new
// match; nothing fills it before a kit is picked. PATCH goes once a cooldown.
//
// Run on its own: npx tsx tools/checks/kits.ts.
import { Abilities, JOLT, KITS, kitOf } from "../../src/game/abilities";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("Ability kits");
{
  const a = new Abilities();
  a.reset(true);
  a.chargeUlt(60);
  check("nothing fills the meter before a kit is picked", a.ult === 0);
  a.pick("jolt");
  let t = 0;
  while (a.ult < 1 && t < 1000) {
    a.chargeUlt(0.5);
    t += 0.5;
  }
  check(`by time alone the meter is full in ${KITS.ultimate.fullAfter} s`, Math.abs(t - KITS.ultimate.fullAfter) <= 0.5, `${t} s`);
  a.chargeUlt(100, 5000);
  check("and it stops at full", a.ult === 1);
  check("the ultimate spends it whole, and will not go again at once", a.tryUlt() && a.ult === 0 && !a.tryUlt());
  const damageFull = 1 / KITS.ultimate.perDamage;
  a.chargeUlt(0, damageFull / 2);
  check(`damage fills it faster: ${damageFull / 2} dealt is half a meter`, Math.abs(a.ult - 0.5) < 1e-9, a.ult.toFixed(3));
  a.reset(true);
  check("a new match empties it", a.ult === 0);
  a.reset(false);
  a.pick("jolt");
  a.chargeUlt(1000);
  check("with abilities off in the match, nothing is picked and nothing fills", a.picked === null && a.ult === 0);
}
{
  const a = new Abilities();
  a.reset(true);
  a.pick("jolt");
  check("PATCH is MEDIC's: RUNNER cannot use it", !a.tryPatch(0));
  a.pick("triage");
  const cd = KITS.medic.tactical.cooldown;
  check(`MEDIC's PATCH goes, then is back ${cd} s later and not before`, a.tryPatch(10) && !a.tryPatch(10 + cd - 0.1) && Math.abs(a.patchLeft(10) - cd) < 1e-9 && a.tryPatch(10 + cd));
}
{
  const r = kitOf("jolt");
  const m = kitOf("triage");
  check("the card names each kit with its tactical, passive and ultimate", r.kit === KITS.runner.name && r.tactical === "JOLT" && r.ult === KITS.runner.ult.name && m.kit === KITS.medic.name && m.tactical === KITS.medic.tactical.name && m.passive === "TRIAGE" && m.ult === KITS.medic.ult.name, `${r.blurb} | ${m.blurb}`);
  check("and its blurb carries the numbers it plays by", r.blurb.includes(`${KITS.runner.ult.seconds} s`) && r.blurb.includes(`${JOLT.distance} m`) && m.blurb.includes(`${KITS.medic.tactical.health} health`) && m.blurb.includes(`${KITS.medic.ult.radius} m`));
}

console.log(fails === 0 ? "\nKITS PASS" : `\nKITS FAIL (${fails})`);
export const kitsFails = fails;
if (process.argv[1]?.endsWith("kits.ts")) process.exit(fails === 0 ? 0 : 1);
