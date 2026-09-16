// P1 verification: assert the simulation reproduces the reference numbers.
// Run: npm run verify
import { resolveWeapon, weaponMods, weaponIds, DATA } from "../src/game/weapons";
import { blastOffsets, blastWidth } from "../src/game/blast";
import { optionsFor, SLOTS, LOCKED_HOPUPS, lockedHopupFor, modNames } from "../src/game/attachments";
import squadJson from "../src/config/squad.json";
import { cmPer360, degPerCount, hipFov43, verticalFovFrom43, adsSensScale } from "../src/game/sens";
import { ViewKick, tuning } from "../src/game/recoil";
import { Loadout } from "../src/game/loadout";
import { WeaponState } from "../src/game/weapon-state";
import { AimAssist } from "../src/game/aimassist";
import { Ring, RING_PHASES, RING_TICK } from "../src/game/ring";
import { RANGE_SOLIDS } from "../src/game/range";
import { Dummy, TURN_STEP_AT } from "../src/game/dummy";
import * as THREE from "three";
import { BOT_TIERS, DIFFICULTY, aimError, lobVelocity, tierFor } from "../src/game/bots";
import throwablesCfg from "../src/config/throwables.json";
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
import { ringPlaceFails } from "./checks/ring-place";
import { lootTiersFails } from "./checks/loot-tiers";
import { pickupReachFails } from "./checks/pickup-reach";
import { botSenseFails } from "./checks/bot-sense";
import { viewmodelArmsFails } from "./checks/viewmodel-arms";
import { audioOcclusionFails } from "./checks/audio-occlusion";
import { HU, MOVE, jumpVelocityFor, slideBreakEvenAngle, SLIDE_RAMP_ANGLE } from "../src/game/movement";
import { Abilities, JOLT, abilityCode, abilityFromCode } from "../src/game/abilities";
import itemsCfg from "../src/config/items.json";
import { DamageLog } from "../src/game/recap";
import { Armor, HEALS, Kit } from "../src/game/kit";
import audioCfg from "../src/config/audio.json";
import lootCfg from "../src/config/loot.json";
import { LootField, rollItem, seeded } from "../src/game/loot";
import { Duel, moveDirOf } from "../src/game/duel";
import { actCode, actFromCode } from "../src/game/dummy";
import { Ordnance, Throwables, arcSlowFor, blastDamage } from "../src/game/throwables";
import { medalFor, roomPars } from "../src/game/course";
import { BASIC_COURSE } from "../src/game/courses/basic";
import { ADVANCED_COURSE } from "../src/game/courses/advanced";
import { opticZoom } from "../src/game/sens";
import { PAD_DEFAULTS, advancedLookRate } from "../src/game/gamepad";
import { withoutClashes } from "../src/ui/binds";
import { withoutUndefined } from "../src/net/link";
import modesCfg from "../src/config/modes.json";
import { Control, Crown, GunLadder, MODES as MODES_CFG, TeamScore, gunList, isModeKind, killLeader, pickSpawn, teamMode, yawToMiddle } from "../src/game/modes";
/** every gun the game has but the course's own pistol */
const DATA_IDS_NO_COURSE = weaponIds().filter((id) => id !== "g17");

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
console.log("\nR-301 stats");
const w = resolveWeapon("rspn101", 0);
eq("damage body", w.damage.near, 15);
eq("headshot scale", w.damage.headshot, 1.3);
eq("leg scale", w.damage.leg, 0.75);
eq("fire rate (rps)", w.fireRate, 13.5);
eq("rpm", w.fireRate * 60, 810);
eq("clip (no mag)", w.clipSize, 21);
eq("reload", w.reloadTime, 2.4);
eq("reload empty", w.reloadEmptyTime, 3.2);
eq("ADS in", w.adsIn, 0.27);
eq("ADS out", w.adsOut, 0.23);
eq("ADS fov (4:3)", w.zoomFov43, 55);
eq("ADS move scale", w.adsMoveScale, 0.5);
eq("auto (not semi)", w.semiAuto, false);
eq("burst count", w.burstCount, 0);
near("projectile speed m/s", w.projectile.speed, 736.6, 0.5);
near("projectile gravity m/s2", w.projectile.gravity, 24.77, 0.05);
eq("hip spread stand", w.spread.standHip, 2.5);
eq("hip spread crouch", w.spread.crouchHip, 2.0);
eq("ADS spread stand", w.spread.standAds, 0);

console.log("\nR-301 mag levels (clip / reload / reload empty)");
const wantClips = [21, 23, 28, 31, 31];
for (let i = 0; i < 5; i++) {
  const m = resolveWeapon("rspn101", i);
  eq(`mag ${i} clip`, m.clipSize, wantClips[i]);
}
near("mag2 reload (x0.95)", resolveWeapon("rspn101", 2).reloadTime, 2.28, 1e-6);
near("mag3 reload (x0.9)", resolveWeapon("rspn101", 3).reloadTime, 2.16, 1e-6);

console.log("\nRecoil pattern");
const pat = w.viewkick.pattern!;
eq("pattern name resolved", w.viewkick.pattern !== null, true);
eq("pattern rows", pat.bullets.length, 28);
eq("loop offset", pat.loopOffset, 0);
eq("bullet_0 yaw", pat.bullets[0][0], -0.3);
eq("bullet_0 pitch", pat.bullets[0][1], -0.54);
eq("cold spring resolved", w.viewkick.spring !== null, true);
eq("hot spring resolved", w.viewkick.springHot !== null, true);
eq("cold ADS pitch k", w.viewkick.spring!["ADS_pitch_springConstant"], 115);
// The mechanism that makes recoil HOLD during a spray: while hot there is no
// restoring force at all, so the punch accumulates and only snaps back on
// cooldown. This is data, not a tuning choice.
eq("HOT ADS pitch k is zero (no restoring force while firing)", w.viewkick.springHot!["ADS_pitch_springConstant"], 0);
eq("hot ADS pitch damping", w.viewkick.springHot!["ADS_pitch_damping"], 60);
eq("heat per shot", w.viewkick.heatPerShot, 1);
eq("cooldown hold", w.viewkick.cooldownHoldTime, 0.08);
eq("cooldown fade", w.viewkick.cooldownFadeTime, 0.05);
eq("pattern cursor per shot", w.viewkick.valuePerShot, 1);
eq("cursor decay delay", w.viewkick.valueDecayDelay, 0.09);
eq("cursor decay rate", w.viewkick.valueDecayRate, 50);
eq("pitch soft scale", w.viewkick.pitchSoft, 2.325);
eq("pitch hard scale", w.viewkick.pitchHard, 0.35);
eq("no permanent aim change (R-301 recovers fully)", w.viewkick.permPitchBase, 0);

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
if (finalPitch < 2 || finalPitch > 20) {
  console.error(`FAIL recoil climb: final pitch ${finalPitch.toFixed(2)}° outside the plausible 2-20° band for a full mag`);
  fails++;
} else console.log(`  ok  final pitch climb ${finalPitch.toFixed(2)}° over 18 shots (peak ${peakPitch.toFixed(2)}°)`);

// The R-301 pattern climbs hard for ~8 rounds then flattens. The view must
// not sink materially below its peak while the trigger is still held, or
// the spray feels like it is self-correcting.
const sag = (peakPitch - finalPitch) / peakPitch;
if (sag > 0.25) {
  console.error(`FAIL recoil sag: view falls ${(sag * 100).toFixed(0)}% from peak while still firing (tune softRecoveryWhileFiring down)`);
  fails++;
} else console.log(`  ok  sag from peak while firing ${(sag * 100).toFixed(0)}% (<= 25%)`);

// first 8 rounds should be monotonic climb: that is the part of the pattern
// with consistently negative (upward) pitch rows
const first8 = tr.slice(0, 8).map(([, p]) => p);
const monotonic = first8.every((p, i) => i === 0 || p >= first8[i - 1] - 1e-9);
eq("first 8 rounds climb monotonically", monotonic, true);

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

console.log("\nTTK (shots to knock, body, no falloff)");
const ttk = (shield: number, mult: number) => {
  const per = Math.floor(w.damage.near * mult + 1e-6);
  return Math.ceil((100 + shield) / per);
};
eq("no armor, body", ttk(0, 1), 7);
eq("white 50, body", ttk(50, 1), 10);
eq("blue 75, body", ttk(75, 1), 12);
eq("purple 100, body", ttk(100, 1), 14);
eq("red 125, body", ttk(125, 1), 15);
eq("headshot damage", Math.floor(w.damage.near * w.damage.headshot), 19);
eq("purple, headshots", ttk(100, w.damage.headshot), 11);
eq("leg damage", Math.floor(w.damage.near * w.damage.leg), 11);
near("time to knock purple body (s)", (ttk(100, 1) - 1) / w.fireRate, 0.963, 0.002);

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

  // burst weapons have a forced gap between bursts
  const hem = resolveWeapon("hemlok", 0);
  eq("hemlok burst delay extracted", hem.burstDelay > 0, true);
  near("hemlok burst delay", hem.burstDelay, 0.3, 1e-6);

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
  const g = resolveWeapon("wingman", 0);
  eq("damage body", g.damage.near, 50);
  eq("headshot scale", g.damage.headshot, 1.5);
  eq("leg scale", g.damage.leg, 0.9);
  eq("headshot damage", Math.floor(g.damage.near * g.damage.headshot), 75);
  eq("leg damage", Math.floor(g.damage.near * g.damage.leg), 45);
  eq("single fire, not auto", g.semiAuto, true);
  eq("not a burst weapon", g.burstCount, 0);
  eq("fire rate (rps)", g.fireRate, 2.8);
  eq("clip (no mag)", g.clipSize, 5);
  eq("ADS in", g.adsIn, 0.2);
  eq("ADS fov (4:3)", g.zoomFov43, 60);
  near("projectile speed m/s", g.projectile.speed, 457.2, 0.5);
  // mag levels: the Wingman takes HIGH-CALIBRE ammo, not light. Assuming one
  // ammo family for every weapon silently gave it a flat 6/6/6/6.
  const wantWingmanClips = [5, 6, 7, 8, 8];
  for (let i = 0; i < 5; i++) eq(`mag ${i} clip`, resolveWeapon("wingman", i).clipSize, wantWingmanClips[i]);

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

  // shots to knock
  const ttkW = (shield: number, mult: number) => Math.ceil((100 + shield) / Math.floor(g.damage.near * mult + 1e-6));
  eq("no armor, body", ttkW(0, 1), 2);
  eq("purple 100, body", ttkW(100, 1), 4);
  eq("red 125, body", ttkW(125, 1), 5);
  eq("purple, headshots", ttkW(100, g.damage.headshot), 3);
  near("time to knock purple body (s)", (ttkW(100, 1) - 1) / g.fireRate, 1.071, 0.002);
  eq("a purple dummy fits inside one 5-round mag", ttkW(100, 1) <= g.clipSize, true);
}

