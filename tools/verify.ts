// P1 verification: assert the simulation reproduces the reference numbers.
// Run: npm run verify
import { resolveWeapon, weaponMods, weaponIds, DATA } from "../src/game/weapons";
import { blastOffsets, blastWidth } from "../src/game/blast";
import { opticsFor } from "../src/game/attachments";
import squadJson from "../src/config/squad.json";
import { cmPer360, degPerCount, hipFov43, verticalFovFrom43, adsSensScale } from "../src/game/sens";
import { ViewKick, tuning } from "../src/game/recoil";
import { Loadout } from "../src/game/loadout";
import { AMMO } from "../src/game/ammo";
import { WeaponState } from "../src/game/weapon-state";
import { AimAssist, falloff } from "../src/game/aimassist";
import aaCfg from "../src/config/aimassist.json";
import { Ring, RING_PHASES, RING_TICK } from "../src/game/ring";
import { RANGE_SOLIDS } from "../src/game/range";
import { Dummy, TURN_STEP_AT } from "../src/game/dummy";
import * as THREE from "three";
import { BOT_TIERS, WIRE_TIERS, DIFFICULTY, aimError, tierFor } from "../src/game/bots";
import { MODELLED_IDS } from "../src/game/gunmodels";
import { movesimFails } from "./movesim";
// The check modules under tools/checks/. Each prints its own section and
// exports how many of its checks failed, the way movesim does. They live in
// their own files because this one is already seventeen hundred lines, and
// because several subjects can be added at once without meeting in the same
// diff. audio-occlusion is imported LAST on purpose: it swaps the shared
// solid list for a wall of its own and puts the real one back, so nothing
// that reads RANGE_SOLIDS should be running while it does.
import { skyHoursFails } from "./checks/sky-hours";
import { pickupReachFails } from "./checks/pickup-reach";
import { botSenseFails } from "./checks/bot-sense";
import { viewmodelArmsFails } from "./checks/viewmodel-arms";
import { arenasFails } from "./checks/arenas";
import { reticleFails } from "./checks/reticle";
import { progressFails } from "./checks/progress";
import { accessFails } from "./checks/access";
import { brRulesFails } from "./checks/br-rules";
import { netDeltaFails } from "./checks/net-delta";
import { audioOcclusionFails } from "./checks/audio-occlusion";
import { dropshipFails } from "./checks/dropship";
import { emotesFails } from "./checks/emotes";
import { boardsFails } from "./checks/boards";
import { lobbyFails } from "./checks/lobby";
import { seenFails } from "./checks/seen";
import { holdFails } from "./checks/hold";
import { dressFails } from "./checks/dress";
import { gearFails } from "./checks/gear";
import { hullFails } from "./checks/hull";
import { calloutFails } from "./checks/callouts";
import { botFireFails } from "./checks/bot-fire";
import { feelFails } from "./checks/feel";
import { gulagFails } from "./checks/gulag";
import { decayClockFails } from "./checks/decay-clock";
import { squadViewFails } from "./checks/squadview";
import { clipsFails } from "./checks/clips";
import { hitcheckFails } from "./checks/hitcheck";
import { rulesFails } from "./checks/rules";
import { finishesFails } from "./checks/finishes";
import { modeRestoreFails } from "./checks/mode-restore";
import { wallsFails } from "./checks/walls";
import { figLodFails } from "./checks/figlod";
import { renderBudgetFails } from "./checks/render-budget";
import { introFails } from "./checks/intro";
import { announcerFails } from "./checks/announcer";
import { packSoundsFails } from "./checks/packsounds";
import { brCardFails } from "./checks/brcard";
import { gamesFails } from "./checks/games";
import { hacksFails } from "./checks/hacks";
import { solidGridFails } from "./checks/solidgrid";
import { pingWheelFails } from "./checks/pingwheel";
import { HU, MOVE, jumpVelocityFor, SLIDE_RAMP_ANGLE } from "../src/game/movement";
import { PROFILE } from "../src/game/game";
import { DamageLog } from "../src/game/recap";
import audioCfg from "../src/config/audio.json";
import { LootField } from "../src/game/loot";
import { moveDirOf } from "../src/game/duel";
import { actCode, actFromCode } from "../src/game/dummy";
import { medalFor, roomPars } from "../src/game/course";
import { BASIC_COURSE } from "../src/game/courses/basic";
import { ADVANCED_COURSE } from "../src/game/courses/advanced";
import { CHAIN_COURSE } from "../src/game/courses/chain";
import { opticZoom } from "../src/game/sens";
import { PAD_DEFAULTS, advancedLookRate, padCurve, padDeadzone } from "../src/game/gamepad";
import { withoutClashes } from "../src/ui/binds";
import { withoutUndefined } from "../src/net/link";
import { FramePhases } from "../src/game/framephase";
import { Control, MODES as MODES_CFG, Scoreboard, TeamScore, isModeKind, killLeader, pickSpawn, teamMode, yawToMiddle } from "../src/game/modes";

let fails = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = typeof got === "number" && typeof want === "number" ? Math.abs(got - want) < 1e-6 : got === want;
  if (!ok) {
    console.error(`FAIL ${label}: got ${got}, want ${want}`);
    fails++;
  } else console.log(`  ok  ${label} = ${got}`);
};
const near = (label: string, got: number, want: number, tol: number) => {
  if (Math.abs(got - want) > tol) {
    console.error(`FAIL ${label}: got ${got.toFixed(4)}, want ${want} +/- ${tol}`);
    fails++;
  } else console.log(`  ok  ${label} = ${got.toFixed(3)} (want ${want} +/- ${tol})`);
};

// All expectations below are the CANONICAL unmodified dump. We previously
// extracted from a community mod's fork, which differed on 139 of 455 values.
// (the R-301 was these checks' gun until Milestone 522, when it went with the legacy game: PANDA's data, the VK-47's,
// takes its place, through SpeedKills' tuning)
console.log("\nPANDA's stats");
const w = resolveWeapon("vinson");
eq("damage body (20 in the data, x0.7)", w.damage.near, 14);
eq("headshot scale", w.damage.headshot, 1.3);
eq("leg scale", w.damage.leg, 0.75);
eq("fire rate (rps; 10 in the data, x0.85)", w.fireRate, 8.5);
eq("rpm", w.fireRate * 60, 510);
eq("clip", w.clipSize, 19);
eq("reload", w.reloadTime, 2.4);
eq("reload empty", w.reloadEmptyTime, 3.1);
eq("ADS in", w.adsIn, 0.27);
eq("ADS out", w.adsOut, 0.23);
eq("ADS fov (4:3)", w.zoomFov43, 55);
eq("ADS move scale", w.adsMoveScale, 0.5);
eq("auto (not semi)", w.semiAuto, false);
near("projectile speed m/s", w.projectile.speed, 609.6, 0.5);
near("projectile gravity m/s2", w.projectile.gravity, 24.77, 0.05);
eq("hip spread stand", w.spread.standHip, 2.5);
eq("hip spread crouch", w.spread.crouchHip, 2.0);
eq("ADS spread stand", w.spread.standAds, 0);

console.log("\nRecoil pattern");
const pat = w.viewkick.pattern!;
eq("pattern name resolved", w.viewkick.pattern !== null, true);
eq("pattern rows", pat.bullets.length, 30);
eq("loop offset", pat.loopOffset, 0);
eq("bullet_0 yaw", pat.bullets[0][0], 0.1);
eq("bullet_0 pitch", pat.bullets[0][1], -0.76);
eq("cold spring resolved", w.viewkick.spring !== null, true);
eq("hot spring resolved", w.viewkick.springHot !== null, true);
eq("cold ADS pitch k", w.viewkick.spring!["ADS_pitch_springConstant"], 95);
// The mechanism that makes recoil HOLD during a spray: while hot there is no
// restoring force at all, so the punch accumulates and only snaps back on
// cooldown. This is data, not a tuning choice.
eq("HOT ADS pitch k is zero (no restoring force while firing)", w.viewkick.springHot!["ADS_pitch_springConstant"], 0);
eq("hot ADS pitch damping", w.viewkick.springHot!["ADS_pitch_damping"], 45);
eq("heat per shot", w.viewkick.heatPerShot, 1);
eq("cooldown hold", w.viewkick.cooldownHoldTime, 0.1);
eq("cooldown fade", w.viewkick.cooldownFadeTime, 0.05);
eq("pattern cursor per shot", w.viewkick.valuePerShot, 1);
eq("cursor decay delay", w.viewkick.valueDecayDelay, 0.12);
eq("cursor decay rate", w.viewkick.valueDecayRate, 50);
eq("pitch soft scale", w.viewkick.pitchSoft, 2);
eq("pitch hard scale", w.viewkick.pitchHard, 0.45);
eq("no permanent aim change (PANDA recovers fully)", w.viewkick.permPitchBase, 0);

// The reference springs.txt documents the engine's own spring math. These are
// the engine's formulas, so they verify the INTEGRATOR, not a guess.
console.log("\nSpring integrator vs the engine's published formulas");
{
  // Integrate x'' = -k x - c x' the same way the game does, and compare with
  // the closed-form solution. Agreement proves the ODE and the integrator
  // together; the published frequency and half-life are properties of that
  // same solution.
  const check = (k: number, c: number, label: string) => {
    const disc = k - (c * c) / 4;
    const oscillates = 4 * k > c * c;
    // engine's published test and frequency
    eq(`${label} oscillation test (4k > c^2)`, oscillates, disc > 0);
    if (oscillates) {
      const wd = Math.sqrt(disc);
      const fPublished = Math.sqrt(4 * k - c * c) / (4 * Math.PI);
      near(`${label} frequency matches sqrt(4k-c^2)/(4pi)`, wd / (2 * Math.PI), fPublished, 1e-9);
    }
    // integrator vs closed form, x0 = 1, v0 = 0
    const analytic = (t: number): number => {
      const a = c / 2;
      if (disc > 0) {
        const wd = Math.sqrt(disc);
        return Math.exp(-a * t) * (Math.cos(wd * t) + (a / wd) * Math.sin(wd * t));
      }
      if (Math.abs(disc) < 1e-12) return Math.exp(-a * t) * (1 + a * t);
      const r = Math.sqrt(-disc);
      return Math.exp(-a * t) * (Math.cosh(r * t) + (a / r) * Math.sinh(r * t));
    };
    const st = { disp: 1, vel: 0 };
    const h = 1 / 4000;
    let worst = 0;
    for (let i = 1; i <= 2000; i++) {
      st.vel += (-k * st.disp - c * st.vel) * h;
      st.disp += st.vel * h;
      worst = Math.max(worst, Math.abs(st.disp - analytic(i * h)));
    }
    if (worst > 0.01) {
      console.error(`FAIL ${label}: integrator drifts ${worst.toFixed(4)} from the closed form`);
      fails++;
    } else console.log(`  ok  ${label} integrator matches closed form to ${worst.toExponential(1)}`);
  };
  check(115, 20, "R-301 cold ADS pitch");
  check(40, 20, "R-301 cold hipfire pitch");
  check(120, 30, "Wingman cold hipfire pitch");
  // published half-life, measured from successive peaks of a velocity impulse
  {
    const k = 115;
    const c = 20;
    const wd = Math.sqrt(k - (c * c) / 4);
    const period = (2 * Math.PI) / wd;
    const st = { disp: 0, vel: 10 };
    const h = 1 / 20000;
    let t = 0;
    let p1 = 0;
    let p2 = 0;
    while (t < period * 2.5) {
      st.vel += (-k * st.disp - c * st.vel) * h;
      st.disp += st.vel * h;
      t += h;
      if (t < period && st.disp > p1) p1 = st.disp;
      if (t >= period && t < period * 2 && st.disp > p2) p2 = st.disp;
    }
    const measuredHalfLife = (period * Math.LN2) / Math.log(p1 / p2);
    near("published half-life 2*ln2/c, measured peak to peak", measuredHalfLife, (2 * Math.LN2) / c, 0.004);
  }
}

