// The practice aim bot (Settings, "Aim bot"): it steers your view onto the
// nearest enemy chest you can actually see.
//
// This is a training toy, not a game mechanic: it is for learning recoil,
// movement and time-to-kill without fighting your own aim, and for filming.
// It works in a match with friends too (the owner asked for that: a 1v1 where
// both of you know about it is a laugh). What it cannot be is secret, so
// whoever has it on wears a red bar and the word AIM BOT over them on every
// other screen, at any range, through walls (hud.ts drawPlates, and the `bot`
// flag on the state packet).
//
// It reuses aim assist's two honest rules: the target is the torso hitbox, so
// it follows a crouch and a fall, and a wall between you and it means no
// target at all (the same `solidHit` the bullets use).
import * as THREE from "three";
import type { Dummy } from "./dummy";
import { solidHit } from "./projectile";
import cfg from "../config/aimbot.json";

const DEG = Math.PI / 180;
const wrap = (a: number): number => ((((a + 180) % 360) + 360) % 360) - 180;

export interface AimbotInput {
  eye: THREE.Vector3;
  yaw: number;
  pitch: number;
  dt: number;
  targets: Dummy[];
}

/** where to turn to this frame, or null when it has nothing to aim at */
export interface AimbotResult {
  yaw: number;
  pitch: number;
  target: Dummy;
}

export class Aimbot {
  enabled = false;
  private readonly at = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();

  update(a: AimbotInput): AimbotResult | null {
    if (!this.enabled) return null;
    let best: { d: Dummy; yaw: number; pitch: number; off: number } | null = null;
    for (const d of a.targets) {
      if (!d.group.visible || d.knocked) continue;
      const part = d.hitMeshes.find((m) => m.userData.zone === (cfg.head ? "head" : "body")) ?? d.hitMeshes[1];
      if (!part) continue;
      part.getWorldPosition(this.at);
      this.dir.subVectors(this.at, a.eye);
      const dist = this.dir.length();
      if (dist < 0.5 || dist > cfg.range) continue;
      const yaw = Math.atan2(-this.dir.x, -this.dir.z) / DEG;
      const pitch = Math.asin(this.dir.y / dist) / DEG;
      // how far off your aim it is: it takes the closest inside the cone
      const off = Math.hypot(wrap(yaw - a.yaw) * Math.cos(a.pitch * DEG), pitch - a.pitch);
      if (off > cfg.cone / 2) continue;
      if (best && off >= best.off) continue;
      // a wall in the way and it is not a target
      if (solidHit(a.eye, this.dir.clone().divideScalar(dist), dist) < dist) continue;
      best = { d, yaw, pitch, off };
    }
    if (!best) return null;
    // an exponential close on the remaining angle, capped by the turn rate, so
    // it sweeps onto a target rather than teleporting the view onto it
    const k = 1 - Math.exp(-cfg.smooth * a.dt);
    const cap = cfg.turnRate * a.dt;
    const dy = wrap(best.yaw - a.yaw);
    const dp = best.pitch - a.pitch;
    const step = (d: number): number => Math.max(-cap, Math.min(cap, d * k));
    return { yaw: a.yaw + step(dy), pitch: a.pitch + step(dp), target: best.d };
  }
}