console.log("\nLoadout (two slots, independent state)");
{
  const lo = new Loadout(["rspn101", "wingman"]);
  eq("starts on slot 1", lo.activeIndex, 0);
  eq("slot 1 is the R-301", lo.active.weapon.id, "rspn101");
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
  const expected = resolveWeapon("rspn101", 0).holsterTime + resolveWeapon("wingman", 0).deployTime;
  near("swap time is holster + deploy", expected, 0.55 + 0.45, 1e-9);
  lo.update(swapAt + expected - 0.01);
  eq("still swapping just before the end", lo.swapping, true);
  eq("still on slot 1 mid-swap", lo.activeIndex, 0);
  lo.update(swapAt + expected);
  eq("swap completes", lo.swapping, false);
  eq("now on slot 2", lo.activeIndex, 1);
  eq("slot 2 is the Wingman", lo.active.weapon.id, "wingman");
  eq("Wingman arrives with a full mag", lo.active.state.clip, 5);
  eq("Wingman arrives hip-fired", lo.active.state.adsFrac, 0);

  // empty slot 2, swap back, slot 1 must STILL be empty
  lo.active.state.clip = 0;
  lo.requestSwap(0, 100);
  lo.update(100 + 10);
  eq("back on slot 1", lo.activeIndex, 0);
  eq("slot 1 kept its empty clip across the swap", lo.active.state.clip, 0);
  eq("slot 2 kept its empty clip too", lo.slots[1].state.clip, 0);

  // mag level applies to the active slot only
  lo.setMagLevel(3);
  eq("slot 1 mag 3 clip", lo.active.weapon.clipSize, 31);
  eq("slot 2 mag level untouched", lo.slots[1].magLevel, 0);

  // redirecting mid-swap: changing your mind must not mean riding it out
  const lo2 = new Loadout(["rspn101", "wingman"]);
  eq("start swap to slot 2", lo2.requestSwap(1, 0), true);
  eq("asking for slot 2 again is a no-op", lo2.requestSwap(1, 0.1), false);
  eq("redirect back to slot 1 accepted", lo2.requestSwap(0, 0.2), true);
  lo2.update(0.2 + 0.6);
  eq("stayed on slot 1 after the cancel", lo2.activeIndex, 0);
  eq("settled after the cancel", lo2.swapping, false);

  // the Q prompt must name where Q actually goes
  const lo3 = new Loadout(["rspn101", "wingman"]);
  eq("Q from slot 1 goes to slot 2", lo3.nextIndex, 1);
  lo3.requestSwap(1, 0);
  eq("mid-swap toward 2, Q goes back to 1", lo3.nextIndex, 0);

  // a burst in flight must not survive being holstered
  const lo4 = new Loadout(["hemlok", "wingman"]);
  const hs = lo4.active.state;
  hs.update(1 / 60, 0, true, false, "stand", "still", false, false, () => 0.5);
  eq("burst started", hs.burstRemaining > 0, true);
  lo4.requestSwap(1, 0.02);
  eq("burst cancelled by the swap", hs.burstRemaining, 0);

  // a cancelled swap still raises the gun it never put away: no instant fire
  const lo5 = new Loadout(["rspn101", "wingman"]);
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
    const w = resolveWeapon(id, 0);
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
  const wing = resolveWeapon("wingman", 0).shotInterval;
  eq("Wingman: no two shots closer than its interval", semiGaps("wingman", [0.5, 1.16, 1.24]) >= wing - 1e-9, true);
  const kraber = resolveWeapon("sniper", 0).shotInterval;
  eq("Kraber: no two shots closer than its rechamber", semiGaps("sniper", [0.2, 2.62, 2.84]) >= kraber - 1e-9, true);

  // a new gun does not inherit the old one's cooldown
  const st6 = new WeaponState(resolveWeapon("sniper", 0));
  st6.update(1 / 60, 0, true, false, "stand", "still", false, false, () => 0.5);
  st6.setWeapon(resolveWeapon("semipistol", 0));
  st6.update(1 / 60, 0.1, false, false, "stand", "still", false, false, () => 0.5);
  eq("a lent pistol fires 0.1 s after a Kraber shot", st6.update(1 / 60, 0.12, true, false, "stand", "still", false, false, () => 0.5).length, 1);
}

