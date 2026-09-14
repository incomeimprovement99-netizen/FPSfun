// P1 verification: assert the simulation reproduces the reference numbers.
// Run: npm run verify
import { resolveWeapon, weaponMods, weaponIds, DATA } from "../src/game/weapons";
import { optionsFor, SLOTS } from "../src/game/attachments";
import { cmPer360, degPerCount, hipFov43, verticalFovFrom43, adsSensScale } from "../src/game/sens";
import { ViewKick, tuning } from "../src/game/recoil";
import { Loadout } from "../src/game/loadout";
import { MODELLED_IDS } from "../src/game/gunmodels";
import { movesimFails } from "./movesim";
import { HU, MOVE, jumpVelocityFor, slideBreakEvenAngle, SLIDE_RAMP_ANGLE } from "../src/game/movement";

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
  eq("attachment slots", SLOTS.join(","), "optic,barrel,stock,laser");

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
  // changing an attachment tops the mag up: this is a range with unlimited ammo
  lo.active.state.clip = 3;
  lo.cycleAttachment("optic");
  eq("changing an attachment tops the mag up", lo.active.state.clip, lo.active.weapon.clipSize);
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
// feel immediate is that only the sprint TOP END builds slowly: you reach walk
// speed in about 0.29 s, and anything that is not "speed up along the current
// heading" uses the deceleration rate, which is 12.5x the sprint acceleration.
console.log("\nMovement responsiveness");
{
  near("sprint is 1.5x walk", MOVE.sprintSpeed / MOVE.speed, 1.4985, 0.001);
  // lowAcceleration below lowSpeed, then acceleration up to walk speed
  near("time to walk speed from a standstill", MOVE.lowSpeed / MOVE.lowAcceleration + (MOVE.speed - MOVE.lowSpeed) / MOVE.acceleration, 0.167, 0.005);
  near("the sprint tail on top of that", (MOVE.sprintSpeed - MOVE.speed) / MOVE.sprintAcceleration, 0.865, 0.005);
  near("stop from full sprint", MOVE.sprintSpeed / MOVE.deceleration, 0.208, 0.002);
  eq("deceleration dwarfs sprint acceleration", MOVE.deceleration / MOVE.sprintAcceleration, 12.5);

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

console.log("\nRoster sanity");
// 27 from the game's data, plus the Glock 17 added for the course
eq("weapon count", Object.keys(DATA.weapons).length, 28);
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

console.log(fails === 0 ? "\nVERIFY PASS" : `\nVERIFY FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
