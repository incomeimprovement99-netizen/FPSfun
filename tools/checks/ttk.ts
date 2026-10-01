// SpeedKills' time to kill (docs/PHASE_18_PLAN_SPEEDKILLS.md 7.4, 7.5): every
// gun at every fusion level, against 150 (100 health, 50 shield), with 80% of
// rounds landing on the body at close range. The owner asked for longer fights
// than the legacy game's (about 0.9 s), Hyper Scape-like, and for fusion that
// is better but not decisive; this is where both are numbers rather than hopes.
//
// Runs with SpeedKills' tuning on, in its own process (GAME=speedkills), like
// tools/sk-movesim.ts.
//
// Run on its own: GAME=speedkills npx tsx tools/checks/ttk.ts
import { resolveWeapon, type ResolvedWeapon } from "../../src/game/weapons";
import { GAME, PROFILE } from "../../src/game/game";
import { Dummy } from "../../src/game/dummy";
import * as THREE from "three";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const POOL = PROFILE.health ? PROFILE.health.health + PROFILE.health.shield : 150;
const HIT = 0.8;

/** seconds to kill `POOL` at close range, `HIT` of rounds landing on the body, reloads included */
function ttk(w: ResolvedWeapon): number {
  const perShot = w.damage.near * Math.max(1, w.pellets) * HIT;
  const shots = Math.ceil(POOL / perShot);
  const interval = w.semiAuto ? Math.max(w.shotInterval, 1 / w.fireRate) : 1 / w.fireRate;
  const reloads = Math.floor((shots - 1) / w.clipSize);
  return (shots - 1) * interval + reloads * w.reloadTime;
}

console.log(`\nSpeedKills time to kill (game: ${GAME}), at ${HIT * 100}% on target against ${POOL}`);
check("this runs with SpeedKills' tuning", GAME === "speedkills");

/** each family's band at close range, seconds (the pistol hits as hard and as seldom as the marksman guns) */
const BAND: Record<string, [number, number]> = { rifle: [1.3, 1.8], smg: [1.3, 1.8], special: [1.3, 1.8], shotgun: [0.8, 1.4], marksman: [1.2, 2.4], pistol: [1.2, 2.4] };
const rows: string[] = [];
for (const [fam, f] of Object.entries(PROFILE.families)) {
  const band = BAND[fam];
  for (const id of f.guns) {
    const t0 = ttk(resolveWeapon(id, 0, [], 0));
    const t5 = ttk(resolveWeapon(id, 0, [], 5));
    rows.push(`${PROFILE.weapons[id].name.padEnd(12)} ${t0.toFixed(2)} s, fused ${t5.toFixed(2)} s`);
    if (band) check(`${PROFILE.weapons[id].name} (${fam}) kills in ${band[0]} to ${band[1]} s as found`, t0 >= band[0] - 1e-9 && t0 <= band[1] + 1e-9, `${t0.toFixed(2)} s`);
    // better, not decisive (the owner's 2% a level): never more than 10% quicker at level 5
    check(`${PROFILE.weapons[id].name} fused to 5 is at most about 10% quicker`, t5 >= t0 * 0.87 && t5 <= t0 + 1e-9, `${t0.toFixed(2)} to ${t5.toFixed(2)} s`);
  }
}
console.log(rows.map((r) => `        ${r}`).join("\n"));

// The table is what a hit deals (Phase 20 A2). Every hit on a figure went through a Math.floor, so the table above
// held for the tuned numbers and not for the game: USSO's 7.8 landed as 7 (10% off its time to kill), and REZ's
// fusion, 7.0 to 7.7, added nothing at any level. A real figure with the game's 50 shield and 100 health takes
// every gun's body rounds at every fusion level: each hit takes the round's tuned damage, and the figure goes
// down on the round that arithmetic says. Bodies only: a head or a leg scales that same number.
{
  const off: string[] = [];
  const late: string[] = [];
  let pairs = 0;
  for (const id of PROFILE.roster) {
    for (let lv = 0; lv <= PROFILE.fusion.levels; lv++) {
      const w = resolveWeapon(id, 0, [], lv);
      const fig = new Dummy(0, 0, 0, { rig: true, noBase: true, respawn: false });
      fig.shieldCap = PROFILE.health ? PROFILE.health.shield : 50;
      fig.setTier(1);
      const pool = fig.shield + fig.health;
      const at = new THREE.Vector3();
      const first = fig.hit(0, "body", w.damage.near, w.damage.headshot, w.damage.leg, at, w.damage.shieldScale, w.damage.unshieldedScale);
      if (!first || Math.abs(first.amount - w.damage.near) > 1e-9) off.push(`${PROFILE.weapons[id].name} ${lv}: ${w.damage.near} landed as ${first?.amount}`);
      let rounds = 1;
      while (!fig.knocked && rounds < 1000) {
        fig.hit(0, "body", w.damage.near, w.damage.headshot, w.damage.leg, at, w.damage.shieldScale, w.damage.unshieldedScale);
        rounds++;
      }
      // the arithmetic's count, with a millionth of slack for the float in a product such as 15 x 1.1
      const want = Math.ceil(pool / w.damage.near - 1e-6);
      if (rounds !== want) late.push(`${PROFILE.weapons[id].name} ${lv}: ${rounds} rounds for ${want}`);
      pairs++;
    }
  }
  check(`every gun at every fusion level lands its tuned damage on a figure, not a whole number under it (${pairs} tried)`, off.length === 0, off.slice(0, 6).join("; "));
  check("and the figure goes down on the round the arithmetic says, so the table above is what a player deals", late.length === 0, late.slice(0, 6).join("; "));
}

