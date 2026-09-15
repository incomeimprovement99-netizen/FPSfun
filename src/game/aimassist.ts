// Aim assist for a controller, in the game's two parts:
//
//   Slowdown: with the reticle inside a target's zone the right stick turns
//   slower, so a small correction lands instead of overshooting.
//   Rotational: while you are moving the stick or walking, the view follows a
//   share of the target's own movement across the screen. With no input it
//   does nothing: it helps a tracking player, it never aims for one.
//
// The zone is a sphere round the target's chest, so it shrinks on screen with
// distance, and a wall between you and the target switches it off. Only the
// pad's look is touched; mouse input never is. Numbers: src/config/aimassist.json.
import * as THREE from "three";
import cfg from "../config/aimassist.json";
import type { Dummy } from "./dummy";
import { solidHit } from "./projectile";

const DEG = Math.PI / 180;

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

export class AimAssist {
  enabled = true;
  private last: { target: Dummy; yaw: number; pitch: number } | null = null;
  private readonly chest = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();

  update(a: AssistInput): AssistResult {
    const none: AssistResult = { slow: 1, yawLeft: 0, pitchUp: 0, target: null };
    if (!this.enabled) {
      this.last = null;
      return none;
    }
    const radius = cfg.zoneRadiusHip + (cfg.zoneRadiusAds - cfg.zoneRadiusHip) * a.ads;
    let best: { d: Dummy; yaw: number; pitch: number; closeness: number } | null = null;
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
      if (best && closeness <= best.closeness) continue;
      // line of sight: a wall in the way and there is nothing to assist
      if (solidHit(a.eye, this.dir.clone().divideScalar(dist), dist) < dist) continue;
      best = { d, yaw, pitch, closeness };
    }
    if (!best) {
      this.last = null;
      return none;
    }
    const slowdown = cfg.slowdownHip + (cfg.slowdownAds - cfg.slowdownHip) * a.ads;
    // full slowdown at the centre, easing out toward the zone's edge
    const slow = 1 - (1 - slowdown) * Math.min(1, best.closeness * 2);
    let yawLeft = 0;
    let pitchUp = 0;
    if (this.last && this.last.target === best.d && a.activeInput) {
      const dy = wrap(best.yaw - this.last.yaw);
      const dp = best.pitch - this.last.pitch;
      if (Math.abs(dy) < cfg.rotationalMaxDeg && Math.abs(dp) < cfg.rotationalMaxDeg) {
        yawLeft = dy * cfg.rotationalStrength;
        pitchUp = dp * cfg.rotationalStrength;
      }
    }
    this.last = { target: best.d, yaw: best.yaw, pitch: best.pitch };
    return { slow, yawLeft, pitchUp, target: best.d };
  }
}
