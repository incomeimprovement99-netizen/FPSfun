// Aim assist for a controller, in the game's two parts:
//
//   Slowdown: with the reticle inside a target's zone the right stick turns
//   slower, so a small correction lands instead of overshooting.
//   Rotational: while you are moving the stick or walking, the view follows a
//   share of the target's own movement across the screen. With no input it
//   does nothing: it helps a tracking player, it never aims for one.
//
// The zone is a sphere round the target's chest, so it shrinks on screen with
// distance, and a wall between you and the target switches it off. Its
// strength fades past falloffStart to nothing at maxRange, and it holds the
// target it has until that target leaves its zone, so it never snaps from one
// figure to another. Only the pad's look is touched; mouse input never is.
//
// Three strengths (Milestone 620: a playtester on a controller barely noticed it), and with standard and strong a
// snap as the aim comes up: a target near the reticle draws the view part of the way to it over a tenth of a second.
// Numbers: src/config/aimassist.json.
import * as THREE from "three";
import cfg from "../config/aimassist.json";
import type { Dummy } from "./dummy";
import { solidHit } from "./projectile";

const DEG = Math.PI / 180;

/** how strong the assist is (aimassist.json levels): what was every pad's until Milestone 620, the default, and more */
export type AssistLevel = "light" | "standard" | "strong";

export interface AssistInput {
  eye: THREE.Vector3;
  /** the player's view angles, degrees (yaw left positive, pitch up positive) */
  yaw: number;
  pitch: number;
  /** 0..1 down the sights */
  ads: number;
  /** the right stick is being used this frame, or the movement keys are */
  activeInput: boolean;
  /** figures that can be aimed at (knocked or hidden ones are skipped) */
  targets: readonly Dummy[];
}

export interface AssistResult {
  /** multiply the stick's look by this */
  slow: number;
  /** add these to the view, degrees */
  yawLeft: number;
  pitchUp: number;
  /** the figure in the zone, or null */
  target: Dummy | null;
}

const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/** the assist's strength at a distance: 1 up to falloffStart, easing to 0 at maxRange */
export function falloff(dist: number): number {
  if (dist <= cfg.falloffStart) return 1;
  const t = Math.min(1, (dist - cfg.falloffStart) / Math.max(1e-6, cfg.maxRange - cfg.falloffStart));
  return 1 - t * t * (3 - 2 * t);
}

export class AimAssist {
  enabled = true;
  level: AssistLevel = "standard";
  private last: { target: Dummy; yaw: number; pitch: number } | null = null;
  /** the snap as the aim comes up: whom, and how long it has left */
  private snapping: { target: Dummy; left: number } | null = null;
  private readonly chest = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();

  update(a: AssistInput): AssistResult {
    const none: AssistResult = { slow: 1, yawLeft: 0, pitchUp: 0, target: null };
    if (!this.enabled) {
      this.last = null;
      return none;
    }
    const L = cfg.levels[this.level];
    const radius = L.zoneHip + (L.zoneAds - L.zoneHip) * a.ads;
    type Pick = { d: Dummy; yaw: number; pitch: number; closeness: number; dist: number };
    let best = null as Pick | null;
    // the target already held wins while it is still in its zone (no snapping to a nearer one)
    let held = null as Pick | null;
    for (const d of a.targets) {
      if (!d.group.visible || d.knocked) continue;
      // the torso hitbox's centre: it follows a crouch and a fall
      const torso = d.hitMeshes[1];
      if (!torso) continue;
      torso.getWorldPosition(this.chest);
      this.dir.subVectors(this.chest, a.eye);
      const dist = this.dir.length();
      if (dist < 0.5 || dist > cfg.maxRange) continue;
      const yaw = Math.atan2(-this.dir.x, -this.dir.z) / DEG;
      const pitch = Math.asin(this.dir.y / dist) / DEG;
      // angle between the view and the chest, against the zone's angular size
      const off = Math.hypot(wrap(yaw - a.yaw) * Math.cos(a.pitch * DEG), pitch - a.pitch);
      const zone = Math.atan(radius / dist) / DEG;
      if (off > zone) continue;
      const closeness = 1 - off / zone;
      const isHeld = cfg.sticky && this.last?.target === d;
      if (!isHeld && best && closeness <= best.closeness) continue;
      // line of sight: a wall in the way and there is nothing to assist
      if (solidHit(a.eye, this.dir.clone().divideScalar(dist), dist) < dist) continue;
      const c = { d, yaw, pitch, closeness, dist };
      if (isHeld) held = c;
      else best = c;
    }
    if (held) best = held;
    if (!best) {
      this.last = null;
      return none;
    }
    const slowdown = L.slowdownHip + (L.slowdownAds - L.slowdownHip) * a.ads;
    const range = falloff(best.dist);
    // full slowdown at the centre, easing out toward the zone's edge, and with distance
    const slow = 1 - (1 - slowdown) * Math.min(1, best.closeness * 2) * range;
    const rotational = (L.rotational + (L.rotationalAds - L.rotational) * a.ads) * range;
    let yawLeft = 0;
    let pitchUp = 0;
    if (this.last && this.last.target === best.d && a.activeInput) {
      const dy = wrap(best.yaw - this.last.yaw);
      const dp = best.pitch - this.last.pitch;
      if (Math.abs(dy) < cfg.rotationalMaxDeg && Math.abs(dp) < cfg.rotationalMaxDeg) {
        yawLeft = dy * rotational;
        pitchUp = dp * rotational;
      }
    }
    this.last = { target: best.d, yaw: best.yaw, pitch: best.pitch };
    return { slow, yawLeft, pitchUp, target: best.d };
  }