console.log("\nRecoil trace: full 18-round mag at 810 RPM, ADS, random disabled");
const interval = 1 / w.fireRate;
function trace(shots: number): Array<[number, number]> {
  const kick = new ViewKick(w);
  const noRnd = () => 0.5; // r() == 0 -> no random component
  let hardPitch = 0;
  let hardYaw = 0;
  const out: Array<[number, number]> = [];
  for (let i = 0; i < shots; i++) {
    const t = i * interval;
    const k = kick.kick(t, true, false, false, noRnd);
    hardPitch += k.permPitchUp;
    hardYaw += k.permYawLeft;
    kick.update(interval, true, t + interval);
    const o = kick.offset();
    out.push([hardYaw + o.yawLeft, hardPitch + o.pitchUp]);
  }
  return out;
}
// Sweep the ONE constant that no public source contains.
console.log("\n  softImpulseScale sweep (full 18-round mag, ADS)");
console.log("  scale  peak°   final°   sag%   first8 monotonic   cm of pulldown @800dpi/0.4");
const savedDial = tuning.softImpulseScale;
for (const dial of [1, 5, 10, 20, 30, 50]) {
  tuning.softImpulseScale = dial;
  const t = trace(18);
  const pk = Math.max(...t.map(([, p]) => p));
  const fi = t[t.length - 1][1];
  const f8 = t.slice(0, 8).map(([, p]) => p);
  const mono = f8.every((p, i) => i === 0 || p >= f8[i - 1] - 1e-9);
  const cm = (fi / degPerCount(0.4) / 800) * 2.54;
  console.log(
    `  ${String(dial).padStart(5)}  ${pk.toFixed(2).padStart(6)}  ${fi.toFixed(2).padStart(7)}  ${(((pk - fi) / pk) * 100).toFixed(0).padStart(5)}   ${String(mono).padStart(16)}   ${cm.toFixed(1).padStart(5)}`
  );
}
tuning.softImpulseScale = savedDial;

const tr = trace(18);
console.log(`\n  chosen softImpulseScale ${savedDial}`);
console.log("  shot  yawLeft°  pitchUp°");
tr.forEach(([y, p], i) => console.log(`  ${String(i + 1).padStart(4)}  ${y.toFixed(3).padStart(8)}  ${p.toFixed(3).padStart(8)}`));
const finalPitch = tr[tr.length - 1][1];
const peakPitch = Math.max(...tr.map(([, p]) => p));

// The pattern table is exact; the integration is ours, so these are SHAPE
// assertions, not magnitude truth. Magnitude is settled by playtest.
// (1 degree, not the R-301's 2: PANDA's recoil is the VK-47's at 0.85, 1.86 degrees over the 18)
if (finalPitch < 1 || finalPitch > 20) {
  console.error(`FAIL recoil climb: final pitch ${finalPitch.toFixed(2)}° outside the plausible 1-20° band for a full mag`);
  fails++;
} else console.log(`  ok  final pitch climb ${finalPitch.toFixed(2)}° over 18 shots (peak ${peakPitch.toFixed(2)}°)`);

// PANDA's pattern climbs hard for ~6 rounds then flattens. The view must
// not sink materially below its peak while the trigger is still held, or
// the spray feels like it is self-correcting.
const sag = (peakPitch - finalPitch) / peakPitch;
if (sag > 0.25) {
  console.error(`FAIL recoil sag: view falls ${(sag * 100).toFixed(0)}% from peak while still firing (tune softRecoveryWhileFiring down)`);
  fails++;
} else console.log(`  ok  sag from peak while firing ${(sag * 100).toFixed(0)}% (<= 25%)`);

// the first 6 rounds should be a monotonic climb: that is the part of PANDA's pattern with its upward pitch rows
// (its 7th is a small one the recovery overtakes, and its 8th turns down; the R-301's climbed for 8)
const first6 = tr.slice(0, 6).map(([, p]) => p);
const monotonic = first6.every((p, i) => i === 0 || p >= first6[i - 1] - 1e-9);
eq("first 6 rounds climb monotonically", monotonic, true);

const maxAbsYaw = Math.max(...tr.map(([y]) => Math.abs(y)));
if (maxAbsYaw > finalPitch) {
  console.error(`FAIL recoil shape: max |yaw| ${maxAbsYaw.toFixed(2)}° exceeds pitch climb (pattern should be mostly vertical)`);
  fails++;
} else console.log(`  ok  max |yaw| ${maxAbsYaw.toFixed(2)}° stays under pitch climb`);

// recovery after the burst ends: the soft component must come back toward 0
const kickR = new ViewKick(w);
for (let i = 0; i < 10; i++) {
  kickR.kick(i * interval, true, false, false, () => 0.5);
  kickR.update(interval, true, i * interval + interval);
}
const peakSoft = kickR.offset().pitchUp;
for (let i = 0; i < 60; i++) kickR.update(1 / 60, true, 1e9); // 1 s idle
const restSoft = kickR.offset().pitchUp;
if (!(Math.abs(restSoft) < Math.abs(peakSoft) * 0.1)) {
  console.error(`FAIL recoil recovery: soft offset ${peakSoft.toFixed(3)}° -> ${restSoft.toFixed(3)}° after 1 s idle (should return near 0)`);
  fails++;
} else console.log(`  ok  soft offset recovers ${peakSoft.toFixed(3)}° -> ${restSoft.toFixed(3)}° after 1 s idle`);

// Regression guard. The bullet must leave along the aim as it stood BEFORE
// its own view kick. Firing along the post-kick aim put the first R-301 round
// 44 cm high at 20 m, a clean miss on a 30 cm half-height torso.
console.log("\nFirst-shot accuracy (each bullet uses its pre-kick aim)");
{
  const k = new ViewKick(w);
  const s1 = k.kick(0, true, false, false, () => 0.5);
  eq("shot 1 pre-kick pitch offset is zero", s1.preSoftPitchUp, 0);
  eq("shot 1 pre-kick yaw offset is zero", s1.preSoftYawLeft, 0);
  const afterShot1 = k.offset().pitchUp;
  const s2 = k.kick(interval, true, false, false, () => 0.5);
  near("shot 2 pre-kick aim equals the view after shot 1", s2.preSoftPitchUp, afterShot1, 1e-9);
  if (s2.preSoftPitchUp <= s1.preSoftPitchUp) {
    console.error("FAIL pre-kick aim did not advance between shots");
    fails++;
  } else console.log(`  ok  pre-kick aim advances 0 -> ${s2.preSoftPitchUp.toFixed(3)}° between shots 1 and 2`);
  const missCm = 2000 * Math.tan(pat.bullets[0][1] * -1 * w.viewkick.pitchSoft * (Math.PI / 180));
  console.log(`  note the bug this guards: firing post-kick would miss ${missCm.toFixed(0)} cm high at 20 m`);
}

// (shots to knock by the legacy game's armour tiers, white 50 to red 125, were checked here on the R-301: SpeedKills has
// one 50 shield, and its kill times by range are tools/checks/ttk.ts's)

console.log("\nSensitivity (owner's settings: sens 0.4, fovScale 1.55)");
const sens = 0.4;
eq("deg per count", degPerCount(sens), 0.0088);
// 360 / 0.0088 = 40909.1 counts; / 800 dpi = 51.14 in; x 2.54 = 129.89 cm
near("cm/360 at 800 dpi", cmPer360(sens, 800), 129.886, 0.01);
near("cm/360 at 1600 dpi", cmPer360(sens, 1600), 64.943, 0.01);
eq("cm/360 halves with double dpi", cmPer360(sens, 1600) * 2, cmPer360(sens, 800));
near("hip FOV (4:3 h)", hipFov43(1.55), 108.5, 0.001);
// 2*atan(tan(54.25 deg) * 0.75) = 92.35
near("hip FOV vertical", verticalFovFrom43(hipFov43(1.55)), 92.347, 0.01);
// tan(42.625 deg) / tan(54.25 deg) = 0.6626
near("ADS scale at 1.0 mult", adsSensScale(hipFov43(1.55), 55 * 1.55, 1), 0.6626, 0.001);
eq("ADS scale is slower than hip", adsSensScale(hipFov43(1.55), 55 * 1.55, 1) < 1, true);
near("ADS scale doubles at 2.0 mult", adsSensScale(hipFov43(1.55), 55 * 1.55, 2), 1.3252, 0.001);

// Guards for the bugs the code audit found. Each line is a bug that shipped.
console.log("\nAudit regression guards");
{
  // the spring recovery dial is a TIME rescale: k*r^2, c*r preserves damping
  const zeta = (k: number, c: number) => c / (2 * Math.sqrt(k));
  const k = 115;
  const c = 20;
  for (const r of [1, 0.35, 0.1]) {
    near(`damping ratio preserved at dial ${r}`, zeta(k * r * r, c * r), zeta(k, c), 1e-9);
  }

  // (the burst guns' forced gap between bursts was checked here on the Hemlok: no gun of SpeedKills' fires bursts,
  // and the legacy ones went in Milestone 521)

  // a negative or NaN loop offset must not index out of the pattern
  const bad = { loopOffset: -5, startMax: -1, bullets: [[0, -0.5, 0, 0], [0, -0.4, 0, 0]] };
  const wBad = JSON.parse(JSON.stringify(w)) as typeof w;
  wBad.viewkick.pattern = bad;
  const kBad = new ViewKick(wBad);
  let sawNaN = false;
  for (let i = 0; i < 40; i++) {
    const res = kBad.kick(i * 0.05, false, false, false, () => 0.5);
    if (!Number.isFinite(res.permPitchUp) || !Number.isFinite(res.preSoftPitchUp)) sawNaN = true;
  }
  eq("negative loop offset never NaNs the view", sawNaN, false);

  // the dummy must have no vertical gap between torso top and head bottom
  const torsoTop = 1.235 + 0.63 / 2;
  const headBottom = 72 * 0.0254 - 0.15 - 0.13;
  if (torsoTop < headBottom) {
    console.error(`FAIL hitbox gap: torso top ${torsoTop.toFixed(4)} below head bottom ${headBottom.toFixed(4)}`);
    fails++;
  } else console.log(`  ok  no neck gap: torso top ${torsoTop.toFixed(4)} >= head bottom ${headBottom.toFixed(4)}`);
}

