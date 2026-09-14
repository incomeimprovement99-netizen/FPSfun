// View kick.
//
// The engine's own math is documented in the header of the reference
// `springs.txt`, which states: the spring oscillates iff 4k > c^2, its
// frequency is sqrt(4k - c^2)/(4*PI), and its amplitude half-life is
// 2*ln(2)/c. Both of those identities hold uniquely for
//
//     x'' = -k*x - c*x'        (unit mass, per axis)
//
// so the ODE below is not a guess. `tools/verify.ts` asserts the integrator
// reproduces that published half-life.
//
// Each weapon names TWO springs, cold and hot. Heat builds while firing and
// blends cold -> hot. For the R-301 the hot ADS pitch springConstant is 0,
// i.e. no restoring force at all, so the punch accumulates through a spray
// and only springs back once the gun cools. That is the mechanism that makes
// recoil hold while you hold the trigger, and it comes entirely from data.
//
// Pattern rows are [yaw, pitch, yawRandom, pitchRandom]; negative pitch is UP.
import type { ResolvedWeapon, Spring } from "./weapons";
import tuningJson from "../config/recoil-tuning.json";

export interface RecoilTuning {
  /**
   * Multiplier on the soft (velocity) impulse. The one number that is NOT
   * recoverable from any public source. Valve's ancestor of this engine uses
   * `m_vecPunchAngleVel += angleOffset * 20`, so 20 is the inherited default.
   */
  softImpulseScale: number;
  /** multiplies the whole kick; 1 = exactly as the data says */
  globalScale: number;
}
export const tuning: RecoilTuning = {
  softImpulseScale: tuningJson.softImpulseScale,
  globalScale: tuningJson.globalScale,
};

interface Axis {
  disp: number;
  vel: number;
}

export interface KickResult {
  /**
   * Permanent change to the player's aim, from the viewkick_perm_* fields.
   * This is NOT the same as hardScale: hard feeds the spring and recovers,
   * perm does not. Zero for the R-301 and most weapons.
   */
  permPitchUp: number;
  permYawLeft: number;
  /**
   * Spring offset as it stood the instant BEFORE this shot's kick. The bullet
   * leaves along this aim, not the post-kick one, or every shot is deflected
   * by its own recoil (44 cm high at 20 m on the first R-301 round).
   */
  preSoftPitchUp: number;
  preSoftYawLeft: number;
}

export class ViewKick {
  private pitch: Axis = { disp: 0, vel: 0 };
  private yaw: Axis = { disp: 0, vel: 0 };
  /** pattern cursor; fractional, decays back down after a delay */
  private value = 0;
  private heat = 0;
  private lastShotAt = -Infinity;
  /** how far the cursor decay has already been integrated */
  private decayedTo = -Infinity;

  constructor(private w: ResolvedWeapon) {}

  /** swap to a different weapon: clears the spring, heat and cursor */
  setWeapon(w: ResolvedWeapon): void {
    this.w = w;
    this.reset();
  }

  /**
   * Same weapon, different attachment. Keeps the spring, heat and cursor, so
   * changing mag level mid-spray does not cancel the recoil you have built up.
   */
  setWeaponKeepState(w: ResolvedWeapon): void {
    this.w = w;
  }

  private rowAt(index: number): number[] {
    const pat = this.w.viewkick.pattern;
    // No pattern (the Wingman and most single-fire guns): the kick comes
    // straight from viewkick_*_base / _random, so the row must be all ones.
    if (!pat || pat.bullets.length === 0) return [1, 1, 1, 1];
    const len = pat.bullets.length;
    const off = Number.isFinite(pat.loopOffset)
      ? Math.max(0, Math.min(len - 1, Math.floor(pat.loopOffset)))
      : 0;
    let i = index;
    if (i >= len) {
      const loopLen = Math.max(1, len - off);
      i = off + ((i - len) % loopLen);
    }
    return pat.bullets[Math.max(0, Math.min(i, len - 1))];
  }