console.log("\nRecoil fixes from the swap audit");
{
  // changing mag level must NOT wipe accumulated recoil (that would make the
  // mag key a free recoil-cancel, strictly better than not pressing it)
  const lo = new Loadout(["rspn101", "wingman"]);
  const st = lo.active.state;
  for (let i = 0; i < 6; i++) {
    st.kick.kick(i / 13.5, true, false, false, () => 0.5);
    st.kick.update(1 / 13.5, true, (i + 1) / 13.5);
  }
  const before = st.kick.offset().pitchUp;
  const cursorBefore = st.kick.cursor();
  lo.setMagLevel(2);
  const after = st.kick.offset().pitchUp;
  near("mag change keeps the recoil offset", after, before, 1e-9);
  eq("mag change keeps the pattern cursor", st.kick.cursor(), cursorBefore);

  // cursor decay must be incremental and follow the data's schedule:
  // R-301 delay 0.09 s then 50 rows/s, so a 10-row cursor clears at 0.29 s
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
  if (!(atPoint2 > 2 && atPoint2 < 5)) {
    console.error(`FAIL cursor decay: ${atPoint2.toFixed(2)} at 0.2 s idle, expected about 4.5`);
    fails++;
  } else console.log(`  ok  cursor ${atPoint2.toFixed(2)} at 0.2 s idle (schedule says 10 - 50*(0.2-0.09) = 4.5)`);
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
  aa.enabled = false;
  eq("off in the settings is off", aa.update(input).target, null);
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

console.log("\nAttachments (every effect is a mod block in the reference data)");
{
  const base = resolveWeapon("rspn101", 0);

  // optics change the ADS field of view, which is the biggest feel change
  const holo = resolveWeapon("rspn101", 0, ["optic_cq_holosight"]);
  const bruiser = resolveWeapon("rspn101", 0, ["optic_cq_hcog_bruiser"]);
  const ranger = resolveWeapon("rspn101", 0, ["optic_ranged_hcog"]);
  eq("iron sights ADS fov", base.zoomFov43, 55);
  eq("1x holo ADS fov", holo.zoomFov43, 60);
  near("2x bruiser ADS fov", bruiser.zoomFov43, 38.5907, 1e-4);
  near("3x ranger ADS fov", ranger.zoomFov43, 26.2756, 1e-4);
  eq("higher zoom means a narrower fov", ranger.zoomFov43 < bruiser.zoomFov43, true);

  // stocks speed up handling
  const stock3 = resolveWeapon("rspn101", 0, ["stock_tactical_l3"]);
  near("purple stock ADS in (x0.75)", stock3.adsIn, 0.27 * 0.75, 1e-9);
  near("purple stock deploy (x0.75)", stock3.deployTime, 0.6 * 0.75, 1e-9);
  near("purple stock holster (x0.75)", stock3.holsterTime, 0.55 * 0.75, 1e-9);
  eq("stock makes ADS faster", stock3.adsIn < base.adsIn, true);

  // barrels cut recoil, so the whole pattern scales down
  const bar3 = resolveWeapon("rspn101", 0, ["barrel_stabilizer_l3"]);
  near("purple barrel pitch base (x0.85)", bar3.viewkick.pitchBase, 0.85, 1e-9);
  near("purple barrel pitch random (x0.7)", bar3.viewkick.pitchRandom, 0.7, 1e-9);
  eq("barrel reduces the kick", bar3.viewkick.pitchBase < base.viewkick.pitchBase, true);

  // An optic carries its own ADS time, so a 2x aims slower than irons even
  // before a stock is fitted. The stock then scales whatever the optic set.
  near("2x bruiser ADS in is slower than irons", bruiser.adsIn, 0.29, 1e-9);
  near("3x ranger ADS in is slower still", ranger.adsIn, 0.34, 1e-9);
  const bruiserStock = resolveWeapon("rspn101", 0, ["optic_cq_hcog_bruiser", "stock_tactical_l3"]);
  near("stock scales the OPTIC's ADS time, not the iron-sight one", bruiserStock.adsIn, 0.29 * 0.75, 1e-9);

  // Laser sights do not exist in this data era, so no weapon offers the slot.
  // Keeping the slot costs nothing and it lights up if a later data set has it.
  let anyLaser = false;
  for (const id of weaponIds()) if (optionsFor("laser", weaponMods(id)).length > 1) anyLaser = true;
  eq("no laser sights in this data era", anyLaser, false);

  // a full build stacks, and mag level still applies on top
  const full = resolveWeapon("rspn101", 3, [
    "optic_cq_hcog_bruiser",
    "barrel_stabilizer_l3",
    "stock_tactical_l3",
  ]);
  eq("full build keeps the mag-3 clip", full.clipSize, 31);
  near("full build ADS fov", full.zoomFov43, 38.5907, 1e-4);
  near("full build ADS in", full.adsIn, 0.29 * 0.75, 1e-9);
  near("full build kick", full.viewkick.pitchBase, 0.85, 1e-9);

  // Mags and other attachments must STACK. Mag levels used to be a
  // precomputed table derived from the bare weapon, so reading it overwrote
  // every attachment that touched the same field: a purple stock's reload
  // bonus vanished entirely, even with no magazine fitted.
  // Stocks do not scale reload in this data era, so the stacking case is an
  // optic's own ADS time scaled by a stock, with a magazine also fitted.
  const mag2 = resolveWeapon("rspn101", 2);
  near("blue mag reload (x0.95)", mag2.reloadTime, 2.4 * 0.95, 1e-9);
  const stockMag = resolveWeapon("rspn101", 2, ["stock_tactical_l3"]);
  near("mag reload survives fitting a stock", stockMag.reloadTime, 2.4 * 0.95, 1e-9);
  eq("mag still sets the clip with a stock on", stockMag.clipSize, 28);
  const three = resolveWeapon("rspn101", 2, ["optic_cq_hcog_bruiser", "stock_tactical_l3"]);
  near("optic ADS time scaled by the stock", three.adsIn, 0.29 * 0.75, 1e-9);
  eq("with the magazine still applied", three.clipSize, 28);
  near("and the optic's field of view intact", three.zoomFov43, 38.5907, 1e-4);

  // clip sizes are whole rounds even when the data multiplies
  eq("R-301 blue mag is 28 this season", mag2.clipSize, 28);
  eq("Wingman ladder reaches 8 this season", resolveWeapon("wingman", 3).clipSize, 8);

  // A shotgun's bolt IS its magazine: same key, and it scales fire rate
  // rather than clip size. Omitting the bolt family made the mag key a silent
  // no-op on all four shotguns.
  // The Mastiff is care-package only in this data era and carries no
  // attachments at all, so it is excluded from the bolt check.
  const pkBase = resolveWeapon("energy_shotgun", 0);
  const pkBolt = resolveWeapon("energy_shotgun", 3);
  near("purple bolt shortens the pump (x0.84)", pkBolt.shotInterval, pkBase.shotInterval * 0.84, 1e-9);
  eq("bolt does not change the shell count", pkBolt.clipSize, pkBase.clipSize);
  eq("the Mastiff takes optics but no bolt in this era", optionsFor("optic", weaponMods("mastiff")).length > 1 && weaponMods("mastiff")["shotgun_bolt_l1"] === undefined, true);
  for (const id of ["shotgun", "energy_shotgun", "shotgun_pistol"]) {
    const l0 = resolveWeapon(id, 0);
    const l3 = resolveWeapon(id, 3);
    const changed = l3.shotInterval !== l0.shotInterval || l3.clipSize !== l0.clipSize || l3.reloadTime !== l0.reloadTime;
    if (!changed) {
      console.error(`FAIL ${id}: mag level 3 changes nothing`);
      fails++;
    } else {
      console.log(`  ok  ${id} bolt shortens the gap (${l0.shotInterval.toFixed(3)} -> ${l3.shotInterval.toFixed(3)} s)`);
    }
  }

  // Pump and bolt-action weapons are limited by rechamber time, not fire rate.
  // Using 1/fireRate made the Kraber fire in 0.83 s instead of 1.6 s.
  const kraber = resolveWeapon("sniper", 0);
  eq("Kraber rechamber time", kraber.rechamberTime, 2.4);
  near("Kraber shot interval is the rechamber, not 1/rate", kraber.shotInterval, 2.4, 1e-9);
  eq("which is slower than the fire rate implies", kraber.shotInterval > 1 / kraber.fireRate, true);
  // its own sight is a 4x-8x scope (zoom_fov 13.3 with a toggle), drawn by default
  eq("Kraber wears its built-in 4x-8x with nothing fitted", kraber.integralOptic, "optic_sniper_variable");
  eq("the R-301 has no built-in scope", resolveWeapon("rspn101", 0).integralOptic, null);
  eq("a fitted 3x replaces the Kraber's own", resolveWeapon("sniper", 0, ["optic_ranged_hcog"]).optic, "optic_ranged_hcog");
  const sent = resolveWeapon("sentinel", 0);
  near("Sentinel shot interval", sent.shotInterval, 1.62, 1e-9);
  const pk = resolveWeapon("energy_shotgun", 0);
  near("Peacekeeper shot interval", pk.shotInterval, 1.36, 1e-9);
  near("purple bolt cuts the Peacekeeper pump (x0.84)", resolveWeapon("energy_shotgun", 3).shotInterval, 1.36 * 0.84, 1e-9);
  // a full-auto weapon is unaffected
  near("R-301 interval is still 1/fire rate", w.shotInterval, 1 / 13.5, 1e-9);

  // the magazine is NOT an attachment slot: listing the same mods in both
  // places double-counted them
  eq("no mag slot in the attachment list", (SLOTS as string[]).includes("mag"), false);
  eq("attachment slots (the hop-up is the fifth)", SLOTS.join(","), "optic,barrel,stock,laser,hopup");

  // scaling a stat the weapon does not have must leave it absent, not
  // fabricate a 0 that defeats the fallback chains
  const noKey = resolveWeapon("wingman", 0, ["stock_sniper_l3"]);
  eq("empty reload still falls back sensibly", noKey.reloadEmptyTime > 0, true);

  // availability is per weapon: the Wingman takes no barrel stabiliser
  const wingMods = weaponMods("wingman");
  const r301Mods = weaponMods("rspn101");
  eq("R-301 offers a barrel", optionsFor("barrel", r301Mods).length > 1, true);
  eq("Wingman offers no barrel", optionsFor("barrel", wingMods).length, 1);
  eq("Wingman offers optics", optionsFor("optic", wingMods).length > 1, true);
  // lasers are an SMG and pistol attachment only
  eq("R-301 offers no laser", optionsFor("laser", r301Mods).length, 1);
  

  // cycling through a slot returns to where it started
  const lo = new Loadout(["rspn101", "wingman"]);
  const opts = optionsFor("optic", r301Mods);
  const first = lo.active.weapon.zoomFov43;
  for (let i = 0; i < opts.length; i++) lo.cycleAttachment("optic");
  near("cycling optics all the way round returns to iron sights", lo.active.weapon.zoomFov43, first, 1e-9);
  // changing an attachment keeps the rounds in the gun and a reload running:
  // topping the mag up made every attachment key an instant reload, in a
  // match and on a timed course run too
  lo.active.state.clip = 3;
  lo.cycleAttachment("optic");
  eq("changing an attachment keeps the rounds in the gun", lo.active.state.clip, 3);
  lo.active.state.clip = 0;
  lo.active.state.startReload(0);
  lo.cycleAttachment("optic");
  eq("changing an attachment does not end a reload", lo.active.state.reloading, true);
  lo.setMagLevel(0);
  lo.active.state.clip = lo.active.weapon.clipSize;
  lo.setMagLevel(3);
  eq("a bigger mag does not fill itself", lo.active.state.clip < lo.active.weapon.clipSize, true);
  // a slot the weapon cannot take is a no-op, not a crash
  const before = lo.active.weapon.spread.standHip;
  lo.cycleAttachment("laser");
  near("cycling an unavailable slot changes nothing", lo.active.weapon.spread.standHip, before, 1e-9);

  // swapping the weapon in a slot resets its build
  const lo2 = new Loadout(["rspn101", "wingman"]);
  lo2.cycleAttachment("optic");
  eq("optic fitted", lo2.active.attach.optic !== null && lo2.active.attach.optic !== undefined, true);
  lo2.setWeaponId(0, "vinson");
  eq("new weapon in the slot", lo2.active.weapon.id, "vinson");
  eq("build reset with the weapon", lo2.active.attach.optic ?? null, null);
  eq("mag level reset with the weapon", lo2.active.magLevel, 0);
}

console.log("\nMovement (constants are engine defaults, in Hammer units)");
{
  const hu = (metres: number) => metres / HU;
  eq("1 hu is one inch", HU, 0.0254);
  near("walk speed", hu(MOVE.speed), 173.5, 1e-9);
  near("sprint speed", hu(MOVE.sprintSpeed), 260, 1e-9);
  near("crouch speed", hu(MOVE.crouchSpeed), 80, 1e-9);
  near("gravity", hu(MOVE.gravity), 750, 1e-9);
  near("gravity in m/s2", MOVE.gravity, 19.05, 1e-9);
  near("jump height", hu(MOVE.jumpHeight), 56, 1e-9);
  near("jump height in metres", MOVE.jumpHeight, 1.4224, 1e-4);
  near("air max wish speed", hu(MOVE.airSpeed), 60, 1e-9);
  near("air acceleration", hu(MOVE.airAcceleration), 500, 1e-9);
  near("standing deceleration", hu(MOVE.deceleration), 1250, 1e-9);
  near("player radius", hu(MOVE.radius), 16, 1e-9);
  near("standing height", hu(MOVE.standHeight), 72, 1e-9);
  near("crouched height", hu(MOVE.crouchHeight), 47, 1e-9);
  near("step height", hu(MOVE.stepHeight), 22, 1e-9);
  near("mantle height", hu(MOVE.mantleHeight), 80, 1e-9);

  // derived checks against documented behaviour
  const jumpVel = jumpVelocityFor(MOVE.jumpHeight);
  near("jump velocity reaches exactly jumpHeight", (jumpVel * jumpVel) / (2 * MOVE.gravity), MOVE.jumpHeight, 1e-9);
  near("jump velocity in hu/s", hu(jumpVel), 289.8, 0.2);
  const airTime = (2 * jumpVel) / MOVE.gravity;
  near("flat-ground airtime is about 0.74 s", airTime, 0.773, 0.04);
  near("stopping time from full sprint", MOVE.sprintSpeed / MOVE.deceleration, 0.208, 0.002);

  // slide
  near("slide needs 200 hu/s to start", hu(MOVE.slideRequiredStartSpeed), 200, 1e-9);
  near("slide boost", hu(MOVE.slideSpeedBoost), 150, 1e-9);
  near("slide boost cap", hu(MOVE.slideSpeedBoostCap), 400, 1e-9);
  eq("slide friction is far gentler than standing", MOVE.slideDecel < MOVE.deceleration / 10, true);
  near("slide friction ratio", MOVE.deceleration / MOVE.slideDecel, 12.5, 1e-9);
  // a sprint into a slide gets boosted then capped
  const sprintSlide = Math.min(MOVE.sprintSpeed + MOVE.slideSpeedBoost, MOVE.slideSpeedBoostCap);
  near("sprint slide caps at 400 hu/s", hu(sprintSlide), 400, 1e-9);
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
  near("sprint slide falls below 350 hu/s in about 0.21 s", t, 0.21, 0.1);

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
  near("sprint is 1.5x walk", MOVE.sprintSpeed / MOVE.speed, 1.4985, 0.001);
  // lowAcceleration below lowSpeed, then acceleration up to the sprint band,
  // all at half rate with a weapon out (the wiki's factor of two)
  const armed = MOVE.armedAccelScale;
  const to200 = MOVE.lowSpeed / (MOVE.lowAcceleration * armed) + (MOVE.sprintBandStart - MOVE.lowSpeed) / (MOVE.acceleration * armed);
  near("time to 200 hu/s from a standstill, armed (wiki 0.35)", to200, 0.296, 0.005);
  near("holstered, walk speed in (wiki: 0.12 s to 200)", MOVE.lowSpeed * MOVE.holsterBoost / MOVE.lowAcceleration + (MOVE.speed * MOVE.holsterBoost - MOVE.lowSpeed * MOVE.holsterBoost) / MOVE.acceleration, 0.132, 0.005);
  near("the sprint tail from 200 to 260, armed", (MOVE.sprintSpeed - MOVE.sprintBandStart) / (MOVE.sprintAcceleration * armed), 0.857, 0.005);
  near("stop from full sprint", MOVE.sprintSpeed / MOVE.deceleration, 0.208, 0.002);
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
    ["shotgun_pistol", 3, 17],
    ["shotgun", 8, 7],
    ["mastiff", 5, 19],
    ["energy_shotgun", 9, 11],
    ["doubletake", 3, 23],
  ];
  for (const [id, n, dmg] of pelletRows) {
    const g = resolveWeapon(id, 0);
    eq(`${id} pellets`, g.pellets, n);
    eq(`${id} damage per pellet`, g.damage.near, dmg);
    eq(`${id} full hit`, g.damage.near * g.pellets, dmg * n);
  }
  // Three of the four shotguns lost their headshot multiplier entirely; a
  // headshot now does exactly body damage. Only the Mozambique kept one.
  for (const id of ["shotgun", "mastiff", "energy_shotgun"]) {
    eq(`${id} has no headshot multiplier`, resolveWeapon(id, 0).damage.headshot, 1);
  }
  eq("the Mozambique kept one", resolveWeapon("shotgun_pistol", 0).damage.headshot, 1.25);
  eq("every non-shotgun fires one projectile", resolveWeapon("rspn101", 0).pellets, 1);
}