// the pairs: each one a real choice, not a trap
for (const [fam, f] of Object.entries(PROFILE.families)) {
  if (f.guns.length !== 2) continue;
  const [a, b] = f.guns.map((id) => resolveWeapon(id, 0, [], 0));
  const fast = PROFILE.weapons[a.id].role === "fast" ? a : b;
  const hard = fast === a ? b : a;
  check(`${fam}: the fast one fires faster, the hard one hits harder`, fast.fireRate > hard.fireRate && hard.damage.near * Math.max(1, hard.pellets) > fast.damage.near * Math.max(1, fast.pellets));
}

// the owner's two SMGs: USSO the fastest and hardest to hold, ANAKIN the easiest
{
  const usso = resolveWeapon("r97", 0, [], 0);
  const anakin = resolveWeapon("alternator_smg", 0, [], 0);
  const all = PROFILE.roster.map((id) => resolveWeapon(id, 0, [], 0));
  check("USSO fires faster than any other gun", all.every((w) => w.id === "r97" || w.fireRate < usso.fireRate));
  check("USSO kicks harder than ANAKIN, which kicks least of the automatics", usso.viewkick.pitchBase > anakin.viewkick.pitchBase && all.filter((w) => !w.semiAuto && w.id !== "alternator_smg").every((w) => Math.abs(w.viewkick.pitchBase) >= Math.abs(anakin.viewkick.pitchBase)));
}

// BOOG: one headshot, whatever the target has and however it is protected
{
  const boog = resolveWeapon("sentinel", 0, [], 0);
  const head = boog.damage.near * boog.damage.headshot;
  const armorCut = 0.6;
  check("BOOG: a headshot kills through full health, full shield and an ARMOR hack, as found", head * (1 - armorCut) >= POOL, `${head.toFixed(0)} a headshot`);
  check("BOOG: and a body shot does not", boog.damage.near < POOL);
  // the wire's own bound on a claimed hit is 1000 (duel.ts wellFormed)
  check("BOOG's headshot at its top fusion level is still under the wire's 1000 a hit", resolveWeapon("sentinel", 0, [], 5).damage.near * resolveWeapon("sentinel", 0, [], 5).damage.headshot <= 1000);
}

// fusion itself: the owner's numbers on a real gun
{
  const a = resolveWeapon("rspn101", 0, [], 0);
  const b = resolveWeapon("rspn101", 0, [], 5);
  check("fused to 5: +10% damage and +50% magazine on a real gun", Math.abs(b.damage.near / a.damage.near - 1.1) < 1e-9 && Math.abs(b.clipSize / a.clipSize - 1.5) < 0.06, `${a.clipSize} to ${b.clipSize} rounds`);
  // switching guns (the owner, 2026-09-26): 1.5 times as quick as the legacy data as found, twice as quick at level 5;
  // then 1.35 times those, for a swap that phases the gun out and the next in where it is held (the owner, 2026-09-30:
  // "i think our swaps are too quick for how we wanted it"): 0.9 of the legacy time as found, 0.675 at level 5
  const legacyDraw = 0.6;
  check("a gun draws in 0.9 of the legacy time as found and 0.675 at level 5, quicker each level", Math.abs(a.deployTime / legacyDraw - 0.9) < 0.01 && Math.abs(b.deployTime / legacyDraw - 0.675) < 0.01 && [0, 1, 2, 3, 4].every((l) => resolveWeapon("rspn101", 0, [], l + 1).deployTime < resolveWeapon("rspn101", 0, [], l).deployTime), `${a.deployTime.toFixed(2)} s to ${b.deployTime.toFixed(2)} s`);
}

console.log(fails === 0 ? "\nTTK PASS" : `\nTTK FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