console.log("\nWingman (slot 2: single fire, no recoil pattern)");
{
  const g = resolveWeapon("wingman");
  eq("headshot scale", g.damage.headshot, 1.5);
  eq("leg scale", g.damage.leg, 0.9);
  eq("single fire, not auto", g.semiAuto, true);
  eq("fire rate (rps)", g.fireRate, 2.8);
  eq("ADS in", g.adsIn, 0.2);
  eq("ADS fov (4:3)", g.zoomFov43, 60);
  near("projectile speed m/s", g.projectile.speed, 457.2, 0.5);

  // no pattern: the kick comes straight from base/random, and must go UP
  eq("has no recoil pattern", g.viewkick.pattern, null);
  eq("pitch base is negative (engine sign for up)", g.viewkick.pitchBase < 0, true);
  const kw = new ViewKick(g);
  kw.kick(0, true, false, false, () => 0.5);
  kw.update(1 / 120, true, 1 / 120); // let the velocity impulse become displacement
  const up = kw.offset().pitchUp;
  if (!(up > 0)) {
    console.error(`FAIL wingman kicks DOWN: offset ${up.toFixed(3)}° after one shot`);
    fails++;
  } else console.log(`  ok  wingman kicks up ${up.toFixed(2)}° one frame after a shot`);

}

console.log("\nLoadout (two slots, independent state)");
{
  const lo = new Loadout(["vinson", "wingman"]);
  eq("starts on slot 1", lo.activeIndex, 0);
  eq("slot 1 is PANDA", lo.active.weapon.id, "vinson");
  eq("not swapping at rest", lo.swapping, false);

  // empty slot 1
  lo.active.state.clip = 0;
  const swapAt = 10;
  eq("swap requested", lo.requestSwap(1, swapAt), true);
  eq("swapping now", lo.swapping, true);
  // asking again for the slot already being swapped to is a no-op, not a
  // restart (redirecting to a DIFFERENT slot is tested further down)
  eq("re-requesting the same target is a no-op", lo.requestSwap(1, swapAt), false);
  // total = outgoing holster + incoming deploy
  const expected = resolveWeapon("vinson").holsterTime + resolveWeapon("wingman").deployTime;
  lo.update(swapAt + expected - 0.01);
  eq("still swapping just before the end", lo.swapping, true);
  eq("still on slot 1 mid-swap", lo.activeIndex, 0);
  lo.update(swapAt + expected);
  eq("swap completes", lo.swapping, false);
  eq("now on slot 2", lo.activeIndex, 1);
  eq("slot 2 is the Wingman", lo.active.weapon.id, "wingman");
  eq("Wingman arrives with a full mag", lo.active.state.clip, lo.active.weapon.clipSize);
  eq("Wingman arrives hip-fired", lo.active.state.adsFrac, 0);

  // empty slot 2, swap back, slot 1 must STILL be empty
  lo.active.state.clip = 0;
  lo.requestSwap(0, 100);
  lo.update(100 + 10);
  eq("back on slot 1", lo.activeIndex, 0);
  eq("slot 1 kept its empty clip across the swap", lo.active.state.clip, 0);
  eq("slot 2 kept its empty clip too", lo.slots[1].state.clip, 0);

  // a fusion level applies to its own slot only (the magazine level's check, until Milestone 522)
  const clip0 = lo.active.weapon.clipSize;
  lo.setFusion(0, 3);
  eq("slot 1 at fusion 3 has the bigger magazine", lo.active.weapon.clipSize > clip0, true);
  eq("slot 2's fusion untouched", lo.slots[1].fusion ?? 0, 0);

  // redirecting mid-swap: changing your mind must not mean riding it out
  const lo2 = new Loadout(["vinson", "wingman"]);
  eq("start swap to slot 2", lo2.requestSwap(1, 0), true);
  eq("asking for slot 2 again is a no-op", lo2.requestSwap(1, 0.1), false);
  eq("redirect back to slot 1 accepted", lo2.requestSwap(0, 0.2), true);
  lo2.update(0.2 + 0.6);
  eq("stayed on slot 1 after the cancel", lo2.activeIndex, 0);
  eq("settled after the cancel", lo2.swapping, false);

  // the Q prompt must name where Q actually goes
  const lo3 = new Loadout(["vinson", "wingman"]);
  eq("Q from slot 1 goes to slot 2", lo3.nextIndex, 1);
  lo3.requestSwap(1, 0);
  eq("mid-swap toward 2, Q goes back to 1", lo3.nextIndex, 0);

  // a cancelled swap still raises the gun it never put away: no instant fire
  const lo5 = new Loadout(["vinson", "wingman"]);
  lo5.requestSwap(1, 0);
  lo5.requestSwap(0, 0.05);
  lo5.update(0.06);
  eq("a cancelled swap cannot fire at once", lo5.swapping, true);
  lo5.update(0.05 + lo5.active.weapon.deployTime + 0.01);
  eq("it can once the gun is back up", lo5.swapping, false);

  // A fresh pull can never beat the cooldown. A stale schedule within one
  // interval used to survive a new click: Wingman taps at 0.5, 1.16 and 1.24 s
  // fired the last two 83 ms apart (its interval is 357 ms).
  const semiGaps = (id: string, presses: number[]): number => {
    const w = resolveWeapon(id);
    const st = new WeaponState(w);
    const shots: number[] = [];
    for (let f = 0; f < 60 * 4; f++) {
      const now = f / 60;
      const down = presses.some((p) => now >= p && now < p + 2 / 60);
      if (st.update(1 / 60, now, down, false, "stand", "still", false, false, () => 0.5).length) shots.push(now);
      if (st.clip === 0) st.clip = w.clipSize;
    }
    let min = Infinity;
    for (let i = 1; i < shots.length; i++) min = Math.min(min, shots[i] - shots[i - 1]);
    return min;
  };
  const wing = resolveWeapon("wingman").shotInterval;
  eq("Wingman: no two shots closer than its interval", semiGaps("wingman", [0.5, 1.16, 1.24]) >= wing - 1e-9, true);
  const boog = resolveWeapon("sentinel").shotInterval;
  eq("BOOG: no two shots closer than its rechamber", semiGaps("sentinel", [0.2, 1.84, 2.06]) >= boog - 1e-9, true);

  // a new gun does not inherit the old one's cooldown
  const st6 = new WeaponState(resolveWeapon("sentinel"));
  st6.update(1 / 60, 0, true, false, "stand", "still", false, false, () => 0.5);
  st6.setWeapon(resolveWeapon("semipistol"));
  st6.update(1 / 60, 0.1, false, false, "stand", "still", false, false, () => 0.5);
  eq("a lent pistol fires 0.1 s after a BOOG shot", st6.update(1 / 60, 0.12, true, false, "stand", "still", false, false, () => 0.5).length, 1);
}

console.log("\nRecoil fixes from the swap audit");
{
  // a rebuilt gun (its fusion level changed) must NOT wipe accumulated recoil (that would make the range's fusion key a
  // free recoil-cancel, strictly better than not pressing it; the magazine key's check until Milestone 522)
  const lo = new Loadout(["vinson", "wingman"]);
  const st = lo.active.state;
  for (let i = 0; i < 6; i++) {
    st.kick.kick(i / 13.5, true, false, false, () => 0.5);
    st.kick.update(1 / 13.5, true, (i + 1) / 13.5);
  }
  const before = st.kick.offset().pitchUp;
  const cursorBefore = st.kick.cursor();
  lo.setFusion(0, 2);
  const after = st.kick.offset().pitchUp;
  near("a fusion change keeps the recoil offset", after, before, 1e-9);
  eq("a fusion change keeps the pattern cursor", st.kick.cursor(), cursorBefore);

  // cursor decay must be incremental and follow the data's schedule: PANDA's delay 0.12 s then 50 rows/s, so a
  // 10-row cursor clears at 0.32 s
  const k = new ViewKick(w);
  for (let i = 0; i < 10; i++) {
    k.kick(i / 13.5, true, false, false, () => 0.5);
    k.update(1 / 13.5, true, (i + 1) / 13.5);
  }
  const last = 9 / 13.5;
  eq("cursor at 10 after 10 rounds", Math.round(k.cursor()), 10);
  // tick forward at 60 fps, the way the game does (twice-per-frame decay was
  // the bug: it annihilated the cursor in half the scheduled time)
  let t = last;
  while (t < last + 0.2) {
    t += 1 / 60;
    k.update(1 / 60, true, t);
  }
  const atPoint2 = k.cursor();
  const sched = 10 - w.viewkick.valueDecayRate * (0.2 - w.viewkick.valueDecayDelay);
  if (!(Math.abs(atPoint2 - sched) < 1)) {
    console.error(`FAIL cursor decay: ${atPoint2.toFixed(2)} at 0.2 s idle, expected about ${sched.toFixed(1)}`);
    fails++;
  } else console.log(`  ok  cursor ${atPoint2.toFixed(2)} at 0.2 s idle (schedule says 10 - ${w.viewkick.valueDecayRate}*(0.2-${w.viewkick.valueDecayDelay}) = ${sched.toFixed(1)})`);
  while (t < last + 0.35) {
    t += 1 / 60;
    k.update(1 / 60, true, t);
  }
  eq("cursor fully reset by 0.35 s idle", k.cursor(), 0);

  // air scale applies while AIMED, not to hipfire (the field is *_ads)
  const kA = new ViewKick(w);
  kA.kick(0, false, true, false, () => 0.5); // in air, hipfire
  const hipAir = kA.offset().pitchUp;
  const kB = new ViewKick(w);
  kB.kick(0, false, false, false, () => 0.5); // grounded, hipfire
  const hipGround = kB.offset().pitchUp;
  near("hipfire kick is the same in the air as on the ground", hipAir, hipGround, 1e-9);
}