  /** register a shot; returns the permanent aim change and the pre-shot aim */
  kick(now: number, ads: boolean, inAir: boolean, crouched: boolean, rnd: () => number): KickResult {
    // decay the cursor up to this moment before reading it
    this.decayValue(now);
    const preSoftPitchUp = this.pitch.disp;
    const preSoftYawLeft = this.yaw.disp;

    const vk = this.w.viewkick;
    const row = this.rowAt(Math.floor(this.value));
    const r = () => rnd() * 2 - 1;
    let yawK = row[0] * vk.yawBase + r() * (row[2] ?? 0) * vk.yawRandom;
    let pitchK = row[1] * vk.pitchBase + r() * (row[3] ?? 0) * vk.pitchRandom;

    let scale = tuning.globalScale;
    // the field is viewkick_air_scale_ads: it applies in the air WHILE AIMED,
    // not to hipfire
    if (inAir && ads) scale *= vk.airScaleAds;
    if (crouched) scale *= vk.duckScale;
    yawK *= scale;
    pitchK *= scale;

    // engine pitch negative = up; convert to "up positive"
    const pitchUp = -pitchK;
    const yawLeft = yawK;

    // soft eases in through velocity, hard snaps the angle ("chunky" in the
    // reference weapon files). Both feed the same spring and both recover.
    this.pitch.vel += pitchUp * vk.pitchSoft * tuning.softImpulseScale;
    this.yaw.vel += yawLeft * vk.yawSoft * tuning.softImpulseScale;
    this.pitch.disp += pitchUp * vk.pitchHard;
    this.yaw.disp += yawLeft * vk.yawHard;

    this.value += vk.valuePerShot;
    this.heat = Math.min(1, this.heat + vk.heatPerShot);
    this.lastShotAt = now;
    this.decayedTo = -Infinity; // a new shot restarts the idle clock

    return {
      permPitchUp: -(vk.permPitchBase + r() * vk.permPitchRandom),
      permYawLeft: vk.permYawBase + r() * vk.permYawRandom,
      preSoftPitchUp,
      preSoftYawLeft,
    };
  }

  /**
   * Cursor walks back down after valueDecayDelay, at valueDecayRate per
   * second. Decay must be INCREMENTAL: subtracting rate x (total idle time)
   * on every call, twice a frame, annihilated a 10-round cursor in 0.15 s
   * against the 0.29 s the data schedules, and did it faster the longer the
   * spray had been.
   */
  private decayValue(now: number): void {
    const vk = this.w.viewkick;
    const startsAt = this.lastShotAt + vk.valueDecayDelay;
    if (now <= startsAt) {
      this.decayedTo = Math.max(this.decayedTo, startsAt);
      return;
    }
    const from = Math.max(this.decayedTo, startsAt);
    if (now <= from) return;
    this.value = Math.max(0, this.value - vk.valueDecayRate * (now - from));
    this.decayedTo = now;
  }

  /** current heat: holds for cooldownHoldTime after the last shot, then fades */
  private heatAt(now: number): number {
    const vk = this.w.viewkick;
    const idle = now - this.lastShotAt;
    if (idle <= vk.cooldownHoldTime) return this.heat;
    if (vk.cooldownFadeTime <= 0) return 0;
    const t = (idle - vk.cooldownHoldTime) / vk.cooldownFadeTime;
    return this.heat * Math.max(0, 1 - t);
  }

  private springConst(cold: Spring | null, hot: Spring | null, key: string, fallback: number, h: number): number {
    const c = cold?.[key] ?? fallback;
    const o = hot?.[key];
    return o === undefined ? c : c + (o - c) * h;
  }

  update(dt: number, ads: boolean, now: number): void {
    const vk = this.w.viewkick;
    const pre = ads ? "ADS_" : "hipfire_";
    const h = Math.max(0, Math.min(1, this.heatAt(now)));
    const kP = this.springConst(vk.spring, vk.springHot, `${pre}pitch_springConstant`, 60, h);
    const cP = this.springConst(vk.spring, vk.springHot, `${pre}pitch_damping`, 18, h);
    const kY = this.springConst(vk.spring, vk.springHot, `${pre}yaw_springConstant`, 60, h);
    const cY = this.springConst(vk.spring, vk.springHot, `${pre}yaw_damping`, 18, h);

    // fixed sub-steps keep the integration stable at any frame rate
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const step = dt / steps;
    for (let i = 0; i < steps; i++) {
      stepAxis(this.pitch, kP, cP, step);
      stepAxis(this.yaw, kY, cY, step);
    }
    // let the cursor and heat decay even on frames with no shot
    this.decayValue(now);
    if (this.heatAt(now) === 0) this.heat = 0;
  }

  /** current spring offset, degrees (up positive, left positive) */
  offset(): { pitchUp: number; yawLeft: number } {
    return { pitchUp: this.pitch.disp, yawLeft: this.yaw.disp };
  }

  /** pattern cursor, for diagnostics */
  cursor(): number {
    return this.value;
  }
  heatValue(now: number): number {
    return this.heatAt(now);
  }

  reset(): void {
    this.pitch = { disp: 0, vel: 0 };
    this.yaw = { disp: 0, vel: 0 };
    this.value = 0;
    this.heat = 0;
    this.lastShotAt = -Infinity;
    this.decayedTo = -Infinity;
  }
}

/** semi-implicit Euler on x'' = -k*x - c*x' */
function stepAxis(a: Axis, k: number, c: number, h: number): void {
  a.vel += (-k * a.disp - c * a.vel) * h;
  a.disp += a.vel * h;
}