console.log("\nShotgun blast patterns (blast.ts)");
{
  // every shotgun has a pattern with one place per pellet; nothing else has one
  for (const id of ["shotgun_pistol", "shotgun", "mastiff", "energy_shotgun", "doubletake"]) {
    const g = resolveWeapon(id, 0);
    eq(`${id} has a place in its pattern for every pellet`, g.mech.blast?.shape.length ?? 0, g.pellets);
    const offs = blastOffsets(g, false, 1, () => 0.5)!;
    eq(`${id} pattern gives one offset a pellet`, offs.length, g.pellets);
    // the pellets are spread out, not down one line: the Mastiff read as one pellet before this
    const distinct = new Set(offs.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)).size;
    eq(`${id} pellets go to different places`, distinct, g.pellets);
  }
  eq("a rifle has no pattern", resolveWeapon("rspn101", 0).mech.blast, null);
  eq("the Shattercaps 30-30 has no pattern (its blast is a cone)", resolveWeapon("3030", 0).mech.blast, null);
  // the data's scales: the Mastiff and Mozambique halve when aimed (blast_pattern_ads_scale 0.5); the EVA-8 does not
  const m = resolveWeapon("mastiff", 0);
  near("the Mastiff's line is about 6 degrees wide from the hip", blastWidth(m), 5.9, 0.4);
  near("aimed, the Mastiff's line is half as wide (the data's ads scale 0.5)", blastWidth(m, true) / blastWidth(m), 0.5 / 1.1, 0.02);
  const e = resolveWeapon("shotgun", 0);
  near("the EVA-8 has no ads scale in the data: aimed is the same width", blastWidth(e, true) / blastWidth(e), 1, 1e-9);
  // a choke closes the Peacekeeper's star to its minScale
  const pk = resolveWeapon("energy_shotgun", 0);
  near("the Peacekeeper's star, choked to 0.45, is 0.45 as wide", blastWidth(pk, false, 0.45) / blastWidth(pk), 0.45, 0.01);
  // the pattern is a shape, so the first and last Mastiff pellets are across from each other at the same height
  const line = blastOffsets(m, false, 1, () => 0.5)!;
  near("the Mastiff's line is horizontal", Math.abs(line[0][1] - line[4][1]), 0, 1e-9);
  eq("and symmetric about the centre", line[0][0].toFixed(4), (-line[4][0]).toFixed(4));
}

console.log("\nRoster sanity");
// 27 from the game's data, the Glock 17 for the course, and the two newer than the data
eq("weapon count (27 from the data, the Striker 9, the Nemesis, the Bocek)", Object.keys(DATA.weapons).length, 30);
eq("Glock 17 magazine", resolveWeapon("g17", 0).clipSize, 17);
eq("Glock uses P2020 damage", resolveWeapon("g17", 0).damage.near, resolveWeapon("semipistol", 0).damage.near);
for (const id of ["r97", "volt_smg", "vinson", "wingman", "mastiff", "hemlok", "g2"]) {
  const x = resolveWeapon(id, 0);
  if (!(x.damage.near > 0 && x.fireRate > 0 && x.clipSize > 0)) {
    console.error(`FAIL roster ${id}: zero stat`);
    fails++;
  }
}
eq("wingman is semi", resolveWeapon("wingman", 0).semiAuto, true);
eq("hemlok burst count", resolveWeapon("hemlok", 0).burstCount, 3);
eq("mastiff fire rate", resolveWeapon("mastiff", 0).fireRate, 1.1);

console.log("\nOptics (the weapon data's own values)");
{
  const aog = resolveWeapon("rspn101", 0, ["optic_ranged_aog_variable"]);
  near("AOG first zoom (zoom_fov)", aog.zoomFov43, 38.5907, 1e-4);
  near("AOG second zoom (zoom_toggle_fov)", aog.zoomToggleFov43 ?? NaN, 19.8583, 1e-4);
  near("AOG zoom blend time", aog.zoomToggleLerp, 0.15, 1e-9);
  eq("a fixed optic has no second zoom", resolveWeapon("rspn101", 0, ["optic_ranged_hcog"]).zoomToggleFov43, null);
  eq("the fitted optic is reported", aog.optic, "optic_ranged_aog_variable");
  eq("iron sights report no optic", resolveWeapon("rspn101", 0).optic, null);
  const threat = resolveWeapon("semipistol", 0, ["optic_cq_threat"]).threatRange;
  near("1x Digital Threat highlight fades from, m", threat?.[0] ?? NaN, 984 * 0.0254, 1e-6);
  near("and is gone by, m", threat?.[1] ?? NaN, 2165 * 0.0254, 1e-6);
  eq("a holo does not highlight", resolveWeapon("semipistol", 0, ["optic_cq_holosight"]).threatRange, null);
}