console.log("\nAim assist (controller only, src/game/aimassist.ts)");
{
  // a stand-in figure: what AimAssist reads is visible, knocked and the torso (hitMeshes[1])
  const fig = (x: number, y: number, z: number) => {
    const torso = new THREE.Mesh();
    torso.position.set(x, y, z);
    return { group: { visible: true }, knocked: false, hitMeshes: [new THREE.Mesh(), torso] } as unknown as Dummy;
  };
  const eye = new THREE.Vector3(0, 1.6, 0);
  const aa = new AimAssist();
  // yaw 0 faces -z; a figure 10 m ahead at eye height
  const ahead = fig(0, 1.6, -10);
  const input = { eye, yaw: 0, pitch: 0, ads: 0, activeInput: true, targets: [ahead] };
  const r0 = aa.update(input);
  eq("a figure under the reticle slows the stick", r0.target === ahead && r0.slow < 1, true);
  eq("the first frame on a figure adds no pull", r0.yawLeft, 0);
  // it strafes 0.2 m to the right (+x): its bearing turns right, the pull follows 40% of it
  (ahead.hitMeshes[1] as THREE.Mesh).position.x = 0.2;
  const r1 = aa.update(input);
  const turn = (Math.atan2(-0.2, 10) * 180) / Math.PI;
  near("the view follows 40% of the strafe", r1.yawLeft, turn * 0.4, 1e-6);
  (ahead.hitMeshes[1] as THREE.Mesh).position.x = 0.4;
  eq("with no input, no pull (it never aims for you)", aa.update({ ...input, activeInput: false }).yawLeft, 0);
  eq("ADS slows more than hipfire", aa.update({ ...input, ads: 1 }).slow < aa.update(input).slow, true);
  const aside = fig(5, 1.6, -10); // 27 degrees off the reticle
  eq("a figure well off the reticle is not assisted", aa.update({ ...input, targets: [aside] }).target, null);
  eq("nothing beyond the range", aa.update({ ...input, targets: [fig(0, 1.6, -80)] }).target, null);
  RANGE_SOLIDS.push({ minX: -2, maxX: 2, minZ: -6, maxZ: -5, top: 3, base: 0 });
  eq("a wall between switches it off", aa.update({ ...input, targets: [fig(0, 1.6, -10)] }).target, null);
  RANGE_SOLIDS.pop();
  // no snapping: a held target keeps the assist while in its zone, even with another nearer the reticle
  const aaS = new AimAssist();
  const held = fig(0.6, 1.6, -10);
  const nearer = fig(0.05, 1.6, -10);
  aaS.update({ ...input, targets: [held] });
  eq("no snapping: a held target keeps the assist over a nearer one", aaS.update({ ...input, targets: [held, nearer] }).target, held);
  eq("a fresh assist takes the nearer one", new AimAssist().update({ ...input, targets: [held, nearer] }).target, nearer);
  // falloff: full strength near, none at the edge of its range
  eq("full strength inside falloffStart", falloff(aaCfg.falloffStart), 1);
  near("half way to maxRange, half strength", falloff((aaCfg.falloffStart + aaCfg.maxRange) / 2), 0.5, 1e-9);
  eq("none at maxRange", falloff(aaCfg.maxRange), 0);
  const far = fig(0, 1.6, -(aaCfg.falloffStart + aaCfg.maxRange) / 2);
  const nearOne = fig(0, 1.6, -10);
  eq("a far target slows the stick less than a near one", new AimAssist().update({ ...input, targets: [far] }).slow > new AimAssist().update({ ...input, targets: [nearOne] }).slow, true);
  aa.enabled = false;
  eq("off in the settings is off", aa.update(input).target, null);
}

console.log("\nThe controller's stick (src/game/gamepad.ts, src/config/gamepad.json)");
{
  const s = { ...PAD_DEFAULTS };
  eq("inside the inner deadzone is nothing", padDeadzone(s, s.deadzone * 0.9), 0);
  eq("past the outer deadzone is full", padDeadzone(s, 1 - s.outerDeadzone / 2), 1);
  eq("and the same to the left", padDeadzone(s, -(1 - s.outerDeadzone / 2)), -1);
  near("half way between them is half", padDeadzone(s, s.deadzone + (1 - s.deadzone - s.outerDeadzone) / 2), 0.5, 1e-9);
  eq("a wider outer deadzone reaches full sooner", padDeadzone({ ...s, outerDeadzone: 0.2 }, 0.85), 1);
  near("the Classic curve is the configured power", padCurve(s, 0.5), Math.pow(0.5, s.exponent), 1e-12);
  eq("Linear is as the stick", padCurve({ ...s, curve: "linear" }, 0.5), 0.5);
  eq("a higher power is finer near the centre", padCurve({ ...s, exponent: 2.5 }, 0.3) < padCurve(s, 0.3), true);
  const adv = { ...s, advanced: true };
  eq("the per-optic ADS table scales the advanced look's aimed speed", advancedLookRate(adv, 1, 0, 1, 0, 0.5).yawLeft, advancedLookRate(adv, 1, 0, 1, 0, 1).yawLeft * 0.5);
  eq("and leaves the hipfire speed alone", advancedLookRate(adv, 1, 0, 0, 0, 0.5).yawLeft, advancedLookRate(adv, 1, 0, 0, 0, 1).yawLeft);
}

console.log("\nThe ring (src/game/ring.ts)");
{
  let seed = 7;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const ring = new Ring({ cx: 0, cz: 500, r: 297 }, rng);
  eq("phase 1 waits first", ring.state, "waiting");
  eq("phase 1 costs 3 a tick outside", ring.damage, 3);
  const inside = (a: { cx: number; cz: number; r: number }, b: { cx: number; cz: number; r: number }) => Math.hypot(a.cx - b.cx, a.cz - b.cz) + a.r <= b.r + 1e-6;
  eq("the next ring fits inside the first", inside(ring.next, ring.current), true);
  let ticks = 0;
  let closingSeen = false;
  let t = 0;
  // run the whole ring at 60 fps
  while (!ring.done && t < 2000) {
    if (ring.update(1 / 60)) ticks++;
    if (ring.state === "closing") closingSeen = true;
    t += 1 / 60;
  }
  const total = RING_PHASES.reduce((a, p) => a + p.wait + p.close, 0);
  eq("it closed six times", ring.done && ring.phase === RING_PHASES.length, true);
  near("in the sum of the waits and closes", t, total, 0.05);
  near("a tick every 1.5 s", ticks, Math.floor(total / RING_TICK), 1);
  eq("the last ring is a point", ring.current.r < 0.01, true);
  eq("the closing state was seen", closingSeen, true);
  eq("the last phase costs 25 a tick", ring.damage, 25);
  eq("a point 300 m out is outside", ring.outside(300, 500), true);
  // every phase's target sits inside the ring it closes from
  seed = 3;
  const r2 = new Ring({ cx: 0, cz: 500, r: 297 }, rng);
  let ok = true;
  let prev = { ...r2.current };
  while (!r2.done) {
    const phase = r2.phase;
    if (!inside(r2.next, prev)) ok = false;
    while (!r2.done && r2.phase === phase) r2.update(0.25);
    prev = { ...r2.current };
  }
  eq("every ring closes to a circle inside the last", ok, true);
}

console.log("\nOptics (every effect is a mod block in the reference data; the other attachments went in Milestone 522)");
{
  // an optic changes the ADS field of view, the biggest feel change, and carries its own ADS time
  const base = resolveWeapon("vinson");
  const bruiser = resolveWeapon("vinson", ["optic_cq_hcog_bruiser"]);
  const ranger = resolveWeapon("vinson", ["optic_ranged_hcog"]);
  eq("PANDA takes the 2x and the 3x", opticsFor(weaponMods("vinson")).some((o) => o.mod === "optic_cq_hcog_bruiser") && opticsFor(weaponMods("vinson")).some((o) => o.mod === "optic_ranged_hcog"), true);
  eq("a higher zoom is a narrower field of view", ranger.zoomFov43 < bruiser.zoomFov43 && bruiser.zoomFov43 < base.zoomFov43, true);
  eq("a 2x aims slower than irons, a 3x slower still", ranger.adsIn > bruiser.adsIn && bruiser.adsIn > base.adsIn, true);

  // Pump and bolt-action weapons are limited by rechamber time, not fire rate.
  // Using 1/fireRate made the legacy Kraber fire in 0.83 s instead of 1.6 s.
  const sent = resolveWeapon("sentinel");
  eq("Sentinel rechamber time", sent.rechamberTime, 1.62);
  near("Sentinel shot interval is the rechamber, not 1/rate", sent.shotInterval, 1.62, 1e-9);
  eq("which is slower than the fire rate implies", sent.shotInterval > 1 / sent.fireRate, true);
  // a full-auto weapon is unaffected
  near("PANDA's interval is still 1/its fire rate", w.shotInterval, 1 / w.fireRate, 1e-9);

  // a loadout's guns come out of it wearing their fixed optic (speedkills.json weapons), and swapping the weapon in a
  // slot resets its build back to the new gun's
  const lo2 = new Loadout(["r97", "wingman"]);
  eq("a loadout's gun starts on its own optic, not on irons", lo2.active.attach.optic, PROFILE.weapons.r97.optic);
  eq("and it is really fitted, not just recorded", lo2.chainOf(0).includes(PROFILE.weapons.r97.optic), true);
  lo2.setWeaponId(0, "vinson");
  eq("new weapon in the slot", lo2.active.weapon.id, "vinson");
  eq("build reset with the weapon, to the new gun's own optic", lo2.active.attach.optic, PROFILE.weapons.vinson.optic);
  eq("and its fusion back to 0", lo2.active.fusion ?? 0, 0);
}