  /** a target's chest as a bearing from the eye: yaw, pitch and distance, or null when it is hidden, down or walled off */
  private bearing(eye: THREE.Vector3, d: Dummy): { yaw: number; pitch: number; dist: number } | null {
    if (!d.group.visible || d.knocked) return null;
    const torso = d.hitMeshes[1];
    if (!torso) return null;
    torso.getWorldPosition(this.chest);
    this.dir.subVectors(this.chest, eye);
    const dist = this.dir.length();
    if (dist < 0.5) return null;
    if (solidHit(eye, this.dir.clone().divideScalar(dist), dist) < dist) return null;
    return { yaw: Math.atan2(-this.dir.x, -this.dir.z) / DEG, pitch: Math.asin(this.dir.y / dist) / DEG, dist };
  }

  /**
   * The aim just came up on a pad: the nearest target to the reticle within snapAngle and snapRange, in sight, is
   * the one the view turns toward over the next snapTime (snapStep). None at a level without a snap.
   */
  startSnap(a: AssistInput): void {
    this.snapping = null;
    if (!this.enabled || cfg.levels[this.level].snap <= 0) return;
    let best: { d: Dummy; off: number } | null = null;
    for (const d of a.targets) {
      const b = this.bearing(a.eye, d);
      if (!b || b.dist > cfg.snapRange) continue;
      const off = Math.hypot(wrap(b.yaw - a.yaw) * Math.cos(a.pitch * DEG), b.pitch - a.pitch);
      if (off > cfg.snapAngle || (best && off >= best.off)) continue;
      best = { d, off };
    }
    if (best) this.snapping = { target: best.d, left: cfg.snapTime };
  }

  /**
   * This frame's turn of the snap, degrees: a share of what is left to the target's chest, so over snapTime the view
   * goes the level's `snap` of the way, following the target as it moves. Nothing once it is done or the target is lost.
   */
  snapStep(a: AssistInput, dt: number): { yawLeft: number; pitchUp: number } {
    const s = this.snapping;
    if (!s || !this.enabled) return { yawLeft: 0, pitchUp: 0 };
    const b = this.bearing(a.eye, s.target);
    if (!b || s.left <= 0) {
      this.snapping = null;
      return { yawLeft: 0, pitchUp: 0 };
    }
    const step = Math.min(dt, s.left);
    s.left -= step;
    // the share of what is left this frame, so the frames of snapTime come to `snap` of the way between them
    const k = 1 - Math.pow(1 - cfg.levels[this.level].snap, step / cfg.snapTime);
    return { yawLeft: wrap(b.yaw - a.yaw) * k, pitchUp: (b.pitch - a.pitch) * k };
  }
}