// ---------------------------------------------------------------- new movement
console.log("");
console.log("Apex movement constants (apexmovement.tech; engine values where noted)");
{
  const hu = (m: number) => m / HU;
  near("climb speed", hu(MOVE.climbSpeed), 225, 1e-9);
  near("climb space height", hu(MOVE.climbSpaceHeight), 147, 1e-9);
  near("attach offset", hu(MOVE.climbAttachOffset), 100, 1e-9);
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
  near("fall stun starts at the speed of a 300 hu fall", hu(MOVE.fallstunMinSpeed), 670.8, 0.1);
  near("and is full at the speed of an 800 hu fall", hu(MOVE.fallstunMaxSpeed), 1095.4, 0.1);
  near("holster speed boost", MOVE.holsterBoost, 1.15, 1e-9);
  // A climb from a low attach tops out at 100 + 28 hu above it; attaching
  // high, at 147 + 28 hu above the ground. Plus an 80 hu mantle reach, that is
  // the documented "about 6 m" of wall a legend can get up.
  near("highest ledge reachable by climb and mantle, metres", MOVE.climbSpaceHeight + MOVE.climbEndBoostHeight + MOVE.mantleHeight, 6.48, 0.01);

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
  near("350 down to sprint speed, s", ((350 - MOVE.sprintSpeed / HU) * HU) / MOVE.slideDecel, 0.9, 0.01);
  // Any slope over 7.7 degrees now holds a slide below 350 hu/s, and the 30
  // degree ramp settles a slide at about 372.
  near("break-even slope below 350 hu/s, degrees", (slideBreakEvenAngle(MOVE.sprintSpeed) * 180) / Math.PI, 7.66, 0.02);
  const settle = MOVE.slideExcessAbove + (MOVE.gravity * Math.sin(SLIDE_RAMP_ANGLE) - MOVE.slideDecel) / MOVE.slideExcessDecayRate;
  near("a slide down the ramp settles at, hu/s", settle / HU, 371.5, 0.5);
  near("the range ramp angle, degrees", (SLIDE_RAMP_ANGLE * 180) / Math.PI, 30.44, 0.01);

  // And the ramp must still be walkable: rise per step under the free step-up.
  const rampRun = 4.6 / Math.tan(SLIDE_RAMP_ANGLE);
  const risePerStep = 4.6 / 14;
  eq("ramp rise per step clears the step height", risePerStep < MOVE.stepHeight, true);
  near("ramp rise per step, metres", risePerStep, 0.329, 0.001);
  near("ramp run, metres", rampRun, 7.83, 0.02);
  eq("slope slide is capped", MOVE.slideSlopeMaxSpeed > MOVE.slideSpeedBoostCap, true);
  near("slope slide cap", hu(MOVE.slideSlopeMaxSpeed), 560, 1e-9);
}

console.log("");
console.log("Abilities: JOLT and TRIAGE (src/config/abilities.json)");
{
  const a = new Abilities();
  a.reset(true);
  eq("nothing picked at the start", a.picked, null);
  eq("JOLT refused before a pick", a.tryJolt(10), false);
  a.offer(10);
  eq("the card goes up when offered", a.choosing, true);
  a.pick("jolt");
  eq("a pick takes the card down", a.choosing, false);
  eq("JOLT holds two charges (the owner's number)", a.charge(10).charges, 2);
  eq("JOLT goes", a.tryJolt(10), true);
  eq("one charge left", a.charge(10).charges, 1);
  near("the spent one is back in 4 s (the owner's number)", a.charge(10).nextIn, 4, 1e-9);
  eq("not inside the first dash's gap", a.tryJolt(10.1), false);
  eq("the second goes right after", a.tryJolt(10 + JOLT.gap), true);
  eq("then none", a.charge(10.3).charges, 0);
  near("the first back 4 s after the first dash", a.cooldownLeft(10.3), 3.7, 1e-9);
  eq("refused at 13.9", a.tryJolt(13.9), false);
  eq("one back at 14", a.charge(14).charges, 1);
  near("the second 4 s after that (one at a time: 8 s for both)", a.charge(14).nextIn, 4, 1e-9);
  eq("both back at 18", a.charge(18).charges, 2);
  eq("and a pick that changes fills them", (a.tryJolt(20), a.pick("triage"), a.pick("jolt"), a.charge(20).charges), 2);
  eq("a refused dash is refunded", (a.tryJolt(30), a.refund(), a.charge(30).charges), 2);
  eq("the ability's config: 10 m in 0.14 s, out at 400 hu/s, 0.25 s between", [JOLT.distance, JOLT.duration, JOLT.exitSpeedHu, JOLT.gap].join(" "), "10 0.14 400 0.25");
  eq("JOLT's heal scale is 1", a.healScale, 1);
  a.pick("triage");
  eq("TRIAGE: heals twice as fast", a.healScale, 2);
  near("a shield cell with TRIAGE, s", itemsCfg.heals.cell.time / a.healScale, 1.25, 1e-9);
  near("a syringe with TRIAGE, s", itemsCfg.heals.syringe.time / a.healScale, 2, 1e-9);
  eq("TRIAGE is not a dash", a.tryJolt(100), false);
  const off = new Abilities();
  off.reset(false);
  off.offer(0);
  eq("abilities off: no card", off.choosing, false);
  off.pick("triage");
  eq("abilities off: no pick, no scale", off.healScale, 1);
  eq("network codes round-trip", abilityFromCode(abilityCode("triage")), "triage");
  eq("a bad code is none", abilityFromCode(9), null);
}

console.log("");
console.log("Guns that are not a plain trigger (src/config/weapon-mechanics.json)");
{
  const FDT = 1 / 144;
  /** hold the trigger for `secs` (ADS as given); the times of every shot, and the requests */
  const run = (id: string, secs: number, opts: { attach?: string[]; mag?: number; ads?: boolean; trigger?: (t: number) => boolean } = {}) => {
    const wpn = resolveWeapon(id, opts.mag ?? 0, opts.attach ?? []);
    const st = new WeaponState(wpn);
    const times: number[] = [];
    const reqs: Array<{ dmgScale: number; coneScale: number }> = [];
    let t = 100;
    st.update(FDT, t, false, false, "stand", "still", false, false, () => 0.5);
    for (let i = 0; i < Math.round(secs / FDT); i++) {
      t += FDT;
      const trig = opts.trigger ? opts.trigger(t - 100) : true;
      const out = st.update(FDT, t, trig, !!opts.ads, "stand", "still", false, false, () => 0.5);
      for (const r of out) {
        times.push(t - 100);
        reqs.push({ dmgScale: r.dmgScale, coneScale: r.coneScale });
      }
    }
    return { times, reqs, st, wpn };
  };
  const havoc = run("energy_ar", 1);
  near("HAVOC: the first round after the 0.42 s wind-up, s", havoc.times[0] ?? -1, 0.42, 2 / 144);
  const turbo = run("energy_ar", 0.3, { attach: ["hopup_turbocharger"] });
  near("HAVOC with the Turbocharger: at once, s", turbo.times[0] ?? -1, 0.01, 2 / 144);
  const dev = run("esaw", 3);
  const gap0 = dev.times[1] - dev.times[0];
  const gapN = dev.times[dev.times.length - 1] - dev.times[dev.times.length - 2];
  near("Devotion: its first rounds at 5 a second, s apart", gap0, 0.2, 0.02);
  near("Devotion: spun up after 1.75 s, 15 a second, s apart", gapN, 1 / 15, 0.01);
  const lstar = run("lstar", 2.5);
  eq("L-STAR: 24 rounds to overheat with no mag", lstar.times.length, 24);
  eq("L-STAR: then it is overheated", lstar.st.overheated, true);
  const lsAfter = run("lstar", 4);
  const last = lstar.times[23];
  const resumed = lsAfter.times.find((x) => x > last + 0.2) ?? -1;
  near("L-STAR: firing again after the 1.19 s cooldown, s", resumed - last, 1.19, 0.12);
  const lsCool = run("lstar", 3.5, { trigger: (x) => x < 1 });
  eq("L-STAR: let go and the heat comes back", lsCool.st.clip, 24);
  const cr = run("defender", 1.2, { trigger: (x) => x < 0.05 });
  near("Charge Rifle: the round leaves 0.85 s after the pull, s", cr.times[0] ?? -1, 0.85, 2 / 144);
  eq("Charge Rifle: one round a pull", cr.times.length, 1);
  const r30 = run("3030", 0.9, { ads: true, trigger: (x) => x > 0.75 && x < 0.77 });
  near("30-30: aimed 0.25 s, the round does +36%", r30.reqs[0]?.dmgScale ?? 0, 1.36, 1e-6);
  const r30hip = run("3030", 0.1, { trigger: (x) => x < 0.02 });
  near("30-30: from the hip, no charge", r30hip.reqs[0]?.dmgScale ?? 0, 1, 1e-6);
  const pk = run("energy_shotgun", 2.2, { ads: true, attach: ["hopup_energy_choke"], trigger: (x) => x > 2 && x < 2.02 });
  near("Precision choke: aimed long enough, the cone closes to 45%", pk.reqs[0]?.coneScale ?? 0, 0.45, 1e-6);
  const pkBare = run("energy_shotgun", 2.2, { ads: true, trigger: (x) => x > 2 && x < 2.02 });
  near("no choke fitted: the cone stays", pkBare.reqs[0]?.coneScale ?? 0, 1, 1e-6);
  // the Nemesis: bursts of 4 at 18 a second; 0.31 s between bursts, 0.19 s once charged
  // a purple magazine (32, eight bursts) so it charges fully before a reload
  const nem = run("nemesis", 3, { mag: 3 });
  near("Nemesis: rounds in a burst 1/18 s apart", nem.times[1] - nem.times[0], 1 / 18, 0.01);
  const gapBefore = (k: number) => nem.times[4 * k] - nem.times[4 * k - 1];
  const firstGap = gapBefore(1);
  const lastGap = gapBefore(6);
  near("Nemesis: uncharged, 0.31 s between bursts", firstGap, 0.31, 0.02);
  near("Nemesis: charged (6 bursts), 0.19 s between bursts", lastGap, 0.19, 0.02);
  eq("Nemesis: 17 a round, 20 in the magazine", `${resolveWeapon("nemesis", 0).damage.near}/${resolveWeapon("nemesis", 0).clipSize}`, "17/20");
  eq("Nemesis: energy ammo, a 3-magazine stockpile", `${resolveWeapon("nemesis", 0).ammoType}/${resolveWeapon("nemesis", 0).energyStock}`, "energy/3");
  // the Bocek: hold to draw, let go to loose
  const full = run("bocek", 1, { trigger: (x) => x < 0.4 });
  eq("Bocek: one arrow on the let-go", full.times.length, 1);
  near("Bocek: loosed at the let-go, s", full.times[0] ?? -1, 0.4, 2 / 144);
  near("Bocek: a full draw does all 55", full.reqs[0]?.dmgScale ?? 0, 1, 1e-9);
  const quick = run("bocek", 0.5, { trigger: (x) => x < 0.1 });
  eq("Bocek: a quick draw hits softer", (quick.reqs[0]?.dmgScale ?? 1) < 0.75 && (quick.reqs[0]?.dmgScale ?? 0) > 0.6, true);
  const again = run("bocek", 1.4, { trigger: (x) => x < 0.4 || (x > 0.95 && x < 1.35) });
  eq("Bocek: the next arrow nocks by itself", again.times.length, 2);
  eq("Bocek: arrows, and it takes optics only", resolveWeapon("bocek", 0).ammoType === "arrows" && Object.keys(weaponMods("bocek")).every((m) => m.startsWith("optic_")), true);

  // fire modes
  const lo = new Loadout(["hemlok", "pdw"]);
  eq("Hemlok: B switches to single", lo.toggleFireMode(), "single");
  eq("and it is semi-auto", lo.active.weapon.semiAuto, true);
  eq("B again: back to the burst", lo.toggleFireMode(), "burst 3");
  lo.requestSwap(1, 0);
  lo.update(10);
  eq("Prowler: no second mode without Selectfire", lo.toggleFireMode(), null);
  let hopTries = 0;
  while (lo.active.attach.hopup !== "selectfire" && hopTries++ < 10) lo.cycleAttachment("hopup");
  eq("Prowler: Selectfire fitted", lo.active.attach.hopup, "selectfire");
  eq("then B makes it automatic", lo.toggleFireMode(), "auto");
  eq("a burst no more", lo.active.weapon.burstCount <= 1 && !lo.active.weapon.semiAuto, true);
  // Hammerpoint and Disruptor scale the damage
  eq("Hammerpoint P2020: 2.7x on bare health", resolveWeapon("semipistol", 0, ["hopup_unshielded_dmg"]).damage.unshieldedScale, 2.7);
  eq("Disruptor Alternator: 1.55x on shields", resolveWeapon("alternator_smg", 0, ["hopup_shield_breaker"]).damage.shieldScale, 1.55);
  eq("Skullpiercer Wingman: headshot 2.25", resolveWeapon("wingman", 0, ["hopup_headshot_dmg"]).damage.headshot, 2.25);
}