console.log("\nMovement (constants are engine defaults, in Hammer units)");
{
  const hu = (metres: number) => metres / HU;
  eq("1 hu is one inch", HU, 0.0254);
  near("crouch speed", hu(MOVE.crouchSpeed), 80, 1e-9);
  near("jump height", hu(MOVE.jumpHeight), 56, 1e-9);
  near("jump height in metres", MOVE.jumpHeight, 1.4224, 1e-4);
  near("player radius", hu(MOVE.radius), 16, 1e-9);
  near("standing height", hu(MOVE.standHeight), 72, 1e-9);
  near("crouched height", hu(MOVE.crouchHeight), 47, 1e-9);
  near("step height", hu(MOVE.stepHeight), 22, 1e-9);

  // derived checks against documented behaviour
  const jumpVel = jumpVelocityFor(MOVE.jumpHeight);
  near("jump velocity reaches exactly jumpHeight", (jumpVel * jumpVel) / (2 * MOVE.gravity), MOVE.jumpHeight, 1e-9);
  const airTime = (2 * jumpVel) / MOVE.gravity;
  near("flat-ground airtime is about 0.74 s", airTime, 0.773, 0.04);

  // slide
  near("slide needs 200 hu/s to start", hu(MOVE.slideRequiredStartSpeed), 200, 1e-9);
  eq("slide friction is far gentler than standing", MOVE.slideDecel < MOVE.deceleration / 10, true);
  // a sprint into a slide gets boosted then capped
  const sprintSlide = Math.min(MOVE.sprintSpeed + MOVE.slideSpeedBoost, MOVE.slideSpeedBoostCap);
  eq("which is faster than sprinting", sprintSlide > MOVE.sprintSpeed, true);
  // the documented slide-decay timing: a full sprint slide drops below
  // slideMaxJumpSpeed in about 0.21 s
  let v = sprintSlide;
  let t = 0;
  const h = 1 / 1000;
  while (v > MOVE.slideMaxJumpSpeed && t < 5) {
    v -= (MOVE.slideDecel + MOVE.slideVelocityDecay * v) * h;
    t += h;
  }

  // the air is frictionless, which is what makes a slide jump carry
  eq("no air friction", (MOVE as unknown as { airFriction?: number }).airFriction ?? 0, 0);
}

// Guards for bugs the movement audit found. Each is a real failure that shipped.
console.log("\nMovement regression guards");
{
  // Jump apex vs framerate is now measured on the real controller in
  // tools/movesim.ts, at 30, 60, 144 and 240 fps.

  // The staircase must ascend AWAY from the firing line and each rise must fit
  // under the free step-up with real margin.
  const STEPS = 10;
  const RISE = 0.44;
  const DEPTH = 1.2;
  const nearZ = -17.6 + DEPTH / 2;
  const farZ = -17.6 - (STEPS - 1) * DEPTH - DEPTH / 2;
  eq("lowest step is nearest the firing line", nearZ > farZ, true);
  eq("each rise fits under the step-up", RISE < MOVE.stepHeight, true);
  near("step-up margin per step", MOVE.stepHeight - RISE, 0.119, 0.002);
  near("top step reaches the platform lip", -17.6 - (STEPS - 1) * DEPTH - DEPTH / 2, -29, 1e-9);
  eq("final rise onto the platform fits too", 4.6 - STEPS * RISE < MOVE.stepHeight, true);

  // Side walls must be taller than anything the player can jump to reach.
  const platformTop = 4.6;
  const sprintJumpApex = platformTop + MOVE.jumpHeight;
  eq("cannot jump onto the side wall", sprintJumpApex + MOVE.standHeight * 0 < 10, true);
  near("jump apex from the platform", sprintJumpApex, 6.02, 0.01);

  // A fast fall must not tunnel a 0.6 m slab, even at the frame-time clamp.
  const clampDt = 0.1;
  const fallFromPlatform = Math.sqrt(2 * MOVE.gravity * (sprintJumpApex - 0));
  console.log(
    `  ok  worst fall ${fallFromPlatform.toFixed(1)} m/s = ${(fallFromPlatform * clampDt).toFixed(2)} m per clamped frame, ` +
      `caught by the swept ground test rather than slab thickness`
  );
}

// Responsiveness. Sprint is 1.5x walk, but the thing that makes the controls
// feel immediate is that only the sprint TOP END builds slowly: with a weapon
// out you reach 200 hu/s in about 0.3 s (the wiki measured 0.35), and anything
// that is not "speed up along the current heading" uses the deceleration rate,
// which is about 9x the sprint acceleration.
console.log("\nMovement responsiveness");
{
  // lowAcceleration below lowSpeed, then acceleration up to the sprint band,
  // all at half rate with a weapon out (the wiki's factor of two)
  const armed = MOVE.armedAccelScale;
  const to200 = MOVE.lowSpeed / (MOVE.lowAcceleration * armed) + (MOVE.sprintBandStart - MOVE.lowSpeed) / (MOVE.acceleration * armed);
  near("time to 200 hu/s from a standstill, armed (wiki 0.35)", to200, 0.296, 0.005);
  near("holstered, walk speed in (wiki: 0.12 s to 200)", MOVE.lowSpeed * MOVE.holsterBoost / MOVE.lowAcceleration + (MOVE.speed * MOVE.holsterBoost - MOVE.lowSpeed * MOVE.holsterBoost) / MOVE.acceleration, 0.132, 0.005);
  near("deceleration dwarfs sprint acceleration", MOVE.deceleration / MOVE.sprintAcceleration, 8.93, 0.01);

  // A counter-strafe must use the deceleration rate. Running it through the
  // sprint acceleration band took 5.2 s to reverse instead of 0.21 s to stop.
  const reverseWrong = (2 * MOVE.sprintSpeed) / MOVE.sprintAcceleration;
  const stopRight = MOVE.sprintSpeed / MOVE.deceleration;
  eq("a counter-strafe is not run through the acceleration band", stopRight < reverseWrong / 10, true);
  console.log(`  ok  counter-strafe stops in ${stopRight.toFixed(2)} s, not ${reverseWrong.toFixed(1)} s`);

}

console.log("\nShotgun pellets (current season)");
{
  const pelletRows: Array<[string, number, number]> = [
    ["shotgun", 8, 7],
    ["mastiff", 5, 19],
  ];
  for (const [id, n, dmg] of pelletRows) {
    const g = resolveWeapon(id);
    eq(`${id} pellets`, g.pellets, n);
    eq(`${id} damage per pellet`, g.damage.near, dmg);
    eq(`${id} full hit`, g.damage.near * g.pellets, dmg * n);
  }
  // the shotguns lost their headshot multiplier entirely; a headshot now does exactly body damage
  for (const id of ["shotgun", "mastiff"]) {
    eq(`${id} has no headshot multiplier`, resolveWeapon(id).damage.headshot, 1);
  }
  eq("every non-shotgun fires one projectile", resolveWeapon("vinson").pellets, 1);
}

console.log("\nShotgun blast patterns (blast.ts)");
{
  // every shotgun has a pattern with one place per pellet; nothing else has one
  for (const id of ["shotgun", "mastiff"]) {
    const g = resolveWeapon(id);
    eq(`${id} has a place in its pattern for every pellet`, g.mech.blast?.shape.length ?? 0, g.pellets);
    const offs = blastOffsets(g, false, () => 0.5)!;
    eq(`${id} pattern gives one offset a pellet`, offs.length, g.pellets);
    // the pellets are spread out, not down one line: the Mastiff read as one pellet before this
    const distinct = new Set(offs.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)).size;
    eq(`${id} pellets go to different places`, distinct, g.pellets);
  }
  eq("a rifle has no pattern", resolveWeapon("vinson").mech.blast, null);
  eq("the Shattercaps 30-30 has no pattern (its blast is a cone)", resolveWeapon("3030").mech.blast, null);
  // the data's scales: the Mastiff and Mozambique halve when aimed (blast_pattern_ads_scale 0.5); the EVA-8 does not
  const m = resolveWeapon("mastiff");
  near("the Mastiff's line is about 6 degrees wide from the hip", blastWidth(m), 5.9, 0.4);
  near("aimed, the Mastiff's line is half as wide (the data's ads scale 0.5)", blastWidth(m, true) / blastWidth(m), 0.5 / 1.1, 0.02);
  const e = resolveWeapon("shotgun");
  near("the EVA-8 has no ads scale in the data: aimed is the same width", blastWidth(e, true) / blastWidth(e), 1, 1e-9);
  // the pattern is a shape, so the first and last Mastiff pellets are across from each other at the same height
  const line = blastOffsets(m, false, () => 0.5)!;
  near("the Mastiff's line is horizontal", Math.abs(line[0][1] - line[4][1]), 0, 1e-9);
  eq("and symmetric about the centre", line[0][0].toFixed(4), (-line[4][0]).toFixed(4));
}

console.log("\nRoster sanity");
// SpeedKills' guns and the bases it derives from (the 30-30, the P2020), the Glock 17 for the course and SpeedKills'
// launcher; the legacy game's other guns went in Milestones 521 and 522
eq("weapon count (11 from the data, the Striker 9, SpeedKills' launcher)", Object.keys(DATA.weapons).length, 13);
eq("Glock 17 magazine", resolveWeapon("g17").clipSize, 17);
eq("Glock uses P2020 damage", resolveWeapon("g17").damage.near, resolveWeapon("semipistol").damage.near);
for (const id of ["r97", "vinson", "wingman", "mastiff"]) {
  const x = resolveWeapon(id);
  if (!(x.damage.near > 0 && x.fireRate > 0 && x.clipSize > 0)) {
    console.error(`FAIL roster ${id}: zero stat`);
    fails++;
  }
}
eq("wingman is semi", resolveWeapon("wingman").semiAuto, true);

console.log("\nOptics (the weapon data's own values)");
{
  const aog = resolveWeapon("vinson", ["optic_ranged_aog_variable"]);
  near("AOG first zoom (zoom_fov)", aog.zoomFov43, 38.5907, 1e-4);
  near("AOG second zoom (zoom_toggle_fov)", aog.zoomToggleFov43 ?? NaN, 19.8583, 1e-4);
  near("AOG zoom blend time", aog.zoomToggleLerp, 0.15, 1e-9);
  eq("a fixed optic has no second zoom", resolveWeapon("vinson", ["optic_ranged_hcog"]).zoomToggleFov43, null);
  eq("the fitted optic is reported", aog.optic, "optic_ranged_aog_variable");
  eq("iron sights report no optic", resolveWeapon("vinson").optic, null);
  const threat = resolveWeapon("semipistol", ["optic_cq_threat"]).threatRange;
  near("1x Digital Threat highlight fades from, m", threat?.[0] ?? NaN, 984 * 0.0254, 1e-6);
  near("and is gone by, m", threat?.[1] ?? NaN, 2165 * 0.0254, 1e-6);
  eq("a holo does not highlight", resolveWeapon("semipistol", ["optic_cq_holosight"]).threatRange, null);
}