console.log("");
console.log("Ammo (src/config/ammo.json, Season 30)");
{
  const lo = new Loadout(["rspn101", "energy_ar"]);
  lo.ammo.infinite = false;
  lo.ammo.kit(lo.slots.map((s) => s.weapon));
  lo.refillEnergy();
  eq("R-301: two stacks of light", lo.reserve(lo.slots[0]), 120);
  eq("HAVOC: its own three magazines", lo.reserve(lo.slots[1]), 54);
  const st = lo.slots[0].state;
  st.clip = 0;
  lo.ammo.stock.light = 10;
  st.startReload(0);
  st.update(1 / 60, 10, false, false, "stand", "still", false, false, () => 0.5);
  eq("a reload with 10 left loads 10", st.clip, 10);
  eq("and leaves none", lo.ammo.stock.light, 0);
  st.clip = 0;
  st.startReload(20);
  eq("nothing left: no reload", st.reloading, false);
  eq("and it says so", st.consumeNoAmmo(), true);
  // the HAVOC's stockpile: spend a magazine, it comes back after 18 s idle
  const e = lo.slots[1].energy!;
  e.rounds = 18;
  lo.update(100);
  lo.update(117.9);
  eq("energy: not back before 18 s", e.rounds, 18);
  lo.update(118.1);
  eq("energy: a magazine back after 18 s idle", e.rounds, 36);
  const inf = new Loadout(["rspn101", "wingman"]);
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
console.log("Heals and armour (src/config/items.json, Season 30)");
{
  const k = new Kit();
  k.fill("kit");
  eq("the arena kit: 4 cells, 2 batteries, 4 syringes, 2 med kits", `${k.items.cell}/${k.items.battery}/${k.items.syringe}/${k.items.medkit}`, "4/2/4/2");
  eq("20 shield missing: a cell", k.pick(55, 75, 100, 100), "cell");
  eq("60 shield missing: a battery", k.pick(15, 75, 100, 100), "battery");
  eq("shields before health", k.pick(50, 75, 40, 100), "cell");
  eq("20 health missing, full shield: a syringe", k.pick(75, 75, 80, 100), "syringe");
  eq("70 health missing: a med kit", k.pick(75, 75, 30, 100), "medkit");
  k.items.phoenix = 1;
  eq("both half gone and a phoenix: the phoenix", k.pick(10, 75, 20, 100), "phoenix");
  eq("full: nothing", k.pick(75, 75, 100, 100), null);
  eq("a stack holds six cells", k.add("cell", 10), 2);
  eq("med kits stack two", HEALS.medkit.stack, 2);
  near("a battery takes 5 s", HEALS.battery.time, 5, 1e-9);
  near("a med kit takes 8 s", HEALS.medkit.time, 8, 1e-9);
  near("a phoenix kit takes 10 s", HEALS.phoenix.time, 10, 1e-9);
  const a = new Armor();
  a.reset(1);
  eq("a battle royale starts on a white core", a.shieldMax, 50);
  eq("449 EVO: still white", a.addEvo(449), null);
  eq("450: blue", a.addEvo(1), 2);
  eq("blue holds 75", a.shieldMax, 75);
  a.addEvo(1700);
  eq("1,700 more (2,150 in all): purple, 100", a.shieldMax, 100);
  eq("purple is the top of the core", a.evoFrac, null);
  a.helmet = "red";
  eq("the mythic helmet: 125", a.shieldMax, 125);
  a.reset(1);
  a.helmet = "gold";
  eq("the gold helmet: 100 on a white core", a.shieldMax, 100);
  eq("and doubles the small heals", a.smallHealScale, 2);
}

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
  // the rolls: every id they can make is one the game knows
  const rnd = seeded(9);
  const rar: Record<string, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
  const unknown: string[] = [];
  const guns = new Set(weaponIds());
  let weapons = 0;
  for (let i = 0; i < 20000; i++) {
    const it = rollItem(rnd);
    if (it.kind === "weapon") {
      weapons++;
      rar[it.rarity]++;
      if (!guns.has(it.id)) unknown.push(it.id);
    }
    if (it.kind === "heal" && !(it.id in HEALS)) unknown.push(it.id);
  }
  for (const id of lootCfg.carePackage) if (!guns.has(id)) unknown.push(id);
  eq("every gun and heal the loot rolls is in the game", [...new Set(unknown)].join(",") || "none", "none");
  // against the configured weights, not a number typed here: the owner tunes
  // loot.json's rarity, and a test that hardcodes it just fails on their edit
  {
    const w = lootCfg.rarity as Record<string, number>;
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    for (const tier of ["common", "rare", "epic", "legendary"] as const) {
      near(`a ${tier} gun is ${Math.round((w[tier] / total) * 100)}% of guns, as loot.json weights it`, rar[tier] / weapons, w[tier] / total, 0.02);
    }
  }
  // every attachment and hop-up fits at least one gun in the loot pools
  const pool = [...new Set(Object.values(lootCfg.weapons).flat())];
  const fits = (slot: "optic" | "barrel" | "stock" | "hopup", mod: string) => pool.some((id) => optionsFor(slot, weaponMods(id), id).some((o) => o.mod === mod));
  const orphan = [...Object.values(lootCfg.attachments).flat(), ...lootCfg.hopups].filter((m) => {
    if (m.startsWith("mag:")) return false;
    const slot = lootCfg.hopups.includes(m) ? "hopup" : m.startsWith("optic_") ? "optic" : m.startsWith("barrel_") ? "barrel" : "stock";
    return !fits(slot, m);
  });
  eq("every attachment and hop-up on the floor fits some gun there", orphan.join(",") || "none", "none");
  // a loadout starts empty and fills from the floor
  const lo = new Loadout(["rspn101", "wingman"]);
  lo.clearSlot(0);
  lo.clearSlot(1);
  eq("cleared: both slots empty, the first free is 0", lo.emptySlot, 0);
  lo.give(0, "r97");
  eq("a gun into slot 0; the next free is 1", lo.emptySlot, 1);
  eq("a white mag fits the R-99", lo.fitMag(0, 1), true);
  eq("and a lower one does not", lo.fitMag(0, 1), false);
  eq("a blue barrel fits the R-99", lo.fitAttachment(0, "barrel", "barrel_stabilizer_l2"), true);
  eq("a sniper stock does not", lo.fitAttachment(0, "stock", "stock_sniper_l2"), false);
  eq("nothing fits an empty slot", lo.fitMag(1, 3), false);
  // down, not out: the bleed-out clock per knock (Season 30)
  eq("bleed-out: 90, 60, 30, 15 s", Duel.BLEED.join(","), "90,60,30,15");
  eq("a revive gives 20 health", Duel.REVIVE_HEALTH, 20);
}