// ---------------------------------------------------------------- new movement
console.log("");
console.log("Apex movement constants (apexmovement.tech; engine values where noted)");
{
  const hu = (m: number) => m / HU;
  near("end boost", hu(MOVE.climbEndBoostHeight), 28, 1e-9);
  near("climb angle limit, degrees (arccos 0.7)", (Math.acos(MOVE.climbAngleDot) * 180) / Math.PI, 45.57, 0.01);
  near("climb jump height", hu(MOVE.climbJumpHeight), 28.21, 1e-9);
  near("climb jump out, neutral zone", hu(MOVE.climbJumpOut), 258, 1e-9);
  near("climb jump out, mini zone", hu(MOVE.climbJumpOutMini), 188, 1e-9);
  near("sideways climb speed", hu(MOVE.climbSideSpeed), 258, 1e-9);
  near("non-upward climb timer", MOVE.climbNonUpwardTime, 1, 1e-9);
  near("lurch window", MOVE.lurchGraceMax, 0.4, 1e-9);
  near("lurch full strength for", MOVE.lurchGraceMin, 0.2, 1e-9);
  near("superglide window", MOVE.superglideWindow, 0.15, 1e-9);
  near("sprint buffer", MOVE.sprintBuffer, 3, 1e-9);
  near("slide on landing needs this fall speed", hu(MOVE.slideRequiredFallSpeedAir), 200, 1e-9);
  near("mantle input cone, degrees", (Math.acos(MOVE.mantleInputDot) * 180) / Math.PI, 50, 0.05);
  near("holster speed boost", MOVE.holsterBoost, 1.15, 1e-9);
  // A climb from a low attach tops out at 100 + 28 hu above it; attaching
  // high, at 147 + 28 hu above the ground. Plus an 80 hu mantle reach, that is
  // the documented "about 6 m" of wall a legend can get up.

  // Slide friction, refit to the wiki's two measured timings. Integrate the
  // fitted friction analytically: below 350 it is the constant slideDecel,
  // above it the excess sheds at slideExcessDecayRate.
  const toBelow350 = (v0hu: number) => {
    const k = MOVE.slideExcessDecayRate;
    const u0 = (v0hu - 350) * HU;
    return u0 <= 0 ? 0 : Math.log(1 + (k * u0) / MOVE.slideDecel) / k;
  };
  near("full holstered-sprint slide (460 hu/s) under 350 in, s (wiki 0.21)", toBelow350(460), 0.21, 0.01);
  near("slide from just over 200 (227 + 150) under 350 in, s (wiki 0.11-0.12)", toBelow350(377), 0.115, 0.01);
  // Below 350 a slide coasts on the constant 100 hu/s2, so it stays faster
  // than a sprint for about 0.9 s after dropping to 350.
  near("the range ramp angle, degrees", (SLIDE_RAMP_ANGLE * 180) / Math.PI, 30.44, 0.01);

  // And the ramp must still be walkable: rise per step under the free step-up.
  const rampRun = 4.6 / Math.tan(SLIDE_RAMP_ANGLE);
  const risePerStep = 4.6 / 14;
  eq("ramp rise per step clears the step height", risePerStep < MOVE.stepHeight, true);
  near("ramp rise per step, metres", risePerStep, 0.329, 0.001);
  near("ramp run, metres", rampRun, 7.83, 0.02);
  eq("slope slide is capped", MOVE.slideSlopeMaxSpeed > MOVE.slideSpeedBoostCap, true);
}

console.log("");
console.log("Guns that are not a plain trigger (src/config/weapon-mechanics.json)");
{
  const FDT = 1 / 144;
  /** hold the trigger for `secs` (ADS as given); the times of every shot, and the requests */
  const run = (id: string, secs: number, opts: { attach?: string[]; mag?: number; ads?: boolean; trigger?: (t: number) => boolean } = {}) => {
    const wpn = resolveWeapon(id, opts.attach ?? []);
    const st = new WeaponState(wpn);
    const times: number[] = [];
    const reqs: Array<{ cone: number }> = [];
    let t = 100;
    st.update(FDT, t, false, false, "stand", "still", false, false, () => 0.5);
    for (let i = 0; i < Math.round(secs / FDT); i++) {
      t += FDT;
      const trig = opts.trigger ? opts.trigger(t - 100) : true;
      const out = st.update(FDT, t, trig, !!opts.ads, "stand", "still", false, false, () => 0.5);
      for (const r of out) {
        times.push(t - 100);
        reqs.push({ cone: r.cone });
      }
    }
    return { times, reqs, st, wpn };
  };
  // (the HAVOC's wind-up and the Devotion's spin-up were checked here: legacy guns, gone in Milestone 521)
  const lstar = run("lstar", 2.5);
  eq("L-STAR: 24 rounds to overheat with no mag", lstar.times.length, 24);
  eq("L-STAR: then it is overheated", lstar.st.overheated, true);
  const lsAfter = run("lstar", 4);
  const last = lstar.times[23];
  const resumed = lsAfter.times.find((x) => x > last + 0.2) ?? -1;
  near("L-STAR: firing again after the 1.19 s cooldown, s", resumed - last, 1.19, 0.12);
  const lsCool = run("lstar", 3.5, { trigger: (x) => x < 1 });
  eq("L-STAR: let go and the heat comes back", lsCool.st.clip, 24);
  // (the Charge Rifle's delayed shot, the Peacekeeper's choke, the Nemesis' charged bursts, the Bocek's draw and the
  // Hemlok's and Prowler's fire modes were checked here, legacy guns gone in Milestone 521; the 30-30's aimed charge and
  // the hop-ups' damage went with the hop-ups in 522)
}

console.log("");
console.log("Ammo (src/config/ammo.json, Season 30)");
{
  const lo = new Loadout(["vinson", "autopistol"]);
  lo.ammo.infinite = false;
  lo.ammo.kit(lo.slots.map((s) => s.weapon));
  lo.refillEnergy();
  // the kit is ammo.json's own, which the owner raised so nobody runs out: whatever it is, it is that many stacks
  eq(`PANDA: ${AMMO.kitStacks} stacks of heavy (${AMMO.stacks.heavy} a stack)`, lo.reserve(lo.slots[0]), AMMO.kitStacks * AMMO.stacks.heavy);
  eq(`and it is well over what it used to be, so nobody runs out (${AMMO.stacks.light} a stack, ${AMMO.kitStacks} stacks)`, AMMO.stacks.light >= 150 && AMMO.kitStacks >= 4, true);
  const eMag = lo.slots[1].weapon.clipSize;
  eq("RE-45: its own two magazines", lo.reserve(lo.slots[1]), 2 * eMag);
  const st = lo.slots[0].state;
  st.clip = 0;
  lo.ammo.stock.heavy = 10;
  st.startReload(0);
  st.update(1 / 60, 10, false, false, "stand", "still", false, false, () => 0.5);
  eq("a reload with 10 left loads 10", st.clip, 10);
  eq("and leaves none", lo.ammo.stock.heavy, 0);
  st.clip = 0;
  st.startReload(20);
  eq("nothing left: no reload", st.reloading, false);
  eq("and it says so", st.consumeNoAmmo(), true);
  // the RE-45's stockpile: spend a magazine, it comes back after 18 s idle
  const e = lo.slots[1].energy!;
  e.rounds = eMag;
  lo.update(100);
  lo.update(117.9);
  eq("energy: not back before 18 s", e.rounds, eMag);
  lo.update(118.1);
  eq("energy: a magazine back after 18 s idle", e.rounds, 2 * eMag);
  const inf = new Loadout(["vinson", "wingman"]);
  eq("the range: endless", inf.reserve() === Infinity, true);
}

console.log("");
console.log("Sound (src/config/audio.json)");
{
  const missing = Object.keys(DATA.weapons).filter((id) => !(id in audioCfg.guns));
  eq("every gun has a sound class", missing.join(",") || "none", "none");
  const bad = Object.values(audioCfg.guns).filter((c) => !(c in audioCfg.classes));
  eq("every class it names exists", bad.join(",") || "none", "none");
}

console.log("");
console.log("");
console.log("Battle royale loot (src/game/loot.ts, src/config/loot.json)");
{
  const places = [
    { x: 0, z: 500 },
    { x: 90, z: 430 },
  ];
  const bounds = { minX: -200, maxX: 200, minZ: 300, maxZ: 700 };
  const a = new LootField(null);
  const b = new LootField(null);
  const c = new LootField(null);
  a.generate(424242, places, bounds);
  b.generate(424242, places, bounds);
  c.generate(424243, places, bounds);
  const same = a.count === b.count && [...a.drops].every(([k, d]) => {
    const e = b.drops.get(k);
    return !!e && e.item.kind === d.item.kind && e.item.id === d.item.id && e.item.n === d.item.n && e.pos.distanceTo(d.pos) < 1e-9;
  });
  eq("the same seed lays out the same items under the same keys (a squad's browsers agree)", same, true);
  eq("another seed lays out another floor", [...a.drops].some(([k, d]) => c.drops.get(k)?.item.id !== d.item.id), true);
  eq("two places and the field: at least 40 items", a.count >= 40, true);
  // what the floor lays: guns the game knows and hack cores, nothing else. (The legacy single-item roll this tested
  // went in Milestone 526; it gathered the unknown ids and never asserted them.)
  const unknown: string[] = [];
  const guns = new Set(weaponIds());
  for (const d of a.drops.values()) {
    if (d.item.kind === "weapon" && !guns.has(d.item.id)) unknown.push(d.item.id);
    else if (d.item.kind !== "weapon" && d.item.kind !== "hack") unknown.push(d.item.kind);
  }
  eq("every item on the floor is a gun the game knows or a hack core", unknown.join(", ") || "none", "none");
  // a loadout starts empty and fills from the floor
  const lo = new Loadout(["vinson", "wingman"]);
  lo.clearSlot(0);
  lo.clearSlot(1);
  eq("cleared: both slots empty, the first free is 0", lo.emptySlot, 0);
  lo.give(0, "r97");
  eq("a gun into slot 0; the next free is 1", lo.emptySlot, 1);
}

console.log("");
console.log("The arena's modes (src/game/modes.ts, src/config/modes.json)");
{
  const l = new Scoreboard();
  l.kill(0, 1);
  eq("a kill counts for the killer and against the victim", `${l.row(0).kills}/${l.row(1).deaths}`, "1/1");
  eq("the ring or yourself scores nobody's kill", (l.kill(-1, 0), l.kill(0, 0), l.row(0).kills), 1);
  l.row(9).kills = 12;
  l.remove(9);
  eq("a player who left is off the board (no win on time)", l.sorted.some((r) => r.id === 9), false);
  eq("the board's leader: the most kills", l.sorted[0]?.id, 0);
  const tm = new TeamScore(3);
  eq("team deathmatch: two kills, no winner", (tm.kill(0), tm.kill(0)), null);
  eq("the third wins it", tm.kill(0), 0);
  eq("ahead at the time limit", tm.ahead, 0);
  eq("a respawn is the spawn farthest from the enemies", pickSpawn([[0, -29], [0, 29]], [{ x: 0, z: -20 }]).join(","), "0,29");
  near("a spawn at the -z end faces the middle (yaw 180)", yawToMiddle(0, -29), 180, 1e-9);
  near("a spawn on the -x side faces +x (yaw -90)", yawToMiddle(-16, 0), -90, 1e-9);
}

console.log("");
console.log("The figures' motion (src/game/dummy.ts, duel.ts moveDirOf)");
{
  near("yaw 0 (looking down -z), moving -z: forward, 0", moveDirOf(0, -1, 0), 0, 1e-9);
  near("moving +x: to the right, +pi/2", moveDirOf(1, 0, 0), Math.PI / 2, 1e-9);
  near("moving +z: backward, pi", Math.abs(moveDirOf(0, 1, 0)), Math.PI, 1e-9);
  near("yaw 90 (looking down -x), moving -x: forward", moveDirOf(-1, 0, 90), 0, 1e-9);
  near("yaw 90, moving -z: to the right", moveDirOf(0, -1, 90), Math.PI / 2, 1e-9);
  eq("standing still: forward", moveDirOf(0, 0, 37), 0);
  eq("the hands on the wire: a reload", actFromCode(actCode("reload")), "reload");
  eq("a swap", actFromCode(actCode("swap")), "swap");
  eq("an old page's heal (13): nothing", actFromCode(13), null);
  eq("an old page's revive (5): nothing", actFromCode(5), null);
  eq("nothing", actFromCode(actCode(null)), null);
  eq("an older build's packet (no code): nothing", actFromCode(undefined), null);
  // turning on the spot: the feet stay planted, then step round past 50 degrees
  const fig = new Dummy(0, 0, 0, { rig: true, noBase: true, respawn: false });
  fig.setPose({ speed: 0, stance: "stand", pitch: 0 });
  for (let i = 0; i < 5; i++) fig.update(i / 60, 1 / 60);
  fig.group.rotation.y = 0.5;
  fig.update(0.1, 1 / 60);
  near("standing still, a 0.5 rad turn leaves the feet where they were", fig.plantedTurn, -0.5, 1e-6);
  fig.group.rotation.y = 0.5 + TURN_STEP_AT + 0.05;
  for (let i = 0; i < 40; i++) fig.update(0.2 + i / 60, 1 / 60);
  near("past 50 degrees they step round to the body", fig.plantedTurn, 0, 0.03);
  fig.setPose({ speed: 3, stance: "stand", pitch: 0 });
  fig.group.rotation.y = 2;
  fig.update(1, 1 / 60);
  eq("walking, the feet go with the body", fig.plantedTurn, 0);
  fig.dispose();
}

console.log("");
console.log("Control (src/game/modes.ts, src/config/modes.json control; RESEARCH_PHASE_12 section 3)");
{
  const run = (c: Control, from: number, secs: number, fighters: Array<{ x: number; z: number; team: 0 | 1; alive: boolean }>) => {
    let r: ReturnType<Control["update"]> = { winner: null, events: [] };
    const ev: string[] = [];
    for (let t = 0; t < secs - 1e-9; t += 0.05) {
      r = c.update(from + t, 0.05, fighters);
      ev.push(...r.events);
    }
    return { ...r, events: ev };
  };
  const A = MODES_CFG.control.zones[0];
  const onA = (team: 0 | 1, n = 1) => Array.from({ length: n }, () => ({ x: Number(A[1]), z: Number(A[2]), team, alive: true }));
  const c = new Control(0, () => 0);
  eq("three zones, all neutral", c.zones.map((z) => `${z.id}${z.owner}`).join(" "), "A-1 B-1 C-1");
  eq("Control and team deathmatch are the team modes", teamMode("control") && teamMode("tdm") && !teamMode("ffa"), true);
  // free-for-all: a mode kind with no teams; the leader is the most kills, the fewest deaths on a tie, nobody when level
  eq("free-for-all is a mode kind and not a team mode", isModeKind("ffa") && !teamMode("ffa"), true);
  eq("ffa: first to 20 kills, 10 minutes, a 4 s respawn", [MODES_CFG.ffa.scoreLimit, MODES_CFG.ffa.timeLimit, MODES_CFG.ffa.respawn].join(","), "20,600,4");
  eq("ffa: the most kills leads", killLeader([{ id: 0, kills: 3, deaths: 5 }, { id: 100, kills: 7, deaths: 1 }, { id: 101, kills: 5, deaths: 0 }]), 100);
  eq("ffa: level on kills, the fewest deaths leads", killLeader([{ id: 0, kills: 7, deaths: 5 }, { id: 100, kills: 7, deaths: 1 }]), 100);
  eq("ffa: level on both is a draw", killLeader([{ id: 0, kills: 7, deaths: 1 }, { id: 100, kills: 7, deaths: 1 }]), null);
  eq("ffa: one fighter leads alone", killLeader([{ id: 0, kills: 0, deaths: 0 }]), 0);
  eq("ffa: nobody, nobody leads", killLeader([]), null);
  near("the capture rate by count (Apex's multipliers) over our 8 s", Control.rate(3) * MODES_CFG.control.captureTime, 2, 1e-9);
  run(c, 0, 7.9, onA(0));
  eq("one player on A: not yet at 7.9 s", c.zones[0].owner, -1);
  run(c, 7.9, 0.2, onA(0));
  eq("A is team 0's at 8 s", c.zones[0].owner, 0);
  const sc0 = c.score[0];
  run(c, 8.1, 10, []);
  near("held, it scores a point a second", c.score[0] - sc0, 10, 0.06);
  // two of team 1 take it back: clear it first (8 / 1.5 s), then capture (as long again)
  const flip = run(c, 20, 5.4, onA(1, 2));
  eq("two of the other team: cleared to neutral in 5.3 s", c.zones[0].owner, -1);
  eq("(the feed hears it go neutral)", flip.events.includes("neutral A"), true);
  run(c, 25.4, 5.4, onA(1, 2));
  eq("and theirs 5.3 s after that", c.zones[0].owner, 1);
  // both teams on it: it holds
  const v0 = c.zones[0].v;
  run(c, 31, 3, [...onA(0, 3), ...onA(1, 1)]);
  eq("contested: it holds, whatever the numbers", c.zones[0].v, v0);
  // spawns: a team comes back on its held zones in a line from its base, never the one beside the enemy's base
  const s = new Control(0, () => 0);
  s.zones[0].owner = 0;
  s.zones[1].owner = 0;
  s.zones[2].owner = 0;
  eq("team 0 holding A, B, C respawns at B (C is beside the enemy's base)", s.spawnZone(0)?.id, "B");
  s.zones[0].owner = 1;
  eq("with A lost, the line from its base is broken: the base", s.spawnZone(0), null);
  eq("team 1, holding only A, has no link to it from C: the base", s.spawnZone(1), null);
  // the lockout: all three for 30 s wins
  const l = new Control(0, () => 0);
  for (const z of l.zones) {
    z.owner = 1;
    z.v = 1;
  }
  const lk = run(l, 10, 1, []);
  eq("all three held starts the lockout", lk.events.includes("lockout 1"), true);
  const lw = run(l, 11, 30, []);
  eq("30 s later, unbroken, it wins", lw.winner, 1);
  // the bonus: at 150 s, held at its end, 150 points
  const b = new Control(0, () => 0.5);
  b.zones[1].owner = 0;
  b.zones[1].v = -1;
  run(b, 0, 150.1, []);
  eq("the bonus zone at 150 s (B, from the draw)", b.bonus?.zone, 1);
  const before = b.score[0];
  run(b, 150.1, 60.2, []);
  near("held to its end: 150 on top of the 60 it scored", b.score[0] - before, 150 + 60.2, 0.2);
  // the limit
  const w = new Control(0, () => 0);
  w.score = [499.9, 10];
  w.zones[1].owner = 0;
  eq("at 500 a team wins", w.update(1, 0.2, []).winner, 0);
}

console.log("");
console.log("The battle royale's Season 29 and 30 pieces (squad.json, weapon-mechanics.json, RESEARCH_PHASE_12 section 2)");
{
  eq("brought back at an echo: a 7 s hold, back at 20 health", [squadJson.echoRespawn.time, squadJson.echoRespawn.health].join(" "), "7 20");
  eq("the lockout grows with each death (ours), reset after 3 minutes alive", `${squadJson.echoRespawn.lockout.join(" ")} / ${squadJson.echoRespawn.resetAfter}`, "30 60 120 / 180");
}

console.log("");
console.log("Bot tiers (src/config/bots.json, docs/RESEARCH_PHASE_12.md section 4)");
{
  eq("five tiers, easiest first (SpeedKills' Beginner below the four)", BOT_TIERS.join(" "), "beginner easy normal hard elite");
  eq("reaction to a new sighting, s (ours for Beginner, then CS2's Easy, Normal, Hard, Expert)", BOT_TIERS.map((t) => DIFFICULTY[t].reaction).join(" "), "0.9 0.6 0.4 0.2 0.12");
  eq("on the wire the four older tiers keep their numbers, Beginner after them", WIRE_TIERS.join(" "), "easy normal hard elite beginner");
  eq("and every tier has a wire number", BOT_TIERS.every((t) => WIRE_TIERS.includes(t)), true);
  eq("Beginner is never drawn for a mixed lobby", tierFor("mixed", () => 0), "easy");
  near("easy's aim error on a new sighting, deg", aimError(DIFFICULTY.easy, 0), 14, 1e-9);
  near("after 1 s it has lost 30% of the extra (decay 0.7)", aimError(DIFFICULTY.easy, 1), 5 + 9 * 0.7, 1e-9);
  near("and settles at its floor", aimError(DIFFICULTY.easy, 60), 5, 1e-6);
  eq("each tier settles tighter than the one below", BOT_TIERS.every((t, i) => i === 0 || DIFFICULTY[t].errFloor < DIFFICULTY[BOT_TIERS[i - 1]].errFloor), true);
  eq("each tier's aim lags a moving target less", BOT_TIERS.every((t, i) => i === 0 || DIFFICULTY[t].aimLag < DIFFICULTY[BOT_TIERS[i - 1]].aimLag), true);
  eq("easy never dodges and takes no cover (TF2: easy bots never dodge)", [DIFFICULTY.easy.dodge, DIFFICULTY.easy.cover].join(" "), "0 false");
  eq("hard and elite always dodge", DIFFICULTY.hard.dodge === 1 && DIFFICULTY.elite.dodge === 1, true);
  eq("only elite pre-aims", BOT_TIERS.filter((t) => DIFFICULTY[t].preAim).join(" "), "elite");
  eq("a named tier is itself", tierFor("hard"), "hard");
  eq("an unknown one is normal", tierFor("nightmare" as never), "normal");
  // mixed: the config's weights, drawn from a fixed sequence
  const counts: Record<string, number> = { easy: 0, normal: 0, hard: 0, elite: 0 };
  for (let i = 0; i < 1000; i++) counts[tierFor("mixed", () => (i + 0.5) / 1000)]++;
  eq("mixed draws by weight (20 / 45 / 25 / 10 in a thousand)", [counts.easy, counts.normal, counts.hard, counts.elite].join(" "), "200 450 250 100");
}