console.log("");
console.log("The arena's modes (src/game/modes.ts, src/config/modes.json)");
{
  const guns = new Set(weaponIds());
  const bad = [...modesCfg.gunRun.short, ...modesCfg.gunRun.full].filter((id) => !guns.has(id));
  eq("every gun on Gun Run's lists is in the game", bad.join(",") || "none", "none");
  eq("the short list: 10 guns", gunList("short").length, 10);
  eq("the full list: every gun but the course's pistol (29), each once", new Set(gunList("full")).size === gunList("full").length && gunList("full").length === DATA_IDS_NO_COURSE.length, true);
  const l = new GunLadder(gunList("short"));
  eq("a kill moves the killer on", (l.kill(0, 1, false), l.level(0)), 1);
  eq("and costs the victim nothing", l.level(1), 0);
  l.row(1).level = 5;
  l.kill(0, 1, true);
  eq("a melee death costs a level (6 to 5)", l.level(1), 4);
  eq("the ring or yourself moves nobody on (two kills: level 2)", (l.kill(-1, 0, false), l.kill(0, 0, false), l.level(0)), 2);
  eq("the gun at level 2: the third on the list", l.gunFor(0), "vinson");
  l.row(0).level = 10;
  eq("after the last gun, the knife", l.gunFor(0), null);
  eq("at the knife, a grenade's kill wins nothing", l.kill(0, 3, false), false);
  eq("and moves nobody past the knife", l.gunFor(0), null);
  eq("a kill with the knife wins", l.kill(0, 2, true), true);
  l.row(9).level = 12;
  l.remove(9);
  eq("a player who left is off the ladder (no win on time)", l.sorted.some((r) => r.id === 9), false);
  eq("the leader: the highest level", l.leader?.id, 0);
  const tm = new TeamScore(3);
  eq("team deathmatch: two kills, no winner", (tm.kill(0), tm.kill(0)), null);
  eq("the third wins it", tm.kill(0), 0);
  eq("ahead at the time limit", tm.ahead, 0);
  const cr = new Crown(0, 0, 100);
  eq("the crown waits 20 s", cr.update(119.9, 0.1, []).event, null);
  eq("then appears in the middle", cr.update(120, 0.1, []).event, "appears");
  const fs = [
    { id: 1, x: 1.2, z: 0, alive: true },
    { id: 2, x: 0.5, z: 0, alive: true },
    { id: 3, x: 0.1, z: 0, alive: false },
  ];
  eq("the nearest one up within reach takes it", (cr.update(121, 0.1, fs), cr.carrier), 2);
  let won: number | null = null;
  for (let t = 0; t < 29.9 && won === null; t += 0.1) won = cr.update(121 + t, 0.1, fs).winner;
  eq("29.9 s held: not yet", won, null);
  eq("30 s held takes the round", cr.update(151, 0.2, fs).winner, 2);
  const cr2 = new Crown(0, 0, 0);
  cr2.update(20, 0.1, []);
  cr2.update(21, 0.1, fs);
  cr2.update(22, 10, fs);
  cr2.drop(5, 5);
  eq("a carrier who goes down drops it where they fell", `${cr2.phase} ${cr2.x},${cr2.z}`, "ground 5,5");
  eq("and the hold starts over", cr2.held, 0);
  eq("a respawn is the spawn farthest from the enemies", pickSpawn([[0, -29], [0, 29]], [{ x: 0, z: -20 }]).join(","), "0,29");
  near("a spawn at the -z end faces the middle (yaw 180)", yawToMiddle(0, -29), 180, 1e-9);
  near("a spawn on the -x side faces +x (yaw -90)", yawToMiddle(-16, 0), -90, 1e-9);
  const inside = [...modesCfg.spawns.a, ...modesCfg.spawns.b, ...modesCfg.spawns.mid].every(([x, z]) => Math.abs(x) <= 17 && Math.abs(z) <= 31);
  eq("every spawn is inside the arena's walls", inside, true);
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
  eq("a heal (with its item's code)", actFromCode(actCode("heal", 3)), "heal");
  eq("a heal's code carries the item", actCode("heal", 3), 13);
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
  eq("Control and team deathmatch are the team modes", teamMode("control") && teamMode("tdm") && !teamMode("crown"), true);
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
  const a = new Armor();
  a.reset(1);
  eq("450 EVO: blue", (a.addEvo(450), a.level), 2);
  eq("purple needs 1,700 more (2,150 in all), not 1,700 in all", (a.addEvo(1249), a.level), 2);
  eq("still blue at 2,149", (a.addEvo(450), a.level), 2);
  eq("at 2,150: purple", (a.addEvo(1), a.level), 3);
  eq("a knock is 150 EVO, an assist 100, a care package 100", [squadJson.evo.knock, squadJson.evo.assist, squadJson.evo.carePackage].join(" "), "150 100 100");
  eq("revives: 100 twice, then 25 less each", squadJson.evo.revive.join(" "), "100 100 75 50 25 0");
  eq("the knockdown shield by EVO level", squadJson.kdShield.hp.join(" "), "200 450 750");
  eq("the phoenix kit's name comes from names.ts (a codename, Nova kit, on a public build)", HEALS.phoenix.name, "Phoenix kit");
  near("behind it you crawl 45% slower", 1 - squadJson.kdShield.crawlScale, 0.45, 1e-9);
  eq("Deathbox Respawn: a 7 s hold, back at 20 health", [squadJson.boxRespawn.time, squadJson.boxRespawn.health].join(" "), "7 20");
  eq("the lockout grows with each death (ours), reset after 3 minutes alive", `${squadJson.boxRespawn.lockout.join(" ")} / ${squadJson.boxRespawn.resetAfter}`, "30 60 120 / 180");
  eq("Executioner is the Peacekeeper's and the Mastiff's", LOCKED_HOPUPS.hopup_executioner.guns.join(" "), "energy_shotgun mastiff");
  eq("50 shield over 5 s after a knock, unlocked at 275", [LOCKED_HOPUPS.hopup_executioner.shield, LOCKED_HOPUPS.hopup_executioner.over, LOCKED_HOPUPS.hopup_executioner.unlock].join(" "), "50 5 275");
  eq("Shattercaps: the 30-30's hip fire as 7 pellets of 8, heads x1.25", [lockedHopupFor("3030"), LOCKED_HOPUPS.hopup_shattercaps.pellets, LOCKED_HOPUPS.hopup_shattercaps.damage, LOCKED_HOPUPS.hopup_shattercaps.headshot].join(" "), "hopup_shattercaps 7 8 1.25");
  near("Shattercaps' blast at point blank: 56 to the body", (LOCKED_HOPUPS.hopup_shattercaps.pellets ?? 0) * (LOCKED_HOPUPS.hopup_shattercaps.damage ?? 0), 56, 1e-9);
  eq("Redline is the L-STAR's", lockedHopupFor("lstar"), "hopup_redline");
  eq("a gun without one has none", lockedHopupFor("r97"), null);
  const opts = (id: string) => optionsFor("hopup", {}, id).map((o) => o.mod);
  eq("the hop-up key offers Executioner on the Mastiff, not on the R-99", opts("mastiff").includes("hopup_executioner") && !opts("r97").includes("hopup_executioner"), true);
  eq("and they are effects, never in the data's mod chain", modNames({ hopup: "hopup_redline", barrel: "barrel_stabilizer_l1" }).join(" "), "barrel_stabilizer_l1");
}