console.log("");
console.log("Finishing touches: medals, per-optic ADS, the controller's advanced look, a first draw");
{
  eq("a room at its par: gold", medalFor(5, 5), "gold");
  eq("25% over: silver", medalFor(6.25, 5), "silver");
  eq("60% over: bronze", medalFor(8, 5), "bronze");
  eq("past that: none", medalFor(8.1, 5), null);
  eq("a skipped room: none", medalFor(NaN, 5), null);
  for (const L of [BASIC_COURSE, ADVANCED_COURSE, CHAIN_COURSE]) {
    const pars = roomPars(L);
    const firstLeg = (L.ranks[0][1] * (L.rooms[0].entryZ - L.startZ)) / (L.finishZ - L.startZ);
    near(`${L.title}: the pars add up to its S time less the walk to the first room`, pars.reduce((a, b) => a + b, 0) + firstLeg, L.ranks[0][1], 0.6);
    eq(`${L.title}: every room has a par over a second`, pars.every((p) => p > 1), true);
  }
  eq("no optic: 1x", opticZoom(null), "1x");
  eq("the 3x HCOG: 3x", opticZoom("3x HCOG Ranger"), "3x");
  eq("a 2x-4x on its first zoom: 2x", opticZoom("2x-4x Variable AOG", ["2x", "4x"], false), "2x");
  eq("and toggled: 4x", opticZoom("2x-4x Variable AOG", ["2x", "4x"], true), "4x");
  eq("the 4x-10x toggled: 10x", opticZoom("x", ["4x", "10x"], true), "10x");
  const ps = { ...PAD_DEFAULTS, advanced: true, curve: "linear" as const, yaw: 200, pitch: 150, extraYaw: 200, extraPitch: 0, rampTime: 0.5, rampDelay: 0.2, adsYaw: 100, adsPitch: 80 };
  near("advanced look: half stick is half the yaw speed (linear), deg/s", -advancedLookRate(ps, 0.5, 0, 0, 0).yawLeft, 100, 1e-9);
  near("full stick, no time at the edge: the yaw speed", -advancedLookRate(ps, 1, 0, 0, 0).yawLeft, 200, 1e-9);
  near("inside the ramp delay: still no extra", -advancedLookRate(ps, 1, 0, 0, 0.15).yawLeft, 200, 1e-9);
  near("half way up the ramp: half the extra yaw", -advancedLookRate(ps, 1, 0, 0, 0.45).yawLeft, 300, 1e-6);
  near("past it: all of it", -advancedLookRate(ps, 1, 0, 0, 2).yawLeft, 400, 1e-9);
  near("aimed: the ADS speed, and no extra", -advancedLookRate(ps, 1, 0, 1, 2).yawLeft, 100, 1e-9);
  const wire = withoutUndefined({ t: "fx", k: "jolt", a: [1, 2, 3], n: undefined, item: { id: "x", mag: undefined } });
  eq("a message goes out without its undefined fields (PeerJS would make them null)", Object.keys(wire).includes("n") || Object.keys(wire.item).includes("mag"), false);
  const clash = withoutClashes({ melee: ["KeyV", "KeyG"], magLevel: [] });
  eq("saved keys against new defaults: G given to melee is off the grenade", (clash.grenade ?? ["?"]).includes("KeyG"), false);
  eq("and stays on melee", clash.melee?.includes("KeyG"), true);
  eq("an untouched default keeps its keys", clash.reload, undefined);
  const lo = new Loadout(["vinson", "wingman"]);
  eq("a loadout's own guns: no flourish", lo.slots[0].firstDraw ?? false, false);
  lo.give(1, "r97");
  eq("a gun picked up: its first draw has the flourish", lo.slots[1].firstDraw, true);
}

console.log("");
console.log("The death recap (src/game/recap.ts)");
{
  const log = new DamageLog();
  log.clear(0);
  // you hit bot 1 twice (one head), bot 1 hits you three times with PANDA at 18 to 25 m, bot 2 once from 60 m
  log.hit({ t: 1, from: 0, to: 1, amount: 20, head: true, weapon: "r97", dist: 12 });
  log.hit({ t: 1.2, from: 0, to: 1, amount: 15, head: false, weapon: "r97", dist: 12 });
  log.hit({ t: 2, from: 1, to: 0, amount: 30, head: false, weapon: "vinson", dist: 18 });
  log.hit({ t: 2.5, from: 2, to: 0, amount: 70, head: true, weapon: "sentinel", dist: 60 });
  log.hit({ t: 3, from: 1, to: 0, amount: 45, head: true, weapon: "vinson", dist: 25 });
  log.hit({ t: 3.2, from: 1, to: 0, amount: 30, head: false, weapon: "vinson", dist: 22 });
  const names: Record<number, string> = { 1: "BOT ASH", 2: "BOT VOLT" };
  const r = log.recap(3.3, 1, (id) => names[id] ?? "?", (id) => (id === 1 ? { shield: 40, health: 100 } : null));
  eq("the killer's row first", r.rows[0].name, "BOT ASH");
  eq("you to them: damage", r.rows[0].dealt.damage, 35);
  eq("you to them: hits", r.rows[0].dealt.hits, 2);
  eq("you to them: headshots", r.rows[0].dealt.heads, 1);
  eq("them to you: damage", r.rows[0].taken.damage, 105);
  eq("them to you: hits", r.rows[0].taken.hits, 3);
  eq("them to you: headshots", r.rows[0].taken.heads, 1);
  eq("their gun", r.rows[0].guns[0].hits, 3);
  eq("closest hit, m", r.rows[0].guns[0].near, 18);
  eq("farthest hit, m", r.rows[0].guns[0].far, 25);
  eq("what they had left", (r.rows[0].left?.shield ?? 0) + (r.rows[0].left?.health ?? 0), 140);
  eq("the other attacker's row", r.rows[1].name, "BOT VOLT");
  eq("everything you took", r.totalTaken, 175);
  const ring = log.recap(4, -1, () => "?", () => null);
  eq("the ring: named", ring.killerName, "THE RING");
  eq("the ring: no row for it", ring.rows.every((x) => x.id >= 0), true);
}

console.log("");
console.log("Movement simulation (tools/movesim.ts)");
fails += movesimFails;
// SpeedKills' movement reads its numbers once, as the module loads, so it runs
// in a process of its own with the game named (tools/sk-movesim.ts)
{
  const { spawnSync } = await import("node:child_process");
  // and everything else that reads SpeedKills' numbers as it loads: the guns' time to kill
  for (const tool of ["tools/sk-movesim.ts", "tools/checks/ttk.ts", "tools/checks/rocket.ts", "tools/checks/hitcheck.ts", "tools/checks/bot-aim.ts", "tools/checks/soldier.ts", "tools/checks/paid-weapons.ts", "tools/checks/reach.ts", "tools/checks/sk-chaincourse.ts", "tools/checks/sk-killcam.ts", "tools/checks/soldier-fit.ts", "tools/checks/soldier-hold.ts", "tools/checks/sk-neon.ts", "tools/checks/trails.ts", "tools/checks/spring.ts", "tools/checks/fparms-pack.ts", "tools/checks/sk-sprint.ts"]) {
    const r = spawnSync(`npx tsx ${tool}`, { shell: true, encoding: "utf8", env: { ...process.env, GAME: "speedkills" } });
    process.stdout.write(r.stdout ?? "");
    if (r.status !== 0) fails++;
  }
}

console.log("");
console.log("Frame phases");
{
  // the game loop's phase timer (src/game/framephase.ts, Phase 20 A18): off it keeps nothing, and on, a frame over
  // the line keeps its breakdown with the phase that took the time, which is what names a hitch's cause
  const spin = (ms: number) => {
    const t = performance.now();
    while (performance.now() - t < ms) {
      // a phase's work
    }
  };
  const ph = new FramePhases();
  ph.start();
  ph.lap("a");
  spin(60);
  ph.lap("b");
  ph.end(1);
  eq("frame phases: off, a slow frame keeps nothing", ph.hitches.length, 0);
  ph.on = true;
  ph.start();
  spin(2);
  ph.lap("quick");
  spin(60);
  ph.lap("slow");
  ph.end(2);
  ph.start();
  spin(1);
  ph.lap("quick");
  ph.lap("slow");
  ph.end(3);
  const h = ph.hitches[0];
  // (the quick frame is kept too when a busy machine stalls it past the line, as it did once in a release gate,
  // 2026-10-12: it really was over the line, so keeping it is right; checked is that the slow one is kept, and no frame
  // under the line)
  eq("frame phases: on, the frame over 50 ms is kept, and no frame under the line", ph.hitches[0]?.at === 2 && ph.hitches.every((x) => x.ms > ph.line), true);
  eq("and the phase that took it is named", !!h && h.phases.slow > 55 && h.phases.quick < 20, true);
  eq("and each phase's mean is over both frames", !!h && Math.abs(ph.means().slow - h.phases.slow / 2) < 0.05, true);
}

console.log("");
console.log("Viewmodel roster");
{
  // Every weapon the game can equip must have a model family, or picking it
  // from the dropdown would fall through to the default rifle silently.
  const missing = Object.keys(DATA.weapons).filter((id) => !MODELLED_IDS.includes(id));
  eq("every weapon has a viewmodel", missing.join(",") || "none", "none");
  eq("the model roster has no stale ids", MODELLED_IDS.filter((id) => !(id in DATA.weapons)).join(",") || "none", "none");
}

// the modules under tools/checks/ printed their sections as they were
// imported, which is before this file's own body ran
fails += skyHoursFails + pickupReachFails + botSenseFails + viewmodelArmsFails + arenasFails + reticleFails + progressFails + accessFails + brRulesFails + netDeltaFails + audioOcclusionFails + dropshipFails + gulagFails + decayClockFails + squadViewFails + clipsFails + emotesFails + boardsFails + botFireFails + feelFails + hitcheckFails + rulesFails + finishesFails + modeRestoreFails + wallsFails + figLodFails + renderBudgetFails + introFails + pingWheelFails + lobbyFails + holdFails + gearFails + hullFails + dressFails + calloutFails + announcerFails + packSoundsFails + brCardFails + gamesFails + hacksFails + solidGridFails + seenFails;

console.log(fails === 0 ? "\nVERIFY PASS" : `\nVERIFY FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