console.log("");
console.log("Bot tiers (src/config/bots.json, docs/RESEARCH_PHASE_12.md section 4)");
{
  eq("four tiers", BOT_TIERS.join(" "), "easy normal hard elite");
  eq("reaction to a new sighting, s (CS2's Easy, Normal, Hard, Expert)", BOT_TIERS.map((t) => DIFFICULTY[t].reaction).join(" "), "0.6 0.4 0.2 0.12");
  near("easy's aim error on a new sighting, deg", aimError(DIFFICULTY.easy, 0), 14, 1e-9);
  near("after 1 s it has lost 30% of the extra (decay 0.7)", aimError(DIFFICULTY.easy, 1), 5 + 9 * 0.7, 1e-9);
  near("and settles at its floor", aimError(DIFFICULTY.easy, 60), 5, 1e-6);
  eq("each tier settles tighter than the one below", BOT_TIERS.every((t, i) => i === 0 || DIFFICULTY[t].errFloor < DIFFICULTY[BOT_TIERS[i - 1]].errFloor), true);
  eq("each tier's aim lags a moving target less", BOT_TIERS.every((t, i) => i === 0 || DIFFICULTY[t].aimLag < DIFFICULTY[BOT_TIERS[i - 1]].aimLag), true);
  eq("easy never dodges, throws no frags, takes no cover (TF2: easy bots never dodge)", [DIFFICULTY.easy.dodge, DIFFICULTY.easy.grenadeAfter, DIFFICULTY.easy.cover].join(" "), "0  false");
  eq("hard and elite always dodge", DIFFICULTY.hard.dodge === 1 && DIFFICULTY.elite.dodge === 1, true);
  eq("only elite pre-aims", BOT_TIERS.filter((t) => DIFFICULTY[t].preAim).join(" "), "elite");
  eq("a named tier is itself", tierFor("hard"), "hard");
  eq("an unknown one is normal", tierFor("nightmare" as never), "normal");
  // mixed: the config's weights, drawn from a fixed sequence
  const counts: Record<string, number> = { easy: 0, normal: 0, hard: 0, elite: 0 };
  for (let i = 0; i < 1000; i++) counts[tierFor("mixed", () => (i + 0.5) / 1000)]++;
  eq("mixed draws by weight (20 / 45 / 25 / 10 in a thousand)", [counts.easy, counts.normal, counts.hard, counts.elite].join(" "), "200 450 250 100");
  // a frag's lob lands where it was aimed: integrate the throw's own gravity
  const from = new THREE.Vector3(0, 1.6, 0);
  const to = new THREE.Vector3(12, 0, -9);
  const v = lobVelocity(from, to, 1.2);
  const p = from.clone();
  const vv = v.clone();
  for (let t = 0; t < 1.2 - 1e-9; t += 0.001) {
    vv.y -= throwablesCfg.gravity * 0.001;
    p.addScaledVector(vv, 0.001);
  }
  near("a bot's lob lands on the spot it aimed at, m", p.distanceTo(to), 0, 0.05);
}

console.log("");
console.log("Throwables (src/game/throwables.ts, src/config/throwables.json, Season 30)");
{
  eq("a frag inside 2.4 m: 100", blastDamage("frag", 2.4), 100);
  eq("at 8 m: nothing", blastDamage("frag", 8), 0);
  eq("half way out (5.2 m): 50", blastDamage("frag", 5.2), 50);
  eq("an arc star inside 1.8 m: 75", blastDamage("arcstar", 1), 75);
  eq("past 8.75 m: nothing", blastDamage("arcstar", 9), 0);
  near("its full 75 slows for 5 s", arcSlowFor(75), 5, 1e-9);
  near("30 of it, 2 s", arcSlowFor(30), 2, 1e-9);
  // flights on the floor alone (verify has no range built: the floor is all there is)
  const events: string[] = [];
  let blastAt = -1;
  let fireTicks = 0;
  const T = new Throwables(new THREE.Scene(), {
    onBlast: (t, at) => {
      events.push(`blast:${t.kind}`);
      blastAt = at.y;
    },
    onStrike: (t, id) => events.push(`strike:${t.kind}:${id}`),
    onFireTick: () => fireTicks++,
    onSound: () => undefined,
  });
  const run = (seconds: number, t0: number, targets: Array<{ id: number; feet: THREE.Vector3 }> = []) => {
    let now = t0;
    for (let i = 0; i < seconds * 60; i++) {
      now += 1 / 60;
      T.update(now, 1 / 60, targets);
    }
    return now;
  };
  T.throw("frag", new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 2, -12), -1, true, 0);
  run(3.9, 0);
  eq("a frag has not gone off at 3.9 s", events.includes("blast:frag"), false);
  run(0.2, 3.9);
  eq("it goes off on its 4 s fuse", events.includes("blast:frag"), true);
  eq("having come to rest on the floor", blastAt >= 0 && blastAt < 0.2, true);
  events.length = 0;
  T.throw("arcstar", new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 0, -20), -1, true, 10);
  let now = run(0.6, 10);
  const stuck = T.live[0]?.stuck !== null;
  eq("an arc star sticks where it lands", stuck, true);
  const fuse = (T.live[0]?.fuseAt ?? 0) - now;
  eq("and goes off 2.8 s after that", fuse > 2.2 && fuse <= 2.8, true);
  run(2.9, now);
  eq("it did", events.includes("blast:arcstar"), true);
  events.length = 0;
  const bot = { id: 7, feet: new THREE.Vector3(0, 0, -6) };
  T.throw("arcstar", new THREE.Vector3(0, 1.2, 0), new THREE.Vector3(0, 0, -18), -1, true, 20);
  now = run(0.5, 20, [bot]);
  eq("thrown at a figure, it sticks to them", events.includes("strike:arcstar:7") && T.live[0]?.stuck?.target === 7, true);
  bot.feet.set(3, 0, -6);
  run(0.2, now, [bot]);
  eq("and goes where they go", Math.abs((T.live[0]?.pos.x ?? 0) - 3) < 0.4, true);
  T.clear();
  T.throw("thermite", new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 1, -10), -1, true, 40);
  now = run(1.2, 40);
  eq("thermite lands as a line of fire", T.fires.length, 1);
  const f = T.fires[0];
  near("6 m long", f.a.distanceTo(f.b), 6, 1e-6);
  eq("across the throw (the line runs along x for a throw down -z)", Math.abs(f.a.z - f.b.z) < 1e-6, true);
  eq("the middle of it burns", Throwables.inFire(f, f.a.clone().lerp(f.b, 0.5)), true);
  eq("a metre to the side does not", Throwables.inFire(f, f.a.clone().lerp(f.b, 0.5).add(new THREE.Vector3(0, 0, 1))), false);
  run(8.5, now);
  eq("8 s of fire, a tick every half second: 16 ticks (17 counting the one it lands with)", fireTicks >= 16 && fireTicks <= 17, true);
  eq("and then it is out", T.fires.length, 0);
  const o = new Ordnance();
  o.endless = false;
  o.fill("kit");
  eq("the arena kit: one of each", `${o.counts.frag}/${o.counts.arcstar}/${o.counts.thermite}`, "1/1/1");
  eq("G readies the first you have", o.cycle(0), "frag");
  eq("again: the next", o.cycle(0), "arcstar");
  eq("after the last, back to the gun", (o.cycle(0), o.cycle(0)), null);
  o.cycle(0);
  eq("a throw spends one", (o.spend(), o.counts.frag), 0);
  eq("with none left G skips it", o.cycle(0), "arcstar");
  eq("a stack holds two", o.add("thermite", 5), 1);
}

console.log("");
console.log("Finishing touches: medals, per-optic ADS, the controller's advanced look, a first draw");
{
  eq("a room at its par: gold", medalFor(5, 5), "gold");
  eq("25% over: silver", medalFor(6.25, 5), "silver");
  eq("60% over: bronze", medalFor(8, 5), "bronze");
  eq("past that: none", medalFor(8.1, 5), null);
  eq("a skipped room: none", medalFor(NaN, 5), null);
  for (const L of [BASIC_COURSE, ADVANCED_COURSE]) {
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
  const lo = new Loadout(["rspn101", "wingman"]);
  eq("a loadout's own guns: no flourish", lo.slots[0].firstDraw ?? false, false);
  lo.give(1, "r97");
  eq("a gun picked up: its first draw has the flourish", lo.slots[1].firstDraw, true);
}

console.log("");
console.log("The death recap (src/game/recap.ts)");
{
  const log = new DamageLog();
  log.clear(0);
  // you hit bot 1 twice (one head), bot 1 hits you three times with an R-301 at 18 to 25 m, bot 2 once from 60 m
  log.hit({ t: 1, from: 0, to: 1, amount: 20, head: true, weapon: "r97", dist: 12 });
  log.hit({ t: 1.2, from: 0, to: 1, amount: 15, head: false, weapon: "r97", dist: 12 });
  log.hit({ t: 2, from: 1, to: 0, amount: 30, head: false, weapon: "rspn101", dist: 18 });
  log.hit({ t: 2.5, from: 2, to: 0, amount: 70, head: true, weapon: "sentinel", dist: 60 });
  log.hit({ t: 3, from: 1, to: 0, amount: 45, head: true, weapon: "rspn101", dist: 25 });
  log.hit({ t: 3.2, from: 1, to: 0, amount: 30, head: false, weapon: "rspn101", dist: 22 });
  log.heal({ t: 1.5, id: 1, item: "cell" });
  log.heal({ t: -20, id: 2, item: "syringe" });
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
  near("healed 1.8 s before", r.rows[0].healed?.ago ?? -1, 1.8, 1e-9);
  eq("with a shield cell", r.rows[0].healed?.item, "SHIELD CELL");
  eq("what they had left", (r.rows[0].left?.shield ?? 0) + (r.rows[0].left?.health ?? 0), 140);
  eq("the other attacker's row", r.rows[1].name, "BOT VOLT");
  eq("a heal 23 s before is not 'recently'", r.rows[1].healed, null);
  eq("everything you took", r.totalTaken, 175);
  const ring = log.recap(4, -1, () => "?", () => null);
  eq("the ring: named", ring.killerName, "THE RING");
  eq("the ring: no row for it", ring.rows.every((x) => x.id >= 0), true);
}

console.log("");
console.log("Movement simulation (tools/movesim.ts)");
fails += movesimFails;

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
fails += skyHoursFails + ringPlaceFails + lootTiersFails + pickupReachFails + botSenseFails + viewmodelArmsFails + audioOcclusionFails;

console.log(fails === 0 ? "\nVERIFY PASS" : `\nVERIFY FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
